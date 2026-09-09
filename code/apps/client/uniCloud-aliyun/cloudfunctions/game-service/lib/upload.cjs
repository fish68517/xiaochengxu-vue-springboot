'use strict';
// 对象存储上传(Phase 3 波次 4b):uniCloud 云存储上传 + attachments 落库 + 敏感附件水印/审计。
// 上传走 uniCloud.uploadFile(云函数环境注入),私有读走 getTempFileURL 临时签名 URL(前端不缓存长期 URL)。
const { newId } = require('./repository.cjs');

// biz_type 允许会话角色:complete_proof/id_card=接单人员,dispute=客户。
const ALLOWED_BIZ_TYPES = ['complete_proof', 'id_card', 'dispute'];
const BIZ_TYPE_ROLES = {
  complete_proof: ['WORKER'],
  id_card: ['WORKER'],
  dispute: ['CUSTOMER'],
};
// 敏感附件(字段级加密标记 + 查看审计)。
const SENSITIVE_BIZ_TYPES = new Set(['id_card']);

// 角色-类型权限判定:未注册类型一律拒绝。
function isBizTypeAllowedForRole(bizType, role) {
  const allowed = BIZ_TYPE_ROLES[bizType];
  return !!allowed && allowed.includes(role);
}

// 水印文本:接单人员姓名 + 上传时间(本地时区)。
function buildWatermarkText({ uploaderName, uploadedAt }) {
  const d = new Date(uploadedAt || Date.now());
  const pad = (n) => String(n).padStart(2, '0');
  const when = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
  return `${uploaderName || '接单人员'} ${when}`.trim();
}

// 云存储路径:业务类型/业务ID/文件键,便于桶内分目录与生命周期管理。
function buildCloudPath({ bizType, bizId, storageKey, fileName }) {
  return `${bizType}/${bizId || 'misc'}/${storageKey || newId('key')}${fileName ? `-${fileName}` : ''}`;
}

function getUniCloud() {
  return globalThis.uniCloud || (typeof uniCloud !== 'undefined' ? uniCloud : undefined);
}

function createUploadClient({ env = process.env, uniCloud: injected, now = () => Date.now() } = {}) {
  const u = injected || getUniCloud();

  // 标准上传接口:cloudPath 为对象键,fileContent 为 Buffer(content 默认按 base64 解码)。
  async function uploadFileBuffer({ cloudPath, buffer, content, options = {} }) {
    if (!u || typeof u.uploadFile !== 'function') throw new Error('当前环境缺少 uniCloud.uploadFile(云存储上传仅云函数内可用)');
    const fileContent = buffer || (typeof content === 'string' ? Buffer.from(content, options.encoding || 'base64') : content);
    if (!fileContent) throw new Error('缺少文件内容');
    const res = await u.uploadFile({ ...options, cloudPath, fileContent });
    return { fileID: res.fileID || res.fileId || res.file_id || res.id, cloudPath };
  }

  // 私有读:临时签名 URL(getTempFileURL),前端不缓存长期 URL。
  async function signTempUrl({ fileID }) {
    if (!fileID || !u || typeof u.getTempFileURL !== 'function') return { fileID, url: '' };
    const res = await u.getTempFileURL({ fileList: [fileID] });
    const item = (res && res.fileList && res.fileList[0]) || {};
    return { fileID, url: item.tempFileURL || item.url || '' };
  }

  // 上传 + attachments 落库:storageKey 唯一幂等;id_card 叠加水印 + encrypted 字段级加密标记。
  async function uploadAttachment(repo, {
    bizType, bizId, fileName, size, content, buffer, fileID, storageKey, contentHash,
    uploaderId, uploaderName, brandId = 'default',
  }) {
    if (!ALLOWED_BIZ_TYPES.includes(bizType)) throw new Error('非法上传类型');
    if (storageKey) {
      const existed = await repo.findOne('attachments', { storageKey });
      if (existed) return { attachmentId: existed._id, url: existed.url, storageKey: existed.storageKey, fileID: existed.fileID, existed: true };
    }
    const key = storageKey || `${contentHash || newId('key')}`;
    const sensitive = SENSITIVE_BIZ_TYPES.has(bizType);
    const watermarkText = sensitive ? buildWatermarkText({ uploaderName, uploadedAt: now() }) : '';
    let fid = fileID || '';
    if (content !== undefined || buffer !== undefined) {
      // 云端上传(客户端传 base64 content / Buffer):上传后签发私有签名 URL。
      const up = await uploadFileBuffer({ cloudPath: buildCloudPath({ bizType, bizId, storageKey: key, fileName }), content, buffer });
      fid = up.fileID;
    }
    let url = '';
    if (fid) {
      const signed = await signTempUrl({ fileID: fid });
      url = signed.url || fid;
    }
    const doc = {
      _id: newId('att'), brandId, bizType, bizId: bizId || '', fileName: fileName || '',
      size: size || 0, url, storageKey: key, fileID: fid,
      uploaderId: uploaderId || '', watermarkText, encrypted: sensitive, uploadedAt: now(),
    };
    await repo.insert('attachments', doc);
    return { attachmentId: doc._id, url: doc.url, storageKey: doc.storageKey, fileID: fid };
  }

  // 敏感附件查看审计:身份证被查看时写 notifications 留痕(由查看 action/波次 5 接入)。
  async function auditSensitiveView(repo, { attachment, viewerId, viewerRole }) {
    if (!attachment || !SENSITIVE_BIZ_TYPES.has(attachment.bizType)) return null;
    return repo.insert('notifications', {
      _id: newId('notify'), brandId: attachment.brandId || 'default', receiverId: viewerId || '', channel: 'INBOX', template: 'SENSITIVE_ATTACHMENT_VIEW',
      payload: { attachmentId: attachment._id, bizType: attachment.bizType, viewerRole: viewerRole || '' },
      status: 'SENT', createdAt: now(),
    });
  }

  return { uploadFileBuffer, signTempUrl, uploadAttachment, auditSensitiveView };
}

module.exports = {
  ALLOWED_BIZ_TYPES, BIZ_TYPE_ROLES, SENSITIVE_BIZ_TYPES,
  isBizTypeAllowedForRole, buildWatermarkText, buildCloudPath, createUploadClient,
};

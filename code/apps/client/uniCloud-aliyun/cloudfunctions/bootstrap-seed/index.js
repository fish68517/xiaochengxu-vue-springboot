'use strict';

const { timingSafeEqual } = require('node:crypto');
const { createUniCloudRepository, newId } = require('./lib/repository.cjs');
const Privacy = require('./lib/privacy.cjs');
const Security = require('./lib/account-security.cjs');
const services = require('./lib/services.cjs');

const ADMIN_PHONE = '13800000000';
const ADMIN_INITIAL_PASSWORD = 'admin123';
const BRAND_ID = 'demo-a';
const DEFAULT_BRAND_APPID = 'wxe40bb897376601cc';

function bootstrapError(message, code) {
  return Object.assign(new Error(message), { code });
}

function secureEqual(actual, expected) {
  const left = Buffer.from(String(actual || ''), 'utf8');
  const right = Buffer.from(String(expected || ''), 'utf8');
  return left.length === right.length && timingSafeEqual(left, right);
}

function validateEnvironment(env) {
  if (!env.BOOTSTRAP_SECRET || String(env.BOOTSTRAP_SECRET).length < 32) {
    throw bootstrapError('BOOTSTRAP_SECRET 未配置或长度不足 32 位', 'BOOTSTRAP_DISABLED');
  }
  // 强制校验正式 PII 密钥，避免云端首次冷启动生成临时密钥后写入不可恢复的手机号密文。
  Privacy.keyConfig(env);
}

function assertCompatibleAdmin(user) {
  if (!['ADMIN', 'SUPER_ADMIN'].includes(user.role) || user.status !== 'ACTIVE') {
    throw bootstrapError('手机号已存在，但不是可用管理员；为避免覆盖已有数据，初始化已停止', 'BOOTSTRAP_DATA_CONFLICT');
  }
}

function assertCompatibleBrandRole(role) {
  if (role.status !== 'ACTIVE' || !Array.isArray(role.roles) || !role.roles.includes('ADMIN')) {
    throw bootstrapError('管理员在 demo-a 已存在不兼容的品牌授权；为避免覆盖已有数据，初始化已停止', 'BOOTSTRAP_DATA_CONFLICT');
  }
}

async function initialize(repo, env = process.env) {
  const created = [];
  const skipped = [];

  // 阿里云 uniCloud 事务对象不支持 collection.where(...).get()，而正式仓储的
  // find/findOne 正是条件查询；因此初始化采用“先查后写、逐项幂等”的顺序执行。
  // 任一步失败后再次运行只会补齐缺项，不会覆盖已存在的正式数据。
  const transaction = repo;
    let admin = await transaction.findOne('users', { phone: ADMIN_PHONE });
    if (admin) {
      assertCompatibleAdmin(admin);
      skipped.push('users:admin');
    } else {
      // 演示初始密码不满足正式 createStaff 的 12 位强密码策略，因此仅在此一次性函数中
      // 复用正式 scrypt Hash 与正式用户字段，并强制 mustChangePwd，绝不保存明文密码。
      admin = await transaction.insert('users', {
        _id: newId('user'),
        role: 'ADMIN',
        phone: ADMIN_PHONE,
        passwordHash: Security.hashPassword(ADMIN_INITIAL_PASSWORD),
        nickname: '管理员',
        status: 'ACTIVE',
        mustChangePwd: true,
        securityVersion: 0,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });
      created.push('users:admin');
    }

    const session = {
      userId: admin._id,
      role: 'ADMIN',
      roles: ['ADMIN'],
      brandScopes: [BRAND_ID],
      permissions: [],
    };

    const existingBrand = await transaction.findOne('brands', { brandId: BRAND_ID });
    if (existingBrand) {
      if (!['ON', 'ACTIVE'].includes(existingBrand.status)) {
        throw bootstrapError('demo-a 品牌已存在但未启用；为避免覆盖已有数据，初始化已停止', 'BOOTSTRAP_DATA_CONFLICT');
      }
      skipped.push('brands:demo-a');
    } else {
      await services.saveBrandConfig(transaction, {
        brandId: BRAND_ID,
        code: BRAND_ID,
        appId: env.BOOTSTRAP_BRAND_APPID || DEFAULT_BRAND_APPID,
        name: '星河服务',
        isDefault: true,
        status: 'ON',
        themeTokens: { primary: '#5b6cff', secondary: '#34c6ad', bg: '#f4f6ff', text: '#1d2440' },
        copy: { headerTitle: '星河精选服务', searchPlaceholder: '搜索星河服务' },
        banners: ['/static/default-banner.svg'],
        contactConfig: { serviceWechat: 'xinghe-service', serviceHours: '09:00-22:00' },
        assetConfig: { defaultProductImage: '/static/default-product.svg' },
        requestId: 'bootstrap-seed:brand:demo-a',
      }, session);
      created.push('brands:demo-a');
    }

    const existingRole = await transaction.findOne('user_brand_roles', { userId: admin._id, brandId: BRAND_ID });
    if (existingRole) {
      assertCompatibleBrandRole(existingRole);
      skipped.push('user_brand_roles:demo-a');
    } else {
      await services.saveUserBrandRoles(transaction, {
        userId: admin._id,
        brandId: BRAND_ID,
        roles: ['ADMIN'],
        permissions: [],
        status: 'ACTIVE',
        requestId: 'bootstrap-seed:role:admin:demo-a',
      }, session);
      created.push('user_brand_roles:demo-a');
    }

    const rows = await transaction.find('configs', {});
    const existingKeys = new Set(rows.map((row) => row.cfgKey));
    const defaults = await services.getConfigs(transaction, {}, session);
    const missingConfigs = Object.fromEntries(
      Object.entries(defaults).filter(([key]) => !existingKeys.has(key)),
    );
    if (Object.keys(missingConfigs).length) {
      await services.updateConfigs(transaction, { configs: missingConfigs }, session);
    }
    for (const key of Object.keys(defaults)) {
      (existingKeys.has(key) ? skipped : created).push(`configs:${key}`);
    }
  return { ok: true, created, skipped };
}

exports.main = async (event = {}, context = {}) => {
  const env = process.env;
  try {
    if (!env.BOOTSTRAP_SECRET || String(env.BOOTSTRAP_SECRET).length < 32) {
      throw bootstrapError('一次性初始化函数尚未启用', 'BOOTSTRAP_DISABLED');
    }
    if (!secureEqual(event.secret, env.BOOTSTRAP_SECRET)) {
      return { ok: false, code: 'BOOTSTRAP_FORBIDDEN', message: '初始化凭证不正确' };
    }
    if (context.SOURCE && context.SOURCE !== 'server') {
      return { ok: false, code: 'BOOTSTRAP_FORBIDDEN', message: '仅允许从云端控制台执行初始化' };
    }
    validateEnvironment(env);
    const rawRepo = createUniCloudRepository(uniCloud.database());
    const repo = Privacy.protectRepository(rawRepo, env);
    return await initialize(repo, env);
  } catch (error) {
    const knownCode = String(error && error.code || 'BOOTSTRAP_FAILED');
    return {
      ok: false,
      code: knownCode.startsWith('PII_') || knownCode.startsWith('BOOTSTRAP_') ? knownCode : 'BOOTSTRAP_FAILED',
      message: String(error && error.message || '初始化失败'),
    };
  }
};

// HBuilderX/阿里云当前运行时按 module.exports 加载；同时保留文档要求的 exports.main 入口。
module.exports = exports.main;
module.exports.main = module.exports;
module.exports.initialize = initialize;

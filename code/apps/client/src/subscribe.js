// 订阅消息授权钩子(C-08):小程序端拉起一次性模板授权,成功后调 requestSubscribe 落额度;用户拒绝可跳过,不阻塞流程。
import { api } from './api.js';

const TEMPLATE_KEY = 'ORDER_STATUS_UPDATE'; // 一次性「订单状态更新」模板键(与后端 subscribe_quota.templateKey 对齐)

// 拉起订阅授权并上报:uni.requestSubscribeMessage 成功回调里已勾选才上报(一单一授权)。
export async function requestSubscribeMessage(orderId) {
  if (typeof uni === 'undefined' || typeof uni.requestSubscribeMessage !== 'function') return false;
  try {
    const res = await new Promise((resolve) => {
      uni.requestSubscribeMessage({
        tmplIds: [TEMPLATE_KEY],
        success: resolve,
        fail: resolve, // 用户拒绝/接口失败均视为可跳过
      });
    });
    const accepted = res && res[TEMPLATE_KEY] === 'accept';
    if (!accepted) return false;
    try {
      await api.requestSubscribe({ templateKey: TEMPLATE_KEY, orderId });
      return true;
    } catch (e) {
      // 上报失败静默:订阅是尽力而为,不阻塞
      return false;
    }
  } catch (e) {
    return false;
  }
}

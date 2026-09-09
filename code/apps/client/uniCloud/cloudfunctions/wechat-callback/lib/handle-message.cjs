'use strict';

// 解析回调报文：兼容 body 为 JSON 字符串、已解析对象、或直接透传 event 三种形态；解析失败返回 {raw} 兜底。
function parseBody(event) {
  if (!event) return {};
  if (event.body) {
    if (typeof event.body === 'string') {
      try { return JSON.parse(event.body); } catch (_) { return { raw: event.body }; }
    }
    return event.body;
  }
  return event;
}

// 提取「进入客服会话」事件：仅 user_enter_tempsession 返回 openid 与 sessionFrom。
// sessionFrom 来自小程序 <button open-type="contact" session-from="商品id">，用于自动下发对应商品的 H5 下单链接。
function extractEnterTempSession(msg) {
  if (!msg) return null;
  if (msg.MsgType !== 'event') return null;
  if (msg.Event !== 'user_enter_tempsession') return null;
  return {
    openid: msg.FromUserName || '',
    sessionFrom: msg.SessionFrom || '',
  };
}

module.exports = { parseBody, extractEnterTempSession };

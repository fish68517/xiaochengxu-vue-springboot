// 支付通道边界：业务服务只依赖统一 Adapter 契约，Mock 与微信通道共享支付单/成功落账逻辑。
export class PaymentAdapter {
  constructor(mode) { this.mode = mode; }
  channel(payType) { throw new Error(`PaymentAdapter.channel 未实现: ${payType}`); }
  clientParams() { throw new Error('PaymentAdapter.clientParams 未实现'); }
}

export class MockPaymentAdapter extends PaymentAdapter {
  constructor() { super('mock'); }
  channel() { return 'MOCK'; }
  clientParams({ payment }) {
    return { paymentMode: 'mock', paymentId: payment._id, paymentNo: payment.paymentNo, status: payment.status, payType: 'MOCK', mockToken: `mock_${payment.paymentNo}` };
  }
}

export class WechatPaymentAdapter extends PaymentAdapter {
  constructor() { super('wechat'); }
  channel(payType) { return `WECHAT_${payType}`; }
  clientParams({ payment, payType, jsapi, mwebUrl }) {
    const base = { paymentMode: 'wechat', paymentId: payment._id, paymentNo: payment.paymentNo, status: payment.status, payType };
    return payType === 'JSAPI' ? { ...base, jsapi } : { ...base, mwebUrl, h5Url: mwebUrl };
  }
}

export function createPaymentAdapter(mode) {
  const normalized = String(mode || '').toLowerCase();
  if (normalized === 'mock') return new MockPaymentAdapter();
  if (normalized === 'wechat') return new WechatPaymentAdapter();
  throw new Error('PAYMENT_MODE 必须为 mock/wechat');
}

// 仅在H5表单向同一个小程序交还支付控制时加载；不传token、金额或支付签名。
let sdkPromise;
function loadSdk() {
  if (window.wx?.miniProgram?.getEnv) return Promise.resolve(window.wx);
  if (!sdkPromise) {
    sdkPromise = new Promise((resolve, reject) => {
      const script = document.createElement('script');
      const timer = setTimeout(() => finish(new Error('小程序通信组件加载超时，请重试')), 10000);
      function finish(error) {
        clearTimeout(timer);
        script.onload = script.onerror = null;
        if (error) { script.remove(); reject(error); }
        else resolve(window.wx);
      }
      script.src = 'https://res.wx.qq.com/open/js/jweixin-1.6.0.js';
      script.onload = () => finish(window.wx?.miniProgram?.getEnv ? null : new Error('小程序通信组件不可用'));
      script.onerror = () => finish(new Error('小程序通信组件加载失败，请检查网络'));
      document.head.appendChild(script);
    }).catch((error) => { sdkPromise = null; throw error; });
  }
  return sdkPromise;
}

export async function openMiniPayment(orderId) {
  if (!orderId) throw new Error('缺少订单号');
  const sdk = await loadSdk();
  await new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('无法连接小程序，请从我的订单继续支付')), 8000);
    sdk.miniProgram.getEnv((result) => {
      clearTimeout(timer);
      if (result?.miniprogram) resolve();
      else reject(new Error('请在原小程序的我的订单中继续支付'));
    });
  });
  await new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('跳转支付页超时，请从我的订单继续支付')), 8000);
    sdk.miniProgram.redirectTo({
      url: `/pages/order/pay?orderId=${encodeURIComponent(orderId)}`,
      success: () => { clearTimeout(timer); resolve(); },
      fail: () => { clearTimeout(timer); reject(new Error('无法打开支付页，请更新小程序后从我的订单继续支付')); },
    });
  });
}

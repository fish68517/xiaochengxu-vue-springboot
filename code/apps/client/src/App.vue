<script setup>
import { onLaunch } from '@dcloudio/uni-app';
import { loadBrandConfig, getAppId } from './brand.js';
import { ensureSession } from './api.js';

onLaunch(async () => {
  console.log('client launch');
  // 品牌配置先于业务会话；生产环境解析失败由页面品牌门禁展示并阻止继续进入业务。
  try {
    await loadBrandConfig(getAppId());
  } catch (e) {
    console.warn('品牌配置加载失败', e && e.message);
  }
  // 小程序会话:wx.login 静默换 openid(H5 环境无 wx.login,内部跳过);失败不阻塞,页面按需重试。
  try {
    await ensureSession();
  } catch (e) {
    console.warn('会话初始化跳过', e && e.message);
  }
});
</script>

<style lang="scss">
@use './styles/tokens.scss';
html, body, #app { min-height: 100%; }
body { margin: 0; -webkit-font-smoothing: antialiased; }
page, body {
  background: var(--brand-bg);
  color: var(--brand-text);
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'PingFang SC', 'Microsoft YaHei', sans-serif;
}
view, text, image, button, input, textarea, scroll-view, swiper { box-sizing: border-box; }
button, input, textarea { font: inherit; }
button::after { border: 0; }
</style>

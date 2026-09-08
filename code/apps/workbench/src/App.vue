<script setup>
import { onLaunch } from '@dcloudio/uni-app';
onLaunch(() => {
  console.log('workbench launch');
});
</script>

<style lang="scss">
@use './styles/tokens.scss';
html, body, #app { min-height: 100%; }
body { margin: 0; -webkit-font-smoothing: antialiased; }
page, body {
  background: var(--es-bg);
  color: var(--es-text);
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'PingFang SC', 'Microsoft YaHei', sans-serif;
}
view, text, image, button, input, textarea, scroll-view { box-sizing: border-box; }
button, input, textarea { font: inherit; }
button::after { border: 0; }
/* 兼容历史跳转页和仍使用旧类名的局部表单，保持浅色主题下可读。 */
.input, .textarea, .filter-input, .picker-value, .filter-value {
  background: #fff !important;
  color: var(--es-text) !important;
  border-color: var(--es-border-soft) !important;
}
</style>

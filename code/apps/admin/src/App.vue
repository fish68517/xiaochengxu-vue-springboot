<script setup>
import { onLaunch } from '@dcloudio/uni-app';
onLaunch(() => { console.log('admin launch'); });
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
button { cursor: pointer; }
button[disabled] { cursor: not-allowed; opacity: .55; }

/* Batch 5-6：兼容既有页面类名的统一浅色后台基线，业务模板无需推倒重写。 */
.admin-content .page { padding: 0 !important; }
.admin-content .head {
  margin: 0 0 20px !important;
  padding: 0 !important;
  border: 0 !important;
  background: transparent !important;
  box-shadow: none !important;
}
.admin-content .head-title,
.admin-content .title { color: var(--es-text) !important; }
.admin-content .section-title,
.admin-content .section,
.admin-content .panel-title,
.admin-content .strong { color: var(--es-text) !important; }
.admin-content .label { color: #344054 !important; font-weight: 600; }
.admin-content .form,
.admin-content .filters,
.admin-content .filter,
.admin-content .panel,
.admin-content .list,
.admin-content .table-wrap,
.admin-content .card,
.admin-content .worker-row,
.admin-content .product-row,
.admin-content .brand-row,
.admin-content .review-row,
.admin-content .vip-row,
.admin-content .drawer,
.admin-content .dialog,
.admin-content .editor,
.admin-content .users,
.admin-content .recon-card {
  border: 1px solid var(--es-border-soft) !important;
  background: var(--es-bg-panel) !important;
  box-shadow: var(--es-glow) !important;
}
.admin-content .input,
.admin-content .textarea,
.admin-content .picker {
  min-height: 40px !important;
  color: var(--es-text) !important;
  border: 1px solid var(--es-border) !important;
  background: #fff !important;
  border-radius: var(--es-radius-sm) !important;
}
.admin-content .input:focus-within,
.admin-content .textarea:focus-within,
.admin-content .picker:focus-within {
  border-color: var(--es-primary) !important;
  box-shadow: 0 0 0 3px rgba(79, 70, 229, .12) !important;
}
.admin-content .btn,
.admin-content .mini-btn,
.admin-content .save-btn,
.admin-content .add-btn,
.admin-content .link {
  color: var(--es-primary) !important;
  border: 1px solid #c7d2fe !important;
  background: var(--es-primary-soft) !important;
  border-radius: var(--es-radius-sm) !important;
  box-shadow: none !important;
}
.admin-content .save-btn,
.admin-content .add-btn {
  color: #fff !important;
  border-color: var(--es-primary) !important;
  background: var(--es-primary) !important;
}
.admin-content .danger { color: var(--es-danger) !important; border-color: #fecdca !important; background: var(--es-danger-soft) !important; }
.admin-content .th { color: var(--es-text-dim) !important; background: #f9fafb; }
.admin-content .tr { border-color: var(--es-border-soft) !important; }
.admin-content .tab.active { color: var(--es-primary) !important; border-color: #c7d2fe !important; background: var(--es-primary-soft) !important; }
.admin-content .empty { color: var(--es-text-dim) !important; }
.admin-content .mask,
.admin-content .drawer-mask { background: rgba(15, 23, 42, .48) !important; backdrop-filter: blur(2px); }

@media (max-width: 900px) {
  .admin-content { padding: 16px !important; }
  .admin-content .head { align-items: flex-start !important; flex-direction: column !important; }
  .admin-content .filters,
  .admin-content .filter { flex-direction: column !important; align-items: stretch !important; }
}

@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after { scroll-behavior: auto !important; transition-duration: .01ms !important; animation-duration: .01ms !important; }
}
</style>

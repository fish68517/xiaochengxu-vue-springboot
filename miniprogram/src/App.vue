<script setup lang="ts">
import { onLaunch } from '@dcloudio/uni-app'
import { useSessionStore } from './stores/session'

onLaunch(() => useSessionStore().load())
</script>

<style lang="scss">
@import './styles/theme.scss';
page { background:#f5f7fa; color:#18233a; font-family:"Microsoft YaHei",Arial,sans-serif; font-size:28rpx; }
view,text,button,input,textarea { box-sizing:border-box; }
button::after { border:0; }
.page { min-height:100vh; padding:24rpx 28rpx 150rpx; }
.custom-nav { padding:calc(var(--status-bar-height) + 18rpx) 28rpx 24rpx; background:#fff; display:flex;align-items:center;justify-content:space-between; }
.custom-nav .title { font-size:36rpx;font-weight:800; }.env-badge{font-size:20rpx;padding:8rpx 14rpx;border-radius:18rpx;background:#eaf2ff;color:#1768ed}
.card { background:#fff;border:1rpx solid #e7ecf4;border-radius:24rpx;box-shadow:0 10rpx 30rpx rgba(37,76,122,.06); }
.primary-btn { background:linear-gradient(135deg,#2379ff,#075ae4);color:white;border-radius:44rpx;font-size:28rpx;font-weight:700;line-height:88rpx;height:88rpx; }
.ghost-btn { color:#1768ed!important;background:#fff!important;border:2rpx solid #7eb0ff!important;border-radius:32rpx!important;font-size:24rpx!important;line-height:58rpx!important;height:62rpx!important;padding:0 25rpx!important; }
.section-title { display:flex;align-items:center;justify-content:space-between;margin:30rpx 4rpx 18rpx; }.section-title text:first-child{font-size:31rpx;font-weight:800}.section-title text:last-child{font-size:24rpx;color:#8993a5}
.empty { padding:60rpx 20rpx;text-align:center;color:#9aa4b6; }
.status { font-size:22rpx;font-weight:700;padding:7rpx 15rpx;border-radius:20rpx; }.status.PENDING{color:#f04444;background:#fff0f0}.status.OVERDUE{color:#ed3f3f;background:#ffe9e9}.status.PAID,.status.COMPLETED{color:#16a661;background:#e9f9f0}.status.REPAIRING{color:#f28a16;background:#fff5e9}
.safe-bottom { padding-bottom:calc(30rpx + env(safe-area-inset-bottom)); }
</style>


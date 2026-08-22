<script setup lang="ts">
import { ref } from 'vue'
import { onLoad } from '@dcloudio/uni-app'
import AppHeader from '@/components/AppHeader.vue'
import PetArtwork from '@/components/PetArtwork.vue'
import { getLotteryResult } from '@/api/lottery'
import { formatDate } from '@/utils/format'
import type { LotteryResult } from '@/models'

const result = ref<LotteryResult | null>(null)
const loading = ref(true)
const error = ref('')
onLoad(async (options) => {
  try {
    const id = Number(options?.id)
    if (!id) throw new Error('缺少活动 ID')
    result.value = await getLotteryResult(id)
  }
  catch (err) { error.value = err instanceof Error ? err.message : '结果加载失败' }
  finally { loading.value = false }
})
</script>

<template>
  <view class="app-shell result-page">
    <AppHeader title="抽奖结果" back />
    <view v-if="loading" class="loading-block">正在加载开奖结果...</view>
    <view v-else-if="error || !result" class="error-block">{{ error || '暂无开奖结果' }}</view>
    <template v-else>
      <view class="result-hero"><text class="pets">🐢　　　　　　　　　🐰</text><text class="title">{{ result.title }}</text><text class="drawn">已开奖</text></view>
      <view class="page-body">
        <view class="mine app-card"><view class="mine-copy"><b>✿ 我的参与结果</b><view><text class="face">☹</text><view><strong>{{ result.my_result.won ? '恭喜中奖' : '未中奖' }}</strong><text>{{ result.my_result.message }}</text></view></view><text class="points">🪙 已获得参与积分 <b>{{ result.my_result.points }}</b> 分</text></view><view class="cup">🏆<button>查看中奖名单 ›</button></view></view>
        <view class="announce app-card"><view><b>📣 开奖结果公布</b><text>开奖时间：{{ formatDate(result.draw_at) }}</text></view><text>参与人数：<b>{{ result.participant_count }}</b> 人</text></view>
        <view class="winners app-card"><view class="section-title"><text>🏆 中奖名单</text></view><view v-if="!result.winners.length" class="empty-block">暂无中奖记录</view><view v-for="winner in result.winners" :key="`${winner.nickname}-${winner.prize}`" class="winner"><text class="avatar">🐾</text><text>{{ winner.nickname }}</text><b :class="winner.level">{{ winner.level }}</b><text>{{ winner.prize }}</text></view></view>
        <view class="prize-setting app-card"><view class="section-title"><text>🎁 奖项设置</text></view><view class="prize-grid"><view v-for="prize in result.prizes" :key="prize.level"><text class="level">{{ prize.level }}</text><PetArtwork :type="prize.icon" size="sm" /><b>{{ prize.name }}</b><small>共 {{ prize.quantity }} 份</small></view></view></view>
        <view class="claim app-card"><view><b>🎁 领奖方式</b><text>中奖用户请在活动有效期内联系管理员或客服，确认身份信息后领取对应奖品。</text><button class="primary-button">联系管理员领奖</button></view><text class="claim-pets">🐢🐰</text></view>
        <view class="history app-card">📜　查看往期中奖名单 <text>›</text></view>
        <text class="footer-help">🎧 如有疑问，请联系管理员或客服</text>
      </view>
    </template>
  </view>
</template>

<style scoped lang="scss">
.result-page{background:linear-gradient(#fff9ed,#fff1d2)}.result-hero{height:235rpx;position:relative;overflow:hidden;display:flex;flex-direction:column;align-items:center;background:radial-gradient(circle,#fff9e3,#f7dc9b)}.pets{position:absolute;left:12rpx;right:12rpx;bottom:-20rpx;font-size:130rpx;white-space:pre}.title{position:relative;z-index:2;margin-top:32rpx;color:#e94f16;font-size:43rpx;font-weight:900;text-shadow:0 3rpx #fff}.drawn{position:relative;z-index:2;margin-top:17rpx;padding:7rpx 35rpx;border:3rpx solid #f68a28;border-radius:8rpx;color:#e86a19;background:#fff2c9;font-size:28rpx;font-weight:800}.mine{display:grid;grid-template-columns:1fr 180rpx;padding:22rpx}.mine-copy>b{display:block;font-size:25rpx}.mine-copy>view{display:flex;align-items:center;margin:18rpx 0}.face{margin-right:25rpx;color:#9d9287;font-size:80rpx}.mine-copy strong{display:block;font-size:36rpx}.mine-copy view text{display:block;font-size:20rpx}.points{font-size:21rpx}.points b{color:#f45d14}.cup{display:flex;flex-direction:column;align-items:center;justify-content:center;font-size:80rpx}.cup button{height:50rpx;padding:0 15rpx;border:1rpx solid #f15c13;border-radius:25rpx;color:#ef5a11;background:#fff;font-size:18rpx;line-height:48rpx}.announce{margin-top:18rpx;padding:20rpx;display:flex;justify-content:space-between;align-items:center}.announce view{display:flex;flex-direction:column;gap:8rpx}.announce b{font-size:25rpx}.announce text{font-size:20rpx}.announce>text b{color:#ef5a11;font-size:26rpx}.winners,.prize-setting,.claim,.history{margin-top:18rpx;padding:20rpx}.winners .section-title,.prize-setting .section-title{margin:0 0 12rpx}.winner{display:grid;grid-template-columns:42rpx 1.2fr 90rpx 1.4fr;align-items:center;gap:8rpx;padding:8rpx 10rpx;border-radius:18rpx;background:#fff5df;font-size:18rpx}.winner+.winner{margin-top:5rpx}.avatar{width:36rpx;height:36rpx;border-radius:50%;background:#e8ddca;text-align:center;line-height:36rpx}.winner b{padding:4rpx 7rpx;border-radius:14rpx;color:#fff;background:#3a90d4;text-align:center;font-size:16rpx}.winner b.一等奖{background:#f25d12}.winner b.三等奖{background:#65a52b}.winner b.参与奖{background:#f19a18}.prize-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:10rpx}.prize-grid>view{padding:10rpx 5rpx;display:flex;flex-direction:column;align-items:center;text-align:center;border:1rpx solid #edc78e;border-radius:18rpx}.prize-grid .level{padding:3rpx 12rpx;border-radius:15rpx;color:#fff;background:#f67816;font-size:17rpx}.prize-grid b{font-size:17rpx}.prize-grid small{color:#8b8078;font-size:15rpx}.claim{display:grid;grid-template-columns:1fr 170rpx;align-items:center;overflow:hidden}.claim>view{display:flex;flex-direction:column;gap:12rpx}.claim b{font-size:27rpx}.claim text{font-size:19rpx;line-height:1.6}.claim .primary-button{width:270rpx;height:62rpx;font-size:22rpx}.claim-pets{font-size:75rpx}.history{display:flex;justify-content:space-between;font-weight:700}.footer-help{display:block;padding:20rpx;text-align:center;color:#857b74;font-size:19rpx}
</style>

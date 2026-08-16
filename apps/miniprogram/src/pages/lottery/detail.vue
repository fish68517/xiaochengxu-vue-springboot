<script setup lang="ts">
import { computed, onBeforeUnmount, ref } from 'vue'
import { onLoad } from '@dcloudio/uni-app'
import AppHeader from '@/components/AppHeader.vue'
import AppTabBar from '@/components/AppTabBar.vue'
import PetArtwork from '@/components/PetArtwork.vue'
import { getActivity, joinActivity } from '@/api/lottery'
import { formatDate } from '@/utils/format'
import type { LotteryActivity } from '@/models'

const activity = ref<LotteryActivity | null>(null)
const loading = ref(true)
const joining = ref(false)
const error = ref('')
const now = ref(Date.now())
let timer: ReturnType<typeof setInterval> | undefined

onLoad(async (options) => {
  try {
    activity.value = await getActivity(Number(options?.id || 1))
    timer = setInterval(() => { now.value = Date.now() }, 1000)
  } catch (err) { error.value = err instanceof Error ? err.message : '活动加载失败' }
  finally { loading.value = false }
})
onBeforeUnmount(() => { if (timer) clearInterval(timer) })

const countdown = computed(() => {
  const diff = Math.max(0, new Date(activity.value?.draw_at || 0).getTime() - now.value)
  return { days: Math.floor(diff / 86400000), hours: Math.floor(diff / 3600000) % 24, minutes: Math.floor(diff / 60000) % 60, seconds: Math.floor(diff / 1000) % 60 }
})

async function join() {
  if (!activity.value || activity.value.joined || joining.value) return
  joining.value = true
  try {
    const result = await joinActivity(activity.value.id)
    activity.value.joined = true
    activity.value.participant_count = result.participant_count
    uni.showToast({ title: result.message, icon: 'success' })
  } catch (err) { uni.showToast({ title: err instanceof Error ? err.message : '报名失败', icon: 'none' }) }
  finally { joining.value = false }
}
const openHistory = () => uni.navigateTo({ url: '/pages/lottery/result?id=2' })
</script>

<template>
  <view class="app-shell lottery-page">
    <AppHeader title="抽奖活动" back />
    <view v-if="loading" class="loading-block">正在加载活动...</view>
    <view v-else-if="error || !activity" class="error-block">{{ error || '活动不存在' }}</view>
    <template v-else>
      <view class="lottery-hero"><view class="hero-pets">🐢 <text>🎁</text> 🐰</view><text class="hero-title">{{ activity.title }}</text><text class="hero-sub">{{ activity.subtitle }}</text></view>
      <view class="page-body lottery-body">
        <view class="status-card app-card"><text class="status">{{ activity.joined ? '已报名' : '报名中' }}</text><view><small>报名时间</small><text>{{ formatDate(activity.registration_start_at) }}</text><text>— {{ formatDate(activity.registration_end_at) }}</text></view><view><small>开奖时间</small><text>{{ formatDate(activity.draw_at) }}</text></view><view class="countdown"><small>距开奖还剩</small><view><b>{{ String(countdown.days).padStart(2,'0') }}</b>:<b>{{ String(countdown.hours).padStart(2,'0') }}</b>:<b>{{ String(countdown.minutes).padStart(2,'0') }}</b>:<b>{{ String(countdown.seconds).padStart(2,'0') }}</b></view><text>天　　时　　分　　秒</text></view></view>
        <view class="prizes app-card"><view class="section-title prize-title">✦ 奖品预览 ✦</view><view class="prize-grid"><view v-for="prize in activity.prizes" :key="prize.level"><text class="level">{{ prize.level }}</text><PetArtwork :type="prize.icon" size="sm" /><b>{{ prize.name }}</b><small>共 {{ prize.quantity }} 份</small></view></view></view>
        <view class="join-card app-card"><view class="participant"><text>已有 <b>{{ activity.participant_count }}</b> 人报名</text><text>查看参与人数 ›</text></view><view class="avatars"><text v-for="avatar in ['🐱','🐶','🐰','🐹','🐼','🦊','🐯','🐨','🐻']" :key="avatar">{{ avatar }}</text></view><button class="primary-button" :disabled="activity.joined || joining" @click="join">{{ joining ? '正在报名...' : activity.joined ? '✓ 已成功报名 · 等待开奖' : '立即报名参加' }}</button><small class="hint">🛡 报名成功后可在开奖后查看结果</small></view>
        <view class="rules app-card"><view class="section-title rule-title">🐾 活动规则 🐾</view><view v-for="(rule,index) in activity.rules" :key="rule" class="rule"><b>{{ index + 1 }}</b><text>{{ rule }}</text></view><view class="rule-pets">🐢 🐰</view></view>
        <view class="history app-card" @click="openHistory"><text>🏆　查看往期中奖名单</text><button>去查看 ›</button></view>
        <view class="customer app-card"><text>🎧　开奖后，中奖用户可联系管理员获取领奖方式</text><button>联系客服</button></view>
      </view>
    </template>
    <AppTabBar current="lottery" />
  </view>
</template>

<style scoped lang="scss">
.lottery-page{background:linear-gradient(#fff9f1,#fff1cf)}.lottery-hero{height:255rpx;display:flex;flex-direction:column;align-items:center;padding-top:22rpx;background:radial-gradient(circle at 50% 30%,#fffefa,#ffe2a9);position:relative;overflow:hidden}.hero-pets{position:absolute;bottom:0;left:20rpx;right:20rpx;display:flex;justify-content:space-between;align-items:flex-end;font-size:135rpx}.hero-pets text{font-size:80rpx}.hero-title,.hero-sub{position:relative;z-index:2}.hero-title{margin-top:10rpx;color:#ef5212;font-size:45rpx;font-weight:900;text-shadow:0 3rpx #fff}.hero-sub{margin-top:16rpx;padding:7rpx 30rpx;border-radius:22rpx;color:#fff;background:#f8812e;font-size:21rpx}.lottery-body{margin-top:-4rpx}.status-card{position:relative;padding:42rpx 18rpx 22rpx;display:grid;grid-template-columns:1fr 1fr 1.4fr;text-align:center;border-color:#ffbd69}.status{position:absolute;left:20rpx;top:-16rpx;padding:7rpx 25rpx;border-radius:18rpx;color:#fff;background:#ff6813;font-weight:800}.status-card>view{padding:5rpx 12rpx;display:flex;flex-direction:column;gap:8rpx;border-right:1rpx solid #efd7ba;font-size:19rpx}.status-card>view:last-child{border:0}.status-card small{font-size:20rpx}.countdown view{white-space:nowrap}.countdown b{display:inline-block;padding:5rpx;border-radius:7rpx;color:#fff;background:#f86512;font-size:24rpx}.countdown>text{font-size:16rpx}.prizes,.join-card,.rules,.history,.customer{margin-top:18rpx;padding:20rpx}.prize-title,.rule-title{justify-content:center;margin:0 0 16rpx}.prize-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:9rpx}.prize-grid>view{padding:10rpx 5rpx;display:flex;flex-direction:column;align-items:center;border:1rpx solid #f0c785;border-radius:18rpx;text-align:center}.prize-grid .level{padding:3rpx 13rpx;border-radius:14rpx;color:#fff;background:#ff7513;font-size:18rpx}.prize-grid b{margin-top:8rpx;font-size:18rpx}.prize-grid small{color:#8b8078;font-size:16rpx}.participant{display:flex;justify-content:space-between;font-size:21rpx}.participant b{color:#f45a11;font-size:32rpx}.avatars{display:flex;margin:18rpx 0;overflow:hidden}.avatars text{width:57rpx;height:57rpx;margin-right:-5rpx;border:3rpx solid #fff;border-radius:50%;background:#f2e8d8;text-align:center;font-size:37rpx;line-height:55rpx}.join-card .primary-button{width:100%;border:0}.join-card .primary-button[disabled]{background:#7cae60;box-shadow:none}.hint{display:block;margin-top:12rpx;text-align:center;color:#8c694e;font-size:18rpx}.rules{position:relative;overflow:hidden}.rule{display:grid;grid-template-columns:35rpx 1fr;gap:10rpx;margin:12rpx 0;font-size:20rpx}.rule b{width:28rpx;height:28rpx;border-radius:50%;color:#fff;background:#f29322;text-align:center;line-height:28rpx}.rule-pets{position:absolute;right:15rpx;bottom:8rpx;font-size:65rpx;opacity:.8}.history,.customer{display:flex;align-items:center;justify-content:space-between;font-size:21rpx;font-weight:700}.history button,.customer button{height:54rpx;padding:0 24rpx;border:1rpx solid #ff6a00;border-radius:28rpx;color:#ef5b00;background:#fff;font-size:20rpx;line-height:52rpx}.customer{margin-bottom:8rpx}.customer text{max-width:72%}.customer button{color:#268f3d;border-color:#59b866}
</style>

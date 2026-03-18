<template>
  <view class="page">
    <view class="card">
      <view class="title">预约下单</view>
      <view class="line">站点：{{ station.stationName || '-' }}</view>
      <view class="line">地址：{{ station.stationAddress || '-' }}</view>
      <view class="line">钱包余额：¥{{ userMoney.toFixed(2) }}</view>
    </view>

    <view class="card">
      <view class="block-title">车辆</view>
      <picker mode="selector" :range="carOptions" range-key="label" :value="carIndex" @change="onCarChange">
        <view class="picker-cell">{{ currentCarLabel }}</view>
      </picker>

      <view class="block-title">功率</view>
      <picker mode="selector" :range="powerOptions" range-key="label" :value="powerIndex" @change="onPowerChange">
        <view class="picker-cell">{{ currentPowerLabel }}</view>
      </picker>

      <view class="block-title">充电时长（小时）</view>
      <input class="input" type="digit" v-model="chargingTime" @input="onChargingTimeInput" />

      <view class="block-title">可用充电桩</view>
      <picker mode="selector" :range="stumpOptions" range-key="label" :value="stumpIndex" @change="onStumpChange">
        <view class="picker-cell">{{ currentStumpLabel }}</view>
      </picker>

      <view class="block-title">支付方式</view>
      <view class="pay-row">
        <view
          v-for="item in payTypes"
          :key="item.value"
          class="pay-item"
          :class="{ active: payWay === item.value }"
          @tap="payWay = item.value"
        >
          {{ item.label }}
        </view>
      </view>
    </view>

    <view class="card">
      <view class="sum-line">预计金额：<text class="price">¥{{ totalPrice.toFixed(2) }}</text></view>
      <view class="sum-line">下单用户：{{ userName }}</view>
      <view class="sum-line">下单时间：{{ previewCreateTime }}</view>
    </view>

    <button class="submit-btn" :disabled="submitting" @tap="submitOrder">
      {{ submitting ? '提交中...' : '确认预约并创建订单' }}
    </button>
  </view>
</template>

<script>
import { USER_KEY } from '../../common/config'
import { fetchCarInfoList } from '../../api/car'
import { createOrder, createOutlay, updateOrder } from '../../api/order'
import { fetchPowerList, fetchStationById, fetchStumpList, updateStump } from '../../api/station'
import { fetchUserById } from '../../api/user'
import { expense } from '../../api/wallet'

export default {
  data() {
    return {
      stationId: '',
      station: {},
      userInfo: {},
      carOptions: [],
      carIndex: 0,
      powerOptions: [],
      powerIndex: 0,
      stumpOptions: [],
      stumpIndex: 0,
      chargingTime: '1',
      payWay: 'wallet',
      submitting: false,
      payTypes: [
        { value: 'wallet', label: '电子钱包' },
        { value: 'wechat', label: '微信支付' },
        { value: 'alipay', label: '支付宝' },
        { value: 'unionpay', label: '银联支付' }
      ],
      payLabelMap: {
        wallet: '电子钱包',
        wechat: '微信支付',
        alipay: '支付宝',
        unionpay: '银联支付'
      }
    }
  },
  computed: {
    currentCarLabel() {
      if (!this.carOptions.length) return '无车辆（可继续下单）'
      return this.carOptions[this.carIndex]?.label || '请选择车辆'
    },
    currentPowerLabel() {
      if (!this.powerOptions.length) return '暂无功率配置'
      return this.powerOptions[this.powerIndex]?.label || '请选择功率'
    },
    currentStumpLabel() {
      if (!this.stumpOptions.length) return '该站点暂无可用充电桩'
      return this.stumpOptions[this.stumpIndex]?.label || '请选择充电桩'
    },
    totalPrice() {
      const p = this.powerOptions[this.powerIndex]
      const hours = Number(this.chargingTime || 0)
      if (!p || !Number.isFinite(hours) || hours <= 0) return 0
      return Number((p.price * hours).toFixed(2))
    },
    userName() {
      return this.userInfo.name || this.userInfo.userName || `用户#${this.userInfo.id || '-'}`
    },
    userMoney() {
      return Number(this.userInfo.money || 0)
    },
    previewCreateTime() {
      return this.formatDateTime(new Date())
    }
  },
  async onLoad(options) {
    const user = uni.getStorageSync(USER_KEY) || {}
    if (!user.id) {
      uni.showToast({ title: '请先登录', icon: 'none' })
      setTimeout(() => {
        uni.reLaunch({ url: '/pages/login/index' })
      }, 300)
      return
    }
    this.userInfo = user

    const stationId = options.stationId || (uni.getStorageSync('selectedStation') || {}).id
    if (!stationId) {
      uni.showToast({ title: '未选择充电站', icon: 'none' })
      setTimeout(() => {
        uni.navigateBack()
      }, 300)
      return
    }
    this.stationId = String(stationId)
    await this.loadData()
  },
  methods: {
    async loadData() {
      uni.showLoading({ title: '加载中...' })
      try {
        const [stationRes, powerRes, stumpRes, carRes, userRes] = await Promise.all([
          fetchStationById(this.stationId),
          fetchPowerList(),
          fetchStumpList(),
          fetchCarInfoList({ user_id: this.userInfo.id }),
          fetchUserById(this.userInfo.id)
        ])

        this.station = stationRes.data || {}
        if (userRes) {
          this.userInfo = { ...this.userInfo, ...userRes }
          uni.setStorageSync(USER_KEY, this.userInfo)
        }

        this.powerOptions = (powerRes.rows || []).map((item) => ({
          id: item.id,
          maxPower: Number(item.maxPower || 0),
          price: Number(item.price || 0),
          label: `${item.maxPower || 0} kW（¥${item.price || 0}/小时）`
        }))

        const rawStumps = stumpRes.rows || []
        this.stumpOptions = rawStumps
          .filter((s) => String(this.extractStationIdFromStump(s)) === String(this.stationId))
          .filter((s) => Number(s.occupy || 0) !== 1)
          .map((s) => ({
            id: Number(s.id),
            label: `${s.stumpName || '充电桩'}（空闲）`
          }))

        this.carOptions = (carRes.rows || []).map((car) => ({
          id: Number(car.id),
          label: `${car.licenceNumber || '未填车牌'} / 车辆ID:${car.id}`
        }))

        this.powerIndex = this.powerOptions.length ? 0 : -1
        this.stumpIndex = this.stumpOptions.length ? 0 : -1
        this.carIndex = this.carOptions.length ? 0 : -1
      } catch (error) {
        uni.showToast({ title: error.message || '加载失败', icon: 'none' })
      } finally {
        uni.hideLoading()
      }
    },
    extractStationIdFromStump(stump) {
      return stump.chargingStation_id || stump.chargingStationId || stump.chargingstationId || stump.chargingstationID
    },
    onCarChange(e) {
      this.carIndex = Number(e.detail.value || 0)
    },
    onPowerChange(e) {
      this.powerIndex = Number(e.detail.value || 0)
    },
    onStumpChange(e) {
      this.stumpIndex = Number(e.detail.value || 0)
    },
    onChargingTimeInput(e) {
      this.chargingTime = e.detail.value
    },
    formatDateTime(date) {
      const y = date.getFullYear()
      const m = String(date.getMonth() + 1).padStart(2, '0')
      const d = String(date.getDate()).padStart(2, '0')
      const hh = String(date.getHours()).padStart(2, '0')
      const mm = String(date.getMinutes()).padStart(2, '0')
      const ss = String(date.getSeconds()).padStart(2, '0')
      return `${y}-${m}-${d} ${hh}:${mm}:${ss}`
    },
    async rollbackCreatedOrder(orderId, stumpId, reason) {
      try {
        await updateOrder({ id: orderId, state: 2, cancelCause: reason || '系统自动取消' })
      } catch (e) {}
      try {
        await updateStump({ id: stumpId, occupy: 0 })
      } catch (e) {}
    },
    async submitOrder() {
      if (!this.stationId) {
        uni.showToast({ title: '缺少站点信息', icon: 'none' })
        return
      }
      if (!this.powerOptions.length || this.powerIndex < 0) {
        uni.showToast({ title: '暂无功率配置', icon: 'none' })
        return
      }
      if (!this.stumpOptions.length || this.stumpIndex < 0) {
        uni.showToast({ title: '暂无可用充电桩', icon: 'none' })
        return
      }
      const hours = Number(this.chargingTime || 0)
      if (!Number.isFinite(hours) || hours <= 0) {
        uni.showToast({ title: '充电时长需大于0', icon: 'none' })
        return
      }

      const selectedPower = this.powerOptions[this.powerIndex]
      const selectedStump = this.stumpOptions[this.stumpIndex]
      const selectedCar = this.carOptions[this.carIndex]
      const nowText = this.formatDateTime(new Date())

      if (this.payWay === 'wallet' && this.userMoney < this.totalPrice) {
        uni.showToast({ title: '钱包余额不足，请更换支付方式', icon: 'none' })
        return
      }

      const payload = {
        carInfoID: selectedCar ? selectedCar.id : null,
        maxPower: selectedPower.maxPower,
        createTime: nowText,
        chargingTime: hours,
        orderPrice: this.totalPrice,
        userID: Number(this.userInfo.id),
        payWay: this.payLabelMap[this.payWay],
        chargingStationID: Number(this.stationId),
        stumpID: Number(selectedStump.id),
        state: 0
      }

      this.submitting = true
      uni.showLoading({ title: '提交中...' })
      let createdOrderId = null
      try {
        const res = await createOrder(payload)
        const createdOrder = res.data || {}
        createdOrderId = createdOrder.id

        await updateStump({
          id: Number(selectedStump.id),
          occupy: 1
        })

        if (this.payWay === 'wallet') {
          const expRes = await expense({
            userId: Number(this.userInfo.id),
            payAmount: this.totalPrice,
            orderPrice: this.totalPrice
          })

          await createOutlay({
            user_id: Number(this.userInfo.id),
            chargingStation_id: Number(this.stationId),
            stump_id: Number(selectedStump.id),
            payAmount: this.totalPrice,
            payTime: nowText,
            payWay: this.payLabelMap[this.payWay]
          })

          const newMoney = Number(expRes?.data?.money)
          if (Number.isFinite(newMoney)) {
            this.userInfo = { ...this.userInfo, money: newMoney }
            uni.setStorageSync(USER_KEY, this.userInfo)
          }
        }

        uni.navigateTo({
          url: `/pages/order-confirm/index?orderId=${createdOrderId || ''}`
        })
      } catch (error) {
        if (createdOrderId && selectedStump?.id) {
          await this.rollbackCreatedOrder(createdOrderId, Number(selectedStump.id), '钱包扣费失败自动取消')
        }
        uni.showToast({ title: error.message || '下单失败', icon: 'none' })
      } finally {
        this.submitting = false
        uni.hideLoading()
      }
    }
  }
}
</script>

<style scoped>
.page {
  min-height: 100vh;
  padding: 18rpx;
  box-sizing: border-box;
}

.card {
  background: #ffffff;
  border-radius: 12rpx;
  padding: 20rpx;
  margin-bottom: 14rpx;
}

.title {
  font-size: 34rpx;
  font-weight: 700;
  color: #111827;
  margin-bottom: 8rpx;
}

.line {
  font-size: 24rpx;
  color: #4b5563;
  margin-top: 6rpx;
}

.block-title {
  margin-top: 12rpx;
  margin-bottom: 8rpx;
  font-size: 25rpx;
  color: #111827;
  font-weight: 600;
}

.picker-cell {
  height: 76rpx;
  line-height: 76rpx;
  border: 1rpx solid #e5e7eb;
  border-radius: 10rpx;
  padding: 0 16rpx;
  font-size: 24rpx;
  color: #374151;
}

.input {
  height: 76rpx;
  border: 1rpx solid #e5e7eb;
  border-radius: 10rpx;
  padding: 0 16rpx;
  font-size: 24rpx;
}

.pay-row {
  display: flex;
  gap: 10rpx;
  flex-wrap: wrap;
}

.pay-item {
  padding: 10rpx 18rpx;
  border-radius: 999rpx;
  border: 1rpx solid #d1d5db;
  font-size: 22rpx;
  color: #4b5563;
}

.pay-item.active {
  border-color: #16a34a;
  color: #16a34a;
  background: #ecfdf3;
}

.sum-line {
  margin-top: 8rpx;
  font-size: 24rpx;
  color: #4b5563;
}

.price {
  color: #dc2626;
  font-size: 30rpx;
  font-weight: 700;
}

.submit-btn {
  height: 84rpx;
  line-height: 84rpx;
  border-radius: 12rpx;
  border: none;
  background: #16a34a;
  color: #ffffff;
  font-size: 28rpx;
}

.submit-btn::after {
  border: none;
}

.submit-btn[disabled] {
  opacity: 0.7;
}
</style>

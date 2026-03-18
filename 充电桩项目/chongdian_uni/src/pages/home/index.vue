<template>
  <view class="page">
    <view class="top-bar">
      <input class="search-input" placeholder="搜索充电站名称" v-model="searchKeyword" @input="applySearch" />
      <button class="small-btn" @tap="refreshData">刷新</button>
      <button class="small-btn" @tap="logout">退出</button>
    </view>

    <map
      id="mainMap"
      class="map"
      :longitude="longitude"
      :latitude="latitude"
      :scale="scale"
      :markers="markers"
      :show-location="true"
      @updated="onMapUpdated"
      @regionchange="onMapRegionChange"
      @markertap="onMarkerTap"
    />

    <view class="location-bar">
      <text class="location-title">当前位置：</text>
      <text class="location-content">{{ locationAddress || "未定位" }}</text>
    </view>

    <view class="ops">
      <button class="op-btn" :disabled="locating" @tap="moveToCurrentLocation">
        {{ locating ? "定位中..." : "定位" }}
      </button>
      <button class="op-btn recommend" @tap="recommendStation">一键推荐</button>
      <button class="op-btn plain" @tap="goOrderList">我的订单</button>
    </view>

    <view v-if="selectedStation" class="station-card">
      <view class="name">{{ selectedStation.stationName || "未命名站点" }}</view>
      <view class="line">地址：{{ selectedStation.stationAddress || "-" }}</view>
      <view class="line">
        评分：{{ formatGrade(selectedStation.id) }}
        <text class="split">|</text>
        桩数：{{ selectedStation.stumpNum || 0 }}
      </view>
      <view class="line">策略：优先近距离 + 高评分</view>

      <view class="station-actions">
        <button class="station-btn primary" @tap="goCreateOrder">去预约</button>
        <button class="station-btn" @tap="goOrderList">查看我的订单</button>
      </view>
    </view>

    <scroll-view class="list" scroll-y>
      <view v-for="item in filteredStations" :key="item.id" class="item" @tap="selectStation(item)">
        <view class="item-title">{{ item.stationName || "未命名站点" }}</view>
        <view class="item-sub">{{ item.stationAddress || "-" }}</view>
      </view>
      <view v-if="!filteredStations.length" class="empty">暂无匹配站点</view>
    </scroll-view>

    <view class="debug-panel" v-if="false">
      <view class="debug-header">
        <text class="debug-title">调试日志</text>
        <view class="debug-actions">
          <button class="debug-btn" @tap="copyDebugLogs">复制</button>
          <button class="debug-btn" @tap="clearDebugLogs">清空</button>
        </view>
      </view>
      <scroll-view class="debug-list" scroll-y>
        <view v-for="line in debugLogs" :key="line.id" class="debug-line">{{ line.text }}</view>
        <view v-if="!debugLogs.length" class="debug-empty">暂无日志</view>
      </scroll-view>
    </view>
  </view>
</template>

<script>
import { AMAP_JS_KEY, AMAP_WEB_SERVICE_KEY, TOKEN_KEY, USER_KEY } from "../../common/config"
import { amapIpLocate, amapReverseGeocode } from "../../api/amap"
import { fetchStationGrades, fetchStations } from "../../api/station"

function isPermissionDenied(message) {
  if (!message) return false
  const text = String(message).toLowerCase()
  return (
    text.includes("auth deny") ||
    text.includes("auth denied") ||
    text.includes("permission") ||
    text.includes("denied") ||
    text.includes("authorize")
  )
}

export default {
  data() {
    return {
      latitude: 23.099994,
      longitude: 113.32452,
      scale: 13,
      stations: [],
      filteredStations: [],
      markers: [],
      gradeStats: {},
      searchKeyword: "",
      selectedStation: null,
      mapCtx: null,
      locating: false,
      locationAddress: "",
      debugLogs: [],
      debugSeq: 1
    }
  },
  onLoad() {
    const token = uni.getStorageSync(TOKEN_KEY)
    this.logDebug("onLoad", {
      hasToken: !!token,
      platform: process.env.UNI_PLATFORM || "unknown",
      amapJsKeyConfigured: !!AMAP_JS_KEY,
      amapWebServiceKeyConfigured: !!AMAP_WEB_SERVICE_KEY
    })
    if (!token) {
      uni.reLaunch({ url: "/pages/login/index" })
      return
    }
    this.initMap()
    this.refreshData()
    this.locateOnLoad()
  },
  onReady() {
    const hasWindow = typeof window !== "undefined"
    const hasAmapJs = hasWindow && !!window.AMap
    this.logDebug("onReady", { hasWindow, hasAmapJs })
    this.registerH5ErrorHooks()
    setTimeout(() => {
      this.logDebug("onReady+1500ms", {
        hasAmapJs: typeof window !== "undefined" && !!window.AMap
      })
    }, 1500)
  },
  methods: {
    stringifyAny(payload) {
      if (payload == null) return ""
      if (typeof payload === "string") return payload
      if (payload instanceof Error) return `${payload.name}:${payload.message}`
      try {
        return JSON.stringify(payload)
      } catch (e) {
        return String(payload)
      }
    },
    logDebug(tag, payload) {
      const time = new Date()
      const hh = String(time.getHours()).padStart(2, "0")
      const mm = String(time.getMinutes()).padStart(2, "0")
      const ss = String(time.getSeconds()).padStart(2, "0")
      const line = `[${hh}:${mm}:${ss}] [${tag}] ${this.stringifyAny(payload || {})}`
      this.debugLogs.push({ id: this.debugSeq++, text: line })
      if (this.debugLogs.length > 120) {
        this.debugLogs.splice(0, this.debugLogs.length - 120)
      }
      console.log(line)
    },
    clearDebugLogs() {
      this.debugLogs = []
      this.debugSeq = 1
      this.logDebug("debug", "logs cleared")
    },
    copyDebugLogs() {
      const content = this.debugLogs.map((d) => d.text).join("\n")
      uni.setClipboardData({
        data: content || "no logs",
        success: () => {
          uni.showToast({ title: "日志已复制", icon: "none" })
        }
      })
    },
    registerH5ErrorHooks() {
      if (typeof window === "undefined") return
      if (window.__homeDebugHookInstalled) return
      window.__homeDebugHookInstalled = true
      window.addEventListener("error", (event) => {
        this.logDebug("h5.onerror", {
          message: event?.message || "",
          filename: event?.filename || "",
          lineno: event?.lineno || 0
        })
      })
      window.addEventListener("unhandledrejection", (event) => {
        const reasonText = this.stringifyAny(event?.reason)
        if (reasonText.includes("startCompass:fail")) {
          this.logDebug("h5.compass.unsupported", reasonText)
          return
        }
        this.logDebug("h5.unhandledrejection", {
          reasonType: typeof event?.reason,
          reason: reasonText
        })
      })
    },
    initMap() {
      this.mapCtx = uni.createMapContext("mainMap", this)
      this.logDebug("map.init", { ok: !!this.mapCtx })
    },
    onMapUpdated() {
      this.logDebug("map.updated", {
        longitude: this.longitude,
        latitude: this.latitude,
        markerCount: this.markers.length
      })
    },
    onMapRegionChange(e) {
      this.logDebug("map.regionchange", {
        type: e?.type || "",
        causedBy: e?.causedBy || ""
      })
    },
    async locateOnLoad() {
      this.logDebug("locate.onLoad", "start")
      await this.locate({ silent: true, allowIpFallback: true })
    },
    getDeviceLocation() {
      return new Promise((resolve, reject) => {
        uni.getLocation({
          type: "gcj02",
          success: resolve,
          fail: reject
        })
      })
    },
    applyLocation(latitude, longitude) {
      this.latitude = Number(latitude)
      this.longitude = Number(longitude)
      this.scale = 15
      this.logDebug("locate.apply", {
        latitude: this.latitude,
        longitude: this.longitude
      })
      if (this.mapCtx) {
        this.mapCtx.moveToLocation({
          latitude: this.latitude,
          longitude: this.longitude
        })
      }
    },
    async updateAddressByAmap(longitude, latitude) {
      if (!AMAP_WEB_SERVICE_KEY) {
        this.locationAddress = `经纬度 ${Number(latitude).toFixed(6)}, ${Number(longitude).toFixed(6)}`
        this.logDebug("amap.regeo.skip", "AMAP_WEB_SERVICE_KEY missing, use coords")
        return
      }
      try {
        const regeo = await amapReverseGeocode(longitude, latitude)
        if (regeo.formattedAddress) {
          this.locationAddress = regeo.formattedAddress
        }
        this.logDebug("amap.regeo.ok", {
          longitude,
          latitude,
          address: this.locationAddress
        })
      } catch (e) {
        this.logDebug("amap.regeo.fail", e?.message || String(e))
      }
    },
    async locateByAmapIp(options = {}) {
      const { silent = false } = options
      if (!AMAP_WEB_SERVICE_KEY) {
        this.logDebug("amap.ip.skip", "AMAP_WEB_SERVICE_KEY missing")
        if (!silent) {
          uni.showToast({ title: "未配置Web服务Key，无法IP定位", icon: "none" })
        }
        return false
      }
      try {
        const ipInfo = await amapIpLocate()
        this.logDebug("amap.ip.ok", ipInfo)
        this.applyLocation(ipInfo.latitude, ipInfo.longitude)
        this.locationAddress = [ipInfo.province, ipInfo.city].filter(Boolean).join(" ")
        await this.updateAddressByAmap(ipInfo.longitude, ipInfo.latitude)
        if (!silent) {
          uni.showToast({ title: "已切换为 IP 定位", icon: "none" })
        }
        return true
      } catch (error) {
        this.logDebug("amap.ip.fail", error?.message || String(error))
        if (!silent) {
          uni.showToast({ title: error.message || "高德 IP 定位失败", icon: "none" })
        }
        return false
      }
    },
    async showLocationPermissionGuide() {
      this.logDebug("locate.permission", "show guide")
      return new Promise((resolve) => {
        uni.showModal({
          title: "需要定位授权",
          content:
            "当前未授权定位。\n\n授权步骤：\n1. 点击“去设置”\n2. 打开“位置信息”权限\n3. 返回后重新点击定位",
          confirmText: "去设置",
          cancelText: "IP定位",
          success: async (res) => {
            this.logDebug("locate.permission.choice", {
              confirm: !!res.confirm,
              cancel: !!res.cancel
            })
            if (res.confirm) {
              await this.openSettingAndRetry()
            } else {
              await this.locateByAmapIp({ silent: false })
            }
            resolve()
          },
          fail: (err) => {
            this.logDebug("locate.permission.modal.fail", err?.errMsg || String(err))
            resolve()
          }
        })
      })
    },
    async openSettingAndRetry() {
      if (typeof uni.openSetting !== "function") {
        this.logDebug("locate.openSetting.skip", "not supported on current platform")
        if (!AMAP_WEB_SERVICE_KEY) {
          uni.showToast({ title: "当前环境不支持设置页，请在浏览器开启定位权限", icon: "none" })
        } else {
          uni.showToast({ title: "当前平台不支持打开设置，尝试 IP 定位", icon: "none" })
          await this.locateByAmapIp({ silent: false })
        }
        return
      }
      return new Promise((resolve) => {
        uni.openSetting({
          success: async (settingRes) => {
            const granted =
              settingRes &&
              settingRes.authSetting &&
              (settingRes.authSetting["scope.userLocation"] || settingRes.authSetting.scopeUserLocation)
            this.logDebug("locate.openSetting.result", { granted: !!granted })
            if (granted) {
              await this.locate({ silent: false, allowIpFallback: true })
            } else {
              uni.showToast({ title: "你还未开启定位权限", icon: "none" })
            }
            resolve()
          },
          fail: (err) => {
            this.logDebug("locate.openSetting.fail", err?.errMsg || String(err))
            uni.showToast({ title: "打开设置失败", icon: "none" })
            resolve()
          }
        })
      })
    },
    async locate(options = {}) {
      const { silent = false, allowIpFallback = true } = options
      this.locating = true
      this.logDebug("locate.start", { silent, allowIpFallback })
      try {
        const res = await this.getDeviceLocation()
        this.logDebug("locate.device.ok", {
          latitude: res.latitude,
          longitude: res.longitude
        })
        this.applyLocation(res.latitude, res.longitude)
        await this.updateAddressByAmap(res.longitude, res.latitude)
      } catch (error) {
        const errMsg = error?.errMsg || error?.message || String(error)
        const denied = isPermissionDenied(errMsg)
        this.logDebug("locate.device.fail", { errMsg, denied })
        if (denied && !silent) {
          await this.showLocationPermissionGuide()
          return
        }
        if (allowIpFallback) {
          const ok = await this.locateByAmapIp({ silent })
          if (!ok && !silent) {
            if (!AMAP_WEB_SERVICE_KEY) {
              uni.showToast({ title: "请开启定位权限（未配置Web服务Key，不能IP回退）", icon: "none" })
            } else {
              uni.showToast({ title: "定位失败，请确认授权", icon: "none" })
            }
          }
        } else if (!silent) {
          uni.showToast({ title: "定位失败，请确认授权", icon: "none" })
        }
      } finally {
        this.locating = false
      }
    },
    moveToCurrentLocation() {
      this.locate({ silent: false, allowIpFallback: true })
    },
    async refreshData() {
      uni.showLoading({ title: "加载中..." })
      try {
        const [stationRes, gradeRes] = await Promise.all([fetchStations(), fetchStationGrades()])
        const stations = stationRes.rows || []
        const grades = gradeRes.rows || []
        this.gradeStats = this.buildGradeStats(grades)
        this.stations = stations
        this.filteredStations = stations
        this.markers = stations
          .filter((s) => this.hasCoordinate(s))
          .map((s) => ({
            id: Number(s.id),
            latitude: Number(this.pickLatitude(s)),
            longitude: Number(this.pickLongitude(s)),
            title: s.stationName || "充电站",
            iconPath: "/static/marker.png",
            width: 28,
            height: 34
          }))
        this.logDebug("station.refresh.ok", {
          stationCount: stations.length,
          markerCount: this.markers.length
        })
      } catch (error) {
        this.logDebug("station.refresh.fail", error?.message || String(error))
        uni.showToast({ title: error.message || "加载失败", icon: "none" })
      } finally {
        uni.hideLoading()
      }
    },
    buildGradeStats(rows) {
      const bucket = {}
      rows.forEach((row) => {
        const key = String(
          row.chargingstationId || row.chargingStationId || row.chargingStation_id || row.chargingstationID || ""
        )
        if (!key) return
        if (!bucket[key]) {
          bucket[key] = { total: 0, count: 0 }
        }
        bucket[key].total += Number(row.grade || 0)
        bucket[key].count += 1
      })
      return bucket
    },
    formatGrade(stationId) {
      const stat = this.gradeStats[String(stationId)]
      if (!stat || !stat.count) return "暂无评分"
      return (stat.total / stat.count).toFixed(1)
    },
    applySearch() {
      const key = (this.searchKeyword || "").trim()
      if (!key) {
        this.filteredStations = this.stations
        return
      }
      this.filteredStations = this.stations.filter((s) => (s.stationName || "").includes(key))
    },
    onMarkerTap(e) {
      const markerId = Number(e?.detail?.markerId)
      this.logDebug("map.markertap", { markerId })
      const station = this.stations.find((s) => Number(s.id) === markerId)
      if (!station) return
      this.selectStation(station)
    },
    selectStation(station) {
      this.selectedStation = station
      uni.setStorageSync("selectedStation", station)
      const lat = Number(this.pickLatitude(station))
      const lng = Number(this.pickLongitude(station))
      this.logDebug("station.select", {
        id: station.id,
        stationName: station.stationName || "",
        lat,
        lng
      })
      if (Number.isFinite(lat) && Number.isFinite(lng)) {
        this.latitude = lat
        this.longitude = lng
        this.scale = 15
      }
    },
    recommendStation() {
      if (!this.stations.length) {
        uni.showToast({ title: "暂无可推荐站点", icon: "none" })
        return
      }
      const userLat = this.latitude
      const userLng = this.longitude
      const candidates = this.stations
        .filter((s) => this.hasCoordinate(s))
        .map((s) => {
          const lat = Number(this.pickLatitude(s))
          const lng = Number(this.pickLongitude(s))
          const distanceKm = this.distanceKm(userLat, userLng, lat, lng)
          const stat = this.gradeStats[String(s.id)]
          const avgGrade = stat && stat.count ? stat.total / stat.count : 0
          const score = avgGrade * 0.7 - distanceKm * 0.3
          return { station: s, score, distanceKm, avgGrade }
        })
      if (!candidates.length) {
        uni.showToast({ title: "站点坐标不完整，无法推荐", icon: "none" })
        return
      }
      candidates.sort((a, b) => b.score - a.score)
      const best = candidates[0]
      this.logDebug("station.recommend", {
        id: best.station.id,
        name: best.station.stationName || "",
        distanceKm: Number(best.distanceKm.toFixed(2)),
        avgGrade: Number(best.avgGrade.toFixed(1))
      })
      this.selectStation(best.station)
      uni.showModal({
        title: "推荐结果",
        content: `推荐：${best.station.stationName || "未命名站点"}\n距离约 ${best.distanceKm.toFixed(
          2
        )} km\n评分 ${best.avgGrade.toFixed(1)}`,
        showCancel: false
      })
    },
    distanceKm(lat1, lng1, lat2, lng2) {
      const toRad = (d) => (d * Math.PI) / 180
      const R = 6371
      const dLat = toRad(lat2 - lat1)
      const dLng = toRad(lng2 - lng1)
      const a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) * Math.sin(dLng / 2)
      const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
      return R * c
    },
    hasCoordinate(station) {
      const lat = Number(this.pickLatitude(station))
      const lng = Number(this.pickLongitude(station))
      return Number.isFinite(lat) && Number.isFinite(lng)
    },
    pickLatitude(station) {
      return station.latitude || station.stationLatitude || station.lat || 0
    },
    pickLongitude(station) {
      return station.longitude || station.stationLongitude || station.lng || 0
    },
    goCreateOrder() {
      if (!this.selectedStation || !this.selectedStation.id) {
        uni.showToast({ title: "请先选择充电站", icon: "none" })
        return
      }
      uni.navigateTo({
        url: `/pages/order-create/index?stationId=${this.selectedStation.id}`
      })
    },
    goOrderList() {
      uni.navigateTo({
        url: "/pages/order-list/index"
      })
    },
    logout() {
      uni.removeStorageSync(TOKEN_KEY)
      uni.removeStorageSync(USER_KEY)
      uni.reLaunch({ url: "/pages/login/index" })
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

.top-bar {
  display: flex;
  gap: 12rpx;
  margin-bottom: 14rpx;
}

.search-input {
  flex: 1;
  height: 74rpx;
  background: #ffffff;
  border: 1rpx solid #e5e7eb;
  border-radius: 10rpx;
  padding: 0 18rpx;
  box-sizing: border-box;
  font-size: 26rpx;
}

.small-btn {
  height: 74rpx;
  line-height: 74rpx;
  font-size: 24rpx;
  background: #ecfdf3;
  color: #15803d;
  border: none;
  border-radius: 10rpx;
  padding: 0 20rpx;
}

.small-btn::after {
  border: none;
}

.map {
  width: 100%;
  height: 520rpx;
  border-radius: 14rpx;
  overflow: hidden;
}

.location-bar {
  margin-top: 10rpx;
  background: #ffffff;
  border: 1rpx solid #e5e7eb;
  border-radius: 10rpx;
  padding: 10rpx 12rpx;
}

.location-title {
  color: #374151;
  font-size: 23rpx;
  font-weight: 600;
}

.location-content {
  color: #4b5563;
  font-size: 23rpx;
}

.ops {
  margin-top: 12rpx;
  display: flex;
  gap: 12rpx;
}

.op-btn {
  flex: 1;
  height: 78rpx;
  line-height: 78rpx;
  background: #ffffff;
  color: #111827;
  border-radius: 10rpx;
  border: 1rpx solid #e5e7eb;
  font-size: 26rpx;
}

.op-btn.recommend {
  background: #16a34a;
  color: #ffffff;
  border-color: #16a34a;
}

.op-btn.plain {
  background: #f3f4f6;
}

.op-btn::after {
  border: none;
}

.station-card {
  margin-top: 12rpx;
  background: #ffffff;
  border-radius: 12rpx;
  padding: 18rpx;
  box-shadow: 0 8rpx 24rpx rgba(15, 23, 42, 0.06);
}

.name {
  font-size: 30rpx;
  font-weight: 700;
}

.line {
  margin-top: 10rpx;
  color: #4b5563;
  font-size: 24rpx;
}

.split {
  margin: 0 10rpx;
}

.station-actions {
  margin-top: 14rpx;
  display: flex;
  gap: 12rpx;
}

.station-btn {
  flex: 1;
  height: 76rpx;
  line-height: 76rpx;
  border-radius: 10rpx;
  border: 1rpx solid #d1d5db;
  font-size: 24rpx;
  background: #ffffff;
  color: #374151;
}

.station-btn.primary {
  background: #16a34a;
  color: #ffffff;
  border-color: #16a34a;
}

.station-btn::after {
  border: none;
}

.list {
  margin-top: 12rpx;
  height: 320rpx;
}

.item {
  background: #ffffff;
  border-radius: 10rpx;
  padding: 14rpx;
  margin-bottom: 10rpx;
}

.item-title {
  font-size: 28rpx;
  color: #111827;
  font-weight: 600;
}

.item-sub {
  margin-top: 8rpx;
  font-size: 24rpx;
  color: #6b7280;
}

.empty {
  text-align: center;
  color: #9ca3af;
  font-size: 24rpx;
  margin-top: 24rpx;
}

.debug-panel {
  margin-top: 12rpx;
  background: #0f172a;
  border-radius: 12rpx;
  padding: 12rpx;
}

.debug-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.debug-title {
  color: #e2e8f0;
  font-size: 24rpx;
  font-weight: 600;
}

.debug-actions {
  display: flex;
  gap: 8rpx;
}

.debug-btn {
  height: 52rpx;
  line-height: 52rpx;
  padding: 0 14rpx;
  border-radius: 8rpx;
  border: 1rpx solid #334155;
  background: #1e293b;
  color: #e2e8f0;
  font-size: 22rpx;
}

.debug-btn::after {
  border: none;
}

.debug-list {
  margin-top: 8rpx;
  height: 220rpx;
}

.debug-line {
  color: #cbd5e1;
  font-size: 20rpx;
  line-height: 1.5;
  margin-bottom: 6rpx;
  word-break: break-all;
}

.debug-empty {
  color: #94a3b8;
  font-size: 22rpx;
}
</style>

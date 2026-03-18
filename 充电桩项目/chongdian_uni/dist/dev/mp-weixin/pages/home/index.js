"use strict";
const common_vendor = require("../../common/vendor.js");
const common_config = require("../../common/config.js");
const api_station = require("../../api/station.js");
const _sfc_main = {
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
      mapCtx: null
    };
  },
  onLoad() {
    const token = common_vendor.index.getStorageSync(common_config.TOKEN_KEY);
    if (!token) {
      common_vendor.index.reLaunch({ url: "/pages/login/index" });
      return;
    }
    this.initMap();
    this.refreshData();
  },
  methods: {
    initMap() {
      this.mapCtx = common_vendor.index.createMapContext("mainMap", this);
      common_vendor.index.getLocation({
        type: "gcj02",
        success: (res) => {
          this.latitude = res.latitude;
          this.longitude = res.longitude;
        }
      });
    },
    async refreshData() {
      common_vendor.index.showLoading({ title: "加载中..." });
      try {
        const [stationRes, gradeRes] = await Promise.all([
          api_station.fetchStations(),
          api_station.fetchStationGrades()
        ]);
        const stations = stationRes.rows || [];
        const grades = gradeRes.rows || [];
        this.gradeStats = this.buildGradeStats(grades);
        this.stations = stations;
        this.filteredStations = stations;
        this.markers = stations.filter((s) => this.hasCoordinate(s)).map((s) => ({
          id: Number(s.id),
          latitude: Number(this.pickLatitude(s)),
          longitude: Number(this.pickLongitude(s)),
          title: s.stationName || "充电站",
          iconPath: "/static/marker.png",
          width: 28,
          height: 34
        }));
      } catch (error) {
        common_vendor.index.showToast({ title: error.message || "加载失败", icon: "none" });
      } finally {
        common_vendor.index.hideLoading();
      }
    },
    buildGradeStats(rows) {
      const bucket = {};
      rows.forEach((row) => {
        const key = String(
          row.chargingstationId || row.chargingStationId || row.chargingStation_id || row.chargingstationID || ""
        );
        if (!key)
          return;
        if (!bucket[key]) {
          bucket[key] = { total: 0, count: 0 };
        }
        bucket[key].total += Number(row.grade || 0);
        bucket[key].count += 1;
      });
      return bucket;
    },
    formatGrade(stationId) {
      const stat = this.gradeStats[String(stationId)];
      if (!stat || !stat.count)
        return "暂无评分";
      return (stat.total / stat.count).toFixed(1);
    },
    applySearch() {
      const key = (this.searchKeyword || "").trim();
      if (!key) {
        this.filteredStations = this.stations;
        return;
      }
      this.filteredStations = this.stations.filter((s) => (s.stationName || "").includes(key));
    },
    onMarkerTap(e) {
      const markerId = Number(e.detail.markerId);
      const station = this.stations.find((s) => Number(s.id) === markerId);
      if (!station)
        return;
      this.selectStation(station);
    },
    selectStation(station) {
      this.selectedStation = station;
      const lat = Number(this.pickLatitude(station));
      const lng = Number(this.pickLongitude(station));
      if (Number.isFinite(lat) && Number.isFinite(lng)) {
        this.latitude = lat;
        this.longitude = lng;
        this.scale = 15;
      }
    },
    moveToCurrentLocation() {
      common_vendor.index.getLocation({
        type: "gcj02",
        success: (res) => {
          this.latitude = res.latitude;
          this.longitude = res.longitude;
          this.scale = 15;
          if (this.mapCtx) {
            this.mapCtx.moveToLocation();
          }
        },
        fail: () => {
          common_vendor.index.showToast({ title: "定位失败，请确认授权", icon: "none" });
        }
      });
    },
    recommendStation() {
      if (!this.stations.length) {
        common_vendor.index.showToast({ title: "暂无可推荐站点", icon: "none" });
        return;
      }
      const userLat = this.latitude;
      const userLng = this.longitude;
      const candidates = this.stations.filter((s) => this.hasCoordinate(s)).map((s) => {
        const lat = Number(this.pickLatitude(s));
        const lng = Number(this.pickLongitude(s));
        const distanceKm = this.distanceKm(userLat, userLng, lat, lng);
        const stat = this.gradeStats[String(s.id)];
        const avgGrade = stat && stat.count ? stat.total / stat.count : 0;
        const score = avgGrade * 0.7 - distanceKm * 0.3;
        return { station: s, score, distanceKm, avgGrade };
      });
      if (!candidates.length) {
        common_vendor.index.showToast({ title: "站点坐标不完整，无法推荐", icon: "none" });
        return;
      }
      candidates.sort((a, b) => b.score - a.score);
      const best = candidates[0];
      this.selectStation(best.station);
      common_vendor.index.showModal({
        title: "推荐结果",
        content: `推荐：${best.station.stationName || "未命名站点"}
距离约 ${best.distanceKm.toFixed(2)} km
评分 ${best.avgGrade.toFixed(1)}`,
        showCancel: false
      });
    },
    distanceKm(lat1, lng1, lat2, lng2) {
      const toRad = (d) => d * Math.PI / 180;
      const R = 6371;
      const dLat = toRad(lat2 - lat1);
      const dLng = toRad(lng2 - lng1);
      const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) * Math.sin(dLng / 2);
      const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
      return R * c;
    },
    hasCoordinate(station) {
      const lat = Number(this.pickLatitude(station));
      const lng = Number(this.pickLongitude(station));
      return Number.isFinite(lat) && Number.isFinite(lng);
    },
    pickLatitude(station) {
      return station.latitude || station.stationLatitude || station.lat || 0;
    },
    pickLongitude(station) {
      return station.longitude || station.stationLongitude || station.lng || 0;
    },
    logout() {
      common_vendor.index.removeStorageSync(common_config.TOKEN_KEY);
      common_vendor.index.removeStorageSync(common_config.USER_KEY);
      common_vendor.index.reLaunch({ url: "/pages/login/index" });
    }
  }
};
function _sfc_render(_ctx, _cache, $props, $setup, $data, $options) {
  return common_vendor.e({
    a: common_vendor.o([($event) => $data.searchKeyword = $event.detail.value, (...args) => $options.applySearch && $options.applySearch(...args)], "78"),
    b: $data.searchKeyword,
    c: common_vendor.o((...args) => $options.refreshData && $options.refreshData(...args), "8b"),
    d: common_vendor.o((...args) => $options.logout && $options.logout(...args), "4c"),
    e: $data.longitude,
    f: $data.latitude,
    g: $data.scale,
    h: $data.markers,
    i: common_vendor.o((...args) => $options.onMarkerTap && $options.onMarkerTap(...args), "25"),
    j: common_vendor.o((...args) => $options.moveToCurrentLocation && $options.moveToCurrentLocation(...args), "99"),
    k: common_vendor.o((...args) => $options.recommendStation && $options.recommendStation(...args), "c3"),
    l: $data.selectedStation
  }, $data.selectedStation ? {
    m: common_vendor.t($data.selectedStation.stationName || "未命名站点"),
    n: common_vendor.t($data.selectedStation.stationAddress || "-"),
    o: common_vendor.t($options.formatGrade($data.selectedStation.id)),
    p: common_vendor.t($data.selectedStation.stumpNum || 0)
  } : {}, {
    q: common_vendor.f($data.filteredStations, (item, k0, i0) => {
      return {
        a: common_vendor.t(item.stationName || "未命名站点"),
        b: common_vendor.t(item.stationAddress || "-"),
        c: item.id,
        d: common_vendor.o(($event) => $options.selectStation(item), item.id)
      };
    }),
    r: !$data.filteredStations.length
  }, !$data.filteredStations.length ? {} : {});
}
const MiniProgramPage = /* @__PURE__ */ common_vendor._export_sfc(_sfc_main, [["render", _sfc_render], ["__scopeId", "data-v-2c5296db"]]);
wx.createPage(MiniProgramPage);

import request from '../../utils/request.js';
Page({
  data: {
    showDropdown: false,
    latitude: 23.099994,
    longitude: 113.324520,
    scale: 14,
    markers: [],
    searchText: '',
    showPopup: false,
    selectedStation: {},
    stations: [],
    justTappedMarker: false,
    gradeList: []
  },

  onLoad: function (options) {
    console.log(wx.getStorageSync('token'))
    this.mapCtx = wx.createMapContext('map');
    this.getLocation();
    this.getStationsList();
    this.getGradeList();
  },
  // 查看按钮点击事件处理函数
  viewStationDetails: function(e) {
    console.log(1111,e);
    
    // 获取当前选中的充电站id
    const stationId = e.currentTarget.dataset.id;
    console.log(stationId);
    request({
      url: `chargingstation/chongdianzhan/${stationId}`, 
      method: 'GET',
      success: (res) => {
        if (res.data && res.data.data) {
          const stationDetails = res.data.data;
          this.setData({
            // 将获取到的详细信息更新到data中，这里假设数据结构是chongdianzhan
            chongdianzhan: stationDetails
          });
          // 这里可以根据需要跳转到详情页面并传递数据
          wx.navigateTo({
            url: `/pages/chongdianzhuang/chongdianzhuang?stationDetails=${JSON.stringify(stationDetails)}`
          });
        } else {
          wx.showToast({
            title: '获取充电站信息失败',
          })
        }
      },
      fail: (err) => {
        console.log('获取充电站信息失败：', err);
        wx.showToast({
          title: '获取充电站信息失败',
          icon: 'none'
        });
      }
    });
  },
  // 获取充电站列表
  getStationsList() {
    request({
      url: 'chargingstation/chongdianzhan/list',
      method: "GET",
      success: (res) => {
        if (res.data && res.data.rows) {
          const stations = res.data.rows;

          // 把 stations 保留在 data 中（可用于其他展示）
          this.setData({
            stations: stations
          });

          const markers = stations.map(item => ({
            ...item,
            width: 30,
            height: 30,
            iconPath: item.stationPhoto
          }))
          this.setData({
            markers: markers
          })
        } else {
          wx.showToast({
            title: '无充电站信息',
          })
        }
      }
    })
  },

  getLocation: function () {
    wx.getLocation({
      type: 'gcj02',
      success: (res) => {
        this.setData({
          latitude: res.latitude,
          longitude: res.longitude
        });
        // this.updateMarkers();
        if (this.mapCtx) {
          this.mapCtx.moveToLocation();
        }
      },
      fail: (err) => {
        console.log('获取位置失败：', err);
        wx.showToast({
          title: '获取位置失败',
          icon: 'none'
        });
      }
    });
  },

  onMapTap() {
    if (this.data.justTappedMarker) {
      // 刚点了 marker，不关闭弹窗
      this.setData({ justTappedMarker: false });
      return;
    }
    // 点击地图时关闭弹窗
    if (this.data.showPopup) {
      this.setData({
        showPopup: false,
        selectedStation: {}
      });
    }
  },
  

  onSearchInput: function (e) {
    const value = e.detail.value;
    this.setData({
      searchText: value
    });
    // 根据搜索关键词进行模糊匹配
    const filteredStations = this.data.stations.filter(item =>
      item.stationName && item.stationName.includes(value)
    );

    const filteredMarkers = filteredStations.map(item => ({
      ...item,
      width: 30,
      height: 30,
      iconPath: item.stationPhoto
    }));

    this.setData({
      markers: filteredMarkers
    });
  },

  toggleFilter: function () {
    wx.navigateTo({
      url: '/pages/filter/filter?filters=' + JSON.stringify(this.data.filters)
    });
  },

  showStationList: function () {
    wx.navigateTo({
      url: '/pages/station-list/station-list',
    });
  },

  centerMap: function () {
    if (!this.mapCtx) {
      this.mapCtx = wx.createMapContext('map');
    }
    this.mapCtx.moveToLocation();
  },

  updateFilters(filters) {
    this.setData({
      filters: filters
    });
    // 根据新的筛选条件重新加载站点
    this.getStationsList();
  },

  onMarkerTap(e) {
    this.setData({
      justTappedMarker: true
    });
    const markerId = e.detail.markerId;
    const station = this.data.markers.find(m => m.id === markerId);
    if (station) {
      this.setData({
        selectedStation: station,
        showPopup: true
      });
      const stationComment = this.data.gradeList.find(item => item.chargingstationId === markerId);
      if (stationComment) {
        this.setData({
          selectedStation: {
            ...this.data.selectedStation,
            rating: stationComment.grade
          }
        });
      }
    }
  },

  goDH(){
    wx.navigateTo({
      url: '/pages/routePlanning/routePlanning',
    })
  },

  getGradeList() {
    request({
      url: 'chargingstation/stationgrade/list',
      method: 'Get',
      success: (res) => {
        if (res.data && res.data.rows) {
          this.setData({
            gradeList: res.data.rows
          })
          console.log(this.data.gradeList)
        } else {
          wx.showToast({
            title: '无信息',
          })
        }
      }
    })
  },

  selectStationFromDropdown(e) {
    const stationId = e.currentTarget.dataset.id;
    const station = this.data.markers.find(item => item.id === stationId);
    console.log(station)
    if (station) {
      this.setData({
        latitude: station.latitude,
        longitude: station.longitude,
        scale: 16,
        selectedStation: station, // 设置当前选中站点
        showDropdown: false,
        showPopup: true  // 显示详情弹窗
      });
  
      if (!this.mapCtx) {
        this.mapCtx = wx.createMapContext('map');
      }
      this.mapCtx.moveToLocation({
        latitude: station.latitude,
        longitude: station.longitude
      });
    }
  },
  toggleDropdown() {
    this.setData({
      showDropdown: !this.data.showDropdown
    });
  },
  
})
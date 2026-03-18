import request from '../../utils/request.js';
Page({
  data: {
    stations: []
  },

  onLoad(){
    this.getStations();
  },

  onSearchInput(e) {
    const keyword = e.detail.value.trim();
    // 实现搜索逻辑
    if (!keyword) {
      this.getStations(); 
      return;
    }
    request({
      url: 'chargingstation/chongdianzhan/list',
      method: "GET",
      data: {
        stationName: keyword // 关键字传入后台
      },
      success: (res) => {
        if (res.data && res.data.rows) {
          this.setData({
            stations: res.data.rows
          });
        } else {
          this.setData({
            stations: []
          });
        }
      }
    });
  },

  getStations(){
    request({
      url: 'chargingstation/chongdianzhan/list',
      method: "GET",
      success: (res) => {
        if (res.data && res.data.rows) {
          const stations = res.data.rows;
          this.setData({
            stations: stations
          });
          console.log(this.data.stations)
        } else {
          wx.showToast({
            title: '无充电站信息',
          })
        }
      }
    })
  },

  onStationTap(e) {
    const stationId = e.currentTarget.dataset.id;
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

  navigateToHome() {
    wx.switchTab({
      url: '/pages/home/home'
    });
  }
});
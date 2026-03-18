import request from '../../utils/request.js'
Page({
  data: {
    stations: [],
    stationgradeList: [],
    gradeList: {},
    averageGrades: {},
    loading: false,
    firstLoad: true, // 首次加载标志
    refreshLoading: true // 下拉刷新标志
  },

  onLoad() {
    this.getData();
    this.loadDataWithAnimation();
  },

  // 带动画的加载方法
  async loadDataWithAnimation() {
    wx.showNavigationBarLoading();
    this.setData({ loading: true });
    
    try {
      await this.getData();
      this.setData({ firstLoad: false });
    } finally {
      wx.hideNavigationBarLoading();
      this.setData({ loading: false });
    }
  },

  // 下拉刷新
  onPullDownRefresh() {
    this.setData({ refreshLoading: true });
    this.loadDataWithAnimation().then(() => {
      wx.stopPullDownRefresh();
      this.setData({ refreshLoading: false });
    });
  },

  async getData() {
    try {
      // 显示加载状态（首次加载显示骨架屏，刷新显示顶部动画）
      if (!this.data.refreshLoading) {
        wx.showLoading({
          title: this.data.firstLoad ? '' : '加载中',
          mask: true
        });
      }
  
      // 并发请求优化
      const [stationRes, gradeRes] = await Promise.all([
        this.requestData('chargingstation/chongdianzhan/list'),
        this.requestData('chargingstation/stationgrade/list')
      ]);
  
      // 数据处理
      const stations = stationRes.data.rows || [];
      const stationgradeList = gradeRes.data.rows || [];
  
      // 计算统计信息
      const gradeStats = this.calculateStats(stations, stationgradeList);
  
      // 更新数据
      this.setData({
        stations,
        gradeStats,
        isEnd: stations.length < 10 // 假设每页10条
      });
  
    } catch (error) {
      console.error('加载失败:', error);
      wx.showToast({
        title: '加载失败，请重试',
        icon: 'none'
      });
      throw error;
    } finally {
      wx.hideLoading();
    }
  },
  
  // 封装请求方法
  requestData(url) {
    return new Promise((resolve, reject) => {
      request({
        url,
        success: resolve,
        fail: reject
      });
    });
  },
  
  // 计算统计信息
  calculateStats(stations, grades) {
    return stations.reduce((stats, station) => {
      const stationId = station.id;
      const comments = grades.filter(g => 
        String(g.chargingstationId) === String(stationId)
      );
      
      stats[stationId] = {
        comments,
        commentCount: comments.length,
        averageGrade: comments.length > 0 
          ? (comments.reduce((sum, g) => sum + g.grade, 0) / comments.length).toFixed(1)
          : '暂无评分'
      };
      return stats;
    }, {});
  },

  goToStationDetail: function (e) {
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
  }
})
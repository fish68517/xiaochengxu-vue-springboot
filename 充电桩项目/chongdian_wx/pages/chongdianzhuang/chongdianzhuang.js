// pages/chongdianzhuang/chongdianzhuang.js
import request from '../../utils/request.js'

Page({
  daohang: function () {
    wx.navigateTo({
      url: '/pages/daohang/daohang'
    });
  },
  luxian: function () {
    wx.navigateTo({
      url: '/pages/routePlanning/routePlanning'
    });
  },
  onClickLeft() {
    wx.showToast({
      title: '点击返回',
      icon: 'none'
    });
    wx.navigateBack();
  },
  onClickRight() {
    wx.showToast({
      title: '点击按钮',
      icon: 'none'
    });
  },
  onChange(event) {
    this.setData({
      value: event.detail,
    });
  },
  data: {
    name:'',
    commentTime: '',
    gradeLists: [],
    chargingstationId: '',
    show: false,
    stationId: '', // 从上一个页面获取
    commentContent: '',
    ratingValue: 0, // 评分值
    userInfo: {},
    id: '',
    power: '',
    powerList: [],
    enable: true,
    //获取用户集合
    userList: [],
    totalGrade: 0,
    avgGrade: 0,
    //存储评论集合
    gradeList: [],
    stationId: {},
    //用于存储充电桩数据的数组
    stumpList: [],
    //用于存储开放时间集合
    openTimeList: [],
    //用于存储站点集合
    serviceList: [],
    chongdianzhan: {},
    isLoading: true,
    isAscending: true, // 新增：用于标记当前是否为升序排序，初始为升序
    activeTab: 'reviews',
    ratingSummary: {
      five: 80,
      four: 60,
      three: 15,
      two: 10,
      one: 5
    },
  },

  async onLoad(options) {
    this.getUserInfo();
    const stationDetails = options.stationDetails ? JSON.parse(options.stationDetails) : {};
    const stationId = stationDetails.id; // 获取充电站id
    let that = this;
    that.setData({
      chongdianzhan: stationDetails,
      isLoading: true,
      stationId: stationDetails.id,

    });

    // 封装获取开放时间的接口请求为Promise
    const getOpeningTimesPromise = new Promise((resolve, reject) => {
      request({
        url: `chargingstation/chongdianzhan/getOpeningTimesByStationId/${stationId}`,
        method: 'GET',
        success(resp) {
          that.setData({
            openTimeList: resp.data.data
          });
          resolve();
        },
        fail(err) {
          reject(err);
        }
      });
    });

    // 封装获取站点服务的接口请求为Promise
    const getServicesPromise = new Promise((resolve, reject) => {
      request({
        url: `chargingstation/chongdianzhan/selectServicesByStationId/${stationId}`,
        method: 'GET',
        success(resp) {
          that.setData({
            serviceList: resp.data.data
          });
          resolve();
        },
        fail(err) {
          reject(err);
        }
      });
    });

    // 封装获取评论的接口请求为Promise
    const getGradeListPromise = new Promise((resolve, reject) => {
      request({
        url: `chargingstation/stationgrade/getStationgradeByStationId/${stationId}`,
        method: 'GET',
        success(resp) {
          that.setData({
            gradeList: resp.data.data
          });
          // 计算评分总和
          const gradeList = that.data.gradeList;
          let total = 0;
          gradeList.forEach(item => {
            total += item.grade;
          });
          that.setData({
            totalGrade: total
          });
          // 计算平均分
          let average = 0;
          if (gradeList.length > 0) {
            average = total / gradeList.length;
            average = parseFloat(average.toFixed(1));
          }
          that.setData({
            avgGrade: average
          });
          resolve();
        },
        fail(err) {
          reject(err);
        }
      });
    });

    // 封装获取用户列表的接口请求为Promise
    const getUserListPromise = new Promise((resolve, reject) => {
      request({
        url: 'member/userinfo/list',
        method: 'GET',
        success(resp) {
          that.setData({
            userList: resp.data.rows
          });
          console.log(that.data.userList);
          resolve();
        },
        fail(err) {
          reject(err);
        }
      });
    });

    try {
      // 按顺序执行所有Promise
      await getOpeningTimesPromise;
      await getServicesPromise;
      await getGradeListPromise;
      await getUserListPromise;
    } catch (err) {
      console.error('请求过程中出现错误:', err);
    } finally {
      that.setData({
        isLoading: false
      });
    }
    that.getStumpsPromise();
    that.getPower();
  },
  sortByTime() {
    const {
      gradeList,
      isAscending
    } = this.data;
    const newGradeList = gradeList.slice(); // 复制一份数据，避免修改原始数据
    newGradeList.sort((a, b) => {
      const timeA = new Date(a.commentTime);
      const timeB = new Date(b.commentTime);
      if (isAscending) {
        return timeA - timeB;
      } else {
        return timeB - timeA;
      }
    });
    this.setData({
      gradeList: newGradeList,
      isAscending: !isAscending // 切换排序状态
    });
  },

  switchTab: function (e) {
    const tab = e.currentTarget.dataset.tab;
    this.setData({
      activeTab: tab
    });
  },
  chongdian: function (e) {
    const isOccupy = this.data.stumpList.find(item => item.id == e.currentTarget.dataset.id)
    if (isOccupy.occupy) {
      wx.showModal({
        title: '提示',
        content: '充电桩已被使用，请更换',
        showCancel: false
      });
      return;
    }
    console.log(e);
    wx.setStorage({
      key: 'stationId',
      data: {
        stationId: this.data.stationId,
        stumpId: e.currentTarget.dataset.id
      }
    })
    wx.navigateTo({
      url: '/pages/select-car/index',
    })
  },
  navigateToStation: function () {
    // 调用导航
    wx.openLocation({
      latitude: 30.572816, // 示例坐标
      longitude: 104.066803,
      name: this.data.station.name,
      address: this.data.station.address,
      scale: 18
    });
  },

  planRoute: function () {
    // 路线规划
    wx.navigateTo({
      url: `/pages/route/route?id=${this.data.station.id}`
    });
  },

  // 获取用户信息
  getUserInfo: function () {
    try {
      const userInfo = wx.getStorageSync('wxuser');
      console.log(11111111111, userInfo)
      this.setData({
        userInfo: {
          id: userInfo.id
        }
      });
    } catch (e) {
      console.error('获取用户信息失败:', e);
      this.setData({
        userInfo: {}
      });
    }
  },
  //showLoginToast 方法
  showLoginToast: function () {
    wx.showToast({
      title: '请先登录',
      icon: 'none'
    });
    setTimeout(() => {
      wx.navigateTo({
        url: '/pages/login/login'
      });
    }, 1500);
  },

  // 新增评分变化处理
  onRatingChange: function (e) {
    this.setData({
      ratingValue: e.detail
    });
  },
  // 输入框内容变化
  onContentChange: function (e) {
    this.setData({
      commentContent: e.detail.value
    });
  },
  submitComment: function () {
    // 1. 校验输入
    if (!this.data.commentContent.trim()) {
      wx.showToast({
        title: '评论内容不能为空',
        icon: 'none'
      });
      return;
    }
    if (this.data.ratingValue === 0) {
      wx.showToast({
        title: '请先评分',
        icon: 'none'
      });
      return;
    }

    // 2. 显示加载状态
    wx.showLoading({
      title: '提交中...',
      mask: true
    });

    // 3. 获取 token
    const token = wx.getStorageSync('token');
    if (!token) {
      wx.hideLoading();
      wx.showToast({
        title: '请先登录',
        icon: 'none'
      });
      return;
    }

    // 4. 添加时间戳（前端生成，后端也应记录）
    const commentTime = new Date().toISOString(); // ISO格式时间

    // 5. 提交请求
    wx.request({
      url: 'http://localhost:8080/chargingstation/stationgrade',
      method: 'POST',
      header: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      data: {
        name: this.data.userInfo.name,
        chargingstationId: this.data.stationId,
        commentContent: this.data.commentContent,
        grade: this.data.ratingValue,
        userId: this.data.userInfo.id,
        commentTime: commentTime // 添加时间字段
      },
      success: (res) => {
        wx.hideLoading();
        if (res.statusCode === 200) {
          wx.showToast({
            title: '评论成功',
            icon: 'success'
          });

          // 关闭弹窗并重置表单
          this.setData({
            show: false,
            commentContent: '',
            ratingValue: 0
          });
        } else {
          wx.showToast({
            title: `提交失败: ${res.data?.message || res.statusCode}`,
            icon: 'none'
          });
        }
      },
      fail: (err) => {
        wx.hideLoading();
        wx.showToast({
          title: '网络错误',
          icon: 'none'
        });
        console.error('请求失败:', err);
      }
    });
  },
  // 获取评论列表
  getGradeList: function () {
    const that = this;
    wx.showLoading({
      title: '加载中...'
    });

    wx.request({
      url: `http://localhost:8080/chargingstation/stationgrade/getStationgradeByStationId/${this.data.chargingstationId}`,
      method: 'GET',
      data: {
        chargingstationId: this.data.stationId,
      },
      success: function (res) {
        wx.hideLoading();
        that.setData({
          gradeLists: res.data.rows,
          total: res.data.total // 总评论数
        });
      },
    });
  },
  showPopup() {
    this.setData({
      show: true
    });
  },

  onClose() {
    this.setData({
      show: false
    });
  },

  onChange(event) {
    // event.detail 为当前输入的值
    console.log(event.detail);
  },



  // 封装获取充电桩的接口请求为Promise
  getStumpsPromise() {
    request({
      url: 'chargingstation/stump/list',
      method: 'GET',
      success: (resp) => {
        this.setData({
          stumpList: resp.data.rows
        });
        const sonStumpList = this.data.stumpList.filter(item => item.chargingstationId == this.data.stationId)
        this.setData({
          stumpList: sonStumpList
        })
        console.log(sonStumpList)
        const enableStump = sonStumpList.find(item => item.occupy == 0)
        this.setData({
          enable: !!enableStump
        })
      },
    });
  },

  getPower() {
    const that = this;
    request({
      url: 'chargingstation/power/list',
      method: 'GET',
      success(res) {
        if (res.data && res.data.rows) {
          that.setData({
            powerList: res.data.rows
          });
          console.log(that.data.powerList)
        } else {
          wx.showToast({
            title: '获取功率信息失败',
          });
        }
      },
      fail(err) {
        console.log("请求失败", err);
        wx.showToast({
          title: '请求失败，请稍后再试',
        });
      }
    });
  },
  tijaio() {

  }
});

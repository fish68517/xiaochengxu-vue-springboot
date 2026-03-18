Page({
  data: {
    userInfo: {
      avatar: '/images/avatar.png',
      username: 'Koto',
      phone: '131****8888'
    }
  },

  onLoad: function(options) {
    // 页面加载时的逻辑
  },

  onShow: function() {
    // 页面显示时的逻辑
  },

  // 导航到用户详情
  navigateToUserDetail: function() {
    wx.navigateTo({
      url: '/pages/user/detail',
    });
  },

  // 导航到我的车辆
  navigateToCars: function() {
    wx.navigateTo({
      url: '/pages/cars/list',
    });
  },

  // 导航到付款方式
  navigateToPayment: function() {
    wx.navigateTo({
      url: '/pages/payment/list',
    });
  },

  // 导航到个人信息
  navigateToProfile: function() {
    wx.navigateTo({
      url: '/pages/profile/index',
    });
  },

  // 导航到安全设置
  navigateToSecurity: function() {
    wx.navigateTo({
      url: '/pages/security/index',
    });
  },

  // 导航到语言设置
  navigateToLanguage: function() {
    wx.navigateTo({
      url: '/pages/language/index',
    });
  },

  // 导航到帮助中心
  navigateToHelp: function() {
    wx.navigateTo({
      url: '/pages/help/index',
    });
  },

  // 导航到隐私政策
  navigateToPrivacy: function() {
    wx.navigateTo({
      url: '/pages/privacy/index',
    });
  },

  // 导航到关于我们
  navigateToAbout: function() {
    wx.navigateTo({
      url: '/pages/about/index',
    });
  },

  // 退出登录
  handleLogout: function() {
    wx.showModal({
      title: '提示',
      content: '确定要退出登录吗？',
      success: (res) => {
        if (res.confirm) {
          // 清除登录状态
          wx.clearStorageSync();
          // 跳转到登录页
          wx.reLaunch({
            url: '/pages/login/index',
          });
        }
      }
    });
  }
}) 
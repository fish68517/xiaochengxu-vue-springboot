Page({
  data: {
    
  },

  onLoad: function(options) {
    
  },

  authorizeLocation: function () {
    wx.showLoading({
      title: '授权中...',
    });
  
    wx.getSetting({
      success: (res) => {
        console.log('当前权限状态:', res.authSetting);
        // 如果已经授权，直接跳转
        if (res.authSetting['scope.userLocation']) {
          wx.hideLoading();
          wx.setStorageSync('locationAuthorized', true);
          wx.switchTab({
            url: '/pages/home/home',
          });
        } else {
          // 未授权，请求授权
          console.log(3)
          wx.authorize({
            scope: 'scope.userLocation',
            success: () => {
              wx.hideLoading();
              wx.setStorageSync('locationAuthorized', true);
              console.log(6)
              wx.switchTab({
                url: '/pages/home/home',
              });
            },
            fail: () => {
              wx.hideLoading();
              wx.showModal({
                title: '授权失败',
                content: '未授予位置信息，功能将受限，可稍后在设置中开启。',
                confirmText: '知道了'
              });
            }
          });
        }
      }
    });
  },
  

  skipAuthorization: function() {
    wx.showModal({
      title: '提示',
      content: '不授权位置权限将无法为您提供附近的充电站信息，是否继续？',
      cancelText: '重新授权',
      confirmText: '继续',
      success: (res) => {
        if (res.confirm) {
          // User wants to proceed without location
          wx.switchTab({
            url: '/pages/home/home',
          });
        }
      }
    });
  }
}) 
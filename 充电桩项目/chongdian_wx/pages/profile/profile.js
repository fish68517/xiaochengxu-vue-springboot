Page({
    data: {
      name: '',
      avatar: '',
      phoneNum: '',
      darkMode: false
    },
  
    onLoad: function(options) {
  
      const userInfo = wx.getStorageSync('wxuser');
      if (userInfo) {
        this.setData({
          name:userInfo.name,
          avatar:userInfo.avatar,
          phoneNum:userInfo.phoneNum
        });
        console.log(this.data.name)
      }
      
      // Load dark mode setting
      const darkMode = wx.getStorageSync('darkMode') || false;
      this.setData({
        darkMode
      });
    },
  
    onShow: function() {
      // Refresh data if needed
    },
  
    goToSettings: function() {
      wx.navigateTo({
        url: '/pages/personalDetails/personalDetails',
      })
      // wx.showToast({
      //   title: '设置功能即将上线',
      //   icon: 'none'
      // });
    },
  
    goToVehicles: function() {
      wx.navigateTo({
        url: '/pages/vehicles/vehicles',
      });
    },
  
    goToPayment: function() {
      wx.navigateTo({
        url: '/pages/payment/payment',
      });
    },
  
    goToPersonalInfo: function() {
      wx.navigateTo({
        url: '/pages/personalDetails/personalDetails',
      });
    },
  
    goToSecurity: function() {
      wx.navigateTo({
        url: '/pages/security/security',
      });
    },
  
    toggleLanguage: function() {
      wx.showActionSheet({
        itemList: ['简体中文', '繁體中文', 'English', '日本語', '한국어'],
        success: (res) => {
          if (!res.cancel) {
            // Handle language selection
            wx.showToast({
              title: '语言切换成功',
              icon: 'success'
            });
          }
        }
      });
    },
  
    toggleDarkMode: function(e) {
      const darkMode = e.detail ? e.detail.value : !this.data.darkMode;
      
      this.setData({
        darkMode
      });
      
      wx.setStorageSync('darkMode', darkMode);
      
      // Apply dark mode theme across the app
      this.applyTheme(darkMode);
    },
  
    applyTheme: function(darkMode) {
      // In a real app, we would apply theme changes here
      wx.showToast({
        title: darkMode ? '已开启深色模式' : '已关闭深色模式',
        icon: 'none'
      });
    },
  
    goToHelp: function() {
      wx.navigateTo({
        url: '/pages/Help/help',
      });
    },
  
    goToPrivacy: function() {
      wx.navigateTo({
        url: '/pages/privacy/privacy',
      });
    },
  
    goToAbout: function() {
      wx.navigateTo({
        url: '/pages/about/index',
      });
    },
  
    logout: function() {
      wx.showModal({
        title: '退出登录',
        content: '确定要退出登录吗？',
        success: (res) => {
          if (res.confirm) {
            // Clear user data
            wx.removeStorageSync('isLoggedIn');
            wx.removeStorageSync('userInfo');
            
            // Redirect to login page
            wx.reLaunch({
              url: '/pages/login/login',
            });
          }
        }
      });
    }
  }) 
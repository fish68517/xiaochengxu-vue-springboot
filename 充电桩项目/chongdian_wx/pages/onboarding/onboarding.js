Page({
  data: {
    currentIndex: 0
  },

  onLoad: function(options) {
    // Check if user has seen onboarding before
    const hasSeenOnboarding = wx.getStorageSync('hasSeenOnboarding');
    if (hasSeenOnboarding) {
      this.goToLogin();
    }
  },

  onSwiperChange: function(e) {
    this.setData({
      currentIndex: e.detail.current
    });
  },

  nextPage: function() {
    if (this.data.currentIndex < 2) {
      this.setData({
        currentIndex: this.data.currentIndex + 1
      });
    } else {
      this.startApp();
    }
  },

  skipOnboarding: function() {
    this.goToLogin();
  },

  startApp: function() {
    // Set flag that user has seen onboarding
    wx.setStorageSync('hasSeenOnboarding', true);
    this.goToLogin();
  },

  goToLogin: function() {
    wx.redirectTo({
      url: '/pages/login/login',
    });
  }
}) 
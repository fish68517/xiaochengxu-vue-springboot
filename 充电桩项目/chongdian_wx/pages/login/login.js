Page({
  data: {
    showEmailLogin: false,
    email: '',
    isValidEmail: false
  },

  onLoad: function(options) {
    
  },

  goBack: function() {
    wx.navigateBack();
  },

  loginWithWechat: function() {
    // Simulated login
    // this.simulateLogin('wechat');
  },

  loginWithAlipay: function() {
    // Simulated login
    // this.simulateLogin('alipay');
  },

  loginWithPhone: function() {
    // Simulated login
    // this.showPhoneLogin();
  },

  showPhoneLogin: function() {
    // Redirect to phone login in a real app
    // For now, just simulate login
    this.simulateLogin('phone');
  },

  validateEmail: function(email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  },

  goToRegister: function() {
    // Navigate to the registration page
    wx.navigateTo({
      url: '/pages/register/register'
    });
  },

  goToOtherLogin: function() {
    wx.navigateTo({
      url: '/pages/other-login/other-login'
    });
  },

  simulateLogin: function(type) {
    wx.showLoading({
      title: '登录中...',
    });

    // Simulate login process
    setTimeout(() => {
      wx.hideLoading();
      
      // Set user as logged in
      wx.setStorageSync('isLoggedIn', true);
      wx.setStorageSync('userInfo', {
        nickName: 'Koto',
        avatarUrl: '/assets/images/avatar.png',
        phone: '131****8888'
      });
      
      // Go to location permission
      wx.redirectTo({
        url: '/pages/permission/permission',
      });
    }, 1500);
  }
}) 
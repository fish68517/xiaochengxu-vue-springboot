Page({
  data: {
    email: '',
    maskedEmail: '',
    code: '', // Store the code as a string
    focusIndex: 0,
    countdown: 60, // Initial countdown time in seconds
    timer: null
  },

  onLoad: function (options) {
    const email = options.email || '邮箱地址未知';
    this.setData({
      email: email,
      maskedEmail: this.maskEmail(email)
    });
    this.startCountdown();
  },

  onUnload: function () {
    // Clear the timer when the page is unloaded
    if (this.data.timer) {
      clearInterval(this.data.timer);
      this.setData({ timer: null });
    }
  },

  maskEmail: function(email) {
    if (!email || email.indexOf('@') === -1) {
      return '邮箱地址格式错误';
    }
    const parts = email.split('@');
    const name = parts[0];
    const domain = parts[1];
    if (name.length <= 3) {
      return name[0] + '***@' + domain;
    } else {
      return name.substring(0, 3) + '***@' + domain;
    }
  },

  startCountdown: function() {
    // Clear any existing timer
    if (this.data.timer) {
      clearInterval(this.data.timer);
    }

    this.setData({ countdown: 60 }); // Reset countdown

    const timer = setInterval(() => {
      if (this.data.countdown > 0) {
        this.setData({ countdown: this.data.countdown - 1 });
      } else {
        clearInterval(timer);
        this.setData({ timer: null });
      }
    }, 1000);

    this.setData({ timer: timer });
  },

  onKeyPress: function(e) {
    const key = e.currentTarget.dataset.key;
    let currentCode = this.data.code;

    if (key === 'backspace') {
      if (currentCode.length > 0) {
        currentCode = currentCode.slice(0, -1);
      }
    } else {
      if (currentCode.length < 4) {
        currentCode += key;
      }
    }

    this.setData({
      code: currentCode,
      focusIndex: currentCode.length < 4 ? currentCode.length : 3
    });

    // Optional: Automatically verify when 4 digits are entered
    if (currentCode.length === 4) {
      this.verifyCode(currentCode);
    }
  },

  verifyCode: function(code) {
    console.log('Verifying code:', code);
    // --- Add your verification logic here ---
    // Example: Simulate successful verification
    wx.showToast({
      title: '验证成功',
      icon: 'success'
    });
    // Redirect to the user info page
    setTimeout(() => {
        wx.redirectTo({
            url: '/pages/userInfo/userInfo'
        });
    }, 1500);
    // --- End of verification logic ---
  },

  resendCode: function() {
    if (this.data.countdown === 0) {
      console.log('Resending code to:', this.data.email);
      // --- Add your logic to actually resend the code here ---
      wx.showToast({
        title: '验证码已发送',
        icon: 'none'
      });
      this.setData({ code: '', focusIndex: 0 }); // Clear input
      this.startCountdown();
      // --- End of resend logic ---
    }
  },

  goBack: function() {
    // Navigate back to the login page or previous page
    wx.navigateBack(); 
  }
}); 
import request from '../../utils/request.js';

Page({
  data: {
    activeTab: 'account',
    account: '', // 账号
    password: '', // 密码
    email: '', // 邮箱
    verifyCode: '', // 验证码
    isSending: false,
    sendCodeText: '发送验证码',
    countdown: 60
  },

  onLoad: function (options) {

  },

  goBack: function () {
    wx.navigateBack();
  },

  switchTab: function (e) {
    const tab = e.currentTarget.dataset.tab;
    this.setData({
      activeTab: tab
    });
  },

  onAccountInput: function (e) {
    this.setData({
      account: e.detail.value
    });
  },

  onPasswordInput: function (e) {
    this.setData({
      password: e.detail.value
    });
  },

  onEmailInput: function (e) {
    this.setData({
      email: e.detail.value
    });
  },

  onVerifyCodeInput: function (e) {
    this.setData({
      verifyCode: e.detail.value
    });
  },

  sendVerifyCode: function () {
    if (!this.data.email) {
      wx.showToast({
        title: '请输入邮箱号',
        icon: 'none'
      });
      return;
    }

    // 验证邮箱格式
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(this.data.email)) {
      wx.showToast({
        title: '请输入正确的邮箱格式',
        icon: 'none'
      });
      return;
    }

    if (this.data.isSending) {
      return;
    }

    this.setData({
      isSending: true,
      sendCodeText: '60s'
    });

    // 这里添加发送验证码的请求
    wx.showLoading({
      title: '发送中...',
    });
    request({
      url: "member/sendEmail",
      method: 'GET',
      data: {
        email: this.data.email
      },
      success: () => {
        // 显示成功消息
        wx.showToast({
          title: '验证码已发送',
          icon: 'success'
        });
        this.startCountdown();
      },
      fail: () => {
        wx.showToast({
          title: '验证码发送失败',
          icon: 'none'
        });
        this.setData({
          isSending: false,
          sendCodeText: '发送验证码'
        });
      },
      complete: () => {
        wx.hideLoading();
      }
    });
  },

  startCountdown: function () {
    let countdown = this.data.countdown;
    const timer = setInterval(() => {
      countdown--;
      this.setData({
        sendCodeText: countdown + 's'
      });

      if (countdown <= 0) {
        clearInterval(timer);
        this.setData({
          isSending: false,
          sendCodeText: '发送验证码',
          countdown: 60
        });
      }
    }, 1000);
  },

  handleLogin: function () {
    if (this.data.activeTab === 'account') {
      this.loginWithAccount();
      // 账号密码登录
    } else {
      this.loginWithEmail();
      // 邮箱登录
    }
  },

  loginWithAccount: function () {
    if (!this.data.account || !this.data.password) {
      wx.showToast({
        title: '请输入账号和密码',
        icon: 'none'
      });
      return;
    }

    // 这里添加账号登录逻辑
    wx.showLoading({
      title: '登录中...',
    });
    request({
      url: "loginPhone?phoneNumber=" + this.data.account + "&password=" + this.data.password,
      method: 'post',
      success: (e) => {
        if (e.data.code === 500) {
          wx.showToast({
            title: "账号或密码错误",
            icon: 'none'
          });
        }
        if (e.data.code === 200) {
          console.log(e)
          wx.setStorageSync('token', e.data.token)
          // 调用getPhoneInfo方法，返回大量数据
          request({
            url:'getPhoneInfo',
            method:'GET',
            success(e){
                console.log(e.data.wxuser)
                // wxuser对象放入本地
                wx.setStorageSync('wxuser', e.data.wxuser);
            }
        })
          wx.showToast({
            title: '登录成功',
            icon: 'success'
          });
          wx.navigateTo({
            url: '/pages/addCar/addCar'
          });
        }
      },
      fail: () => {
        wx.showToast({
          title: '登录失败',
          icon: 'none'
        });
      },
      complete: () => {
        wx.hideLoading();
      }
    });
  },

  loginWithEmail: function () {
    if (!this.data.email || !this.data.verifyCode) {
      wx.showToast({
        title: '请输入邮箱号和验证码',
        icon: 'none'
      });
      return;
    }

    // 验证邮箱格式
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(this.data.email)) {
      wx.showToast({
        title: '请输入正确的邮箱格式',
        icon: 'none'
      });
      return;
    }

    // 这里添加邮箱登录逻辑
    wx.showLoading({
      title: '登录中...',
    });
    request({
        url: "loginEmail?email=" + this.data.email + "&code=" + this.data.verifyCode,
        method:'post',
        success: (e) => {
          if (e.data.code === 500) {
            wx.showToast({
              title: "验证码错误",
              icon: 'none'
            });
          }
          if (e.data.code === 200) {
            // console.log(e)
            wx.setStorageSync('token', e.data.token)
            // 调用getPhoneInfo方法，返回大量数据
            request({
              url:'getPhoneInfo',
              method:'GET',
              success(e){
                  // console.log(e.data.wxuser)
                  // wxuser对象放入本地
                  wx.setStorageSync('wxuser', e.data.wxuser);
              }
          })
            wx.showToast({
              title: '登录成功',
              icon: 'success'
            });
            wx.navigateTo({
              url: '/pages/addCar/addCar'
            });
          }
        }
    })
  }

})

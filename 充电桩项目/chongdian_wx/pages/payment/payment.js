Page({
  data: {
    paymentMethods: [
      {
        type: 'wallet',
        name: '电子钱包',
        icon: '/assets/icons/qianbao.png'
      },
      {
        type: 'wechat',
        name: '微信支付',
        icon: '/assets/icons/wechat.png'
      },
      {
        type: 'alipay',
        name: '支付宝',
        icon: '/assets/icons/alipay.png'
      },
      {
        type: 'apple',
        name: 'Apple Pay',
        icon: '/assets/icons/pingguo.png'
      },
    ]
  },

  onLoad: function (options) {
    // 从本地存储获取支付方式列表（如果有）
    const savedPaymentMethods = wx.getStorageSync('paymentMethods');
    if (savedPaymentMethods) {
      this.setData({
        paymentMethods: savedPaymentMethods
      });
    }
  },

  onClickLeft: function () {
    wx.navigateBack()
  },

  onClickRight() {
    wx.showShareMenu({
      withShareTicket: true,
      menus: ['shareAppMessage', 'shareTimeline']
    });
  },

  removePayment(e) {
    const type = e.currentTarget.dataset.type;
    wx.showModal({
      title: '确认移除',
      content: '确定要移除该支付方式吗？',
      success: (res) => {
        if (res.confirm) {
          // 从数组中过滤掉要移除的支付方式
          const newPaymentMethods = this.data.paymentMethods.filter(item => item.type !== type);
          
          // 更新页面数据
          this.setData({
            paymentMethods: newPaymentMethods
          });

        //   // 保存到本地存储
        //   wx.setStorageSync('paymentMethods', newPaymentMethods);
          
          // 显示移除成功提示
          wx.showToast({
            title: '移除成功',
            icon: 'success'
          });
        }
      }
    });
  },

  addPaymentMethod() {
    wx.showActionSheet({
      itemList: ['添加信用卡', '添加储蓄卡', '添加其他支付方式'],
      success: (res) => {
        if (!res.cancel) {
          // 这里添加新支付方式的逻辑
          wx.showToast({
            title: '功能开发中',
            icon: 'none'
          });
        }
      }
    });
  }
}); 
import request from '../../utils/request.js'
Page({
  data: {
    money:'',
    carId: '',
    brand: '',
    model: '',
    image: '',
    powerIndex: 0,
    selectedPayment: 'wallet', // 默认选择电子钱包
    chargeTime: 1,
    totalPrice: 0,
    powerOptions: []
  },

  onLoad: function (options) {
    const userInfo = wx.getStorageSync('wxuser');
    const carData = wx.getStorageSync('carData');
    if(userInfo){
      this.setData({
        money: userInfo.money
      })
    }
    if (carData) {
      this.setData({
        carId: carData.carId,
        brand: carData.brand,
        model: carData.model,
        image: carData.image
      });
    } else {
      wx.showToast({
        title: '无法获取车辆信息',
        icon: 'none'
      });
    }
    this.getPower();
    console.log(this.data)
  },

  // 选择充电功率
  selectPower: function (e) {
    this.setData({
      powerIndex: e.detail.value
    }, () => {
      this.calculateTotalPrice();
    });
  },

  // 输入充电时长
  onTimeChange: function (e) {
    const value = e.detail.value;

    // 如果清空了输入框
    if (value === '') {
      this.setData({
        chargeTime: 0,
        totalPrice: 0
      });
      return;
    }
    const time = parseFloat(e.detail.value) || 0;
    this.setData({
      chargeTime: time
    }, () => {
      this.calculateTotalPrice();
    });
  },


  // 计算总价格
  calculateTotalPrice: function () {
    const {
      powerIndex,
      chargeTime,
      powerOptions
    } = this.data;
    if (!powerOptions.length || chargeTime <= 0) return;

    const selected = powerOptions[powerIndex];
    const totalPrice = (selected.price * chargeTime).toFixed(2);
    this.setData({
      totalPrice: totalPrice
    });
  },


  // 选择支付方式
  selectPayment: function (e) {
    const type = e.currentTarget.dataset.type;
    this.setData({
      selectedPayment: type
    });
  },

  // 跳转到订单确认页面
  goToNext: function () {
    if (this.data.money < this.data.totalPrice && this.data.selectedPayment=='wallet') {
      wx.showModal({
        title: '提示',
        content: '余额不足，请充值后再试',
        showCancel: false
      });
      return;
    }
    
    const {
      powerIndex,
      chargeTime,
      selectedPayment,
      powerOptions,
      totalPrice,
      carId,
      brand,
      model,
      image
    } = this.data;

    wx.showLoading({
      title: '处理中...',
    });
    wx.setStorage({
      key: 'orderData',
      data: {
        power: powerOptions[powerIndex].value,
        time: chargeTime,
        paymentType: selectedPayment,
        totalPrice: totalPrice,
        carId: carId,
        brand: brand,
        model: model,
        image: image
      }
    });
    setTimeout(() => {
      wx.hideLoading();
      wx.navigateTo({
        url: '/pages/order-confirm/index'
      });
    }, 1500);
  },

  getPower() {
    const that = this;
    request({
      url: 'chargingstation/power/list',
      method: 'GET',
      success(res) {
        if (res.data && res.data.rows) {
          const formatted = res.data.rows.map(item => {
            return {
              label: `${item.maxPower} kW`,
              value: item.maxPower,
              price: item.price
            };
          });
          that.setData({
            powerOptions: formatted
          }, () => {
            // 数据加载后立即计算一次价格
            that.calculateTotalPrice();
          });
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

});
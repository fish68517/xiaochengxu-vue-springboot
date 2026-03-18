import request from '../../utils/request.js';
Page({
  data: {
    kw: true,
    orderTime: {},
    userId:{},
    selectedCarInfoId:{},
    power:{},
    time:{},
    paymentType:{},
    totalPrice:{},
    carId:{},
    brand:{},
    model:{},
    image:{},
    orderDate:{},
    startTime:{},
    carInfoList: [],
    stationList: [],
    stationId:{},
    stumpId:{},
    stationInfo: {},
    notice: '若您没有在电动汽车充电站点充电，将不会进行扣费。',
    paymentIcons: {
      wallet: '/images/tabs/钱包支付.png',
      wechat: '/images/tabs/微信支付.png',
      alipay: '/images/tabs/支付宝支付.png',
      yinlian: '/images/tabs/银联支付.png'
    },
    paymentNames: {
      wallet: '电子钱包',
      wechat: '微信支付',
      alipay: '支付宝支付',
      yinlian: '银联支付'
    }
  },

  onLoad: function (options) {
    this.getStationsList();
    const now = new Date();
    const orderTime = this.getCurrentTime();
    const orderDate = this.formatDate(now);
    const startTime = this.formatTime(now);
    const orderData = wx.getStorageSync('orderData');
    const stationIds = wx.getStorageSync('stationId');
    const userInfo = wx.getStorageSync('wxuser');
    if(userInfo){
      this.setData({
        userId: userInfo.id
      })
    }
    if(stationIds){
      this.setData({
        stationId: stationIds.stationId,
        stumpId: stationIds.stumpId
      })
    }
    if (orderData) {
      this.setData({
        power: orderData.power,
        time: orderData.time,
        paymentType: orderData.paymentType,
        totalPrice: orderData.totalPrice,
        carId: orderData.carId,
        brand: orderData.brand,
        model: orderData.model,
        image: orderData.image,
        orderDate: orderDate,
        startTime: startTime,
        orderTime: orderTime
      });
    } else {
      wx.showToast({
        title: '无法获取车辆信息',
        icon: 'none'
      });
    }
    console.log(this.data)
    this.getCarInfoId();
  },

  getCurrentTime() {
    const now = new Date();
  
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
  
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');
    const seconds = String(now.getSeconds()).padStart(2, '0');
  
    return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
  },

  formatDate: function (date) {
    const year = date.getFullYear();
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const day = date.getDate().toString().padStart(2, '0');
    return `${year}-${month}-${day}`;
  },

  formatTime: function (date) {
    const hours = date.getHours().toString().padStart(2, '0');
    const minutes = date.getMinutes().toString().padStart(2, '0');
    return `${hours}:${minutes} AM`;
  },

  submitOrder: function () {
    wx.showLoading({
      title: '提交中...',
    });

    request({
      url: 'chargingstation/order',
      method: 'Post',
      data: {
        carInfoID: this.data.selectedCarInfoId,
        maxPower: this.data.power,
        createTime: this.data.orderTime,
        chargingTime: this.data.time,
        orderPrice: this.data.totalPrice,
        userID: this.data.userId,
        payWay: this.data.paymentNames[this.data.paymentType],
        chargingStationID: this.data.stationId,
        stumpID: this.data.stumpId,
        state: 0,
      }
    })

    request({
      url: 'chargingstation/stump',
      method: 'Put',
      data: {
        id: this.data.stumpId,
        occupy: 1
      }
    })

    // 模拟订单提交
    setTimeout(() => {
      wx.hideLoading();
      wx.navigateTo({
        url: '/pages/order-success/index'
      });
    }, 1500);
  },

  // 获取充电站列表
  getStationsList() {
    request({
      url: 'chargingstation/chongdianzhan/list',
      method: "GET",
      success: (res) => {
        if (res.data && res.data.rows) {
          this.setData({
            stationList: res.data.rows
          })
        }
        console.log(this.data.stationList)
        const selectedStation = this.data.stationList.find(item => item.id==this.data.stationId)
        console.log(selectedStation)
        this.setData({
          selectedStation
        })
      }
    })
  },

  getCarInfoId(){
    request({
      url: 'car/carinfo/list',
      method: 'Get',
      success: (res) => {
        if (res.data && res.data.rows) {
          this.setData({
            carInfoList: res.data.rows
          })
        }
        console.log(this.data.carInfoList)
        const selectedCarInfo = this.data.carInfoList.find(item => item.carModel_id==this.data.carId)
        console.log(selectedCarInfo)
        this.setData({
          selectedCarInfoId: selectedCarInfo.id
        })
        console.log(this.data.selectedCarInfoId)
      }
    })
  }
});
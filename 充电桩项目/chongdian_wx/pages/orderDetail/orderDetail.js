import request from '../../utils/request.js'
// pages/orderDetail/orderDetail.js
Page({

  /**
   * 页面的初始数据
   */
  data: {
    id: 0, //传入id
    orderDetail: {}, //订单详情
    date: "", //下单日期
    time: "", //下单时间
    chargingStationID: 0, //充电站id
    stationName: "", //充电站名称
    stationAddress: "", //充电站地址
    carInfoID: 0, //车辆信息id
    licenceNumber: "", //车辆号码
    carModel_id: 0, //车辆模型id
    carModel: "", //模型信息
    modelImage: "", //模型信息图片
    state: 0, //订单状态
  },

  onClickLeft: function () {
    wx.navigateBack()
  },
  /**
   * 生命周期函数--监听页面加载
   */
  onLoad(options) {
    console.log("opt", options)
    this.setData({
      id: options.id,
      chargingStationID: options.chargingStationID,
      carInfoID: options.carInfoID,
      state: options.state
    });
    console.log("state:",this.data.state)
    console.log("传入id:",this.data.id)
    console.log("传入chargingStationID:",this.data.chargingStationID)

    this.getOrderDetailById();
    console.log("获取站点信息")
    this.getChargingstation();
    this.getCarDetail();
    // this.getCarModel();
  },
  //根据id查询订单详情
  getOrderDetailById: function () {
    let that = this;
    request({
      url: "chargingstation/order/" + that.data.id,
      method: 'GET',
      success(options) {
        // console.log("订单详情：",options)
        // console.log("订单详情所有信息-->",options.data.data)
        const datetimeStr = options.data.data.createTime;
        const [datePart1, timePart1] = datetimeStr.split(' ');
        that.setData({
          orderDetail: options.data.data,
          date: datePart1,
          time: timePart1,
          chargingStationID: options.data.data.chargingStationID
        })
        //  console.log('方法一 - 日期:', that.data.time);
        // console.log('方法一 - 时间:', that.data.date);
        // console.log("充电站id",that.data.chargingStationID)
      }
    })
  },
  //获取该订单的充电站信息
  getChargingstation: function () {
    let that = this;
    let id = that.data.chargingStationID;

    // console.log("id->",id)
    request({
      url: "chargingstation/chongdianzhan/" + id,
      method: 'GET',
      success(options) {
        // console.log("充电站：",options)
        // console.log("充电站所有信息-->",options.data.data)
        that.setData({
          stationName: options.data.data.stationName,
          stationAddress: options.data.data.stationAddress
        })
        //  console.log("stationAddress",that.data.stationAddress)
        //  console.log("stationName",that.data.stationName)

      }
    })
  },
  //获取车辆信息
  getCarDetail: function () {
    let that = this;
    let id = that.data.carInfoID;

    // console.log("id->",id)
    request({
      url: "car/carinfo/" + id,
      method: 'GET',
      success(options) {
        // console.log("车辆信息",options)
        // console.log("车辆信息所有信息-->",options.data.data)
        that.setData({
          licenceNumber: options.data.data.licenceNumber,
          carModel_id: options.data.data.carModel_id
        })
        //  console.log("licenceNumber",that.data.licenceNumber)
        //  console.log("carModel_id",that.data.carModel_id)
        if (that.data.carModel_id != 0) {
          request({
            url: "car/carmodel/" + that.data.carModel_id,
            method: 'GET',
            success(options) {
              // console.log("车辆模型信息",options)
              // console.log("车辆模型所有信息-->",options.data.data)
              // console.log("carModel",options.data.data.carModel)
              that.setData({
                // licenceNumber:options.data.data.licenceNumber,
                carModel: options.data.data.carModel,
                modelImage: options.data.data.modelImage
              })
              //  console.log("licenceNumber",that.data.licenceNumber)
              // console.log("carModel2",that.data.carModel)

            }
          })
        } else {
          console.log("该函数为走完")
        }
      }
    })
  },
  //获取车辆模型信息
  getCarModel: function () {
    let that = this;
    let id = that.data.carModel_id;

    console.log("id->", id)
    if (that.data.carModel_id != 0) {
      request({
        url: "car/carmodel/" + 5,
        method: 'GET',
        success(options) {
          console.log("车辆模型信息", options)
          console.log("车辆模型所有信息-->", options.data.data)
          that.setData({
            licenceNumber: options.data.data.licenceNumber,
            carModel_id: options.data.datacarModel_id
          })
          console.log("licenceNumber", that.data.licenceNumber)
        }
      })
    } else {
      console.log("该函数为走完")
    }
  },
  //去充电中页面
  goCharging:function(e){
    console.log("去充电中页面！",e);
    const id = e.currentTarget.dataset.id;
    wx.navigateTo({
      url: `/pages/orderCharging/orderCharging?id=${id}`,
    });
  },
  /**
   * 生命周期函数--监听页面初次渲染完成
   */
  onReady() {

  },

  /**
   * 生命周期函数--监听页面显示
   */
  onShow() {

  },

  /**
   * 生命周期函数--监听页面隐藏
   */
  onHide() {

  },

  /**
   * 生命周期函数--监听页面卸载
   */
  onUnload() {

  },

  /**
   * 页面相关事件处理函数--监听用户下拉动作
   */
  onPullDownRefresh() {

  },

  /**
   * 页面上拉触底事件的处理函数
   */
  onReachBottom() {

  },

  /**
   * 用户点击右上角分享
   */
  onShareAppMessage() {

  }
})
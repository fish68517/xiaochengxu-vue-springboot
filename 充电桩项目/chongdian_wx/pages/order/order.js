import request from '../../utils/request.js'
Page({
  data: {
    userid: 7, //用户id
    activeTab: 'pending',
    tabLineLeft: 0,
    tabLineWidth: 0,
    alert: "插入充电端连接到您的汽车并开始充电，如果您在15分钟内未来充电，此坐订单将会自动取消。",
    AllChargingStation: [{ //所有的充电站信息

    }],
    AllOrders: [ //查询该用户的所有订单信息
      {
        // id:0,//订单编号
        // createTime:"",//创建时间
        // carInfoID:0,//车辆信息id
        // maxPower:0,//最大功率id
        // chargingTime:0.0,//充电时长
        // orderPrice:0.0,//充电金额
        // payWay:"",//支付方式
        // chargingStationID:0,//充电站id
        // stumpID:0,//充电桩id
        // state:0,//状态
        // cancelCause:"",//取消原因
        // del:0//逻辑删
      }
    ],
    pendingOrders: [{
      id: 1,
      date: '2024-01-17',
      time: '10:00 AM',
      reminder: true,
      stationName: '电动驿站',
      stationAddress: '成都市武侯区人民南路一段123号',
      carType: 'Tesla (Plug)',
      power: '100 kW',
      duration: '1 小时',
      price: '¥14.25',
      alert: '插入充电端连接到您的汽车并开始充电，如果您在15分钟内未来充电，此坐订单将会自动取消。'
    }],
    completedOrders: [{
        id: 101,
        date: '2024-01-17',
        time: '14:00 PM',
        stationName: '电动驿站',
        stationAddress: '成都市武侯区人民南路一段123号',
        carType: 'Tesla (Plug)',
        power: '80 kW',
        duration: '45 分钟',
        price: '¥12.50'
      },
      {
        id: 102,
        date: '2024-01-16',
        time: '09:30 AM',
        stationName: '快速电池充电站',
        stationAddress: '成都市青羊区宫宅街7789号',
        carType: 'BYD (DC)',
        power: '120 kW',
        duration: '30 分钟',
        price: '¥18.75'
      }
    ],
    cancelledOrders: [{
      id: 201,
      date: '2024-01-15',
      time: '16:00 PM',
      stationName: '绿能充电中心',
      stationAddress: '成都市锦江区春熙路456号',
      cancelReason: '用户取消 - 已超时未到达充电站'
    }]
  },
  onClickLeft: function () {
    wx.navigateBack()
  },
  onLoad: function (options) {
    let wxuser = wx.getStorageSync('wxuser')
    console.log("登录用户：",wxuser)
    this.setData({
      userid:wxuser.id
    });
    this.setTabLinePosition();
    this.getOrder();
    this.getChargingstation();
  },
//再次充电
  toStationById: function (e) {
      console.log("e", e)
      // 获取当前选中的充电站id
      let stationId = e.currentTarget.dataset.chargingstationid;
      console.log("传入充电站id", stationId)
      // const stationId = e.currentTarget.dataset.id;
      console.log(stationId);
      request({
        url: `chargingstation/chongdianzhan/${stationId}`,
        method: 'GET',
        success: (res) => {
          if (res.data && res.data.data) {
            const stationDetails = res.data.data;
            this.setData({
              // 将获取到的详细信息更新到data中，这里假设数据结构是chongdianzhan
              chongdianzhan: stationDetails
            });
            // 这里可以根据需要跳转到详情页面并传递数据
            wx.navigateTo({
              url: `/pages/chongdianzhuang/chongdianzhuang?stationDetails=${JSON.stringify(stationDetails)}`
            });
          } else {
            wx.showToast({
              title: '获取充电站信息失败',
            })
          }
        },
        fail: (err) => {
          console.log('获取充电站信息失败：', err);
          wx.showToast({
            title: '获取充电站信息失败',
            icon: 'none'
          });
        }
      });
    },
  onShow: function () {
    // Refresh data if needed
  },
  // 获取订单信息
  getOrder: function () {
    let that = this;
    request({
      url: "chargingstation/order/list",
      method: 'GET',
      data: {
        userID: this.data.userid
      },
      success(options) {
        // console.log("options",options)
        // console.log("id-->",options.data.rows)

        that.setData({
          AllOrders: options.data.rows
        })
        //  console.log("AllOrders",that.data.AllOrders)
      }
    })
  },
  //获取所有充电站信息
  getChargingstation: function () {
    let that = this;
    request({
      url: "chargingstation/chongdianzhan/list",
      method: 'GET',
      data: {
        // userID: this.data.userid
      },
      success(options) {
        // console.log("充电站：",options)
        // console.log("充电站所有信息-->",options.data.rows)

        that.setData({
          AllChargingStation: options.data.rows
        })
        console.log("AllChargingStation", that.data.AllChargingStation)
      }
    })
  },
  setTabLinePosition: function () {
    const tabIndex = this.getTabIndex();
    this.setData({
      tabLineLeft: `${tabIndex * 33.33}%`,
      tabLineWidth: '33.33%'
    });
  },

  getTabIndex: function () {
    const {
      activeTab
    } = this.data;
    switch (activeTab) {
      case 'pending':
        return 0;
      case 'completed':
        return 1;
      case 'cancelled':
        return 2;
      default:
        return 0;
    }
  },

  switchTab: function (e) {
    const tab = e.currentTarget.dataset.tab;
    if (this.data.activeTab === tab) return;

    this.setData({
      activeTab: tab
    }, () => {
      this.setTabLinePosition();
    });
  },
  //滑块滑动实现收藏
  toggleReminder: function (e) {
    console.log("e->",e)
    let that = this;
    const chargingStationID = e.currentTarget.dataset.chargingstationid;
    const userid = e.currentTarget.dataset.userid;
    const value = e.detail.value;
    //如果value为true
    if (value) {
      console.log("真")
      request({
        url: "SC/collect",
        method: 'POST',
        data: {
          userId: userid,
          chargingstationId: chargingStationID
        },
        success(options) {
          that.setData({})
        }
      })
    } else {
      console.log("假")
      //如果value为false
      //则先根据用户id和充电站id查询数据库中收藏表是否有该条数据，如果有，则删除，如果没有则什么都不做
      request({
        url: "SC/collect/list",
        method: 'GET',
        data: {
          userId: userid,
          chargingstationId: chargingStationID
        },
        success(options) {
          console.log("是否有数据：",options)
          let ids = options.data.rows[0].id
          console.log("ids",ids)
          //查到有数据-做删除操作
          request({
            url: "SC/collect/"+ids,
            method: 'DELETE',
            success(options) {
              console.log("删除删除成功！")
            }
          })
        }
      })
    }
    this.setData({
    });
  },
  //取消订单
  cancelOrder: function (e) {
    const id = e.currentTarget.dataset.id;
    let that = this;
    wx.showModal({
      title: '取消订单',
      content: '确定要取消该订单吗？',
      success: (res) => {
        if (res.confirm) {
          request({
            url: "chargingstation/order",
            data: {
              id: id,
              state: 2
            },
            method: 'PUT',
            success(options) {
              console.log("取消成功")
              that.setData({})
            }
          })
          wx.showToast({
            title: '订单已取消',
            icon: 'success'
          });
          wx.navigateTo({
            url: `/pages/orderCancel/orderCancel?id=${id}`,
          })
          console.log("传入id", id)

        }
      }
    });
  },
  // 查看详情方法
  viewOrderDetail: function (e) {
    const id = e.currentTarget.dataset.id;
    const chargingStationID = e.currentTarget.dataset.chargingstationid;
    const carInfoID = e.currentTarget.dataset.carinfoid;
    const state = e.currentTarget.dataset.state;
    // console.log("chargingStationID",chargingStationID)
    wx.navigateTo({
      url: `/pages/orderDetail/orderDetail?id=${id}&chargingStationID=${chargingStationID}&carInfoID=${carInfoID}&state=${state}`,
    });
    console.log("传出state", state)
  },

  goToHome: function () {
    wx.switchTab({
      url: '/pages/home/home',
    });
  }
})
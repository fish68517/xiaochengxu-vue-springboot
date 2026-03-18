Page({
  data: {
    power: 30,
    chargingTime: '00:14:55',
    batteryPercent: '30',
    current: '12.24',
    cost: '4.27'
  },

  onLoad() {
    // 可以在这里添加定时器更新充电信息
  },

  stopCharging() {
    wx.showModal({
      title: '确认结束充电',
      content: '是否确认结束本次充电？',
      success(res) {
        if (res.confirm) {
          // 处理结束充电逻辑
          wx.navigateBack();
        }
      }
    });
  },
  onClickLeft: function () {
    wx.navigateBack()
  },
// 充电完成弹出框
showToast: function () {
  wx.showToast({
    title: '操作成功',
    icon: 'success',
    duration: 2000
  })
},
onClickLeft:function(){
  wx.navigateBack()
},
});
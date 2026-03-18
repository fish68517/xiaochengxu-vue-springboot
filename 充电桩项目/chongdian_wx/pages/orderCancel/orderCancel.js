import request from '../../utils/request.js'
Page({
  data: {
    selectedReason: '',
    id:0,//传入订单id
    reasons: [
      '我遇到了意想不到的情况',
      '我的日程有变',
      '我找到了另一种充电方式',
      '找不到位置',
      '我遇到一个技术问题',
      '费用过高',
      '天气状况',
      '充电桩不可用',
      '缺乏便利设施',
      '无停车位',
      '其他人'
    ]
  },
  onLoad: function (options) {
    console.log("传入id：",options.id)
    this.setData({
      id:options.id
    })
  },
  onReasonChange(e) {
    this.setData({
      selectedReason: this.data.reasons[e.detail.value]
    });
  },

  onSubmit() {
    if (!this.data.selectedReason) {
      wx.showToast({
        title: '请选择取消原因',
        icon: 'none'
      });
      return;
    }
    console.log("提交愿意：",this.data.selectedReason)
    let Reason = this.data.selectedReason;
    //处理提交后 修改数据库的请求
    let that = this;
    let id = that.data.id;
    request({
      url: "chargingstation/order",
      method: 'PUT',
      data:{
        id:id,
        cancelCause:Reason
      },
      success(options) {
      }
    });

    // 这里处理提交逻辑
    wx.showLoading({
      title: '提交中...'
    });

    // 模拟提交
    setTimeout(() => {
      wx.hideLoading();
      wx.showToast({
        // title: '取消成功',
        // icon: 'success',
        // duration: 2000,
        success: () => {
          // 延迟返回上一页
          setTimeout(() => {
            wx.navigateTo({
              url: '/pages/orderCancelSuccess/orderCancelSuccess',
            })
          }, 2000);
        }
      });
    }, 1500);
  },
  onClickLeft:function(){
    wx.navigateBack()
  }
});
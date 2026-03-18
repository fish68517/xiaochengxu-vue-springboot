// pages/orderCancelSuccess/orderCancelSuccess.js
Page({

  /**
   * 页面的初始数据
   */
  data: {

  },

  /**
   * 生命周期函数--监听页面加载
   */
  onLoad(options) {

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
  //返回订单页面
  onConfirm: function () {
    console.log("---------------")
    // 获取当前页面路径
    const pages = getCurrentPages();
    console.log("pages",pages)
    const currentPage = pages[pages.length - 3];
    console.log("currentPage",currentPage)
    const currentPagePath = currentPage.route;
    console.log("currentPagePath",currentPagePath)

    // 使用 wx.redirectTo 重新加载当前页面
    wx.redirectTo({
      url: `/${currentPagePath}`
    });
    console.log("---------------")
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
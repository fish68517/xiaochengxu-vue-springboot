// pages/security/security.js
Page({

  /**
   * 页面的初始数据
   */
  data: {
    rememberMe: true,
    fingerprintEnabled: false,
    faceIdEnabled: false,
    smsEnabled: false,
    wechatEnabled: false
  },

  /**
   * 生命周期函数--监听页面加载
   */
  onLoad(options) {
    // Load user's security settings
    this.loadSecuritySettings()
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

  },

  loadSecuritySettings() {
    // TODO: Load actual security settings from backend or storage
  },

  onRememberMeChange(e) {
    this.setData({ rememberMe: e.detail.value })
    // TODO: Save changes to backend or storage
  },

  onFingerprintChange(e) {
    this.setData({ fingerprintEnabled: e.detail.value })
    // TODO: Save changes to backend or storage
  },

  onFaceIdChange(e) {
    this.setData({ faceIdEnabled: e.detail.value })
    // TODO: Save changes to backend or storage
  },

  onSmsChange(e) {
    this.setData({ smsEnabled: e.detail.value })
    // TODO: Save changes to backend or storage
  },

  onWechatChange(e) {
    this.setData({ wechatEnabled: e.detail.value })
    // TODO: Save changes to backend or storage
  },

  updatePassword() {
    // TODO: Navigate to password update page
    wx.showToast({
        title: '太简单了，没写',
        icon: 'success'
    });
    wx.navigateTo({
      url: '/pages/updatePassword/updatePassword'
    })
  }
})
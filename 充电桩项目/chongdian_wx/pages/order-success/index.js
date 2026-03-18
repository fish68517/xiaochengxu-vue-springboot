Page({
  goToOrderList: function () {
    wx.removeStorageSync('carData');
    wx.removeStorageSync('orderData');
    wx.removeStorageSync('stationId');
    wx.switchTab({
      url: '/pages/order/order'
    });
  }
});
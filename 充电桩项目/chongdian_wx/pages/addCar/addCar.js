Page({
  data: {},

  goBack: function() {
    wx.navigateBack();
  },

  skipAddCar: function() {
    wx.showToast({
      title: '稍后添加',
      icon: 'none'
    });
    // Navigate to the next page
    wx.redirectTo({
      url: '/pages/permission/permission' // Replace with the actual next page
    });
  },

  addCar: function() {
    wx.showToast({
      title: '添加车辆',
      icon: 'success'
    });
    // Navigate to the car details page
    wx.redirectTo({
      url: '/pages/carDetails/carDetails'
    });
  },

  confirmAddCar: function() {
    // 确认添加车辆的逻辑
  }
}); 
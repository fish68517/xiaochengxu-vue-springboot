// pages/routePlanning/routePlanning.js
Page({
  daohang: function () {
    wx.navigateTo({
      url: '/pages/daohang/daohang' 
    });
  },
  fanhui: function(){
    wx.navigateBack();
  }
  
})
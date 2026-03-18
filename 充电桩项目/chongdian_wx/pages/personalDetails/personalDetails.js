Page({
  data: {

    userInfo: {
      name: 'Koto',
      phone: '13188888888',
      email: 'koto1234@gmail.com',
      gender: '女士',
      birthday: '1992/03/21'
    }
  },

  onLoad() {
    // 页面加载时的逻辑
    const userInfo = wx.getStorageSync('wxuser');
    console.log("全局用户属性变量：",userInfo)
    this.setData({
      userInfo:userInfo
    })
    console.log("用户属性变量：",this.data.userInfo)
  },

  chooseAvatar() {
    wx.chooseImage({
      count: 1,
      sizeType: ['compressed'],
      sourceType: ['album', 'camera'],
      success: (res) => {
        // 处理头像上传
      }
    });
  },

  saveInfo() {
    wx.showToast({
      title: '保存成功',
      icon: 'success',
      duration: 3000
    });
    wx.navigateBack();
  }
});
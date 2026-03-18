Page({
  data: {
    menuItems: [
      { text: '职位/空缺' },
      { text: '开发者  ' },
      { text: '合作伙伴'},
      { text: '权限设置'},
      { text: '隐私政策'},
      { text: '问题反馈'},
      { text: '评价我们'},
      { text: '官网访问'},
      { text: '关注我们'}
    ]
  },
  onClickLeft:function(){
    wx.navigateBack({
      delta:1
    })
  },
  onLoad() {
    // 可以在这里获取实际的版本号
  },

  goBack() {
    wx.navigateBack();
  },

  goToCompanyInfo() {
    wx.navigateTo({
      url: '/pages/company/jobs/index'
    });
  },

  goToDeveloper() {
    wx.navigateTo({
      url: '/pages/about/developer/index'
    });
  },

  goToCooperation() {
    wx.navigateTo({
      url: '/pages/about/cooperation/index'
    });
  },

  goToPermissions() {
    wx.navigateTo({
      url: '/pages/about/permissions/index'
    });
  },

  goToPrivacy() {
    wx.navigateTo({
      url: '/pages/privacy/index'
    });
  },

  goToFAQ() {
    wx.navigateTo({
      url: '/pages/about/faq/index'
    });
  },

  goToRating() {
    // 跳转到小程序评分
    wx.showToast({
      title: '感谢您的支持',
      icon: 'none'
    });
  },

  goToWebsite() {
    // 可以使用 wx.setClipboardData 复制官网链接
    wx.setClipboardData({
      data: 'https://www.example.com',
      success() {
        wx.showToast({
          title: '官网链接已复制',
          icon: 'none'
        });
      }
    });
  },

  goToFollow() {
    wx.navigateTo({
      url: '/pages/about/follow/index'
    });
  }
}); 
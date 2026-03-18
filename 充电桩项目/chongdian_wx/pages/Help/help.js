import request from '../../utils/request'
Page({

  /**
   * 页面的初始数据
   */
  data: {
    activeTab: 0,
    currentSubTab: 0,
    searchText: '',
    subTabs: ['常见', '充电', '服务', '账户', '其他'],
    faqList: [
      {
        type: 0, // 常见
        question: '如何寻找充电站?',
        answer: '您可以通过以下方式找到充电站：\n1. 打开首页地图\n2. 查看周边充电站标记\n3. 使用搜索功能查找特定位置\n4. 查看列表视图浏览所有站点',
        expanded: false,
        show: true
      },
      {
        type: 1, // 充电
        question: '如何开始充电?',
        answer: '开始充电只需三步：\n1. 停车入位\n2. 扫描充电桩二维码\n3. 选择充电模式并确认开始',
        expanded: false,
        show: true
      },
      {
        type: 1, // 充电
        question: '充电费用如何计算?',
        answer: '充电费用包含以下部分：\n1. 电费（按实际用电量）\n2. 服务费（按充电时长）\n具体费率可能因地区和时段不同而变化。',
        expanded: false,
        show: true
      },
      {
        type: 2, // 服务
        question: '如何联系客服?',
        answer: '您可以通过以下方式联系客服：\n1. 在线客服咨询\n2. 拨打服务热线400-888-8888\n3. 添加微信客服',
        expanded: false,
        show: true
      },
      // 更多FAQ项...
    ],
    filteredFaqList: [], // 用于存储筛选后的FAQ列表
    contactList: [
      {
        title: '在线客服',
        // desc: '24小时在线服务',
        icon: '/images/tabs/在线客服.png',
        type: 'online'
      },
      {
        title: '电话',
        // desc: '400-888-8888',
        icon: '/images/tabs/电话咨询.png',
        type: 'phone'
      },
      {
        title: '微信咨询',
        // desc: '添加客服微信',
        icon: '/images/tabs/微信咨询.png',
        type: 'wechat'
      },
      {
        title: 'QQ咨询',
        // desc: 'support@example.com',
        icon: '/images/tabs/QQ咨询.png',
        type: 'qq'
      }
    ],
    socialMedia: [
      {
        name: '微信公众号',
        icon: '/images/tabs/微信.png',
        type: 'wechat'
      },
      {
        name: '微博',
        icon: '/images/tabs/微博.png',
        type: 'weibo'
      },
      {
        name: '抖音',
        icon: '/images/tabs/抖音.png',
        type: 'douyin'
      }
    ]
  },

  onLoad() {
    this.filterFaqList();
  },
  onClickLeft:function(){
    wx.navigateBack({
      delta:1
    })
  },
  // 切换主标签页
  switchTab(e) {
    const index = parseInt(e.currentTarget.dataset.index);
    if (this.data.activeTab === index) return;
    
    this.setData({
      activeTab: index
    });
  },

  // 切换二级标签页
  switchSubTab(e) {
    const index = parseInt(e.currentTarget.dataset.index);
    if (this.data.currentSubTab === index) return;
    
    this.setData({
      currentSubTab: index
    }, () => {
      this.filterFaqList();
    });
  },

  // 搜索输入处理
  onSearchInput(e) {
    this.setData({
      searchText: e.detail.value
    }, () => {
      this.filterFaqList();
    });
  },

  // 筛选FAQ列表
  filterFaqList() {
    const { faqList, currentSubTab, searchText } = this.data;
    
    const filteredList = faqList.map(item => {
      const matchesType = item.type === currentSubTab;
      const matchesSearch = searchText === '' || 
                          item.question.toLowerCase().includes(searchText.toLowerCase()) ||
                          item.answer.toLowerCase().includes(searchText.toLowerCase());
      
      return {
        ...item,
        show: matchesType && matchesSearch
      };
    });

    this.setData({
      filteredFaqList: filteredList
    });
  },
  // 展开/收起FAQ
  toggleFaq(e) {
    const index = e.currentTarget.dataset.index;
    const key = `filteredFaqList[${index}].expanded`;
    this.setData({
      [key]: !this.data.filteredFaqList[index].expanded
    });
  },

  // 处理联系方式点击
  handleContact(e) {
    const type = e.currentTarget.dataset.type;
    switch (type) {
      case 'phone':
        wx.makePhoneCall({
          phoneNumber: '400-888-8888'
        });
        break;
      case 'online':
        wx.showToast({
          title: '正在接入在线客服...',
          icon: 'loading'
        });
        break;
      case 'wechat':
        wx.setClipboardData({
          data: 'EVCharging',
          success: () => {
            wx.showToast({
              title: '微信号已复制',
              icon: 'success'
            });
          }
        });
        break;
      case 'email':
        wx.setClipboardData({
          data: 'support@example.com',
          success: () => {
            wx.showToast({
              title: '邮箱已复制',
              icon: 'success'
            });
          }
        });
        break;
    }
  },

  handleSocial(e) {
    const type = e.currentTarget.dataset.type;
    wx.showToast({
      title: '长按二维码关注',
      icon: 'none'
    });
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
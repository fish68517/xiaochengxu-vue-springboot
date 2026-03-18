import request from '../../utils/request.js'
Page({

  /**
   * 页面的初始数据
   */
  data: {
transactions:[]
  },
  onClickRight() {
    wx.showToast({ title: '点击按钮', icon: 'none' });
  },
  /**
   * 生命周期函数--监听页面加载
   */
  onLoad(options) {
    this.getAllTransactions();
  },
// 获取所有交易记录并合并排序
getAllTransactions() {
  Promise.all([this.getRechargeListPromise(), this.getPayListPromise()])
    .then(([rechargeList, payList]) => {
      let allTransactions = [];
      
      // 处理充值记录
      if (rechargeList && rechargeList.length > 0) {
        const rechargeTransactions = rechargeList.map(item => ({
          id: item.id,
          type: 'income',
          name: '充值到钱包',
          amount: item.rechargeMoney || item.payAmount || 0,
          date: item.rechargeData || item.payTime || '',
          time: this.formatTimeFromDate(item.createTime || new Date()),
          payWay: item.rechargeMode || item.payWay || '简易支付'
        }));
        allTransactions = allTransactions.concat(rechargeTransactions);
      }

      // 处理支付记录
      if (payList && payList.length > 0) {
        const payTransactions = payList.map(item => ({
          id: item.id,
          type: 'expense',
          name: '电动驿站',
          amount: item.payAmount || 0,
          date: item.payTime || '',
          time: this.formatTimeFromDate(item.createTime || new Date()),
          payWay: item.payWay || '简易支付'
        }));
        allTransactions = allTransactions.concat(payTransactions);
      }

      // 按时间戳排序（从新到旧）
      allTransactions.sort((a, b) => {
        const dateA = new Date(a.date + ' ' + a.time);
        const dateB = new Date(b.date + ' ' + b.time);
        return dateB - dateA;
      });

      this.setData({
        transactions: allTransactions
      });
    })
    .catch(error => {
      console.error('获取交易记录失败:', error);
      wx.showToast({
        title: '获取交易记录失败',
        icon: 'none'
      });
    });
},
getRechargeListPromise() {
  return new Promise((resolve, reject) => {
    request({
      url: 'member/topup/list',
      method: 'GET',
      data: {
        pageNum: 1,
        pageSize: 10
      },
      success(res) {
        if (res.data && res.data.rows) {
          resolve(res.data.rows);
        } else {
          resolve([]);
        }
      },
      fail(error) {
        console.error('充值记录获取失败:', error);
        reject(error);
      }
    });
  });
},

// 将支付列表请求转换为Promise
getPayListPromise() {
  return new Promise((resolve, reject) => {
    request({
      url: 'member/outlay/list',
      method: 'GET',
      data: {
        pageNum: 1,
        pageSize: 10
      },
      success(res) {
        if (res.data && res.data.rows) {
          resolve(res.data.rows);
        } else {
          resolve([]);
        }
      },
      fail(error) {
        console.error('支付记录获取失败:', error);
        reject(error);
      }
    });
  });
},
// 格式化时间
formatTimeFromDate(dateStr) {
  if (!dateStr) return '';
  const date = new Date(dateStr);
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  return `${hours}:${minutes}`;
},

// 查看交易详情
viewTransactionDetail(e) {
  const id = e.currentTarget.dataset.id;
  const transaction = this.data.transactions.find(t => t.id === id);
  if (transaction) {
    wx.showModal({
      title: '交易详情',
      content: `类型：${transaction.type === 'income' ? '充值' : '支出'}\n金额：¥${transaction.amount}\n时间：${transaction.date} ${transaction.time}\n支付方式：${transaction.payWay}`,
      showCancel: false
    });
  }
},
transactionRecord:function(){
  wx.navigateBack({
    delta:1
  })
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
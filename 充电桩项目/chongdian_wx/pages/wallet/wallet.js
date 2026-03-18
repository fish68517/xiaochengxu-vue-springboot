import request from '../../utils/request.js'

Page({
  data: {
    card:{},
    userId:'',
    name: "",
    money: 0.00,
    cardNumber: [],
    transactions: [],
    rechargeAmount: '',
    paymentMethods: ['微信支付', '支付宝支付', '银行卡支付'],
    card:{
      maskedCard:''
    },
  },

  onLoad: function(options) {
    this.getWallet();
    this.getCard();
    this.getAllTransactions();
    const that=this;
    
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

  // 将充值列表请求转换为Promise
  getRechargeListPromise() {
    return new Promise((resolve, reject) => {
      request({
        url: 'member/topup/list',
        method: 'GET',
        data: {
          pageNum: 1,
          pageSize: 50
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
          pageSize: 50
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
  
  //姓名和金额
  getWallet(){
    const user = wx.getStorageSync('wxuser');
    this.setData({
      money: user.money,
      name: user.name,
      userId:user.id
    })
  },
  // 卡号
  getCard(){
    const that=this;
    request({
      url:'member/bankcard/list',
      method:'GET',
      success(res){
        if(res.data && res.data.rows){
          that.setData({
            cardNumber:res.data.rows
          })
          console.log(that.data.cardNumber);
          const card = that.data.cardNumber.find(item=>item.userId==that.data.userId);
          if (card && card.cardNumber) {
            // 格式化卡号为****+后四位
            const rawCard = card.cardNumber.toString();
            const maskedCard = '*'.repeat(Math.max(0, rawCard.length - 4)) + rawCard.slice(-4);
            card.maskedCard = maskedCard; // 新增掩码字段
          }
          that.setData({
            card: card
          })
        }else{
          wx.showToast({
            title: '获取卡号失败',
          })
        }
      },
      fail:(error)=>{
        console.log("获取请求失败:"+error);
        wx.showToast({
          title: '请求失败,请稍后再试',
        })
      }
    });
  },
  onShow: function() {
    // 页面显示时的逻辑
  },

  onSearchTap: function() {
    wx.navigateTo({
      url: '/pages/wallet/search',
    });
  },

  // 显示充值面板
  showRecharge() {
    wx.showModal({
      title: '充值金额',
      editable: true,
      placeholderText: '请输入充值金额',
      success: (res) => {
        console.log(res)
        if (res.confirm) {
          const amount = Number(res.content);
          if (!isNaN(amount) && amount > 0) {
            this.showPaymentMethod(amount);
          } else {
            wx.showToast({
              title: '请输入有效金额',
              icon: 'none'
            });
          }
        }
      }
    });
  },
// 在充值确认方法中添加金额累加逻辑
confirmRecharge() {
  const rechargeAmount = parseFloat(this.data.rechargeAmount);
  if (!isNaN(rechargeAmount) && rechargeAmount > 0) {
    const newAmount = this.data.money + rechargeAmount;
    this.setData({
      money: Number(newAmount.toFixed(2)), // 保留两位小数并转为数值类型
      showRechargePopup: false
    });
    // 这里可以添加金额更新到服务器的逻辑
  }
},
// 新增充值相关方法


rechargeInput(e) {
  this.setData({ rechargeAmount: e.detail.value });
},

// 弹窗关闭回调（保持已有代码结构）
onCloseRecharge() {
  this.setData({ showRechargePopup: false });
},
  // 显示支付方式选择
  showPaymentMethod(amount) {
    wx.showActionSheet({
      itemList: this.data.paymentMethods,
      success: (res) => {
        console.log(res);
        if (!res.cancel) {
          this.handleRecharge(amount, this.data.paymentMethods[res.tapIndex]);
        }
      }
    });
  },

  // 处理充值请求
  handleRecharge(amount, paymentMethod) {
    wx.showLoading({
      title: '充值中...',
    });
    
    const currentDate = new Date();
    const formattedDate = `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, '0')}-${String(currentDate.getDate()).padStart(2, '0')}`;

    request({
      url: 'member/topup',
      method: 'POST',
      data: {
        rechargeMoney: amount,
        rechargeMode: paymentMethod,
        rechargeData: formattedDate,
        userId: this.data.userId
      },
      success: (res) => {
        wx.hideLoading();
        if (res && res.code === 200) {
          const newMoney=(Number(this.data.money)+amount).toFixed(2);
          this.setData({
            money: Number(newMoney),
          })
          const user = wx.getStorageSync('wxuser');
          user.money=newMoney;
          wx.setStorageSync('wxuser', user);
          wx.showToast({
            title: '充值成功',
            icon: 'success'
          });
          // 刷新钱包余额和交易记录
          this.getWallet();
        
          this.getAllTransactions();
          
        } 
      },
      fail: (error) => {
        wx.hideLoading();
        console.error('充值失败:', error);
        wx.showToast({
          title: '充值失败，请稍后重试',
          icon: 'none'
        });
      }
    });
  },
  viewAllTransactions: function() {
    wx.navigateTo({
      url: '/pages/walletMany/walletMany',
    });
  },

  viewTransactionDetail: function(e) {
    const id = e.currentTarget.dataset.id;
    const transaction = this.data.transactions.find(t => t.id === id);
    if (transaction) {
      wx.navigateTo({
        url: `/pages/wallet/transactionDetail?id=${id}`,
      });
    }
  }
}) 
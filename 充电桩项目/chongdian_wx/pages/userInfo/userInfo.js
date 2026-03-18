import request from '../../utils/request.js'
Page({
    data: {
        avatarSrc: '',
        birthDate: '',
        name: '',
        address: '',
        phone: '',
        password: '',
        confirmPassword: '',
        isFormComplete: false,
        email: '' // 补充 email 字段
    },

    onLoad: function (options) {
        // options 是一个对象，包含了传递过来的所有参数
        if (options.email) {
            // 将接收到的 email 参数存储到 data 中
            this.setData({
                email: options.email
            });
        }
    },

    onDateChange: function (e) {
        this.setData({
            birthDate: e.detail.value
        });
        this.checkFormComplete();
    },

    onInputChange: function (e) {
        const {
            field
        } = e.currentTarget.dataset;
        this.setData({
            [field]: e.detail.value
        });
        this.checkFormComplete();
    },

    checkFormComplete: function () {
        const {
            name,
            birthDate,
            address,
            phone,
            password,
            confirmPassword,
            email
        } = this.data;
        const isComplete = name && birthDate && address && phone && password && confirmPassword && email;
        this.setData({
            isFormComplete: isComplete
        });
    },

    onNextStep: function () {
        const {
            name,
            birthDate,
            address,
            phone,
            password,
            confirmPassword,
            email
        } = this.data;
        // 手机号验证
        if (!/^1[3-9]\d{9}$/.test(phone)) {
            wx.showToast({
                title: '请输入正确的手机号',
                icon: 'none'
            });
            return;
        }

        // 密码验证
        if (password.length < 6) {
            wx.showToast({
                title: '密码长度不能少于6位',
                icon: 'none'
            });
            return;
        }

        // 确认密码验证
        if (password !== confirmPassword) {
            wx.showToast({
                title: '两次输入的密码不一致',
                icon: 'none'
            });
            return;
        }

        // 表单验证通过，可以提交数据
        // 调用接口保存用户信息
        request({
            url: 'wxregister/register',
            method: 'GET',
            header: {
                'Content-Type': 'application/json'
            },
            data: {
                name: this.data.name,
                birthday: this.data.birthDate,
                address: this.data.address,
                phoneNum: this.data.phone, // 后端使用 phoneNum 作为手机号字段
                password: this.data.password,
                email: this.data.email,
                avatar: this.data.avatarSrc
            },
            success: (res) => {
                console.log(res)
                if (res.statusCode === 200) {
                    wx.setStorageSync('usernaem', )
                    wx.showToast({
                        title: '注册成功',
                        icon: 'success'
                    });
                    // 跳转
                    wx.navigateTo({
                        url: '/pages/login/login'
                    });
                } else {
                    wx.showToast({
                        title: res.data.message || '注册失败',
                        icon: 'none'
                    });
                }
            },
            fail: (err) => {
                wx.showToast({
                    title: `网络错误: ${err.errMsg}，请稍后重试`,
                    icon: 'none'
                });
                console.error('注册失败：', err);
            }
        });
    },

    chooseAvatar: function () {
        wx.chooseImage({
            count: 1,
            sizeType: ['compressed'],
            sourceType: ['album', 'camera'],
            success: (res) => {
                this.setData({
                    avatarSrc: res.tempFilePaths[0]
                });
                this.checkFormComplete();
            }
        });
    },

    // 下拉刷新
    onPullDownRefresh() {
        // 重置表单数据
        this.setData({
            avatarSrc: '',
            birthDate: '',
            name: '',
            address: '',
            phone: '',
            password: '',
            confirmPassword: '',
            isFormComplete: false,
            email: ''
        });

        // 停止下拉刷新动画
        wx.stopPullDownRefresh();
    }
});
// 引入request对象
import request from '../../utils/request.js'

// 邮箱格式验证函数
function validateEmail(email) {
    const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
    return emailRegex.test(email);
}

Page({
    data: {
        email: '', // 邮箱账号
        verifyCode: '', // 邮箱验证码
        agreePolicy: false,
        isFocused: false, // 输入框聚焦状态
        countdown: 0, // 倒计时计时器
        timer: null, // 计时器引用
    },

    // 返回上一页
    goBack: function () {
        wx.navigateBack();
    },

    // 邮箱输入事件处理
    onEmailInput: function (e) {
        this.setData({
            email: e.detail.value // 更新邮箱数据
        });
    },

    // 验证码输入事件处理
    onVerifyCodeInput: function (e) {
        this.setData({
            verifyCode: e.detail.value
        });
    },

    // 输入框聚焦事件处理
    onFocus: function () {
        this.setData({
            isFocused: true
        });
    },

    // 输入框失焦事件处理
    onBlur: function () {
        this.setData({
            isFocused: false
        });
    },

    // 切换同意隐私政策状态
    toggleAgreePolicy: function () {
        this.setData({
            agreePolicy: !this.data.agreePolicy
        });
    },

    // 跳转到隐私政策页面
    goToPrivacyPolicy: function () {
        // 导航到隐私政策页面
        wx.navigateTo({
            url: '/pages/policy/policy' // 替换为实际的政策页面路径
        });
    },

    // 发送验证码
    sendVerifyCode() {
        const { email } = this.data;

        if (!email) {
            wx.showToast({
                title: '请输入邮箱账号',
                icon: 'none'
            });
            return;
        }

        if (!validateEmail(email)) {
            wx.showToast({
                title: '邮箱格式不正确',
                icon: 'none'
            });
            return;
        }

        // 清除现有计时器
        if (this.data.timer) {
            clearInterval(this.data.timer);
        }

        // 开始倒计时
        this.setData({
            countdown: 60
        });

        const timer = setInterval(() => {
            if (this.data.countdown > 0) {
                this.setData({
                    countdown: this.data.countdown - 1
                });
            } else {
                clearInterval(timer);
                this.setData({
                    timer: null
                });
            }
        }, 1000);

        request({
            url: "member/sendEmail",
            method: 'GET',
            data: {
                email
            },
            success: () => {
                // 显示成功消息
                wx.showToast({
                    title: '验证码已发送',
                    icon: 'success'
                });
                this.setData({
                    timer
                });
                // 通常在这里会调用API发送验证码
                console.log('Sending verification code to:', email);
            },
            fail: (err) => {
                console.error('发送验证码失败:', err);
                wx.showToast({
                    title: '发送验证码失败',
                    icon: 'none'
                });
            },
            complete: () => {
                // 可添加完成后的操作
            }
        });
    },

    // 页面卸载时清除计时器
    onUnload: function () {
        if (this.data.timer) {
            clearInterval(this.data.timer);
        }
    },

    // 下一步操作
    nextStep() {
        const { email, verifyCode, agreePolicy } = this.data;

        if (!email) {
            wx.showToast({
                title: '请输入邮箱账号',
                icon: 'none'
            });
            return;
        }

        if (!validateEmail(email)) {
            wx.showToast({
                title: '邮箱格式不正确',
                icon: 'none'
            });
            return;
        }

        if (!verifyCode) {
            wx.showToast({
                title: '请输入验证码',
                icon: 'none'
            });
            return;
        }

        if (!agreePolicy) {
            wx.showToast({
                title: '请同意隐私政策',
                icon: 'none'
            });
            return;
        }

        request({
            url: "wxregister/registerByEmail",
            method: 'GET',
            data: {
                email,
                code: verifyCode
            },
            success: (e) => {
                if (e.data.code === 500) {
                    wx.showToast({
                        title: "验证码错误"
                    });
                }
                if (e.data.code === 200) {
                    // 提示注册成功
                    wx.showToast({
                        title: '注册成功'
                    });
                    wx.navigateTo({
                        url: `/pages/userInfo/userInfo?email=${email}` // 传递邮箱参数
                    });
                }
            },
            fail: (err) => {
                console.error('注册失败:', err);
                wx.showToast({
                    title: '注册失败',
                    icon: 'none'
                });
            },
            complete: () => {
                // 可添加完成后的操作
            }
        });
    }
});    
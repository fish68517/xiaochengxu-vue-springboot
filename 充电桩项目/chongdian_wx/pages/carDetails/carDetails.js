import request from '../../utils/request.js'
Page({
    data: {
        userId:'',
        carBrands: [],
        carModels: [],
        carRanges: ['715KM', '500KM', '600KM'],
        selectedBrand: '请选择品牌',
        selectedModel: '请选择型号',
        selectedRange: '请选择续航'
    },
    onLoad: function (e) {
        const user = wx.getStorageSync('wxuser')
        // console.log(user)
        this.setData({
            userId:user.id
        })
        // console.log(this.data.userId)
        // 获取车辆品牌列表
        request({
            url: 'car/carbrand/list',
            method: 'GET',
            data: {},
            success: (res) => {
                // console.log(res.data.rows)
                if (res.data && res.data.rows) {
                    const carBrands = res.data.rows.map(element => element.brand);
                    this.setData({
                        carBrands
                    });
                }
            }
        });
    },
    onBrandChange: function (e) {
        this.setData({
            selectedBrand: this.data.carBrands[e.detail.value]
        });
        // 获取车型列表
        request({
            url: 'car/carmodel/list?spare1='+this.data.selectedBrand,
            method: 'GET',
            success: (res) => {
                // console.log(res.data.rows)
                if (res.data && res.data.rows) {
                    const carModels = res.data.rows.map(element => element.carModel);
                    this.setData({
                        carModels
                    });
                }
            }
        });
    },
    tohome: function () {
        wx.showToast({
            title: '完善成功',
            icon: 'success'
        });
    },
    onModelChange: function (e) {
        this.setData({
            selectedModel: this.data.carModels[e.detail.value]
        });
    },
    onRangeChange: function (e) {
        this.setData({
            selectedRange: this.data.carRanges[e.detail.value]
        });
    },
    confirmAddition: function () {
        if (this.data.selectedBrand === '请选择品牌' ||
            this.data.selectedModel === '请选择型号' ||
            this.data.selectedRange === '请选择续航') {
            wx.showModal({
                title: '提示',
                content: '请先选择所有选项',
                showCancel: false
            });
        } else {
            // Add navigation logic here
            request({
                url: 'member/usercar',
                method: 'post',
                data: {
                   userId:this.data.userId,
                   carBrand:this.data.selectedBrand,
                    carModel:this.data.selectedModel,
                    mileage:this.data.selectedRange
                },
                success: (res) => {
                        wx.navigateTo({
                        url: '/pages/permission/permission'
                    });
                }
            });
        }
    }
});
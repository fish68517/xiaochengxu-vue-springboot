import request from '../../utils/request.js'
Page({
    data: {
        carBrands: [],
        carModels: [],
        carRanges: ['715KM', '500KM', '600KM'],
        selectedBrand: '',
        selectedModel: '',
        selectedRange: ''
    },
    onClickLeft: function () {
        wx.navigateBack()
      },
    onLoad: function (e) {
        const user = wx.getStorageSync('wxuser')
        //页面加载获取用户车辆信息
        request({
            url: 'member/usercar/list',
            method: 'GET',
            data: {
                userId:user.id
            },
            success: (res) => {
            //    console.log(res.data.rows[0])
                this.setData({
                    selectedBrand:res.data.rows[0].carBrand,
                    selectedModel:res.data.rows[0].carModel,
                    selectedRange:res.data.rows[0].mileage,
                })
            }
        });
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
            //根据userId修改车辆信息
            const user = wx.getStorageSync('wxuser')
            request({
                url: 'member/usercar',
                method: 'PUT',
                data:{
                    userId:user.id,
                    carBrand:this.data.selectedBrand,
                    carModel:this.data.selectedModel,
                    mileage:this.data.selectedRange,
                },
                success: (res) => {
                    wx.showToast({
                        title: '修改成功',
                        icon: 'success'
                    });
                }
            });
        }
    }
});
import request from '../../utils/request.js'
Page({
  data: {
    cars: [],
    carbrand: [],
    carsMap: []
  },

  goBack() {
    wx.navigateBack();
  },

  addCar() {
    wx.showToast({
      title: '添加车辆功能开发中',
      icon: 'none'
    });
  },

  selectCar(e) {
    const selectedCarId = e.currentTarget.dataset.car.id;
    const cars = this.data.cars.map(car => ({
      ...car,
      selected: car.id === selectedCarId
    }));
    this.setData({
      cars
    });
  },

  onNextStep() {
    const selectedCar = this.data.cars.find(car => car.selected);
    if (!selectedCar) {
      wx.showToast({
        title: '请选择您的车辆',
        icon: 'none'
      });
      return;
    }

    const brand = this.data.carsMap[selectedCar.carBrandId] || '';
    const model = selectedCar.carModel || '';
    const image = selectedCar.modelImage || '';
    wx.setStorage({
      key: 'carData',
      data: {
        carId: selectedCar.id,
        brand: brand,
        model: model,
        image: image
      }
    });
    wx.navigateTo({
      url: '/pages/charge-calculate/index'
    });
  },

  onLoad() {
    this.getCarModelList();
    this.getCarList();
  },

  getCarModelList() {
    const that = this;
    request({
      url: 'car/carmodel/list',
      method: "GET",
      success(res) {
        if (res.data && res.data.rows) {
          that.setData({
            cars: res.data.rows
          })
        } else {
          wx.showToast({
            title: '获取车辆信息失败',
          });
        }
      },
      fail: (err) => {
        console.log("请求失败", err); // 打印错误信息
        wx.showToast({
          title: '请求失败，请稍后再试',
        });
      }
    })
  },

  getCarList() {
    const that = this;
    request({
      url: 'car/carbrand/list',
      method: 'GET',
      success(res) {
        if (res.data && res.data.rows) {
          const carbrandList = res.data.rows;
          that.setData({
            carbrand: carbrandList
          });

          const map = {};
          for (let i = 0; i < carbrandList.length; i++) {
            const item = carbrandList[i];
            map[item.id] = item.brand;
          }

          that.setData({
            carsMap: map
          });


        } else {
          wx.showToast({
            title: '获取车辆失败',
            icon: 'none'
          });
        }
      },
      fail(err) {
        console.log("请求失败", err);
        wx.showToast({
          title: '请求失败，请稍后再试',
          icon: 'none'
        });
      }
    });
  }

});
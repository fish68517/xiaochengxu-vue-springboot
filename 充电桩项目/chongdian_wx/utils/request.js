// 封装request请求
export default function (config) {
    // 如果本地有数据，则需要携带token
    
    const mytoken = wx.getStorageSync('token')
    if (mytoken) {
        config.header = {
            "Authorization": mytoken
        }
    } else { // 默认如果没有登录时，也可以操作其他功能
        config.header={ // 使用若依的超管登录后获取的token来测并使用
        "Authorization":'eyJhbGciOiJIUzUxMiJ9.eyJzdWIiOiJhZG1pbiIsImxvZ2luX3VzZXJfa2V5IjoiNDRiMGM5YjgtN2I3MS00YmI5LWE2Y2UtOGIyZTQ3NzkxMmJjIn0.JJhUu_REnypMLI-IjoyHbcXAOClcMjgv_T-S4OgjZNLccA5FjPBDXQImL4Z2rorthjAJyRtvqalTSdYoeXAVTw'
        }
      }
    wx.request({
        url: "http://localhost:8080/" + config.url,
        method: config.method,
        data: config.data,
        header: config.header,
        success: config.success
    })
}
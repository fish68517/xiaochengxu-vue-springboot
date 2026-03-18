"use strict";
const common_vendor = require("../vendor.js");
const common_config = require("../config.js");
function normalizeHeaders(headers = {}) {
  const token = common_vendor.index.getStorageSync(common_config.TOKEN_KEY);
  if (token) {
    return {
      ...headers,
      Authorization: token
    };
  }
  return headers;
}
function request(options) {
  return new Promise((resolve, reject) => {
    common_vendor.index.request({
      url: `${common_config.API_BASE_URL}/${options.url.replace(/^\//, "")}`,
      method: options.method || "GET",
      data: options.data || {},
      header: normalizeHeaders(options.header),
      success: (res) => {
        const payload = res.data || {};
        if (payload.code === 200 || payload.code === void 0) {
          resolve(payload);
          return;
        }
        const msg = payload.msg || `请求失败(${payload.code})`;
        reject(new Error(msg));
      },
      fail: (err) => {
        reject(new Error(err.errMsg || "网络异常"));
      }
    });
  });
}
function post(url, data, header) {
  return request({ url, method: "POST", data, header });
}
function get(url, data, header) {
  return request({ url, method: "GET", data, header });
}
exports.get = get;
exports.post = post;

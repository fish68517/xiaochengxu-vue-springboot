"use strict";
const common_http_request = require("../common/http/request.js");
function loginByPhone(phoneNumber, password) {
  return common_http_request.post(`loginPhone?phoneNumber=${encodeURIComponent(phoneNumber)}&password=${encodeURIComponent(password)}`);
}
function loginByEmail(email, code) {
  return common_http_request.post(`loginEmail?email=${encodeURIComponent(email)}&code=${encodeURIComponent(code)}`);
}
function sendEmailCode(email) {
  return common_http_request.get("member/sendEmail", { email });
}
function getPhoneInfo() {
  return common_http_request.get("getPhoneInfo");
}
exports.getPhoneInfo = getPhoneInfo;
exports.loginByEmail = loginByEmail;
exports.loginByPhone = loginByPhone;
exports.sendEmailCode = sendEmailCode;

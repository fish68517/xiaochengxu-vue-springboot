"use strict";
const common_vendor = require("../../common/vendor.js");
const common_config = require("../../common/config.js");
const api_auth = require("../../api/auth.js");
const _sfc_main = {
  data() {
    return {
      activeTab: "phone",
      phone: "",
      password: "",
      email: "",
      code: "",
      countdown: 0,
      timer: null,
      loading: false,
      baseUrl: common_config.API_BASE_URL
    };
  },
  onLoad() {
    const token = common_vendor.index.getStorageSync(common_config.TOKEN_KEY);
    if (token) {
      common_vendor.index.reLaunch({ url: "/pages/home/index" });
    }
  },
  onUnload() {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  },
  methods: {
    async handlePhoneLogin() {
      if (!this.phone || !this.password) {
        common_vendor.index.showToast({ title: "请输入手机号和密码", icon: "none" });
        return;
      }
      this.loading = true;
      common_vendor.index.showLoading({ title: "登录中..." });
      try {
        const loginRes = await api_auth.loginByPhone(this.phone.trim(), this.password);
        const token = loginRes.token;
        if (!token) {
          throw new Error("登录成功但未返回 token");
        }
        common_vendor.index.setStorageSync(common_config.TOKEN_KEY, token);
        const userRes = await api_auth.getPhoneInfo();
        common_vendor.index.setStorageSync(common_config.USER_KEY, userRes.wxuser || {});
        common_vendor.index.reLaunch({ url: "/pages/home/index" });
      } catch (error) {
        common_vendor.index.showToast({ title: error.message || "登录失败", icon: "none" });
      } finally {
        this.loading = false;
        common_vendor.index.hideLoading();
      }
    },
    async handleSendCode() {
      if (!this.email) {
        common_vendor.index.showToast({ title: "请输入邮箱", icon: "none" });
        return;
      }
      if (this.countdown > 0)
        return;
      this.loading = true;
      try {
        await api_auth.sendEmailCode(this.email.trim());
        common_vendor.index.showToast({ title: "验证码已发送", icon: "success" });
        this.startCountdown();
      } catch (error) {
        common_vendor.index.showToast({ title: error.message || "发送失败", icon: "none" });
      } finally {
        this.loading = false;
      }
    },
    async handleEmailLogin() {
      if (!this.email || !this.code) {
        common_vendor.index.showToast({ title: "请输入邮箱和验证码", icon: "none" });
        return;
      }
      this.loading = true;
      common_vendor.index.showLoading({ title: "登录中..." });
      try {
        const loginRes = await api_auth.loginByEmail(this.email.trim(), this.code.trim());
        const token = loginRes.token;
        if (!token) {
          throw new Error("登录成功但未返回 token");
        }
        common_vendor.index.setStorageSync(common_config.TOKEN_KEY, token);
        const userRes = await api_auth.getPhoneInfo();
        common_vendor.index.setStorageSync(common_config.USER_KEY, userRes.wxuser || {});
        common_vendor.index.reLaunch({ url: "/pages/home/index" });
      } catch (error) {
        common_vendor.index.showToast({ title: error.message || "登录失败", icon: "none" });
      } finally {
        this.loading = false;
        common_vendor.index.hideLoading();
      }
    },
    startCountdown() {
      this.countdown = 60;
      if (this.timer) {
        clearInterval(this.timer);
      }
      this.timer = setInterval(() => {
        this.countdown -= 1;
        if (this.countdown <= 0) {
          clearInterval(this.timer);
          this.timer = null;
          this.countdown = 0;
        }
      }, 1e3);
    }
  }
};
function _sfc_render(_ctx, _cache, $props, $setup, $data, $options) {
  return common_vendor.e({
    a: $data.activeTab === "phone" ? 1 : "",
    b: common_vendor.o(($event) => $data.activeTab = "phone", "f4"),
    c: $data.activeTab === "email" ? 1 : "",
    d: common_vendor.o(($event) => $data.activeTab = "email", "3e"),
    e: $data.activeTab === "phone"
  }, $data.activeTab === "phone" ? {
    f: $data.phone,
    g: common_vendor.o(($event) => $data.phone = $event.detail.value, "e4"),
    h: $data.password,
    i: common_vendor.o(($event) => $data.password = $event.detail.value, "ef"),
    j: common_vendor.o((...args) => $options.handlePhoneLogin && $options.handlePhoneLogin(...args), "a9"),
    k: $data.loading
  } : {
    l: $data.email,
    m: common_vendor.o(($event) => $data.email = $event.detail.value, "a0"),
    n: $data.code,
    o: common_vendor.o(($event) => $data.code = $event.detail.value, "16"),
    p: common_vendor.t($data.countdown > 0 ? `${$data.countdown}s` : "发送验证码"),
    q: common_vendor.o((...args) => $options.handleSendCode && $options.handleSendCode(...args), "ac"),
    r: $data.countdown > 0 || $data.loading,
    s: common_vendor.o((...args) => $options.handleEmailLogin && $options.handleEmailLogin(...args), "15"),
    t: $data.loading
  }, {
    v: common_vendor.t($data.baseUrl)
  });
}
const MiniProgramPage = /* @__PURE__ */ common_vendor._export_sfc(_sfc_main, [["render", _sfc_render], ["__scopeId", "data-v-45258083"]]);
wx.createPage(MiniProgramPage);

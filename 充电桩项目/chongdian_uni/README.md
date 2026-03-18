# chongdian_uni

uni-app (Vue3 + Vite) 版小程序前端，面向毕业设计精简场景。

## 当前已完成

- 登录
  - 手机号 + 密码登录（`/loginPhone`）
  - 邮箱 + 验证码登录（`/member/sendEmail` + `/loginEmail`）
  - 登录后获取用户信息（`/getPhoneInfo`）
- 首页
  - 充电站地图展示（`/chargingstation/chongdianzhan/list`）
  - 评分汇总（`/chargingstation/stationgrade/list`）
  - 搜索、定位、站点选中
  - 一键推荐预约（简化版）：按“距离 + 评分”排序推荐
- 请求封装
  - 统一 baseURL
  - 自动携带 token
  - 统一错误处理

## 毕业设计简化说明

已主动删减复杂功能，不做遗传算法/跨区域补贴等高复杂策略，替换为可讲清楚、可演示的简化版本：

1. 预约匹配：采用多因子打分（距离、评分）进行快速推荐。
2. 负载调度：本阶段仅保留“推荐和错峰提示入口”，不实现复杂实时全局调度。

这样更符合毕业设计答辩的可实现性与稳定性。

## 环境要求

- Node.js 18+（你当前是 v22，可用）
- 本机后端：`http://127.0.0.1:8080`

## 安装与运行

```bash
npm install
```

### 1) 微信小程序构建

```bash
npm run build:mp-weixin
```

构建产物目录：

```text
dist/build/mp-weixin
```

然后打开微信开发者工具，导入 `dist/build/mp-weixin`。

### 2) 微信小程序开发模式（推荐）

```bash
npm run dev:mp-weixin
```

开发产物目录：

```text
dist/dev/mp-weixin
```

### 3) H5 调试（可选）

```bash
npm run dev:h5
```

### 4) 手机局域网直接访问（不部署）

开发模式（热更新）：

```bash
npm run dev:h5:lan
```

打包后本地静态服务：

```bash
npm run build:h5
npm run serve:h5:lan
```

然后手机访问：

```text
http://<你电脑的局域网IP>:5173
```

说明：前端已改为 H5 自动使用当前访问主机的 `:8080` 作为后端地址，所以只要你通过局域网 IP 访问前端，接口会自动请求同一台机器的 `8080`。

## VS Code 插件建议

- 安装 `uniapp` / `uni-helper` 系列插件（用于语法提示与项目识别）
- 启动方式仍建议用终端脚本（`npm run dev:mp-weixin`）

## 目录结构

```text
src/
  api/
    auth.js
    station.js
  common/
    config.js
    http/request.js
  pages/
    login/index.vue
    home/index.vue
  static/marker.png
  App.vue
  main.js
  pages.json
  manifest.json
```

## 常见问题

1. 真机无法请求 `127.0.0.1`
   - 真机调试时请把 `src/common/config.js` 的地址改成你电脑局域网 IP（如 `http://192.168.1.10:8080`）。
2. 定位失败
   - 需在微信开发者工具里开启定位模拟或授权定位。

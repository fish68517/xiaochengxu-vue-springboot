# Vue 到 uni-app 移动端改造清单与方案

## 1. 结论

当前 `vue` 目录不是移动端项目，而是一个典型的 `Vue 3 + Vue Router + Pinia + Element Plus + Axios + ECharts` Web 项目，入口、路由、组件体系和存储方式都偏浏览器端实现。

从代码结构看，这个项目应该拆成两类处理：

- `user` 端页面适合改造成 `uni-app` 移动端。
- `admin` / `merchant` 端页面不适合直接 1:1 搬到手机端，建议保留为现有 Web 后台，或者后续单独做移动版运营页。

建议的主策略不是“逐个把 `el-*` 标签替换成 `uni-*`”，而是：

1. 保留业务接口、数据字段、业务流程。
2. 重写页面结构、导航方式、交互方式和样式体系。
3. 先完成用户端闭环，再决定是否做商家端和后台移动化。

## 2. 当前代码现状分析

### 2.1 技术栈现状

当前依赖集中在 Web 端体系：

- `vue-cli-service` 构建，见 `vue/package.json`
- `element-plus` 组件库，见 `vue/package.json`
- `vue-router` Web 路由，见 `vue/package.json`
- `axios` 请求封装，见 `vue/package.json`
- `echarts + vue-echarts` 图表，见 `vue/package.json`

关键证据：

- `vue/src/main.js` 直接 `app.use(ElementPlus)`，并通过 `app.mount('#app')` 启动，这不是 `uni-app` 入口模式。
- `vue/src/router/index.js` 使用 `createWebHistory()`，属于浏览器路由。
- `vue/src/api/networkApi.js` 大量依赖 `localStorage` 和 `ElMessage`。

### 2.2 页面结构现状

路由按角色分成三块：

- 用户端：`/user/home`、`/user/cart`、`/user/orders`、`/user/profile`、`/user/favorites`、`/user/recommend`
- 管理端：`/admin/dashboard`、`/admin/users`、`/admin/recipes`、`/admin/orders`、`/admin/reviews`
- 商家端：`/merchant/recipes`、`/merchant/orders`

当前 `user` 端也仍然是 Web 侧边栏布局，不是移动端页面流：

- `vue/src/views/user/Layout.vue` 使用 `el-container + el-aside + el-menu + router-view`

当前 `admin` / `merchant` 端明显是 PC 管理后台结构：

- `vue/src/views/admin/Recipes.vue` 使用表格、分页、弹窗表单、上传
- `vue/src/views/admin/Dashboard.vue` 使用统计卡片、图表、表格
- `vue/src/views/merchant/Layout.vue` 也是左侧菜单布局

### 2.3 直接影响 uni-app 迁移的技术点

以下内容必须改：

| 现状 | 位置 | 问题 | uni-app 方案 |
|---|---|---|---|
| `app.mount('#app')` | `vue/src/main.js` | 浏览器挂载方式 | 改为 `uni-app` 标准入口 |
| `createWebHistory()` | `vue/src/router/index.js` | 浏览器路由，不适用于 `uni-app` | 改为 `pages.json + navigateTo/switchTab` |
| `Element Plus` 全量组件 | 多数页面 | `uni-app` 不能直接复用 | 改为原生 `uni-app` 组件或 `uni-ui` |
| `localStorage` | `router/index.js`、`networkApi.js`、`stores/user.js` | 依赖浏览器存储 | 改为 `uni.setStorageSync / uni.getStorageSync` |
| `ElMessage / ElMessageBox` | 多数页面 | 浏览器消息组件 | 改为 `uni.showToast / uni.showModal` |
| `axios` 拦截器 + Web 习惯 | `networkApi.js` | 需要兼容 App/H5/小程序 | 改为 `uni.request` 封装 |
| `el-upload` | `admin/Recipes.vue`、`user/Profile.vue` | Web 上传组件 | 改为 `uni.chooseImage + uni.uploadFile` |
| `el-table / el-pagination / el-dialog` | 管理端页面 | 典型 PC 交互 | 改为列表卡片、上拉加载、独立编辑页 |
| `vue-echarts` | `admin/Dashboard.vue` | 需要额外适配移动端 Canvas | 改为 `qiun-data-charts` 或 `uCharts` |
| 大量固定像素布局 | `Home.vue`、`Layout.vue`、`Profile.vue` 等 | 不适合手机屏幕 | 改为 rpx、flex、滚动容器 |

## 3. 迁移时必须先处理的风险点

### 3.1 图片地址硬编码

`vue/src/utils/image.js` 里把图片地址写死成：

- `BASE_URL = 'http://localhost:8089'`
- `BASE_RESOURCE_URL = '/image/pet/'`

这在 `uni-app` 真机、H5、打包 App、甚至局域网联调时都会出问题。必须改成：

- 按环境读取 API 域名
- 图片基础地址统一从配置文件读取
- 不再写死 `localhost`

### 3.2 接口前缀不统一

`vue/src/api/networkApi.js` 里整体 `baseURL` 已经是 `'/api'`，但 `commentApi` 又写了 `/api/comments/...`，会产生双前缀风险：

- `baseURL: '/api'`
- `url: '/api/comments'`

迁移时必须先统一接口封装规范：

- 业务模块函数只写资源路径，例如 `/comments`
- 基础域名和 `/api` 前缀只在请求层处理一次

### 3.3 当前源码存在乱码表现

本次读取中，多处中文字符串显示为乱码。迁移前建议先确认：

- 所有 `.vue`、`.js` 文件统一为 `UTF-8`
- 接口返回字段和数据库字符集保持一致
- 打包链路不再混用 GBK/UTF-8

否则迁移后在 H5、App、小程序多端上会更难定位问题。

## 4. 建议的整体改造策略

### 4.1 总原则

- 只复用业务逻辑，不复用 Web 结构。
- 用户端先迁移，后台端后处理。
- 把“请求、鉴权、图片、存储”先抽成公共层，再改页面。
- 把“表格页、弹窗页”改成“列表页、详情页、编辑页”。

### 4.2 推荐技术选型

建议 `uni-app` 端采用：

- UI：原生 `uni-app` 组件 + `uni-ui`
- 请求：自封装 `uni.request`
- 状态：Pinia 可保留，或先保留简单 store
- 图表：`qiun-data-charts` 或 `uCharts`
- 上传：`uni.chooseImage` + `uni.uploadFile`

不建议继续沿用：

- `Element Plus`
- `vue-router`
- `vue-echarts`
- 依赖浏览器 DOM 或浏览器存储的写法

## 5. 页面迁移建议

### 5.1 适合优先迁移到 uni-app 的页面

| 当前页面 | 当前文件 | 建议的 uni-app 页面 | 迁移建议 | 优先级 |
|---|---|---|---|---|
| 登录 | `vue/src/views/Login.vue` | `pages/auth/login.vue` | 重写为移动端登录页，保留登录接口 | 高 |
| 注册 | `vue/src/views/Register.vue` | `pages/auth/register.vue` | 重写为移动端表单页 | 高 |
| 首页 | `vue/src/views/user/Home.vue` | `pages/home/index.vue` | 轮播、分类、菜品列表改为手机卡片流 | 高 |
| 菜品详情 | `vue/src/views/recipe/Detail.vue` | `pages/recipe/detail.vue` | 图片、步骤、评价列表改成纵向滚动页 | 高 |
| 购物车 | `vue/src/views/user/Cart.vue` | `pages/cart/index.vue` | 列表卡片 + 底部结算栏 | 高 |
| 订单 | `vue/src/views/user/Orders.vue` | `pages/orders/index.vue` | 按状态筛选，卡片式订单列表 | 高 |
| 收藏 | `vue/src/views/user/Favorites.vue` | `pages/favorites/index.vue` | 列表页即可，支持取消收藏与快捷下单 | 中 |
| 推荐 | `vue/src/views/user/RecommendRecipe.vue` | `pages/recommend/index.vue` | 可独立页面，也可合并到首页 | 中 |
| 个人中心 | `vue/src/views/user/Profile.vue` | `pages/profile/index.vue` | 拆成“展示页 + 编辑页”更适合手机 | 高 |

### 5.2 不建议第一阶段直接迁移的页面

| 当前页面 | 当前文件 | 原因 | 建议 |
|---|---|---|---|
| 用户布局页 | `vue/src/views/user/Layout.vue` | 左侧菜单模式是 PC 导航 | 改为 `tabBar` |
| 管理后台仪表盘 | `vue/src/views/admin/Dashboard.vue` | 图表 + 表格 + 多列卡片，PC 强依赖 | 先保留 Web |
| 用户管理 | `vue/src/views/admin/Users.vue` | 表格与批量管理典型后台场景 | 先保留 Web |
| 菜品管理 | `vue/src/views/admin/Recipes.vue` | 表格、分页、弹窗编辑、上传均需重写 | 若要做移动商家端，应拆分成列表页和编辑页 |
| 订单管理 | `vue/src/views/admin/Orders.vue` | PC 管理列表模式 | 先保留 Web |
| 评价管理 | `vue/src/views/admin/Reviews.vue` | 后台审核场景更适合 PC | 先保留 Web |
| 商家布局页 | `vue/src/views/merchant/Layout.vue` | 左侧菜单模式不适合移动端 | 后续单独设计商家端移动导航 |

### 5.3 用户端页面如何改造

#### 登录/注册

当前问题：

- 依赖 `el-form`、`el-input`、`el-radio-group`
- 用 `router.push()` 跳转
- 用 `ElMessage` 提示

改造建议：

- 表单改成 `uni-forms + uni-easyinput`
- 跳转改成 `uni.navigateTo` / `uni.reLaunch`
- 登录成功后根据角色决定入口
- 如果移动端只面向普通用户，登录页可以直接去掉管理员与商家选项

#### 首页

当前问题：

- `el-carousel`、`el-row/el-col`、`el-card`、`el-scrollbar` 都是 Web 组件模式
- 图片区域宽度写死，`hot-image` 有超大固定宽度
- 使用 `setInterval` 轮询窗口排队人数

改造建议：

- 轮播改成 `swiper`
- 分类改成横向滚动 `scroll-view`
- 菜品列表改成双列卡片流或单列瀑布流
- 排队人数轮询建议进入页面后开始，离开页面停止
- 搜索和分类可以收拢为顶部搜索栏 + 横向分类栏

#### 菜品详情

当前问题：

- 使用 `el-card`、`el-rate`、`el-avatar`
- 评论删除依赖 `ElMessageBox.confirm`

改造建议：

- 详情页做成长页面：头图、基础信息、食材、步骤、评价、底部购买栏
- 评论操作改成底部弹层或操作菜单
- “加入购物车”固定在底部吸附栏

#### 购物车

当前问题：

- `el-checkbox`、`el-input-number`、`el-select` 是桌面风格
- 备注模板写在页面内部

改造建议：

- 单项卡片 + 数量步进器 + 底部结算栏
- 备注模板改为弹出选择器
- 全选/反选保留，但交互要更轻量

#### 订单

当前问题：

- 当前只是简单卡片列表，但仍然是 Web 组件写法

改造建议：

- 顶部加状态筛选 `全部/待支付/已支付/已完成/已取消`
- 每个订单做成卡片
- 支付、取消使用 `uni.showModal`
- 订单详情可拆独立页面

#### 个人中心

当前问题：

- 表单项多、字段多、布局多列
- 有 BMI、口味偏好、上传头像、饮食限制等复杂录入

改造建议：

- 拆成两个页面：
- `pages/profile/index.vue`：展示页
- `pages/profile/edit.vue`：编辑页
- 头像上传改 `chooseImage + uploadFile`
- 多选项改底部弹层选择，不要在一个页面里堆很多 `select`

## 6. 组件替换清单

| Web 写法 | 当前用途 | uni-app 建议 |
|---|---|---|
| `el-card` | 卡片容器 | `view` + 自定义卡片样式 |
| `el-form` | 表单 | `uni-forms` |
| `el-form-item` | 表单项 | `uni-forms-item` |
| `el-input` | 输入框 | `uni-easyinput` |
| `el-input-number` | 数量/数值输入 | 自定义步进器或数字输入 |
| `el-select` | 下拉选择 | `uni-data-select` / `uni-popup` + 自定义列表 |
| `el-radio-group` | 单选 | `uni-data-checkbox` / 自定义单选组 |
| `el-checkbox` | 多选 | `checkbox-group` |
| `el-button` | 按钮 | `button` / `uni-button` |
| `el-image` | 图片 | `image` |
| `el-carousel` | 轮播 | `swiper` |
| `el-dialog` | 弹窗 | `uni-popup` |
| `el-table` | 表格 | 卡片列表，移动端不要继续用表格思路 |
| `el-pagination` | 分页 | 触底加载 / 加载更多 |
| `el-upload` | 上传 | `uni.chooseImage` + `uni.uploadFile` |
| `ElMessage` | 提示 | `uni.showToast` |
| `ElMessageBox.confirm` | 确认弹窗 | `uni.showModal` |
| `router.push()` | 跳转 | `uni.navigateTo` / `uni.switchTab` / `uni.reLaunch` |
| `localStorage` | 本地存储 | `uni.getStorageSync` / `uni.setStorageSync` |

## 7. 建议的 uni-app 目录结构

建议在 `uniapp` 目录下按下面方式组织：

```text
uniapp/
  App.vue
  main.js
  manifest.json
  pages.json
  uni.scss
  api/
    request.js
    modules/
      user.js
      recipe.js
      cart.js
      order.js
      review.js
      favorite.js
      recommend.js
      window.js
  store/
    user.js
  utils/
    auth.js
    storage.js
    image.js
    toast.js
  components/
    recipe-card.vue
    order-card.vue
    empty-state.vue
    page-loading.vue
  pages/
    auth/
      login.vue
      register.vue
    home/
      index.vue
    recipe/
      detail.vue
    cart/
      index.vue
    orders/
      index.vue
      detail.vue
    favorites/
      index.vue
    recommend/
      index.vue
    profile/
      index.vue
      edit.vue
```

建议 `tabBar` 页面只保留四个：

- 首页
- 购物车
- 订单
- 我的

收藏、推荐、详情、登录、注册都作为普通页面。

## 8. 公共层改造清单

### 8.1 请求层

目标：

- 把 `axios` 改为统一 `uni.request` 封装
- 统一处理 token、错误提示、超时、基础域名

要做的事：

- 建 `api/request.js`
- 拦截请求头，自动带 `Authorization`
- 统一响应格式处理
- 区分开发环境、测试环境、生产环境 API 域名

### 8.2 鉴权层

目标：

- 替换浏览器守卫为页面级守卫

要做的事：

- `token`、`userInfo` 改存 `uni` storage
- 封装 `checkLogin()`
- 对需要登录的页面在 `onShow` 或跳转前校验
- 登录成功后按角色决定首页

### 8.3 图片与上传

目标：

- 去掉固定 `localhost`
- 支持真机上传与访问

要做的事：

- 提供统一 `getImageUrl()`
- 上传统一走 `uni.uploadFile`
- 上传成功后只存后端返回相对路径或完整 URL

### 8.4 提示与弹窗

目标：

- 去掉 Element Plus 的消息体系

要做的事：

- `showSuccess()`、`showError()` 封装为工具函数
- 删除、退出登录、取消订单统一走 `uni.showModal`

## 9. 分阶段实施方案

### 第一阶段：搭建 uni-app 基座

目标：

- 建立可运行的 `uni-app` 项目骨架
- 完成请求、存储、鉴权、图片工具

产出：

- `pages.json`
- `manifest.json`
- `api/request.js`
- `store/user.js`
- `utils/storage.js`
- `utils/image.js`

### 第二阶段：迁移用户核心闭环

目标：

- 打通用户端主链路

优先顺序：

1. 登录
2. 首页
3. 菜品详情
4. 加入购物车
5. 购物车结算
6. 订单列表

完成这阶段后，移动端已经可用。

### 第三阶段：补齐用户增强功能

目标：

- 补齐非核心能力

范围：

- 收藏
- 推荐
- 个人中心
- 头像上传
- BMI 和饮食偏好编辑

### 第四阶段：评估商家端和后台

建议：

- 后台继续保留现有 Web
- 商家端如果一定要上手机，单独做一套移动交互，不要直接套用后台页

## 10. 详细改造清单

以下清单可以直接作为实施 TODO：

- [ ] 创建 `uniapp` 项目基础结构
- [ ] 新建 `pages.json` 和 `manifest.json`
- [ ] 建立 `tabBar` 导航结构
- [ ] 把 `router` 逻辑改为 `uni` 页面跳转
- [ ] 把 `localStorage` 全量替换为 `uni` storage
- [ ] 把 `axios` 改为 `uni.request` 封装
- [ ] 统一 token 注入和失效处理
- [ ] 统一错误提示与确认弹窗
- [ ] 统一图片地址配置
- [ ] 统一上传实现为 `uni.uploadFile`
- [ ] 登录页改造
- [ ] 注册页改造
- [ ] 首页改造
- [ ] 菜品详情页改造
- [ ] 购物车页改造
- [ ] 订单列表页改造
- [ ] 收藏页改造
- [ ] 推荐页改造
- [ ] 个人中心展示页改造
- [ ] 个人资料编辑页改造
- [ ] 页面样式全部改为移动端尺寸体系
- [ ] 替换所有 Element Plus 依赖
- [ ] 替换图表库或保留后台 Web 图表
- [ ] 修正 `commentApi` 双前缀问题
- [ ] 修正图片地址硬编码问题
- [ ] 统一源码文件编码为 UTF-8
- [ ] 真机调试网络、上传、图片显示
- [ ] H5、App、小程序三端回归测试

## 11. 是否建议把后台也改成 uni-app

不建议在第一阶段这样做。

原因很直接：

- 你当前后台是标准 PC 管理系统模型。
- `el-table`、分页、弹窗编辑、统计图表，本质上不适合手机端。
- 就算技术上可以改，最终交互效率也会明显下降。

更合理的做法：

- 用户端改成 `uni-app`
- 管理后台继续保留现有 `vue` Web
- 商家端如果有明确移动办公场景，再单独设计一套轻量页面

## 12. 推荐最终落地方式

推荐你按下面的项目形态推进：

- `vue/`：继续作为后台管理与商家管理 Web 端
- `uniapp/`：新建移动端用户 App / H5 / 小程序
- `SpringBoot/`：继续复用现有后端接口

这样改造成本最低，风险也最低。

如果后续要真正开始代码迁移，建议从下面 4 个页面先做：

1. 登录
2. 首页
3. 菜品详情
4. 购物车

这 4 个页面完成后，主流程基本就通了。

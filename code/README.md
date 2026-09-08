# 游戏服务多端平台

面向游戏行业的多品牌服务交易平台：**客户小程序/H5 + Web 工作台 + H5 管理端 + uniCloud 云函数 + 本地镜像后端**。

- 开发任务、阶段和验收口径：见仓库同级文档包中的 `开发任务计划.md`；
- 现有交接资料：`docs/技术交接文档.txt`、`docs/外包交接说明.txt`、`docs/需求.txt`；
- 发布门禁、staging 证据和回滚顺序：`docs/第三阶段发布与回滚清单.md`；
- 第一阶段验证证据：执行验证后生成在 `TestEvidence/`。

## 技术栈
uniCloud 腾讯云目录结构 + uni-app Vue3 + 微信小程序 + H5。云空间、AppID、支付参数及密钥均由部署环境注入，不在 README 固定生产值。

## 目录
```
packages/domain/        核心领域逻辑（TDD，纯函数）
apps/client/            客户小程序 + H5 动态下单页（uni-app Vue3）
apps/workbench/         客服/接单 Web 工作台（uni-app H5）
apps/admin/             管理端（uni-app H5）
uniCloud-tcb/           腾讯云服务空间（云函数 + 数据库 schema）
docs/                   当前交接、需求与审计说明
config/brands/          非敏感品牌构建变量
TestEvidence/           本地验证生成物（运行验证后创建）
```

## 开发纪律
- TDD：先写测试并确认失败，再实现并通过。
- 领域逻辑单一源：规则只写在 `packages/domain/src/*.js`，`uniCloud-tcb/cloudfunctions/game-service/lib/domain.cjs` 由 `node scripts/build-domain.mjs` 构建生成（部署脚本会先构建再上传），禁止手改。
- 禁止过度开发。
- 未通过真实测试前禁止声明功能完成。
- 本地/Mock 证据与真实云环境、真实微信支付证据分开标注。

## 测试
```powershell
npm run check:js
npm run typecheck
npm test
npm run verify:domain
npm run build:all
npm run e2e:api
npm run e2e:ui
```

UI 冒烟首次运行前安装 Playwright 浏览器；若未安装 Chromium，脚本会依次尝试本机 Edge/Chrome：

```powershell
npx playwright install chromium
```

## 启动 / 构建 / 部署

- 依赖安装：根目录与三个 `apps/*` 各自 `npm install`（三端为 uni-app Vue3，需 `@dcloudio/*` 依赖）。
- 领域单一源构建（部署与域同步校验前都会执行，禁止手改产物）：
  ```bash
  node scripts/build-domain.mjs            # 生成 uniCloud-tcb/cloudfunctions/game-service/lib/domain.cjs
  node scripts/verify-domain-sync.mjs      # 校验 domain.cjs 与 packages/domain 导出一致
  ```
- 本地镜像 HTTP API（三端 H5 联调用，等价云函数 game-service）：
  ```bash
  node scripts/api-server.mjs              # 默认 127.0.0.1:4176，--seed 填充演示数据
  ```
- 三端 H5 构建（产物输出到各自 `dist/build/h5`）：
  ```bash
  npm run build:h5 --prefix apps/client
  npm run build:h5 --prefix apps/workbench
  npm run build:h5 --prefix apps/admin
  ```
- 部署（需配置 `HX_CLI`/`UNICLOUD_SPACE`/`UNICLOUD_PROVIDER` 环境变量，详见脚本内注释）：
  ```bash
  node scripts/deploy-unicloud.mjs         # 云函数 + 数据库 schema（部署前自动构建 domain.cjs）
  node scripts/deploy-hosting.mjs client   # 客户域：web-view H5 下单/浏览（前缀 /）
  node scripts/deploy-hosting.mjs backend  # 后台域：workbench /workbench/ + admin /admin/
  node scripts/verify-hosting.mjs          # 双域托管健康检查
  ```
- 一键验证与 UI 证据采集：
  ```powershell
  npm run verify:all                        # lint/domain/test/四套构建/API/UI，证据落 TestEvidence/
  npm run e2e:api                           # 镜像 HTTP 全链路冒烟
  npm run e2e:ui                            # Playwright 客户端与工作台交互截图
  npm run build:brand -- --brand demo-a --platform h5
  npm run build:brand -- --brand demo-b --platform h5
  npm run verify:brand-matrix
  npm run release:preflight -- --environment development
  npm run migrate:phase2 -- --input backup.json              # 默认 dry-run
  npm run migrate:phase2 -- --input backup.json --write migrated.json
  ```

当前根测试套件为 217 项，本地 API 与云函数均为 104 个 action。第三阶段管理模块、环境门禁、品牌矩阵和回滚工具已完成本地/Mock 增量开发；真实云空间、微信支付/退款、出款渠道、域名与小程序审核仍需在 staging/production 阶段另行验证，本地构建或 Mock 冒烟不替代真实环境验收。

# 在 Git Bash 中运行 `uniapp/` 的步骤和流程

## 1. 先说明当前项目类型

当前仓库里的 [uniapp](E:\项目\uniapp-springboot-mysql\uniapp) 目录不是 `Vue CLI` / `Vite` 风格的 `uni-app` 命令行项目。

判断依据：

- 目录下没有 `package.json`
- 目录下没有 `node_modules`
- 目录下没有 `vite.config.js` / `vite.config.ts`
- 当前结构是典型的 `HBuilderX` 工程：`App.vue`、`pages.json`、`manifest.json`、`uni.scss`

这意味着：

- 你可以在 `Git Bash` 里进入项目、修改代码、启动后端、打开工程
- 但不能直接在当前 `uniapp/` 目录执行 `npm install`、`npm run dev`、`npx uni` 这类命令
- 当前项目的推荐运行方式是：`Git Bash + HBuilderX`

## 2. 运行前准备

需要具备下面几个条件：

- 已安装 `Git Bash`
- 已安装 `HBuilderX`
- 已启动 MySQL
- 已启动当前项目的 `SpringBoot`

后端默认地址是：

- `http://localhost:8089`

前端当前配置文件是：

- [config.js](E:\项目\uniapp-springboot-mysql\uniapp\utils\config.js)

当前默认配置：

```js
export const HOST_BASE_URL = 'http://localhost:8089'
export const API_BASE_URL = `${HOST_BASE_URL}/api`
export const IMAGE_BASE_URL = `${HOST_BASE_URL}/image/pet/`
```

如果你是：

- 本机 H5 调试：保持 `localhost` 即可
- 手机真机调试：必须把 `localhost` 改成你电脑的局域网 IP，例如 `http://192.168.1.10:8089`

## 3. Git Bash 中的标准运行流程

### 第一步：进入项目根目录

```bash
cd /e/项目/uniapp-springboot-mysql
```

### 第二步：启动 SpringBoot 后端

如果你使用 Maven Wrapper：

```bash
cd SpringBoot
./mvnw spring-boot:run
```

如果 `Git Bash` 下执行 `./mvnw` 有问题，也可以切到 Windows 命令方式：

```bash
cd /e/项目/uniapp-springboot-mysql/SpringBoot
./mvnw.cmd spring-boot:run
```

启动成功后，确认接口可访问：

```bash
curl http://localhost:8089/api/recommend/hot
```

只要返回 JSON，说明后端正常。

### 第三步：回到项目根目录

```bash
cd /e/项目/uniapp-springboot-mysql
```

### 第四步：确认前端接口地址

检查这个文件：

- [config.js](E:\项目\uniapp-springboot-mysql\uniapp\utils\config.js)

如果是本机浏览器运行 H5：

```js
export const HOST_BASE_URL = 'http://localhost:8089'
```

如果是手机或模拟器运行：

```js
export const HOST_BASE_URL = 'http://你的电脑局域网IP:8089'
```

### 第五步：在 Git Bash 中打开 HBuilderX

有两种常用方式。

方式 A：直接启动 HBuilderX

```bash
"/c/Program Files/HBuilderX/HBuilderX.exe"
```

方式 B：如果你的安装目录不在 `C:\Program Files`，改成实际路径

```bash
"/d/HBuilderX/HBuilderX.exe"
```

如果你希望从 Git Bash 里直接打开当前工程所在目录，也可以先执行：

```bash
explorer.exe "$(pwd)/uniapp"
```

然后在 HBuilderX 里导入该目录。

## 4. HBuilderX 中如何运行当前 `uniapp/`

HBuilderX 打开后：

1. 选择“文件 -> 导入 -> 从本地目录导入”
2. 选择目录 [uniapp](E:\项目\uniapp-springboot-mysql\uniapp)
3. 导入完成后，等待 HBuilderX 识别工程

然后根据你的目标环境运行：

### 运行 H5

1. 点击“运行 -> 运行到浏览器 -> Chrome”
2. 或点击工具栏的运行按钮，选择 H5

适用场景：

- 本机接口地址是 `localhost`
- 调试页面布局、接口请求、登录注册、购物车、下单、评价

### 运行到手机或模拟器

1. 点击“运行 -> 运行到手机或模拟器”
2. 选择真机、模拟器或自定义基座

适用场景：

- 需要测试移动端交互
- 需要验证 `uni-app` 在手机端的表现

注意：

- 真机运行时，前端不能再用 `localhost:8089`
- 必须改成电脑局域网 IP

## 5. 一次完整启动示例

### 窗口 1：Git Bash 启动后端

```bash
cd /e/项目/uniapp-springboot-mysql/SpringBoot
./mvnw spring-boot:run
```

### 窗口 2：Git Bash 打开 HBuilderX

```bash
cd /e/项目/uniapp-springboot-mysql
"/c/Program Files/HBuilderX/HBuilderX.exe"
```

### 窗口 3：可选，测试接口是否通

```bash
curl http://localhost:8089/api/recommend/hot
```

然后在 HBuilderX 中：

1. 打开 [uniapp](E:\项目\uniapp-springboot-mysql\uniapp)
2. 运行到 H5
3. 访问登录页
4. 依次测试登录、注册、菜品、购物车、下单、评价

## 6. 常见问题

### 1. 为什么不能直接 `npm run dev`

因为当前 [uniapp](E:\项目\uniapp-springboot-mysql\uniapp) 不是命令行版 `uni-app` 项目，没有 `package.json`。

### 2. Git Bash 能不能单独完成前端启动

对当前这个项目，不能完全替代 HBuilderX。

Git Bash 负责：

- 进入目录
- 启动后端
- 检查接口
- 打开 HBuilderX

真正的 `uni-app` 编译和运行，还是由 HBuilderX 完成。

### 3. H5 能访问，真机不能访问

通常是接口地址问题。

检查：

- [config.js](E:\项目\uniapp-springboot-mysql\uniapp\utils\config.js) 是否还是 `localhost`
- 手机和电脑是否在同一局域网
- 电脑防火墙是否拦截 `8089`

### 4. 图片加载失败

检查：

- `IMAGE_BASE_URL` 是否可访问
- 后端图片目录是否正常
- 手机端是否仍在使用 `localhost`

## 7. 如果你坚持要纯命令行运行

那就不是“直接运行当前工程”了，而是需要把当前 [uniapp](E:\项目\uniapp-springboot-mysql\uniapp) 再改造成 `uni-app CLI / Vite` 项目。

也就是说要额外做这类工作：

- 新建带 `package.json` 的 `uni-app` CLI 工程
- 把当前页面、接口层、配置迁进去
- 配置 `npm run dev:h5` 或 `pnpm dev:h5`

这属于下一阶段改造，不是当前这份工程的原生运行方式。

## 8. 当前项目最实用的结论

对于你这个仓库，最稳妥的运行方式就是：

1. 用 `Git Bash` 启动 `SpringBoot`
2. 用 `Git Bash` 打开 `HBuilderX`
3. 在 `HBuilderX` 中运行 [uniapp](E:\项目\uniapp-springboot-mysql\uniapp)
4. 本机 H5 调试用 `localhost`
5. 真机调试把接口地址改成局域网 IP


可以，但不是在手机浏览器里输入 `localhost`。

你需要做的是：

1. 让手机和电脑连接同一个局域网。
2. 把 [config.js](E:\项目\uniapp-springboot-mysql\uniapp\src\utils\config.js) 里的
   `http://localhost:8089`
   改成你电脑的局域网 IP，比如：
   `http://192.168.1.23:8089`
3. 启动前端时不要只绑 `127.0.0.1`，要让它对局域网开放：

```bash
cd /e/项目/uniapp-springboot-mysql/uniapp
npm run dev:h5 -- --host 0.0.0.0
```

4. 手机浏览器里访问你电脑的前端地址，例如：
   `http://192.168.1.23:5173/`

其中：
- `192.168.1.23` 是你电脑在当前 Wi‑Fi 下的 IP
- `5173` 是 Vite 默认端口
- 后端仍然是 `8089`

你可以先在电脑上查本机 IP：
```bash
ipconfig
```

看 `IPv4 Address` 那一项。

还要注意两点：
- Windows 防火墙可能会拦截 `5173` 和 `8089`
- SpringBoot 也必须正常启动，否则手机只能打开前端壳子，请求不到数据

如果你要，我可以下一步直接帮你把 [config.js](E:\项目\uniapp-springboot-mysql\uniapp\src\utils\config.js) 改成“自动区分本机和手机访问”的写法。
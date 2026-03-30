# uniapp 改造成 CLI / Vite 后的运行说明

## 1. 当前状态

当前 [uniapp](E:\项目\uniapp-springboot-mysql\uniapp) 已改造成 `uni-app CLI / Vite` 项目。

可以直接通过下面命令启动 H5：

```bash
cd /e/项目/uniapp-springboot-mysql/uniapp
npm install
npm run dev:h5
```

## 2. 目录结构

源码现在位于：

- [src](E:\项目\uniapp-springboot-mysql\uniapp\src)

CLI / Vite 根文件位于：

- [package.json](E:\项目\uniapp-springboot-mysql\uniapp\package.json)
- [vite.config.js](E:\项目\uniapp-springboot-mysql\uniapp\vite.config.js)
- [index.html](E:\项目\uniapp-springboot-mysql\uniapp\index.html)

## 3. 启动步骤

### 第一步：启动后端

先启动 SpringBoot：

```bash
cd /e/项目/uniapp-springboot-mysql/SpringBoot
./mvnw spring-boot:run
```

如果 Git Bash 下 `./mvnw` 不可用：

```bash
./mvnw.cmd spring-boot:run
```

后端默认地址：

- `http://localhost:8089`

### 第二步：启动 uniapp H5

新开一个 Git Bash 窗口：

```bash
cd /e/项目/uniapp-springboot-mysql/uniapp
npm install
npm run dev:h5
```

启动成功后会看到类似输出：

```bash
Local: http://127.0.0.1:5173/
```

然后浏览器打开：

- [http://127.0.0.1:5173/](http://127.0.0.1:5173/)

## 4. 前端接口配置

接口配置文件：

- [config.js](E:\项目\uniapp-springboot-mysql\uniapp\src\utils\config.js)

当前默认值：

```js
export const HOST_BASE_URL = 'http://localhost:8089'
export const API_BASE_URL = `${HOST_BASE_URL}/api`
export const IMAGE_BASE_URL = `${HOST_BASE_URL}/image/pet/`
```

适用场景：

- 本机 H5 调试：保持 `localhost`
- 手机真机调试：改成电脑局域网 IP

## 5. 常用命令

安装依赖：

```bash
cd /e/项目/uniapp-springboot-mysql/uniapp
npm install
```

启动 H5 开发环境：

```bash
npm run dev:h5
```

打包 H5：

```bash
npm run build:h5
```

## 6. 已验证结果

当前项目已经完成以下验证：

- `npm install` 成功
- `npm run build:h5` 成功
- `npm run dev:h5` 成功启动

## 7. 注意事项

### 1. 不再通过 HBuilderX 运行

当前 `uniapp` 已经具备 CLI 运行能力，H5 调试直接使用：

```bash
npm run dev:h5
```

### 2. 依赖安装时间较长

首次执行 `npm install` 会安装较多 `@dcloudio/*` 依赖，属于正常现象。

### 3. Sass 会有兼容性警告

当前构建能正常通过，但会出现 `sass @import` 的弃用警告，不影响当前运行。


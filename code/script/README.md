# 本地运行脚本

在 `code` 目录打开 PowerShell：

```powershell
powershell -ExecutionPolicy Bypass -File .\script\start-local.ps1
```

第一次运行且依赖尚未安装：

```powershell
powershell -ExecutionPolicy Bypass -File .\script\start-local.ps1 -InstallDependencies
```

启动后自动打开三个网页：

```powershell
powershell -ExecutionPolicy Bypass -File .\script\start-local.ps1 -OpenBrowser
```

停止全部由该脚本启动的服务：

```powershell
powershell -ExecutionPolicy Bypass -File .\script\stop-local.ps1
```

## 手机通过同一 WiFi 访问客户 H5

请以管理员身份打开 PowerShell，然后运行：

```powershell
powershell -ExecutionPolicy Bypass -File .\script\start-lan-demo.ps1
```

脚本会自动识别本机 WiFi IPv4 地址，将客户 H5 和本地 API 监听到局域网，并创建仅允许本地子网访问 `5173`、`4176` 的 Windows 防火墙规则。

如果自动识别的网卡不正确，可以明确指定：

```powershell
powershell -ExecutionPolicy Bypass -File .\script\start-lan-demo.ps1 -LanIp 192.168.2.185
```

手机地址不能使用 `127.0.0.1`；`127.0.0.1` 在手机上代表手机自身。以电脑当前地址为例，客户分类页为：

```text
http://192.168.2.185:5173/#/pages/category/index
```

出于安全考虑，工作台和管理后台仍只监听电脑本机。停止命令与普通本地运行相同。

固定地址：

- 客户 H5：`http://127.0.0.1:5173/#/pages/index/index`
- 客服/接单工作台：`http://127.0.0.1:5174/workbench/#/pages/login/index`
- 管理后台：`http://127.0.0.1:5175/admin/#/pages/login/index`
- 本地 API：`http://127.0.0.1:4176`

日志位于 `code/.runtime/local-dev/logs`。本地 API 使用内存数据，停止服务后业务数据不会保留。

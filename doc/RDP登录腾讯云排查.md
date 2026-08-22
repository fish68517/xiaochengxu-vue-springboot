# RDP 登录腾讯云排查与安全修复

## 1. 本次结论

根据根目录 `腾讯云服务器登录失败排查.txt` 和当前本机实测，**现有证据不支持“本机 Windows 的 RDP 客户端坏了”**，最初不能登录的主要证据指向腾讯云服务器当时没有建立 RDP 监听器。

排查记录中最关键的两行是：

```text
qwinsta 无 rdp-tcp Listen
netstat 无 3389 LISTENING
```

RDP 必须由服务器端的 `rdp-tcp` 监听器接收连接。微软官方排查标准同样要求 `qwinsta` 中出现 `rdp-tcp ... Listen`，并要求服务器的 3389 端口处于 `LISTENING` 状态。

当前本机检查结果：

| 检查项目 | 结果 | 说明 |
|---|---:|---|
| `mstsc.exe` | 正常 | 本机自带远程桌面客户端存在，版本 `10.0.26100.1710` |
| 到服务器 TCP 3389 | 成功 | `Test-NetConnection` 返回 `TcpTestSucceeded=True` |
| 强制从 WLAN 地址连接 3389 | 成功 | 排除当前无线网络不能直达服务器 |
| 本机 RDP 禁用策略 | 未发现 | 没有发现会禁止该连接的客户端策略 |
| 该服务器的缓存凭据 | 未发现 | 没有找到对应 `TERMSRV` 已保存凭据 |
| 本机防火墙出站阻断 | 未发现 | 当前没有证据表明本机防火墙阻止 3389 |
| `CMYNetwork / Meta Tunnel` | 存在 | 当前默认流量可能经过代理隧道，但直连 WLAN 测试也成功，所以暂不能认定它是故障原因 |

因此，当前不应重装本机、关闭安全功能、重置整个网络、卸载代理或修改全局防火墙。这些操作影响面大，并且与已有证据不符。

另外，原排查记录使用的用户名是 `Admin`。腾讯云轻量应用服务器 Windows 实例的默认管理员用户名是 **`Administrator`**；只有在服务器中确实创建过 `Admin` 用户时才可使用 `Admin`。用户名错误会表现为凭据无法通过，但不会导致 3389 端口不监听。

参考：

- [Microsoft：Remote Desktop 无法连接的排查方法](https://learn.microsoft.com/en-us/troubleshoot/windows-server/remote/remote-desktop-cannot-connect-remote-computer)
- [腾讯云：轻量应用服务器 Windows 远程桌面无法连接](https://cloud.tencent.com/document/product/1207/72285)
- [腾讯云：Windows 实例默认用户名为 Administrator](https://cloud.tencent.com/document/product/1207/44569)

## 2. 先尝试最简单、无副作用的登录方法

在本机按 `Win + R`，执行：

```text
mstsc /admin
```

填写：

```text
计算机：<服务器公网IP>
用户名：Administrator
密码：腾讯云控制台中设置或重置的实例密码
```

不要继续使用排查记录中的 `Admin`，除非已经通过 TAT 执行 `Get-LocalUser`，确认服务器确实存在并启用了该账户。

如果提示密码错误，先在腾讯云控制台重置 `Administrator` 密码。不要把密码写入 Markdown、脚本、Git 或 RDP 文件。根目录的原排查文本已经包含明文凭据，建议在确认登录后立即重置密码，并删除或安全保管原文件。

## 3. 本机一键检查并连接脚本

项目中已经提供：

```text
deploy\windows\rdp-client-check.ps1
```

普通 PowerShell 即可运行，不需要管理员权限：

```powershell
cd 'E:\bishe27\小程序\电梯维修'

powershell -NoProfile -ExecutionPolicy Bypass `
  -File '.\deploy\windows\rdp-client-check.ps1' `
  -ServerAddress '<服务器公网IP>'
```

脚本只会做以下事情：

1. 检查本机 `mstsc.exe`。
2. 检查目标 TCP 3389。
3. 在 `%LOCALAPPDATA%\ElevatorRdp` 生成仅针对该服务器的 RDP 文件。
4. 固定使用 `Administrator` 并打开远程桌面。
5. 不保存密码、不关闭防火墙、不重置网络、不修改其他软件和其他 RDP 连接。

如果怀疑以前保存过错误凭据，可以只清理该服务器的凭据：

```powershell
powershell -NoProfile -ExecutionPolicy Bypass `
  -File '.\deploy\windows\rdp-client-check.ps1' `
  -ServerAddress '<服务器公网IP>' `
  -ResetSavedCredential
```

该修复在本机重启后不会失效：生成的 RDP 文件和检查脚本都保留在磁盘中，也不依赖临时注册表修改。以后双击生成的 `.rdp` 文件，或者再次运行脚本即可。

## 4. 如果本机重启后再次不能登录

先运行以下命令，不要先重置网络：

```powershell
Test-NetConnection -ComputerName '<服务器公网IP>' -Port 3389 -InformationLevel Detailed
```

### 结果一：`TcpTestSucceeded=True`

说明本机到服务器端口可达。此时重点检查：

1. 用户名必须优先使用 `Administrator`。
2. 在腾讯云控制台重置实例密码。
3. 删除该服务器的旧凭据后重试：

```powershell
cmdkey /delete:TERMSRV/<服务器公网IP>
```

4. 使用管理会话：

```powershell
mstsc /admin /v:<服务器公网IP>:3389
```

### 结果二：`TcpTestSucceeded=False`

这只能说明当前端口不可达，不能直接认定本机损坏。依次检查：

1. 腾讯云实例是否正在运行。
2. 轻量应用服务器防火墙是否放行 TCP 3389。
3. 使用 TAT/OrcaTerm 检查服务器是否真的监听 3389。
4. 暂停 `CMYNetwork / Meta Tunnel` 后只测试一次。如果暂停后恢复，应在该代理软件中为服务器公网 IP 添加“直连”规则；不要卸载代理、不要重置全部网卡。
5. 换手机热点测试一次，用于区分当前路由器/运营商与电脑问题。

本机没有必要注册开机自动执行的网络重置任务。因为这类任务会改变全部网卡、DNS 或 Winsock，可能影响代理、虚拟机、开发环境和其他软件，不符合“不能影响其他功能”的要求。

## 5. 使用 TAT 修复服务器 RDP 监听器

由于原记录明确出现服务器没有 `rdp-tcp Listen`，应优先通过腾讯云 TAT 在**服务器端**修复。项目中提供：

```text
deploy\windows\repair-rdp-server.ps1
```

先把脚本上传到服务器，例如：

```text
C:\elevator-service\tools\repair-rdp-server.ps1
```

然后在 TAT 中执行：

```powershell
powershell -NoProfile -ExecutionPolicy Bypass `
  -File 'C:\elevator-service\tools\repair-rdp-server.ps1' `
  -Port 3389 `
  -InstallStartupSelfHeal
```

这个脚本会：

1. 先导出备份服务器的 `RDP-Tcp` 注册表项。
2. 恢复允许远程连接、启用监听器和端口 3389 的配置。
3. 确保 `TermService`、`UmRdpService` 正常运行。
4. 仅新增一条 TCP 3389 入站规则，不关闭服务器防火墙。
5. 重启远程桌面服务并检查监听状态。
6. 注册 `Elevator-RDP-SelfHeal` 开机任务，服务器每次重启后自动检查和恢复上述配置。
7. 将结果写入：

```text
C:\elevator-service\logs\rdp-self-heal.log
```

该任务仅修复服务器 RDP 配置，不会重置网络、不修改 Web 服务端口，也不会修改项目数据库或 Nginx。

如果本地公网 IP 是固定地址，可以把服务器入站范围缩小到本机公网 IP：

```powershell
powershell -NoProfile -ExecutionPolicy Bypass `
  -File 'C:\elevator-service\tools\repair-rdp-server.ps1' `
  -Port 3389 `
  -AllowedRemoteAddress '<本机公网IP>' `
  -InstallStartupSelfHeal
```

如果本机公网 IP 经常变化，暂时保持默认 `Any`，但必须使用强密码，并优先在腾讯云防火墙中限制来源。

## 6. TAT 修复后的验收命令

在服务器 TAT PowerShell 中执行：

```powershell
qwinsta
netstat -ano | findstr :3389
Get-Service TermService,UmRdpService
Get-ScheduledTask -TaskName 'Elevator-RDP-SelfHeal'
Get-Content 'C:\elevator-service\logs\rdp-self-heal.log' -Tail 30
```

必须看到：

```text
rdp-tcp ... Listen
0.0.0.0:3389 ... LISTENING
TermService Running
Elevator-RDP-SelfHeal Ready（或 Running）
```

本机再次执行：

```powershell
Test-NetConnection -ComputerName '<服务器公网IP>' -Port 3389
```

应看到：

```text
TcpTestSucceeded : True
```

## 7. 仍无监听时不要盲目修改注册表

如果脚本执行后仍然没有 `rdp-tcp Listen`，可能是 `RDP-Tcp` 注册表项损坏、远程桌面自签名证书异常、RDS 角色冲突或系统组件损坏。此时：

1. 先为腾讯云服务器创建快照。
2. 查看服务器事件查看器中的 `TermService` 和 `TerminalServices-*` 日志。
3. 不要从不同 Windows 版本复制 `RDP-Tcp` 注册表项。
4. 微软建议仅从**相同 Windows 版本的正常服务器**导出并替换该项，或联系腾讯云/微软支持。
5. 继续使用 TAT/OrcaTerm 管理服务器，避免因错误注册表修改彻底失去远程入口。

微软明确提醒，错误修改注册表可能导致严重问题，因此本项目脚本在 `RDP-Tcp` 项完全缺失时会停止，而不是猜测并创建该项。

## 8. 最终判断顺序

```text
本机 Test-NetConnection 3389
├─ True
│  ├─ 能出现登录框：检查 Administrator 和密码
│  └─ 仍立即断开：检查服务器事件、证书、RDS角色
└─ False
   ├─ TAT 中也无 LISTENING：修复服务器 RDP 监听器
   ├─ TAT 有 LISTENING：检查腾讯云防火墙/来源IP
   └─ 换热点可连接：为 Meta Tunnel/代理添加该IP直连规则
```

本次本机实测为 `True`，所以当前优先动作是：使用 `Administrator` 登录；若仍失败，执行服务器端自修复脚本并查看日志，而不是重置本机 Windows 网络。

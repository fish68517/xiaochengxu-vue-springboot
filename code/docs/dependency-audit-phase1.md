# 第一阶段依赖审计记录

审计日期：2026-08-31

执行命令：根目录及 `apps/client`、`apps/workbench`、`apps/admin` 分别运行 `npm audit --omit=dev --json`。

| 目录 | low | moderate | high | critical | 处理结论 |
|---|---:|---:|---:|---:|---|
| 根目录 | 0 | 0 | 0 | 0 | 无生产依赖漏洞 |
| apps/client | 11 | 9 | 11 | 0 | 31 项均位于 uni-app 构建依赖链；不在第一阶段强制升级框架 |
| apps/workbench | 9 | 2 | 9 | 0 | 20 项，直接修复建议涉及 Vite 或 uni-app/uni-h5 的主版本变化 |
| apps/admin | 9 | 2 | 9 | 0 | 20 项，直接修复建议涉及 Vite 或 uni-app/uni-h5 的主版本变化 |

本阶段已经完成 ESLint、205 项测试、四套构建和 API/UI 冒烟的回归基线。审计建议中的 uni-app/uni-h5 主版本升级会同时影响 H5、小程序编译器和运行时，超出安全补丁范围，因此没有执行 `npm audit fix --force`。后续在独立升级分支中升级 DCloud/Vite 工具链，并以四套构建、页面冒烟和真实微信开发者工具回归作为合入门槛。

当前结论仅表示已识别并隔离风险，不表示这些传递依赖漏洞已经清零。生产发布前必须重新审计并根据当时的官方兼容矩阵处理。

# T3 Code 本机定制维护

当前源码根是 `/Users/peiwenyang/Development/t3code`，本地维护分支为 `codex/desktop-zh-v0.1.2`，基于官方 `v0.1.2`，本机已安装并完成客户端验收；已发布的 `desktop-zh-v0.1.1` 保留上一版。中文回复显示、SSH 慢链路修复、中文 UI 仍为独立功能提交。操作入口与当前状态见 [中文定制版维护](../../docs/operations/desktop-zh.md)。

本目录保存维护脚本和历史补丁；构建、下载、日志、应用副本与迁移回执统一在项目 `out/`。2026-10-21 从原 `tmp` / `tencent-hermes` 迁入的 11 项资料保留原位置 symlink，完整内容与权限校验记录在 `out/upgrade-0.1.1-20261021/probe/migration.json`。历史文档仍记载当时路径，兼容链接继续有效。SSH 配置与密钥没有迁入本仓库。

## 组装 macOS 定制应用

[`scripts/assemble-macos.mjs`](scripts/assemble-macos.mjs) 以已校验的官方同版本应用为底包，只替换本项目编译出的 `apps/desktop/dist-electron` 和 `apps/web/dist`。它保留官方服务端、Electron 与原生运行文件，校验 unpack 文件集合和未修改文件的 hash，更新 ASAR integrity，再签署本机 ad-hoc 签名并严格验证。

主程序重新签名后，嵌入签名及其 Mach-O 分配长度会变化；助手单独规范化这些字段，校验其余程序内容的 hash。其他原生运行文件仍逐字节检查。

助手参数为 `--official-app`、`--expected-asar-sha256`、`--output` 和 `--evidence`，使用绝对路径或相对仓库根的路径。本轮 `0.1.2` 官方 ASAR SHA256 是 `0468a385f93ec672d554c301c6a12ad0014b08df8ab93def19a33082fac9d44d`，候选输出为 `out/upgrade-0.1.2-20261023/artifacts/T3 Code (Beta).app`。

先完成维护文档中的构建和验证。助手拒绝覆盖已有输出，仅在 `out/` 组装候选，不退出或安装现用应用。安装与实际客户端验收是另外的步骤。

## 旧版补丁归档

`patches/v0.1.0/` 固定保存最初的两份邮件补丁，基线是 `81493efb71e8e8244f95d3e9f71d8369654ab151`。UI 汉化作为第三个功能提交在 Git 中维护，不包含在旧 ZIP/series 内。已有定制分支不应重复导入这些补丁。

| 补丁 | 内容 |
| --- | --- |
| [0001-desktop-display-translation.patch](patches/v0.1.0/0001-desktop-display-translation.patch) | 本机 Codex 翻译、IPC、英文原文下方中文显示、设置和测试 |
| [0002-ssh-slow-link-timeouts.patch](patches/v0.1.0/0002-ssh-slow-link-timeouts.patch) | SSH 准备、探测、复用预算和回归测试 |

可用独立临时 index 验证旧补丁，不改变工作目录或真实 index：

```sh
python3 ops/t3code-desktop/scripts/check-series.py /Users/peiwenyang/Development/t3code
python3 ops/t3code-desktop/scripts/check-series.py /Users/peiwenyang/Development/t3code --only translation
python3 ops/t3code-desktop/scripts/check-series.py /Users/peiwenyang/Development/t3code --only ssh
```

[`verification.json`](verification.json) 和 [`fork.json`](fork.json) 是 2026-10-18 的历史验证快照，不能代表本轮 `0.1.2` 测试、推送或安装状态。原始文件保留在 `out/history/`，旧版源码恢复入口为 `backup/desktop-zh-v0.1.0-20261021`。

补丁沿用上游 MIT 许可，见 [LICENSE.upstream](LICENSE.upstream)。本目录不包含用户数据库、凭据或翻译缓存。

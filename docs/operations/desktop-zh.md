# 中文显示定制版维护

本 fork 的维护分支为 [`desktop-zh`](https://github.com/ypwcharles/t3code/tree/desktop-zh)，基于官方 `v0.1.0`（`81493efb71e8e8244f95d3e9f71d8369654ab151`）。`main` 保留为上游同步分支，不放定制功能；只跟进官方稳定版，不自动合并每日 main。

## 两个独立功能提交

- `feat(desktop): add local bilingual response display`：完成且可见的英文助手回复下方显示简体中文，保留英文、代码与引用。Settings → General → 自动翻译，默认开启，并发 3，可选 1–4。
- `fix(ssh): allow slow tunnel readiness without reconnect loops`：保留上游重连机制，将 SSH 准备预算设为 120 秒、转发 HTTP 探测为 15 秒、隧道创建/复用为 60 秒。远端 loopback 探测仍为 1 秒，其他连接路由保持原预算。

翻译使用本机已登录的 Codex CLI 和所配置的 provider，模型为 `gpt-6-luna`、low，会使用该账户额度。中文只属于本机显示，不写回远端会话或 Claude 上下文。独立翻译进程采用 ephemeral、read-only，并关闭工具等能力。当前验收范围是 macOS 桌面；普通网页没有桌面 IPC 时保持原显示，移动端翻译未实现。

两个功能相互独立。以后上游解决 SSH 慢链路问题时，可移除 SSH 提交而保留中文显示。SSH alias、密钥及服务器配置不属于源码提交；保留各机器原有配置，不放入仓库。

## 获取源码

```sh
git clone --branch desktop-zh https://github.com/ypwcharles/t3code.git
cd t3code
git remote add upstream https://github.com/pingdotgg/t3code.git
```

仓库保留上游 MIT 许可。构建前按上游 [开发指南](development.md) 准备依赖和运行时版本。

## 跟进下一个稳定版

先检查 [官方稳定版](https://github.com/pingdotgg/t3code/releases/latest)，核对 release、协议兼容性及 SSH 实现。以下 `vX.Y.Z` 须替换为实际 tag；当前旧基线为 `v0.1.0`。

在工作目录干净时，先创建升级分支，保留原维护分支：

```sh
git fetch origin desktop-zh
git fetch upstream tag vX.Y.Z
git switch -c desktop-zh-vX.Y.Z origin/desktop-zh
git rebase --onto vX.Y.Z v0.1.0
```

处理冲突后 `git rebase --continue`，放弃本轮迁移用 `git rebase --abort`。核对桌面 HostProcess/IPC、聊天消息显示、连接 supervisor 和 SSH tunnel 接入点；若上游已解决 SSH 问题，交互式 rebase 时删除对应提交。更新本页的基线和升级命令中的旧 tag。

如果本地仓库是浅克隆，先抓取缺少的旧基线 tag；跨越浅边界需要更多历史时再执行 `git fetch --unshallow upstream`。维护分支不应夹带用户数据或机器专属配置。

### 验证与构建

安装依赖后，仓库根目录运行定向检查：

```sh
pnpm exec vp test run apps/desktop/src/translation/codexTranslation.test.ts packages/client-runtime/src/connection/supervisor.test.ts packages/ssh/src/tunnel.test.ts
pnpm exec tsc-rs --noEmit -p apps/desktop
pnpm exec tsc-rs --noEmit -p apps/web
pnpm exec tsc-rs --noEmit -p packages/client-runtime
pnpm exec tsc-rs --noEmit -p packages/ssh
```

在 `apps/web` 中验证显示层：

```sh
pnpm exec vp test run --project unit src/components/chat/DesktopDisplayTranslation.test.tsx
```

按上游桌面构建流程生成安装包；留意依赖补丁、CSS 生成及 `APP_VERSION` 等构建条件。不要用 `VITE_HTTP_URL` / `VITE_WS_URL` 固化远端入口。保留原程序作为回退资产，再安装并验证版本、SSH Connected、既有历史同步和真实中英双语显示。服务端协议兼容性需另外核对，不回退或覆盖用户数据库。

验证通过后推送升级分支：

```sh
git push -u origin desktop-zh-vX.Y.Z
```

确认升级分支可替代当前维护版后，再用 `git push --force-with-lease origin HEAD:desktop-zh` 更新维护分支。该步骤会重写维护分支历史；保留版本分支作为恢复入口，并先确认没有他人的新提交。

## 安装与更新渠道

本 fork 当前只保存源码和维护步骤，没有自定义 Release、自动同步任务或自动发布流水线。官方安装包及官方更新入口不含这些定制，安装后会覆盖本机定制。`v0.1.0` 上游不自动下载或退出时安装，但仍保留官方更新入口。使用定制版应从本 fork 构建；后续需要多设备分发时再配置自己的更新渠道、签名和公证。

## 当前验证依据

2026-10-18 的 macOS `v0.1.0` 定制构建已通过 109 项定向测试（翻译 15、连接与 SSH 94）及四个相关包的类型检查，并实测 SSH 连接、历史同步和中文显示。此次导入 fork 对两个功能提交的完整 Git tree 进行比对，结果为 `6b4963493addb574f363b67695b27bf65fddc1c3`，与该验收源码一致；额外提交只添加本维护文档和 README 入口，没有重新运行运行时测试。

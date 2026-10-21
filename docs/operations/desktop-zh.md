# 中文显示定制版维护

本机源码根为 `/Users/peiwenyang/Development/t3code`。本轮升级分支 `desktop-zh-v0.1.1` 基于官方 `v0.1.1`（`fe27e8e3dc12dcbb108e9a28fd9b8cb65f34ae92`）；原 [`desktop-zh`](https://github.com/ypwcharles/t3code/tree/desktop-zh) 和 `backup/desktop-zh-v0.1.0-20261021` 保留旧版 `4066f10d`。`origin` 是用户 fork，`upstream` 是官方仓库。只跟进指定稳定版，不自动合并每日 main；本轮分支尚未推送。

维护脚本与历史补丁在 `ops/t3code-desktop/`，历史说明在 `docs/evidence/`。构建、日志、下载、回退应用和迁移校验记录统一在已忽略的 `out/`；旧 `tmp` / `tencent-hermes` 路径保留兼容 symlink。SSH 配置和密钥仍留在原位置。

## 三个独立功能提交

- `feat(desktop): add local bilingual response display`：完成且可见的英文助手回复下方显示简体中文，保留英文、代码与引用。Settings → General → 自动翻译，默认开启，并发 3，可选 1–4。
- `fix(ssh): allow slow tunnel readiness without reconnect loops`：保留上游重连机制，将 SSH 准备预算设为 120 秒、转发 HTTP 探测为 15 秒、隧道创建/复用为 60 秒。远端 loopback 探测仍为 1 秒，其他连接路由保持原预算。
- `feat(web): add Simplified Chinese interface localization`：默认使用简体中文界面，覆盖常用聊天操作、侧栏、设置和连接页面。设置 → 常规 → 界面语言可切换 English，应用后重新载入客户端。语言偏好保存在当前客户端，不改变会话内容；UI 汉化本身不调用模型。

翻译使用本机已登录的 Codex CLI 和所配置的 provider，模型为 `gpt-6-luna`、low，会使用该账户额度。中文只属于本机显示，不写回远端会话或 Claude 上下文。独立翻译进程采用 ephemeral、read-only，并关闭工具等能力。当前验收范围是 macOS 桌面；普通网页没有桌面 IPC 时保持原显示，移动端翻译未实现。

三个功能相互独立。以后上游解决 SSH 慢链路问题时，可移除 SSH 提交而保留中文显示。SSH alias、密钥及服务器配置不属于源码提交；保留各机器原有配置，不放入仓库。

UI 汉化目前覆盖常用界面，部分高级页面、动态状态、服务端错误及操作系统原生菜单仍显示英文。未收录的上游文案回退为原文。汉化适用于本 fork 构建的桌面和网页客户端，未实现 React Native 移动端汉化；仅更新 Mac 安装包不会改变 OCI 上单独托管的网页资源。

### 维护 UI 词库

文案集中在 `apps/web/src/i18n/zh-CN.ts`。构建插件只替换源码里的界面展示文字，保留状态判断、命令参数、用户内容及路径。补充文案时保留内联命令和品牌名；复杂动态文案在展示位置显式调用 `uiText`，不要扩大到任意字符串或远端消息。

`0.1.1` 使用原生 React Compiler。汉化插件以 `enforce: "pre"` 在 JSX lowering 前转换展示文案，保留上游 `react({ compiler: true })`；回复显示测试使用上游浏览器测试框架。

升级上游后可在仓库根目录运行 `node apps/web/scripts/ui-localization-catalog.ts`，输出已收录和未收录的候选文案。该目录是维护线索，不代表完整 UI 覆盖率；补词后运行下方定向检查，并实测界面与语言切换。

## 获取源码

```sh
git clone --branch desktop-zh https://github.com/ypwcharles/t3code.git
cd t3code
git remote add upstream https://github.com/pingdotgg/t3code.git
```

上面的远端分支仍是旧版基线；本轮 `0.1.1` 提交目前只在本机分支。仓库保留上游 MIT 许可。构建前按上游 [开发指南](development.md) 准备依赖和运行时版本（当前为 Node 24、pnpm 11.10.0）。

## 跟进下一个稳定版

先检查 [官方稳定版](https://github.com/pingdotgg/t3code/releases/latest)，核对 release、协议兼容性及 SSH 实现。以下 `vX.Y.Z` 须替换为目标 tag；当前基线为 `v0.1.1`。

在工作目录干净时，先创建升级分支，保留原维护分支：

```sh
git fetch upstream tag vX.Y.Z
git branch backup/desktop-zh-v0.1.1 desktop-zh-v0.1.1
git switch -c desktop-zh-vX.Y.Z desktop-zh-v0.1.1
git rebase --onto vX.Y.Z v0.1.1
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
pnpm exec vp test run --project unit src/i18n/uiLocale.test.ts src/i18n/uiLocalization.test.ts src/components/settings/settingsSearch.test.ts src/components/settings/ConnectionsSettings.logic.test.ts
pnpm exec vp test run --project browser src/components/chat/DesktopDisplayTranslation.browser.test.tsx
```

按上游桌面构建流程生成安装包；留意依赖补丁、CSS 生成及 `APP_VERSION` 等构建条件。不要用 `VITE_HTTP_URL` / `VITE_WS_URL` 固化远端入口。本机以已校验的官方同版本 arm64 ZIP 为底包，编译 `apps/web/dist` 和 `apps/desktop/dist-electron`，再用 [`assemble-macos.mjs`](../../ops/t3code-desktop/scripts/assemble-macos.mjs) 组装；它只接受 `out/` 下的新输出，不安装应用。

助手参数为 `--official-app`、`--expected-asar-sha256`、`--output`、`--evidence`。它检查官方 ASAR hash，保留官方服务端、原生运行文件及 unpack 集合，更新 ASAR integrity 并做本机 ad-hoc 签名和严格签名检查。公开构建标识可从根 `.env.example` 载入；不要复制用户凭据。必须核对官方同版本底包，不能复用旧版本的 native/server 文件。

保留现用程序的完整副本，正常退出后替换，再验证安装 hash、版本、SSH Connected、既有历史同步、语言切换和真实双语显示。只替换程序，保留全部数据库、排队消息、草稿和设置；客户端升级不包含远端服务升级。真实验收日志保存在 `out/upgrade-0.1.1-20261021/probe/`。

需要发布源码且获得对应授权后，推送升级分支：

```sh
git push -u origin desktop-zh-vX.Y.Z
```

本轮保留旧 `desktop-zh`；重写远端维护分支需要另外明确授权。

## 安装与更新渠道

本 fork 没有自定义 Release、自动同步任务或自动发布流水线。官方安装包及官方更新入口不含这些定制，安装后会覆盖本机定制。使用定制版应从本 fork 构建；后续需要多设备分发时再配置自己的更新渠道、签名和公证。

## 验证依据

2026-10-21 的 `v0.1.1` 定制源码通过 224 项定向测试、Desktop/Web/client-runtime/SSH 四个包的类型检查和定向 lint，Desktop 与 Web 正式构建成功。以官方同版本底包组装后，1336 个 ASAR 运行文件、155 个外部运行文件、95 个 unpack 文件及两个 WASM 的完整性检查通过；主可执行文件的签名以外内容一致，严格签名校验通过。

本机 `/Applications/T3 Code (Alpha).app` 已安装 `0.1.1`，173 个文件、权限和链接与候选应用一致，ASAR SHA256 为 `9c4b6aef4c3751d18c9b609fdf0bd415984be90b29f6a3cb3c47aa5faf722062`。当前最终界面验收仍待确认：电脑控制工具重启后读取窗口超时，启动日志成功且系统启动了 SecurityAgent，正在等待用户核对窗口或钥匙串提示。不能将安装校验等同于语言切换、双语显示和客户端 OCI 连接验收。

本轮结构化记录在 `out/upgrade-0.1.1-20261021/probe/validation-summary.json`，当前终态与后续步骤见同目录上一级的 `handoff.md`。旧版完整回退副本在 `out/upgrade-0.1.1-20261021/backups/`；程序回退保留现有数据库和设置。

`0.1.0` 的历史验收见 [桌面升级](../evidence/2026-10-18-t3code-desktop-0.1.0-upgrade.md) 和 [中文界面](../evidence/2026-10-18-t3code-ui-zh.md)。

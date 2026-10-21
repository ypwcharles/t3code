# T3 Code Mac 原位更新与远端连续性

前半部分记录首次安装；后续翻译提速与配置版本见文末。Git 检查点问题另用本地忽略配置修复，没有为该问题修改产品代码。

## Changed

用户明确要求直接替换更新，无需等待远程任务结束。Mac 官方 v0.0.45
增加独立显示层：本机 Codex CLI 固定 `gpt-6-luna`，保留英文助手回复，
在其下方展示中文，不将译文或翻译指令送回远程 Claude 会话。
同时将本地 SSH HTTP 单次探测延长至 8 秒，创建与复用整体等待延长至
20 秒；远端 loopback 探测仍为 1 秒。

## Where

- 安装：`/Applications/T3 Code (Alpha).app`，bundle ID `com.t3tools.t3code`。
- 源码、构建、应用副本及验证报告：`/Users/peiwenyang/Development/tmp/_inbox/t3-code-oci/out/desktop-translation-20261014`。
- 设置、连接与日志仍使用 `~/.t3/userdata` 和 `~/Library/Application Support/t3code`，未重建或手工修改连接目录。
- 原版完整备份：上述构建目录的 `backups/20261014T090004Z/T3 Code (Alpha).app`，334,387,453 字节，保留用于回退，无自动到期删除。
- OCI 只读检查目标为 `ubuntu@129.150.41.169`，未修改或重启远端服务、Claude、队列或计时器。

## Verified

- 原版从应用菜单正常退出；安装目录采用 rename 替换，备份及替换后签名均通过 `codesign --verify --deep --strict`。
- 首次安装应用 ASAR SHA256 为 `b75583b1338f494777ab7e6783c86da496b9d0d85cc71e57cb971be774838e5f`。
- 首次启动暴露了修改 `CFBundleName` 导致 Electron 找不到 Helper 的打包问题；已恢复官方内部名称和显示名称，并重新签名安装应用和交付副本。随后主进程及 Helper 正常运行，启动日志记录 main window created。
- 原始 T3 服务 PID `3377078`、`NRestarts=0`、active/running；Claude PID `1199465`、启动标记 `647877331`。客户端退出、修复版启动和钥匙串确认后，在 2026-10-14 09:12:27 UTC 及 09:21:02 UTC 核对，全部一致。
- 当前 SSH ownership 标记在退出前读取为 `external`。代码检查表明，客户端清理本地隧道时跳过对 external 后端的 kill；由桌面管理的后端具有不同退出行为。
- 前期 102 项相关测试、桌面/网页/SSH 类型检查、打包后的 preload IPC 校验通过；真实 `gpt-6-luna` 翻译样例约 9.7 秒完成，代码、路径、链接保持原样且没有工具调用。180 个原生依赖与服务器运行时文件逐文件一致，其中 45 个 native unpacked 文件保留。
- 修复后的交付 ZIP 完整性通过，SHA256 `e07aad61e73d0eeedb64bf9c57a0e20c71a20e047c8bb11a149889994d727654`。
- 用户完成钥匙串确认后，实际 Mac 界面恢复原有 5 条会话、OCI 环境 `host-10-0-0-77`、原会话 `MIMO workflow overview` 及 Monitoring 状态。SSH ensureEnvironment 和 bearer bootstrap 日志成功，客户端接收到更新期间的新回复；不只检查缓存历史消息。
- 实际窗口同时展示英文原文和下方中文，表格及行内代码保留；新收到的 1146 summary_en 进度消息也自动翻译。本地缓存已有 11 条译文。
- 一条回复首次因占位符校验失败而保留原文并提供重试，之后中文正常显示，`summary_zh`、`codex-rate-limit`、`provider_rejected` 均完整保留。未通过校验的译文没有展示。
- Mac 界面验收记录时间为 2026-10-14 09:25:56 UTC；详细状态保存在构建目录 `probe/in-place-update.json`。未向远端 Claude 发送验证消息或翻译指令。

## Rollback / Risk

首次启动时，macOS 钥匙串确认阻塞了读取原有加密连接。Computer Use 明确禁止操作
SecurityAgent，用户已在系统窗口自行确认，随后实际连接与双语界面通过验收。
不收集密码，不改钥匙串访问控制，不复制或手工解密连接凭据。

回退时先正常退出 Mac T3，保留或移走本次修复应用，再把上述原版备份用 `ditto`
复制回 `/Applications/T3 Code (Alpha).app`。不回退、覆盖或删除 `~/.t3`、浏览器 profile、
远端状态或有效任务进度。备份原 ASAR SHA256 为
`9d697ae5738f0bbb603a26d586e3eb7090bb7d179677c99759ba7fafadd70315`。
界面验收后，对原版备份与临时 displaced 副本逐文件检查完整内容和符号链接一致，
再次验证备份签名，然后删除重复的 displaced 副本。完整原版备份继续保留，约 319 MiB。

官方更新会覆盖本地补丁；以后升级需重新应用并验证。当前记录证明远端进程连续性，
不证明所有远程部署方式退出客户端都不会中止后端，也不替代长期链路稳定性验收。

## 后续：翻译提速、设置和简洁显示

- 2026-10-14 09:48:25 UTC / 17:48:25 新加坡时间再次原位安装，保留原应用路径、内部名称、账号和连接。当前 ASAR SHA-256 为 `7086981230d4c4612e6e8eeb8c3b5524a4e39c8f8a0e88af8eb9f7d520ac719d`；安装后 `codesign --verify --deep --strict` 通过。
- 翻译队列从串行改为默认并发 3 条，上限可设 1–4 条；完成消息触发等待由 750 ms 改为 100 ms。固定 `gpt-6-luna`，保留去重、取消、持久缓存和占位符校验。
- Settings → General → 自动翻译加入显示开关、并发数和固定模型说明，支持设置搜索。只保存本机显示偏好，不改远端会话或服务器设置。
- 移除每条消息常驻的开关、收起按钮和“中文译文”标题；复制译文使用悬停图标，正常显示只有英文及下方中文。失败时保留原文和重试。
- 真实三条短消息测试：串行 23,684 ms，对照并发 3 条 10,087 ms，受保护代码、链接和路径均完整。该结果证明排队吞吐改善，不代表所有单条请求都加速同样比例；完整回执为 `probe/concurrency-live-v2.json`。
- 本轮 10 项桌面测试、132 项网页测试通过；桌面和网页类型检查通过；范围 lint 没有错误，已有 React 警告保留。此前 SSH 22 项测试与类型检查继续有效，SSH 源码本轮未变。
- 用户再次完成钥匙串确认后，原 OCI 连接、5 条会话和 `MIMO workflow overview` 的 Monitoring 状态恢复。实际设置搜索定位到翻译项，并发 1–4 选项可用；4 条的偏好在离开/返回后保留，最终恢复默认 3 条。原文及后续回复中文实际显示，悬停以外没有常驻翻译控制文字。报告为 `probe/in-place-update-v2.json`。
- 2026-10-14 10:09:41 UTC 远端 T3 MainPID `3377078`、NRestarts `0`、active/running；Claude PID `1199465`、启动标记 `647877331` 均与更新前一致。未发送验证消息给远端 Claude。
- 新累计补丁有 15 个文件、55,368 字节，SHA-256 `bdeb5a70704e74ced7e95fcce9fd9ea656f208480967536bbfdf349c443e2e24`；官方 tarball 的干净文件通过 `git apply --check`，应用后逐文件与当前源码相同。
- 当前 ZIP `T3Code-0.0.45-Luna-Bilingual-SSH-mac-arm64.zip` 为 142,306,850 字节，SHA-256 `6127d8aba46f7df055d5e8f8089a1c523b5d6f891f054f1f5cebadb37c76bcbd`；完整 CRC 校验通过，ZIP 内 ASAR 与已安装应用相同。
- 保留当前应用交付副本、当前 ZIP、首版 ZIP（142,307,431 字节）、完整官方备份（334,387,453 字节）和官方源码 tar（104,192,207 字节），用于恢复和后续重建，无自动到期删除。本次两个重复旧应用副本共 671,535,646 字节，在当前 ZIP、首版 ZIP 和官方备份核验后已删除；补丁验证及远程探针 scratch 均清理。远端新增的唯一保留备份是 Git 忽略配置的 1,606 字节副本，保留 14 天；没有新增远程大于 10 MiB 的保留文件。

Git exit 128 已通过 OCI `.git/info/exclude` 的本地规则独立解决。2026-10-14 10:07:47 UTC，T3 自然检查点日志为 `Success`，实际私有 ref 保留 191 个源码和文档文件。完整原因、备份和精确回退见[检查点修复记录](/Users/peiwenyang/Development/podcast-transcriber/docs/operations/2026-10-14-t3code-checkpoint-exclude.md)。此项未改变 T3 或播客产品代码，也未重启服务。

# Mac T3 Code 0.1.0 升级与 OCI 连接验收

现场时间：2026-10-18 00:28–00:33 SGT。用户授权本机升级最新版，保留中文翻译与 SSH 修复，并要求先核对上游 SSH 实现。

## Changed / Where

官方 [latest](https://github.com/pingdotgg/t3code/releases/latest) 当前指向 [v0.1.0](https://github.com/pingdotgg/t3code/releases/tag/v0.1.0)，源码 tag commit `81493efb71e8e8244f95d3e9f71d8369654ab151`。
Mac arm64 官方 ZIP SHA-256 `0d21b076d3d1b266ca4b6fb432e3fa79980f8fc7ea9f88539a934cd7662a5fa8`，与发布 metadata digest 一致。

工作与回退资产根目录：
`/Users/peiwenyang/Development/tmp/_inbox/t3-code-oci/out/desktop-upgrade-20261018`。

- 原位安装到 `/Applications/T3 Code (Alpha).app`，内部产品名采用官方 `T3 Code (Beta)`。
  bundle ID 仍为 `com.t3tools.t3code`，用户数据仍为 `~/Library/Application Support/t3code`，没有清空设置、历史或配对。
- 使用官方 0.1.0 桌面/网页源码迁移既有翻译层，主进程采用新版 `@t3tools/shared/HostProcess` API。
  英文原文与引用上下文保留，中文只在本机显示；独立 ephemeral Codex CLI 使用 `gpt-6-luna`、low、read-only，禁用工具与记忆等功能，不写远端 Claude 上下文。
- 先审查新版连接 supervisor 与 tunnel：上游新增指数退避及现有连接恢复探测，但 SSH 单次探测仍 1 秒、创建 20 秒、复用 2 秒，外层仍每路由 15 秒。
  保留新版重连逻辑及路由结构，只将 SSH setup 设为 120 秒；其他路由仍 15 秒，进入同步的路由另加原有 75 秒快照预算。
  跨 SSH 的隧道 HTTP 单次探测 15 秒，创建/复用整体 60 秒；远端 loopback 的 1 秒探测不变。
- 原有 `oci-t3` SSH alias、专属 `IPQoS none` / `Compression yes` 均未修改。无新增公网入口、凭据轮换或 OCI 服务重启。
- 以官方应用为底包，仅替换桌面主进程/预加载与网页资源。逐项核对 1289 个官方服务端/依赖运行文件 hash 不变、95 个 unpacked 原生文件集合保留。
  更新 ASAR integrity 并沿用本机定制应用的 ad-hoc signing，`codesign --verify --deep --strict` 通过。

## Verified

- UI Settings → General：Version `0.1.0`，Stable，Up to Date；自动翻译 on，并发 `3`，模型 `gpt-6-luna`。
- UI Settings → Connections：`host-10-0-0-77 SSH ubuntu@129.150.41.169:22 · Connected`。
- 已有 sidebar 会话恢复；打开 `MIMO workflow overview`，真实历史消息完成加载。英文历史回复保留，随后出现本机 Codex 生成的中文译文与复制译文按钮，表格及 `article_en` 等标识保留。
  此为显示翻译验收，没有向远端 Claude 提交新任务，也不把历史回复中的业务状态视作当前业务状态。
- 实际应用 PID `41846` 的 SSH 子进程 `42215`，转发 `127.0.0.1:62493 → OCI 127.0.0.1:3773`。
  通过该真实应用隧道读取 descriptor，返回 `serverVersion=0.1.0`、`orchestrationProtocolVersion=2`，环境 ID 与既有 OCI 一致。
- 新版 desktop trace：`desktop.ssh.ensureEnvironment` Success，约 10.596 秒；`ssh/tunnel.startSshTunnel` Success，约 1.083 秒。
- OCI 安装前后只读复查：服务 active/running，`MainPID=1694969`、`NRestarts=0`，descriptor 均为 0.1.0 / protocol 2。
- 109 项定向测试通过：connection supervisor 61、SSH tunnel 33、翻译引擎 10、网页显示 5。
  覆盖 SSH 准备超过旧预算仍成功、SSH setup + 快照总预算有界、1.5/6 秒隧道响应创建/复用不拆建，以及失效隧道重建。
  既有 stale-forward 测试按新的 60 秒虚拟时钟预算更新。早期迁移测试失败日志保留，最终通过日志为 `probe/*-tests.log` / `tunnel-tests-final.log` / `web-tests.log`。
- desktop、web、client-runtime、SSH 四个包类型检查无 error；定向 lint 退出成功，有 34 条 React warnings，其中 2 条来自保留的翻译显示组件。
  桌面与网页正式 build 均通过。没有跑与本改动无关的全仓库测试。

安装后的 ASAR 与构建产物 hash 一致：
`d3036c718e5e03dee508b3bdb079a0043230305c206ea5b3957ceb011ff6d5ef`。
完整 17 文件源码补丁：`artifacts/t3code-v0.1.0-luna-bilingual-ssh-20261018.patch`，
SHA-256 `91a0ea1ed0136f576e5fe9993449831bf2c2f3d43657057ada474c475ebc1bbf`。
校验报告：`probe/artifact-verification.json`、`installed-verification.json`、`connection-trace-summary.json`。

## 补丁维护包

后续按用户要求将已验收源码拆成独立翻译（13 文件）与可选 SSH 修复（4 文件）两个 `git am` 补丁。
入口 [ops/t3code-desktop/README.md](../../ops/t3code-desktop/README.md)，包含固定基线、SHA-256、文件 blob 清单及独立 index 校验器。
翻译、SSH 分别独立应用及组合应用均验证；组合后的完整 Git tree 与验收源码一致。
此次仅整理源码交付，已安装程序、OCI 服务与用户数据未改变。

随后按用户明确要求创建 GitHub fork [`ypwcharles/t3code`](https://github.com/ypwcharles/t3code)，默认分支为 `desktop-zh`。
两个独立功能提交为 `eb14757c`（翻译）与 `5d02ef55`（SSH）；`d8bfccee` 只添加 README 入口和 `docs/operations/desktop-zh.md` 维护步骤。
两个功能提交应用后的完整 Git tree 为 `6b4963493addb574f363b67695b27bf65fddc1c3`，与验收源码一致。
独立本机 checkout 为 `/Users/peiwenyang/Development/t3code`，`origin` 指向 fork、`upstream` 指向官方；旧升级源码目录的修改保留。
未发布 Release、设置自动更新任务或变更本机应用及 OCI 服务。仓库、分支和远端提交核验见维护包 `fork.json`。

用户随后授权的 UI 汉化已作为第三个功能提交推送并安装；这不改变上文升级与最初 fork 导入的历史验收状态。该次构建、当前安装 hash、钥匙串授权处理及最终中英切换/OCI 验收见 [UI 汉化记录](2026-10-18-t3code-ui-zh.md)。

## Rollback / Risk / Retention

原应用完整保留在工作根目录 `backups/T3 Code (Alpha) 0.0.45.app`，335775382 bytes，保留 14 天至 2026-11-01。
原 ASAR SHA-256 `b41c55a1c610640d756d556f1544aae21acbb75b5286831a46e8caad94933920`。
旧版定制源码、补丁及历史备份未删除。

本机程序回退必须先从应用菜单正常 Quit，把当前应用移到新的保留目录后，再用 `ditto` 将上述完整备份复制回原 `/Applications/T3 Code (Alpha).app` 路径，验证旧 hash 与签名。
**旧 0.0.45 客户端无法连接当前 V2 OCI 服务**；因此单独回退客户端不是可用链路回退，须结合 [OCI 程序回退记录](2026-10-18-t3code-0.1.0-upgrade.md) 评估。
禁止覆盖 V1/V2 SQLite 或用旧配置快照抹掉新进度。安装官方更新包会替换本机定制，应先迁移本记录的源码补丁再验证；0.1.0 上游关闭自动下载及退出时安装，但仍保留官方更新入口。

新增大文件按目录汇总：定制 app/patch 385204405 bytes、旧 app 备份 335775382 bytes、源码/Git/构建输出 261585360 bytes、官方 ZIP 149936937 bytes。
除旧 app 的 14 天回退期外，源码、补丁、官方 ZIP 与定制 app 保留至下一次已验收升级，用于复现与恢复。
逐文件 >10 MiB 清单与保留原因见 `probe/retained-large-files.json`。安装目录内的新运行文件为当前使用版本，无到期删除。
本次生成的 node_modules、ASAR stage、冗余官方 app 解包目录、测试用下载副本及不完整源码归档均已清理；清理列表 `probe/cleanup.json`。
未创建 OCI scratch。手机连接、新模型任务与长期网络稳定性未在本次验证范围内。

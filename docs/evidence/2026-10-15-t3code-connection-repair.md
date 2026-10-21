# T3 Code SSH 连接恢复

目标为 OCI Singapore `ubuntu@129.150.41.169`、Mac 环境 `host-10-0-0-77`。
用户要求排查并修复连接；最后验收时间为 2026-10-15 23:40 新加坡时间。

## Changed

- Mac 客户端的 SSH 连接外层等待从 15 秒改为 120 秒；普通连接仍为 15 秒。
- 隧道创建及复用整体等待从 20 秒改为 60 秒，单次本地 HTTP 探测从 8 秒改为 15 秒；远端 loopback 探测仍为 1 秒。
- 仅 `Host oci-t3` 启用 `IPQoS none` 和 `Compression yes`。旧重连请求在桌面 IPC 队列中积压，正常退出并重新启动 Mac 客户端后清除。
- 保留昨天的 Luna 双语显示层、翻译设置、账号、连接目录与已有会话。没有重启或修改 OCI 的 T3、Claude、业务服务、数据库或定时器。

## Where

- 安装：`/Applications/T3 Code (Alpha).app`，版本仍为本地定制的 `0.0.45`。
- 源码与证据根目录：`/Users/peiwenyang/Development/tmp/_inbox/t3-code-oci/out/desktop-translation-20261014`，下称 `BUILD`。
- 本次源码变化：`packages/client-runtime/src/connection/supervisor.ts`、对应测试、`packages/ssh/src/tunnel.ts`。
- 项目 `.ssh/t3-code-options.conf` 为 `0600`，由 `~/.ssh/config` 的 `Host oci-t3` 段 Include。身份、密钥与 known-hosts 继续使用项目专用文件。
- SSH 配置备份：项目 `.ssh/backups/20261015-t3-connect/user-ssh-config`，1,094 字节、`0600`，目录 `0700`，保留至 2026-10-29。

## Verified

原因证据：

- 本机到目标地址走 `en0`、网关 `192.168.31.1`，没有经过 Clash TUN；TCP/22 可达，SSH 能认证。远端允许 TCP forwarding。
- T3 服务 active/running、MainPID `3377078`、NRestarts `0`，启动时间仍为 2026-10-12 12:34:22 UTC。Node `3377111`、resource monitor `3377139`、cloudflared `3377660` 的原启动时间保留。后端绑定 `127.0.0.1:3773`，最终 loopback HTTP 200，TTFB 0.001679 秒。
- SSH 转发请求曾超过 8–10 秒，日志有认证/建立变慢和 TCP 重传。原客户端外层只有 15 秒，短于内部 20 秒，连接还未建立即被判失败；后续旧 IPC 请求积压又放大重连。
- 传输选项的小样本对照：默认隧道两次 HTTP 约 2.68/3.98 秒；`IPQoS=none` 加压缩约 0.79/1.02 秒。该样本不能证明底层网络故障已消除，也不能定位到 ISP、路由器或云端具体设备。

安装与实际验收：

- supervisor 和 SSH 两个测试文件共 62 项通过；client-runtime 类型检查、三个改动文件的格式和 lint 检查通过。网页及桌面构建成功。
- SSH 外层测试验证：prepare 超过原 15 秒仍保持同一连接尝试；真正停滞的尝试在 120 秒超时并释放资源。
- 原生依赖与服务器运行时 180 个文件、45 个 unpacked native 文件保留；新应用 `codesign --verify --deep --strict` 通过。
- 安装 ASAR SHA-256：`b41c55a1c610640d756d556f1544aae21acbb75b5286831a46e8caad94933920`。
- 正常重启本机客户端后的新连接：15:37:32 UTC 隧道成功（8.532 秒），15:37:37 ensureEnvironment 成功（26.982 秒），15:37:38 bearer bootstrap 成功（0.488 秒）。这次连接耗时本身已超过旧外层 15 秒。
- 实际 Settings → Connections 显示 `Connected`，远端会话列表重新同步，已有会话内容及英文下方中文译文可读。随后界面收到用户另行操作后的新消息与远端 `Working` 状态；本任务未向远端模型发送验证消息。至 23:40，未看到这次干净启动后的隧道重建。
- 对 T3 正在使用的实际本地转发端口读取 `/.well-known/t3/environment`：HTTP 200、TTFB 0.561578 秒。该动态端口不是固定配置。
- 回执在 `BUILD/probe/in-place-connection-update-20261015.json`；构建、测试、补丁验证及脱敏连接事件均保存在 `BUILD/probe/*20261015*`。
- 新累计补丁 17 文件、59,317 字节：`BUILD/artifacts/t3code-v0.0.45-luna-bilingual-ssh-20261015.patch`，SHA-256 `56367ffd40f2791520fac4665d09c6032e0eed34b1af853af0461d577437904a`。从官方源码 tar 提取的干净文件通过 `git apply --check`，应用后逐文件与当前源码一致。

## Rollback / Risk

连接已恢复，验收窗口为数分钟，不能代替长期链路稳定性证明。底层网络仍有延迟波动；此修改提高慢链路容忍度，不声称修好了未定位的网络设备。后续若复发，先查实际隧道、客户端阶段与传输，不直接重启远端服务。官方应用更新会覆盖本地补丁。

客户端回退：先从菜单正常退出 T3，再执行以下操作；目标 Retired 路径必须不存在，保留当前应用便于撤销。只回退应用，不回退用户数据或远端进度。

```sh
mv '/Applications/T3 Code (Alpha).app' '/Applications/T3 Code (Connection Fix Retired).app'
ditto '/Users/peiwenyang/Development/tmp/_inbox/t3-code-oci/out/desktop-translation-20261014/artifacts/T3 Code (中文修复版).app' '/Applications/T3 Code (Alpha).app'
codesign --verify --deep --strict '/Applications/T3 Code (Alpha).app'
```

SSH 选项回退：仅移除 `~/.ssh/config` 中本次新增的
`Include /Users/peiwenyang/Development/tencent-hermes/.ssh/t3-code-options.conf`，
并移走本次选项文件。备份可核对原文；若此后用户已有其他修改，不能整文件覆盖。回退后以 `ssh -G oci-t3` 检查有效配置，重新启动客户端并验证 Connected。

本次新增长期保留且大于 10 MiB 的交付副本为
`BUILD/artifacts/T3 Code (连接修复20261015).app`，335,775,382 字节（排除符号链接重复统计），用于恢复与重建，无自动到期删除。
既有中文版本副本 335,771,466 字节继续作为回退来源；已逐文件及符号链接核对旧安装与该副本一致、签名有效，然后删除本次产生的重复 displaced app。官方原版备份和旧交付均保留。补丁验证 scratch 已清理；没有本次新增的远端保留文件或配置备份。

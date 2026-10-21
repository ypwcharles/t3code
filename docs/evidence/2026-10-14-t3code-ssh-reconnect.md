# T3 Code Mac → OCI 重连超时诊断

最后现场核验：2026-10-14 15:34 新加坡时间（07:34 UTC）。

## 结论与影响

Mac 到 OCI 的 SSH 链路延迟、抖动和 TCP 重传，使 T3 Code v0.0.45 的一秒 HTTP readiness 探测误判可用隧道。客户端随后关闭隧道、重新建立、再次探测，造成长时间 `reconnecting`。这是已证实的重连放大机制；本次没有保留断线起点的网络抓包，不能确定最初触发断线的具体设备或事件。

本次只做只读诊断及独立临时 SSH 转发测试，没有修改 SSH 配置、T3 安装包、远端服务、项目数据或任务。所有测试转发进程均已关闭；两条原有转发保留。Mac 当前恢复连接，原会话仍显示 `Working`，并持续产生工具活动。

## 现场证据

- 目标主机：OCI `ubuntu@129.150.41.169`，`host-10-0-0-77`。
- 用户服务 `t3code.service`：`active/running`，MainPID `3377078`，从 2026-10-12 12:34:22 UTC 持续运行，`NRestarts=0`。
- HTTP 后端：`127.0.0.1:3773`，进程 PID `3377111`；没有扩大监听范围。
- OCI 本机读取 `/` 的十二次响应：中位数约 0.002 秒，最大 0.031 秒。
- 既有 Mac 桌面 SSH 转发读取 `/` 的十二次响应：中位数 1.757 秒，范围 0.773–2.904 秒，全部 HTTP 200。完整响应耗时为对照数据，不把它直接等同于客户端每次一秒响应头探测失败。
- 独立转发的响应头计时也有 1.388–2.872 秒的成功响应，证实单次响应头超过一秒并不表示后端不可用。
- Mac 到 OCI ICMP RTT 六次：256–818 毫秒，平均 389 毫秒，无样本内 ICMP 丢包。SSH TCP 的 `ss -tin` 现场数据同时存在累计重传和乱序，不能用 ICMP 样本内无丢包排除 TCP 链路问题。
- OCI 两条长期 SSH TCP 连接的 `bytes_retrans/bytes_sent` 约为 3% 和 11%，拥塞窗口仅 2–3 个 segment；这是连接累计重传字节比例，不是精确链路丢包率。统计没有包含凭据或客户端公网地址。
- 06:50–07:10 UTC 的 sysstat：CPU 平均空闲约 69%，可用内存约 18 GiB。虽然存在 I/O 等待，证据不支持把本次持续重连归因于主机 CPU 或内存耗尽。

## 客户端日志与源码绑定

本机 `/Applications/T3 Code (Alpha).app` 版本为 `0.0.45`。诊断日志位于 `~/.t3/userdata/logs/desktop.trace.ndjson*`。

- 2026-10-14 06:53:42 UTC，既有隧道因 `Backend readiness probe exceeded 1000ms` 被标为 `existing.stale`。
- 06:45:00–07:07:40 UTC 窗口中，日志记录 14 次 `ssh.tunnel.ready.failed`、6 次 `ssh.environment.tunnel.existing.stale`、20 次整体 readiness 超时。
- 隧道失败时仍为 `processRunning=true`、`localPortListening=true`。
- 07:07:01 UTC 出现 `ssh.tunnel.ready`；随后 SSH environment bootstrap 和会话认证成功。

官方 v0.0.45 源码 `packages/ssh/src/tunnel.ts`：

- `SSH_READY_PROBE_TIMEOUT_MS = 1_000`：每次探测响应头的期限。
- `SSH_READY_TIMEOUT_MS = 20_000`：新隧道的整体 readiness 期限。
- `ensureTunnelEntry` 对既有隧道只给 `timeoutMs: 2_000`；失败后调用 `closeTunnelEntry` 并新建转发。
- `packages/shared/src/httpReadiness.ts` 在单次请求上应用探测超时，另在整个请求/重试流程上应用整体期限；响应正文消费也处于整体流程内。

官方已有对应报告 [issue #7733](https://github.com/pingdotgg/t3code/issues/7733)。截至本次检查，修复 [PR #7815](https://github.com/pingdotgg/t3code/pull/7815) 仍为 Open，官方最新稳定版本仍是 v0.0.45；当前 `main` 源码仍保留一秒探测常量。不能声称升级现有稳定版即可修好。

## 缓解测试与处理边界

独立临时 SSH 隧道压缩 A/B：

1. 两边相同 `IPQoS=none`、各十五个完整响应：无压缩中位数 1.117 秒、12/15 超过一秒；压缩中位数 0.546 秒、2/15 超过一秒。
2. 使用原有默认 IPQoS、分别十二个响应头计时复测：无压缩中位数 0.8705 秒、5/12 超过一秒；压缩中位数 1.052 秒、6/12 超过一秒。

第二轮表明压缩没有稳定解决期限误判，不能据第一轮保证收益，因此未写入连接配置。网络瞬时状态、连接拥塞窗口及 IPQoS 都可能影响这些小样本结果。

真正针对本次机制的修复是只修改 Mac 客户端：将桌面侧单次 SSH 探测放宽至八秒，既有隧道检查的整体期限放宽至二十秒，并保留远端本机一秒探测；与官方 PR #7815 的方案一致。当前版本没有受支持的用户设置可修改这些常量。该补丁未在本次安装，也没有修改签名应用或为加载修改而重启客户端。

备用方案是用独立固定 SSH 转发访问浏览器界面，避开桌面托管 SSH 的一秒 readiness 门槛；官方 issue #7733 提供同类 workaround。实际启用需要单独完成浏览器配对验证，不能由本次 HTTP 200 声称浏览器已经获授权可用。本次没有创建新配对凭据或更改当前会话。

## Changed / Where / Verified / Rollback

- Changed：新增本诊断记录和运行手册中的 T3 Code 入口。
- Where：本地文档；没有生产配置或软件变更。
- Verified：服务同一 PID、当前 HTTP 入口、客户端恢复同步及继续 Working，独立临时转发全部退出。
- Rollback：没有生产变更需要回滚；本次不恢复 SQLite、会话、项目数据或旧任务。没有新增远端文件或长期大文件。

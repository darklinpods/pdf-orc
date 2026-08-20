# ADR 0009：CamScanner 分享链接导入采用本地桥接服务

- 状态：已接受
- 日期：2026-08-20

## 背景

用户希望把扫描全能王（CamScanner）的分享链接直接粘贴进工具并自动导入，而不是先手动下载 PDF 再拖入。

CamScanner 公开分享的下载链路已经验证（见 `scripts/camscanner-share-download.mjs`）：
- `query_share_info_with_link` 取页序，`download_resize_jpg` 取全分辨率页图，全程无需登录；
- 但这两个端点位于 `cs8.intsig.net`，**不返回 CORS 头**，浏览器页面直接 fetch 会被同源策略拦截；
- 下载 + pdf-lib 合成逻辑是 Node 侧代码，无法在浏览器原生运行。

因此「浏览器直接下载」不可行，需要在浏览器与 CamScanner 之间加一道本地桥。

## 决策

引入**本地桥接服务**（`scripts/camscanner-bridge.mjs`）：
- Node HTTP 服务，仅监听 `127.0.0.1:8787`（本机），无鉴权（单用户）。
- 端点：`POST /import`（body `{ url }`，返回 PDF 字节 + 文件名头）、`GET /health`。
- 桥内复用 `camscanner-share-lib.mjs` 完成「解析链接 → 下载页图 → 合成 PDF」。
- 前端「从扫描全能王导入」把链接 POST 给桥，取回 PDF 字节，走既有的 `mergeSources` 导入管线。
- CORS：桥返回 `Access-Control-Allow-Origin: *`，仅对 localhost 场景放开。

## 影响

- 优点：主应用保持纯前端（ADR 0001 核心不变）；桥是可选本地伴随进程，无部署、无云；复用已验证的下载逻辑。
- 代价：用户需额外启动桥（`npm run bridge`）；多了一个常驻进程；桥与前端版本需一致（都在本仓库）。
- 约束：
  - 桥仅本机可用，不暴露到局域网/公网；监听地址固定 `127.0.0.1`。
  - 桥未启动时，前端给出明确提示「请先运行 npm run bridge」，不静默失败。
  - 下载的案卷数据只经过本机内存/临时目录，不落盘到 git（cs-inbox 已忽略）。
  - 未来若 CamScanner 分享 API 变化，只需改 `camscanner-share-lib.mjs`，前端与桥协议不变。
- 验证：桥启动后 `curl POST /import` 返回有效 PDF；前端粘贴链接成功导入并可撤销。

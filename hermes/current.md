# 当前工作

更新时间：2026-08-20

## 阶段

v0.1（MVP）完成：脚手架、文档核心、渲染边界、阅读视图、页面管理（含分组）、导出边界、真实扫描件 spike、CamScanner 分享链接导入（本地桥接）均已落地。下一步进入 v0.2（插入页面）。

## 当前分支

`main`（最近提交 `55cf22e`）

## 当前状态

- 设计评审已闭环：6 项决策全部按默认值确认，硬件基线 macOS 16GB。
- 脚手架：Vite 8.2 + React 19.2 + TS 6.0 + Tailwind 4.3 + Vitest 4.1 + ESLint。
- 文档核心（`src/core/`）：模型、可逆命令、撤销/重做、导入负载、选择器、分组纯函数（labels.ts）、拖拽排序纯函数（dnd.ts）。
- 渲染边界（`src/render/`）：worker 单例 + 源注册表、renderPageToCanvas、fitScale、LRU、PageRenderer。
- 状态接线（`src/store/useDocumentStore.ts`）：文档状态 + 历史 + 导入。
- 阅读视图（`src/views/ReaderView.tsx`）：缩略图栏 + 大图 + 缩放/翻页。
- 页面管理视图（`src/views/ManagerView.tsx`）：大缩略图网格、多选（单击/Cmd/Shift）、dnd-kit 拖动排序（单页/选中组）、拖拽落点插入指示符（蓝色插入线 + 落定页码，与 `computeDropPreview` 落点语义一致）、hover 旋转/删除、左侧分组面板、工具栏（全选/旋转/删除/分组到）。
- 分组（ADR 0008 标签派生）：label 存组名，组列表派生，颜色哈希，复用 relabel 命令。
- 双视图切换（`src/App.tsx`）：页面管理 / 阅读。
- 导出边界（`src/export/`）：导出计划（plan，含旋转归一化与文件名建议）→ pdf-lib 组装（build，copyPages + 叠加旋转）→ Web Worker（export.worker，避免阻塞 UI）→ 下载（exporter，源字节经 `proxy.getData()` 取回并 transfer 移交 worker）；App 头部「导出」按钮 + 进度浮层 + 错误/成功提示。
- 分组不强制顺序；拖动排序仅在「全部」视图开放（筛选视图只读）。
- 版本时间戳（开发辅助）：页头显示 `v0.1 · <本地时间 精确到秒>`，由 vite `define` 在 dev server 启动/构建时注入 `__BUILD_TIME__`。
- CamScanner 分享链接导入（ADR 0009）：`scripts/camscanner-share-lib.mjs`（分享→PDF 共享逻辑，公开分享免登录）+ `scripts/camscanner-bridge.mjs`（本地 HTTP 桥，127.0.0.1:8787，`POST /import` + `GET /health` + CORS）+ `scripts/camscanner-share-download.mjs`（CLI）。前端「扫描全能王」按钮 → 桥 → `store.importPdf` 导入管线。
- 页面拼合（ADR 0010）：选中 2 页 →「拼合」→ 上下/左右排版 + 「是否删除原两页」复选框 → composite 命令（删原两页 + 插入合成页）或单条 insert；合成页 = canvas 合成 + pdf-lib 单页 PDF + 合成源，零改动文档核心。
- 扫描件 spike（2026-08-20，3 份 CamScanner 真实样本，共 230 页）：全部为 JPEG（DCTDecode）编码；pdf-lib 单份复制+保存成功且体积几乎不变（约 1.00x）；三份合并 230 页耗时约 600ms、输出 157.7MB、旋转叠加正确。JPEG2000/CCITT/JBIG2 未在样本中出现，风险仍待其他来源样本验证。

## 已确认决策（2026-08-19）

1. 多源合并进入 MVP。
2. 旋转/删除/插入为 P1（v0.2）；MVP 只做排序。
3. 分组标签提前到 P1。
4. 产品名称暂用 `pdf-orc`。
5. 浏览器目标：现代 Chrome/Edge/Safari。
6. 性能基线：单份 100+ 页、合并数百页流畅（ADR 0007）。
7. 硬件基线：macOS、16GB 内存起步。

## 自动验证

- `npm run test`：10 个测试文件、76 个测试通过（命令/撤销/重做/composite/LRU/fitScale/分组/dnd/落点预览/排版/导出计划/页序映射）。
- `npm run build`：通过（pdf.js worker 独立 chunk 1.17MB，导出 worker 422KB，主包 693KB）。
- `npm run lint`：通过（scripts/ 已加入忽略）。
- `npx tsc -b`：通过。
- `git diff --check`：通过。

## 已知未完成验证

- 页面管理视图的浏览器端交互（拖动排序、多选、hover、分组、拼合）需手工打开 `npm run dev` 验证。
- 拼合的浏览器路径（renderPageToCanvas → compositeCanvases → canvasToSinglePagePdf → 合成源导入）未自动化；纯逻辑（composite 命令、computeCombineLayout）已有单测。
- CamScanner 导入的前端 UI 全流程需在浏览器 + `npm run bridge` 下手工验证。
- JPEG2000/CCITT/JBIG2 编码的扫描件导出兼容性仍未覆盖（已测样本均为 JPEG）。

## 下一步（按顺序）

1. 插入页面（v0.2）：从其他 PDF / 空白页插入（命令模型 `insert` 已预留）。
2. 页码标注与卷内目录（v0.3）。

## 关注点

- pdf-lib 对 JPEG 扫描件已验证兼容且无体积膨胀；JPEG2000/CCITT/JBIG2 仍为开放风险（ADR 0002，遇样本用 `scripts/export-spike.mjs` 复验）。
- 无服务端 = 所有持久化取舍围绕"最终下载交付"展开（ADR 0004）。
- 数百页性能依赖懒渲染 + 缓存 + 虚拟滚动，网格不得全量渲染（ADR 0007）。

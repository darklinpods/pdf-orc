# 当前工作

更新时间：2026-08-20

## 阶段

v0.1 完成；v0.2 进行中——插入页面已实现。剩余 v0.2：N 页拼合与「裁剪到标准卡尺寸」、批量操作强化（部分已具备）；v0.3：页码标注与卷内目录。

## 当前分支

`main`（最近提交 `db48b33`）

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
- 导出边界（`src/export/`）：导出计划（plan，含旋转归一化、文件名建议与子集 pageIds 支持）→ pdf-lib 组装（build，copyPages + 叠加旋转）→ Web Worker（export.worker，避免阻塞 UI）→ 下载（exporter，源字节经 `proxy.getData()` 取回并 transfer 移交 worker）；App 头部「导出」按钮 + 进度浮层 + 错误/成功提示；导出范围跟随当前筛选（页面管理视图：全部 / 未分组 / 某分组；阅读视图：全部），按钮标签随筛选变化（导出 / 导出未分组 / 导出「组名」）。
- 分组不强制顺序；拖动排序仅在「全部」视图开放（筛选视图只读）。
- 版本时间戳（开发辅助）：页头显示 `v0.1 · <本地时间 精确到秒>`，由 vite `define` 在 dev server 启动/构建时注入 `__BUILD_TIME__`。
- CamScanner 分享链接导入（ADR 0009）：`scripts/camscanner-share-lib.mjs`（分享→PDF 共享逻辑，公开分享免登录）+ `scripts/camscanner-bridge.mjs`（本地 HTTP 桥，127.0.0.1:8787，`POST /import` + `GET /health` + CORS）+ `scripts/camscanner-share-download.mjs`（CLI）。前端「扫描全能王」按钮 → 桥 → `store.importPdf` 导入管线。
- 页面拼合（ADR 0010）：选中 2 页 →「拼合」→ 上下/左右排版 + 「是否删除原两页」复选框 → composite 命令（删原两页 + 插入合成页）或单条 insert；合成页 = canvas 合成 + pdf-lib 单页 PDF + 合成源，零改动文档核心。
- 插入页面（v0.2）：工具栏「插入」→ 弹窗（空白页数量 / 从 PDF 文件 + 插入位置：开头/末尾/选中页之后）→ `insertBlankPages` / `insertPdfAt`；空白页 = pdf-lib 生成单页空白 A4 缓存复用；PDF 页 = buildImportPayload + `insert` 命令。
- 扫描件 spike（2026-08-20，3 份 CamScanner 真实样本，共 230 页）：全部为 JPEG（DCTDecode）编码；pdf-lib 单份复制+保存成功且体积几乎不变（约 1.00x）；三份合并 230 页耗时约 600ms、输出 157.7MB、旋转叠加正确。JPEG2000/CCITT/JBIG2 未在样本中出现，风险仍待其他来源样本验证。

## 已确认决策（2026-08-19）

1. 多源合并进入 MVP。
2. 旋转/删除/插入为 P1（v0.2）；MVP 只做排序。
3. 分组标签提前到 P1。
4. 产品名称暂用 `pdf-orc`。
5. 浏览器目标：现代 Chrome/Edge/Safari。
6. 性能基线：单份 100+ 页、合并数百页流畅（ADR 0007）。
7. 硬件基线：macOS、16GB 内存起步。
8. 证据标记不单独立项（2026-08-20 定稿）：原「区分提交/非提交页 + 单独导出证据」需求，由现有「分组 + 导出当前筛选」满足（建一个「证据」组、筛选到该组、导出即只导出证据页）；不新增 `submitted` 标记。

## 自动验证

- `npm run test`：11 个测试文件、85 个测试通过（命令/撤销/重做/composite/LRU/fitScale/分组/筛选/dnd/落点预览/排版/空白页/导出计划/子集导出/页序映射）。
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

1. v0.2 剩余：N 页拼合与「裁剪到标准卡尺寸（85.6×54mm，身份证）」，批量操作强化（部分已具备）。
2. v0.3：页码标注、卷内目录生成、空白页/重复页检测。

## 待办 / 想法（未定，暂不施工）

- 分组排序（2026-08-20 讨论，尚未定稿）：
  - 需求：能否给分组（左栏）单独排序。
  - 结论（设计）：分组顺序与页面顺序是正交的两个维度，各司其职——页面顺序（PageList 唯一事实源）管最终页序与「全部/导出全部」；分组顺序仅管左栏显示顺序与未来的「按分组导出/卷内目录」组排列。组合规则 = 组序（外层）× 组内页序（内层）；绝不覆盖最终页序。
  - 拟议实现：`DocumentState.groupOrder: string[]` + 可逆命令 `setGroupOrder` + `collectGroups` 按 groupOrder 排序（新组追加末尾）+ 左栏 dnd 拖拽；需处理改名同步、删组移除、撤销一致。
  - 未决：是否要做、何时做（用户先考虑成熟）。

## 关注点

- pdf-lib 对 JPEG 扫描件已验证兼容且无体积膨胀；JPEG2000/CCITT/JBIG2 仍为开放风险（ADR 0002，遇样本用 `scripts/export-spike.mjs` 复验）。
- 无服务端 = 所有持久化取舍围绕"最终下载交付"展开（ADR 0004）。
- 数百页性能依赖懒渲染 + 缓存 + 虚拟滚动，网格不得全量渲染（ADR 0007）。

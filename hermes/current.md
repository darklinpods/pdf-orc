# 当前工作

更新时间：2026-08-20

## 阶段

v0.1（MVP）施工中：脚手架、文档核心、渲染边界、阅读视图、页面管理（含分组）、导出边界、真实扫描件 spike 均已完成，进入 v0.2（插入页面）。

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

- `npm run test`：8 个测试文件、70 个测试通过（命令/撤销/重做/LRU/fitScale/分组/dnd 拖拽重排/落点预览/导出计划/导出页序与旋转映射）。
- `npm run build`：通过（pdf.js worker 独立 chunk 1.17MB，导出 worker 422KB，主包 693KB）。
- `npm run lint`：通过（scripts/ 已加入忽略）。
- `npx tsc -b`：通过。
- `git diff --check`：通过。

## 已知未完成验证

- 页面管理视图的浏览器端交互（拖动排序、多选、hover、分组）需手工打开 `npm run dev` 验证；headless Chrome 在本环境不稳定，未自动化。
- 选中组拖动为「拖放后一次性提交」简化实现（拖动过程中无逐帧重排预览），是否符合预期需实测。
- 导出的浏览器端全流程（点击导出 → 进度 → 下载文件）需手工验证；核心组装逻辑已由 `build.test.ts` 在 Node 环境用 pdf-lib 覆盖。
- JPEG2000/CCITT/JBIG2 编码的扫描件导出兼容性仍未覆盖（已测的 3 份 CamScanner 样本均为 JPEG）；遇到此类编码样本需重跑 `scripts/export-spike.mjs`。

## 下一步（按顺序）

1. 插入页面（v0.2）：从其他 PDF / 空白页插入（命令模型 `insert` 已预留）。
2. 页码标注与卷内目录（v0.3）。

## 关注点

- pdf-lib 对 JPEG 扫描件已验证兼容且无体积膨胀；JPEG2000/CCITT/JBIG2 仍为开放风险（ADR 0002，遇样本用 `scripts/export-spike.mjs` 复验）。
- 无服务端 = 所有持久化取舍围绕"最终下载交付"展开（ADR 0004）。
- 数百页性能依赖懒渲染 + 缓存 + 虚拟滚动，网格不得全量渲染（ADR 0007）。

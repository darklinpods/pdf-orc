# 当前工作

更新时间：2026-08-19

## 阶段

v0.1（MVP）施工中：脚手架、文档核心、渲染边界、阅读视图已完成，进入管理模式。

## 当前分支

`main`（最近提交 `ed44648`）

## 当前状态

- 设计评审已闭环：6 项决策全部按默认值确认（见下），硬件基线 macOS 16GB。
- 脚手架：Vite 8.2 + React 19.2 + TS 6.0 + Tailwind 4.3 + Vitest 4.1 + ESLint。
- 文档核心（`src/core/`，纯逻辑零 DOM）：模型、可逆命令、撤销/重做、导入负载、选择器。
- 渲染边界（`src/render/`）：worker 单例 + 源注册表、renderPageToCanvas、fitScale、LRU、PageRenderer。
- 状态接线（`src/store/useDocumentStore.ts`）：文档状态 + 历史 + 导入（文件→pdfSourceManager→mergeSources 命令）。
- 阅读视图（`src/views/ReaderView.tsx`）：左侧缩略图栏（点击跳转、活动高亮、自动滚动）+ 右侧大图（fit-width 缩放、键盘/滚轮翻页）。
- `src/components/LazyMount.tsx`：IntersectionObserver 惰性挂载（渐进渲染缩略图）。
- `scripts/pdf-lib-spike.mjs`：node 环境验证 pdf-lib 合并/重排/旋转/保存（ADR 0002 早期验证通过）。
- pdf.js v6 / pdf-lib API 差异已确认并落地（见代码注释）：getViewport rotation 覆盖、loadingTask.destroy、create/load/embedFont 均 async。

## 已确认决策（2026-08-19）

1. 多源合并进入 MVP。
2. 旋转/删除/插入为 P1（v0.2）；MVP 只做排序。
3. 分组标签提前到 P1。
4. 产品名称暂用 `pdf-orc`。
5. 浏览器目标：现代 Chrome/Edge/Safari。
6. 性能基线：单份 100+ 页、合并数百页流畅（ADR 0007）。
7. 硬件基线：macOS、16GB 内存起步。

## 自动验证

- `npm run test`：4 个测试文件、39 个测试通过（命令与逆操作、reorder 边界、撤销/重做、合并语义、不可变性、LRU、fitScale）。
- `npm run build`：通过（pdf.js worker 独立 chunk 1.17MB，主包 619KB，已过 ?worker 打包验证）。
- `npm run lint`：通过。
- `npx tsc -b`：通过。
- `git diff --check`：通过。

## 已知未完成验证

- 阅读视图的浏览器端真实渲染（导入真实 PDF → 缩略图栏 + 大图翻页），需手工打开 `npm run dev` 验证；headless Chrome 在本环境不稳定，未自动化。
- pdf.js 渲染真实案卷扫描件（含 100+ 页）的内存峰值。
- pdf-lib 对真实扫描件（JPEG2000/CCITT 编码）的导出兼容性与体积变化（node spike 已过，真实扫描件未验）。
- 管理模式、导出均未实现。

## 下一步（按顺序）

1. 管理模式：dnd-kit 排序、多选、hover 操作（旋转/删除/插入）、工具栏、撤销。
2. 导出边界：exporter（pdf-lib）+ WYSIWYG 验证 + 下载。
3. 真实扫描件 spike（渲染兼容性 + 内存峰值 + 导出体积）。

## 关注点

- pdf-lib 对扫描件编码的兼容性必须 spike 先行（ADR 0002）。
- 无服务端 = 所有持久化取舍围绕"最终下载交付"展开（ADR 0004）。
- 数百页性能依赖懒渲染 + 缓存 + 虚拟滚动，网格不得全量渲染（ADR 0007）。

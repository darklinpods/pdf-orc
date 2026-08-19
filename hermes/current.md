# 当前工作

更新时间：2026-08-19

## 阶段

v0.1（MVP）施工中：脚手架、文档核心、渲染边界已完成，进入阅读视图。

## 当前分支

`main`（最近提交 `a533d80`）

## 当前状态

- 设计评审已闭环：6 项决策全部按默认值确认（见下），硬件基线 macOS 16GB。
- 脚手架：Vite 8.2 + React 19.2 + TS 6.0 + Tailwind 4.3 + Vitest 4.1 + ESLint。
- 文档核心（`src/core/`，纯逻辑零 DOM）：
  - `types.ts`：PageRef/SourceRef/DocumentState 模型与不变量（孤儿源清理、nextPageId 水位单调、sources 无序注册表）。
  - `commands.ts`：可逆命令 apply + 逆操作（reorder/setOrder/rotate/delete/insert/mergeSources/relabel）。
  - `history.ts`：撤销/重做栈（上限 100，可配；旋转命令支持手势合并）。
  - `sources.ts`：导入负载构建（importCommand）。
  - `document.ts`：选择器与工厂。
- 渲染边界（`src/render/`）：
  - `pdfjs.ts`：worker 单例（`?worker` 独立 chunk）+ 源注册表（惰性打开/关闭，经 loadingTask.destroy 释放）。
  - `renderPage.ts`：`renderPageToCanvas`（AbortSignal 取消；rotation 叠加 page.rotate 保留源固有旋转）。
  - `pageScale.ts`：fitScale 纯函数（独立零 DOM，可单测）。
  - `thumbnailCache.ts`：LRU（上限 500）+ 缓存键（向上取整到百位归桶）。
  - `PageRenderer.tsx`：单页渲染组件（thumbnail 走 LRU 位图缓存 / full 直渲，异步 + 取消）。
- pdf.js v6 API 差异已确认并落地：`getViewport` 的 rotation 参数会覆盖页面 /Rotate（须叠加 `page.rotate`）；`PDFDocumentProxy` 无 `destroy()`（走 `loadingTask.destroy()`）。

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

- pdf.js 在真实浏览器中渲染真实案卷扫描件（含 100+ 页）的 smoke 测试与内存峰值（需真实 PDF + 浏览器手工验证）。
- 真实案卷扫描件的 pdf-lib 导出兼容性 spike（ADR 0002）。
- 阅读视图、管理模式、导出均未实现。
- 主包 619KB：本地工具可接受，后续可用动态 import 按需加载 pdf.js 优化（可选）。

## 下一步（按顺序）

1. 阅读视图：缩略图栏 + 大图 + 缩放/跳页（消费 PageRenderer 与 pdfSourceManager）。
2. 管理模式：dnd-kit 排序、多选、hover 操作、工具栏。
3. 导出边界：exporter + WYSIWYG 验证。
4. 真实扫描件 spike（渲染兼容性 + 内存峰值 + 导出体积）。

## 关注点

- pdf-lib 对扫描件编码的兼容性必须 spike 先行（ADR 0002）。
- 无服务端 = 所有持久化取舍围绕"最终下载交付"展开（ADR 0004）。
- 数百页性能依赖懒渲染 + 缓存 + 虚拟滚动，网格不得全量渲染（ADR 0007）。

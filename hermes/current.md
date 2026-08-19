# 当前工作

更新时间：2026-08-19

## 阶段

v0.1（MVP）施工中：脚手架与文档核心已完成，进入渲染边界。

## 当前分支

`main`（首次提交 `9272e12`）

## 当前状态

- 设计评审已闭环：6 项决策全部按默认值确认（见下），硬件基线 macOS 16GB。
- 脚手架：Vite 8.2 + React 19.2 + TS 6.0 + Tailwind 4.3 + Vitest 4.1 + ESLint。
- 文档核心（`src/core/`，纯逻辑零 DOM）：
  - `types.ts`：PageRef/SourceRef/DocumentState 模型与不变量（孤儿源清理、nextPageId 水位单调、sources 无序注册表）。
  - `commands.ts`：可逆命令 apply + 逆操作（reorder/setOrder/rotate/delete/insert/mergeSources/relabel）。
  - `history.ts`：撤销/重做栈（上限 100，可配；旋转命令支持手势合并）。
  - `sources.ts`：导入负载构建（importCommand）。
  - `document.ts`：选择器与工厂。
- 关键设计修正（测试驱动发现）：
  1. reorder 的逆操作改为 `setOrder`（分散 from 无法用单个 reorder 还原）。
  2. mergeSources/insert 必须推进 nextPageId（否则 id 重用冲突）。
  3. sources 是无序注册表，顺序不构成文档语义。

## 已确认决策（2026-08-19）

1. 多源合并进入 MVP。
2. 旋转/删除/插入为 P1（v0.2）；MVP 只做排序。
3. 分组标签提前到 P1。
4. 产品名称暂用 `pdf-orc`。
5. 浏览器目标：现代 Chrome/Edge/Safari。
6. 性能基线：单份 100+ 页、合并数百页流畅（ADR 0007）。
7. 硬件基线：macOS、16GB 内存起步。

## 自动验证

- `npm run test`：2 个测试文件、28 个测试通过（命令与逆操作、reorder 边界、撤销/重做、合并语义、不可变性）。
- `npm run build`：通过（dist 产物 190KB JS / 5.5KB CSS）。
- `npm run lint`：通过。
- `npx tsc -b`：通过。
- `git diff --check`：通过。

## 已知未完成验证

- pdfjs-dist v6 的 worker 初始化与 v4/v5 配置差异，需在渲染边界确认。
- 真实案卷扫描件（含 100+ 页）的 pdf.js 渲染 + pdf-lib 导出兼容性 spike。
- 阅读视图、管理模式、导出均未实现。

## 下一步（按顺序）

1. 渲染边界：pdf.js worker 单例、PageRenderer、缩略图 LRU 缓存。
2. 阅读视图：缩略图栏 + 大图 + 缩放/跳页。
3. 管理模式：dnd-kit 排序、多选、hover 操作、工具栏。
4. 导出边界：exporter + WYSIWYG 验证。
5. 真实扫描件 spike（渲染兼容性 + 内存峰值 + 导出体积）。

## 关注点

- pdf-lib 对扫描件编码的兼容性必须 spike 先行（ADR 0002）。
- 无服务端 = 所有持久化取舍围绕"最终下载交付"展开（ADR 0004）。
- 数百页性能依赖懒渲染 + 缓存 + 虚拟滚动，网格不得全量渲染（ADR 0007）。

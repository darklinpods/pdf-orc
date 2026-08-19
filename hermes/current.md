# 当前工作

更新时间：2026-08-19

## 阶段

v0.1（MVP）施工中：脚手架、文档核心、渲染边界、阅读视图、页面管理（含分组）已完成，进入导出边界。

## 当前分支

`main`（最近提交 `192a7c5`）

## 当前状态

- 设计评审已闭环：6 项决策全部按默认值确认，硬件基线 macOS 16GB。
- 脚手架：Vite 8.2 + React 19.2 + TS 6.0 + Tailwind 4.3 + Vitest 4.1 + ESLint。
- 文档核心（`src/core/`）：模型、可逆命令、撤销/重做、导入负载、选择器、分组纯函数（labels.ts）、拖拽排序纯函数（dnd.ts）。
- 渲染边界（`src/render/`）：worker 单例 + 源注册表、renderPageToCanvas、fitScale、LRU、PageRenderer。
- 状态接线（`src/store/useDocumentStore.ts`）：文档状态 + 历史 + 导入。
- 阅读视图（`src/views/ReaderView.tsx`）：缩略图栏 + 大图 + 缩放/翻页。
- 页面管理视图（`src/views/ManagerView.tsx`）：大缩略图网格、多选（单击/Cmd/Shift）、dnd-kit 拖动排序（单页/选中组）、hover 旋转/删除、左侧分组面板、工具栏（全选/旋转/删除/分组到）。
- 分组（ADR 0008 标签派生）：label 存组名，组列表派生，颜色哈希，复用 relabel 命令。
- 双视图切换（`src/App.tsx`）：页面管理 / 阅读。
- 分组不强制顺序；拖动排序仅在「全部」视图开放（筛选视图只读）。

## 已确认决策（2026-08-19）

## 已确认决策（2026-08-19）

1. 多源合并进入 MVP。
2. 旋转/删除/插入为 P1（v0.2）；MVP 只做排序。
3. 分组标签提前到 P1。
4. 产品名称暂用 `pdf-orc`。
5. 浏览器目标：现代 Chrome/Edge/Safari。
6. 性能基线：单份 100+ 页、合并数百页流畅（ADR 0007）。
7. 硬件基线：macOS、16GB 内存起步。

## 自动验证

- `npm run test`：6 个测试文件、53 个测试通过（命令/撤销/重做/LRU/fitScale/分组/dnd 拖拽重排）。
- `npm run build`：通过（worker 独立 chunk 1.17MB，主包 690KB）。
- `npm run lint`：通过（scripts/ 已加入忽略）。
- `npx tsc -b`：通过。
- `git diff --check`：通过。

## 已知未完成验证

- 页面管理视图的浏览器端交互（拖动排序、多选、hover、分组）需手工打开 `npm run dev` 验证；headless Chrome 在本环境不稳定，未自动化。
- 选中组拖动为「拖放后一次性提交」简化实现（拖动过程中无逐帧重排预览），是否符合预期需实测。
- pdf-lib 对真实扫描件（JPEG2000/CCITT 编码）的导出兼容性与体积变化。
- 导出功能未实现。

## 下一步（按顺序）

1. 导出边界：exporter（pdf-lib：按 PageList 复制页、应用旋转、合并、下载）+ WYSIWYG 验证。
2. 真实扫描件 spike（渲染兼容性 + 内存峰值 + 导出体积）。
3. 插入页面（v0.2）、页码标注与卷内目录（v0.3）。

## 关注点

- pdf-lib 对扫描件编码的兼容性必须 spike 先行（ADR 0002）。
- 无服务端 = 所有持久化取舍围绕"最终下载交付"展开（ADR 0004）。
- 数百页性能依赖懒渲染 + 缓存 + 虚拟滚动，网格不得全量渲染（ADR 0007）。

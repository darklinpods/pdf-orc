# 架构说明

## 技术基线

- React 19.2 + TypeScript 6.0（strict）
- Vite 8.2 + Tailwind CSS 4.3
- pdf.js（pdfjs-dist 6.2）：页面与缩略图渲染（Web Worker）
- pdf-lib 1.17.1：导出与页面操作（复制、重排、旋转、合并）
- @dnd-kit/core 6.3 + @dnd-kit/sortable 10：排序与多选拖动
- Vitest 4.1：纯逻辑测试
- 无后端、无数据库、无服务端存储
- 运行环境基线：macOS，内存 16GB 起步（更低内存设备不在考虑范围）

## 架构原则

三个边界分离：**文档模型（页面列表）→ 渲染层 → 导出层**。

```text
多份源 PDF（用户选择，ArrayBuffer）
  -> sources：pdf.js 惰性解析，每份一个 DocumentRef
  -> PageList：PageRef[]（唯一事实源，纯数据）
  -> 渲染层：阅读/管理视图按需渲染 canvas（LRU 缓存）
  -> 用户操作 -> Command（可逆）-> reducer 应用 -> 重渲染 + 历史栈
  -> 导出层：遍历 PageList -> pdf-lib 构建新 PDF -> 下载
```

- PageList 是唯一事实源；视图与导出只读它，操作只通过命令修改它。
- 组件只做展示与交互；pdf.js / pdf-lib 调用隔离在 `render/` 与 `export/` 边界。
- 大文件与渲染性能问题在渲染边界内解决，不污染文档模型。

## 代码分层（施工时落地）

### 应用外壳与视图

- `src/App.tsx`：模式切换（阅读/管理）与全局状态接线。
- `src/views/ReaderView.tsx`：左侧缩略图栏 + 右侧大图查看。
- `src/views/ManagerView.tsx`：网格 + 多选 + dnd-kit 排序 + hover 操作 + 工具栏。
- `src/components/`：Toolbar、PageThumb、ConfirmDialog 等。

### 文档核心（纯逻辑，零 DOM 依赖）

- `src/core/types.ts`：PageRef、SourceRef、Rotation、Command 类型。
- `src/core/document.ts`：PageList reducer 与派生选择器。
- `src/core/commands.ts`：reorder/rotate/delete/insert/merge/relabel 及逆操作。
- `src/core/history.ts`：撤销/重做栈（上限、连续命令合并）。
- `src/core/sources.ts`：源 PDF 注册、惰性加载与释放。

### 渲染边界

- `src/render/pdfjs.ts`：worker 单例、DocumentRef 打开/关闭。
- `src/render/PageRenderer.tsx`：单页 canvas（scale/rotation/quality 参数）。
- `src/render/thumbnailCache.ts`：LRU 缩略图缓存。

### 导出边界

- `src/export/exporter.ts`：根据 PageList 构建新 PDF（复制页、应用旋转、合并、元数据）。

## 状态模型

```text
DocumentState: { pages: PageRef[]; sources: SourceRef[]; nextPageId }
UI 状态（独立，不进撤销栈）: mode / currentPage / selection / zoom / scroll
历史: past: Command[]; future: Command[]
```

- 文档状态与 UI 状态严格分离；UI 状态不进入撤销栈。
- 命令必须是纯数据、可逆；连续同类命令（如连续旋转 3 次）允许合并为一条历史。

## 渲染策略（按 100+ 页单份、数百页合并设定内存预算）

- 阅读模式大图：同一时刻最多保留 3 个全尺寸 canvas（当前页 ± 前后各 1 页预取），离开视口即释放；scale 随缩放调整，**缩放走"按目标 scale 重渲染"，不用 canvas 拉伸**；canvas 缓存键 = `source:page:rotation:scaleBucket`。
- 管理模式缩略图：统一低分辨率渲染（约 160–220px 宽），LRU 缓存上限默认 300 张（按内存预算折算，可配）；管理网格与阅读模式缩略图栏都做**虚拟滚动，只渲染可见项**。
- 源 DocumentRef 按需打开、离开后释放；pdf.js 单 worker；源 ArrayBuffer 通过 transferable 移交 worker，避免复制。
- 单份文件过大（如 >300MB）时给出明确提示，不静默加载。
- 单页渲染失败不影响其他页。
- 数百页性能目标依靠懒渲染 + 缓存上限 + 虚拟滚动达成，**不做全量预渲染**。

## 导出策略

- 每次导出都从当前 PageList 全量重建，绝不修改源文件。
- 用 pdf-lib `copyPages` 复制各源页面，按 PageList 顺序组装，并应用每页旋转。
- 已知限制：pdf-lib 重新序列化可能改变文件体积；JPEG2000/CCITT/JBIG2 编码页面可能复制失败或降级。开工首个 spike 用真实扫描件验证兼容性；失败时给出明确中文错误并提示"打印为 PDF"折中。
- 大文件导出需进度提示（合并数百页可能数秒至数十秒，不得阻塞 UI）。

## 扩展新能力

- 新命令类型：加入 `commands.ts`（含逆操作）→ reducer 分支 → 测试。
- 新视图能力（如卷内目录生成）：独立模块，通过导出层组合，不改文档核心。
- OCR/AI 等重能力：独立模块 + 明确异步边界，不进文档模型。

## 关键风险

- 大扫描件内存占用（pdf.js 全量加载、canvas 显存、LRU 缓存）→ 见渲染策略的内存预算与 ADR 0007；单源大小提示。
- 数百页导出耗时 → 必须显示进度（合并数百页可能数秒至数十秒）。
- pdf-lib 对部分编码页复制失败/体积膨胀 → 首个 spike 验证 + 降级提示。
- 浏览器 DnD 在大量元素下性能下降 → 虚拟化缩略图、限制同时渲染数量。
- 撤销栈内存增长 → 上限 + 命令合并。
- 无服务端 = 单机交付：分享/备份依赖导出文件（用户已接受）。

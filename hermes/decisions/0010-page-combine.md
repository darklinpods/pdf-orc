# ADR 0010：页面拼合采用「canvas 合成 + 合成源 + composite 命令」

- 状态：已接受
- 日期：2026-08-20

## 背景

用户需要「身份证拼合」：把正反两面（或任意两页，如户口本）合成一页，类似 camscanner 技能的身份证拼接，且要可泛化到其它证件类型。

核心难点：拼合出的页面不是任何源 PDF 的页，而是**生成内容**；且「删原两页 + 插入合成页」必须作为**一次可撤销**的原子操作（一步 Ctrl+Z 还原原两页）。

## 决策

分三层：

1. **composite 复合命令**（`core/commands.ts`）：`{ kind: 'composite', steps: Command[] }`，顺序执行子命令，逆操作 = 各子命令逆操作按相反顺序组成 composite。用于「拼合」等原子多步操作，撤销一步还原。

2. **合成页 = 合成源 + 单页 PDF**：浏览器里把选中的两页 `renderPageToCanvas` 渲染为 canvas → `compositeCanvases` 按上下/左右拼到 A4(150dpi) canvas → `canvasToSinglePagePdf`（pdf-lib embedJpg）生成单页 PDF 字节 → 注册为**合成源**（`comb-src-N`，pdfSourceManager.open）。合成页就是指向该源的普通 PageRef，**零改动文档核心**——渲染、导出、撤销全部复用既有管线。

3. **是否删原页由用户确认**：`CombineOptions.removeOriginals` 作为弹窗复选框，不自动决定。删原页 = composite(delete 两页 + insert 合成页)；保留 = 单条 insert。

## 影响

- 优点：模型零侵入（合成页是普通 PageRef + 合成源）；撤销语义正确；排版纯函数（`computeCombineLayout`）可单测。
- 代价：合成页是栅格化（JPEG 0.92）结果，非矢量；每页生成依赖浏览器 canvas；合成源在撤销后成为孤儿（内存中保留，体积小，可后续清理）。
- 约束：
  - 当前只支持恰好 2 页；N 页拼合与「裁剪到标准卡尺寸（85.6×54mm）」为后续增强。
  - 拼合页质量取决于源渲染分辨率（当前 targetWidth 1500）。
  - 排版顺序按文档顺序（第 1 页在上/左），如需交换需先手动调整顺序。
- 验证：`computeCombineLayout` 与 composite 命令有单测；canvas 合成与单页 PDF 为浏览器路径，需手工验证。

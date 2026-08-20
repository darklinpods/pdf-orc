/** 拼合排版：上下（vertical）/ 左右（horizontal）。 */
export type CombineLayout = 'vertical' | 'horizontal';

/** 合成目标画布：A4 @ 150dpi（1240×1754 px）。 */
export const A4_150DPI = { width: 1240, height: 1754 };

export interface LayoutRect {
  x: number;
  y: number;
  w: number;
  h: number;
}

/**
 * 计算「把 N 张图按上下/左右排版到目标画布」的每张目标矩形（contain 等比、居中）。
 * 纯函数，可单测。
 */
export function computeCombineLayout(
  sourceSizes: Array<{ width: number; height: number }>,
  layout: CombineLayout,
  page: { width: number; height: number } = A4_150DPI,
): LayoutRect[] {
  const n = sourceSizes.length;
  const regionW = layout === 'vertical' ? page.width : Math.floor(page.width / n);
  const regionH = layout === 'vertical' ? Math.floor(page.height / n) : page.height;

  return sourceSizes.map((s, i) => {
    const scale = Math.min(regionW / s.width, regionH / s.height);
    const w = s.width * scale;
    const h = s.height * scale;
    const rx = layout === 'vertical' ? 0 : i * regionW;
    const ry = layout === 'vertical' ? i * regionH : 0;
    return { x: rx + (regionW - w) / 2, y: ry + (regionH - h) / 2, w, h };
  });
}

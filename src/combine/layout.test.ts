import { describe, expect, it } from 'vitest';
import { A4_150DPI, computeCombineLayout } from './layout';

describe('computeCombineLayout', () => {
  it('上下布局：两张等比缩放、各自垂直居中', () => {
    const rects = computeCombineLayout(
      [
        { width: 1000, height: 1400 },
        { width: 2000, height: 1000 },
      ],
      'vertical',
    );
    const { width, height } = A4_150DPI;
    // 每张占上半/下半区域
    expect(rects[0].y).toBeGreaterThanOrEqual(0);
    expect(rects[0].y + rects[0].h).toBeLessThanOrEqual(height / 2 + 0.01);
    expect(rects[1].y).toBeGreaterThanOrEqual(height / 2 - 0.01);
    // contain 不超出区域
    expect(rects[0].w).toBeLessThanOrEqual(width);
    expect(rects[1].h).toBeLessThanOrEqual(height / 2);
    // 水平居中
    expect(rects[0].x).toBeCloseTo((width - rects[0].w) / 2);
  });

  it('左右布局：两张等比缩放、各自水平居中', () => {
    const rects = computeCombineLayout(
      [
        { width: 1000, height: 1400 },
        { width: 2000, height: 1000 },
      ],
      'horizontal',
    );
    const { width, height } = A4_150DPI;
    expect(rects[0].x + rects[0].w).toBeLessThanOrEqual(width / 2 + 0.01);
    expect(rects[1].x).toBeGreaterThanOrEqual(width / 2 - 0.01);
    expect(rects[0].h).toBeLessThanOrEqual(height);
    expect(rects[0].y).toBeCloseTo((height - rects[0].h) / 2);
  });

  it('保持原始宽高比', () => {
    const src = { width: 1000, height: 2000 };
    const rects = computeCombineLayout([src], 'vertical');
    expect(rects[0].w / rects[0].h).toBeCloseTo(0.5);
  });
});

import { describe, expect, it } from 'vitest';
import { fitScale } from './pageScale';

describe('fitScale', () => {
  it('仅宽度约束', () => {
    expect(fitScale(1000, 1414, 200)).toBeCloseTo(0.2);
    expect(fitScale(1000, 1414, 500)).toBeCloseTo(0.5);
  });

  it('宽度+高度双约束取较小值', () => {
    // 宽高比 1000x1414，目标 200x300：高度约束更紧（300/1414≈0.212 < 0.2）
    expect(fitScale(1000, 1414, 200, 300)).toBeCloseTo(0.2);
    // 目标 200x250：宽度约束更紧（0.2 < 250/1414≈0.177）
    expect(fitScale(1000, 1414, 200, 250)).toBeCloseTo(250 / 1414);
  });

  it('旋转后的横版页面按约束缩放', () => {
    // 90° 旋转后宽>高
    expect(fitScale(1414, 1000, 200)).toBeCloseTo(200 / 1414);
  });

  it('非法输入返回 1（安全兜底）', () => {
    expect(fitScale(0, 100, 200)).toBe(1);
    expect(fitScale(100, 0, 200)).toBe(1);
    expect(fitScale(100, 100, 0)).toBe(1);
    expect(fitScale(-5, 100, 200)).toBe(1);
  });
});

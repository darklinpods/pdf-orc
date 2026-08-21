import { describe, expect, it } from 'vitest';
import { nextSpread, prevSpread, spreadFirst, spreadForPage } from './spread';

describe('spreadForPage', () => {
  it('第 1 页单独', () => {
    expect(spreadForPage(0, 6)).toEqual([0]);
  });

  it('偶数页号在左、奇数页号在右', () => {
    expect(spreadForPage(1, 6)).toEqual([1, 2]); // 第2页(左) + 第3页(右)
    expect(spreadForPage(2, 6)).toEqual([1, 2]);
    expect(spreadForPage(3, 6)).toEqual([3, 4]);
    expect(spreadForPage(4, 6)).toEqual([3, 4]);
  });

  it('末页落单（偶数总页数）单独', () => {
    expect(spreadForPage(5, 6)).toEqual([5]);
  });

  it('越界收敛到首/末', () => {
    expect(spreadForPage(-5, 6)).toEqual([0]);
    expect(spreadForPage(99, 6)).toEqual([5]);
  });

  it('空文档返回空', () => {
    expect(spreadForPage(0, 0)).toEqual([]);
  });
});

describe('nextSpread / prevSpread', () => {
  it('从第 1 页进入第一个对开', () => {
    expect(nextSpread(0, 6)).toBe(1);
    expect(spreadFirst(1, 6)).toBe(1);
  });

  it('对开间前进/后退', () => {
    expect(nextSpread(1, 6)).toBe(3);
    expect(nextSpread(2, 6)).toBe(3);
    expect(nextSpread(3, 6)).toBe(5);
    expect(prevSpread(3, 6)).toBe(1);
    expect(prevSpread(2, 6)).toBe(0);
    expect(prevSpread(1, 6)).toBe(0);
  });

  it('边界原地不动', () => {
    expect(nextSpread(5, 6)).toBe(5);
    expect(prevSpread(0, 6)).toBe(0);
  });
});

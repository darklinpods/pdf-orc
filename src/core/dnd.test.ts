import { describe, expect, it } from 'vitest';
import { computeDropPreview, computeReorderForDrop, sortedDraggedIds } from './dnd';

const O = ['A', 'B', 'C', 'D', 'E'];

describe('computeReorderForDrop', () => {
  it('单页向下拖：插入到落点后', () => {
    const cmd = computeReorderForDrop(O, ['A'], 'C');
    expect(cmd).toEqual({ kind: 'reorder', from: [0], to: 2 });
  });

  it('单页向上拖：插入到落点前', () => {
    const cmd = computeReorderForDrop(O, ['D'], 'B');
    expect(cmd).toEqual({ kind: 'reorder', from: [3], to: 1 });
  });

  it('散选组向下拖', () => {
    const cmd = computeReorderForDrop(O, ['A', 'C'], 'D');
    expect(cmd).toEqual({ kind: 'reorder', from: [0, 2], to: 2 });
  });

  it('散选组落到组内某页之前', () => {
    const cmd = computeReorderForDrop(O, ['B', 'D'], 'C');
    // over C 在原 B(1) 之后、D(3) 之前；forward = overOrig(2) > from[0](1) → true
    // rest = [A,C,E]，anchorInRest=1 → to=2
    expect(cmd).toEqual({ kind: 'reorder', from: [1, 3], to: 2 });
  });

  it('自落（over 在被拖集合内）返回 null', () => {
    expect(computeReorderForDrop(O, ['A', 'C'], 'C')).toBeNull();
  });

  it('落点不存在返回 null', () => {
    expect(computeReorderForDrop(O, ['A'], 'Z')).toBeNull();
  });

  it('空拖拽集合返回 null', () => {
    expect(computeReorderForDrop(O, [], 'C')).toBeNull();
  });
});

describe('sortedDraggedIds', () => {
  it('按当前页序排序被拖拽页', () => {
    expect(sortedDraggedIds(O, ['D', 'A', 'C'])).toEqual(['A', 'C', 'D']);
  });
});

describe('computeDropPreview', () => {
  it('单页向下拖：插入到落点之后', () => {
    expect(computeDropPreview(O, ['A'], 'C')).toEqual({ insertIndex: 3, finalPageNumber: 3 });
  });

  it('单页向上拖：插入到落点之前', () => {
    expect(computeDropPreview(O, ['D'], 'B')).toEqual({ insertIndex: 1, finalPageNumber: 2 });
  });

  it('拖到最前：insertIndex 为 0', () => {
    expect(computeDropPreview(O, ['E'], 'A')).toEqual({ insertIndex: 0, finalPageNumber: 1 });
  });

  it('拖到最后：insertIndex 等于列表长度（追加末尾）', () => {
    expect(computeDropPreview(O, ['A'], 'E')).toEqual({ insertIndex: 5, finalPageNumber: 5 });
  });

  it('散选组向下拖', () => {
    expect(computeDropPreview(O, ['A', 'C'], 'D')).toEqual({ insertIndex: 4, finalPageNumber: 3 });
  });

  it('自落返回 null', () => {
    expect(computeDropPreview(O, ['A', 'C'], 'C')).toBeNull();
  });

  it('落点不存在返回 null', () => {
    expect(computeDropPreview(O, ['A'], 'Z')).toBeNull();
  });
});

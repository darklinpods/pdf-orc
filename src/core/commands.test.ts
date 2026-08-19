import { describe, expect, it } from 'vitest';
import { emptyDocument, type DocumentState } from './types';
import { apply, type Command } from './commands';
import { importCommand } from './sources';

/** 构造 n 页单源文档，页 id 为 '1'..'n'。 */
function docWithPages(pageCount: number, sourceId = 'src-1', name = 'sample.pdf'): DocumentState {
  const base = emptyDocument();
  return apply(base, importCommand(sourceId, name, pageCount, base.nextPageId)).state;
}

function pageIds(state: DocumentState): string[] {
  return state.pages.map((p) => p.id);
}

/** 页面与源内容一致（sources 是无序注册表，按 id 排序比较；nextPageId 是水位不比较）。 */
function expectSameContent(a: DocumentState, b: DocumentState): void {
  expect(a.pages).toEqual(b.pages);
  const sortSources = (s: DocumentState) => [...s.sources].sort((x, y) => x.id.localeCompare(y.id));
  expect(sortSources(a)).toEqual(sortSources(b));
}

describe('apply: reorder', () => {
  it('单页移动到末尾', () => {
    const state = docWithPages(5);
    const { state: next } = apply(state, { kind: 'reorder', from: [0], to: 4 });
    expect(pageIds(next)).toEqual(['2', '3', '4', '5', '1']);
  });

  it('中段块移动到开头', () => {
    const state = docWithPages(6);
    const { state: next } = apply(state, { kind: 'reorder', from: [2, 3], to: 0 });
    expect(pageIds(next)).toEqual(['3', '4', '1', '2', '5', '6']);
  });

  it('跨源顺序保持（合并场景）', () => {
    let state = docWithPages(2, 'a');
    state = apply(state, importCommand('b', 'b.pdf', 2, state.nextPageId)).state;
    // a1 a2 b1 b2 -> 把 b1 b2 移到最前
    const { state: next } = apply(state, { kind: 'reorder', from: [2, 3], to: 0 });
    expect(pageIds(next)).toEqual(['3', '4', '1', '2']);
  });

  it('逆操作完整还原', () => {
    const state = docWithPages(7);
    const { state: moved, inverse } = apply(state, { kind: 'reorder', from: [1, 3, 5], to: 2 });
    const { state: restored } = apply(moved, inverse);
    expect(restored).toEqual(state);
  });

  it('to 越界时收敛到边界', () => {
    const state = docWithPages(5);
    const { state: next } = apply(state, { kind: 'reorder', from: [3], to: 99 });
    expect(pageIds(next)).toEqual(['1', '2', '3', '5', '4']);
  });

  it('空 from 无操作', () => {
    const state = docWithPages(3);
    const { state: next } = apply(state, { kind: 'reorder', from: [], to: 0 });
    expect(next).toEqual(state);
  });

  it('非法 from 抛错', () => {
    const state = docWithPages(3);
    expect(() => apply(state, { kind: 'reorder', from: [1, 1], to: 0 })).toThrow();
    expect(() => apply(state, { kind: 'reorder', from: [0, 3], to: 0 })).toThrow();
    expect(() => apply(state, { kind: 'reorder', from: [0, -1], to: 0 })).toThrow();
  });
});

describe('apply: rotate', () => {
  it('90° 增量与逆操作', () => {
    const state = docWithPages(2);
    const { state: r90, inverse } = apply(state, { kind: 'rotate', pageIds: ['1'], delta: 90 });
    expect(r90.pages[0].rotation).toBe(90);
    const { state: restored } = apply(r90, inverse);
    expect(restored).toEqual(state);
  });

  it('连续旋转 90×3 = 270', () => {
    let state = docWithPages(1);
    state = apply(state, { kind: 'rotate', pageIds: ['1'], delta: 90 }).state;
    state = apply(state, { kind: 'rotate', pageIds: ['1'], delta: 90 }).state;
    const { state: next } = apply(state, { kind: 'rotate', pageIds: ['1'], delta: 90 });
    expect(next.pages[0].rotation).toBe(270);
  });

  it('-90 与 180 语义', () => {
    let state = docWithPages(1);
    state = apply(state, { kind: 'rotate', pageIds: ['1'], delta: -90 }).state;
    expect(state.pages[0].rotation).toBe(270);
    const { state: next } = apply(state, { kind: 'rotate', pageIds: ['1'], delta: 180 });
    expect(next.pages[0].rotation).toBe(90);
  });

  it('未知页面 id 无操作', () => {
    const state = docWithPages(1);
    const { state: next } = apply(state, { kind: 'rotate', pageIds: ['nope'], delta: 90 });
    expect(next).toEqual(state);
  });
});

describe('apply: delete / insert', () => {
  it('删除若干页并清理孤儿源', () => {
    let state = docWithPages(2, 'a');
    state = apply(state, importCommand('b', 'b.pdf', 2, state.nextPageId)).state;
    const { state: next, inverse } = apply(state, { kind: 'delete', pageIds: ['1', '2'] });
    expect(pageIds(next)).toEqual(['3', '4']);
    expect(next.sources.map((s) => s.id)).toEqual(['b']);

    // 逆操作：insert 恢复页面并重新注册源 a
    const { state: restored } = apply(next, inverse);
    expectSameContent(restored, state);
  });

  it('删除不存在的页面无操作', () => {
    const state = docWithPages(2);
    const { state: next } = apply(state, { kind: 'delete', pageIds: ['x'] });
    expect(next).toEqual(state);
  });

  it('插入到指定位置', () => {
    const state = docWithPages(3);
    const { state: next, inverse } = apply(state, {
      kind: 'insert',
      pages: [
        { id: '99', sourceId: 'new', sourcePageIndex: 0, rotation: 0, label: null },
      ],
      index: 1,
      sources: [{ id: 'new', name: 'new.pdf', pageCount: 1 }],
    });
    expect(pageIds(next)).toEqual(['1', '99', '2', '3']);
    expect(next.sources.map((s) => s.id)).toEqual(['src-1', 'new']);
    const { state: restored } = apply(next, inverse);
    expectSameContent(restored, state);
  });
});

describe('apply: mergeSources / relabel', () => {
  it('导入追加到末尾，nextPageId 递增，逆操作还原', () => {
    const state = docWithPages(2);
    const cmd = importCommand('b', 'b.pdf', 3, state.nextPageId);
    const { state: next, inverse } = apply(state, cmd);
    expect(pageIds(next)).toEqual(['1', '2', '3', '4', '5']);
    expect(next.nextPageId).toBe(6);
    expect(next.sources.map((s) => s.id)).toEqual(['src-1', 'b']);
    const { state: restored } = apply(next, inverse);
    expectSameContent(restored, state);
    // 水位单调：撤销后不回落，避免 id 重用。
    expect(restored.nextPageId).toBeGreaterThanOrEqual(state.nextPageId);
  });

  it('relabel 设置与逆操作', () => {
    const state = docWithPages(3);
    const { state: next, inverse } = apply(state, {
      kind: 'relabel',
      labels: [
        { pageId: '1', from: null, to: '认定书' },
        { pageId: '2', from: null, to: '认定书' },
      ],
    });
    expect(next.pages[0].label).toBe('认定书');
    expect(next.pages[1].label).toBe('认定书');
    expect(next.pages[2].label).toBeNull();
    const { state: restored } = apply(next, inverse);
    expect(restored).toEqual(state);
  });
});

describe('不可变性与撤销链', () => {
  it('操作不修改原状态对象', () => {
    const state = docWithPages(3);
    const snapshot = state;
    apply(state, { kind: 'reorder', from: [0], to: 2 });
    expect(state).toEqual(snapshot);
  });

  it('一串操作逐一撤销后与初始状态深度相等', () => {
    let state = docWithPages(4);
    const commands: Command[] = [
      { kind: 'rotate', pageIds: ['1', '2'], delta: 90 },
      { kind: 'reorder', from: [0], to: 3 },
      { kind: 'delete', pageIds: ['4'] },
      { kind: 'insert', pages: [{ id: '99', sourceId: 'x', sourcePageIndex: 0, rotation: 0, label: null }], index: 0 },
      { kind: 'relabel', labels: [{ pageId: '2', from: null, to: '凭证' }] },
    ];
    const original = state;
    let history: Array<{ forward: Command; inverse: Command }> = [];
    for (const cmd of commands) {
      const { state: next, inverse } = apply(state, cmd);
      history = [...history, { forward: cmd, inverse }];
      state = next;
    }
    for (const entry of [...history].reverse()) {
      const { state: next } = apply(state, entry.inverse);
      state = next;
    }
    expectSameContent(state, original);
    // 水位单调：全程不回落。
    expect(state.nextPageId).toBeGreaterThanOrEqual(original.nextPageId);
  });
});

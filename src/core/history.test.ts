import { describe, expect, it } from 'vitest';
import { emptyDocument, type DocumentState } from './types';
import { apply } from './commands';
import { importCommand } from './sources';
import { canRedo, canUndo, createHistory, dispatch, redo, undo } from './history';

function docWithPages(pageCount: number): DocumentState {
  const base = emptyDocument();
  return apply(base, importCommand('src-1', 'sample.pdf', pageCount, base.nextPageId)).state;
}

describe('history: 基本语义', () => {
  it('dispatch 压入历史，undo/redo 往返还原', () => {
    const state = docWithPages(3);
    const history = createHistory();
    const d1 = dispatch(state, history, { kind: 'reorder', from: [0], to: 2 });
    expect(canUndo(d1.history)).toBe(true);
    expect(canRedo(d1.history)).toBe(false);

    const u = undo(d1.state, d1.history);
    expect(u.state).toEqual(state);
    expect(canUndo(u.history)).toBe(false);
    expect(canRedo(u.history)).toBe(true);

    const r = redo(u.state, u.history);
    expect(r.state).toEqual(d1.state);
    expect(canRedo(r.history)).toBe(false);
  });

  it('空历史 undo/redo 无操作', () => {
    const state = docWithPages(1);
    const history = createHistory();
    expect(undo(state, history).state).toEqual(state);
    expect(redo(state, history).state).toEqual(state);
  });

  it('撤销后新命令清空 future', () => {
    const state = docWithPages(3);
    const d1 = dispatch(state, createHistory(), { kind: 'reorder', from: [0], to: 2 });
    const u = undo(d1.state, d1.history);
    const d2 = dispatch(u.state, u.history, { kind: 'reorder', from: [0], to: 1 });
    expect(canRedo(d2.history)).toBe(false);
  });

  it('历史上限裁剪（limit=2）', () => {
    const state = docWithPages(3);
    const history = createHistory(2);
    const d1 = dispatch(state, history, { kind: 'reorder', from: [0], to: 1 });
    const d2 = dispatch(d1.state, d1.history, { kind: 'reorder', from: [0], to: 2 });
    const d3 = dispatch(d2.state, d2.history, { kind: 'reorder', from: [1], to: 0 });
    expect(d3.history.past).toHaveLength(2);
  });
});

describe('history: 命令合并（coalesce）', () => {
  it('同一手势内连续旋转合并为一条历史，一次撤销还原', () => {
    const state = docWithPages(2);
    const history = createHistory();
    const d1 = dispatch(state, history, { kind: 'rotate', pageIds: ['1'], delta: 90 }, 'rotate');
    const d2 = dispatch(d1.state, d1.history, { kind: 'rotate', pageIds: ['1'], delta: 90 }, 'rotate');
    const d3 = dispatch(d2.state, d2.history, { kind: 'rotate', pageIds: ['1'], delta: 90 }, 'rotate');

    expect(d3.history.past).toHaveLength(1);
    expect(d3.state.pages[0].rotation).toBe(270);

    const u = undo(d3.state, d3.history);
    expect(u.state).toEqual(state); // 一次撤销回到 0°
    const r = redo(u.state, u.history);
    expect(r.state.pages[0].rotation).toBe(270);
  });

  it('不同目标页不合并', () => {
    const state = docWithPages(3);
    const history = createHistory();
    const d1 = dispatch(state, history, { kind: 'rotate', pageIds: ['1'], delta: 90 }, 'rotate');
    const d2 = dispatch(d1.state, d1.history, { kind: 'rotate', pageIds: ['2'], delta: 90 }, 'rotate');
    expect(d2.history.past).toHaveLength(2);
  });

  it('不同命令类型不合并', () => {
    const state = docWithPages(3);
    const history = createHistory();
    const d1 = dispatch(state, history, { kind: 'rotate', pageIds: ['1'], delta: 90 }, 'rotate');
    const d2 = dispatch(d1.state, d1.history, { kind: 'reorder', from: [0], to: 2 }, 'rotate');
    expect(d2.history.past).toHaveLength(2);
  });

  it('无 mergeKey 不合并', () => {
    const state = docWithPages(2);
    const history = createHistory();
    const d1 = dispatch(state, history, { kind: 'rotate', pageIds: ['1'], delta: 90 });
    const d2 = dispatch(d1.state, d1.history, { kind: 'rotate', pageIds: ['1'], delta: 90 });
    expect(d2.history.past).toHaveLength(2);
  });

  it('净效果为 0（90×4）不合并，撤销仍正确', () => {
    const state = docWithPages(1);
    const history = createHistory();
    let cur = { state, history };
    for (let i = 0; i < 4; i++) {
      cur = dispatch(cur.state, cur.history, { kind: 'rotate', pageIds: ['1'], delta: 90 }, 'rotate');
    }
    expect(cur.history.past).toHaveLength(2); // 前三步合并为一条，第四步净 0 不合并
    expect(cur.state.pages[0].rotation).toBe(0);

    const u1 = undo(cur.state, cur.history);
    expect(u1.state.pages[0].rotation).toBe(270);
    const u2 = undo(u1.state, u1.history);
    expect(u2.state).toEqual(state);
  });
});

describe('history: 混合操作往返', () => {
  it('多次 dispatch + 多次 undo 深度还原', () => {
    const state = docWithPages(4);
    const history = createHistory();
    const d1 = dispatch(state, history, importCommand('b', 'b.pdf', 2, state.nextPageId));
    const d2 = dispatch(d1.state, d1.history, { kind: 'rotate', pageIds: ['5'], delta: 90 });
    const d3 = dispatch(d2.state, d2.history, { kind: 'reorder', from: [4], to: 0 });
    const d4 = dispatch(d3.state, d3.history, { kind: 'delete', pageIds: ['2'] });

    let s = d4.state;
    let h = d4.history;
    for (let i = 0; i < 4; i++) {
      const u = undo(s, h);
      s = u.state;
      h = u.history;
    }
    expect(s.pages).toEqual(state.pages);
    expect(s.sources).toEqual(state.sources);
    expect(canUndo(h)).toBe(false);

    // 全部重做回到最终态
    let rs = s;
    let rh = h;
    for (let i = 0; i < 4; i++) {
      const r = redo(rs, rh);
      rs = r.state;
      rh = r.history;
    }
    expect(rs).toEqual(d4.state);
  });
});

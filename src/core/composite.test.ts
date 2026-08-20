import { describe, expect, it } from 'vitest';
import { emptyDocument, type DocumentState } from './types';
import { apply, type Command } from './commands';
import { importCommand } from './sources';

function docWithPages(count: number): DocumentState {
  const base = emptyDocument();
  return apply(base, importCommand('src-1', 'a.pdf', count, base.nextPageId)).state;
}

describe('composite 复合命令', () => {
  it('顺序执行子命令并生成逆序逆操作', () => {
    const state = docWithPages(4);
    // 前向：旋转第 1 页 + 删除第 4 页
    const steps: Command[] = [
      { kind: 'rotate', pageIds: ['1'], delta: 90 },
      { kind: 'delete', pageIds: ['4'] },
    ];
    const { state: next, inverse } = apply(state, { kind: 'composite', steps });
    expect(next.pages.map((p) => p.id)).toEqual(['1', '2', '3']);
    expect(next.pages[0].rotation).toBe(90);

    expect(inverse.kind).toBe('composite');
    const invSteps = (inverse as Extract<Command, { kind: 'composite' }>).steps;
    // 逆操作顺序：先撤销 delete（insert 回第4页），再撤销 rotate（转回）
    expect(invSteps.map((s) => s.kind)).toEqual(['insert', 'rotate']);

    const { state: restored } = apply(next, inverse);
    expect(restored.pages.map((p) => p.id)).toEqual(['1', '2', '3', '4']);
    expect(restored.pages[0].rotation).toBe(0);
    expect(restored.sources.map((s) => s.id)).toEqual(['src-1']);
  });

  it('模拟拼合：删两页 + 插入合成页，一步撤销还原', () => {
    const state = docWithPages(4);
    const combined = {
      id: 'comb-1',
      sourceId: 'comb-src-1',
      sourcePageIndex: 0,
      rotation: 0 as const,
      label: null,
    };
    const steps: Command[] = [
      { kind: 'delete', pageIds: ['2', '3'] },
      {
        kind: 'insert',
        pages: [combined],
        index: 1,
        sources: [{ id: 'comb-src-1', name: '拼合页', pageCount: 1 }],
      },
    ];
    const { state: next, inverse } = apply(state, { kind: 'composite', steps });
    expect(next.pages.map((p) => p.id)).toEqual(['1', 'comb-1', '4']);
    expect(next.sources.map((s) => s.id)).toEqual(['src-1', 'comb-src-1']);

    const { state: restored } = apply(next, inverse);
    expect(restored.pages.map((p) => p.id)).toEqual(['1', '2', '3', '4']);
    // 合成源孤儿化后被清理
    expect(restored.sources.map((s) => s.id)).toEqual(['src-1']);
  });

  it('空 steps 为无操作', () => {
    const state = docWithPages(2);
    const { state: next } = apply(state, { kind: 'composite', steps: [] });
    expect(next).toEqual(state);
  });
});

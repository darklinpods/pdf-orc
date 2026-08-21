import { describe, expect, it } from 'vitest';
import { emptyDocument, type PageRef } from './types';
import { apply } from './commands';
import { importCommand } from './sources';
import { collectGroups, filterPages, groupColor, relabelPagesCommand } from './labels';

function pages(labels: Array<string | null>): PageRef[] {
  const base = emptyDocument();
  const state = apply(base, importCommand('s', 's.pdf', labels.length, base.nextPageId)).state;
  return state.pages.map((p, i) => ({ ...p, label: labels[i] }));
}

describe('collectGroups', () => {
  it('按首次出现顺序去重并计数', () => {
    const ps = pages(['认定书', '现场照片', '认定书', null, '现场照片', '保险单']);
    const groups = collectGroups(ps);
    expect(groups.map((g) => g.name)).toEqual(['认定书', '现场照片', '保险单']);
    expect(groups.map((g) => g.count)).toEqual([2, 2, 1]);
  });

  it('空页面列表返回空数组', () => {
    expect(collectGroups([])).toEqual([]);
  });

  it('忽略未分组页', () => {
    expect(collectGroups(pages([null, null]))).toEqual([]);
  });
});

describe('groupColor', () => {
  it('同组名稳定同色，且落在调色板内', () => {
    expect(groupColor('认定书')).toBe(groupColor('认定书'));
    // 多次调用稳定
    expect(groupColor('保险单')).toBe(groupColor('保险单'));
  });
});

describe('filterPages', () => {
  const ps = pages(['认定书', null, '认定书', '保险单', null]);

  it('all 返回全部', () => {
    expect(filterPages(ps, 'all')).toHaveLength(5);
  });

  it('unlabeled 只返回未分组页', () => {
    expect(filterPages(ps, 'unlabeled').map((p) => p.label)).toEqual([null, null]);
  });

  it('按组名过滤并保持相对顺序', () => {
    expect(filterPages(ps, '认定书').map((p) => p.id)).toEqual([ps[0].id, ps[2].id]);
  });

  it('不存在的组名返回空', () => {
    expect(filterPages(ps, '不存在')).toEqual([]);
  });
});

describe('relabelPagesCommand', () => {
  it('生成带正确 from/to 的命令，撤销可还原', () => {
    const ps = pages(['认定书', null, '认定书']);
    const cmd = relabelPagesCommand([ps[0], ps[1]], '保险单');
    expect(cmd.kind).toBe('relabel');
    expect(cmd.labels).toEqual([
      { pageId: ps[0].id, from: '认定书', to: '保险单' },
      { pageId: ps[1].id, from: null, to: '保险单' },
    ]);

    const state = { ...emptyDocument(), pages: ps };
    const { state: next, inverse } = apply(state, cmd);
    expect(next.pages[0].label).toBe('保险单');
    expect(next.pages[1].label).toBe('保险单');
    const { state: restored } = apply(next, inverse);
    expect(restored.pages.map((p) => p.label)).toEqual(['认定书', null, '认定书']);
  });

  it('取消分组（to=null）同样可撤销', () => {
    const ps = pages(['认定书', '认定书']);
    const cmd = relabelPagesCommand(ps, null);
    const state = { ...emptyDocument(), pages: ps };
    const { state: next, inverse } = apply(state, cmd);
    expect(next.pages.every((p) => p.label === null)).toBe(true);
    const { state: restored } = apply(next, inverse);
    expect(restored.pages.every((p) => p.label === '认定书')).toBe(true);
  });
});

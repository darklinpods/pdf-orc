import { describe, expect, it } from 'vitest';
import type { DocumentState } from '../core/types';
import {
  buildExportPlan,
  combineRotation,
  normalizeRotation,
  suggestExportFilename,
} from './plan';

function doc(overrides: Partial<DocumentState>): DocumentState {
  return {
    pages: [],
    sources: [],
    nextPageId: 1,
    ...overrides,
  };
}

describe('normalizeRotation / combineRotation', () => {
  it('归一化负值与超出范围的角度到四向', () => {
    expect(normalizeRotation(0)).toBe(0);
    expect(normalizeRotation(90)).toBe(90);
    expect(normalizeRotation(180)).toBe(180);
    expect(normalizeRotation(270)).toBe(270);
    expect(normalizeRotation(-90)).toBe(270);
    expect(normalizeRotation(450)).toBe(90);
    expect(normalizeRotation(360)).toBe(0);
  });

  it('叠加源固有旋转与用户旋转，与渲染侧语义一致', () => {
    expect(combineRotation(0, 0)).toBe(0);
    expect(combineRotation(90, 90)).toBe(180);
    expect(combineRotation(-90, 0)).toBe(270);
    expect(combineRotation(270, 90)).toBe(0);
    expect(combineRotation(0, 180)).toBe(180);
  });
});

describe('suggestExportFilename', () => {
  it('空文档回退默认名', () => {
    expect(suggestExportFilename(doc({}))).toBe('pdf-orc-导出.pdf');
  });

  it('单源去掉 .pdf 后缀并加「整理」', () => {
    const d = doc({
      pages: [{ id: '1', sourceId: 'a', sourcePageIndex: 0, rotation: 0, label: null }],
      sources: [{ id: 'a', name: '事故认定书.pdf', pageCount: 1 }],
    });
    expect(suggestExportFilename(d)).toBe('事故认定书-整理.pdf');
  });

  it('多源以首源命名并标注份数', () => {
    const d = doc({
      pages: [
        { id: '1', sourceId: 'b', sourcePageIndex: 0, rotation: 0, label: null },
        { id: '2', sourceId: 'a', sourcePageIndex: 0, rotation: 0, label: null },
      ],
      sources: [
        { id: 'a', name: '保险单.pdf', pageCount: 1 },
        { id: 'b', name: '现场照片.pdf', pageCount: 1 },
      ],
    });
    expect(suggestExportFilename(d)).toBe('现场照片-等2份-整理.pdf');
  });
});

describe('buildExportPlan', () => {
  it('按 PageList 顺序生成页面指令并携带旋转，源按首次出现去重', () => {
    const d = doc({
      pages: [
        { id: '1', sourceId: 'a', sourcePageIndex: 0, rotation: 90, label: null },
        { id: '2', sourceId: 'b', sourcePageIndex: 1, rotation: 0, label: null },
        { id: '3', sourceId: 'a', sourcePageIndex: 1, rotation: 180, label: null },
        { id: '4', sourceId: 'b', sourcePageIndex: 0, rotation: 270, label: null },
      ],
      sources: [
        { id: 'a', name: 'a.pdf', pageCount: 2 },
        { id: 'b', name: 'b.pdf', pageCount: 2 },
      ],
    });
    const plan = buildExportPlan(d);
    expect(plan.sourceIds).toEqual(['a', 'b']);
    expect(plan.pages).toEqual([
      { sourceId: 'a', sourcePageIndex: 0, rotation: 90 },
      { sourceId: 'b', sourcePageIndex: 1, rotation: 0 },
      { sourceId: 'a', sourcePageIndex: 1, rotation: 180 },
      { sourceId: 'b', sourcePageIndex: 0, rotation: 270 },
    ]);
  });

  it('引用不存在源时抛出中文错误', () => {
    const d = doc({
      pages: [{ id: '1', sourceId: 'ghost', sourcePageIndex: 0, rotation: 0, label: null }],
      sources: [],
    });
    expect(() => buildExportPlan(d)).toThrow(/不存在的源/);
  });

  it('源页下标越界时抛出中文错误', () => {
    const d = doc({
      pages: [{ id: '1', sourceId: 'a', sourcePageIndex: 5, rotation: 0, label: null }],
      sources: [{ id: 'a', name: 'a.pdf', pageCount: 3 }],
    });
    expect(() => buildExportPlan(d)).toThrow(/越界/);
  });
});

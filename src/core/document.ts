import type { DocumentState, PageRef, SourceRef } from './types';
import { emptyDocument } from './types';

export { emptyDocument };

/** 派生选择器：页面列表是唯一事实源，所有查询基于它计算。 */

export function pageCount(state: DocumentState): number {
  return state.pages.length;
}

export function getPageById(state: DocumentState, id: string): PageRef | undefined {
  return state.pages.find((p) => p.id === id);
}

export function getSourceById(state: DocumentState, id: string): SourceRef | undefined {
  return state.sources.find((s) => s.id === id);
}

/** 某源下的所有页面（按当前列表顺序）。 */
export function getPagesBySource(state: DocumentState, sourceId: string): PageRef[] {
  return state.pages.filter((p) => p.sourceId === sourceId);
}

/** 页面在列表中的当前位置；不存在返回 -1。 */
export function indexOfPage(state: DocumentState, pageId: string): number {
  return state.pages.findIndex((p) => p.id === pageId);
}

/** 是否还有未分组的页面。 */
export function hasUnlabeledPages(state: DocumentState): boolean {
  return state.pages.some((p) => p.label === null);
}

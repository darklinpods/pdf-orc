import type { PageRef, SourceRef } from './types';
import type { MergeSourcesCommand } from './commands';

/**
 * 构建「导入源 PDF」命令的负载：为源注册表生成 SourceRef，为每一页生成 PageRef。
 * pageId 从 startId 起递增分配。
 */
export function buildImportPayload(
  sourceId: string,
  name: string,
  pageCount: number,
  startId: number,
): { sources: SourceRef[]; pages: PageRef[] } {
  if (!Number.isInteger(pageCount) || pageCount <= 0) {
    throw new Error(`导入页数必须为正整数，收到 ${pageCount}`);
  }
  const source: SourceRef = { id: sourceId, name, pageCount };
  const pages: PageRef[] = Array.from({ length: pageCount }, (_, i) => ({
    id: String(startId + i),
    sourceId,
    sourcePageIndex: i,
    rotation: 0,
    label: null,
  }));
  return { sources: [source], pages };
}

/** 生成 mergeSources 命令（用于 UI 层 dispatch）。 */
export function importCommand(
  sourceId: string,
  name: string,
  pageCount: number,
  startId: number,
): MergeSourcesCommand {
  const { sources, pages } = buildImportPayload(sourceId, name, pageCount, startId);
  return { kind: 'mergeSources', sources, pages };
}

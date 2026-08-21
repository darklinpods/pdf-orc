import type { DocumentState, PageRef, Rotation } from '../core/types';

/** 导出计划中的单页：源 + 源内页下标 + 用户旋转。 */
export interface ExportPage {
  sourceId: string;
  sourcePageIndex: number;
  rotation: Rotation;
}

/** 导出计划：按 PageList 顺序的页面指令 + 去重后的源 id 列表 + 建议文件名。 */
export interface ExportPlan {
  sourceIds: string[];
  pages: ExportPage[];
  filename: string;
}

/** 把任意角度归一化到四向旋转（0/90/180/270），容忍负值与非 90 倍数。 */
export function normalizeRotation(deg: number): Rotation {
  const m = ((deg % 360) + 360) % 360;
  const nearest = Math.round(m / 90) * 90;
  return (nearest % 360) as Rotation;
}

/**
 * 源固有旋转（pdf-lib getRotation().angle，可能为负、可能非 0/90/180/270）
 * 叠加用户旋转后的最终四向角度。与渲染侧 `(page.rotate + rotation) % 360` 语义一致。
 */
export function combineRotation(intrinsic: number, user: Rotation): Rotation {
  return normalizeRotation(intrinsic + user);
}

/** 去掉 .pdf 后缀、清理首尾空白与非法文件名字符，空则回退「案卷」。 */
export function sanitizeFilename(name: string): string {
  const cleaned = name
    .replace(/\.pdf$/i, '')
    .replace(/[\\/:*?"<>|]/g, '_')
    .trim();
  return cleaned === '' ? '案卷' : cleaned;
}

/** 建议导出文件名：单源 `${名}-整理.pdf`，多源 `${首源名}-等N份-整理.pdf`。 */
export function suggestExportFilename(document: DocumentState): string {
  const { pages, sources } = document;
  if (pages.length === 0) return 'pdf-orc-导出.pdf';
  const first = sources.find((s) => s.id === pages[0].sourceId);
  const base = sanitizeFilename(first?.name ?? '案卷');
  if (sources.length <= 1) return `${base}-整理.pdf`;
  return `${base}-等${sources.length}份-整理.pdf`;
}

/** 构建导出计划的选项。 */
export interface ExportPlanOptions {
  /** 只导出这些页面 id（保持给定顺序）；缺省导出全部。 */
  pageIds?: string[];
  /** 覆盖建议文件名（如按分组导出时用组名）。 */
  filename?: string;
}

/** 从文档状态构建导出计划（含校验：源存在、页下标不越界）。 */
export function buildExportPlan(document: DocumentState, options: ExportPlanOptions = {}): ExportPlan {
  const pages = selectPages(document, options.pageIds);
  const byId = new Map(document.sources.map((s) => [s.id, s]));
  const sourceIds: string[] = [];
  const seen = new Set<string>();
  const exportPages: ExportPage[] = pages.map((p) => {
    const source = byId.get(p.sourceId);
    if (source === undefined) {
      throw new Error(`导出失败：页面引用了不存在的源「${p.sourceId}」`);
    }
    if (p.sourcePageIndex < 0 || p.sourcePageIndex >= source.pageCount) {
      throw new Error(
        `导出失败：源「${source.name}」的第 ${p.sourcePageIndex + 1} 页越界（共 ${source.pageCount} 页）`,
      );
    }
    if (!seen.has(p.sourceId)) {
      seen.add(p.sourceId);
      sourceIds.push(p.sourceId);
    }
    return { sourceId: p.sourceId, sourcePageIndex: p.sourcePageIndex, rotation: p.rotation };
  });
  return {
    sourceIds,
    pages: exportPages,
    filename: options.filename ?? suggestExportFilename({ ...document, pages }),
  };
}

/** 按 pageIds 选出页面（保持给定顺序）；缺省返回全部页。 */
function selectPages(document: DocumentState, pageIds?: string[]): PageRef[] {
  if (pageIds === undefined) return document.pages;
  const byId = new Map(document.pages.map((p) => [p.id, p]));
  return pageIds.map((id) => {
    const page = byId.get(id);
    if (page === undefined) {
      throw new Error(`导出失败：页面不存在「${id}」`);
    }
    return page;
  });
}

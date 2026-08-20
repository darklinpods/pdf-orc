import type { DocumentState, Rotation } from '../core/types';

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

/** 去掉 .pdf 后缀并清理首尾空白，空则回退「案卷」。 */
function sanitizeBase(name: string): string {
  const withoutExt = name.replace(/\.pdf$/i, '').trim();
  return withoutExt === '' ? '案卷' : withoutExt;
}

/** 建议导出文件名：单源 `${名}-整理.pdf`，多源 `${首源名}-等N份-整理.pdf`。 */
export function suggestExportFilename(document: DocumentState): string {
  const { pages, sources } = document;
  if (pages.length === 0) return 'pdf-orc-导出.pdf';
  const first = sources.find((s) => s.id === pages[0].sourceId);
  const base = sanitizeBase(first?.name ?? '案卷');
  if (sources.length <= 1) return `${base}-整理.pdf`;
  return `${base}-等${sources.length}份-整理.pdf`;
}

/** 从文档状态构建导出计划（含校验：源存在、页下标不越界）。 */
export function buildExportPlan(document: DocumentState): ExportPlan {
  const byId = new Map(document.sources.map((s) => [s.id, s]));
  const sourceIds: string[] = [];
  const seen = new Set<string>();
  const pages: ExportPage[] = document.pages.map((p) => {
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
  return { sourceIds, pages, filename: suggestExportFilename(document) };
}

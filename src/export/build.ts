import { PDFDocument, degrees } from 'pdf-lib';
import { combineRotation, type ExportPage } from './plan';
import type { ExportSourceInput } from './protocol';

/**
 * 执行导出计划：加载各源 PDF，按 PageList 顺序复制页、叠加旋转，生成新 PDF 字节。
 * 纯逻辑 + pdf-lib，可在 Node（测试）与 Web Worker 中运行；不依赖 DOM。
 */
export async function buildMergedPdf(
  sources: ExportSourceInput[],
  pages: ExportPage[],
  onProgress?: (done: number, total: number) => void,
): Promise<Uint8Array> {
  const loaded = new Map<string, PDFDocument>();
  for (const s of sources) {
    loaded.set(s.sourceId, await PDFDocument.load(s.bytes));
  }

  const out = await PDFDocument.create();
  const total = pages.length;
  for (let i = 0; i < total; i++) {
    const p = pages[i];
    const src = loaded.get(p.sourceId);
    if (src === undefined) {
      throw new Error(`导出失败：找不到源「${p.sourceId}」的字节数据`);
    }
    const [copied] = await out.copyPages(src, [p.sourcePageIndex]);
    // copyPages 保留源页固有 /Rotate；叠加用户旋转得到最终四向角度。
    const finalRotation = combineRotation(copied.getRotation().angle, p.rotation);
    copied.setRotation(degrees(finalRotation));
    out.addPage(copied);
    onProgress?.(i + 1, total);
  }

  return await out.save();
}

import { PDFDocument } from 'pdf-lib';

let cached: Promise<Uint8Array> | null = null;

/** 生成一页空白 A4 PDF 字节（结果缓存，多次插入复用同一合成源）。 */
export function blankA4PdfBytes(): Promise<Uint8Array> {
  if (cached === null) {
    cached = (async () => {
      const doc = await PDFDocument.create();
      doc.addPage([595.28, 841.89]); // A4（pt）
      return await doc.save();
    })();
  }
  return cached;
}

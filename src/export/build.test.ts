import { describe, expect, it } from 'vitest';
import { PDFDocument, degrees } from 'pdf-lib';
import { buildMergedPdf } from './build';
import type { ExportPage } from './plan';

/** 用给定尺寸与固有旋转构造一份源 PDF 字节。 */
async function makeSource(
  pages: Array<{ size: [number, number]; rotation?: number }>,
): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  for (const p of pages) {
    const page = doc.addPage(p.size);
    if (p.rotation !== undefined && p.rotation !== 0) {
      page.setRotation(degrees(p.rotation));
    }
  }
  return doc.save();
}

describe('buildMergedPdf', () => {
  it('按 PageList 顺序复制页并叠加旋转（含源固有旋转），页序用尺寸区分', async () => {
    const srcA = await makeSource([{ size: [100, 100], rotation: 90 }]);
    const srcB = await makeSource([{ size: [200, 200] }, { size: [300, 300] }]);

    const pages: ExportPage[] = [
      { sourceId: 'b', sourcePageIndex: 0, rotation: 0 }, // 200x200, 0+0
      { sourceId: 'a', sourcePageIndex: 0, rotation: 90 }, // 100x100, 90+90
      { sourceId: 'b', sourcePageIndex: 1, rotation: 180 }, // 300x300, 0+180
    ];

    const progress: number[] = [];
    const bytes = await buildMergedPdf(
      [
        { sourceId: 'a', bytes: new Uint8Array(srcA) },
        { sourceId: 'b', bytes: new Uint8Array(srcB) },
      ],
      pages,
      (done) => progress.push(done),
    );

    expect(progress).toEqual([1, 2, 3]);
    const out = await PDFDocument.load(bytes);
    expect(out.getPageCount()).toBe(3);

    // 页序：用 MediaBox 尺寸区分来源（getSize 不受旋转影响）。
    expect(out.getPage(0).getSize().width).toBe(200);
    expect(out.getPage(1).getSize().width).toBe(100);
    expect(out.getPage(2).getSize().width).toBe(300);

    // 旋转：源固有 + 用户旋转。
    expect(out.getPage(0).getRotation().angle).toBe(0);
    expect(out.getPage(1).getRotation().angle).toBe(180);
    expect(out.getPage(2).getRotation().angle).toBe(180);
  });

  it('引用缺失源时抛出中文错误', async () => {
    await expect(
      buildMergedPdf([], [{ sourceId: 'ghost', sourcePageIndex: 0, rotation: 0 }]),
    ).rejects.toThrow(/找不到源/);
  });
});

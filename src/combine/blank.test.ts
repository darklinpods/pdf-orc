import { describe, expect, it } from 'vitest';
import { PDFDocument } from 'pdf-lib';
import { blankA4PdfBytes } from './blank';

describe('blankA4PdfBytes', () => {
  it('生成单页 A4 空白 PDF，且结果缓存复用', async () => {
    const a = await blankA4PdfBytes();
    const b = await blankA4PdfBytes();
    expect(a).toBe(b); // 缓存：两次返回同一引用

    const doc = await PDFDocument.load(a);
    expect(doc.getPageCount()).toBe(1);
    const page = doc.getPage(0);
    // A4 ≈ 595.28 × 841.89 pt
    expect(Math.round(page.getWidth())).toBe(595);
    expect(Math.round(page.getHeight())).toBe(842);
  });
});

import { PDFDocument } from 'pdf-lib';
import { A4_150DPI, computeCombineLayout, type CombineLayout } from './layout';

export interface CombineOptions {
  layout: CombineLayout;
  /** 拼合后是否删除原两页（由用户确认，非自动）。 */
  removeOriginals: boolean;
}

/** 把若干已渲染的 canvas 按上下/左右拼合到一张 A4 canvas（白底）。 */
export function compositeCanvases(
  canvases: HTMLCanvasElement[],
  layout: CombineLayout,
): HTMLCanvasElement {
  const out = document.createElement('canvas');
  out.width = A4_150DPI.width;
  out.height = A4_150DPI.height;
  const ctx = out.getContext('2d');
  if (ctx === null) throw new Error('无法获取 2D 渲染上下文');
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, out.width, out.height);

  const rects = computeCombineLayout(
    canvases.map((c) => ({ width: c.width, height: c.height })),
    layout,
  );
  rects.forEach((r, i) => ctx.drawImage(canvases[i], r.x, r.y, r.w, r.h));
  return out;
}

function canvasToJpegBytes(canvas: HTMLCanvasElement): Promise<Uint8Array> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob === null) {
          reject(new Error('canvas 导出失败'));
          return;
        }
        blob
          .arrayBuffer()
          .then((buf) => resolve(new Uint8Array(buf)))
          .catch(reject);
      },
      'image/jpeg',
      0.92,
    );
  });
}

/** 合成 canvas → 单页 PDF 字节（150dpi，A4 尺寸映射）。 */
export async function canvasToSinglePagePdf(canvas: HTMLCanvasElement): Promise<Uint8Array> {
  const jpg = await canvasToJpegBytes(canvas);
  const doc = await PDFDocument.create();
  const img = await doc.embedJpg(jpg);
  const scale = 72 / 150;
  const w = Math.round(canvas.width * scale);
  const h = Math.round(canvas.height * scale);
  const page = doc.addPage([w, h]);
  page.drawImage(img, { x: 0, y: 0, width: w, height: h });
  return await doc.save();
}

// pdf-lib 导出 spike（ADR 0002 早期验证）：node 环境验证合并/重排/旋转/保存链路。
// 运行：node scripts/pdf-lib-spike.mjs
import { PDFDocument, StandardFonts, rgb, degrees } from 'pdf-lib';

async function makeDoc(pageCount, label) {
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  for (let i = 0; i < pageCount; i++) {
    const page = doc.addPage([595, 842]); // A4
    page.drawText(`${label}-${i + 1}`, { x: 50, y: 800, size: 24, font, color: rgb(0, 0, 0) });
  }
  return doc;
}

const aBytes = await (await makeDoc(3, 'A')).save();
const bBytes = await (await makeDoc(2, 'B')).save();

const a = await PDFDocument.load(aBytes);
const b = await PDFDocument.load(bBytes);
const out = await PDFDocument.create();
const [a1, a2, a3] = await out.copyPages(a, [0, 1, 2]);
const [b1, b2] = await out.copyPages(b, [0, 1]);
// 目标顺序：B1, A1, A3, B2, A2（与文档核心的 reorder 语义一致）
for (const p of [b1, a1, a3, b2, a2]) out.addPage(p);
out.getPage(0).setRotation(degrees(90));

const outBytes = await out.save();
const reloaded = await PDFDocument.load(outBytes);
console.log('合并后页数:', reloaded.getPageCount());
console.log('第1页旋转角:', reloaded.getPage(0).getRotation().angle);
console.log('各页尺寸:', reloaded.getPages().map((p) => `${p.getWidth()}x${p.getHeight()}`).join(', '));
console.log('导出体积:', outBytes.byteLength, 'bytes');

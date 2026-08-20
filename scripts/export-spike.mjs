// 真实扫描件导出 spike（ADR 0002 / ADR 0007）：
// 在 node 环境验证 pdf-lib 对扫描件的「加载 / 复制 / 保存」兼容性、体积变化与图像编码统计。
// 运行：node scripts/export-spike.mjs <文件1.pdf> [文件2.pdf ...]
import { readFile } from 'node:fs/promises';
import { PDFArray, PDFDocument, PDFName, PDFStream } from 'pdf-lib';

const files = process.argv.slice(2);
if (files.length === 0) {
  console.error('用法：node scripts/export-spike.mjs <文件.pdf...>');
  process.exit(1);
}

const FILTER_NOTES = {
  JPXDecode: 'JPEG2000（风险：可能复制失败/降级）',
  CCITTFaxDecode: 'CCITT G3/G4 传真（风险：可能复制失败/降级）',
  JBIG2Decode: 'JBIG2 二值（风险：可能复制失败/降级）',
  DCTDecode: 'JPEG（一般可复制）',
  FlateDecode: 'Flate 无损（一般可复制）',
  LZWDecode: 'LZW（一般可复制）',
  RunLengthDecode: 'RunLength（一般可复制）',
};

function nameStr(name) {
  return String(name).replace(/^\//, '');
}

function filterNames(filterObj) {
  if (filterObj === undefined) return ['None'];
  if (filterObj instanceof PDFArray) {
    return filterObj.asArray().map(nameStr);
  }
  return [nameStr(filterObj)];
}

/** 统计文档里的位图图像对象及其编码（遍历间接对象，不受对象流压缩影响）。 */
function countImageFilters(doc) {
  const counts = new Map();
  let imageCount = 0;
  for (const [, obj] of doc.context.enumerateIndirectObjects()) {
    if (!(obj instanceof PDFStream)) continue;
    const dict = obj.dict;
    const subtype = dict.get(PDFName.of('Subtype'));
    if (subtype === undefined || nameStr(subtype) !== 'Image') continue;
    imageCount += 1;
    for (const key of filterNames(dict.get(PDFName.of('Filter')))) {
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
  }
  return { imageCount, counts };
}

function fmtBytes(n) {
  return `${(n / 1024 / 1024).toFixed(2)}MB`;
}

for (const file of files) {
  const label = file.split('/').pop();
  const inBytes = await readFile(file);
  console.log(`\n=== ${label}（原始 ${fmtBytes(inBytes.byteLength)}）===`);

  let doc;
  try {
    doc = await PDFDocument.load(inBytes, { ignoreEncryption: false });
  } catch (err) {
    console.log(`  ❌ 加载失败：${err.message}`);
    continue;
  }

  const { imageCount, counts } = countImageFilters(doc);
  console.log(`  页数：${doc.getPageCount()}，图像对象：${imageCount}`);
  if (imageCount > 0) {
    for (const [k, c] of [...counts.entries()].sort((a, b) => b[1] - a[1])) {
      console.log(`    - ${k}：${c} 处（${FILTER_NOTES[k] ?? '其他'}）`);
    }
  } else {
    console.log(`    - 未发现位图图像（可能为纯文字/矢量 PDF）`);
  }

  // 复制全部页到新文档并保存：验证导出链路 + 体积变化 + 耗时。
  const t0 = performance.now();
  try {
    const out = await PDFDocument.create();
    const indices = Array.from({ length: doc.getPageCount() }, (_, i) => i);
    const copied = await out.copyPages(doc, indices);
    for (const p of copied) out.addPage(p);
    const outBytes = await out.save();
    const ms = Math.round(performance.now() - t0);
    const ratio = (outBytes.byteLength / inBytes.byteLength).toFixed(2);
    console.log(`  ✅ 复制+保存成功：${fmtBytes(inBytes.byteLength)} → ${fmtBytes(outBytes.byteLength)}（${ratio}x，${ms}ms）`);
  } catch (err) {
    const ms = Math.round(performance.now() - t0);
    console.log(`  ❌ 复制+保存失败（${ms}ms）：${err.message}`);
  }
}

console.log('\n完成。');

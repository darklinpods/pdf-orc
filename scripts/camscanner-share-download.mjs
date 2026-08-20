// CamScanner 分享链接 → PDF 下载（CLI）
// 用法：node scripts/camscanner-share-download.mjs <分享URL|分享页URL> [输出目录]
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { downloadSharePdf } from './camscanner-share-lib.mjs';

const inputUrl = process.argv[2];
const outDir = process.argv[3] || './cs-inbox';
if (!inputUrl) {
  console.error('用法：node scripts/camscanner-share-download.mjs <分享URL> [输出目录]');
  process.exit(1);
}
mkdirSync(outDir, { recursive: true });

const { bytes, filename, pageCount } = await downloadSharePdf(inputUrl, {
  onProgress: (done, total) => console.log(`  已下载 ${done}/${total}`),
});
writeFileSync(join(outDir, filename), bytes);
console.log(`完成：${join(outDir, filename)}（${pageCount} 页，${(bytes.byteLength / 1024 / 1024).toFixed(2)} MB）`);

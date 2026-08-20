// CamScanner 公开分享链接 → 下载全部页面并合成 PDF
// 用法：node scripts/camscanner-share-download.mjs <分享URL|分享页URL> <输出目录>
// 公开分享无需登录：query_share_info_with_link 取页序，download_resize_jpg 取每页全分辨率图。
import { PDFDocument } from 'pdf-lib';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const inputUrl = process.argv[2];
const outDir = process.argv[3] || './cs-inbox';
mkdirSync(outDir, { recursive: true });

const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/126.0 Safari/537.36';

// 1. 短链 → 分享页 URL（跟随重定向）
let shareUrl = inputUrl;
if (/link\.camscanner\.com/.test(inputUrl)) {
  const r = await fetch(inputUrl, { redirect: 'follow', headers: { 'User-Agent': UA } });
  shareUrl = r.url;
}
console.log('分享页:', shareUrl);

// 2. 从路径 /s/<enc>/<code> 提取参数
const m = shareUrl.match(/\/s\/([^/?#]+)\/([^/?#]+)/);
if (!m) throw new Error('无法从 URL 解析分享标识');
const rawEnc = m[1]; // 路径中已 %-编码的段（如 MHgyOTNmMTE1Zg%3D%3D）
const code = decodeURIComponent(m[2]);
console.log('code:', code);

// 3. 查询分享信息
const encForQuery = encodeURIComponent(rawEnc);
const infoUrl = `https://cs8.intsig.net/sync/query_share_info_with_link?encrypt_id=${encForQuery}&link=${code}&platform=web`;
const info = await (await fetch(infoUrl, { headers: { 'User-Agent': UA } })).json();
if (info.error_code !== 0) throw new Error(`查询分享信息失败：${JSON.stringify(info).slice(0, 200)}`);
const nickname = info.data?.user_info?.nickname || '分享文档';
const pageList = info.data?.doc_info?.page_list || [];
console.log(`文档：${nickname}，共 ${pageList.length} 页`);

// 4. 下载每页（并发限制 6）
const encForDownload = rawEnc;
const CONCURRENCY = 6;
const results = new Array(pageList.length);
let next = 0;
async function worker() {
  while (true) {
    const i = next++;
    if (i >= pageList.length) return;
    const p = pageList[i];
    const url = `https://cs8.intsig.net/sync/share/download_resize_jpg?encrypt_id=${encForDownload}&file_name=${p.file_name}.jpg&sid=${code}`;
    const res = await fetch(url, { headers: { 'User-Agent': UA } });
    if (!res.ok) throw new Error(`第 ${i + 1} 页下载失败：HTTP ${res.status}`);
    results[i] = new Uint8Array(await res.arrayBuffer());
    console.log(`  已下载 ${i + 1}/${pageList.length}（${p.file_name}）`);
  }
}
await Promise.all(Array.from({ length: CONCURRENCY }, worker));

// 5. 合成 PDF（300 DPI 归一化，逐页 embedJpg 不重压缩，应用 rotate）
const out = await PDFDocument.create();
const SCALE = 72 / 300;
for (let i = 0; i < results.length; i++) {
  const img = await out.embedJpg(results[i]);
  const w = Math.round(img.width * SCALE);
  const h = Math.round(img.height * SCALE);
  const page = out.addPage([w, h]);
  page.drawImage(img, { x: 0, y: 0, width: w, height: h });
  const rot = pageList[i].rotate ?? 0;
  if (rot !== 0) page.setRotation({ type: 'degrees', angle: rot });
}
const bytes = await out.save();
const filename = `${nickname.replace(/[\\/:*?"<>|]/g, '_')}-分享.pdf`;
writeFileSync(join(outDir, filename), bytes);
console.log(`完成：${join(outDir, filename)}（${pageList.length} 页，${(bytes.byteLength / 1024 / 1024).toFixed(2)} MB）`);

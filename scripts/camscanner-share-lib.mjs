// CamScanner 公开分享链接 → 下载全部页图并合成 PDF（共享逻辑，供 CLI 与桥接服务复用）
// 公开分享无需登录：query_share_info_with_link 取页序，download_resize_jpg 取每页全分辨率图。
import { PDFDocument } from 'pdf-lib';

const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/126.0 Safari/537.36';

/** 短链 → 分享页 URL（跟随重定向） */
async function resolveShareUrl(inputUrl) {
  if (/link\.camscanner\.com/.test(inputUrl)) {
    const r = await fetch(inputUrl, { redirect: 'follow', headers: { 'User-Agent': UA } });
    return r.url;
  }
  return inputUrl;
}

/** 从分享页 URL 的 /s/<enc>/<code> 路径提取参数 */
function parseSharePath(shareUrl) {
  const m = shareUrl.match(/\/s\/([^/?#]+)\/([^/?#]+)/);
  if (!m) throw new Error('无法从 URL 解析分享标识（应为 camscanner.com/s/<id>/<code> 形式）');
  return { rawEnc: m[1], code: decodeURIComponent(m[2]) };
}

/**
 * 下载分享文档并合成 PDF。
 * @param {string} inputUrl 分享链接（link.camscanner.com 短链或 camscanner.com/s/… 分享页）
 * @param {{ onProgress?: (done: number, total: number) => void }} [options]
 * @returns {Promise<{ bytes: Uint8Array, filename: string, pageCount: number, nickname: string }>}
 */
export async function downloadSharePdf(inputUrl, options = {}) {
  const { onProgress } = options;
  const shareUrl = await resolveShareUrl(inputUrl);
  const { rawEnc, code } = parseSharePath(shareUrl);

  // 1. 查询分享信息（页序 + 每页文件名/旋转）
  const encForQuery = encodeURIComponent(rawEnc);
  const infoUrl = `https://cs8.intsig.net/sync/query_share_info_with_link?encrypt_id=${encForQuery}&link=${code}&platform=web`;
  const info = await (await fetch(infoUrl, { headers: { 'User-Agent': UA } })).json();
  if (info.error_code !== 0) {
    throw new Error(`查询分享信息失败：${JSON.stringify(info).slice(0, 200)}`);
  }
  const nickname = info.data?.user_info?.nickname || '分享文档';
  const pageList = info.data?.doc_info?.page_list || [];
  if (pageList.length === 0) throw new Error('该分享文档没有页面');

  // 2. 并发下载每页
  const CONCURRENCY = 6;
  const pages = new Array(pageList.length);
  let next = 0;
  async function worker() {
    while (true) {
      const i = next++;
      if (i >= pageList.length) return;
      const p = pageList[i];
      const url = `https://cs8.intsig.net/sync/share/download_resize_jpg?encrypt_id=${rawEnc}&file_name=${p.file_name}.jpg&sid=${code}`;
      const res = await fetch(url, { headers: { 'User-Agent': UA } });
      if (!res.ok) throw new Error(`第 ${i + 1} 页下载失败：HTTP ${res.status}`);
      pages[i] = new Uint8Array(await res.arrayBuffer());
      onProgress?.(i + 1, pageList.length);
    }
  }
  await Promise.all(Array.from({ length: CONCURRENCY }, worker));

  // 3. 合成 PDF（300 DPI 归一化，逐页 embedJpg 不重压缩，应用 rotate）
  const out = await PDFDocument.create();
  const SCALE = 72 / 300;
  for (let i = 0; i < pages.length; i++) {
    const img = await out.embedJpg(pages[i]);
    const w = Math.round(img.width * SCALE);
    const h = Math.round(img.height * SCALE);
    const page = out.addPage([w, h]);
    page.drawImage(img, { x: 0, y: 0, width: w, height: h });
    const rot = pageList[i].rotate ?? 0;
    if (rot !== 0) page.setRotation({ type: 'degrees', angle: rot });
  }
  const bytes = await out.save();
  const filename = `${nickname.replace(/[\\/:*?"<>|]/g, '_')}-分享.pdf`;
  return { bytes, filename, pageCount: pageList.length, nickname };
}

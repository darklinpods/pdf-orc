import type { DocumentState } from '../core/types';
import { pdfSourceManager } from '../render/pdfjs';
import { BRIDGE_URL } from '../bridge';

/** OCR 一份源 PDF，返回按源内页下标（0 起）排列的每页文字。 */
async function ocrSource(sourceId: string): Promise<string[]> {
  const handle = pdfSourceManager.get(sourceId);
  if (handle === undefined) throw new Error(`源「${sourceId}」未打开，请重新导入`);
  const bytes = await handle.proxy.getData();
  // 复制为普通 ArrayBuffer 以满足 fetch BodyInit 类型要求。
  const body = new ArrayBuffer(bytes.byteLength);
  new Uint8Array(body).set(bytes);
  const res = await fetch(`${BRIDGE_URL}/ocr`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/octet-stream' },
    body,
  });
  if (!res.ok) {
    let message = `OCR 返回 HTTP ${res.status}`;
    try {
      const data = (await res.json()) as { error?: string };
      if (data.error) message = data.error;
    } catch {
      /* 非 JSON 响应 */
    }
    throw new Error(message);
  }
  const data = (await res.json()) as { pages: Array<{ page: number; text: string }> };
  return [...data.pages].sort((a, b) => a.page - b.page).map((p) => p.text);
}

/** 对当前文档逐源 OCR（每源一次），返回 pageId → 文字 映射。 */
export async function ocrDocument(document: DocumentState): Promise<Map<string, string>> {
  const sourceIds = [...new Set(document.pages.map((p) => p.sourceId))];
  const sourceTexts = new Map<string, string[]>();
  for (const sid of sourceIds) {
    sourceTexts.set(sid, await ocrSource(sid));
  }
  const result = new Map<string, string>();
  for (const p of document.pages) {
    const texts = sourceTexts.get(p.sourceId);
    result.set(p.id, texts?.[p.sourcePageIndex] ?? '');
  }
  return result;
}

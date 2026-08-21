import type { DocumentState } from '../core/types';
import { pdfSourceManager } from '../render/pdfjs';
import { buildExportPlan } from './plan';
import type { ExportRequest, ExportWorkerMessage } from './protocol';
import ExportWorker from './export.worker?worker';

export interface ExportProgress {
  done: number;
  total: number;
}

/** 导出选项。 */
export interface ExportOptions {
  onProgress?: (progress: ExportProgress) => void;
  /** 只导出这些页面 id（保持给定顺序）；缺省导出全部。 */
  pageIds?: string[];
  /** 覆盖建议文件名（如按分组导出时用组名）。 */
  filename?: string;
}

/**
 * 导出文档为单份 PDF 并触发下载。
 * 流程：构建计划 → 从 pdf.js worker 取回各源原始字节 → 交给导出 worker（pdf-lib）
 * 组装并保存 → 下载。全程不阻塞主线程，进度通过 options.onProgress 回调。
 */
export async function exportDocument(
  document: DocumentState,
  options: ExportOptions = {},
): Promise<void> {
  const plan = buildExportPlan(document, {
    pageIds: options.pageIds,
    filename: options.filename,
  });
  if (plan.pages.length === 0) {
    throw new Error('没有可导出的页面，请先导入 PDF 或选择分组');
  }

  // 从渲染边界取回各源原始字节（proxy.getData 从 worker 拉回，不常驻双份拷贝）。
  const sources = await Promise.all(
    plan.sourceIds.map(async (sourceId) => {
      const handle = pdfSourceManager.get(sourceId);
      if (handle === undefined) {
        throw new Error(`导出失败：源「${sourceId}」未打开，请重新导入后重试`);
      }
      const bytes = await handle.proxy.getData();
      return { sourceId, bytes };
    }),
  );

  const worker = new ExportWorker();
  try {
    const data = await runWorker(worker, { sources, pages: plan.pages }, options.onProgress);
    downloadPdf(data, plan.filename);
  } finally {
    worker.terminate();
  }
}

function runWorker(
  worker: Worker,
  request: ExportRequest,
  onProgress?: (progress: ExportProgress) => void,
): Promise<ArrayBuffer> {
  return new Promise((resolve, reject) => {
    worker.onmessage = (event: MessageEvent<ExportWorkerMessage>) => {
      const msg = event.data;
      if (msg.type === 'progress') {
        onProgress?.({ done: msg.done, total: msg.total });
      } else if (msg.type === 'done') {
        resolve(msg.data);
      } else {
        reject(new Error(msg.message));
      }
    };
    worker.onerror = (event) => {
      reject(new Error(event.message || '导出失败'));
    };
    // 把各源字节的底层 ArrayBuffer 移交给 worker，避免主线程再复制一份。
    const transfer = request.sources.map((s) => s.bytes.buffer);
    worker.postMessage(request, transfer);
  });
}

function downloadPdf(data: ArrayBuffer, filename: string): void {
  const blob = new Blob([new Uint8Array(data)], { type: 'application/pdf' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

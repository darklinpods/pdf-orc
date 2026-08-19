import { getDocument, GlobalWorkerOptions, type PDFDocumentLoadingTask, type PDFDocumentProxy } from 'pdfjs-dist';
// Vite ?worker 导入：pdf.js worker 作为独立模块 worker，单例。
import PdfJsWorker from 'pdfjs-dist/build/pdf.worker.min.mjs?worker';

/**
 * pdf.js worker 单例（ADR 0007：单 worker，ArrayBuffer 由 pdf.js 内部移交）。
 * 必须在任何 getDocument 之前设置；模块加载即完成，组件无需关心。
 */
if (typeof window !== 'undefined' && GlobalWorkerOptions.workerPort === null) {
  GlobalWorkerOptions.workerPort = new PdfJsWorker();
}

export interface SourceHandle {
  sourceId: string;
  name: string;
  pageCount: number;
}

interface OpenedSource extends SourceHandle {
  proxy: PDFDocumentProxy;
  /** v6 起 PDFDocumentProxy 不再暴露 destroy，统一通过 loadingTask 释放。 */
  loadingTask: PDFDocumentLoadingTask;
}

/**
 * 源 PDF 注册表（渲染边界）：持有打开文档的 proxy，惰性打开、显式关闭。
 * 与文档核心的 SourceRef（纯元数据）分离：字节与 proxy 只存在于本层。
 */
class PdfSourceManager {
  private sources = new Map<string, OpenedSource>();

  /** 打开一份源 PDF，返回句柄；同一 sourceId 重复打开直接返回已有句柄。 */
  async open(sourceId: string, name: string, data: ArrayBuffer): Promise<SourceHandle> {
    const existing = this.sources.get(sourceId);
    if (existing !== undefined) return existing;
    const task = getDocument({ data: new Uint8Array(data) });
    const proxy = await task.promise;
    const handle: OpenedSource = { sourceId, name, pageCount: proxy.numPages, proxy, loadingTask: task };
    this.sources.set(sourceId, handle);
    return handle;
  }

  get(sourceId: string): OpenedSource | undefined {
    return this.sources.get(sourceId);
  }

  has(sourceId: string): boolean {
    return this.sources.has(sourceId);
  }

  /** 关闭并释放文档（loadingTask.destroy）；不存在时无操作。 */
  async close(sourceId: string): Promise<void> {
    const source = this.sources.get(sourceId);
    if (source === undefined) return;
    this.sources.delete(sourceId);
    await source.loadingTask.destroy();
  }

  async closeAll(): Promise<void> {
    await Promise.all([...this.sources.keys()].map((id) => this.close(id)));
  }

  get size(): number {
    return this.sources.size;
  }
}

export const pdfSourceManager = new PdfSourceManager();

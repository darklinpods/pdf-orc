import type { ExportPage } from './plan';

/** 传入 worker 的单份源：id + 原始字节。 */
export interface ExportSourceInput {
  sourceId: string;
  bytes: Uint8Array;
}

/** 主线程发给导出 worker 的请求。 */
export interface ExportRequest {
  sources: ExportSourceInput[];
  pages: ExportPage[];
}

/** 导出 worker 回传主线程的消息。 */
export type ExportWorkerMessage =
  | { type: 'progress'; done: number; total: number }
  | { type: 'done'; data: ArrayBuffer }
  | { type: 'error'; message: string };

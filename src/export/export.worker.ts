import { buildMergedPdf } from './build';
import type { ExportRequest, ExportWorkerMessage } from './protocol';

/** worker 全局作用域的最小类型面，避免与 DOM 的 window.postMessage 签名冲突。 */
type WorkerScope = {
  onmessage: ((event: MessageEvent<ExportRequest>) => void) | null;
  postMessage: (message: ExportWorkerMessage, transfer?: Transferable[]) => void;
};

const scope = self as unknown as WorkerScope;

scope.onmessage = async (event) => {
  const { sources, pages } = event.data;
  try {
    const data = await buildMergedPdf(sources, pages, (done, total) => {
      scope.postMessage({ type: 'progress', done, total });
    });
    // 复制成恰好大小、且类型确定为普通 ArrayBuffer 的字节再移交（避免 TS 联合类型与多余字节）。
    const buffer = new ArrayBuffer(data.byteLength);
    new Uint8Array(buffer).set(data);
    scope.postMessage({ type: 'done', data: buffer }, [buffer]);
  } catch (err) {
    scope.postMessage({
      type: 'error',
      message: err instanceof Error ? err.message : String(err),
    });
  }
};

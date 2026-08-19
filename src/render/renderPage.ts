import type { Rotation } from '../core/types';
import { pdfSourceManager } from './pdfjs';
import { fitScale } from './pageScale';

export { fitScale } from './pageScale';

export interface RenderPageRequest {
  sourceId: string;
  /** 0 起页下标。 */
  pageIndex: number;
  /** 页面当前旋转（PageRef.rotation）。 */
  rotation: Rotation;
  /** 目标输出宽度（CSS px）。 */
  targetWidth: number;
  /** 可选的最大输出高度。 */
  targetHeight?: number;
  /** 复用已有 canvas（未提供时新建）。 */
  canvas?: HTMLCanvasElement;
  /** 取消信号：中止时抛出 AbortError（用于滚动/切页取消在途渲染）。 */
  signal?: AbortSignal;
}

export interface RenderPageResult {
  canvas: HTMLCanvasElement;
  width: number;
  height: number;
  /** 实际使用的渲染 scale。 */
  scale: number;
}

/**
 * 把某源 PDF 的一页渲染到 canvas。
 * 关键语义：pdf.js getViewport 的 rotation 参数是「最终旋转」，会覆盖页面自带 /Rotate，
 * 因此必须叠加 page.rotate，否则源文件的固有旋转会丢失。
 */
export async function renderPageToCanvas(req: RenderPageRequest): Promise<RenderPageResult> {
  const source = pdfSourceManager.get(req.sourceId);
  if (source === undefined) {
    throw new Error(`源未打开：${req.sourceId}，请先导入文件`);
  }
  const page = await source.proxy.getPage(req.pageIndex + 1); // pdf.js 页码 1 起
  const viewport = page.getViewport({
    scale: 1,
    rotation: (page.rotate + req.rotation) % 360,
  });
  const scale = fitScale(viewport.width, viewport.height, req.targetWidth, req.targetHeight);
  const width = Math.max(1, Math.round(viewport.width * scale));
  const height = Math.max(1, Math.round(viewport.height * scale));

  const canvas = req.canvas ?? document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d', { alpha: false });
  if (ctx === null) {
    throw new Error('无法获取 2D 渲染上下文');
  }
  const renderTask = page.render({
    canvasContext: ctx,
    viewport: viewport.clone({ scale }),
    canvas,
  });

  const signal = req.signal;
  if (signal?.aborted) {
    renderTask.cancel();
    throw new DOMException('渲染已取消', 'AbortError');
  }
  const onAbort = () => renderTask.cancel();
  signal?.addEventListener('abort', onAbort, { once: true });
  try {
    await renderTask.promise;
  } catch (err) {
    if (signal?.aborted) throw new DOMException('渲染已取消', 'AbortError');
    throw err;
  } finally {
    signal?.removeEventListener('abort', onAbort);
  }
  return { canvas, width, height, scale };
}

import { useEffect, useRef, type CSSProperties } from 'react';
import type { Rotation } from '../core/types';
import { renderPageToCanvas } from './renderPage';
import { LruCache, thumbnailCacheKey } from './thumbnailCache';

/**
 * 全局缩略图 LRU：跨组件共享（管理网格与阅读缩略图栏）。
 * 上限 500（ADR 0007：16GB 基线可放宽）；存储低分辨率 ImageBitmap，内存可控。
 */
const thumbnailCache = new LruCache<ImageBitmap>(500);

export interface PageRendererProps {
  sourceId: string;
  /** 0 起页下标。 */
  pageIndex: number;
  rotation: Rotation;
  /** 渲染目标宽度（CSS px）。 */
  targetWidth: number;
  targetHeight?: number;
  /**
   * thumbnail：走 LRU 位图缓存（管理网格/缩略图栏，大量实例）；
   * full：直接渲染到自身 canvas（阅读大图，实例数受视图控制，符合 ADR 0007）。
   */
  mode?: 'thumbnail' | 'full';
  className?: string;
  style?: CSSProperties;
  /** 渲染完成回调（实际像素尺寸）；尺寸未变化时不重复触发。 */
  onRendered?: (info: { width: number; height: number }) => void;
}

function blitBitmap(canvas: HTMLCanvasElement, bitmap: ImageBitmap): void {
  if (canvas.width !== bitmap.width) canvas.width = bitmap.width;
  if (canvas.height !== bitmap.height) canvas.height = bitmap.height;
  canvas.getContext('2d')?.drawImage(bitmap, 0, 0);
}

/**
 * 单页渲染组件。异步渲染 + 取消（依赖变化/卸载时中止在途渲染），
 * thumbnail 模式命中缓存时直接绘制位图。
 */
export function PageRenderer({
  sourceId,
  pageIndex,
  rotation,
  targetWidth,
  targetHeight,
  mode = 'thumbnail',
  className,
  style,
  onRendered,
}: PageRendererProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  // 回调放 ref：不参与 effect 依赖，避免父组件内联函数导致重渲染循环。
  const onRenderedRef = useRef(onRendered);
  onRenderedRef.current = onRendered;

  useEffect(() => {
    const canvasEl = canvasRef.current;
    if (canvasEl === null) return;
    // 显式非空局部：避免 TS 闭包窄化差异。
    const canvas: HTMLCanvasElement = canvasEl;
    const controller = new AbortController();
    let disposed = false;

    async function draw(): Promise<void> {
      try {
        if (mode === 'thumbnail') {
          const key = thumbnailCacheKey(sourceId, pageIndex, rotation, targetWidth);
          const cached = thumbnailCache.get(key);
          if (cached !== undefined) {
            blitBitmap(canvas, cached);
            return;
          }
          const result = await renderPageToCanvas({
            sourceId,
            pageIndex,
            rotation,
            targetWidth,
            targetHeight,
            signal: controller.signal,
          });
          if (disposed) return;
          const bitmap = await createImageBitmap(result.canvas);
          if (disposed) return;
          thumbnailCache.set(key, bitmap);
          blitBitmap(canvas, bitmap);
        } else {
          const result = await renderPageToCanvas({
            sourceId,
            pageIndex,
            rotation,
            targetWidth,
            targetHeight,
            canvas,
            signal: controller.signal,
          });
          if (disposed) return;
          if (canvas.width !== result.width || canvas.height !== result.height) {
            canvas.width = result.width;
            canvas.height = result.height;
          }
          onRenderedRef.current?.({ width: result.width, height: result.height });
        }
      } catch (err) {
        if (disposed || (err instanceof DOMException && err.name === 'AbortError')) return;
        console.error(`页面渲染失败：${sourceId} 第 ${pageIndex + 1} 页`, err);
      }
    }

    void draw();
    return () => {
      disposed = true;
      controller.abort();
    };
  }, [sourceId, pageIndex, rotation, targetWidth, targetHeight, mode]);

  return (
    <canvas
      ref={canvasRef}
      className={className}
      style={{ display: 'block', width: '100%', height: 'auto', ...style }}
    />
  );
}

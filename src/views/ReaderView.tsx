import { useCallback, useEffect, useRef, useState } from 'react';
import type { DocumentState } from '../core/types';
import { PageRenderer } from '../render/PageRenderer';
import { LazyMount } from '../components/LazyMount';

export interface ReaderViewProps {
  document: DocumentState;
}

const MIN_ZOOM = 0.5;
const MAX_ZOOM = 4;
const ZOOM_STEP = 0.25;

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

export function ReaderView({ document }: ReaderViewProps) {
  const pages = document.pages;
  const [current, setCurrent] = useState(0);
  const [zoom, setZoom] = useState(1);
  const mainRef = useRef<HTMLDivElement>(null);
  const activeRef = useRef<HTMLButtonElement>(null);
  const [containerWidth, setContainerWidth] = useState(0);
  const wheelAccum = useRef(0);

  // 页面数变化（删除等）时收敛 current。
  const clamped = pages.length === 0 ? -1 : clamp(current, 0, pages.length - 1);
  useEffect(() => {
    if (pages.length === 0) {
      setCurrent(0);
    } else if (current !== clamped) {
      setCurrent(clamped);
    }
  }, [current, clamped, pages.length]);

  // 测量主区宽度（fit-width 基准）。
  useEffect(() => {
    const el = mainRef.current;
    if (el === null) return;
    const ro = new ResizeObserver((entries) => {
      for (const entry of entries) {
        setContainerWidth(entry.contentRect.width);
      }
    });
    ro.observe(el);
    setContainerWidth(el.clientWidth);
    return () => ro.disconnect();
  }, []);

  const goTo = useCallback(
    (index: number) => {
      if (pages.length === 0) return;
      setCurrent(clamp(index, 0, pages.length - 1));
    },
    [pages.length],
  );
  const goBy = useCallback(
    (delta: number) => {
      setCurrent((c) => (pages.length === 0 ? 0 : clamp(c + delta, 0, pages.length - 1)));
    },
    [pages.length],
  );
  const changeZoom = useCallback(
    (delta: number) => {
      setZoom((z) => clamp(Math.round((z + delta) * 100) / 100, MIN_ZOOM, MAX_ZOOM));
    },
    [],
  );

  // 键盘导航。
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft' || e.key === 'ArrowUp' || e.key === 'PageUp') {
        e.preventDefault();
        goBy(-1);
      } else if (e.key === 'ArrowRight' || e.key === 'ArrowDown' || e.key === 'PageDown') {
        e.preventDefault();
        goBy(1);
      } else if (e.key === 'Home') {
        e.preventDefault();
        goTo(0);
      } else if (e.key === 'End') {
        e.preventDefault();
        goTo(pages.length - 1);
      } else if (e.key === '+' || e.key === '=') {
        changeZoom(ZOOM_STEP);
      } else if (e.key === '-' || e.key === '_') {
        changeZoom(-ZOOM_STEP);
      } else if (e.key === '0') {
        setZoom(1);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [goBy, goTo, changeZoom, pages.length]);

  // 活动缩略图自动滚入视野。
  useEffect(() => {
    activeRef.current?.scrollIntoView({ block: 'nearest' });
  }, [clamped]);

  // 滚轮：fit 模式（zoom≈1）翻页，放大模式滚动页面。
  const handleWheel = (e: React.WheelEvent<HTMLDivElement>) => {
    if (zoom > 1.001) return; // 放大时交给默认滚动
    wheelAccum.current += e.deltaY;
    if (Math.abs(wheelAccum.current) < 40) return;
    const dir = wheelAccum.current > 0 ? 1 : -1;
    wheelAccum.current = 0;
    goBy(dir);
  };

  const fitWidth = Math.max(240, containerWidth - 64);
  const targetWidth = Math.round(fitWidth * zoom);
  const page = pages[clamped];

  return (
    <div className="flex h-full">
      {/* 左侧缩略图栏 */}
      <aside className="w-40 shrink-0 overflow-y-auto border-r border-neutral-300 bg-neutral-50">
        {pages.map((p, i) => (
          <LazyMount key={p.id}>
            <button
              type="button"
              ref={i === clamped ? activeRef : undefined}
              onClick={() => goTo(i)}
              className={`w-full p-2 text-center transition ${
                i === clamped ? 'bg-blue-100' : 'hover:bg-neutral-200'
              }`}
            >
              <div className="mx-auto overflow-hidden rounded shadow-sm ring-1 ring-neutral-300">
                <PageRenderer
                  sourceId={p.sourceId}
                  pageIndex={p.sourcePageIndex}
                  rotation={p.rotation}
                  targetWidth={120}
                  mode="thumbnail"
                />
              </div>
              <div className="mt-1 text-xs text-neutral-500">{i + 1}</div>
            </button>
          </LazyMount>
        ))}
      </aside>

      {/* 右侧大图 */}
      <div className="flex min-w-0 flex-1 flex-col">
        <div className="flex items-center gap-2 border-b border-neutral-300 bg-neutral-50 px-3 py-1.5 text-sm">
          <span className="tabular-nums text-neutral-600">
            {pages.length === 0 ? '—' : `${clamped + 1} / ${pages.length}`}
          </span>
          <span className="mx-2 h-4 w-px bg-neutral-300" />
          <button type="button" className="px-2 py-0.5 hover:bg-neutral-200" onClick={() => changeZoom(-ZOOM_STEP)}>
            −
          </button>
          <button
            type="button"
            className="px-2 py-0.5 tabular-nums hover:bg-neutral-200"
            onClick={() => setZoom(1)}
            title="适应宽度"
          >
            {Math.round(zoom * 100)}%
          </button>
          <button type="button" className="px-2 py-0.5 hover:bg-neutral-200" onClick={() => changeZoom(ZOOM_STEP)}>
            +
          </button>
        </div>

        <div ref={mainRef} onWheel={handleWheel} className="flex-1 overflow-auto bg-neutral-300/60">
          {page === undefined ? (
            <div className="flex h-full items-center justify-center text-neutral-500">暂无页面</div>
          ) : (
            <div className="flex min-h-full flex-col items-center py-8">
              <div className="overflow-hidden rounded shadow-lg" style={{ width: targetWidth }}>
                <PageRenderer
                  sourceId={page.sourceId}
                  pageIndex={page.sourcePageIndex}
                  rotation={page.rotation}
                  targetWidth={targetWidth}
                  mode="full"
                />
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

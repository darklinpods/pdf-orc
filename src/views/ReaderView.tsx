import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { DocumentState, PageRef } from '../core/types';
import { clamp } from '../core/util';
import { PageRenderer } from '../render/PageRenderer';
import { getNaturalPageSize } from '../render/renderPage';
import { LazyMount } from '../components/LazyMount';
import { nextSpread, prevSpread, spreadForPage } from './spread';

export interface ReaderViewProps {
  document: DocumentState;
}

type ViewMode = 'single' | 'spread' | 'continuous';
type ZoomMode = 'fit-width' | 'fit-page' | 'actual' | 'custom';

const MIN_PCT = 25;
const MAX_PCT = 400;
const ZOOM_STEP = 10;

function pageKey(p: PageRef): string {
  return `${p.sourceId}:${p.sourcePageIndex}:${p.rotation}`;
}

export function ReaderView({ document }: ReaderViewProps) {
  const pages = document.pages;
  const [viewMode, setViewMode] = useState<ViewMode>('single');
  const [zoomMode, setZoomMode] = useState<ZoomMode>('fit-width');
  const [zoomPct, setZoomPct] = useState(100);
  const [current, setCurrent] = useState(0);
  const mainRef = useRef<HTMLDivElement>(null);
  const activeRef = useRef<HTMLButtonElement>(null);
  const pageEls = useRef(new Map<number, HTMLDivElement>());
  const [container, setContainer] = useState({ width: 0, height: 0 });
  const wheelAccum = useRef(0);
  const scrollingRef = useRef(false);

  const clamped = pages.length === 0 ? -1 : clamp(current, 0, pages.length - 1);
  useEffect(() => {
    if (pages.length === 0) setCurrent(0);
    else if (current !== clamped) setCurrent(clamped);
  }, [current, clamped, pages.length]);

  // 当前显示页（单页 / 双页 / 连续）
  const displayPages = useMemo<PageRef[]>(() => {
    if (pages.length === 0) return [];
    if (viewMode === 'spread') return spreadForPage(clamped, pages.length).map((i) => pages[i]);
    if (viewMode === 'continuous') return pages;
    return [pages[clamped]];
  }, [viewMode, clamped, pages]);
  const displayKey = useMemo(() => displayPages.map((p) => p.id).join(','), [displayPages]);

  // 测量容器尺寸
  useEffect(() => {
    const el = mainRef.current;
    if (el === null) return;
    const ro = new ResizeObserver((entries) => {
      for (const entry of entries) {
        setContainer({ width: entry.contentRect.width, height: entry.contentRect.height });
      }
    });
    ro.observe(el);
    setContainer({ width: el.clientWidth, height: el.clientHeight });
    return () => ro.disconnect();
  }, []);

  // 取显示页的自然尺寸（缓存）
  const [naturalSizes, setNaturalSizes] = useState<Map<string, { width: number; height: number }>>(new Map());
  useEffect(() => {
    let cancelled = false;
    const missing = displayPages.filter((p) => !naturalSizes.has(pageKey(p)));
    if (missing.length === 0) return;
    (async () => {
      const next = new Map(naturalSizes);
      for (const p of missing) {
        try {
          next.set(pageKey(p), await getNaturalPageSize(p.sourceId, p.sourcePageIndex, p.rotation));
        } catch {
          /* 忽略：源未就绪时稍后重试 */
        }
      }
      if (!cancelled) setNaturalSizes(next);
    })();
    return () => {
      cancelled = true;
    };
    // 依赖 displayKey：仅当显示页集合变化时重取自然尺寸。
  }, [displayKey]);

  const sizes = displayPages.map((p) => naturalSizes.get(pageKey(p)) ?? null);
  const sizesReady = sizes.every((s) => s !== null);
  const combinedW = sizes.reduce((acc, s) => acc + (s?.width ?? 0), 0);
  const combinedH = Math.max(0, ...sizes.map((s) => s?.height ?? 0));

  // 单页/双页的缩放比例
  const effScale = useMemo(() => {
    if (viewMode === 'continuous') return zoomPct / 100;
    if (!sizesReady || combinedW <= 0) return 1;
    if (zoomMode === 'fit-width') return container.width > 0 ? container.width / combinedW : 1;
    if (zoomMode === 'fit-page') {
      if (container.width <= 0 || container.height <= 0) return 1;
      return Math.min(container.width / combinedW, container.height / combinedH);
    }
    if (zoomMode === 'actual') return 1;
    return zoomPct / 100;
  }, [viewMode, zoomMode, zoomPct, sizesReady, combinedW, combinedH, container]);

  const goTo = useCallback(
    (index: number) => {
      if (pages.length === 0) return;
      setCurrent(clamp(index, 0, pages.length - 1));
    },
    [pages.length],
  );

  // 前进/后退：单页±1，双页按对开，连续±1
  const goBy = useCallback(
    (delta: number) => {
      if (pages.length === 0) return;
      setCurrent((c) => {
        let next: number;
        if (viewMode === 'spread') {
          next = delta > 0 ? nextSpread(c, pages.length) : prevSpread(c, pages.length);
        } else {
          next = c + delta;
        }
        return clamp(next, 0, pages.length - 1);
      });
    },
    [pages.length, viewMode],
  );

  const changeZoom = useCallback((deltaPct: number) => {
    setZoomMode('custom');
    setZoomPct((p) => clamp(Math.round(p + deltaPct), MIN_PCT, MAX_PCT));
  }, []);

  // 连续模式：滚动到指定页
  const scrollToPage = useCallback((index: number) => {
    const el = pageEls.current.get(index);
    if (el !== null && el !== undefined) {
      scrollingRef.current = true;
      el.scrollIntoView({ block: 'start' });
      window.setTimeout(() => {
        scrollingRef.current = false;
      }, 200);
    }
  }, []);

  // 键盘
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
        e.preventDefault();
        changeZoom(ZOOM_STEP);
      } else if (e.key === '-' || e.key === '_') {
        e.preventDefault();
        changeZoom(-ZOOM_STEP);
      } else if (e.key === '0') {
        e.preventDefault();
        setZoomMode('actual');
        setZoomPct(100);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [goBy, goTo, changeZoom, pages.length]);

  // 活动缩略图自动滚入视野
  useEffect(() => {
    if (viewMode !== 'continuous') activeRef.current?.scrollIntoView({ block: 'nearest' });
  }, [clamped, viewMode]);

  // 连续模式：滚动时跟踪当前页
  const handleScroll = useCallback(() => {
    if (viewMode !== 'continuous' || scrollingRef.current) return;
    const el = mainRef.current;
    if (el === null) return;
    const top = el.scrollTop + el.clientHeight / 2;
    let best = 0;
    let bestDist = Infinity;
    pageEls.current.forEach((node, idx) => {
      const rectTop = node.offsetTop;
      const dist = Math.abs(rectTop - top);
      if (dist < bestDist) {
        bestDist = dist;
        best = idx;
      }
    });
    setCurrent(best);
  }, [viewMode]);

  // 滚轮：单页/双页无纵向溢出时翻页；连续交给默认滚动
  const handleWheel = (e: React.WheelEvent<HTMLDivElement>) => {
    if (viewMode === 'continuous') return;
    const el = mainRef.current;
    if (el !== null && el.scrollHeight > el.clientHeight + 4) return; // 有纵向滚动则滚动
    wheelAccum.current += e.deltaY;
    if (Math.abs(wheelAccum.current) < 40) return;
    const dir = wheelAccum.current > 0 ? 1 : -1;
    wheelAccum.current = 0;
    goBy(dir);
  };

  const fitW = Math.max(200, container.width - 64);

  function targetFor(i: number): { width: number; height?: number } {
    if (viewMode === 'continuous') {
      const w = Math.round(fitW * (zoomPct / 100));
      return { width: w > 0 ? w : 400 };
    }
    const s = sizes[i];
    if (s === null || !sizesReady) return { width: Math.round(fitW) };
    const w = Math.round(s.width * effScale);
    const h = Math.round(s.height * effScale);
    return { width: w > 0 ? w : 1, height: h > 0 ? h : 1 };
  }

  return (
    <div className="flex h-full">
      {/* 左侧缩略图栏 */}
      <aside className="w-40 shrink-0 overflow-y-auto border-r border-neutral-300 bg-neutral-50">
        {pages.map((p, i) => (
          <LazyMount key={p.id}>
            <button
              type="button"
              ref={i === clamped ? activeRef : undefined}
              onClick={() => {
                if (viewMode === 'continuous') {
                  setCurrent(i);
                  scrollToPage(i);
                } else {
                  goTo(i);
                }
              }}
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

      {/* 右侧 */}
      <div className="flex min-w-0 flex-1 flex-col">
        {/* 工具栏：浏览模式 + 缩放 */}
        <div className="flex flex-wrap items-center gap-2 border-b border-neutral-300 bg-neutral-50 px-3 py-1.5 text-sm">
          <span className="tabular-nums text-neutral-600">
            {pages.length === 0 ? '—' : `${clamped + 1} / ${pages.length}`}
          </span>
          <span className="mx-1 h-4 w-px bg-neutral-300" />

          <div className="flex rounded border border-neutral-300 p-0.5">
            <ViewBtn active={viewMode === 'single'} onClick={() => setViewMode('single')}>单页</ViewBtn>
            <ViewBtn active={viewMode === 'spread'} onClick={() => setViewMode('spread')}>双页</ViewBtn>
            <ViewBtn active={viewMode === 'continuous'} onClick={() => setViewMode('continuous')}>连续</ViewBtn>
          </div>

          <span className="mx-1 h-4 w-px bg-neutral-300" />

          {viewMode !== 'continuous' && (
            <>
              <ZoomBtn active={zoomMode === 'fit-width'} onClick={() => setZoomMode('fit-width')}>页宽</ZoomBtn>
              <ZoomBtn active={zoomMode === 'fit-page'} onClick={() => setZoomMode('fit-page')}>整页</ZoomBtn>
              <ZoomBtn active={zoomMode === 'actual'} onClick={() => { setZoomMode('actual'); setZoomPct(100); }}>100%</ZoomBtn>
            </>
          )}
          <button type="button" className="px-2 py-0.5 hover:bg-neutral-200" onClick={() => changeZoom(-ZOOM_STEP)}>−</button>
          <button
            type="button"
            className="w-14 px-2 py-0.5 text-center tabular-nums hover:bg-neutral-200"
            onClick={() => setZoomMode('actual')}
            title="缩放百分比"
          >
            {Math.round(effScale * 100)}%
          </button>
          <button type="button" className="px-2 py-0.5 hover:bg-neutral-200" onClick={() => changeZoom(ZOOM_STEP)}>+</button>
        </div>

        <div
          ref={mainRef}
          onWheel={handleWheel}
          onScroll={handleScroll}
          className="flex-1 overflow-auto bg-neutral-300/60"
        >
          {pages.length === 0 ? (
            <div className="flex h-full items-center justify-center text-neutral-500">暂无页面</div>
          ) : viewMode === 'continuous' ? (
            <div className="flex flex-col items-center gap-4 py-6">
              {pages.map((p, i) => {
                const t = targetFor(i);
                return (
                  <div
                    key={p.id}
                    ref={(el) => {
                      if (el !== null) pageEls.current.set(i, el);
                      else pageEls.current.delete(i);
                    }}
                    className={i === clamped ? 'ring-2 ring-blue-400' : ''}
                  >
                    <LazyMount>
                      <div className="overflow-hidden rounded shadow" style={{ width: t.width }}>
                        <PageRenderer
                          sourceId={p.sourceId}
                          pageIndex={p.sourcePageIndex}
                          rotation={p.rotation}
                          targetWidth={t.width}
                          mode="full"
                        />
                      </div>
                    </LazyMount>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="flex min-h-full items-start justify-center py-6">
              <div className="flex gap-3">
                {displayPages.map((p, i) => {
                  const t = targetFor(i);
                  return (
                    <div key={p.id} className="overflow-hidden rounded shadow-lg" style={{ width: t.width }}>
                      <PageRenderer
                        sourceId={p.sourceId}
                        pageIndex={p.sourcePageIndex}
                        rotation={p.rotation}
                        targetWidth={t.width}
                        targetHeight={t.height}
                        mode="full"
                      />
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function ViewBtn({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded px-2 py-0.5 transition ${active ? 'bg-blue-600 text-white' : 'text-neutral-600 hover:bg-neutral-100'}`}
    >
      {children}
    </button>
  );
}

function ZoomBtn({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded px-2 py-0.5 transition ${active ? 'bg-blue-600 text-white' : 'text-neutral-600 hover:bg-neutral-100'}`}
    >
      {children}
    </button>
  );
}

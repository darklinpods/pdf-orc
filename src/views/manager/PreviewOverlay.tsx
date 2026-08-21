import type { PageRef } from '../../core/types';
import { PageRenderer } from '../../render/PageRenderer';

export function PreviewOverlay({
  page,
  index,
  total,
  onClose,
  onPrev,
  onNext,
}: {
  page: PageRef;
  index: number;
  total: number;
  onClose: () => void;
  onPrev: () => void;
  onNext: () => void;
}) {
  const width = Math.max(200, Math.round(window.innerWidth - 120));
  const height = Math.max(200, Math.round(window.innerHeight - 120));

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-black/70" onClick={onClose}>
      <div className="flex items-center justify-between px-4 py-2 text-sm text-white">
        <span className="tabular-nums">
          {index + 1} / {total}
        </span>
        <span className="text-xs text-white/70">← → 翻页 · 空格 / 点击空白关闭</span>
        <button type="button" className="rounded bg-white/20 px-3 py-1 hover:bg-white/30" onClick={onClose}>
          关闭
        </button>
      </div>
      <div
        className="flex flex-1 items-center justify-center overflow-hidden px-6 pb-6"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="overflow-hidden rounded shadow-2xl" style={{ width, height }} onClick={(e) => e.stopPropagation()}>
          <PageRenderer
            sourceId={page.sourceId}
            pageIndex={page.sourcePageIndex}
            rotation={page.rotation}
            targetWidth={width}
            targetHeight={height}
            mode="full"
            style={{ width: '100%', height: '100%', objectFit: 'contain' }}
          />
        </div>
      </div>
      <button
        type="button"
        className="absolute left-3 top-1/2 -translate-y-1/2 rounded-full bg-white/20 px-3 py-2 text-xl text-white hover:bg-white/30"
        onClick={(e) => {
          e.stopPropagation();
          onPrev();
        }}
        disabled={index === 0}
      >
        ‹
      </button>
      <button
        type="button"
        className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full bg-white/20 px-3 py-2 text-xl text-white hover:bg-white/30"
        onClick={(e) => {
          e.stopPropagation();
          onNext();
        }}
        disabled={index === total - 1}
      >
        ›
      </button>
    </div>
  );
}

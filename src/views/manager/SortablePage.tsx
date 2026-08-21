import { useSortable } from '@dnd-kit/sortable';
import type { PageRef } from '../../core/types';
import { groupColor } from '../../core/labels';
import { LazyMount } from '../../components/LazyMount';
import { PageRenderer } from '../../render/PageRenderer';

const THUMB = 170;

export function SortablePage({
  page,
  index,
  selected,
  disabled,
  dropBefore,
  dropAfter,
  dropPageNumber,
  onClick,
  onRotate,
  onDelete,
}: {
  page: PageRef;
  index: number;
  selected: boolean;
  disabled: boolean;
  dropBefore: boolean;
  dropAfter: boolean;
  dropPageNumber?: number;
  onClick: (e: { shiftKey: boolean; metaKey: boolean; ctrlKey: boolean }) => void;
  onRotate: (delta: 90 | -90) => void;
  onDelete: () => void;
}) {
  const { attributes, listeners, setNodeRef, isDragging } = useSortable({ id: page.id, disabled });

  return (
    <div
      ref={setNodeRef}
      {...attributes}
      {...listeners}
      onClick={onClick}
      className={`group relative cursor-grab rounded-none border bg-white p-1 shadow-sm transition ${
        selected ? 'border-blue-500 ring-2 ring-blue-500/60' : 'border-neutral-300 hover:border-neutral-400'
      } ${isDragging ? 'opacity-40' : ''}`}
    >
      {/* 拖拽落点指示：蓝色插入线 + 落定页码 */}
      {dropBefore && (
        <div className="pointer-events-none absolute inset-y-0 left-0 z-10 flex items-center">
          <div className="h-full w-1 rounded bg-blue-600" />
          {dropPageNumber !== undefined && (
            <div className="ml-1 rounded bg-blue-600 px-1.5 py-0.5 text-xs font-medium text-white shadow">
              第 {dropPageNumber} 页
            </div>
          )}
        </div>
      )}
      {dropAfter && (
        <div className="pointer-events-none absolute inset-y-0 right-0 z-10 flex items-center">
          <div className="h-full w-1 rounded bg-blue-600" />
        </div>
      )}
      <LazyMount className="flex h-44 items-center justify-center overflow-hidden">
        <PageRenderer
          sourceId={page.sourceId}
          pageIndex={page.sourcePageIndex}
          rotation={page.rotation}
          targetWidth={THUMB}
          targetHeight={THUMB}
          mode="thumbnail"
          style={{ width: 'auto', height: 'auto', maxWidth: '100%', maxHeight: '100%' }}
        />
      </LazyMount>

      {/* 页码与分组点 */}
      <div className="mt-1 flex items-center justify-between text-xs text-neutral-500">
        <span className="tabular-nums">{index}</span>
        {page.label !== null && (
          <span className="flex items-center gap-1 truncate">
            <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: groupColor(page.label) }} />
            <span className="truncate">{page.label}</span>
          </span>
        )}
      </div>

      {/* hover 操作 */}
      <div
        className="absolute right-1 top-1 hidden gap-1 group-hover:flex"
        onPointerDown={(e) => e.stopPropagation()}
        onClick={(e) => e.stopPropagation()}
      >
        <button type="button" title="左旋 90°" className="rounded bg-neutral-800/80 px-1.5 py-0.5 text-xs text-white hover:bg-neutral-900" onClick={() => onRotate(-90)}>⟲</button>
        <button type="button" title="右旋 90°" className="rounded bg-neutral-800/80 px-1.5 py-0.5 text-xs text-white hover:bg-neutral-900" onClick={() => onRotate(90)}>⟳</button>
        <button type="button" title="删除" className="rounded bg-red-600/90 px-1.5 py-0.5 text-xs text-white hover:bg-red-700" onClick={onDelete}>✕</button>
      </div>
    </div>
  );
}

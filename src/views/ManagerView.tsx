import { useMemo, useRef, useState } from 'react';
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragOverEvent,
  type DragStartEvent,
} from '@dnd-kit/core';
import { SortableContext, rectSortingStrategy, useSortable } from '@dnd-kit/sortable';
import type { Command } from '../core/commands';
import type { DocumentState, PageRef } from '../core/types';
import { collectGroups, groupColor, relabelPagesCommand } from '../core/labels';
import { computeDropPreview, computeReorderForDrop, sortedDraggedIds, type DropPreview } from '../core/dnd';
import type { CombineOptions } from '../combine/combinePages';
import type { CombineLayout } from '../combine/layout';
import { LazyMount } from '../components/LazyMount';
import { PageRenderer } from '../render/PageRenderer';

type Filter = 'all' | 'unlabeled' | string;

export interface ManagerViewProps {
  document: DocumentState;
  dispatch: (command: Command, mergeKey?: string | null) => void;
  combinePages: (pageIds: string[], options: CombineOptions) => Promise<void>;
  combining: boolean;
}

const THUMB = 170;

export function ManagerView({ document, dispatch, combinePages, combining }: ManagerViewProps) {
  const pages = document.pages;
  const groups = useMemo(() => collectGroups(pages), [pages]);
  const [selection, setSelection] = useState<Set<string>>(new Set());
  const [anchorId, setAnchorId] = useState<string | null>(null);
  const [filter, setFilter] = useState<Filter>('all');
  const [dragCount, setDragCount] = useState(0);
  const [dropPreview, setDropPreview] = useState<DropPreview | null>(null);
  const [combineOpen, setCombineOpen] = useState(false);
  const [combineLayout, setCombineLayout] = useState<CombineLayout>('vertical');
  const [combineRemove, setCombineRemove] = useState(true);
  const draggedRef = useRef<string[]>([]);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));

  const visiblePages = useMemo(() => {
    if (filter === 'all') return pages;
    if (filter === 'unlabeled') return pages.filter((p) => p.label === null);
    return pages.filter((p) => p.label === filter);
  }, [pages, filter]);

  const order = useMemo(() => pages.map((p) => p.id), [pages]);
  const visibleIds = useMemo(() => visiblePages.map((p) => p.id), [visiblePages]);

  const unlabeledCount = useMemo(() => pages.filter((p) => p.label === null).length, [pages]);

  function handleClick(page: PageRef, event: { shiftKey: boolean; metaKey: boolean; ctrlKey: boolean }) {
    if (event.shiftKey && anchorId !== null) {
      const a = pages.findIndex((p) => p.id === anchorId);
      const b = pages.findIndex((p) => p.id === page.id);
      if (a >= 0 && b >= 0) {
        const [lo, hi] = a < b ? [a, b] : [b, a];
        setSelection(new Set(pages.slice(lo, hi + 1).map((p) => p.id)));
        return;
      }
    }
    if (event.metaKey || event.ctrlKey) {
      setSelection((prev) => {
        const next = new Set(prev);
        if (next.has(page.id)) next.delete(page.id);
        else next.add(page.id);
        return next;
      });
      setAnchorId(page.id);
      return;
    }
    setSelection(new Set([page.id]));
    setAnchorId(page.id);
  }

  function onDragStart(e: DragStartEvent) {
    const activeId = String(e.active.id);
    const dragged = selection.has(activeId)
      ? sortedDraggedIds(order, [...selection])
      : [activeId];
    draggedRef.current = dragged;
    setDragCount(dragged.length);
    setDropPreview(null);
  }

  function onDragOver(e: DragOverEvent) {
    const overId = e.over === null ? null : String(e.over.id);
    const dragged = draggedRef.current;
    if (overId === null || dragged.length === 0) {
      setDropPreview(null);
      return;
    }
    setDropPreview(computeDropPreview(order, dragged, overId));
  }

  function onDragEnd(e: DragEndEvent) {
    const overId = e.over === null ? null : String(e.over.id);
    const dragged = draggedRef.current;
    draggedRef.current = [];
    setDragCount(0);
    setDropPreview(null);
    if (overId === null || dragged.length === 0) return;
    if (overId === String(e.active.id)) return;
    const command = computeReorderForDrop(order, dragged, overId);
    if (command !== null) dispatch(command);
  }

  function rotateSelected(delta: 90 | -90) {
    if (selection.size === 0) return;
    dispatch({ kind: 'rotate', pageIds: [...selection], delta }, 'rotate');
  }

  function deleteSelected() {
    if (selection.size === 0) return;
    if (!window.confirm(`删除选中的 ${selection.size} 页？（可撤销）`)) return;
    dispatch({ kind: 'delete', pageIds: [...selection] });
    setSelection(new Set());
  }

  function assignGroup(name: string | null) {
    if (selection.size === 0) return;
    const targets = pages.filter((p) => selection.has(p.id));
    dispatch(relabelPagesCommand(targets, name));
  }

  return (
    <div className="flex h-full">
      {/* 左侧分组面板 */}
      <aside className="flex w-44 shrink-0 flex-col border-r border-neutral-300 bg-neutral-50">
        <div className="border-b border-neutral-200 px-3 py-2 text-xs font-medium text-neutral-500">
          分组
        </div>
        <nav className="flex-1 overflow-y-auto p-2 text-sm">
          <FilterItem active={filter === 'all'} label="全部" count={pages.length} onClick={() => setFilter('all')} />
          <FilterItem active={filter === 'unlabeled'} label="未分组" count={unlabeledCount} onClick={() => setFilter('unlabeled')} />
          <div className="my-2 border-t border-neutral-200" />
          {groups.map((g) => (
            <FilterItem
              key={g.name}
              active={filter === g.name}
              label={g.name}
              count={g.count}
              color={g.color}
              onClick={() => setFilter(filter === g.name ? 'all' : g.name)}
            />
          ))}
          {groups.length === 0 && (
            <p className="px-2 py-1 text-xs text-neutral-400">选中页面后，在工具栏「分组到」创建分组。</p>
          )}
        </nav>
      </aside>

      {/* 右侧：工具栏 + 网格 */}
      <div className="flex min-w-0 flex-1 flex-col">
        <div className="flex items-center gap-2 border-b border-neutral-300 bg-white px-3 py-2 text-sm">
          <button
            type="button"
            className="rounded border border-neutral-300 px-2 py-1 hover:bg-neutral-100"
            onClick={() => setSelection(selection.size === pages.length ? new Set() : new Set(pages.map((p) => p.id)))}
          >
            {selection.size === pages.length && pages.length > 0 ? '取消全选' : '全选'}
          </button>
          <span className="mx-1 h-4 w-px bg-neutral-300" />
          <button type="button" className="rounded border border-neutral-300 px-2 py-1 hover:bg-neutral-100 disabled:opacity-40" disabled={selection.size === 0} onClick={() => rotateSelected(-90)}>
            ⟲ 左旋
          </button>
          <button type="button" className="rounded border border-neutral-300 px-2 py-1 hover:bg-neutral-100 disabled:opacity-40" disabled={selection.size === 0} onClick={() => rotateSelected(90)}>
            ⟳ 右旋
          </button>
          <button type="button" className="rounded border border-red-200 px-2 py-1 text-red-600 hover:bg-red-50 disabled:opacity-40" disabled={selection.size === 0} onClick={deleteSelected}>
            删除
          </button>
          <button
            type="button"
            className="rounded border border-neutral-300 px-2 py-1 hover:bg-neutral-100 disabled:opacity-40"
            disabled={selection.size !== 2 || combining}
            onClick={() => setCombineOpen(true)}
            title="把选中的 2 页拼合为 1 页"
          >
            {combining ? '拼合中…' : '拼合'}
          </button>
          <span className="mx-1 h-4 w-px bg-neutral-300" />
          <label className="flex items-center gap-1 text-neutral-600">
            分组到
            <select
              className="rounded border border-neutral-300 px-1 py-0.5 text-sm disabled:opacity-40"
              disabled={selection.size === 0}
              value=""
              onChange={(e) => {
                const v = e.target.value;
                if (v === '') return;
                if (v === '__new__') {
                  const name = window.prompt('新分组名称（如：事故认定书）');
                  if (name !== null && name.trim() !== '') assignGroup(name.trim());
                } else if (v === '__none__') {
                  assignGroup(null);
                } else {
                  assignGroup(v);
                }
                e.target.value = '';
              }}
            >
              <option value="" disabled>选择分组…</option>
              {groups.map((g) => (
                <option key={g.name} value={g.name}>{g.name}（{g.count}）</option>
              ))}
              <option value="__none__">取消分组</option>
              <option value="__new__">＋ 新建分组…</option>
            </select>
          </label>
          <span className="ml-auto text-xs tabular-nums text-neutral-500">
            已选 {selection.size} 页 · 共 {pages.length} 页
          </span>
        </div>

        <div className="flex-1 overflow-y-auto bg-neutral-200/60 p-4">
          {filter !== 'all' && (
            <p className="mb-3 text-xs text-neutral-500">当前为筛选视图，仅可查看与选择；拖动排序请在「全部」视图进行。</p>
          )}
          <DndContext
            sensors={sensors}
            onDragStart={onDragStart}
            onDragOver={onDragOver}
            onDragEnd={onDragEnd}
            onDragCancel={() => setDropPreview(null)}
          >
            <SortableContext items={visibleIds} strategy={rectSortingStrategy}>
              <div className="grid grid-cols-[repeat(auto-fill,minmax(150px,1fr))] gap-3">
                {visiblePages.map((page, i) => (
                  <SortablePage
                    key={page.id}
                    page={page}
                    index={pages.findIndex((p) => p.id === page.id) + 1}
                    selected={selection.has(page.id)}
                    disabled={filter !== 'all'}
                    dropBefore={dropPreview !== null && i === dropPreview.insertIndex}
                    dropAfter={
                      dropPreview !== null &&
                      dropPreview.insertIndex === visiblePages.length &&
                      i === visiblePages.length - 1
                    }
                    dropPageNumber={dropPreview?.finalPageNumber}
                    onClick={(e) => handleClick(page, e)}
                    onRotate={(delta) => dispatch({ kind: 'rotate', pageIds: [page.id], delta }, 'rotate')}
                    onDelete={() => {
                      if (window.confirm(`删除第 ${i + 1} 页？（可撤销）`)) {
                        dispatch({ kind: 'delete', pageIds: [page.id] });
                      }
                    }}
                  />
                ))}
              </div>
            </SortableContext>
            <DragOverlay>
              {dragCount > 0 ? (
                <div className="rounded-lg border border-blue-300 bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow-lg">
                  {dropPreview !== null ? `移动到第 ${dropPreview.finalPageNumber} 页` : `移动 ${dragCount} 页`}
                </div>
              ) : null}
            </DragOverlay>
          </DndContext>
          {pages.length === 0 && (
            <div className="flex h-40 items-center justify-center text-neutral-500">暂无页面</div>
          )}
        </div>
      </div>

      {combineOpen && (
        <CombineModal
          layout={combineLayout}
          removeOriginals={combineRemove}
          busy={combining}
          onLayoutChange={setCombineLayout}
          onRemoveChange={setCombineRemove}
          onSubmit={() => {
            void combinePages([...selection], { layout: combineLayout, removeOriginals: combineRemove });
            setCombineOpen(false);
            setSelection(new Set());
          }}
          onClose={() => setCombineOpen(false)}
        />
      )}
    </div>
  );
}

function FilterItem({
  active,
  label,
  count,
  color,
  onClick,
}: {
  active: boolean;
  label: string;
  count: number;
  color?: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex w-full items-center gap-2 rounded px-2 py-1.5 text-left hover:bg-neutral-200 ${
        active ? 'bg-blue-100 font-medium' : ''
      }`}
    >
      {color !== undefined && <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: color }} />}
      <span className="truncate">{label}</span>
      <span className="ml-auto text-xs tabular-nums text-neutral-400">{count}</span>
    </button>
  );
}

function SortablePage({
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

function CombineModal({
  layout,
  removeOriginals,
  busy,
  onLayoutChange,
  onRemoveChange,
  onSubmit,
  onClose,
}: {
  layout: CombineLayout;
  removeOriginals: boolean;
  busy: boolean;
  onLayoutChange: (v: CombineLayout) => void;
  onRemoveChange: (v: boolean) => void;
  onSubmit: () => void;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30" onClick={onClose}>
      <div className="w-[26rem] rounded-lg bg-white p-5 shadow-xl" onClick={(e) => e.stopPropagation()}>
        <h2 className="mb-2 text-base font-semibold text-neutral-800">拼合页面</h2>
        <p className="mb-4 text-xs text-neutral-500">
          把选中的 2 页拼合为 1 页（A4）。按文档顺序：第 1 页在上/左，第 2 页在下/右。
        </p>

        <div className="mb-4">
          <div className="mb-1 text-sm text-neutral-700">排版</div>
          <div className="flex gap-2">
            <label className="flex items-center gap-1 text-sm">
              <input
                type="radio"
                name="combine-layout"
                checked={layout === 'vertical'}
                onChange={() => onLayoutChange('vertical')}
              />
              上下排列
            </label>
            <label className="flex items-center gap-1 text-sm">
              <input
                type="radio"
                name="combine-layout"
                checked={layout === 'horizontal'}
                onChange={() => onLayoutChange('horizontal')}
              />
              左右排列
            </label>
          </div>
        </div>

        <label className="mb-4 flex items-start gap-2 text-sm">
          <input
            type="checkbox"
            className="mt-0.5"
            checked={removeOriginals}
            onChange={(e) => onRemoveChange(e.target.checked)}
          />
          <span>
            拼合后<b>删除</b>原两页（用合成页替换）
            <span className="block text-xs text-neutral-400">不勾选则保留原两页，另插入一张合成页</span>
          </span>
        </label>

        <div className="flex justify-end gap-2">
          <button
            type="button"
            className="rounded border border-neutral-300 px-3 py-1.5 text-sm hover:bg-neutral-100"
            onClick={onClose}
            disabled={busy}
          >
            取消
          </button>
          <button
            type="button"
            className="rounded bg-blue-600 px-4 py-1.5 text-sm text-white hover:bg-blue-700 disabled:opacity-50"
            onClick={onSubmit}
            disabled={busy}
          >
            {busy ? '拼合中…' : '拼合'}
          </button>
        </div>
      </div>
    </div>
  );
}

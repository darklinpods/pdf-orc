import { useEffect, useMemo, useRef, useState } from 'react';
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
import { SortableContext, rectSortingStrategy } from '@dnd-kit/sortable';
import type { Command } from '../../core/commands';
import type { DocumentState, PageRef } from '../../core/types';
import { clamp } from '../../core/util';
import { collectGroups, filterPages, relabelPagesCommand, type PageFilter } from '../../core/labels';
import { computeDropPreview, computeReorderForDrop, sortedDraggedIds, type DropPreview } from '../../core/dnd';
import type { CombineOptions } from '../../combine/combinePages';
import type { CombineLayout } from '../../combine/layout';
import { buildDirectory, type DirectoryItem } from '../../evidence/classify';
import { ocrDocument } from '../../evidence/ocr';
import { FilterItem } from './FilterItem';
import { SortablePage } from './SortablePage';
import { CombineModal } from './CombineModal';
import { InsertModal } from './InsertModal';
import { PreviewOverlay } from './PreviewOverlay';
import { DirectoryModal } from './DirectoryModal';

export interface ManagerViewProps {
  document: DocumentState;
  dispatch: (command: Command, mergeKey?: string | null) => void;
  combinePages: (pageIds: string[], options: CombineOptions) => Promise<void>;
  combining: boolean;
  insertBlankPages: (count: number, index: number) => Promise<void>;
  insertPdfAt: (name: string, buffer: ArrayBuffer, index: number) => Promise<void>;
  onExportSelected: (pageIds: string[]) => void;
  exporting: boolean;
  filter: PageFilter;
  onFilterChange: (filter: PageFilter) => void;
}

export function ManagerView({
  document,
  dispatch,
  combinePages,
  combining,
  insertBlankPages,
  insertPdfAt,
  onExportSelected,
  exporting,
  filter,
  onFilterChange,
}: ManagerViewProps) {
  const pages = document.pages;
  const groups = useMemo(() => collectGroups(pages), [pages]);
  const [selection, setSelection] = useState<Set<string>>(new Set());
  const [anchorId, setAnchorId] = useState<string | null>(null);
  const [dragCount, setDragCount] = useState(0);
  const [dropPreview, setDropPreview] = useState<DropPreview | null>(null);
  const [combineOpen, setCombineOpen] = useState(false);
  const [combineLayout, setCombineLayout] = useState<CombineLayout>('vertical');
  const [combineRemove, setCombineRemove] = useState(true);
  const [insertOpen, setInsertOpen] = useState(false);
  const [previewIndex, setPreviewIndex] = useState<number | null>(null);
  const [dirOpen, setDirOpen] = useState(false);
  const [dirBusy, setDirBusy] = useState(false);
  const [dirItems, setDirItems] = useState<DirectoryItem[]>([]);
  const [dirError, setDirError] = useState<string | null>(null);
  const draggedRef = useRef<string[]>([]);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));

  const visiblePages = useMemo(() => filterPages(pages, filter), [pages, filter]);

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

  async function generateDirectory() {
    if (pages.length === 0) return;
    setDirBusy(true);
    setDirError(null);
    try {
      const pageTexts = await ocrDocument(document);
      const texts = pages.map((p) => pageTexts.get(p.id) ?? '');
      setDirItems(buildDirectory(texts));
      setDirOpen(true);
    } catch (err) {
      setDirError(err instanceof Error ? err.message : '生成证据目录失败');
    } finally {
      setDirBusy(false);
    }
  }

  function applyDirectory(items: DirectoryItem[]) {
    const labels: Array<{ pageId: string; from: string | null; to: string | null }> = [];
    for (const item of items) {
      const name = item.name.trim();
      for (let p = item.start; p <= item.end; p++) {
        const page = pages[p - 1];
        if (page === undefined) continue;
        labels.push({ pageId: page.id, from: page.label, to: name === '' ? null : name });
      }
    }
    if (labels.length > 0) dispatch({ kind: 'relabel', labels });
    setDirOpen(false);
  }

  // 空格：选中页时打开/关闭大图预览；预览中左右键翻页。
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement | null)?.tagName;
      const typing = tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT';
      const modalOpen = combineOpen || insertOpen;

      if (e.key === ' ') {
        if (typing || modalOpen) return;
        e.preventDefault();
        if (previewIndex !== null) {
          setPreviewIndex(null);
          return;
        }
        if (selection.size > 0) {
          const idx = pages.findIndex((p) => selection.has(p.id));
          if (idx >= 0) setPreviewIndex(idx);
        }
      } else if (previewIndex !== null && (e.key === 'ArrowLeft' || e.key === 'ArrowRight')) {
        e.preventDefault();
        const delta = e.key === 'ArrowLeft' ? -1 : 1;
        setPreviewIndex((idx) => (idx === null ? idx : clamp(idx + delta, 0, pages.length - 1)));
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [previewIndex, selection, pages, combineOpen, insertOpen]);

  return (
    <div className="flex h-full">
      {/* 左侧分组面板 */}
      <aside className="flex w-44 shrink-0 flex-col border-r border-neutral-300 bg-neutral-50">
        <div className="border-b border-neutral-200 px-3 py-2 text-xs font-medium text-neutral-500">
          分组
        </div>
        <nav className="flex-1 overflow-y-auto p-2 text-sm">
          <FilterItem active={filter === 'all'} label="全部" count={pages.length} onClick={() => onFilterChange('all')} />
          <FilterItem active={filter === 'unlabeled'} label="未分组" count={unlabeledCount} onClick={() => onFilterChange('unlabeled')} />
          <div className="my-2 border-t border-neutral-200" />
          {groups.map((g) => (
            <FilterItem
              key={g.name}
              active={filter === g.name}
              label={g.name}
              count={g.count}
              color={g.color}
              onClick={() => onFilterChange(filter === g.name ? 'all' : g.name)}
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
            onClick={() =>
              setSelection(
                selection.size === visiblePages.length
                  ? new Set()
                  : new Set(visiblePages.map((p) => p.id)),
              )
            }
          >
            {selection.size === visiblePages.length && visiblePages.length > 0 ? '取消全选' : '全选'}
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
          <button
            type="button"
            className="rounded border border-neutral-300 px-2 py-1 hover:bg-neutral-100"
            onClick={() => setInsertOpen(true)}
            title="插入空白页或从其他 PDF 插入页面"
          >
            插入
          </button>
          <button
            type="button"
            className="rounded bg-green-600 px-2 py-1 text-white hover:bg-green-700 disabled:opacity-40"
            disabled={selection.size === 0 || exporting}
            onClick={() => onExportSelected(pages.filter((p) => selection.has(p.id)).map((p) => p.id))}
            title="把选中的页面导出为 PDF"
          >
            {exporting ? '导出中…' : `导出选中${selection.size > 0 ? `（${selection.size}）` : ''}`}
          </button>
          <button
            type="button"
            className="rounded border border-neutral-300 px-2 py-1 hover:bg-neutral-100 disabled:opacity-40"
            disabled={dirBusy}
            onClick={() => void generateDirectory()}
            title="OCR 全文并按证据类别自动生成目录，校对后给页面打标签"
          >
            {dirBusy ? '识别中…' : '生成证据目录'}
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

        {dirError !== null && (
          <div className="border-b border-red-200 bg-red-50 px-4 py-2 text-sm text-red-700">{dirError}</div>
        )}

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

      {insertOpen && (
        <InsertModal
          totalPages={pages.length}
          hasSelection={selection.size > 0}
          selectionIndex={
            selection.size > 0 ? Math.max(...[...selection].map((id) => pages.findIndex((p) => p.id === id))) : -1
          }
          onClose={() => setInsertOpen(false)}
          onInsertBlank={async (count, index) => {
            await insertBlankPages(count, index);
            setInsertOpen(false);
          }}
          onInsertPdf={async (file, index) => {
            const buffer = await file.arrayBuffer();
            await insertPdfAt(file.name, buffer, index);
            setInsertOpen(false);
          }}
        />
      )}

      {previewIndex !== null && pages[previewIndex] !== undefined && (
        <PreviewOverlay
          page={pages[previewIndex]}
          index={previewIndex}
          total={pages.length}
          onClose={() => setPreviewIndex(null)}
          onPrev={() => setPreviewIndex((i) => (i === null ? i : clamp(i - 1, 0, pages.length - 1)))}
          onNext={() => setPreviewIndex((i) => (i === null ? i : clamp(i + 1, 0, pages.length - 1)))}
        />
      )}

      {dirOpen && (
        <DirectoryModal
          initialItems={dirItems}
          pageCount={pages.length}
          onClose={() => setDirOpen(false)}
          onApply={applyDirectory}
        />
      )}
    </div>
  );
}

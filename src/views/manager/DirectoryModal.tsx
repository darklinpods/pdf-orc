import { useState } from 'react';
import type { DirectoryItem } from '../../evidence/classify';

export function DirectoryModal({
  initialItems,
  pageCount,
  onClose,
  onApply,
}: {
  initialItems: DirectoryItem[];
  pageCount: number;
  onClose: () => void;
  onApply: (items: DirectoryItem[]) => void;
}) {
  const [items, setItems] = useState<DirectoryItem[]>(initialItems.map((i) => ({ ...i })));
  const [error, setError] = useState<string | null>(null);

  function update(index: number, patch: Partial<DirectoryItem>) {
    setItems((prev) => prev.map((it, i) => (i === index ? { ...it, ...patch } : it)));
  }
  function remove(index: number) {
    setItems((prev) => prev.filter((_, i) => i !== index));
  }
  function add() {
    setItems((prev) => [...prev, { name: '', start: pageCount, end: pageCount }]);
  }

  function apply() {
    for (const it of items) {
      if (!Number.isInteger(it.start) || !Number.isInteger(it.end) || it.start < 1 || it.end > pageCount || it.start > it.end) {
        setError(`页码范围非法：「${it.name || '未命名'}」${it.start}-${it.end}（应在 1-${pageCount} 之间）`);
        return;
      }
    }
    onApply(items);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30" onClick={onClose}>
      <div className="flex max-h-[85vh] w-[34rem] flex-col rounded-lg bg-white shadow-xl" onClick={(e) => e.stopPropagation()}>
        <div className="border-b border-neutral-200 px-5 py-3">
          <h2 className="text-base font-semibold text-neutral-800">校对证据目录</h2>
          <p className="mt-0.5 text-xs text-neutral-500">
            自动生成的目录草案，可改名、改页码范围、增删项；确认后按目录给页面打标签。
          </p>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-3">
          <div className="mb-2 grid grid-cols-[1fr_3.5rem_3.5rem_2rem] gap-2 text-xs text-neutral-400">
            <span>证据项名称</span>
            <span className="text-right">起页</span>
            <span className="text-right">止页</span>
            <span />
          </div>
          {items.map((it, i) => (
            <div key={i} className="mb-2 grid grid-cols-[1fr_3.5rem_3.5rem_2rem] items-center gap-2">
              <input
                type="text"
                value={it.name}
                onChange={(e) => update(i, { name: e.target.value })}
                className="rounded border border-neutral-300 px-2 py-1 text-sm"
                placeholder="证据项名称"
              />
              <input
                type="number"
                min={1}
                max={pageCount}
                value={it.start}
                onChange={(e) => update(i, { start: Number(e.target.value) })}
                className="rounded border border-neutral-300 px-1 py-1 text-right text-sm"
              />
              <input
                type="number"
                min={1}
                max={pageCount}
                value={it.end}
                onChange={(e) => update(i, { end: Number(e.target.value) })}
                className="rounded border border-neutral-300 px-1 py-1 text-right text-sm"
              />
              <button
                type="button"
                className="rounded px-1 py-1 text-neutral-400 hover:bg-neutral-100 hover:text-red-600"
                onClick={() => remove(i)}
                title="删除此项"
              >
                ✕
              </button>
            </div>
          ))}
          <button type="button" className="mt-1 rounded border border-dashed border-neutral-300 px-3 py-1 text-sm text-neutral-500 hover:bg-neutral-50" onClick={add}>
            ＋ 添加一项
          </button>
          {error !== null && <p className="mt-2 text-sm text-red-600">{error}</p>}
        </div>

        <div className="flex justify-end gap-2 border-t border-neutral-200 px-5 py-3">
          <button type="button" className="rounded border border-neutral-300 px-3 py-1.5 text-sm hover:bg-neutral-100" onClick={onClose}>
            取消
          </button>
          <button type="button" className="rounded bg-blue-600 px-4 py-1.5 text-sm text-white hover:bg-blue-700" onClick={apply}>
            应用标签
          </button>
        </div>
      </div>
    </div>
  );
}

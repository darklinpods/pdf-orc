import { useState } from 'react';

type InsertPosition = 'start' | 'end' | 'after';

export function InsertModal({
  totalPages,
  hasSelection,
  selectionIndex,
  onClose,
  onInsertBlank,
  onInsertPdf,
}: {
  totalPages: number;
  hasSelection: boolean;
  selectionIndex: number;
  onClose: () => void;
  onInsertBlank: (count: number, index: number) => Promise<void>;
  onInsertPdf: (file: File, index: number) => Promise<void>;
}) {
  const [type, setType] = useState<'blank' | 'pdf'>('blank');
  const [count, setCount] = useState(1);
  const [position, setPosition] = useState<InsertPosition>(hasSelection ? 'after' : 'end');
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function resolveIndex(): number {
    if (position === 'start') return 0;
    if (position === 'end') return totalPages;
    return selectionIndex + 1;
  }

  async function submit() {
    setBusy(true);
    setError(null);
    try {
      const index = resolveIndex();
      if (type === 'blank') {
        const n = Math.max(1, Math.floor(count) || 1);
        await onInsertBlank(n, index);
      } else {
        if (file === null) {
          setError('请先选择要插入的 PDF 文件');
          return;
        }
        await onInsertPdf(file, index);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : '插入失败');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30" onClick={onClose}>
      <div className="w-[28rem] rounded-lg bg-white p-5 shadow-xl" onClick={(e) => e.stopPropagation()}>
        <h2 className="mb-3 text-base font-semibold text-neutral-800">插入页面</h2>

        <div className="mb-4">
          <div className="mb-1 text-sm text-neutral-700">插入内容</div>
          <div className="flex gap-4 text-sm">
            <label className="flex items-center gap-1">
              <input type="radio" name="insert-type" checked={type === 'blank'} onChange={() => setType('blank')} />
              空白页
            </label>
            <label className="flex items-center gap-1">
              <input type="radio" name="insert-type" checked={type === 'pdf'} onChange={() => setType('pdf')} />
              从 PDF 文件
            </label>
          </div>
        </div>

        {type === 'blank' ? (
          <label className="mb-4 flex items-center gap-2 text-sm">
            数量
            <input
              type="number"
              min={1}
              max={99}
              value={count}
              onChange={(e) => setCount(Number(e.target.value))}
              className="w-20 rounded border border-neutral-300 px-2 py-1 text-sm"
            />
          </label>
        ) : (
          <input
            type="file"
            accept="application/pdf"
            className="mb-4 block w-full text-sm"
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
          />
        )}

        <div className="mb-4">
          <div className="mb-1 text-sm text-neutral-700">插入位置</div>
          <div className="flex gap-4 text-sm">
            <label className="flex items-center gap-1">
              <input type="radio" name="insert-pos" checked={position === 'start'} onChange={() => setPosition('start')} />
              开头
            </label>
            <label className="flex items-center gap-1">
              <input type="radio" name="insert-pos" checked={position === 'end'} onChange={() => setPosition('end')} />
              末尾
            </label>
            <label className="flex items-center gap-1">
              <input
                type="radio"
                name="insert-pos"
                checked={position === 'after'}
                disabled={!hasSelection}
                onChange={() => setPosition('after')}
              />
              选中页之后{!hasSelection && <span className="text-xs text-neutral-400">（需先选中一页）</span>}
            </label>
          </div>
        </div>

        {error !== null && <p className="mb-3 text-sm text-red-600">{error}</p>}

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
            onClick={() => void submit()}
            disabled={busy}
          >
            {busy ? '插入中…' : '插入'}
          </button>
        </div>
      </div>
    </div>
  );
}

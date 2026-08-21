import type { CombineLayout } from '../../combine/layout';

export function CombineModal({
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

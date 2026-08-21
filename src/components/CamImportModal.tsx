export function CamImportModal({
  url,
  busy,
  error,
  onUrlChange,
  onSubmit,
  onClose,
}: {
  url: string;
  busy: boolean;
  error: string | null;
  onUrlChange: (v: string) => void;
  onSubmit: () => void;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30" onClick={onClose}>
      <div className="w-[28rem] rounded-lg bg-white p-5 shadow-xl" onClick={(e) => e.stopPropagation()}>
        <h2 className="mb-2 text-base font-semibold text-neutral-800">从扫描全能王导入</h2>
        <p className="mb-3 text-xs text-neutral-500">
          粘贴扫描全能王的分享链接（link.camscanner.com 或 camscanner.com/s/…），自动下载并导入全部页面。
        </p>
        <input
          autoFocus
          type="url"
          value={url}
          onChange={(e) => onUrlChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !busy) onSubmit();
          }}
          placeholder="https://link.camscanner.com/…"
          className="mb-3 w-full rounded border border-neutral-300 px-3 py-2 text-sm outline-none focus:border-blue-500"
        />
        {error !== null && <p className="mb-3 text-sm text-red-600">{error}</p>}
        <div className="flex items-center justify-end gap-2">
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
            disabled={busy || url.trim() === ''}
          >
            {busy ? '下载并导入中…' : '导入'}
          </button>
        </div>
      </div>
    </div>
  );
}

import type { ExportProgress } from '../export/exporter';

export function ExportOverlay({ progress }: { progress: ExportProgress | null }) {
  const total = progress?.total ?? 0;
  const percent = total > 0 ? Math.round(((progress?.done ?? 0) / total) * 100) : 0;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30">
      <div className="w-80 rounded-lg bg-white p-5 shadow-xl">
        <p className="mb-3 text-sm font-medium text-neutral-700">正在导出 PDF…</p>
        <div className="h-2 w-full overflow-hidden rounded bg-neutral-200">
          <div className="h-full bg-green-600 transition-all" style={{ width: `${percent}%` }} />
        </div>
        <p className="mt-2 text-xs tabular-nums text-neutral-500">
          {total > 0 ? `已复制 ${progress?.done ?? 0}/${total} 页` : '正在读取源文件…'}
        </p>
      </div>
    </div>
  );
}

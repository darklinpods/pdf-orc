import { useRef, useState } from 'react';
import { useDocumentStore } from './store/useDocumentStore';
import { exportDocument, type ExportProgress } from './export/exporter';
import { ReaderView } from './views/ReaderView';
import { ManagerView } from './views/ManagerView';

type Mode = 'reader' | 'manager';

const BRIDGE_URL = 'http://127.0.0.1:8787';

/** 把 ISO UTC 时间戳格式化为本地时间（精确到秒）。 */
function formatTimestamp(iso: string): string {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

export default function App() {
  const store = useDocumentStore();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [mode, setMode] = useState<Mode>('manager');
  const [exporting, setExporting] = useState(false);
  const [exportProgress, setExportProgress] = useState<ExportProgress | null>(null);
  const [exportError, setExportError] = useState<string | null>(null);
  const [exported, setExported] = useState(false);
  const [camOpen, setCamOpen] = useState(false);
  const [camUrl, setCamUrl] = useState('');
  const [camBusy, setCamBusy] = useState(false);
  const [camError, setCamError] = useState<string | null>(null);
  const pageCount = store.document.pages.length;

  const onPickFiles = (files: FileList | null) => {
    if (files === null || files.length === 0) return;
    void store.importFiles(Array.from(files));
  };

  const importFromCamScanner = async () => {
    const url = camUrl.trim();
    if (url === '') return;
    setCamBusy(true);
    setCamError(null);
    try {
      const res = await fetch(`${BRIDGE_URL}/import`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url }),
      });
      if (!res.ok) {
        let message = `桥接服务返回 HTTP ${res.status}`;
        try {
          const data = (await res.json()) as { error?: string };
          if (data.error) message = data.error;
        } catch {
          /* 非 JSON 响应，保留默认消息 */
        }
        throw new Error(message);
      }
      const filename = decodeURIComponent(res.headers.get('X-Pdf-Filename') || '扫描全能王-分享.pdf');
      const buffer = await res.arrayBuffer();
      await store.importPdf(filename, buffer);
      setCamOpen(false);
      setCamUrl('');
    } catch (err) {
      if (err instanceof TypeError) {
        setCamError('无法连接桥接服务，请先在项目目录运行「npm run bridge」');
      } else {
        setCamError(err instanceof Error ? err.message : '导入失败');
      }
    } finally {
      setCamBusy(false);
    }
  };

  const onExport = async () => {
    setExporting(true);
    setExportError(null);
    setExported(false);
    setExportProgress({ done: 0, total: pageCount });
    try {
      await exportDocument(store.document, setExportProgress);
      setExported(true);
      window.setTimeout(() => setExported(false), 3000);
    } catch (err) {
      setExportError(err instanceof Error ? err.message : '导出失败');
    } finally {
      setExporting(false);
      setExportProgress(null);
    }
  };

  return (
    <main className="flex h-full flex-col bg-neutral-100 text-neutral-800">
      <header className="flex items-center gap-3 border-b border-neutral-300 bg-white px-4 py-2">
        <h1 className="text-lg font-semibold">pdf-orc</h1>
        <span className="text-sm text-neutral-400">PDF 案卷整理</span>
        <span className="text-xs tabular-nums text-neutral-400" title="版本时间戳（dev server 启动 / 构建时间）">
          v0.1 · {formatTimestamp(__BUILD_TIME__)}
        </span>

        {/* 视图切换 */}
        <nav className="ml-4 flex rounded-lg border border-neutral-300 p-0.5">
          <ModeButton active={mode === 'manager'} onClick={() => setMode('manager')}>
            页面管理
          </ModeButton>
          <ModeButton active={mode === 'reader'} onClick={() => setMode('reader')}>
            阅读
          </ModeButton>
        </nav>

        <div className="ml-auto flex items-center gap-2">
          <span className="text-sm tabular-nums text-neutral-500">
            {pageCount > 0 ? `${pageCount} 页` : '未导入'}
          </span>
          <button
            type="button"
            className="rounded border border-neutral-300 px-3 py-1 text-sm hover:bg-neutral-100 disabled:opacity-40"
            onClick={store.undo}
            disabled={!store.canUndo}
          >
            撤销
          </button>
          <button
            type="button"
            className="rounded border border-neutral-300 px-3 py-1 text-sm hover:bg-neutral-100 disabled:opacity-40"
            onClick={store.redo}
            disabled={!store.canRedo}
          >
            重做
          </button>
          <button
            type="button"
            className="rounded bg-blue-600 px-3 py-1 text-sm text-white hover:bg-blue-700 disabled:opacity-50"
            onClick={() => fileInputRef.current?.click()}
            disabled={store.importing}
          >
            {store.importing ? '导入中…' : '导入 PDF'}
          </button>
          <button
            type="button"
            className="rounded border border-blue-300 px-3 py-1 text-sm text-blue-600 hover:bg-blue-50 disabled:opacity-50"
            onClick={() => setCamOpen(true)}
            disabled={store.importing}
            title="从扫描全能王分享链接导入"
          >
            扫描全能王
          </button>
          <button
            type="button"
            className="rounded bg-green-600 px-3 py-1 text-sm text-white hover:bg-green-700 disabled:opacity-50"
            onClick={() => void onExport()}
            disabled={pageCount === 0 || exporting}
          >
            {exporting ? '导出中…' : '导出'}
          </button>
        </div>
      </header>

      {store.importError !== null && (
        <div className="border-b border-red-200 bg-red-50 px-4 py-2 text-sm text-red-700">
          {store.importError}
        </div>
      )}

      {exportError !== null && (
        <div className="border-b border-red-200 bg-red-50 px-4 py-2 text-sm text-red-700">
          {exportError}
        </div>
      )}

      {exported && (
        <div className="border-b border-green-200 bg-green-50 px-4 py-2 text-sm text-green-700">
          已导出 PDF，请在浏览器下载中查看。
        </div>
      )}

      {exporting && <ExportOverlay progress={exportProgress} />}

      {camOpen && (
        <CamImportModal
          url={camUrl}
          busy={camBusy || store.importing}
          error={camError}
          onUrlChange={setCamUrl}
          onSubmit={() => void importFromCamScanner()}
          onClose={() => {
            if (!camBusy) setCamOpen(false);
          }}
        />
      )}

      <input
        ref={fileInputRef}
        type="file"
        accept="application/pdf"
        multiple
        className="hidden"
        onChange={(e) => {
          onPickFiles(e.target.files);
          e.target.value = '';
        }}
      />

      <div className="min-h-0 flex-1">
        {pageCount === 0 ? (
          <div className="flex h-full flex-col items-center justify-center gap-4 text-neutral-500">
            <p className="text-lg">导入一份或多份 PDF 开始整理案卷</p>
            <p className="text-sm text-neutral-400">
              支持多源合并 · 页面管理（排序/旋转/删除/分组）· 阅读 · 导出
            </p>
            <button
              type="button"
              className="rounded bg-blue-600 px-5 py-2 text-white hover:bg-blue-700"
              onClick={() => fileInputRef.current?.click()}
            >
              选择 PDF 文件
            </button>
          </div>
        ) : mode === 'reader' ? (
          <ReaderView document={store.document} />
        ) : (
          <ManagerView
            document={store.document}
            dispatch={store.dispatch}
            combinePages={store.combinePages}
            combining={store.combining}
          />
        )}
      </div>
    </main>
  );
}

function ModeButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-md px-3 py-1 text-sm transition ${
        active ? 'bg-blue-600 text-white' : 'text-neutral-600 hover:bg-neutral-100'
      }`}
    >
      {children}
    </button>
  );
}

function ExportOverlay({ progress }: { progress: ExportProgress | null }) {
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

function CamImportModal({
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

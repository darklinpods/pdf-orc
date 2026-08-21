import { useRef, useState } from 'react';
import { useDocumentStore } from './store/useDocumentStore';
import { exportDocument, type ExportProgress } from './export/exporter';
import { sanitizeFilename } from './export/plan';
import { filterPages, type PageFilter } from './core/labels';
import { useCamImport } from './hooks/useCamImport';
import { ExportOverlay } from './components/ExportOverlay';
import { CamImportModal } from './components/CamImportModal';
import { ReaderView } from './views/ReaderView';
import { ManagerView } from './views/manager/ManagerView';

type Mode = 'reader' | 'manager';

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
  const [filter, setFilter] = useState<PageFilter>('all');
  const [exporting, setExporting] = useState(false);
  const [exportProgress, setExportProgress] = useState<ExportProgress | null>(null);
  const [exportError, setExportError] = useState<string | null>(null);
  const [exported, setExported] = useState(false);
  const cam = useCamImport(store.importPdf);
  const pageCount = store.document.pages.length;

  // 导出范围：页面管理视图按当前筛选（分组/未分组）导出，阅读视图导出全部。
  const exportPages = mode === 'manager' ? filterPages(store.document.pages, filter) : store.document.pages;
  const exportCount = exportPages.length;
  const exportLabel =
    mode === 'manager' && filter !== 'all'
      ? filter === 'unlabeled'
        ? '导出未分组'
        : `导出「${filter}」`
      : '导出';

  const onPickFiles = (files: FileList | null) => {
    if (files === null || files.length === 0) return;
    void store.importFiles(Array.from(files));
  };

  const doExport = async (pageIds: string[], filename?: string) => {
    if (pageIds.length === 0) return;
    setExporting(true);
    setExportError(null);
    setExported(false);
    setExportProgress({ done: 0, total: pageIds.length });
    try {
      await exportDocument(store.document, {
        onProgress: setExportProgress,
        pageIds,
        filename,
      });
      setExported(true);
      window.setTimeout(() => setExported(false), 3000);
    } catch (err) {
      setExportError(err instanceof Error ? err.message : '导出失败');
    } finally {
      setExporting(false);
      setExportProgress(null);
    }
  };

  const onExport = () => {
    const pageIds = exportPages.map((p) => p.id);
    const filename =
      mode === 'manager' && filter !== 'all'
        ? filter === 'unlabeled'
          ? '未分组-整理.pdf'
          : `${sanitizeFilename(filter)}-整理.pdf`
        : undefined;
    void doExport(pageIds, filename);
  };

  const onExportSelected = (pageIds: string[]) => {
    void doExport(pageIds, '选中页面-整理.pdf');
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
            onClick={cam.openCam}
            disabled={store.importing}
            title="从扫描全能王分享链接导入"
          >
            扫描全能王
          </button>
          <button
            type="button"
            className="rounded bg-green-600 px-3 py-1 text-sm text-white hover:bg-green-700 disabled:opacity-50"
            onClick={onExport}
            disabled={exportCount === 0 || exporting}
            title={exportCount < pageCount ? `导出当前筛选的 ${exportCount} 页` : undefined}
          >
            {exporting ? '导出中…' : exportLabel}
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

      {cam.camOpen && (
        <CamImportModal
          url={cam.camUrl}
          busy={cam.camBusy || store.importing}
          error={cam.camError}
          onUrlChange={cam.setCamUrl}
          onSubmit={() => void cam.importFromCamScanner()}
          onClose={cam.closeCam}
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
            insertBlankPages={store.insertBlankPages}
            insertPdfAt={store.insertPdfAt}
            onExportSelected={onExportSelected}
            exporting={exporting}
            filter={filter}
            onFilterChange={setFilter}
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

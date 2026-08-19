import { useRef } from 'react';
import { useDocumentStore } from './store/useDocumentStore';
import { ReaderView } from './views/ReaderView';

export default function App() {
  const store = useDocumentStore();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const pageCount = store.document.pages.length;

  const onPickFiles = (files: FileList | null) => {
    if (files === null || files.length === 0) return;
    void store.importFiles(Array.from(files));
  };

  return (
    <main className="flex h-full flex-col bg-neutral-100 text-neutral-800">
      <header className="flex items-center gap-3 border-b border-neutral-300 bg-white px-4 py-2">
        <h1 className="text-lg font-semibold">pdf-orc</h1>
        <span className="text-sm text-neutral-400">PDF 案卷整理</span>
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
        </div>
      </header>

      {store.importError !== null && (
        <div className="border-b border-red-200 bg-red-50 px-4 py-2 text-sm text-red-700">
          {store.importError}
        </div>
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
              支持多源合并 · 拖动排序 · 旋转 / 删除 / 插入 · 导出
            </p>
            <button
              type="button"
              className="rounded bg-blue-600 px-5 py-2 text-white hover:bg-blue-700"
              onClick={() => fileInputRef.current?.click()}
            >
              选择 PDF 文件
            </button>
          </div>
        ) : (
          <ReaderView document={store.document} />
        )}
      </div>
    </main>
  );
}

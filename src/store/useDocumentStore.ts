import { useCallback, useState } from 'react';
import { emptyDocument, type DocumentState } from '../core/types';
import type { Command } from '../core/commands';
import { createHistory, dispatch, redo, undo } from '../core/history';
import { importCommand } from '../core/sources';
import { pdfSourceManager } from '../render/pdfjs';

let sourceSeq = 0;
function nextSourceId(name: string): string {
  sourceSeq += 1;
  const safe = name.replace(/[^a-zA-Z0-9\u4e00-\u9fa5_-]/g, '_').slice(0, 40);
  return `src-${sourceSeq}-${safe}`;
}

export interface DocumentStore {
  document: DocumentState;
  canUndo: boolean;
  canRedo: boolean;
  importing: boolean;
  importError: string | null;
  dispatch: (command: Command, mergeKey?: string | null) => void;
  undo: () => void;
  redo: () => void;
  importFiles: (files: File[]) => Promise<void>;
  /** 从内存字节导入一份 PDF（如桥接服务下载的分享文档）。 */
  importPdf: (name: string, buffer: ArrayBuffer) => Promise<void>;
}

/**
 * 文档状态接线：把纯逻辑核心（DocumentState + History）与渲染边界（pdfSourceManager）
 * 组装成一个 React store。文档状态与历史同生共变，故合并为一个 useState 对象。
 */
export function useDocumentStore(): DocumentStore {
  const [store, setStore] = useState(() => ({
    document: emptyDocument(),
    history: createHistory(),
  }));
  const [importing, setImporting] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);

  const dispatchCmd = useCallback((command: Command, mergeKey: string | null = null) => {
    setStore((s) => {
      const next = dispatch(s.document, s.history, command, mergeKey);
      return { document: next.state, history: next.history };
    });
  }, []);

  const undoFn = useCallback(() => {
    setStore((s) => {
      const next = undo(s.document, s.history);
      return { document: next.state, history: next.history };
    });
  }, []);

  const redoFn = useCallback(() => {
    setStore((s) => {
      const next = redo(s.document, s.history);
      return { document: next.state, history: next.history };
    });
  }, []);

  const importFiles = useCallback(async (files: File[]) => {
    setImporting(true);
    setImportError(null);
    for (const file of files) {
      try {
        const buffer = await file.arrayBuffer();
        await importOne(file.name, buffer);
      } catch (err) {
        setImportError(err instanceof Error ? `${file.name}：${err.message}` : `${file.name}：导入失败`);
      }
    }
    setImporting(false);
  }, []);

  const importOne = useCallback(async (name: string, buffer: ArrayBuffer) => {
    const sourceId = nextSourceId(name);
    // 打开源（pdf.js 解析），拿到实际页数。
    const handle = await pdfSourceManager.open(sourceId, name, buffer);
    setStore((s) => {
      const command = importCommand(sourceId, name, handle.pageCount, s.document.nextPageId);
      const next = dispatch(s.document, s.history, command);
      return { document: next.state, history: next.history };
    });
  }, []);

  const importPdf = useCallback(
    async (name: string, buffer: ArrayBuffer) => {
      setImporting(true);
      setImportError(null);
      try {
        await importOne(name, buffer);
      } catch (err) {
        setImportError(err instanceof Error ? err.message : `${name}：导入失败`);
      } finally {
        setImporting(false);
      }
    },
    [importOne],
  );

  return {
    document: store.document,
    canUndo: store.history.past.length > 0,
    canRedo: store.history.future.length > 0,
    importing,
    importError,
    dispatch: dispatchCmd,
    undo: undoFn,
    redo: redoFn,
    importFiles,
    importPdf,
  };
}

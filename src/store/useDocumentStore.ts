import { useCallback, useRef, useState } from 'react';
import { emptyDocument, type DocumentState, type PageRef, type SourceRef } from '../core/types';
import type { Command } from '../core/commands';
import { createHistory, dispatch, redo, undo } from '../core/history';
import { buildImportPayload, importCommand } from '../core/sources';
import { pdfSourceManager } from '../render/pdfjs';
import { renderPageToCanvas } from '../render/renderPage';
import {
  canvasToSinglePagePdf,
  compositeCanvases,
  type CombineOptions,
} from '../combine/combinePages';
import { blankA4PdfBytes } from '../combine/blank';

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
  combining: boolean;
  importError: string | null;
  dispatch: (command: Command, mergeKey?: string | null) => void;
  undo: () => void;
  redo: () => void;
  importFiles: (files: File[]) => Promise<void>;
  /** 从内存字节导入一份 PDF（如桥接服务下载的分享文档）。 */
  importPdf: (name: string, buffer: ArrayBuffer) => Promise<void>;
  /** 把两页拼合为一页（是否删原页由 options.removeOriginals 决定）。 */
  combinePages: (pageIds: string[], options: CombineOptions) => Promise<void>;
  /** 在指定位置插入若干空白页。 */
  insertBlankPages: (count: number, index: number) => Promise<void>;
  /** 把一份 PDF 的全部页面插入到指定位置。 */
  insertPdfAt: (name: string, buffer: ArrayBuffer, index: number) => Promise<void>;
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
  const [combining, setCombining] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);
  const docRef = useRef(store.document);
  docRef.current = store.document;
  const combineSeq = useRef(0);
  const blankSeq = useRef(0);
  const blankSourceRef = useRef<SourceRef | null>(null);

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

  const importFiles = useCallback(
    async (files: File[]) => {
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
    },
    [importOne],
  );

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

  const combinePages = useCallback(
    async (pageIds: string[], options: CombineOptions) => {
      const doc = docRef.current;
      const targets = doc.pages.filter((p) => pageIds.includes(p.id));
      if (targets.length !== 2) {
        setImportError('拼合需要恰好选中 2 页');
        return;
      }
      setCombining(true);
      setImportError(null);
      try {
        // 1. 渲染两页为 canvas（按文档顺序：前页在上/左）
        const canvases = await Promise.all(
          targets.map((p) =>
            renderPageToCanvas({
              sourceId: p.sourceId,
              pageIndex: p.sourcePageIndex,
              rotation: p.rotation,
              targetWidth: 1500,
            }).then((r) => r.canvas),
          ),
        );
        // 2. 拼合 + 生成单页 PDF
        const combined = compositeCanvases(canvases, options.layout);
        const bytes = await canvasToSinglePagePdf(combined);
        // 3. 注册合成源
        combineSeq.current += 1;
        const seq = combineSeq.current;
        const sourceId = `comb-src-${seq}`;
        const pageId = `comb-${seq}`;
        const name = `拼合-${seq}`;
        const ab = new ArrayBuffer(bytes.byteLength);
        new Uint8Array(ab).set(bytes);
        await pdfSourceManager.open(sourceId, name, ab);
        // 4. 组装命令
        const combinedPage: PageRef = {
          id: pageId,
          sourceId,
          sourcePageIndex: 0,
          rotation: 0,
          label: targets[0].label,
        };
        const insert: Command = {
          kind: 'insert',
          pages: [combinedPage],
          index: 0,
          sources: [{ id: sourceId, name, pageCount: 1 }],
        };
        if (options.removeOriginals) {
          const firstIndex = Math.min(...targets.map((p) => doc.pages.findIndex((x) => x.id === p.id)));
          dispatchCmd({
            kind: 'composite',
            steps: [{ kind: 'delete', pageIds }, { ...insert, index: firstIndex }],
          });
        } else {
          const lastIndex = Math.max(...targets.map((p) => doc.pages.findIndex((x) => x.id === p.id)));
          dispatchCmd({ ...insert, index: lastIndex + 1 });
        }
      } catch (err) {
        setImportError(err instanceof Error ? err.message : '拼合失败');
      } finally {
        setCombining(false);
      }
    },
    [dispatchCmd],
  );

  const ensureBlankSource = useCallback(async (): Promise<SourceRef> => {
    if (blankSourceRef.current !== null) return blankSourceRef.current;
    const bytes = await blankA4PdfBytes();
    const sourceId = 'blank-src';
    const ab = new ArrayBuffer(bytes.byteLength);
    new Uint8Array(ab).set(bytes);
    await pdfSourceManager.open(sourceId, '空白页', ab);
    blankSourceRef.current = { id: sourceId, name: '空白页', pageCount: 1 };
    return blankSourceRef.current;
  }, []);

  const insertBlankPages = useCallback(
    async (count: number, index: number) => {
      if (!Number.isInteger(count) || count <= 0) return;
      const src = await ensureBlankSource();
      const pages: PageRef[] = Array.from({ length: count }, () => {
        blankSeq.current += 1;
        return {
          id: `blank-${blankSeq.current}`,
          sourceId: src.id,
          sourcePageIndex: 0,
          rotation: 0,
          label: null,
        };
      });
      setStore((s) => {
        const next = dispatch(s.document, s.history, {
          kind: 'insert',
          pages,
          index,
          sources: [src],
        });
        return { document: next.state, history: next.history };
      });
    },
    [ensureBlankSource],
  );

  const insertPdfAt = useCallback(async (name: string, buffer: ArrayBuffer, index: number) => {
    const sourceId = nextSourceId(name);
    const handle = await pdfSourceManager.open(sourceId, name, buffer);
    setStore((s) => {
      const { sources, pages } = buildImportPayload(sourceId, name, handle.pageCount, s.document.nextPageId);
      const next = dispatch(s.document, s.history, { kind: 'insert', pages, index, sources });
      return { document: next.state, history: next.history };
    });
  }, []);

  return {
    document: store.document,
    canUndo: store.history.past.length > 0,
    canRedo: store.history.future.length > 0,
    importing,
    combining,
    importError,
    dispatch: dispatchCmd,
    undo: undoFn,
    redo: redoFn,
    importFiles,
    importPdf,
    combinePages,
    insertBlankPages,
    insertPdfAt,
  };
}

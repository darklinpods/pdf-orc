import type { DocumentState } from './types';
import type { Command, RotateCommand, RotateDelta } from './commands';
import { apply } from './commands';

/** 历史栈条目：forward 用于重做，inverse 用于撤销；mergeKey 标记可合并手势。 */
export interface HistoryEntry {
  forward: Command;
  inverse: Command;
  mergeKey: string | null;
}

export interface History {
  past: HistoryEntry[];
  future: HistoryEntry[];
  limit: number;
}

export function createHistory(limit = 100): History {
  return { past: [], future: [], limit };
}

export function canUndo(history: History): boolean {
  return history.past.length > 0;
}

export function canRedo(history: History): boolean {
  return history.future.length > 0;
}

function samePageIds(a: string[], b: string[]): boolean {
  if (a.length !== b.length) return false;
  const sa = [...a].sort();
  const sb = [...b].sort();
  return sa.every((v, i) => v === sb[i]);
}

/** 将增量归一到规范值（90 / -90 / 180）；净效果为 0 时返回 null（不合并）。 */
function canonicalDelta(delta: number): RotateDelta | null {
  const m = ((delta % 360) + 360) % 360;
  if (m === 0) return null;
  if (m === 90) return 90;
  if (m === 180) return 180;
  if (m === 270) return -90;
  return null;
}

function tryMerge(top: HistoryEntry, command: Command): HistoryEntry | null {
  if (top.forward.kind !== 'rotate' || command.kind !== 'rotate') return null;
  const a = top.forward as RotateCommand;
  const b = command as RotateCommand;
  if (!samePageIds(a.pageIds, b.pageIds)) return null;
  const delta = canonicalDelta(a.delta + b.delta);
  if (delta === null) return null; // 净效果为 0，不合并
  const forward: RotateCommand = { kind: 'rotate', pageIds: a.pageIds, delta };
  const inverse: RotateCommand = {
    kind: 'rotate',
    pageIds: a.pageIds,
    delta: delta === 180 ? 180 : delta === 90 ? -90 : 90,
  };
  return { forward, inverse, mergeKey: top.mergeKey };
}

export interface DispatchResult {
  state: DocumentState;
  history: History;
}

/**
 * 应用命令并压入历史。
 * @param mergeKey 非空时允许与栈顶「同类且同目标」的命令合并（如连续旋转手势）。
 */
export function dispatch(
  state: DocumentState,
  history: History,
  command: Command,
  mergeKey: string | null = null,
): DispatchResult {
  const { state: next, inverse } = apply(state, command);
  let past = history.past;
  const top = past[past.length - 1];
  if (mergeKey !== null && top !== undefined && top.mergeKey === mergeKey) {
    const merged = tryMerge(top, command);
    if (merged !== null) {
      past = [...past.slice(0, -1), merged];
      return { state: next, history: { past, future: [], limit: history.limit } };
    }
  }
  past = [...past, { forward: command, inverse, mergeKey }];
  if (past.length > history.limit) {
    past = past.slice(past.length - history.limit);
  }
  return { state: next, history: { past, future: [], limit: history.limit } };
}

export function undo(state: DocumentState, history: History): DispatchResult {
  const entry = history.past[history.past.length - 1];
  if (entry === undefined) return { state, history };
  const { state: next } = apply(state, entry.inverse);
  return {
    state: next,
    history: {
      past: history.past.slice(0, -1),
      future: [...history.future, entry],
      limit: history.limit,
    },
  };
}

export function redo(state: DocumentState, history: History): DispatchResult {
  const entry = history.future[history.future.length - 1];
  if (entry === undefined) return { state, history };
  const { state: next } = apply(state, entry.forward);
  return {
    state: next,
    history: {
      past: [...history.past, entry],
      future: history.future.slice(0, -1),
      limit: history.limit,
    },
  };
}

import type { DocumentState, PageRef, Rotation, SourceRef } from './types';
import { clamp } from './util';

/** 旋转增量：右旋 90°、左旋 90°、180°。 */
export type RotateDelta = 90 | -90 | 180;

/** 所有命令的联合类型。命令是纯数据、可序列化。 */
export type Command =
  | ReorderCommand
  | RotateCommand
  | DeleteCommand
  | InsertCommand
  | MergeSourcesCommand
  | RelabelCommand
  | SetOrderCommand
  | CompositeCommand;

/**
 * 复合命令：顺序执行若干子命令，作为一个整体（一次撤销）。
 * 逆操作 = 各子命令逆操作按相反顺序组成的 composite。
 * 用于「拼合」（删原页 + 插入合成页）等多步原子操作。
 */
export interface CompositeCommand {
  kind: 'composite';
  steps: Command[];
}

/**
 * 将若干页移动到目标位置。
 * - from：被移动页在「移动前列表」中的下标，升序、去重、越界即抛错；
 * - to：插入位置，指「移除 from 之后列表」中的下标，越界时收敛到 [0, len]。
 *
 * 语义：取出 from 指向的页（保持相对顺序）作为一块，插入到移除后的 to 位置。
 * 逆操作由 apply 生成：setOrder（精确还原整序），因为分散的 from 无法用单个 reorder 还原。
 */
export interface ReorderCommand {
  kind: 'reorder';
  from: number[];
  to: number;
}

/**
 * 内部命令：按 id 列表精确重建页序（order 必须是当前页 id 的一个排列）。
 * 仅作为 reorder 的逆操作与未来恢复能力的载体，UI 不应直接派发。
 */
export interface SetOrderCommand {
  kind: 'setOrder';
  order: string[];
}

/** 将若干页旋转指定增量。逆操作：负增量。 */
export interface RotateCommand {
  kind: 'rotate';
  pageIds: string[];
  delta: RotateDelta;
}

/**
 * 删除若干页。
 * 逆操作（apply 时计算）：insert 回被删页与位置；若因此产生孤儿源（无页引用），一并移除，
 * 逆操作会携带这些源以便恢复。
 */
export interface DeleteCommand {
  kind: 'delete';
  pageIds: string[];
}

/**
 * 在指定位置插入若干页（可来自其他源或空白页）。
 * sources：插入页所需但当前已不存在的源（由 delete 的逆操作生成）。
 */
export interface InsertCommand {
  kind: 'insert';
  pages: PageRef[];
  index: number;
  sources?: SourceRef[];
}

/** 导入一份或多份源 PDF：注册源并把每页追加到列表末尾。逆操作：删除这些页。 */
export interface MergeSourcesCommand {
  kind: 'mergeSources';
  sources: SourceRef[];
  pages: PageRef[];
}

/** 设置页面分组标签。labels 中的 from/to 为每页前后标签。 */
export interface RelabelCommand {
  kind: 'relabel';
  labels: Array<{ pageId: string; from: string | null; to: string | null }>;
}

/** apply 的结果：新状态 + 逆命令。逆命令作用于新状态即可还原。 */
export interface CommandResult {
  state: DocumentState;
  inverse: Command;
}

export function applyRotation(rotation: Rotation, delta: RotateDelta): Rotation {
  const next = (rotation + delta) % 360;
  return ((next < 0 ? next + 360 : next) as Rotation);
}

export function negateDelta(delta: RotateDelta): RotateDelta {
  if (delta === 180) return 180;
  return delta === 90 ? -90 : 90;
}

/** 根据新分配页面的 id 推进 nextPageId，保证单调递增、不重用。 */
function advanceNextPageId(nextPageId: number, pages: PageRef[]): number {
  let max = nextPageId - 1;
  for (const p of pages) {
    const id = Number(p.id);
    if (Number.isInteger(id) && id > max) max = id;
  }
  return max + 1;
}

/** 校验 reorder 的 from：升序、去重、范围内。 */
function assertSortedUniqueInRange(from: number[], length: number): void {
  if (!from.every((i) => Number.isInteger(i) && i >= 0 && i < length)) {
    throw new Error(`reorder 下标越界：from=${JSON.stringify(from)}，列表长度 ${length}`);
  }
  for (let i = 1; i < from.length; i++) {
    if (from[i] <= from[i - 1]) {
      throw new Error(`reorder 下标必须严格升序且不重复：${JSON.stringify(from)}`);
    }
  }
}

function applyReorder(state: DocumentState, cmd: ReorderCommand): CommandResult {
  if (cmd.from.length === 0) {
    // 空移动：无操作，逆操作同样为空。
    return { state, inverse: { kind: 'reorder', from: [], to: 0 } };
  }
  assertSortedUniqueInRange(cmd.from, state.pages.length);

  const removed = cmd.from.map((i) => state.pages[i]);
  const removedSet = new Set(cmd.from);
  const rest = state.pages.filter((_, i) => !removedSet.has(i));
  const to = clamp(cmd.to, 0, rest.length);
  const pages = [...rest.slice(0, to), ...removed, ...rest.slice(to)];

  // 逆操作：分散的 from 无法用单个 reorder 还原，使用 setOrder 精确还原整序。
  const inverse: SetOrderCommand = {
    kind: 'setOrder',
    order: state.pages.map((p) => p.id),
  };
  return { state: { ...state, pages }, inverse };
}

function applySetOrder(state: DocumentState, cmd: SetOrderCommand): CommandResult {
  const currentIds = state.pages.map((p) => p.id);
  if (cmd.order.length !== currentIds.length) {
    throw new Error(`setOrder 长度不符：${cmd.order.length} != ${currentIds.length}`);
  }
  const byId = new Map(state.pages.map((p) => [p.id, p]));
  const order: PageRef[] = [];
  for (const id of cmd.order) {
    const page = byId.get(id);
    if (page === undefined) {
      throw new Error(`setOrder 包含未知页面 id：${id}`);
    }
    order.push(page);
  }
  // 已知 id 必须全部出现（长度已校验且无未知 id，即恰好一个排列）。
  const inverse: SetOrderCommand = { kind: 'setOrder', order: currentIds };
  return { state: { ...state, pages: order }, inverse };
}

function applyRotate(state: DocumentState, cmd: RotateCommand): CommandResult {
  const idSet = new Set(cmd.pageIds);
  const pages = state.pages.map((p) =>
    idSet.has(p.id) ? { ...p, rotation: applyRotation(p.rotation, cmd.delta) } : p,
  );
  const inverse: RotateCommand = {
    kind: 'rotate',
    pageIds: cmd.pageIds,
    delta: negateDelta(cmd.delta),
  };
  return { state: { ...state, pages }, inverse };
}

function applyDelete(state: DocumentState, cmd: DeleteCommand): CommandResult {
  const idSet = new Set(cmd.pageIds);
  if (idSet.size === 0) return { state, inverse: { kind: 'delete', pageIds: [] } };

  const removed: PageRef[] = state.pages.filter((p) => idSet.has(p.id));
  if (removed.length === 0) return { state, inverse: { kind: 'delete', pageIds: [] } };

  const firstIndex = state.pages.findIndex((p) => idSet.has(p.id));
  const pages = state.pages.filter((p) => !idSet.has(p.id));

  // 孤儿源清理：删除后不再被任何页引用的源一并移除。
  const referenced = new Set(pages.map((p) => p.sourceId));
  const orphanSources = state.sources.filter((s) => !referenced.has(s.id));
  const sources = state.sources.filter((s) => referenced.has(s.id));

  const inverse: InsertCommand = {
    kind: 'insert',
    pages: removed,
    index: firstIndex,
    sources: orphanSources,
  };
  return { state: { ...state, pages, sources }, inverse };
}

function applyInsert(state: DocumentState, cmd: InsertCommand): CommandResult {
  const index = clamp(cmd.index, 0, state.pages.length);
  const pages = [
    ...state.pages.slice(0, index),
    ...cmd.pages,
    ...state.pages.slice(index),
  ];
  // 注册缺失的源（去重：已存在则跳过）。
  const known = new Set(state.sources.map((s) => s.id));
  const newSources = (cmd.sources ?? []).filter((s) => !known.has(s.id));
  const sources = [...state.sources, ...newSources];

  const inverse: DeleteCommand = {
    kind: 'delete',
    pageIds: cmd.pages.map((p) => p.id),
  };
  return {
    state: { ...state, pages, sources, nextPageId: advanceNextPageId(state.nextPageId, cmd.pages) },
    inverse,
  };
}

function applyMergeSources(state: DocumentState, cmd: MergeSourcesCommand): CommandResult {
  const pages = [...state.pages, ...cmd.pages];
  const known = new Set(state.sources.map((s) => s.id));
  const sources = [...state.sources, ...cmd.sources.filter((s) => !known.has(s.id))];
  const inverse: DeleteCommand = {
    kind: 'delete',
    pageIds: cmd.pages.map((p) => p.id),
  };
  return {
    state: { ...state, pages, sources, nextPageId: advanceNextPageId(state.nextPageId, cmd.pages) },
    inverse,
  };
}

function applyRelabel(state: DocumentState, cmd: RelabelCommand): CommandResult {
  const byId = new Map(cmd.labels.map((l) => [l.pageId, l]));
  const pages = state.pages.map((p) => {
    const l = byId.get(p.id);
    return l ? { ...p, label: l.to } : p;
  });
  const inverse: RelabelCommand = {
    kind: 'relabel',
    labels: cmd.labels.map((l) => ({ pageId: l.pageId, from: l.to, to: l.from })),
  };
  return { state: { ...state, pages }, inverse };
}

function applyComposite(state: DocumentState, cmd: CompositeCommand): CommandResult {
  let current = state;
  const inverses: Command[] = [];
  for (const step of cmd.steps) {
    const result = apply(current, step);
    current = result.state;
    inverses.push(result.inverse);
  }
  const inverse: CompositeCommand = { kind: 'composite', steps: inverses.reverse() };
  return { state: current, inverse };
}

/**
 * 应用命令，返回新状态与逆命令。
 * 约定：命令不可变；状态以新对象返回（不就地修改）。
 */
export function apply(state: DocumentState, command: Command): CommandResult {
  switch (command.kind) {
    case 'reorder':
      return applyReorder(state, command);
    case 'setOrder':
      return applySetOrder(state, command);
    case 'rotate':
      return applyRotate(state, command);
    case 'delete':
      return applyDelete(state, command);
    case 'insert':
      return applyInsert(state, command);
    case 'mergeSources':
      return applyMergeSources(state, command);
    case 'relabel':
      return applyRelabel(state, command);
    case 'composite':
      return applyComposite(state, command);
  }
}

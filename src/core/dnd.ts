import type { ReorderCommand } from './commands';

/**
 * 把「拖拽若干页放到目标页上」转换为 reorder 命令。
 * - order：当前完整页序（id 列表）。
 * - draggedIds：被拖拽页 id（可为散选）。
 * - overId：落点页 id。
 *
 * 规则：落点在拖拽块之后 → 插入到落点后；落点在前 → 插入到落点前。
 * 拖拽页含落点（自落）或落点不存在 → 返回 null（无操作）。
 */
export function computeReorderForDrop(
  order: string[],
  draggedIds: string[],
  overId: string,
): ReorderCommand | null {
  const dragged = new Set(draggedIds);
  if (dragged.size === 0 || dragged.has(overId)) return null;

  const from: number[] = [];
  const rest: string[] = [];
  order.forEach((id, i) => {
    if (dragged.has(id)) from.push(i);
    else rest.push(id);
  });
  if (from.length === 0) return null;

  const anchorInRest = rest.indexOf(overId);
  if (anchorInRest < 0) return null;

  const overOrigIndex = order.indexOf(overId);
  const forward = overOrigIndex > from[0];
  const to = forward ? anchorInRest + 1 : anchorInRest;
  return { kind: 'reorder', from, to };
}

/** 按当前页序返回被拖拽页 id 的有序列表（保持相对顺序）。 */
export function sortedDraggedIds(order: string[], draggedIds: string[]): string[] {
  const set = new Set(draggedIds);
  return order.filter((id) => set.has(id));
}

/** 拖拽落点的可视化预览信息。 */
export interface DropPreview {
  /** 插入到完整列表的哪个下标之前（0..order.length；等于 length 表示追加到末尾）。 */
  insertIndex: number;
  /** 落定后，被拖拽块首页的 1-based 页码。 */
  finalPageNumber: number;
}

/**
 * 计算拖拽落点预览；返回 null 表示无有效落点（自落 / 落点不存在 / 空拖拽）。
 * 与 computeReorderForDrop 共用同一套落点语义，保证指示符与实际结果一致。
 */
export function computeDropPreview(
  order: string[],
  draggedIds: string[],
  overId: string,
): DropPreview | null {
  const cmd = computeReorderForDrop(order, draggedIds, overId);
  if (cmd === null) return null;
  const dragged = new Set(draggedIds);
  let insertIndex = 0;
  let remaining = cmd.to;
  for (let i = 0; i < order.length; i++) {
    if (dragged.has(order[i])) continue;
    if (remaining === 0) break;
    remaining -= 1;
    insertIndex = i + 1;
  }
  return { insertIndex, finalPageNumber: cmd.to + 1 };
}

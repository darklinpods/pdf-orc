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

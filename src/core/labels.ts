import type { PageRef } from './types';
import type { RelabelCommand } from './commands';

/** 分组 = 证据类别标签（ADR 0008：标签派生模型）。 */
export interface GroupInfo {
  name: string;
  count: number;
  color: string;
}

/** 固定调色板：组名稳定映射到其中一色。 */
const PALETTE = [
  '#2563eb', // 蓝
  '#dc2626', // 红
  '#16a34a', // 绿
  '#d97706', // 橙
  '#7c3aed', // 紫
  '#0891b2', // 青
  '#db2777', // 粉
  '#65a30d', // 黄绿
  '#4b5563', // 灰
  '#ca8a04', // 黄
];

/** 稳定字符串哈希（FNV-1a 简化），把组名映射到调色板下标。 */
function hashString(input: string): number {
  let hash = 2166136261;
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

/** 组名 → 颜色（纯函数，零状态、稳定一致）。 */
export function groupColor(name: string): string {
  return PALETTE[hashString(name) % PALETTE.length];
}

/** 从页面列表派生分组（去重、按首次出现顺序、带页数与颜色）。 */
export function collectGroups(pages: PageRef[]): GroupInfo[] {
  const groups: GroupInfo[] = [];
  const counts = new Map<string, number>();
  for (const page of pages) {
    if (page.label === null) continue;
    const prev = counts.get(page.label) ?? 0;
    if (prev === 0) {
      groups.push({ name: page.label, count: 0, color: groupColor(page.label) });
    }
    counts.set(page.label, prev + 1);
  }
  return groups.map((g) => ({ ...g, count: counts.get(g.name) ?? 0 }));
}

/** 把一组页面设为某标签（或 null 取消分组），返回 relabel 命令（含正确的 from，撤销可还原）。 */
export function relabelPagesCommand(pages: PageRef[], to: string | null): RelabelCommand {
  return {
    kind: 'relabel',
    labels: pages.map((p) => ({ pageId: p.id, from: p.label, to })),
  };
}

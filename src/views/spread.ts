/** 双页对开（facing spread）排版纯函数。 */

/**
 * 页面 index（0 起）所在对开中的页面下标列表。
 * 对开约定：第 1 页单独（右）；其后偶数页号在左、奇数页号在右。
 * 例（0 起）：[0]；[1,2]；[3,4]；[5,6]；…；末页若落单则单独（左）。
 */
export function spreadForPage(index: number, pageCount: number): number[] {
  if (pageCount <= 0) return [];
  const i = Math.max(0, Math.min(index, pageCount - 1));
  if (i === 0) return [0];
  const left = i % 2 === 0 ? i - 1 : i;
  const right = left + 1;
  return [left, right].filter((n) => n >= 0 && n < pageCount);
}

/** 当前页所在对开的「首个下标」。 */
export function spreadFirst(index: number, pageCount: number): number {
  return spreadForPage(index, pageCount)[0] ?? 0;
}

/** 下一对开的首个下标（越界则原地不动）。 */
export function nextSpread(index: number, pageCount: number): number {
  const cur = spreadFirst(index, pageCount);
  if (cur === 0) return pageCount > 1 ? 1 : 0;
  const next = cur + 2;
  return next < pageCount ? next : cur;
}

/** 上一对开的首个下标。 */
export function prevSpread(index: number, pageCount: number): number {
  const cur = spreadFirst(index, pageCount);
  if (cur === 0) return 0;
  if (cur === 1) return 0;
  return cur - 2;
}

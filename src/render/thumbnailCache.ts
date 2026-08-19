/**
 * LRU 缓存（缩略图复用，ADR 0007 内存预算的一部分）。
 * 纯逻辑、零 DOM，可单测。淘汰策略：超出上限时移除最久未访问项。
 */
export class LruCache<V> {
  private entries = new Map<string, V>();

  constructor(private readonly max: number) {
    if (!Number.isInteger(max) || max <= 0) {
      throw new Error(`LruCache 上限必须为正整数，收到 ${max}`);
    }
  }

  get size(): number {
    return this.entries.size;
  }

  get(key: string): V | undefined {
    const value = this.entries.get(key);
    if (value === undefined) return undefined;
    // 访问即刷新：先删后插，保持 Map 迭代序为「最近使用优先」。
    this.entries.delete(key);
    this.entries.set(key, value);
    return value;
  }

  has(key: string): boolean {
    return this.entries.has(key);
  }

  set(key: string, value: V): void {
    if (this.entries.has(key)) this.entries.delete(key);
    this.entries.set(key, value);
    while (this.entries.size > this.max) {
      const oldest = this.entries.keys().next().value as string;
      this.entries.delete(oldest);
    }
  }

  delete(key: string): boolean {
    return this.entries.delete(key);
  }

  clear(): void {
    this.entries.clear();
  }
}

/**
 * 缩略图缓存键：source:page:rotation:scaleBucket。
 * scaleBucket 按目标宽度向上取整到百位（如 160→200、240→300），
 * 渲染略大、CSS 缩小更清晰，同时避免缩放微调导致缓存全失效。
 */
export function thumbnailCacheKey(
  sourceId: string,
  pageIndex: number,
  rotation: number,
  targetWidth: number,
): string {
  const bucket = Math.ceil(targetWidth / 100) * 100;
  return `${sourceId}:${pageIndex}:${rotation}:${bucket}`;
}

/** 页面旋转角，单位度。只允许四向。 */
export type Rotation = 0 | 90 | 180 | 270;

/** 源 PDF 引用：一份导入的文件。注册后不再可变。 */
export interface SourceRef {
  id: string;
  name: string;
  pageCount: number;
}

/**
 * 页面引用：指向某源 PDF 的某一页，携带独立旋转与分组标签。
 * id 在会话内稳定，跨会话恢复（IndexedDB 备份）时保持不变。
 */
export interface PageRef {
  id: string;
  sourceId: string;
  /** 源 PDF 内的页下标（0 起）。 */
  sourcePageIndex: number;
  rotation: Rotation;
  /** 分组标签；null 表示未分组。 */
  label: string | null;
}

/**
 * 文档状态：页面列表是唯一事实源。
 * 不变量：
 * - 每个 PageRef.sourceId 都存在于 sources 中；
 * - sources 中不被任何页引用的项会在删除命令中自动移除（孤儿源清理）；
 * - sources 是无序注册表：顺序不构成文档语义，撤销/重做后顺序可能变化；
 * - nextPageId 是单调递增的 id 水位：只随分配新页的命令前进，撤销时不回落
 *   （保证 id 永不重用；页面/源内容在撤销后与操作前完全一致，水位不必一致）。
 */
export interface DocumentState {
  pages: PageRef[];
  sources: SourceRef[];
  /** 下一条页面 id，单调递增。 */
  nextPageId: number;
}

/** 返回一个全新的空文档（避免共享可变对象）。 */
export function emptyDocument(): DocumentState {
  return { pages: [], sources: [], nextPageId: 1 };
}

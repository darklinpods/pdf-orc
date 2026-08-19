/**
 * 页面缩放纯函数（零 DOM 依赖，可脱离浏览器单测）。
 */
export function fitScale(
  pageWidth: number,
  pageHeight: number,
  targetWidth: number,
  targetHeight?: number,
): number {
  if (!(pageWidth > 0) || !(pageHeight > 0) || !(targetWidth > 0)) return 1;
  let scale = targetWidth / pageWidth;
  if (targetHeight !== undefined && targetHeight > 0) {
    scale = Math.min(scale, targetHeight / pageHeight);
  }
  return scale;
}

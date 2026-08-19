import { useEffect, useRef, useState, type ReactNode } from 'react';

export interface LazyMountProps {
  children: ReactNode;
  /** 预渲染边距：进入视口前多提前 rootMargin 距离即挂载。 */
  rootMargin?: string;
}

/**
 * 惰性挂载：进入视口附近时才真正渲染子节点（用于大量缩略图的渐进渲染）。
 * 一旦挂载不再卸载，避免滚动回看时的重复渲染抖动。
 * 配合 PageRenderer 的 thumbnail 位图缓存，把「初始只渲染可见项」的诉求落实。
 */
export function LazyMount({ children, rootMargin = '300px' }: LazyMountProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (el === null) return;
    if (typeof IntersectionObserver === 'undefined') {
      setMounted(true);
      return;
    }
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setMounted(true);
          observer.disconnect();
        }
      },
      { rootMargin },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [rootMargin]);

  return <div ref={ref}>{mounted ? children : null}</div>;
}

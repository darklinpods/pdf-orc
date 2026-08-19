import { describe, expect, it } from 'vitest';
import { LruCache, thumbnailCacheKey } from './thumbnailCache';

describe('LruCache', () => {
  it('set/get 基础行为', () => {
    const cache = new LruCache<string>(3);
    cache.set('a', '1');
    cache.set('b', '2');
    expect(cache.get('a')).toBe('1');
    expect(cache.get('missing')).toBeUndefined();
    expect(cache.size).toBe(2);
  });

  it('超过上限淘汰最久未访问项', () => {
    const cache = new LruCache<string>(3);
    cache.set('a', '1');
    cache.set('b', '2');
    cache.set('c', '3');
    cache.set('d', '4'); // 淘汰 a
    expect(cache.get('a')).toBeUndefined();
    expect(cache.get('b')).toBe('2');
    expect(cache.size).toBe(3);
  });

  it('访问刷新最近使用顺序', () => {
    const cache = new LruCache<string>(3);
    cache.set('a', '1');
    cache.set('b', '2');
    cache.set('c', '3');
    cache.get('a'); // a 变为最近使用
    cache.set('d', '4'); // 淘汰 b
    expect(cache.get('a')).toBe('1');
    expect(cache.get('b')).toBeUndefined();
    expect(cache.get('c')).toBe('3');
  });

  it('重复 set 覆盖并刷新', () => {
    const cache = new LruCache<string>(2);
    cache.set('a', '1');
    cache.set('b', '2');
    cache.set('a', '10'); // 覆盖 a，不增加数量
    expect(cache.size).toBe(2);
    expect(cache.get('a')).toBe('10');
    cache.set('c', '3'); // 淘汰 b
    expect(cache.get('b')).toBeUndefined();
  });

  it('delete 与 clear', () => {
    const cache = new LruCache<string>(3);
    cache.set('a', '1');
    cache.set('b', '2');
    expect(cache.delete('a')).toBe(true);
    expect(cache.delete('a')).toBe(false);
    expect(cache.size).toBe(1);
    cache.clear();
    expect(cache.size).toBe(0);
  });

  it('上限非正整数抛错', () => {
    expect(() => new LruCache<string>(0)).toThrow();
    expect(() => new LruCache<string>(-1)).toThrow();
  });
});

describe('thumbnailCacheKey', () => {
  it('包含 source/page/rotation 并按目标宽度向上取整到百位', () => {
    expect(thumbnailCacheKey('src-1', 0, 0, 160)).toBe('src-1:0:0:200');
    expect(thumbnailCacheKey('src-1', 0, 0, 240)).toBe('src-1:0:0:300');
    expect(thumbnailCacheKey('src-1', 0, 90, 160)).toBe('src-1:0:90:200');
    expect(thumbnailCacheKey('src-2', 3, 0, 160)).toBe('src-2:3:0:200');
    // 向上取整：150→200、250→300、101→200
    expect(thumbnailCacheKey('a', 0, 0, 150)).toBe('a:0:0:200');
    expect(thumbnailCacheKey('a', 0, 0, 250)).toBe('a:0:0:300');
    expect(thumbnailCacheKey('a', 0, 0, 101)).toBe('a:0:0:200');
  });
});

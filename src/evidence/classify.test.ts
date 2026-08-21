import { describe, expect, it } from 'vitest';
import { buildDirectory, classifyPage } from './classify';

describe('classifyPage', () => {
  it('按关键词分类', () => {
    expect(classifyPage('道路交通事故认定书 编号：xxx')).toBe('事故认定书');
    expect(classifyPage('居民身份证 姓名 公民身份号码')).toBe('身份证');
    expect(classifyPage('机动车驾驶证 号牌号码')).toBe('驾驶证/行驶证');
    expect(classifyPage('机动车交通事故责任强制保险单')).toBe('保险单');
    expect(classifyPage('司法鉴定意见书')).toBe('司法鉴定');
    expect(classifyPage('民事起诉状 原告 被告')).toBe('起诉状');
    expect(classifyPage('出院记录 住院病案首页')).toBe('医疗材料');
    expect(classifyPage('证据目录')).toBe('证据目录');
  });

  it('特异性优先：医疗诊断证明不误归「证明」', () => {
    expect(classifyPage('诊断证明 出院记录')).toBe('医疗材料');
  });

  it('无匹配返回 null', () => {
    expect(classifyPage('')).toBeNull();
    expect(classifyPage('随机无关文字 abcdef')).toBeNull();
  });
});

describe('buildDirectory', () => {
  it('相邻同类页合并，异类/未分类分项', () => {
    const items = buildDirectory([
      '道路交通事故认定书',
      '道路交通事故认定书 续',
      '居民身份证',
      '随机文字',
      '出院记录',
      '出院记录 2',
    ]);
    expect(items).toEqual([
      { name: '事故认定书', start: 1, end: 2 },
      { name: '身份证', start: 3, end: 3 },
      { name: '未分类', start: 4, end: 4 },
      { name: '医疗材料', start: 5, end: 6 },
    ]);
  });

  it('空输入返回空目录', () => {
    expect(buildDirectory([])).toEqual([]);
  });

  it('相同类别不连续则分成多项', () => {
    const items = buildDirectory(['道路交通事故认定书', '居民身份证', '道路交通事故认定书']);
    expect(items.map((i) => i.name)).toEqual(['事故认定书', '身份证', '事故认定书']);
  });
});

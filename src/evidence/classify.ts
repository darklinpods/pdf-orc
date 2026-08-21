/** 证据目录项：名称 + 页码范围（1 起，含两端）。 */
export interface DirectoryItem {
  name: string;
  start: number;
  end: number;
}

/**
 * 关键词分类规则（规则顺序即优先级，先匹配先得）。
 * 关键词须足够特异，避免与更宽泛的类别冲突（如「医疗材料」置于「证明」之前）。
 */
const RULES: Array<{ category: string; keywords: string[] }> = [
  { category: '事故认定书', keywords: ['道路交通事故认定书', '交通事故认定书', '事故认定书', '责任认定书'] },
  { category: '身份证', keywords: ['居民身份证', '公民身份号码', '身份证'] },
  { category: '驾驶证/行驶证', keywords: ['机动车驾驶证', '机动车行驶证', '驾驶证', '行驶证', '号牌号码'] },
  { category: '保险单', keywords: ['机动车交通事故责任强制保险', '交强险', '商业险', '电子保单', '保险单'] },
  { category: '司法鉴定', keywords: ['司法鉴定意见书', '司法鉴定许可证', '司法鉴定', '鉴定意见'] },
  { category: '起诉状', keywords: ['民事起诉状', '起诉状', '索赔清单'] },
  { category: '医疗材料', keywords: ['住院病案', '出院记录', '入院记录', '检查报告', '诊断证明', '病历', '门诊', '处方', '医疗费'] },
  { category: '现场照片/图', keywords: ['现场照片', '现场图', '现场勘验', '勘验笔录'] },
  { category: '证据目录', keywords: ['证据目录'] },
  { category: '证明/营业执照', keywords: ['营业执照', '统一社会信用代码', '村委会证明', '单位证明', '收入证明', '误工证明', '证明'] },
];

/** 按关键词把一页 OCR 文本归入证据类别；无匹配返回 null（未分类）。 */
export function classifyPage(text: string): string | null {
  const t = text ?? '';
  if (t.trim() === '') return null;
  for (const rule of RULES) {
    if (rule.keywords.some((kw) => t.includes(kw))) return rule.category;
  }
  return null;
}

/** 把逐页文本分类并合并相邻同类页，生成证据目录草稿。 */
export function buildDirectory(pageTexts: string[]): DirectoryItem[] {
  const items: DirectoryItem[] = [];
  pageTexts.forEach((text, i) => {
    const category = classifyPage(text) ?? '未分类';
    const pageNo = i + 1;
    const last = items[items.length - 1];
    if (last !== undefined && last.name === category && last.end === pageNo - 1) {
      last.end = pageNo;
    } else {
      items.push({ name: category, start: pageNo, end: pageNo });
    }
  });
  return items;
}

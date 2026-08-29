// ============================================
// 模板引擎 - 纯文本模板渲染
// ============================================
// 特性：
// - 支持 {{fieldName}} 占位符（容忍 {{ fieldName }} 空格）
// - 缺失字段渲染为空串
// - 纯函数，不依赖 React，不抛异常
// 注意：与 formula.ts 的 {field} 语法互不冲突（模板使用双花括号）。

/** 模板占位符：{{字段名}}，内部允许空白 */
const PLACEHOLDER_RE = /\{\{\s*([^{}]+?)\s*\}\}/g;

/** 将字段值转为模板可显示的文本 */
function valueToText(value: unknown): string {
  if (value === null || value === undefined) return '';
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  if (Array.isArray(value)) {
    return value.map((item) =>
      typeof item === 'object' && item !== null ? JSON.stringify(item) : valueToText(item),
    ).join(', ');
  }
  if (typeof value === 'object') {
    try {
      return JSON.stringify(value);
    } catch {
      return String(value);
    }
  }
  return String(value);
}

/**
 * 提取模板中引用的字段名列表（按首次出现顺序，去重）。
 * @param template 模板文本，如 "订单 {{订单号}} 金额 {{金额}}"
 */
export function extractTemplateFields(template: string): string[] {
  const fields: string[] = [];
  const seen = new Set<string>();
  for (const match of String(template ?? '').matchAll(PLACEHOLDER_RE)) {
    const name = match[1].trim();
    if (name && !seen.has(name)) {
      seen.add(name);
      fields.push(name);
    }
  }
  return fields;
}

/**
 * 渲染模板：将 {{fieldName}} 替换为 data 中对应字段值。
 * @param template 模板文本
 * @param data     字段名 → 值 的映射
 * @returns 渲染后的文本；缺失字段渲染为空串
 */
export function renderTemplate(template: string, data: Record<string, unknown>): string {
  return String(template ?? '').replace(PLACEHOLDER_RE, (_raw, fieldName: string) => {
    const field = fieldName.trim();
    if (!field) return '';
    return valueToText(data[field]);
  });
}

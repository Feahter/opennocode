// ============================================
// 查询引擎 - 纯函数（过滤 / 排序 / 分页）
// ============================================
// P1-7: 数据视图查询核心。全部为无副作用纯函数，
// 可直接单测，也可安全用于 useMemo 缓存。

import type { AppRecord, Field } from '../types';

export type SortDirection = 'asc' | 'desc';

// 将任意字段值转成可搜索字符串（对象/数组走 JSON 序列化兜底）
function valueToSearchString(value: unknown): string {
  if (value === null || value === undefined) return '';
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  return JSON.stringify(value);
}

/**
 * 模糊过滤：按字段值（大小写不敏感）匹配关键字。
 * - 传入 fields 时，只匹配这些字段名对应的记录值
 * - fields 为空时回退为匹配记录 data 的全部值（无字段定义的兜底）
 */
export function filterRecords(records: AppRecord[], fields: Field[], keyword: string): AppRecord[] {
  const kw = keyword.trim().toLowerCase();
  if (!kw) return records;

  const searchFields = fields.length > 0 ? fields : null;
  return records.filter((record) => {
    if (searchFields) {
      for (const field of searchFields) {
        const value = record.data[field.name];
        if (value === null || value === undefined) continue;
        if (valueToSearchString(value).toLowerCase().includes(kw)) return true;
      }
      return false;
    }
    return Object.values(record.data).some(
      (value) => valueToSearchString(value).toLowerCase().includes(kw)
    );
  });
}

function isEmptyValue(v: unknown): boolean {
  return v === null || v === undefined || v === '';
}

// 非空值比较：两值均可数值化（number / 数字字符串）时按大小比，
// 其余按字符串本地化排序（中文按拼音）。
function compareValues(a: unknown, b: unknown): number {
  const isNumeric = (v: unknown): boolean =>
    typeof v === 'number' ||
    (typeof v === 'string' && v.trim() !== '' && !Number.isNaN(Number(v)));

  if (isNumeric(a) && isNumeric(b)) {
    const diff = Number(a) - Number(b);
    return diff === 0 ? 0 : diff > 0 ? 1 : -1;
  }
  return String(a).localeCompare(String(b), 'zh-Hans-CN', {
    numeric: true,
    sensitivity: 'base',
  });
}

/**
 * 排序：按字段值排序，direction 控制升降序，返回新数组（不修改入参）。
 * 空值恒排末尾（与升降序无关）；fieldName 为空时原样返回。
 */
export function sortRecords(
  records: AppRecord[],
  fieldName: string,
  direction: SortDirection
): AppRecord[] {
  if (!fieldName || records.length < 2) return records;
  const dir = direction === 'desc' ? -1 : 1;
  return [...records].sort((x, y) => {
    const vx = x.data[fieldName];
    const vy = y.data[fieldName];
    const ex = isEmptyValue(vx);
    const ey = isEmptyValue(vy);
    if (ex && ey) return 0;
    if (ex) return 1; // 空值恒末尾，不随方向翻转
    if (ey) return -1;
    return compareValues(vx, vy) * dir;
  });
}

/**
 * 分页：page 从 1 开始；page / pageSize 非法值（<=0、NaN）自动归一。
 */
export function paginateRecords(
  records: AppRecord[],
  page: number,
  pageSize: number
): AppRecord[] {
  const safePage = Math.max(1, Math.floor(page) || 1);
  const safeSize = Math.max(1, Math.floor(pageSize) || 1);
  const start = (safePage - 1) * safeSize;
  return records.slice(start, start + safeSize);
}

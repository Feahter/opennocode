// ============================================
// 回收站 - 内存态逻辑（P1-10）
// ============================================
// 本项目回收站先用内存态：recycleBin 为模块级数组。
// localStorage 持久化由 store 层决定（本模块不依赖任何存储/框架，保持纯逻辑）。

import type { AppRecord } from '../types';

// 回收站内存态（导出供 UI 直接读取）
export const recycleBin: AppRecord[] = [];

/**
 * 删除记录 → 移入回收站
 * 幂等：同一 id 的记录不会重复入站。
 */
export function addToBin(record: AppRecord): void {
  if (!record) return;
  if (!recycleBin.some(r => r.id === record.id)) {
    recycleBin.push({ ...record });
  }
}

/**
 * 从回收站恢复记录
 * - 从 bin 移除该记录，并放回 records（目标记录数组）
 * - 返回恢复的记录；bin 中不存在该 id 时返回 null
 */
export function restoreFromBin(id: string, records: AppRecord[]): AppRecord | null {
  const index = recycleBin.findIndex(r => r.id === id);
  if (index === -1) return null;
  const [record] = recycleBin.splice(index, 1);
  records.push(record);
  return record;
}

/**
 * 彻底删除：从回收站永久移除
 * - 返回被删除的记录；bin 中不存在该 id 时返回 null
 */
export function permanentDelete(id: string): AppRecord | null {
  const index = recycleBin.findIndex(r => r.id === id);
  if (index === -1) return null;
  const [record] = recycleBin.splice(index, 1);
  return record;
}

export default { recycleBin, addToBin, restoreFromBin, permanentDelete };

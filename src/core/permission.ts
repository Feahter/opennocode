// ============================================
// 权限引擎 - 纯函数（P1-10）
// ============================================
// 职责分层：
//   can()       —— 角色级（表级）权限：admin=CRUD / editor=CRU / viewer=R
//   canField()  —— 字段级权限：结合 FieldPermission 配置，无配置默认放行
// 复用 helpers.hasPermission 逻辑，保持单一事实来源。

import { hasPermission } from '../utils/helpers';
import type { Role, Action } from '../utils/helpers';
import type { Field } from '../types';

export type { Role, Action } from '../utils/helpers';

// 内置角色（与旧 state.js 的 roles: ['admin','editor','viewer'] 对齐）
export const ROLES: Role[] = ['admin', 'editor', 'viewer'];

/**
 * 角色级权限判断
 * - admin  ：create / read / update / delete（全权限）
 * - editor ：create / read / update
 * - viewer ：read（只读）
 */
export function can(role: Role, action: Action): boolean {
  return hasPermission(role, action);
}

/**
 * 字段级权限判断
 * - 命中该角色（role_id === role）的 FieldPermission 配置 → 以配置为准
 * - 无配置 / 未命中该角色 → 默认放行（true）
 *
 * 注：canField 只负责字段层判断；角色级（表级）限制请用 can()，
 *     需要两层同时生效时由调用方组合（如 can(role, action) && canField(field, role, action)）。
 */
export function canField(field: Field, role: Role, action: Action): boolean {
  const perm = field?.permissions?.find(p => p.role_id === role);
  if (!perm) return true;
  return Boolean(perm[action]);
}

export default { can, canField, ROLES };

// ============================================
// 状态机引擎 - 纯函数，UI 无关，agent 可直接调用
// ============================================
// 无代码约定：StateMachine 是纯 JSON 配置，引擎只读不写。
// App.state_machine 字段支持两种形态：
//   ① 内嵌 JSON（StateMachine 序列化字符串 / 对象）→ resolveStateMachine() 解析
//   ② id 引用（StateMachine.id）→ 需 store/storage 暴露注册表后解析，
//      当前未暴露则视为「无状态机」（看板回退单列「全部」）

import type { StateMachine, State } from '../types';

export type { StateMachine, State, Transition } from '../types';

/**
 * 返回状态机全部状态（保持定义顺序）。无状态机时返回空数组。
 */
export function getStates(sm: StateMachine | null | undefined): State[] {
  return sm?.states ?? [];
}

/**
 * 有效当前状态：记录未设置 state 时，视为处于 initial。
 */
export function effectiveState(
  sm: StateMachine | null | undefined,
  current?: string | null,
): string {
  if (current && current.trim() !== '') return current;
  return sm?.initial ?? '';
}

/**
 * 校验 from → to 是否为状态机允许的迁移（查 transitions）。
 * - 同状态原地移动（from === to）：不是迁移，返回 false（调用方应跳过 no-op）
 * - from 缺省时按 initial 判定
 */
export function canTransition(
  sm: StateMachine | null | undefined,
  from?: string | null,
  to?: string | null,
): boolean {
  if (!sm || !to) return false;
  const f = effectiveState(sm, from);
  if (f === to) return false;
  return sm.transitions.some((t) => t.from === f && t.to === to);
}

/**
 * 执行迁移：
 * - 合法：返回 target
 * - 非法：返回 current（记录原地不动）
 * - current 缺省（记录无状态）时按 initial 判定合法性，非法返回 undefined
 */
export function transition(
  sm: StateMachine | null | undefined,
  current?: string | null,
  target?: string | null,
): string | undefined {
  if (canTransition(sm, current, target)) return target ?? undefined;
  return current || undefined;
}

/**
 * 从 App.state_machine 字段解析状态机对象。
 * 支持：① StateMachine 对象本体 ② JSON 序列化字符串 ③ id 引用（无注册表 → null）
 */
export function resolveStateMachine(raw: unknown): StateMachine | null {
  let candidate: unknown = raw;
  if (typeof raw === 'string' && raw.trim() !== '') {
    const trimmed = raw.trim();
    // 非 JSON 形态（如 UUID id 引用）→ 无法解析，返回 null
    if (!trimmed.startsWith('{')) return null;
    try {
      candidate = JSON.parse(trimmed);
    } catch {
      return null;
    }
  }
  if (typeof candidate !== 'object' || candidate === null) return null;
  const sm = candidate as Partial<StateMachine>;
  if (!Array.isArray(sm.states) || typeof sm.initial !== 'string') return null;
  return sm as StateMachine;
}

/**
 * 记录在列中的归属 id：state 优先，其次 initial，再次首个状态，兜底 ''。
 */
export function columnIdForRecord(
  sm: StateMachine | null | undefined,
  recordState?: string | null,
): string {
  const st = recordState?.trim();
  if (st) return st;
  if (sm?.initial) return sm.initial;
  return sm?.states?.[0]?.id ?? '';
}

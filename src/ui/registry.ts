// ============================================
// UI 元设计 — 组件注册表（L0）
// ============================================
// kind 字符串 ↔ 组件实现解耦：加一种控件 = 一条 registerNode。
// agent 可通过 listKinds() 枚举能力，未知 kind 在渲染时优雅降级。

import type { NodeImpl } from './types';

const registry = new Map<string, NodeImpl>();

export function registerNode(kind: string, impl: NodeImpl): void {
  registry.set(kind, impl);
}

export function getNode(kind: string): NodeImpl | undefined {
  return registry.get(kind);
}

/** agent 友好：枚举所有已注册 kind */
export function listKinds(): string[] {
  return Array.from(registry.keys()).sort();
}

/** 是否存在某 kind */
export function hasKind(kind: string): boolean {
  return registry.has(kind);
}

/** 批量注册（模块导入时调用） */
export function registerAll(impls: Record<string, NodeImpl>): void {
  for (const [kind, impl] of Object.entries(impls)) {
    registry.set(kind, impl);
  }
}

// ============================================
// UI 元设计 — 核心类型（L0）
// ============================================
// 一切 UI 实体都是 UINode：叶子=原子控件，容器=复合布局，无限递归（分形）。
// kind 是唯一结构锚点，其余全是数据。

import type { ReactNode } from 'react';

/** 数据绑定：声明式数据源 */
export type Binding =
  | { source: 'app'; ref: string }
  | { source: 'field'; ref: string }
  | { source: 'formula'; expression: string }
  | { source: 'query'; ref: string }
  | { source: 'const'; value: unknown };

/** 动作：交互配置化（读写分离——写只走 Action 分发器） */
export type Action =
  | { type: 'create_record'; appId: string; data: Record<string, unknown> }
  | { type: 'update_record'; recordId: string; data: Record<string, unknown> }
  | { type: 'delete_record'; recordId: string }
  | { type: 'set_field'; field: string; value: unknown }
  | { type: 'transition'; recordId: string; to: string }
  | { type: 'navigate'; view: string }
  | { type: 'open_modal'; ref: string }
  | { type: 'close_modal'; ref: string }
  | { type: 'run_query'; query: string }
  | { type: 'render_template'; template: string; output?: 'pdf' | 'html' | 'email' }
  | { type: 'custom'; handler: string };

/** 字段联动规则（对齐 saleswork visibleType/optionRelation/filterCondition） */
export interface FieldLinkage {
  visibleType: 'always' | 'condition' | 'role' | 'state';
  condition?: string;            // 显隐条件，如 `state == '已签约'`
  optionRelation?: {
    dependsOn: string;           // 依赖字段
    map: Record<string, unknown[]>; // A 值 → B 可选值
  };
  filterCondition?: string;      // reference 过滤条件
}

/** UI 节点：递归分形结构 */
export interface UINode {
  kind: string;                          // 注册表键，如 'field.text' | 'container.tabs'
  id?: string;                           // 稳定 id（memo key + 调试定位）
  props?: Record<string, unknown>;       // 组件专属 props（zod schema 约束）
  children?: UINode[];                   // 子节点（叶子无）
  bindings?: Binding[];                  // 数据绑定
  events?: Record<string, Action[]>;     // 事件 → 动作
}

/** 渲染上下文：由 UIRoot 从 zustand 订阅构造一次，只读下传 */
export interface RenderContext {
  app?: unknown;
  record?: Record<string, unknown>;
  records?: unknown[];
  fields?: unknown[];
  values?: Record<string, unknown>;      // 表单当前值快照（联动计算用）
  setValue?: (field: string, value: unknown) => void;
  [key: string]: unknown;
}

/** 组件实现（注册表条目） */
export interface NodeProps {
  node: UINode;
  ctx: RenderContext;
  children?: ReactNode[];
}

export interface NodeImpl {
  component: (p: NodeProps) => ReactNode;
  schema?: unknown;                      // zod schema（校验 props）
  defaultProps?: Record<string, unknown>;
  lazy?: () => Promise<{ default: NodeImpl }>;
}

// ============================================
// UI 元设计 — 渲染引擎（L0 核心）
// ============================================
// renderNode 是纯函数：JSON 节点树 → React 元素树。
// 三段式：zod 校验（可选）→ 递归查表 → React 元素。

import React from 'react';
import { getNode } from './registry';
import { resolveBindings } from './bindings';
import type { UINode, RenderContext, NodeProps } from './types';

/** 未知 kind 优雅降级（不白屏） */
function MissingNode({ kind }: { kind: string }) {
  return (
    <div className="ui-missing" data-kind={kind} style={{ color: '#ef4444', padding: '4px 8px', fontSize: 12 }}>
      ⚠ 未注册组件: <code>{kind}</code>
    </div>
  );
}

/** 渲染单个节点（核心，5 行） */
export function renderNode(node: UINode, ctx: RenderContext): React.ReactNode {
  // 配置级隐藏：__hidden: true → 不渲染（联动显隐的官方通道）
  const nodeProps = node.props as Record<string, unknown> | undefined;
  if (nodeProps?.__hidden === true) return null;

  const impl = getNode(node.kind);
  if (!impl) return <MissingNode kind={node.kind} />;

  // 绑定解析：组件只读 value
  const bound = resolveBindings(node.bindings, ctx);

  // 递归渲染 children
  const children = node.children?.map((c, i) => (
    <React.Fragment key={c.id ?? `${node.kind}-${i}`}>{renderNode(c, ctx)}</React.Fragment>
  ));

  const props: NodeProps = {
    node,
    ctx: { ...ctx, ...(bound ? { value: bound } : {}) },
    children,
  };
  return impl.component(props);
}

/** 渲染一颗节点树（顶层入口，供 UIRoot 调用） */
export function renderTree(root: UINode, ctx: RenderContext): React.ReactNode {
  return renderNode(root, ctx);
}

/** 递归收集某 kind 的所有节点（用于校验/统计） */
export function collectNodes(node: UINode, kind?: string): UINode[] {
  const out: UINode[] = [];
  if (!kind || node.kind === kind) out.push(node);
  for (const c of node.children ?? []) out.push(...collectNodes(c, kind));
  return out;
}

/** 递归统计节点数 */
export function countNodes(node: UINode): number {
  return 1 + (node.children ?? []).reduce((acc, c) => acc + countNodes(c), 0);
}

// ============================================
// UI 元设计 — 顶层 UIRoot（连接引擎与 zustand store）
// ============================================
// 订阅 store 一次 → 构造只读 ctx → 渲染整颗节点树。
// 这是现有手写组件与元设计之间的"桥"。

import React from 'react';
import { renderTree } from './render';
import type { UINode, RenderContext } from './types';

interface UIRootProps {
  node: UINode;
  ctx?: Partial<RenderContext>;
  /** 可选：显式传 store 快照（默认走 useAppStore） */
}

/** 顶层渲染入口：节点树 → React 树 */
export function UIRoot({ node, ctx }: UIRootProps) {
  const fullCtx: RenderContext = {
    ...ctx,
  };
  // eslint-disable-next-line react-hooks/rules-of-hooks
  const memoized = React.useMemo(() => fullCtx, [JSON.stringify(ctx ?? {})]);
  return <>{renderTree(node, memoized)}</>;
}

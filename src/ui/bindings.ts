// ============================================
// UI 元设计 — 数据绑定解析（L3 基础版）
// ============================================
// 组件永远只读 props.value，不关心值来自字段/公式/常量。
// 读用绑定，写用动作——读写分离。

import type { Binding, RenderContext } from './types';

/** 解析单个绑定 → 值（纯函数，无副作用） */
export function resolveBinding(binding: Binding, ctx: RenderContext): unknown {
  switch (binding.source) {
    case 'const':
      return binding.value;
    case 'field': {
      const record = ctx.record ?? ctx.values ?? {};
      return (record as Record<string, unknown>)[binding.ref];
    }
    case 'app': {
      const app = ctx.app as Record<string, unknown> | undefined;
      return app?.[binding.ref];
    }
    case 'formula': {
      // 完整公式引擎在 core/formula（mathjs）；这里提供基础四则求值兜底
      // 实际由表单引擎在 ctx.formulaEval 注入
      if (typeof ctx.formulaEval === 'function') {
        return (ctx.formulaEval as (expr: string, scope: Record<string, unknown>) => unknown)(
          binding.expression,
          ctx.values ?? {}
        );
      }
      return undefined;
    }
    case 'query': {
      if (typeof ctx.queryEval === 'function') {
        return (ctx.queryEval as (ref: string, ctx: RenderContext) => unknown)(binding.ref, ctx);
      }
      return undefined;
    }
    default:
      return undefined;
  }
}

/** 解析节点所有绑定 → { field: value } 或直接值 */
export function resolveBindings(bindings: Binding[] | undefined, ctx: RenderContext): unknown {
  if (!bindings || bindings.length === 0) return undefined;
  if (bindings.length === 1) return resolveBinding(bindings[0], ctx);
  const out: Record<string, unknown> = {};
  for (const b of bindings) {
    if (b.source === 'field') out[b.ref] = resolveBinding(b, ctx);
    else if (b.source === 'const') out.value = b.value;
  }
  return out;
}

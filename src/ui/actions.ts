// ============================================
// UI 元设计 — 动作分发器（L3 基础版）
// ============================================
// 动作是唯一能写 store 的地方；组件只发"动作意图"。
// 占位符 @current/@field:xxx 在分发前求值。

import type { Action, RenderContext } from './types';

/** 解析动作参数占位符 */
export function resolveActionParams(
  data: Record<string, unknown>,
  ctx: RenderContext
): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(data)) {
    if (typeof v === 'string' && v.startsWith('@field:')) {
      const field = v.slice(7);
      const values = ctx.values ?? {};
      out[k] = values[field];
    } else {
      out[k] = v;
    }
  }
  return out;
}

/** 动作分发器：纯函数，副作用集中在 handlers（由 UIRoot 注入） */
export function dispatchAction(action: Action, ctx: RenderContext): void {
  switch (action.type) {
    case 'set_field':
      ctx.setValue?.(action.field, action.value);
      break;
    case 'navigate':
      (ctx as { onNavigate?: (view: string) => void }).onNavigate?.(action.view);
      break;
    case 'open_modal':
      (ctx as { onOpenModal?: (ref: string) => void }).onOpenModal?.(action.ref);
      break;
    case 'close_modal':
      (ctx as { onCloseModal?: (ref: string) => void }).onCloseModal?.(action.ref);
      break;
    case 'create_record': {
      const fn = (ctx as { onCreateRecord?: (appId: string, data: Record<string, unknown>) => void }).onCreateRecord;
      fn?.(action.appId, resolveActionParams(action.data, ctx));
      break;
    }
    case 'update_record': {
      const fn = (ctx as { onUpdateRecord?: (recordId: string, data: Record<string, unknown>) => void }).onUpdateRecord;
      fn?.(action.recordId, resolveActionParams(action.data, ctx));
      break;
    }
    case 'delete_record': {
      const fn = (ctx as { onDeleteRecord?: (recordId: string) => void }).onDeleteRecord;
      fn?.(action.recordId);
      break;
    }
    case 'transition': {
      const fn = (ctx as { onTransition?: (recordId: string, to: string) => void }).onTransition;
      fn?.(action.recordId, action.to);
      break;
    }
    case 'run_query': {
      const fn = (ctx as { onRunQuery?: (query: string) => void }).onRunQuery;
      fn?.(action.query);
      break;
    }
    case 'render_template': {
      const fn = (ctx as { onRenderTemplate?: (template: string, output?: string) => void }).onRenderTemplate;
      fn?.(action.template, action.output);
      break;
    }
    case 'custom': {
      const fn = (ctx as { onCustomAction?: (handler: string, action: Action, ctx: RenderContext) => void }).onCustomAction;
      fn?.(action.handler, action, ctx);
      break;
    }
    default:
      break;
  }
}

/** 事件绑定：节点.events 的 onClick 等 → 依次分发 */
export function handleEvent(events: Action[] | undefined, ctx: RenderContext): void {
  if (!events) return;
  for (const action of events) {
    dispatchAction(action, ctx);
  }
}

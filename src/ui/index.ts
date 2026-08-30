// ============================================
// UI 元设计 — 统一出口
// ============================================
// 对外暴露：类型 / 渲染引擎 / 注册表 / 表单引擎 / 动作 / UIRoot

export { registerBuiltins } from './register';
export { renderNode, renderTree, collectNodes, countNodes } from './render';
export { registerNode, getNode, listKinds, hasKind } from './registry';
export { resolveBinding, resolveBindings } from './bindings';
export { dispatchAction, handleEvent, resolveActionParams } from './actions';
export { buildFieldNode, validateField, validateForm, evaluateLinkage, evalCondition, fieldTypeToKind } from './form';
export { UIRoot } from './UIRoot';
export type { UINode, Binding, Action, RenderContext, NodeProps, NodeImpl, FieldLinkage } from './types';

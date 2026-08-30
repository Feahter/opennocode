// ============================================
// UI 元设计 — 布局容器（L1）
// ============================================
// 容器只懂"如何摆放 children"，不认识字段/业务。
// 7 种容器：page / tabs / tab / grid / form / detail / modal

import React from 'react';
import type { NodeProps } from './types';

function style(props: Record<string, unknown> | undefined, extra?: React.CSSProperties): React.CSSProperties {
  return { ...(props?.style as React.CSSProperties | undefined), ...extra };
}

/** 安全转字符串渲染 */
function text(v: unknown): React.ReactNode {
  if (v === null || v === undefined) return null;
  return String(v);
}

/** 统一 gap 类型（unknown → number） */
function gap(v: unknown, def: number): number {
  return typeof v === 'number' ? v : def;
}

/** 顶层页面：标题 + 工具栏 + 主体 */
export function PageNode({ node, children }: NodeProps) {
  const p = node.props ?? {};
  return (
    <div className="ui-page" data-kind="container.page" style={style(p)}>
      {p.title !== undefined && p.title !== null && (
        <div className="ui-page-header" style={{ padding: '12px 16px', borderBottom: '1px solid #e5e7eb', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <h2 style={{ margin: 0, fontSize: 18, fontWeight: 600 }}>{text(p.title)}</h2>
          {p.toolbar !== undefined && p.toolbar !== null && <div className="ui-page-toolbar">{children?.[0]}</div>}
        </div>
      )}
      <div className="ui-page-body" style={{ padding: 16 }}>{children}</div>
    </div>
  );
}

/** 页签容器 */
export function TabsNode({ node, children }: NodeProps) {
  const [active, setActive] = React.useState(0);
  const p = node.props ?? {};
  const tabs = node.children ?? [];
  return (
    <div className="ui-tabs" data-kind="container.tabs">
      <div className="ui-tabs-bar" style={{ display: 'flex', gap: 8, borderBottom: '1px solid #e5e7eb', padding: '0 8px' }}>
        {tabs.map((tab, i) => (
          <button
            key={tab.id ?? i}
            onClick={() => setActive(i)}
            className="ui-tab"
            style={{
              padding: '8px 14px', border: 'none', background: i === active ? '#3b82f6' : 'transparent',
              color: i === active ? '#fff' : '#4b5563', borderRadius: '6px 6px 0 0', cursor: 'pointer', fontSize: 13,
            }}
          >
            {text((tab.props as Record<string, unknown> | undefined)?.label ?? `页${i + 1}`)}
          </button>
        ))}
      </div>
      <div className="ui-tabs-content" style={{ padding: '12px 8px' }}>
        {children?.[active]}
      </div>
    </div>
  );
}

/** 栅格容器：流式多列 */
export function GridNode({ node, children }: NodeProps) {
  const p = node.props ?? {};
  const cols = Number(p.columns ?? 1);
  return (
    <div
      className="ui-grid"
      data-kind="container.grid"
      style={style(p, { display: 'grid', gridTemplateColumns: `repeat(${cols}, 1fr)`, gap: gap(p.gap, 12) })}
    >
      {children}
    </div>
  );
}

/** 表单容器：标题 + 字段集合（触发联动/校验由父级表单引擎处理） */
export function FormNode({ node, children }: NodeProps) {
  const p = node.props ?? {};
  const cols = Number(p.columns ?? 1);
  return (
    <div className="ui-form" data-kind="container.form" style={style(p)}>
      {p.title !== undefined && p.title !== null && (
        <div className="ui-form-title" style={{ fontSize: 15, fontWeight: 600, marginBottom: 12, color: '#374151' }}>
          {text(p.title)}
        </div>
      )}
      <div style={{ display: 'grid', gridTemplateColumns: `repeat(${cols}, 1fr)`, gap: gap(p.gap, 16) }}>
        {children}
      </div>
    </div>
  );
}

/** 详情页：字段名: 值 的只读布局 */
export function DetailNode({ node, children }: NodeProps) {
  const p = node.props ?? {};
  const cols = Number(p.columns ?? 2);
  return (
    <div className="ui-detail" data-kind="container.detail" style={style(p, { display: 'grid', gridTemplateColumns: `repeat(${cols}, 1fr)`, gap: 12 })}>
      {children}
    </div>
  );
}

/** 弹窗容器 */
export function ModalNode({ node, children }: NodeProps) {
  const p = node.props ?? {};
  const open = p.open !== false;
  if (!open) return null;
  return (
    <div className="ui-modal-overlay" style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
      <div className="ui-modal" style={{ background: '#fff', borderRadius: 12, padding: 20, minWidth: typeof p.width === 'number' ? p.width : 420, boxShadow: '0 20px 50px rgba(0,0,0,0.2)' }}>
        {p.title !== undefined && p.title !== null && <div style={{ fontSize: 16, fontWeight: 600, marginBottom: 16 }}>{text(p.title)}</div>}
        {children}
      </div>
    </div>
  );
}

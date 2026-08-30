// ============================================
// UI 元设计 — 字段控件（L2）
// ============================================
// field.* 控件：由 FieldMeta 自动映射，组件只读 value / 触发 setValue。
// 与手写 switch(field.type) 不同：加字段类型 = 注册一条。

import React from 'react';
import type { NodeProps } from './types';

interface ShellProps {
  node: NodeProps['node'];
  label?: string;
  required?: boolean;
  error?: string;
  children: React.ReactNode;
}

/** 基础输入控件外壳：label + 错误 + 控件 */
function FieldShell({ node, label, required, error, children }: ShellProps) {
  return (
    <div className="ui-field" data-kind={node.kind} style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      {label && (
        <label style={{ fontSize: 13, fontWeight: 500, color: '#374151' }}>
          {label}{required && <span style={{ color: '#ef4444', marginLeft: 2 }}>*</span>}
        </label>
      )}
      {children}
      {error && <span style={{ color: '#ef4444', fontSize: 12 }}>{error}</span>}
    </div>
  );
}

/** 从 props/bindings 推导 label */
function getLabel(p: Record<string, unknown> | undefined, node: NodeProps['node']): string | undefined {
  if (p?.label) return String(p.label);
  const b = node.bindings?.[0];
  if (b && b.source === 'field') return b.ref;
  return undefined;
}

/** 文本输入 */
export function TextField({ node, ctx }: NodeProps) {
  const p = node.props ?? {};
  const value = (ctx.value as Record<string, unknown> | undefined)?.[p.name as string];
  return (
    <FieldShell node={node} label={getLabel(p, node)} required={Boolean(p.required)} error={p.error as string | undefined}>
      <input
        type="text"
        name={String(p.name ?? '')}
        value={String(value ?? '')}
        placeholder={String(p.placeholder ?? '')}
        onChange={(e) => ctx.setValue?.(String(p.name), e.target.value)}
        style={{ padding: '6px 10px', border: '1px solid #d1d5db', borderRadius: 6, fontSize: 13, outline: 'none' }}
      />
    </FieldShell>
  );
}

/** 数字输入 */
export function NumberField({ node, ctx }: NodeProps) {
  const p = node.props ?? {};
  const value = (ctx.value as Record<string, unknown> | undefined)?.[p.name as string];
  return (
    <FieldShell node={node} label={getLabel(p, node)} required={Boolean(p.required)} error={p.error as string | undefined}>
      <input
        type="number"
        name={String(p.name ?? '')}
        value={value === undefined || value === null ? '' : String(value)}
        placeholder={String(p.placeholder ?? '')}
        min={p.min as number | undefined}
        max={p.max as number | undefined}
        onChange={(e) => ctx.setValue?.(String(p.name), e.target.value === '' ? null : Number(e.target.value))}
        style={{ padding: '6px 10px', border: '1px solid #d1d5db', borderRadius: 6, fontSize: 13, outline: 'none' }}
      />
    </FieldShell>
  );
}

/** 单选下拉 */
export function SelectField({ node, ctx }: NodeProps) {
  const p = node.props ?? {};
  const options = (p.options as { label: string; value: string }[] | undefined) ?? [];
  const value = (ctx.value as Record<string, unknown> | undefined)?.[p.name as string];
  return (
    <FieldShell node={node} label={getLabel(p, node)} required={Boolean(p.required)} error={p.error as string | undefined}>
      <select
        name={String(p.name ?? '')}
        value={value === undefined || value === null ? '' : String(value)}
        onChange={(e) => ctx.setValue?.(String(p.name), e.target.value)}
        style={{ padding: '6px 10px', border: '1px solid #d1d5db', borderRadius: 6, fontSize: 13, background: '#fff' }}
      >
        <option value="">— 请选择 —</option>
        {options.map((o) => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>
    </FieldShell>
  );
}

/** 多选（checkbox 组） */
export function MultiSelectField({ node, ctx }: NodeProps) {
  const p = node.props ?? {};
  const options = (p.options as { label: string; value: string }[] | undefined) ?? [];
  const value = (ctx.value as Record<string, unknown> | undefined)?.[p.name as string];
  const selected: string[] = Array.isArray(value) ? value.map(String) : [];
  return (
    <FieldShell node={node} label={getLabel(p, node)} error={p.error as string | undefined}>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
        {options.map((o) => {
          const checked = selected.includes(o.value);
          return (
            <label key={o.value} style={{ fontSize: 13, display: 'flex', alignItems: 'center', gap: 4, cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={checked}
                onChange={(e) => {
                  const next = e.target.checked ? [...selected, o.value] : selected.filter((s) => s !== o.value);
                  ctx.setValue?.(String(p.name), next);
                }}
              />
              {o.label}
            </label>
          );
        })}
      </div>
    </FieldShell>
  );
}

/** 日期输入 */
export function DateField({ node, ctx }: NodeProps) {
  const p = node.props ?? {};
  const value = (ctx.value as Record<string, unknown> | undefined)?.[p.name as string];
  const withTime = p.withTime === true;
  return (
    <FieldShell node={node} label={getLabel(p, node)} error={p.error as string | undefined}>
      <input
        type={withTime ? 'datetime-local' : 'date'}
        name={String(p.name ?? '')}
        value={value ? String(value) : ''}
        onChange={(e) => ctx.setValue?.(String(p.name), e.target.value)}
        style={{ padding: '6px 10px', border: '1px solid #d1d5db', borderRadius: 6, fontSize: 13 }}
      />
    </FieldShell>
  );
}

/** 复选框 */
export function CheckboxField({ node, ctx }: NodeProps) {
  const p = node.props ?? {};
  const value = (ctx.value as Record<string, unknown> | undefined)?.[p.name as string];
  return (
    <FieldShell node={node} label={getLabel(p, node)}>
      <label style={{ fontSize: 13, display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}>
        <input
          type="checkbox"
          checked={Boolean(value)}
          onChange={(e) => ctx.setValue?.(String(p.name), e.target.checked)}
        />
        {String(p.checkLabel ?? '启用')}
      </label>
    </FieldShell>
  );
}

/** 文本域（长文本） */
export function TextAreaField({ node, ctx }: NodeProps) {
  const p = node.props ?? {};
  const value = (ctx.value as Record<string, unknown> | undefined)?.[p.name as string];
  return (
    <FieldShell node={node} label={getLabel(p, node)} error={p.error as string | undefined}>
        <textarea
        name={String(p.name ?? '')}
        value={String(value ?? '')}
        rows={(p.rows as number | undefined) ?? 3}
        onChange={(e) => ctx.setValue?.(String(p.name), e.target.value)}
        style={{ padding: '6px 10px', border: '1px solid #d1d5db', borderRadius: 6, fontSize: 13, outline: 'none' }}
      />
    </FieldShell>
  );
}

/** 只读展示（详情页用） */
export function DisplayField({ node, ctx }: NodeProps) {
  const p = node.props ?? {};
  const value = (ctx.value as Record<string, unknown> | undefined)?.[p.name as string];
  return (
    <div className="ui-field-display" style={{ display: 'flex', gap: 8, padding: '4px 0' }}>
      <span style={{ color: '#6b7280', fontSize: 13, minWidth: 100 }}>{String(p.label ?? p.name ?? '')}</span>
      <span style={{ fontSize: 13, fontWeight: 500 }}>{value === null || value === undefined || value === '' ? '—' : String(value)}</span>
    </div>
  );
}

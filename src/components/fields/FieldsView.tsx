// ============================================
// 字段管理视图 - 列表 / 新建 / 编辑 / 删除（P1-6）
// ============================================

import { useState } from 'react';
import type { CSSProperties } from 'react';
import type { Field } from '../../types';
import { useAppStore } from '../../stores/appStore';
import { FieldEditor, FIELD_TYPE_LABELS, TYPE_COLORS } from './FieldEditor';

// ---------- 样式 ----------

const headerStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'flex-end',
  justifyContent: 'space-between',
  marginBottom: 20,
};

const titleStyle: CSSProperties = {
  fontSize: 20,
  fontWeight: 700,
  color: '#111827',
  marginBottom: 4,
};

const subtitleStyle: CSSProperties = {
  fontSize: 13,
  color: '#6b7280',
};

const primaryBtn: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 6,
  padding: '9px 18px',
  borderRadius: 8,
  border: 'none',
  background: '#2563eb',
  color: '#fff',
  fontSize: 14,
  fontWeight: 600,
  cursor: 'pointer',
};

const tableStyle: CSSProperties = {
  width: '100%',
  borderCollapse: 'collapse',
  background: '#fff',
  borderRadius: 10,
  overflow: 'hidden',
  boxShadow: '0 1px 3px rgba(0, 0, 0, 0.06)',
};

const thStyle: CSSProperties = {
  padding: '12px 16px',
  textAlign: 'left',
  fontSize: 12,
  fontWeight: 600,
  color: '#6b7280',
  background: '#f8fafc',
  borderBottom: '1px solid #e2e8f0',
  whiteSpace: 'nowrap',
};

const tdStyle: CSSProperties = {
  padding: '12px 16px',
  fontSize: 14,
  color: '#374151',
  borderBottom: '1px solid #f1f5f9',
};

const ghostBtn: CSSProperties = {
  padding: '5px 12px',
  borderRadius: 6,
  fontSize: 13,
  fontWeight: 500,
  border: '1px solid #d1d5db',
  background: '#fff',
  color: '#374151',
  cursor: 'pointer',
  marginLeft: 8,
};

const dangerGhostBtn: CSSProperties = {
  ...ghostBtn,
  borderColor: '#fecaca',
  color: '#dc2626',
  background: '#fff',
};

const dangerSolidBtn: CSSProperties = {
  padding: '5px 12px',
  borderRadius: 6,
  fontSize: 13,
  fontWeight: 600,
  border: '1px solid #dc2626',
  background: '#dc2626',
  color: '#fff',
  cursor: 'pointer',
  marginLeft: 8,
};

function formatTime(t: number): string {
  return new Date(t).toLocaleString('zh-CN', { hour12: false });
}

// ---------- 视图 ----------

export function FieldsView() {
  const fields = useAppStore(s => s.fields);
  const deleteField = useAppStore(s => s.deleteField);
  const [editor, setEditor] = useState<{ open: boolean; field: Field | null }>({
    open: false,
    field: null,
  });
  const [confirmId, setConfirmId] = useState<string | null>(null);

  const openCreate = () => setEditor({ open: true, field: null });
  const openEdit = (f: Field) => setEditor({ open: true, field: f });

  return (
    <div style={{ maxWidth: 960, margin: '0 auto' }}>
      {/* 头部 */}
      <div style={headerStyle}>
        <div>
          <h2 style={titleStyle}>字段管理</h2>
          <p style={subtitleStyle}>
            共 <span style={{ color: '#2563eb', fontWeight: 600 }}>{fields.length}</span> 个字段
            ，支持 12 种类型
          </p>
        </div>
        <button onClick={openCreate} style={primaryBtn}>
          <span style={{ fontSize: 16, lineHeight: 1 }}>＋</span> 新建字段
        </button>
      </div>

      {/* 空态 */}
      {fields.length === 0 ? (
        <div
          style={{
            border: '1px dashed #cbd5e1',
            borderRadius: 10,
            background: '#fafbfc',
            padding: '56px 24px',
            textAlign: 'center',
          }}
        >
          <div style={{ fontSize: 40, marginBottom: 10 }}>🗂️</div>
          <div style={{ fontSize: 15, fontWeight: 600, color: '#374151', marginBottom: 4 }}>
            暂无字段
          </div>
          <div style={{ fontSize: 13, color: '#9ca3af', marginBottom: 18 }}>
            创建第一个字段，开始搭建你的数据模型
          </div>
          <button onClick={openCreate} style={primaryBtn}>
            <span style={{ fontSize: 16, lineHeight: 1 }}>＋</span> 新建字段
          </button>
        </div>
      ) : (
        <table style={tableStyle}>
          <thead>
            <tr>
              <th style={thStyle}>标识（name）</th>
              <th style={thStyle}>标签（label）</th>
              <th style={thStyle}>类型</th>
              <th style={thStyle}>更新时间</th>
              <th style={{ ...thStyle, textAlign: 'right' }}>操作</th>
            </tr>
          </thead>
          <tbody>
            {fields.map(f => {
              const color = TYPE_COLORS[f.type];
              const confirming = confirmId === f.id;
              return (
                <tr
                  key={f.id}
                  onClick={() => openEdit(f)}
                  style={{ cursor: 'pointer', transition: 'background 0.15s' }}
                  onMouseEnter={e => {
                    e.currentTarget.style.background = '#f8fafc';
                  }}
                  onMouseLeave={e => {
                    e.currentTarget.style.background = '#fff';
                  }}
                >
                  <td style={tdStyle}>
                    <code
                      style={{
                        fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
                        fontSize: 13,
                        background: '#f1f5f9',
                        padding: '2px 8px',
                        borderRadius: 5,
                        color: '#1e293b',
                      }}
                    >
                      {f.name}
                    </code>
                  </td>
                  <td style={{ ...tdStyle, fontWeight: 500 }}>
                    {f.meta.label || '—'}
                  </td>
                  <td style={tdStyle}>
                    <span
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        padding: '3px 10px',
                        borderRadius: 9999,
                        fontSize: 12,
                        fontWeight: 500,
                        background: color.bg,
                        color: color.fg,
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {FIELD_TYPE_LABELS[f.type]}
                    </span>
                  </td>
                  <td style={{ ...tdStyle, color: '#9ca3af', fontSize: 13 }}>
                    {formatTime(f.updated_at)}
                  </td>
                  <td
                    style={{ ...tdStyle, textAlign: 'right', whiteSpace: 'nowrap' }}
                    onClick={e => e.stopPropagation()}
                  >
                    {confirming ? (
                      <>
                        <span style={{ fontSize: 12, color: '#dc2626' }}>
                          确认删除「{f.meta.label || f.name}」？
                        </span>
                        <button
                          onClick={() => {
                            deleteField(f.id);
                            setConfirmId(null);
                          }}
                          style={dangerSolidBtn}
                        >
                          删除
                        </button>
                        <button
                          onClick={() => setConfirmId(null)}
                          style={ghostBtn}
                        >
                          取消
                        </button>
                      </>
                    ) : (
                      <>
                        <button onClick={() => openEdit(f)} style={ghostBtn}>
                          编辑
                        </button>
                        <button
                          onClick={() => setConfirmId(f.id)}
                          style={dangerGhostBtn}
                        >
                          删除
                        </button>
                      </>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}

      {/* 新建 / 编辑弹窗 */}
      {editor.open && (
        <FieldEditor
          key={editor.field?.id ?? 'create'}
          initial={editor.field}
          onClose={() => setEditor({ open: false, field: null })}
        />
      )}
    </div>
  );
}

export default FieldsView;

// ============================================
// 数据表格视图 - 字段列渲染 / CRUD / 查询
// ============================================
// P1-7:
// - 列 = selectedApp 字段（按 app.fields 过滤 store.fields）
// - 单元格按字段类型渲染：text/number 直显、select 显示 option label、
//   checkbox 打勾、date/datetime 格式化
// - 动态新建表单（按字段类型生成输入）+ 双击行内编辑（失焦保存）+ 删除确认
// - 搜索走 query.filterRecords（useMemo 缓存），虚拟滚动保证 1000 行不卡顿
//
// 性能策略：filter/sort 均为纯函数 + useMemo；行渲染只输出可视窗口，
// 上下 spacer 撑高，浏览器实际只布局 ~30 行 DOM。

import { useEffect, useMemo, useRef, useState } from 'react';
import type { CSSProperties, KeyboardEvent, ReactNode } from 'react';
import { useAppStore } from '../../stores/appStore';
import type { AppRecord, Field } from '../../types';
import { filterRecords, sortRecords } from '../../core/query';
import type { SortDirection } from '../../core/query';
import { formatDate } from '../../utils/helpers';

const ROW_HEIGHT = 40; // 虚拟滚动行高（px）
const OVERSCAN = 8;    // 视口外预渲染行数（减少滚动白屏）

// AppState 接口未声明 updateRecord/deleteRecord，但 store 实际提供（见 appStore.ts）
type StoreOps = {
  updateRecord: (id: string, updates: Partial<AppRecord>) => void;
  deleteRecord: (id: string) => void;
};

interface EditState {
  recordId: string;
  fieldName: string;
}

// ============ 展示 / 解析辅助 ============

const emptyStyle: CSSProperties = { color: '#9ca3af' };
const EmptyValue = () => <span style={emptyStyle}>—</span>;

// 日期展示：兼容时间戳（number）、已格式化字符串、可转时间戳的数字字符串
function formatFieldDate(value: unknown, withTime: boolean): string {
  if (value === null || value === undefined || value === '') return '';
  const fmt = withTime ? 'YYYY-MM-DD HH:mm' : 'YYYY-MM-DD';
  if (typeof value === 'number') return formatDate(value, fmt);
  const s = String(value).replace('T', ' ');
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s;
  const ts = Number(s);
  if (!Number.isNaN(ts) && s.trim() !== '') return formatDate(ts, fmt);
  return s;
}

// 日期输入框（type=date / datetime-local）需要的值格式
function dateInputValue(value: unknown, type: 'date' | 'datetime'): string {
  const s = formatFieldDate(value, type === 'datetime');
  if (type === 'datetime') return (s.length >= 16 ? s.slice(0, 16) : s).replace(' ', 'T');
  return s.length >= 10 ? s.slice(0, 10) : s;
}

function multiSelectValues(value: unknown): string[] {
  if (Array.isArray(value)) return value.map(String);
  if (typeof value === 'string' && value.trim() !== '') {
    return value.split(',').map(v => v.trim()).filter(Boolean);
  }
  return [];
}

// 解析用户输入为字段存储值（number 空值存 null，checkbox 存布尔）
function parseFieldValue(field: Field, raw: string | boolean | string[]): unknown {
  if (field.type === 'checkbox') return Boolean(raw);
  if (field.type === 'number') {
    const s = String(raw).trim();
    if (s === '') return null;
    const n = Number(s);
    return Number.isNaN(n) ? null : n;
  }
  return String(raw);
}

function inputTypeFor(field: Field): string {
  switch (field.type) {
    case 'number': return 'number';
    case 'date': return 'date';
    case 'datetime': return 'datetime-local';
    default: return 'text';
  }
}

// 单元格只读渲染
function cellContent(field: Field, value: unknown): ReactNode {
  switch (field.type) {
    case 'select': {
      const v = value === null || value === undefined ? '' : String(value);
      if (!v) return <EmptyValue />;
      const opt = (field.meta.options ?? []).find(o => o.value === v);
      return <span>{opt ? opt.label : v}</span>;
    }
    case 'multi_select': {
      const vals = multiSelectValues(value);
      if (vals.length === 0) return <EmptyValue />;
      const opts = field.meta.options ?? [];
      return <span>{vals.map(v => opts.find(o => o.value === v)?.label ?? v).join('、')}</span>;
    }
    case 'checkbox':
      return value ? '☑' : '☐';
    case 'date':
    case 'datetime': {
      const s = formatFieldDate(value, field.type === 'datetime');
      return s ? <span>{s}</span> : <EmptyValue />;
    }
    default: {
      if (value === null || value === undefined || value === '') return <EmptyValue />;
      return <span>{String(value)}</span>;
    }
  }
}

// ============ 行内编辑单元格 ============

function initialDraft(field: Field, value: unknown): string {
  if (field.type === 'date') return dateInputValue(value, 'date');
  if (field.type === 'datetime') return dateInputValue(value, 'datetime');
  return value === null || value === undefined ? '' : String(value);
}

function EditableCell({ field, value, onCommit, onCancel }: {
  field: Field;
  value: unknown;
  onCommit: (raw: string | boolean | string[]) => void;
  onCancel: () => void;
}) {
  const cancelledRef = useRef(false);
  const [draft, setDraft] = useState<string>(() => initialDraft(field, value));
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const el = inputRef.current;
    if (el) {
      el.focus();
      el.select();
    }
  }, []);

  const cancel = () => {
    cancelledRef.current = true;
    onCancel();
  };

  // select：下拉选择，失焦提交
  if (field.type === 'select') {
    const opts = field.meta.options ?? [];
    return (
      <select
        autoFocus
        defaultValue={value === null || value === undefined ? '' : String(value)}
        onBlur={e => { if (!cancelledRef.current) onCommit(e.target.value); }}
        onKeyDown={(e: KeyboardEvent<HTMLSelectElement>) => {
          if (e.key === 'Enter') e.currentTarget.blur();
          else if (e.key === 'Escape') cancel();
        }}
        style={editInputStyle}
      >
        <option value="">—</option>
        {opts.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    );
  }

  // multi_select：复选组，每次勾选即提交
  if (field.type === 'multi_select') {
    const opts = field.meta.options ?? [];
    const current = multiSelectValues(value);
    return (
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
        {opts.map(o => (
          <label key={o.value} style={multiLabelStyle}>
            <input
              type="checkbox"
              checked={current.includes(o.value)}
              onChange={e => {
                const next = e.target.checked
                  ? [...current, o.value]
                  : current.filter(v => v !== o.value);
                onCommit(next);
              }}
            />
            {o.label}
          </label>
        ))}
      </div>
    );
  }

  // checkbox：行内直接点选（失焦提交兜底）
  if (field.type === 'checkbox') {
    return (
      <input
        autoFocus
        type="checkbox"
        checked={Boolean(value)}
        onChange={e => { if (!cancelledRef.current) onCommit(e.target.checked); }}
        style={{ width: 16, height: 16, cursor: 'pointer' }}
      />
    );
  }

  // 文本 / 数字 / 日期：输入框，Enter 提交、Esc 取消、失焦保存
  return (
    <input
      ref={inputRef}
      type={inputTypeFor(field)}
      value={draft}
      onChange={e => setDraft(e.target.value)}
      onBlur={() => { if (!cancelledRef.current) onCommit(draft); }}
      onKeyDown={(e: KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'Enter') e.currentTarget.blur();
        else if (e.key === 'Escape') cancel();
      }}
      style={editInputStyle}
    />
  );
}

// ============ 新建记录表单 ============

function CreateForm({ fields, onSubmit, onCancel }: {
  fields: Field[];
  onSubmit: (data: Record<string, unknown>) => void;
  onCancel: () => void;
}) {
  // formula / auto_id 为计算/自动字段，不参与录入
  const editable = useMemo(() => fields.filter(f => f.type !== 'formula' && f.type !== 'auto_id'), [fields]);
  const [draft, setDraft] = useState<Record<string, unknown>>(() => {
    const d: Record<string, unknown> = {};
    for (const f of editable) {
      if (f.type === 'checkbox') d[f.name] = false;
      else if (f.type === 'multi_select') d[f.name] = [];
      else if (f.meta.default !== undefined && f.meta.default !== null) {
        d[f.name] = f.type === 'date'
          ? dateInputValue(f.meta.default, 'date')
          : f.type === 'datetime'
            ? dateInputValue(f.meta.default, 'datetime')
            : f.meta.default;
      } else d[f.name] = '';
    }
    return d;
  });
  const [error, setError] = useState('');

  const set = (name: string, v: unknown) => setDraft(prev => ({ ...prev, [name]: v }));

  const isEmpty = (f: Field, v: unknown): boolean => {
    if (f.type === 'checkbox') return !v;
    if (f.type === 'multi_select') return Array.isArray(v) && v.length === 0;
    return v === '' || v === null || v === undefined;
  };

  const submit = () => {
    const missing = editable.filter(f => f.meta.required && isEmpty(f, draft[f.name]));
    if (missing.length > 0) {
      setError(`请填写必填项：${missing.map(f => f.meta.label || f.name).join('、')}`);
      return;
    }
    const data: Record<string, unknown> = {};
    for (const f of editable) {
      data[f.name] = f.type === 'number' ? parseFieldValue(f, String(draft[f.name])) : draft[f.name];
    }
    onSubmit(data);
  };

  const renderInput = (f: Field): ReactNode => {
    switch (f.type) {
      case 'number':
        return (
          <input type="number" className="input"
            value={String(draft[f.name] ?? '')}
            onChange={e => set(f.name, e.target.value)} />
        );
      case 'checkbox':
        return (
          <input type="checkbox" style={{ width: 16, height: 16, cursor: 'pointer' }}
            checked={Boolean(draft[f.name])}
            onChange={e => set(f.name, e.target.checked)} />
        );
      case 'select':
        return (
          <select className="input"
            value={String(draft[f.name] ?? '')}
            onChange={e => set(f.name, e.target.value)}>
            <option value="">—</option>
            {(f.meta.options ?? []).map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        );
      case 'multi_select': {
        const opts = f.meta.options ?? [];
        const cur = Array.isArray(draft[f.name]) ? draft[f.name] as string[] : [];
        return (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {opts.map(o => (
              <label key={o.value} style={multiLabelStyle}>
                <input
                  type="checkbox"
                  checked={cur.includes(o.value)}
                  onChange={e => set(f.name, e.target.checked ? [...cur, o.value] : cur.filter(v => v !== o.value))}
                />
                {o.label}
              </label>
            ))}
          </div>
        );
      }
      case 'date':
        return (
          <input type="date" className="input"
            value={String(draft[f.name] ?? '')}
            onChange={e => set(f.name, e.target.value)} />
        );
      case 'datetime':
        return (
          <input type="datetime-local" className="input"
            value={String(draft[f.name] ?? '')}
            onChange={e => set(f.name, e.target.value)} />
        );
      default:
        return (
          <input type="text" className="input"
            placeholder={f.meta.label || f.name}
            value={String(draft[f.name] ?? '')}
            onChange={e => set(f.name, e.target.value)} />
        );
    }
  };

  return (
    <form
      onSubmit={e => { e.preventDefault(); submit(); }}
      style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 8, padding: 16, marginBottom: 12 }}
    >
      <div style={{ fontSize: 13, fontWeight: 600, color: '#374151', marginBottom: 12 }}>
        新建记录
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 12 }}>
        {editable.map(f => (
          <div key={f.id}>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#4b5563', marginBottom: 4 }}>
              {f.meta.label || f.name}
              {f.meta.required && <span style={{ color: '#ef4444', marginLeft: 2 }}>*</span>}
            </label>
            {renderInput(f)}
          </div>
        ))}
      </div>
      {editable.length === 0 && (
        <div style={{ fontSize: 13, color: '#6b7280' }}>该应用暂无字段，请先在「字段管理」中添加字段。</div>
      )}
      {error && <div style={{ color: '#ef4444', fontSize: 13, marginTop: 8 }}>{error}</div>}
      <div style={{ marginTop: 12, display: 'flex', gap: 8 }}>
        <button type="submit" className="btn btn-primary">保存</button>
        <button type="button" className="btn btn-secondary" onClick={onCancel}>取消</button>
      </div>
    </form>
  );
}

// ============ 主视图 ============

export function DataView() {
  const selectedApp = useAppStore(s => s.selectedApp);
  const allFields = useAppStore(s => s.fields);
  const records = useAppStore(s => s.records);
  const createRecord = useAppStore(s => s.createRecord);
  const updateRecord = useAppStore(s => (s as unknown as StoreOps).updateRecord);
  const deleteRecord = useAppStore(s => (s as unknown as StoreOps).deleteRecord);

  // 当前应用的字段列（按 app.fields 过滤 store.fields）
  const appFields = useMemo<Field[]>(
    () => (selectedApp ? allFields.filter(f => selectedApp.fields.includes(f.id)) : []),
    [selectedApp, allFields]
  );

  // 查询状态
  const [keyword, setKeyword] = useState('');
  const [sortField, setSortField] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<SortDirection>('asc');

  // 交互状态
  const [showCreate, setShowCreate] = useState(false);
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const [editing, setEditing] = useState<EditState | null>(null);

  // 虚拟滚动状态
  const [scrollTop, setScrollTop] = useState(0);
  const [viewportH, setViewportH] = useState(0);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setViewportH(el.clientHeight));
    ro.observe(el);
    setViewportH(el.clientHeight);
    return () => ro.disconnect();
  }, []);

  // 查询链路：过滤 → 排序（均纯函数 + useMemo）
  const filtered = useMemo(
    () => filterRecords(records, appFields, keyword),
    [records, appFields, keyword]
  );
  const sorted = useMemo(
    () => sortRecords(filtered, sortField ?? '', sortDir),
    [filtered, sortField, sortDir]
  );

  const total = sorted.length;

  // 可视窗口切片
  const maxScroll = Math.max(0, total * ROW_HEIGHT - viewportH);
  const safeScrollTop = Math.min(scrollTop, maxScroll);
  const start = Math.max(0, Math.floor(safeScrollTop / ROW_HEIGHT) - OVERSCAN);
  const viewCount = Math.ceil(viewportH / ROW_HEIGHT) + OVERSCAN * 2;
  const end = Math.min(total, start + viewCount);
  const visible = sorted.slice(start, end);

  if (!selectedApp) {
    return <div style={{ color: '#6b7280', fontSize: 14 }}>请先在「应用管理」中选择一个应用。</div>;
  }

  const colSpan = appFields.length + 1;

  const toggleSort = (fieldName: string) => {
    if (sortField === fieldName) {
      setSortDir(d => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortField(fieldName);
      setSortDir('asc');
    }
  };

  const handleCreate = (data: Record<string, unknown>) => {
    createRecord(data);
    setShowCreate(false);
  };

  const saveCell = (record: AppRecord, fieldName: string, raw: string | boolean | string[]) => {
    const field = appFields.find(f => f.name === fieldName);
    if (!field) return;
    const value = field.type === 'multi_select' ? raw : parseFieldValue(field, raw);
    updateRecord(record.id, {
      data: { ...record.data, [fieldName]: value },
      updated_by: 'user',
    });
    setEditing(null);
  };

  const doDelete = (record: AppRecord) => {
    deleteRecord(record.id);
    setConfirmId(null);
  };

  const startEdit = (recordId: string, fieldName: string) => {
    setEditing({ recordId, fieldName });
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: 'calc(100vh - 170px)', minHeight: 320 }}>
      {/* 工具栏：搜索 + 新建 */}
      <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 12, flexWrap: 'wrap' }}>
        <input
          value={keyword}
          onChange={e => setKeyword(e.target.value)}
          placeholder={`搜索 ${appFields.length > 0 ? appFields.map(f => f.meta.label || f.name).join('、') : ''}…`}
          style={{ flex: 1, minWidth: 200, maxWidth: 360, padding: '8px 12px', border: '1px solid #e5e7eb', borderRadius: 6, fontSize: 14 }}
        />
        <button className="btn btn-primary" onClick={() => setShowCreate(v => !v)}>
          {showCreate ? '收起表单' : '+ 新建记录'}
        </button>
        <span style={{ fontSize: 13, color: '#6b7280' }}>
          {sorted.length} / {records.length} 条{keyword ? '（已过滤）' : ''}
        </span>
      </div>

      {/* 新建记录表单 */}
      {showCreate && <CreateForm fields={appFields} onSubmit={handleCreate} onCancel={() => setShowCreate(false)} />}

      {/* 虚拟滚动表格 */}
      <div
        ref={scrollRef}
        onScroll={() => { if (scrollRef.current) setScrollTop(scrollRef.current.scrollTop); }}
        style={{ flex: 1, overflow: 'auto', border: '1px solid #e5e7eb', borderRadius: 8, background: '#fff' }}
      >
        <table style={{ width: '100%', borderCollapse: 'separate', borderSpacing: 0 }}>
          <thead>
            <tr>
              {appFields.map(f => (
                <th
                  key={f.id}
                  onClick={() => toggleSort(f.name)}
                  title="点击排序"
                  style={{ ...thStyle, cursor: 'pointer', userSelect: 'none' }}
                >
                  {f.meta.label || f.name}
                  {sortField === f.name && (
                    <span style={{ fontSize: 10, color: '#2563eb' }}>{sortDir === 'asc' ? ' ▲' : ' ▼'}</span>
                  )}
                </th>
              ))}
              <th style={{ ...thStyle, width: 140, maxWidth: 140 }}>操作</th>
            </tr>
          </thead>
          <tbody>
            {total === 0 ? (
              <tr>
                <td colSpan={colSpan} style={{ height: 120, textAlign: 'center', color: '#9ca3af', fontSize: 13 }}>
                  {keyword ? `没有匹配「${keyword}」的记录` : '暂无数据，点击右上角「新建记录」添加'}
                </td>
              </tr>
            ) : (
              <>
                {start > 0 && <tr style={{ height: start * ROW_HEIGHT }}><td colSpan={colSpan} /></tr>}
                {visible.map(record => (
                  <tr key={record.id} style={{ height: ROW_HEIGHT }}>
                    {appFields.map(field => {
                      const cellValue = record.data[field.name];
                      // checkbox 单击即切换（行内编辑）
                      if (field.type === 'checkbox') {
                        return (
                          <td key={field.id} style={tdStyle}>
                            <input
                              type="checkbox"
                              checked={Boolean(cellValue)}
                              onChange={() => saveCell(record, field.name, !cellValue)}
                              style={{ width: 15, height: 15, cursor: 'pointer', verticalAlign: 'middle' }}
                            />
                          </td>
                        );
                      }
                      const isEditing = editing !== null && editing.recordId === record.id && editing.fieldName === field.name;
                      return (
                        <td
                          key={field.id}
                          style={tdStyle}
                          onDoubleClick={() => startEdit(record.id, field.name)}
                        >
                          {isEditing ? (
                            <EditableCell
                              field={field}
                              value={cellValue}
                              onCommit={raw => saveCell(record, field.name, raw)}
                              onCancel={() => setEditing(null)}
                            />
                          ) : (
                            cellContent(field, cellValue)
                          )}
                        </td>
                      );
                    })}
                    <td style={{ ...tdStyle, width: 140, maxWidth: 140 }}>
                      {confirmId === record.id ? (
                        <span style={{ display: 'inline-flex', gap: 6, alignItems: 'center' }}>
                          <span style={{ fontSize: 12, color: '#ef4444' }}>删除?</span>
                          <button style={dangerSolid} onClick={() => doDelete(record)}>确定</button>
                          <button style={ghostBtn} onClick={() => setConfirmId(null)}>取消</button>
                        </span>
                      ) : (
                        <button style={dangerGhost} onClick={() => setConfirmId(record.id)}>删除</button>
                      )}
                    </td>
                  </tr>
                ))}
                {end < total && <tr style={{ height: (total - end) * ROW_HEIGHT }}><td colSpan={colSpan} /></tr>}
              </>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ============ 样式常量 ============

const thStyle: CSSProperties = {
  position: 'sticky',
  top: 0,
  zIndex: 2,
  background: '#f9fafb',
  borderBottom: '1px solid #e5e7eb',
  padding: '0 12px',
  height: ROW_HEIGHT,
  textAlign: 'left',
  fontSize: 12,
  fontWeight: 600,
  color: '#4b5563',
  whiteSpace: 'nowrap',
};

const tdStyle: CSSProperties = {
  padding: '0 12px',
  height: ROW_HEIGHT,
  borderBottom: '1px solid #f3f4f6',
  fontSize: 13,
  color: '#1f2937',
  whiteSpace: 'nowrap',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  maxWidth: 240,
};

const editInputStyle: CSSProperties = {
  width: '100%',
  minWidth: 80,
  padding: '4px 8px',
  border: '1px solid #2563eb',
  borderRadius: 4,
  fontSize: 13,
  outline: 'none',
  background: '#fff',
};

const multiLabelStyle: CSSProperties = {
  display: 'inline-flex',
  gap: 4,
  alignItems: 'center',
  fontSize: 13,
  cursor: 'pointer',
};

const dangerGhost: CSSProperties = {
  border: 'none',
  background: 'transparent',
  color: '#ef4444',
  fontSize: 12,
  cursor: 'pointer',
  padding: '2px 4px',
  borderRadius: 4,
};

const dangerSolid: CSSProperties = {
  border: 'none',
  background: '#ef4444',
  color: '#fff',
  fontSize: 12,
  cursor: 'pointer',
  padding: '2px 8px',
  borderRadius: 4,
};

const ghostBtn: CSSProperties = {
  border: '1px solid #e5e7eb',
  background: '#fff',
  color: '#4b5563',
  fontSize: 12,
  cursor: 'pointer',
  padding: '2px 8px',
  borderRadius: 4,
};

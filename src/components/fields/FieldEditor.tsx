// ============================================
// 字段编辑器 - 新建 / 编辑共用（P1-6）
// 12 种字段类型，按类型联动展示 meta 配置
// ============================================

import { useState } from 'react';
import type { CSSProperties, ReactNode } from 'react';
import type { Field, FieldMeta, FieldType, SelectOption } from '../../types';
import { useAppStore } from '../../stores/appStore';

// ---------- 类型元信息 ----------

export const FIELD_TYPES: FieldType[] = [
  'text',
  'number',
  'select',
  'multi_select',
  'date',
  'datetime',
  'file',
  'image',
  'reference',
  'formula',
  'auto_id',
  'checkbox',
];

export const FIELD_TYPE_LABELS: Record<FieldType, string> = {
  text: '文本',
  number: '数字',
  select: '单选',
  multi_select: '多选',
  date: '日期',
  datetime: '日期时间',
  file: '文件',
  image: '图片',
  reference: '关联引用',
  formula: '公式',
  auto_id: '自动编号',
  checkbox: '布尔勾选',
};

export const TYPE_COLORS: Record<FieldType, { bg: string; fg: string }> = {
  text: { bg: '#eff6ff', fg: '#2563eb' },
  number: { bg: '#fffbeb', fg: '#d97706' },
  select: { bg: '#f5f3ff', fg: '#7c3aed' },
  multi_select: { bg: '#faf5ff', fg: '#a21caf' },
  date: { bg: '#ecfdf5', fg: '#059669' },
  datetime: { bg: '#f0fdfa', fg: '#0d9488' },
  file: { bg: '#f1f5f9', fg: '#475569' },
  image: { bg: '#fdf2f8', fg: '#db2777' },
  reference: { bg: '#ecfeff', fg: '#0891b2' },
  formula: { bg: '#fef2f2', fg: '#dc2626' },
  auto_id: { bg: '#eef2ff', fg: '#4f46e5' },
  checkbox: { bg: '#f0fdf4', fg: '#16a34a' },
};

const TYPE_HINTS: Record<FieldType, string> = {
  text: '单行文本，可设置最小 / 最大长度',
  number: '数值，可设置范围与小数精度',
  select: '单选下拉，可自定义选项',
  multi_select: '多选标签，可自定义选项',
  date: '日期（年 / 月 / 日）',
  datetime: '日期时间（年 / 月 / 日 时：分：秒）',
  file: '文件上传，可限制大小与类型',
  image: '图片上传，可限制大小与类型',
  reference: '关联其他应用记录',
  formula: '由公式计算得出，只读',
  auto_id: '按规则自动生成编号',
  checkbox: '布尔勾选，开 / 关',
};

// ---------- 样式 ----------

const overlayStyle: CSSProperties = {
  position: 'fixed',
  inset: 0,
  background: 'rgba(15, 23, 42, 0.45)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  zIndex: 60,
};

const panelStyle: CSSProperties = {
  background: '#fff',
  borderRadius: 12,
  width: 640,
  maxWidth: '92vw',
  maxHeight: '88vh',
  overflowY: 'auto',
  boxShadow: '0 20px 50px rgba(0, 0, 0, 0.18)',
};

const headerStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  padding: '16px 24px',
  borderBottom: '1px solid #e5e7eb',
};

const inputStyle: CSSProperties = {
  width: '100%',
  padding: '8px 10px',
  border: '1px solid #d1d5db',
  borderRadius: 6,
  fontSize: 14,
  outline: 'none',
  background: '#fff',
  color: '#111827',
};

const disabledInputStyle: CSSProperties = {
  ...inputStyle,
  background: '#f3f4f6',
  color: '#9ca3af',
  cursor: 'not-allowed',
};

const smallBtn: CSSProperties = {
  padding: '6px 12px',
  borderRadius: 6,
  fontSize: 13,
  fontWeight: 500,
  border: '1px solid #d1d5db',
  background: '#fff',
  color: '#374151',
  cursor: 'pointer',
};

const dangerBtn: CSSProperties = {
  padding: '6px 12px',
  borderRadius: 6,
  fontSize: 13,
  fontWeight: 500,
  border: '1px solid #fecaca',
  background: '#fef2f2',
  color: '#dc2626',
  cursor: 'pointer',
};

const primaryBtn: CSSProperties = {
  padding: '8px 20px',
  borderRadius: 6,
  fontSize: 14,
  fontWeight: 600,
  border: 'none',
  background: '#2563eb',
  color: '#fff',
  cursor: 'pointer',
};

// ---------- 编辑器表单状态 ----------

interface EditorForm {
  name: string;
  type: FieldType;
  label: string;
  required: boolean;
  unique: boolean;
  min: number | string;
  max: number | string;
  precision: number | string;
  options: SelectOption[];
  target_app: string;
  target_field: string;
  display_fields: string;
  filter: string;
  expression: string;
  prefix: string;
  sequence: number | string;
  format: string;
  max_size: number | string;
  types: string;
  defaultStr: string;
  defaultChecked: boolean;
}

function toForm(field: Field | null): EditorForm {
  const m: FieldMeta = field?.meta ?? { label: '' };
  return {
    name: field?.name ?? '',
    type: field?.type ?? 'text',
    label: m.label ?? '',
    required: !!m.required,
    unique: !!m.unique,
    min: m.min ?? '',
    max: m.max ?? '',
    precision: m.precision ?? '',
    options: (m.options ?? []).map(o => ({ ...o })),
    target_app: m.target_app ?? '',
    target_field: m.target_field ?? '',
    display_fields: (m.display_fields ?? []).join(','),
    filter: m.filter ?? '',
    expression: m.expression ?? '',
    prefix: m.prefix ?? '',
    sequence: m.sequence ?? '',
    format: m.format ?? '',
    max_size: m.max_size ?? '',
    types: (m.types ?? []).join(','),
    defaultStr:
      typeof m.default === 'string' || typeof m.default === 'number'
        ? String(m.default)
        : '',
    defaultChecked: m.default === true,
  };
}

/** 数字解析：空串 / 非法值 -> undefined */
function toNum(v: number | string): number | undefined {
  if (v === '' || v === undefined || v === null) return undefined;
  const n = Number(v);
  return Number.isFinite(n) ? n : undefined;
}

/** 从编辑器表单构建最终 FieldMeta */
function buildMeta(f: EditorForm): FieldMeta {
  const meta: FieldMeta = { label: f.label.trim() };
  if (f.required) meta.required = true;
  if (f.unique) meta.unique = true;

  switch (f.type) {
    case 'text':
      meta.min = toNum(f.min);
      meta.max = toNum(f.max);
      meta.default = f.defaultStr === '' ? undefined : f.defaultStr;
      break;
    case 'number':
      meta.min = toNum(f.min);
      meta.max = toNum(f.max);
      meta.precision = toNum(f.precision);
      meta.default =
        f.defaultStr === '' ? undefined : (toNum(f.defaultStr) ?? f.defaultStr);
      break;
    case 'select':
    case 'multi_select':
      meta.options = f.options.filter(o => o.label.trim() || o.value.trim());
      meta.default = f.defaultStr === '' ? undefined : f.defaultStr;
      break;
    case 'date':
    case 'datetime':
      meta.format = f.format.trim() || undefined;
      meta.default = f.defaultStr === '' ? undefined : f.defaultStr;
      break;
    case 'file':
    case 'image':
      meta.max_size = toNum(f.max_size);
      meta.types = f.types.split(',').map(s => s.trim()).filter(Boolean);
      break;
    case 'reference':
      meta.target_app = f.target_app.trim() || undefined;
      meta.target_field = f.target_field.trim() || undefined;
      meta.display_fields = f.display_fields
        .split(',')
        .map(s => s.trim())
        .filter(Boolean);
      meta.filter = f.filter.trim() || undefined;
      break;
    case 'formula':
      meta.expression = f.expression.trim() || undefined;
      meta.format = f.format.trim() || undefined;
      break;
    case 'auto_id':
      meta.prefix = f.prefix.trim() || undefined;
      meta.sequence = toNum(f.sequence);
      meta.format = f.format.trim() || undefined;
      break;
    case 'checkbox':
      meta.default = f.defaultChecked ? true : undefined;
      break;
  }
  return meta;
}

// 切换类型时重置类型相关配置（保留 name / label / required / unique）
function resetTypeConfigs(f: EditorForm, t: FieldType): EditorForm {
  return {
    ...f,
    type: t,
    min: '',
    max: '',
    precision: '',
    options: [],
    target_app: '',
    target_field: '',
    display_fields: '',
    filter: '',
    expression: '',
    prefix: '',
    sequence: '',
    format: '',
    max_size: '',
    types: '',
    defaultStr: '',
    defaultChecked: false,
  };
}

// updateField 未在 store 的 AppState 接口中声明（实现已存在），
// 此处通过类型收窄安全访问，不改动 appStore.ts
type FieldStore = ReturnType<typeof useAppStore.getState> & {
  updateField: (id: string, updates: Partial<Field>) => void;
};

function getStore(): FieldStore {
  return useAppStore.getState() as unknown as FieldStore;
}

// ---------- 小部件 ----------

function Row({
  label,
  required,
  hint,
  children,
}: {
  label: string;
  required?: boolean;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <div style={{ marginBottom: 14 }}>
      <div style={{ fontSize: 13, color: '#374151', marginBottom: 6, fontWeight: 500 }}>
        {label}
        {required && <span style={{ color: '#ef4444' }}> *</span>}
      </div>
      {children}
      {hint && (
        <div style={{ fontSize: 12, color: '#9ca3af', marginTop: 4 }}>{hint}</div>
      )}
    </div>
  );
}

function CheckboxLine({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        fontSize: 14,
        color: '#374151',
        cursor: 'pointer',
        marginBottom: 10,
      }}
    >
      <input
        type="checkbox"
        checked={checked}
        onChange={e => onChange(e.target.checked)}
        style={{ width: 15, height: 15, accentColor: '#2563eb', cursor: 'pointer' }}
      />
      {label}
    </label>
  );
}

function OptionsEditor({
  options,
  onChange,
}: {
  options: SelectOption[];
  onChange: (o: SelectOption[]) => void;
}) {
  const update = (i: number, patch: Partial<SelectOption>) =>
    onChange(options.map((o, idx) => (idx === i ? { ...o, ...patch } : o)));

  const validColor = (c?: string) =>
    c && /^#[0-9a-fA-F]{6}$/.test(c) ? c : '#3b82f6';

  return (
    <div>
      {options.length === 0 && (
        <div style={{ fontSize: 13, color: '#9ca3af', marginBottom: 10 }}>
          暂无选项，点击下方按钮添加
        </div>
      )}
      {options.map((opt, i) => (
        <div
          key={i}
          style={{
            display: 'flex',
            gap: 8,
            marginBottom: 8,
            alignItems: 'center',
          }}
        >
          <input
            placeholder="选项标签（显示名）"
            value={opt.label}
            onChange={e => update(i, { label: e.target.value })}
            style={{ ...inputStyle, flex: 1 }}
          />
          <input
            placeholder="选项值"
            value={opt.value}
            onChange={e => update(i, { value: e.target.value })}
            style={{ ...inputStyle, flex: 1 }}
          />
          <input
            type="color"
            title="选项颜色"
            value={validColor(opt.color)}
            onChange={e => update(i, { color: e.target.value })}
            style={{
              width: 34,
              height: 34,
              border: '1px solid #d1d5db',
              borderRadius: 6,
              padding: 2,
              background: '#fff',
              cursor: 'pointer',
              flexShrink: 0,
            }}
          />
          <button
            type="button"
            title="删除选项"
            onClick={() => onChange(options.filter((_, idx) => idx !== i))}
            style={{
              ...dangerBtn,
              padding: '6px 10px',
              flexShrink: 0,
            }}
          >
            ✕
          </button>
        </div>
      ))}
      <button
        type="button"
        onClick={() => onChange([...options, { label: '', value: '' }])}
        style={{
          ...smallBtn,
          borderStyle: 'dashed',
          color: '#2563eb',
          borderColor: '#93c5fd',
          background: '#eff6ff',
        }}
      >
        + 添加选项
      </button>
    </div>
  );
}

// ---------- 主组件 ----------

interface FieldEditorProps {
  /** null => 新建；非 null => 编辑 */
  initial: Field | null;
  onClose: () => void;
}

export function FieldEditor({ initial, onClose }: FieldEditorProps) {
  const fields = useAppStore(s => s.fields);
  const createField = useAppStore(s => s.createField);
  const [form, setForm] = useState<EditorForm>(() => toForm(initial));
  const [error, setError] = useState('');

  const isEdit = initial !== null;
  const set = (patch: Partial<EditorForm>) =>
    setForm(prev => ({ ...prev, ...patch }));

  const handleSave = () => {
    const name = form.name.trim();
    const label = form.label.trim();
    if (!name) return setError('请填写字段标识（name）');
    if (!label) return setError('请填写显示标签');
    if (!isEdit) {
      if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(name)) {
        return setError('标识只能包含字母、数字、下划线，且以字母或下划线开头');
      }
      if (fields.some(f => f.name === name)) {
        return setError(`标识「${name}」已存在，请更换`);
      }
    }
    setError('');
    const meta = buildMeta(form);

    if (isEdit && initial) {
      // 注意：storage.updateField 会整行覆写 name/type/meta/permissions，
      // 因此必须传完整字段，否则持久化数据会被清空。
      getStore().updateField(initial.id, {
        name,
        type: form.type,
        meta,
        permissions: initial.permissions,
      });
    } else {
      // createField 只写入 { label }，创建后立即补齐完整 meta
      const before = new Set(useAppStore.getState().fields.map(f => f.id));
      createField(name, form.type, label);
      const created = useAppStore
        .getState()
        .fields.find(f => !before.has(f.id));
      if (created) {
        getStore().updateField(created.id, {
          name,
          type: form.type,
          meta,
          permissions: created.permissions,
        });
      }
    }
    onClose();
  };

  const renderMetaSection = () => {
    switch (form.type) {
      case 'text':
        return (
          <>
            <Row label="默认值">
              <input
                value={form.defaultStr}
                onChange={e => set({ defaultStr: e.target.value })}
                placeholder="选填"
                style={inputStyle}
              />
            </Row>
            <div style={{ display: 'flex', gap: 12 }}>
              <div style={{ flex: 1 }}>
                <Row label="最小长度">
                  <input
                    type="number"
                    value={form.min}
                    onChange={e => set({ min: e.target.value })}
                    placeholder="不限"
                    style={inputStyle}
                  />
                </Row>
              </div>
              <div style={{ flex: 1 }}>
                <Row label="最大长度">
                  <input
                    type="number"
                    value={form.max}
                    onChange={e => set({ max: e.target.value })}
                    placeholder="不限"
                    style={inputStyle}
                  />
                </Row>
              </div>
            </div>
          </>
        );

      case 'number':
        return (
          <>
            <Row label="默认值">
              <input
                type="number"
                step="any"
                value={form.defaultStr}
                onChange={e => set({ defaultStr: e.target.value })}
                placeholder="选填"
                style={inputStyle}
              />
            </Row>
            <div style={{ display: 'flex', gap: 12 }}>
              <div style={{ flex: 1 }}>
                <Row label="最小值">
                  <input
                    type="number"
                    step="any"
                    value={form.min}
                    onChange={e => set({ min: e.target.value })}
                    placeholder="不限"
                    style={inputStyle}
                  />
                </Row>
              </div>
              <div style={{ flex: 1 }}>
                <Row label="最大值">
                  <input
                    type="number"
                    step="any"
                    value={form.max}
                    onChange={e => set({ max: e.target.value })}
                    placeholder="不限"
                    style={inputStyle}
                  />
                </Row>
              </div>
            </div>
            <Row label="小数精度" hint="小数点后保留位数，如 2 表示最多两位小数">
              <input
                type="number"
                min={0}
                max={10}
                value={form.precision}
                onChange={e => set({ precision: e.target.value })}
                placeholder="不限"
                style={inputStyle}
              />
            </Row>
          </>
        );

      case 'select':
      case 'multi_select':
        return (
          <>
            <Row label="选项" required hint="填写标签与值，颜色可选">
              <OptionsEditor
                options={form.options}
                onChange={options => set({ options })}
              />
            </Row>
            <Row label="默认值" hint="填写某个选项的值">
              <input
                value={form.defaultStr}
                onChange={e => set({ defaultStr: e.target.value })}
                placeholder="选填"
                style={inputStyle}
              />
            </Row>
          </>
        );

      case 'date':
      case 'datetime':
        return (
          <>
            <Row label="显示格式" hint="如 YYYY-MM-DD / YYYY-MM-DD HH:mm:ss">
              <input
                value={form.format}
                onChange={e => set({ format: e.target.value })}
                placeholder={form.type === 'date' ? 'YYYY-MM-DD' : 'YYYY-MM-DD HH:mm:ss'}
                style={inputStyle}
              />
            </Row>
            <Row label="默认值" hint="如 2025-01-01，留空表示当前时间由系统生成">
              <input
                value={form.defaultStr}
                onChange={e => set({ defaultStr: e.target.value })}
                placeholder="选填"
                style={inputStyle}
              />
            </Row>
          </>
        );

      case 'file':
      case 'image':
        return (
          <>
            <Row label="最大大小（KB）" hint="留空表示不限">
              <input
                type="number"
                min={0}
                value={form.max_size}
                onChange={e => set({ max_size: e.target.value })}
                placeholder="不限"
                style={inputStyle}
              />
            </Row>
            <Row label="允许类型" hint="逗号分隔，如 png,jpg,pdf；留空表示不限">
              <input
                value={form.types}
                onChange={e => set({ types: e.target.value })}
                placeholder="如 png,jpg"
                style={inputStyle}
              />
            </Row>
          </>
        );

      case 'reference':
        return (
          <>
            <Row label="目标应用" required hint="要关联的应用 ID">
              <input
                value={form.target_app}
                onChange={e => set({ target_app: e.target.value })}
                placeholder="如 app_xxx"
                style={inputStyle}
              />
            </Row>
            <Row label="目标字段" hint="关联后显示的字段名">
              <input
                value={form.target_field}
                onChange={e => set({ target_field: e.target.value })}
                placeholder="如 title"
                style={inputStyle}
              />
            </Row>
            <Row label="展示字段" hint="逗号分隔，引用时展示的字段列表">
              <input
                value={form.display_fields}
                onChange={e => set({ display_fields: e.target.value })}
                placeholder="如 title,status"
                style={inputStyle}
              />
            </Row>
            <Row label="过滤条件" hint="可选的 SQL 风格过滤表达式">
              <input
                value={form.filter}
                onChange={e => set({ filter: e.target.value })}
                placeholder="如 status = 'active'"
                style={inputStyle}
              />
            </Row>
          </>
        );

      case 'formula':
        return (
          <>
            <Row label="公式表达式" required hint="如 field_a + field_b">
              <textarea
                value={form.expression}
                onChange={e => set({ expression: e.target.value })}
                placeholder="field_a + field_b"
                rows={3}
                style={{ ...inputStyle, resize: 'vertical' }}
              />
            </Row>
            <Row label="显示格式" hint="选填">
              <input
                value={form.format}
                onChange={e => set({ format: e.target.value })}
                placeholder="如 0.00"
                style={inputStyle}
              />
            </Row>
          </>
        );

      case 'auto_id':
        return (
          <>
            <Row label="前缀" hint="编号前缀，如 INV-">
              <input
                value={form.prefix}
                onChange={e => set({ prefix: e.target.value })}
                placeholder="如 INV-"
                style={inputStyle}
              />
            </Row>
            <Row label="起始序号" hint="从该数字开始递增">
              <input
                type="number"
                min={0}
                value={form.sequence}
                onChange={e => set({ sequence: e.target.value })}
                placeholder="如 1"
                style={inputStyle}
              />
            </Row>
            <Row label="编号格式" hint="选填，如 {prefix}{year}{seq:5}">
              <input
                value={form.format}
                onChange={e => set({ format: e.target.value })}
                placeholder="如 {prefix}{year}{seq:5}"
                style={inputStyle}
              />
            </Row>
          </>
        );

      case 'checkbox':
        return (
          <Row label="默认值">
            <CheckboxLine
              label="默认勾选"
              checked={form.defaultChecked}
              onChange={v => set({ defaultChecked: v })}
            />
          </Row>
        );
    }
  };

  const typeSelectable = !isEdit;

  return (
    <div
      style={overlayStyle}
      onClick={e => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div style={panelStyle}>
        <div style={headerStyle}>
          <h3 style={{ fontSize: 16, fontWeight: 600, color: '#111827' }}>
            {isEdit ? '编辑字段' : '新建字段'}
          </h3>
          <button
            onClick={onClose}
            title="关闭"
            style={{
              border: 'none',
              background: 'transparent',
              fontSize: 18,
              color: '#9ca3af',
              cursor: 'pointer',
              padding: 4,
            }}
          >
            ✕
          </button>
        </div>

        <div style={{ padding: 20 }}>
          {/* 基本信息 */}
          <div
            style={{
              background: '#f8fafc',
              border: '1px solid #e2e8f0',
              borderRadius: 8,
              padding: 16,
              marginBottom: 16,
            }}
          >
            <div
              style={{
                fontSize: 13,
                fontWeight: 600,
                color: '#2563eb',
                marginBottom: 12,
              }}
            >
              基本信息
            </div>
            <div style={{ display: 'flex', gap: 12 }}>
              <div style={{ flex: 1 }}>
                <Row label="标识（name）" required hint="创建后不可修改，用于公式 / 引用">
                  <input
                    value={form.name}
                    onChange={e => set({ name: e.target.value })}
                    placeholder="如 title"
                    disabled={isEdit}
                    style={isEdit ? disabledInputStyle : inputStyle}
                  />
                </Row>
              </div>
              <div style={{ flex: 1 }}>
                <Row label="类型" required hint="创建后不可修改">
                  <select
                    value={form.type}
                    disabled={typeSelectable === false}
                    onChange={e =>
                      setForm(prev => resetTypeConfigs(prev, e.target.value as FieldType))
                    }
                    style={
                      typeSelectable === false
                        ? disabledInputStyle
                        : { ...inputStyle, cursor: 'pointer' }
                    }
                  >
                    {FIELD_TYPES.map(t => (
                      <option key={t} value={t}>
                        {FIELD_TYPE_LABELS[t]}（{t}）
                      </option>
                    ))}
                  </select>
                </Row>
              </div>
            </div>
            <Row label="标签（label）" required hint="界面上显示的字段名称">
              <input
                value={form.label}
                onChange={e => set({ label: e.target.value })}
                placeholder="如 标题"
                style={inputStyle}
              />
            </Row>
          </div>

          {/* 校验选项 */}
          <div style={{ display: 'flex', gap: 24, marginBottom: 16 }}>
            {form.type !== 'formula' && form.type !== 'auto_id' && (
              <CheckboxLine
                label="必填"
                checked={form.required}
                onChange={v => set({ required: v })}
              />
            )}
            {['text', 'number', 'select', 'date', 'datetime'].includes(
              form.type
            ) && (
              <CheckboxLine
                label="唯一（不允许重复）"
                checked={form.unique}
                onChange={v => set({ unique: v })}
              />
            )}
          </div>

          {/* 类型专属配置 */}
          <div
            style={{
              borderTop: '1px solid #e5e7eb',
              paddingTop: 16,
            }}
          >
            <div
              style={{
                fontSize: 13,
                fontWeight: 600,
                color: '#2563eb',
                marginBottom: 4,
              }}
            >
              字段配置
            </div>
            <div
              style={{
                fontSize: 12,
                color: '#9ca3af',
                marginBottom: 14,
              }}
            >
              {TYPE_HINTS[form.type]}
            </div>
            {renderMetaSection()}
          </div>

          {error && (
            <div
              style={{
                background: '#fef2f2',
                border: '1px solid #fecaca',
                color: '#dc2626',
                borderRadius: 6,
                padding: '8px 12px',
                fontSize: 13,
                marginBottom: 14,
              }}
            >
              {error}
            </div>
          )}

          <div
            style={{
              display: 'flex',
              justifyContent: 'flex-end',
              gap: 10,
              paddingTop: 14,
              borderTop: '1px solid #e5e7eb',
            }}
          >
            <button onClick={onClose} style={smallBtn}>
              取消
            </button>
            <button onClick={handleSave} style={primaryBtn}>
              {isEdit ? '保存修改' : '创建字段'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default FieldEditor;

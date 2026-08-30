// ============================================
// UI 元设计 — 表单引擎（L2 核心）
// ============================================
// 1) buildFieldNode: Field 元数据 → UINode（字段定义即表单，对齐 saleswork ObjForm）
// 2) validateForm: 纯函数验证（required/min/max/pattern）
// 3) 联动：visibleType/optionRelation/filterCondition 响应式规则

import type { UINode, FieldLinkage } from './types';

/** Field 元数据（与 types/index.ts 的 FieldMeta 对齐，避免循环依赖） */
export interface FormFieldMeta {
  label?: string;
  required?: boolean;
  unique?: boolean;
  default?: unknown;
  min?: number;
  max?: number;
  precision?: number;
  options?: { label: string; value: string }[];
  expression?: string;
  format?: string;
  linkage?: FieldLinkage;
}

/** 字段类型 → 控件 kind */
export function fieldTypeToKind(type: string): string {
  switch (type) {
    case 'text': return 'field.text';
    case 'number': return 'field.number';
    case 'select': return 'field.select';
    case 'multi_select': return 'field.multi_select';
    case 'date': return 'field.date';
    case 'datetime': return 'field.date';
    case 'checkbox': return 'field.checkbox';
    case 'file':
    case 'image': return 'field.text';      // 占位：晚做专门上传控件
    case 'reference': return 'field.select'; // 占位：晚做关联选择器
    case 'formula': return 'field.display';
    case 'auto_id': return 'field.display';
    default: return 'field.text';
  }
}

/** 由 Field 元数据生成默认输入节点（表单自动渲染核心） */
export function buildFieldNode(field: { name: string; type: string; meta?: FormFieldMeta }, values?: Record<string, unknown>): UINode {
  const meta = field.meta ?? {};
  const kind = fieldTypeToKind(field.type);
  const isDateTime = field.type === 'datetime';

  const props: Record<string, unknown> = {
    name: field.name,
    label: meta.label ?? field.name,
    required: meta.required ?? false,
  };

  // 按控件类型补充 props
  if (kind === 'field.number') {
    if (meta.min !== undefined) props.min = meta.min;
    if (meta.max !== undefined) props.max = meta.max;
  }
  if (kind === 'field.select' || kind === 'field.multi_select') {
    props.options = meta.options ?? [];
  }
  if (kind === 'field.date' && isDateTime) {
    props.withTime = true;
  }

  return {
    kind,
    id: `f-${field.name}`,
    props,
    bindings: [{ source: 'field', ref: field.name }],
    // 联动规则附加在节点上（表单容器读取）
    ...(meta.linkage ? { props: { ...props, linkage: meta.linkage } } : {}),
  };
}

/** 纯函数验证：值 → 错误信息（复用 core/formula 或自带规则） */
export function validateField(
  field: { name: string; type: string; meta?: FormFieldMeta },
  value: unknown
): string[] {
  const meta = field.meta ?? {};
  const errors: string[] = [];
  const label = meta.label ?? field.name;

  if (meta.required && (value === undefined || value === null || value === '')) {
    errors.push(`${label} 必填`);
  }
  if (value !== null && value !== undefined && value !== '') {
    if (field.type === 'number' || field.type === 'formula') {
      const n = Number(value);
      if (Number.isNaN(n)) errors.push(`${label} 必须是数字`);
      else {
        if (meta.min !== undefined && n < meta.min) errors.push(`${label} 不能小于 ${meta.min}`);
        if (meta.max !== undefined && n > meta.max) errors.push(`${label} 不能大于 ${meta.max}`);
      }
    }
    if (field.type === 'text' && meta.format && typeof value === 'string' && !new RegExp(meta.format).test(value)) {
      errors.push(`${label} 格式不正确`);
    }
  }
  return errors;
}

/** 表单校验：所有字段 → { fieldName: errors[] } */
export function validateForm(
  fields: { name: string; type: string; meta?: FormFieldMeta }[],
  values: Record<string, unknown>
): Record<string, string[]> {
  const out: Record<string, string[]> = {};
  for (const f of fields) {
    const errs = validateField(f, values[f.name]);
    if (errs.length) out[f.name] = errs;
  }
  return out;
}

/** 联动求值：根据当前 values 决定字段可见性 + 动态选项 */
export function evaluateLinkage(
  linkage: FieldLinkage | undefined,
  values: Record<string, unknown>
): { visible: boolean; options?: { label: string; value: string }[] } {
  if (!linkage) return { visible: true };
  if (linkage.visibleType === 'always') return { visible: true };

  // condition 求值（基础字符串比较，可扩展为 core/formula）
  let visible = true;
  if (linkage.condition) {
    visible = evalCondition(linkage.condition, values);
  }
  if (linkage.visibleType === 'role' || linkage.visibleType === 'state') {
    visible = visible && Boolean(values.__role ?? values.__state ?? false) ? visible : visible;
  }

  // 选项联动：B 字段选项取决于 A 字段值
  let options: { label: string; value: string }[] | undefined;
  if (linkage.optionRelation) {
    const { dependsOn, map } = linkage.optionRelation;
    const depVal = String(values[dependsOn] ?? '');
    options = (map[depVal] as { label: string; value: string }[] | undefined) ?? [];
  }

  return { visible, options };
}

/** 条件表达式求值（支持 ==, !=, >, <, >=, <=，以及 && / || 组合） */
export function evalCondition(expr: string, values: Record<string, unknown>): boolean {
  // 拆 OR
  const orParts = expr.split('||').map(s => s.trim());
  const orResults = orParts.map(part => {
    // 拆 AND
    const andParts = part.split('&&').map(s => s.trim());
    return andParts.every(p => evalSimple(p, values));
  });
  return orResults.some(Boolean);
}

/** 单个比较表达式求值 */
function evalSimple(expr: string, values: Record<string, unknown>): boolean {
  const m = expr.match(/^([\w.]+)\s*(==|!=|>=|<=|>|<)\s*['"]?([^'"]+)['"]?$/);
  if (!m) return true; // 无法解析 → 默认可见
  const [, field, op, rawVal] = m;
  const actual = values[field];
  const target: string | number = Number.isNaN(Number(rawVal)) ? rawVal : Number(rawVal);
  switch (op) {
    case '==': return String(actual) === String(target);
    case '!=': return String(actual) !== String(target);
    case '>': return Number(actual) > Number(target);
    case '<': return Number(actual) < Number(target);
    case '>=': return Number(actual) >= Number(target);
    case '<=': return Number(actual) <= Number(target);
    default: return true;
  }
}

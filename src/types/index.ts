// ============================================
// 核心类型定义 - TypeScript
// ============================================

// 字段类型
export type FieldType = 
  | 'text'
  | 'number'
  | 'select'
  | 'multi_select'
  | 'date'
  | 'datetime'
  | 'file'
  | 'image'
  | 'reference'
  | 'formula'
  | 'auto_id'
  | 'checkbox';

// 字段元数据
export interface FieldMeta {
  label: string;
  required?: boolean;
  unique?: boolean;
  default?: unknown;
  min?: number;
  max?: number;
  precision?: number;
  options?: SelectOption[];
  target_app?: string;
  target_field?: string;
  display_fields?: string[];
  filter?: string;
  expression?: string;
  prefix?: string;
  sequence?: number;
  format?: string;
  max_size?: number;
  types?: string[];
}

export interface SelectOption {
  label: string;
  value: string;
  color?: string;
}

// 字段权限
export interface FieldPermission {
  role_id: string;
  create: boolean;
  read: boolean;
  update: boolean;
  delete: boolean;
}

// 字段定义
export interface Field {
  id: string;
  name: string;
  type: FieldType;
  meta: FieldMeta;
  permissions: FieldPermission[];
  created_at: number;
  updated_at: number;
}

// 应用类型
export type AppType = 'data' | 'dictionary';

// 视图类型
export type ViewType = 'table' | 'list' | 'kanban' | 'form';

// 视图配置
export interface View {
  id: string;
  type: ViewType;
  name: string;
  config: Record<string, unknown>;
}

// 应用定义
export interface App {
  id: string;
  name: string;
  type: AppType;
  description?: string;
  fields: string[];  // Field IDs
  views: View[];
  state_machine?: string;
  created_at: number;
  updated_at: number;
}

// 状态定义
export interface State {
  id: string;
  label: string;
  color: string;
}

// 状态机转换
export interface Transition {
  id: string;
  from: string;
  to: string;
  trigger: 'field_change' | 'manual_action' | 'webhook' | 'schedule';
  condition?: string;
  action?: string;
}

// 状态机定义
export interface StateMachine {
  id: string;
  name: string;
  states: State[];
  transitions: Transition[];
  initial: string;
}

// 角色权限
export interface RolePermission {
  app_id: string;
  create: boolean;
  read: boolean;
  update: boolean;
  delete: boolean;
}

// 角色定义
export interface Role {
  id: string;
  name: string;
  permissions: RolePermission[];
}

// 模板占位符
export interface Placeholder {
  type: 'field' | 'system' | 'variable';
  expression: string;
  label?: string;
}

// 模板定义
export interface Template {
  id: string;
  name: string;
  type: 'rich_text';
  content: string;
  placeholders: Placeholder[];
  created_at: number;
}

// 自定义按钮
export interface CustomButton {
  id: string;
  name: string;
  icon?: string;
  action: {
    type: 'render_template' | 'navigate' | 'custom';
    template?: string;
    output?: 'pdf' | 'html' | 'email';
    preset?: Record<string, unknown>;
  };
  allowed_roles?: string[];
}

// 数据记录
export interface AppRecord {
  id: string;
  app_id: string;
  data: Record<string, unknown>;
  state?: string;
  created_by: string;
  created_at: number;
  updated_by?: string;
  updated_at: number;
}

// 公式计算结果
export interface FormulaResult {
  field_id: string;
  value: unknown;
  error?: string;
}

// 验证错误
export interface ValidationError {
  field_id: string;
  message: string;
}

// 应用视图 Props
export interface AppViewProps {
  app: App;
  records: AppRecord[];
  onCreate: (data: Record<string, unknown>) => void;
  onUpdate: (id: string, data: Record<string, unknown>) => void;
  onDelete: (id: string) => void;
  onTransition?: (record_id: string, from: string, to: string) => void;
}
// ============================================
// JSON Schema 层 - zod 定义 + 配置校验
// P2-11: agent 友好层核心 — 配置可被程序化校验
// 两类 Schema：
//   * 完整 Schema（AppSchema / FieldSchema / ViewSchema）：与 types/index.ts 领域类型一一对应
//   * Config Schema（AppConfigSchema / ...）：agent 友好，id/时间戳可省略，自动补全
// ============================================

import { z } from 'zod';
import { v4 as uuidv4 } from 'uuid';
import type { App, Field, FieldMeta, View } from '../types';

// ---------- 基础枚举 ----------

export const FIELD_TYPES = [
  'text', 'number', 'select', 'multi_select', 'date', 'datetime',
  'file', 'image', 'reference', 'formula', 'auto_id', 'checkbox',
] as const;

export const APP_TYPES = ['data', 'dictionary'] as const;
export const VIEW_TYPES = ['table', 'list', 'kanban', 'form'] as const;

export const FieldTypeSchema = z.enum(FIELD_TYPES);
export const AppTypeSchema = z.enum(APP_TYPES);
export const ViewTypeSchema = z.enum(VIEW_TYPES);

// ---------- Field ----------

export const SelectOptionSchema = z.object({
  label: z.string(),
  value: z.string(),
  color: z.string().optional(),
});

export const FieldMetaSchema = z.object({
  label: z.string(),
  required: z.boolean().optional(),
  unique: z.boolean().optional(),
  default: z.unknown().optional(),
  min: z.number().optional(),
  max: z.number().optional(),
  precision: z.number().optional(),
  options: z.array(SelectOptionSchema).optional(),
  target_app: z.string().optional(),
  target_field: z.string().optional(),
  display_fields: z.array(z.string()).optional(),
  filter: z.string().optional(),
  expression: z.string().optional(),
  prefix: z.string().optional(),
  sequence: z.number().optional(),
  format: z.string().optional(),
  max_size: z.number().optional(),
  types: z.array(z.string()).optional(),
});

export const FieldPermissionSchema = z.object({
  role_id: z.string(),
  create: z.boolean(),
  read: z.boolean(),
  update: z.boolean(),
  delete: z.boolean(),
});

/** 完整 Field — 与 types/index.ts 的 Field 一一对应 */
export const FieldSchema = z.object({
  id: z.string(),
  name: z.string(),
  type: FieldTypeSchema,
  meta: FieldMetaSchema,
  permissions: z.array(FieldPermissionSchema),
  created_at: z.number(),
  updated_at: z.number(),
});

// ---------- View ----------

/** 完整 View — 与 types/index.ts 的 View 一一对应 */
export const ViewSchema = z.object({
  id: z.string(),
  type: ViewTypeSchema,
  name: z.string(),
  config: z.record(z.string(), z.unknown()),
});

// ---------- App ----------

/** 完整 App — 与 types/index.ts 的 App 一一对应 */
export const AppSchema = z.object({
  id: z.string(),
  name: z.string(),
  type: AppTypeSchema,
  description: z.string().optional(),
  fields: z.array(z.string()), // Field IDs
  views: z.array(ViewSchema),
  state_machine: z.string().optional(),
  created_at: z.number(),
  updated_at: z.number(),
});

// ---------- Agent 友好的 Config Schema（id / 时间戳省略，自动补全） ----------

export const FieldConfigSchema = z.object({
  id: z.string().optional(),
  name: z.string().min(1, '字段名不能为空'),
  type: FieldTypeSchema,
  label: z.string().optional(), // 便捷写法，等价于 meta.label
  meta: FieldMetaSchema.partial().optional(),
  permissions: z.array(FieldPermissionSchema).optional(),
});

export const ViewConfigSchema = z.object({
  id: z.string().optional(),
  type: ViewTypeSchema,
  name: z.string().optional(),
  config: z.record(z.string(), z.unknown()).optional(),
});

export const AppConfigSchema = z.object({
  id: z.string().optional(),
  name: z.string().min(1, '应用名称不能为空'),
  type: AppTypeSchema.default('data'),
  description: z.string().optional(),
  fields: z.array(FieldConfigSchema).optional(), // 内嵌字段，创建时一并落库
  views: z.array(ViewConfigSchema).optional(),
});

export type AppConfig = z.infer<typeof AppConfigSchema>;
export type AppConfigInput = z.input<typeof AppConfigSchema>;
export type FieldConfig = z.infer<typeof FieldConfigSchema>;
export type FieldConfigInput = z.input<typeof FieldConfigSchema>;

// ---------- 校验函数 ----------

/**
 * 校验 agent 提交的应用配置（JSON）。
 * 返回 zod 原生 SafeParseReturnType：
 *   { success: true,  data: AppConfig }          —— 合法
 *   { success: false, error: ZodError }          —— 非法，error.issues 是结构化错误
 */
export function parseAppConfig(json: unknown) {
  return AppConfigSchema.safeParse(json);
}

// ---------- 配置 → 实体（补全 id / 时间戳 / 默认视图） ----------

/** FieldConfig → Field 实体 */
export function buildFieldFromConfig(cfg: FieldConfigInput): Field {
  const now = Date.now();
  const id = cfg.id ?? uuidv4();
  const meta: FieldMeta = {
    ...(cfg.meta ?? {}),
    label: cfg.label ?? cfg.meta?.label ?? cfg.name,
  };
  return {
    id,
    name: cfg.name,
    type: cfg.type,
    meta,
    permissions: cfg.permissions ?? [],
    created_at: now,
    updated_at: now,
  };
}

/** AppConfig → { App, Field[] }；内嵌字段自动建实体并写入 app.fields */
export function buildAppFromConfig(cfg: AppConfigInput): { app: App; fields: Field[] } {
  const now = Date.now();
  const appId = cfg.id ?? uuidv4();
  const fields = (cfg.fields ?? []).map(buildFieldFromConfig);
  const views: View[] =
    cfg.views && cfg.views.length > 0
      ? cfg.views.map((v) => ({
          id: v.id ?? uuidv4(),
          type: v.type,
          name: v.name ?? '默认表格',
          config: v.config ?? {},
        }))
      : [{ id: uuidv4(), type: 'table', name: '默认表格', config: {} }];

  const app: App = {
    id: appId,
    name: cfg.name,
    type: cfg.type ?? 'data',
    description: cfg.description,
    fields: fields.map((f) => f.id),
    views,
    created_at: now,
    updated_at: now,
  };
  return { app, fields };
}

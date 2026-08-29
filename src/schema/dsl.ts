// ============================================
// DSL 层 - 极简声明式语言（文本配置 ⇄ 领域对象）
// P2-11: agent 友好层 — 正则解析，不追求完整语法
//
// 语法：
//   app "客户管理" {                          // 可选：as dictionary
//     description "客户信息管理";              // 可选
//     field name:text;                        // 字段：名:类型（label 可选）
//     field amount:number label "金额";
//   }
//
// 注意：字段在 app 内声明，解析时生成独立 Field 实体（含 id），
//       App.fields 存 Field ID，与 types/index.ts 一致。
// ============================================

import type { App, Field } from '../types';
import { AppConfigSchema, buildAppFromConfig } from './json-schema';
import type { AppConfigInput, FieldConfigInput } from './json-schema';

export interface ParseDslResult {
  apps: App[];
  fields: Field[]; // 解析出的字段实体（app.fields 引用其 id）
}

// app "名称" [as 类型] { ... }
const APP_BLOCK_RE = /app\s+"((?:\\.|[^"\\])*)"(?:\s+as\s+(\w+))?\s*\{([\s\S]*?)\}/g;
// description "文本"
const DESCRIPTION_RE = /description\s+"((?:\\.|[^"\\])*)"/;
// field 名:类型 [label "文本"]
const FIELD_RE = /field\s+([^\s:;]+)\s*:\s*([^\s:;]+)(?:\s+label\s+"((?:\\.|[^"\\])*)")?/g;

function unescapeQuoted(s: string): string {
  return s.replace(/\\"/g, '"').replace(/\\\\/g, '\\');
}

/**
 * 解析 DSL 文本 → { apps, fields }
 * 非法内容（如未知字段类型）抛出 zod ZodError（结构化错误）。
 */
export function parseDsl(text: string): ParseDslResult {
  const apps: App[] = [];
  const fields: Field[] = [];

  const appRe = new RegExp(APP_BLOCK_RE.source, 'g');
  let m: RegExpExecArray | null;
  while ((m = appRe.exec(text)) !== null) {
    const body = m[3];
    const desc = DESCRIPTION_RE.exec(body);

    const fieldConfigs: FieldConfigInput[] = [];
    const fieldRe = new RegExp(FIELD_RE.source, 'g');
    let fm: RegExpExecArray | null;
    while ((fm = fieldRe.exec(body)) !== null) {
      fieldConfigs.push({
        name: fm[1],
        type: fm[2] as Field['type'], // 类型合法性由 AppConfigSchema 在 parse 时校验
        ...(fm[3] ? { label: unescapeQuoted(fm[3]) } : {}),
      });
    }

    const cfg: AppConfigInput = {
      name: unescapeQuoted(m[1]),
      type: (m[2] ?? 'data') as App['type'],
      ...(desc ? { description: unescapeQuoted(desc[1]) } : {}),
      fields: fieldConfigs,
    };

    // 校验 + 补全（id/时间戳/默认视图），非法输入抛 ZodError
    const parsed = AppConfigSchema.parse(cfg);
    const { app, fields: appFields } = buildAppFromConfig(parsed);
    apps.push(app);
    fields.push(...appFields);
  }

  return { apps, fields };
}

/**
 * 序列化 App[] → DSL 文本。
 * 传入 fields 可按名称/类型还原字段声明；缺省时以 Field ID 兜底输出。
 */
export function serializeDsl(apps: App[], fields?: Field[]): string {
  const fieldMap = new Map<string, Field>();
  for (const f of fields ?? []) fieldMap.set(f.id, f);

  const blocks: string[] = [];
  for (const app of apps) {
    const lines: string[] = [];
    lines.push(`app "${app.name}"${app.type === 'dictionary' ? ' as dictionary' : ''} {`);
    if (app.description) lines.push(`  description "${app.description}";`);
    for (const fid of app.fields) {
      const f = fieldMap.get(fid);
      const fname = f ? f.name : fid;
      const ftype = f ? f.type : 'text';
      const label = f && f.meta.label && f.meta.label !== fname ? ` label "${f.meta.label}"` : '';
      lines.push(`  field ${fname}:${ftype}${label};`);
    }
    lines.push('}');
    blocks.push(lines.join('\n'));
  }
  return blocks.join('\n\n');
}

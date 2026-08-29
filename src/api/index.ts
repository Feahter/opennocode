// ============================================
// Agent 层 - window.OpenNoCode 程序化接口
// P2-11: agent 友好 — 配置可读可写，API 写入后 UI 自动刷新
// 复用 storage.ts 底层 CRUD + appStore（zustand）状态同步
// ============================================

import * as storage from '../core/storage';
import { useAppStore } from '../stores/appStore';
import { v4 as uuidv4 } from 'uuid';
import type { App, AppRecord, Field } from '../types';
import {
  AppConfigSchema,
  FieldConfigSchema,
  buildAppFromConfig,
  buildFieldFromConfig,
  parseAppConfig as validateAppConfig,
} from '../schema/json-schema';
import type { AppConfigInput, FieldConfigInput } from '../schema/json-schema';
import { parseDsl as parseDslText, serializeDsl as serializeDslText } from '../schema/dsl';
import type { ParseDslResult } from '../schema/dsl';

// ---------- store 同步（API 写 → UI 自动刷新） ----------

function refreshFromStorage(): void {
  useAppStore.setState({
    apps: storage.getApps(),
    fields: storage.getFields(),
  });
}

function refreshRecords(appId: string): void {
  const { selectedApp } = useAppStore.getState();
  if (selectedApp && selectedApp.id === appId) {
    useAppStore.setState({ records: storage.getRecords(appId) });
  }
}

// ---------- OpenNoCode API ----------

export const OpenNoCode = {
  /** 确保存储引擎已初始化（幂等）。agent 在页面加载后调用一次即可。 */
  async init(): Promise<void> {
    await storage.initStorage();
  },

  /** 列出全部应用 */
  listApps(): App[] {
    return storage.getApps();
  },

  /**
   * 创建应用（可内嵌字段，一并落库）。
   * config 非法时抛出 zod ZodError（结构化错误，见 error.issues）。
   */
  createApp(config: AppConfigInput): App {
    const parsed = AppConfigSchema.parse(config);
    const { app, fields } = buildAppFromConfig(parsed);
    for (const f of fields) storage.createField(f);
    storage.createApp(app);
    refreshFromStorage();
    return app;
  },

  /** 列出全部字段 */
  listFields(): Field[] {
    return storage.getFields();
  },

  /** 创建字段（config 非法时抛出 zod ZodError） */
  createField(config: FieldConfigInput): Field {
    const parsed = FieldConfigSchema.parse(config);
    const field = buildFieldFromConfig(parsed);
    storage.createField(field);
    refreshFromStorage();
    return field;
  },

  /** 向指定应用写入一条记录，返回完整记录 */
  createRecord(appId: string, data: Record<string, unknown>): AppRecord {
    const now = Date.now();
    const record: AppRecord = {
      id: uuidv4(),
      app_id: appId,
      data,
      created_by: 'agent',
      created_at: now,
      updated_at: now,
    };
    storage.createRecord(record);
    refreshRecords(appId);
    return record;
  },

  /** 查询指定应用的全部记录 */
  queryRecords(appId: string): AppRecord[] {
    return storage.getRecords(appId);
  },

  /** 导出完整 Schema JSON（应用/字段/角色） */
  exportSchema(): string {
    return storage.exportSchema();
  },

  /** 导入完整 Schema JSON（覆盖式），导入后 UI 自动刷新 */
  importSchema(json: string): void {
    storage.importSchema(json);
    refreshFromStorage();
  },

  /** 解析 DSL 文本 → { apps, fields }（纯函数，不落库） */
  parseDsl(text: string): ParseDslResult {
    return parseDslText(text);
  },

  /** 序列化 App[] → DSL 文本（可选传入 fields 还原字段名/类型） */
  serializeDsl(apps: App[], fields?: Field[]): string {
    return serializeDslText(apps, fields);
  },

  /** 校验应用配置 JSON（zod safeParse，非法配置返回结构化错误） */
  parseAppConfig(json: unknown) {
    return validateAppConfig(json);
  },
};

export type OpenNoCodeAPI = typeof OpenNoCode;

/** 挂载到 window.OpenNoCode（main.tsx 在存储初始化后调用） */
export function mountOpenNoCode(): void {
  window.OpenNoCode = OpenNoCode;
}

declare global {
  interface Window {
    OpenNoCode: OpenNoCodeAPI;
  }
}

// ============================================
// 存储引擎 - SQL.js (SQLite WASM, 本地化)
// ============================================
// P0-2: wasm 本地打包（?url 导入，Vite 复制到产物，断网可用）
// P0-4: 全链路 TS 类型 + 参数化查询（防注入）+ 分块 btoa（防栈溢出）+ debounce 持久化

import initSqlJs, { Database, SqlJsStatic } from 'sql.js';
import type { App, Field, AppRecord } from '../types';
import wasmUrl from 'sql.js/dist/sql-wasm.wasm?url';

let SQL: SqlJsStatic | null = null;
let db: Database | null = null;

// debounce 持久化：连续写操作合并为一次导出
let saveTimer: number | null = null;
let dirty = false;

// 初始化
export async function initStorage(): Promise<void> {
  if (db) return; // 幂等：多次调用只初始化一次
  SQL = await initSqlJs({
    locateFile: () => wasmUrl,
  });

  // 兜底：页面卸载前立即落盘，防止 debounce 窗口内的最后写入丢失
  if (typeof window !== 'undefined') {
    const flushOnExit = () => flushSave();
    window.addEventListener('beforeunload', flushOnExit);
    window.addEventListener('pagehide', flushOnExit);
  }

  // 尝试加载本地存储
  const saved = localStorage.getItem('opennocode_db');
  if (saved) {
    try {
      const data = base64ToUint8(saved);
      db = new SQL.Database(data);
    } catch (e) {
      console.warn('本地数据库解析失败，重建空库', e);
      db = new SQL.Database();
      createTables();
    }
  } else {
    db = new SQL.Database();
    createTables();
  }
}

// 创建表
function createTables(): void {
  if (!db) return;

  // 字段表
  db.run(`
    CREATE TABLE IF NOT EXISTS fields (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      type TEXT NOT NULL,
      meta TEXT NOT NULL,
      permissions TEXT NOT NULL,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    )
  `);

  // 应用表
  db.run(`
    CREATE TABLE IF NOT EXISTS apps (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      type TEXT NOT NULL,
      description TEXT,
      fields TEXT NOT NULL,
      views TEXT NOT NULL,
      state_machine TEXT,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    )
  `);

  // 记录表
  db.run(`
    CREATE TABLE IF NOT EXISTS records (
      id TEXT PRIMARY KEY,
      app_id TEXT NOT NULL,
      data TEXT NOT NULL,
      state TEXT,
      created_by TEXT NOT NULL,
      created_at INTEGER NOT NULL,
      updated_by TEXT,
      updated_at INTEGER NOT NULL
    )
  `);

  // 状态机表
  db.run(`
    CREATE TABLE IF NOT EXISTS state_machines (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      states TEXT NOT NULL,
      transitions TEXT NOT NULL,
      initial TEXT NOT NULL
    )
  `);

  // 模板表
  db.run(`
    CREATE TABLE IF NOT EXISTS templates (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      type TEXT NOT NULL,
      content TEXT NOT NULL,
      placeholders TEXT NOT NULL,
      created_at INTEGER NOT NULL
    )
  `);

  // 角色表
  db.run(`
    CREATE TABLE IF NOT EXISTS roles (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      permissions TEXT NOT NULL
    )
  `);

  saveToLocal();
}

// 分块 btoa：避免大库 spread 栈溢出（RangeError）
function uint8ToBase64(data: Uint8Array): string {
  const CHUNK = 0x8000; // 32KB 分片
  let binary = '';
  for (let i = 0; i < data.length; i += CHUNK) {
    binary += String.fromCharCode(...data.subarray(i, i + CHUNK));
  }
  return btoa(binary);
}

function base64ToUint8(b64: string): Uint8Array {
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

// 保存到 localStorage（debounce + 分块）
export function saveToLocal(): void {
  if (!db) return;
  dirty = true;
  if (saveTimer !== null) return;
  // 300ms 合并窗口
  saveTimer = window.setTimeout(() => {
    saveTimer = null;
    if (!dirty || !db) return;
    dirty = false;
    try {
      const data = db.export();
      localStorage.setItem('opennocode_db', uint8ToBase64(data));
    } catch (e) {
      console.error('持久化失败（localStorage 可能已满）:', e);
    }
  }, 300);
}

// 立即落盘（导出/导入等关键操作调用）
export function flushSave(): void {
  if (saveTimer !== null) {
    clearTimeout(saveTimer);
    saveTimer = null;
  }
  if (!dirty || !db) return;
  dirty = false;
  try {
    const data = db.export();
    localStorage.setItem('opennocode_db', uint8ToBase64(data));
  } catch (e) {
    console.error('持久化失败（localStorage 可能已满）:', e);
  }
}

// ============================================
// 字段操作
// ============================================

export function createField(field: Field): void {
  if (!db) return;
  db.run(
    `INSERT INTO fields (id, name, type, meta, permissions, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [field.id, field.name, field.type, JSON.stringify(field.meta),
     JSON.stringify(field.permissions), field.created_at, field.updated_at]
  );
  saveToLocal();
}

export function getFields(): Field[] {
  if (!db) return [];
  const results = db.exec('SELECT * FROM fields');
  if (!results[0]) return [];

  return results[0].values.map((row: unknown[]) => ({
    id: row[0] as string,
    name: row[1] as string,
    type: row[2] as Field['type'],
    meta: JSON.parse(row[3] as string),
    permissions: JSON.parse(row[4] as string),
    created_at: row[5] as number,
    updated_at: row[6] as number,
  }));
}

export function updateField(id: string, updates: Partial<Field>): void {
  if (!db) return;
  db.run(
    `UPDATE fields SET name = ?, type = ?, meta = ?, permissions = ?, updated_at = ?
     WHERE id = ?`,
    [updates.name ?? '', updates.type ?? 'text', JSON.stringify(updates.meta ?? {}),
     JSON.stringify(updates.permissions ?? []), Date.now(), id]
  );
  saveToLocal();
}

export function deleteField(id: string): void {
  if (!db) return;
  db.run('DELETE FROM fields WHERE id = ?', [id]);
  saveToLocal();
}

// ============================================
// 应用操作
// ============================================

export function createApp(app: App): void {
  if (!db) return;
  db.run(
    `INSERT INTO apps (id, name, type, description, fields, views, state_machine, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [app.id, app.name, app.type, app.description || '',
     JSON.stringify(app.fields), JSON.stringify(app.views),
     app.state_machine || '', app.created_at, app.updated_at]
  );
  saveToLocal();
}

export function getApps(): App[] {
  if (!db) return [];
  const results = db.exec('SELECT * FROM apps');
  if (!results[0]) return [];

  return results[0].values.map((row: unknown[]) => ({
    id: row[0] as string,
    name: row[1] as string,
    type: row[2] as App['type'],
    description: row[3] as string,
    fields: JSON.parse(row[4] as string),
    views: JSON.parse(row[5] as string),
    state_machine: row[6] as string | undefined,
    created_at: row[7] as number,
    updated_at: row[8] as number,
  }));
}

export function updateApp(id: string, updates: Partial<App>): void {
  if (!db) return;
  db.run(
    `UPDATE apps SET name = ?, type = ?, description = ?, fields = ?, views = ?, state_machine = ?, updated_at = ?
     WHERE id = ?`,
    [updates.name ?? '', updates.type ?? 'data', updates.description ?? '',
     JSON.stringify(updates.fields ?? []), JSON.stringify(updates.views ?? []),
     updates.state_machine ?? '', Date.now(), id]
  );
  saveToLocal();
}

export function deleteApp(id: string): void {
  if (!db) return;
  db.run('DELETE FROM apps WHERE id = ?', [id]);
  db.run('DELETE FROM records WHERE app_id = ?', [id]);
  saveToLocal();
}

// ============================================
// 记录操作（参数化查询，防注入）
// ============================================

export function createRecord(record: AppRecord): void {
  if (!db) return;
  db.run(
    `INSERT INTO records (id, app_id, data, state, created_by, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [record.id, record.app_id, JSON.stringify(record.data),
     record.state || '', record.created_by, record.created_at, record.updated_at]
  );
  saveToLocal();
}

export function getRecords(appId: string): AppRecord[] {
  if (!db) return [];
  const stmt = db.prepare('SELECT * FROM records WHERE app_id = ?');
  stmt.bind([appId]);
  const out: AppRecord[] = [];
  while (stmt.step()) {
    const row = stmt.getAsObject();
    out.push({
      id: row.id as string,
      app_id: row.app_id as string,
      data: JSON.parse(row.data as string),
      state: row.state as string | undefined,
      created_by: row.created_by as string,
      created_at: row.created_at as number,
      updated_by: row.updated_by as string | undefined,
      updated_at: row.updated_at as number,
    });
  }
  stmt.free();
  return out;
}

export function updateRecord(id: string, updates: Partial<AppRecord>): void {
  if (!db) return;
  const sets: string[] = [];
  const params: Array<string | number> = [];
  if (updates.data !== undefined) { sets.push('data = ?'); params.push(JSON.stringify(updates.data)); }
  if (updates.state !== undefined) { sets.push('state = ?'); params.push(updates.state); }
  if (updates.updated_by !== undefined) { sets.push('updated_by = ?'); params.push(updates.updated_by); }
  sets.push('updated_at = ?');
  params.push(Date.now(), id);
  db.run(`UPDATE records SET ${sets.join(', ')} WHERE id = ?`, params as never);
  saveToLocal();
}

export function deleteRecord(id: string): void {
  if (!db) return;
  db.run('DELETE FROM records WHERE id = ?', [id]);
  saveToLocal();
}

// ============================================
// 批量操作
// ============================================

export function bulkDeleteRecords(ids: string[]): void {
  if (!db || ids.length === 0) return;
  const placeholders = ids.map(() => '?').join(',');
  db.run(`DELETE FROM records WHERE id IN (${placeholders})`, ids);
  saveToLocal();
}

export function bulkUpdateState(ids: string[], newState: string): void {
  if (!db || ids.length === 0) return;
  const placeholders = ids.map(() => '?').join(',');
  db.run(
    `UPDATE records SET state = ?, updated_at = ? WHERE id IN (${placeholders})`,
    [newState, Date.now(), ...ids]
  );
  saveToLocal();
}

// ============================================
// 导出 / 导入
// ============================================

export function exportSchema(): string {
  if (!db) return '{}';
  return JSON.stringify({
    fields: getFields(),
    apps: getApps(),
    roles: db.exec('SELECT * FROM roles')[0]?.values || [],
  }, null, 2);
}

export function importSchema(json: string): void {
  try {
    const data = JSON.parse(json);

    // 清空现有数据
    if (db) {
      db.run('DELETE FROM fields');
      db.run('DELETE FROM apps');
      db.run('DELETE FROM records');
    }

    // 导入字段
    data.fields?.forEach((f: Field) => createField(f));

    // 导入应用
    data.apps?.forEach((a: App) => createApp(a));

    flushSave();
  } catch (e) {
    console.error('Import failed:', e);
    throw e;
  }
}

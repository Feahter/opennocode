// 存储 stub：仅用于 node 冒烟验证 agent 层（不入库，内存数组）
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db: Record<string, any[]> = { fields: [], apps: [], records: [] };

export async function initStorage(): Promise<void> {}
export function saveToLocal(): void {}
export function flushSave(): void {}
export function getFields() { return db.fields; }
export function getApps() { return db.apps; }
export function createField(f: any) { db.fields.push(f); }
export function createApp(a: any) { db.apps.push(a); }
export function createRecord(r: any) { db.records.push(r); }
export function getRecords(appId: string) { return db.records.filter((r) => r.app_id === appId); }
export function exportSchema() { return JSON.stringify({ fields: db.fields, apps: db.apps }, null, 2); }
export function importSchema(json: string) {
  const data = JSON.parse(json);
  db.fields = data.fields ?? [];
  db.apps = data.apps ?? [];
  db.records = [];
}
export function updateApp() {}
export function updateField() {}
export function updateRecord() {}
export function deleteApp() {}
export function deleteField() {}
export function deleteRecord() {}
export function bulkDeleteRecords() {}
export function bulkUpdateState() {}

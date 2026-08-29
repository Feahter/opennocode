// ============================================
// 数据视图 - 导出 / 导入（P1-10）
// ============================================
// 导出：storage.exportSchema() → 下载 JSON 文件
// 导入：选择 JSON 文件 → storage.importSchema(json) → 刷新 store（重新从存储加载）

import { useRef, useState } from 'react';
import * as storage from '../../core/storage';
import { useAppStore } from '../../stores/appStore';

export default function DataView() {
  const fileRef = useRef<HTMLInputElement>(null);
  const [notice, setNotice] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);

  // 导出：exportSchema() → Blob 下载
  const handleExport = () => {
    try {
      const json = storage.exportSchema();
      const blob = new Blob([json], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `opennocode-export-${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      setNotice({ type: 'ok', text: `导出成功（${(blob.size / 1024).toFixed(1)} KB）` });
    } catch (e) {
      console.error('导出失败:', e);
      setNotice({ type: 'err', text: '导出失败，请查看控制台' });
    }
  };

  // 导入：读取 JSON → importSchema → 刷新 store
  const handleImport = async (file: File | undefined) => {
    if (!file) return;
    // 导入会清空并覆盖现有数据，先确认
    if (!window.confirm('导入将覆盖当前所有数据，确定继续？')) {
      if (fileRef.current) fileRef.current.value = '';
      return;
    }
    try {
      const text = await file.text();
      storage.importSchema(text);
      // 刷新：从存储重新加载 apps / fields / selectedApp / records
      const state = useAppStore.getState();
      const apps = storage.getApps();
      const selectedApp = apps.find(a => a.id === state.selectedApp?.id) ?? null;
      useAppStore.setState({
        apps,
        fields: storage.getFields(),
        selectedApp,
        records: selectedApp ? storage.getRecords(selectedApp.id) : [],
      });
      setNotice({ type: 'ok', text: `导入成功：${file.name}` });
    } catch (e) {
      console.error('导入失败:', e);
      setNotice({ type: 'err', text: `导入失败：${e instanceof Error ? e.message : String(e)}` });
    } finally {
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  return (
    <div>
      <h3 style={{ marginBottom: 12 }}>数据视图</h3>
      <p style={{ color: '#6b7280', fontSize: 13, marginBottom: 16 }}>
        导入 / 导出应用与字段结构（JSON 文件）
      </p>

      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
        <button onClick={handleExport} style={buttonStyle}>
          导出 JSON
        </button>
        <button
          onClick={() => fileRef.current?.click()}
          style={{ ...buttonStyle, background: '#059669' }}
        >
          导入 JSON
        </button>
        <input
          ref={fileRef}
          type="file"
          accept=".json,application/json"
          onChange={e => handleImport(e.target.files?.[0])}
          style={{ display: 'none' }}
        />
        {notice && (
          <span style={{ fontSize: 13, color: notice.type === 'ok' ? '#059669' : '#dc2626' }}>
            {notice.text}
          </span>
        )}
      </div>
    </div>
  );
}

const buttonStyle: React.CSSProperties = {
  padding: '8px 16px',
  background: '#2563eb',
  color: 'white',
  border: 'none',
  borderRadius: 6,
  cursor: 'pointer',
  fontSize: 14,
  fontWeight: 500,
};

// ============================================
// 数据视图容器 - 表格 / 看板切换 + 导入导出工具栏
// ============================================
// P1-7 TableView（表格 CRUD + 虚拟滚动）
// P1-8 KanbanView（看板 + dnd 拖拽 + 状态机）
// P1-10 ExportImport（导入导出工具栏）
// 三者组合为完整数据视图；无选中应用时显示引导。

import { useState, useCallback } from 'react';
import { useAppStore } from '../../stores/appStore';
import { DataView as TableView } from './TableView';
import { KanbanView } from './KanbanView';
import ExportImport from './ExportImport';

type ViewMode = 'table' | 'kanban';

export function DataView() {
  const selectedApp = useAppStore(s => s.selectedApp);
  const [mode, setMode] = useState<ViewMode>('table');

  const switchTable = useCallback(() => setMode('table'), []);
  const switchKanban = useCallback(() => setMode('kanban'), []);

  if (!selectedApp) {
    return (
      <div style={{ textAlign: 'center', padding: '80px 24px', color: '#6b7280' }}>
        <div style={{ fontSize: 40, marginBottom: 16 }}>🗂️</div>
        <p style={{ fontSize: 15, fontWeight: 600, marginBottom: 6 }}>未选择应用</p>
        <p style={{ fontSize: 13 }}>从「应用管理」选择一个应用查看数据</p>
      </div>
    );
  }

  return (
    <div>
      {/* 工具栏：视图切换 + 导入导出 */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <div style={{ display: 'flex', gap: 8 }}>
          <button
            onClick={switchTable}
            style={{
              padding: '6px 14px', borderRadius: 6, cursor: 'pointer', border: 'none', fontSize: 13,
              background: mode === 'table' ? '#2563eb' : '#e5e7eb',
              color: mode === 'table' ? '#fff' : '#374151', fontWeight: 500,
            }}
          >
            表格
          </button>
          <button
            onClick={switchKanban}
            style={{
              padding: '6px 14px', borderRadius: 6, cursor: 'pointer', border: 'none', fontSize: 13,
              background: mode === 'kanban' ? '#2563eb' : '#e5e7eb',
              color: mode === 'kanban' ? '#fff' : '#374151', fontWeight: 500,
            }}
          >
            看板
          </button>
        </div>
        <ExportImport />
      </div>

      {/* 视图主体 */}
      {mode === 'table' ? <TableView /> : <KanbanView />}
    </div>
  );
}

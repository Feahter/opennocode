// 应用管理视图（P1-5）
// 职责：应用列表 / 新建 / 删除（带确认）/ 点击进入数据视图 / 空状态
import { useState } from 'react';
import { format } from 'date-fns';
import { useAppStore } from '../../stores/appStore';
import type { App, AppType } from '../../types';

const TYPE_LABELS: Record<AppType, string> = {
  data: '数据应用',
  dictionary: '字典应用',
};

const TYPE_TAG_CLASS: Record<AppType, string> = {
  data: 'tag-blue',
  dictionary: 'tag-green',
};

export function AppsView() {
  const { apps, createApp, deleteApp, selectApp } = useAppStore();
  const [showForm, setShowForm] = useState(false);

  const handleDelete = (app: App) => {
    if (window.confirm(`确定删除应用「${app.name}」吗？该应用下的字段与数据将一并删除，此操作不可恢复。`)) {
      deleteApp(app.id);
    }
  };

  return (
    <div>
      {/* 工具栏：标题 + 新建按钮 */}
      <div className="toolbar" style={{ justifyContent: 'space-between', alignItems: 'center' }}>
        <h2 style={{ fontSize: 20, fontWeight: 700 }}>应用管理</h2>
        <button className="btn btn-primary" onClick={() => setShowForm(true)}>
          + 新建应用
        </button>
      </div>

      {/* 空状态 */}
      {apps.length === 0 ? (
        <div className="card" style={{ textAlign: 'center', padding: '56px 24px' }}>
          <div style={{ fontSize: 36, marginBottom: 12 }}>📦</div>
          <p style={{ fontSize: 15, color: '#374151', fontWeight: 600, marginBottom: 6 }}>
            还没有应用
          </p>
          <p style={{ fontSize: 13, color: '#6b7280', marginBottom: 20 }}>
            点击右上角「新建应用」创建你的第一个应用，管理字段与数据
          </p>
          <button className="btn btn-primary" onClick={() => setShowForm(true)}>
            + 新建应用
          </button>
        </div>
      ) : (
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          <table className="table">
            <thead>
              <tr>
                <th>名称</th>
                <th style={{ width: 110 }}>类型</th>
                <th>描述</th>
                <th style={{ width: 90 }}>字段数</th>
                <th style={{ width: 160 }}>创建时间</th>
                <th style={{ width: 80 }}>操作</th>
              </tr>
            </thead>
            <tbody>
              {apps.map((app) => (
                <tr
                  key={app.id}
                  onClick={() => selectApp(app)}
                  style={{ cursor: 'pointer' }}
                  title="点击进入数据视图"
                >
                  <td>
                    <span style={{ fontWeight: 600, color: '#1d4ed8' }}>{app.name}</span>
                  </td>
                  <td>
                    <span className={`tag ${TYPE_TAG_CLASS[app.type] ?? 'tag-gray'}`}>
                      {TYPE_LABELS[app.type] ?? app.type}
                    </span>
                  </td>
                  <td style={{ color: '#6b7280', fontSize: 13 }}>
                    {app.description || <span style={{ color: '#d1d5db' }}>—</span>}
                  </td>
                  <td style={{ color: '#374151' }}>{app.fields.length}</td>
                  <td style={{ color: '#6b7280', fontSize: 13 }}>
                    {format(app.created_at, 'yyyy-MM-dd HH:mm')}
                  </td>
                  <td>
                    <button
                      className="btn btn-secondary"
                      style={{ padding: '4px 10px', fontSize: 13, color: '#dc2626' }}
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDelete(app);
                      }}
                    >
                      删除
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {showForm && (
        <NewAppForm
          onClose={() => setShowForm(false)}
          onCreate={(name, description) => {
            createApp(name, description);
            setShowForm(false);
          }}
        />
      )}
    </div>
  );
}

// 新建应用表单（本地模态，样式与 App.tsx 的 Modal 一致）
function NewAppForm({
  onClose,
  onCreate,
}: {
  onClose: () => void;
  onCreate: (name: string, description: string) => void;
}) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.5)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 50,
      }}
      onClick={onClose}
    >
      <div
        style={{
          background: 'white',
          padding: 24,
          borderRadius: 8,
          maxWidth: 400,
          width: '90%',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 16 }}>新建应用</h3>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (!name.trim()) return;
            onCreate(name.trim(), description.trim());
          }}
        >
          <input
            className="input"
            placeholder="应用名称（必填）"
            value={name}
            onChange={(e) => setName(e.target.value)}
            autoFocus
            style={{ marginBottom: 12 }}
          />
          <textarea
            className="input"
            placeholder="应用描述（可选）"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            style={{ marginBottom: 20, minHeight: 80, resize: 'vertical' }}
          />
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
            <button type="button" className="btn btn-secondary" onClick={onClose}>
              取消
            </button>
            <button type="submit" className="btn btn-primary" disabled={!name.trim()}>
              创建
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

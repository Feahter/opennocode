import { useEffect } from 'react';
import { useAppStore } from './stores/appStore';
import { AppsView, FieldsView, DataView, Modal } from './components/index';

export function App() {
  const {
    view,
    showModal,
    isLoading,
    init,
    setView,
    setShowModal,
    createApp,
    createField,
  } = useAppStore();

  // 唯一初始化入口（main.tsx 只渲染，不重复 init）
  useEffect(() => {
    init();
  }, [init]);

  if (isLoading) {
    return <div style={{ padding: 20 }}>Loading...</div>;
  }

  return (
    <div className="app-container">
      {/* 侧边栏 */}
      <div className="sidebar">
        <h1 style={{ fontSize: 18, fontWeight: 700, marginBottom: 24 }}>OpenNoCode</h1>

        <nav style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <button
            onClick={() => setView('apps')}
            style={{
              padding: '8px 12px',
              borderRadius: 6,
              background: view === 'apps' ? '#dbeafe' : 'transparent',
              color: view === 'apps' ? '#1d4ed8' : '#374151',
              textAlign: 'left',
              border: 'none',
              cursor: 'pointer',
            }}
          >
            应用管理
          </button>
          <button
            onClick={() => setView('fields')}
            style={{
              padding: '8px 12px',
              borderRadius: 6,
              background: view === 'fields' ? '#dbeafe' : 'transparent',
              color: view === 'fields' ? '#1d4ed8' : '#374151',
              textAlign: 'left',
              border: 'none',
              cursor: 'pointer',
            }}
          >
            字段管理
          </button>
        </nav>
      </div>

      {/* 主内容区 */}
      <div className="main-content">
        {view === 'apps' && <AppsView />}
        {view === 'fields' && <FieldsView />}
        {view === 'data' && <DataView />}
      </div>

      {/* 模态框 */}
      {showModal && (
        <Modal onClose={() => setShowModal(null)}>
          {showModal === 'app' && (
            <form onSubmit={(e) => {
              e.preventDefault();
              const formData = new FormData(e.currentTarget);
              createApp(formData.get('name') as string, formData.get('description') as string);
            }}>
              <h2 style={{ marginBottom: 16 }}>创建应用</h2>
              <input name="name" placeholder="应用名称" required style={inputStyle} />
              <textarea name="description" placeholder="描述" style={{ ...inputStyle, minHeight: 80 }} />
              <button type="submit" style={buttonStyle}>创建</button>
            </form>
          )}
          {showModal === 'field' && (
            <form onSubmit={(e) => {
              e.preventDefault();
              const formData = new FormData(e.currentTarget);
              createField(
                formData.get('name') as string,
                formData.get('type') as any,
                formData.get('label') as string
              );
            }}>
              <h2 style={{ marginBottom: 16 }}>创建字段</h2>
              <input name="name" placeholder="字段名" required style={inputStyle} />
              <input name="label" placeholder="显示标签" required style={inputStyle} />
              <select name="type" style={inputStyle}>
                <option value="text">文本</option>
                <option value="number">数字</option>
                <option value="date">日期</option>
                <option value="boolean">布尔</option>
              </select>
              <button type="submit" style={buttonStyle}>创建</button>
            </form>
          )}
        </Modal>
      )}
    </div>
  );
}

const inputStyle = {
  width: '100%',
  padding: '8px 12px',
  marginBottom: 12,
  borderRadius: 6,
  border: '1px solid #e5e7eb',
  fontSize: 14,
};

const buttonStyle = {
  width: '100%',
  padding: '10px',
  background: '#2563eb',
  color: 'white',
  border: 'none',
  borderRadius: 6,
  cursor: 'pointer',
  fontSize: 14,
  fontWeight: 500,
};

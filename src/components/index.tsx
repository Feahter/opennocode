// 组件统一出口
// P0-3: 占位视图（P1 各任务在 components/{apps,fields,data}/ 建真实实现后，替换导入路径）

import type { ReactNode } from 'react';

export function AppsView() {
  return <div>应用管理（待 P1 实现）</div>;
}

export function FieldsView() {
  return <div>字段管理（待 P1 实现）</div>;
}

export function DataView() {
  return <div>数据视图（待 P1 实现）</div>;
}

export function Modal({ children, onClose }: { children: ReactNode; onClose: () => void }) {
  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      background: 'rgba(0,0,0,0.5)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 50,
    }} onClick={onClose}>
      <div style={{
        background: 'white',
        padding: 24,
        borderRadius: 8,
        maxWidth: 400,
        width: '90%',
      }} onClick={e => e.stopPropagation()}>
        {children}
      </div>
    </div>
  );
}

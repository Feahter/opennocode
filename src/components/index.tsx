// 组件统一出口
// P1 各视图已实现：apps / fields / data（表格+看板+导入导出）

import type { ReactNode } from 'react';

export { AppsView } from './apps/AppsView';
export { FieldsView } from './fields/FieldsView';
export { DataView } from './data/index';

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

import './index.css';
import { App } from './App';
import { createRoot } from 'react-dom/client';

// 初始化并渲染
const rootEl = document.getElementById('root')!;
rootEl.innerHTML = '<div style="padding:20px">加载中...</div>';

import('./core/storage').then(({ initStorage }) => {
  initStorage().then(() => {
    // 存储初始化成功，渲染 App
    rootEl.innerHTML = '';
    createRoot(rootEl).render(<App />);
  }).catch(err => {
    console.error('初始化失败:', err);
    rootEl.innerHTML = '<div style="padding:20px;color:red">初始化失败: ' + err.message + '</div>';
  });
});
import './index.css';
import { App } from './App';
import { createRoot } from 'react-dom/client';
import { initStorage } from './core/storage';
import { mountOpenNoCode } from './api';

// 唯一入口：
// 1. 初始化存储引擎（幂等；App 内 store.init 也会调用，此处先备好）
// 2. 挂载 window.OpenNoCode（agent 友好层，初始化后可用）
// 3. 渲染 React 树（数据初始化统一在 store.init()，App useEffect）
async function bootstrap(): Promise<void> {
  try {
    await initStorage();
  } catch (e) {
    console.error('存储初始化失败:', e);
  }
  mountOpenNoCode();
  const rootEl = document.getElementById('root')!;
  createRoot(rootEl).render(<App />);
}

bootstrap();

import './index.css';
import { App } from './App';
import { createRoot } from 'react-dom/client';

// 唯一入口：只渲染，数据初始化统一在 store.init()（App useEffect）
const rootEl = document.getElementById('root')!;
createRoot(rootEl).render(<App />);

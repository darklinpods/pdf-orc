import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import './index.css';
// 副作用导入：初始化 pdf.js worker 单例（GlobalWorkerOptions.workerPort）。
import './render/pdfjs';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

import React from 'react';
import ReactDOM from 'react-dom/client';
import { registerSW } from 'virtual:pwa-register';
import { initPwaInstallCapture } from './utils/pwaInstallUtils';
import App from './App.tsx';
import './index.css';

initPwaInstallCapture();

if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
  try {
    registerSW({ immediate: true });
  } catch {
    // Non-blocking SW registration in restricted environments
  }
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

import { Capacitor } from '@capacitor/core';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import { ErrorBoundary } from './components/ErrorBoundary.tsx';
import './index.css';

// Guard against silent mobile webview failures & unregister any stale PWA Service Workers on native Capacitor
if (typeof window !== 'undefined') {
  window.addEventListener('unhandledrejection', (event) => {
    console.warn('Agro Planner Unhandled Promise Rejection:', event.reason);
  });
  window.addEventListener('error', (event) => {
    console.error('Agro Planner Global Error:', event.error || event.message);
  });

  if (Capacitor.isNativePlatform() && 'serviceWorker' in navigator) {
    navigator.serviceWorker
      .getRegistrations()
      .then((registrations) => {
        for (const reg of registrations) {
          void reg.unregister();
        }
      })
      .catch(() => { });
  }
}

createRoot(document.getElementById('root')!).render(
  <ErrorBoundary>
    <App />
  </ErrorBoundary>
);

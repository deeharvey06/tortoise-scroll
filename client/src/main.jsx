import React from 'react';
import ReactDOM from 'react-dom/client';
import App from '@/App';
import ErrorBoundary from '@/components/ErrorBoundary';
import useAuthStore from '@/store/useAuthStore';
import '@/styles/global.scss';

// Bootstrap session ownership once, outside the React render lifecycle.
const handleAuthEvent = (event) =>
  useAuthStore.getState().setAuthStatus(event.detail);

window.addEventListener('tortoise:auth', handleAuthEvent);

void useAuthStore.getState().initialize();

if (import.meta.hot) {
  import.meta.hot.dispose(() =>
    window.removeEventListener('tortoise:auth', handleAuthEvent)
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </React.StrictMode>
);

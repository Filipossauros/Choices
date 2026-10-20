import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './ui/App';
import './i18n';
import './index.css';

/**
 * Show a deployed update on the first visit, not the second.
 *
 * The app is a PWA: a service worker precaches the shell and serves it offline.
 * It is registered with `skipWaiting` + `clientsClaim`, so a new build takes
 * control as soon as it is fetched — but the HTML and the scripts for the visit
 * that fetched it were already served from the old cache. Without this, every
 * deploy is invisible until the next reload, and a feature that shipped reads
 * to the user as a feature that is missing.
 *
 * Only reload when a controller was already in place: on a first-ever visit the
 * worker claims the page too, and reloading then would be a pointless flash.
 */
if ('serviceWorker' in navigator) {
  const hadController = navigator.serviceWorker.controller != null;
  let reloading = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (!hadController || reloading) return;
    reloading = true;
    window.location.reload();
  });
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);

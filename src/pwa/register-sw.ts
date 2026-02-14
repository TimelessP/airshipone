export function registerServiceWorker(): void {
  if (!('serviceWorker' in navigator)) {
    return;
  }

  window.addEventListener('load', async () => {
    try {
      const registration = await navigator.serviceWorker.register('./sw.js', {
        scope: './',
        updateViaCache: 'none'
      });

      const promptUpdate = (worker: ServiceWorker) => {
        worker.postMessage({ type: 'airshipone-skip-waiting' });
      };

      const trackInstalling = (worker: ServiceWorker | null) => {
        if (!worker) return;
        worker.addEventListener('statechange', () => {
          if (worker.state === 'installed' && navigator.serviceWorker.controller) {
            promptUpdate(worker);
          }
        });
      };

      if (registration.installing) {
        trackInstalling(registration.installing);
      }

      registration.addEventListener('updatefound', () => {
        trackInstalling(registration.installing);
      });

      navigator.serviceWorker.addEventListener('controllerchange', () => {
        window.location.reload();
      });
    } catch (error) {
      console.error('Service worker registration failed', error);
    }
  });
}

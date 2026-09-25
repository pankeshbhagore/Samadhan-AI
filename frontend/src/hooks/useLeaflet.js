import { useState, useEffect } from 'react';

let loadingPromise = null;

/**
 * Loads the Leaflet JS + CSS from CDN exactly once, and resolves only after
 * `window.L` is genuinely available. The previous implementation rendered
 * a <script> tag inline in JSX and assumed `window.L` would be ready by the
 * time the component's other effects ran — a race condition that produced
 * a blank map whenever the script hadn't finished downloading yet (very
 * common on first load or slow connections). This hook returns a `ready`
 * flag that components can safely gate their map-initialization code on.
 */
function loadLeaflet() {
  if (window.L) return Promise.resolve(window.L);
  if (loadingPromise) return loadingPromise;

  loadingPromise = new Promise((resolve, reject) => {
    if (!document.querySelector('link[data-leaflet]')) {
      const link = document.createElement('link');
      link.rel = 'stylesheet';
      link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
      link.setAttribute('data-leaflet', 'true');
      document.head.appendChild(link);
    }

    const existing = document.querySelector('script[data-leaflet]');
    if (existing) {
      existing.addEventListener('load', () => resolve(window.L));
      existing.addEventListener('error', reject);
      return;
    }

    const script = document.createElement('script');
    script.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
    script.setAttribute('data-leaflet', 'true');
    script.onload = () => resolve(window.L);
    script.onerror = () => reject(new Error('Failed to load Leaflet from CDN'));
    document.body.appendChild(script);
  });

  return loadingPromise;
}

export default function useLeaflet() {
  const [ready, setReady] = useState(Boolean(window.L));
  const [error, setError] = useState(null);

  useEffect(() => {
    if (window.L) { setReady(true); return; }
    let cancelled = false;
    loadLeaflet()
      .then(() => { if (!cancelled) setReady(true); })
      .catch((err) => { if (!cancelled) setError(err); });
    return () => { cancelled = true; };
  }, []);

  return { ready, error, L: window.L };
}

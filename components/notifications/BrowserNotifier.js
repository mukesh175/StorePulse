'use client';

import { useEffect, useRef } from 'react';
import { fetchJson } from '@/lib/utils/fetchJson';

const POLL_MS = 60_000;
const STORAGE_KEY = 'storepulse:lastNotifiedAt';

/**
 * Desktop notifications for new critical and warning alerts while StorePulse
 * is open. Mounted only when the merchant has enabled the preference.
 *
 * The high-water mark lives in localStorage so reloading the page does not
 * replay notifications the merchant has already seen.
 */
export default function BrowserNotifier({ enabled }) {
  const timer = useRef(null);

  useEffect(() => {
    if (!enabled) return undefined;
    if (typeof window === 'undefined' || !('Notification' in window)) return undefined;
    if (Notification.permission !== 'granted') return undefined;

    let cancelled = false;

    async function poll() {
      try {
        const since = window.localStorage.getItem(STORAGE_KEY);
        const url = since ? `/api/alerts/recent?since=${encodeURIComponent(since)}` : '/api/alerts/recent';
        const data = await fetchJson(url);
        if (cancelled) return;

        // On the very first run just record the position — the merchant does
        // not want a burst of notifications for alerts that already existed.
        if (!since) {
          window.localStorage.setItem(STORAGE_KEY, data.now);
          return;
        }

        for (const alert of (data.alerts || []).reverse()) {
          const notification = new Notification(
            `${alert.severity === 'CRITICAL' ? '🔴' : '🟠'} ${alert.title}`,
            {
              body: alert.message,
              tag: alert.id, // collapses duplicates for the same alert
              icon: '/icon.svg',
            }
          );
          notification.onclick = () => {
            window.focus();
            window.location.href = `/alerts/${alert.id}`;
          };
        }

        window.localStorage.setItem(STORAGE_KEY, data.now);
      } catch {
        // Polling failures are silent by design — a missed poll is retried.
      }
    }

    poll();
    timer.current = setInterval(poll, POLL_MS);

    return () => {
      cancelled = true;
      if (timer.current) clearInterval(timer.current);
    };
  }, [enabled]);

  return null;
}

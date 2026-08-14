'use client';

import { useEffect } from 'react';

/**
 * Shopify's OAuth screen sets X-Frame-Options and refuses to render inside the
 * admin iframe, so an embedded app must escape to the top window before
 * starting installation. Shopify's iframe allows top-level navigation, which is
 * what `window.top.location` does here.
 */
export default function ExitIframe({ url }) {
  useEffect(() => {
    if (typeof window === 'undefined') return;

    if (window.top && window.top !== window.self) {
      window.top.location.href = url;
    } else {
      window.location.href = url;
    }
  }, [url]);

  return (
    <main style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', padding: 24 }}>
      <div className="sp-card sp-empty" style={{ maxWidth: 420 }}>
        <div className="sp-empty-emoji" aria-hidden="true">
          ◈
        </div>
        <div className="sp-empty-title">Connecting to Shopify…</div>
        <p className="sp-empty-text">
          You&apos;ll be asked to approve the permissions StorePulse needs. If nothing happens,{' '}
          <a href={url} target="_top" rel="noreferrer">
            continue here
          </a>
          .
        </p>
      </div>
    </main>
  );
}

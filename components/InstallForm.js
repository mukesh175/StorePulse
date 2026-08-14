'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function InstallForm({ configured, demoMode }) {
  const router = useRouter();
  const [shop, setShop] = useState('');
  const [demoState, setDemoState] = useState({ loading: false, error: null });

  function install(event) {
    event.preventDefault();
    const cleaned = shop.trim().toLowerCase().replace(/^https?:\/\//, '').replace(/\/.*$/, '');
    const domain = cleaned.endsWith('.myshopify.com') ? cleaned : `${cleaned}.myshopify.com`;
    window.location.href = `/api/auth?shop=${encodeURIComponent(domain)}`;
  }

  async function startDemo() {
    setDemoState({ loading: true, error: null });
    try {
      const res = await fetch('/api/demo', { method: 'POST' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Could not start the demo');
      router.push('/dashboard');
    } catch (error) {
      setDemoState({ loading: false, error: error.message });
    }
  }

  return (
    <>
      <form onSubmit={install}>
        <label className="sp-label" htmlFor="shop">
          Install on your Shopify store
        </label>
        <div className="d-flex gap-2 flex-wrap">
          <input
            id="shop"
            className="sp-input"
            style={{ flex: '1 1 240px' }}
            placeholder="your-store.myshopify.com"
            value={shop}
            onChange={(e) => setShop(e.target.value)}
            required
          />
          <button className="sp-btn sp-btn-primary" type="submit" disabled={!configured}>
            Install
          </button>
        </div>
        {!configured && (
          <div className="sp-help" style={{ color: 'var(--sp-warning)' }}>
            Shopify credentials are not configured on this deployment. Set SHOPIFY_API_KEY and SHOPIFY_API_SECRET.
          </div>
        )}
      </form>

      {demoMode && (
        <>
          <hr className="sp-divider" />
          <div className="d-flex flex-wrap align-items-center justify-content-between gap-2">
            <div>
              <div className="sp-card-title">Try the demo store</div>
              <div className="sp-card-sub">Sample products, orders and alerts — no Shopify store needed.</div>
            </div>
            <button className="sp-btn" onClick={startDemo} disabled={demoState.loading}>
              {demoState.loading ? 'Building demo…' : 'Open demo'}
            </button>
          </div>
          {demoState.error && (
            <div className="sp-help" style={{ color: 'var(--sp-critical)' }}>
              {demoState.error}
            </div>
          )}
        </>
      )}
    </>
  );
}

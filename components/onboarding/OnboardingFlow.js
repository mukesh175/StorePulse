'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { fetchJson } from '@/lib/utils/fetchJson';

const SCAN_STEPS = ['Products', 'Inventory', 'Orders', 'Refunds', 'Store settings'];

function StepDots({ step }) {
  return (
    <div className="d-flex gap-2 justify-content-center mb-4" aria-hidden="true">
      {[1, 2, 3, 4].map((n) => (
        <span
          key={n}
          style={{
            width: n === step ? 22 : 7,
            height: 7,
            borderRadius: 999,
            background: n <= step ? 'var(--sp-brand)' : 'var(--sp-line)',
            transition: 'all 0.25s ease',
          }}
        />
      ))}
    </div>
  );
}

export default function OnboardingFlow({ store }) {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [scan, setScan] = useState({ running: false, done: 0, error: null, result: null });
  const [prefs, setPrefs] = useState({ emailEnabled: true, browserNotificationsEnabled: false });
  const [finishing, setFinishing] = useState(false);

  const runScan = useCallback(async () => {
    setScan({ running: true, done: 0, error: null, result: null });

    // Tick the checklist while the sync request is in flight.
    const ticker = setInterval(() => {
      setScan((s) => (s.done < SCAN_STEPS.length - 1 ? { ...s, done: s.done + 1 } : s));
    }, 900);

    try {
      // A large catalogue cannot be written inside one serverless invocation,
      // so the endpoint returns complete:false and we resume where it stopped.
      let data;
      let attempts = 0;
      do {
        data = await fetchJson('/api/sync', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ notify: false, registerWebhooks: attempts === 0 }),
        });
        attempts += 1;
      } while (data.complete === false && attempts < 8);

      const health = await fetchJson('/api/dashboard/summary');
      clearInterval(ticker);
      setScan({ running: false, done: SCAN_STEPS.length, error: null, result: { ...data, health } });
      setTimeout(() => setStep(3), 600);
    } catch (error) {
      clearInterval(ticker);
      setScan({ running: false, done: 0, error: error.message, result: null });
    }
  }, []);

  useEffect(() => {
    if (step === 2 && !scan.running && !scan.result && !scan.error) runScan();
  }, [step, scan.running, scan.result, scan.error, runScan]);

  async function finish() {
    setFinishing(true);
    try {
      await fetch('/api/notifications/preferences', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          emailEnabled: prefs.emailEnabled,
          dailyDigestEnabled: prefs.emailEnabled,
          instantAlertsEnabled: prefs.emailEnabled,
          browserNotificationsEnabled: prefs.browserNotificationsEnabled,
        }),
      });
      await fetch('/api/onboarding', { method: 'POST' });
    } finally {
      router.push('/dashboard');
    }
  }

  async function toggleBrowser(next) {
    if (next && typeof window !== 'undefined' && 'Notification' in window) {
      const permission = await Notification.requestPermission();
      setPrefs((p) => ({ ...p, browserNotificationsEnabled: permission === 'granted' }));
      return;
    }
    setPrefs((p) => ({ ...p, browserNotificationsEnabled: next }));
  }

  const health = scan.result?.health;

  return (
    <div className="sp-card sp-card-pad sp-fade-in" style={{ maxWidth: 560, width: '100%', padding: 32 }}>
      <div className="d-flex align-items-center gap-2 justify-content-center mb-4">
        <span className="sp-brand-mark" aria-hidden="true">
          ◈
        </span>
        <strong style={{ fontSize: 17, letterSpacing: '-0.03em' }}>StorePulse</strong>
      </div>

      <StepDots step={step} />

      {step === 1 && (
        <div className="text-center">
          <h1 style={{ fontSize: 24 }}>Welcome to StorePulse 👋</h1>
          <p className="sp-card-sub mt-2" style={{ lineHeight: 1.65 }}>
            Your store&apos;s daily intelligence assistant. Every morning we tell you what happened in{' '}
            <strong style={{ color: 'var(--sp-ink)' }}>{store.shopName}</strong>, why it matters, and what to do about it.
          </p>
          <div className="text-start mt-4">
            {[
              ['🔴', 'Products that unexpectedly sell out'],
              ['🟠', 'Orders sitting unfulfilled too long'],
              ['📉', 'Refund spikes and sales drops'],
            ].map(([icon, text]) => (
              <div className="d-flex gap-2 align-items-center py-2" key={text}>
                <span aria-hidden="true">{icon}</span>
                <span style={{ fontSize: 14 }}>{text}</span>
              </div>
            ))}
          </div>
          <button className="sp-btn sp-btn-primary w-100 mt-4" onClick={() => setStep(2)}>
            Scan my store
          </button>
        </div>
      )}

      {step === 2 && (
        <div>
          <h1 className="text-center" style={{ fontSize: 22 }}>
            Scanning your store…
          </h1>
          <p className="sp-card-sub text-center mt-2">This takes a moment on the first run.</p>

          <div className="mt-4">
            {SCAN_STEPS.map((label, index) => {
              const complete = index < scan.done;
              return (
                <div className="d-flex align-items-center gap-2 py-2" key={label}>
                  <span
                    style={{
                      width: 20,
                      color: complete ? 'var(--sp-success)' : 'var(--sp-faint)',
                    }}
                    aria-hidden="true"
                  >
                    {complete ? '✓' : '○'}
                  </span>
                  <span style={{ fontSize: 14, color: complete ? 'var(--sp-ink)' : 'var(--sp-muted)' }}>{label}</span>
                  {!complete && index === scan.done && scan.running && (
                    <span className="sp-skeleton ms-auto" style={{ width: 60, height: 8 }} />
                  )}
                </div>
              );
            })}
          </div>

          {scan.error && (
            <div className="sp-banner warning mt-3">
              <span aria-hidden="true">⚠</span>
              <div>
                <strong>We couldn&apos;t finish the scan.</strong>
                <div className="mt-1">{scan.error}</div>
                <button className="sp-btn sp-btn-sm mt-2" onClick={runScan}>
                  Try again
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {step === 3 && (
        <div className="text-center">
          <h1 style={{ fontSize: 22 }}>Your store health</h1>
          <div style={{ fontSize: 46, fontWeight: 700, letterSpacing: '-0.04em', marginTop: 12 }}>
            {health?.health?.score ?? '—'}
            <span className="sp-card-sub" style={{ fontSize: 16 }}>
              /100
            </span>
          </div>
          <div className="sp-pill neutral mt-2">{health?.health?.label ?? 'Calculating'}</div>

          <p className="sp-card-sub mt-4 mb-2">We found:</p>
          <div className="d-flex justify-content-center gap-3 flex-wrap" style={{ fontSize: 14 }}>
            <span>🔴 {health?.counts?.critical ?? 0} critical issues</span>
            <span>🟠 {health?.counts?.warning ?? 0} warnings</span>
            <span>🟢 {health?.counts?.positive ?? 0} positive signals</span>
          </div>

          {scan.result && (
            <p className="sp-card-sub mt-3">
              Synced {scan.result.products ?? 0} products and {scan.result.orders ?? 0} orders.
            </p>
          )}

          {scan.result?.warnings?.length > 0 && (
            <div className="sp-banner warning mt-3 text-start">
              <span aria-hidden="true">⚠</span>
              <div>
                <strong>Some data could not be synced.</strong>
                {scan.result.warnings.map((warning) => (
                  <div className="mt-1" key={warning.phase}>
                    {warning.message}
                  </div>
                ))}
              </div>
            </div>
          )}

          <button className="sp-btn sp-btn-primary w-100 mt-4" onClick={() => setStep(4)}>
            Set up notifications
          </button>
        </div>
      )}

      {step === 4 && (
        <div>
          <h1 className="text-center" style={{ fontSize: 22 }}>
            Where should StorePulse notify you?
          </h1>
          <p className="sp-card-sub text-center mt-2">You can change this any time in Notifications.</p>

          <div className="mt-4">
            <div className="sp-switch-row">
              <div>
                <div style={{ fontWeight: 570, fontSize: 14 }}>Email</div>
                <div className="sp-help">{store.email || 'Your Shopify account email'}</div>
              </div>
              <input
                type="checkbox"
                className="sp-switch"
                checked={prefs.emailEnabled}
                onChange={(e) => setPrefs((p) => ({ ...p, emailEnabled: e.target.checked }))}
                aria-label="Email notifications"
              />
            </div>
            <div className="sp-switch-row">
              <div>
                <div style={{ fontWeight: 570, fontSize: 14 }}>In-app</div>
                <div className="sp-help">Always on — your alert center</div>
              </div>
              <input type="checkbox" className="sp-switch" checked disabled aria-label="In-app notifications" />
            </div>
            <div className="sp-switch-row">
              <div>
                <div style={{ fontWeight: 570, fontSize: 14 }}>Browser</div>
                <div className="sp-help">Desktop notifications while StorePulse is open</div>
              </div>
              <input
                type="checkbox"
                className="sp-switch"
                checked={prefs.browserNotificationsEnabled}
                onChange={(e) => toggleBrowser(e.target.checked)}
                aria-label="Browser notifications"
              />
            </div>
          </div>

          <button className="sp-btn sp-btn-primary w-100 mt-4" onClick={finish} disabled={finishing}>
            {finishing ? 'Finishing…' : 'Go to my dashboard'}
          </button>
        </div>
      )}
    </div>
  );
}

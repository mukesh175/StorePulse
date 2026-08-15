'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { fetchJson } from '@/lib/utils/fetchJson';

export default function PlanSelector({ plans, planOrder, currentPlan, isDemo }) {
  const router = useRouter();
  const [busy, setBusy] = useState(null);
  const [error, setError] = useState(null);
  const [, startTransition] = useTransition();

  const currentIndex = planOrder.indexOf(currentPlan);

  async function choose(planId) {
    setBusy(planId);
    setError(null);

    try {
      const data = await fetchJson('/api/billing/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ plan: planId }),
      });

      if (data.confirmationUrl) {
        // Shopify's approval screen cannot render inside the admin iframe.
        if (window.top && window.top !== window.self) {
          window.top.location.href = data.confirmationUrl;
        } else {
          window.location.href = data.confirmationUrl;
        }
        return;
      }

      startTransition(() => router.refresh());
      setBusy(null);
    } catch (err) {
      setError(err.message);
      setBusy(null);
    }
  }

  return (
    <>
      {error && (
        <div className="sp-banner critical mb-3">
          <span aria-hidden="true">⚠</span>
          <div>{error}</div>
        </div>
      )}

      <div className="row g-3">
        {planOrder.map((planId, index) => {
          const plan = plans[planId];
          const isCurrent = planId === currentPlan;
          const isDowngrade = index < currentIndex;

          return (
            <div className="col-12 col-md-6 col-xl-3" key={planId}>
              <div
                className="sp-card sp-card-pad h-100 d-flex flex-column"
                style={isCurrent ? { borderColor: 'var(--sp-brand)', boxShadow: 'var(--sp-shadow-lg)' } : undefined}
              >
                <div className="d-flex align-items-center justify-content-between">
                  <strong style={{ fontSize: 15 }}>{plan.name}</strong>
                  {isCurrent && <span className="sp-pill info">Current</span>}
                </div>

                <div className="sp-metric-value" style={{ fontSize: 26 }}>
                  {plan.price === 0 ? 'Free' : `$${plan.price}`}
                  {plan.price > 0 && (
                    <span className="sp-card-sub" style={{ fontSize: 13, fontWeight: 400 }}>
                      {' '}
                      /month
                    </span>
                  )}
                </div>

                <ul className="mt-2 mb-3" style={{ paddingLeft: 18, fontSize: 13.5, color: 'var(--sp-muted)' }}>
                  {plan.highlights.map((feature) => (
                    <li key={feature} className="mb-1">
                      {feature}
                    </li>
                  ))}
                </ul>

                <div className="mt-auto">
                  {isCurrent ? (
                    <button className="sp-btn w-100" disabled>
                      Current plan
                    </button>
                  ) : (
                    <button
                      className={`sp-btn w-100${isDowngrade ? '' : ' sp-btn-primary'}`}
                      onClick={() => choose(planId)}
                      disabled={busy !== null || isDemo}
                      title={isDemo ? 'The demo store cannot change plans' : undefined}
                    >
                      {busy === planId
                        ? 'Working…'
                        : isDowngrade
                          ? `Downgrade to ${plan.name}`
                          : `Upgrade to ${plan.name}`}
                    </button>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <p className="sp-help mt-3">
        Upgrades are approved and billed through Shopify — StorePulse never sees your payment details. On a
        development store Shopify creates a test charge, so nothing is actually charged. Downgrading to Free
        cancels the subscription immediately.
      </p>
    </>
  );
}

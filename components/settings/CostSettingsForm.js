'use client';

import { useState } from 'react';
import { fetchJson } from '@/lib/utils/fetchJson';

const FIELDS = [
  {
    key: 'shippingCostPerOrder',
    label: 'Shipping cost per order',
    help: 'What you pay a courier for an average order. Shopify only knows what you charged the customer.',
    suffix: 'currency',
  },
  {
    key: 'paymentFeePercent',
    label: 'Payment gateway fee',
    help: 'Percentage taken by your payment provider.',
    suffix: '%',
  },
  {
    key: 'codRtoPercent',
    label: 'COD return-to-origin rate',
    help: 'Share of cash-on-delivery orders that come back undelivered. Leave at 0 if you do not offer COD.',
    suffix: '%',
  },
  {
    key: 'codRtoCostPerOrder',
    label: 'Cost of one RTO',
    help: 'Forward plus return shipping on a failed COD delivery.',
    suffix: 'currency',
  },
  {
    key: 'monthlyAdSpend',
    label: 'Monthly ad spend',
    help: 'Total across all channels. Used blended — Shopify has no per-product attribution.',
    suffix: 'currency',
  },
  {
    key: 'freeShippingThreshold',
    label: 'Free-shipping threshold',
    help: 'Order value above which you ship free. Used to model changing it.',
    suffix: 'currency',
  },
];

export default function CostSettingsForm({ initial, currency }) {
  const [form, setForm] = useState(initial);
  const [state, setState] = useState({ saving: false, saved: false, error: null });

  function set(key, value) {
    setForm((prev) => ({ ...prev, [key]: value }));
    setState((s) => ({ ...s, saved: false }));
  }

  async function save(event) {
    event.preventDefault();
    setState({ saving: true, saved: false, error: null });
    try {
      const data = await fetchJson('/api/profit/costs', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      setForm((prev) => ({
        ...prev,
        ...Object.fromEntries(Object.keys(prev).map((k) => [k, Number(data.costSettings[k])])),
      }));
      setState({ saving: false, saved: true, error: null });
    } catch (error) {
      setState({ saving: false, saved: false, error: error.message });
    }
  }

  return (
    <form onSubmit={save}>
      <div className="sp-card sp-card-pad mb-3">
        <div className="sp-card-title mb-1">Your cost assumptions</div>
        <div className="sp-card-sub mb-3">
          Shopify cannot tell us these, so profit figures that depend on them are labelled{' '}
          <strong>Estimated</strong>. The closer these are to reality, the more useful the profit report is.
        </div>

        <div className="row g-3">
          {FIELDS.map((field) => (
            <div className="col-12 col-md-6" key={field.key}>
              <label className="sp-label" htmlFor={field.key}>
                {field.label}
                <span className="sp-card-sub"> ({field.suffix === '%' ? '%' : currency})</span>
              </label>
              <input
                id={field.key}
                type="number"
                min={0}
                step="0.01"
                max={field.suffix === '%' ? 100 : undefined}
                className="sp-input"
                value={form[field.key]}
                onChange={(e) => set(field.key, e.target.value === '' ? 0 : Number(e.target.value))}
              />
              <div className="sp-help">{field.help}</div>
            </div>
          ))}
        </div>
      </div>

      <div className="d-flex align-items-center gap-3">
        <button type="submit" className="sp-btn sp-btn-primary" disabled={state.saving}>
          {state.saving ? 'Saving…' : 'Save cost assumptions'}
        </button>
        {state.saved && <span className="sp-card-sub" style={{ color: 'var(--sp-success)' }}>Saved</span>}
        {state.error && <span className="sp-card-sub" style={{ color: 'var(--sp-critical)' }}>{state.error}</span>}
      </div>
    </form>
  );
}

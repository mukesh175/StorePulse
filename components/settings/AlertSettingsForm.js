'use client';

import { useState } from 'react';

const LOW_STOCK_PRESETS = [5, 10, 20];

function Toggle({ id, label, help, checked, onChange }) {
  return (
    <div className="sp-switch-row">
      <div>
        <label htmlFor={id} style={{ fontWeight: 570, fontSize: 14, cursor: 'pointer' }}>
          {label}
        </label>
        {help && <div className="sp-help">{help}</div>}
      </div>
      <input id={id} type="checkbox" className="sp-switch" checked={checked} onChange={(e) => onChange(e.target.checked)} />
    </div>
  );
}

export default function AlertSettingsForm({ initial }) {
  const [form, setForm] = useState(initial);
  const [state, setState] = useState({ saving: false, saved: false, error: null });

  const set = (key) => (value) => {
    setForm((prev) => ({ ...prev, [key]: value }));
    setState((s) => ({ ...s, saved: false }));
  };

  async function save(event) {
    event.preventDefault();
    setState({ saving: true, saved: false, error: null });
    try {
      const res = await fetch('/api/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Could not save your settings');
      setForm((prev) => ({ ...prev, ...data.settings }));
      setState({ saving: false, saved: true, error: null });
    } catch (error) {
      setState({ saving: false, saved: false, error: error.message });
    }
  }

  return (
    <form onSubmit={save}>
      <div className="sp-card sp-card-pad mb-3">
        <div className="sp-card-title mb-1">Thresholds</div>
        <div className="sp-card-sub mb-3">These control when StorePulse decides something is worth telling you.</div>

        <div className="row g-3">
          <div className="col-12 col-md-6">
            <label className="sp-label" htmlFor="lowStockThreshold">
              Low-stock threshold
            </label>
            <div className="d-flex gap-2 align-items-center">
              <input
                id="lowStockThreshold"
                type="number"
                min={1}
                max={1000}
                className="sp-input"
                style={{ maxWidth: 120 }}
                value={form.lowStockThreshold}
                onChange={(e) => set('lowStockThreshold')(Number(e.target.value))}
              />
              <div className="sp-tabs">
                {LOW_STOCK_PRESETS.map((preset) => (
                  <button
                    key={preset}
                    type="button"
                    className={`sp-tab${form.lowStockThreshold === preset ? ' active' : ''}`}
                    onClick={() => set('lowStockThreshold')(preset)}
                  >
                    {preset}
                  </button>
                ))}
              </div>
            </div>
            <div className="sp-help">Warn when a tracked variant falls to this many units.</div>
          </div>

          <div className="col-6 col-md-3">
            <label className="sp-label" htmlFor="delayedOrderWarnHours">
              Delayed order — warning
            </label>
            <input
              id="delayedOrderWarnHours"
              type="number"
              min={1}
              max={720}
              className="sp-input"
              value={form.delayedOrderWarnHours}
              onChange={(e) => set('delayedOrderWarnHours')(Number(e.target.value))}
            />
            <div className="sp-help">Hours unfulfilled</div>
          </div>

          <div className="col-6 col-md-3">
            <label className="sp-label" htmlFor="delayedOrderCritHours">
              Delayed order — critical
            </label>
            <input
              id="delayedOrderCritHours"
              type="number"
              min={2}
              max={1440}
              className="sp-input"
              value={form.delayedOrderCritHours}
              onChange={(e) => set('delayedOrderCritHours')(Number(e.target.value))}
            />
            <div className="sp-help">Hours unfulfilled</div>
          </div>

          <div className="col-6 col-md-3">
            <label className="sp-label" htmlFor="salesDropPercent">
              Sales-drop threshold
            </label>
            <input
              id="salesDropPercent"
              type="number"
              min={5}
              max={95}
              className="sp-input"
              value={form.salesDropPercent}
              onChange={(e) => set('salesDropPercent')(Number(e.target.value))}
            />
            <div className="sp-help">% drop vs previous period</div>
          </div>

          <div className="col-6 col-md-3">
            <label className="sp-label" htmlFor="refundSpikePercent">
              Refund-spike threshold
            </label>
            <input
              id="refundSpikePercent"
              type="number"
              min={5}
              max={500}
              className="sp-input"
              value={form.refundSpikePercent}
              onChange={(e) => set('refundSpikePercent')(Number(e.target.value))}
            />
            <div className="sp-help">% above your normal rate</div>
          </div>
        </div>
      </div>

      <div className="sp-card sp-card-pad mb-3">
        <div className="sp-card-title mb-1">Alert types</div>
        <div className="sp-card-sub mb-2">Turn off any rule you do not want StorePulse to run.</div>
        <Toggle
          id="inventoryAlertsEnabled"
          label="Inventory alerts"
          help="Unexpected sold out and low stock."
          checked={form.inventoryAlertsEnabled}
          onChange={set('inventoryAlertsEnabled')}
        />
        <Toggle
          id="orderAlertsEnabled"
          label="Order alerts"
          help="Orders sitting unfulfilled past your thresholds."
          checked={form.orderAlertsEnabled}
          onChange={set('orderAlertsEnabled')}
        />
        <Toggle
          id="refundAlertsEnabled"
          label="Refund alerts"
          help="Refund rate spiking above your baseline."
          checked={form.refundAlertsEnabled}
          onChange={set('refundAlertsEnabled')}
        />
        <Toggle
          id="salesAlertsEnabled"
          label="Sales alerts"
          help="Revenue and order-volume swings."
          checked={form.salesAlertsEnabled}
          onChange={set('salesAlertsEnabled')}
        />
        <Toggle
          id="productAlertsEnabled"
          label="Product performance alerts"
          help="Per-product sales drops and demand spikes."
          checked={form.productAlertsEnabled}
          onChange={set('productAlertsEnabled')}
        />
      </div>

      <div className="d-flex align-items-center gap-3">
        <button type="submit" className="sp-btn sp-btn-primary" disabled={state.saving}>
          {state.saving ? 'Saving…' : 'Save settings'}
        </button>
        {state.saved && <span className="sp-card-sub" style={{ color: 'var(--sp-success)' }}>Saved</span>}
        {state.error && <span className="sp-card-sub" style={{ color: 'var(--sp-critical)' }}>{state.error}</span>}
      </div>
    </form>
  );
}

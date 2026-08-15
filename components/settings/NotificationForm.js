'use client';

import { useState } from 'react';

const HOURS = Array.from({ length: 24 }, (_, h) => h);

function Toggle({ id, label, help, checked, onChange, disabled }) {
  return (
    <div className="sp-switch-row">
      <div>
        <label htmlFor={id} style={{ fontWeight: 570, fontSize: 14, cursor: disabled ? 'default' : 'pointer' }}>
          {label}
        </label>
        {help && <div className="sp-help">{help}</div>}
      </div>
      <input
        id={id}
        type="checkbox"
        className="sp-switch"
        checked={checked}
        disabled={disabled}
        onChange={(e) => onChange(e.target.checked)}
      />
    </div>
  );
}

export default function NotificationForm({ initial }) {
  const [form, setForm] = useState(initial);
  const [state, setState] = useState({ saving: false, saved: false, error: null });
  const [test, setTest] = useState({ sending: false, ok: false, result: null });

  async function sendTest() {
    setTest({ sending: true, ok: false, result: null });
    try {
      // Save first, so the test uses the address currently in the form.
      await fetch('/api/notifications/preferences', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });

      const res = await fetch('/api/notifications/test', { method: 'POST' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'The email could not be sent.');
      setTest({ sending: false, ok: true, result: `Sent to ${data.to}` });
    } catch (error) {
      setTest({ sending: false, ok: false, result: error.message });
    }
  }

  const set = (key) => (value) => {
    setForm((prev) => ({ ...prev, [key]: value }));
    setState((s) => ({ ...s, saved: false }));
  };

  async function save(event) {
    event.preventDefault();
    setState({ saving: true, saved: false, error: null });
    try {
      const res = await fetch('/api/notifications/preferences', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Could not save your preferences');
      setForm((prev) => ({ ...prev, ...data.preferences }));
      setState({ saving: false, saved: true, error: null });
    } catch (error) {
      setState({ saving: false, saved: false, error: error.message });
    }
  }

  function testBrowserNotification() {
    if (typeof window === 'undefined' || !('Notification' in window)) {
      setState((s) => ({ ...s, error: 'This browser does not support notifications' }));
      return;
    }
    if (Notification.permission !== 'granted') {
      setState((s) => ({ ...s, error: 'Browser notifications are blocked in your browser settings' }));
      return;
    }
    new Notification('🔴 StorePulse test notification', {
      body: 'This is what a critical alert will look like.',
      icon: '/icon.svg',
    });
  }

  async function enableBrowserNotifications() {
    if (typeof window === 'undefined' || !('Notification' in window)) {
      setState((s) => ({ ...s, error: 'This browser does not support notifications' }));
      return;
    }
    const permission = await Notification.requestPermission();
    set('browserNotificationsEnabled')(permission === 'granted');
    if (permission !== 'granted') {
      setState((s) => ({ ...s, error: 'Browser notifications were blocked in your browser settings' }));
    }
  }

  return (
    <form onSubmit={save}>
      <div className="sp-card sp-card-pad mb-3">
        <div className="sp-card-title mb-1">Email</div>
        <div className="sp-card-sub mb-2">Where StorePulse sends alerts and your daily brief.</div>

        <label className="sp-label" htmlFor="notifyEmail">
          Notification email
        </label>
        <input
          id="notifyEmail"
          type="email"
          className="sp-input"
          value={form.notifyEmail ?? ''}
          onChange={(e) => set('notifyEmail')(e.target.value)}
          placeholder="you@yourstore.com"
        />
        <div className="sp-help">Leave blank to use the email on your Shopify account.</div>

        <div className="mt-2">
          <Toggle
            id="emailEnabled"
            label="Email notifications"
            help="Master switch for every StorePulse email."
            checked={form.emailEnabled}
            onChange={set('emailEnabled')}
          />
          <Toggle
            id="instantAlertsEnabled"
            label="Instant critical alerts"
            help="Sent the moment a critical issue is detected — one email per issue, never repeated."
            checked={form.instantAlertsEnabled}
            onChange={set('instantAlertsEnabled')}
            disabled={!form.emailEnabled}
          />
          <Toggle
            id="dailyDigestEnabled"
            label="Daily digest"
            help="Your morning store brief."
            checked={form.dailyDigestEnabled}
            onChange={set('dailyDigestEnabled')}
            disabled={!form.emailEnabled}
          />
          <Toggle
            id="weeklySummaryEnabled"
            label="Weekly summary"
            help="A Monday report of the week just gone."
            checked={form.weeklySummaryEnabled}
            onChange={set('weeklySummaryEnabled')}
            disabled={!form.emailEnabled}
          />
          <Toggle
            id="criticalAlertsOnly"
            label="Critical alerts only"
            help="Suppress warnings and informational emails."
            checked={form.criticalAlertsOnly}
            onChange={set('criticalAlertsOnly')}
            disabled={!form.emailEnabled}
          />
        </div>

        <div className="mt-3" style={{ maxWidth: 260 }}>
          <label className="sp-label" htmlFor="digestHour">
            Daily digest time (store timezone)
          </label>
          <select
            id="digestHour"
            className="sp-select"
            value={form.digestHour}
            onChange={(e) => set('digestHour')(Number(e.target.value))}
          >
            {HOURS.map((h) => (
              <option key={h} value={h}>
                {String(h).padStart(2, '0')}:00
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="sp-card sp-card-pad mb-3">
        <div className="sp-card-title mb-1">In-app and browser</div>
        <Toggle id="inApp" label="In-app alerts" help="Always on — the alert center is your source of truth." checked disabled onChange={() => {}} />
        <Toggle
          id="browserNotificationsEnabled"
          label="Browser notifications"
          help="Desktop notifications for new critical and warning alerts while StorePulse is open in a tab. Checked once a minute."
          checked={form.browserNotificationsEnabled}
          onChange={(value) => (value ? enableBrowserNotifications() : set('browserNotificationsEnabled')(false))}
        />
        {form.browserNotificationsEnabled && (
          <div className="d-flex align-items-center gap-2 pt-2">
            <button type="button" className="sp-btn sp-btn-sm" onClick={testBrowserNotification}>
              Show a test notification
            </button>
            <span className="sp-card-sub">Save your preferences to start receiving them.</span>
          </div>
        )}
      </div>

      <div className="d-flex align-items-center gap-3 flex-wrap">
        <button type="submit" className="sp-btn sp-btn-primary" disabled={state.saving}>
          {state.saving ? 'Saving…' : 'Save preferences'}
        </button>
        <button type="button" className="sp-btn" onClick={sendTest} disabled={test.sending}>
          {test.sending ? 'Sending…' : 'Send test email'}
        </button>
        {state.saved && <span className="sp-card-sub" style={{ color: 'var(--sp-success)' }}>Saved</span>}
        {state.error && <span className="sp-card-sub" style={{ color: 'var(--sp-critical)' }}>{state.error}</span>}
        {test.result && (
          <span className="sp-card-sub" style={{ color: test.ok ? 'var(--sp-success)' : 'var(--sp-critical)' }}>
            {test.result}
          </span>
        )}
      </div>
      <div className="sp-help mt-2">
        The test sends a real copy of your daily brief, so a success confirms your API key, sending domain and
        recipient address all work. Delivery is recorded below.
      </div>

      {test.ok && (
        <div className="sp-banner info mt-3">
          <span aria-hidden="true">📬</span>
          <div>
            <strong>Not in your inbox? Check your spam or junk folder.</strong>
            <div className="mt-1">
              If you find it there, open it and choose <strong>Report not spam</strong> (Gmail) or{' '}
              <strong>Mark as not junk</strong> (Outlook), then add the sender to your contacts. That teaches your
              mail provider to deliver future StorePulse alerts to the inbox — worth doing now, so you don&apos;t
              miss a critical alert later.
            </div>
          </div>
        </div>
      )}
    </form>
  );
}

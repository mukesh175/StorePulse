'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';

const LABELS = {
  resolve: 'Mark resolved',
  dismiss: 'Dismiss',
  acknowledge: 'Acknowledge',
  snooze: 'Snooze 24h',
  reopen: 'Reopen',
};

export default function AlertActions({ alertId, actions = ['resolve', 'dismiss'], size = 'sm', onDone }) {
  const router = useRouter();
  const [busy, setBusy] = useState(null);
  const [error, setError] = useState(null);
  const [, startTransition] = useTransition();

  async function run(action) {
    setBusy(action);
    setError(null);
    try {
      const res = await fetch(`/api/alerts/${alertId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, hours: 24 }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'Could not update this alert');
      }
      if (onDone) onDone(action);
      startTransition(() => router.refresh());
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="d-flex flex-wrap align-items-center gap-2">
      {actions.map((action) => (
        <button
          key={action}
          className={`sp-btn${size === 'sm' ? ' sp-btn-sm' : ''}`}
          onClick={() => run(action)}
          disabled={busy !== null}
        >
          {busy === action ? 'Working…' : LABELS[action]}
        </button>
      ))}
      {error && (
        <span className="sp-card-sub" style={{ color: 'var(--sp-critical)' }}>
          {error}
        </span>
      )}
    </div>
  );
}

'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { fetchJson } from '@/lib/utils/fetchJson';

export default function SyncButton() {
  const router = useRouter();
  const [state, setState] = useState({ loading: false, error: null });
  const [isPending, startTransition] = useTransition();

  async function resync() {
    setState({ loading: true, error: null });
    try {
      let data;
      let attempts = 0;
      do {
        data = await fetchJson('/api/sync', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ notify: true }),
        });
        attempts += 1;
      } while (data.complete === false && attempts < 8);

      setState({ loading: false, error: data.warnings?.[0]?.message ?? null });
      startTransition(() => router.refresh());
    } catch (error) {
      setState({ loading: false, error: error.message });
    }
  }

  return (
    <div className="d-flex align-items-center gap-2">
      {state.error && (
        <span className="sp-card-sub" style={{ color: 'var(--sp-critical)' }}>
          {state.error}
        </span>
      )}
      <button className="sp-btn sp-btn-sm" onClick={resync} disabled={state.loading || isPending}>
        {state.loading || isPending ? 'Syncing…' : '⟳ Re-sync'}
      </button>
    </div>
  );
}

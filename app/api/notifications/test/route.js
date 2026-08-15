import { NextResponse } from 'next/server';
import { requireStore } from '@/lib/shopify/session';
import { buildDailyBrief } from '@/lib/brief';
import { dispatchTestEmail } from '@/lib/notifications/dispatch';
import { withStore } from '@/lib/api';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** Sends the merchant a test copy of their daily brief. */
export const POST = withStore(async () => {
  const store = await requireStore();
  const brief = await buildDailyBrief(store);
  const result = await dispatchTestEmail(store, brief);

  if (result.ok) {
    return NextResponse.json({ ok: true, to: result.to, id: result.id });
  }

  return NextResponse.json(
    { ok: false, error: result.reason || result.error || 'The email could not be sent.' },
    { status: 400 }
  );
});

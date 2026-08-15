import { NextResponse } from 'next/server';
import { requireStore } from '@/lib/shopify/session';
import { createSubscription, cancelSubscription, PLANS } from '@/lib/billing';
import { withStore, badRequest } from '@/lib/api';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Starts an upgrade. Returns the Shopify confirmation URL the merchant must
 * open to approve the charge — we never take payment details ourselves.
 * Downgrading to Free cancels the subscription immediately.
 */
export const POST = withStore(async (request) => {
  const store = await requireStore();
  const body = await request.json().catch(() => ({}));
  const planId = String(body.plan || '').toUpperCase();

  if (!PLANS[planId]) return badRequest('Unknown plan');
  if (store.isDemo) return badRequest('The demo store cannot change plans.');
  if (planId === store.plan) return badRequest(`You are already on the ${PLANS[planId].name} plan.`);

  if (planId === 'FREE') {
    const updated = await cancelSubscription(store);
    return NextResponse.json({ ok: true, plan: updated.plan, cancelled: true });
  }

  try {
    const { confirmationUrl } = await createSubscription(store, planId);
    if (!confirmationUrl) return badRequest('Shopify did not return an approval URL.');
    return NextResponse.json({ ok: true, confirmationUrl });
  } catch (error) {
    console.error('[storepulse] subscription create failed', error);
    return NextResponse.json(
      { error: error.message?.slice(0, 300) || 'Could not start the upgrade.' },
      { status: 502 }
    );
  }
});

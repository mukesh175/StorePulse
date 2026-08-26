import { NextResponse } from 'next/server';
import { requireStore } from '@/lib/shopify/session';
import { managedPricingUrl } from '@/lib/billing';
import { withStore } from '@/lib/api';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * This app is on Shopify App Pricing, so it must not create charges itself —
 * Shopify rejects the Billing API in that mode. All we do is hand back the URL
 * of Shopify's own plan page, where approval, decline, changing plan and
 * cancelling all happen.
 */
export const POST = withStore(async () => {
  const store = await requireStore();

  if (store.isDemo) {
    return NextResponse.json({ error: 'The demo store cannot change plans.' }, { status: 400 });
  }

  return NextResponse.json({ ok: true, pricingUrl: managedPricingUrl(store) });
});

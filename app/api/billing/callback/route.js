import { NextResponse } from 'next/server';
import { getCurrentStore } from '@/lib/shopify/session';
import { syncSubscriptionState } from '@/lib/billing';
import { env } from '@/lib/env';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Shopify sends the merchant here after they approve (or decline) a charge.
 *
 * The plan is never taken from the query string — we ask Shopify what
 * subscription is actually active and record that, so a hand-edited return URL
 * cannot grant a paid plan.
 */
export async function GET() {
  const store = await getCurrentStore();
  if (!store) return NextResponse.redirect(`${env.appUrl}/`);

  const storeHandle = store.shopDomain.replace('.myshopify.com', '');
  const adminUrl = `https://admin.shopify.com/store/${storeHandle}/apps/${env.shopifyApiKey}`;

  try {
    const { subscription } = await syncSubscriptionState(store);
    const status = subscription ? 'active' : 'declined';
    return NextResponse.redirect(`${adminUrl}?billing=${status}`);
  } catch (error) {
    console.error('[storepulse] billing callback failed', error);
    return NextResponse.redirect(`${adminUrl}?billing=error`);
  }
}

import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { requireStore } from '@/lib/shopify/session';
import { runFullSync } from '@/lib/sync';
import { backfillMetrics } from '@/lib/metrics';
import { runAlertScan } from '@/lib/alerts/scan';
import { registerWebhooks } from '@/lib/shopify/webhooks';
import { withStore } from '@/lib/api';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

/**
 * Full store synchronisation: products + orders, then metrics, then alerts.
 * Used by onboarding ("Scanning your store…") and the manual Re-sync button.
 * Demo stores skip Shopify entirely — their data is already local.
 */
export const POST = withStore(async (request) => {
  const store = await requireStore();
  const body = await request.json().catch(() => ({}));
  const notify = body.notify !== false;

  if (store.isDemo) {
    await backfillMetrics(store, { days: 45 });
    const scan = await runAlertScan(store, { notify: false });
    await prisma.store.update({ where: { id: store.id }, data: { lastSyncAt: new Date() } });
    return NextResponse.json({ ok: true, demo: true, scan });
  }

  try {
    if (body.registerWebhooks) await registerWebhooks(store);

    const sync = await runFullSync(store, { max: 500 });
    await backfillMetrics(sync.store, { days: 60 });
    const scan = await runAlertScan(sync.store, { notify });

    return NextResponse.json({
      ok: true,
      products: sync.products.count,
      orders: sync.orders.count,
      scan,
      lastSyncAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error('[storepulse] sync failed', error);
    const last = await prisma.store.findUnique({ where: { id: store.id }, select: { lastSyncAt: true } });
    return NextResponse.json(
      {
        ok: false,
        error: "We couldn't retrieve your Shopify data. We'll automatically retry.",
        lastSyncAt: last?.lastSyncAt ?? null,
      },
      { status: 502 }
    );
  }
});

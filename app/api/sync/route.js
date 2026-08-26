import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { requireStore } from '@/lib/shopify/session';
import { runFullSync, explainSyncError } from '@/lib/sync';
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

  // Leave headroom inside the platform's function limit for the metrics
  // backfill and alert scan that follow, so we return JSON instead of being
  // killed mid-request (which surfaces as a non-JSON platform error page).
  const deadline = Date.now() + 35_000;

  try {
    // Always re-register: the call is idempotent, and stores installed before
    // a topic was added would otherwise never receive it. That is how this
    // store missed app_subscriptions/update and stopped seeing plan changes.
    try {
      await registerWebhooks(store);
    } catch (error) {
      console.error('[storepulse] webhook registration failed during sync', error);
    }

    const sync = await runFullSync(store, { max: 500, deadline });
    await backfillMetrics(sync.store, { days: 60 });
    const scan = await runAlertScan(sync.store, { notify });

    return NextResponse.json({
      ok: true,
      complete: sync.complete,
      products: sync.products.count,
      productsTotal: sync.products.total ?? sync.products.count,
      orders: sync.orders.count,
      ordersTotal: sync.orders.total ?? sync.orders.count,
      warnings: sync.warnings,
      scan,
      lastSyncAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error('[storepulse] sync failed', error);
    const last = await prisma.store.findUnique({ where: { id: store.id }, select: { lastSyncAt: true } });
    return NextResponse.json(
      {
        ok: false,
        // explainSyncError has already reduced this to a merchant-safe
        // sentence — no stack trace or internal detail reaches the browser.
        error: explainSyncError(error),
        lastSyncAt: last?.lastSyncAt ?? null,
      },
      { status: 502 }
    );
  }
});

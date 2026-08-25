import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { requireStore } from '@/lib/shopify/session';
import { getAlertSettings } from '@/lib/alerts/scan';
import { withStore, validate } from '@/lib/api';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const GET = withStore(async () => {
  const store = await requireStore();
  const settings = await getAlertSettings(store);
  return NextResponse.json({
    settings,
    store: { shopDomain: store.shopDomain, currency: store.currency, timezone: store.timezone, plan: store.plan },
  });
});

export const PUT = withStore(async (request) => {
  const store = await requireStore();
  const body = await request.json().catch(() => ({}));
  const current = await getAlertSettings(store);

  const data = {
    lowStockThreshold: validate.int(body.lowStockThreshold, { min: 1, max: 1000, fallback: current.lowStockThreshold }),
    delayedOrderWarnHours: validate.int(body.delayedOrderWarnHours, {
      min: 1,
      max: 720,
      fallback: current.delayedOrderWarnHours,
    }),
    delayedOrderCritHours: validate.int(body.delayedOrderCritHours, {
      min: 2,
      max: 1440,
      fallback: current.delayedOrderCritHours,
    }),
    salesDropPercent: validate.int(body.salesDropPercent, { min: 5, max: 95, fallback: current.salesDropPercent }),
    refundSpikePercent: validate.int(body.refundSpikePercent, { min: 5, max: 500, fallback: current.refundSpikePercent }),
    inventoryAlertsEnabled: validate.bool(body.inventoryAlertsEnabled, current.inventoryAlertsEnabled),
    orderAlertsEnabled: validate.bool(body.orderAlertsEnabled, current.orderAlertsEnabled),
    refundAlertsEnabled: validate.bool(body.refundAlertsEnabled, current.refundAlertsEnabled),
    salesAlertsEnabled: validate.bool(body.salesAlertsEnabled, current.salesAlertsEnabled),
    productAlertsEnabled: validate.bool(body.productAlertsEnabled, current.productAlertsEnabled),
    profitAlertsEnabled: validate.bool(body.profitAlertsEnabled, current.profitAlertsEnabled),
  };

  // Critical must always be at least as late as the warning threshold.
  if (data.delayedOrderCritHours <= data.delayedOrderWarnHours) {
    data.delayedOrderCritHours = data.delayedOrderWarnHours * 2;
  }

  const settings = await prisma.alertSetting.update({ where: { shopId: store.id }, data });
  return NextResponse.json({ settings });
});

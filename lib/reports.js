import prisma from '@/lib/prisma';
import { percentChange } from '@/lib/utils/format';
import { localDateKey, shiftDateKey, dateOnly } from '@/lib/utils/dates';

async function sumMetrics(shopId, fromKey, toKey) {
  const rows = await prisma.dailyMetric.findMany({
    where: { shopId, date: { gte: dateOnly(fromKey), lte: dateOnly(toKey) } },
  });
  return rows.reduce(
    (acc, m) => ({
      revenue: acc.revenue + Number(m.revenue),
      orders: acc.orders + m.orders,
      refunds: acc.refunds + m.refunds,
      refundAmount: acc.refundAmount + Number(m.refundAmount),
      unitsSold: acc.unitsSold + m.unitsSold,
      newCustomers: acc.newCustomers + m.newCustomers,
      returningCustomers: acc.returningCustomers + m.returningCustomers,
    }),
    { revenue: 0, orders: 0, refunds: 0, refundAmount: 0, unitsSold: 0, newCustomers: 0, returningCustomers: 0 }
  );
}

export async function buildWeeklySummary(store) {
  const todayKey = localDateKey(store.timezone);
  const recent = await sumMetrics(store.id, shiftDateKey(todayKey, -7), shiftDateKey(todayKey, -1));
  const previous = await sumMetrics(store.id, shiftDateKey(todayKey, -14), shiftDateKey(todayKey, -8));

  const weekAgo = new Date(Date.now() - 7 * 24 * 3600 * 1000);

  const [alertsRaised, alertsResolved, best] = await Promise.all([
    prisma.alert.count({ where: { shopId: store.id, firstDetectedAt: { gte: weekAgo } } }),
    prisma.alert.count({ where: { shopId: store.id, resolvedAt: { gte: weekAgo } } }),
    prisma.orderLineItem.groupBy({
      by: ['title'],
      where: { order: { shopId: store.id, isCancelled: false, processedAt: { gte: weekAgo } } },
      _sum: { quantity: true },
      orderBy: { _sum: { quantity: 'desc' } },
      take: 1,
    }),
  ]);

  return {
    ...recent,
    averageOrderValue: recent.orders ? recent.revenue / recent.orders : 0,
    revenueChange: percentChange(recent.revenue, previous.revenue),
    ordersChange: percentChange(recent.orders, previous.orders),
    refundChange: percentChange(recent.refundAmount, previous.refundAmount),
    previous,
    alertsRaised,
    alertsResolved,
    bestSeller: best[0] ? { title: best[0].title, units: best[0]._sum.quantity } : null,
  };
}

export async function getTopProducts(store, { days = 30, limit = 10 } = {}) {
  const since = new Date(Date.now() - days * 24 * 3600 * 1000);

  const rows = await prisma.orderLineItem.groupBy({
    by: ['shopifyProductId', 'title'],
    where: {
      shopifyProductId: { not: null },
      order: { shopId: store.id, isCancelled: false, processedAt: { gte: since } },
    },
    _sum: { quantity: true },
    orderBy: { _sum: { quantity: 'desc' } },
    take: limit,
  });

  const ids = rows.map((r) => r.shopifyProductId);
  const products = await prisma.product.findMany({
    where: { shopId: store.id, shopifyProductId: { in: ids } },
    include: { variants: { select: { price: true } } },
  });
  const byId = new Map(products.map((p) => [p.shopifyProductId, p]));

  return rows.map((r) => {
    const product = byId.get(r.shopifyProductId);
    const price = Number(product?.variants[0]?.price ?? 0);
    return {
      shopifyProductId: r.shopifyProductId,
      title: r.title,
      units: r._sum.quantity ?? 0,
      revenue: (r._sum.quantity ?? 0) * price,
      inventory: product?.totalInventory ?? null,
      imageUrl: product?.imageUrl ?? null,
    };
  });
}

export async function getAlertTrend(store, days = 14) {
  const since = new Date(Date.now() - days * 24 * 3600 * 1000);
  const alerts = await prisma.alert.findMany({
    where: { shopId: store.id, firstDetectedAt: { gte: since } },
    select: { firstDetectedAt: true, severity: true },
  });

  const buckets = new Map();
  for (let i = days - 1; i >= 0; i -= 1) {
    const key = new Date(Date.now() - i * 24 * 3600 * 1000).toISOString().slice(0, 10);
    buckets.set(key, { date: key, critical: 0, warning: 0, other: 0 });
  }

  for (const alert of alerts) {
    const key = alert.firstDetectedAt.toISOString().slice(0, 10);
    const bucket = buckets.get(key);
    if (!bucket) continue;
    if (alert.severity === 'CRITICAL') bucket.critical += 1;
    else if (alert.severity === 'WARNING') bucket.warning += 1;
    else bucket.other += 1;
  }

  return [...buckets.values()];
}

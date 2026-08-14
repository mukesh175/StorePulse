import prisma from '@/lib/prisma';
import { computeHealthScore } from '@/lib/health';
import { getComparisonSummary, getMetricSeries } from '@/lib/metrics';
import { percentChange } from '@/lib/utils/format';

/**
 * The Daily Store Brief — the single object that answers
 * "what happened, why it matters, what should I do" for the whole store.
 * Shared by the dashboard and the digest email so they can never disagree.
 */
export async function buildDailyBrief(store) {
  const [health, comparison, series] = await Promise.all([
    computeHealthScore(store.id),
    getComparisonSummary(store),
    getMetricSeries(store, 7),
  ]);

  const openAlerts = await prisma.alert.findMany({
    where: { shopId: store.id, status: { in: ['OPEN', 'ACKNOWLEDGED'] } },
    orderBy: [{ severity: 'asc' }, { lastDetectedAt: 'desc' }],
    take: 50,
  });

  const bySeverity = (severity) => openAlerts.filter((a) => a.severity === severity);

  const [topProduct] = await prisma.orderLineItem.groupBy({
    by: ['title'],
    where: {
      order: {
        shopId: store.id,
        isCancelled: false,
        processedAt: { gte: new Date(Date.now() - 24 * 3600 * 1000) },
      },
    },
    _sum: { quantity: true },
    orderBy: { _sum: { quantity: 'desc' } },
    take: 1,
  });

  const { yesterday, dayBefore, today } = comparison;

  return {
    store: {
      name: store.shopName || store.shopDomain,
      domain: store.shopDomain,
      currency: store.currency,
      timezone: store.timezone,
    },
    health,
    dateKey: comparison.dateKey,
    metrics: {
      today,
      yesterday,
      dayBefore,
      changes: {
        revenue: percentChange(yesterday.revenue, dayBefore.revenue),
        orders: percentChange(yesterday.orders, dayBefore.orders),
        averageOrderValue: percentChange(yesterday.averageOrderValue, dayBefore.averageOrderValue),
        refundAmount: percentChange(yesterday.refundAmount, dayBefore.refundAmount),
      },
    },
    series,
    critical: bySeverity('CRITICAL'),
    warnings: bySeverity('WARNING'),
    positives: [...bySeverity('SUCCESS'), ...bySeverity('INFO')],
    topProduct: topProduct
      ? { title: topProduct.title, units: topProduct._sum.quantity }
      : null,
    counts: {
      critical: bySeverity('CRITICAL').length,
      warning: bySeverity('WARNING').length,
      positive: bySeverity('SUCCESS').length + bySeverity('INFO').length,
      delayedOrders: health.delayedOrders,
      inventoryIssues: health.inventoryIssues,
    },
  };
}

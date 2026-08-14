import prisma from '@/lib/prisma';

/**
 * Store Health is a 0–100 score. It starts at 100 and deducts weighted
 * penalties for open problems, capped per category so one noisy category
 * cannot drive the whole score to zero.
 */
const WEIGHTS = {
  CRITICAL: { each: 8, cap: 40 },
  WARNING: { each: 3, cap: 25 },
  DELAYED_ORDER: { each: 2, cap: 15 },
  INVENTORY: { each: 2, cap: 15 },
  REFUND: { each: 10, cap: 10 },
};

export async function getAlertCounts(shopId) {
  const grouped = await prisma.alert.groupBy({
    by: ['severity'],
    where: { shopId, status: { in: ['OPEN', 'ACKNOWLEDGED'] } },
    _count: { _all: true },
  });

  const counts = { CRITICAL: 0, WARNING: 0, INFO: 0, SUCCESS: 0 };
  for (const row of grouped) counts[row.severity] = row._count._all;
  return counts;
}

export async function computeHealthScore(shopId) {
  const counts = await getAlertCounts(shopId);

  const [delayedOrders, inventoryIssues, refundIssues] = await Promise.all([
    prisma.alert.count({ where: { shopId, status: { in: ['OPEN', 'ACKNOWLEDGED'] }, type: 'ORDER_DELAYED' } }),
    prisma.alert.count({ where: { shopId, status: { in: ['OPEN', 'ACKNOWLEDGED'] }, category: 'INVENTORY' } }),
    prisma.alert.count({ where: { shopId, status: { in: ['OPEN', 'ACKNOWLEDGED'] }, category: 'REFUNDS' } }),
  ]);

  const penalty = (n, weight) => Math.min(n * weight.each, weight.cap);

  const deduction =
    penalty(counts.CRITICAL, WEIGHTS.CRITICAL) +
    penalty(counts.WARNING, WEIGHTS.WARNING) +
    penalty(delayedOrders, WEIGHTS.DELAYED_ORDER) +
    penalty(inventoryIssues, WEIGHTS.INVENTORY) +
    penalty(refundIssues, WEIGHTS.REFUND);

  const score = Math.max(0, Math.min(100, Math.round(100 - deduction)));

  return {
    score,
    label: score >= 85 ? 'Healthy' : score >= 65 ? 'Needs attention' : score >= 40 ? 'At risk' : 'Critical',
    counts,
    delayedOrders,
    inventoryIssues,
    refundIssues,
  };
}

import prisma from '@/lib/prisma';

/**
 * Revenue impact reporting.
 *
 * The honest framing is "revenue at risk that StorePulse surfaced, and how
 * much of it you resolved" — not "revenue we generated". Every figure comes
 * from the store's own order data and is recorded on the alert at detection
 * time, so the report reflects what was true when the merchant was told.
 *
 * Each alert type states its exposure differently, so `describeBasis` is
 * shown in the UI rather than leaving the merchant to guess.
 */
export const IMPACT_BASIS = {
  INVENTORY_SOLD_OUT: 'One week of this variant’s recent sales rate',
  INVENTORY_LOW_STOCK: 'Not estimated — no revenue is lost until it sells out',
  ORDER_DELAYED: 'The full value of the unfulfilled order',
  PRODUCT_SALES_DROP: 'The weekly revenue difference the drop represents',
  PRODUCT_DEMAND_SPIKE: 'Not estimated — an opportunity, not a loss',
  REFUND_SPIKE: 'Refunded value above the store’s normal refund rate',
  SALES_REVENUE_DROP: 'The 7-day revenue shortfall versus the previous period',
  SALES_ORDER_DROP: 'Not estimated separately from revenue',
};

const RESOLVED = ['RESOLVED'];

export async function getImpactSummary(store, { days = 30 } = {}) {
  const since = new Date(Date.now() - days * 24 * 3600 * 1000);
  const where = { shopId: store.id, firstDetectedAt: { gte: since } };

  const [byType, totals, resolvedTotals, actioned] = await Promise.all([
    prisma.alert.groupBy({
      by: ['type', 'status'],
      where,
      _count: { _all: true },
      _sum: { valueAtRisk: true },
    }),
    prisma.alert.aggregate({ where, _sum: { valueAtRisk: true }, _count: { _all: true } }),
    prisma.alert.aggregate({
      where: { ...where, status: { in: RESOLVED } },
      _sum: { valueAtRisk: true },
      _count: { _all: true },
    }),
    prisma.alert.count({ where: { ...where, status: { in: ['RESOLVED', 'ACKNOWLEDGED', 'DISMISSED'] } } }),
  ]);

  // Collapse the type+status grouping into one row per alert type.
  const rows = new Map();
  for (const row of byType) {
    const existing = rows.get(row.type) ?? {
      type: row.type,
      detected: 0,
      resolved: 0,
      open: 0,
      valueAtRisk: 0,
      valueResolved: 0,
    };

    const value = Number(row._sum.valueAtRisk ?? 0);
    existing.detected += row._count._all;
    existing.valueAtRisk += value;

    if (row.status === 'RESOLVED') {
      existing.resolved += row._count._all;
      existing.valueResolved += value;
    }
    if (row.status === 'OPEN' || row.status === 'ACKNOWLEDGED') {
      existing.open += row._count._all;
    }

    rows.set(row.type, existing);
  }

  const items = [...rows.values()].sort((a, b) => b.valueAtRisk - a.valueAtRisk);
  const detectedCount = totals._count._all;

  return {
    days,
    items,
    totals: {
      detected: detectedCount,
      valueAtRisk: Number(totals._sum.valueAtRisk ?? 0),
      resolved: resolvedTotals._count._all,
      valueResolved: Number(resolvedTotals._sum.valueAtRisk ?? 0),
      actioned,
      // Share of surfaced issues the merchant actually acted on.
      actionRate: detectedCount ? (actioned / detectedCount) * 100 : 0,
    },
  };
}

/** Headline figure for the dashboard: exposure resolved in the window. */
export async function getResolvedValue(store, { days = 30 } = {}) {
  const since = new Date(Date.now() - days * 24 * 3600 * 1000);
  const result = await prisma.alert.aggregate({
    where: { shopId: store.id, status: 'RESOLVED', resolvedAt: { gte: since } },
    _sum: { valueAtRisk: true },
    _count: { _all: true },
  });

  return {
    value: Number(result._sum.valueAtRisk ?? 0),
    count: result._count._all,
    days,
  };
}

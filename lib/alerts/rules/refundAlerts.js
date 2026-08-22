import prisma from '@/lib/prisma';
import { adminUrl } from '@/lib/shopify/urls';
import { formatMoney, percentChange } from '@/lib/utils/format';
import { localDateKey, dateOnly, shiftDateKey } from '@/lib/utils/dates';

export const REFUND_ALERT_TYPES = ['REFUND_SPIKE'];

// Guardrails against noise from tiny samples.
const MIN_ORDERS_TODAY = 5;
const MIN_HISTORICAL_ORDERS = 30;
const BASELINE_DAYS = 28;

/**
 * Rule 4 — Refund spike. Compares today's refund rate (refunded value as a
 * share of revenue) with the trailing baseline.
 */
export async function evaluateRefundSpike(store, settings) {
  const spikePercent = settings?.refundSpikePercent ?? 50;
  const todayKey = localDateKey(store.timezone);
  const startKey = shiftDateKey(todayKey, -BASELINE_DAYS);

  const metrics = await prisma.dailyMetric.findMany({
    where: { shopId: store.id, date: { gte: dateOnly(startKey), lte: dateOnly(todayKey) } },
    orderBy: { date: 'asc' },
  });

  const today = metrics.find((m) => m.date.toISOString().slice(0, 10) === todayKey);
  const baseline = metrics.filter((m) => m.date.toISOString().slice(0, 10) !== todayKey);

  if (!today || today.orders < MIN_ORDERS_TODAY) return null;

  const baselineOrders = baseline.reduce((s, m) => s + m.orders, 0);
  if (baselineOrders < MIN_HISTORICAL_ORDERS) return null;

  const baselineRevenue = baseline.reduce((s, m) => s + Number(m.revenue), 0);
  const baselineRefunds = baseline.reduce((s, m) => s + Number(m.refundAmount), 0);
  if (baselineRevenue <= 0) return null;

  const baselineRate = (baselineRefunds / baselineRevenue) * 100;
  const todayRevenue = Number(today.revenue);
  if (todayRevenue <= 0) return null;
  const todayRate = (Number(today.refundAmount) / todayRevenue) * 100;

  // Ignore stores whose normal refund rate is effectively zero and that had a
  // single small refund — the relative jump would be meaningless.
  if (todayRate < 2) return null;

  const change = percentChange(todayRate, baselineRate);
  if (change < spikePercent) return null;

  return {
    type: 'REFUND_SPIKE',
    category: 'REFUNDS',
    severity: 'WARNING',
    title: 'Refunds are spiking',
    message: `Refunds increased ${change.toFixed(0)}% compared with your normal rate.`,
    resourceType: 'METRIC',
    resourceId: todayKey,
    scope: todayKey,
    resourceUrl: adminUrl(store.shopDomain, '/orders?financial_status=refunded'),
    whyItMatters: `Your usual refund rate is ${baselineRate.toFixed(1)}% of revenue; today it is ${todayRate.toFixed(
      1
    )}% (${formatMoney(today.refundAmount, store.currency)} refunded on ${formatMoney(
      today.revenue,
      store.currency
    )} of sales).`,
    recommendedAction:
      'Review today\'s refunded orders for a common product, variant, or shipping method before the pattern spreads.',
    // Only the refunded value *above* the store's normal rate is abnormal.
    valueAtRisk: Number(Math.max(0, Number(today.refundAmount) - (baselineRate / 100) * todayRevenue).toFixed(2)),
    metadata: {
      date: todayKey,
      todayRefundRate: Number(todayRate.toFixed(2)),
      baselineRefundRate: Number(baselineRate.toFixed(2)),
      changePercent: Number(change.toFixed(1)),
      refundAmount: Number(today.refundAmount),
      revenue: Number(today.revenue),
      ordersToday: today.orders,
      baselineDays: baseline.length,
    },
  };
}

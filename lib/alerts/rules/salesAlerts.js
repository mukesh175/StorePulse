import prisma from '@/lib/prisma';
import { adminUrl } from '@/lib/shopify/urls';
import { formatMoney, percentChange } from '@/lib/utils/format';
import { localDateKey, dateOnly, shiftDateKey } from '@/lib/utils/dates';

export const SALES_ALERT_TYPES = ['SALES_REVENUE_DROP', 'SALES_ORDER_DROP', 'SALES_RECORD_DAY', 'SALES_REVENUE_UP'];

const MIN_BASELINE_DAYS = 7;
const MIN_BASELINE_ORDERS = 20;

async function windowMetrics(shopId, fromKey, toKey) {
  const rows = await prisma.dailyMetric.findMany({
    where: { shopId, date: { gte: dateOnly(fromKey), lte: dateOnly(toKey) } },
    orderBy: { date: 'asc' },
  });
  return rows;
}

function totals(rows) {
  return rows.reduce(
    (acc, m) => ({
      revenue: acc.revenue + Number(m.revenue),
      orders: acc.orders + m.orders,
      days: acc.days + 1,
    }),
    { revenue: 0, orders: 0, days: 0 }
  );
}

/**
 * Rule 5 — Sales drop (revenue and orders), plus the positive counterparts
 * that feed the daily brief's "good news" section.
 */
export async function evaluateSalesTrend(store, settings) {
  const dropPercent = settings?.salesDropPercent ?? 30;
  const todayKey = localDateKey(store.timezone);
  const yesterdayKey = shiftDateKey(todayKey, -1);

  const recent = await windowMetrics(store.id, shiftDateKey(yesterdayKey, -6), yesterdayKey);
  const previous = await windowMetrics(store.id, shiftDateKey(yesterdayKey, -13), shiftDateKey(yesterdayKey, -7));

  if (recent.length < MIN_BASELINE_DAYS || previous.length < MIN_BASELINE_DAYS) return [];

  const now = totals(recent);
  const before = totals(previous);
  if (before.orders < MIN_BASELINE_ORDERS) return [];

  const definitions = [];
  const revenueChange = percentChange(now.revenue, before.revenue);
  const orderChange = percentChange(now.orders, before.orders);
  const scope = yesterdayKey;

  if (revenueChange <= -dropPercent) {
    definitions.push({
      type: 'SALES_REVENUE_DROP',
      category: 'SALES',
      severity: 'CRITICAL',
      title: 'Revenue dropped sharply',
      message: `Revenue is down ${Math.abs(revenueChange).toFixed(0)}% compared with the previous 7 days.`,
      resourceType: 'METRIC',
      resourceId: 'revenue-7d',
      scope,
      resourceUrl: adminUrl(store.shopDomain, '/analytics'),
      whyItMatters: `You made ${formatMoney(now.revenue, store.currency)} over the last 7 days versus ${formatMoney(
        before.revenue,
        store.currency
      )} in the 7 days before.`,
      recommendedAction:
        'Check for sold-out best sellers, a paused ad campaign, or a broken checkout before assuming seasonality.',
      metadata: {
        recentRevenue: Number(now.revenue.toFixed(2)),
        previousRevenue: Number(before.revenue.toFixed(2)),
        changePercent: Number(revenueChange.toFixed(1)),
        window: '7d',
      },
    });
  } else if (revenueChange >= 20) {
    definitions.push({
      type: 'SALES_REVENUE_UP',
      category: 'SALES',
      severity: 'SUCCESS',
      title: 'Revenue is growing',
      message: `Revenue is up ${revenueChange.toFixed(0)}% compared with the previous 7 days.`,
      resourceType: 'METRIC',
      resourceId: 'revenue-7d',
      scope,
      whyItMatters: `${formatMoney(now.revenue, store.currency)} over 7 days, up from ${formatMoney(
        before.revenue,
        store.currency
      )}.`,
      recommendedAction: 'Make sure your best sellers have enough stock to sustain the trend.',
      metadata: {
        recentRevenue: Number(now.revenue.toFixed(2)),
        previousRevenue: Number(before.revenue.toFixed(2)),
        changePercent: Number(revenueChange.toFixed(1)),
      },
    });
  }

  if (orderChange <= -dropPercent) {
    definitions.push({
      type: 'SALES_ORDER_DROP',
      category: 'SALES',
      severity: 'WARNING',
      title: 'Order volume dropped',
      message: `Orders are down ${Math.abs(orderChange).toFixed(0)}% compared with the previous 7 days.`,
      resourceType: 'METRIC',
      resourceId: 'orders-7d',
      scope,
      whyItMatters: `${now.orders} orders over the last 7 days versus ${before.orders} in the period before.`,
      recommendedAction: 'Compare traffic sources — a volume drop with steady conversion usually means a traffic problem.',
      metadata: {
        recentOrders: now.orders,
        previousOrders: before.orders,
        changePercent: Number(orderChange.toFixed(1)),
      },
    });
  }

  return definitions;
}

/**
 * Positive signal for the brief: yesterday beat every day in the last 60.
 */
export async function evaluateRecordDay(store) {
  const todayKey = localDateKey(store.timezone);
  const yesterdayKey = shiftDateKey(todayKey, -1);

  const rows = await windowMetrics(store.id, shiftDateKey(yesterdayKey, -59), yesterdayKey);
  if (rows.length < 14) return null;

  const yesterday = rows[rows.length - 1];
  if (yesterday.date.toISOString().slice(0, 10) !== yesterdayKey) return null;

  const best = rows
    .slice(0, -1)
    .reduce((max, m) => Math.max(max, Number(m.revenue)), 0);
  if (Number(yesterday.revenue) <= best || best === 0) return null;

  return {
    type: 'SALES_RECORD_DAY',
    category: 'SALES',
    severity: 'SUCCESS',
    title: 'Record sales day',
    message: `Yesterday was your best revenue day in ${rows.length} days.`,
    resourceType: 'METRIC',
    resourceId: 'record-day',
    scope: yesterdayKey,
    whyItMatters: `${formatMoney(yesterday.revenue, store.currency)} beat your previous best of ${formatMoney(
      best,
      store.currency
    )}.`,
    recommendedAction: 'Check stock levels on your best sellers so the momentum is not cut short.',
    metadata: {
      revenue: Number(yesterday.revenue),
      previousBest: Number(best.toFixed(2)),
      date: yesterdayKey,
    },
  };
}

import prisma from '@/lib/prisma';
import { localDateKey, dateOnly, localDayRange, shiftDateKey, lastNDateKeys } from '@/lib/utils/dates';

/**
 * Aggregate one day's already-loaded orders. Pure — no I/O — so a whole window
 * can be computed from a single database read.
 */
function aggregate(orders, firstSeenBefore) {
  const active = orders.filter((o) => !o.isCancelled);
  const revenue = active.reduce((s, o) => s + Number(o.totalPrice), 0);
  const refundAmount = orders.reduce((s, o) => s + Number(o.refundedAmount), 0);
  const refunds = orders.filter((o) => Number(o.refundedAmount) > 0).length;
  const unitsSold = active.reduce((s, o) => s + o.lineItems.reduce((n, li) => n + li.quantity, 0), 0);

  const uniqueEmails = [...new Set(active.map((o) => o.customerEmail).filter(Boolean))];
  const returningCustomers = uniqueEmails.filter((email) => firstSeenBefore(email)).length;

  return {
    revenue,
    orders: active.length,
    averageOrderValue: active.length ? revenue / active.length : 0,
    refunds,
    refundAmount,
    unitsSold,
    customers: uniqueEmails.length,
    newCustomers: uniqueEmails.length - returningCustomers,
    returningCustomers,
  };
}

/**
 * Recompute DailyMetric rows for a window of local calendar days.
 *
 * Cost is a fixed handful of queries regardless of window size: one read for
 * the orders in range, one for each customer's earliest order, then one upsert
 * per day. The previous per-day/per-customer version issued thousands of
 * round-trips and could not finish inside a serverless request.
 */
export async function computeMetricsForRange(store, dateKeys) {
  if (!dateKeys.length) return [];

  const windowStart = localDayRange(store.timezone, dateKeys[0]).start;
  const windowEnd = localDayRange(store.timezone, dateKeys[dateKeys.length - 1]).end;

  const orders = await prisma.order.findMany({
    where: { shopId: store.id, processedAt: { gte: windowStart, lt: windowEnd } },
    include: { lineItems: { select: { quantity: true } } },
  });

  // One query resolves "is this a returning customer?" for every customer in
  // the window, by finding when each of them first ordered.
  const emails = [...new Set(orders.map((o) => o.customerEmail).filter(Boolean))];
  const firstOrders = emails.length
    ? await prisma.order.groupBy({
        by: ['customerEmail'],
        where: { shopId: store.id, customerEmail: { in: emails } },
        _min: { processedAt: true },
      })
    : [];
  const firstOrderAt = new Map(firstOrders.map((r) => [r.customerEmail, r._min.processedAt]));

  // Bucket orders by their local calendar day.
  const buckets = new Map(dateKeys.map((key) => [key, []]));
  const ranges = dateKeys.map((key) => ({ key, ...localDayRange(store.timezone, key) }));

  for (const order of orders) {
    const range = ranges.find((r) => order.processedAt >= r.start && order.processedAt < r.end);
    if (range) buckets.get(range.key).push(order);
  }

  const results = [];
  for (const { key, start } of ranges) {
    const data = aggregate(buckets.get(key), (email) => {
      const first = firstOrderAt.get(email);
      return Boolean(first && first < start);
    });

    results.push(
      await prisma.dailyMetric.upsert({
        where: { shopId_date: { shopId: store.id, date: dateOnly(key) } },
        create: { shopId: store.id, date: dateOnly(key), ...data },
        update: data,
      })
    );
  }

  return results;
}

/** Recompute a single local day. */
export async function computeDailyMetric(store, dateKey) {
  const [metric] = await computeMetricsForRange(store, [dateKey]);
  return metric;
}

/** Recompute the trailing `days` window (default: today + yesterday). */
export async function refreshMetrics(store, { days = 2 } = {}) {
  const todayKey = localDateKey(store.timezone);
  const keys = [];
  for (let i = days - 1; i >= 0; i -= 1) keys.push(shiftDateKey(todayKey, -i));
  return computeMetricsForRange(store, keys);
}

/** Backfill an arbitrary window — used after the initial sync. */
export async function backfillMetrics(store, { days = 60 } = {}) {
  const todayKey = localDateKey(store.timezone);
  return computeMetricsForRange(store, lastNDateKeys(store.timezone, days, todayKey));
}

export async function getMetricSeries(store, days = 7) {
  const todayKey = localDateKey(store.timezone);
  const keys = lastNDateKeys(store.timezone, days, todayKey);
  const rows = await prisma.dailyMetric.findMany({
    where: { shopId: store.id, date: { gte: dateOnly(keys[0]), lte: dateOnly(todayKey) } },
    orderBy: { date: 'asc' },
  });

  const byKey = new Map(rows.map((r) => [r.date.toISOString().slice(0, 10), r]));

  return keys.map((key) => {
    const row = byKey.get(key);
    return {
      date: key,
      revenue: Number(row?.revenue ?? 0),
      orders: row?.orders ?? 0,
      refundAmount: Number(row?.refundAmount ?? 0),
      averageOrderValue: Number(row?.averageOrderValue ?? 0),
      unitsSold: row?.unitsSold ?? 0,
    };
  });
}

/**
 * Yesterday's headline numbers with the day-before comparison the dashboard
 * cards show.
 */
export async function getComparisonSummary(store) {
  const todayKey = localDateKey(store.timezone);
  const yesterdayKey = shiftDateKey(todayKey, -1);
  const dayBeforeKey = shiftDateKey(todayKey, -2);

  const rows = await prisma.dailyMetric.findMany({
    where: { shopId: store.id, date: { in: [dateOnly(yesterdayKey), dateOnly(dayBeforeKey), dateOnly(todayKey)] } },
  });
  const pick = (key) => rows.find((r) => r.date.toISOString().slice(0, 10) === key);

  const yesterday = pick(yesterdayKey);
  const dayBefore = pick(dayBeforeKey);
  const today = pick(todayKey);

  const asNumbers = (m) => ({
    revenue: Number(m?.revenue ?? 0),
    orders: m?.orders ?? 0,
    averageOrderValue: Number(m?.averageOrderValue ?? 0),
    refundAmount: Number(m?.refundAmount ?? 0),
    refunds: m?.refunds ?? 0,
    unitsSold: m?.unitsSold ?? 0,
    newCustomers: m?.newCustomers ?? 0,
    returningCustomers: m?.returningCustomers ?? 0,
  });

  return {
    dateKey: yesterdayKey,
    today: asNumbers(today),
    yesterday: asNumbers(yesterday),
    dayBefore: asNumbers(dayBefore),
  };
}

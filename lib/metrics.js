import prisma from '@/lib/prisma';
import { localDateKey, dateOnly, localDayRange, shiftDateKey, lastNDateKeys } from '@/lib/utils/dates';

/**
 * Recompute the DailyMetric row for one local calendar day from stored orders.
 * Cheap and idempotent — safe to run hourly.
 */
export async function computeDailyMetric(store, dateKey) {
  const { start, end } = localDayRange(store.timezone, dateKey);

  const orders = await prisma.order.findMany({
    where: { shopId: store.id, processedAt: { gte: start, lt: end } },
    include: { lineItems: { select: { quantity: true } } },
  });

  const active = orders.filter((o) => !o.isCancelled);
  const revenue = active.reduce((s, o) => s + Number(o.totalPrice), 0);
  const refundAmount = orders.reduce((s, o) => s + Number(o.refundedAmount), 0);
  const refunds = orders.filter((o) => Number(o.refundedAmount) > 0).length;
  const unitsSold = active.reduce((s, o) => s + o.lineItems.reduce((n, li) => n + li.quantity, 0), 0);

  const emails = active.map((o) => o.customerEmail).filter(Boolean);
  const uniqueEmails = [...new Set(emails)];

  // A customer is "returning" when we already have an earlier order from them.
  let returningCustomers = 0;
  for (const email of uniqueEmails) {
    const earlier = await prisma.order.count({
      where: { shopId: store.id, customerEmail: email, processedAt: { lt: start } },
    });
    if (earlier > 0) returningCustomers += 1;
  }

  const data = {
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

  return prisma.dailyMetric.upsert({
    where: { shopId_date: { shopId: store.id, date: dateOnly(dateKey) } },
    create: { shopId: store.id, date: dateOnly(dateKey), ...data },
    update: data,
  });
}

/** Recompute the trailing `days` window (default: today + yesterday). */
export async function refreshMetrics(store, { days = 2 } = {}) {
  const todayKey = localDateKey(store.timezone);
  const results = [];
  for (let i = 0; i < days; i += 1) {
    results.push(await computeDailyMetric(store, shiftDateKey(todayKey, -i)));
  }
  return results;
}

/** Backfill an arbitrary window — used after the initial sync. */
export async function backfillMetrics(store, { days = 60 } = {}) {
  const todayKey = localDateKey(store.timezone);
  for (const key of lastNDateKeys(store.timezone, days, todayKey)) {
    await computeDailyMetric(store, key);
  }
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

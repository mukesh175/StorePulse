import prisma from '@/lib/prisma';

/**
 * Customer segmentation derived from synced orders.
 *
 * Read-only by design: StorePulse describes who these customers are and what
 * changed, and the action it offers is an alert to the merchant — it never
 * contacts customers. That boundary is what our protected customer data
 * declaration and privacy policy state, so it must hold in the code too.
 *
 * Customers are keyed by email, which is the only identifier we store.
 */

export const SEGMENTS = {
  VIP: {
    id: 'VIP',
    label: 'VIP customers',
    emoji: '🟢',
    tone: 'success',
    description: 'Top 5% by lifetime value with more than one order.',
  },
  AT_RISK: {
    id: 'AT_RISK',
    label: 'At risk',
    emoji: '🟡',
    tone: 'warning',
    description: 'Previously frequent buyers who have not ordered in 60 days.',
  },
  LOST: {
    id: 'LOST',
    label: 'Lost',
    emoji: '🔴',
    tone: 'critical',
    description: 'Valuable customers with no order in 120 days.',
  },
  FIRST_TIME: {
    id: 'FIRST_TIME',
    label: 'First-time buyers',
    emoji: '🔵',
    tone: 'info',
    description: 'Customers who have ordered exactly once.',
  },
  LOYAL: {
    id: 'LOYAL',
    label: 'Loyal',
    emoji: '⭐',
    tone: 'neutral',
    description: 'Three or more orders and active in the last 60 days.',
  },
};

const DAY = 24 * 3600 * 1000;

/**
 * Build a per-customer profile from stored orders in a single query, then
 * classify in memory. One database read regardless of customer count.
 */
export async function buildCustomerProfiles(store, { days = 365 } = {}) {
  const since = new Date(Date.now() - days * DAY);

  const orders = await prisma.order.findMany({
    where: {
      shopId: store.id,
      isCancelled: false,
      customerEmail: { not: null },
      processedAt: { gte: since },
    },
    select: {
      customerEmail: true,
      customerName: true,
      totalPrice: true,
      refundedAmount: true,
      processedAt: true,
    },
    orderBy: { processedAt: 'asc' },
  });

  const byCustomer = new Map();

  for (const order of orders) {
    const key = order.customerEmail;
    const net = Number(order.totalPrice) - Number(order.refundedAmount);

    const existing = byCustomer.get(key) ?? {
      email: key,
      name: order.customerName,
      orders: 0,
      lifetimeValue: 0,
      firstOrderAt: order.processedAt,
      lastOrderAt: order.processedAt,
    };

    existing.orders += 1;
    existing.lifetimeValue += net;
    existing.name = existing.name || order.customerName;
    if (order.processedAt < existing.firstOrderAt) existing.firstOrderAt = order.processedAt;
    if (order.processedAt > existing.lastOrderAt) existing.lastOrderAt = order.processedAt;

    byCustomer.set(key, existing);
  }

  return [...byCustomer.values()].map((customer) => ({
    ...customer,
    averageOrderValue: customer.orders ? customer.lifetimeValue / customer.orders : 0,
    daysSinceLastOrder: Math.floor((Date.now() - customer.lastOrderAt.getTime()) / DAY),
  }));
}

function percentileThreshold(values, percentile) {
  if (!values.length) return Infinity;
  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.floor((percentile / 100) * sorted.length);
  return sorted[Math.min(index, sorted.length - 1)];
}

/**
 * Assign each customer to exactly one segment, most urgent first, so the
 * counts add up and a customer is never double-counted.
 */
export function classify(profiles) {
  const values = profiles.map((p) => p.lifetimeValue);
  const vipThreshold = percentileThreshold(values, 95);
  const medianValue = percentileThreshold(values, 50);

  const segments = Object.fromEntries(Object.keys(SEGMENTS).map((id) => [id, []]));

  for (const customer of profiles) {
    let segment;

    if (customer.orders >= 2 && customer.lifetimeValue >= vipThreshold && customer.daysSinceLastOrder <= 120) {
      segment = 'VIP';
    } else if (customer.lifetimeValue >= medianValue && customer.daysSinceLastOrder > 120) {
      segment = 'LOST';
    } else if (customer.orders >= 3 && customer.daysSinceLastOrder > 60) {
      segment = 'AT_RISK';
    } else if (customer.orders >= 3) {
      segment = 'LOYAL';
    } else if (customer.orders === 1) {
      segment = 'FIRST_TIME';
    } else {
      segment = 'LOYAL';
    }

    segments[segment].push(customer);
  }

  for (const list of Object.values(segments)) {
    list.sort((a, b) => b.lifetimeValue - a.lifetimeValue);
  }

  return segments;
}

export async function getSegments(store, options = {}) {
  const profiles = await buildCustomerProfiles(store, options);
  const segments = classify(profiles);

  const summary = Object.values(SEGMENTS).map((definition) => {
    const members = segments[definition.id];
    const value = members.reduce((sum, c) => sum + c.lifetimeValue, 0);
    return {
      ...definition,
      count: members.length,
      value,
      averageValue: members.length ? value / members.length : 0,
      members: members.slice(0, 25),
    };
  });

  return {
    totalCustomers: profiles.length,
    totalValue: profiles.reduce((sum, c) => sum + c.lifetimeValue, 0),
    segments: summary,
  };
}

/**
 * Billing is intentionally inert in V1: the plan catalogue and entitlement
 * checks are real, but no charge is ever created. Flip BILLING_ENABLED (and
 * implement `createSubscription` with appSubscriptionCreate) to switch it on
 * without touching any calling code.
 */
export const BILLING_ENABLED = process.env.BILLING_ENABLED === 'true';

export const PLANS = {
  FREE: {
    id: 'FREE',
    name: 'Free',
    price: 0,
    historyDays: 7,
    features: ['Daily digest', 'Basic alerts', '7-day history'],
  },
  STARTER: {
    id: 'STARTER',
    name: 'Starter',
    price: 9,
    historyDays: 30,
    features: ['Unlimited alerts', 'Instant email alerts', '30-day history'],
  },
  GROWTH: {
    id: 'GROWTH',
    name: 'Growth',
    price: 19,
    historyDays: 90,
    features: ['Advanced alerts', 'Product health', 'Profit alerts', '90-day history'],
  },
  PRO: {
    id: 'PRO',
    name: 'Pro',
    price: 49,
    historyDays: 365,
    features: ['Multiple stores', 'Team notifications', 'Advanced reporting', 'Agency features'],
  },
};

export function planFor(store) {
  return PLANS[store?.plan] ?? PLANS.FREE;
}

/** History window a store is entitled to. Enforced in reports/queries. */
export function historyWindowDays(store) {
  // While billing is disabled every store gets the full window so the MVP is
  // fully usable without a paid plan.
  return BILLING_ENABLED ? planFor(store).historyDays : PLANS.PRO.historyDays;
}

export function hasFeature(store, feature) {
  if (!BILLING_ENABLED) return true;
  return planFor(store).features.includes(feature);
}

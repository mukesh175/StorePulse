import prisma from '@/lib/prisma';
import { shopifyGraphQL } from '@/lib/shopify/client';

/**
 * Billing runs against Shopify's Admin API. Charges are created as `test`
 * charges on development stores, so nothing is ever really billed while
 * developing — Shopify decides that from the store's plan, not from us.
 *
 * Set BILLING_ENABLED=false to turn entitlement enforcement off entirely and
 * give every store the full feature set (useful for local work).
 */
export const BILLING_ENABLED = process.env.BILLING_ENABLED !== 'false';

// Feature keys are referenced from the code that enforces them, so a plan
// change can never silently fail to apply.
export const FEATURES = {
  INSTANT_EMAIL: 'INSTANT_EMAIL',
  ADVANCED_ALERTS: 'ADVANCED_ALERTS',
  PRODUCT_HEALTH: 'PRODUCT_HEALTH',
  PROFIT_ALERTS: 'PROFIT_ALERTS',
  WEEKLY_SUMMARY: 'WEEKLY_SUMMARY',
  TEAM_NOTIFICATIONS: 'TEAM_NOTIFICATIONS',
};

export const PLANS = {
  FREE: {
    id: 'FREE',
    name: 'Free',
    price: 0,
    // Reporting charts are the extra; alerts are the core promise, so the
    // alert window stays wider than the charting window on Free.
    historyDays: 3,
    alertHistoryDays: 7,
    features: [],
    highlights: ['Daily morning brief', 'Inventory & order alerts', '7-day alert history'],
  },
  STARTER: {
    id: 'STARTER',
    name: 'Starter',
    price: 9,
    historyDays: 30,
    alertHistoryDays: null,
    features: [FEATURES.INSTANT_EMAIL, FEATURES.WEEKLY_SUMMARY],
    highlights: [
      'Instant email the moment a critical issue happens',
      'Weekly summary',
      'Full alert history',
      '30-day reporting',
    ],
  },
  GROWTH: {
    id: 'GROWTH',
    name: 'Growth',
    price: 19,
    historyDays: 90,
    alertHistoryDays: null,
    features: [
      FEATURES.INSTANT_EMAIL,
      FEATURES.WEEKLY_SUMMARY,
      FEATURES.ADVANCED_ALERTS,
      FEATURES.PRODUCT_HEALTH,
      FEATURES.PROFIT_ALERTS,
    ],
    highlights: ['Everything in Starter', 'Profit leak detection', 'Product health alerts', '90-day reporting'],
  },
  PRO: {
    id: 'PRO',
    name: 'Pro',
    price: 49,
    historyDays: 365,
    alertHistoryDays: null,
    features: Object.values(FEATURES),
    highlights: ['Everything in Growth', 'Team notifications', 'Advanced reporting', '365-day reporting'],
  },
};

export const PLAN_ORDER = ['FREE', 'STARTER', 'GROWTH', 'PRO'];

export function planFor(store) {
  return PLANS[store?.plan] ?? PLANS.FREE;
}

/** How far back reports and metrics may look for this store. */
export function historyWindowDays(store) {
  if (!BILLING_ENABLED) return PLANS.PRO.historyDays;
  return planFor(store).historyDays;
}

/** How far back the Alert Center may look. null means unlimited. */
export function alertHistoryDays(store) {
  if (!BILLING_ENABLED) return null;
  return planFor(store).alertHistoryDays ?? null;
}

export function hasFeature(store, feature) {
  if (!BILLING_ENABLED) return true;
  return planFor(store).features.includes(feature);
}

// ---------------------------------------------------------------------------
// Shopify Billing API
// ---------------------------------------------------------------------------

const ACTIVE_SUBSCRIPTIONS = `
  query ActiveSubscriptions {
    currentAppInstallation {
      activeSubscriptions { id name status test createdAt }
    }
  }
`;

/**
 * This app uses **Shopify App Pricing** (managed pricing): plans are declared
 * in the Partner Dashboard and Shopify owns the entire purchase flow.
 *
 * Creating charges with appSubscriptionCreate is rejected outright in that
 * mode — "Cannot use the Billing API (to create charges) when on Shopify App
 * Pricing" — so upgrades send the merchant to Shopify's own plan page instead.
 * Shopify then handles approval, decline, cancellation and re-approval after a
 * reinstall, which is exactly what app review requires.
 */
export function managedPricingUrl(store) {
  const handle = process.env.SHOPIFY_APP_HANDLE || 'storepulse-store-alert';
  const storeHandle = String(store.shopDomain).replace('.myshopify.com', '');
  return `https://admin.shopify.com/store/${storeHandle}/charges/${handle}/pricing_plans`;
}

/** Shopify is the source of truth; this reconciles our cached plan with it. */
export async function syncSubscriptionState(store) {
  const data = await shopifyGraphQL(store, ACTIVE_SUBSCRIPTIONS);
  const active = data.currentAppInstallation?.activeSubscriptions ?? [];
  const current = active.find((s) => s.status === 'ACTIVE') ?? null;

  const planId = current ? planIdFromSubscriptionName(current.name) : 'FREE';

  const updated = await prisma.store.update({
    where: { id: store.id },
    data: {
      plan: planId,
      subscriptionId: current?.id ?? null,
      subscriptionStatus: current?.status ?? null,
      planActivatedAt: current ? new Date(current.createdAt) : null,
    },
  });

  return { store: updated, subscription: current };
}

export function planIdFromSubscriptionName(name) {
  const match = PLAN_ORDER.find((id) => name?.toUpperCase().includes(PLANS[id].name.toUpperCase()));
  return match ?? 'FREE';
}

/**
 * Under managed pricing, cancelling is also Shopify's to perform — the same
 * plan page offers it. We only mirror the result, which arrives via the
 * app_subscriptions/update webhook.
 */
export async function clearLocalPlan(store) {
  return prisma.store.update({
    where: { id: store.id },
    data: { plan: 'FREE', subscriptionId: null, subscriptionStatus: null, planActivatedAt: null },
  });
}

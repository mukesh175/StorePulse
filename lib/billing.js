import prisma from '@/lib/prisma';
import { shopifyGraphQL } from '@/lib/shopify/client';
import { env } from '@/lib/env';

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
  WEEKLY_SUMMARY: 'WEEKLY_SUMMARY',
  TEAM_NOTIFICATIONS: 'TEAM_NOTIFICATIONS',
};

export const PLANS = {
  FREE: {
    id: 'FREE',
    name: 'Free',
    price: 0,
    historyDays: 7,
    features: [],
    highlights: ['Daily digest', 'Inventory & order alerts', '7-day history'],
  },
  STARTER: {
    id: 'STARTER',
    name: 'Starter',
    price: 9,
    historyDays: 30,
    features: [FEATURES.INSTANT_EMAIL, FEATURES.WEEKLY_SUMMARY],
    highlights: ['Unlimited alerts', 'Instant critical emails', 'Weekly summary', '30-day history'],
  },
  GROWTH: {
    id: 'GROWTH',
    name: 'Growth',
    price: 19,
    historyDays: 90,
    features: [FEATURES.INSTANT_EMAIL, FEATURES.WEEKLY_SUMMARY, FEATURES.ADVANCED_ALERTS, FEATURES.PRODUCT_HEALTH],
    highlights: ['Everything in Starter', 'Product health alerts', 'Sales & refund analysis', '90-day history'],
  },
  PRO: {
    id: 'PRO',
    name: 'Pro',
    price: 49,
    historyDays: 365,
    features: Object.values(FEATURES),
    highlights: ['Everything in Growth', 'Team notifications', 'Advanced reporting', '365-day history'],
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

export function hasFeature(store, feature) {
  if (!BILLING_ENABLED) return true;
  return planFor(store).features.includes(feature);
}

// ---------------------------------------------------------------------------
// Shopify Billing API
// ---------------------------------------------------------------------------

const SUBSCRIPTION_CREATE = `
  mutation AppSubscriptionCreate($name: String!, $returnUrl: URL!, $test: Boolean!, $amount: Decimal!, $currency: CurrencyCode!) {
    appSubscriptionCreate(
      name: $name
      returnUrl: $returnUrl
      test: $test
      lineItems: [{
        plan: {
          appRecurringPricingDetails: {
            price: { amount: $amount, currencyCode: $currency }
            interval: EVERY_30_DAYS
          }
        }
      }]
    ) {
      confirmationUrl
      appSubscription { id status name }
      userErrors { field message }
    }
  }
`;

const ACTIVE_SUBSCRIPTIONS = `
  query ActiveSubscriptions {
    currentAppInstallation {
      activeSubscriptions { id name status test createdAt }
    }
  }
`;

const SUBSCRIPTION_CANCEL = `
  mutation AppSubscriptionCancel($id: ID!) {
    appSubscriptionCancel(id: $id) {
      appSubscription { id status }
      userErrors { field message }
    }
  }
`;

/**
 * Ask Shopify to create a subscription and return the URL the merchant must
 * visit to approve the charge. Nothing is charged until they approve.
 */
export async function createSubscription(store, planId) {
  const plan = PLANS[planId];
  if (!plan) throw new Error('Unknown plan');
  if (plan.price === 0) throw new Error('The Free plan does not require a subscription');

  const data = await shopifyGraphQL(store, SUBSCRIPTION_CREATE, {
    name: `StorePulse ${plan.name}`,
    returnUrl: `${env.appUrl}/api/billing/callback?plan=${plan.id}`,
    // Shopify only honours test charges on development stores; on a live store
    // this flag is ignored and a real charge is created.
    test: process.env.BILLING_TEST_CHARGES !== 'false',
    amount: plan.price.toFixed(2),
    currency: 'USD',
  });

  const result = data.appSubscriptionCreate;
  if (result.userErrors?.length) {
    throw new Error(result.userErrors.map((e) => e.message).join('; '));
  }

  return {
    confirmationUrl: result.confirmationUrl,
    subscriptionId: result.appSubscription?.id ?? null,
  };
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

/** Downgrade to Free by cancelling the active Shopify subscription. */
export async function cancelSubscription(store) {
  if (!store.subscriptionId) {
    return prisma.store.update({
      where: { id: store.id },
      data: { plan: 'FREE', subscriptionStatus: null, subscriptionId: null, planActivatedAt: null },
    });
  }

  const data = await shopifyGraphQL(store, SUBSCRIPTION_CANCEL, { id: store.subscriptionId });
  const result = data.appSubscriptionCancel;
  if (result.userErrors?.length) {
    throw new Error(result.userErrors.map((e) => e.message).join('; '));
  }

  return prisma.store.update({
    where: { id: store.id },
    data: { plan: 'FREE', subscriptionId: null, subscriptionStatus: 'CANCELLED', planActivatedAt: null },
  });
}

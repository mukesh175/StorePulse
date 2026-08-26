import { shopifyGraphQL } from '@/lib/shopify/client';
import { WEBHOOK_SUBSCRIPTION_MUTATION, WEBHOOKS_QUERY } from '@/lib/shopify/queries';
import { env } from '@/lib/env';

// Shopify GraphQL topic enum -> our webhook route segment.
export const WEBHOOK_TOPICS = [
  { topic: 'ORDERS_CREATE', path: 'orders-create' },
  { topic: 'ORDERS_UPDATED', path: 'orders-updated' },
  { topic: 'ORDERS_FULFILLED', path: 'orders-fulfilled' },
  { topic: 'REFUNDS_CREATE', path: 'refunds-create' },
  { topic: 'PRODUCTS_CREATE', path: 'products-create' },
  { topic: 'PRODUCTS_UPDATE', path: 'products-update' },
  { topic: 'PRODUCTS_DELETE', path: 'products-delete' },
  { topic: 'INVENTORY_LEVELS_UPDATE', path: 'inventory-levels-update' },
  { topic: 'CUSTOMERS_CREATE', path: 'customers-create' },
  { topic: 'APP_UNINSTALLED', path: 'app-uninstalled' },
  // Keeps the local plan in step with Shopify when a charge is approved,
  // declined, cancelled, frozen or expires.
  { topic: 'APP_SUBSCRIPTIONS_UPDATE', path: 'app-subscriptions-update' },
];

export function callbackUrlFor(path) {
  return `${env.appUrl}/api/webhooks/${path}`;
}

/**
 * Idempotently register every topic StorePulse needs. Shopify returns a
 * "already taken" user error when the subscription exists — treated as success.
 */
export async function registerWebhooks(store) {
  const results = [];

  let existing = [];
  try {
    const data = await shopifyGraphQL(store, WEBHOOKS_QUERY, { first: 100 });
    existing = data.webhookSubscriptions?.nodes ?? [];
  } catch {
    // Non-fatal: fall through and attempt creation for every topic.
  }

  for (const { topic, path } of WEBHOOK_TOPICS) {
    const callbackUrl = callbackUrlFor(path);
    const already = existing.some(
      (w) => w.topic === topic && w.endpoint?.callbackUrl === callbackUrl
    );
    if (already) {
      results.push({ topic, status: 'exists' });
      continue;
    }

    try {
      const data = await shopifyGraphQL(store, WEBHOOK_SUBSCRIPTION_MUTATION, { topic, callbackUrl });
      const userErrors = data.webhookSubscriptionCreate?.userErrors ?? [];
      if (userErrors.length) {
        const taken = userErrors.some((e) => /taken|already/i.test(e.message));
        results.push({ topic, status: taken ? 'exists' : 'error', message: userErrors[0].message });
      } else {
        results.push({ topic, status: 'created' });
      }
    } catch (error) {
      results.push({ topic, status: 'error', message: error.message });
    }
  }

  return results;
}

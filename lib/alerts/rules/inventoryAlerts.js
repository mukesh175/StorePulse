import prisma from '@/lib/prisma';
import { productAdminUrl } from '@/lib/shopify/urls';
import { formatMoney } from '@/lib/utils/format';

export const INVENTORY_ALERT_TYPES = ['INVENTORY_SOLD_OUT', 'INVENTORY_LOW_STOCK'];

function variantLabel(product, variant) {
  const suffix = variant.title && variant.title !== 'Default Title' ? ` — ${variant.title}` : '';
  return `${product.title}${suffix}`;
}

/**
 * A variant only counts as "sellable" when Shopify would actually have stopped
 * selling it: active product, published online, tracked inventory, and a DENY
 * policy (CONTINUE means the merchant deliberately oversells).
 */
export function isSellableAndBlocking(product, variant) {
  return (
    product.status?.toUpperCase() === 'ACTIVE' &&
    product.publishedOnline &&
    variant.inventoryTracked &&
    String(variant.inventoryPolicy).toUpperCase() === 'DENY'
  );
}

async function estimatedImpact(shopId, shopifyProductId, unitPrice) {
  // Units sold over the last 30 days give a grounded "what this costs you" number.
  const since = new Date(Date.now() - 30 * 24 * 3600 * 1000);
  const rows = await prisma.orderLineItem.findMany({
    where: {
      shopifyProductId,
      order: { shopId, processedAt: { gte: since }, isCancelled: false },
    },
    select: { quantity: true },
  });
  const units = rows.reduce((sum, r) => sum + r.quantity, 0);
  const perDay = units / 30;
  return { unitsLast30Days: units, estimatedDailyRevenueAtRisk: Number((perDay * Number(unitPrice || 0)).toFixed(2)) };
}

/**
 * Rule 1 — Unexpected sold out.
 * Rule 2 — Low inventory (threshold from AlertSetting).
 */
export async function evaluateVariant(store, { product, variant, previousQuantity, settings }) {
  const threshold = settings?.lowStockThreshold ?? 10;
  const current = variant.inventoryQuantity;
  const label = variantLabel(product, variant);
  const url = productAdminUrl(store.shopDomain, product.shopifyProductId);

  if (!isSellableAndBlocking(product, variant)) return null;

  if (current <= 0 && previousQuantity > 0) {
    const impact = await estimatedImpact(store.id, product.shopifyProductId, variant.price);
    return {
      type: 'INVENTORY_SOLD_OUT',
      category: 'INVENTORY',
      severity: 'CRITICAL',
      title: 'Product unexpectedly sold out',
      message: `${label} is now sold out.`,
      resourceType: 'VARIANT',
      resourceId: variant.shopifyVariantId,
      resourceUrl: url,
      whyItMatters:
        impact.unitsLast30Days > 0
          ? `This variant sold ${impact.unitsLast30Days} units in the last 30 days — roughly ${formatMoney(
              impact.estimatedDailyRevenueAtRisk,
              store.currency
            )} of revenue per day is now unavailable.`
          : 'This variant was available for sale and is now unpurchasable on your Online Store.',
      recommendedAction: 'Restock this variant, or review inventory allocation across locations.',
      metadata: {
        productId: product.shopifyProductId,
        productTitle: product.title,
        variantTitle: variant.title,
        sku: variant.sku,
        previousInventory: previousQuantity,
        currentInventory: current,
        price: Number(variant.price),
        ...impact,
      },
    };
  }

  if (current > 0 && current <= threshold) {
    return {
      type: 'INVENTORY_LOW_STOCK',
      category: 'INVENTORY',
      severity: 'WARNING',
      title: 'Low inventory',
      message: `${label} has only ${current} unit${current === 1 ? '' : 's'} remaining.`,
      resourceType: 'VARIANT',
      resourceId: variant.shopifyVariantId,
      resourceUrl: url,
      whyItMatters: `Stock is at or below your low-stock threshold of ${threshold} units.`,
      recommendedAction: 'Create a purchase order or transfer stock before this variant sells out.',
      metadata: {
        productId: product.shopifyProductId,
        productTitle: product.title,
        variantTitle: variant.title,
        sku: variant.sku,
        previousInventory: previousQuantity,
        currentInventory: current,
        threshold,
      },
    };
  }

  return null;
}

/**
 * Full inventory sweep over local data — used by the scan cron and onboarding.
 */
export async function scanInventory(store, settings) {
  const threshold = settings?.lowStockThreshold ?? 10;

  const products = await prisma.product.findMany({
    where: { shopId: store.id, status: 'ACTIVE', publishedOnline: true },
    include: {
      variants: {
        where: { inventoryTracked: true, inventoryQuantity: { lte: threshold } },
      },
    },
  });

  const definitions = [];
  for (const product of products) {
    for (const variant of product.variants) {
      const definition = await evaluateVariant(store, {
        product,
        variant,
        previousQuantity: Math.max(variant.previousQuantity, variant.inventoryQuantity + 1),
        settings,
      });
      if (definition) definitions.push(definition);
    }
  }
  return definitions;
}

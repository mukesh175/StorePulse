import prisma from '@/lib/prisma';
import { productAdminUrl } from '@/lib/shopify/urls';
import { formatMoney, percentChange } from '@/lib/utils/format';
import { localDateKey, shiftDateKey, localDayRange } from '@/lib/utils/dates';

export const PRODUCT_ALERT_TYPES = ['PRODUCT_SALES_DROP', 'PRODUCT_DEMAND_SPIKE'];

const MIN_UNITS_PREVIOUS = 10;

async function unitsByProduct(shopId, start, end) {
  const rows = await prisma.orderLineItem.groupBy({
    by: ['shopifyProductId'],
    where: {
      shopifyProductId: { not: null },
      order: { shopId, isCancelled: false, processedAt: { gte: start, lt: end } },
    },
    _sum: { quantity: true },
  });

  const map = new Map();
  for (const row of rows) map.set(row.shopifyProductId, row._sum.quantity ?? 0);
  return map;
}

/**
 * Rule 6 — Product performance. Compares the last 7 days of unit sales per
 * product with the 7 days before, and flags meaningful swings in either
 * direction. Products with too little history are skipped.
 */
export async function evaluateProductPerformance(store, settings) {
  const dropPercent = settings?.salesDropPercent ?? 30;
  const todayKey = localDateKey(store.timezone);

  const recentStart = localDayRange(store.timezone, shiftDateKey(todayKey, -7)).start;
  const recentEnd = localDayRange(store.timezone, todayKey).start;
  const previousStart = localDayRange(store.timezone, shiftDateKey(todayKey, -14)).start;

  const recent = await unitsByProduct(store.id, recentStart, recentEnd);
  const previous = await unitsByProduct(store.id, previousStart, recentStart);

  const candidates = [...previous.entries()].filter(([, units]) => units >= MIN_UNITS_PREVIOUS);
  if (!candidates.length) return [];

  const products = await prisma.product.findMany({
    where: { shopId: store.id, shopifyProductId: { in: candidates.map(([id]) => id) } },
    include: { variants: { select: { price: true } } },
  });
  const productById = new Map(products.map((p) => [p.shopifyProductId, p]));

  const definitions = [];

  for (const [productId, previousUnits] of candidates) {
    const product = productById.get(productId);
    if (!product) continue;

    const recentUnits = recent.get(productId) ?? 0;
    const change = percentChange(recentUnits, previousUnits);
    const price = Number(product.variants[0]?.price ?? 0);
    const url = productAdminUrl(store.shopDomain, productId);
    const soldOut = product.totalInventory <= 0;

    if (change <= -dropPercent) {
      definitions.push({
        type: 'PRODUCT_SALES_DROP',
        category: 'PRODUCTS',
        severity: change <= -60 ? 'CRITICAL' : 'WARNING',
        title: 'Product sales dropped',
        message: `${product.title} sales dropped ${Math.abs(change).toFixed(0)}% compared with the previous period.`,
        resourceType: 'PRODUCT',
        resourceId: productId,
        resourceUrl: url,
        whyItMatters: soldOut
          ? `${product.title} is out of stock, which fully explains the drop — about ${formatMoney(
              previousUnits * price,
              store.currency
            )} of weekly revenue is unavailable.`
          : `${previousUnits} units sold in the previous 7 days versus ${recentUnits} in the last 7 — roughly ${formatMoney(
              (previousUnits - recentUnits) * price,
              store.currency
            )} of lost weekly revenue.`,
        recommendedAction: soldOut
          ? 'Restock this product — inventory, not demand, is the constraint.'
          : 'Check product availability, pricing changes, and whether it is still surfaced in collections or ads.',
        metadata: {
          productId,
          productTitle: product.title,
          recentUnits,
          previousUnits,
          changePercent: Number(change.toFixed(1)),
          inventory: product.totalInventory,
          soldOut,
        },
      });
    } else if (change >= 100 && recentUnits >= 20) {
      definitions.push({
        type: 'PRODUCT_DEMAND_SPIKE',
        category: 'PRODUCTS',
        severity: product.totalInventory <= recentUnits ? 'WARNING' : 'INFO',
        title: 'Product demand is spiking',
        message: `${product.title} sales increased ${change.toFixed(0)}% compared with the previous period.`,
        resourceType: 'PRODUCT',
        resourceId: productId,
        resourceUrl: url,
        whyItMatters: `${recentUnits} units sold in 7 days, up from ${previousUnits}. Current stock is ${product.totalInventory} units.`,
        recommendedAction:
          product.totalInventory <= recentUnits
            ? 'Reorder now — at the current rate this product runs out within a week.'
            : 'Keep stock topped up and consider featuring this product more prominently.',
        metadata: {
          productId,
          productTitle: product.title,
          recentUnits,
          previousUnits,
          changePercent: Number(change.toFixed(1)),
          inventory: product.totalInventory,
        },
      });
    }
  }

  return definitions;
}

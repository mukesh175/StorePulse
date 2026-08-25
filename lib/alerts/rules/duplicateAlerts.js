import prisma from '@/lib/prisma';
import { productAdminUrl, adminUrl } from '@/lib/shopify/urls';

export const DUPLICATE_ALERT_TYPES = ['PRODUCT_DUPLICATE', 'VARIANT_DUPLICATE_SKU'];

/**
 * Duplicate detection.
 *
 * A merchant adding the same product twice is easy to do and expensive to
 * miss: inventory is split across two listings, one of them silently sells out
 * while the other holds stock, reviews and sales history are divided, and the
 * storefront shows the same thing twice.
 *
 * Two independent signals, because either alone produces false positives:
 *   - identical normalised titles among live products
 *   - the same SKU on variants of different products
 */

/** Lowercase, strip punctuation, collapse whitespace — "Black  Hoodie!" == "black hoodie". */
export function normalizeTitle(title) {
  return String(title || '')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export async function evaluateDuplicates(store) {
  const products = await prisma.product.findMany({
    where: { shopId: store.id, status: 'ACTIVE' },
    select: {
      shopifyProductId: true,
      title: true,
      handle: true,
      totalInventory: true,
      publishedOnline: true,
      createdAt: true,
      variants: { select: { sku: true, shopifyVariantId: true } },
    },
  });

  const definitions = [];

  // --- same title -----------------------------------------------------------
  const byTitle = new Map();
  for (const product of products) {
    const key = normalizeTitle(product.title);
    if (!key) continue;
    if (!byTitle.has(key)) byTitle.set(key, []);
    byTitle.get(key).push(product);
  }

  for (const [, group] of byTitle) {
    if (group.length < 2) continue;

    // Oldest first: that is almost always the one to keep.
    group.sort((a, b) => a.createdAt - b.createdAt);
    const [original, ...copies] = group;
    const liveCopies = group.filter((p) => p.publishedOnline).length;
    const splitInventory = group.reduce((sum, p) => sum + p.totalInventory, 0);

    definitions.push({
      type: 'PRODUCT_DUPLICATE',
      category: 'PRODUCTS',
      // Two live listings of the same product actively harms the storefront.
      severity: liveCopies >= 2 ? 'WARNING' : 'INFO',
      title: 'Duplicate product detected',
      message: `${group.length} active products share the name “${original.title}”.`,
      resourceType: 'PRODUCT',
      resourceId: original.shopifyProductId,
      scope: normalizeTitle(original.title),
      resourceUrl: productAdminUrl(store.shopDomain, original.shopifyProductId),
      whyItMatters:
        liveCopies >= 2
          ? `Both listings are live on your Online Store, so ${splitInventory} units of stock are split between them. One can sell out while the other still has inventory, and reviews, sales history and search ranking are divided.`
          : `Only one of these is published, but the duplicate still splits your ${splitInventory} units of stock and clutters your catalogue.`,
      recommendedAction:
        'Keep the original listing, move any stock onto it, then archive or delete the duplicate.',
      metadata: {
        productTitle: original.title,
        duplicateCount: group.length,
        liveCount: liveCopies,
        totalInventory: splitInventory,
        keepProductId: original.shopifyProductId,
        duplicateProductIds: copies.map((p) => p.shopifyProductId),
        handles: group.map((p) => p.handle).filter(Boolean),
      },
    });
  }

  // --- same SKU across different products -----------------------------------
  const bySku = new Map();
  for (const product of products) {
    for (const variant of product.variants) {
      const sku = (variant.sku || '').trim();
      if (!sku) continue;
      if (!bySku.has(sku)) bySku.set(sku, []);
      bySku.get(sku).push({ ...variant, product });
    }
  }

  for (const [sku, entries] of bySku) {
    const distinctProducts = [...new Set(entries.map((e) => e.product.shopifyProductId))];
    // Repeating a SKU inside one product is normal; across products it is not.
    if (distinctProducts.length < 2) continue;

    const titles = [...new Set(entries.map((e) => e.product.title))];

    definitions.push({
      type: 'VARIANT_DUPLICATE_SKU',
      category: 'PRODUCTS',
      severity: 'WARNING',
      title: 'Same SKU on more than one product',
      message: `SKU ${sku} is used by ${distinctProducts.length} different products.`,
      resourceType: 'PRODUCT',
      resourceId: distinctProducts[0],
      scope: sku,
      resourceUrl: adminUrl(store.shopDomain, '/products'),
      whyItMatters: `${titles.join(' and ')} share the SKU ${sku}. Stock counts, reporting and any integration keyed on SKU will disagree with reality.`,
      recommendedAction: 'Give each variant its own SKU, or merge the products if they are genuinely the same item.',
      metadata: {
        sku,
        productIds: distinctProducts,
        productTitles: titles,
        variantCount: entries.length,
      },
    });
  }

  return definitions;
}

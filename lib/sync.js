import prisma from '@/lib/prisma';
import { getProducts, getOrders, getShop, gidToId } from '@/lib/shopify/service';

function toDecimal(value) {
  const n = Number(value || 0);
  return Number.isFinite(n) ? n : 0;
}

export function mapProduct(node) {
  return {
    shopifyProductId: gidToId(node.id),
    title: node.title,
    handle: node.handle ?? null,
    status: node.status ?? 'ACTIVE',
    vendor: node.vendor ?? null,
    productType: node.productType ?? null,
    imageUrl: node.featuredImage?.url ?? null,
    publishedOnline: Boolean(node.publishedAt),
    totalInventory: Number(node.totalInventory ?? 0),
  };
}

export function mapVariant(node) {
  return {
    shopifyVariantId: gidToId(node.id),
    title: node.title ?? null,
    sku: node.sku ?? null,
    price: toDecimal(node.price),
    compareAtPrice: node.compareAtPrice != null ? toDecimal(node.compareAtPrice) : null,
    inventoryItemId: gidToId(node.inventoryItem?.id),
    inventoryQuantity: Number(node.inventoryQuantity ?? 0),
    inventoryPolicy: node.inventoryPolicy ?? 'DENY',
    inventoryTracked: node.inventoryItem?.tracked ?? true,
    availableForSale: Boolean(node.availableForSale),
  };
}

/**
 * Upsert one Shopify product (and its variants) into the database.
 * Returns { product, variantChanges } where variantChanges describes
 * inventory transitions the alert engine can react to.
 */
export async function upsertProduct(store, node) {
  const data = mapProduct(node);
  const existing = await prisma.product.findUnique({
    where: { shopId_shopifyProductId: { shopId: store.id, shopifyProductId: data.shopifyProductId } },
    include: { variants: true },
  });

  const product = await prisma.product.upsert({
    where: { shopId_shopifyProductId: { shopId: store.id, shopifyProductId: data.shopifyProductId } },
    create: { ...data, shopId: store.id },
    update: data,
  });

  const variantChanges = [];
  const incoming = node.variants?.nodes ?? [];

  for (const variantNode of incoming) {
    const v = mapVariant(variantNode);
    const before = existing?.variants.find((x) => x.shopifyVariantId === v.shopifyVariantId);
    const previousQuantity = before ? before.inventoryQuantity : v.inventoryQuantity;

    const variant = await prisma.productVariant.upsert({
      where: { productId_shopifyVariantId: { productId: product.id, shopifyVariantId: v.shopifyVariantId } },
      create: { ...v, productId: product.id, previousQuantity },
      update: { ...v, previousQuantity },
    });

    if (!before || before.inventoryQuantity !== v.inventoryQuantity) {
      variantChanges.push({ variant, product, previousQuantity, currentQuantity: v.inventoryQuantity });
    }
  }

  // Variants removed in Shopify should not linger locally.
  if (existing) {
    const incomingIds = incoming.map((n) => gidToId(n.id));
    const stale = existing.variants.filter((v) => !incomingIds.includes(v.shopifyVariantId));
    if (stale.length) {
      await prisma.productVariant.deleteMany({ where: { id: { in: stale.map((v) => v.id) } } });
    }
  }

  return { product, variantChanges };
}

export function mapOrder(node, storeCurrency) {
  const customer = node.customer;
  const name = [customer?.firstName, customer?.lastName].filter(Boolean).join(' ');
  const gateways = node.paymentGatewayNames ?? [];
  const gateway = gateways[0] ?? null;

  return {
    shopifyOrderId: gidToId(node.id),
    orderNumber: node.name,
    customerName: name || null,
    customerEmail: customer?.email ?? null,
    totalPrice: toDecimal(node.currentTotalPriceSet?.shopMoney?.amount),
    subtotalPrice: toDecimal(node.currentSubtotalPriceSet?.shopMoney?.amount),
    refundedAmount: toDecimal(node.totalRefundedSet?.shopMoney?.amount),
    currency: node.currentTotalPriceSet?.shopMoney?.currencyCode || storeCurrency,
    financialStatus: node.displayFinancialStatus ?? null,
    fulfillmentStatus: node.displayFulfillmentStatus ?? null,
    paymentGateway: gateway,
    isCOD: gateways.some((g) => /cash on delivery|cod/i.test(g)),
    isCancelled: Boolean(node.cancelledAt),
    lineItemCount: node.lineItems?.nodes?.length ?? 0,
    processedAt: node.processedAt ? new Date(node.processedAt) : new Date(node.createdAt),
    fulfilledAt: node.fulfillments?.[0]?.createdAt ? new Date(node.fulfillments[0].createdAt) : null,
  };
}

export async function upsertOrder(store, node) {
  const data = mapOrder(node, store.currency);

  const order = await prisma.order.upsert({
    where: { shopId_shopifyOrderId: { shopId: store.id, shopifyOrderId: data.shopifyOrderId } },
    create: { ...data, shopId: store.id },
    update: data,
  });

  const lineItems = node.lineItems?.nodes ?? [];
  if (lineItems.length) {
    await prisma.orderLineItem.deleteMany({ where: { orderId: order.id } });
    await prisma.orderLineItem.createMany({
      data: lineItems.map((li) => ({
        orderId: order.id,
        shopifyProductId: gidToId(li.product?.id),
        shopifyVariantId: gidToId(li.variant?.id),
        title: li.title,
        quantity: Number(li.quantity ?? 1),
        price: toDecimal(li.originalUnitPriceSet?.shopMoney?.amount),
      })),
    });
  }

  return order;
}

export async function syncProducts(store, { max = 500 } = {}) {
  const nodes = await getProducts(store, { max });
  const changes = [];
  for (const node of nodes) {
    const { variantChanges } = await upsertProduct(store, node);
    changes.push(...variantChanges);
  }
  return { count: nodes.length, variantChanges: changes };
}

export async function syncOrders(store, { max = 250, days = 60 } = {}) {
  const since = new Date(Date.now() - days * 24 * 3600 * 1000).toISOString();
  const nodes = await getOrders(store, { max, query: `processed_at:>='${since}'` });
  for (const node of nodes) {
    await upsertOrder(store, node);
  }
  return { count: nodes.length };
}

export async function syncShopProfile(store) {
  const shop = await getShop(store);
  return prisma.store.update({
    where: { id: store.id },
    data: {
      shopName: shop.name,
      email: shop.email,
      currency: shop.currencyCode,
      timezone: shop.ianaTimezone,
      countryCode: shop.billingAddress?.countryCodeV2 ?? null,
    },
  });
}

/**
 * Full initial synchronisation. Safe to re-run.
 */
export async function runFullSync(store, options = {}) {
  try {
    const updated = await syncShopProfile(store);
    const products = await syncProducts(updated, options);
    const orders = await syncOrders(updated, options);

    await prisma.store.update({
      where: { id: store.id },
      data: { lastSyncAt: new Date(), lastSyncError: null },
    });

    return { ok: true, store: updated, products, orders };
  } catch (error) {
    await prisma.store.update({
      where: { id: store.id },
      data: { lastSyncError: error.message?.slice(0, 500) ?? 'Unknown sync error' },
    });
    throw error;
  }
}

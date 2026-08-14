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

/**
 * `deadline` is an epoch-ms budget. Writing each record costs a round-trip to
 * Neon, so a large catalogue cannot finish inside one serverless invocation.
 * Rather than being killed mid-write, we stop cleanly and report `complete:
 * false` so the caller can resume — every write is an idempotent upsert, so
 * resuming re-does at most the current page.
 */
const outOfTime = (deadline) => deadline && Date.now() > deadline;

export async function syncProducts(store, { max = 500, deadline = null } = {}) {
  const nodes = await getProducts(store, { max });
  const changes = [];
  let written = 0;

  for (const node of nodes) {
    if (outOfTime(deadline)) return { count: written, total: nodes.length, complete: false, variantChanges: changes };
    const { variantChanges } = await upsertProduct(store, node);
    changes.push(...variantChanges);
    written += 1;
  }

  return { count: written, total: nodes.length, complete: true, variantChanges: changes };
}

export async function syncOrders(store, { max = 250, days = 60, deadline = null } = {}) {
  const since = new Date(Date.now() - days * 24 * 3600 * 1000).toISOString();
  const nodes = await getOrders(store, { max, query: `processed_at:>='${since}'` });
  let written = 0;

  for (const node of nodes) {
    if (outOfTime(deadline)) return { count: written, total: nodes.length, complete: false };
    await upsertOrder(store, node);
    written += 1;
  }

  return { count: written, total: nodes.length, complete: true };
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
 * Turns a raw Shopify error into something a merchant can act on.
 * Access-scope problems are by far the most common and are not retryable, so
 * they must say what to do rather than "we'll try again".
 */
export function explainSyncError(error) {
  const message = String(error?.message ?? '');

  if (/not approved to access|protected customer data/i.test(message)) {
    return 'Shopify has not granted this app access to order and customer data yet. In your Partner dashboard open the app, go to API access → Protected customer data access, request access to customer Name and Email, then reinstall the app.';
  }
  if (/access token|401|403/i.test(message)) {
    return 'Shopify rejected the access token. Reinstall StorePulse on this store to issue a new one.';
  }
  if (/throttl|429/i.test(message)) {
    return 'Shopify is rate limiting this store right now. The next scheduled sync will pick up where this one stopped.';
  }
  return message.slice(0, 300) || 'Unknown error while contacting Shopify.';
}

/**
 * Full initial synchronisation. Safe to re-run.
 *
 * Each phase is isolated: a store whose orders are blocked by missing
 * permissions still gets its catalogue synced and its inventory alerts, rather
 * than ending up with nothing at all.
 */
export async function runFullSync(store, options = {}) {
  const warnings = [];
  let updated = store;

  try {
    updated = await syncShopProfile(store);
  } catch (error) {
    warnings.push({ phase: 'shop', message: explainSyncError(error) });
  }

  let products = { count: 0, complete: true };
  try {
    products = await syncProducts(updated, options);
  } catch (error) {
    warnings.push({ phase: 'products', message: explainSyncError(error) });
  }

  let orders = { count: 0, complete: true };
  try {
    orders = await syncOrders(updated, options);
  } catch (error) {
    warnings.push({ phase: 'orders', message: explainSyncError(error) });
  }

  // Every phase failing means the connection itself is broken — that is a
  // genuine failure the caller should surface as an error.
  if (warnings.length === 3) {
    const error = new Error(warnings[0].message);
    await prisma.store.update({
      where: { id: store.id },
      data: { lastSyncError: error.message.slice(0, 500) },
    });
    throw error;
  }

  await prisma.store.update({
    where: { id: store.id },
    data: {
      lastSyncAt: new Date(),
      lastSyncError: warnings.length ? warnings.map((w) => w.message).join(' ').slice(0, 500) : null,
    },
  });

  return {
    ok: true,
    store: updated,
    products,
    orders,
    warnings,
    complete: products.complete !== false && orders.complete !== false,
  };
}

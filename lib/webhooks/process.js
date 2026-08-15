import prisma from '@/lib/prisma';
import { restOrderToRecord, restOrderLineItems, restProductToRecord, restVariantToRecord } from '@/lib/webhooks/mappers';
import { processAlerts } from '@/lib/alerts/engine';
import { evaluateVariant } from '@/lib/alerts/rules/inventoryAlerts';
import { getAlertSettings } from '@/lib/alerts/scan';
import { logPrivacyAction } from '@/lib/audit';

/**
 * Record the raw event first. The unique (shopDomain, topic, eventId)
 * constraint makes Shopify's at-least-once delivery harmless: a redelivered
 * webhook is recognised and skipped.
 */
export async function recordEvent({ shopDomain, topic, eventId, payload, shopId }) {
  try {
    return await prisma.webhookEvent.create({
      data: { shopDomain, topic, eventId, payload, shopId: shopId ?? null },
    });
  } catch (error) {
    if (error.code === 'P2002') return null; // already seen
    throw error;
  }
}

async function markProcessed(eventRow, error) {
  if (!eventRow) return;
  try {
    await updateEventRow(eventRow, error);
  } catch (updateError) {
    // shop/redact deletes the Store, which cascades this very row away.
    // Losing the audit update is expected there and must not fail the webhook.
    if (updateError.code !== 'P2025') throw updateError;
  }
}

async function updateEventRow(eventRow, error) {
  await prisma.webhookEvent.update({
    where: { id: eventRow.id },
    data: {
      processed: !error,
      processedAt: new Date(),
      attempts: { increment: 1 },
      error: error ? String(error.message).slice(0, 500) : null,
    },
  });
}

// --- individual topic handlers ------------------------------------------------

async function handleOrderUpsert(store, payload) {
  const data = restOrderToRecord(payload, store.currency);

  const order = await prisma.order.upsert({
    where: { shopId_shopifyOrderId: { shopId: store.id, shopifyOrderId: data.shopifyOrderId } },
    create: { ...data, shopId: store.id },
    update: data,
  });

  const lineItems = restOrderLineItems(payload);
  if (lineItems.length) {
    await prisma.orderLineItem.deleteMany({ where: { orderId: order.id } });
    await prisma.orderLineItem.createMany({
      data: lineItems.map((li) => ({ ...li, orderId: order.id })),
    });
  }

  return order;
}

async function handleRefundCreate(store, payload) {
  const shopifyOrderId = String(payload.order_id);
  const order = await prisma.order.findUnique({
    where: { shopId_shopifyOrderId: { shopId: store.id, shopifyOrderId } },
  });
  if (!order) return null;

  const amount = (payload.transactions || []).reduce((sum, tx) => sum + Number(tx.amount || 0), 0);

  return prisma.order.update({
    where: { id: order.id },
    data: {
      refundedAmount: Number(order.refundedAmount) + amount,
      financialStatus: amount >= Number(order.totalPrice) ? 'REFUNDED' : 'PARTIALLY_REFUNDED',
    },
  });
}

async function handleProductUpsert(store, payload) {
  const productData = restProductToRecord(payload);
  const existing = await prisma.product.findUnique({
    where: { shopId_shopifyProductId: { shopId: store.id, shopifyProductId: productData.shopifyProductId } },
    include: { variants: true },
  });

  const product = await prisma.product.upsert({
    where: { shopId_shopifyProductId: { shopId: store.id, shopifyProductId: productData.shopifyProductId } },
    create: { ...productData, shopId: store.id },
    update: productData,
  });

  const settings = await getAlertSettings(store);
  const definitions = [];

  for (const raw of payload.variants || []) {
    const v = restVariantToRecord(raw);
    const before = existing?.variants.find((x) => x.shopifyVariantId === v.shopifyVariantId);
    const previousQuantity = before ? before.inventoryQuantity : v.inventoryQuantity;

    const variant = await prisma.productVariant.upsert({
      where: { productId_shopifyVariantId: { productId: product.id, shopifyVariantId: v.shopifyVariantId } },
      create: { ...v, productId: product.id, previousQuantity },
      update: { ...v, previousQuantity },
    });

    if (previousQuantity !== v.inventoryQuantity || !before) {
      const definition = await evaluateVariant(store, { product, variant, previousQuantity, settings });
      if (definition) definitions.push(definition);
    }
  }

  if (definitions.length) await processAlerts(store, definitions);
  return product;
}

async function handleProductDelete(store, payload) {
  await prisma.product.deleteMany({
    where: { shopId: store.id, shopifyProductId: String(payload.id) },
  });
  await prisma.alert.updateMany({
    where: { shopId: store.id, resourceType: 'PRODUCT', resourceId: String(payload.id), status: 'OPEN' },
    data: { status: 'RESOLVED', resolvedAt: new Date() },
  });
}

async function handleInventoryLevelUpdate(store, payload) {
  const inventoryItemId = String(payload.inventory_item_id);
  const available = Number(payload.available ?? 0);

  const variant = await prisma.productVariant.findFirst({
    where: { inventoryItemId, product: { shopId: store.id } },
    include: { product: true },
  });
  if (!variant) return null;

  await prisma.inventorySnapshot.create({
    data: { shopId: store.id, inventoryItemId, available },
  });

  const previousQuantity = variant.inventoryQuantity;
  if (previousQuantity === available) return variant;

  const updated = await prisma.productVariant.update({
    where: { id: variant.id },
    data: { inventoryQuantity: available, previousQuantity, availableForSale: available > 0 },
  });

  await prisma.product.update({
    where: { id: variant.productId },
    data: { totalInventory: { increment: available - previousQuantity } },
  });

  const settings = await getAlertSettings(store);
  const definition = await evaluateVariant(store, {
    product: variant.product,
    variant: updated,
    previousQuantity,
    settings,
  });

  if (definition) {
    await processAlerts(store, [definition]);
  } else if (available > (settings.lowStockThreshold ?? 10)) {
    // Restocked: close any open inventory alert for this variant.
    await prisma.alert.updateMany({
      where: {
        shopId: store.id,
        resourceType: 'VARIANT',
        resourceId: variant.shopifyVariantId,
        status: { in: ['OPEN', 'ACKNOWLEDGED'] },
      },
      data: { status: 'RESOLVED', resolvedAt: new Date() },
    });
  }

  return updated;
}

async function handleAppUninstalled(store) {
  await prisma.store.update({
    where: { id: store.id },
    data: { uninstalledAt: new Date(), accessToken: '' },
  });
}

// --- mandatory privacy (GDPR) webhooks ---------------------------------------
// Shopify requires all three for any app it distributes, and verifies they
// respond 200. StorePulse stores very little customer data, but what it does
// store must be honoured here.

async function handleCustomerDataRequest(store, payload) {
  // We hold no customer profile of our own — only order rows mirrored from
  // Shopify, which the merchant can already export from the Admin. Nothing to
  // hand over, so this is an audited no-op.
  const email = payload?.customer?.email;
  const held = email
    ? await prisma.order.count({ where: { shopId: store.id, customerEmail: email } })
    : 0;

  await logPrivacyAction(store.id, 'DATA_REQUEST', held, 'customers/data_request webhook');
}

async function handleCustomerRedact(store, payload) {
  const email = payload?.customer?.email;
  if (!email) return;

  // Scrub the personal fields from mirrored orders; the numbers that feed
  // metrics and alerts stay intact.
  const { count } = await prisma.order.updateMany({
    where: { shopId: store.id, customerEmail: email },
    data: { customerEmail: null, customerName: null },
  });

  await logPrivacyAction(store.id, 'REDACT', count, 'customers/redact webhook');
}

async function handleShopRedact(store) {
  // Deleting the store cascades to products, orders, alerts, metrics,
  // preferences, notification logs and webhook events.
  await prisma.store.delete({ where: { id: store.id } });
}

const HANDLERS = {
  'customers/data_request': handleCustomerDataRequest,
  'customers/redact': handleCustomerRedact,
  'shop/redact': handleShopRedact,
  'orders/create': handleOrderUpsert,
  'orders/updated': handleOrderUpsert,
  'orders/fulfilled': handleOrderUpsert,
  'refunds/create': handleRefundCreate,
  'products/create': handleProductUpsert,
  'products/update': handleProductUpsert,
  'products/delete': handleProductDelete,
  'inventory_levels/update': handleInventoryLevelUpdate,
  'customers/create': async () => null, // recorded for history; no alert rule yet
  'app/uninstalled': handleAppUninstalled,
};

/**
 * Persist then process. Every handler is database-only and short — no Shopify
 * API calls happen inside the webhook request path.
 */
export async function processWebhook({ store, shopDomain, topic, eventId, payload }) {
  const eventRow = await recordEvent({
    shopDomain,
    topic,
    eventId,
    payload,
    shopId: store?.id,
  });

  if (!eventRow) return { duplicate: true };
  if (!store) {
    await markProcessed(eventRow, new Error('Unknown shop'));
    return { ignored: true };
  }

  const handler = HANDLERS[topic];
  if (!handler) {
    await markProcessed(eventRow, null);
    return { unhandled: true };
  }

  try {
    await handler(store, payload);
    await markProcessed(eventRow, null);
    return { ok: true };
  } catch (error) {
    console.error(`[storepulse] webhook ${topic} failed`, error);
    await markProcessed(eventRow, error);
    return { ok: false, error: error.message };
  }
}

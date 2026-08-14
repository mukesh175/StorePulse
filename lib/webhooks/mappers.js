/**
 * Shopify webhook payloads use the REST shape, not the GraphQL shape.
 * These mappers normalise them into the same objects our sync layer produces.
 */

const num = (v) => {
  const n = Number(v ?? 0);
  return Number.isFinite(n) ? n : 0;
};

export function restOrderToRecord(payload, storeCurrency) {
  const customer = payload.customer || {};
  const name = [customer.first_name, customer.last_name].filter(Boolean).join(' ');
  const gateways = payload.payment_gateway_names || [];
  const refunded = (payload.refunds || []).reduce(
    (sum, refund) =>
      sum +
      (refund.transactions || []).reduce((t, tx) => t + num(tx.amount), 0),
    0
  );

  const fulfillmentStatus = payload.fulfillment_status
    ? String(payload.fulfillment_status).toUpperCase()
    : 'UNFULFILLED';

  return {
    shopifyOrderId: String(payload.id),
    orderNumber: payload.name || `#${payload.order_number}`,
    customerName: name || null,
    customerEmail: payload.email || customer.email || null,
    totalPrice: num(payload.current_total_price ?? payload.total_price),
    subtotalPrice: num(payload.current_subtotal_price ?? payload.subtotal_price),
    refundedAmount: refunded,
    currency: payload.currency || storeCurrency,
    financialStatus: payload.financial_status ? String(payload.financial_status).toUpperCase() : null,
    fulfillmentStatus,
    paymentGateway: gateways[0] || payload.gateway || null,
    isCOD: gateways.some((g) => /cash on delivery|cod/i.test(g)),
    isCancelled: Boolean(payload.cancelled_at),
    lineItemCount: (payload.line_items || []).length,
    processedAt: new Date(payload.processed_at || payload.created_at),
    fulfilledAt: payload.fulfillments?.[0]?.created_at ? new Date(payload.fulfillments[0].created_at) : null,
  };
}

export function restOrderLineItems(payload) {
  return (payload.line_items || []).map((li) => ({
    shopifyProductId: li.product_id ? String(li.product_id) : null,
    shopifyVariantId: li.variant_id ? String(li.variant_id) : null,
    title: li.title || li.name || 'Item',
    quantity: Number(li.quantity ?? 1),
    price: num(li.price),
  }));
}

export function restProductToRecord(payload) {
  return {
    shopifyProductId: String(payload.id),
    title: payload.title,
    handle: payload.handle || null,
    status: (payload.status || 'active').toUpperCase(),
    vendor: payload.vendor || null,
    productType: payload.product_type || null,
    imageUrl: payload.image?.src || payload.images?.[0]?.src || null,
    publishedOnline: Boolean(payload.published_at),
    totalInventory: (payload.variants || []).reduce((s, v) => s + Number(v.inventory_quantity ?? 0), 0),
  };
}

export function restVariantToRecord(variant) {
  return {
    shopifyVariantId: String(variant.id),
    title: variant.title || null,
    sku: variant.sku || null,
    price: num(variant.price),
    compareAtPrice: variant.compare_at_price != null ? num(variant.compare_at_price) : null,
    inventoryItemId: variant.inventory_item_id ? String(variant.inventory_item_id) : null,
    inventoryQuantity: Number(variant.inventory_quantity ?? 0),
    inventoryPolicy: (variant.inventory_policy || 'deny').toUpperCase(),
    inventoryTracked: variant.inventory_management != null,
    availableForSale: Number(variant.inventory_quantity ?? 0) > 0 || variant.inventory_policy === 'continue',
  };
}

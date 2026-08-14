import { shopifyGraphQL, paginate } from '@/lib/shopify/client';
import {
  SHOP_QUERY,
  PRODUCTS_QUERY,
  PRODUCT_QUERY,
  ORDERS_QUERY,
  ORDER_QUERY,
  INVENTORY_ITEM_QUERY,
  CUSTOMERS_QUERY,
} from '@/lib/shopify/queries';

export const gidToId = (gid) => (gid ? String(gid).split('/').pop() : null);

export async function getShop(store) {
  const data = await shopifyGraphQL(store, SHOP_QUERY);
  return data.shop;
}

export async function getProducts(store, { max = 500 } = {}) {
  return paginate(store, PRODUCTS_QUERY, {}, (d) => d.products, { max, pageSize: 50 });
}

export async function getProduct(store, productGid) {
  const data = await shopifyGraphQL(store, PRODUCT_QUERY, { id: productGid });
  return data.product;
}

export async function getOrders(store, { max = 250, query = null } = {}) {
  return paginate(store, ORDERS_QUERY, { query }, (d) => d.orders, { max, pageSize: 50 });
}

export async function getOrder(store, orderGid) {
  const data = await shopifyGraphQL(store, ORDER_QUERY, { id: orderGid });
  return data.order;
}

export async function getInventory(store, inventoryItemGid) {
  const data = await shopifyGraphQL(store, INVENTORY_ITEM_QUERY, { id: inventoryItemGid });
  return data.inventoryItem;
}

export async function getCustomers(store, { max = 250, query = null } = {}) {
  return paginate(store, CUSTOMERS_QUERY, { query }, (d) => d.customers, { max, pageSize: 50 });
}

/**
 * Refunds are read from orders — the Admin GraphQL API exposes refund totals
 * per order, which is all the refund-spike rule needs.
 */
export async function getRefunds(store, { sinceISO } = {}) {
  const query = sinceISO ? `updated_at:>='${sinceISO}'` : null;
  const orders = await getOrders(store, { max: 250, query });
  return orders
    .filter((o) => Number(o.totalRefundedSet?.shopMoney?.amount || 0) > 0)
    .map((o) => ({
      orderId: gidToId(o.id),
      orderNumber: o.name,
      amount: Number(o.totalRefundedSet.shopMoney.amount),
      processedAt: o.processedAt,
    }));
}

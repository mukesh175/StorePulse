import prisma from '@/lib/prisma';
import { orderAdminUrl } from '@/lib/shopify/urls';
import { formatMoney, hoursSince } from '@/lib/utils/format';

export const ORDER_ALERT_TYPES = ['ORDER_DELAYED'];

const UNFULFILLED = ['UNFULFILLED', 'PARTIALLY_FULFILLED', 'IN_PROGRESS', 'ON_HOLD', 'SCHEDULED'];

/**
 * Rule 3 — Delayed order. Warning after `delayedOrderWarnHours`,
 * critical after `delayedOrderCritHours`.
 */
export async function scanDelayedOrders(store, settings) {
  const warnHours = settings?.delayedOrderWarnHours ?? 24;
  const critHours = settings?.delayedOrderCritHours ?? 48;
  const cutoff = new Date(Date.now() - warnHours * 3600 * 1000);

  const orders = await prisma.order.findMany({
    where: {
      shopId: store.id,
      isCancelled: false,
      processedAt: { lte: cutoff },
      fulfillmentStatus: { in: UNFULFILLED },
      financialStatus: { notIn: ['REFUNDED', 'VOIDED'] },
    },
    orderBy: { processedAt: 'asc' },
    take: 200,
  });

  return orders.map((order) => {
    const age = Math.floor(hoursSince(order.processedAt));
    const critical = age >= critHours;

    return {
      type: 'ORDER_DELAYED',
      category: 'ORDERS',
      severity: critical ? 'CRITICAL' : 'WARNING',
      title: critical ? 'Order severely delayed' : 'Order awaiting fulfillment',
      message: `Order ${order.orderNumber} has not been fulfilled for ${age} hours.`,
      resourceType: 'ORDER',
      resourceId: order.shopifyOrderId,
      resourceUrl: orderAdminUrl(store.shopDomain, order.shopifyOrderId),
      whyItMatters: `${formatMoney(order.totalPrice, order.currency)} of paid revenue is sitting unfulfilled${
        order.customerName ? ` for ${order.customerName}` : ''
      }. Delays this long are the most common driver of support tickets and chargebacks.`,
      recommendedAction: critical
        ? 'Fulfill or contact the customer today, and confirm the shipping method is available.'
        : 'Fulfill this order or check whether stock is available.',
      // The whole order value is exposed: an unfulfilled paid order is the
      // most common source of refunds and chargebacks.
      valueAtRisk: Number(order.totalPrice),
      metadata: {
        orderNumber: order.orderNumber,
        orderId: order.shopifyOrderId,
        customerName: order.customerName,
        customerEmail: order.customerEmail,
        totalPrice: Number(order.totalPrice),
        currency: order.currency,
        ageHours: age,
        fulfillmentStatus: order.fulfillmentStatus,
        isCOD: order.isCOD,
      },
    };
  });
}

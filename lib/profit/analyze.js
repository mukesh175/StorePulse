import prisma from '@/lib/prisma';
import { getCostSettings, asNumbers, getCostCoverage } from '@/lib/profit/costs';

/**
 * Profit analysis.
 *
 * Two kinds of number appear here and they are never mixed silently:
 *
 *   MEASURED  — comes from Shopify: revenue, refunds, discounts, shipping
 *               charged, unit cost, quantities.
 *   ESTIMATED — derives from merchant assumptions Shopify cannot supply:
 *               real shipping cost, payment fees, COD/RTO losses, ad spend.
 *
 * Every returned figure carries the basis so the UI can label it, and a
 * product with no recorded cost reports `costKnown: false` rather than being
 * shown as pure profit.
 */

const DAY = 24 * 3600 * 1000;

async function loadOrders(shopId, days) {
  return prisma.order.findMany({
    where: {
      shopId,
      isCancelled: false,
      processedAt: { gte: new Date(Date.now() - days * DAY) },
    },
    include: { lineItems: true },
  });
}

/**
 * Order-level economics. Shipping, fees and RTO risk are order costs, so they
 * are allocated to products by each line's share of the order subtotal —
 * allocating them per unit would penalise cheap products unfairly.
 */
function orderEconomics(order, costs) {
  const revenue = Number(order.totalPrice);
  const refunded = Number(order.refundedAmount);
  const netRevenue = revenue - refunded;

  const paymentFee = (netRevenue * costs.paymentFeePercent) / 100;
  const shippingCost = costs.shippingCostPerOrder;

  // Expected RTO loss on a COD order: probability × what a failed delivery costs.
  const rtoRisk = order.isCOD ? (costs.codRtoPercent / 100) * costs.codRtoCostPerOrder : 0;

  return {
    revenue,
    refunded,
    netRevenue,
    discounts: Number(order.totalDiscounts),
    shippingCharged: Number(order.shippingCharged),
    paymentFee,
    shippingCost,
    rtoRisk,
    orderCosts: paymentFee + shippingCost + rtoRisk,
  };
}

export async function analyzeProducts(store, { days = 30 } = {}) {
  const costSettings = await getCostSettings(store);
  const costs = asNumbers(costSettings);

  const [orders, variants] = await Promise.all([
    loadOrders(store.id, days),
    prisma.productVariant.findMany({
      where: { product: { shopId: store.id } },
      select: {
        shopifyVariantId: true,
        unitCost: true,
        price: true,
        inventoryQuantity: true,
        product: { select: { shopifyProductId: true, title: true, totalInventory: true } },
      },
    }),
  ]);

  const variantById = new Map(variants.map((v) => [v.shopifyVariantId, v]));
  const products = new Map();

  for (const order of orders) {
    const economics = orderEconomics(order, costs);
    const subtotal = order.lineItems.reduce((s, li) => s + Number(li.price) * li.quantity, 0);
    if (subtotal <= 0) continue;

    // Refunds are recorded at order level; attribute them proportionally.
    const refundShare = economics.revenue > 0 ? economics.refunded / economics.revenue : 0;

    for (const line of order.lineItems) {
      const productId = line.shopifyProductId;
      if (!productId) continue;

      const variant = variantById.get(line.shopifyVariantId);
      const lineRevenue = Number(line.price) * line.quantity;
      const share = lineRevenue / subtotal;

      const entry = products.get(productId) ?? {
        shopifyProductId: productId,
        title: variant?.product?.title ?? line.title,
        units: 0,
        orders: 0,
        revenue: 0,
        refunds: 0,
        cogs: 0,
        discounts: 0,
        shippingCharged: 0,
        allocatedOrderCosts: 0,
        codOrders: 0,
        costKnown: true,
        unitsWithoutCost: 0,
        inventory: variant?.product?.totalInventory ?? null,
      };

      entry.units += line.quantity;
      entry.orders += 1;
      entry.revenue += lineRevenue;
      entry.refunds += lineRevenue * refundShare;
      entry.discounts += economics.discounts * share;
      entry.shippingCharged += economics.shippingCharged * share;
      entry.allocatedOrderCosts += economics.orderCosts * share;
      if (order.isCOD) entry.codOrders += 1;

      if (variant?.unitCost != null) {
        entry.cogs += Number(variant.unitCost) * line.quantity;
      } else {
        entry.costKnown = false;
        entry.unitsWithoutCost += line.quantity;
      }

      products.set(productId, entry);
    }
  }

  const items = [...products.values()].map((entry) => {
    const netRevenue = entry.revenue - entry.refunds;
    const grossMargin = entry.costKnown ? netRevenue - entry.cogs : null;
    const contribution =
      grossMargin === null ? null : grossMargin + entry.shippingCharged - entry.allocatedOrderCosts;

    return {
      ...entry,
      netRevenue,
      grossMargin,
      contribution,
      contributionPercent: contribution !== null && netRevenue > 0 ? (contribution / netRevenue) * 100 : null,
      refundRate: entry.revenue > 0 ? (entry.refunds / entry.revenue) * 100 : 0,
      discountRate: entry.revenue > 0 ? (entry.discounts / entry.revenue) * 100 : 0,
      codShare: entry.orders > 0 ? (entry.codOrders / entry.orders) * 100 : 0,
    };
  });

  items.sort((a, b) => (a.contribution ?? 0) - (b.contribution ?? 0));

  const coverage = await getCostCoverage(store);

  const totals = items.reduce(
    (acc, item) => ({
      revenue: acc.revenue + item.revenue,
      netRevenue: acc.netRevenue + item.netRevenue,
      refunds: acc.refunds + item.refunds,
      discounts: acc.discounts + item.discounts,
      cogs: acc.cogs + item.cogs,
      orderCosts: acc.orderCosts + item.allocatedOrderCosts,
      contribution: acc.contribution + (item.contribution ?? 0),
    }),
    { revenue: 0, netRevenue: 0, refunds: 0, discounts: 0, cogs: 0, orderCosts: 0, contribution: 0 }
  );

  // Ad spend is blended across the window rather than attributed per product,
  // because Shopify has no attribution data to do it properly.
  const adSpend = (costs.monthlyAdSpend / 30) * days;
  totals.adSpend = adSpend;
  totals.netProfit = totals.contribution - adSpend;

  return { days, items, totals, costs, coverage };
}

/** Discount codes, ranked by what they cost against what they brought in. */
export async function analyzeDiscounts(store, { days = 30 } = {}) {
  const orders = await loadOrders(store.id, days);
  const byCode = new Map();

  for (const order of orders) {
    const discount = Number(order.totalDiscounts);
    if (discount <= 0) continue;

    for (const code of order.discountCodes.length ? order.discountCodes : ['(automatic)']) {
      const entry = byCode.get(code) ?? { code, orders: 0, revenue: 0, discount: 0, refunds: 0 };
      entry.orders += 1;
      entry.revenue += Number(order.totalPrice);
      // A single order can carry several codes; splitting avoids double count.
      entry.discount += discount / (order.discountCodes.length || 1);
      entry.refunds += Number(order.refundedAmount);
      byCode.set(code, entry);
    }
  }

  return [...byCode.values()]
    .map((entry) => ({
      ...entry,
      netRevenue: entry.revenue - entry.refunds,
      discountRate: entry.revenue > 0 ? (entry.discount / entry.revenue) * 100 : 0,
      averageOrderValue: entry.orders ? entry.revenue / entry.orders : 0,
    }))
    .sort((a, b) => b.discount - a.discount);
}

/** Shipping zones, by what they charge versus what they cost. */
export async function analyzeShippingZones(store, { days = 30 } = {}) {
  const costSettings = await getCostSettings(store);
  const costs = asNumbers(costSettings);
  const orders = await loadOrders(store.id, days);

  const byZone = new Map();

  for (const order of orders) {
    const zone = [order.shippingCountry, order.shippingProvince].filter(Boolean).join(' / ') || 'Unknown';
    const entry = byZone.get(zone) ?? { zone, orders: 0, revenue: 0, shippingCharged: 0, shippingCost: 0 };

    entry.orders += 1;
    entry.revenue += Number(order.totalPrice);
    entry.shippingCharged += Number(order.shippingCharged);
    entry.shippingCost += costs.shippingCostPerOrder;

    byZone.set(zone, entry);
  }

  return [...byZone.values()]
    .map((entry) => ({ ...entry, shippingGap: entry.shippingCharged - entry.shippingCost }))
    .sort((a, b) => a.shippingGap - b.shippingGap);
}

/** Customers whose refund behaviour is unusual. */
export async function analyzeRepeatRefunders(store, { days = 180 } = {}) {
  const orders = await prisma.order.findMany({
    where: {
      shopId: store.id,
      customerEmail: { not: null },
      processedAt: { gte: new Date(Date.now() - days * DAY) },
    },
    select: { customerEmail: true, customerName: true, totalPrice: true, refundedAmount: true, isCOD: true },
  });

  const byCustomer = new Map();

  for (const order of orders) {
    const entry = byCustomer.get(order.customerEmail) ?? {
      email: order.customerEmail,
      name: order.customerName,
      orders: 0,
      refundedOrders: 0,
      revenue: 0,
      refunded: 0,
      codOrders: 0,
    };

    entry.orders += 1;
    entry.revenue += Number(order.totalPrice);
    entry.refunded += Number(order.refundedAmount);
    if (Number(order.refundedAmount) > 0) entry.refundedOrders += 1;
    if (order.isCOD) entry.codOrders += 1;

    byCustomer.set(order.customerEmail, entry);
  }

  return [...byCustomer.values()]
    .filter((c) => c.refundedOrders >= 2)
    .map((c) => ({ ...c, refundRate: c.orders ? (c.refundedOrders / c.orders) * 100 : 0 }))
    .sort((a, b) => b.refunded - a.refunded);
}

/** Stock that is not selling — cash sitting on a shelf. */
export async function analyzeDeadStock(store, { days = 60 } = {}) {
  const since = new Date(Date.now() - days * DAY);

  const sold = await prisma.orderLineItem.groupBy({
    by: ['shopifyProductId'],
    where: { order: { shopId: store.id, isCancelled: false, processedAt: { gte: since } } },
    _sum: { quantity: true },
  });
  const soldIds = new Set(sold.filter((s) => (s._sum.quantity ?? 0) > 0).map((s) => s.shopifyProductId));

  const products = await prisma.product.findMany({
    where: { shopId: store.id, status: 'ACTIVE', totalInventory: { gt: 0 } },
    include: { variants: { select: { unitCost: true, price: true, inventoryQuantity: true } } },
  });

  return products
    .filter((p) => !soldIds.has(p.shopifyProductId))
    .map((p) => {
      const tiedUp = p.variants.reduce((sum, v) => {
        const unit = v.unitCost != null ? Number(v.unitCost) : Number(v.price);
        return sum + unit * Math.max(0, v.inventoryQuantity);
      }, 0);
      return {
        shopifyProductId: p.shopifyProductId,
        title: p.title,
        inventory: p.totalInventory,
        tiedUpCapital: tiedUp,
        costKnown: p.variants.every((v) => v.unitCost != null),
      };
    })
    .filter((p) => p.tiedUpCapital > 0)
    .sort((a, b) => b.tiedUpCapital - a.tiedUpCapital);
}

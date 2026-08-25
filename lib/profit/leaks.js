import {
  analyzeProducts,
  analyzeDiscounts,
  analyzeShippingZones,
  analyzeRepeatRefunders,
  analyzeDeadStock,
} from '@/lib/profit/analyze';
import { formatMoney } from '@/lib/utils/format';

/**
 * Turns the raw analysis into leaks, opportunities and a short list of
 * actions ranked by estimated monthly impact.
 *
 * Every finding carries `basis: 'MEASURED' | 'ESTIMATED'` and an `impact`
 * scaled to a month, so the actions list can rank across different kinds of
 * problem without comparing a 30-day figure to a 60-day one.
 */

const MIN_ORDERS = 5;
const MIN_UNITS = 5;

const monthly = (value, days) => (days === 30 ? value : (value / days) * 30);

export async function findLeaks(store, { days = 30 } = {}) {
  const [analysis, discounts, zones, refunders, deadStock] = await Promise.all([
    analyzeProducts(store, { days }),
    analyzeDiscounts(store, { days }),
    analyzeShippingZones(store, { days }),
    analyzeRepeatRefunders(store, { days: 180 }),
    analyzeDeadStock(store, { days: 60 }),
  ]);

  const currency = store.currency;
  const leaks = [];
  const opportunities = [];

  // --- products losing money -------------------------------------------------
  for (const product of analysis.items) {
    if (product.orders < MIN_ORDERS || product.contribution === null) continue;

    if (product.contribution < 0) {
      leaks.push({
        id: `product-negative-${product.shopifyProductId}`,
        kind: 'UNPROFITABLE_PRODUCT',
        title: `${product.title} is losing money`,
        detail: `${product.units} units sold, ${formatMoney(product.netRevenue, currency)} net revenue, but ${formatMoney(
          Math.abs(product.contribution),
          currency
        )} negative contribution after cost, refunds, discounts and order costs.`,
        impact: Math.abs(monthly(product.contribution, days)),
        basis: 'ESTIMATED',
        action: `Raise the price, cut the discount, or stop promoting ${product.title}.`,
        resourceId: product.shopifyProductId,
        breakdown: product,
      });
    } else if (product.contributionPercent !== null && product.contributionPercent < 10 && product.units >= MIN_UNITS) {
      leaks.push({
        id: `product-thin-${product.shopifyProductId}`,
        kind: 'LOW_MARGIN_PRODUCT',
        title: `${product.title} has almost no margin`,
        detail: `Contribution is ${product.contributionPercent.toFixed(1)}% of net revenue — ${formatMoney(
          product.contribution,
          currency
        )} on ${formatMoney(product.netRevenue, currency)}.`,
        impact: monthly(product.netRevenue * 0.05, days),
        basis: 'ESTIMATED',
        action: `A 5% price increase on ${product.title} would roughly double its contribution.`,
        resourceId: product.shopifyProductId,
        breakdown: product,
      });
    }

    // --- high-return products ------------------------------------------------
    if (product.refundRate > 15 && product.orders >= MIN_ORDERS) {
      leaks.push({
        id: `product-returns-${product.shopifyProductId}`,
        kind: 'HIGH_RETURN_PRODUCT',
        title: `${product.title} is returned unusually often`,
        detail: `${product.refundRate.toFixed(0)}% of its revenue was refunded — ${formatMoney(
          product.refunds,
          currency
        )} across ${product.orders} orders.`,
        impact: monthly(product.refunds, days),
        basis: 'MEASURED',
        action: 'Check sizing, product photos and description accuracy — most returns start with a wrong expectation.',
        resourceId: product.shopifyProductId,
        breakdown: product,
      });
    }

    // --- opportunities -------------------------------------------------------
    if (product.contributionPercent !== null && product.contributionPercent > 35 && product.units >= MIN_UNITS) {
      opportunities.push({
        id: `promote-${product.shopifyProductId}`,
        kind: 'PROMOTE_PRODUCT',
        title: `Promote ${product.title}`,
        detail: `It contributes ${product.contributionPercent.toFixed(0)}% of net revenue — your healthiest margin at real volume.`,
        impact: monthly(product.contribution * 0.3, days),
        basis: 'ESTIMATED',
        action: 'Give this product more prominence, or put ad budget behind it before lower-margin lines.',
        resourceId: product.shopifyProductId,
      });
    }
  }

  // --- discount codes destroying margin --------------------------------------
  for (const discount of discounts) {
    if (discount.orders < MIN_ORDERS) continue;
    if (discount.discountRate > 25) {
      leaks.push({
        id: `discount-${discount.code}`,
        kind: 'EXPENSIVE_DISCOUNT',
        title: `Discount code ${discount.code} is expensive`,
        detail: `It gave away ${formatMoney(discount.discount, currency)} across ${discount.orders} orders — ${discount.discountRate.toFixed(
          0
        )}% of the revenue it brought in.`,
        impact: monthly(discount.discount, days),
        basis: 'MEASURED',
        action: `Reduce the depth of ${discount.code}, add a minimum order value, or retire it.`,
        resourceId: discount.code,
      });
    }
  }

  // --- shipping zones losing money -------------------------------------------
  for (const zone of zones) {
    if (zone.orders < MIN_ORDERS || zone.shippingGap >= 0) continue;
    leaks.push({
      id: `zone-${zone.zone}`,
      kind: 'EXPENSIVE_SHIPPING_ZONE',
      title: `Shipping to ${zone.zone} costs more than you charge`,
      detail: `${zone.orders} orders charged ${formatMoney(zone.shippingCharged, currency)} in shipping against an estimated ${formatMoney(
        zone.shippingCost,
        currency
      )} of cost.`,
      impact: monthly(Math.abs(zone.shippingGap), days),
      basis: 'ESTIMATED',
      action: `Raise the shipping rate for ${zone.zone}, or lift your free-shipping threshold.`,
      resourceId: zone.zone,
    });
  }

  // --- repeat refunders --------------------------------------------------------
  const seriousRefunders = refunders.filter((c) => c.refundRate >= 50 && c.refundedOrders >= 2);
  if (seriousRefunders.length) {
    const total = seriousRefunders.reduce((s, c) => s + c.refunded, 0);
    leaks.push({
      id: 'repeat-refunders',
      kind: 'REPEAT_REFUNDERS',
      title: `${seriousRefunders.length} customers return most of what they order`,
      detail: `They account for ${formatMoney(total, currency)} of refunds across the last 180 days.`,
      impact: monthly(total / 6, 30),
      basis: 'MEASURED',
      action: 'Review these accounts before accepting further COD orders from them.',
      resourceId: 'repeat-refunders',
      customers: seriousRefunders.slice(0, 10),
    });
  }

  // --- COD exposure ------------------------------------------------------------
  const codOrders = analysis.items.reduce((s, p) => s + p.codOrders, 0);
  if (analysis.costs.codRtoPercent > 0 && codOrders >= MIN_ORDERS) {
    const rtoLoss = codOrders * (analysis.costs.codRtoPercent / 100) * analysis.costs.codRtoCostPerOrder;
    if (rtoLoss > 0) {
      leaks.push({
        id: 'cod-rto',
        kind: 'COD_RTO_EXPOSURE',
        title: 'Cash on delivery is costing you in failed deliveries',
        detail: `${codOrders} COD orders at your ${analysis.costs.codRtoPercent}% RTO rate works out to about ${formatMoney(
          rtoLoss,
          currency
        )} of loss.`,
        impact: monthly(rtoLoss, days),
        basis: 'ESTIMATED',
        action: 'Consider a partial prepaid requirement, or offer a small discount for prepaid orders.',
        resourceId: 'cod-rto',
      });
    }
  }

  // --- dead stock ---------------------------------------------------------------
  if (deadStock.length) {
    const tiedUp = deadStock.reduce((s, p) => s + p.tiedUpCapital, 0);
    opportunities.push({
      id: 'dead-stock',
      kind: 'DEAD_STOCK',
      title: `${deadStock.length} products have not sold in 60 days`,
      detail: `About ${formatMoney(tiedUp, currency)} of capital is sitting in stock that is not moving.`,
      impact: tiedUp * 0.1,
      basis: 'ESTIMATED',
      action: 'Bundle, discount or liquidate these to release the cash.',
      resourceId: 'dead-stock',
      products: deadStock.slice(0, 10),
    });
  }

  // --- free shipping threshold --------------------------------------------------
  if (analysis.costs.shippingCostPerOrder > 0) {
    const belowCost = zones.reduce((sum, z) => sum + Math.min(0, z.shippingGap), 0);
    if (belowCost < 0) {
      opportunities.push({
        id: 'free-shipping-threshold',
        kind: 'SHIPPING_THRESHOLD',
        title: 'Your free-shipping threshold is below what shipping costs you',
        detail: `Shipping is running about ${formatMoney(Math.abs(belowCost), currency)} below cost across your zones.`,
        impact: monthly(Math.abs(belowCost), days),
        basis: 'ESTIMATED',
        action:
          analysis.costs.freeShippingThreshold > 0
            ? `Raise the free-shipping threshold from ${formatMoney(analysis.costs.freeShippingThreshold, currency)}.`
            : 'Set a free-shipping threshold above your average shipping cost.',
        resourceId: 'free-shipping-threshold',
      });
    }
  }

  leaks.sort((a, b) => b.impact - a.impact);
  opportunities.sort((a, b) => b.impact - a.impact);

  return {
    days,
    analysis,
    discounts,
    zones,
    refunders,
    deadStock,
    leaks,
    opportunities,
    actions: buildActions(leaks, opportunities),
    totalLeakage: leaks.reduce((s, l) => s + l.impact, 0),
    totalOpportunity: opportunities.reduce((s, o) => s + o.impact, 0),
  };
}

/**
 * The three things worth doing today. Deliberately three: a list of twenty
 * findings gets ignored, which is the failure mode of every analytics app.
 */
export function buildActions(leaks, opportunities) {
  return [...leaks, ...opportunities]
    .filter((item) => item.impact > 0)
    .sort((a, b) => b.impact - a.impact)
    .slice(0, 3)
    .map((item) => ({
      id: item.id,
      title: item.action,
      context: item.title,
      impact: item.impact,
      basis: item.basis,
      kind: item.kind,
    }));
}

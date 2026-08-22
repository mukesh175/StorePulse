import prisma from '@/lib/prisma';
import { processAlerts, resolveStaleAlerts, fingerprintOf } from '@/lib/alerts/engine';
import { scanInventory, INVENTORY_ALERT_TYPES } from '@/lib/alerts/rules/inventoryAlerts';
import { scanDelayedOrders, ORDER_ALERT_TYPES } from '@/lib/alerts/rules/orderAlerts';
import { evaluateRefundSpike, REFUND_ALERT_TYPES } from '@/lib/alerts/rules/refundAlerts';
import { evaluateSalesTrend, evaluateRecordDay, SALES_ALERT_TYPES } from '@/lib/alerts/rules/salesAlerts';
import { evaluateProductPerformance, PRODUCT_ALERT_TYPES } from '@/lib/alerts/rules/productAlerts';
import { evaluateCustomerHealth, CUSTOMER_ALERT_TYPES } from '@/lib/alerts/rules/customerAlerts';
import { hasFeature, FEATURES } from '@/lib/billing';

export async function getAlertSettings(store) {
  const existing = await prisma.alertSetting.findUnique({ where: { shopId: store.id } });
  if (existing) return existing;
  return prisma.alertSetting.create({ data: { shopId: store.id } });
}

/**
 * Evaluate every enabled rule for a store, persist the results, and
 * auto-resolve alerts whose condition has cleared.
 */
export async function runAlertScan(store, { notify = true } = {}) {
  const settings = await getAlertSettings(store);
  const definitions = [];
  const scannedTypes = [];

  if (settings.inventoryAlertsEnabled) {
    definitions.push(...(await scanInventory(store, settings)));
    scannedTypes.push(...INVENTORY_ALERT_TYPES);
  }
  if (settings.orderAlertsEnabled) {
    definitions.push(...(await scanDelayedOrders(store, settings)));
    scannedTypes.push(...ORDER_ALERT_TYPES);
  }
  // Refund and sales analysis are "advanced alerts"; per-product health is its
  // own entitlement. Inventory and order alerts are on every plan.
  if (settings.refundAlertsEnabled && hasFeature(store, FEATURES.ADVANCED_ALERTS)) {
    const refund = await evaluateRefundSpike(store, settings);
    if (refund) definitions.push(refund);
    scannedTypes.push(...REFUND_ALERT_TYPES);
  }
  if (settings.salesAlertsEnabled && hasFeature(store, FEATURES.ADVANCED_ALERTS)) {
    definitions.push(...(await evaluateSalesTrend(store, settings)));
    const record = await evaluateRecordDay(store);
    if (record) definitions.push(record);
    scannedTypes.push(...SALES_ALERT_TYPES);
  }
  if (settings.productAlertsEnabled && hasFeature(store, FEATURES.PRODUCT_HEALTH)) {
    definitions.push(...(await evaluateProductPerformance(store, settings)));
    scannedTypes.push(...PRODUCT_ALERT_TYPES);
  }
  if (settings.salesAlertsEnabled && hasFeature(store, FEATURES.ADVANCED_ALERTS)) {
    definitions.push(...(await evaluateCustomerHealth(store)));
    scannedTypes.push(...CUSTOMER_ALERT_TYPES);
  }

  const processed = await processAlerts(store, definitions, { notify });

  const active = new Set(definitions.map(fingerprintOf));
  const resolved = await resolveStaleAlerts(store, scannedTypes, active);

  return {
    evaluated: definitions.length,
    created: processed.filter((p) => p.created).length,
    updated: processed.filter((p) => !p.created).length,
    resolved,
  };
}

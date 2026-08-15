import prisma from '@/lib/prisma';

/**
 * Access logging for protected customer data.
 *
 * StorePulse reads exactly two protected fields — customer name and email —
 * and every read path that surfaces them is recorded here. The log stores
 * *what* was accessed and by whom, never the values themselves, so the log
 * cannot become a second copy of the personal data it exists to protect.
 *
 * Logging must never break the request that triggered it.
 */
export const PROTECTED_FIELDS = ['customerName', 'customerEmail'];

export async function logDataAccess(shopId, { action, resourceType, recordCount = 0, fields = PROTECTED_FIELDS, actor = 'MERCHANT', context = null }) {
  if (!shopId) return null;

  try {
    return await prisma.dataAccessLog.create({
      data: { shopId, action, resourceType, recordCount, fields, actor, context },
    });
  } catch (error) {
    console.error('[storepulse] data access logging failed', error);
    return null;
  }
}

/** A merchant viewed a screen containing customer names/emails. */
export const logCustomerDataViewed = (shopId, resourceType, recordCount, context) =>
  logDataAccess(shopId, { action: 'VIEW', resourceType, recordCount, context });

/** Customer data entered the system from Shopify. */
export const logCustomerDataImported = (shopId, recordCount) =>
  logDataAccess(shopId, { action: 'IMPORT', resourceType: 'ORDER', recordCount, actor: 'SYSTEM', context: 'Shopify sync' });

/** A privacy request was carried out. */
export const logPrivacyAction = (shopId, action, recordCount, context) =>
  logDataAccess(shopId, { action, resourceType: 'CUSTOMER', recordCount, actor: 'SHOPIFY_WEBHOOK', context });

export async function listDataAccessLogs(shopId, { take = 50 } = {}) {
  return prisma.dataAccessLog.findMany({
    where: { shopId },
    orderBy: { createdAt: 'desc' },
    take,
  });
}

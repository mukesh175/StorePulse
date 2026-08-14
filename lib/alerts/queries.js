import prisma from '@/lib/prisma';

export const SEVERITY_ORDER = { CRITICAL: 0, WARNING: 1, INFO: 2, SUCCESS: 3 };

/**
 * Paginated alert listing with the filters the Alert Center exposes.
 * Every query is scoped to the authenticated shop.
 */
export async function listAlerts(shopId, { severity, category, status = 'ACTIVE', page = 1, pageSize = 20 } = {}) {
  const where = { shopId };

  if (status === 'ACTIVE') where.status = { in: ['OPEN', 'ACKNOWLEDGED'] };
  else if (status && status !== 'ALL') where.status = status;

  if (severity && severity !== 'ALL') where.severity = severity;
  if (category && category !== 'ALL') where.category = category;

  const skip = (Math.max(1, page) - 1) * pageSize;

  const [items, total] = await Promise.all([
    prisma.alert.findMany({
      where,
      orderBy: [{ severity: 'asc' }, { lastDetectedAt: 'desc' }],
      skip,
      take: pageSize,
    }),
    prisma.alert.count({ where }),
  ]);

  return { items, total, page, pageSize, pages: Math.max(1, Math.ceil(total / pageSize)) };
}

export async function getAlertFacets(shopId) {
  const [bySeverity, byCategory, resolved] = await Promise.all([
    prisma.alert.groupBy({
      by: ['severity'],
      where: { shopId, status: { in: ['OPEN', 'ACKNOWLEDGED'] } },
      _count: { _all: true },
    }),
    prisma.alert.groupBy({
      by: ['category'],
      where: { shopId, status: { in: ['OPEN', 'ACKNOWLEDGED'] } },
      _count: { _all: true },
    }),
    prisma.alert.count({ where: { shopId, status: 'RESOLVED' } }),
  ]);

  return {
    severity: Object.fromEntries(bySeverity.map((r) => [r.severity, r._count._all])),
    category: Object.fromEntries(byCategory.map((r) => [r.category, r._count._all])),
    resolved,
    active: bySeverity.reduce((s, r) => s + r._count._all, 0),
  };
}

export async function getAlert(shopId, id) {
  return prisma.alert.findFirst({ where: { id, shopId } });
}

const ACTIONS = {
  resolve: () => ({ status: 'RESOLVED', resolvedAt: new Date(), snoozedUntil: null }),
  dismiss: () => ({ status: 'DISMISSED', resolvedAt: new Date(), snoozedUntil: null }),
  acknowledge: () => ({ status: 'ACKNOWLEDGED' }),
  reopen: () => ({ status: 'OPEN', resolvedAt: null, snoozedUntil: null }),
  snooze: (hours = 24) => ({
    status: 'ACKNOWLEDGED',
    snoozedUntil: new Date(Date.now() + hours * 3600 * 1000),
  }),
};

export function isValidAction(action) {
  return Object.prototype.hasOwnProperty.call(ACTIONS, action);
}

/** Ownership is enforced by matching shopId in the same statement. */
export async function applyAlertAction(shopId, id, action, options = {}) {
  if (!isValidAction(action)) return null;

  const existing = await prisma.alert.findFirst({ where: { id, shopId }, select: { id: true } });
  if (!existing) return null;

  return prisma.alert.update({
    where: { id: existing.id },
    data: ACTIONS[action](options.hours),
  });
}

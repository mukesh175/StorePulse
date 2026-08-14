import crypto from 'crypto';
import prisma from '@/lib/prisma';
import { dispatchAlertNotification } from '@/lib/notifications/dispatch';

/**
 * The fingerprint is what makes StorePulse idempotent: the same underlying
 * condition always maps to the same alert row, so four inventory webhooks in a
 * row update one alert instead of creating (and emailing) four.
 */
export function buildFingerprint({ type, resourceId, scope }) {
  const raw = [type, resourceId ?? 'none', scope ?? ''].join('|');
  return crypto.createHash('sha1').update(raw).digest('hex');
}

const DEFAULT_CATEGORY_BY_PREFIX = [
  ['INVENTORY', 'INVENTORY'],
  ['ORDER', 'ORDERS'],
  ['REFUND', 'REFUNDS'],
  ['PRODUCT', 'PRODUCTS'],
  ['SALES', 'SALES'],
];

function inferCategory(type) {
  const match = DEFAULT_CATEGORY_BY_PREFIX.find(([prefix]) => type.startsWith(prefix));
  return match ? match[1] : 'SYSTEM';
}

/**
 * Create the alert, or refresh the existing open one.
 * Returns { alert, created } — `created` drives instant notifications.
 */
export async function upsertAlert(store, definition) {
  const {
    type,
    severity,
    title,
    message,
    category = inferCategory(type),
    resourceType = null,
    resourceId = null,
    resourceUrl = null,
    whyItMatters = null,
    recommendedAction = null,
    metadata = {},
    scope = null,
  } = definition;

  const fingerprint = buildFingerprint({ type, resourceId, scope });
  const now = new Date();

  const existing = await prisma.alert.findUnique({
    where: { shopId_fingerprint: { shopId: store.id, fingerprint } },
  });

  if (!existing) {
    const alert = await prisma.alert.create({
      data: {
        shopId: store.id,
        fingerprint,
        type,
        category,
        severity,
        title,
        message,
        resourceType,
        resourceId,
        resourceUrl,
        whyItMatters,
        recommendedAction,
        metadata,
        status: 'OPEN',
        firstDetectedAt: now,
        lastDetectedAt: now,
      },
    });
    return { alert, created: true };
  }

  // A resolved/dismissed alert that fires again is genuinely new information,
  // so it reopens; an already-open one is only refreshed.
  const reopening = existing.status === 'RESOLVED' || existing.status === 'DISMISSED';
  const snoozed = existing.snoozedUntil && existing.snoozedUntil > now;

  const alert = await prisma.alert.update({
    where: { id: existing.id },
    data: {
      severity,
      title,
      message,
      metadata,
      whyItMatters,
      recommendedAction,
      resourceUrl,
      lastDetectedAt: now,
      occurrences: { increment: 1 },
      ...(reopening
        ? { status: 'OPEN', resolvedAt: null, firstDetectedAt: now, notifiedAt: null, snoozedUntil: null }
        : {}),
    },
  });

  return { alert, created: reopening && !snoozed };
}

/**
 * Run a set of rule results through persistence + notification.
 * Rules stay pure: they only describe conditions, the engine owns side effects.
 */
export async function processAlerts(store, definitions, { notify = true } = {}) {
  const processed = [];

  for (const definition of definitions.filter(Boolean)) {
    const { alert, created } = await upsertAlert(store, definition);
    processed.push({ alert, created });

    if (notify && created) {
      // Notification failures must never break alert persistence.
      try {
        await dispatchAlertNotification(store, alert);
      } catch (error) {
        console.error('[storepulse] notification dispatch failed', error);
      }
    }
  }

  return processed;
}

/**
 * Auto-resolve open alerts of `type` whose condition no longer holds.
 * `activeFingerprints` is the set still detected in this run.
 */
export async function resolveStaleAlerts(store, types, activeFingerprints) {
  const open = await prisma.alert.findMany({
    where: { shopId: store.id, status: { in: ['OPEN', 'ACKNOWLEDGED'] }, type: { in: types } },
    select: { id: true, fingerprint: true },
  });

  const stale = open.filter((a) => !activeFingerprints.has(a.fingerprint));
  if (!stale.length) return 0;

  await prisma.alert.updateMany({
    where: { id: { in: stale.map((a) => a.id) } },
    data: { status: 'RESOLVED', resolvedAt: new Date() },
  });

  return stale.length;
}

export function fingerprintOf(definition) {
  return buildFingerprint({
    type: definition.type,
    resourceId: definition.resourceId,
    scope: definition.scope,
  });
}

import prisma from '@/lib/prisma';
import { sendEmail } from '@/lib/email/resend';
import { criticalAlertEmail, dailyDigestEmail, weeklySummaryEmail } from '@/lib/email/templates';
import { localDateKey } from '@/lib/utils/dates';

export async function getPreferences(store) {
  const existing = await prisma.notificationPreference.findUnique({ where: { shopId: store.id } });
  if (existing) return existing;
  return prisma.notificationPreference.create({
    data: { shopId: store.id, notifyEmail: store.email ?? null },
  });
}

function recipient(store, prefs) {
  return prefs.notifyEmail || store.email || null;
}

/**
 * Records the attempt exactly once. The unique (shopId, dedupeKey) constraint
 * is the hard guarantee that no merchant ever gets the same email twice, even
 * if two webhooks race.
 */
async function sendOnce({ store, dedupeKey, kind, alertId, subject, html, to }) {
  let log;
  try {
    log = await prisma.notificationLog.create({
      data: { shopId: store.id, alertId: alertId ?? null, channel: 'EMAIL', kind, subject, dedupeKey },
    });
  } catch (error) {
    // P2002 = unique violation: this notification was already queued/sent.
    if (error.code === 'P2002') return { skipped: true, reason: 'duplicate' };
    throw error;
  }

  if (!to) {
    await prisma.notificationLog.update({
      where: { id: log.id },
      data: { status: 'SKIPPED', errorMessage: 'No recipient email configured' },
    });
    return { skipped: true, reason: 'no-recipient' };
  }

  const result = await sendEmail({ to, subject, html });

  await prisma.notificationLog.update({
    where: { id: log.id },
    data: result.ok
      ? { status: 'SENT', sentAt: new Date(), providerMessageId: result.id ?? null }
      : { status: result.skipped ? 'SKIPPED' : 'FAILED', errorMessage: result.error?.slice(0, 400) },
  });

  return result;
}

/**
 * Instant notification for a newly created alert.
 */
export async function dispatchAlertNotification(store, alert) {
  const prefs = await getPreferences(store);

  // In-app delivery is implicit — the alert row itself is the notification.
  if (!prefs.emailEnabled || !prefs.instantAlertsEnabled) return { skipped: true, reason: 'disabled' };
  if (prefs.criticalAlertsOnly && alert.severity !== 'CRITICAL') return { skipped: true, reason: 'critical-only' };
  if (alert.severity !== 'CRITICAL') return { skipped: true, reason: 'instant-email-is-critical-only' };
  if (alert.snoozedUntil && alert.snoozedUntil > new Date()) return { skipped: true, reason: 'snoozed' };

  const { subject, html } = criticalAlertEmail({ store, alert });

  const result = await sendOnce({
    store,
    alertId: alert.id,
    kind: 'ALERT',
    dedupeKey: `alert:${alert.id}:${alert.firstDetectedAt.toISOString()}`,
    subject,
    html,
    to: recipient(store, prefs),
  });

  if (result.ok) {
    await prisma.alert.update({ where: { id: alert.id }, data: { notifiedAt: new Date() } });
  }

  return result;
}

export async function dispatchDailyDigest(store, brief) {
  const prefs = await getPreferences(store);
  if (!prefs.emailEnabled || !prefs.dailyDigestEnabled) return { skipped: true, reason: 'disabled' };

  const { subject, html } = dailyDigestEmail({ store, brief });

  return sendOnce({
    store,
    kind: 'DAILY_DIGEST',
    dedupeKey: `digest:${localDateKey(store.timezone)}`,
    subject,
    html,
    to: recipient(store, prefs),
  });
}

/**
 * Merchant-triggered "send me a test" — the same digest template and the same
 * delivery path as the real thing, so a success here proves the whole chain
 * (Resend key, verified domain, from-address, recipient) actually works.
 * Uses a timestamped dedupe key so it can be sent repeatedly while debugging.
 */
export async function dispatchTestEmail(store, brief) {
  const prefs = await getPreferences(store);
  const to = recipient(store, prefs);

  if (!to) {
    return { skipped: true, reason: 'Add a notification email address first, then save.' };
  }
  if (!process.env.RESEND_API_KEY) {
    return { skipped: true, reason: 'RESEND_API_KEY is not set on this deployment.' };
  }

  const { subject, html } = dailyDigestEmail({ store, brief });

  const result = await sendOnce({
    store,
    kind: 'TEST',
    dedupeKey: `test:${Date.now()}`,
    subject: `[Test] ${subject}`,
    html,
    to,
  });

  return { ...result, to };
}

export async function dispatchWeeklySummary(store, summary) {
  const prefs = await getPreferences(store);
  if (!prefs.emailEnabled || !prefs.weeklySummaryEnabled) return { skipped: true, reason: 'disabled' };

  const { subject, html } = weeklySummaryEmail({ store, summary });

  return sendOnce({
    store,
    kind: 'WEEKLY_SUMMARY',
    dedupeKey: `weekly:${localDateKey(store.timezone)}`,
    subject,
    html,
    to: recipient(store, prefs),
  });
}

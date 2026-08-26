import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { authorizeCron, forEachActiveStore } from '@/lib/cron';
import { refreshMetrics } from '@/lib/metrics';
import { runAlertScan } from '@/lib/alerts/scan';
import { buildDailyBrief } from '@/lib/brief';
import { dispatchDailyDigest, getPreferences } from '@/lib/notifications/dispatch';
import { localHourInTimezone } from '@/lib/utils/dates';
import { syncSubscriptionState } from '@/lib/billing';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

/**
 * Combined daily job — metrics, alert scan, then the digest.
 *
 * Vercel's Hobby plan only permits cron expressions that fire at most once a
 * day, so the hourly metrics/scan/digest jobs are merged here. On Pro you can
 * split these back out (see /api/cron/metrics, /scan and /daily-digest, which
 * remain fully functional) and get per-timezone digest delivery.
 *
 * Because we only get one run per day, the digest is sent regardless of the
 * store's configured `digestHour` unless `respectDigestHour=true` is passed.
 * Duplicate sends are still impossible: NotificationLog's unique dedupe key is
 * `digest:<store-local date>`.
 */
export async function GET(request) {
  const denied = authorizeCron(request);
  if (denied) return denied;

  const { searchParams } = new URL(request.url);
  const respectDigestHour = searchParams.get('respectDigestHour') === 'true';
  const skipDigest = searchParams.get('skipDigest') === 'true';

  const results = await forEachActiveStore(prisma, async (store) => {
    // Safety net: if a subscription webhook was ever missed, this catches the
    // drift rather than letting a store keep a plan it no longer pays for.
    if (!store.isDemo) {
      try {
        await syncSubscriptionState(store);
      } catch (error) {
        console.error(`[storepulse] subscription reconcile failed for ${store.shopDomain}`, error.message);
      }
    }

    await refreshMetrics(store, { days: 2 });
    const scan = await runAlertScan(store, { notify: true });

    if (skipDigest) return { scan, digest: 'skipped' };

    const prefs = await getPreferences(store);
    const localHour = localHourInTimezone(store.timezone);

    if (respectDigestHour && localHour !== prefs.digestHour) {
      return { scan, digest: 'out-of-window', localHour, digestHour: prefs.digestHour };
    }

    const brief = await buildDailyBrief(store);
    const result = await dispatchDailyDigest(store, brief);

    return {
      scan,
      digest: result.ok ? 'sent' : result.skipped ? `skipped:${result.reason}` : `failed:${result.error}`,
      critical: brief.counts.critical,
      warnings: brief.counts.warning,
    };
  });

  return NextResponse.json({ ok: true, stores: results.length, results });
}

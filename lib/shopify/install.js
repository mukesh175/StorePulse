import prisma from '@/lib/prisma';
import { exchangeSessionTokenForAccessToken } from '@/lib/shopify/auth';
import { registerWebhooks } from '@/lib/shopify/webhooks';
import { syncShopProfile } from '@/lib/sync';
import { syncSubscriptionState } from '@/lib/billing';

/**
 * Make sure a store that has a valid session token also has usable Shopify
 * credentials.
 *
 * Under Shopify managed installation the merchant is granted access without
 * passing through our OAuth callback, so the first thing we ever see is an
 * embedded page load carrying a session token. Exchanging that token here is
 * what turns it into a working install — no redirect out of the admin.
 *
 * Safe to call on any embedded request: it returns immediately when the store
 * already holds a refreshable token.
 */
export async function ensureStoreInstalled({ shop, idToken }) {
  if (!shop) return null;

  const existing = await prisma.store.findUnique({
    where: { shopDomain: shop },
    include: { settings: true, preference: true },
  });

  // Already installed with credentials that can be refreshed — nothing to do.
  if (existing && existing.refreshToken && !existing.uninstalledAt) return existing;
  // Demo stores hold placeholder credentials and must never call Shopify.
  if (existing?.isDemo) return existing;

  // Without a session token there is nothing to exchange; the caller falls
  // back to the OAuth route.
  if (!idToken) return existing ?? null;

  let payload;
  try {
    payload = await exchangeSessionTokenForAccessToken(shop, idToken);
  } catch (error) {
    console.error('[storepulse] token exchange failed', error);
    return existing ?? null;
  }

  const now = Date.now();
  const tokenFields = {
    accessToken: payload.access_token,
    tokenExpiresAt: payload.expires_in ? new Date(now + payload.expires_in * 1000) : null,
    refreshToken: payload.refresh_token ?? null,
    refreshTokenExpiresAt: payload.refresh_token_expires_in
      ? new Date(now + payload.refresh_token_expires_in * 1000)
      : null,
  };

  const store = await prisma.store.upsert({
    where: { shopDomain: shop },
    create: { shopDomain: shop, ...tokenFields, installedAt: new Date() },
    update: {
      ...tokenFields,
      uninstalledAt: null,
      lastSyncError: null,
      // A reinstall must never inherit the previous plan. Shopify cancels the
      // subscription on uninstall, so the merchant is not being charged —
      // start from Free and let the reconciliation below restore a plan only
      // if Shopify actually reports one as active.
      plan: 'FREE',
      subscriptionId: null,
      subscriptionStatus: null,
      planActivatedAt: null,
    },
  });

  await prisma.alertSetting.upsert({ where: { shopId: store.id }, create: { shopId: store.id }, update: {} });
  await prisma.notificationPreference.upsert({
    where: { shopId: store.id },
    create: { shopId: store.id },
    update: {},
  });

  // Neither of these should ever block the merchant from reaching the app.
  let hydrated = store;
  try {
    hydrated = await syncShopProfile(store);
    await prisma.notificationPreference.updateMany({
      where: { shopId: store.id, notifyEmail: null },
      data: { notifyEmail: hydrated.email },
    });
  } catch (error) {
    console.error('[storepulse] shop profile sync failed during install', error);
  }

  try {
    await registerWebhooks(hydrated);
  } catch (error) {
    console.error('[storepulse] webhook registration failed during install', error);
  }

  // Shopify is the authority on what the merchant is paying for. If they
  // genuinely hold an active subscription this restores it; otherwise the
  // store stays on Free.
  try {
    await syncSubscriptionState(hydrated);
  } catch (error) {
    console.error('[storepulse] subscription reconciliation failed during install', error);
  }

  return prisma.store.findUnique({
    where: { id: store.id },
    include: { settings: true, preference: true },
  });
}

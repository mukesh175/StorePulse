import { cache } from 'react';
import { cookies, headers } from 'next/headers';
import prisma from '@/lib/prisma';
import { SESSION_COOKIE, readSession, normalizeShopDomain } from '@/lib/shopify/auth';
import { verifySessionToken } from '@/lib/shopify/sessionToken';
import { ensureStoreInstalled } from '@/lib/shopify/install';
import { env } from '@/lib/env';

/**
 * Resolve the authenticated shop, preferring Shopify's session token.
 *
 * Order of trust:
 *   1. `Authorization: Bearer <session token>` — App Bridge issues this per
 *      request and it is verified cryptographically.
 *   2. `x-storepulse-shop` set by middleware after verifying `id_token`.
 *   3. The signed session cookie, for same-document navigation.
 *
 * The shop is NEVER taken from a client-supplied body or query parameter.
 */
export async function getSessionShopDomain() {
  const headerList = await headers();

  const authorization = headerList.get('authorization');
  if (authorization?.startsWith('Bearer ')) {
    try {
      const { shop } = await verifySessionToken(authorization.slice(7), {
        apiKey: env.shopifyApiKey,
        apiSecret: env.shopifyApiSecret,
      });
      return shop;
    } catch {
      // Fall through — an expired token should not lock out a valid cookie.
    }
  }

  const verifiedByMiddleware = headerList.get('x-storepulse-shop');
  if (verifiedByMiddleware) return verifiedByMiddleware;

  const store = await cookies();
  const session = readSession(store.get(SESSION_COOKIE)?.value);
  return session?.shop ?? null;
}

/** The session token that authenticated this request, if there was one. */
export async function getSessionIdToken() {
  const headerList = await headers();
  const authorization = headerList.get('authorization');
  if (authorization?.startsWith('Bearer ')) return authorization.slice(7);
  return headerList.get('x-storepulse-id-token');
}

/**
 * Deduped per request: the app layout and the page beneath it both need the
 * store, and without this that is two round trips to the database on every
 * single navigation.
 */
const loadStore = cache(async (shopDomain) =>
  prisma.store.findUnique({
    where: { shopDomain },
    include: { settings: true, preference: true },
  })
);

export async function getCurrentStore({ includeUninstalled = false, install = false } = {}) {
  const shopDomain = await getSessionShopDomain();
  if (!shopDomain) return null;

  let store = await loadStore(shopDomain);

  // Shopify managed installation grants access without our OAuth callback
  // running, so the first embedded load may be the first time we hear of this
  // shop. Exchange the session token for credentials rather than sending the
  // merchant out of the admin to authorise again.
  // Demo stores never talk to Shopify, so they must not attempt an exchange.
  if (install && !store?.isDemo && (!store || !store.refreshToken || store.uninstalledAt)) {
    const idToken = await getSessionIdToken();
    if (idToken) {
      store = (await ensureStoreInstalled({ shop: shopDomain, idToken })) ?? store;
    }
  }

  if (!store) return null;
  if (!includeUninstalled && store.uninstalledAt) return null;
  return store;
}

/**
 * For API routes: returns { store } or throws a 401-shaped error.
 */
export async function requireStore() {
  const store = await getCurrentStore();
  if (!store) {
    const error = new Error('Not authenticated');
    error.status = 401;
    throw error;
  }
  return store;
}

export async function getStoreByDomain(shop) {
  const shopDomain = normalizeShopDomain(shop);
  if (!shopDomain) return null;
  return prisma.store.findUnique({ where: { shopDomain } });
}

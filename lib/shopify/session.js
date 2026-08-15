import { cookies, headers } from 'next/headers';
import prisma from '@/lib/prisma';
import { SESSION_COOKIE, readSession, normalizeShopDomain } from '@/lib/shopify/auth';
import { verifySessionToken } from '@/lib/shopify/sessionToken';
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

export async function getCurrentStore({ includeUninstalled = false } = {}) {
  const shopDomain = await getSessionShopDomain();
  if (!shopDomain) return null;

  const store = await prisma.store.findUnique({
    where: { shopDomain },
    include: { settings: true, preference: true },
  });

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

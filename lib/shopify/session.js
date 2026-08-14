import { cookies } from 'next/headers';
import prisma from '@/lib/prisma';
import { SESSION_COOKIE, readSession, normalizeShopDomain } from '@/lib/shopify/auth';

/**
 * Resolve the authenticated store from the signed session cookie.
 * The shop is NEVER taken from a client-supplied body/query parameter.
 */
export async function getSessionShopDomain() {
  const store = await cookies();
  const raw = store.get(SESSION_COOKIE)?.value;
  const session = readSession(raw);
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

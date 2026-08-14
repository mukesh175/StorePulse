import crypto from 'crypto';
import { env } from '@/lib/env';

const SHOP_DOMAIN_RE = /^[a-zA-Z0-9][a-zA-Z0-9-]*\.myshopify\.com$/;

export function isValidShopDomain(shop) {
  return typeof shop === 'string' && SHOP_DOMAIN_RE.test(shop);
}

export function normalizeShopDomain(shop) {
  if (!shop) return null;
  const cleaned = String(shop).trim().toLowerCase().replace(/^https?:\/\//, '').replace(/\/.*$/, '');
  return isValidShopDomain(cleaned) ? cleaned : null;
}

function timingSafeEqual(a, b) {
  const bufA = Buffer.from(a, 'utf8');
  const bufB = Buffer.from(b, 'utf8');
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}

/**
 * Verify the `hmac` parameter Shopify appends to OAuth / embedded-app requests.
 */
export function verifyOAuthHmac(searchParams) {
  const params = new URLSearchParams(searchParams);
  const hmac = params.get('hmac');
  if (!hmac) return false;
  params.delete('hmac');
  params.delete('signature');

  const message = [...params.entries()]
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    .map(([k, v]) => `${k}=${v}`)
    .join('&');

  const digest = crypto.createHmac('sha256', env.shopifyApiSecret).update(message).digest('hex');
  return timingSafeEqual(digest, hmac);
}

/**
 * Verify the base64 `X-Shopify-Hmac-Sha256` header sent with webhooks.
 * `rawBody` must be the exact bytes Shopify sent.
 */
export function verifyWebhookHmac(rawBody, headerHmac) {
  if (!headerHmac) return false;
  const digest = crypto.createHmac('sha256', env.shopifyApiSecret).update(rawBody, 'utf8').digest('base64');
  return timingSafeEqual(digest, headerHmac);
}

export function generateOAuthState() {
  return crypto.randomBytes(24).toString('hex');
}

export function buildInstallUrl(shopDomain, state) {
  const params = new URLSearchParams({
    client_id: env.shopifyApiKey,
    scope: env.scopes,
    redirect_uri: `${env.appUrl}/api/auth/callback`,
    state,
  });
  return `https://${shopDomain}/admin/oauth/authorize?${params.toString()}`;
}

export async function exchangeCodeForToken(shopDomain, code) {
  const res = await fetch(`https://${shopDomain}/admin/oauth/access_token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({
      client_id: env.shopifyApiKey,
      client_secret: env.shopifyApiSecret,
      code,
    }),
  });

  if (!res.ok) {
    const detail = await res.text();
    throw new Error(`Shopify token exchange failed (${res.status}): ${detail.slice(0, 300)}`);
  }

  return res.json(); // { access_token, scope }
}

// ---------------------------------------------------------------------------
// App session cookie (signed, HTTP-only). The access token never leaves the
// server; the cookie only carries the shop domain.
// ---------------------------------------------------------------------------

export const SESSION_COOKIE = 'sp_session';

export function signSession(shopDomain) {
  const payload = Buffer.from(JSON.stringify({ shop: shopDomain, iat: Date.now() })).toString('base64url');
  const sig = crypto.createHmac('sha256', env.sessionSecret).update(payload).digest('base64url');
  return `${payload}.${sig}`;
}

export function readSession(cookieValue) {
  if (!cookieValue || !cookieValue.includes('.')) return null;
  const [payload, sig] = cookieValue.split('.');
  const expected = crypto.createHmac('sha256', env.sessionSecret).update(payload).digest('base64url');
  if (!timingSafeEqual(expected, sig)) return null;
  try {
    const data = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
    if (!isValidShopDomain(data.shop)) return null;
    // Sessions are valid for 30 days.
    if (Date.now() - Number(data.iat) > 30 * 24 * 60 * 60 * 1000) return null;
    return data;
  } catch {
    return null;
  }
}

export const sessionCookieOptions = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  // Shopify renders the app in an iframe, so the cookie must be cross-site.
  sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
  path: '/',
  maxAge: 30 * 24 * 60 * 60,
};

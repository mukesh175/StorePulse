import { NextResponse } from 'next/server';
import { verifySessionToken, hmacSign } from '@/lib/shopify/sessionToken';

/**
 * Establishes the app session from Shopify's session token.
 *
 * Shopify appends `id_token` to every embedded page load. Verifying it here
 * means authentication is driven by the session token rather than by a
 * third-party cookie — the cookie that follows is only a short-lived carrier
 * for subsequent same-document navigations, and is re-derived from a fresh
 * token on every embedded entry.
 */
export async function middleware(request) {
  const { searchParams } = request.nextUrl;
  const idToken = searchParams.get('id_token');
  if (!idToken) return NextResponse.next();

  const apiKey = process.env.SHOPIFY_API_KEY;
  const apiSecret = process.env.SHOPIFY_API_SECRET;
  const sessionSecret = process.env.APP_SESSION_SECRET || apiSecret;
  if (!apiKey || !apiSecret) return NextResponse.next();

  try {
    const { shop } = await verifySessionToken(idToken, { apiKey, apiSecret });

    const payload = btoa(JSON.stringify({ shop, iat: Date.now() }))
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '');
    const signature = await hmacSign(sessionSecret, payload);

    const response = NextResponse.next();
    response.cookies.set('sp_session', `${payload}.${signature}`, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
      path: '/',
      maxAge: 30 * 24 * 60 * 60,
    });
    // Downstream server components read the verified shop from here rather
    // than trusting any query parameter.
    response.headers.set('x-storepulse-shop', shop);
    return response;
  } catch {
    // An invalid token is not fatal — the request falls through to the normal
    // cookie check, and unauthenticated users land on the install page.
    return NextResponse.next();
  }
}

export const config = {
  matcher: [
    // Everything except static assets and Shopify webhook/OAuth endpoints,
    // which authenticate themselves by HMAC.
    '/((?!_next/static|_next/image|favicon.ico|icon.svg|api/webhooks|api/auth|api/cron).*)',
  ],
};

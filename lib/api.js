import { NextResponse } from 'next/server';

/**
 * Wraps a route handler so authentication failures and unexpected errors
 * become clean JSON — raw stack traces never reach the browser.
 */
export function withStore(handler) {
  return async (request, context) => {
    try {
      return await handler(request, context);
    } catch (error) {
      if (error.status === 401) {
        return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
      }
      console.error('[storepulse] api error', error);
      return NextResponse.json(
        { error: 'Something went wrong on our side. Please try again.' },
        { status: 500 }
      );
    }
  };
}

export function badRequest(message) {
  return NextResponse.json({ error: message }, { status: 400 });
}

/** Minimal validators — enough to keep bad input out of the database. */
export const validate = {
  int(value, { min, max, fallback }) {
    const n = Number.parseInt(value, 10);
    if (!Number.isFinite(n)) return fallback;
    return Math.min(max, Math.max(min, n));
  },
  bool(value, fallback = false) {
    if (typeof value === 'boolean') return value;
    if (value === 'true') return true;
    if (value === 'false') return false;
    return fallback;
  },
  email(value) {
    if (!value) return null;
    const trimmed = String(value).trim();
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed) ? trimmed : null;
  },
  oneOf(value, allowed, fallback = null) {
    return allowed.includes(value) ? value : fallback;
  },
};

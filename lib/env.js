// Central place for reading configuration. Nothing here is exposed to the
// browser — every consumer runs on the server.

function required(name, fallback) {
  const value = process.env[name] ?? fallback;
  if (value === undefined || value === '') {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

export const env = {
  get shopifyApiKey() {
    return required('SHOPIFY_API_KEY');
  },
  get shopifyApiSecret() {
    return required('SHOPIFY_API_SECRET');
  },
  get appUrl() {
    return required('SHOPIFY_APP_URL').replace(/\/$/, '');
  },
  get scopes() {
    return required(
      'SHOPIFY_SCOPES',
      'read_products,read_orders,read_inventory,read_customers,read_locations'
    );
  },
  get apiVersion() {
    return process.env.SHOPIFY_API_VERSION || '2025-01';
  },
  get sessionSecret() {
    return required('APP_SESSION_SECRET', process.env.SHOPIFY_API_SECRET);
  },
  get cronSecret() {
    return required('CRON_SECRET');
  },
  get resendApiKey() {
    return process.env.RESEND_API_KEY || '';
  },
  get resendFrom() {
    return process.env.RESEND_FROM_EMAIL || 'StorePulse <onboarding@resend.dev>';
  },
  get demoMode() {
    return process.env.DEMO_MODE === 'true';
  },
};

export function isConfigured() {
  return Boolean(process.env.SHOPIFY_API_KEY && process.env.SHOPIFY_API_SECRET && process.env.DATABASE_URL);
}

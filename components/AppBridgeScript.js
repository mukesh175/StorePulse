import Script from 'next/script';

/**
 * Shopify App Bridge. Loading the CDN script with the API key is all that is
 * required for the embedded surface (session tokens, navigation, toasts).
 * Rendered only when the app is actually configured with a Shopify API key.
 */
export default function AppBridgeScript() {
  const apiKey = process.env.SHOPIFY_API_KEY;
  if (!apiKey) return null;

  return (
    <Script
      src="https://cdn.shopify.com/shopifycloud/app-bridge.js"
      data-api-key={apiKey}
      strategy="afterInteractive"
    />
  );
}

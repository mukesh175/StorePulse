import 'bootstrap/dist/css/bootstrap.min.css';
import './globals.css';

export const metadata = {
  title: 'StorePulse — Know what needs attention. Every day.',
  description:
    'StorePulse watches your Shopify store and tells you what needs attention today: sold-out products, delayed orders, refund spikes and sales drops.',
};

export const viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: '#3d5afe',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <head>
        {/*
          Shopify requires App Bridge to be the first script in <head>, loaded
          from their CDN with the API key. A plain tag is used rather than
          next/script so nothing can defer or reorder it.
        */}
        {process.env.SHOPIFY_API_KEY && (
          // eslint-disable-next-line @next/next/no-sync-scripts -- Shopify requires App Bridge first in <head>, loaded synchronously
          <script src="https://cdn.shopify.com/shopifycloud/app-bridge.js" data-api-key={process.env.SHOPIFY_API_KEY} />
        )}
      </head>
      <body>{children}</body>
    </html>
  );
}

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
      <body>{children}</body>
    </html>
  );
}

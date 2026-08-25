import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getCurrentStore } from '@/lib/shopify/session';
import { normalizeShopDomain } from '@/lib/shopify/auth';
import InstallForm from '@/components/InstallForm';
import ExitIframe from '@/components/ExitIframe';

export const dynamic = 'force-dynamic';

export default async function HomePage({ searchParams }) {
  const params = await searchParams;
  const shopDomain = normalizeShopDomain(params?.shop);

  // `install: true` completes a Shopify managed installation via token
  // exchange when this is the first time we have seen the shop.
  const store = await getCurrentStore({ install: true });

  // Query parameters must survive the hop. Dropping id_token here was pushing
  // embedded loads onto the cookie, which is third-party inside the admin
  // iframe and frequently blocked — the app then fell through to this landing
  // page rendered inside Shopify admin.
  const forward = new URLSearchParams(params ?? {}).toString();
  const withParams = (path) => (forward ? `${path}?${forward}` : path);

  if (store) {
    redirect(withParams(store.onboardedAt ? '/dashboard' : '/onboarding'));
  }

  // Shop is known but we could not establish credentials — fall back to OAuth.
  // Shopify's authorize screen cannot render framed, so break out to the top.
  if (shopDomain) {
    return <ExitIframe url={`/api/auth?${forward}`} />;
  }

  const demoMode = process.env.DEMO_MODE === 'true';
  const configured = Boolean(process.env.SHOPIFY_API_KEY && process.env.SHOPIFY_API_SECRET);

  return (
    <main style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', padding: '40px 16px' }}>
      <div style={{ maxWidth: 560, width: '100%' }} className="sp-fade-in">
        <div className="d-flex align-items-center gap-2 mb-4">
          <span className="sp-brand-mark" aria-hidden="true">
            ◈
          </span>
          <strong style={{ fontSize: 19, letterSpacing: '-0.03em' }}>StorePulse</strong>
        </div>

        <h1 style={{ fontSize: 32, lineHeight: 1.2 }}>Know what needs attention. Every day.</h1>
        <p className="sp-card-sub mt-3" style={{ fontSize: 15, lineHeight: 1.7 }}>
          StorePulse watches your Shopify store and tells you what happened, why it matters, and what to do —
          sold-out best sellers, delayed orders, refund spikes and sales drops, in one morning brief.
        </p>

        <div className="sp-card sp-card-pad mt-4">
          <InstallForm configured={configured} demoMode={demoMode} />
        </div>

        <div className="row g-3 mt-1">
          {[
            ['🔴', 'Critical alerts', 'Unexpected sold-out products and severely delayed orders.'],
            ['☀️', 'Daily brief', 'One email each morning in your store timezone.'],
            ['🧠', 'Context, not noise', 'Every alert explains the impact and the next step.'],
          ].map(([icon, title, text]) => (
            <div className="col-12 col-md-4" key={title}>
              <div className="sp-card sp-card-pad h-100">
                <div style={{ fontSize: 20 }} aria-hidden="true">
                  {icon}
                </div>
                <div className="sp-card-title mt-2">{title}</div>
                <div className="sp-card-sub mt-1">{text}</div>
              </div>
            </div>
          ))}
        </div>

        <div className="d-flex gap-3 mt-4 sp-card-sub flex-wrap">
          <Link href="/privacy">Privacy policy</Link>
          <Link href="/terms">Terms &amp; data processing</Link>
          <Link href="/security">Security</Link>
        </div>
      </div>
    </main>
  );
}

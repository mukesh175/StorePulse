import { redirect } from 'next/navigation';
import { getCurrentStore } from '@/lib/shopify/session';
import InstallForm from '@/components/InstallForm';

export const dynamic = 'force-dynamic';

export default async function HomePage({ searchParams }) {
  const params = await searchParams;

  // Shopify links merchants here with ?shop= — send them straight into OAuth.
  if (params?.shop) {
    redirect(`/api/auth?${new URLSearchParams(params).toString()}`);
  }

  const store = await getCurrentStore();
  if (store) redirect(store.onboardedAt ? '/dashboard' : '/onboarding');

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
      </div>
    </main>
  );
}

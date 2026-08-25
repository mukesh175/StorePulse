import { redirect } from 'next/navigation';
import { getCurrentStore } from '@/lib/shopify/session';
import OnboardingFlow from '@/components/onboarding/OnboardingFlow';

export const dynamic = 'force-dynamic';

export default async function OnboardingPage() {
  const store = await getCurrentStore({ install: true });
  // Same reasoning as the app layout: never render a public page inside the
  // admin iframe when the session is simply missing.
  if (!store) redirect('/session-token-bounce?shopify-reload=%2Fonboarding');

  return (
    <div style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', padding: '32px 16px' }}>
      <OnboardingFlow
        store={{
          shopName: store.shopName || store.shopDomain,
          shopDomain: store.shopDomain,
          email: store.email,
          isDemo: store.isDemo,
        }}
      />
    </div>
  );
}

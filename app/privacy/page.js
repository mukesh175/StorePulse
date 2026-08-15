import LegalPage, { LegalSection } from '@/components/LegalPage';

export const metadata = {
  title: 'Privacy policy — StorePulse',
  description: 'What personal data StorePulse processes, why, and how long it is kept.',
};

export default function PrivacyPage() {
  return (
    <LegalPage
      title="Privacy policy"
      intro="StorePulse monitors a Shopify store and tells the merchant what needs attention. This page describes exactly which personal data the app reads, why it needs it, and how long it keeps it. It is written to match what the application actually does."
    >
      <LegalSection title="Who this covers">
        <p>
          StorePulse is installed by a Shopify merchant on their own store. The merchant is the data controller for
          their customers&apos; personal data; StorePulse acts as a data processor on the merchant&apos;s behalf and
          processes personal data only to provide the monitoring and alerting features described below.
        </p>
      </LegalSection>

      <LegalSection title="What personal data we process">
        <p>StorePulse reads exactly two protected customer fields from the Shopify Admin API:</p>
        <ul>
          <li>
            <strong>Customer name</strong> — shown on delayed-order alerts and in the orders list so the merchant
            knows who is waiting on an order.
          </li>
          <li>
            <strong>Customer email</strong> — shown alongside the order, and used to distinguish new from returning
            customers in daily metrics.
          </li>
        </ul>
        <p>
          We do <strong>not</strong> read customer phone numbers, shipping addresses, billing addresses, payment
          details, or browsing behaviour. We do not use tracking pixels or third-party analytics inside the app.
        </p>
        <p>
          We also process non-personal store data: products, variants, inventory levels, order totals, fulfillment
          and financial status, refund amounts, and the shop&apos;s currency and timezone.
        </p>
      </LegalSection>

      <LegalSection title="Why we process it">
        <p>
          Solely to generate alerts and reports for the merchant who installed the app: unexpected sold-out
          products, low stock, orders left unfulfilled, refund spikes, sales drops and product performance changes,
          plus the daily and weekly summaries of that information.
        </p>
        <p>
          We do not sell personal data, share it with advertisers, use it to train machine-learning models, or use
          it for any purpose other than operating StorePulse for the merchant.
        </p>
      </LegalSection>

      <LegalSection title="Where it is stored">
        <p>
          Data is stored in a PostgreSQL database hosted by Neon, and the application runs on Vercel. Emails are
          delivered by Resend. All three are subprocessors acting under contract. Data is encrypted in transit
          (TLS) and at rest, including backups.
        </p>
      </LegalSection>

      <LegalSection title="How long we keep it">
        <ul>
          <li>Orders are synchronised on a rolling 60-day window.</li>
          <li>
            When the app is uninstalled, the access token is destroyed immediately and processing stops.
          </li>
          <li>
            When Shopify sends the <code>shop/redact</code> request (48 hours after uninstall), the store record and
            every related row — orders, products, alerts, metrics, logs — is permanently deleted.
          </li>
          <li>
            When Shopify sends <code>customers/redact</code> for an individual, that customer&apos;s name and email
            are erased from our records while anonymous order totals remain for the merchant&apos;s reporting.
          </li>
        </ul>
      </LegalSection>

      <LegalSection title="Access logging">
        <p>
          Every read of customer name or email is recorded in an internal access log, including what was accessed,
          how many records, and whether it was a merchant viewing a screen or an automated sync. The log records the
          fact of access, never the personal data itself. Merchants can view their own log in the app under
          Notifications → Data access log.
        </p>
      </LegalSection>

      <LegalSection title="Individual rights">
        <p>
          Requests from a customer should be made to the merchant who operates the store. Shopify forwards those
          requests to us automatically, and StorePulse responds to <code>customers/data_request</code>,{' '}
          <code>customers/redact</code> and <code>shop/redact</code> without manual intervention.
        </p>
      </LegalSection>

      <LegalSection title="Contact">
        <p>
          Questions about this policy or about data StorePulse holds: contact the app developer through the Shopify
          App Store listing, or at the support address given there.
        </p>
      </LegalSection>
    </LegalPage>
  );
}

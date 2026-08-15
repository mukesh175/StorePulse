import Link from 'next/link';
import { redirect } from 'next/navigation';
import prisma from '@/lib/prisma';
import { listDataAccessLogs } from '@/lib/audit';
import { getCurrentStore } from '@/lib/shopify/session';
import { getPreferences } from '@/lib/notifications/dispatch';
import NotificationForm from '@/components/settings/NotificationForm';
import { PageHeader, Card, Section, EmptyState } from '@/components/ui/Primitives';
import { timeAgo, titleCase } from '@/lib/utils/format';

export const dynamic = 'force-dynamic';

const STATUS_TONE = { SENT: 'success', QUEUED: 'info', FAILED: 'critical', SKIPPED: 'neutral' };

export default async function NotificationsPage() {
  const store = await getCurrentStore();
  if (!store) redirect('/');

  const preferences = await getPreferences(store);
  const accessLogs = await listDataAccessLogs(store.id, { take: 25 });
  const logs = await prisma.notificationLog.findMany({
    where: { shopId: store.id },
    orderBy: { createdAt: 'desc' },
    take: 30,
    include: { alert: { select: { id: true, title: true } } },
  });

  return (
    <div className="sp-fade-in" style={{ maxWidth: 940 }}>
      <PageHeader
        title="Notifications"
        subtitle="Choose where StorePulse reaches you. In-app alerts are always on."
      />

      <NotificationForm
        initial={{
          notifyEmail: preferences.notifyEmail ?? '',
          emailEnabled: preferences.emailEnabled,
          dailyDigestEnabled: preferences.dailyDigestEnabled,
          weeklySummaryEnabled: preferences.weeklySummaryEnabled,
          instantAlertsEnabled: preferences.instantAlertsEnabled,
          criticalAlertsOnly: preferences.criticalAlertsOnly,
          browserNotificationsEnabled: preferences.browserNotificationsEnabled,
          digestHour: preferences.digestHour,
        }}
      />

      <Section title="Delivery history" sub="The last 30 notifications StorePulse attempted.">
        {logs.length === 0 ? (
          <EmptyState
            emoji="🔔"
            title="No notifications sent yet"
            text="Your daily brief and any critical alerts will show up here once they are sent."
          />
        ) : (
          <Card pad={false}>
            <div className="sp-table-wrap">
              <table className="sp-table">
                <thead>
                  <tr>
                    <th>Type</th>
                    <th>Subject</th>
                    <th>Channel</th>
                    <th>Status</th>
                    <th>When</th>
                  </tr>
                </thead>
                <tbody>
                  {logs.map((log) => (
                    <tr key={log.id}>
                      <td>{titleCase(log.kind)}</td>
                      <td>
                        {log.subject || log.alert?.title || '—'}
                        {log.errorMessage && (
                          <div className="sp-card-sub" style={{ color: 'var(--sp-critical)' }}>
                            {log.errorMessage}
                          </div>
                        )}
                      </td>
                      <td className="sp-card-sub">{log.channel}</td>
                      <td>
                        <span className={`sp-pill ${STATUS_TONE[log.status] ?? 'neutral'}`}>{log.status}</span>
                      </td>
                      <td className="sp-card-sub">{timeAgo(log.sentAt ?? log.createdAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        )}
      </Section>

      <Section
        title="Data access log"
        sub="Every read of customer name or email, whether by you or by an automated sync. The log records that access happened — never the data itself."
      >
        {accessLogs.length === 0 ? (
          <EmptyState
            emoji="🔒"
            title="No customer data accessed yet"
            text="Entries appear when you open a screen showing customer details, or when a sync imports orders."
          />
        ) : (
          <Card pad={false}>
            <div className="sp-table-wrap">
              <table className="sp-table">
                <thead>
                  <tr>
                    <th>Action</th>
                    <th>Resource</th>
                    <th>Records</th>
                    <th>By</th>
                    <th>Context</th>
                    <th>When</th>
                  </tr>
                </thead>
                <tbody>
                  {accessLogs.map((log) => (
                    <tr key={log.id}>
                      <td>
                        <span className="sp-pill neutral">{log.action}</span>
                      </td>
                      <td>{titleCase(log.resourceType)}</td>
                      <td className="sp-num">{log.recordCount}</td>
                      <td className="sp-card-sub">{titleCase(log.actor)}</td>
                      <td className="sp-card-sub">{log.context || '—'}</td>
                      <td className="sp-card-sub">{timeAgo(log.createdAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        )}
        <div className="sp-help mt-2">
          See our <Link href="/privacy">privacy policy</Link>, <Link href="/terms">data processing agreement</Link>{' '}
          and <Link href="/security">security practices</Link>.
        </div>
      </Section>
    </div>
  );
}

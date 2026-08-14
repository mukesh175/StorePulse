import { Resend } from 'resend';
import { env } from '@/lib/env';

let client = null;

function getClient() {
  if (!env.resendApiKey) return null;
  if (!client) client = new Resend(env.resendApiKey);
  return client;
}

/**
 * Sends an email and returns a normalised result. Never throws — the caller
 * records the outcome in NotificationLog either way.
 */
export async function sendEmail({ to, subject, html, replyTo }) {
  const resend = getClient();

  if (!resend) {
    return { ok: false, skipped: true, error: 'RESEND_API_KEY is not configured' };
  }
  if (!to) {
    return { ok: false, skipped: true, error: 'No destination email address on file' };
  }

  try {
    const { data, error } = await resend.emails.send({
      from: env.resendFrom,
      to: [to],
      subject,
      html,
      ...(replyTo ? { replyTo } : {}),
    });

    if (error) return { ok: false, error: error.message || String(error) };
    return { ok: true, id: data?.id };
  } catch (error) {
    return { ok: false, error: error.message };
  }
}

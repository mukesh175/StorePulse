import { Resend } from 'resend';
import { env } from '@/lib/env';

let client = null;

function getClient() {
  if (!env.resendApiKey) return null;
  if (!client) client = new Resend(env.resendApiKey);
  return client;
}

/**
 * Derive a plain-text part from the HTML. An HTML-only email is one of the
 * strongest spam signals there is, so every message gets both parts.
 */
export function htmlToText(html) {
  return String(html)
    .replace(/<head[\s\S]*?<\/head>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<a [^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/gi, '$2 ($1)')
    .replace(/<\/(p|div|tr|h1|h2|h3|li)>/gi, '\n')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n\s*\n\s*\n+/g, '\n\n')
    .split('\n')
    .map((line) => line.trim())
    .join('\n')
    .trim();
}

/**
 * Sends an email and returns a normalised result. Never throws — the caller
 * records the outcome in NotificationLog either way.
 */
export async function sendEmail({ to, subject, html, text, replyTo, headers }) {
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
      text: text || htmlToText(html),
      headers: {
        // A machine-readable unsubscribe route is a significant positive
        // signal for Gmail and Outlook, and is required for bulk senders.
        'List-Unsubscribe': `<${env.appUrl}/notifications>`,
        ...headers,
      },
      ...(replyTo ? { replyTo } : {}),
    });

    if (error) return { ok: false, error: error.message || String(error) };
    return { ok: true, id: data?.id };
  } catch (error) {
    return { ok: false, error: error.message };
  }
}

// lib/mailer.ts
import { Resend } from 'resend';

const RESEND_API_KEY = process.env.RESEND_API_KEY || '';
const MAIL_FROM = process.env.MAIL_FROM || 'NeedMe <onboarding@resend.dev>';
// אם תרצה לכפות שליחה לכתובת אחת בסביבת DEV:
const DEV_MAIL_REDIRECT = process.env.DEV_MAIL_REDIRECT || '';

if (!RESEND_API_KEY) {
  // לא מפיל את השרת — רק מזהיר בלוג
  console.warn('[mailer] Missing RESEND_API_KEY – emails will be no-op.');
}

const resend = new Resend(RESEND_API_KEY);

type SendEmailObjectArgs = {
  to: string | string[];
  subject: string;
  text?: string;
  html?: string;
  replyTo?: string | string[];
};

type SendEmailResult =
  | { ok: true; id: string | null }
  | { ok: false; error: unknown };

// פונקציה תואמת לשתי צורות קריאה:
// 1) sendEmail(to, subject, body[, replyTo])
// 2) sendEmail({ to, subject, text?, html?, replyTo? })
export async function sendEmail(
  arg1: string | string[] | SendEmailObjectArgs,
  subject?: string,
  body?: string,
  replyTo?: string | string[],
): Promise<SendEmailResult> {
  try {
    // בניית options בצורה אחידה
    let opts: SendEmailObjectArgs;
    if (typeof arg1 === 'string' || Array.isArray(arg1)) {
      // חתימה ישנה
      opts = {
        to: arg1,
        subject: subject ?? '',
        text: body,
        html: body ? `<pre style="font-family:ui-monospace,monospace;white-space:pre-wrap">${escapeHtml(body)}</pre>` : undefined,
        replyTo,
      };
    } else {
      // חתימה חדשה עם אובייקט
      opts = arg1;
    }

    // ולידציה בסיסית
    if (!opts.to || !opts.subject) {
      return { ok: false, error: new Error('Missing "to" or "subject"') };
    }

    // הפניה בסביבת פיתוח אם הוגדר DEV_MAIL_REDIRECT
    const toFinal = DEV_MAIL_REDIRECT ? DEV_MAIL_REDIRECT : opts.to;

    // בניית payload עבור Resend
    const payload = {
      from: MAIL_FROM,
      to: toFinal,
      subject: opts.subject,
      text: opts.text,
      html: opts.html,
      replyTo: opts.replyTo,
    };

    // ---- הקסם של אפשרות 1: לעקוף טיפוסים בעייתיים באמצעות any ----
    const resp = await resend.emails.send(payload as any);

    // החזרת תוצאה עקבית
    const id = (resp as any)?.id ?? null;
    const error = (resp as any)?.error;
    if (error) {
      return { ok: false, error };
    }
    return { ok: true, id };
  } catch (err) {
    return { ok: false, error: err };
  }
}

// עוזר קטן להגנה ב-HTML מינימלית
function escapeHtml(s: string) {
  return s
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;');
}

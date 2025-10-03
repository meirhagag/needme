// lib/mailer.ts
import { Resend } from 'resend';

// חשוב: שני ה-ENV חייבים להיות מוגדרים ב-Vercel (Production/Preview/Development):
// RESEND_API_KEY  +  MAIL_FROM  (לדוגמה: "NeedMe <noreply@mg.needmepro.com>")
const resend = new Resend(process.env.RESEND_API_KEY ?? '');
const FROM = (process.env.MAIL_FROM ?? '').trim();

export type SendMailArgs = {
  to: string | string[];
  subject: string;
  text?: string;
  html?: string;
  replyTo?: string | string[];
};

export async function sendEmail({ to, subject, text, html, replyTo }: SendMailArgs) {
  if (!FROM) {
    const msg = 'MAIL_FROM is missing';
    console.error('[mailer] ENV error:', msg);
    throw new Error(msg); // נשאר כ-throw כדי שנדע שזה קונפיגורציה
  }
  if (!process.env.RESEND_API_KEY) {
    const msg = 'RESEND_API_KEY is missing';
    console.error('[mailer] ENV error:', msg);
    throw new Error(msg);
  }

  try {
    // cast ל-any כדי לא להכריח "react" (זה API אחר של Resend)
    const { data, error } = await resend.emails.send({
      from: FROM,
      to,
      subject,
      text,
      html,
      replyTo,
    } as any);

    const id = (data as any)?.id ?? (data as any)?.data?.id ?? null;

    if (error) {
      console.error('[mailer] Resend error:', error);
      return { ok: false as const, id, error: String((error as any)?.message ?? error) };
    }

    return { ok: true as const, id, error: null };
  } catch (e: any) {
    console.error('[mailer] Exception:', e);
    return { ok: false as const, id: null, error: e?.message ?? String(e) };
  }
}

// lib/mailer.ts
import { Resend } from 'resend';

// אתחול Resend מה-ENV
const resend = new Resend(process.env.RESEND_API_KEY ?? '');

// הכתובת שממנה נשלח - חובה (מוגדרת ב-ENV של Vercel)
const FROM = (process.env.MAIL_FROM ?? '').trim();

export type SendMailArgs = {
  to: string | string[];
  subject: string;
  text?: string;
  html?: string;
  // שים לב: camelCase – זה השם שה-SDK מצפה לו (לא reply_to)
  replyTo?: string | string[];
};

// פונקציה אחת יציבה לשליחת מיילים
export async function sendEmail({
  to,
  subject,
  text,
  html,
  replyTo,
}: SendMailArgs): Promise<{ ok: boolean; id: string | null; error?: string }> {
  if (!FROM) {
    return { ok: false, id: null, error: 'MAIL_FROM env is missing' };
  }

  try {
    // בונים payload רגיל – text/html אופציונליים
    const payload: any = {
      from: FROM,
      to,
      subject,
    };
    if (text) payload.text = text;
    if (html) payload.html = html;
    if (replyTo) payload.replyTo = replyTo;

    // עקיפת טיפוסים: בגרסאות חדשות של ה-SDK הטיפוסים דורשים react,
    // למרות שה-API עצמו מאפשר text/html.
    const res: any = await (resend.emails.send as any)(payload);

    const id = res?.data?.id ?? null;
    const error = res?.error ?? null;

    if (error) {
      console.error('[mailer] resend error:', error);
      return { ok: false, id: null, error: String(error?.message ?? error) };
    }

    return { ok: true, id };
  } catch (e: any) {
    console.error('[mailer] exception:', e);
    return { ok: false, id: null, error: String(e?.message ?? e) };
  }
}

export default sendEmail;

// lib/mailer.ts
import { Resend } from 'resend';

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
    throw new Error('MAIL_FROM is missing');
  }

  // מרכיב payload רק עם השדות שקיימים, כדי לא לשלוח undefined
  const payload: Record<string, unknown> = {
    from: FROM,
    to,
    subject,
  };
  if (typeof text === 'string') payload.text = text;
  if (typeof html === 'string') payload.html = html;
  if (replyTo) payload.replyTo = replyTo; // camelCase – כך ה-SDK מצפה

  try {
    // cast ל-any פותר את באג/קשיחות הטיפוסים של ה-SDK ומפסיק ריצודים ב-VSCode
    const res = await resend.emails.send(payload as any);

    // תמיכה גם בצורה { data, error } וגם בצורה שטוחה יותר אם תגיע
    const id =
      (res as any)?.data?.id ??
      (res as any)?.id ??
      null;

    const error =
      (res as any)?.error ??
      (res as any)?.data?.error ??
      null;

    if (error) {
      return { ok: false, id, error: String(error?.message ?? error) };
    }
    return { ok: !!id, id, error: null };
  } catch (e: any) {
    return { ok: false, id: null, error: String(e?.message ?? e) };
  }
}

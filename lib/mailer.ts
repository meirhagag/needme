// lib/mailer.ts
import { Resend } from 'resend';

// משתמשים ב־ENV
const resend = new Resend(process.env.RESEND_API_KEY ?? '');

// שולח ברירת מחדל (אותו דומיין שאימתנו ב-Resend)
const FROM = (process.env.MAIL_FROM ?? '').trim();

// הטיפוס היחיד שמשמש אותנו בקוד
export type SendMailArgs = {
  to: string | string[];
  subject: string;
  text?: string;         // טקסט פשוט
  html?: string;         // HTML (אופציונלי)
  replyTo?: string | string[]; // אם צריך
};

// פונקציית שליחה יחידה לכל המערכת
export async function sendEmail({ to, subject, text, html, replyTo }: SendMailArgs) {
  if (!FROM) throw new Error('MAIL_FROM is missing');

  try {
    // שים לב: ל־SDK יש גם API של React-Email, לכן אנחנו עושים cast ל-any
    // כדי לא להכריח שדה react
    const { data, error } = await resend.emails.send({
      from: FROM,
      to,
      subject,
      text,
      html,
      replyTo,
    } as any);

    // התאמה לשינויים אפשריים במבנה התשובה בין גרסאות
    const id =
      (data as any)?.id ??
      (data as any)?.data?.id ??
      null;

    if (error) {
      return { ok: false, id, error: String((error as any)?.message ?? error) };
    }

    return { ok: true, id, error: null };
  } catch (e: any) {
    return { ok: false, id: null, error: e?.message ?? String(e) };
  }
}

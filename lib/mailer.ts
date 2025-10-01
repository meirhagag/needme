// lib/mailer.ts
import { Resend } from 'resend';

/** קלט אלגנטי לשליחה */
export type SendMailArgs = {
  to: string | string[];
  subject: string;
  text?: string;
  html?: string;
  replyTo?: string | string[];
};

const resend = new Resend(process.env.RESEND_API_KEY);

/** From ברירת מחדל אם לא הוגדר ב־ENV */
const FROM =
  (process.env.MAIL_FROM || '').trim() ||
  'NeedMe <onboarding@resend.dev>';

/** במצב פיתוח – אפשר לבצע הפניית יעד למייל ייעודי */
const DEV_REDIRECT = (process.env.DEV_MAIL_REDIRECT || '').trim();

/** עוזר: מסדר את היעד אם יש redirect */
function normalizeTo(to: string | string[]): string | string[] {
  if (DEV_REDIRECT) return DEV_REDIRECT;
  return to;
}

/** עוזר: משאיר רק שדות שהוגדרו */
function pick<T extends Record<string, unknown>>(obj: T) {
  const out: Record<string, unknown> = {};
  Object.keys(obj).forEach((k) => {
    const v = (obj as any)[k];
    if (v !== undefined && v !== null && v !== '') out[k] = v;
  });
  return out;
}

/**
 * שליחת מייל דרך Resend
 * תואם גם לגרסאות v3 וגם v4 (כולל טיפול בבעיית טיפוסים של react ב־v4).
 */
export async function sendEmail(opts: SendMailArgs) {
  const { subject, text, html, replyTo } = opts;
  const to = normalizeTo(opts.to);

  if (!FROM) {
    return { ok: false, error: 'MAIL_FROM is missing' as const };
  }
  if (!process.env.RESEND_API_KEY) {
    return { ok: false, error: 'RESEND_API_KEY is missing' as const };
  }

  // payload עם כל השדות החוקיים לפי v3/v4. ב-v4 יש "replyTo" (camelCase)
  const basePayload = pick({
    from: FROM,
    to,
    subject,
    text,
    html,
    replyTo,
  });

  // עקיפה בטוחה לטיפוסים של v4 שמכריחים react:
  // נשלח כ-any. בפועל Resend מקבל את זה מצוין.
  let res: any;
  try {
    res = await resend.emails.send(basePayload as any);
  } catch (e: any) {
    return { ok: false, error: e?.message ?? String(e) };
  }

  // התאמה לשני פורמטים אפשריים של תשובה:
  const id =
    res?.data?.id ?? // v4
    res?.id ??       // v3
    null;

  const errorMsg =
    res?.error?.message ??
    res?.message ??
    null;

  if (errorMsg) {
    console.error('[mailer] resend error =>', errorMsg, 'res=', res);
    return { ok: false, error: String(errorMsg) };
  }

  return { ok: true, id: id ?? undefined };
}

/** פונקציה עוטפת לשליחה פשוטה: טקסט בלבד */
export async function sendSimple(to: string | string[], subject: string, body: string) {
  return sendEmail({ to, subject, text: body });
}

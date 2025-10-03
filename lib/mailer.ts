// lib/mailer.ts
import { Resend } from 'resend';

/**
 * חשוב: ודא שב־Vercel (ובמקומי) מוגדרים המשתנים:
 * RESEND_API_KEY  - המפתח הפעיל (מרשימת API Keys ב-Resend)
 * MAIL_FROM       - לדוגמה: 'NeedMe <noreply@mg.needmepro.com>'
 */
const resend = new Resend(process.env.RESEND_API_KEY ?? '');
const FROM = (process.env.MAIL_FROM ?? '').trim();

export type SendMailArgs = {
  to: string | string[];
  subject: string;
  text?: string;
  html?: string;
  replyTo?: string | string[];
};

export async function sendEmail(
  args: SendMailArgs
): Promise<{ ok: boolean; id?: string | null; error?: string | null }> {
  if (!FROM) {
    return { ok: false, id: null, error: 'MAIL_FROM is missing' };
  }

  // 1) נרמול נמענים למערך (כולל תמיכה במחרוזת מופרדת בפסיקים)
  const normalizeTo = (v: string | string[]): string[] => {
    if (Array.isArray(v)) return v.filter(Boolean);
    // אם מגיעה מחרוזת עם פסיקים, נפצל למספר נמענים:
    if (v.includes(',')) return v.split(',').map(s => s.trim()).filter(Boolean);
    return [v].filter(Boolean);
  };

  const toArray = normalizeTo(args.to);

  // 2) בניית payload "נקי" ללא undefined
  const payload: Record<string, any> = {
    from: FROM,
    to: toArray,
    subject: args.subject,
  };

  if (args.html) payload.html = args.html;
  if (args.text) payload.text = args.text;

  // (ה־SDK השתנה בין גרסאות; נוסיף גם replyTo וגם reply_to ונאפשר לשרת לבחור)
  if (args.replyTo && (Array.isArray(args.replyTo) ? args.replyTo.length : true)) {
    payload.replyTo = args.replyTo;   // camelCase – גרסאות חדשות
    payload.reply_to = args.replyTo;  // snake_case – גרסאות ישנות / API ישיר
  }

  try {
    // 3) קוראים ל־SDK עם any כדי להימנע מקונפליקטים בין הגדרות טיפוסים בגרסאות שונות
    const res = await (resend.emails as any).send(payload);

    // 4) אחזור מזהה/שגיאה בהתאם לגרסה
    const id = res?.id ?? res?.data?.id ?? null;
    const errorObj = res?.error ?? res?.data?.error ?? null;
    const error =
      errorObj?.message ??
      (typeof errorObj === 'string' ? errorObj : null);

    if (error) {
      return { ok: false, id, error: String(error) };
    }
    return { ok: Boolean(id), id, error: null };
  } catch (e: any) {
    return { ok: false, id: null, error: String(e?.message ?? e) };
  }
}

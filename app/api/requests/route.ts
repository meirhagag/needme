// app/api/requests/route.ts
import { NextResponse } from 'next/server';
import sendEmail from '@/lib/mailer';

// פרסר גנרי: JSON / x-www-form-urlencoded / multipart/form-data
async function readRequestData(req: Request): Promise<Record<string, any>> {
  const ct = req.headers.get('content-type') || '';

  try {
    if (ct.includes('application/json')) {
      return await req.json();
    }
    if (ct.includes('application/x-www-form-urlencoded')) {
      const text = await req.text();
      return Object.fromEntries(new URLSearchParams(text));
    }
    if (ct.includes('multipart/form-data')) {
      const fd = await req.formData();
      return Object.fromEntries(fd.entries());
    }
  } catch {
    // נמשיך לפולבק
  }

  // פולבאק אחרון
  try { return await req.json(); } catch {}
  try {
    const text = await req.text();
    if (text) return Object.fromEntries(new URLSearchParams(text));
  } catch {}

  return {};
}

export async function POST(req: Request) {
  const data = await readRequestData(req);

  // לוג עזר (יראה בוורסל פונקצ׳ן לוגס)
  console.log('[requests] incoming', {
    contentType: req.headers.get('content-type'),
    dataKeys: Object.keys(data),
  });

  // איסוף שדות
  const title = (data.title ?? '').toString().trim();
  const email =
    (data.email ?? data.replyTo ?? '').toString().trim(); // המשתמש – replyTo
  const rawBody = data.body ?? '';
  const lines =
    Array.isArray(rawBody) ? rawBody.map(String) : [String(rawBody || '')];

  if (!email) {
    return NextResponse.json(
      { ok: false, error: 'Missing "email" (replyTo)' },
      { status: 400 }
    );
  }

  const subject = title ? `NeedMe: בקשה חדשה - ${title}` : 'NeedMe: בקשה חדשה';
  const text = lines.filter(Boolean).join('\n') || '(ללא תוכן)';

  // את ה"to" כדאי לקבע בצד השרת (לא לקבל מהלקוח)
  const TO = process.env.REQUESTS_TO ?? 'inbox@yourdomain.com';

  const { ok, id, error } = await sendEmail({
    to: TO,
    subject,
    text,
    replyTo: email, // camelCase – חשוב!
  });

  if (!ok) {
    return NextResponse.json({ ok, error }, { status: 500 });
  }

  return NextResponse.json({ ok, id });
}

// בריאות מהיר ל-GET (אופציונלי)
export async function GET() {
  return NextResponse.json({ ok: true });
}

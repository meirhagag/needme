// app/api/requests/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { sendEmail } from '@/lib/mailer';

function bad(status: number, error: string, extra: any = {}) {
  console.error('[requests] ->', status, error, extra);
  return NextResponse.json({ ok: false, error, ...extra }, { status });
}

export async function POST(req: NextRequest) {
  const ct = req.headers.get('content-type') || '';
  let body: any = {};

  // 1) Parse body safely לפי סוג התוכן
  try {
    if (ct.includes('application/json')) {
      body = await req.json();
    } else if (ct.includes('application/x-www-form-urlencoded')) {
      const form = await req.formData();
      body = Object.fromEntries(form.entries());
    } else if (ct.includes('text/plain')) {
      const txt = await req.text();
      try { body = JSON.parse(txt); } catch { body = { text: txt }; }
    } else {
      return bad(415, 'Unsupported Content-Type', { contentType: ct });
    }
  } catch (e: any) {
    return bad(400, 'Invalid body', { parseError: String(e?.message ?? e) });
  }

  // 2) נרמול שדות שמגיעים ממקורות שונים
  const to = String(body.email ?? body.to ?? '').trim();
  const title = String(body.title ?? body.subject ?? 'בקשה חדשה');
  const lines =
    Array.isArray(body.lines)
      ? body.lines.map(String)
      : String(body.body ?? body.text ?? '')
          .split('\n')
          .map((s) => s.trim())
          .filter(Boolean);

  if (!to) return bad(400, 'Missing "email"/"to"');
  if (!lines.length) lines.push(''); // לא חובה טקסט

  // 3) שליחה דרך המיילר
  const { ok, id, error } = await sendEmail({
    to,
    subject: `NeedMe: ${title}`,
    text: lines.join('\n'),
    html: undefined,            // אם תרצה HTML — אפשר לבנות בהמשך
    replyTo: body.replyTo ?? undefined,
  });

  if (!ok) return bad(502, 'resend error', { resendError: error });

  return NextResponse.json({ ok: true, id }, { status: 200 });
}

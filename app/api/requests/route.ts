// app/api/requests/route.ts
import { NextResponse } from 'next/server';
import { sendEmail } from '@/lib/mailer';

type Provider = { email: string };
type Incoming = {
  title: string;
  category?: string;
  subcategory?: string;
  region?: string;
  budgetMin?: number | null;
  budgetMax?: number | null;
  requesterName?: string;
  requesterEmail?: string;
  requesterPhone?: string;
  providers?: Provider[];
};

// Helper: tiny validator
function isEmail(x: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(x);
}

export async function POST(req: Request) {
  try {
    // ----- 1) JSON ONLY -----
    const ct = req.headers.get('content-type') || '';
    if (!ct.includes('application/json')) {
      return NextResponse.json(
        { ok: false, error: 'Content-Type must be application/json' },
        { status: 415 },
      );
    }

    // ----- 2) Parse -----
    const body = (await req.json()) as Partial<Incoming>;

    // ----- 3) Minimal validation -----
    const title = String(body.title ?? '').trim();
    if (!title) {
      return NextResponse.json(
        { ok: false, error: 'title is required' },
        { status: 400 },
      );
    }

    const providers: Provider[] = Array.isArray(body.providers)
      ? body.providers.filter(
          (p): p is Provider => !!p && typeof p.email === 'string' && isEmail(p.email.trim()),
        )
      : [];

    // אין למי לשלוח? זה לא שגיאה, נחזיר 200 עם sent=0
    if (providers.length === 0) {
      return NextResponse.json({
        ok: true,
        sent: 0,
        failed: 0,
        details: [],
        note: 'No valid provider emails provided',
      });
    }

    // שדות נוספים (אופציונליים)
    const category = body.category?.trim() || '';
    const subcategory = body.subcategory?.trim() || '';
    const region = body.region?.trim() || '';
    const budgetMin =
      typeof body.budgetMin === 'number' ? body.budgetMin : null;
    const budgetMax =
      typeof body.budgetMax === 'number' ? body.budgetMax : null;
    const requesterName = body.requesterName?.trim() || '';
    const requesterEmail = body.requesterEmail?.trim() || '';
    const requesterPhone = body.requesterPhone?.trim() || '';

    // ----- 4) Build message -----
    const lines: string[] = [
      category ? `קטגוריה: ${category}${subcategory ? ` / ${subcategory}` : ''}` : '',
      region ? `אזור: ${region}` : '',
      (budgetMin ?? null) !== null || (budgetMax ?? null) !== null
        ? `תקציב: ${budgetMin ?? ''}–${budgetMax ?? ''}`.replace(/-+$/, '')
        : '',
      '',
      requesterName ? `פרטי יוצר: ${requesterName}` : '',
      requesterEmail ? `מייל: ${requesterEmail}` : '',
      requesterPhone ? `טלפון: ${requesterPhone}` : '',
    ].filter(Boolean);

    const subject = `NeedMe: בקשה חדשה – ${title}`;
    const text = lines.join('\n');
    const html = lines.map((l) => (l ? `<div>${escapeHtml(l)}</div>` : '<br/>')).join('');

    // reply-to = אם יש מייל מבקש
    const replyTo = requesterEmail || undefined;

    // ----- 5) Send (unique emails, parallel) -----
    const targets = Array.from(
      new Set(providers.map((p) => p.email.trim().toLowerCase())),
    );

    const results = await Promise.allSettled(
      targets.map((email) =>
        sendEmail({
          to: email,
          subject,
          text,
          html,
          replyTo,
        }),
      ),
    );

    const details = results.map((r, i) => ({
      to: targets[i],
      ok: r.status === 'fulfilled' ? Boolean(r.value?.ok ?? true) : false,
      error: r.status === 'rejected' ? String(r.reason) : r.value?.error ?? null,
    }));

    const sent = details.filter((d) => d.ok).length;
    const failed = details.length - sent;

    return NextResponse.json({
      ok: failed === 0,
      sent,
      failed,
      details,
    });
  } catch (e) {
    console.error('[requests] fatal:', e);
    return NextResponse.json(
      { ok: false, error: String(e) },
      { status: 500 },
    );
  }
}

/** very small helper to avoid HTML injection in html body */
function escapeHtml(s: string) {
  return s
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

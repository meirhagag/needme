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

export async function POST(req: Request) {
  try {
    let body: Incoming;
    try {
      body = (await req.json()) as Incoming;
    } catch (e: any) {
      console.error('[requests] Bad JSON:', e);
      return NextResponse.json({ ok: false, error: 'Invalid JSON body' }, { status: 400 });
    }

    const {
      title,
      category,
      subcategory,
      region,
      budgetMin,
      budgetMax,
      requesterName,
      requesterEmail,
      requesterPhone,
      providers = [],
    } = body;

    if (!title || typeof title !== 'string') {
      return NextResponse.json({ ok: false, error: 'title is required' }, { status: 400 });
    }

    // נמענים ייחודיים ותקינים (מינימום ולידציה בסיסית)
    const uniqueTargets = Array.from(
      new Set(
        (providers ?? [])
          .map((p) => (p?.email ?? '').trim())
          .filter((e) => e.length > 0 && e.includes('@'))
      )
    );

    if (uniqueTargets.length === 0) {
      return NextResponse.json({ ok: false, error: 'No valid recipients' }, { status: 400 });
    }

    const escapeHtml = (s: string) =>
      s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

    const results = await Promise.allSettled(
      uniqueTargets.map(async (email) => {
        const lines = [
          `קטגוריה: ${category ?? ''}${subcategory ? ` / ${subcategory}` : ''}`,
          `אזור: ${region ?? ''}`,
          budgetMin != null ? `תקציב מינ׳: ₪${budgetMin}` : '',
          budgetMax != null ? `תקציב מקס׳: ₪${budgetMax}` : '',
          '',
          'פרטי יוזר:',
          requesterName ?? '',
          requesterEmail ?? '',
          requesterPhone ?? '',
        ].filter(Boolean);

        const text = lines.join('\n');
        const html = lines.map((l) => escapeHtml(l)).join('<br/>');

        const r = await sendEmail({
          to: email,
          subject: `NeedMe: בקשה חדשה – ${title}`,
          text,
          html,
          // replyTo: requesterEmail || undefined, // אם תרצה שה-Reply ילך למבקש
        });

        if (!r.ok) {
          // לוג ספציפי לכל נמען שנכשל
          console.error('[requests] send failed:', { email, err: r.error });
        }
        return r;
      })
    );

    const sent = results.filter((r) => r.status === 'fulfilled' && r.value.ok).length;
    const failed = uniqueTargets.length - sent;

    return NextResponse.json({
      ok: failed === 0,
      sent,
      failed,
      total: uniqueTargets.length,
    });
  } catch (e: any) {
    // אם הגענו לכאן זה חריג לא צפוי – נרשום ללוג ונחזיר 500
    console.error('[requests] Unhandled exception:', e);
    return NextResponse.json(
      { ok: false, error: e?.message ?? String(e) },
      { status: 500 }
    );
  }
}

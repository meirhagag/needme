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
    const body = (await req.json()) as Incoming;

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

    // בונים רשימת נמענים ייחודיים
    const uniqueTargets = Array.from(
      new Set(
        (providers ?? [])
          .map((p) => (p?.email ?? '').trim())
          .filter((e) => e.length > 0)
      )
    );

    if (!uniqueTargets.length) {
      return NextResponse.json(
        { ok: false, error: 'No recipients' },
        { status: 400 }
      );
    }

    // פונקציית אסקייפ ל-HTML
    const escapeHtml = (s: string) =>
      s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

    // שולחים לכולם במקביל — בלי 'body' (לא קיים בטיפוס)
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

        return sendEmail({
          to: email,
          subject: `NeedMe: בקשה חדשה – ${title}`,
          text,
          html,
          // replyTo: 'noreply@mg.needmepro.com', // רק אם תרצה
        });
      })
    );

    const sent = results.filter(
      (r) => r.status === 'fulfilled' && r.value.ok
    ).length;

    return NextResponse.json({ ok: true, sent, total: uniqueTargets.length });
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, error: e?.message ?? String(e) },
      { status: 500 }
    );
  }
}

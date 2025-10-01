// app/api/requests/route.ts
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { sendEmail } from '@/lib/mailer';
// שים לב לשם היצוא מהקובץ שלך: אם אצלך הפונקציה נקראת providerMatches – שנה כאן בהתאם
import { matchProviders } from '@/lib/match';

export const runtime = 'nodejs';

// ---------- Helpers ----------
function numOrNull(v: unknown): number | null {
  if (v === '' || v === null || v === undefined) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

async function readBody(req: Request) {
  const ctype = req.headers.get('content-type') || '';
  if (ctype.includes('application/x-www-form-urlencoded')) {
    const text = await req.text();
    const params = new URLSearchParams(text);
    return Object.fromEntries(params.entries());
  }
  if (ctype.includes('multipart/form-data')) {
    const form = await req.formData();
    const entries: Record<string, any> = {};
    for (const [k, v] of form.entries()) entries[k] = typeof v === 'string' ? v : v.name;
    return entries;
  }
  if (ctype.includes('application/json')) {
    try {
      return await req.json();
    } catch {
      return null;
    }
  }
  return null;
}

export async function OPTIONS() {
  return NextResponse.json({}, { status: 200 });
}

export async function POST(req: Request) {
  const raw = await readBody(req);
  if (!raw || typeof raw !== 'object') {
    return NextResponse.json({ ok: false, error: 'no-body' }, { status: 400 });
  }

  const live = String((raw as any).live ?? '1') === '1';

  const title = String((raw as any).title ?? '').trim();
  const category = String((raw as any).category ?? '').trim() as
    | 'service'
    | 'real_estate'
    | 'second_hand';
  const subcategory = String((raw as any).subcategory ?? '').trim();
  const budgetMin = numOrNull((raw as any).budgetMin);
  const budgetMax = numOrNull((raw as any).budgetMax);
  const region = String((raw as any).region ?? '').trim();
  const contactWindow = (String((raw as any).contactWindow ?? 'today').trim() ||
    'today') as 'immediate' | 'today' | 'this_week';
  const requesterName = String((raw as any).requesterName ?? '').trim();
  const requesterEmail = String((raw as any).requesterEmail ?? '').trim();
  const requesterPhone = String((raw as any).requesterPhone ?? '').trim();

  const missing: string[] = [];
  if (!title || title.length < 2) missing.push('title');
  if (!category) missing.push('category');
  if (!region) missing.push('region');
  if (!requesterName) missing.push('requesterName');
  if (!/^\S+@\S+\.\S+$/.test(requesterEmail)) missing.push('requesterEmail');
  if (missing.length) {
    return NextResponse.json({ ok: false, error: 'invalid', fields: missing }, { status: 400 });
  }

  // התאמות ספקים
  const providers = await prisma.provider.findMany({ where: { active: true } });
  const shortlist = matchProviders(
    { category, subcategory, region, budgetMax: budgetMax ?? undefined, title },
    providers
  ).slice(0, 20);

  let created: { id: string } | null = null;

  if (live) {
    // יצירת בקשה ב־DB
    const base = {
      title,
      category,
      subcategory,
      budgetMin,
      budgetMax,
      region,
      contactWindow,
      requesterName,
      requesterEmail,
      requesterPhone: requesterPhone || null,
      status: 'dispatched' as const,
    };

    try {
      created = await prisma.request.create({ data: base });
    } catch {
      // אם requesterPhone לא nullable בסכמה
      const { requesterPhone: _drop, ...rest } = base as any;
      created = await prisma.request.create({ data: rest });
    }

    // שליחת מיילים (חתימה חדשה: sendEmail({ to, subject, body }))
    const uniqueTargets = Array.from(new Set(shortlist.map((p) => p.email)));

    await Promise.allSettled(
      uniqueTargets.map((email) => {
        const lines = [
          `קטגוריה: ${category}${subcategory ? `/${subcategory}` : ''}`,
          `אזור: ${region}`,
          budgetMax ? `תקציב מקסימלי: ${budgetMax} ₪` : '',
          '',
          'פרטי יוצר:',
          requesterName,
          requesterEmail,
          requesterPhone || '',
        ].filter(Boolean);

        return sendEmail({
          to: email,
          subject: `NeedMe: בקשה חדשה – ${title}`,
          body: lines.join('\n'),
        });
      })
    );
  }

  return NextResponse.json({
    ok: true,
    live,
    requestId: created?.id ?? null,
    matchedProviders: shortlist.length,
  });
}

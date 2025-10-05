// app/api/requests/route.ts
import { NextResponse } from 'next/server';
import { sendEmail } from '@/lib/mailer';

export const runtime = 'nodejs';           // אין צורך ב-Edge כאן
export const dynamic = 'force-dynamic';    // כדי שלא יוטמן

function getFirst(body: Record<string, any>, keys: string[]) {
  for (const k of keys) {
    const v = body[k];
    if (v !== undefined && v !== null && String(v).trim() !== '') return String(v).trim();
  }
  return undefined;
}

async function parseBody(req: Request): Promise<Record<string, any>> {
  const ct = req.headers.get('content-type') || '';
  try {
    if (ct.includes('application/json')) {
      return await req.json();
    }
    if (ct.includes('application/x-www-form-urlencoded')) {
      const text = await req.text();
      const params = new URLSearchParams(text);
      const obj: Record<string, any> = {};
      params.forEach((v, k) => (obj[k] = v));
      return obj;
    }
    if (ct.includes('multipart/form-data')) {
      const fd = await req.formData();
      const obj: Record<string, any> = {};
      for (const [k, v] of fd.entries()) obj[k] = typeof v === 'string' ? v : v.name;
      return obj;
    }
  } catch (e) {
    console.error('[requests] parse error', e);
  }
  return {};
}

export async function POST(req: Request) {
  const body = await parseBody(req);

  // לוג דיבוג מאופק – תראה ב-Logs ב-Vercel
  console.log('[requests] incoming', {
    contentType: req.headers.get('content-type'),
    dataKeys: Object.keys(body),
  });

  // מפה שמות "ישנים" ו"חדשים"
  const title         = getFirst(body, ['title', 'subjectTitle']);
  const category      = getFirst(body, ['category']);
  const subcategory   = getFirst(body, ['subcategory']);
  const budgetMax     = getFirst(body, ['budgetMax', 'budget']);
  const region        = getFirst(body, ['region']);
  const contactWindow = getFirst(body, ['contactWindow']);
  const name          = getFirst(body, ['name', 'requesterName', 'fullName']);
  const email         = getFirst(body, ['email', 'requesterEmail', 'from']);
  const phone         = getFirst(body, ['phone', 'requesterPhone', 'tel']);
  const details       = getFirst(body, ['details', 'body', 'message', 'desc']);
  const live          = getFirst(body, ['live']);

  // אימייל יעד (סביבה)
  const TO = process.env.REQUESTS_TO?.trim();
  if (!TO) {
    console.error('[requests] missing env REQUESTS_TO');
    return NextResponse.json({ ok: false, error: 'REQUESTS_TO env is missing' }, { status: 500 });
  }

  // אם אין אימייל שולח – לא נכשיל, אבל נסמן שאין replyTo
  if (!email) {
    console.warn('[requests] missing sender email (email/requesterEmail)');
  }

  // בנה נושא/גוף
  const subject =
    `NeedMe: בקשה חדשה - ${title || category || 'ללא כותרת'}`;

  const lines: string[] = [];
  if (title)         lines.push(`כותרת: ${title}`);
  if (category)      lines.push(`קטגוריה: ${category}`);
  if (subcategory)   lines.push(`תת-קטגוריה: ${subcategory}`);
  if (budgetMax)     lines.push(`תקציב: ${budgetMax}`);
  if (region)        lines.push(`אזור: ${region}`);
  if (contactWindow) lines.push(`חלון יצירת קשר: ${contactWindow}`);
  if (name)          lines.push(`שם: ${name}`);
  if (email)         lines.push(`אימייל: ${email}`);
  if (phone)         lines.push(`טלפון: ${phone}`);
  if (live)          lines.push(`live: ${live}`);
  if (details) {
    lines.push('');
    lines.push('פרטים:');
    lines.push(details);
  }

  const text = lines.join('\n');
  const html =
    `<div dir="rtl" style="font-family: Arial, sans-serif">
      ${lines.map(l => {
        const [label, ...rest] = l.split(':');
        if (rest.length === 0) return `<p>${l}</p>`;
        return `<p><strong>${label}:</strong> ${rest.join(':').trim()}</p>`;
      }).join('')}
    </div>`;

  const res = await sendEmail({
    to: TO,
    subject,
    text,
    html,
    replyTo: email,     // אם אין אימייל זה פשוט undefined וזה בסדר
  });

  if (!res.ok) {
    console.error('[requests] send failed', res.error);
    return NextResponse.json({ ok: false, error: res.error }, { status: 500 });
  }

  return NextResponse.json({ ok: true, id: res.id }, { status: 200 });
}

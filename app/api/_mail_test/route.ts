// app/api/_mail_test/route.ts
import { NextResponse } from 'next/server';
import { sendEmail } from '@/lib/mailer';

// חשוב להריץ על nodejs ולא edge (Resend/Prisma וכו')
export const runtime = 'nodejs';

export async function GET() {
  const to =
    process.env.RESEND_TEST_TO ||
    process.env.DEV_MAIL_REDIRECT ||
    ''; // אם ריק – החזרה עם שגיאה ידידותית

  if (!to) {
    return NextResponse.json(
      { ok: false, error: 'RESEND_TEST_TO or DEV_MAIL_REDIRECT is missing' },
      { status: 400 }
    );
  }

  const html = `
    <div style="font-family:Arial,sans-serif">
      <h2>בדיקת שליחה – NeedMe</h2>
      <p>היי! זו הודעת בדיקה מרסנד.</p>
      <p><b>From:</b> ${process.env.MAIL_FROM || '(default)'}</p>
    </div>
  `;

  const res = await sendEmail({
    to,
    subject: 'בדיקת שליחה (Resend) – NeedMe',
    text: 'טקסט לבדיקה (fallback)',
    html,
    replyTo: 'noreply@mg.needmepro.com',
  });

  return NextResponse.json(res, { status: res.ok ? 200 : 500 });
}

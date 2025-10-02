import { Resend } from 'resend';

// חשוב: להכריח Node runtime, ליתר ביטחון
export const runtime = 'nodejs';

export async function GET() {
  const key = process.env.RESEND_API_KEY ?? '';
  const from = process.env.MAIL_FROM ?? 'NeedMe <noreply@mg.needmepro.com>';
  const to =
    process.env.RESEND_TEST_TO ??
    'hgmeir@gmail.com'; // או כל תיבה שלך לבדיקות

  const clientOk = !!key && key.startsWith('re_');

  try {
    const resend = new Resend(key);

    const result = await resend.emails.send({
      from,
      to,
      subject: 'NeedMe probe ✔',
      text: 'Plain-text probe from /api/resend_probe',
    });

    return new Response(
      JSON.stringify({
        ok: true,
        clientOk,
        keySuffix: key ? key.slice(-6) : null, // לא חושף מפתח מלא
        from,
        to,
        result,
      }),
      {
        status: 200,
        headers: { 'content-type': 'application/json' },
      },
    );
  } catch (e: any) {
    return new Response(
      JSON.stringify({
        ok: false,
        clientOk,
        keySuffix: key ? key.slice(-6) : null,
        from,
        to,
        error: e?.message ?? String(e),
      }),
      {
        status: 500,
        headers: { 'content-type': 'application/json' },
      },
    );
  }
}

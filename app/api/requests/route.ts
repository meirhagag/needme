// app/api/requests/route.ts
import { NextResponse } from "next/server";
import { sendEmail } from "@/lib/mailer";

type ReqShape = {
  email?: string;
  title?: string;
  lines?: string[] | string;
};

function toArray(v?: string[] | string): string[] {
  if (!v) return [];
  return Array.isArray(v) ? v : [v];
}

export async function POST(req: Request) {
  const ct = req.headers.get("content-type") || "";
  let data: ReqShape = {};

  try {
    if (ct.includes("application/json")) {
      data = await req.json();
    } else if (ct.includes("application/x-www-form-urlencoded")) {
      const text = await req.text();
      data = Object.fromEntries(new URLSearchParams(text)) as ReqShape;
      // אם מגיעה מחרוזת שורות, נפרק לפסיקים/שבירות שורה
      if (typeof data.lines === "string") {
        data.lines = data.lines.split(/\r?\n|,/).map(s => s.trim()).filter(Boolean);
      }
    } else if (ct.includes("multipart/form-data")) {
      const form = await req.formData();
      const obj: Record<string, any> = {};
      for (const [k, v] of form.entries()) obj[k] = v;
      if (typeof obj.lines === "string") {
        obj.lines = obj.lines.split(/\r?\n|,/).map((s: string) => s.trim()).filter(Boolean);
      }
      data = obj as ReqShape;
    } else {
      return NextResponse.json(
        { ok: false, error: `Unsupported Content-Type: ${ct}` },
        { status: 415 }
      );
    }

    const to = toArray(data.email ?? "");
    if (to.length === 0) {
      return NextResponse.json({ ok: false, error: "Missing 'email' (recipient)" }, { status: 400 });
    }

    const subject = data.title ?? "NeedMe – בקשה חדשה";
    const lines = toArray(data.lines);
    const text = lines.length ? lines.join("\n") : undefined;
    const html = lines.length ? lines.map(l => `<div>${l}</div>`).join("") : undefined;

    const result = await sendEmail({
      to,
      subject,
      text,
      html,
      // אפשר לסמן reply-to אם תרצה:
      // replyTo: "support@needmepro.com",
    });

    if (!result.ok) {
      return NextResponse.json({ ok: false, error: result.error, id: result.id }, { status: 502 });
    }
    return NextResponse.json({ ok: true, id: result.id });
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, error: String(e?.message ?? e) },
      { status: 500 }
    );
  }
}

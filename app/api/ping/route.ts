// app/api/ping/route.ts
import { NextResponse } from 'next/server';

export const runtime = 'edge'; // אופציונלי
export async function GET() {
  return NextResponse.json({ ok: true, now: new Date().toISOString() });
}

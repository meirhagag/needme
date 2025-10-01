// app/api/providers/import/route.ts
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export const runtime = 'nodejs'

type RawProvider = {
  orgName?: string
  email?: string
  categories?: string // ערכים מופרדים ב־'|'
  tags?: string
  regions?: string
  minBudget?: number | string | null
  maxBudget?: number | string | null
  active?: boolean | string
}

function toBool(v: unknown): boolean {
  if (typeof v === 'boolean') return v
  const s = String(v ?? '').trim().toLowerCase()
  return s === 'true' || s === '1' || s === 'yes'
}

function toIntOrNull(v: unknown): number | null {
  if (v === null || v === undefined || v === '') return null
  const n = Number(v)
  return Number.isFinite(n) ? Math.trunc(n) : null
}

function clean(s: unknown): string {
  return String(s ?? '').trim()
}

// CSV parser קטן שמכבד מרכאות כפולות
function parseCsv(text: string): RawProvider[] {
  const lines = text.replace(/\r\n?/g, '\n').split('\n').filter(l => l.trim() !== '')
  if (lines.length === 0) return []
  const header = splitCsvLine(lines[0])
  const rows: RawProvider[] = []
  for (let i = 1; i < lines.length; i++) {
    const cols = splitCsvLine(lines[i])
    const obj: Record<string, string> = {}
    header.forEach((h, idx) => { obj[h] = cols[idx] ?? '' })
    rows.push(obj as unknown as RawProvider)
  }
  return rows
}

function splitCsvLine(line: string): string[] {
  const out: string[] = []
  let cur = ''
  let inQ = false
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]
    if (inQ) {
      if (ch === '"' && line[i + 1] === '"') { cur += '"'; i++ } // "" => "
      else if (ch === '"') { inQ = false }
      else { cur += ch }
    } else {
      if (ch === '"') inQ = true
      else if (ch === ',') { out.push(cur); cur = '' }
      else { cur += ch }
    }
  }
  out.push(cur)
  return out.map(s => s.trim())
}

export async function POST(req: Request) {
  try {
    const ct = req.headers.get('content-type') || ''
    const rawBody = ct.includes('application/json') ? await req.text() : await req.text()
    console.log('[providers/import] content-type =', ct)
    console.log('[providers/import] raw length =', rawBody.length)

    if (!rawBody || rawBody.trim() === '') {
      return NextResponse.json({ ok: false, error: 'empty' }, { status: 400 })
    }

    let items: RawProvider[] = []

    if (ct.includes('application/json')) {
      // JSON יכול להיות מערך או אובייקט בודד
      const parsed = JSON.parse(rawBody)
      items = Array.isArray(parsed) ? parsed : [parsed]
    } else if (ct.includes('text/csv') || ct.includes('text/plain')) {
      items = parseCsv(rawBody)
    } else if (ct.includes('application/x-www-form-urlencoded')) {
      // תמיכה בסיסית גם ב־form-urlencoded אם מישהו שולח textarea עם CSV בשדה "csv"
      const form = await req.formData()
      const csvText = String(form.get('csv') ?? '')
      if (!csvText) {
        return NextResponse.json({ ok: false, error: 'no-supported-content-type' }, { status: 400 })
      }
      items = parseCsv(csvText)
    } else {
      return NextResponse.json({ ok: false, error: 'unsupported-content-type', ct }, { status: 400 })
    }

    console.log('[providers/import] parsed items =', items.length)

    if (!items.length) {
      return NextResponse.json({ ok: false, error: 'no-rows' }, { status: 400 })
    }

    // נרמול לשדות שה־DB מצפה להם (אצלך זה שדות טקסט, עם '|' לערכים מרובים)
    const rows = items.map((p) => ({
      orgName: clean(p.orgName),
      email: clean(p.email),
      categories: clean(p.categories), // לדוגמה: "service|real_estate"
      tags: clean(p.tags ?? ''),
      regions: clean(p.regions ?? ''),
      minBudget: toIntOrNull(p.minBudget),
      maxBudget: toIntOrNull(p.maxBudget),
      active: toBool(p.active ?? true),
    })).filter(r => r.orgName && r.email && r.categories && r.regions) // שדות חובה מינימליים

    if (!rows.length) {
      return NextResponse.json({ ok: false, error: 'no-valid-rows' }, { status: 400 })
    }

    // שמירה – אפשר createMany; אם יש ייחודיות על email, שקול upsert בלולאה
    const result = await prisma.provider.createMany({
      data: rows,
      skipDuplicates: true, // אם יש unique על email
    })

    console.log('[providers/import] saved count =', result.count)

    return NextResponse.json({ ok: true, count: result.count })
  } catch (err: any) {
    console.error('[providers/import] error:', err?.message || err)
    return NextResponse.json({ ok: false, error: 'server-error', detail: String(err?.message || err) }, { status: 500 })
  }
}

export async function GET() {
  // בדיקת בריאות קטנה
  const total = await prisma.provider.count()
  return NextResponse.json({ ok: true, total })
}

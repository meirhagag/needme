'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';

type Category = 'service' | 'real_estate' | 'second_hand';
type ContactWindow = 'immediate' | 'today' | 'this_week';

type RequestRow = {
  id: string;
  title: string;
  category: Category;
  subcategory: string;
  budgetMin: number | null;
  budgetMax: number | null;
  region: string;
  contactWindow: ContactWindow;
  requesterName: string;
  requesterEmail: string;
  requesterPhone: string | null;
  status: 'open' | 'dispatched' | 'closed';
  createdAt?: string;
};

type ProviderRow = {
  id: string;
  orgName: string;
  email: string;
  categories: string[];        // מוצג/נשלח כטקסט בצד השרת
  tags: string[];
  regions: string[];
  minBudget?: number | null;
  maxBudget?: number | null;
  active: boolean;
};

type EmailPreview = {
  to: string;
  subject: string;
  body: string;
  attachments?: { url: string; name: string }[];
};

const REGIONS = ['מרכז', 'שפלה', 'צפון', 'דרום', 'ירושלים', 'שרון'];

const HEB: Record<Category, string> = {
  service: 'שירות',
  real_estate: 'נדל״ן',
  second_hand: 'יד שנייה',
};

function uid() {
  return Math.random().toString(36).slice(2, 10);
}

function fmtBudget(min: number | null | undefined, max: number | null | undefined) {
  const fmt = (n?: number | null) => (typeof n === 'number' ? n.toLocaleString('he-IL') + ' ₪' : '—');
  if (min == null && max == null) return '—';
  if (min == null) return `עד ${fmt(max)}`;
  if (max == null) return `מ־${fmt(min)}`;
  return `${fmt(min)} – ${fmt(max)}`;
}

export default function Page() {
  /** ------- תצוגה/טופס ------- */
  const [live, setLive] = useState<boolean>(true);

  const [title, setTitle] = useState('');
  const [category, setCategory] = useState<Category>('service');
  const [subcategory, setSubcategory] = useState('');
  const [budgetMin, setBudgetMin] = useState<string>(''); // נשמר כמחרוזת בשדה קלט
  const [budgetMax, setBudgetMax] = useState<string>('');
  const [region, setRegion] = useState(REGIONS[0]);
  const [contactWindow, setContactWindow] = useState<ContactWindow>('today');
  const [firstName, setFirstName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');

  // תמונות להמחשה (נשמרות רק ב־state בצד לקוח)
  const [images, setImages] = useState<{ id: string; url: string; name: string }[]>([]);

  // תצוגה
  const [toast, setToast] = useState('');
  const adminRef = useRef<HTMLDivElement | null>(null);

  // ולידציה קלה בצד לקוח
  const titleInvalid = title.trim().length < 4;
  const emailInvalid = email.trim().length > 0 && !/^\S+@\S+\.\S+$/.test(email);
  const budgetInvalid =
    (budgetMin && isNaN(Number(budgetMin))) || (budgetMax && isNaN(Number(budgetMax)));

  // רשומות תצוגה (Preview בלבד + מה שנשלח)
  const [requests, setRequests] = useState<RequestRow[]>([]);
  const [providers, setProviders] = useState<ProviderRow[]>([]);
  const [emailsList, setEmailsList] = useState<EmailPreview[]>([]);

  // KPI קטן
  const kpis = useMemo(() => {
    const total = requests.length;
    const dispatched = requests.filter((r) => r.status === 'dispatched').length;
    const totalProviders = providers.length;
    const avgProviders = total ? Math.round((totalProviders / (total || 1)) * 10) / 10 : 0;
    return { total, dispatched, totalProviders, avgProviders };
  }, [requests, providers]);

  // תמונות
  function handleFiles(files: File[]) {
    const add = files.slice(0, 6 - images.length).map((f) => ({
      id: uid(),
      url: URL.createObjectURL(f),
      name: f.name,
    }));
    if (add.length) setImages((prev) => [...prev, ...add]);
  }
  function removeImage(id: string) {
    setImages((prev) => prev.filter((i) => i.id !== id));
  }

  /** ------- ייצוא CSV של בקשות (תצוגה) ------- */
  function exportRequestsCSV(rows: RequestRow[]) {
    const header = [
      'id',
      'title',
      'category',
      'subcategory',
      'budgetMin',
      'budgetMax',
      'region',
      'contactWindow',
      'requesterName',
      'requesterEmail',
      'requesterPhone',
      'status',
      'createdAt',
    ].join(',');
    const lines = rows.map((r) =>
      [
        r.id,
        r.title.replaceAll(',', ' '),
        r.category,
        r.subcategory.replaceAll(',', ' '),
        r.budgetMin ?? '',
        r.budgetMax ?? '',
        r.region,
        r.contactWindow,
        r.requesterName.replaceAll(',', ' '),
        r.requesterEmail,
        r.requesterPhone ?? '',
        r.status,
        r.createdAt ?? '',
      ].join(',')
    );
    const csv = [header, ...lines].join('\r\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `requests_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  /** ------- שליחת טופס ------- */
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const missing: string[] = [];
    if (titleInvalid) missing.push('כותרת קצרה מדי');
    if (!category) missing.push('קטגוריה');
    if (!region) missing.push('אזור');
    if (!firstName) missing.push('שם פרטי');
    if (!/^\S+@\S+\.\S+$/.test(email)) missing.push('אימייל');
    if (missing.length) {
      setToast('נא להשלים: ' + missing.join(', '));
      setTimeout(() => setToast(''), 2200);
      return;
    }

    // שליחה כ־x-www-form-urlencoded כדי להיות 1:1 עם ה־route הקיים
    const params = new URLSearchParams();
    params.set('title', title);
    params.set('category', category);
    params.set('subcategory', subcategory);
    if (budgetMin) params.set('budgetMin', budgetMin);
    if (budgetMax) params.set('budgetMax', budgetMax);
    params.set('region', region);
    params.set('contactWindow', contactWindow);
    params.set('requesterName', firstName);
    params.set('requesterEmail', email);
    if (phone) params.set('requesterPhone', phone);
    params.set('live', live ? '1' : '0');

    const res = await fetch('/api/requests', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: params.toString(),
    });

    const data = await res.json().catch(() => ({} as any));
    if (!res.ok || !data?.ok) {
      setToast('ארעה שגיאה בשליחה');
      setTimeout(() => setToast(''), 2200);
      return;
    }

    // מציגים Preview קטן + ניקוי חלקי
    const created: RequestRow = {
      id: data.requestId || uid(),
      title,
      category,
      subcategory,
      budgetMin: budgetMin ? Number(budgetMin) : null,
      budgetMax: budgetMax ? Number(budgetMax) : null,
      region,
      contactWindow,
      requesterName: firstName,
      requesterEmail: email,
      requesterPhone: phone || null,
      status: live ? 'dispatched' : 'open',
      createdAt: new Date().toISOString(),
    };
    setRequests((prev) => [created, ...prev]);
    setToast(live ? `נשלח בהצלחה • התאמות: ${data.matchedProviders ?? 0}` : 'נשמר בתצוגה מקדימה');
    setTimeout(() => setToast(''), 2200);
    // לא מוחקים לגמרי כדי לא לאבד ערכים
  }

  /** ------- טעינת ספקים מדוגמים לתצוגה (לא חובה) ------- */
  useEffect(() => {
    // ספקים לדוגמה (צד לקוח בלבד; import אמיתי דרך כפתור ה-CSV)
    setProviders([
      {
        id: uid(),
        orgName: 'חשמלאי מומלץ',
        email: 'elec@example.com',
        categories: ['service'],
        tags: ['חשמל', 'דחוף'],
        regions: ['מרכז', 'שפלה'],
        minBudget: null,
        maxBudget: 5000,
        active: true,
      },
      {
        id: uid(),
        orgName: 'ברוקר נדל״ן',
        email: 'broker@example.com',
        categories: ['real_estate'],
        tags: ['office', 'rent'],
        regions: ['מרכז', 'ת״א'],
        minBudget: 3000,
        maxBudget: null,
        active: true,
      },
    ]);
  }, []);

  /** ------- פילטרים לניהול קטן ------- */
  const [filterText, setFilterText] = useState('');
  const [filterStatus, setFilterStatus] = useState<'all' | 'open' | 'dispatched' | 'closed'>('all');
  const [filterRegion, setFilterRegion] = useState<'all' | string>('all');
  const [filterCategory, setFilterCategory] = useState<'all' | Category>('all');

  const filteredRequests = useMemo(() => {
    return requests.filter((r) => {
      const t = filterText.trim();
      if (t && !(`${r.title} ${r.subcategory} ${r.requesterName}`.includes(t))) return false;
      if (filterStatus !== 'all' && r.status !== filterStatus) return false;
      if (filterRegion !== 'all' && r.region !== filterRegion) return false;
      if (filterCategory !== 'all' && r.category !== filterCategory) return false;
      return true;
    });
  }, [requests, filterText, filterStatus, filterRegion, filterCategory]);

  /** ------- UI ------- */
  return (
    <main
      dir="rtl"
      className="min-h-screen text-slate-800 px-4 py-6 md:py-8"
    >
      {/* Header */}
      <header className="sticky top-0 z-10 border-b bg-white/70 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
          <div className="flex items-center gap-3">
            <span className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-tr from-indigo-600 via-fuchsia-500 to-rose-500 text-white shadow-sm">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2l1.6 5h5l-4 2.9L16.8 15 12 12.3 7.2 15 8.4 9.9 4.4 7h5L12 2z"/></svg>
            </span>
            <div>
              <h1 className="text-2xl font-bold tracking-tight">NeedMe</h1>
              <p className="text-sm text-slate-500">מבקש פוגש נותן שירות — בפשטות</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              className="rounded-xl border px-3 py-1.5 text-sm shadow-sm transition hover:-translate-y-0.5 hover:shadow-lg"
              onClick={() => adminRef.current?.scrollIntoView({ behavior: 'smooth' })}
            >
              לאזור הניהול
            </button>
            <label className="inline-flex select-none items-center gap-2 text-sm">
              <input type="checkbox" className="accent-indigo-600" checked={live} onChange={(e) => setLive(e.target.checked)} />
              <span className="rounded-full border px-3 py-1 text-xs">מצב: <b>{live ? 'LIVE' : 'Preview'}</b></span>
            </label>
          </div>
        </div>
      </header>

      <div className="mx-auto grid max-w-6xl gap-6 px-0 py-6 md:grid-cols-2">
        {/* Form card */}
        <section className="rounded-2xl border bg-white/90 p-5 shadow-sm backdrop-blur transition hover:shadow-md animate-[nm-pop_.25s_ease-out]">
          <h2 className="mb-3 inline-flex items-center gap-2 text-lg font-semibold">
            <span className="inline-block h-5 w-5 rounded-full bg-indigo-600"/>
            בקשה חדשה
          </h2>

          <form onSubmit={submit} className="grid gap-4">
            <div className="grid gap-1">
              <label className="text-sm text-slate-700">מה צריך?</label>
              <textarea
                className={`rounded-xl border p-3 text-right shadow-xs focus:outline-none focus:ring-2 focus:ring-indigo-500/40 transition ${titleInvalid ? 'border-red-500' : 'focus:border-indigo-400'}`}
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="לדוגמה: תיקון מזגן מיילר ל-3 חדרים"
              />
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="grid gap-1">
                <label className="text-sm">קטגוריה</label>
                <select className="rounded-xl border p-2 focus:outline-none focus:ring-2 focus:ring-indigo-500/40" value={category} onChange={(e) => setCategory(e.target.value as Category)}>
                  <option value="service">שירות</option>
                  <option value="real_estate">נדל״ן</option>
                  <option value="second_hand">יד שנייה</option>
                </select>
              </div>

              <div className="grid gap-1">
                <label className="text-sm">תת־קטגוריה</label>
                <input className="rounded-xl border p-2 text-right focus:outline-none focus:ring-2 focus:ring-indigo-500/40" value={subcategory} onChange={(e) => setSubcategory(e.target.value)} />
              </div>

              {/* תמונות להמחשה */}
              <div className="md:col-span-2 grid gap-2">
                <label className="text-sm">הוסף/י תמונות (אופציונלי)</label>
                <div
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={(e) => { e.preventDefault(); handleFiles(Array.from(e.dataTransfer.files)); }}
                  className="flex min-h-[80px] items-center justify-center rounded-2xl border-2 border-dashed border-indigo-300 bg-indigo-50/60 p-3 text-center text-xs text-indigo-700 transition hover:bg-indigo-50"
                >
                  גררו ושחררו קבצים
                  <label className="mx-1 cursor-pointer rounded-lg border border-indigo-200 bg-white px-2 py-1 shadow-sm transition hover:-translate-y-0.5 hover:shadow">
                    בחרו…
                    <input
                      type="file"
                      accept="image/*"
                      multiple
                      className="hidden"
                      onChange={(e) => {
                        const f = Array.from(e.target.files || []);
                        handleFiles(f);
                        (e.target as HTMLInputElement).value = '';
                      }}
                    />
                  </label>
                  <span className="text-slate-500"> (עד 6 תמונות, ~12MB לתמונה)</span>
                </div>

                {images.length > 0 && (
                  <div className="grid grid-cols-3 gap-2 md:grid-cols-4">
                    {images.map((img) => (
                      <div key={img.id} className="relative overflow-hidden rounded-xl border shadow-sm transition hover:shadow-md">
                        <img src={img.url} alt={img.name} className="h-28 w-full object-cover transition hover:scale-[1.02]" />
                        <button
                          type="button"
                          onClick={() => removeImage(img.id)}
                          className="absolute right-1 top-1 rounded-md bg-white/85 px-2 py-0.5 text-[10px] shadow hover:bg-white"
                          title="מחק תמונה"
                        >
                          ✕
                        </button>
                        <div className="truncate px-2 py-1 text-[11px]">{img.name}</div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="grid gap-1">
                <label className="text-sm">תקציב מקס׳</label>
                <input
                  type="number"
                  className={`rounded-xl border p-2 text-right focus:outline-none focus:ring-2 focus:ring-indigo-500/40 ${budgetInvalid ? 'border-red-500' : ''}`}
                  value={budgetMax}
                  onChange={(e) => setBudgetMax(e.target.value)}
                />
              </div>

              <div className="grid gap-1">
                <label className="text-sm">אזור</label>
                <select className="rounded-xl border p-2 focus:outline-none focus:ring-2 focus:ring-indigo-500/40" value={region} onChange={(e) => setRegion(e.target.value)}>
                  {REGIONS.map((r) => (<option key={r} value={r}>{r}</option>))}
                </select>
              </div>

              <div className="grid gap-1">
                <label className="text-sm">מתי ליצור קשר?</label>
                <select className="rounded-xl border p-2 focus:outline-none focus:ring-2 focus:ring-indigo-500/40" value={contactWindow} onChange={(e) => setContactWindow(e.target.value as ContactWindow)}>
                  <option value="immediate">מיידי</option>
                  <option value="today">היום</option>
                  <option value="this_week">השבוע</option>
                </select>
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-3">
              <div className="grid gap-1">
                <label className="text-sm">שם פרטי</label>
                <input className="w-full rounded-xl border p-2 text-right focus:outline-none focus:ring-2 focus:ring-indigo-500/40" value={firstName} onChange={(e) => setFirstName(e.target.value)} />
              </div>
              <div className="grid gap-1">
                <label className="text-sm">אימייל</label>
                <input
                  type="email"
                  inputMode="email"
                  dir="ltr"
                  className={`w-full rounded-xl border p-2 text-left font-mono focus:outline-none focus:ring-2 focus:ring-indigo-500/40 ${emailInvalid ? 'border-red-500' : ''}`}
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>
              <div className="grid gap-1">
                <label className="text-sm">טלפון (אופציונלי)</label>
                <input
                  inputMode="tel"
                  dir="ltr"
                  className="w-full rounded-xl border p-2 text-left font-mono focus:outline-none focus:ring-2 focus:ring-indigo-500/40"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                />
              </div>
            </div>

            <div className="flex items-center justify-between">
              <small className="text-slate-500">* שליחה במצב LIVE תשמור ותשלח התאמות</small>
              <button className="rounded-xl border bg-gradient-to-tr from-indigo-600 via-fuchsia-500 to-rose-500 px-5 py-2 font-medium text-white shadow-sm transition hover:-translate-y-0.5 hover:shadow-lg">
                שליחה
              </button>
            </div>
          </form>
        </section>

        {/* Right column: KPIs + Emails (תצוגה) */}
        <section className="space-y-6">
          {/* KPIs */}
          <div className="rounded-2xl border bg-white/90 p-5 shadow-sm backdrop-blur transition hover:shadow-md animate-[nm-fade_.25s_ease-out]">
            <h2 className="mb-3 text-lg font-semibold">מצב</h2>
            <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
              <KpiCard color="from-indigo-600 to-indigo-400" icon="spark" label="בקשות" value={kpis.total} />
              <KpiCard color="from-fuchsia-600 to-pink-500" icon="send" label="נשלחו" value={kpis.dispatched} />
              <KpiCard color="from-emerald-600 to-teal-500" icon="users" label="ספקים" value={kpis.totalProviders} />
              <KpiCard color="from-amber-500 to-orange-400" icon="avg" label="ספקים/בקשה" value={kpis.avgProviders} />
            </div>
            <div className="mt-4 rounded-xl border bg-slate-50 p-3 text-sm">
              מצב מערכת: <b>{live ? 'LIVE' : 'Preview'}</b>
            </div>
          </div>

          {/* Emails preview list (לקוח בלבד) */}
          <div className="rounded-2xl border bg-white/90 p-5 shadow-sm backdrop-blur transition hover:shadow-md">
            <h2 className="mb-3 text-lg font-semibold">מיילים (תצוגה)</h2>
            {emailsList.length === 0 ? (
              <p className="text-sm text-slate-500">אין מיילים להצגה עדיין.</p>
            ) : (
              <div className="space-y-3">
                {emailsList.map((m, i) => (
                  <div key={i} className="rounded-xl border p-3">
                    <div className="flex items-center justify-between text-sm">
                      <div>
                        <b>אל:</b> {m.to} &nbsp; | &nbsp; <b>נושא:</b> {m.subject}
                      </div>
                    </div>
                    <pre className="mt-2 whitespace-pre-wrap rounded-lg bg-slate-50 p-2 text-xs leading-relaxed text-slate-700">{m.body}</pre>
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>
      </div>

      {/* Admin mini — Requests */}
      <div ref={adminRef} className="mx-auto max-w-6xl px-0 pb-10">
        <div className="rounded-2xl border bg-white/90 p-5 shadow-sm backdrop-blur transition hover:shadow-md">
          <h2 className="mb-3 text-lg font-semibold">Admin — בקשות</h2>

          <div className="mb-3 flex flex-wrap items-center gap-2 text-sm">
            <input
              className="w-48 rounded-lg border p-2 text-right focus:outline-none focus:ring-2 focus:ring-indigo-500/40"
              placeholder="חיפוש טקסט"
              value={filterText}
              onChange={(e) => setFilterText(e.target.value)}
            />
            <select
              className="rounded-lg border p-2 focus:outline-none focus:ring-2 focus:ring-indigo-500/40"
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value as 'all' | 'open' | 'dispatched' | 'closed')}
              title="סינון לפי סטטוס"
            >
              <option value="all">כל הסטטוסים</option>
              <option value="open">פתוח</option>
              <option value="dispatched">נשלח</option>
              <option value="closed">נסגר</option>
            </select>

            <select
              className="rounded-lg border p-2 focus:outline-none focus:ring-2 focus:ring-indigo-500/40"
              value={filterRegion}
              onChange={(e) => setFilterRegion(e.target.value as 'all' | string)}
              title="סינון לפי אזור"
            >
              <option value="all">כל האזורים</option>
              {REGIONS.map((r) => (<option key={r} value={r}>{r}</option>))}
            </select>

            <select
              className="rounded-lg border p-2 focus:outline-none focus:ring-2 focus:ring-indigo-500/40"
              value={filterCategory}
              onChange={(e) => setFilterCategory(e.target.value as 'all' | Category)}
              title="סינון לפי קטגוריה"
            >
              <option value="all">כל הקטגוריות</option>
              <option value="service">שירות</option>
              <option value="real_estate">נדל״ן</option>
              <option value="second_hand">יד שנייה</option>
            </select>

            <button
              className="ml-auto rounded-xl border bg-white px-3 py-1 shadow-sm transition hover:-translate-y-0.5 hover:shadow"
              onClick={() => exportRequestsCSV(filteredRequests)}
              title="ייצוא בקשות ל-CSV"
            >
              יצוא CSV
            </button>
          </div>

          <div className="overflow-x-auto rounded-xl border bg-white/70 backdrop-blur">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="border-b bg-slate-50/70">
                  <th className="px-3 py-2 text-right">פעולות</th>
                  <th className="px-3 py-2 text-right">נוצר</th>
                  <th className="px-3 py-2 text-right">כותרת</th>
                  <th className="px-3 py-2 text-right">קטגוריה</th>
                  <th className="px-3 py-2 text-right">אזור</th>
                  <th className="px-3 py-2 text-right">תקציב</th>
                  <th className="px-3 py-2 text-right">סטטוס</th>
                </tr>
              </thead>
              <tbody>
                {filteredRequests.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-3 py-8 text-center text-slate-500">אין נתונים לתצוגה.</td>
                  </tr>
                ) : (
                  filteredRequests.map((r) => (
                    <tr key={r.id} className="border-b">
                      <td className="px-3 py-2">
                        <div className="flex justify-end gap-2">
                          <button
                            className="rounded-lg border border-indigo-300 bg-indigo-50 px-2 py-1 text-indigo-700 transition hover:bg-indigo-100"
                            onClick={() => setToast('נשלח שוב (תצוגה)')}
                          >
                            שלח שוב
                          </button>
                          <button
                            className="rounded-lg border border-amber-300 bg-amber-50 px-2 py-1 text-amber-800 transition hover:bg-amber-100"
                            onClick={() =>
                              setRequests((prev) =>
                                prev.map((x) => (x.id === r.id ? { ...x, status: 'closed' } : x))
                              )
                            }
                          >
                            סגור
                          </button>
                          <button
                            className="rounded-lg border border-rose-300 bg-rose-50 px-2 py-1 text-rose-700 transition hover:bg-rose-100"
                            onClick={() => setRequests((prev) => prev.filter((x) => x.id !== r.id))}
                          >
                            מחק
                          </button>
                        </div>
                      </td>
                      <td className="px-3 py-2">{r.createdAt ? new Date(r.createdAt).toLocaleString('he-IL') : '—'}</td>
                      <td className="max-w-[280px] truncate px-3 py-2" title={r.title}>{r.title}</td>
                      <td className="px-3 py-2">{HEB[r.category]}</td>
                      <td className="px-3 py-2">{r.region}</td>
                      <td className="px-3 py-2">{fmtBudget(r.budgetMin, r.budgetMax)}</td>
                      <td className="px-3 py-2">
                        <span
                          className={
                            r.status === 'open'
                              ? 'rounded-full bg-sky-50 px-2 py-0.5 text-xs text-sky-700 ring-1 ring-sky-200'
                              : r.status === 'dispatched'
                              ? 'rounded-full bg-indigo-600 px-2 py-0.5 text-xs text-white'
                              : 'rounded-full bg-slate-200 px-2 py-0.5 text-xs text-slate-700'
                          }
                        >
                          {r.status === 'open' ? 'פתוח' : r.status === 'dispatched' ? 'נשלח' : 'נסגר'}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Admin — Providers */}
      <div className="mx-auto max-w-6xl px-0 pb-16">
        <div className="rounded-2xl border bg-white/90 p-5 shadow-sm backdrop-blur transition hover:shadow-md">
          <h2 className="mb-3 text-lg font-semibold">Admin — ספקים</h2>

          <div className="mb-3 flex flex-wrap items-center gap-2 text-sm">
            <input
              id="providersCsvInput"
              type="file"
              accept=".csv,text/csv"
              className="rounded-lg border p-2"
              onChange={async (e) => {
                const f = e.target.files?.[0];
                if (!f) return;
                const text = await f.text();

                // שליחה ל־API הקיים (שומר ל-DB)
                const res = await fetch('/api/providers/import', {
                  method: 'POST',
                  headers: { 'Content-Type': 'text/plain;charset=utf-8' },
                  body: text,
                });
                const data = await res.json().catch(() => ({}));
                setToast(data?.ok ? `נשמרו ${data.count ?? 0} ספקים ל-DB` : 'שגיאה בשמירה ל-DB');
                setTimeout(() => setToast(''), 2200);

                // תצוגה לוקאלית בלבד
                try {
                  const parsedLocal = parseProvidersCSVForPreview(text);
                  if (parsedLocal.length) setProviders(parsedLocal);
                } catch { /* לא קריטי לתצוגה */ }

                (e.target as HTMLInputElement).value = '';
              }}
            />

            <button
              className="rounded-xl border bg-white px-3 py-1 shadow-sm transition hover:-translate-y-0.5 hover:shadow"
              onClick={() => {
                const header = 'orgName,email,categories,tags,regions,minBudget,maxBudget,active';
                const sample = [
                  'חשמלאי מומלץ,elec@example.com,service,חשמל|דחוף,מרכז|שפלה,,5000,true',
                  'ברוקר נדל״ן,broker@example.com,real_estate,office|rent,מרכז|ת״א,3000,,true',
                ].join('\r\n');
                const blob = new Blob([header + '\r\n' + sample], { type: 'text/csv;charset=utf-8' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url; a.download = 'providers_sample.csv'; a.click();
                URL.revokeObjectURL(url);
              }}
            >
              הורד CSV לדוגמה
            </button>
          </div>

          <div className="mb-2 text-sm text-slate-600">
            <b>{providers.length}</b> ספקים נטענו לתצוגה. פורמט ה־CSV:
            <code className="mx-1">orgName,email,categories,tags,regions,minBudget,maxBudget,active</code>
            (ריבוי ערכים מופרד ב־<code>|</code>)
          </div>

          <div className="overflow-x-auto rounded-xl border bg-white/70 backdrop-blur">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="border-b bg-slate-50/70">
                  <th className="px-3 py-2 text-right">שם</th>
                  <th className="px-3 py-2 text-right">אימייל</th>
                  <th className="px-3 py-2 text-right">קטגוריות</th>
                  <th className="px-3 py-2 text-right">תגיות</th>
                  <th className="px-3 py-2 text-right">אזורים</th>
                  <th className="px-3 py-2 text-right">טווח</th>
                  <th className="px-3 py-2 text-right">פעיל</th>
                </tr>
              </thead>
              <tbody>
                {providers.map((p) => (
                  <tr key={p.id} className="border-b">
                    <td className="px-3 py-2">{p.orgName}</td>
                    <td className="px-3 py-2" dir="ltr">{p.email}</td>
                    <td className="px-3 py-2">{p.categories.join(', ')}</td>
                    <td className="px-3 py-2">{p.tags.join(' · ')}</td>
                    <td className="px-3 py-2">{p.regions.join(', ')}</td>
                    <td className="px-3 py-2">{fmtBudget(p.minBudget ?? null, p.maxBudget ?? null)}</td>
                    <td className="px-3 py-2">{p.active ? '✓' : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

        </div>
      </div>

      {/* Toast */}
      {toast && (
        <div className="pointer-events-none fixed bottom-4 right-4 z-20 animate-[nm-pop_.2s_ease-out] rounded-xl border bg-white/95 px-4 py-2 text-sm shadow-lg backdrop-blur">
          {toast}
        </div>
      )}
    </main>
  );
}

/** ---------- Small KPI card ---------- */
function KpiCard({
  value,
  label,
  color,
  icon,
}: {
  value: string | number;
  label: string;
  color: string;
  icon: 'spark' | 'send' | 'users' | 'avg';
}) {
  return (
    <div className="flex items-center gap-3 rounded-xl border bg-white/80 p-3 shadow-sm backdrop-blur">
      <span className={`inline-flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-tr ${color} text-white`}>
        {icon === 'spark' && <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2l1.6 5h5l-4 2.9L16.8 15 12 12.3 7.2 15 8.4 9.9 4.4 7h5L12 2z"/></svg>}
        {icon === 'send' && <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M2 21l21-9L2 3v7l15 2-15 2z"/></svg>}
        {icon === 'users' && <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M16 11c1.66 0 2.99-1.34 2.99-3S17.66 5 16 5s-3 1.34-3 3 1.34 3 3 3zM8 11c1.66 0 2.99-1.34 2.99-3S9.66 5 8 5 5 6.34 5 8s1.34 3 3 3zM8 13c-2.67 0-8 1.34-8 4v2h10v-2c0-1.1.9-2 2-2h2c0-2.66-5.33-4-8-4zm8 2c-1.1 0-2 .9-2 2v2h10v-2c0-2.66-5.33-4-8-4z"/></svg>}
        {icon === 'avg' && <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M3 17h2v-7H3v7zm4 0h2V3H7v14zm4 0h2v-4h-2v4zm4 0h2V8h-2v9zm4 2H1v2h22v-2z"/></svg>}
      </span>
      <div>
        <div className="text-xs text-slate-500">{label}</div>
        <div className="text-lg font-semibold">{value}</div>
      </div>
    </div>
  );
}

/** ---------- CSV parse (לתצוגת ספקים בלבד, קליל) ---------- */
function parseProvidersCSVForPreview(text: string): ProviderRow[] {
  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  if (lines.length <= 1) return [];
  const rows = lines.slice(1);
  return rows.map((row) => {
    const parts = row.split(',');
    const [
      orgName = '',
      email = '',
      categories = '',
      tags = '',
      regions = '',
      minBudget = '',
      maxBudget = '',
      active = 'true',
    ] = parts;

    return {
      id: uid(),
      orgName: orgName.trim(),
      email: email.trim(),
      categories: categories ? categories.split('|').map((x) => x.trim()) : [],
      tags: tags ? tags.split('|').map((x) => x.trim()) : [],
      regions: regions ? regions.split('|').map((x) => x.trim()) : [],
      minBudget: minBudget ? Number(minBudget) : null,
      maxBudget: maxBudget ? Number(maxBudget) : null,
      active: active.trim().toLowerCase() === 'true',
    };
  });
}

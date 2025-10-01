// lib/match.ts

export type Category = 'service' | 'real_estate' | 'second_hand';

export interface ProviderRow {
  id?: string;
  orgName: string;
  email: string;
  categories: string; // נשמר כטקסט "service|real_estate"
  tags: string;       // תתי-קטגוריות/תגיות, גם כטקסט "חשמל|צבע"
  regions: string;    // אזורים, גם כטקסט "מרכז|שפלה"
  minBudget?: number | null;
  maxBudget?: number | null;
  active: boolean;
}

export interface MatchInput {
  category: Category;
  subcategory?: string;
  region: string;
  budgetMax?: number;
  title?: string;
}

/** התאמת ספקים בסיסית על בסיס שדות טקסט מרובי ערכים (עם מפריד '|') */
export function matchProviders(input: MatchInput, providers: ProviderRow[]) {
  const sub = (input.subcategory || '').trim();
  const reg = input.region.trim();

  const has = (blob: string, token: string) => {
    if (!blob || !token) return false;
    const parts = blob.split('|').map((s) => s.trim().toLowerCase()).filter(Boolean);
    return parts.includes(token.toLowerCase());
  };

  const scoreOf = (p: ProviderRow) => {
    let score = 0;

    // קטגוריה חובה
    if (!has(p.categories || '', input.category)) return -1;
    score += 3;

    // תת־קטגוריה (תג)
    if (sub) {
      if (has(p.tags || '', sub)) score += 2;
      else score -= 1;
    }

    // אזור
    if (reg) {
      if (has(p.regions || '', reg)) score += 2;
      else score -= 1;
    }

    // תקציב מקס׳
    if (input.budgetMax != null && p.minBudget != null) {
      if (input.budgetMax < p.minBudget) score -= 1;
    }

    // בונוס קל אם השם מופיע בכותרת
    if (input.title && p.orgName && input.title.includes(p.orgName)) score += 1;

    return score;
  };

  return providers
    .filter((p) => p.active)
    .map((p) => ({ p, s: scoreOf(p) }))
    .filter(({ s }) => s >= 0)
    .sort((a, b) => b.s - a.s)
    .map(({ p }) => p);
}

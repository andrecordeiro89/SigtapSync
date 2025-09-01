export type AnalyticsRow = {
  doctor_id?: string;
  doctor_name: string;
  doctor_cns?: string;
  discharge_date: string; // ISO
  aih_value: number; // reais
};

export type AnalyticsFilters = {
  dateStart?: string;
  dateEnd?: string;
  hospitals?: string[];
  specialty?: string;
  careCharacter?: string;
  topN?: number;
};

const API_URL = import.meta.env.VITE_ANALYTICS_API_URL || 'http://localhost:8001';
const INTERNAL_TOKEN = import.meta.env.VITE_ANALYTICS_TOKEN || 'dev-token';

async function post<T>(path: string, payload: any): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-internal-token': INTERNAL_TOKEN,
    },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error(`Analytics API ${path} failed: ${res.status}`);
  return res.json();
}

export const AnalyticsService = {
  ranking: (filters: AnalyticsFilters, rows: AnalyticsRow[]) => post<{ ranking: Array<{ doctor: string; avg: number }> }>(
    '/analytics/ranking',
    { filters, rows }
  ),
  series: (filters: AnalyticsFilters, rows: AnalyticsRow[]) => post<{ bins: string[]; series: Array<{ doctor: string; values: Array<number | null> }> }>(
    '/analytics/series',
    { filters, rows }
  ),
  share: (filters: AnalyticsFilters, rows: AnalyticsRow[]) => post<{ share: Array<{ doctor: string; value: number; pct: number }> }>(
    '/analytics/share',
    { filters, rows }
  ),
};



import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

// ===== Date/Time Helpers with explicit timezone =====
import { ENV_CONFIG } from '@/config/env';

/**
 * Format a date string into pt-BR with an explicit timezone (America/Sao_Paulo by default).
 * Accepts ISO strings or 'YYYY-MM-DD'.
 */
export function formatDateBrTz(dateString?: string, tz: string = ENV_CONFIG.DEFAULT_TIMEZONE): string {
  if (!dateString) return '—';
  const s = String(dateString).trim();
  const ymd = s.match(/^\d{4}-\d{2}-\d{2}$/);
  try {
    if (ymd) {
      const [y, m, d] = s.split('-').map(Number);
      const dt = new Date(Date.UTC(y, (m || 1) - 1, d || 1, 0, 0, 0, 0));
      return new Intl.DateTimeFormat('pt-BR', { timeZone: tz }).format(dt);
    }
    const dt = new Date(s);
    if (isNaN(dt.getTime())) return s;
    return new Intl.DateTimeFormat('pt-BR', { timeZone: tz }).format(dt);
  } catch {
    return s;
  }
}

/** Return start-of-day and start-of-next-day as ISO strings for SQL filters in TZ */
export function dayWindowIso(date: Date, tz: string = ENV_CONFIG.DEFAULT_TIMEZONE): { startIso: string; endIso: string } {
  const fmt = new Intl.DateTimeFormat('en-CA', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit' });
  const parts = fmt.formatToParts(date);
  const year = Number(parts.find(p => p.type === 'year')?.value || '1970');
  const month = Number(parts.find(p => p.type === 'month')?.value || '01');
  const day = Number(parts.find(p => p.type === 'day')?.value || '01');
  const start = new Date(Date.UTC(year, month - 1, day, 0, 0, 0, 0));
  const end = new Date(Date.UTC(year, month - 1, day + 1, 0, 0, 0, 0));
  return { startIso: start.toISOString(), endIso: end.toISOString() };
}

/** Return start and end ISO for a given month (competency) in TZ */
export function monthWindowIso(year: number, month1To12: number, tz: string = ENV_CONFIG.DEFAULT_TIMEZONE): { startIso: string; endIso: string } {
  const start = new Date(Date.UTC(year, month1To12 - 1, 1, 0, 0, 0, 0));
  const end = new Date(Date.UTC(year, month1To12, 1, 0, 0, 0, 0));
  return { startIso: start.toISOString(), endIso: end.toISOString() };
}
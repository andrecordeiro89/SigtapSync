/**
 * Utilities for handling Brazilian date formats (dd/MM/yyyy)
 */

/** Parse a dd/MM/yyyy string to a Date (local timezone). Returns null if invalid. */
export function parsePtDateToDate(dateStr?: string | null): Date | null {
  if (!dateStr || typeof dateStr !== 'string') return null;
  const m = dateStr.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (!m) return null;
  const day = Number(m[1]);
  const month = Number(m[2]) - 1; // JS months are 0-based
  const year = Number(m[3]);
  const d = new Date(year, month, day, 0, 0, 0, 0);
  // Basic sanity check to avoid JS date rollovers
  if (d.getFullYear() !== year || d.getMonth() !== month || d.getDate() !== day) return null;
  return d;
}

/** Convert dd/MM/yyyy to ISO string (UTC midnight). Returns null if invalid. */
export function parsePtDateToISO(dateStr?: string | null): string | null {
  const d = parsePtDateToDate(dateStr);
  if (!d) return null;
  // Convert to ISO (UTC) midnight
  const utc = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0, 0));
  return utc.toISOString();
}

/** Normalize to dd/MM/yyyy (pads zeros). Returns null if invalid. */
export function normalizePtDate(dateStr?: string | null): string | null {
  const d = parsePtDateToDate(dateStr);
  if (!d) return null;
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const yyyy = String(d.getFullYear());
  return `${dd}/${mm}/${yyyy}`;
}



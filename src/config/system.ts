export const LEAN_MODE: boolean = (
  (import.meta.env.VITE_LEAN_MODE ?? 'false').toString().trim().toLowerCase()
) === 'true';


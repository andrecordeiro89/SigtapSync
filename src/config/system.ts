export const LEAN_MODE: boolean = (
  (import.meta.env.VITE_LEAN_MODE ?? 'true').toString().trim().toLowerCase()
) === 'true';


export const LEAN_MODE: boolean = (
  (import.meta.env.VITE_LEAN_MODE ?? 'false').toString().trim().toLowerCase()
) === 'true';

export const DISCRIMINATE_PROCEDURE_PAYMENTS: boolean = (
  (import.meta.env.VITE_DISCRIMINATE_PROCEDURE_PAYMENTS ?? 'true').toString().trim().toLowerCase()
) === 'true';


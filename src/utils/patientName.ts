export function isLikelyProcedureString(raw: string | null | undefined): boolean {
	if (!raw) return false;
	const value = String(raw).trim().toLowerCase();
	if (!value) return false;

	// Heuristics: contains keywords related to procedure headers or looks like a SIGTAP code
	const hasProcedureKeyword = /(procedimento\s+solicitado|procedimento\s+principal|procedimentos?\s+realizados?)/i.test(value);
	const looksLikeSigtapCode = /\b\d{2}\.\d{2}\.\d{2}\.\d{3}-\d\b/.test(value);

	return hasProcedureKeyword || looksLikeSigtapCode;
}

export function sanitizePatientName(raw: string | null | undefined): string {
	const fallback = 'Nome não informado';
	if (!raw) return fallback;
	const trimmed = String(raw).trim();
	if (!trimmed) return fallback;
	if (isLikelyProcedureString(trimmed)) return fallback;
	// Collapse inner whitespaces
	return trimmed.replace(/\s{2,}/g, ' ');
}



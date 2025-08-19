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

	// 1) Colapsar espaços internos
	let cleaned = trimmed.replace(/\s{2,}/g, ' ');

	// 2) Normalização Unicode (NFD) para separar diacríticos e remoção dos diacríticos
	//    Mantém apenas letras, dígitos, espaços e pontuação básica
	const withoutDiacritics = cleaned
		.normalize('NFD')
		.replace(/[\u0300-\u036f]/g, '');

	// 3) Remover caracteres de controle e símbolos estranhos (exceto -' e .)
	cleaned = withoutDiacritics.replace(/[^A-Za-z0-9ÁÉÍÓÚÂÊÎÔÛÃÕÄËÏÖÜÇáéíóúâêîôûãõäëïöüç\-\.\'\s]/g, '');

	// 4) Trim final e colapso novamente se necessário
	cleaned = cleaned.trim().replace(/\s{2,}/g, ' ');

	// 5) Garantir capitalização simples (Opcional: apenas Primeira letra maiúscula por palavra)
	//    Mantém siglas (CNS, SUS) como estão se forem completamente maiúsculas
	cleaned = cleaned
		.split(' ')
		.map(token => (/^[A-Z]{2,}$/.test(token) ? token : token.charAt(0).toUpperCase() + token.slice(1).toLowerCase()))
		.join(' ');

	return cleaned || fallback;
}



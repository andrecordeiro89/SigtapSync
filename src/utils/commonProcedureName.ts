import { COMMON_PROCEDURE_NAME_RULES } from "../config/commonProcedureNames";

type ProcedureLike = { procedure_code?: string; procedure_date?: string; sequence?: number };

// Dado um conjunto de códigos de procedimentos (string[]), retorna o Nome Comum
// Aplica a primeira regra que casar (prioridade pela ordem de declaração)
export function resolveCommonProcedureName(
	codes: string[], 
	doctorSpecialty?: string | null,
	procedures?: ProcedureLike[] | null
): string | null {
	if (!codes || codes.length === 0) return null;
	const codeSet = new Set(codes.map(c => (c || "").trim()));
	const specialty = (doctorSpecialty || "").trim().toLowerCase();

	for (const rule of COMMON_PROCEDURE_NAME_RULES) {
		// Especialidade (se definida na regra)
		if (rule.specialties && rule.specialties.length > 0) {
			if (!specialty) {
				continue; // regra requer especialidade, mas não foi informada
			}
			const matchesSpecialty = rule.specialties.some(s => {
				const target = (s || "").trim().toLowerCase();
				// Igualdade ou contenção para tolerar variações (ex.: "Otorrino")
				return specialty === target || specialty.includes(target) || target.includes(specialty);
			});
			if (!matchesSpecialty) continue;
		}

		// primaryAnyOf: requer que o procedimento principal/primeiro pertença ao conjunto
		if ((rule as any).primaryAnyOf && (rule as any).primaryAnyOf.length > 0 && Array.isArray(procedures) && procedures.length > 0) {
			const principal = procedures
				.filter(p => p && p.procedure_code)
				.sort((a, b) => {
					const seqA = (a.sequence ?? 999999);
					const seqB = (b.sequence ?? 999999);
					if (seqA !== seqB) return seqA - seqB;
					const da = a.procedure_date ? new Date(a.procedure_date).getTime() : Number.POSITIVE_INFINITY;
					const db = b.procedure_date ? new Date(b.procedure_date).getTime() : Number.POSITIVE_INFINITY;
					return da - db;
				})[0];
			if (principal) {
				const code = (principal.procedure_code || "").trim();
				const matchesPrimary = (rule as any).primaryAnyOf.some((c: string) => c === code);
				if (!matchesPrimary) {
					continue; // não atende ao requisito de principal
				}
			}
		}

		// Exclusividade médica (04.*): se definido, todos os códigos "04" do paciente
		// devem estar contidos em allowedOnlyWithinMedical04Codes
		if ((rule as any).allowedOnlyWithinMedical04Codes && (rule as any).allowedOnlyWithinMedical04Codes.length > 0) {
			const allowedSet = new Set<string>((rule as any).allowedOnlyWithinMedical04Codes);
			const medical04Codes = Array.from(codeSet).filter(code => typeof code === 'string' && code.startsWith('04'));
			const allAllowed = medical04Codes.every(code => allowedSet.has(code));
			if (!allAllowed) {
				continue;
			}
		}

		// allOf (combinação exata - todos devem estar presentes)
		if (rule.allOf && rule.allOf.length > 0) {
			const allPresent = rule.allOf.every(code => codeSet.has(code));
			if (allPresent) return rule.label;
		}

		// anyOf (qualquer ocorrência ativa)
		if (rule.anyOf && rule.anyOf.length > 0) {
			const anyPresent = rule.anyOf.some(code => codeSet.has(code));
			if (anyPresent) return rule.label;
		}
	}

	return null;
}



// Lightweight deterministic hash for idempotency keys (no crypto dependency)
export function simpleHash(input: string): string {
	let hash = 5381;
	for (let i = 0; i < input.length; i++) {
		hash = ((hash << 5) + hash) ^ input.charCodeAt(i); // djb2 ^ variant
	}
	// Convert to unsigned 32-bit and hex
	return (hash >>> 0).toString(16).padStart(8, '0');
}

export function buildAIHIdempotencyKey(params: {
	hospitalId: string;
	aihNumber: string | undefined | null;
	admissionDate: string | undefined | null;
	procedureCode: string | undefined | null;
	patientId?: string | undefined | null;
	patientCns?: string | undefined | null;
}): string {
	const parts = [
		params.hospitalId || 'HOSP',
		(params.aihNumber || '-').trim(),
		(params.admissionDate || '').toString().slice(0, 10),
		(params.procedureCode || '').trim(),
		(params.patientId || '').toString(),
		(params.patientCns || '').toString(),
	];
	return simpleHash(parts.join('|'));
}



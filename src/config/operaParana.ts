// Configuração central do Programa Opera Paraná
// - Elegibilidade: procedimentos com caráter de atendimento eletivo ('1' ou 'Eletivo')
// - Exclusões: lista de códigos que NÃO recebem o incremento (eletivo e urgência)

export const OPERA_PARANA_EXCLUDED_CODES_RAW: string[] = [
  // Quadril
  '04.08.04.009-2', // ARTROPLASTIA TOTAL PRIMARIA DO QUADRIL NÃO CIMENTADA / HÍBRIDA DE QUADRIL E SUA ESTABILIZAÇÃO
  '04.08.04.005-0', // ARTROPLASTIA PARCIAL DE QUADRIL
  '04.08.04.006-8', // ARTROPLASTIA TOTAL DE CONVERSÃO DO QUADRIL
  '04.08.04.008-4', // ARTROPLASTIA TOTAL PRIMÁRIA DO QUADRIL CIMENTADA
  '04.08.04.007-6', // ARTROPLASTIA TOTAL DE QUADRIL (REVISÃO OU RECONSTRUÇÃO)
  // Joelho
  '04.08.05.006-3', // ARTROPLASTIA TOTAL PRIMARIA DO JOELHO
  '04.08.05.004-7', // ARTROPLASTIA DE JOELHO (NÃO CONVENCIONAL)
  '04.08.05.007-1', // ARTROPLASTIA UNICOMPARTIMENTAL PRIMARIA DO JOELHO
  '04.08.05.005-5', // ARTROPLASTIA TOTAL DE JOELHO - REVISÃO / RECONSTRUÇÃO
  '04.08.05.016-0', // RECONSTRUÇÃO LIGAMENTAR INTRA-ARTICULAR DO JOELHO (CRUZADO ANTERIOR)
  '04.08.05.089-6', // TRATAMENTO CIRÚRGICO DE ROTURA DO MENISCO COM MENISCECTOMIA PARCIAL / TOTAL
  // Otorrino
  '04.04.01.001-6', // ADENOIDECTOMIA
  '04.04.01.002-4', // AMIGDALECTOMIA
  '04.04.01.003-2', // AMIGDALECTOMIA COM ADENOIDECTOMIA
  '04.04.01.035-0', // TIMPANOPLASTIA (UNI / BILATERAL)
  '04.04.01.041-5', // TURBINECTOMIA
  '04.04.01.048-2', // SEPTOPLASTIA PARA CORREÇÃO DE DESVIO
  '04.04.01.052-0', // SEPTOPLASTIA REPARADORA NÂO ESTÉTICA
  '04.04.01.033-4', // SINUSOTOMIA ESFENOIDAL
  '04.04.01.032-6', // SINUSOTOMIA BILATERAL
  '04.04.01.051-2', // SINUSOTOMIA TRANSMAXILAR
];

export const normalizeSigtapCode = (code: string | null | undefined): string => {
  return (code ?? '').toString().replace(/[\.\s-]/g, '');
};

export const OPERA_PARANA_EXCLUDED_CODES = new Set(
  OPERA_PARANA_EXCLUDED_CODES_RAW.map(normalizeSigtapCode)
);

export const isOperaParanaEligible = (
  procedureCode: string | null | undefined,
  careCharacter?: string | number | null
): boolean => {
  const codeStr = (procedureCode ?? '').toString().trim();
  if (!codeStr) return false;
  const ccRaw = (careCharacter ?? '').toString().trim();
  // normalizar: remover zeros à esquerda e acentos, case-insensitive
  const ccNum = ccRaw.replace(/^0+/, '');
  const ccAscii = ccRaw
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase();
  const isElective = ccNum === '1' || ccAscii === 'eletivo';
  if (!isElective) return false;
  const normalized = normalizeSigtapCode(codeStr);
  return !OPERA_PARANA_EXCLUDED_CODES.has(normalized);
};

// Lista de médicos não contemplados pelo programa (nome normalizado em maiúsculas)
const OPERA_PARANA_DOCTOR_DENY = new Set<string>([
  'HUMBERTO MOREIRA DA SILVA'
]);

export const isDoctorCoveredForOperaParana = (
  doctorName?: string,
  _hospitalId?: string
): boolean => {
  if (!doctorName) return true;
  const key = doctorName.toString().trim().toUpperCase();
  return !OPERA_PARANA_DOCTOR_DENY.has(key);
};

// Normalizadores de Caráter
const normalizeCare = (cc: string | number | null | undefined): string => {
  const raw = (cc ?? '').toString().trim();
  const noZero = raw.replace(/^0+/, '');
  return noZero
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase();
};

export const isElectiveCare = (cc: string | number | null | undefined): boolean => {
  const n = normalizeCare(cc);
  return n === '1' || n === 'eletivo';
};

export const isUrgencyCare = (cc: string | number | null | undefined): boolean => {
  const n = normalizeCare(cc);
  return n === '2' || n.includes('urg') || n.includes('emerg');
};

export interface SimpleProcedureLike {
  procedure_code?: string;
  value_reais?: number;
}

/**
 * Calcula o incremento total para uma AIH a partir dos procedimentos e do caráter de atendimento.
 * - Eletivo (1): +50% sobre os procedimentos elegíveis do Opera Paraná (códigos 04 não excluídos)
 * - Urgência/Emergência (2): +20% sobre todos os procedimentos cirúrgicos (códigos iniciados por 04)
 * Retorna 0 quando não houver incremento aplicável.
 */
export const computeIncrementForProcedures = (
  procedures: SimpleProcedureLike[] | undefined,
  careCharacter?: string | number | null,
  doctorName?: string,
  hospitalId?: string
): number => {
  const procs = Array.isArray(procedures) ? procedures : [];
  if (procs.length === 0) return 0;

  // Regra 1: Eletivo (Opera Paraná 150%)
  if (isElectiveCare(careCharacter)) {
    if (!isDoctorCoveredForOperaParana(doctorName, hospitalId)) return 0;
    const eligibleSum = procs.reduce((sum, p) => (
      isOperaParanaEligible(p.procedure_code, '1') ? sum + (p.value_reais || 0) : sum
    ), 0);
    return eligibleSum > 0 ? eligibleSum * 0.5 : 0;
  }

  // Regra 2: Urgência/Emergência (20% sobre todos, exceto excluídos)
  if (isUrgencyCare(careCharacter)) {
    const sumAllEligible = procs.reduce((sum, p) => {
      const normalized = normalizeSigtapCode((p.procedure_code || '').toString());
      return OPERA_PARANA_EXCLUDED_CODES.has(normalized) ? sum : sum + (p.value_reais || 0);
    }, 0);
    return sumAllEligible > 0 ? sumAllEligible * 0.2 : 0;
  }

  return 0;
};

export const isUrgencySurgicalEligible = (
  procedureCode?: string,
  careCharacter?: string | number | null
): boolean => {
  const normalized = normalizeSigtapCode((procedureCode || '').toString());
  return isUrgencyCare(careCharacter) && !OPERA_PARANA_EXCLUDED_CODES.has(normalized);
};

export const getProcedureIncrementMeta = (
  procedureCode?: string,
  careCharacter?: string | number | null,
  doctorName?: string,
  hospitalId?: string
): { factor: number; label: string } | null => {
  // Prioridade: 150% eletivo, quando elegível e médico contemplado
  if (isElectiveCare(careCharacter) && isDoctorCoveredForOperaParana(doctorName, hospitalId) && isOperaParanaEligible(procedureCode || '', '1')) {
    return { factor: 1.5, label: 'Opera Paraná +150%' };
  }
  // Urgência: 20% sobre cirúrgicos
  if (isUrgencySurgicalEligible(procedureCode, careCharacter)) {
    return { factor: 1.2, label: 'Urgência +20%' };
  }
  return null;
};



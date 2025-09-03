// Configuração central do Programa Opera Paraná
// - Elegibilidade: procedimentos médicos (códigos iniciados por '04') com caráter de atendimento eletivo ('1' ou 'Eletivo')
// - Exclusões: lista de códigos que NÃO recebem o incremento de 150%

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
  if (!codeStr || !codeStr.startsWith('04')) return false;
  const cc = (careCharacter ?? '').toString();
  const isElective = cc === '1' || cc.toLowerCase() === 'eletivo';
  if (!isElective) return false;
  const normalized = normalizeSigtapCode(codeStr);
  return !OPERA_PARANA_EXCLUDED_CODES.has(normalized);
};



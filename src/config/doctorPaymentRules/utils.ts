/**
 * ================================================================
 * FUNÇÕES UTILITÁRIAS - REGRAS DE PAGAMENTO MÉDICO
 * ================================================================
 * Funções compartilhadas para cálculo de pagamentos
 * ================================================================
 */

import type { 
  DoctorPaymentRule, 
  ProcedurePaymentInfo,
  CalculatedPaymentResult,
  FixedPaymentResult,
  PercentagePaymentResult,
  UnruledProceduresResult,
  HospitalMapping
} from './types';

// ================================================================
// CACHE DE REGRAS PARA PERFORMANCE O(1)
// ================================================================

let FIXED_RULES_CACHE: Map<string, { amount: number; description: string; hospitalId?: string }> | null = null;
let PERCENTAGE_RULES_CACHE: Map<string, { percentage: number; description: string; hospitalId?: string }> | null = null;
let INDIVIDUAL_RULES_CACHE: Map<string, DoctorPaymentRule> | null = null;

// ================================================================
// MAPEAMENTO DE HOSPITAIS
// ================================================================

export const HOSPITAL_MAPPINGS: HospitalMapping[] = [
  {
    id: '01221e51-4bcd-4c45-b3d3-18d1df25c8f2',
    key: 'HOSPITAL_18_DEZEMBRO_ARAPOTI',
    name: 'Hospital 18 de Dezembro - Arapoti'
  },
  {
    id: '792a0316-92b4-4504-8238-491d284099a3',
    key: 'HOSPITAL_MUNICIPAL_SAO_JOSE',
    name: 'Hospital Municipal São José'
  },
  {
    id: '47eddf6e-ac64-4433-acc1-7b644a2b43d0',
    key: 'HOSPITAL_NOSSA_SENHORA_APARECIDA_FOZ',
    name: 'Hospital Nossa Senhora Aparecida - Foz do Iguaçu'
  },
  {
    id: 'a8978eaa-b90e-4dc8-8fd5-0af984374d34',
    key: 'HOSPITAL_MATERNIDADE_NOSSA_SENHORA_APARECIDA_FRG',
    name: 'Hospital Maternidade Nossa Senhora Aparecida - FRG'
  },
  {
    id: '1d8ca73a-1927-462e-91c0-fa7004d0b377',
    key: 'HOSPITAL_MUNICIPAL_SANTA_ALICE',
    name: 'Hospital Municipal Santa Alice'
  },
  {
    id: '019c7380-459d-4aa5-bbd8-2dba4f361e7e',
    key: 'HOSPITAL_MUNICIPAL_JUAREZ_BARRETO_MACEDO',
    name: 'Hospital Municipal Juarez Barreto de Macedo'
  },
  {
    id: '1218dd7b-efcb-442e-ad2b-b72d04128cb9',
    key: 'HOSPITAL_GUA_CENTRO_MEDICINA_AVANCADA',
    name: 'Hospital GUA - Centro de Medicina Avançada'
  },
  {
    id: '68bf9b1a-9d0b-423b-9bb3-3c02017b1d7b',
    key: 'HOSPITAL_SM_SANTA_MARIA',
    name: 'Hospital SM - Santa Maria'
  },
  {
    id: 'f47ac10b-58cc-4372-a567-0e02b2c3d479',
    key: 'TORAO_TOKUDA_APUCARANA',
    name: 'Hospital Torao Tokuda - Apucarana'
  }
];

// ================================================================
// FUNÇÃO: DETECTAR HOSPITAL
// ================================================================

export function detectHospitalFromContext(
  doctorName: string, 
  hospitalId?: string,
  allHospitalRules?: Record<string, Record<string, DoctorPaymentRule>>
): string {
  // Prioridade 1: ID do hospital fornecido (SEMPRE usar se disponível)
  if (hospitalId) {
    const mapping = HOSPITAL_MAPPINGS.find(m => m.id === hospitalId);
    if (mapping) {
      return mapping.key;
    }
    
    console.warn(`⚠️ Hospital ID não reconhecido: ${hospitalId}`);
    return 'TORAO_TOKUDA_APUCARANA';
  }
  
  // Prioridade 2+: Verificar se médico existe em cada hospital
  if (allHospitalRules) {
    const doctorUpper = doctorName.toUpperCase();
    
    // Buscar em ordem de prioridade
    const hospitalKeys = [
      'HOSPITAL_NOSSA_SENHORA_APARECIDA_FOZ',
      'HOSPITAL_MUNICIPAL_SAO_JOSE',
      'HOSPITAL_18_DEZEMBRO_ARAPOTI',
      'HOSPITAL_MATERNIDADE_NOSSA_SENHORA_APARECIDA_FRG',
      'HOSPITAL_MUNICIPAL_JUAREZ_BARRETO_MACEDO',
      'HOSPITAL_MUNICIPAL_SANTA_ALICE',
      'TORAO_TOKUDA_APUCARANA'
    ];
    
    for (const key of hospitalKeys) {
      if (allHospitalRules[key]?.[doctorUpper]) {
        return key;
      }
    }
  }
  
  // Fallback: Torao Tokuda (compatibilidade)
  return 'TORAO_TOKUDA_APUCARANA';
}

// ================================================================
// FUNÇÃO: INICIALIZAR CACHE
// ================================================================

export function initializeRulesCache(
  allHospitalRules: Record<string, Record<string, DoctorPaymentRule>>
) {
  if (FIXED_RULES_CACHE && PERCENTAGE_RULES_CACHE && INDIVIDUAL_RULES_CACHE) {
    return; // Já inicializado
  }

  console.log('🚀 [OTIMIZAÇÃO] Inicializando cache de regras de pagamento...');
  const startTime = performance.now();

  FIXED_RULES_CACHE = new Map();
  PERCENTAGE_RULES_CACHE = new Map();
  INDIVIDUAL_RULES_CACHE = new Map();

  // Percorrer todos os hospitais e médicos
  Object.entries(allHospitalRules).forEach(([hospitalKey, hospitalRules]) => {
    Object.entries(hospitalRules).forEach(([doctorName, rule]) => {
      const cacheKey = `${doctorName}::${hospitalKey}`;
      
      // Indexar regras fixas
      if (rule.fixedPaymentRule) {
        FIXED_RULES_CACHE!.set(cacheKey, {
          amount: rule.fixedPaymentRule.amount,
          description: rule.fixedPaymentRule.description,
          hospitalId: hospitalKey
        });
        FIXED_RULES_CACHE!.set(doctorName, {
          amount: rule.fixedPaymentRule.amount,
          description: rule.fixedPaymentRule.description,
          hospitalId: hospitalKey
        });
      }

      // Indexar regras de percentual
      if (rule.percentageRule) {
        PERCENTAGE_RULES_CACHE!.set(cacheKey, {
          percentage: rule.percentageRule.percentage,
          description: rule.percentageRule.description,
          hospitalId: hospitalKey
        });
        PERCENTAGE_RULES_CACHE!.set(doctorName, {
          percentage: rule.percentageRule.percentage,
          description: rule.percentageRule.description,
          hospitalId: hospitalKey
        });
      }

      // Indexar regras individuais
      INDIVIDUAL_RULES_CACHE!.set(cacheKey, rule);
      INDIVIDUAL_RULES_CACHE!.set(doctorName, rule);
    });
  });

  const totalTime = performance.now() - startTime;
  console.log(`✅ [OTIMIZAÇÃO] Cache inicializado em ${totalTime.toFixed(2)}ms`);
  console.log(`   📊 ${FIXED_RULES_CACHE.size} regras fixas, ${PERCENTAGE_RULES_CACHE.size} regras de percentual, ${INDIVIDUAL_RULES_CACHE.size} regras individuais`);
}

// ================================================================
// FUNÇÃO: CALCULAR VALOR FIXO
// ================================================================

export function calculateFixedPayment(
  doctorName: string,
  hospitalId?: string,
  allHospitalRules?: Record<string, Record<string, DoctorPaymentRule>>
): FixedPaymentResult {
  // Inicializar cache se necessário
  if (allHospitalRules) {
    initializeRulesCache(allHospitalRules);
  }

  // Busca O(1) no cache
  const hospitalKey = detectHospitalFromContext(doctorName, hospitalId, allHospitalRules);
  const cacheKey = `${doctorName.toUpperCase()}::${hospitalKey}`;
  
  let rule = FIXED_RULES_CACHE?.get(cacheKey);
  
  // Fallback: buscar sem hospital APENAS se hospitalId NÃO foi fornecido
  if (!rule && !hospitalId) {
    rule = FIXED_RULES_CACHE?.get(doctorName.toUpperCase());
  }
  
  if (!rule) {
    return {
      calculatedPayment: 0,
      appliedRule: 'Nenhuma regra de valor fixo definida',
      hasFixedRule: false
    };
  }

  return {
    calculatedPayment: rule.amount,
    appliedRule: rule.description,
    hasFixedRule: true
  };
}

// ================================================================
// FUNÇÃO: CALCULAR PERCENTUAL
// ================================================================

export function calculatePercentagePayment(
  doctorName: string,
  totalValue: number,
  hospitalId?: string,
  allHospitalRules?: Record<string, Record<string, DoctorPaymentRule>>
): PercentagePaymentResult {
  // Inicializar cache se necessário
  if (allHospitalRules) {
    initializeRulesCache(allHospitalRules);
  }

  // Busca O(1) no cache
  const hospitalKey = detectHospitalFromContext(doctorName, hospitalId, allHospitalRules);
  const cacheKey = `${doctorName.toUpperCase()}::${hospitalKey}`;
  
  let rule = PERCENTAGE_RULES_CACHE?.get(cacheKey);
  
  // Fallback: buscar sem hospital APENAS se hospitalId NÃO foi fornecido
  if (!rule && !hospitalId) {
    rule = PERCENTAGE_RULES_CACHE?.get(doctorName.toUpperCase());
  }
  
  if (!rule) {
    return {
      calculatedPayment: 0,
      appliedRule: 'Nenhuma regra de percentual definida',
      hasPercentageRule: false
    };
  }

  const calculatedPayment = (totalValue * rule.percentage) / 100;
  
  return {
    calculatedPayment,
    appliedRule: `${rule.description} (${rule.percentage}% de R$ ${totalValue.toFixed(2)} = R$ ${calculatedPayment.toFixed(2)})`,
    hasPercentageRule: true
  };
}

// ================================================================
// FUNÇÕES AUXILIARES
// ================================================================

export function hasIndividualPaymentRules(
  doctorName: string, 
  hospitalId?: string,
  allHospitalRules?: Record<string, Record<string, DoctorPaymentRule>>
): boolean {
  const hospitalKey = detectHospitalFromContext(doctorName, hospitalId, allHospitalRules);
  const hospitalRules = allHospitalRules?.[hospitalKey];
  const rule = hospitalRules?.[doctorName.toUpperCase()];
  return !!(rule?.rules && rule.rules.length > 0);
}

export function isFixedMonthlyPayment(
  doctorName: string,
  hospitalId?: string,
  allHospitalRules?: Record<string, Record<string, DoctorPaymentRule>>
): boolean {
  const hospitalKey = detectHospitalFromContext(doctorName, hospitalId, allHospitalRules);
  const hospitalRules = allHospitalRules?.[hospitalKey];
  const rule = hospitalRules?.[doctorName.toUpperCase()];
  
  if (!rule?.fixedPaymentRule) {
    return false;
  }
  
  const fixedAmount = rule.fixedPaymentRule.amount;
  const description = rule.fixedPaymentRule.description.toLowerCase();
  
  const isMensalByDescription = description.includes('mensal');
  const isMensalByAmount = fixedAmount > 10000;
  
  return isMensalByDescription || isMensalByAmount;
}

export function getDoctorRuleProcedureCodes(
  doctorName: string, 
  hospitalId?: string,
  allHospitalRules?: Record<string, Record<string, DoctorPaymentRule>>
): string[] {
  const hospitalKey = detectHospitalFromContext(doctorName, hospitalId, allHospitalRules);
  const hospitalRules = allHospitalRules?.[hospitalKey];
  const rule = hospitalRules?.[doctorName.toUpperCase()];
  
  if (!rule) return [];
  
  const codes = new Set<string>();
  
  rule.rules?.forEach(r => codes.add(r.procedureCode));
  rule.multipleRule?.codes?.forEach(c => codes.add(c));
  rule.multipleRules?.forEach(mr => mr.codes.forEach(c => codes.add(c)));
  
  return Array.from(codes);
}

export function checkUnruledProcedures(
  doctorName: string,
  performedProcedureCodes: string[],
  hospitalId?: string,
  allHospitalRules?: Record<string, Record<string, DoctorPaymentRule>>
): UnruledProceduresResult {
  // Se médico tem pagamento fixo, não precisa verificar procedimentos órfãos
  const fixedCalc = calculateFixedPayment(doctorName, hospitalId, allHospitalRules);
  if (fixedCalc.hasFixedRule) {
    return {
      hasUnruledProcedures: false,
      unruledProcedures: [],
      totalUnruled: 0
    };
  }
  
  // Obter códigos com regras definidas
  const ruledCodes = new Set(getDoctorRuleProcedureCodes(doctorName, hospitalId, allHospitalRules));
  
  // Filtrar apenas procedimentos médicos (04.xxx) que NÃO têm regras
  const unruledProcedures = performedProcedureCodes
    .filter(code => {
      const cleanCode = code.match(/^([\d]{2}\.[\d]{2}\.[\d]{2}\.[\d]{3}-[\d])/)?.[1] || code;
      const isMedical = cleanCode.startsWith('04');
      const hasNoRule = !ruledCodes.has(cleanCode);
      return isMedical && hasNoRule;
    });
  
  return {
    hasUnruledProcedures: unruledProcedures.length > 0,
    unruledProcedures: Array.from(new Set(unruledProcedures)),
    totalUnruled: unruledProcedures.length
  };
}

// ================================================================
// FORMATAÇÃO
// ================================================================

export const formatCurrency = (value: number): string => {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL'
  }).format(value);
};


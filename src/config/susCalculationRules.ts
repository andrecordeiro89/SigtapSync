/**
 * REGRAS ESPECIAIS DE CÁLCULO SUS - CIRURGIAS MÚLTIPLAS E SEQUENCIAIS
 * 
 * Este arquivo contém as regras específicas para procedimentos que seguem
 * lógica de cobrança em múltiplos procedimentos no SUS.
 * 
 * 💰 FATURAMENTO AIH: APENAS SH + SP
 * - SH (Serviços Hospitalares): com percentuais variáveis por posição
 * - SP (Serviços Profissionais): sempre 100%
 * - SA (Serviços Ambulatoriais): INFORMATIVO (não faturado em AIH)
 * 
 * 🏥 REGRAS DE PAGAMENTO MÉDICO:
 * - Procedimentos "04" (código inicia com "04"): PAGAMENTO MÉDICO
 * - Outros procedimentos: RECEITA DO HOSPITAL
 * 
 * NOVA REGRA: Instrumento 04 - AIH (Proc. Especial) sempre 100% (SH + SP)
 */

// Interface para definir regras especiais de cálculo
export interface SpecialCalculationRule {
  procedureCode: string;
  procedureName: string;
  description: string;
  rule: {
    type: 'multiple_surgery' | 'sequential_general' | 'sequential_orthopedic';
    hospitalPercentages: number[]; // Percentuais para SH por posição
    professionalPercentage: number; // Sempre 100% para SP
    maxProcedures?: number;
  };
  notes: string;
  lastUpdated: string;
}

// Interface para procedimentos com informações do SIGTAP
export interface ProcedureWithSigtap {
  procedureCode: string;
  sequenceOrder: number;
  valueHosp: number;
  valueProf: number;
  valueAmb: number;
  registrationInstrument?: string; // Campo do SIGTAP para detectar procedimentos especiais
}

// PROCEDIMENTOS ESPECIAIS COM REGRAS DE MÚLTIPLOS PROCEDIMENTOS
export const SPECIAL_CALCULATION_RULES: SpecialCalculationRule[] = [
  {
    procedureCode: "04.15.01.001-2",
    procedureName: "Cirurgias Múltiplas",
    description: "Múltiplos procedimentos cirúrgicos realizados na mesma AIH com percentuais decrescentes para serviços hospitalares",
    rule: {
      type: 'multiple_surgery',
      hospitalPercentages: [100, 75, 75, 60, 50], // 1º=100%, 2º=75%, 3º=75%, 4º=60%, 5º=50%
      professionalPercentage: 100, // SP sempre 100%
      maxProcedures: 5
    },
    notes: "Serviços Hospitalares: 1º=100%, 2º=75%, 3º=75%, 4º=60%, 5º=50%. Serviços Profissionais: sempre 100%",
    lastUpdated: new Date().toISOString()
  },
  {
    procedureCode: "04.15.03.001-3",
    procedureName: "TRATAMENTO CIRURGICO EM POLITRAUMATIZADO",
    description: "Procedimento com percentuais específicos por posição (politratumatizado)",
    rule: {
      type: 'multiple_surgery',
      hospitalPercentages: [100, 100, 75, 75, 50], // 1º=100%, 2º=100%, 3º=75%, 4º=75%, 5º=50%
      professionalPercentage: 100, // SP sempre 100%
      maxProcedures: 5
    },
    notes: "SH: 1º=100%, 2º=100%, 3º=75%, 4º=75%, 5º=50%. SP: sempre 100%",
    lastUpdated: new Date().toISOString()
  },
  {
    procedureCode: "04.15.02.003-4",
    procedureName: "Outros Procedimentos com Cirurgias Sequenciais",
    description: "Procedimentos sequenciais gerais com percentuais específicos para serviços hospitalares",
    rule: {
      type: 'sequential_general',
      hospitalPercentages: [100, 75, 50], // 1º=100%, 2º=75%, 3º=50%
      professionalPercentage: 100, // SP sempre 100%
      maxProcedures: 3
    },
    notes: "Serviços Hospitalares: 1º=100%, 2º=75%, 3º=50%. Serviços Profissionais: sempre 100%",
    lastUpdated: new Date().toISOString()
  },
  {
    procedureCode: "04.15.02.006-9",
    procedureName: "Procedimentos Sequenciais em Ortopedia",
    description: "Procedimentos sequenciais específicos de ortopedia com regras diferenciadas",
    rule: {
      type: 'sequential_orthopedic',
      hospitalPercentages: [100, 75, 50, 50, 50], // 1º=100%, 2º=75%, 3º a 5º=50% cada
      professionalPercentage: 100, // SP sempre 100%
      maxProcedures: 5
    },
    notes: "Serviços Hospitalares: 1º=100%, 2º=75%, 3º a 5º=50% cada. Serviços Profissionais: sempre 100%",
    lastUpdated: new Date().toISOString()
  }
];

// ✅ NOVA FUNÇÃO: Verifica se é procedimento médico (código inicia com "04")
export function isMedicalProcedure(procedureCode: string): boolean {
  if (!procedureCode) return false;
  
  // Extrair apenas o código se vier com descrição
  const cleanCode = procedureCode.match(/^([\d]{2}\.[\d]{2}\.[\d]{2}\.[\d]{3}-[\d])/)?.[1] || procedureCode;
  
  // Verificar se o código inicia com "04"
  return cleanCode.startsWith('04');
}

// ✅ FUNÇÃO: Verifica se é procedimento do Instrumento 04 - AIH (Proc. Especial)
export function isInstrument04Procedure(registrationInstrument?: string): boolean {
  if (!registrationInstrument) return false;
  
  const instrument = registrationInstrument.toLowerCase().trim();
  
  // Padrões que indicam Instrumento 04 - AIH (Proc. Especial)
  const instrument04Patterns = [
    '04 - aih (proc. especial)',
    '04 - aih',
    'aih (proc. especial)',
    'aih proc especial',
    'aih procedimento especial',
    'instrumento 04',
    '04-aih',
    '04_aih'
  ];
  
  return instrument04Patterns.some(pattern => instrument.includes(pattern));
}

// ✅ NOVA FUNÇÃO: Classifica procedimentos por tipo (especial vs normal) e pagamento médico
export function classifyProcedures(procedures: ProcedureWithSigtap[]): {
  instrument04Procedures: ProcedureWithSigtap[];
  normalProcedures: ProcedureWithSigtap[];
  specialRuleProcedures: ProcedureWithSigtap[];
  medicalProcedures: ProcedureWithSigtap[];  // 🆕 Procedimentos médicos (código "04")
  hospitalProcedures: ProcedureWithSigtap[]; // 🆕 Procedimentos do hospital (outros códigos)
} {
  const instrument04Procedures: ProcedureWithSigtap[] = [];
  const normalProcedures: ProcedureWithSigtap[] = [];
  const specialRuleProcedures: ProcedureWithSigtap[] = [];
  const medicalProcedures: ProcedureWithSigtap[] = [];
  const hospitalProcedures: ProcedureWithSigtap[] = [];
  
  procedures.forEach(proc => {
    // 🎯 CLASSIFICAÇÃO POR PAGAMENTO: Médico vs Hospital
    if (isMedicalProcedure(proc.procedureCode)) {
      medicalProcedures.push(proc);
    } else {
      hospitalProcedures.push(proc);
    }
    
    // 🎯 PRIORIDADE 1: Instrumento 04 - AIH (Proc. Especial)
    if (isInstrument04Procedure(proc.registrationInstrument)) {
      instrument04Procedures.push(proc);
    }
    // 🎯 PRIORIDADE 2: Regras especiais de cirurgias múltiplas
    else if (hasSpecialRule(proc.procedureCode)) {
      specialRuleProcedures.push(proc);
    }
    // 🎯 PRIORIDADE 3: Procedimentos normais
    else {
      normalProcedures.push(proc);
    }
  });
  
  return { instrument04Procedures, normalProcedures, specialRuleProcedures, medicalProcedures, hospitalProcedures };
}

// Função para verificar se um procedimento tem regra especial
export function hasSpecialRule(procedureCodeOrFull: string): boolean {
  // Extrair apenas o código se vier com descrição
  const procedureCode = procedureCodeOrFull.match(/^([\d]{2}\.[\d]{2}\.[\d]{2}\.[\d]{3}-[\d])/)?.[1] || procedureCodeOrFull;
  return SPECIAL_CALCULATION_RULES.some(rule => rule.procedureCode === procedureCode);
}

// Função para obter regra especial de um procedimento
export function getSpecialRule(procedureCodeOrFull: string): SpecialCalculationRule | null {
  // Extrair apenas o código se vier com descrição
  const procedureCode = procedureCodeOrFull.match(/^([\d]{2}\.[\d]{2}\.[\d]{2}\.[\d]{3}-[\d])/)?.[1] || procedureCodeOrFull;
  return SPECIAL_CALCULATION_RULES.find(rule => rule.procedureCode === procedureCode) || null;
}

// ✅ FUNÇÃO ATUALIZADA: Aplicar cálculo especial considerando Instrumento 04
export function applySpecialCalculation(
  procedures: Array<{
    procedureCode: string;
    valueHosp: number;      // Valor SH (Serviço Hospitalar)
    valueProf: number;      // Valor SP (Serviço Profissional)
    valueAmb: number;       // Valor SA (Ambulatorial)
    sequenceOrder: number;  // Posição na sequência (1, 2, 3...)
    registrationInstrument?: string; // Instrumento do SIGTAP
  }>
): Array<{
  procedureCode: string;
  calculatedValueHosp: number;    // SH calculado com percentual
  calculatedValueProf: number;    // SP sempre 100%
  calculatedValueAmb: number;     // SA sempre 100%
  calculatedTotal: number;        // Total final
  appliedHospPercentage: number;  // Percentual aplicado ao SH
  appliedProfPercentage: number;  // Sempre 100% para SP
  ruleApplied: string;
  specialRule: boolean;
  isInstrument04?: boolean;       // Se é procedimento do Instrumento 04
}> {
  
  return procedures.map((proc) => {
    // 🎯 VERIFICAR INSTRUMENTO 04 - SEMPRE 100%
    if (isInstrument04Procedure(proc.registrationInstrument)) {
      const calculatedValueHosp = proc.valueHosp; // 100%
      const calculatedValueProf = proc.valueProf; // 100%
      const calculatedValueAmb = proc.valueAmb;   // 100%
      // ⚠️ AIH fatura apenas SH + SP. SA é informativo e não compõe o total.
      const calculatedTotal = calculatedValueHosp + calculatedValueProf;
      
      return {
        procedureCode: proc.procedureCode,
        calculatedValueHosp,
        calculatedValueProf,
        calculatedValueAmb,
        calculatedTotal,
        appliedHospPercentage: 100,
        appliedProfPercentage: 100,
        ruleApplied: 'Instrumento 04 - AIH (Proc. Especial) - Sempre 100%',
        specialRule: true,
        isInstrument04: true
      };
    }
    
    // 🎯 VERIFICAR REGRAS ESPECIAIS DE CIRURGIAS MÚLTIPLAS
    const specialRule = getSpecialRule(proc.procedureCode);
    if (specialRule && proc.sequenceOrder <= specialRule.rule.maxProcedures!) {
      // APLICAR REGRA ESPECIAL
      const hospPercentageIndex = proc.sequenceOrder - 1; // Array é 0-based
      const hospPercentage = specialRule.rule.hospitalPercentages[hospPercentageIndex] || 
                            specialRule.rule.hospitalPercentages[specialRule.rule.hospitalPercentages.length - 1]; // Usar último se exceder
      
      const calculatedValueHosp = (proc.valueHosp * hospPercentage) / 100;
      const calculatedValueProf = proc.valueProf; // SP sempre 100%
      const calculatedValueAmb = proc.valueAmb;   // SA sempre 100%
      // ⚠️ AIH fatura apenas SH + SP. SA é informativo e não compõe o total.
      const calculatedTotal = calculatedValueHosp + calculatedValueProf;
      
      return {
        procedureCode: proc.procedureCode,
        calculatedValueHosp,
        calculatedValueProf,
        calculatedValueAmb,
        calculatedTotal,
        appliedHospPercentage: hospPercentage,
        appliedProfPercentage: 100,
        ruleApplied: `${specialRule.rule.type} - ${specialRule.procedureName}`,
        specialRule: true,
        isInstrument04: false
      };
    }
    
  // APLICAR LÓGICA PADRÃO DO SISTEMA (100% principal; secundários com 70% por padrão)
  // TODO: Ajustar se houver orientação SUS diferente (ex.: 100/50/30) para casos sem regra específica
  const defaultHospPercentage = proc.sequenceOrder === 1 ? 100 : 70;
    const calculatedValueHosp = (proc.valueHosp * defaultHospPercentage) / 100;
    const calculatedValueProf = proc.valueProf; // SP sempre 100%
    const calculatedValueAmb = proc.valueAmb;   // SA sempre 100%
    // ⚠️ AIH fatura apenas SH + SP. SA é informativo e não compõe o total.
    const calculatedTotal = calculatedValueHosp + calculatedValueProf;
    
    return {
      procedureCode: proc.procedureCode,
      calculatedValueHosp,
      calculatedValueProf,
      calculatedValueAmb,
      calculatedTotal,
      appliedHospPercentage: defaultHospPercentage,
      appliedProfPercentage: 100,
      ruleApplied: 'Regra padrão do sistema',
      specialRule: false,
      isInstrument04: false
    };
  });
}

// ✅ NOVA FUNÇÃO: Calcula valores de pagamento médico vs hospital
export function calculateMedicalPayment(procedures: Array<{
  procedureCode: string;
  valueHosp: number;
  valueProf: number;
  valueAmb: number;
  calculatedTotal?: number;
}>): {
  medicalPayment: number;    // Valor total para médicos (procedimentos "04")
  hospitalRevenue: number;   // Valor total para hospital (outros procedimentos)
  totalValue: number;        // Valor total da AIH
  medicalProcedures: string[];  // Lista de códigos médicos
  hospitalProcedures: string[]; // Lista de códigos do hospital
  breakdown: {
    medical: Array<{ code: string; value: number; }>;
    hospital: Array<{ code: string; value: number; }>;
  };
} {
  let medicalPayment = 0;
  let hospitalRevenue = 0;
  const medicalProcedures: string[] = [];
  const hospitalProcedures: string[] = [];
  const medicalBreakdown: Array<{ code: string; value: number; }> = [];
  const hospitalBreakdown: Array<{ code: string; value: number; }> = [];
  
  procedures.forEach(proc => {
    const procedureValue = proc.calculatedTotal || (proc.valueHosp + proc.valueProf);
    
    if (isMedicalProcedure(proc.procedureCode)) {
      // Procedimento médico (código "04") - vai para o médico
      medicalPayment += procedureValue;
      medicalProcedures.push(proc.procedureCode);
      medicalBreakdown.push({ code: proc.procedureCode, value: procedureValue });
    } else {
      // Outros procedimentos - ficam para o hospital
      hospitalRevenue += procedureValue;
      hospitalProcedures.push(proc.procedureCode);
      hospitalBreakdown.push({ code: proc.procedureCode, value: procedureValue });
    }
  });
  
  return {
    medicalPayment,
    hospitalRevenue,
    totalValue: medicalPayment + hospitalRevenue,
    medicalProcedures,
    hospitalProcedures,
    breakdown: {
      medical: medicalBreakdown,
      hospital: hospitalBreakdown
    }
  };
}

// ✅ FUNÇÃO ATUALIZADA: Verifica se uma lista contém procedimentos especiais (incluindo Instrumento 04)
export function hasSpecialProceduresInList(procedures: Array<{ 
  procedureCode: string; 
  registrationInstrument?: string 
}>): {
  hasSpecial: boolean;
  specialCodes: string[];
  rules: SpecialCalculationRule[];
  hasInstrument04: boolean;
  instrument04Codes: string[];
  hasMedicalProcedures: boolean;  // 🆕 Se tem procedimentos médicos
  medicalCodes: string[];         // 🆕 Lista de códigos médicos
} {
  const specialCodes: string[] = [];
  const rules: SpecialCalculationRule[] = [];
  const instrument04Codes: string[] = [];
  const medicalCodes: string[] = [];
  
  procedures.forEach(proc => {
    // Verificar procedimentos médicos
    if (isMedicalProcedure(proc.procedureCode)) {
      medicalCodes.push(proc.procedureCode);
    }
    
    // Verificar Instrumento 04
    if (isInstrument04Procedure(proc.registrationInstrument)) {
      instrument04Codes.push(proc.procedureCode);
    }
    
    // Verificar regras especiais de cirurgias múltiplas
    if (hasSpecialRule(proc.procedureCode)) {
      specialCodes.push(proc.procedureCode);
      const rule = getSpecialRule(proc.procedureCode);
      if (rule) rules.push(rule);
    }
  });
  
  return {
    hasSpecial: specialCodes.length > 0 || instrument04Codes.length > 0,
    specialCodes,
    rules,
    hasInstrument04: instrument04Codes.length > 0,
    instrument04Codes,
    hasMedicalProcedures: medicalCodes.length > 0,
    medicalCodes
  };
}

// ✅ FUNÇÃO ATUALIZADA: Log das regras incluindo Instrumento 04
export function logSpecialRules(): void {
  console.log('📋 REGRAS ESPECIAIS DE CÁLCULO SUS:');
  
  console.log('\n🏥 INSTRUMENTO 04 - AIH (PROC. ESPECIAL):');
  console.log('   Tipo: Sempre 100% (SH, SP e SA)');
  console.log('   Detectado por: Campo "registrationInstrument" do SIGTAP');
  console.log('   Prioridade: MÁXIMA (aplicada antes de qualquer outra regra)');
  
  console.log('\n🏥 CIRURGIAS MÚLTIPLAS E SEQUENCIAIS:');
  SPECIAL_CALCULATION_RULES.forEach(rule => {
    console.log(`\n🏥 ${rule.procedureCode}: ${rule.procedureName}`);
    console.log(`   Tipo: ${rule.rule.type}`);
    console.log(`   SH: ${rule.rule.hospitalPercentages.join('%, ')}%`);
    console.log(`   SP: ${rule.rule.professionalPercentage}% (sempre)`);
    console.log(`   Max: ${rule.rule.maxProcedures} procedimentos`);
  });
}

// Função de debug para verificar detecção
export function debugSpecialRuleDetection(procedureCodeOrFull: string): void {
  console.log('🔍 DEBUG - Detecção de Regra Especial:');
  console.log(`   Input: "${procedureCodeOrFull}"`);
  
  const extractedCode = procedureCodeOrFull.match(/^([\d]{2}\.[\d]{2}\.[\d]{2}\.[\d]{3}-[\d])/)?.[1] || procedureCodeOrFull;
  console.log(`   Código Extraído: "${extractedCode}"`);
  
  const hasRule = hasSpecialRule(procedureCodeOrFull);
  console.log(`   Tem Regra Especial: ${hasRule}`);
  
  const rule = getSpecialRule(procedureCodeOrFull);
  if (rule) {
    console.log(`   Regra Encontrada: ${rule.procedureName}`);
    console.log(`   Tipo: ${rule.rule.type}`);
  } else {
    console.log(`   ❌ Nenhuma regra encontrada`);
  }
}

// ✅ NOVA FUNÇÃO: Debug específico para Instrumento 04
export function debugInstrument04Detection(registrationInstrument?: string): void {
  console.log('🔍 DEBUG - Detecção Instrumento 04:');
  console.log(`   Input: "${registrationInstrument || 'undefined'}"`);
  
  const isInstrument04 = isInstrument04Procedure(registrationInstrument);
  console.log(`   É Instrumento 04: ${isInstrument04}`);
  
  if (isInstrument04) {
    console.log(`   ✅ Detectado como AIH (Proc. Especial) - Cobrança 100%`);
  } else {
    console.log(`   ❌ Não é Instrumento 04 - Aplicar regras normais`);
  }
}

// Função para validar aplicação das regras
export function validateSpecialRulesApplication(
  procedures: Array<{ procedureCode: string; sequenceOrder: number }>
): {
  isValid: boolean;
  warnings: string[];
  recommendations: string[];
} {
  const warnings: string[] = [];
  const recommendations: string[] = [];
  
  procedures.forEach(proc => {
    const rule = getSpecialRule(proc.procedureCode);
    if (rule) {
      if (proc.sequenceOrder > rule.rule.maxProcedures!) {
        warnings.push(`Procedimento ${proc.procedureCode} na posição ${proc.sequenceOrder} excede máximo de ${rule.rule.maxProcedures}`);
        recommendations.push(`Verificar se todos os procedimentos ${proc.procedureCode} estão sendo registrados corretamente`);
      }
    }
  });
  
  return {
    isValid: warnings.length === 0,
    warnings,
    recommendations
  };
}
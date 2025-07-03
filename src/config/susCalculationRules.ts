/**
 * REGRAS ESPECIAIS DE CÁLCULO SUS - CIRURGIAS MÚLTIPLAS E SEQUENCIAIS
 * 
 * Este arquivo contém as regras específicas para procedimentos que seguem
 * lógica de cobrança em múltiplos procedimentos no SUS.
 * 
 * REGRA UNIVERSAL: Serviços Profissionais (SP) sempre 100%
 * VARIAÇÃO: Serviços Hospitalares (SH) com percentuais decrescentes
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

// Função para aplicar cálculo especial com separação SH/SP
export function applySpecialCalculation(
  procedures: Array<{
    procedureCode: string;
    valueHosp: number;      // Valor SH (Serviço Hospitalar)
    valueProf: number;      // Valor SP (Serviço Profissional)
    valueAmb: number;       // Valor SA (Ambulatorial)
    sequenceOrder: number;  // Posição na sequência (1, 2, 3...)
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
}> {
  
  return procedures.map((proc) => {
    const specialRule = getSpecialRule(proc.procedureCode);
    
    if (specialRule && proc.sequenceOrder <= specialRule.rule.maxProcedures!) {
      // APLICAR REGRA ESPECIAL
      const hospPercentageIndex = proc.sequenceOrder - 1; // Array é 0-based
      const hospPercentage = specialRule.rule.hospitalPercentages[hospPercentageIndex] || 
                            specialRule.rule.hospitalPercentages[specialRule.rule.hospitalPercentages.length - 1]; // Usar último se exceder
      
      const calculatedValueHosp = (proc.valueHosp * hospPercentage) / 100;
      const calculatedValueProf = proc.valueProf; // SP sempre 100%
      const calculatedValueAmb = proc.valueAmb;   // SA sempre 100%
      const calculatedTotal = calculatedValueHosp + calculatedValueProf + calculatedValueAmb;
      
      return {
        procedureCode: proc.procedureCode,
        calculatedValueHosp,
        calculatedValueProf,
        calculatedValueAmb,
        calculatedTotal,
        appliedHospPercentage: hospPercentage,
        appliedProfPercentage: 100,
        ruleApplied: `${specialRule.rule.type} - ${specialRule.procedureName}`,
        specialRule: true
      };
    }
    
    // APLICAR LÓGICA PADRÃO DO SISTEMA (100% para principal, 70% para secundários)
    const defaultHospPercentage = proc.sequenceOrder === 1 ? 100 : 70;
    const calculatedValueHosp = (proc.valueHosp * defaultHospPercentage) / 100;
    const calculatedValueProf = proc.valueProf; // SP sempre 100%
    const calculatedValueAmb = proc.valueAmb;   // SA sempre 100%
    const calculatedTotal = calculatedValueHosp + calculatedValueProf + calculatedValueAmb;
    
    return {
      procedureCode: proc.procedureCode,
      calculatedValueHosp,
      calculatedValueProf,
      calculatedValueAmb,
      calculatedTotal,
      appliedHospPercentage: defaultHospPercentage,
      appliedProfPercentage: 100,
      ruleApplied: 'Regra padrão do sistema',
      specialRule: false
    };
  });
}

// Função para verificar se uma lista de procedimentos contém códigos especiais
export function hasSpecialProceduresInList(procedures: Array<{ procedureCode: string }>): {
  hasSpecial: boolean;
  specialCodes: string[];
  rules: SpecialCalculationRule[];
} {
  const specialCodes: string[] = [];
  const rules: SpecialCalculationRule[] = [];
  
  procedures.forEach(proc => {
    if (hasSpecialRule(proc.procedureCode)) {
      specialCodes.push(proc.procedureCode);
      const rule = getSpecialRule(proc.procedureCode);
      if (rule) rules.push(rule);
    }
  });
  
  return {
    hasSpecial: specialCodes.length > 0,
    specialCodes,
    rules
  };
}

// Log das regras para debug
export function logSpecialRules(): void {
  console.log('📋 REGRAS ESPECIAIS DE CÁLCULO SUS - CIRURGIAS MÚLTIPLAS:');
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
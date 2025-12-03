/**
 * ================================================================
 * FUNÇÃO PRINCIPAL - CÁLCULO DE PAGAMENTO MÉDICO
 * ================================================================
 * Consolida toda a lógica de cálculo de pagamentos
 * Importa regras modulares de cada hospital
 * ================================================================
 */

import type {
  DoctorPaymentRule,
  ProcedurePaymentInfo,
  CalculatedPaymentResult,
  HospitalRules
} from './types';

import { 
  detectHospitalFromContext,
  initializeRulesCache,
  formatCurrency
} from './utils';
import { getHonValuesForCode, calculateHonByPosition } from './importers/honCsv'

import { TORAO_TOKUDA_RULES } from './hospitals/toraoTokuda';
import { HOSPITAL_18_DEZEMBRO_RULES } from './hospitals/hospital18Dezembro';
import { HOSPITAL_SAO_JOSE_RULES } from './hospitals/hospitalSaoJose';
import { HOSPITAL_JUAREZ_BARRETO_RULES } from './hospitals/hospitalJuarezBarreto';
import { HOSPITAL_NOSSA_SENHORA_APARECIDA_RULES } from './hospitals/hospitalNossaSenhoraAparecida';
import { HOSPITAL_SANTA_ALICE_RULES } from './hospitals/hospitalSantaAlice';
import { HOSPITAL_MATERNIDADE_FRG_RULES } from './hospitals/hospitalMaternidadeFrg';

// ================================================================
// CONSOLIDAR REGRAS DE TODOS OS HOSPITAIS
// ================================================================

export const ALL_HOSPITAL_RULES: Record<string, HospitalRules> = {
  'TORAO_TOKUDA_APUCARANA': TORAO_TOKUDA_RULES,
  'HOSPITAL_18_DEZEMBRO_ARAPOTI': HOSPITAL_18_DEZEMBRO_RULES,
  'HOSPITAL_MUNICIPAL_SAO_JOSE': HOSPITAL_SAO_JOSE_RULES,
  'HOSPITAL_MUNICIPAL_JUAREZ_BARRETO_MACEDO': HOSPITAL_JUAREZ_BARRETO_RULES,
  'HOSPITAL_NOSSA_SENHORA_APARECIDA_FOZ': HOSPITAL_NOSSA_SENHORA_APARECIDA_RULES,
  'HOSPITAL_MUNICIPAL_SANTA_ALICE': HOSPITAL_SANTA_ALICE_RULES,
  'HOSPITAL_MATERNIDADE_NOSSA_SENHORA_APARECIDA_FRG': HOSPITAL_MATERNIDADE_FRG_RULES
  // Outros hospitais serão adicionados aqui conforme refatorados
  // etc...
};

// Inicializar cache automaticamente
initializeRulesCache(ALL_HOSPITAL_RULES);

// 🔍 DEBUG: Verificar estrutura do Hospital Maternidade
if (typeof window !== 'undefined') {
  const maternidadeRules = ALL_HOSPITAL_RULES['HOSPITAL_MATERNIDADE_NOSSA_SENHORA_APARECIDA_FRG'];
  console.log('🏥 [DEBUG] Hospital Maternidade - Médicos cadastrados:', Object.keys(maternidadeRules || {}));
  console.log('🏥 [DEBUG] INGRID BARRETO PINHEIRO - Regras:', maternidadeRules?.['INGRID BARRETO PINHEIRO']?.rules?.length || 0);
  console.log('🏥 [DEBUG] Primeira regra INGRID:', maternidadeRules?.['INGRID BARRETO PINHEIRO']?.rules?.[0]);
}

// ================================================================
// FUNÇÃO PRINCIPAL: CALCULAR PAGAMENTO MÉDICO
// ================================================================

export function calculateDoctorPayment(
  doctorName: string,
  procedures: ProcedurePaymentInfo[],
  hospitalId?: string
): CalculatedPaymentResult {
  
  console.log(`\n🔍 [CÁLCULO] Iniciando cálculo para ${doctorName}`);
  console.log(`   📋 Total de procedimentos: ${procedures.length}`);
  console.log(`   🏥 Hospital ID: ${hospitalId || 'não fornecido'}`);

  // Detectar contexto do hospital
  const hospitalKey = detectHospitalFromContext(doctorName, hospitalId, ALL_HOSPITAL_RULES);
  const hospitalRules = ALL_HOSPITAL_RULES[hospitalKey];
  const doctorNameUpper = doctorName.toUpperCase();
  const rule = hospitalRules?.[doctorNameUpper];

  console.log(`   🔑 Hospital detectado: ${hospitalKey}`);
  console.log(`   👤 Nome do médico (original): "${doctorName}"`);
  console.log(`   👤 Nome do médico (uppercase): "${doctorNameUpper}"`);
  console.log(`   📋 Médicos disponíveis neste hospital:`, Object.keys(hospitalRules || {}));
  console.log(`   ✅ Regras encontradas: ${rule ? 'SIM' : 'NÃO'}`);

  if (hospitalKey === 'TORAO_TOKUDA_APUCARANA' && doctorNameUpper === 'JOAO VICTOR RODRIGUES') {
    let totalPayment = 0
    let pos = 0
    const paidCodes = new Set<string>()
    const processed = procedures.map((p) => {
      const hon = getHonValuesForCode(p.procedure_code)
      const isExcluded = p.cbo === '000000' || p.cbo === '225151'
      const codeNorm = p.procedure_code.match(/^([\d]{2}\.[\d]{2}\.[\d]{2}\.[\d]{3}-[\d])/)?.[1] || p.procedure_code
      const isDuplicate = paidCodes.has(codeNorm)
      const idx = (isExcluded || isDuplicate) ? -1 : pos
      if (!(isExcluded || isDuplicate)) pos++
      const base = hon ? calculateHonByPosition(idx, hon) : 0
      const pay = (isExcluded || isDuplicate) ? 0 : base
      if (!isExcluded && !isDuplicate && hon) paidCodes.add(codeNorm)
      totalPayment += pay
      return {
        ...p,
        calculatedPayment: pay,
        paymentRule: isDuplicate ? 'Duplicado (não pago)' : (hon ? `CSV HON (pos ${idx+1})` : 'Sem regra HON para código'),
        isSpecialRule: true
      }
    })
    return {
      procedures: processed,
      totalPayment,
      appliedRule: 'CSV HON1..HON5 (Cirurgia Geral)'
    }
  }

  if (!rule) {
    console.log(`   ⚠️ Nenhuma regra definida para ${doctorName}`);
    return {
      procedures: procedures.map(p => ({
        ...p,
        calculatedPayment: 0,
        paymentRule: 'Sem regra definida',
        isSpecialRule: false
      })),
      totalPayment: 0,
      appliedRule: 'Nenhuma regra de pagamento definida para este médico'
    };
  }

  // Filtrar procedimentos que têm regras definidas
  const procedureCodes = procedures.map(p => p.procedure_code);
  const ruledProcedures = procedures.filter(p => {
    const code = p.procedure_code.match(/^([\d]{2}\.[\d]{2}\.[\d]{2}\.[\d]{3}-[\d])/)?.[1] || p.procedure_code;
    return rule.rules?.some(r => r.procedureCode === code);
  });

  console.log(`   📊 Procedimentos com regras: ${ruledProcedures.length}/${procedures.length}`);

  // ================================================================
  // REGRA 1: FIXED PAYMENT (Valor fixo independente de procedimentos)
  // ================================================================
  if (rule.fixedPaymentRule && ruledProcedures.length === 0) {
    const fixedAmount = rule.fixedPaymentRule.amount;
    console.log(`   💰 Aplicando REGRA FIXA: ${formatCurrency(fixedAmount)}`);
    
    return {
      procedures: procedures.map(p => ({
        ...p,
        calculatedPayment: fixedAmount,
        paymentRule: rule.fixedPaymentRule!.description,
        isSpecialRule: true
      })),
      totalPayment: fixedAmount,
      appliedRule: rule.fixedPaymentRule.description
    };
  }

  // ================================================================
  // REGRA 2: ONLY MAIN PROCEDURE (Apenas procedimento de maior valor)
  // ================================================================
  if (rule.onlyMainProcedureRule?.enabled && ruledProcedures.length > 1) {
    const eligible = ruledProcedures.filter(p => p.cbo !== '000000')
    if (eligible.length === 0) {
      return {
        procedures: procedures.map(p => ({
          ...p,
          calculatedPayment: 0,
          paymentRule: 'Procedimento principal hospitalar (sem repasse)',
          isSpecialRule: true
        })),
        totalPayment: 0,
        appliedRule: rule.onlyMainProcedureRule.description
      }
    }
    const mainProcedure = eligible.reduce((max, p) => 
      p.value_reais > max.value_reais ? p : max
    , eligible[0]);
    
    const mainRule = rule.rules?.find(r => {
      const code = mainProcedure.procedure_code.match(/^([\d]{2}\.[\d]{2}\.[\d]{2}\.[\d]{3}-[\d])/)?.[1] || mainProcedure.procedure_code;
      return r.procedureCode === code;
    });

    const payment = mainRule?.standardValue || 0;
    
    console.log(`   🎯 Aplicando REGRA APENAS PRINCIPAL: ${mainProcedure.procedure_code} = ${formatCurrency(payment)}`);
    
    return {
      procedures: procedures.map(p => ({
        ...p,
        calculatedPayment: (p === mainProcedure) ? payment : 0,
        paymentRule: p === mainProcedure 
          ? `Procedimento principal (${rule.onlyMainProcedureRule?.description})`
          : 'Procedimento secundário (não pago)',
        isSpecialRule: true
      })),
      totalPayment: payment,
      appliedRule: rule.onlyMainProcedureRule.description
    };
  }

  // ================================================================
  // REGRA 3: MULTIPLE RULES (Combinações específicas de procedimentos)
  // ================================================================
  if (rule.multipleRules && ruledProcedures.length > 1) {
    const procedureCodes = ruledProcedures
      .map(p => p.procedure_code.match(/^([\d]{2}\.[\d]{2}\.[\d]{2}\.[\d]{3}-[\d])/)?.[1] || p.procedure_code)
      .sort();

    // Ordenar regras por número de códigos (do maior para o menor)
    const sortedMultipleRules = [...rule.multipleRules].sort((a, b) => b.codes.length - a.codes.length);

    for (const multiRule of sortedMultipleRules) {
      const multiCodes = [...multiRule.codes].sort();
      
      // Verificar se é match exato
      if (JSON.stringify(procedureCodes) === JSON.stringify(multiCodes)) {
        console.log(`   🔗 Aplicando REGRA MÚLTIPLA: ${formatCurrency(multiRule.totalValue)}`);
        console.log(`      Procedimentos: ${multiCodes.join(', ')}`);
        
        const firstEligibleIdx = procedures.findIndex(pp => pp.cbo !== '000000')
        return {
          procedures: procedures.map((p, idx) => ({
            ...p,
            calculatedPayment: idx === firstEligibleIdx ? multiRule.totalValue : 0,
            paymentRule: idx === firstEligibleIdx ? multiRule.description : `Incluído na regra múltipla`,
            isSpecialRule: true
          })),
          totalPayment: firstEligibleIdx >= 0 ? multiRule.totalValue : 0,
          appliedRule: multiRule.description
        };
      }
    }
  }

  // Compatibilidade com multipleRule (singular) legado
  if (rule.multipleRule && ruledProcedures.length > 1) {
    const procedureCodes = ruledProcedures
      .map(p => p.procedure_code.match(/^([\d]{2}\.[\d]{2}\.[\d]{2}\.[\d]{3}-[\d])/)?.[1] || p.procedure_code)
      .sort();
    const multiCodes = [...rule.multipleRule.codes].sort();
    
    if (JSON.stringify(procedureCodes) === JSON.stringify(multiCodes)) {
      console.log(`   🔗 Aplicando REGRA MÚLTIPLA (legado): ${formatCurrency(rule.multipleRule.totalValue)}`);
      
      const firstEligibleIdx2 = procedures.findIndex(pp => pp.cbo !== '000000')
      return {
        procedures: procedures.map((p, idx) => ({
          ...p,
          calculatedPayment: idx === firstEligibleIdx2 ? rule.multipleRule!.totalValue : 0,
          paymentRule: idx === firstEligibleIdx2 ? rule.multipleRule!.description : `Incluído na regra múltipla`,
          isSpecialRule: true
        })),
        totalPayment: firstEligibleIdx2 >= 0 ? rule.multipleRule.totalValue : 0,
        appliedRule: rule.multipleRule.description
      };
  }
  }

  // ================================================================
  // REGRA 4: INDIVIDUAL RULES (Procedimentos individuais)
  // ================================================================
  let totalPayment = 0;
  let pos = 0;
  const processedProcedures = procedures.map((proc) => {
    const code = proc.procedure_code.match(/^([\d]{2}\.[\d]{2}\.[\d]{2}\.[\d]{3}-[\d])/)?.[1] || proc.procedure_code;
    const individualRule = rule.rules?.find(r => r.procedureCode === code);

    if (!individualRule) {
      return {
        ...proc,
        calculatedPayment: 0,
        paymentRule: 'Sem regra definida',
        isSpecialRule: false
      };
    }

    // Determinar valor baseado na posição (principal, secundário, terciário)
    let payment = 0;
    let description = '';
    const isHospital = proc.cbo === '000000';
    const index = isHospital ? -1 : pos;
    if (!isHospital) pos++;

    if (index === 0) {
      payment = individualRule.standardValue;
      description = `Procedimento principal: ${formatCurrency(payment)}`;
    } else if (index === 1 && individualRule.secondaryValue !== undefined) {
      payment = individualRule.secondaryValue;
      description = `Procedimento secundário (2º): ${formatCurrency(payment)}`;
    } else if (index === 2 && individualRule.tertiaryValue !== undefined) {
      payment = individualRule.tertiaryValue;
      description = `Procedimento terciário (3º): ${formatCurrency(payment)}`;
    } else if (index === 3 && individualRule.quaternaryValue !== undefined) {
      payment = individualRule.quaternaryValue;
      description = `Procedimento quaternário (4º): ${formatCurrency(payment)}`;
    } else if (index >= 4 && individualRule.quaternaryValue !== undefined) {
      payment = individualRule.quaternaryValue;
      description = `Procedimento sequencial (4º+): ${formatCurrency(payment)}`;
    } else if (index >= 3 && individualRule.tertiaryValue !== undefined) {
      payment = individualRule.tertiaryValue;
      description = `Procedimento sequencial (3º+): ${formatCurrency(payment)}`;
    } else if (index >= 2 && individualRule.secondaryValue !== undefined) {
      payment = individualRule.secondaryValue;
      description = `Procedimento sequencial (2º+): ${formatCurrency(payment)}`;
    } else {
      payment = individualRule.standardValue;
      description = `Valor padrão: ${formatCurrency(payment)}`;
    }

    if (isHospital) {
      payment = 0;
    }
    totalPayment += payment;

    return {
      ...proc,
      calculatedPayment: payment,
      paymentRule: description,
      isSpecialRule: false
    };
  });

  console.log(`   💵 Total calculado (regras individuais): ${formatCurrency(totalPayment)}`);

  return {
    procedures: processedProcedures,
    totalPayment,
    appliedRule: 'Regras individuais por procedimento'
  };
}


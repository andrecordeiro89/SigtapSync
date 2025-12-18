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
import { getHonValuesForCode, calculateHonByPosition, calculateHonPayments } from './importers/honCsv'
import { calculateGynHonPaymentsSync, loadGynHonMap } from './importers/gynXlsx'
import { calculateUroHonPaymentsSync, loadUroHonMap, getUroHonMapSync } from './importers/uroXlsx'
import { calculateOtoHonPaymentsSync, loadOtoHonMap } from './importers/otoXlsx'
import { calculateOtoSaoJoseHonPaymentsSync, loadOtoSaoJoseHonMap } from './importers/otoSaoJoseXlsx'
import { calculateVasHonPaymentsSync, loadVasHonMap } from './importers/vasXlsx'

// VBA-first: não usamos regras TS de hospitais; apenas mapas das planilhas

// ================================================================
// CONSOLIDAR REGRAS DE TODOS OS HOSPITAIS
// ================================================================

export const ALL_HOSPITAL_RULES: Record<string, HospitalRules> = {};

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
  const doctorNameUpper = doctorName.toUpperCase();

  console.log(`   🔑 Hospital detectado: ${hospitalKey}`);
  console.log(`   👤 Nome do médico (original): "${doctorName}"`);
  console.log(`   👤 Nome do médico (uppercase): "${doctorNameUpper}"`);
  console.log(`   📋 Regime: VBA-first (sem regras TS)`);

  // Sem casos especiais por hospital/médico

  // Particionar procedimentos por especialidade, aplicar apenas regras das planilhas

  const isSaoJose = hospitalKey === 'HOSPITAL_MUNICIPAL_SAO_JOSE'

  const hasUroCodes = procedures.some(p => {
    const code = p.procedure_code.match(/^([\d]{2}\.[\d]{2}\.[\d]{2}\.[\d]{3}-[\d])/)?.[1] || p.procedure_code
    return /^04\.09\./.test(code)
  });
  if (hasUroCodes && !isSaoJose) {
    const resUro = calculateUroHonPaymentsSync(procedures);
    if (resUro) return resUro;
    void loadUroHonMap();
  }

  const hasOtoCodes = procedures.some(p => {
    const code = p.procedure_code.match(/^([\d]{2}\.[\d]{2}\.[\d]{2}\.[\d]{3}-[\d])/)?.[1] || p.procedure_code;
    return /^04\.04\./.test(code);
  });
  if (hasOtoCodes && isSaoJose) {
    const resOtoSj = calculateOtoSaoJoseHonPaymentsSync(procedures);
    if (resOtoSj) return resOtoSj;
    void loadOtoSaoJoseHonMap();
  }
  if (hasOtoCodes && !isSaoJose) {
    const resOto = calculateOtoHonPaymentsSync(procedures);
    if (resOto) return resOto;
    void loadOtoHonMap();
  }

  const hasVasCodes = procedures.some(p => {
    const code = p.procedure_code.match(/^([\d]{2}\.[\d]{2}\.[\d]{2}\.[\d]{3}-[\d])/)?.[1] || p.procedure_code;
    return /^04\.06\./.test(code);
  });
  if (hasVasCodes) {
    const resVas = calculateVasHonPaymentsSync(procedures);
    if (resVas) return resVas;
    void loadVasHonMap();
  }

  // ✅ Regra parametrizada por XLSX Ginecologia (apenas para médicos com regras por procedimento)
  // Detecta perfil ginecologia por códigos 04.09.xx e aplica HON1..HON5 do arquivo XLSX
  const hasGynCodes = procedures.some(p => {
    const code = p.procedure_code.match(/^([\d]{2}\.[\d]{2}\.[\d]{2}\.[\d]{3}-[\d])/)?.[1] || p.procedure_code;
    return /^04\.09\./.test(code);
  });
  if (hasGynCodes && !isSaoJose) {
    const res = calculateGynHonPaymentsSync(procedures);
    if (res && res.totalPayment > 0) return res;
    // lazy initialize in background; fallback permanece nas regras do hospital
    void loadGynHonMap();
  }

  // Fallback: CSV Cirurgia Geral
  const processedCsv = calculateHonPayments(procedures);
  return {
    procedures: processedCsv.procedures,
    totalPayment: processedCsv.totalPayment,
    appliedRule: processedCsv.appliedRule
  };
}


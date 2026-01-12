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
import { calculateGynHonPaymentsSync, loadGynHonMap, getGynHonMapSync } from './importers/gynXlsx'
import { calculateUroHonPaymentsSync, loadUroHonMap, getUroHonMapSync } from './importers/uroXlsx'
import { calculateOtoHonPaymentsSync, loadOtoHonMap } from './importers/otoXlsx'
import { calculateOtoSaoJoseHonPaymentsSync, loadOtoSaoJoseHonMap } from './importers/otoSaoJoseXlsx'
import { calculateVasHonPaymentsSync, loadVasHonMap } from './importers/vasXlsx'
import { HOSPITAL_SAO_JOSE_RULES } from './hospitals/hospitalSaoJose'

// VBA-first: não usamos regras TS de hospitais; apenas mapas das planilhas

// ================================================================
// CONSOLIDAR REGRAS DE TODOS OS HOSPITAIS
// ================================================================

export const ALL_HOSPITAL_RULES: Record<string, HospitalRules> = {
  HOSPITAL_MUNICIPAL_SAO_JOSE: HOSPITAL_SAO_JOSE_RULES
};

// Inicializar cache automaticamente
initializeRulesCache(ALL_HOSPITAL_RULES);

// Debug desativado no modo enxuto

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

  // 🧩 REGRAS ESPECÍFICAS POR PROFISSIONAL (HOSPITAL SÃO JOSÉ)
  if (isSaoJose) {
    const hospitalRules = ALL_HOSPITAL_RULES[hospitalKey] || {}
    const indiv = hospitalRules[doctorNameUpper]
    if (indiv && (indiv.rules?.length || indiv.multipleRules?.length || indiv.multipleRule)) {
      const paidCodes = new Set<string>()
      let pos = 0
      const normalize = (c: string) => c.match(/^([\d]{2}\.[\d]{2}\.[\d]{2}\.[\d]{3}-[\d])/)?.[1] || c
      const codesPerformed = procedures
        .filter(p => p.cbo !== '225151')
        .map(p => normalize(p.procedure_code))
      const performedSet = new Set(codesPerformed)
      let total = 0
      let out: (ProcedurePaymentInfo & { calculatedPayment: number; paymentRule: string; isSpecialRule: boolean })[] = procedures.map(p => ({
        ...p,
        calculatedPayment: 0,
        paymentRule: 'Sem regra específica',
        isSpecialRule: true
      }))
      // Aplicar regras múltiplas (preferência)
      let comboApplied = false
      const applyCombo = (codes: string[], value: number, desc: string) => {
        // aplicar no primeiro código da combinação, zerar os demais
        const firstIdx = out.findIndex(o => codes.includes(normalize(o.procedure_code)) && o.cbo !== '225151')
        if (firstIdx >= 0) {
          out[firstIdx] = { ...out[firstIdx], calculatedPayment: value, paymentRule: desc, isSpecialRule: true }
          codes.forEach(c => paidCodes.add(c))
          comboApplied = true
        }
      }
      if (indiv.multipleRules && indiv.multipleRules.length > 0) {
        for (const mr of indiv.multipleRules) {
          const allPresent = mr.codes.every(c => performedSet.has(c))
          if (allPresent) {
            applyCombo(mr.codes.map(normalize), mr.totalValue, mr.description || 'Regra múltipla (total)')
          }
        }
      } else if (indiv.multipleRule && indiv.multipleRule.codes?.length) {
        const allPresent = indiv.multipleRule.codes.every(c => performedSet.has(c))
        if (allPresent) {
          applyCombo(indiv.multipleRule.codes.map(normalize), indiv.multipleRule.totalValue, indiv.multipleRule.description || 'Regra múltipla (total)')
        }
      }
      // Aplicar regras individuais com valores por posição
      const ruleByCode = new Map<string, typeof indiv.rules[number]>()
      for (const r of (indiv.rules || [])) {
        ruleByCode.set(r.procedureCode, r)
      }
      out = out.map((p) => {
        const code = normalize(p.procedure_code)
        const isDup = paidCodes.has(code)
        const r = ruleByCode.get(code)
        if (p.cbo === '225151' || isDup || !r) {
          return { ...p, calculatedPayment: 0, paymentRule: isDup ? 'Duplicado (não pago)' : 'Sem regra específica', isSpecialRule: true }
        }
        const idx = pos
        pos++
        const base =
          idx <= 0 ? (r.standardValue ?? 0) :
          idx === 1 ? (r.secondaryValue ?? r.standardValue ?? 0) :
          idx === 2 ? (r.tertiaryValue ?? r.secondaryValue ?? r.standardValue ?? 0) :
          (r.quaternaryValue ?? r.tertiaryValue ?? r.secondaryValue ?? r.standardValue ?? 0)
        paidCodes.add(code)
        total += base
        return { ...p, calculatedPayment: base, paymentRule: r.description || `Regra específica (pos ${idx+1})`, isSpecialRule: true }
      })
      if (comboApplied) {
        total = out.reduce((s, o) => s + (o.calculatedPayment || 0), 0)
      }
      if (total > 0) {
        return { procedures: out, totalPayment: total, appliedRule: `Regras específicas - ${hospitalKey}` }
      }
    }
  }

  const uroMap = getUroHonMapSync()
  const hasUroCodes = !!uroMap && procedures.some(p => {
    const code = p.procedure_code.match(/^([\d]{2}\.[\d]{2}\.[\d]{2}\.[\d]{3}-[\d])/)?.[1] || p.procedure_code
    return uroMap.has(code)
  });
  if (hasUroCodes) {
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

  // ✅ Regra parametrizada por XLSX Ginecologia e Obstetrícia
  // Aplica HON1..HON5 se qualquer procedimento existir no mapa GYN (arquivo XLSX)
  {
    const gynMap = getGynHonMapSync();
    const hasGynMatch = procedures.some(p => {
      const code = p.procedure_code.match(/^([\d]{2}\.[\d]{2}\.[\d]{2}\.[\d]{3}-[\d])/)?.[1] || p.procedure_code;
      return !!gynMap?.has(code);
    });
    if (hasGynMatch) {
      const res = calculateGynHonPaymentsSync(procedures);
      if (res && res.totalPayment > 0) return res;
      void loadGynHonMap();
    }
  }

  // Fallback: CSV Cirurgia Geral
  const processedCsv = calculateHonPayments(procedures);
  const overrides = new Set<string>(['04.01.02.010-0']);
  let adjustedTotal = processedCsv.totalPayment;
  const adjustedProcedures = processedCsv.procedures.map(p => {
    const codeNorm = p.procedure_code.match(/^([\d]{2}\.[\d]{2}\.[\d]{2}\.[\d]{3}-[\d])/)?.[1] || p.procedure_code;
    if (overrides.has(codeNorm)) {
      const hon = getHonValuesForCode(codeNorm);
      const overridePay = hon ? hon.hon1 : (p.calculatedPayment || 0);
      if ((p.calculatedPayment || 0) !== overridePay) {
        adjustedTotal += overridePay - (p.calculatedPayment || 0);
        return { ...p, calculatedPayment: overridePay, paymentRule: 'CSV HON (override HON1)', isSpecialRule: true };
      }
    }
    return p;
  });
  return {
    procedures: adjustedProcedures,
    totalPayment: adjustedTotal,
    appliedRule: processedCsv.appliedRule
  };
}


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
import { calculateUroJsonPaymentsSync, loadUroJsonMap, getUroJsonMapSync } from './importers/uroJson'
import { calculateOtoHonPaymentsSync, loadOtoHonMap } from './importers/otoXlsx'
import { calculateOtoSaoJoseHonPaymentsSync, loadOtoSaoJoseHonMap } from './importers/otoSaoJoseXlsx'
import { calculateVasHonPaymentsSync, loadVasHonMap } from './importers/vasXlsx'
import { calculateOrtHonPaymentsSync, loadOrtHonMap, getOrtHonMapSync } from './importers/ortXlsx'
import { calculateOrtJsonPaymentsSync, loadOrtJsonMap, getOrtJsonMapSync } from './importers/ortJson'
import { calculateFozOrtJsonPaymentsSync, loadFozOrtJsonMap, getFozOrtJsonMapSync } from './importers/ortFozJson'

// ================================================================
// IMPORTAÇÃO DE REGRAS DE TODOS OS HOSPITAIS
// ================================================================
import { HOSPITAL_SAO_JOSE_RULES } from './hospitals/hospitalSaoJose'
import { TORAO_TOKUDA_RULES } from './hospitals/toraoTokuda'
import { HOSPITAL_18_DEZEMBRO_RULES } from './hospitals/hospital18Dezembro'
import { HOSPITAL_JUAREZ_BARRETO_RULES } from './hospitals/hospitalJuarezBarreto'
import { HOSPITAL_MATERNIDADE_FRG_RULES } from './hospitals/hospitalMaternidadeFrg'
import { HOSPITAL_NOSSA_SENHORA_APARECIDA_RULES } from './hospitals/hospitalNossaSenhoraAparecida'
import { HOSPITAL_SANTA_ALICE_RULES } from './hospitals/hospitalSantaAlice'

// ================================================================
// CONSOLIDAR REGRAS DE TODOS OS HOSPITAIS
// ================================================================

export const ALL_HOSPITAL_RULES: Record<string, HospitalRules> = {
  // Hospital Municipal São José - Colombo
  HOSPITAL_MUNICIPAL_SAO_JOSE: HOSPITAL_SAO_JOSE_RULES,

  // Torao Tokuda - Apucarana
  TORAO_TOKUDA_APUCARANA: TORAO_TOKUDA_RULES,

  // Hospital 18 de Dezembro - Arapoti
  HOSPITAL_18_DEZEMBRO_ARAPOTI: HOSPITAL_18_DEZEMBRO_RULES,

  // Hospital Juarez Barreto de Macedo
  HOSPITAL_MUNICIPAL_JUAREZ_BARRETO_MACEDO: HOSPITAL_JUAREZ_BARRETO_RULES,

  // Hospital Maternidade Nossa Senhora Aparecida - FRG
  HOSPITAL_MATERNIDADE_NOSSA_SENHORA_APARECIDA_FRG: HOSPITAL_MATERNIDADE_FRG_RULES,

  // Hospital Nossa Senhora Aparecida - Foz do Iguaçu
  HOSPITAL_NOSSA_SENHORA_APARECIDA_FOZ: HOSPITAL_NOSSA_SENHORA_APARECIDA_RULES,

  // Hospital Municipal Santa Alice
  HOSPITAL_MUNICIPAL_SANTA_ALICE: HOSPITAL_SANTA_ALICE_RULES
};

// Inicializar cache automaticamente
initializeRulesCache(ALL_HOSPITAL_RULES);

// Debug desativado no modo enxuto

const normalize04DigitsKey = (procedureCode: string): string => {
  const raw = (procedureCode || '').toString().trim()
  const codeOnly = raw.match(/^(\d{2}\.\d{2}\.\d{2}\.\d{3}-\d)/)?.[1] || raw
  return codeOnly.replace(/\D/g, '')
}

const applyDuplicate04First = (procedures: ProcedurePaymentInfo[]): ProcedurePaymentInfo[] => {
  const list = Array.isArray(procedures) ? procedures : []
  if (list.length === 0) return []

  const groups = new Map<string, Array<{ idx: number; p: ProcedurePaymentInfo }>>()
  list.forEach((p, idx) => {
    const key = String((p as any).aih_id || (p as any).aihId || '__single__')
    if (!groups.has(key)) groups.set(key, [])
    groups.get(key)!.push({ idx, p })
  })

  const out = [...list]

  for (const [, rows] of groups) {
    const ordered = [...rows].sort((a, b) => {
      const sa = typeof (a.p as any).sequence === 'number' && Number.isFinite((a.p as any).sequence) ? (a.p as any).sequence : Number.POSITIVE_INFINITY
      const sb = typeof (b.p as any).sequence === 'number' && Number.isFinite((b.p as any).sequence) ? (b.p as any).sequence : Number.POSITIVE_INFINITY
      if (sa !== sb) return sa - sb
      return a.idx - b.idx
    })

    const by04 = new Map<string, Array<{ idx: number; p: ProcedurePaymentInfo; cbo: string }>>()
    for (const row of ordered) {
      const digits = normalize04DigitsKey(row.p.procedure_code)
      if (!digits || !digits.startsWith('04')) continue
      const cbo = String((row.p as any).cbo || '').trim()
      if (!by04.has(digits)) by04.set(digits, [])
      by04.get(digits)!.push({ idx: row.idx, p: row.p, cbo })
    }

    for (const [, sameCode] of by04) {
      if (sameCode.length <= 1) continue
      const keep = sameCode.find(x => x.cbo && x.cbo !== '225151' && x.cbo !== '000000') ?? sameCode[0]
      for (const x of sameCode) {
        if (x.idx !== keep.idx) out[x.idx] = { ...x.p, cbo: '225151' }
      }
    }
  }

  return out
}

// ================================================================
// FUNÇÃO PRINCIPAL: CALCULAR PAGAMENTO MÉDICO
// ================================================================

export function calculateDoctorPayment(
  doctorName: string,
  procedures: ProcedurePaymentInfo[],
  hospitalId?: string
): CalculatedPaymentResult {
  procedures = applyDuplicate04First(procedures)
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

  const isSaoJose = hospitalKey === 'HOSPITAL_MUNICIPAL_SAO_JOSE'

  if (doctorNameUpper.includes('HUMBERTO MOREIRA')) {
    const norm = (c: string) => c.match(/^([\d]{2}\.[\d]{2}\.[\d]{2}\.[\d]{3}-[\d])/)?.[1] || c
    const target = new Set([
      '04.04.01.048-2',
      '04.04.01.041-5',
      '04.04.01.002-4',
      '04.04.01.001-6',
      '04.04.01.003-2'
    ])
    const performed = procedures
      .filter(p => p.cbo !== '225151')
      .map(p => norm(p.procedure_code))
      .filter(c => target.has(c))
    const count = new Set(performed).size
    const total = count >= 2 ? 800 : count === 1 ? 650 : 0
    const out = procedures.map(p => ({
      ...p,
      calculatedPayment: 0,
      paymentRule: count >= 2 ? 'Regra HUMBERTO: 800' : count === 1 ? 'Regra HUMBERTO: 650' : 'Sem regra',
      isSpecialRule: true
    }))
    if (total > 0) {
      const idx = out.findIndex(o => target.has(norm(o.procedure_code)) && o.cbo !== '225151')
      if (idx >= 0) {
        out[idx] = { ...out[idx], calculatedPayment: total }
      }
      return { procedures: out, totalPayment: total, appliedRule: 'HUMBERTO 650/800' }
    }
  }

  // ================================================================
  // 🧩 PRIORIDADE 1: REGRAS ESPECÍFICAS POR MÉDICO/HOSPITAL
  // Verifica se o médico tem regras específicas cadastradas para o hospital
  // ================================================================
  {
    const hospitalRules = ALL_HOSPITAL_RULES[hospitalKey] || {}
    const indiv = hospitalRules[doctorNameUpper]

    // Se o médico tem regras específicas (individuais ou múltiplas), aplicar
    if (indiv && (indiv.rules?.length || indiv.multipleRules?.length || indiv.multipleRule || indiv.fixedPaymentRule)) {
      console.log(`   ✅ Encontrou regras específicas para ${doctorNameUpper} em ${hospitalKey}`)

      // Verificar se é pagamento fixo mensal
      if (indiv.fixedPaymentRule) {
        console.log(`   💰 Pagamento fixo: R$ ${indiv.fixedPaymentRule.amount}`)
        return {
          procedures: procedures.map(p => ({
            ...p,
            calculatedPayment: 0,
            paymentRule: indiv.fixedPaymentRule?.description || 'Pagamento fixo',
            isSpecialRule: true
          })),
          totalPayment: indiv.fixedPaymentRule.amount,
          appliedRule: `Pagamento Fixo - ${hospitalKey}: ${indiv.fixedPaymentRule.description}`
        }
      }

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
        const firstIdx = out.findIndex(o => codes.includes(normalize(o.procedure_code)) && o.cbo !== '225151')
        if (firstIdx >= 0) {
          out[firstIdx] = { ...out[firstIdx], calculatedPayment: value, paymentRule: desc, isSpecialRule: true }
          codes.forEach(c => paidCodes.add(c))
          comboApplied = true
        }
      }

      if (indiv.multipleRules && indiv.multipleRules.length > 0) {
        // Ordenar por maior número de códigos para priorizar combinações maiores
        const sortedMultipleRules = [...indiv.multipleRules].sort((a, b) => b.codes.length - a.codes.length)
        for (const mr of sortedMultipleRules) {
          const allPresent = mr.codes.every(c => performedSet.has(c))
          if (allPresent) {
            applyCombo(mr.codes.map(normalize), mr.totalValue, mr.description || 'Regra múltipla (total)')
            break // Aplicar apenas a primeira combinação encontrada
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
      {
        const exclusiveCode = '04.08.04.007-6'
        if (hospitalKey === 'HOSPITAL_MATERNIDADE_NOSSA_SENHORA_APARECIDA_FRG' && performedSet.has(exclusiveCode)) {
          const outExclusive = procedures.map(p => ({
            ...p,
            calculatedPayment: 0,
            paymentRule: 'Sem regra específica',
            isSpecialRule: true
          }))
          const idxExclusive = outExclusive.findIndex(o => normalize(o.procedure_code) === exclusiveCode && o.cbo !== '225151')
          const valExclusive = ruleByCode.get(exclusiveCode)?.standardValue ?? 2500
          if (idxExclusive >= 0) {
            outExclusive[idxExclusive] = { ...outExclusive[idxExclusive], calculatedPayment: valExclusive, paymentRule: 'FRG QUADRIL REVISÃO (exclusivo)', isSpecialRule: true }
            return { procedures: outExclusive, totalPayment: valExclusive, appliedRule: 'Exclusivo FRG 04.08.04.007-6' }
          }
        }
      }

      out = out.map((p) => {
        const code = normalize(p.procedure_code)
        const r = ruleByCode.get(code)
        const shouldCountPos = p.cbo !== '225151' && !!r
        if (shouldCountPos) pos++
        if ((p as any).calculatedPayment > 0) {
          paidCodes.add(code)
          total += (p as any).calculatedPayment || 0
          return { ...p, isSpecialRule: true } as any
        }
        const isDup = paidCodes.has(code)
        if (p.cbo === '225151' || isDup || !r) {
          return { ...p, calculatedPayment: 0, paymentRule: isDup ? 'Duplicado (não pago)' : 'Sem regra específica', isSpecialRule: true }
        }
        const idx = pos - 1
        const base =
          idx <= 0 ? (r.standardValue ?? 0) :
            idx === 1 ? (r.secondaryValue ?? r.standardValue ?? 0) :
              idx === 2 ? (r.tertiaryValue ?? r.secondaryValue ?? r.standardValue ?? 0) :
                (r.quaternaryValue ?? r.tertiaryValue ?? r.secondaryValue ?? r.standardValue ?? 0)
        paidCodes.add(code)
        total += base
        return { ...p, calculatedPayment: base, paymentRule: r.description || `Regra específica (pos ${idx + 1})`, isSpecialRule: true }
      })

      if (comboApplied) {
        total = out.reduce((s, o) => s + (o.calculatedPayment || 0), 0)
      }

      if (total > 0) {
        return { procedures: out, totalPayment: total, appliedRule: `Regras específicas - ${hospitalKey}` }
      }
    }
  }

  // ================================================================
  // 🧩 PRIORIDADE 2: REGRAS POR ESPECIALIDADE (PLANILHAS VBA)
  // ================================================================


  // ✅ Prioridade: JSON Urologia (VBA_UROLOGIA.json em public)
  const uroJsonMap = getUroJsonMapSync();
  const hasUroJsonMatch = !!uroJsonMap && procedures.some(p => {
    const code = p.procedure_code.match(/^([\d]{2}\.[\d]{2}\.[\d]{2}\.[\d]{3}-[\d])/)?.[1] || p.procedure_code;
    return !!uroJsonMap?.has(code);
  });
  if (hasUroJsonMatch) {
    const resUroJson = calculateUroJsonPaymentsSync(procedures);
    if (resUroJson && resUroJson.totalPayment > 0) return resUroJson;
    void loadUroJsonMap();
  }

  // Fallback: XLSX Urologia (Legado)
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

  {
    if (hospitalKey === 'HOSPITAL_NOSSA_SENHORA_APARECIDA_FOZ') {
      const fozMap = getFozOrtJsonMapSync();
      const hasFozJsonMatch = procedures.some(p => {
        const code = p.procedure_code.match(/^([\d]{2}\.[\d]{2}\.[\d]{2}\.[\d]{3}-[\d])/)?.[1] || p.procedure_code;
        return !!fozMap?.has(code);
      });
      if (hasFozJsonMatch) {
        const resFozOrtJson = calculateFozOrtJsonPaymentsSync(procedures);
        if (resFozOrtJson) return resFozOrtJson;
        void loadFozOrtJsonMap();
      }
    }
  }

  {
    const norm = (c: string) => c.match(/^([\d]{2}\.[\d]{2}\.[\d]{2}\.[\d]{3}-[\d])/)?.[1] || c
    const target = '04.03.02.002-6'
    const idx = procedures.findIndex(o => norm(o.procedure_code) === target && o.cbo !== '225151')
    if (idx >= 0) {
      const out = procedures.map(p => ({
        ...p,
        calculatedPayment: 0,
        paymentRule: 'Sem regra específica',
        isSpecialRule: true
      }))
      out[idx] = { ...out[idx], calculatedPayment: 450, paymentRule: 'ORTOPEDIA HON (fixo HON1)', isSpecialRule: true }
      return { procedures: out, totalPayment: 450, appliedRule: 'Regra global ORT 04.03.02.002-6 HON1=450' }
    }
  }

  {
    if (hospitalKey !== 'HOSPITAL_NOSSA_SENHORA_APARECIDA_FOZ') {
      const ortJsonMap = getOrtJsonMapSync();
      const hasJsonMatch = procedures.some(p => {
        const code = p.procedure_code.match(/^([\d]{2}\.[\d]{2}\.[\d]{2}\.[\d]{3}-[\d])/)?.[1] || p.procedure_code;
        return !!ortJsonMap?.has(code);
      });
      if (hasJsonMatch) {
        const resOrtJson = calculateOrtJsonPaymentsSync(procedures);
        if (resOrtJson) return resOrtJson;
        void loadOrtJsonMap();
      }
      const ortMap = getOrtHonMapSync();
      const hasOrtMatch = procedures.some(p => {
        const code = p.procedure_code.match(/^([\d]{2}\.[\d]{2}\.[\d]{2}\.[\d]{3}-[\d])/)?.[1] || p.procedure_code;
        return !!ortMap?.has(code);
      });
      if (hasOrtMatch) {
        const resOrt = calculateOrtHonPaymentsSync(procedures);
        if (resOrt) return resOrt;
        void loadOrtHonMap();
      }
    }
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

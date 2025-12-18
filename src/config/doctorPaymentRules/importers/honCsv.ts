type HonValues = { hon1: number; hon2: number; hon3: number; hon4: number; hon5: number }

const toNumber = (raw: string | number | null | undefined): number => {
  if (raw == null) return 0
  if (typeof raw === 'number') return raw
  const s = String(raw).trim()
  if (!s) return 0
  const normalized = s.replace(/\./g, '').replace(/,/, '.')
  const n = Number(normalized)
  return isNaN(n) ? 0 : n
}

const extractCode = (procedimentoCell: string): string => {
  const s = (procedimentoCell || '').toString().trim()
  const m = s.match(/^(\d{2}\.\d{2}\.\d{2}\.\d{3}-\d)/)
  if (m) return m[1]
  const digits = s.replace(/[^0-9]/g, '')
  if (digits.length >= 10) {
    const code = `${digits.slice(0,2)}.${digits.slice(2,4)}.${digits.slice(4,6)}.${digits.slice(6,9)}-${digits.slice(9,10)}`
    return code
  }
  return s
}

import honCsvRaw from '@/assets/VBA_CIRURGIA_GERAL.csv?raw'

let HON_MAP: Map<string, HonValues> | null = null

export const getHonMap = (): Map<string, HonValues> => {
  if (HON_MAP) return HON_MAP
  const csvText: string = honCsvRaw || ''
  if (!csvText) {
    HON_MAP = new Map()
    return HON_MAP
  }
  const lines = csvText.split(/\r?\n/)
  const map = new Map<string, HonValues>()
  for (const line of lines.slice(1)) {
    const cols = line.split(';')
    if (cols.length < 6) continue
    const code = extractCode(cols[0] || '')
    if (!code || /^;+$/.test(code)) continue
    const hon1 = toNumber(cols[1])
    const hon2 = toNumber(cols[2])
    const hon3 = toNumber(cols[3])
    const hon4 = toNumber(cols[4])
    const hon5 = toNumber(cols[5])
    map.set(code, { hon1, hon2, hon3, hon4, hon5 })
  }
  HON_MAP = map
  return HON_MAP
}

export const getHonValuesForCode = (code: string): HonValues | null => {
  const m = getHonMap()
  const normalized = code.match(/^(\d{2}\.\d{2}\.\d{2}\.\d{3}-\d)/)?.[1] || code
  return m.get(normalized) || null
}

export const calculateHonByPosition = (index: number, values: HonValues): number => {
  if (index <= 0) return values.hon1
  if (index === 1) return values.hon2
  if (index === 2) return values.hon3
  if (index === 3) return values.hon4
  return values.hon5
}

import type { ProcedurePaymentInfo, CalculatedPaymentResult } from '../types'

export const calculateHonPayments = (procedures: ProcedurePaymentInfo[]): CalculatedPaymentResult => {
  let total = 0
  let pos = 0
  const paidCodes = new Set<string>()
  const out = procedures.map(p => {
    const codeNorm = p.procedure_code.match(/^(\d{2}\.\d{2}\.\d{2}\.\d{3}-\d)/)?.[1] || p.procedure_code
    const isExcluded = p.cbo === '000000' || p.cbo === '225151'
    const isDuplicate = paidCodes.has(codeNorm)
    const idx = (isExcluded || isDuplicate) ? -1 : pos
    if (!(isExcluded || isDuplicate)) pos++
    const hon = getHonValuesForCode(codeNorm)
    const base = (() => {
      if (!hon) return 0
      const alwaysHon1 = codeNorm === '04.01.02.010-0'
      const effectiveIdx = alwaysHon1 ? 0 : idx
      return calculateHonByPosition(effectiveIdx, hon)
    })()
    const pay = (isExcluded || isDuplicate) ? 0 : base
    if (!isExcluded && !isDuplicate && hon) paidCodes.add(codeNorm)
    total += pay
    return {
      ...p,
      calculatedPayment: pay,
      paymentRule: isDuplicate ? 'Duplicado (não pago)' : (hon ? `CSV HON (pos ${idx+1})` : 'Sem regra HON para código'),
      isSpecialRule: true
    }
  })
  return { procedures: out, totalPayment: total, appliedRule: 'CSV HON1..HON5 (Cirurgia Geral)' }
}


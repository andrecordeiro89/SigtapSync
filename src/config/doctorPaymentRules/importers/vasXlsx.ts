import * as XLSX from 'xlsx'

type HonValues = { hon1: number; hon2: number; hon3: number; hon4: number; hon5: number }

const toNumber = (raw: any): number => {
  if (raw == null) return 0
  if (typeof raw === 'number') return raw
  const s = String(raw).trim()
  if (!s) return 0
  const cleaned = s
    .replace(/\s*/g, '')
    .replace(/^R\$\s*/i, '')
    .replace(/[^\d,.-]/g, '')
  const normalized = cleaned.replace(/\./g, '').replace(/,/, '.')
  const n = Number(normalized)
  return isNaN(n) ? 0 : n
}

const extractCode = (cell: string): string => {
  const s = (cell || '').toString().trim()
  const m = s.match(/^(\d{2}\.\d{2}\.\d{2}\.\d{3}-\d)/)
  if (m) return m[1]
  const digits = s.replace(/[^0-9]/g, '')
  if (digits.length >= 10) {
    const code = `${digits.slice(0,2)}.${digits.slice(2,4)}.${digits.slice(4,6)}.${digits.slice(6,9)}-${digits.slice(9,10)}`
    return code
  }
  return s
}

let VAS_HON_MAP: Map<string, HonValues> | null = null
let initPromise: Promise<Map<string, HonValues>> | null = null

const candidateUrls: string[] = [
  '/VBA%20VASCULAR.xlsx',
  '/VBA VASCULAR.xlsx'
]
let resolvedUrl: string | undefined = candidateUrls[0]

export const loadVasHonMap = async (): Promise<Map<string, HonValues>> => {
  if (VAS_HON_MAP) return VAS_HON_MAP
  if (initPromise) return initPromise
  initPromise = (async () => {
    try {
      if (!resolvedUrl) {
        VAS_HON_MAP = new Map()
        return VAS_HON_MAP
      }
      let buf: ArrayBuffer | null = null
      for (const u of candidateUrls) {
        try {
          const res = await fetch(`${u}?t=${Date.now()}`)
          if (res.ok) {
            buf = await res.arrayBuffer()
            resolvedUrl = u
            break
          }
        } catch {}
      }
      if (!buf) {
        VAS_HON_MAP = new Map()
        return VAS_HON_MAP
      }
      const wb = XLSX.read(buf, { type: 'array', cellDates: false })
      const wsName = wb.SheetNames[0]
      const ws = wb.Sheets[wsName]
      const rows = XLSX.utils.sheet_to_json(ws, { header: 1 }) as any[][]
      const map = new Map<string, HonValues>()
      if (rows.length < 2) {
        VAS_HON_MAP = map
        return map
      }
      const headers = (rows[0] || []).map((h: any) => String(h || '').toUpperCase().trim())
      const idxCode = headers.findIndex(h => /(PROCEDIMENTO(S)?|C[ÓO]DIGO)/i.test(h))
      const idxHon1 = headers.findIndex(h => /^HON[\s-]?1$/i.test(h))
      const idxHon2 = headers.findIndex(h => /^HON[\s-]?2$/i.test(h))
      const idxHon3 = headers.findIndex(h => /^HON[\s-]?3$/i.test(h))
      const idxHon4 = headers.findIndex(h => /^HON[\s-]?4$/i.test(h))
      const idxHon5 = headers.findIndex(h => /^HON[\s-]?5$/i.test(h))
      const codeIndex = idxCode >= 0 ? idxCode : 0
      const h1 = idxHon1 >= 0 ? idxHon1 : -1
      const h2 = idxHon2 >= 0 ? idxHon2 : -1
      const h3 = idxHon3 >= 0 ? idxHon3 : -1
      const h4 = idxHon4 >= 0 ? idxHon4 : -1
      const h5 = idxHon5 >= 0 ? idxHon5 : -1
      for (const row of rows.slice(1)) {
        if (!row || row.length < codeIndex + 1) continue
        const code = extractCode(String(row[codeIndex] || ''))
        if (!code) continue
        const hon1 = h1 >= 0 ? toNumber(row[h1]) : 0
        const hon2 = h2 >= 0 ? toNumber(row[h2]) : 0
        const hon3 = h3 >= 0 ? toNumber(row[h3]) : 0
        const hon4 = h4 >= 0 ? toNumber(row[h4]) : 0
        const hon5 = h5 >= 0 ? toNumber(row[h5]) : 0
        map.set(code, { hon1, hon2, hon3, hon4, hon5 })
      }
      VAS_HON_MAP = map
      return map
    } catch {
      VAS_HON_MAP = new Map()
      return VAS_HON_MAP
    }
  })()
  return initPromise
}

export const getVasHonMapSync = (): Map<string, HonValues> | null => {
  return VAS_HON_MAP
}

export interface ProcedurePaymentInfo {
  procedure_code: string
  value_reais: number
  value_cents?: number
  cbo?: string
}
export interface CalculatedPaymentResult {
  procedures: Array<ProcedurePaymentInfo & { calculatedPayment: number; paymentRule: string; isSpecialRule: boolean }>
  totalPayment: number
  appliedRule: string
}

export const calculateVasHonPaymentsSync = (procedures: ProcedurePaymentInfo[]): CalculatedPaymentResult | null => {
  const map = getVasHonMapSync()
  if (!map) return null
  let total = 0
  let pos = 0
  const paidCodes = new Set<string>()
  const out = procedures.map((p) => {
    const codeNorm = p.procedure_code.match(/^(\d{2}\.\d{2}\.\d{2}\.\d{3}-\d)/)?.[1] || p.procedure_code
    const isExcluded = p.cbo === '225151'
    const isDuplicate = paidCodes.has(codeNorm)
    const idx = (isExcluded || isDuplicate) ? -1 : pos
    if (!(isExcluded || isDuplicate)) pos++
    const hon = map.get(codeNorm) || null
    const base =
      !hon ? 0 :
      idx <= 0 ? hon.hon1 :
      idx === 1 ? hon.hon2 :
      idx === 2 ? hon.hon3 :
      idx === 3 ? hon.hon4 :
      hon.hon5
    const pay = (isExcluded || isDuplicate) ? 0 : base
    if (!isExcluded && !isDuplicate && hon) paidCodes.add(codeNorm)
    total += pay
    return {
      ...p,
      calculatedPayment: pay,
      paymentRule: isDuplicate ? 'Duplicado (não pago)' : (hon ? `VASCULAR HON (pos ${idx+1})` : 'Sem regra HON para código'),
      isSpecialRule: true
    }
  })
  return { procedures: out, totalPayment: total, appliedRule: 'XLSX Vascular HON1..HON5' }
}

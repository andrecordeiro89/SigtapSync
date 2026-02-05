// import * as XLSX from 'xlsx'

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

let OTO_SJ_HON_MAP: Map<string, HonValues> | null = null
let initPromise: Promise<Map<string, HonValues>> | null = null

const candidateUrls: string[] = [
  '/VBA_OTORRINO_HOSPITAL_MUNICIPAL_SAO_JOSE.json'
]
let resolvedUrl: string | undefined = candidateUrls[0]

export const loadOtoSaoJoseHonMap = async (): Promise<Map<string, HonValues>> => {
  // sempre refazer a leitura para garantir atualização do arquivo
  OTO_SJ_HON_MAP = null
  initPromise = null
  initPromise = (async () => {
    try {
      if (!resolvedUrl) {
        OTO_SJ_HON_MAP = new Map()
        return OTO_SJ_HON_MAP
      }
      
      let data: any = null
      for (const u of candidateUrls) {
        try {
          const res = await fetch(`${u}?t=${Date.now()}`)
          if (res.ok) {
            data = await res.json()
            resolvedUrl = u
            break
          }
        } catch {}
      }

      if (!data || !data.Planilha1 || !Array.isArray(data.Planilha1)) {
        console.warn('Falha ao carregar ou estruturar JSON Otorrino São José', data)
        OTO_SJ_HON_MAP = new Map()
        return OTO_SJ_HON_MAP
      }

      const rows = data.Planilha1
      const map = new Map<string, HonValues>()
      
      for (const row of rows) {
        if (!row || !row.Codigo) continue
        const code = extractCode(String(row.Codigo))
        if (!code) continue
        
        const hon1 = toNumber(row.HON1)
        // O JSON novo tem apenas HON1, assumimos que replica para os outros ou é unico
        // Pela estrutura vista, só tem HON1. Vamos replicar para evitar zeros se a logica depender de hon2..5
        const val = hon1
        
        map.set(code, { hon1: val, hon2: val, hon3: val, hon4: val, hon5: val })
      }
      OTO_SJ_HON_MAP = map
      return map
    } catch (err) {
      console.error('Erro ao carregar JSON Otorrino SJ', err)
      OTO_SJ_HON_MAP = new Map()
      return OTO_SJ_HON_MAP
    }
  })()
  return initPromise
}

export const getOtoSaoJoseHonMapSync = (): Map<string, HonValues> | null => {
  return OTO_SJ_HON_MAP
}

export const invalidateOtoSaoJoseHonMap = (): void => {
  OTO_SJ_HON_MAP = null
  initPromise = null
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

export const calculateOtoSaoJoseHonPaymentsSync = (procedures: ProcedurePaymentInfo[]): CalculatedPaymentResult | null => {
  const map = getOtoSaoJoseHonMapSync()
  if (!map) return null
  let total = 0
  let pos = 0
  const paidCodes = new Set<string>()
  const out = procedures.map((p) => {
    const codeNorm = p.procedure_code.match(/^(\d{2}\.\d{2}\.\d{2}\.\d{3}-\d)/)?.[1] || p.procedure_code
    const isExcluded = p.cbo === '225151'
    const isDuplicate = paidCodes.has(codeNorm)
    const idx = (isExcluded || isDuplicate) ? -1 : pos
    const hon = map.get(codeNorm) || null
    if (!(isExcluded || isDuplicate) && hon) pos++
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
      paymentRule: isDuplicate ? 'Duplicado (não pago)' : (hon ? `OTORRINO SJ HON (pos ${idx+1})` : 'Sem regra HON para código'),
      isSpecialRule: true
    }
  })
  const comboSet = new Set<string>([
    '04.04.01.048-2',
    '04.04.01.041-5',
    '04.04.01.002-4',
    '04.04.01.001-6',
    '04.04.01.003-2'
  ])
  const presentComboKeys = new Set<string>()
  const comboIndices: number[] = []
  out.forEach((o, i) => {
    const codeNorm = o.procedure_code.match(/^(\d{2}\.\d{2}\.\d{2}\.\d{3}-\d)/)?.[1] || o.procedure_code
    if (comboSet.has(codeNorm) && o.cbo !== '225151') {
      if (!presentComboKeys.has(codeNorm)) {
        presentComboKeys.add(codeNorm)
        comboIndices.push(i)
      }
    }
  })
  const comboCount = presentComboKeys.size
  if (comboCount > 0) {
    // Nova regra baseada no JSON atualizado (VBA_OTORRINO_HOSPITAL_MUNICIPAL_SAO_JOSE.json)
    // O valor é fixo em 700 tanto para procedimentos individuais quanto para combos.
    const target = 700
    let otherSum = 0
    out.forEach(o => {
      const codeNorm = o.procedure_code.match(/^(\d{2}\.\d{2}\.\d{2}\.\d{3}-\d)/)?.[1] || o.procedure_code
      if (!comboSet.has(codeNorm) && /^04\.04\./.test(codeNorm)) {
        otherSum += o.calculatedPayment || 0
      }
    })
    const leadPay = Math.max(0, target - otherSum)
    comboIndices.forEach((idx, j) => {
      out[idx] = { 
        ...out[idx], 
        calculatedPayment: j === 0 ? leadPay : 0, 
        paymentRule: comboCount >= 2 ? 'OTORRINO COMBO (teto 700)' : 'OTORRINO HON1 (teto 700)', 
        isSpecialRule: true 
      }
    })
    total = out.reduce((s, o) => s + (o.calculatedPayment || 0), 0)
  }
  return { procedures: out, totalPayment: total, appliedRule: 'JSON Otorrino São José (Fixo 700)' }
}
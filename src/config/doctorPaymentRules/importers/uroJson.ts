import type { ProcedurePaymentInfo, CalculatedPaymentResult } from '../types'

type HonValues = { hon1: number; hon2: number; hon3: number; hon4: number; hon5: number }

const normalizeCode = (cell: string): string => {
    const s = (cell || '').toString().trim()
    const m = s.match(/^(\d{2}\.\d{2}\.\d{2}\.\d{3}-\d)/)
    if (m) return m[1]
    const digits = s.replace(/[^0-9]/g, '')
    if (digits.length >= 10) {
        const code = `${digits.slice(0, 2)}.${digits.slice(2, 4)}.${digits.slice(4, 6)}.${digits.slice(6, 9)}-${digits.slice(9, 10)}`
        return code
    }
    return s
}

let URO_JSON_MAP: Map<string, HonValues> | null = null
let initPromise: Promise<Map<string, HonValues>> | null = null

const candidateUrls: string[] = [
    '/VBA_UROLOGIA.json',
    '/VBA-UROLOGIA.json',
    '/VBAUROLOGIA.json'
]
let resolvedUrl: string | undefined = candidateUrls[0]

export const loadUroJsonMap = async (): Promise<Map<string, HonValues>> => {
    if (URO_JSON_MAP) return URO_JSON_MAP
    if (initPromise) return initPromise
    initPromise = (async () => {
        try {
            let data: any = null
            for (const u of candidateUrls) {
                try {
                    const res = await fetch(`${u}?t=${Date.now()}`)
                    if (res.ok) {
                        data = await res.json()
                        resolvedUrl = u
                        break
                    }
                } catch { }
            }
            const map = new Map<string, HonValues>()
            if (!data || !Array.isArray(data)) {
                URO_JSON_MAP = map
                return map
            }
            for (const row of data) {
                const procStr = String(row?.Procedimentos || row?.codigo || row?.code || '')
                const code = normalizeCode(procStr)
                if (!code) continue

                // No JSON da Urologia os campos são HON1, HON2 etc (maiúsculos)
                const hon1 = Number(row?.HON1 ?? row?.hon1 ?? 0) || 0
                const hon2 = Number(row?.HON2 ?? row?.hon2 ?? hon1) || hon1
                const hon3 = Number(row?.HON3 ?? row?.hon3 ?? hon1) || hon1
                const hon4 = Number(row?.HON4 ?? row?.hon4 ?? hon1) || hon1
                const hon5 = Number(row?.HON5 ?? row?.hon5 ?? hon1) || hon1

                map.set(code, { hon1, hon2, hon3, hon4, hon5 })
            }
            URO_JSON_MAP = map
            return map
        } catch {
            URO_JSON_MAP = new Map()
            return URO_JSON_MAP
        }
    })()
    return initPromise
}

export const getUroJsonMapSync = (): Map<string, HonValues> | null => {
    return URO_JSON_MAP
}

export const calculateUroJsonPaymentsSync = (procedures: ProcedurePaymentInfo[]): CalculatedPaymentResult | null => {
    const map = getUroJsonMapSync()
    if (!map) return null

    // Ordenação estratégica: Priorizar por sequência se disponível, depois por valor SUS
    const medicalSorted = procedures
        .filter(p => {
            const codeNorm = normalizeCode(p.procedure_code)
            // Urologia geralmente começa com 04.09, mas o JSON inclui outros (04.01, 04.06, 04.07, 04.08, 04.15)
            // Aceitamos qualquer 04.* que esteja no mapa
            return /^04\./.test(codeNorm) && p.cbo !== '225151'
        })
        .sort((a: any, b: any) => {
            const sa = typeof a.sequence === 'number' ? a.sequence : 9999
            const sb = typeof b.sequence === 'number' ? b.sequence : 9999
            if (sa !== sb) return sa - sb
            const va = typeof a.value_reais === 'number' ? a.value_reais : 0
            const vb = typeof b.value_reais === 'number' ? b.value_reais : 0
            return vb - va
        })

    let total = 0
    let pos = 0
    const out: Array<ProcedurePaymentInfo & { calculatedPayment: number; paymentRule: string; isSpecialRule: boolean }> = procedures.map(p => ({
        ...p,
        calculatedPayment: 0,
        paymentRule: 'Sem regra HON Urologia',
        isSpecialRule: true
    }))

    for (let i = 0; i < medicalSorted.length; i++) {
        const proc = medicalSorted[i]
        const codeNorm = normalizeCode(proc.procedure_code)
        const hon = map.get(codeNorm) || null

        if (hon) {
            const idx = pos
            pos++
            const base =
                idx <= 0 ? hon.hon1 :
                    idx === 1 ? hon.hon2 :
                        idx === 2 ? hon.hon3 :
                            idx === 3 ? hon.hon4 :
                                hon.hon5

            total += base

            // Encontrar o índice original no array de procedimentos (evitar duplicados de pagamento no mesmo código)
            const originalIdx = out.findIndex(o => normalizeCode(o.procedure_code) === codeNorm && o.cbo !== '225151' && o.calculatedPayment === 0)
            const displayRule = `UROLOGIA HON (pos ${idx + 1})`

            if (originalIdx >= 0) {
                out[originalIdx] = { ...out[originalIdx], calculatedPayment: base, paymentRule: displayRule, isSpecialRule: true }
            }
        }
    }

    return { procedures: out, totalPayment: total, appliedRule: 'JSON Urologia HON1..HON5' }
}

import * as XLSX from 'xlsx'

function detectSeparator(headerLine: string): ',' | ';' | '\t' {
  if ((headerLine.match(/;/g) || []).length >= 1) return ';'
  if ((headerLine.match(/\t/g) || []).length >= 1) return '\t'
  return ','
}

function normalizeCode(code: string): { formatted: string; digits: string } {
  const onlyDigits = code.replace(/\D/g, '')
  const padded = onlyDigits.padStart(10, '0').slice(-10)
  const formatted = `${padded.slice(0,2)}.${padded.slice(2,4)}.${padded.slice(4,6)}.${padded.slice(6,9)}-${padded.slice(9)}`
  return { formatted, digits: padded }
}

function parseCsvFlexible(text: string): Array<{ CO_PROCEDIMENTO: string; NO_PROCEDIMENTO: string }> {
  try {
    const lines = text.split(/\r?\n/).filter(l => l.trim().length > 0)
    if (lines.length === 0) return []
    const sep = detectSeparator(lines[0])
    const header = lines[0].split(sep).map(h => h.trim().replace(/^[\uFEFF]/, ''))
    const coIndex = header.findIndex(h => /CO_PROCEDIMENTO/i.test(h))
    const noIndex = header.findIndex(h => /NO_PROCEDIMENTO/i.test(h))
    if (coIndex < 0 || noIndex < 0) return []
    const out: Array<{ CO_PROCEDIMENTO: string; NO_PROCEDIMENTO: string }> = []
    for (let i = 1; i < lines.length; i++) {
      const cols = lines[i].split(sep)
      const co = (cols[coIndex] || '').trim().replace(/^"|"$/g, '')
      const no = (cols[noIndex] || '').trim().replace(/^"|"$/g, '')
      if (!co || !no) continue
      out.push({ CO_PROCEDIMENTO: co, NO_PROCEDIMENTO: no })
    }
    return out
  } catch {
    return []
  }
}

let sigtapCache: Map<string, string> | null = null

export async function getSigtapLocalMap(): Promise<Map<string, string>> {
  if (sigtapCache) return sigtapCache
  try {
    let csvText = ''
    // Tentar via URL absoluta pública primeiro
    try {
      const resPublic = await fetch('/sigtap_procedimentos.csv')
      if (resPublic.ok) csvText = await resPublic.text()
    } catch {}
    // Fallback: via caminho relativo ao módulo (vite asset)
    if (!csvText) {
      const url = new URL('../../sigtap_procedimentos.csv', import.meta.url).href
      const res = await fetch(url)
      if (!res.ok) throw new Error(`CSV não acessível: ${res.status}`)
      csvText = await res.text()
    }
    if (!csvText) {
      try {
        const mod: any = await import('../../sigtap_procedimentos.csv?raw')
        csvText = String(mod?.default || mod || '')
      } catch {}
    }
    let rows: any[] = []
    try {
      const wb = XLSX.read(csvText, { type: 'string' })
      const sheet = wb.Sheets[wb.SheetNames[0]]
      rows = XLSX.utils.sheet_to_json<any>(sheet)
    } catch {}
    if (!rows || rows.length === 0) {
      rows = parseCsvFlexible(csvText)
    }
    const { formatSigtapCode } = await import('./formatters')
    const map = new Map<string, string>()
    for (const r of rows) {
      const raw = String((r.CO_PROCEDIMENTO ?? r.co_procedimento ?? r.Co_Procedimento) ?? '').trim()
      const desc = String(r.NO_PROCEDIMENTO ?? '').trim()
      if (!raw || !desc) continue
      const { formatted, digits } = normalizeCode(raw)
      map.set(formatted, desc)
      map.set(digits, desc)
    }
    sigtapCache = map
  } catch (e) {
    sigtapCache = new Map()
  }
  return sigtapCache!
}

export async function resolveSigtapDescriptionFromCsv(code: string): Promise<string | undefined> {
  const map = await getSigtapLocalMap()
  const { formatSigtapCode } = await import('./formatters')
  const formatted = formatSigtapCode(code)
  const { digits } = normalizeCode(formatted)
  return map.get(formatted) || map.get(digits)
}


// Varredura Ginecologia (XLSX HON) em todos os hospitais
const { createClient } = require('@supabase/supabase-js')
const XLSX = require('xlsx')
const fs = require('fs')
const path = require('path')
require('dotenv').config()

const supabaseUrl = process.env.VITE_SUPABASE_URL
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY
const supabase = createClient(supabaseUrl, supabaseKey)

const toNumber = (raw) => {
  if (raw == null) return 0
  if (typeof raw === 'number') return raw
  const s = String(raw).trim()
  if (!s) return 0
  const normalized = s.replace(/\./g, '').replace(/,/, '.')
  const n = Number(normalized)
  return isNaN(n) ? 0 : n
}

const extractCode = (cell) => {
  const s = (cell || '').toString().trim().replace(/\u2013|\u2014/g, '-')
  const m = s.match(/(\d{2}\.\d{2}\.\d{2}\.\d{3}-\d)/)
  if (m) return m[1]
  const digits = s.replace(/[^0-9]/g, '')
  if (digits.length >= 10) {
    const code = `${digits.slice(0,2)}.${digits.slice(2,4)}.${digits.slice(4,6)}.${digits.slice(6,9)}-${digits.slice(9,10)}`
    return code
  }
  return s
}

const norm = (c) => c.match(/^(\d{2}\.\d{2}\.\d{2}\.\d{3}-\d)/)?.[1] || c

const loadGynXlsxMap = () => {
  const candidate = [
    path.resolve(__dirname, '../../public/VBA GINECOLOGIA.xlsx'),
    path.resolve(__dirname, '../../public/VBA%20GINECOLOGIA.xlsx')
  ]
  let found = candidate.find(p => fs.existsSync(p))
  if (!found) return new Map()
  const wb = XLSX.readFile(found)
  const wsName = wb.SheetNames[0]
  const ws = wb.Sheets[wsName]
  const rows = XLSX.utils.sheet_to_json(ws, { header: 1 })
  const map = new Map()
  if (!rows || rows.length < 2) return map
  const headers = (rows[0] || []).map(h => String(h || '').toUpperCase().trim())
  const idxCode = headers.findIndex(h => /PROCEDIMENTO|CÓDIGO|CODIGO/.test(h))
  const idxHon1 = headers.findIndex(h => /^HON1$/.test(h))
  const idxHon2 = headers.findIndex(h => /^HON2$/.test(h))
  const idxHon3 = headers.findIndex(h => /^HON3$/.test(h))
  const idxHon4 = headers.findIndex(h => /^HON4$/.test(h))
  const idxHon5 = headers.findIndex(h => /^HON5$/.test(h))
  const codeIndex = idxCode >= 0 ? idxCode : 0
  const h1 = idxHon1 >= 0 ? idxHon1 : 1
  const h2 = idxHon2 >= 0 ? idxHon2 : 2
  const h3 = idxHon3 >= 0 ? idxHon3 : 3
  const h4 = idxHon4 >= 0 ? idxHon4 : 4
  const h5 = idxHon5 >= 0 ? idxHon5 : 5
  for (const row of rows.slice(1)) {
    if (!row || row.length < Math.max(codeIndex, h1, h2, h3, h4, h5) + 1) continue
    const code = extractCode(String(row[codeIndex] || ''))
    if (!code) continue
    const hon1 = toNumber(row[h1])
    const hon2 = toNumber(row[h2])
    const hon3 = toNumber(row[h3])
    const hon4 = toNumber(row[h4])
    const hon5 = toNumber(row[h5])
    map.set(code, { hon1, hon2, hon3, hon4, hon5 })
  }
  return map
}

const calculateByPosition = (idx, v) => {
  if (idx <= 0) return v.hon1
  if (idx === 1) return v.hon2
  if (idx === 2) return v.hon3
  if (idx === 3) return v.hon4
  return v.hon5
}

async function scanHospital(h, map) {
  const { data: aihs } = await supabase
    .from('aihs')
    .select('id, patient_id, aih_number, discharge_date')
    .eq('hospital_id', h.id)
    .order('discharge_date', { ascending: false })
    .limit(200)
  let checked = 0
  let zeroPayments = 0
  let totalOverrides = 0
  const anomalies = []
  for (const aih of (aihs || [])) {
    const { data: procs } = await supabase
      .from('procedure_records')
      .select('procedure_code, professional_cbo, procedure_date, sequencia')
      .eq('aih_id', aih.id)
      .order('sequencia', { ascending: true })
      .order('procedure_date', { ascending: true })
    if (!procs || procs.length === 0) continue
    // filtrar códigos da esfera ginecológica (map contém os códigos)
    const gynProcs = procs.filter(p => map.has(norm(p.procedure_code || '')))
    if (gynProcs.length === 0) continue
    checked++
    let pos = 0
    const paidCodes = new Set()
    let total = 0
    for (const p of gynProcs) {
      const code = norm(p.procedure_code || '')
      const isExcluded = p.professional_cbo === '225151' || p.professional_cbo === '000000'
      const isDup = paidCodes.has(code)
      const idx = (isExcluded || isDup) ? -1 : pos
      const hon = map.get(code) || null
      let pay = 0
      if (hon) {
        pay = (isExcluded || isDup) ? 0 : calculateByPosition(idx, hon)
      }
      if (!(isExcluded || isDup) && hon) {
        pos++
        paidCodes.add(code)
      }
      total += pay
    }
    if (total === 0) {
      zeroPayments++
      const codes = gynProcs.map(p => ({ code: norm(p.procedure_code || ''), cbo: p.professional_cbo || '' }))
      anomalies.push({ aih: aih.aih_number, patient: aih.patient_id, codes })
    }
  }
  return { name: h.name, checked, zeroPayments, anomalies }
}

async function run() {
  const map = loadGynXlsxMap()
  if (!map || map.size === 0) {
    console.log('⚠️ Mapa Ginecologia vazio (verifique public/VBA GINECOLOGIA.xlsx)')
  } else {
    console.log(`✅ Ginecologia HON carregado com ${map.size} códigos`)
  }
  const { data: hospitals, error } = await supabase
    .from('hospitals')
    .select('id, name, is_active')
    .eq('is_active', true)
  if (error) {
    console.error('Erro hospitais', error)
    process.exit(1)
  }
  const results = []
  for (const h of (hospitals || [])) {
    const r = await scanHospital(h, map)
    results.push(r)
  }
  console.log('RESUMO GERAL (Ginecologia)')
  results.forEach(r => {
    console.log(`${r.name}: AIHs com GYN ${r.checked} | repasse zero ${r.zeroPayments}`)
    if (r.zeroPayments > 0) {
      r.anomalies.slice(0, 5).forEach(a => {
        const list = a.codes.map(c => `${c.code}:${c.cbo}`).join(', ')
        console.log(`  - AIH ${a.aih} Paciente ${a.patient} | Codes ${list}`)
      })
    }
  })
}

run().then(() => process.exit(0)).catch(e => {
  console.error('Erro', e)
  process.exit(1)
})

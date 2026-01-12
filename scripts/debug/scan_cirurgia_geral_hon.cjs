const { createClient } = require('@supabase/supabase-js')
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

const loadCsvHonMap = () => {
  const csvPath = path.resolve(__dirname, '../../src/assets/VBA_CIRURGIA_GERAL.csv')
  if (!fs.existsSync(csvPath)) return new Map()
  const text = fs.readFileSync(csvPath, 'utf8')
  const lines = text.split(/\r?\n/)
  const map = new Map()
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
  return map
}

const calculateHonByPosition = (idx, values) => {
  if (idx <= 0) return values.hon1
  if (idx === 1) return values.hon2
  if (idx === 2) return values.hon3
  if (idx === 3) return values.hon4
  return values.hon5
}

const norm = (c) => c.match(/^(\d{2}\.\d{2}\.\d{2}\.\d{3}-\d)/)?.[1] || c

async function scanHospital(h) {
  const honMap = loadCsvHonMap()
  const { data: aihs } = await supabase
    .from('aihs')
    .select('id, patient_id, aih_number, discharge_date')
    .eq('hospital_id', h.id)
    .order('discharge_date', { ascending: false })
    .limit(200)
  let checked = 0
  let zeroPayments = 0
  let overridesApplied = 0
  const anomalies = []
  for (const aih of (aihs || [])) {
    const { data: procs } = await supabase
      .from('procedure_records')
      .select('procedure_code, professional_cbo, procedure_date, sequencia')
      .eq('aih_id', aih.id)
      .ilike('procedure_code', '04.01%')
      .order('sequencia', { ascending: true })
      .order('procedure_date', { ascending: true })
    if (!procs || procs.length === 0) continue
    checked++
    let pos = 0
    const paidCodes = new Set()
    let total = 0
    for (const p of procs) {
      const code = norm(p.procedure_code || '')
      const isExcluded = p.professional_cbo === '225151' || p.professional_cbo === '000000'
      const isDup = paidCodes.has(code)
      const idx = (isExcluded || isDup) ? -1 : pos
      const hon = honMap.get(code) || null
      let pay = 0
      if (code === '04.01.02.010-0' || code === '04.01.02.005-3') {
        const fallback = { hon1: 150, hon2: 112.5, hon3: 90, hon4: 75, hon5: 75 }
        pay = calculateHonByPosition(0, hon || fallback)
        overridesApplied++
      } else if (hon) {
        pay = (isExcluded || isDup) ? 0 : calculateHonByPosition(idx, hon)
      }
      if (!(isExcluded || isDup) && hon) {
        pos++
        paidCodes.add(code)
      }
      total += pay
    }
    if (total === 0) zeroPayments++
    if (total === 0) {
      const codes = (procs || []).map(p => ({ code: norm(p.procedure_code || ''), cbo: p.professional_cbo || '' }))
      anomalies.push({ aih: aih.aih_number, patient: aih.patient_id, codes })
    }
  }
  return { name: h.name, checked, overridesApplied, zeroPayments, anomalies }
}

async function run() {
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
    const r = await scanHospital(h)
    results.push(r)
  }
  console.log('RESUMO GERAL')
  results.forEach(r => {
    console.log(`${r.name}: AIHs 04.01.* ${r.checked} | overrides ${r.overridesApplied} | repasse zero ${r.zeroPayments}`)
    if (r.zeroPayments > 0) {
      const head = r.anomalies.slice(0, 5)
      head.forEach(a => {
        const list = a.codes.map(c => `${c.code}:${c.cbo}`).join(', ')
        console.log(`  - AIH ${a.aih} Paciente ${a.patient} | Codes ${list}`)
      })
    }
  })
}

run().then(() => {
  process.exit(0)
}).catch(e => {
  console.error('Erro', e)
  process.exit(1)
})

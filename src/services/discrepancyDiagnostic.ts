import { supabase } from '../lib/supabase'
import { supabaseSih } from '../lib/sihSupabase'
import { SihApiAdapter } from './sihApiAdapter'

export async function computeAihTotalsComparison(args: {
  hospitalName: string
  competenciaMonth: number
  competenciaYear?: number
}) {
  const { hospitalName, competenciaMonth, competenciaYear } = args

  const { data: hospRows, error: hospErr } = await supabase
    .from('hospitals')
    .select('id,name,cnes')
    .ilike('name', `%${hospitalName}%`)
    .limit(1)

  if (hospErr) {
    return { success: false, error: hospErr.message }
  }
  if (!hospRows || hospRows.length === 0) {
    return { success: false, error: 'hospital_not_found' }
  }

  const hospitalId = hospRows[0].id as string
  const cnes = String(hospRows[0].cnes || '')

  if (!supabaseSih) {
    return { success: false, error: 'sih_remote_not_configured' }
  }

  let rdQuery = supabaseSih
    .from('sih_rd')
    .select('n_aih,val_tot,mes_cmpt,ano_cmpt,cnes')
    .eq('cnes', cnes)
    .eq('mes_cmpt', competenciaMonth)
  if (typeof competenciaYear === 'number') {
    rdQuery = rdQuery.eq('ano_cmpt', competenciaYear)
  }
  const { data: rdRows, error: rdErr } = await rdQuery
  if (rdErr) {
    return { success: false, error: rdErr.message }
  }

  const distinctAihKeys = new Set<string>()
  let remoteValTotDistinct = 0
  for (const r of rdRows || []) {
    const key = String(r.n_aih || '')
    if (!distinctAihKeys.has(key)) {
      distinctAihKeys.add(key)
      remoteValTotDistinct += Number(r.val_tot || 0)
    }
  }

  const compStr = typeof competenciaYear === 'number'
    ? `${String(competenciaYear).padStart(4, '0')}-${String(competenciaMonth).padStart(2, '0')}`
    : `${new Date().getFullYear()}-${String(competenciaMonth).padStart(2, '0')}`

  const doctors = await SihApiAdapter.getDoctorsWithPatients({
    hospitalIds: [hospitalId],
    competencia: compStr
  })

  const allPatients = doctors
    .flatMap(d => d.patients || [])
    .filter(p => String((p as any)?.aih_info?.hospital_id || '') === hospitalId)

  const cardsSum = allPatients.reduce((sum, p) => sum + Number((p as any).total_value_reais || 0), 0)

  const distinctByAih = new Map<string, number>()
  for (const p of allPatients) {
    const k = String((p as any)?.aih_info?.aih_number || '')
    const v = Number((p as any).total_value_reais || 0)
    if (k && !distinctByAih.has(k)) distinctByAih.set(k, v)
  }
  const cardsDistinctSum = Array.from(distinctByAih.values()).reduce((a, b) => a + b, 0)

  const { data: localAihs, error: localErr } = await supabase
    .from('aihs')
    .select('id,aih_number,calculated_total_value,competencia,hospital_id')
    .eq('hospital_id', hospitalId)
  if (localErr) {
    return { success: false, error: localErr.message }
  }

  const filteredLocal = (localAihs || []).filter(a => {
    const comp = (a as any).competencia as string | null
    if (!comp) return false
    const m = comp.match(/^([0-9]{4})-([0-9]{2})-/)
    if (!m) return false
    const yy = Number(m[1])
    const mm = Number(m[2])
    const okMonth = mm === competenciaMonth
    const okYear = typeof competenciaYear === 'number' ? yy === competenciaYear : true
    return okMonth && okYear
  })
  const localSigtapTotal = filteredLocal.reduce((sum, a) => sum + Number((a as any).calculated_total_value || 0), 0) / 100

  return {
    success: true,
    hospitalId,
    cnes,
    competencia: { month: competenciaMonth, year: competenciaYear || null },
    totals: {
      remote_val_tot_distinct_reais: remoteValTotDistinct,
      cards_sum_reais: cardsSum,
      cards_distinct_sum_reais: cardsDistinctSum,
      local_sigtap_total_reais: localSigtapTotal
    }
  }
}


import { supabase } from '../lib/supabase'
import { supabaseSih } from '../lib/sihSupabase'

export type TabwinReportFilters = {
  hospitalId: string
  dischargeFrom?: string
  dischargeTo?: string
  doctorCns: string
}

export type TabwinReportRow = {
  aihNumber: string
  dtInter?: string
  dtSaida?: string
  competencia?: string
  hospitalName?: string
  doctorName?: string
  doctorCns?: string
}

export type TabwinReportStats = {
  aihsRd: number
  aihsWithSp: number
  aihsMatchedDoctor: number
  aihsMatchedDoctorBySp: number
  aihsMatchedDoctorByLocal: number
}

export type TabwinReportResult = {
  rows: TabwinReportRow[]
  stats: TabwinReportStats
}

const chunk = <T,>(arr: T[], size = 200): T[][] => {
  const out: T[][] = []
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size))
  return out
}

const normalizeDigits = (v: unknown): string => {
  return String(v ?? '').replace(/\D/g, '').replace(/^0+/, '')
}

const formatCompetencia = (year?: number | null, month?: number | null): string => {
  const y = typeof year === 'number' && Number.isFinite(year) ? year : undefined
  const m = typeof month === 'number' && Number.isFinite(month) ? month : undefined
  if (!y || !m) return ''
  return `${String(m).padStart(2, '0')}/${String(y)}`
}

const formatDateBR = (raw?: string | null): string => {
  const s = String(raw ?? '').trim()
  if (!s) return ''
  const mIso = s.match(/^(\d{4})-(\d{2})-(\d{2})/)
  if (mIso) return `${mIso[3]}/${mIso[2]}/${mIso[1]}`
  const m8 = s.match(/^(\d{4})(\d{2})(\d{2})$/)
  if (m8) return `${m8[3]}/${m8[2]}/${m8[1]}`
  const mBr = s.match(/^(\d{2})\/(\d{2})\/(\d{4})$/)
  if (mBr) return s
  try {
    const d = new Date(s)
    if (!Number.isNaN(d.getTime())) {
      const day = String(d.getDate()).padStart(2, '0')
      const month = String(d.getMonth() + 1).padStart(2, '0')
      const year = String(d.getFullYear())
      return `${day}/${month}/${year}`
    }
  } catch {}
  return s
}

const toISODate = (raw?: string | null): string => {
  const s = String(raw ?? '').trim()
  if (!s) return ''
  const mIso = s.match(/^(\d{4})-(\d{2})-(\d{2})/)
  if (mIso) return `${mIso[1]}-${mIso[2]}-${mIso[3]}`
  const m8 = s.match(/^(\d{8})$/)
  if (m8) {
    const digits = m8[1]
    const y = Number(digits.slice(0, 4))
    if (y >= 1900 && y <= 2100) return `${digits.slice(0, 4)}-${digits.slice(4, 6)}-${digits.slice(6, 8)}`
    return `${digits.slice(4, 8)}-${digits.slice(2, 4)}-${digits.slice(0, 2)}`
  }
  const mBr = s.match(/^(\d{2})\/(\d{2})\/(\d{4})$/)
  if (mBr) return `${mBr[3]}-${mBr[2]}-${mBr[1]}`
  try {
    const d = new Date(s)
    if (!Number.isNaN(d.getTime())) return d.toISOString().slice(0, 10)
  } catch {}
  return ''
}

const endExclusiveFrom = (to?: string): string | undefined => {
  if (!to) return undefined
  try {
    const dt = new Date(to)
    if (Number.isNaN(dt.getTime())) return undefined
    dt.setDate(dt.getDate() + 1)
    return dt.toISOString().slice(0, 10)
  } catch {
    return undefined
  }
}

export const SihTabwinReportService = {
  async fetchReport(filters: TabwinReportFilters): Promise<TabwinReportResult> {
    if (!supabaseSih) throw new Error('Fonte SIH remota não configurada')

    const hospitalIsAll = !filters.hospitalId || filters.hospitalId === 'all'
    const doctorIsAll = !filters.doctorCns || filters.doctorCns === 'all'
    const desiredDoctorNorm = normalizeDigits(filters.doctorCns)

    const endExclusive = endExclusiveFrom(filters.dischargeTo)
    const hasDateFilter = Boolean(filters.dischargeFrom || filters.dischargeTo)
    let selectedHospitalName = ''
    let selectedHospitalCnes = ''
    let selectedHospitalCnesVariants: string[] = []
    if (!hospitalIsAll) {
      const { data: hospRows, error: hospErr } = await supabase
        .from('hospitals')
        .select('id,name,cnes')
        .eq('id', filters.hospitalId)
        .limit(1)
      if (hospErr) throw hospErr
      const h = (hospRows || [])[0] as any
      selectedHospitalName = String(h?.name || '')
      selectedHospitalCnes = String(h?.cnes || '')
      const c = selectedHospitalCnes.trim()
      const padded7 = c && /^\d+$/.test(c) ? c.padStart(7, '0') : c
      selectedHospitalCnesVariants = Array.from(new Set([c, padded7].filter(Boolean)))
    }

    const fetchRd = async (opts: { useDateFilters: boolean; useCnesFallback: boolean }): Promise<any[]> => {
      if (opts.useCnesFallback && selectedHospitalCnesVariants.length === 0) return []
      const selectCols = opts.useCnesFallback
        ? 'n_aih, hospital_id, cnes, dt_inter, dt_saida, ano_cmpt, mes_cmpt'
        : 'n_aih, hospital_id, dt_inter, dt_saida, ano_cmpt, mes_cmpt'
      let q = supabaseSih.from('sih_rd').select(selectCols)
      if (!hospitalIsAll) {
        if (opts.useCnesFallback) q = q.in('cnes', selectedHospitalCnesVariants)
        else q = q.eq('hospital_id', filters.hospitalId)
      }
      if (opts.useDateFilters) {
        if (filters.dischargeFrom) q = q.gte('dt_saida', filters.dischargeFrom)
        if (endExclusive) q = q.lt('dt_saida', endExclusive)
        if (hasDateFilter) q = q.not('dt_saida', 'is', null)
      }
      const { data, error } = await q
      if (error) throw error
      return (data || []) as any[]
    }

    let rdRaw: any[] = []
    if (!hospitalIsAll) {
      const applyDateFilter = (rows: any[]): any[] => {
        if (!hasDateFilter || rows.length === 0) return rows
        const fromIso = filters.dischargeFrom ? toISODate(filters.dischargeFrom) : ''
        const toIso = filters.dischargeTo ? toISODate(filters.dischargeTo) : ''
        return rows.filter(r => {
          const iso = toISODate(r?.dt_saida)
          if (!iso) return false
          if (fromIso && iso < fromIso) return false
          if (toIso && iso > toIso) return false
          return true
        })
      }

      const byIdRaw = await fetchRd({ useDateFilters: false, useCnesFallback: false })
      const byIdFiltered = applyDateFilter(byIdRaw)
      if (byIdFiltered.length > 0) {
        rdRaw = byIdFiltered
      } else {
        const byCnesRaw = await fetchRd({ useDateFilters: false, useCnesFallback: true })
        rdRaw = applyDateFilter(byCnesRaw)
      }
    } else {
      rdRaw = await fetchRd({ useDateFilters: true, useCnesFallback: false })
      if (rdRaw.length === 0 && hasDateFilter) {
        rdRaw = await fetchRd({ useDateFilters: false, useCnesFallback: false })
        if (rdRaw.length > 0) {
          const fromIso = filters.dischargeFrom ? toISODate(filters.dischargeFrom) : ''
          const toIso = filters.dischargeTo ? toISODate(filters.dischargeTo) : ''
          rdRaw = rdRaw.filter(r => {
            const iso = toISODate(r?.dt_saida)
            if (!iso) return false
            if (fromIso && iso < fromIso) return false
            if (toIso && iso > toIso) return false
            return true
          })
        }
      }
    }

    const rdMap = new Map<string, any>()
    const aihNumbersRaw = Array.from(new Set(rdRaw.map(r => String(r?.n_aih ?? '')).filter(Boolean)))
    for (const r of rdRaw) {
      const rawAih = String(r?.n_aih ?? '')
      const key = normalizeDigits(rawAih) || rawAih
      if (!key) continue
      if (!rdMap.has(key)) rdMap.set(key, r)
    }
    const rd = Array.from(rdMap.entries()).map(([aihKey, r]) => ({ ...r, __aih_key: aihKey }))
    if (aihNumbersRaw.length === 0) {
      return { rows: [], stats: { aihsRd: 0, aihsWithSp: 0, aihsMatchedDoctor: 0, aihsMatchedDoctorBySp: 0, aihsMatchedDoctorByLocal: 0 } }
    }

    const spRows: any[] = []
    const aihNumbersForSp = Array.from(new Set([
      ...aihNumbersRaw,
      ...aihNumbersRaw.map(n => normalizeDigits(n)).filter(Boolean)
    ]))
    for (const ch of chunk(aihNumbersForSp, 200)) {
      const spQuery = supabaseSih
        .from('sih_sp')
        .select('sp_naih, sp_pf_doc')
        .in('sp_naih', ch)
      const { data: spData, error: spErr } = await spQuery
      if (spErr) throw spErr
      if (spData && spData.length > 0) spRows.push(...spData)
    }

    const doctorsByAihKey = new Map<string, string[]>()
    const doctorsNormByAihKey = new Map<string, string[]>()
    for (const row of spRows) {
      const aihRaw = String(row.sp_naih || '')
      const aihKey = normalizeDigits(aihRaw) || aihRaw
      const cns = String(row.sp_pf_doc || '').trim()
      const cnsNorm = normalizeDigits(cns)
      if (!aihKey || !cns) continue
      if (!doctorsByAihKey.has(aihKey)) doctorsByAihKey.set(aihKey, [])
      const list = doctorsByAihKey.get(aihKey)!
      if (!list.includes(cns)) list.push(cns)

      if (!doctorsNormByAihKey.has(aihKey)) doctorsNormByAihKey.set(aihKey, [])
      const nlist = doctorsNormByAihKey.get(aihKey)!
      if (cnsNorm && !nlist.includes(cnsNorm)) nlist.push(cnsNorm)
    }

    const localDoctorNormByAihKey = new Map<string, string>()
    if (!doctorIsAll && desiredDoctorNorm && rd.length > 0) {
      const aihKeys = rd.map(r => String((r as any).__aih_key || '')).filter(Boolean)
      for (const ch of chunk(aihKeys, 200)) {
        const { data: localAihRows, error: localAihErr } = await supabase
          .from('aihs')
          .select('aih_number,cns_responsavel,cns_solicitante,cns_autorizador')
          .in('aih_number', ch)
        if (localAihErr) throw localAihErr
        ;(localAihRows || []).forEach((a: any) => {
          const key = normalizeDigits(a?.aih_number) || String(a?.aih_number || '')
          if (!key) return
          const cns = normalizeDigits(a?.cns_responsavel) || normalizeDigits(a?.cns_solicitante) || normalizeDigits(a?.cns_autorizador)
          if (cns) localDoctorNormByAihKey.set(key, cns)
        })
      }
    }

    const hospById = new Map<string, { name?: string }>()
    const hospIds = Array.from(new Set(rd.map(r => String((r as any).hospital_id)).filter(Boolean)))
    if (hospIds.length > 0) {
      const { data: localHospById, error: localHospByIdErr } = await supabase
        .from('hospitals')
        .select('id,name')
        .in('id', hospIds)
      if (localHospByIdErr) throw localHospByIdErr
      ;(localHospById || []).forEach((h: any) => hospById.set(String(h.id), { name: String(h.name || '') }))
    }

    const doctorCnsSet = Array.from(new Set(spRows.map(r => String(r.sp_pf_doc)).filter(Boolean)))
    const doctorCnsNormSet = Array.from(new Set(doctorCnsSet.map(normalizeDigits).filter(Boolean)))
    const doctorByCns = new Map<string, { name?: string }>()
    const doctorByCnsNorm = new Map<string, { name?: string; rawCns?: string }>()
    if (doctorCnsNormSet.length > 0) {
      const { data: docRows, error: docErr } = await supabase
        .from('doctors')
        .select('cns,name')
        .in('cns', doctorCnsNormSet)
      if (docErr) {
        const desired = normalizeDigits(filters.doctorCns)
        const fallList = Array.from(new Set([...doctorCnsNormSet, desired].filter(Boolean)))
        const { data: fallbackDocRows, error: fallbackDocErr } = await supabase
          .from('doctors')
          .select('cns,name')
          .in('cns', fallList)
        if (fallbackDocErr) throw fallbackDocErr
        ;(fallbackDocRows || []).forEach((d: any) => {
          const rawCns = String(d.cns || '')
          doctorByCns.set(rawCns, { name: String(d.name || '') })
          const norm = normalizeDigits(rawCns)
          if (norm) doctorByCnsNorm.set(norm, { name: String(d.name || ''), rawCns })
        })
      } else {
        ;(docRows || []).forEach((d: any) => {
          const rawCns = String(d.cns || '')
          doctorByCns.set(rawCns, { name: String(d.name || '') })
          const norm = normalizeDigits(rawCns)
          if (norm) doctorByCnsNorm.set(norm, { name: String(d.name || ''), rawCns })
        })
      }
    }

    const out: TabwinReportRow[] = []
    let matchedBySp = 0
    let matchedByLocal = 0
    for (const r of rd) {
      const aih = String((r as any).__aih_key || normalizeDigits(r.n_aih) || r.n_aih || '')
      if (!aih) continue
      const hospId = String((r as any).hospital_id || '')
      const competencia = formatCompetencia(Number(r.ano_cmpt), Number(r.mes_cmpt))
      const base = {
        aihNumber: aih,
        dtInter: formatDateBR(r.dt_inter ? String(r.dt_inter) : ''),
        dtSaida: formatDateBR(r.dt_saida ? String(r.dt_saida) : ''),
        competencia,
        hospitalName: hospById.get(hospId)?.name || (hospitalIsAll ? '' : selectedHospitalName)
      } satisfies Omit<TabwinReportRow, 'doctorName' | 'doctorCns'>

      const doctorList = doctorsByAihKey.get(aih) || []
      const doctorNormList = doctorsNormByAihKey.get(aih) || []
      if (doctorIsAll) {
        const names = doctorList
          .map((cns) => {
            const cn = String(cns || '')
            return doctorByCns.get(cn)?.name || doctorByCnsNorm.get(normalizeDigits(cn))?.name || ''
          })
          .map(s => String(s || '').trim())
          .filter(Boolean)
        const uniqueNames = Array.from(new Set(names))
        out.push({ ...base, doctorCns: '', doctorName: uniqueNames.join(' / ') })
      } else {
        if (!desiredDoctorNorm) continue
        const matchedSp = doctorNormList.includes(desiredDoctorNorm)
        const matchedLocal = localDoctorNormByAihKey.get(aih) === desiredDoctorNorm
        if (!matchedSp && !matchedLocal) continue
        if (matchedSp) matchedBySp += 1
        else matchedByLocal += 1
        const nm = doctorByCnsNorm.get(desiredDoctorNorm)?.name || doctorByCns.get(filters.doctorCns)?.name || ''
        out.push({ ...base, doctorCns: filters.doctorCns, doctorName: nm })
      }
    }

    out.sort((a, b) => {
      const da = (a.dtSaida || '').localeCompare(b.dtSaida || '')
      if (da !== 0) return da
      const ha = (a.hospitalName || '').localeCompare(b.hospitalName || '')
      if (ha !== 0) return ha
      return (a.doctorName || '').localeCompare(b.doctorName || '')
    })

    const stats: TabwinReportStats = {
      aihsRd: rd.length,
      aihsWithSp: doctorsNormByAihKey.size,
      aihsMatchedDoctor: out.length,
      aihsMatchedDoctorBySp: matchedBySp,
      aihsMatchedDoctorByLocal: matchedByLocal
    }

    return { rows: out, stats }
  }

  ,
  async fetchRows(filters: TabwinReportFilters): Promise<TabwinReportRow[]> {
    const res = await SihTabwinReportService.fetchReport(filters)
    return res.rows
  }
}

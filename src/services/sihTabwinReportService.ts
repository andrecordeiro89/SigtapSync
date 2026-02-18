import { supabase } from '../lib/supabase'
import { supabaseSih } from '../lib/sihSupabase'

export type TabwinReportFilters = {
  hospitalId: string
  dischargeFrom?: string
  dischargeTo?: string
  doctorCns: string
  excludedHospitalIds?: string[]
}

export type TabwinReportRow = {
  aihNumber: string
  patientName?: string
  dtInter?: string
  dtSaida?: string
  competencia?: string
  hospitalName?: string
  doctorNameGsus?: string
  doctorCnsGsus?: string
  doctorNameTabwin?: string
  doctorCnsTabwin?: string
  isDivergent?: boolean
  conferenceStatus?: string
  isLocalOnly?: boolean
}

export type TabwinReportStats = {
  aihsRd: number
  aihsWithSp: number
  aihsMatchedDoctor: number
  aihsMatchedDoctorBySp: number
  aihsMatchedDoctorByLocal: number
  totalDivergent: number
}

export type TabwinReportResult = {
  rows: TabwinReportRow[]
  stats: TabwinReportStats
}

export type RejectedReportRow = {
  aihNumber: string
  patientName?: string
  hospitalName?: string
  dtSaida?: string
  competencia?: string
  valorTotal?: number
  procedimento?: string
  cid?: string
}

const chunk = <T>(arr: T[], size = 200): T[][] => {
  const out: T[][] = []
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size))
  return out
}

const normalizeDigits = (v: unknown): string => {
  return String(v ?? '').replace(/\D/g, '').replace(/^0+/, '')
}

// Removida função cnesVariants (não utilizada)

const normalizeCnes7 = (raw: unknown): string => {
  const digits = String(raw ?? '').replace(/\D/g, '')
  if (!digits) return ''
  return digits.padStart(7, '0').slice(-7)
}

// Interfaces para tipagem do retorno do Supabase
interface SihRdRow {
  n_aih: string
  hospital_id?: string
  cnes?: string
  dt_inter?: string
  dt_saida?: string
  ano_cmpt?: string
  mes_cmpt?: string
}

interface SihSpRow {
  sp_naih: string
  sp_pf_doc: string
}

interface SihRejeitadosRow {
  n_aih: string
  cnes: string
  dt_saida: string
  ano_cmpt: string
  mes_cmpt: string
  val_tot: number
  proc_rea: string
  diag_princ: string
  uf?: string
}

// Helper genérico para paginação (substitui duplicatas internas)
const fetchAll = async <T>(queryBuilder: any, pageSize = 1000, maxPages = 20): Promise<T[]> => {
  const all: T[] = []
  let page = 0
  while (page < maxPages) {
    const { data, error } = await queryBuilder.range(page * pageSize, (page + 1) * pageSize - 1)
    if (error) throw error
    if (!data || data.length === 0) break
    all.push(...data)
    if (data.length < pageSize) break
    page++
  }
  return all
}

const REJEITADOS_CNES_ALLOWLIST = [
  '2687011',
  '0887854',
  '0213845',
  '4820150',
  '2738368',
  '4388380',
  '7278608',
  '2877112',
  '0017574',
  '0018600'
]

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
    const startTime = performance.now()
    console.log('[TabwinReport] Iniciando geração do relatório...', filters)

    if (!supabaseSih) throw new Error('Fonte SIH remota não configurada')

    const hospitalIsAll = !filters.hospitalId || filters.hospitalId === 'all'
    const doctorIsAll = !filters.doctorCns || filters.doctorCns === 'all'
    const desiredDoctorNorm = normalizeDigits(filters.doctorCns)

    const endExclusive = endExclusiveFrom(filters.dischargeTo)
    const hasDateFilter = Boolean(filters.dischargeFrom || filters.dischargeTo)
    
    let selectedHospitalName = ''
    let selectedHospitalCnes = ''
    let selectedHospitalCnesVariants: string[] = []
    
    // 1. Resolver Hospital (ID e CNES)
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

    // Função auxiliar para buscar com paginação (evitar limite de 1000)
    // Utiliza o helper fetchAll global para evitar duplicação

    // 2. Busca Primária (SIH RD)
    const fetchRd = async (opts: { useCnesFallback: boolean }): Promise<SihRdRow[]> => {
      // Se for fallback de CNES e não tiver variantes, retorna vazio
      if (opts.useCnesFallback && selectedHospitalCnesVariants.length === 0) return []
      
      const selectCols = opts.useCnesFallback
        ? 'n_aih, hospital_id, cnes, dt_inter, dt_saida, ano_cmpt, mes_cmpt'
        : 'n_aih, hospital_id, dt_inter, dt_saida, ano_cmpt, mes_cmpt'
      
      let q = supabaseSih.from('sih_rd').select(selectCols)
      
      // Filtros de Hospital
      if (!hospitalIsAll) {
        if (opts.useCnesFallback) {
          q = q.in('cnes', selectedHospitalCnesVariants)
        } else {
          q = q.eq('hospital_id', filters.hospitalId)
        }
      }

      // Filtros de Data (SEMPRE APLICAR se existirem)
      if (filters.dischargeFrom) q = q.gte('dt_saida', filters.dischargeFrom)
      if (endExclusive) q = q.lt('dt_saida', endExclusive)
      if (hasDateFilter) q = q.not('dt_saida', 'is', null)

      // Ordenação padrão para garantir consistência na paginação
      q = q.order('dt_saida', { ascending: false })

      return await fetchAll<SihRdRow>(q)
    }

    let rdRaw: SihRdRow[] = []
    
    if (!hospitalIsAll) {
      // Tentativa 1: Busca por hospital_id (Chave Primária)
      rdRaw = await fetchRd({ useCnesFallback: false })
      
      // Tentativa 2: Fallback por CNES se a busca por ID não retornou nada
      if (rdRaw.length === 0) {
        rdRaw = await fetchRd({ useCnesFallback: true })
      }
    } else {
      // Todos os hospitais
      rdRaw = await fetchRd({ useCnesFallback: false })
    }

    // Filtragem em memória extra
    if (hasDateFilter) {
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

    const rdMap = new Map<string, SihRdRow>()
    const aihNumbersRaw = Array.from(new Set(rdRaw.map(r => String(r?.n_aih ?? '')).filter(Boolean)))
    for (const r of rdRaw) {
      const rawAih = String(r?.n_aih ?? '')
      const key = normalizeDigits(rawAih) || rawAih
      if (!key) continue
      if (!rdMap.has(key)) rdMap.set(key, r)
    }
    const rd = Array.from(rdMap.entries()).map(([aihKey, r]) => ({ ...r, __aih_key: aihKey }))
    if (aihNumbersRaw.length === 0) {
      // Mesmo sem resultados no Tabwin, precisamos verificar o LOCAL se houver filtro de médico
      // para mostrar os "Ausente Tabwin"
      console.log('[TabwinReport] Nenhum registro encontrado no Tabwin. Verificando local...')
    }

    // 3. Buscar Médicos Remotos (SIH SP)
    const spRows: SihSpRow[] = []
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
      if (spData && spData.length > 0) spRows.push(...(spData as unknown as SihSpRow[]))
    }

    // Map: AIH (norm) -> Lista de CNS (norm) do Tabwin
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

    // 4. Buscar Médicos Locais (GSUS AIHs) - SEMPRE buscar para todas as AIHs encontradas
    const localDoctorNormByAihKey = new Map<string, string>()
    const localDoctorRawByAihKey = new Map<string, string>()
    const patientNameByAihKey = new Map<string, string>()
    const missingPatientNameIds = new Set<string>()
    const missingPatientNameAihs = new Map<string, string>() // AIH Key -> Patient ID
    
    // 4.1 Busca Reversa: Encontrar AIHs que existem no Local mas NÃO no Tabwin
    const localOnlyAihs: any[] = []
    
    // Construir query local equivalente aos filtros
    let localQuery = supabase
      .from('aihs')
      .select('aih_number, patient_id, cns_responsavel, discharge_date, hospital_id')
    
    if (!hospitalIsAll) {
      localQuery = localQuery.eq('hospital_id', filters.hospitalId)
    }
    
    if (filters.dischargeFrom) localQuery = localQuery.gte('discharge_date', filters.dischargeFrom)
    if (endExclusive) localQuery = localQuery.lt('discharge_date', endExclusive)
    if (hasDateFilter) localQuery = localQuery.not('discharge_date', 'is', null)

    let localCandidates: any[] = []
    try {
        localCandidates = await fetchAll<any>(localQuery)
    } catch (localCandErr) {
        console.error('[TabwinReport] Erro na busca local reversa:', localCandErr)
    }

    if (localCandidates.length > 0) {
      console.log(`[TabwinReport] Busca reversa encontrou ${localCandidates.length} candidatos locais.`)
      
      for (const lc of localCandidates) {
        const rawAih = String(lc.aih_number || '')
        const key = normalizeDigits(rawAih) || rawAih
        if (!key) continue

        if (lc.patient_id) {
          missingPatientNameIds.add(String(lc.patient_id))
          missingPatientNameAihs.set(key, String(lc.patient_id))
        }

        const cnsRespRaw = lc.cns_responsavel
        const cnsRespNorm = normalizeDigits(cnsRespRaw)
        if (cnsRespNorm) {
          localDoctorNormByAihKey.set(key, cnsRespNorm)
          localDoctorRawByAihKey.set(key, String(cnsRespRaw))
        }
        
        // Se já existe no RD (Tabwin), ignorar (será processado pelo fluxo normal)
        if (rdMap.has(key)) continue
        
        // Verificar Filtro de Médico (APENAS RESPONSÁVEL)
        if (!doctorIsAll && desiredDoctorNorm) {
          // Se o responsável não for o médico filtrado, descarta
          if (cnsRespNorm !== desiredDoctorNorm) continue
        }

        // É somente local e passou no filtro!
        localOnlyAihs.push({ ...lc, __aih_key: key })
      }
    }

    // 4.2 Repescagem de Nomes de Pacientes (Fallback se o join falhou)
    if (missingPatientNameIds.size > 0) {
      const ids = Array.from(missingPatientNameIds)
      console.log(`[TabwinReport] Tentando repescar ${ids.length} nomes de pacientes faltantes via query direta...`)
      
      for (const ch of chunk(ids, 200)) {
        const { data: pats, error: patErr } = await supabase
          .from('patients')
          .select('id,name')
          .in('id', ch)
        
        if (!patErr && pats) {
          const patMap = new Map(pats.map((p: any) => [String(p.id), String(p.name)]))
          
          // Atualizar o mapa principal
          for (const [aihKey, patId] of missingPatientNameAihs.entries()) {
             if (patMap.has(patId)) {
                patientNameByAihKey.set(aihKey, patMap.get(patId)!)
             }
          }
        }
      }
    }

    // 5. Resolver Nomes de Médicos (Local DB)
    const hospById = new Map<string, { name?: string }>()
    const hospIds = Array.from(new Set([
      ...rd.map(r => String((r as any).hospital_id)),
      ...localOnlyAihs.map(r => String(r.hospital_id))
    ].filter(Boolean)))

    if (hospIds.length > 0) {
      const { data: localHospById, error: localHospByIdErr } = await supabase
        .from('hospitals')
        .select('id,name')
        .in('id', hospIds)
      if (localHospByIdErr) throw localHospByIdErr
      ;(localHospById || []).forEach((h: any) => hospById.set(String(h.id), { name: String(h.name || '') }))
    }

    // Coletar todos os CNS envolvidos
    const allCnsSet = new Set<string>()
    spRows.forEach(r => {
      const cns = normalizeDigits(r.sp_pf_doc)
      if (cns) allCnsSet.add(cns)
    })
    for (const cns of localDoctorNormByAihKey.values()) {
      if (cns) allCnsSet.add(cns)
    }
    if (desiredDoctorNorm) allCnsSet.add(desiredDoctorNorm)

    const doctorCnsNormSet = Array.from(allCnsSet)
    
    const doctorByCns = new Map<string, { name?: string }>()
    const doctorByCnsNorm = new Map<string, { name?: string; rawCns?: string }>()
    
    if (doctorCnsNormSet.length > 0) {
      for (const ch of chunk(doctorCnsNormSet, 200)) {
        const { data: docRows, error: docErr } = await supabase
          .from('doctors')
          .select('cns,name')
          .in('cns', ch)
        
        if (!docErr && docRows) {
          docRows.forEach((d: any) => {
            const rawCns = String(d.cns || '')
            doctorByCns.set(rawCns, { name: String(d.name || '') })
            const norm = normalizeDigits(rawCns)
            if (norm) doctorByCnsNorm.set(norm, { name: String(d.name || ''), rawCns })
          })
        }
      }
    }

    const out: TabwinReportRow[] = []
    let matchedBySp = 0
    let matchedByLocal = 0
    let totalDivergent = 0

    for (const r of rd) {
      const aih = String((r as any).__aih_key || normalizeDigits(r.n_aih) || r.n_aih || '')
      if (!aih) continue
      const hospId = String((r as any).hospital_id || '')
      const competencia = formatCompetencia(Number(r.ano_cmpt), Number(r.mes_cmpt))
      
      const base = {
        aihNumber: String((r as any).n_aih || aih),
        patientName: patientNameByAihKey.get(aih) || 'Paciente não encontrado',
        dtInter: formatDateBR(r.dt_inter ? String(r.dt_inter) : ''),
        dtSaida: formatDateBR(r.dt_saida ? String(r.dt_saida) : ''),
        competencia,
        hospitalName: hospById.get(hospId)?.name || (hospitalIsAll ? '' : selectedHospitalName)
      }

      // Dados Tabwin
      const tabwinCnsListNorm = doctorsNormByAihKey.get(aih) || []
      const tabwinCnsRawList = doctorsByAihKey.get(aih) || []
      
      // Dados Local (GSUS)
      const localCnsNorm = localDoctorNormByAihKey.get(aih)
      const localCnsRaw = localDoctorRawByAihKey.get(aih)

      // Resolver Nomes
      const tabwinNames: string[] = []

      if (tabwinCnsListNorm.length > 0) {
        tabwinCnsListNorm.forEach(cns => {
          const nm = doctorByCnsNorm.get(cns)?.name || doctorByCns.get(cns)?.name
          if (nm) tabwinNames.push(nm)
          else tabwinNames.push(`CNS: ${cns}`)
        })
      }

      // Se houver filtro, verifica se está na lista
      let isDesiredInTabwin = false
      if (desiredDoctorNorm && tabwinCnsListNorm.includes(desiredDoctorNorm)) {
        isDesiredInTabwin = true
      }
      
      const tabwinName = tabwinNames.join(' / ') || '—'
      
      const localName = localCnsNorm 
        ? (doctorByCnsNorm.get(localCnsNorm)?.name || `CNS: ${localCnsNorm}`) 
        : ''

      // Verificação de Filtro (Se médico selecionado)
      if (!doctorIsAll && desiredDoctorNorm) {
        const inLocal = localCnsNorm === desiredDoctorNorm
        
        if (!isDesiredInTabwin && !inLocal) continue

        if (isDesiredInTabwin) matchedBySp++
        if (inLocal) matchedByLocal++
      }

      // Verificação de Divergência
      let isDivergent = false
      if (localCnsNorm && tabwinCnsListNorm.length > 0) {
        if (!tabwinCnsListNorm.includes(localCnsNorm)) {
          isDivergent = true
          totalDivergent++
        }
      } else if (localCnsNorm && tabwinCnsListNorm.length === 0) {
        isDivergent = true
        totalDivergent++
      } else if (!localCnsNorm && tabwinCnsListNorm.length > 0) {
        isDivergent = true
        totalDivergent++
      }

      const conferenceStatus = isDivergent ? 'Divergente' : 'Confere'
      out.push({
        ...base,
        doctorNameGsus: localName || '—',
        doctorCnsGsus: localCnsRaw || localCnsNorm || '',
        doctorNameTabwin: tabwinName,
        doctorCnsTabwin: tabwinCnsRawList.join(', ') || '',
        isDivergent,
        conferenceStatus
      })
    }

    // Adicionar registros "Somente Local" (Ausentes no Tabwin)
    let addedLocalOnly = 0
    for (const la of localOnlyAihs) {
      const key = la.__aih_key
      
      const cnsRaw = la.cns_responsavel
      const cnsNorm = normalizeDigits(cnsRaw)
      
      let docName = '—'
      if (cnsNorm) {
         docName = doctorByCnsNorm.get(cnsNorm)?.name || `CNS: ${cnsRaw || cnsNorm}`
      } else if (cnsRaw) {
         docName = `CNS: ${cnsRaw}`
      }

      const hospName = hospById.get(String(la.hospital_id))?.name || (hospitalIsAll ? '' : selectedHospitalName)

      out.push({
        aihNumber: String(la.aih_number || ''),
        patientName: patientNameByAihKey.get(key) || 'Paciente não encontrado',
        dtInter: '—',
        dtSaida: formatDateBR(la.discharge_date),
        competencia: '',
        hospitalName: hospName,
        doctorNameGsus: docName,
        doctorCnsGsus: cnsRaw || '',
        doctorNameTabwin: '—',
        doctorCnsTabwin: '—',
        isDivergent: true,
        conferenceStatus: 'Ausente Tabwin',
        isLocalOnly: true
      })
      
      totalDivergent++
      addedLocalOnly++
    }
    
    if (addedLocalOnly > 0) {
      console.log(`[TabwinReport] Adicionados ${addedLocalOnly} registros locais que estavam ausentes no Tabwin.`)
    }

    const confOrder = (v?: string) => {
      if (v === 'Confere') return 0
      if (v === 'Divergente') return 1
      if (v === 'Ausente Tabwin') return 2
      return 3
    }
    out.sort((a, b) => {
      const ca = confOrder(a.conferenceStatus)
      const cb = confOrder(b.conferenceStatus)
      if (ca !== cb) return ca - cb

      const ha = (a.hospitalName || '').localeCompare(b.hospitalName || '')
      if (ha !== 0) return ha

      const da = (a.dtSaida || '').localeCompare(b.dtSaida || '')
      if (da !== 0) return da

      const pa = (a.patientName || '').localeCompare(b.patientName || '')
      if (pa !== 0) return pa

      return String(a.aihNumber || '').localeCompare(String(b.aihNumber || ''))
    })

    const endTime = performance.now()
    const duration = (endTime - startTime).toFixed(0)
    
    const countBoth = out.length - addedLocalOnly
    const countLocalOnly = addedLocalOnly
    
    console.log(`[TabwinReport] Concluído em ${duration}ms.`)
    
    const missingCountFinal = out.filter(r => r.patientName === 'Paciente não encontrado').length
    if (missingCountFinal > 0) {
        console.warn(`[TabwinReport] Atenção: ${missingCountFinal} AIHs permanecem sem nome de paciente no relatório final.`)
    }

    console.log(`[TabwinReport] Métricas Finais:`)
    console.log(`- Encontrados em Ambos (Tabwin + Local): ${countBoth}`)
    console.log(`- Apenas Local (Ausente Tabwin): ${countLocalOnly}`)
    console.log(`- Nomes Repescados via ID: ${missingPatientNameAihs.size}`)
    console.log(`- Total de Linhas: ${out.length}`)
    console.log(`- Divergentes Totais: ${totalDivergent}`)

    const stats: TabwinReportStats = {
      aihsRd: rd.length,
      aihsWithSp: doctorsNormByAihKey.size,
      aihsMatchedDoctor: out.length,
      aihsMatchedDoctorBySp: matchedBySp,
      aihsMatchedDoctorByLocal: matchedByLocal,
      totalDivergent
    }

    return { rows: out, stats }
  },

  async fetchRows(filters: TabwinReportFilters): Promise<TabwinReportRow[]> {
    const res = await SihTabwinReportService.fetchReport(filters)
    return res.rows
  },

  async fetchRejectedReport(filters?: TabwinReportFilters): Promise<RejectedReportRow[]> {
    if (!supabaseSih) throw new Error('Fonte SIH remota não configurada')

    const dischargeFrom = filters?.dischargeFrom
    const dischargeTo = filters?.dischargeTo
    const hospitalId = filters?.hospitalId
    const excludedHospitalIds = new Set((filters?.excludedHospitalIds || []).filter(Boolean))
    const allowedCnesSet = new Set(REJEITADOS_CNES_ALLOWLIST.map(normalizeCnes7).filter(Boolean))
    const allowedCnesQueryValues = Array.from(new Set(
      Array.from(allowedCnesSet).flatMap(c => [c, c.replace(/^0+/, '')]).filter(Boolean)
    ))

    // 1. Mapear Hospitais Locais (CNES -> Nome/ID)
    const { data: allHospitals, error: hospErr } = await supabase
      .from('hospitals')
      .select('id, name, cnes')
    
    if (hospErr) throw hospErr
    const hospMap = new Map<string, { id: string, name: string }>()
    ;(allHospitals || []).forEach(h => {
      const c = String(h.cnes || '').trim()
      const key = normalizeCnes7(c)
      if (!key) return
      if (!allowedCnesSet.has(key)) return
      hospMap.set(key, { id: h.id, name: String(h.name || '') })
    })

    const endExclusive = endExclusiveFrom(dischargeTo)

    const fetchRejectedRemote = async (): Promise<SihRejeitadosRow[]> => {
      const baseSelect = 'n_aih, cnes, dt_saida, ano_cmpt, mes_cmpt, val_tot, proc_rea, diag_princ'

      const tryFetch = async (from?: string, toExclusive?: string): Promise<SihRejeitadosRow[]> => {
        let q = supabaseSih
          .from('sih_rejeitados')
          .select(baseSelect)
          .eq('uf', 'PR')
          .in('cnes', allowedCnesQueryValues)
        if (from) q = q.gte('dt_saida', from)
        if (toExclusive) q = q.lt('dt_saida', toExclusive)
        q = q.order('dt_saida', { ascending: false })
        return await fetchAll<SihRejeitadosRow>(q)
      }

      const inMemoryFilter = (rows: SihRejeitadosRow[]): SihRejeitadosRow[] => {
        if (!dischargeFrom && !dischargeTo) return rows
        const fromIso = dischargeFrom ? toISODate(dischargeFrom) : ''
        const toIso = dischargeTo ? toISODate(dischargeTo) : ''
        return rows.filter(r => {
          const iso = toISODate(r?.dt_saida)
          if (!iso) return false
          if (fromIso && iso < fromIso) return false
          if (toIso && iso > toIso) return false
          return true
        })
      }

      const rows = await tryFetch(dischargeFrom, endExclusive)
      return inMemoryFilter(rows)
    }

    // 2. Buscar AIHs rejeitadas no SIH remoto (filtro por Data Alta: dt_saida)
    const rejRows = await fetchRejectedRemote()

    if (!rejRows || rejRows.length === 0) return []

    // 3. Filtrar por Hospital (CNES)
    // Se o CNES não existir no banco local, descarta (conforme solicitado)
    // Se tiver filtro de hospital, verifica se o ID bate
    const filteredRejRows = rejRows.filter(r => {
      const cnesKey = normalizeCnes7(r?.cnes)
      if (!cnesKey) return false
      if (!allowedCnesSet.has(cnesKey)) return false
      const localHosp = hospMap.get(cnesKey)
      if (!localHosp) return false

      if (hospitalId && hospitalId !== 'all') {
        if (localHosp.id !== hospitalId) return false
      } else if (excludedHospitalIds.size > 0) {
        if (excludedHospitalIds.has(localHosp.id)) return false
      }
      return true
    })
    if (filteredRejRows.length === 0) return []

    const groupByAih = new Map<string, any[]>()
    for (const r of filteredRejRows) {
      const key = normalizeDigits(r?.n_aih) || String(r?.n_aih || '')
      if (!key) continue
      if (!groupByAih.has(key)) groupByAih.set(key, [])
      groupByAih.get(key)!.push(r)
    }
    if (groupByAih.size === 0) return []

    // 4. Buscar nomes de Pacientes no banco local (AIH -> Patient Name), via número de AIH
    const patientMap = new Map<string, string>()
    const patientIds = new Set<string>()
    const aihKeyToPatientId = new Map<string, string>()

    try {
      const aihVariants = new Set<string>()
      for (const [key, rows] of groupByAih.entries()) {
        aihVariants.add(key)
        if (key.length > 1) aihVariants.add(`${key.slice(0, -1)}-${key.slice(-1)}`)
        for (const r of rows) {
          const raw = String(r?.n_aih || '').trim()
          if (raw) aihVariants.add(raw)
        }
      }

      for (const ch of chunk(Array.from(aihVariants), 200)) {
        let localQ = supabase
          .from('aihs')
          .select('aih_number, patient_id, hospital_id')
          .in('aih_number', ch)
        if (hospitalId && hospitalId !== 'all') localQ = localQ.eq('hospital_id', hospitalId)

        const { data: localRows, error: localErr } = await localQ
        if (localErr) throw localErr

        ;(localRows || []).forEach((a: any) => {
          if (excludedHospitalIds.size > 0 && hospitalId === 'all') {
            const hid = String(a?.hospital_id || '')
            if (hid && excludedHospitalIds.has(hid)) return
          }
          const key = normalizeDigits(a?.aih_number) || String(a?.aih_number || '')
          if (!key) return
          if (a.patient_id) {
            const pid = String(a.patient_id)
            patientIds.add(pid)
            aihKeyToPatientId.set(key, pid)
          }
        })
      }
    } catch (e) {
      console.error('[RejectedTabwin] Erro ao buscar AIHs locais para nomes:', e)
    }

    if (patientIds.size > 0) {
      try {
        const patsAll: any[] = []
        for (const ch of chunk(Array.from(patientIds), 200)) {
          const { data: pats, error: patErr } = await supabase.from('patients').select('id,name').in('id', ch)
          if (patErr) continue
          if (pats && pats.length > 0) patsAll.push(...pats)
        }
        const patMap = new Map(patsAll.map((p: any) => [String(p.id), String(p.name || '')]))
        for (const [aihKey, pid] of aihKeyToPatientId.entries()) {
          const nm = patMap.get(pid)
          if (nm) patientMap.set(aihKey, nm)
        }
      } catch (e) {
        console.error('[RejectedTabwin] Erro ao repescar nomes de pacientes:', e)
      }
    }

    // 5. Montar Resultado (agregando competências por AIH)
    const pickBestRow = (rows: any[]): any => {
      if (!rows || rows.length === 0) return {}
      const withIso = rows
        .map(r => ({ r, iso: toISODate(r?.dt_saida) }))
        .filter(x => x.iso)
      if (withIso.length === 0) return rows[0]
      withIso.sort((a, b) => b.iso.localeCompare(a.iso))
      return withIso[0].r
    }

    const formatCompKey = (r: any) => {
      const y = Number(r?.ano_cmpt)
      const m = Number(r?.mes_cmpt)
      if (!y || !m) return ''
      return `${String(m).padStart(2, '0')}/${String(y)}`
    }

    const out = Array.from(groupByAih.entries())
      .map(([key, rows]) => {
        const best = pickBestRow(rows)
        const comps = Array.from(new Set(rows.map(formatCompKey).filter(Boolean)))
          .map(c => {
            const [mm, yy] = c.split('/')
            return { c, mm: Number(mm), yy: Number(yy) }
          })
          .sort((a, b) => (a.yy - b.yy) || (a.mm - b.mm))
          .map(x => x.c)
        const competencia = comps.join(' e ')

        const cnesKey = normalizeCnes7(best?.cnes)
        const localHosp = cnesKey ? hospMap.get(cnesKey) : undefined
        return {
          aihNumber: String(best?.n_aih || ''),
          patientName: (key ? patientMap.get(key) : null) || 'Paciente não encontrado',
          hospitalName: localHosp?.name || `CNES: ${String(best?.cnes || '').trim()}`,
          dtSaida: formatDateBR(best?.dt_saida),
          competencia,
          valorTotal: Number(best?.val_tot || 0),
          procedimento: String(best?.proc_rea || ''),
          cid: String(best?.diag_princ || '')
        }
      })
      .sort((a, b) => {
        const ha = (a.hospitalName || '').localeCompare(b.hospitalName || '')
        if (ha !== 0) return ha
        const da = (a.dtSaida || '').localeCompare(b.dtSaida || '')
        if (da !== 0) return da
        return String(a.aihNumber || '').localeCompare(String(b.aihNumber || ''))
      })

    return out
  }
}

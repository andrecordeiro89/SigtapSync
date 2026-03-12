import { supabase } from '../lib/supabase'
import { supabaseSih } from '../lib/sihSupabase'
import { ENV_CONFIG, logger } from '../config/env'
import { formatSigtapCode } from '../utils/formatters'
import { getSigtapLocalMap } from '../utils/sigtapLocal'
import type { DoctorWithPatients, ProcedureDetail } from './doctorPatientService'

type LoadOptions = {
  hospitalIds?: string[]
  competencia?: string
  competencias?: string[]
  dischargeDateRange?: { from?: string; to?: string }
  filterCareCharacter?: '1' | '2' | string
}

const chunk = <T>(arr: T[], size = 80): T[][] => {
  const out: T[][] = []
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size))
  return out
}

export const SihApiAdapter = {
  async getDoctorsWithPatients(options: LoadOptions = {}): Promise<DoctorWithPatients[]> {
    if (!ENV_CONFIG.USE_SIH_SOURCE || !supabaseSih) {
      logger.warn('Fonte SIH remota desativada ou não configurada')
      return []
    }

    // 1) Mapear hospitalIds locais → CNES
    let cnesList: string[] | undefined
    if (options.hospitalIds && options.hospitalIds.length > 0 && !options.hospitalIds.includes('all')) {
      const { data: hospData, error: hospErr } = await supabase
        .from('hospitals')
        .select('id,cnes')
        .in('id', options.hospitalIds)
      if (hospErr) logger.warn('Erro ao carregar hospitais locais para CNES', hospErr)
      cnesList = (hospData || []).map(h => String(h.cnes)).filter(Boolean)
    }

    // 2) Carregar RD (AIHs)
    let rdQuery = supabaseSih
      .from('sih_rd')
      .select('n_aih, cnes, dt_inter, dt_saida, diag_princ, espec, ano_cmpt, mes_cmpt, complex, nasc, idade, dias_perm, val_tot, car_int')

    if (cnesList && cnesList.length > 0) rdQuery = rdQuery.in('cnes', cnesList)
    let compYear: number | undefined
    let compMonth: number | undefined
    if (options.competencias && options.competencias.length > 0) {
      // Multi-competência: build OR filter for each YYYYMM
      const compPairs = options.competencias.map(raw => {
        const m6 = raw.match(/^(\d{4})(\d{2})$/)
        if (m6) return { y: parseInt(m6[1], 10), m: parseInt(m6[2], 10) }
        const mDash = raw.match(/^(\d{4})-(\d{2})/)
        if (mDash) return { y: parseInt(mDash[1], 10), m: parseInt(mDash[2], 10) }
        return null
      }).filter(Boolean) as { y: number; m: number }[]
      if (compPairs.length === 1) {
        rdQuery = rdQuery.eq('ano_cmpt', compPairs[0].y).eq('mes_cmpt', compPairs[0].m)
      } else if (compPairs.length > 1) {
        const orClauses = compPairs.map(p => `and(ano_cmpt.eq.${p.y},mes_cmpt.eq.${p.m})`).join(',')
        rdQuery = rdQuery.or(orClauses)
      }
    } else if (options.competencia && options.competencia.trim()) {
      const raw = options.competencia.trim()
      // Normalizar competência para ano/mês (inteiros)
      if (/^\d{6}$/.test(raw)) {
        compYear = parseInt(raw.slice(0, 4), 10)
        compMonth = parseInt(raw.slice(4, 6), 10)
      } else {
        const m = raw.match(/^(\d{4})-(\d{2})/)
        if (m) {
          compYear = parseInt(m[1], 10)
          compMonth = parseInt(m[2], 10)
        }
      }
      if (typeof compMonth === 'number') {
        rdQuery = rdQuery.eq('mes_cmpt', compMonth)
      }
      if (typeof compYear === 'number') {
        rdQuery = rdQuery.eq('ano_cmpt', compYear)
      }
    }

    // Filtro por período de alta (dt_saida)
    if (options.dischargeDateRange && (options.dischargeDateRange.from || options.dischargeDateRange.to)) {
      const from = options.dischargeDateRange.from || undefined
      const to = options.dischargeDateRange.to || undefined
      // Exclusivo em "to": somar +1 dia para incluir o dia inteiro
      const endExclusive = to ? new Date(to) : undefined
      if (endExclusive) endExclusive.setDate(endExclusive.getDate() + 1)
      if (from) rdQuery = rdQuery.gte('dt_saida', from)
      if (endExclusive) rdQuery = rdQuery.lt('dt_saida', endExclusive.toISOString().slice(0, 10))
      rdQuery = rdQuery.not('dt_saida', 'is', null)
    }

    // Filtro por Caráter de Atendimento (car_int) – valores no SIH são '01' e '02'
    if (options.filterCareCharacter) {
      const raw = String(options.filterCareCharacter).trim()
      const carIntValue = raw === '1' ? '01' : raw === '2' ? '02' : raw
      rdQuery = rdQuery.eq('car_int', carIntValue)
    }

    const { data: rdData, error: rdError } = await rdQuery
    if (rdError) {
      logger.error('Erro ao consultar sih_rd', rdError)
      return []
    }
    
    // 🔍 DEBUG: Verificar dados brutos do sih_rd
    if (rdData && rdData.length > 0) {
      console.log('🔍 [SihApiAdapter] Amostra de dados sih_rd (primeiro registro):', {
        n_aih: rdData[0].n_aih,
        espec: rdData[0].espec,
        car_int: rdData[0].car_int,
        diag_princ: rdData[0].diag_princ
      });
    }

    const aihNumbers = Array.from(new Set((rdData || []).map(r => String(r.n_aih)).filter(Boolean)))
    if (aihNumbers.length === 0) return []

    // 3) Carregar SP (procedimentos) por chunks de AIH
    const spChunks = chunk(aihNumbers, 80)
    const spResults: any[] = []
    for (const ch of spChunks) {
      const spQuery = supabaseSih
        .from('sih_sp')
        .select('sp_naih, sp_atoprof, sp_qt_proc, sp_qtd_ato, sp_valato, sp_ptsp, sp_pf_doc, sp_pf_cbo, sp_cidpri, sp_complex, sp_dtsaida')
        .in('sp_naih', ch)
      const { data: spData, error: spError } = await spQuery
      if (spError) logger.warn('Erro chunk sih_sp', spError)
      if (spData && spData.length > 0) spResults.push(...spData)
    }

    // 4) Mapear hospitais locais por CNES para id/nome
    const cnesSet = Array.from(new Set((rdData || []).map(r => String(r.cnes)).filter(Boolean)))
    const { data: localHosp, error: localHospErr } = await supabase
      .from('hospitals')
      .select('id,name,cnes')
      .in('cnes', cnesSet)
    if (localHospErr) logger.warn('Erro ao mapear hospitais locais', localHospErr)
    const hospByCnes = new Map((localHosp || []).map(h => [String(h.cnes), h]))

    // 5) Carregar AIHs locais correspondentes para obter CNS responsável e dados de paciente
    let localAihQuery = supabase
      .from('aihs')
      .select('id, aih_number, cns_responsavel, hospital_id, discharge_date, competencia, patients(name, medical_record)')
    const localHospitalIds = Array.from(new Set((rdData || []).map(r => String(r.cnes)).filter(Boolean))).map(c => hospByCnes.get(String(c))?.id).filter(Boolean) as string[]
    if (localHospitalIds.length > 0) localAihQuery = localAihQuery.in('hospital_id', localHospitalIds)
    // Aplicar filtros primários (competência e período de alta) para priorizar nomes do recorte atual
    if (typeof compYear === 'number' && typeof compMonth === 'number') {
      const compISO = `${String(compYear).padStart(4, '0')}-${String(compMonth).padStart(2, '0')}-01`
      localAihQuery = localAihQuery.eq('competencia', compISO)
    }
    if (options.dischargeDateRange && (options.dischargeDateRange.from || options.dischargeDateRange.to)) {
      const from = options.dischargeDateRange.from || undefined
      const to = options.dischargeDateRange.to || undefined
      const endExclusive = to ? new Date(to) : undefined
      if (endExclusive) endExclusive.setDate(endExclusive.getDate() + 1)
      if (from) localAihQuery = localAihQuery.gte('discharge_date', from)
      if (endExclusive) localAihQuery = localAihQuery.lt('discharge_date', endExclusive.toISOString().slice(0, 10))
      localAihQuery = localAihQuery.not('discharge_date', 'is', null)
    }
    const { data: localAihRows } = await localAihQuery
    const normalizeAih = (s: string) => s.replace(/\D/g, '').replace(/^0+/, '')
    const localRespByAih = new Map<string, string>()
    const localPatientByAih = new Map<string, { name?: string; medical_record?: string }>()
    const localAihIdByAihKey = new Map<string, string>()
    const localAihKeyByAihId = new Map<string, string>()
      ; (localAihRows || []).forEach((r: any) => {
        const k = normalizeAih(String(r.aih_number || ''))
        if (!k) return
        if (r.cns_responsavel) localRespByAih.set(k, String(r.cns_responsavel))
        const nm = r?.patients?.name
        const mr = r?.patients?.medical_record
        if (nm || mr) localPatientByAih.set(k, { name: nm, medical_record: mr })
        const aihId = String(r.id || '').trim()
        if (aihId) {
          if (!localAihIdByAihKey.has(k)) localAihIdByAihKey.set(k, aihId)
          if (!localAihKeyByAihId.has(aihId)) localAihKeyByAihId.set(aihId, k)
        }
      })

    // Fallback: completar nomes por AIH sem respeitar competência/alta, usando a lista de AIHs remotas
    const missingKeys = aihNumbers
      .map(n => normalizeAih(String(n)))
      .filter(k => k && !localPatientByAih.has(k))
    if (missingKeys.length > 0) {
      const variants = Array.from(new Set(missingKeys.flatMap(k => {
        const raw = String(k || '').replace(/\D/g, '').replace(/^0+/, '')
        if (!raw) return []
        return [raw, raw.padStart(12, '0'), raw.padStart(13, '0')]
      }))).filter(Boolean)
      const { data: localAihByNumber } = await supabase
        .from('aihs')
        .select('id, aih_number, patients(name, medical_record), cns_responsavel')
        .in('aih_number', variants)
        ; (localAihByNumber || []).forEach((r: any) => {
          const k = normalizeAih(String(r.aih_number || ''))
          if (!k) return
          const nm = r?.patients?.name
          const mr = r?.patients?.medical_record
          if (nm || mr) localPatientByAih.set(k, { name: nm, medical_record: mr })
          const resp = r?.cns_responsavel
          if (resp && !localRespByAih.has(k)) localRespByAih.set(k, String(resp))
          const aihId = String(r.id || '').trim()
          if (aihId) {
            if (!localAihIdByAihKey.has(k)) localAihIdByAihKey.set(k, aihId)
            if (!localAihKeyByAihId.has(aihId)) localAihKeyByAihId.set(aihId, k)
          }
        })
    }

    const procCodesRaw = Array.from(new Set(spResults.map(p => String(p.sp_atoprof)).filter(Boolean)))
    const procCodes = procCodesRaw.map(formatSigtapCode)
    const procCodesPlain = procCodes.map(c => c.replace(/\D/g, ''))
    const localCsvMap = await getSigtapLocalMap()
    let remoteDescMap = new Map<string, string>()
    if (supabaseSih) {
      const { data: remoteProcRows } = await supabaseSih
        .from('sigtap_procedimentos')
        .select('code, description')
        .in('code', Array.from(new Set([...procCodes, ...procCodesPlain])))
      if (remoteProcRows && remoteProcRows.length > 0) {
        remoteDescMap = new Map(remoteProcRows.map(r => [String(r.code), String(r.description)]))
      }
    }

    // 6) Agrupar por médico (CNS do profissional do SP)
    const spByAih = new Map<string, any[]>()
    spResults.forEach(row => {
      const key = String(row.sp_naih)
      if (!spByAih.has(key)) spByAih.set(key, [])
      spByAih.get(key)!.push(row)
    })

    // 6.1) Fallback local: se a AIH veio do RD mas não tem SP no remoto, buscar procedimentos no banco local
    const aihKeysMissingSp = new Set<string>()
    const localAihIdsMissingSp = new Set<string>()
    for (const rd of rdData || []) {
      const aih = String((rd as any).n_aih || '')
      const key = normalizeAih(aih)
      if (!key) continue
      const procs = spByAih.get(aih) || []
      if (procs.length > 0) continue
      aihKeysMissingSp.add(key)
      const localId = localAihIdByAihKey.get(key)
      if (localId) localAihIdsMissingSp.add(localId)
    }

    const localFallbackProcsByAihKey = new Map<string, ProcedureDetail[]>()
    if (localAihIdsMissingSp.size > 0) {
      try {
        const { ProcedureRecordsService } = await import('./simplifiedProcedureService')
        const { getCalculableProcedures } = await import('../utils/anesthetistLogic')
        const localProcsByAih = await ProcedureRecordsService.getProceduresByAihIds(Array.from(localAihIdsMissingSp))
        if (localProcsByAih.success) {
          for (const [aihId, procs] of localProcsByAih.proceduresByAihId.entries()) {
            const aihKey = localAihKeyByAihId.get(String(aihId))
            if (!aihKey) continue
            const mapped = (procs || []).map((p: any) => {
              const code = String(p.procedure_code || '').trim()
              const cbo = String(p.professional_cbo || '').trim()
              const isAnesthetist04 = cbo === '225151' && code.startsWith('04') && code !== '04.17.01.001-0'
              const rawCents = typeof p.total_value === 'number' ? p.total_value : 0
              const value_cents = isAnesthetist04 ? 0 : rawCents
              return {
                procedure_id: String(p.id || ''),
                procedure_code: code,
                procedure_description: String(p.procedure_description || p.procedure_name || '').trim(),
                procedure_date: String(p.procedure_date || ''),
                value_reais: value_cents / 100,
                value_cents,
                approved: p.billing_status === 'approved' || p.match_status === 'approved' || p.billing_status === 'paid',
                approval_status: p.billing_status || p.match_status,
                sequence: (typeof p.sequencia === 'number' ? p.sequencia : undefined),
                aih_id: String(p.aih_id || ''),
                match_confidence: Number(p.match_confidence || 0),
                sigtap_description: String(p.procedure_description || p.procedure_name || '').trim(),
                complexity: String(p.complexity || ''),
                professional_name: p.professional_name ? String(p.professional_name) : undefined,
                cbo,
                participation: String(p.participacao || '').trim() || 'Responsável',
                registration_instrument: (p as any)?.sigtap_procedures?.registration_instrument || '-'
              } as any
            })
            const calculable = getCalculableProcedures(mapped as any)
            localFallbackProcsByAihKey.set(aihKey, (calculable as any[]) as any)
          }
        }
      } catch (e) {
        logger.warn('Erro ao buscar procedimentos locais (fallback SIH RD)', e as any)
      }
    }

    const doctorsMap = new Map<string, DoctorWithPatients & { hospitalIds: Set<string> }>()

    // Pré-carregar dados de médicos locais por CNS
    const doctorCnsAll = Array.from(new Set(spResults.map(r => String(r.sp_pf_doc)).filter(Boolean)))
    const localCnsAll = Array.from(new Set(Array.from(localRespByAih.values()).filter(Boolean)))
    const { data: localDoctors } = await supabase
      .from('doctors')
      .select('id,name,cns,crm,specialty,cbo_codes')
      .in('cns', Array.from(new Set([...doctorCnsAll, ...localCnsAll])))

    const doctorByCns = new Map((localDoctors || []).map(d => [String(d.cns), d]))

    // 7) Montar hierarquia: médico → AIH (como paciente) → procedimentos
    for (const rd of rdData || []) {
      const aih = String(rd.n_aih)
      const aihKey = normalizeAih(aih)
      const cnes = String(rd.cnes)
      const hosp = hospByCnes.get(cnes)
      const procs = spByAih.get(aih) || []

      const pickPreferredDoctorCns = (list: any[]): string => {
        let best: { cns: string; is04: boolean; weight: number; idx: number } | null = null
        for (let i = 0; i < list.length; i++) {
          const row = list[i]
          const cns = String(row?.sp_pf_doc || '').trim()
          if (!cns) continue
          const code = formatSigtapCode(String(row?.sp_atoprof || ''))
          const is04 = code.startsWith('04')
          const ptspRaw = Number(row?.sp_ptsp)
          const valRaw = Number(row?.sp_valato)
          const weight = Number.isFinite(ptspRaw) ? ptspRaw : (Number.isFinite(valRaw) ? valRaw : 0)
          if (!best) {
            best = { cns, is04, weight, idx: i }
            continue
          }
          if (is04 !== best.is04) {
            if (is04) best = { cns, is04, weight, idx: i }
            continue
          }
          if (weight !== best.weight) {
            if (weight > best.weight) best = { cns, is04, weight, idx: i }
            continue
          }
        }
        return best?.cns || (String(list?.[0]?.sp_pf_doc || '').trim() || '')
      }

      const preferredDoctorCns = procs.length > 0 ? pickPreferredDoctorCns(procs) : ''
      const localResp = localRespByAih.get(aihKey)

      // Construir procedimentos detalhados
      let procedures: ProcedureDetail[] = []
      if (procs.length > 0) {
        procedures = procs.map((p, idx) => {
          const rawCode = String(p.sp_atoprof || '')
          const code = formatSigtapCode(rawCode)
          const csvDesc = remoteDescMap.get(code) || remoteDescMap.get(code.replace(/\D/g, '')) || localCsvMap.get(code) || localCsvMap.get(code.replace(/\D/g, ''))
          const valueCents = Math.round(Number(p.sp_valato || 0) * 100)
          const quantity = Number(p.sp_qtd_ato ?? p.sp_qt_proc ?? 1) || 1
          return {
            procedure_id: `${aih}-${code}-${idx}`,
            procedure_code: code,
            procedure_description: csvDesc || '',
            procedure_date: String(rd.dt_inter || ''),
            value_reais: valueCents / 100,
            value_cents: valueCents,
            quantity,
            cid_primary: String(p.sp_cidpri || ''),
            approved: undefined,
            approval_status: undefined,
            sequence: idx + 1,
            aih_id: undefined,
            match_confidence: undefined,
            sigtap_description: csvDesc,
            complexity: String(p.sp_complex || ''),
            professional_name: doctorByCns.get(String(p.sp_pf_doc))?.name || undefined,
            cbo: String(p.sp_pf_cbo || ''),
            participation: 'Responsável',
            registration_instrument: '-',
            sigtap_procedures: {
              code,
              description: csvDesc || '',
              value_hosp_total: valueCents,
              complexity: String(p.sp_complex || '')
            } as any
          }
        })
      } else {
        const fallback = localFallbackProcsByAihKey.get(aihKey)
        if (fallback && fallback.length > 0) procedures = fallback
      }

      const patientLocalInfo = localPatientByAih.get(aihKey)
      const patientEntry = {
        patient_id: undefined,
        aih_id: undefined,
        patient_info: {
          name: patientLocalInfo?.name || 'Nome não disponível',
          cns: '',
          birth_date: String(rd.nasc || ''),
          gender: '',
          medical_record: patientLocalInfo?.medical_record || '-',
          age: Number(rd.idade || 0)
        },
        aih_info: {
          admission_date: String(rd.dt_inter || ''),
          discharge_date: String(rd.dt_saida || ''),
          aih_number: aih,
          care_character: String(rd.car_int || ''),
          hospital_id: hosp?.id,
          competencia: (() => {
            const yy = String(rd.ano_cmpt || '').padStart(4, '0')
            const mm = String(rd.mes_cmpt || '').padStart(2, '0')
            return yy && mm ? `${yy}-${mm}-01` : ''
          })(),
          cns_responsavel: localResp || undefined,
          pgt_adm: undefined,
          main_cid: String(rd.diag_princ || ''),
          specialty: String(rd.espec || ''),
          dias_perm: Number(rd.dias_perm || 0)
        },
        total_value_reais: Number(rd.val_tot || 0),
        procedures,
        total_procedures: procedures.length,
        approved_procedures: procedures.filter(pp => pp.approved).length,
        common_name: null
      }

      const assignSource: 'TABWIN' | 'GSUS' = preferredDoctorCns ? 'TABWIN' : (localResp ? 'GSUS' : 'TABWIN')
      const assignList = preferredDoctorCns ? [preferredDoctorCns] : (localResp ? [localResp] : ['NAO_IDENTIFICADO'])
      for (const dcns of assignList) {
        if (!doctorsMap.has(dcns)) {
          const d = doctorByCns.get(dcns)
          doctorsMap.set(dcns, {
            doctor_info: {
              name: d?.name || (dcns === 'NAO_IDENTIFICADO' ? '⚠️ Médico Não Identificado' : `Dr(a). CNS ${dcns}`),
              cns: dcns,
              crm: d?.crm || '',
              specialty: d?.specialty || '',
              cbo_codes: d?.cbo_codes || []
            },
            hospitals: [],
            patients: [],
            hospitalIds: new Set<string>()
          } as any)
        }
        const entry = doctorsMap.get(dcns) as any
        if (hosp?.id) entry.hospitalIds.add(hosp.id)
        const nextEntry = {
          ...patientEntry,
          aih_info: {
            ...(patientEntry as any).aih_info,
            cns_responsavel: dcns || (patientEntry as any)?.aih_info?.cns_responsavel,
            doctor_source: assignSource
          }
        }
        entry.patients.push(nextEntry)
      }
    }

    // Finalizar hospitais e retornar
    const result: DoctorWithPatients[] = Array.from(doctorsMap.values()).map((d: any) => {
      const hospitals = Array.from(d.hospitalIds || []).map((hid: string) => {
        const h = (localHosp || []).find(x => x.id === hid)
        return {
          hospital_id: hid,
          hospital_name: h?.name || '',
          is_active: true
        } as any
      })
      return {
        doctor_info: d.doctor_info,
        hospitals,
        patients: d.patients
      }
    })

    return result
  }
}


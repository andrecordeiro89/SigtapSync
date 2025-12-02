import { supabase } from '../lib/supabase'
import { supabaseSih } from '../lib/sihSupabase'
import { ENV_CONFIG, logger } from '../config/env'
import { formatSigtapCode } from '../utils/formatters'
import { getSigtapLocalMap } from '../utils/sigtapLocal'
import type { DoctorWithPatients, ProcedureDetail } from './doctorPatientService'

type LoadOptions = {
  hospitalIds?: string[]
  competencia?: string
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
      .select('n_aih, cnes, dt_inter, dt_saida, diag_princ, espec, mes_cmpt, complex, nasc, idade, val_tot, car_int')

    if (cnesList && cnesList.length > 0) rdQuery = rdQuery.in('cnes', cnesList)
    if (options.competencia && options.competencia.trim()) {
      const comp = options.competencia.trim()
      if (/^\d{6}$/.test(comp)) {
        rdQuery = rdQuery.eq('mes_cmpt', Number(comp))
      } else if (/^\d{4}-\d{2}(-\d{2})?$/.test(comp)) {
        rdQuery = rdQuery.eq('competencia', comp)
      }
    }

    const { data: rdData, error: rdError } = await rdQuery
    if (rdError) {
      logger.error('Erro ao consultar sih_rd', rdError)
      return []
    }
    const aihNumbers = Array.from(new Set((rdData || []).map(r => String(r.n_aih)).filter(Boolean)))
    if (aihNumbers.length === 0) return []

    // 3) Carregar SP (procedimentos) por chunks de AIH
    const spChunks = chunk(aihNumbers, 80)
    const spResults: any[] = []
    for (const ch of spChunks) {
      const { data: spData, error: spError } = await supabaseSih
        .from('sih_sp')
        .select('sp_naih, sp_atoprof, sp_qt_proc, sp_valato, sp_pf_doc, sp_pf_cbo, sp_cidpri, sp_complex')
        .in('sp_naih', ch)
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

    const procCodesRaw = Array.from(new Set(spResults.map(p => String(p.sp_atoprof)).filter(Boolean)))
    const procCodes = procCodesRaw.map(formatSigtapCode)
    const localCsvMap = await getSigtapLocalMap()
    let remoteDescMap = new Map<string, string>()
    if (supabaseSih) {
      const { data: remoteProcRows } = await supabaseSih
        .from('sigtap_procedimentos')
        .select('code, description')
        .in('code', procCodes)
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

    const doctorsMap = new Map<string, DoctorWithPatients & { hospitalIds: Set<string> }>()

    // Pré-carregar dados de médicos locais por CNS
    const doctorCnsAll = Array.from(new Set(spResults.map(r => String(r.sp_pf_doc)).filter(Boolean)))
    const { data: localDoctors } = await supabase
      .from('doctors')
      .select('id,name,cns,crm,specialty')
      .in('cns', doctorCnsAll)

    const doctorByCns = new Map((localDoctors || []).map(d => [String(d.cns), d]))

    // 7) Montar hierarquia: médico → AIH (como paciente) → procedimentos
    for (const rd of rdData || []) {
      const aih = String(rd.n_aih)
      const cnes = String(rd.cnes)
      const hosp = hospByCnes.get(cnes)
      const procs = spByAih.get(aih) || []

      // Cada AIH pode aparecer para múltiplos médicos (cada profissional do SP)
      const doctorCnsInAih = Array.from(new Set(procs.map(p => String(p.sp_pf_doc)).filter(Boolean)))

      // Construir procedimentos detalhados
      const procedures: ProcedureDetail[] = procs.map((p, idx) => {
        const rawCode = String(p.sp_atoprof || '')
        const code = formatSigtapCode(rawCode)
        const csvDesc = remoteDescMap.get(code) || remoteDescMap.get(code.replace(/\D/g, '')) || localCsvMap.get(code) || localCsvMap.get(code.replace(/\D/g, ''))
        const valueCents = Math.round(Number(p.sp_valato || 0) * 100)
        return {
          procedure_id: `${aih}-${code}-${idx}`,
          procedure_code: code,
          procedure_description: csvDesc || '',
          procedure_date: String(rd.dt_inter || ''),
          value_reais: valueCents / 100,
          value_cents: valueCents,
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

      const patientEntry = {
        patient_id: undefined,
        aih_id: undefined,
        patient_info: {
          name: 'Nome não disponível',
          cns: '',
          birth_date: String(rd.nasc || ''),
          gender: '',
          medical_record: '-'
        },
        aih_info: {
          admission_date: String(rd.dt_inter || ''),
          discharge_date: String(rd.dt_saida || ''),
          aih_number: aih,
          care_character: String(rd.car_int || ''),
          hospital_id: hosp?.id,
          competencia: String(rd.mes_cmpt || ''),
          pgt_adm: undefined
        },
        total_value_reais: Number(rd.val_tot || 0),
        procedures,
        total_procedures: procedures.length,
        approved_procedures: procedures.filter(pp => pp.approved).length,
        common_name: null
      }

      // Anexar a AIH ao(s) médico(s) da SP
      for (const dcns of doctorCnsInAih.length > 0 ? doctorCnsInAih : ['NAO_IDENTIFICADO']) {
        if (!doctorsMap.has(dcns)) {
          const d = doctorByCns.get(dcns)
          doctorsMap.set(dcns, {
            doctor_info: {
              name: d?.name || (dcns === 'NAO_IDENTIFICADO' ? '⚠️ Médico Não Identificado' : `Dr(a). CNS ${dcns}`),
              cns: dcns,
              crm: d?.crm || '',
              specialty: d?.specialty || ''
            },
            hospitals: [],
            patients: [],
            hospitalIds: new Set<string>()
          } as any)
        }
        const entry = doctorsMap.get(dcns) as any
        if (hosp?.id) entry.hospitalIds.add(hosp.id)
        entry.patients.push({ ...patientEntry })
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


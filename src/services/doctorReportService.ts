import { DoctorsHierarchyV2Service } from './doctorsHierarchyV2'
import { shouldCalculateAnesthetistProcedure } from '../utils/anesthetistLogic'
import {
  calculateDoctorPayment,
  calculatePercentagePayment,
  calculateFixedPayment,
  type ProcedurePaymentInfo,
} from '../config/doctorPaymentRules'

export interface ReportFilters {
  hospitalIds?: string[]
  dateFromISO?: string
  dateToISO?: string
  // Filtro adicional: Especialidade de Atendimento (AIH)
  careSpecialty?: string
}

export interface PatientReportItem {
  patientId: string
  patientName: string
  medicalRecord?: string
  aihNumber?: string
  aihTotalReais: number
  aihCareSpecialty?: string
  procedures04: Array<ProcedurePaymentInfo>
  doctorReceivableReais: number
  appliedRule: string
  admissionDateISO?: string
  dischargeDateISO?: string
}

export interface DoctorPatientReport {
  doctorName: string
  filters: ReportFilters
  items: PatientReportItem[]
  totals: {
    patients: number
    aihTotalReais: number
    doctorReceivableReais: number
  }
}

/**
 * Gera relatório por médico: Pacientes atendidos, valor da AIH e valor a receber por paciente conforme regras.
 * - Usa TODOS os procedimentos associados (hierarquia V2 já não filtra nada)
 * - Cálculo sobre procedimentos 04.* não-anestesia (exceto cesariana), conforme shouldCalculateAnesthetistProcedure
 * - Precedência de regras: percentual (se existir) substitui regras individuais/combinações
 */
export async function getDoctorPatientReport(
  doctorName: string,
  filters: ReportFilters = {}
): Promise<DoctorPatientReport> {
  const normalize = (s: string): string =>
    (s || '')
      .normalize('NFD')
      .replace(/\p{Diacritic}/gu, '')
      .trim()
      .toUpperCase()

  // Extrai Especialidade de Atendimento da AIH considerando variações de chave
  const getPatientCareSpecialty = (patient: any): string => {
    const aih = (patient?.aih_info || {}) as Record<string, unknown>
    const raw = (
      (aih as any).specialty ??
      (aih as any).especialidade ??
      (aih as any).care_specialty ??
      (aih as any).careSpecialty ??
      (aih as any).especialidade_atendimento ??
      (aih as any).EspecialidadeAtendimento ??
      (aih as any).Specialty ??
      (aih as any).ESPECIALIDADE ??
      ''
    ) as string
    return (raw || '').toString()
  }

  // Data de referência do paciente (alta preferencialmente; senão internação)
  const getPatientReferenceDateISO = (patient: any): string | undefined => {
    const aih = (patient?.aih_info || {}) as Record<string, unknown>
    const discharge = (aih as any).discharge_date as string | undefined
    const admission = (aih as any).admission_date as string | undefined
    return discharge || admission || undefined
  }

  const hierarchy = await DoctorsHierarchyV2Service.getDoctorsHierarchyV2(filters)

  // Normalizar comparação por nome (maiusc.)
  const targetName = (doctorName || '').trim().toUpperCase()
  const doctorCards = hierarchy.filter(
    (c) => (c.doctor_info?.name || '').trim().toUpperCase() === targetName
  )

  // Agregar por aih_id para garantir granularidade por AIH (Match por nº AIH)
  const patientMap = new Map<string, typeof doctorCards[number]['patients'][number]>()
  for (const card of doctorCards) {
    for (const p of card.patients || []) {
      // ✅ CORREÇÃO CRÍTICA: Usar aih_id como chave primária
      // O usuário especificou: "matches por nº de aihs".
      // Se usarmos patient_id, mesclamos AIHs diferentes do mesmo paciente, perdendo a rastreabilidade.
      const uniqueKey = (p as any).aih_id || (p as any).patient_id
      
      if (!uniqueKey) continue
      
      // Como cada item vindo da V2 já representa uma AIH única com seus procedimentos,
      // não devemos fazer merge. Se houver colisão de aih_id, é um erro de dados ou duplicata real.
      if (!patientMap.has(uniqueKey)) {
        patientMap.set(uniqueKey, p)
      }
    }
  }

  const items: PatientReportItem[] = []

  // 🔥 VERIFICAR SE MÉDICO TEM REGRA DE PAGAMENTO FIXO (antes do loop)
  const hospitalId = doctorCards[0]?.hospitals?.[0]?.hospital_id
  const fixedPaymentCalc = calculateFixedPayment(doctorName, hospitalId)

  for (const [patientId, patient] of patientMap.entries()) {
    // Aplicar filtro por período, se fornecido
    if (filters.dateFromISO && filters.dateToISO) {
      const refISO = getPatientReferenceDateISO(patient)
      if (refISO) {
        const d = new Date(refISO).getTime()
        const from = new Date(filters.dateFromISO).getTime()
        const to = new Date(filters.dateToISO).getTime()
        if (isFinite(d) && isFinite(from) && isFinite(to)) {
          if (d < from || d > to) continue
        }
      }
    }

    // Aplicar filtro por Especialidade de Atendimento, se fornecido
    const careSpecFilter = (filters.careSpecialty || '').trim()
    if (careSpecFilter) {
      const patientCareSpec = getPatientCareSpecialty(patient)
      if (!patientCareSpec || normalize(patientCareSpec) !== normalize(careSpecFilter)) {
        continue
      }
    }

    const aihTotalReais = Number(patient.total_value_reais || 0)

    // Selecionar procedimentos 04.* relevantes para cálculo (exclui anestesista 04.xxx)
    const procedures04: ProcedurePaymentInfo[] = (patient.procedures || [])
      .filter((proc: any) => {
        const code = (proc.procedure_code || '').toString()
        const include = code.startsWith('04') && shouldCalculateAnesthetistProcedure(proc.cbo || proc.professional_cbo, code)
        return include
      })
      .map((proc: any) => ({
        procedure_code: proc.procedure_code,
        procedure_description: proc.procedure_description,
        value_reais: Number(proc.value_reais || 0),
      }))

    // ✅ CALCULAR VALOR POR PACIENTE (será zero se médico tem pagamento fixo)
    let doctorReceivableReais = 0
    let appliedRule = ''

    if (fixedPaymentCalc.hasFixedRule) {
      // 🔒 PAGAMENTO FIXO: Não atribuir valor por paciente (será calculado no total)
      doctorReceivableReais = 0
      appliedRule = fixedPaymentCalc.appliedRule
    } else {
      // Regras específicas por procedimento
      const perProcedureCalc = calculateDoctorPayment(doctorName, procedures04)

      // Regra de percentual (quando existir) – base padrão: soma dos procedimentos 04 calculáveis
      const baseProceduresSum = procedures04.reduce((s, p) => s + (p.value_reais || 0), 0)
      const percentageCalc = calculatePercentagePayment(doctorName, baseProceduresSum)

      // Precedência: percentual substitui cálculo individual (conforme regra de negócio)
      doctorReceivableReais = percentageCalc.hasPercentageRule
        ? percentageCalc.calculatedPayment
        : perProcedureCalc.totalPayment

      appliedRule = percentageCalc.hasPercentageRule
        ? percentageCalc.appliedRule
        : perProcedureCalc.appliedRule
    }

    items.push({
      patientId,
      patientName: patient.patient_info?.name || 'Paciente',
      medicalRecord: patient.patient_info?.medical_record || undefined,
      aihNumber: (((patient as any)?.aih_info?.aih_number || '') as string).toString().replace(/\D/g, '') || undefined,
      aihTotalReais,
      aihCareSpecialty: getPatientCareSpecialty(patient),
      procedures04,
      doctorReceivableReais,
      appliedRule,
      admissionDateISO: (patient as any)?.aih_info?.admission_date || undefined,
      dischargeDateISO: (patient as any)?.aih_info?.discharge_date || undefined,
    })
  }

  // ✅ CALCULAR TOTAIS (se pagamento fixo, usar valor fixo UMA VEZ)
  const totals = {
    patients: items.length,
    aihTotalReais: items.reduce((s, r) => s + r.aihTotalReais, 0),
    doctorReceivableReais: fixedPaymentCalc.hasFixedRule
      ? fixedPaymentCalc.calculatedPayment  // 🔒 Valor fixo UMA VEZ
      : items.reduce((s, r) => s + r.doctorReceivableReais, 0),  // Soma por paciente
  }

  return {
    doctorName,
    filters,
    items,
    totals,
  }
}



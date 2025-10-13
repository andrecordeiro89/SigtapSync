import { DoctorsHierarchyV2Service } from './doctorsHierarchyV2'
import { shouldCalculateAnesthetistProcedure } from '../utils/anesthetistLogic'
import {
  calculateDoctorPayment,
  calculatePercentagePayment,
  type ProcedurePaymentInfo,
} from '../components/DoctorPaymentRules'

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

  // Agregar pacientes por patient_id (podem existir múltiplos cartões por hospital)
  const patientMap = new Map<string, typeof doctorCards[number]['patients'][number]>()
  for (const card of doctorCards) {
    for (const p of card.patients || []) {
      const pid = (p as any).patient_id as string
      if (!pid) continue
      if (!patientMap.has(pid)) {
        patientMap.set(pid, p)
      } else {
        // Merge simples de procedimentos se necessário
        const existing = patientMap.get(pid)!
        const merged = {
          ...existing,
          procedures: [...(existing.procedures || []), ...(p.procedures || [])],
        }
        patientMap.set(pid, merged as any)
      }
    }
  }

  const items: PatientReportItem[] = []

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

    // Regras específicas por procedimento
    const perProcedureCalc = calculateDoctorPayment(doctorName, procedures04)

    // Regra de percentual (quando existir) – base padrão: soma dos procedimentos 04 calculáveis
    const baseProceduresSum = procedures04.reduce((s, p) => s + (p.value_reais || 0), 0)
    const percentageCalc = calculatePercentagePayment(doctorName, baseProceduresSum)

    // Precedência: percentual substitui cálculo individual (conforme regra de negócio)
    const doctorReceivableReais = percentageCalc.hasPercentageRule
      ? percentageCalc.calculatedPayment
      : perProcedureCalc.totalPayment

    const appliedRule = percentageCalc.hasPercentageRule
      ? percentageCalc.appliedRule
      : perProcedureCalc.appliedRule

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

  const totals = {
    patients: items.length,
    aihTotalReais: items.reduce((s, r) => s + r.aihTotalReais, 0),
    doctorReceivableReais: items.reduce((s, r) => s + r.doctorReceivableReais, 0),
  }

  return {
    doctorName,
    filters,
    items,
    totals,
  }
}



import React, { useState, useEffect, useRef } from 'react';
import * as XLSX from 'xlsx';
import { format as formatDateFns } from 'date-fns';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Switch } from './ui/switch';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from './ui/dialog';
import { Input } from './ui/input';
import { Badge } from './ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from './ui/table';
import { isOperaParanaEligible as isOperaEligibleConfig } from '../config/operaParana';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from './ui/collapsible';
import { Alert, AlertDescription } from './ui/alert';
import { toast } from 'sonner';
import { supabase } from '../lib/supabase';
import { getSigtapLocalMap, resolveSigtapDescriptionFromCsv } from '@/utils/sigtapLocal';
import { useAuth } from '../contexts/AuthContext';
import {
  Users,
  ChevronDown,
  ChevronRight,
  ChevronLeft,
  Search,
  Stethoscope,
  DollarSign,
  FileText,
  User,
  Activity,
  Calendar,
  CheckCircle,
  XCircle,
  AlertCircle,
  TrendingUp,
  BarChart3,
  Database,
  RefreshCw,
  Building,
  FileSpreadsheet,
  Loader2
} from 'lucide-react';

import { DoctorPatientService, type DoctorWithPatients } from '../services/doctorPatientService';
import { DoctorsHierarchyV2Service } from '../services/doctorsHierarchyV2';
import { DoctorsCrudService } from '../services/doctorsCrudService';
import { ProcedureRecordsService, type ProcedureRecord } from '../services/simplifiedProcedureService';
import { DateRange } from '../types';
import { DoctorPaymentRules } from './DoctorPaymentRules';
import { calculateDoctorPayment, calculatePercentagePayment, calculateFixedPayment, hasIndividualPaymentRules, isFixedMonthlyPayment, ALL_HOSPITAL_RULES, detectHospitalFromContext } from '../config/doctorPaymentRules';
import ProcedurePatientDiagnostic from './ProcedurePatientDiagnostic';
import CleuezaDebugComponent from './CleuezaDebugComponent';
import ExecutiveDateFilters from './ExecutiveDateFilters';
import { CareCharacterUtils } from '../config/careCharacterCodes';
import { getParticipationInfo } from '../config/participationCodes';
import {
  shouldCalculateAnesthetistProcedure,
  getAnesthetistProcedureType,
  filterCalculableProcedures,
  getCalculableProcedures
} from '../utils/anesthetistLogic';
import { calculateHonPayments } from '../config/doctorPaymentRules/importers/honCsv'
import ReportGenerator from './ReportGenerator';
import PatientAihInfoBadges from './PatientAihInfoBadges';
import AihDatesBadges from './AihDatesBadges';
import { isDoctorCoveredForOperaParana, computeIncrementForProcedures, hasAnyExcludedCodeInProcedures, isElectiveCare, isUrgencyCare } from '../config/operaParana';
import { sumProceduresBaseReais } from '@/utils/valueHelpers';
import { exportAllPatientsExcel } from '../services/exportService'
import { ENV_CONFIG } from '../config/env'
import { supabaseSih } from '../lib/sihSupabase'
import { dedupPatientsByAIH, normalizeAih, summarizeDedup } from '../utils/dedupTest'
import { loadGynHonMap } from '../config/doctorPaymentRules/importers/gynXlsx'
import { loadUroHonMap } from '../config/doctorPaymentRules/importers/uroXlsx'
import { loadOtoHonMap } from '../config/doctorPaymentRules/importers/otoXlsx'
import { loadOtoSaoJoseHonMap } from '../config/doctorPaymentRules/importers/otoSaoJoseXlsx'
import { loadVasHonMap } from '../config/doctorPaymentRules/importers/vasXlsx'

// ✅ FUNÇÕES UTILITÁRIAS LOCAIS
// Função para identificar procedimentos médicos (código 04)
const isMedicalProcedure = (procedureCode: string): boolean => {
  if (!procedureCode) return false;
  // Verifica se o código inicia com '04'
  const code = procedureCode.toString().trim();
  return code.startsWith('04');
};

const formatParticipationLabel = (raw: unknown): string => {
  const base = String(raw ?? '').trim();
  if (!base) return '';
  if (/[a-zA-ZáéíóúâêîôûàèìòùçãõüÁÉÍÓÚÂÊÎÔÛÀÈÌÒÙÇÃÕÜ]/.test(base)) return base;
  const digits = base.replace(/\D/g, '');
  if (!digits) return base;
  const normalized = digits.padStart(2, '0').slice(-2);
  const info = getParticipationInfo(normalized);
  if (!info) return base;
  return `${base} (${info.description})`;
};
const formatCurrency = (value: number | null | undefined): string => {
  if (value == null || isNaN(value)) return 'R$ 0,00';
  return value.toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
};

const formatNumber = (value: number | null | undefined): string => {
  if (value == null || isNaN(value)) return '0';
  return Math.round(value).toLocaleString('pt-BR');
};

// Determinar quando usar planilha HON (apenas hospital Torao Tokuda e cirurgia geral, com fonte remota ativa)
const shouldUseHonForHospital = (doctorName: string, hospitalId: string | undefined, isGeneralSurgery: boolean): boolean => {
  if (!ENV_CONFIG.USE_SIH_SOURCE) return false;
  if (!isGeneralSurgery) return false;
  const hospitalKey = detectHospitalFromContext(doctorName, hospitalId, ALL_HOSPITAL_RULES);
  return hospitalKey === 'TORAO_TOKUDA_APUCARANA';
};

// ✅ FUNÇÃO SEGURA: Parse de data ISO sem problemas de timezone
const parseISODateToLocal = (isoString: string | undefined | null): string => {
  if (!isoString) return '';

  const s = String(isoString).trim();
  if (!s) return '';

  // Tentar extrair YYYY-MM-DD (ignora hora se houver)
  const match = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (match) {
    const [, year, month, day] = match;
    return `${day}/${month}/${year}`;
  }

  // Se não encontrou padrão esperado, tentar split manual
  try {
    const parts = s.split(/[-T]/);
    if (parts.length >= 3) {
      const [year, month, day] = parts;
      if (year && month && day) {
        return `${day.padStart(2, '0')}/${month.padStart(2, '0')}/${year}`;
      }
    }
  } catch (err) {
    console.warn('⚠️ Erro ao parsear data:', s, err);
  }

  // Último recurso: retornar indicador de erro
  return '⚠️ Data inválida';
};

// Função para formatar competência (YYYYMM ou YYYY-MM[-DD] para MM/YYYY)
const formatCompetencia = (competencia: string | undefined): string => {
  if (!competencia) return '—';

  try {
    // Suporte oficial DATASUS: YYYYMM
    const m6 = competencia.match(/^(\d{4})(\d{2})$/);
    if (m6) {
      const [, year, month] = m6;
      return `${month}/${year}`;
    }
    // Formato alternativo: YYYY-MM[-DD]
    const mDash = competencia.match(/^(\d{4})-(\d{2})/);
    if (mDash) {
      const [, year, month] = mDash;
      return `${month}/${year}`;
    }

    // Tentar parsear como data
    const date = new Date(competencia);
    if (!isNaN(date.getTime())) {
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const year = date.getFullYear();
      return `${month}/${year}`;
    }

    return competencia;
  } catch {
    return competencia;
  }
};

// Helper: obter competência segura (MM/YYYY) com fallback para alta ou filtro selecionado
const getSafeCompetenciaLabel = (p: any, selectedCompetencia?: string, isApproved?: boolean): string => {
  if (!isApproved) return ''
  const raw = p?.aih_info?.competencia as string | undefined
  const formatted = formatCompetencia(raw)
  // Extrair ano do formatted MM/YYYY
  const yr = (() => {
    const m = String(formatted || '').match(/^(\d{2})\/(\d{4})$/)
    return m ? parseInt(m[2], 10) : NaN
  })()
  // Se ano inválido ou claramente errado (e.g., 2001), usar fallback
  if (!yr || isNaN(yr) || yr < 2015 || yr > 2100) {
    // Fallback 1: usar alta SUS
    const dischargeISO = p?.aih_info?.discharge_date || ''
    const dLabel = parseISODateToLocal(dischargeISO) // DD/MM/YYYY
    if (dLabel && /\d{2}\/\d{2}\/\d{4}/.test(dLabel)) {
      const parts = dLabel.split('/')
      return `${parts[1]}/${parts[2]}`
    }
    // Fallback 2: usar filtro selecionado
    if (selectedCompetencia && selectedCompetencia !== 'all') {
      return formatCompetencia(selectedCompetencia)
    }
  }
  return formatted
}

// Helper para comparar datas por dia (UTC) e gerar chave YYYY-MM-DD
const toUTCDateKey = (d: Date | string | undefined): string | null => {
  try {
    if (!d) return null;
    const dt = typeof d === 'string' ? new Date(d) : d;
    return new Date(Date.UTC(dt.getUTCFullYear(), dt.getUTCMonth(), dt.getUTCDate())).toISOString().slice(0, 10);
  } catch { return null; }
};
const isSameUTCDate = (a?: Date, b?: Date): boolean => {
  if (!a || !b) return false;
  return toUTCDateKey(a) === toUTCDateKey(b);
};

// Ocultar pagamentos hospitalares: CNS todo zero (mantém alimentação, oculta na UI)
const isZeroCns = (cns?: string): boolean => {
  if (!cns) return false;
  const s = String(cns).trim();
  return /^0+$/.test(s);
};

// Mapas para exibição
const ESPECIALIDADE_MAP: Record<string, string> = {
  '01': 'Cirúrgica',
  '02': 'Obstétrica',
  '03': 'Clínica Médica',
  '07': 'Pediatria'
};
const CARACTER_MAP: Record<string, string> = {
  '01': 'Eletivo',
  '02': 'Urgência'
};
const formatEspecialidade = (raw?: string | number): string => {
  const code = String(raw ?? '').trim().padStart(2, '0');
  return ESPECIALIDADE_MAP[code] || (code ? code : '-');
};
const formatCareCharacterLabel = (raw?: string | number): string => {
  const code = String(raw ?? '').trim().padStart(2, '0');
  return CARACTER_MAP[code] || (code ? code : '-');
};

const careBadgeClass = (raw?: string | number): string => {
  const label = formatCareCharacterLabel(raw);
  return label === 'Urgência'
    ? 'bg-red-50 text-red-700 border-red-200'
    : 'bg-blue-50 text-blue-700 border-blue-200';
};

const normalizeAihNumber = (s: string | undefined | null): string => {
  const v = String(s || '').trim()
  return v.replace(/\D/g, '').replace(/^0+/, '')
}

const calculateDoctorStats = (
  doctorData: DoctorWithPatients,
  aihAssignmentMap?: Map<string, string>,
  drRange?: { from?: string; to?: string }
) => {
  // ✅ SIMPLIFICADO: Usar TODOS os pacientes (sem filtro de data)
  let patientsForStats = doctorData.patients;
  if (aihAssignmentMap) {
    const cns = doctorData.doctor_info.cns || 'NO_CNS'
    patientsForStats = patientsForStats.filter(p => {
      const key = normalizeAihNumber((p as any)?.aih_info?.aih_number)
      if (!key) return true
      const assigned = aihAssignmentMap.get(key)
      return assigned === cns
    })
  }

  // 🚀 OTIMIZAÇÃO #4: Usar procedimentos pré-filtrados (calculable_procedures)
  const totalProcedures = patientsForStats.reduce((sum, patient) =>
    sum + ((patient as any).calculable_procedures?.length || patient.procedures.filter(filterCalculableProcedures).length), 0);

  // ✅ CORREÇÃO: USAR patient.total_value_reais QUE VEM DO calculated_total_value DA AIH
  const totalValue = patientsForStats.reduce((sum, patient) => {
    const base = typeof (patient as any).total_value_reais === 'number'
      ? (patient as any).total_value_reais
      : sumProceduresBaseReais((patient as any).procedures as any);
    return sum + (base || 0);
  }, 0);
  const totalAIHsAll = (() => {
    const set = new Set<string>();
    for (const p of doctorData.patients) {
      const k = normalizeAihNumber((p as any)?.aih_info?.aih_number);
      if (k) set.add(k);
    }
    return set.size;
  })();
  const avgTicket = totalAIHsAll > 0 ? totalValue / totalAIHsAll : 0;

  // 🔍 LOG PARA VERIFICAÇÃO DA CORREÇÃO
  if (doctorData.patients.length > 0) {
    console.log(`💰 Médico ${doctorData.doctor_info.name}: R$ ${totalValue.toFixed(2)} (usando patient.total_value_reais)`);
  }

  // 🚀 OTIMIZAÇÃO #4: Usar procedimentos pré-filtrados para aprovados
  const approvedProcedures = patientsForStats.reduce((sum, patient) => {
    const calculable = (patient as any).calculable_procedures || patient.procedures.filter(filterCalculableProcedures);
    return sum + calculable.filter((proc: any) => proc.approval_status === 'approved').length;
  }, 0);
  const approvalRate = totalProcedures > 0 ? (approvedProcedures / totalProcedures) * 100 : 0;

  // 🆕 CALCULAR valores específicos dos procedimentos médicos ("04") COM REGRAS DE PAGAMENTO
  // 🚫 EXCLUIR ANESTESISTAS 04.xxx dos procedimentos médicos (03.xxx são permitidos)
  const medicalProceduresCount = patientsForStats.reduce((sum, patient) =>
    sum + (() => {
      const aihKey = (patient as any).aih_id || normalizeAihNumber((patient as any)?.aih_info?.aih_number) || '__single__'
      const baseProcedures = (patient as any).calculable_procedures || getCalculableProcedures(
        ((patient.procedures || []) as any[]).map((proc: any) => ({
          ...proc,
          aih_id: proc.aih_id || aihKey,
          sequence: proc.sequence ?? proc.sequencia ?? proc.procedure_sequence
        }))
      )
      return (baseProcedures as any[]).filter(proc => isMedicalProcedure(proc.procedure_code)).length
    })(), 0
  );

  // 🆕 CALCULAR QUANTIDADE DE PROCEDIMENTOS DE ANESTESISTAS INICIADOS EM '04' POR MÉDICO
  // ✅ NOVA LÓGICA: Agrupar por paciente e contar apenas 1 procedimento por grupo de anestesia
  const anesthetistProcedures04Count = patientsForStats.reduce((sum, patient) => {
    // Verificar se o paciente tem pelo menos 1 procedimento de anestesia 04.xxx
    const hasAnesthesiaProcedures = patient.procedures.some(proc =>
      proc.cbo === '225151' && // É anestesista
      proc.procedure_code?.startsWith('04') && // Procedimento inicia com '04'
      proc.procedure_code !== '04.17.01.001-0' // Excluir cesariana (que é calculada)
    );

    // Se tem procedimentos de anestesia, conta apenas 1 (uma anestesia contempla todos os outros)
    return sum + (hasAnesthesiaProcedures ? 1 : 0);
  }, 0);

  // 💰 CALCULAR VALOR TOTAL BASEADO NAS REGRAS DE PAGAMENTO ESPECÍFICAS
  let medicalProceduresValue = 0;
  let calculatedPaymentValue = 0;
  // 🧮 CONTAGEM DE PACIENTES ÚNICOS (independente de nº AIH)
  const uniquePatientKeys = new Set<string>();
  for (const p of patientsForStats) {
    const k = String((p as any).patient_id || (p as any)?.patient_info?.medical_record || '')
      || `${(p as any)?.patient_info?.name || ''}|${(p as any)?.aih_info?.admission_date || ''}`;
    if (k) uniquePatientKeys.add(k);
  }
  const totalPatientsUnique = uniquePatientKeys.size;

  // 📄 CONTAGEM ALINHADA AO RELATÓRIO SIMPLIFICADO (uma linha por paciente)
  const simplifiedReportLineCount = (() => {
    const list = dedupPatientsByAIH(doctorData.patients || [])
      .filter((p: any) => {
        if (aihAssignmentMap) {
          const cns = doctorData.doctor_info.cns || 'NO_CNS'
          const key = normalizeAih(String(p?.aih_info?.aih_number || '').trim())
          if (key) {
            const assigned = aihAssignmentMap.get(key)
            if (assigned && assigned !== cns) return false
          }
        }
        if (drRange && (drRange.from || drRange.to)) {
          try {
            const dischargeISO = p?.aih_info?.discharge_date || ''
            const d = dischargeISO ? new Date(dischargeISO) : null
            const start = drRange.from ? new Date(drRange.from) : null
            const end = drRange.to ? new Date(drRange.to) : null
            const endExclusive = end ? new Date(end.getFullYear(), end.getMonth(), end.getDate() + 1) : null
            if (d) {
              if (start && d < new Date(start.getFullYear(), start.getMonth(), start.getDate())) return false
              if (endExclusive && d >= endExclusive) return false
            }
          } catch { }
        }
        return true
      })
    return list.length
  })()

  // Calcular valor original de todos os procedimentos médicos (🚫 EXCLUINDO ANESTESISTAS 04.xxx)
  medicalProceduresValue = patientsForStats.reduce((sum, patient) =>
    sum + (() => {
      const aihKey = (patient as any).aih_id || normalizeAihNumber((patient as any)?.aih_info?.aih_number) || '__single__'
      const baseProcedures = (patient as any).calculable_procedures || getCalculableProcedures(
        ((patient.procedures || []) as any[]).map((proc: any) => ({
          ...proc,
          aih_id: proc.aih_id || aihKey,
          sequence: proc.sequence ?? proc.sequencia ?? proc.procedure_sequence
        }))
      )
      return (baseProcedures as any[])
        .filter(proc => isMedicalProcedure(proc.procedure_code))
        .reduce((procSum: number, proc: any) => procSum + (proc.value_reais || 0), 0)
    })(), 0
  );

  // 🎯 CALCULAR INCREMENTO OPERA PARANÁ (acréscimo ao valor base das AIHs)
  const hospitalId = doctorData.hospitals?.[0]?.hospital_id;
  const doctorCovered = isDoctorCoveredForOperaParana(doctorData.doctor_info.name, hospitalId);

  const operaParanaIncrement = doctorCovered
    ? patientsForStats.reduce((acc, patient) =>
      acc + computeIncrementForProcedures(
        ((((patient as any).calculable_procedures) || getCalculableProcedures(
          ((patient.procedures || []) as any[]).map((proc: any) => ({
            ...proc,
            aih_id: proc.aih_id || ((patient as any).aih_id || normalizeAihNumber((patient as any)?.aih_info?.aih_number) || '__single__'),
            sequence: proc.sequence ?? proc.sequencia ?? proc.procedure_sequence
          }))
        )) as any),
        (patient as any)?.aih_info?.care_character,
        doctorData.doctor_info.name,
        hospitalId
      ), 0)
    : 0;

  // 🎯 CALCULAR SOMA DOS VALORES DO DETALHAMENTO POR PROCEDIMENTO (POR PACIENTE)
  // 🆕 VERIFICAR TIPO DE REGRA: VALOR FIXO → PERCENTUAL → INDIVIDUAL

  // ✅ CORREÇÃO FINAL: Usar EXATAMENTE a mesma lógica do card do paciente
  // - Usar patient.procedures diretamente (não calculable_procedures)
  // - Ordenar por sequence e valor (igual ao card)
  calculatedPaymentValue = patientsForStats.reduce((totalSum, patient) => {
    const aihKey = (patient as any).aih_id || normalizeAihNumber((patient as any)?.aih_info?.aih_number) || '__single__'
    const baseProcedures = (patient as any).calculable_procedures || getCalculableProcedures(
      ((patient.procedures || []) as any[]).map((proc: any) => ({
        ...proc,
        aih_id: proc.aih_id || aihKey,
        sequence: proc.sequence ?? proc.sequencia ?? proc.procedure_sequence
      }))
    )
    const patientMedicalProcedures = (baseProcedures as any[])
      .filter((proc: any) => isMedicalProcedure(proc.procedure_code))
      .sort((a: any, b: any) => {
        // Ordenar por sequence primeiro, depois por valor (decrescente) - IGUAL AO CARD
        const sa = typeof a.sequence === 'number' ? a.sequence : 9999;
        const sb = typeof b.sequence === 'number' ? b.sequence : 9999;
        if (sa !== sb) return sa - sb;
        const va = typeof a.value_reais === 'number' ? a.value_reais : 0;
        const vb = typeof b.value_reais === 'number' ? b.value_reais : 0;
        return vb - va;
      })
      .map((proc: any) => ({
        procedure_code: proc.procedure_code,
        procedure_description: proc.procedure_description,
        value_reais: proc.value_reais || 0,
        cbo: proc.cbo,
        sequence: proc.sequence
      }));
    if (patientMedicalProcedures.length > 0) {
      const isGeneralSurgery = /cirurg/i.test(doctorData.doctor_info.name || '') || (/cirurg/i.test(doctorData.doctor_info.specialty || '') && /geral/i.test(doctorData.doctor_info.specialty || ''))
      const useHon = shouldUseHonForHospital(doctorData.doctor_info.name, hospitalId, isGeneralSurgery)
      const paymentCalculation = useHon
        ? calculateHonPayments(patientMedicalProcedures)
        : calculateDoctorPayment(doctorData.doctor_info.name, patientMedicalProcedures, hospitalId);
      const patientCalculatedSum = paymentCalculation.procedures.reduce((sum, proc) => sum + proc.calculatedPayment, 0);
      return totalSum + patientCalculatedSum;
    }
    return totalSum;
  }, 0);

  // 🆕 CORREÇÃO (Re-aplicada): Valor fixo mensal não deve ser multiplicado por AIH.
  // Se o médico tem valor fixo MENSAL, o valor calculado pelo reduce estará errado (multiplicado pelo nº de pacientes)
  // porque calculateDoctorPayment retorna o valor fixo para CADA paciente.
  // Devemos sobrescrever com o valor fixo único.
  if (isFixedMonthlyPayment(doctorData.doctor_info.name, hospitalId, ALL_HOSPITAL_RULES)) {
    const fixed = calculateFixedPayment(doctorData.doctor_info.name, hospitalId, ALL_HOSPITAL_RULES);
    if (fixed.hasFixedRule) {
      console.log(`🔧 [FIX] Corrigindo pagamento mensal multiplicado para ${doctorData.doctor_info.name}: R$ ${calculatedPaymentValue.toFixed(2)} -> R$ ${fixed.calculatedPayment.toFixed(2)}`);
      calculatedPaymentValue = fixed.calculatedPayment;
    }
  }

  return {
    totalProcedures,
    totalValue,
    totalAIHs: totalAIHsAll,
    totalPatientsUnique,
    simplifiedReportLineCount,
    avgTicket,
    approvalRate,
    medicalProceduresValue,
    medicalProceduresCount,
    calculatedPaymentValue, // 🆕 Valor calculado baseado nas regras
    anesthetistProcedures04Count, // 🆕 Quantidade de procedimentos de anestesistas iniciados em '04'
    operaParanaIncrement, // 🆕 Incremento Opera Paraná (acréscimo ao valor das AIHs)
    totalValueWithOperaParana: totalValue + operaParanaIncrement // 🆕 Valor total das AIHs + incremento
  };
};

// Chave única por cartão Médico×Hospital
const getDoctorCardKey = (doctor: DoctorWithPatients): string => {
  const cns = doctor.doctor_info.cns || 'NO_CNS';
  const hospitalId = doctor.hospitals && doctor.hospitals.length > 0 ? (doctor.hospitals[0] as any).hospital_id || '' : '';
  return `${cns}::${hospitalId}`;
};

// 🆕 INTERFACE PARA DIAGNÓSTICO DE DADOS
interface DataDiagnostic {
  aihs_with_doctors: number;
  unique_doctors: number;
  unique_patients: number;
  total_procedures: number;
  procedures_with_patients: number;
  association_rate: number;
  sample_associations: Array<{
    doctor_cns: string;
    patient_id: string;
    procedure_count: number;
    sample_procedure_codes: string[];
    sample_procedure_descriptions?: string[];
  }>;
}

// 🆕 COMPONENTE DE DIAGNÓSTICO DE DADOS
const DataDiagnostics: React.FC<{ onClose: () => void }> = ({ onClose }) => {
  const [diagnostic, setDiagnostic] = useState<DataDiagnostic | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Função para buscar descrições dos procedimentos no SIGTAP
  const fetchProcedureDescriptions = async (codes: string[]): Promise<string[]> => {
    if (!codes || codes.length === 0) return [];

    try {
      const { data: sigtapData } = await supabase
        .from('sigtap_procedimentos_oficial')
        .select('codigo, nome')
        .in('codigo', codes);

      if (sigtapData && sigtapData.length > 0) {
        const descriptionMap = new Map(sigtapData.map(item => [item.codigo, item.nome]));
        return codes.map(code => descriptionMap.get(code) || `Procedimento ${code}`);
      }

      return codes.map(code => `Procedimento ${code}`);
    } catch (error) {
      console.warn('Erro ao buscar descrições SIGTAP:', error);
      return codes.map(code => `Procedimento ${code}`);
    }
  };

  const runDiagnostic = async () => {
    setLoading(true);
    setError(null);

    try {
      const result = await DoctorPatientService.diagnoseDatabaseStructure();
      if (result.success && result.data) {
        const diagnosticData = result.data;

        // Buscar descrições para cada amostra
        for (const sample of diagnosticData.sample_associations) {
          (sample as any).sample_procedure_descriptions = await fetchProcedureDescriptions(sample.sample_procedure_codes);
        }

        setDiagnostic(diagnosticData);
      } else {
        setError(result.error || 'Erro ao executar diagnóstico');
      }
    } catch (err) {
      setError('Erro inesperado no diagnóstico');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    runDiagnostic();
  }, []);

  if (loading) {
    return (
      <Card className="mb-6 border-blue-200">
        <CardContent className="p-6">
          <div className="flex items-center gap-3">
            <RefreshCw className="h-5 w-5 animate-spin text-blue-600" />
            <span>Executando diagnóstico da estrutura de dados...</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className="mb-6 border-red-200">
        <CardContent className="p-6">
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
          <div className="mt-4 flex gap-2">
            <Button onClick={runDiagnostic} variant="outline" size="sm">
              <RefreshCw className="h-4 w-4 mr-2" />
              Tentar Novamente
            </Button>
            <Button onClick={onClose} variant="ghost" size="sm">Fechar</Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!diagnostic) return null;

  const getAssociationColor = (rate: number) => {
    if (rate >= 80) return 'text-green-600';
    if (rate >= 60) return 'text-yellow-600';
    return 'text-red-600';
  };

  return (
    <Card className="mb-6 border-blue-200 bg-blue-50/30">
      <CardHeader className="pb-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Database className="h-5 w-5 text-blue-600" />
            <CardTitle className="text-lg">Diagnóstico da Estrutura de Dados</CardTitle>
          </div>
          <Button onClick={onClose} variant="ghost" size="sm">✕</Button>
        </div>
      </CardHeader>
      <CardContent>
        {/* ESTATÍSTICAS PRINCIPAIS */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <div className="text-center p-3 bg-white rounded-lg border">
            <div className="text-2xl font-bold text-blue-600">{diagnostic.aihs_with_doctors}</div>
            <div className="text-sm text-gray-600">AIHs com Médicos</div>
          </div>
          <div className="text-center p-3 bg-white rounded-lg border">
            <div className="text-2xl font-bold text-green-600">{diagnostic.unique_doctors}</div>
            <div className="text-sm text-gray-600">Médicos Únicos</div>
          </div>
          <div className="text-center p-3 bg-white rounded-lg border">
            <div className="text-2xl font-bold text-purple-600">{diagnostic.unique_patients}</div>
            <div className="text-sm text-gray-600">Pacientes Únicos</div>
          </div>
          <div className="text-center p-3 bg-white rounded-lg border">
            <div className="text-2xl font-bold text-orange-600">{diagnostic.total_procedures}</div>
            <div className="text-sm text-gray-600">Total Procedimentos</div>
          </div>
        </div>

        {/* TAXA DE ASSOCIAÇÃO */}
        <div className="bg-white rounded-lg border p-4 mb-4">
          <div className="flex items-center justify-between">
            <span className="font-medium">Taxa de Associação:</span>
            <span className={`text-xl font-bold ${getAssociationColor(diagnostic.association_rate)}`}>
              {diagnostic.association_rate}%
            </span>
          </div>
          <div className="text-sm text-gray-600 mt-1">
            {diagnostic.procedures_with_patients} de {diagnostic.total_procedures} procedimentos associados
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2 mt-2">
            <div
              className={`h-2 rounded-full ${diagnostic.association_rate >= 80 ? 'bg-green-500' :
                diagnostic.association_rate >= 60 ? 'bg-yellow-500' : 'bg-red-500'
                }`}
              style={{ width: `${diagnostic.association_rate}%` }}
            />
          </div>
        </div>

        {/* AMOSTRAS DE ASSOCIAÇÃO */}
        {diagnostic.sample_associations.length > 0 && (
          <div className="bg-white rounded-lg border p-4">
            <h4 className="font-medium mb-3">🔍 Amostras de Associação:</h4>
            <div className="space-y-2">
              {diagnostic.sample_associations.map((sample, index) => (
                <div key={index} className="bg-gray-50 rounded p-3 text-sm">
                  <div className="flex items-center gap-2 mb-1">
                    <User className="h-4 w-4 text-blue-600" />
                    <span className="font-medium">Médico {sample.doctor_cns.substring(0, 5)}...</span>
                    <span className="text-gray-500">→</span>
                    <span>Paciente {sample.patient_id.substring(0, 8)}...</span>
                  </div>
                  <div className="ml-6">
                    <Badge variant="outline" className="mr-2">
                      {sample.procedure_count} procedimentos
                    </Badge>
                    <div className="text-gray-600 text-sm">
                      {sample.sample_procedure_codes.map((code, codeIndex) => (
                        <div key={codeIndex} className="mt-1">
                          <span className="font-mono text-xs font-medium">{code}</span>
                          {(sample as any).sample_procedure_descriptions?.[codeIndex] && (
                            <span className="ml-2 text-xs text-gray-500">
                              {(sample as any).sample_procedure_descriptions[codeIndex]}
                            </span>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* BOTÕES DE AÇÃO */}
        <div className="flex gap-2 mt-4">
          <Button onClick={runDiagnostic} variant="outline" size="sm">
            <RefreshCw className="h-4 w-4 mr-2" />
            Atualizar Diagnóstico
          </Button>
          <Button onClick={onClose} variant="ghost" size="sm">Fechar</Button>
        </div>
      </CardContent>
    </Card>
  );
};

// ✅ INTERFACE PARA PROPS DO COMPONENTE - SIMPLIFICADA
interface MedicalProductionDashboardProps {
  onStatsUpdate?: (stats: {
    totalRevenue: number;
    totalDoctors: number;
    totalPatients: number;
    totalProcedures: number;
    patientsWithMultipleAIHs?: number;
    totalMultipleAIHs?: number;
    totalAIHs?: number;
    uniquePatients?: number;
    multipleAIHsDetails?: any[];
  }) => void;
  selectedHospitals?: string[]; // Filtro de hospital
  searchTerm?: string; // Busca de médicos
  patientSearchTerm?: string; // Busca de pacientes
  selectedCompetencia?: string; // ✅ NOVO: Filtro de competência
  filterCareCharacter?: 'all' | '1' | '2';
  dischargeDateRange?: { from?: string; to?: string };
  selectedSpecialties?: string[]; // ✅ NOVO: Filtro de especialidades
}

// ✅ COMPONENTE PRINCIPAL - SIMPLIFICADO
const MedicalProductionDashboard: React.FC<MedicalProductionDashboardProps> = ({
  onStatsUpdate,
  selectedHospitals = ['all'],
  searchTerm = '',
  patientSearchTerm = '',
  selectedCompetencia = 'all',
  filterCareCharacter = 'all'
  , dischargeDateRange,
  selectedSpecialties
}) => {
  const useDebounced = <T,>(value: T, delay: number) => {
    const [debounced, setDebounced] = useState<T>(value);
    useEffect(() => {
      const id = setTimeout(() => setDebounced(value), delay);
      return () => clearTimeout(id);
    }, [value, delay]);
    return debounced;
  };
  const debouncedSearchTerm = useDebounced(searchTerm, 300);
  const debouncedPatientSearchTerm = useDebounced(patientSearchTerm, 300);
  const { user, canAccessAllHospitals, hasFullAccess } = useAuth();
  const [doctors, setDoctors] = useState<DoctorWithPatients[]>([]);
  const [filteredDoctors, setFilteredDoctors] = useState<DoctorWithPatients[]>([]);
  const [availableHospitals, setAvailableHospitals] = useState<Array<{ id: string, name: string, cnes?: string }>>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [dbAihCount, setDbAihCount] = useState<number | null>(null);
  const [expandedDoctors, setExpandedDoctors] = useState<Set<string>>(new Set());
  const [expandedPatients, setExpandedPatients] = useState<Set<string>>(new Set());
  const [showDiagnostic, setShowDiagnostic] = useState(false); // 🆕 ESTADO PARA MOSTRAR DIAGNÓSTICO
  // 🚨 Estado para cache de pacientes sem repasse médico
  const [patientsWithoutPaymentCache, setPatientsWithoutPaymentCache] = useState<Map<string, {
    count: number;
    total: number;
    calculated: boolean;
  }>>(new Map());
  const [showProcedureDiagnostic, setShowProcedureDiagnostic] = useState(false); // 🆕 DIAGNÓSTICO DE PROCEDIMENTOS
  const [showCleuezaDebug, setShowCleuezaDebug] = useState(false); // 🆕 DEBUG ESPECÍFICO CLEUZA
  // 🆕 REFRESH CONTROL (manual e realtime)
  const [refreshTick, setRefreshTick] = useState(0);
  const realtimeDebounceRef = useRef<NodeJS.Timeout | null>(null);
  const [autoRefresh, setAutoRefresh] = useState<boolean>(true);
  // 🆕 MODAL RELATÓRIO SUS
  const [reportModalOpen, setReportModalOpen] = useState<boolean>(false);
  // ✅ COMPETÊNCIA VEM DO PROP (não precisa de estado local)
  const [availableCompetencias, setAvailableCompetencias] = useState<string[]>([]);
  const [sigtapMap, setSigtapMap] = useState<Map<string, string> | null>(null)
  const [discrepancyLoading, setDiscrepancyLoading] = useState<boolean>(false)
  const [discrepancyTotals, setDiscrepancyTotals] = useState<{
    cards_sum_reais: number
    cards_distinct_sum_reais: number
    remote_val_tot_distinct_reais: number
    local_sigtap_total_reais: number
    difference_cards_vs_sigtap: number
  } | null>(null)
  const [discrepancyDetails, setDiscrepancyDetails] = useState<Array<{ aih: string; cards: number; sigtap: number; sih?: number; diff: number }>>([])
  const [discrepancyCounts, setDiscrepancyCounts] = useState<{ missingInLocal: number; missingInCards: number; missingInRemote: number; withoutNumber: number }>({ missingInLocal: 0, missingInCards: 0, missingInRemote: 0, withoutNumber: 0 })
  const [showDiscrepancyDetails, setShowDiscrepancyDetails] = useState<boolean>(false)
  const [showDedupList, setShowDedupList] = useState<boolean>(false)
  const [zeroRepasseOpen, setZeroRepasseOpen] = useState<boolean>(false)
  const [zeroRepasseItems, setZeroRepasseItems] = useState<Array<{ medicalRecord: string; aihNumber: string; name: string; procedures: string; discharge: string }>>([])
  const [zeroRepasseDoctorName, setZeroRepasseDoctorName] = useState<string>('')
  const useSihSource = false
  useEffect(() => {
    let mounted = true
    const load = async () => {
      try {
        const map = await getSigtapLocalMap()
        if (mounted) setSigtapMap(map)
      } catch { if (mounted) setSigtapMap(new Map()) }
    }
    load()
    return () => { mounted = false }
  }, [])
  const remoteConfigured = Boolean(ENV_CONFIG.SIH_SUPABASE_URL && ENV_CONFIG.SIH_SUPABASE_ANON_KEY)
  const [simplifiedValidationOpen, setSimplifiedValidationOpen] = useState<boolean>(false)
  const [simplifiedValidationLoading, setSimplifiedValidationLoading] = useState<boolean>(false)
  const [simplifiedValidationStats, setSimplifiedValidationStats] = useState<{ total: number; approved: number; notApproved: number; remote: boolean } | null>(null)
  const approvedSetRef = useRef<Set<string>>(new Set())
  const approvalCompetenciaByAihRef = useRef<Map<string, string>>(new Map())
  const [selectedDoctorForReport, setSelectedDoctorForReport] = useState<any>(null)
  const [tabwinReportOpen, setTabwinReportOpen] = useState<boolean>(false)
  const [tabwinReportDoctor, setTabwinReportDoctor] = useState<any>(null)
  const [tabwinReportLoading, setTabwinReportLoading] = useState<boolean>(false)
  const [simplifiedPreviewOpen, setSimplifiedPreviewOpen] = useState<boolean>(false)
  const [simplifiedPreviewRows, setSimplifiedPreviewRows] = useState<Array<Array<string>>>([])
  const simplifiedPreviewConfirmRef = useRef<null | ((rows: Array<Array<string>>) => void)>(null)
  const parseBrCurrencyPreview = (s: unknown): number => {
    const raw = (s ?? '').toString()
    const cleaned = raw
      .replace(/[^\d,.-]/g, '')
      .replace(/\./g, '')
      .replace(/,/, '.')
    const n = Number(cleaned)
    return Number.isFinite(n) ? n : 0
  }
  const [relateOpen, setRelateOpen] = useState<boolean>(false)
  const [relateDoctor, setRelateDoctor] = useState<any>(null)
  const [relateReportA, setRelateReportA] = useState<string>('Relatório Pacientes Simplificado')
  const [relateReportB, setRelateReportB] = useState<string>('Repasse Médico (TABWIN)')
  const [relateLoading, setRelateLoading] = useState<boolean>(false)
  const [valueConferenceOpen, setValueConferenceOpen] = useState<boolean>(false)
  const [valueConferenceDoctor, setValueConferenceDoctor] = useState<any>(null)
  const [valueConferenceLoading, setValueConferenceLoading] = useState<boolean>(false)
  const [sihRemoteTotals, setSihRemoteTotals] = useState<{ totalValue: number; totalAIHs: number; source: string } | null>(null)
  const generateGeneralPatientsReport = async () => {
    try {
      const rows: Array<Array<string | number>> = []
      const allAihIds: Set<string> = new Set()
      const aihIdsWithProcedures: Set<string> = new Set()
      const header = [
        '#',
        'Prontuário',
        'Nome do Paciente',
        'Nº AIH',
        'Código Procedimento',
        'Descrição Procedimento',
        'Data Procedimento',
        'Data Alta (SUS)',
        'Especialidade de Atendimento',
        'Caráter de Atendimento',
        'Médico',
        'Hospital',
        'Pgt. Administrativo',
        'Valor Procedimento',
        'AIH Seca',
        'Incremento',
        'AIH c/ Incremento'
      ]
      let idx = 1
      let totalAIHsFound = 0
      let excludedByDateFilter = 0
      let aihsWithoutNumber = 0
      const normalizeAih = (s: string) => s.replace(/\D/g, '').replace(/^0+/, '')
      filteredDoctors.forEach((card: any) => {
        const doctorName = card.doctor_info?.name || ''
        const hospitalName = card.hospitals?.[0]?.hospital_name || ''
          ; (card.patients || []).forEach((p: any) => {
            totalAIHsFound++
            const patientId = p.patient_id
            const name = p.patient_info?.name || 'Paciente'
            const medicalRecord = p.patient_info?.medical_record || '-'
            const aihRaw = normalizeAih(String(p?.aih_info?.aih_number || '').trim())
            const aih = aihRaw || 'Aguardando geração'
            const aihKey = String(p?.aih_id || aihRaw || `${patientId}|${p?.aih_info?.admission_date || ''}`)
            if (aihKey) allAihIds.add(aihKey)
            if (!aihRaw) aihsWithoutNumber++
            const careSpec = (p?.aih_info?.specialty || '').toString()
            const careCharacter = (() => {
              const raw = (p?.aih_info?.care_character ?? '').toString()
              try { return CareCharacterUtils.formatForDisplay(raw, false) } catch { return raw }
            })()
            const disISO = p?.aih_info?.discharge_date || ''
            const disLabel = disISO ? parseISODateToLocal(disISO) : ''
            // Usar o mesmo filtro da tela para garantir fidelidade
            const cp = (p as any).calculable_procedures
            const procedures = (Array.isArray(cp) && cp.length > 0) ? cp : (p.procedures || []).filter(filterCalculableProcedures)
            procedures.forEach((proc: any) => {
              const procCode = proc.procedure_code || ''
              const procDesc = proc.procedure_description || proc.sigtap_description || ''
              const procDate = proc.procedure_date || ''
              const procDateLabel = procDate ? (() => { const s = String(procDate); const m = s.match(/^(\d{4})-(\d{2})-(\d{2})/); return m ? `${m[3]}/${m[2]}/${m[1]}` : parseISODateToLocal(s) })() : ''
              const procValue = Number(proc.value_reais || 0)
              const baseAih = Number(p.total_value_reais || 0)
              const doctorCovered = isDoctorCoveredForOperaParana(doctorName, card.hospitals?.[0]?.hospital_id)
              // Calcular incremento com o mesmo conjunto de procedimentos exibidos
              const increment = doctorCovered ? computeIncrementForProcedures(procedures as any, p?.aih_info?.care_character, doctorName, card.hospitals?.[0]?.hospital_id) : 0
              const aihWithIncrements = baseAih + increment
              const pgtAdm = p?.aih_info?.pgt_adm || 'não'
              aihIdsWithProcedures.add(aihKey)
              rows.push([
                idx++,
                medicalRecord,
                name,
                aih,
                procCode,
                procDesc,
                procDateLabel,
                disLabel,
                formatEspecialidade(careSpec),
                careCharacter,
                doctorName,
                hospitalName,
                pgtAdm,
                formatCurrency(procValue),
                formatCurrency(baseAih),
                formatCurrency(increment),
                formatCurrency(aihWithIncrements)
              ])
            })
            // Garantir 1 linha por AIH mesmo sem procedimentos calculáveis
            if (procedures.length === 0) {
              const doctorCovered = isDoctorCoveredForOperaParana(doctorName, card.hospitals?.[0]?.hospital_id)
              const increment = doctorCovered ? computeIncrementForProcedures([], p?.aih_info?.care_character, doctorName, card.hospitals?.[0]?.hospital_id) : 0
              const aihWithIncrements = Number(p.total_value_reais || 0) + increment
              rows.push([
                idx++,
                medicalRecord,
                name,
                aih,
                '—',
                'Sem procedimento calculável no período/filtros',
                '',
                disLabel,
                formatEspecialidade(careSpec),
                careCharacter,
                doctorName,
                hospitalName,
                p?.aih_info?.pgt_adm || 'não',
                formatCurrency(0),
                formatCurrency(Number(p.total_value_reais || 0)),
                formatCurrency(increment),
                formatCurrency(aihWithIncrements)
              ])
            }
          })
      })
      rows.forEach((row, index) => { row[0] = index + 1 })
      const wb = XLSX.utils.book_new()
      const ws = XLSX.utils.aoa_to_sheet([header, ...rows])
      const wsAny: any = ws
      wsAny['!cols'] = [
        { wch: 5 }, { wch: 15 }, { wch: 35 }, { wch: 18 }, { wch: 20 }, { wch: 45 }, { wch: 16 }, { wch: 16 }, { wch: 25 }, { wch: 22 }, { wch: 30 }, { wch: 35 }, { wch: 20 }, { wch: 18 }, { wch: 18 }, { wch: 18 }, { wch: 20 }
      ]
      XLSX.utils.book_append_sheet(wb, ws, 'Pacientes')

      // Resumo com reconciliação (tela x relatório)
      const uniqueKeys: Record<string, true> = {}
      for (const d of (filteredDoctors || []) as any[]) {
        for (const p of (d.patients || []) as any[]) {
          const aihId = String(p.aih_id || '').trim()
          const aihNumber = String((p?.aih_info?.aih_number || '')).replace(/\D/g, '').replace(/^0+/, '')
          const key = aihId || aihNumber || `${p.patient_id || ''}|${p?.aih_info?.admission_date || ''}`
          if (key) uniqueKeys[key] = true
        }
      }
      const totalCardAihs = Object.keys(uniqueKeys).length
      const totalAihsWithProcedures = aihIdsWithProcedures.size
      const totalAihsWithoutProcedures = Math.max(0, totalCardAihs - totalAihsWithProcedures)
      const summaryRows = [
        ['AIHs (registros únicos) na tela', totalCardAihs],
        ['AIHs com ao menos 1 procedimento calculável (no relatório)', totalAihsWithProcedures],
        ['AIHs sem procedimento calculável (não entram no relatório)', totalAihsWithoutProcedures],
        ['Linhas no relatório (procedimentos)', rows.length]
      ]
      const wsSummary = XLSX.utils.aoa_to_sheet([['Resumo'], ...summaryRows])
      const wsSummaryAny: any = wsSummary
      wsSummaryAny['!cols'] = [{ wch: 52 }, { wch: 18 }]
      XLSX.utils.book_append_sheet(wb, wsSummary, 'Resumo')
      const fileName = `Relatorio_Pacientes_Procedimentos_${formatDateFns(new Date(), 'yyyyMMdd_HHmm')}.xlsx`
      XLSX.writeFile(wb, fileName)
      if (aihsWithoutNumber > 0) toast.success(`Relatório geral gerado! ${aihsWithoutNumber} registro(s) sem AIH incluído(s).`)
      else toast.success('Relatório geral gerado com sucesso!')
    } catch (e) {
      console.error('Erro ao exportar Relatório Pacientes:', e)
      toast.error('Erro ao gerar relatório geral')
    }
  }

  const generateConferencePatientsReport = async () => {
    try {
      const rows: Array<Array<string | number>> = []
      const aihIdsWithProcedures: Set<string> = new Set()
      const header = ['#', 'Prontuário', 'Nome do Paciente', 'Nº AIH', 'Data Alta (SUS)', 'Médico', 'Hospital', 'Pgt. Administrativo', 'AIH Seca', 'Incremento', 'AIH c/ Incremento']
      let idx = 1
      let totalAIHsFound = 0
      let aihsWithoutNumber = 0
      filteredDoctors.forEach((card: any) => {
        const doctorName = card.doctor_info?.name || ''
        const hospitalName = card.hospitals?.[0]?.hospital_name || ''
          ; (card.patients || []).forEach((p: any) => {
            totalAIHsFound++
            const name = p.patient_info?.name || 'Paciente'
            const medicalRecord = p.patient_info?.medical_record || '-'
            const aihRaw = (p?.aih_info?.aih_number || '').toString().replace(/\D/g, '')
            const aih = aihRaw || 'Aguardando geração'
            if (!aihRaw) aihsWithoutNumber++
            const disISO = p?.aih_info?.discharge_date || ''
            const disLabel = parseISODateToLocal(disISO)
            const baseAih = Number(p.total_value_reais || 0)
            const doctorCovered = isDoctorCoveredForOperaParana(doctorName, card.hospitals?.[0]?.hospital_id)
            const cp = (p as any).calculable_procedures
            const procedures = (Array.isArray(cp) && cp.length > 0) ? cp : (p.procedures || []).filter(filterCalculableProcedures)
            if (procedures.length > 0) {
              aihIdsWithProcedures.add(String(p.aih_id || aihRaw || `${p.patient_id}|${p?.aih_info?.admission_date || ''}`))
            }
            const increment = doctorCovered ? computeIncrementForProcedures(procedures as any, p?.aih_info?.care_character, doctorName, card.hospitals?.[0]?.hospital_id) : 0
            const aihWithIncrements = baseAih + increment
            const pgtAdm = p?.aih_info?.pgt_adm || 'não'
            rows.push([idx++, medicalRecord, name, aih, disLabel, doctorName, hospitalName, pgtAdm, formatCurrency(baseAih), formatCurrency(increment), formatCurrency(aihWithIncrements)])
          })
      })
      rows.sort((a, b) => { const da = a[4] as string; const db = b[4] as string; if (!da && !db) return 0; if (!da) return 1; if (!db) return -1; const pa = da.split('/'); const pb = db.split('/'); const dA = pa.length === 3 ? new Date(parseInt(pa[2]), parseInt(pa[1]) - 1, parseInt(pa[0])) : new Date(0); const dB = pb.length === 3 ? new Date(parseInt(pb[2]), parseInt(pb[1]) - 1, parseInt(pb[0])) : new Date(0); return dB.getTime() - dA.getTime() })
      rows.forEach((row, index) => { row[0] = index + 1 })
      const wb = XLSX.utils.book_new()
      const ws = XLSX.utils.aoa_to_sheet([header, ...rows])
      const wsAny: any = ws
      wsAny['!cols'] = [{ wch: 5 }, { wch: 15 }, { wch: 35 }, { wch: 18 }, { wch: 16 }, { wch: 30 }, { wch: 35 }, { wch: 20 }, { wch: 18 }, { wch: 18 }, { wch: 20 }]
      XLSX.utils.book_append_sheet(wb, ws, 'AIHs')
      // Resumo com reconciliação (tela x relatório)
      const uniqueKeys: Record<string, true> = {}
      for (const d of (filteredDoctors || []) as any[]) {
        for (const p of (d.patients || []) as any[]) {
          const aihId = String(p.aih_id || '').trim()
          const aihNumber = String((p?.aih_info?.aih_number || '')).replace(/\D/g, '').replace(/^0+/, '')
          const key = aihId || aihNumber || `${p.patient_id || ''}|${p?.aih_info?.admission_date || ''}`
          if (key) uniqueKeys[key] = true
        }
      }
      const totalCardAihs = Object.keys(uniqueKeys).length
      const totalAihsWithProcedures = aihIdsWithProcedures.size
      const totalAihsWithoutProcedures = Math.max(0, totalCardAihs - totalAihsWithProcedures)
      const summaryRows = [
        ['AIHs (registros únicos) na tela', totalCardAihs],
        ['AIHs com ao menos 1 procedimento calculável (no relatório)', totalAihsWithProcedures],
        ['AIHs sem procedimento calculável (não entram no relatório)', totalAihsWithoutProcedures],
        ['Linhas no relatório (AIHs)', rows.length]
      ]
      const wsSummary = XLSX.utils.aoa_to_sheet([['Resumo'], ...summaryRows])
      const wsSummaryAny: any = wsSummary
      wsSummaryAny['!cols'] = [{ wch: 52 }, { wch: 18 }]
      XLSX.utils.book_append_sheet(wb, wsSummary, 'Resumo')
      const fileName = `Relatorio_AIHs_Conferencia_${formatDateFns(new Date(), 'yyyyMMdd_HHmm')}.xlsx`
      XLSX.writeFile(wb, fileName)
      if (aihsWithoutNumber > 0) toast.success(`Relatório de conferência gerado! ${aihsWithoutNumber} AIH(s) sem número incluída(s).`)
      else toast.success('Relatório de conferência gerado com sucesso!')
    } catch (e) {
      console.error('Erro ao exportar Relatório Conferência:', e)
      toast.error('Erro ao gerar relatório de conferência')
    }
  }

  const generateSimplifiedPatientsReport = async () => {
    try {
      const rows: Array<Array<string | number>> = []
      const header = ['#', 'Nome do Paciente', 'Prontuário', 'Nº AIH', 'Data de Admissão', 'Data de Alta', 'Médico', 'Pgt. Administrativo', 'AIH Seca', 'Incremento', 'AIH c/ Incremento']
      let idx = 1
      const allPatients: any[] = []
      const globalSeen = new Set<string>()
      const cnsNameMap = new Map<string, string>(
        (filteredDoctors || []).map((d: any) => [String(d?.doctor_info?.cns || '').trim(), d?.doctor_info?.name || ''])
      )
      filteredDoctors.forEach((card: any) => {
        const doctorName = card.doctor_info?.name || 'Médico não identificado'
        const doctorPatients = dedupPatientsByAIH(card.patients || [])
        doctorPatients.forEach((p: any) => {
          const aih = normalizeAih((p?.aih_info?.aih_number || '').toString())
          const aihDisplay = aih || 'Aguardando geração'
          if (aih && globalSeen.has(aih)) return
          if (aih) globalSeen.add(aih)
          const name = p.patient_info?.name || 'Paciente'
          const medicalRecord = p.patient_info?.medical_record || '-'
          const admissionISO = p?.aih_info?.admission_date || ''
          const admissionLabel = parseISODateToLocal(admissionISO)
          const dischargeISO = p?.aih_info?.discharge_date || ''
          const dischargeLabel = parseISODateToLocal(dischargeISO)
          const baseAih = Math.round((Number(p.total_value_reais || 0)) * 100) / 100
          const doctorCovered = isDoctorCoveredForOperaParana(doctorName, card.hospitals?.[0]?.hospital_id)
          const incrementRaw = doctorCovered ? computeIncrementForProcedures(p.procedures as any, p?.aih_info?.care_character, doctorName, card.hospitals?.[0]?.hospital_id) : 0
          const increment = Math.round(incrementRaw * 100) / 100
          const aihWithIncrements = Math.round((baseAih + increment) * 100) / 100
          const pgtAdm = p?.aih_info?.pgt_adm || 'não'
          const respCns = String(((p?.aih_info?.cns_responsavel ?? p?.aih_info?.cns_responsible) || '')).trim()
          const resolvedDoctorName = (respCns && !isZeroCns(respCns)) ? (cnsNameMap.get(respCns) || doctorName) : doctorName
          allPatients.push({ name, medicalRecord, aih: aihDisplay, admissionLabel, dischargeLabel, doctorName: resolvedDoctorName, pgtAdm, baseAih, increment, aihWithIncrements })
        })
      })
      allPatients.sort((a, b) => {
        const parseDate = (dateStr: string): Date | null => { if (!dateStr || dateStr === '') return null; const parts = dateStr.split('/'); if (parts.length === 3) return new Date(`${parts[2]}-${parts[1]}-${parts[0]}`); return null }
        const dateA = parseDate(a.dischargeLabel)
        const dateB = parseDate(b.dischargeLabel)
        if (!dateA && !dateB) return 0; if (!dateA) return 1; if (!dateB) return -1
        const cmp = dateA.getTime() - dateB.getTime()
        if (cmp !== 0) return cmp
        return a.name.toLowerCase().localeCompare(b.name.toLowerCase())
      })
      allPatients.forEach((patient) => {
        if (dischargeDateRange && (dischargeDateRange.from || dischargeDateRange.to)) {
          const parse = (s: string): Date | null => { const parts = s.split('/'); if (parts.length === 3) return new Date(`${parts[2]}-${parts[1]}-${parts[0]}`); return null }
          const d = parse(patient.dischargeLabel)
          const start = dischargeDateRange.from ? new Date(dischargeDateRange.from) : null
          const end = dischargeDateRange.to ? new Date(dischargeDateRange.to) : null
          const endExclusive = end ? new Date(end.getFullYear(), end.getMonth(), end.getDate() + 1) : null
          const startFloor = start ? new Date(start.getFullYear(), start.getMonth(), start.getDate()) : null
          if (d) {
            if (startFloor && d < startFloor) return
            if (endExclusive && d >= endExclusive) return
          }
        }
        rows.push([idx++, patient.name, patient.medicalRecord, patient.aih, patient.admissionLabel, patient.dischargeLabel, patient.doctorName, patient.pgtAdm, formatCurrency(patient.baseAih), formatCurrency(patient.increment), formatCurrency(patient.aihWithIncrements)])
      })
      const wb = XLSX.utils.book_new()
      const ws = XLSX.utils.aoa_to_sheet([header, ...rows])
        ; (ws as any)['!cols'] = [{ wch: 5 }, { wch: 40 }, { wch: 16 }, { wch: 18 }, { wch: 18 }, { wch: 18 }, { wch: 30 }, { wch: 20 }, { wch: 18 }, { wch: 18 }, { wch: 20 }]
      XLSX.utils.book_append_sheet(wb, ws, 'Pacientes Simplificado')
      const summary = summarizeDedup(filteredDoctors.flatMap((c: any) => c.patients || []), approvedSetRef.current)
      const summarySheet = XLSX.utils.aoa_to_sheet([
        ['AIHs Locais (dedup)', 'Homologadas (SIH)', 'Não Homologadas', 'Duplicatas Detectadas'],
        [summary.aiHsLocais, summary.approved, summary.notApproved, summary.dupCount]
      ])
      XLSX.utils.book_append_sheet(wb, summarySheet, 'Dedup-Teste')
      const fileName = `Relatorio_Pacientes_Simplificado_${formatDateFns(new Date(), 'yyyyMMdd_HHmm')}.xlsx`
      XLSX.writeFile(wb, fileName)
      toast.success('Relatório simplificado gerado com sucesso!')
    } catch (e) {
      console.error('Erro ao exportar Relatório Simplificado:', e)
      toast.error('Erro ao gerar relatório simplificado')
    }
  }

  useEffect(() => {
    const handlerGeneral = () => { generateGeneralPatientsReport() }
    const handlerConference = () => { generateConferencePatientsReport() }
    const handlerSimplified = () => { generateSimplifiedPatientsReport() }
    const handlerValidation = () => { generateValidationReport(selectedHospitals, selectedCompetencia, false, filteredDoctors) }
    window.addEventListener('mpd:report-general', handlerGeneral)
    window.addEventListener('mpd:report-conference', handlerConference)
    window.addEventListener('mpd:report-simplified', handlerSimplified)
    window.addEventListener('mpd:report-validation', handlerValidation)
    return () => {
      window.removeEventListener('mpd:report-general', handlerGeneral)
      window.removeEventListener('mpd:report-conference', handlerConference)
      window.removeEventListener('mpd:report-simplified', handlerSimplified)
      window.removeEventListener('mpd:report-validation', handlerValidation)
    }
  }, [filteredDoctors])

  const validateSimplifiedReport = async (doctor: any) => {
    try {
      approvedSetRef.current = new Set()
      approvalCompetenciaByAihRef.current = new Map()
      const normalizeAih = (s: string) => s.replace(/\D/g, '').replace(/^0+/, '')
      const allAihNumbers = (doctor.patients || [])
        .map((p: any) => normalizeAih(String(p?.aih_info?.aih_number || '').trim()))
        .filter((v: string) => !!v)
      const uniqueAih = Array.from(new Set(allAihNumbers))
      const totalPatients = dedupPatientsByAIH(doctor.patients || []).length
      if (uniqueAih.length === 0) {
        setSimplifiedValidationStats({ total: totalPatients, approved: 0, notApproved: totalPatients, remote: remoteConfigured })
        return
      }
      if (!remoteConfigured) {
        setSimplifiedValidationStats({ total: totalPatients, approved: 0, notApproved: totalPatients, remote: false })
        return
      }
      const { supabaseSih } = await import('../lib/sihSupabase')
      let compYear: number | undefined
      let compMonth: number | undefined
      const chunkSize = 80
      for (let i = 0; i < uniqueAih.length; i += chunkSize) {
        const ch = uniqueAih.slice(i, i + chunkSize)
        const { data: spRows } = await supabaseSih
          .from('sih_sp')
          .select('sp_naih, sp_mm, sp_aa')
          .in('sp_naih', ch)
        if (spRows && spRows.length > 0) {
          spRows.forEach((r: any) => {
            const k = normalizeAih(String(r.sp_naih || '').trim())
            if (k) approvedSetRef.current.add(k)
            const mm = String(r.sp_mm || '').padStart(2, '0')
            const yy = String(r.sp_aa || '').padStart(4, '0')
            if (yy && mm) approvalCompetenciaByAihRef.current.set(k, `${yy}-${mm}-01`)
          })
        }
      }
      const approved = uniqueAih.filter((k: string) => approvedSetRef.current.has(k)).length
      const notApproved = Math.max(totalPatients - approved, 0)
      setSimplifiedValidationStats({ total: totalPatients, approved, notApproved, remote: true })
    } catch {
      setSimplifiedValidationStats({ total: 0, approved: 0, notApproved: 0, remote: remoteConfigured })
    }
  }

  const generateSimplifiedReport = async (
    doctor: any,
    approvedOnly: boolean,
    excludeZeros?: boolean,
    options?: { forceSihSource?: boolean; sourceLabelOverride?: 'TABWIN' | 'GSUS'; outputFormat?: 'pdf' | 'excel' }
  ) => {
    try {
      const sihMode = typeof options?.forceSihSource === 'boolean' ? options.forceSihSource : useSihSource
      let logoBase64 = null as string | null
      try {
        const response = await fetch('/CIS Sem fundo.jpg')
        const blob = await response.blob()
        logoBase64 = await new Promise<string>((resolve) => {
          const reader = new FileReader()
          reader.onloadend = () => resolve(reader.result as string)
          reader.readAsDataURL(blob)
        })
      } catch { }

      const doctorName = doctor.doctor_info?.name || ''
      const hospitalId = doctor.hospitals?.[0]?.hospital_id
      const hospitalName = doctor.hospitals?.[0]?.hospital_name || 'Hospital não identificado'

      // 🆕 DETECÇÃO DE PAGAMENTO FIXO MENSAL
      const isMonthly = isFixedMonthlyPayment(doctorName, hospitalId, ALL_HOSPITAL_RULES)
      const fixedCalcReport = calculateFixedPayment(doctorName, hospitalId, ALL_HOSPITAL_RULES)

      const tableData: Array<Array<string>> = []
      let totalRepasse = 0
      let totalPatientsProcessed = 0
      let patientsWithPayment = 0

      // Mapear nomes de pacientes quando fonte remota está ativa (join local AIH→patients)
      let nameByAih = new Map<string, string>()
      if (sihMode) {
        try {
          const normalizeAih = (s: string) => s.replace(/\D/g, '').replace(/^0+/, '')
          let q = supabase
            .from('aihs')
            .select('aih_number, patient_id, discharge_date, competencia, patients(name)')
          if (hospitalId) q = q.eq('hospital_id', hospitalId)
          if (selectedCompetencia && selectedCompetencia !== 'all') q = q.eq('competencia', selectedCompetencia)
          if (dischargeDateRange && (dischargeDateRange.from || dischargeDateRange.to)) {
            const from = dischargeDateRange.from || undefined
            const to = dischargeDateRange.to || undefined
            const endExclusive = to ? new Date(to) : undefined
            if (endExclusive) endExclusive.setDate(endExclusive.getDate() + 1)
            if (from) q = q.gte('discharge_date', from)
            if (endExclusive) q = q.lt('discharge_date', endExclusive.toISOString().slice(0, 10))
            q = q.not('discharge_date', 'is', null)
          }
          const { data: rows } = await q
            ; (rows || []).forEach((r: any) => {
              const key = normalizeAih(String(r.aih_number || ''))
              const nm = String(r?.patients?.name || '')
              if (key && nm) nameByAih.set(key, nm)
            })
          // Fallback: completar nomes para AIHs faltantes sem filtrar por competência/alta
          const missingAihs = dedupPatientsByAIH(doctor.patients || [])
            .map((p: any) => normalizeAih(String(p?.aih_info?.aih_number || '').trim()))
            .filter(k => k && !nameByAih.has(k))
          if (missingAihs.length > 0) {
            const { data: rows2 } = await supabase
              .from('aihs')
              .select('aih_number, patients(name)')
              .in('aih_number', missingAihs)
              ; (rows2 || []).forEach((r: any) => {
                const key = normalizeAih(String(r.aih_number || ''))
                const nm = String(r?.patients?.name || '')
                if (key && nm && !nameByAih.has(key)) nameByAih.set(key, nm)
              })
          }
        } catch { }
      }

      const patientsDedup = dedupPatientsByAIH(doctor.patients || [])
      patientsDedup.forEach((p: any) => {
        totalPatientsProcessed++
        const aihNumber = normalizeAih(String(p?.aih_info?.aih_number || '').trim())
        if (approvedOnly && (!aihNumber || !approvedSetRef.current.has(aihNumber))) return

        const medicalRecord = p.patient_info?.medical_record || '-'
        let name = p.patient_info?.name || ''
        if (!name || name === 'Nome não disponível' || name === 'Paciente') {
          const candidate = nameByAih.get(aihNumber)
          name = candidate || (name || 'Paciente')
        }
        const procsAll = p.procedures || []
        const cp = (p as any).calculable_procedures
        const calculable = (Array.isArray(cp) && cp.length > 0) ? cp : procsAll.filter(filterCalculableProcedures)
        const mainCandidates = calculable.filter((proc: any) => (typeof proc.registration_instrument === 'string' ? proc.registration_instrument.includes('03') : false) && (proc.cbo !== '225151'))
        let mainProc = mainCandidates.length > 0 ? mainCandidates[0] : null
        if (!mainProc) {
          const seqSorted = calculable.filter((x: any) => x.cbo !== '225151' && typeof x.sequence === 'number').sort((a: any, b: any) => (a.sequence || 9999) - (b.sequence || 9999))
          mainProc = seqSorted[0] || null
        }
        if (!mainProc) {
          mainProc = calculable.filter((x: any) => x.cbo !== '225151').reduce((max: any, proc: any) => {
            const v = typeof proc.value_reais === 'number' ? proc.value_reais : 0
            const mv = typeof (max && max.value_reais) === 'number' ? max.value_reais : -1
            return v > mv ? proc : max
          }, null as any)
        }
        const mainCode = mainProc?.procedure_code || ''
        const mainCodeDigits = mainCode.replace(/\D/g, '')
        const descFallback = mainCode && sigtapMap ? ((sigtapMap.get(mainCode) || sigtapMap.get(mainCodeDigits) || '') as string) : ''
        const mainProcDesc = ((mainProc?.procedure_description || mainProc?.sigtap_description || descFallback || '') as string).trim()
        const medicalForDisplay = calculable
          .filter((x: any) => isMedicalProcedure(x.procedure_code) && shouldCalculateAnesthetistProcedure(x.cbo, x.procedure_code))
          .sort((a: any, b: any) => {
            const sa = typeof a.sequence === 'number' ? a.sequence : 9999
            const sb = typeof b.sequence === 'number' ? b.sequence : 9999
            if (sa !== sb) return sa - sb
            const va = typeof a.value_reais === 'number' ? a.value_reais : 0
            const vb = typeof b.value_reais === 'number' ? b.value_reais : 0
            return vb - va
          })
        // ✅ CORREÇÃO: Mostrar TODOS os procedimentos contemplados (não apenas 2)
        const labels = medicalForDisplay.map((m: any) => {
          const code = m.procedure_code || ''
          const digits = code.replace(/\D/g, '')
          const descFallback2 = code && sigtapMap ? ((sigtapMap.get(code) || sigtapMap.get(digits) || '') as string) : ''
          const desc = ((m.procedure_description || m.sigtap_description || descFallback2 || '') as string).trim()
          return desc || (code ? `Procedimento ${code}` : 'Procedimento')
        })
        const proceduresDisplay = labels.length > 0 ? labels.join(' + ') : (mainProcDesc || (mainCode ? `Procedimento ${mainCode}` : 'Sem procedimento principal'))
        const dischargeISO = p?.aih_info?.discharge_date || ''
        const dischargeLabel = parseISODateToLocal(dischargeISO)
        if (dischargeDateRange && (dischargeDateRange.from || dischargeDateRange.to)) {
          try {
            const d = dischargeISO ? new Date(dischargeISO) : null
            const start = dischargeDateRange.from ? new Date(dischargeDateRange.from) : null
            const end = dischargeDateRange.to ? new Date(dischargeDateRange.to) : null
            const endExclusive = end ? new Date(end.getFullYear(), end.getMonth(), end.getDate() + 1) : null
            if (d) {
              if (start && d < new Date(start.getFullYear(), start.getMonth(), start.getDate())) return
              if (endExclusive && d >= endExclusive) return
            }
          } catch { }
        }

        // ✅ CORREÇÃO (CÓDIGO DUPLICADO): Lógica de pendência sincronizada
        const isApproved = approvedSetRef.current.has(aihNumber);
        const approvedLabel = isApproved ? 'Sim' : 'Não';
        const prodCompISO = (p?.aih_info?.competencia || '') as string
        const prodCompLabel = formatCompetencia(prodCompISO)
        const apprCompISO = approvalCompetenciaByAihRef.current.get(aihNumber)
        const apprCompLabel = apprCompISO ? formatCompetencia(apprCompISO) : ''
        // Destacar produção em vermelho apenas quando mês de alta ≠ competência selecionada
        let highlightProd = false
        if (selectedCompetencia && selectedCompetencia !== 'all') {
          const mDash = selectedCompetencia.match(/^(\d{4})-(\d{2})/)
          const m6 = selectedCompetencia.match(/^(\d{4})(\d{2})$/)
          const selY = mDash ? parseInt(mDash[1], 10) : (m6 ? parseInt(m6[1], 10) : undefined)
          const selM = mDash ? parseInt(mDash[2], 10) : (m6 ? parseInt(m6[2], 10) : undefined)
          if (selY && selM && dischargeISO) {
            const d = new Date(dischargeISO)
            highlightProd = (d.getUTCFullYear() !== selY) || (d.getUTCMonth() + 1 !== selM)
          }
        }
        const disCompISO = (() => {
          if (!dischargeISO) return ''
          const d = new Date(dischargeISO)
          const yy = String(d.getUTCFullYear()).padStart(4, '0')
          const mm = String(d.getUTCMonth() + 1).padStart(2, '0')
          return `${yy}-${mm}-01`
        })()
        const disCompLabel = formatCompetencia(disCompISO)
        const leftLabel = highlightProd ? disCompLabel : prodCompLabel
        const competenciaLabel = isApproved
          ? (apprCompLabel ? `${highlightProd ? '§' : ''}${leftLabel} | ${apprCompLabel}` : `${highlightProd ? '§' : ''}${leftLabel}`)
          : ''

        // ✅ CORREÇÃO FINAL: Usar p.procedures diretamente (IGUAL ao card do paciente)
        // O card usa patient.procedures, então o relatório deve usar p.procedures
        const aihKey = (p as any).aih_id || normalizeAihNumber(p?.aih_info?.aih_number) || '__single__'
        const cp2 = (p as any).calculable_procedures
        const baseProcedures = (Array.isArray(cp2) && cp2.length > 0) ? cp2 : getCalculableProcedures(
          ((p.procedures || []) as any[]).map((proc: any) => ({
            ...proc,
            aih_id: proc.aih_id || aihKey,
            sequence: proc.sequence ?? proc.sequencia ?? proc.procedure_sequence
          }))
        )
        const proceduresWithPayment = (baseProcedures as any[])
          .filter((proc: any) => isMedicalProcedure(proc.procedure_code))
          .sort((a: any, b: any) => {
            // Ordenar por sequence primeiro, depois por valor (decrescente)
            const sa = typeof a.sequence === 'number' ? a.sequence : 9999;
            const sb = typeof b.sequence === 'number' ? b.sequence : 9999;
            if (sa !== sb) return sa - sb;
            const va = typeof a.value_reais === 'number' ? a.value_reais : 0;
            const vb = typeof b.value_reais === 'number' ? b.value_reais : 0;
            return vb - va;
          })
          .map((proc: any) => ({
            procedure_code: proc.procedure_code,
            procedure_description: proc.procedure_description,
            value_reais: proc.value_reais || 0,
            cbo: proc.cbo,
            sequence: proc.sequence,
          }))
        let repasseValue = 0
        if (proceduresWithPayment.length > 0) {
          const isGenSurg = /cirurg/i.test(doctorName) || (/cirurg/i.test(doctor.doctor_info.specialty || '') && /geral/i.test(doctor.doctor_info.specialty || ''))
          const useHon = shouldUseHonForHospital(doctorName, hospitalId, !!isGenSurg)
          const paymentResult = useHon
            ? calculateHonPayments(proceduresWithPayment)
            : calculateDoctorPayment(
              doctorName,
              proceduresWithPayment,
              hospitalId
            )

          // Se for fixo mensal, o repasse por paciente deve ser ZERO para não multiplicar
          if (isMonthly) {
            repasseValue = 0
          } else {
            repasseValue = paymentResult.totalPayment || 0
          }

          totalRepasse += repasseValue

          // 🔍 DEBUG: Log detalhado para verificar cálculo
          if (name.includes('CICERO') || proceduresWithPayment.length >= 3) {
            console.log(`🔍 [DEBUG RELATÓRIO] Paciente: ${name}`)
            console.log(`   📋 Procedimentos: ${proceduresWithPayment.map(p => p.procedure_code).join(', ')}`)
            console.log(`   💰 Valor calculado: R$ ${repasseValue.toFixed(2)}`)
            console.log(`   📝 Regra aplicada: ${paymentResult.appliedRule || 'N/A'}`)
            paymentResult.procedures.forEach((p, i) => {
              console.log(`   [${i + 1}] ${p.procedure_code}: R$ ${p.calculatedPayment.toFixed(2)} - ${p.paymentRule}`)
            })
          }
        }
        const careRaw = (p?.aih_info?.care_character ?? '').toString().trim()
        const careNum = careRaw.replace(/^0+/, '')
        const careAscii = careRaw
          .normalize('NFD')
          .replace(/\p{Diacritic}/gu, '')
          .toLowerCase()
        const isElective = careNum === '1' || careAscii === 'eletivo'
        const has04 = proceduresWithPayment.length > 0
        if (!excludeZeros || repasseValue > 0 || (isElective && has04)) {
          const doctorSource = (p?.aih_info as any)?.doctor_source
          const aihDisplay = (sihMode && options?.sourceLabelOverride === 'TABWIN' && doctorSource === 'GSUS')
            ? `${aihNumber || '-'} (GSUS)`
            : (aihNumber || '-')
          patientsWithPayment++
          tableData.push([
            '',
            medicalRecord,
            aihDisplay,
            name,
            proceduresDisplay,
            dischargeLabel,
            formatCurrency(repasseValue)
          ])
        }
      })

      const normalizeSortText = (s: unknown): string => {
        return (s ?? '')
          .toString()
          .normalize('NFD')
          .replace(/\p{Diacritic}/gu, '')
          .trim()
          .toUpperCase()
      }
      const parseBrCurrency = (s: unknown): number => {
        const raw = (s ?? '').toString()
        const cleaned = raw
          .replace(/[^\d,.-]/g, '')
          .replace(/\./g, '')
          .replace(/,/, '.')
        const n = Number(cleaned)
        return Number.isFinite(n) ? n : 0
      }
      tableData.sort((a, b) => {
        const repA = parseBrCurrency(a[6])
        const repB = parseBrCurrency(b[6])
        if (repA !== repB) return repB - repA
        const procA = normalizeSortText(a[4])
        const procB = normalizeSortText(b[4])
        const procCmp = procA.localeCompare(procB, 'pt-BR')
        if (procCmp !== 0) return procCmp
        const nameA = normalizeSortText(a[3])
        const nameB = normalizeSortText(b[3])
        return nameA.localeCompare(nameB, 'pt-BR')
      })
      tableData.forEach((row, idx) => { row[0] = String(idx + 1) })

      // 🆕 ADICIONAR LINHA DE TOTAL FIXO MENSAL SE APLICÁVEL
      if (isMonthly && fixedCalcReport.hasFixedRule) {
        tableData.push([
          '',
          '',
          '',
          'PAGAMENTO FIXO MENSAL',
          fixedCalcReport.appliedRule || 'Valor Fixo',
          '-',
          formatCurrency(fixedCalcReport.calculatedPayment)
        ])
        // Ajustar o total geral para ser o valor fixo (já que os individuais são 0)
        totalRepasse = fixedCalcReport.calculatedPayment
      }

      if (options?.outputFormat === 'excel') {
        const sourceLabel = options.sourceLabelOverride ?? (sihMode ? 'TABWIN' : 'GSUS')
        const header = ['#', 'Prontuário', 'Nº da AIH', 'Nome do Paciente', 'Procedimentos', 'Data Alta', 'Valor de Repasse']
        const rows = tableData.map(r => [r[0], r[1], r[2], r[3], r[4], r[5], r[6]])

        const wb = XLSX.utils.book_new()
        const ws = XLSX.utils.aoa_to_sheet([header, ...rows])
        ;(ws as any)['!cols'] = [
          { wch: 5 },
          { wch: 18 },
          { wch: 18 },
          { wch: 40 },
          { wch: 70 },
          { wch: 14 },
          { wch: 18 }
        ]
        XLSX.utils.book_append_sheet(wb, ws, 'Repasse')

        const summarySheet = XLSX.utils.aoa_to_sheet([
          ['Fonte', sourceLabel],
          ['Médico', doctorName || ''],
          ['Hospital', hospitalName || ''],
          ['Linhas', rows.length],
          ['Valor Total', totalRepasse],
          ['Gerado em', formatDateFns(new Date(), 'dd/MM/yyyy HH:mm')]
        ])
        XLSX.utils.book_append_sheet(wb, summarySheet, 'Resumo')

        const safeDoctor = (doctorName || 'Medico').replace(/\s+/g, '_')
        const fileName = `Repasse_Medico_${sourceLabel}_${safeDoctor}_${formatDateFns(new Date(), 'yyyyMMdd_HHmm')}.xlsx`
        XLSX.writeFile(wb, fileName)
        toast.success('Relatório Excel gerado com sucesso!')
        return
      }

      const runPdf = (rowsOverride: Array<Array<string>>) => {
        const rows = (rowsOverride || []).map((r, idx) => {
          const out = [...r]
          out[0] = String(idx + 1)
          return out
        })
        const totalRepasseCalc = rows.reduce((s, r) => s + parseBrCurrency(r[6]), 0)
        const patientsCount = rows.length

        const doc = new jsPDF('landscape')
        const pageWidth = doc.internal.pageSize.getWidth()
        const pageHeight = doc.internal.pageSize.getHeight()
        try {
          const sourceLabel = options?.sourceLabelOverride ?? (sihMode ? 'TABWIN' : 'GSUS')
          doc.setFontSize(10)
          doc.setFont('helvetica', 'bold')
          doc.setTextColor(80, 80, 80)
          doc.text(sourceLabel, pageWidth - 20, 10, { align: 'right' })
        } catch { }
        let yPosition = 20
        if (logoBase64) {
          const logoWidth = 40
          const logoHeight = 20
          const logoX = 20
          const logoY = 8
          doc.addImage(logoBase64, 'JPEG', logoX, logoY, logoWidth, logoHeight)
          yPosition = logoY + logoHeight + 10
        }
        doc.setFontSize(16)
        doc.setFont('helvetica', 'bold')
        doc.setTextColor(0, 51, 102)
        doc.text('RELATÓRIO DE PACIENTES - MÉDICO', pageWidth / 2, yPosition, { align: 'center' })
        yPosition += 10
        const careHeader = (filterCareCharacter && filterCareCharacter !== 'all')
          ? CareCharacterUtils.formatForDisplay(filterCareCharacter, false)
          : 'TODOS'
        const compHeader = (selectedCompetencia && selectedCompetencia !== 'all')
          ? formatCompetencia(selectedCompetencia)
          : 'TODAS'
        const dataGeracao = new Date().toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
        const line1 = [
          { label: 'Médico: ', value: doctorName, bold: true },
          { label: 'Hospital: ', value: hospitalName }
        ]
        const line2 = [
          { label: 'Comp. Aprovação: ', value: compHeader },
          { label: 'Caráter: ', value: careHeader },
          { label: 'Gerado em: ', value: dataGeracao }
        ]
        const separator = '  |  '
        const drawSegments = (segments: Array<{ label: string; value: string; bold?: boolean }>, y: number, fontSize = 10) => {
          doc.setFontSize(fontSize)
          doc.setTextColor(60, 60, 60)
          let totalWidth = 0
          segments.forEach((seg, idx) => {
            totalWidth += doc.getTextWidth(seg.label) + doc.getTextWidth(seg.value)
            if (idx < segments.length - 1) totalWidth += doc.getTextWidth(separator)
          })
          let x = (pageWidth / 2) - (totalWidth / 2)
          segments.forEach((seg, idx) => {
            doc.setFont('helvetica', 'normal')
            doc.text(seg.label, x, y)
            x += doc.getTextWidth(seg.label)
            doc.setFont('helvetica', seg.bold ? 'bold' : 'normal')
            doc.text(seg.value, x, y)
            x += doc.getTextWidth(seg.value)
            if (idx < segments.length - 1) {
              doc.setFont('helvetica', 'normal')
              doc.setTextColor(100, 100, 100)
              doc.text(separator, x, y)
              doc.setTextColor(60, 60, 60)
              x += doc.getTextWidth(separator)
            }
          })
        }
        drawSegments(line1, yPosition, 11)
        yPosition += 6
        drawSegments(line2, yPosition, 10)
        yPosition += 8
        doc.setDrawColor(200, 200, 200)
        doc.setLineWidth(0.5)
        doc.line(20, yPosition, pageWidth - 20, yPosition)
        const metricY = yPosition + 7
        doc.setFontSize(10)
        doc.setTextColor(60, 60, 60)
        doc.text('Pacientes:', 20, metricY)
        doc.setFont('helvetica', 'bold')
        doc.setTextColor(0, 51, 102)
        doc.text(String(patientsCount), 48, metricY)
        doc.setFont('helvetica', 'normal')
        doc.setTextColor(60, 60, 60)
        doc.text('Valor Total:', pageWidth - 90, metricY)
        doc.setFont('helvetica', 'bold')
        doc.setTextColor(0, 102, 0)
        doc.text(formatCurrency(totalRepasseCalc), pageWidth - 20, metricY, { align: 'right' })
        const startY = yPosition + 16
        autoTable(doc, {
          head: [['#', 'Prontuário', 'Nº da AIH', 'Nome do Paciente', 'Procedimentos', 'Data Alta', 'Valor de Repasse']],
          body: rows,
          startY,
          theme: 'striped',
          tableWidth: 'auto',
          headStyles: { fillColor: [0, 51, 102], textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 9, halign: 'center', cellPadding: 2 },
          bodyStyles: { fontSize: 8, textColor: [50, 50, 50], cellPadding: 2 },
          columnStyles: {
            0: { cellWidth: 'auto', halign: 'center' },
            1: { cellWidth: 'auto', halign: 'center' },
            2: { cellWidth: 'auto', halign: 'center' },
            3: { cellWidth: 'auto', halign: 'left' },
            4: { cellWidth: 'auto', halign: 'left', fontSize: 7 },
            5: { cellWidth: 'auto', halign: 'center' },
            6: { cellWidth: 'auto', halign: 'right', fontStyle: 'bold', textColor: [0, 102, 0] }
          },
          styles: { overflow: 'linebreak', cellPadding: 2, fontSize: 8 },
          margin: { left: 20, right: 20 },
          alternateRowStyles: { fillColor: [245, 245, 245] },
        })
        const finalY = (doc as any).lastAutoTable?.finalY || startY + 50
        const footerBaseY = pageHeight - 20
        doc.setDrawColor(200, 200, 200)
        doc.setLineWidth(0.5)
        const lineY = Math.max(finalY + 8, footerBaseY - 10)
        doc.line(20, lineY, pageWidth - 20, lineY)
        doc.setFontSize(8)
        doc.setFont('helvetica', 'normal')
        doc.setTextColor(120, 120, 120)
        doc.text('CIS - Centro Integrado em Saúde', pageWidth / 2, lineY + 5, { align: 'center' })
        doc.setFontSize(9)
        doc.setFont('helvetica', 'bold')
        doc.setTextColor(0, 51, 102)
        doc.text(`Valor Total de Repasse: ${formatCurrency(totalRepasseCalc)}`, pageWidth / 2, lineY + 15, { align: 'center' })
        const fileName = `Relatorio_Pacientes_Simplificado_${doctorName.replace(/\\s+/g, '_')}_${formatDateFns(new Date(), 'yyyyMMdd_HHmm')}.pdf`
        doc.save(fileName)
      }

      simplifiedPreviewConfirmRef.current = runPdf
      setSimplifiedPreviewRows(tableData)
      setSimplifiedPreviewOpen(true)
      return
    } catch (err) {
      console.error('Erro ao exportar Relatório Simplificado (PDF):', err)
      toast.error('Erro ao gerar relatório PDF')
    }
  }

  const generateSimplifiedReportFromSih = async (doctor: any, excludeZeros?: boolean, outputFormat: 'pdf' | 'excel' = 'pdf') => {
    try {
      if (!remoteConfigured) {
        toast.error('Fonte SIH remota não configurada')
        return
      }
      const hospitalIds =
        selectedHospitals && !selectedHospitals.includes('all')
          ? selectedHospitals
          : undefined
      const competenciaFilter =
        selectedCompetencia &&
        selectedCompetencia !== 'all' &&
        selectedCompetencia.trim()
          ? selectedCompetencia.trim()
          : undefined
      const careFilter =
        filterCareCharacter && filterCareCharacter !== 'all'
          ? filterCareCharacter
          : undefined

      const loadOptions: any = {
        hospitalIds,
        competencia: competenciaFilter
      }
      if (careFilter) loadOptions.filterCareCharacter = careFilter
      if (dischargeDateRange && (dischargeDateRange.from || dischargeDateRange.to)) {
        loadOptions.dischargeDateRange = {
          from: dischargeDateRange.from,
          to: dischargeDateRange.to
        }
      }

      const { SihApiAdapter } = await import('../services/sihApiAdapter')
      const remoteDocs = await SihApiAdapter.getDoctorsWithPatients(loadOptions)
      if (!remoteDocs || remoteDocs.length === 0) {
        toast.warning('Nenhum dado encontrado na fonte SIH para os filtros atuais')
        return
      }

      const targetCns = String(doctor?.doctor_info?.cns || '').trim()
      const targetName = String(doctor?.doctor_info?.name || '').trim().toLowerCase()

      let remoteDoc =
        targetCns &&
        remoteDocs.find(
          (d: any) => String(d?.doctor_info?.cns || '').trim() === targetCns
        )

      if (!remoteDoc) {
        remoteDoc = remoteDocs.find(
          (d: any) =>
            String(d?.doctor_info?.name || '').trim().toLowerCase() ===
            targetName
        )
      }

      if (!remoteDoc) {
        toast.warning(
          'Nenhum dado remoto SIH encontrado para este médico com os filtros atuais'
        )
        return
      }

      await generateSimplifiedReport(remoteDoc, false, excludeZeros, { forceSihSource: true, sourceLabelOverride: 'TABWIN', outputFormat })
    } catch (err) {
      console.error('Erro ao gerar relatório simplificado SIH:', err)
      toast.error('Erro ao gerar relatório SIH')
    }
  }

  const relateReportOptions = [
    'Relatório Pacientes',
    'Relatório Pacientes Simplificado',
    'Repasse Médico (TABWIN)',
    'Relatório Simplificado (Sem Zeros)'
  ] as const

  const normalizeAihKey = (s: unknown): string => {
    return String(s ?? '').replace(/\D/g, '').replace(/^0+/, '')
  }

  const loadRemoteDoctorForCard = async (doctor: any) => {
    if (!remoteConfigured) return null

    const hospitalIds =
      selectedHospitals && !selectedHospitals.includes('all')
        ? selectedHospitals
        : undefined
    const competenciaFilter =
      selectedCompetencia &&
      selectedCompetencia !== 'all' &&
      selectedCompetencia.trim()
        ? selectedCompetencia.trim()
        : undefined
    const careFilter =
      filterCareCharacter && filterCareCharacter !== 'all'
        ? filterCareCharacter
        : undefined

    const loadOptions: any = {
      hospitalIds,
      competencia: competenciaFilter
    }
    if (careFilter) loadOptions.filterCareCharacter = careFilter
    if (dischargeDateRange && (dischargeDateRange.from || dischargeDateRange.to)) {
      loadOptions.dischargeDateRange = {
        from: dischargeDateRange.from,
        to: dischargeDateRange.to
      }
    }

    const { SihApiAdapter } = await import('../services/sihApiAdapter')
    const remoteDocs = await SihApiAdapter.getDoctorsWithPatients(loadOptions)
    if (!remoteDocs || remoteDocs.length === 0) return null

    const targetCns = String(doctor?.doctor_info?.cns || '').trim()
    const targetName = String(doctor?.doctor_info?.name || '').trim().toLowerCase()

    let remoteDoc =
      targetCns &&
      remoteDocs.find(
        (d: any) => String(d?.doctor_info?.cns || '').trim() === targetCns
      )

    if (!remoteDoc) {
      remoteDoc = remoteDocs.find(
        (d: any) =>
          String(d?.doctor_info?.name || '').trim().toLowerCase() === targetName
      )
    }

    return remoteDoc || null
  }

  const buildSimplifiedTableData = async (
    doctor: any,
    excludeZeros: boolean,
    sihMode: boolean
  ): Promise<{ tableData: Array<Array<string>>; totalRepasse: number }> => {
    const doctorName = doctor?.doctor_info?.name || ''
    const hospitalId = doctor?.hospitals?.[0]?.hospital_id

    const tableData: Array<Array<string>> = []
    let totalRepasse = 0

    let nameByAih = new Map<string, string>()
    if (sihMode) {
      try {
        let q = supabase
          .from('aihs')
          .select('aih_number, hospital_id, discharge_date, competencia, patients(name)')
        if (hospitalId) q = q.eq('hospital_id', hospitalId)
        if (selectedCompetencia && selectedCompetencia !== 'all') q = q.eq('competencia', selectedCompetencia)
        if (dischargeDateRange && (dischargeDateRange.from || dischargeDateRange.to)) {
          const from = dischargeDateRange.from || undefined
          const to = dischargeDateRange.to || undefined
          const endExclusive = to ? new Date(to) : undefined
          if (endExclusive) endExclusive.setDate(endExclusive.getDate() + 1)
          if (from) q = q.gte('discharge_date', from)
          if (endExclusive) q = q.lt('discharge_date', endExclusive.toISOString().slice(0, 10))
          q = q.not('discharge_date', 'is', null)
        }
        const { data: rows } = await q
        ;(rows || []).forEach((r: any) => {
          const key = normalizeAihKey(String(r.aih_number || ''))
          const nm = String(r?.patients?.name || '')
          if (key && nm) nameByAih.set(key, nm)
        })
      } catch { }
    }

    const patientsDedup = dedupPatientsByAIH(doctor.patients || [])
    patientsDedup.forEach((p: any) => {
      const aihNumber = normalizeAihKey(String(p?.aih_info?.aih_number || '').trim())
      const medicalRecord = p.patient_info?.medical_record || '-'
      let name = p.patient_info?.name || ''
      if (!name || name === 'Nome não disponível' || name === 'Paciente') {
        const candidate = nameByAih.get(aihNumber)
        name = candidate || (name || 'Paciente')
      }

      const procsAll = p.procedures || []
      const cp = (p as any).calculable_procedures
      const calculable = (Array.isArray(cp) && cp.length > 0) ? cp : procsAll.filter(filterCalculableProcedures)

      const mainCandidates = calculable.filter((proc: any) => (typeof proc.registration_instrument === 'string' ? proc.registration_instrument.includes('03') : false) && (proc.cbo !== '225151'))
      let mainProc = mainCandidates.length > 0 ? mainCandidates[0] : null
      if (!mainProc) {
        const seqSorted = calculable.filter((x: any) => x.cbo !== '225151' && typeof x.sequence === 'number').sort((a: any, b: any) => (a.sequence || 9999) - (b.sequence || 9999))
        mainProc = seqSorted[0] || null
      }
      if (!mainProc) {
        mainProc = calculable.filter((x: any) => x.cbo !== '225151').reduce((max: any, proc: any) => {
          const v = typeof proc.value_reais === 'number' ? proc.value_reais : 0
          const mv = typeof (max && max.value_reais) === 'number' ? max.value_reais : -1
          return v > mv ? proc : max
        }, null as any)
      }
      const mainCode = mainProc?.procedure_code || ''
      const mainCodeDigits = mainCode.replace(/\D/g, '')
      const descFallback = mainCode && sigtapMap ? ((sigtapMap.get(mainCode) || sigtapMap.get(mainCodeDigits) || '') as string) : ''
      const mainProcDesc = ((mainProc?.procedure_description || mainProc?.sigtap_description || descFallback || '') as string).trim()

      const medicalForDisplay = calculable
        .filter((x: any) => isMedicalProcedure(x.procedure_code) && shouldCalculateAnesthetistProcedure(x.cbo, x.procedure_code))
        .sort((a: any, b: any) => {
          const sa = typeof a.sequence === 'number' ? a.sequence : 9999
          const sb = typeof b.sequence === 'number' ? b.sequence : 9999
          if (sa !== sb) return sa - sb
          const va = typeof a.value_reais === 'number' ? a.value_reais : 0
          const vb = typeof b.value_reais === 'number' ? b.value_reais : 0
          return vb - va
        })

      const labels = medicalForDisplay.map((m: any) => {
        const code = m.procedure_code || ''
        const digits = code.replace(/\D/g, '')
        const descFallback2 = code && sigtapMap ? ((sigtapMap.get(code) || sigtapMap.get(digits) || '') as string) : ''
        const desc = ((m.procedure_description || m.sigtap_description || descFallback2 || '') as string).trim()
        return desc || (code ? `Procedimento ${code}` : 'Procedimento')
      })
      const proceduresDisplay = labels.length > 0 ? labels.join(' + ') : (mainProcDesc || (mainCode ? `Procedimento ${mainCode}` : 'Sem procedimento principal'))

      const dischargeISO = p?.aih_info?.discharge_date || ''
      const dischargeLabel = parseISODateToLocal(dischargeISO)

      if (dischargeDateRange && (dischargeDateRange.from || dischargeDateRange.to)) {
        try {
          const d = dischargeISO ? new Date(dischargeISO) : null
          const start = dischargeDateRange.from ? new Date(dischargeDateRange.from) : null
          const end = dischargeDateRange.to ? new Date(dischargeDateRange.to) : null
          const endExclusive = end ? new Date(end.getFullYear(), end.getMonth(), end.getDate() + 1) : null
          if (d) {
            if (start && d < new Date(start.getFullYear(), start.getMonth(), start.getDate())) return
            if (endExclusive && d >= endExclusive) return
          }
        } catch { }
      }

      const aihKey = (p as any).aih_id || normalizeAihNumber(p?.aih_info?.aih_number) || '__single__'
      const cp2 = (p as any).calculable_procedures
      const baseProcedures = (Array.isArray(cp2) && cp2.length > 0) ? cp2 : getCalculableProcedures(
        ((p.procedures || []) as any[]).map((proc: any) => ({
          ...proc,
          aih_id: proc.aih_id || aihKey,
          sequence: proc.sequence ?? proc.sequencia ?? proc.procedure_sequence
        }))
      )
      const proceduresWithPayment = (baseProcedures as any[])
        .filter((proc: any) => isMedicalProcedure(proc.procedure_code))
        .sort((a: any, b: any) => {
          const sa = typeof a.sequence === 'number' ? a.sequence : 9999
          const sb = typeof b.sequence === 'number' ? b.sequence : 9999
          if (sa !== sb) return sa - sb
          const va = typeof a.value_reais === 'number' ? a.value_reais : 0
          const vb = typeof b.value_reais === 'number' ? b.value_reais : 0
          return vb - va
        })
        .map((proc: any) => ({
          procedure_code: proc.procedure_code,
          procedure_description: proc.procedure_description,
          value_reais: proc.value_reais || 0,
          cbo: proc.cbo,
          sequence: proc.sequence,
        }))

      let repasseValue = 0
      if (proceduresWithPayment.length > 0) {
        const isMonthly = isFixedMonthlyPayment(doctorName, hospitalId, ALL_HOSPITAL_RULES)
        const isGenSurg = /cirurg/i.test(doctorName) || (/cirurg/i.test(doctor?.doctor_info?.specialty || '') && /geral/i.test(doctor?.doctor_info?.specialty || ''))
        const useHon = shouldUseHonForHospital(doctorName, hospitalId, !!isGenSurg)
        const paymentResult = useHon
          ? calculateHonPayments(proceduresWithPayment)
          : calculateDoctorPayment(
            doctorName,
            proceduresWithPayment,
            hospitalId
          )
        repasseValue = isMonthly ? 0 : (paymentResult.totalPayment || 0)
      }

      const careRaw = (p?.aih_info?.care_character ?? '').toString().trim()
      const careNum = careRaw.replace(/^0+/, '')
      const careAscii = careRaw
        .normalize('NFD')
        .replace(/\p{Diacritic}/gu, '')
        .toLowerCase()
      const isElective = careNum === '1' || careAscii === 'eletivo'
      const has04 = proceduresWithPayment.length > 0
      if (!excludeZeros || repasseValue > 0 || (isElective && has04)) {
        totalRepasse += repasseValue
        tableData.push([
          '',
          medicalRecord,
          aihNumber || '-',
          name,
          proceduresDisplay,
          dischargeLabel,
          formatCurrency(repasseValue)
        ])
      }
    })

    const normalizeSortText = (s: unknown): string => {
      return (s ?? '')
        .toString()
        .normalize('NFD')
        .replace(/\p{Diacritic}/gu, '')
        .trim()
        .toUpperCase()
    }
    const parseBrCurrency = (s: unknown): number => {
      const raw = (s ?? '').toString()
      const cleaned = raw
        .replace(/[^\d,.-]/g, '')
        .replace(/\./g, '')
        .replace(/,/, '.')
      const n = Number(cleaned)
      return Number.isFinite(n) ? n : 0
    }
    tableData.sort((a, b) => {
      const repA = parseBrCurrency(a[6])
      const repB = parseBrCurrency(b[6])
      if (repA !== repB) return repB - repA
      const procA = normalizeSortText(a[4])
      const procB = normalizeSortText(b[4])
      const procCmp = procA.localeCompare(procB, 'pt-BR')
      if (procCmp !== 0) return procCmp
      const nameA = normalizeSortText(a[3])
      const nameB = normalizeSortText(b[3])
      return nameA.localeCompare(nameB, 'pt-BR')
    })
    tableData.forEach((row, idx) => { row[0] = String(idx + 1) })

    return { tableData, totalRepasse }
  }

  const buildRelateDataset = async (doctor: any, reportLabel: string) => {
    if (reportLabel === 'Repasse Médico (TABWIN)') {
      const remoteDoc = await loadRemoteDoctorForCard(doctor)
      if (!remoteDoc) throw new Error('Nenhum dado remoto SIH encontrado')
      return buildSimplifiedTableData(remoteDoc, false, true)
    }
    if (reportLabel === 'Relatório Simplificado (Sem Zeros)') {
      return buildSimplifiedTableData(doctor, true, Boolean(useSihSource))
    }
    if (reportLabel === 'Relatório Pacientes Simplificado') {
      return buildSimplifiedTableData(doctor, false, Boolean(useSihSource))
    }
    return buildSimplifiedTableData(doctor, false, false)
  }

  const buildValueConferenceBaseDataset = async (
    doctor: any
  ): Promise<{ tableData: Array<Array<string>>; totalAih: number }> => {
    const tableData: Array<Array<string>> = []
    let totalAih = 0

    const patientsDedup = dedupPatientsByAIH(doctor.patients || [])
    patientsDedup.forEach((p: any) => {
      const aihNumber = normalizeAihKey(String(p?.aih_info?.aih_number || '').trim())
      const name = p.patient_info?.name || 'Paciente'

      const procsAll = p.procedures || []
      const cp = (p as any).calculable_procedures
      const calculable = (Array.isArray(cp) && cp.length > 0) ? cp : procsAll.filter(filterCalculableProcedures)

      const medicalForDisplay = calculable
        .filter((x: any) => isMedicalProcedure(x.procedure_code) && shouldCalculateAnesthetistProcedure(x.cbo, x.procedure_code))
        .sort((a: any, b: any) => {
          const sa = typeof a.sequence === 'number' ? a.sequence : 9999
          const sb = typeof b.sequence === 'number' ? b.sequence : 9999
          if (sa !== sb) return sa - sb
          const va = typeof a.value_reais === 'number' ? a.value_reais : 0
          const vb = typeof b.value_reais === 'number' ? b.value_reais : 0
          return vb - va
        })

      const labels = medicalForDisplay.map((m: any) => {
        const code = m.procedure_code || ''
        const digits = code.replace(/\D/g, '')
        const descFallback2 = code && sigtapMap ? ((sigtapMap.get(code) || sigtapMap.get(digits) || '') as string) : ''
        const desc = ((m.procedure_description || m.sigtap_description || descFallback2 || '') as string).trim()
        return desc || (code ? `Procedimento ${code}` : 'Procedimento')
      })
      const proceduresDisplay = labels.length > 0 ? labels.join(' + ') : 'Sem procedimentos'

      const dischargeISO = p?.aih_info?.discharge_date || ''
      const dischargeLabel = parseISODateToLocal(dischargeISO)

      if (dischargeDateRange && (dischargeDateRange.from || dischargeDateRange.to)) {
        try {
          const d = dischargeISO ? new Date(dischargeISO) : null
          const start = dischargeDateRange.from ? new Date(dischargeDateRange.from) : null
          const end = dischargeDateRange.to ? new Date(dischargeDateRange.to) : null
          const endExclusive = end ? new Date(end.getFullYear(), end.getMonth(), end.getDate() + 1) : null
          if (d) {
            if (start && d < new Date(start.getFullYear(), start.getMonth(), start.getDate())) return
            if (endExclusive && d >= endExclusive) return
          }
        } catch { }
      }

      const localTotal = Number((p as any).total_value_reais || 0)
      totalAih += localTotal

      tableData.push([
        '',
        aihNumber || '-',
        name,
        proceduresDisplay,
        dischargeLabel,
        formatCurrency(localTotal)
      ])
    })

    const parseBrCurrency = (s: unknown): number => {
      const raw = (s ?? '').toString()
      const cleaned = raw
        .replace(/[^\d,.-]/g, '')
        .replace(/\./g, '')
        .replace(/,/, '.')
      const n = Number(cleaned)
      return Number.isFinite(n) ? n : 0
    }

    tableData.sort((a, b) => parseBrCurrency(b[5]) - parseBrCurrency(a[5]))
    tableData.forEach((row, idx) => { row[0] = String(idx + 1) })

    return { tableData, totalAih }
  }

  const handleValueConferenceCompare = async () => {
    const doctor = valueConferenceDoctor
    if (!doctor) return

    setValueConferenceLoading(true)
    try {
      if (!remoteConfigured) {
        toast.error('Fonte SIH remota não configurada')
        return
      }

      const hospitalId = doctor?.hospitals?.[0]?.hospital_id
      const hospital = availableHospitals.find(h => h.id === hospitalId)
      const cnes = (hospital as any)?.cnes ? String((hospital as any).cnes) : ''
      if (!cnes) {
        toast.error('Hospital sem CNES configurado para consulta no SIH RD')
        return
      }

      const base = await buildValueConferenceBaseDataset(doctor)
      const normalizeAih = (s: unknown) => String(s ?? '').replace(/\D/g, '').replace(/^0+/, '')

      let month: number | undefined
      let year: number | undefined
      if (selectedCompetencia && selectedCompetencia !== 'all') {
        const raw = selectedCompetencia.trim()
        if (/^\d{6}$/.test(raw)) {
          year = parseInt(raw.slice(0, 4), 10)
          month = parseInt(raw.slice(4, 6), 10)
        } else {
          const mDash = raw.match(/^(\d{4})-(\d{2})/)
          const mSlash = raw.match(/^(\d{2})\/(\d{4})$/)
          if (mDash) { year = parseInt(mDash[1], 10); month = parseInt(mDash[2], 10) }
          else if (mSlash) { month = parseInt(mSlash[1], 10); year = parseInt(mSlash[2], 10) }
        }
      }

      const remoteMap = new Map<string, number>()
      const careFilter = (filterCareCharacter && filterCareCharacter !== 'all') ? filterCareCharacter : undefined
      const carIntValue = careFilter ? (careFilter === '1' ? '01' : careFilter === '2' ? '02' : String(careFilter)) : undefined

      if (typeof month === 'number' && typeof year === 'number') {
        let q = supabaseSih
          .from('sih_rd')
          .select('n_aih,val_tot')
          .eq('cnes', cnes)
          .eq('mes_cmpt', month)
          .eq('ano_cmpt', year)
        if (carIntValue) q = q.eq('car_int', carIntValue)
        if (dischargeDateRange && (dischargeDateRange.from || dischargeDateRange.to)) {
          const from = dischargeDateRange.from || undefined
          const to = dischargeDateRange.to || undefined
          const endExclusive = to ? new Date(to) : undefined
          if (endExclusive) endExclusive.setDate(endExclusive.getDate() + 1)
          if (from) q = q.gte('dt_saida', from)
          if (endExclusive) q = q.lt('dt_saida', endExclusive.toISOString().slice(0, 10))
          q = q.not('dt_saida', 'is', null)
        }
        const { data: rdRows, error } = await q
        if (error) throw error
        for (const r of rdRows || []) {
          const key = normalizeAih((r as any).n_aih)
          if (!key) continue
          const val = Number((r as any).val_tot || 0)
          const prev = remoteMap.get(key)
          remoteMap.set(key, typeof prev === 'number' ? Math.max(prev, val) : val)
        }
      } else {
        const baseKeys = Array.from(new Set((base.tableData || []).map(r => normalizeAih(r?.[1])).filter(Boolean)))
        const candidates = Array.from(new Set(baseKeys.flatMap(k => {
          const padded = k.length < 13 ? k.padStart(13, '0') : k
          return [k, padded]
        }))).filter(Boolean)
        const chunkSize = 80
        for (let i = 0; i < candidates.length; i += chunkSize) {
          const ch = candidates.slice(i, i + chunkSize)
          let q = supabaseSih
            .from('sih_rd')
            .select('n_aih,val_tot')
            .eq('cnes', cnes)
            .in('n_aih', ch)
          if (carIntValue) q = q.eq('car_int', carIntValue)
          if (dischargeDateRange && (dischargeDateRange.from || dischargeDateRange.to)) {
            const from = dischargeDateRange.from || undefined
            const to = dischargeDateRange.to || undefined
            const endExclusive = to ? new Date(to) : undefined
            if (endExclusive) endExclusive.setDate(endExclusive.getDate() + 1)
            if (from) q = q.gte('dt_saida', from)
            if (endExclusive) q = q.lt('dt_saida', endExclusive.toISOString().slice(0, 10))
            q = q.not('dt_saida', 'is', null)
          }
          const { data: rdRows } = await q
          for (const r of rdRows || []) {
            const key = normalizeAih((r as any).n_aih)
            if (!key) continue
            const val = Number((r as any).val_tot || 0)
            const prev = remoteMap.get(key)
            remoteMap.set(key, typeof prev === 'number' ? Math.max(prev, val) : val)
          }
        }
      }

      const parseBrCurrency = (s: unknown): number => {
        const raw = (s ?? '').toString()
        const cleaned = raw
          .replace(/[^\d,.-]/g, '')
          .replace(/\./g, '')
          .replace(/,/, '.')
        const n = Number(cleaned)
        return Number.isFinite(n) ? n : 0
      }

      const formatSignedCurrency = (n: number): string => {
        const abs = Math.abs(n)
        if (n > 0) return `+ ${formatCurrency(abs)}`
        if (n < 0) return `- ${formatCurrency(abs)}`
        return formatCurrency(0)
      }

      const body = (base.tableData || []).map((r: any) => {
        const key = normalizeAih(r?.[1])
        const localVal = parseBrCurrency(r?.[5])
        const remoteVal = key ? (remoteMap.get(key) ?? null) : null
        const remoteLabel = typeof remoteVal === 'number' ? formatCurrency(remoteVal) : '—'
        const divergentVal = typeof remoteVal === 'number' ? (remoteVal - localVal) : null
        const divergentLabel = typeof divergentVal === 'number' ? formatSignedCurrency(divergentVal) : '—'
        return [...r, remoteLabel, divergentLabel]
      })

      const normalizeSortText = (s: unknown): string => {
        return (s ?? '')
          .toString()
          .normalize('NFD')
          .replace(/\p{Diacritic}/gu, '')
          .trim()
          .toUpperCase()
      }
      const bodyOrdered = [...body]
        .sort((a: any, b: any) => {
          const procA = normalizeSortText(a?.[3])
          const procB = normalizeSortText(b?.[3])
          const cmp = procA.localeCompare(procB, 'pt-BR')
          if (cmp !== 0) return cmp
          const nameA = normalizeSortText(a?.[2])
          const nameB = normalizeSortText(b?.[2])
          return nameA.localeCompare(nameB, 'pt-BR')
        })
        .map((r: any, idx: number) => {
          const next = [...r]
          next[0] = String(idx + 1)
          return next
        })

      const totalPatients = bodyOrdered.length
      const totalLocal = bodyOrdered.reduce((sum: number, r: any) => sum + parseBrCurrency(r?.[5]), 0)
      const totalRemote = bodyOrdered.reduce((sum: number, r: any) => sum + parseBrCurrency(r?.[6]), 0)
      const totalDivergent = totalRemote - totalLocal
      const totalNegative = bodyOrdered.reduce((sum: number, r: any) => {
        const v = parseBrCurrency(r?.[7])
        return v < 0 ? (sum + v) : sum
      }, 0)
      const totalPositive = bodyOrdered.reduce((sum: number, r: any) => {
        const v = parseBrCurrency(r?.[7])
        return v > 0 ? (sum + v) : sum
      }, 0)
      const diffPositiveNegative = totalPositive + totalNegative
      const matched = bodyOrdered.filter((r: any) => String(r?.[6] || '') !== '—')
      const pending = bodyOrdered.filter((r: any) => String(r?.[6] || '') === '—')

      let logoBase64 = null as string | null
      try {
        const response = await fetch('/CIS Sem fundo.jpg')
        const blob = await response.blob()
        logoBase64 = await new Promise<string>((resolve) => {
          const reader = new FileReader()
          reader.onloadend = () => resolve(reader.result as string)
          reader.readAsDataURL(blob)
        })
      } catch { }

      const doctorName = doctor?.doctor_info?.name || ''
      const hospitalName = doctor?.hospitals?.[0]?.hospital_name || 'Hospital não identificado'

      const doc = new jsPDF('landscape')
      const pageWidth = doc.internal.pageSize.getWidth()

      let yPosition = 20
      if (logoBase64) {
        const logoWidth = 40
        const logoHeight = 20
        const logoX = 20
        const logoY = 8
        doc.addImage(logoBase64, 'JPEG', logoX, logoY, logoWidth, logoHeight)
        yPosition = logoY + logoHeight + 10
      }

      doc.setFontSize(16)
      doc.setFont('helvetica', 'bold')
      doc.setTextColor(0, 51, 102)
      doc.text('CONFERÊNCIA DE VALORES - AIH', pageWidth / 2, yPosition, { align: 'center' })
      yPosition += 10

      const careHeader = (filterCareCharacter && filterCareCharacter !== 'all')
        ? CareCharacterUtils.formatForDisplay(filterCareCharacter, false)
        : 'TODOS'
      const compHeader = (selectedCompetencia && selectedCompetencia !== 'all')
        ? formatCompetencia(selectedCompetencia)
        : 'TODAS'
      const dataGeracao = new Date().toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })

      doc.setFontSize(10)
      doc.setFont('helvetica', 'normal')
      doc.setTextColor(60, 60, 60)
      doc.text(`Médico: ${doctorName}  |  Hospital: ${hospitalName}`, 20, yPosition)
      yPosition += 6
      doc.text(`Comp.: ${compHeader}  |  Caráter: ${careHeader}  |  Gerado em: ${dataGeracao}`, 20, yPosition)
      yPosition += 8

      doc.setDrawColor(200, 200, 200)
      doc.setLineWidth(0.5)
      doc.line(20, yPosition - 4, pageWidth - 20, yPosition - 4)

      doc.setFontSize(10)
      doc.setFont('helvetica', 'normal')
      const leftLabels = ['Pacientes Totais:', 'Pacientes Consolidados:', 'Pacientes Pendentes:']
      const leftValueX = 20 + Math.max(...leftLabels.map(l => doc.getTextWidth(l))) + 8

      const colorBlue: [number, number, number] = [0, 51, 102]
      const colorGreen: [number, number, number] = [0, 102, 0]
      const colorRed: [number, number, number] = [180, 0, 0]
      const colorGrey: [number, number, number] = [90, 90, 90]

      const drawMetricLine = (
        y: number,
        leftLabel: string,
        leftValue: string,
        leftValueColor: [number, number, number],
        rightLabel: string,
        rightValue: string,
        rightValueColor: [number, number, number]
      ) => {
        doc.setFontSize(10)
        doc.setFont('helvetica', 'normal')
        doc.setTextColor(60, 60, 60)
        doc.text(leftLabel, 20, y)
        doc.setFont('helvetica', 'bold')
        doc.setTextColor(leftValueColor[0], leftValueColor[1], leftValueColor[2])
        doc.text(leftValue, leftValueX, y)
        if (rightLabel && rightValue) {
          doc.setFont('helvetica', 'normal')
          doc.setTextColor(60, 60, 60)
          doc.text(rightLabel, pageWidth - 110, y)
          doc.setFont('helvetica', 'bold')
          doc.setTextColor(rightValueColor[0], rightValueColor[1], rightValueColor[2])
          doc.text(rightValue, pageWidth - 20, y, { align: 'right' })
        }
      }

      const metricY1 = yPosition + 6
      drawMetricLine(metricY1, 'Pacientes Totais:', String(totalPatients), colorBlue, 'Valor Total Negativo:', formatSignedCurrency(totalNegative), colorRed)
      const metricY2 = metricY1 + 8
      drawMetricLine(metricY2, 'Pacientes Consolidados:', String(matched.length), colorGrey, 'Valor Total Positivo:', formatSignedCurrency(totalPositive), colorGreen)
      const metricY3 = metricY2 + 8
      const colorBlueLight: [number, number, number] = [0, 102, 204]
      const diffPosNegColor: [number, number, number] =
        diffPositiveNegative > 0 ? colorBlueLight : diffPositiveNegative < 0 ? colorRed : colorGrey
      drawMetricLine(metricY3, 'Pacientes Pendentes:', String(pending.length), colorRed, 'Diferença Positvo/Negativo:', formatSignedCurrency(diffPositiveNegative), diffPosNegColor)

      const diffRelColor: [number, number, number] =
        totalDivergent > 0 ? colorGreen : totalDivergent < 0 ? colorRed : colorGrey
      const midLines: Array<{ label: string; value: string; color: [number, number, number] }> = [
        { label: 'Total AIH Seca (GSUS):', value: formatCurrency(totalLocal), color: colorBlue },
        { label: 'Total Recebido (Tabwin):', value: formatCurrency(totalRemote), color: colorGrey },
        { label: 'Diferença Relativa:', value: formatSignedCurrency(totalDivergent), color: diffRelColor }
      ]
      doc.setFontSize(10)
      const midMaxLabel = Math.max(...midLines.map(l => doc.getTextWidth(l.label)))
      const midMaxValue = Math.max(...midLines.map(l => doc.getTextWidth(l.value)))
      const midBlockWidth = midMaxLabel + 8 + midMaxValue
      const midX = (pageWidth / 2) - (midBlockWidth / 2)
      const midValueX = midX + midMaxLabel + 8

      const drawMidLine = (y: number, label: string, value: string, valueColor: [number, number, number]) => {
        doc.setFont('helvetica', 'normal')
        doc.setTextColor(60, 60, 60)
        doc.text(label, midX, y)
        doc.setFont('helvetica', 'bold')
        doc.setTextColor(valueColor[0], valueColor[1], valueColor[2])
        doc.text(value, midValueX + midMaxValue, y, { align: 'right' })
      }
      drawMidLine(metricY1, midLines[0].label, midLines[0].value, midLines[0].color)
      drawMidLine(metricY2, midLines[1].label, midLines[1].value, midLines[1].color)
      drawMidLine(metricY3, midLines[2].label, midLines[2].value, midLines[2].color)

      const startY = metricY3 + 10
      autoTable(doc, {
        head: [['#', 'Nº da AIH', 'Nome do Paciente', 'Procedimentos', 'Data Alta', 'Valor Total da AIH', 'Valor Recebido da AIH', 'Valor Divergente']],
        body: bodyOrdered,
        startY,
        theme: 'striped',
        tableWidth: pageWidth - 20,
        headStyles: {
          fillColor: [0, 51, 102],
          textColor: [255, 255, 255],
          fontStyle: 'bold',
          fontSize: 9,
          halign: 'center',
          cellPadding: 2
        },
        bodyStyles: {
          fontSize: 8,
          textColor: [50, 50, 50],
          cellPadding: 2
        },
        columnStyles: {
          0: { cellWidth: 8, halign: 'center' },
          1: { cellWidth: 24, halign: 'center' },
          2: { cellWidth: 36, halign: 'left' },
          3: { cellWidth: 115, halign: 'left', fontSize: 7 },
          4: { cellWidth: 20, halign: 'center' },
          5: { cellWidth: 22, halign: 'right', fontStyle: 'bold', textColor: [0, 51, 102] },
          6: { cellWidth: 22, halign: 'right', fontStyle: 'bold', textColor: [0, 102, 0] },
          7: { cellWidth: 22, halign: 'right', fontStyle: 'bold' }
        },
        didParseCell: (d: any) => {
          try {
            if (d.section !== 'body') return
            const col = Number(d.column?.index)
            const cellText = Array.isArray(d.cell?.text) ? d.cell.text.join(' ') : String(d.cell?.text ?? d.cell?.raw ?? '')
            const txt = String(cellText || '').trim()
            if (col === 6) {
              if (!txt || txt === '—') {
                d.cell.styles.textColor = [90, 90, 90]
                d.cell.styles.fontStyle = 'normal'
              } else {
                d.cell.styles.textColor = [0, 102, 0]
              }
              return
            }
            if (col === 7) {
              if (!txt || txt === '—') {
                d.cell.styles.textColor = [90, 90, 90]
                d.cell.styles.fontStyle = 'normal'
                return
              }
              const v = parseBrCurrency(txt)
              if (Math.abs(v) < 0.005) {
                d.cell.styles.textColor = [90, 90, 90]
              } else if (v > 0) {
                d.cell.styles.textColor = [0, 102, 0]
              } else {
                d.cell.styles.textColor = [180, 0, 0]
              }
            }
          } catch { }
        },
        styles: {
          overflow: 'linebreak',
          cellPadding: 2,
          fontSize: 8
        },
        margin: { left: 10, right: 10 },
        alternateRowStyles: {
          fillColor: [245, 245, 245]
        }
      })

      const fileName = `Conferencia_Valores_${doctorName.replace(/\s+/g, '_')}_${formatDateFns(new Date(), 'yyyyMMdd_HHmm')}.pdf`
      doc.save(fileName)
      toast.success('Relatório de conferência gerado com sucesso!')
      setValueConferenceOpen(false)
    } catch (err) {
      console.error('Erro ao gerar conferência de valores:', err)
      toast.error('Erro ao gerar conferência de valores')
    } finally {
      setValueConferenceLoading(false)
    }
  }

  const handleRelateConfirm = async () => {
    const doctor = relateDoctor
    if (!doctor) return
    if (!relateReportA || !relateReportB || relateReportA === relateReportB) return

    setRelateLoading(true)
    try {
      if ((relateReportA === 'Repasse Médico (TABWIN)' || relateReportB === 'Repasse Médico (TABWIN)') && !remoteConfigured) {
        toast.error('Fonte SIH remota não configurada')
        return
      }

      const [base, other] = await Promise.all([
        buildRelateDataset(doctor, relateReportA),
        buildRelateDataset(doctor, relateReportB)
      ])

      const otherSet = new Set(
        (other.tableData || [])
          .map((r: any) => normalizeAihKey(r?.[2]))
          .filter(Boolean)
      )

      const body = (base.tableData || []).map((r: any) => {
        const key = normalizeAihKey(r?.[2])
        const match = key && otherSet.has(key) ? 'Sim' : 'Não'
        return [...r, match]
      })

      const bodyOrdered = [
        ...body.filter((r: any) => String(r?.[7] || '') === 'Sim'),
        ...body.filter((r: any) => String(r?.[7] || '') !== 'Sim')
      ].map((r: any, idx: number) => {
        const next = [...r]
        next[0] = String(idx + 1)
        return next
      })

      let logoBase64 = null as string | null
      try {
        const response = await fetch('/CIS Sem fundo.jpg')
        const blob = await response.blob()
        logoBase64 = await new Promise<string>((resolve) => {
          const reader = new FileReader()
          reader.onloadend = () => resolve(reader.result as string)
          reader.readAsDataURL(blob)
        })
      } catch { }

      const doctorName = doctor?.doctor_info?.name || ''
      const hospitalName = doctor?.hospitals?.[0]?.hospital_name || 'Hospital não identificado'

      const doc = new jsPDF('landscape')
      const pageWidth = doc.internal.pageSize.getWidth()
      const pageHeight = doc.internal.pageSize.getHeight()

      let yPosition = 20
      if (logoBase64) {
        const logoWidth = 40
        const logoHeight = 20
        const logoX = 20
        const logoY = 8
        doc.addImage(logoBase64, 'JPEG', logoX, logoY, logoWidth, logoHeight)
        yPosition = logoY + logoHeight + 10
      }

      doc.setFontSize(16)
      doc.setFont('helvetica', 'bold')
      doc.setTextColor(0, 51, 102)
      doc.text('RELATÓRIO RELACIONADO - MÉDICO', pageWidth / 2, yPosition, { align: 'center' })
      yPosition += 10

      const careHeader = (filterCareCharacter && filterCareCharacter !== 'all')
        ? CareCharacterUtils.formatForDisplay(filterCareCharacter, false)
        : 'TODOS'
      const compHeader = (selectedCompetencia && selectedCompetencia !== 'all')
        ? formatCompetencia(selectedCompetencia)
        : 'TODAS'
      const dataGeracao = new Date().toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })

      doc.setFontSize(10)
      doc.setFont('helvetica', 'normal')
      doc.setTextColor(60, 60, 60)
      doc.text(`Médico: ${doctorName}  |  Hospital: ${hospitalName}`, 20, yPosition)
      yPosition += 6
      doc.text(`Comp.: ${compHeader}  |  Caráter: ${careHeader}  |  Gerado em: ${dataGeracao}`, 20, yPosition)
      yPosition += 6
      doc.text(`Base: ${relateReportA}  |  Comparado: ${relateReportB}`, 20, yPosition)
      yPosition += 10

      const parseBrCurrency = (s: unknown): number => {
        const raw = (s ?? '').toString()
        const cleaned = raw
          .replace(/[^\d,.-]/g, '')
          .replace(/\./g, '')
          .replace(/,/, '.')
        const n = Number(cleaned)
        return Number.isFinite(n) ? n : 0
      }

      const totalPatients = bodyOrdered.length
      const totalValue = bodyOrdered.reduce((sum: number, r: any) => sum + parseBrCurrency(r?.[6]), 0)
      const consolidatedRows = bodyOrdered.filter((r: any) => String(r?.[7] || '') === 'Sim')
      const pendingRows = bodyOrdered.filter((r: any) => String(r?.[7] || '') !== 'Sim')
      const consolidatedPatients = consolidatedRows.length
      const pendingPatients = pendingRows.length
      const consolidatedValue = consolidatedRows.reduce((sum: number, r: any) => sum + parseBrCurrency(r?.[6]), 0)
      const pendingValue = pendingRows.reduce((sum: number, r: any) => sum + parseBrCurrency(r?.[6]), 0)

      doc.setDrawColor(200, 200, 200)
      doc.setLineWidth(0.5)
      doc.line(20, yPosition - 4, pageWidth - 20, yPosition - 4)

      doc.setFontSize(10)
      doc.setFont('helvetica', 'normal')
      const leftLabels = ['Pacientes Totais:', 'Pacientes Consolidados:', 'Pacientes Pendentes:']
      const leftValueX = 20 + Math.max(...leftLabels.map(l => doc.getTextWidth(l))) + 8

      const drawMetricLine = (y: number, leftLabel: string, leftValue: string, rightLabel: string, rightValue: string) => {
        doc.setFontSize(10)
        doc.setFont('helvetica', 'normal')
        doc.setTextColor(60, 60, 60)
        doc.text(leftLabel, 20, y)
        doc.setFont('helvetica', 'bold')
        doc.setTextColor(0, 51, 102)
        doc.text(leftValue, leftValueX, y)
        doc.setFont('helvetica', 'normal')
        doc.setTextColor(60, 60, 60)
        doc.text(rightLabel, pageWidth - 90, y)
        doc.setFont('helvetica', 'bold')
        doc.setTextColor(0, 102, 0)
        doc.text(rightValue, pageWidth - 20, y, { align: 'right' })
      }

      const metricY1 = yPosition + 6
      drawMetricLine(metricY1, 'Pacientes Totais:', String(totalPatients), 'Valor Total:', formatCurrency(totalValue))
      const metricY2 = metricY1 + 8
      drawMetricLine(metricY2, 'Pacientes Consolidados:', String(consolidatedPatients), 'Valor Consolidado:', formatCurrency(consolidatedValue))
      const metricY3 = metricY2 + 8
      drawMetricLine(metricY3, 'Pacientes Pendentes:', String(pendingPatients), 'Valor Pendente:', formatCurrency(pendingValue))

      const startY = metricY3 + 10
      autoTable(doc, {
        head: [['#', 'Prontuário', 'Nº da AIH', 'Nome do Paciente', 'Procedimentos', 'Data Alta', 'Valor de Repasse', 'Match']],
        body: bodyOrdered,
        startY,
        theme: 'striped',
        tableWidth: 'auto',
        headStyles: { fillColor: [0, 51, 102], textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 9, halign: 'center', cellPadding: 2 },
        bodyStyles: { fontSize: 8, textColor: [50, 50, 50], cellPadding: 2 },
        columnStyles: {
          0: { cellWidth: 'auto', halign: 'center' },
          1: { cellWidth: 'auto', halign: 'center' },
          2: { cellWidth: 'auto', halign: 'center' },
          3: { cellWidth: 'auto', halign: 'left' },
          4: { cellWidth: 'auto', halign: 'left', fontSize: 7 },
          5: { cellWidth: 'auto', halign: 'center' },
          6: { cellWidth: 'auto', halign: 'right', fontStyle: 'bold', textColor: [0, 102, 0] },
          7: { cellWidth: 'auto', halign: 'center', fontStyle: 'bold' }
        },
        styles: { overflow: 'linebreak', cellPadding: 2, fontSize: 8 },
        margin: { left: 20, right: 20 },
        alternateRowStyles: { fillColor: [245, 245, 245] },
      })

      const footerY = pageHeight - 15
      doc.setFontSize(8)
      doc.setFont('helvetica', 'normal')
      doc.setTextColor(120, 120, 120)
      doc.text('CIS - Centro Integrado em Saúde', pageWidth / 2, footerY, { align: 'center' })

      const fileName = `Relatorio_Relacionado_${doctorName.replace(/\s+/g, '_')}_${formatDateFns(new Date(), 'yyyyMMdd_HHmm')}.pdf`
      doc.save(fileName)
      toast.success('Relatório relacionado gerado com sucesso!')
      setRelateOpen(false)
    } catch (err) {
      console.error('Erro ao gerar relatório relacionado:', err)
      toast.error('Erro ao gerar relatório relacionado')
    } finally {
      setRelateLoading(false)
    }
  }

  // 🆕 FUNÇÃO PARA DETERMINAR HOSPITAL CORRETO BASEADO NO CONTEXTO
  const getDoctorContextualHospitalId = (doctor: DoctorWithPatients): string | undefined => {
    // Se há filtro de hospital específico (não 'all'), usar o primeiro selecionado
    if (selectedHospitals.length > 0 && !selectedHospitals.includes('all')) {
      // Verificar se o médico atende no hospital selecionado
      const selectedHospitalId = selectedHospitals[0];
      const doctorWorksInSelectedHospital = doctor.hospitals?.some(h => h.hospital_id === selectedHospitalId);

      if (doctorWorksInSelectedHospital) {
        console.log(`🏥 Usando hospital selecionado ${selectedHospitalId} para ${doctor.doctor_info.name}`);
        return selectedHospitalId;
      }
    }

    // Fallback: usar o primeiro hospital do médico
    const fallbackHospitalId = doctor.hospitals?.[0]?.hospital_id;
    console.log(`🏥 Usando hospital fallback ${fallbackHospitalId} para ${doctor.doctor_info.name}`);
    return fallbackHospitalId;
  };
  const [reportPreset, setReportPreset] = useState<{ hospitalId?: string; doctorName?: string } | null>(null);
  // 🆕 ESTADOS PARA PAGINAÇÃO DE PACIENTES
  const [currentPatientPage, setCurrentPatientPage] = useState<Map<string, number>>(new Map());
  const [localPatientSearchTerm, setLocalPatientSearchTerm] = useState<Map<string, string>>(new Map());
  const [procedureSearchTerm, setProcedureSearchTerm] = useState<Map<string, string>>(new Map());
  const PATIENTS_PER_PAGE = 10;

  // 🆕 ESTADOS PARA PAGINAÇÃO DE MÉDICOS
  const [currentDoctorPage, setCurrentDoctorPage] = useState<number>(1);
  const DOCTORS_PER_PAGE = 10;

  // 🧮 BUSCAR TOTAIS SIH REMOTOS QUANDO TOGGLE ATIVO
  useEffect(() => {
    if (useSihSource && remoteConfigured) {
      fetchSihRemoteTotals().then(totals => {
        setSihRemoteTotals(totals);
      }).catch(error => {
        console.error('❌ Erro ao buscar totais SIH remotos:', error);
        setSihRemoteTotals(null);
      });
    } else {
      setSihRemoteTotals(null);
    }
  }, [useSihSource, selectedHospitals, selectedCompetencia]);

  // ✅ CARREGAR LISTA DE HOSPITAIS DISPONÍVEIS
  const loadAvailableHospitals = async (doctorsData: DoctorWithPatients[]) => {
    try {
      // Extrair hospitais únicos dos dados dos médicos
      const hospitalSet = new Set<string>();
      const hospitalMap = new Map<string, string>();

      doctorsData.forEach(doctor => {
        doctor.hospitals?.forEach(hospital => {
          if (hospital.hospital_id && hospital.hospital_name && hospital.hospital_name !== 'Hospital não definido') {
            hospitalSet.add(hospital.hospital_id);
            hospitalMap.set(hospital.hospital_id, hospital.hospital_name);
          }
        });
      });

      // Buscar hospitais adicionais da tabela hospitals se necessário
      const { data: hospitalsFromDB } = await supabase
        .from('hospitals')
        .select('id, name, cnes') // ✅ Incluir CNES (identificador SUS)
        .order('name');

      if (hospitalsFromDB) {
        // Criar mapa para armazenar também o CNES
        const hospitalCnesMap = new Map<string, string>();
        hospitalsFromDB.forEach(hospital => {
          hospitalSet.add(hospital.id);
          hospitalMap.set(hospital.id, hospital.name);
          if (hospital.cnes) {
            hospitalCnesMap.set(hospital.id, hospital.cnes);
          }
        });

        // Converter para array ordenado incluindo CNES
        const hospitalsList = Array.from(hospitalSet)
          .map(id => ({
            id,
            name: hospitalMap.get(id) || `Hospital ${id}`,
            cnes: hospitalCnesMap.get(id) // ✅ Incluir CNES
          }))
          .sort((a, b) => a.name.localeCompare(b.name));

        setAvailableHospitals(hospitalsList);
        console.log('🏥 Hospitais disponíveis:', hospitalsList);
        return; // Early return após processar hospitais do DB
      }

      // Fallback se não houver hospitais do DB
      const hospitalsList = Array.from(hospitalSet)
        .map(id => ({ id, name: hospitalMap.get(id) || `Hospital ${id}` }))
        .sort((a, b) => a.name.localeCompare(b.name));

      setAvailableHospitals(hospitalsList);
      console.log('🏥 Hospitais disponíveis:', hospitalsList);
    } catch (error) {
      console.error('❌ Erro ao carregar hospitais:', error);
    }
  };

  // 🚀 FUNÇÃO PARA CARREGAR PROCEDIMENTOS SEPARADAMENTE (SOLUÇÃO IMEDIATA)
  const loadProceduresForPatients = async (doctorsData: DoctorWithPatients[]) => {
    try {
      console.log('🔄 SOLUÇÃO IMEDIATA: Carregando procedimentos separadamente...');

      // 1. ESTRATÉGIA DIRETA: Buscar TODOS os procedimentos da tabela procedure_records
      console.log('🔍 [SOLUÇÃO DEFINITIVA] Buscando TODOS os procedimentos (sem qualquer limite)...');
      const sampleResult = await ProcedureRecordsService.getAllProcedures(); // Buscar TODOS sem limite

      if (!sampleResult.success) {
        console.error('❌ Erro ao buscar amostra de procedimentos:', sampleResult.error);
        return;
      }

      console.log(`📊 Encontrados ${sampleResult.procedures.length} procedimentos TOTAIS`);
      console.log('🔍 Exemplo de procedure_record:', sampleResult.procedures[0]);

      // 2. Coletar informações dos pacientes dos médicos PRIMEIRO
      const doctorPatients = new Map<string, any>();
      const doctorPatientIds = new Set<string>();

      doctorsData.forEach(doctor => {
        doctor.patients.forEach(patient => {
          // Buscar por patient_id real (UUID da tabela patients)
          const patientRecord = patient.patient_info || patient;

          // Tentar encontrar o patient_id real através da relação AIH → patient
          // Normalmente estará em patient.patient_id ou similar
          let realPatientId = null;

          // Estratégia 1: Buscar na estrutura patient_info
          if ((patientRecord as any).id) {
            realPatientId = (patientRecord as any).id;
          }

          // Estratégia 2: Buscar através do CNS na tabela patients
          if (!realPatientId && (patientRecord as any).cns) {
            // Adicionar CNS para possível lookup
            doctorPatients.set((patientRecord as any).cns, patient);
            doctorPatientIds.add((patientRecord as any).cns);
          }

          // Estratégia 3: Se tiver patient_id direto
          if ((patient as any).patient_id) {
            doctorPatients.set((patient as any).patient_id, patient);
            doctorPatientIds.add((patient as any).patient_id);
          }

          // Registrar também o realPatientId se encontrado
          if (realPatientId) {
            doctorPatients.set(realPatientId, patient);
            doctorPatientIds.add(realPatientId);
          }
        });
      });

      console.log(`📋 Pacientes dos médicos registrados: ${doctorPatients.size}`);
      console.log('🔍 [DEBUG] Patient IDs dos médicos (primeiros 10):', Array.from(doctorPatientIds).slice(0, 10));

      // 3. Coletar patient_ids únicos dos procedimentos encontrados
      const procedurePatientIds = [...new Set(sampleResult.procedures.map(p => p.patient_id))];
      console.log(`👥 Patient IDs únicos nos procedimentos: ${procedurePatientIds.length}`);
      console.log('🔍 Primeiros patient_ids dos procedimentos:', procedurePatientIds.slice(0, 5));

      // 4. 🎯 SOLUÇÃO DEFINITIVA: Associação via CNS (único e confiável)
      console.log('\n🎯 SOLUÇÃO VIA CNS: Usando CNS como chave única de associação!');

      // Coletar CNS dos pacientes dos médicos
      const patientCNSs = new Set<string>();
      const cnsToPatientMap = new Map<string, any>();

      doctorsData.forEach(doctor => {
        doctor.patients.forEach(patient => {
          const cns = patient.patient_info?.cns;
          if (cns) {
            patientCNSs.add(cns);
            cnsToPatientMap.set(cns, patient);
          }
        });
      });

      console.log(`🔍 Coletados ${patientCNSs.size} CNS únicos dos pacientes`);
      console.log('🔍 Exemplos de CNS:', Array.from(patientCNSs).slice(0, 3));

      // Buscar patient_ids na tabela patients usando CNS
      const cnsToPatientIdMap = new Map<string, string>();

      if (patientCNSs.size > 0) {
        try {
          console.log('🔍 Buscando patient_ids via CNS na tabela patients...');

          // Buscar em lotes para evitar URLs muito grandes
          const cnsArray = Array.from(patientCNSs);
          const batchSize = 100;

          for (let i = 0; i < cnsArray.length; i += batchSize) {
            const batch = cnsArray.slice(i, i + batchSize);

            const { data: patientsData, error } = await supabase
              .from('patients')
              .select('id, cns')
              .in('cns', batch);

            if (!error && patientsData) {
              patientsData.forEach(patient => {
                cnsToPatientIdMap.set(patient.cns, patient.id);
              });
            }
          }

          console.log(`✅ Encontrados ${cnsToPatientIdMap.size} patient_ids via CNS`);
          console.log('🔍 Exemplos CNS → Patient_ID:', Array.from(cnsToPatientIdMap.entries()).slice(0, 3));

        } catch (error) {
          console.error('❌ Erro ao buscar patient_ids via CNS:', error);
        }
      }

      // Buscar procedimentos usando os patient_ids obtidos via CNS
      let directResult = null;
      const patientIdsViaCNS = new Set(Array.from(cnsToPatientIdMap.values()));

      if (patientIdsViaCNS.size > 0) {
        console.log('🎯 Buscando procedimentos via PATIENT_IDs obtidos do CNS...');

        // Filtrar procedimentos da amostra que têm patient_id correspondente
        const proceduresViaPatientId = sampleResult.procedures.filter(proc =>
          proc.patient_id && patientIdsViaCNS.has(proc.patient_id)
        );

        if (proceduresViaPatientId.length > 0) {
          directResult = {
            success: true,
            procedures: proceduresViaPatientId,
            uniquePatientIds: [...new Set(proceduresViaPatientId.map(p => p.patient_id))]
          };
          console.log(`🎉 SUCESSO VIA CNS! Encontrados ${proceduresViaPatientId.length} procedimentos`);
          console.log(`📊 Patient IDs únicos nos procedimentos: ${[...new Set(proceduresViaPatientId.map(p => p.patient_id))].length}`);
        } else {
          console.log(`⚠️ Nenhum procedimento encontrado via CNS. Verificando incompatibilidade...`);

          // Debug: verificar alguns patient_ids dos procedimentos vs CNS
          const procedurePatientIds = [...new Set(sampleResult.procedures.map(p => p.patient_id).filter(Boolean))];
          console.log('🔍 Exemplos de patient_ids nos procedimentos:', procedurePatientIds.slice(0, 5));
          console.log('🔍 Exemplos de patient_ids via CNS:', Array.from(patientIdsViaCNS).slice(0, 5));

          // Tentar busca por proximidade de UUID
          const similarPatientIds = procedurePatientIds.filter(patientId =>
            Array.from(patientIdsViaCNS).some(cnsPatientId =>
              patientId.substring(0, 8) === cnsPatientId.substring(0, 8)
            )
          );
          console.log('🔍 Patient IDs com prefixos similares:', similarPatientIds.slice(0, 3));
        }
      } else {
        console.log('❌ Nenhum patient_id encontrado via CNS - possível problema na tabela patients');
      }

      // 5. Usar resultado via CNS se disponível, senão usar amostra geral
      const result = (directResult?.success && directResult.procedures.length > 0)
        ? directResult
        : sampleResult;

      console.log(`📊 USANDO RESULTADO: ${directResult?.success ? 'BUSCA VIA CNS (CORRETO)' : 'AMOSTRA GERAL'}`);
      console.log(`📋 Total de procedimentos: ${result.procedures.length}`);

      // 🚨 DEBUG CRÍTICO: VERIFICAR DISPONIBILIDADE DE PATIENT_IDs VIA CNS
      const currentProcedurePatientIds = [...new Set(result.procedures.map(p => p.patient_id).filter(Boolean))];
      const intersection = Array.from(patientIdsViaCNS).filter(id => currentProcedurePatientIds.includes(id));
      console.log(`🔍 [DEBUG] INTERSEÇÃO VIA CNS: ${intersection.length} IDs em comum`);
      if (intersection.length > 0) {
        console.log('✅ [DEBUG] Patient_IDs em comum via CNS:', intersection.slice(0, 5));
      } else {
        console.log('❌ [DEBUG] NENHUM PATIENT_ID em comum via CNS!');
        console.log('🔍 [DEBUG] Exemplo Patient_ID via CNS:', Array.from(patientIdsViaCNS)[0]);
        console.log('🔍 [DEBUG] Exemplo Patient_ID procedimento:', currentProcedurePatientIds[0]);
        console.log('🔍 [DEBUG] Total Patient_IDs via CNS:', patientIdsViaCNS.size);
        console.log('🔍 [DEBUG] Total Patient_IDs dos procedimentos:', currentProcedurePatientIds.length);
      }

      if (!result.success) {
        console.error('❌ Erro ao carregar procedimentos:', result.error);
        return;
      }

      console.log(`✅ Encontrados ${result.procedures.length} procedimentos`);

      // 🚨 DEBUG CRÍTICO: INVESTIGAR DADOS
      if (result.procedures.length > 0) {
        console.log('🔍 [DEBUG] Exemplo de procedimento da tabela:', result.procedures[0]);
        console.log('🔍 [DEBUG] Patient IDs únicos nos procedimentos:', result.uniquePatientIds.slice(0, 10));
        console.log(`🔍 [DEBUG] Total de patient_ids únicos: ${result.uniquePatientIds.length}`);
      } else {
        console.log('⚠️ [DEBUG] NENHUM PROCEDIMENTO encontrado na tabela procedure_records!');
        // Se não há procedimentos, vamos buscar informações da tabela
        const debugTableInfo = await ProcedureRecordsService.getTableInfo();
        console.log('🔍 [DEBUG] Info da tabela procedure_records:', debugTableInfo);
      }

      // 3. 🔧 CORREÇÃO FINAL: Agrupar procedimentos por patient_id (correto)
      const proceduresByPatientId = new Map<string, ProcedureRecord[]>();
      result.procedures.forEach(proc => {
        if (proc.patient_id) { // Só considerar procedimentos com patient_id válido
          if (!proceduresByPatientId.has(proc.patient_id)) {
            proceduresByPatientId.set(proc.patient_id, []);
          }
          proceduresByPatientId.get(proc.patient_id)!.push(proc);
        }
      });

      console.log(`📊 Procedimentos agrupados para ${proceduresByPatientId.size} pacientes`);
      console.log('🔍 Exemplos de patient_ids com procedimentos:', Array.from(proceduresByPatientId.keys()).slice(0, 3));

      // 4. ESTRATÉGIA INTELIGENTE DE ASSOCIAÇÃO COM ESTATÍSTICAS
      let totalProceduresAssociated = 0;
      let associationsFound = 0;

      // Contadores de diagnóstico
      let patientsWithoutCNS = 0;
      let patientsWithCNSNotInDB = 0;
      let patientsWithValidIdButNoProcedures = 0;
      let patientsWithProcedures = 0;

      console.log('\n🔗 === INICIANDO ASSOCIAÇÃO INTELIGENTE ===');

      doctorsData.forEach((doctor, doctorIndex) => {
        console.log(`\n👨‍⚕️ Médico ${doctorIndex + 1}: ${doctor.doctor_info.name}`);

        doctor.patients.forEach((patient, patientIndex) => {
          // Limpar procedimentos existentes
          patient.procedures = [];

          console.log(`  👤 Paciente ${patientIndex + 1}: ${patient.patient_info.name}`);
          console.log(`      CNS: ${patient.patient_info.cns}`);

          let proceduresToAssign = [];

          // ESTRATÉGIA 1: 🎯 BUSCA VIA CNS → PATIENT_ID (SOLUÇÃO DEFINITIVA)
          const patientCNS = patient.patient_info?.cns;

          if (patientCNS) {
            console.log(`      🔍 Buscando procedimentos via CNS: ${patientCNS}`);

            // Buscar patient_id através do CNS
            const patientIdViaCNS = cnsToPatientIdMap.get(patientCNS);

            if (patientIdViaCNS) {
              console.log(`      ✅ Patient_ID encontrado via CNS: ${patientIdViaCNS}`);

              // Buscar procedimentos usando o patient_id
              const foundProcedures = proceduresByPatientId.get(patientIdViaCNS);
              if (foundProcedures && foundProcedures.length > 0) {
                proceduresToAssign = foundProcedures;
                console.log(`      🎉 ENCONTRADOS ${foundProcedures.length} procedimentos via CNS!`);
                associationsFound++;
                patientsWithProcedures++;
              } else {
                console.log(`      ⚠️ Patient_ID encontrado mas sem procedimentos: ${patientIdViaCNS}`);
                patientsWithValidIdButNoProcedures++;
              }
            } else {
              console.log(`      ❌ CNS não encontrado na tabela patients: ${patientCNS}`);
              patientsWithCNSNotInDB++;
            }
          } else {
            console.log(`      ❌ Paciente sem CNS: ${patient.patient_info?.name}`);
            patientsWithoutCNS++;
          }

          // ESTRATÉGIA 2: Debug específico para identificar o problema
          if (proceduresToAssign.length === 0) {
            console.log(`      🚨 DIAGNÓSTICO DETALHADO PARA: ${patient.patient_info?.name}`);
            console.log(`        🆔 CNS do paciente: ${patientCNS}`);

            if (!patientCNS) {
              console.log(`        ❌ PROBLEMA: Paciente sem CNS`);
            } else {
              const patientIdViaCNS = cnsToPatientIdMap.get(patientCNS);
              console.log(`        🔍 Patient_ID via CNS: ${patientIdViaCNS}`);

              if (!patientIdViaCNS) {
                console.log(`        ❌ PROBLEMA: CNS não encontrado na tabela patients`);
                console.log(`        💡 SOLUÇÃO: Verificar se CNS ${patientCNS} existe na tabela patients`);

                // Verificar se é problema de formatação do CNS
                const similarCNS = Array.from(cnsToPatientIdMap.keys()).filter(cns =>
                  cns.replace(/\D/g, '') === patientCNS.replace(/\D/g, '')
                );
                if (similarCNS.length > 0) {
                  console.log(`        🔍 CNS com formatação similar encontrado: ${similarCNS[0]}`);
                }
              } else {
                const hasProcs = proceduresByPatientId.has(patientIdViaCNS);
                console.log(`        🔍 Tem procedimentos: ${hasProcs}`);

                if (!hasProcs) {
                  console.log(`        ❌ PROBLEMA: Patient_ID encontrado mas sem procedimentos em procedure_records`);
                  console.log(`        💡 SOLUÇÃO: Verificar se patient_id ${patientIdViaCNS} tem registros em procedure_records`);

                  // Verificar IDs similares
                  const similarPatientIds = Array.from(proceduresByPatientId.keys()).filter(id =>
                    id.substring(0, 8) === patientIdViaCNS.substring(0, 8)
                  );
                  if (similarPatientIds.length > 0) {
                    console.log(`        🔍 Patient_IDs similares com procedimentos: ${similarPatientIds.slice(0, 2)}`);
                  }
                }
              }
            }
          }



          if (proceduresToAssign.length > 0) {
            // Converter ProcedureRecord para ProcedureDetail
            const convertedProcedures = proceduresToAssign.map(proc => ({
              procedure_id: proc.id,
              procedure_code: proc.procedure_code,
              procedure_description: proc.procedure_description,
              procedure_date: proc.procedure_date,
              sequence: (proc as any).sequencia ?? (proc as any).sequence,
              value_reais: (proc.value_charged || proc.total_value || 0) / 100, // Converter centavos para reais
              value_cents: proc.value_charged || proc.total_value || 0,
              approval_status: proc.billing_status || 'pending',
              professional_name: proc.professional_name || proc.professional || 'Profissional não informado',
              cbo: proc.professional_cbo,
              participation: 'Executante'
            }));

            patient.procedures.push(...convertedProcedures);
            totalProceduresAssociated += convertedProcedures.length;

            console.log(`      ✅ Associados ${convertedProcedures.length} procedimentos`);
            console.log(`      📋 Códigos: ${convertedProcedures.map(p => p.procedure_code).join(', ')}`);
          } else {
            console.log(`      ⚠️  Nenhum procedimento encontrado`);
          }
        });
      });

      console.log('\n📊 === RESULTADO DA ASSOCIAÇÃO (VIA CNS) ===');
      console.log(`✅ Total de procedimentos associados: ${totalProceduresAssociated}`);
      console.log(`🔗 Associações diretas encontradas: ${associationsFound}`);
      console.log(`👥 Total de pacientes processados: ${doctorsData.reduce((sum, d) => sum + d.patients.length, 0)}`);

      // 🚨 RESUMO ESTATÍSTICO DETALHADO
      const totalPatients = doctorsData.reduce((sum, d) => sum + d.patients.length, 0);

      console.log('\n📊 === RESUMO ESTATÍSTICO DETALHADO ===');
      console.log(`📋 Procedimentos na tabela: ${result.procedures.length}`);
      console.log(`👥 Patient IDs únicos nos procedimentos: ${currentProcedurePatientIds.length}`);
      console.log(`🆔 CNS únicos dos médicos: ${patientCNSs.size}`);
      console.log(`🔗 Patient_IDs via CNS: ${cnsToPatientIdMap.size}`);
      console.log(`🎯 Intersecção via CNS: ${intersection.length}`);

      console.log('\n🎯 === BREAKDOWN POR CATEGORIA ===');
      console.log(`👥 Total de pacientes: ${totalPatients}`);
      console.log(`✅ Pacientes COM procedimentos: ${patientsWithProcedures} (${((patientsWithProcedures / totalPatients) * 100).toFixed(1)}%)`);
      console.log(`⚠️ Pacientes SEM procedimentos: ${totalPatients - patientsWithProcedures} (${(((totalPatients - patientsWithProcedures) / totalPatients) * 100).toFixed(1)}%)`);

      console.log('\n🔍 === DETALHAMENTO DOS PROBLEMAS ===');
      if (patientsWithoutCNS > 0) {
        console.log(`❌ Pacientes sem CNS: ${patientsWithoutCNS}`);
        console.log(`   💡 SOLUÇÃO: Verificar por que alguns pacientes não têm CNS`);
      }
      if (patientsWithCNSNotInDB > 0) {
        console.log(`❌ CNS não encontrado na tabela patients: ${patientsWithCNSNotInDB}`);
        console.log(`   💡 SOLUÇÃO: Verificar se esses CNS existem na tabela patients`);
      }
      if (patientsWithValidIdButNoProcedures > 0) {
        console.log(`❌ Patient_ID válido mas sem procedimentos: ${patientsWithValidIdButNoProcedures}`);
        console.log(`   💡 SOLUÇÃO: Verificar se esses patient_ids têm registros em procedure_records`);
      }

      if (patientsWithProcedures > 0) {
        console.log(`\n🎉 SUCESSO PARCIAL!`);
        console.log(`   ✅ ${patientsWithProcedures} pacientes já estão recebendo procedimentos`);
        console.log(`   📈 Taxa de sucesso: ${((patientsWithProcedures / totalPatients) * 100).toFixed(1)}%`);
      }

      console.log(`🎯 RESULTADO: ${totalProceduresAssociated} procedimentos associados aos pacientes`);

      // ✅ Log de informação - sem toast (carregamento automático, não precisa notificar usuário)
      if (totalProceduresAssociated === 0) {
        console.warn('⚠️ Nenhum procedimento associado. Verifique os dados.');
      }

    } catch (error) {
      console.error('❌ Erro ao carregar procedimentos separadamente:', error);
      // ✅ Toast apenas para erro crítico (impacta visualização de dados)
      toast.error('Erro ao carregar procedimentos');
    }
  };

  // ✅ CARREGAR DADOS DOS MÉDICOS COM FILTRO POR HOSPITAL
  useEffect(() => {
    const loadDoctorsData = async () => {
      if (!user) return;
      try {
        setIsLoading(true);
        try { window.dispatchEvent(new Event('mpd:loading-start')) } catch { }
        // Guardar estado inicial vazio quando fonte SIH está ativa sem filtros
        const isRemoteInitial = useSihSource && (
          !selectedHospitals || selectedHospitals.length === 0 || selectedHospitals.includes('all')
        );
        if (isRemoteInitial) {
          setDoctors([]);
          setFilteredDoctors([]);
          setIsLoading(false);
          try { window.dispatchEvent(new Event('mpd:loading-end')) } catch { }
          return;
        }

        // ✅ DETECTAR MODO DE ACESSO
        const isAdminMode = canAccessAllHospitals() || hasFullAccess() || user.hospital_id === 'ALL';
        const userHospitalId = user.hospital_id;

        console.log('🔄 Carregando dados dos médicos...');
        console.log(`🔐 Modo de acesso: ${isAdminMode ? 'ADMINISTRADOR (todos os hospitais)' : `USUÁRIO (hospital: ${userHospitalId})`}`);

        // Para o teste solicitado: carregar TODOS os médicos que existem em doctor_hospital (sem filtros)
        const doctorsList = await DoctorsCrudService.getAllDoctors();
        const doctorsData = (doctorsList.success ? (doctorsList.data || []) : []).map(d => ({
          doctor_info: {
            name: d.name,
            cns: d.cns,
            crm: d.crm,
            specialty: d.speciality,
          },
          // Construir hospitais com base na lista agregada presente em DoctorsCrudService
          hospitals: (d as any).hospitals?.map((hospitalName: string, idx: number) => ({
            hospital_id: (d as any).hospitalIds?.[idx] || '',
            hospital_name: hospitalName,
            hospital_cnpj: '',
            role: undefined,
            department: undefined,
            is_active: true
          })) || [],
          // Para teste: iniciar pacientes vazio; procedimentos carregados depois se necessário
          patients: []
        })) as unknown as DoctorWithPatients[];
        console.log('✅ Médicos carregados de doctor_hospital:', doctorsData.length);

        // ✅ CARREGAR PACIENTES VIA AIH PARA CADA MÉDICO (associação Médicos → Pacientes)
        // Usa fonte real do banco (aihs + patients), via serviço agregador
        let mergedDoctors = doctorsData;
        try {
          // ✅ SIMPLIFICADO: Usar APENAS competência como filtro (sem filtros de data)
          const selectedHospitalIds = (selectedHospitals && !selectedHospitals.includes('all')) ? selectedHospitals : undefined;
          // ✅ CORREÇÃO: Verificar se competência é válida (não 'all', não vazia, não undefined/null)
          const competenciaFilter = (selectedCompetencia &&
            selectedCompetencia !== 'all' &&
            selectedCompetencia.trim() !== '' &&
            selectedCompetencia !== undefined &&
            selectedCompetencia !== null)
            ? selectedCompetencia.trim()
            : undefined;
          const careFilter = (filterCareCharacter && filterCareCharacter !== 'all') ? filterCareCharacter : undefined;

          console.log('🗓️ [MedicalProductionDashboard] Carregando dados:', {
            competencia: competenciaFilter || 'TODAS',
            care_character: careFilter || 'TODOS',
            hospitals: selectedHospitalIds || 'TODOS',
            selectedCompetenciaRaw: selectedCompetencia
          });

          const doctorsWithPatients = await DoctorPatientService.getDoctorsWithPatientsFromProceduresView({
            hospitalIds: selectedHospitalIds,
            competencia: competenciaFilter, // ✅ Passar undefined se não houver filtro
            filterCareCharacter: careFilter,
            dischargeDateRange,
            doctorNameContains: searchTerm?.trim() || undefined,
            patientNameContains: patientSearchTerm?.trim() || undefined
          });
          // Usar diretamente a fonte das tabelas, garantindo pacientes e procedimentos
          mergedDoctors = doctorsWithPatients;
          console.log('✅ Associação Médicos → Pacientes carregada:', mergedDoctors.filter(d => d.patients.length > 0).length, 'médicos com pacientes');
        } catch (assocErr) {
          console.warn('⚠️ Falha ao carregar associação de pacientes; mantendo lista de médicos sem pacientes.', assocErr);
        }

        // ✅ CARREGAR LISTA DE HOSPITAIS DISPONÍVEIS
        await loadAvailableHospitals(mergedDoctors);

        // ✅ DUPLICAR POR HOSPITAL: 1 card por par (médico, hospital)
        const explodedByHospitalRaw: DoctorWithPatients[] = mergedDoctors.flatMap((doc) => {
          const hospitals = doc.hospitals && doc.hospitals.length > 0 ? doc.hospitals : [{ hospital_id: '', hospital_name: 'Hospital não definido', is_active: true } as any];
          return hospitals.map(h => ({
            doctor_info: { ...doc.doctor_info },
            hospitals: [h],
            // Filtrar pacientes para o hospital quando possível
            patients: doc.patients.filter(p => {
              const patientHospitalId = (p as any).aih_info?.hospital_id;
              if (!patientHospitalId) return true; // se não há hospital na AIH, não filtra
              if (!h.hospital_id) return true;     // se o card não tem hospital_id, mantém
              return patientHospitalId === h.hospital_id;
            })
          }));
        });

        // ✅ REMOVER DUPLICATAS POR (CNS::HOSPITAL_ID) AO VOLTAR À TELA
        const dedupMap = new Map<string, DoctorWithPatients>();
        for (const d of explodedByHospitalRaw) {
          const key = getDoctorCardKey(d);
          if (!dedupMap.has(key)) {
            dedupMap.set(key, d);
          }
        }
        const explodedByHospital = Array.from(dedupMap.values());

        setDoctors(explodedByHospital);
        setFilteredDoctors(explodedByHospital);

        // ✅ Log de informação - sem toast (carregamento inicial automático)
        console.log(`✅ ${explodedByHospital.length} cartões (médico×hospital) carregados`);
      } catch (error) {
        console.error('❌ Erro ao carregar dados dos médicos:', error);
        toast.error('Erro ao carregar dados dos médicos');
      } finally {
        setIsLoading(false);
        try { window.dispatchEvent(new Event('mpd:loading-end')) } catch { }
      }
    };

    loadDoctorsData();
  }, [user, canAccessAllHospitals, hasFullAccess, selectedHospitals, refreshTick, selectedCompetencia, filterCareCharacter, dischargeDateRange?.from, dischargeDateRange?.to]);

  // 🆕 CARREGAR COMPETÊNCIAS DISPONÍVEIS (apenas das AIHs carregadas atualmente)
  useEffect(() => {
    if (doctors.length > 0) {
      const competencias = new Set<string>();
      doctors.forEach(doctor => {
        doctor.patients.forEach(patient => {
          const comp = (patient as any)?.aih_info?.competencia;
          if (comp) competencias.add(comp);
        });
      });
      const sorted = Array.from(competencias).sort((a, b) => b.localeCompare(a));
      setAvailableCompetencias(sorted);
    } else {
      setAvailableCompetencias([]);
    }
  }, [doctors]);

  // 🆕 SUBSCRIÇÃO REALTIME: AIHs e PROCEDURE_RECORDS (apenas inserts)
  useEffect(() => {
    if (!autoRefresh) return; // não assinar realtime se desligado
    const channel = supabase
      .channel('medical-production-realtime')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'aihs' }, (payload) => {
        // Filtrar por hospital e período ativos, quando possível
        try {
          const row: any = payload.new;
          if (selectedHospitals && !selectedHospitals.includes('all')) {
            if (!selectedHospitals.includes(row.hospital_id)) return;
          }
          // ✅ REMOVIDO: Filtro de data
        } catch { }
        if (realtimeDebounceRef.current) clearTimeout(realtimeDebounceRef.current);
        realtimeDebounceRef.current = setTimeout(() => setRefreshTick((t) => t + 1), 800);
      })
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'procedure_records' }, (payload) => {
        try {
          // Se o insert não pertence aos filtros atuais, ignore
          const row: any = payload.new;
          if (selectedHospitals && !selectedHospitals.includes('all')) {
            if (!selectedHospitals.includes(row.hospital_id)) return;
          }
          // ✅ REMOVIDO: Filtro de data
        } catch { }
        if (realtimeDebounceRef.current) clearTimeout(realtimeDebounceRef.current);
        realtimeDebounceRef.current = setTimeout(() => setRefreshTick((t) => t + 1), 800);
      })
      .subscribe();

    return () => {
      try { supabase.removeChannel(channel); } catch { }
      if (realtimeDebounceRef.current) clearTimeout(realtimeDebounceRef.current);
    };
  }, [autoRefresh, selectedHospitals]);

  // 🕒 POLLING DE BACKUP: desativado por padrão para evitar recargas
  // useEffect(() => {
  //   const id = setInterval(() => setRefreshTick(t => t + 1), 60000);
  //   return () => clearInterval(id);
  // }, []);

  // 🔧 Pré-carregar mapas de HON (VBA) para garantir aplicação imediata
  useEffect(() => {
    (async () => {
      try {
        await Promise.all([
          loadGynHonMap(),
          loadUroHonMap(),
          loadOtoHonMap(),
          loadOtoSaoJoseHonMap(),
          loadVasHonMap()
        ])
        setRefreshTick(t => t + 1)
      } catch { }
    })()
  }, [])
  // 🔢 Contagem de AIHs via RPC otimizada (mesmos filtros da tela)
  useEffect(() => {
    (async () => {
      try {
        const hospitalIds = (selectedHospitals.length > 0 && !selectedHospitals.includes('all')) ? selectedHospitals : null;
        const rawCare = String(filterCareCharacter || '').trim();
        const careNormalized = rawCare === '01' ? '1' : rawCare === '02' ? '2' : (rawCare === 'all' ? null : rawCare || null);
        const { data, error } = await supabase.rpc('get_aih_count', {
          hospital_ids: hospitalIds,
          competencia: (selectedCompetencia && selectedCompetencia !== 'all' && selectedCompetencia.trim() !== '') ? selectedCompetencia.trim() : null,
          care_character: careNormalized,
          discharge_from: dischargeDateRange?.from || null,
          discharge_to: dischargeDateRange?.to || null,
          doctor_name: (searchTerm && searchTerm.trim() !== '') ? searchTerm.trim() : null,
          patient_name: (patientSearchTerm && patientSearchTerm.trim() !== '') ? patientSearchTerm.trim() : null
        });
        if (error) {
          console.warn('⚠️ Falha RPC get_aih_count:', error);
          try {
            let query = supabase.from('aihs').select('id', { count: 'exact', head: true });
            if (hospitalIds) query = query.in('hospital_id', hospitalIds as any);
            const comp = (selectedCompetencia && selectedCompetencia !== 'all' && selectedCompetencia.trim() !== '') ? selectedCompetencia.trim() : null;
            if (comp) query = query.eq('competencia', comp);
            if (careNormalized) query = query.eq('care_character', careNormalized);
            const from = dischargeDateRange?.from || null;
            const to = dischargeDateRange?.to || null;
            if (from) query = query.gte('discharge_date', from);
            if (to) query = query.lt('discharge_date', new Date(new Date(to).getTime() + 24 * 60 * 60 * 1000).toISOString());
            const { count, error: countErr } = await query;
            if (countErr) {
              console.warn('⚠️ Fallback count em aihs falhou:', countErr);
              setDbAihCount(null);
            } else {
              setDbAihCount(typeof count === 'number' ? count : null);
            }
          } catch (fallbackErr) {
            console.warn('⚠️ Erro fallback count:', fallbackErr);
            setDbAihCount(null);
          }
        } else {
          setDbAihCount(typeof data === 'number' ? data : null);
        }
      } catch (err) {
        console.warn('⚠️ Erro ao obter contagem de AIHs no banco:', err);
        setDbAihCount(null);
      }
    })();
  }, [selectedHospitals, selectedCompetencia, filterCareCharacter, dischargeDateRange, patientSearchTerm, searchTerm]);

  // ✅ FILTRAR MÉDICOS BASEADO NO TERMO DE BUSCA, HOSPITAL, CARÁTER DE ATENDIMENTO E DATAS
  useEffect(() => {
    let filtered = doctors;

    // 🏥 FILTRAR POR HOSPITAL USANDO FILTROS GLOBAIS
    if (selectedHospitals.length > 0 && !selectedHospitals.includes('all')) {
      filtered = filtered.filter(doctor => {
        return doctor.hospitals?.some(hospital =>
          selectedHospitals.includes(hospital.hospital_id)
        );
      });
      console.log('🏥 Aplicando filtros globais de hospital na aba Médicos:', selectedHospitals);
    }

    // Auditoria: NÃO remover pacientes por período; manter todos os pacientes associados ao médico

    // Auditoria: NÃO filtrar pacientes por caráter de atendimento; manter todos

    // 👨‍⚕️ FILTRAR POR TERMO DE BUSCA DE MÉDICO
    if (debouncedSearchTerm.trim()) {
      const searchLower = debouncedSearchTerm.toLowerCase();
      filtered = filtered.filter(doctor => {
        return doctor.doctor_info.name.toLowerCase().includes(searchLower) ||
          doctor.doctor_info.cns.includes(debouncedSearchTerm) ||
          doctor.doctor_info.crm?.toLowerCase().includes(searchLower) ||
          doctor.doctor_info.specialty?.toLowerCase().includes(searchLower);
      });
    }

    // 🧹 Ocultar card "Dr(a). CNS 000..." (pagamentos hospitalares)
    filtered = filtered.filter(doctor => !isZeroCns(doctor.doctor_info?.cns));

    // 🧑‍🦱 NOVO: FILTRAR POR NOME DO PACIENTE
    if (debouncedPatientSearchTerm.trim()) {
      const patientSearchLower = debouncedPatientSearchTerm.toLowerCase();
      console.log('🔍 [FILTRO PACIENTE] Buscando por:', patientSearchTerm);

      filtered = filtered.map(doctor => {
        // Filtrar apenas os pacientes que coincidem com a busca
        const matchingPatients = doctor.patients.filter(patient => {
          const patientName = patient.patient_info?.name || '';
          const matches = patientName.toLowerCase().includes(patientSearchLower);
          if (matches) {
            console.log(`✅ [FILTRO PACIENTE] Encontrado: ${patientName} (Médico: ${doctor.doctor_info.name})`);
          }
          return matches;
        });

        // Retornar médico apenas se tiver pacientes que coincidem
        return { ...doctor, patients: matchingPatients };
      }).filter(doctor => doctor.patients.length > 0); // Remover médicos sem pacientes correspondentes

      console.log(`🔍 [FILTRO PACIENTE] Resultado: ${filtered.length} médicos com pacientes correspondentes`);
    }

    // ✅ REINTEGRADO: Filtro de especialidade médica
    if (selectedSpecialties && selectedSpecialties.length > 0) {
      filtered = filtered.filter(doctor => {
        const docSpec = (doctor.doctor_info?.specialty || '').trim();
        return selectedSpecialties.includes(docSpec);
      });
    }

    // ✅ SIMPLIFICADO: Filtro de competência removido (já aplicado no backend)
    // A competência já é filtrada no carregamento dos dados via DoctorPatientService

    setFilteredDoctors(filtered);

    // Reset da página atual quando filtros são aplicados
    setCurrentDoctorPage(1);
  }, [debouncedSearchTerm, debouncedPatientSearchTerm, selectedCompetencia, doctors, selectedHospitals, selectedSpecialties]);

  // ✅ TOGGLE EXPANDIR MÉDICO
  const toggleDoctorExpansion = (doctorKey: string) => {
    const newExpanded = new Set(expandedDoctors);
    if (newExpanded.has(doctorKey)) {
      newExpanded.delete(doctorKey);
    } else {
      newExpanded.add(doctorKey);
    }
    setExpandedDoctors(newExpanded);
  };

  // 🚨 CALCULAR PACIENTES SEM REPASSE (sob demanda)
  const calculatePatientsWithoutPayment = React.useCallback((doctor: DoctorWithPatients, doctorKey: string) => {
    // Se já calculou, não recalcular
    if (patientsWithoutPaymentCache.has(doctorKey)) {
      return;
    }

    const hospitalId = doctor.hospitals?.[0]?.hospital_id;
    let patientsWithoutPayment = 0;
    const totalPatients = doctor.patients?.length || 0;

    // Contar pacientes com pagamento = 0
    (doctor.patients || []).forEach((patient) => {
      const aihKey = (patient as any).aih_id || normalizeAihNumber((patient as any)?.aih_info?.aih_number) || '__single__'
      const baseProcedures = (patient as any).calculable_procedures || getCalculableProcedures(
        ((patient.procedures || []) as any[]).map((proc: any) => ({
          ...proc,
          aih_id: proc.aih_id || aihKey,
          sequence: proc.sequence ?? proc.sequencia ?? proc.procedure_sequence
        }))
      )
      const proceduresWithPayment = (baseProcedures as any[])
        .filter((proc: any) => isMedicalProcedure(proc.procedure_code))
        .map((proc: any) => ({
          procedure_code: proc.procedure_code,
          procedure_description: proc.procedure_description,
          value_reais: proc.value_reais || 0,
          cbo: proc.cbo,
          sequence: proc.sequence,
        }));

      if (proceduresWithPayment.length > 0) {
        const paymentResult = calculateDoctorPayment(
          doctor.doctor_info.name,
          proceduresWithPayment,
          hospitalId
        );

        if ((paymentResult.totalPayment || 0) === 0) {
          patientsWithoutPayment++;
        }
      } else {
        // Sem procedimentos calculáveis = sem repasse
        patientsWithoutPayment++;
      }
    });

    // Armazenar no cache
    setPatientsWithoutPaymentCache(prev => new Map(prev).set(doctorKey, {
      count: patientsWithoutPayment,
      total: totalPatients,
      calculated: true
    }));
  }, [patientsWithoutPaymentCache]);

  const openZeroRepasseModal = React.useCallback(async (doctor: DoctorWithPatients) => {
    try {
      const hospitalId = doctor.hospitals?.[0]?.hospital_id
      const normalizeAih = (s: string) => String(s || '').replace(/\D/g, '').replace(/^0+/, '')
      const items: Array<{ medicalRecord: string; aihNumber: string; name: string; procedures: string; discharge: string }> = []
      const localMap = sigtapMap
      for (const p of (doctor.patients || []) as any[]) {
        const medicalRecord = p?.patient_info?.medical_record || '-'
        const aihNumber = normalizeAih(p?.aih_info?.aih_number)
        const dischargeISO = p?.aih_info?.discharge_date || ''
        const discharge = parseISODateToLocal(dischargeISO)
        let name = p?.patient_info?.name || 'Paciente'
        const procsAll = p.procedures || []
        const aihKey = (p as any).aih_id || normalizeAihNumber(p?.aih_info?.aih_number) || '__single__'
        const calculable = (p as any).calculable_procedures || getCalculableProcedures(
          (procsAll as any[]).map((x: any) => ({ ...x, aih_id: x.aih_id || aihKey, sequence: x.sequence ?? x.sequencia ?? x.procedure_sequence }))
        )
        const medicalSorted = (calculable as any[])
          .filter((x: any) => isMedicalProcedure(x.procedure_code))
          .sort((a: any, b: any) => {
            const sa = typeof a.sequence === 'number' ? a.sequence : 9999
            const sb = typeof b.sequence === 'number' ? b.sequence : 9999
            if (sa !== sb) return sa - sb
            const va = typeof a.value_reais === 'number' ? a.value_reais : 0
            const vb = typeof b.value_reais === 'number' ? b.value_reais : 0
            return vb - va
          })
        const labels = medicalSorted.slice(0, 3).map((m: any) => {
          const code = m.procedure_code || ''
          const digits = code.replace(/\D/g, '')
          const descFallback = code && localMap ? ((localMap.get(code) || localMap.get(digits) || '') as string) : ''
          const desc = ((m.procedure_description || m.sigtap_description || descFallback || '') as string).trim()
          return desc || (code ? `Procedimento ${code}` : 'Procedimento')
        })
        const proceduresLabel = labels.length > 0 ? labels.join(' + ') : 'Sem procedimento principal'
        let repasseValue = 0
        if (medicalSorted.length > 0) {
          const doctorName = doctor.doctor_info?.name || ''
          const isGenSurg = /cirurg/i.test(doctorName) || (/cirurg/i.test(doctor.doctor_info.specialty || '') && /geral/i.test(doctor.doctor_info.specialty || ''))
          const paymentResult = (shouldUseHonForHospital(doctorName, hospitalId, !!isGenSurg)
            ? calculateHonPayments(medicalSorted.map((proc: any) => ({ procedure_code: proc.procedure_code, value_reais: proc.value_reais || 0, cbo: proc.cbo, sequence: proc.sequence })))
            : calculateDoctorPayment(doctorName, medicalSorted.map((proc: any) => ({ procedure_code: proc.procedure_code, value_reais: proc.value_reais || 0, cbo: proc.cbo, sequence: proc.sequence })), hospitalId))
          repasseValue = paymentResult.totalPayment || 0
        }
        if (repasseValue === 0) {
          items.push({ medicalRecord, aihNumber: aihNumber || '-', name, procedures: proceduresLabel, discharge })
        }
      }
      setZeroRepasseDoctorName(doctor.doctor_info?.name || '')
      setZeroRepasseItems(items)
      setZeroRepasseOpen(true)
    } catch { }
  }, [sigtapMap])

  const exportZeroRepasseExcel = React.useCallback(() => {
    const header = ['Prontuário', 'Nº AIH', 'Nome', 'Procedimentos', 'Data Alta']
    const rows = zeroRepasseItems.map(it => [it.medicalRecord, it.aihNumber, it.name, it.procedures, it.discharge])
    const wb = XLSX.utils.book_new()
    const ws = XLSX.utils.aoa_to_sheet([header, ...rows])
    const wsAny: any = ws
    wsAny['!cols'] = [
      { wch: 14 },
      { wch: 18 },
      { wch: 30 },
      { wch: 50 },
      { wch: 12 }
    ]
    XLSX.utils.book_append_sheet(wb, ws, 'Sem Repasse')
    const fileName = `Sem_Repasse_${(zeroRepasseDoctorName || 'Medico').replace(/\s+/g, '_')}_${formatDateFns(new Date(), 'yyyyMMdd_HHmm')}.xlsx`
    XLSX.writeFile(wb, fileName)
  }, [zeroRepasseItems, zeroRepasseDoctorName])

  // ✅ TOGGLE EXPANDIR PACIENTE
  const togglePatientExpansion = (patientKey: string) => {
    const newExpanded = new Set(expandedPatients);
    if (newExpanded.has(patientKey)) {
      newExpanded.delete(patientKey);
    } else {
      newExpanded.add(patientKey);
    }
    setExpandedPatients(newExpanded);
  };

  const dedupeReport = React.useMemo(() => {
    try {
      const perAihPerDoctor = new Map<string, Map<string, { sum: number; name: string; cboSet: Set<string>; isAnesth: boolean }>>()
      const nameByCns = new Map<string, string>()
      for (const doctor of filteredDoctors) {
        const cns = doctor.doctor_info.cns || 'NO_CNS'
        nameByCns.set(cns, doctor.doctor_info.name || '')
        for (const p of doctor.patients as any[]) {
          const aihKey = normalizeAihNumber(p?.aih_info?.aih_number)
          if (!aihKey) continue
          let entry = { sum: 0, name: doctor.doctor_info.name || '', cboSet: new Set<string>(), isAnesth: false }
          for (const proc of (p.procedures || [])) {
            const belongs = (proc?.professional_name || '') === (doctor.doctor_info.name || '')
            if (!belongs) continue
            const val = Number(proc.value_reais || 0)
            entry.sum += val
            const cbo = String(proc.cbo || '')
            if (cbo) entry.cboSet.add(cbo)
            if (cbo === '225151') entry.isAnesth = true
          }
          if (!perAihPerDoctor.has(aihKey)) perAihPerDoctor.set(aihKey, new Map<string, { sum: number; name: string; cboSet: Set<string>; isAnesth: boolean }>())
          const byDoctor = perAihPerDoctor.get(aihKey)!
          const prev = byDoctor.get(cns)
          if (prev) {
            prev.sum += entry.sum
            entry.cboSet.forEach(v => prev.cboSet.add(v))
            prev.isAnesth = prev.isAnesth || entry.isAnesth
          } else {
            byDoctor.set(cns, entry)
          }
        }
      }
      const assignment = new Map<string, string>()
      const dedupList: Array<{ aih: string; cns: string; cbo?: string; doctorName?: string; value: number }> = []
      for (const [aihKey, byDoctor] of perAihPerDoctor.entries()) {
        const entries = Array.from(byDoctor.entries())
        const hasNonAnesth = entries.some(([_, info]) => !info.isAnesth && info.sum > 0)
        let candidates = entries
        if (hasNonAnesth) candidates = entries.filter(([_, info]) => !info.isAnesth)
        let bestCns: string | null = null
        let bestVal = -1
        for (const [cns, info] of candidates) {
          if (info.sum > bestVal) { bestVal = info.sum; bestCns = cns }
        }
        if (bestCns) {
          assignment.set(aihKey, bestCns)
          for (const [cns, info] of entries) {
            if (cns !== bestCns && info.sum > 0) {
              const cbo = Array.from(info.cboSet.values())[0]
              dedupList.push({ aih: aihKey, cns, cbo, doctorName: nameByCns.get(cns) || '', value: info.sum })
            }
          }
        }
      }
      const dedupCns = Array.from(new Set(dedupList.map(x => x.cns).filter(Boolean)))
      const dedupCbos = Array.from(new Set(dedupList.map(x => x.cbo).filter(Boolean)))
      return { assignmentMap: assignment, dedupList, dedupCns, dedupCbos }
    } catch {
      return { assignmentMap: new Map<string, string>(), dedupList: [], dedupCns: [], dedupCbos: [] }
    }
  }, [filteredDoctors])

  // ✅ CALCULAR ESTATÍSTICAS GLOBAIS AVANÇADAS
  const globalStats = React.useMemo(() => {
    const totalDoctors = doctors.length;

    // ✅ PRIORIDADE: Usar totais SIH remotos quando disponíveis
    let totalAIHs, totalRevenue, avgTicket;

    if (useSihSource && remoteConfigured && sihRemoteTotals) {
      // Usar dados SIH remotos para totais principais
      totalAIHs = sihRemoteTotals.totalAIHs;
      totalRevenue = sihRemoteTotals.totalValue;
      avgTicket = totalAIHs > 0 ? totalRevenue / totalAIHs : 0;

      console.log(`📊 [GLOBAL STATS] Usando SIH remoto: ${totalAIHs} AIHs | R$ ${totalRevenue.toFixed(2)}`);
    } else {
      // Usar cálculo local tradicional
      // ✅ CONTAGEM DUPLA: Total de AIHs E Pacientes Únicos
      totalAIHs = doctors.reduce((sum, doctor) => sum + doctor.patients.length, 0);

      // Coletar todos os procedimentos (🚫 EXCLUINDO ANESTESISTAS 04.xxx)
      const allProcedures = doctors.flatMap(doctor =>
        doctor.patients.flatMap(patient =>
          patient.procedures.filter(filterCalculableProcedures)
        )
      );

      totalRevenue = allProcedures.reduce((sum, proc) => sum + (proc.value_reais || 0), 0);
      avgTicket = totalAIHs > 0 ? totalRevenue / totalAIHs : 0;
    }

    // Contar pacientes únicos (pessoas diferentes) - sempre local
    const uniquePatientIds = new Set<string>();
    doctors.forEach(doctor => {
      doctor.patients.forEach(patient => {
        if (patient.patient_id) {
          uniquePatientIds.add(patient.patient_id);
        }
      });
    });
    const uniquePatients = uniquePatientIds.size;

    const totalPatients = totalAIHs; // Mantém compatibilidade (totalPatients = total de AIHs)

    // Coletar todos os procedimentos (🚫 EXCLUINDO ANESTESISTAS 04.xxx) - sempre local
    const allProcedures = doctors.flatMap(doctor =>
      doctor.patients.flatMap(patient =>
        patient.procedures.filter(filterCalculableProcedures)
      )
    );

    // Calcular total de procedimentos de anestesistas iniciados em '04' (excluindo cesarianas)
    const totalAnesthetistProcedures04 = doctors.reduce((total, doctor) => {
      const doctorStats = calculateDoctorStats(doctor, dedupeReport.assignmentMap, dischargeDateRange);
      return total + doctorStats.anesthetistProcedures04Count;
    }, 0);

    const totalProcedures = allProcedures.length;

    // Análise de aprovação - sempre local
    const approvedProcedures = allProcedures.filter(p => p.approval_status === 'approved').length;
    const pendingProcedures = allProcedures.filter(p => p.approval_status === 'pending').length;
    const rejectedProcedures = allProcedures.filter(p => p.approval_status === 'rejected').length;
    const approvalRate = totalProcedures > 0 ? (approvedProcedures / totalProcedures) * 100 : 0;

    // Procedimentos mais comuns
    const procedureFrequency = allProcedures.reduce((acc, proc) => {
      const key = proc.procedure_code;
      acc[key] = (acc[key] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    const mostCommonProcedures = Object.entries(procedureFrequency)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 3)
      .map(([code, count]) => ({ code, count }));

    // Detectar se são dados de demonstração
    const isDemoData = doctors.length > 0 && doctors[0].doctor_info.name.includes('João Silva') &&
      doctors[0].doctor_info.cns === '123456789012345';

    return {
      totalDoctors,
      totalPatients, // Total de AIHs (para compatibilidade)
      totalAIHs, // Total de AIHs/internações
      uniquePatients, // Pacientes únicos
      totalProcedures,
      totalRevenue,
      avgTicket,
      approvedProcedures,
      pendingProcedures,
      rejectedProcedures,
      approvalRate,
      mostCommonProcedures,
      totalAnesthetistProcedures04,
      isDemoData
    };
  }, [doctors, useSihSource, remoteConfigured, sihRemoteTotals]);

  // ✅ CALCULAR ESTATÍSTICAS DOS MÉDICOS FILTRADOS
  const filteredStats = React.useMemo(() => {
    const totalDoctors = filteredDoctors.length;

    // ✅ PRIORIDADE: Usar totais SIH remotos quando disponíveis
    let totalAIHs, totalRevenue;

    if (useSihSource && remoteConfigured && sihRemoteTotals) {
      // Usar dados SIH remotos para totais principais
      totalAIHs = sihRemoteTotals.totalAIHs;
      totalRevenue = sihRemoteTotals.totalValue;

      console.log(`📊 [FILTERED STATS] Usando SIH remoto: ${totalAIHs} AIHs | R$ ${totalRevenue.toFixed(2)}`);
    } else {
      // Usar cálculo local com deduplicação por AIH
      const uniqueAihSet = new Set<string>();
      filteredDoctors.forEach(doctor => {
        (doctor.patients || []).forEach((p: any) => {
          const aihId = String(p.aih_id || '').trim();
          const aihNumber = String(p?.aih_info?.aih_number || '').replace(/\D/g, '').replace(/^0+/, '');
          const key = aihId || aihNumber || `${p.patient_id || ''}|${p?.aih_info?.admission_date || ''}`;
          if (key) uniqueAihSet.add(key);
        });
      });
      totalAIHs = uniqueAihSet.size;

      // Coletar todos os procedimentos dos médicos filtrados (🚫 EXCLUINDO ANESTESISTAS 04.xxx)
      const allProcedures = filteredDoctors.flatMap(doctor =>
        doctor.patients.flatMap(patient =>
          ((patient as any).calculable_procedures || patient.procedures.filter(filterCalculableProcedures))
        )
      );

      totalRevenue = allProcedures.reduce((sum, proc) => sum + (proc.value_reais || 0), 0);
    }

    // Contar pacientes únicos (pessoas diferentes) - sempre local
    const uniquePatientIds = new Set<string>();
    filteredDoctors.forEach(doctor => {
      doctor.patients.forEach(patient => {
        if (patient.patient_id) {
          uniquePatientIds.add(patient.patient_id);
        }
      });
    });
    const uniquePatients = uniquePatientIds.size;

    const totalPatients = totalAIHs; // Mantém compatibilidade (totalPatients = total de AIHs)

    // Coletar todos os procedimentos dos médicos filtrados (🚫 EXCLUINDO ANESTESISTAS 04.xxx) - sempre local
    const allProcedures = filteredDoctors.flatMap(doctor =>
      doctor.patients.flatMap(patient =>
        patient.procedures.filter(filterCalculableProcedures)
      )
    );

    const totalProcedures = allProcedures.length;

    return {
      totalDoctors,
      totalPatients, // Total de AIHs (para compatibilidade)
      totalAIHs, // Total de AIHs/internações
      uniquePatients, // Pacientes únicos
      totalProcedures,
      totalRevenue
    };
  }, [filteredDoctors, useSihSource, remoteConfigured, sihRemoteTotals]);

  // ✅ NOVO: Calcular pacientes com múltiplas AIHs (igual PatientManagement)
  const multipleAIHsStats = React.useMemo(() => {
    const aihIds = new Set<string>();
    const patientAIHCount = new Map<string, number>();
    const patientDetails = new Map<string, any>();
    const patientAIHsList = new Map<string, any[]>();

    filteredDoctors.forEach(doctor => {
      doctor.patients.forEach(patient => {
        const aihId = String(patient.aih_id || '').trim();
        if (aihId) aihIds.add(aihId);
        const pid = patient.patient_id || undefined;
        if (pid) {
          const current = patientAIHCount.get(pid) || 0;
          patientAIHCount.set(pid, current + 1);
          if (!patientAIHsList.has(pid)) patientAIHsList.set(pid, []);
          patientAIHsList.get(pid)!.push({
            aih_number: String(patient.aih_info?.aih_number || '').trim() || 'Não informado',
            admission_date: patient.aih_info?.admission_date,
            discharge_date: patient.aih_info?.discharge_date,
            competencia: patient.aih_info?.competencia
          });
          if (!patientDetails.has(pid)) {
            patientDetails.set(pid, {
              patient_id: pid,
              patient_name: patient.patient_info?.name || 'Nome não informado',
              patient_cns: patient.patient_info?.cns || 'Não informado',
              hospital_name: doctor.hospitals?.[0]?.hospital_name || 'Hospital não informado'
            });
          }
        }
      });
    });

    const patientsWithMultiple = new Map<string, number>();
    patientAIHCount.forEach((count, patientId) => {
      if (count > 1) patientsWithMultiple.set(patientId, count);
    });
    const totalMultipleAIHs = Array.from(patientsWithMultiple.values()).reduce((sum, count) => sum + count, 0);
    const multipleAIHsDetails = Array.from(patientsWithMultiple.entries())
      .map(([patientId, count]) => ({
        ...patientDetails.get(patientId),
        aih_count: count,
        aihs: patientAIHsList.get(patientId) || []
      }))
      .sort((a, b) => b.aih_count - a.aih_count);

    return {
      totalAIHs: aihIds.size,
      patientsWithMultipleAIHs: patientsWithMultiple.size,
      totalMultipleAIHs,
      aihsWithoutPatients: 0,
      multipleAIHsDetails
    };
  }, [filteredDoctors]);

  // 🚀 OTIMIZAÇÃO CRÍTICA: CACHE DE STATS POR MÉDICO
  // Calcula doctorStats UMA VEZ por médico e reutiliza em todos os contextos
  // Evita recálculos redundantes (5x por médico → 1x por médico)
  const doctorStatsCache = React.useMemo(() => {
    const cache = new Map<string, ReturnType<typeof calculateDoctorStats>>();

    for (const doctor of filteredDoctors) {
      const key = getDoctorCardKey(doctor);
      let stats = calculateDoctorStats(doctor, dedupeReport.assignmentMap, dischargeDateRange);
      // ✅ Regra especial: quando a fonte SIH remota está ativa e a especialidade é Anestesiologia,
      // zerar os cards financeiros para evitar dupla contagem (pagamento por AIH é tratado separadamente)
      try {
        const spec = doctor.doctor_info.specialty || '';
        const isAnesth = /anestesiolog/i.test(spec);
        const isPhysio = /fisioterap/i.test(spec);
        if (useSihSource && (isAnesth || isPhysio)) {
          stats = {
            ...stats,
            totalValue: 0,
            operaParanaIncrement: 0,
            totalValueWithOperaParana: 0,
            calculatedPaymentValue: 0,
          };
        }
      } catch { }
      cache.set(key, stats);
    }

    console.log(`⚡ [CACHE] Stats calculados para ${cache.size} médicos (otimização: 5x → 1x por médico)`);
    return cache;
  }, [filteredDoctors, dedupeReport.assignmentMap]);

  // 🧮 BUSCAR TOTAIS SIH REMOTOS
  const fetchSihRemoteTotals = React.useCallback(async () => {
    if (!useSihSource || !remoteConfigured) return null;

    try {
      console.log('🔍 Buscando totais SIH remotos...');

      // Obter filtros atuais
      const hospitalIds = selectedHospitals?.filter(h => h !== 'all') || [];
      let compYear: number | undefined;
      let compMonth: number | undefined;

      if (selectedCompetencia && selectedCompetencia !== 'all') {
        const raw = selectedCompetencia.trim();
        if (/^\d{6}$/.test(raw)) {
          compYear = parseInt(raw.slice(0, 4), 10);
          compMonth = parseInt(raw.slice(4, 6), 10);
        } else {
          const mDash = raw.match(/^(\d{4})-(\d{2})/);
          if (mDash) {
            compYear = parseInt(mDash[1], 10);
            compMonth = parseInt(mDash[2], 10);
          }
        }
      }

      // Mapear hospitalIds locais → CNES
      let cnesList: string[] = [];
      if (hospitalIds.length > 0) {
        const { data: hospData } = await supabase
          .from('hospitals')
          .select('id,cnes')
          .in('id', hospitalIds);
        cnesList = (hospData || []).map((h: any) => String(h.cnes)).filter(Boolean);
      }

      // Construir query para sih_rd (resumo por competência/hospital)
      let query = supabaseSih
        .from('sih_rd')
        .select('rd_val_tot, rd_qt_aih, rd_mnem, rd_ano, rd_mes, cnes, ano_cmpt, mes_cmpt, car_int')
        .not('rd_val_tot', 'is', null)
        .not('rd_qt_aih', 'is', null);

      // Aplicar filtros
      if (cnesList.length > 0) {
        query = query.in('cnes', cnesList);
      } else if (hospitalIds.length > 0) {
        // Fallback
        query = query.in('rd_mnem', hospitalIds);
      }
      if (typeof compYear === 'number') {
        query = query.eq('ano_cmpt', compYear).eq('rd_ano', compYear);
      }
      if (typeof compMonth === 'number') {
        query = query.eq('mes_cmpt', compMonth).eq('rd_mes', compMonth);
      }
      // Filtro por Caráter de Atendimento quando aplicável
      if (filterCareCharacter && filterCareCharacter !== 'all') {
        const raw = String(filterCareCharacter).trim();
        const carIntValue = raw === '1' ? '01' : raw === '2' ? '02' : raw;
        query = query.eq('car_int', carIntValue);
      }

      const { data, error } = await query;

      if (error) {
        console.error('❌ Erro ao buscar totais SIH remotos:', error);
        return null;
      }

      if (!data || data.length === 0) {
        console.warn('⚠️ Nenhum dado SIH remoto encontrado');
        return null;
      }

      // Calcular totais agregados
      const totals = data.reduce((acc, row) => {
        acc.totalValue += Number(row.rd_val_tot ?? row.val_tot) || 0;
        acc.totalAIHs += Number(row.rd_qt_aih ?? row.qt_aih) || 0;
        return acc;
      }, { totalValue: 0, totalAIHs: 0 });

      console.log(`✅ Totais SIH remotos: R$ ${totals.totalValue.toFixed(2)} | ${totals.totalAIHs} AIHs`);

      return {
        totalValue: totals.totalValue,
        totalAIHs: totals.totalAIHs,
        source: 'sih_remote'
      };

    } catch (error) {
      console.error('❌ Erro ao buscar totais SIH remotos:', error);
      return null;
    }
  }, [useSihSource, selectedHospitals, selectedCompetencia]);

  // 🧮 NOVOS KPIs: Incremento Eletivo e Incremento Urgência (separados)
  const aggregatedIncrementBreakdown = React.useMemo(() => {
    try {
      let elective = 0;
      let urgency = 0;
      const countedAihs = new Set<string>();
      for (const doctor of filteredDoctors) {
        const doctorName = doctor.doctor_info?.name || '';
        const hospitalId = doctor.hospitals?.[0]?.hospital_id;
        const patients = doctor.patients || [];
        for (const p of patients as any[]) {
          const aihNumRaw = String(p?.aih_info?.aih_number || '').trim();
          const dis = String(p?.aih_info?.discharge_date || '');
          const aihKey = normalizeAih(aihNumRaw) || `${hospitalId || ''}::${p?.aih_id || ''}::${dis}`;
          if (countedAihs.has(aihKey)) continue;
          countedAihs.add(aihKey);
          const care = (p?.aih_info?.care_character ?? '') as string | number | null;
          const inc = computeIncrementForProcedures(p.procedures as any, care, doctorName, hospitalId) || 0;
          if (isElectiveCare(care)) elective += inc;
          else if (isUrgencyCare(care)) urgency += inc;
        }
      }
      return { elective, urgency };
    } catch {
      return { elective: 0, urgency: 0 };
    }
  }, [filteredDoctors]);

  // 🧮 TOTAIS AGREGADOS PARA O CABEÇALHO (SIGTAP, Incrementos, Total)
  const aggregatedOperaParanaTotals = React.useMemo(() => {
    try {
      let totalBaseSigtap = 0;
      let totalIncrement = 0;

      // ✅ PRIORIDADE: Usar dados SIH remotos quando disponíveis
      if (useSihSource && remoteConfigured && sihRemoteTotals) {
        console.log(`📊 [TOTAIS AGREGADOS] Usando dados SIH remotos: R$ ${sihRemoteTotals.totalValue.toFixed(2)} | ${sihRemoteTotals.totalAIHs} AIHs`);
        totalBaseSigtap = sihRemoteTotals.totalValue;

        // Incremento: usar soma deduplicada por AIH (breakdown eletivo/urgência)
        totalIncrement = (aggregatedIncrementBreakdown.elective || 0) + (aggregatedIncrementBreakdown.urgency || 0);
      } else {
        // ✅ CORREÇÃO: Base SIGTAP deve somar AIHs únicas (não por médico)
        // Deduplificar por (hospital_id, aih_number) para evitar dupla contagem
        const uniqueAihKeys = new Set<string>();

        for (const doctor of filteredDoctors) {
          // Usar pacientes carregados para cada médico
          const patients = doctor.patients || [];
          for (const patient of patients as any[]) {
            const hospId = (patient?.aih_info?.hospital_id) || (doctor.hospitals?.[0]?.hospital_id) || '';
            const aihNumRaw = String(patient?.aih_info?.aih_number || '').trim();
            const dis = String(patient?.aih_info?.discharge_date || '');
            const aihKey = `${hospId}::${aihNumRaw || `NOAIH:${patient?.aih_id || patient?.patient_id || ''}:${dis}`}`;
            if (!uniqueAihKeys.has(aihKey)) {
              uniqueAihKeys.add(aihKey);
              totalBaseSigtap += Number(patient?.total_value_reais || 0);
            }
          }

          // Incremento segue usando valor pré-calculado por médico (mantém comportamento atual)
          const stats = doctorStatsCache.get(getDoctorCardKey(doctor));
          if (stats) totalIncrement += stats.operaParanaIncrement || 0;
        }
      }

      console.log(`📊 [TOTAIS AGREGADOS] Base SIGTAP: R$ ${totalBaseSigtap.toFixed(2)} | Incremento: R$ ${totalIncrement.toFixed(2)} | Total: R$ ${(totalBaseSigtap + totalIncrement).toFixed(2)}`);

      return {
        totalBaseSigtap,
        totalIncrement,
        totalWithIncrement: totalBaseSigtap + totalIncrement
      };
    } catch {
      return { totalBaseSigtap: 0, totalIncrement: 0, totalWithIncrement: 0 };
    }
  }, [filteredDoctors, doctorStatsCache, useSihSource, remoteConfigured, sihRemoteTotals, aggregatedIncrementBreakdown]);



  // 🧮 NOVO KPI: Soma dos Pagamentos Médicos (por médico) para comparação
  // ✅ CORREÇÃO: Somar repasses individuais de cada paciente (igual aos cards individuais)
  const aggregatedMedicalPayments = React.useMemo(() => {
    try {
      let totalPayments = 0;
      console.log('🔍 [TOTAL PAGAMENTOS] Calculando agregado para', filteredDoctors.length, 'médicos');

      for (const doctor of filteredDoctors) {
        // ✅ PERFORMANCE: Usar cache de stats (evita recálculo)
        const key = getDoctorCardKey(doctor);
        const stats = doctorStatsCache.get(key);

        if (!stats) continue;

        // ✅ USAR O MESMO CÁLCULO DOS CARDS INDIVIDUAIS
        const doctorPayment = stats.calculatedPaymentValue;

        console.log(`💰 [TOTAL] ${doctor.doctor_info.name}: R$ ${doctorPayment.toFixed(2)}`);

        totalPayments += doctorPayment;
      }

      console.log('💵 [TOTAL PAGAMENTOS] FINAL: R$', totalPayments.toFixed(2));
      return totalPayments;
    } catch (error) {
      console.error('Erro ao calcular pagamentos médicos agregados:', error);
      return 0;
    }
  }, [filteredDoctors, doctorStatsCache]);

  // ✅ ATUALIZAR ESTATÍSTICAS NO COMPONENTE PAI (BASEADO NOS MÉDICOS FILTRADOS)
  useEffect(() => {
    if (onStatsUpdate && !isLoading) {
      onStatsUpdate({
        totalRevenue: filteredStats.totalRevenue,
        totalDoctors: filteredStats.totalDoctors,
        totalPatients: filteredStats.totalPatients,
        totalProcedures: filteredStats.totalProcedures,
        patientsWithMultipleAIHs: multipleAIHsStats.patientsWithMultipleAIHs,
        totalMultipleAIHs: multipleAIHsStats.totalMultipleAIHs,
        totalAIHs: (dbAihCount ?? multipleAIHsStats.totalAIHs),
        uniquePatients: filteredStats.uniquePatients, // 🆕 Pacientes únicos
        multipleAIHsDetails: multipleAIHsStats.multipleAIHsDetails // 🆕 Passar detalhes dos pacientes
      });
    }
  }, [filteredStats, multipleAIHsStats, dbAihCount, onStatsUpdate, isLoading]);

  // 🏥 Nome do hospital selecionado para exibir como badge no título (incluindo CNES)
  const selectedHospitalName = React.useMemo(() => {
    try {
      if (selectedHospitals && selectedHospitals.length > 0 && !selectedHospitals.includes('all')) {
        const id = selectedHospitals[0];
        const match = availableHospitals.find(h => h.id === id);
        if (match) {
          // ✅ Incluir CNES (identificador SUS) se disponível
          const cnesInfo = match.cnes ? ` - CNES: ${match.cnes}` : '';
          return `${match.name}${cnesInfo}`;
        }
        return 'Hospital selecionado';
      }
      return 'Todos os hospitais';
    } catch {
      return 'Hospital';
    }
  }, [selectedHospitals, availableHospitals]);

  useEffect(() => {
    const run = async () => {
      try {
        setDiscrepancyLoading(true)
        const hospitalId = (selectedHospitals && !selectedHospitals.includes('all')) ? selectedHospitals[0] : ''
        const hospital = availableHospitals.find(h => h.id === hospitalId)
        const hospitalNameOnly = hospital ? hospital.name : ''
        let month: number | undefined
        let year: number | undefined
        if (selectedCompetencia && selectedCompetencia !== 'all') {
          const raw = selectedCompetencia.trim()
          if (/^\d{6}$/.test(raw)) {
            year = parseInt(raw.slice(0, 4), 10)
            month = parseInt(raw.slice(4, 6), 10)
          } else {
            const mDash = raw.match(/^(\d{4})-(\d{2})/)
            const mSlash = raw.match(/^(\d{2})\/(\d{4})$/)
            if (mDash) { year = parseInt(mDash[1], 10); month = parseInt(mDash[2], 10) }
            else if (mSlash) { month = parseInt(mSlash[1], 10); year = parseInt(mSlash[2], 10) }
          }
        }
        const cardsPatients = filteredDoctors.flatMap(d => d.patients || [])
        const normalizeAih = (s: string) => s.replace(/\D/g, '').replace(/^0+/, '')
        const cardsSum = cardsPatients.reduce((sum, p: any) => sum + Number(p.total_value_reais || 0), 0)
        const distinctMap = new Map<string, number>()
        let withoutNumber = 0
        for (const p of cardsPatients) {
          const k = normalizeAih(String((p as any)?.aih_info?.aih_number || ''))
          const v = Number((p as any).total_value_reais || 0)
          if (k) {
            if (!distinctMap.has(k)) distinctMap.set(k, v)
          } else {
            withoutNumber++
          }
        }
        const cardsDistinct = Array.from(distinctMap.values()).reduce((a, b) => a + b, 0)
        const cardsAssigned = filteredDoctors.reduce((sum, d) => {
          const key = getDoctorCardKey(d)
          const stats = doctorStatsCache.get(key)
          return sum + (stats ? Number(stats.totalValue || 0) : 0)
        }, 0)
        let remoteDistinct = 0
        const remoteMap = new Map<string, number>()
        if (useSihSource && remoteConfigured && hospital?.cnes && month) {
          const { data: rdRows } = await supabaseSih
            .from('sih_rd')
            .select('n_aih,val_tot')
            .eq('cnes', hospital.cnes)
            .eq('mes_cmpt', month)
            .eq('ano_cmpt', year || new Date().getFullYear())
          const seen = new Set<string>()
          for (const r of rdRows || []) {
            const key = normalizeAih(String((r as any).n_aih || ''))
            if (!seen.has(key)) { seen.add(key); const val = Number((r as any).val_tot || 0); remoteDistinct += val; if (key) remoteMap.set(key, val) }
          }
        }
        let localSigtap = 0
        const localMap = new Map<string, number>()
        if (hospitalId) {
          let q = supabase
            .from('aihs')
            .select('aih_number,calculated_total_value,competencia')
            .eq('hospital_id', hospitalId)
          if (selectedCompetencia && selectedCompetencia !== 'all') q = q.eq('competencia', selectedCompetencia)
          const { data: localRows } = await q
          for (const a of localRows || []) {
            const k = normalizeAih(String((a as any).aih_number || ''))
            const v = Number((a as any).calculated_total_value || 0) / 100
            if (k) localMap.set(k, v)
            localSigtap += v
          }
        }
        const difference = cardsDistinct - (useSihSource && remoteConfigured ? remoteDistinct : localSigtap)
        const unionKeys = new Set<string>([...distinctMap.keys(), ...localMap.keys(), ...remoteMap.keys()])
        const details: Array<{ aih: string; cards: number; sigtap: number; sih?: number; diff: number }> = []
        let missingInLocal = 0
        let missingInCards = 0
        let missingInRemote = 0
        for (const k of unionKeys) {
          const cardsVal = distinctMap.get(k) || 0
          const sigtapVal = localMap.get(k) || 0
          const sihVal = remoteMap.get(k)
          if (!localMap.has(k)) missingInLocal++
          if (!distinctMap.has(k)) missingInCards++
          if (useSihSource && remoteConfigured && !remoteMap.has(k)) missingInRemote++
          details.push({ aih: k, cards: cardsVal, sigtap: sigtapVal, sih: sihVal, diff: cardsVal - sigtapVal })
        }
        details.sort((a, b) => Math.abs(b.diff) - Math.abs(a.diff))
        setDiscrepancyTotals({
          cards_sum_reais: cardsAssigned,
          cards_distinct_sum_reais: cardsDistinct,
          remote_val_tot_distinct_reais: remoteDistinct,
          local_sigtap_total_reais: localSigtap,
          difference_cards_vs_sigtap: difference
        })
        setDiscrepancyDetails(details)
        setDiscrepancyCounts({ missingInLocal, missingInCards, missingInRemote, withoutNumber })
      } catch {
        setDiscrepancyTotals(null)
        setDiscrepancyDetails([])
      } finally {
        setDiscrepancyLoading(false)
      }
    }
    run()
  }, [filteredDoctors, selectedHospitals, availableHospitals, selectedCompetencia, useSihSource])

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <Loader2 className="h-12 w-12 animate-spin text-blue-600 mx-auto mb-4" />
          <div className="text-lg font-semibold">Carregando dados dos médicos...</div>
          <div className="text-sm text-gray-600">Aguarde um momento</div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* 🆕 COMPONENTE DE DIAGNÓSTICO */}
      {showDiagnostic && (
        <DataDiagnostics onClose={() => setShowDiagnostic(false)} />
      )}

      {/* 🆕 DIAGNÓSTICO DE PROCEDIMENTOS */}
      {showProcedureDiagnostic && (
        <ProcedurePatientDiagnostic />
      )}

      {/* 🆕 DEBUG ESPECÍFICO CLEUZA */}
      {showCleuezaDebug && (
        <CleuezaDebugComponent />
      )}

      {/* 🚀 SOLUÇÃO IMEDIATA IMPLEMENTADA - SEÇÃO OCULTADA */}
      {/* 
      <Card className="border-2 border-green-200 bg-green-50/30 mb-4">
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-semibold text-green-900">🚀 Solução Imediata: Procedimentos Simplificados</h3>
              <p className="text-sm text-green-700">Sistema de carregamento direto da tabela procedure_records implementado</p>
              <div className="flex gap-2 mt-2">
                <Badge variant="outline" className="bg-green-100 text-green-800 border-green-300">
                  ✅ SimplifiedProcedureService ativo
                </Badge>
                <Badge variant="outline" className="bg-blue-100 text-blue-800 border-blue-300">
                  🔄 Carregamento automático
                </Badge>
                <Badge variant="outline" className="bg-purple-100 text-purple-800 border-purple-300">
                  🧪 Modo debug disponível
                </Badge>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
      */}

      {/* 🔧 PAINEL DE DIAGNÓSTICOS - SEÇÃO OCULTADA */}
      {/* 
      <Card className="border-2 border-dashed border-blue-200 bg-blue-50/30">
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-semibold text-blue-900">🔍 Ferramentas de Diagnóstico</h3>
              <p className="text-sm text-blue-700">Identifique problemas na associação de dados</p>
            </div>
            <div className="flex gap-2">
              <Button
                onClick={() => setShowDiagnostic(!showDiagnostic)}
                variant="outline"
                size="sm"
                className="bg-yellow-50 border-yellow-300 text-yellow-700 hover:bg-yellow-100"
              >
                <Database className="h-4 w-4 mr-1" />
                {showDiagnostic ? 'Ocultar' : 'Diagnóstico Estrutural'}
              </Button>
              <Button
                onClick={() => setShowProcedureDiagnostic(!showProcedureDiagnostic)}
                variant="outline"
                size="sm"
                className="bg-blue-50 border-blue-300 text-blue-700 hover:bg-blue-100"
              >
                <Activity className="h-4 w-4 mr-1" />
                {showProcedureDiagnostic ? 'Ocultar' : 'Diagnóstico Procedimentos'}
              </Button>
              <Button
                onClick={() => setShowCleuezaDebug(!showCleuezaDebug)}
                variant="outline"
                size="sm"
                className="bg-red-50 border-red-300 text-red-700 hover:bg-red-100"
              >
                <Search className="h-4 w-4 mr-1" />
                {showCleuezaDebug ? 'Ocultar' : 'Debug Cleuza'}
              </Button>
              
              <Button
                onClick={async () => {
                  console.log('🔄 [MANUAL DEBUG] Recarregando procedimentos...');
                  const currentDoctors = doctors;
                  if (currentDoctors.length > 0) {
                    await loadProceduresForPatients(currentDoctors);
                  } else {
                    console.log('❌ Nenhum médico disponível para debug');
                  }
                }}
                variant="outline"
                size="sm"
                className="bg-purple-50 border-purple-300 text-purple-700 hover:bg-purple-100"
              >
                <RefreshCw className="h-4 w-4 mr-1" />
                Debug Procedimentos
              </Button>
              <Button
                onClick={async () => {
                  console.log('🚀 TESTE MANUAL: Recarregando procedimentos...');
                  await loadProceduresForPatients(doctors);
                }}
                variant="outline"
                size="sm"
                className="bg-green-50 border-green-300 text-green-700 hover:bg-green-100"
              >
                <RefreshCw className="h-4 w-4 mr-1" />
                🚀 Teste Procedimentos
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
      */}

      {/* ⚠️ AVISO DE DADOS DE DEMONSTRAÇÃO */}
      {globalStats.isDemoData && (
        <div className="bg-gradient-to-r from-yellow-50 to-orange-50 border-l-4 border-l-yellow-400 p-4 rounded-lg">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-yellow-100 rounded-full flex items-center justify-center">
              <AlertCircle className="h-5 w-5 text-yellow-600" />
            </div>
            <div>
              <div className="font-semibold text-yellow-800">Dados de Demonstração</div>
              <div className="text-sm text-yellow-700">
                Os dados exibidos são fictícios para demonstração. Para ver dados reais, processe algumas AIHs através do sistema de upload.
              </div>
            </div>
          </div>
        </div>
      )}









      {/* Cabeçalho branco e preto */}
      <Card className="shadow-sm border border-gray-200 bg-white">
        <CardHeader className="pb-4">
          <CardTitle>
            {/* HEADER COM DESIGN MINIMALISTA */}
            <div className="mb-4 pb-4 border-b border-gray-200">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="flex items-center justify-center w-12 h-12 bg-gray-100 rounded-xl">
                    <Stethoscope className="h-6 w-6 text-black" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="text-2xl font-bold text-black">Produção Médica - Pagamentos Médicos</h3>
                      <Badge
                        variant="outline"
                        className="bg-white text-black border-gray-300 px-2.5 py-0.5 text-xs font-semibold"
                      >
                        {selectedHospitalName}
                      </Badge>
                    </div>
                    <p className="text-sm text-neutral-700 mt-1">Visualização hierárquica completa: Médicos → Pacientes → Procedimentos</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      try {
                        const { invalidateOtoSaoJoseHonMap } = require('../config/doctorPaymentRules/importers/otoSaoJoseXlsx');
                        if (invalidateOtoSaoJoseHonMap) invalidateOtoSaoJoseHonMap();
                      } catch { }
                      setRefreshTick(t => t + 1)
                    }}
                    className="h-9 px-3 border-black text-black hover:bg-neutral-100"
                  >
                    <RefreshCw className="h-4 w-4 mr-2" /> Atualizar
                  </Button>
                </div>
              </div>
            </div>

            {/* Indicadores — branco/preto com contorno colorido */}
            <div className="grid grid-cols-1 md:grid-cols-4 lg:grid-cols-6 gap-3 mb-4">
              {/* Valor Total (Remote/Local) */}
              <div className="bg-white rounded-lg p-3 border-2 border-gray-300">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-[11px] font-bold text-black uppercase tracking-wide mb-1">
                      {useSihSource && remoteConfigured ? 'Valor Total (Remoto)' : 'Valor Total SIGTAP'}
                    </div>
                    <div className="text-xl font-black text-black">
                      {formatCurrency(aggregatedOperaParanaTotals.totalBaseSigtap)}
                    </div>
                    {useSihSource && remoteConfigured && sihRemoteTotals && (
                      <div className="text-[11px] text-black mt-1 flex items-center gap-1">
                        <span className="inline-block w-2 h-2 bg-black rounded-full"></span>
                        Fonte: SIH Remoto
                      </div>
                    )}
                  </div>

                </div>
              </div>

              {/* Total AIHs (SIH Remoto quando disponível) */}
              {useSihSource && remoteConfigured && sihRemoteTotals && (
                <div className="bg-white rounded-lg p-3 border-2 border-blue-400">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-[11px] font-bold text-black uppercase tracking-wide mb-1">
                        Total AIHs (SIH Remoto)
                      </div>
                      <div className="text-xl font-black text-black">
                        {formatNumber(sihRemoteTotals.totalAIHs)}
                      </div>
                      <div className="text-[11px] text-black mt-1 flex items-center gap-1">
                        <span className="inline-block w-2 h-2 bg-black rounded-full"></span>
                        Fonte: Banco SIH
                      </div>
                    </div>

                  </div>
                </div>
              )}

              {/* Valor Total Incrementos */}
              <div className="bg-white rounded-lg p-3 border-2 border-emerald-400">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-[11px] font-bold text-black uppercase tracking-wide mb-1">
                      Incrementos
                    </div>
                    <div className="text-xl font-black text-black">
                      {formatCurrency(aggregatedOperaParanaTotals.totalIncrement)}
                    </div>
                  </div>

                </div>
              </div>

              {/* Incremento Eletivo */}
              <div className="bg-white rounded-lg p-3 border-2 border-teal-400">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-[11px] font-bold text-black uppercase tracking-wide mb-1">
                      Incremento Eletivo
                    </div>
                    <div className="text-xl font-black text-black">
                      {formatCurrency(aggregatedIncrementBreakdown.elective)}
                    </div>
                  </div>

                </div>
              </div>

              {/* Incremento Urgência */}
              <div className="bg-white rounded-lg p-3 border-2 border-amber-400">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-[11px] font-bold text-black uppercase tracking-wide mb-1">
                      Incremento Urgência
                    </div>
                    <div className="text-xl font-black text-black">
                      {formatCurrency(aggregatedIncrementBreakdown.urgency)}
                    </div>
                  </div>

                </div>
              </div>

              {/* Valor Total (com Opera Paraná) */}
              <div className="bg-white rounded-lg p-3 border-2 border-blue-400">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-[11px] font-bold text-black uppercase tracking-wide mb-1">
                      Valor Total
                    </div>
                    <div className="text-xl font-black text-black">
                      {formatCurrency(aggregatedOperaParanaTotals.totalWithIncrement)}
                    </div>
                  </div>

                </div>
              </div>

              {/* Pagamento Médico Total - DESTAQUE */}
              <div className="bg-white rounded-lg p-3 border-2 border-green-500 shadow-sm">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-[11px] font-bold text-black uppercase tracking-wide mb-1">
                      Pagamento Médico Total
                    </div>
                    <div className="text-xl font-black text-black">
                      {formatCurrency(aggregatedMedicalPayments)}
                    </div>
                  </div>

                </div>
              </div>
            </div>



            {/* BOTÕES DE RELATÓRIO - LINHA COMPACTA À ESQUERDA */}
            <div className="mb-4 hidden">
              <div className="flex flex-wrap gap-2 justify-start items-center">
                <Button
                  variant="default"
                  size="sm"
                  onClick={async () => {
                    try {
                      const rows: Array<Array<string | number>> = [];
                      const header = [
                        '#',
                        'Prontuário',
                        'Nome do Paciente',
                        'Nº AIH',
                        'Código Procedimento',
                        'Descrição Procedimento',
                        'Data Procedimento',
                        'Data Alta (SUS)',
                        'Especialidade de Atendimento',
                        'Caráter de Atendimento',
                        'Médico',
                        'Hospital',
                        'Pgt. Administrativo',
                        'Valor Procedimento',
                        'AIH Seca',
                        'Incremento',
                        'AIH c/ Incremento'
                      ];
                      let idx = 1;
                      let totalAIHsFound = 0;
                      let excludedByDateFilter = 0;
                      let aihsWithoutNumber = 0;

                      // ✅ CORREÇÃO: NÃO deduplicate por paciente - cada AIH é um registro único
                      // Um paciente com múltiplas AIHs deve gerar múltiplas linhas no relatório

                      console.log('🔍 [RELATÓRIO GERAL] Iniciando coleta de dados...');
                      console.log('🔍 [RELATÓRIO GERAL] Médicos filtrados:', filteredDoctors.length);
                      console.log('🔍 [RELATÓRIO GERAL] Sem filtro de data');

                      filteredDoctors.forEach((card: any) => {
                        const doctorName = card.doctor_info?.name || '';
                        const hospitalName = card.hospitals?.[0]?.hospital_name || '';
                        console.log(`👨‍⚕️ [RELATÓRIO GERAL] Médico: ${doctorName} - Pacientes: ${(card.patients || []).length}`);

                        (card.patients || []).forEach((p: any) => {
                          totalAIHsFound++; // ✅ Contar AIHs, não pacientes únicos

                          // ✅ FILTRO UNIFICADO: Intervalo de datas (mesmo filtro do relatório simplificado)
                          if (false) {
                            const discharge = p?.aih_info?.discharge_date ? new Date(p.aih_info.discharge_date) : undefined;

                            if (!discharge) {
                              excludedByDateFilter++;
                              return;
                            }

                            // Normalizar datas para comparação (início do dia para startDate, fim do dia para endDate)
                            const startOfPeriod = new Date();
                            const endOfPeriod = new Date();
                            endOfPeriod.setHours(23, 59, 59, 999);

                            const dischargeDate = new Date(discharge);

                            if (dischargeDate < startOfPeriod || dischargeDate > endOfPeriod) {
                              excludedByDateFilter++;
                              return;
                            }
                          }

                          const patientId = p.patient_id;
                          const name = p.patient_info?.name || 'Paciente';
                          const medicalRecord = p.patient_info?.medical_record || '-';
                          // 🔧 CORREÇÃO: Incluir AIHs sem número com aviso
                          const aihRaw = (p?.aih_info?.aih_number || '').toString().replace(/\D/g, '');
                          const aih = aihRaw || 'Aguardando geração';

                          // ✅ CORREÇÃO: NÃO pular duplicatas de paciente - cada AIH é única
                          // Mesmo paciente com múltiplas AIHs deve gerar múltiplas linhas

                          if (!aihRaw) {
                            aihsWithoutNumber++;
                            console.log(`⚠️ [RELATÓRIO GERAL] AIH sem número incluída: ${name}`);
                          }

                          const careSpec = (p?.aih_info?.specialty || '').toString();
                          const careCharacter = (() => {
                            const raw = (p?.aih_info?.care_character ?? '').toString();
                            try {
                              return CareCharacterUtils.formatForDisplay(raw, false);
                            } catch {
                              return raw;
                            }
                          })();
                          const disISO = p?.aih_info?.discharge_date || '';
                          const disLabel = parseISODateToLocal(disISO);

                          // Calcular valor da AIH com incrementos Opera Paraná
                          const baseAih = Number(p.total_value_reais || 0);
                          const doctorCovered = isDoctorCoveredForOperaParana(doctorName, card.hospitals?.[0]?.hospital_id);
                          const increment = doctorCovered ? computeIncrementForProcedures(p.procedures as any, p?.aih_info?.care_character, doctorName, card.hospitals?.[0]?.hospital_id) : 0;
                          const aihWithIncrements = baseAih + increment;

                          // ✅ FIX: Mostrar todos os procedimentos, mas garantir que a AIH pertence à competência correta
                          // A competência já foi filtrada no backend, então esta AIH pertence à competência selecionada
                          const procedures = p.procedures || [];
                          if (procedures.length > 0) {
                            procedures.forEach((proc: any) => {
                              // 🔧 PADRONIZAÇÃO: Remover "." e "-" do código de procedimento
                              const procCodeRaw = proc.procedure_code || '';
                              const procCode = procCodeRaw.replace(/[.\-]/g, '');

                              const procDesc = proc.procedure_description || proc.sigtap_description || '';
                              const procDate = proc.procedure_date || '';
                              const procDateLabel = parseISODateToLocal(procDate);
                              const procValue = Number(proc.value_reais || 0);

                              const pgtAdm = p?.aih_info?.pgt_adm || 'não';

                              rows.push([
                                idx++,
                                medicalRecord,
                                name,
                                aih, // Usar aih que pode ser "Aguardando geração"
                                procCode, // ✅ Código padronizado sem "." e "-"
                                procDesc,
                                procDateLabel,
                                disLabel,
                                careSpec,
                                careCharacter,
                                doctorName,
                                hospitalName,
                                pgtAdm,
                                procValue,
                                baseAih,
                                increment,
                                aihWithIncrements
                              ]);
                            });
                          } else {
                            // Se não tem procedimentos, criar uma linha sem dados de procedimento
                            const pgtAdm = p?.aih_info?.pgt_adm || 'não';

                            rows.push([
                              idx++,
                              medicalRecord,
                              name,
                              aih, // Usar aih que pode ser "Aguardando geração"
                              '',
                              'Nenhum procedimento encontrado',
                              '',
                              disLabel,
                              careSpec,
                              careCharacter,
                              doctorName,
                              hospitalName,
                              pgtAdm,
                              0,
                              baseAih,
                              increment,
                              aihWithIncrements
                            ]);
                          }
                        });
                      });

                      // Ordenar por Data Alta (SUS) - mais recente primeiro
                      rows.sort((a, b) => {
                        const dateA = a[7] as string; // Data Alta (SUS) está na posição 7 (0-indexed)
                        const dateB = b[7] as string;

                        // Se não há data, colocar no final
                        if (!dateA && !dateB) return 0;
                        if (!dateA) return 1;
                        if (!dateB) return -1;

                        // Converter DD/MM/YYYY para Date para comparação
                        const parseDate = (dateStr: string) => {
                          const parts = dateStr.split('/');
                          if (parts.length === 3) {
                            return new Date(parseInt(parts[2]), parseInt(parts[1]) - 1, parseInt(parts[0]));
                          }
                          return new Date(0);
                        };

                        const parsedDateA = parseDate(dateA);
                        const parsedDateB = parseDate(dateB);

                        // Ordenar do mais recente para o mais antigo
                        return parsedDateB.getTime() - parsedDateA.getTime();
                      });

                      // 📊 Estatísticas finais do relatório
                      console.log('📊 [RELATÓRIO GERAL] Estatísticas finais:');
                      console.log(`📊 [RELATÓRIO GERAL] Total de AIHs encontradas: ${totalAIHsFound}`);
                      console.log(`📊 [RELATÓRIO GERAL] Excluídas por filtro de data: ${excludedByDateFilter}`);
                      console.log(`📊 [RELATÓRIO GERAL] AIHs sem número incluídas: ${aihsWithoutNumber}`);
                      console.log(`📊 [RELATÓRIO GERAL] Total de linhas no relatório: ${rows.length}`);

                      // Renumerar após ordenação
                      rows.forEach((row, index) => {
                        row[0] = index + 1; // Atualizar numeração sequencial
                      });

                      const wb = XLSX.utils.book_new();
                      const ws = XLSX.utils.aoa_to_sheet([header, ...rows]);
                      (ws as any)['!cols'] = [
                        { wch: 5 },   // #
                        { wch: 15 },  // Prontuário
                        { wch: 35 },  // Nome do Paciente
                        { wch: 18 },  // Nº AIH
                        { wch: 20 },  // Código Procedimento
                        { wch: 45 },  // Descrição Procedimento
                        { wch: 16 },  // Data Procedimento
                        { wch: 16 },  // Data Alta (SUS)
                        { wch: 25 },  // Especialidade de Atendimento
                        { wch: 22 },  // Caráter de Atendimento
                        { wch: 30 },  // Médico
                        { wch: 35 },  // Hospital
                        { wch: 20 },  // Pgt. Administrativo
                        { wch: 18 },  // Valor Procedimento
                        { wch: 18 },  // AIH Seca
                        { wch: 18 },  // Incremento
                        { wch: 20 },  // AIH c/ Incremento
                      ];
                      XLSX.utils.book_append_sheet(wb, ws, 'Pacientes');
                      const fileName = `Relatorio_Pacientes_Procedimentos_${formatDateFns(new Date(), 'yyyyMMdd_HHmm')}.xlsx`;
                      XLSX.writeFile(wb, fileName);

                      // ✅ Notificação única e clara
                      if (aihsWithoutNumber > 0) {
                        toast.success(`Relatório geral gerado! ${aihsWithoutNumber} registro(s) sem AIH incluído(s).`);
                      } else {
                        toast.success('Relatório geral gerado com sucesso!');
                      }
                    } catch (e) {
                      console.error('Erro ao exportar Relatório Pacientes:', e);
                      toast.error('Erro ao gerar relatório geral');
                    }
                  }}
                  className="inline-flex items-center gap-2 bg-black hover:bg-neutral-800 text-white justify-self-start w-auto min-w-[220px]"
                  title="Gerar relatório geral de pacientes"
                >
                  <FileSpreadsheet className="h-4 w-4" />
                  Relatório Pacientes Geral
                </Button>

                {/* 🆕 NOVO: Relatório Pacientes Conferência */}
                <Button
                  variant="default"
                  size="sm"
                  onClick={async () => {
                    try {
                      const rows: Array<Array<string | number>> = [];
                      const header = [
                        '#',
                        'Prontuário',
                        'Nome do Paciente',
                        'Nº AIH',
                        'Data Alta (SUS)',
                        'Médico',
                        'Hospital',
                        'Pgt. Administrativo',
                        'AIH Seca',
                        'Incremento',
                        'AIH c/ Incremento'
                      ];
                      let idx = 1;
                      let totalAIHsFound = 0;
                      let excludedByDateFilter = 0;
                      let aihsWithoutNumber = 0;

                      // ✅ CORREÇÃO: NÃO deduplicate por paciente - cada AIH é um registro único
                      // Um paciente com múltiplas AIHs deve gerar múltiplas linhas no relatório

                      console.log('🔍 [RELATÓRIO CONFERÊNCIA] Iniciando coleta de dados...');
                      console.log('🔍 [RELATÓRIO CONFERÊNCIA] Médicos filtrados:', filteredDoctors.length);
                      console.log('🔍 [RELATÓRIO CONFERÊNCIA] Uma linha por AIH (internação)');

                      filteredDoctors.forEach((card: any) => {
                        const doctorName = card.doctor_info?.name || '';
                        const hospitalName = card.hospitals?.[0]?.hospital_name || '';
                        console.log(`👨‍⚕️ [RELATÓRIO CONFERÊNCIA] Médico: ${doctorName} - Pacientes: ${(card.patients || []).length}`);

                        (card.patients || []).forEach((p: any) => {
                          totalAIHsFound++; // ✅ Contar AIHs, não pacientes únicos

                          const patientId = p.patient_id;
                          const name = p.patient_info?.name || 'Paciente';
                          const medicalRecord = p.patient_info?.medical_record || '-';
                          // 🔧 CORREÇÃO: Incluir AIHs sem número com aviso
                          const aihRaw = (p?.aih_info?.aih_number || '').toString().replace(/\D/g, '');
                          const aih = aihRaw || 'Aguardando geração';

                          // ✅ CORREÇÃO: NÃO pular duplicatas de paciente - cada AIH é única
                          // Mesmo paciente com múltiplas AIHs deve gerar múltiplas linhas

                          if (!aihRaw) {
                            aihsWithoutNumber++;
                            console.log(`⚠️ [RELATÓRIO CONFERÊNCIA] AIH sem número incluída: ${name}`);
                          }

                          const disISO = p?.aih_info?.discharge_date || '';
                          const disLabel = parseISODateToLocal(disISO);

                          // Calcular valor da AIH com incrementos Opera Paraná
                          const baseAih = Number(p.total_value_reais || 0);
                          const doctorCovered = isDoctorCoveredForOperaParana(doctorName, card.hospitals?.[0]?.hospital_id);
                          const increment = doctorCovered ? computeIncrementForProcedures(p.procedures as any, p?.aih_info?.care_character, doctorName, card.hospitals?.[0]?.hospital_id) : 0;
                          const aihWithIncrements = baseAih + increment;

                          const pgtAdm = p?.aih_info?.pgt_adm || 'não';

                          // ✅ UMA LINHA POR AIH: Cada internação/atendimento é uma linha
                          rows.push([
                            idx++,
                            medicalRecord,
                            name,
                            aih, // Usar aih que pode ser "Aguardando geração"
                            disLabel,
                            doctorName,
                            hospitalName,
                            pgtAdm,
                            formatCurrency(baseAih),
                            formatCurrency(increment),
                            formatCurrency(aihWithIncrements)
                          ]);
                        });
                      });

                      // Ordenar por Data Alta (SUS) - mais recente primeiro
                      rows.sort((a, b) => {
                        const dateA = a[4] as string; // Data Alta (SUS) está na posição 4 (0-indexed)
                        const dateB = b[4] as string;

                        // Se não há data, colocar no final
                        if (!dateA && !dateB) return 0;
                        if (!dateA) return 1;
                        if (!dateB) return -1;

                        // Converter DD/MM/YYYY para Date para comparação
                        const parseDate = (dateStr: string) => {
                          const parts = dateStr.split('/');
                          if (parts.length === 3) {
                            return new Date(parseInt(parts[2]), parseInt(parts[1]) - 1, parseInt(parts[0]));
                          }
                          return new Date(0);
                        };

                        const parsedDateA = parseDate(dateA);
                        const parsedDateB = parseDate(dateB);

                        // Ordenar do mais recente para o mais antigo
                        return parsedDateB.getTime() - parsedDateA.getTime();
                      });

                      // 📊 Estatísticas finais do relatório
                      console.log('📊 [RELATÓRIO CONFERÊNCIA] Estatísticas finais:');
                      console.log(`📊 [RELATÓRIO CONFERÊNCIA] Total de AIHs encontradas: ${totalAIHsFound}`);
                      console.log(`📊 [RELATÓRIO CONFERÊNCIA] Excluídas por filtro de data: ${excludedByDateFilter}`);
                      console.log(`📊 [RELATÓRIO CONFERÊNCIA] AIHs sem número incluídas: ${aihsWithoutNumber}`);
                      console.log(`📊 [RELATÓRIO CONFERÊNCIA] Total de linhas no relatório: ${rows.length}`);

                      // Renumerar após ordenação
                      rows.forEach((row, index) => {
                        row[0] = index + 1; // Atualizar numeração sequencial
                      });

                      const wb = XLSX.utils.book_new();
                      const ws = XLSX.utils.aoa_to_sheet([header, ...rows]);
                      (ws as any)['!cols'] = [
                        { wch: 5 },   // #
                        { wch: 15 },  // Prontuário
                        { wch: 35 },  // Nome do Paciente
                        { wch: 18 },  // Nº AIH
                        { wch: 16 },  // Data Alta (SUS)
                        { wch: 30 },  // Médico
                        { wch: 35 },  // Hospital
                        { wch: 20 },  // Pgt. Administrativo
                        { wch: 18 },  // AIH Seca
                        { wch: 18 },  // Incremento
                        { wch: 20 },  // AIH c/ Incremento
                      ];
                      XLSX.utils.book_append_sheet(wb, ws, 'AIHs');
                      const fileName = `Relatorio_AIHs_Conferencia_${formatDateFns(new Date(), 'yyyyMMdd_HHmm')}.xlsx`;
                      XLSX.writeFile(wb, fileName);

                      // ✅ Notificação única e clara
                      if (aihsWithoutNumber > 0) {
                        toast.success(`Relatório de conferência gerado! ${aihsWithoutNumber} AIH(s) sem número incluída(s).`);
                      } else {
                        toast.success('Relatório de conferência gerado com sucesso!');
                      }
                    } catch (e) {
                      console.error('Erro ao exportar Relatório Conferência:', e);
                      toast.error('Erro ao gerar relatório de conferência');
                    }
                  }}
                  className="inline-flex items-center gap-2 bg-black hover:bg-neutral-800 text-white justify-self-start w-auto min-w-[220px]"
                  title="Gerar relatório de conferência de pacientes (uma linha por paciente com valores consolidados)"
                >
                  <FileSpreadsheet className="h-4 w-4" />
                  Relatório Pacientes Conferência
                </Button>

                {/* 🆕 NOVO: Relatório Pacientes Geral Simplificado */}
                <Button
                  variant="default"
                  size="sm"
                  onClick={async () => {
                    try {
                      // ✅ SIMPLIFICADO: Sem filtros de data (apenas competência)
                      const rows: Array<Array<string | number>> = [];
                      const header = [
                        '#',
                        'Nome do Paciente',
                        'Prontuário',
                        'Nº AIH',
                        'Data de Admissão',
                        'Data de Alta',
                        'Médico',
                        'Pgt. Administrativo',
                        'AIH Seca',
                        'Incremento',
                        'AIH c/ Incremento'
                      ];
                      let idx = 1;

                      // 🔧 CORREÇÃO: Coletar TODAS as AIHs (sem eliminar duplicatas)
                      // Cada AIH é única, mesmo paciente pode ter múltiplas AIHs (reabordagem, retorno)
                      const allPatients: any[] = [];
                      let totalPatientsFound = 0;
                      let excludedByDateFilter = 0;
                      let excludedByEmptyAIH = 0;

                      console.log('🔍 [RELATÓRIO SIMPLIFICADO] Iniciando coleta de dados...');
                      console.log('🔍 [RELATÓRIO SIMPLIFICADO] Médicos filtrados:', filteredDoctors.length);
                      console.log('🔍 [RELATÓRIO SIMPLIFICADO] Sem filtro de data');

                      // ✅ CORREÇÃO: NÃO deduplicate por paciente - cada AIH é um registro único
                      // Um paciente com múltiplas AIHs deve gerar múltiplas linhas no relatório

                      filteredDoctors.forEach((card: any) => {
                        const doctorName = card.doctor_info?.name || 'Médico não identificado';
                        const hospitalName = card.hospitals?.[0]?.hospital_name || 'Hospital não identificado';
                        const doctorPatients = card.patients || [];
                        console.log(`👨‍⚕️ [RELATÓRIO SIMPLIFICADO] Médico: ${doctorName} - Pacientes: ${doctorPatients.length}`);

                        doctorPatients.forEach((p: any) => {
                          totalPatientsFound++;

                          // ✅ FILTRO UNIFICADO: Intervalo de datas (mesmo do relatório geral)
                          if (false) {
                            const discharge = p?.aih_info?.discharge_date ? new Date(p.aih_info.discharge_date) : undefined;

                            if (!discharge) {
                              excludedByDateFilter++;
                              return;
                            }

                            // Normalizar datas para comparação (início do dia para startDate, fim do dia para endDate)
                            const startOfPeriod = new Date();
                            const endOfPeriod = new Date();
                            endOfPeriod.setHours(23, 59, 59, 999);

                            const dischargeDate = new Date(discharge);

                            if (dischargeDate < startOfPeriod || dischargeDate > endOfPeriod) {
                              excludedByDateFilter++;
                              return;
                            }
                          }

                          const patientId = p.patient_id;

                          // ✅ CORREÇÃO: NÃO pular duplicatas de paciente - cada AIH é única
                          // Mesmo paciente com múltiplas AIHs deve gerar múltiplas linhas

                          // 🔧 CORREÇÃO: AIHs podem não ter número gerado ainda - INCLUIR TODAS
                          const aih = (p?.aih_info?.aih_number || '').toString().replace(/\D/g, '');
                          const aihDisplay = aih || 'Aguardando geração';

                          // 🤱 LOG ESPECÍFICO PARA PARTOS CESAREANOS
                          const procedures = p.procedures || [];
                          const hasCesarean = procedures.some((proc: any) => {
                            const code = proc.procedure_code || '';
                            return code === '04.11.01.003-4' || code === '04.11.01.004-2';
                          });

                          if (hasCesarean) {
                            console.log(`🤱 [RELATÓRIO SIMPLIFICADO] PARTO CESARIANO INCLUÍDO: ${p.patient_info?.name || 'Sem nome'} - AIH: ${aihDisplay} - Médico: ${doctorName}`);
                          }

                          if (!aih) {
                            console.log(`⚠️ [RELATÓRIO SIMPLIFICADO] AIH sem número incluída: ${p.patient_info?.name || 'Sem nome'}`);
                          }

                          const name = p.patient_info?.name || 'Paciente';
                          const medicalRecord = p.patient_info?.medical_record || '-';
                          const admissionISO = p?.aih_info?.admission_date || '';
                          const admissionLabel = parseISODateToLocal(admissionISO);
                          const dischargeISO = p?.aih_info?.discharge_date || '';
                          const dischargeLabel = parseISODateToLocal(dischargeISO);

                          // Calcular valores da AIH com incrementos Opera Paraná
                          const baseAih = Math.round((Number(p.total_value_reais || 0)) * 100) / 100;
                          const doctorCovered = isDoctorCoveredForOperaParana(doctorName, card.hospitals?.[0]?.hospital_id);
                          const incrementRaw = doctorCovered ? computeIncrementForProcedures(p.procedures as any, p?.aih_info?.care_character, doctorName, card.hospitals?.[0]?.hospital_id) : 0;
                          const increment = Math.round(incrementRaw * 100) / 100;
                          const aihWithIncrements = Math.round((baseAih + increment) * 100) / 100;

                          const pgtAdm = p?.aih_info?.pgt_adm || 'não';

                          allPatients.push({
                            name,
                            medicalRecord,
                            aih: aihDisplay, // Usar aihDisplay que inclui "Aguardando geração" se vazio
                            admissionLabel,
                            dischargeLabel,
                            doctorName,
                            pgtAdm,
                            baseAih,
                            increment,
                            aihWithIncrements
                          });
                        });
                      });

                      // 🤱 CONTAGEM DE PARTOS CESAREANOS
                      let cesareanCount = 0;
                      filteredDoctors.forEach((card: any) => {
                        (card.patients || []).forEach((p: any) => {
                          const procedures = p.procedures || [];
                          const hasCesarean = procedures.some((proc: any) => {
                            const code = proc.procedure_code || '';
                            return code === '04.11.01.003-4' || code === '04.11.01.004-2';
                          });
                          if (hasCesarean) cesareanCount++;
                        });
                      });

                      console.log('📊 [RELATÓRIO SIMPLIFICADO] ESTATÍSTICAS:');
                      console.log(`📊 [RELATÓRIO SIMPLIFICADO] Total de AIHs encontradas: ${totalPatientsFound}`);
                      console.log(`📊 [RELATÓRIO SIMPLIFICADO] Excluídas por data: ${excludedByDateFilter}`);
                      console.log(`📊 [RELATÓRIO SIMPLIFICADO] AIHs sem número incluídas: ${allPatients.filter(p => p.aih === 'Aguardando geração').length}`);
                      console.log(`🤱 [RELATÓRIO SIMPLIFICADO] Partos cesareanos identificados: ${cesareanCount}`);
                      console.log(`📊 [RELATÓRIO SIMPLIFICADO] Incluídas no relatório: ${allPatients.length}`);

                      // 🔄 CORREÇÃO: Ordenar por data de alta (do mais antigo para o mais recente)
                      const patientsArray = allPatients;
                      patientsArray.sort((a, b) => {
                        // Converter datas de DD/MM/YYYY para Date para comparação
                        const parseDate = (dateStr: string): Date | null => {
                          if (!dateStr || dateStr === '') return null;
                          const parts = dateStr.split('/');
                          if (parts.length === 3) {
                            // DD/MM/YYYY -> YYYY-MM-DD
                            return new Date(`${parts[2]}-${parts[1]}-${parts[0]}`);
                          }
                          return null;
                        };

                        const dateA = parseDate(a.dischargeLabel);
                        const dateB = parseDate(b.dischargeLabel);

                        // Se uma das datas não existe, colocar no final
                        if (!dateA && !dateB) return 0;
                        if (!dateA) return 1;
                        if (!dateB) return -1;

                        // Ordenar do mais antigo para o mais recente
                        const dateCompare = dateA.getTime() - dateB.getTime();
                        if (dateCompare !== 0) return dateCompare;

                        // Se datas iguais, ordenar por nome do paciente
                        return a.name.toLowerCase().localeCompare(b.name.toLowerCase());
                      });

                      // Criar linhas do Excel
                      patientsArray.forEach((patient) => {
                        rows.push([
                          idx++,
                          patient.name,
                          patient.medicalRecord,
                          patient.aih,
                          patient.admissionLabel,
                          patient.dischargeLabel,
                          patient.doctorName,
                          patient.pgtAdm,
                          formatCurrency(patient.baseAih),
                          formatCurrency(patient.increment),
                          formatCurrency(patient.aihWithIncrements)
                        ]);
                      });

                      const wb = XLSX.utils.book_new();
                      const ws = XLSX.utils.aoa_to_sheet([header, ...rows]);
                      (ws as any)['!cols'] = [
                        { wch: 5 },   // #
                        { wch: 40 },  // Nome do Paciente
                        { wch: 16 },  // Prontuário
                        { wch: 18 },  // Nº AIH
                        { wch: 18 },  // Data de Admissão
                        { wch: 18 },  // Data de Alta
                        { wch: 30 },  // Médico
                        { wch: 20 },  // Pgt. Administrativo
                        { wch: 18 },  // AIH Seca
                        { wch: 18 },  // Incremento
                        { wch: 20 },  // AIH c/ Incremento
                      ];
                      XLSX.utils.book_append_sheet(wb, ws, 'Pacientes Simplificado');
                      const fileName = `Relatorio_Pacientes_Simplificado_${formatDateFns(new Date(), 'yyyyMMdd_HHmm')}.xlsx`;
                      XLSX.writeFile(wb, fileName);
                      toast.success('Relatório simplificado gerado com sucesso!');
                    } catch (e) {
                      console.error('Erro ao exportar Relatório Simplificado:', e);
                      toast.error('Erro ao gerar relatório simplificado');
                    }
                  }}
                  className="inline-flex items-center gap-2 bg-black hover:bg-neutral-800 text-white justify-self-start w-auto min-w-[220px]"
                  title="Gerar relatório simplificado de pacientes"
                >
                  <FileSpreadsheet className="h-4 w-4" />
                  Relatório Pacientes Geral Simplificado
                </Button>
              </div>
            </div>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">

          {/* ✅ COMPETÊNCIA É CONTROLADA PELO EXECUTIVEDASHBOARD (filtro global) */}
          {selectedCompetencia !== 'all' && (
            <div className="bg-gradient-to-br from-indigo-50 to-blue-50/30 p-3 rounded-xl border border-indigo-200">
              <div className="flex items-center gap-2">
                <Calendar className="w-4 h-4 text-indigo-600" />
                <span className="text-sm font-medium text-indigo-700">
                  Filtro ativo: Competência {formatCompetencia(selectedCompetencia)}
                </span>
              </div>
            </div>
          )}

          {/* ✅ LISTA DE MÉDICOS COM PAGINAÇÃO */}
          <div className="space-y-4">
            {filteredDoctors.length === 0 ? (
              <div className="text-center py-12">
                <Users className="h-12 w-12 mx-auto text-gray-300 mb-4" />
                <div className="text-lg font-medium text-gray-600">
                  {(() => {
                    const needsHospital = useSihSource && (
                      !selectedHospitals || selectedHospitals.length === 0 || selectedHospitals.includes('all')
                    );
                    if (needsHospital) return 'Selecione o hospital para começar';
                    const compSelected = selectedCompetencia && selectedCompetencia !== 'all' && selectedCompetencia.trim() !== '';
                    if (useSihSource && compSelected && availableCompetencias?.length && !availableCompetencias.includes(selectedCompetencia)) {
                      return 'Competência sem dados para o hospital selecionado';
                    }
                    return searchTerm ? 'Nenhum médico responsável encontrado' : 'Nenhum médico responsável cadastrado';
                  })()}
                </div>
                <div className="text-sm text-gray-500">
                  {(() => {
                    const needsHospital = useSihSource && (
                      !selectedHospitals || selectedHospitals.length === 0 || selectedHospitals.includes('all')
                    );
                    if (needsHospital) return 'Selecione o hospital e depois a competência para visualizar os dados';
                    const compSelected = selectedCompetencia && selectedCompetencia !== 'all' && selectedCompetencia.trim() !== '';
                    if (useSihSource && compSelected && availableCompetencias?.length && !availableCompetencias.includes(selectedCompetencia)) {
                      const list = availableCompetencias.map(c => {
                        const m = c.match(/^(\d{4})(\d{2})$/);
                        return m ? `${m[2]}/${m[1]}` : c;
                      }).join(', ');
                      return `Competências disponíveis: ${list}`;
                    }
                    return searchTerm ? 'Tente alterar os filtros de busca' : 'Processe algumas AIHs com médicos responsáveis para ver os dados';
                  })()}
                </div>
              </div>
            ) : (
              (() => {
                // Preparar dados dos médicos ordenados
                const sortedDoctors = filteredDoctors
                  .map((doctor) => {
                    // ✅ PERFORMANCE: Usar cache de stats (evita recálculo)
                    const key = getDoctorCardKey(doctor);
                    const stats = doctorStatsCache.get(key);
                    return {
                      ...doctor,
                      totalValue: stats?.totalValue || 0
                    };
                  })
                  .sort((a, b) => b.totalValue - a.totalValue);

                // Calcular paginação
                const totalDoctors = sortedDoctors.length;
                const totalPages = Math.ceil(totalDoctors / DOCTORS_PER_PAGE);
                const startIndex = (currentDoctorPage - 1) * DOCTORS_PER_PAGE;
                const endIndex = startIndex + DOCTORS_PER_PAGE;
                const paginatedDoctors = sortedDoctors.slice(startIndex, endIndex);

                return (
                  <>
                    {/* Pagination Controls - Top */}
                    {totalPages > 1 && (
                      <div className="flex items-center justify-between mb-4">
                        <div className="text-sm text-muted-foreground">
                          Mostrando {startIndex + 1}-{Math.min(endIndex, totalDoctors)} de {totalDoctors} médicos
                        </div>
                        <div className="flex items-center space-x-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setCurrentDoctorPage(prev => Math.max(prev - 1, 1))}
                            disabled={currentDoctorPage === 1}
                          >
                            <ChevronLeft className="h-4 w-4" />
                          </Button>
                          {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
                            <Button
                              key={page}
                              variant={currentDoctorPage === page ? "default" : "outline"}
                              size="sm"
                              onClick={() => setCurrentDoctorPage(page)}
                            >
                              {page}
                            </Button>
                          ))}
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setCurrentDoctorPage(prev => Math.min(prev + 1, totalPages))}
                            disabled={currentDoctorPage === totalPages}
                          >
                            <ChevronRight className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    )}

                    {/* Lista de médicos paginada */}
                    {paginatedDoctors.map((doctor, index) => {
                      // ✅ PERFORMANCE: Usar cache de stats (evita recálculo em cada render)
                      const cardKey = getDoctorCardKey(doctor);
                      const doctorStats = doctorStatsCache.get(cardKey);
                      const isExpanded = expandedDoctors.has(cardKey);

                      // Se stats não existe no cache, pular este médico (não deve acontecer)
                      if (!doctorStats) {
                        console.warn(`⚠️ Stats não encontrados no cache para: ${doctor.doctor_info.name}`);
                        return null;
                      }

                      // ✅ FUNÇÃO PARA MEDALHAS
                      const getRankingMedal = (position: number) => {
                        switch (position) {
                          case 0: return '🥇';
                          case 1: return '🥈';
                          case 2: return '🥉';
                          default: return null;
                        }
                      };

                      return (
                        <Card key={cardKey} className="mb-8 border-2 border-gray-400 ring-1 ring-black/5 rounded-xl bg-white hover:shadow-md transition-all duration-300">
                          <Collapsible>
                            <CollapsibleTrigger asChild>
                              <div
                                className="w-full cursor-pointer p-4 rounded-lg hover:bg-slate-50 transition-colors"
                                onClick={() => toggleDoctorExpansion(cardKey)}
                              >
                                {/* Ícone de expansão */}
                                <div className="flex items-center gap-2 mb-2">
                                  {isExpanded ? (
                                    <ChevronDown className="h-4 w-4 text-slate-500 transition-transform duration-200" />
                                  ) : (
                                    <ChevronRight className="h-4 w-4 text-slate-500 transition-transform duration-200" />
                                  )}
                                  <span className="text-xs text-slate-500 font-medium">
                                    {isExpanded ? 'Clique para recolher' : 'Clique para expandir pacientes e detalhes'}
                                  </span>
                                </div>

                                {/* NOME DO MÉDICO - DESTAQUE */}
                                <div className="mb-3 pb-3 border-b border-gray-100">
                                  <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                      <div className="flex items-center justify-center w-10 h-10 bg-indigo-100 rounded-full">
                                        <Stethoscope className="h-5 w-5 text-indigo-600" />
                                      </div>
                                      <div>
                                        <div className="text-lg font-bold text-gray-900">{doctor.doctor_info.name}</div>
                                        <div className="text-xs text-gray-500 font-medium">{doctor.doctor_info.specialty || '—'}</div>
                                      </div>
                                    </div>
                                    <div className="flex items-center gap-2">
                                      <Badge variant="outline" className="bg-indigo-50 text-indigo-700 border-indigo-200 text-[10px] font-semibold">
                                        {doctorStats.simplifiedReportLineCount} PACIENTES
                                      </Badge>
                                      <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200 text-[10px] font-semibold">
                                        {doctorStats.totalProcedures} PROC
                                      </Badge>
                                      {/* 🚨 BADGE: Pacientes sem Repasse Médico */}
                                      {(() => {
                                        // Verificar se já foi calculado no cache
                                        const cached = patientsWithoutPaymentCache.get(cardKey);

                                        // Se foi expandido, calcular
                                        if (isExpanded && !cached) {
                                          // Calcular de forma assíncrona (não bloqueia a UI)
                                          setTimeout(() => calculatePatientsWithoutPayment(doctor, cardKey), 0);
                                        }

                                        // Mostrar badge apenas se houver dados e já foi calculado
                                        if (cached && cached.calculated && doctor.patients && doctor.patients.length > 0) {
                                          if (cached.count > 0) {
                                            return (
                                              <Badge variant="destructive" className="text-[10px] font-semibold cursor-pointer" onClick={() => openZeroRepasseModal(doctor)}>
                                                <AlertCircle className="h-3 w-3 mr-1" />
                                                {cached.count} sem repasse
                                              </Badge>
                                            );
                                          } else {
                                            return (
                                              <Badge variant="default" className="text-[10px] font-semibold bg-green-100 text-green-800 border-green-300">
                                                <CheckCircle className="h-3 w-3 mr-1" />
                                                0 sem repasse
                                              </Badge>
                                            );
                                          }
                                        }

                                        // Mostrar indicador "clique para verificar" se ainda não foi expandido
                                        if (!cached && doctor.patients && doctor.patients.length > 0) {
                                          return (
                                            <Badge variant="outline" className="text-[10px] font-semibold bg-gray-50 text-gray-600 border-gray-300">
                                              <Activity className="h-3 w-3 mr-1" />
                                              Expandir p/ verificar
                                            </Badge>
                                          );
                                        }

                                        return null;
                                      })()}
                                      {getRankingMedal(index) && (
                                        <span className="text-2xl">{getRankingMedal(index)}</span>
                                      )}
                                    </div>
                                  </div>
                                </div>

                                {/* GRID DE INFORMAÇÕES - 2 COLUNAS */}
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-2 mb-3">
                                  {/* Coluna 1 */}
                                  <div className="space-y-2">
                                    <div className="flex items-baseline gap-2">
                                      <span className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide">CNS:</span>
                                      <span className="text-xs font-mono font-medium text-gray-900">{doctor.doctor_info.cns || '—'}</span>
                                    </div>
                                    <div className="flex items-baseline gap-2">
                                      <span className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide">CRM:</span>
                                      <span className="text-xs font-medium text-gray-900">{doctor.doctor_info.crm || '—'}</span>
                                    </div>
                                    <div className="flex items-baseline gap-2">
                                      <span className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide">Hospital:</span>
                                      <span className="text-xs font-medium text-gray-900">{(() => {
                                        const hospitals = doctor.hospitals;
                                        if (hospitals && hospitals.length > 0) {
                                          const primaryHospital = hospitals.find((h: any) => h.is_primary_hospital);
                                          const hospital = primaryHospital || hospitals[0];
                                          return hospital.hospital_name;
                                        }
                                        return 'Não definido';
                                      })()}</span>
                                    </div>
                                  </div>

                                  {/* Coluna 2 */}
                                  <div className="space-y-2">
                                    <div className="flex items-baseline gap-2">
                                      <span className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide">Procedimentos:</span>
                                      <span className="text-xs font-bold text-blue-700">{doctorStats.totalProcedures}</span>
                                    </div>
                                    <div className="flex items-baseline gap-2">
                                      <span className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide">Ticket Médio:</span>
                                      <span className="text-xs font-medium text-gray-900">{formatCurrency(doctorStats.avgTicket)}</span>
                                    </div>
                                    <div className="flex items-baseline gap-2">
                                      <span className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide">Regra Pagamento:</span>
                                      <span className="text-xs font-medium text-gray-900">{(() => {
                                        const hospitalId = doctor.hospitals?.[0]?.hospital_id;

                                        // ✅ CORREÇÃO: Verificar se médico tem regras individuais (rules)
                                        // Se tiver rules, não é "Valor Fixo", é "Regras por Proc."
                                        const hasIndividualRules = hasIndividualPaymentRules(doctor.doctor_info.name, hospitalId);
                                        const fixedCalc = calculateFixedPayment(doctor.doctor_info.name, hospitalId);

                                        // ✅ Se tem fixedPaymentRule MAS também tem rules individuais, não é "Valor Fixo"
                                        if (fixedCalc.hasFixedRule && hasIndividualRules) {
                                          // Tem regras individuais, então é "Regras por Proc." (fixedPaymentRule é apenas fallback)
                                          if (doctorStats.calculatedPaymentValue > 0) return 'Regras por Proc.';
                                          return '—';
                                        }

                                        // Se tem fixedPaymentRule SEM rules individuais, é "Valor Fixo" (valor fixo mensal)
                                        if (fixedCalc.hasFixedRule && !hasIndividualRules) return 'Valor Fixo';

                                        const percentageCalc = calculatePercentagePayment(doctor.doctor_info.name, doctorStats.totalValue, hospitalId);
                                        if (percentageCalc.hasPercentageRule) return `${percentageCalc.appliedRule.match(/\d+%/)?.[0] || '65%'} do Total`;
                                        if (doctorStats.calculatedPaymentValue > 0) return 'Regras por Proc.';
                                        return '—';
                                      })()}</span>
                                    </div>
                                  </div>
                                </div>

                                {/* SEÇÃO DE VALORES - DESTAQUE ESPECIAL */}
                                <div className="mt-3 pt-3 border-t-2 border-gray-200 space-y-2">
                                  {/* TOTAL DE AIHs - LINHA 1 */}
                                  <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                                    <div className="bg-white rounded-lg p-3 border-2 border-emerald-400">
                                      <div className="flex items-center justify-between">
                                        <span className="text-xs font-bold text-black uppercase tracking-wide">Total AIHs</span>
                                        <span className="text-base font-black text-black">{formatCurrency(doctorStats.totalValue)}</span>
                                      </div>
                                    </div>
                                    <div className="bg-white rounded-lg p-3 border-2 border-blue-400">
                                      <div className="flex items-center justify-between">
                                        <span className="text-xs font-bold text-black uppercase tracking-wide">Incremento</span>
                                        <span className="text-base font-black text-black">{(() => {
                                          // ✅ BEST PRACTICE: Usar valor pré-calculado de calculateDoctorStats
                                          const increment = doctorStats.operaParanaIncrement || 0;

                                          if (increment === 0) return '-';

                                          // 🔍 LOG para verificação
                                          console.log(`📈 [CARD INCREMENTO] ${doctor.doctor_info.name}: R$ ${increment.toFixed(2)}`);

                                          return formatCurrency(increment);
                                        })()}</span>
                                      </div>
                                    </div>
                                    <div className="bg-white rounded-lg p-3 border-2 border-violet-400">
                                      <div className="flex items-center justify-between">
                                        <span className="text-xs font-bold text-black uppercase tracking-wide">c/ Opera Paraná</span>
                                        <span className="text-base font-black text-black">{(() => {
                                          // ✅ BEST PRACTICE: Usar valor pré-calculado de calculateDoctorStats
                                          const totalWithIncrement = doctorStats.totalValueWithOperaParana || doctorStats.totalValue || 0;
                                          const increment = doctorStats.operaParanaIncrement || 0;

                                          if (increment === 0) return '-';

                                          // 🔍 LOG para verificação
                                          console.log(`🎯 [CARD OPERA PARANÁ] ${doctor.doctor_info.name}: R$ ${totalWithIncrement.toFixed(2)} (Base: ${doctorStats.totalValue.toFixed(2)} + Incremento: ${increment.toFixed(2)})`);

                                          return formatCurrency(totalWithIncrement);
                                        })()}</span>
                                      </div>
                                    </div>
                                  </div>

                                  {/* PAGAMENTO MÉDICO - DESTAQUE ESPECIAL */}
                                  <div className="bg-white rounded-lg p-4 border-2 border-green-500 shadow-sm">
                                    <div className="flex items-center justify-between">
                                      <div className="flex items-center gap-2">
                                        <DollarSign className="h-5 w-5 text-black" />
                                        <span className="text-sm font-bold text-black uppercase tracking-wide">Pagamento Médico</span>
                                      </div>
                                      <span className="text-xl font-black text-black">
                                        {formatCurrency((() => {
                                          const hospitalId = doctor.hospitals?.[0]?.hospital_id;
                                          const fixedCalc = calculateFixedPayment(doctor.doctor_info.name, hospitalId);
                                          if (fixedCalc.hasFixedRule) {
                                            return fixedCalc.calculatedPayment;
                                          }
                                          const percentageCalc = calculatePercentagePayment(doctor.doctor_info.name, doctorStats.totalValue, hospitalId);
                                          if (percentageCalc.hasPercentageRule) {
                                            return percentageCalc.calculatedPayment;
                                          }
                                          const fallback = doctorStats.calculatedPaymentValue || doctorStats.medicalProceduresValue || 0;
                                          if (fallback > 0) {
                                            console.log(`💰 [CARD] ${doctor.doctor_info.name}: R$ ${fallback.toFixed(2)} (fallback regras por procedimento)`);
                                          }
                                          return fallback;
                                        })())}
                                      </span>
                                    </div>
                                  </div>
                                </div>

                                {/* BOTÕES DE AÇÃO - GRID HORIZONTAL */}
                                <div className="mt-4 pt-3 border-t border-gray-100">
                                  <div className="flex flex-wrap gap-2 justify-start items-center">

                                    <Button
                                      type="button"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        try {
                                          const rows: Array<Array<string | number>> = [];
                                          // ✅ AGORA COM 16 COLUNAS (adicionado Instrumento de Registro)
                                          const header = [
                                            '#',
                                            'Nome do Paciente',
                                            'Nº AIH',
                                            'Código Procedimento',
                                            'Descrição Procedimento',
                                            'Instrumento de Registro',
                                            'Data Procedimento',
                                            'Data Alta (SUS)',
                                            'Especialidade de Atendimento',
                                            'Caráter de Atendimento',
                                            'Médico',
                                            'Hospital',
                                            'Valor Procedimento',
                                            'AIH Seca',
                                            'Incremento',
                                            'AIH c/ Incremento'
                                          ];
                                          let idx = 1;
                                          const doctorName = doctor.doctor_info?.name || '';
                                          const hospitalName = doctor.hospitals?.[0]?.hospital_name || '';
                                          const hospitalId = doctor.hospitals?.[0]?.hospital_id;

                                          // ✅ CORREÇÃO: NÃO deduplicate - cada entrada em doctor.patients já é uma AIH única
                                          // O serviço doctorPatientService já garante que não há duplicatas

                                          console.log(`📊 [RELATÓRIO MÉDICO] Gerando relatório para ${doctorName}`);
                                          console.log(`📊 [RELATÓRIO MÉDICO] Total de AIHs: ${(doctor.patients || []).length}`);

                                          (doctor.patients || []).forEach((p: any) => {
                                            // ✅ FILTRO UNIFICADO: Intervalo de datas (mesmo dos relatórios gerais)
                                            if (false) {
                                              const discharge = p?.aih_info?.discharge_date ? new Date(p.aih_info.discharge_date) : undefined;

                                              if (!discharge) return;

                                              const startOfPeriod = new Date();
                                              const endOfPeriod = new Date();

                                              const dischargeDate = new Date(discharge);

                                              if (dischargeDate < startOfPeriod || dischargeDate > endOfPeriod) {
                                                return;
                                              }
                                            }

                                            const name = p.patient_info?.name || 'Paciente';
                                            const aihRaw = (p?.aih_info?.aih_number || '').toString().replace(/\D/g, '');
                                            const aih = aihRaw || 'Aguardando geração';

                                            const careSpec = (p?.aih_info?.specialty || '').toString();
                                            const careCharacter = (() => {
                                              const raw = (p?.aih_info?.care_character ?? '').toString();
                                              try { return CareCharacterUtils.formatForDisplay(raw, false); } catch { return raw; }
                                            })();
                                            const disISO = p?.aih_info?.discharge_date || '';
                                            const disLabel = disISO
                                              ? parseISODateToLocal(disISO)
                                              : '';

                                            // ✅ CÁLCULOS FINANCEIROS (mesma lógica do relatório geral)
                                            const baseAih = Number(p.total_value_reais || 0);
                                            const doctorCovered = isDoctorCoveredForOperaParana(doctorName, hospitalId);
                                            const procedures = (p as any).calculable_procedures || (p.procedures || []).filter(filterCalculableProcedures);
                                            const increment = doctorCovered ? computeIncrementForProcedures(procedures as any, p?.aih_info?.care_character, doctorName, hospitalId) : 0;
                                            const aihWithIncrements = baseAih + increment;

                                            // ✅ FIX: Mostrar os mesmos procedimentos calculáveis usados na tela
                                            if (procedures.length > 0) {
                                              procedures.forEach((proc: any) => {
                                                const procCode = proc.procedure_code || '';
                                                const procDesc = proc.procedure_description || proc.sigtap_description || '';
                                                const registrationInstrument = proc.registration_instrument || '-';
                                                const procDate = proc.procedure_date || '';
                                                const procDateLabel = procDate
                                                  ? (() => {
                                                    const s = String(procDate);
                                                    const m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
                                                    return m ? `${m[3]}/${m[2]}/${m[1]}` : parseISODateToLocal(s);
                                                  })()
                                                  : '';
                                                const procValue = Number(proc.value_reais || 0);

                                                rows.push([
                                                  idx++,
                                                  name,
                                                  aih,
                                                  procCode,
                                                  procDesc,
                                                  registrationInstrument,
                                                  procDateLabel,
                                                  disLabel,
                                                  careSpec,
                                                  careCharacter,
                                                  doctorName,
                                                  hospitalName,
                                                  procValue,
                                                  baseAih,
                                                  increment,
                                                  aihWithIncrements
                                                ]);
                                              });
                                            } else {
                                              // Paciente sem procedimentos
                                              rows.push([
                                                idx++,
                                                name,
                                                aih,
                                                '',
                                                'Nenhum procedimento encontrado',
                                                '-',
                                                '',
                                                disLabel,
                                                careSpec,
                                                careCharacter,
                                                doctorName,
                                                hospitalName,
                                                0,
                                                baseAih,
                                                increment,
                                                aihWithIncrements
                                              ]);
                                            }
                                          });

                                          // ✅ ORDENAÇÃO: Por Data de Alta (mais recente primeiro)
                                          rows.sort((a, b) => {
                                            const dateA = a[7] as string; // Data Alta (SUS) está na posição 7 (após adicionar Instrumento)
                                            const dateB = b[7] as string;

                                            // Sem data → final
                                            if (!dateA && !dateB) return 0;
                                            if (!dateA) return 1;
                                            if (!dateB) return -1;

                                            // Converter DD/MM/YYYY para Date
                                            const parseDate = (dateStr: string) => {
                                              const parts = dateStr.split('/');
                                              if (parts.length === 3) {
                                                return new Date(parseInt(parts[2]), parseInt(parts[1]) - 1, parseInt(parts[0]));
                                              }
                                              return new Date(0);
                                            };

                                            const parsedDateA = parseDate(dateA);
                                            const parsedDateB = parseDate(dateB);

                                            // DESCENDENTE (mais recente primeiro)
                                            return parsedDateB.getTime() - parsedDateA.getTime();
                                          });

                                          // Renumerar após ordenação
                                          rows.forEach((row, index) => {
                                            row[0] = index + 1;
                                          });

                                          console.log(`📊 [RELATÓRIO MÉDICO] Total de linhas geradas: ${rows.length} (ordenadas por data de alta DESC)`);

                                          const wb = XLSX.utils.book_new();
                                          const ws = XLSX.utils.aoa_to_sheet([header, ...rows]);
                                          // ✅ LARGURAS DAS COLUNAS (atualizado com Instrumento de Registro)
                                          const wsAny: any = ws;
                                          wsAny['!cols'] = [
                                            { wch: 5 },   // #
                                            { wch: 35 },  // Nome do Paciente
                                            { wch: 18 },  // Nº AIH
                                            { wch: 20 },  // Código Procedimento
                                            { wch: 45 },  // Descrição Procedimento
                                            { wch: 25 },  // Instrumento de Registro
                                            { wch: 16 },  // Data Procedimento
                                            { wch: 16 },  // Data Alta (SUS)
                                            { wch: 25 },  // Especialidade
                                            { wch: 22 },  // Caráter de Atendimento
                                            { wch: 30 },  // Médico
                                            { wch: 35 },  // Hospital
                                            { wch: 18 },  // Valor Procedimento
                                            { wch: 18 },  // AIH Seca
                                            { wch: 18 },  // Incremento
                                            { wch: 20 },  // AIH c/ Incremento
                                          ];
                                          XLSX.utils.book_append_sheet(wb, ws, 'Pacientes');
                                          // ✅ Resumo por médico
                                          const uniqueKeys: Record<string, true> = {};
                                          let aihsWithProcedures = 0;
                                          for (const p of (doctor.patients || []) as any[]) {
                                            const aihId = String(p.aih_id || '').trim();
                                            const aihNumber = String((p?.aih_info?.aih_number || '')).replace(/\D/g, '').replace(/^0+/, '');
                                            const key = aihId || aihNumber || `${p.patient_id || ''}|${p?.aih_info?.admission_date || ''}`;
                                            if (key) uniqueKeys[key] = true;
                                            const calcs = (p as any).calculable_procedures || (p.procedures || []).filter(filterCalculableProcedures);
                                            if (calcs.length > 0) aihsWithProcedures++;
                                          }
                                          const totalCardAihs = Object.keys(uniqueKeys).length;
                                          const summaryRows = [
                                            ['AIHs (registros únicos) na tela', totalCardAihs],
                                            ['AIHs com ≥1 procedimento calculável', aihsWithProcedures],
                                            ['Linhas no relatório (procedimentos + placeholders)', rows.length],
                                          ];
                                          const wsSummary = XLSX.utils.aoa_to_sheet([['Resumo'], ...summaryRows]);
                                          const wsSummaryAny: any = wsSummary;
                                          wsSummaryAny['!cols'] = [{ wch: 52 }, { wch: 18 }];
                                          XLSX.utils.book_append_sheet(wb, wsSummary, 'Resumo');
                                          const fileName = `Relatorio_Pacientes_${doctorName.replace(/\s+/g, '_')}_${formatDateFns(new Date(), 'yyyyMMdd_HHmm')}.xlsx`;
                                          XLSX.writeFile(wb, fileName);
                                          toast.success('Relatório de pacientes do médico gerado com sucesso!');
                                        } catch (err) {
                                          console.error('Erro ao exportar Relatório Pacientes (card):', err);
                                          toast.error('Erro ao gerar relatório do médico');
                                        }
                                      }}
                                      className="inline-flex items-center gap-2 bg-[#0b1736] hover:bg-[#09122a] text-white shadow-sm h-9 px-3 rounded-md text-sm w-auto min-w-[200px]"
                                    >
                                      <FileSpreadsheet className="h-4 w-4" />
                                      Relatório Pacientes
                                    </Button>

                                    <Button
                                      type="button"
                                      onClick={async (e) => {
                                        e.stopPropagation();
                                        await generateSimplifiedReport(doctor, false);
                                        return;
                                        try {
                                          // 🖼️ Carregar logo do CIS
                                          let logoBase64 = null;
                                          try {
                                            const response = await fetch('/CIS Sem fundo.jpg');
                                            const blob = await response.blob();
                                            logoBase64 = await new Promise<string>((resolve) => {
                                              const reader = new FileReader();
                                              reader.onloadend = () => resolve(reader.result as string);
                                              reader.readAsDataURL(blob);
                                            });
                                          } catch (error) {
                                            console.error('⚠️ Erro ao carregar logo:', error);
                                          }

                                          const doctorName = doctor.doctor_info?.name || '';
                                          const hospitalId = doctor.hospitals?.[0]?.hospital_id;
                                          const hospitalName = doctor.hospitals?.[0]?.hospital_name || 'Hospital não identificado';

                                          console.log(`📊 [RELATÓRIO MÉDICO SIMPLIFICADO PDF] Gerando para ${doctorName}`);
                                          console.log(`📊 [RELATÓRIO MÉDICO SIMPLIFICADO PDF] Hospital: ${hospitalName}`);

                                          // Preparar dados para a tabela
                                          const tableData: Array<Array<string>> = [];
                                          let totalRepasse = 0; // ✅ Calcular total durante o loop
                                          let totalPatientsProcessed = 0; // 📊 Total de pacientes processados
                                          let patientsWithPayment = 0; // ✅ Pacientes com repasse > 0

                                          // 🔍 Aprovação via fonte remota SIH: match por AIH
                                          let approvedSet = new Set<string>();
                                          try {
                                            const allAihNumbers = (doctor.patients || [])
                                              .map((p: any) => String(p?.aih_info?.aih_number || '').trim())
                                              .filter((v: string) => !!v);
                                            const uniqueAih = Array.from(new Set(allAihNumbers));
                                            if (uniqueAih.length > 0 && ENV_CONFIG.SIH_SUPABASE_URL && ENV_CONFIG.SIH_SUPABASE_ANON_KEY) {
                                              const { supabaseSih } = await import('../lib/sihSupabase');
                                              if (supabaseSih) {
                                                let compYear: number | undefined;
                                                let compMonth: number | undefined;
                                                if (selectedCompetencia && selectedCompetencia.trim() && selectedCompetencia !== 'all') {
                                                  const raw = selectedCompetencia.trim();
                                                  if (/^\d{6}$/.test(raw)) {
                                                    compYear = parseInt(raw.slice(0, 4), 10);
                                                    compMonth = parseInt(raw.slice(4, 6), 10);
                                                  } else {
                                                    const m = raw.match(/^(\d{4})-(\d{2})/);
                                                    if (m) {
                                                      compYear = parseInt(m[1], 10);
                                                      compMonth = parseInt(m[2], 10);
                                                    }
                                                  }
                                                }
                                                const chunkSize = 80;
                                                for (let i = 0; i < uniqueAih.length; i += chunkSize) {
                                                  const ch = uniqueAih.slice(i, i + chunkSize);
                                                  let spQuery = supabaseSih
                                                    .from('sih_sp')
                                                    .select('sp_naih')
                                                    .in('sp_naih', ch);
                                                  if (typeof compMonth === 'number') spQuery = spQuery.eq('sp_mm', compMonth);
                                                  if (typeof compYear === 'number') spQuery = spQuery.eq('sp_aa', compYear);
                                                  const { data: spRows, error: spErr } = await spQuery;
                                                  if (!spErr && spRows && spRows.length > 0) {
                                                    spRows.forEach((r: any) => {
                                                      const k = String(r.sp_naih || '').trim();
                                                      if (k) approvedSet.add(k);
                                                    });
                                                  }
                                                }
                                                // 🔄 Atualizar coluna 'aprovado' na tabela local aihs (SIM/NÃO)
                                                try {
                                                  if (approvedSet.size > 0) {
                                                    const approvedList = Array.from(approvedSet);
                                                    await supabase
                                                      .from('aihs')
                                                      .update({ aprovado: 'sim' })
                                                      .in('aih_number', approvedList);
                                                    const notApproved = uniqueAih.filter(a => !approvedSet.has(a));
                                                    if (notApproved.length > 0) {
                                                      await supabase
                                                        .from('aihs')
                                                        .update({ aprovado: 'não' })
                                                        .in('aih_number', notApproved);
                                                    }
                                                  } else if (uniqueAih.length > 0) {
                                                    await supabase
                                                      .from('aihs')
                                                      .update({ aprovado: 'não' })
                                                      .in('aih_number', uniqueAih);
                                                  }
                                                } catch (updErr) {
                                                  console.warn('⚠️ Falha ao atualizar coluna aprovado nas AIHs locais:', updErr);
                                                }
                                              }
                                            }
                                          } catch (apprErr) {
                                            console.warn('⚠️ Falha na verificação de aprovação remota SIH:', apprErr);
                                          }

                                          (doctor.patients || []).forEach((p: any) => {
                                            totalPatientsProcessed++;
                                            // ✅ FILTRO UNIFICADO: Intervalo de datas (mesmo dos outros relatórios)
                                            if (false) {
                                              const discharge = p?.aih_info?.discharge_date ? new Date(p.aih_info.discharge_date) : undefined;

                                              if (!discharge) return;

                                              const startOfPeriod = new Date();
                                              const endOfPeriod = new Date();

                                              const dischargeDate = new Date(discharge);

                                              if (dischargeDate < startOfPeriod || dischargeDate > endOfPeriod) {
                                                return;
                                              }
                                            }

                                            const medicalRecord = p.patient_info?.medical_record || '-';
                                            const name = p.patient_info?.name || 'Paciente';

                                            const mainProc = (p.procedures || [])
                                              .reduce((max: any, proc: any) => {
                                                const v = typeof proc.value_reais === 'number' ? proc.value_reais : 0;
                                                const mv = typeof (max && max.value_reais) === 'number' ? max.value_reais : -1;
                                                return v > mv ? proc : max;
                                              }, null as any);
                                            const mainProcDesc = ((mainProc?.procedure_description || mainProc?.sigtap_description || '') as string).trim();
                                            const proceduresDisplay = mainProcDesc || (mainProc?.procedure_code ? `Procedimento ${mainProc.procedure_code}` : 'Sem procedimento principal');
                                            const aihNumber = p?.aih_info?.aih_number || '-';
                                            // ✅ CORREÇÃO: Lógica de pendência sincronizada
                                            // Se aprovado = SIM, mostra a competência
                                            // Se aprovado = NÃO, mostra "" (em branco)
                                            const isApproved = approvedSet.has(String(aihNumber).trim());
                                            const approvedLabel = isApproved ? 'Sim' : 'Não';
                                            const competenciaLabel = getSafeCompetenciaLabel(p, selectedCompetencia, isApproved);

                                            const dischargeISO = p?.aih_info?.discharge_date || '';
                                            const dischargeLabel = parseISODateToLocal(dischargeISO);

                                            // ✅ NOVO: Caráter de atendimento
                                            const careCharacter = p?.aih_info?.care_character || '';

                                            // ✅ NOVO: Calcular valor de repasse (mesma lógica do card)
                                            // ⚠️ CORREÇÃO: Usar MESMO filtro do card (apenas códigos 04.xxx)
                                            // ✅ CORREÇÃO 2: Ordenar procedimentos por sequence e valor (igual ao card)
                                            const aihKey = (p as any).aih_id || normalizeAihNumber(p?.aih_info?.aih_number) || '__single__'
                                            const baseProcedures = (p as any).calculable_procedures || getCalculableProcedures(
                                              ((p.procedures || []) as any[]).map((proc: any) => ({
                                                ...proc,
                                                aih_id: proc.aih_id || aihKey,
                                                sequence: proc.sequence ?? proc.sequencia ?? proc.procedure_sequence
                                              }))
                                            )
                                            const proceduresWithPayment = (baseProcedures as any[])
                                              .filter((proc: any) => isMedicalProcedure(proc.procedure_code))
                                              .sort((a: any, b: any) => {
                                                // Ordenar por sequence primeiro, depois por valor (decrescente)
                                                const sa = typeof a.sequence === 'number' ? a.sequence : 9999;
                                                const sb = typeof b.sequence === 'number' ? b.sequence : 9999;
                                                if (sa !== sb) return sa - sb;
                                                const va = typeof a.value_reais === 'number' ? a.value_reais : 0;
                                                const vb = typeof b.value_reais === 'number' ? b.value_reais : 0;
                                                return vb - va;
                                              })
                                              .map((proc: any) => ({
                                                procedure_code: proc.procedure_code,
                                                procedure_description: proc.procedure_description,
                                                value_reais: proc.value_reais || 0,
                                                cbo: proc.cbo,
                                                sequence: proc.sequence,
                                              }));

                                            let repasseValue = 0;
                                            if (proceduresWithPayment.length > 0) {
                                              const isGenSurg = /cirurg/i.test(doctorName) || (/cirurg/i.test(doctor.doctor_info.specialty || '') && /geral/i.test(doctor.doctor_info.specialty || ''))
                                              const useHon = shouldUseHonForHospital(doctorName, hospitalId, !!isGenSurg)
                                              const paymentResult = useHon
                                                ? calculateHonPayments(proceduresWithPayment)
                                                : calculateDoctorPayment(
                                                  doctorName,
                                                  proceduresWithPayment,
                                                  hospitalId
                                                );
                                              repasseValue = paymentResult.totalPayment || 0;
                                              totalRepasse += repasseValue; // ✅ Somar ao total
                                            }

                                            // ✅ CORREÇÃO: INCLUIR TODOS OS PACIENTES (mesmo com R$ 0,00)
                                            // Garante consistência com o valor do card "PAGAMENTO MÉDICO"
                                            patientsWithPayment++; // 📊 Contar todos os pacientes
                                            tableData.push([
                                              medicalRecord,
                                              aihNumber,
                                              name,
                                              proceduresDisplay,
                                              dischargeLabel,
                                              competenciaLabel,
                                              approvedLabel,
                                              formatCurrency(repasseValue) // Pode ser R$ 0,00
                                            ]);
                                          });

                                          // 📊 LOG: Resultado da inclusão de pacientes
                                          console.log(`📊 [RELATÓRIO SIMPLIFICADO] Total de pacientes incluídos: ${patientsWithPayment}`);
                                          console.log(`✅ [RELATÓRIO SIMPLIFICADO] TODOS os pacientes foram incluídos (incluindo R$ 0,00)`);
                                          console.log(`💰 [RELATÓRIO SIMPLIFICADO] Valor total de repasse: R$ ${totalRepasse.toFixed(2)}`);

                                          // ✅ ORDENAÇÃO: Por Data de Alta (mais recente primeiro)
                                          tableData.sort((a, b) => {
                                            const dateA = a[4] as string; // Data de Alta está na posição 4
                                            const dateB = b[4] as string;

                                            // Sem data → final
                                            if (!dateA && !dateB) return 0;
                                            if (!dateA) return 1;
                                            if (!dateB) return -1;

                                            // Converter DD/MM/YYYY para Date
                                            const parseDate = (dateStr: string) => {
                                              const parts = dateStr.split('/');
                                              if (parts.length === 3) {
                                                return new Date(parseInt(parts[2]), parseInt(parts[1]) - 1, parseInt(parts[0]));
                                              }
                                              return new Date(0);
                                            };

                                            const parsedDateA = parseDate(dateA);
                                            const parsedDateB = parseDate(dateB);

                                            // DESCENDENTE (mais recente primeiro)
                                            return parsedDateB.getTime() - parsedDateA.getTime();
                                          });

                                          console.log(`📊 [RELATÓRIO MÉDICO SIMPLIFICADO PDF] Total de linhas: ${tableData.length} (ordenadas por data de alta DESC)`);

                                          // Criar PDF
                                          const doc = new jsPDF('landscape');
                                          const pageWidth = doc.internal.pageSize.getWidth();
                                          const pageHeight = doc.internal.pageSize.getHeight();
                                          // Fonte do relatório (topo)
                                          try {
                                            const sourceLabel = useSihSource ? 'TABWIN' : 'GSUS';
                                            doc.setFontSize(10);
                                            doc.setFont('helvetica', 'bold');
                                            doc.setTextColor(80, 80, 80);
                                            doc.text(sourceLabel, pageWidth - 20, 10, { align: 'right' });
                                          } catch { }

                                          // ========== CABEÇALHO PROFISSIONAL COM LOGO ==========
                                          let yPosition = 20;

                                          // Logo CIS (se carregado)
                                          if (logoBase64) {
                                            const logoWidth = 40;
                                            const logoHeight = 20;
                                            const logoX = 20;
                                            const logoY = 8;
                                            doc.addImage(logoBase64, 'JPEG', logoX, logoY, logoWidth, logoHeight);
                                            yPosition = logoY + logoHeight + 10;
                                          }

                                          // Título do Documento
                                          doc.setFontSize(16);
                                          doc.setFont('helvetica', 'bold');
                                          doc.setTextColor(0, 51, 102); // Azul escuro
                                          doc.text('RELATÓRIO DE PACIENTES - MÉDICO', pageWidth / 2, yPosition, { align: 'center' });

                                          // Barra de informações horizontal (premium)
                                          yPosition += 10;
                                          const careHeader = (filterCareCharacter && filterCareCharacter !== 'all')
                                            ? CareCharacterUtils.formatForDisplay(filterCareCharacter, false)
                                            : 'TODOS';
                                          const compHeader = (selectedCompetencia && selectedCompetencia !== 'all')
                                            ? formatCompetencia(selectedCompetencia)
                                            : 'TODAS';
                                          const dataGeracao = new Date().toLocaleDateString('pt-BR', {
                                            day: '2-digit',
                                            month: '2-digit',
                                            year: 'numeric',
                                            hour: '2-digit',
                                            minute: '2-digit'
                                          });
                                          const line1: Array<{ label: string; value: string; bold?: boolean }> = [
                                            { label: 'Médico: ', value: doctorName, bold: true },
                                            { label: 'Hospital: ', value: hospitalName }
                                          ];
                                          const line2: Array<{ label: string; value: string; bold?: boolean }> = [
                                            { label: 'Comp. Aprovação: ', value: compHeader },
                                            { label: 'Caráter: ', value: careHeader },
                                            { label: 'Gerado em: ', value: dataGeracao }
                                          ];
                                          const separator = '  |  ';
                                          const drawSegments = (segments: Array<{ label: string; value: string; bold?: boolean }>, y: number, fontSize = 10) => {
                                            doc.setFontSize(fontSize);
                                            doc.setTextColor(60, 60, 60);
                                            let totalWidth = 0;
                                            segments.forEach((seg, idx) => {
                                              totalWidth += doc.getTextWidth(seg.label) + doc.getTextWidth(seg.value);
                                              if (idx < segments.length - 1) totalWidth += doc.getTextWidth(separator);
                                            });
                                            let x = (pageWidth / 2) - (totalWidth / 2);
                                            segments.forEach((seg, idx) => {
                                              doc.setFont('helvetica', 'normal');
                                              doc.text(seg.label, x, y);
                                              x += doc.getTextWidth(seg.label);
                                              doc.setFont('helvetica', seg.bold ? 'bold' : 'normal');
                                              doc.text(seg.value, x, y);
                                              x += doc.getTextWidth(seg.value);
                                              if (idx < segments.length - 1) {
                                                doc.setFont('helvetica', 'normal');
                                                doc.setTextColor(100, 100, 100);
                                                doc.text(separator, x, y);
                                                doc.setTextColor(60, 60, 60);
                                                x += doc.getTextWidth(separator);
                                              }
                                            });
                                          };
                                          drawSegments(line1, yPosition, 11);
                                          yPosition += 6;
                                          drawSegments(line2, yPosition, 10);

                                          // Linha separadora
                                          yPosition += 8;
                                          doc.setDrawColor(200, 200, 200);
                                          doc.setLineWidth(0.5);
                                          doc.line(20, yPosition, pageWidth - 20, yPosition);

                                          // ========== TABELA COM DADOS ==========
                                          const startY = yPosition + 10;

                                          autoTable(doc, {
                                            head: [['Prontuário', 'Nº da AIH', 'Nome do Paciente', 'Procedimento Principal', 'Data Alta', 'Comp. Aprovação', 'Homologado (SIH)', 'Valor de Repasse']],
                                            body: tableData,
                                            startY: startY,
                                            theme: 'striped',
                                            tableWidth: 'auto',
                                            headStyles: {
                                              fillColor: [0, 51, 102],
                                              textColor: [255, 255, 255],
                                              fontStyle: 'bold',
                                              fontSize: 9,
                                              halign: 'center',
                                              cellPadding: 2
                                            },
                                            bodyStyles: {
                                              fontSize: 8,
                                              textColor: [50, 50, 50],
                                              cellPadding: 2
                                            },
                                            columnStyles: {
                                              0: { cellWidth: 24, halign: 'center' },
                                              1: { cellWidth: 32, halign: 'center' },
                                              2: { cellWidth: 42, halign: 'left' },
                                              3: { cellWidth: 62, halign: 'left', fontSize: 7 },
                                              4: { cellWidth: 22, halign: 'center' },
                                              5: { cellWidth: 28, halign: 'center' },
                                              6: { cellWidth: 24, halign: 'center' },
                                              7: { cellWidth: 32, halign: 'right', fontStyle: 'bold', textColor: [0, 102, 0] }
                                            },
                                            styles: {
                                              overflow: 'linebreak',
                                              cellPadding: 2,
                                              fontSize: 8
                                            },
                                            margin: { left: 15, right: 15 },
                                            alternateRowStyles: {
                                              fillColor: [245, 245, 245]
                                            }
                                          });
                                          const finalY = (doc as any).lastAutoTable?.finalY || startY + 50;
                                          const footerY = pageHeight - 20;
                                          doc.setDrawColor(200, 200, 200);
                                          doc.setLineWidth(0.5);
                                          doc.line(20, footerY - 10, pageWidth - 20, footerY - 10);
                                          doc.setFontSize(8);
                                          doc.setFont('helvetica', 'normal');
                                          doc.setTextColor(120, 120, 120);
                                          doc.text('CIS - Centro Integrado em Saúde', pageWidth / 2, footerY - 5, { align: 'center' });
                                          doc.setFontSize(9);
                                          doc.setFont('helvetica', 'bold');
                                          doc.setTextColor(0, 51, 102);
                                          doc.text(`Total de Pacientes: ${tableData.length} | Valor Total de Repasse: ${formatCurrency(totalRepasse)}`, pageWidth / 2, footerY + 5, { align: 'center' });

                                          // Salvar PDF
                                          const fileName = `Relatorio_Pacientes_Simplificado_${doctorName.replace(/\s+/g, '_')}_${formatDateFns(new Date(), 'yyyyMMdd_HHmm')}.pdf`;
                                          doc.save(fileName);

                                          toast.success('Relatório PDF gerado com sucesso!');
                                        } catch (err) {
                                          console.error('Erro ao exportar Relatório Simplificado (PDF):', err);
                                          toast.error('Erro ao gerar relatório PDF');
                                        }
                                      }}
                                      className="inline-flex items-center gap-2 bg-[#0b1736] hover:bg-[#09122a] text-white shadow-sm h-9 px-3 rounded-md text-sm w-auto min-w-[200px]"
                                    >
                                      <FileSpreadsheet className="h-4 w-4" />
                                      Relatório Pacientes Simplificado
                                    </Button>
                                    <Button
                                      type="button"
                                      onClick={(e) => {
                                        e.stopPropagation()
                                        setTabwinReportDoctor(doctor)
                                        setTabwinReportOpen(true)
                                      }}
                                      className="inline-flex items-center gap-2 bg-[#0b1736] hover:bg-[#09122a] text-white shadow-sm h-9 px-3 rounded-md text-sm w-auto min-w-[200px]"
                                    >
                                      <FileSpreadsheet className="h-4 w-4" />
                                      Repasse Médico (TABWIN)
                                    </Button>
                                    <Button
                                      type="button"
                                      onClick={async (e) => {
                                        e.stopPropagation();
                                        await generateSimplifiedReport(doctor, false, true);
                                      }}
                                      className="inline-flex items-center gap-2 bg-[#0b1736] hover:bg-[#09122a] text-white shadow-sm h-9 px-3 rounded-md text-sm w-auto min-w-[200px]"
                                    >
                                      <FileSpreadsheet className="h-4 w-4" />
                                      Relatório Simplificado (Sem Zeros)
                                    </Button>
                                    <Button
                                      type="button"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        setRelateDoctor(doctor);
                                        setRelateReportA('Relatório Pacientes Simplificado');
                                        setRelateReportB('Repasse Médico (TABWIN)');
                                        setRelateOpen(true);
                                      }}
                                      className="inline-flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm h-9 px-3 rounded-md text-sm w-auto min-w-[200px]"
                                    >
                                      <FileSpreadsheet className="h-4 w-4" />
                                      Comparar Relatórios
                                    </Button>
                                    <Button
                                      type="button"
                                      onClick={(e) => {
                                        e.stopPropagation()
                                        setValueConferenceDoctor(doctor)
                                        setValueConferenceOpen(true)
                                      }}
                                      className="inline-flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white shadow-sm h-9 px-3 rounded-md text-sm w-auto min-w-[200px]"
                                    >
                                      <FileSpreadsheet className="h-4 w-4" />
                                      Conferência Valores
                                    </Button>
                                    {false && (<>
                                      {/* 📋 PROTOCOLO DE ATENDIMENTO APROVADO */}
                                      <Button
                                        type="button"
                                        onClick={async (e) => {
                                          e.stopPropagation();
                                          try {
                                            // 🖼️ Carregar logo do CIS
                                            let logoBase64 = null;
                                            try {
                                              const response = await fetch('/CIS Sem fundo.jpg');
                                              const blob = await response.blob();
                                              logoBase64 = await new Promise<string>((resolve) => {
                                                const reader = new FileReader();
                                                reader.onloadend = () => resolve(reader.result as string);
                                                reader.readAsDataURL(blob);
                                              });
                                            } catch (error) {
                                              console.error('⚠️ [PROTOCOLO] Erro ao carregar logo:', error);
                                            }

                                            const doctorName = doctor.doctor_info?.name || 'Médico';
                                            const hospitalName = doctor.hospitals?.[0]?.hospital_name || 'Hospital';
                                            const competenciaLabel = selectedCompetencia && selectedCompetencia !== 'all'
                                              ? formatCompetencia(selectedCompetencia)
                                              : 'Todas as competências';

                                            console.log(`📋 [PROTOCOLO] Gerando protocolo de atendimento aprovado para ${doctorName}`);
                                            console.log(`📋 [PROTOCOLO] Competência: ${competenciaLabel}`);
                                            console.log(`📋 [PROTOCOLO] Usando MESMA lógica do Relatório Pacientes Geral`);

                                            // ✅ Usar a mesma fonte de dados e filtros do Relatório Pacientes Geral
                                            const protocolData: any[] = [];
                                            let idx = 1;
                                            let totalProcsFound = 0;
                                            let totalProcsFiltered = 0;
                                            let aihsWithoutMainProcedure = 0;

                                            (doctor.patients || []).forEach((p: any) => {
                                              const patientName = p.patient_info?.name || 'Paciente';
                                              const medicalRecord = p.patient_info?.medical_record || '-';
                                              const dischargeISO = p?.aih_info?.discharge_date || '';
                                              const dischargeLabel = parseISODateToLocal(dischargeISO);

                                              // ✅ MESMA LÓGICA DO RELATÓRIO GERAL: Processar todos os procedimentos
                                              const procedures = p.procedures || [];
                                              totalProcsFound += procedures.length;

                                              // 🎯 Buscar o PRIMEIRO procedimento principal não-anestesista
                                              let mainProcedure = null;

                                              if (procedures.length > 0) {
                                                for (const proc of procedures) {
                                                  const regInstrument = (proc.registration_instrument || '').toString().trim();
                                                  const cbo = (proc.cbo || proc.professional_cbo || '').toString().trim();

                                                  // 🎯 REGRA SIMPLIFICADA: Procedimento principal = CONTÉM "03" no instrumento de registro
                                                  // Exemplos que passam:
                                                  // - "03 - AIH (Proc. Principal)" ✅
                                                  // - "02 - BPA (Individualizado) / 03 - AIH (Proc. Principal)" ✅
                                                  // - "03" ✅
                                                  // - Qualquer variação com "03" ✅
                                                  const isMainProcedure = regInstrument.includes('03');

                                                  // Verificar se NÃO é anestesista
                                                  const isNotAnesthetist = cbo !== '225151';

                                                  // 🔍 DEBUG detalhado
                                                  if (isMainProcedure) {
                                                    const procCode = proc.procedure_code || '';
                                                    console.log(`📋 [FILTRO] ${procCode} | Reg: "${regInstrument}" | CBO: "${cbo}" | PassaFiltro: ${isNotAnesthetist}`);
                                                  }

                                                  // Se passar no filtro, pegar este procedimento e parar
                                                  if (isMainProcedure && isNotAnesthetist) {
                                                    totalProcsFiltered++;
                                                    const procCodeRaw = proc.procedure_code || '';
                                                    const procCode = procCodeRaw.replace(/[.\-]/g, '');
                                                    const procDesc = (proc.procedure_description || proc.sigtap_description || '-').toString();

                                                    mainProcedure = {
                                                      code: procCode,
                                                      description: procDesc.substring(0, 60)
                                                    };

                                                    console.log(`✅ [PROTOCOLO] Primeiro procedimento encontrado: ${procCode} - ${patientName} (Reg: ${regInstrument})`);
                                                    break; // Pegar apenas o primeiro
                                                  }
                                                }
                                              }

                                              // 🔧 CORREÇÃO CRÍTICA: SEMPRE adicionar AIH ao relatório
                                              // Mesmo que não tenha procedimento principal válido
                                              protocolData.push([
                                                idx++,
                                                medicalRecord,
                                                patientName,
                                                mainProcedure?.code || '-',                    // Se não encontrou, mostrar "-"
                                                mainProcedure?.description || 'Sem proc. principal', // Se não encontrou, mensagem clara
                                                dischargeLabel
                                              ]);

                                              if (!mainProcedure) {
                                                aihsWithoutMainProcedure++;
                                                console.log(`⚠️ [PROTOCOLO] AIH sem procedimento principal: ${patientName} - incluída mesmo assim`);
                                              }
                                            });

                                            console.log(`📋 [PROTOCOLO] Total de procedimentos encontrados: ${totalProcsFound}`);
                                            console.log(`📋 [PROTOCOLO] Total após filtro (contém "03" + CBO ≠ 225151): ${totalProcsFiltered}`);
                                            console.log(`📋 [PROTOCOLO] Total de AIHs no relatório: ${protocolData.length}`);
                                            console.log(`📋 [PROTOCOLO] AIHs sem procedimento principal: ${aihsWithoutMainProcedure}`);

                                            // Ordenar por data de alta (mais antiga primeiro)
                                            protocolData.sort((a, b) => {
                                              const dateA = a[5] as string; // Data Alta na posição 5
                                              const dateB = b[5] as string;

                                              if (!dateA && !dateB) return 0;
                                              if (!dateA) return 1;
                                              if (!dateB) return -1;

                                              const parseDate = (dateStr: string) => {
                                                const parts = dateStr.split('/');
                                                if (parts.length === 3) {
                                                  return new Date(parseInt(parts[2]), parseInt(parts[1]) - 1, parseInt(parts[0]));
                                                }
                                                return new Date(0);
                                              };

                                              const parsedDateA = parseDate(dateA);
                                              const parsedDateB = parseDate(dateB);

                                              return parsedDateA.getTime() - parsedDateB.getTime(); // Mais antigo primeiro
                                            });

                                            // Renumerar após ordenação
                                            protocolData.forEach((row, index) => {
                                              row[0] = index + 1;
                                            });

                                            // Criar PDF com orientação paisagem para mais espaço
                                            const doc = new jsPDF('landscape');
                                            const pageWidth = doc.internal.pageSize.getWidth();
                                            // Fonte do relatório (topo)
                                            try {
                                              const sourceLabel = useSihSource ? 'TABWIN' : 'GSUS';
                                              doc.setFontSize(10);
                                              doc.setFont('helvetica', 'bold');
                                              doc.setTextColor(80, 80, 80);
                                              doc.text(sourceLabel, pageWidth - 20, 10, { align: 'right' });
                                            } catch { }

                                            // ========================================
                                            // CABEÇALHO PROFISSIONAL COM LOGO
                                            // ========================================

                                            // Inserir Logo CIS (se carregado)
                                            if (logoBase64) {
                                              // Dimensões profissionais: 40mm de largura (≈151 pixels) mantendo proporção
                                              const logoWidth = 40;
                                              const logoHeight = 20; // Ajuste conforme proporção da imagem
                                              const logoX = 20; // Margem esquerda
                                              const logoY = 8;  // Topo

                                              doc.addImage(logoBase64, 'JPEG', logoX, logoY, logoWidth, logoHeight);
                                            }

                                            // Título do Documento (centralizado)
                                            doc.setFontSize(16);
                                            doc.setFont('helvetica', 'bold');
                                            doc.setTextColor(0, 51, 102); // Azul institucional
                                            doc.text('PROTOCOLO DE ATENDIMENTO APROVADO', pageWidth / 2, 18, { align: 'center' });

                                            // Subtítulo
                                            doc.setFontSize(10);
                                            doc.setFont('helvetica', 'normal');
                                            doc.setTextColor(60, 60, 60);
                                            doc.text('CIS - Centro Integrado em Saúde', pageWidth / 2, 25, { align: 'center' });

                                            // Linha divisória profissional
                                            doc.setDrawColor(0, 51, 102);
                                            doc.setLineWidth(1);
                                            doc.line(20, 32, pageWidth - 20, 32);

                                            // Informações do protocolo em layout organizado
                                            doc.setFontSize(9);
                                            doc.setFont('helvetica', 'bold');
                                            doc.setTextColor(40, 40, 40);

                                            // Coluna Esquerda
                                            doc.text('Médico Responsável:', 20, 40);
                                            doc.setFont('helvetica', 'normal');
                                            doc.text(doctorName, 60, 40);

                                            doc.setFont('helvetica', 'bold');
                                            doc.text('Instituição:', 20, 46);
                                            doc.setFont('helvetica', 'normal');
                                            doc.text(hospitalName, 60, 46);

                                            doc.setFont('helvetica', 'bold');
                                            doc.text('Competência:', 20, 52);
                                            doc.setFont('helvetica', 'normal');
                                            doc.setTextColor(0, 51, 153); // Azul
                                            doc.text(competenciaLabel, 60, 52);

                                            // Coluna Direita
                                            doc.setTextColor(40, 40, 40); // Resetar cor
                                            doc.setFont('helvetica', 'bold');
                                            doc.text('Data de Emissão:', pageWidth - 110, 40);
                                            doc.setFont('helvetica', 'normal');
                                            doc.text(formatDateFns(new Date(), 'dd/MM/yyyy HH:mm'), pageWidth - 60, 40);

                                            doc.setFont('helvetica', 'bold');
                                            doc.text('Total de Atendimentos:', pageWidth - 110, 46);
                                            doc.setFont('helvetica', 'bold');
                                            doc.setTextColor(0, 102, 51); // Verde
                                            doc.text(protocolData.length.toString(), pageWidth - 35, 46);

                                            // ========================================
                                            // TABELA DE ATENDIMENTOS
                                            // ========================================

                                            autoTable(doc, {
                                              startY: 60,
                                              head: [[
                                                '#',
                                                'Prontuário',
                                                'Nome do Paciente',
                                                'Código',
                                                'Descrição do Procedimento',
                                                'Data Alta'
                                              ]],
                                              body: protocolData,
                                              styles: {
                                                fontSize: 8,
                                                cellPadding: 2,
                                                lineColor: [220, 220, 220],
                                                lineWidth: 0.1,
                                              },
                                              headStyles: {
                                                fillColor: [0, 51, 102], // Azul institucional
                                                textColor: [255, 255, 255],
                                                fontStyle: 'bold',
                                                halign: 'center',
                                                fontSize: 8,
                                              },
                                              columnStyles: {
                                                0: { cellWidth: 10, halign: 'center' },     // #
                                                1: { cellWidth: 22, halign: 'center' },     // Prontuário
                                                2: { cellWidth: 65, halign: 'left' },       // Nome (aumentado +5)
                                                3: { cellWidth: 28, halign: 'center' },     // Código
                                                4: { cellWidth: 115, halign: 'left' },      // Descrição (aumentado +20)
                                                5: { cellWidth: 24, halign: 'center' }      // Data Alta
                                              },
                                              alternateRowStyles: {
                                                fillColor: [248, 248, 248]
                                              },
                                              margin: { left: 15, right: 15 }
                                            });

                                            // ========================================
                                            // RODAPÉ PROFISSIONAL
                                            // ========================================

                                            const pageCount = (doc as any).internal.getNumberOfPages();
                                            for (let i = 1; i <= pageCount; i++) {
                                              doc.setPage(i);

                                              const pageHeight = doc.internal.pageSize.getHeight();

                                              // Linha superior do rodapé
                                              doc.setDrawColor(200, 200, 200);
                                              doc.setLineWidth(0.3);
                                              doc.line(20, pageHeight - 18, pageWidth - 20, pageHeight - 18);

                                              // Texto do rodapé
                                              doc.setFontSize(7);
                                              doc.setTextColor(100, 100, 100);
                                              doc.setFont('helvetica', 'normal');
                                              doc.text(
                                                'CIS - Centro Integrado em Saúde | Protocolo de Atendimento Aprovado',
                                                20,
                                                pageHeight - 12
                                              );

                                              // Número da página
                                              doc.setFont('helvetica', 'bold');
                                              doc.text(
                                                `Página ${i} de ${pageCount}`,
                                                pageWidth - 20,
                                                pageHeight - 12,
                                                { align: 'right' }
                                              );
                                            }

                                            // Salvar PDF
                                            const fileName = `Protocolo_Atendimento_Aprovado_${doctorName.replace(/\s+/g, '_')}_${formatDateFns(new Date(), 'yyyyMMdd_HHmm')}.pdf`;
                                            doc.save(fileName);

                                            console.log(`✅ [PROTOCOLO] Gerado: ${fileName} - ${protocolData.length} atendimentos`);

                                            // Notificação informativa
                                            if (aihsWithoutMainProcedure > 0) {
                                              toast.success(`Protocolo gerado! ${protocolData.length} atendimento(s). ${aihsWithoutMainProcedure} sem proc. principal (incluídos com "-").`);
                                            } else {
                                              toast.success(`Protocolo de Atendimento Aprovado gerado! ${protocolData.length} atendimento(s) registrado(s).`);
                                            }
                                          } catch (err) {
                                            console.error('❌ [PROTOCOLO] Erro ao gerar:', err);
                                            toast.error('Erro ao gerar protocolo de atendimento');
                                          }
                                        }}
                                        className="inline-flex items-center gap-2 bg-black hover:bg-neutral-800 text-white shadow-sm h-9 px-3 rounded-md text-sm w-auto min-w-[200px]"
                                      >
                                        <FileText className="h-4 w-4" />
                                        Protocolo de Atendimento Aprovado
                                      </Button>

                                      {/* ✅ NOVO: PROTOCOLO DE ATENDIMENTO ATUAL */}
                                      <Button
                                        type="button"
                                        onClick={async (e) => {
                                          e.stopPropagation();
                                          try {
                                            // 🖼️ Carregar logo do CIS
                                            let logoBase64 = null;
                                            try {
                                              const response = await fetch('/CIS Sem fundo.jpg');
                                              const blob = await response.blob();
                                              logoBase64 = await new Promise<string>((resolve) => {
                                                const reader = new FileReader();
                                                reader.onloadend = () => resolve(reader.result as string);
                                                reader.readAsDataURL(blob);
                                              });
                                            } catch (error) {
                                              console.error('⚠️ [PROTOCOLO ATUAL] Erro ao carregar logo:', error);
                                            }

                                            const doctorName = doctor.doctor_info?.name || 'Médico';
                                            const hospitalName = doctor.hospitals?.[0]?.hospital_name || 'Hospital';
                                            const competenciaLabel = selectedCompetencia && selectedCompetencia !== 'all'
                                              ? formatCompetencia(selectedCompetencia)
                                              : 'Todas as competências';

                                            console.log(`📋 [PROTOCOLO ATUAL] Gerando protocolo para ${doctorName}`);
                                            console.log(`📋 [PROTOCOLO ATUAL] Competência: ${competenciaLabel}`);

                                            // ✅ LÓGICA ESPECÍFICA: Filtrar apenas pacientes cujo mês de alta = mês da competência
                                            const protocolData: any[] = [];
                                            let idx = 1;
                                            let totalPatientsProcessed = 0;
                                            let patientsIncluded = 0;
                                            let patientsExcluded = 0;
                                            let aihsWithoutMainProcedure = 0;

                                            // Extrair ano e mês da competência selecionada
                                            let competenciaYear: number | null = null;
                                            let competenciaMonth: number | null = null;

                                            if (selectedCompetencia && selectedCompetencia !== 'all') {
                                              const match = selectedCompetencia.match(/^(\d{4})-(\d{2})/);
                                              if (match) {
                                                competenciaYear = parseInt(match[1]);
                                                competenciaMonth = parseInt(match[2]);
                                                console.log(`📅 [PROTOCOLO ATUAL] Filtro: Ano=${competenciaYear}, Mês=${competenciaMonth}`);
                                              }
                                            }

                                            (doctor.patients || []).forEach((p: any) => {
                                              totalPatientsProcessed++;

                                              const dischargeISO = p?.aih_info?.discharge_date || '';

                                              // 🔍 FILTRO CRÍTICO: Verificar se o mês de alta = mês da competência
                                              if (competenciaYear !== null && competenciaMonth !== null && dischargeISO) {
                                                const dischargeMatch = dischargeISO.match(/^(\d{4})-(\d{2})-(\d{2})/);
                                                if (dischargeMatch) {
                                                  const dischargeYear = parseInt(dischargeMatch[1]);
                                                  const dischargeMonth = parseInt(dischargeMatch[2]);

                                                  // Se mês/ano de alta DIFERENTE da competência, EXCLUIR
                                                  if (dischargeYear !== competenciaYear || dischargeMonth !== competenciaMonth) {
                                                    console.log(`⏭️ [PROTOCOLO ATUAL] Excluindo: ${p.patient_info?.name} - Alta: ${dischargeMonth}/${dischargeYear}, Competência: ${competenciaMonth}/${competenciaYear}`);
                                                    patientsExcluded++;
                                                    return; // Pular este paciente
                                                  }
                                                }
                                              }

                                              patientsIncluded++;

                                              const patientName = p.patient_info?.name || 'Paciente';
                                              const medicalRecord = p.patient_info?.medical_record || '-';
                                              const dischargeLabel = parseISODateToLocal(dischargeISO);

                                              // Buscar procedimento principal (mesma lógica do Protocolo de Atendimento Aprovado)
                                              const procedures = p.procedures || [];
                                              let mainProcedure = null;

                                              if (procedures.length > 0) {
                                                for (const proc of procedures) {
                                                  const regInstrument = (proc.registration_instrument || '').toString().trim();
                                                  const cbo = (proc.cbo || proc.professional_cbo || '').toString().trim();

                                                  const isMainProcedure = regInstrument.includes('03');
                                                  const isNotAnesthetist = cbo !== '225151';

                                                  if (isMainProcedure && isNotAnesthetist) {
                                                    const procCodeRaw = proc.procedure_code || '';
                                                    const procCode = procCodeRaw.replace(/[.\-]/g, '');
                                                    const procDesc = (proc.procedure_description || proc.sigtap_description || '-').toString();

                                                    mainProcedure = {
                                                      code: procCode,
                                                      description: procDesc.substring(0, 60)
                                                    };
                                                    break;
                                                  }
                                                }
                                              }

                                              // Adicionar ao relatório
                                              protocolData.push([
                                                idx++,
                                                medicalRecord,
                                                patientName,
                                                mainProcedure?.code || '-',
                                                mainProcedure?.description || 'Sem proc. principal',
                                                dischargeLabel
                                              ]);

                                              if (!mainProcedure) {
                                                aihsWithoutMainProcedure++;
                                              }
                                            });

                                            console.log(`📋 [PROTOCOLO ATUAL] Total de pacientes processados: ${totalPatientsProcessed}`);
                                            console.log(`📋 [PROTOCOLO ATUAL] Pacientes incluídos (alta na competência): ${patientsIncluded}`);
                                            console.log(`📋 [PROTOCOLO ATUAL] Pacientes excluídos (alta em outro mês): ${patientsExcluded}`);
                                            console.log(`📋 [PROTOCOLO ATUAL] AIHs sem procedimento principal: ${aihsWithoutMainProcedure}`);

                                            // Ordenar por data de alta (mais antiga primeiro)
                                            protocolData.sort((a, b) => {
                                              const dateA = a[5] as string;
                                              const dateB = b[5] as string;

                                              if (!dateA && !dateB) return 0;
                                              if (!dateA) return 1;
                                              if (!dateB) return -1;

                                              const parseDate = (dateStr: string) => {
                                                const parts = dateStr.split('/');
                                                if (parts.length === 3) {
                                                  return new Date(parseInt(parts[2]), parseInt(parts[1]) - 1, parseInt(parts[0]));
                                                }
                                                return new Date(0);
                                              };

                                              const parsedDateA = parseDate(dateA);
                                              const parsedDateB = parseDate(dateB);

                                              return parsedDateA.getTime() - parsedDateB.getTime();
                                            });

                                            // Renumerar após ordenação
                                            protocolData.forEach((row, index) => {
                                              row[0] = index + 1;
                                            });

                                            // Criar PDF
                                            const doc = new jsPDF('landscape');
                                            const pageWidth = doc.internal.pageSize.getWidth();
                                            // Fonte do relatório (topo)
                                            try {
                                              const sourceLabel = useSihSource ? 'TABWIN' : 'GSUS';
                                              doc.setFontSize(10);
                                              doc.setFont('helvetica', 'bold');
                                              doc.setTextColor(80, 80, 80);
                                              doc.text(sourceLabel, pageWidth - 20, 10, { align: 'right' });
                                            } catch { }

                                            // Logo
                                            if (logoBase64) {
                                              const logoWidth = 40;
                                              const logoHeight = 20;
                                              const logoX = 20;
                                              const logoY = 8;
                                              doc.addImage(logoBase64, 'JPEG', logoX, logoY, logoWidth, logoHeight);
                                            }

                                            // Título
                                            doc.setFontSize(16);
                                            doc.setFont('helvetica', 'bold');
                                            doc.setTextColor(0, 51, 102);
                                            doc.text('PROTOCOLO DE ATENDIMENTO ATUAL', pageWidth / 2, 18, { align: 'center' });

                                            // Subtítulo
                                            doc.setFontSize(10);
                                            doc.setFont('helvetica', 'normal');
                                            doc.setTextColor(60, 60, 60);
                                            doc.text('CIS - Centro Integrado em Saúde', pageWidth / 2, 25, { align: 'center' });

                                            // Linha divisória
                                            doc.setDrawColor(0, 51, 102);
                                            doc.setLineWidth(1);
                                            doc.line(20, 32, pageWidth - 20, 32);

                                            // Informações do protocolo
                                            doc.setFontSize(9);
                                            doc.setFont('helvetica', 'bold');
                                            doc.setTextColor(40, 40, 40);

                                            doc.text('Médico Responsável:', 20, 40);
                                            doc.setFont('helvetica', 'normal');
                                            doc.text(doctorName, 60, 40);

                                            doc.setFont('helvetica', 'bold');
                                            doc.text('Instituição:', 20, 46);
                                            doc.setFont('helvetica', 'normal');
                                            doc.text(hospitalName, 60, 46);

                                            doc.setFont('helvetica', 'bold');
                                            doc.text('Competência:', 20, 52);
                                            doc.setFont('helvetica', 'normal');
                                            doc.setTextColor(0, 51, 153);
                                            doc.text(competenciaLabel, 60, 52);

                                            // Coluna Direita
                                            doc.setTextColor(40, 40, 40);
                                            doc.setFont('helvetica', 'bold');
                                            doc.text('Data de Emissão:', pageWidth - 110, 40);
                                            doc.setFont('helvetica', 'normal');
                                            doc.text(formatDateFns(new Date(), 'dd/MM/yyyy HH:mm'), pageWidth - 60, 40);

                                            doc.setFont('helvetica', 'bold');
                                            doc.text('Total de Atendimentos:', pageWidth - 110, 46);
                                            doc.setFont('helvetica', 'bold');
                                            doc.setTextColor(0, 102, 51);
                                            doc.text(protocolData.length.toString(), pageWidth - 35, 46);

                                            // ✅ NOVO: Destacar critério de filtro
                                            doc.setTextColor(204, 0, 0); // Vermelho
                                            doc.setFont('helvetica', 'bold');
                                            doc.setFontSize(8);
                                            doc.text('* Alta na competência atual', pageWidth - 110, 52);

                                            // Tabela
                                            autoTable(doc, {
                                              startY: 60,
                                              head: [[
                                                '#',
                                                'Prontuário',
                                                'Nome do Paciente',
                                                'Código',
                                                'Descrição do Procedimento',
                                                'Data Alta'
                                              ]],
                                              body: protocolData,
                                              styles: {
                                                fontSize: 8,
                                                cellPadding: 2,
                                                lineColor: [220, 220, 220],
                                                lineWidth: 0.1,
                                              },
                                              headStyles: {
                                                fillColor: [0, 51, 102],
                                                textColor: [255, 255, 255],
                                                fontStyle: 'bold',
                                                halign: 'center',
                                                fontSize: 8,
                                              },
                                              columnStyles: {
                                                0: { cellWidth: 10, halign: 'center' },
                                                1: { cellWidth: 22, halign: 'center' },
                                                2: { cellWidth: 65, halign: 'left' },
                                                3: { cellWidth: 28, halign: 'center' },
                                                4: { cellWidth: 115, halign: 'left' },
                                                5: { cellWidth: 24, halign: 'center' }
                                              },
                                              alternateRowStyles: {
                                                fillColor: [248, 248, 248]
                                              },
                                              margin: { left: 15, right: 15 }
                                            });

                                            // Rodapé
                                            const pageCount = (doc as any).internal.getNumberOfPages();
                                            for (let i = 1; i <= pageCount; i++) {
                                              doc.setPage(i);
                                              const pageHeight = doc.internal.pageSize.getHeight();

                                              doc.setDrawColor(200, 200, 200);
                                              doc.setLineWidth(0.3);
                                              doc.line(20, pageHeight - 18, pageWidth - 20, pageHeight - 18);

                                              doc.setFontSize(7);
                                              doc.setTextColor(100, 100, 100);
                                              doc.setFont('helvetica', 'normal');
                                              doc.text(
                                                'CIS - Centro Integrado em Saúde | Protocolo de Atendimento Atual',
                                                20,
                                                pageHeight - 12
                                              );

                                              doc.setFont('helvetica', 'bold');
                                              doc.text(
                                                `Página ${i} de ${pageCount}`,
                                                pageWidth - 20,
                                                pageHeight - 12,
                                                { align: 'right' }
                                              );
                                            }

                                            // Salvar PDF
                                            const fileName = `Protocolo_Atendimento_Atual_${doctorName.replace(/\s+/g, '_')}_${formatDateFns(new Date(), 'yyyyMMdd_HHmm')}.pdf`;
                                            doc.save(fileName);

                                            console.log(`✅ [PROTOCOLO ATUAL] Gerado: ${fileName}`);

                                            // Toast
                                            if (patientsExcluded > 0) {
                                              toast.success(`Protocolo Atual gerado! ${protocolData.length} atendimento(s) com alta na competência. ${patientsExcluded} excluído(s) (alta em outro mês).`);
                                            } else {
                                              toast.success(`Protocolo de Atendimento Atual gerado! ${protocolData.length} atendimento(s) registrado(s).`);
                                            }
                                          } catch (err) {
                                            console.error('❌ [PROTOCOLO ATUAL] Erro ao gerar:', err);
                                            toast.error('Erro ao gerar protocolo de atendimento atual');
                                          }
                                        }}
                                        className="inline-flex items-center gap-2 bg-black hover:bg-neutral-800 text-white shadow-sm h-9 px-3 rounded-md text-sm w-auto min-w-[200px]"
                                      >
                                        <FileText className="h-4 w-4" />
                                        Protocolo Atendimento Atual
                                      </Button>
                                    </>)}
                                  </div>
                                </div>
                              </div>
                            </CollapsibleTrigger>

                            {/* ✅ LISTA DE PACIENTES - DESIGN SOFISTICADO */}
                            <CollapsibleContent>
                              <div className="px-6 pb-6">
                                <div className="border-t border-slate-200/60 pt-6">
                                  <div className="flex items-center justify-between mb-5">
                                    <h4 className="text-base font-semibold text-slate-800 flex items-center gap-3">
                                      <div className="w-7 h-7 bg-[#0b1736] rounded-xl flex items-center justify-center">
                                        <User className="h-4 w-4 text-white" />
                                      </div>
                                      Pacientes Atendidos ({(() => {
                                        const doctorKey = doctor.doctor_info.cns;
                                        const nameTerm = (localPatientSearchTerm.get(doctorKey) || '').toLowerCase().trim();
                                        const procTermRaw = (procedureSearchTerm.get(doctorKey) || '').toLowerCase().trim();
                                        const procTerm = procTermRaw.replace(/[\.\s]/g, '');
                                        const filteredCount = doctor.patients.filter(patient => {
                                          const matchesName = !nameTerm || (patient.patient_info.name || '').toLowerCase().includes(nameTerm);
                                          const matchesProc = !procTermRaw || (patient.procedures || []).some(proc => {
                                            const codeNorm = (proc.procedure_code || '').toLowerCase().replace(/[\.\s]/g, '');
                                            const desc = (proc.procedure_description || '').toLowerCase();
                                            return codeNorm.includes(procTerm) || desc.includes(procTermRaw);
                                          });
                                          // ✅ SIMPLIFICADO: Sem filtros de data (apenas competência)
                                          return matchesName && matchesProc;
                                        }).length;
                                        return nameTerm || procTermRaw ? `${filteredCount} de ${doctor.patients.length}` : filteredCount;
                                      })()})
                                    </h4>

                                    <div className="flex items-center gap-3">
                                      {/* Campo de busca */}
                                      <div className="relative">
                                        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                                        <Input
                                          placeholder="Buscar paciente..."
                                          value={localPatientSearchTerm.get(doctor.doctor_info.cns) || ''}
                                          onChange={(e) => {
                                            const newSearchTerms = new Map(localPatientSearchTerm);
                                            newSearchTerms.set(doctor.doctor_info.cns, e.target.value);
                                            setLocalPatientSearchTerm(newSearchTerms);
                                            // Reset para primeira página ao buscar
                                            const newPages = new Map(currentPatientPage);
                                            newPages.set(doctor.doctor_info.cns, 1);
                                            setCurrentPatientPage(newPages);
                                          }}
                                          className="pl-10 w-64"
                                        />
                                      </div>
                                      {/* Filtro de procedimento (código ou descrição) */}
                                      <div className="relative">
                                        <FileText className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                                        <Input
                                          placeholder="Buscar procedimento (código ou descrição)..."
                                          value={procedureSearchTerm.get(doctor.doctor_info.cns) || ''}
                                          onChange={(e) => {
                                            const newTerms = new Map(procedureSearchTerm);
                                            newTerms.set(doctor.doctor_info.cns, e.target.value);
                                            setProcedureSearchTerm(newTerms);
                                            // Reset para primeira página ao buscar
                                            const newPages = new Map(currentPatientPage);
                                            newPages.set(doctor.doctor_info.cns, 1);
                                            setCurrentPatientPage(newPages);
                                          }}
                                          className="pl-10 w-96"
                                        />
                                      </div>
                                      {/* Botão global movido para o cabeçalho superior */}

                                      {/* Paginação do header removida para dar espaço aos filtros */}
                                    </div>
                                  </div>

                                  <div className="space-y-4">
                                    {(() => {
                                      const doctorKey = doctor.doctor_info.cns;
                                      const nameTerm = (localPatientSearchTerm.get(doctorKey) || '').toLowerCase().trim();
                                      const procTermRaw = (procedureSearchTerm.get(doctorKey) || '').toLowerCase().trim();
                                      const procTerm = procTermRaw.replace(/[\.\s]/g, '');
                                      const filteredPatients = doctor.patients.filter(patient => {
                                        const matchesName = !nameTerm || (patient.patient_info.name || '').toLowerCase().includes(nameTerm);
                                        const matchesProc = !procTermRaw || (patient.procedures || []).some(proc => {
                                          const codeNorm = (proc.procedure_code || '').toLowerCase().replace(/[\.\s]/g, '');
                                          const desc = (proc.procedure_description || '').toLowerCase();
                                          return codeNorm.includes(procTerm) || desc.includes(procTermRaw);
                                        });
                                        // ✅ SIMPLIFICADO: Sem filtros de data (apenas competência)
                                        return matchesName && matchesProc;
                                      });
                                      // Ordenar por data mais recente primeiro (Alta SUS; fallback para Admissão)
                                      const sortedPatients = [...filteredPatients].sort((a, b) => {
                                        const aDate = new Date(a.aih_info.discharge_date || a.aih_info.admission_date);
                                        const bDate = new Date(b.aih_info.discharge_date || b.aih_info.admission_date);
                                        return bDate.getTime() - aDate.getTime();
                                      });
                                      const currentPage = currentPatientPage.get(doctorKey) || 1;
                                      const startIndex = (currentPage - 1) * PATIENTS_PER_PAGE;
                                      const endIndex = startIndex + PATIENTS_PER_PAGE;
                                      const paginatedPatients = sortedPatients.slice(startIndex, endIndex);
                                      const totalPages = Math.ceil(filteredPatients.length / PATIENTS_PER_PAGE);

                                      return (
                                        <>
                                          {paginatedPatients.length === 0 && searchTerm ? (
                                            <div className="text-center py-8 text-slate-500">
                                              <Search className="h-8 w-8 mx-auto mb-3 text-slate-300" />
                                              <div className="text-sm">Nenhum paciente encontrado para "{searchTerm}"</div>
                                            </div>
                                          ) : paginatedPatients.length === 0 ? (
                                            <div className="text-center py-8 text-slate-500">
                                              <User className="h-8 w-8 mx-auto mb-3 text-slate-300" />
                                              <div className="text-sm">Nenhum paciente encontrado</div>
                                            </div>
                                          ) : null}

                                          {/* 🚀 PRÉ-CALCULAR VALORES DOS PACIENTES PARA ESTABILIDADE */}
                                          {(() => {
                                            // ✅ Calcular valores para evitar recálculo durante expansão
                                            const hospitalId = doctor.hospitals?.[0]?.hospital_id;

                                            const enrichedPatients = paginatedPatients.map((patient, idx) => {
                                              // ✅ CORREÇÃO: Chave estável e única por AIH/paciente
                                              const keySuffix = (
                                                patient.aih_id ||
                                                (patient as any)?.aih_info?.aih_number ||
                                                `${patient.patient_info.cns || 'NO_CNS'}-${(patient as any)?.aih_info?.admission_date || 'NO_DATE'}-${idx}`
                                              );
                                              const patientKey = `${doctor.doctor_info.cns}-${keySuffix}`;

                                              // Calcular AIH Seca (estável)
                                              const baseAih = typeof (patient as any).total_value_reais === 'number'
                                                ? (patient as any).total_value_reais
                                                : sumProceduresBaseReais(patient.procedures as any);

                                              // Calcular Incremento (estável)
                                              const careCharacter = (patient as any)?.aih_info?.care_character;
                                              const doctorCovered = isDoctorCoveredForOperaParana(
                                                doctor.doctor_info.name,
                                                hospitalId
                                              );
                                              const increment = doctorCovered
                                                ? computeIncrementForProcedures(
                                                  patient.procedures as any,
                                                  careCharacter,
                                                  doctor.doctor_info.name,
                                                  hospitalId
                                                )
                                                : 0;

                                              // Calcular Repasse Médico (estável)
                                              const fixedCalc = calculateFixedPayment(doctor.doctor_info.name, hospitalId);
                                              const hasIndividualRules = hasIndividualPaymentRules(
                                                doctor.doctor_info.name,
                                                hospitalId
                                              );
                                              const isMonthlyFixed = isFixedMonthlyPayment(
                                                doctor.doctor_info.name,
                                                hospitalId,
                                                ALL_HOSPITAL_RULES
                                              );

                                              let totalPayment = 0;
                                              let showRepasseCard = false;

                                              if (fixedCalc.hasFixedRule && !hasIndividualRules) {
                                                showRepasseCard = false;
                                              } else if (isMonthlyFixed) {
                                                showRepasseCard = false;
                                              } else {
                                                // ✅ CORREÇÃO: Usar MESMO filtro do relatório e stats (04.xxx + anestesista)
                                                // ✅ CORREÇÃO 2: Ordenar procedimentos por sequence e valor (igual ao relatório)
                                                const aihKey = (patient as any).aih_id || normalizeAihNumber((patient as any)?.aih_info?.aih_number) || '__single__'
                                                const baseProcedures = (patient as any).calculable_procedures || getCalculableProcedures(
                                                  ((patient.procedures || []) as any[]).map((proc: any) => ({
                                                    ...proc,
                                                    aih_id: proc.aih_id || aihKey,
                                                    sequence: proc.sequence ?? proc.sequencia ?? proc.procedure_sequence
                                                  }))
                                                )
                                                const proceduresWithPayment = (baseProcedures as any[])
                                                  .filter((proc: any) => isMedicalProcedure(proc.procedure_code))
                                                  .sort((a: any, b: any) => {
                                                    // Ordenar por sequence primeiro, depois por valor (decrescente)
                                                    const sa = typeof a.sequence === 'number' ? a.sequence : 9999;
                                                    const sb = typeof b.sequence === 'number' ? b.sequence : 9999;
                                                    if (sa !== sb) return sa - sb;
                                                    const va = typeof a.value_reais === 'number' ? a.value_reais : 0;
                                                    const vb = typeof b.value_reais === 'number' ? b.value_reais : 0;
                                                    return vb - va;
                                                  })
                                                  .map((proc: any) => ({
                                                    procedure_code: proc.procedure_code,
                                                    procedure_description: proc.procedure_description,
                                                    value_reais: proc.value_reais || 0,
                                                    cbo: proc.cbo,
                                                    sequence: proc.sequence,
                                                  }));

                                                // ✅ CORREÇÃO: Usar MESMA lógica do relatório para isGenSurg
                                                const isGenSurg2 = /cirurg/i.test(doctor.doctor_info.name || '') || (/cirurg/i.test(doctor.doctor_info.specialty || '') && /geral/i.test(doctor.doctor_info.specialty || ''))
                                                const useHon2 = shouldUseHonForHospital(doctor.doctor_info.name, hospitalId, isGenSurg2)
                                                const paymentResult = useHon2
                                                  ? calculateHonPayments(proceduresWithPayment)
                                                  : calculateDoctorPayment(
                                                    doctor.doctor_info.name,
                                                    proceduresWithPayment,
                                                    hospitalId
                                                  );

                                                totalPayment = paymentResult.totalPayment || 0;
                                                showRepasseCard = totalPayment > 0;
                                              }

                                              return {
                                                ...patient,
                                                _enriched: {
                                                  patientKey,
                                                  baseAih,
                                                  increment,
                                                  hasIncrement: increment > 0,
                                                  withIncrement: baseAih + increment,
                                                  totalPayment,
                                                  showRepasseCard
                                                }
                                              };
                                            });

                                            return (
                                              <>
                                                {enrichedPatients.map((patient) => {
                                                  const patientKey = patient._enriched.patientKey;
                                                  const isPatientExpanded = expandedPatients.has(patientKey);

                                                  return (
                                                    <div key={patientKey} className="p-3 rounded-lg bg-white border border-slate-200 hover:bg-slate-50 transition-colors">
                                                      <Collapsible open={isPatientExpanded}>
                                                        <CollapsibleTrigger asChild>
                                                          {/* 👤 CARD DO PACIENTE - DESIGN LIMPO E OBJETIVO */}
                                                          <div
                                                            className="w-full cursor-pointer p-4 rounded-lg hover:bg-slate-50 border border-slate-200 transition-colors bg-white"
                                                            onClick={() => togglePatientExpansion(patientKey)}
                                                          >
                                                            {/* Ícone de expansão */}
                                                            <div className="flex items-center gap-2 mb-2">
                                                              {isPatientExpanded ? (
                                                                <ChevronDown className="h-4 w-4 text-slate-500 transition-transform duration-200" />
                                                              ) : (
                                                                <ChevronRight className="h-4 w-4 text-slate-500 transition-transform duration-200" />
                                                              )}
                                                              <span className="text-xs text-slate-500 font-medium">
                                                                {isPatientExpanded ? 'Clique para recolher' : 'Clique para expandir procedimentos'}
                                                              </span>
                                                            </div>

                                                            {/* NOME DO PACIENTE - DESTAQUE */}
                                                            <div className="mb-3 pb-3 border-b border-gray-100">
                                                              <div className="flex items-center justify-between">
                                                                <div className="flex items-center gap-2">
                                                                  <div className="flex items-center justify-center w-8 h-8 bg-[#0b1736] rounded-full">
                                                                    <User className="h-4 w-4 text-white" />
                                                                  </div>
                                                                  <div className="text-base font-bold text-gray-900">
                                                                    {(/procedimento/i.test(patient.patient_info.name) || /\b\d{2}\.\d{2}\.\d{2}\.\d{3}-\d\b/.test(patient.patient_info.name)) ? 'Nome não disponível' : patient.patient_info.name}
                                                                  </div>
                                                                </div>
                                                                <div className="flex items-center gap-2">
                                                                  {(() => {
                                                                    const selComp = selectedCompetencia && selectedCompetencia !== 'all' ? selectedCompetencia : String((patient.aih_info as any).competencia || '')
                                                                    const sm = selComp.match(/^(\d{4})-(\d{2})/) || selComp.match(/^([0-9]{4})([0-9]{2})$/)
                                                                    const selY = sm ? parseInt(sm[1], 10) : undefined
                                                                    const selM = sm ? parseInt(sm[2], 10) : undefined
                                                                    const disStr = String((patient.aih_info as any).discharge_date || '')
                                                                    const dm = disStr.match(/^(\d{4})-(\d{2})/)
                                                                    const disY = dm ? parseInt(dm[1], 10) : undefined
                                                                    const disM = dm ? parseInt(dm[2], 10) : undefined
                                                                    const mismatch = selY && selM && disY && disM && (selY !== disY || selM !== disM)
                                                                    const disLabel = disStr ? (() => { const m = disStr.match(/^(\d{4})-(\d{2})/); return m ? `${m[2]}/${m[1]}` : '-' })() : '-'
                                                                    const compLabel = formatCompetencia(selComp)
                                                                    const cls = mismatch ? 'bg-red-50 text-red-700 border-red-200' : 'bg-slate-100 text-slate-700 border-slate-200'
                                                                    return (
                                                                      <Badge variant="outline" className={`text-[10px] font-semibold ${cls}`}>
                                                                        {disLabel} | {compLabel}
                                                                      </Badge>
                                                                    )
                                                                  })()}
                                                                  <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200 text-[10px] font-semibold">
                                                                    {patient.procedures.length} PROC
                                                                  </Badge>
                                                                  {patient.aih_info.care_character && (() => {
                                                                    const raw = String(patient.aih_info.care_character || '').toLowerCase().trim();
                                                                    return (
                                                                      <Badge variant="outline" className={`text-[10px] font-semibold ${raw === '1' || raw.includes('eletivo')
                                                                        ? 'bg-emerald-50 border-emerald-200 text-emerald-700'
                                                                        : 'bg-amber-50 border-amber-200 text-amber-700'
                                                                        }`}>
                                                                        {CareCharacterUtils.formatForDisplay(
                                                                          typeof patient.aih_info.care_character === 'string'
                                                                            ? patient.aih_info.care_character.trim()
                                                                            : String(patient.aih_info.care_character),
                                                                          false
                                                                        )}
                                                                      </Badge>
                                                                    );
                                                                  })()}
                                                                  {patient.common_name && (
                                                                    <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200 text-[10px] px-2 py-0.5">
                                                                      {patient.common_name}
                                                                    </Badge>
                                                                  )}
                                                                </div>
                                                              </div>
                                                            </div>

                                                            {/* GRID PROFISSIONAL: Agrupado por contexto */}
                                                            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-3">
                                                              {/* Identificação */}
                                                              <div className="space-y-2">
                                                                <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wide underline decoration-slate-300 underline-offset-2">Identificação</div>
                                                                <div className="flex items-baseline gap-2">
                                                                  <span className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide">Nº AIH:</span>
                                                                  <span className="text-xs font-mono font-medium text-gray-900">{patient.aih_info.aih_number || '-'}</span>
                                                                </div>
                                                                {useSihSource && (
                                                                  <div className="flex items-baseline gap-2">
                                                                    <span className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide">Competência:</span>
                                                                    <span className="text-xs font-semibold text-blue-700">
                                                                      {(() => {
                                                                        const comp = (patient as any)?.aih_info?.competencia;
                                                                        if (!comp) return '-';
                                                                        const m = String(comp).match(/^(\d{4})-(\d{2})/);
                                                                        if (m) return `${m[2]}/${m[1]}`;
                                                                        return comp;
                                                                      })()}
                                                                    </span>
                                                                  </div>
                                                                )}
                                                                {patient.patient_info.medical_record && (
                                                                  <div className="flex items-baseline gap-2">
                                                                    <span className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide">Prontuário:</span>
                                                                    <span className="text-xs font-medium text-gray-900">{patient.patient_info.medical_record}</span>
                                                                  </div>
                                                                )}
                                                              </div>

                                                              {/* Internação */}
                                                              <div className="space-y-2">
                                                                <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wide underline decoration-slate-300 underline-offset-2">Internação</div>
                                                                <div className="flex items-baseline gap-2">
                                                                  <span className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide">Admissão:</span>
                                                                  <span className="text-xs font-medium text-gray-900">
                                                                    {patient.aih_info.admission_date ? (() => {
                                                                      const d = String(patient.aih_info.admission_date);
                                                                      const match = d.match(/^(\d{4})-(\d{2})-(\d{2})/);
                                                                      return match ? `${match[3]}/${match[2]}/${match[1]}` : d;
                                                                    })() : '-'}
                                                                  </span>
                                                                </div>
                                                                <div className="flex items-baseline gap-2">
                                                                  <span className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide">Alta:</span>
                                                                  <span className="text-xs font-medium text-gray-900">
                                                                    {patient.aih_info.discharge_date ? (() => {
                                                                      const d = String(patient.aih_info.discharge_date);
                                                                      const match = d.match(/^(\d{4})-(\d{2})-(\d{2})/);
                                                                      return match ? `${match[3]}/${match[2]}/${match[1]}` : d;
                                                                    })() : '-'}
                                                                  </span>
                                                                </div>
                                                                <div className="flex items-baseline gap-2">
                                                                  <span className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide">Caráter:</span>
                                                                  <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-[10px] border ${careBadgeClass((patient.aih_info as any).care_character)}`}>
                                                                    {formatCareCharacterLabel((patient.aih_info as any).care_character)}
                                                                  </span>
                                                                </div>
                                                                {(patient.aih_info as any).dias_perm !== undefined && (
                                                                  <div className="flex items-baseline gap-2">
                                                                    <span className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide">Permanência:</span>
                                                                    <span className="text-xs font-medium text-gray-900">{String((patient.aih_info as any).dias_perm)} dias</span>
                                                                  </div>
                                                                )}
                                                              </div>

                                                              {/* Clínico/Demografia */}
                                                              <div className="space-y-2">
                                                                <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wide underline decoration-slate-300 underline-offset-2">Clínico</div>
                                                                {(patient.aih_info as any).main_cid && (
                                                                  <div className="flex items-baseline gap-2">
                                                                    <span className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide">CID Principal:</span>
                                                                    <span className="text-xs font-medium text-gray-900">{(patient.aih_info as any).main_cid}</span>
                                                                  </div>
                                                                )}
                                                                {(patient.aih_info as any).specialty && (
                                                                  <div className="flex items-baseline gap-2">
                                                                    <span className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide">Especialidade:</span>
                                                                    <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] bg-violet-50 text-violet-700 border border-violet-200">
                                                                      {formatEspecialidade((patient.aih_info as any).specialty)}
                                                                    </span>
                                                                  </div>
                                                                )}
                                                                <div className="flex items-baseline gap-2">
                                                                  <span className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide">Nascimento:</span>
                                                                  <span className="text-xs font-medium text-gray-900">
                                                                    {patient.patient_info.birth_date ? (() => {
                                                                      const d = String(patient.patient_info.birth_date);
                                                                      const match = d.match(/^(\d{4})-(\d{2})-(\d{2})/);
                                                                      return match ? `${match[3]}/${match[2]}/${match[1]}` : d;
                                                                    })() : '-'}
                                                                  </span>
                                                                </div>
                                                                {typeof patient.patient_info.age === 'number' && (
                                                                  <div className="flex items-baseline gap-2">
                                                                    <span className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide">Idade:</span>
                                                                    <span className="text-xs font-medium text-gray-900">{patient.patient_info.age}</span>
                                                                  </div>
                                                                )}
                                                              </div>
                                                            </div>

                                                            {/* SEÇÃO DE VALORES - DESTAQUE ESPECIAL */}
                                                            {/* ✅ USAR VALORES PRÉ-CALCULADOS (MEMOIZADOS) */}
                                                            <div className="mt-3 pt-3 border-t-2 border-gray-200 space-y-2">
                                                              {/* AIH SECA - CAMPO MAIS IMPORTANTE */}
                                                              <div className="bg-white rounded-lg p-3 border-2 border-emerald-400">
                                                                <div className="flex items-center justify-between">
                                                                  <div className="flex items-center gap-2">
                                                                    <DollarSign className="h-4 w-4 text-black" />
                                                                    <span className="text-xs font-bold text-black uppercase tracking-wide">AIH Seca</span>
                                                                  </div>
                                                                  <span className="text-lg font-black text-black">
                                                                    {formatCurrency(patient.total_value_reais)}
                                                                  </span>
                                                                </div>
                                                              </div>

                                                              {/* INCREMENTO - SE HOUVER */}
                                                              {patient._enriched.hasIncrement && (
                                                                <>
                                                                  <div className="bg-white rounded-lg p-3 border-2 border-blue-400">
                                                                    <div className="flex items-center justify-between">
                                                                      <div className="flex items-center gap-2">
                                                                        <span className="text-lg">📈</span>
                                                                        <span className="text-xs font-bold text-black uppercase tracking-wide">Incremento</span>
                                                                      </div>
                                                                      <span className="text-lg font-black text-black">
                                                                        {formatCurrency(patient._enriched.increment)}
                                                                      </span>
                                                                    </div>
                                                                  </div>

                                                                  {/* AIH C/ INCREMENTO - TOTAL FINAL */}
                                                                  <div className="bg-white rounded-lg p-3 border-2 border-violet-400">
                                                                    <div className="flex items-center justify-between">
                                                                      <div className="flex items-center gap-2">
                                                                        <CheckCircle className="h-4 w-4 text-black" />
                                                                        <span className="text-xs font-bold text-black uppercase tracking-wide">AIH c/ Incremento</span>
                                                                      </div>
                                                                      <span className="text-lg font-black text-black">
                                                                        {formatCurrency(patient._enriched.withIncrement)}
                                                                      </span>
                                                                    </div>
                                                                  </div>
                                                                </>
                                                              )}

                                                              {/* PROCEDIMENTOS MÉDICOS (04) - OCULTO CONFORME SOLICITAÇÃO */}
                                                              {/* {medicalCount > 0 && (
                                                  <div className="bg-gradient-to-r from-orange-50 to-amber-50 rounded-lg p-2 border border-orange-200">
                                                    <div className="flex items-center justify-between">
                                                      <div className="flex items-center gap-2">
                                                        <div className="flex items-center justify-center w-5 h-5 bg-orange-100 rounded-full">
                                                          <span className="text-[10px] font-bold text-orange-700">04</span>
                                                        </div>
                                                        <span className="text-[10px] font-semibold text-orange-800 uppercase">Proc. Médicos ({medicalCount})</span>
                                                      </div>
                                                      <span className="text-sm font-bold text-orange-700">{formatCurrency(medicalValue)}</span>
                                                    </div>
                                                  </div>
                                                )} */}

                                                              {/* 💰 VALOR DE REPASSE PARA O MÉDICO */}
                                                              {/* ✅ USAR VALOR PRÉ-CALCULADO (MEMOIZADO) */}
                                                              {useSihSource && remoteConfigured ? (
                                                                <div className="bg-white rounded-lg p-3 border-2 border-blue-400">
                                                                  <div className="flex items-center justify-between">
                                                                    <div className="flex items-center gap-2">
                                                                      <Stethoscope className="h-4 w-4 text-black" />
                                                                      <span className="text-xs font-bold text-black uppercase tracking-wide">Valor Calculado</span>
                                                                    </div>
                                                                    <span className="text-lg font-black text-black">
                                                                      {formatCurrency(patient._enriched.totalPayment)}
                                                                    </span>
                                                                  </div>
                                                                </div>
                                                              ) : (
                                                                patient._enriched.showRepasseCard && (
                                                                  <div className="bg-white rounded-lg p-3 border-2 border-teal-400">
                                                                    <div className="flex items-center justify-between">
                                                                      <div className="flex items-center gap-2">
                                                                        <Stethoscope className="h-4 w-4 text-black" />
                                                                        <span className="text-xs font-bold text-black uppercase tracking-wide">Repasse Médico</span>
                                                                      </div>
                                                                      <span className="text-lg font-black text-black">
                                                                        {formatCurrency(patient._enriched.totalPayment)}
                                                                      </span>
                                                                    </div>
                                                                  </div>
                                                                )
                                                              )}
                                                            </div>
                                                          </div>
                                                        </CollapsibleTrigger>

                                                        {/* ✅ LISTA DE PROCEDIMENTOS */}
                                                        <CollapsibleContent>
                                                          <div className="mt-4 space-y-3">
                                                            <div className="flex items-center justify-between">
                                                              <h5 className="font-medium text-slate-700 flex items-center gap-2 text-sm">
                                                                <FileText className="h-4 w-4" />
                                                                Procedimentos Realizados
                                                              </h5>
                                                              <Badge variant="secondary" className="bg-slate-100 text-slate-700 text-xs border-slate-200">
                                                                {patient.procedures.length} procedimento(s)
                                                              </Badge>
                                                            </div>

                                                            {patient.procedures.length === 0 ? (
                                                              <div className="text-center py-8 text-slate-500">
                                                                <Activity className="h-8 w-8 mx-auto mb-3 text-slate-300" />
                                                                <div className="text-sm">Nenhum procedimento encontrado</div>
                                                              </div>
                                                            ) : (
                                                              <div className="space-y-3">
                                                                {patient.procedures
                                                                  .sort((a, b) => {
                                                                    // 1) Ordenar primeiro pela sequência (seq. 1, 2, 3...)
                                                                    const seqA = Number((a as any)?.sequence ?? (a as any)?.procedure_sequence ?? 0);
                                                                    const seqB = Number((b as any)?.sequence ?? (b as any)?.procedure_sequence ?? 0);
                                                                    const hasSeqA = Number.isFinite(seqA) && seqA > 0;
                                                                    const hasSeqB = Number.isFinite(seqB) && seqB > 0;
                                                                    if (hasSeqA && hasSeqB && seqA !== seqB) {
                                                                      return seqA - seqB; // ascendente por seq
                                                                    }
                                                                    if (hasSeqA && !hasSeqB) return -1;
                                                                    if (!hasSeqA && hasSeqB) return 1;
                                                                    // 2) Fallback: priorizar 04.xxx e depois por data desc
                                                                    const a04 = ((a?.procedure_code || '').toString().trim().startsWith('04')) ? 1 : 0;
                                                                    const b04 = ((b?.procedure_code || '').toString().trim().startsWith('04')) ? 1 : 0;
                                                                    if (a04 !== b04) return b04 - a04; // 04 primeiro
                                                                    const ad = new Date(a.procedure_date).getTime();
                                                                    const bd = new Date(b.procedure_date).getTime();
                                                                    return bd - ad; // depois por data desc
                                                                  })
                                                                  .map((procedure, procIndex) => {
                                                                    const careCharRaw = (patient as any)?.aih_info?.care_character;
                                                                    const careCharStr = typeof careCharRaw === 'string' ? careCharRaw.trim() : String(careCharRaw ?? '');
                                                                    const isMedical04 = !!(procedure?.procedure_code || '').toString().trim().startsWith('04');
                                                                    const isPrincipal = Number((procedure as any)?.sequence ?? (procedure as any)?.procedure_sequence ?? 0) === 1;
                                                                    const effectiveCareChar = careCharStr;
                                                                    const aihHasExcluded = hasAnyExcludedCodeInProcedures(patient.procedures as any);
                                                                    const operaEligible = !aihHasExcluded && isOperaEligibleConfig(procedure.procedure_code, effectiveCareChar);
                                                                    const diagReason = (() => {
                                                                      if (!isMedical04) return '';
                                                                      const cc = (effectiveCareChar ?? '').toString();
                                                                      const isElective = cc === '1' || cc.toLowerCase?.() === 'eletivo';
                                                                      if (!isElective) return 'Sem +150%: caráter ≠ Eletivo';
                                                                      // Normalizar aqui igual ao helper sem reimportar o Set
                                                                      const normalized = (procedure.procedure_code || '').toString().replace(/[\.\s-]/g, '');
                                                                      // Duplicamos a verificação via helper: se não elegível, e é médico 04 e eletivo, resta exclusão
                                                                      if (!operaEligible) return 'Sem +150%: código em lista de exclusões';
                                                                      return '';
                                                                    })();
                                                                    return (
                                                                      <div key={procedure.procedure_id || procIndex} className={`bg-white border rounded-lg overflow-hidden ${isMedical04 && isPrincipal ? 'border-emerald-300 shadow-sm' : 'border-slate-200'
                                                                        } ${operaEligible && isPrincipal ? 'ring-2 ring-emerald-200' : ''}`}>
                                                                        {/* CABEÇALHO DO PROCEDIMENTO */}
                                                                        <div className={`px-4 py-2.5 border-b flex items-center justify-between ${isMedical04 && isPrincipal ? 'bg-gradient-to-r from-emerald-50 to-teal-50 border-emerald-200' : 'bg-slate-50 border-slate-200'
                                                                          }`}>
                                                                          <div className="flex items-center gap-2 flex-wrap">
                                                                            <span className={`text-xs font-bold uppercase tracking-wide px-2 py-1 rounded ${isMedical04 && isPrincipal ? 'bg-emerald-600 text-white' : 'bg-slate-600 text-white'
                                                                              }`}>
                                                                              {procedure.procedure_code}
                                                                            </span>
                                                                            {isMedical04 && (
                                                                              <Badge
                                                                                variant="outline"
                                                                                className={`${isPrincipal ? 'bg-emerald-100 text-emerald-700 border-emerald-300' : 'bg-slate-100 text-slate-700 border-slate-300'} text-[10px]`}
                                                                              >
                                                                                🩺 Médico 04
                                                                              </Badge>
                                                                            )}
                                                                            {isMedical04 && isPrincipal && (
                                                                              <Badge variant="outline" className="bg-emerald-50 text-emerald-800 border-emerald-200 text-[10px] font-bold">
                                                                                Principal
                                                                              </Badge>
                                                                            )}
                                                                            {operaEligible && (
                                                                              <Badge variant="outline" className="bg-emerald-50 text-emerald-800 border-emerald-200 text-[10px] font-bold">
                                                                                Opera Paraná +150%
                                                                              </Badge>
                                                                            )}
                                                                            {!operaEligible && isMedical04 && diagReason && (
                                                                              <Badge variant="outline" className="bg-amber-50 text-amber-800 border-amber-200 text-[10px]">
                                                                                {diagReason}
                                                                              </Badge>
                                                                            )}
                                                                            {(() => {
                                                                              const anesthetistInfo = getAnesthetistProcedureType(procedure.cbo, procedure.procedure_code);
                                                                              if (anesthetistInfo.isAnesthetist) {
                                                                                return (
                                                                                  <Badge
                                                                                    variant={anesthetistInfo.badgeVariant}
                                                                                    className={`${anesthetistInfo.badgeClass} text-[10px] ${anesthetistInfo.shouldCalculate ? '' : 'animate-pulse'}`}
                                                                                  >
                                                                                    {anesthetistInfo.badge}
                                                                                  </Badge>
                                                                                );
                                                                              }
                                                                              return null;
                                                                            })()}
                                                                            {procedure.sequence && procedure.sequence > 1 && (
                                                                              <Badge variant="outline" className="bg-slate-100 text-slate-700 border-slate-300 text-[10px]">
                                                                                Seq. {procedure.sequence}
                                                                              </Badge>
                                                                            )}
                                                                          </div>

                                                                          {/* VALOR NO CABEÇALHO */}
                                                                          <div className="text-right">
                                                                            {(() => {
                                                                              const anesthetistInfo = getAnesthetistProcedureType(procedure.cbo, procedure.procedure_code);
                                                                              if (operaEligible && (!anesthetistInfo.isAnesthetist || anesthetistInfo.shouldCalculate)) {
                                                                                const base = procedure.value_reais || 0;
                                                                                const increment = base * 1.5; // +150%
                                                                                return (
                                                                                  <div className="text-right">
                                                                                    <div className="text-[10px] text-slate-500 line-through">{formatCurrency(base)}</div>
                                                                                    <div className="text-base font-black text-emerald-700">{formatCurrency(increment)}</div>
                                                                                  </div>
                                                                                );
                                                                              }
                                                                              if (anesthetistInfo.isAnesthetist && !anesthetistInfo.shouldCalculate) {
                                                                                const base = procedure.value_reais || 0;
                                                                                return (
                                                                                  <div className="text-right">
                                                                                    <div className="text-base font-bold text-slate-900">
                                                                                      {formatCurrency(base)}
                                                                                    </div>
                                                                                    <div className="text-[10px] text-slate-500">visualização</div>
                                                                                  </div>
                                                                                );
                                                                              } else {
                                                                                // ✅ PROCEDIMENTO NORMAL OU ANESTESISTA 03.xxx: Mostrar valor
                                                                                return (
                                                                                  <div className={`text-base font-bold ${isMedical04 && isPrincipal ? 'text-emerald-700' : 'text-slate-900'
                                                                                    }`}>
                                                                                    {formatCurrency(procedure.value_reais)}
                                                                                  </div>
                                                                                );
                                                                              }
                                                                            })()}
                                                                          </div>
                                                                        </div>

                                                                        {/* CORPO DO PROCEDIMENTO */}
                                                                        <div className="px-4 py-3">
                                                                          {/* DESCRIÇÃO */}
                                                                          <div className="mb-3">
                                                                            <p className="text-sm text-slate-700 leading-relaxed">
                                                                              {(() => {
                                                                                const current = String(procedure.procedure_description || '').trim()
                                                                                const hasCurrent = current && current.toLowerCase() !== 'descrição não disponível'
                                                                                if (!useSihSource) return hasCurrent ? current : 'Descrição não disponível'
                                                                                const code = String(procedure.procedure_code || '')
                                                                                const digits = code.replace(/\D/g, '')
                                                                                const formatted = `${digits.slice(0, 2)}.${digits.slice(2, 4)}.${digits.slice(4, 6)}.${digits.slice(6, 9)}-${digits.slice(9)}`
                                                                                const csv = sigtapMap?.get(formatted) || sigtapMap?.get(digits)
                                                                                return csv || (hasCurrent ? current : 'Descrição não disponível')
                                                                              })()}
                                                                            </p>
                                                                          </div>

                                                                          {/* GRID DE INFORMAÇÕES (2 COLUNAS) */}
                                                                          <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-xs">
                                                                            {/* CBO */}
                                                                            {procedure.cbo && (
                                                                              <div>
                                                                                <span className="text-slate-500 font-medium uppercase tracking-wide">CBO:</span>
                                                                                <Badge
                                                                                  variant="outline"
                                                                                  className={`ml-2 text-[10px] ${isMedical04
                                                                                    ? (procedure.cbo === '225151'
                                                                                      ? 'bg-emerald-600 text-white border-0'
                                                                                      : 'bg-blue-600 text-white border-0')
                                                                                    : 'bg-slate-100 text-slate-700 border-slate-300'
                                                                                    }`}
                                                                                >
                                                                                  {procedure.cbo}
                                                                                </Badge>
                                                                                {isMedical04 && procedure.cbo === '225151' && (
                                                                                  <Badge variant="outline" className="ml-2 text-[10px] bg-emerald-600 text-white border-0">
                                                                                    Anestesista
                                                                                  </Badge>
                                                                                )}
                                                                                {(() => {
                                                                                  const cboDigits = String(procedure.cbo || '').replace(/\D/g, '')
                                                                                  const validCbo = cboDigits.length === 6 && cboDigits !== '225151'
                                                                                  const partDigits = String((procedure as any).participation || '').replace(/\D/g, '')
                                                                                  const partCode = partDigits ? partDigits.padStart(2, '0').slice(-2) : ''
                                                                                  if (!isMedical04 || !validCbo || partCode !== '01') return null
                                                                                  return (
                                                                                    <Badge variant="outline" className="ml-2 text-[10px] bg-blue-600 text-white border-0">
                                                                                      1º Cirurgião
                                                                                    </Badge>
                                                                                  )
                                                                                })()}
                                                                              </div>
                                                                            )}

                                                                            {procedure.procedure_date && (
                                                                              <div>
                                                                                <span className="text-slate-500 font-medium uppercase tracking-wide">Data:</span>
                                                                                <span className="ml-2 text-slate-900 font-medium">{parseISODateToLocal(procedure.procedure_date)}</span>
                                                                              </div>
                                                                            )}
                                                                            {typeof (procedure as any).quantity !== 'undefined' && (
                                                                              <div>
                                                                                <span className="text-slate-500 font-medium uppercase tracking-wide">Qtd. atos:</span>
                                                                                <span className="ml-2 text-slate-900 font-medium">{formatNumber((procedure as any).quantity)}</span>
                                                                              </div>
                                                                            )}
                                                                            {procedure.cid_primary && (
                                                                              <div>
                                                                                <span className="text-slate-500 font-medium uppercase tracking-wide">CID:</span>
                                                                                <span className="ml-2 text-slate-900 font-medium">{procedure.cid_primary}</span>
                                                                              </div>
                                                                            )}

                                                                            {/* PROFISSIONAL */}
                                                                            {procedure.professional_name && (
                                                                              <div className="col-span-2">
                                                                                <span className="text-slate-500 font-medium uppercase tracking-wide">Profissional:</span>
                                                                                <span className="ml-2 text-slate-900">{procedure.professional_name}</span>
                                                                              </div>
                                                                            )}

                                                                            {/* PARTICIPAÇÃO */}
                                                                            <div>
                                                                              <span className="text-slate-500 font-medium uppercase tracking-wide">Participação:</span>
                                                                              <span className="ml-2 text-slate-900">
                                                                                {isMedicalProcedure(String((procedure as any).procedure_code || ''))
                                                                                  ? (formatParticipationLabel(procedure.participation) || 'null')
                                                                                  : 'null'}
                                                                              </span>
                                                                            </div>

                                                                            {/* COMPLEXIDADE */}
                                                                            {procedure.complexity && (
                                                                              <div>
                                                                                <span className="text-slate-500 font-medium uppercase tracking-wide">Complexidade:</span>
                                                                                <span className="ml-2 text-slate-900">{procedure.complexity}</span>
                                                                              </div>
                                                                            )}
                                                                          </div>
                                                                        </div>
                                                                      </div>
                                                                    );
                                                                  })}
                                                              </div>
                                                            )}

                                                            {/* 🆕 COMPONENTE DE REGRAS DE PAGAMENTO ESPECÍFICAS */}
                                                            {patient.procedures.filter(proc =>
                                                              isMedicalProcedure(proc.procedure_code) &&
                                                              shouldCalculateAnesthetistProcedure(proc.cbo, proc.procedure_code)
                                                            ).length > 0 && (
                                                                <DoctorPaymentRules
                                                                  doctorName={doctor.doctor_info.name}
                                                                  doctorCns={doctor.doctor_info.cns}
                                                                  doctorSpecialty={doctor.doctor_info.specialty}
                                                                  procedures={patient.procedures
                                                                    .filter(proc =>
                                                                      isMedicalProcedure(proc.procedure_code) &&
                                                                      shouldCalculateAnesthetistProcedure(proc.cbo, proc.procedure_code)
                                                                    )
                                                                    .map(proc => ({
                                                                      procedure_code: proc.procedure_code,
                                                                      procedure_description: proc.procedure_description,
                                                                      value_reais: proc.value_reais || 0,
                                                                      cbo: proc.cbo,
                                                                      sequence: (proc as any).sequence
                                                                    }))}
                                                                  hospitalId={getDoctorContextualHospitalId(doctor)}
                                                                  className="mt-5"
                                                                  useCsvHon={ENV_CONFIG.USE_SIH_SOURCE && /cirurg/i.test(doctor.doctor_info.specialty || '') && /geral/i.test(doctor.doctor_info.specialty || '')}
                                                                />
                                                              )}
                                                          </div>
                                                        </CollapsibleContent>
                                                      </Collapsible>
                                                    </div>
                                                  );
                                                })}

                                                {/* 🆕 CONTROLES DE PAGINAÇÃO */}
                                                {totalPages > 1 && (
                                                  <div className="flex items-center justify-between mt-6 pt-4 border-t border-slate-200/60">
                                                    <div className="text-sm text-slate-600">
                                                      Mostrando {startIndex + 1}-{Math.min(endIndex, doctor.patients.length)} de {doctor.patients.length} pacientes
                                                    </div>
                                                    <div className="flex items-center gap-2">
                                                      <button
                                                        onClick={() => {
                                                          const newPage = Math.max(1, currentPage - 1);
                                                          const newMap = new Map(currentPatientPage);
                                                          newMap.set(doctorKey, newPage);
                                                          setCurrentPatientPage(newMap);
                                                        }}
                                                        disabled={currentPage === 1}
                                                        className="px-3 py-1 text-sm border border-slate-300 rounded-md hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed"
                                                      >
                                                        Anterior
                                                      </button>
                                                      <span className="text-sm text-slate-600">
                                                        Página {currentPage} de {totalPages}
                                                      </span>
                                                      <button
                                                        onClick={() => {
                                                          const newPage = Math.min(totalPages, currentPage + 1);
                                                          const newMap = new Map(currentPatientPage);
                                                          newMap.set(doctorKey, newPage);
                                                          setCurrentPatientPage(newMap);
                                                        }}
                                                        disabled={currentPage === totalPages}
                                                        className="px-3 py-1 text-sm border border-slate-300 rounded-md hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed"
                                                      >
                                                        Próxima
                                                      </button>
                                                    </div>
                                                  </div>
                                                )}
                                              </>
                                            );
                                          })()}
                                        </>
                                      );
                                    })()}
                                  </div>
                                </div>
                              </div>
                            </CollapsibleContent>
                          </Collapsible>
                        </Card>
                      );
                    })}

                    {/* 🆕 CONTROLES DE PAGINAÇÃO DOS MÉDICOS */}
                    {totalPages > 1 && (
                      <div className="flex items-center justify-between mt-8 pt-6 border-t border-slate-200/60">
                        <div className="text-sm text-slate-600">
                          Mostrando {startIndex + 1}-{Math.min(endIndex, totalDoctors)} de {totalDoctors} médicos
                        </div>
                        <div className="flex items-center gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setCurrentDoctorPage(prev => Math.max(1, prev - 1))}
                            disabled={currentDoctorPage === 1}
                            className="h-8 w-8 p-0"
                          >
                            <ChevronLeft className="h-4 w-4" />
                          </Button>

                          <div className="flex items-center gap-1">
                            {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
                              <Button
                                key={page}
                                variant={currentDoctorPage === page ? "default" : "outline"}
                                size="sm"
                                onClick={() => setCurrentDoctorPage(page)}
                                className="h-8 w-8 p-0"
                              >
                                {page}
                              </Button>
                            ))}
                          </div>

                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setCurrentDoctorPage(prev => Math.min(totalPages, prev + 1))}
                            disabled={currentDoctorPage === totalPages}
                            className="h-8 w-8 p-0"
                          >
                            <ChevronRight className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    )}
                  </>
                );
              })()
            )}
          </div>
        </CardContent>
      </Card>
      {/* Modal: Report Generator (SUS) */}
      <Dialog open={reportModalOpen} onOpenChange={setReportModalOpen}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>Relatório SUS</DialogTitle>
          </DialogHeader>
          <div className="mt-2">
            <ReportGenerator
              preset={{
                type: 'sus-report',
                hospitalId: reportPreset?.hospitalId,
                doctorName: reportPreset?.doctorName,
                startDate: (reportPreset as any)?.startDate,
                endDate: (reportPreset as any)?.endDate,
                lock: true
              }}
              onClose={() => setReportModalOpen(false)}
            />
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={zeroRepasseOpen} onOpenChange={setZeroRepasseOpen}>
        <DialogContent className="max-w-5xl w-[90vw]">
          <DialogHeader>
            <DialogTitle>Pacientes sem repasse – {zeroRepasseDoctorName}</DialogTitle>
          </DialogHeader>
          <div className="flex justify-end mb-3">
            <Button onClick={exportZeroRepasseExcel} className="inline-flex items-center gap-2 bg-[#0b1736] hover:bg-[#09122a] text-white h-8 px-3 rounded-md text-xs">
              <FileSpreadsheet className="h-3 w-3" />
              Exportar Excel
            </Button>
          </div>
          <div>
            <table className="w-full text-sm">
              <thead>
                <tr className="text-xs text-gray-600">
                  <th className="text-left p-2">Prontuário</th>
                  <th className="text-left p-2">Nº AIH</th>
                  <th className="text-left p-2">Nome</th>
                  <th className="text-left p-2">Procedimentos</th>
                  <th className="text-left p-2">Data Alta</th>
                </tr>
              </thead>
              <tbody>
                {zeroRepasseItems.map((it, idx) => (
                  <tr key={idx} className={idx % 2 === 0 ? 'bg-gray-50' : ''}>
                    <td className="p-2">{it.medicalRecord}</td>
                    <td className="p-2">{it.aihNumber}</td>
                    <td className="p-2">{it.name}</td>
                    <td className="p-2">{it.procedures}</td>
                    <td className="p-2">{it.discharge}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </DialogContent>
      </Dialog>
      <Dialog open={simplifiedValidationOpen} onOpenChange={setSimplifiedValidationOpen}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>Validação do Relatório Simplificado</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            {simplifiedValidationLoading ? (
              <div className="flex items-center gap-2 text-sm text-gray-600">
                <Loader2 className="h-4 w-4 animate-spin" />
                Validando AIHs no DATASUS...
              </div>
            ) : (
              <>
                <div className="text-sm text-gray-700">
                  <div className="font-semibold">Médico: <span className="text-gray-900">{selectedDoctorForReport?.doctor_info?.name}</span></div>
                  <div>Hospital: {selectedDoctorForReport?.hospitals?.[0]?.hospital_name || '—'}</div>
                </div>
                <div className="grid grid-cols-3 gap-3 text-sm">
                  <div className="bg-gray-50 rounded p-2 border">
                    <div className="text-gray-500">AIHs Locais</div>
                    <div className="text-lg font-bold text-blue-700">{simplifiedValidationStats?.total ?? 0}</div>
                  </div>
                  <div className="bg-gray-50 rounded p-2 border">
                    <div className="text-gray-500">Homologadas (SIH)</div>
                    <div className="text-lg font-bold text-emerald-700">{simplifiedValidationStats?.approved ?? 0}</div>
                  </div>
                  <div className="bg-gray-50 rounded p-2 border">
                    <div className="text-gray-500">Não Homologadas</div>
                    <div className="text-lg font-bold text-red-700">{simplifiedValidationStats?.notApproved ?? 0}</div>
                  </div>
                </div>
                <div className="flex items-center justify-end gap-2">
                  <Button variant="outline" onClick={() => setSimplifiedValidationOpen(false)}>Cancelar</Button>
                  <Button onClick={async () => { setSimplifiedValidationOpen(false); await generateSimplifiedReport(selectedDoctorForReport, false); }}>Gerar Produção (todos)</Button>
                  <Button className="bg-black hover:bg-neutral-800 text-white" onClick={async () => { setSimplifiedValidationOpen(false); await generateSimplifiedReport(selectedDoctorForReport, true); }}>Gerar Homologadas (SIH)</Button>
                </div>
              </>
            )}
          </div>
        </DialogContent>
      </Dialog>
      <Dialog
        open={tabwinReportOpen}
        onOpenChange={(open) => {
          if (!tabwinReportLoading) setTabwinReportOpen(open)
        }}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Repasse Médico (TABWIN)</DialogTitle>
          </DialogHeader>
          <div className="space-y-2 text-sm text-neutral-700">
            <div>Médico: <span className="font-semibold text-black">{tabwinReportDoctor?.doctor_info?.name || '-'}</span></div>
            <div>Hospital: <span className="font-semibold text-black">{tabwinReportDoctor?.hospitals?.[0]?.hospital_name || '-'}</span></div>
          </div>
          <div className="flex items-center justify-end gap-2 pt-2">
            <Button
              variant="outline"
              onClick={() => setTabwinReportOpen(false)}
              disabled={tabwinReportLoading}
            >
              Fechar
            </Button>
            <Button
              className="bg-black hover:bg-neutral-800 text-white inline-flex items-center gap-2"
              onClick={async () => {
                if (!tabwinReportDoctor) return
                try {
                  setTabwinReportLoading(true)
                  setTabwinReportOpen(false)
                  await generateSimplifiedReportFromSih(tabwinReportDoctor, false, 'pdf')
                } finally {
                  setTabwinReportLoading(false)
                }
              }}
              disabled={tabwinReportLoading}
            >
              {tabwinReportLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileText className="h-4 w-4" />}
              PDF
            </Button>
            <Button
              className="bg-[#0b1736] hover:bg-[#09122a] text-white inline-flex items-center gap-2"
              onClick={async () => {
                if (!tabwinReportDoctor) return
                try {
                  setTabwinReportLoading(true)
                  setTabwinReportOpen(false)
                  await generateSimplifiedReportFromSih(tabwinReportDoctor, false, 'excel')
                } finally {
                  setTabwinReportLoading(false)
                }
              }}
              disabled={tabwinReportLoading}
            >
              {tabwinReportLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileSpreadsheet className="h-4 w-4" />}
              Excel
            </Button>
          </div>
        </DialogContent>
      </Dialog>
      <Dialog
        open={simplifiedPreviewOpen}
        onOpenChange={(open) => {
          setSimplifiedPreviewOpen(open)
          if (!open) {
            setSimplifiedPreviewRows([])
            simplifiedPreviewConfirmRef.current = null
          }
        }}
      >
        <DialogContent className="max-w-5xl w-[90vw]">
          <DialogHeader>
            <DialogTitle>Pré-visualização – Relatório Pacientes Simplificado</DialogTitle>
          </DialogHeader>
          <div className="flex flex-wrap items-center justify-between gap-3 text-sm text-neutral-700">
            <div>Linhas: <span className="font-semibold text-black">{simplifiedPreviewRows.length}</span></div>
            <div>Valor Total: <span className="font-semibold text-green-700">{formatCurrency(simplifiedPreviewRows.reduce((s, r) => s + parseBrCurrencyPreview(r[6]), 0))}</span></div>
          </div>
          <div className="border rounded-lg overflow-hidden max-h-[60vh] overflow-y-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-gray-50">
                  <TableHead className="w-12">#</TableHead>
                  <TableHead className="w-28">Prontuário</TableHead>
                  <TableHead className="w-24">AIH</TableHead>
                  <TableHead>Paciente</TableHead>
                  <TableHead>Procedimentos</TableHead>
                  <TableHead className="w-24">Alta</TableHead>
                  <TableHead className="w-28 text-right">Repasse</TableHead>
                  <TableHead className="w-16"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {simplifiedPreviewRows.map((row, idx) => (
                  <TableRow key={`${idx}-${row[2] || ''}-${row[3] || ''}`}>
                    <TableCell className="text-center">{idx + 1}</TableCell>
                    <TableCell className="text-center">{row[1]}</TableCell>
                    <TableCell className="text-center">{row[2]}</TableCell>
                    <TableCell>{row[3]}</TableCell>
                    <TableCell className="text-xs">{row[4]}</TableCell>
                    <TableCell className="text-center">{row[5]}</TableCell>
                    <TableCell className="text-right font-semibold">{row[6]}</TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 w-7 p-0"
                        title="Apagar linha"
                        onClick={() => {
                          setSimplifiedPreviewRows(prev => {
                            const next = prev.filter((_, i) => i !== idx)
                            return next.map((r, j) => {
                              const out = [...r]
                              out[0] = String(j + 1)
                              return out
                            })
                          })
                        }}
                      >
                        <XCircle className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          <div className="flex items-center justify-end gap-2 pt-2">
            <Button
              variant="outline"
              onClick={() => {
                setSimplifiedPreviewOpen(false)
                setSimplifiedPreviewRows([])
                simplifiedPreviewConfirmRef.current = null
              }}
            >
              Cancelar
            </Button>
            <Button
              className="bg-black hover:bg-neutral-800 text-white"
              disabled={simplifiedPreviewRows.length === 0}
              onClick={() => {
                try {
                  simplifiedPreviewConfirmRef.current?.(simplifiedPreviewRows)
                  toast.success('Relatório PDF gerado com sucesso!')
                } catch {
                  toast.error('Erro ao gerar relatório PDF')
                } finally {
                  setSimplifiedPreviewOpen(false)
                  setSimplifiedPreviewRows([])
                  simplifiedPreviewConfirmRef.current = null
                }
              }}
            >
              Confirmar
            </Button>
          </div>
        </DialogContent>
      </Dialog>
      <Dialog
        open={relateOpen}
        onOpenChange={(open) => {
          setRelateOpen(open)
          if (!open) setRelateDoctor(null)
        }}
      >
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>Comparar relatórios</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="text-base text-gray-700">
              <div className="font-semibold">
                Médico:{' '}
                <span className="text-gray-900">
                  {relateDoctor?.doctor_info?.name || '—'}
                </span>
              </div>
              <div>Hospital: {relateDoctor?.hospitals?.[0]?.hospital_name || '—'}</div>
            </div>
            <div className="grid gap-3">
              <div>
                <div className="text-sm text-gray-700 mb-1">Relatorio Base</div>
                <Select
                  value={relateReportA}
                  onValueChange={(v) => {
                    setRelateReportA(v)
                    if (v === relateReportB) {
                      const next = (Array.from(relateReportOptions) as string[]).find(x => x !== v) || ''
                      setRelateReportB(next)
                    }
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione" />
                  </SelectTrigger>
                  <SelectContent>
                    {(Array.from(relateReportOptions) as string[]).map((opt) => (
                      <SelectItem key={opt} value={opt}>
                        {opt}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <div className="text-sm text-gray-700 mb-1">Relatorio Alvo</div>
                <Select value={relateReportB} onValueChange={setRelateReportB}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione" />
                  </SelectTrigger>
                  <SelectContent>
                    {(Array.from(relateReportOptions) as string[])
                      .filter((opt) => opt !== relateReportA)
                      .map((opt) => (
                        <SelectItem key={opt} value={opt}>
                          {opt}
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
                <div className="mt-3 text-sm text-red-600">
                  Obs.: o PDF usa as linhas do Relatório Base como fonte principal (não faz união dos dois relatórios).
                </div>
              </div>
            </div>
            <div className="flex items-center justify-end gap-2">
              <Button variant="outline" onClick={() => setRelateOpen(false)} disabled={relateLoading}>
                Cancelar
              </Button>
              <Button
                className="bg-emerald-600 hover:bg-emerald-700 text-white"
                onClick={handleRelateConfirm}
                disabled={relateLoading || !relateReportA || !relateReportB || relateReportA === relateReportB}
              >
                {relateLoading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                Gerar PDF
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog
        open={valueConferenceOpen}
        onOpenChange={(open) => {
          setValueConferenceOpen(open)
          if (!open) setValueConferenceDoctor(null)
        }}
      >
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>Conferência Valores</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="text-base text-gray-700">
              <div className="font-semibold">
                Médico:{' '}
                <span className="text-gray-900">
                  {valueConferenceDoctor?.doctor_info?.name || '—'}
                </span>
              </div>
              <div>Hospital: {valueConferenceDoctor?.hospitals?.[0]?.hospital_name || '—'}</div>
              <div className="mt-2 text-sm text-gray-600">
                Relatório Base: Relatório Pacientes Simplificado (Valor total da AIH)
              </div>
            </div>
            <div className="flex items-center justify-end gap-2">
              <Button variant="outline" onClick={() => setValueConferenceOpen(false)} disabled={valueConferenceLoading}>
                Cancelar
              </Button>
              <Button
                className="bg-indigo-600 hover:bg-indigo-700 text-white"
                onClick={handleValueConferenceCompare}
                disabled={valueConferenceLoading || !valueConferenceDoctor}
              >
                {valueConferenceLoading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                Comparar valores com Consolidado
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

    </div>
  );
};

export default MedicalProductionDashboard;
const generateValidationReport = async (
  selectedHospitals: string[] | undefined,
  selectedCompetencia: string | undefined,
  useSihSource: boolean,
  filteredDoctors: any[]
) => {
  try {
    const normalizeAih = (s: string) => s.replace(/\D/g, '').replace(/^0+/, '')
    const hospitalIds = selectedHospitals?.filter(h => h !== 'all') || []
    const competenciaFilter = (selectedCompetencia && selectedCompetencia !== 'all' && selectedCompetencia.trim()) ? selectedCompetencia.trim() : undefined

    // Local AIHs com nome (por hospital/competência)
    let localQuery = supabase
      .from('aihs')
      .select('aih_number, hospital_id, competencia, patients(name)')
    if (hospitalIds.length > 0) localQuery = localQuery.in('hospital_id', hospitalIds)
    if (competenciaFilter) localQuery = localQuery.eq('competencia', competenciaFilter)
    const { data: localRows } = await localQuery
    const localNameByAih = new Map<string, { name: string; hospital_id?: string; competencia?: string }>()
      ; (localRows || []).forEach((r: any) => {
        const k = normalizeAih(String(r.aih_number || ''))
        const nm = String(r?.patients?.name || '')
        if (k) localNameByAih.set(k, { name: nm, hospital_id: r.hospital_id, competencia: r.competencia })
      })
    const localSet = new Set(localNameByAih.keys())

    // Remoto (produção) por hospital/competência
    let remoteSet = new Set<string>()
    let remoteMetaByAih = new Map<string, { hospital_id?: string; competencia?: string }>()
    if (useSihSource) {
      try {
        const { SihApiAdapter } = await import('../services/sihApiAdapter')
        const remoteDocs = await SihApiAdapter.getDoctorsWithPatients({ hospitalIds, competencia: competenciaFilter })
        remoteDocs.forEach((d: any) => {
          (d.patients || []).forEach((p: any) => {
            const k = normalizeAih(String(p?.aih_info?.aih_number || ''))
            if (!k) return
            remoteSet.add(k)
            if (!remoteMetaByAih.has(k)) remoteMetaByAih.set(k, { hospital_id: p?.aih_info?.hospital_id, competencia: p?.aih_info?.competencia })
          })
        })
      } catch { }
    }

    // Remoto (homologação) sem filtro de competência
    const { supabaseSih } = await import('../lib/sihSupabase')
    const allKeys = Array.from(new Set([...remoteSet, ...localSet])).filter(Boolean)
    const approvedSet = new Set<string>()
    const chunkSize = 80
    for (let i = 0; i < allKeys.length; i += chunkSize) {
      const ch = allKeys.slice(i, i + chunkSize)
      const { data: spRows } = await supabaseSih
        .from('sih_sp')
        .select('sp_naih')
        .in('sp_naih', ch)
        ; (spRows || []).forEach((r: any) => {
          const k = normalizeAih(String(r.sp_naih || ''))
          if (k) approvedSet.add(k)
        })
    }

    // Conjuntos
    const missingLocal = Array.from(remoteSet).filter(k => !localSet.has(k))
    const pendingApproved = Array.from(localSet).filter(k => !approvedSet.has(k))

    // Exportar Excel
    const rowsMissingLocal: any[] = [['Nº AIH', 'Hospital', 'Competência (produção)']]
    missingLocal.forEach(k => {
      const meta = remoteMetaByAih.get(k)
      const hospName = (() => {
        try {
          const card = filteredDoctors.find((d: any) => (d.hospitals?.[0]?.hospital_id || '') === (meta?.hospital_id || ''))
          return card?.hospitals?.[0]?.hospital_name || meta?.hospital_id || ''
        } catch { return meta?.hospital_id || '' }
      })()
      rowsMissingLocal.push([k, hospName, formatCompetencia(String(meta?.competencia || ''))])
    })

    const rowsPendingApproved: any[] = [['Nº AIH', 'Hospital', 'Competência (produção)', 'Paciente']]
    pendingApproved.forEach(k => {
      const local = localNameByAih.get(k)
      const hospName = (() => {
        try {
          const card = filteredDoctors.find((d: any) => (d.hospitals?.[0]?.hospital_id || '') === (local?.hospital_id || ''))
          return card?.hospitals?.[0]?.hospital_name || local?.hospital_id || ''
        } catch { return local?.hospital_id || '' }
      })()
      rowsPendingApproved.push([k, hospName, formatCompetencia(String(local?.competencia || '')), local?.name || ''])
    })

    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(rowsMissingLocal), 'Sem inserção local')
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(rowsPendingApproved), 'Pendentes SIH')
    const fileName = `Validacao_Local_vs_Remoto_${formatDateFns(new Date(), 'yyyyMMdd_HHmm')}.xlsx`
    XLSX.writeFile(wb, fileName)
    toast.success('Relatório de validação gerado com sucesso!')
  } catch (e) {
    console.error('Erro ao gerar relatório de validação:', e)
    toast.error('Erro ao gerar relatório de validação')
  }
}

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
import { calculateDoctorPayment, calculatePercentagePayment, calculateFixedPayment, hasIndividualPaymentRules, isFixedMonthlyPayment } from '../config/doctorPaymentRules';
import ProcedurePatientDiagnostic from './ProcedurePatientDiagnostic';
import CleuezaDebugComponent from './CleuezaDebugComponent';
import ExecutiveDateFilters from './ExecutiveDateFilters';
import { CareCharacterUtils } from '../config/careCharacterCodes';
import { 
  shouldCalculateAnesthetistProcedure, 
  getAnesthetistProcedureType,
  filterCalculableProcedures 
} from '../utils/anesthetistLogic';
import ReportGenerator from './ReportGenerator';
import PatientAihInfoBadges from './PatientAihInfoBadges';
import AihDatesBadges from './AihDatesBadges';
import { isDoctorCoveredForOperaParana, computeIncrementForProcedures, hasAnyExcludedCodeInProcedures } from '../config/operaParana';
import { sumProceduresBaseReais } from '@/utils/valueHelpers';
import { exportAllPatientsExcel } from '../services/exportService'
import { ENV_CONFIG } from '../config/env'

// ✅ FUNÇÕES UTILITÁRIAS LOCAIS
// Função para identificar procedimentos médicos (código 04)
const isMedicalProcedure = (procedureCode: string): boolean => {
  if (!procedureCode) return false;
  // Verifica se o código inicia com '04'
  const code = procedureCode.toString().trim();
  return code.startsWith('04');
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

// Função para formatar competência (YYYY-MM-DD para MM/YYYY)
const formatCompetencia = (competencia: string | undefined): string => {
  if (!competencia) return '—';
  
  try {
    // Formato esperado: YYYY-MM-DD ou YYYY-MM
    const match = competencia.match(/^(\d{4})-(\d{2})/);
    if (match) {
      const [, year, month] = match;
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

const calculateDoctorStats = (doctorData: DoctorWithPatients) => {
  // ✅ SIMPLIFICADO: Usar TODOS os pacientes (sem filtro de data)
  let patientsForStats = doctorData.patients;

  // 🚀 OTIMIZAÇÃO #4: Usar procedimentos pré-filtrados (calculable_procedures)
  const totalProcedures = patientsForStats.reduce((sum, patient) => 
    sum + ((patient as any).calculable_procedures?.length || patient.procedures.filter(filterCalculableProcedures).length), 0);
  
  // ✅ CORREÇÃO: USAR patient.total_value_reais QUE VEM DO calculated_total_value DA AIH
  const totalValue = patientsForStats.reduce((sum, patient) => sum + patient.total_value_reais, 0);
  const totalAIHs = patientsForStats.length;
  const avgTicket = totalAIHs > 0 ? totalValue / totalAIHs : 0;
  
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
    sum + patient.procedures.filter(proc => 
      isMedicalProcedure(proc.procedure_code) && 
      shouldCalculateAnesthetistProcedure(proc.cbo, proc.procedure_code)
    ).length, 0
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
  
  // Calcular valor original de todos os procedimentos médicos (🚫 EXCLUINDO ANESTESISTAS 04.xxx)
  medicalProceduresValue = patientsForStats.reduce((sum, patient) => 
    sum + patient.procedures
      .filter(proc => 
        isMedicalProcedure(proc.procedure_code) && 
        shouldCalculateAnesthetistProcedure(proc.cbo, proc.procedure_code)
      )
      .reduce((procSum, proc) => procSum + (proc.value_reais || 0), 0), 0
  );
  
  // 🎯 CALCULAR INCREMENTO OPERA PARANÁ (acréscimo ao valor base das AIHs)
  const hospitalId = doctorData.hospitals?.[0]?.hospital_id;
  const doctorCovered = isDoctorCoveredForOperaParana(doctorData.doctor_info.name, hospitalId);
  
  const operaParanaIncrement = doctorCovered 
    ? patientsForStats.reduce((acc, patient) => 
        acc + computeIncrementForProcedures(
          patient.procedures as any, 
          (patient as any)?.aih_info?.care_character, 
          doctorData.doctor_info.name, 
          hospitalId
        ), 0)
    : 0;
  
  // 🎯 CALCULAR SOMA DOS VALORES DO DETALHAMENTO POR PROCEDIMENTO (POR PACIENTE)
  // 🆕 VERIFICAR TIPO DE REGRA: VALOR FIXO → PERCENTUAL → INDIVIDUAL
  
  // 🔥 1. PRIORIDADE MÁXIMA: Verificar regra de VALOR FIXO primeiro
  const fixedPaymentCalculation = calculateFixedPayment(doctorData.doctor_info.name, hospitalId);
  
  console.log(`🔍 DEBUG MÉDICO: ${doctorData.doctor_info.name} | Hospital ID: ${hospitalId} | Has Fixed Rule: ${fixedPaymentCalculation.hasFixedRule} | Amount: ${fixedPaymentCalculation.calculatedPayment}`);
  
  if (fixedPaymentCalculation.hasFixedRule) {
    // 🔍 VERIFICAR SE É FIXO MENSAL OU FIXO POR PACIENTE
    const isMonthlyFixed = isFixedMonthlyPayment(doctorData.doctor_info.name, hospitalId);
    
    if (isMonthlyFixed) {
      // ✅ FIXO MENSAL: Valor fixo UMA VEZ, independente de pacientes
      // Exemplo: THADEU TIESSI SUZUKI - R$ 47.000,00 fixo mensal
      calculatedPaymentValue = fixedPaymentCalculation.calculatedPayment;
      console.log(`💎 ${doctorData.doctor_info.name}: FIXO MENSAL - R$ ${fixedPaymentCalculation.calculatedPayment.toFixed(2)} (${patientsForStats.length} pacientes)`);
    } else {
      // ✅ FIXO POR PACIENTE: Multiplicar pelo número de pacientes
      // Exemplo: RAFAEL LUCENA BASTOS - R$ 450,00 × 31 pacientes = R$ 13.950,00
      calculatedPaymentValue = fixedPaymentCalculation.calculatedPayment * patientsForStats.length;
      console.log(`💰 ${doctorData.doctor_info.name}: FIXO POR PACIENTE - R$ ${fixedPaymentCalculation.calculatedPayment.toFixed(2)} × ${patientsForStats.length} pacientes = R$ ${calculatedPaymentValue.toFixed(2)}`);
    }
  } else {
    // 2. Verificar regra de percentual
    const percentageCalculation = calculatePercentagePayment(doctorData.doctor_info.name, totalValue, hospitalId);
    
    if (percentageCalculation.hasPercentageRule) {
      // ✅ USAR REGRA DE PERCENTUAL SOBRE VALOR TOTAL
      calculatedPaymentValue = percentageCalculation.calculatedPayment;
      console.log(`🎯 ${doctorData.doctor_info.name}: ${percentageCalculation.appliedRule}`);
    } else {
      // ✅ USAR REGRAS INDIVIDUAIS POR PROCEDIMENTO
      calculatedPaymentValue = patientsForStats.reduce((totalSum, patient) => {
        // Coletar procedimentos médicos deste paciente (🚫 EXCLUINDO ANESTESISTAS 04.xxx)
        const patientMedicalProcedures = patient.procedures
          .filter(proc => 
            isMedicalProcedure(proc.procedure_code) && 
            shouldCalculateAnesthetistProcedure(proc.cbo, proc.procedure_code)
          )
          .map(proc => ({
            procedure_code: proc.procedure_code,
            procedure_description: proc.procedure_description,
            value_reais: proc.value_reais || 0
          }));
        
        // Se há procedimentos médicos para este paciente, calcular o valor baseado nas regras
        if (patientMedicalProcedures.length > 0) {
          const paymentCalculation = calculateDoctorPayment(doctorData.doctor_info.name, patientMedicalProcedures, hospitalId);
          // Somar os valores calculados individuais (detalhamento por procedimento)
          const patientCalculatedSum = paymentCalculation.procedures.reduce((sum, proc) => sum + proc.calculatedPayment, 0);
          return totalSum + patientCalculatedSum;
        }
        
        return totalSum;
      }, 0);
    }
  }
  
  return {
    totalProcedures,
    totalValue,
    totalAIHs,
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
              className={`h-2 rounded-full ${
                diagnostic.association_rate >= 80 ? 'bg-green-500' :
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
  filterPgtAdm?: 'all' | 'sim' | 'não'; // ✅ NOVO: Filtro Pgt. Administrativo
}

// ✅ COMPONENTE PRINCIPAL - SIMPLIFICADO
const MedicalProductionDashboard: React.FC<MedicalProductionDashboardProps> = ({ 
  onStatsUpdate, 
  selectedHospitals = ['all'],
  searchTerm = '',
  patientSearchTerm = '',
  selectedCompetencia = 'all',
  filterPgtAdm = 'all'
}) => {
  const { user, canAccessAllHospitals, hasFullAccess } = useAuth();
  const [doctors, setDoctors] = useState<DoctorWithPatients[]>([]);
  const [filteredDoctors, setFilteredDoctors] = useState<DoctorWithPatients[]>([]);
  const [availableHospitals, setAvailableHospitals] = useState<Array<{id: string, name: string, cnes?: string}>>([]);
  const [isLoading, setIsLoading] = useState(true);
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
  const [useSihSource, setUseSihSource] = useState<boolean>(false)
  const [sigtapMap, setSigtapMap] = useState<Map<string, string> | null>(null)
  useEffect(() => {
    try { localStorage.setItem('useSihSource', 'false') } catch {}
  }, [])
  useEffect(() => {
    try { 
      localStorage.setItem('useSihSource', useSihSource ? 'true' : 'false') 
      window.dispatchEvent(new CustomEvent('sihsourcechange', { detail: { useSihSource } }))
    } catch {}
  }, [useSihSource])
  useEffect(() => {
    let mounted = true
    const load = async () => {
      if (!useSihSource) { setSigtapMap(null); return }
      try {
        const map = await getSigtapLocalMap()
        if (mounted) setSigtapMap(map)
      } catch { if (mounted) setSigtapMap(new Map()) }
    }
    load()
    return () => { mounted = false }
  }, [useSihSource])
  const remoteConfigured = Boolean(ENV_CONFIG.SIH_SUPABASE_URL && ENV_CONFIG.SIH_SUPABASE_ANON_KEY)

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
      console.log(`✅ Pacientes COM procedimentos: ${patientsWithProcedures} (${((patientsWithProcedures/totalPatients)*100).toFixed(1)}%)`);
      console.log(`⚠️ Pacientes SEM procedimentos: ${totalPatients - patientsWithProcedures} (${(((totalPatients - patientsWithProcedures)/totalPatients)*100).toFixed(1)}%)`);
      
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
        console.log(`   📈 Taxa de sucesso: ${((patientsWithProcedures/totalPatients)*100).toFixed(1)}%`);
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
          const pgtAdmFilter = (filterPgtAdm && filterPgtAdm !== 'all') ? filterPgtAdm : undefined;
          
          console.log('🗓️ [MedicalProductionDashboard] Carregando dados:', {
            competencia: competenciaFilter || 'TODAS',
            pgtAdm: pgtAdmFilter || 'TODOS',
            hospitals: selectedHospitalIds || 'TODOS',
            selectedCompetenciaRaw: selectedCompetencia
          });
          
          const doctorsWithPatients = await DoctorPatientService.getDoctorsWithPatientsFromProceduresView({
            hospitalIds: selectedHospitalIds,
            competencia: competenciaFilter, // ✅ Passar undefined se não houver filtro
            filterPgtAdm: pgtAdmFilter,
            useSihSource
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
      }
    };

    loadDoctorsData();
  }, [user, canAccessAllHospitals, hasFullAccess, selectedHospitals, refreshTick, selectedCompetencia, filterPgtAdm, useSihSource]);

  // 🆕 CARREGAR COMPETÊNCIAS DISPONÍVEIS
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
        } catch {}
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
        } catch {}
        if (realtimeDebounceRef.current) clearTimeout(realtimeDebounceRef.current);
        realtimeDebounceRef.current = setTimeout(() => setRefreshTick((t) => t + 1), 800);
      })
      .subscribe();

    return () => {
      try { supabase.removeChannel(channel); } catch {}
      if (realtimeDebounceRef.current) clearTimeout(realtimeDebounceRef.current);
    };
  }, [autoRefresh, selectedHospitals]);

  // 🕒 POLLING DE BACKUP: desativado por padrão para evitar recargas
  // useEffect(() => {
  //   const id = setInterval(() => setRefreshTick(t => t + 1), 60000);
  //   return () => clearInterval(id);
  // }, []);

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
    if (searchTerm.trim()) {
      const searchLower = searchTerm.toLowerCase();
      filtered = filtered.filter(doctor => {
        return doctor.doctor_info.name.toLowerCase().includes(searchLower) ||
               doctor.doctor_info.cns.includes(searchTerm) ||
               doctor.doctor_info.crm?.toLowerCase().includes(searchLower) ||
               doctor.doctor_info.specialty?.toLowerCase().includes(searchLower);
      });
    }

    // 🧑‍🦱 NOVO: FILTRAR POR NOME DO PACIENTE
    if (patientSearchTerm.trim()) {
      const patientSearchLower = patientSearchTerm.toLowerCase();
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

    // ✅ REMOVIDO: Filtros de especialidade médica e especialidade de atendimento
    
    // ✅ SIMPLIFICADO: Filtro de competência removido (já aplicado no backend)
    // A competência já é filtrada no carregamento dos dados via DoctorPatientService

    setFilteredDoctors(filtered);
    
    // Reset da página atual quando filtros são aplicados
    setCurrentDoctorPage(1);
  }, [searchTerm, patientSearchTerm, selectedCompetencia, doctors, selectedHospitals]);

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
      const proceduresWithPayment = patient.procedures
        .filter(filterCalculableProcedures)
        .map((proc: any) => ({
          procedure_code: proc.procedure_code,
          procedure_description: proc.procedure_description,
          value_reais: proc.value_reais || 0,
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

  // ✅ CALCULAR ESTATÍSTICAS GLOBAIS AVANÇADAS
  const globalStats = React.useMemo(() => {
    const totalDoctors = doctors.length;
    
    // ✅ CONTAGEM DUPLA: Total de AIHs E Pacientes Únicos
    const totalAIHs = doctors.reduce((sum, doctor) => sum + doctor.patients.length, 0);
    
    // Contar pacientes únicos (pessoas diferentes)
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
    
    // Coletar todos os procedimentos (🚫 EXCLUINDO ANESTESISTAS 04.xxx)
    const allProcedures = doctors.flatMap(doctor => 
      doctor.patients.flatMap(patient => 
        patient.procedures.filter(filterCalculableProcedures)
      )
    );
    
    // Calcular total de procedimentos de anestesistas iniciados em '04' (excluindo cesarianas)
    const totalAnesthetistProcedures04 = doctors.reduce((total, doctor) => {
      const doctorStats = calculateDoctorStats(doctor);
      return total + doctorStats.anesthetistProcedures04Count;
    }, 0);
    
    const totalProcedures = allProcedures.length;
    const totalRevenue = allProcedures.reduce((sum, proc) => sum + (proc.value_reais || 0), 0);
    const avgTicket = totalPatients > 0 ? totalRevenue / totalPatients : 0;
    
    // Análise de aprovação
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
      .sort(([,a], [,b]) => b - a)
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
  }, [doctors]);
  
  // ✅ CALCULAR ESTATÍSTICAS DOS MÉDICOS FILTRADOS
  const filteredStats = React.useMemo(() => {
    const totalDoctors = filteredDoctors.length;
    
    // ✅ CONTAGEM DUPLA: Total de AIHs E Pacientes Únicos
    const totalAIHs = filteredDoctors.reduce((sum, doctor) => sum + doctor.patients.length, 0);
    
    // Contar pacientes únicos (pessoas diferentes)
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
    
    // Coletar todos os procedimentos dos médicos filtrados (🚫 EXCLUINDO ANESTESISTAS 04.xxx)
    const allProcedures = filteredDoctors.flatMap(doctor => 
      doctor.patients.flatMap(patient => 
        patient.procedures.filter(filterCalculableProcedures)
      )
    );
    
    const totalProcedures = allProcedures.length;
    const totalRevenue = allProcedures.reduce((sum, proc) => sum + (proc.value_reais || 0), 0);
    
    return {
      totalDoctors,
      totalPatients, // Total de AIHs (para compatibilidade)
      totalAIHs, // Total de AIHs/internações
      uniquePatients, // Pacientes únicos
      totalProcedures,
      totalRevenue
    };
  }, [filteredDoctors]);
  
  // ✅ NOVO: Calcular pacientes com múltiplas AIHs (igual PatientManagement)
  const multipleAIHsStats = React.useMemo(() => {
    const patientAIHCount = new Map<string, number>();
    const patientDetails = new Map<string, any>(); // 🆕 Armazenar detalhes do paciente
    const patientAIHsList = new Map<string, any[]>(); // 🆕 Armazenar lista de AIHs por paciente
    let totalAIHs = 0;
    
    // Contar AIHs por paciente e coletar detalhes
    filteredDoctors.forEach(doctor => {
      doctor.patients.forEach(patient => {
        if (patient.patient_id) {
          totalAIHs++;
          const currentCount = patientAIHCount.get(patient.patient_id) || 0;
          patientAIHCount.set(patient.patient_id, currentCount + 1);
          
          // 🆕 Armazenar lista de AIHs por paciente
          if (!patientAIHsList.has(patient.patient_id)) {
            patientAIHsList.set(patient.patient_id, []);
          }
          patientAIHsList.get(patient.patient_id)!.push({
            aih_number: patient.aih_info?.aih_number || 'Não informado',
            admission_date: patient.aih_info?.admission_date,
            discharge_date: patient.aih_info?.discharge_date,
            competencia: patient.aih_info?.competencia
          });
          
          // 🆕 Armazenar detalhes do paciente (✅ CORREÇÃO: usar patient_info)
          if (!patientDetails.has(patient.patient_id)) {
            patientDetails.set(patient.patient_id, {
              patient_id: patient.patient_id,
              patient_name: patient.patient_info?.name || 'Nome não informado',
              patient_cns: patient.patient_info?.cns || 'Não informado',
              hospital_name: doctor.hospitals?.[0]?.hospital_name || 'Hospital não informado'
            });
          }
        }
      });
    });
    
    // Identificar pacientes com múltiplas AIHs (> 1)
    const patientsWithMultiple = new Map<string, number>();
    patientAIHCount.forEach((count, patientId) => {
      if (count > 1) {
        patientsWithMultiple.set(patientId, count);
      }
    });
    
    // Calcular total de AIHs de pacientes com múltiplas internações
    const totalMultipleAIHs = Array.from(patientsWithMultiple.values()).reduce((sum, count) => sum + count, 0);
    
    // 🆕 Criar array com detalhes dos pacientes com múltiplas AIHs
    const multipleAIHsDetails = Array.from(patientsWithMultiple.entries())
      .map(([patientId, count]) => ({
        ...patientDetails.get(patientId),
        aih_count: count,
        aihs: patientAIHsList.get(patientId) || [] // 🆕 Incluir lista de AIHs
      }))
      .sort((a, b) => b.aih_count - a.aih_count); // Ordenar por quantidade de AIHs (maior primeiro)
    
    return {
      totalAIHs,
      patientsWithMultipleAIHs: patientsWithMultiple.size,
      totalMultipleAIHs,
      aihsWithoutPatients: 0, // Não temos AIHs órfãs nesta view
      multipleAIHsDetails // 🆕 Array com detalhes dos pacientes
    };
  }, [filteredDoctors]);
  
  // 🚀 OTIMIZAÇÃO CRÍTICA: CACHE DE STATS POR MÉDICO
  // Calcula doctorStats UMA VEZ por médico e reutiliza em todos os contextos
  // Evita recálculos redundantes (5x por médico → 1x por médico)
  const doctorStatsCache = React.useMemo(() => {
    const cache = new Map<string, ReturnType<typeof calculateDoctorStats>>();
    
    for (const doctor of filteredDoctors) {
      const key = getDoctorCardKey(doctor);
      const stats = calculateDoctorStats(doctor);
      cache.set(key, stats);
    }
    
    console.log(`⚡ [CACHE] Stats calculados para ${cache.size} médicos (otimização: 5x → 1x por médico)`);
    return cache;
  }, [filteredDoctors]);

  // 🧮 TOTAIS AGREGADOS PARA O CABEÇALHO (SIGTAP, Incrementos, Total)
  const aggregatedOperaParanaTotals = React.useMemo(() => {
    try {
      let totalBaseSigtap = 0;
      let totalIncrement = 0;

      for (const doctor of filteredDoctors) {
        // ✅ PERFORMANCE: Usar cache de stats (evita recálculo)
        const key = getDoctorCardKey(doctor);
        const stats = doctorStatsCache.get(key);
        
        if (!stats) continue;
        
        // Base SIGTAP: valor total das AIHs
        totalBaseSigtap += stats.totalValue;
        
        // Incremento Opera Paraná: valor pré-calculado
        totalIncrement += stats.operaParanaIncrement;
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
  }, [filteredDoctors, doctorStatsCache]);

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
        totalAIHs: multipleAIHsStats.totalAIHs,
        uniquePatients: filteredStats.uniquePatients, // 🆕 Pacientes únicos
        multipleAIHsDetails: multipleAIHsStats.multipleAIHsDetails // 🆕 Passar detalhes dos pacientes
      });
    }
  }, [filteredStats, multipleAIHsStats, onStatsUpdate, isLoading]);

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







      

      {/* ✅ CABEÇALHO MINIMALISTA */}
      <Card className="shadow-sm border border-slate-200 bg-white">
        <CardHeader className="pb-4">
          <CardTitle>
            {/* HEADER COM DESIGN MINIMALISTA */}
            <div className="mb-4 pb-4 border-b border-gray-100">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                  <div className="flex items-center justify-center w-12 h-12 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-xl shadow-md">
                    <Stethoscope className="h-6 w-6 text-white" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="text-2xl font-bold text-gray-900">Produção Médica - Pagamentos Médicos</h3>
                <Badge 
                  variant="outline" 
                        className="bg-blue-50 text-blue-700 border-blue-200 px-2.5 py-0.5 text-xs font-semibold"
                >
                  {selectedHospitalName}
                </Badge>
              </div>
                    <p className="text-sm text-gray-500 mt-1">Visualização hierárquica completa: Médicos → Pacientes → Procedimentos</p>
                </div>
              </div>
                <div className="flex items-center gap-2">
                  {useSihSource && (
                    remoteConfigured ? (
                      <Badge 
                        variant="outline" 
                        className="bg-blue-50 text-blue-700 border-blue-200 px-2.5 py-0.5 text-xs font-semibold"
                      >
                        Fonte: SIH Remoto
                      </Badge>
                    ) : (
                      <Badge 
                        variant="outline" 
                        className="bg-red-50 text-red-700 border-red-200 px-2.5 py-0.5 text-xs font-semibold"
                      >
                        ⚠️ Fonte SIH remota desativada ou não configurada
                      </Badge>
                    )
                  )}
                  <div className="flex items-center gap-2 mr-2">
                    <span className="text-xs text-gray-600">Fonte SIH</span>
                    <Switch checked={useSihSource} onCheckedChange={setUseSihSource} />
                  </div>
                  <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={() => setRefreshTick(t => t + 1)}
                    className="h-9 px-3"
                  >
                  <RefreshCw className="h-4 w-4 mr-2" /> Atualizar
                </Button>
                </div>
              </div>
            </div>

            {/* TOTAIS AGREGADOS - CARDS COM GRADIENTES */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-3 mb-4">
              {/* Valor Total SIGTAP */}
              <div className="bg-gradient-to-r from-slate-50 to-gray-50 rounded-lg p-4 border-2 border-slate-200">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-xs font-bold text-slate-600 uppercase tracking-wide mb-1">
                      Valor Total SIGTAP
            </div>
                    <div className="text-2xl font-black text-slate-900">
                      {formatCurrency(aggregatedOperaParanaTotals.totalBaseSigtap)}
            </div>
            </div>
                  <div className="flex items-center justify-center w-10 h-10 bg-slate-100 rounded-full">
                    <Database className="h-5 w-5 text-slate-600" />
            </div>
          </div>
              </div>

              {/* Valor Total Incrementos */}
              <div className="bg-gradient-to-r from-emerald-50 to-green-50 rounded-lg p-4 border-2 border-emerald-200">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-xs font-bold text-emerald-700 uppercase tracking-wide mb-1">
                      Incrementos
                    </div>
                    <div className="text-2xl font-black text-emerald-700">
                      {formatCurrency(aggregatedOperaParanaTotals.totalIncrement)}
                    </div>
                  </div>
                  <div className="flex items-center justify-center w-10 h-10 bg-emerald-100 rounded-full">
                    <TrendingUp className="h-5 w-5 text-emerald-600" />
                  </div>
                </div>
              </div>

              {/* Valor Total (com Opera Paraná) */}
              <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg p-4 border-2 border-blue-200">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-xs font-bold text-blue-700 uppercase tracking-wide mb-1">
                      Valor Total
                    </div>
                    <div className="text-2xl font-black text-blue-700">
                      {formatCurrency(aggregatedOperaParanaTotals.totalWithIncrement)}
                    </div>
                  </div>
                  <div className="flex items-center justify-center w-10 h-10 bg-blue-100 rounded-full">
                    <BarChart3 className="h-5 w-5 text-blue-600" />
                  </div>
                </div>
              </div>

              {/* Pagamento Médico Total - DESTAQUE */}
              <div className="bg-gradient-to-r from-green-50 to-emerald-50 rounded-lg p-4 border-2 border-green-300 shadow-md">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-xs font-bold text-green-700 uppercase tracking-wide mb-1">
                      Pagamento Médico Total
                    </div>
                    <div className="text-2xl font-black text-green-700">
                      {formatCurrency(aggregatedMedicalPayments)}
                    </div>
                  </div>
                  <div className="flex items-center justify-center w-10 h-10 bg-green-100 rounded-full">
                    <DollarSign className="h-5 w-5 text-green-600" />
                  </div>
                </div>
              </div>
            </div>

            {/* BOTÕES DE RELATÓRIO - GRID HORIZONTAL */}
            <div className="mb-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
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
                  className="inline-flex items-center gap-2 bg-green-600 hover:bg-green-700 text-white"
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
                  className="inline-flex items-center gap-2 bg-purple-600 hover:bg-purple-700 text-white"
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
                  className="inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white"
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
                  {searchTerm ? 'Nenhum médico responsável encontrado' : 'Nenhum médico responsável cadastrado'}
                </div>
                <div className="text-sm text-gray-500">
                  {searchTerm ? 'Tente alterar os filtros de busca' : 'Processe algumas AIHs com médicos responsáveis para ver os dados'}
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
                        
                        <div className="text-sm text-muted-foreground">
                          Mostrando {startIndex + 1}-{Math.min(endIndex, totalDoctors)} de {totalDoctors} médicos
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
                  <Card key={cardKey} className="mb-4 border border-slate-200 bg-white hover:shadow-md transition-all duration-300">
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
                                  {doctorStats.totalAIHs} PACIENTES
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
                                        <Badge variant="destructive" className="text-[10px] font-semibold">
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
                              <div className="flex items-baseline gap-2">
                                <span className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide">Pacientes Atendidos:</span>
                                <span className="text-xs font-bold text-indigo-700">{doctorStats.totalAIHs}</span>
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
                              <div className="bg-gradient-to-r from-emerald-50 to-green-50 rounded-lg p-3 border-2 border-emerald-200">
                                <div className="flex items-center justify-between">
                                  <span className="text-xs font-bold text-emerald-900 uppercase tracking-wide">Total AIHs</span>
                                  <span className="text-base font-black text-emerald-700">{formatCurrency(doctorStats.totalValue)}</span>
                                </div>
                              </div>
                              <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg p-3 border-2 border-blue-200">
                                <div className="flex items-center justify-between">
                                  <span className="text-xs font-bold text-blue-900 uppercase tracking-wide">Incremento</span>
                                  <span className="text-base font-black text-blue-700">{(() => {
                                    // ✅ BEST PRACTICE: Usar valor pré-calculado de calculateDoctorStats
                                    const increment = doctorStats.operaParanaIncrement || 0;
                                    
                                    if (increment === 0) return '-';
                                    
                                    // 🔍 LOG para verificação
                                    console.log(`📈 [CARD INCREMENTO] ${doctor.doctor_info.name}: R$ ${increment.toFixed(2)}`);
                                    
                                    return formatCurrency(increment);
                                  })()}</span>
                                </div>
                              </div>
                              <div className="bg-gradient-to-r from-purple-50 to-indigo-50 rounded-lg p-3 border-2 border-purple-200">
                                <div className="flex items-center justify-between">
                                  <span className="text-xs font-bold text-purple-900 uppercase tracking-wide">c/ Opera Paraná</span>
                                  <span className="text-base font-black text-purple-700">{(() => {
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
                            <div className="bg-gradient-to-r from-green-50 to-emerald-50 rounded-lg p-4 border-2 border-green-300 shadow-sm">
                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                  <DollarSign className="h-5 w-5 text-green-600" />
                                  <span className="text-sm font-bold text-green-900 uppercase tracking-wide">Pagamento Médico</span>
                                </div>
                                <span className="text-xl font-black text-green-700">
                                  {formatCurrency((() => {
                                    // ✅ BEST PRACTICE: Usar valor pré-calculado de calculateDoctorStats
                                    // Evita recálculo no render e garante consistência
                                    // doctorStats.calculatedPaymentValue já contempla:
                                    // 1. TODOS os pacientes do médico
                                    // 2. Hierarquia correta: Fixo → Percentual → Individual
                                    // 3. Exclusão de anestesistas 04.xxx
                                    // 4. Aplicação das regras de pagamento específicas
                                    
                                    const paymentValue = doctorStats.calculatedPaymentValue || doctorStats.medicalProceduresValue || 0;
                                    
                                    // 🔍 LOG para verificação
                                    if (paymentValue > 0) {
                                      console.log(`💰 [CARD] ${doctor.doctor_info.name}: R$ ${paymentValue.toFixed(2)} (fonte: doctorStats)`);
                                    }
                                    
                                    return paymentValue;
                                  })())}
                                </span>
                              </div>
                            </div>
                          </div>

                          {/* BOTÕES DE AÇÃO - GRID HORIZONTAL */}
                          <div className="mt-4 pt-3 border-t border-gray-100">
                            <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
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
                                          const increment = doctorCovered ? computeIncrementForProcedures(p.procedures as any, p?.aih_info?.care_character, doctorName, hospitalId) : 0;
                                          const aihWithIncrements = baseAih + increment;
                                          
                                          // ✅ FIX: Mostrar todos os procedimentos da AIH (que já foi filtrada por competência)
                                          const procedures = p.procedures || [];
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
                                        (ws as any)['!cols'] = [
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
                                        const fileName = `Relatorio_Pacientes_${doctorName.replace(/\s+/g, '_')}_${formatDateFns(new Date(), 'yyyyMMdd_HHmm')}.xlsx`;
                                        XLSX.writeFile(wb, fileName);
                                        toast.success('Relatório de pacientes do médico gerado com sucesso!');
                                      } catch (err) {
                                        console.error('Erro ao exportar Relatório Pacientes (card):', err);
                                        toast.error('Erro ao gerar relatório do médico');
                                      }
                                    }}
                                    className="inline-flex items-center gap-2 bg-green-600 hover:bg-green-700 text-white shadow-md hover:shadow-lg transition-all duration-300 h-9 px-4 rounded-md text-sm"
                                  >
                                    <FileSpreadsheet className="h-4 w-4" />
                                    Relatório Pacientes
                                  </Button>
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
                                          
                                          // ✅ NOVO: Filtrar apenas procedimentos com código 04 (procedimentos médicos)
                                          // 🚫 EXCLUIR: Códigos 04 de anestesista (CBO 225151)
                                          const procedures04 = (p.procedures || [])
                                            .filter((proc: any) => {
                                              const code = proc.procedure_code || '';
                                              const cbo = proc.cbo || '';
                                              
                                              // Verificar se é código 04
                                              if (!code.toString().trim().startsWith('04')) {
                                                return false;
                                              }
                                              
                                              // 🚫 EXCLUIR: Se é anestesista (CBO 225151) com código 04, não incluir
                                              // ✅ EXCEÇÕES: Cesariana e códigos específicos devem ser incluídos
                                              if (cbo === '225151') {
                                                // Exceções que devem ser incluídas mesmo sendo anestesista
                                                const exceptions = [
                                                  '04.17.01.001-0', // Cesariana
                                                  '04.17.01.005-2',
                                                  '04.17.01.006-0'
                                                ];
                                                
                                                // Se não é uma exceção, excluir (é anestesista 04.xxx)
                                                if (!exceptions.includes(code)) {
                                                  return false;
                                                }
                                              }
                                              
                                              return true;
                                            })
                                            .map((proc: any) => proc.procedure_code || '')
                                            .filter((code: string) => code !== '');
                                          
                                          const codes04Display = procedures04.length > 0 
                                            ? procedures04.join(', ') 
                                            : 'Nenhum código 04';
                                          
                                          const dischargeISO = p?.aih_info?.discharge_date || '';
                                          const dischargeLabel = parseISODateToLocal(dischargeISO);
                                          
                                          // ✅ NOVO: Caráter de atendimento
                                          const careCharacter = p?.aih_info?.care_character || '';
                                          const careCharacterDisplay = careCharacter 
                                            ? CareCharacterUtils.getDescription(careCharacter) || careCharacter
                                            : '-';
                                          
                                          // ✅ NOVO: Calcular valor de repasse (mesma lógica do card)
                                          // ⚠️ CORREÇÃO: Usar MESMO filtro do card (apenas códigos 04.xxx)
                                          const proceduresWithPayment = p.procedures
                                            .filter((proc: any) => 
                                              isMedicalProcedure(proc.procedure_code) && 
                                              shouldCalculateAnesthetistProcedure(proc.cbo, proc.procedure_code)
                                            )
                                            .map((proc: any) => ({
                                              procedure_code: proc.procedure_code,
                                              procedure_description: proc.procedure_description,
                                              value_reais: proc.value_reais || 0,
                                            }));
                                          
                                          let repasseValue = 0;
                                          if (proceduresWithPayment.length > 0) {
                                            const paymentResult = calculateDoctorPayment(
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
                                            name,
                                            codes04Display,
                                            dischargeLabel,
                                            careCharacterDisplay,
                                            doctorName,
                                            hospitalName,
                                            formatCurrency(repasseValue) // Pode ser R$ 0,00
                                          ]);
                                         });
                                         
                                        // 📊 LOG: Resultado da inclusão de pacientes
                                        console.log(`📊 [RELATÓRIO SIMPLIFICADO] Total de pacientes incluídos: ${patientsWithPayment}`);
                                        console.log(`✅ [RELATÓRIO SIMPLIFICADO] TODOS os pacientes foram incluídos (incluindo R$ 0,00)`);
                                        console.log(`💰 [RELATÓRIO SIMPLIFICADO] Valor total de repasse: R$ ${totalRepasse.toFixed(2)}`);
                                         
                                        // ✅ ORDENAÇÃO: Por Data de Alta (mais recente primeiro)
                                        tableData.sort((a, b) => {
                                          const dateA = a[3] as string; // Data de Alta está na posição 3
                                          const dateB = b[3] as string;
                                           
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
                                        
                                        // Subtítulo com informações do médico
                                        yPosition += 8;
                                        doc.setFontSize(11);
                                        doc.setFont('helvetica', 'normal');
                                        doc.setTextColor(60, 60, 60);
                                        doc.text(`Médico: ${doctorName}`, pageWidth / 2, yPosition, { align: 'center' });
                                        
                                        yPosition += 6;
                                        doc.setFontSize(10);
                                        doc.setTextColor(100, 100, 100);
                                        doc.text(`Hospital: ${hospitalName}`, pageWidth / 2, yPosition, { align: 'center' });
                                        
                                        yPosition += 6;
                                        const dataGeracao = new Date().toLocaleDateString('pt-BR', { 
                                          day: '2-digit', 
                                          month: '2-digit', 
                                          year: 'numeric',
                                          hour: '2-digit',
                                          minute: '2-digit'
                                        });
                                        doc.text(`Gerado em: ${dataGeracao}`, pageWidth / 2, yPosition, { align: 'center' });
                                        
                                        // Linha separadora
                                        yPosition += 8;
                                        doc.setDrawColor(200, 200, 200);
                                        doc.setLineWidth(0.5);
                                        doc.line(20, yPosition, pageWidth - 20, yPosition);
                                        
                                        // ========== TABELA COM DADOS ==========
                                        const startY = yPosition + 10;
                                        
                                        autoTable(doc, {
                                          head: [['Prontuário', 'Nome do Paciente', 'Procedimentos Realizados', 'Data Alta', 'Caráter de Atendimento', 'Médico', 'Hospital', 'Valor de Repasse']],
                                          body: tableData,
                                          startY: startY,
                                          theme: 'striped',
                                          tableWidth: 'auto',
                                          headStyles: {
                                            fillColor: [0, 51, 102],
                                            textColor: [255, 255, 255],
                                            fontStyle: 'bold',
                                            fontSize: 9,
                                            halign: 'center'
                                          },
                                          bodyStyles: {
                                            fontSize: 8,
                                            textColor: [50, 50, 50],
                                            cellPadding: 2
                                          },
                                          columnStyles: {
                                            0: { cellWidth: 24, halign: 'center' }, // Prontuário (aumentado de 18 para 24)
                                            1: { cellWidth: 42, halign: 'left' },   // Nome do Paciente
                                            2: { cellWidth: 50, halign: 'left', fontSize: 7 }, // Procedimentos Realizados (ajustado de 52 para 50)
                                            3: { cellWidth: 20, halign: 'center' }, // Data Alta
                                            4: { cellWidth: 28, halign: 'left' },   // Caráter (ajustado de 30 para 28)
                                            5: { cellWidth: 32, halign: 'left' },   // Médico
                                            6: { cellWidth: 32, halign: 'left' },   // Hospital
                                            7: { cellWidth: 30, halign: 'right', fontStyle: 'bold', textColor: [0, 102, 0] }   // Valor de Repasse (verde escuro)
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
                                        
                                        // ========== RODAPÉ PROFISSIONAL ==========
                                        const finalY = (doc as any).lastAutoTable.finalY || startY + 50;
                                        const footerY = pageHeight - 20;
                                        
                                        // Linha separadora do rodapé
                                        doc.setDrawColor(200, 200, 200);
                                        doc.setLineWidth(0.5);
                                        doc.line(20, footerY - 10, pageWidth - 20, footerY - 10);
                                        
                                        // Texto do rodapé
                                        doc.setFontSize(8);
                                        doc.setFont('helvetica', 'normal');
                                        doc.setTextColor(120, 120, 120);
                                        doc.text('CIS - Centro Integrado em Saúde', pageWidth / 2, footerY - 5, { align: 'center' });
                                        
                                        // Total de pacientes e repasse
                                        doc.setFontSize(9);
                                        doc.setFont('helvetica', 'bold');
                                        doc.setTextColor(0, 51, 102);
                                        
                                        doc.text(`Total de Pacientes: ${tableData.length} | Valor Total de Repasse: ${formatCurrency(totalRepasse)}`, 
                                                 pageWidth / 2, footerY + 5, { align: 'center' });
                                        
                                        // Salvar PDF
                                        const fileName = `Relatorio_Pacientes_Simplificado_${doctorName.replace(/\s+/g, '_')}_${formatDateFns(new Date(), 'yyyyMMdd_HHmm')}.pdf`;
                                        doc.save(fileName);
                                        
                                        toast.success('Relatório PDF gerado com sucesso!');
                                       } catch (err) {
                                         console.error('Erro ao exportar Relatório Simplificado (PDF):', err);
                                         toast.error('Erro ao gerar relatório PDF');
                                       }
                                     }}
                                     className="inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white shadow-md hover:shadow-lg transition-all duration-300 h-9 px-4 rounded-md text-sm"
                                   >
                                    <FileSpreadsheet className="h-4 w-4" />
                                    Relatório Pacientes Simplificado
                                   </Button>
                                   
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
                                    className="inline-flex items-center gap-2 bg-teal-600 hover:bg-teal-700 text-white shadow-md hover:shadow-lg transition-all duration-300 h-9 px-4 rounded-md text-sm"
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
                                    className="inline-flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white shadow-md hover:shadow-lg transition-all duration-300 h-9 px-4 rounded-md text-sm"
                                  >
                                    <FileText className="h-4 w-4" />
                                    Protocolo Atendimento Atual
                                  </Button>
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
                                <div className="w-7 h-7 bg-slate-100 rounded-xl flex items-center justify-center">
                                  <User className="h-4 w-4 text-slate-600" />
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
                                      
                                      const enrichedPatients = paginatedPatients.map(patient => {
                                        // ✅ CORREÇÃO: Incluir aih_id para evitar duplicatas em pacientes recorrentes
                                        const patientKey = `${doctor.doctor_info.cns}-${patient.aih_id || patient.patient_info.cns}`;
                                        
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
                                          hospitalId
                                        );
                                        
                                        let totalPayment = 0;
                                        let showRepasseCard = false;
                                        
                                        if (fixedCalc.hasFixedRule && !hasIndividualRules) {
                                          showRepasseCard = false;
                                        } else if (isMonthlyFixed) {
                                          showRepasseCard = false;
                                        } else {
                                          const proceduresWithPayment = patient.procedures
                                            .filter(filterCalculableProcedures)
                                            .map((proc: any) => ({
                                              procedure_code: proc.procedure_code,
                                              procedure_description: proc.procedure_description,
                                              value_reais: proc.value_reais || 0,
                                            }));
                                          
                                          const paymentResult = calculateDoctorPayment(
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
                                                <div className="flex items-center justify-center w-8 h-8 bg-blue-100 rounded-full">
                                                  <User className="h-4 w-4 text-blue-600" />
                                                </div>
                                                <div className="text-base font-bold text-gray-900">
                                                  {(/procedimento/i.test(patient.patient_info.name) || /\b\d{2}\.\d{2}\.\d{2}\.\d{3}-\d\b/.test(patient.patient_info.name)) ? 'Nome não disponível' : patient.patient_info.name}
                                                </div>
                                              </div>
                                              <div className="flex items-center gap-2">
                                                <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200 text-[10px] font-semibold">
                                                  {patient.procedures.length} PROC
                                                </Badge>
                                                {patient.aih_info.care_character && (() => {
                                                  const raw = String(patient.aih_info.care_character || '').toLowerCase().trim();
                                                  return (
                                                    <Badge variant="outline" className={`text-[10px] font-semibold ${
                                                      raw === '1' || raw.includes('eletivo')
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
                                                  <span className="text-xs font-medium text-gray-900">{(patient.aih_info as any).specialty}</span>
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
                                            <div className="bg-gradient-to-r from-emerald-50 to-green-50 rounded-lg p-3 border-2 border-emerald-200">
                                              <div className="flex items-center justify-between">
                                                <div className="flex items-center gap-2">
                                                  <DollarSign className="h-4 w-4 text-emerald-600" />
                                                  <span className="text-xs font-bold text-emerald-900 uppercase tracking-wide">AIH Seca</span>
                                                </div>
                                                <span className="text-lg font-black text-emerald-700">
                                                  {formatCurrency(patient._enriched.baseAih)}
                                                </span>
                                              </div>
                                            </div>

                                            {/* INCREMENTO - SE HOUVER */}
                                            {patient._enriched.hasIncrement && (
                                              <>
                                                <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg p-3 border-2 border-blue-200">
                                                  <div className="flex items-center justify-between">
                                                    <div className="flex items-center gap-2">
                                                      <span className="text-lg">📈</span>
                                                      <span className="text-xs font-bold text-blue-900 uppercase tracking-wide">Incremento</span>
                                                    </div>
                                                    <span className="text-lg font-black text-blue-700">
                                                      {formatCurrency(patient._enriched.increment)}
                                                    </span>
                                                  </div>
                                                </div>

                                                {/* AIH C/ INCREMENTO - TOTAL FINAL */}
                                                <div className="bg-gradient-to-r from-purple-50 to-pink-50 rounded-lg p-3 border-2 border-purple-300">
                                                  <div className="flex items-center justify-between">
                                                    <div className="flex items-center gap-2">
                                                      <CheckCircle className="h-4 w-4 text-purple-600" />
                                                      <span className="text-xs font-bold text-purple-900 uppercase tracking-wide">AIH c/ Incremento</span>
                                                    </div>
                                                    <span className="text-lg font-black text-purple-700">
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
                                            {patient._enriched.showRepasseCard && (
                                              <div className="bg-gradient-to-r from-teal-50 to-cyan-50 rounded-lg p-3 border-2 border-teal-300">
                                                <div className="flex items-center justify-between">
                                                  <div className="flex items-center gap-2">
                                                    <Stethoscope className="h-4 w-4 text-teal-600" />
                                                    <span className="text-xs font-bold text-teal-900 uppercase tracking-wide">Repasse Médico</span>
                                                  </div>
                                                  <span className="text-lg font-black text-teal-700">
                                                    {formatCurrency(patient._enriched.totalPayment)}
                                                  </span>
                                                </div>
                                              </div>
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
                                                <div key={procedure.procedure_id || procIndex} className={`bg-white border rounded-lg overflow-hidden ${
                                                  isMedical04 && isPrincipal ? 'border-emerald-300 shadow-sm' : 'border-slate-200'
                                                } ${operaEligible && isPrincipal ? 'ring-2 ring-emerald-200' : ''}`}>
                                                  {/* CABEÇALHO DO PROCEDIMENTO */}
                                                  <div className={`px-4 py-2.5 border-b flex items-center justify-between ${
                                                    isMedical04 && isPrincipal ? 'bg-gradient-to-r from-emerald-50 to-teal-50 border-emerald-200' : 'bg-slate-50 border-slate-200'
                                                  }`}>
                                                    <div className="flex items-center gap-2 flex-wrap">
                                                      <span className={`text-xs font-bold uppercase tracking-wide px-2 py-1 rounded ${
                                                        isMedical04 && isPrincipal ? 'bg-emerald-600 text-white' : 'bg-slate-600 text-white'
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
                                                          return (
                                                            <div className="text-right">
                                                              <div className="text-xs font-bold text-red-600">
                                                                🚫 Sem valor
                                                              </div>
                                                              <div className="text-[9px] text-red-500">
                                                                {anesthetistInfo.message.split(':')[0]}
                                                              </div>
                                                            </div>
                                                          );
                                                        } else {
                                                          // ✅ PROCEDIMENTO NORMAL OU ANESTESISTA 03.xxx: Mostrar valor
                                                          return (
                                                            <div className={`text-base font-bold ${
                                                              isMedical04 && isPrincipal ? 'text-emerald-700' : 'text-slate-900'
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
                                                          const formatted = `${digits.slice(0,2)}.${digits.slice(2,4)}.${digits.slice(4,6)}.${digits.slice(6,9)}-${digits.slice(9)}`
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
                                                            className={`ml-2 text-[10px] ${procedure.cbo === '225151' ? 'bg-gradient-to-r from-purple-500 to-fuchsia-500 text-white border-0' : 'bg-slate-100 text-slate-700 border-slate-300'}`}
                                                          >
                                                            {procedure.cbo}
                                                          </Badge>
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
                                                      {procedure.participation && (
                                                        <div>
                                                          <span className="text-slate-500 font-medium uppercase tracking-wide">Participação:</span>
                                                          <span className="ml-2 text-slate-900">{procedure.participation}</span>
                                                        </div>
                                                      )}
                                                      
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
                                              );})}
                                            </div>
                                          )}
                                          
                                          {/* 🆕 COMPONENTE DE REGRAS DE PAGAMENTO ESPECÍFICAS */}
                                          {patient.procedures.filter(proc => 
                                            isMedicalProcedure(proc.procedure_code) && 
                                            shouldCalculateAnesthetistProcedure(proc.cbo, proc.procedure_code)
                                          ).length > 0 && (
                                            <DoctorPaymentRules
                                              doctorName={doctor.doctor_info.name}
                                              procedures={patient.procedures
                                                .filter(proc => 
                                                  isMedicalProcedure(proc.procedure_code) && 
                                                  shouldCalculateAnesthetistProcedure(proc.cbo, proc.procedure_code)
                                                )
                                                .map(proc => ({
                                                  procedure_code: proc.procedure_code,
                                                  procedure_description: proc.procedure_description,
                                                  value_reais: proc.value_reais || 0
                                                }))}
                                              hospitalId={getDoctorContextualHospitalId(doctor)}
                                              className="mt-5"
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

    </div>
  );
};

export default MedicalProductionDashboard;

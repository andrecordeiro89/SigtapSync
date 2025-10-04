import React, { useState, useEffect, useRef } from 'react';
import * as XLSX from 'xlsx';
import { format as formatDateFns } from 'date-fns';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Switch } from './ui/switch';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from './ui/dialog';
import { Input } from './ui/input';
import { Badge } from './ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from './ui/table';
import { isOperaParanaEligible as isOperaEligibleConfig } from '../config/operaParana';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from './ui/collapsible';
import { Alert, AlertDescription } from './ui/alert';
import { toast } from 'sonner';
import { supabase } from '../lib/supabase';
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
import DoctorPaymentRules, { calculateDoctorPayment, calculatePercentagePayment, calculateFixedPayment } from './DoctorPaymentRules';
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
  // Recorte local para estatísticas: respeitar modo "apenas data de alta"
  let patientsForStats = doctorData.patients;
  try {
    const useOnlyEnd = (window as any).__SIGTAP_USE_ONLY_END_DATE__ as boolean | undefined;
    const selectedEnd = (window as any).__SIGTAP_SELECTED_END_DATE__ as Date | undefined;
    if (useOnlyEnd && selectedEnd) {
      patientsForStats = doctorData.patients.filter(p => {
        const discharge = (p as any)?.aih_info?.discharge_date ? new Date((p as any).aih_info.discharge_date) : undefined;
        return !!discharge && isSameUTCDate(discharge, selectedEnd);
      });
    }
  } catch {}

  // 🚫 EXCLUIR ANESTESISTAS (apenas 04.xxx) da contagem de procedimentos
  const totalProcedures = patientsForStats.reduce((sum, patient) => 
    sum + patient.procedures.filter(filterCalculableProcedures).length, 0);
  // ✅ CORREÇÃO: USAR patient.total_value_reais QUE VEM DO calculated_total_value DA AIH
  const totalValue = patientsForStats.reduce((sum, patient) => sum + patient.total_value_reais, 0);
  const totalAIHs = patientsForStats.length;
  const avgTicket = totalAIHs > 0 ? totalValue / totalAIHs : 0;
  
  // 🔍 LOG PARA VERIFICAÇÃO DA CORREÇÃO
  if (doctorData.patients.length > 0) {
    console.log(`💰 Médico ${doctorData.doctor_info.name}: R$ ${totalValue.toFixed(2)} (usando patient.total_value_reais)`);
  }
  
  // 🚫 EXCLUIR ANESTESISTAS (apenas 04.xxx) dos procedimentos aprovados
  const approvedProcedures = patientsForStats.reduce((sum, patient) => 
    sum + patient.procedures.filter(proc => 
      proc.approval_status === 'approved' && 
      shouldCalculateAnesthetistProcedure(proc.cbo, proc.procedure_code)
    ).length, 0
  );
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
  
  // 🎯 CALCULAR SOMA DOS VALORES DO DETALHAMENTO POR PROCEDIMENTO (POR PACIENTE)
  // 🆕 VERIFICAR TIPO DE REGRA: FIXA, PERCENTUAL OU INDIVIDUAL
  const hospitalId = doctorData.hospitals?.[0]?.hospital_id;
  
  // 1. Verificar regra de valor fixo primeiro
  const fixedCalculation = calculateFixedPayment(doctorData.doctor_info.name, hospitalId);
  
  if (fixedCalculation.hasFixedRule) {
    // ✅ USAR REGRA DE VALOR FIXO
    calculatedPaymentValue = fixedCalculation.calculatedPayment;
    console.log(`🎯 ${doctorData.doctor_info.name}: ${fixedCalculation.appliedRule}`);
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
    anesthetistProcedures04Count // 🆕 Quantidade de procedimentos de anestesistas iniciados em '04'
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

// ✅ INTERFACE PARA PROPS DO COMPONENTE
interface MedicalProductionDashboardProps {
  onStatsUpdate?: (stats: {
    totalRevenue: number;
    totalDoctors: number;
    totalPatients: number;
    totalProcedures: number;
  }) => void;
  dateRange?: DateRange;
  onDateRangeChange?: (range: DateRange) => void;
  selectedHospitals?: string[]; // 🆕 FILTROS GLOBAIS DE HOSPITAL
  searchTerm?: string; // 🆕 BUSCA GLOBAL MÉDICOS
  patientSearchTerm?: string; // 🆕 NOVO: BUSCA GLOBAL PACIENTES
  selectedCareCharacter?: string; // 🆕 FILTRO GLOBAL DE CARÁTER DE ATENDIMENTO
  selectedSpecialty?: string; // 🆕 FILTRO GLOBAL DE ESPECIALIDADE
  selectedCareSpecialty?: string; // 🆕 NOVO: ESPECIALIDADE DE ATENDIMENTO (AIH)
}

// ✅ COMPONENTE PRINCIPAL
const MedicalProductionDashboard: React.FC<MedicalProductionDashboardProps> = ({ 
  onStatsUpdate, 
  dateRange, 
  onDateRangeChange,
  selectedHospitals = ['all'], // 🆕 FILTROS GLOBAIS DE HOSPITAL
  searchTerm = '', // 🆕 BUSCA GLOBAL MÉDICOS
  patientSearchTerm = '', // 🆕 NOVO: BUSCA GLOBAL PACIENTES
  selectedCareCharacter = 'all', // 🆕 FILTRO GLOBAL DE CARÁTER DE ATENDIMENTO
  selectedSpecialty = 'all', // 🆕 FILTRO GLOBAL DE ESPECIALIDADE
  selectedCareSpecialty = 'all' // 🆕 NOVO: ESPECIALIDADE DE ATENDIMENTO (AIH)
}) => {
  const { user, canAccessAllHospitals, hasFullAccess } = useAuth();
  const [doctors, setDoctors] = useState<DoctorWithPatients[]>([]);
  const [filteredDoctors, setFilteredDoctors] = useState<DoctorWithPatients[]>([]);
  // searchTerm e selectedCareCharacter agora são controlados globalmente via props
  const [availableHospitals, setAvailableHospitals] = useState<Array<{id: string, name: string, cnes?: string}>>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [expandedDoctors, setExpandedDoctors] = useState<Set<string>>(new Set());
  const [expandedPatients, setExpandedPatients] = useState<Set<string>>(new Set());
  const [showDiagnostic, setShowDiagnostic] = useState(false); // 🆕 ESTADO PARA MOSTRAR DIAGNÓSTICO
  const [showProcedureDiagnostic, setShowProcedureDiagnostic] = useState(false); // 🆕 DIAGNÓSTICO DE PROCEDIMENTOS
  const [showCleuezaDebug, setShowCleuezaDebug] = useState(false); // 🆕 DEBUG ESPECÍFICO CLEUZA
  // 🆕 REFRESH CONTROL (manual e realtime)
  const [refreshTick, setRefreshTick] = useState(0);
  const realtimeDebounceRef = useRef<NodeJS.Timeout | null>(null);
  const [autoRefresh, setAutoRefresh] = useState<boolean>(true);
  // 🆕 MODAL RELATÓRIO SUS
  const [reportModalOpen, setReportModalOpen] = useState<boolean>(false);

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
          // NOVO: usar caminho direto nas tabelas (aihs + patients + procedure_records)
          const dateFromISO = dateRange ? dateRange.startDate.toISOString() : undefined;
          const dateToISO = dateRange ? dateRange.endDate.toISOString() : undefined;
          const selectedHospitalIds = (selectedHospitals && !selectedHospitals.includes('all')) ? selectedHospitals : undefined;
          const doctorsWithPatients = await DoctorsHierarchyV2Service.getDoctorsHierarchyV2({
            hospitalIds: selectedHospitalIds,
            dateFromISO,
            dateToISO,
            careCharacter: selectedCareCharacter
          });
          // Usar diretamente a fonte das tabelas, garantindo pacientes e procedimentos
          mergedDoctors = doctorsWithPatients;
          console.log('✅ Associação Médicos → Pacientes carregada direto das tabelas:', mergedDoctors.filter(d => d.patients.length > 0).length, 'médicos com pacientes');
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
  }, [user, canAccessAllHospitals, hasFullAccess, selectedHospitals, dateRange, refreshTick, selectedCareCharacter]);

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
          if (dateRange) {
            const adm = new Date(row.admission_date);
            const start = dateRange.startDate;
            const end = new Date(dateRange.endDate);
            end.setHours(23, 59, 59, 999);
            if (adm < start || adm > end) return;
          }
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
          if (dateRange) {
            const procDate = new Date(row.procedure_date);
            const start = dateRange.startDate;
            const end = new Date(dateRange.endDate);
            end.setHours(23, 59, 59, 999);
            if (procDate < start || procDate > end) return;
          }
        } catch {}
        if (realtimeDebounceRef.current) clearTimeout(realtimeDebounceRef.current);
        realtimeDebounceRef.current = setTimeout(() => setRefreshTick((t) => t + 1), 800);
      })
      .subscribe();

    return () => {
      try { supabase.removeChannel(channel); } catch {}
      if (realtimeDebounceRef.current) clearTimeout(realtimeDebounceRef.current);
    };
  }, [autoRefresh, selectedHospitals, dateRange]);

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

    // Filtrar por especialidade MÉDICA (global)
    if (selectedSpecialty && selectedSpecialty !== 'all') {
      const sel = selectedSpecialty.toLowerCase();
      filtered = filtered.filter(doctor => (doctor.doctor_info.specialty || '').toLowerCase() === sel);
    }

    // Filtrar por Especialidade de Atendimento (AIH) no nível de pacientes dentro de cada médico
    if (selectedCareSpecialty && selectedCareSpecialty !== 'all') {
      const selCare = selectedCareSpecialty.toLowerCase();
      filtered = filtered.map(doctor => {
        const patientsFiltered = doctor.patients.filter(p => {
          const aihSpec = (((p as any).aih_info?.specialty) || ((p as any).aih_info?.especialidade) || '').toString();
          return aihSpec.toLowerCase() === selCare;
        });
        return { ...doctor, patients: patientsFiltered } as typeof doctor;
      }).filter(d => d.patients.length > 0);
    }

    // Remover médicos sem pacientes no dia selecionado quando o toggle "apenas alta" estiver ativo
    try {
      const useOnlyEnd = (window as any).__SIGTAP_USE_ONLY_END_DATE__ as boolean | undefined;
      const selectedEnd = (window as any).__SIGTAP_SELECTED_END_DATE__ as Date | undefined;
      if (useOnlyEnd && selectedEnd) {
        filtered = filtered.map(d => {
          const patientsFiltered = d.patients.filter(p => {
            const discharge = (p as any)?.aih_info?.discharge_date ? new Date((p as any).aih_info.discharge_date) : undefined;
            return !!discharge && isSameUTCDate(discharge, selectedEnd);
          });
          return { ...d, patients: patientsFiltered } as typeof d;
        }).filter(d => d.patients.length > 0);
      }
    } catch {}

    setFilteredDoctors(filtered);
    
    // Reset da página atual quando filtros são aplicados
    setCurrentDoctorPage(1);
  }, [searchTerm, patientSearchTerm, selectedSpecialty, selectedCareSpecialty, doctors, selectedHospitals, selectedCareCharacter, dateRange]);

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
    const totalPatients = doctors.reduce((sum, doctor) => sum + doctor.patients.length, 0);
    
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
      totalPatients,
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
    const totalPatients = filteredDoctors.reduce((sum, doctor) => sum + doctor.patients.length, 0);
    
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
      totalPatients,
      totalProcedures,
      totalRevenue
    };
  }, [filteredDoctors]);
  
  // 🧮 TOTAIS AGREGADOS PARA O CABEÇALHO (SIGTAP, Incrementos, Total)
  const aggregatedOperaParanaTotals = React.useMemo(() => {
    try {
      let totalBaseSigtap = 0;
      let totalIncrement = 0;

      for (const doctor of filteredDoctors) {
        // Base SIGTAP: somatório do valor total das AIHs por médico (patient.total_value_reais)
        const baseForDoctor = doctor.patients.reduce((sum, p) => sum + (p.total_value_reais || 0), 0);
        totalBaseSigtap += baseForDoctor;

        // Incremento Opera Paraná: mesma regra da tabela do card do médico
        const hospitalId = doctor.hospitals?.[0]?.hospital_id;
        const doctorCovered = isDoctorCoveredForOperaParana(doctor.doctor_info.name, hospitalId);
        if (!doctorCovered) continue;
        const incrementForDoctor = (doctor.patients || []).reduce((acc, p) => (
          acc + computeIncrementForProcedures(
            p.procedures as any,
            (p as any)?.aih_info?.care_character,
            doctor.doctor_info.name,
            hospitalId
          )
        ), 0);
        totalIncrement += incrementForDoctor;
      }

      return {
        totalBaseSigtap,
        totalIncrement,
        totalWithIncrement: totalBaseSigtap + totalIncrement
      };
    } catch {
      return { totalBaseSigtap: 0, totalIncrement: 0, totalWithIncrement: 0 };
    }
  }, [filteredDoctors]);

  // 🧮 NOVO KPI: Soma dos Pagamentos Médicos (por médico) para comparação
  const aggregatedMedicalPayments = React.useMemo(() => {
    try {
      let totalPayments = 0;
      for (const doctor of filteredDoctors) {
        const stats = calculateDoctorStats(doctor);
        const doctorPayment = (stats.calculatedPaymentValue && stats.calculatedPaymentValue > 0)
          ? stats.calculatedPaymentValue
          : (stats.medicalProceduresValue || 0);
        totalPayments += doctorPayment;
      }
      return totalPayments;
    } catch {
      return 0;
    }
  }, [filteredDoctors]);

  // ✅ ATUALIZAR ESTATÍSTICAS NO COMPONENTE PAI (BASEADO NOS MÉDICOS FILTRADOS)
  useEffect(() => {
    if (onStatsUpdate && !isLoading) {
      onStatsUpdate({
        totalRevenue: filteredStats.totalRevenue,
        totalDoctors: filteredStats.totalDoctors,
        totalPatients: filteredStats.totalPatients,
        totalProcedures: filteredStats.totalProcedures
      });
    }
  }, [filteredStats, onStatsUpdate, isLoading]);

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







      

      {/* ✅ CONTROLES E FILTROS MODERNOS */}
      <Card className="shadow-lg border-0 bg-gradient-to-br from-white to-blue-50/30">
        <CardHeader className="pb-4">
          <CardTitle>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center shadow-lg">
              <Stethoscope className="h-5 w-5 text-white" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="text-xl font-bold text-gray-900">Produção Médica - Pagamentos Médicos</h3>
                <Badge 
                  variant="outline" 
                  className="bg-gradient-to-br from-blue-50/80 to-blue-100/50 text-blue-800 border-blue-200/70 shadow-sm backdrop-blur-sm px-2.5 py-0.5 text-xs font-semibold"
                >
                  {selectedHospitalName}
                </Badge>
              </div>
              <p className="text-sm text-gray-600 mt-1">Visualização hierárquica completa: Médicos → Pacientes → Procedimentos</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                {/* Toggle de Atualização automática ocultado */}
                <Button variant="outline" size="sm" onClick={() => setRefreshTick(t => t + 1)}>
                  <RefreshCw className="h-4 w-4 mr-2" /> Atualizar
                </Button>
                <Button
                  variant="default"
                  size="sm"
                  onClick={async () => {
                    try {
                      const rows: Array<Array<string | number>> = [];
                       const header = [
                         '#', 
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
                         'Valor Procedimento',
                         'AIH Seca',
                         'Incremento',
                         'AIH c/ Incremento'
                       ];
                      let idx = 1;
                      let totalPatientsFound = 0;
                      let excludedByDateFilter = 0;
                      let patientsWithoutAIH = 0;
                      
                      console.log('🔍 [RELATÓRIO GERAL] Iniciando coleta de dados...');
                      console.log('🔍 [RELATÓRIO GERAL] Médicos filtrados:', filteredDoctors.length);
                      console.log('🔍 [RELATÓRIO GERAL] Filtro de data:', dateRange ? `${dateRange.startDate.toLocaleDateString('pt-BR')} a ${dateRange.endDate.toLocaleDateString('pt-BR')}` : 'Sem filtro');
                      
                      filteredDoctors.forEach((card: any) => {
                        const doctorName = card.doctor_info?.name || '';
                        const hospitalName = card.hospitals?.[0]?.hospital_name || '';
                        console.log(`👨‍⚕️ [RELATÓRIO GERAL] Médico: ${doctorName} - Pacientes: ${(card.patients || []).length}`);
                        
                        (card.patients || []).forEach((p: any) => {
                          totalPatientsFound++;
                          
                          // ✅ FILTRO UNIFICADO: Intervalo de datas (mesmo filtro do relatório simplificado)
                          if (dateRange && dateRange.startDate && dateRange.endDate) {
                            const discharge = p?.aih_info?.discharge_date ? new Date(p.aih_info.discharge_date) : undefined;
                            
                            if (!discharge) {
                              excludedByDateFilter++;
                              return;
                            }
                            
                            // Normalizar datas para comparação (início do dia para startDate, fim do dia para endDate)
                            const startOfPeriod = new Date(dateRange.startDate);
                            startOfPeriod.setHours(0, 0, 0, 0);
                            
                            const endOfPeriod = new Date(dateRange.endDate);
                            endOfPeriod.setHours(23, 59, 59, 999);
                            
                            const dischargeDate = new Date(discharge);
                            
                            if (dischargeDate < startOfPeriod || dischargeDate > endOfPeriod) {
                              excludedByDateFilter++;
                              return;
                            }
                          }
                          
                          const name = p.patient_info?.name || 'Paciente';
                          // 🔧 CORREÇÃO: Incluir pacientes sem AIH com aviso
                          const aihRaw = (p?.aih_info?.aih_number || '').toString().replace(/\D/g, '');
                          const aih = aihRaw || 'Aguardando geração';
                          
                          if (!aihRaw) {
                            patientsWithoutAIH++;
                            console.log(`⚠️ [RELATÓRIO GERAL] Paciente sem AIH incluído: ${name}`);
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
                          const disLabel = disISO
                            ? (() => { const s = String(disISO); const m = s.match(/^(\d{4})-(\d{2})-(\d{2})/); return m ? `${m[3]}/${m[2]}/${m[1]}` : formatDateFns(new Date(s), 'dd/MM/yyyy'); })()
                            : '';
                          
                          // Calcular valor da AIH com incrementos Opera Paraná
                          const baseAih = Number(p.total_value_reais || 0);
                          const doctorCovered = isDoctorCoveredForOperaParana(doctorName, card.hospitals?.[0]?.hospital_id);
                          const increment = doctorCovered ? computeIncrementForProcedures(p.procedures as any, p?.aih_info?.care_character, doctorName, card.hospitals?.[0]?.hospital_id) : 0;
                          const aihWithIncrements = baseAih + increment;
                          
                          // Se o paciente tem procedimentos, criar uma linha para cada procedimento
                          const procedures = p.procedures || [];
                          if (procedures.length > 0) {
                            procedures.forEach((proc: any) => {
                              const procCode = proc.procedure_code || '';
                              const procDesc = proc.procedure_description || proc.sigtap_description || '';
                              const procDate = proc.procedure_date || '';
                              const procDateLabel = procDate 
                                ? (() => { 
                                    const s = String(procDate); 
                                    const m = s.match(/^(\d{4})-(\d{2})-(\d{2})/); 
                                    return m ? `${m[3]}/${m[2]}/${m[1]}` : formatDateFns(new Date(s), 'dd/MM/yyyy'); 
                                  })()
                                : '';
                              const procValue = Number(proc.value_reais || 0);
                              
                              rows.push([
                                idx++, 
                                name, 
                                aih, // Usar aih que pode ser "Aguardando geração"
                                procCode,
                                procDesc,
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
                            // Se não tem procedimentos, criar uma linha sem dados de procedimento
                            rows.push([
                              idx++, 
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
                        const dateA = a[6] as string; // Data Alta (SUS) está na posição 6 (0-indexed)
                        const dateB = b[6] as string;
                        
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
                      
                      // 🔧 AVISO: Exibir estatísticas sobre registros incluídos
                      console.log('📊 [RELATÓRIO GERAL] Estatísticas finais:');
                      console.log(`📊 [RELATÓRIO GERAL] Total de pacientes encontrados: ${totalPatientsFound}`);
                      console.log(`📊 [RELATÓRIO GERAL] Excluídos por filtro de data: ${excludedByDateFilter}`);
                      console.log(`📊 [RELATÓRIO GERAL] Pacientes sem AIH incluídos: ${patientsWithoutAIH}`);
                      console.log(`📊 [RELATÓRIO GERAL] Total de linhas no relatório: ${rows.length}`);
                      
                      // Renumerar após ordenação
                      rows.forEach((row, index) => {
                        row[0] = index + 1; // Atualizar numeração sequencial
                      });
                      
                      const wb = XLSX.utils.book_new();
                      const ws = XLSX.utils.aoa_to_sheet([header, ...rows]);
                      (ws as any)['!cols'] = [
                        { wch: 5 },   // #
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
                        { wch: 18 },  // Valor Procedimento
                        { wch: 18 },  // AIH Seca
                        { wch: 18 },  // Incremento
                        { wch: 20 },  // AIH c/ Incremento
                      ];
                      XLSX.utils.book_append_sheet(wb, ws, 'Pacientes');
                      const fileName = `Relatorio_Pacientes_Procedimentos_${formatDateFns(new Date(), 'yyyyMMdd_HHmm')}.xlsx`;
                      XLSX.writeFile(wb, fileName);
                      
                      // ✅ Notificação única e clara
                      if (patientsWithoutAIH > 0) {
                        toast.success(`Relatório geral gerado! ${patientsWithoutAIH} registro(s) sem AIH incluído(s).`);
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
                
                {/* 🆕 NOVO: Relatório Pacientes Geral Simplificado */}
                <Button
                  variant="default"
                  size="sm"
                  onClick={async () => {
                    try {
                      const useOnlyEnd = (window as any).__SIGTAP_USE_ONLY_END_DATE__ as boolean | undefined;
                      const selectedEnd = (window as any).__SIGTAP_SELECTED_END_DATE__ as Date | undefined;
                      const rows: Array<Array<string | number>> = [];
                      const header = [
                        '#', 
                        'Nome do Paciente', 
                        'Nº AIH', 
                        'Data de Admissão',
                        'Data de Alta'
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
                      console.log('🔍 [RELATÓRIO SIMPLIFICADO] Filtro de data:', dateRange ? `${dateRange.startDate.toLocaleDateString('pt-BR')} a ${dateRange.endDate.toLocaleDateString('pt-BR')}` : 'Sem filtro');
                      
                      filteredDoctors.forEach((card: any) => {
                        const doctorName = card.doctor_info?.name || 'Médico não identificado';
                        const doctorPatients = card.patients || [];
                        console.log(`👨‍⚕️ [RELATÓRIO SIMPLIFICADO] Médico: ${doctorName} - Pacientes: ${doctorPatients.length}`);
                        
                        doctorPatients.forEach((p: any) => {
                          totalPatientsFound++;
                          
                          // ✅ FILTRO UNIFICADO: Intervalo de datas (mesmo do relatório geral)
                          if (dateRange && dateRange.startDate && dateRange.endDate) {
                            const discharge = p?.aih_info?.discharge_date ? new Date(p.aih_info.discharge_date) : undefined;
                            
                            if (!discharge) {
                              excludedByDateFilter++;
                              return;
                            }
                            
                            // Normalizar datas para comparação (início do dia para startDate, fim do dia para endDate)
                            const startOfPeriod = new Date(dateRange.startDate);
                            startOfPeriod.setHours(0, 0, 0, 0);
                            
                            const endOfPeriod = new Date(dateRange.endDate);
                            endOfPeriod.setHours(23, 59, 59, 999);
                            
                            const dischargeDate = new Date(discharge);
                            
                            if (dischargeDate < startOfPeriod || dischargeDate > endOfPeriod) {
                              excludedByDateFilter++;
                              return;
                            }
                          }
                          
                          // 🔧 CORREÇÃO: Pacientes podem não ter AIH gerada ainda - INCLUIR TODOS
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
                            console.log(`⚠️ [RELATÓRIO SIMPLIFICADO] Paciente sem AIH incluído: ${p.patient_info?.name || 'Sem nome'}`);
                          }
                          
                          const name = p.patient_info?.name || 'Paciente';
                          const admissionISO = p?.aih_info?.admission_date || '';
                          const admissionLabel = admissionISO
                            ? (() => { const s = String(admissionISO); const m = s.match(/^(\d{4})-(\d{2})-(\d{2})/); return m ? `${m[3]}/${m[2]}/${m[1]}` : formatDateFns(new Date(s), 'dd/MM/yyyy'); })()
                            : '';
                          const dischargeISO = p?.aih_info?.discharge_date || '';
                          const dischargeLabel = dischargeISO
                            ? (() => { const s = String(dischargeISO); const m = s.match(/^(\d{4})-(\d{2})-(\d{2})/); return m ? `${m[3]}/${m[2]}/${m[1]}` : formatDateFns(new Date(s), 'dd/MM/yyyy'); })()
                            : '';
                          
                          allPatients.push({
                            name,
                            aih: aihDisplay, // Usar aihDisplay que inclui "Aguardando geração" se vazio
                            admissionLabel,
                            dischargeLabel
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
                      console.log(`📊 [RELATÓRIO SIMPLIFICADO] Total encontrado: ${totalPatientsFound}`);
                      console.log(`📊 [RELATÓRIO SIMPLIFICADO] Excluídos por data: ${excludedByDateFilter}`);
                      console.log(`📊 [RELATÓRIO SIMPLIFICADO] Pacientes sem AIH incluídos: ${allPatients.filter(p => p.aih === 'Aguardando geração').length}`);
                      console.log(`🤱 [RELATÓRIO SIMPLIFICADO] Partos cesareanos identificados: ${cesareanCount}`);
                      console.log(`📊 [RELATÓRIO SIMPLIFICADO] Incluídos no relatório: ${allPatients.length}`);
                      console.log(`📊 [RELATÓRIO SIMPLIFICADO] Diferença esperada vs real: ${323 - allPatients.length}`);
                      
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
                          patient.aih,
                          patient.admissionLabel,
                          patient.dischargeLabel
                        ]);
                      });
                      
                      const wb = XLSX.utils.book_new();
                      const ws = XLSX.utils.aoa_to_sheet([header, ...rows]);
                      (ws as any)['!cols'] = [
                        { wch: 5 },   // #
                        { wch: 40 },  // Nome do Paciente
                        { wch: 18 },  // Nº AIH
                        { wch: 18 },  // Data de Admissão
                        { wch: 18 },  // Data de Alta
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

          {/* 🧮 Totais Agregados - SIGTAP, Incrementos, Total e Pagamento Médico Total */}
          <div className="mt-4 grid grid-cols-1 md:grid-cols-4 gap-3">
            <div className="rounded-lg border border-slate-200 bg-white p-3">
              <div className="text-[11px] uppercase text-slate-500">Valor Total SIGTAP</div>
              <div className="text-xl font-extrabold text-slate-900">{formatCurrency(aggregatedOperaParanaTotals.totalBaseSigtap)}</div>
            </div>
            <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3">
              <div className="text-[11px] uppercase text-emerald-700">Valor Total Incrementos</div>
              <div className="text-xl font-extrabold text-emerald-700">{formatCurrency(aggregatedOperaParanaTotals.totalIncrement)}</div>
            </div>
            <div className="rounded-lg border border-blue-200 bg-blue-50 p-3">
              <div className="text-[11px] uppercase text-blue-700">Valor Total</div>
              <div className="text-xl font-extrabold text-blue-700">{formatCurrency(aggregatedOperaParanaTotals.totalWithIncrement)}</div>
            </div>
            <div className="rounded-lg border-2 border-green-500 bg-green-50 p-3 shadow-sm">
              <div className="text-[11px] uppercase text-green-700">Pagamento Médico Total</div>
              <div className="text-xl font-extrabold text-green-700">{formatCurrency(aggregatedMedicalPayments)}</div>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">


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
                  .map((doctor) => ({
                    ...doctor,
                    totalValue: calculateDoctorStats(doctor).totalValue
                  }))
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
                const doctorStats = calculateDoctorStats(doctor);
                const cardKey = getDoctorCardKey(doctor);
                const isExpanded = expandedDoctors.has(cardKey);
                
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
                  <Card key={cardKey} className="mb-6 border border-slate-200/60 bg-white/80 backdrop-blur-sm hover:shadow-lg hover:border-slate-300/60 transition-all duration-500 ease-out">
                    <Collapsible>
                      <CollapsibleTrigger asChild>
                        <div 
                          className="w-full cursor-pointer hover:bg-slate-50/50 transition-all duration-300 ease-out"
                          onClick={() => toggleDoctorExpansion(cardKey)}
                        >
                          <div className="p-6">
                            <div className="flex items-center justify-between mb-6">
                              <div className="flex items-center gap-4 flex-1">
                                {/* ÍCONE DE EXPANSÃO E AVATAR */}
                                <div className="flex items-center gap-3 shrink-0">
                                  {isExpanded ? (
                                    <ChevronDown className="h-5 w-5 text-slate-500 transition-transform duration-300" />
                                  ) : (
                                    <ChevronRight className="h-5 w-5 text-slate-500 transition-transform duration-300" />
                                  )}
                                </div>
                                
                                {/* INFORMAÇÕES PRINCIPAIS DO MÉDICO */}
                                <div className="w-full">
                                  <div className="grid grid-cols-1 md:grid-cols-12 gap-3">
                                    <div className="md:col-start-1 md:col-span-4 min-w-0">
                                      <div className="text-[11px] uppercase text-slate-500">Médico</div>
                                      <div className="text-base font-semibold text-slate-900 truncate" title={doctor.doctor_info.name}>{doctor.doctor_info.name}</div>
                                    </div>
                                    <div className="md:col-start-5 md:col-span-2 whitespace-nowrap hidden md:hidden">
                                      <div className="text-[11px] uppercase text-slate-500">CNS</div>
                                      <div className="text-sm font-mono text-slate-900 whitespace-nowrap">{doctor.doctor_info.cns || '—'}</div>
                                    </div>
                                    <div className="md:col-start-6 md:col-span-3 min-w-0">
                                      <div className="text-[11px] uppercase text-slate-500">Especialidade</div>
                                      <div className="text-sm font-medium text-slate-900 truncate" title={doctor.doctor_info.specialty || '—'}>{doctor.doctor_info.specialty || '—'}</div>
                                    </div>
                                    <div className="md:col-start-9 md:col-span-3 min-w-0">
                                      <div className="text-[11px] uppercase text-slate-500">Regras do Procedimento</div>
                                      <div className="text-sm font-medium text-slate-800" title={(() => {
                                        const hospitalId = doctor.hospitals?.[0]?.hospital_id;
                                        const fixedCalc = calculateFixedPayment(doctor.doctor_info.name, hospitalId);
                                        if (fixedCalc.hasFixedRule) return 'Valor Fixo';
                                        const percentageCalc = calculatePercentagePayment(doctor.doctor_info.name, doctorStats.totalValue, hospitalId);
                                        if (percentageCalc.hasPercentageRule) return `${percentageCalc.appliedRule.match(/\d+%/)?.[0] || '65%'} do Total`;
                                        if (doctorStats.calculatedPaymentValue > 0) return 'Regras por Procedimento';
                                        return '—';
                                      })()}>{(() => {
                                        const hospitalId = doctor.hospitals?.[0]?.hospital_id;
                                        const fixedCalc = calculateFixedPayment(doctor.doctor_info.name, hospitalId);
                                        if (fixedCalc.hasFixedRule) return 'Valor Fixo';
                                        const percentageCalc = calculatePercentagePayment(doctor.doctor_info.name, doctorStats.totalValue, hospitalId);
                                        if (percentageCalc.hasPercentageRule) return `${percentageCalc.appliedRule.match(/\d+%/)?.[0] || '65%'} do Total`;
                                        if (doctorStats.calculatedPaymentValue > 0) return 'Regras por Procedimento';
                                        return '—';
                                      })()}</div>
                                    </div>
                                  </div>
                                </div>
                              </div>
                              
                              {/* ESTATÍSTICAS FINANCEIRAS */}
                               <div className="text-right">
                                 {/* Botões de Relatório por Médico */}
                                 <div className="mt-3 flex flex-col gap-2">
                                  <Button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      try {
                                        const rows: Array<Array<string | number>> = [];
                                        // ✅ MESMAS 15 COLUNAS DO RELATÓRIO GERAL
                                        const header = [
                                          '#', 
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
                                          'Valor Procedimento',
                                          'AIH Seca',
                                          'Incremento',
                                          'AIH c/ Incremento'
                                        ];
                                        let idx = 1;
                                        const doctorName = doctor.doctor_info?.name || '';
                                        const hospitalName = doctor.hospitals?.[0]?.hospital_name || '';
                                        const hospitalId = doctor.hospitals?.[0]?.hospital_id;
                                        
                                        console.log(`📊 [RELATÓRIO MÉDICO] Gerando relatório para ${doctorName}`);
                                        console.log(`📊 [RELATÓRIO MÉDICO] Filtro de data:`, dateRange ? `${dateRange.startDate.toLocaleDateString('pt-BR')} a ${dateRange.endDate.toLocaleDateString('pt-BR')}` : 'Sem filtro');
                                        
                                        (doctor.patients || []).forEach((p: any) => {
                                          // ✅ FILTRO UNIFICADO: Intervalo de datas (mesmo dos relatórios gerais)
                                          if (dateRange && dateRange.startDate && dateRange.endDate) {
                                            const discharge = p?.aih_info?.discharge_date ? new Date(p.aih_info.discharge_date) : undefined;
                                            
                                            if (!discharge) return;
                                            
                                            const startOfPeriod = new Date(dateRange.startDate);
                                            startOfPeriod.setHours(0, 0, 0, 0);
                                            
                                            const endOfPeriod = new Date(dateRange.endDate);
                                            endOfPeriod.setHours(23, 59, 59, 999);
                                            
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
                                            ? (() => { const s = String(disISO); const m = s.match(/^(\d{4})-(\d{2})-(\d{2})/); return m ? `${m[3]}/${m[2]}/${m[1]}` : formatDateFns(new Date(s), 'dd/MM/yyyy'); })()
                                            : '';
                                          
                                          // ✅ CÁLCULOS FINANCEIROS (mesma lógica do relatório geral)
                                          const baseAih = Number(p.total_value_reais || 0);
                                          const doctorCovered = isDoctorCoveredForOperaParana(doctorName, hospitalId);
                                          const increment = doctorCovered ? computeIncrementForProcedures(p.procedures as any, p?.aih_info?.care_character, doctorName, hospitalId) : 0;
                                          const aihWithIncrements = baseAih + increment;
                                          
                                          // ✅ DETALHAMENTO POR PROCEDIMENTO (mesma lógica do relatório geral)
                                          const procedures = p.procedures || [];
                                          if (procedures.length > 0) {
                                            procedures.forEach((proc: any) => {
                                              const procCode = proc.procedure_code || '';
                                              const procDesc = proc.procedure_description || proc.sigtap_description || '';
                                              const procDate = proc.procedure_date || '';
                                              const procDateLabel = procDate 
                                                ? (() => { 
                                                    const s = String(procDate); 
                                                    const m = s.match(/^(\d{4})-(\d{2})-(\d{2})/); 
                                                    return m ? `${m[3]}/${m[2]}/${m[1]}` : formatDateFns(new Date(s), 'dd/MM/yyyy'); 
                                                  })()
                                                : '';
                                              const procValue = Number(proc.value_reais || 0);
                                              
                                              rows.push([
                                                idx++, 
                                                name, 
                                                aih,
                                                procCode,
                                                procDesc,
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
                                          const dateA = a[6] as string; // Data Alta (SUS) está na posição 6
                                          const dateB = b[6] as string;
                                          
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
                                        // ✅ LARGURAS DAS COLUNAS (mesmas do relatório geral)
                                        (ws as any)['!cols'] = [
                                          { wch: 5 },   // #
                                          { wch: 35 },  // Nome do Paciente
                                          { wch: 18 },  // Nº AIH
                                          { wch: 20 },  // Código Procedimento
                                          { wch: 45 },  // Descrição Procedimento
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
                                     onClick={(e) => {
                                       e.stopPropagation();
                                       try {
                                         const rows: Array<Array<string | number>> = [];
                                         // ✅ MESMAS 5 COLUNAS DO RELATÓRIO GERAL SIMPLIFICADO
                                         const header = [
                                           '#', 
                                           'Nome do Paciente', 
                                           'Nº AIH', 
                                           'Data de Admissão',
                                           'Data de Alta'
                                         ];
                                         let idx = 1;
                                         const doctorName = doctor.doctor_info?.name || '';
                                         
                                         console.log(`📊 [RELATÓRIO MÉDICO SIMPLIFICADO] Gerando para ${doctorName}`);
                                         console.log(`📊 [RELATÓRIO MÉDICO SIMPLIFICADO] Filtro de data:`, dateRange ? `${dateRange.startDate.toLocaleDateString('pt-BR')} a ${dateRange.endDate.toLocaleDateString('pt-BR')}` : 'Sem filtro');
                                         
                                         (doctor.patients || []).forEach((p: any) => {
                                           // ✅ FILTRO UNIFICADO: Intervalo de datas (mesmo dos outros relatórios)
                                           if (dateRange && dateRange.startDate && dateRange.endDate) {
                                             const discharge = p?.aih_info?.discharge_date ? new Date(p.aih_info.discharge_date) : undefined;
                                             
                                             if (!discharge) return;
                                             
                                             const startOfPeriod = new Date(dateRange.startDate);
                                             startOfPeriod.setHours(0, 0, 0, 0);
                                             
                                             const endOfPeriod = new Date(dateRange.endDate);
                                             endOfPeriod.setHours(23, 59, 59, 999);
                                             
                                             const dischargeDate = new Date(discharge);
                                             
                                             if (dischargeDate < startOfPeriod || dischargeDate > endOfPeriod) {
                                               return;
                                             }
                                           }
                                           
                                           const name = p.patient_info?.name || 'Paciente';
                                           const aih = (p?.aih_info?.aih_number || '').toString().replace(/\D/g, '');
                                           const aihDisplay = aih || 'Aguardando geração';
                                           
                                           const admissionISO = p?.aih_info?.admission_date || '';
                                           const admissionLabel = admissionISO
                                             ? (() => { const s = String(admissionISO); const m = s.match(/^(\d{4})-(\d{2})-(\d{2})/); return m ? `${m[3]}/${m[2]}/${m[1]}` : formatDateFns(new Date(s), 'dd/MM/yyyy'); })()
                                             : '';
                                           const dischargeISO = p?.aih_info?.discharge_date || '';
                                           const dischargeLabel = dischargeISO
                                             ? (() => { const s = String(dischargeISO); const m = s.match(/^(\d{4})-(\d{2})-(\d{2})/); return m ? `${m[3]}/${m[2]}/${m[1]}` : formatDateFns(new Date(s), 'dd/MM/yyyy'); })()
                                             : '';
                                           
                                           rows.push([
                                             idx++,
                                             name,
                                             aihDisplay,
                                             admissionLabel,
                                             dischargeLabel
                                           ]);
                                         });
                                         
                                         // ✅ ORDENAÇÃO: Por Data de Alta (mais recente primeiro)
                                         rows.sort((a, b) => {
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
                                         
                                         // Renumerar após ordenação
                                         rows.forEach((row, index) => {
                                           row[0] = index + 1;
                                         });
                                         
                                         console.log(`📊 [RELATÓRIO MÉDICO SIMPLIFICADO] Total de linhas: ${rows.length} (ordenadas por data de alta DESC)`);
                                         
                                         const wb = XLSX.utils.book_new();
                                         const ws = XLSX.utils.aoa_to_sheet([header, ...rows]);
                                         // ✅ LARGURAS DAS COLUNAS (mesmas do relatório geral simplificado)
                                         (ws as any)['!cols'] = [
                                           { wch: 5 },   // #
                                           { wch: 40 },  // Nome do Paciente
                                           { wch: 18 },  // Nº AIH
                                           { wch: 18 },  // Data de Admissão
                                           { wch: 18 },  // Data de Alta
                                         ];
                                         XLSX.utils.book_append_sheet(wb, ws, 'Pacientes Simplificado');
                                         const fileName = `Relatorio_Pacientes_Simplificado_${doctorName.replace(/\s+/g, '_')}_${formatDateFns(new Date(), 'yyyyMMdd_HHmm')}.xlsx`;
                                         XLSX.writeFile(wb, fileName);
                                         toast.success('Relatório simplificado do médico gerado com sucesso!');
                                       } catch (err) {
                                         console.error('Erro ao exportar Relatório Simplificado (card):', err);
                                         toast.error('Erro ao gerar relatório simplificado do médico');
                                       }
                                     }}
                                     className="inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white shadow-md hover:shadow-lg transition-all duration-300 h-9 px-4 rounded-md text-sm"
                                   >
                                    <FileSpreadsheet className="h-4 w-4" />
                                    Relatório Pacientes Simplificado
                                   </Button>
                                  
                                  <Button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      try {
                                        const rows: Array<Array<string | number>> = [];
                                        // ✅ RELATÓRIO DE ANESTESISTAS: Foco em CONTAGEM de procedimentos
                                        const header = [
                                          '#', 
                                          'Nome do Paciente', 
                                          'Nº AIH',
                                          'Código Proc. Anestésico',
                                          'Descrição Proc. Anestésico',
                                          'Data Procedimento',
                                          'Data Alta (SUS)',
                                          'Anestesista',
                                          'CBO',
                                          'Médico Cirurgião',
                                          'Hospital'
                                        ];
                                        let idx = 1;
                                        const doctorName = doctor.doctor_info?.name || '';
                                        const hospitalName = doctor.hospitals?.[0]?.hospital_name || '';
                                        
                                        console.log(`🎯 [RELATÓRIO ANESTESISTAS] Gerando para médico: ${doctorName}`);
                                        console.log(`🎯 [RELATÓRIO ANESTESISTAS] Filtro de data:`, dateRange ? `${dateRange.startDate.toLocaleDateString('pt-BR')} a ${dateRange.endDate.toLocaleDateString('pt-BR')}` : 'Sem filtro');
                                        
                                        let totalAnesthesiaProcedures = 0;
                                        
                                        (doctor.patients || []).forEach((p: any) => {
                                          // ✅ FILTRO UNIFICADO: Intervalo de datas
                                          if (dateRange && dateRange.startDate && dateRange.endDate) {
                                            const discharge = p?.aih_info?.discharge_date ? new Date(p.aih_info.discharge_date) : undefined;
                                            
                                            if (!discharge) return;
                                            
                                            const startOfPeriod = new Date(dateRange.startDate);
                                            startOfPeriod.setHours(0, 0, 0, 0);
                                            
                                            const endOfPeriod = new Date(dateRange.endDate);
                                            endOfPeriod.setHours(23, 59, 59, 999);
                                            
                                            const dischargeDate = new Date(discharge);
                                            
                                            if (dischargeDate < startOfPeriod || dischargeDate > endOfPeriod) {
                                              return;
                                            }
                                          }
                                          
                                          const name = p.patient_info?.name || 'Paciente';
                                          const aihRaw = (p?.aih_info?.aih_number || '').toString().replace(/\D/g, '');
                                          const aih = aihRaw || 'Aguardando geração';
                                          const disISO = p?.aih_info?.discharge_date || '';
                                          const disLabel = disISO
                                            ? (() => { const s = String(disISO); const m = s.match(/^(\d{4})-(\d{2})-(\d{2})/); return m ? `${m[3]}/${m[2]}/${m[1]}` : formatDateFns(new Date(s), 'dd/MM/yyyy'); })()
                                            : '';
                                          
                                          // ✅ FILTRAR APENAS PROCEDIMENTOS ANESTÉSICOS
                                          const procedures = p.procedures || [];
                                          const anesthesiaProcedures = procedures.filter((proc: any) => {
                                            const cbo = proc.cbo;
                                            const procCode = proc.procedure_code || '';
                                            
                                            // Verificar se é anestesista (CBO 225151)
                                            if (cbo !== '225151') return false;
                                            
                                            // Procedimentos 03.xxx sempre são contados
                                            if (procCode.startsWith('03')) return true;
                                            
                                            // Exceções de cesarianas (04.17.01.001-0 e 04.17.01.005-2)
                                            if (procCode === '04.17.01.001-0' || procCode === '04.17.01.005-2') return true;
                                            
                                            // Demais procedimentos 04.xxx de anestesistas NÃO são contados
                                            return false;
                                          });
                                          
                                          // ✅ GERAR UMA LINHA PARA CADA PROCEDIMENTO ANESTÉSICO
                                          if (anesthesiaProcedures.length > 0) {
                                            anesthesiaProcedures.forEach((proc: any) => {
                                              const procCode = proc.procedure_code || '';
                                              const procDesc = proc.procedure_description || proc.sigtap_description || '';
                                              const procDate = proc.procedure_date || '';
                                              const procDateLabel = procDate 
                                                ? (() => { 
                                                    const s = String(procDate); 
                                                    const m = s.match(/^(\d{4})-(\d{2})-(\d{2})/); 
                                                    return m ? `${m[3]}/${m[2]}/${m[1]}` : formatDateFns(new Date(s), 'dd/MM/yyyy'); 
                                                  })()
                                                : '';
                                              const anesthetistName = proc.professional_name || 'Anestesista não identificado';
                                              const cbo = proc.cbo || '225151';
                                              
                                              rows.push([
                                                idx++,
                                                name,
                                                aih,
                                                procCode,
                                                procDesc,
                                                procDateLabel,
                                                disLabel,
                                                anesthetistName,
                                                cbo,
                                                doctorName,
                                                hospitalName
                                              ]);
                                              
                                              totalAnesthesiaProcedures++;
                                            });
                                          }
                                        });
                                        
                                        // ✅ ORDENAÇÃO: Por Data de Alta (mais recente primeiro)
                                        rows.sort((a, b) => {
                                          const dateA = a[6] as string; // Data Alta está na posição 6
                                          const dateB = b[6] as string;
                                          
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
                                          
                                          return parsedDateB.getTime() - parsedDateA.getTime();
                                        });
                                        
                                        // Renumerar após ordenação
                                        rows.forEach((row, index) => {
                                          row[0] = index + 1;
                                        });
                                        
                                        console.log(`🎯 [RELATÓRIO ANESTESISTAS] Total de procedimentos anestésicos: ${totalAnesthesiaProcedures}`);
                                        console.log(`🎯 [RELATÓRIO ANESTESISTAS] Total de linhas geradas: ${rows.length} (ordenadas por data de alta DESC)`);
                                        
                                        const wb = XLSX.utils.book_new();
                                        const ws = XLSX.utils.aoa_to_sheet([header, ...rows]);
                                        (ws as any)['!cols'] = [
                                          { wch: 5 },   // #
                                          { wch: 35 },  // Nome do Paciente
                                          { wch: 18 },  // Nº AIH
                                          { wch: 20 },  // Código Proc. Anestésico
                                          { wch: 45 },  // Descrição Proc. Anestésico
                                          { wch: 16 },  // Data Procedimento
                                          { wch: 16 },  // Data Alta (SUS)
                                          { wch: 35 },  // Anestesista
                                          { wch: 12 },  // CBO
                                          { wch: 30 },  // Médico Cirurgião
                                          { wch: 35 },  // Hospital
                                        ];
                                        XLSX.utils.book_append_sheet(wb, ws, 'Anestesistas');
                                        const fileName = `Relatorio_Anestesistas_${doctorName.replace(/\s+/g, '_')}_${formatDateFns(new Date(), 'yyyyMMdd_HHmm')}.xlsx`;
                                        XLSX.writeFile(wb, fileName);
                                        toast.success(`Relatório de anestesistas gerado! ${totalAnesthesiaProcedures} procedimento(s).`);
                                      } catch (err) {
                                        console.error('Erro ao exportar Relatório Anestesistas (card):', err);
                                        toast.error('Erro ao gerar relatório de anestesistas');
                                      }
                                    }}
                                    className="inline-flex items-center gap-2 bg-fuchsia-600 hover:bg-fuchsia-700 text-white shadow-md hover:shadow-lg transition-all duration-300 h-9 px-4 rounded-md text-sm"
                                  >
                                    <FileSpreadsheet className="h-4 w-4" />
                                    Relatório Anestesistas
                                  </Button>
                                 </div>
                               </div>
                            </div>
                            
                            {/* ✅ ESTATÍSTICAS DO MÉDICO - DESIGN ULTRA COMPACTO COM CORES SUAVES */}
                            <div className="rounded-xl border border-slate-200 overflow-hidden bg-white">
                              <Table>
                                <TableHeader>
                                  <TableRow className="bg-slate-50">
                                    <TableHead>Indicador</TableHead>
                                    <TableHead>Valor</TableHead>
                                    <TableHead>Valor Incremento</TableHead>
                                    <TableHead>Valor c/ Opera Paraná</TableHead>
                                  </TableRow>
                                </TableHeader>
                                <TableBody>
                                  {/* 1) Hospital */}
                                  <TableRow>
                                    <TableCell className="font-medium">Hospital</TableCell>
                                    <TableCell className="font-bold">{(() => {
                                    const hospitals = doctor.hospitals;
                                    if (hospitals && hospitals.length > 0) {
                                      const primaryHospital = hospitals.find((h: any) => h.is_primary_hospital);
                                      const hospital = primaryHospital || hospitals[0];
                                      return hospital.hospital_name;
                                    }
                                    return 'Não definido';
                                    })()}</TableCell>
                                    <TableCell></TableCell>
                                    <TableCell></TableCell>
                                  </TableRow>
                                  {/* 2) Pacientes Atendidos */}
                                  <TableRow>
                                    <TableCell className="font-medium">Pacientes Atendidos</TableCell>
                                    <TableCell className="font-bold">{doctorStats.totalAIHs}</TableCell>
                                    <TableCell></TableCell>
                                    <TableCell></TableCell>
                                  </TableRow>
                                  {/* 3) Procedimentos */}
                                  <TableRow>
                                    <TableCell className="font-medium">Procedimentos</TableCell>
                                    <TableCell className="font-bold">{doctorStats.totalProcedures}</TableCell>
                                    <TableCell></TableCell>
                                    <TableCell></TableCell>
                                  </TableRow>
                                  {/* 4) Total de AIHs */}
                                  <TableRow>
                                    <TableCell className="font-medium">Total de AIHs</TableCell>
                                    <TableCell className="font-bold">{formatCurrency(doctorStats.totalValue)}</TableCell>
                                    <TableCell className="font-bold">{(() => {
                                       const baseTotal = doctorStats.totalValue || 0;
                                       const doctorCovered = isDoctorCoveredForOperaParana(doctor.doctor_info.name, doctor.hospitals?.[0]?.hospital_id);
                                       if (!doctorCovered) return '-';
                                       const increment = (doctor.patients || []).reduce((acc, p) => (
                                         acc + computeIncrementForProcedures(p.procedures as any, (p as any)?.aih_info?.care_character, doctor.doctor_info.name, doctor.hospitals?.[0]?.hospital_id)
                                       ), 0);
                                       return increment > 0 ? formatCurrency(increment) : '-';
                                     })()}</TableCell>
                                    <TableCell className="font-bold">{(() => {
                                       const baseTotal = doctorStats.totalValue || 0;
                                       const doctorCovered = isDoctorCoveredForOperaParana(doctor.doctor_info.name, doctor.hospitals?.[0]?.hospital_id);
                                       if (!doctorCovered) return '-';
                                       const increment = (doctor.patients || []).reduce((acc, p) => (
                                         acc + computeIncrementForProcedures(p.procedures as any, (p as any)?.aih_info?.care_character, doctor.doctor_info.name, doctor.hospitals?.[0]?.hospital_id)
                                       ), 0);
                                       return increment > 0 ? formatCurrency(baseTotal + increment) : '-';
                                     })()}</TableCell>
                                  </TableRow>
                                  {/* 5) Pagamento Médico */}
                                  <TableRow>
                                    <TableCell className="font-medium">Pagamento Médico</TableCell>
                                    <TableCell className="font-bold">{doctorStats.calculatedPaymentValue > 0 ? formatCurrency(doctorStats.calculatedPaymentValue) : formatCurrency(doctorStats.medicalProceduresValue)}</TableCell>
                                    <TableCell></TableCell>
                                    <TableCell></TableCell>
                                  </TableRow>
                                  {/* 6) Ticket Médio */}
                                  <TableRow>
                                    <TableCell className="font-medium">Ticket Médio</TableCell>
                                    <TableCell className="font-bold">{formatCurrency(doctorStats.avgTicket)}</TableCell>
                                    <TableCell></TableCell>
                                    <TableCell></TableCell>
                                  </TableRow>
                                </TableBody>
                              </Table>
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
                                     const careSpecFilter = (selectedCareSpecialty || '').trim();
                                     const patientCareSpec = (((patient as any)?.aih_info?.specialty || '') as string).trim();
                                     const normalize = (s: string) => s.normalize('NFD').replace(/\p{Diacritic}/gu, '').trim().toUpperCase();
                                     const matchesCareSpec = !careSpecFilter || careSpecFilter === 'all' || (patientCareSpec && normalize(patientCareSpec) === normalize(careSpecFilter));
                                     // Filtro por data de alta (modo apenas por alta), mesmo critério da lista
                                     let matchesDischarge = true;
                                     try {
                                       const discharge = (patient as any)?.aih_info?.discharge_date ? new Date((patient as any).aih_info.discharge_date) : undefined;
                                       const selectedEnd = (window as any).__SIGTAP_SELECTED_END_DATE__ as Date | undefined;
                                       const useOnlyEnd = (window as any).__SIGTAP_USE_ONLY_END_DATE__ as boolean | undefined;
                                       if (useOnlyEnd && selectedEnd) {
                                         matchesDischarge = !!discharge && isSameUTCDate(discharge, selectedEnd);
                                       }
                                     } catch { matchesDischarge = true; }
                                     return matchesName && matchesProc && matchesCareSpec && matchesDischarge;
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
                                  const careSpecFilter = (selectedCareSpecialty || '').trim();
                                  const patientCareSpec = (((patient as any)?.aih_info?.specialty || '') as string).trim();
                                  const normalize = (s: string) => s.normalize('NFD').replace(/\p{Diacritic}/gu, '').trim().toUpperCase();
                                  const matchesCareSpec = !careSpecFilter || careSpecFilter === 'all' || (patientCareSpec && normalize(patientCareSpec) === normalize(careSpecFilter));
                                  // Filtro por data de alta (modo apenas por alta): mostrar somente pacientes com alta exatamente no dia selecionado
                                  const filterByDischargeOnly = false; // será definido externamente
                                  let matchesDischarge = true;
                                  try {
                                    const discharge = (patient as any)?.aih_info?.discharge_date ? new Date((patient as any).aih_info.discharge_date) : undefined;
                                    const selectedEnd = (window as any).__SIGTAP_SELECTED_END_DATE__ as Date | undefined;
                                    const selectedDischargeOnly = (window as any).__SIGTAP_USE_ONLY_END_DATE__ as boolean | undefined;
                                    if (selectedDischargeOnly && selectedEnd) {
                                      matchesDischarge = !!discharge && isSameUTCDate(discharge, selectedEnd);
                                    }
                                  } catch { matchesDischarge = true; }
                                  return matchesName && matchesProc && matchesCareSpec && matchesDischarge;
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
                                    
                                    {paginatedPatients.map((patient) => {
                                      const patientKey = `${doctor.doctor_info.cns}-${patient.patient_info.cns}`;
                                      const isPatientExpanded = expandedPatients.has(patientKey);
                                
                                return (
                                  <div key={patientKey} className="p-3 rounded-lg bg-white border border-slate-200 hover:bg-slate-50 transition-colors">
                                    <Collapsible>
                                      <CollapsibleTrigger asChild>
                                        <div 
                                          className="w-full cursor-pointer p-3 rounded-lg hover:bg-slate-50 border border-slate-200 transition-colors"
                                          onClick={() => togglePatientExpansion(patientKey)}
                                        >
                                          <div className="grid grid-cols-1 md:grid-cols-[minmax(0,1fr)_360px_auto] items-center">
                                            <div className="flex items-center gap-4 min-w-0">
                                            <div className="flex items-center gap-3">
                                                {isPatientExpanded ? (
                                                  <ChevronDown className="h-4 w-4 text-slate-500 transition-transform duration-200" />
                                                ) : (
                                                  <ChevronRight className="h-4 w-4 text-slate-500 transition-transform duration-200" />
                                                )}
                                                <div className="w-9 h-9 bg-slate-100 rounded-lg flex items-center justify-center">
                                                  <User className="h-5 w-5 text-slate-600" />
                                                </div>
                                              </div>
                                              <div className="space-y-1">
                                                <div className="flex items-center gap-2">
                                                  <div className="font-medium text-slate-800 truncate">
                                                    {(/procedimento/i.test(patient.patient_info.name) || /\b\d{2}\.\d{2}\.\d{2}\.\d{3}-\d\b/.test(patient.patient_info.name)) ? 'Nome não disponível' : patient.patient_info.name}
                                                  </div>
                                                  {/* Badge de caráter (Eletivo etc.) ao lado do nome */}
                                                  {patient.aih_info.care_character && (() => {
                                                    const raw = String(patient.aih_info.care_character || '').toLowerCase().trim();
                                                    const isElective = raw === '1' || raw.includes('eletivo');
                                                    const isUrgent = raw === '2' || raw.includes('urg') || raw.includes('emerg');
                                                    const color = isElective ? 'text-blue-600' : (isUrgent ? 'text-red-600' : 'text-slate-700');
                                                    return (
                                                      <Badge
                                                        variant="ghost"
                                                        className={`inline-flex items-center gap-1 rounded-md border-0 bg-transparent px-0 py-0 h-auto ${color} text-[11px]`}
                                                      >
                                                        <span className="h-1.5 w-1.5 rounded-full bg-current" />
                                                        {CareCharacterUtils.formatForDisplay(
                                                          typeof patient.aih_info.care_character === 'string'
                                                            ? patient.aih_info.care_character.trim()
                                                            : String(patient.aih_info.care_character),
                                                          false
                                                        )}
                                                      </Badge>
                                                    );
                                                  })()}
                                                  {(() => {
                                                    const doctorKeyLocal = doctor.doctor_info.cns;
                                                    const procTermRawLocal = (procedureSearchTerm.get(doctorKeyLocal) || '').toLowerCase().trim();
                                                    if (!procTermRawLocal) return null;
                                                    const procTermLocal = procTermRawLocal.replace(/[\.\s]/g, '');
                                                    const matchCount = (patient.procedures || []).filter(p => {
                                                      const codeNorm = (p.procedure_code || '').toLowerCase().replace(/[\.\s]/g, '');
                                                      const desc = (p.procedure_description || '').toLowerCase();
                                                      return codeNorm.includes(procTermLocal) || desc.includes(procTermRawLocal);
                                                    }).length;
                                                    if (matchCount > 0) {
                                                      return (
                                                        <Badge variant="outline" className="bg-purple-50 text-purple-700 border-purple-200 text-xs inline-flex items-center gap-1">
                                                          <FileText className="h-3 w-3" />
                                                          Procedimento
                                                          <span className="ml-0.5">({matchCount})</span>
                                                        </Badge>
                                                      );
                                                    }
                                                    return null;
                                                  })()}
                                                </div>
                                                <div className="text-sm text-slate-600 font-medium flex items-center gap-2">
                                                  <span>CNS: {patient.patient_info.cns}</span>
                                                  {patient.common_name && (
                                                    <Badge 
                                                      variant="outline" 
                                                      className="bg-amber-50 text-amber-700 border-amber-200 text-[10px] px-2 py-0.5"
                                                    >
                                                      {patient.common_name}
                                                    </Badge>
                                                  )}
                                                </div>
                                                <AihDatesBadges
                                                  admissionDate={patient.aih_info.admission_date}
                                                  dischargeDate={patient.aih_info.discharge_date}
                                                  competencia={(patient as any)?.aih_info?.competencia}
                                                  className="text-sm"
                                                />
                                                {/* Bloco de AIH/CID/Especialidade/Modalidade - visível no mobile dentro do bloco esquerdo */}
                                                <div className="md:hidden">
                                                  <PatientAihInfoBadges
                                                    aihNumber={patient.aih_info.aih_number}
                                                    mainCid={(patient.aih_info as any).main_cid}
                                                    specialty={(patient.aih_info as any).specialty}
                                                    requestingPhysician={(patient.aih_info as any).requesting_physician}
                                                    careModality={(patient.aih_info as any).care_modality}
                                                    professionalCbo={(patient.aih_info as any).professional_cbo}
                                                  />
                                                </div>
                                              </div>
                                            </div>
                                            {/* Bloco central (desktop): AIH, CID, Especialidade, Modalidade (largura fixa) */}
                                            <div className="hidden md:block w-[360px] self-center">
                                              <PatientAihInfoBadges
                                                aihNumber={patient.aih_info.aih_number}
                                                mainCid={(patient.aih_info as any).main_cid}
                                                specialty={(patient.aih_info as any).specialty}
                                                requestingPhysician={(patient.aih_info as any).requesting_physician}
                                                careModality={(patient.aih_info as any).care_modality}
                                                professionalCbo={(patient.aih_info as any).professional_cbo}
                                              />
                                            </div>
                                            <div className="text-right">
                                              {(() => {
                                                const baseAih = typeof (patient as any).total_value_reais === 'number'
                                                  ? (patient as any).total_value_reais
                                                  : sumProceduresBaseReais(patient.procedures as any);
                                                const careCharacter = (patient as any)?.aih_info?.care_character;
                                                const doctorCovered = isDoctorCoveredForOperaParana(doctor.doctor_info.name, doctor.hospitals?.[0]?.hospital_id);
                                                const increment = doctorCovered ? computeIncrementForProcedures(patient.procedures as any, careCharacter, doctor.doctor_info.name, doctor.hospitals?.[0]?.hospital_id) : 0;
                                                const hasIncrement = increment > 0;
                                                const withIncrement = baseAih + increment;
                                                return (
                                                  <div className="text-right">
                                                    <div className="text-xs text-slate-600">AIH Seca</div>
                                                    <div className="font-bold text-slate-900">{formatCurrency(baseAih)}</div>
                                                    {hasIncrement && (
                                                      <>
                                                        <div className="mt-1 text-xs text-emerald-700">Incremento</div>
                                                        <div className="font-bold text-emerald-700">{formatCurrency(increment)}</div>
                                                        <div className="mt-1 text-xs text-emerald-700">AIH c/ Incremento</div>
                                                        <div className="font-bold text-emerald-700">{formatCurrency(withIncrement)}</div>
                                                      </>
                                                    )}
                                                  </div>
                                                );
                                              })()}
                                              <div className="text-sm text-slate-600 mb-2">
                                                {patient.procedures.length} procedimento(s)
                                              </div>
                                              {/* Quick stats removidos a pedido: sem badge verde com check */}
                                            </div>
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
                                                  const effectiveCareChar = selectedCareCharacter === 'all' ? careCharStr : selectedCareCharacter;
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
                                                <div key={procedure.procedure_id || procIndex} className={`bg-white/80 p-4 rounded-xl border-l-4 ${
                                                  isMedical04 && isPrincipal ? 'border-l-emerald-400 bg-emerald-50/20' : 'border-l-slate-300'
                                                } ${operaEligible && isPrincipal ? 'ring-1 ring-emerald-200' : ''}`}>
                                                  <div className="flex items-start justify-between">
                                                    <div className="flex-1">
                                                      <div className="flex items-center gap-2 mb-2">
                                                        <div className={`font-medium px-3 py-1 rounded-lg text-xs ${
                                                          (isMedical04 && isPrincipal)
                                                            ? 'text-emerald-800 bg-emerald-100 border border-emerald-200'
                                                            : 'text-slate-800 bg-slate-100 border border-slate-200'
                                                        }`}>
                                                          {procedure.procedure_code}
                                                        </div>
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
                                                                className={`${anesthetistInfo.badgeClass} text-xs ${anesthetistInfo.shouldCalculate ? '' : 'animate-pulse'}`}
                                                              >
                                                                {anesthetistInfo.badge}
                                                              </Badge>
                                                            );
                                                          }
                                                          return null;
                                                        })()}
                                                        {procedure.sequence && procedure.sequence > 1 && (
                                                          <Badge variant="outline" className="bg-slate-100 text-slate-700 border-slate-300 text-xs">
                                                            Seq. {procedure.sequence}
                                                          </Badge>
                                                        )}
                                                      </div>
                                                      
                                                      <div className="text-xs text-slate-700 mb-3 leading-relaxed">
                                                        {procedure.procedure_description || 'Descrição não disponível'}
                                                      </div>
                                                      
                                                      <div className="grid grid-cols-2 md:grid-cols-3 gap-3 text-sm text-slate-600">
                                                        <div className="flex items-center h-6 md:h-7 whitespace-nowrap">
                                                          {procedure.cbo ? (
                                                            <Badge
                                                              variant="outline"
                                                              className={`w-28 justify-center text-[10px] ${procedure.cbo === '225151' ? 'bg-gradient-to-r from-purple-500 to-fuchsia-500 text-white border-0 shadow-sm' : 'bg-slate-100 text-slate-700 border-slate-300'}`}
                                                            >
                                                              CBO: {procedure.cbo}
                                                            </Badge>
                                                          ) : (
                                                            <span className="w-28" />
                                                          )}
                                                        </div>

                                                        {/* Campo Confiança removido a pedido */}
                                                        <div className="h-6 md:h-7" />

                                                        <div className="h-6 md:h-7" />
                                                      </div>
                                                    </div>
                                                    
                                                    <div className="text-right ml-4">
                                                      {(() => {
                                                        const anesthetistInfo = getAnesthetistProcedureType(procedure.cbo, procedure.procedure_code);
                                                        if (operaEligible && (!anesthetistInfo.isAnesthetist || anesthetistInfo.shouldCalculate)) {
                                                          const base = procedure.value_reais || 0;
                                                          const increment = base * 1.5; // +150%
                                                          return (
                                                            <div className="text-right">
                                                              <div className="text-[11px] text-slate-500 line-through">{formatCurrency(base)}</div>
                                                              <div className="text-lg font-extrabold text-emerald-700">{formatCurrency(increment)}</div>
                                                            </div>
                                                          );
                                                        }
                                                        if (anesthetistInfo.isAnesthetist && !anesthetistInfo.shouldCalculate) {
                                                          // 🚫 ANESTESISTA 04.xxx: Mostrar "Controle por Quantidade"
                                                          return (
                                                            <div className="text-center py-2">
                                                              <div className="text-sm font-medium text-red-600 mb-1">
                                                                🚫 Sem valor monetário
                                                              </div>
                                                              <div className="text-xs text-red-500">
                                                                {anesthetistInfo.message}
                                                              </div>
                                                            </div>
                                                          );
                                                        } else {
                                                          // ✅ PROCEDIMENTO NORMAL OU ANESTESISTA 03.xxx: Mostrar valor
                                                          return (
                                                            <div className={`text-lg font-bold ${
                                                              isMedical04 && isPrincipal ? 'text-emerald-700' : 'text-slate-900'
                                                            }`}>
                                                              {formatCurrency(procedure.value_reais)}
                                                            </div>
                                                          );
                                                        }
                                                      })()}
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
import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Badge } from './ui/badge';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from './ui/collapsible';
import { Alert, AlertDescription } from './ui/alert';
import { toast } from 'sonner';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import {
  Users,
  ChevronDown,
  ChevronRight,
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
  Building
} from 'lucide-react';

import { DoctorPatientService, type DoctorWithPatients } from '../services/doctorPatientService';
import DoctorPaymentRules, { calculateDoctorPayment } from './DoctorPaymentRules';

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

const calculateDoctorStats = (doctorData: DoctorWithPatients) => {
  const totalProcedures = doctorData.patients.reduce((sum, patient) => sum + patient.procedures.length, 0);
  const totalValue = doctorData.patients.reduce((sum, patient) => 
    sum + patient.procedures.reduce((procSum, proc) => procSum + (proc.value_reais || 0), 0), 0
  );
  const totalAIHs = doctorData.patients.length;
  const avgTicket = totalAIHs > 0 ? totalValue / totalAIHs : 0;
  
  const approvedProcedures = doctorData.patients.reduce((sum, patient) => 
    sum + patient.procedures.filter(proc => proc.approval_status === 'approved').length, 0
  );
  const approvalRate = totalProcedures > 0 ? (approvedProcedures / totalProcedures) * 100 : 0;
  
  // 🆕 CALCULAR valores específicos dos procedimentos médicos ("04") COM REGRAS DE PAGAMENTO
  const medicalProceduresCount = doctorData.patients.reduce((sum, patient) => 
    sum + patient.procedures.filter(proc => isMedicalProcedure(proc.procedure_code)).length, 0
  );
  
  // 💰 CALCULAR VALOR TOTAL BASEADO NAS REGRAS DE PAGAMENTO ESPECÍFICAS
  let medicalProceduresValue = 0;
  let calculatedPaymentValue = 0;
  
  // Calcular valor original de todos os procedimentos médicos
  medicalProceduresValue = doctorData.patients.reduce((sum, patient) => 
    sum + patient.procedures
      .filter(proc => isMedicalProcedure(proc.procedure_code))
      .reduce((procSum, proc) => procSum + (proc.value_reais || 0), 0), 0
  );
  
  // 🎯 CALCULAR SOMA DOS VALORES DO DETALHAMENTO POR PROCEDIMENTO (POR PACIENTE)
  calculatedPaymentValue = doctorData.patients.reduce((totalSum, patient) => {
    // Coletar procedimentos médicos deste paciente
    const patientMedicalProcedures = patient.procedures
      .filter(proc => isMedicalProcedure(proc.procedure_code))
      .map(proc => ({
        procedure_code: proc.procedure_code,
        procedure_description: proc.procedure_description,
        value_reais: proc.value_reais || 0
      }));
    
    // Se há procedimentos médicos para este paciente, calcular o valor baseado nas regras
    if (patientMedicalProcedures.length > 0) {
      const paymentCalculation = calculateDoctorPayment(doctorData.doctor_info.name, patientMedicalProcedures);
      // Somar os valores calculados individuais (detalhamento por procedimento)
      const patientCalculatedSum = paymentCalculation.procedures.reduce((sum, proc) => sum + proc.calculatedPayment, 0);
      return totalSum + patientCalculatedSum;
    }
    
    return totalSum;
  }, 0);
  
  return {
    totalProcedures,
    totalValue,
    totalAIHs,
    avgTicket,
    approvalRate,
    medicalProceduresValue,
    medicalProceduresCount,
    calculatedPaymentValue // 🆕 Valor calculado baseado nas regras
  };
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
}

// ✅ COMPONENTE PRINCIPAL
const MedicalProductionDashboard: React.FC<MedicalProductionDashboardProps> = ({ onStatsUpdate }) => {
  const { user, canAccessAllHospitals, hasFullAccess } = useAuth();
  const [doctors, setDoctors] = useState<DoctorWithPatients[]>([]);
  const [filteredDoctors, setFilteredDoctors] = useState<DoctorWithPatients[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedHospital, setSelectedHospital] = useState<string>('all'); // 🆕 FILTRO DE HOSPITAL
  const [availableHospitals, setAvailableHospitals] = useState<Array<{id: string, name: string}>>([]);
  // 🆕 ESTADOS PARA FILTRO DE DATAS
  const [admissionDateFrom, setAdmissionDateFrom] = useState<string>('');
  const [admissionDateTo, setAdmissionDateTo] = useState<string>('');
  const [dischargeDateFrom, setDischargeDateFrom] = useState<string>('');
  const [dischargeDateTo, setDischargeDateTo] = useState<string>('');
  const [dateFilterEnabled, setDateFilterEnabled] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState(true);
  const [expandedDoctors, setExpandedDoctors] = useState<Set<string>>(new Set());
  const [expandedPatients, setExpandedPatients] = useState<Set<string>>(new Set());
  const [showDiagnostic, setShowDiagnostic] = useState(false); // 🆕 ESTADO PARA MOSTRAR DIAGNÓSTICO
  // 🆕 ESTADOS PARA PAGINAÇÃO DE PACIENTES
  const [currentPatientPage, setCurrentPatientPage] = useState<Map<string, number>>(new Map());
  const [patientSearchTerm, setPatientSearchTerm] = useState<Map<string, string>>(new Map());
  const PATIENTS_PER_PAGE = 10;

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
        .select('id, name')
        .order('name');
      
      if (hospitalsFromDB) {
        hospitalsFromDB.forEach(hospital => {
          hospitalSet.add(hospital.id);
          hospitalMap.set(hospital.id, hospital.name);
        });
      }
      
      // Converter para array ordenado
      const hospitalsList = Array.from(hospitalSet)
        .map(id => ({ id, name: hospitalMap.get(id) || `Hospital ${id}` }))
        .sort((a, b) => a.name.localeCompare(b.name));
      
      setAvailableHospitals(hospitalsList);
      console.log('🏥 Hospitais disponíveis:', hospitalsList);
    } catch (error) {
      console.error('❌ Erro ao carregar hospitais:', error);
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
        
        const doctorsData = await DoctorPatientService.getAllDoctorsWithPatients();
        console.log('✅ Dados dos médicos carregados:', doctorsData);
        
        // ✅ CARREGAR LISTA DE HOSPITAIS DISPONÍVEIS
        await loadAvailableHospitals(doctorsData);
        
        // ✅ FILTRAR MÉDICOS POR HOSPITAL (SE NÃO FOR ADMIN)
        let filteredDoctorsData = doctorsData;
        
        if (!isAdminMode && userHospitalId && userHospitalId !== 'ALL') {
          filteredDoctorsData = doctorsData.filter(doctor => {
            // Verificar se o médico tem associação com o hospital do usuário
            return doctor.hospitals?.some(hospital =>
              hospital.hospital_id === userHospitalId
            );
          });
          
          console.log(`🏥 Filtrados ${filteredDoctorsData.length} médicos do hospital ${userHospitalId}`);
        }
        
        setDoctors(filteredDoctorsData);
        setFilteredDoctors(filteredDoctorsData);
        
        const message = isAdminMode 
          ? `${filteredDoctorsData.length} médicos carregados (todos os hospitais)`
          : `${filteredDoctorsData.length} médicos carregados do seu hospital`;
        
        toast.success(message);
      } catch (error) {
        console.error('❌ Erro ao carregar dados dos médicos:', error);
        toast.error('Erro ao carregar dados dos médicos');
      } finally {
        setIsLoading(false);
      }
    };

    loadDoctorsData();
  }, [user, canAccessAllHospitals, hasFullAccess]);

  // ✅ FILTRAR MÉDICOS BASEADO NO TERMO DE BUSCA, HOSPITAL E DATAS
  useEffect(() => {
    let filtered = doctors;
    
    // Filtrar por hospital se não for "all"
    if (selectedHospital !== 'all') {
      filtered = filtered.filter(doctor => {
        return doctor.hospitals?.some(hospital =>
          hospital.hospital_id === selectedHospital
        );
      });
    }
    
    // 🆕 FILTRAR POR DATAS DE ADMISSÃO E ALTA
    if (dateFilterEnabled && (admissionDateFrom || admissionDateTo || dischargeDateFrom || dischargeDateTo)) {
      filtered = filtered.map(doctor => ({
        ...doctor,
        patients: doctor.patients.filter(patient => {
          if (!patient.aih_info) return true; // Manter pacientes sem info de AIH
          
          const admissionDate = patient.aih_info.admission_date ? new Date(patient.aih_info.admission_date) : null;
          const dischargeDate = patient.aih_info.discharge_date ? new Date(patient.aih_info.discharge_date) : null;
          
          // Verificar filtros de admissão
          if (admissionDateFrom && admissionDate) {
            if (admissionDate < new Date(admissionDateFrom)) return false;
          }
          if (admissionDateTo && admissionDate) {
            if (admissionDate > new Date(admissionDateTo + 'T23:59:59')) return false;
          }
          
          // Verificar filtros de alta (apenas se o paciente teve alta)
          if (dischargeDateFrom && dischargeDate) {
            if (dischargeDate < new Date(dischargeDateFrom)) return false;
          }
          if (dischargeDateTo && dischargeDate) {
            if (dischargeDate > new Date(dischargeDateTo + 'T23:59:59')) return false;
          }
          
          return true;
        })
      })).filter(doctor => doctor.patients.length > 0); // Remover médicos sem pacientes após filtro
    }
    
    // Filtrar por termo de busca
    if (searchTerm.trim()) {
      const searchLower = searchTerm.toLowerCase();
      filtered = filtered.filter(doctor => {
        return doctor.doctor_info.name.toLowerCase().includes(searchLower) ||
               doctor.doctor_info.cns.includes(searchTerm) ||
               doctor.doctor_info.crm?.toLowerCase().includes(searchLower) ||
               doctor.doctor_info.specialty?.toLowerCase().includes(searchLower);
      });
    }

    setFilteredDoctors(filtered);
  }, [searchTerm, doctors, selectedHospital, dateFilterEnabled, admissionDateFrom, admissionDateTo, dischargeDateFrom, dischargeDateTo]);

  // ✅ TOGGLE EXPANDIR MÉDICO
  const toggleDoctorExpansion = (doctorCns: string) => {
    const newExpanded = new Set(expandedDoctors);
    if (newExpanded.has(doctorCns)) {
      newExpanded.delete(doctorCns);
    } else {
      newExpanded.add(doctorCns);
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
    
    // Coletar todos os procedimentos
    const allProcedures = doctors.flatMap(doctor => 
      doctor.patients.flatMap(patient => patient.procedures)
    );
    
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
      isDemoData
    };
  }, [doctors]);
  
  // ✅ CALCULAR ESTATÍSTICAS DOS MÉDICOS FILTRADOS
  const filteredStats = React.useMemo(() => {
    const totalDoctors = filteredDoctors.length;
    const totalPatients = filteredDoctors.reduce((sum, doctor) => sum + doctor.patients.length, 0);
    
    // Coletar todos os procedimentos dos médicos filtrados
    const allProcedures = filteredDoctors.flatMap(doctor => 
      doctor.patients.flatMap(patient => patient.procedures)
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

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <Activity className="h-12 w-12 animate-spin text-blue-600 mx-auto mb-4" />
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
          <CardTitle className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center shadow-lg">
              <Stethoscope className="h-5 w-5 text-white" />
            </div>
            <div>
              <h3 className="text-xl font-bold text-gray-900">Produção Médica - Médicos Responsáveis</h3>
              <p className="text-sm text-gray-600 mt-1">Visualização hierárquica completa: Médicos → Pacientes → Procedimentos</p>
            </div>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* 🔍 SEÇÃO DE BUSCA */}
          <div className="bg-white rounded-xl p-4 border border-gray-100 shadow-sm">
            <div className="flex items-center gap-2 mb-3">
              <Search className="h-4 w-4 text-blue-600" />
              <span className="text-sm font-semibold text-gray-700">Busca Rápida</span>
            </div>
            <div className="flex items-center gap-4">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input
                  placeholder="Buscar por nome, CNS, CRM ou especialidade..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10 h-11 border-gray-200 focus:border-blue-500 focus:ring-blue-500/20"
                />
              </div>
              <Badge variant="secondary" className="bg-blue-100 text-blue-800 px-3 py-2 font-medium">
                {filteredDoctors.length} médicos
              </Badge>
            </div>
          </div>

          {/* 🏥 SEÇÃO DE FILTROS */}
          <div className="bg-white rounded-xl p-4 border border-gray-100 shadow-sm">
            <div className="flex items-center gap-2 mb-4">
              <Building className="h-4 w-4 text-blue-600" />
              <span className="text-sm font-semibold text-gray-700">Filtros Avançados</span>
            </div>
            
            {/* FILTRO DE HOSPITAL */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-4">
              <div className="space-y-2">
                <label className="text-xs font-medium text-gray-600 uppercase tracking-wide">Hospital</label>
                <div className="flex items-center gap-2">
                  <select
                    value={selectedHospital}
                    onChange={(e) => setSelectedHospital(e.target.value)}
                    className="flex-1 px-3 py-2.5 border border-gray-200 rounded-lg bg-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                  >
                    <option value="all">Todos os Hospitais</option>
                    {availableHospitals.map((hospital) => (
                      <option key={hospital.id} value={hospital.id}>
                        {hospital.name}
                      </option>
                    ))}
                  </select>
                  {selectedHospital !== 'all' && (
                    <button
                      onClick={() => setSelectedHospital('all')}
                      className="px-3 py-2 text-xs text-blue-600 hover:text-blue-800 hover:bg-blue-50 rounded-lg transition-colors font-medium"
                    >
                      Limpar
                    </button>
                  )}
                </div>
              </div>
              
              {/* TOGGLE FILTRO DE DATAS */}
              <div className="space-y-2">
                <label className="text-xs font-medium text-gray-600 uppercase tracking-wide">Período</label>
                <label className="flex items-center gap-3 cursor-pointer p-2.5 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors">
                  <input
                    type="checkbox"
                    checked={dateFilterEnabled}
                    onChange={(e) => setDateFilterEnabled(e.target.checked)}
                    className="rounded border-gray-300 text-blue-600 focus:ring-blue-500 w-4 h-4"
                  />
                  <Calendar className="h-4 w-4 text-gray-500" />
                  <span className="text-sm text-gray-700 font-medium">Filtrar por datas</span>
                </label>
              </div>
            </div>
            
            {/* FILTROS DE DATA EXPANDIDOS */}
            {dateFilterEnabled && (
              <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-lg p-4 border border-blue-100">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  {/* FILTRO DE ADMISSÃO */}
                  <div className="space-y-3">
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                      <label className="text-sm font-semibold text-gray-700">Data de Admissão</label>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="text-xs text-gray-600 mb-1 block">De</label>
                        <input
                          type="date"
                          value={admissionDateFrom}
                          onChange={(e) => setAdmissionDateFrom(e.target.value)}
                          className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white"
                        />
                      </div>
                      <div>
                        <label className="text-xs text-gray-600 mb-1 block">Até</label>
                        <input
                          type="date"
                          value={admissionDateTo}
                          onChange={(e) => setAdmissionDateTo(e.target.value)}
                          className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white"
                        />
                      </div>
                    </div>
                  </div>
                  
                  {/* FILTRO DE ALTA */}
                  <div className="space-y-3">
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 bg-orange-500 rounded-full"></div>
                      <label className="text-sm font-semibold text-gray-700">Data de Alta</label>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="text-xs text-gray-600 mb-1 block">De</label>
                        <input
                          type="date"
                          value={dischargeDateFrom}
                          onChange={(e) => setDischargeDateFrom(e.target.value)}
                          className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white"
                        />
                      </div>
                      <div>
                        <label className="text-xs text-gray-600 mb-1 block">Até</label>
                        <input
                          type="date"
                          value={dischargeDateTo}
                          onChange={(e) => setDischargeDateTo(e.target.value)}
                          className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white"
                        />
                      </div>
                    </div>
                  </div>
                </div>
                
                {/* AÇÕES DOS FILTROS DE DATA */}
                {(admissionDateFrom || admissionDateTo || dischargeDateFrom || dischargeDateTo) && (
                  <div className="flex items-center justify-between mt-4 pt-3 border-t border-blue-200">
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse"></div>
                      <span className="text-sm text-gray-700 font-medium">
                        {filteredDoctors.reduce((sum, doctor) => sum + doctor.patients.length, 0)} pacientes encontrados
                      </span>
                    </div>
                    <button
                      onClick={() => {
                        setAdmissionDateFrom('');
                        setAdmissionDateTo('');
                        setDischargeDateFrom('');
                        setDischargeDateTo('');
                      }}
                      className="px-4 py-2 text-sm text-blue-600 hover:text-blue-800 hover:bg-blue-100 rounded-lg transition-colors font-medium"
                    >
                      Limpar datas
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* ✅ LISTA DE MÉDICOS */}
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
              filteredDoctors
                .map((doctor) => ({
                  ...doctor,
                  totalValue: calculateDoctorStats(doctor).totalValue
                }))
                .sort((a, b) => b.totalValue - a.totalValue)
                .map((doctor, index) => {
                const doctorStats = calculateDoctorStats(doctor);
                const isExpanded = expandedDoctors.has(doctor.doctor_info.cns);
                
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
                  <Card key={doctor.doctor_info.cns} className="mb-6 border border-slate-200/60 bg-white/80 backdrop-blur-sm hover:shadow-lg hover:border-slate-300/60 transition-all duration-500 ease-out">
                    <Collapsible>
                      <CollapsibleTrigger asChild>
                        <div 
                          className="w-full cursor-pointer hover:bg-slate-50/50 transition-all duration-300 ease-out"
                          onClick={() => toggleDoctorExpansion(doctor.doctor_info.cns)}
                        >
                          <div className="p-6">
                            <div className="flex items-center justify-between mb-6">
                            <div className="flex items-center gap-5">
                              <div className="flex items-center gap-3">
                                {isExpanded ? (
                                    <ChevronDown className="h-5 w-5 text-slate-500 transition-transform duration-300" />
                                ) : (
                                    <ChevronRight className="h-5 w-5 text-slate-500 transition-transform duration-300" />
                                )}
                                  <div className={`w-14 h-14 rounded-2xl flex items-center justify-center shadow-sm border ${
                                  doctor.doctor_info.cns === 'VIRTUAL_ORPHAN_DOCTOR' 
                                      ? 'bg-slate-100 border-slate-200' 
                                      : 'bg-slate-50 border-slate-200'
                                }`}>
                                  <Stethoscope className={`h-7 w-7 ${
                                    doctor.doctor_info.cns === 'VIRTUAL_ORPHAN_DOCTOR' 
                                        ? 'text-blue-500' 
                                        : 'text-blue-600'
                                  }`} style={{
                                    filter: doctor.doctor_info.cns !== 'VIRTUAL_ORPHAN_DOCTOR' 
                                      ? 'drop-shadow(0 0 8px rgba(59, 130, 246, 0.5))' 
                                      : 'none'
                                  }} />
                                </div>
                              </div>
                                <div className="space-y-2">
                                  <div className="flex items-center gap-3 flex-wrap">
                                    <h3 className="font-semibold text-lg text-slate-900 tracking-tight">
                                    {doctor.doctor_info.name}
                                  </h3>
                                  {getRankingMedal(index) && (
                                    <span className="text-2xl opacity-80">
                                      {getRankingMedal(index)}
                                    </span>
                                  )}
                                  {doctor.doctor_info.cns === 'VIRTUAL_ORPHAN_DOCTOR' && (
                                      <Badge variant="secondary" className="bg-slate-100 text-slate-700 text-xs font-medium px-3 py-1 rounded-full border border-slate-200">
                                      🔗 Agrupamento
                                    </Badge>
                                  )}
                                </div>
                                  <div className="flex items-center gap-4 text-sm">
                                  {doctor.doctor_info.cns !== 'VIRTUAL_ORPHAN_DOCTOR' ? (
                                    <>
                                        <span className="text-slate-600 font-medium">CNS: {doctor.doctor_info.cns}</span>
                                        {doctor.doctor_info.crm && <span className="text-slate-600 font-medium">CRM: {doctor.doctor_info.crm}</span>}
                                    </>
                                  ) : (
                                      <span className="text-slate-700 font-medium">Procedimentos sem médico responsável identificado</span>
                                  )}
                                  {doctor.doctor_info.specialty && (
                                      <Badge variant="outline" className="bg-white text-slate-700 border-slate-300 font-medium px-3 py-1">
                                        {doctor.doctor_info.specialty}
                                      </Badge>
                                    )}
                                  </div>
                                </div>
                              </div>
                              <div className="text-right">
                                <div className="text-xl font-bold text-slate-900 mb-1">
                                  {formatCurrency(doctorStats.totalValue)}
                                </div>
                                <div className="text-sm text-slate-600 font-medium">
                                  {doctorStats.approvalRate.toFixed(1)}% aprovação
                                </div>
                              </div>
                            </div>
                            
                            {/* ✅ ESTATÍSTICAS DO MÉDICO - DESIGN ULTRA COMPACTO COM CORES SUAVES */}
                            <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
                              <div className="bg-blue-50/40 p-2.5 rounded-lg border border-blue-200/40 hover:bg-blue-50/60 hover:border-blue-300/50 transition-all duration-300">
                                <div className="flex items-center gap-2 mb-1.5">
                                  <div className="w-6 h-6 bg-blue-100/60 rounded-md flex items-center justify-center">
                                    <User className="h-3.5 w-3.5 text-blue-600" />
                                  </div>
                                  <span className="text-blue-700 font-medium text-xs">Pacientes</span>
                                </div>
                                <div className="text-lg font-bold text-blue-900">{doctorStats.totalAIHs}</div>
                              </div>
                              <div className="bg-purple-50/40 p-2.5 rounded-lg border border-purple-200/40 hover:bg-purple-50/60 hover:border-purple-300/50 transition-all duration-300">
                                <div className="flex items-center gap-2 mb-1.5">
                                  <div className="w-6 h-6 bg-purple-100/60 rounded-md flex items-center justify-center">
                                    <FileText className="h-3.5 w-3.5 text-purple-600" />
                                  </div>
                                  <span className="text-purple-700 font-medium text-xs">Procedimentos</span>
                                </div>
                                <div className="text-lg font-bold text-purple-900">{doctorStats.totalProcedures}</div>
                              </div>
                              <div className="bg-amber-50/40 p-2.5 rounded-lg border border-amber-200/40 hover:bg-amber-50/60 hover:border-amber-300/50 transition-all duration-300">
                                <div className="flex items-center gap-2 mb-1.5">
                                  <div className="w-6 h-6 bg-amber-100/60 rounded-md flex items-center justify-center">
                                    <TrendingUp className="h-3.5 w-3.5 text-amber-600" />
                                  </div>
                                  <span className="text-amber-700 font-medium text-xs">Ticket Médio</span>
                                </div>
                                <div className="text-lg font-bold text-amber-900">{formatCurrency(doctorStats.avgTicket)}</div>
                            </div>
                              <div className="bg-indigo-50/40 p-2.5 rounded-lg border border-indigo-200/40 hover:bg-indigo-50/60 hover:border-indigo-300/50 transition-all duration-300">
                                <div className="flex items-center gap-2 mb-1.5">
                                  <div className="w-6 h-6 bg-indigo-100/60 rounded-md flex items-center justify-center">
                                    <Building className="h-3.5 w-3.5 text-indigo-600" />
                          </div>
                                  <span className="text-indigo-700 font-medium text-xs">Hospital</span>
                            </div>
                                <div className="text-sm font-semibold text-indigo-900 leading-tight">
                                  {(() => {
                                    const hospitals = doctor.hospitals;
                                    if (hospitals && hospitals.length > 0) {
                                      const primaryHospital = hospitals.find((h: any) => h.is_primary_hospital);
                                      const hospital = primaryHospital || hospitals[0];
                                      return hospital.hospital_name;
                                    }
                                    return 'Não definido';
                                  })()}
                            </div>
                            </div>
                              {/* 🆕 CARD PRODUÇÃO MÉDICA - APENAS VALOR */}
              <div className="bg-emerald-50/40 p-2.5 rounded-lg border border-emerald-200/40 hover:bg-emerald-50/60 hover:border-emerald-300/50 transition-all duration-300">
                <div className="flex items-center gap-2 mb-1.5">
                  <div className="w-6 h-6 bg-emerald-100/60 rounded-md flex items-center justify-center">
                    <Stethoscope className="h-3.5 w-3.5 text-emerald-600" />
                  </div>
                  <span className="text-emerald-700 font-medium text-xs">Produção Médica</span>
                </div>
                <div className="text-lg font-bold text-emerald-900">
                  {doctorStats.calculatedPaymentValue > 0 
                    ? formatCurrency(doctorStats.calculatedPaymentValue)
                    : formatCurrency(doctorStats.medicalProceduresValue)
                  }
                </div>
              </div>
                            </div>
                          </div>
                        </div>
                      </CollapsibleTrigger>

                      {/* ✅ LISTA DE PACIENTES - DESIGN SOFISTICADO */}
                      <CollapsibleContent>
                        <div className="px-6 pb-6">
                          <div className="border-t border-slate-200/60 pt-6">
                            <div className="flex items-center justify-between mb-5">
                              <h4 className="font-semibold text-lg text-slate-800 flex items-center gap-3">
                                <div className="w-7 h-7 bg-slate-100 rounded-xl flex items-center justify-center">
                                  <User className="h-4 w-4 text-slate-600" />
                                </div>
                                Pacientes Atendidos ({(() => {
                                   const searchTerm = patientSearchTerm.get(doctor.doctor_info.cns) || '';
                                   if (searchTerm) {
                                     const filteredCount = doctor.patients.filter(patient => 
                                       patient.patient_info.name.toLowerCase().includes(searchTerm.toLowerCase())
                                     ).length;
                                     return `${filteredCount} de ${doctor.patients.length}`;
                                   }
                                   return doctor.patients.length;
                                 })()})
                              </h4>
                              
                              <div className="flex items-center gap-3">
                                {/* Campo de busca */}
                                <div className="relative">
                                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                                  <Input
                                    placeholder="Buscar paciente..."
                                    value={patientSearchTerm.get(doctor.doctor_info.cns) || ''}
                                    onChange={(e) => {
                                      const newSearchTerms = new Map(patientSearchTerm);
                                      newSearchTerms.set(doctor.doctor_info.cns, e.target.value);
                                      setPatientSearchTerm(newSearchTerms);
                                      // Reset para primeira página ao buscar
                                      const newPages = new Map(currentPatientPage);
                                      newPages.set(doctor.doctor_info.cns, 1);
                                      setCurrentPatientPage(newPages);
                                    }}
                                    className="pl-10 w-64"
                                  />
                                </div>
                                
                                {/* Controles de paginação no header */}
                                {(() => {
                                  const searchTerm = patientSearchTerm.get(doctor.doctor_info.cns) || '';
                                  const filteredPatients = doctor.patients.filter(patient => 
                                    patient.patient_info.name.toLowerCase().includes(searchTerm.toLowerCase())
                                  );
                                  const totalPages = Math.ceil(filteredPatients.length / PATIENTS_PER_PAGE);
                                  const currentPage = currentPatientPage.get(doctor.doctor_info.cns) || 1;
                                  
                                  if (totalPages > 1) {
                                    return (
                                      <div className="flex items-center gap-2">
                                        <Button
                                          variant="outline"
                                          size="sm"
                                          onClick={() => {
                                            const newPages = new Map(currentPatientPage);
                                            newPages.set(doctor.doctor_info.cns, Math.max(1, currentPage - 1));
                                            setCurrentPatientPage(newPages);
                                          }}
                                          disabled={currentPage === 1}
                                        >
                                          Anterior
                                        </Button>
                                        <span className="text-sm text-gray-600 px-2">
                                          {currentPage} de {totalPages}
                                        </span>
                                        <Button
                                          variant="outline"
                                          size="sm"
                                          onClick={() => {
                                            const newPages = new Map(currentPatientPage);
                                            newPages.set(doctor.doctor_info.cns, Math.min(totalPages, currentPage + 1));
                                            setCurrentPatientPage(newPages);
                                          }}
                                          disabled={currentPage === totalPages}
                                        >
                                          Próximo
                                        </Button>
                                      </div>
                                    );
                                  }
                                  return null;
                                })()}
                              </div>
                            </div>
                            
                            <div className="space-y-4">
                              {(() => {
                                const doctorKey = doctor.doctor_info.cns;
                                const searchTerm = patientSearchTerm.get(doctorKey) || '';
                                const filteredPatients = doctor.patients.filter(patient => 
                                  patient.patient_info.name.toLowerCase().includes(searchTerm.toLowerCase())
                                );
                                const currentPage = currentPatientPage.get(doctorKey) || 1;
                                const startIndex = (currentPage - 1) * PATIENTS_PER_PAGE;
                                const endIndex = startIndex + PATIENTS_PER_PAGE;
                                const paginatedPatients = filteredPatients.slice(startIndex, endIndex);
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
                                  <div key={patientKey} className="bg-white/60 rounded-xl p-4 border border-slate-200/60 hover:bg-white/80 hover:border-slate-300/60 transition-all duration-300">
                                    <Collapsible>
                                      <CollapsibleTrigger asChild>
                                        <div 
                                          className="w-full cursor-pointer hover:bg-slate-50/50 rounded-xl p-3 transition-all duration-200"
                                          onClick={() => togglePatientExpansion(patientKey)}
                                        >
                                          <div className="flex items-center justify-between">
                                            <div className="flex items-center gap-4">
                                            <div className="flex items-center gap-3">
                                                {isPatientExpanded ? (
                                                  <ChevronDown className="h-4 w-4 text-slate-500 transition-transform duration-200" />
                                                ) : (
                                                  <ChevronRight className="h-4 w-4 text-slate-500 transition-transform duration-200" />
                                                )}
                                                <div className="w-11 h-11 bg-slate-100 rounded-xl flex items-center justify-center">
                                                  <User className="h-5 w-5 text-slate-600" />
                                                </div>
                                              </div>
                                              <div className="space-y-1">
                                                <div className="font-semibold text-base text-slate-900">
                                                  {patient.patient_info.name}
                                                </div>
                                                <div className="text-sm text-slate-600 font-medium">
                                                  CNS: {patient.patient_info.cns}
                                                </div>
                                                <div className="text-sm text-slate-500 flex items-center gap-2">
                                                  <span>Admissão: {new Date(patient.aih_info.admission_date).toLocaleDateString('pt-BR')}</span>
                                                  {patient.aih_info.discharge_date && (
                                                    <span>• Alta: {new Date(patient.aih_info.discharge_date).toLocaleDateString('pt-BR')}</span>
                                                  )}
                                                </div>
                                              </div>
                                            </div>
                                            <div className="text-right">
                                              <div className="font-bold text-lg text-slate-900">
                                                {formatCurrency(patient.procedures.reduce((sum, proc) => sum + (proc.value_reais || 0), 0))}
                                              </div>
                                              <div className="text-sm text-slate-600 mb-2">
                                                {patient.procedures.length} procedimento(s)
                                              </div>
                                              {/* ✅ ESTATÍSTICAS RÁPIDAS DOS PROCEDIMENTOS */}
                                              {patient.procedures.length > 0 && (
                                                <div className="flex gap-1 justify-end">
                                                  {(() => {
                                                    const approved = patient.procedures.filter(p => p.approval_status === 'approved').length;
                                                    const pending = patient.procedures.filter(p => p.approval_status === 'pending').length;
                                                    const rejected = patient.procedures.filter(p => p.approval_status === 'rejected').length;
                                                    
                                                    return (
                                                      <>
                                                        {approved > 0 && (
                                                          <Badge variant="default" className="bg-emerald-100 text-emerald-700 text-xs px-2 py-1 border-emerald-200">
                                                            ✓{approved}
                                                          </Badge>
                                                        )}
                                                        {pending > 0 && (
                                                          <Badge variant="secondary" className="bg-amber-100 text-amber-700 text-xs px-2 py-1 border-amber-200">
                                                            ⏳{pending}
                                                          </Badge>
                                                        )}
                                                        {rejected > 0 && (
                                                          <Badge variant="destructive" className="bg-red-100 text-red-700 text-xs px-2 py-1 border-red-200">
                                                            ✗{rejected}
                                                          </Badge>
                                                        )}
                                                      </>
                                                    );
                                                  })()}
                                                </div>
                                              )}
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
                                                .sort((a, b) => new Date(b.procedure_date).getTime() - new Date(a.procedure_date).getTime())
                                                .map((procedure, procIndex) => (
                                                <div key={procedure.procedure_id || procIndex} className={`bg-white/80 p-4 rounded-xl border-l-4 ${
                                                  isMedicalProcedure(procedure.procedure_code) ? 'border-l-emerald-400 bg-emerald-50/20' : 'border-l-slate-300'
                                                }`}>
                                                  <div className="flex items-start justify-between">
                                                    <div className="flex-1">
                                                      <div className="flex items-center gap-2 mb-2">
                                                        <div className={`font-medium px-3 py-1 rounded-lg text-sm ${
                                                          isMedicalProcedure(procedure.procedure_code) 
                                                            ? 'text-emerald-800 bg-emerald-100 border border-emerald-200' 
                                                            : 'text-slate-800 bg-slate-100 border border-slate-200'
                                                        }`}>
                                                          {procedure.procedure_code}
                                                        </div>
                                                        {isMedicalProcedure(procedure.procedure_code) && (
                                                          <Badge variant="outline" className="bg-emerald-100 text-emerald-700 border-emerald-300 text-xs">
                                                            🩺 Médico 04
                                                          </Badge>
                                                        )}
                                                        {procedure.sequence && procedure.sequence > 1 && (
                                                          <Badge variant="outline" className="bg-slate-100 text-slate-700 border-slate-300 text-xs">
                                                            Seq. {procedure.sequence}
                                                          </Badge>
                                                        )}
                                                      </div>
                                                      
                                                      <div className="text-sm text-slate-700 mb-3 leading-relaxed">
                                                        {procedure.procedure_description || 'Descrição não disponível'}
                                                      </div>
                                                      
                                                      <div className="grid grid-cols-2 md:grid-cols-3 gap-3 text-sm text-slate-600">
                                                        <div className="flex items-center gap-2">
                                                          <Calendar className="h-4 w-4 text-slate-500" />
                                                          <span className="font-medium">Data:</span>
                                                          <span className="text-slate-800">
                                                          {procedure.procedure_date ? new Date(procedure.procedure_date).toLocaleDateString('pt-BR') : 'Não informada'}
                                                          </span>
                                                        </div>
                                                        

                                                        
                                                        {procedure.professional_name && (
                                                          <div className="flex items-center gap-2">
                                                            <Stethoscope className="h-4 w-4 text-slate-500" />
                                                            <span className="font-medium">Executante:</span>
                                                            <span className="truncate">{procedure.professional_name}</span>
                                                          </div>
                                                        )}
                                                        
                                                        {procedure.cbo && (
                                                          <div className="flex items-center gap-2">
                                                            <Badge variant="outline" className="bg-slate-100 text-slate-700 border-slate-300 text-xs">
                                                              CBO: {procedure.cbo}
                                                            </Badge>
                                                          </div>
                                                        )}
                                                        
                                                        {procedure.participation && (
                                                          <div className="flex items-center gap-2">
                                                            <Users className="h-4 w-4 text-slate-500" />
                                                            <span className="font-medium">Participação:</span>
                                                            <span>{procedure.participation}</span>
                                                          </div>
                                                        )}
                                                        
                                                        {procedure.match_confidence && procedure.match_confidence > 0 && (
                                                          <div className="flex items-center gap-2">
                                                            <TrendingUp className="h-4 w-4 text-slate-500" />
                                                            <span className="font-medium">Confiança:</span>
                                                            <span>{(procedure.match_confidence * 100).toFixed(1)}%</span>
                                                          </div>
                                                        )}
                                                      </div>
                                                    </div>
                                                    
                                                    <div className="text-right ml-4">
                                                      <div className={`text-xl font-bold ${
                                                        isMedicalProcedure(procedure.procedure_code) ? 'text-emerald-700' : 'text-slate-900'
                                                      }`}>
                                                        {formatCurrency(procedure.value_reais)}
                                                      </div>
                                                    </div>
                                                  </div>
                                                </div>
                                              ))}
                                            </div>
                                          )}
                                          
                                          {/* 🆕 COMPONENTE DE REGRAS DE PAGAMENTO ESPECÍFICAS */}
                                          {patient.procedures.length > 0 && (
                                            <DoctorPaymentRules
                                              doctorName={doctor.doctor_info.name}
                                              procedures={patient.procedures.map(proc => ({
                                                procedure_code: proc.procedure_code,
                                                procedure_description: proc.procedure_description,
                                                value_reais: proc.value_reais || 0
                                              }))}
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
              })
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default MedicalProductionDashboard;
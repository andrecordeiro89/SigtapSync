import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Badge } from './ui/badge';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from './ui/collapsible';
import { Alert, AlertDescription } from './ui/alert';
import { toast } from 'sonner';
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
  RefreshCw
} from 'lucide-react';

import { DoctorPatientService, type DoctorWithPatients } from '../services/doctorPatientService';

// ✅ FUNÇÃO PARA FORMATAR VALORES MONETÁRIOS
const formatCurrency = (value: number | null | undefined): string => {
  if (value == null || isNaN(value)) return 'R$ 0,00';
  return value.toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
};

// ✅ FUNÇÃO PARA FORMATAR NÚMEROS
const formatNumber = (value: number | null | undefined): string => {
  if (value == null || isNaN(value)) return '0';
  return Math.round(value).toLocaleString('pt-BR');
};

// ✅ FUNÇÃO PARA CALCULAR ESTATÍSTICAS DO MÉDICO
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
  
  return {
    totalProcedures,
    totalValue,
    totalAIHs,
    avgTicket,
    approvalRate
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
  }>;
}

// 🆕 COMPONENTE DE DIAGNÓSTICO DE DADOS
const DataDiagnostics: React.FC<{ onClose: () => void }> = ({ onClose }) => {
  const [diagnostic, setDiagnostic] = useState<DataDiagnostic | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const runDiagnostic = async () => {
    setLoading(true);
    setError(null);
    
    try {
      const result = await DoctorPatientService.diagnoseDatabaseStructure();
      if (result.success && result.data) {
        setDiagnostic(result.data);
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
                    <span className="text-gray-600">
                      [{sample.sample_procedure_codes.join(', ')}]
                    </span>
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

// ✅ COMPONENTE PRINCIPAL
const MedicalProductionDashboard: React.FC = () => {
  const [doctors, setDoctors] = useState<DoctorWithPatients[]>([]);
  const [filteredDoctors, setFilteredDoctors] = useState<DoctorWithPatients[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [expandedDoctors, setExpandedDoctors] = useState<Set<string>>(new Set());
  const [expandedPatients, setExpandedPatients] = useState<Set<string>>(new Set());
  const [showDiagnostic, setShowDiagnostic] = useState(false); // 🆕 ESTADO PARA MOSTRAR DIAGNÓSTICO

  // ✅ CARREGAR DADOS DOS MÉDICOS
  useEffect(() => {
    const loadDoctorsData = async () => {
      try {
        setIsLoading(true);
        console.log('🔄 Carregando dados dos médicos...');
        
        const doctorsData = await DoctorPatientService.getAllDoctorsWithPatients();
        console.log('✅ Dados dos médicos carregados:', doctorsData);
        
        setDoctors(doctorsData);
        setFilteredDoctors(doctorsData);
        
        toast.success(`${doctorsData.length} médicos carregados com sucesso!`);
      } catch (error) {
        console.error('❌ Erro ao carregar dados dos médicos:', error);
        toast.error('Erro ao carregar dados dos médicos');
      } finally {
        setIsLoading(false);
      }
    };

    loadDoctorsData();
  }, []);

  // ✅ FILTRAR MÉDICOS
  useEffect(() => {
    if (!searchTerm) {
      setFilteredDoctors(doctors);
      return;
    }

    const filtered = doctors.filter(doctor => 
      doctor.doctor_info.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      doctor.doctor_info.cns.includes(searchTerm) ||
      doctor.doctor_info.crm?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      doctor.doctor_info.specialty?.toLowerCase().includes(searchTerm.toLowerCase())
    );

    setFilteredDoctors(filtered);
  }, [searchTerm, doctors]);

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
    <div className="space-y-6">
      {/* HEADER COM DIAGNÓSTICO */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Produção Médica</h2>
          <p className="text-muted-foreground">
            Controle de produtividade médica por responsável
          </p>
        </div>
        <Button 
          onClick={() => setShowDiagnostic(!showDiagnostic)}
          variant="outline"
          className="gap-2"
        >
          <Database className="h-4 w-4" />
          {showDiagnostic ? 'Ocultar' : 'Verificar'} Dados
        </Button>
      </div>

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

      {/* ✅ ESTATÍSTICAS GLOBAIS EXPANDIDAS */}
      <div className="grid grid-cols-1 md:grid-cols-6 gap-4">
        <Card className="border-blue-200 bg-gradient-to-br from-blue-50 to-blue-100">
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <Users className="h-8 w-8 text-blue-600" />
              <div>
                <div className="text-sm text-blue-600 font-medium">Total de Médicos</div>
                <div className="text-2xl font-bold text-blue-700">{formatNumber(globalStats.totalDoctors)}</div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-green-200 bg-gradient-to-br from-green-50 to-green-100">
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <User className="h-8 w-8 text-green-600" />
              <div>
                <div className="text-sm text-green-600 font-medium">Total de Pacientes</div>
                <div className="text-2xl font-bold text-green-700">{formatNumber(globalStats.totalPatients)}</div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-purple-200 bg-gradient-to-br from-purple-50 to-purple-100">
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <FileText className="h-8 w-8 text-purple-600" />
              <div>
                <div className="text-sm text-purple-600 font-medium">Total de Procedimentos</div>
                <div className="text-2xl font-bold text-purple-700">{formatNumber(globalStats.totalProcedures)}</div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-orange-200 bg-gradient-to-br from-orange-50 to-orange-100">
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <DollarSign className="h-8 w-8 text-orange-600" />
              <div>
                <div className="text-sm text-orange-600 font-medium">Faturamento Total</div>
                <div className="text-2xl font-bold text-orange-700">{formatCurrency(globalStats.totalRevenue)}</div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-indigo-200 bg-gradient-to-br from-indigo-50 to-indigo-100">
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <TrendingUp className="h-8 w-8 text-indigo-600" />
              <div>
                <div className="text-sm text-indigo-600 font-medium">Ticket Médio</div>
                <div className="text-2xl font-bold text-indigo-700">{formatCurrency(globalStats.avgTicket)}</div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-emerald-200 bg-gradient-to-br from-emerald-50 to-emerald-100">
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <BarChart3 className="h-8 w-8 text-emerald-600" />
              <div>
                <div className="text-sm text-emerald-600 font-medium">Taxa de Aprovação</div>
                <div className="text-2xl font-bold text-emerald-700">{globalStats.approvalRate.toFixed(1)}%</div>
                <div className="text-xs text-emerald-600 mt-1">
                  ✓{globalStats.approvedProcedures} ⏳{globalStats.pendingProcedures} ✗{globalStats.rejectedProcedures}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* ✅ PROCEDIMENTOS MAIS REALIZADOS */}
      {globalStats.mostCommonProcedures.length > 0 && (
        <Card className="border-l-4 border-l-blue-500">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-lg">
              <Activity className="h-5 w-5 text-blue-600" />
              Procedimentos Mais Realizados
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {globalStats.mostCommonProcedures.map((proc, index) => (
                <div key={proc.code} className="bg-gray-50 p-3 rounded-lg">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="font-medium text-gray-900">{proc.code}</div>
                      <div className="text-sm text-gray-600">
                        {proc.count} realizações
                      </div>
                    </div>
                    <div className="text-right">
                      <Badge variant={index === 0 ? "default" : "secondary"} className="text-xs">
                        #{index + 1}
                      </Badge>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      

      {/* ✅ CONTROLES E FILTROS */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Stethoscope className="h-5 w-5 text-blue-600" />
            Produção Médica - Médicos Responsáveis
          </CardTitle>
          <CardDescription>
            Visualização hierárquica completa: Médicos Responsáveis → Pacientes → Procedimentos
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-4 mb-6">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input
                placeholder="Buscar por nome, CNS, CRM ou especialidade..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
            <Badge variant="secondary">
              {filteredDoctors.length} médicos encontrados
            </Badge>
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
              filteredDoctors.map((doctor) => {
                const doctorStats = calculateDoctorStats(doctor);
                const isExpanded = expandedDoctors.has(doctor.doctor_info.cns);
                
                return (
                  <Card key={doctor.doctor_info.cns} className="border-2 hover:border-blue-300 transition-colors">
                    <Collapsible>
                      <CollapsibleTrigger asChild>
                        <div 
                          className="w-full p-4 cursor-pointer"
                          onClick={() => toggleDoctorExpansion(doctor.doctor_info.cns)}
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-4">
                              <div className="flex items-center gap-2">
                                {isExpanded ? (
                                  <ChevronDown className="h-5 w-5 text-blue-600" />
                                ) : (
                                  <ChevronRight className="h-5 w-5 text-blue-600" />
                                )}
                                <div className={`w-12 h-12 rounded-full flex items-center justify-center ${
                                  doctor.doctor_info.cns === 'VIRTUAL_ORPHAN_DOCTOR' 
                                    ? 'bg-purple-100' 
                                    : 'bg-blue-100'
                                }`}>
                                  <Stethoscope className={`h-6 w-6 ${
                                    doctor.doctor_info.cns === 'VIRTUAL_ORPHAN_DOCTOR' 
                                      ? 'text-purple-600' 
                                      : 'text-blue-600'
                                  }`} />
                                </div>
                              </div>
                              <div>
                                <div className="flex items-center gap-2">
                                  <h3 className="font-semibold text-lg text-gray-900">
                                    {doctor.doctor_info.name}
                                  </h3>
                                  {doctor.doctor_info.cns === 'VIRTUAL_ORPHAN_DOCTOR' && (
                                    <Badge variant="secondary" className="bg-purple-100 text-purple-700 text-xs">
                                      🔗 Agrupamento
                                    </Badge>
                                  )}
                                </div>
                                <div className="flex items-center gap-4 text-sm text-gray-600">
                                  {doctor.doctor_info.cns !== 'VIRTUAL_ORPHAN_DOCTOR' ? (
                                    <>
                                      <span>CNS: {doctor.doctor_info.cns}</span>
                                      {doctor.doctor_info.crm && <span>CRM: {doctor.doctor_info.crm}</span>}
                                    </>
                                  ) : (
                                    <span className="text-purple-600 font-medium">Procedimentos sem médico responsável identificado</span>
                                  )}
                                  {doctor.doctor_info.specialty && (
                                    <Badge variant="outline">{doctor.doctor_info.specialty}</Badge>
                                  )}
                                </div>
                              </div>
                            </div>
                            <div className="text-right">
                              <div className="text-2xl font-bold text-green-600">
                                {formatCurrency(doctorStats.totalValue)}
                              </div>
                              <div className="text-sm text-gray-600">
                                {doctorStats.approvalRate.toFixed(1)}% aprovação
                              </div>
                            </div>
                          </div>
                          
                          {/* ✅ ESTATÍSTICAS DO MÉDICO */}
                          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-4 text-sm">
                            <div className="bg-blue-50 p-3 rounded">
                              <span className="text-blue-600 font-medium">AIHs/Pacientes:</span>
                              <div className="text-lg font-bold text-blue-700">{doctorStats.totalAIHs}</div>
                            </div>
                            <div className="bg-green-50 p-3 rounded">
                              <span className="text-green-600 font-medium">Procedimentos:</span>
                              <div className="text-lg font-bold text-green-700">{doctorStats.totalProcedures}</div>
                            </div>
                            <div className="bg-purple-50 p-3 rounded">
                              <span className="text-purple-600 font-medium">Ticket Médio:</span>
                              <div className="text-lg font-bold text-purple-700">{formatCurrency(doctorStats.avgTicket)}</div>
                            </div>
                            <div className="bg-orange-50 p-3 rounded">
                              <span className="text-orange-600 font-medium">Taxa Aprovação:</span>
                              <div className="text-lg font-bold text-orange-700">{doctorStats.approvalRate.toFixed(1)}%</div>
                            </div>
                          </div>
                        </div>
                      </CollapsibleTrigger>

                      {/* ✅ LISTA DE PACIENTES */}
                      <CollapsibleContent>
                        <div className="px-4 pb-4">
                          <div className="border-t pt-4">
                            <h4 className="font-semibold text-gray-800 mb-4 flex items-center gap-2">
                              <User className="h-4 w-4" />
                              Pacientes Atendidos ({doctor.patients.length})
                            </h4>
                            
                            <div className="space-y-3">
                              {doctor.patients.map((patient) => {
                                const patientKey = `${doctor.doctor_info.cns}-${patient.patient_info.cns}`;
                                const isPatientExpanded = expandedPatients.has(patientKey);
                                
                                return (
                                  <div key={patientKey} className="bg-gray-50 rounded-lg p-3">
                                    <Collapsible>
                                      <CollapsibleTrigger asChild>
                                        <div 
                                          className="w-full cursor-pointer"
                                          onClick={() => togglePatientExpansion(patientKey)}
                                        >
                                          <div className="flex items-center justify-between">
                                            <div className="flex items-center gap-3">
                                              <div className="flex items-center gap-2">
                                                {isPatientExpanded ? (
                                                  <ChevronDown className="h-4 w-4 text-gray-600" />
                                                ) : (
                                                  <ChevronRight className="h-4 w-4 text-gray-600" />
                                                )}
                                                <div className="w-8 h-8 bg-green-100 rounded-full flex items-center justify-center">
                                                  <User className="h-4 w-4 text-green-600" />
                                                </div>
                                              </div>
                                              <div>
                                                <div className="font-medium text-gray-900">
                                                  {patient.patient_info.name}
                                                </div>
                                                <div className="text-sm text-gray-600">
                                                  CNS: {patient.patient_info.cns}
                                                </div>
                                              </div>
                                            </div>
                                            <div className="text-right">
                                              <div className="font-semibold text-green-600 text-lg">
                                                {formatCurrency(patient.procedures.reduce((sum, proc) => sum + (proc.value_reais || 0), 0))}
                                              </div>
                                              <div className="text-sm text-gray-600 mb-2">
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
                                                          <Badge variant="default" className="bg-green-100 text-green-700 text-xs px-1 py-0">
                                                            ✓{approved}
                                                          </Badge>
                                                        )}
                                                        {pending > 0 && (
                                                          <Badge variant="secondary" className="bg-yellow-100 text-yellow-700 text-xs px-1 py-0">
                                                            ⏳{pending}
                                                          </Badge>
                                                        )}
                                                        {rejected > 0 && (
                                                          <Badge variant="destructive" className="text-xs px-1 py-0">
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
                                        <div className="mt-3 space-y-2">
                                          <div className="flex items-center justify-between">
                                            <h5 className="font-medium text-gray-700 flex items-center gap-2">
                                              <FileText className="h-4 w-4" />
                                              Procedimentos Realizados
                                            </h5>
                                            <Badge variant="secondary" className="text-xs">
                                              {patient.procedures.length} procedimento(s)
                                            </Badge>
                                          </div>
                                          
                                          {patient.procedures.length === 0 ? (
                                            <div className="text-center py-6 text-gray-500">
                                              <Activity className="h-8 w-8 mx-auto mb-2 text-gray-300" />
                                              <div className="text-sm">Nenhum procedimento encontrado</div>
                                            </div>
                                          ) : (
                                            <div className="space-y-2">
                                              {patient.procedures
                                                .sort((a, b) => new Date(b.procedure_date).getTime() - new Date(a.procedure_date).getTime())
                                                .map((procedure, procIndex) => (
                                                <div key={procedure.procedure_id || procIndex} className="bg-white p-4 rounded-lg border-l-4 border-l-blue-200 shadow-sm">
                                                  <div className="flex items-start justify-between">
                                                    <div className="flex-1">
                                                      <div className="flex items-center gap-2 mb-2">
                                                        <div className="font-semibold text-gray-900 bg-blue-50 px-2 py-1 rounded text-sm">
                                                          {procedure.procedure_code}
                                                        </div>
                                                        {procedure.sequence && procedure.sequence > 1 && (
                                                          <Badge variant="outline" className="text-xs">
                                                            Seq. {procedure.sequence}
                                                          </Badge>
                                                        )}
                                                      </div>
                                                      
                                                      <div className="text-sm text-gray-700 mb-2 leading-relaxed">
                                                        {procedure.procedure_description || 'Descrição não disponível'}
                                                      </div>
                                                      
                                                      <div className="grid grid-cols-2 md:grid-cols-3 gap-3 text-xs text-gray-600">
                                                        <div className="flex items-center gap-1">
                                                          <Calendar className="h-3 w-3 text-blue-500" />
                                                          <span className="font-medium">Data:</span>
                                                          {procedure.procedure_date ? new Date(procedure.procedure_date).toLocaleDateString('pt-BR') : 'Não informada'}
                                                        </div>
                                                        
                                                        <div className="flex items-center gap-1">
                                                          <Activity className="h-3 w-3 text-purple-500" />
                                                          <span className="font-medium">Status:</span>
                                                          {procedure.approval_status === 'approved' ? (
                                                            <Badge variant="default" className="bg-green-100 text-green-700 text-xs">
                                                              <CheckCircle className="h-3 w-3 mr-1" />Aprovado
                                                            </Badge>
                                                          ) : procedure.approval_status === 'rejected' ? (
                                                            <Badge variant="destructive" className="text-xs">
                                                              <XCircle className="h-3 w-3 mr-1" />Rejeitado
                                                            </Badge>
                                                          ) : (
                                                            <Badge variant="secondary" className="bg-yellow-100 text-yellow-700 text-xs">
                                                              <AlertCircle className="h-3 w-3 mr-1" />Pendente
                                                            </Badge>
                                                          )}
                                                        </div>
                                                        
                                                        {procedure.professional_name && (
                                                          <div className="flex items-center gap-1">
                                                            <Stethoscope className="h-3 w-3 text-green-500" />
                                                            <span className="font-medium">Executante:</span>
                                                            <span className="truncate">{procedure.professional_name}</span>
                                                          </div>
                                                        )}
                                                        
                                                        {procedure.cbo && (
                                                          <div className="flex items-center gap-1">
                                                            <Badge variant="outline" className="text-xs">
                                                              CBO: {procedure.cbo}
                                                            </Badge>
                                                          </div>
                                                        )}
                                                        
                                                        {procedure.participation && (
                                                          <div className="flex items-center gap-1">
                                                            <Users className="h-3 w-3 text-orange-500" />
                                                            <span className="font-medium">Participação:</span>
                                                            <span>{procedure.participation}</span>
                                                          </div>
                                                        )}
                                                        
                                                        {procedure.match_confidence && procedure.match_confidence > 0 && (
                                                          <div className="flex items-center gap-1">
                                                            <TrendingUp className="h-3 w-3 text-indigo-500" />
                                                            <span className="font-medium">Confiança:</span>
                                                            <span>{(procedure.match_confidence * 100).toFixed(1)}%</span>
                                                          </div>
                                                        )}
                                                      </div>
                                                    </div>
                                                    
                                                    <div className="text-right ml-4">
                                                      <div className="text-xl font-bold text-green-600 mb-1">
                                                        {formatCurrency(procedure.value_reais)}
                                                      </div>
                                                      {procedure.billing_status && (
                                                        <div className="text-xs text-gray-500">
                                                          Status Faturamento: {procedure.billing_status}
                                                        </div>
                                                      )}
                                                    </div>
                                                  </div>
                                                </div>
                                              ))}
                                            </div>
                                          )}
                                        </div>
                                      </CollapsibleContent>
                                    </Collapsible>
                                  </div>
                                );
                              })}
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
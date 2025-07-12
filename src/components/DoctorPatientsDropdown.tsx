/**
 * ================================================================
 * DROPDOWN DE PACIENTES E PROCEDIMENTOS POR MÉDICO
 * ================================================================
 * Componente expandível para mostrar detalhes dos pacientes
 * e procedimentos de cada médico usando a view doctor_production
 * ================================================================
 */

import React, { useState, useEffect } from 'react';
import { Button } from './ui/button';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Badge } from './ui/badge';
import { Skeleton } from './ui/skeleton';
import { 
  ChevronDown, 
  ChevronUp, 
  User, 
  FileText, 
  Calendar, 
  DollarSign,
  Activity,
  Clock,
  CheckCircle,
  XCircle,
  AlertCircle,
  Stethoscope,
  Users,
  TrendingUp,
  Calculator
} from 'lucide-react';
import { 
  MedicalProductionControlService, 
  type DoctorPatientProcedure,
  type DoctorProductivitySummary 
} from '../services/medicalProductionControlService';
import { toast } from './ui/use-toast';
import PatientProceduresDropdown from './PatientProceduresDropdown';

// ================================================================
// TIPOS E INTERFACES
// ================================================================

interface DoctorPatientsDropdownProps {
  doctorIdentifier: string; // CNS, CRM ou nome
  doctorName: string;
  doctorCrm: string;
  isExpanded: boolean;
  onToggle: () => void;
}

// ================================================================
// COMPONENTE PRINCIPAL
// ================================================================

const DoctorPatientsDropdown: React.FC<DoctorPatientsDropdownProps> = ({
  doctorIdentifier,
  doctorName,
  doctorCrm,
  isExpanded,
  onToggle
}) => {
  
  // Estados
  const [isLoading, setIsLoading] = useState(false);
  const [patients, setPatients] = useState<DoctorPatientProcedure[]>([]);
  const [summary, setSummary] = useState<DoctorProductivitySummary | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [hasLoaded, setHasLoaded] = useState(false);
  const [selectedPeriod, setSelectedPeriod] = useState<'week' | 'month' | '3months'>('month');
  const [expandedPatients, setExpandedPatients] = useState<Set<string>>(new Set());

  // Carregar dados quando expandir
  useEffect(() => {
    if (isExpanded && !hasLoaded) {
      loadDoctorData();
    }
  }, [isExpanded, hasLoaded, doctorIdentifier]);

  /**
   * 📊 CARREGAR DADOS DO MÉDICO
   */
  const loadDoctorData = async () => {
    setIsLoading(true);
    setError(null);
    
    try {
      console.log('🔍 Carregando dados do médico:', doctorName);
      
      // ✅ USAR MÉTODO APRIMORADO QUE GARANTE CNS
      // Carregar pacientes e resumo em paralelo
      const [patientsResult, summaryResult] = await Promise.all([
        MedicalProductionControlService.getDoctorPatientsAndProceduresWithCns(doctorIdentifier, {
          limit: 10,
          status: 'ALL',
          minProcedures: 1
        }),
        MedicalProductionControlService.getDoctorProductivitySummary(doctorIdentifier, selectedPeriod)
      ]);
      
      if (patientsResult.success) {
        setPatients(patientsResult.data);
        console.log(`✅ ${patientsResult.data.length} pacientes carregados para médico específico`);
      } else {
        console.warn('⚠️ Erro ao carregar pacientes:', patientsResult.error);
      }
      
      if (summaryResult.success && summaryResult.data) {
        setSummary(summaryResult.data);
        console.log('✅ Resumo de produtividade carregado');
      } else {
        console.warn('⚠️ Erro ao carregar resumo:', summaryResult.error);
      }
      
      // Se nenhum dado foi encontrado, mostrar mensagem
      if (!patientsResult.success && !summaryResult.success) {
        setError('Nenhum dado encontrado para este médico');
      }
      
      setHasLoaded(true);
      
    } catch (error) {
      console.error('❌ Erro ao carregar dados do médico:', error);
      setError('Erro inesperado ao carregar dados');
      toast({
        variant: "destructive",
        title: "Erro",
        description: "Erro ao carregar dados do médico"
      });
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * 🔄 CONTROLAR EXPANSÃO DE PACIENTES INDIVIDUAIS
   */
  const togglePatientExpansion = (patientKey: string) => {
    const newExpanded = new Set(expandedPatients);
    if (newExpanded.has(patientKey)) {
      newExpanded.delete(patientKey);
    } else {
      newExpanded.add(patientKey);
    }
    setExpandedPatients(newExpanded);
  };

  /**
   * 🔄 RECARREGAR DADOS COM NOVO PERÍODO
   */
  const handlePeriodChange = async (newPeriod: 'week' | 'month' | '3months') => {
    setSelectedPeriod(newPeriod);
    setIsLoading(true);
    
    try {
      // ✅ BUSCAR CNS PRIMEIRO PARA GARANTIR ESPECIFICIDADE
      const doctorCns = await MedicalProductionControlService.getDoctorCnsByIdentifier(doctorIdentifier);
      
      if (doctorCns) {
        const summaryResult = await MedicalProductionControlService.getDoctorProductivitySummary(doctorCns, newPeriod);
        
        if (summaryResult.success && summaryResult.data) {
          setSummary(summaryResult.data);
          console.log(`✅ Resumo atualizado para período ${newPeriod} - CNS: ${doctorCns}`);
        }
      } else {
        console.warn('⚠️ CNS não encontrado para atualizar período');
      }
    } catch (error) {
      console.error('❌ Erro ao recarregar dados:', error);
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * 🎨 FORMATADORES
   */
  const formatCurrency = (value: number) => {
    return value.toLocaleString('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    });
  };

  const formatDate = (dateString: string) => {
    if (!dateString) return 'Não informado';
    return new Date(dateString).toLocaleDateString('pt-BR');
  };

  const formatAge = (birthDate: string) => {
    if (!birthDate) return 'N/A';
    return `${MedicalProductionControlService.calculateAge(birthDate)} anos`;
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'ATIVO':
        return <CheckCircle className="h-4 w-4 text-green-600" />;
      case 'MODERADO':
        return <AlertCircle className="h-4 w-4 text-yellow-600" />;
      case 'INATIVO':
        return <XCircle className="h-4 w-4 text-red-600" />;
      default:
        return <Activity className="h-4 w-4 text-gray-600" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'ATIVO':
        return 'bg-green-100 text-green-800 border-green-200';
      case 'MODERADO':
        return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'INATIVO':
        return 'bg-red-100 text-red-800 border-red-200';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  // ================================================================
  // RENDER
  // ================================================================

  return (
    <div className="mt-4">
      {/* Botão de Toggle */}
      <Button
        variant="outline"
        size="sm"
        onClick={onToggle}
        className="w-full flex items-center justify-between hover:bg-blue-50 border-blue-200"
      >
        <span className="flex items-center gap-2">
          <Users className="h-4 w-4" />
          Ver Pacientes e Procedimentos
        </span>
        {isExpanded ? (
          <ChevronUp className="h-4 w-4" />
        ) : (
          <ChevronDown className="h-4 w-4" />
        )}
      </Button>

      {/* Conteúdo Expandível */}
      {isExpanded && (
        <div className="mt-4 border rounded-lg bg-gray-50 p-4 space-y-4">
          
          {/* Loading State */}
          {isLoading && (
            <div className="space-y-3">
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-4 w-1/2" />
            </div>
          )}

          {/* Error State */}
          {error && !isLoading && (
            <div className="text-center py-4">
              <XCircle className="h-8 w-8 text-red-500 mx-auto mb-2" />
              <p className="text-sm text-red-600">{error}</p>
              <Button
                variant="outline"
                size="sm"
                onClick={loadDoctorData}
                className="mt-2"
              >
                Tentar novamente
              </Button>
            </div>
          )}

          {/* Resumo de Produtividade */}
          {summary && !isLoading && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <TrendingUp className="h-5 w-5" />
                  Resumo de Produtividade
                </CardTitle>
                
                {/* Seletor de Período */}
                <div className="flex gap-2 mt-2">
                  {(['week', 'month', '3months'] as const).map((period) => (
                    <Button
                      key={period}
                      variant={selectedPeriod === period ? "default" : "outline"}
                      size="sm"
                      onClick={() => handlePeriodChange(period)}
                      className="text-xs"
                    >
                      {period === 'week' ? '7 dias' : period === 'month' ? '30 dias' : '90 dias'}
                    </Button>
                  ))}
                </div>
              </CardHeader>
              
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                  <div className="text-center">
                    <div className="text-2xl font-bold text-blue-600">{summary.unique_patients}</div>
                    <div className="text-xs text-gray-600">Pacientes</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-green-600">{summary.total_procedures}</div>
                    <div className="text-xs text-gray-600">Procedimentos</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-purple-600">{summary.total_quantity}</div>
                    <div className="text-xs text-gray-600">Quantidade</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-orange-600">{formatCurrency(summary.total_revenue)}</div>
                    <div className="text-xs text-gray-600">Receita</div>
                  </div>
                </div>
                
                {/* Métricas Adicionais */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                  <div className="bg-white p-3 rounded-lg">
                    <div className="flex items-center gap-2">
                      <Calculator className="h-4 w-4 text-blue-500" />
                      <span>Média por Paciente</span>
                    </div>
                    <div className="font-semibold">{summary.avg_procedures_per_patient.toFixed(1)} proc.</div>
                  </div>
                  <div className="bg-white p-3 rounded-lg">
                    <div className="flex items-center gap-2">
                      <DollarSign className="h-4 w-4 text-green-500" />
                      <span>Valor Médio</span>
                    </div>
                    <div className="font-semibold">{formatCurrency(summary.avg_value_per_procedure)}</div>
                  </div>
                  <div className="bg-white p-3 rounded-lg">
                    <div className="flex items-center gap-2">
                      <Activity className="h-4 w-4 text-purple-500" />
                      <span>Qtd. Média</span>
                    </div>
                    <div className="font-semibold">{summary.avg_quantity_per_procedure.toFixed(1)}</div>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Lista de Pacientes */}
          {patients.length > 0 && !isLoading && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <User className="h-5 w-5" />
                  Pacientes Atendidos ({patients.length})
                </CardTitle>
              </CardHeader>
              
              <CardContent>
                <div className="space-y-3">
                  {patients.map((patient, index) => {
                const patientKey = patient.patient_cns || patient.patient_name || `patient_${index}`;
                return (
                  <PatientProceduresDropdown
                    key={patientKey}
                    patientName={patient.patient_name}
                    patientCns={patient.patient_cns}
                    procedures={patient.procedures_detailed}
                    isExpanded={expandedPatients.has(patientKey)}
                    onToggle={() => togglePatientExpansion(patientKey)}
                  />
                );
              })}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Top Pacientes (do resumo) */}
          {summary?.top_patients && summary.top_patients.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Users className="h-5 w-5" />
                  Top 5 Pacientes
                </CardTitle>
              </CardHeader>
              
              <CardContent>
                <div className="space-y-2">
                  {summary.top_patients.map((patient, index) => (
                    <div key={index} className="flex justify-between items-center p-2 bg-white rounded-lg">
                      <div className="flex-1">
                        <div className="font-medium">{patient.patient_name}</div>
                        <div className="text-sm text-gray-600">{patient.patient_cns}</div>
                      </div>
                      <div className="text-right">
                        <div className="font-semibold">{patient.procedures_count} proc.</div>
                        <div className="text-sm text-gray-600">{formatCurrency(patient.total_value)}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Top Procedimentos (do resumo) */}
          {summary?.top_procedures && summary.top_procedures.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Stethoscope className="h-5 w-5" />
                  Top 5 Procedimentos
                </CardTitle>
              </CardHeader>
              
              <CardContent>
                <div className="space-y-2">
                  {summary.top_procedures.map((procedure, index) => (
                    <div key={index} className="flex justify-between items-center p-2 bg-white rounded-lg">
                      <div className="flex-1">
                        <div className="font-medium">{procedure.procedure_name}</div>
                        <div className="text-sm text-gray-600">{procedure.procedure_code}</div>
                      </div>
                      <div className="text-right">
                        <div className="font-semibold">{procedure.count}x</div>
                        <div className="text-sm text-gray-600">{formatCurrency(procedure.total_value)}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Estado Vazio */}
          {!isLoading && !error && patients.length === 0 && !summary && (
            <div className="text-center py-8">
              <Users className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-600">Nenhum dado de produção encontrado</p>
              <p className="text-sm text-gray-500 mt-1">
                Verifique se existem procedimentos registrados para este médico
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default DoctorPatientsDropdown; 
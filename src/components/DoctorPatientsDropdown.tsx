/**
 * ================================================================
 * DROPDOWN DE PACIENTES E PROCEDIMENTOS POR MÉDICO
 * ================================================================
 * Componente expandível para mostrar detalhes dos pacientes
 * e procedimentos de cada médico usando a view doctor_production
 * ================================================================
 */

import React, { useState, useEffect } from 'react';
import { ChevronDown, User, FileText, Calendar, DollarSign } from 'lucide-react';
import { 
  getDoctorPatientsAndProcedures, 
  getDoctorProductivitySummary, 
  getDoctorBasicInfo 
} from '../services/medicalProductionControlService';

interface PatientData {
  patient_name: string;
  patient_cns: string;
  procedures: Array<{
    id: string;
    procedure_code: string;
    procedure_name: string;
    procedure_date: string;
    value_charged: number;
    billing_status: string;
    hospital_name: string;
  }>;
}

interface ProductivitySummary {
  totalProcedures: number;
  totalValue: number;
  approvedProcedures: number;
  pendingProcedures: number;
  averageValue: number;
}

interface DoctorBasicInfo {
  name: string;
  cns: string;
  crm: string;
  specialty: string;
}

interface DoctorPatientsDropdownProps {
  doctorName: string;
  doctorCns: string;
}

export const DoctorPatientsDropdown: React.FC<DoctorPatientsDropdownProps> = ({
  doctorName,
  doctorCns
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [patients, setPatients] = useState<PatientData[]>([]);
  const [summary, setSummary] = useState<ProductivitySummary | null>(null);
  const [doctorInfo, setDoctorInfo] = useState<DoctorBasicInfo | null>(null);
  const [error, setError] = useState<string | null>(null);

  // ✅ FUNÇÃO: Carregar dados do médico
  const loadDoctorData = async () => {
    if (isLoading) return;
    
    setIsLoading(true);
    setError(null);
    
    try {
      console.log('🔍 Carregando dados do médico:', doctorName);
      
      // ✅ PRIORIZAR: Usar nome do médico para busca (mais confiável)
      const searchIdentifier = doctorName || doctorCns;
      console.log('🆔 Identificador usado para busca:', searchIdentifier);

      // 📊 BUSCAR dados básicos do médico
      const doctorResult = await getDoctorBasicInfo(searchIdentifier);
      if (doctorResult.success && doctorResult.data) {
        setDoctorInfo(doctorResult.data);
        console.log('✅ Dados básicos carregados:', doctorResult.data);
      }

      // 👥 BUSCAR pacientes e procedimentos 
      const patientsResult = await getDoctorPatientsAndProcedures(searchIdentifier);
      if (patientsResult.success) {
        setPatients(patientsResult.data as PatientData[]);
        console.log('✅ Pacientes carregados:', patientsResult.data.length);
      } else {
        console.warn('⚠️ Erro ao carregar pacientes:', patientsResult.error);
        setError(patientsResult.error || 'Erro ao carregar pacientes');
      }

      // 📈 BUSCAR resumo de produtividade
      const summaryResult = await getDoctorProductivitySummary(searchIdentifier, 'month');
      if (summaryResult.success && summaryResult.data) {
        setSummary(summaryResult.data);
        console.log('✅ Resumo carregado:', summaryResult.data);
      } else {
        console.warn('⚠️ Erro ao carregar resumo:', summaryResult.error);
      }

    } catch (error) {
      console.error('❌ Erro ao carregar dados:', error);
      setError('Erro interno ao carregar dados');
    } finally {
      setIsLoading(false);
    }
  };

  // ✅ CARREGAR dados quando o dropdown for aberto
  useEffect(() => {
    if (isOpen && patients.length === 0) {
      loadDoctorData();
    }
  }, [isOpen]);

  // 💰 FORMATAR valores monetários
  const formatValue = (value: number) => {
    // Converter de centavos para reais se necessário
    const realValue = value > 1000 ? value / 100 : value;
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(realValue);
  };

  // 📅 FORMATAR datas
  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('pt-BR');
  };

  // 🎨 DEFINIR cor do status
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'approved': return 'text-green-600 bg-green-50';
      case 'pending': return 'text-yellow-600 bg-yellow-50';
      case 'rejected': return 'text-red-600 bg-red-50';
      case 'paid': return 'text-blue-600 bg-blue-50';
      default: return 'text-gray-600 bg-gray-50';
    }
  };

  return (
    <div className="relative">
      {/* ✅ BOTÃO PRINCIPAL */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center justify-between w-full px-3 py-2 text-sm border rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500"
        disabled={isLoading}
      >
        <div className="flex items-center gap-2">
          <User className="h-4 w-4 text-gray-500" />
          <span className="font-medium">{doctorName}</span>
          {isLoading && (
            <div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
          )}
        </div>
        <ChevronDown className={`h-4 w-4 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {/* ✅ DROPDOWN CONTENT */}
      {isOpen && (
        <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-md shadow-lg z-50 max-h-96 overflow-y-auto">
          
          {/* 📊 INFORMAÇÕES BÁSICAS DO MÉDICO */}
          {doctorInfo && (
            <div className="p-3 border-b bg-blue-50">
              <div className="text-sm font-medium text-blue-900">
                {doctorInfo.name}
              </div>
              <div className="text-xs text-blue-700 space-y-1">
                <div>CNS: {doctorInfo.cns}</div>
                <div>CRM: {doctorInfo.crm}</div>
                <div>Especialidade: {doctorInfo.specialty}</div>
              </div>
            </div>
          )}

          {/* 📈 RESUMO DE PRODUTIVIDADE */}
          {summary && (
            <div className="p-3 border-b bg-gray-50">
              <div className="text-sm font-medium text-gray-900 mb-2">
                Resumo do Último Mês
              </div>
              <div className="grid grid-cols-2 gap-3 text-xs">
                <div className="bg-white p-2 rounded border">
                  <div className="text-gray-500">Total Procedimentos</div>
                  <div className="font-bold text-blue-600">{summary.totalProcedures}</div>
                </div>
                <div className="bg-white p-2 rounded border">
                  <div className="text-gray-500">Valor Total</div>
                  <div className="font-bold text-green-600">{formatValue(summary.totalValue)}</div>
                </div>
                <div className="bg-white p-2 rounded border">
                  <div className="text-gray-500">Aprovados</div>
                  <div className="font-bold text-green-600">{summary.approvedProcedures}</div>
                </div>
                <div className="bg-white p-2 rounded border">
                  <div className="text-gray-500">Pendentes</div>
                  <div className="font-bold text-yellow-600">{summary.pendingProcedures}</div>
                </div>
              </div>
            </div>
          )}

          {/* ⚠️ ESTADO DE ERRO */}
          {error && (
            <div className="p-3 text-sm text-red-600 bg-red-50 border-b">
              {error}
            </div>
          )}

          {/* 📋 LISTA DE PACIENTES */}
          {patients.length > 0 ? (
            <div className="max-h-64 overflow-y-auto">
              {patients.map((patient, patientIndex) => (
                <div key={`${patient.patient_cns}-${patientIndex}`} className="border-b last:border-b-0">
                  
                  {/* 👤 CABEÇALHO DO PACIENTE */}
                  <div className="p-3 bg-gray-50 border-b">
                    <div className="text-sm font-medium text-gray-900">
                      {patient.patient_name}
                    </div>
                    <div className="text-xs text-gray-500">
                      CNS: {patient.patient_cns}
                    </div>
                    <div className="text-xs text-blue-600 mt-1">
                      {patient.procedures.length} procedimento(s)
                    </div>
                  </div>

                  {/* 🩺 PROCEDIMENTOS DO PACIENTE */}
                  <div className="space-y-1">
                    {patient.procedures.map((procedure, procIndex) => (
                      <div 
                        key={`${procedure.id}-${procIndex}`}
                        className="p-3 hover:bg-gray-50 border-b last:border-b-0"
                      >
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <div className="text-sm font-medium text-gray-900">
                              {procedure.procedure_name}
                            </div>
                            <div className="text-xs text-gray-500 space-y-1">
                              <div>Código: {procedure.procedure_code}</div>
                              <div>Data: {formatDate(procedure.procedure_date)}</div>
                              <div>Hospital: {procedure.hospital_name}</div>
                            </div>
                          </div>
                          <div className="text-right space-y-1">
                            <div className="text-sm font-bold text-green-600">
                              {formatValue(procedure.value_charged)}
                            </div>
                            <div className={`text-xs px-2 py-1 rounded ${getStatusColor(procedure.billing_status)}`}>
                              {procedure.billing_status}
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            !isLoading && !error && (
              <div className="p-4 text-center text-gray-500">
                <FileText className="h-8 w-8 mx-auto mb-2 text-gray-300" />
                <div className="text-sm">Nenhum procedimento encontrado</div>
              </div>
            )
          )}

          {/* 🔄 ESTADO DE CARREGAMENTO */}
          {isLoading && (
            <div className="p-4 text-center">
              <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-2"></div>
              <div className="text-sm text-gray-500">Carregando dados...</div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}; 
/**
 * ================================================================
 * DROPDOWN DE PACIENTES E PROCEDIMENTOS POR MÉDICO
 * ================================================================
 * Componente expandível para mostrar detalhes dos pacientes
 * e procedimentos de cada médico usando nosso doctorPatientService corrigido
 * ================================================================
 */

import React, { useState, useEffect, useCallback } from 'react';
import { ChevronDown, User, FileText, Calendar, DollarSign, CheckCircle, Clock, XCircle } from 'lucide-react';
import { 
  DoctorPatientService,
  type DoctorWithPatients,
  type PatientWithProcedures,
  type ProcedureDetail
} from '../services/doctorPatientService';

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
  const [doctorData, setDoctorData] = useState<DoctorWithPatients | null>(null);
  const [error, setError] = useState<string | null>(null);

  // ✅ FUNÇÃO: Carregar dados do médico usando nosso serviço corrigido
  const loadDoctorData = useCallback(async () => {
    if (isLoading) return;
    
    setIsLoading(true);
    setError(null);
    
    try {
      console.log('🔍 Carregando dados do médico via doctorPatientService:', { doctorName, doctorCns });
      
      // 🎯 USAR NOSSO SERVIÇO CORRIGIDO que funciona com procedure_records
      const result = await DoctorPatientService.getDoctorWithPatients(doctorCns);
      
      if (result.success && result.data) {
        // Converter para o formato esperado pelo componente
        const convertedData: DoctorWithPatients = {
          doctor_info: {
            name: result.data.doctor_name,
            cns: result.data.doctor_cns,
            crm: result.data.doctor_crm,
            specialty: result.data.doctor_specialty
          },
          hospitals: [], // Array vazio por enquanto
          patients: result.data.patients.map(patient => ({
            patient_info: {
              name: patient.patient_name || 'Nome não disponível',
              cns: patient.patient_cns || 'CNS não disponível',
              birth_date: patient.patient_birth_date || '',
              gender: patient.patient_gender || '',
              medical_record: patient.patient_id || ''
            },
            aih_info: {
              admission_date: patient.aih_info?.admission_date || '',
              discharge_date: patient.aih_info?.discharge_date,
              aih_number: patient.aih_info?.aih_number || ''
            },
            total_value_reais: patient.total_value_reais || 0,
            total_procedures: patient.total_procedures || patient.procedures?.length || 0,
            approved_procedures: patient.approved_procedures || 0,
            procedures: patient.procedures || []
          }))
        };
        
        setDoctorData(convertedData);
        console.log('✅ Dados carregados com sucesso:', convertedData);
      } else {
        console.warn('⚠️ Erro ao carregar dados:', result.error);
        setError(result.error || 'Erro ao carregar dados do médico');
      }

    } catch (error) {
      console.error('❌ Erro ao carregar dados:', error);
      setError('Erro interno ao carregar dados');
    } finally {
      setIsLoading(false);
    }
  }, [doctorName, doctorCns, isLoading]);

  // ✅ CARREGAR dados quando o dropdown for aberto
  useEffect(() => {
    if (isOpen && !doctorData) {
      loadDoctorData();
    }
  }, [isOpen, doctorData, loadDoctorData]);

  // 💰 FORMATAR valores monetários
  const formatValue = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(value);
  };

  // 📅 FORMATAR datas
  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('pt-BR');
  };

  // 🎨 DEFINIR cor e ícone do status
  const getStatusDisplay = (procedure: ProcedureDetail) => {
    if (procedure.approved === true) {
      return {
        color: 'text-green-600 bg-green-50',
        icon: <CheckCircle className="h-3 w-3" />,
        text: 'Aprovado'
      };
    } else if (procedure.approved === false) {
      return {
        color: 'text-red-600 bg-red-50',
        icon: <XCircle className="h-3 w-3" />,
        text: 'Rejeitado'
      };
    } else {
      return {
        color: 'text-yellow-600 bg-yellow-50',
        icon: <Clock className="h-3 w-3" />,
        text: 'Pendente'
      };
    }
  };

  // Função para identificar procedimentos médicos (código 04)
  const isMedicalProcedure = (procedureCode: string): boolean => {
    if (!procedureCode) return false;
    // Verifica múltiplos formatos possíveis para códigos 04
    const code = procedureCode.toString().trim();
    return (
      code.startsWith('04') || 
      code.startsWith('04.') ||
      code.includes('04.') ||
      /^0+4/.test(code) // Para casos como 004, 0004, etc.
    );
  };

  // 📊 CALCULAR estatísticas dos pacientes
  const calculateStats = () => {
    if (!doctorData) return { 
      totalPatients: 0, 
      totalProcedures: 0, 
      approvedProcedures: 0, 
      totalValue: 0,
      medicalProceduresValue: 0,
      medicalProceduresCount: 0
    };
    
    const totalPatients = doctorData.patients.length;
    const totalProcedures = doctorData.patients.reduce((sum, p) => sum + p.procedures.length, 0);
    const approvedProcedures = doctorData.patients.reduce((sum, p) => 
      sum + p.procedures.filter(proc => proc.approved === true).length, 0
    );
    const totalValue = doctorData.patients.reduce((sum, p) => 
      sum + p.procedures.reduce((procSum, proc) => procSum + proc.value_reais, 0), 0
    );
    
    // 🆕 CALCULAR valores específicos dos procedimentos médicos ("04")
    const medicalProceduresValue = doctorData.patients.reduce((sum, p) => 
      sum + p.procedures
        .filter(proc => isMedicalProcedure(proc.procedure_code))
        .reduce((procSum, proc) => procSum + proc.value_reais, 0), 0
    );
    
    const medicalProceduresCount = doctorData.patients.reduce((sum, p) => 
      sum + p.procedures.filter(proc => isMedicalProcedure(proc.procedure_code)).length, 0
    );
    
    return { 
      totalPatients, 
      totalProcedures, 
      approvedProcedures, 
      totalValue,
      medicalProceduresValue,
      medicalProceduresCount
    };
  };

  const stats = calculateStats();

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
          {doctorData && (
            <div className="p-3 border-b bg-blue-50">
              <div className="text-sm font-medium text-blue-900">
                {doctorData.doctor_info.name}
              </div>
              <div className="text-xs text-blue-700 space-y-1">
                <div>CNS: {doctorData.doctor_info.cns}</div>
                <div>CRM: {doctorData.doctor_info.crm}</div>
                <div>Especialidade: {doctorData.doctor_info.specialty}</div>
              </div>
            </div>
          )}

          {/* 📈 RESUMO DE PRODUTIVIDADE */}
          {doctorData && (
            <div className="p-3 border-b bg-gray-50">
              <div className="text-sm font-medium text-gray-900 mb-2">
                Resumo Geral
              </div>
              <div className="grid grid-cols-2 gap-3 text-xs">
                <div className="bg-white p-2 rounded border">
                  <div className="text-gray-500">Pacientes</div>
                  <div className="font-bold text-blue-600">{stats.totalPatients}</div>
                </div>
                <div className="bg-white p-2 rounded border">
                  <div className="text-gray-500">Procedimentos</div>
                  <div className="font-bold text-purple-600">{stats.totalProcedures}</div>
                </div>
                <div className="bg-white p-2 rounded border">
                  <div className="text-gray-500">Aprovados</div>
                  <div className="font-bold text-green-600">{stats.approvedProcedures}</div>
                </div>
                <div className="bg-white p-2 rounded border">
                  <div className="text-gray-500">Valor Total AIH</div>
                  <div className="font-bold text-emerald-600">{formatValue(stats.totalValue)}</div>
                </div>
                <div className="bg-white p-2 rounded border border-orange-200">
                  <div className="text-orange-600 text-xs">Proc. Médicos (04)</div>
                  <div className="font-bold text-orange-600">{stats.medicalProceduresCount}</div>
                </div>
                <div className="bg-white p-2 rounded border border-orange-200">
                  <div className="text-orange-600 text-xs">Valor Médico (04)</div>
                  <div className="font-bold text-orange-600">{formatValue(stats.medicalProceduresValue)}</div>
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

          {/* 📋 LISTA DE PACIENTES E PROCEDIMENTOS */}
          {doctorData && doctorData.patients.length > 0 ? (
            <div className="max-h-64 overflow-y-auto">
              {doctorData.patients.map((patient, patientIndex) => (
                <div key={`${patient.patient_info?.cns}-${patientIndex}`} className="border-b last:border-b-0">
                  
                  {/* 👤 CABEÇALHO DO PACIENTE */}
                  <div className="p-3 bg-gray-50 border-b">
                    <div className="flex justify-between items-start">
                      <div className="flex-1">
                        <div className="text-sm font-medium text-gray-900">
                          {patient.patient_info?.name || 'Nome não disponível'}
                        </div>
                        <div className="text-xs text-gray-500">
                          CNS: {patient.patient_info?.cns || 'CNS não disponível'}
                        </div>
                        <div className="text-xs text-blue-600 mt-1">
                          {patient.procedures.length} procedimento(s)
                        </div>
                      </div>
                      <div className="text-right space-y-1">
                        <div className="text-xs text-gray-500">
                          Total AIH: <span className="font-bold text-emerald-600">
                            {formatValue(patient.procedures.reduce((sum, proc) => sum + proc.value_reais, 0))}
                          </span>
                        </div>
                        <div className="text-xs text-orange-600">
                          Proc. 04: <span className="font-bold">
                            {formatValue(patient.procedures
                              .filter(proc => isMedicalProcedure(proc.procedure_code))
                              .reduce((sum, proc) => sum + proc.value_reais, 0))}
                            ({patient.procedures.filter(proc => isMedicalProcedure(proc.procedure_code)).length})
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* 🩺 PROCEDIMENTOS DO PACIENTE */}
                  {patient.procedures.length > 0 ? (
                    <div className="space-y-1">
                      {patient.procedures.map((procedure, procIndex) => {
                        const statusDisplay = getStatusDisplay(procedure);
                        return (
                          <div 
                            key={`${procedure.procedure_id}-${procIndex}`}
                            className={`p-3 hover:bg-gray-50 border-b last:border-b-0 ${
                               isMedicalProcedure(procedure.procedure_code) ? 'bg-orange-50 border-l-4 border-l-orange-400' : ''
                             }`}
                          >
                            <div className="flex items-start justify-between">
                              <div className="flex-1">
                                <div className="flex items-center gap-2">
                                  <div className="text-sm font-medium text-gray-900">
                                    {procedure.procedure_description}
                                  </div>
                                  {isMedicalProcedure(procedure.procedure_code) && (
                                    <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-orange-100 text-orange-800">
                                      Médico 04
                                    </span>
                                  )}
                                </div>
                                <div className="text-xs text-gray-500 space-y-1 mt-1">
                                  <div>Código: {procedure.procedure_code}</div>
                                  <div>Data: {formatDate(procedure.procedure_date)}</div>
                                  {procedure.sequence && (
                                    <div>Sequência: {procedure.sequence}</div>
                                  )}
                                  {procedure.aih_id && (
                                    <div>AIH: {procedure.aih_id.substring(0, 8)}...</div>
                                  )}
                                </div>
                              </div>
                              <div className="text-right space-y-1 ml-3">
                                <div className={`text-sm font-bold ${
                                  isMedicalProcedure(procedure.procedure_code) ? 'text-orange-600' : 'text-green-600'
                                }`}>
                                  {formatValue(procedure.value_reais)}
                                </div>
                                <div className={`text-xs px-2 py-1 rounded flex items-center gap-1 ${statusDisplay.color}`}>
                                  {statusDisplay.icon}
                                  {statusDisplay.text}
                                </div>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="p-3 text-center text-gray-500 text-sm">
                      Nenhum procedimento encontrado para este paciente
                    </div>
                  )}
                </div>
              ))}
            </div>
          ) : (
            !isLoading && !error && (
              <div className="p-4 text-center text-gray-500">
                <FileText className="h-8 w-8 mx-auto mb-2 text-gray-300" />
                <div className="text-sm">Nenhum paciente encontrado</div>
                <div className="text-xs mt-1">Este médico ainda não possui pacientes com procedimentos registrados</div>
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
/**
 * ================================================================
 * DROPDOWN DE PACIENTES E PROCEDIMENTOS POR MÉDICO
 * ================================================================
 * Componente expandível para mostrar detalhes dos pacientes
 * e procedimentos de cada médico usando nosso doctorPatientService corrigido
 * ================================================================
 */

import React, { useState, useEffect, useCallback } from 'react';
import { Badge } from './ui/badge';
import { ChevronDown, User, FileText, Calendar, DollarSign, CheckCircle, Clock, XCircle } from 'lucide-react';
import { 
  DoctorPatientService,
  type DoctorWithPatients,
  type PatientWithProcedures,
  type ProcedureDetail
} from '../services/doctorPatientService';
import { isDoctorCoveredForOperaParana, computeIncrementForProcedures, getProcedureIncrementMeta, hasAnyExcludedCodeInProcedures } from '../config/operaParana';
import { sumProceduresBaseReais } from '@/utils/valueHelpers';

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
              name: patient.patient_info?.name || 'Nome não disponível',
              cns: patient.patient_info?.cns || 'CNS não disponível',
              birth_date: patient.patient_info?.birth_date || '',
              gender: patient.patient_info?.gender || '',
              medical_record: patient.patient_info?.medical_record || ''
            },
            aih_info: {
              admission_date: patient.aih_info?.admission_date || '',
              discharge_date: patient.aih_info?.discharge_date,
              competencia: (patient as any).aih_info?.competencia,
              aih_number: patient.aih_info?.aih_number || '',
              care_character: (patient as any).aih_info?.care_character
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
  // 📅 FORMATAR competência (YYYY-MM[-DD] → MM/YYYY)
  const formatCompetencia = (value?: string) => {
    if (!value) return '';
    const m = String(value).match(/^(\d{4})-(\d{2})/);
    if (m) return `${m[2]}/${m[1]}`;
    try {
      const d = new Date(value);
      if (!isNaN(d.getTime())) {
        return `${String(d.getUTCMonth() + 1).padStart(2, '0')}/${d.getUTCFullYear()}`;
      }
    } catch {}
    return String(value);
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
    // Verifica se o código inicia com '04'
    const code = procedureCode.toString().trim();
    return code.startsWith('04');
  };

  // Programa Opera Paraná: usar verificação centralizada com lista de exclusões
  const isOperaParanaEligible = (procedureCode: string, careCharacter?: string | number): boolean => {
    return isDoctorCoveredForOperaParana(doctorName);
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
      {/* ✅ BOTÃO PRINCIPAL - DESIGN EXECUTIVO */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`group flex items-center justify-between w-full px-4 py-3 text-sm border-2 rounded-lg transition-all duration-200 ${
          isOpen 
            ? 'border-blue-300 bg-gradient-to-r from-blue-50 to-indigo-50 shadow-md' 
            : 'border-gray-200 bg-white hover:border-blue-200 hover:bg-gradient-to-r hover:from-gray-50 hover:to-blue-50'
        } focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-1`}
        disabled={isLoading}
      >
        <div className="flex items-center gap-3">
          <div className={`flex items-center justify-center w-8 h-8 rounded-full transition-colors ${
            isOpen ? 'bg-blue-100 border-2 border-blue-200' : 'bg-gray-100 border-2 border-gray-200 group-hover:bg-blue-100 group-hover:border-blue-200'
          }`}>
            <User className={`h-4 w-4 transition-colors ${
              isOpen ? 'text-blue-600' : 'text-gray-500 group-hover:text-blue-600'
            }`} />
          </div>
          <div className="flex flex-col items-start">
            <span className={`font-semibold transition-colors ${
              isOpen ? 'text-blue-900' : 'text-gray-900 group-hover:text-blue-900'
            }`}>
              {doctorName}
            </span>
            <span className="text-xs text-gray-500 font-medium">
              {doctorName === 'HUMBERTO MOREIRA DA SILVA' ? 'Médico Especialista' : 'Profissional Médico'}
            </span>
          </div>
          {isLoading && (
            <div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin ml-2"></div>
          )}
        </div>
        <div className="flex items-center space-x-2">
          {doctorName === 'HUMBERTO MOREIRA DA SILVA' && (
            <div className="bg-orange-100 text-orange-700 text-xs font-bold px-2 py-1 rounded-full border border-orange-200">
              04
            </div>
          )}
          <ChevronDown className={`h-4 w-4 transition-all duration-200 ${
            isOpen ? 'rotate-180 text-blue-600' : 'text-gray-400 group-hover:text-blue-600'
          }`} />
        </div>
      </button>

      {/* ✅ DROPDOWN CONTENT */}
      {isOpen && (
        <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-md shadow-lg z-50 max-h-96 overflow-y-auto">
          
          {/* 📊 CABEÇALHO EXECUTIVO DO MÉDICO */}
          {doctorData && (
            <div className="p-4 border-b bg-gradient-to-r from-blue-50 via-indigo-50 to-slate-50">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center space-x-3 mb-2">
                    <div className="flex items-center justify-center w-10 h-10 bg-blue-100 rounded-full border-2 border-blue-200">
                      <User className="h-5 w-5 text-blue-600" />
                    </div>
                    <div>
                      <h2 className="text-base font-bold text-gray-900 leading-tight">
                        {doctorData.doctor_info.name}
                      </h2>
                      <p className="text-xs text-gray-600 font-medium">
                        {doctorData.doctor_info.specialty || 'Especialidade não informada'}
                      </p>
                    </div>
                  </div>
                  
                  {/* CREDENCIAIS PROFISSIONAIS */}
                  <div className="flex items-center space-x-4 mt-2">
                    <div className="flex items-center space-x-1">
                      <span className="text-xs font-medium text-gray-500">CNS:</span>
                      <span className="text-xs font-mono text-gray-700 bg-white px-2 py-1 rounded border">
                        {doctorData.doctor_info.cns}
                      </span>
                    </div>
                    <div className="flex items-center space-x-1">
                      <span className="text-xs font-medium text-gray-500">CRM:</span>
                      <span className="text-xs font-mono text-gray-700 bg-white px-2 py-1 rounded border">
                        {doctorData.doctor_info.crm}
                      </span>
                    </div>
                  </div>
                </div>
                
                {/* BADGE DE STATUS */}
                <div className="flex flex-col items-end space-y-1">
                  <div className="bg-green-100 text-green-800 text-xs font-medium px-2 py-1 rounded-full border border-green-200">
                    ✓ Ativo
                  </div>
                  <div className="text-xs text-gray-500">
                    {new Date().toLocaleDateString('pt-BR')}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* 📈 RESUMO EXECUTIVO - DESIGN SOFISTICADO */}
          {doctorData && (
            <div className="p-4 border-b bg-gradient-to-r from-slate-50 to-gray-50">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-semibold text-gray-800 tracking-wide uppercase">
                  Performance Executiva
                </h3>
                <div className="text-xs text-gray-500 bg-white px-2 py-1 rounded-full border">
                  {stats.totalPatients} AIH{stats.totalPatients !== 1 ? 's' : ''}
                </div>
              </div>
              
              {/* KPIs PRINCIPAIS - LAYOUT HORIZONTAL COMPACTO */}
              <div className="space-y-3">
                {/* LINHA 1: Métricas de Volume */}
                <div className="flex items-center justify-between py-2 border-b border-gray-100">
                  <div className="flex items-center space-x-6">
                    <div className="flex items-center space-x-2">
                      <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                      <span className="text-xs text-gray-600 font-medium">Pacientes</span>
                      <span className="text-sm font-bold text-gray-900">{stats.totalPatients}</span>
                    </div>
                    <div className="flex items-center space-x-2">
                      <div className="w-2 h-2 bg-purple-500 rounded-full"></div>
                      <span className="text-xs text-gray-600 font-medium">Procedimentos</span>
                      <span className="text-sm font-bold text-gray-900">{stats.totalProcedures}</span>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-xs text-gray-500">Ticket Médio</div>
                    <div className="text-sm font-bold text-gray-900">
                      {stats.totalPatients > 0 ? formatValue(stats.totalValue / stats.totalPatients) : 'R$ 0,00'}
                    </div>
                  </div>
                </div>
                
                {/* LINHA 2: Métricas Financeiras */}
                <div className="flex items-center justify-between py-2 border-b border-gray-100">
                  <div className="flex items-center space-x-6">
                    <div className="flex items-center space-x-2">
                      <div className="w-2 h-2 bg-emerald-500 rounded-full"></div>
                      <span className="text-xs text-gray-600 font-medium">Faturamento Total</span>
                      <span className="text-sm font-bold text-emerald-700">{formatValue(stats.totalValue)}</span>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-xs text-gray-500">Taxa Aprovação</div>
                    <div className="text-sm font-bold text-gray-900">
                      {stats.totalProcedures > 0 ? Math.round((stats.approvedProcedures / stats.totalProcedures) * 100) : 0}%
                    </div>
                  </div>
                </div>
                
                {/* LINHA 3: Produção Médica (Destaque) */}
                <div className="bg-gradient-to-r from-orange-50 to-amber-50 rounded-lg p-3 border border-orange-200">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                      <div className="flex items-center justify-center w-8 h-8 bg-orange-100 rounded-full">
                        <span className="text-xs font-bold text-orange-700">04</span>
                      </div>
                      <div>
                        <div className="text-xs font-medium text-orange-800">Produção Médica</div>
                        <div className="text-xs text-orange-600">{stats.medicalProceduresCount} procedimento(s) médico(s)</div>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-lg font-bold text-orange-700">{formatValue(stats.medicalProceduresValue)}</div>
                      <div className="text-xs text-orange-600">
                        {stats.medicalProceduresCount > 0 ? 
                          `Média: ${formatValue(stats.medicalProceduresValue / stats.medicalProceduresCount)}` : 
                          'Sem produção médica'
                        }
                      </div>
                    </div>
                  </div>
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
                  
                  {/* 👤 CABEÇALHO DO PACIENTE - DESIGN LIMPO E OBJETIVO */}
                  <div className="p-4 bg-white border-b border-gray-200">
                    {/* NOME DO PACIENTE - DESTAQUE */}
                    <div className="mb-3 pb-3 border-b border-gray-100">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <div className="flex items-center justify-center w-8 h-8 bg-blue-100 rounded-full">
                            <User className="h-4 w-4 text-blue-600" />
                          </div>
                          <div className="text-base font-bold text-gray-900">
                            {patient.patient_info?.name || 'Nome não disponível'}
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200 text-[10px] font-semibold">
                            {patient.procedures.length} PROC
                          </Badge>
                          {(patient.aih_info as any)?.care_character && (
                            <Badge variant="outline" className={`text-[10px] font-semibold ${((patient.aih_info as any).care_character === '1') ? 'bg-emerald-50 border-emerald-200 text-emerald-700' : 'bg-amber-50 border-amber-200 text-amber-700'}`}>
                              {((patient.aih_info as any).care_character === '1') ? '01 - ELETIVO' : '02 - URGÊNCIA'}
                            </Badge>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* GRID DE INFORMAÇÕES - 2 COLUNAS */}
                    <div className="grid grid-cols-2 gap-x-4 gap-y-2 mb-3">
                      {/* Coluna 1 */}
                      <div className="space-y-2">
                        <div className="flex items-baseline gap-2">
                          <span className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide">Prontuário:</span>
                          <span className="text-xs font-medium text-gray-900">{patient.patient_info?.medical_record || '-'}</span>
                        </div>
                        <div className="flex items-baseline gap-2">
                          <span className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide">CNS:</span>
                          <span className="text-xs font-mono font-medium text-gray-900">{patient.patient_info?.cns || 'CNS não disponível'}</span>
                        </div>
                        <div className="flex items-baseline gap-2">
                          <span className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide">Nº AIH:</span>
                          <span className="text-xs font-mono font-medium text-gray-900">{patient.aih_info?.aih_number || '-'}</span>
                        </div>
                        <div className="flex items-baseline gap-2">
                          <span className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide">Competência:</span>
                          <span className="text-xs font-semibold text-blue-700">
                            {patient.aih_info && (patient.aih_info as any).competencia ? formatCompetencia((patient.aih_info as any).competencia as any) : '-'}
                          </span>
                        </div>
                      </div>

                      {/* Coluna 2 */}
                      <div className="space-y-2">
                        <div className="flex items-baseline gap-2">
                          <span className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide">Admissão:</span>
                          <span className="text-xs font-medium text-gray-900">
                            {patient.aih_info?.admission_date ? formatDate(patient.aih_info.admission_date) : '-'}
                          </span>
                        </div>
                        <div className="flex items-baseline gap-2">
                          <span className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide">Alta:</span>
                          <span className="text-xs font-medium text-gray-900">
                            {patient.aih_info?.discharge_date ? formatDate(patient.aih_info.discharge_date) : '-'}
                          </span>
                        </div>
                        <div className="flex items-baseline gap-2">
                          <span className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide">Gênero:</span>
                          <span className="text-xs font-medium text-gray-900">
                            {patient.patient_info?.gender === 'M' ? 'Masculino' : patient.patient_info?.gender === 'F' ? 'Feminino' : '-'}
                          </span>
                        </div>
                        <div className="flex items-baseline gap-2">
                          <span className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide">Nascimento:</span>
                          <span className="text-xs font-medium text-gray-900">
                            {patient.patient_info?.birth_date ? formatDate(patient.patient_info.birth_date) : '-'}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* SEÇÃO DE VALORES - DESTAQUE ESPECIAL (AIH SECA, INCREMENTO, AIH C/ INCREMENTO) */}
                    {(() => {
                      const doctorCovered = isDoctorCoveredForOperaParana(doctorName);
                      const baseAih = typeof (patient as any).total_value_reais === 'number'
                        ? (patient as any).total_value_reais
                        : sumProceduresBaseReais(patient.procedures as any);
                      const careCharacter = (patient.aih_info as any)?.care_character;
                      const increment = doctorCovered ? computeIncrementForProcedures(patient.procedures as any, careCharacter, doctorName) : 0;
                      const hasIncrement = increment > 0;
                      const withIncrement = baseAih + increment;
                      const medicalValue = patient.procedures
                        .filter(proc => isMedicalProcedure(proc.procedure_code))
                        .reduce((sum, proc) => sum + proc.value_reais, 0);
                      const medicalCount = patient.procedures.filter(proc => isMedicalProcedure(proc.procedure_code)).length;
                      
                      return (
                        <div className="mt-3 pt-3 border-t-2 border-gray-200 space-y-2">
                          {/* AIH SECA - CAMPO MAIS IMPORTANTE */}
                          <div className="bg-gradient-to-r from-emerald-50 to-green-50 rounded-lg p-3 border-2 border-emerald-200">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                <DollarSign className="h-4 w-4 text-emerald-600" />
                                <span className="text-xs font-bold text-emerald-900 uppercase tracking-wide">AIH Seca</span>
                              </div>
                              <span className="text-lg font-black text-emerald-700">{formatValue(baseAih)}</span>
                            </div>
                          </div>

                          {/* INCREMENTO - SE HOUVER */}
                          {hasIncrement && (
                            <>
                              <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg p-3 border-2 border-blue-200">
                                <div className="flex items-center justify-between">
                                  <div className="flex items-center gap-2">
                                    <span className="text-lg">📈</span>
                                    <span className="text-xs font-bold text-blue-900 uppercase tracking-wide">Incremento</span>
                                  </div>
                                  <span className="text-lg font-black text-blue-700">{formatValue(increment)}</span>
                                </div>
                              </div>

                              {/* AIH C/ INCREMENTO - TOTAL FINAL */}
                              <div className="bg-gradient-to-r from-purple-50 to-pink-50 rounded-lg p-3 border-2 border-purple-300">
                                <div className="flex items-center justify-between">
                                  <div className="flex items-center gap-2">
                                    <CheckCircle className="h-4 w-4 text-purple-600" />
                                    <span className="text-xs font-bold text-purple-900 uppercase tracking-wide">AIH c/ Incremento</span>
                                  </div>
                                  <span className="text-lg font-black text-purple-700">{formatValue(withIncrement)}</span>
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
                                <span className="text-sm font-bold text-orange-700">{formatValue(medicalValue)}</span>
                              </div>
                            </div>
                          )} */}
                        </div>
                      );
                    })()}
                  </div>

                  {/* 🩺 PROCEDIMENTOS DO PACIENTE */}
                  {patient.procedures.length > 0 ? (
                    <div className="space-y-1">
                      {patient.procedures.map((procedure, procIndex) => {
                        const statusDisplay = getStatusDisplay(procedure);
                        const careCharacter = (patient.aih_info as any)?.care_character;
                        const aihHasExcluded = hasAnyExcludedCodeInProcedures(patient.procedures as any);
                        const incMeta = getProcedureIncrementMeta(procedure.procedure_code, careCharacter, doctorName, undefined, aihHasExcluded);
                        const isMedical04 = isMedicalProcedure(procedure.procedure_code);
                        const isPrincipal = procedure.sequence === 1;
                        return (
                          <div 
                            key={`${procedure.procedure_id}-${procIndex}`}
                            className={`bg-white border rounded-lg overflow-hidden mb-2 ${
                              isMedical04 && isPrincipal ? 'border-emerald-300 shadow-sm' : 'border-slate-200'
                            } ${incMeta ? 'ring-2 ring-emerald-200' : ''}`}
                          >
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
                                {incMeta && (
                                  <Badge variant="outline" className="bg-emerald-50 text-emerald-800 border-emerald-200 text-[10px] font-bold">
                                    {incMeta.label}
                                  </Badge>
                                )}
                                {procedure.sequence && procedure.sequence > 1 && (
                                  <Badge variant="outline" className="bg-slate-100 text-slate-700 border-slate-300 text-[10px]">
                                    Seq. {procedure.sequence}
                                  </Badge>
                                )}
                                <div className={`text-xs px-2 py-0.5 rounded flex items-center gap-1 ${statusDisplay.color}`}>
                                  {statusDisplay.icon}
                                  {statusDisplay.text}
                                </div>
                              </div>
                              
                              {/* VALOR NO CABEÇALHO */}
                              <div className="text-right">
                                {(() => {
                                  const base = procedure.value_reais || 0;
                                  if (incMeta) {
                                    const incremented = base * incMeta.factor;
                                    return (
                                      <div className="text-right">
                                        <div className="text-[10px] text-slate-500 line-through">{formatValue(base)}</div>
                                        <div className="text-base font-black text-emerald-700">{formatValue(incremented)}</div>
                                      </div>
                                    );
                                  }
                                  return (
                                    <div className={`text-base font-bold ${isMedical04 && isPrincipal ? 'text-emerald-700' : 'text-slate-900'}`}>
                                      {formatValue(base)}
                                    </div>
                                  );
                                })()}
                              </div>
                            </div>
                            
                            {/* CORPO DO PROCEDIMENTO */}
                            <div className="px-4 py-3">
                              {/* DESCRIÇÃO */}
                              <div className="mb-3">
                                <p className="text-sm text-slate-700 leading-relaxed">
                                  {procedure.procedure_description || 'Descrição não disponível'}
                                </p>
                              </div>
                              
                              {/* GRID DE INFORMAÇÕES (2 COLUNAS) */}
                              <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-xs">
                                {/* DATA */}
                                <div>
                                  <span className="text-slate-500 font-medium uppercase tracking-wide">Data:</span>
                                  <span className="ml-2 text-slate-900 font-medium">{formatDate(procedure.procedure_date)}</span>
                                </div>
                                
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
                                
                                {/* AIH ID */}
                                {procedure.aih_id && (
                                  <div className="col-span-2">
                                    <span className="text-slate-500 font-medium uppercase tracking-wide">AIH ID:</span>
                                    <span className="ml-2 text-slate-900 font-mono text-[10px]">{procedure.aih_id.substring(0, 8)}...</span>
                                  </div>
                                )}
                                
                                {/* PROFISSIONAL */}
                                {procedure.professional_name && (
                                  <div className="col-span-2">
                                    <span className="text-slate-500 font-medium uppercase tracking-wide">Profissional:</span>
                                    <span className="ml-2 text-slate-900">{procedure.professional_name}</span>
                                  </div>
                                )}
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
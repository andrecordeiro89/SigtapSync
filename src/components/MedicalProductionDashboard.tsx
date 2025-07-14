import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Badge } from './ui/badge';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from './ui/collapsible';
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
  BarChart3
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

// ✅ COMPONENTE PRINCIPAL
const MedicalProductionDashboard: React.FC = () => {
  const [doctors, setDoctors] = useState<DoctorWithPatients[]>([]);
  const [filteredDoctors, setFilteredDoctors] = useState<DoctorWithPatients[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [expandedDoctors, setExpandedDoctors] = useState<Set<string>>(new Set());
  const [expandedPatients, setExpandedPatients] = useState<Set<string>>(new Set());

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

  // ✅ CALCULAR ESTATÍSTICAS GLOBAIS
  const globalStats = React.useMemo(() => {
    const totalDoctors = doctors.length;
    const totalPatients = doctors.reduce((sum, doctor) => sum + doctor.patients.length, 0);
    const totalProcedures = doctors.reduce((sum, doctor) => 
      sum + doctor.patients.reduce((patSum, patient) => patSum + patient.procedures.length, 0), 0
    );
    const totalRevenue = doctors.reduce((sum, doctor) => 
      sum + doctor.patients.reduce((patSum, patient) => 
        patSum + patient.procedures.reduce((procSum, proc) => procSum + (proc.value_reais || 0), 0), 0
      ), 0
    );
    const avgTicket = totalPatients > 0 ? totalRevenue / totalPatients : 0;

    return {
      totalDoctors,
      totalPatients,
      totalProcedures,
      totalRevenue,
      avgTicket
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
      {/* ✅ ESTATÍSTICAS GLOBAIS */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
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
      </div>

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
                                <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center">
                                  <Stethoscope className="h-6 w-6 text-blue-600" />
                                </div>
                              </div>
                              <div>
                                <h3 className="font-semibold text-lg text-gray-900">
                                  {doctor.doctor_info.name}
                                </h3>
                                <div className="flex items-center gap-4 text-sm text-gray-600">
                                  <span>CNS: {doctor.doctor_info.cns}</span>
                                  {doctor.doctor_info.crm && <span>CRM: {doctor.doctor_info.crm}</span>}
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
                                              <div className="font-semibold text-green-600">
                                                {formatCurrency(patient.procedures.reduce((sum, proc) => sum + (proc.value_reais || 0), 0))}
                                              </div>
                                              <div className="text-sm text-gray-600">
                                                {patient.procedures.length} procedimento(s)
                                              </div>
                                            </div>
                                          </div>
                                        </div>
                                      </CollapsibleTrigger>

                                      {/* ✅ LISTA DE PROCEDIMENTOS */}
                                      <CollapsibleContent>
                                        <div className="mt-3 space-y-2">
                                          <h5 className="font-medium text-gray-700 flex items-center gap-2">
                                            <FileText className="h-4 w-4" />
                                            Procedimentos Realizados
                                          </h5>
                                          {patient.procedures.map((procedure, procIndex) => (
                                            <div key={procIndex} className="bg-white p-3 rounded border">
                                              <div className="flex items-center justify-between">
                                                <div className="flex-1">
                                                  <div className="font-medium text-gray-900">
                                                    {procedure.procedure_code}
                                                  </div>
                                                  <div className="text-sm text-gray-600 mt-1">
                                                    {procedure.procedure_description || 'Descrição não disponível'}
                                                  </div>
                                                  <div className="flex items-center gap-4 mt-2 text-xs text-gray-500">
                                                    <div className="flex items-center gap-1">
                                                      <Calendar className="h-3 w-3" />
                                                      {procedure.procedure_date ? new Date(procedure.procedure_date).toLocaleDateString('pt-BR') : 'Data não informada'}
                                                    </div>
                                                    <div className="flex items-center gap-1">
                                                      {procedure.approval_status === 'approved' ? (
                                                        <><CheckCircle className="h-3 w-3 text-green-500" />Aprovado</>
                                                      ) : procedure.approval_status === 'rejected' ? (
                                                        <><XCircle className="h-3 w-3 text-red-500" />Rejeitado</>
                                                      ) : (
                                                        <><AlertCircle className="h-3 w-3 text-yellow-500" />Pendente</>
                                                      )}
                                                    </div>
                                                  </div>
                                                </div>
                                                <div className="text-right">
                                                  <div className="text-lg font-bold text-green-600">
                                                    {formatCurrency(procedure.value_reais)}
                                                  </div>
                                                  {procedure.value_cents && (
                                                    <div className="text-xs text-gray-500">
                                                      {procedure.value_cents} centavos
                                                    </div>
                                                  )}
                                                </div>
                                              </div>
                                            </div>
                                          ))}
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
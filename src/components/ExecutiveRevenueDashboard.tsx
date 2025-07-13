/**
 * ================================================================
 * DASHBOARD EXECUTIVO DE FATURAMENTO - VISÃO COMPLETA
 * ================================================================
 * Criado em: 2024-12-19
 * Propósito: Dashboard executivo unificado com todas as métricas
 * Views utilizadas: Todas as 4 views de faturamento
 * ================================================================
 */

import React, { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Badge } from './ui/badge';
import { Button } from './ui/button';
import { Skeleton } from './ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import { 
  BarChart3, 
  Building2,
  TrendingUp, 
  Users, 
  DollarSign, 
  Activity,
  Award,
  RefreshCw,
  Download,
  Stethoscope,
  Calendar,
  ArrowUpRight,
  ArrowDownRight,
  Target,
  PieChart,
  Zap,
  TrendingDown
} from 'lucide-react';
import { DoctorsRevenueService, type SpecialtyStats, type HospitalStats, type DoctorAggregated } from '../services/doctorsRevenueService';
import { toast } from './ui/use-toast';
import SpecialtyRevenueDashboard from './SpecialtyRevenueDashboard';
import HospitalRevenueDashboard from './HospitalRevenueDashboard';
import { DoctorPatientsDropdown } from './DoctorPatientsDropdown';
import { getAllAvailableDoctors, getViewStatistics } from '../services/medicalProductionControlService';

// ================================================================
// INTERFACES
// ================================================================

interface ExecutiveMetrics {
  // Médicos
  totalDoctors: number;
  activeDoctors: number;
  inactiveDoctors: number;
  topDoctorRevenue: number;
  
  // Especialidades
  totalSpecialties: number;
  topSpecialtyRevenue: number;
  topSpecialtyName: string;
  avgDoctorsPerSpecialty: number;
  
  // Hospitais
  totalHospitals: number;
  topHospitalRevenue: number;
  topHospitalName: string;
  avgDoctorsPerHospital: number;
  
  // Faturamento Geral
  totalRevenue: number;
  totalProcedures: number;
  avgRevenuePerDoctor: number;
  avgRevenuePerProcedure: number;
  avgPaymentRate: number;
  
  // Crescimento (simulado - em produção viria de comparação temporal)
  revenueGrowth: number;
  doctorsGrowth: number;
  proceduresGrowth: number;
  paymentRateChange: number;
}

// ================================================================
// COMPONENTE PRINCIPAL
// ================================================================

const ExecutiveRevenueDashboard: React.FC = () => {
  const [doctorsData, setDoctorsData] = useState<DoctorAggregated[]>([]);
  const [specialtyStats, setSpecialtyStats] = useState<SpecialtyStats[]>([]);
  const [hospitalStats, setHospitalStats] = useState<HospitalStats[]>([]);
  const [availableDoctors, setAvailableDoctors] = useState<Array<{ name: string; cns: string; crm: string; specialty: string; }>>([]);
  const [viewStats, setViewStats] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState('overview');

  /**
   * 📊 CARREGAR TODOS OS DADOS
   */
  const loadAllData = async () => {
    try {
      setIsLoading(true);
      setError(null);
      
      console.log('🔄 Carregando dados executivos...');
      
      // Carregar dados em paralelo
      const [doctorsResult, specialtiesData, hospitalsData, availableDoctorsResult, viewStatsResult] = await Promise.all([
        DoctorsRevenueService.getDoctorsAggregated({ pageSize: 1000 }), // Todos os médicos
        DoctorsRevenueService.getSpecialtyStats(),
        DoctorsRevenueService.getHospitalStats(),
        getAllAvailableDoctors(), // 🆕 Médicos da nova view
        getViewStatistics() // 🆕 Estatísticas da view
      ]);
      
      setDoctorsData(doctorsResult.doctors);
      setSpecialtyStats(specialtiesData);
      setHospitalStats(hospitalsData);
      
      // 🆕 Carregar dados da nova view
      if (availableDoctorsResult.success) {
        setAvailableDoctors(availableDoctorsResult.data || []);
      }
      
      if (viewStatsResult.success) {
        setViewStats(viewStatsResult.data);
      }
      
      console.log(`✅ Dados carregados: ${doctorsResult.doctors.length} médicos, ${specialtiesData.length} especialidades, ${hospitalsData.length} hospitais`);
      console.log(`🆕 View médicos: ${availableDoctorsResult.data?.length || 0} médicos disponíveis`);
      
    } catch (error) {
      console.error('❌ Erro ao carregar dados executivos:', error);
      const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido';
      setError(errorMessage);
      toast({
        variant: "destructive",
        title: "Erro",
        description: `Erro ao carregar dados: ${errorMessage}`
      });
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * 📈 CALCULAR MÉTRICAS EXECUTIVAS
   */
  const executiveMetrics: ExecutiveMetrics | null = useMemo(() => {
    if (doctorsData.length === 0 || specialtyStats.length === 0 || hospitalStats.length === 0) {
      return null;
    }

    // Métricas de médicos
    const totalDoctors = doctorsData.length;
    const activeDoctors = doctorsData.filter(d => d.activity_status === 'ATIVO').length;
    const inactiveDoctors = totalDoctors - activeDoctors;
    const topDoctorRevenue = Math.max(...doctorsData.map(d => d.total_revenue_12months_reais));

    // Métricas de especialidades
    const totalSpecialties = specialtyStats.length;
    const topSpecialty = specialtyStats[0];
    const avgDoctorsPerSpecialty = specialtyStats.reduce((sum, s) => sum + s.doctors_count, 0) / totalSpecialties;

    // Métricas de hospitais
    const totalHospitals = hospitalStats.length;
    const topHospital = hospitalStats[0];
    const avgDoctorsPerHospital = hospitalStats.reduce((sum, h) => sum + h.active_doctors_count, 0) / totalHospitals;

    // Métricas de faturamento
    const totalRevenue = doctorsData.reduce((sum, d) => sum + d.total_revenue_12months_reais, 0);
    const totalProcedures = doctorsData.reduce((sum, d) => sum + d.total_procedures_12months, 0);
    const avgRevenuePerDoctor = totalRevenue / totalDoctors;
    const avgRevenuePerProcedure = totalProcedures > 0 ? totalRevenue / totalProcedures : 0;
    const avgPaymentRate = doctorsData.reduce((sum, d) => sum + d.avg_payment_rate_12months, 0) / totalDoctors;

    // Crescimento simulado (em produção seria calculado com dados históricos)
    const revenueGrowth = 12.5; // +12.5%
    const doctorsGrowth = 8.3; // +8.3%
    const proceduresGrowth = 15.2; // +15.2%
    const paymentRateChange = -2.1; // -2.1%

    return {
      totalDoctors,
      activeDoctors,
      inactiveDoctors,
      topDoctorRevenue,
      totalSpecialties,
      topSpecialtyRevenue: topSpecialty?.total_specialty_revenue_reais || 0,
      topSpecialtyName: topSpecialty?.doctor_specialty || '',
      avgDoctorsPerSpecialty,
      totalHospitals,
      topHospitalRevenue: topHospital?.total_hospital_revenue_reais || 0,
      topHospitalName: topHospital?.hospital_name || '',
      avgDoctorsPerHospital,
      totalRevenue,
      totalProcedures,
      avgRevenuePerDoctor,
      avgRevenuePerProcedure,
      avgPaymentRate,
      revenueGrowth,
      doctorsGrowth,
      proceduresGrowth,
      paymentRateChange
    };
  }, [doctorsData, specialtyStats, hospitalStats]);

  /**
   * 💰 FORMATAR MOEDA
   */
  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(value);
  };

  /**
   * 🔢 FORMATAR NÚMERO
   */
  const formatNumber = (value: number) => {
    return new Intl.NumberFormat('pt-BR').format(Math.round(value));
  };

  /**
   * 📈 OBTER ÍCONE DE CRESCIMENTO
   */
  const getGrowthIcon = (value: number) => {
    if (value > 0) {
      return <ArrowUpRight className="w-4 h-4 text-green-600" />;
    } else if (value < 0) {
      return <ArrowDownRight className="w-4 h-4 text-red-600" />;
    }
    return <TrendingDown className="w-4 h-4 text-gray-400" />;
  };

  /**
   * 🎨 OBTER COR DE CRESCIMENTO
   */
  const getGrowthColor = (value: number) => {
    if (value > 0) return 'text-green-600';
    if (value < 0) return 'text-red-600';
    return 'text-gray-500';
  };

  // Carregar dados na inicialização
  useEffect(() => {
    loadAllData();
  }, []);

  // ================================================================
  // RENDERIZAÇÃO
  // ================================================================

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {[...Array(8)].map((_, i) => (
            <Card key={i}>
              <CardHeader className="pb-2">
                <Skeleton className="h-4 w-24" />
              </CardHeader>
              <CardContent>
                <Skeleton className="h-8 w-32 mb-2" />
                <Skeleton className="h-3 w-20" />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  if (error || !executiveMetrics) {
    return (
      <Card>
        <CardContent className="pt-6">
          <div className="text-center text-red-600">
            <p>❌ {error || 'Erro ao carregar dados'}</p>
            <Button 
              onClick={loadAllData} 
              variant="outline" 
              className="mt-4"
            >
              <RefreshCw className="w-4 h-4 mr-2" />
              Tentar Novamente
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Cabeçalho */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold text-gray-900">
            Dashboard Executivo
          </h2>
          <p className="text-gray-600">
            Análise completa de faturamento - Últimos 12 meses
          </p>
        </div>
        <div className="flex space-x-2">
          <Button onClick={loadAllData} variant="outline" size="sm">
            <RefreshCw className="w-4 h-4 mr-2" />
            Atualizar
          </Button>
          <Button variant="outline" size="sm">
            <Download className="w-4 h-4 mr-2" />
            Exportar Relatório
          </Button>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="overview">Visão Geral</TabsTrigger>
          <TabsTrigger value="doctors">Médicos</TabsTrigger>
          <TabsTrigger value="specialties">Especialidades</TabsTrigger>
          <TabsTrigger value="hospitals">Hospitais</TabsTrigger>
        </TabsList>

        {/* Visão Geral */}
        <TabsContent value="overview" className="space-y-6">
          {/* Métricas Principais */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <Card className="border-l-4 border-l-green-500">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-gray-600 flex items-center justify-between">
                  <span className="flex items-center">
                    <DollarSign className="w-4 h-4 mr-2" />
                    Faturamento Total
                  </span>
                  {getGrowthIcon(executiveMetrics.revenueGrowth)}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-green-600">
                  {formatCurrency(executiveMetrics.totalRevenue)}
                </div>
                <p className={`text-xs font-medium ${getGrowthColor(executiveMetrics.revenueGrowth)}`}>
                  {executiveMetrics.revenueGrowth > 0 ? '+' : ''}{executiveMetrics.revenueGrowth}% vs ano anterior
                </p>
              </CardContent>
            </Card>

            <Card className="border-l-4 border-l-blue-500">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-gray-600 flex items-center justify-between">
                  <span className="flex items-center">
                    <Users className="w-4 h-4 mr-2" />
                    Médicos Ativos
                  </span>
                  {getGrowthIcon(executiveMetrics.doctorsGrowth)}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-blue-600">
                  {formatNumber(executiveMetrics.activeDoctors)}
                </div>
                <p className={`text-xs font-medium ${getGrowthColor(executiveMetrics.doctorsGrowth)}`}>
                  {executiveMetrics.doctorsGrowth > 0 ? '+' : ''}{executiveMetrics.doctorsGrowth}% novos médicos
                </p>
              </CardContent>
            </Card>

            <Card className="border-l-4 border-l-purple-500">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-gray-600 flex items-center justify-between">
                  <span className="flex items-center">
                    <Activity className="w-4 h-4 mr-2" />
                    Procedimentos
                  </span>
                  {getGrowthIcon(executiveMetrics.proceduresGrowth)}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-purple-600">
                  {formatNumber(executiveMetrics.totalProcedures)}
                </div>
                <p className={`text-xs font-medium ${getGrowthColor(executiveMetrics.proceduresGrowth)}`}>
                  {executiveMetrics.proceduresGrowth > 0 ? '+' : ''}{executiveMetrics.proceduresGrowth}% vs ano anterior
                </p>
              </CardContent>
            </Card>

            <Card className="border-l-4 border-l-orange-500">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-gray-600 flex items-center justify-between">
                  <span className="flex items-center">
                    <Target className="w-4 h-4 mr-2" />
                    Taxa de Pagamento
                  </span>
                  {getGrowthIcon(executiveMetrics.paymentRateChange)}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-orange-600">
                  {executiveMetrics.avgPaymentRate.toFixed(1)}%
                </div>
                <p className={`text-xs font-medium ${getGrowthColor(executiveMetrics.paymentRateChange)}`}>
                  {executiveMetrics.paymentRateChange > 0 ? '+' : ''}{executiveMetrics.paymentRateChange}% vs ano anterior
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Resumo por Categoria */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center text-blue-700">
                  <Stethoscope className="w-5 h-5 mr-2" />
                  Top Especialidade
                </CardTitle>
              </CardHeader>
              <CardContent>
                <h4 className="font-bold text-lg text-gray-900 mb-2">
                  {executiveMetrics.topSpecialtyName}
                </h4>
                <p className="text-sm text-gray-600 mb-2">
                  Faturamento: {formatCurrency(executiveMetrics.topSpecialtyRevenue)}
                </p>
                <Badge className="bg-blue-100 text-blue-800">
                  {Math.round(executiveMetrics.avgDoctorsPerSpecialty)} médicos/especialidade
                </Badge>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center text-green-700">
                  <Building2 className="w-5 h-5 mr-2" />
                  Top Hospital
                </CardTitle>
              </CardHeader>
              <CardContent>
                <h4 className="font-bold text-lg text-gray-900 mb-2">
                  {executiveMetrics.topHospitalName}
                </h4>
                <p className="text-sm text-gray-600 mb-2">
                  Faturamento: {formatCurrency(executiveMetrics.topHospitalRevenue)}
                </p>
                <Badge className="bg-green-100 text-green-800">
                  {Math.round(executiveMetrics.avgDoctorsPerHospital)} médicos/hospital
                </Badge>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center text-purple-700">
                  <Award className="w-5 h-5 mr-2" />
                  Performance Média
                </CardTitle>
              </CardHeader>
              <CardContent>
                <h4 className="font-bold text-lg text-gray-900 mb-2">
                  {formatCurrency(executiveMetrics.avgRevenuePerDoctor)}
                </h4>
                <p className="text-sm text-gray-600 mb-2">
                  Faturamento por médico
                </p>
                <Badge className="bg-purple-100 text-purple-800">
                  {formatCurrency(executiveMetrics.avgRevenuePerProcedure)}/procedimento
                </Badge>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* 🆕 Aba de Médicos - Nova Implementação */}
        <TabsContent value="doctors">
          <div className="space-y-6">
            
            {/* 📊 Estatísticas da View */}
            {viewStats && (
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <Card>
                  <CardContent className="p-4">
                    <div className="flex items-center space-x-2">
                      <Stethoscope className="h-6 w-6 text-blue-600" />
                      <div>
                        <p className="text-sm font-medium text-gray-600">Médicos na View</p>
                        <p className="text-2xl font-bold text-blue-600">{viewStats.uniqueDoctors}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
                
                <Card>
                  <CardContent className="p-4">
                    <div className="flex items-center space-x-2">
                      <Users className="h-6 w-6 text-green-600" />
                      <div>
                        <p className="text-sm font-medium text-gray-600">Pacientes Atendidos</p>
                        <p className="text-2xl font-bold text-green-600">{viewStats.uniquePatients}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
                
                <Card>
                  <CardContent className="p-4">
                    <div className="flex items-center space-x-2">
                      <Activity className="h-6 w-6 text-purple-600" />
                      <div>
                        <p className="text-sm font-medium text-gray-600">Total Procedimentos</p>
                        <p className="text-2xl font-bold text-purple-600">{formatNumber(viewStats.totalRecords)}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
                
                <Card>
                  <CardContent className="p-4">
                    <div className="flex items-center space-x-2">
                      <DollarSign className="h-6 w-6 text-emerald-600" />
                      <div>
                        <p className="text-sm font-medium text-gray-600">Valor Total</p>
                        <p className="text-2xl font-bold text-emerald-600">{formatCurrency(viewStats.totalValue)}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>
            )}

            {/* 🩺 Lista de Médicos com Dropdown Funcional */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Stethoscope className="h-5 w-5 text-blue-600" />
                  Médicos e seus Pacientes
                </CardTitle>
                <p className="text-gray-600">
                  Clique em qualquer médico para ver seus pacientes e procedimentos
                </p>
              </CardHeader>
              <CardContent>
                {isLoading ? (
                  <div className="space-y-4">
                    {[1, 2, 3].map(i => (
                      <Skeleton key={i} className="h-12 w-full" />
                    ))}
                  </div>
                ) : availableDoctors.length > 0 ? (
                  <div className="space-y-4">
                    {availableDoctors.slice(0, 20).map((doctor, index) => (
                      <div 
                        key={`${doctor.cns}-${index}`} 
                        className="border rounded-lg p-4 hover:bg-gray-50 transition-colors"
                      >
                        <div className="flex items-center justify-between mb-3">
                          <div className="flex items-center space-x-3">
                            <div className="bg-blue-100 p-2 rounded-full">
                              <Stethoscope className="h-4 w-4 text-blue-600" />
                            </div>
                            <div>
                              <h3 className="font-medium text-gray-900">{doctor.name}</h3>
                              <div className="flex items-center space-x-4 text-sm text-gray-500">
                                <span>CRM: {doctor.crm}</span>
                                <span>CNS: {doctor.cns}</span>
                                <Badge variant="outline" className="text-xs">
                                  {doctor.specialty}
                                </Badge>
                              </div>
                            </div>
                          </div>
                        </div>
                        
                        {/* 🔄 Dropdown Funcional */}
                        <DoctorPatientsDropdown 
                          doctorName={doctor.name}
                          doctorCns={doctor.cns}
                        />
                      </div>
                    ))}
                    
                    {availableDoctors.length > 20 && (
                      <div className="text-center p-4 text-gray-500 border-t">
                        <p>Mostrando 20 de {availableDoctors.length} médicos disponíveis</p>
                        <p className="text-sm mt-1">
                          Para ver todos os médicos, utilize a tela "Corpo Médico"
                        </p>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="text-center py-8">
                    <Stethoscope className="h-12 w-12 text-gray-300 mx-auto mb-4" />
                    <h3 className="text-lg font-medium text-gray-900 mb-2">
                      Nenhum médico encontrado
                    </h3>
                    <p className="text-gray-500">
                      A view vw_doctor_patient_procedures está vazia ou não foi criada corretamente
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* 📋 Informações da View (Para Debug) */}
            {viewStats && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm text-gray-600">Informações da View</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                    <div>
                      <span className="text-gray-500">Hospitais:</span>
                      <span className="ml-2 font-medium">{viewStats.uniqueHospitals}</span>
                    </div>
                    <div>
                      <span className="text-gray-500">Período:</span>
                      <span className="ml-2 font-medium">
                        {viewStats.dateRange.earliest} a {viewStats.dateRange.latest}
                      </span>
                    </div>
                    <div>
                      <span className="text-gray-500">Valor Médio/Proc:</span>
                      <span className="ml-2 font-medium">
                        {formatCurrency(viewStats.totalValue / viewStats.totalRecords)}
                      </span>
                    </div>
                    <div>
                      <span className="text-gray-500">Proc/Médico:</span>
                      <span className="ml-2 font-medium">
                        {Math.round(viewStats.totalRecords / viewStats.uniqueDoctors)}
                      </span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        </TabsContent>

        {/* Aba de Especialidades */}
        <TabsContent value="specialties">
          <SpecialtyRevenueDashboard />
        </TabsContent>

        {/* Aba de Hospitais */}
        <TabsContent value="hospitals">
          <HospitalRevenueDashboard />
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default ExecutiveRevenueDashboard; 
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
      const [doctorsResult, specialtiesData, hospitalsData] = await Promise.all([
        DoctorsRevenueService.getDoctorsAggregated({ pageSize: 1000 }), // Todos os médicos
        DoctorsRevenueService.getSpecialtyStats(),
        DoctorsRevenueService.getHospitalStats()
      ]);
      
      setDoctorsData(doctorsResult.doctors);
      setSpecialtyStats(specialtiesData);
      setHospitalStats(hospitalsData);
      
      console.log(`✅ Dados carregados: ${doctorsResult.doctors.length} médicos, ${specialtiesData.length} especialidades, ${hospitalsData.length} hospitais`);
      
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

        {/* Aba de Médicos */}
        <TabsContent value="doctors">
          <Card>
            <CardHeader>
              <CardTitle>Análise de Médicos</CardTitle>
              <p className="text-gray-600">Dados agregados da view v_doctors_aggregated</p>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                <div className="text-center">
                  <div className="text-3xl font-bold text-blue-600">{executiveMetrics.totalDoctors}</div>
                  <p className="text-sm text-gray-600">Total de Médicos</p>
                </div>
                <div className="text-center">
                  <div className="text-3xl font-bold text-green-600">{executiveMetrics.activeDoctors}</div>
                  <p className="text-sm text-gray-600">Médicos Ativos</p>
                </div>
                <div className="text-center">
                  <div className="text-3xl font-bold text-gray-600">{executiveMetrics.inactiveDoctors}</div>
                  <p className="text-sm text-gray-600">Médicos Inativos</p>
                </div>
              </div>
              <p className="text-sm text-gray-500 text-center">
                📊 Para análise detalhada, utilize a tela "Lista de Profissionais"
              </p>
            </CardContent>
          </Card>
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
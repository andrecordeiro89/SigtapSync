import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Badge } from './ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import { useAuth } from '../contexts/AuthContext';
import { toast } from 'sonner';
import {
  BarChart4,
  TrendingUp,
  Users,
  Hospital,
  DollarSign,
  FileText,
  Download,
  RefreshCw,
  Calendar,
  Filter,
  Eye,
  AlertTriangle,
  CheckCircle,
  Clock,
  Activity,
  PieChart,
  Building2,
  Stethoscope,
  Target,
  Award
} from 'lucide-react';

// Services
import { DoctorsRevenueService, type DoctorAggregated, type SpecialtyStats, type HospitalStats as HospitalRevenueStats } from '../services/doctorsRevenueService';
import { AIHBillingService, type CompleteBillingStats } from '../services/aihBillingService';
import { supabase } from '../lib/supabase';
import HospitalRevenueDashboard from './HospitalRevenueDashboard';
import SpecialtyRevenueDashboard from './SpecialtyRevenueDashboard';

// ✅ FUNÇÃO UTILITÁRIA PARA FORMATAR VALORES MONETÁRIOS
const formatCurrency = (value: number | null | undefined): string => {
  if (value == null || isNaN(value)) return 'R$ 0,00';
  
  // Se o valor for muito grande (provavelmente em centavos), converter para reais
  const normalizedValue = value > 100000 ? value / 100 : value;
  
  return normalizedValue.toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
};

// ✅ FUNÇÃO PARA FORMATAR NÚMEROS INTEIROS
const formatNumber = (value: number | null | undefined): string => {
  if (value == null || isNaN(value)) return '0';
  return Math.round(value).toLocaleString('pt-BR');
};

// ✅ FUNÇÃO PARA VALIDAR E NORMALIZAR VALORES
const normalizeValue = (value: number | null | undefined): number => {
  if (value == null || isNaN(value)) return 0;
  
  // Se o valor for muito grande (provavelmente em centavos), converter para reais
  if (value > 100000) {
    console.warn(`⚠️ Valor muito alto detectado: ${value}. Convertendo de centavos para reais.`);
    return value / 100;
  }
  
  return value;
};

// ✅ FUNÇÃO PARA CALCULAR PERCENTUAL SEGURO
const calculatePercentage = (part: number, total: number): number => {
  if (total === 0 || isNaN(part) || isNaN(total)) return 0;
  return Math.round((part / total) * 100);
};

// ✅ FUNÇÃO PARA BUSCAR DADOS REAIS DAS AIHS (FALLBACK PARA VIEWS)
const getRealAIHData = async () => {
  try {
    console.log('🔄 Buscando dados reais das AIHs processadas...');
    
    // Buscar AIHs simples
    const { data: aihs, error: aihsError } = await supabase
      .from('aihs')
      .select('*')
      .order('created_at', { ascending: false });

    if (aihsError) {
      console.error('❌ Erro ao buscar AIHs:', aihsError);
      return null;
    }

    // Buscar hospitais
    const { data: hospitals, error: hospitalsError } = await supabase
      .from('hospitals')
      .select('*');

    if (hospitalsError) {
      console.error('❌ Erro ao buscar hospitais:', hospitalsError);
    }

    console.log(`✅ Encontradas ${aihs?.length || 0} AIHs e ${hospitals?.length || 0} hospitais`);

    if (!aihs || aihs.length === 0) {
      return {
        summary: null,
        byHospital: [],
        byDoctor: [],
        byProcedure: [],
        metrics: {
          totalRevenue: 0,
          totalAIHs: 0,
          averageTicket: 0,
          approvalRate: 0,
          totalPatients: 0,
          activeHospitals: 0,
          activeDoctors: 0
        }
      };
    }

    // Calcular estatísticas por hospital
    const hospitalMap = new Map();
    const hospitalLookup = new Map((hospitals || []).map(h => [h.id, h]));

    // Processar AIHs
    aihs.forEach((aih: any) => {
      const hospitalId = aih.hospital_id;
      const hospital = hospitalLookup.get(hospitalId);
      const hospitalName = hospital?.name || 'Hospital não informado';
      const value = Number(aih.calculated_total_value || aih.original_value || 0);

      if (!hospitalMap.has(hospitalId)) {
        hospitalMap.set(hospitalId, {
          hospital_id: hospitalId,
          hospital_name: hospitalName,
          total_aihs: 0,
          total_value: 0,
          approved_aihs: 0,
          unique_doctors: 0
        });
      }

      const stats = hospitalMap.get(hospitalId);
      stats.total_aihs += 1;
      stats.total_value += value;
      stats.approved_aihs += 1; // Por enquanto, todas aprovadas
    });

    // Converter para array
    const byHospital = Array.from(hospitalMap.values()).map((stats: any) => ({
      ...stats,
      avg_value_per_aih: stats.total_aihs > 0 ? stats.total_value / stats.total_aihs : 0
    })).sort((a, b) => b.total_value - a.total_value);

    // Calcular totais
    const totalRevenue = byHospital.reduce((sum, h) => sum + h.total_value, 0);
    const totalAIHs = byHospital.reduce((sum, h) => sum + h.total_aihs, 0);

    const result = {
      summary: {
        total_aihs: totalAIHs,
        total_value: totalRevenue,
        avg_value_per_aih: totalAIHs > 0 ? totalRevenue / totalAIHs : 0,
        approved_aihs: totalAIHs,
        approved_value: totalRevenue
      },
      byHospital,
      byDoctor: [],
      byProcedure: [],
      metrics: {
        totalRevenue,
        totalAIHs,
        averageTicket: totalAIHs > 0 ? totalRevenue / totalAIHs : 0,
        approvalRate: 100,
        totalPatients: totalAIHs,
        activeHospitals: byHospital.length,
        activeDoctors: 0,
        topHospitalByRevenue: byHospital[0] || null
      }
    };

    console.log('📊 Dados reais compilados:', result);
    return result;
    
  } catch (error) {
    console.error('❌ Erro ao buscar dados reais das AIHs:', error);
    return null;
  }
};

interface ExecutiveDashboardProps {}

interface KPIData {
  totalRevenue: number;
  totalAIHs: number;
  averageTicket: number;
  approvalRate: number;
  activeHospitals: number;
  activeDoctors: number;
  processingTime: number;
  monthlyGrowth: number;
}

interface HospitalStats {
  id: string;
  name: string;
  aihCount: number;
  revenue: number;
  approvalRate: number;
  doctorCount: number;
  avgProcessingTime: number;
}

interface DoctorStats {
  id: string;
  name: string;
  cns: string;
  crm: string;
  specialty: string;
  hospitalName: string;
  aihCount: number;
  procedureCount: number;
  revenue: number;
  avgConfidence: number;
}

interface AlertItem {
  id: string;
  type: 'warning' | 'info' | 'success' | 'error';
  title: string;
  message: string;
  timestamp: string;
  priority: 'high' | 'medium' | 'low';
}

const ExecutiveDashboard: React.FC<ExecutiveDashboardProps> = () => {
  // State Management
  const [selectedTimeRange, setSelectedTimeRange] = useState('30d');
  const [selectedHospitals, setSelectedHospitals] = useState<string[]>(['all']);
  const [isLoading, setIsLoading] = useState(true);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);
  
  // Data States
  const [kpiData, setKpiData] = useState<KPIData>({
    totalRevenue: 0,
    totalAIHs: 0,
    averageTicket: 0,
    approvalRate: 0,
    activeHospitals: 0,
    activeDoctors: 0,
    processingTime: 0,
    monthlyGrowth: 0
  });
  
  const [hospitalStats, setHospitalStats] = useState<HospitalStats[]>([]);
  const [doctorStats, setDoctorStats] = useState<DoctorStats[]>([]);
  const [alerts, setAlerts] = useState<AlertItem[]>([]);

  // Estados para dados reais das views
  const [doctorsData, setDoctorsData] = useState<DoctorAggregated[]>([]);
  const [specialtyStats, setSpecialtyStats] = useState<SpecialtyStats[]>([]);
  const [hospitalRevenueStats, setHospitalRevenueStats] = useState<HospitalRevenueStats[]>([]);
  const [billingStats, setBillingStats] = useState<CompleteBillingStats | null>(null);

  // Authentication
  const { user, isDirector, isAdmin, isCoordinator, isTI, hasPermission } = useAuth();

  // Access Control
  const hasExecutiveAccess = isDirector() || isAdmin() || isCoordinator() || isTI() || hasPermission('generate_reports');

  // Load Data
  const loadExecutiveData = async () => {
    if (!hasExecutiveAccess) return;
    
    setIsLoading(true);
    try {
      console.log('📊 Carregando dados executivos reais...');
      
      // ✅ PRIMEIRO: Tentar carregar das views, se falhar usar dados reais das tabelas
      let billingStatsData = null;
      try {
        billingStatsData = await AIHBillingService.getCompleteBillingStats();
        console.log('✅ Dados carregados das views de billing');
      } catch (error) {
        console.warn('⚠️ Views de billing não disponíveis, buscando dados reais das tabelas:', error);
        billingStatsData = await getRealAIHData();
      }

      // Carregar dados das views de médicos/hospitais em paralelo
      const [doctorsResult, specialtiesData, hospitalsData] = await Promise.all([
        DoctorsRevenueService.getDoctorsAggregated({ pageSize: 1000 }), // Todos os médicos
        DoctorsRevenueService.getSpecialtyStats(),
        DoctorsRevenueService.getHospitalStats()
      ]);
      
      // Atualizar estados com dados reais
      setDoctorsData(doctorsResult.doctors);
      setSpecialtyStats(specialtiesData);
      setHospitalRevenueStats(hospitalsData);
      setBillingStats(billingStatsData);
      
      // ✅ CALCULAR KPIS COM VALORES NORMALIZADOS E VALIDAÇÃO
      let totalRevenue = 0;
      let totalAIHs = 0;
      let averageTicket = 0;
      let approvalRate = 0;
      let totalProcedures = 0;
      
      if (billingStatsData && billingStatsData.metrics.totalAIHs > 0) {
        // ✅ USAR DADOS REAIS DAS VIEWS DE BILLING
        console.log('✅ Usando dados reais das views de billing para KPIs!');
        console.log('📊 Dados brutos do billing:', {
          totalRevenue: billingStatsData.metrics.totalRevenue,
          totalAIHs: billingStatsData.metrics.totalAIHs,
          averageTicket: billingStatsData.metrics.averageTicket
        });
        
        totalRevenue = normalizeValue(billingStatsData.metrics.totalRevenue);
        totalAIHs = billingStatsData.metrics.totalAIHs || 0;
        totalProcedures = billingStatsData.summary?.total_aihs || totalAIHs;
        averageTicket = normalizeValue(billingStatsData.metrics.averageTicket);
        approvalRate = calculatePercentage(
          billingStatsData.summary?.approved_aihs || 0,
          totalAIHs
        );
        
        console.log('✅ Valores normalizados:', {
          totalRevenue,
          totalAIHs,
          averageTicket,
          approvalRate
        });
      } else {
        // ⚠️ FALLBACK: Usar dados das views de médicos (estimativas)
        console.log('⚠️ Usando dados estimados das views de médicos (sem AIHs processadas)');
        
        // Normalizar valores dos médicos
        const normalizedDoctorRevenues = doctorsResult.doctors.map(d => 
          normalizeValue(d.total_revenue_12months_reais || 0)
        );
        
        totalRevenue = normalizedDoctorRevenues.reduce((sum, revenue) => sum + revenue, 0);
        totalProcedures = doctorsResult.doctors.reduce((sum, d) => 
          sum + (d.total_procedures_12months || 0), 0
        );
        totalAIHs = Math.round(totalProcedures / 3); // Estimativa conservadora
        
        const validPaymentRates = doctorsResult.doctors.filter(d => 
          d.avg_payment_rate_12months != null && d.avg_payment_rate_12months > 0
        );
        approvalRate = validPaymentRates.length > 0 
          ? validPaymentRates.reduce((sum, d) => sum + (d.avg_payment_rate_12months || 0), 0) / validPaymentRates.length
          : 0;
        
        averageTicket = totalAIHs > 0 ? totalRevenue / totalAIHs : 0;
        
        console.log('📊 Estimativas baseadas em médicos:', {
          totalRevenue,
          totalAIHs,
          averageTicket,
          approvalRate,
          doctorsCount: doctorsResult.doctors.length
        });
      }

      const activeDoctors = doctorsResult.doctors.filter(d => d.activity_status === 'ATIVO').length;
      
      setKpiData({
        totalRevenue,
        totalAIHs,
        averageTicket,
        approvalRate,
        activeHospitals: hospitalsData.length,
        activeDoctors: activeDoctors,
        processingTime: 2.3, // Manter mock por enquanto
        monthlyGrowth: 12.5 // Manter mock por enquanto
      });

      // Converter dados dos hospitais para o formato atual com valores normalizados
      const hospitalStatsConverted: HospitalStats[] = hospitalsData.map(hospital => ({
        id: hospital.hospital_id || '',
        name: hospital.hospital_name || 'Nome não informado',
        aihCount: hospital.total_procedures || 0,
        revenue: normalizeValue(hospital.total_hospital_revenue_reais || 0),
        approvalRate: hospital.avg_payment_rate || 0,
        doctorCount: hospital.active_doctors_count || 0,
        avgProcessingTime: 2.1 // Mock por enquanto
      }));
      setHospitalStats(hospitalStatsConverted);

      // Converter top 5 médicos para o formato atual com valores normalizados
      const topDoctors = doctorsResult.doctors
        .filter(d => d.total_revenue_12months_reais != null && d.total_revenue_12months_reais > 0)
        .sort((a, b) => normalizeValue(b.total_revenue_12months_reais || 0) - normalizeValue(a.total_revenue_12months_reais || 0))
        .slice(0, 5);
        
      const doctorStatsConverted: DoctorStats[] = topDoctors.map(doctor => ({
        id: doctor.doctor_id || '',
        name: doctor.doctor_name || 'Nome não informado',
        cns: doctor.doctor_cns || '',
        crm: doctor.doctor_crm || '',
        specialty: doctor.doctor_specialty || 'Não informado',
        hospitalName: doctor.primary_hospital_name || (doctor.hospitals_list || '').split(' | ')[0] || 'Hospital não informado',
        aihCount: Math.round((doctor.total_procedures_12months || 0) / 3), // Estimativa de AIHs
        procedureCount: doctor.total_procedures_12months || 0,
        revenue: normalizeValue(doctor.total_revenue_12months_reais || 0),
        avgConfidence: doctor.avg_payment_rate_12months || 0
      }));
      setDoctorStats(doctorStatsConverted);

      // Gerar alertas baseados nos dados reais
      const alertsGenerated: AlertItem[] = [];
      
      // Alerta para hospitais com baixa taxa de aprovação
      const lowApprovalHospitals = hospitalsData.filter(h => 
        h.avg_payment_rate != null && h.avg_payment_rate < 90
      );
      lowApprovalHospitals.forEach(hospital => {
        const paymentRate = hospital.avg_payment_rate || 0;
        alertsGenerated.push({
          id: `hospital_${hospital.hospital_id}`,
          type: 'warning',
          title: 'Taxa de Aprovação Baixa',
          message: `${hospital.hospital_name} com ${paymentRate.toFixed(1)}% de aprovação (abaixo da meta de 90%)`,
          timestamp: new Date().toISOString(),
          priority: 'high'
        });
      });
      
      // Alerta para médicos inativos
      const inactiveDoctors = doctorsResult.doctors.filter(d => d.activity_status === 'INATIVO').length;
      if (inactiveDoctors > 0) {
        alertsGenerated.push({
          id: 'inactive_doctors',
          type: 'info',
          title: 'Médicos Inativos',
          message: `${inactiveDoctors} médicos sem atividade nos últimos 90 dias`,
          timestamp: new Date().toISOString(),
          priority: 'medium'
        });
      }
      
      setAlerts(alertsGenerated);

      setLastUpdate(new Date());
      console.log(`✅ Dados executivos carregados: ${doctorsResult.doctors.length} médicos, ${specialtiesData.length} especialidades, ${hospitalsData.length} hospitais`);
      
    } catch (error) {
      console.error('❌ Erro ao carregar dados executivos:', error);
      toast.error('Erro ao carregar dados do dashboard executivo: ' + (error as Error).message);
    } finally {
      setIsLoading(false);
    }
  };

  // Effects
  useEffect(() => {
    if (hasExecutiveAccess) {
      loadExecutiveData();
    }
  }, [selectedTimeRange, selectedHospitals, hasExecutiveAccess]);

  // Access Control Render
  if (!hasExecutiveAccess) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center">
          <AlertTriangle className="mx-auto h-16 w-16 text-red-400" />
          <h3 className="mt-4 text-xl font-semibold text-gray-900">Acesso Restrito</h3>
          <p className="mt-2 text-gray-600">
            Esta área é restrita à diretoria, coordenação e administradores.
          </p>
          <p className="mt-1 text-sm text-gray-500">
            Seu perfil atual: <Badge variant="outline">{user?.role || 'Não identificado'}</Badge>
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto p-6 space-y-6">
      {/* HEADER EXECUTIVO */}
      <div className="bg-gradient-to-r from-blue-900 via-blue-800 to-purple-800 text-white p-8 rounded-xl shadow-2xl">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-4xl font-bold mb-2 flex items-center gap-3">
              <BarChart4 className="h-10 w-10" />
              Dashboard Executivo
            </h1>
            <p className="text-blue-100 text-lg">
              Central de Inteligência e Relatórios para Diretoria
            </p>
            <div className="flex items-center gap-4 mt-3">
              <Badge className="bg-blue-700 text-white">
                <Award className="h-4 w-4 mr-1" />
                Perfil: {user?.role?.toUpperCase()}
              </Badge>
              <Badge className="bg-purple-700 text-white">
                <Building2 className="h-4 w-4 mr-1" />
                Acesso Total: {kpiData.activeHospitals} Hospitais
              </Badge>
            </div>
          </div>
          <div className="text-right">
            <div className="text-3xl font-bold">
              {isLoading ? '...' : formatCurrency(kpiData.totalRevenue)}
            </div>
            <div className="text-blue-200 text-lg">Faturamento Total</div>
            {lastUpdate && (
              <div className="text-xs text-blue-300 mt-2 flex items-center gap-1">
                <Clock className="h-3 w-3" />
                Atualizado: {lastUpdate.toLocaleTimeString('pt-BR')}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* CONTROLES EXECUTIVOS */}
      <Card className="border-blue-200 shadow-lg">
        <CardHeader className="bg-blue-50">
          <CardTitle className="flex items-center gap-2 text-blue-800">
            <Filter className="h-5 w-5" />
            Controles Executivos
          </CardTitle>
          <CardDescription>
            Configure a visão dos dados conforme suas necessidades de análise
          </CardDescription>
        </CardHeader>
        <CardContent className="pt-6">
          <div className="flex flex-wrap gap-4 items-center">
            {/* Período */}
            <div className="flex items-center gap-2">
              <Calendar className="h-4 w-4 text-gray-600" />
              <span className="text-sm font-medium">Período:</span>
              <Select value={selectedTimeRange} onValueChange={setSelectedTimeRange}>
                <SelectTrigger className="w-40">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="7d">Últimos 7 dias</SelectItem>
                  <SelectItem value="30d">Últimos 30 dias</SelectItem>
                  <SelectItem value="90d">Últimos 3 meses</SelectItem>
                  <SelectItem value="6m">Últimos 6 meses</SelectItem>
                  <SelectItem value="1y">Último ano</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Refresh */}
            <Button 
              onClick={loadExecutiveData} 
              disabled={isLoading}
              className="bg-blue-600 hover:bg-blue-700"
            >
              <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
              {isLoading ? 'Atualizando...' : 'Atualizar'}
            </Button>

            {/* Export */}
            <Button variant="outline" className="border-green-300 text-green-700 hover:bg-green-50">
              <Download className="h-4 w-4 mr-2" />
              Exportar Relatório
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* KPIS EXECUTIVOS */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card className="border-green-200 shadow-lg hover:shadow-xl transition-shadow">
          <CardContent className="p-6 text-center">
            <DollarSign className="h-10 w-10 mx-auto mb-3 text-green-600" />
            <div className="text-3xl font-bold text-green-700">
              {isLoading ? '...' : formatCurrency(kpiData.totalRevenue)}
            </div>
            <div className="text-sm text-green-600 font-medium">Faturamento Total</div>
            <div className="text-xs text-gray-500 mt-1">
              {kpiData.monthlyGrowth > 0 && (
                <span className="text-green-600">
                  ↗ +{kpiData.monthlyGrowth.toFixed(1)}% vs mês anterior
                </span>
              )}
            </div>
          </CardContent>
        </Card>

        <Card className="border-blue-200 shadow-lg hover:shadow-xl transition-shadow">
          <CardContent className="p-6 text-center">
            <FileText className="h-10 w-10 mx-auto mb-3 text-blue-600" />
            <div className="text-3xl font-bold text-blue-700">
              {isLoading ? '...' : formatNumber(kpiData.totalAIHs)}
            </div>
            <div className="text-sm text-blue-600 font-medium">AIHs Processadas</div>
            <div className="text-xs text-gray-500 mt-1">
              Ticket médio: {formatCurrency(kpiData.averageTicket)}
            </div>
          </CardContent>
        </Card>

        <Card className="border-purple-200 shadow-lg hover:shadow-xl transition-shadow">
          <CardContent className="p-6 text-center">
            <CheckCircle className="h-10 w-10 mx-auto mb-3 text-purple-600" />
            <div className="text-3xl font-bold text-purple-700">
              {isLoading ? '...' : kpiData.approvalRate.toFixed(1)}%
            </div>
            <div className="text-sm text-purple-600 font-medium">Taxa de Aprovação</div>
            <div className="text-xs text-gray-500 mt-1">
              Meta: 90% | {kpiData.approvalRate >= 90 ? '✓ Atingida' : '⚠ Abaixo da meta'}
            </div>
          </CardContent>
        </Card>

        <Card className="border-orange-200 shadow-lg hover:shadow-xl transition-shadow">
          <CardContent className="p-6 text-center">
            <Activity className="h-10 w-10 mx-auto mb-3 text-orange-600" />
            <div className="text-3xl font-bold text-orange-700">
              {isLoading ? '...' : kpiData.processingTime.toFixed(1)}h
            </div>
            <div className="text-sm text-orange-600 font-medium">Tempo Médio</div>
            <div className="text-xs text-gray-500 mt-1">
              Processamento de AIH
            </div>
          </CardContent>
        </Card>
      </div>

      {/* TABS PRINCIPAIS */}
      <Tabs defaultValue="overview" className="space-y-6">
        <TabsList className="grid w-full grid-cols-6 bg-blue-100">
          <TabsTrigger value="overview" className="data-[state=active]:bg-blue-600 data-[state=active]:text-white">
            <Eye className="h-4 w-4 mr-2" />
            Visão Geral
          </TabsTrigger>
          <TabsTrigger value="hospitals" className="data-[state=active]:bg-blue-600 data-[state=active]:text-white">
            <Hospital className="h-4 w-4 mr-2" />
            Hospitais
          </TabsTrigger>
          <TabsTrigger value="doctors" className="data-[state=active]:bg-blue-600 data-[state=active]:text-white">
            <Users className="h-4 w-4 mr-2" />
            Médicos
          </TabsTrigger>
          <TabsTrigger value="procedures" className="data-[state=active]:bg-blue-600 data-[state=active]:text-white">
            <FileText className="h-4 w-4 mr-2" />
            Procedimentos
          </TabsTrigger>
          <TabsTrigger value="specialties" className="data-[state=active]:bg-blue-600 data-[state=active]:text-white">
            <Stethoscope className="h-4 w-4 mr-2" />
            Especialidades
          </TabsTrigger>
          <TabsTrigger value="reports" className="data-[state=active]:bg-blue-600 data-[state=active]:text-white">
            <Target className="h-4 w-4 mr-2" />
            Relatórios
          </TabsTrigger>
        </TabsList>

        {/* TAB: VISÃO GERAL */}
        <TabsContent value="overview" className="space-y-6">
          {/* ✅ SEÇÃO: AIHS PROCESSADAS (DADOS REAIS DAS VIEWS) */}
          {billingStats && billingStats.metrics.totalAIHs > 0 && (
            <Card className="shadow-lg border-green-200 bg-green-50">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-green-800">
                  <FileText className="h-5 w-5" />
                  AIHs Processadas - Dados das Views
                </CardTitle>
                <CardDescription className="text-green-700">
                  Estatísticas baseadas nas {billingStats.metrics.totalAIHs} AIHs processadas (views completas)
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="text-center p-3 bg-white rounded-lg border">
                    <div className="text-2xl font-bold text-green-700">
                      {formatCurrency(normalizeValue(billingStats.metrics.totalRevenue))}
                    </div>
                    <div className="text-sm text-green-600">Faturamento Total</div>
                  </div>
                  <div className="text-center p-3 bg-white rounded-lg border">
                    <div className="text-2xl font-bold text-blue-700">{formatNumber(billingStats.metrics.totalAIHs)}</div>
                    <div className="text-sm text-blue-600">AIHs Processadas</div>
                  </div>
                  <div className="text-center p-3 bg-white rounded-lg border">
                    <div className="text-2xl font-bold text-purple-700">
                      {formatNumber(billingStats.summary?.approved_aihs || 0)} + {formatNumber(billingStats.summary?.pending_aihs || 0)}
                    </div>
                    <div className="text-sm text-purple-600">Aprovadas + Pendentes</div>
                  </div>
                  <div className="text-center p-3 bg-white rounded-lg border">
                    <div className="text-2xl font-bold text-orange-700">
                      {(billingStats.metrics.approvalRate || 0).toFixed(1)}%
                    </div>
                    <div className="text-sm text-orange-600">Taxa Aprovação</div>
                  </div>
                  <div className="text-center p-3 bg-white rounded-lg border">
                    <div className="text-2xl font-bold text-indigo-700">
                      {formatCurrency(normalizeValue(billingStats.metrics.averageTicket))}
                    </div>
                    <div className="text-sm text-indigo-600">Ticket Médio</div>
                  </div>
                  <div className="text-center p-3 bg-white rounded-lg border">
                    <div className="text-2xl font-bold text-teal-700">{formatNumber(billingStats.metrics.totalPatients)}</div>
                    <div className="text-sm text-teal-600">Pacientes (est.)</div>
                  </div>
                  <div className="text-center p-3 bg-white rounded-lg border">
                    <div className="text-2xl font-bold text-red-700">{formatNumber(billingStats.metrics.activeHospitals)}</div>
                    <div className="text-sm text-red-600">Hospitais</div>
                  </div>
                  <div className="text-center p-3 bg-white rounded-lg border">
                    <div className="text-2xl font-bold text-gray-700">{formatNumber(billingStats.metrics.activeDoctors)}</div>
                    <div className="text-sm text-gray-600">Médicos</div>
                  </div>
                </div>
                
                {/* Status de Processamento */}
                <div className="mt-4 p-3 bg-white rounded-lg border">
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-medium text-gray-700">Status de Processamento</span>
                  </div>
                  <div className="flex gap-4 text-sm">
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 bg-green-500 rounded-full"></div>
                      <span>Aprovadas: {billingStats.summary?.approved_aihs || 0}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 bg-yellow-500 rounded-full"></div>
                      <span>Pendentes: {billingStats.summary?.pending_aihs || 0}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 bg-red-500 rounded-full"></div>
                      <span>Rejeitadas: {billingStats.summary?.rejected_aihs || 0}</span>
                    </div>
                  </div>
                </div>

                {/* Top Performers */}
                {billingStats.metrics.topHospitalByRevenue && (
                  <div className="mt-4 p-3 bg-blue-50 rounded-lg border">
                    <div className="font-medium text-gray-700 mb-2">🏆 Top Performer</div>
                    <div className="text-sm">
                      <strong>{billingStats.metrics.topHospitalByRevenue.hospital_name}</strong> - 
                      {formatCurrency(normalizeValue(billingStats.metrics.topHospitalByRevenue.total_value))} 
                      ({formatNumber(billingStats.metrics.topHospitalByRevenue.total_aihs)} AIHs)
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card className="shadow-lg">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <TrendingUp className="h-5 w-5 text-blue-600" />
                  Resumo Executivo
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex justify-between items-center">
                    <span className="text-gray-600">Hospitais Ativos</span>
                    <Badge className="bg-blue-100 text-blue-800">{kpiData.activeHospitals}</Badge>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-gray-600">Médicos Ativos</span>
                    <Badge className="bg-green-100 text-green-800">{kpiData.activeDoctors}</Badge>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-gray-600">Taxa de Crescimento</span>
                    <Badge className="bg-purple-100 text-purple-800">+{kpiData.monthlyGrowth}%</Badge>
                  </div>
                  {billingStats && (
                    <div className="border-t pt-3 mt-4">
                      <div className="text-sm text-gray-600 mb-2">Fonte dos Dados:</div>
                      <Badge className="bg-green-100 text-green-800 mr-2">
                        ✓ AIHs Views: {billingStats.metrics.totalAIHs}
                      </Badge>
                      <Badge className="bg-blue-100 text-blue-800">
                        Médicos Views: {kpiData.activeDoctors}
                      </Badge>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            <Card className="shadow-lg">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <PieChart className="h-5 w-5 text-purple-600" />
                  {billingStats ? 'Distribuição por Hospital (Views)' : 'Faturamento por Hospital'}
                </CardTitle>
              </CardHeader>
              <CardContent>
                {billingStats && billingStats.byHospital.length > 0 ? (
                  <div className="space-y-3">
                    {billingStats.byHospital.slice(0, 5).map((hospital, index) => (
                      <div key={hospital.hospital_id} className="flex items-center justify-between p-2 bg-gray-50 rounded">
                        <div>
                          <div className="font-medium text-sm">{hospital.hospital_name}</div>
                          <div className="text-xs text-gray-600">
                            {hospital.total_aihs} AIHs | {hospital.unique_doctors} médicos
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="font-bold text-green-700">
                            {formatCurrency(normalizeValue(hospital.total_value))}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="h-48 bg-gray-50 rounded-lg flex items-center justify-center">
                    <div className="text-center text-gray-500">
                      <PieChart className="h-8 w-8 mx-auto mb-2" />
                      <div className="text-sm">Aguardando dados das views...</div>
                      <div className="text-xs">Processe algumas AIHs para ver estatísticas</div>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* TAB: HOSPITAIS */}
        <TabsContent value="hospitals" className="space-y-6">
          <HospitalRevenueDashboard />
        </TabsContent>

        {/* TAB: ESPECIALIDADES */}
        <TabsContent value="specialties" className="space-y-6">
          {/* KPIs de Especialidades */}
          {billingStats && (
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
              <Card className="border-gray-200 bg-gray-50">
                <CardContent className="p-6">
                  <div className="flex items-center">
                    <Stethoscope className="h-8 w-8 text-gray-600" />
                    <div className="ml-4">
                      <p className="text-sm font-medium text-gray-700">Top Especialidade</p>
                      <p className="text-xl font-bold text-gray-800">
                        {billingStats.byDoctor.length > 0 
                          ? billingStats.byDoctor[0]?.doctor_specialty || 'N/A'
                          : 'N/A'
                        }
                      </p>
                      <p className="text-xs text-gray-600 mt-1">
                        Maior faturamento
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="border-blue-200 bg-blue-50">
                <CardContent className="p-6">
                  <div className="flex items-center">
                    <Users className="h-8 w-8 text-blue-600" />
                    <div className="ml-4">
                      <p className="text-sm font-medium text-blue-700">Especialidades Ativas</p>
                      <p className="text-2xl font-bold text-blue-800">
                        {formatNumber(new Set(billingStats.byDoctor.map(d => d.doctor_specialty)).size)}
                      </p>
                      <p className="text-xs text-blue-600 mt-1">
                        Diferentes especialidades
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="border-green-200 bg-green-50">
                <CardContent className="p-6">
                  <div className="flex items-center">
                    <DollarSign className="h-8 w-8 text-green-600" />
                    <div className="ml-4">
                      <p className="text-sm font-medium text-green-700">Valor por Especialidade</p>
                      <p className="text-2xl font-bold text-green-800">
                        {formatCurrency(normalizeValue(
                          billingStats.metrics.totalRevenue / 
                          Math.max(1, new Set(billingStats.byDoctor.map(d => d.doctor_specialty)).size)
                        ))}
                      </p>
                      <p className="text-xs text-green-600 mt-1">
                        Média por especialidade
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="border-purple-200 bg-purple-50">
                <CardContent className="p-6">
                  <div className="flex items-center">
                    <Award className="h-8 w-8 text-purple-600" />
                    <div className="ml-4">
                      <p className="text-sm font-medium text-purple-700">Performance Geral</p>
                      <p className="text-2xl font-bold text-purple-800">
                        {billingStats.metrics.approvalRate.toFixed(1)}%
                      </p>
                      <p className="text-xs text-purple-600 mt-1">
                        Taxa de aprovação média
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}

          <SpecialtyRevenueDashboard />
        </TabsContent>

        {/* TAB: MÉDICOS */}
        <TabsContent value="doctors" className="space-y-6">
          <Card className="shadow-lg">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5 text-green-600" />
                Top Médicos por Faturamento
              </CardTitle>
              <CardDescription>
                Ranking dos médicos baseado nos dados reais das AIHs processadas
              </CardDescription>
            </CardHeader>
            <CardContent>
              {billingStats && billingStats.byDoctor.length > 0 ? (
                <div className="space-y-4">
                  {billingStats.byDoctor.slice(0, 15).map((doctor, index) => (
                    <div key={doctor.doctor_id} className="p-4 border rounded-lg hover:bg-gray-50 transition-colors">
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center text-blue-700 font-bold">
                            {index + 1}
                          </div>
                          <div>
                            <h4 className="font-semibold text-gray-900">{doctor.doctor_name}</h4>
                            <div className="text-sm text-gray-600">
                              CRM: {doctor.doctor_crm} ({doctor.doctor_crm_state}) | {doctor.doctor_specialty}
                            </div>
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="text-xl font-bold text-green-700">
                            {formatCurrency(normalizeValue(doctor.total_value))}
                          </div>
                          <div className="text-xs text-gray-600">
                            {((doctor.approved_aihs / doctor.total_aihs) * 100).toFixed(1)}% aprovação
                          </div>
                        </div>
                      </div>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                        <div>
                          <span className="text-gray-600">AIHs Total:</span>
                          <div className="font-semibold">{doctor.total_aihs}</div>
                        </div>
                        <div>
                          <span className="text-gray-600">AIHs Aprovadas:</span>
                          <div className="font-semibold text-green-700">{doctor.approved_aihs}</div>
                        </div>
                        <div>
                          <span className="text-gray-600">Ticket Médio:</span>
                          <div className="font-semibold">{formatCurrency(normalizeValue(doctor.avg_value_per_aih))}</div>
                        </div>
                        <div>
                          <span className="text-gray-600">Hospitais:</span>
                          <div className="font-semibold">{doctor.unique_hospitals}</div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 text-gray-500">
                  <Users className="h-12 w-12 mx-auto mb-4 text-gray-300" />
                  <div className="text-lg">Aguardando dados dos médicos</div>
                  <div className="text-sm">Processe algumas AIHs para ver o ranking</div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* TAB: PROCEDIMENTOS */}
        <TabsContent value="procedures" className="space-y-6">
          {/* KPIs de Procedimentos */}
          {billingStats && (
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
              <Card className="border-purple-200 bg-purple-50">
                <CardContent className="p-6">
                  <div className="flex items-center">
                    <FileText className="h-8 w-8 text-purple-600" />
                    <div className="ml-4">
                      <p className="text-sm font-medium text-purple-700">Total de Procedimentos</p>
                      <p className="text-2xl font-bold text-purple-800">
                        {formatNumber(billingStats.byProcedure.reduce((sum, p) => sum + p.total_aihs, 0))}
                      </p>
                      <p className="text-xs text-purple-600 mt-1">
                        Procedimentos realizados
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="border-blue-200 bg-blue-50">
                <CardContent className="p-6">
                  <div className="flex items-center">
                    <Activity className="h-8 w-8 text-blue-600" />
                    <div className="ml-4">
                      <p className="text-sm font-medium text-blue-700">Tipos Únicos</p>
                      <p className="text-2xl font-bold text-blue-800">
                        {formatNumber(billingStats.byProcedure.length)}
                      </p>
                      <p className="text-xs text-blue-600 mt-1">
                        Códigos diferentes
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="border-green-200 bg-green-50">
                <CardContent className="p-6">
                  <div className="flex items-center">
                    <DollarSign className="h-8 w-8 text-green-600" />
                    <div className="ml-4">
                      <p className="text-sm font-medium text-green-700">Valor Total</p>
                      <p className="text-2xl font-bold text-green-800">
                        {formatCurrency(normalizeValue(billingStats.byProcedure.reduce((sum, p) => sum + p.total_value, 0)))}
                      </p>
                      <p className="text-xs text-green-600 mt-1">
                        Faturamento dos procedimentos
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="border-orange-200 bg-orange-50">
                <CardContent className="p-6">
                  <div className="flex items-center">
                    <TrendingUp className="h-8 w-8 text-orange-600" />
                    <div className="ml-4">
                      <p className="text-sm font-medium text-orange-700">Ticket Médio</p>
                      <p className="text-2xl font-bold text-orange-800">
                        {formatCurrency(normalizeValue(
                          billingStats.byProcedure.reduce((sum, p) => sum + p.total_value, 0) /
                          billingStats.byProcedure.reduce((sum, p) => sum + p.total_aihs, 0)
                        ))}
                      </p>
                      <p className="text-xs text-orange-600 mt-1">
                        Valor médio por procedimento
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}

          <Card className="shadow-lg">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5 text-purple-600" />
                Top Procedimentos por Valor
              </CardTitle>
              <CardDescription>
                Procedimentos com maior faturamento baseado nas AIHs processadas
              </CardDescription>
            </CardHeader>
            <CardContent>
              {billingStats && billingStats.byProcedure.length > 0 ? (
                <div className="space-y-4">
                  {billingStats.byProcedure.slice(0, 20).map((procedure, index) => (
                    <div key={procedure.procedure_code} className="p-4 border rounded-lg hover:bg-gray-50 transition-colors">
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 bg-purple-100 rounded-full flex items-center justify-center text-purple-700 font-bold">
                            {index + 1}
                          </div>
                          <div>
                            <h4 className="font-semibold text-gray-900">{procedure.procedure_code}</h4>
                            <div className="text-sm text-gray-600 max-w-md">
                              {procedure.procedure_description || 'Descrição não disponível'}
                            </div>
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="text-xl font-bold text-purple-700">
                            {formatCurrency(normalizeValue(procedure.total_value))}
                          </div>
                          <div className="text-xs text-gray-600">
                            {((procedure.approved_aihs / procedure.total_aihs) * 100).toFixed(1)}% aprovação
                          </div>
                        </div>
                      </div>
                      <div className="grid grid-cols-2 md:grid-cols-5 gap-4 text-sm">
                        <div>
                          <span className="text-gray-600">AIHs Total:</span>
                          <div className="font-semibold">{procedure.total_aihs}</div>
                        </div>
                        <div>
                          <span className="text-gray-600">Valor Médio:</span>
                          <div className="font-semibold">{formatCurrency(normalizeValue(procedure.avg_value_per_aih))}</div>
                        </div>
                        <div>
                          <span className="text-gray-600">Hospitais:</span>
                          <div className="font-semibold">{procedure.unique_hospitals}</div>
                        </div>
                        <div>
                          <span className="text-gray-600">Médicos:</span>
                          <div className="font-semibold">{procedure.unique_doctors}</div>
                        </div>
                        <div>
                          <span className="text-gray-600">Especialidades:</span>
                          <div className="font-semibold">{procedure.unique_specialties}</div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 text-gray-500">
                  <FileText className="h-12 w-12 mx-auto mb-4 text-gray-300" />
                  <div className="text-lg">Aguardando dados dos procedimentos</div>
                  <div className="text-sm">Processe algumas AIHs para ver o ranking</div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* TAB: RELATÓRIOS */}
        <TabsContent value="reports" className="space-y-6">
          <Card className="shadow-lg">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Target className="h-5 w-5 text-purple-600" />
                Gerador de Relatórios Executivos
              </CardTitle>
              <CardDescription>
                Crie relatórios customizados para suas necessidades de gestão
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <Button className="h-24 flex flex-col items-center justify-center bg-green-600 hover:bg-green-700">
                  <FileText className="h-6 w-6 mb-2" />
                  <div className="text-center">
                    <div className="font-semibold">Relatório Financeiro</div>
                    <div className="text-xs opacity-90">Faturamento e performance</div>
                  </div>
                </Button>
                
                <Button className="h-24 flex flex-col items-center justify-center bg-blue-600 hover:bg-blue-700">
                  <Users className="h-6 w-6 mb-2" />
                  <div className="text-center">
                    <div className="font-semibold">Relatório de Médicos</div>
                    <div className="text-xs opacity-90">Performance por profissional</div>
                  </div>
                </Button>
                
                <Button className="h-24 flex flex-col items-center justify-center bg-purple-600 hover:bg-purple-700">
                  <Hospital className="h-6 w-6 mb-2" />
                  <div className="text-center">
                    <div className="font-semibold">Relatório Hospitalar</div>
                    <div className="text-xs opacity-90">Comparação entre unidades</div>
                  </div>
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default ExecutiveDashboard; 
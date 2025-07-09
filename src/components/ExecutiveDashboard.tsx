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

// Importar os novos dashboards baseados nas views reais
import SpecialtyRevenueDashboard from './SpecialtyRevenueDashboard';
import HospitalRevenueDashboard from './HospitalRevenueDashboard';
import { DoctorsRevenueService, type DoctorAggregated, type SpecialtyStats, type HospitalStats as HospitalRevenueStats } from '../services/doctorsRevenueService';
import { AIHBillingService, type CompleteBillingStats, type AIHBillingSummary, type AIHBillingByHospital, type AIHBillingByDoctor, type AIHBillingByProcedure, type AIHBillingByMonth } from '../services/aihBillingService';

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
      
      // Carregar dados reais em paralelo das views de faturamento + AIHs processadas
      const [doctorsResult, specialtiesData, hospitalsData, billingStatsData] = await Promise.all([
        DoctorsRevenueService.getDoctorsAggregated({ pageSize: 1000 }), // Todos os médicos
        DoctorsRevenueService.getSpecialtyStats(),
        DoctorsRevenueService.getHospitalStats(),
        AIHBillingService.getCompleteBillingStats() // ✅ NOVO: Dados reais das AIHs das views
      ]);
      
      // Atualizar estados com dados reais
      setDoctorsData(doctorsResult.doctors);
      setSpecialtyStats(specialtiesData);
      setHospitalRevenueStats(hospitalsData);
      setBillingStats(billingStatsData);
      
      // ✅ PRIORIZAR DADOS REAIS DAS AIHS PROCESSADAS (VIEWS)
      let totalRevenue = 0;
      let totalAIHs = 0;
      let averageTicket = 0;
      let approvalRate = 0;
      let totalProcedures = 0;
      
      if (billingStatsData && billingStatsData.metrics.totalAIHs > 0) {
        // ✅ USAR DADOS REAIS DAS VIEWS DE BILLING
        console.log('✅ Usando dados reais das views de billing para KPIs!');
        totalRevenue = billingStatsData.metrics.totalRevenue;
        totalAIHs = billingStatsData.metrics.totalAIHs;
        totalProcedures = billingStatsData.summary?.total_aihs || totalAIHs; // AIHs = procedimentos principais
        averageTicket = billingStatsData.metrics.averageTicket;
        approvalRate = billingStatsData.metrics.approvalRate;
      } else {
        // ⚠️ FALLBACK: Usar dados das views de médicos (estimativas)
        console.log('⚠️ Usando dados estimados das views de médicos (sem AIHs processadas)');
        totalRevenue = doctorsResult.doctors.reduce((sum, d) => 
          sum + (d.total_revenue_12months_reais || 0), 0
        );
        totalProcedures = doctorsResult.doctors.reduce((sum, d) => 
          sum + (d.total_procedures_12months || 0), 0
        );
        totalAIHs = Math.round(totalProcedures / 3); // Estimativa de AIHs baseada nos procedimentos
        
        const validPaymentRates = doctorsResult.doctors.filter(d => 
          d.avg_payment_rate_12months != null
        );
        approvalRate = validPaymentRates.length > 0 
          ? validPaymentRates.reduce((sum, d) => sum + d.avg_payment_rate_12months, 0) / validPaymentRates.length
          : 0;
        averageTicket = totalAIHs > 0 ? totalRevenue / totalAIHs : 0;
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

      // Converter dados dos hospitais para o formato atual
      const hospitalStatsConverted: HospitalStats[] = hospitalsData.map(hospital => ({
        id: hospital.hospital_id || '',
        name: hospital.hospital_name || 'Nome não informado',
        aihCount: hospital.total_procedures || 0,
        revenue: hospital.total_hospital_revenue_reais || 0,
        approvalRate: hospital.avg_payment_rate || 0,
        doctorCount: hospital.active_doctors_count || 0,
        avgProcessingTime: 2.1 // Mock por enquanto
      }));
      setHospitalStats(hospitalStatsConverted);

      // Converter top 5 médicos para o formato atual
      const topDoctors = doctorsResult.doctors
        .filter(d => d.total_revenue_12months_reais != null)
        .sort((a, b) => (b.total_revenue_12months_reais || 0) - (a.total_revenue_12months_reais || 0))
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
        revenue: doctor.total_revenue_12months_reais || 0,
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
              R$ {isLoading ? '...' : kpiData.totalRevenue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
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
              R$ {isLoading ? '...' : kpiData.totalRevenue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
            </div>
            <div className="text-sm text-green-600 font-medium">Faturamento Total</div>
            <div className="text-xs text-gray-500 mt-1">
              {kpiData.monthlyGrowth > 0 && (
                <span className="text-green-600">
                  ↗ +{kpiData.monthlyGrowth}% vs mês anterior
                </span>
              )}
            </div>
          </CardContent>
        </Card>

        <Card className="border-blue-200 shadow-lg hover:shadow-xl transition-shadow">
          <CardContent className="p-6 text-center">
            <FileText className="h-10 w-10 mx-auto mb-3 text-blue-600" />
            <div className="text-3xl font-bold text-blue-700">
              {isLoading ? '...' : kpiData.totalAIHs.toLocaleString('pt-BR')}
            </div>
            <div className="text-sm text-blue-600 font-medium">AIHs Processadas</div>
            <div className="text-xs text-gray-500 mt-1">
              Ticket médio: R$ {kpiData.averageTicket.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
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
                      R$ {billingStats.metrics.totalRevenue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                    </div>
                    <div className="text-sm text-green-600">Faturamento Total</div>
                  </div>
                  <div className="text-center p-3 bg-white rounded-lg border">
                    <div className="text-2xl font-bold text-blue-700">{billingStats.metrics.totalAIHs}</div>
                    <div className="text-sm text-blue-600">AIHs Processadas</div>
                  </div>
                  <div className="text-center p-3 bg-white rounded-lg border">
                    <div className="text-2xl font-bold text-purple-700">
                      {billingStats.summary?.approved_aihs || 0} + {billingStats.summary?.pending_aihs || 0}
                    </div>
                    <div className="text-sm text-purple-600">Aprovadas + Pendentes</div>
                  </div>
                  <div className="text-center p-3 bg-white rounded-lg border">
                    <div className="text-2xl font-bold text-orange-700">
                      {billingStats.metrics.approvalRate.toFixed(1)}%
                    </div>
                    <div className="text-sm text-orange-600">Taxa Aprovação</div>
                  </div>
                  <div className="text-center p-3 bg-white rounded-lg border">
                    <div className="text-2xl font-bold text-indigo-700">
                      R$ {billingStats.metrics.averageTicket.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                    </div>
                    <div className="text-sm text-indigo-600">Ticket Médio</div>
                  </div>
                  <div className="text-center p-3 bg-white rounded-lg border">
                    <div className="text-2xl font-bold text-teal-700">{billingStats.metrics.totalPatients}</div>
                    <div className="text-sm text-teal-600">Pacientes (est.)</div>
                  </div>
                  <div className="text-center p-3 bg-white rounded-lg border">
                    <div className="text-2xl font-bold text-red-700">{billingStats.metrics.activeHospitals}</div>
                    <div className="text-sm text-red-600">Hospitais</div>
                  </div>
                  <div className="text-center p-3 bg-white rounded-lg border">
                    <div className="text-2xl font-bold text-gray-700">{billingStats.metrics.activeDoctors}</div>
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
                      R$ {billingStats.metrics.topHospitalByRevenue.total_value.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} 
                      ({billingStats.metrics.topHospitalByRevenue.total_aihs} AIHs)
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
                            R$ {hospital.total_value.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                          </div>
                          <div className="text-xs text-gray-600">
                            {((hospital.approved_aihs / hospital.total_aihs) * 100).toFixed(1)}% aprovação
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
                            R$ {doctor.total_value.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
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
                          <div className="font-semibold">R$ {doctor.avg_value_per_aih.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</div>
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
                            R$ {procedure.total_value.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
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
                          <div className="font-semibold">R$ {procedure.avg_value_per_aih.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</div>
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
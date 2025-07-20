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
  AlertTriangle,
  CheckCircle,
  Clock,
  Activity,
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
import MedicalProductionDashboard from './MedicalProductionDashboard';

// ✅ FUNÇÃO OTIMIZADA PARA FORMATAR VALORES MONETÁRIOS
const formatCurrency = (value: number | null | undefined): string => {
  if (value == null || isNaN(value)) return 'R$ 0,00';
  
  // ⚠️ IMPORTANTE: Agora as views já retornam valores em reais
  // Não fazer mais conversão aqui!
  return value.toLocaleString('pt-BR', {
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

// ✅ FUNÇÃO PARA VALIDAR E TRATAR VALORES SEGUROS
const safeValue = (value: number | null | undefined): number => {
  if (value == null || isNaN(value)) return 0;
  
  // 🔧 DETECÇÃO INTELIGENTE: Se valor for suspeito de estar em centavos
  // Critério ajustado: valores > 10.000 (R$ 100,00) provavelmente estão em centavos
  // Pois procedimentos médicos raramente custam mais de R$ 100.000,00
  if (value > 10000) {
    console.warn(`⚠️ Valor suspeito detectado: ${value}. Está em centavos. Convertendo para reais...`);
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
  const [activeTab, setActiveTab] = useState('hospitals');
  
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
  
  // Estado para dados dos médicos da aba de Médicos
  const [medicalProductionStats, setMedicalProductionStats] = useState<{
    totalRevenue: number;
    totalDoctors: number;
    totalPatients: number;
    totalProcedures: number;
  } | null>(null);
  
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
  
  // Função para atualizar dados dos médicos da aba de Médicos
  const updateMedicalProductionStats = (stats: {
    totalRevenue: number;
    totalDoctors: number;
    totalPatients: number;
    totalProcedures: number;
  }) => {
    setMedicalProductionStats(stats);
    
    // Se estamos na aba de médicos, atualizar o KPI do cabeçalho
    if (activeTab === 'doctors') {
      setKpiData(prev => ({
        ...prev,
        totalRevenue: stats.totalRevenue,
        totalAIHs: stats.totalPatients, // Pacientes = AIHs na aba de médicos
        averageTicket: stats.totalPatients > 0 ? stats.totalRevenue / stats.totalPatients : 0,
        activeDoctors: stats.totalDoctors
      }));
      setLastUpdate(new Date());
    }
  };
  
  // Função para lidar com mudança de aba
  const handleTabChange = (tabValue: string) => {
    setActiveTab(tabValue);
    
    // Atualizar KPI baseado na aba ativa
    if (tabValue === 'doctors' && medicalProductionStats) {
      setKpiData(prev => ({
        ...prev,
        totalRevenue: medicalProductionStats.totalRevenue,
        totalAIHs: medicalProductionStats.totalPatients,
        averageTicket: medicalProductionStats.totalPatients > 0 ? medicalProductionStats.totalRevenue / medicalProductionStats.totalPatients : 0,
        activeDoctors: medicalProductionStats.totalDoctors
      }));
    } else {
      // Para outras abas, recarregar dados originais
      loadExecutiveData();
    }
  };
  


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
        
        totalRevenue = safeValue(billingStatsData.metrics.totalRevenue);
        totalAIHs = billingStatsData.metrics.totalAIHs || 0;
        totalProcedures = billingStatsData.summary?.total_aihs || totalAIHs;
        averageTicket = safeValue(billingStatsData.metrics.averageTicket);
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
          safeValue(d.total_revenue_12months_reais || 0)
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
        revenue: safeValue(hospital.total_hospital_revenue_reais || 0),
        approvalRate: hospital.avg_payment_rate || 0,
        doctorCount: hospital.active_doctors_count || 0,
        avgProcessingTime: 2.1 // Mock por enquanto
      }));
      setHospitalStats(hospitalStatsConverted);

      // Converter top 5 médicos para o formato atual com valores normalizados
      const topDoctors = doctorsResult.doctors
        .filter(d => d.total_revenue_12months_reais != null && d.total_revenue_12months_reais > 0)
        .sort((a, b) => safeValue(b.total_revenue_12months_reais || 0) - safeValue(a.total_revenue_12months_reais || 0))
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
        revenue: safeValue(doctor.total_revenue_12months_reais || 0),
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
      {/* CABEÇALHO */}
      <div className="bg-gradient-to-r from-blue-900 via-blue-800 to-purple-800 text-white p-6 rounded-xl shadow-lg">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold mb-2 flex items-center gap-3">
              <BarChart4 className="h-8 w-8" />
              Dashboard Executivo
            </h1>
            <p className="text-blue-100">
              Central de Inteligência e Relatórios para Diretoria
            </p>
            <div className="flex items-center gap-4 mt-3">
              <Badge className="bg-blue-700 text-white">
                <Award className="h-4 w-4 mr-1" />
                {user?.role?.toUpperCase()}
              </Badge>
            </div>
          </div>
          <div className="text-right">
            <div className="text-3xl font-bold">
              {isLoading ? '...' : formatCurrency(kpiData.totalRevenue)}
            </div>
            <div className="text-blue-200 text-lg">Faturamento Total</div>
            <div className="text-blue-300 text-sm mt-1">
              {isLoading ? '...' : formatNumber(kpiData.totalAIHs)} AIHs Processadas
            </div>
            {lastUpdate && (
              <div className="text-xs text-blue-300 mt-2 flex items-center justify-end gap-1">
                <Clock className="h-3 w-3" />
                Atualizado: {lastUpdate.toLocaleTimeString('pt-BR')}
              </div>
            )}
          </div>
        </div>
      </div>





      <Tabs value={activeTab} onValueChange={handleTabChange} className="space-y-6">
        <TabsList className="grid w-full grid-cols-5 bg-blue-100">
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
          <MedicalProductionDashboard onStatsUpdate={updateMedicalProductionStats} />
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
                            {formatCurrency(safeValue(procedure.total_aihs * procedure.avg_value_per_aih))}
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
                          <span className="text-gray-600">Valor do Procedimento:</span>
                          <div className="font-semibold">{formatCurrency(safeValue(procedure.avg_value_per_aih))}</div>
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
import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Badge } from './ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from './ui/dialog';
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
  Award,
  ChevronLeft,
  ChevronRight,
  Filter,
  Search
} from 'lucide-react';

// Services
import { DoctorsRevenueService, type DoctorAggregated, type SpecialtyStats, type HospitalStats as HospitalRevenueStats } from '../services/doctorsRevenueService';
import { AIHBillingService, type CompleteBillingStats } from '../services/aihBillingService';
import { supabase } from '../lib/supabase';
import { DateRange } from '../types';
import HospitalRevenueDashboard from './HospitalRevenueDashboard';
import SpecialtyRevenueDashboard from './SpecialtyRevenueDashboard';
import MedicalProductionDashboard from './MedicalProductionDashboard';
import MedicalStaffDashboard from './MedicalStaffDashboard';
import ReportGenerator from './ReportGenerator';
import ExecutiveDateFilters from './ExecutiveDateFilters';

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
const getRealAIHData = async (dateRange?: DateRange) => {
  try {
    console.log('🔄 Buscando dados reais das AIHs processadas...');
    
    let query = supabase
      .from('aihs')
      .select('*')
      .order('created_at', { ascending: false });
    
    // Aplicar filtros de data se fornecidos
    if (dateRange) {
      const startDateISO = dateRange.startDate.toISOString();
      const endDateISO = dateRange.endDate.toISOString();
      
      console.log('📅 Aplicando filtros de data na consulta fallback:', {
        inicio: startDateISO,
        fim: endDateISO
      });
      
      query = query
        .gte('admission_date', startDateISO)
        .lte('admission_date', endDateISO);
    }
    
    const { data: aihs, error: aihsError } = await query;

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
  const [selectedTimeRange, setSelectedTimeRange] = useState('7d');
  const [selectedDateRange, setSelectedDateRange] = useState<DateRange>(() => {
    const now = new Date();
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    return { startDate: sevenDaysAgo, endDate: now };
  });
  const [selectedHospitals, setSelectedHospitals] = useState<string[]>(['all']);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCareCharacter, setSelectedCareCharacter] = useState('all');
  const [isLoading, setIsLoading] = useState(true);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);
  const [activeTab, setActiveTab] = useState('doctors');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;
  const [showReportGenerator, setShowReportGenerator] = useState(false);
  
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

  // Paginação
  const procedures = billingStats?.byProcedure || [];
  const totalPages = Math.ceil(procedures.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const currentProcedures = procedures.slice(startIndex, endIndex);

  const goToPage = (page: number) => {
    setCurrentPage(Math.max(1, Math.min(page, totalPages)));
  };

  const PaginationControls = () => (
    <div className="flex items-center justify-between px-4 py-3 bg-gray-50 border-t border-gray-200">
      <div className="flex items-center text-sm text-gray-700">
        <span>
          Mostrando {startIndex + 1} a {Math.min(endIndex, procedures.length)} de {procedures.length} procedimentos
        </span>
      </div>
      <div className="flex items-center space-x-2">
        <Button
          variant="outline"
          size="sm"
          onClick={() => goToPage(currentPage - 1)}
          disabled={currentPage === 1}
          className="flex items-center"
        >
          <ChevronLeft className="h-4 w-4 mr-1" />
          Anterior
        </Button>
        
        <div className="flex items-center space-x-1">
          {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
            let pageNum;
            if (totalPages <= 5) {
              pageNum = i + 1;
            } else if (currentPage <= 3) {
              pageNum = i + 1;
            } else if (currentPage >= totalPages - 2) {
              pageNum = totalPages - 4 + i;
            } else {
              pageNum = currentPage - 2 + i;
            }
            
            return (
              <Button
                key={pageNum}
                variant={currentPage === pageNum ? "default" : "outline"}
                size="sm"
                onClick={() => goToPage(pageNum)}
                className="w-8 h-8 p-0"
              >
                {pageNum}
              </Button>
            );
          })}
        </div>
        
        <Button
          variant="outline"
          size="sm"
          onClick={() => goToPage(currentPage + 1)}
          disabled={currentPage === totalPages}
          className="flex items-center"
        >
          Próxima
          <ChevronRight className="h-4 w-4 ml-1" />
        </Button>
      </div>
    </div>
  );

  // Access Control
  const hasExecutiveAccess = isDirector() || isAdmin() || isCoordinator() || isTI() || hasPermission('generate_reports');
  
  // Função para atualizar dados dos médicos da aba de Médicos
  const updateMedicalProductionStats = useCallback((stats: {
    totalRevenue: number;
    totalDoctors: number;
    totalPatients: number;
    totalProcedures: number;
  }) => {
    setMedicalProductionStats(stats);
    
    // ✅ NÃO ATUALIZAR MAIS O CABEÇALHO COM DADOS DOS MÉDICOS
    // O cabeçalho agora usa APENAS dados diretos da tabela AIHs
    // Apenas atualizar o número de médicos ativos
    setKpiData(prev => ({
      ...prev,
      activeDoctors: stats.totalDoctors
    }));
    setLastUpdate(new Date());
  }, []);

  // Função para lidar com mudanças no filtro de data
  const handleDateRangeChange = useCallback((range: DateRange) => {
    console.log('📅 Alterando período de análise:', {
      inicio: range.startDate.toLocaleDateString('pt-BR'),
      fim: range.endDate.toLocaleDateString('pt-BR')
    });
    setSelectedDateRange(range);
    setIsLoading(true);
    // Carregar dados com o novo período
    if (hasExecutiveAccess) {
      loadExecutiveData(range);
    }
  }, [hasExecutiveAccess]);
  
    // Função para lidar com mudança de aba
  const handleTabChange = (tabValue: string) => {
    setActiveTab(tabValue);
    
    // ✅ CABEÇALHO SEMPRE MOSTRA DADOS DIRETOS DA TABELA AIHs
    // Não depende mais dos dados dos médicos ou da aba ativa
    // Valores fixos: 818 AIHs + soma calculated_total_value
  };
  


  // Load Data
  const loadExecutiveData = async (dateRange?: DateRange) => {
    if (!hasExecutiveAccess) return;
    
    setIsLoading(true);
    try {
      const currentDateRange = dateRange || selectedDateRange;
      console.log('📊 Carregando dados executivos reais...', {
        periodo: `${currentDateRange.startDate.toLocaleDateString('pt-BR')} - ${currentDateRange.endDate.toLocaleDateString('pt-BR')}`
      });
      
      // ✅ PRIMEIRO: Tentar carregar das views, se falhar usar dados reais das tabelas
      let billingStatsData = null;
      try {
        billingStatsData = await AIHBillingService.getCompleteBillingStats(currentDateRange);
        console.log('✅ Dados carregados das views de billing');
      } catch (error) {
        console.warn('⚠️ Views de billing não disponíveis, buscando dados reais das tabelas:', error);
        billingStatsData = await getRealAIHData(currentDateRange);
      }

      // Carregar dados das views de médicos/hospitais em paralelo
      const [doctorsResult, specialtiesData, hospitalsData] = await Promise.all([
        DoctorsRevenueService.getDoctorsAggregated({ pageSize: 1000 }), // Todos os médicos
        DoctorsRevenueService.getSpecialtyStats(),
        DoctorsRevenueService.getHospitalStats()
      ]);
      
      // Atualizar estados com dados reais
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
      
      // ✅ CARREGAR DADOS DIRETOS DA TABELA AIHS PARA O CABEÇALHO COM FILTROS DE DATA
      console.log('🔄 Carregando dados diretos da tabela aihs com filtros de período...');
      
      // Converter datas para formato ISO para o Supabase
      const startDateISO = currentDateRange.startDate.toISOString();
      const endDateISO = currentDateRange.endDate.toISOString();
      
      console.log('📅 Aplicando filtros de data:', {
        inicio: startDateISO,
        fim: endDateISO
      });
      
          // ✅ APLICAR FILTROS DE HOSPITAL SE SELECIONADOS
      let aihsDataQuery = supabase
        .from('aihs')
        .select('calculated_total_value, hospital_id')
        .not('calculated_total_value', 'is', null)
        .gte('admission_date', startDateISO)
        .lte('admission_date', endDateISO);
      
      let aihsCountQuery = supabase
        .from('aihs')
        .select('*', { count: 'exact', head: true })
        .gte('admission_date', startDateISO)
        .lte('admission_date', endDateISO);
      
      // Aplicar filtro de hospital se não for "all"
      if (selectedHospitals.length > 0 && !selectedHospitals.includes('all')) {
        console.log('🏥 Aplicando filtros de hospital aos KPIs:', selectedHospitals);
        aihsDataQuery = aihsDataQuery.in('hospital_id', selectedHospitals);
        aihsCountQuery = aihsCountQuery.in('hospital_id', selectedHospitals);
      }
      
      // Query otimizada: buscar dados + count em paralelo com filtros de data e hospital
      const [aihsDataResult, aihsCountResult] = await Promise.all([
        aihsDataQuery,
        aihsCountQuery
      ]);

      let aihsTotalRevenue = 0;
      let aihsCount = 0;

      if (aihsDataResult.error || aihsCountResult.error) {
        console.error('❌ Erro ao carregar dados da tabela aihs:', 
          aihsDataResult.error || aihsCountResult.error);
        // Fallback para dados de médicos em caso de erro
        const doctorsRevenue = doctorsResult.doctors.reduce((sum, doctor) => 
          sum + safeValue(doctor.total_revenue_12months_reais || 0), 0
        );
        const doctorsProcedures = doctorsResult.doctors.reduce((sum, doctor) => 
          sum + (doctor.total_procedures_12months || 0), 0
        );
        aihsTotalRevenue = doctorsRevenue;
        aihsCount = Math.round(doctorsProcedures / 3);
        
        console.log('⚠️ Usando fallback de médicos por erro na consulta AIHs');
      } else {
        // ✅ USAR DADOS DIRETOS DA TABELA AIHS
        aihsCount = aihsCountResult.count || 0;
        aihsTotalRevenue = aihsDataResult.data?.reduce((sum, aih) => {
          const value = aih.calculated_total_value || 0;
          return sum + safeValue(value);
        }, 0) || 0;
        
        console.log('✅ Dados diretos da tabela aihs carregados:', {
          totalAIHs: aihsCount,
          totalRevenue: formatCurrency(aihsTotalRevenue),
          aihsComValor: aihsDataResult.data?.length || 0
        });
      }

      // ✅ AGUARDAR UM MOMENTO PARA GARANTIR QUE OUTRAS OPERAÇÕES TERMINEM
      // E ENTÃO DEFINIR OS DADOS DO CABEÇALHO COM DADOS DA TABELA AIHS
      setTimeout(() => {
        const aihsAverageTicket = aihsCount > 0 ? aihsTotalRevenue / aihsCount : 0;
        
        setKpiData({
          totalRevenue: aihsTotalRevenue, // ✅ SOMA calculated_total_value DA TABELA AIHS
          totalAIHs: aihsCount,          // ✅ COUNT DE REGISTROS DA TABELA AIHS
          averageTicket: aihsAverageTicket, // ✅ CALCULADO COM DADOS DA TABELA AIHS
          approvalRate,
          activeHospitals: hospitalsData.length,
          activeDoctors: activeDoctors,
          processingTime: 2.3, // Manter mock por enquanto
          monthlyGrowth: 12.5 // Manter mock por enquanto
        });
        
        console.log('✅ CABEÇALHO ATUALIZADO COM DADOS DIRETOS DA TABELA AIHS (FINAL):', {
          totalRevenue: formatCurrency(aihsTotalRevenue),
          totalAIHs: aihsCount,
          averageTicket: formatCurrency(aihsAverageTicket)
        });
      }, 100); // 100ms de delay para garantir que outras operações terminem
      
      // ✅ TAMBÉM ATUALIZAR O ESTADO DOS DADOS DOS MÉDICOS PARA SINCRONIZAÇÃO
      setDoctorsData(doctorsResult.doctors);
      
      // ✅ INICIALIZAR STATS DOS MÉDICOS APENAS SE NÃO EXISTIR
      // Evita sobrescrever dados que vêm do MedicalProductionDashboard
      setMedicalProductionStats(prev => prev || {
        totalRevenue: 0,
        totalDoctors: activeDoctors,
        totalPatients: 0,
        totalProcedures: 0
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
      console.log('🎯 IMPORTANTE: Cabeçalho usa dados diretos da tabela aihs, não dos médicos!');
      
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
      loadExecutiveData(selectedDateRange);
    }
  }, [selectedTimeRange, selectedHospitals, selectedDateRange, hasExecutiveAccess]);

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
            {/* ✅ DADOS DIRETOS DA TABELA AIHS */}
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
        <TabsList className="grid w-full grid-cols-4 bg-blue-100">
          <TabsTrigger value="doctors" className="data-[state=active]:bg-blue-600 data-[state=active]:text-white">
            <Users className="h-4 w-4 mr-2" />
            Médicos
          </TabsTrigger>
          <TabsTrigger value="procedures" className="data-[state=active]:bg-blue-600 data-[state=active]:text-white">
            <FileText className="h-4 w-4 mr-2" />
            Procedimentos
          </TabsTrigger>
          <TabsTrigger value="medical-staff" className="data-[state=active]:bg-blue-600 data-[state=active]:text-white">
            <Users className="h-4 w-4 mr-2" />
            Corpo Médico
          </TabsTrigger>
          <TabsTrigger value="reports" className="data-[state=active]:bg-blue-600 data-[state=active]:text-white">
            <Target className="h-4 w-4 mr-2" />
            Relatórios
          </TabsTrigger>
        </TabsList>

        {/* 🔍 FILTROS EXECUTIVOS GLOBAIS - LOGO ABAIXO DAS ABAS */}
        <Card className="shadow-lg border-0 bg-gradient-to-br from-white to-blue-50/30">
          <CardHeader className="pb-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center shadow-lg">
                  <Filter className="h-5 w-5 text-white" />
                </div>
                <div>
                  <h3 className="text-xl font-bold text-gray-900">Filtros Executivos Globais</h3>
                  <p className="text-sm text-gray-600 mt-1">Configure filtros aplicados a todas as abas</p>
                </div>
              </div>
              <Badge variant="secondary" className="bg-blue-100 text-blue-800 px-3 py-2 font-medium">
                {medicalProductionStats ? `${medicalProductionStats.totalPatients} pacientes` : 'Carregando...'}
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* FILTROS DE PERÍODO */}
            <div className="pb-3 border-b border-gray-100">
              <label className="text-xs font-medium text-gray-600 uppercase tracking-wide mb-2 block">Período de Análise</label>
              <ExecutiveDateFilters
                onDateRangeChange={handleDateRangeChange}
                onRefresh={() => loadExecutiveData(selectedDateRange)}
                isLoading={isLoading}
                compact={true}
                title=""
                subtitle=""
              />
            </div>
            
            {/* FILTROS COMPACTOS EM LINHA */}
            <div className="grid grid-cols-1 lg:grid-cols-4 gap-3">
              {/* BUSCA RÁPIDA */}
              <div>
                <label className="text-xs font-medium text-gray-600 uppercase tracking-wide mb-1.5 block">Busca Rápida</label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <Input
                    placeholder="Nome, CNS, CRM..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10 h-9 border-gray-200 focus:border-blue-500 focus:ring-blue-500/20 text-sm"
                  />
                  {searchTerm && (
                    <button
                      onClick={() => setSearchTerm('')}
                      className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                      title="Limpar busca"
                    >
                      ✕
                    </button>
                  )}
                </div>
              </div>
              
              {/* FILTRO DE CARÁTER DE ATENDIMENTO (SUS: somente 1 e 2) */}
              <div>
                <label className="text-xs font-medium text-gray-600 uppercase tracking-wide mb-1.5 block">Caráter de Atendimento</label>
                <div className="flex items-center gap-2">
                  <select
                    value={selectedCareCharacter}
                    onChange={(e) => setSelectedCareCharacter(e.target.value)}
                    className="flex-1 px-3 py-2 border border-gray-200 rounded-lg bg-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors h-9"
                  >
                    <option value="all">Todos</option>
                    <option value="1">Eletivo</option>
                    <option value="2">Urgência/Emergência</option>
                  </select>
                  {selectedCareCharacter !== 'all' && (
                    <button
                      onClick={() => setSelectedCareCharacter('all')}
                      className="px-2 py-1 text-xs text-blue-600 hover:text-blue-800 hover:bg-blue-50 rounded transition-colors"
                      title="Limpar filtro de caráter de atendimento"
                    >
                      ✕
                    </button>
                  )}
                </div>
              </div>

              {/* HOSPITAIS DROPDOWN */}
              <div>
                <label className="text-xs font-medium text-gray-600 uppercase tracking-wide mb-1.5 block">Hospitais</label>
                <Select
                  value={selectedHospitals.includes('all') ? 'all' : selectedHospitals.join(',')}
                  onValueChange={(value) => {
                    if (value === 'all') {
                      setSelectedHospitals(['all']);
                      console.log('🏥 Filtro de hospital resetado para "Todos"');
                    } else {
                      const hospitalId = value;
                      if (selectedHospitals.includes('all')) {
                        setSelectedHospitals([hospitalId]);
                      } else {
                        const newSelection = selectedHospitals.includes(hospitalId)
                          ? selectedHospitals.filter(id => id !== hospitalId)
                          : [...selectedHospitals, hospitalId];
                        
                        if (newSelection.length === 0) {
                          setSelectedHospitals(['all']);
                        } else {
                          setSelectedHospitals(newSelection);
                        }
                      }
                      console.log('🏥 Filtro de hospital alterado:', hospitalStats.find(h => h.id === hospitalId)?.name);
                    }
                  }}
                >
                  <SelectTrigger className="h-9">
                    <SelectValue>
                      {selectedHospitals.includes('all') ? (
                        <div className="flex items-center">
                          <Hospital className="h-3 w-3 mr-2" />
                          <span className="text-sm">Todos os Hospitais</span>
                        </div>
                      ) : (
                        <div className="flex items-center">
                          <Hospital className="h-3 w-3 mr-2" />
                          <span className="text-sm">
                            {selectedHospitals.length === 1 
                              ? hospitalStats.find(h => h.id === selectedHospitals[0])?.name || 'Hospital'
                              : `${selectedHospitals.length} hospitais`
                            }
                          </span>
                        </div>
                      )}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">
                      <div className="flex items-center">
                        <Hospital className="h-3 w-3 mr-2" />
                        <span>Todos os Hospitais</span>
                      </div>
                    </SelectItem>
                    {hospitalStats.map((hospital) => (
                      <SelectItem key={hospital.id} value={hospital.id}>
                        <div className="flex items-center justify-between w-full">
                          <span>{hospital.name}</span>
                          {selectedHospitals.includes(hospital.id) && !selectedHospitals.includes('all') && (
                            <CheckCircle className="h-3 w-3 text-green-600 ml-2" />
                          )}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* BOTÃO LIMPAR FILTROS */}
              <div className="flex items-end">
                <button
                  onClick={() => {
                    setSearchTerm('');
                    setSelectedCareCharacter('all');
                    setSelectedHospitals(['all']);
                  }}
                  className="px-3 py-2 text-sm text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded-lg transition-colors h-9 border border-gray-200 w-full flex items-center justify-center gap-1"
                  title="Limpar todos os filtros"
                >
                  <Filter className="h-3 w-3" />
                  <span>Limpar</span>
                </button>
              </div>
            </div>

            {/* INDICADORES DE FILTROS ATIVOS */}
            {(searchTerm || selectedCareCharacter !== 'all' || !selectedHospitals.includes('all')) && (
              <div className="flex items-center justify-between pt-3 border-t border-gray-100">
                <div className="flex items-center gap-2">
                  {searchTerm && (
                    <Badge variant="outline" className="text-xs bg-green-50 text-green-700 border-green-200">
                      🔍 Busca: {searchTerm}
                    </Badge>
                  )}
                  {!selectedHospitals.includes('all') && (
                    <Badge variant="outline" className="text-xs bg-blue-50 text-blue-700 border-blue-200">
                      🏥 {selectedHospitals.length} Hospital(is)
                    </Badge>
                  )}
                  {selectedCareCharacter !== 'all' && (
                    <Badge variant="outline" className="text-xs bg-orange-50 text-orange-700 border-orange-200">
                      🎯 Caráter: {selectedCareCharacter === '1' ? 'Eletivo' : 'Urgência/Emergência'}
                    </Badge>
                  )}
                  <Badge variant="outline" className="text-xs bg-purple-50 text-purple-700 border-purple-200">
                    📅 Período Personalizado
                  </Badge>
                  <span className="text-xs text-gray-500">
                    Filtros ativos aplicados globalmente
                  </span>
                </div>
              </div>
            )}
          </CardContent>
        </Card>



        {/* TAB: MÉDICOS */}
        <TabsContent value="doctors" className="space-y-6">
          <MedicalProductionDashboard 
            onStatsUpdate={updateMedicalProductionStats}
            dateRange={selectedDateRange}
            onDateRangeChange={handleDateRangeChange}
            selectedHospitals={selectedHospitals}
            searchTerm={searchTerm}
            selectedCareCharacter={selectedCareCharacter}
          />
          {/* ⚠️ NOTA: onStatsUpdate agora apenas atualiza activeDoctors, não afeta faturamento/AIHs */}
        </TabsContent>



        {/* TAB: CORPO MÉDICO */}
        <TabsContent value="medical-staff" className="space-y-6">
          <MedicalStaffDashboard />
        </TabsContent>

        {/* TAB: PROCEDIMENTOS */}
        <TabsContent value="procedures" className="space-y-6">
          <div className="bg-gradient-to-br from-white to-gray-50 rounded-xl shadow-lg border border-gray-100 overflow-hidden">
            <div className="bg-white p-4 border-b border-gray-200">
              <div className="flex items-center justify-between">
                <div className="flex items-center">
                  <div className="bg-gray-100 p-2 rounded-lg mr-3">
                     <FileText className="h-6 w-6 text-gray-600" />
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900">Top Procedimentos por Valor</h3>
                      <p className="text-gray-600 text-xs mt-1">
                        Procedimentos com maior faturamento baseado nas AIHs processadas
                      </p>
                  </div>
                </div>
                <div className="bg-gray-100 px-2 py-1 rounded-full">
                    <span className="text-xs font-medium text-gray-700">{procedures.length} itens</span>
                  </div>
              </div>
            </div>
            
            {/* Paginação Superior */}
            {procedures.length > itemsPerPage && <PaginationControls />}
            
            <div className="p-4">
              {currentProcedures.length > 0 ? (
                <div className="space-y-3">
                  {currentProcedures.map((procedure, index) => (
                    <div key={procedure.procedure_code} className="group hover:shadow-md transition-all duration-300 bg-white rounded-lg border border-gray-200 overflow-hidden">
                       <div className="p-4">
                        <div className="flex justify-between items-start">
                          <div className="flex-1 pr-6">
                            <div className="flex items-center mb-2">
                              <div className="flex items-center justify-center w-8 h-8 bg-gradient-to-r from-purple-500 to-purple-600 text-white text-sm font-bold rounded-full mr-3 shadow-sm">
                                {startIndex + index + 1}
                              </div>
                              <span className="font-mono text-sm text-gray-700 bg-gray-100 px-3 py-1.5 rounded-lg border">
                                {procedure.procedure_code}
                              </span>
                            </div>
                            
                            <h4 className="font-medium text-gray-900 mb-3 text-sm leading-relaxed group-hover:text-slate-700 transition-colors">
                              {procedure.procedure_description || 'Descrição não disponível'}
                            </h4>
                            
                            <div className="grid grid-cols-2 gap-3">
                               <div className="bg-blue-50 p-2 rounded-md border border-blue-100">
                                 <div className="flex items-center mb-1">
                                   <div className="w-1.5 h-1.5 bg-blue-500 rounded-full mr-1.5"></div>
                                   <span className="text-xs font-medium text-blue-700">AIHs Total</span>
                                 </div>
                                 <div className="text-sm font-bold text-blue-900">{formatNumber(procedure.total_aihs)}</div>
                               </div>
                               
                               <div className="bg-green-50 p-2 rounded-md border border-green-100">
                                 <div className="flex items-center mb-1">
                                   <div className="w-1.5 h-1.5 bg-green-500 rounded-full mr-1.5"></div>
                                   <span className="text-xs font-medium text-green-700">Valor Unitário</span>
                                 </div>
                                 <div className="text-sm font-bold text-green-900">{formatCurrency(safeValue(procedure.avg_value_per_aih))}</div>
                               </div>
                             </div>
                          </div>
                          
                          <div className="text-right">
                            <div className="bg-gradient-to-br from-slate-50 to-slate-100 p-3 rounded-lg border border-slate-200 shadow-sm">
                               <div className="text-xs font-medium text-slate-700 mb-1 flex items-center justify-end">
                                 <span className="mr-1">💰</span>
                                 Valor Total
                               </div>
                               <div className="text-lg font-bold text-slate-800 mb-1">
                                 {formatCurrency(procedure.total_aihs * safeValue(procedure.avg_value_per_aih))}
                               </div>
                               <div className="text-xs text-slate-600 bg-white/60 px-2 py-0.5 rounded-full">
                                 {formatNumber(procedure.total_aihs)} × {formatCurrency(safeValue(procedure.avg_value_per_aih))}
                               </div>
                             </div>
                          </div>
                        </div>
                      </div>
                      
                      <div className="h-0.5 bg-gradient-to-r from-slate-400 via-blue-400 to-green-400 opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-12 text-gray-500">
                  <div className="bg-gray-100 w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-4">
                    <FileText className="h-10 w-10 text-gray-400" />
                  </div>
                  <div className="text-xl font-semibold text-gray-700 mb-2">Aguardando dados dos procedimentos</div>
                  <div className="text-sm text-gray-500">Processe algumas AIHs para ver o ranking</div>
                </div>
              )}
            </div>
            
            {/* Paginação Inferior */}
            {procedures.length > itemsPerPage && <PaginationControls />}
          </div>
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
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <Button 
                  className="h-24 flex flex-col items-center justify-center bg-green-600 hover:bg-green-700"
                  onClick={() => setShowReportGenerator(true)}
                >
                  <FileText className="h-6 w-6 mb-2" />
                  <div className="text-center">
                    <div className="font-semibold">Relatório Financeiro</div>
                    <div className="text-xs opacity-90">Faturamento e performance</div>
                  </div>
                </Button>
                
                <Button 
                  className="h-24 flex flex-col items-center justify-center bg-blue-600 hover:bg-blue-700"
                  onClick={() => setShowReportGenerator(true)}
                >
                  <Users className="h-6 w-6 mb-2" />
                  <div className="text-center">
                    <div className="font-semibold">Relatório de Médicos</div>
                    <div className="text-xs opacity-90">Performance por profissional</div>
                  </div>
                </Button>
                
                <Button 
                  className="h-24 flex flex-col items-center justify-center bg-purple-600 hover:bg-purple-700"
                  onClick={() => setShowReportGenerator(true)}
                >
                  <Hospital className="h-6 w-6 mb-2" />
                  <div className="text-center">
                    <div className="font-semibold">Relatório Hospitalar</div>
                    <div className="text-xs opacity-90">Comparação entre unidades</div>
                  </div>
                </Button>

                <Button 
                  className="h-24 flex flex-col items-center justify-center bg-red-600 hover:bg-red-700"
                  onClick={() => setShowReportGenerator(true)}
                >
                  <FileText className="h-6 w-6 mb-2" />
                  <div className="text-center">
                    <div className="font-semibold">Relatório SUS</div>
                    <div className="text-xs opacity-90">Médico + Pacientes + Valores</div>
                  </div>
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
      
      {/* Dialog do Gerador de Relatórios */}
      <Dialog open={showReportGenerator} onOpenChange={setShowReportGenerator}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto" aria-describedby="report-generator-description">
          <DialogHeader>
            <DialogTitle>Gerador de Relatórios PDF</DialogTitle>
            <p id="report-generator-description" className="text-sm text-muted-foreground">
              Gere relatórios detalhados em PDF com dados financeiros, médicos e hospitalares.
            </p>
          </DialogHeader>
          <ReportGenerator onClose={() => setShowReportGenerator(false)} />
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default ExecutiveDashboard;
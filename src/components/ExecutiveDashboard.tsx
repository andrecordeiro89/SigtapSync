import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Badge } from './ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import { Switch } from './ui/switch';
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
  Award,
  ChevronLeft,
  ChevronRight,
  Filter,
    Search,
    X
} from 'lucide-react';

// Services
import { DoctorsRevenueService, type DoctorAggregated, type SpecialtyStats, type HospitalStats as HospitalRevenueStats } from '../services/doctorsRevenueService';
import { AIHBillingService, type CompleteBillingStats, type AIHBillingByProcedure } from '../services/aihBillingService';
import { supabase } from '../lib/supabase';
import { DateRange } from '../types';
import HospitalRevenueDashboard from './HospitalRevenueDashboard';
import SpecialtyRevenueDashboard from './SpecialtyRevenueDashboard';
import MedicalProductionDashboard from './MedicalProductionDashboard';
import MedicalStaffDashboard from './MedicalStaffDashboard';
import ProcedureHierarchyDashboard from './ProcedureHierarchyDashboard';
// import ReportGenerator from './ReportGenerator';
// import ExecutiveDateFilters from './ExecutiveDateFilters';

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
    
    // Aplicar filtros de data por ALTA (janela do dia inteiro)
    if (dateRange) {
      const startInclusiveISO = getStartOfDay(dateRange.startDate).toISOString();
      const endExclusiveISO = getStartOfNextDay(dateRange.endDate).toISOString();
      
      console.log('📅 Aplicando filtros de ALTA (fallback):', {
        inicio_inclusivo: startInclusiveISO,
        fim_exclusivo: endExclusiveISO
      });
      
      query = query
        .gte('discharge_date', startInclusiveISO)
        .lt('discharge_date', endExclusiveISO)
        .not('discharge_date', 'is', null);
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
  cnes?: string; // ✅ CNES (identificador SUS)
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
  // State Management - SIMPLIFICADO: Apenas competência
  const [selectedHospitals, setSelectedHospitals] = useState<string[]>(['all']);
  const [searchTerm, setSearchTerm] = useState('');
  const [patientSearchTerm, setPatientSearchTerm] = useState(''); // Busca por nome do paciente
  const [selectedSpecialty, setSelectedSpecialty] = useState<string>('all');
  const [selectedCareSpecialty, setSelectedCareSpecialty] = useState<string>('all'); // Mantido temporariamente
  const [availableSpecialties, setAvailableSpecialties] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);
  const [activeTab, setActiveTab] = useState('doctors');
  const [activeHospitalTab, setActiveHospitalTab] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;
  // Removido: consolidado de todos os hospitais — fonte única: tabela AIHs filtrada por hospital
  // const [showReportGenerator, setShowReportGenerator] = useState(false);
  
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
  // Competência (mês de alta)
  const [selectedCompetency, setSelectedCompetency] = useState<string>('all');
  const [availableCompetencies, setAvailableCompetencies] = useState<Array<{ value: string; label: string }>>([]);
  const showCompetencyTabs = true; // ✅ Ativado para carregar competências

  // Estados para dados reais das views
  const [doctorsData, setDoctorsData] = useState<DoctorAggregated[]>([]);
  const [specialtyStats, setSpecialtyStats] = useState<SpecialtyStats[]>([]);
  const [hospitalRevenueStats, setHospitalRevenueStats] = useState<HospitalRevenueStats[]>([]);
  const [billingStats, setBillingStats] = useState<CompleteBillingStats | null>(null);
  // Filtro local da aba Procedimentos
  const [proceduresHospitalId, setProceduresHospitalId] = useState<string>('all');
  const [proceduresData, setProceduresData] = useState<AIHBillingByProcedure[]>([]);
  const [includeAnesthesia, setIncludeAnesthesia] = useState<boolean>(true);
  


  // Authentication
  const { user, isDirector, isAdmin, isCoordinator, isTI, hasPermission } = useAuth();

  // Paginação (usa dados locais filtrados por hospital quando aplicável)
  const procedures = (proceduresData && proceduresData.length > 0)
    ? proceduresData
    : (billingStats?.byProcedure || []);
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

  // ✅ SIMPLIFICADO: Sem manipulação de datas

  
  
    // Função para lidar com mudança de aba
  const handleTabChange = (tabValue: string) => {
    setActiveTab(tabValue);
    
    // ✅ CABEÇALHO SEMPRE MOSTRA DADOS DIRETOS DA TABELA AIHs
    // Não depende mais dos dados dos médicos ou da aba ativa
    // Valores fixos: 818 AIHs + soma calculated_total_value
  };

  // Abreviação elegante de nomes de hospitais para exibição nas abas
  const abbreviateHospitalName = (name: string): string => {
    try {
      let short = name?.trim() || '';
      // Regras comuns
      short = short.replace(/^Hospital\s+/i, 'Hosp. ');
      short = short.replace(/\bMunicipal\b/gi, 'Mun.');
      short = short.replace(/\bMaternidade\b/gi, 'Matern.');
      short = short.replace(/\bNossa\s+Senhora\b/gi, 'N.S');
      // Espaços extras
      short = short.replace(/\s{2,}/g, ' ').replace(/\s+\./g, '.');
      return short;
    } catch {
      return name;
    }
  };

  // Mapa de códigos por hospital (padrão executivo)
  const HOSPITAL_CODE_MAP: Record<string, string> = {
    'Hosp. Torao Tokuda': 'APU',
    'Hosp. Mun. São José': 'CAR',
    'Hosp. Mun. Juarez Barreto de Macedo': 'FAX',
    'Hosp. N.S Aparecida': 'FOZ',
    'HUOP': 'CAS',
    'Hosp. Mun. Santa Alice': 'SM',
    'Hosp. Mun. 18 de Dezembro': 'ARA',
    'Hosp. Matern. N.S Aparecida': 'FRG',
    'Hosp. Regional Centro Oeste': 'GUA'
  };

  const getHospitalTabLabel = (name: string): string => {
    const abbr = abbreviateHospitalName(name);
    return HOSPITAL_CODE_MAP[abbr] || abbr;
  };

  // Lista de hospitais ordenada alfabeticamente pela sigla exibida
  const sortedHospitalStats = React.useMemo(() => {
    try {
      return [...hospitalStats].sort((a, b) =>
        getHospitalTabLabel(a.name).localeCompare(getHospitalTabLabel(b.name), 'pt-BR')
      );
    } catch {
      return hospitalStats;
    }
  }, [hospitalStats]);

  // Nome completo do hospital selecionado para exibição no cabeçalho (incluindo CNES)
  const currentHospitalFullName = React.useMemo(() => {
    try {
      if (!activeHospitalTab) return null;
      const h = hospitalStats.find((hs) => hs.id === activeHospitalTab);
      if (!h) return null;
      
      // ✅ Incluir CNES (identificador SUS) se disponível
      const cnesInfo = h.cnes ? ` - CNES: ${h.cnes}` : '';
      return `${h.name}${cnesInfo}`;
    } catch {
      return null;
    }
  }, [activeHospitalTab, hospitalStats]);

  // Sincronizar aba de hospitais com lista de hospitais carregados (usa a mesma ordem das abas exibidas)
  useEffect(() => {
    try {
      if (sortedHospitalStats && sortedHospitalStats.length > 0) {
        // Debug: Log da ordenação dos hospitais
        console.log('🏥 Hospitais ordenados:', sortedHospitalStats.map(h => ({ 
          id: h.id, 
          name: h.name, 
          label: getHospitalTabLabel(h.name) 
        })));
        
        // Se a aba atual não é válida, selecionar o primeiro da ordenação visual (ex.: APU)
        const exists = activeHospitalTab && hospitalStats.some(h => h.id === activeHospitalTab);
        if (!exists) {
          // Procurar APU primeiro, caso contrário usar o primeiro da lista ordenada
          const apuHospital = sortedHospitalStats.find(h => getHospitalTabLabel(h.name) === 'APU');
          const firstHospitalId = apuHospital ? apuHospital.id : sortedHospitalStats[0].id;
          
          console.log('🎯 Hospital padrão disponível:', {
            apuFound: !!apuHospital,
            selectedId: firstHospitalId,
            selectedName: sortedHospitalStats.find(h => h.id === firstHospitalId)?.name,
            selectedLabel: getHospitalTabLabel(sortedHospitalStats.find(h => h.id === firstHospitalId)?.name || '')
          });
          
          // ✅ CORREÇÃO: NÃO forçar seleção de hospital único - manter 'all' como padrão
          // setActiveHospitalTab(firstHospitalId);
          // setSelectedHospitals([firstHospitalId]);
        }
      }
    } catch (e) {
      console.error('Erro ao sincronizar abas de hospital:', e);
    }
  }, [sortedHospitalStats, hospitalStats, activeHospitalTab]);

  // Trocar de hospital via abas
  const handleHospitalTabChange = (hospitalId: string) => {
    setActiveHospitalTab(hospitalId);
    // Forçar modo por hospital único para a aba de Médicos
    setSelectedHospitals([hospitalId]);
    // Recarregar dados com o novo hospital aplicado
    setIsLoading(true);
    loadExecutiveData();
  };

  // ✅ CORREÇÃO: Removido useEffect que forçava mudança de 'all' para hospital específico
  // Agora permite que o usuário selecione "Todos os Hospitais" ao iniciar
  useEffect(() => {
    if (!hospitalStats || hospitalStats.length === 0) return;
    
    console.log('🔄 Estado atual de hospitais:', {
      activeHospitalTab,
      selectedHospitals,
      hospitalStatsLength: hospitalStats.length
    });
    
    // ✅ PERMITIR 'all' - não forçar mudança para hospital específico
    // Se houver um único hospital selecionado (não 'all'), alinhar aba
    if (selectedHospitals.length >= 1 && !selectedHospitals.includes('all') && selectedHospitals[0] !== activeHospitalTab) {
      console.log('🏥 Alinhando activeHospitalTab para:', selectedHospitals[0]);
      setActiveHospitalTab(selectedHospitals[0]);
    }
  }, [selectedHospitals, activeHospitalTab, hospitalStats, sortedHospitalStats]);

  // Removido: efeito de carregamento de consolidação de todos os hospitais

	// Utilitário para formatar datas no input date
	const formatDateForInput = (date: Date): string => {
		return date.toISOString().split('T')[0];
	};

  // Parser seguro para datas de input em horário local (evita drift por timezone)
  const parseDateInputLocal = (value: string): Date => {
    try {
      const [y, m, d] = value.split('-').map(Number);
      // Retornamos meio-dia apenas como representação do dia; limites corretos são calculados nas queries
      return new Date(y, (m || 1) - 1, d || 1, 12, 0, 0, 0);
    } catch {
      return new Date(value);
    }
  };

  // Utilitários de janela do dia inteiro (início do dia, e início do dia seguinte)
  const getStartOfDay = (date: Date): Date => new Date(date.getFullYear(), date.getMonth(), date.getDate(), 0, 0, 0, 0);
  const getStartOfNextDay = (date: Date): Date => new Date(date.getFullYear(), date.getMonth(), date.getDate() + 1, 0, 0, 0, 0);
  


  // Removido: função de faturamento consolidado de todos os hospitais

  // Load Data
  const loadExecutiveData = async () => {
    if (!hasExecutiveAccess) return;
    
    setIsLoading(true);
    try {
      console.log('📊 Carregando dados executivos reais...');
      
      // ✅ PRIMEIRO: Tentar carregar das views, se falhar usar dados reais das tabelas
      let billingStatsData = null;
      try {
        // Filtros executivos aplicam somente à aba Médicos.
        // Para billing/KPIs e demais abas, não aplicar filtros globais aqui.
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
      setSpecialtyStats(specialtiesData);
      try {
        const specialties = Array.from(
          new Set((specialtiesData || []).map(s => s.doctor_specialty).filter(Boolean))
        ).sort((a, b) => a.localeCompare(b, 'pt-BR'));
        setAvailableSpecialties(specialties);
      } catch {}
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
      
      // ✅ CABEÇALHO: usar RPC get_hospital_kpis (fonte única e agregada no banco)
      // Garantir hospital ativo (fallback para aba atual)
      const activeHospitalId = (selectedHospitals.length > 0 && !selectedHospitals.includes('all'))
        ? selectedHospitals[0]
        : (activeHospitalTab || sortedHospitalStats[0]?.id || null);

      // ✅ Atualizar apenas KPIs padrões no state (sem cards de valores)
      setTimeout(() => {
        setKpiData({
          totalRevenue: totalRevenue,
          totalAIHs: totalAIHs,
          averageTicket: averageTicket,
          approvalRate,
          activeHospitals: hospitalsData.length,
          activeDoctors: activeDoctors,
          processingTime: 2.3,
          monthlyGrowth: 12.5
        });
      }, 100);
      
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

      // ✅ Buscar CNES dos hospitais da tabela hospitals
      const hospitalIds = hospitalsData.map(h => h.hospital_id).filter(Boolean);
      let hospitalCnesMap = new Map<string, string>();
      
      if (hospitalIds.length > 0) {
        const { data: hospitalsWithCnes } = await supabase
          .from('hospitals')
          .select('id, cnes')
          .in('id', hospitalIds);
        
        if (hospitalsWithCnes) {
          hospitalsWithCnes.forEach(h => {
            if (h.cnes) {
              hospitalCnesMap.set(h.id, h.cnes);
            }
          });
        }
      }
      
      // Converter dados dos hospitais para o formato atual com valores normalizados + CNES
      const hospitalStatsConverted: HospitalStats[] = hospitalsData.map(hospital => ({
        id: hospital.hospital_id || '',
        name: hospital.hospital_name || 'Nome não informado',
        cnes: hospitalCnesMap.get(hospital.hospital_id || ''), // ✅ Incluir CNES
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
      loadExecutiveData();
    }
  }, [selectedHospitals, selectedCompetency, hasExecutiveAccess]);

  // ✅ Carregar competências disponíveis do campo `competencia` da tabela `aihs`
  useEffect(() => {
    if (!showCompetencyTabs) {
      setAvailableCompetencies([]);
      return;
    }
    (async () => {
      try {
        let q = supabase
          .from('aihs')
          .select('competencia,hospital_id')
          .not('competencia', 'is', null);
        if (selectedHospitals.length > 0 && !selectedHospitals.includes('all')) {
          q = q.in('hospital_id', selectedHospitals);
        }
        const { data, error } = await q;
        if (error) {
          console.warn('⚠️ Erro ao carregar competências:', error);
          setAvailableCompetencies([]);
          return;
        }
        const setYM = new Set<string>();
        (data || []).forEach((row: any) => {
          const comp = row.competencia;
          if (comp) setYM.add(comp); // Mantém formato YYYY-MM-DD do banco
        });
        const arr = Array.from(setYM).sort((a, b) => (a < b ? 1 : -1));
        const formatted = arr.map((competenciaFull) => {
          // ✅ CORREÇÃO: Usar formato completo YYYY-MM-DD (não apenas YYYY-MM)
          const [y, m] = competenciaFull.split('-'); // pega ano e mês para label
          const d = new Date(Number(y), Number(m) - 1, 1);
          const label = d.toLocaleDateString('pt-BR', { month: 'short', year: '2-digit' }).replace('.', '');
          return { value: competenciaFull, label }; // ✅ value mantém YYYY-MM-DD completo
        });
        setAvailableCompetencies(formatted);
      } catch (e) {
        console.warn('⚠️ Falha ao montar competências:', e);
        setAvailableCompetencies([]);
      }
    })();
  }, [selectedHospitals]);

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
    <div className="w-full px-6 space-y-6">
      {/* CABEÇALHO (Premium) */}
      <div className="relative">

        <div className="relative flex items-start justify-between">
          <div>
            <div className="flex items-center gap-3 mb-1.5">
              <BarChart4 className="h-9 w-9 md:h-10 md:w-10 drop-shadow-sm" />
              <h1 className="text-3xl md:text-4xl font-black tracking-tight text-gray-900">Análise de Dados</h1>
            </div>
            <p className="text-gray-600 text-sm md:text-base">Central executiva de insights e relatórios</p>
          </div>
          <div className="text-right">
            {currentHospitalFullName && (
              <div className="inline-flex items-center justify-end gap-1 rounded-full bg-blue-50 text-blue-800 border border-blue-200 px-3 py-1 text-xs md:text-sm font-semibold mt-1">
                <Hospital className="h-3 w-3" />
                {currentHospitalFullName}
              </div>
            )}
            {lastUpdate && (
              <div className="text-xs text-gray-500 mt-2 flex items-center justify-end gap-1">
                <Clock className="h-3 w-3" />
                Atualizado: {lastUpdate.toLocaleTimeString('pt-BR')}
              </div>
            )}
          </div>
        </div>
      </div>



      <Tabs value={activeTab} onValueChange={handleTabChange} className="space-y-6">
        <TabsList className="grid w-full grid-cols-3 bg-blue-100">
          <TabsTrigger value="doctors" className="data-[state=active]:bg-blue-600 data-[state=active]:text-white">
            <Users className="h-4 w-4 mr-2" />
            Profissionais
          </TabsTrigger>
          <TabsTrigger value="procedures" className="data-[state=active]:bg-blue-600 data-[state=active]:text-white">
            <TrendingUp className="h-4 w-4 mr-2" />
            Análise de Performance
          </TabsTrigger>
          <TabsTrigger value="medical-staff" className="data-[state=active]:bg-blue-600 data-[state=active]:text-white">
            <Users className="h-4 w-4 mr-2" />
            Corpo Médico
          </TabsTrigger>
          {/* Relatórios aba removida */}
        </TabsList>

        {/* 🔍 FILTROS EXECUTIVOS GLOBAIS - VISÍVEIS NAS ABAS MÉDICOS E PROCEDIMENTOS */}
        {(activeTab === 'doctors' || activeTab === 'procedures') && (
        <Card className="shadow-lg border-0 bg-gradient-to-br from-white to-blue-50/30">
          <CardHeader className="pb-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center shadow-lg">
                  <Filter className="h-5 w-5 text-white" />
                </div>
                <div>
                  <h3 className="text-xl font-bold text-gray-900">Filtros de Produção Médica</h3>
                  <p className="text-sm text-gray-600 mt-1">Ajuste os filtros para análise da produção médica</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <Badge variant="secondary" className="bg-blue-100 text-blue-800 px-3 py-2 font-medium">
                  {medicalProductionStats ? `${medicalProductionStats.totalPatients} pacientes` : 'Carregando...'}
                </Badge>
              </div>
            </div>
            {/* Indicador de consolidado oculto */}

            {/* Abas de competência removidas conforme solicitação */}
          </CardHeader>
          <CardContent className="space-y-6">
            {/* FILTROS EM LINHA - DISTRIBUÍDOS SIMETRICAMENTE */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
              {/* BUSCA RÁPIDA MÉDICOS */}
              <div className="w-full">
                <label className="text-xs font-medium text-gray-600 uppercase tracking-wide mb-1.5 block">Buscar Médico</label>
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

              {/* 🆕 NOVO: BUSCA POR NOME DO PACIENTE */}
              <div className="w-full">
                <label className="text-xs font-medium text-gray-600 uppercase tracking-wide mb-1.5 block">Buscar Paciente</label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-green-400" />
                  <Input
                    placeholder="Nome do paciente..."
                    value={patientSearchTerm}
                    onChange={(e) => setPatientSearchTerm(e.target.value)}
                    className="pl-10 h-9 border-gray-200 focus:border-green-500 focus:ring-green-500/20 text-sm"
                  />
                  {patientSearchTerm && (
                    <button
                      onClick={() => setPatientSearchTerm('')}
                      className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                      title="Limpar busca de paciente"
                    >
                      ✕
                    </button>
                  )}
                </div>
              </div>

              {/* 🏥 FILTRO DE HOSPITAL */}
              <div className="w-full">
                <label className="text-xs font-medium text-gray-600 uppercase tracking-wide mb-1.5 block">Hospital</label>
                <div className="flex items-center gap-2">
                  <select
                    value={selectedHospitals[0] || 'all'}
                    onChange={(e) => {
                      const value = e.target.value;
                      setSelectedHospitals(value === 'all' ? ['all'] : [value]);
                      setActiveHospitalTab(value === 'all' ? null : value);
                    }}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg bg-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors h-9"
                  >
                    <option value="all">Todos os Hospitais</option>
                    {hospitalStats.map(hospital => (
                      <option key={hospital.id} value={hospital.id}>
                        {hospital.name}
                      </option>
                    ))}
                  </select>
                  {selectedHospitals[0] !== 'all' && !selectedHospitals.includes('all') && (
                    <button
                      onClick={() => {
                        setSelectedHospitals(['all']);
                        setActiveHospitalTab(null);
                      }}
                      className="px-2 py-1 text-xs text-blue-600 hover:text-blue-800 hover:bg-blue-50 rounded transition-colors flex-shrink-0"
                      title="Limpar filtro de hospital"
                    >
                      ✕
                    </button>
                  )}
                </div>
              </div>

              {/* 🗓️ FILTRO DE COMPETÊNCIA */}
              <div className="w-full">
                <label className="text-xs font-medium text-gray-600 uppercase tracking-wide mb-1.5 block">Competência</label>
                <div className="flex items-center gap-2">
                  <select
                    value={selectedCompetency}
                    onChange={(e) => setSelectedCompetency(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg bg-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-colors h-9"
                  >
                    <option value="all">Todas</option>
                    {availableCompetencies.map(comp => (
                      <option key={comp.value} value={comp.value}>
                        {comp.label}
                      </option>
                    ))}
                  </select>
                  {selectedCompetency !== 'all' && (
                    <button
                      onClick={() => setSelectedCompetency('all')}
                      className="px-2 py-1 text-xs text-indigo-600 hover:text-indigo-800 hover:bg-indigo-50 rounded transition-colors flex-shrink-0"
                      title="Limpar filtro de competência"
                    >
                      ✕
                    </button>
                  )}
                </div>
              </div>
            </div>

            {/* ✅ ABAS DE COMPETÊNCIA REMOVIDAS - Agora usa apenas dropdown */}
            {/* ✅ BARRA DE ABAS DE HOSPITAIS REMOVIDA - Agora usa dropdown acima */}

            {/* INDICADORES DE FILTROS ATIVOS */}
            {(searchTerm || patientSearchTerm || !selectedHospitals.includes('all')) && (
              <div className="flex items-center justify-between pt-3 border-t border-gray-100">
                <div className="flex items-center gap-2">
                  {searchTerm && (
                    <Badge variant="outline" className="text-xs bg-blue-50 text-blue-700 border-blue-200">
                      👨‍⚕️ Médico: {searchTerm}
                    </Badge>
                  )}
                  {patientSearchTerm && (
                    <Badge variant="outline" className="text-xs bg-green-50 text-green-700 border-green-200">
                      🧑‍🦱 Paciente: {patientSearchTerm}
                    </Badge>
                  )}
                  {!selectedHospitals.includes('all') && (
                    <Badge variant="outline" className="text-xs bg-blue-50 text-blue-700 border-blue-200">
                      🏥 {hospitalStats.find(h => h.id === selectedHospitals[0])?.name || 'Hospital selecionado'}
                    </Badge>
                  )}
                  {false && (
                    <Badge variant="outline" className="text-xs bg-indigo-50 text-indigo-700 border-indigo-200">
                      🏥 Especialidade de Atendimento: {selectedCareSpecialty}
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
        )}



        {/* TAB: MÉDICOS */}
        <TabsContent value="doctors" className="space-y-6">
          <MedicalProductionDashboard 
            onStatsUpdate={updateMedicalProductionStats}
            selectedHospitals={selectedHospitals}
            searchTerm={searchTerm}
            patientSearchTerm={patientSearchTerm}
            selectedCompetencia={selectedCompetency}
          />
          {/* ⚠️ NOTA: onStatsUpdate agora apenas atualiza activeDoctors, não afeta faturamento/AIHs */}
        </TabsContent>



        {/* TAB: CORPO MÉDICO */}
        <TabsContent value="medical-staff" className="space-y-6">
          <MedicalStaffDashboard />
        </TabsContent>

        {/* TAB: PROCEDIMENTOS */}
        <TabsContent value="procedures" className="space-y-6">
          <ProcedureHierarchyDashboard selectedHospitals={selectedHospitals} searchTerm={searchTerm} />
        </TabsContent>

        {/* Aba Relatórios removida */}
      </Tabs>
      
      {/* Gerador de Relatórios removido com a aba */}
    </div>
  );
};

export default ExecutiveDashboard;
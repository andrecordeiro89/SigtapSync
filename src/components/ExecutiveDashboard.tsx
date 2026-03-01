import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import ImportWizard from './ImportWizard'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Badge } from './ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import { Switch } from './ui/switch';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from './ui/collapsible';
import { useAuth } from '../contexts/AuthContext';
import { toast } from 'sonner';
import { useVirtualizer } from '@tanstack/react-virtual';
import {
  BarChart4,
  TrendingUp,
  Users,
  User,
  Hospital,
  DollarSign,
  FileText,
  FileSpreadsheet,
  AlertTriangle,
  AlertCircle,
  CheckCircle,
  Clock,
  Activity,
  Loader2,
  Stethoscope,
  Award,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  Filter,
  Search,
  X,
  Building,
  Calendar,
  Check,
  ChevronsUpDown,
  Settings
} from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from './ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from './ui/command';
import { cn } from '@/lib/utils';

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
import RulesStudio from './rulesStudio/RulesStudio'
import { CareCharacterUtils } from '../config/careCharacterCodes';
import { exportAnesthesiaExcel } from '../services/exportService';
import HybridSourceDialog from './HybridSourceDialog';
// import ReportGenerator from './ReportGenerator';
// import ExecutiveDateFilters from './ExecutiveDateFilters';
import TabwinConferenceDialog from './TabwinConferenceDialog';
import RejectedTabwinDialog from './RejectedTabwinDialog';

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

// 🚀 PERFORMANCE UTILITIES
const debounce = <T extends (...args: any[]) => any>(
  func: T,
  wait: number
): ((...args: Parameters<T>) => void) => {
  let timeout: NodeJS.Timeout;
  return (...args: Parameters<T>) => {
    clearTimeout(timeout);
    timeout = setTimeout(() => func.apply(this, args), wait);
  };
};

// Virtual scrolling component for large lists
const VirtualizedList = ({ items, renderItem, itemHeight = 80 }: any) => {
  const parentRef = useRef<HTMLDivElement>(null);
  const virtualizer = useVirtualizer({
    count: items.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => itemHeight,
    overscan: 5,
  });

  return (
    <div ref={parentRef} style={{ height: '600px', overflow: 'auto' }}>
      <div
        style={{
          height: `${virtualizer.getTotalSize()}px`,
          width: '100%',
          position: 'relative',
        }}
      >
        {virtualizer.getVirtualItems().map((virtualItem) => (
          <div
            key={virtualItem.index}
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              width: '100%',
              height: `${virtualItem.size}px`,
              transform: `translateY(${virtualItem.start}px)`,
            }}
          >
            {renderItem(items[virtualItem.index], virtualItem.index)}
          </div>
        ))}
      </div>
    </div>
  );
};

// ✅ FUNÇÃO SEGURA: Parse de data ISO sem problemas de timezone
const parseISODateToLocal = (isoString: string | undefined | null): string => {
  if (!isoString) return '';
  
  const s = String(isoString).trim();
  if (!s) return '';
  
  // Tentar extrair YYYY-MM-DD (ignora hora se houver)
  const match = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (match) {
    const [, year, month, day] = match;
    return `${day}/${month}/${year}`;
  }
  
  // Se não encontrou padrão esperado, tentar split manual
  try {
    const parts = s.split(/[-T]/);
    if (parts.length >= 3) {
      const [year, month, day] = parts;
      if (year && month && day) {
        return `${day.padStart(2, '0')}/${month.padStart(2, '0')}/${year}`;
      }
    }
  } catch (err) {
    console.warn('⚠️ Erro ao parsear data:', s, err);
  }
  
  // Último recurso: retornar indicador de erro
  return '⚠️ Data inválida';
};

const getStartOfDay = (date: Date): Date => {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
};

const getStartOfNextDay = (date: Date): Date => {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate() + 1);
};

// Função para formatar competência (YYYY-MM-DD para MM/YYYY)
const formatCompetencia = (competencia: string | undefined): string => {
  if (!competencia) return '—';
  
  try {
    // Formato esperado: YYYY-MM-DD ou YYYY-MM
    const match = competencia.match(/^(\d{4})-(\d{2})/);
    if (match) {
      const [, year, month] = match;
      return `${month}/${year}`;
    }
    
    // Tentar parsear como data
    const date = new Date(competencia);
    if (!isNaN(date.getTime())) {
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const year = date.getFullYear();
      return `${month}/${year}`;
    }
    
    return competencia;
  } catch {
    return competencia;
  }
};

// 🚀 KPI CALCULATION FUNCTION
const calculateKPIs = async (filters: any): Promise<any> => {
  try {
    // Calculate key performance indicators based on filters
    const { data: totalDoctors } = await supabase
      .from('doctors')
      .select('id', { count: 'exact' })
      .eq('hospital_id', filters.hospitalId || 'default');

    const { data: activeDoctors } = await supabase
      .from('doctors')
      .select('id', { count: 'exact' })
      .eq('hospital_id', filters.hospitalId || 'default')
      .eq('status', 'active');

    const { data: totalProcedures } = await supabase
      .from('procedure_records')
      .select('id', { count: 'exact' })
      .eq('hospital_id', filters.hospitalId || 'default');

    return {
      totalDoctors: totalDoctors?.length || 0,
      activeDoctors: activeDoctors?.length || 0,
      totalProcedures: totalProcedures?.length || 0,
      activationRate: totalDoctors?.length > 0 ? (activeDoctors?.length || 0) / totalDoctors.length : 0
    };
  } catch (error) {
    console.error('❌ Error calculating KPIs:', error);
    return {
      totalDoctors: 0,
      activeDoctors: 0,
      totalProcedures: 0,
      activationRate: 0
    };
  }
};

interface ExecutiveDashboardProps {}

// Performance optimization interfaces
interface PaginationState {
  currentPage: number;
  pageSize: number;
  totalItems: number;
  totalPages: number;
}

interface VirtualScrollConfig {
  enabled: boolean;
  itemHeight: number;
  overscan: number;
}

interface PerformanceState {
  isLoading: boolean;
  isBackgroundProcessing: boolean;
  lastUpdate: Date | null;
  cacheKey: string;
}

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

import { SihTabwinReportService } from '../services/sihTabwinReportService';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

const ExecutiveDashboard: React.FC<ExecutiveDashboardProps> = () => {
  const { user, hasPermission } = useAuth();
  
  // Performance optimization state
  const [pagination, setPagination] = useState({
    currentPage: 1,
    pageSize: 50,
    totalItems: 0,
    totalPages: 1
  });
  
  const [virtualScroll, setVirtualScroll] = useState({
    enabled: true,
    itemHeight: 80,
    overscan: 5
  });
  
  const [performance, setPerformance] = useState({
    isLoading: false,
    isBackgroundProcessing: false,
    lastUpdate: null,
    cacheKey: ''
  });
  
  // Virtual scrolling refs
  const parentRef = useRef<HTMLDivElement>(null);
  
  // Data cache for performance
  const [dataCache, setDataCache] = useState<Map<string, any>>(new Map());
  const [backgroundQueue, setBackgroundQueue] = useState<Promise<any>[]>([]);
  
  // State Management - SIMPLIFICADO: Apenas competência
  const [selectedHospitals, setSelectedHospitals] = useState<string[]>(['all']);
  const [searchTerm, setSearchTerm] = useState('');
  const [patientSearchTerm, setPatientSearchTerm] = useState(''); // Busca por nome do paciente
  const [filterCareCharacter, setFilterCareCharacter] = useState<'all' | '1' | '2'>('all');
  const [selectedSpecialty, setSelectedSpecialty] = useState<string>('all');
  const [selectedCareSpecialty, setSelectedCareSpecialty] = useState<string>('all'); // Mantido temporariamente
  const [availableSpecialties, setAvailableSpecialties] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  
  // Performance optimized data loading
  const loadDataWithPagination = useCallback(async (page: number, pageSize: number, filters: any) => {
    const cacheKey = JSON.stringify({ page, pageSize, filters, userId: user?.id });
    
    // Check cache first
    if (dataCache.has(cacheKey)) {
      console.log('🚀 Cache hit for key:', cacheKey);
      return dataCache.get(cacheKey);
    }
    
    setPerformance(prev => ({ ...prev, isLoading: true }));
    
    try {
      // Load data with pagination parameters
      const offset = (page - 1) * pageSize;
      
      // Parallel data loading with limits
      const [doctorsData, hospitalsData, kpisData] = await Promise.all([
        DoctorsRevenueService.getDoctorsAggregated(filters),
        AIHBillingService.getHospitalBillingStats(filters.hospitalId || 'all'),
        // Load KPIs in background
        loadKPIsInBackground(filters)
      ]);
      
      const result = {
        doctors: doctorsData || [],
        hospitals: hospitalsData.hospital ? [hospitalsData.hospital] : [],
        kpis: kpisData,
        totalItems: doctorsData?.totalCount || 0
      };
      
      // Cache the result
      setDataCache(prev => {
        const newCache = new Map(prev);
        newCache.set(cacheKey, result);
        
        // Limit cache size to prevent memory issues
        if (newCache.size > 50) {
          const firstKey = newCache.keys().next().value;
          newCache.delete(firstKey);
        }
        
        return newCache;
      });
      
      return result;
    } catch (error) {
      console.error('❌ Error loading paginated data:', error);
      throw error;
    } finally {
      setPerformance(prev => ({ 
        ...prev, 
        isLoading: false,
        lastUpdate: new Date()
      }));
    }
  }, [dataCache, user?.id]);
  
  // Background processing for heavy computations
  const loadKPIsInBackground = useCallback(async (filters: any) => {
    if (performance.isBackgroundProcessing) return null;
    
    setPerformance(prev => ({ ...prev, isBackgroundProcessing: true }));
    
    // Use Web Workers for heavy computations
    const backgroundTask = new Promise((resolve) => {
      setTimeout(async () => {
        try {
          // Create date range from filters if available
          const dateRange = filters.startDate && filters.endDate ? {
            startDate: new Date(filters.startDate),
            endDate: new Date(filters.endDate)
          } : undefined;
          
          const kpis = await AIHBillingService.getCompleteBillingStats(dateRange, {
            hospitalIds: filters.hospitalId ? [filters.hospitalId] : undefined,
            specialty: filters.specialty,
            careCharacter: filters.careCharacter,
            searchTerm: filters.searchTerm
          });
          resolve(kpis);
        } catch (error) {
          console.error('❌ Background KPI calculation failed:', error);
          resolve(null);
        }
      }, 100); // Small delay to allow UI to update
    });
    
    backgroundTask.finally(() => {
      setPerformance(prev => ({ ...prev, isBackgroundProcessing: false }));
    });
    
    return backgroundTask;
  }, [performance.isBackgroundProcessing]);
  
  // Optimized data refresh with debouncing
  const debouncedRefresh = useCallback(
    debounce(async (filters: any) => {
      try {
        const data = await loadDataWithPagination(
          pagination.currentPage,
          pagination.pageSize,
          filters
        );
        
        setDoctorsData(data.doctors);
        setHospitalStats(data.hospitals);
        if (data.kpis) {
          setKpiData(data.kpis);
        }
        
        setPagination(prev => ({
          ...prev,
          totalItems: data.totalItems,
          totalPages: Math.ceil(data.totalItems / prev.pageSize)
        }));
      } catch (error) {
        console.error('❌ Error refreshing data:', error);
        toast.error('Erro ao carregar dados');
      }
    }, 500),
    [loadDataWithPagination, pagination.currentPage, pagination.pageSize]
  );
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);
  const [activeTab, setActiveTab] = useState('doctors');
  const [importOpen, setImportOpen] = useState(false);
  const [activeHospitalTab, setActiveHospitalTab] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;
  const [dischargeFrom, setDischargeFrom] = useState<string>('');
  const [dischargeTo, setDischargeTo] = useState<string>('');
  const [inputDischargeFrom, setInputDischargeFrom] = useState<string>('');
  const [inputDischargeTo, setInputDischargeTo] = useState<string>('');
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
    patientsWithMultipleAIHs?: number;
    totalMultipleAIHs?: number;
    totalAIHs?: number;
    multipleAIHsDetails?: any[];
  } | null>(null);
  const [showViewsWarning, setShowViewsWarning] = useState(false);
  
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
  const [aihDbCount, setAihDbCount] = useState<number | null>(null);
  const [aihKpi, setAihKpi] = useState<{ totalAIHs: number; totalRevenue: number; averageTicket: number } | null>(null);
  const [tabwinOpen, setTabwinOpen] = useState(false);
  const [isRejectedTabwinDialogOpen, setIsRejectedTabwinDialogOpen] = useState(false);
  const [repasseSihOpen, setRepasseSihOpen] = useState(false)

  const [filtersApplied, setFiltersApplied] = useState(false);
  const [appliedSearchTerm, setAppliedSearchTerm] = useState('');
  const [appliedPatientSearchTerm, setAppliedPatientSearchTerm] = useState('');
  const [appliedSelectedHospitals, setAppliedSelectedHospitals] = useState<string[]>(['all']);
  const [appliedSelectedCompetency, setAppliedSelectedCompetency] = useState('all');
  const [appliedFilterCareCharacter, setAppliedFilterCareCharacter] = useState<'all' | '1' | '2'>('all');
  const [appliedDischargeFrom, setAppliedDischargeFrom] = useState<string>('');
  const [appliedDischargeTo, setAppliedDischargeTo] = useState<string>('');
  const [selectedSpecialties, setSelectedSpecialties] = useState<string[]>([]);
  const [appliedSelectedSpecialties, setAppliedSelectedSpecialties] = useState<string[]>([]);
  const [pendingLoads, setPendingLoads] = useState(0);
  const startLoad = () => setPendingLoads(v => v + 1);
  const endLoad = () => setPendingLoads(v => Math.max(0, v - 1));
  const isGlobalLoading = pendingLoads > 0;
  useEffect(() => {
    const onStart = () => startLoad();
    const onEnd = () => endLoad();
    window.addEventListener('mpd:loading-start', onStart);
    window.addEventListener('mpd:loading-end', onEnd);
    return () => {
      window.removeEventListener('mpd:loading-start', onStart);
      window.removeEventListener('mpd:loading-end', onEnd);
    };
  }, []);
  


  // Authentication
  const { isDirector, isAdmin, isCoordinator, isTI } = useAuth();

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
    patientsWithMultipleAIHs?: number;
    totalMultipleAIHs?: number;
    totalAIHs?: number;
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

  const toISOStartOfDay = (d?: string) => {
    if (!d) return undefined;
    const dt = new Date(d);
    dt.setHours(0,0,0,0);
    return dt.toISOString();
  };
  const toISOEndOfDay = (d?: string) => {
    if (!d) return undefined;
    const dt = new Date(d);
    dt.setHours(23,59,59,999);
    return dt.toISOString();
  };

  const endOfMonthISO = (isoDate: string): string => {
    const m = String(isoDate || '').match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (!m) return '';
    const year = Number(m[1]);
    const month = Number(m[2]);
    if (!year || !month) return '';
    const end = new Date(year, month, 0);
    const y = end.getFullYear();
    const mm = String(end.getMonth() + 1).padStart(2, '0');
    const dd = String(end.getDate()).padStart(2, '0');
    return `${y}-${mm}-${dd}`;
  };

  const applyFilters = () => {
    setAppliedSearchTerm(searchTerm);
    setAppliedPatientSearchTerm(patientSearchTerm);
    setAppliedSelectedHospitals(selectedHospitals);
    setAppliedSelectedCompetency(selectedCompetency);
    setAppliedFilterCareCharacter(filterCareCharacter);
    setAppliedDischargeFrom(dischargeFrom);
    setAppliedDischargeTo(dischargeTo);
    setAppliedSelectedSpecialties(selectedSpecialties);
    setFiltersApplied(true);
  };

  const filtersDirty = useMemo(() => {
    if (!filtersApplied) return false;
    const pendingKey = JSON.stringify({
      searchTerm,
      patientSearchTerm,
      selectedHospitals,
      selectedCompetency,
      filterCareCharacter,
      dischargeFrom,
      dischargeTo,
      selectedSpecialties
    });
    const appliedKey = JSON.stringify({
      searchTerm: appliedSearchTerm,
      patientSearchTerm: appliedPatientSearchTerm,
      selectedHospitals: appliedSelectedHospitals,
      selectedCompetency: appliedSelectedCompetency,
      filterCareCharacter: appliedFilterCareCharacter,
      dischargeFrom: appliedDischargeFrom,
      dischargeTo: appliedDischargeTo,
      selectedSpecialties: appliedSelectedSpecialties
    });
    return pendingKey !== appliedKey;
  }, [
    filtersApplied,
    searchTerm,
    patientSearchTerm,
    selectedHospitals,
    selectedCompetency,
    filterCareCharacter,
    dischargeFrom,
    dischargeTo,
    selectedSpecialties,
    appliedSearchTerm,
    appliedPatientSearchTerm,
    appliedSelectedHospitals,
    appliedSelectedCompetency,
    appliedFilterCareCharacter,
    appliedDischargeFrom,
    appliedDischargeTo,
    appliedSelectedSpecialties
  ]);

  const handleAnesthetistsReport = async () => {
    try {
      const hospitalIds = selectedHospitals && selectedHospitals.length > 0 && !selectedHospitals.includes('all')
        ? selectedHospitals
        : undefined;
      await exportAnesthesiaExcel({
        hospitalIds,
        dateFromISO: toISOStartOfDay(dischargeFrom) || undefined,
        dateToISO: toISOEndOfDay(dischargeTo) || undefined,
        careCharacter: filterCareCharacter === 'all' ? undefined : filterCareCharacter,
        doctorNameContains: (searchTerm || '').trim() || undefined,
        maxColumnsPerPatient: 5,
      });
      toast.success('Relatório Anestesistas gerado');
    } catch (e: any) {
      console.error('Erro relatório anestesistas', e);
      toast.error('Erro ao gerar relatório de anestesistas');
    }
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
    // loadExecutiveData(); // Removido para evitar duplo fetch (useEffect já monitora selectedHospitals)
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
    
    startLoad();
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
        console.warn('⚠️ Views de billing não disponíveis (fallback desativado por segurança):', error);
        billingStatsData = null;
      }

      // Carregar dados das views de médicos/hospitais em paralelo
      const [doctorsResult, specialtiesData, hospitalsData] = await Promise.all([
        DoctorsRevenueService.getDoctorsAggregated({ pageSize: 1000 }), // Todos os médicos
        DoctorsRevenueService.getSpecialtyStats(),
        DoctorsRevenueService.getHospitalStats()
      ]);
      
      // ✅ Verificar se as views retornaram dados vazios (indicando erro 500)
      if (doctorsResult.doctors.length === 0 && specialtiesData.length === 0 && hospitalsData.length === 0) {
        console.warn('⚠️ TODAS AS VIEWS RETORNARAM VAZIAS - Possível erro 500 no Supabase');
        console.warn('💡 Execute: database/fix_missing_views_migration.sql no Supabase');
        setShowViewsWarning(true);
      }
      
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
        setShowViewsWarning(true); // ⚠️ Mostrar aviso de que as views estão faltando
        
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
      endLoad();
    }
  };

  // Effects
  useEffect(() => {
    if (hasExecutiveAccess) {
      loadExecutiveData();
    }
  }, [selectedHospitals, selectedCompetency, hasExecutiveAccess]);

  useEffect(() => {
    (async () => {
      if (!hasExecutiveAccess) return;
      startLoad();
      try {
        const rawCare = String(filterCareCharacter || '').trim();
        const careNormalized = rawCare === '01' ? '1' : rawCare === '02' ? '2' : (rawCare === 'all' ? null : rawCare || null);
        const hospitalIds = (selectedHospitals.length > 0 && !selectedHospitals.includes('all')) ? selectedHospitals : null;
        const { data, error } = await supabase.rpc('get_aih_count', {
          hospital_ids: hospitalIds,
          competencia: (selectedCompetency && selectedCompetency !== 'all' && selectedCompetency.trim() !== '') ? selectedCompetency.trim() : null,
          care_character: careNormalized,
          discharge_from: dischargeFrom || null,
          discharge_to: dischargeTo || null,
          doctor_name: null,
          patient_name: null
        });
        if (!error) {
          setAihDbCount(typeof data === 'number' ? data : null);
        } else {
          console.warn('⚠️ Falha RPC get_aih_count (exec):', error);
          try {
            let query = supabase.from('aihs').select('id', { count: 'exact', head: true });
            if (hospitalIds) query = query.in('hospital_id', hospitalIds as any);
            const comp = (selectedCompetency && selectedCompetency !== 'all' && selectedCompetency.trim() !== '') ? selectedCompetency.trim() : null;
            if (comp) query = query.eq('competencia', comp);
            if (careNormalized) query = query.eq('care_character', careNormalized);
            if (dischargeFrom) query = query.gte('discharge_date', dischargeFrom);
            if (dischargeTo) query = query.lt('discharge_date', new Date(new Date(dischargeTo).getTime() + 24*60*60*1000).toISOString());
            const { count, error: countErr } = await query;
            if (countErr) {
              console.warn('⚠️ Fallback count (exec) falhou:', countErr);
              setAihDbCount(null);
            } else {
              setAihDbCount(typeof count === 'number' ? count : null);
            }
          } catch (fallbackErr) {
            console.warn('⚠️ Erro fallback count (exec):', fallbackErr);
            setAihDbCount(null);
          }
        }
      } catch (e) {
        console.warn('⚠️ Erro RPC get_aih_count (exec):', e);
        setAihDbCount(null);
      } finally { endLoad(); }
    })();
  }, [hasExecutiveAccess, selectedHospitals, selectedCompetency, filterCareCharacter, appliedDischargeFrom, appliedDischargeTo]); // ✅ Depender de filtros APLICADOS para datas

  useEffect(() => {
    if (aihDbCount != null) {
      setKpiData(prev => ({ ...prev, totalAIHs: aihDbCount }));
    }
  }, [aihDbCount]);

  useEffect(() => {
    (async () => {
      if (!hasExecutiveAccess) return;
      startLoad();
      try {
        const rawCare = String(filterCareCharacter || '').trim();
        const careNormalized = rawCare === '01' ? '1' : rawCare === '02' ? '2' : (rawCare === 'all' ? null : rawCare || null);
        const hospitalIds = (selectedHospitals.length > 0 && !selectedHospitals.includes('all')) ? selectedHospitals : null;
        const { data, error } = await supabase.rpc('get_aih_kpis', {
          hospital_ids: hospitalIds,
          competencia: (selectedCompetency && selectedCompetency !== 'all' && selectedCompetency.trim() !== '') ? selectedCompetency.trim() : null,
          care_character: careNormalized,
          discharge_from: dischargeFrom || null,
          discharge_to: dischargeTo || null,
          doctor_name: null,
          patient_name: null
        });
        if (!error && Array.isArray(data) && data.length > 0) {
          const row: any = data[0];
          setAihKpi({
            totalAIHs: Number(row.total_aihs || 0),
            totalRevenue: Number(row.total_value || 0),
            averageTicket: Number(row.average_ticket || 0)
          });
        } else {
          try {
            let query = supabase
              .from('aihs')
              .select('id, calculated_total_value, hospital_id, competencia, care_character, discharge_date');
            if (hospitalIds) query = query.in('hospital_id', hospitalIds as any);
            const comp = (selectedCompetency && selectedCompetency !== 'all' && selectedCompetency.trim() !== '') ? selectedCompetency.trim() : null;
            if (comp) query = query.eq('competencia', comp);
            if (careNormalized) query = query.eq('care_character', careNormalized);
            if (dischargeFrom) query = query.gte('discharge_date', dischargeFrom);
            if (dischargeTo) query = query.lt('discharge_date', new Date(new Date(dischargeTo).getTime() + 24*60*60*1000).toISOString());
            const { data: rows, error: err2 } = await query;
            if (err2 || !rows) {
              setAihKpi(null);
            } else {
              const totalAIHs = rows.length;
              const totalRevenue = rows.reduce((sum: number, r: any) => sum + (Number(r.calculated_total_value || 0)), 0);
              const averageTicket = totalAIHs > 0 ? totalRevenue / totalAIHs : 0;
              setAihKpi({ totalAIHs, totalRevenue, averageTicket });
            }
          } catch {
            setAihKpi(null);
          }
        }
      } catch {
        setAihKpi(null);
      } finally { endLoad(); }
    })();
  }, [hasExecutiveAccess, selectedHospitals, selectedCompetency, filterCareCharacter, appliedDischargeFrom, appliedDischargeTo]); // ✅ Depender de filtros APLICADOS para datas

  useEffect(() => {
    if (aihKpi) {
      setKpiData(prev => ({
        ...prev,
        totalAIHs: aihKpi.totalAIHs,
        totalRevenue: aihKpi.totalRevenue,
        averageTicket: aihKpi.averageTicket
      }));
    }
  }, [aihKpi]);

  // ✅ Carregar competências disponíveis do campo `competencia` da tabela `aihs`
  // ✅ CORREÇÃO: Implementar paginação para buscar TODAS as competências (sem limite de 1000)
  useEffect(() => {
    if (!showCompetencyTabs) {
      setAvailableCompetencies([]);
      return;
    }
    (async () => {
      try {
        console.log('📋 Carregando competências disponíveis...');
        const pageSize = 1000;
        const maxRows = 20000;
        const maxDistinct = 72;
        let offset = 0;
        const setYM = new Set<string>();

        while (true) {
          let q = supabase
            .from('aihs')
            .select('competencia,hospital_id')
            .not('competencia', 'is', null)
            .order('competencia', { ascending: false })
            .range(offset, offset + pageSize - 1)

          if (selectedHospitals.length > 0 && !selectedHospitals.includes('all')) {
            q = q.in('hospital_id', selectedHospitals)
          }

          const { data: batch, error } = await q
          if (error) {
            console.warn('⚠️ Erro ao carregar batch de competências:', error)
            break
          }

          const batchLen = batch?.length || 0
          if (batchLen === 0) break

          for (const row of batch as any[]) {
            const comp = (row as any).competencia
            if (comp) setYM.add(comp)
          }

          if (setYM.size >= maxDistinct) break
          if (batchLen < pageSize) break

          offset += pageSize
          if (offset >= maxRows) break

          await new Promise(r => setTimeout(r, 0))
        }
        
        const arr = Array.from(setYM).sort((a, b) => (a < b ? 1 : -1));
        console.log(`✅ ${arr.length} competências únicas encontradas`);
        
        const formatted = arr.map((competenciaFull) => {
          // ✅ CORREÇÃO: Usar formato completo YYYY-MM-DD (não apenas YYYY-MM)
          const [y, m] = competenciaFull.split('-'); // pega ano e mês para label
          const d = new Date(Number(y), Number(m) - 1, 1);
          const label = d.toLocaleDateString('pt-BR', { month: 'short', year: '2-digit' }).replace('.', '');
          return { value: competenciaFull, label }; // ✅ value mantém YYYY-MM-DD completo
        });
        
        setAvailableCompetencies(formatted);
        console.log(`✅ Competências formatadas e disponíveis no dropdown: ${formatted.length}`);
      } catch (e) {
        console.warn('⚠️ Falha ao montar competências:', e);
        setAvailableCompetencies([]);
      }
    })();
  }, [selectedHospitals]);
  useEffect(() => {
    setInputDischargeFrom(dischargeFrom || '');
    setInputDischargeTo(dischargeTo || '');
  }, [dischargeFrom, dischargeTo]);

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
    <>
    <div className="w-full px-6 space-y-6">
      {/* Cabeçalho branco e preto */}
      <Card className="shadow-sm border border-gray-200 bg-white">
        <CardHeader className="pb-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex items-center justify-center w-14 h-14 bg-gray-100 rounded-xl">
                <BarChart4 className="h-7 w-7 text-black" />
              </div>
              <div>
                <h1 className="text-3xl font-black text-black">Análise de Dados</h1>
                <p className="text-sm text-neutral-700 mt-1">Central executiva de insights e relatórios</p>
              </div>
            </div>
            <div className="flex flex-col items-end gap-2">
              {currentHospitalFullName && (
                <div className="rounded-lg px-4 py-2 border border-gray-200 bg-white">
                  <div className="flex items-center gap-2">
                    <Hospital className="h-4 w-4 text-black" />
                    <span className="text-sm font-semibold text-black">{currentHospitalFullName}</span>
                  </div>
                </div>
              )}
              {lastUpdate && (
                <div className="flex items-center gap-1.5 text-xs text-neutral-700">
                  <Clock className="h-3.5 w-3.5 text-black" />
                  <span>Atualizado: {lastUpdate.toLocaleTimeString('pt-BR')}</span>
                </div>
              )}
            </div>
          </div>
        </CardHeader>
      </Card>

      {/* Abas profissional em preto e branco */}
      <Tabs value={activeTab} onValueChange={handleTabChange} className="space-y-6">
          <TabsList className="inline-flex items-end gap-1 bg-transparent px-0 pt-0">
            <TabsTrigger 
              value="doctors" 
              className="rounded-md border border-gray-300 px-4 py-2 transition-all duration-200 font-semibold text-black bg-white hover:bg-neutral-100 data-[state=active]:bg-black data-[state=active]:text-white data-[state=active]:border-black"
            >
              <Users className="h-4 w-4 mr-2" />
              Profissionais
            </TabsTrigger>
            {false && (
              <TabsTrigger 
                value="procedures" 
                className="rounded-md border border-gray-300 px-4 py-2 transition-all duration-200 font-semibold text-black bg-white hover:bg-neutral-100 data-[state=active]:bg-black data-[state=active]:text-white data-[state=active]:border-black"
              >
                <TrendingUp className="h-4 w-4 mr-2" />
                Análise de Performance
              </TabsTrigger>
            )}
            <TabsTrigger 
              value="medical-staff" 
              className="rounded-md border border-gray-300 px-4 py-2 transition-all duration-200 font-semibold text-black bg-white hover:bg-neutral-100 data-[state=active]:bg-black data-[state=active]:text-white data-[state=active]:border-black"
            >
              <Stethoscope className="h-4 w-4 mr-2" />
              Corpo Médico
            </TabsTrigger>
            <TabsTrigger 
              value="repasse-rules" 
              className="rounded-md border border-gray-300 px-4 py-2 transition-all duration-200 font-semibold text-black bg-white hover:bg-neutral-100 data-[state=active]:bg-black data-[state=active]:text-white data-[state=active]:border-black"
            >
              <Settings className="h-4 w-4 mr-2" />
              Regras Repasse
            </TabsTrigger>
          </TabsList>

        {/* 🔍 FILTROS EXECUTIVOS GLOBAIS - DESIGN MINIMALISTA */}
        {(activeTab === 'doctors' || activeTab === 'procedures') && (
        <Card className="shadow-sm border border-slate-200 bg-white">
          <CardHeader className="pb-4">
            {/* HEADER COM DESIGN MINIMALISTA */}
            <div className="mb-4 pb-4 border-b border-gray-100">
              <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center w-12 h-12 bg-gray-100 rounded-xl">
              {isGlobalLoading ? (
                <Loader2 className="h-6 w-6 animate-spin text-blue-600" />
              ) : (
                <Filter className="h-6 w-6 text-black" />
              )}
            </div>
            <div>
              <h3 className="text-2xl font-bold text-black">Filtros de Produção Médica</h3>
              <p className="text-sm text-neutral-700 mt-1">Ajuste os filtros para análise da produção médica</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className="rounded-xl px-6 py-3 border border-gray-200 bg-white">
              <div className="text-xs font-semibold text-black uppercase tracking-wide">
                AIHs (Registros Únicos)
              </div>
              <div className="text-xl font-black text-black">
                {isGlobalLoading ? (
                  <Loader2 className="h-4 w-4 animate-spin text-blue-600" />
                ) : (
                  medicalProductionStats ? (medicalProductionStats.totalAIHs || 0) : '...'
                )}
              </div>
            </div>
          </div>
              </div>
            </div>

            {/* ✅ NOVO: Alertas de múltiplas AIHs (igual PatientManagement) */}
            {medicalProductionStats && medicalProductionStats.patientsWithMultipleAIHs && medicalProductionStats.patientsWithMultipleAIHs > 0 && (
              <div className="mt-3">
                <Collapsible>
                  <CollapsibleTrigger asChild>
                    <Button 
                      variant="ghost" 
                      size="sm"
                      className="flex items-center gap-2 text-xs text-black hover:bg-neutral-100 p-2 h-auto font-normal"
                    >
                      <AlertCircle className="w-3 h-3" />
                      <span>
                        ℹ️ {medicalProductionStats.patientsWithMultipleAIHs} paciente(s) com múltiplas AIHs (total: {medicalProductionStats.totalMultipleAIHs} AIHs)
                      </span>
                      <ChevronDown className="w-3 h-3 ml-1" />
                    </Button>
                  </CollapsibleTrigger>
                  <CollapsibleContent>
                    <div className="mt-2 bg-white rounded-lg p-3 border border-gray-200">
                      <div className="flex items-center gap-2 mb-2">
                        <Users className="w-4 h-4 text-black" />
                        <h4 className="text-xs font-semibold text-black">Pacientes com Múltiplas AIHs</h4>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-2 max-h-[400px] overflow-y-auto">
                        {medicalProductionStats.multipleAIHsDetails && medicalProductionStats.multipleAIHsDetails.length > 0 ? (
                          medicalProductionStats.multipleAIHsDetails.map((patient: any, index: number) => (
                            <div 
                              key={index}
                              className="bg-white rounded-md p-2.5 border border-gray-200 hover:border-black transition-colors h-fit"
                            >
                              {/* Cabeçalho do Paciente */}
                              <div className="flex items-start justify-between mb-2">
                                <div className="flex items-center gap-2 flex-1">
                                  <User className="w-3.5 h-3.5 text-black flex-shrink-0" />
                                  <div className="flex flex-col">
                                    <span className="font-semibold text-gray-900 text-xs">{patient.patient_name}</span>
                                    <span className="text-gray-500 text-[10px]">CNS: {patient.patient_cns}</span>
                                  </div>
                                </div>
                                <div className="flex items-center gap-2 flex-shrink-0">
                                  <Badge variant="outline" className="text-[10px] px-2 py-0.5 border-gray-300 text-black">
                                    {patient.aih_count}× AIHs
                                  </Badge>
                                </div>
                              </div>
                              
                              {/* Lista de AIHs */}
                              {patient.aihs && patient.aihs.length > 0 && (
                                <div className="space-y-1 pl-5 border-l-2 border-gray-300 ml-1">
                                  {patient.aihs.map((aih: any, aihIndex: number) => (
                                    <div 
                                      key={aihIndex}
                                      className="text-[10px] text-gray-600 bg-gray-50 rounded px-2 py-1"
                                    >
                                      <div className="flex items-center justify-between flex-wrap gap-1">
                                        <span className="font-medium text-black">
                                          AIH: {aih.aih_number}
                                        </span>
                                        {aih.competencia && (
                                          <Badge variant="outline" className="text-[9px] px-1.5 py-0 h-4 bg-white text-black border-gray-300">
                                            {formatCompetencia(aih.competencia)}
                                          </Badge>
                                        )}
                                      </div>
                                      <div className="flex items-center gap-2 mt-0.5 text-[9px]">
                                        {aih.admission_date && (
                                          <span className="text-black">
                                            📅 Admissão: {parseISODateToLocal(aih.admission_date)}
                                          </span>
                                        )}
                                        {aih.discharge_date && (
                                          <span className="text-black">
                                            📤 Alta: {parseISODateToLocal(aih.discharge_date)}
                                          </span>
                                        )}
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              )}
                              
                              {/* Hospital */}
                              {patient.hospital_name && (
                                <div className="mt-1.5 text-[10px] text-gray-500 flex items-center gap-1">
                                  <Hospital className="w-3 h-3 text-black" />
                                  <span>{patient.hospital_name}</span>
                                </div>
                              )}
                            </div>
                          ))
                        ) : (
                          <div className="text-center text-gray-500 text-xs py-2">
                            Nenhum detalhe disponível
                          </div>
                        )}
                      </div>
                    </div>
                  </CollapsibleContent>
                </Collapsible>
              </div>
            )}
            
            {/* Indicador de consolidado oculto */}

            {/* Abas de competência removidas conforme solicitação */}
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Botões de relatório reposicionados para o final da seção */}
            {/* ⚠️ AVISO: Views de banco de dados não encontradas */}
            {showViewsWarning && (
              <div className="bg-yellow-50 border-2 border-yellow-400 rounded-lg p-4 mb-4">
                <div className="flex items-start gap-3">
                  <AlertTriangle className="h-5 w-5 text-yellow-600 flex-shrink-0 mt-0.5" />
                  <div className="flex-1">
                    <h3 className="text-sm font-bold text-yellow-800 mb-1">
                      ⚠️ Views do banco de dados não encontradas
                    </h3>
                    <p className="text-xs text-yellow-700 mb-2">
                      As views <code className="bg-yellow-100 px-1 rounded">v_doctors_aggregated</code> e <code className="bg-yellow-100 px-1 rounded">v_specialty_revenue_stats</code> retornaram erro 500.
                    </p>
                    <p className="text-xs text-yellow-700 font-semibold">
                      💡 Solução: Execute o script <code className="bg-yellow-100 px-1 rounded font-mono">database/fix_missing_views_migration.sql</code> no Supabase SQL Editor.
                    </p>
                  </div>
                  <button
                    onClick={() => setShowViewsWarning(false)}
                    className="text-yellow-600 hover:text-yellow-800 flex-shrink-0"
                    type="button"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              </div>
            )}
            
            {/* FILTROS EM GRID - DESIGN MINIMALISTA */}
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4 items-start">
              {/* BUSCAR MÉDICO */}
              <div>
                <label className="flex items-center gap-2 text-xs font-bold text-black uppercase tracking-wide mb-2">
                  <Stethoscope className="h-3.5 w-3.5 text-black" />
                  Buscar Médico
                </label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-neutral-400" />
                  <Input
                    placeholder="Nome, CNS, CRM..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    disabled={isGlobalLoading}
                    className="pl-10 h-10 border-2 border-gray-200 focus:border-black focus:ring-0 text-sm rounded-lg bg-white hover:border-gray-300 transition-colors"
                  />
                  {searchTerm && (
                    <button
                      onClick={() => setSearchTerm('')}
                      className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-full w-5 h-5 flex items-center justify-center text-xs"
                      title="Limpar busca"
                      type="button"
                    >
                      ✕
                    </button>
                  )}
                </div>
              </div>

              {/* BUSCAR PACIENTE */}
              <div>
                <label className="flex items-center gap-2 text-xs font-bold text-black uppercase tracking-wide mb-2">
                  <User className="h-3.5 w-3.5 text-black" />
                  Buscar Paciente
                </label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-neutral-400" />
                  <Input
                    placeholder="Nome do paciente..."
                    value={patientSearchTerm}
                    onChange={(e) => setPatientSearchTerm(e.target.value)}
                    disabled={isGlobalLoading}
                    className="pl-10 h-10 border-2 border-gray-200 focus:border-black focus:ring-0 text-sm rounded-lg bg-white hover:border-gray-300 transition-colors"
                  />
                  {patientSearchTerm && (
                    <button
                      onClick={() => setPatientSearchTerm('')}
                      className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-full w-5 h-5 flex items-center justify-center text-xs"
                      title="Limpar busca de paciente"
                      type="button"
                    >
                      ✕
                    </button>
                  )}
                </div>
              </div>

              {/* FILTRO DE HOSPITAL */}
              <div>
                <label className="flex items-center gap-2 text-xs font-bold text-black uppercase tracking-wide mb-2">
                  <Building className="h-3.5 w-3.5 text-black" />
                  Hospital
                </label>
                <div className="flex items-center gap-2">
                  <select
                    value={selectedHospitals[0] || 'all'}
                    onChange={(e) => {
                      const value = e.target.value;
                      setSelectedHospitals(value === 'all' ? ['all'] : [value]);
                      setActiveHospitalTab(value === 'all' ? null : value);
                    }}
                    disabled={isGlobalLoading}
                    className="w-full px-3 py-2 border-2 border-gray-200 rounded-lg bg-white text-sm focus:outline-none focus:border-black hover:border-gray-300 transition-colors h-10"
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
                      className="text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-full w-6 h-6 flex items-center justify-center text-xs flex-shrink-0"
                      title="Limpar filtro de hospital"
                      type="button"
                    >
                      ✕
                    </button>
                  )}
                </div>
              </div>

              {/* FILTRO DE COMPETÊNCIA DE APROVAÇÃO */}
              <div>
                <label className="flex items-center gap-2 text-xs font-bold text-black uppercase tracking-wide mb-2">
                  <Calendar className="h-3.5 w-3.5 text-black" />
                  Competência de Aprovação
                </label>
                <div className="flex items-center gap-2">
                  <select
                    value={selectedCompetency}
                    onChange={(e) => setSelectedCompetency(e.target.value)}
                    disabled={isGlobalLoading}
                    className="w-full px-3 py-2 border-2 border-gray-200 rounded-lg bg-white text-sm focus:outline-none focus:border-black hover:border-gray-300 transition-colors h-10"
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
                      className="text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-full w-6 h-6 flex items-center justify-center text-xs flex-shrink-0"
                      title="Limpar filtro de competência de aprovação"
                      type="button"
                    >
                      ✕
                    </button>
                  )}
                </div>
              </div>

              {/* ✅ Filtro: Caráter de Atendimento */}
              <div>
                <label className="flex items-center gap-2 text-xs font-bold text-black uppercase tracking-wide mb-2">
                  <AlertTriangle className="h-3.5 w-3.5 text-black" />
                  Caráter de Atendimento
                </label>
                <div className="flex items-center gap-2">
                  <select
                    value={filterCareCharacter}
                    onChange={(e) => setFilterCareCharacter(e.target.value as 'all' | '1' | '2')}
                    disabled={isGlobalLoading}
                    className="w-full px-3 py-2 border-2 border-gray-200 rounded-lg bg-white text-sm focus:outline-none focus:border-black hover:border-gray-300 transition-colors h-10"
                  >
                    <option value="all">Todos</option>
                    <option value="1">Eletivo</option>
                    <option value="2">Urgência</option>
                  </select>
                  {filterCareCharacter !== 'all' && (
                    <button
                      onClick={() => setFilterCareCharacter('all')}
                      className="text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-full w-6 h-6 flex items-center justify-center text-xs flex-shrink-0"
                      title="Limpar filtro de caráter de atendimento"
                      type="button"
                    >
                      ✕
                    </button>
                  )}
                </div>
              </div>

              <div>
                <label className="flex items-center gap-2 text-xs font-bold text-black uppercase tracking-wide mb-2">
                  <Stethoscope className="h-3.5 w-3.5 text-black" />
                  Especialidade
                </label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      role="combobox"
                      className="w-full justify-between h-10 border-2 border-gray-200 hover:bg-white hover:border-gray-300 bg-white text-black text-left font-normal"
                      disabled={isGlobalLoading}
                    >
                      <span className="truncate">
                        {selectedSpecialties.length === 0
                          ? "Todas as especialidades"
                          : `${selectedSpecialties.length} selecionada${selectedSpecialties.length > 1 ? 's' : ''}`}
                      </span>
                      <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-[300px] p-0" align="start">
                    <Command>
                      <CommandInput placeholder="Buscar especialidade..." />
                      <CommandList>
                        <CommandEmpty>Nenhuma especialidade encontrada.</CommandEmpty>
                        <CommandGroup className="max-h-[300px] overflow-auto">
                          <CommandItem
                            onSelect={() => setSelectedSpecialties([])}
                            className="cursor-pointer font-semibold"
                          >
                            <div className={cn(
                              "mr-2 flex h-4 w-4 items-center justify-center rounded-sm border border-primary",
                              selectedSpecialties.length === 0 ? "bg-primary text-primary-foreground" : "opacity-50 [&_svg]:invisible"
                            )}>
                              <Check className={cn("h-4 w-4")} />
                            </div>
                            Todas as especialidades
                          </CommandItem>
                          {availableSpecialties.map((specialty) => (
                            <CommandItem
                              key={specialty}
                              onSelect={() => {
                                setSelectedSpecialties((prev) => {
                                  if (prev.includes(specialty)) {
                                    return prev.filter((s) => s !== specialty);
                                  } else {
                                    return [...prev, specialty];
                                  }
                                });
                              }}
                              className="cursor-pointer"
                            >
                              <div className={cn(
                                "mr-2 flex h-4 w-4 items-center justify-center rounded-sm border border-primary",
                                selectedSpecialties.includes(specialty) ? "bg-primary text-primary-foreground" : "opacity-50 [&_svg]:invisible"
                              )}>
                                <Check className={cn("h-4 w-4")} />
                              </div>
                              {specialty}
                            </CommandItem>
                          ))}
                        </CommandGroup>
                      </CommandList>
                    </Command>
                  </PopoverContent>
                </Popover>
              </div>

              <div>
                <label className="flex items-center gap-2 text-xs font-bold text-black uppercase tracking-wide mb-2">
                  <Calendar className="h-3.5 w-3.5 text-black" />
                  Início (Altas)
                </label>
                <input
                  type="date"
                  value={inputDischargeFrom}
                  onChange={(e) => {
                    const v = e.target.value;
                    setInputDischargeFrom(v);
                    if (v) {
                      const end = endOfMonthISO(v);
                      if (end) setInputDischargeTo(end);
                    } else {
                      setInputDischargeTo('');
                    }
                  }}
                  onBlur={() => {
                    setDischargeFrom(inputDischargeFrom || '');
                    // ✅ Sincronizar data fim se foi preenchida automaticamente
                    if (inputDischargeTo) {
                      setDischargeTo(inputDischargeTo);
                    }
                  }}
                    disabled={isGlobalLoading}
                  className="w-full px-3 py-2 border-2 border-gray-200 rounded-lg bg-white text-sm focus:outline-none focus:border-black hover:border-gray-300 transition-colors h-10"
                />
              </div>

              <div>
                <label className="flex items-center gap-2 text-xs font-bold text-black uppercase tracking-wide mb-2">
                  <Calendar className="h-3.5 w-3.5 text-black" />
                  Fim (Altas)
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="date"
                    value={inputDischargeTo}
                    onChange={(e) => {
                      const v = e.target.value;
                      setInputDischargeTo(v);
                    }}
                    onBlur={() => setDischargeTo(inputDischargeTo || '')}
                    disabled={isGlobalLoading}
                    className="w-full px-3 py-2 border-2 border-gray-200 rounded-lg bg-white text-sm focus:outline-none focus:border-black hover:border-gray-300 transition-colors h-10"
                  />
                  {(dischargeFrom || dischargeTo) && (
                    <button
                      onClick={() => { setInputDischargeFrom(''); setInputDischargeTo(''); setDischargeFrom(''); setDischargeTo(''); }}
                      className="text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-full w-6 h-6 flex items-center justify-center text-xs flex-shrink-0"
                      title="Limpar filtro de alta"
                      type="button"
                    >
                      ✕
                    </button>
                  )}
                </div>
              </div>
            </div>

            {/* ✅ ABAS DE COMPETÊNCIA REMOVIDAS - Agora usa apenas dropdown */}
            {/* ✅ BARRA DE ABAS DE HOSPITAIS REMOVIDA - Agora usa dropdown acima */}

            {/* INDICADORES DE FILTROS ATIVOS - DESIGN MINIMALISTA */}
            {(searchTerm || patientSearchTerm || !selectedHospitals.includes('all') || selectedCompetency !== 'all' || filterCareCharacter !== 'all' || dischargeFrom || dischargeTo || selectedSpecialties.length > 0) && (
              <div className="flex items-center justify-between pt-4 border-t-2 border-gray-100">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-xs font-bold text-black uppercase tracking-wide">
                    Filtros Ativos:
                  </span>
                  {selectedSpecialties.length > 0 && (
                    <Badge variant="outline" className="flex items-center gap-1 text-xs bg-white text-black border-gray-300 font-medium px-2 py-1">
                      <Stethoscope className="h-3 w-3" />
                      {selectedSpecialties.length} Especialidade(s)
                    </Badge>
                  )}
                  {searchTerm && (
                    <Badge variant="outline" className="flex items-center gap-1 text-xs bg-white text-black border-gray-300 font-medium px-2 py-1">
                      <Stethoscope className="h-3 w-3" />
                      {searchTerm}
                    </Badge>
                  )}
                  {patientSearchTerm && (
                    <Badge variant="outline" className="flex items-center gap-1 text-xs bg-white text-black border-gray-300 font-medium px-2 py-1">
                      <User className="h-3 w-3" />
                      {patientSearchTerm}
                    </Badge>
                  )}
                  {!selectedHospitals.includes('all') && (
                    <Badge variant="outline" className="flex items-center gap-1 text-xs bg-white text-black border-gray-300 font-medium px-2 py-1">
                      <Building className="h-3 w-3" />
                      {hospitalStats.find(h => h.id === selectedHospitals[0])?.name || 'Hospital'}
                    </Badge>
                  )}
                  {selectedCompetency !== 'all' && (
                    <Badge variant="outline" className="flex items-center gap-1 text-xs bg-white text-black border-gray-300 font-medium px-2 py-1">
                      <Calendar className="h-3 w-3" />
                      Comp. Aprovação: {availableCompetencies.find(c => c.value === selectedCompetency)?.label || selectedCompetency}
                    </Badge>
                  )}
                  {filterCareCharacter !== 'all' && (
                    <Badge variant="outline" className="flex items-center gap-1 text-xs bg-white text-black border-gray-300 font-medium px-2 py-1">
                      <AlertTriangle className="h-3 w-3" />
                      Caráter: {CareCharacterUtils.formatForDisplay(filterCareCharacter, false)}
                    </Badge>
                  )}
                  {(dischargeFrom || dischargeTo) && (
                    <Badge variant="outline" className="flex items-center gap-1 text-xs bg-white text-black border-gray-300 font-medium px-2 py-1">
                      <Calendar className="h-3 w-3" />
                      Alta: {dischargeFrom ? dischargeFrom.split('-').reverse().join('/') : '—'} — {dischargeTo ? dischargeTo.split('-').reverse().join('/') : '—'}
                    </Badge>
                  )}
                  <span className="text-xs text-gray-400 italic">
                    · Aplicados globalmente
                  </span>
                </div>
              </div>
            )}

            <div className="pt-4 border-t border-gray-100">
              <div className="flex flex-wrap gap-2 items-center justify-between">
                <div className="flex flex-wrap gap-2 items-center">
                <Button
                  variant="default"
                  size="sm"
                  className="inline-flex items-center gap-2 bg-[#0b1736] hover:bg-[#09122a] text-white w-auto min-w-[160px]"
                  onClick={() => window.dispatchEvent(new Event('mpd:report-general'))}
                  title="Gerar relatório geral de pacientes"
                  disabled={isGlobalLoading || !filtersApplied || filtersDirty}
                  type="button"
                >
                  <FileSpreadsheet className="h-4 w-4" />
                  Relatório Geral
                </Button>
                <Button
                  variant="default"
                  size="sm"
                  className="inline-flex items-center gap-2 bg-[#0b1736] hover:bg-[#09122a] text-white w-auto min-w-[160px]"
                  onClick={() => window.dispatchEvent(new Event('mpd:report-conference'))}
                  title="Gerar relatório de conferência de pacientes"
                  disabled={isGlobalLoading || !filtersApplied || filtersDirty}
                  type="button"
                >
                  <FileSpreadsheet className="h-4 w-4" />
                  Conferência
                </Button>
                <Button
                  variant="default"
                  size="sm"
                  className="inline-flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white w-auto min-w-[200px]"
                  onClick={() => setTabwinOpen(true)}
                  title="Conferência Tabwin (SIH)"
                  disabled={isGlobalLoading}
                  type="button"
                >
                  <FileSpreadsheet className="h-4 w-4" />
                  Conferência Tabwin
                </Button>
                <Button
                  variant="default"
                  size="sm"
                  className="inline-flex items-center gap-2 bg-red-600 hover:bg-red-700 text-white w-auto min-w-[200px]"
                  onClick={() => setIsRejectedTabwinDialogOpen(true)}
                  title="Gerar PDF de AIHs rejeitadas (01/11/2025 - 30/11/2025)"
                  disabled={isGlobalLoading}
                  type="button"
                >
                  <FileSpreadsheet className="h-4 w-4" />
                  Rejeitados Tabwin
                </Button>
                <Button
                  variant="default"
                  size="sm"
                  className="inline-flex items-center gap-2 bg-green-600 hover:bg-green-700 text-white w-auto min-w-[180px]"
                  onClick={() => setRepasseSihOpen(true)}
                  title="Gerar Repasse Médico com SIH"
                  disabled={isGlobalLoading}
                  type="button"
                >
                  <DollarSign className="h-4 w-4" />
                  Repasse SIH
                </Button>
                </div>
                <Button
                  variant="default"
                  size="sm"
                  className="inline-flex items-center gap-2 bg-black hover:bg-gray-900 text-white w-auto min-w-[180px]"
                  onClick={applyFilters}
                  title="Aplicar filtros e carregar dados"
                  disabled={isGlobalLoading}
                  type="button"
                >
                  Aplicar Filtros
                </Button>
                {false && (
                  <Button
                    variant="default"
                    size="sm"
                    className="inline-flex items-center gap-2 bg-[#0b1736] hover:bg-[#09122a] text-white w-auto min-w-[160px]"
                    onClick={() => window.dispatchEvent(new Event('mpd:report-simplified'))}
                    title="Gerar relatório simplificado de pacientes"
                  >
                    <FileSpreadsheet className="h-4 w-4" />
                    Simplificado
                  </Button>
                )}
                {false && (
                  <Button
                    variant="default"
                    size="sm"
                    className="inline-flex items-center gap-2 bg-blue-700 hover:bg-blue-800 text-white w-auto min-w-[160px]"
                    onClick={() => setImportOpen(true)}
                    title="Importar CSVs para staging"
                  >
                    <FileText className="h-4 w-4" />
                    Importar CSV
                  </Button>
                )}
                {false && (
                  <Button
                    type="button"
                    variant="default"
                    className="inline-flex items-center gap-2 bg-[#0b1736] hover:bg-[#09122a] text-white w-auto min-w-[200px]"
                    onClick={handleAnesthetistsReport}
                    title="Gerar relatório de anestesistas (CBO 225151) por CNS e hospital"
                  >
                    <Stethoscope className="h-4 w-4" />
                    Relatório Anestesistas
                  </Button>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
        )}



        {/* TAB: MÉDICOS */}
        <TabsContent value="doctors" className="space-y-6">
          {!filtersApplied ? (
            <div className="w-full bg-white border-2 border-gray-200 rounded-lg p-10 flex items-center justify-center">
              <div className="text-center text-black font-semibold text-2xl">
                Selecione os Filtros primeiro e depois Aplique para receber os dados
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              {filtersDirty && (
                <div className="w-full bg-white border-2 border-black rounded-lg p-4 flex items-center justify-center">
                  <div className="text-center text-black font-semibold text-xl">
                    Filtros alterados. Clique em Aplicar Filtros para atualizar os dados.
                  </div>
                </div>
              )}
              <MedicalProductionDashboard 
                onStatsUpdate={updateMedicalProductionStats}
                selectedHospitals={appliedSelectedHospitals}
                searchTerm={appliedSearchTerm}
                patientSearchTerm={appliedPatientSearchTerm}
                selectedCompetencia={appliedSelectedCompetency}
                filterCareCharacter={appliedFilterCareCharacter}
                dischargeDateRange={{ from: appliedDischargeFrom || undefined, to: appliedDischargeTo || undefined }}
                selectedSpecialties={appliedSelectedSpecialties}
              />
            </div>
          )}
          {/* ⚠️ NOTA: onStatsUpdate agora apenas atualiza activeDoctors, não afeta faturamento/AIHs */}
        </TabsContent>



        {/* TAB: CORPO MÉDICO */}
        <TabsContent value="medical-staff" className="space-y-6">
          <MedicalStaffDashboard />
        </TabsContent>

        <TabsContent value="repasse-rules" className="space-y-6">
          <RulesStudio />
        </TabsContent>

        {false && (
          <TabsContent value="procedures" className="space-y-6">
            <ProcedureHierarchyDashboard selectedHospitals={selectedHospitals} searchTerm={searchTerm} />
          </TabsContent>
        )}

        {/* Aba Relatórios removida */}
      </Tabs>
      
      {/* Gerador de Relatórios removido com a aba */}
    </div>
    <TabwinConferenceDialog open={tabwinOpen} onOpenChange={setTabwinOpen} />
    <RejectedTabwinDialog open={isRejectedTabwinDialogOpen} onOpenChange={setIsRejectedTabwinDialogOpen} />
    <HybridSourceDialog open={repasseSihOpen} onOpenChange={setRepasseSihOpen} />
    {importOpen && (
      <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center">
        <div className="bg-white rounded shadow-xl w-full max-w-4xl">
          <div className="flex items-center justify-between border-b p-3">
            <div className="font-semibold">Import Wizard</div>
            <button className="px-3 py-1 bg-gray-200 rounded" onClick={() => setImportOpen(false)}>Fechar</button>
          </div>
          <ImportWizard />
        </div>
      </div>
    )}
  </>
  );
};

export default ExecutiveDashboard;

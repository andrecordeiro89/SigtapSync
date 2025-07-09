/**
 * ================================================================
 * HOOK PARA DADOS AGREGADOS DE MÉDICOS COM FATURAMENTO
 * ================================================================
 * Criado em: 2024-12-19
 * Propósito: Gerenciar médicos sem duplicação + faturamento real
 * Funcionalidade: Hook especializado para nova estrutura agregada
 * ================================================================
 */

import { useState, useCallback, useEffect, useMemo } from 'react';
import { DoctorsRevenueService, type DoctorAggregated, type RevenueFilters } from '../services/doctorsRevenueService';
import { useAuth } from '../contexts/AuthContext';

// ================================================================
// TIPOS DO HOOK
// ================================================================

export interface DoctorsRevenueState {
  // Dados principais
  doctors: DoctorAggregated[];
  isLoading: boolean;
  error: string | null;
  
  // Paginação
  currentPage: number;
  totalPages: number;
  totalCount: number;
  pageSize: number;
  hasMore: boolean;
  hasPrevious: boolean;
  
  // Filtros aplicados
  appliedFilters: RevenueFilters;
  
  // Dados auxiliares
  availableSpecialties: string[];
  availableHospitals: { id: string; name: string }[];
  
  // Estatísticas
  executiveSummary: {
    totalDoctors: number;
    activeDoctors: number;
    inactiveDoctors: number;
    totalRevenue: number;
    totalProcedures: number;
    avgRevenuePerDoctor: number;
    avgPaymentRate: number;
    topSpecialties: Array<{ specialty: string; revenue: number; count: number }>;
    activityRate: number;
  } | null;
}

// ================================================================
// HOOK PRINCIPAL
// ================================================================

export const useDoctorsRevenue = () => {
  const { user } = useAuth();
  
  // Estados principais
  const [state, setState] = useState<DoctorsRevenueState>({
    doctors: [],
    isLoading: true,
    error: null,
    currentPage: 1,
    totalPages: 0,
    totalCount: 0,
    pageSize: 50,
    hasMore: false,
    hasPrevious: false,
    appliedFilters: {},
    availableSpecialties: [],
    availableHospitals: [],
    executiveSummary: null
  });

  // Estados para formulários
  const [tempFilters, setTempFilters] = useState<RevenueFilters>({
    periodType: 'last_12_months'
  });

  /**
   * 📊 CARREGAR MÉDICOS AGREGADOS
   */
  const loadDoctorsAggregated = useCallback(async (filters: RevenueFilters = {}, page = 1) => {
    try {
      setState(prev => ({ ...prev, isLoading: true, error: null }));

      console.log('🔍 Carregando médicos agregados:', { filters, page });

      // Definir filtros padrão
      const finalFilters: RevenueFilters = {
        pageSize: 50,
        page,
        sortBy: 'total_revenue_12months_reais',
        sortOrder: 'desc',
        ...filters
      };

      // Buscar dados
      const result = await DoctorsRevenueService.getDoctorsAggregated(finalFilters);

      setState(prev => ({
        ...prev,
        doctors: result.doctors,
        currentPage: result.currentPage,
        totalPages: result.totalPages,
        totalCount: result.totalCount,
        pageSize: result.pageSize,
        hasMore: result.currentPage < result.totalPages,
        hasPrevious: result.currentPage > 1,
        appliedFilters: finalFilters,
        isLoading: false
      }));

      console.log(`✅ Carregados ${result.doctors.length} médicos agregados`);

    } catch (error) {
      console.error('❌ Erro ao carregar médicos agregados:', error);
      setState(prev => ({
        ...prev,
        error: error instanceof Error ? error.message : 'Erro desconhecido',
        isLoading: false
      }));
    }
  }, []);

  /**
   * 📈 CARREGAR RESUMO EXECUTIVO
   */
  const loadExecutiveSummary = useCallback(async (filters: RevenueFilters = {}) => {
    try {
      const summary = await DoctorsRevenueService.getExecutiveSummary(filters);
      setState(prev => ({ ...prev, executiveSummary: summary }));
    } catch (error) {
      console.error('❌ Erro ao carregar resumo executivo:', error);
    }
  }, []);

  /**
   * 📋 CARREGAR ESPECIALIDADES DISPONÍVEIS
   */
  const loadAvailableSpecialties = useCallback(async () => {
    try {
      const specialties = await DoctorsRevenueService.getAvailableSpecialties();
      setState(prev => ({ ...prev, availableSpecialties: specialties }));
    } catch (error) {
      console.error('❌ Erro ao carregar especialidades:', error);
    }
  }, []);

  /**
   * 🔄 APLICAR FILTROS
   */
  const applyFilters = useCallback(async (newFilters: RevenueFilters) => {
    await loadDoctorsAggregated(newFilters, 1);
    await loadExecutiveSummary(newFilters);
  }, [loadDoctorsAggregated, loadExecutiveSummary]);

  /**
   * 🔄 APLICAR FILTROS DOS FORMULÁRIOS
   */
  const applyTempFilters = useCallback(async () => {
    await applyFilters(tempFilters);
  }, [tempFilters, applyFilters]);

  /**
   * 📄 NAVEGAÇÃO DE PÁGINAS
   */
  const goToPage = useCallback(async (page: number) => {
    if (page >= 1 && page <= state.totalPages) {
      await loadDoctorsAggregated(state.appliedFilters, page);
    }
  }, [state.appliedFilters, state.totalPages, loadDoctorsAggregated]);

  const loadNextPage = useCallback(async () => {
    if (state.hasMore) {
      await goToPage(state.currentPage + 1);
    }
  }, [state.hasMore, state.currentPage, goToPage]);

  const loadPreviousPage = useCallback(async () => {
    if (state.hasPrevious) {
      await goToPage(state.currentPage - 1);
    }
  }, [state.hasPrevious, state.currentPage, goToPage]);

  /**
   * ✏️ EDITAR ESPECIALIDADE DO MÉDICO
   */
  const updateDoctorSpecialty = useCallback(async (doctorId: string, specialty: string) => {
    try {
      if (!user) throw new Error('Usuário não autenticado');

      setState(prev => ({ ...prev, isLoading: true }));

      await DoctorsRevenueService.updateDoctorSpecialty(doctorId, specialty, user.id);

      // Recarregar página atual para refletir mudanças
      await loadDoctorsAggregated(state.appliedFilters, state.currentPage);

      console.log('✅ Especialidade atualizada com sucesso');

    } catch (error) {
      console.error('❌ Erro ao atualizar especialidade:', error);
      setState(prev => ({ 
        ...prev, 
        error: error instanceof Error ? error.message : 'Erro ao atualizar especialidade',
        isLoading: false 
      }));
      throw error;
    }
  }, [user, state.appliedFilters, state.currentPage, loadDoctorsAggregated]);

  /**
   * 🔄 ATUALIZAR PÁGINA ATUAL
   */
  const refreshCurrentPage = useCallback(async () => {
    await loadDoctorsAggregated(state.appliedFilters, state.currentPage);
  }, [state.appliedFilters, state.currentPage, loadDoctorsAggregated]);

  /**
   * 🔄 RESETAR DADOS
   */
  const resetData = useCallback(() => {
    setState(prev => ({
      ...prev,
      doctors: [],
      currentPage: 1,
      totalPages: 0,
      totalCount: 0,
      hasMore: false,
      hasPrevious: false,
      appliedFilters: {},
      executiveSummary: null,
      error: null
    }));
    setTempFilters({ periodType: 'last_12_months' });
  }, []);

  /**
   * 🎛️ FUNÇÕES PARA CONTROLAR FILTROS TEMPORÁRIOS
   */
  const setTempFilter = useCallback(<K extends keyof RevenueFilters>(
    key: K, 
    value: RevenueFilters[K]
  ) => {
    setTempFilters(prev => ({ ...prev, [key]: value }));
  }, []);

  const clearTempFilters = useCallback(() => {
    setTempFilters({ periodType: 'last_12_months' });
  }, []);

  /**
   * 📊 DADOS CALCULADOS
   */
  const calculatedData = useMemo(() => {
    const { doctors, executiveSummary } = state;

    // Hospitais únicos dos médicos carregados
    const uniqueHospitals = Array.from(
      new Set(
        doctors
          .flatMap(d => d.hospital_ids.split(',').filter(id => id.trim()))
          .concat(
            doctors
              .flatMap(d => d.hospitals_list.split(' | ').filter(name => name.trim()))
              .map((name, index) => `hospital_${index}`)
          )
      )
    ).map((id, index) => {
      const doctor = doctors.find(d => d.hospital_ids.includes(id) || d.hospitals_list.includes(id));
      const hospitalName = doctor?.hospitals_list.split(' | ')[0] || `Hospital ${index + 1}`;
      return { id, name: hospitalName };
    });

    // Status de atividade
    const activeCount = doctors.filter(d => d.activity_status === 'ATIVO').length;
    const inactiveCount = doctors.filter(d => d.activity_status === 'INATIVO').length;
    const lessActiveCount = doctors.filter(d => d.activity_status === 'POUCO_ATIVO').length;

    // Médico com maior faturamento
    const topDoctor = doctors.length > 0 
      ? doctors.reduce((top, current) => 
          current.total_revenue_12months_reais > top.total_revenue_12months_reais ? current : top
        )
      : null;

    return {
      uniqueHospitals,
      activityBreakdown: {
        active: activeCount,
        inactive: inactiveCount,
        lessActive: lessActiveCount
      },
      topDoctor,
      hasData: doctors.length > 0,
      isEmpty: doctors.length === 0 && !state.isLoading,
      isFiltered: Object.keys(state.appliedFilters).some(key => 
        state.appliedFilters[key as keyof RevenueFilters] !== undefined &&
        state.appliedFilters[key as keyof RevenueFilters] !== 'all' &&
        state.appliedFilters[key as keyof RevenueFilters] !== ''
      )
    };
  }, [state.doctors, state.executiveSummary, state.isLoading, state.appliedFilters]);

  /**
   * 🚀 INICIALIZAÇÃO
   */
  useEffect(() => {
    const initializeData = async () => {
      await Promise.all([
        loadDoctorsAggregated({ periodType: 'last_12_months' }),
        loadExecutiveSummary({ periodType: 'last_12_months' }),
        loadAvailableSpecialties()
      ]);
    };

    initializeData();
  }, []);

  // ================================================================
  // RETORNO DO HOOK
  // ================================================================

  return {
    // Estados principais
    ...state,
    
    // Dados calculados
    ...calculatedData,
    
    // Filtros temporários
    tempFilters,
    setTempFilter,
    clearTempFilters,
    
    // Funções principais
    loadDoctorsAggregated,
    applyFilters,
    applyTempFilters,
    refreshCurrentPage,
    resetData,
    
    // Navegação
    goToPage,
    loadNextPage,
    loadPreviousPage,
    
    // Edição
    updateDoctorSpecialty,
    
    // Auxiliares
    loadExecutiveSummary,
    loadAvailableSpecialties
  };
}; 
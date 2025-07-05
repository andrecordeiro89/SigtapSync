import { useState, useEffect, useCallback } from 'react';
import { ProfessionalViewsService } from '../services/professionalViewsService';
import { 
  DoctorHospitalInfo, 
  FrontendDoctorHospitalSpecialty,
  FrontendDoctorsBySpecialty,
  FrontendHospitalsWithSpecialties,
  ProfessionalsFilters,
  ProfessionalsListData,
  ProfessionalsStats
} from '../types';

/**
 * 🩺 HOOK CUSTOMIZADO - VIEWS DE PROFISSIONAIS
 * Gerencia estado e carregamento de dados das views do Supabase
 */
export function useProfessionalViews() {
  // Estados principais
  const [professionals, setProfessionals] = useState<DoctorHospitalInfo[]>([]);
  const [optimizedProfessionals, setOptimizedProfessionals] = useState<FrontendDoctorHospitalSpecialty[]>([]);
  const [professionalsBySpecialty, setProfessionalsBySpecialty] = useState<FrontendDoctorsBySpecialty[]>([]);
  const [hospitalsWithSpecialties, setHospitalsWithSpecialties] = useState<FrontendHospitalsWithSpecialties[]>([]);
  const [stats, setStats] = useState<ProfessionalsStats | null>(null);
  
  // Estados de controle
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filters, setFilters] = useState<ProfessionalsFilters>({});
  const [currentPage, setCurrentPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [pageSize] = useState(50);
  
  // Estados auxiliares para filtros
  const [availableSpecialties, setAvailableSpecialties] = useState<string[]>([]);
  const [availableHospitals, setAvailableHospitals] = useState<{ id: string; name: string }[]>([]);
  const [availableRoles, setAvailableRoles] = useState<string[]>([]);
  const [availableDepartments, setAvailableDepartments] = useState<string[]>([]);

  /**
   * 📋 CARREGAR TODOS OS PROFISSIONAIS
   * Função principal para carregar dados com filtros e paginação
   */
  const loadProfessionals = useCallback(async (
    newFilters: ProfessionalsFilters = {},
    page: number = 1,
    resetData: boolean = false
  ) => {
    setIsLoading(true);
    setError(null);
    
    try {
      console.log('🔄 Carregando profissionais...', { filters: newFilters, page });
      
      const result = await ProfessionalViewsService.getAllProfessionals(
        newFilters,
        page,
        pageSize
      );
      
      if (result.success) {
        if (resetData || page === 1) {
          setProfessionals(result.data.doctors);
        } else {
          setProfessionals(prev => [...prev, ...result.data.doctors]);
        }
        
        setTotalCount(result.data.totalCount);
        setAvailableSpecialties(result.data.specialties);
        setAvailableHospitals(result.data.hospitals);
        setAvailableRoles(result.data.roles);
        setAvailableDepartments(result.data.departments);
        
        console.log(`✅ ${result.data.doctors.length} profissionais carregados`);
      } else {
        setError(result.error || 'Erro ao carregar profissionais');
        console.error('❌ Erro:', result.error);
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Erro desconhecido';
      setError(errorMessage);
      console.error('❌ Erro inesperado:', err);
    } finally {
      setIsLoading(false);
    }
  }, [pageSize]);

  /**
   * 🚀 CARREGAR PROFISSIONAIS OTIMIZADO
   * Versão otimizada usando view frontend
   */
  const loadOptimizedProfessionals = useCallback(async (
    newFilters: ProfessionalsFilters = {}
  ) => {
    setIsLoading(true);
    setError(null);
    
    try {
      console.log('🚀 Carregando profissionais otimizado...');
      
      const result = await ProfessionalViewsService.getProfessionalsOptimized(newFilters);
      
      if (result.success) {
        setOptimizedProfessionals(result.data);
        console.log(`✅ ${result.data.length} profissionais carregados (otimizado)`);
      } else {
        setError(result.error || 'Erro ao carregar profissionais otimizado');
        console.error('❌ Erro otimizado:', result.error);
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Erro desconhecido';
      setError(errorMessage);
      console.error('❌ Erro inesperado otimizado:', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  /**
   * 📊 CARREGAR PROFISSIONAIS POR ESPECIALIDADE
   * Dados agregados por especialidade
   */
  const loadProfessionalsBySpecialty = useCallback(async () => {
    try {
      console.log('📊 Carregando por especialidade...');
      
      const result = await ProfessionalViewsService.getDoctorsBySpecialty();
      
      if (result.success) {
        setProfessionalsBySpecialty(result.data);
        console.log(`✅ ${result.data.length} especialidades carregadas`);
      } else {
        console.error('❌ Erro especialidades:', result.error);
      }
    } catch (err) {
      console.error('❌ Erro inesperado especialidades:', err);
    }
  }, []);

  /**
   * 🏥 CARREGAR HOSPITAIS COM ESPECIALIDADES
   * Dados agregados por hospital
   */
  const loadHospitalsWithSpecialties = useCallback(async () => {
    try {
      console.log('🏥 Carregando hospitais...');
      
      const result = await ProfessionalViewsService.getHospitalsWithSpecialties();
      
      if (result.success) {
        setHospitalsWithSpecialties(result.data);
        console.log(`✅ ${result.data.length} hospitais carregados`);
      } else {
        console.error('❌ Erro hospitais:', result.error);
      }
    } catch (err) {
      console.error('❌ Erro inesperado hospitais:', err);
    }
  }, []);

  /**
   * 📈 CARREGAR ESTATÍSTICAS
   * Estatísticas gerais do sistema
   */
  const loadStats = useCallback(async () => {
    try {
      console.log('📈 Carregando estatísticas...');
      
      const result = await ProfessionalViewsService.getProfessionalsStats();
      
      if (result.success) {
        setStats(result.data);
        console.log('✅ Estatísticas carregadas');
      } else {
        console.error('❌ Erro estatísticas:', result.error);
      }
    } catch (err) {
      console.error('❌ Erro inesperado estatísticas:', err);
    }
  }, []);

  /**
   * 🔍 BUSCAR PROFISSIONAL POR ID
   * Busca específica de um profissional
   */
  const getProfessionalById = useCallback(async (doctorId: string): Promise<DoctorHospitalInfo | null> => {
    try {
      console.log(`🔍 Buscando profissional: ${doctorId}`);
      
      const result = await ProfessionalViewsService.getProfessionalById(doctorId);
      
      if (result.success) {
        console.log('✅ Profissional encontrado:', result.data?.doctor_name);
        return result.data;
      } else {
        console.error('❌ Erro busca por ID:', result.error);
        return null;
      }
    } catch (err) {
      console.error('❌ Erro inesperado busca por ID:', err);
      return null;
    }
  }, []);

  /**
   * 🔄 APLICAR FILTROS
   * Aplica novos filtros e recarrega dados
   */
  const applyFilters = useCallback(async (newFilters: ProfessionalsFilters) => {
    setFilters(newFilters);
    setCurrentPage(1);
    await loadProfessionals(newFilters, 1, true);
  }, [loadProfessionals]);

  /**
   * 📄 CARREGAR PRÓXIMA PÁGINA
   * Paginação - carrega mais dados
   */
  const loadNextPage = useCallback(async () => {
    if (isLoading) return;
    
    const nextPage = currentPage + 1;
    setCurrentPage(nextPage);
    await loadProfessionals(filters, nextPage, false);
  }, [isLoading, currentPage, filters, loadProfessionals]);

  /**
   * 🔄 RESETAR DADOS
   * Limpa todos os dados e recarrega
   */
  const resetData = useCallback(() => {
    setProfessionals([]);
    setOptimizedProfessionals([]);
    setProfessionalsBySpecialty([]);
    setHospitalsWithSpecialties([]);
    setStats(null);
    setError(null);
    setFilters({});
    setCurrentPage(1);
    setTotalCount(0);
  }, []);

  /**
   * 🎯 CARREGAR DADOS INICIAIS
   * Carrega dados básicos na inicialização
   */
  const loadInitialData = useCallback(async () => {
    await Promise.all([
      loadProfessionals({}, 1, true),
      loadProfessionalsBySpecialty(),
      loadHospitalsWithSpecialties(),
      loadStats()
    ]);
  }, [loadProfessionals, loadProfessionalsBySpecialty, loadHospitalsWithSpecialties, loadStats]);

  // Efeito para carregar dados iniciais
  useEffect(() => {
    loadInitialData();
  }, [loadInitialData]);

  // Valores calculados
  const hasMore = professionals.length < totalCount;
  const isFilterActive = Object.keys(filters).some(key => 
    filters[key as keyof ProfessionalsFilters] !== undefined && 
    filters[key as keyof ProfessionalsFilters] !== 'all' && 
    filters[key as keyof ProfessionalsFilters] !== ''
  );

  return {
    // Dados principais
    professionals,
    optimizedProfessionals,
    professionalsBySpecialty,
    hospitalsWithSpecialties,
    stats,
    
    // Estados de controle
    isLoading,
    error,
    filters,
    currentPage,
    totalCount,
    pageSize,
    hasMore,
    isFilterActive,
    
    // Dados auxiliares
    availableSpecialties,
    availableHospitals,
    availableRoles,
    availableDepartments,
    
    // Funções principais
    loadProfessionals,
    loadOptimizedProfessionals,
    loadProfessionalsBySpecialty,
    loadHospitalsWithSpecialties,
    loadStats,
    getProfessionalById,
    
    // Funções de controle
    applyFilters,
    loadNextPage,
    resetData,
    loadInitialData
  };
} 
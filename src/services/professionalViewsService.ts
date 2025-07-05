import { supabase } from '../lib/supabase';
import { 
  DoctorHospitalInfo, 
  FrontendDoctorHospitalSpecialty,
  FrontendDoctorsBySpecialty,
  FrontendHospitalsWithSpecialties,
  ProfessionalsFilters,
  ProfessionalsListData,
  ProfessionalsQueryResult,
  ProfessionalsStats
} from '../types';

/**
 * 🩺 SERVIÇO DE VIEWS DE PROFISSIONAIS
 * Integração completa com as views do Supabase para gerenciamento de médicos
 */
export class ProfessionalViewsService {

  /**
   * 📋 BUSCAR TODOS OS PROFISSIONAIS (View Principal)
   * Carrega dados da view doctor_hospital_info com filtros
   */
  static async getAllProfessionals(
    filters: ProfessionalsFilters = {},
    page: number = 1,
    limit: number = 50
  ): Promise<ProfessionalsQueryResult> {
    try {
      console.log('🩺 [SERVICE] Carregando profissionais da view doctor_hospital_info...');
      console.log('🔍 Filtros aplicados:', filters);

      // Construir query base
      let query = supabase
        .from('doctor_hospital_info')
        .select('*');

      // Aplicar filtros
      if (filters.hospitalId && filters.hospitalId !== 'all') {
        query = query.eq('hospital_id', filters.hospitalId);
      }

      if (filters.specialty && filters.specialty !== 'all') {
        query = query.or(`doctor_specialty.ilike.%${filters.specialty}%,doctor_secondary_specialties.cs.{${filters.specialty}}`);
      }

      if (filters.searchTerm) {
        const searchTerm = filters.searchTerm.toLowerCase();
        query = query.or(
          `doctor_name.ilike.%${searchTerm}%,doctor_crm.ilike.%${searchTerm}%,doctor_cns.ilike.%${searchTerm}%`
        );
      }

      if (filters.status && filters.status !== 'all') {
        switch (filters.status) {
          case 'active':
            query = query.eq('doctor_is_active', true).eq('link_is_active', true);
            break;
          case 'inactive':
            query = query.or('doctor_is_active.eq.false,link_is_active.eq.false');
            break;
          case 'sus_enabled':
            query = query.eq('doctor_is_sus_enabled', true);
            break;
        }
      }

      if (filters.role) {
        query = query.eq('link_role', filters.role);
      }

      if (filters.department) {
        query = query.eq('link_department', filters.department);
      }

      if (filters.isPrimaryHospital !== undefined) {
        query = query.eq('link_is_primary_hospital', filters.isPrimaryHospital);
      }

      // Aplicar ordenação
      const sortBy = filters.sortBy || 'name';
      const sortOrder = filters.sortOrder || 'asc';
      
      switch (sortBy) {
        case 'name':
          query = query.order('doctor_name', { ascending: sortOrder === 'asc' });
          break;
        case 'specialty':
          query = query.order('doctor_specialty', { ascending: sortOrder === 'asc' });
          break;
        case 'hospital':
          query = query.order('hospital_name', { ascending: sortOrder === 'asc' });
          break;
        case 'status':
          query = query.order('doctor_is_active', { ascending: sortOrder === 'desc' });
          break;
        default:
          query = query.order('doctor_name', { ascending: true });
      }

      // Aplicar paginação
      const offset = (page - 1) * limit;
      query = query.range(offset, offset + limit - 1);

      const { data: doctors, error } = await query;

      if (error) {
        console.error('❌ Erro ao carregar profissionais:', error);
        return { success: false, data: {} as ProfessionalsListData, error: error.message };
      }

      // Buscar dados auxiliares para filtros
      const [specialtiesData, hospitalsData, rolesData, departmentsData] = await Promise.all([
        this.getSpecialtiesList(),
        this.getHospitalsList(),
        this.getRolesList(),
        this.getDepartmentsList()
      ]);

      // Contar total sem paginação
      const { count: totalCount } = await supabase
        .from('doctor_hospital_info')
        .select('*', { count: 'exact', head: true });

      const result: ProfessionalsListData = {
        doctors: doctors || [],
        totalCount: totalCount || 0,
        filteredCount: doctors?.length || 0,
        specialties: specialtiesData,
        hospitals: hospitalsData,
        roles: rolesData,
        departments: departmentsData
      };

      console.log(`✅ ${doctors?.length || 0} profissionais carregados`);
      return { success: true, data: result };

    } catch (error) {
      console.error('❌ Erro inesperado no serviço de profissionais:', error);
      return { 
        success: false, 
        data: {} as ProfessionalsListData, 
        error: error instanceof Error ? error.message : 'Erro desconhecido' 
      };
    }
  }

  /**
   * 📊 BUSCAR PROFISSIONAIS OTIMIZADO (View Frontend)
   * Usa view frontend_doctor_hospital_speciality para performance
   */
  static async getProfessionalsOptimized(
    filters: ProfessionalsFilters = {}
  ): Promise<{ success: boolean; data: FrontendDoctorHospitalSpecialty[]; error?: string }> {
    try {
      console.log('🚀 [SERVICE] Carregando profissionais otimizada...');

      let query = supabase
        .from('frontend_doctor_hospital_speciality')
        .select('*');

      // Aplicar filtros básicos
      if (filters.hospitalId && filters.hospitalId !== 'all') {
        query = query.eq('hospital_id', filters.hospitalId);
      }

      if (filters.specialty && filters.specialty !== 'all') {
        query = query.or(`primary_specialty.ilike.%${filters.specialty}%,secondary_specialties.cs.{${filters.specialty}}`);
      }

      if (filters.searchTerm) {
        query = query.ilike('doctor_name', `%${filters.searchTerm}%`);
      }

      if (filters.status === 'active') {
        query = query.eq('doctor_active', true).eq('link_active', true);
      } else if (filters.status === 'inactive') {
        query = query.or('doctor_active.eq.false,link_active.eq.false');
      }

      // Ordenação
      query = query.order('doctor_name', { ascending: true });

      const { data, error } = await query;

      if (error) {
        console.error('❌ Erro na consulta otimizada:', error);
        return { success: false, data: [], error: error.message };
      }

      console.log(`✅ ${data?.length || 0} profissionais carregados (otimizado)`);
      return { success: true, data: data || [] };

    } catch (error) {
      console.error('❌ Erro na consulta otimizada:', error);
      return { 
        success: false, 
        data: [], 
        error: error instanceof Error ? error.message : 'Erro desconhecido' 
      };
    }
  }

  /**
   * 📈 BUSCAR PROFISSIONAIS POR ESPECIALIDADE
   * Usa view frontend_doctors_by_speciality
   */
  static async getDoctorsBySpecialty(): Promise<{ success: boolean; data: FrontendDoctorsBySpecialty[]; error?: string }> {
    try {
      console.log('📊 [SERVICE] Carregando médicos por especialidade...');

      const { data, error } = await supabase
        .from('frontend_doctors_by_speciality')
        .select('*')
        .order('doctor_count', { ascending: false });

      if (error) {
        console.error('❌ Erro ao carregar por especialidade:', error);
        return { success: false, data: [], error: error.message };
      }

      console.log(`✅ ${data?.length || 0} especialidades carregadas`);
      return { success: true, data: data || [] };

    } catch (error) {
      console.error('❌ Erro na consulta por especialidade:', error);
      return { 
        success: false, 
        data: [], 
        error: error instanceof Error ? error.message : 'Erro desconhecido' 
      };
    }
  }

  /**
   * 🏥 BUSCAR HOSPITAIS COM ESPECIALIDADES
   * Usa view frontend_hospitals_with_specialties
   */
  static async getHospitalsWithSpecialties(): Promise<{ success: boolean; data: FrontendHospitalsWithSpecialties[]; error?: string }> {
    try {
      console.log('🏥 [SERVICE] Carregando hospitais com especialidades...');

      const { data, error } = await supabase
        .from('frontend_hospitals_with_specialties')
        .select('*')
        .order('doctor_count', { ascending: false });

      if (error) {
        console.error('❌ Erro ao carregar hospitais:', error);
        return { success: false, data: [], error: error.message };
      }

      console.log(`✅ ${data?.length || 0} hospitais carregados`);
      return { success: true, data: data || [] };

    } catch (error) {
      console.error('❌ Erro na consulta de hospitais:', error);
      return { 
        success: false, 
        data: [], 
        error: error instanceof Error ? error.message : 'Erro desconhecido' 
      };
    }
  }

  /**
   * 📊 BUSCAR ESTATÍSTICAS GERAIS
   * Calcula estatísticas agregadas dos profissionais
   */
  static async getProfessionalsStats(): Promise<{ success: boolean; data: ProfessionalsStats; error?: string }> {
    try {
      console.log('📊 [SERVICE] Calculando estatísticas de profissionais...');

      const [doctorsResult, specialtiesResult, hospitalsResult] = await Promise.all([
        this.getAllProfessionals({}, 1, 1000), // Buscar todos para estatísticas
        this.getDoctorsBySpecialty(),
        this.getHospitalsWithSpecialties()
      ]);

      if (!doctorsResult.success) {
        return { success: false, data: {} as ProfessionalsStats, error: doctorsResult.error };
      }

      const doctors = doctorsResult.data.doctors;

      const stats: ProfessionalsStats = {
        totalDoctors: doctors.length,
        activeDoctors: doctors.filter(d => d.doctor_is_active && d.link_is_active).length,
        inactiveDoctors: doctors.filter(d => !d.doctor_is_active || !d.link_is_active).length,
        susEnabledDoctors: doctors.filter(d => d.doctor_is_sus_enabled).length,
        totalHospitals: hospitalsResult.success ? hospitalsResult.data.length : 0,
        activeHospitals: hospitalsResult.success ? 
          hospitalsResult.data.filter(h => h.doctor_count > 0).length : 0,
        totalSpecialties: specialtiesResult.success ? specialtiesResult.data.length : 0,
        doctorsBySpecialty: specialtiesResult.success ? 
          specialtiesResult.data.map(s => ({ specialty: s.specialty, count: s.doctor_count })) : [],
        doctorsByHospital: hospitalsResult.success ? 
          hospitalsResult.data.map(h => ({ 
            hospitalId: h.hospital_id, 
            hospitalName: h.hospital_name, 
            count: h.doctor_count 
          })) : []
      };

      console.log('✅ Estatísticas calculadas:', stats);
      return { success: true, data: stats };

    } catch (error) {
      console.error('❌ Erro ao calcular estatísticas:', error);
      return { 
        success: false, 
        data: {} as ProfessionalsStats, 
        error: error instanceof Error ? error.message : 'Erro desconhecido' 
      };
    }
  }

  /**
   * 🔍 BUSCAR PROFISSIONAL POR ID
   * Busca detalhes específicos de um profissional
   */
  static async getProfessionalById(doctorId: string): Promise<{ success: boolean; data: DoctorHospitalInfo | null; error?: string }> {
    try {
      console.log(`🔍 [SERVICE] Buscando profissional ID: ${doctorId}`);

      const { data, error } = await supabase
        .from('doctor_hospital_info')
        .select('*')
        .eq('doctor_id', doctorId)
        .single();

      if (error) {
        console.error('❌ Erro ao buscar profissional:', error);
        return { success: false, data: null, error: error.message };
      }

      console.log('✅ Profissional encontrado:', data?.doctor_name);
      return { success: true, data: data || null };

    } catch (error) {
      console.error('❌ Erro na busca por ID:', error);
      return { 
        success: false, 
        data: null, 
        error: error instanceof Error ? error.message : 'Erro desconhecido' 
      };
    }
  }

  // === MÉTODOS AUXILIARES ===

  private static async getSpecialtiesList(): Promise<string[]> {
    try {
      const { data } = await supabase
        .from('frontend_doctors_by_speciality')
        .select('specialty')
        .order('specialty');
      
      return data?.map(item => item.specialty) || [];
    } catch (error) {
      console.warn('⚠️ Erro ao carregar especialidades:', error);
      return [];
    }
  }

  private static async getHospitalsList(): Promise<{ id: string; name: string }[]> {
    try {
      const { data } = await supabase
        .from('frontend_hospitals_with_specialties')
        .select('hospital_id, hospital_name')
        .order('hospital_name');
      
      return data?.map(item => ({ id: item.hospital_id, name: item.hospital_name })) || [];
    } catch (error) {
      console.warn('⚠️ Erro ao carregar hospitais:', error);
      return [];
    }
  }

  private static async getRolesList(): Promise<string[]> {
    try {
      const { data } = await supabase
        .from('doctor_hospital_info')
        .select('link_role')
        .not('link_role', 'is', null)
        .order('link_role');
      
      const uniqueRoles = [...new Set(data?.map(item => item.link_role).filter(Boolean))];
      return uniqueRoles || [];
    } catch (error) {
      console.warn('⚠️ Erro ao carregar roles:', error);
      return [];
    }
  }

  private static async getDepartmentsList(): Promise<string[]> {
    try {
      const { data } = await supabase
        .from('doctor_hospital_info')
        .select('link_department')
        .not('link_department', 'is', null)
        .order('link_department');
      
      const uniqueDepartments = [...new Set(data?.map(item => item.link_department).filter(Boolean))];
      return uniqueDepartments || [];
    } catch (error) {
      console.warn('⚠️ Erro ao carregar departamentos:', error);
      return [];
    }
  }
} 
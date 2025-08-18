import { supabase } from '../lib/supabase';
import { 
  MedicalDoctor, 
  DoctorStats, 
  HospitalMedicalStats, 
  MedicalSpecialty,
  MedicalFilters 
} from '../types';

// ===== INTERFACES ESPECÍFICAS PARA CRUD =====

export interface DoctorCreateData {
  name: string;
  cns: string;
  crm: string;
  specialty: string;
  sub_specialty?: string;
  email?: string;
  phone?: string;
  birth_date?: string;
  gender?: 'M' | 'F';
  notes?: string;
}

export interface DoctorUpdateData {
  name?: string;
  crm?: string;
  specialty?: string;
  sub_specialty?: string;
  email?: string;
  phone?: string;
  birth_date?: string;
  gender?: 'M' | 'F';
  notes?: string;
  is_active?: boolean;
}

export interface DoctorHospitalLink {
  doctor_id: string;
  hospital_id: string;
  role?: string;
  department?: string;
  is_primary_hospital?: boolean;
  can_authorize_procedures?: boolean;
  can_request_procedures?: boolean;
  can_be_responsible?: boolean;
}

export interface CrudResult<T> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

// ===== CLASSE PRINCIPAL CRUD MÉDICOS =====

export class DoctorsCrudService {

  // ===== MÉTODOS DE LEITURA (READ) =====

  /**
   * Busca todos os médicos com dados completos usando tabela doctor_hospital
   * 🆕 AGRUPAMENTO: Médicos com múltiplos hospitais são agrupados corretamente
   */
  static async getAllDoctors(filters?: MedicalFilters): Promise<CrudResult<MedicalDoctor[]>> {
    try {
      console.log('🩺 [REAL] Buscando TODOS os médicos de TODOS os hospitais usando tabela doctor_hospital...');
      
      // 1. BUSCAR TODOS OS MÉDICOS COM SUAS ASSOCIAÇÕES HOSPITALARES
      let mainQuery = supabase
        .from('doctor_hospital')
        .select(`
          doctor_cns,
          hospital_id,
          role,
          department,
          is_primary_hospital,
          is_active,
          doctors (
            id,
            cns,
            crm,
            name,
            specialty,
            is_active,
            created_at,
            updated_at
          ),
          hospitals (
            id,
            name,
            cnpj
          )
        `);

      // Aplicar filtros se necessário
      if (filters?.isActive !== undefined) {
        mainQuery = mainQuery.eq('is_active', filters.isActive);
      }
      if (filters?.hospitalIds && filters.hospitalIds.length > 0 && !filters.hospitalIds.includes('ALL')) {
        mainQuery = mainQuery.in('hospital_id', filters.hospitalIds);
      }

      // Ordenar por uma coluna local para evitar erro de ordenação por relação
      const { data: doctorHospitalData, error } = await mainQuery.order('doctor_cns');

      if (error) {
        console.error('❌ Erro ao buscar médicos da tabela doctor_hospital:', error);
        return {
          success: false,
          error: error.message
        };
      }

      // Se o join aninhado não veio (FK não configurada no PostgREST), fazer "join manual" usando as tabelas base
      let effectiveRows: any[] = doctorHospitalData || [];
      const allRowsHaveNullDoctor = effectiveRows.length > 0 && effectiveRows.every(r => !(r as any).doctors);
      if (effectiveRows.length > 0 && allRowsHaveNullDoctor) {
        console.warn('ℹ️ Join aninhado indisponível. Fazendo join manual com as tabelas doctors/hospitals.');

        const doctorCnsSet = Array.from(new Set((effectiveRows as any[]).map(r => r.doctor_cns).filter(Boolean)));
        const hospitalIdSet = Array.from(new Set((effectiveRows as any[]).map(r => r.hospital_id).filter(Boolean)));

        const [doctorsRes, hospitalsRes] = await Promise.all([
          supabase.from('doctors').select('id, cns, crm, name, specialty, is_active, created_at, updated_at').in('cns', doctorCnsSet),
          supabase.from('hospitals').select('id, name, cnpj').in('id', hospitalIdSet)
        ]);

        const doctorsByCns = new Map<string, any>((doctorsRes.data || []).map(d => [d.cns, d]));
        const hospitalsById = new Map<string, any>((hospitalsRes.data || []).map(h => [h.id, h]));

        effectiveRows = effectiveRows.map((r: any) => {
          const d = doctorsByCns.get(r.doctor_cns);
          const h = hospitalsById.get(r.hospital_id);
          return {
            ...r,
            doctors: d ? d : null,
            hospitals: h ? h : null
          };
        }).filter((r: any) => r.doctors && r.hospitals);

        if (effectiveRows.length === 0) {
          console.warn('⚠️ Join manual não encontrou correspondências. Retornando lista vazia.');
          return { success: true, data: [], message: 'Nenhum médico encontrado' };
        }
      }

      // 2. AGRUPAR MÉDICOS POR CNS (evitar duplicação)
      const doctorsMap = new Map<string, MedicalDoctor & { hospitals: string[]; hospitalIds?: string[] }>();

      effectiveRows.forEach(record => {
        const doctor = record.doctors as any;
        const hospital = record.hospitals as any;
        
        if (!doctor || !doctor.cns) return;

        const existingDoctor = doctorsMap.get(doctor.cns);
        const hospitalName = hospital?.name || 'Hospital não identificado';

        if (existingDoctor) {
          // Médico já existe, adicionar hospital se não estiver na lista
          if (!existingDoctor.hospitals.includes(hospitalName)) {
            existingDoctor.hospitals.push(hospitalName);
          }
          // Manter também a lista de IDs de hospitais para consumo posterior
          if (!existingDoctor.hospitalIds) existingDoctor.hospitalIds = [];
          if (hospital?.id && !existingDoctor.hospitalIds.includes(hospital.id)) {
            existingDoctor.hospitalIds.push(hospital.id);
          }
        } else {
          // Primeiro registro do médico
          doctorsMap.set(doctor.cns, {
            id: doctor.id,
            cns: doctor.cns,
            crm: doctor.crm || '',
            name: doctor.name || '',
            speciality: doctor.specialty || '',
            hospitalId: hospital?.id || '',
            hospitalName: hospitalName,
            hospitals: [hospitalName],
            hospitalIds: hospital?.id ? [hospital.id] : [],
            isActive: doctor.is_active !== false,
            createdAt: doctor.created_at || new Date().toISOString(),
            updatedAt: doctor.updated_at || new Date().toISOString()
          });
        }
      });

      // 3. CONVERTER PARA ARRAY E APLICAR FILTROS ADICIONAIS
      let doctors = Array.from(doctorsMap.values());

      // Aplicar filtros de especialidade
      if (filters?.specialties && filters.specialties.length > 0) {
        doctors = doctors.filter(doc => 
          filters.specialties!.some(specialty => 
            doc.speciality?.toLowerCase().includes(specialty.toLowerCase())
          )
        );
      }

      // Aplicar filtro de busca textual
      if (filters?.searchTerm) {
        const searchTerm = filters.searchTerm.toLowerCase();
        doctors = doctors.filter(doc =>
          doc.name?.toLowerCase().includes(searchTerm) ||
          doc.crm?.toLowerCase().includes(searchTerm) ||
          doc.speciality?.toLowerCase().includes(searchTerm) ||
          doc.cns?.includes(searchTerm)
        );
      }

      // Aplicar filtro de status ativo
      if (filters?.isActive !== undefined) {
        doctors = doctors.filter(doc => doc.isActive === filters.isActive);
      }

      console.log(`✅ AGRUPAMENTO COMPLETO: ${doctorHospitalData.length} registros → ${doctors.length} médicos únicos`);
      console.log(`📋 Médicos com múltiplos hospitais: ${doctors.filter(d => d.hospitals && d.hospitals.length > 1).length}`);

      return {
        success: true,
        data: doctors,
        message: `${doctors.length} médicos únicos carregados de ${doctorHospitalData.length} associações hospitalares`
      };

    } catch (error) {
      console.error('Erro inesperado ao buscar médicos:', error);
      return {
        success: false,
        error: `Erro inesperado: ${error}`
      };
    }
  }

  /**
   * Retorna TODAS as linhas de doctor_hospital sem agrupamento (1 linha por vínculo médico↔hospital)
   * Garante que o total retornado == total de registros em doctor_hospital, mesmo se faltarem FKs
   */
  static async getAllDoctorHospitalRaw(): Promise<CrudResult<MedicalDoctor[]>> {
    try {
      console.log('📋 [REAL] Buscando linhas brutas de doctor_hospital (sem agrupamento)...');

      // 1) Buscar linhas base sem relações para não perder registros
      const { data: baseRows, error: baseErr } = await supabase
        .from('doctor_hospital')
        .select('doctor_cns,hospital_id,role,department,is_primary_hospital,is_active,doctor_id')
        .order('doctor_cns');

      if (baseErr) {
        return { success: false, error: baseErr.message };
      }
      const rows = baseRows || [];
      if (rows.length === 0) {
        return { success: true, data: [], message: 'Sem vínculos médico-hospital' };
      }

      // 2) Carregar mapas auxiliares (opcional) para enriquecer nomes
      const doctorCnsSet = Array.from(new Set(rows.map(r => r.doctor_cns).filter(Boolean)));
      const hospitalIdSet = Array.from(new Set(rows.map(r => r.hospital_id).filter(Boolean)));

      const [{ data: doctors }, { data: hospitals }] = await Promise.all([
        supabase.from('doctors').select('id,cns,crm,name,specialty').in('cns', doctorCnsSet),
        supabase.from('hospitals').select('id,name').in('id', hospitalIdSet)
      ]);

      const byCns = new Map<string, any>((doctors || []).map(d => [d.cns, d]));
      const byHosp = new Map<string, any>((hospitals || []).map(h => [h.id, h]));

      // 3) Mapear cada linha para um registro exibível (1:1)
      const result: MedicalDoctor[] = rows.map((r: any) => {
        const d = byCns.get(r.doctor_cns);
        const h = byHosp.get(r.hospital_id);
        return {
          id: d?.id || `${r.doctor_cns || 'NO_CNS'}::${r.hospital_id || 'NO_HOSP'}`,
          cns: r.doctor_cns || '',
          crm: d?.crm || '',
          name: d?.name || r.doctor_cns || 'Médico não identificado',
          speciality: d?.specialty || '',
          hospitalId: r.hospital_id || '',
          hospitalName: h?.name || r.hospital_id || 'Hospital não identificado',
          hospitals: [h?.name || r.hospital_id || 'Hospital não identificado'],
          isActive: r.is_primary_hospital != null ? r.is_primary_hospital : true,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        } as MedicalDoctor;
      });

      console.log(`✅ doctor_hospital raw: ${rows.length} vínculos → ${result.length} linhas para exibição`);
      return { success: true, data: result, message: `${result.length} vínculos` };
    } catch (error) {
      console.error('❌ Erro em getAllDoctorHospitalRaw:', error);
      return { success: false, error: `Erro inesperado: ${error}` };
    }
  }

  /**
   * Busca médico por ID
   */
  static async getDoctorById(id: string): Promise<CrudResult<MedicalDoctor>> {
    try {
      console.log('🩺 [REAL] Buscando médico por ID:', id);

      const { data, error } = await supabase
        .from('doctor_hospital_info')
        .select('*')
        .eq('doctor_id', id)
        .single();

      if (error) {
        return {
          success: false,
          error: error.message
        };
      }

      if (!data) {
        return {
          success: false,
          error: 'Médico não encontrado'
        };
      }

      const doctor: MedicalDoctor = {
        id: data.doctor_id,
        cns: data.doctor_cns,
        crm: data.doctor_crm,
        name: data.doctor_name,
        speciality: data.doctor_specialty,
        hospitalId: data.hospital_id || '',
        hospitalName: data.hospital_name || 'Sem vínculo',
        isActive: true, // Assumir ativo até campo estar disponível
        createdAt: data.doctor_created_at || new Date().toISOString(),
        updatedAt: data.doctor_updated_at || new Date().toISOString()
      };

      return {
        success: true,
        data: doctor
      };

    } catch (error) {
      console.error('Erro ao buscar médico por ID:', error);
      return {
        success: false,
        error: `Erro inesperado: ${error}`
      };
    }
  }

  /**
   * Busca estatísticas de médicos
   */
  static async getDoctorStats(filters?: MedicalFilters): Promise<CrudResult<DoctorStats[]>> {
    try {
      console.log('📊 [REAL] Buscando estatísticas de médicos...');

      let query = supabase
        .from('doctor_hospital_info')
        .select('*');

      // Aplicar filtros
      if (filters?.hospitalIds && filters.hospitalIds.length > 0) {
        query = query.in('hospital_id', filters.hospitalIds);
      }

      if (filters?.specialties && filters.specialties.length > 0) {
        query = query.in('doctor_specialty', filters.specialties);
      }

      if (filters?.searchTerm) {
        query = query.or(`doctor_name.ilike.%${filters.searchTerm}%,doctor_crm.ilike.%${filters.searchTerm}%`);
      }

      const { data, error } = await query.order('doctor_name', { ascending: true });

      if (error) {
        console.error('Erro ao buscar estatísticas:', error);
        return {
          success: false,
          error: error.message
        };
      }

      // Mapear dados com valores padrão para estatísticas
      const stats: DoctorStats[] = (data || []).map((row, index) => ({
        id: row.doctor_id,
        name: row.doctor_name,
        crm: row.doctor_crm,
        cns: row.doctor_cns,
        speciality: row.doctor_specialty,
        hospitalId: row.hospital_id || '',
        hospitalName: row.hospital_name || 'Sem vínculo',
        aihCount: Math.floor(Math.random() * 50) + 10, // Valores simulados
        procedureCount: Math.floor(Math.random() * 150) + 30,
        revenue: Math.floor(Math.random() * 80000) + 40000,
        avgConfidenceScore: Math.floor(Math.random() * 20) + 80,
        avgProcessingTime: Math.random() * 3 + 1,
        approvalRate: Math.floor(Math.random() * 20) + 80,
        lastActivity: new Date(Date.now() - Math.random() * 30 * 24 * 60 * 60 * 1000).toISOString(),
        isActive: true // Assumir ativo até campo estar disponível
      }));

      return {
        success: true,
        data: stats,
        message: `Estatísticas de ${stats.length} médicos carregadas`
      };

    } catch (error) {
      console.error('Erro ao buscar estatísticas de médicos:', error);
      return {
        success: false,
        error: `Erro inesperado: ${error}`
      };
    }
  }

  // ===== MÉTODOS DE CRIAÇÃO (CREATE) =====

  /**
   * Cria novo médico
   */
  static async createDoctor(doctorData: DoctorCreateData, userId?: string): Promise<CrudResult<MedicalDoctor>> {
    try {
      console.log('➕ [REAL] Criando novo médico:', doctorData.name);

      // Validações básicas
      if (!doctorData.name || !doctorData.cns || !doctorData.crm || !doctorData.specialty) {
        return {
          success: false,
          error: 'Campos obrigatórios: nome, CNS, CRM e especialidade'
        };
      }

      // Verificar se CNS já existe
      const { data: existingDoctor } = await supabase
        .from('doctors')
        .select('id')
        .eq('cns', doctorData.cns)
        .single();

      if (existingDoctor) {
        return {
          success: false,
          error: 'Já existe um médico com este CNS'
        };
      }

      // Inserir médico
      const { data, error } = await supabase
        .from('doctors')
        .insert([{
          ...doctorData,
          created_by: userId
        }])
        .select()
        .single();

      if (error) {
        console.error('Erro ao criar médico:', error);
        return {
          success: false,
          error: error.message
        };
      }

      // Retornar médico criado no formato esperado
      const newDoctor: MedicalDoctor = {
        id: data.id,
        cns: data.cns,
        crm: data.crm,
        name: data.name,
        speciality: data.specialty,
        hospitalId: '',
        hospitalName: 'Sem vínculo',
        isActive: data.is_active,
        createdAt: data.created_at,
        updatedAt: data.updated_at
      };

      return {
        success: true,
        data: newDoctor,
        message: 'Médico criado com sucesso'
      };

    } catch (error) {
      console.error('Erro ao criar médico:', error);
      return {
        success: false,
        error: `Erro inesperado: ${error}`
      };
    }
  }

  // ===== MÉTODOS DE ATUALIZAÇÃO (UPDATE) =====

  /**
   * Atualiza dados do médico
   */
  static async updateDoctor(
    doctorId: string, 
    updateData: DoctorUpdateData, 
    userId?: string,
    canEditCNS: boolean = false
  ): Promise<CrudResult<MedicalDoctor>> {
    try {
      console.log('✏️ [REAL] Atualizando médico:', doctorId);

      // Preparar dados para atualização
      const dataToUpdate: any = {
        ...updateData,
        updated_by: userId
      };

      // Remover CNS se usuário não tem permissão
      if (!canEditCNS && 'cns' in dataToUpdate) {
        delete dataToUpdate.cns;
      }

      const { data, error } = await supabase
        .from('doctors')
        .update(dataToUpdate)
        .eq('id', doctorId)
        .select()
        .single();

      if (error) {
        console.error('Erro ao atualizar médico:', error);
        return {
          success: false,
          error: error.message
        };
      }

      if (!data) {
        return {
          success: false,
          error: 'Médico não encontrado'
        };
      }

      // Retornar médico atualizado
      const updatedDoctor: MedicalDoctor = {
        id: data.id,
        cns: data.cns,
        crm: data.crm,
        name: data.name,
        speciality: data.specialty,
        hospitalId: '',
        hospitalName: 'Atualizado',
        isActive: data.is_active,
        createdAt: data.created_at,
        updatedAt: data.updated_at
      };

      return {
        success: true,
        data: updatedDoctor,
        message: 'Médico atualizado com sucesso'
      };

    } catch (error) {
      console.error('Erro ao atualizar médico:', error);
      return {
        success: false,
        error: `Erro inesperado: ${error}`
      };
    }
  }

  // ===== MÉTODOS DE EXCLUSÃO (DELETE) =====

  /**
   * Desativa médico (soft delete)
   */
  static async deactivateDoctor(doctorId: string, userId?: string): Promise<CrudResult<boolean>> {
    try {
      console.log('🚫 [REAL] Desativando médico:', doctorId);

      const { error } = await supabase
        .from('doctors')
        .update({ 
          is_active: false,
          updated_by: userId
        })
        .eq('id', doctorId);

      if (error) {
        console.error('Erro ao desativar médico:', error);
        return {
          success: false,
          error: error.message
        };
      }

      return {
        success: true,
        data: true,
        message: 'Médico desativado com sucesso'
      };

    } catch (error) {
      console.error('Erro ao desativar médico:', error);
      return {
        success: false,
        error: `Erro inesperado: ${error}`
      };
    }
  }

  /**
   * Remove médico permanentemente (hard delete)
   */
  static async deleteDoctor(doctorId: string): Promise<CrudResult<boolean>> {
    try {
      console.log('🗑️ [REAL] Removendo médico permanentemente:', doctorId);

      const { error } = await supabase
        .from('doctors')
        .delete()
        .eq('id', doctorId);

      if (error) {
        console.error('Erro ao remover médico:', error);
        return {
          success: false,
          error: error.message
        };
      }

      return {
        success: true,
        data: true,
        message: 'Médico removido permanentemente'
      };

    } catch (error) {
      console.error('Erro ao remover médico:', error);
      return {
        success: false,
        error: `Erro inesperado: ${error}`
      };
    }
  }

  // ===== MÉTODOS DE RELACIONAMENTO HOSPITAL =====

  /**
   * Vincula médico a hospital
   */
  static async linkDoctorToHospital(linkData: DoctorHospitalLink, userId?: string): Promise<CrudResult<boolean>> {
    try {
      console.log('🔗 [REAL] Vinculando médico ao hospital...');

      // Buscar CNS do médico
      const { data: doctorData } = await supabase
        .from('doctors')
        .select('cns')
        .eq('id', linkData.doctor_id)
        .single();

      if (!doctorData) {
        return {
          success: false,
          error: 'Médico não encontrado'
        };
      }

      const { error } = await supabase
        .from('doctor_hospital')
        .insert([{
          ...linkData,
          doctor_cns: doctorData.cns,
          created_by: userId
        }]);

      if (error) {
        console.error('Erro ao vincular médico:', error);
        return {
          success: false,
          error: error.message
        };
      }

      return {
        success: true,
        data: true,
        message: 'Médico vinculado ao hospital com sucesso'
      };

    } catch (error) {
      console.error('Erro ao vincular médico:', error);
      return {
        success: false,
        error: `Erro inesperado: ${error}`
      };
    }
  }

  /**
   * Remove vínculo médico-hospital
   */
  static async unlinkDoctorFromHospital(doctorId: string, hospitalId: string): Promise<CrudResult<boolean>> {
    try {
      console.log('🔓 [REAL] Removendo vínculo médico-hospital...');

      const { error } = await supabase
        .from('doctor_hospital')
        .delete()
        .eq('doctor_id', doctorId)
        .eq('hospital_id', hospitalId);

      if (error) {
        console.error('Erro ao remover vínculo:', error);
        return {
          success: false,
          error: error.message
        };
      }

      return {
        success: true,
        data: true,
        message: 'Vínculo removido com sucesso'
      };

    } catch (error) {
      console.error('Erro ao remover vínculo:', error);
      return {
        success: false,
        error: `Erro inesperado: ${error}`
      };
    }
  }

  // ===== MÉTODOS DE ESPECIALIDADES =====

  /**
   * Busca especialidades médicas
   */
  static async getMedicalSpecialties(): Promise<CrudResult<MedicalSpecialty[]>> {
    try {
      console.log('🩺 [REAL] Buscando especialidades médicas...');

      const { data, error } = await supabase
        .from('frontend_doctors_by_specialty')
        .select('*')
        .order('specialty', { ascending: true });

      if (error) {
        console.error('Erro ao buscar especialidades:', error);
        return {
          success: false,
          error: error.message
        };
      }

      const specialties: MedicalSpecialty[] = (data || []).map(row => ({
        id: row.specialty, // Usando specialty como ID
        name: row.specialty,
        code: row.specialty?.substring(0, 4).toUpperCase() || 'SPEC',
        description: `Especialidade em ${row.specialty}`,
        doctorCount: row.doctor_count || Math.floor(Math.random() * 20) + 5, // Usar doctor_count ou valor simulado
        averageRevenue: Math.floor(Math.random() * 50000) + 50000,
        totalProcedures: Math.floor(Math.random() * 200) + 50
      }));

      return {
        success: true,
        data: specialties,
        message: `${specialties.length} especialidades carregadas`
      };

    } catch (error) {
      console.error('Erro ao buscar especialidades:', error);
      return {
        success: false,
        error: `Erro inesperado: ${error}`
      };
    }
  }

  // ===== MÉTODOS DE HOSPITAIS =====

  /**
   * Busca estatísticas por hospital
   */
  static async getHospitalMedicalStats(): Promise<CrudResult<HospitalMedicalStats[]>> {
    try {
      console.log('🏥 [REAL] Buscando estatísticas por hospital...');

      const { data, error } = await supabase
        .from('doctor_hospital_info')
        .select('hospital_id, hospital_name')
        .order('hospital_name', { ascending: true });

      if (error) {
        console.error('Erro ao buscar estatísticas hospitalares:', error);
        return {
          success: false,
          error: error.message
        };
      }

      // Agrupar por hospital e calcular estatísticas
      const hospitalMap = new Map<string, HospitalMedicalStats>();
      
      (data || []).forEach(row => {
        const hospitalId = row.hospital_id;
        if (!hospitalMap.has(hospitalId)) {
          hospitalMap.set(hospitalId, {
            hospitalId: hospitalId,
            hospitalName: row.hospital_name,
            totalDoctors: 0,
            specialties: [],
            totalRevenue: Math.floor(Math.random() * 500000) + 200000,
            totalProcedures: Math.floor(Math.random() * 1000) + 500,
            avgApprovalRate: Math.floor(Math.random() * 20) + 80,
            avgProcessingTime: Math.random() * 2 + 1,
            doctorDistribution: []
          });
        }
        
        const hospital = hospitalMap.get(hospitalId)!;
        hospital.totalDoctors += 1;
      });

      const hospitalStats: HospitalMedicalStats[] = Array.from(hospitalMap.values());

      return {
        success: true,
        data: hospitalStats,
        message: `Estatísticas de ${hospitalStats.length} hospitais carregadas`
      };

    } catch (error) {
      console.error('Erro ao buscar estatísticas hospitalares:', error);
      return {
        success: false,
        error: `Erro inesperado: ${error}`
      };
    }
  }

  // ===== MÉTODOS UTILITÁRIOS =====

  /**
   * Valida dados do médico
   */
  static validateDoctorData(data: DoctorCreateData | DoctorUpdateData): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];

    // Validar nome
    if ('name' in data && data.name && data.name.length < 2) {
      errors.push('Nome deve ter pelo menos 2 caracteres');
    }

    // Validar CNS
    if ('cns' in data && data.cns && data.cns.length !== 15) {
      errors.push('CNS deve ter exatamente 15 dígitos');
    }

    // Validar CRM
    if ('crm' in data && data.crm && !/^[A-Z]{2}-[0-9]+$/.test(data.crm)) {
      errors.push('CRM deve seguir o formato UF-NÚMERO (ex: SP-123456)');
    }

    // Validar especialidade
    if ('specialty' in data && data.specialty && data.specialty.length < 3) {
      errors.push('Especialidade deve ter pelo menos 3 caracteres');
    }

    // Validar email
    if ('email' in data && data.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email)) {
      errors.push('Email deve ter formato válido');
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  /**
   * Busca médicos com filtro de texto
   */
  static async searchDoctors(searchTerm: string, limit: number = 50): Promise<CrudResult<MedicalDoctor[]>> {
    try {
      console.log('🔍 [REAL] Buscando médicos:', searchTerm);

      const { data, error } = await supabase
        .from('doctor_hospital_info')
        .select('*')
        .or(`doctor_name.ilike.%${searchTerm}%,doctor_crm.ilike.%${searchTerm}%,doctor_specialty.ilike.%${searchTerm}%`)
        .limit(limit)
        .order('doctor_name');

      if (error) {
        return {
          success: false,
          error: error.message
        };
      }

      const doctors: MedicalDoctor[] = (data || []).map(row => ({
        id: row.doctor_id,
        cns: row.doctor_cns,
        crm: row.doctor_crm,
        name: row.doctor_name,
        speciality: row.doctor_specialty,
        hospitalId: row.hospital_id || '',
        hospitalName: row.hospital_name || 'Sem vínculo',
        isActive: true, // Assumir ativo até campo estar disponível
        createdAt: row.doctor_created_at || new Date().toISOString(),
        updatedAt: row.doctor_updated_at || new Date().toISOString()
      }));

      return {
        success: true,
        data: doctors,
        message: `${doctors.length} médicos encontrados`
      };

    } catch (error) {
      console.error('Erro na busca de médicos:', error);
      return {
        success: false,
        error: `Erro inesperado: ${error}`
      };
    }
  }
}

export default DoctorsCrudService; 
/**
 * ================================================================
 * SERVIÇO DE FATURAMENTO POR MÉDICO - SISTEMA SIGTAP
 * ================================================================
 * Criado em: 2024-12-19
 * Propósito: Gerenciar dados agregados de médicos com faturamento real
 * Funcionalidade: Eliminar duplicações + filtros dinâmicos + permissões
 * ================================================================
 */

import { supabase } from '../lib/supabase';

// ================================================================
// TIPOS E INTERFACES
// ================================================================

export interface DoctorAggregated {
  doctor_id: string;
  doctor_name: string;
  doctor_cns: string;
  doctor_crm: string;
  doctor_specialty: string;
  doctor_secondary_specialties?: string;
  doctor_email?: string;
  doctor_phone?: string;
  doctor_birth_date?: string;
  doctor_gender?: string;
  doctor_is_active: boolean;
  doctor_notes?: string;
  doctor_created_at: string;
  doctor_updated_at: string;
  
  // Hospitais agrupados
  hospitals_list: string; // "Hospital A | Hospital B"
  hospital_ids: string; // "uuid1,uuid2"
  hospitals_count: number;
  primary_hospital_name?: string;
  
  // Roles e departamentos
  roles_list?: string;
  departments_list?: string;
  
  // Faturamento (últimos 12 meses)
  total_revenue_12months_cents: number;
  total_revenue_12months_reais: number;
  total_procedures_12months: number;
  avg_payment_rate_12months: number;
  
  // Atividade
  last_activity_date?: string;
  activity_status: 'ATIVO' | 'POUCO_ATIVO' | 'INATIVO';
}

export interface DoctorRevenueMonthly {
  doctor_id: string;
  doctor_name: string;
  doctor_cns: string;
  doctor_specialty: string;
  hospitals_list: string;
  revenue_year: number;
  revenue_month: number;
  revenue_month_date: string;
  total_procedures: number;
  pending_procedures: number;
  billed_procedures: number;
  paid_procedures: number;
  rejected_procedures: number;
  total_revenue_cents: number;
  total_revenue_reais: number;
  avg_procedure_value_reais: number;
  payment_rate_percent: number;
  approval_rate_percent: number;
  last_procedure_date: string;
}

export interface RevenueFilters {
  hospitalId?: string;
  specialty?: string;
  activityStatus?: 'ATIVO' | 'POUCO_ATIVO' | 'INATIVO' | 'all';
  searchTerm?: string;
  
  // Filtros de período
  periodType?: 'last_30_days' | 'last_3_months' | 'last_6_months' | 'last_12_months' | 'year' | 'month' | 'custom';
  year?: number;
  month?: number;
  startDate?: string;
  endDate?: string;
  
  // Paginação
  page?: number;
  pageSize?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

export interface SpecialtyStats {
  doctor_specialty: string;
  doctors_count: number;
  total_specialty_revenue_cents: number;
  total_specialty_revenue_reais: number;
  avg_doctor_revenue_reais: number;
  total_procedures: number;
  avg_procedures_per_doctor: number;
  avg_payment_rate: number;
}

export interface HospitalStats {
  hospital_id: string;
  hospital_name: string;
  hospital_cnpj: string;
  active_doctors_count: number;
  very_active_doctors: number;
  total_hospital_revenue_cents: number;
  total_hospital_revenue_reais: number;
  avg_doctor_revenue_reais: number;
  total_procedures: number;
  avg_procedures_per_doctor: number;
  avg_payment_rate: number;
  top_specialty_by_revenue?: string;
}

// ================================================================
// SERVIÇO PRINCIPAL
// ================================================================

export class DoctorsRevenueService {
  
  /**
   * 🔍 OBTER PROCEDIMENTOS ÚNICOS REALIZADOS POR MÉDICO
   * Retorna lista de códigos de procedimentos que o médico realizou (últimos 12 meses)
   */
  static async getDoctorUniqueProcedures(doctorCns: string): Promise<string[]> {
    try {
      console.log('🔍 Buscando procedimentos únicos do médico:', doctorCns);

      // Calcular data de 12 meses atrás
      const twelveMonthsAgo = new Date();
      twelveMonthsAgo.setMonth(twelveMonthsAgo.getMonth() - 12);

      // Buscar procedimentos únicos realizados pelo médico
      const { data, error } = await supabase
        .from('procedure_records')
        .select('procedure_code')
        .or(`professional.eq.${doctorCns},professional_cbo.eq.${doctorCns}`)
        .gte('procedure_date', twelveMonthsAgo.toISOString())
        .neq('professional_cbo', '225151'); // Excluir anestesistas

      if (error) {
        console.error('❌ Erro ao buscar procedimentos únicos:', error);
        return [];
      }

      // Extrair códigos únicos
      const uniqueCodes = [...new Set(data?.map(p => p.procedure_code).filter(Boolean) || [])];
      
      console.log(`✅ Encontrados ${uniqueCodes.length} procedimentos únicos`);
      
      return uniqueCodes;

    } catch (error) {
      console.error('💥 Erro no getDoctorUniqueProcedures:', error);
      return [];
    }
  }

  /**
   * 🚨 CONTAR PACIENTES SEM REPASSE MÉDICO
   * Retorna quantos pacientes têm pagamento médico calculado = 0
   * @param doctorCns - CNS do médico
   * @param doctorName - Nome do médico (para cálculo de regras)
   * @param hospitalId - ID do hospital (opcional, para regras específicas)
   * @returns { totalPatients, patientsWithoutPayment, patientsWithoutPaymentList }
   */
  static async countPatientsWithoutPayment(
    doctorCns: string,
    doctorName: string,
    hospitalId?: string
  ): Promise<{
    totalPatients: number;
    patientsWithoutPayment: number;
    patientsWithoutPaymentList: Array<{
      patientId: string;
      patientName: string;
      aihNumber: string;
      calculatedPayment: number;
      procedureCodes: string[];
    }>;
  }> {
    try {
      console.log('🔍 Contando pacientes sem repasse médico:', doctorName);

      // Importar funções de cálculo
      const { calculateDoctorPayment, calculateFixedPayment, calculatePercentagePayment } = await import('../components/DoctorPaymentRules');

      // Calcular data de 12 meses atrás
      const twelveMonthsAgo = new Date();
      twelveMonthsAgo.setMonth(twelveMonthsAgo.getMonth() - 12);

      // Buscar AIHs do médico
      let query = supabase
        .from('aihs')
        .select(`
          id,
          aih_number,
          patient_id,
          admission_date,
          patients!inner (
            id,
            name,
            cns
          )
        `)
        .eq('cns_responsavel', doctorCns)
        .gte('admission_date', twelveMonthsAgo.toISOString());

      if (hospitalId) {
        query = query.eq('hospital_id', hospitalId);
      }

      const { data: aihs, error: aihsError } = await query;

      if (aihsError) {
        console.error('❌ Erro ao buscar AIHs:', aihsError);
        return { totalPatients: 0, patientsWithoutPayment: 0, patientsWithoutPaymentList: [] };
      }

      if (!aihs || aihs.length === 0) {
        console.log('ℹ️ Nenhuma AIH encontrada para este médico');
        return { totalPatients: 0, patientsWithoutPayment: 0, patientsWithoutPaymentList: [] };
      }

      // Para cada AIH, buscar procedimentos e calcular pagamento
      const patientsWithoutPaymentList: Array<{
        patientId: string;
        patientName: string;
        aihNumber: string;
        calculatedPayment: number;
        procedureCodes: string[];
      }> = [];

      for (const aih of aihs) {
        const patient = aih.patients as any;
        if (!patient) continue;

        // Buscar procedimentos 04.xxx da AIH
        const { data: procedures, error: procError } = await supabase
          .from('procedure_records')
          .select('procedure_code, value_cents')
          .eq('aih_id', aih.id)
          .ilike('procedure_code', '04%');

        if (procError) {
          console.error('❌ Erro ao buscar procedimentos:', procError);
          continue;
        }

        const procedures04 = (procedures || []).map(p => ({
          procedure_code: p.procedure_code,
          value_reais: (p.value_cents || 0) / 100
        }));

        // Calcular pagamento médico
        const fixedPaymentCalc = calculateFixedPayment(doctorName, hospitalId);
        let doctorPayment = 0;

        if (fixedPaymentCalc.hasFixedRule) {
          // Médico com pagamento fixo: não contabilizar por paciente
          doctorPayment = 0; // Será somado no total, não por paciente
        } else {
          // Regras específicas por procedimento
          const perProcedureCalc = calculateDoctorPayment(doctorName, procedures04 as any, hospitalId);

          // Regra de percentual (quando existir)
          const baseProceduresSum = procedures04.reduce((s, p) => s + (p.value_reais || 0), 0);
          const percentageCalc = calculatePercentagePayment(doctorName, baseProceduresSum, hospitalId);

          // Precedência: percentual substitui cálculo individual
          doctorPayment = percentageCalc.hasPercentageRule
            ? percentageCalc.calculatedPayment
            : perProcedureCalc.totalPayment;
        }

        // Se pagamento = 0, adicionar à lista
        if (doctorPayment === 0) {
          patientsWithoutPaymentList.push({
            patientId: patient.id,
            patientName: patient.name,
            aihNumber: aih.aih_number,
            calculatedPayment: doctorPayment,
            procedureCodes: procedures04.map(p => p.procedure_code)
          });
        }
      }

      const totalPatients = aihs.length;
      const patientsWithoutPayment = patientsWithoutPaymentList.length;

      console.log(`✅ Total: ${totalPatients} pacientes | Sem repasse: ${patientsWithoutPayment}`);
      
      return {
        totalPatients,
        patientsWithoutPayment,
        patientsWithoutPaymentList
      };

    } catch (error) {
      console.error('💥 Erro no countPatientsWithoutPayment:', error);
      return { totalPatients: 0, patientsWithoutPayment: 0, patientsWithoutPaymentList: [] };
    }
  }
  
  /**
   * 📊 OBTER MÉDICOS AGREGADOS COM FATURAMENTO
   * Retorna lista de médicos sem duplicação + múltiplos hospitais agrupados
   */
  static async getDoctorsAggregated(filters: RevenueFilters = {}) {
    try {
      console.log('🔍 Buscando médicos agregados com filtros:', filters);

      // Query base
      let query = supabase
        .from('v_doctors_aggregated')
        .select('*');

      // Aplicar filtros
      if (filters.hospitalId && filters.hospitalId !== 'all') {
        // Usar LIKE para buscar no campo hospital_ids (formato: "uuid1,uuid2")
        query = query.like('hospital_ids', `%${filters.hospitalId}%`);
      }

      if (filters.specialty && filters.specialty !== 'all') {
        query = query.ilike('doctor_specialty', `%${filters.specialty}%`);
      }

      if (filters.activityStatus && filters.activityStatus !== 'all') {
        query = query.eq('activity_status', filters.activityStatus);
      }

      if (filters.searchTerm) {
        const searchTerm = filters.searchTerm.toLowerCase();
        query = query.or(
          `doctor_name.ilike.%${searchTerm}%,` +
          `doctor_cns.ilike.%${searchTerm}%,` +
          `doctor_crm.ilike.%${searchTerm}%,` +
          `doctor_specialty.ilike.%${searchTerm}%`
        );
      }

      // Ordenação
      const sortBy = filters.sortBy || 'total_revenue_12months_reais';
      const sortOrder = filters.sortOrder || 'desc';
      query = query.order(sortBy, { ascending: sortOrder === 'asc' });

      // Paginação
      const page = filters.page || 1;
      const pageSize = filters.pageSize || 50;
      const from = (page - 1) * pageSize;
      const to = from + pageSize - 1;
      
      query = query.range(from, to);

      const { data, error, count } = await query;

      if (error) {
        console.error('❌ Erro ao buscar médicos agregados:', error);
        throw error;
      }

      console.log(`✅ Encontrados ${data?.length || 0} médicos agregados`);

      return {
        doctors: data as DoctorAggregated[],
        totalCount: count || 0,
        currentPage: page,
        pageSize,
        totalPages: Math.ceil((count || 0) / pageSize)
      };

    } catch (error: any) {
      console.error('💥 Erro no getDoctorsAggregated:', error);
      console.warn('⚠️ Retornando estrutura vazia devido a erro na view v_doctors_aggregated');
      console.warn('💡 SOLUÇÃO: Execute o script database/fix_missing_views_migration.sql no Supabase');
      // Retornar estrutura vazia em vez de propagar o erro
      return {
        doctors: [],
        totalCount: 0,
        currentPage: 1,
        pageSize: filters.pageSize || 50,
        totalPages: 0
      };
    }
  }

  /**
   * 📈 OBTER FATURAMENTO MENSAL DETALHADO
   * Retorna dados mensais por médico com filtros de período
   */
  static async getDoctorRevenueMonthly(filters: RevenueFilters = {}) {
    try {
      console.log('📊 Buscando faturamento mensal com filtros:', filters);

      let query = supabase
        .from('v_doctor_revenue_monthly')
        .select('*');

      // Filtros básicos
      if (filters.hospitalId && filters.hospitalId !== 'all') {
        query = query.like('hospital_ids', `%${filters.hospitalId}%`);
      }

      if (filters.specialty && filters.specialty !== 'all') {
        query = query.ilike('doctor_specialty', `%${filters.specialty}%`);
      }

      // Filtros de período
      const now = new Date();
      switch (filters.periodType) {
        case 'last_30_days':
          const date30Days = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
          query = query.gte('revenue_month_date', date30Days.toISOString());
          break;

        case 'last_3_months':
          const date3Months = new Date(now.getFullYear(), now.getMonth() - 3, 1);
          query = query.gte('revenue_month_date', date3Months.toISOString());
          break;

        case 'last_6_months':
          const date6Months = new Date(now.getFullYear(), now.getMonth() - 6, 1);
          query = query.gte('revenue_month_date', date6Months.toISOString());
          break;

        case 'last_12_months':
          const date12Months = new Date(now.getFullYear(), now.getMonth() - 12, 1);
          query = query.gte('revenue_month_date', date12Months.toISOString());
          break;

        case 'year':
          if (filters.year) {
            query = query.eq('revenue_year', filters.year);
          }
          break;

        case 'month':
          if (filters.year && filters.month) {
            query = query.eq('revenue_year', filters.year)
                         .eq('revenue_month', filters.month);
          }
          break;

        case 'custom':
          if (filters.startDate) {
            query = query.gte('revenue_month_date', filters.startDate);
          }
          if (filters.endDate) {
            query = query.lte('revenue_month_date', filters.endDate);
          }
          break;
      }

      // Busca por termo
      if (filters.searchTerm) {
        const searchTerm = filters.searchTerm.toLowerCase();
        query = query.or(
          `doctor_name.ilike.%${searchTerm}%,` +
          `doctor_cns.ilike.%${searchTerm}%,` +
          `doctor_crm.ilike.%${searchTerm}%`
        );
      }

      // Ordenação
      query = query.order('total_revenue_reais', { ascending: false })
                   .order('revenue_year', { ascending: false })
                   .order('revenue_month', { ascending: false });

      const { data, error } = await query;

      if (error) {
        console.error('❌ Erro ao buscar faturamento mensal:', error);
        throw error;
      }

      console.log(`✅ Encontrados ${data?.length || 0} registros mensais`);
      return data as DoctorRevenueMonthly[];

    } catch (error) {
      console.error('💥 Erro no getDoctorRevenueMonthly:', error);
      throw error;
    }
  }

  /**
   * ✏️ ATUALIZAR ESPECIALIDADE DO MÉDICO
   * Apenas admins podem editar especialidades
   */
  static async updateDoctorSpecialty(
    doctorId: string, 
    specialty: string, 
    userId: string
  ) {
    try {
      console.log('✏️ Atualizando especialidade do médico:', { doctorId, specialty, userId });

      // Verificar permissões do usuário
      const { data: userProfile } = await supabase
        .from('user_profiles')
        .select('role')
        .eq('id', userId)
        .single();

      if (!userProfile || !['admin', 'diretor'].includes(userProfile.role)) {
        throw new Error('Apenas administradores podem editar especialidades médicas');
      }

      // Atualizar especialidade
      const { data, error } = await supabase
        .from('doctors')
        .update({ 
          specialty: specialty.trim(),
          updated_at: new Date().toISOString(),
          updated_by: userId
        })
        .eq('id', doctorId)
        .select('*')
        .single();

      if (error) {
        console.error('❌ Erro ao atualizar especialidade:', error);
        throw error;
      }

      console.log('✅ Especialidade atualizada com sucesso');
      return data;

    } catch (error) {
      console.error('💥 Erro no updateDoctorSpecialty:', error);
      throw error;
    }
  }

  /**
   * 📊 OBTER ESTATÍSTICAS POR ESPECIALIDADE
   */
  static async getSpecialtyStats() {
    try {
      const { data, error } = await supabase
        .from('v_specialty_revenue_stats')
        .select('*')
        .order('total_specialty_revenue_reais', { ascending: false });

      if (error) throw error;
      return data as SpecialtyStats[];
    } catch (error: any) {
      console.error('💥 Erro no getSpecialtyStats:', error);
      console.warn('⚠️ Retornando array vazio devido a erro na view v_specialty_revenue_stats');
      console.warn('💡 SOLUÇÃO: Execute o script database/fix_missing_views_migration.sql no Supabase');
      // Retornar array vazio em vez de propagar o erro
      return [];
    }
  }

  /**
   * 🏥 OBTER ESTATÍSTICAS POR HOSPITAL
   */
  static async getHospitalStats() {
    try {
      const { data, error } = await supabase
        .from('v_hospital_revenue_stats')
        .select('*')
        .order('total_hospital_revenue_reais', { ascending: false });

      if (error) throw error;
      return data as HospitalStats[];
    } catch (error: any) {
      console.error('💥 Erro no getHospitalStats:', error);
      console.warn('⚠️ Retornando array vazio devido a erro na view v_hospital_revenue_stats');
      console.warn('💡 SOLUÇÃO: Execute o script database/fix_missing_views_migration.sql no Supabase');
      // Retornar array vazio em vez de propagar o erro
      return [];
    }
  }

  /**
   * 📋 OBTER ESPECIALIDADES DISPONÍVEIS
   */
  static async getAvailableSpecialties() {
    try {
      const { data, error } = await supabase
        .from('doctors')
        .select('specialty')
        .not('specialty', 'is', null)
        .neq('specialty', '')
        .order('specialty');

      if (error) throw error;

      // Remover duplicatas e ordenar
      const uniqueSpecialties = [...new Set(data.map(d => d.specialty))]
        .filter(specialty => specialty && specialty.trim())
        .sort();

      return uniqueSpecialties;
    } catch (error) {
      console.error('💥 Erro no getAvailableSpecialties:', error);
      throw error;
    }
  }

  /**
   * 🔍 OBTER DETALHES DE UM MÉDICO ESPECÍFICO
   */
  static async getDoctorDetails(doctorId: string) {
    try {
      const { data, error } = await supabase
        .from('v_doctors_aggregated')
        .select('*')
        .eq('doctor_id', doctorId)
        .single();

      if (error) throw error;
      return data as DoctorAggregated;
    } catch (error) {
      console.error('💥 Erro no getDoctorDetails:', error);
      throw error;
    }
  }

  /**
   * 📊 OBTER RESUMO EXECUTIVO DE FATURAMENTO
   */
  static async getExecutiveSummary(filters: RevenueFilters = {}) {
    try {
      // Buscar dados agregados
      const doctorsResult = await this.getDoctorsAggregated(filters);
      const doctors = doctorsResult.doctors;

      // Calcular métricas executivas
      const totalDoctors = doctors.length;
      const activeDoctors = doctors.filter(d => d.activity_status === 'ATIVO').length;
      const totalRevenue = doctors.reduce((sum, d) => sum + d.total_revenue_12months_reais, 0);
      const totalProcedures = doctors.reduce((sum, d) => sum + d.total_procedures_12months, 0);
      const avgRevenuePerDoctor = totalDoctors > 0 ? totalRevenue / totalDoctors : 0;
      const avgPaymentRate = doctors.reduce((sum, d) => sum + d.avg_payment_rate_12months, 0) / (totalDoctors || 1);

      // Top especialidades
      const specialtyGroups = doctors.reduce((groups, doctor) => {
        const specialty = doctor.doctor_specialty || 'Não informado';
        if (!groups[specialty]) {
          groups[specialty] = { revenue: 0, count: 0 };
        }
        groups[specialty].revenue += doctor.total_revenue_12months_reais;
        groups[specialty].count += 1;
        return groups;
      }, {} as Record<string, { revenue: number; count: number }>);

      const topSpecialties = Object.entries(specialtyGroups)
        .map(([specialty, data]) => ({ specialty, ...data }))
        .sort((a, b) => b.revenue - a.revenue)
        .slice(0, 5);

      return {
        totalDoctors,
        activeDoctors,
        inactiveDoctors: totalDoctors - activeDoctors,
        totalRevenue,
        totalProcedures,
        avgRevenuePerDoctor,
        avgPaymentRate,
        topSpecialties,
        activityRate: totalDoctors > 0 ? (activeDoctors / totalDoctors) * 100 : 0
      };

    } catch (error) {
      console.error('💥 Erro no getExecutiveSummary:', error);
      throw error;
    }
  }
} 
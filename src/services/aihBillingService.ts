import { supabase } from '../lib/supabase';
import { DateRange } from '../types';

// ===== INTERFACES BASEADAS NAS VIEWS =====

export interface AIHBillingSummary {
  total_aihs: number;
  total_value: number;
  avg_value_per_aih: number;
  approved_aihs: number;
  approved_value: number;
  rejected_aihs: number;
  rejected_value: number;
  pending_aihs: number;
  pending_value: number;
  earliest_date: string;
  latest_date: string;
  avg_length_of_stay: number;
}

export interface AIHBillingByHospital {
  hospital_id: string;
  hospital_name: string;
  hospital_cnpj: string;
  total_aihs: number;
  total_value: number;
  avg_value_per_aih: number;
  approved_aihs: number;
  approved_value: number;
  rejected_aihs: number;
  rejected_value: number;
  pending_aihs: number;
  pending_value: number;
  avg_length_of_stay: number;
  unique_procedures: number;
  unique_diagnoses: number;
  unique_doctors: number;
}

export interface AIHBillingByMonth {
  month: string;
  total_aihs: number;
  total_value: number;
  avg_value_per_aih: number;
  approved_aihs: number;
  approved_value: number;
  rejected_aihs: number;
  rejected_value: number;
  pending_aihs: number;
  pending_value: number;
  avg_length_of_stay: number;
  unique_hospitals: number;
  unique_procedures: number;
  unique_doctors: number;
}

export interface AIHBillingByDoctor {
  doctor_id: string;
  doctor_name: string;
  doctor_cns: string;
  doctor_crm: string;
  doctor_crm_state: string;
  doctor_specialty: string;
  total_aihs: number;
  total_value: number;
  avg_value_per_aih: number;
  approved_aihs: number;
  approved_value: number;
  rejected_aihs: number;
  rejected_value: number;
  pending_aihs: number;
  pending_value: number;
  avg_length_of_stay: number;
  unique_procedures: number;
  unique_diagnoses: number;
  unique_hospitals: number;
}

export interface AIHBillingByProcedure {
  procedure_code: string;
  procedure_description: string;
  total_aihs: number;
  total_value: number;
  avg_value_per_aih: number;
  approved_aihs: number;
  approved_value: number;
  rejected_aihs: number;
  rejected_value: number;
  pending_aihs: number;
  pending_value: number;
  avg_length_of_stay: number;
  unique_specialties: number;
  unique_hospitals: number;
  unique_doctors: number;
}

export interface AIHBillingByHospitalSpecialty {
  hospital_id: string;
  hospital_name: string;
  doctor_specialty: string;
  total_aihs: number;
  total_value: number;
  avg_value_per_aih: number;
  approved_aihs: number;
  approved_value: number;
  rejected_aihs: number;
  rejected_value: number;
  pending_aihs: number;
  pending_value: number;
  avg_length_of_stay: number;
  unique_procedures: number;
  unique_diagnoses: number;
  unique_doctors: number;
}

// ===== INTERFACE PARA DASHBOARD CONSOLIDADO =====

export interface CompleteBillingStats {
  summary: AIHBillingSummary | null;
  byHospital: AIHBillingByHospital[];
  byMonth: AIHBillingByMonth[];
  byDoctor: AIHBillingByDoctor[];
  byProcedure: AIHBillingByProcedure[];
  byHospitalSpecialty: AIHBillingByHospitalSpecialty[];
  
  // Métricas calculadas
  metrics: {
    totalRevenue: number;
    totalAIHs: number;
    averageTicket: number;
    approvalRate: number;
    totalPatients: number;
    activeHospitals: number;
    activeDoctors: number;
    topHospitalByRevenue?: AIHBillingByHospital;
    topDoctorByRevenue?: AIHBillingByDoctor;
    topProcedureByValue?: AIHBillingByProcedure;
    monthlyGrowthRate?: number;
  };
}

export class AIHBillingService {
  /**
   * Busca resumo geral de todas as AIHs
   */
  static async getBillingSummary(dateRange?: DateRange): Promise<AIHBillingSummary | null> {
    try {
      console.log('📊 Buscando resumo geral das AIHs...');
      
      // Se temos filtro de data, buscar diretamente da tabela aihs
      if (dateRange) {
        console.log('📅 Consultando resumo com filtros de data...');
        
        const startDateISO = dateRange.startDate.toISOString();
        const endDateISO = dateRange.endDate.toISOString();
        
        // Query customizada com filtros de data
        const { data, error } = await supabase
          .from('aihs')
          .select('calculated_total_value, processing_status, admission_date, discharge_date')
          .gte('admission_date', startDateISO)
          .lte('admission_date', endDateISO);
          
        if (error) {
          console.error('❌ Erro ao buscar AIHs com filtro de data:', error);
          return null;
        }
        
        // Calcular estatísticas manualmente
        const totalAihs = data?.length || 0;
        const totalValue = data?.reduce((sum, aih) => sum + (aih.calculated_total_value || 0), 0) || 0;
        const approvedAihs = data?.filter(aih => 
          aih.processing_status === 'approved' || aih.processing_status === 'matched'
        ).length || 0;
        const approvedValue = data?.filter(aih => 
          aih.processing_status === 'approved' || aih.processing_status === 'matched'
        ).reduce((sum, aih) => sum + (aih.calculated_total_value || 0), 0) || 0;
        
        return {
          total_aihs: totalAihs,
          total_value: totalValue / 100, // Converter centavos para reais
          avg_value_per_aih: totalAihs > 0 ? (totalValue / 100) / totalAihs : 0,
          approved_aihs: approvedAihs,
          approved_value: approvedValue / 100,
          rejected_aihs: 0,
          rejected_value: 0,
          pending_aihs: totalAihs - approvedAihs,
          pending_value: (totalValue - approvedValue) / 100,
          earliest_date: dateRange.startDate.toISOString(),
          latest_date: dateRange.endDate.toISOString(),
          avg_length_of_stay: 3.5
        };
      }
      
      // Usar view padrão se não há filtro de data
      const { data, error } = await supabase
        .from('v_aih_billing_summary')
        .select('*')
        .single();

      if (error) {
        console.error('❌ Erro ao buscar resumo das AIHs:', error);
        return null;
      }

      console.log('✅ Resumo das AIHs obtido:', data);
      return data;
    } catch (error) {
      console.error('❌ Erro na consulta do resumo:', error);
      return null;
    }
  }

  /**
   * Busca dados de faturamento por hospital
   */
  static async getBillingByHospital(dateRange?: DateRange): Promise<AIHBillingByHospital[]> {
    try {
      console.log('🏥 Buscando faturamento por hospital...');
      
      const { data, error } = await supabase
        .from('v_aih_billing_by_hospital')
        .select('*')
        .order('total_value', { ascending: false });

      if (error) {
        console.error('❌ Erro ao buscar dados por hospital:', error);
        return [];
      }

      console.log(`✅ Dados de ${data?.length || 0} hospitais obtidos`);
      return data || [];
    } catch (error) {
      console.error('❌ Erro na consulta por hospital:', error);
      return [];
    }
  }

  /**
   * Busca tendência mensal de faturamento
   */
  static async getBillingByMonth(dateRange?: DateRange): Promise<AIHBillingByMonth[]> {
    try {
      console.log('📅 Buscando tendência mensal...');
      
      const { data, error } = await supabase
        .from('v_aih_billing_by_month')
        .select('*')
        .order('month', { ascending: true });

      if (error) {
        console.error('❌ Erro ao buscar dados mensais:', error);
        return [];
      }

      console.log(`✅ Dados de ${data?.length || 0} meses obtidos`);
      return data || [];
    } catch (error) {
      console.error('❌ Erro na consulta mensal:', error);
      return [];
    }
  }

  /**
   * Busca dados de faturamento por médico
   */
  static async getBillingByDoctor(limit: number = 50, dateRange?: DateRange): Promise<AIHBillingByDoctor[]> {
    try {
      console.log(`👨‍⚕️ Buscando faturamento por médico (top ${limit})...`);
      
      const { data, error } = await supabase
        .from('v_aih_billing_by_doctor')
        .select('*')
        .order('total_value', { ascending: false })
        .limit(limit);

      if (error) {
        console.error('❌ Erro ao buscar dados por médico:', error);
        return [];
      }

      console.log(`✅ Dados de ${data?.length || 0} médicos obtidos`);
      return data || [];
    } catch (error) {
      console.error('❌ Erro na consulta por médico:', error);
      return [];
    }
  }

  /**
   * Busca dados de faturamento por procedimento
   */
  static async getBillingByProcedure(limit: number = 30, dateRange?: DateRange): Promise<AIHBillingByProcedure[]> {
    try {
      console.log(`🩺 Buscando faturamento por procedimento (top ${limit})...`);
      
      const { data, error } = await supabase
        .from('v_aih_billing_by_procedure')
        .select('*')
        .order('total_value', { ascending: false })
        .limit(limit);

      if (error) {
        console.error('❌ Erro ao buscar dados por procedimento:', error);
        return [];
      }

      console.log(`✅ Dados de ${data?.length || 0} procedimentos obtidos`);
      return data || [];
    } catch (error) {
      console.error('❌ Erro na consulta por procedimento:', error);
      return [];
    }
  }

  /**
   * Busca dados de faturamento por hospital e especialidade
   */
  static async getBillingByHospitalSpecialty(dateRange?: DateRange): Promise<AIHBillingByHospitalSpecialty[]> {
    try {
      console.log('🏥🩺 Buscando faturamento por hospital e especialidade...');
      
      const { data, error } = await supabase
        .from('v_aih_billing_by_hospital_specialty')
        .select('*')
        .order('total_value', { ascending: false });

      if (error) {
        console.error('❌ Erro ao buscar dados por hospital e especialidade:', error);
        return [];
      }

      console.log(`✅ Dados de ${data?.length || 0} combinações hospital-especialidade obtidos`);
      return data || [];
    } catch (error) {
      console.error('❌ Erro na consulta por hospital e especialidade:', error);
      return [];
    }
  }

  /**
   * Busca todos os dados consolidados para o dashboard
   */
  static async getCompleteBillingStats(
    dateRange?: DateRange,
    options?: {
      hospitalIds?: string[];
      specialty?: string; // doctor_specialty
      careCharacter?: string; // '1' | '2' | '3' | '4' | 'all'
      searchTerm?: string;
    }
  ): Promise<CompleteBillingStats> {
    try {
      console.log('🔄 Carregando dados completos de billing...');
      
      if (dateRange) {
        console.log('📅 Aplicando filtros de data:', {
          inicio: dateRange.startDate.toLocaleDateString('pt-BR'),
          fim: dateRange.endDate.toLocaleDateString('pt-BR')
        });
      }
      
      // Buscar todos os dados em paralelo
      const [
        summary,
        byHospital,
        byMonth,
        byDoctor,
        byProcedure,
        byHospitalSpecialty
      ] = await Promise.all([
        this.getBillingSummary(dateRange),
        this.getBillingByHospital(dateRange),
        this.getBillingByMonth(dateRange),
        this.getBillingByDoctor(50, dateRange),
        this.getBillingByProcedure(30, dateRange),
        this.getBillingByHospitalSpecialty(dateRange)
      ]);

      // Aplicar filtros globais (client-side quando views não suportam filtros diretos)
      const filteredByHospital = (() => {
        if (options?.hospitalIds && options.hospitalIds.length > 0 && !options.hospitalIds.includes('all')) {
          const set = new Set(options.hospitalIds);
          return byHospital.filter(h => set.has(h.hospital_id));
        }
        return byHospital;
      })();

      const filteredByDoctor = (() => {
        let arr = byDoctor;
        if (options?.specialty && options.specialty !== 'all') {
          arr = arr.filter(d => (d.doctor_specialty || '').toLowerCase() === options.specialty!.toLowerCase());
        }
        if (options?.searchTerm && options.searchTerm.trim()) {
          const s = options.searchTerm.toLowerCase();
          arr = arr.filter(d => (d.doctor_name || '').toLowerCase().includes(s) || (d.doctor_crm || '').toLowerCase().includes(s) || (d.doctor_specialty || '').toLowerCase().includes(s));
        }
        // Hospital filter indisponível nesta view (não há hospital_id); manter sem filtro por hospital
        return arr;
      })();

      const filteredByHospitalSpecialty = (() => {
        let arr = byHospitalSpecialty;
        if (options?.hospitalIds && options.hospitalIds.length > 0 && !options.hospitalIds.includes('all')) {
          const set = new Set(options.hospitalIds);
          arr = arr.filter(row => set.has(row.hospital_id));
        }
        if (options?.specialty && options.specialty !== 'all') {
          arr = arr.filter(row => (row.doctor_specialty || '').toLowerCase() === options.specialty!.toLowerCase());
        }
        return arr;
      })();

      // Filtrar summary por hospitalIds/careCharacter usando tabela aihs, se filtros presentes
      let filteredSummary = summary;
      if (dateRange && (options?.hospitalIds || (options?.careCharacter && options.careCharacter !== 'all'))) {
        try {
          const startDateISO = dateRange.startDate.toISOString();
          const endDateISO = dateRange.endDate.toISOString();
          let q = supabase
            .from('aihs')
            .select('calculated_total_value, processing_status, admission_date, discharge_date, care_character, hospital_id')
            .gte('admission_date', startDateISO)
            .lte('admission_date', endDateISO);
          if (options?.hospitalIds && options.hospitalIds.length > 0 && !options.hospitalIds.includes('all')) {
            q = q.in('hospital_id', options.hospitalIds);
          }
          if (options?.careCharacter && options.careCharacter !== 'all') {
            q = q.eq('care_character', options.careCharacter);
          }
          const { data, error } = await q;
          if (!error && data) {
            const totalAihs = data.length;
            const totalValue = data.reduce((sum, aih: any) => sum + (aih.calculated_total_value || 0), 0);
            const approvedAihs = data.filter((aih: any) => aih.processing_status === 'approved' || aih.processing_status === 'matched').length;
            const approvedValue = data.filter((aih: any) => aih.processing_status === 'approved' || aih.processing_status === 'matched')
              .reduce((sum, aih: any) => sum + (aih.calculated_total_value || 0), 0);
            filteredSummary = {
              total_aihs: totalAihs,
              total_value: totalValue / 100,
              avg_value_per_aih: totalAihs > 0 ? (totalValue / 100) / totalAihs : 0,
              approved_aihs: approvedAihs,
              approved_value: approvedValue / 100,
              rejected_aihs: 0,
              rejected_value: 0,
              pending_aihs: totalAihs - approvedAihs,
              pending_value: (totalValue - approvedValue) / 100,
              earliest_date: dateRange.startDate.toISOString(),
              latest_date: dateRange.endDate.toISOString(),
              avg_length_of_stay: 3.5
            };
          }
        } catch {}
      }

      // Calcular métricas com arrays filtrados
      const metrics = this.calculateMetrics(filteredSummary, filteredByHospital, byMonth, filteredByDoctor, byProcedure);

      const result: CompleteBillingStats = {
        summary: filteredSummary,
        byHospital: filteredByHospital,
        byMonth,
        byDoctor: filteredByDoctor,
        byProcedure,
        byHospitalSpecialty: filteredByHospitalSpecialty,
        metrics
      };

      console.log('✅ Dados completos de billing carregados:', {
        totalRevenue: `R$ ${metrics.totalRevenue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`,
        totalAIHs: metrics.totalAIHs,
        activeHospitals: metrics.activeHospitals,
        activeDoctors: metrics.activeDoctors,
        approvalRate: `${metrics.approvalRate.toFixed(1)}%`
      });

      return result;
    } catch (error) {
      console.error('❌ Erro ao carregar dados completos:', error);
      
      // Retornar estrutura vazia em caso de erro
      return {
        summary: null,
        byHospital: [],
        byMonth: [],
        byDoctor: [],
        byProcedure: [],
        byHospitalSpecialty: [],
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
  }

  /**
   * Calcula métricas derivadas a partir dos dados das views
   */
  private static calculateMetrics(
    summary: AIHBillingSummary | null,
    byHospital: AIHBillingByHospital[],
    byMonth: AIHBillingByMonth[],
    byDoctor: AIHBillingByDoctor[],
    byProcedure: AIHBillingByProcedure[]
  ) {
    const totalRevenue = summary?.total_value || 0;
    const totalAIHs = summary?.total_aihs || 0;
    const averageTicket = summary?.avg_value_per_aih || 0;
    
    // Taxa de aprovação
    const approvalRate = summary && summary.total_aihs > 0 
      ? (summary.approved_aihs / summary.total_aihs) * 100 
      : 0;

    // Hospitais e médicos ativos
    const activeHospitals = byHospital.length;
    const activeDoctors = byDoctor.length;

    // Estimativa de pacientes únicos (baseada na média de AIHs por paciente)
    const estimatedPatientsPerAIH = 0.8; // Estimativa: 1 paciente para cada 1.25 AIHs
    const totalPatients = Math.round(totalAIHs * estimatedPatientsPerAIH);

    // Top performers
    const topHospitalByRevenue = byHospital[0];
    const topDoctorByRevenue = byDoctor[0];
    const topProcedureByValue = byProcedure[0];

    // Taxa de crescimento mensal (últimos 2 meses)
    let monthlyGrowthRate: number | undefined;
    if (byMonth.length >= 2) {
      const currentMonth = byMonth[byMonth.length - 1];
      const previousMonth = byMonth[byMonth.length - 2];
      
      if (previousMonth.total_value > 0) {
        monthlyGrowthRate = ((currentMonth.total_value - previousMonth.total_value) / previousMonth.total_value) * 100;
      }
    }

    return {
      totalRevenue,
      totalAIHs,
      averageTicket,
      approvalRate,
      totalPatients,
      activeHospitals,
      activeDoctors,
      topHospitalByRevenue,
      topDoctorByRevenue,
      topProcedureByValue,
      monthlyGrowthRate
    };
  }

  /**
   * Busca dados de um hospital específico
   */
  static async getHospitalBillingStats(hospitalId: string): Promise<{
    hospital: AIHBillingByHospital | null;
    specialties: AIHBillingByHospitalSpecialty[];
  }> {
    try {
      console.log(`🏥 Buscando dados específicos do hospital: ${hospitalId}`);
      
      const [hospitalData, specialtiesData] = await Promise.all([
        supabase
          .from('v_aih_billing_by_hospital')
          .select('*')
          .eq('hospital_id', hospitalId)
          .single(),
        supabase
          .from('v_aih_billing_by_hospital_specialty')
          .select('*')
          .eq('hospital_id', hospitalId)
          .order('total_value', { ascending: false })
      ]);

      return {
        hospital: hospitalData.data,
        specialties: specialtiesData.data || []
      };
    } catch (error) {
      console.error('❌ Erro ao buscar dados do hospital:', error);
      return {
        hospital: null,
        specialties: []
      };
    }
  }

  /**
   * Busca top procedimentos por valor
   */
  static async getTopProceduresByValue(limit: number = 10): Promise<AIHBillingByProcedure[]> {
    try {
      const { data, error } = await supabase
        .from('v_aih_billing_by_procedure')
        .select('*')
        .order('total_value', { ascending: false })
        .limit(limit);

      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error('❌ Erro ao buscar top procedimentos:', error);
      return [];
    }
  }

  /**
   * Busca top médicos por faturamento
   */
  static async getTopDoctorsByRevenue(limit: number = 10): Promise<AIHBillingByDoctor[]> {
    try {
      const { data, error } = await supabase
        .from('v_aih_billing_by_doctor')
        .select('*')
        .order('total_value', { ascending: false })
        .limit(limit);

      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error('❌ Erro ao buscar top médicos:', error);
      return [];
    }
  }
} 
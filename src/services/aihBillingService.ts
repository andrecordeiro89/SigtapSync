import { supabase } from '../lib/supabase';

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
  static async getBillingSummary(): Promise<AIHBillingSummary | null> {
    try {
      console.log('📊 Buscando resumo geral das AIHs...');
      
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
  static async getBillingByHospital(): Promise<AIHBillingByHospital[]> {
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
  static async getBillingByMonth(): Promise<AIHBillingByMonth[]> {
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
  static async getBillingByDoctor(limit: number = 50): Promise<AIHBillingByDoctor[]> {
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
  static async getBillingByProcedure(limit: number = 30): Promise<AIHBillingByProcedure[]> {
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
  static async getBillingByHospitalSpecialty(): Promise<AIHBillingByHospitalSpecialty[]> {
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
  static async getCompleteBillingStats(): Promise<CompleteBillingStats> {
    try {
      console.log('🔄 Carregando dados completos de billing...');
      
      // Buscar todos os dados em paralelo
      const [
        summary,
        byHospital,
        byMonth,
        byDoctor,
        byProcedure,
        byHospitalSpecialty
      ] = await Promise.all([
        this.getBillingSummary(),
        this.getBillingByHospital(),
        this.getBillingByMonth(),
        this.getBillingByDoctor(50),
        this.getBillingByProcedure(30),
        this.getBillingByHospitalSpecialty()
      ]);

      // Calcular métricas derivadas
      const metrics = this.calculateMetrics(summary, byHospital, byMonth, byDoctor, byProcedure);

      const result: CompleteBillingStats = {
        summary,
        byHospital,
        byMonth,
        byDoctor,
        byProcedure,
        byHospitalSpecialty,
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
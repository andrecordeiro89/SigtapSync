import { supabase, centavosToReais } from '../lib/supabase';

export interface AIHRevenueStats {
  totalRevenue: number;
  totalAIHs: number;
  averageTicket: number;
  averageRevenuePenalty: number;
  totalProcedures: number;
  approvedProcedures: number;
  rejectedProcedures: number;
  approvalRate: number;
  totalPatients: number;
  activeHospitals: number;
  revenueByHospital: HospitalRevenue[];
  revenueBySpecialty: SpecialtyRevenue[];
  revenueByDoctor: DoctorRevenue[];
  processingStats: {
    pending: number;
    completed: number;
    rejected: number;
  };
  monthlyTrend: {
    month: string;
    revenue: number;
    aihCount: number;
  }[];
}

export interface HospitalRevenue {
  hospitalId: string;
  hospitalName: string;
  totalRevenue: number;
  aihCount: number;
  procedureCount: number;
  approvalRate: number;
  averageTicket: number;
  patientCount: number;
}

export interface SpecialtyRevenue {
  specialty: string;
  totalRevenue: number;
  procedureCount: number;
  averageTicket: number;
  doctorCount: number;
}

export interface DoctorRevenue {
  doctorId: string;
  doctorName: string;
  doctorCrm: string;
  doctorCns: string;
  specialty: string;
  hospitalName: string;
  totalRevenue: number;
  procedureCount: number;
  averageTicket: number;
  approvalRate: number;
}

export class AIHRevenueService {
  /**
   * Busca estatísticas completas de faturamento das AIHs processadas
   */
  static async getCompleteRevenueStats(hospitalId?: string): Promise<AIHRevenueStats> {
    try {
      console.log('📊 Buscando estatísticas reais de faturamento...');
      
      // ✅ MODO ADMINISTRADOR: Se hospitalId for "ALL", undefined ou inválido, buscar todos os hospitais
      const isAdminMode = !hospitalId || hospitalId === 'ALL' || hospitalId === 'undefined';
      // Guard de dados: retornar estrutura vazia se não houver registros
      const { hasAihsData, hasProcedureRecordsData } = await import('./dataGuard');
      const hospitalFilter = !isAdminMode ? [hospitalId!] : undefined;
      const [aihsHaveData, procHaveData] = await Promise.all([
        hasAihsData({ hospitalIds: hospitalFilter }),
        hasProcedureRecordsData({ hospitalIds: hospitalFilter })
      ]);
      if (!aihsHaveData && !procHaveData) {
        return {
          totalRevenue: 0,
          totalAIHs: 0,
          averageTicket: 0,
          averageRevenuePenalty: 0,
          totalProcedures: 0,
          approvedProcedures: 0,
          rejectedProcedures: 0,
          approvalRate: 0,
          totalPatients: 0,
          activeHospitals: 0,
          revenueByHospital: [],
          revenueBySpecialty: [],
          revenueByDoctor: [],
          processingStats: { pending: 0, completed: 0, rejected: 0 },
          monthlyTrend: []
        };
      }
      
      // BUSCAR DADOS PRINCIPAIS DAS AIHS
      let aihQuery = supabase
        .from('aihs')
        .select(`
          id,
          aih_number,
          hospital_id,
          patient_id,
          calculated_total_value,
          original_value,
          processing_status,
          admission_date,
          created_at,
          total_procedures,
          approved_procedures,
          rejected_procedures
        `);

      if (!isAdminMode) {
        aihQuery = aihQuery.eq('hospital_id', hospitalId);
      }

      const { data: aihsData, error: aihError } = await aihQuery;

      if (aihError) {
        console.error('❌ Erro ao buscar AIHs:', aihError);
        throw aihError;
      }

      // BUSCAR DADOS DOS PROCEDIMENTOS INDIVIDUAIS
      let proceduresQuery = supabase
        .from('procedure_records')
        .select(`
          id,
          hospital_id,
          aih_id,
          procedure_code,
          value_charged,
          match_status,
          professional_name,
          professional_cbo,
          procedure_date
        `);

      if (!isAdminMode) {
        proceduresQuery = proceduresQuery.eq('hospital_id', hospitalId);
      }

      const { data: proceduresData, error: proceduresError } = await proceduresQuery;

      if (proceduresError) {
        console.error('❌ Erro ao buscar procedimentos:', proceduresError);
        throw proceduresError;
      }

      // CALCULAR ESTATÍSTICAS PRINCIPAIS
      const aihs = aihsData || [];
      const procedures = proceduresData || [];

      // Totais principais
      const totalRevenue = centavosToReais(
        aihs.reduce((sum, aih) => sum + (aih.calculated_total_value || 0), 0)
      );

      const totalOriginalValue = centavosToReais(
        aihs.reduce((sum, aih) => sum + (aih.original_value || 0), 0)
      );

      const totalAIHs = aihs.length;
      const totalProcedures = procedures.length;
      
      const approvedProcedures = procedures.filter(p => p.match_status === 'approved' || p.match_status === 'paid').length;
      const rejectedProcedures = procedures.filter(p => p.match_status === 'rejected').length;
      
      const approvalRate = totalProcedures > 0 ? (approvedProcedures / totalProcedures) * 100 : 0;
      const averageTicket = totalAIHs > 0 ? totalRevenue / totalAIHs : 0;
      
      const averageRevenuePenalty = totalOriginalValue > 0 ? 
        ((totalOriginalValue - totalRevenue) / totalOriginalValue) * 100 : 0;

      // Contar pacientes únicos
      const uniquePatients = new Set(aihs.map(aih => aih.patient_id)).size;
      
      // Contar hospitais ativos
      const uniqueHospitals = new Set(aihs.map(aih => aih.hospital_id)).size;

      // Estatísticas de processamento
      const processingStats = {
        pending: aihs.filter(a => a.processing_status === 'pending').length,
        completed: aihs.filter(a => a.processing_status === 'completed').length,
        rejected: aihs.filter(a => a.processing_status === 'rejected').length
      };

      // FATURAMENTO POR HOSPITAL
      const hospitalRevenueMap = new Map<string, HospitalRevenue>();
      
      aihs.forEach(aih => {
        const hospitalId = aih.hospital_id;
        const hospitalName = aih.hospital_id;
        
        if (!hospitalRevenueMap.has(hospitalId)) {
          hospitalRevenueMap.set(hospitalId, {
            hospitalId,
            hospitalName,
            totalRevenue: 0,
            aihCount: 0,
            procedureCount: 0,
            approvalRate: 0,
            averageTicket: 0,
            patientCount: 0
          });
        }
        
        const hospitalStats = hospitalRevenueMap.get(hospitalId)!;
        hospitalStats.totalRevenue += (aih.calculated_total_value || 0) / 100;
        hospitalStats.aihCount += 1;
        hospitalStats.procedureCount += aih.total_procedures || 0;
      });

      // Calcular taxa de aprovação por hospital
      hospitalRevenueMap.forEach((hospitalStats, hospitalId) => {
        const hospitalProcedures = procedures.filter(p => p.hospital_id === hospitalId);
        const hospitalApproved = hospitalProcedures.filter(p => p.match_status === 'approved' || p.match_status === 'paid').length;
        
        hospitalStats.approvalRate = hospitalProcedures.length > 0 ? 
          (hospitalApproved / hospitalProcedures.length) * 100 : 0;
        
        hospitalStats.averageTicket = hospitalStats.aihCount > 0 ? 
          hospitalStats.totalRevenue / hospitalStats.aihCount : 0;
        
        // Contar pacientes únicos por hospital
        const hospitalAIHs = aihs.filter(a => a.hospital_id === hospitalId);
        hospitalStats.patientCount = new Set(hospitalAIHs.map(a => a.patient_id)).size;
      });

      const revenueByHospital = Array.from(hospitalRevenueMap.values());

      // FATURAMENTO POR ESPECIALIDADE (Mock por enquanto)
      const revenueBySpecialty: SpecialtyRevenue[] = [
        {
          specialty: 'Cirurgia Geral',
          totalRevenue: totalRevenue * 0.4,
          procedureCount: Math.floor(totalProcedures * 0.4),
          averageTicket: averageTicket * 1.2,
          doctorCount: 5
        },
        {
          specialty: 'Clínica Médica',
          totalRevenue: totalRevenue * 0.3,
          procedureCount: Math.floor(totalProcedures * 0.3),
          averageTicket: averageTicket * 0.8,
          doctorCount: 8
        },
        {
          specialty: 'Pediatria',
          totalRevenue: totalRevenue * 0.2,
          procedureCount: Math.floor(totalProcedures * 0.2),
          averageTicket: averageTicket * 0.9,
          doctorCount: 3
        },
        {
          specialty: 'Ortopedia',
          totalRevenue: totalRevenue * 0.1,
          procedureCount: Math.floor(totalProcedures * 0.1),
          averageTicket: averageTicket * 1.5,
          doctorCount: 2
        }
      ];

      // FATURAMENTO POR MÉDICO (Mock por enquanto)
      const revenueByDoctor: DoctorRevenue[] = [
        {
          doctorId: '1',
          doctorName: 'Dr. João Silva',
          doctorCrm: '12345',
          doctorCns: '123456789012345',
          specialty: 'Cirurgia Geral',
          hospitalName: revenueByHospital[0]?.hospitalName || 'Hospital Principal',
          totalRevenue: totalRevenue * 0.25,
          procedureCount: Math.floor(totalProcedures * 0.25),
          averageTicket: averageTicket * 1.3,
          approvalRate: 95
        },
        {
          doctorId: '2',
          doctorName: 'Dra. Maria Santos',
          doctorCrm: '67890',
          doctorCns: '987654321098765',
          specialty: 'Clínica Médica',
          hospitalName: revenueByHospital[0]?.hospitalName || 'Hospital Principal',
          totalRevenue: totalRevenue * 0.2,
          procedureCount: Math.floor(totalProcedures * 0.2),
          averageTicket: averageTicket * 0.9,
          approvalRate: 88
        }
      ];

      // TENDÊNCIA MENSAL (últimos 6 meses)
      const monthlyTrend = [];
      const now = new Date();
      
      for (let i = 5; i >= 0; i--) {
        const month = new Date(now.getFullYear(), now.getMonth() - i, 1);
        const monthStart = month.toISOString().split('T')[0];
        const monthEnd = new Date(month.getFullYear(), month.getMonth() + 1, 0).toISOString().split('T')[0];
        
        const monthAIHs = aihs.filter(aih => {
          const aihDate = aih.admission_date || aih.created_at;
          return aihDate >= monthStart && aihDate <= monthEnd;
        });
        
      const monthRevenue = centavosToReais(
        monthAIHs.reduce((sum, aih) => sum + (aih.calculated_total_value || 0), 0)
      );
        
        monthlyTrend.push({
          month: month.toLocaleDateString('pt-BR', { month: 'short', year: 'numeric' }),
          revenue: monthRevenue,
          aihCount: monthAIHs.length
        });
      }

      const stats: AIHRevenueStats = {
        totalRevenue,
        totalAIHs,
        averageTicket,
        averageRevenuePenalty,
        totalProcedures,
        approvedProcedures,
        rejectedProcedures,
        approvalRate,
        totalPatients: uniquePatients,
        activeHospitals: uniqueHospitals,
        revenueByHospital,
        revenueBySpecialty,
        revenueByDoctor,
        processingStats,
        monthlyTrend
      };

      console.log('✅ Estatísticas de faturamento calculadas:', {
        totalRevenue: `R$ ${totalRevenue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`,
        totalAIHs,
        totalProcedures,
        approvalRate: `${approvalRate.toFixed(1)}%`,
        activeHospitals: uniqueHospitals
      });

      return stats;

    } catch (error) {
      console.error('❌ Erro ao calcular estatísticas de faturamento:', error);
      throw error;
    }
  }

  /**
   * Busca estatísticas simplificadas para KPIs principais
   */
  static async getKPIStats(hospitalId?: string): Promise<{
    totalRevenue: number;
    totalAIHs: number;
    averageTicket: number;
    approvalRate: number;
    totalProcedures: number;
    totalPatients: number;
  }> {
    try {
      const fullStats = await this.getCompleteRevenueStats(hospitalId);
      
      return {
        totalRevenue: fullStats.totalRevenue,
        totalAIHs: fullStats.totalAIHs,
        averageTicket: fullStats.averageTicket,
        approvalRate: fullStats.approvalRate,
        totalProcedures: fullStats.totalProcedures,
        totalPatients: fullStats.totalPatients
      };
    } catch (error) {
      console.error('❌ Erro ao buscar KPIs:', error);
      throw error;
    }
  }
} 

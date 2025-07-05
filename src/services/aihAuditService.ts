import { supabase } from '../lib/supabase';

/**
 * 📊 SERVIÇO DE AUDITORIA AIH
 * Especializado em rastrear AIH por login/analista
 */

export interface AIHAuditStats {
  totalAIHs: number;
  processedToday: number;
  pendingReview: number;
  auditLogsCount: number;
  avgProcessingTime: number;
  successRate: number;
}

export interface AnalystProductivity {
  user_id: string;
  user_email: string;
  user_name: string;
  total_aihs: number;
  aihs_today: number;
  aihs_this_week: number;
  aihs_this_month: number;
  avg_processing_time: number;
  success_rate: number;
  last_activity: string;
}

export interface AIHAuditLog {
  id: string;
  action: string;
  table_name: string;
  operation_type: string;
  user_id: string;
  user_email?: string;
  user_name?: string;
  hospital_id: string;
  hospital_name?: string;
  aih_number?: string;
  created_at: string;
  ip_address?: string;
  new_values?: any;
}

export class AIHAuditService {
  
  /**
   * 📊 ESTATÍSTICAS GERAIS DE AIH
   * Para os cards do dashboard principal
   */
  static async getAIHStats(hospitalId?: string): Promise<{ success: boolean; data: AIHAuditStats; error?: string }> {
    try {
      console.log('📊 [AUDIT] Carregando estatísticas de AIH...');

      // Data de hoje
      const today = new Date().toISOString().split('T')[0];
      const startOfDay = `${today}T00:00:00.000Z`;
      const endOfDay = `${today}T23:59:59.999Z`;

      // Consultas em paralelo
      const queries = [
        // Total de AIHs
        supabase
          .from('audit_logs')
          .select('id', { count: 'exact' })
          .eq('action', 'AIH_PROCESSING_SUCCESS')
          .eq('table_name', 'aihs'),

        // Processadas hoje
        supabase
          .from('audit_logs')
          .select('id', { count: 'exact' })
          .eq('action', 'AIH_PROCESSING_SUCCESS')
          .eq('table_name', 'aihs')
          .gte('created_at', startOfDay)
          .lte('created_at', endOfDay),

        // AIHs com erro (pendente revisão)
        supabase
          .from('audit_logs')
          .select('id', { count: 'exact' })
          .eq('action', 'AIH_PROCESSING_ERROR')
          .eq('table_name', 'aihs'),

        // Total de logs de auditoria
        supabase
          .from('audit_logs')
          .select('id', { count: 'exact' })
          .eq('table_name', 'aihs')
      ];

      // Filtrar por hospital se especificado
      if (hospitalId && hospitalId !== 'ALL') {
        queries.forEach(query => query.eq('hospital_id', hospitalId));
      }

      const [totalResult, todayResult, errorResult, auditResult] = await Promise.all(queries);

      const stats: AIHAuditStats = {
        totalAIHs: totalResult.count || 0,
        processedToday: todayResult.count || 0,
        pendingReview: errorResult.count || 0,
        auditLogsCount: auditResult.count || 0,
        avgProcessingTime: 2.3, // Simulado por enquanto
        successRate: 96.8 // Simulado por enquanto
      };

      console.log('✅ Estatísticas carregadas:', stats);
      return { success: true, data: stats };

    } catch (error) {
      console.error('❌ Erro ao carregar estatísticas:', error);
      return { 
        success: false, 
        data: {} as AIHAuditStats, 
        error: error instanceof Error ? error.message : 'Erro desconhecido' 
      };
    }
  }

  /**
   * 👥 PRODUTIVIDADE POR ANALISTA
   * Quantas AIH cada login/analista processou
   */
  static async getAnalystProductivity(
    hospitalId?: string,
    period: 'today' | 'week' | 'month' | 'all' = 'all'
  ): Promise<{ success: boolean; data: AnalystProductivity[]; error?: string }> {
    try {
      console.log('👥 [AUDIT] Carregando produtividade por analista...');

      // Definir período
      const now = new Date();
      let startDate: string;

      switch (period) {
        case 'today':
          startDate = new Date().toISOString().split('T')[0] + 'T00:00:00.000Z';
          break;
        case 'week':
          const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
          startDate = weekAgo.toISOString();
          break;
        case 'month':
          const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
          startDate = monthAgo.toISOString();
          break;
        default:
          startDate = '2020-01-01T00:00:00.000Z'; // Buscar tudo
      }

      // Buscar logs de AIH com dados do usuário
      let query = supabase
        .from('audit_logs')
        .select(`
          user_id,
          hospital_id,
          created_at,
          action,
          new_values,
          user_profiles!audit_logs_user_id_fkey (
            full_name,
            email
          )
        `)
        .eq('action', 'AIH_PROCESSING_SUCCESS')
        .eq('table_name', 'aihs')
        .gte('created_at', startDate)
        .order('created_at', { ascending: false });

      // Filtrar por hospital
      if (hospitalId && hospitalId !== 'ALL') {
        query = query.eq('hospital_id', hospitalId);
      }

      const { data: logs, error } = await query;

      if (error) {
        console.error('❌ Erro ao buscar logs:', error);
        return { success: false, data: [], error: error.message };
      }

      // Processar dados por analista
      const analystMap = new Map<string, any>();

      (logs || []).forEach(log => {
        const userId = log.user_id;
        const userProfile = (log.user_profiles as any);
        
        if (!analystMap.has(userId)) {
          analystMap.set(userId, {
            user_id: userId,
            user_email: userProfile?.email || 'Email não disponível',
            user_name: userProfile?.full_name || 'Nome não disponível',
            total_aihs: 0,
            aihs_today: 0,
            aihs_this_week: 0,
            aihs_this_month: 0,
            logs: []
          });
        }

        const analyst = analystMap.get(userId);
        analyst.total_aihs++;
        analyst.logs.push(log);

        // Contar por período
        const logDate = new Date(log.created_at);
        const today = new Date().toISOString().split('T')[0];
        const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

        if (log.created_at.startsWith(today)) {
          analyst.aihs_today++;
        }
        if (logDate >= weekAgo) {
          analyst.aihs_this_week++;
        }
        if (logDate >= monthAgo) {
          analyst.aihs_this_month++;
        }
      });

      // Converter para formato final
      const productivity: AnalystProductivity[] = Array.from(analystMap.values()).map(analyst => ({
        user_id: analyst.user_id,
        user_email: analyst.user_email,
        user_name: analyst.user_name,
        total_aihs: analyst.total_aihs,
        aihs_today: analyst.aihs_today,
        aihs_this_week: analyst.aihs_this_week,
        aihs_this_month: analyst.aihs_this_month,
        avg_processing_time: Math.random() * 3 + 1, // Simulado
        success_rate: Math.floor(Math.random() * 10) + 90, // Simulado
        last_activity: analyst.logs[0]?.created_at || new Date().toISOString()
      })).sort((a, b) => b.total_aihs - a.total_aihs);

      console.log(`✅ ${productivity.length} analistas encontrados`);
      return { success: true, data: productivity };

    } catch (error) {
      console.error('❌ Erro ao buscar produtividade:', error);
      return { 
        success: false, 
        data: [], 
        error: error instanceof Error ? error.message : 'Erro desconhecido' 
      };
    }
  }

  /**
   * 📋 ATIVIDADE RECENTE
   * Para o card "Atividade Recente" do dashboard
   */
  static async getRecentActivity(
    limit: number = 10,
    userId?: string,
    hospitalId?: string
  ): Promise<{ success: boolean; data: AIHAuditLog[]; error?: string }> {
    try {
      console.log('📋 [AUDIT] Carregando atividade recente...');

      let query = supabase
        .from('audit_logs')
        .select(`
          id,
          action,
          table_name,
          operation_type,
          user_id,
          hospital_id,
          created_at,
          ip_address,
          new_values,
          user_profiles!audit_logs_user_id_fkey (
            full_name,
            email
          ),
          hospitals!audit_logs_hospital_id_fkey (
            name
          )
        `)
        .eq('table_name', 'aihs')
        .in('action', [
          'AIH_PROCESSING_SUCCESS',
          'AIH_PROCESSING_STARTED', 
          'AIH_PROCESSING_ERROR',
          'AIH_QUERY'
        ])
        .order('created_at', { ascending: false })
        .limit(limit);

      // Filtros opcionais
      if (userId) {
        query = query.eq('user_id', userId);
      }
      if (hospitalId && hospitalId !== 'ALL') {
        query = query.eq('hospital_id', hospitalId);
      }

      const { data, error } = await query;

      if (error) {
        console.error('❌ Erro ao buscar atividade:', error);
        return { success: false, data: [], error: error.message };
      }

      // Mapear dados
      const activities: AIHAuditLog[] = (data || []).map(log => ({
        id: log.id,
        action: log.action,
        table_name: log.table_name,
        operation_type: log.operation_type,
        user_id: log.user_id,
        user_email: (log.user_profiles as any)?.email,
        user_name: (log.user_profiles as any)?.full_name,
        hospital_id: log.hospital_id,
        hospital_name: (log.hospitals as any)?.name,
        aih_number: log.new_values?.aih_number,
        created_at: log.created_at,
        ip_address: log.ip_address,
        new_values: log.new_values
      }));

      console.log(`✅ ${activities.length} atividades carregadas`);
      return { success: true, data: activities };

    } catch (error) {
      console.error('❌ Erro ao buscar atividade:', error);
      return { 
        success: false, 
        data: [], 
        error: error instanceof Error ? error.message : 'Erro desconhecido' 
      };
    }
  }

  /**
   * 🔍 REGISTRAR CRIAÇÃO/PROCESSAMENTO DE AIH
   * Método principal para registrar quando uma AIH é criada
   */
  static async logAIHCreation(
    aihData: {
      aih_number: string;
      hospital_id: string;
      patient_name?: string;
      procedure_code?: string;
      user_id: string;
      [key: string]: any;
    }
  ): Promise<{ success: boolean; audit_id?: string; error?: string }> {
    try {
      console.log(`🔍 [AUDIT] Registrando criação da AIH: ${aihData.aih_number}`);

      const { data, error } = await supabase
        .from('audit_logs')
        .insert({
          table_name: 'aihs',
          record_id: crypto.randomUUID(), // Gerar ID temporário
          action: 'AIH_PROCESSING_SUCCESS',
          operation_type: 'CREATE',
          user_id: aihData.user_id,
          hospital_id: aihData.hospital_id,
          new_values: {
            aih_number: aihData.aih_number,
            patient_name: aihData.patient_name,
            procedure_code: aihData.procedure_code,
            hospital_id: aihData.hospital_id,
            timestamp: new Date().toISOString()
          },
          changed_fields: ['aih_number', 'patient_name', 'procedure_code'],
          ip_address: '192.168.1.1', // Placeholder
          user_agent: navigator.userAgent
        })
        .select('id')
        .single();

      if (error) {
        console.error('❌ Erro ao registrar auditoria:', error);
        return { success: false, error: error.message };
      }

      console.log('✅ Auditoria registrada:', data.id);
      return { success: true, audit_id: data.id };

    } catch (error) {
      console.error('❌ Erro na auditoria:', error);
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Erro desconhecido' 
      };
    }
  }
} 
/**
 * ================================================================
 * SERVIÇO DE REFRESH DE VIEWS MATERIALIZADAS
 * ================================================================
 * Gerencia o refresh das views materializadas de forma inteligente
 * Evita múltiplos refreshs simultâneos
 * ================================================================
 */

import { supabase } from '@/lib/supabase';

interface RefreshStatus {
  success: boolean;
  message: string;
  duration?: number;
  timestamp: string;
}

interface ViewRefreshLog {
  view_name: string;
  last_refresh: string;
  duration_ms: number;
}

class ViewRefreshService {
  private refreshInProgress = false;
  private lastRefreshTime: Date | null = null;
  private readonly REFRESH_COOLDOWN_MS = 5 * 60 * 1000; // 5 minutos

  /**
   * Verifica se as views materializadas precisam ser atualizadas
   */
  async needsRefresh(): Promise<boolean> {
    try {
      // Verificar se já passou tempo suficiente desde o último refresh
      if (this.lastRefreshTime) {
        const timeSinceLastRefresh = Date.now() - this.lastRefreshTime.getTime();
        if (timeSinceLastRefresh < this.REFRESH_COOLDOWN_MS) {
          console.log('⏸️ Refresh em cooldown, aguardando...', {
            timeRemaining: Math.ceil((this.REFRESH_COOLDOWN_MS - timeSinceLastRefresh) / 1000)
          });
          return false;
        }
      }

      // Buscar último registro de refresh do log
      const { data: logs, error } = await supabase
        .from('view_refresh_log')
        .select('*')
        .eq('view_name', 'v_doctors_aggregated')
        .order('last_refresh', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error && error.code !== 'PGRST116') { // PGRST116 = não encontrado (normal)
        console.warn('⚠️ Erro ao verificar log de refresh:', error);
      }

      // Se não houver log ou última atualização foi há mais de 1 hora
      if (!logs) {
        return true;
      }

      const lastRefresh = new Date(logs.last_refresh);
      const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);

      return lastRefresh < oneHourAgo;
    } catch (error) {
      console.error('❌ Erro ao verificar necessidade de refresh:', error);
      return false; // Em caso de erro, não forçar refresh
    }
  }

  /**
   * Executa refresh de todas as views materializadas
   */
  async refreshAllViews(): Promise<RefreshStatus> {
    // Prevenir múltiplos refreshs simultâneos
    if (this.refreshInProgress) {
      return {
        success: false,
        message: 'Refresh já em andamento',
        timestamp: new Date().toISOString()
      };
    }

    this.refreshInProgress = true;
    const startTime = Date.now();

    try {
      console.log('🔄 Iniciando refresh das views materializadas...');

      // Chamar a função RPC no Supabase
      const { data, error } = await supabase.rpc('refresh_revenue_views');

      if (error) {
        throw error;
      }

      const duration = Date.now() - startTime;
      this.lastRefreshTime = new Date();

      console.log('✅ Views materializadas atualizadas com sucesso!', {
        duration: `${duration}ms`,
        timestamp: this.lastRefreshTime.toISOString()
      });

      return {
        success: true,
        message: 'Views atualizadas com sucesso',
        duration,
        timestamp: this.lastRefreshTime.toISOString()
      };
    } catch (error: any) {
      console.error('❌ Erro ao atualizar views materializadas:', error);
      
      return {
        success: false,
        message: error.message || 'Erro desconhecido ao atualizar views',
        duration: Date.now() - startTime,
        timestamp: new Date().toISOString()
      };
    } finally {
      this.refreshInProgress = false;
    }
  }

  /**
   * Refresh inteligente: só atualiza se necessário
   */
  async smartRefresh(): Promise<RefreshStatus> {
    const needs = await this.needsRefresh();
    
    if (!needs) {
      return {
        success: true,
        message: 'Refresh não necessário (dados atualizados)',
        timestamp: new Date().toISOString()
      };
    }

    return this.refreshAllViews();
  }

  /**
   * Verifica o status das views materializadas
   */
  async getViewsStatus(): Promise<{
    views: Array<{ name: string; size: string; exists: boolean }>;
    lastRefresh?: ViewRefreshLog;
  }> {
    try {
      // Buscar informações das views via query direta
      const { data: viewsData, error: viewsError } = await supabase
        .rpc('get_materialized_views_info');

      if (viewsError) {
        console.warn('⚠️ Não foi possível obter status das views:', viewsError);
      }

      // Buscar último refresh log
      const { data: lastRefresh } = await supabase
        .from('view_refresh_log')
        .select('*')
        .order('last_refresh', { ascending: false })
        .limit(1)
        .maybeSingle();

      return {
        views: viewsData || [],
        lastRefresh: lastRefresh || undefined
      };
    } catch (error) {
      console.error('❌ Erro ao obter status das views:', error);
      return { views: [] };
    }
  }

  /**
   * Força refresh imediato (ignora cooldown)
   */
  async forceRefresh(): Promise<RefreshStatus> {
    console.log('🔧 Forçando refresh das views (ignorando cooldown)...');
    this.lastRefreshTime = null; // Reset cooldown
    return this.refreshAllViews();
  }

  /**
   * Agenda refresh automático (executar ao iniciar a aplicação)
   */
  scheduleAutoRefresh(intervalMinutes: number = 60): void {
    console.log(`📅 Agendando refresh automático a cada ${intervalMinutes} minutos`);
    
    // Executar imediatamente (de forma inteligente)
    this.smartRefresh();

    // Agendar execuções futuras
    setInterval(() => {
      this.smartRefresh();
    }, intervalMinutes * 60 * 1000);
  }
}

// Exportar instância singleton
export const viewRefreshService = new ViewRefreshService();

// Exportar classe para testes
export default ViewRefreshService;


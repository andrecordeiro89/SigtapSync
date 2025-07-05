import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { AIHAuditService } from '../services/aihAuditService';
import { toast } from 'sonner';

/**
 * 🔍 HOOK DE AUDITORIA AIH
 * Facilita o uso da auditoria em componentes
 */

export const useAIHAudit = () => {
  const { user, canAccessAllHospitals } = useAuth();
  const [loading, setLoading] = useState(false);

  /**
   * 📊 Registrar processamento de AIH
   */
  const logAIHProcessing = async (aihData: {
    aih_number: string;
    patient_name?: string;
    procedure_code?: string;
    hospital_id?: string;
    [key: string]: any;
  }) => {
    if (!user) {
      console.warn('❌ Usuário não autenticado para auditoria');
      return { success: false, error: 'Usuário não autenticado' };
    }

    try {
      console.log('🔍 Registrando processamento de AIH:', aihData.aih_number);
      
      const result = await AIHAuditService.logAIHCreation({
        ...aihData,
        user_id: user.id,
        hospital_id: aihData.hospital_id || user.hospital_id || 'unknown'
      });

      if (result.success) {
        console.log('✅ Auditoria registrada com sucesso');
        return { success: true, audit_id: result.audit_id };
      } else {
        console.error('❌ Falha na auditoria:', result.error);
        return { success: false, error: result.error };
      }

    } catch (error) {
      console.error('❌ Erro inesperado na auditoria:', error);
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Erro desconhecido' 
      };
    }
  };

  /**
   * 📈 Obter estatísticas de auditoria
   */
  const getAuditStats = async () => {
    if (!user) return { success: false, error: 'Usuário não autenticado' };

    try {
      setLoading(true);
      const hospitalId = canAccessAllHospitals ? undefined : user.hospital_id;
      
      const result = await AIHAuditService.getAIHStats(hospitalId);
      
      if (result.success) {
        console.log('📊 Estatísticas carregadas:', result.data);
        return { success: true, data: result.data };
      } else {
        console.error('❌ Erro ao carregar estatísticas:', result.error);
        return { success: false, error: result.error };
      }

    } catch (error) {
      console.error('❌ Erro inesperado:', error);
      return { success: false, error: 'Erro inesperado' };
    } finally {
      setLoading(false);
    }
  };

  /**
   * 👥 Obter produtividade dos analistas
   */
  const getAnalystProductivity = async (period: 'today' | 'week' | 'month' | 'all' = 'all') => {
    if (!user) return { success: false, error: 'Usuário não autenticado' };

    try {
      setLoading(true);
      const hospitalId = canAccessAllHospitals ? undefined : user.hospital_id;
      
      const result = await AIHAuditService.getAnalystProductivity(hospitalId, period);
      
      if (result.success) {
        console.log(`👥 ${result.data.length} analistas encontrados`);
        return { success: true, data: result.data };
      } else {
        console.error('❌ Erro ao carregar analistas:', result.error);
        return { success: false, error: result.error };
      }

    } catch (error) {
      console.error('❌ Erro inesperado:', error);
      return { success: false, error: 'Erro inesperado' };
    } finally {
      setLoading(false);
    }
  };

  /**
   * 📋 Obter atividade recente
   */
  const getRecentActivity = async (limit: number = 10) => {
    if (!user) return { success: false, error: 'Usuário não autenticado' };

    try {
      setLoading(true);
      const hospitalId = canAccessAllHospitals ? undefined : user.hospital_id;
      
      const result = await AIHAuditService.getRecentActivity(limit, user.id, hospitalId);
      
      if (result.success) {
        console.log(`📋 ${result.data.length} atividades carregadas`);
        return { success: true, data: result.data };
      } else {
        console.error('❌ Erro ao carregar atividade:', result.error);
        return { success: false, error: result.error };
      }

    } catch (error) {
      console.error('❌ Erro inesperado:', error);
      return { success: false, error: 'Erro inesperado' };
    } finally {
      setLoading(false);
    }
  };

  /**
   * 🔍 Função auxiliar para registrar AIH com toast
   */
  const logAIHWithToast = async (aihData: {
    aih_number: string;
    patient_name?: string;
    procedure_code?: string;
    hospital_id?: string;
    [key: string]: any;
  }) => {
    const result = await logAIHProcessing(aihData);
    
    if (result.success) {
      toast.success(`✅ AIH ${aihData.aih_number} registrada na auditoria`);
    } else {
      toast.error(`❌ Falha na auditoria: ${result.error}`);
    }
    
    return result;
  };

  return {
    // Funções principais
    logAIHProcessing,
    logAIHWithToast,
    getAuditStats,
    getAnalystProductivity,
    getRecentActivity,
    
    // Estado
    loading,
    
    // Informações do usuário
    user,
    canAccessAllHospitals,
    
    // Verificações de permissão
    canAudit: Boolean(user),
    hasFullAccess: canAccessAllHospitals
  };
};

/**
 * 🔍 HOOK SIMPLIFICADO PARA COMPONENTES
 * Carrega automaticamente os dados principais
 */
export const useAIHAuditData = () => {
  const { user } = useAuth();
  const [stats, setStats] = useState(null);
  const [activity, setActivity] = useState([]);
  const [analysts, setAnalysts] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user) {
      loadData();
    }
  }, [user]);

  const loadData = async () => {
    try {
      setLoading(true);
      
      const audit = useAIHAudit();
      
      // Carregar dados em paralelo
      const [statsResult, activityResult, analystsResult] = await Promise.all([
        audit.getAuditStats(),
        audit.getRecentActivity(15),
        audit.getAnalystProductivity('all')
      ]);

      if (statsResult.success) setStats(statsResult.data);
      if (activityResult.success) setActivity(activityResult.data);
      if (analystsResult.success) setAnalysts(analystsResult.data);

    } catch (error) {
      console.error('❌ Erro ao carregar dados de auditoria:', error);
      toast.error('Erro ao carregar dados de auditoria');
    } finally {
      setLoading(false);
    }
  };

  return {
    stats,
    activity,
    analysts,
    loading,
    reload: loadData
  };
}; 
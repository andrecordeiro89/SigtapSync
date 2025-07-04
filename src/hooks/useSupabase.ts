import { useState } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { toast } from 'sonner';

export interface AIHProcessingResult {
  success: boolean;
  aih_id?: string;
  error?: string;
  audit_id?: string;
}

export interface AIHData {
  aih_number: string;
  patients?: { name: string };
  procedure_code?: string;
  admission_date?: string;
  hospital_id: string;
  [key: string]: any;
}

export interface HospitalStats {
  hospital_id: string;
  hospital_name: string;
  total_aihs: number;
  processing_count: number;
  completed_count: number;
  error_count: number;
}

export const useSupabaseAIH = () => {
  const { user, logAuditAction, hasFullAccess, canAccessAllHospitals } = useAuth();
  const [loading, setLoading] = useState(false);

  // Processar AIH com rastreabilidade completa
  const processAIH = async (aihData: AIHData): Promise<AIHProcessingResult> => {
    if (!user) {
      return { success: false, error: 'Usuário não autenticado' };
    }

    // Verificar se o usuário tem acesso ao hospital da AIH
    if (!hasFullAccess() && user.hospital_id !== 'ALL' && user.hospital_id !== aihData.hospital_id) {
      return { success: false, error: 'Você não tem acesso a este hospital' };
    }

    setLoading(true);
    
    try {
      // 1. Registrar início do processamento
      await logAuditAction('AIH_PROCESSING_STARTED', {
        table_name: 'aihs',
        aih_number: aihData.aih_number,
        hospital_id: aihData.hospital_id,
        operation_type: 'AIH_UPLOAD',
        new_values: aihData
      });

      // 2. Inserir AIH no banco
      const { data: aihRecord, error: aihError } = await supabase
        .from('aihs')
        .insert({
          hospital_id: aihData.hospital_id,
          aih_number: aihData.aih_number,
          patient_name: aihData.patient_name,
          procedure_code: aihData.procedure_code,
          admission_date: aihData.admission_date,
          processing_status: 'processing',
          source_data: aihData,
          created_by: user.id,
          created_at: new Date().toISOString()
        })
        .select()
        .single();

      if (aihError) {
        // Registrar erro
        await logAuditAction('AIH_PROCESSING_ERROR', {
          table_name: 'aihs',
          aih_number: aihData.aih_number,
          hospital_id: aihData.hospital_id,
          operation_type: 'AIH_UPLOAD',
          error: aihError.message,
          error_details: aihError
        });

        return { success: false, error: aihError.message };
      }

      // 3. Registrar sucesso
      await logAuditAction('AIH_PROCESSING_SUCCESS', {
        table_name: 'aihs',
        record_id: aihRecord.id,
        aih_number: aihData.aih_number,
        hospital_id: aihData.hospital_id,
        operation_type: 'AIH_UPLOAD',
        new_values: aihRecord,
        processing_time: Date.now()
      });

      toast.success(`AIH ${aihData.aih_number} processada com sucesso!`);
      
      return { 
        success: true, 
        aih_id: aihRecord.id,
        audit_id: `logged_${Date.now()}`
      };

    } catch (error: any) {
      console.error('Erro ao processar AIH:', error);
      
      // Registrar erro crítico
      await logAuditAction('AIH_PROCESSING_CRITICAL_ERROR', {
        table_name: 'aihs',
        aih_number: aihData.aih_number,
        hospital_id: aihData.hospital_id,
        operation_type: 'AIH_UPLOAD',
        error: error.message,
        stack_trace: error.stack
      });

      toast.error('Erro crítico ao processar AIH');
      return { success: false, error: error.message };
    } finally {
      setLoading(false);
    }
  };

  // Buscar AIHs com base no nível de acesso do usuário
  const getAIHs = async (limit: number = 50, hospitalId?: string) => {
    if (!user) {
      return { data: [], error: 'Usuário não autenticado' };
    }

    try {
      let query = supabase
        .from('aihs')
        .select(`
          id,
          aih_number,
          procedure_code,
          admission_date,
          processing_status,
          hospital_id,
          created_at,
          processed_at,
          created_by,
          patients!aihs_patient_id_fkey(name),
          hospitals!aihs_hospital_id_fkey(name, cnpj, city, state)
        `)
        .order('created_at', { ascending: false })
        .limit(limit);

      // Aplicar filtros baseados no acesso do usuário
      if (!canAccessAllHospitals()) {
        // Usuário de hospital específico
        query = query.eq('hospital_id', user.hospital_id);
      } else if (hospitalId && hospitalId !== 'ALL') {
        // Admin filtrando por hospital específico
        query = query.eq('hospital_id', hospitalId);
      }
      // Se é admin e não especificou hospital, mostra todos

      const { data, error } = await query;

      if (error) {
        console.error('Erro ao buscar AIHs:', error);
        return { data: [], error: error.message };
      }

      // Registrar consulta
      await logAuditAction('AIH_QUERY', {
        table_name: 'aihs',
        hospital_id: hospitalId || user.hospital_id,
        operation_type: 'DATA_ACCESS',
        query_params: { limit, hospitalId },
        results_count: data?.length || 0,
        access_level: canAccessAllHospitals() ? 'FULL_ACCESS' : 'HOSPITAL_SPECIFIC'
      });

      return { data: data || [], error: null };
    } catch (error: any) {
      console.error('Erro inesperado ao buscar AIHs:', error);
      return { data: [], error: error.message };
    }
  };

  // Buscar AIHs do hospital atual (para compatibilidade)
  const getHospitalAIHs = async (limit: number = 50) => {
    return getAIHs(limit, user?.hospital_id);
  };

  // Buscar estatísticas por hospital (apenas para admins)
  const getHospitalStats = async (): Promise<{ data: HospitalStats[], error: string | null }> => {
    if (!user || !canAccessAllHospitals()) {
      return { data: [], error: 'Acesso negado - função apenas para administradores' };
    }

    try {
      const { data, error } = await supabase
        .from('aihs')
        .select(`
          hospital_id,
          processing_status,
          hospitals!aihs_hospital_id_fkey(name)
        `);

      if (error) {
        return { data: [], error: error.message };
      }

      // Processar estatísticas
      const statsMap = new Map<string, HospitalStats>();

      data.forEach(aih => {
        const hospitalId = aih.hospital_id;
        
        if (!statsMap.has(hospitalId)) {
          statsMap.set(hospitalId, {
            hospital_id: hospitalId,
            hospital_name: (aih.hospitals as any)?.name || 'Nome não disponível',
            total_aihs: 0,
            processing_count: 0,
            completed_count: 0,
            error_count: 0
          });
        }

        const stats = statsMap.get(hospitalId)!;
        stats.total_aihs++;

        switch (aih.processing_status) {
          case 'processing':
            stats.processing_count++;
            break;
          case 'completed':
            stats.completed_count++;
            break;
          case 'error':
            stats.error_count++;
            break;
        }
      });

      // Registrar consulta de estatísticas
      await logAuditAction('HOSPITAL_STATS_QUERY', {
        table_name: 'aihs',
        operation_type: 'ADMIN_STATS',
        results_count: statsMap.size,
        access_level: 'FULL_ACCESS'
      });

      return { data: Array.from(statsMap.values()), error: null };
    } catch (error: any) {
      console.error('Erro ao buscar estatísticas:', error);
      return { data: [], error: error.message };
    }
  };

  // Buscar logs de auditoria com filtros avançados
  const getAuditLogs = async (limit: number = 50, filters?: {
    hospitalId?: string;
    action?: string;
    userId?: string;
    startDate?: string;
    endDate?: string;
  }) => {
    if (!user) {
      return { data: [], error: 'Usuário não autenticado' };
    }

    try {
      let query = supabase
        .from('audit_logs')
        .select(`
          id,
          action,
          table_name,
          operation_type,
          created_at,
          new_values,
          user_id,
          hospital_id,
          ip_address
        `)
        .order('created_at', { ascending: false })
        .limit(limit);

      // Aplicar filtros baseados no acesso
      if (!canAccessAllHospitals()) {
        // Usuário normal: apenas seus próprios logs
        query = query.eq('user_id', user.id).eq('hospital_id', user.hospital_id);
      } else {
        // Admin: pode aplicar filtros opcionais
        if (filters?.hospitalId && filters.hospitalId !== 'ALL') {
          query = query.eq('hospital_id', filters.hospitalId);
        }
        if (filters?.action) {
          query = query.eq('action', filters.action);
        }
        if (filters?.userId) {
          query = query.eq('user_id', filters.userId);
        }
        if (filters?.startDate) {
          query = query.gte('created_at', filters.startDate);
        }
        if (filters?.endDate) {
          query = query.lte('created_at', filters.endDate);
        }
      }

      const { data, error } = await query;

      if (error) {
        console.error('Erro ao buscar logs de auditoria:', error);
        return { data: [], error: error.message };
      }

      return { data: data || [], error: null };
    } catch (error: any) {
      console.error('Erro inesperado ao buscar logs:', error);
      return { data: [], error: error.message };
    }
  };

  // Buscar logs de auditoria do usuário (para compatibilidade)
  const getUserAuditLogs = async (limit: number = 20) => {
    return getAuditLogs(limit, { userId: user?.id });
  };

  // Função para obter totais gerais (apenas admins)
  const getSystemTotals = async () => {
    if (!user || !canAccessAllHospitals()) {
      return { data: null, error: 'Acesso negado' };
    }

    try {
      // Buscar totais em paralelo
      const [aihsResult, usersResult, hospitalsResult] = await Promise.all([
        supabase.from('aihs').select('id', { count: 'exact' }),
        supabase.from('user_profiles').select('id', { count: 'exact' }).eq('is_active', true),
        supabase.from('hospitals').select('id', { count: 'exact' }).eq('is_active', true)
      ]);

      return {
        data: {
          total_aihs: aihsResult.count || 0,
          total_users: usersResult.count || 0,
          total_hospitals: hospitalsResult.count || 0
        },
        error: null
      };
    } catch (error: any) {
      return { data: null, error: error.message };
    }
  };

  return {
    // Funções básicas
    processAIH,
    getAIHs,
    getHospitalAIHs, // Compatibilidade
    getUserAuditLogs, // Compatibilidade
    
    // Funções administrativas
    getHospitalStats,
    getAuditLogs,
    getSystemTotals,
    
    // Estado
    loading,
    
    // Informações de acesso
    hasFullAccess: hasFullAccess(),
    canAccessAllHospitals: canAccessAllHospitals(),
    currentHospital: user?.hospital_id || null
  };
}; 
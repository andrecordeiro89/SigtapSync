// ================================================================
// 🔧 SERVIÇO BASEADO 100% NA TABELA PROCEDURE_RECORDS
// ================================================================

import { supabase } from '../lib/supabase';

// 📋 Interface baseada na estrutura REAL da tabela procedure_records
export interface ProcedureRecord {
  // Key Identification
  id: string;
  hospital_id: string;
  patient_id: string;
  procedure_id: string;
  aih_id?: string;
  aih_match_id?: string;
  
  // Procedure Details
  procedure_date: string;
  procedure_code: string;
  procedure_name: string;
  procedure_description?: string;
  procedure_code_original?: string;
  
  // Financial Information  
  value_charged?: number;
  value_original?: number;
  porcentagem_sus?: number;
  total_value?: number;
  unit_value?: number;
  
  // Professional Details
  professional?: string;
  professional_cbo?: string;
  professional_cns?: string;
  professional_name?: string;
  
  // Billing and Status
  billing_status?: string;
  billing_date?: string;
  payment_date?: string;
  match_status?: string;
  match_confidence?: number;
  
  // Procedure Characteristics
  quantity?: number;
  care_modality?: string;
  care_character?: string;
  complexity?: string;
  authorization_type?: string;
  
  // Metadata
  created_at: string;
  created_by?: string;
  updated_at?: string;
  
  // Additional
  sequencia?: number;
  authorization_number?: string;
  notes?: string;
  source_system?: string;
  external_id?: string;
}

export class ProcedureRecordsService {
  
  /**
   * 🔍 BUSCAR PROCEDIMENTOS POR PATIENT_ID 
   * (100% baseado na tabela procedure_records)
   */
  static async getProceduresByPatientId(patientId: string, options?: { auditMode?: boolean; excludeAnesthetist?: boolean }): Promise<{
    success: boolean;
    procedures: ProcedureRecord[];
    error?: string;
  }> {
    try {
      console.log('🔍 [PROCEDURE_RECORDS] Buscando procedimentos para patient_id:', patientId);
      
      let query = supabase
        .from('procedure_records')
        .select(`
          id,
          hospital_id,
          patient_id,
          procedure_id,
          aih_id,
          procedure_date,
          procedure_code,
          procedure_name,
          procedure_description,
          procedure_code_original,
          value_charged,
          value_original,
          total_value,
          unit_value,
          professional,
          professional_cbo,
          professional_cns,
          professional_name,
          billing_status,
          billing_date,
          match_status,
          match_confidence,
          quantity,
          care_modality,
          care_character,
          complexity,
          authorization_type,
          created_at,
          sequencia,
          authorization_number,
          notes
        `)
        .eq('patient_id', patientId)
        .order('procedure_date', { ascending: false });

      // Opcional: filtrar anestesistas (CBO 225151) conforme regra anterior
      if (options?.excludeAnesthetist) {
        query = query.or(
          'professional_cbo.is.null,' +
          'professional_cbo.neq.225151,' +
          'and(professional_cbo.eq.225151,procedure_code.like.03%),' +
          'and(professional_cbo.eq.225151,procedure_code.eq."04.17.01.001-0")'
        );
      }

      const { data, error } = await query;

      if (error) {
        console.error('❌ [PROCEDURE_RECORDS] Erro ao buscar procedimentos:', error);
        return { success: false, procedures: [], error: error.message };
      }

      console.log(`✅ [PROCEDURE_RECORDS] Encontrados ${data?.length || 0} procedimentos para patient_id: ${patientId}`);
      
      if (data && data.length > 0) {
        console.log('📋 [PROCEDURE_RECORDS] Exemplo de procedimento:', data[0]);
      }
      
      return { success: true, procedures: data || [] };
      
    } catch (error) {
      console.error('💥 [PROCEDURE_RECORDS] Erro crítico:', error);
      return { 
        success: false, 
        procedures: [], 
        error: error instanceof Error ? error.message : 'Erro desconhecido' 
      };
    }
  }
  
  /**
   * 🔍 BUSCAR PROCEDIMENTOS POR MÚLTIPLOS PATIENT_IDs
   */
  static async getProceduresByPatientIds(patientIds: string[], options?: { auditMode?: boolean; excludeAnesthetist?: boolean }): Promise<{
    success: boolean;
    procedures: ProcedureRecord[];
    proceduresByPatientId: Map<string, ProcedureRecord[]>;
    error?: string;
  }> {
    try {
      console.log(`🔍 [PROCEDURE_RECORDS] Buscando procedimentos para ${patientIds.length} pacientes`);
      console.log('🔍 [PROCEDURE_RECORDS] Patient IDs (primeiros 3):', patientIds.slice(0, 3));
      
      let query = supabase
        .from('procedure_records')
        .select(`
          id,
          hospital_id,
          patient_id,
          procedure_id,
          aih_id,
          procedure_date,
          procedure_code,
          procedure_name,
          procedure_description,
          procedure_code_original,
          value_charged,
          value_original,
          total_value,
          unit_value,
          professional,
          professional_cbo,
          professional_cns,
          professional_name,
          billing_status,
          billing_date,
          match_status,
          match_confidence,
          quantity,
          care_modality,
          care_character,
          complexity,
          authorization_type,
          created_at,
          sequencia,
          authorization_number,
          notes
        `)
        .in('patient_id', patientIds)
        .order('procedure_date', { ascending: false });

      if (options?.excludeAnesthetist) {
        query = query.or(
          'professional_cbo.is.null,' +
          'professional_cbo.neq.225151,' +
          'and(professional_cbo.eq.225151,procedure_code.like.03%),' +
          'and(professional_cbo.eq.225151,procedure_code.eq."04.17.01.001-0")'
        );
      }

      const { data, error } = await query;

      if (error) {
        console.error('❌ [PROCEDURE_RECORDS] Erro ao buscar procedimentos múltiplos:', error);
        return { 
          success: false, 
          procedures: [], 
          proceduresByPatientId: new Map(),
          error: error.message 
        };
      }

      console.log(`✅ [PROCEDURE_RECORDS] Encontrados ${data?.length || 0} procedimentos total`);
      
      // Organizar procedimentos por patient_id
      const proceduresByPatientId = new Map<string, ProcedureRecord[]>();
      
      (data || []).forEach(procedure => {
        const patientId = procedure.patient_id;
        if (!proceduresByPatientId.has(patientId)) {
          proceduresByPatientId.set(patientId, []);
        }
        proceduresByPatientId.get(patientId)!.push(procedure);
      });
      
      console.log('📊 [PROCEDURE_RECORDS] Distribuição por paciente:', 
        Array.from(proceduresByPatientId.entries()).map(([id, procs]) => `${id}: ${procs.length}`).slice(0, 5)
      );
      
      return { 
        success: true, 
        procedures: data || [],
        proceduresByPatientId
      };
      
    } catch (error) {
      console.error('💥 [PROCEDURE_RECORDS] Erro crítico múltiplos:', error);
      return { 
        success: false, 
        procedures: [], 
        proceduresByPatientId: new Map(),
        error: error instanceof Error ? error.message : 'Erro desconhecido' 
      };
    }
  }

  /**
   * 🔍 BUSCAR PROCEDIMENTOS POR AIH_ID (fallback caso patient_id não esteja preenchido)
   */
  static async getProceduresByAihIds(aihIds: string[], options?: { auditMode?: boolean; excludeAnesthetist?: boolean }): Promise<{
    success: boolean;
    proceduresByAihId: Map<string, ProcedureRecord[]>;
    error?: string;
  }> {
    try {
      if (!aihIds || aihIds.length === 0) {
        return { success: true, proceduresByAihId: new Map() };
      }
      let query = supabase
        .from('procedure_records')
        .select(`
          id,
          hospital_id,
          patient_id,
          aih_id,
          procedure_date,
          procedure_code,
          procedure_name,
          procedure_description,
          total_value,
          unit_value,
          billing_status,
          match_status,
          match_confidence,
          sequencia,
          professional_name,
          professional_cbo
        `)
        .in('aih_id', aihIds)
        .order('procedure_date', { ascending: false });

      if (options?.excludeAnesthetist) {
        query = query.or(
          'professional_cbo.is.null,' +
          'professional_cbo.neq.225151,' +
          'and(professional_cbo.eq.225151,procedure_code.like.03%),' +
          'and(professional_cbo.eq.225151,procedure_code.eq."04.17.01.001-0")'
        );
      }

      const { data, error } = await query;

      if (error) {
        return { success: false, proceduresByAihId: new Map(), error: error.message };
      }
      const map = new Map<string, ProcedureRecord[]>();
      (data || []).forEach(p => {
        const key = p.aih_id as any as string;
        if (!map.has(key)) map.set(key, []);
        map.get(key)!.push(p as any);
      });
      return { success: true, proceduresByAihId: map };
    } catch (e) {
      return { success: false, proceduresByAihId: new Map(), error: e instanceof Error ? e.message : 'Erro desconhecido' };
    }
  }
  
  /**
   * 🔍 BUSCAR TODOS OS PROCEDIMENTOS (SEM LIMITE)
   */
  static async getAllProcedures(requestedLimit?: number): Promise<{
    success: boolean;
    procedures: ProcedureRecord[];
    total: number;
    uniquePatientIds: string[];
    error?: string;
  }> {
    try {
      console.log(`🔍 [PROCEDURE_RECORDS] Buscando TODOS os procedimentos (sem limite artificial)`);
      
      // Primeiro, contar total de registros
      const { count: totalCount } = await supabase
        .from('procedure_records')
        .select('*', { count: 'exact', head: true });
      
      console.log(`📊 [PROCEDURE_RECORDS] Total de procedimentos na tabela: ${totalCount || 0}`);
      
      // Buscar TODOS os procedimentos usando paginação automática se necessário
      let allProcedures: any[] = [];
      const pageSize = 1000; // Tamanho seguro por página
      let page = 0;
      let hasMore = true;
      
      while (hasMore) {
        const { data, error } = await supabase
          .from('procedure_records')
          .select('*, procedure_description')
          .range(page * pageSize, (page + 1) * pageSize - 1)
          .order('created_at', { ascending: false });

        if (error) {
          console.error(`❌ [PROCEDURE_RECORDS] Erro na página ${page}:`, error);
          return {
            success: false,
            procedures: [],
            total: 0,
            uniquePatientIds: [],
            error: error.message
          };
        }
        
        if (data && data.length > 0) {
          allProcedures.push(...data);
          console.log(`✅ [PROCEDURE_RECORDS] Página ${page + 1}: ${data.length} procedimentos (total: ${allProcedures.length})`);
          
          // Se retornou menos que pageSize, chegamos ao fim
          hasMore = data.length === pageSize;
          page++;
        } else {
          hasMore = false;
        }
      }
      
      const uniquePatientIds = Array.from(new Set(allProcedures.map(p => p.patient_id)));
      
      console.log(`🎉 [PROCEDURE_RECORDS] SUCESSO! Carregados ${allProcedures.length} procedimentos TOTAIS`);
      console.log(`👥 [PROCEDURE_RECORDS] Pacientes únicos: ${uniquePatientIds.length}`);
      console.log(`📊 [PROCEDURE_RECORDS] Páginas processadas: ${page}`);
      
      return {
        success: true,
        procedures: allProcedures,
        total: totalCount || 0,
        uniquePatientIds
      };
      
    } catch (error) {
      console.error('💥 [PROCEDURE_RECORDS] Erro crítico na busca completa:', error);
      return {
        success: false,
        procedures: [],
        total: 0,
        uniquePatientIds: [],
        error: error instanceof Error ? error.message : 'Erro desconhecido'
      };
    }
  }
  
  /**
   * 🔍 VERIFICAR ESTRUTURA DA TABELA PROCEDURE_RECORDS
   */
  static async getTableInfo(): Promise<{
    success: boolean;
    columns?: string[];
    sampleData?: any[];
    error?: string;
  }> {
    try {
      console.log('🔍 [PROCEDURE_RECORDS] Verificando estrutura da tabela...');
      
      const { data, error } = await supabase
        .from('procedure_records')
        .select('*')
        .limit(2);

      if (error) {
        console.error('❌ [PROCEDURE_RECORDS] Erro ao acessar tabela:', error);
        return {
          success: false,
          error: error.message
        };
      }
      
      const columns = data && data.length > 0 ? Object.keys(data[0]) : [];
      
      console.log('✅ [PROCEDURE_RECORDS] Colunas disponíveis:', columns.length);
      console.log('📋 [PROCEDURE_RECORDS] Primeiras colunas:', columns.slice(0, 10));
      
      return {
        success: true,
        columns,
        sampleData: data
      };
      
    } catch (error) {
      console.error('💥 [PROCEDURE_RECORDS] Erro crítico na estrutura:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Erro desconhecido'
      };
    }
  }
}
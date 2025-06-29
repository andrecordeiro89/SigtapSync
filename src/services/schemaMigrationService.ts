import { supabase } from '../lib/supabase';

export interface MigrationResult {
  success: boolean;
  message: string;
  errors?: string[];
  appliedStatements?: string[];
}

export class SchemaMigrationService {
  /**
   * Aplica expansão do schema AIH no banco Supabase
   * Usa função RPC criada no banco para executar as migrações
   */
  static async applyAIHSchemaExpansion(): Promise<MigrationResult> {
    console.log('🔄 Iniciando aplicação da expansão do schema AIH...');
    console.log('📋 IMPORTANTE: A função RPC deve estar criada no Supabase primeiro!');
    
    try {
      // Chamar função RPC que executa as migrações
      const { data, error } = await supabase.rpc('apply_aih_schema_migration');
      
      if (error) {
        console.error('❌ Erro ao chamar função de migração:', error);
        
        // Se a função não existe, dar instruções claras
        if (error.message.includes('function') && error.message.includes('does not exist')) {
          return {
            success: false,
            message: '🚨 Função de migração não encontrada! Execute o SQL no painel do Supabase primeiro.',
            errors: [
              'A função apply_aih_schema_migration() não existe no banco.',
              'Execute o arquivo database/create_schema_migration_function.sql no SQL Editor do Supabase.',
              'Após executar, tente novamente.'
            ]
          };
        }
        
        return {
          success: false,
          message: `Erro na migração: ${error.message}`,
          errors: [error.message]
        };
      }
      
      if (!data) {
        return {
          success: false,
          message: 'Nenhum resultado retornado da migração',
          errors: ['Resultado vazio da função RPC']
        };
      }
      
      console.log('📊 Resultado da migração:', data);
      
      const result = data as {
        success: boolean;
        applied: string[];
        errors: string[];
        total_applied: number;
        total_errors: number;
      };
      
      if (result.success) {
        console.log(`✅ Migração bem-sucedida! ${result.total_applied} statements aplicados`);
        return {
          success: true,
          message: `Schema expandido com sucesso! ${result.total_applied} mudanças aplicadas.`,
          appliedStatements: result.applied,
          errors: result.errors.length > 0 ? result.errors : undefined
        };
      } else {
        console.warn(`⚠️ Migração com problemas: ${result.total_errors} erros`);
        return {
          success: false,
          message: `Migração com problemas: ${result.total_errors} erros encontrados`,
          errors: result.errors,
          appliedStatements: result.applied
        };
      }
      
    } catch (error) {
      console.error('❌ Erro crítico na migração:', error);
      return {
        success: false,
        message: `Erro crítico: ${error instanceof Error ? error.message : 'Erro desconhecido'}`,
        errors: [error instanceof Error ? error.message : 'Erro desconhecido']
      };
    }
  }

  /**
   * Verifica se o schema já foi expandido
   * Usa tentativa de SELECT para verificar se colunas existem
   */
  static async checkSchemaExpansion(): Promise<{
    aihsExpanded: boolean;
    patientsExpanded: boolean;
    message: string;
  }> {
    try {
      console.log('🔍 Verificando status do schema...');
      
      let aihsExpanded = false;
      let patientsExpanded = false;
      
      // Verificar tabela aihs - tentar selecionar campos novos
      try {
        const { error: aihsError } = await supabase
          .from('aihs')
          .select('aih_situation, aih_type, authorization_date, cns_authorizer, specialty')
          .limit(1);
        
        aihsExpanded = !aihsError;
        if (aihsExpanded) {
          console.log('✅ Tabela aihs: Schema expandido');
        } else {
          console.log('⚠️ Tabela aihs: Schema não expandido');
          console.log('Erro:', aihsError?.message);
        }
      } catch (err) {
        console.log('⚠️ Tabela aihs: Schema não expandido (erro na consulta)');
        aihsExpanded = false;
      }
      
      // Verificar tabela patients - tentar selecionar campos novos  
      try {
        const { error: patientsError } = await supabase
          .from('patients')
          .select('medical_record, nationality, mother_name, neighborhood')
          .limit(1);
        
        patientsExpanded = !patientsError;
        if (patientsExpanded) {
          console.log('✅ Tabela patients: Schema expandido');
        } else {
          console.log('⚠️ Tabela patients: Schema não expandido');
          console.log('Erro:', patientsError?.message);
        }
      } catch (err) {
        console.log('⚠️ Tabela patients: Schema não expandido (erro na consulta)');
        patientsExpanded = false;
      }
      
      const message = `AIHs: ${aihsExpanded ? '✅ Expandido' : '❌ Não expandido'}, Patients: ${patientsExpanded ? '✅ Expandido' : '❌ Não expandido'}`;
      
      return {
        aihsExpanded,
        patientsExpanded,
        message
      };
      
    } catch (error) {
      console.error('❌ Erro ao verificar schema:', error);
      return {
        aihsExpanded: false,
        patientsExpanded: false,
        message: `Erro ao verificar schema: ${error instanceof Error ? error.message : 'Erro desconhecido'}`
      };
    }
  }
} 
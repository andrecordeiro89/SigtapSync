import React, { createContext, useContext, ReactNode, useState, useEffect } from 'react';
import { useSigtapData } from '../hooks/useSigtapData';
import { SigtapProcedure } from '../types';
import { SigtapProcessingResult } from '../utils/sigtapProcessor';

interface SigtapContextType {
  procedures: SigtapProcedure[];
  isLoading: boolean;
  error: string | null;
  lastImportDate: string | null;
  totalProcedures: number;
  processingProgress: number;
  currentPage?: number;
  totalPages?: number;
  importSigtapFile: (file: File | null, directProcedures?: SigtapProcedure[]) => Promise<SigtapProcessingResult>;
  clearData: () => void;
  
  // Novas funcionalidades para Supabase
  isSupabaseEnabled: boolean;
  loadFromSupabase: () => Promise<void>;
  saveToSupabase: (procedures: SigtapProcedure[], versionName: string) => Promise<void>;
}

const SigtapContext = createContext<SigtapContextType | undefined>(undefined);

export const SigtapProvider = ({ children }: { children: ReactNode }) => {
  const sigtapData = useSigtapData();
  const [isSupabaseEnabled, setIsSupabaseEnabled] = useState(false);
  
  // Verificar se Supabase está configurado
  useEffect(() => {
    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
    const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
    
    if (supabaseUrl && supabaseKey && supabaseUrl !== 'sua_url_do_supabase_aqui') {
      setIsSupabaseEnabled(true);
      console.log('🚀 Supabase habilitado - carregando dados...');
      loadFromSupabase();
    } else {
      console.log('ℹ️ Supabase não configurado - usando Context API local');
    }
  }, []);

  const loadFromSupabase = async () => {
    if (!isSupabaseEnabled) return;
    
    try {
      console.log('📥 Carregando procedimentos do Supabase...');
      
      // Import dinâmico para evitar problemas de módulo
      const { SigtapService } = await import('../services/supabaseService');
      
      // Verificação mais robusta do SigtapService
      if (!SigtapService) {
        console.warn('⚠️ SigtapService não foi importado corretamente');
        return;
      }
      
      if (typeof SigtapService.getActiveProcedures !== 'function') {
        console.warn('⚠️ Método getActiveProcedures não está disponível no SigtapService');
        console.log('SigtapService disponível:', Object.getOwnPropertyNames(SigtapService));
        return;
      }
      
      const procedures = await SigtapService.getActiveProcedures();
      
      if (procedures && procedures.length > 0) {
        console.log(`✅ ${procedures.length} procedimentos carregados do Supabase`);
        
        // Simular resultado de importação para manter compatibilidade
        const result: SigtapProcessingResult = {
          success: true,
          message: `${procedures.length} procedimentos carregados do banco de dados`,
          procedures,
          totalProcessed: procedures.length
        };
        
        // Usar método direto do contexto existente
        await sigtapData.importSigtapFile(null, procedures);
      } else {
        console.log('ℹ️ Nenhum procedimento ativo encontrado no banco');
      }
    } catch (error) {
      console.error('❌ Erro ao carregar dados do Supabase:', error);
    }
  };

  const saveToSupabase = async (procedures: SigtapProcedure[], versionName: string) => {
    if (!isSupabaseEnabled) {
      console.log('ℹ️ Supabase não habilitado - dados salvos apenas localmente');
      return;
    }

    try {
      console.log('💾 Salvando no Supabase...');
      
      // Import dinâmico para evitar problemas de módulo
      const { SigtapService } = await import('../services/supabaseService');
      
      // Verificação mais robusta do SigtapService
      if (!SigtapService) {
        throw new Error('SigtapService não foi importado corretamente');
      }
      
      if (typeof SigtapService.createVersion !== 'function') {
        console.error('Métodos disponíveis no SigtapService:', Object.getOwnPropertyNames(SigtapService));
        throw new Error('Método createVersion não está disponível no SigtapService');
      }
      
      // Criar nova versão
      const version = await SigtapService.createVersion({
        version_name: versionName,
        file_type: 'pdf',
        total_procedures: procedures.length,
        extraction_method: 'hybrid',
        import_status: 'completed',
        import_date: new Date().toISOString(),
        is_active: false
      });

      console.log('✅ Versão criada:', version.id);

      // Salvar procedimentos
      await SigtapService.saveProcedures(version.id, procedures);
      console.log('✅ Procedimentos salvos');
      
      // Ativar versão
      await SigtapService.setActiveVersion(version.id);
      console.log('✅ Versão ativada');
      
      console.log('🎉 Dados salvos no Supabase com sucesso!');
    } catch (error) {
      console.error('❌ Erro ao salvar no Supabase:', error);
      throw error;
    }
  };

  // Interceptar importSigtapFile para salvar no Supabase também
  const importSigtapFile = async (file: File | null, directProcedures?: SigtapProcedure[]): Promise<SigtapProcessingResult> => {
    const result = await sigtapData.importSigtapFile(file, directProcedures);
    
    // Se importação foi bem-sucedida e Supabase está habilitado, salvar também
    if (result.success && isSupabaseEnabled && result.procedures.length > 0) {
      try {
        const versionName = file ? 
          `Import_${file.name}_${new Date().toISOString().slice(0, 16)}` :
          `Direct_Import_${new Date().toISOString().slice(0, 16)}`;
          
        await saveToSupabase(result.procedures, versionName);
        
        // Atualizar mensagem de sucesso
        result.message += ' (Salvo no banco de dados)';
      } catch (error) {
        console.warn('⚠️ Dados importados localmente, mas falha ao salvar no Supabase:', error);
        result.message += ' (Erro ao salvar no banco - dados mantidos localmente)';
      }
    }
    
    return result;
  };

  const contextValue: SigtapContextType = {
    ...sigtapData,
    importSigtapFile,
    isSupabaseEnabled,
    loadFromSupabase,
    saveToSupabase
  };

  return (
    <SigtapContext.Provider value={contextValue}>
      {children}
    </SigtapContext.Provider>
  );
};

export const useSigtapContext = () => {
  const context = useContext(SigtapContext);
  if (context === undefined) {
    throw new Error('useSigtapContext deve ser usado dentro de um SigtapProvider');
  }
  return context;
};

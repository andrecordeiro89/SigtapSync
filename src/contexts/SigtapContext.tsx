import React, { createContext, useContext, ReactNode, useState, useEffect, useCallback } from 'react';
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
  forceReload: () => Promise<void>;
  
  // ✅ NOVOS CAMPOS PARA CACHE INTELIGENTE
  isInitialLoading: boolean;
  lastCacheUpdate: string | null;
  cacheStatus: 'empty' | 'loading' | 'cached' | 'error';
}

const SigtapContext = createContext<SigtapContextType | undefined>(undefined);

export const SigtapProvider = ({ children }: { children: ReactNode }) => {
  const sigtapData = useSigtapData();
  const [isSupabaseEnabled, setIsSupabaseEnabled] = useState(false);
  
  // ✅ NOVOS ESTADOS PARA CACHE INTELIGENTE
  const [isInitialLoading, setIsInitialLoading] = useState(false);
  const [lastCacheUpdate, setLastCacheUpdate] = useState<string | null>(null);
  const [cacheStatus, setCacheStatus] = useState<'empty' | 'loading' | 'cached' | 'error'>('empty');

  // ✅ DEFINIR loadFromSupabase PRIMEIRO usando useCallback para evitar dependências circulares
  const loadFromSupabase = useCallback(async () => {
    if (!isSupabaseEnabled) return;
    
    try {
      console.log('📥 🔧 CARREGAMENTO INTELIGENTE - DETECTANDO FONTE DE DADOS...');
      
      // ✅ MARCAR COMO CARREGANDO
      setIsInitialLoading(true);
      setCacheStatus('loading');
      
      // Import dinâmico para evitar problemas de módulo
      const { SigtapService } = await import('../services/supabaseService');
      
      // ESTRATÉGIA INTELIGENTE: Tentar carregar da tabela de UPLOAD primeiro
      console.log('🎯 TENTATIVA 1: Carregando da tabela sigtap_procedures (dados do upload)...');
      const uploadedProcedures = await SigtapService.getActiveProcedures();
      
      if (uploadedProcedures && uploadedProcedures.length > 0) {
        console.log(`✅ ${uploadedProcedures.length} procedimentos carregados da TABELA DE UPLOAD`);
        
        // Debug dos primeiros valores para confirmar correção
        console.log('🔍 VALORES DE TESTE (primeiros 3 procedimentos do upload):');
        uploadedProcedures.slice(0, 3).forEach((proc, index) => {
          console.log(`${index + 1}. ${proc.code}: SA=${proc.valueAmb}, SH=${proc.valueHosp}, SP=${proc.valueProf}`);
        });
        
        // Limpar dados antigos ANTES de carregar novos
        sigtapData.clearData();
        
        // Aguardar um momento para garantir limpeza
        await new Promise(resolve => setTimeout(resolve, 100));
        
        // Carregar dados do upload
        await sigtapData.importSigtapFile(null, uploadedProcedures);
        
        // ✅ MARCAR CACHE COMO ATUALIZADO
        setLastCacheUpdate(new Date().toISOString());
        setCacheStatus('cached');
        
        console.log('✅ CARREGAMENTO UPLOAD CONCLUÍDO - dados persistentes carregados');
        return; // ✅ SUCESSO - sair da função
      }
      
      // FALLBACK: Se não há dados no upload, tentar tabela oficial
      console.log('⚠️ Nenhum dado na tabela de upload, tentando tabela oficial...');
      console.log('🎯 TENTATIVA 2: Carregando da tabela sigtap_procedimentos_oficial...');
      const officialProcedures = await SigtapService.getActiveProceduresFromOfficial();
      
      if (officialProcedures && officialProcedures.length > 0) {
        console.log(`✅ ${officialProcedures.length} procedimentos carregados da TABELA OFICIAL`);
        
        // Limpar dados antigos ANTES de carregar novos
        sigtapData.clearData();
        
        // Aguardar um momento para garantir limpeza
        await new Promise(resolve => setTimeout(resolve, 100));
        
        // Carregar dados oficiais
        await sigtapData.importSigtapFile(null, officialProcedures);
        
        // ✅ MARCAR CACHE COMO ATUALIZADO
        setLastCacheUpdate(new Date().toISOString());
        setCacheStatus('cached');
        
        console.log('✅ CARREGAMENTO OFICIAL CONCLUÍDO - dados oficiais carregados');
      } else {
        console.error('❌ ERRO: Nenhum procedimento encontrado em NENHUMA tabela');
        console.log('💡 SOLUÇÃO: Importe um arquivo PDF/Excel/ZIP primeiro');
        setCacheStatus('error');
      }
    } catch (error) {
      console.error('❌ Erro ao carregar dados do Supabase:', error);
      console.error('❌ Detalhes completos do erro:', JSON.stringify(error, null, 2));
      setCacheStatus('error');
    } finally {
      // ✅ SEMPRE FINALIZAR ESTADO DE LOADING
      setIsInitialLoading(false);
    }
  }, [isSupabaseEnabled, sigtapData]);

  // ✅ CACHE INTELIGENTE: Verificar se precisa recarregar
  const shouldReload = useCallback((): boolean => {
    // Se não há dados, sempre recarregar
    if (sigtapData.procedures.length === 0) {
      console.log('🔄 CACHE: Nenhum dado - recarregando...');
      return true;
    }
    
    // Se não há cache timestamp, recarregar
    if (!lastCacheUpdate) {
      console.log('🔄 CACHE: Sem timestamp - recarregando...');
      return true;
    }
    
    // Verificar se cache está muito antigo (30 minutos)
    const now = new Date().getTime();
    const cacheTime = new Date(lastCacheUpdate).getTime();
    const cacheAge = now - cacheTime;
    const maxAge = 30 * 60 * 1000; // 30 minutos
    
    if (cacheAge > maxAge) {
      console.log(`🔄 CACHE: Expirado (${Math.round(cacheAge / 60000)}min) - recarregando...`);
      return true;
    }
    
    console.log(`✅ CACHE: Válido (${Math.round(cacheAge / 60000)}min) - usando cache`);
    return false;
  }, [sigtapData.procedures.length, lastCacheUpdate]);

  // ✅ CARREGAMENTO AUTOMÁTICO INTELIGENTE
  useEffect(() => {
    const initializeData = async () => {
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
      
      if (supabaseUrl && supabaseKey && supabaseUrl !== 'sua_url_do_supabase_aqui') {
        setIsSupabaseEnabled(true);
        console.log('🚀 Supabase habilitado - verificando cache...');
        
        // ✅ VERIFICAR SE PRECISA RECARREGAR
        if (shouldReload()) {
          console.log('🔄 Cache inválido - carregando dados...');
          await loadFromSupabase();
        } else {
          console.log('✅ Cache válido - dados já disponíveis');
          setCacheStatus('cached');
        }
      } else {
        console.log('ℹ️ Supabase não configurado - usando Context API local');
        setCacheStatus('error');
      }
    };
    
    initializeData();
  }, []); // ✅ Dependências vazias para executar apenas uma vez

  // ✅ RECARREGAR AUTOMATICAMENTE se dados sumiram
  useEffect(() => {
    if (isSupabaseEnabled && sigtapData.procedures.length === 0 && cacheStatus !== 'loading') {
      console.log('🔄 Dados perdidos - recarregando automaticamente...');
      loadFromSupabase();
    }
  }, [isSupabaseEnabled, sigtapData.procedures.length, cacheStatus, loadFromSupabase]);

  const saveToSupabase = async (procedures: SigtapProcedure[], versionName: string) => {
    if (!isSupabaseEnabled) {
      console.log('ℹ️ Supabase não habilitado - dados salvos apenas localmente');
      return;
    }

    try {
      console.log('💾 Salvando no Supabase...');
      console.log(`📊 Total de procedimentos a salvar: ${procedures.length}`);
      
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
      
      // Criar nova versão - INCLUINDO extraction_method novamente
      console.log('🔄 Criando nova versão SIGTAP...');
      const version = await SigtapService.createVersion({
        version_name: versionName,
        file_type: 'pdf',
        total_procedures: procedures.length,
        extraction_method: 'pdf', // ✅ CAMPO REATIVADO
        import_status: 'completed',
        import_date: new Date().toISOString(),
        is_active: false
      });

      console.log('✅ Versão criada:', version.id);

      // Salvar procedimentos
      console.log('💾 Salvando procedimentos no banco...');
      await SigtapService.saveProcedures(version.id, procedures);
      console.log('✅ Procedimentos salvos');
      
      // Ativar versão
      console.log('🔄 Ativando versão...');
      await SigtapService.setActiveVersion(version.id);
      console.log('✅ Versão ativada');
      
      // ✅ ATUALIZAR CACHE APÓS SALVAR
      setLastCacheUpdate(new Date().toISOString());
      setCacheStatus('cached');
      
      console.log('🎉 Dados salvos no Supabase com sucesso!');
      console.log(`📊 ${procedures.length} procedimentos persistidos no banco de dados`);
    } catch (error) {
      console.error('❌ Erro ao salvar no Supabase:', error);
      console.error('❌ Detalhes do erro:', JSON.stringify(error, null, 2));
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
          
        console.log(`🚀 Iniciando salvamento no banco: ${result.procedures.length} procedimentos`);
        await saveToSupabase(result.procedures, versionName);
        
        // Atualizar mensagem de sucesso
        result.message += ' (Salvo no banco de dados)';
        console.log('🎉 UPLOAD COMPLETO: Dados processados e persistidos no banco!');
        console.log('🎉 UPLOAD COMPLETO: Dados processados e persistidos no banco!');
      } catch (error) {
        console.warn('⚠️ Dados importados localmente, mas falha ao salvar no Supabase:', error);
        result.message += ' (Erro ao salvar no banco - dados mantidos localmente)';
      }
    }
    
    return result;
  };

  // ✅ FUNÇÃO PARA FORÇAR RECARREGAMENTO COM CACHE RESET
  const forceReload = async () => {
    console.log('🔄 Forçando recarregamento dos dados...');
    setCacheStatus('loading');
    setLastCacheUpdate(null);
    sigtapData.clearData();
    await loadFromSupabase();
  };

  const contextValue: SigtapContextType = {
    ...sigtapData,
    importSigtapFile,
    isSupabaseEnabled,
    loadFromSupabase,
    saveToSupabase,
    forceReload,
    
    // ✅ NOVOS VALORES PARA CACHE INTELIGENTE
    isInitialLoading: isInitialLoading || sigtapData.isLoading,
    lastCacheUpdate,
    cacheStatus
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

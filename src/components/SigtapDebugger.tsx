import React, { useState, useEffect } from 'react';
import { Button } from './ui/button';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Badge } from './ui/badge';
import { useSigtapContext } from '../contexts/SigtapContext';
import { supabase } from '../lib/supabase';

interface DebugInfo {
  contextProcedures: number;
  isLoading: boolean;
  supabaseEnabled: boolean;
  lastImportDate: string | null;
  dbProcedures: number;
  activeVersions: number;
  activeVersionName: string | null;
  linkedProcedures: number;
  error: string | null;
}

export const SigtapDebugger: React.FC = () => {
  const [debugInfo, setDebugInfo] = useState<DebugInfo>({
    contextProcedures: 0,
    isLoading: false,
    supabaseEnabled: false,
    lastImportDate: null,
    dbProcedures: 0,
    activeVersions: 0,
    activeVersionName: null,
    linkedProcedures: 0,
    error: null
  });
  
  const { 
    procedures, 
    isLoading, 
    isSupabaseEnabled, 
    lastImportDate, 
    loadFromSupabase,
    forceReload 
  } = useSigtapContext();

  const collectDebugInfo = async () => {
    try {
      setDebugInfo(prev => ({ ...prev, error: null }));
      
      // Info do Context
      const contextInfo = {
        contextProcedures: procedures.length,
        isLoading,
        supabaseEnabled: isSupabaseEnabled,
        lastImportDate
      };

      // Info do Banco
      let dbInfo = {
        dbProcedures: 0,
        activeVersions: 0,
        activeVersionName: null,
        linkedProcedures: 0
      };

      if (isSupabaseEnabled) {
        // Contar procedimentos na tabela
        const { count: proceduresCount } = await supabase
          .from('sigtap_procedures')
          .select('*', { count: 'exact', head: true });

        // Buscar versões ativas
        const { data: activeVersions, error: versionsError } = await supabase
          .from('sigtap_versions')
          .select('id, version_name')
          .eq('is_active', true);

        if (versionsError) {
          throw new Error(`Erro ao buscar versões: ${versionsError.message}`);
        }

        // Contar procedimentos linkados à versão ativa
        let linkedCount = 0;
        if (activeVersions && activeVersions.length > 0) {
          const { count: linkedProceduresCount } = await supabase
            .from('sigtap_procedures')
            .select('*', { count: 'exact', head: true })
            .eq('version_id', activeVersions[0].id);
          
          linkedCount = linkedProceduresCount || 0;
        }

        dbInfo = {
          dbProcedures: proceduresCount || 0,
          activeVersions: activeVersions?.length || 0,
          activeVersionName: activeVersions?.[0]?.version_name || null,
          linkedProcedures: linkedCount
        };
      }

      setDebugInfo({
        ...contextInfo,
        ...dbInfo,
        error: null
      });

    } catch (error) {
      console.error('Erro no debug:', error);
      setDebugInfo(prev => ({
        ...prev,
        error: error instanceof Error ? error.message : 'Erro desconhecido'
      }));
    }
  };

  useEffect(() => {
    collectDebugInfo();
  }, [procedures.length, isLoading, isSupabaseEnabled]);

  const getStatusColor = (condition: boolean) => condition ? 'bg-green-500' : 'bg-red-500';
  const getStatusText = (condition: boolean) => condition ? 'OK' : 'ERRO';

  return (
    <Card className="w-full max-w-4xl mx-auto">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          🔍 SIGTAP Debug - Diagnóstico de Persistência
          <Button 
            onClick={collectDebugInfo} 
            variant="outline" 
            size="sm"
          >
            Atualizar
          </Button>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        
        {/* Status Geral */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="text-center">
            <Badge className={getStatusColor(debugInfo.contextProcedures > 0)}>
              Context: {debugInfo.contextProcedures}
            </Badge>
            <p className="text-xs text-gray-600">Procedimentos na Tela</p>
          </div>
          
          <div className="text-center">
            <Badge className={getStatusColor(debugInfo.dbProcedures > 0)}>
              DB: {debugInfo.dbProcedures}
            </Badge>
            <p className="text-xs text-gray-600">Procedimentos no Banco</p>
          </div>
          
          <div className="text-center">
            <Badge className={getStatusColor(debugInfo.activeVersions === 1)}>
              Versões: {debugInfo.activeVersions}
            </Badge>
            <p className="text-xs text-gray-600">Versões Ativas</p>
          </div>
          
          <div className="text-center">
            <Badge className={getStatusColor(debugInfo.linkedProcedures > 0)}>
              Linked: {debugInfo.linkedProcedures}
            </Badge>
            <p className="text-xs text-gray-600">Procedimentos Linkados</p>
          </div>
        </div>

        {/* Detalhes */}
        <div className="bg-gray-50 p-4 rounded-lg space-y-2">
          <h3 className="font-semibold">Detalhes do Estado:</h3>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
            <div>
              <p><strong>Supabase:</strong> {debugInfo.supabaseEnabled ? '✅ Habilitado' : '❌ Desabilitado'}</p>
              <p><strong>Loading:</strong> {debugInfo.isLoading ? '🔄 Carregando' : '✅ Parado'}</p>
              <p><strong>Último Import:</strong> {debugInfo.lastImportDate ? new Date(debugInfo.lastImportDate).toLocaleString() : 'Nunca'}</p>
            </div>
            
            <div>
              <p><strong>Versão Ativa:</strong> {debugInfo.activeVersionName || 'Nenhuma'}</p>
              <p><strong>Status Persistência:</strong> {
                debugInfo.contextProcedures > 0 && debugInfo.dbProcedures > 0 && debugInfo.activeVersions === 1 
                  ? '✅ OK' 
                  : '❌ Problema'
              }</p>
            </div>
          </div>
        </div>

        {/* Diagnóstico */}
        <div className="bg-blue-50 p-4 rounded-lg">
          <h3 className="font-semibold text-blue-800">Diagnóstico:</h3>
          <div className="text-sm text-blue-700 mt-2">
            {debugInfo.error && (
              <p className="text-red-600">❌ Erro: {debugInfo.error}</p>
            )}
            
            {!debugInfo.error && (
              <>
                {debugInfo.contextProcedures === 0 && debugInfo.dbProcedures > 0 && (
                  <p>⚠️ Dados existem no banco mas não carregaram na tela. Problema de carregamento.</p>
                )}
                
                {debugInfo.dbProcedures > 0 && debugInfo.activeVersions === 0 && (
                  <p>⚠️ Procedimentos existem mas sem versão ativa. Execute fix_persistencia_sigtap_CORRIGIDO.sql</p>
                )}
                
                {debugInfo.dbProcedures > 0 && debugInfo.linkedProcedures === 0 && (
                  <p>⚠️ Procedimentos não estão linkados à versão ativa. Execute fix_permissoes_persistencia.sql</p>
                )}
                
                {debugInfo.contextProcedures > 0 && debugInfo.dbProcedures > 0 && debugInfo.activeVersions === 1 && (
                  <p>✅ Tudo funcionando corretamente! Dados persistindo como esperado.</p>
                )}
                
                {debugInfo.dbProcedures === 0 && (
                  <p>❌ Nenhum dado no banco. Faça upload de um arquivo SIGTAP primeiro.</p>
                )}
              </>
            )}
          </div>
        </div>

        {/* Ações */}
        <div className="flex gap-2 flex-wrap">
          <Button 
            onClick={() => loadFromSupabase()} 
            variant="outline"
            disabled={!debugInfo.supabaseEnabled}
          >
            🔄 Recarregar do Banco
          </Button>
          
          <Button 
            onClick={() => forceReload()} 
            variant="outline"
            disabled={!debugInfo.supabaseEnabled}
          >
            🔄 Force Reload
          </Button>
          
          <Button 
            onClick={() => {
              console.log('=== SIGTAP DEBUG INFO ===');
              console.log('Context Procedures:', debugInfo.contextProcedures);
              console.log('DB Procedures:', debugInfo.dbProcedures);
              console.log('Active Versions:', debugInfo.activeVersions);
              console.log('Linked Procedures:', debugInfo.linkedProcedures);
              console.log('Current procedures array:', procedures.slice(0, 3));
            }}
            variant="outline"
          >
            📋 Log no Console
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};

export default SigtapDebugger; 
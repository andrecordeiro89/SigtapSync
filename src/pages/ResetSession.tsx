import React, { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Alert, AlertDescription } from '../components/ui/alert';
import { RefreshCw, CheckCircle, XCircle, AlertTriangle } from 'lucide-react';
import { supabase } from '../lib/supabase';

const ResetSession = () => {
  const [status, setStatus] = useState<'idle' | 'resetting' | 'success' | 'error'>('idle');
  const [details, setDetails] = useState<string[]>([]);
  
  const addDetail = (message: string) => {
    setDetails(prev => [...prev, message]);
  };

  const performCompleteReset = async () => {
    setStatus('resetting');
    setDetails([]);
    
    try {
      addDetail('🧹 Iniciando reset completo...');
      
      // 1. Forçar logout no Supabase
      addDetail('📤 Fazendo logout forçado no Supabase...');
      await supabase.auth.signOut().catch(e => {
        addDetail(`⚠️ Aviso no logout: ${e.message}`);
      });
      
      // 2. Limpar localStorage
      addDetail('🗂️ Limpando localStorage...');
      try {
        localStorage.clear();
        addDetail('✅ localStorage limpo');
      } catch (e) {
        addDetail(`❌ Erro no localStorage: ${e}`);
      }
      
      // 3. Limpar sessionStorage
      addDetail('📂 Limpando sessionStorage...');
      try {
        sessionStorage.clear();
        addDetail('✅ sessionStorage limpo');
      } catch (e) {
        addDetail(`❌ Erro no sessionStorage: ${e}`);
      }
      
      // 4. Limpar cookies
      addDetail('🍪 Limpando cookies...');
      try {
        document.cookie.split(";").forEach(function(c) { 
          document.cookie = c.replace(/^ +/, "").replace(/=.*/, "=;expires=" + new Date().toUTCString() + ";path=/"); 
        });
        addDetail('✅ Cookies limpos');
      } catch (e) {
        addDetail(`❌ Erro nos cookies: ${e}`);
      }
      
      // 5. Limpar IndexedDB (se usado pelo Supabase)
      addDetail('💾 Limpando IndexedDB...');
      try {
        if ('indexedDB' in window) {
          await new Promise((resolve, reject) => {
            const deleteReq = indexedDB.deleteDatabase('supabase-js-db');
            deleteReq.onsuccess = () => {
              addDetail('✅ IndexedDB limpo');
              resolve(true);
            };
            deleteReq.onerror = () => {
              addDetail('⚠️ IndexedDB não encontrado (normal)');
              resolve(true);
            };
          });
        }
      } catch (e) {
        addDetail(`⚠️ IndexedDB: ${e}`);
      }
      
      addDetail('✅ Reset completo finalizado!');
      addDetail('🎉 Agora você pode ir para o app e verá a tela de login');
      setStatus('success');
      
    } catch (error: any) {
      addDetail(`❌ Erro durante reset: ${error.message}`);
      setStatus('error');
    }
  };

  const goToApp = () => {
    window.location.href = '/';
  };
  
  // Auto-reset se parâmetro estiver presente
  useEffect(() => {
    if (window.location.search.includes('auto=true')) {
      setTimeout(performCompleteReset, 1000);
    }
  }, []);

  return (
    <div className="min-h-screen bg-gradient-to-br from-red-900 via-orange-900 to-yellow-900 flex items-center justify-center p-4">
      <Card className="w-full max-w-2xl">
        <CardHeader className="text-center">
          <CardTitle className="flex items-center justify-center gap-2 text-2xl">
            <RefreshCw className={`w-6 h-6 ${status === 'resetting' ? 'animate-spin' : ''}`} />
            Reset de Sessão - SIGTAP Sync
          </CardTitle>
        </CardHeader>
        
        <CardContent className="space-y-6">
          <Alert variant={status === 'error' ? 'destructive' : 'default'}>
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              Esta página força a limpeza completa de todas as sessões e dados locais.
              Use quando o sistema estiver travado na tela "Carregando sistema...".
            </AlertDescription>
          </Alert>
          
          <div className="space-y-3">
            <Button 
              onClick={performCompleteReset}
              disabled={status === 'resetting'}
              className="w-full bg-red-600 hover:bg-red-700"
            >
              {status === 'resetting' ? (
                <>
                  <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                  Resetando...
                </>
              ) : (
                <>
                  <RefreshCw className="w-4 h-4 mr-2" />
                  🧹 Resetar Sessão Completa
                </>
              )}
            </Button>
            
            <Button 
              onClick={goToApp}
              variant="outline"
              className="w-full"
              disabled={status === 'resetting'}
            >
              📱 Ir para o App
            </Button>
          </div>
          
          {details.length > 0 && (
            <div className="bg-gray-50 rounded-lg p-4 max-h-64 overflow-y-auto">
              <h3 className="font-medium text-gray-900 mb-2">Log do Reset:</h3>
              <div className="space-y-1 text-sm font-mono">
                {details.map((detail, index) => (
                  <div key={index} className="text-gray-700">
                    {detail}
                  </div>
                ))}
              </div>
            </div>
          )}
          
          {status === 'success' && (
            <Alert>
              <CheckCircle className="h-4 w-4" />
              <AlertDescription className="font-medium">
                ✅ Reset concluído com sucesso! Clique em "Ir para o App" para acessar a tela de login.
              </AlertDescription>
            </Alert>
          )}
          
          {status === 'error' && (
            <Alert variant="destructive">
              <XCircle className="h-4 w-4" />
              <AlertDescription>
                ❌ Ocorreu um erro durante o reset. Tente fechar todas as abas do navegador e limpar cookies manualmente.
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default ResetSession; 
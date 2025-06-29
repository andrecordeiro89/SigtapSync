import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';

export function AuthDebugger() {
  const [debugInfo, setDebugInfo] = useState<any>({});
  const [isVisible, setIsVisible] = useState(true);

  useEffect(() => {
    const runDebug = async () => {
      console.log('🔍 INICIANDO DEBUG DETALHADO DA AUTENTICAÇÃO');
      
      try {
        // 1. Verificar sessão atual
        const { data: { session }, error: sessionError } = await supabase.auth.getSession();
        
        const sessionInfo = {
          hasSession: !!session,
          hasUser: !!session?.user,
          userId: session?.user?.id,
          userEmail: session?.user?.email,
          sessionError: sessionError
        };
        
        console.log('📡 SESSÃO:', sessionInfo);
        
        // 2. Se tem usuário, tentar buscar perfil
        let profileInfo = null;
        if (session?.user) {
          try {
            const { data: profile, error: profileError } = await supabase
              .from('user_profiles')
              .select('*')
              .eq('id', session.user.id)
              .single();
            
            profileInfo = {
              profileFound: !!profile,
              profileData: profile,
              profileError: profileError,
              errorCode: profileError?.code,
              errorMessage: profileError?.message
            };
            
            console.log('👤 PERFIL:', profileInfo);
          } catch (err) {
            profileInfo = {
              profileFound: false,
              criticalError: err
            };
            console.error('❌ ERRO CRÍTICO AO BUSCAR PERFIL:', err);
          }
        }
        
        // 3. Verificar tabela user_profiles
        let tableInfo = null;
        try {
          const { data: allProfiles, error: tableError } = await supabase
            .from('user_profiles')
            .select('id, email, role, full_name');
          
          tableInfo = {
            tableExists: !tableError,
            totalProfiles: allProfiles?.length || 0,
            allProfiles: allProfiles,
            tableError: tableError
          };
          
          console.log('📋 TABELA USER_PROFILES:', tableInfo);
        } catch (err) {
          tableInfo = {
            tableExists: false,
            criticalError: err
          };
          console.error('❌ ERRO CRÍTICO NA TABELA:', err);
        }
        
        // 4. Atualizar estado com todas as informações
        setDebugInfo({
          timestamp: new Date().toLocaleString(),
          session: sessionInfo,
          profile: profileInfo,
          table: tableInfo
        });
        
      } catch (error) {
        console.error('❌ ERRO CRÍTICO NO DEBUG:', error);
        setDebugInfo({
          timestamp: new Date().toLocaleString(),
          criticalError: error
        });
      }
    };
    
    runDebug();
  }, []);

  if (!isVisible) {
    return (
      <div 
        style={{
          position: 'fixed',
          top: '10px',
          right: '10px',
          background: '#333',
          color: 'white',
          padding: '10px',
          borderRadius: '5px',
          cursor: 'pointer',
          zIndex: 9999
        }}
        onClick={() => setIsVisible(true)}
      >
        🔍 Debug Auth
      </div>
    );
  }

  return (
    <div 
      style={{
        position: 'fixed',
        top: '10px',
        right: '10px',
        background: '#000',
        color: '#0f0',
        padding: '15px',
        borderRadius: '8px',
        fontFamily: 'monospace',
        fontSize: '12px',
        maxWidth: '400px',
        maxHeight: '80vh',
        overflow: 'auto',
        zIndex: 9999,
        border: '2px solid #0f0'
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px' }}>
        <strong>🔍 AUTH DEBUG</strong>
        <button 
          onClick={() => setIsVisible(false)}
          style={{ background: 'red', color: 'white', border: 'none', cursor: 'pointer' }}
        >
          ✖
        </button>
      </div>
      
      <div style={{ marginBottom: '10px' }}>
        <strong>⏰ {debugInfo.timestamp}</strong>
      </div>
      
      {debugInfo.session && (
        <div style={{ marginBottom: '10px' }}>
          <strong style={{ color: '#ff0' }}>📡 SESSÃO:</strong><br/>
          Usuário: {debugInfo.session.hasUser ? '✅' : '❌'}<br/>
          ID: {debugInfo.session.userId || 'N/A'}<br/>
          Email: {debugInfo.session.userEmail || 'N/A'}<br/>
          Erro: {debugInfo.session.sessionError ? '❌' : '✅'}
        </div>
      )}
      
      {debugInfo.profile && (
        <div style={{ marginBottom: '10px' }}>
          <strong style={{ color: '#ff0' }}>👤 PERFIL:</strong><br/>
          Encontrado: {debugInfo.profile.profileFound ? '✅' : '❌'}<br/>
          {debugInfo.profile.profileData && (
            <>
              Role: {debugInfo.profile.profileData.role}<br/>
              Nome: {debugInfo.profile.profileData.full_name}<br/>
            </>
          )}
          {debugInfo.profile.profileError && (
            <>
              Erro: {debugInfo.profile.errorCode}<br/>
              Msg: {debugInfo.profile.errorMessage}
            </>
          )}
        </div>
      )}
      
      {debugInfo.table && (
        <div style={{ marginBottom: '10px' }}>
          <strong style={{ color: '#ff0' }}>📋 TABELA:</strong><br/>
          Existe: {debugInfo.table.tableExists ? '✅' : '❌'}<br/>
          Total: {debugInfo.table.totalProfiles}<br/>
          {debugInfo.table.allProfiles && debugInfo.table.allProfiles.length > 0 && (
            <div>
              Usuários:<br/>
              {debugInfo.table.allProfiles.map((p: any) => (
                <div key={p.id} style={{ fontSize: '10px', marginLeft: '10px' }}>
                  • {p.email} ({p.role})
                </div>
              ))}
            </div>
          )}
        </div>
      )}
      
      {debugInfo.criticalError && (
        <div style={{ color: '#f00' }}>
          <strong>❌ ERRO CRÍTICO:</strong><br/>
          {debugInfo.criticalError.toString()}
        </div>
      )}
    </div>
  );
} 
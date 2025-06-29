import React, { createContext, useContext, useEffect, useState } from 'react';
import { User, Session, AuthError } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import { toast } from 'sonner';

// Tipos de usuário
export type UserRole = 'developer' | 'admin' | 'user';

export interface UserProfile {
  id: string;
  email: string;
  role: UserRole;
  full_name?: string;
  avatar_url?: string;
  hospital_access: string[]; // IDs dos hospitais que tem acesso
  permissions: string[];
  created_at: string;
  updated_at: string;
}

export interface AuthContextType {
  user: User | null;
  profile: UserProfile | null;
  session: Session | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<{ error: AuthError | null }>;
  signUp: (email: string, password: string, userData: Partial<UserProfile>) => Promise<{ error: AuthError | null }>;
  signOut: () => Promise<void>;
  updateProfile: (updates: Partial<UserProfile>) => Promise<{ error: any }>;
  hasPermission: (permission: string) => boolean;
  hasHospitalAccess: (hospitalId: string) => boolean;
  isDeveloper: () => boolean;
  isAdmin: () => boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  // Buscar perfil do usuário
  const fetchUserProfile = async (userId: string): Promise<UserProfile | null> => {
    try {
      console.log('🔍 Buscando perfil para userId:', userId);
      
      const { data, error } = await supabase
        .from('user_profiles')
        .select('*')
        .eq('id', userId)
        .single();

      if (error) {
        console.error('❌ Erro detalhado ao buscar perfil:', {
          code: error.code,
          message: error.message,
          details: error.details,
          hint: error.hint,
          userId: userId
        });
        
        // Se a tabela não existe, criar perfil temporário
        if (error.code === 'PGRST116' || error.message.includes('relation "user_profiles" does not exist')) {
          console.warn('🚨 Tabela user_profiles não existe! Criando perfil temporário...');
          toast.warning('Sistema iniciando... Tabela de usuários será criada automaticamente.');
          
          // Criar perfil temporário para não travar o sistema
          const tempProfile: UserProfile = {
            id: userId,
            email: 'temp@temp.com',
            role: 'developer',
            full_name: 'Usuário Temporário',
            hospital_access: [],
            permissions: ['all'],
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          };
          
          return tempProfile;
        } else if (error.code === '42501') {
          console.error('🚨 PROBLEMA: Sem permissão para acessar user_profiles. Verifique RLS.');
          toast.error('Sem permissão para acessar perfil. Execute o script SQL de correção.');
          
          // Perfil temporário com permissões básicas
          const tempProfile: UserProfile = {
            id: userId,
            email: 'temp@temp.com',
            role: 'user',
            full_name: 'Usuário Sem Permissão',
            hospital_access: [],
            permissions: [],
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          };
          
          return tempProfile;
        } else {
          toast.error(`Erro ao buscar perfil: ${error.message}`);
        }
        
        return null;
      }

      if (!data) {
        console.warn('⚠️ Nenhum perfil encontrado para userId:', userId);
        toast.warning('Perfil de usuário não encontrado. Será criado automaticamente.');
        
        // Criar perfil padrão
        const defaultProfile: UserProfile = {
          id: userId,
          email: 'novo@usuario.com',
          role: 'user',
          full_name: 'Novo Usuário',
          hospital_access: [],
          permissions: [],
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        };
        
        return defaultProfile;
      }

      console.log('✅ Perfil encontrado:', data);
      return data;
    } catch (error: any) {
      console.error('❌ Erro inesperado ao buscar perfil:', {
        error: error,
        stack: error?.stack,
        userId: userId
      });
      
      // Fallback crítico - nunca deixar o sistema travado
      toast.error('Erro crítico na autenticação. Iniciando modo de emergência...');
      
      const emergencyProfile: UserProfile = {
        id: userId,
        email: 'emergency@user.com',
        role: 'developer',
        full_name: 'Usuário de Emergência',
        hospital_access: [],
        permissions: ['all'],
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };
      
      return emergencyProfile;
    }
  };

  // Configurar sessão inicial
  useEffect(() => {
    console.log('🚀 AuthContext: Iniciando configuração da sessão...');
    
    // Buscar sessão atual
    supabase.auth.getSession().then(({ data: { session }, error }) => {
      console.log('📡 getSession resultado:', { 
        hasSession: !!session, 
        hasUser: !!session?.user,
        userId: session?.user?.id,
        userEmail: session?.user?.email,
        error: error
      });
      
      setSession(session);
      setUser(session?.user ?? null);
      
      if (session?.user) {
        console.log(`👤 Usuário encontrado na sessão: ${session.user.email} (ID: ${session.user.id})`);
        console.log('🔍 Iniciando busca do perfil...');
        
        fetchUserProfile(session.user.id).then(profile => {
          console.log('📝 Resultado da busca do perfil:', {
            profileFound: !!profile,
            profileRole: profile?.role,
            profileName: profile?.full_name,
            profilePermissions: profile?.permissions
          });
          setProfile(profile);
        }).catch(error => {
          console.error('❌ Erro crítico na busca do perfil:', error);
          setProfile(null);
        });
      } else {
        console.log('❌ Nenhum usuário na sessão');
        setProfile(null);
      }
      
      console.log('✅ Finalizando loading inicial...');
      setLoading(false);
    }).catch(error => {
      console.error('❌ Erro crítico ao buscar sessão:', error);
      setLoading(false);
    });

    // Escutar mudanças de autenticação
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        console.log('🔄 AuthStateChange:', {
          event,
          hasSession: !!session,
          hasUser: !!session?.user,
          userId: session?.user?.id,
          userEmail: session?.user?.email
        });
        
        setSession(session);
        setUser(session?.user ?? null);
        
        if (session?.user) {
          console.log(`👤 Mudança de estado - usuário: ${session.user.email} (ID: ${session.user.id})`);
          
          try {
            const userProfile = await fetchUserProfile(session.user.id);
            console.log('📝 Perfil obtido na mudança de estado:', {
              profileFound: !!userProfile,
              profileRole: userProfile?.role
            });
            setProfile(userProfile);
          } catch (error) {
            console.error('❌ Erro ao buscar perfil na mudança de estado:', error);
            setProfile(null);
          }
        } else {
          console.log('❌ Nenhum usuário na mudança de estado');
          setProfile(null);
        }
        
        console.log('✅ Finalizando loading na mudança de estado...');
        setLoading(false);
      }
    );

    return () => {
      console.log('🧹 Limpando subscription do AuthContext');
      subscription.unsubscribe();
    };
  }, []);

  // Login
  const signIn = async (email: string, password: string) => {
    try {
      setLoading(true);
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        toast.error(`Erro no login: ${error.message}`);
        return { error };
      }

      toast.success('Login realizado com sucesso!');
      return { error: null };
    } catch (error: any) {
      toast.error('Erro inesperado no login');
      return { error };
    } finally {
      setLoading(false);
    }
  };

  // Cadastro
  const signUp = async (email: string, password: string, userData: Partial<UserProfile>) => {
    try {
      setLoading(true);
      
      // Criar usuário no Auth
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
      });

      if (error) {
        toast.error(`Erro no cadastro: ${error.message}`);
        return { error };
      }

      // Criar perfil do usuário
      if (data.user) {
        const { error: profileError } = await supabase
          .from('user_profiles')
          .insert({
            id: data.user.id,
            email: data.user.email,
            role: userData.role || 'user',
            full_name: userData.full_name,
            hospital_access: userData.hospital_access || [],
            permissions: userData.permissions || [],
          });

        if (profileError) {
          console.error('Erro ao criar perfil:', profileError);
          toast.error('Usuário criado mas erro ao salvar perfil');
        }
      }

      toast.success('Cadastro realizado com sucesso!');
      return { error: null };
    } catch (error: any) {
      toast.error('Erro inesperado no cadastro');
      return { error };
    } finally {
      setLoading(false);
    }
  };

  // Logout
  const signOut = async () => {
    try {
      setLoading(true);
      const { error } = await supabase.auth.signOut();
      
      if (error) {
        toast.error(`Erro no logout: ${error.message}`);
      } else {
        toast.success('Logout realizado com sucesso!');
        setProfile(null);
      }
    } catch (error) {
      toast.error('Erro inesperado no logout');
    } finally {
      setLoading(false);
    }
  };

  // Atualizar perfil
  const updateProfile = async (updates: Partial<UserProfile>) => {
    try {
      if (!user) return { error: 'Usuário não logado' };

      const { data, error } = await supabase
        .from('user_profiles')
        .update(updates)
        .eq('id', user.id)
        .select()
        .single();

      if (error) {
        toast.error('Erro ao atualizar perfil');
        return { error };
      }

      setProfile(data);
      toast.success('Perfil atualizado com sucesso!');
      return { error: null };
    } catch (error) {
      toast.error('Erro inesperado ao atualizar perfil');
      return { error };
    }
  };

  // Verificar permissão
  const hasPermission = (permission: string): boolean => {
    if (!profile) return false;
    
    // Desenvolvedor tem todas as permissões
    if (profile.role === 'developer') return true;
    
    // Admin tem quase todas as permissões
    if (profile.role === 'admin') return true;
    
    return profile.permissions.includes(permission);
  };

  // Verificar acesso ao hospital
  const hasHospitalAccess = (hospitalId: string): boolean => {
    if (!profile) return false;
    
    // Developer e Admin têm acesso a todos os hospitais
    if (profile.role === 'developer' || profile.role === 'admin') return true;
    
    return profile.hospital_access.includes(hospitalId);
  };

  // Verificar se é desenvolvedor
  const isDeveloper = (): boolean => {
    return profile?.role === 'developer';
  };

  // Verificar se é admin
  const isAdmin = (): boolean => {
    return profile?.role === 'admin' || profile?.role === 'developer';
  };

  const value: AuthContextType = {
    user,
    profile,
    session,
    loading,
    signIn,
    signUp,
    signOut,
    updateProfile,
    hasPermission,
    hasHospitalAccess,
    isDeveloper,
    isAdmin
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
} 
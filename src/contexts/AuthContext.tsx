import React, { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { toast } from 'sonner';

// Tipos de usuário expandidos
export type UserRole = 'developer' | 'admin' | 'director' | 'coordinator' | 'auditor' | 'ti' | 'user';

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
  is_active: boolean;
}

export interface CurrentUser {
  id: string;
  email: string;
  role: UserRole;
  full_name?: string;
  hospital_id: string; // Hospital atual selecionado (pode ser 'ALL')
  hospital_access: string[];
  permissions: string[];
  full_access: boolean; // Indica se tem acesso total ao sistema
}

export interface AuthContextType {
  user: CurrentUser | null;
  profile: UserProfile | null;
  loading: boolean;
  signIn: (email: string, hospitalId: string) => Promise<{ error: any }>;
  signOut: () => Promise<void>;
  updateProfile: (updates: Partial<UserProfile>) => Promise<{ error: any }>;
  hasPermission: (permission: string) => boolean;
  hasHospitalAccess: (hospitalId: string) => boolean;
  hasFullAccess: () => boolean;
  isDeveloper: () => boolean;
  isAdmin: () => boolean;
  isDirector: () => boolean;
  isCoordinator: () => boolean;
  isAuditor: () => boolean;
  isTI: () => boolean;
  canManageProcedures: () => boolean;
  getCurrentHospital: () => string | null;
  canAccessAllHospitals: () => boolean;
  getAccessibleHospitals: () => string[];
  logAuditAction: (action: string, details: any) => Promise<void>;
  // Novas funções com integração SQL
  checkHospitalAccessAsync: (hospitalId: string) => Promise<boolean>;
  getAccessibleHospitalsFromDB: () => Promise<Array<{
    hospital_id: string;
    hospital_name: string;
    hospital_code: string;
  }>>;
  getHospitalSelectOptions: () => Promise<Array<{
    value: string;
    label: string;
    code: string;
  }>>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<CurrentUser | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  // Carregar usuário da sessão
  useEffect(() => {
    const loadUserFromSession = () => {
      try {
        const savedUser = sessionStorage.getItem('current_user');
        if (savedUser) {
          const userData: CurrentUser = JSON.parse(savedUser);
          setUser(userData);
          
          // Carregar perfil completo do banco
          fetchUserProfile(userData.id);
        }
      } catch (error) {
        console.error('Erro ao carregar usuário da sessão:', error);
        sessionStorage.removeItem('current_user');
      } finally {
        setLoading(false);
      }
    };

    loadUserFromSession();
  }, []);

  // Buscar perfil completo do usuário
  const fetchUserProfile = async (userId: string): Promise<UserProfile | null> => {
    try {
      const { data, error } = await supabase
        .from('user_profiles')
        .select('*')
        .eq('id', userId)
        .single();

      if (error) {
        console.error('Erro ao buscar perfil:', error);
        return null;
      }

      setProfile(data);
      return data;
    } catch (error) {
      console.error('Erro inesperado ao buscar perfil:', error);
      return null;
    }
  };

  // Verificar se usuário tem acesso total
  const hasFullAccessRole = (role: UserRole): boolean => {
    return ['developer', 'admin', 'director', 'coordinator', 'auditor', 'ti'].includes(role);
  };

  // Registrar ação de auditoria
  const logAuditAction = async (action: string, details: any) => {
    try {
      if (!user) return;

      const userAgent = navigator.userAgent;
      const ipAddress = '127.0.0.1'; // Será preenchido pelo servidor

      await supabase
        .from('audit_logs')
        .insert({
          table_name: details.table_name || 'system',
          record_id: details.record_id || user.id,
          action,
          old_values: details.old_values || null,
          new_values: details.new_values || details,
          changed_fields: details.changed_fields || Object.keys(details),
          user_id: user.id,
          hospital_id: user.hospital_id === 'ALL' ? null : user.hospital_id,
          ip_address: ipAddress,
          user_agent: userAgent,
          operation_type: details.operation_type || action,
          session_id: details.session_id || crypto.randomUUID()
        });

      console.log(`✅ Auditoria registrada: ${action} pelo usuário ${user.email}`);
    } catch (auditError) {
      console.warn('⚠️ Erro ao registrar auditoria (não crítico):', auditError);
    }
  };

  // Login simplificado
  const signIn = async (email: string, hospitalId: string) => {
    try {
      setLoading(true);

      // Buscar usuário
      const { data: userProfile, error } = await supabase
        .from('user_profiles')
        .select('*')
        .eq('email', email)
        .single();

      if (error) {
        return { error: 'Usuário não encontrado' };
      }

      // Verificar se usuário está ativo
      if (!userProfile.is_active) {
        return { error: 'Usuário inativo. Contate o administrador.' };
      }

      // Verificar acesso ao hospital usando a nova função SQL
      let hasAccess = false;
      if (hospitalId === 'ALL') {
        hasAccess = true; // Todos podem tentar fazer login como ALL
      } else {
        try {
          const { data: accessCheck, error: accessError } = await supabase
            .rpc('user_has_hospital_access', { 
              target_hospital_id: hospitalId,
              user_id: userProfile.id 
            });
          
          if (accessError) {
            console.error('Erro ao verificar acesso ao hospital:', accessError);
            hasAccess = userProfile.hospital_access.includes('ALL') || 
                       userProfile.hospital_access.includes(hospitalId);
          } else {
            hasAccess = accessCheck === true;
          }
        } catch (sqlError) {
          console.warn('Fallback para verificação local de acesso:', sqlError);
          hasAccess = userProfile.hospital_access.includes('ALL') || 
                     userProfile.hospital_access.includes(hospitalId);
        }
      }

      if (!hasAccess) {
        return { error: 'Você não tem acesso a este hospital' };
      }

      // Determinar se tem acesso total
      const fullAccess = userProfile.hospital_access.includes('ALL') || 
                        hasFullAccessRole(userProfile.role);

      // Criar objeto de usuário atual
      const currentUser: CurrentUser = {
        id: userProfile.id,
        email: userProfile.email,
        role: userProfile.role,
        full_name: userProfile.full_name,
        hospital_id: hospitalId,
        hospital_access: userProfile.hospital_access,
        permissions: userProfile.permissions,
        full_access: fullAccess
      };

      // Salvar na sessão
      sessionStorage.setItem('current_user', JSON.stringify(currentUser));
      
      setUser(currentUser);
      setProfile(userProfile);

      // Registrar login
      await logAuditAction('LOGIN_SUCCESS', {
        table_name: 'user_profiles',
        record_id: userProfile.id,
        email,
        hospital_id: hospitalId,
        role: userProfile.role,
        full_access: fullAccess,
        login_time: new Date().toISOString(),
        operation_type: 'LOGIN'
      });

      return { error: null };
    } catch (error: any) {
      console.error('Erro no login:', error);
      return { error: error.message || 'Erro inesperado no login' };
    } finally {
      setLoading(false);
    }
  };

  // Logout
  const signOut = async () => {
    try {
      if (user) {
        // Registrar logout
        await logAuditAction('LOGOUT', {
          table_name: 'user_profiles',
          record_id: user.id,
          email: user.email,
          hospital_id: user.hospital_id,
          logout_time: new Date().toISOString(),
          operation_type: 'LOGOUT'
        });
      }

      // Limpar sessão
      sessionStorage.removeItem('current_user');
      setUser(null);
      setProfile(null);
      
      toast.success('Logout realizado com sucesso');
    } catch (error) {
      console.error('Erro no logout:', error);
      toast.error('Erro no logout');
    }
  };

  // Atualizar perfil
  const updateProfile = async (updates: Partial<UserProfile>) => {
    try {
      if (!user) return { error: 'Usuário não logado' };

      const { data, error } = await supabase
        .from('user_profiles')
        .update({
          ...updates,
          updated_at: new Date().toISOString()
        })
        .eq('id', user.id)
        .select()
        .single();

      if (error) {
        return { error: error.message };
      }

      setProfile(data);
      
      // Atualizar dados da sessão se necessário
      if (updates.email || updates.full_name || updates.role) {
        const updatedUser = {
          ...user,
          email: updates.email || user.email,
          full_name: updates.full_name || user.full_name,
          role: updates.role || user.role,
          full_access: updates.role ? hasFullAccessRole(updates.role) : user.full_access
        };
        setUser(updatedUser);
        sessionStorage.setItem('current_user', JSON.stringify(updatedUser));
      }

      // Registrar atualização
      await logAuditAction('PROFILE_UPDATED', {
        table_name: 'user_profiles',
        record_id: user.id,
        old_values: profile,
        new_values: data,
        changed_fields: Object.keys(updates),
        operation_type: 'UPDATE'
      });

      toast.success('Perfil atualizado com sucesso!');
      return { error: null };
    } catch (error: any) {
      console.error('Erro ao atualizar perfil:', error);
      return { error: error.message || 'Erro inesperado' };
    }
  };

  // Verificar permissão
  const hasPermission = (permission: string): boolean => {
    if (!user) return false;
    
    // Usuários com acesso total têm todas as permissões
    if (user.full_access) return true;
    
    // Desenvolvedor tem todas as permissões
    if (user.role === 'developer') return true;
    
    return user.permissions.includes(permission) || user.permissions.includes('all');
  };

  // Verificar acesso ao hospital
  const hasHospitalAccess = (hospitalId: string): boolean => {
    if (!user) return false;
    
    // Usuários com acesso total podem acessar qualquer hospital
    if (user.full_access) return true;
    
    return user.hospital_access.includes(hospitalId) || user.hospital_access.includes('ALL');
  };

  // Verificar se tem acesso total
  const hasFullAccess = (): boolean => {
    return user?.full_access || false;
  };

  // Verificar se pode acessar todos os hospitais
  const canAccessAllHospitals = (): boolean => {
    return user?.hospital_access.includes('ALL') || user?.full_access || false;
  };

  // Obter lista de hospitais acessíveis
  const getAccessibleHospitals = (): string[] => {
    if (!user) return [];
    
    if (user.full_access || user.hospital_access.includes('ALL')) {
      return ['ALL']; // Indica acesso total
    }
    
    return user.hospital_access;
  };

  // Nova função para verificar acesso com função SQL
  const checkHospitalAccessAsync = async (hospitalId: string): Promise<boolean> => {
    if (!user) return false;
    
    try {
      const { data, error } = await supabase
        .rpc('user_has_hospital_access', { 
          target_hospital_id: hospitalId,
          user_id: user.id 
        });
      
      if (error) {
        console.error('Erro ao verificar acesso ao hospital:', error);
        return hasHospitalAccess(hospitalId); // Fallback para função local
      }
      
      return data === true;
    } catch (error) {
      console.error('Erro na verificação assíncrona de acesso:', error);
      return hasHospitalAccess(hospitalId); // Fallback para função local
    }
  };

  // Função para obter hospitais acessíveis do banco
  const getAccessibleHospitalsFromDB = async (): Promise<Array<{
    hospital_id: string;
    hospital_name: string;
    hospital_code: string;
  }>> => {
    if (!user) return [];
    
    try {
      const { data, error } = await supabase
        .rpc('get_user_accessible_hospitals', { user_id: user.id });
      
      if (error) {
        console.error('Erro ao obter hospitais acessíveis:', error);
        return [];
      }
      
      return data || [];
    } catch (error) {
      console.error('Erro na função getAccessibleHospitalsFromDB:', error);
      return [];
    }
  };

  // Função para obter opções de hospital para select/combobox
  const getHospitalSelectOptions = async (): Promise<Array<{
    value: string;
    label: string;
    code: string;
  }>> => {
    try {
      const hospitals = await getAccessibleHospitalsFromDB();
      
      const options = hospitals.map(h => ({
        value: h.hospital_id,
        label: `${h.hospital_code} - ${h.hospital_name}`,
        code: h.hospital_code
      }));

      // Adicionar opção ALL se usuário tem acesso total
      if (user?.full_access) {
        options.unshift({
          value: 'ALL',
          label: 'TODOS OS HOSPITAIS',
          code: 'ALL'
        });
      }

      return options;
    } catch (error) {
      console.error('Erro ao obter opções de hospital:', error);
      return [];
    }
  };

  // Verificar se é desenvolvedor
  const isDeveloper = (): boolean => {
    return user?.role === 'developer';
  };

  // Verificar se é admin
  const isAdmin = (): boolean => {
    return user?.role === 'admin' || user?.role === 'developer';
  };

  // Verificar se é diretor
  const isDirector = (): boolean => {
    return user?.role === 'director';
  };

  // Verificar se é coordenador
  const isCoordinator = (): boolean => {
    return user?.role === 'coordinator';
  };

  // Verificar se é auditor
  const isAuditor = (): boolean => {
    return user?.role === 'auditor';
  };

  // Verificar se é TI
  const isTI = (): boolean => {
    return user?.role === 'ti';
  };

  // Verificar se pode gerenciar procedimentos (incluindo operadores)
  const canManageProcedures = (): boolean => {
    if (!user) return false;
    
    // Roles com permissão para gerenciar procedimentos
    const allowedRoles: UserRole[] = ['developer', 'admin', 'director', 'coordinator', 'auditor', 'ti', 'user'];
    
    // Verificar role
    if (allowedRoles.includes(user.role)) return true;
    
    // Verificar permissão específica
    return hasPermission('manage_procedures') || hasPermission('delete_procedures');
  };

  // Obter hospital atual
  const getCurrentHospital = (): string | null => {
    return user?.hospital_id || null;
  };

  const value: AuthContextType = {
    user,
    profile,
    loading,
    signIn,
    signOut,
    updateProfile,
    hasPermission,
    hasHospitalAccess,
    hasFullAccess,
    isDeveloper,
    isAdmin,
    isDirector,
    isCoordinator,
    isAuditor,
    isTI,
    canManageProcedures,
    getCurrentHospital,
    canAccessAllHospitals,
    getAccessibleHospitals,
    logAuditAction,
    // Novas funções com integração SQL
    checkHospitalAccessAsync,
    getAccessibleHospitalsFromDB,
    getHospitalSelectOptions
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
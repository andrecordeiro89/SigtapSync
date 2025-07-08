import React, { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { Badge } from './ui/badge';
import { Avatar, AvatarFallback } from './ui/avatar';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from './ui/dropdown-menu';
import { Home, Upload, Search, FileUp, Users, BarChart4, Code, Crown, User, LogOut, Settings, Building2, Shield, Eye, UserCheck, Globe } from 'lucide-react';
import ProfileEditModal from './ProfileEditModal';
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
  SidebarTrigger,
} from './ui/sidebar';
import { Button } from './ui/button';

interface SidebarNavigationProps {
  activeTab: string;
  onTabChange: (tab: string) => void;
}

const SidebarNavigation = ({ activeTab, onTabChange }: SidebarNavigationProps) => {
  const { user, signOut, isDeveloper, isAdmin, isDirector, isCoordinator, isAuditor, isTI, hasFullAccess, canAccessAllHospitals, getCurrentHospital, hasPermission } = useAuth();
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [showProfileModal, setShowProfileModal] = useState(false);

  // Define todas as tabs disponíveis com ordem específica para cada role
  const allTabs = [
    {
      id: 'dashboard',
      label: 'Dashboard',
      icon: Home,
      description: 'Visão geral do sistema',
      requiresAdmin: false,
      order: 1
    },
    {
      id: 'sigtap',
      label: 'SIGTAP',
      icon: Upload,
      description: 'Importação da tabela - Apenas diretoria/admin',
      requiresAdmin: true,
      order: 2
    },
    {
      id: 'sigtap-viewer',
      label: 'Consulta SIGTAP',
      icon: Search,
      description: 'Visualizar procedimentos',
      requiresAdmin: false,
      order: 3
    },
    {
      id: 'aih-multipage-tester',
      label: 'AIH Avançado',
      icon: FileUp,
      description: 'Upload e processamento oficial de AIHs',
      requiresAdmin: false,
      order: 4
    },
    {
      id: 'patients',
      label: 'Pacientes',
      icon: Users,
      description: 'Cadastro e gerenciamento',
      requiresAdmin: false,
      order: 5
    },
    {
      id: 'executive-dashboard',
      label: 'Dashboard Executivo',
      icon: BarChart4,
      description: 'Central de inteligência e relatórios para diretoria',
      requiresAdmin: true,
      requiresExecutive: true,
      order: 6
    },
    {
      id: 'medical-staff',
      label: 'Corpo Médico',
      icon: Users,
      description: 'Gestão e análise do corpo clínico médico',
      requiresAdmin: true,
      requiresExecutive: true,
      order: 7
    },
    {
      id: 'audit-dashboard',
      label: 'Auditoria AIH',
      icon: Shield,
      description: 'Auditoria e rastreamento de AIH por analista',
      requiresAdmin: false,
      requiresAuditor: true,
      order: 8
    },
    {
      id: 'aih-upload',
      label: 'Upload AIH (Teste)',
      icon: FileUp,
      description: 'Teste de rastreabilidade - Apenas desenvolvimento',
      requiresAdmin: true,
      requiresDeveloper: true,
      order: 9
    }
  ];

  const getVisibleTabs = () => {
    const hasAdminAccess = canAccessAllHospitals();
    const isDeveloper = user?.role === 'developer' || user?.role === 'ti';
    const hasExecutiveAccess = isDirector() || isAdmin() || isCoordinator() || isTI() || hasPermission('generate_reports');
    const hasAuditAccess = isAuditor() || isAdmin() || isDirector() || isTI() || hasPermission('audit_access');
    
    return allTabs
      .filter(tab => {
        if (!tab.requiresAdmin && !tab.requiresAuditor && !tab.requiresDeveloper && !tab.requiresExecutive) return true;
        
        if (tab.requiresDeveloper) {
          return isDeveloper;
        }
        
        if (tab.requiresAuditor) {
          return hasAuditAccess;
        }
        
        if (tab.requiresExecutive) {
          return hasExecutiveAccess;
        }
        
        if (tab.requiresAdmin) {
          return hasAdminAccess;
        }
        
        return true;
      })
      .sort((a, b) => a.order - b.order);
  };

  const tabs = getVisibleTabs();

  const handleLogout = async () => {
    setIsLoggingOut(true);
    try {
      await signOut();
    } finally {
      setIsLoggingOut(false);
    }
  };

  const getRoleConfig = () => {
    if (!user) return null;
    
    switch (user.role) {
      case 'developer':
        return {
          icon: Code,
          label: 'DEVELOPER',
          color: 'bg-purple-100 text-purple-800 border-purple-200',
          description: 'Desenvolvedor - Acesso total ao sistema'
        };
      case 'admin':
        return {
          icon: Crown,
          label: 'ADMIN',
          color: 'bg-blue-100 text-blue-800 border-blue-200',
          description: 'Administrador - Controle completo'
        };
      case 'director':
        return {
          icon: Shield,
          label: 'DIRETOR',
          color: 'bg-purple-100 text-purple-800 border-purple-200',
          description: 'Diretoria - Acesso a todos os hospitais'
        };
      case 'coordinator':
        return {
          icon: UserCheck,
          label: 'COORDENADOR',
          color: 'bg-green-100 text-green-800 border-green-200',
          description: 'Coordenação - Supervisão geral'
        };
      case 'auditor':
        return {
          icon: Eye,
          label: 'AUDITOR',
          color: 'bg-orange-100 text-orange-800 border-orange-200',
          description: 'Auditoria - Monitoramento completo'
        };
      case 'ti':
        return {
          icon: Code,
          label: 'TI',
          color: 'bg-indigo-100 text-indigo-800 border-indigo-200',
          description: 'Tecnologia da Informação'
        };
      default:
        return {
          icon: User,
          label: 'OPERADOR',
          color: 'bg-gray-100 text-gray-800 border-gray-200',
          description: 'Usuário operador de hospital'
        };
    }
  };

  const getInitials = (name?: string, email?: string) => {
    if (name) {
      return name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase();
    }
    if (email) {
      return email.substring(0, 2).toUpperCase();
    }
    return 'U';
  };

  const getHospitalDisplayName = () => {
    const currentHospital = getCurrentHospital();
    if (canAccessAllHospitals()) {
      return 'Todos os Hospitais';
    }
    if (currentHospital) {
      return currentHospital;
    }
    return `${user?.hospital_access?.length || 0} ${(user?.hospital_access?.length || 0) === 1 ? 'Hospital' : 'Hospitais'}`;
  };

  if (!user) {
    return null;
  }

  const roleConfig = getRoleConfig();

  return (
    <>
      <Sidebar side="left" variant="sidebar" collapsible="icon" className="border-r-0 shadow-lg">
        {/* HEADER - Logo e Nome da Empresa com Design Premium */}
        <SidebarHeader className="border-b border-sidebar-border bg-gradient-to-r from-blue-50 to-indigo-50 p-6">
          <div className="flex items-center space-x-3">
            <div className="relative">
              <div className="absolute inset-0 bg-blue-600 rounded-lg blur-sm opacity-20"></div>
              <Building2 className="relative h-9 w-9 text-blue-600 flex-shrink-0 drop-shadow-sm" />
            </div>
            <div className="group-data-[collapsible=icon]:hidden">
              <div className="text-xl font-bold bg-gradient-to-r from-gray-900 to-blue-900 bg-clip-text text-transparent leading-tight">
                SIGTAP
              </div>
              <div className="text-sm font-semibold text-blue-600 leading-tight tracking-wide">
                Sync
              </div>
            </div>
            {canAccessAllHospitals() && (
              <Badge variant="outline" className="group-data-[collapsible=icon]:hidden ml-auto bg-gradient-to-r from-purple-50 to-pink-50 text-purple-700 border-purple-200 text-xs px-3 py-1.5 font-medium shadow-sm">
                <Globe className="h-3 w-3 mr-1.5" />
                ADMIN
              </Badge>
            )}
          </div>
        </SidebarHeader>

        {/* CONTENT - Menu de Navegação com Design Premium */}
        <SidebarContent className="p-3 space-y-1">
          <SidebarGroup>
            <SidebarGroupLabel className="text-xs font-bold text-gray-600 uppercase tracking-wider px-3 py-2 bg-gray-50/50 rounded-md mb-2">
              <div className="flex items-center space-x-2">
                <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                <span>Navegação</span>
              </div>
            </SidebarGroupLabel>
            <SidebarGroupContent className="space-y-1">
              <SidebarMenu>
                {tabs.map((tab, index) => {
                  const Icon = tab.icon;
                  const isDeveloper = user?.role === 'developer' || user?.role === 'ti';
                  const isActive = activeTab === tab.id;
                  
                  return (
                    <SidebarMenuItem key={tab.id}>
                      <SidebarMenuButton 
                        onClick={() => onTabChange(tab.id)}
                        isActive={isActive}
                        tooltip={tab.description}
                        className={`
                          w-full relative overflow-hidden transition-all duration-300 ease-in-out
                          ${isActive 
                            ? 'bg-gradient-to-r from-blue-500 to-blue-600 text-white shadow-lg shadow-blue-500/25 scale-[1.02] border-0' 
                            : 'hover:bg-gradient-to-r hover:from-gray-50 hover:to-blue-50 hover:shadow-md hover:scale-[1.01] hover:border-blue-200/50'
                          }
                          group/menu-item rounded-xl p-3 mb-1 border border-transparent
                          focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2
                        `}
                        style={{
                          animationDelay: `${index * 50}ms`
                        }}
                      >
                        <div className={`
                          flex items-center justify-center w-8 h-8 rounded-lg mr-3 transition-all duration-300
                          ${isActive 
                            ? 'bg-white/20 shadow-lg' 
                            : 'bg-gray-100 group-hover/menu-item:bg-blue-100 group-hover/menu-item:shadow-md'
                          }
                        `}>
                          <Icon className={`
                            h-4 w-4 transition-all duration-300
                            ${isActive 
                              ? 'text-white drop-shadow-sm' 
                              : 'text-gray-600 group-hover/menu-item:text-blue-600'
                            }
                          `} />
                        </div>
                        <span className={`
                          font-medium transition-all duration-300
                          ${isActive 
                            ? 'text-white drop-shadow-sm' 
                            : 'text-gray-700 group-hover/menu-item:text-blue-700'
                          }
                        `}>
                          {tab.label}
                        </span>
                        
                        {/* Badge especial para sistema oficial - apenas para developers/ti */}
                        {tab.id === 'aih-multipage-tester' && isDeveloper && (
                          <Badge variant="outline" className={`
                            ml-auto text-xs transition-all duration-300 group-data-[collapsible=icon]:hidden
                            ${isActive 
                              ? 'bg-white/20 text-white border-white/30 shadow-sm' 
                              : 'bg-gradient-to-r from-green-50 to-emerald-50 text-green-700 border-green-200 group-hover/menu-item:shadow-md'
                            }
                          `}>
                            <div className="flex items-center space-x-1">
                              <div className="w-1.5 h-1.5 bg-current rounded-full animate-pulse"></div>
                              <span>OFICIAL</span>
                            </div>
                          </Badge>
                        )}

                        {/* Indicador de ativo com animação */}
                        {isActive && (
                          <div className="absolute left-0 top-0 bottom-0 w-1 bg-white rounded-r-full shadow-lg animate-pulse"></div>
                        )}

                        {/* Efeito de shimmer para item ativo */}
                        {isActive && (
                          <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent -skew-x-12 animate-shimmer"></div>
                        )}
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  );
                })}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        </SidebarContent>

        {/* FOOTER - Informações do Usuário com Design Premium */}
        <SidebarFooter className="border-t border-sidebar-border bg-gradient-to-r from-gray-50 to-blue-50/30 p-4">
          <SidebarMenu>
            <SidebarMenuItem>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <SidebarMenuButton className={`
                    w-full transition-all duration-300 ease-in-out
                    data-[state=open]:bg-gradient-to-r data-[state=open]:from-blue-500 data-[state=open]:to-blue-600 
                    data-[state=open]:text-white data-[state=open]:shadow-lg data-[state=open]:shadow-blue-500/25
                    hover:bg-gradient-to-r hover:from-gray-100 hover:to-blue-100 hover:shadow-md hover:scale-[1.02]
                    rounded-xl p-3 border border-transparent hover:border-blue-200/50
                    focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2
                    group/user-button
                  `}>
                    <div className="relative">
                      <Avatar className="h-8 w-8 ring-2 ring-white shadow-lg">
                        <AvatarFallback className={`text-sm font-bold transition-all duration-300 ${
                          canAccessAllHospitals() 
                            ? 'bg-gradient-to-br from-purple-400 to-pink-500 text-white' 
                            : 'bg-gradient-to-br from-blue-400 to-indigo-500 text-white'
                        }`}>
                          {getInitials(user.full_name, user.email)}
                        </AvatarFallback>
                      </Avatar>
                      {canAccessAllHospitals() && (
                        <div className="absolute -top-1 -right-1 w-4 h-4 bg-gradient-to-br from-purple-500 to-pink-600 rounded-full flex items-center justify-center shadow-lg ring-2 ring-white">
                          <Crown className="h-2 w-2 text-white" />
                        </div>
                      )}
                      {/* Indicador de status online */}
                      <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-green-500 rounded-full border-2 border-white shadow-sm animate-pulse"></div>
                    </div>
                    <div className="group-data-[collapsible=icon]:hidden flex-1 text-left min-w-0 ml-3">
                      <div className="text-sm font-semibold text-gray-900 truncate group-data-[state=open]/user-button:text-white transition-colors duration-300">
                        {user.full_name || user.email?.split('@')[0]}
                      </div>
                      <div className="flex items-center space-x-2">
                        <div className="text-xs text-gray-600 truncate group-data-[state=open]/user-button:text-blue-100 transition-colors duration-300">
                          {roleConfig?.label || 'Usuário'}
                        </div>
                        {canAccessAllHospitals() && (
                          <Badge variant="outline" className="text-xs bg-purple-50 text-purple-600 border-purple-200 px-2 py-0.5">
                            ADMIN
                          </Badge>
                        )}
                      </div>
                    </div>
                    <div className="group-data-[collapsible=icon]:hidden opacity-60 group-hover/user-button:opacity-100 transition-opacity duration-300">
                      <div className="text-xs text-gray-400 group-data-[state=open]/user-button:text-blue-200">
                        ⚙️
                      </div>
                    </div>
                  </SidebarMenuButton>
                </DropdownMenuTrigger>
                
                <DropdownMenuContent className="w-96 shadow-premium-lg border-0 bg-white/95 backdrop-blur-xl" align="end" forceMount>
                  {/* Informações do Usuário com Design Premium */}
                  <div className="flex items-center space-x-3 p-6 border-b border-gray-100 bg-gradient-to-r from-blue-50 to-indigo-50">
                    <Avatar className="h-10 w-10">
                      <AvatarFallback className={`font-medium ${
                        canAccessAllHospitals() 
                          ? 'bg-purple-100 text-purple-700' 
                          : 'bg-blue-100 text-blue-700'
                      }`}>
                        {getInitials(user.full_name, user.email)}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate">
                        {user.full_name || user.email?.split('@')[0]}
                      </p>
                      <p className="text-xs text-gray-500 truncate">{user.email}</p>
                      <div className="flex gap-1 mt-1">
                        {roleConfig && (
                          <Badge variant="outline" className={`${roleConfig.color} text-xs`}>
                            <roleConfig.icon className="h-3 w-3 mr-1" />
                            {roleConfig.label}
                          </Badge>
                        )}
                        {canAccessAllHospitals() && (
                          <Badge variant="outline" className="bg-purple-50 text-purple-700 border-purple-200 text-xs">
                            <Shield className="h-3 w-3 mr-1" />
                            FULL ACCESS
                          </Badge>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Informações de Acesso com Design Premium */}
                  <div className={`p-4 border-b border-gray-100 ${
                    canAccessAllHospitals() 
                      ? 'bg-gradient-to-r from-purple-50 to-pink-50' 
                      : 'bg-gradient-to-r from-blue-50 to-indigo-50'
                  }`}>
                    <div className={`flex items-center ${
                      canAccessAllHospitals() ? 'text-purple-700' : 'text-blue-700'
                    }`}>
                      {canAccessAllHospitals() ? (
                        <Globe className="h-4 w-4 mr-2" />
                      ) : (
                        <Building2 className="h-4 w-4 mr-2" />
                      )}
                      <div>
                        <p className="text-xs font-medium">
                          {canAccessAllHospitals() ? 'Acesso Administrativo' : 'Hospital Atual'}
                        </p>
                        <p className={`text-xs ${
                          canAccessAllHospitals() ? 'text-purple-600' : 'text-blue-600'
                        }`}>
                          {getHospitalDisplayName()}
                        </p>
                      </div>
                    </div>
                    <p className={`text-xs mt-1 ${
                      canAccessAllHospitals() ? 'text-purple-600' : 'text-blue-600'
                    }`}>
                      {canAccessAllHospitals() 
                        ? 'Controle total sobre todos os hospitais' 
                        : `Acesso a ${user.hospital_access.length} ${user.hospital_access.length === 1 ? 'hospital' : 'hospitais'}`
                      }
                    </p>
                  </div>

                  {/* Informações sobre funcionalidades disponíveis com Design Premium */}
                  <div className="p-4 border-b border-gray-100 bg-gradient-to-r from-gray-50 to-green-50">
                    <p className="text-sm font-semibold text-gray-800 mb-3 flex items-center">
                      <div className="w-2 h-2 bg-green-500 rounded-full mr-2 animate-pulse"></div>
                      Funcionalidades Disponíveis
                    </p>
                    <div className="space-y-1">
                      <p className="text-xs text-green-600">✅ Dashboard</p>
                      <p className="text-xs text-green-600">✅ Consulta SIGTAP</p>
                      <p className="text-xs text-green-600">✅ AIH Avançado (Sistema Oficial)</p>
                      <p className="text-xs text-green-600">✅ Gerenciamento de Pacientes</p>
                      {hasFullAccess() && (
                        <>
                          <p className="text-xs text-blue-600">✅ Importação SIGTAP (Diretoria)</p>
                          <p className="text-xs text-blue-600">✅ Upload AIH (Testes)</p>
                          <p className="text-xs text-blue-600">✅ Relatórios Executivos</p>
                          <p className="text-xs text-purple-600">✅ Todas as funcionalidades administrativas</p>
                        </>
                      )}
                      {!hasFullAccess() && (
                        <p className="text-xs text-gray-500">ℹ️ Perfil operador - Interface otimizada para uso diário</p>
                      )}
                    </div>
                  </div>

                  {/* Permissões com Design Premium */}
                  <div className="p-4 border-b border-gray-100 bg-gradient-to-r from-gray-50 to-blue-50">
                    <p className="text-sm font-semibold text-gray-800 mb-3 flex items-center">
                      <div className="w-2 h-2 bg-blue-500 rounded-full mr-2 animate-pulse"></div>
                      Suas Permissões
                    </p>
                    <div className="flex flex-wrap gap-1">
                      {canAccessAllHospitals() ? (
                        <Badge variant="secondary" className="text-xs bg-purple-100 text-purple-700">
                          TODAS AS PERMISSÕES
                        </Badge>
                      ) : (
                        <>
                          {user.permissions.slice(0, 3).map((perm, index) => (
                            <Badge key={index} variant="secondary" className="text-xs">
                              {perm}
                            </Badge>
                          ))}
                          {user.permissions.length > 3 && (
                            <Badge variant="secondary" className="text-xs">
                              +{user.permissions.length - 3} mais
                            </Badge>
                          )}
                        </>
                      )}
                    </div>
                  </div>

                  {/* Descrição do Role com Design Premium */}
                  {roleConfig && (
                    <div className="p-4 border-b border-gray-100 bg-gradient-to-r from-gray-50 to-indigo-50">
                      <p className="text-sm text-gray-700 italic flex items-center">
                        <div className="w-2 h-2 bg-indigo-500 rounded-full mr-2"></div>
                        {roleConfig.description}
                      </p>
                    </div>
                  )}

                  {/* Menu Items com Design Premium */}
                  <div className="p-2 bg-gray-50">
                    <DropdownMenuItem 
                      className="cursor-pointer premium-hover focus-glow rounded-lg p-3 transition-all duration-300 hover:bg-gradient-to-r hover:from-blue-50 hover:to-indigo-50" 
                      onClick={() => setShowProfileModal(true)}
                    >
                      <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-blue-100 mr-3">
                        <Settings className="h-4 w-4 text-blue-600" />
                      </div>
                      <span className="font-medium text-gray-700">Configurações</span>
                    </DropdownMenuItem>
                    
                    <DropdownMenuSeparator className="my-2" />
                    
                    <DropdownMenuItem 
                      className="cursor-pointer premium-hover focus-glow rounded-lg p-3 transition-all duration-300 hover:bg-gradient-to-r hover:from-red-50 hover:to-pink-50 text-red-600 focus:text-red-600"
                      onClick={handleLogout}
                      disabled={isLoggingOut}
                    >
                      <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-red-100 mr-3">
                        <LogOut className="h-4 w-4 text-red-600" />
                      </div>
                      <span className="font-medium">
                        {isLoggingOut ? (
                          <div className="flex items-center">
                            <div className="animate-spin-elegant w-4 h-4 border-2 border-red-600 border-t-transparent rounded-full mr-2"></div>
                            Saindo...
                          </div>
                        ) : (
                          'Sair'
                        )}
                      </span>
                    </DropdownMenuItem>
                  </div>
                </DropdownMenuContent>
              </DropdownMenu>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarFooter>

        <SidebarRail />
      </Sidebar>

      {/* Modal de Configurações */}
      {showProfileModal && (
        <ProfileEditModal
          isOpen={showProfileModal}
          onClose={() => setShowProfileModal(false)}
        />
      )}
    </>
  );
};

export default SidebarNavigation; 
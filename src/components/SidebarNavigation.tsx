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
  SidebarSeparator,
  SidebarTrigger,
} from './ui/sidebar';
 

// Estilos CSS personalizados para animações premium
const premiumStyles = `
  @keyframes shimmer {
    0% { transform: translateX(-100%); }
    100% { transform: translateX(100%); }
  }
  
  .animate-shimmer {
    animation: shimmer 2s infinite;
  }
  
  .premium-gradient {
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  }
  
  .premium-shadow {
    box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04);
  }
  
  .premium-hover:hover {
    transform: translateY(-1px);
    box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.25);
  }
`;

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
      order: 1,
      color: 'from-blue-500 to-indigo-600'
    },
    {
      id: 'sigtap',
      label: 'SIGTAP',
      icon: Upload,
      description: 'Importação da tabela - Apenas diretoria/admin',
      requiresAdmin: true,
      order: 2,
      color: 'from-purple-500 to-violet-600'
    },
    {
      id: 'sigtap-viewer',
      label: 'Consulta SIGTAP',
      icon: Search,
      description: 'Visualizar procedimentos',
      requiresAdmin: false,
      order: 3,
      color: 'from-emerald-500 to-teal-600'
    },
    {
      id: 'aih-multipage-tester',
      label: 'AIH Avançado',
      icon: FileUp,
      description: 'Upload e processamento oficial de AIHs',
      requiresAdmin: false,
      order: 4,
      color: 'from-orange-500 to-red-600'
    },
    {
      id: 'patients',
      label: 'Pacientes',
      icon: Users,
      description: 'Cadastro e gerenciamento',
      requiresAdmin: false,
      order: 5,
      color: 'from-cyan-500 to-blue-600'
    },
    {
      id: 'executive-dashboard',
      label: 'Analytics',
      icon: BarChart4,
      description: 'Central de inteligência e relatórios para diretoria',
      requiresAdmin: true,
      requiresExecutive: true,
      order: 6,
      color: 'from-pink-500 to-purple-600'
    },

    {
      id: 'audit-dashboard',
      label: 'Auditoria AIH',
      icon: Shield,
      description: 'Auditoria e rastreamento de AIH por analista',
      requiresAdmin: false,
      requiresAuditor: true,
      order: 8,
      color: 'from-amber-500 to-orange-600'
    },
    {
      id: 'aih-upload',
      label: 'Upload AIH (Teste)',
      icon: FileUp,
      description: 'Teste de rastreabilidade - Apenas desenvolvimento',
      requiresAdmin: true,
      requiresDeveloper: true,
      order: 9,
      color: 'from-slate-500 to-gray-600'
    },
    {
      id: 'procedure-debugger',
      label: 'Debug Procedimentos',
      icon: Code,
      description: 'Debug da tabela procedure_records - Desenvolvimento',
      requiresAdmin: true,
      requiresDeveloper: true,
      order: 10,
      color: 'from-red-500 to-pink-600'
    }
  ];

  const getVisibleTabs = () => {
    const hasAdminAccess = canAccessAllHospitals();
    const isDeveloper = user?.role === 'developer' || user?.role === 'ti';
    const hasExecutiveAccess = isDirector() || isAdmin() || isCoordinator() || isTI() || hasPermission('generate_reports');
    const hasAuditAccess = isAuditor() || isAdmin() || isDirector() || isTI() || hasPermission('audit_access');
    
    return allTabs
      .filter(tab => {
        // Oculta a tab "Auditoria AIH" do sidebar sem remover funcionalidades
        if (tab.id === 'audit-dashboard') return false;
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
      {/* Injeção de estilos CSS premium */}
      <style>{premiumStyles}</style>
      
      <Sidebar side="left" variant="sidebar" collapsible="icon" className="border-r-0 shadow-2xl shadow-slate-900/10 h-screen flex flex-col">
        {/* HEADER - Logo e Nome da Empresa com Design Premium */}
        <SidebarHeader className="relative bg-sidebar p-6">
          
          <div className="relative flex items-center space-x-4">
            <div className="relative group">
              {/* Efeito de brilho atrás do ícone */}
              <div className="absolute inset-0 bg-gradient-to-r from-blue-500 to-indigo-600 rounded-xl blur-md opacity-20 group-hover:opacity-30 transition-opacity duration-300"></div>
              
              {/* Container do ícone com gradiente */}
              <div className="relative bg-gradient-to-br from-blue-500 to-indigo-600 rounded-xl p-2.5 shadow-lg group-hover:shadow-xl transition-all duration-300 group-hover:scale-105">
                <Building2 className="h-6 w-6 text-white drop-shadow-sm" />
              </div>
              
              {/* Efeito de pulsar removido para manter o ícone estático */}
            </div>
            
            <div className="group-data-[collapsible=icon]:hidden flex-1">
              <div className="flex items-baseline space-x-2">
                <div className="text-2xl font-black bg-gradient-to-r from-slate-900 via-blue-900 to-indigo-900 bg-clip-text text-transparent tracking-tight">
                  SIGTAP
                </div>
                <div className="text-sm font-bold bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent tracking-wider">
                  Sync
                </div>
              </div>
              {/* Texto de versão removido */}
              
              {canAccessAllHospitals() && (
                <Badge className="mt-2 bg-gradient-to-r from-blue-500 to-indigo-500 text-white border-0 text-xs px-3 py-1.5 font-semibold shadow-lg hover:shadow-xl transition-all duration-300 hover:scale-105 group-data-[collapsible=icon]:hidden">
                  <Globe className="h-3 w-3 mr-1.5" />
                  ADMIN
                </Badge>
              )}
            </div>
          </div>
          {/* Botão de expansão removido conforme solicitação */}
        </SidebarHeader>

        {/* CONTENT - Menu de Navegação com Design Premium */}
        <SidebarContent className="px-4 py-6 space-y-3 flex-1 overflow-y-auto">
          <SidebarGroup>
            {/* Label "Navegação" removido conforme solicitação */}
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
                          w-full relative transition-all duration-200 ease-out group/menu-item
                          ${isActive 
                            ? 'bg-blue-50 text-blue-700 border-l-4 border-blue-500' 
                            : 'hover:bg-slate-50 text-slate-700 hover:text-blue-600'
                          }
                          rounded-lg px-4 py-3 mb-2 min-h-[3rem]
                        `}
                      >
                        {/* Container do ícone simples */}
                        <div className={`
                          flex items-center justify-center w-9 h-9 rounded-lg mr-3 transition-all duration-200
                          ${isActive 
                            ? 'bg-blue-100 text-blue-600' 
                            : 'bg-slate-100 text-slate-600 group-hover/menu-item:bg-blue-100 group-hover/menu-item:text-blue-600'
                          }
                        `}>
                          <Icon className="h-4 w-4" />
                        </div>
                        
                        <div className="flex-1 flex items-center group-data-[collapsible=icon]:hidden">
                          <span className={`
                            font-medium text-sm leading-5
                            ${isActive 
                              ? 'text-blue-700' 
                              : 'text-slate-700 group-hover/menu-item:text-blue-600'
                            }
                          `}>
                            {tab.label}
                          </span>
                        </div>
                        
                        {/* Badge especial para sistema oficial - apenas para developers/ti */}
                        {tab.id === 'aih-multipage-tester' && isDeveloper && (
                          <Badge className={`
                            ml-auto text-xs group-data-[collapsible=icon]:hidden
                            ${isActive 
                              ? 'bg-blue-100 text-blue-700 border-blue-200' 
                              : 'bg-emerald-100 text-emerald-700 border-emerald-200'
                            }
                          `}>
                            <div className="flex items-center space-x-1">
                              <div className="w-1.5 h-1.5 bg-current rounded-full"></div>
                              <span className="font-medium">OFICIAL</span>
                            </div>
                          </Badge>
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
        <SidebarFooter className="border-t border-slate-200/60 bg-gradient-to-br from-slate-50 to-slate-100/50 px-4 py-6 backdrop-blur-sm mt-auto">
          <SidebarMenu>
            <SidebarMenuItem>
              <div className="flex items-center gap-2">
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <SidebarMenuButton className={`
                      flex-1 transition-all duration-200 ease-out group/user-button
                      data-[state=open]:bg-blue-100 data-[state=open]:text-blue-700
                      hover:bg-slate-100
                      rounded-lg px-4 py-4 border border-transparent hover:border-blue-200/50
                      focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2
                      min-h-[4.5rem]
                    `}>
                      <div className="relative flex-shrink-0">
                        <Avatar className="h-10 w-10 ring-2 ring-white shadow-lg">
                          <AvatarFallback className={`text-sm font-bold ${
                            canAccessAllHospitals() 
                              ? 'bg-purple-500 text-white' 
                              : 'bg-blue-500 text-white'
                          }`}>
                            {getInitials(user.full_name, user.email)}
                          </AvatarFallback>
                        </Avatar>
                        {canAccessAllHospitals() && (
                          <div className="absolute -top-1 -right-1 w-5 h-5 bg-purple-500 rounded-full flex items-center justify-center shadow-lg ring-2 ring-white group-data-[collapsible=icon]:hidden">
                            <Crown className="h-3 w-3 text-white" />
                          </div>
                        )}
                        {/* Indicador de status online */}
                        <div className="absolute -bottom-0.5 -right-0.5 w-4 h-4 bg-green-500 rounded-full border-2 border-white group-data-[collapsible=icon]:hidden">
                        </div>
                      </div>
                      <div className="group-data-[collapsible=icon]:hidden flex-1 text-left min-w-0 ml-3">
                        <div className="text-sm font-semibold text-slate-900 whitespace-normal break-words group-data-[state=open]/user-button:text-blue-700 transition-all duration-200">
                          {user.full_name || user.email?.split('@')[0]}
                        </div>
                        <div className="flex items-center space-x-2 mt-1">
                          <div className="text-xs text-slate-600 truncate group-data-[state=open]/user-button:text-blue-600 transition-all duration-200 font-medium">
                            {roleConfig?.label || 'Usuário'}
                          </div>
                          {canAccessAllHospitals() && (
                            <Badge className="text-xs bg-purple-500 text-white border-0 px-2 py-0.5">
                              ADMIN
                            </Badge>
                          )}
                        </div>
                      </div>
                      <div className="group-data-[collapsible=icon]:hidden opacity-60 group-hover/user-button:opacity-100 transition-all duration-200 flex-shrink-0">
                        <Settings className="h-4 w-4 text-slate-400 group-data-[state=open]/user-button:text-blue-600 group-hover/user-button:text-blue-600" />
                      </div>
                    </SidebarMenuButton>
                  </DropdownMenuTrigger>

                  <DropdownMenuContent className="w-80 max-h-[85vh] overflow-y-auto shadow-xl border-0 bg-white/95 backdrop-blur-xl rounded-2xl" align="end" forceMount>
                  {/* Informações do Usuário com Design Premium */}
                  <div className="relative flex items-center space-x-3 p-3 border-b border-slate-200/60 bg-gradient-to-br from-slate-50 to-slate-100/50">
                    <div className="relative">
                      <Avatar className="h-8 w-8 ring-1 ring-white shadow-sm">
                        <AvatarFallback className={`font-medium text-xs ${
                          canAccessAllHospitals() 
                            ? 'bg-gradient-to-br from-purple-500 to-pink-600 text-white' 
                            : 'bg-gradient-to-br from-blue-500 to-indigo-600 text-white'
                        }`}>
                          {getInitials(user.full_name, user.email)}
                        </AvatarFallback>
                      </Avatar>
                      {canAccessAllHospitals() && (
                        <div className="absolute -top-0.5 -right-0.5 w-4 h-4 bg-gradient-to-br from-purple-500 to-pink-600 rounded-full flex items-center justify-center shadow-sm ring-1 ring-white">
                          <Crown className="h-2 w-2 text-white" />
                        </div>
                      )}
                    </div>
                    
                    <div className="relative flex-1 min-w-0">
                      <p className="text-xs font-medium text-slate-900 truncate">
                        {user.full_name || user.email?.split('@')[0]}
                      </p>
                      <p className="text-xs text-slate-600 truncate">{user.email}</p>
                      <div className="flex gap-1 mt-1">
                        {roleConfig && (
                          <Badge className={`${roleConfig.color} text-xs py-0 shadow-sm`}>
                            <roleConfig.icon className="h-2 w-2 mr-1" />
                            {roleConfig.label}
                          </Badge>
                        )}
                        {canAccessAllHospitals() && (
                          <Badge className="bg-gradient-to-r from-purple-500 to-pink-500 text-white border-0 text-xs py-0 shadow-sm">
                            <Shield className="h-2 w-2 mr-1" />
                            FULL
                          </Badge>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Informações de Acesso com Design Premium */}
                  <div className="relative p-2 border-b border-slate-200/60 bg-gradient-to-br from-slate-50 to-slate-100/50">
                    <div className="flex items-center space-x-2">
                      <div className={`flex items-center justify-center w-6 h-6 rounded-lg ${
                        canAccessAllHospitals() 
                          ? 'bg-gradient-to-br from-purple-500 to-pink-500 text-white shadow-sm' 
                          : 'bg-gradient-to-br from-blue-500 to-indigo-500 text-white shadow-sm'
                      }`}>
                        {canAccessAllHospitals() ? (
                          <Globe className="h-3 w-3" />
                        ) : (
                          <Building2 className="h-3 w-3" />
                        )}
                      </div>
                      <div className="flex-1">
                        <p className="text-xs font-medium text-slate-900">
                          {canAccessAllHospitals() ? 'Acesso Admin' : 'Hospital Atual'}
                        </p>
                        <p className={`text-xs font-medium ${
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
                        ? 'Controle total' 
                        : `${user.hospital_access.length} ${user.hospital_access.length === 1 ? 'hospital' : 'hospitais'}`
                      }
                    </p>
                  </div>

                  {/* Informações sobre funcionalidades disponíveis com Design Premium */}
                  <div className="relative p-2 border-b border-slate-200/60 bg-gradient-to-br from-slate-50 to-slate-100/50">
                    <div className="flex items-center space-x-2 mb-2">
                      <div className="flex items-center justify-center w-6 h-6 rounded-lg bg-gradient-to-br from-emerald-500 to-green-500 text-white shadow-sm">
                        <div className="w-1.5 h-1.5 bg-white rounded-full"></div>
                      </div>
                      <p className="text-xs font-medium text-slate-800">
                        Funcionalidades
                      </p>
                    </div>
                    <div className="space-y-1">
                      <div className="flex items-center space-x-1.5">
                        <div className="w-1 h-1 bg-emerald-500 rounded-full"></div>
                        <p className="text-xs text-emerald-600">Dashboard</p>
                      </div>
                      <div className="flex items-center space-x-1.5">
                        <div className="w-1 h-1 bg-emerald-500 rounded-full"></div>
                        <p className="text-xs text-emerald-600">Consulta SIGTAP</p>
                      </div>
                      <div className="flex items-center space-x-1.5">
                        <div className="w-1 h-1 bg-emerald-500 rounded-full"></div>
                        <p className="text-xs text-emerald-600">AIH Avançado</p>
                      </div>
                      <div className="flex items-center space-x-1.5">
                        <div className="w-1 h-1 bg-emerald-500 rounded-full"></div>
                        <p className="text-xs text-emerald-600">Pacientes</p>
                      </div>
                      {hasFullAccess() && (
                        <>
                          <div className="flex items-center space-x-1.5">
                            <div className="w-1 h-1 bg-blue-500 rounded-full"></div>
                            <p className="text-xs text-blue-600">Import SIGTAP</p>
                          </div>
                          <div className="flex items-center space-x-1.5">
                            <div className="w-1 h-1 bg-blue-500 rounded-full"></div>
                            <p className="text-xs text-blue-600">Upload AIH</p>
                          </div>
                          <div className="flex items-center space-x-1.5">
                            <div className="w-1 h-1 bg-blue-500 rounded-full"></div>
                            <p className="text-xs text-blue-600">Relatórios</p>
                          </div>
                          <div className="flex items-center space-x-1.5">
                            <div className="w-1 h-1 bg-purple-500 rounded-full"></div>
                            <p className="text-xs text-purple-600">Admin Total</p>
                          </div>
                        </>
                      )}
                      {!hasFullAccess() && (
                        <div className="flex items-center space-x-1.5">
                          <div className="w-1 h-1 bg-slate-400 rounded-full"></div>
                          <p className="text-xs text-slate-500">Perfil operador</p>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Permissões com Design Premium */}
                  <div className="relative p-2 border-b border-slate-200/60 bg-gradient-to-br from-slate-50 to-slate-100/50">
                    <div className="flex items-center space-x-2 mb-2">
                      <div className="flex items-center justify-center w-6 h-6 rounded-lg bg-gradient-to-br from-blue-500 to-indigo-500 text-white shadow-sm">
                        <div className="w-1.5 h-1.5 bg-white rounded-full"></div>
                      </div>
                      <p className="text-xs font-medium text-slate-800">
                        Permissões
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-1">
                      {canAccessAllHospitals() ? (
                        <Badge className="text-xs bg-gradient-to-r from-purple-500 to-pink-500 text-white border-0 py-0 shadow-sm">
                          TODAS
                        </Badge>
                      ) : (
                        <>
                          {user.permissions.slice(0, 2).map((perm, index) => (
                            <Badge key={index} className="text-xs bg-gradient-to-r from-slate-500 to-slate-600 text-white border-0 py-0 shadow-sm">
                              {perm}
                            </Badge>
                          ))}
                          {user.permissions.length > 2 && (
                            <Badge className="text-xs bg-gradient-to-r from-slate-400 to-slate-500 text-white border-0 py-0 shadow-sm">
                              +{user.permissions.length - 2}
                            </Badge>
                          )}
                        </>
                      )}
                    </div>
                  </div>

                  {/* Descrição do Role com Design Premium */}
                  {roleConfig && (
                    <div className="relative p-2 border-b border-slate-200/60 bg-gradient-to-br from-slate-50 to-slate-100/50">
                      <div className="flex items-center space-x-2">
                        <div className="flex items-center justify-center w-6 h-6 rounded-lg bg-gradient-to-br from-indigo-500 to-purple-500 text-white shadow-sm">
                          <div className="w-1.5 h-1.5 bg-white rounded-full"></div>
                        </div>
                        <p className="text-xs text-slate-700 leading-tight">
                          {roleConfig.description}
                        </p>
                      </div>
                    </div>
                  )}

                  {/* Menu Items com Design Premium */}
                  <div className="p-2 bg-gradient-to-br from-slate-50 to-slate-100/50 space-y-1">
                    <DropdownMenuItem 
                      className="cursor-pointer rounded-xl p-2 transition-all duration-200 hover:bg-gradient-to-r hover:from-blue-50 hover:to-indigo-50 hover:shadow-sm focus:outline-none focus:ring-1 focus:ring-blue-500 group" 
                      onClick={() => setShowProfileModal(true)}
                    >
                      <div className="flex items-center justify-center w-6 h-6 rounded-lg bg-gradient-to-br from-blue-500 to-indigo-500 text-white shadow-sm mr-2 group-hover:shadow-sm transition-all duration-200">
                        <Settings className="h-3 w-3" />
                      </div>
                      <span className="text-xs font-medium text-slate-700 group-hover:text-blue-700 transition-colors duration-200">Configurações</span>
                    </DropdownMenuItem>
                    
                    <DropdownMenuSeparator className="my-1 border-slate-200/60" />
                    
                    <DropdownMenuItem 
                      className="cursor-pointer rounded-xl p-2 transition-all duration-200 hover:bg-gradient-to-r hover:from-red-50 hover:to-pink-50 hover:shadow-sm text-red-600 focus:text-red-600 focus:outline-none focus:ring-1 focus:ring-red-500 group"
                      onClick={handleLogout}
                      disabled={isLoggingOut}
                    >
                      <div className="flex items-center justify-center w-6 h-6 rounded-lg bg-gradient-to-br from-red-500 to-pink-500 text-white shadow-sm mr-2 group-hover:shadow-sm transition-all duration-200">
                        <LogOut className="h-3 w-3" />
                      </div>
                      <span className="text-xs font-medium group-hover:text-red-700 transition-colors duration-200">
                        {isLoggingOut ? (
                          <div className="flex items-center">
                            <div className="animate-spin w-3 h-3 border border-red-600 border-t-transparent rounded-full mr-1"></div>
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
              </div>
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
import React, { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { Badge } from './ui/badge';
import { Avatar, AvatarFallback } from './ui/avatar';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from './ui/dropdown-menu';
import { Home, Upload, Search, FileUp, Users, BarChart4, Code, Crown, User, LogOut, Settings, Building2, Shield, Eye, UserCheck, Globe, ChevronRight, GitCompare } from 'lucide-react';
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
 

// Estilos CSS para o sidebar
const sidebarStyles = `
  .sidebar-menu-item {
    transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
  }
  
  .sidebar-menu-item:hover {
    transform: translateX(2px);
  }
  
  .sidebar-menu-item-active {
    position: relative;
  }
  
  .sidebar-menu-item-active::before {
    content: '';
    position: absolute;
    left: 0;
    top: 0;
    bottom: 0;
    width: 3px;
    background: linear-gradient(to bottom, #3b82f6, #2563eb);
    border-radius: 0 4px 4px 0;
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
      label: 'Inicial',
      icon: Home,
      description: 'Visão geral do sistema',
      requiresAdmin: false,
      order: 1,
      color: 'from-blue-500 to-indigo-600'
    },
    
    {
      id: 'sigtap-viewer',
      label: 'Consulta SIGTAP',
      icon: Search,
      description: 'Visualizar procedimentos',
      requiresAdmin: false,
      order: 2,
      color: 'from-emerald-500 to-teal-600'
    },
    {
      id: 'aih-multipage-tester',
      label: 'AIH Avançado',
      icon: GitCompare,
      description: 'Upload e processamento oficial de AIHs',
      requiresAdmin: false,
      order: 3,
      color: 'from-orange-500 to-red-600'
    },
    
    // {
    //   id: 'sisaih01',
    //   label: 'SISAIH01',
    //   icon: FileText,
    //   description: 'Processador de arquivos SISAIH01 do DATASUS',
    //   requiresAdmin: false,
    //   order: 6,
    //   color: 'from-indigo-500 to-purple-600'
    // },
    
    {
      id: 'patients',
      label: 'Pacientes',
      icon: Users,
      description: 'Cadastro e gerenciamento',
      requiresAdmin: false,
      order: 4,
      color: 'from-cyan-500 to-blue-600'
    },
    {
      id: 'executive-dashboard',
      label: 'Dashboard Executivo',
      icon: BarChart4,
      description: 'Central de inteligência e relatórios para diretoria',
      requiresAdmin: true,
      requiresExecutive: true,
      order: 5,
      color: 'from-pink-500 to-purple-600'
    },
    {
      id: 'audit-dashboard',
      label: 'Auditoria AIH',
      icon: Shield,
      description: 'Auditoria e rastreamento de AIH por analista',
      requiresAdmin: false,
      requiresAuditor: true,
      order: 9,
      color: 'from-amber-500 to-orange-600'
    },
    {
      id: 'aih-upload',
      label: 'Upload AIH (Teste)',
      icon: FileUp,
      description: 'Teste de rastreabilidade - Apenas desenvolvimento',
      requiresAdmin: true,
      requiresDeveloper: true,
      order: 10,
      color: 'from-slate-500 to-gray-600'
    },
    {
      id: 'procedure-debugger',
      label: 'Debug Procedimentos',
      icon: Code,
      description: 'Debug da tabela procedure_records - Desenvolvimento',
      requiresAdmin: true,
      requiresDeveloper: true,
      order: 11,
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
      {/* Injeção de estilos CSS */}
      <style>{sidebarStyles}</style>
      
      <Sidebar side="left" variant="sidebar" collapsible="icon" className="border-r border-gray-200 bg-white h-screen flex flex-col">
        {/* HEADER - Logo e Nome da Empresa */}
        <SidebarHeader className="border-b border-gray-200 bg-white px-4 py-6">
          <div className="flex items-center gap-3">
            {/* Logo/Ícone */}
            <div className="flex-shrink-0">
              <img
                src="/Favicon_Oficial.png?v=2"
                alt="SIGTAP Sync"
                className="w-10 h-10 rounded-lg shadow-sm"
                onError={(e) => { (e.currentTarget as HTMLImageElement).src = '/favicon.png'; }}
              />
            </div>

            {/* Nome, Slogan e Badge */}
            <div className="group-data-[collapsible=icon]:hidden flex-1 min-w-0">
              <div className="text-[16px] font-bold text-gray-900 tracking-tight">SIGTAP Sync</div>
              <div className="text-[12px] text-gray-600">Regulação Médica</div>
              {canAccessAllHospitals() && (
                <Badge className="mt-1 bg-purple-50 text-purple-700 border-purple-200 text-[10px] px-2 py-0 font-semibold">
                  <Globe className="h-2.5 w-2.5 mr-1" />
                  ADMIN
                </Badge>
              )}
            </div>
          </div>
        </SidebarHeader>

        {/* CONTENT - Menu de Navegação */}
        <SidebarContent className="px-3 py-4 flex-1 overflow-y-auto">
          <SidebarGroup>
            <SidebarGroupContent>
              <SidebarMenu className="space-y-1">
                {tabs.map((tab) => {
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
                          sidebar-menu-item
                          ${isActive ? 'sidebar-menu-item-active' : ''}
                          w-full px-3 py-2.5 rounded-lg
                          ${isActive 
                            ? 'bg-blue-50 text-blue-700' 
                            : 'text-gray-700 hover:bg-gray-50 hover:text-gray-900'
                          }
                        `}
                      >
                        {/* Ícone */}
                        <div className={`
                          flex-shrink-0 w-8 h-8 rounded-md flex items-center justify-center
                          ${isActive 
                            ? 'bg-blue-100' 
                            : 'bg-gray-100 group-hover:bg-gray-200'
                          }
                        `}>
                          <Icon className={`h-4 w-4 ${isActive ? 'text-blue-600' : 'text-gray-600'}`} />
                        </div>
                        
                        {/* Label */}
                        <span className={`
                          flex-1 text-sm font-medium group-data-[collapsible=icon]:hidden
                          ${isActive ? 'text-blue-700' : 'text-gray-700'}
                        `}>
                          {tab.label}
                        </span>
                        
                        {/* Badge Oficial */}
                        {tab.id === 'aih-multipage-tester' && isDeveloper && (
                          <Badge className={`
                            text-[10px] px-1.5 py-0 font-semibold group-data-[collapsible=icon]:hidden
                            ${isActive 
                              ? 'bg-blue-100 text-blue-700 border-blue-200' 
                              : 'bg-green-100 text-green-700 border-green-200'
                            }
                          `}>
                            OFICIAL
                          </Badge>
                        )}
                        
                        {/* Chevron para item ativo */}
                        {isActive && (
                          <ChevronRight className="h-4 w-4 text-blue-600 group-data-[collapsible=icon]:hidden" />
                        )}
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  );
                })}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        </SidebarContent>

        {/* FOOTER - Informações do Usuário */}
        <SidebarFooter className="border-t border-gray-200 bg-white px-3 py-4 mt-auto">
          <SidebarMenu>
            <SidebarMenuItem>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <SidebarMenuButton className={`
                    w-full px-3 py-3 rounded-lg
                    hover:bg-gray-50
                    data-[state=open]:bg-gray-100
                    transition-colors
                  `}>
                    {/* Avatar e Info */}
                    <div className="relative flex-shrink-0">
                      <Avatar className="h-9 w-9 ring-2 ring-gray-200">
                        <AvatarFallback className={`text-sm font-semibold ${
                          canAccessAllHospitals() 
                            ? 'bg-blue-600 text-white' 
                            : 'bg-gray-600 text-white'
                        }`}>
                          {getInitials(user.full_name, user.email)}
                        </AvatarFallback>
                      </Avatar>
                      {/* Indicador online */}
                      <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-green-500 rounded-full border-2 border-white"></div>
                    </div>
                    
                    {/* Nome e Role */}
                    <div className="group-data-[collapsible=icon]:hidden flex-1 text-left min-w-0">
                      <div className="text-sm font-semibold text-gray-900 truncate">
                        {user.full_name || user.email?.split('@')[0]}
                      </div>
                      <div className="text-xs text-gray-500 truncate">
                        {roleConfig?.label || 'Usuário'}
                      </div>
                    </div>
                    
                    {/* Ícone Config */}
                    <Settings className="h-4 w-4 text-gray-400 group-data-[collapsible=icon]:hidden" />
                  </SidebarMenuButton>
                </DropdownMenuTrigger>

                <DropdownMenuContent className="w-72 shadow-lg border border-gray-200 bg-white rounded-lg" align="end" forceMount>
                  {/* Header do Usuário */}
                  <div className="flex items-center gap-3 p-4 border-b border-gray-100">
                    <Avatar className="h-10 w-10 ring-2 ring-gray-200">
                      <AvatarFallback className={`text-sm font-semibold ${
                        canAccessAllHospitals() 
                          ? 'bg-blue-600 text-white' 
                          : 'bg-gray-600 text-white'
                      }`}>
                        {getInitials(user.full_name, user.email)}
                      </AvatarFallback>
                    </Avatar>
                    
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-gray-900 truncate">
                        {user.full_name || user.email?.split('@')[0]}
                      </p>
                      <p className="text-xs text-gray-500 truncate">{user.email}</p>
                      {roleConfig && (
                        <Badge className={`${roleConfig.color} text-[10px] px-2 py-0 mt-1`}>
                          <roleConfig.icon className="h-2.5 w-2.5 mr-1" />
                          {roleConfig.label}
                        </Badge>
                      )}
                    </div>
                  </div>

                  {/* Info Hospital */}
                  <div className="p-3 border-b border-gray-100 bg-gray-50">
                    <div className="flex items-center gap-2 text-xs">
                      {canAccessAllHospitals() ? (
                        <>
                          <Globe className="h-4 w-4 text-blue-600" />
                          <div className="flex-1">
                            <p className="font-medium text-gray-700">Acesso Total</p>
                            <p className="text-gray-500">Todos os hospitais</p>
                          </div>
                        </>
                      ) : (
                        <>
                          <Building2 className="h-4 w-4 text-gray-600" />
                          <div className="flex-1">
                            <p className="font-medium text-gray-700">Hospital</p>
                            <p className="text-gray-500 truncate">{getHospitalDisplayName()}</p>
                          </div>
                        </>
                      )}
                    </div>
                  </div>

                  {/* Menu Items */}
                  <div className="p-2">
                    <DropdownMenuItem 
                      className="cursor-pointer rounded-lg px-3 py-2 hover:bg-gray-100 transition-colors flex items-center gap-3" 
                      onClick={() => setShowProfileModal(true)}
                    >
                      <div className="w-8 h-8 bg-gray-100 rounded-lg flex items-center justify-center">
                        <Settings className="h-4 w-4 text-gray-600" />
                      </div>
                      <span className="text-sm font-medium text-gray-700">Configurações</span>
                    </DropdownMenuItem>
                    
                    <DropdownMenuSeparator className="my-2" />
                    
                    <DropdownMenuItem 
                      className="cursor-pointer rounded-lg px-3 py-2 hover:bg-red-50 transition-colors flex items-center gap-3 text-red-600"
                      onClick={handleLogout}
                      disabled={isLoggingOut}
                    >
                      <div className="w-8 h-8 bg-red-100 rounded-lg flex items-center justify-center">
                        <LogOut className="h-4 w-4 text-red-600" />
                      </div>
                      <span className="text-sm font-medium">
                        {isLoggingOut ? 'Saindo...' : 'Sair do sistema'}
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

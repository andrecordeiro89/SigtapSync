import React, { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { Avatar, AvatarFallback } from './ui/avatar';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from './ui/dropdown-menu';
import { Home, Upload, Search, FileUp, Users, BarChart4, Code, Crown, User, LogOut, Settings, Building2, Shield, Eye, UserCheck, Globe } from 'lucide-react';

interface NavigationProps {
  activeTab: string;
  onTabChange: (tab: string) => void;
}

const Navigation = ({ activeTab, onTabChange }: NavigationProps) => {
  const { user, signOut, isDeveloper, isAdmin, isDirector, isCoordinator, isAuditor, isTI, hasFullAccess, canAccessAllHospitals, getCurrentHospital, hasPermission } = useAuth();
  const [isLoggingOut, setIsLoggingOut] = useState(false);

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
      requiresExecutive: true, // Novo flag para acesso executivo
      order: 6
    },
    {
      id: 'medical-staff',
      label: 'Corpo Médico',
      icon: Users, // Temporariamente Users, depois trocar para Stethoscope
      description: 'Gestão e análise do corpo clínico médico',
      requiresAdmin: true,
      requiresExecutive: true, // Mesmo nível de acesso do dashboard executivo
      order: 7
    },
    {
      id: 'aih-upload',
      label: 'Upload AIH (Teste)',
      icon: FileUp,
      description: 'Teste de rastreabilidade - Apenas desenvolvimento',
      requiresAdmin: true,
      requiresDeveloper: true, // Novo flag para desenvolvimento
      order: 8
    }
  ];

  const getVisibleTabs = () => {
    const hasAdminAccess = canAccessAllHospitals();
    const isDeveloper = user?.role === 'developer' || user?.role === 'ti';
    const hasExecutiveAccess = isDirector() || isAdmin() || isCoordinator() || isTI() || hasPermission('generate_reports');
    
    return allTabs
      .filter(tab => {
        // Se não requer admin, todos podem ver
        if (!tab.requiresAdmin) return true;
        
        // Se requer developer, só developer/ti podem ver
        if (tab.requiresDeveloper) {
          return isDeveloper;
        }
        
        // Se requer acesso executivo, verificar permissões específicas
        if (tab.requiresExecutive) {
          return hasExecutiveAccess;
        }
        
        // Se requer admin, só admin/diretoria podem ver
        return hasAdminAccess;
      })
      .sort((a, b) => a.order - b.order);
  };

  const tabs = getVisibleTabs();

  const handleLogout = async () => {
    setIsLoggingOut(true);
    try {
      await signOut();
      // O sistema irá redirecionar automaticamente para a tela de login
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

  const getAccessLevelBadge = () => {
    if (!user) return null;

    if (canAccessAllHospitals()) {
      return {
        icon: Globe,
        label: 'ACESSO TOTAL',
        color: 'bg-purple-100 text-purple-800 border-purple-200',
        description: 'Acesso a todos os hospitais'
      };
    } else {
      return {
        icon: Building2,
        label: 'HOSPITAL ESPECÍFICO',
        color: 'bg-blue-100 text-blue-800 border-blue-200',
        description: 'Acesso limitado ao hospital'
      };
    }
  };

  const getInitials = (name?: string, email?: string) => {
    if (name && name !== email?.split('@')[0]) {
      return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
    }
    if (email) {
      return email.slice(0, 2).toUpperCase();
    }
    return 'U';
  };

  const getHospitalDisplayName = () => {
    const currentHospital = getCurrentHospital();
    if (currentHospital === 'ALL') {
      return 'TODOS OS HOSPITAIS';
    }
    return currentHospital || 'Não selecionado';
  };

  // Se não há usuário, não renderizar navegação
  if (!user) {
    return null;
  }

  const roleConfig = getRoleConfig();
  const accessLevel = getAccessLevelBadge();
  const currentHospital = getCurrentHospital();

  return (
    <nav className="bg-white border-b border-gray-200 shadow-sm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16">
          {/* Logo e Menu Principal */}
          <div className="flex">
            <div className="flex-shrink-0 flex items-center">
              <Building2 className="h-8 w-8 text-blue-600" />
              <div className="ml-2">
                <div className="text-xl font-bold text-gray-900">SIGTAP Sync</div>
              </div>
              {canAccessAllHospitals() && (
                <Badge variant="outline" className="ml-2 bg-purple-50 text-purple-700 border-purple-200 text-xs px-2 py-1">
                  <Globe className="h-3 w-3 mr-1" />
                  ADMIN
                </Badge>
              )}
            </div>
            
            {/* Tabs de Navegação - Agora filtradas por permissão */}
            <div className="hidden sm:ml-6 sm:flex sm:space-x-4">
              {tabs.map((tab) => {
                const Icon = tab.icon;
                const isDeveloper = user?.role === 'developer' || user?.role === 'ti';
                
                return (
                  <button
                    key={tab.id}
                    onClick={() => onTabChange(tab.id)}
                    className={`${
                      activeTab === tab.id
                        ? 'border-blue-500 text-blue-600'
                        : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                    } whitespace-nowrap py-2 px-1 border-b-2 font-medium text-sm transition-colors inline-flex items-center gap-2 relative`}
                    title={tab.description}
                  >
                    <Icon className="h-4 w-4" />
                    {tab.label}
                    
                    {/* Badge especial para sistema oficial - apenas para developers/ti */}
                    {tab.id === 'aih-multipage-tester' && isDeveloper && (
                      <Badge variant="outline" className="ml-1 text-xs bg-green-50 text-green-700 border-green-200">
                        OFICIAL
                      </Badge>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Informações do Usuário */}
          <div className="flex items-center space-x-4">
            
            {/* Informações do Usuário Logado - Simplificado */}
            <div className="hidden sm:flex items-center space-x-3">
              {/* Email do Usuário */}
              <div className="text-right">
                <p className="text-sm font-medium text-gray-900 leading-none">
                  {user.full_name || user.email?.split('@')[0]}
                </p>
                <p className="text-xs text-gray-500 leading-none mt-0.5">
                  {user.email}
                </p>
              </div>
            </div>

            {/* Menu do Usuário */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="relative h-8 w-8 rounded-full">
                  <Avatar className="h-8 w-8">
                    <AvatarFallback className={`text-xs font-medium ${
                      canAccessAllHospitals() 
                        ? 'bg-purple-100 text-purple-700' 
                        : 'bg-blue-100 text-blue-700'
                    }`}>
                      {getInitials(user.full_name, user.email)}
                    </AvatarFallback>
                  </Avatar>
                </Button>
              </DropdownMenuTrigger>
              
              <DropdownMenuContent className="w-96" align="end" forceMount>
                {/* Informações do Usuário */}
                <div className="flex items-center space-x-2 p-4 border-b">
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

                {/* Informações de Acesso */}
                <div className={`p-3 border-b ${
                  canAccessAllHospitals() ? 'bg-purple-50' : 'bg-blue-50'
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

                {/* Informações sobre funcionalidades disponíveis */}
                <div className="p-3 border-b">
                  <p className="text-xs font-medium text-gray-700 mb-2">Funcionalidades Disponíveis:</p>
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

                {/* Permissões */}
                <div className="p-3 border-b">
                  <p className="text-xs font-medium text-gray-700 mb-2">Suas Permissões:</p>
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

                {/* Descrição do Role */}
                {roleConfig && (
                  <div className="p-3 border-b">
                    <p className="text-xs text-gray-600">{roleConfig.description}</p>
                  </div>
                )}

                {/* Menu Items */}
                <DropdownMenuItem className="cursor-pointer">
                  <Settings className="h-4 w-4 mr-2" />
                  <span>Configurações</span>
                </DropdownMenuItem>
                
                <DropdownMenuSeparator />
                
                <DropdownMenuItem 
                  className="cursor-pointer text-red-600 focus:text-red-600"
                  onClick={handleLogout}
                  disabled={isLoggingOut}
                >
                  <LogOut className="h-4 w-4 mr-2" />
                  <span>{isLoggingOut ? 'Saindo...' : 'Sair'}</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </div>

      {/* Menu Mobile - Também filtrado */}
      <div className="sm:hidden">
        <div className="pt-2 pb-3 space-y-1 border-t border-gray-200">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => onTabChange(tab.id)}
                className={`${
                  activeTab === tab.id
                    ? 'bg-blue-50 border-blue-500 text-blue-700'
                    : 'border-transparent text-gray-600 hover:bg-gray-50 hover:border-gray-300 hover:text-gray-800'
                } block pl-3 pr-4 py-2 border-l-4 text-base font-medium w-full text-left transition-colors`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center">
                    <Icon className="h-5 w-5 mr-3" />
                    <div>
                      <div className="flex items-center gap-2">
                        {tab.label}
                        {tab.id === 'aih-multipage-tester' && (
                          <Badge variant="outline" className="text-xs bg-green-50 text-green-700 border-green-200">
                            OFICIAL
                          </Badge>
                        )}
                      </div>
                      <div className="text-xs text-gray-500">{tab.description}</div>
                    </div>
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </nav>
  );
};

export default Navigation;

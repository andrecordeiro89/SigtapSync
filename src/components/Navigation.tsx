import { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { Avatar, AvatarFallback } from './ui/avatar';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from './ui/dropdown-menu';
import { Home, Search, FileUp, Users, BarChart4, Code, Crown, User, LogOut, Settings, Building2, Shield, Eye, UserCheck, Globe, GitCompare } from 'lucide-react';
import ProfileEditModal from './ProfileEditModal';

interface NavigationProps {
  activeTab: string;
  onTabChange: (tab: string) => void;
}

const Navigation = ({ activeTab, onTabChange }: NavigationProps) => {
  const { user, signOut, isAdmin, isDirector, isCoordinator, isAuditor, isTI, hasFullAccess, canAccessAllHospitals, getCurrentHospital, hasPermission } = useAuth();
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
      order: 1
    },
    {
      id: 'sigtap-viewer',
      label: 'Consulta SIGTAP',
      icon: Search,
      description: 'Visualizar procedimentos',
      requiresAdmin: false,
      order: 2
    },
    {
      id: 'aih-multipage-tester',
      label: 'AIH Avançado',
      icon: GitCompare,
      description: 'Processamento avançado de AIHs (Multi-Page)',
      requiresAdmin: false,
      order: 3
    },
    
    
    {
      id: 'patients',
      label: 'Pacientes',
      icon: Users,
      description: 'Cadastro e gerenciamento',
      requiresAdmin: false,
      order: 4
    },
    {
      id: 'executive-dashboard',
      label: 'Dashboard Executivo',
      icon: BarChart4,
      description: 'Central de inteligência e relatórios para diretoria',
      requiresAdmin: true,
      requiresExecutive: true, // Novo flag para acesso executivo
      order: 5
    },
    
    
    {
      id: 'aih-upload',
      label: 'Upload AIH (Teste)',
      icon: FileUp,
      description: 'Teste de rastreabilidade - Apenas desenvolvimento',
      requiresAdmin: true,
      requiresDeveloper: true, // Novo flag para desenvolvimento
      order: 10
    }
  ];

  const getVisibleTabs = () => {
    const hasAdminAccess = canAccessAllHospitals();
    const isDeveloper = user?.role === 'developer' || user?.role === 'ti';
    const hasExecutiveAccess = isDirector() || isAdmin() || isCoordinator() || isTI() || hasPermission('generate_reports');
    
    return allTabs
      .filter(tab => {
        // Se não requer admin, todos podem ver
        if (!tab.requiresAdmin && !tab.requiresDeveloper && !tab.requiresExecutive) return true;
        
        // Se requer developer, só developer/ti podem ver
        if (tab.requiresDeveloper) {
          return isDeveloper;
        }
        
        // Se requer acesso executivo, verificar permissões específicas
        if (tab.requiresExecutive) {
          return hasExecutiveAccess;
        }
        
        // Se requer admin, só admin/diretoria podem ver
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
  

  return (
    <nav className="bg-white border-b border-gray-200 shadow-sm">
      <div className="w-full px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo e Nome */}
          <div className="logo-container flex items-center flex-shrink-0">
            <img src="/Favicon_Oficial.png?v=2" alt="SIGTAP Sync" className="h-8 w-8 rounded-lg" />
            <div className="ml-2 leading-tight">
              <div className="text-[15px] font-bold text-gray-900 tracking-wide">SIGTAP Sync</div>
              <div className="text-[12px] text-gray-600">Regulação Médica</div>
            </div>
          </div>
            {canAccessAllHospitals() && (
              <Badge variant="outline" className="admin-badge ml-2 bg-purple-50 text-purple-700 border-purple-200 text-xs px-2 py-1">
                <Globe className="h-3 w-3 mr-1" />
                ADMIN
              </Badge>
            )}

          {/* Tabs de Navegação - Centralizadas e Responsivas */}
          <div className="flex-1 flex justify-center">
            <div className="flex space-x-1 overflow-x-auto max-w-none">
              {tabs.map((tab) => {
                const Icon = tab.icon;
                const isDeveloper = user?.role === 'developer' || user?.role === 'ti';
                
                return (
                  <button
                    key={tab.id}
                    onClick={() => onTabChange(tab.id)}
                    className={`nav-tab ${
                      activeTab === tab.id
                        ? 'border-black text-black bg-transparent active'
                        : 'border-transparent text-neutral-600 hover:text-neutral-800 hover:border-neutral-300 hover:bg-neutral-50'
                    } whitespace-nowrap py-2 px-3 border-b-2 font-medium text-sm inline-flex items-center gap-2 relative rounded-t-md`}
                    title={tab.description}
                  >
                    <Icon className="h-4 w-4 flex-shrink-0" />
                    <span className="hidden sm:inline">{tab.label}</span>
                    
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

          {/* Menu do Usuário - Otimizado */}
          <div className="flex items-center space-x-3 flex-shrink-0">
            {/* Informações do Usuário - Compactas */}
            <div className="hidden md:flex items-center space-x-3">
              <div className="text-right">
                <p className="text-sm font-medium text-gray-900 leading-tight">
                  {user.full_name || user.email?.split('@')[0]}
                </p>
                <p className="text-xs text-gray-500 leading-tight">
                  {roleConfig?.label || 'Usuário'}
                </p>
              </div>
            </div>

            {/* Avatar e Menu */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="user-avatar relative h-9 w-9 rounded-full ring-2 ring-transparent hover:ring-blue-200">
                  <Avatar className="h-9 w-9">
                    <AvatarFallback className={`text-sm font-medium ${
                      canAccessAllHospitals() 
                        ? 'bg-purple-100 text-purple-700' 
                        : 'bg-blue-100 text-blue-700'
                    }`}>
                      {getInitials(user.full_name, user.email)}
                    </AvatarFallback>
                  </Avatar>
                  {canAccessAllHospitals() && (
                    <div className="admin-indicator absolute -top-1 -right-1 w-4 h-4 bg-purple-600 rounded-full flex items-center justify-center">
                      <Crown className="h-2 w-2 text-white" />
                    </div>
                  )}
                </Button>
              </DropdownMenuTrigger>
              
              <DropdownMenuContent className="w-80 max-h-[85vh] overflow-y-auto" align="end" forceMount>
                {/* Informações do Usuário */}
                <div className="flex items-center space-x-2 p-3 border-b">
                  <Avatar className="h-8 w-8">
                    <AvatarFallback className={`font-medium text-xs ${
                      canAccessAllHospitals() 
                        ? 'bg-purple-100 text-purple-700' 
                        : 'bg-blue-100 text-blue-700'
                    }`}>
                      {getInitials(user.full_name, user.email)}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium text-gray-900 truncate">
                      {user.full_name || user.email?.split('@')[0]}
                    </p>
                    <p className="text-xs text-gray-500 truncate">{user.email}</p>
                    <div className="flex gap-1 mt-1">
                      {roleConfig && (
                        <Badge variant="outline" className={`${roleConfig.color} text-xs py-0`}>
                          <roleConfig.icon className="h-2 w-2 mr-1" />
                          {roleConfig.label}
                        </Badge>
                      )}
                      {canAccessAllHospitals() && (
                        <Badge variant="outline" className="bg-purple-50 text-purple-700 border-purple-200 text-xs py-0">
                          <Shield className="h-2 w-2 mr-1" />
                          FULL
                        </Badge>
                      )}
                    </div>
                  </div>
                </div>

                {/* Informações de Acesso */}
                <div className={`p-2 border-b ${
                  canAccessAllHospitals() ? 'bg-purple-50' : 'bg-blue-50'
                }`}>
                  <div className={`flex items-center ${
                    canAccessAllHospitals() ? 'text-purple-700' : 'text-blue-700'
                  }`}>
                    {canAccessAllHospitals() ? (
                      <Globe className="h-3 w-3 mr-1" />
                    ) : (
                      <Building2 className="h-3 w-3 mr-1" />
                    )}
                    <div>
                      <p className="text-xs font-medium">
                        {canAccessAllHospitals() ? 'Acesso Admin' : 'Hospital Atual'}
                      </p>
                      <p className={`text-xs ${
                        canAccessAllHospitals() ? 'text-purple-600' : 'text-blue-600'
                      }`}>
                        {getHospitalDisplayName()}
                      </p>
                    </div>
                  </div>
                  <p className={`text-xs mt-0.5 ${
                    canAccessAllHospitals() ? 'text-purple-600' : 'text-blue-600'
                  }`}>
                    {canAccessAllHospitals() 
                      ? 'Controle total' 
                      : `${user.hospital_access.length} ${user.hospital_access.length === 1 ? 'hospital' : 'hospitais'}`
                    }
                  </p>
                </div>

                {/* Informações sobre funcionalidades disponíveis */}
                <div className="p-2 border-b">
                  <p className="text-xs font-medium text-gray-700 mb-1">Funcionalidades:</p>
                  <div className="space-y-0.5">
                    <p className="text-xs text-green-600">✅ Dashboard</p>
                    <p className="text-xs text-green-600">✅ Consulta SIGTAP</p>
                    <p className="text-xs text-green-600">✅ AIH Avançado</p>
                    <p className="text-xs text-green-600">✅ Pacientes</p>
                    {hasFullAccess() && (
                      <>
                        <p className="text-xs text-blue-600">✅ Import SIGTAP</p>
                        <p className="text-xs text-blue-600">✅ Upload AIH</p>
                        <p className="text-xs text-blue-600">✅ Relatórios</p>
                        <p className="text-xs text-purple-600">✅ Admin Total</p>
                      </>
                    )}
                    {!hasFullAccess() && (
                      <p className="text-xs text-gray-500">ℹ️ Perfil operador</p>
                    )}
                  </div>
                </div>

                {/* Permissões */}
                <div className="p-2 border-b">
                  <p className="text-xs font-medium text-gray-700 mb-1">Permissões:</p>
                  <div className="flex flex-wrap gap-1">
                    {canAccessAllHospitals() ? (
                      <Badge variant="secondary" className="text-xs bg-purple-100 text-purple-700 py-0">
                        TODAS
                      </Badge>
                    ) : (
                      <>
                        {user.permissions.slice(0, 2).map((perm, index) => (
                          <Badge key={index} variant="secondary" className="text-xs py-0">
                            {perm}
                          </Badge>
                        ))}
                        {user.permissions.length > 2 && (
                          <Badge variant="secondary" className="text-xs py-0">
                            +{user.permissions.length - 2}
                          </Badge>
                        )}
                      </>
                    )}
                  </div>
                </div>

                {/* Descrição do Role */}
                {roleConfig && (
                  <div className="p-2 border-b">
                    <p className="text-xs text-gray-600 leading-tight">{roleConfig.description}</p>
                  </div>
                )}

                {/* Menu Items */}
                <DropdownMenuItem 
                  className="cursor-pointer" 
                  onClick={() => setShowProfileModal(true)}
                >
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

      {/* Navegação Mobile - Tabs Horizontais Compactas */}
      <div className="nav-tabs-mobile sm:hidden border-t border-neutral-200 bg-white">
        <div className="nav-tabs-container flex overflow-x-auto px-3 py-2 space-x-2 scrollbar-hide">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isDeveloper = user?.role === 'developer' || user?.role === 'ti';
            
            return (
              <button
                key={tab.id}
                onClick={() => onTabChange(tab.id)}
                className={`${
                  activeTab === tab.id
                    ? 'bg-black text-white shadow-md'
                    : 'bg-white text-neutral-700 hover:bg-neutral-100 border border-neutral-300'
                } flex-shrink-0 px-3 py-2 rounded-lg font-medium text-sm transition-all duration-200 inline-flex items-center gap-2`}
                title={tab.description}
              >
                <Icon className="h-4 w-4" />
                <span className="whitespace-nowrap text-xs">{tab.label}</span>
                
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

      {/* Modal de Configurações */}
      <ProfileEditModal 
        isOpen={showProfileModal} 
        onClose={() => setShowProfileModal(false)} 
      />
    </nav>
  );
};

export default Navigation;

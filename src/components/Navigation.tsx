import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Card, CardContent } from '@/components/ui/card';
import { useAuth } from '../contexts/AuthContext';
import { BarChart3, Upload, Users, FileText, Home, Search, FileUp, BarChart4, User, LogOut, Settings, Code, Crown, ChevronDown } from 'lucide-react';

interface NavigationProps {
  activeTab: string;
  onTabChange: (tab: string) => void;
}

const Navigation = ({ activeTab, onTabChange }: NavigationProps) => {
  const { user, profile, signOut, isDeveloper, isAdmin } = useAuth();
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  const tabs = [
    {
      id: 'dashboard',
      label: 'Dashboard',
      icon: Home,
      description: 'Visão geral do sistema'
    },
    {
      id: 'sigtap',
      label: 'SIGTAP',
      icon: Upload,
      description: 'Importação da tabela'
    },
    {
      id: 'sigtap-viewer',
      label: 'Consulta SIGTAP',
      icon: Search,
      description: 'Visualizar procedimentos'
    },
    {
      id: 'aih-multipage-tester',
      label: 'Upload AIH',
      icon: FileUp,
      description: 'Upload e processamento de AIHs'
    },
    {
      id: 'patients',
      label: 'Pacientes',
      icon: Users,
      description: 'Cadastro e gerenciamento'
    },
    {
      id: 'reports',
      label: 'Relatórios',
      icon: BarChart4,
      description: 'Central de relatórios executivos'
    }
  ];

  const handleLogout = async () => {
    setIsLoggingOut(true);
    try {
      await signOut();
    } finally {
      setIsLoggingOut(false);
    }
  };

  const getRoleConfig = () => {
    if (!profile) return null;
    
    switch (profile.role) {
      case 'developer':
        return {
          icon: Code,
          label: 'DEVELOPER',
          color: 'bg-purple-100 text-purple-800 border-purple-200',
          description: 'Acesso total ao sistema'
        };
      case 'admin':
        return {
          icon: Crown,
          label: 'ADMIN',
          color: 'bg-blue-100 text-blue-800 border-blue-200',
          description: 'Administrador do sistema'
        };
      default:
        return {
          icon: User,
          label: 'USER',
          color: 'bg-gray-100 text-gray-800 border-gray-200',
          description: 'Usuário padrão'
        };
    }
  };

  const roleConfig = getRoleConfig();

  const getInitials = (name?: string, email?: string) => {
    if (name) {
      return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
    }
    if (email) {
      return email.slice(0, 2).toUpperCase();
    }
    return 'U';
  };

  // MODO DESENVOLVEDOR: usar valores padrão se não autenticado
  const devMode = !user || !profile;
  if (devMode) {
    // Valores padrão para modo desenvolvimento
    const devUser = { email: 'developer@test.com' };
    const devProfile = { 
      full_name: 'Desenvolvedor', 
      email: 'developer@test.com', 
      role: 'admin',
      avatar_url: null 
    };
    const devRoleConfig = {
      icon: Code,
      label: 'DEV MODE',
      color: 'bg-yellow-100 text-yellow-800 border-yellow-200',
      description: 'Modo desenvolvedor ativo'
    };
    
    // Usar valores de desenvolvimento
    const finalUser = devUser;
    const finalProfile = devProfile;
    const finalRoleConfig = devRoleConfig;
    
    // Continuar renderização com valores de desenvolvimento
    const RoleIcon = finalRoleConfig.icon;
    
    return (
      <div className="bg-white border-b border-gray-200 sticky top-0 z-10 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            {/* Logo e título - lado esquerdo */}
            <div className="flex items-center space-x-2">
              <BarChart3 className="w-8 h-8 text-blue-600" />
              <div>
                <h1 className="text-xl font-bold text-gray-900">SIGTAP Sync</h1>
                <p className="text-xs text-gray-500 hidden sm:block">Sistema de Faturamento Hospitalar</p>
              </div>
            </div>
            
            {/* Navegação - centro */}
            <nav className="hidden lg:flex space-x-0.5">
              {tabs.map((tab) => (
                <Button
                  key={tab.id}
                  variant={activeTab === tab.id ? "default" : "ghost"}
                  onClick={() => onTabChange(tab.id)}
                  className="flex items-center space-x-1.5 px-2.5 py-1.5 text-sm"
                  size="sm"
                >
                  <tab.icon className="w-4 h-4" />
                  <span className="hidden xl:inline">{tab.label}</span>
                </Button>
              ))}
            </nav>

            {/* Badge do Role */}
            <Badge className={`${finalRoleConfig.color} flex items-center gap-1 px-2 py-1 text-xs font-medium`}>
              <RoleIcon className="h-3 w-3" />
              <span className="hidden sm:inline">{finalRoleConfig.label}</span>
            </Badge>
          </div>
        </div>
      </div>
    );
  }
  
  if (!roleConfig) {
    return null;
  }

  const RoleIcon = roleConfig.icon;

  return (
    <div className="bg-white border-b border-gray-200 sticky top-0 z-10 shadow-sm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo e título - lado esquerdo */}
          <div className="flex items-center space-x-2">
            <BarChart3 className="w-8 h-8 text-blue-600" />
            <div>
              <h1 className="text-xl font-bold text-gray-900">SIGTAP Sync</h1>
              <p className="text-xs text-gray-500 hidden sm:block">Sistema de Faturamento Hospitalar</p>
            </div>
          </div>
          
          {/* Navegação - centro */}
          <nav className="hidden lg:flex space-x-0.5">
            {tabs.map((tab) => (
              <Button
                key={tab.id}
                variant={activeTab === tab.id ? "default" : "ghost"}
                onClick={() => onTabChange(tab.id)}
                className="flex items-center space-x-1.5 px-2.5 py-1.5 text-sm"
                size="sm"
              >
                <tab.icon className="w-4 h-4" />
                <span className="hidden xl:inline">{tab.label}</span>
              </Button>
            ))}
          </nav>

          {/* Navegação tablet - centro */}
          <nav className="flex lg:hidden md:flex space-x-0.5">
            {tabs.map((tab) => (
              <Button
                key={tab.id}
                variant={activeTab === tab.id ? "default" : "ghost"}
                onClick={() => onTabChange(tab.id)}
                className="flex items-center justify-center p-2"
                size="sm"
                title={tab.label}
              >
                <tab.icon className="w-4 h-4" />
              </Button>
            ))}
          </nav>

          {/* Navegação mobile - centro */}
          <nav className="flex md:hidden space-x-0.5 overflow-x-auto">
            {tabs.slice(0, 4).map((tab) => (
              <Button
                key={tab.id}
                variant={activeTab === tab.id ? "default" : "ghost"}
                onClick={() => onTabChange(tab.id)}
                className="flex items-center justify-center p-2 min-w-[40px]"
                size="sm"
                title={tab.label}
              >
                <tab.icon className="w-4 h-4" />
              </Button>
            ))}
          </nav>

          {/* Informações do usuário - lado direito */}
          <div className="flex items-center space-x-2">
            {/* Badge do Role */}
            <Badge className={`${roleConfig.color} flex items-center gap-1 px-2 py-1 text-xs font-medium`}>
              <RoleIcon className="h-3 w-3" />
              <span className="hidden sm:inline">{roleConfig.label}</span>
            </Badge>

            {/* Menu do usuário */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="flex items-center space-x-2 hover:bg-gray-50 px-2 py-1">
                  <Avatar className="h-8 w-8">
                    <AvatarImage src={profile.avatar_url} alt={profile.full_name || profile.email} />
                    <AvatarFallback className="bg-blue-100 text-blue-600 text-sm font-medium">
                      {getInitials(profile.full_name, profile.email)}
                    </AvatarFallback>
                  </Avatar>
                  <div className="text-left hidden md:block">
                    <div className="text-sm font-medium text-gray-900">
                      {profile.full_name || profile.email.split('@')[0]}
                    </div>
                    <div className="text-xs text-gray-500">
                      {profile.email}
                    </div>
                  </div>
                  <ChevronDown className="h-4 w-4 text-gray-400 hidden sm:block" />
                </Button>
              </DropdownMenuTrigger>

              <DropdownMenuContent align="end" className="w-80">
                <DropdownMenuLabel>
                  <div className="flex items-center space-x-3">
                    <Avatar className="h-12 w-12">
                      <AvatarImage src={profile.avatar_url} alt={profile.full_name || profile.email} />
                      <AvatarFallback className="bg-blue-100 text-blue-600 text-lg font-medium">
                        {getInitials(profile.full_name, profile.email)}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <div className="font-medium text-gray-900">
                        {profile.full_name || 'Usuário'}
                      </div>
                      <div className="text-sm text-gray-500">
                        {profile.email}
                      </div>
                      <Badge className={`${roleConfig.color} text-xs mt-1 inline-flex items-center gap-1`}>
                        <RoleIcon className="h-3 w-3" />
                        {roleConfig.label}
                      </Badge>
                    </div>
                  </div>
                </DropdownMenuLabel>

                <DropdownMenuSeparator />

                {/* Informações de acesso */}
                <div className="p-3">
                  <Card>
                    <CardContent className="p-3">
                      <div className="text-xs text-gray-600 space-y-2">
                        <div className="flex justify-between">
                          <span>Nível de acesso:</span>
                          <span className="font-medium">{roleConfig.description}</span>
                        </div>
                        <div className="flex justify-between">
                          <span>Hospitais:</span>
                          <span className="font-medium">
                            {isDeveloper() || isAdmin() ? 'Todos' : profile.hospital_access.length}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span>Permissões:</span>
                          <span className="font-medium">
                            {isDeveloper() ? 'Completas' : isAdmin() ? 'Administrativas' : profile.permissions.length}
                          </span>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </div>

                <DropdownMenuSeparator />

                {/* Ações */}
                <DropdownMenuItem disabled>
                  <Settings className="mr-2 h-4 w-4" />
                  <span>Configurações</span>
                </DropdownMenuItem>

                <DropdownMenuSeparator />

                <DropdownMenuItem 
                  onClick={handleLogout}
                  disabled={isLoggingOut}
                  className="text-red-600 focus:text-red-600"
                >
                  <LogOut className="mr-2 h-4 w-4" />
                  <span>{isLoggingOut ? 'Saindo...' : 'Sair'}</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Navigation;

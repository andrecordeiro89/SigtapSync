import React from 'react';
import { Button } from '@/components/ui/button';
import { BarChart3, Upload, Users, FileText, Home, Search, FileUp, BarChart4 } from 'lucide-react';

interface NavigationProps {
  activeTab: string;
  onTabChange: (tab: string) => void;
}

const Navigation = ({ activeTab, onTabChange }: NavigationProps) => {
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

  return (
    <div className="bg-white border-b border-gray-200 sticky top-0 z-10">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          <div className="flex items-center space-x-2">
            <BarChart3 className="w-8 h-8 text-blue-600" />
            <div>
              <h1 className="text-xl font-bold text-gray-900">SIGTAP Billing</h1>
              <p className="text-xs text-gray-500">Sistema de Faturamento Hospitalar</p>
            </div>
          </div>
          
          <nav className="flex space-x-1">
            {tabs.map((tab) => (
              <Button
                key={tab.id}
                variant={activeTab === tab.id ? "default" : "ghost"}
                onClick={() => onTabChange(tab.id)}
                className="flex items-center space-x-2"
              >
                <tab.icon className="w-4 h-4" />
                <span className="hidden sm:inline">{tab.label}</span>
              </Button>
            ))}
          </nav>
        </div>
      </div>
    </div>
  );
};

export default Navigation;

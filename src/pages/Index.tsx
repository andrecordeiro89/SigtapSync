import React, { useState } from 'react';
import SidebarNavigation from '../components/SidebarNavigation';
import Dashboard from '../components/Dashboard';
import SigtapImport from '../components/SigtapImport';
import SigtapViewer from '../components/SigtapViewer';
import AIHMultiPageTester from '../components/AIHMultiPageTester';
import PatientManagement from '../components/PatientManagement';
import AIHUpload from '../components/AIHUpload';
import ExecutiveDashboard from '../components/ExecutiveDashboard';
import MedicalStaffDashboard from '../components/MedicalStaffDashboard';
import AuditDashboard from './AuditDashboard';
import { SidebarProvider, SidebarInset, SidebarTrigger } from '../components/ui/sidebar';
import { Separator } from '../components/ui/separator';
import { Breadcrumb, BreadcrumbItem, BreadcrumbLink, BreadcrumbList, BreadcrumbPage, BreadcrumbSeparator } from '../components/ui/breadcrumb';

const Index = () => {
  const [activeTab, setActiveTab] = useState('dashboard');

  const renderContent = () => {
    switch (activeTab) {
      case 'dashboard':
        return <Dashboard />;
      case 'aih-upload':
        return <AIHUpload />;
      case 'aih-multipage-tester':
        return <AIHMultiPageTester />;
      case 'sigtap':
        return <SigtapImport />;
      case 'sigtap-viewer':
        return <SigtapViewer />;
      case 'patients':
        return <PatientManagement />;
      case 'executive-dashboard':
        return <ExecutiveDashboard />;
      case 'medical-staff':
        return <MedicalStaffDashboard />;
      case 'audit-dashboard':
        return <AuditDashboard />;
      default:
        return <Dashboard />;
    }
  };

  const getPageTitle = () => {
    switch (activeTab) {
      case 'dashboard':
        return 'Dashboard';
      case 'aih-upload':
        return 'Upload AIH (Teste)';
      case 'aih-multipage-tester':
        return 'AIH Avançado';
      case 'sigtap':
        return 'SIGTAP';
      case 'sigtap-viewer':
        return 'Consulta SIGTAP';
      case 'patients':
        return 'Pacientes';
      case 'executive-dashboard':
        return 'Dashboard Executivo';
      case 'medical-staff':
        return 'Corpo Médico';
      case 'audit-dashboard':
        return 'Auditoria AIH';
      default:
        return 'Dashboard';
    }
  };

  return (
    <SidebarProvider defaultOpen={true}>
      <SidebarNavigation activeTab={activeTab} onTabChange={setActiveTab} />
      <SidebarInset>
        {/* Header com breadcrumb e trigger para mobile */}
        <header className="flex h-16 shrink-0 items-center gap-2 transition-[width,height] ease-linear group-has-[[data-collapsible=icon]]/sidebar-wrapper:h-12">
          <div className="flex items-center gap-2 px-4">
            <SidebarTrigger className="-ml-1" />
            <Separator orientation="vertical" className="mr-2 h-4" />
            <Breadcrumb>
              <BreadcrumbList>
                <BreadcrumbItem className="hidden md:block">
                  <BreadcrumbLink href="#">
                    SIGTAP Sync
                  </BreadcrumbLink>
                </BreadcrumbItem>
                <BreadcrumbSeparator className="hidden md:block" />
                <BreadcrumbItem>
                  <BreadcrumbPage>{getPageTitle()}</BreadcrumbPage>
                </BreadcrumbItem>
              </BreadcrumbList>
            </Breadcrumb>
          </div>
        </header>
        
        {/* Conteúdo principal */}
        <main className="flex-1 overflow-auto p-4 md:p-6">
          <div className="max-w-7xl mx-auto">
            {renderContent()}
          </div>
        </main>
      </SidebarInset>
    </SidebarProvider>
  );
};

export default Index;

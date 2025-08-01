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
import ProcedureDebugger from '../components/ProcedureDebugger';
import { SidebarProvider, SidebarInset } from '../components/ui/sidebar';

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
      case 'procedure-debugger':
        return <ProcedureDebugger />;
      default:
        return <Dashboard />;
    }
  };



  return (
    <SidebarProvider defaultOpen={true}>
      <SidebarNavigation activeTab={activeTab} onTabChange={setActiveTab} />
      <SidebarInset>
        {/* Conteúdo principal */}
        <main className="flex-1 overflow-auto p-4 md:p-6 h-screen">
          <div className="max-w-7xl mx-auto">
            {renderContent()}
          </div>
        </main>
      </SidebarInset>
    </SidebarProvider>
  );
};

export default Index;

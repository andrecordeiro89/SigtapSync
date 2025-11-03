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
import SyncDashboard from '../components/SyncDashboard';
import AuditDashboard from './AuditDashboard';
import ProcedureDebugger from '../components/ProcedureDebugger';
import HospitalDischargesManager from '../components/HospitalDischargesManager';
import SISAIH01Page from '../components/SISAIH01Page';
import SyncPage from '../components/SyncPage';
import SyncAltasPage from '../components/SyncAltasPage';
import { SidebarProvider, SidebarInset } from '../components/ui/sidebar';
import { useIsCompact } from '../hooks/use-compact';

const Index = () => {
  const [activeTab, setActiveTab] = useState('dashboard');
  const isCompact = useIsCompact();

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
      case 'hospital-discharges':
        return <HospitalDischargesManager />;
      case 'sisaih01':
        return <SISAIH01Page />;
      case 'aih-sync':
        return <SyncAltasPage />;
      case 'patients':
        return <PatientManagement />;
      case 'executive-dashboard':
        return <ExecutiveDashboard />;
      case 'medical-staff':
        return <MedicalStaffDashboard />;
      case 'sync':
        return <SyncDashboard />;
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
        <main className={`flex-1 overflow-y-auto overflow-x-hidden ${isCompact ? 'p-3' : 'p-4 md:p-6'} min-h-svh`}>
          <div className="w-full">
            {renderContent()}
          </div>
        </main>
      </SidebarInset>
    </SidebarProvider>
  );
};

export default Index;

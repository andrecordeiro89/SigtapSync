import React, { useState } from 'react';
import Navigation from '../components/Navigation';
import Landing from '../components/Landing';
import SigtapImport from '../components/SigtapImport';
import SigtapViewer from '../components/SigtapViewer';
import PatientManagement from '../components/PatientManagement';
import AIHUpload from '../components/AIHUpload';
import ExecutiveDashboard from '../components/ExecutiveDashboard';
import MedicalStaffDashboard from '../components/MedicalStaffDashboard';
import ProcedureDebugger from '../components/ProcedureDebugger';
import SISAIH01Page from '../components/SISAIH01Page';
import AIHMultiPageTester from '../components/AIHMultiPageTester';
 
 
import { useIsCompact } from '../hooks/use-compact';

const Index = () => {
  const [activeTab, setActiveTab] = useState('dashboard');
  const isCompact = useIsCompact();

  const renderContent = () => {
    switch (activeTab) {
      case 'dashboard':
        return <Landing onNavigate={setActiveTab} />;
      case 'aih-multipage-tester':
        return <AIHMultiPageTester />;
      case 'aih-upload':
        return <AIHUpload />;
      case 'sigtap':
        return <SigtapImport />;
      case 'sigtap-viewer':
        return <SigtapViewer />;
      
      case 'sisaih01':
        return <SISAIH01Page />;
      
      case 'patients':
        return <PatientManagement />;
      case 'executive-dashboard':
        return <ExecutiveDashboard />;
      case 'medical-staff':
        return <MedicalStaffDashboard />;
      
      case 'procedure-debugger':
        return <ProcedureDebugger />;
      default:
        return <Landing onNavigate={setActiveTab} />;
    }
  };



  return (
    <div className="min-h-svh flex flex-col bg-background">
      <Navigation activeTab={activeTab} onTabChange={setActiveTab} />
      <main className={`flex-1 ${activeTab === 'dashboard' ? 'overflow-y-hidden' : 'overflow-y-auto'} overflow-x-hidden ${isCompact ? 'p-3' : 'p-4 md:p-6'}`}>
        <div className="w-full h-full">
          {renderContent()}
        </div>
      </main>
    </div>
  );
};

export default Index;

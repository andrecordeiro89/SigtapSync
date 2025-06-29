import React, { useState } from 'react';
import Navigation from '../components/Navigation';
import Dashboard from '../components/Dashboard';
import SigtapImport from '../components/SigtapImport';
import { SigtapOfficialImporter } from '../components/SigtapOfficialImporter';
import SigtapViewer from '../components/SigtapViewer';
import AIHUpload from '../components/AIHUpload';
import ExcelAnalyzer from '../components/ExcelAnalyzer';
import PatientManagement from '../components/PatientManagement';
import ProcedureManagement from '../components/ProcedureManagement';
import AIHPDFTester from '../components/AIHPDFTester';
import AIHMultiPageTester from '../components/AIHMultiPageTester';
import DataVerifier from '../components/DataVerifier';

const Index = () => {
  const [activeTab, setActiveTab] = useState('dashboard');

  const renderContent = () => {
    switch (activeTab) {
      case 'dashboard':
        return <Dashboard />;
      case 'sigtap':
        return <SigtapImport />;
      case 'sigtap-official':
        return <SigtapOfficialImporter />;
      case 'sigtap-viewer':
        return <SigtapViewer />;
      case 'aih-upload':
        return <AIHUpload />;
      case 'aih-pdf-tester':
        return <AIHPDFTester />;
      case 'aih-multipage-tester':
        return <AIHMultiPageTester />;
      case 'data-verifier':
        return <DataVerifier />;
      case 'excel-analyzer':
        return <ExcelAnalyzer />;
      case 'patients':
        return <PatientManagement />;
      case 'procedures':
        return <ProcedureManagement aihCompleta={{} as any} onUpdateAIH={() => {}} />;
      default:
        return <Dashboard />;
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <Navigation activeTab={activeTab} onTabChange={setActiveTab} />
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {renderContent()}
      </main>
    </div>
  );
};

export default Index;

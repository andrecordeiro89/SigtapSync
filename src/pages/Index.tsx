import React, { useState } from 'react';
import Navigation from '../components/Navigation';
import Dashboard from '../components/Dashboard';
import SigtapImport from '../components/SigtapImport';
import SigtapViewer from '../components/SigtapViewer';
import AIHMultiPageTester from '../components/AIHMultiPageTester';
import PatientManagement from '../components/PatientManagement';
import ReportsSimple from '../components/ReportsSimple';
import AIHUpload from '../components/AIHUpload';

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
      case 'reports':
        return <ReportsSimple />;
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

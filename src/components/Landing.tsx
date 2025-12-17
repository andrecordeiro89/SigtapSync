import React from 'react';
import { Card, CardContent } from './ui/card';
import { Button } from './ui/button';
import { Search, Database, Stethoscope, DollarSign } from 'lucide-react';

interface LandingProps {
  onNavigate?: (tab: string) => void;
}

const Landing: React.FC<LandingProps> = ({ onNavigate }) => {
  return (
    <div className="h-full bg-white text-black overflow-y-hidden">
      <main className="px-6 md:px-10 py-4 md:py-6 overflow-hidden">
        <section className="max-w-7xl mx-auto">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 mb-3">
            <div className="flex items-center gap-3">
              <img
                src="/Favicon_Oficial.png?v=2"
                alt="SigtapSync"
                className="h-12 w-12 rounded-lg"
                onError={(e) => { (e.currentTarget as HTMLImageElement).src = '/favicon.png'; }}
              />
              <div className="flex items-baseline gap-3">
                <h1 className="text-3xl md:text-4xl font-extrabold tracking-tight leading-tight">SigtapSync</h1>
                <span className="text-sm md:text-base text-neutral-700">Regulação Médica</span>
              </div>
            </div>
            
          </div>
        </section>
        <section className="max-w-7xl mx-auto mt-5 grid grid-cols-1 md:grid-cols-2 gap-4">
          <Card className="bg-white text-black border-neutral-200">
            <CardContent className="p-4">
              <div className="flex items-center gap-3 mb-3">
                <Search className="h-6 w-6" />
                <div className="text-xl font-semibold">Tabela SIGTAP</div>
              </div>
              <p className="text-neutral-700">Catálogo oficial com versões e códigos normalizados como base técnica do fluxo.</p>
              <Button
                variant="outline"
                className="mt-4 border-black text-black"
                onClick={() => onNavigate && onNavigate('sigtap-viewer')}
              >
                Abrir Consulta
              </Button>
            </CardContent>
          </Card>
          <Card className="bg-white text-black border-neutral-200">
            <CardContent className="p-4">
              <div className="flex items-center gap-3 mb-3">
                <Database className="h-6 w-6" />
                <div className="text-xl font-semibold">Matches AIH ↔ SIGTAP</div>
              </div>
              <p className="text-neutral-700">Validações e vínculos precisos entre internação e procedimento.</p>
              <Button
                variant="outline"
                className="mt-4 border-black text-black"
                onClick={() => onNavigate && onNavigate('aih-multipage-tester')}
              >
                Ver AIHs
              </Button>
            </CardContent>
          </Card>
          <Card className="bg-white text-black border-neutral-200">
            <CardContent className="p-4">
              <div className="flex items-center gap-3 mb-3">
                <Stethoscope className="h-6 w-6" />
                <div className="text-xl font-semibold">Hierarquia Assistencial</div>
              </div>
              <p className="text-neutral-700">Médico → Paciente → Procedimento com competência e caráter.</p>
              <Button
                variant="outline"
                className="mt-4 border-black text-black"
                onClick={() => onNavigate && onNavigate('patients')}
              >
                Pacientes
              </Button>
            </CardContent>
          </Card>
          <Card className="bg-white text-black border-neutral-200">
            <CardContent className="p-4">
              <div className="flex items-center gap-3 mb-3">
                <DollarSign className="h-6 w-6" />
                <div className="text-xl font-semibold">Repasses e Analytics</div>
              </div>
              <p className="text-neutral-700">Indicadores executivos e valores por ato com rastreabilidade.</p>
              <Button
                variant="outline"
                className="mt-4 border-black text-black"
                onClick={() => onNavigate && onNavigate('executive-dashboard')}
              >
                Dashboard
              </Button>
            </CardContent>
          </Card>
        </section>
      </main>
    </div>
  );
};

export default Landing;

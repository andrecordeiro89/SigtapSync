import React from 'react';
import { Card, CardContent } from './ui/card';
import { Button } from './ui/button';
import { Search, Database, Stethoscope, DollarSign } from 'lucide-react';

const Landing = () => {
  return (
    <div className="min-h-svh bg-white text-black">
      <main className="px-6 md:px-10 py-10 md:py-16">
        <section className="max-w-7xl mx-auto">
          <div className="flex items-center gap-4 mb-8">
            <img src="/icons8-s-67.png" alt="SigtapSync" className="h-12 w-12 rounded-lg" />
            <div>
              <h1 className="text-4xl md:text-5xl font-extrabold tracking-tight">SigtapSync</h1>
              <p className="text-sm md:text-base text-neutral-700">Regulação Médica</p>
            </div>
          </div>
          <p className="text-neutral-700 max-w-2xl">Plataforma profissional para gestão de AIH, procedimentos SIGTAP e repasses médicos com precisão operacional.</p>
        </section>
        <section className="max-w-7xl mx-auto mt-12 grid grid-cols-1 md:grid-cols-2 gap-6">
          <Card className="bg-white text-black border-neutral-200">
            <CardContent className="p-6">
              <div className="flex items-center gap-3 mb-3">
                <Search className="h-6 w-6" />
                <div className="text-xl font-semibold">Tabela SIGTAP</div>
              </div>
              <p className="text-neutral-700">Catálogo oficial com versões e códigos normalizados como base técnica do fluxo.</p>
              <Button variant="outline" className="mt-4 border-black text-black">Abrir Consulta</Button>
            </CardContent>
          </Card>
          <Card className="bg-white text-black border-neutral-200">
            <CardContent className="p-6">
              <div className="flex items-center gap-3 mb-3">
                <Database className="h-6 w-6" />
                <div className="text-xl font-semibold">Matches AIH ↔ SIGTAP</div>
              </div>
              <p className="text-neutral-700">Validações e vínculos precisos entre internação e procedimento.</p>
              <Button variant="outline" className="mt-4 border-black text-black">Ver AIHs</Button>
            </CardContent>
          </Card>
          <Card className="bg-white text-black border-neutral-200">
            <CardContent className="p-6">
              <div className="flex items-center gap-3 mb-3">
                <Stethoscope className="h-6 w-6" />
                <div className="text-xl font-semibold">Hierarquia Assistencial</div>
              </div>
              <p className="text-neutral-700">Médico → Paciente → Procedimento com competência e caráter.</p>
              <Button variant="outline" className="mt-4 border-black text-black">Pacientes</Button>
            </CardContent>
          </Card>
          <Card className="bg-white text-black border-neutral-200">
            <CardContent className="p-6">
              <div className="flex items-center gap-3 mb-3">
                <DollarSign className="h-6 w-6" />
                <div className="text-xl font-semibold">Repasses e Analytics</div>
              </div>
              <p className="text-neutral-700">Indicadores executivos e valores por ato com rastreabilidade.</p>
              <Button variant="outline" className="mt-4 border-black text-black">Dashboard</Button>
            </CardContent>
          </Card>
        </section>
      </main>
    </div>
  );
};

export default Landing;

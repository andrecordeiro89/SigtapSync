import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { AlertTriangle, Search, FileText, User, Activity } from 'lucide-react';
import { supabase } from '@/lib/supabase';

interface DiagnosticData {
  general_counters: {
    total_aihs: number;
    total_procedimentos: number;
    pacientes_unicos_aihs: number;
    pacientes_unicos_procedimentos: number;
  };
  compatibility: {
    pacientes_com_aihs: number;
    pacientes_com_aihs_e_procedimentos: number;
    pacientes_com_aihs_sem_procedimentos: number;
  };
  samples_without_procedures: Array<{
    aih_id: string;
    patient_id: string;
    aih_number: string;
    cns_responsavel: string;
    patient_name: string;
  }>;
  procedures_by_doctor: Array<{
    cns_responsavel: string;
    pacientes_unicos: number;
    total_procedimentos: number;
    total_aihs: number;
  }>;
}

const ProcedurePatientDiagnostic: React.FC = () => {
  const [diagnosticData, setDiagnosticData] = useState<DiagnosticData | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const runDiagnostic = async () => {
    setIsLoading(true);
    setError(null);
    
    try {
      console.log('🔍 Executando diagnóstico de procedimentos-pacientes...');
      
      // 1. Contadores gerais - CONSULTAS DIRETAS POR TABELA
      const [aihsCount, proceduresCount, aihsPatientsCount, procPatientsCount] = await Promise.all([
        supabase.from('aihs').select('*', { count: 'exact', head: true }),
        supabase.from('procedure_records').select('*', { count: 'exact', head: true }),
        supabase.from('aihs').select('patient_id', { count: 'exact', head: true }).not('patient_id', 'is', null),
        supabase.from('procedure_records').select('patient_id', { count: 'exact', head: true }).not('patient_id', 'is', null)
      ]);
      
      const generalData = [{
        total_aihs: aihsCount.count || 0,
        total_procedimentos: proceduresCount.count || 0,
        pacientes_unicos_aihs: aihsPatientsCount.count || 0,
        pacientes_unicos_procedimentos: procPatientsCount.count || 0
      }];

      // 2. Análise de compatibilidade - USANDO JOINS DIRETOS
      // Buscar patient_ids únicos das AIHs
      const { data: aihsPatients } = await supabase
        .from('aihs')
        .select('patient_id')
        .not('patient_id', 'is', null);
      
      // Buscar patient_ids únicos dos procedimentos  
      const { data: proceduresPatients } = await supabase
        .from('procedure_records')
        .select('patient_id')
        .not('patient_id', 'is', null);
        
      const aihsPatientIds = new Set((aihsPatients || []).map(a => a.patient_id));
      const proceduresPatientIds = new Set((proceduresPatients || []).map(p => p.patient_id));
      
      // Calcular intersecções
      const commonPatients = [...aihsPatientIds].filter(id => proceduresPatientIds.has(id));
      const aihsWithoutProcedures = [...aihsPatientIds].filter(id => !proceduresPatientIds.has(id));
      
      const compatibilityData = [{
        pacientes_com_aihs: aihsPatientIds.size,
        pacientes_com_aihs_e_procedimentos: commonPatients.length,
        pacientes_com_aihs_sem_procedimentos: aihsWithoutProcedures.length
      }];

      // 3. Amostras sem procedimentos
      const { data: samplesData } = await supabase
        .from('aihs')
        .select(`
          id,
          patient_id,
          aih_number,
          cns_responsavel,
          patients!inner(name)
        `)
        .not('patient_id', 'is', null)
        .limit(10);

      // Verificar quais não têm procedimentos
      const samplesWithoutProcedures = [];
      if (samplesData) {
        for (const aih of samplesData) {
          const { data: procData } = await supabase
            .from('procedure_records')
            .select('id')
            .eq('patient_id', aih.patient_id)
            .limit(1);
          
          if (!procData || procData.length === 0) {
            samplesWithoutProcedures.push({
              aih_id: aih.id,
              patient_id: aih.patient_id,
              aih_number: aih.aih_number,
              cns_responsavel: aih.cns_responsavel,
              patient_name: (aih.patients as any)?.name || 'Nome não disponível'
            });
          }
        }
      }

      // 4. Procedimentos por médico - BUSCA SIMPLIFICADA
      const { data: topDoctorsAihs } = await supabase
        .from('aihs')
        .select('cns_responsavel, patient_id')
        .not('cns_responsavel', 'is', null)
        .limit(1000);
        
      // Agrupar por médico e contar
      const doctorStats = new Map();
      (topDoctorsAihs || []).forEach(aih => {
        const cns = aih.cns_responsavel;
        if (!doctorStats.has(cns)) {
          doctorStats.set(cns, { 
            cns_responsavel: cns, 
            pacientes_unicos: new Set(), 
            total_aihs: 0,
            total_procedimentos: 0 
          });
        }
        const stats = doctorStats.get(cns);
        stats.pacientes_unicos.add(aih.patient_id);
        stats.total_aihs++;
      });
      
      // Converter para array e calcular procedimentos
      const proceduresByDoctorData = Array.from(doctorStats.values())
        .map(stats => ({
          ...stats,
          pacientes_unicos: stats.pacientes_unicos.size,
          total_procedimentos: 0 // Simplificado por enquanto
        }))
        .slice(0, 5);

      setDiagnosticData({
        general_counters: generalData?.[0] || {
          total_aihs: 0,
          total_procedimentos: 0,
          pacientes_unicos_aihs: 0,
          pacientes_unicos_procedimentos: 0
        },
        compatibility: compatibilityData?.[0] || {
          pacientes_com_aihs: 0,
          pacientes_com_aihs_e_procedimentos: 0,
          pacientes_com_aihs_sem_procedimentos: 0
        },
        samples_without_procedures: samplesWithoutProcedures,
        procedures_by_doctor: proceduresByDoctorData || []
      });

    } catch (err) {
      console.error('❌ Erro no diagnóstico:', err);
      setError(err instanceof Error ? err.message : 'Erro desconhecido');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Search className="h-5 w-5 text-blue-600" />
          Diagnóstico: Procedimentos ↔ Pacientes
        </CardTitle>
        <p className="text-sm text-gray-600">
          Verifica a compatibilidade entre AIHs e procedimentos por patient_id
        </p>
      </CardHeader>
      <CardContent className="space-y-6">
        <Button 
          onClick={runDiagnostic} 
          disabled={isLoading}
          className="w-full"
        >
          {isLoading ? 'Executando Diagnóstico...' : 'Executar Diagnóstico'}
        </Button>

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4">
            <div className="flex items-center gap-2 text-red-700">
              <AlertTriangle className="h-4 w-4" />
              <span className="font-semibold">Erro:</span>
            </div>
            <p className="text-red-600 mt-1">{error}</p>
          </div>
        )}

        {diagnosticData && (
          <div className="space-y-6">
            {/* Contadores Gerais */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="bg-blue-50 p-4 rounded-lg">
                <div className="text-2xl font-bold text-blue-900">
                  {diagnosticData.general_counters.total_aihs}
                </div>
                <div className="text-sm text-blue-700">Total AIHs</div>
              </div>
              <div className="bg-green-50 p-4 rounded-lg">
                <div className="text-2xl font-bold text-green-900">
                  {diagnosticData.general_counters.total_procedimentos}
                </div>
                <div className="text-sm text-green-700">Total Procedimentos</div>
              </div>
              <div className="bg-purple-50 p-4 rounded-lg">
                <div className="text-2xl font-bold text-purple-900">
                  {diagnosticData.general_counters.pacientes_unicos_aihs}
                </div>
                <div className="text-sm text-purple-700">Pacientes nas AIHs</div>
              </div>
              <div className="bg-orange-50 p-4 rounded-lg">
                <div className="text-2xl font-bold text-orange-900">
                  {diagnosticData.general_counters.pacientes_unicos_procedimentos}
                </div>
                <div className="text-sm text-orange-700">Pacientes nos Procedimentos</div>
              </div>
            </div>

            {/* Análise de Compatibilidade */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Compatibilidade de Patient_IDs</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="flex justify-between items-center">
                    <span>Pacientes com AIHs:</span>
                    <Badge variant="secondary">
                      {diagnosticData.compatibility.pacientes_com_aihs}
                    </Badge>
                  </div>
                  <div className="flex justify-between items-center">
                    <span>Pacientes com AIHs E procedimentos:</span>
                    <Badge variant="default" className="bg-green-100 text-green-800">
                      {diagnosticData.compatibility.pacientes_com_aihs_e_procedimentos}
                    </Badge>
                  </div>
                  <div className="flex justify-between items-center">
                    <span>Pacientes com AIHs SEM procedimentos:</span>
                    <Badge variant="destructive">
                      {diagnosticData.compatibility.pacientes_com_aihs_sem_procedimentos}
                    </Badge>
                  </div>
                  
                  {diagnosticData.compatibility.pacientes_com_aihs_sem_procedimentos > 0 && (
                    <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mt-4">
                      <div className="flex items-center gap-2 text-yellow-700">
                        <AlertTriangle className="h-4 w-4" />
                        <span className="font-semibold">Problema Identificado:</span>
                      </div>
                      <p className="text-yellow-600 mt-1">
                        {diagnosticData.compatibility.pacientes_com_aihs_sem_procedimentos} pacientes 
                        têm AIHs mas não têm procedimentos na tabela procedure_records. 
                        Isso explica por que os procedimentos não aparecem na interface.
                      </p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Amostras de AIHs sem procedimentos */}
            {diagnosticData.samples_without_procedures.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Exemplos de AIHs sem Procedimentos</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {diagnosticData.samples_without_procedures.map((sample, index) => (
                      <div key={index} className="bg-gray-50 p-3 rounded border-l-4 border-l-red-400">
                        <div className="font-medium">{sample.patient_name}</div>
                        <div className="text-sm text-gray-600">
                          AIH: {sample.aih_number} | Patient ID: {sample.patient_id} | 
                          CNS Responsável: {sample.cns_responsavel || 'N/A'}
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Procedimentos por médico */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Top 5 Médicos por Procedimentos</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {diagnosticData.procedures_by_doctor.map((doctor, index) => (
                    <div key={index} className="flex justify-between items-center p-3 bg-gray-50 rounded">
                      <div>
                        <div className="font-medium">CNS: {doctor.cns_responsavel}</div>
                        <div className="text-sm text-gray-600">
                          {doctor.pacientes_unicos} pacientes | {doctor.total_aihs} AIHs
                        </div>
                      </div>
                      <Badge variant="outline" className="bg-blue-100 text-blue-800">
                        {doctor.total_procedimentos} procedimentos
                      </Badge>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default ProcedurePatientDiagnostic;
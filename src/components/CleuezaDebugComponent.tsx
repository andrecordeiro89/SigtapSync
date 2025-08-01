import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Search, AlertTriangle } from 'lucide-react';
import { supabase } from '@/lib/supabase';

const CleuezaDebugComponent: React.FC = () => {
  const [debugData, setDebugData] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const investigateCleuza = async () => {
    setIsLoading(true);
    setError(null);
    
    try {
      console.log('🔍 Investigando Cleuza Dutra da Silva...');
      
      // 1. Buscar dados da paciente
      const { data: patientData } = await supabase
        .from('patients')
        .select('*')
        .ilike('name', '%cleuza%');
      
      console.log('👤 Dados da paciente:', patientData);
      
      if (!patientData || patientData.length === 0) {
        setError('Paciente Cleuza não encontrada na tabela patients');
        return;
      }
      
      const cleuza = patientData[0];
      
      // 2. Buscar AIHs da Cleuza
      const { data: aihData } = await supabase
        .from('aihs')
        .select('*')
        .eq('patient_id', cleuza.id);
      
      console.log('🏥 AIHs da Cleuza:', aihData);
      
      // 3. Buscar procedimentos da Cleuza (por patient_id)
      const { data: proceduresData } = await supabase
        .from('procedure_records')
        .select('*')
        .eq('patient_id', cleuza.id);
      
      console.log('🩺 Procedimentos por patient_id:', proceduresData);
      
      // 4. Buscar procedimentos da Cleuza (por aih_id)
      let proceduresByAih = [];
      if (aihData && aihData.length > 0) {
        const aihIds = aihData.map(a => a.id);
        const { data: procByAih } = await supabase
          .from('procedure_records')
          .select('*')
          .in('aih_id', aihIds);
        
        proceduresByAih = procByAih || [];
        console.log('🩺 Procedimentos por aih_id:', proceduresByAih);
      }
      
      // 5. Verificar se CNS responsável tem médico cadastrado
      let doctorData = null;
      if (aihData && aihData.length > 0 && aihData[0].cns_responsavel) {
        const { data: docData } = await supabase
          .from('doctors')
          .select('*')
          .eq('cns', aihData[0].cns_responsavel);
        
        doctorData = docData;
        console.log('👨‍⚕️ Dados do médico responsável:', doctorData);
      }
      
      setDebugData({
        patient: cleuza,
        aihs: aihData,
        proceduresByPatientId: proceduresData,
        proceduresByAihId: proceduresByAih,
        doctor: doctorData
      });
      
    } catch (err) {
      console.error('❌ Erro na investigação:', err);
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
          DEBUG: Cleuza Dutra da Silva
        </CardTitle>
        <p className="text-sm text-gray-600">
          Investigação específica para descobrir por que não tem procedimentos
        </p>
      </CardHeader>
      <CardContent className="space-y-6">
        <Button 
          onClick={investigateCleuza} 
          disabled={isLoading}
          className="w-full"
        >
          {isLoading ? 'Investigando...' : 'Investigar Cleuza'}
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

        {debugData && (
          <div className="space-y-4">
            <div className="bg-blue-50 p-4 rounded-lg">
              <h3 className="font-semibold text-blue-900">👤 Dados da Paciente</h3>
              <pre className="text-xs mt-2 bg-white p-2 rounded overflow-x-auto">
                {JSON.stringify(debugData.patient, null, 2)}
              </pre>
            </div>
            
            <div className="bg-green-50 p-4 rounded-lg">
              <h3 className="font-semibold text-green-900">🏥 AIHs ({debugData.aihs?.length || 0})</h3>
              <pre className="text-xs mt-2 bg-white p-2 rounded overflow-x-auto max-h-32">
                {JSON.stringify(debugData.aihs, null, 2)}
              </pre>
            </div>
            
            <div className="bg-yellow-50 p-4 rounded-lg">
              <h3 className="font-semibold text-yellow-900">
                🩺 Procedimentos por Patient_ID ({debugData.proceduresByPatientId?.length || 0})
              </h3>
              <pre className="text-xs mt-2 bg-white p-2 rounded overflow-x-auto max-h-32">
                {JSON.stringify(debugData.proceduresByPatientId, null, 2)}
              </pre>
            </div>
            
            <div className="bg-purple-50 p-4 rounded-lg">
              <h3 className="font-semibold text-purple-900">
                🩺 Procedimentos por AIH_ID ({debugData.proceduresByAihId?.length || 0})
              </h3>
              <pre className="text-xs mt-2 bg-white p-2 rounded overflow-x-auto max-h-32">
                {JSON.stringify(debugData.proceduresByAihId, null, 2)}
              </pre>
            </div>
            
            <div className="bg-orange-50 p-4 rounded-lg">
              <h3 className="font-semibold text-orange-900">
                👨‍⚕️ Médico Responsável ({debugData.doctor?.length || 0})
              </h3>
              <pre className="text-xs mt-2 bg-white p-2 rounded overflow-x-auto max-h-32">
                {JSON.stringify(debugData.doctor, null, 2)}
              </pre>
            </div>
            
            <div className="bg-gray-50 p-4 rounded-lg">
              <h3 className="font-semibold text-gray-900">📊 Resumo</h3>
              <div className="mt-2 space-y-1 text-sm">
                <p>Patient ID: {debugData.patient?.id}</p>
                <p>Nome: {debugData.patient?.name}</p>
                <p>AIHs: {debugData.aihs?.length || 0}</p>
                <p>Procedimentos (patient_id): {debugData.proceduresByPatientId?.length || 0}</p>
                <p>Procedimentos (aih_id): {debugData.proceduresByAihId?.length || 0}</p>
                <p>CNS Responsável: {debugData.aihs?.[0]?.cns_responsavel || 'N/A'}</p>
                <p>Médico cadastrado: {debugData.doctor?.length > 0 ? 'Sim' : 'Não'}</p>
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default CleuezaDebugComponent;
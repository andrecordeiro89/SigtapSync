import React, { useState } from 'react';
import { Button } from './ui/button';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Badge } from './ui/badge';
import { Database, Search, Users, FileText } from 'lucide-react';
import { useToast } from '../hooks/use-toast';

const DataVerifier = () => {
  const [isLoading, setIsLoading] = useState(false);
  const [data, setData] = useState<{
    patients: any[];
    aihs: any[];
    totalPatients: number;
    totalAIHs: number;
  } | null>(null);
  const { toast } = useToast();

  const verifyData = async () => {
    setIsLoading(true);
    
    try {
      console.log('🔍 Verificando dados no banco...');
      
      // Importar serviços
      const { PatientService, AIHService } = await import('../services/supabaseService');
      
      // Buscar dados
      const patients = await PatientService.getPatients();
      const aihs = await AIHService.getAIHs();
      
      console.log('👤 Pacientes encontrados:', patients.length);
      console.log('📄 AIHs encontradas:', aihs.length);
      
      setData({
        patients: patients.slice(0, 5), // Primeiros 5
        aihs: aihs.slice(0, 5), // Primeiras 5
        totalPatients: patients.length,
        totalAIHs: aihs.length
      });
      
      toast({
        title: "✅ Verificação concluída!",
        description: `${patients.length} pacientes e ${aihs.length} AIHs encontradas`
      });
      
    } catch (error) {
      console.error('❌ Erro ao verificar dados:', error);
      toast({
        title: "Erro na verificação",
        description: error instanceof Error ? error.message : 'Erro desconhecido',
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-900">🗃️ Verificador de Dados</h2>
        <p className="text-gray-600 mt-1">
          Verificar se os dados da AIH foram salvos no banco Supabase
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Database className="w-5 h-5 text-green-600" />
            <span>Status do Banco de Dados</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Button
            onClick={verifyData}
            disabled={isLoading}
            className="w-full"
          >
            {isLoading ? (
              <>
                <Search className="w-4 h-4 mr-2 animate-spin" />
                Verificando...
              </>
            ) : (
              <>
                <Search className="w-4 h-4 mr-2" />
                🔍 Verificar Dados Salvos
              </>
            )}
          </Button>

          {data && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
              {/* Card Pacientes */}
              <Card className="bg-blue-50 border-blue-200">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm flex items-center space-x-2">
                    <Users className="w-4 h-4 text-blue-600" />
                    <span>👤 Pacientes</span>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-blue-700">
                    {data.totalPatients}
                  </div>
                  <p className="text-sm text-blue-600">Total no banco</p>
                  
                  {data.patients.length > 0 && (
                    <div className="mt-3 space-y-2">
                      <p className="text-xs font-medium text-blue-800">Últimos cadastrados:</p>
                      {data.patients.map((patient, index) => (
                        <div key={patient.id} className="bg-white p-2 rounded text-xs">
                          <div className="font-medium">{patient.name}</div>
                          <div className="text-gray-600">CNS: {patient.cns}</div>
                          <div className="text-gray-500">ID: {patient.id.substring(0, 8)}...</div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Card AIHs */}
              <Card className="bg-green-50 border-green-200">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm flex items-center space-x-2">
                    <FileText className="w-4 h-4 text-green-600" />
                    <span>📄 AIHs</span>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-green-700">
                    {data.totalAIHs}
                  </div>
                  <p className="text-sm text-green-600">Total no banco</p>
                  
                  {data.aihs.length > 0 && (
                    <div className="mt-3 space-y-2">
                      <p className="text-xs font-medium text-green-800">Últimas processadas:</p>
                      {data.aihs.map((aih, index) => (
                        <div key={aih.id} className="bg-white p-2 rounded text-xs">
                          <div className="font-medium">AIH: {aih.aih_number}</div>
                          <div className="text-gray-600">Proc: {aih.procedure_code}</div>
                          <div className="text-gray-500">ID: {aih.id.substring(0, 8)}...</div>
                          <Badge 
                            variant={aih.processing_status === 'pending' ? 'secondary' : 'default'}
                            className="text-xs mt-1"
                          >
                            {aih.processing_status}
                          </Badge>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          )}

          {data && (data.totalPatients > 0 || data.totalAIHs > 0) && (
            <div className="bg-green-50 border border-green-200 rounded-lg p-4 mt-4">
              <div className="flex items-center space-x-2">
                <Database className="w-5 h-5 text-green-600" />
                <span className="font-medium text-green-800">✅ Banco Populado!</span>
              </div>
              <p className="text-sm text-green-700 mt-1">
                Os dados da AIH estão sendo salvos corretamente no Supabase.
              </p>
              <p className="text-xs text-green-600 mt-2">
                💡 Para ver mais detalhes, acesse o painel do Supabase → Table Editor
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default DataVerifier; 
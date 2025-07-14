import React, { useState } from 'react';
import { Button } from './ui/button';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Badge } from './ui/badge';
import { Activity, Search, Database, Users, FileText, Building2, Stethoscope } from 'lucide-react';
import { DoctorPatientService } from '../services/doctorPatientService';

const DataDiagnostics: React.FC = () => {
  const [isLoading, setIsLoading] = useState(false);
  const [diagnostics, setDiagnostics] = useState<any>(null);

  const runDiagnostics = async () => {
    setIsLoading(true);
    try {
      console.log('🔍 Executando diagnósticos de dados...');
      const results = await DoctorPatientService.checkRealDataAvailability();
      setDiagnostics(results);
      console.log('✅ Diagnósticos concluídos:', results);
    } catch (error) {
      console.error('❌ Erro nos diagnósticos:', error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Card className="border-2 border-blue-200">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Database className="h-5 w-5 text-blue-600" />
          Diagnóstico de Dados Reais
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="text-sm text-gray-600">
          Verificar quantos dados reais estão disponíveis no banco de dados
        </div>
        
        <Button 
          onClick={runDiagnostics} 
          disabled={isLoading}
          className="w-full"
        >
          {isLoading ? (
            <>
              <Activity className="h-4 w-4 mr-2 animate-spin" />
              Verificando dados...
            </>
          ) : (
            <>
              <Search className="h-4 w-4 mr-2" />
              Executar Diagnóstico
            </>
          )}
        </Button>

        {diagnostics && (
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mt-4">
            <div className="bg-blue-50 p-3 rounded-lg">
              <div className="flex items-center gap-2 mb-1">
                <Building2 className="h-4 w-4 text-blue-600" />
                <span className="text-sm font-medium">AIHs</span>
              </div>
              <div className="text-lg font-bold text-blue-700">{diagnostics.aihs}</div>
            </div>

            <div className="bg-green-50 p-3 rounded-lg">
              <div className="flex items-center gap-2 mb-1">
                <FileText className="h-4 w-4 text-green-600" />
                <span className="text-sm font-medium">Procedimentos</span>
              </div>
              <div className="text-lg font-bold text-green-700">{diagnostics.procedures}</div>
            </div>

            <div className="bg-purple-50 p-3 rounded-lg">
              <div className="flex items-center gap-2 mb-1">
                <Users className="h-4 w-4 text-purple-600" />
                <span className="text-sm font-medium">Pacientes</span>
              </div>
              <div className="text-lg font-bold text-purple-700">{diagnostics.patients}</div>
            </div>

            <div className="bg-orange-50 p-3 rounded-lg">
              <div className="flex items-center gap-2 mb-1">
                <Stethoscope className="h-4 w-4 text-orange-600" />
                <span className="text-sm font-medium">Médicos</span>
              </div>
              <div className="text-lg font-bold text-orange-700">{diagnostics.doctors}</div>
            </div>

            <div className="bg-indigo-50 p-3 rounded-lg">
              <div className="flex items-center gap-2 mb-1">
                <Building2 className="h-4 w-4 text-indigo-600" />
                <span className="text-sm font-medium">Hospitais</span>
              </div>
              <div className="text-lg font-bold text-indigo-700">{diagnostics.hospitals}</div>
            </div>

            <div className="bg-gray-50 p-3 rounded-lg">
              <div className="text-sm font-medium mb-1">Status</div>
              {diagnostics.procedures > 0 ? (
                <Badge variant="default" className="bg-green-100 text-green-700">
                  ✅ Dados Reais
                </Badge>
              ) : (
                <Badge variant="secondary" className="bg-yellow-100 text-yellow-700">
                  ⚠️ Dados de Teste
                </Badge>
              )}
            </div>
          </div>
        )}

        {diagnostics && diagnostics.procedures === 0 && (
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mt-4">
            <div className="text-sm text-yellow-800">
              <strong>ℹ️ Informação:</strong> Nenhum procedimento real encontrado no banco. 
              O sistema está exibindo dados de demonstração. Para ver dados reais, processe 
              algumas AIHs através do sistema de upload.
            </div>
          </div>
        )}

        {diagnostics && diagnostics.procedures > 0 && (
          <div className="bg-green-50 border border-green-200 rounded-lg p-4 mt-4">
            <div className="text-sm text-green-800">
              <strong>✅ Sucesso:</strong> Dados reais encontrados! O sistema pode exibir 
              informações reais dos procedimentos médicos.
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default DataDiagnostics; 
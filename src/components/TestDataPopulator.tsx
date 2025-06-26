import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Database, Loader2, Trash2, CheckCircle, Building, MapPin } from 'lucide-react';
import { populateTestData, clearTestData } from '../utils/populateTestData';

export const TestDataPopulator: React.FC = () => {
  const [isPopulating, setIsPopulating] = useState(false);
  const [isClearing, setIsClearing] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  const handlePopulateData = async () => {
    setIsPopulating(true);
    setError(null);
    setResult(null);

    try {
      const summary = await populateTestData();
      setResult(summary);
    } catch (err: any) {
      setError(err.message || 'Erro desconhecido');
    } finally {
      setIsPopulating(false);
    }
  };

  const handleClearData = async () => {
    setIsClearing(true);
    setError(null);

    try {
      await clearTestData();
      setResult({ message: 'Rede CIS removida com sucesso!' });
    } catch (err: any) {
      setError(err.message || 'Erro ao limpar dados');
    } finally {
      setIsClearing(false);
    }
  };

  return (
    <Card className="w-full max-w-4xl mx-auto">
      <CardHeader>
        <CardTitle className="flex items-center space-x-2">
          <Building className="w-5 h-5" />
          <span>Configuração da Rede CIS - Centro Integrado em Saúde</span>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-3">
          <p className="text-sm text-gray-600">
            Configure a rede completa CIS - Centro Integrado em Saúde LTDA:
          </p>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
            <div className="space-y-2">
              <h4 className="font-semibold text-gray-800">🏥 Hospitais da Rede:</h4>
              <ul className="text-gray-600 space-y-1">
                <li>• CIS - Centro Integrado (Matriz - Santa Mariana/PR)</li>
                <li>• Hospital Municipal Santa Alice (Cascavel/PR)</li>
                <li>• CIS - Sede Administrativa (Londrina/PR)</li>
                <li>• Hospital Municipal Juarez Barreto (Faxinal/PR)</li>
                <li>• Hospital Municipal São José (Carlópolis/PR)</li>
                <li>• Hospital Municipal 18 de Dezembro (Arapoti/PR)</li>
                <li>• Hospital Nossa Senhora Aparecida (Foz do Iguaçu/PR)</li>
                <li>• Hospital Maternidade N.S. Aparecida (Fazenda Rio Grande/PR)</li>
              </ul>
            </div>
            
            <div className="space-y-2">
              <h4 className="font-semibold text-gray-800">📊 Dados do Sistema:</h4>
              <ul className="text-gray-600 space-y-1">
                <li>• 8 Hospitais da rede CIS</li>
                <li>• 8 Cidades do Paraná</li>
                <li>• 1 Versão SIGTAP de produção</li>
                <li>• 8+ Procedimentos especializados</li>
                <li>• Pacientes de exemplo por hospital</li>
                <li>• Habilitações por especialidade</li>
              </ul>
            </div>
          </div>

          <div className="bg-blue-50 p-3 rounded-lg">
            <p className="text-sm text-blue-800">
              <strong>Cobertura:</strong> Região Norte, Oeste e Metropolitana do Paraná
            </p>
          </div>
        </div>

        <div className="flex space-x-2">
          <Button 
            onClick={handlePopulateData} 
            disabled={isPopulating || isClearing}
            className="flex items-center space-x-2"
            size="lg"
          >
            {isPopulating ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Database className="w-4 h-4" />
            )}
            <span>
              {isPopulating ? 'Configurando Rede CIS...' : 'Configurar Rede CIS'}
            </span>
          </Button>

          <Button 
            onClick={handleClearData} 
            disabled={isPopulating || isClearing}
            variant="destructive"
            className="flex items-center space-x-2"
          >
            {isClearing ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Trash2 className="w-4 h-4" />
            )}
            <span>
              {isClearing ? 'Removendo...' : 'Remover Dados'}
            </span>
          </Button>
        </div>

        {error && (
          <Alert variant="destructive">
            <AlertDescription>
              <strong>Erro:</strong> {error}
            </AlertDescription>
          </Alert>
        )}

        {result && (
          <Alert>
            <CheckCircle className="w-4 h-4" />
            <AlertDescription>
              <div className="space-y-3">
                <p><strong>Sucesso!</strong> {result.message}</p>
                
                {result.cisStats && (
                  <div className="text-sm space-y-2">
                    <div className="flex items-center space-x-2">
                      <Building className="w-4 h-4" />
                      <span><strong>Hospitais:</strong> {result.hospitalsCreated}</span>
                    </div>
                    
                    <div className="flex items-center space-x-2">
                      <MapPin className="w-4 h-4" />
                      <span><strong>Cobertura:</strong> {result.coverage}</span>
                    </div>
                    
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div>• Versão SIGTAP: {result.version?.version_name}</div>
                      <div>• Procedimentos: {result.proceduresCount}</div>
                      <div>• Pacientes: {result.patientsCount}</div>
                      <div>• Status: Rede Ativa</div>
                    </div>
                    
                    {result.hospitalsList && (
                      <details className="text-xs">
                        <summary className="cursor-pointer font-medium">Ver hospitais criados</summary>
                        <div className="mt-2 space-y-1">
                          {result.hospitalsList.map((hospital: any, index: number) => (
                            <div key={index} className="pl-2">
                              • {hospital.name} - {hospital.city}/PR
                            </div>
                          ))}
                        </div>
                      </details>
                    )}
                  </div>
                )}
              </div>
            </AlertDescription>
          </Alert>
        )}
      </CardContent>
    </Card>
  );
}; 
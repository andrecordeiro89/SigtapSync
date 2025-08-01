import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Badge } from './ui/badge';
import { Alert, AlertDescription } from './ui/alert';
import { Search, Database, AlertCircle, CheckCircle, FileText } from 'lucide-react';
import { ProcedureRecordsService, type ProcedureRecord } from '../services/simplifiedProcedureService';

const ProcedureDebugger: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [patientId, setPatientId] = useState('');
  const [procedures, setProcedures] = useState<ProcedureRecord[]>([]);
  const [tableInfo, setTableInfo] = useState<any>(null);
  const [allProcedures, setAllProcedures] = useState<ProcedureRecord[]>([]);
  const [error, setError] = useState<string>('');

  // 🔍 Buscar procedimentos por Patient ID
  const handleSearchByPatientId = async () => {
    if (!patientId.trim()) {
      setError('Digite um Patient ID');
      return;
    }

    setLoading(true);
    setError('');
    
    try {
      const result = await ProcedureRecordsService.getProceduresByPatientId(patientId.trim());
      
      if (result.success) {
        setProcedures(result.procedures);
        console.log('✅ Procedimentos encontrados:', result.procedures);
      } else {
        setError(result.error || 'Erro ao buscar procedimentos');
        setProcedures([]);
      }
    } catch (err) {
      setError('Erro inesperado: ' + (err instanceof Error ? err.message : 'Erro desconhecido'));
      setProcedures([]);
    } finally {
      setLoading(false);
    }
  };

  // 🔍 Verificar estrutura da tabela
  const handleCheckTableStructure = async () => {
    setLoading(true);
    setError('');
    
    try {
      const result = await SimplifiedProcedureService.getTableInfo();
      
      if (result.success) {
        setTableInfo(result);
        console.log('✅ Estrutura da tabela:', result);
      } else {
        setError(result.error || 'Erro ao verificar tabela');
      }
    } catch (err) {
      setError('Erro inesperado: ' + (err instanceof Error ? err.message : 'Erro desconhecido'));
    } finally {
      setLoading(false);
    }
  };

  // 🔍 Buscar todos os procedimentos (amostra)
  const handleGetAllProcedures = async () => {
    setLoading(true);
    setError('');
    
    try {
      const result = await SimplifiedProcedureService.getAllProcedures(50); // Limite de 50 para teste
      
      if (result.success) {
        setAllProcedures(result.procedures);
        console.log('✅ Todos os procedimentos:', result.procedures);
        console.log(`📊 Total na tabela: ${result.total}`);
      } else {
        setError(result.error || 'Erro ao buscar procedimentos');
      }
    } catch (err) {
      setError('Erro inesperado: ' + (err instanceof Error ? err.message : 'Erro desconhecido'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6 p-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Database className="h-5 w-5" />
            🔧 Debug - Tabela procedure_records
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          
          {/* ERRO */}
          {error && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {/* VERIFICAR ESTRUTURA DA TABELA */}
          <div className="space-y-2">
            <h3 className="font-medium">1. Verificar Estrutura da Tabela</h3>
            <Button onClick={handleCheckTableStructure} disabled={loading}>
              <Database className="h-4 w-4 mr-2" />
              Verificar Estrutura
            </Button>
            
            {tableInfo && (
              <div className="mt-3 p-3 bg-gray-50 rounded-lg">
                <h4 className="font-medium mb-2">Colunas encontradas:</h4>
                <div className="flex flex-wrap gap-1 mb-3">
                  {tableInfo.columns?.map((col: string) => (
                    <Badge key={col} variant="outline">{col}</Badge>
                  ))}
                </div>
                <h4 className="font-medium mb-2">Dados de exemplo:</h4>
                <pre className="text-xs bg-white p-2 rounded border overflow-auto max-h-40">
                  {JSON.stringify(tableInfo.sampleData, null, 2)}
                </pre>
              </div>
            )}
          </div>

          {/* BUSCAR TODOS OS PROCEDIMENTOS */}
          <div className="space-y-2">
            <h3 className="font-medium">2. Buscar Todos os Procedimentos (Amostra)</h3>
            <Button onClick={handleGetAllProcedures} disabled={loading}>
              <FileText className="h-4 w-4 mr-2" />
              Buscar Amostra (50 registros)
            </Button>
            
            {allProcedures.length > 0 && (
              <div className="mt-3 p-3 bg-green-50 rounded-lg">
                <p className="text-sm text-green-800 mb-2">
                  ✅ Encontrados {allProcedures.length} procedimentos
                </p>
                <div className="text-xs space-y-1">
                  {allProcedures.slice(0, 5).map((proc, index) => (
                    <div key={index} className="flex items-center gap-2">
                      <Badge variant="outline">{proc.procedure_code}</Badge>
                      <span>Patient: {proc.patient_id}</span>
                      <span>Valor: R$ {proc.value_reais.toFixed(2)}</span>
                    </div>
                  ))}
                  {allProcedures.length > 5 && (
                    <p className="text-gray-600">... e mais {allProcedures.length - 5} procedimentos</p>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* BUSCAR POR PATIENT ID */}
          <div className="space-y-2">
            <h3 className="font-medium">3. Buscar Procedimentos por Patient ID</h3>
            <div className="flex gap-2">
              <Input
                placeholder="Digite o Patient ID (UUID)"
                value={patientId}
                onChange={(e) => setPatientId(e.target.value)}
                className="flex-1"
              />
              <Button onClick={handleSearchByPatientId} disabled={loading || !patientId.trim()}>
                <Search className="h-4 w-4 mr-2" />
                Buscar
              </Button>
            </div>
            
            {/* SUGESTÕES DE IDs PARA TESTE */}
            {allProcedures.length > 0 && (
              <div className="text-xs text-gray-600">
                <p>💡 Patient IDs para teste:</p>
                <div className="flex flex-wrap gap-1 mt-1">
                  {[...new Set(allProcedures.map(p => p.patient_id))].slice(0, 3).map((id) => (
                    <button
                      key={id}
                      onClick={() => setPatientId(id)}
                      className="text-blue-600 hover:text-blue-800 underline text-xs"
                    >
                      {id.substring(0, 8)}...
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* RESULTADOS DOS PROCEDIMENTOS */}
          {procedures.length > 0 && (
            <div className="space-y-3">
              <h3 className="font-medium flex items-center gap-2">
                <CheckCircle className="h-4 w-4 text-green-600" />
                Procedimentos Encontrados ({procedures.length})
              </h3>
              
              <div className="space-y-2">
                {procedures.map((proc, index) => (
                  <div key={index} className="p-3 border rounded-lg bg-white">
                    <div className="flex items-start justify-between">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <Badge variant="outline">{proc.procedure_code}</Badge>
                          <Badge variant="secondary">{proc.status}</Badge>
                        </div>
                        <p className="text-sm font-medium">{proc.procedure_description}</p>
                        <div className="text-xs text-gray-600 space-y-0.5">
                          <p>📅 Data: {new Date(proc.procedure_date).toLocaleDateString('pt-BR')}</p>
                          <p>👤 Patient ID: {proc.patient_id}</p>
                          <p>🏥 AIH ID: {proc.aih_id}</p>
                          {proc.professional_name && (
                            <p>👨‍⚕️ Profissional: {proc.professional_name}</p>
                          )}
                          {proc.professional_cbo && (
                            <p>🔢 CBO: {proc.professional_cbo}</p>
                          )}
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-lg font-bold text-green-600">
                          R$ {proc.value_reais.toFixed(2)}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* CASO NÃO ENCONTRE PROCEDIMENTOS */}
          {procedures.length === 0 && patientId && !loading && !error && (
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                Nenhum procedimento encontrado para o Patient ID: <code>{patientId}</code>
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default ProcedureDebugger;
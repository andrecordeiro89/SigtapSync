import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { Alert, AlertDescription } from './ui/alert';
import { supabase } from '../lib/supabase';
import { toast } from 'sonner';
import {
  Database,
  Search,
  AlertTriangle,
  CheckCircle,
  Users,
  FileText,
  Stethoscope,
  BarChart3
} from 'lucide-react';

interface DiagnosticResult {
  diagnostico: string;
  [key: string]: any;
}

const AIHPatientDiagnostic: React.FC = () => {
  const [isRunning, setIsRunning] = useState(false);
  const [results, setResults] = useState<DiagnosticResult[]>([]);
  const [summary, setSummary] = useState<any>(null);

  const runDiagnostic = async () => {
    setIsRunning(true);
    toast.loading('🔍 Executando diagnóstico completo...');

    try {
      const diagnosticQueries = [
        // 1. Total de AIHs
        {
          name: '1. TOTAL DE AIHS',
          query: `
            SELECT 
              '1. TOTAL DE AIHS' as diagnostico,
              COUNT(*) as total_aihs,
              COUNT(CASE WHEN cns_responsavel IS NOT NULL THEN 1 END) as aihs_com_medico_responsavel,
              COUNT(CASE WHEN cns_responsavel IS NULL THEN 1 END) as aihs_sem_medico_responsavel,
              ROUND(
                (COUNT(CASE WHEN cns_responsavel IS NOT NULL THEN 1 END) * 100.0 / COUNT(*)), 2
              ) as percentual_com_medico
            FROM aihs
          `
        },
        // 2. Médicos responsáveis únicos
        {
          name: '2. MEDICOS RESPONSAVEIS',
          query: `
            SELECT 
              '2. MEDICOS RESPONSAVEIS' as diagnostico,
              COUNT(DISTINCT cns_responsavel) as medicos_unicos,
              COUNT(*) as total_registros_com_medico
            FROM aihs 
            WHERE cns_responsavel IS NOT NULL
          `
        },
        // 3. Relação AIH-Paciente
        {
          name: '3. RELACAO AIH-PACIENTE',
          query: `
            SELECT 
              '3. RELACAO AIH-PACIENTE' as diagnostico,
              COUNT(*) as total_aihs,
              COUNT(DISTINCT patient_id) as pacientes_unicos,
              COUNT(*) - COUNT(DISTINCT patient_id) as possiveis_duplicatas
            FROM aihs 
            WHERE cns_responsavel IS NOT NULL
          `
        },
        // 4. Procedimentos associados
        {
          name: '4. PROCEDIMENTOS',
          query: `
            SELECT 
              '4. PROCEDIMENTOS' as diagnostico,
              COUNT(*) as total_procedimentos,
              COUNT(DISTINCT patient_id) as pacientes_com_procedimentos,
              COUNT(DISTINCT aih_id) as aihs_com_procedimentos
            FROM procedure_records
          `
        },
        // 5. Pacientes sem procedimentos
        {
          name: '5. PACIENTES SEM PROCEDIMENTOS',
          query: `
            SELECT 
              '5. PACIENTES SEM PROCEDIMENTOS' as diagnostico,
              COUNT(DISTINCT a.patient_id) as pacientes_total_aihs,
              COUNT(DISTINCT pr.patient_id) as pacientes_com_procedimentos,
              COUNT(DISTINCT a.patient_id) - COUNT(DISTINCT pr.patient_id) as pacientes_sem_procedimentos
            FROM aihs a
            LEFT JOIN procedure_records pr ON a.patient_id = pr.patient_id
            WHERE a.cns_responsavel IS NOT NULL
          `
        },
        // 6. Médicos cadastrados
        {
          name: '6. MEDICOS CADASTRADOS',
          query: `
            SELECT 
              '6. MEDICOS CADASTRADOS' as diagnostico,
              COUNT(DISTINCT a.cns_responsavel) as medicos_cns_nas_aihs,
              COUNT(DISTINCT d.cns) as medicos_cadastrados_doctors,
              COUNT(DISTINCT a.cns_responsavel) - COUNT(DISTINCT d.cns) as medicos_nao_cadastrados
            FROM aihs a
            LEFT JOIN doctors d ON a.cns_responsavel = d.cns
            WHERE a.cns_responsavel IS NOT NULL
          `
        }
      ];

      const allResults: DiagnosticResult[] = [];

      for (const query of diagnosticQueries) {
        console.log(`🔍 Executando: ${query.name}`);
        const { data, error } = await supabase.rpc('execute_sql', { 
          sql_query: query.query 
        }).select();

        if (error) {
          console.error(`❌ Erro em ${query.name}:`, error);
          // Tentar query direta
          const { data: directData, error: directError } = await supabase
            .from('aihs')
            .select('*', { head: true, count: 'exact' });
          
          if (!directError) {
            allResults.push({
              diagnostico: query.name,
              erro: 'Query complexa falhou, usando count direto',
              total_aihs: directData?.length || 0
            });
          }
        } else if (data && data.length > 0) {
          allResults.push(data[0]);
        }
      }

      // Query simplificada para resumo
      const { data: aihsCount, error: aihsError } = await supabase
        .from('aihs')
        .select('*', { head: true, count: 'exact' });

      const { data: aihsWithDoctors, error: doctorsError } = await supabase
        .from('aihs')
        .select('*', { head: true, count: 'exact' })
        .not('cns_responsavel', 'is', null);

      const { data: proceduresCount, error: procError } = await supabase
        .from('procedure_records')
        .select('*', { head: true, count: 'exact' });

      if (!aihsError && !doctorsError && !procError) {
        setSummary({
          total_aihs: aihsCount?.length || 0,
          aihs_com_medico: aihsWithDoctors?.length || 0,
          total_procedimentos: proceduresCount?.length || 0,
          percentual_com_medico: aihsCount?.length ? 
            ((aihsWithDoctors?.length || 0) / aihsCount.length * 100).toFixed(1) : 0
        });
      }

      setResults(allResults);
      toast.success('✅ Diagnóstico concluído!');

    } catch (error) {
      console.error('❌ Erro no diagnóstico:', error);
      toast.error('❌ Erro ao executar diagnóstico');
    } finally {
      setIsRunning(false);
    }
  };

  const renderResultCard = (result: DiagnosticResult, index: number) => {
    const getIcon = (diagnostico: string) => {
      if (diagnostico.includes('TOTAL')) return <BarChart3 className="h-5 w-5" />;
      if (diagnostico.includes('MEDICOS')) return <Stethoscope className="h-5 w-5" />;
      if (diagnostico.includes('PACIENTE')) return <Users className="h-5 w-5" />;
      if (diagnostico.includes('PROCEDIMENTOS')) return <FileText className="h-5 w-5" />;
      return <Database className="h-5 w-5" />;
    };

    const getStatusColor = (result: DiagnosticResult) => {
      if (result.erro) return 'bg-red-100 border-red-300';
      if (result.possiveis_duplicatas > 0) return 'bg-yellow-100 border-yellow-300';
      if (result.pacientes_sem_procedimentos > 0) return 'bg-orange-100 border-orange-300';
      return 'bg-green-100 border-green-300';
    };

    return (
      <Card key={index} className={`${getStatusColor(result)} transition-all hover:shadow-lg`}>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-sm">
            {getIcon(result.diagnostico)}
            {result.diagnostico}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {Object.entries(result).map(([key, value]) => {
            if (key === 'diagnostico') return null;
            
            return (
              <div key={key} className="flex justify-between items-center">
                <span className="text-sm text-gray-600 capitalize">
                  {key.replace(/_/g, ' ')}:
                </span>
                <Badge variant={
                  key.includes('erro') ? 'destructive' :
                  key.includes('duplicatas') && value > 0 ? 'secondary' :
                  key.includes('sem_procedimentos') && value > 0 ? 'secondary' :
                  'default'
                }>
                  {typeof value === 'number' ? value.toLocaleString('pt-BR') : value}
                </Badge>
              </div>
            );
          })}
        </CardContent>
      </Card>
    );
  };

  return (
    <div className="max-w-7xl mx-auto p-6 space-y-6">
      {/* Cabeçalho */}
      <Card className="bg-gradient-to-r from-blue-900 via-blue-800 to-purple-800 text-white">
        <CardHeader>
          <CardTitle className="flex items-center gap-3">
            <Search className="h-6 w-6" />
            Diagnóstico AIH-Pacientes
          </CardTitle>
          <p className="text-blue-100">
            Análise da discrepância entre 818 AIHs e pacientes exibidos na tabela
          </p>
        </CardHeader>
        <CardContent>
          <Button 
            onClick={runDiagnostic}
            disabled={isRunning}
            className="bg-white text-blue-900 hover:bg-blue-50"
          >
            {isRunning ? (
              <>
                <Database className="h-4 w-4 mr-2 animate-spin" />
                Executando...
              </>
            ) : (
              <>
                <Search className="h-4 w-4 mr-2" />
                Executar Diagnóstico
              </>
            )}
          </Button>
        </CardContent>
      </Card>

      {/* Resumo Rápido */}
      {summary && (
        <Alert>
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            <strong>Resumo:</strong> {summary.total_aihs} AIHs total, 
            {summary.aihs_com_medico} com médico responsável ({summary.percentual_com_medico}%), 
            {summary.total_procedimentos} procedimentos cadastrados.
          </AlertDescription>
        </Alert>
      )}

      {/* Resultados */}
      {results.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {results.map((result, index) => renderResultCard(result, index))}
        </div>
      )}

      {/* Conclusões */}
      {results.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CheckCircle className="h-5 w-5 text-green-600" />
              Possíveis Causas da Discrepância
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="space-y-2">
              <h4 className="font-semibold text-sm text-gray-700">🔍 Análise:</h4>
              <ul className="text-sm text-gray-600 space-y-1 list-disc list-inside">
                <li><strong>AIHs sem médico responsável:</strong> Registros com cns_responsavel = NULL não aparecem na tabela</li>
                <li><strong>Médicos não cadastrados:</strong> CNS de responsáveis que não existem na tabela 'doctors'</li>
                <li><strong>Pacientes sem procedimentos:</strong> São filtrados e não exibidos na interface</li>
                <li><strong>Duplicatas:</strong> Mesmo paciente com múltiplas AIHs pode ser contado apenas uma vez</li>
                <li><strong>Filtros ativos:</strong> Busca por hospital específico reduz o número exibido</li>
              </ul>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default AIHPatientDiagnostic;
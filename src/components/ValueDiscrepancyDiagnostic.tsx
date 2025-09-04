import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { Alert, AlertDescription } from './ui/alert';
import { supabase } from '../lib/supabase';
import { toast } from 'sonner';
import {
  DollarSign,
  AlertTriangle,
  Calculator,
  Database,
  Users,
  FileText
} from 'lucide-react';

interface DiagnosticResult {
  fonte: string;
  [key: string]: any;
}

const formatCurrency = (value: number | null | undefined): string => {
  if (value == null || isNaN(value)) return 'R$ 0,00';
  return value.toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
};

const ValueDiscrepancyDiagnostic: React.FC = () => {
  const [isRunning, setIsRunning] = useState(false);
  const [results, setResults] = useState<DiagnosticResult[]>([]);
  const [summary, setSummary] = useState<any>(null);

  const runDiagnostic = async () => {
    setIsRunning(true);
    toast.loading('🔍 Analisando discrepância de valores...');

    try {
      // 1. Valor total da tabela aihs (cabeçalho)
      const { data: aihsTotal, error: aihsError } = await supabase
        .from('aihs')
        .select('calculated_total_value');

      // 2. Valor total da tabela procedure_records (médicos)
      const { data: proceduresTotal, error: procError } = await supabase
        .from('procedure_records')
        .select('total_value, value_charged');

      // 3. Contagem de registros
      const { count: aihsCount } = await supabase
        .from('aihs')
        .select('*', { count: 'exact', head: true });

      const { count: proceduresCount } = await supabase
        .from('procedure_records')
        .select('*', { count: 'exact', head: true });

      if (aihsError || procError) {
        throw new Error(`Erro nas consultas: ${aihsError?.message || procError?.message}`);
      }

      // Calcular totais
      const aihsValue = aihsTotal?.reduce((sum, aih) => {
        return sum + (aih.calculated_total_value || 0);
      }, 0) || 0;

      const proceduresTotalValue = proceduresTotal?.reduce((sum, proc) => {
        return sum + (proc.total_value || 0);
      }, 0) || 0;

      const proceduresChargedValue = proceduresTotal?.reduce((sum, proc) => {
        return sum + (proc.value_charged || 0);
      }, 0) || 0;

      // Assumindo que valores estão em centavos, converter para reais
      const aihsValueReais = aihsValue / 100;
      const proceduresTotalValueReais = proceduresTotalValue / 100;
      const proceduresChargedValueReais = proceduresChargedValue / 100;

      const results = [
        {
          fonte: '📊 Cabeçalho (tabela aihs)',
          registros: aihsCount || 0,
          campo_usado: 'calculated_total_value',
          valor_centavos: aihsValue,
          valor_reais: aihsValueReais,
          observacao: 'Valor usado no cabeçalho do dashboard'
        },
        {
          fonte: '👨‍⚕️ Médicos (procedure_records - total_value)',
          registros: proceduresCount || 0,
          campo_usado: 'total_value',
          valor_centavos: proceduresTotalValue,
          valor_reais: proceduresTotalValueReais,
          observacao: 'Valor usado na tabela de médicos'
        },
        {
          fonte: '👨‍⚕️ Médicos (procedure_records - value_charged)',
          registros: proceduresCount || 0,
          campo_usado: 'value_charged',
          valor_centavos: proceduresChargedValue,
          valor_reais: proceduresChargedValueReais,
          observacao: 'Campo alternativo de valor'
        }
      ];

      const discrepancy = aihsValueReais - proceduresTotalValueReais;
      const percentageCaptured = aihsValueReais > 0 ? (proceduresTotalValueReais / aihsValueReais) * 100 : 0;

      setSummary({
        cabecalho_valor: aihsValueReais,
        medicos_valor: proceduresTotalValueReais,
        discrepancia: discrepancy,
        percentual_capturado: percentageCaptured.toFixed(1),
        problema_identificado: Math.abs(discrepancy) > 1000 ? 'SIM' : 'NÃO'
      });

      setResults(results);
      toast.success('✅ Diagnóstico concluído!');

    } catch (error) {
      console.error('❌ Erro no diagnóstico:', error);
      toast.error('❌ Erro ao executar diagnóstico');
    } finally {
      setIsRunning(false);
    }
  };

  return (
    <div className="w-full px-6 space-y-6">
      {/* Cabeçalho */}
      <Card className="bg-gradient-to-r from-red-900 via-red-800 to-orange-800 text-white">
        <CardHeader>
          <CardTitle className="flex items-center gap-3">
            <DollarSign className="h-6 w-6" />
            Diagnóstico de Discrepância de Valores
          </CardTitle>
          <p className="text-red-100">
            Análise da diferença entre R$1.885.705,65 (cabeçalho) vs soma dos médicos
          </p>
        </CardHeader>
        <CardContent>
          <Button 
            onClick={runDiagnostic}
            disabled={isRunning}
            className="bg-white text-red-900 hover:bg-red-50"
          >
            {isRunning ? (
              <>
                <Calculator className="h-4 w-4 mr-2 animate-spin" />
                Calculando...
              </>
            ) : (
              <>
                <Calculator className="h-4 w-4 mr-2" />
                Executar Diagnóstico
              </>
            )}
          </Button>
        </CardContent>
      </Card>

      {/* Resumo da Discrepância */}
      {summary && (
        <Alert className={summary.problema_identificado === 'SIM' ? 'border-red-300 bg-red-50' : 'border-green-300 bg-green-50'}>
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            <div className="space-y-2">
              <div><strong>Cabeçalho:</strong> {formatCurrency(summary.cabecalho_valor)}</div>
              <div><strong>Soma Médicos:</strong> {formatCurrency(summary.medicos_valor)}</div>
              <div><strong>Discrepância:</strong> {formatCurrency(summary.discrepancia)}</div>
              <div><strong>% Capturado:</strong> {summary.percentual_capturado}%</div>
              <div><strong>Problema:</strong> <Badge variant={summary.problema_identificado === 'SIM' ? 'destructive' : 'default'}>
                {summary.problema_identificado}
              </Badge></div>
            </div>
          </AlertDescription>
        </Alert>
      )}

      {/* Resultados Detalhados */}
      {results.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {results.map((result, index) => {
            const getColor = () => {
              if (result.fonte.includes('aihs')) return 'border-blue-300 bg-blue-50';
              if (result.fonte.includes('total_value')) return 'border-green-300 bg-green-50';
              return 'border-yellow-300 bg-yellow-50';
            };

            const getIcon = () => {
              if (result.fonte.includes('aihs')) return <Database className="h-5 w-5 text-blue-600" />;
              if (result.fonte.includes('total_value')) return <Users className="h-5 w-5 text-green-600" />;
              return <FileText className="h-5 w-5 text-yellow-600" />;
            };

            return (
              <Card key={index} className={`transition-all hover:shadow-lg ${getColor()}`}>
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center gap-2 text-sm">
                    {getIcon()}
                    {result.fonte}
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <span className="text-sm text-gray-600">Registros:</span>
                      <Badge variant="outline">{result.registros?.toLocaleString('pt-BR')}</Badge>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm text-gray-600">Campo:</span>
                      <Badge variant="secondary" className="text-xs">{result.campo_usado}</Badge>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm text-gray-600">Valor:</span>
                      <Badge className="font-bold">
                        {formatCurrency(result.valor_reais)}
                      </Badge>
                    </div>
                  </div>
                  <p className="text-xs text-gray-500 italic">{result.observacao}</p>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Diagnóstico e Soluções */}
      {summary && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-orange-600" />
              Causa da Discrepância e Solução
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-3">
              <h4 className="font-semibold text-gray-700">🔍 Problema Identificado:</h4>
              <ul className="text-sm text-gray-600 space-y-1 list-disc list-inside">
                <li><strong>Fontes diferentes:</strong> Cabeçalho usa tabela 'aihs', médicos usam 'procedure_records'</li>
                <li><strong>Campos diferentes:</strong> 'calculated_total_value' vs 'total_value'</li>
                <li><strong>Possível conversão incorreta:</strong> Valores em centavos vs reais</li>
                <li><strong>Procedimentos perdidos:</strong> AIHs sem procedimentos correspondentes</li>
              </ul>
            </div>
            
            <div className="space-y-3">
              <h4 className="font-semibold text-gray-700">✅ Soluções Propostas:</h4>
              <ul className="text-sm text-gray-600 space-y-1 list-disc list-inside">
                <li><strong>Unificar fonte:</strong> Usar 'calculated_total_value' da tabela 'aihs' para médicos também</li>
                <li><strong>Corrigir associação:</strong> Garantir que cada AIH tenha seu valor associado ao médico correto</li>
                <li><strong>Validar conversão:</strong> Verificar se valores estão em centavos ou reais</li>
                <li><strong>Incluir AIHs órfãs:</strong> AIHs sem procedimentos também devem ter seus valores contabilizados</li>
              </ul>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default ValueDiscrepancyDiagnostic;
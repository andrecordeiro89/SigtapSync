import React, { useMemo } from 'react';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { 
  TrendingUp, 
  TrendingDown, 
  AlertTriangle, 
  CheckCircle, 
  Clock, 
  DollarSign,
  FileText,
  Activity,
  Users,
  Target,
  Zap,
  Shield,
  AlertCircle
} from 'lucide-react';

interface ProcedureData {
  id: string;
  procedure_sequence: number;
  procedure_code: string;
  match_status: 'pending' | 'approved' | 'rejected' | 'removed';
  match_confidence?: number;
  value_charged?: number;
  professional?: string;
}

interface AIHData {
  id: string;
  patient_name: string;
  patient_cpf: string;
  admission_date: string;
  discharge_date?: string;
  total_procedures?: number;
  total_value?: number;
  status: string;
  aih_procedures?: ProcedureData[];
}

interface AIHExecutiveSummaryProps {
  aih: AIHData;
  onRefresh?: () => void;
  className?: string;
}

const AIHExecutiveSummary = ({ aih, onRefresh, className = "" }: AIHExecutiveSummaryProps) => {
  const stats = useMemo(() => {
    const procedures = aih.aih_procedures || [];
    
    const pending = procedures.filter(p => p.match_status === 'pending').length;
    const approved = procedures.filter(p => p.match_status === 'approved').length;
    const rejected = procedures.filter(p => p.match_status === 'rejected').length;
    const removed = procedures.filter(p => p.match_status === 'removed').length;
    
    const totalValue = procedures
      .filter(p => p.match_status !== 'removed')
      .reduce((sum, p) => sum + (p.value_charged || 0), 0);
    
    const averageConfidence = procedures
      .filter(p => p.match_confidence && p.match_status !== 'removed')
      .reduce((sum, p, _, arr) => sum + (p.match_confidence || 0) / arr.length, 0);
    
    const totalActive = procedures.length - removed;
    const processingRate = totalActive > 0 ? ((approved + rejected) / totalActive) * 100 : 0;
    
    const uniqueProfessionals = new Set(
      procedures
        .filter(p => p.professional && p.match_status !== 'removed')
        .map(p => p.professional)
    ).size;
    
    return {
      total: procedures.length,
      pending,
      approved,
      rejected,
      removed,
      totalActive,
      totalValue,
      averageConfidence,
      processingRate,
      uniqueProfessionals
    };
  }, [aih.aih_procedures]);

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(value / 100);
  };

  const formatPercentage = (value: number) => {
    return `${value.toFixed(1)}%`;
  };

  const getStatusConfig = (type: string) => {
    const configs = {
      pending: { icon: Clock, color: 'bg-yellow-100 text-yellow-800 border-yellow-300', pulse: true },
      approved: { icon: CheckCircle, color: 'bg-green-100 text-green-800 border-green-300', pulse: false },
      rejected: { icon: AlertCircle, color: 'bg-red-100 text-red-800 border-red-300', pulse: false },
      removed: { icon: AlertTriangle, color: 'bg-gray-100 text-gray-600 border-gray-300', pulse: false }
    };
    return configs[type as keyof typeof configs] || configs.pending;
  };

  const getCriticalityLevel = () => {
    if (stats.rejected > stats.approved) return 'high';
    if (stats.pending > stats.total * 0.7) return 'medium';
    return 'low';
  };

  const criticalityLevel = getCriticalityLevel();

  return (
    <div className={`space-y-4 ${className}`}>
      {/* Header Executivo */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <div className="flex items-center space-x-2">
            <Activity className="w-5 h-5 text-blue-600" />
            <h3 className="text-lg font-semibold text-gray-900">Resumo Executivo</h3>
          </div>
          
          {/* Nível de Criticidade */}
          <Badge 
            className={`flex items-center space-x-1 ${
              criticalityLevel === 'high' ? 'bg-red-100 text-red-800 border-red-300' :
              criticalityLevel === 'medium' ? 'bg-yellow-100 text-yellow-800 border-yellow-300' :
              'bg-green-100 text-green-800 border-green-300'
            }`}
          >
            {criticalityLevel === 'high' ? (
              <AlertTriangle className="w-3 h-3" />
            ) : criticalityLevel === 'medium' ? (
              <Clock className="w-3 h-3" />
            ) : (
              <CheckCircle className="w-3 h-3" />
            )}
            <span className="text-xs font-medium">
              {criticalityLevel === 'high' ? 'Crítico' : 
               criticalityLevel === 'medium' ? 'Atenção' : 'Normal'}
            </span>
          </Badge>
        </div>

        {/* Botão de Refresh */}
        {onRefresh && (
          <button
            onClick={onRefresh}
            className="p-2 rounded-md hover:bg-gray-100 transition-colors"
            title="Atualizar dados"
          >
            <Activity className="w-4 h-4 text-gray-600" />
          </button>
        )}
      </div>

      {/* Grid de Estatísticas */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
        {/* Total de Procedimentos */}
        <Card className="border-blue-200 bg-blue-50">
          <CardContent className="p-3">
            <div className="flex items-center space-x-2">
              <FileText className="w-4 h-4 text-blue-600" />
              <div>
                <p className="text-xs text-blue-600 font-medium">Total</p>
                <p className="text-lg font-bold text-blue-800">{stats.total}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Pendentes */}
        <Card className="border-yellow-200 bg-yellow-50">
          <CardContent className="p-3">
            <div className="flex items-center space-x-2">
              <Clock className={`w-4 h-4 text-yellow-600 ${stats.pending > 0 ? 'animate-pulse' : ''}`} />
              <div>
                <p className="text-xs text-yellow-600 font-medium">Pendentes</p>
                <p className="text-lg font-bold text-yellow-800">{stats.pending}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Aprovados */}
        <Card className="border-green-200 bg-green-50">
          <CardContent className="p-3">
            <div className="flex items-center space-x-2">
              <CheckCircle className="w-4 h-4 text-green-600" />
              <div>
                <p className="text-xs text-green-600 font-medium">Aprovados</p>
                <p className="text-lg font-bold text-green-800">{stats.approved}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Rejeitados */}
        <Card className="border-red-200 bg-red-50">
          <CardContent className="p-3">
            <div className="flex items-center space-x-2">
              <AlertCircle className="w-4 h-4 text-red-600" />
              <div>
                <p className="text-xs text-red-600 font-medium">Rejeitados</p>
                <p className="text-lg font-bold text-red-800">{stats.rejected}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Valor Total */}
        <Card className="border-emerald-200 bg-emerald-50">
          <CardContent className="p-3">
            <div className="flex items-center space-x-2">
              <DollarSign className="w-4 h-4 text-emerald-600" />
              <div>
                <p className="text-xs text-emerald-600 font-medium">Valor</p>
                <p className="text-sm font-bold text-emerald-800">
                  {formatCurrency(stats.totalValue)}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Taxa de Processamento */}
        <Card className="border-purple-200 bg-purple-50">
          <CardContent className="p-3">
            <div className="flex items-center space-x-2">
              <Target className="w-4 h-4 text-purple-600" />
              <div>
                <p className="text-xs text-purple-600 font-medium">Taxa</p>
                <p className="text-lg font-bold text-purple-800">
                  {formatPercentage(stats.processingRate)}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Indicadores Avançados */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {/* Confiança Média */}
        <Card className="border-indigo-200 bg-indigo-50">
          <CardContent className="p-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <Zap className="w-4 h-4 text-indigo-600" />
                <div>
                  <p className="text-xs text-indigo-600 font-medium">Confiança Média</p>
                  <p className="text-lg font-bold text-indigo-800">
                    {formatPercentage(stats.averageConfidence * 100)}
                  </p>
                </div>
              </div>
              <div className="w-2 h-8 bg-indigo-200 rounded-full overflow-hidden">
                <div 
                  className="bg-indigo-600 rounded-full transition-all duration-500"
                  style={{ height: `${stats.averageConfidence * 100}%` }}
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Profissionais Únicos */}
        <Card className="border-teal-200 bg-teal-50">
          <CardContent className="p-3">
            <div className="flex items-center space-x-2">
              <Users className="w-4 h-4 text-teal-600" />
              <div>
                <p className="text-xs text-teal-600 font-medium">Profissionais</p>
                <p className="text-lg font-bold text-teal-800">{stats.uniqueProfessionals}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Status da AIH */}
        <Card className="border-slate-200 bg-slate-50">
          <CardContent className="p-3">
            <div className="flex items-center space-x-2">
              <Shield className="w-4 h-4 text-slate-600" />
              <div>
                <p className="text-xs text-slate-600 font-medium">Status AIH</p>
                <p className="text-sm font-bold text-slate-800 capitalize">{aih.status}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Alertas e Observações */}
      {(stats.rejected > 0 || stats.pending > stats.total * 0.5) && (
        <Card className="border-amber-200 bg-amber-50">
          <CardContent className="p-3">
            <div className="flex items-start space-x-2">
              <AlertTriangle className="w-4 h-4 text-amber-600 mt-0.5" />
              <div className="flex-1">
                <p className="text-xs text-amber-600 font-medium mb-1">Atenção Necessária</p>
                <div className="text-xs text-amber-700 space-y-1">
                  {stats.rejected > 0 && (
                    <p>• {stats.rejected} procedimento(s) rejeitado(s) necessitam revisão</p>
                  )}
                  {stats.pending > stats.total * 0.5 && (
                    <p>• {stats.pending} procedimento(s) pendentes de análise</p>
                  )}
                  {stats.removed > 0 && (
                    <p>• {stats.removed} procedimento(s) removido(s) temporariamente</p>
                  )}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default AIHExecutiveSummary; 
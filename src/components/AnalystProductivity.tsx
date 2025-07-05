import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Badge } from './ui/badge';
import { Button } from './ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { 
  Users, 
  FileText, 
  Calendar, 
  TrendingUp, 
  Clock, 
  CheckCircle2,
  AlertCircle,
  User
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { AIHAuditService, AnalystProductivity as AnalystProductivityType } from '../services/aihAuditService';
import { toast } from 'sonner';

/**
 * 📊 COMPONENTE DE PRODUTIVIDADE DOS ANALISTAS
 * Mostra quantas AIH cada analista/login processou
 */

const AnalystProductivity: React.FC = () => {
  const { user, canAccessAllHospitals } = useAuth();
  const [analysts, setAnalysts] = useState<AnalystProductivityType[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedPeriod, setSelectedPeriod] = useState<'today' | 'week' | 'month' | 'all'>('all');

  useEffect(() => {
    loadAnalystData();
  }, [selectedPeriod, user]);

  const loadAnalystData = async () => {
    if (!user) return;

    try {
      setLoading(true);
      console.log('📊 Carregando produtividade dos analistas...');

      const hospitalId = canAccessAllHospitals ? undefined : user.hospital_id;
      
      const result = await AIHAuditService.getAnalystProductivity(hospitalId, selectedPeriod);

      if (result.success) {
        setAnalysts(result.data);
        console.log(`✅ ${result.data.length} analistas carregados`);
      } else {
        console.error('❌ Erro ao carregar analistas:', result.error);
        toast.error('Erro ao carregar dados dos analistas');
        setAnalysts([]);
      }

    } catch (error) {
      console.error('❌ Erro inesperado:', error);
      toast.error('Erro inesperado ao carregar dados');
      setAnalysts([]);
    } finally {
      setLoading(false);
    }
  };

  const getPeriodLabel = (period: string) => {
    switch (period) {
      case 'today': return 'Hoje';
      case 'week': return 'Esta Semana';
      case 'month': return 'Este Mês';
      case 'all': return 'Todos os Períodos';
      default: return period;
    }
  };

  const getProductivityMetric = (analyst: AnalystProductivityType) => {
    switch (selectedPeriod) {
      case 'today': return analyst.aihs_today;
      case 'week': return analyst.aihs_this_week;
      case 'month': return analyst.aihs_this_month;
      default: return analyst.total_aihs;
    }
  };

  const getPerformanceColor = (successRate: number) => {
    if (successRate >= 95) return 'text-green-600';
    if (successRate >= 85) return 'text-yellow-600';
    return 'text-red-600';
  };

  const formatLastActivity = (timestamp: string) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffHours / 24);

    if (diffHours < 1) return 'Agora mesmo';
    if (diffHours < 24) return `${diffHours}h atrás`;
    if (diffDays < 7) return `${diffDays}d atrás`;
    return date.toLocaleDateString('pt-BR');
  };

  if (!user) {
    return (
      <Card>
        <CardContent className="p-8 text-center">
          <AlertCircle className="h-12 w-12 text-orange-500 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">Acesso Negado</h3>
          <p className="text-gray-500">Login necessário para visualizar dados dos analistas.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5 text-blue-600" />
              Produtividade dos Analistas
            </CardTitle>
            <CardDescription>
              Rastreamento de AIH por login/analista - {getPeriodLabel(selectedPeriod)}
            </CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <Select value={selectedPeriod} onValueChange={(value: any) => setSelectedPeriod(value)}>
              <SelectTrigger className="w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="today">Hoje</SelectItem>
                <SelectItem value="week">Esta Semana</SelectItem>
                <SelectItem value="month">Este Mês</SelectItem>
                <SelectItem value="all">Todos os Períodos</SelectItem>
              </SelectContent>
            </Select>
            <Button 
              variant="outline" 
              size="sm" 
              onClick={loadAnalystData}
              disabled={loading}
            >
              {loading ? 'Carregando...' : 'Atualizar'}
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="space-y-4">
            {[1, 2, 3, 4, 5].map(i => (
              <div key={i} className="animate-pulse bg-gray-200 h-20 rounded-lg"></div>
            ))}
          </div>
        ) : analysts.length > 0 ? (
          <div className="space-y-4">
            {/* Resumo Geral */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
              <div className="bg-blue-50 p-4 rounded-lg">
                <div className="flex items-center">
                  <Users className="h-8 w-8 text-blue-600" />
                  <div className="ml-3">
                    <p className="text-sm font-medium text-gray-500">Analistas Ativos</p>
                    <p className="text-2xl font-bold text-blue-600">{analysts.length}</p>
                  </div>
                </div>
              </div>
              <div className="bg-green-50 p-4 rounded-lg">
                <div className="flex items-center">
                  <FileText className="h-8 w-8 text-green-600" />
                  <div className="ml-3">
                    <p className="text-sm font-medium text-gray-500">Total AIH</p>
                    <p className="text-2xl font-bold text-green-600">
                      {analysts.reduce((sum, a) => sum + getProductivityMetric(a), 0)}
                    </p>
                  </div>
                </div>
              </div>
              <div className="bg-yellow-50 p-4 rounded-lg">
                <div className="flex items-center">
                  <TrendingUp className="h-8 w-8 text-yellow-600" />
                  <div className="ml-3">
                    <p className="text-sm font-medium text-gray-500">Média por Analista</p>
                    <p className="text-2xl font-bold text-yellow-600">
                      {analysts.length > 0 ? 
                        Math.round(analysts.reduce((sum, a) => sum + getProductivityMetric(a), 0) / analysts.length) : 0
                      }
                    </p>
                  </div>
                </div>
              </div>
              <div className="bg-purple-50 p-4 rounded-lg">
                <div className="flex items-center">
                  <CheckCircle2 className="h-8 w-8 text-purple-600" />
                  <div className="ml-3">
                    <p className="text-sm font-medium text-gray-500">Taxa de Sucesso</p>
                    <p className="text-2xl font-bold text-purple-600">
                      {analysts.length > 0 ? 
                        Math.round(analysts.reduce((sum, a) => sum + a.success_rate, 0) / analysts.length) : 0
                      }%
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Lista de Analistas */}
            <div className="space-y-3">
              {analysts.map((analyst, index) => (
                <div key={analyst.user_id} className="flex items-center justify-between p-4 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors">
                  <div className="flex items-center space-x-4">
                    <div className="flex-shrink-0">
                      <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
                        <User className="h-5 w-5 text-blue-600" />
                      </div>
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <h4 className="text-sm font-medium text-gray-900">
                          {analyst.user_name}
                        </h4>
                        <Badge variant="outline" className="text-xs">
                          #{index + 1}
                        </Badge>
                      </div>
                      <p className="text-xs text-gray-500">
                        {analyst.user_email}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center space-x-6">
                    {/* AIH Processadas */}
                    <div className="text-center">
                      <div className="flex items-center gap-1">
                        <FileText className="h-4 w-4 text-blue-600" />
                        <span className="text-lg font-bold text-blue-600">
                          {getProductivityMetric(analyst)}
                        </span>
                      </div>
                      <p className="text-xs text-gray-500">AIH {getPeriodLabel(selectedPeriod)}</p>
                    </div>

                    {/* Taxa de Sucesso */}
                    <div className="text-center">
                      <div className="flex items-center gap-1">
                        <CheckCircle2 className="h-4 w-4 text-green-600" />
                        <span className={`text-lg font-bold ${getPerformanceColor(analyst.success_rate)}`}>
                          {analyst.success_rate.toFixed(1)}%
                        </span>
                      </div>
                      <p className="text-xs text-gray-500">Taxa Sucesso</p>
                    </div>

                    {/* Tempo Médio */}
                    <div className="text-center">
                      <div className="flex items-center gap-1">
                        <Clock className="h-4 w-4 text-orange-600" />
                        <span className="text-lg font-bold text-orange-600">
                          {analyst.avg_processing_time.toFixed(1)}min
                        </span>
                      </div>
                      <p className="text-xs text-gray-500">Tempo Médio</p>
                    </div>

                    {/* Última Atividade */}
                    <div className="text-right">
                      <Badge variant="secondary" className="text-xs">
                        {formatLastActivity(analyst.last_activity)}
                      </Badge>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="text-center py-12">
            <Users className="h-12 w-12 mx-auto text-gray-300 mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">
              Nenhum Analista Encontrado
            </h3>
            <p className="text-gray-500 mb-4">
              Nenhuma atividade de processamento de AIH registrada para o período selecionado.
            </p>
            <Button variant="outline" onClick={loadAnalystData}>
              Tentar Novamente
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default AnalystProductivity; 
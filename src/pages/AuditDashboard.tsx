import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import { Button } from '../components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { 
  Shield, 
  Activity, 
  Users, 
  FileText, 
  BarChart3, 
  Calendar,
  Download,
  Filter,
  RefreshCw
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { AIHAuditService } from '../services/aihAuditService';
import AnalystProductivity from '../components/AnalystProductivity';
import { toast } from 'sonner';

/**
 * 🔍 PÁGINA DE AUDITORIA COMPLETA
 * Dashboard especializado para auditoria de AIH
 */

const AuditDashboard: React.FC = () => {
  const { user, canAccessAllHospitals } = useAuth();
  const [stats, setStats] = useState({
    totalAIHs: 0,
    processedToday: 0,
    pendingReview: 0,
    auditLogsCount: 0,
    avgProcessingTime: 0,
    successRate: 0
  });
  const [recentActivity, setRecentActivity] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    loadAuditData();
  }, [user]);

  const loadAuditData = async () => {
    if (!user) return;

    try {
      setLoading(true);
      console.log('🔍 Carregando dados de auditoria...');

      const hospitalId = canAccessAllHospitals ? undefined : user.hospital_id;

      // Carregar dados em paralelo
      const [statsResult, activityResult] = await Promise.all([
        AIHAuditService.getAIHStats(hospitalId),
        AIHAuditService.getRecentActivity(15, user.id, hospitalId)
      ]);

      // Processar estatísticas
      if (statsResult.success) {
        setStats(statsResult.data);
        console.log('✅ Estatísticas de auditoria carregadas');
      } else {
        console.error('❌ Erro ao carregar estatísticas:', statsResult.error);
        toast.error('Erro ao carregar estatísticas');
      }

      // Processar atividade recente
      if (activityResult.success) {
        setRecentActivity(activityResult.data);
        console.log(`✅ ${activityResult.data.length} atividades carregadas`);
      } else {
        console.error('❌ Erro ao carregar atividade:', activityResult.error);
        setRecentActivity([]);
      }

    } catch (error) {
      console.error('❌ Erro geral:', error);
      toast.error('Erro ao carregar dados de auditoria');
    } finally {
      setLoading(false);
    }
  };

  const refreshData = async () => {
    setRefreshing(true);
    await loadAuditData();
    setRefreshing(false);
    toast.success('Dados atualizados com sucesso!');
  };

  const exportAuditReport = async () => {
    toast.info('Funcionalidade de exportação em desenvolvimento');
  };

  const getActionIcon = (action: string) => {
    if (action.includes('SUCCESS')) return <FileText className="h-4 w-4 text-green-600" />;
    if (action.includes('ERROR')) return <Shield className="h-4 w-4 text-red-600" />;
    if (action.includes('STARTED')) return <Activity className="h-4 w-4 text-blue-600" />;
    return <Activity className="h-4 w-4 text-gray-600" />;
  };

  const getActionLabel = (action: string) => {
    const labels: Record<string, string> = {
      'AIH_PROCESSING_SUCCESS': 'AIH Processada com Sucesso',
      'AIH_PROCESSING_ERROR': 'Erro no Processamento',
      'AIH_PROCESSING_STARTED': 'Processamento Iniciado',
      'AIH_QUERY': 'Consulta de Dados',
    };
    return labels[action] || action;
  };

  const formatTime = (timestamp: string) => {
    return new Date(timestamp).toLocaleString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  if (!user) {
    return (
      <div className="p-6">
        <Card>
          <CardContent className="p-8 text-center">
            <Shield className="h-12 w-12 text-orange-500 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">Acesso Negado</h3>
            <p className="text-gray-500">Login necessário para acessar a auditoria.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="bg-gradient-to-r from-purple-600 to-blue-600 rounded-lg p-6 text-white">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Shield className="h-8 w-8" />
              Auditoria de AIH
            </h1>
            <p className="text-purple-100 mt-1">
              Rastreamento e análise de processamento por analista
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button 
              variant="secondary" 
              onClick={refreshData}
              disabled={refreshing}
              className="bg-white/20 hover:bg-white/30 text-white border-white/30"
            >
              <RefreshCw className={`h-4 w-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
              {refreshing ? 'Atualizando...' : 'Atualizar'}
            </Button>
            <Button 
              variant="secondary" 
              onClick={exportAuditReport}
              className="bg-white/20 hover:bg-white/30 text-white border-white/30"
            >
              <Download className="h-4 w-4 mr-2" />
              Exportar
            </Button>
          </div>
        </div>
      </div>

      {/* Cards de Estatísticas */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center">
              <FileText className="h-8 w-8 text-blue-600" />
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-500">Total de AIHs</p>
                <p className="text-2xl font-bold">{stats.totalAIHs}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center">
              <Activity className="h-8 w-8 text-green-600" />
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-500">Processadas Hoje</p>
                <p className="text-2xl font-bold">{stats.processedToday}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center">
              <Shield className="h-8 w-8 text-orange-600" />
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-500">Pendente Revisão</p>
                <p className="text-2xl font-bold">{stats.pendingReview}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center">
              <BarChart3 className="h-8 w-8 text-purple-600" />
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-500">Logs de Auditoria</p>
                <p className="text-2xl font-bold">{stats.auditLogsCount}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Conteúdo Principal */}
      <Tabs defaultValue="productivity" className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="productivity">Produtividade dos Analistas</TabsTrigger>
          <TabsTrigger value="activity">Atividade Recente</TabsTrigger>
          <TabsTrigger value="reports">Relatórios</TabsTrigger>
        </TabsList>
        
        <TabsContent value="productivity" className="space-y-4">
          <AnalystProductivity />
        </TabsContent>
        
        <TabsContent value="activity" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Activity className="h-5 w-5 text-blue-600" />
                Atividade Recente
              </CardTitle>
              <CardDescription>
                Últimas ações de processamento de AIH no sistema
              </CardDescription>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="space-y-3">
                  {[1, 2, 3, 4, 5].map(i => (
                    <div key={i} className="animate-pulse bg-gray-200 h-16 rounded"></div>
                  ))}
                </div>
              ) : recentActivity.length > 0 ? (
                <div className="space-y-3">
                  {recentActivity.map((log) => (
                    <div key={log.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                      <div className="flex items-center space-x-3">
                        {getActionIcon(log.action)}
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-gray-900">
                            {getActionLabel(log.action)}
                          </p>
                          <p className="text-xs text-gray-500">
                            {formatTime(log.created_at)} • {log.user_name || log.user_email}
                          </p>
                          {log.aih_number && (
                            <p className="text-xs text-blue-600 font-mono">
                              AIH: {log.aih_number}
                            </p>
                          )}
                        </div>
                      </div>
                      <div className="text-right">
                        <Badge variant="outline" className="text-xs">
                          {log.operation_type}
                        </Badge>
                        {log.hospital_name && (
                          <p className="text-xs text-gray-400 mt-1">
                            {log.hospital_name}
                          </p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 text-gray-500">
                  <Activity className="h-12 w-12 mx-auto mb-4 text-gray-300" />
                  <p>Nenhuma atividade recente encontrada</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
        
        <TabsContent value="reports" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BarChart3 className="h-5 w-5 text-purple-600" />
                Relatórios de Auditoria
              </CardTitle>
              <CardDescription>
                Relatórios detalhados e análises de produtividade
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="p-4 border rounded-lg">
                  <h4 className="font-semibold mb-2">Relatório de Produtividade</h4>
                  <p className="text-sm text-gray-600 mb-3">
                    AIH processadas por analista em período específico
                  </p>
                  <Button variant="outline" className="w-full">
                    <Download className="h-4 w-4 mr-2" />
                    Gerar Relatório
                  </Button>
                </div>
                
                <div className="p-4 border rounded-lg">
                  <h4 className="font-semibold mb-2">Análise de Desempenho</h4>
                  <p className="text-sm text-gray-600 mb-3">
                    Taxa de sucesso e tempo médio de processamento
                  </p>
                  <Button variant="outline" className="w-full">
                    <BarChart3 className="h-4 w-4 mr-2" />
                    Ver Análise
                  </Button>
                </div>
                
                <div className="p-4 border rounded-lg">
                  <h4 className="font-semibold mb-2">Log de Auditoria Completo</h4>
                  <p className="text-sm text-gray-600 mb-3">
                    Histórico completo de ações no sistema
                  </p>
                  <Button variant="outline" className="w-full">
                    <Calendar className="h-4 w-4 mr-2" />
                    Exportar Logs
                  </Button>
                </div>
                
                <div className="p-4 border rounded-lg">
                  <h4 className="font-semibold mb-2">Resumo Executivo</h4>
                  <p className="text-sm text-gray-600 mb-3">
                    Métricas consolidadas para gestão
                  </p>
                  <Button variant="outline" className="w-full">
                    <Users className="h-4 w-4 mr-2" />
                    Gerar Resumo
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default AuditDashboard; 
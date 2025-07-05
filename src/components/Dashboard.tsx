import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Badge } from './ui/badge';
import { Button } from './ui/button';
import { AlertCircle, CheckCircle, Clock, Users, Building2, FileText, Activity, ShieldCheck } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useSupabaseAIH } from '../hooks/useSupabase';
import { supabase } from '../lib/supabase';
import { toast } from 'sonner';
import { AIHAuditService } from '../services/aihAuditService';

interface HospitalInfo {
  id: string;
  name: string;
  cnpj: string;
  city?: string;
  state?: string;
  is_active: boolean;
}

interface DashboardStats {
  totalAIHs: number;
  processedToday: number;
  pendingReview: number;
  auditLogsCount: number;
  avgProcessingTime?: number;
  successRate?: number;
}

const Dashboard = () => {
  const { user, getCurrentHospital, canAccessAllHospitals } = useAuth();
  const { getUserAuditLogs, getHospitalAIHs } = useSupabaseAIH();
  
  const [hospitalInfo, setHospitalInfo] = useState<HospitalInfo | null>(null);
  const [stats, setStats] = useState<DashboardStats>({
    totalAIHs: 0,
    processedToday: 0,
    pendingReview: 0,
    auditLogsCount: 0
  });
  const [recentAuditLogs, setRecentAuditLogs] = useState<any[]>([]);
  const [recentActivity, setRecentActivity] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Carregar informações do hospital atual
  useEffect(() => {
    const loadHospitalInfo = async () => {
      const currentHospital = getCurrentHospital();
      // Não carregar se não há hospital ou se é 'ALL' (acesso total)
      if (!currentHospital || currentHospital === 'ALL') return;
    
      try {
        const { data, error } = await supabase
          .from('hospitals')
          .select('id, name, cnpj, city, state, is_active')
          .eq('id', currentHospital)
          .single();

        if (error) {
          console.error('Erro ao carregar hospital:', error);
          toast.error('Erro ao carregar informações do hospital');
          return;
        }

        setHospitalInfo(data);
      } catch (err) {
        console.error('Erro inesperado:', err);
      }
    };

    loadHospitalInfo();
  }, [getCurrentHospital]);

  // Carregar estatísticas e logs
  useEffect(() => {
    const loadDashboardData = async () => {
      if (!user) return;

      try {
        setLoading(true);
        console.log('🔄 Carregando dados do dashboard...');

        const hospitalId = canAccessAllHospitals ? undefined : user.hospital_id;

        // Carregar dados em paralelo usando o novo serviço
        const [statsResult, activityResult] = await Promise.all([
          AIHAuditService.getAIHStats(hospitalId),
          AIHAuditService.getRecentActivity(10, user.id, hospitalId)
        ]);

        // Processar estatísticas
        if (statsResult.success) {
          setStats(statsResult.data);
          console.log('✅ Estatísticas carregadas:', statsResult.data);
        } else {
          console.error('❌ Erro ao carregar estatísticas:', statsResult.error);
          toast.error('Erro ao carregar estatísticas');
          
          // Usar dados de fallback
          setStats({
            totalAIHs: 0,
            processedToday: 0,
            pendingReview: 0,
            auditLogsCount: 0
          });
        }

        // Processar atividade recente
        if (activityResult.success) {
          setRecentActivity(activityResult.data);
          setRecentAuditLogs(activityResult.data); // Manter compatibilidade
          console.log('✅ Atividade recente carregada:', activityResult.data.length, 'itens');
        } else {
          console.error('❌ Erro ao carregar atividade:', activityResult.error);
          setRecentActivity([]);
          setRecentAuditLogs([]);
        }

      } catch (error) {
        console.error('❌ Erro geral ao carregar dashboard:', error);
        toast.error('Erro ao carregar dados do dashboard');
      } finally {
        setLoading(false);
      }
    };

    loadDashboardData();
  }, [user, canAccessAllHospitals]);

  const getActionIcon = (action: string) => {
    if (action.includes('LOGIN')) return <ShieldCheck className="h-4 w-4 text-green-600" />;
    if (action.includes('AIH')) return <FileText className="h-4 w-4 text-blue-600" />;
    if (action.includes('ERROR')) return <AlertCircle className="h-4 w-4 text-red-600" />;
    return <Activity className="h-4 w-4 text-gray-600" />;
  };

  const getActionLabel = (action: string) => {
    const labels: Record<string, string> = {
      'LOGIN_SUCCESS': 'Login realizado',
      'LOGOUT': 'Logout realizado',
      'AIH_PROCESSING_STARTED': 'Processamento AIH iniciado',
      'AIH_PROCESSING_SUCCESS': 'AIH processada com sucesso',
      'AIH_PROCESSING_ERROR': 'Erro no processamento',
      'AIH_QUERY': 'Consulta de AIHs',
      'USER_CREATED': 'Usuário criado',
      'HOSPITAL_ACCESS_UPDATED': 'Acesso atualizado'
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
            <AlertCircle className="h-12 w-12 text-orange-500 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">Acesso Negado</h3>
            <p className="text-gray-500">Você precisa estar logado para acessar o dashboard.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header com informações do usuário */}
      <div className="bg-gradient-to-r from-blue-600 to-blue-700 rounded-lg p-6 text-white">
        <div className="flex items-center justify-between">
        <div>
            <h1 className="text-2xl font-bold">
              Bem-vindo, {user.full_name || user.email?.split('@')[0]}!
            </h1>
            <p className="text-blue-100 mt-1">
              Dashboard do Sistema SIGTAP Sync
          </p>
        </div>
          <div className="text-right">
            <Badge variant="secondary" className="bg-white/20 text-white border-white/30">
              {user.role.toUpperCase()}
            </Badge>
            {hospitalInfo && (
              <p className="text-blue-100 text-sm mt-2">
                <Building2 className="h-4 w-4 inline mr-1" />
                {hospitalInfo.name}
              </p>
            )}
          </div>
        </div>
      </div>
      
      {/* Informações do Hospital */}
      {hospitalInfo && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Building2 className="h-5 w-5 text-blue-600" />
              Hospital Atual
            </CardTitle>
            <CardDescription>
              Informações do hospital selecionado para esta sessão
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <p className="text-sm text-gray-500">Nome</p>
                <p className="font-medium">{hospitalInfo.name}</p>
              </div>
              <div>
                <p className="text-sm text-gray-500">CNPJ</p>
                <p className="font-medium">{hospitalInfo.cnpj}</p>
              </div>
              <div>
                <p className="text-sm text-gray-500">Localização</p>
                <p className="font-medium">
                  {hospitalInfo.city && hospitalInfo.state 
                    ? `${hospitalInfo.city}, ${hospitalInfo.state}`
                    : 'Não informado'}
                </p>
              </div>
            </div>
            <div className="mt-4 flex items-center gap-2">
              <Badge variant={hospitalInfo.is_active ? "default" : "secondary"}>
                {hospitalInfo.is_active ? 'Ativo' : 'Inativo'}
              </Badge>
              <span className="text-sm text-gray-500">
                Acesso a {user.hospital_access.length} {user.hospital_access.length === 1 ? 'hospital' : 'hospitais'}
              </span>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Estatísticas Rápidas */}
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
              <Clock className="h-8 w-8 text-green-600" />
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
              <AlertCircle className="h-8 w-8 text-orange-600" />
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
              <Activity className="h-8 w-8 text-purple-600" />
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-500">Logs de Auditoria</p>
                <p className="text-2xl font-bold">{stats.auditLogsCount}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Atividade Recente */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Logs de Auditoria Recentes */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Activity className="h-5 w-5 text-purple-600" />
              Atividade Recente
            </CardTitle>
            <CardDescription>
              Suas últimas ações no sistema com rastreabilidade completa
            </CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="space-y-3">
                {[1, 2, 3].map(i => (
                  <div key={i} className="animate-pulse bg-gray-200 h-16 rounded"></div>
                ))}
              </div>
            ) : recentActivity.length > 0 ? (
              <div className="space-y-3">
                {recentActivity.map((log) => (
                  <div key={log.id} className="flex items-center space-x-3 p-3 bg-gray-50 rounded-lg">
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

        {/* Status do Sistema */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CheckCircle className="h-5 w-5 text-green-600" />
              Status do Sistema
            </CardTitle>
            <CardDescription>
              Verificações de integridade e conectividade
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex items-center justify-between p-3 bg-green-50 rounded-lg">
                <div className="flex items-center">
                  <CheckCircle className="h-5 w-5 text-green-600 mr-3" />
                  <div>
                    <p className="text-sm font-medium">Autenticação</p>
                    <p className="text-xs text-gray-500">Sistema de login ativo</p>
                  </div>
                </div>
                <Badge variant="default" className="bg-green-100 text-green-800">
                  Ativo
                </Badge>
              </div>

              <div className="flex items-center justify-between p-3 bg-blue-50 rounded-lg">
                <div className="flex items-center">
                  <Building2 className="h-5 w-5 text-blue-600 mr-3" />
                  <div>
                    <p className="text-sm font-medium">Hospital Conectado</p>
                    <p className="text-xs text-gray-500">Dados do hospital disponíveis</p>
                  </div>
                </div>
                <Badge variant="default" className="bg-blue-100 text-blue-800">
                  Conectado
                </Badge>
              </div>

              <div className="flex items-center justify-between p-3 bg-purple-50 rounded-lg">
                <div className="flex items-center">
                  <ShieldCheck className="h-5 w-5 text-purple-600 mr-3" />
                  <div>
                    <p className="text-sm font-medium">Auditoria</p>
                    <p className="text-xs text-gray-500">Rastreabilidade completa</p>
                  </div>
                </div>
                <Badge variant="default" className="bg-purple-100 text-purple-800">
                  Ativo
                </Badge>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default Dashboard;

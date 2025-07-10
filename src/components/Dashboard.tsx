import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Badge } from './ui/badge';
import { Button } from './ui/button';
import { AlertCircle, CheckCircle, Clock, Users, Building2, FileText, Activity, ShieldCheck, BookOpen, ArrowRight, Database, Search, Upload, Save, Eye } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useSupabaseAIH } from '../hooks/useSupabase';
import { supabase } from '../lib/supabase';
import { toast } from 'sonner';
import { AIHPersistenceService } from '../services/aihPersistenceService';

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
  hospitals_count?: number;
  is_admin_mode?: boolean;
}

const Dashboard = () => {
  const { user, getCurrentHospital, canAccessAllHospitals } = useAuth();
  const { getUserAuditLogs, getHospitalAIHs } = useSupabaseAIH();
  
  const [hospitalInfo, setHospitalInfo] = useState<HospitalInfo | null>(null);
  const [stats, setStats] = useState<DashboardStats>({
    totalAIHs: 0,
    processedToday: 0
  });
  const [recentAuditLogs, setRecentAuditLogs] = useState<any[]>([]);
  const [recentActivity, setRecentActivity] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // ✅ Função para verificar se é usuário de diretoria
  const isManagementRole = (): boolean => {
    if (!user) return false;
    return ['admin', 'ti', 'coordinator', 'director', 'auditor', 'developer'].includes(user.role);
  };

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

        // ✅ MODO ADMINISTRADOR: Detectar se usuário tem acesso total
        const isAdminMode = canAccessAllHospitals || user.full_access || user.hospital_id === 'ALL';
        const hospitalId = isAdminMode ? 'ALL' : user.hospital_id;
        
        console.log(`🔐 Modo de acesso: ${isAdminMode ? 'ADMINISTRADOR (todos os hospitais)' : `USUÁRIO (hospital: ${hospitalId})`}`);

        // Carregar dados reais usando AIHPersistenceService
        const persistenceService = new AIHPersistenceService();
        
        // Carregar estatísticas reais do hospital
        const realStats = await persistenceService.getHospitalStats(hospitalId);
        
        // Calcular AIHs processadas hoje
        const today = new Date().toISOString().split('T')[0];
        const todayAIHs = await persistenceService.getAIHs(hospitalId, {
          dateFrom: today,
          dateTo: today,
          limit: 1000
        });

        // Buscar atividades recentes (AIHs criadas recentemente)
        const recentAIHs = await persistenceService.getAIHs(hospitalId, {
          limit: 10
        });

        // Processar dados para os cards
        setStats({
          totalAIHs: realStats.total_aihs,
          processedToday: todayAIHs.length,
          hospitals_count: realStats.hospitals_count,
          is_admin_mode: realStats.is_admin_mode
        });

        // Processar atividade recente
        const processedActivity = recentAIHs.map(aih => ({
          id: aih.id,
          action: 'AIH_CREATED',
          aih_number: aih.aih_number,
          user_name: aih.processed_by_name || 'Sistema',
          user_email: 'operador@sistema.com',
          hospital_name: isAdminMode 
            ? (aih.hospitals?.name || 'Hospital N/A')
            : (hospitalInfo?.name || 'Hospital'),
          created_at: aih.created_at,
          operation_type: 'CREATE',
          patient_name: aih.patients?.name || 'Paciente'
        }));

        setRecentActivity(processedActivity);
        setRecentAuditLogs(processedActivity);
        console.log(`✅ Dados ${isAdminMode ? 'de TODOS os hospitais' : 'do hospital específico'} carregados:`, realStats);

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
      'AIH_CREATED': 'AIH cadastrada',
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

  // ✅ Card explicativo para usuários comuns - Versão compacta
  const SystemExplanationCard = () => (
    <Card className="hover:shadow-md transition-shadow border-l-4 border-l-purple-500 h-[400px] flex flex-col">
      <CardHeader className="pb-3 flex-shrink-0">
        <CardTitle className="flex items-center gap-2 text-lg">
          <BookOpen className="h-5 w-5 text-purple-600" />
          Como Funciona o Sistema
        </CardTitle>
        <CardDescription className="text-sm">
          Fluxo de processamento AIH
        </CardDescription>
      </CardHeader>
      <CardContent className="pt-0 flex-1">
        <div className="space-y-2">
          <div className="flex items-center gap-3 p-2 bg-blue-50 rounded-lg">
            <Search className="h-4 w-4 text-blue-600 flex-shrink-0" />
            <div>
              <h4 className="font-medium text-blue-900 text-sm">1. Consulta SIGTAP</h4>
              <p className="text-xs text-blue-700">Tabela oficial de procedimentos SUS</p>
            </div>
          </div>
          
          <div className="flex items-center gap-3 p-2 bg-green-50 rounded-lg">
            <Upload className="h-4 w-4 text-green-600 flex-shrink-0" />
            <div>
              <h4 className="font-medium text-green-900 text-sm">2. Upload de Documentos</h4>
              <p className="text-xs text-green-700">Excel, PDF e ZIP com IA</p>
            </div>
          </div>
          
          <div className="flex items-center gap-3 p-2 bg-orange-50 rounded-lg">
            <Database className="h-4 w-4 text-orange-600 flex-shrink-0" />
            <div>
              <h4 className="font-medium text-orange-900 text-sm">3. Extração Inteligente</h4>
              <p className="text-xs text-orange-700">Processo feito com IA</p>
            </div>
          </div>
          
          <div className="flex items-center gap-3 p-2 bg-purple-50 rounded-lg">
            <Save className="h-4 w-4 text-purple-600 flex-shrink-0" />
            <div>
              <h4 className="font-medium text-purple-900 text-sm">4. Salvamento Seguro</h4>
              <p className="text-xs text-purple-700">Auditoria completa integrada</p>
            </div>
          </div>
          
          <div className="flex items-center gap-3 p-2 bg-indigo-50 rounded-lg">
            <Eye className="h-4 w-4 text-indigo-600 flex-shrink-0" />
            <div>
              <h4 className="font-medium text-indigo-900 text-sm">5. Consulta de Pacientes</h4>
              <p className="text-xs text-indigo-700">Acesso rápido aos dados</p>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );

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
    <div className="p-4 space-y-4">
      {/* Header com informações do usuário - Versão compacta */}
      <div className="bg-gradient-to-r from-blue-600 to-blue-700 rounded-lg p-4 text-white">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold">
              Bem-vindo, {user.role === 'developer' ? 'Desenvolvedor' : user.role === 'admin' ? 'Administrador' : user.full_name || user.email?.split('@')[0]}!
            </h1>
            <p className="text-blue-100 text-sm mt-1">
              {isManagementRole() 
                ? 'Todos os Hospitais' 
                : (hospitalInfo?.name || 'Dashboard do Sistema SIGTAP')}
            </p>
          </div>
          <div className="text-right flex items-center">
            <div className="p-3 bg-white/10 rounded-full">
              <ShieldCheck className="h-8 w-8 text-white" />
            </div>
          </div>
        </div>
      </div>
      
      {/* Informações do Hospital - Versão compacta */}
      {hospitalInfo && (
        <Card className="h-[140px] flex flex-col">
          <CardHeader className="pb-3 flex-shrink-0">
            <CardTitle className="flex items-center gap-2 text-lg">
              <Building2 className="h-5 w-5 text-blue-600" />
              Hospital Atual
            </CardTitle>
            <CardDescription className="text-sm">
              Informações do hospital selecionado
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-0 flex-1">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div>
                <p className="text-xs text-gray-500">Nome</p>
                <p className="font-medium text-sm">{hospitalInfo.name}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500">CNPJ</p>
                <p className="font-medium text-sm">{hospitalInfo.cnpj}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500">Localização</p>
                <p className="font-medium text-sm">
                  {hospitalInfo.city && hospitalInfo.state 
                    ? `${hospitalInfo.city}, ${hospitalInfo.state}`
                    : 'Não informado'}
                </p>
              </div>
            </div>

          </CardContent>
        </Card>
      )}

      {/* ✅ Estatísticas Principais - Apenas para Diretoria - Versão compacta */}
      {isManagementRole() && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Card className="hover:shadow-md transition-shadow border-l-4 border-l-blue-500 h-[120px] flex flex-col">
            <CardContent className="p-4 flex-1 flex items-center">
              <div className="flex items-center space-x-3 w-full">
                <div className="p-3 bg-blue-100 rounded-lg">
                  <FileText className="h-6 w-6 text-blue-600" />
                </div>
                <div className="flex-1">
                  <p className="text-xs font-medium text-gray-600 uppercase tracking-wide">Total de AIHs</p>
                  <p className="text-2xl font-bold text-gray-900">{loading ? '...' : stats.totalAIHs}</p>
                  <p className="text-xs text-blue-600 mt-1">
                    {stats.is_admin_mode 
                      ? `Em ${stats.hospitals_count || 8} hospitais` 
                      : (stats.totalAIHs > 0 ? 'Registradas no sistema' : 'Nenhuma AIH registrada')
                    }
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="hover:shadow-md transition-shadow border-l-4 border-l-green-500 h-[120px] flex flex-col">
            <CardContent className="p-4 flex-1 flex items-center">
              <div className="flex items-center space-x-3 w-full">
                <div className="p-3 bg-green-100 rounded-lg">
                  <Clock className="h-6 w-6 text-green-600" />
                </div>
                <div className="flex-1">
                  <p className="text-xs font-medium text-gray-600 uppercase tracking-wide">Processadas Hoje</p>
                  <p className="text-2xl font-bold text-gray-900">{loading ? '...' : stats.processedToday}</p>
                  <p className="text-xs text-green-600 mt-1">
                    {stats.is_admin_mode 
                      ? `Todos os hospitais` 
                      : (stats.processedToday > 0 ? `${stats.processedToday} nova${stats.processedToday !== 1 ? 's' : ''} hoje` : 'Nenhuma hoje')
                    }
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* ✅ Cards para Usuários Comuns - Layout 2 colunas */}
      {!isManagementRole() && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <SystemExplanationCard />
          
          {/* Status do Sistema para Usuários */}
          <Card className="h-[400px] flex flex-col">
            <CardHeader className="pb-3 flex-shrink-0">
              <CardTitle className="flex items-center gap-2 text-lg">
                <CheckCircle className="h-5 w-5 text-green-600" />
                Status do Sistema
              </CardTitle>
              <CardDescription className="text-sm">
                Verificações de integridade
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-0 flex-1">
              <div className="space-y-2">
                <div className="flex items-center justify-between p-2 bg-green-50 rounded-lg">
                  <div className="flex items-center">
                    <CheckCircle className="h-4 w-4 text-green-600 mr-2" />
                    <div>
                      <p className="text-sm font-medium">Autenticação</p>
                      <p className="text-xs text-gray-500">Sistema de login ativo</p>
                    </div>
                  </div>
                  <Badge variant="default" className="bg-green-100 text-green-800 text-xs">
                    Ativo
                  </Badge>
                </div>

                <div className="flex items-center justify-between p-2 bg-blue-50 rounded-lg">
                  <div className="flex items-center">
                    <Building2 className="h-4 w-4 text-blue-600 mr-2" />
                    <div>
                      <p className="text-sm font-medium">Hospital Conectado</p>
                      <p className="text-xs text-gray-500">Dados disponíveis</p>
                    </div>
                  </div>
                  <Badge variant="default" className="bg-blue-100 text-blue-800 text-xs">
                    Conectado
                  </Badge>
                </div>

                <div className="flex items-center justify-between p-2 bg-purple-50 rounded-lg">
                  <div className="flex items-center">
                    <ShieldCheck className="h-4 w-4 text-purple-600 mr-2" />
                    <div>
                      <p className="text-sm font-medium">Auditoria</p>
                      <p className="text-xs text-gray-500">Rastreabilidade completa</p>
                    </div>
                  </div>
                  <Badge variant="default" className="bg-purple-100 text-purple-800 text-xs">
                    Ativo
                  </Badge>
                </div>

                <div className="flex items-center justify-between p-2 bg-yellow-50 rounded-lg">
                  <div className="flex items-center">
                    <FileText className="h-4 w-4 text-yellow-600 mr-2" />
                    <div>
                      <p className="text-sm font-medium">SIGTAP Atualizado</p>
                      <p className="text-xs text-gray-500">Tabela oficial</p>
                    </div>
                  </div>
                  <Badge variant="default" className="bg-yellow-100 text-yellow-800 text-xs">
                    Atualizado
                  </Badge>
                </div>

                <div className="flex items-center justify-between p-2 bg-indigo-50 rounded-lg">
                  <div className="flex items-center">
                    <Users className="h-4 w-4 text-indigo-600 mr-2" />
                    <div>
                      <p className="text-sm font-medium">Processamento IA</p>
                      <p className="text-xs text-gray-500">Extração automática</p>
                    </div>
                  </div>
                  <Badge variant="default" className="bg-indigo-100 text-indigo-800 text-xs">
                    Ativo
                  </Badge>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* ✅ Layout Responsivo baseado no Role - Apenas para Diretoria */}
      {isManagementRole() && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Logs de Auditoria Recentes */}
          <Card className="h-[400px] flex flex-col">
            <CardHeader className="pb-3 flex-shrink-0">
              <CardTitle className="flex items-center gap-2 text-lg">
                <Activity className="h-5 w-5 text-purple-600" />
                Atividade Recente
              </CardTitle>
              <CardDescription className="text-sm">
                Suas últimas ações no sistema
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-0 flex-1 overflow-hidden">
              {loading ? (
                <div className="space-y-2">
                  {[1, 2, 3].map(i => (
                    <div key={i} className="animate-pulse bg-gray-200 h-12 rounded"></div>
                  ))}
                </div>
              ) : recentActivity.length > 0 ? (
                <div className="space-y-2 overflow-y-auto max-h-full">
                  {recentActivity.slice(0, 3).map((log) => (
                    <div key={log.id} className="p-3 bg-gradient-to-r from-blue-50 to-green-50 rounded-lg border border-blue-200 hover:shadow-md transition-shadow">
                      <div className="flex items-start space-x-2">
                        {getActionIcon(log.action)}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center space-x-2 mb-1">
                            <p className="text-sm font-semibold text-gray-900">
                              {getActionLabel(log.action)}
                            </p>
                            <Badge variant="outline" className="text-xs bg-white">
                              {log.operation_type}
                            </Badge>
                          </div>
                          
                          {log.aih_number && (
                            <p className="text-xs text-blue-700 font-mono mb-1">
                              📄 AIH: {log.aih_number}
                            </p>
                          )}
                          
                          {log.patient_name && (
                            <p className="text-xs text-green-700 mb-1">
                              👤 Paciente: {log.patient_name}
                            </p>
                          )}
                          
                          <p className="text-xs text-gray-600">
                            🕒 {formatTime(log.created_at)} • 👨‍💼 {log.user_name || log.user_email}
                          </p>
                          
                          {log.hospital_name && (
                            <p className="text-xs text-gray-500 mt-1">
                              🏥 {log.hospital_name}
                            </p>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-4 text-gray-500 flex-1 flex flex-col justify-center">
                  <Activity className="h-8 w-8 mx-auto mb-2 text-gray-300" />
                  <p className="text-sm">Nenhuma atividade recente encontrada</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Status do Sistema */}
          <Card className="h-[400px] flex flex-col">
            <CardHeader className="pb-3 flex-shrink-0">
              <CardTitle className="flex items-center gap-2 text-lg">
                <CheckCircle className="h-5 w-5 text-green-600" />
                Status do Sistema
              </CardTitle>
              <CardDescription className="text-sm">
                Verificações de integridade e conectividade
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-0 flex-1">
              <div className="space-y-2">
                <div className="flex items-center justify-between p-2 bg-green-50 rounded-lg">
                  <div className="flex items-center">
                    <CheckCircle className="h-4 w-4 text-green-600 mr-2" />
                    <div>
                      <p className="text-sm font-medium">Autenticação</p>
                      <p className="text-xs text-gray-500">Sistema de login ativo</p>
                    </div>
                  </div>
                  <Badge variant="default" className="bg-green-100 text-green-800 text-xs">
                    Ativo
                  </Badge>
                </div>

                <div className="flex items-center justify-between p-2 bg-blue-50 rounded-lg">
                  <div className="flex items-center">
                    <Building2 className="h-4 w-4 text-blue-600 mr-2" />
                    <div>
                      <p className="text-sm font-medium">Hospital Conectado</p>
                      <p className="text-xs text-gray-500">Dados do hospital disponíveis</p>
                    </div>
                  </div>
                  <Badge variant="default" className="bg-blue-100 text-blue-800 text-xs">
                    Conectado
                  </Badge>
                </div>

                <div className="flex items-center justify-between p-2 bg-purple-50 rounded-lg">
                  <div className="flex items-center">
                    <ShieldCheck className="h-4 w-4 text-purple-600 mr-2" />
                    <div>
                      <p className="text-sm font-medium">Auditoria</p>
                      <p className="text-xs text-gray-500">Rastreabilidade completa</p>
                    </div>
                  </div>
                  <Badge variant="default" className="bg-purple-100 text-purple-800 text-xs">
                    Ativo
                  </Badge>
                </div>

                <div className="flex items-center justify-between p-2 bg-indigo-50 rounded-lg">
                  <div className="flex items-center">
                    <Users className="h-4 w-4 text-indigo-600 mr-2" />
                    <div>
                      <p className="text-sm font-medium">Processamento IA</p>
                      <p className="text-xs text-gray-500">Extração automática</p>
                    </div>
                  </div>
                  <Badge variant="default" className="bg-indigo-100 text-indigo-800 text-xs">
                    Ativo
                  </Badge>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
};

export default Dashboard;

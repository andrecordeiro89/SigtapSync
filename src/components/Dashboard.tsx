import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from './ui/table';
import { Badge } from './ui/badge';
import { Button } from './ui/button';
import { AlertCircle, CheckCircle, Clock, Users, Building2, FileText, Activity, ShieldCheck, BookOpen, ArrowRight, Database, Search, Upload, Save, Eye, CalendarDays } from 'lucide-react';
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
  const [weekActivityCounts, setWeekActivityCounts] = useState<Array<{ dateLabel: string; count: number }>>([]);

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
        const isAdminMode = canAccessAllHospitals() || user.full_access || user.hospital_id === 'ALL';
        const hospitalId = isAdminMode ? 'ALL' : user.hospital_id;
        
        console.log(`🔐 Modo de acesso: ${isAdminMode ? 'ADMINISTRADOR (todos os hospitais)' : `USUÁRIO (hospital: ${hospitalId})`}`);

        // Carregar dados reais usando AIHPersistenceService
        const persistenceService = new AIHPersistenceService();
        
        // Carregar estatísticas reais do hospital
        const realStats = await persistenceService.getHospitalStats(hospitalId);
        
        // Calcular AIHs processadas hoje (usando limites do dia local)
        // Buscar contagem de AIHs criadas hoje considerando timezone padrão do sistema
        const nowLocal = new Date();
        const { dayWindowIso } = await import('../lib/utils');
        const { startIso: startOfTodayIso, endIso: startOfTomorrowIso } = dayWindowIso(nowLocal);

        let todayQuery = supabase
          .from('aihs')
          .select('id', { count: 'exact', head: true })
          .gte('created_at', startOfTodayIso)
          .lt('created_at', startOfTomorrowIso);
          
        // Se não é admin, filtrar por hospital
        if (!isAdminMode) {
          todayQuery = todayQuery.eq('hospital_id', hospitalId);
        }
        
        const { count: todayCount, error: todayError } = await todayQuery;
        
        if (todayError) {
          console.error('Erro ao buscar AIHs de hoje:', todayError);
        } else {
          console.log(`📊 AIHs processadas hoje (${nowLocal.toLocaleDateString('pt-BR')}):`, todayCount || 0);
        }

        // Buscar atividades recentes (AIHs criadas recentemente)
        const recentAIHs = await persistenceService.getAIHs(hospitalId, {
          limit: 10
        });

        // Buscar nome do médico relacionado às AIHs recentes
        // Preferência: requesting_physician da AIH; fallback: primeiro professional_name em procedure_records
        let doctorByAihId = new Map<string, string>();
        try {
          const aihIds = (recentAIHs || []).map((aih: any) => aih.id).filter(Boolean);
          if (aihIds.length > 0) {
            const { data: procRows, error: procErr } = await supabase
              .from('procedure_records')
              .select('aih_id, professional_name, procedure_date, created_at')
              .in('aih_id', aihIds)
              .order('procedure_date', { ascending: false })
              .order('created_at', { ascending: false });

            if (procErr) {
              console.warn('⚠️ Falha ao buscar profissionais em procedure_records:', procErr);
            } else if (procRows) {
              for (const row of procRows as any[]) {
                const aihId = row.aih_id;
                const name = row.professional_name;
                if (aihId && name && !doctorByAihId.has(aihId)) {
                  doctorByAihId.set(aihId, name);
                }
              }
            }
          }
        } catch (docErr) {
          console.warn('⚠️ Erro inesperado ao resolver nomes de médicos:', docErr);
        }

        // Processar dados para os cards
        setStats({
          totalAIHs: realStats.total_aihs,
          processedToday: todayCount || 0,
          hospitals_count: realStats.hospitals_count,
          is_admin_mode: realStats.is_admin_mode
        });

        // Processar atividade recente
        const processedActivity = recentAIHs.map((aih: any) => ({
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
          patient_name: aih.patients?.name || 'Paciente',
          doctor_name: aih.requesting_physician || doctorByAihId.get(aih.id) || undefined
        }));

        setRecentActivity(processedActivity);
        setRecentAuditLogs(processedActivity);

        // 🔎 Diagnóstico: contagem de hospitais únicos na coluna "Hospital" da Atividade Recente
        try {
          const uniqueHospitalNames = new Set(
            processedActivity.map((a: any) => a.hospital_name).filter(Boolean)
          );
          const uniqueHospitalIds = new Set(
            (recentAIHs || []).map((aih: any) => aih.hospital_id).filter(Boolean)
          );
          console.log(
            `🏥 Hospitais únicos na Atividade Recente — por nome: ${uniqueHospitalNames.size}, por ID: ${uniqueHospitalIds.size}`
          );
        } catch (diagErr) {
          console.warn('⚠️ Falha ao calcular hospitais únicos na Atividade Recente:', diagErr);
        }
        console.log(`✅ Dados ${isAdminMode ? 'de TODOS os hospitais' : 'do hospital específico'} carregados:`, realStats);

        // ✅ Contagem dos últimos 7 dias (discreto no header da Atividade Recente)
        try {
          // Montar janelas por dia (local) para os ÚLTIMOS 7 DIAS EXCLUINDO HOJE
          // i = 7..1 dias atrás (não inclui hoje)
          const dayWindows: Array<{ label: string; start: string; end: string }> = [];
          for (let i = 7; i >= 1; i--) {
            const start = new Date(
              nowLocal.getFullYear(),
              nowLocal.getMonth(),
              nowLocal.getDate() - i,
              0, 0, 0, 0
            );
            const end = new Date(
              nowLocal.getFullYear(),
              nowLocal.getMonth(),
              nowLocal.getDate() - i + 1,
              0, 0, 0, 0
            );
            dayWindows.push({
              label: start.toLocaleDateString('pt-BR'),
              start: start.toISOString(),
              end: end.toISOString()
            });
          }

          const counts = await Promise.all(
            dayWindows.map(async (w) => {
              let q = supabase
                .from('aihs')
                .select('id', { count: 'exact', head: true })
                .gte('created_at', w.start)
                .lt('created_at', w.end);
              if (!isAdminMode) {
                q = q.eq('hospital_id', hospitalId);
              }
              const { count, error } = await q;
              if (error) {
                console.warn(`⚠️ Erro ao contar AIHs em ${w.label}:`, error);
                return { label: w.label, count: 0 };
              }
              return { label: w.label, count: count || 0 };
            })
          );

          setWeekActivityCounts(counts.map(c => ({ dateLabel: c.label, count: c.count })));
        } catch (wErr) {
          console.warn('⚠️ Falha ao calcular contagem semanal:', wErr);
          setWeekActivityCounts([]);
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
      'AIH_CREATED': 'AIH cadastrada',
      'AIH_QUERY': 'Consulta de AIHs',
      'USER_CREATED': 'Usuário criado',
      'HOSPITAL_ACCESS_UPDATED': 'Acesso atualizado'
    };
    return labels[action] || action;
  };

  // Variant visual para o ticker (telejornal): cores por volume
  const getChipVariant = (count: number) => {
    if (count >= 500) return 'chip-high';
    if (count >= 200) return 'chip-mid';
    return 'chip-low';
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
                  {/* Indicador de hospitais removido a pedido: manter apenas o total de AIHs */}
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
        <div className="grid grid-cols-1 gap-4">
          <SystemExplanationCard />
                    </div>
      )}

      {/* ✅ Atividade Recente - Layout Completo - Apenas para Diretoria */}
      {isManagementRole() && (
        <Card className="bg-gradient-to-r from-slate-50 via-white to-slate-50/50 border-slate-200/60 shadow-md hover:shadow-lg transition-all duration-300">
          <CardHeader className="bg-gradient-to-r from-purple-50 to-blue-50 border-b border-purple-100">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <div className="p-2 bg-gradient-to-br from-purple-100 to-purple-200 rounded-lg shadow-sm">
                  <Activity className="h-6 w-6 text-purple-700" />
                </div>
                    <div>
                  <CardTitle className="text-xl font-bold text-gray-900">Atividade Recente</CardTitle>
                  <CardDescription className="text-sm text-gray-600">
                    Últimas operações realizadas no sistema
                  </CardDescription>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {weekActivityCounts.length > 0 && (
                  <div className="hidden md:block ml-1">
                    <style>{`
                      @keyframes tickerMove { 0% { transform: translateX(0); } 100% { transform: translateX(-50%); } }
                      .ticker-container:hover .ticker-track { animation-play-state: paused; }
                      .glass-chip { 
                        background: linear-gradient(180deg, rgba(255,255,255,0.85) 0%, rgba(255,255,255,0.65) 100%);
                        border: 1px solid rgba(148,163,184,0.35); /* slate-300/35 */
                        box-shadow: 0 2px 6px rgba(15,23,42,0.08), inset 0 1px 0 rgba(255,255,255,0.6);
                        backdrop-filter: blur(6px);
                      }
                      .chip-sep { height: 14px; width: 1px; background: rgba(148,163,184,0.35); margin: 0 6px; }
                      .chip-title { 
                        background: linear-gradient(180deg, rgba(30,64,175,0.12) 0%, rgba(37,99,235,0.10) 100%);
                        color: rgb(30,58,138);
                        border: 1px solid rgba(30,64,175,0.25);
                      }
                      .chip-low { 
                        background: linear-gradient(180deg, rgba(16,185,129,0.12) 0%, rgba(16,185,129,0.08) 100%);
                        border: 1px solid rgba(16,185,129,0.25);
                        color: rgb(22,101,52);
                      }
                      .chip-mid { 
                        background: linear-gradient(180deg, rgba(234,179,8,0.14) 0%, rgba(234,179,8,0.10) 100%);
                        border: 1px solid rgba(234,179,8,0.28);
                        color: rgb(133,77,14);
                      }
                      .chip-high { 
                        background: linear-gradient(180deg, rgba(239,68,68,0.14) 0%, rgba(239,68,68,0.10) 100%);
                        border: 1px solid rgba(239,68,68,0.28);
                        color: rgb(127,29,29);
                      }
                    `}</style>
                    <div className="relative w-[640px] max-w-[60vw] overflow-hidden ticker-container">
                      <div className="absolute inset-y-0 left-0 w-16 bg-gradient-to-r from-slate-50 via-slate-50/60 to-transparent pointer-events-none" />
                      <div className="absolute inset-y-0 right-0 w-16 bg-gradient-to-l from-slate-50 via-slate-50/60 to-transparent pointer-events-none" />
                      <div className="ticker-track inline-flex items-center gap-2 whitespace-nowrap will-change-transform" style={{ animation: 'tickerMove 22s linear infinite' }}>
                        {/* Chip título */}
                        <span className="glass-chip chip-title inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-[11px] font-semibold">
                          Últimos 7 dias
                        </span>
                        <span className="chip-sep" />
                        {weekActivityCounts.map((d, idx) => (
                          <div key={`a-${d.dateLabel}`} className="inline-flex items-center">
                            <span className={`glass-chip ${getChipVariant(d.count)} inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px]`}>
                              <CalendarDays className="h-3.5 w-3.5 text-blue-600" />
                              <span className="font-semibold text-slate-900">{d.dateLabel}</span>
                              <span className="opacity-60">-</span>
                              <span className="font-medium">{d.count} AIHs</span>
                            </span>
                            {idx !== weekActivityCounts.length - 1 && <span className="chip-sep" />}
                          </div>
                        ))}
                        {/* Segunda sequência para loop infinito */}
                        <span className="glass-chip chip-title inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-[11px] font-semibold">
                          Últimos 7 dias
                        </span>
                        <span className="chip-sep" />
                        {weekActivityCounts.map((d, idx) => (
                          <div key={`b-${d.dateLabel}`} className="inline-flex items-center">
                            <span className={`glass-chip ${getChipVariant(d.count)} inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px]`}>
                              <CalendarDays className="h-3.5 w-3.5 text-blue-600" />
                              <span className="font-semibold text-slate-900">{d.dateLabel}</span>
                              <span className="opacity-60">-</span>
                              <span className="font-medium">{d.count} AIHs</span>
                            </span>
                            {idx !== weekActivityCounts.length - 1 && <span className="chip-sep" />}
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
              </div>
        </div>
            </CardHeader>
          <CardContent className="p-0">
              {loading ? (
              <div className="p-6">
                <div className="space-y-3">
                  {[1, 2, 3, 4, 5].map(i => (
                    <div key={i} className="animate-pulse bg-gray-200 h-16 rounded-lg"></div>
                  ))}
                </div>
                </div>
              ) : recentActivity.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gradient-to-r from-gray-50 to-gray-100 border-b border-gray-200">
                    <tr>
                      <th className="text-left py-3 px-6 text-sm font-semibold text-gray-700">Ação</th>
                      <th className="text-left py-3 px-6 text-sm font-semibold text-gray-700">AIH / Paciente</th>
                      <th className="text-left py-3 px-6 text-sm font-semibold text-gray-700">Hospital</th>
                      <th className="text-left py-3 px-6 text-sm font-semibold text-gray-700">Operador</th>
                      <th className="text-left py-3 px-6 text-sm font-semibold text-gray-700">Data/Hora</th>
                      <th className="text-center py-3 px-6 text-sm font-semibold text-gray-700">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {recentActivity.slice(0, 8).map((log, index) => (
                      <tr key={log.id} className="hover:bg-gradient-to-r hover:from-blue-50/30 hover:to-purple-50/30 transition-colors">
                        <td className="py-4 px-6">
                          <div className="flex items-center space-x-3">
                            <div className="p-2 bg-gradient-to-br from-blue-100 to-blue-200 rounded-lg shadow-sm">
                        {getActionIcon(log.action)}
                            </div>
                            <div>
                              <p className="text-sm font-medium text-gray-900">
                              {getActionLabel(log.action)}
                            </p>
                              <p className="text-xs text-gray-500">
                              {log.operation_type}
                              </p>
                            </div>
                          </div>
                        </td>
                        <td className="py-4 px-6">
                          <div className="space-y-1">
                          {log.aih_number && (
                              <p className="text-sm font-mono text-blue-700 bg-blue-50 px-2 py-1 rounded w-fit">
                                {log.aih_number}
                            </p>
                          )}
                          {log.patient_name && (
                              <div className="flex items-center gap-2 text-xs text-gray-700">
                                <Badge 
                                  variant="secondary" 
                                  className="px-2 py-0.5 h-5 text-[10px] bg-blue-100 text-blue-700 border border-blue-200"
                                >
                                  Paciente
                                </Badge>
                                <span>{log.patient_name}</span>
                            </div>
                          )}
                          {log.doctor_name && (
                              <div className="flex items-center gap-2 text-xs text-gray-700">
                                <Badge 
                                  variant="secondary" 
                                  className="px-2 py-0.5 h-5 text-[10px] bg-green-100 text-green-700 border border-green-200"
                                >
                                  Médico
                                </Badge>
                                <span>{log.doctor_name}</span>
                            </div>
                          )}
                          </div>
                        </td>
                        <td className="py-4 px-6">
                          <p className="text-sm text-gray-700">
                            {log.hospital_name || 'N/A'}
                          </p>
                        </td>
                        <td className="py-4 px-6">
                          <div>
                            <p className="text-sm text-gray-700 font-medium">
                              {log.user_name || 'Sistema'}
                            </p>
                            {log.user_email && (
                              <p className="text-xs text-gray-500">
                                {log.user_email}
                            </p>
                          )}
                        </div>
                        </td>
                        <td className="py-4 px-6">
                          <p className="text-sm text-gray-700">
                            {formatTime(log.created_at)}
                          </p>
                        </td>
                        <td className="py-4 px-6 text-center">
                          <Badge 
                            variant={log.action.includes('ERROR') ? 'destructive' : 'default'}
                            className={`
                              text-xs px-2 py-1 
                              ${log.action.includes('SUCCESS') ? 'bg-green-100 text-green-800' : ''}
                              ${log.action.includes('ERROR') ? 'bg-red-100 text-red-800' : ''}
                              ${!log.action.includes('SUCCESS') && !log.action.includes('ERROR') ? 'bg-blue-100 text-blue-800' : ''}
                            `}
                          >
                            {log.action.includes('SUCCESS') ? 'Sucesso' : 
                             log.action.includes('ERROR') ? 'Erro' : 'Processado'}
                          </Badge>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                </div>
              ) : (
              <div className="text-center py-12 text-gray-500">
                <div className="p-4 bg-gray-100 rounded-full w-fit mx-auto mb-4">
                  <Activity className="h-8 w-8 text-gray-400" />
                </div>
                <h3 className="text-lg font-medium text-gray-900 mb-2">Nenhuma atividade recente</h3>
                <p className="text-sm text-gray-500">As ações realizadas no sistema aparecerão aqui</p>
              </div>
            )}
            </CardContent>
          </Card>
      )}
    </div>
  );
};

export default Dashboard;

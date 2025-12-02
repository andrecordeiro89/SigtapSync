import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from './ui/table';
import { Badge } from './ui/badge';
import { Button } from './ui/button';
import { AlertCircle, CheckCircle, Clock, Users, Building2, FileText, Activity, ShieldCheck, BookOpen, ArrowRight, Database, Search, Upload, Save, Eye, CalendarDays, Stethoscope, DollarSign } from 'lucide-react';
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
  return (
    <div className="min-h-svh relative overflow-hidden bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-100">
      <div className="absolute -top-32 -left-24 h-[420px] w-[420px] rounded-full bg-blue-200/40 blur-3xl" />
      <div className="absolute -bottom-40 -right-24 h-[520px] w-[520px] rounded-full bg-indigo-200/40 blur-3xl" />
      <main className="relative z-10 px-6 md:px-12 py-10 md:py-16">
        <section className="max-w-7xl mx-auto">
          <div className="flex items-center gap-4 mb-6">
            <div className="flex items-center justify-center w-16 h-16 md:w-20 md:h-20 bg-gradient-to-br from-blue-600 to-indigo-700 rounded-2xl shadow-lg">
              <Building2 className="h-8 w-8 md:h-10 md:w-10 text-white" />
            </div>
            <div>
              <h1 className="text-3xl md:text-5xl font-black tracking-tight text-slate-900">SIGTAP Sync</h1>
              <p className="text-lg md:text-2xl font-semibold text-blue-700">Repasses Médicos</p>
            </div>
          </div>
          <p className="text-base md:text-lg text-slate-700 max-w-3xl">Visão 360º dos profissionais hospitalares: do código SIGTAP ao repasse médico, com validações, hierarquia médico → paciente → procedimento e indicadores executivos.</p>
        </section>
        <section className="max-w-7xl mx-auto mt-12 grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="p-6 md:p-8 rounded-2xl bg-white/70 backdrop-blur border border-slate-200 shadow-sm">
            <div className="flex items-center gap-3 mb-3">
              <Search className="h-6 w-6 text-blue-600" />
              <h3 className="text-xl md:text-2xl font-bold text-slate-900">Tabela SIGTAP</h3>
            </div>
            <p className="text-slate-700">Códigos normalizados e versões ativadas fundamentam os procedimentos e garantem consistência técnica em todo o fluxo.</p>
          </div>
          <div className="p-6 md:p-8 rounded-2xl bg-white/70 backdrop-blur border border-slate-200 shadow-sm">
            <div className="flex items-center gap-3 mb-3">
              <Database className="h-6 w-6 text-indigo-600" />
              <h3 className="text-xl md:text-2xl font-bold text-slate-900">Matches AIH ↔ SIGTAP</h3>
            </div>
            <p className="text-slate-700">Validações de sexo, idade, CID, CBO e habilitação calculam valores de referência e consolidam o vínculo entre internação e procedimento.</p>
          </div>
          <div className="p-6 md:p-8 rounded-2xl bg-white/70 backdrop-blur border border-slate-200 shadow-sm">
            <div className="flex items-center gap-3 mb-3">
              <Stethoscope className="h-6 w-6 text-purple-600" />
              <h3 className="text-xl md:text-2xl font-bold text-slate-900">Hierarquia Completa</h3>
            </div>
            <p className="text-slate-700">Médico → Paciente → Procedimento, com competência, caráter de atendimento e valores por ato: a base dos repasses médicos.</p>
          </div>
          <div className="p-6 md:p-8 rounded-2xl bg-white/70 backdrop-blur border border-slate-200 shadow-sm">
            <div className="flex items-center gap-3 mb-3">
              <DollarSign className="h-6 w-6 text-emerald-600" />
              <h3 className="text-xl md:text-2xl font-bold text-slate-900">Repasses e Analytics</h3>
            </div>
            <p className="text-slate-700">Valores SIGTAP, incrementos (Opera Paraná) e pagamentos médicos compondo indicadores executivos e operacionais de alta fidelidade.</p>
          </div>
        </section>
        <section className="max-w-7xl mx-auto mt-10">
          <div className="p-6 md:p-8 rounded-2xl bg-white/60 backdrop-blur border border-slate-200 shadow-sm">
            <div className="flex items-center gap-3 mb-2">
              <BookOpen className="h-6 w-6 text-slate-700" />
              <h3 className="text-lg md:text-xl font-bold text-slate-900">Fonte SIH Remota</h3>
            </div>
            <p className="text-slate-700">Em ambientes DATASUS, preservamos códigos, valores e metadados; o nome do paciente pode ser ocultado sem comprometer a análise financeira e produtiva.</p>
          </div>
        </section>
      </main>
    </div>
  );
  return (
    <div className="min-h-svh p-8 md:p-12 bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 flex items-center justify-center">
      <Card className="w-full max-w-5xl shadow-lg border border-slate-200/80 bg-white/90 backdrop-blur-sm">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex items-center justify-center w-12 h-12 bg-gradient-to-br from-blue-600 to-indigo-600 rounded-xl shadow-md">
                <BookOpen className="h-6 w-6 text-white" />
              </div>
              <div>
                <CardTitle className="text-2xl font-black text-gray-900">Inicial</CardTitle>
                <CardDescription className="text-sm">Sistema de Repasses Médicos • Visão 360º dos profissionais hospitalares</CardDescription>
              </div>
            </div>
            <Badge className="bg-blue-100 text-blue-700 border-blue-200">SIGTAP Sync</Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-6 text-sm text-gray-700">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="p-4 rounded-xl border border-slate-200 bg-gradient-to-br from-blue-50 to-white">
              <div className="flex items-center gap-3 mb-2">
                <Search className="h-5 w-5 text-blue-600" />
                <div className="font-semibold text-gray-900">Tabela SIGTAP</div>
              </div>
              <p>Códigos normalizados e versões ativadas fundamentam os procedimentos. A base oficial é o ponto de partida para toda a jornada.</p>
            </div>
            <div className="p-4 rounded-xl border border-slate-200 bg-gradient-to-br from-indigo-50 to-white">
              <div className="flex items-center gap-3 mb-2">
                <Database className="h-5 w-5 text-indigo-600" />
                <div className="font-semibold text-gray-900">Matches AIH ↔ SIGTAP</div>
              </div>
              <p>Validações de sexo, idade, CID, CBO e habilitação calculam valores de referência e consolidam o vínculo entre a AIH e o procedimento.</p>
            </div>
            <div className="p-4 rounded-xl border border-slate-200 bg-gradient-to-br from-purple-50 to-white">
              <div className="flex items-center gap-3 mb-2">
                <Stethoscope className="h-5 w-5 text-purple-600" />
                <div className="font-semibold text-gray-900">Hierarquia Médico → Paciente → Procedimento</div>
              </div>
              <p>Organização completa por competência, caráter de atendimento e valores de cada ato, formando a base dos repasses médicos.</p>
            </div>
            <div className="p-4 rounded-xl border border-slate-200 bg-gradient-to-br from-emerald-50 to-white">
              <div className="flex items-center gap-3 mb-2">
                <DollarSign className="h-5 w-5 text-emerald-600" />
                <div className="font-semibold text-gray-900">Repasses e Analytics</div>
              </div>
              <p>Valores SIGTAP, incrementos específicos (como Opera Paraná) e pagamentos médicos compõem indicadores executivos e operacionais.</p>
            </div>
          </div>
          <div className="p-4 rounded-xl border border-slate-200 bg-gradient-to-br from-slate-50 to-white">
            <div className="flex items-center gap-3 mb-2">
              <Activity className="h-5 w-5 text-slate-700" />
              <div className="font-semibold text-gray-900">Fonte SIH Remota</div>
            </div>
            <p>Para ambientes com DATASUS, mantemos códigos, valores e metadados. O nome do paciente pode ser ocultado, preservando a análise financeira e produtiva.</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
  const { user, getCurrentHospital, canAccessAllHospitals } = useAuth();
  const { getUserAuditLogs, getHospitalAIHs } = useSupabaseAIH();
  
  const [hospitalInfo, setHospitalInfo] = useState<HospitalInfo | null>(null);
  const [stats, setStats] = useState<DashboardStats>({
    totalAIHs: 0,
    processedToday: 0
  });
  const [recentActivity, setRecentActivity] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [weekActivityCounts, setWeekActivityCounts] = useState<Array<{ dateLabel: string; count: number }>>([]);

  // ✅ Função para verificar se é usuário de diretoria
  const isManagementRole = (): boolean => {
    if (!user) return false;
    return ['admin', 'ti', 'coordinator', 'director', 'auditor', 'developer'].includes(user.role);
  };

  // ✅ Função para formatar número com separador de milhares
  const formatNumber = (num: number): string => {
    return num.toLocaleString('pt-BR');
  };

  // ✅ CORREÇÃO: Armazenar hospital_id como valor, não função
  const currentHospitalId = getCurrentHospital();

  // Carregar informações do hospital atual
  useEffect(() => {
    const loadHospitalInfo = async () => {
      // Não carregar se não há hospital ou se é 'ALL' (acesso total)
      if (!currentHospitalId || currentHospitalId === 'ALL') return;
    
      try {
        const { data, error } = await supabase
          .from('hospitals')
          .select('id, name, cnpj, city, state, is_active')
          .eq('id', currentHospitalId)
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
  }, [currentHospitalId]); // ✅ CORREÇÃO: Usar valor do hospital_id, não função

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
        
        // ✅ DEBUG: Log das estatísticas recebidas
        console.log('📊 [Dashboard] Estatísticas recebidas do getHospitalStats:', realStats);
        console.log(`📊 [Dashboard] TOTAL DE AIHs recebido: ${realStats.total_aihs}`);
        
        // ✅ Calcular AIHs processadas hoje (corrigido para timezone)
        // O banco armazena em TIMESTAMP WITH TIME ZONE (UTC)
        // Precisamos calcular o início e fim do dia considerando o timezone local do usuário
        const now = new Date();
        const timezoneOffset = now.getTimezoneOffset(); // offset em minutos (ex: -180 para UTC-3)
        
        // Criar data de início do dia no timezone local
        const startOfTodayLocal = new Date(
          now.getFullYear(),
          now.getMonth(),
          now.getDate(),
          0, 0, 0, 0
        );
        
        // Criar data de fim do dia (início do próximo dia) no timezone local
        const startOfTomorrowLocal = new Date(
          now.getFullYear(),
          now.getMonth(),
          now.getDate() + 1,
          0, 0, 0, 0
        );
        
        // Converter para UTC para comparar com o banco (que armazena em UTC)
        // O toISOString() já converte para UTC automaticamente
        const startOfTodayUTC = startOfTodayLocal.toISOString();
        const startOfTomorrowUTC = startOfTomorrowLocal.toISOString();
        
        console.log(`📅 [Dashboard] Calculando AIHs processadas hoje:`, {
          dataHoje: now.toLocaleDateString('pt-BR'),
          timezoneOffset: `${timezoneOffset} minutos (UTC${timezoneOffset > 0 ? '-' : '+'}${Math.abs(timezoneOffset / 60)})`,
          inicioDiaLocal: startOfTodayLocal.toLocaleString('pt-BR'),
          fimDiaLocal: startOfTomorrowLocal.toLocaleString('pt-BR'),
          inicioDiaUTC: startOfTodayUTC,
          fimDiaUTC: startOfTomorrowUTC,
          modoAdmin: isAdminMode,
          hospitalId: hospitalId
        });
        
        // ✅ Buscar contagem de AIHs criadas hoje no sistema (usa count exato para evitar limite de linhas)
        // IMPORTANTE: Em modo admin, não aplicar filtro de hospital para contar TODAS as AIHs de hoje
        // Usar comparação por data completa (com hora) em UTC para garantir precisão
        let todayQuery = supabase
          .from('aihs')
          .select('id', { count: 'exact', head: true })
          .gte('created_at', startOfTodayUTC)
          .lt('created_at', startOfTomorrowUTC);
          
        // Se não é admin, filtrar por hospital
        if (!isAdminMode) {
          todayQuery = todayQuery.eq('hospital_id', hospitalId);
          console.log(`🔍 [Dashboard] Modo USUÁRIO: Filtrando por hospital ${hospitalId}`);
        } else {
          console.log(`🔍 [Dashboard] Modo ADMIN: Contando TODAS as AIHs de todos os hospitais`);
        }
        
        const { count: todayCount, error: todayError } = await todayQuery;
        
        if (todayError) {
          console.error('❌ [Dashboard] Erro ao buscar AIHs de hoje:', todayError);
        } else {
          console.log(`✅ [Dashboard] AIHs processadas hoje (${now.toLocaleDateString('pt-BR')}):`, todayCount || 0);
          console.log(`📊 [Dashboard] Detalhes da query:`, {
            count: todayCount,
            countType: typeof todayCount,
            isNull: todayCount === null,
            isUndefined: todayCount === undefined,
            finalValue: todayCount || 0,
            queryRange: {
              from: startOfTodayUTC,
              to: startOfTomorrowUTC
            }
          });
          
          // ✅ DIAGNÓSTICO: Buscar algumas AIHs de hoje para verificar formato das datas
          if (todayCount !== null && todayCount !== undefined) {
            const sampleQuery = supabase
              .from('aihs')
              .select('id, created_at, aih_number')
              .gte('created_at', startOfTodayUTC)
              .lt('created_at', startOfTomorrowUTC)
              .limit(5);
            
            if (!isAdminMode) {
              sampleQuery.eq('hospital_id', hospitalId);
            }
            
            const { data: sampleData, error: sampleError } = await sampleQuery;
            if (!sampleError && sampleData && sampleData.length > 0) {
              console.log(`🔍 [Dashboard] Amostra de AIHs de hoje (formato das datas):`, 
                sampleData.map(a => ({
                  aih_number: a.aih_number,
                  created_at: a.created_at,
                  created_at_type: typeof a.created_at,
                  created_at_parsed: new Date(a.created_at).toLocaleString('pt-BR')
                }))
              );
            }
          }
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
        const finalTotalAIHs = realStats.total_aihs ?? 0; // ✅ Garantir que nunca seja null/undefined
        const finalProcessedToday = todayCount ?? 0; // ✅ Garantir que nunca seja null/undefined
        
        console.log(`📊 [Dashboard] Definindo stats:`, {
          totalAIHs: finalTotalAIHs,
          processedToday: finalProcessedToday,
          processedTodayRaw: todayCount,
          hospitals_count: realStats.hospitals_count,
          is_admin_mode: realStats.is_admin_mode
        });
        
        setStats({
          totalAIHs: finalTotalAIHs, // ✅ Usar valor garantido
          processedToday: finalProcessedToday, // ✅ Usar valor garantido
          hospitals_count: realStats.hospitals_count,
          is_admin_mode: realStats.is_admin_mode
        });

        // Processar atividade recente
        const processedActivity = recentAIHs.map((aih: any) => ({
          id: aih.id,
          action: 'AIH_CREATED',
          aih_number: aih.aih_number,
          user_name: aih.processed_by_name || 'Sistema',
          user_email: aih.processed_by_email || user.email || 'sistema@sistema.com', // ✅ CORREÇÃO: Email real do operador
          hospital_name: isAdminMode 
            ? (aih.hospitals?.name || 'Hospital N/A')
            : (hospitalInfo?.name || 'Hospital'),
          created_at: aih.created_at,
          operation_type: 'CREATE',
          patient_name: aih.patients?.name || 'Paciente',
          doctor_name: aih.requesting_physician || doctorByAihId.get(aih.id) || null,
          competencia: aih.competencia, // ✅ Campo de competência
          admission_date: aih.admission_date, // ✅ Data de admissão
          discharge_date: aih.discharge_date, // ✅ Data de alta
        }));

        setRecentActivity(processedActivity);

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
          // ✅ CORREÇÃO: Declarar nowLocal para calcular janelas de tempo
          const nowLocal = new Date();
          
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
    // ✅ Ícones sem cor definida - a cor será controlada pelo componente pai
    if (action.includes('LOGIN')) return <ShieldCheck className="h-4 w-4" />;
    if (action.includes('AIH')) return <FileText className="h-4 w-4" />;
    if (action.includes('ERROR')) return <AlertCircle className="h-4 w-4" />;
    return <Activity className="h-4 w-4" />;
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

  // ✅ Função para formatar competência (YYYY-MM-DD -> MM/YYYY)
  const formatCompetencia = (competencia: string | undefined): string => {
    if (!competencia) return '—';
    
    try {
      // Formato esperado: YYYY-MM-DD (ex: 2024-03-01)
      if (/^\d{4}-\d{2}-\d{2}$/.test(competencia)) {
        const [year, month] = competencia.split('-');
        return `${month}/${year}`;
      }
      
      // Formato alternativo: YYYY-MM (ex: 2024-03)
      if (/^\d{4}-\d{2}$/.test(competencia)) {
        const [year, month] = competencia.split('-');
        return `${month}/${year}`;
      }
      
      // Fallback: tentar parsear como data ISO
      const date = new Date(competencia);
      if (!isNaN(date.getTime())) {
        return date.toLocaleDateString('pt-BR', { month: '2-digit', year: 'numeric' });
      }
      
      return competencia; // Retorna valor original se não conseguir formatar
    } catch {
      return competencia || '—';
    }
  };

  // ✅ Função para formatar datas de admissão e alta (YYYY-MM-DD -> DD/MM/YYYY)
  const formatDate = (dateString: string | undefined): string => {
    if (!dateString) return '—';
    
    try {
      // Formato esperado: YYYY-MM-DD ou YYYY-MM-DDTHH:mm:ss
      const date = new Date(dateString);
      if (!isNaN(date.getTime())) {
        return date.toLocaleDateString('pt-BR', {
          day: '2-digit',
          month: '2-digit',
          year: 'numeric'
        });
      }
      
      return dateString; // Retorna valor original se não conseguir formatar
    } catch {
      return dateString || '—';
    }
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
      <Card className="border-l-4 border-l-blue-600">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-lg">
            <BookOpen className="h-5 w-5 text-blue-600" />
            Inicial
          </CardTitle>
          <CardDescription className="text-sm">Visão 360º — Repasses Médicos</CardDescription>
        </CardHeader>
        <CardContent className="pt-0 text-sm text-gray-700 space-y-2">
          <p>
            O sistema parte da tabela SIGTAP (versões importadas e ativadas), usando os códigos
            normalizados para identificar cada procedimento.
          </p>
          <p>
            As AIHs são reconciliadas com a SIGTAP por meio de validações (sexo, idade, CID, CBO e
            habilitação), calculando automaticamente os valores de referência e gerando o
            <strong className="font-semibold"> match</strong> entre AIH ↔ Procedimento.
          </p>
          <p>
            A visualização hierárquica organiza dados em <strong className="font-semibold">Médico → Paciente → Procedimento</strong>,
            incluindo competência, caráter de atendimento e valores por ato, formando a base dos
            repasses médicos.
          </p>
          <p>
            Para <strong className="font-semibold">Repasses e Analytics</strong>, consolidamos valores base SIGTAP, incrementos
            específicos (como Opera Paraná), pagamentos médicos e indicadores operacionais,
            compondo uma visão executiva e operacional completa.
          </p>
          <p>
            Com a fonte remota do SIH (DATASUS), preservamos códigos, valores e metadados — o nome
            do paciente pode ser ocultado, mantendo a análise financeira e produtiva intacta.
          </p>
          <p>
            Toda a jornada é auditada e segura, garantindo rastreabilidade e confiabilidade para
            decisões de gestão hospitalar.
          </p>
        </CardContent>
      </Card>
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
          <Card className="hover:shadow-md transition-shadow border-l-4 border-l-blue-500">
            <CardContent className="p-3 flex items-center">
              <div className="flex items-center space-x-3 w-full">
                <div className="p-2 bg-blue-100 rounded-lg flex-shrink-0">
                  <FileText className="h-5 w-5 text-blue-600" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium text-gray-600 uppercase tracking-wide">Total de AIHs</p>
                  <p className="text-xl font-bold text-gray-900">{loading ? '...' : formatNumber(stats.totalAIHs)}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="hover:shadow-md transition-shadow border-l-4 border-l-green-500">
            <CardContent className="p-3 flex items-center">
              <div className="flex items-center space-x-3 w-full">
                <div className="p-2 bg-green-100 rounded-lg flex-shrink-0">
                  <Clock className="h-5 w-5 text-green-600" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium text-gray-600 uppercase tracking-wide">Processadas Hoje</p>
                  <p className="text-xl font-bold text-gray-900">{loading ? '...' : formatNumber(stats.processedToday)}</p>
                  <p className="text-xs text-green-600 mt-0.5">
                    {stats.is_admin_mode 
                      ? `Todos os hospitais` 
                      : (stats.processedToday > 0 ? `${formatNumber(stats.processedToday)} nova${stats.processedToday !== 1 ? 's' : ''} hoje` : 'Nenhuma hoje')
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
        <Card className="border-gray-200 shadow-md hover:shadow-lg transition-all duration-300 overflow-hidden">
          <CardHeader className="bg-gradient-to-r from-blue-50 via-indigo-50 to-purple-50 border-b border-gray-200/60 py-4">
            <div className="flex items-center justify-between gap-4">
              {/* Lado Esquerdo: Título e Descrição */}
              <div className="flex items-center gap-3">
                <div className="relative">
                  <div className="absolute inset-0 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-lg opacity-10 blur-sm"></div>
                  <div className="relative p-2.5 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-lg shadow-sm">
                    <Activity className="h-5 w-5 text-white" />
                  </div>
                </div>
                <div>
                  <CardTitle className="text-lg font-bold text-gray-900 flex items-center gap-2">
                    Atividade Recente
                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-700 border border-blue-200">
                      Últimas 8
                    </span>
                  </CardTitle>
                  <CardDescription className="text-xs text-gray-600 mt-0.5">
                    Operações realizadas no sistema
                  </CardDescription>
                </div>
              </div>

              {/* Lado Direito: Ticker Animado */}
              {weekActivityCounts.length > 0 && (
                <div className="hidden md:block">
                  <style>{`
                    @keyframes tickerMove { 0% { transform: translateX(0); } 100% { transform: translateX(-50%); } }
                    .ticker-container:hover .ticker-track { animation-play-state: paused; }
                    .modern-chip { 
                      background: linear-gradient(135deg, rgba(255,255,255,0.9) 0%, rgba(255,255,255,0.75) 100%);
                      border: 1px solid rgba(148,163,184,0.3);
                      box-shadow: 0 1px 3px rgba(0,0,0,0.08), inset 0 1px 0 rgba(255,255,255,0.8);
                      backdrop-filter: blur(8px);
                    }
                    .chip-divider { height: 12px; width: 1px; background: rgba(148,163,184,0.3); margin: 0 8px; }
                    .chip-header { 
                      background: linear-gradient(135deg, rgba(59,130,246,0.15) 0%, rgba(99,102,241,0.12) 100%);
                      border: 1px solid rgba(59,130,246,0.3);
                      color: rgb(30,58,138);
                    }
                    .chip-low { 
                      background: linear-gradient(135deg, rgba(16,185,129,0.12) 0%, rgba(5,150,105,0.10) 100%);
                      border: 1px solid rgba(16,185,129,0.3);
                      color: rgb(6,78,59);
                    }
                    .chip-mid { 
                      background: linear-gradient(135deg, rgba(245,158,11,0.12) 0%, rgba(217,119,6,0.10) 100%);
                      border: 1px solid rgba(245,158,11,0.3);
                      color: rgb(120,53,15);
                    }
                    .chip-high { 
                      background: linear-gradient(135deg, rgba(239,68,68,0.12) 0%, rgba(220,38,38,0.10) 100%);
                      border: 1px solid rgba(239,68,68,0.3);
                      color: rgb(127,29,29);
                    }
                  `}</style>
                  <div className="relative w-[580px] max-w-[55vw] overflow-hidden rounded-lg ticker-container bg-white/40 backdrop-blur-sm border border-white/60 shadow-sm py-2">
                    <div className="absolute inset-y-0 left-0 w-12 bg-gradient-to-r from-blue-50/90 via-blue-50/60 to-transparent pointer-events-none z-10" />
                    <div className="absolute inset-y-0 right-0 w-12 bg-gradient-to-l from-purple-50/90 via-purple-50/60 to-transparent pointer-events-none z-10" />
                    <div className="ticker-track inline-flex items-center gap-2 whitespace-nowrap will-change-transform px-4" style={{ animation: 'tickerMove 24s linear infinite' }}>
                      {/* Primeira sequência */}
                      <span className="modern-chip chip-header inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[10px] font-bold uppercase tracking-wide">
                        📊 Últimos 7 dias
                      </span>
                      <span className="chip-divider" />
                      {weekActivityCounts.map((d, idx) => (
                        <div key={`a-${d.dateLabel}`} className="inline-flex items-center">
                          <span className={`modern-chip ${getChipVariant(d.count)} inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[10px]`}>
                            <CalendarDays className="h-3 w-3 text-blue-600" />
                            <span className="font-bold text-gray-900">{d.dateLabel}</span>
                            <span className="opacity-40">•</span>
                            <span className="font-semibold">{d.count}</span>
                          </span>
                          {idx !== weekActivityCounts.length - 1 && <span className="chip-divider" />}
                        </div>
                      ))}
                      {/* Segunda sequência para loop infinito */}
                      <span className="modern-chip chip-header inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[10px] font-bold uppercase tracking-wide">
                        📊 Últimos 7 dias
                      </span>
                      <span className="chip-divider" />
                      {weekActivityCounts.map((d, idx) => (
                        <div key={`b-${d.dateLabel}`} className="inline-flex items-center">
                          <span className={`modern-chip ${getChipVariant(d.count)} inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[10px]`}>
                            <CalendarDays className="h-3 w-3 text-blue-600" />
                            <span className="font-bold text-gray-900">{d.dateLabel}</span>
                            <span className="opacity-40">•</span>
                            <span className="font-semibold">{d.count}</span>
                          </span>
                          {idx !== weekActivityCounts.length - 1 && <span className="chip-divider" />}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}
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
              <div className="p-6">
                <div className="space-y-2.5">
                  {recentActivity.slice(0, 8).map((log, index) => (
                    <div 
                      key={log.id} 
                      className="group relative bg-white border border-gray-200 rounded-lg p-4 hover:shadow-lg hover:border-blue-300 transition-all duration-200"
                    >
                      <div className="flex items-center gap-4">
                        {/* Ícone */}
                        <div className="flex-shrink-0 p-2 bg-gradient-to-br from-blue-500 to-blue-600 rounded-lg shadow-sm">
                          <div className="text-white">
                            {getActionIcon(log.action)}
                          </div>
                        </div>

                        {/* Conteúdo: Linha única com todas as informações */}
                        <div className="flex-1 grid grid-cols-1 md:grid-cols-6 gap-3 items-center">
                          
                          {/* Coluna 1: AIH e Nomes */}
                          <div className="space-y-1">
                            {log.aih_number && (
                              <div className="flex items-center gap-2">
                                <span className="text-xs font-medium text-blue-600">AIH</span>
                                <span className="text-xs font-mono font-semibold text-gray-900">{log.aih_number}</span>
                              </div>
                            )}
                            {log.patient_name && (
                              <div className="flex items-center gap-1.5">
                                <div className="w-1 h-1 rounded-full bg-blue-500 flex-shrink-0"></div>
                                <span className="text-xs text-gray-700 truncate">{log.patient_name}</span>
                              </div>
                            )}
                            {log.doctor_name && (
                              <div className="flex items-center gap-1.5">
                                <div className="w-1 h-1 rounded-full bg-green-500 flex-shrink-0"></div>
                                <span className="text-xs text-gray-600 truncate">Dr. {log.doctor_name}</span>
                              </div>
                            )}
                          </div>

                          {/* Coluna 2: Datas de Admissão e Alta (Agrupadas) */}
                          <div className="flex items-center gap-3 bg-gray-50 rounded-lg p-2">
                            {/* Data de Admissão */}
                            <div className="flex items-center gap-1.5">
                              <CalendarDays className="h-3 w-3 text-blue-500 flex-shrink-0" />
                              <div className="min-w-0">
                                <p className="text-xs font-medium text-blue-700">
                                  {formatDate(log.admission_date)}
                                </p>
                                <p className="text-xs text-gray-500">
                                  Admissão
                                </p>
                              </div>
                            </div>

                            {/* Separador visual */}
                            <div className="w-px h-8 bg-gray-300"></div>

                            {/* Data de Alta */}
                            <div className="flex items-center gap-1.5">
                              <CalendarDays className="h-3 w-3 text-green-500 flex-shrink-0" />
                              <div className="min-w-0">
                                <p className="text-xs font-medium text-green-700">
                                  {formatDate(log.discharge_date)}
                                </p>
                                <p className="text-xs text-gray-500">
                                  Alta
                                </p>
                              </div>
                            </div>
                          </div>

                          {/* Coluna 3: Competência */}
                          <div className="flex items-center gap-2">
                            <CalendarDays className="h-3.5 w-3.5 text-purple-500 flex-shrink-0" />
                            <div className="min-w-0">
                              <p className="text-xs font-medium text-purple-700">
                                {formatCompetencia(log.competencia)}
                              </p>
                              <p className="text-xs text-gray-500">
                                Competência
                              </p>
                            </div>
                          </div>

                          {/* Coluna 4: Hospital */}
                          <div className="flex items-center gap-2">
                            <Building2 className="h-3.5 w-3.5 text-gray-400 flex-shrink-0" />
                            <span className="text-sm font-medium text-gray-900 truncate">
                              {log.hospital_name || 'N/A'}
                            </span>
                          </div>

                          {/* Coluna 5: Operador */}
                          <div className="flex items-center gap-2">
                            <Users className="h-3.5 w-3.5 text-gray-400 flex-shrink-0" />
                            <div className="min-w-0">
                              <p className="text-sm font-medium text-gray-900 truncate">
                                {log.user_name || 'Sistema'}
                              </p>
                              {log.user_email && (
                                <p className="text-xs text-gray-500 truncate">
                                  {log.user_email}
                                </p>
                              )}
                            </div>
                          </div>

                          {/* Coluna 6: Data/Hora */}
                          <div className="flex items-center gap-1.5 md:justify-end">
                            <Clock className="h-3.5 w-3.5 text-gray-400" />
                            <span className="text-xs text-gray-600 whitespace-nowrap">
                              {formatTime(log.created_at)}
                            </span>
                          </div>

                        </div>
                      </div>

                      {/* Indicador de hover */}
                      <div className="absolute top-0 left-0 w-1 h-full bg-blue-500 rounded-l-lg opacity-0 group-hover:opacity-100 transition-opacity duration-200"></div>
                    </div>
                  ))}
                </div>
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

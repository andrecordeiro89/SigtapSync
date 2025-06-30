import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Users, FileText, DollarSign, AlertCircle, RefreshCw, Database } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { PatientService, AIHService } from '../services/supabaseService';
import { useSigtapContext } from '../contexts/SigtapContext';
import { formatCurrency } from '../utils/validation';
import SigtapDebugger from './SigtapDebugger';

interface DashboardStats {
  totalPatients: number;
  totalAIHs: number;
  totalProcedures: number;
  pendingReview: number;
  monthlyRevenue: number;
}

const Dashboard = () => {
  const [stats, setStats] = useState<DashboardStats>({
    totalPatients: 0,
    totalAIHs: 0,
    totalProcedures: 0,
    pendingReview: 0,
    monthlyRevenue: 0
  });
  const [isLoading, setIsLoading] = useState(true);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);
  
  const { user, profile } = useAuth();
  const { totalProcedures: sigtapProcedures } = useSigtapContext();
  
  // Hospital atual (simplificado para Fase 1)
  const currentHospital = profile?.hospital_access?.[0] 
    ? { id: profile.hospital_access[0], name: 'Hospital Principal' }
    : { id: 'a0000000-0000-0000-0000-000000000001', name: 'Hospital Demo' };

  // Carregar estatísticas reais
  const loadRealStats = async () => {
    if (!currentHospital) return;
    
    setIsLoading(true);
    try {
      console.log('📊 Carregando estatísticas do dashboard...');
      
      // Carregar pacientes
      const patients = await PatientService.getPatients(currentHospital.id);
      
      // Carregar AIHs
      const aihs = await AIHService.getAIHs(currentHospital.id);
      
      // Calcular estatísticas
      const pendingAIHs = aihs.filter(aih => 
        aih.processing_status === 'pending' || 
        aih.processing_status === 'manual_review'
      ).length;
      
      // Valor total estimado (simplificado)
      const totalValue = aihs.reduce((sum, aih) => {
        return sum + (aih.original_value ? aih.original_value / 100 : 0);
      }, 0);
      
      const newStats: DashboardStats = {
        totalPatients: patients.length,
        totalAIHs: aihs.length,
        totalProcedures: sigtapProcedures,
        pendingReview: pendingAIHs,
        monthlyRevenue: totalValue
      };
      
      setStats(newStats);
      setLastUpdate(new Date());
      
      console.log('✅ Estatísticas carregadas:', newStats);
      
    } catch (error) {
      console.error('❌ Erro ao carregar estatísticas:', error);
      
      // Fallback para dados mock em caso de erro
      setStats({
        totalPatients: 0,
        totalAIHs: 0,
        totalProcedures: sigtapProcedures,
        pendingReview: 0,
        monthlyRevenue: 0
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Carregar dados na inicialização
  useEffect(() => {
    loadRealStats();
  }, [currentHospital?.id, sigtapProcedures]);

  const statCards = [
    {
      title: 'Total de Pacientes',
      value: isLoading ? '...' : stats.totalPatients.toString(),
      icon: Users,
      color: 'text-blue-600',
      bgColor: 'bg-blue-50',
      description: 'Pacientes cadastrados'
    },
    {
      title: 'AIHs Processadas',
      value: isLoading ? '...' : stats.totalAIHs.toString(),
      icon: FileText,
      color: 'text-green-600',
      bgColor: 'bg-green-50',
      description: 'Autorizações processadas'
    },
    {
      title: 'Proc. SIGTAP',
      value: isLoading ? '...' : stats.totalProcedures.toLocaleString(),
      icon: Database,
      color: 'text-purple-600',
      bgColor: 'bg-purple-50',
      description: 'Procedimentos na tabela'
    },
    {
      title: 'Pendentes',
      value: isLoading ? '...' : stats.pendingReview.toString(),
      icon: AlertCircle,
      color: 'text-orange-600',
      bgColor: 'bg-orange-50',
      description: 'Aguardando revisão'
    }
  ];

  // MODO DESENVOLVEDOR: permitir acesso sem autenticação
  // if (!user) {
  //   return (
  //     <div className="flex items-center justify-center h-64">
  //       <div className="text-center">
  //         <Users className="mx-auto h-12 w-12 text-gray-400" />
  //         <h3 className="mt-2 text-sm font-semibold text-gray-900">Acesso restrito</h3>
  //         <p className="mt-1 text-sm text-gray-500">
  //           Faça login para acessar o dashboard
  //         </p>
  //       </div>
  //     </div>
  //   );
  // }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Dashboard</h2>
          <p className="text-gray-600 mt-1">
            {currentHospital?.name || 'Sistema de Faturamento SIGTAP'}
          </p>
        </div>
        <div className="flex items-center space-x-4">
          {lastUpdate && (
            <span className="text-sm text-gray-500">
              Atualizado: {lastUpdate.toLocaleTimeString()}
            </span>
          )}
          <button
            onClick={loadRealStats}
            disabled={isLoading}
            className="flex items-center space-x-2 px-3 py-2 text-sm bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-100 disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
            <span>Atualizar</span>
          </button>
        </div>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {statCards.map((stat, index) => (
          <Card key={index} className="hover:shadow-md transition-shadow">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-gray-600">
                {stat.title}
              </CardTitle>
              <div className={`p-2 rounded-full ${stat.bgColor}`}>
                <stat.icon className={`w-4 h-4 ${stat.color}`} />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-gray-900">
                {stat.value}
              </div>
              <p className="text-xs text-gray-500 mt-1">
                {stat.description}
              </p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Card de valor total se há AIHs */}
      {stats.totalAIHs > 0 && (
        <Card className="bg-gradient-to-r from-green-50 to-emerald-50 border-green-200">
          <CardHeader>
            <CardTitle className="flex items-center space-x-2 text-green-700">
              <DollarSign className="w-5 h-5" />
              <span>Valor Total Estimado</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-green-800">
              {formatCurrency(stats.monthlyRevenue)}
            </div>
            <p className="text-green-600 text-sm mt-1">
              Baseado em {stats.totalAIHs} AIH(s) processada(s)
            </p>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg font-semibold">Status do Sistema</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex items-center space-x-3 p-3 bg-gray-50 rounded-lg">
                <div className={`w-2 h-2 rounded-full ${stats.totalProcedures > 1000 ? 'bg-green-500' : 'bg-orange-500'}`}></div>
                <div className="flex-1">
                  <p className="text-sm font-medium">
                    Tabela SIGTAP: {stats.totalProcedures > 1000 ? 'Ativa' : 'Parcial'}
                  </p>
                  <p className="text-xs text-gray-500">
                    {stats.totalProcedures.toLocaleString()} procedimentos carregados
                  </p>
                </div>
              </div>
              
              <div className="flex items-center space-x-3 p-3 bg-gray-50 rounded-lg">
                <div className={`w-2 h-2 rounded-full ${user ? 'bg-green-500' : 'bg-red-500'}`}></div>
                <div className="flex-1">
                  <p className="text-sm font-medium">
                    Autenticação: {user ? 'Ativa' : 'Inativa'}
                  </p>
                  <p className="text-xs text-gray-500">
                    {user ? `Logado como ${user.email}` : 'Não autenticado'}
                  </p>
                </div>
              </div>

              <div className="flex items-center space-x-3 p-3 bg-gray-50 rounded-lg">
                <div className={`w-2 h-2 rounded-full ${stats.totalPatients > 0 ? 'bg-blue-500' : 'bg-gray-400'}`}></div>
                <div className="flex-1">
                  <p className="text-sm font-medium">
                    Base de Pacientes: {stats.totalPatients > 0 ? 'Ativa' : 'Vazia'}
                  </p>
                  <p className="text-xs text-gray-500">
                    {stats.totalPatients} paciente(s) cadastrado(s)
                  </p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg font-semibold">Ações Rápidas</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <button 
                onClick={() => window.location.href = '#/sigtap-import'}
                className="w-full p-3 text-left bg-blue-50 hover:bg-blue-100 rounded-lg transition-colors"
              >
                <div className="font-medium text-blue-700">Importar SIGTAP</div>
                <div className="text-sm text-blue-600">Atualizar tabela de procedimentos</div>
              </button>
              
              <button 
                onClick={() => window.location.href = '#/upload-aih'}
                className="w-full p-3 text-left bg-green-50 hover:bg-green-100 rounded-lg transition-colors"
              >
                <div className="font-medium text-green-700">Upload AIH</div>
                <div className="text-sm text-green-600">Processar autorização de internação</div>
              </button>
              
              <button 
                onClick={() => window.location.href = '#/pacientes'}
                className="w-full p-3 text-left bg-purple-50 hover:bg-purple-100 rounded-lg transition-colors"
              >
                <div className="font-medium text-purple-700">Gerenciar Pacientes</div>
                <div className="text-sm text-purple-600">Cadastrar e editar pacientes</div>
              </button>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Debugger temporário para diagnóstico */}
      <div className="border-t pt-6">
        <h3 className="text-lg font-semibold mb-4 text-gray-800">🔧 Diagnóstico de Persistência (Temporário)</h3>
        <SigtapDebugger />
      </div>
    </div>
  );
};

export default Dashboard;

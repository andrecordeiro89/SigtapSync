import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Badge } from './ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import { useAuth } from '../contexts/AuthContext';
import { toast } from 'sonner';
import {
  BarChart4,
  TrendingUp,
  Users,
  Hospital,
  DollarSign,
  FileText,
  Download,
  RefreshCw,
  Calendar,
  Filter,
  Eye,
  AlertTriangle,
  CheckCircle,
  Clock,
  Activity,
  PieChart,
  Building2,
  Stethoscope,
  Target,
  Award
} from 'lucide-react';

interface ExecutiveDashboardProps {}

interface KPIData {
  totalRevenue: number;
  totalAIHs: number;
  averageTicket: number;
  approvalRate: number;
  activeHospitals: number;
  activeDoctors: number;
  processingTime: number;
  monthlyGrowth: number;
}

interface HospitalStats {
  id: string;
  name: string;
  aihCount: number;
  revenue: number;
  approvalRate: number;
  doctorCount: number;
  avgProcessingTime: number;
}

interface DoctorStats {
  id: string;
  name: string;
  cns: string;
  crm: string;
  specialty: string;
  hospitalName: string;
  aihCount: number;
  procedureCount: number;
  revenue: number;
  avgConfidence: number;
}

interface AlertItem {
  id: string;
  type: 'warning' | 'info' | 'success' | 'error';
  title: string;
  message: string;
  timestamp: string;
  priority: 'high' | 'medium' | 'low';
}

const ExecutiveDashboard: React.FC<ExecutiveDashboardProps> = () => {
  // State Management
  const [selectedTimeRange, setSelectedTimeRange] = useState('30d');
  const [selectedHospitals, setSelectedHospitals] = useState<string[]>(['all']);
  const [isLoading, setIsLoading] = useState(true);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);
  
  // Data States
  const [kpiData, setKpiData] = useState<KPIData>({
    totalRevenue: 0,
    totalAIHs: 0,
    averageTicket: 0,
    approvalRate: 0,
    activeHospitals: 0,
    activeDoctors: 0,
    processingTime: 0,
    monthlyGrowth: 0
  });
  
  const [hospitalStats, setHospitalStats] = useState<HospitalStats[]>([]);
  const [doctorStats, setDoctorStats] = useState<DoctorStats[]>([]);
  const [alerts, setAlerts] = useState<AlertItem[]>([]);

  // Authentication
  const { user, isDirector, isAdmin, isCoordinator, isTI, hasPermission } = useAuth();

  // Access Control
  const hasExecutiveAccess = isDirector() || isAdmin() || isCoordinator() || isTI() || hasPermission('generate_reports');

  // Load Data
  const loadExecutiveData = async () => {
    if (!hasExecutiveAccess) return;
    
    setIsLoading(true);
    try {
      console.log('📊 Carregando dados executivos...');
      
      // Simular carregamento de dados (implementar services reais depois)
      await new Promise(resolve => setTimeout(resolve, 1500));
      
      // Mock Data - substituir por dados reais
      setKpiData({
        totalRevenue: 2350000.50,
        totalAIHs: 1247,
        averageTicket: 1884.32,
        approvalRate: 94.2,
        activeHospitals: 8,
        activeDoctors: 142,
        processingTime: 2.3,
        monthlyGrowth: 12.5
      });

      setHospitalStats([
        {
          id: '1',
          name: 'Hospital Maternidade Nossa Senhora Aparecida',
          aihCount: 324,
          revenue: 610500.75,
          approvalRate: 96.8,
          doctorCount: 45,
          avgProcessingTime: 1.8
        },
        {
          id: '2', 
          name: 'Hospital Municipal 18 de Dezembro',
          aihCount: 287,
          revenue: 425300.20,
          approvalRate: 92.1,
          doctorCount: 32,
          avgProcessingTime: 2.1
        }
      ]);

      setDoctorStats([
        {
          id: '1',
          name: 'Dr. João Silva',
          cns: '123456789012345',
          crm: '12345',
          specialty: 'Cardiologia',
          hospitalName: 'Hospital Maternidade Nossa Senhora Aparecida',
          aihCount: 45,
          procedureCount: 127,
          revenue: 89500.75,
          avgConfidence: 94.2
        }
      ]);

      setAlerts([
        {
          id: '1',
          type: 'warning',
          title: 'Taxa de Aprovação Baixa',
          message: 'Hospital Municipal São José com 87% de aprovação (abaixo da meta de 90%)',
          timestamp: new Date().toISOString(),
          priority: 'high'
        }
      ]);

      setLastUpdate(new Date());
      console.log('✅ Dados executivos carregados com sucesso');
      
    } catch (error) {
      console.error('❌ Erro ao carregar dados executivos:', error);
      toast.error('Erro ao carregar dados do dashboard executivo');
    } finally {
      setIsLoading(false);
    }
  };

  // Effects
  useEffect(() => {
    if (hasExecutiveAccess) {
      loadExecutiveData();
    }
  }, [selectedTimeRange, selectedHospitals, hasExecutiveAccess]);

  // Access Control Render
  if (!hasExecutiveAccess) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center">
          <AlertTriangle className="mx-auto h-16 w-16 text-red-400" />
          <h3 className="mt-4 text-xl font-semibold text-gray-900">Acesso Restrito</h3>
          <p className="mt-2 text-gray-600">
            Esta área é restrita à diretoria, coordenação e administradores.
          </p>
          <p className="mt-1 text-sm text-gray-500">
            Seu perfil atual: <Badge variant="outline">{user?.role || 'Não identificado'}</Badge>
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto p-6 space-y-6">
      {/* HEADER EXECUTIVO */}
      <div className="bg-gradient-to-r from-blue-900 via-blue-800 to-purple-800 text-white p-8 rounded-xl shadow-2xl">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-4xl font-bold mb-2 flex items-center gap-3">
              <BarChart4 className="h-10 w-10" />
              Dashboard Executivo
            </h1>
            <p className="text-blue-100 text-lg">
              Central de Inteligência e Relatórios para Diretoria
            </p>
            <div className="flex items-center gap-4 mt-3">
              <Badge className="bg-blue-700 text-white">
                <Award className="h-4 w-4 mr-1" />
                Perfil: {user?.role?.toUpperCase()}
              </Badge>
              <Badge className="bg-purple-700 text-white">
                <Building2 className="h-4 w-4 mr-1" />
                Acesso Total: {kpiData.activeHospitals} Hospitais
              </Badge>
            </div>
          </div>
          <div className="text-right">
            <div className="text-3xl font-bold">
              R$ {isLoading ? '...' : kpiData.totalRevenue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
            </div>
            <div className="text-blue-200 text-lg">Faturamento Total</div>
            {lastUpdate && (
              <div className="text-xs text-blue-300 mt-2 flex items-center gap-1">
                <Clock className="h-3 w-3" />
                Atualizado: {lastUpdate.toLocaleTimeString('pt-BR')}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* CONTROLES EXECUTIVOS */}
      <Card className="border-blue-200 shadow-lg">
        <CardHeader className="bg-blue-50">
          <CardTitle className="flex items-center gap-2 text-blue-800">
            <Filter className="h-5 w-5" />
            Controles Executivos
          </CardTitle>
          <CardDescription>
            Configure a visão dos dados conforme suas necessidades de análise
          </CardDescription>
        </CardHeader>
        <CardContent className="pt-6">
          <div className="flex flex-wrap gap-4 items-center">
            {/* Período */}
            <div className="flex items-center gap-2">
              <Calendar className="h-4 w-4 text-gray-600" />
              <span className="text-sm font-medium">Período:</span>
              <Select value={selectedTimeRange} onValueChange={setSelectedTimeRange}>
                <SelectTrigger className="w-40">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="7d">Últimos 7 dias</SelectItem>
                  <SelectItem value="30d">Últimos 30 dias</SelectItem>
                  <SelectItem value="90d">Últimos 3 meses</SelectItem>
                  <SelectItem value="6m">Últimos 6 meses</SelectItem>
                  <SelectItem value="1y">Último ano</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Refresh */}
            <Button 
              onClick={loadExecutiveData} 
              disabled={isLoading}
              className="bg-blue-600 hover:bg-blue-700"
            >
              <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
              {isLoading ? 'Atualizando...' : 'Atualizar'}
            </Button>

            {/* Export */}
            <Button variant="outline" className="border-green-300 text-green-700 hover:bg-green-50">
              <Download className="h-4 w-4 mr-2" />
              Exportar Relatório
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* KPIS EXECUTIVOS */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card className="border-green-200 shadow-lg hover:shadow-xl transition-shadow">
          <CardContent className="p-6 text-center">
            <DollarSign className="h-10 w-10 mx-auto mb-3 text-green-600" />
            <div className="text-3xl font-bold text-green-700">
              R$ {isLoading ? '...' : kpiData.totalRevenue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
            </div>
            <div className="text-sm text-green-600 font-medium">Faturamento Total</div>
            <div className="text-xs text-gray-500 mt-1">
              {kpiData.monthlyGrowth > 0 && (
                <span className="text-green-600">
                  ↗ +{kpiData.monthlyGrowth}% vs mês anterior
                </span>
              )}
            </div>
          </CardContent>
        </Card>

        <Card className="border-blue-200 shadow-lg hover:shadow-xl transition-shadow">
          <CardContent className="p-6 text-center">
            <FileText className="h-10 w-10 mx-auto mb-3 text-blue-600" />
            <div className="text-3xl font-bold text-blue-700">
              {isLoading ? '...' : kpiData.totalAIHs.toLocaleString('pt-BR')}
            </div>
            <div className="text-sm text-blue-600 font-medium">AIHs Processadas</div>
            <div className="text-xs text-gray-500 mt-1">
              Ticket médio: R$ {kpiData.averageTicket.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
            </div>
          </CardContent>
        </Card>

        <Card className="border-purple-200 shadow-lg hover:shadow-xl transition-shadow">
          <CardContent className="p-6 text-center">
            <CheckCircle className="h-10 w-10 mx-auto mb-3 text-purple-600" />
            <div className="text-3xl font-bold text-purple-700">
              {isLoading ? '...' : kpiData.approvalRate.toFixed(1)}%
            </div>
            <div className="text-sm text-purple-600 font-medium">Taxa de Aprovação</div>
            <div className="text-xs text-gray-500 mt-1">
              Meta: 90% | {kpiData.approvalRate >= 90 ? '✓ Atingida' : '⚠ Abaixo da meta'}
            </div>
          </CardContent>
        </Card>

        <Card className="border-orange-200 shadow-lg hover:shadow-xl transition-shadow">
          <CardContent className="p-6 text-center">
            <Activity className="h-10 w-10 mx-auto mb-3 text-orange-600" />
            <div className="text-3xl font-bold text-orange-700">
              {isLoading ? '...' : kpiData.processingTime.toFixed(1)}h
            </div>
            <div className="text-sm text-orange-600 font-medium">Tempo Médio</div>
            <div className="text-xs text-gray-500 mt-1">
              Processamento de AIH
            </div>
          </CardContent>
        </Card>
      </div>

      {/* TABS PRINCIPAIS */}
      <Tabs defaultValue="overview" className="space-y-6">
        <TabsList className="grid w-full grid-cols-4 bg-blue-100">
          <TabsTrigger value="overview" className="data-[state=active]:bg-blue-600 data-[state=active]:text-white">
            <Eye className="h-4 w-4 mr-2" />
            Visão Geral
          </TabsTrigger>
          <TabsTrigger value="hospitals" className="data-[state=active]:bg-blue-600 data-[state=active]:text-white">
            <Hospital className="h-4 w-4 mr-2" />
            Hospitais
          </TabsTrigger>
          <TabsTrigger value="doctors" className="data-[state=active]:bg-blue-600 data-[state=active]:text-white">
            <Stethoscope className="h-4 w-4 mr-2" />
            Médicos
          </TabsTrigger>
          <TabsTrigger value="reports" className="data-[state=active]:bg-blue-600 data-[state=active]:text-white">
            <Target className="h-4 w-4 mr-2" />
            Relatórios
          </TabsTrigger>
        </TabsList>

        {/* TAB: VISÃO GERAL */}
        <TabsContent value="overview" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card className="shadow-lg">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <TrendingUp className="h-5 w-5 text-blue-600" />
                  Resumo Executivo
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex justify-between items-center">
                    <span className="text-gray-600">Hospitais Ativos</span>
                    <Badge className="bg-blue-100 text-blue-800">{kpiData.activeHospitals}</Badge>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-gray-600">Médicos Ativos</span>
                    <Badge className="bg-green-100 text-green-800">{kpiData.activeDoctors}</Badge>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-gray-600">Taxa de Crescimento</span>
                    <Badge className="bg-purple-100 text-purple-800">+{kpiData.monthlyGrowth}%</Badge>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="shadow-lg">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <PieChart className="h-5 w-5 text-purple-600" />
                  Faturamento por Hospital
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-48 bg-gray-50 rounded-lg flex items-center justify-center">
                  <div className="text-center text-gray-500">
                    <PieChart className="h-8 w-8 mx-auto mb-2" />
                    <div className="text-sm">Gráfico será implementado</div>
                    <div className="text-xs">com Chart.js na próxima fase</div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* TAB: HOSPITAIS */}
        <TabsContent value="hospitals" className="space-y-6">
          <Card className="shadow-lg">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Hospital className="h-5 w-5 text-blue-600" />
                Performance por Hospital
              </CardTitle>
              <CardDescription>
                Análise detalhada do desempenho de cada unidade
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {hospitalStats.map((hospital) => (
                  <div key={hospital.id} className="p-4 border rounded-lg hover:bg-gray-50 transition-colors">
                    <div className="flex items-center justify-between mb-3">
                      <h4 className="font-semibold text-gray-900">{hospital.name}</h4>
                      <Badge 
                        className={
                          hospital.approvalRate >= 95 ? 'bg-green-100 text-green-800' :
                          hospital.approvalRate >= 90 ? 'bg-yellow-100 text-yellow-800' :
                          'bg-red-100 text-red-800'
                        }
                      >
                        {hospital.approvalRate.toFixed(1)}% aprovação
                      </Badge>
                    </div>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                      <div>
                        <span className="text-gray-600">AIHs:</span>
                        <div className="font-semibold">{hospital.aihCount}</div>
                      </div>
                      <div>
                        <span className="text-gray-600">Faturamento:</span>
                        <div className="font-semibold">R$ {hospital.revenue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</div>
                      </div>
                      <div>
                        <span className="text-gray-600">Médicos:</span>
                        <div className="font-semibold">{hospital.doctorCount}</div>
                      </div>
                      <div>
                        <span className="text-gray-600">Tempo Médio:</span>
                        <div className="font-semibold">{hospital.avgProcessingTime}h</div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* TAB: MÉDICOS */}
        <TabsContent value="doctors" className="space-y-6">
          <Card className="shadow-lg">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Stethoscope className="h-5 w-5 text-green-600" />
                Consulta de Médicos por Unidade
              </CardTitle>
              <CardDescription>
                Visão completa dos médicos ativos em cada hospital
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {doctorStats.map((doctor) => (
                  <div key={doctor.id} className="p-4 border rounded-lg hover:bg-gray-50 transition-colors">
                    <div className="flex items-start justify-between mb-3">
                      <div>
                        <h4 className="font-semibold text-gray-900">{doctor.name}</h4>
                        <div className="text-sm text-gray-600">
                          CRM: {doctor.crm} | CNS: {doctor.cns}
                        </div>
                        <Badge variant="outline" className="mt-1">
                          {doctor.specialty}
                        </Badge>
                      </div>
                      <div className="text-right">
                        <div className="text-sm text-gray-600">{doctor.hospitalName}</div>
                        <Badge className="bg-blue-100 text-blue-800 mt-1">
                          Confiança: {doctor.avgConfidence.toFixed(1)}%
                        </Badge>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm">
                      <div>
                        <span className="text-gray-600">AIHs:</span>
                        <div className="font-semibold">{doctor.aihCount}</div>
                      </div>
                      <div>
                        <span className="text-gray-600">Procedimentos:</span>
                        <div className="font-semibold">{doctor.procedureCount}</div>
                      </div>
                      <div>
                        <span className="text-gray-600">Faturamento:</span>
                        <div className="font-semibold">R$ {doctor.revenue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* TAB: RELATÓRIOS */}
        <TabsContent value="reports" className="space-y-6">
          <Card className="shadow-lg">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Target className="h-5 w-5 text-purple-600" />
                Gerador de Relatórios Executivos
              </CardTitle>
              <CardDescription>
                Crie relatórios customizados para suas necessidades de gestão
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <Button className="h-24 flex flex-col items-center justify-center bg-green-600 hover:bg-green-700">
                  <FileText className="h-6 w-6 mb-2" />
                  <div className="text-center">
                    <div className="font-semibold">Relatório Financeiro</div>
                    <div className="text-xs opacity-90">Faturamento e performance</div>
                  </div>
                </Button>
                
                <Button className="h-24 flex flex-col items-center justify-center bg-blue-600 hover:bg-blue-700">
                  <Users className="h-6 w-6 mb-2" />
                  <div className="text-center">
                    <div className="font-semibold">Relatório de Médicos</div>
                    <div className="text-xs opacity-90">Performance por profissional</div>
                  </div>
                </Button>
                
                <Button className="h-24 flex flex-col items-center justify-center bg-purple-600 hover:bg-purple-700">
                  <Hospital className="h-6 w-6 mb-2" />
                  <div className="text-center">
                    <div className="font-semibold">Relatório Hospitalar</div>
                    <div className="text-xs opacity-90">Comparação entre unidades</div>
                  </div>
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default ExecutiveDashboard; 
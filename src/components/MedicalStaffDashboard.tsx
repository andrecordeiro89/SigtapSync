import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { Input } from './ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import { 
  Stethoscope, 
  Users, 
  Building2, 
  TrendingUp, 
  Search,
  Award,
  Activity,
  DollarSign,
  CheckCircle,
  AlertTriangle,
  UserCheck,
  FileText,
  BarChart3,
  PieChart,
  Calendar,
  Filter,
  RefreshCw,
  Download,
  Eye,
  Clock,
  Star,
  Target,
  Zap,
  Edit3,
  UserPlus,
  Database
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import ExecutiveDateFilters from './ExecutiveDateFilters';
import DoctorsAnalyticsService from '../services/doctorsAnalyticsService';
import { DoctorsCrudService } from '../services/doctorsCrudService';
import DoctorEditModal from './DoctorEditModal';
import ProfessionalsTable from './ProfessionalsTable';
import { 
  MedicalKPIData, 
  MedicalAnalytics, 
  DoctorStats, 
  MedicalSpecialty, 
  HospitalMedicalStats,
  DateRange,
  MedicalDoctor 
} from '../types';

interface MedicalStaffDashboardProps {
  className?: string;
}

const MedicalStaffDashboard: React.FC<MedicalStaffDashboardProps> = ({ className }) => {
  const { user, isDirector, isAdmin, isCoordinator, isTI, hasPermission } = useAuth();
  
  // Estados
  const [isLoading, setIsLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('overview');
  const [dateRange, setDateRange] = useState<DateRange>({
    startDate: new Date(new Date().setDate(new Date().getDate() - 30)),
    endDate: new Date()
  });
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedHospital, setSelectedHospital] = useState<string>('all');
  const [selectedSpecialty, setSelectedSpecialty] = useState<string>('all');
  
  // Estados para persistência real
  const [realDoctors, setRealDoctors] = useState<MedicalDoctor[]>([]);
  const [realSpecialties, setRealSpecialties] = useState<MedicalSpecialty[]>([]);
  const [realHospitalStats, setRealHospitalStats] = useState<HospitalMedicalStats[]>([]);
  const [realDoctorStats, setRealDoctorStats] = useState<DoctorStats[]>([]);
  const [useRealData, setUseRealData] = useState(true);
  
  // Estados para edição
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [editingDoctor, setEditingDoctor] = useState<MedicalDoctor | null>(null);
  const [editMode, setEditMode] = useState<'create' | 'edit'>('edit');
  
  // Dados (mock para fallback)
  const [kpis, setKpis] = useState<MedicalKPIData>({
    totalDoctors: 0,
    totalSpecialties: 0,
    totalHospitals: 0,
    avgRevenuePerDoctor: 0,
    totalRevenue: 0,
    avgApprovalRate: 0,
    monthlyGrowth: 0,
    topSpecialty: ''
  });
  const [analytics, setAnalytics] = useState<MedicalAnalytics | null>(null);
  const [doctorStats, setDoctorStats] = useState<DoctorStats[]>([]);
  const [specialties, setSpecialties] = useState<MedicalSpecialty[]>([]);
  const [hospitalStats, setHospitalStats] = useState<HospitalMedicalStats[]>([]);

  // Verificar acesso
  const hasAccess = isDirector() || isAdmin() || isCoordinator() || isTI() || hasPermission('medical_management');

  // Carregar dados reais
  const loadRealData = async () => {
    setIsLoading(true);
    try {
      console.log('🩺 [REAL] Carregando dados médicos do banco...');
      
      const filters = {
        hospitalIds: selectedHospital === 'all' ? undefined : [selectedHospital],
        specialties: selectedSpecialty === 'all' ? undefined : [selectedSpecialty],
        searchTerm: searchTerm || undefined,
        isActive: true
      };

      const [doctorsResult, specialtiesResult, hospitalStatsResult, doctorStatsResult] = await Promise.all([
        DoctorsCrudService.getAllDoctors(filters),
        DoctorsCrudService.getMedicalSpecialties(),
        DoctorsCrudService.getHospitalMedicalStats(),
        DoctorsCrudService.getDoctorStats(filters)
      ]);

      if (doctorsResult.success) {
        setRealDoctors(doctorsResult.data || []);
        console.log('✅ Médicos carregados:', doctorsResult.data?.length);
      }

      if (specialtiesResult.success) {
        setRealSpecialties(specialtiesResult.data || []);
        console.log('✅ Especialidades carregadas:', specialtiesResult.data?.length);
      }

      if (hospitalStatsResult.success) {
        setRealHospitalStats(hospitalStatsResult.data || []);
        console.log('✅ Estatísticas hospitalares carregadas:', hospitalStatsResult.data?.length);
      }

      if (doctorStatsResult.success) {
        setRealDoctorStats(doctorStatsResult.data || []);
        console.log('✅ Estatísticas médicas carregadas:', doctorStatsResult.data?.length);
      }

      // Atualizar KPIs com dados reais
      setKpis({
        totalDoctors: doctorsResult.data?.length || 0,
        totalSpecialties: specialtiesResult.data?.length || 0,
        totalHospitals: hospitalStatsResult.data?.length || 0,
        avgRevenuePerDoctor: doctorStatsResult.data ? 
          Math.round((doctorStatsResult.data.reduce((sum, doc) => sum + doc.revenue, 0) / doctorStatsResult.data.length) || 0) : 0,
        totalRevenue: doctorStatsResult.data?.reduce((sum, doc) => sum + doc.revenue, 0) || 0,
        avgApprovalRate: doctorStatsResult.data ? 
          Math.round((doctorStatsResult.data.reduce((sum, doc) => sum + doc.approvalRate, 0) / doctorStatsResult.data.length) || 0) : 0,
        monthlyGrowth: 5.2, // Calculado dinamicamente depois
        topSpecialty: specialtiesResult.data?.[0]?.name || 'N/A'
      });

    } catch (error) {
      console.error('❌ Erro ao carregar dados reais:', error);
      // Fallback para dados mock
      setUseRealData(false);
      loadMockData();
    } finally {
      setIsLoading(false);
    }
  };

  // Carregar dados mock (fallback)
  const loadMockData = async () => {
    setIsLoading(true);
    try {
      console.log('🎭 [MOCK] Carregando dados mock...');
      
      const filters = {
        dateRange,
        hospitalIds: selectedHospital === 'all' ? undefined : [selectedHospital],
        specialties: selectedSpecialty === 'all' ? undefined : [selectedSpecialty],
        searchTerm: searchTerm || undefined
      };

      const [kpiData, analyticsData, doctorsData, specialtiesData, hospitalsData] = await Promise.all([
        DoctorsAnalyticsService.getMedicalKPIs(filters),
        DoctorsAnalyticsService.getMedicalAnalytics(filters),
        DoctorsAnalyticsService.getDoctorStats(filters),
        DoctorsAnalyticsService.getMedicalSpecialties(),
        DoctorsAnalyticsService.getHospitalMedicalStats()
      ]);

      setKpis(kpiData);
      setAnalytics(analyticsData);
      setDoctorStats(doctorsData);
      setSpecialties(specialtiesData);
      setHospitalStats(hospitalsData);
    } catch (error) {
      console.error('Erro ao carregar dados mock:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // Carregar dados baseado no modo
  const loadData = async () => {
    if (useRealData) {
      await loadRealData();
    } else {
      await loadMockData();
    }
  };

  // Efeitos
  useEffect(() => {
    if (hasAccess) {
      loadData();
    }
  }, [dateRange, selectedHospital, selectedSpecialty, searchTerm, useRealData]);

  // Handlers
  const handleDateRangeChange = (range: DateRange) => {
    setDateRange(range);
  };

  const handleRefresh = () => {
    loadData();
  };

  const handleExport = () => {
    console.log('Exportando dados médicos...');
  };

  // Handlers para edição
  const handleCreateDoctor = () => {
    setEditingDoctor(null);
    setEditMode('create');
    setEditModalOpen(true);
  };

  const handleEditDoctor = (doctor: MedicalDoctor) => {
    setEditingDoctor(doctor);
    setEditMode('edit');
    setEditModalOpen(true);
  };

  const handleEditSuccess = () => {
    setEditModalOpen(false);
    setEditingDoctor(null);
    // Recarregar dados
    loadData();
  };

  const handleToggleDataSource = () => {
    setUseRealData(!useRealData);
  };

  // Renderizar se não tem acesso
  if (!hasAccess) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <Stethoscope className="mx-auto h-16 w-16 text-gray-400 mb-4" />
          <h3 className="text-lg font-semibold text-gray-900 mb-2">Acesso Restrito</h3>
          <p className="text-gray-600 max-w-md">
            Esta seção é exclusiva para diretoria, administração, coordenação e TI.
            Somente usuários com permissões médicas podem acessar os dados do corpo clínico.
          </p>
          <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
            <div className="flex items-center justify-center space-x-2">
              <UserCheck className="h-5 w-5 text-blue-600" />
              <span className="text-sm font-medium text-blue-800">Permissões Necessárias</span>
            </div>
            <div className="mt-2 text-sm text-blue-700">
              Director | Administrator | Coordinator | TI
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`space-y-6 ${className}`}>
      {/* HEADER EXECUTIVO */}
      <div className="bg-gradient-to-r from-blue-600 to-purple-600 text-white p-6 rounded-lg shadow-lg">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold mb-2 flex items-center space-x-2">
              <Stethoscope className="h-8 w-8" />
              <span>Corpo Médico</span>
            </h1>
            <p className="text-blue-100">
              Gestão completa do corpo clínico e análise de performance médica
            </p>
          </div>
          <div className="text-right">
            <div className="text-3xl font-bold flex items-center gap-2">
              {isLoading ? '...' : kpis.totalDoctors}
              {useRealData ? (
                              <Database className="h-6 w-6 text-green-300" />
            ) : (
              <FileText className="h-6 w-6 text-yellow-300" />
              )}
            </div>
            <div className="text-blue-100">Médicos Ativos</div>
            <div className="text-sm text-blue-200 mt-1">
              {useRealData ? realSpecialties.length : specialties.length} especialidades
            </div>
          </div>
        </div>
      </div>

      {/* CONTROLES PRINCIPAIS */}
      <div className="flex flex-col sm:flex-row gap-4 items-center justify-between">
        <div className="flex items-center gap-3">
          <Button
            onClick={handleCreateDoctor}
            className="bg-green-600 hover:bg-green-700 text-white"
          >
            <UserPlus className="h-4 w-4 mr-2" />
            Adicionar Médico
          </Button>
          
          <Button
            variant="outline"
            onClick={handleToggleDataSource}
            className="flex items-center gap-2"
          >
            {useRealData ? (
              <>
                <Database className="h-4 w-4" />
                Dados Reais
              </>
            ) : (
              <>
                <FileText className="h-4 w-4" />
                Dados Mock
              </>
            )}
          </Button>
        </div>

        <div className="flex items-center gap-2">
          <Badge variant={useRealData ? "default" : "secondary"}>
            {useRealData ? '✅ Persistência Ativa' : '⚠️ Dados de Teste'}
          </Badge>
        </div>
      </div>

      {/* FILTROS EXECUTIVOS */}
      <ExecutiveDateFilters
        onDateRangeChange={handleDateRangeChange}
        onRefresh={handleRefresh}
        onExport={handleExport}
        isLoading={isLoading}
        title="Filtros Médicos"
        subtitle="Análise temporal e filtros do corpo clínico"
      />

      {/* FILTROS ADICIONAIS */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Filter className="h-5 w-5" />
            <span>Filtros Avançados</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Buscar Médicos</label>
              <div className="relative">
                <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                <Input
                  placeholder="Nome, CRM ou especialidade..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
            
            <div className="space-y-2">
              <label className="text-sm font-medium">Hospital</label>
              <Select value={selectedHospital} onValueChange={setSelectedHospital}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione o hospital" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos os Hospitais</SelectItem>
                  {useRealData ? (
                    realHospitalStats.map((hospital) => (
                      <SelectItem key={hospital.hospitalId} value={hospital.hospitalId}>
                        {hospital.hospitalName}
                      </SelectItem>
                    ))
                  ) : (
                    hospitalStats.map((hospital) => (
                      <SelectItem key={hospital.hospitalId} value={hospital.hospitalId}>
                        {hospital.hospitalName}
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
            </div>
            
            <div className="space-y-2">
              <label className="text-sm font-medium">Especialidade</label>
              <Select value={selectedSpecialty} onValueChange={setSelectedSpecialty}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione a especialidade" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas as Especialidades</SelectItem>
                  {useRealData ? (
                    realSpecialties.map((specialty) => (
                      <SelectItem key={specialty.id} value={specialty.name}>
                        {specialty.name}
                      </SelectItem>
                    ))
                  ) : (
                    specialties.map((specialty) => (
                      <SelectItem key={specialty.id} value={specialty.name}>
                        {specialty.name}
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* MODAIS */}
      <DoctorEditModal
        isOpen={editModalOpen}
        onClose={() => setEditModalOpen(false)}
        doctor={editingDoctor}
        mode={editMode}
        onSuccess={handleEditSuccess}
      />

      {/* KPIs MÉDICOS */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="border-blue-200 bg-gradient-to-br from-blue-50 to-blue-100">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-blue-600">Total Médicos</p>
                <p className="text-2xl font-bold text-blue-800">
                  {isLoading ? '...' : kpis.totalDoctors}
                </p>
                <p className="text-xs text-blue-500">
                  +{Math.round(kpis.monthlyGrowth)}% este mês
                </p>
              </div>
              <Users className="h-8 w-8 text-blue-600" />
            </div>
          </CardContent>
        </Card>

        <Card className="border-green-200 bg-gradient-to-br from-green-50 to-green-100">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-green-600">Faturamento</p>
                <p className="text-2xl font-bold text-green-800">
                  R$ {isLoading ? '...' : kpis.totalRevenue.toLocaleString('pt-BR')}
                </p>
                <p className="text-xs text-green-500">
                  Média: R$ {kpis.avgRevenuePerDoctor.toLocaleString('pt-BR')}
                </p>
              </div>
              <DollarSign className="h-8 w-8 text-green-600" />
            </div>
          </CardContent>
        </Card>

        <Card className="border-purple-200 bg-gradient-to-br from-purple-50 to-purple-100">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-purple-600">Taxa Aprovação</p>
                <p className="text-2xl font-bold text-purple-800">
                  {isLoading ? '...' : `${kpis.avgApprovalRate.toFixed(1)}%`}
                </p>
                <p className="text-xs text-purple-500">
                  Meta: 90%
                </p>
              </div>
              <CheckCircle className="h-8 w-8 text-purple-600" />
            </div>
          </CardContent>
        </Card>

        <Card className="border-orange-200 bg-gradient-to-br from-orange-50 to-orange-100">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-orange-600">Especialidades</p>
                <p className="text-2xl font-bold text-orange-800">
                  {isLoading ? '...' : kpis.totalSpecialties}
                </p>
                <p className="text-xs text-orange-500">
                  Líder: {kpis.topSpecialty}
                </p>
              </div>
              <Award className="h-8 w-8 text-orange-600" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* TABS PRINCIPAIS */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="overview" className="flex items-center space-x-2">
            <BarChart3 className="h-4 w-4" />
            <span>Visão Geral</span>
          </TabsTrigger>
          <TabsTrigger value="hospitals" className="flex items-center space-x-2">
            <Building2 className="h-4 w-4" />
            <span>Por Hospital</span>
          </TabsTrigger>
          <TabsTrigger value="specialties" className="flex items-center space-x-2">
            <Stethoscope className="h-4 w-4" />
            <span>Especialidades</span>
          </TabsTrigger>
          <TabsTrigger value="professionals" className="flex items-center space-x-2">
            <Users className="h-4 w-4" />
            <span>Lista de Profissionais</span>
          </TabsTrigger>
          <TabsTrigger value="performance" className="flex items-center space-x-2">
            <TrendingUp className="h-4 w-4" />
            <span>Performance</span>
          </TabsTrigger>
        </TabsList>

        {/* TAB: VISÃO GERAL */}
        <TabsContent value="overview" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Resumo de Atividades */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <Activity className="h-5 w-5" />
                  <span>Atividades Recentes</span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="flex items-center space-x-3 p-3 bg-green-50 rounded-lg">
                    <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                    <div className="flex-1">
                      <p className="text-sm font-medium">Dr. Carlos Silva</p>
                      <p className="text-xs text-gray-600">Aprovou 5 procedimentos • 2h atrás</p>
                    </div>
                  </div>
                  <div className="flex items-center space-x-3 p-3 bg-blue-50 rounded-lg">
                    <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                    <div className="flex-1">
                      <p className="text-sm font-medium">Dra. Maria Santos</p>
                      <p className="text-xs text-gray-600">Atingiu 95% de aprovação • 4h atrás</p>
                    </div>
                  </div>
                  <div className="flex items-center space-x-3 p-3 bg-purple-50 rounded-lg">
                    <div className="w-2 h-2 bg-purple-500 rounded-full"></div>
                    <div className="flex-1">
                      <p className="text-sm font-medium">Dr. João Oliveira</p>
                      <p className="text-xs text-gray-600">Novo especialista em Cardiologia • 1d atrás</p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Alertas */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <AlertTriangle className="h-5 w-5 text-orange-600" />
                  <span>Alertas</span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="flex items-center space-x-3 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                    <AlertTriangle className="h-4 w-4 text-yellow-600" />
                    <div className="flex-1">
                      <p className="text-sm font-medium">Taxa de Aprovação Baixa</p>
                      <p className="text-xs text-gray-600">Dr. Pedro Costa - 65% nos últimos 30 dias</p>
                    </div>
                  </div>
                  <div className="flex items-center space-x-3 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                    <Target className="h-4 w-4 text-blue-600" />
                    <div className="flex-1">
                      <p className="text-sm font-medium">Meta Atingida</p>
                      <p className="text-xs text-gray-600">Cardiologia atingiu R$ 2.5M em faturamento</p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* TAB: POR HOSPITAL */}
        <TabsContent value="hospitals" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <Building2 className="h-5 w-5" />
                <span>Performance por Hospital</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {hospitalStats.map((hospital) => (
                  <div key={hospital.hospitalId} className="border rounded-lg p-4 hover:bg-gray-50">
                    <div className="flex items-center justify-between mb-3">
                      <div>
                        <h4 className="font-semibold text-gray-900">{hospital.hospitalName}</h4>
                        <p className="text-sm text-gray-600">
                          {hospital.totalDoctors} médicos • {hospital.specialties.length} especialidades
                        </p>
                      </div>
                      <Badge variant="outline" className="bg-blue-100 text-blue-700">
                        {hospital.avgApprovalRate.toFixed(1)}% aprovação
                      </Badge>
                    </div>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                      <div>
                        <span className="text-gray-600">Faturamento:</span>
                        <div className="font-semibold">R$ {hospital.totalRevenue.toLocaleString('pt-BR')}</div>
                      </div>
                      <div>
                        <span className="text-gray-600">Procedimentos:</span>
                        <div className="font-semibold">{hospital.totalProcedures}</div>
                      </div>
                      <div>
                        <span className="text-gray-600">Tempo Médio:</span>
                        <div className="font-semibold">{hospital.avgProcessingTime}h</div>
                      </div>
                      <div>
                        <span className="text-gray-600">Médicos:</span>
                        <div className="font-semibold">{hospital.totalDoctors}</div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* TAB: ESPECIALIDADES */}
        <TabsContent value="specialties" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <Stethoscope className="h-5 w-5" />
                <span>Distribuição por Especialidade</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {specialties.map((specialty) => (
                  <div key={specialty.id} className="border rounded-lg p-4">
                    <div className="flex items-center justify-between mb-2">
                      <h4 className="font-semibold text-gray-900">{specialty.name}</h4>
                      <Badge variant="outline">{specialty.doctorCount} médicos</Badge>
                    </div>
                    <div className="space-y-2">
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-600">Faturamento Médio:</span>
                        <span className="font-medium">R$ {specialty.averageRevenue.toLocaleString('pt-BR')}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-600">Total Procedimentos:</span>
                        <span className="font-medium">{specialty.totalProcedures}</span>
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-2">
                        <div 
                          className="bg-blue-600 h-2 rounded-full" 
                          style={{ width: `${Math.min((specialty.doctorCount / kpis.totalDoctors) * 100, 100)}%` }}
                        ></div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* TAB: LISTA DE PROFISSIONAIS */}
        <TabsContent value="professionals" className="space-y-4">
          <ProfessionalsTable />
        </TabsContent>

        {/* TAB: PERFORMANCE */}
        <TabsContent value="performance" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <TrendingUp className="h-5 w-5" />
                <span>Top Performers</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {doctorStats.slice(0, 10).map((doctor, index) => (
                  <div key={doctor.id} className="flex items-center space-x-4 p-3 border rounded-lg hover:bg-gray-50">
                    <div className="flex-shrink-0">
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center text-white font-bold ${
                        index === 0 ? 'bg-yellow-500' : 
                        index === 1 ? 'bg-gray-400' : 
                        index === 2 ? 'bg-orange-500' : 'bg-blue-500'
                      }`}>
                        {index + 1}
                      </div>
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center space-x-2">
                        <h4 className="font-semibold text-gray-900">{doctor.name}</h4>
                        <Badge variant="outline" className="text-xs">
                          {doctor.crm}
                        </Badge>
                      </div>
                      <div className="text-sm text-gray-600">
                        {doctor.speciality} • {doctor.hospitalName}
                      </div>
                    </div>
                    <div className="flex items-center space-x-4 text-sm">
                      <div className="text-center">
                        <div className="font-semibold text-green-600">
                          R$ {doctor.revenue.toLocaleString('pt-BR')}
                        </div>
                        <div className="text-gray-500">Faturamento</div>
                      </div>
                      <div className="text-center">
                        <div className="font-semibold text-blue-600">
                          {doctor.approvalRate.toFixed(1)}%
                        </div>
                        <div className="text-gray-500">Aprovação</div>
                      </div>
                      <div className="text-center">
                        <div className="font-semibold text-purple-600">
                          {doctor.procedureCount}
                        </div>
                        <div className="text-gray-500">Procedimentos</div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default MedicalStaffDashboard; 
import { supabase } from '../lib/supabase';
import {
  MedicalDoctor,
  MedicalSpecialty,
  DoctorStats,
  HospitalMedicalStats,
  MedicalKPIData,
  MedicalAnalytics,
  MedicalFilters,
  DoctorPerformanceMetrics,
  MedicalDashboardData,
  DateRange
} from '../types';
import { DoctorsCrudService } from './doctorsCrudService';

// ===== DADOS MOCK PARA DESENVOLVIMENTO =====
const MOCK_DOCTORS: MedicalDoctor[] = [
  {
    id: '1',
    cns: '123456789012345',
    crm: 'SP-123456',
    name: 'Dr. Carlos Eduardo Silva',
    speciality: 'Cardiologia',
    hospitalId: 'hosp-001',
    hospitalName: 'Hospital São Paulo',
    isActive: true,
    createdAt: '2024-01-15',
    updatedAt: '2024-12-20'
  },
  {
    id: '2',
    cns: '234567890123456',
    crm: 'SP-234567',
    name: 'Dra. Maria Santos Oliveira',
    speciality: 'Neurologia',
    hospitalId: 'hosp-001',
    hospitalName: 'Hospital São Paulo',
    isActive: true,
    createdAt: '2024-02-20',
    updatedAt: '2024-12-20'
  },
  {
    id: '3',
    cns: '345678901234567',
    crm: 'SP-345678',
    name: 'Dr. João Pedro Costa',
    speciality: 'Ortopedia',
    hospitalId: 'hosp-002',
    hospitalName: 'Hospital Central',
    isActive: true,
    createdAt: '2024-03-10',
    updatedAt: '2024-12-20'
  },
  {
    id: '4',
    cns: '456789012345678',
    crm: 'SP-456789',
    name: 'Dra. Ana Clara Rodrigues',
    speciality: 'Pediatria',
    hospitalId: 'hosp-001',
    hospitalName: 'Hospital São Paulo',
    isActive: true,
    createdAt: '2024-04-05',
    updatedAt: '2024-12-20'
  },
  {
    id: '5',
    cns: '567890123456789',
    crm: 'SP-567890',
    name: 'Dr. Roberto Almeida',
    speciality: 'Cirurgia Geral',
    hospitalId: 'hosp-003',
    hospitalName: 'Hospital Norte',
    isActive: true,
    createdAt: '2024-05-12',
    updatedAt: '2024-12-20'
  },
  {
    id: '6',
    cns: '678901234567890',
    crm: 'SP-678901',
    name: 'Dra. Fernanda Lima',
    speciality: 'Ginecologia',
    hospitalId: 'hosp-002',
    hospitalName: 'Hospital Central',
    isActive: true,
    createdAt: '2024-06-18',
    updatedAt: '2024-12-20'
  },
  {
    id: '7',
    cns: '789012345678901',
    crm: 'SP-789012',
    name: 'Dr. Marcos Vinícius',
    speciality: 'Urologia',
    hospitalId: 'hosp-001',
    hospitalName: 'Hospital São Paulo',
    isActive: true,
    createdAt: '2024-07-25',
    updatedAt: '2024-12-20'
  },
  {
    id: '8',
    cns: '890123456789012',
    crm: 'SP-890123',
    name: 'Dra. Patricia Souza',
    speciality: 'Dermatologia',
    hospitalId: 'hosp-003',
    hospitalName: 'Hospital Norte',
    isActive: true,
    createdAt: '2024-08-30',
    updatedAt: '2024-12-20'
  }
];

const MOCK_SPECIALTIES: MedicalSpecialty[] = [
  { id: '1', name: 'Cardiologia', code: 'CARD', description: 'Especialidade do coração', doctorCount: 2, averageRevenue: 85000, totalProcedures: 156 },
  { id: '2', name: 'Neurologia', code: 'NEURO', description: 'Especialidade neurológica', doctorCount: 1, averageRevenue: 92000, totalProcedures: 89 },
  { id: '3', name: 'Ortopedia', code: 'ORTO', description: 'Especialidade ortopédica', doctorCount: 1, averageRevenue: 78000, totalProcedures: 134 },
  { id: '4', name: 'Pediatria', code: 'PED', description: 'Especialidade pediátrica', doctorCount: 1, averageRevenue: 65000, totalProcedures: 98 },
  { id: '5', name: 'Cirurgia Geral', code: 'CG', description: 'Cirurgia geral', doctorCount: 1, averageRevenue: 95000, totalProcedures: 67 },
  { id: '6', name: 'Ginecologia', code: 'GINE', description: 'Especialidade ginecológica', doctorCount: 1, averageRevenue: 72000, totalProcedures: 112 },
  { id: '7', name: 'Urologia', code: 'URO', description: 'Especialidade urológica', doctorCount: 1, averageRevenue: 80000, totalProcedures: 78 },
  { id: '8', name: 'Dermatologia', code: 'DERMA', description: 'Especialidade dermatológica', doctorCount: 1, averageRevenue: 58000, totalProcedures: 145 }
];

const MOCK_DOCTOR_STATS: DoctorStats[] = MOCK_DOCTORS.map((doctor, index) => ({
  id: doctor.id,
  name: doctor.name,
  crm: doctor.crm,
  cns: doctor.cns,
  speciality: doctor.speciality,
  hospitalId: doctor.hospitalId,
  hospitalName: doctor.hospitalName,
  aihCount: 15 + (index * 8),
  procedureCount: 45 + (index * 12),
  revenue: 50000 + (index * 15000),
  avgConfidenceScore: 85 + (index * 2),
  avgProcessingTime: 2.5 + (index * 0.5),
  approvalRate: 88 + (index * 1.5),
  lastActivity: new Date(Date.now() - (index * 24 * 60 * 60 * 1000)).toISOString(),
  isActive: true
}));

const MOCK_HOSPITAL_STATS: HospitalMedicalStats[] = [
  {
    hospitalId: 'hosp-001',
    hospitalName: 'Hospital São Paulo',
    totalDoctors: 4,
    specialties: ['Cardiologia', 'Neurologia', 'Pediatria', 'Urologia'],
    totalRevenue: 312000,
    totalProcedures: 355,
    avgApprovalRate: 91.2,
    avgProcessingTime: 3.2,
    doctorDistribution: [
      { specialty: 'Cardiologia', count: 1, percentage: 25 },
      { specialty: 'Neurologia', count: 1, percentage: 25 },
      { specialty: 'Pediatria', count: 1, percentage: 25 },
      { specialty: 'Urologia', count: 1, percentage: 25 }
    ]
  },
  {
    hospitalId: 'hosp-002',
    hospitalName: 'Hospital Central',
    totalDoctors: 2,
    specialties: ['Ortopedia', 'Ginecologia'],
    totalRevenue: 150000,
    totalProcedures: 246,
    avgApprovalRate: 89.8,
    avgProcessingTime: 3.8,
    doctorDistribution: [
      { specialty: 'Ortopedia', count: 1, percentage: 50 },
      { specialty: 'Ginecologia', count: 1, percentage: 50 }
    ]
  },
  {
    hospitalId: 'hosp-003',
    hospitalName: 'Hospital Norte',
    totalDoctors: 2,
    specialties: ['Cirurgia Geral', 'Dermatologia'],
    totalRevenue: 153000,
    totalProcedures: 212,
    avgApprovalRate: 92.1,
    avgProcessingTime: 2.9,
    doctorDistribution: [
      { specialty: 'Cirurgia Geral', count: 1, percentage: 50 },
      { specialty: 'Dermatologia', count: 1, percentage: 50 }
    ]
  }
];

// Classe principal para análise de dados médicos
export class DoctorsAnalyticsService {
  
  // ===== MÉTODOS DE BUSCA BÁSICOS =====

  /**
   * Busca todos os médicos do sistema
   */
  static async getAllDoctors(): Promise<MedicalDoctor[]> {
    try {
      // MODO DESENVOLVIMENTO: Retornar dados mock
      console.log('🩺 [MOCK] Carregando todos os médicos...');
      await new Promise(resolve => setTimeout(resolve, 500)); // Simular delay
      return MOCK_DOCTORS;

      /* CÓDIGO REAL (descomentear quando views estiverem prontas):
      const { data, error } = await supabase
        .from('doctors_complete_view')
        .select('*')
        .order('name');

      if (error) {
        console.error('Erro ao buscar médicos:', error);
        return [];
      }

      return data || [];
      */
    } catch (error) {
      console.error('Erro inesperado ao buscar médicos:', error);
      return MOCK_DOCTORS; // Fallback para mock
    }
  }

  /**
   * Busca médicos por hospital
   */
  static async getDoctorsByHospital(hospitalId: string): Promise<MedicalDoctor[]> {
    try {
      console.log('🏥 [MOCK] Carregando médicos do hospital:', hospitalId);
      await new Promise(resolve => setTimeout(resolve, 300));
      return MOCK_DOCTORS.filter(doctor => doctor.hospitalId === hospitalId);
    } catch (error) {
      console.error('Erro inesperado ao buscar médicos por hospital:', error);
      return [];
    }
  }

  /**
   * Busca médicos por especialidade
   */
  static async getDoctorsBySpecialty(specialty: string): Promise<MedicalDoctor[]> {
    try {
      console.log('🩺 [MOCK] Carregando médicos da especialidade:', specialty);
      await new Promise(resolve => setTimeout(resolve, 300));
      return MOCK_DOCTORS.filter(doctor => doctor.speciality === specialty);
    } catch (error) {
      console.error('Erro inesperado ao buscar médicos por especialidade:', error);
      return [];
    }
  }

  // ===== MÉTODOS DE ESTATÍSTICAS =====

  /**
   * Busca estatísticas detalhadas de médicos
   */
  static async getDoctorStats(filters?: MedicalFilters): Promise<DoctorStats[]> {
    try {
      console.log('📊 [MOCK] Carregando estatísticas de médicos com filtros:', filters);
      await new Promise(resolve => setTimeout(resolve, 400));

      let filteredStats = [...MOCK_DOCTOR_STATS];

      // Aplicar filtros
      if (filters?.hospitalIds && filters.hospitalIds.length > 0) {
        filteredStats = filteredStats.filter(stat => filters.hospitalIds!.includes(stat.hospitalId));
      }

      if (filters?.specialties && filters.specialties.length > 0) {
        filteredStats = filteredStats.filter(stat => filters.specialties!.includes(stat.speciality));
      }

      if (filters?.searchTerm) {
        const searchLower = filters.searchTerm.toLowerCase();
        filteredStats = filteredStats.filter(stat => 
          stat.name.toLowerCase().includes(searchLower) ||
          stat.crm.toLowerCase().includes(searchLower) ||
          stat.speciality.toLowerCase().includes(searchLower)
        );
      }

      if (filters?.minApprovalRate) {
        filteredStats = filteredStats.filter(stat => stat.approvalRate >= filters.minApprovalRate!);
      }

      if (filters?.minRevenue) {
        filteredStats = filteredStats.filter(stat => stat.revenue >= filters.minRevenue!);
      }

      return filteredStats.sort((a, b) => b.revenue - a.revenue);
    } catch (error) {
      console.error('Erro inesperado ao buscar estatísticas de médicos:', error);
      return MOCK_DOCTOR_STATS;
    }
  }

  /**
   * Busca estatísticas por hospital
   */
  static async getHospitalMedicalStats(hospitalId?: string): Promise<HospitalMedicalStats[]> {
    try {
      console.log('🏥 [MOCK] Carregando estatísticas por hospital:', hospitalId);
      await new Promise(resolve => setTimeout(resolve, 350));

      if (hospitalId) {
        return MOCK_HOSPITAL_STATS.filter(stat => stat.hospitalId === hospitalId);
      }

      return MOCK_HOSPITAL_STATS;
    } catch (error) {
      console.error('Erro inesperado ao buscar estatísticas por hospital:', error);
      return MOCK_HOSPITAL_STATS;
    }
  }

  /**
   * Busca especialidades médicas
   */
  static async getMedicalSpecialties(): Promise<MedicalSpecialty[]> {
    try {
      console.log('🩺 [MOCK] Carregando especialidades médicas...');
      await new Promise(resolve => setTimeout(resolve, 250));
      return MOCK_SPECIALTIES;
    } catch (error) {
      console.error('Erro inesperado ao buscar especialidades médicas:', error);
      return MOCK_SPECIALTIES;
    }
  }

  // ===== MÉTODOS DE KPIs =====

  /**
   * Busca KPIs principais do sistema médico
   */
  static async getMedicalKPIs(filters?: MedicalFilters): Promise<MedicalKPIData> {
    try {
      console.log('📈 [MOCK] Calculando KPIs médicos...');
      await new Promise(resolve => setTimeout(resolve, 300));

      // Buscar dados básicos
      const [doctorsData, specialtiesData, hospitalsData] = await Promise.all([
        this.getDoctorStats(filters),
        this.getMedicalSpecialties(),
        this.getHospitalMedicalStats()
      ]);

      // Calcular KPIs
      const totalDoctors = doctorsData.length;
      const totalSpecialties = specialtiesData.length;
      const totalHospitals = hospitalsData.length;
      const totalRevenue = doctorsData.reduce((sum, doc) => sum + doc.revenue, 0);
      const avgRevenuePerDoctor = totalDoctors > 0 ? totalRevenue / totalDoctors : 0;
      const avgApprovalRate = totalDoctors > 0 
        ? doctorsData.reduce((sum, doc) => sum + doc.approvalRate, 0) / totalDoctors 
        : 0;

      // Especialidade com mais médicos
      const topSpecialty = specialtiesData.length > 0 
        ? specialtiesData[0].name 
        : 'N/A';

      // Simular crescimento mensal (em produção, calcular com dados históricos)
      const monthlyGrowth = Math.random() * 8 + 3; // 3-11%

      return {
        totalDoctors,
        totalSpecialties,
        totalHospitals,
        avgRevenuePerDoctor,
        totalRevenue,
        avgApprovalRate,
        monthlyGrowth,
        topSpecialty
      };
    } catch (error) {
      console.error('Erro ao calcular KPIs médicos:', error);
      return {
        totalDoctors: 0,
        totalSpecialties: 0,
        totalHospitals: 0,
        avgRevenuePerDoctor: 0,
        totalRevenue: 0,
        avgApprovalRate: 0,
        monthlyGrowth: 0,
        topSpecialty: 'N/A'
      };
    }
  }

  /**
   * Busca análise completa do sistema médico
   */
  static async getMedicalAnalytics(filters?: MedicalFilters): Promise<MedicalAnalytics> {
    try {
      console.log('📊 [MOCK] Carregando análise médica completa...');
      await new Promise(resolve => setTimeout(resolve, 500));

      // Buscar dados base
      const [doctorsData, specialtiesData, hospitalsData] = await Promise.all([
        this.getDoctorStats(filters),
        this.getMedicalSpecialties(),
        this.getHospitalMedicalStats()
      ]);

      // Calcular distribuição por especialidade
      const specialtyDistribution = specialtiesData.map(spec => ({
        specialty: spec.name,
        count: spec.doctorCount,
        percentage: doctorsData.length > 0 ? (spec.doctorCount / doctorsData.length) * 100 : 0,
        revenue: spec.averageRevenue * spec.doctorCount
      }));

      // Calcular distribuição por hospital
      const hospitalDistribution = hospitalsData.map(hosp => ({
        hospitalId: hosp.hospitalId,
        hospitalName: hosp.hospitalName,
        doctorCount: hosp.totalDoctors,
        revenue: hosp.totalRevenue,
        procedures: hosp.totalProcedures
      }));

      // Top performers
      const topPerformers = doctorsData
        .sort((a, b) => b.revenue - a.revenue)
        .slice(0, 5);

      // Métricas de performance
      const avgRevenuePerDoctor = doctorsData.length > 0 
        ? doctorsData.reduce((sum, doc) => sum + doc.revenue, 0) / doctorsData.length 
        : 0;

      const avgProceduresPerDoctor = doctorsData.length > 0 
        ? doctorsData.reduce((sum, doc) => sum + doc.procedureCount, 0) / doctorsData.length 
        : 0;

      const avgApprovalRate = doctorsData.length > 0 
        ? doctorsData.reduce((sum, doc) => sum + doc.approvalRate, 0) / doctorsData.length 
        : 0;

      // Dados de tendência (simulados - em produção, usar dados históricos)
      const monthlyRevenue = Array.from({ length: 12 }, (_, i) => ({
        month: new Date(2024, i).toLocaleDateString('pt-BR', { month: 'short' }),
        revenue: Math.random() * 100000 + 50000
      }));

      const monthlyProcedures = Array.from({ length: 12 }, (_, i) => ({
        month: new Date(2024, i).toLocaleDateString('pt-BR', { month: 'short' }),
        procedures: Math.floor(Math.random() * 500 + 200)
      }));

      const specialtyGrowth = specialtiesData.slice(0, 5).map(spec => ({
        specialty: spec.name,
        growth: Math.random() * 20 - 5 // -5% a +15%
      }));

      return {
        period: filters?.dateRange || {
          startDate: new Date(new Date().getFullYear(), 0, 1),
          endDate: new Date()
        },
        totalDoctors: doctorsData.length,
        specialtyDistribution,
        hospitalDistribution,
        performanceMetrics: {
          topPerformers,
          avgRevenuePerDoctor,
          avgProceduresPerDoctor,
          avgApprovalRate
        },
        trends: {
          monthlyRevenue,
          monthlyProcedures,
          specialtyGrowth
        }
      };
    } catch (error) {
      console.error('Erro ao buscar análise médica:', error);
      throw error;
    }
  }

  // ===== MÉTODOS DE PERFORMANCE =====

  /**
   * Busca métricas de performance de um médico específico
   */
  static async getDoctorPerformance(doctorId: string, period: DateRange): Promise<DoctorPerformanceMetrics> {
    try {
      console.log('📈 [MOCK] Carregando performance do médico:', doctorId);
      await new Promise(resolve => setTimeout(resolve, 400));

      // Mock data para performance específica
      return {
        doctorId,
        period,
        totalProcedures: 45 + Math.floor(Math.random() * 20),
        totalRevenue: 65000 + Math.floor(Math.random() * 30000),
        avgProcedureValue: 1500 + Math.floor(Math.random() * 500),
        approvalRate: 85 + Math.random() * 10,
        rejectionRate: 5 + Math.random() * 5,
        avgProcessingTime: 2 + Math.random() * 2,
        specialtyRanking: Math.floor(Math.random() * 5) + 1,
        hospitalRanking: Math.floor(Math.random() * 10) + 1,
        trendData: Array.from({ length: 6 }, (_, i) => ({
          month: new Date(2024, i + 6).toLocaleDateString('pt-BR', { month: 'short' }),
          procedures: 20 + Math.floor(Math.random() * 15),
          revenue: 25000 + Math.floor(Math.random() * 15000),
          approvalRate: 85 + Math.random() * 10
        }))
      };
    } catch (error) {
      console.error('Erro inesperado ao buscar performance do médico:', error);
      throw error;
    }
  }

  /**
   * Busca dados completos para o dashboard médico
   */
  static async getMedicalDashboardData(filters?: MedicalFilters): Promise<MedicalDashboardData> {
    try {
      console.log('🎯 [MOCK] Carregando dados completos do dashboard médico...');
      await new Promise(resolve => setTimeout(resolve, 600));

      // Buscar dados em paralelo
      const [kpis, analytics] = await Promise.all([
        this.getMedicalKPIs(filters),
        this.getMedicalAnalytics(filters)
      ]);

      // Simular atividades recentes
      const recentActivities = [
        {
          doctorId: '1',
          doctorName: 'Dr. Carlos Eduardo Silva',
          action: 'PROCEDURE_APPROVED',
          description: 'Aprovou 3 procedimentos cardiovasculares',
          timestamp: new Date(Date.now() - 1000 * 60 * 15).toISOString()
        },
        {
          doctorId: '2',
          doctorName: 'Dra. Maria Santos Oliveira',
          action: 'HIGH_PERFORMANCE',
          description: 'Atingiu 96% de taxa de aprovação este mês',
          timestamp: new Date(Date.now() - 1000 * 60 * 45).toISOString()
        },
        {
          doctorId: '3',
          doctorName: 'Dr. João Pedro Costa',
          action: 'NEW_RECORD',
          description: 'Novo recorde pessoal: 25 procedimentos aprovados',
          timestamp: new Date(Date.now() - 1000 * 60 * 90).toISOString()
        },
        {
          doctorId: '5',
          doctorName: 'Dr. Roberto Almeida',
          action: 'SPECIALTY_UPDATE',
          description: 'Adicionou subespecialidade em Cirurgia Robótica',
          timestamp: new Date(Date.now() - 1000 * 60 * 60 * 2).toISOString()
        }
      ];

      // Simular alertas
      const alerts = [
        {
          id: '1',
          type: 'warning' as const,
          title: 'Taxa de Aprovação Abaixo da Meta',
          message: 'Dr. Marcos Vinícius está com 82% de aprovação (meta: 90%)',
          doctorId: '7',
          timestamp: new Date(Date.now() - 1000 * 60 * 60 * 1).toISOString()
        },
        {
          id: '2',
          type: 'info' as const,
          title: 'Recorde de Faturamento',
          message: 'Especialidade de Cirurgia Geral atingiu R$ 95.000 este mês',
          timestamp: new Date(Date.now() - 1000 * 60 * 60 * 4).toISOString()
        },
        {
          id: '3',
          type: 'info' as const,
          title: 'Novo Médico Cadastrado',
          message: 'Dra. Patricia Souza foi adicionada à equipe de Dermatologia',
          doctorId: '8',
          timestamp: new Date(Date.now() - 1000 * 60 * 60 * 8).toISOString()
        }
      ];

      return {
        kpis,
        analytics,
        recentActivities,
        alerts
      };
    } catch (error) {
      console.error('Erro ao buscar dados do dashboard médico:', error);
      throw error;
    }
  }

  // ===== MÉTODOS UTILITÁRIOS =====

  /**
   * Busca médicos com filtros avançados
   */
  static async searchDoctors(searchTerm: string, filters?: MedicalFilters): Promise<MedicalDoctor[]> {
    try {
      console.log('🔍 [MOCK] Buscando médicos com termo:', searchTerm);
      await new Promise(resolve => setTimeout(resolve, 300));

      let results = [...MOCK_DOCTORS];

      // Aplicar busca por texto
      if (searchTerm) {
        const searchLower = searchTerm.toLowerCase();
        results = results.filter(doctor => 
          doctor.name.toLowerCase().includes(searchLower) ||
          doctor.crm.toLowerCase().includes(searchLower) ||
          doctor.speciality.toLowerCase().includes(searchLower)
        );
      }

      // Aplicar filtros adicionais
      if (filters?.hospitalIds && filters.hospitalIds.length > 0) {
        results = results.filter(doctor => filters.hospitalIds!.includes(doctor.hospitalId));
      }

      if (filters?.specialties && filters.specialties.length > 0) {
        results = results.filter(doctor => filters.specialties!.includes(doctor.speciality));
      }

      return results.slice(0, 50); // Limitar resultados
    } catch (error) {
      console.error('Erro inesperado ao buscar médicos:', error);
      return [];
    }
  }

  /**
   * Calcula estatísticas de comparação entre períodos
   */
  static async getComparativeStats(currentPeriod: DateRange, previousPeriod: DateRange): Promise<{
    current: MedicalKPIData;
    previous: MedicalKPIData;
    growth: {
      totalDoctors: number;
      totalRevenue: number;
      avgApprovalRate: number;
    };
  }> {
    try {
      console.log('📊 [MOCK] Calculando estatísticas comparativas...');
      await new Promise(resolve => setTimeout(resolve, 400));

      // Buscar dados dos dois períodos
      const [currentData, previousData] = await Promise.all([
        this.getMedicalKPIs({ dateRange: currentPeriod }),
        this.getMedicalKPIs({ dateRange: previousPeriod })
      ]);

      // Simular dados do período anterior (ligeiramente menores)
      const mockPreviousData = {
        ...previousData,
        totalDoctors: Math.max(1, previousData.totalDoctors - 1),
        totalRevenue: previousData.totalRevenue * 0.85,
        avgApprovalRate: Math.max(75, previousData.avgApprovalRate - 3)
      };

      // Calcular crescimento
      const growth = {
        totalDoctors: currentData.totalDoctors - mockPreviousData.totalDoctors,
        totalRevenue: mockPreviousData.totalRevenue > 0 
          ? ((currentData.totalRevenue - mockPreviousData.totalRevenue) / mockPreviousData.totalRevenue) * 100
          : 0,
        avgApprovalRate: currentData.avgApprovalRate - mockPreviousData.avgApprovalRate
      };

      return {
        current: currentData,
        previous: mockPreviousData,
        growth
      };
    } catch (error) {
      console.error('Erro ao calcular estatísticas comparativas:', error);
      throw error;
    }
  }

  // ===== MÉTODOS REAIS (NOVO) =====
  
  /**
   * Busca dados médicos reais do banco
   */
  static async getRealMedicalData(filters?: MedicalFilters): Promise<MedicalAnalytics> {
    try {
      console.log('🩺 [REAL] Buscando dados médicos reais do banco...');
      
      const [doctorsResult, specialtiesResult, hospitalStatsResult, doctorStatsResult] = await Promise.all([
        DoctorsCrudService.getAllDoctors(filters),
        DoctorsCrudService.getMedicalSpecialties(),
        DoctorsCrudService.getHospitalMedicalStats(),
        DoctorsCrudService.getDoctorStats(filters)
      ]);

      return {
        doctors: doctorsResult.data || [],
        specialties: specialtiesResult.data || [],
        hospitalStats: hospitalStatsResult.data || [],
        doctorStats: doctorStatsResult.data || [],
        kpis: {
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
        },
        recentActivities: [
          {
            id: 'real-1',
            type: 'info',
            title: 'Dados Reais Carregados',
            description: `${doctorsResult.data?.length || 0} médicos encontrados no banco`,
            timestamp: new Date(),
            icon: '🩺'
          }
        ],
        alerts: doctorsResult.data?.length === 0 ? [
          {
            id: 'real-empty',
            type: 'warning',
            title: 'Nenhum médico encontrado',
            description: 'Não há médicos cadastrados no banco de dados',
            timestamp: new Date(),
            priority: 'medium'
          }
        ] : [],
        performanceMetrics: {
          avgProcessingTime: 2.5,
          avgConfidenceScore: 95.0,
          topPerformers: doctorStatsResult.data?.slice(0, 3) || []
        }
      };
    } catch (error) {
      console.error('❌ Erro ao buscar dados médicos reais:', error);
      throw error;
    }
  }

  /**
   * Busca KPIs médicos reais
   */
  static async getRealMedicalKPIs(filters?: MedicalFilters): Promise<MedicalKPIData> {
    try {
      const analytics = await this.getRealMedicalData(filters);
      return analytics.kpis;
    } catch (error) {
      console.error('❌ Erro ao buscar KPIs médicos reais:', error);
      // Fallback para dados mock
      return this.getMedicalKPIs(filters);
    }
  }

  /**
   * Método principal que tenta dados reais primeiro
   */
  static async getMedicalAnalyticsWithFallback(filters?: MedicalFilters): Promise<MedicalAnalytics> {
    try {
      // Tentar dados reais primeiro
      return await this.getRealMedicalData(filters);
    } catch (error) {
      console.warn('⚠️ Dados reais não disponíveis, usando mock:', error);
      // Fallback para dados mock
      return this.getMedicalAnalytics(filters);
    }
  }
}

// Exportar como default
export default DoctorsAnalyticsService; 
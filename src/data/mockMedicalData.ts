import { 
  MedicalDoctor, 
  MedicalSpecialty, 
  DoctorStats, 
  HospitalMedicalStats 
} from '../types';

// ===== DADOS MOCK PARA SISTEMA MÉDICO =====

export const MOCK_DOCTORS: MedicalDoctor[] = [
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
  },
  {
    id: '9',
    cns: '901234567890123',
    crm: 'SP-901234',
    name: 'Dr. André Santos',
    speciality: 'Oftalmologia',
    hospitalId: 'hosp-001',
    hospitalName: 'Hospital São Paulo',
    isActive: true,
    createdAt: '2024-09-15',
    updatedAt: '2024-12-20'
  },
  {
    id: '10',
    cns: '012345678901234',
    crm: 'SP-012345',
    name: 'Dra. Camila Ribeiro',
    speciality: 'Endocrinologia',
    hospitalId: 'hosp-002',
    hospitalName: 'Hospital Central',
    isActive: true,
    createdAt: '2024-10-01',
    updatedAt: '2024-12-20'
  }
];

export const MOCK_SPECIALTIES: MedicalSpecialty[] = [
  { 
    id: '1', 
    name: 'Cardiologia', 
    code: 'CARD', 
    description: 'Especialidade do coração e sistema cardiovascular', 
    doctorCount: 1, 
    averageRevenue: 85000, 
    totalProcedures: 156 
  },
  { 
    id: '2', 
    name: 'Neurologia', 
    code: 'NEURO', 
    description: 'Especialidade do sistema nervoso', 
    doctorCount: 1, 
    averageRevenue: 92000, 
    totalProcedures: 89 
  },
  { 
    id: '3', 
    name: 'Ortopedia', 
    code: 'ORTO', 
    description: 'Especialidade do sistema musculoesquelético', 
    doctorCount: 1, 
    averageRevenue: 78000, 
    totalProcedures: 134 
  },
  { 
    id: '4', 
    name: 'Pediatria', 
    code: 'PED', 
    description: 'Especialidade médica infantil', 
    doctorCount: 1, 
    averageRevenue: 65000, 
    totalProcedures: 98 
  },
  { 
    id: '5', 
    name: 'Cirurgia Geral', 
    code: 'CG', 
    description: 'Cirurgia geral e procedimentos cirúrgicos', 
    doctorCount: 1, 
    averageRevenue: 95000, 
    totalProcedures: 67 
  },
  { 
    id: '6', 
    name: 'Ginecologia', 
    code: 'GINE', 
    description: 'Especialidade da saúde feminina', 
    doctorCount: 1, 
    averageRevenue: 72000, 
    totalProcedures: 112 
  },
  { 
    id: '7', 
    name: 'Urologia', 
    code: 'URO', 
    description: 'Especialidade do sistema urinário', 
    doctorCount: 1, 
    averageRevenue: 80000, 
    totalProcedures: 78 
  },
  { 
    id: '8', 
    name: 'Dermatologia', 
    code: 'DERMA', 
    description: 'Especialidade da pele e anexos', 
    doctorCount: 1, 
    averageRevenue: 58000, 
    totalProcedures: 145 
  },
  { 
    id: '9', 
    name: 'Oftalmologia', 
    code: 'OFTAL', 
    description: 'Especialidade dos olhos e visão', 
    doctorCount: 1, 
    averageRevenue: 70000, 
    totalProcedures: 92 
  },
  { 
    id: '10', 
    name: 'Endocrinologia', 
    code: 'ENDO', 
    description: 'Especialidade do sistema endócrino', 
    doctorCount: 1, 
    averageRevenue: 76000, 
    totalProcedures: 87 
  }
];

export const MOCK_DOCTOR_STATS: DoctorStats[] = MOCK_DOCTORS.map((doctor, index) => ({
  id: doctor.id,
  name: doctor.name,
  crm: doctor.crm,
  cns: doctor.cns,
  speciality: doctor.speciality,
  hospitalId: doctor.hospitalId,
  hospitalName: doctor.hospitalName,
  aihCount: 15 + (index * 6),
  procedureCount: 45 + (index * 8),
  revenue: 50000 + (index * 12000),
  avgConfidenceScore: 85 + (index * 1.2),
  avgProcessingTime: 2.5 + (index * 0.3),
  approvalRate: 88 + (index * 1.1),
  lastActivity: new Date(Date.now() - (index * 24 * 60 * 60 * 1000)).toISOString(),
  isActive: true
}));

export const MOCK_HOSPITAL_STATS: HospitalMedicalStats[] = [
  {
    hospitalId: 'hosp-001',
    hospitalName: 'Hospital São Paulo',
    totalDoctors: 5,
    specialties: ['Cardiologia', 'Neurologia', 'Pediatria', 'Urologia', 'Oftalmologia'],
    totalRevenue: 392000,
    totalProcedures: 480,
    avgApprovalRate: 91.2,
    avgProcessingTime: 3.2,
    doctorDistribution: [
      { specialty: 'Cardiologia', count: 1, percentage: 20 },
      { specialty: 'Neurologia', count: 1, percentage: 20 },
      { specialty: 'Pediatria', count: 1, percentage: 20 },
      { specialty: 'Urologia', count: 1, percentage: 20 },
      { specialty: 'Oftalmologia', count: 1, percentage: 20 }
    ]
  },
  {
    hospitalId: 'hosp-002',
    hospitalName: 'Hospital Central',
    totalDoctors: 3,
    specialties: ['Ortopedia', 'Ginecologia', 'Endocrinologia'],
    totalRevenue: 226000,
    totalProcedures: 333,
    avgApprovalRate: 89.8,
    avgProcessingTime: 3.8,
    doctorDistribution: [
      { specialty: 'Ortopedia', count: 1, percentage: 33.3 },
      { specialty: 'Ginecologia', count: 1, percentage: 33.3 },
      { specialty: 'Endocrinologia', count: 1, percentage: 33.3 }
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

// Função para simular delay de rede
export const simulateNetworkDelay = (min = 200, max = 800): Promise<void> => {
  const delay = Math.random() * (max - min) + min;
  return new Promise(resolve => setTimeout(resolve, delay));
};

// Função para gerar dados de atividade recente
export const generateRecentActivities = () => [
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

// Função para gerar alertas
export const generateAlerts = () => [
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

// Função para filtrar médicos
export const filterDoctors = (doctors: MedicalDoctor[], searchTerm?: string, hospitalIds?: string[], specialties?: string[]): MedicalDoctor[] => {
  let filtered = [...doctors];

  if (searchTerm) {
    const search = searchTerm.toLowerCase();
    filtered = filtered.filter(doctor => 
      doctor.name.toLowerCase().includes(search) ||
      doctor.crm.toLowerCase().includes(search) ||
      doctor.speciality.toLowerCase().includes(search)
    );
  }

  if (hospitalIds && hospitalIds.length > 0) {
    filtered = filtered.filter(doctor => hospitalIds.includes(doctor.hospitalId));
  }

  if (specialties && specialties.length > 0) {
    filtered = filtered.filter(doctor => specialties.includes(doctor.speciality));
  }

  return filtered;
};

// Função para filtrar estatísticas de médicos
export const filterDoctorStats = (stats: DoctorStats[], searchTerm?: string, hospitalIds?: string[], specialties?: string[], minApprovalRate?: number, minRevenue?: number): DoctorStats[] => {
  let filtered = [...stats];

  if (searchTerm) {
    const search = searchTerm.toLowerCase();
    filtered = filtered.filter(stat => 
      stat.name.toLowerCase().includes(search) ||
      stat.crm.toLowerCase().includes(search) ||
      stat.speciality.toLowerCase().includes(search)
    );
  }

  if (hospitalIds && hospitalIds.length > 0) {
    filtered = filtered.filter(stat => hospitalIds.includes(stat.hospitalId));
  }

  if (specialties && specialties.length > 0) {
    filtered = filtered.filter(stat => specialties.includes(stat.speciality));
  }

  if (minApprovalRate !== undefined) {
    filtered = filtered.filter(stat => stat.approvalRate >= minApprovalRate);
  }

  if (minRevenue !== undefined) {
    filtered = filtered.filter(stat => stat.revenue >= minRevenue);
  }

  return filtered.sort((a, b) => b.revenue - a.revenue);
}; 

import { Patient, SigtapProcedure, ProcedureRecord, DashboardStats } from '../types';

export const mockPatients: Patient[] = [
  {
    id: '1',
    name: 'Maria Silva Santos',
    cns: '123456789012345',
    birthDate: '1985-03-15',
    gender: 'F',
    address: 'Rua das Flores, 123',
    city: 'São Paulo',
    state: 'SP',
    zipCode: '01234-567',
    phone: '(11) 99999-9999',
    createdAt: '2024-01-15T10:00:00Z'
  },
  {
    id: '2',
    name: 'João Carlos Oliveira',
    cns: '987654321098765',
    birthDate: '1978-08-22',
    gender: 'M',
    address: 'Av. Principal, 456',
    city: 'Rio de Janeiro',
    state: 'RJ',
    zipCode: '20000-000',
    phone: '(21) 88888-8888',
    createdAt: '2024-01-20T14:30:00Z'
  }
];

export const mockSigtapProcedures: SigtapProcedure[] = [
  {
    code: '0301010013',
    description: 'CONSULTA MÉDICA EM ATENÇÃO BÁSICA',
    valueAmb: 15.50,
    valueHosp: 0,
    valueProf: 12.40,
    complexity: 'Baixa',
    financing: 'Piso de Atenção Básica'
  },
  {
    code: '0301010021',
    description: 'CONSULTA MÉDICA EM ATENÇÃO ESPECIALIZADA',
    valueAmb: 35.70,
    valueHosp: 0,
    valueProf: 28.56,
    complexity: 'Média',
    financing: 'Média e Alta Complexidade'
  },
  {
    code: '0211060021',
    description: 'RADIOGRAFIA DO TÓRAX (PA E PERFIL)',
    valueAmb: 8.90,
    valueHosp: 8.90,
    valueProf: 4.45,
    complexity: 'Baixa',
    financing: 'Média e Alta Complexidade'
  },
  {
    code: '0202030080',
    description: 'ELETROCARDIOGRAMA',
    valueAmb: 4.20,
    valueHosp: 4.20,
    valueProf: 2.10,
    complexity: 'Baixa',
    financing: 'Média e Alta Complexidade'
  },
  {
    code: '0301080011',
    description: 'CONSULTA MÉDICA DE URGÊNCIA',
    valueAmb: 18.30,
    valueHosp: 18.30,
    valueProf: 14.64,
    complexity: 'Média',
    financing: 'Média e Alta Complexidade'
  }
];

export const mockProcedureRecords: ProcedureRecord[] = [
  {
    id: '1',
    patientId: '1',
    procedureCode: '0301010013',
    procedureDescription: 'CONSULTA MÉDICA EM ATENÇÃO BÁSICA',
    value: 15.50,
    date: '2024-06-20T09:00:00Z',
    professional: 'Dr. Carlos Medeiros',
    createdAt: '2024-06-20T09:00:00Z'
  },
  {
    id: '2',
    patientId: '2',
    procedureCode: '0202030080',
    procedureDescription: 'ELETROCARDIOGRAMA',
    value: 4.20,
    date: '2024-06-21T14:30:00Z',
    professional: 'Dr. Ana Cardoso',
    createdAt: '2024-06-21T14:30:00Z'
  }
];

export const mockDashboardStats: DashboardStats = {
  totalPatients: 248,
  totalProcedures: 1435,
  monthlyRevenue: 45678.90,
  pendingBilling: 12
};

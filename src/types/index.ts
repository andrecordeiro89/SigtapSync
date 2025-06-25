
export interface Patient {
  id: string;
  name: string;
  cns: string;
  birthDate: string;
  gender: 'M' | 'F';
  address: string;
  city: string;
  state: string;
  zipCode: string;
  phone?: string;
  createdAt: string;
}

export interface SigtapProcedure {
  code: string;
  description: string;
  valueAmb: number;
  valueHosp: number;
  valueProf: number;
  complexity: string;
  financing: string;
}

export interface ProcedureRecord {
  id: string;
  patientId: string;
  procedureCode: string;
  procedureDescription: string;
  value: number;
  date: string;
  professional: string;
  createdAt: string;
}

export interface DashboardStats {
  totalPatients: number;
  totalProcedures: number;
  monthlyRevenue: number;
  pendingBilling: number;
}

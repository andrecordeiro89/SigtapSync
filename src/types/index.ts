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
  complexity: string;
  modality: string;
  registrationInstrument: string;
  financing: string;
  valueAmb: number;
  valueAmbTotal: number;
  valueHosp: number;
  valueProf: number;
  valueHospTotal: number;
  complementaryAttribute: string;
  gender: string;
  minAge: number;
  minAgeUnit: string;
  maxAge: number;
  maxAgeUnit: string;
  maxQuantity: number;
  averageStay: number;
  points: number;
  cbo: string;
  cid: string;
  habilitation: string;
  habilitationGroup: string[];
  serviceClassification: string;
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

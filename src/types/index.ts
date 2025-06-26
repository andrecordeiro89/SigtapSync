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
  id?: string;
  code: string;
  description: string;
  origem: string;
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
  cbo: string[];
  cid: string[];
  habilitation: string;
  habilitationGroup: string[];
  serviceClassification: string;
  especialidadeLeito: string;
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

// === INTERFACES AIH ===

export interface AIHProfessional {
  documento: string;
  cbo: string;
  participacao: string;
  cnes: string;
}

export interface AIHProcedureRealized {
  linha: number;
  codigo: string;
  descricao: string;
  profissionais: AIHProfessional[];
  quantidade: number;
  dataRealizacao: string;
  apagarValor?: boolean;
}

export interface AIH {
  id?: string;
  hospitalId?: string;
  
  // Apresentação da AIH
  numeroAIH: string;
  situacao: string;
  tipo: string;
  dataAutorizacao: string;
  apresentacao?: string;
  
  // Dados da AIH
  dataInicio: string;
  dataFim: string;
  motivoEncerramento: string;
  cnsAutorizador: string;
  cnsSolicitante: string;
  cnsResponsavel: string;
  aihAnterior?: string;
  aihPosterior?: string;
  
  // Identificação do paciente
  prontuario: string;
  nomePaciente: string;
  nascimento: string;
  sexo: 'M' | 'F';
  nacionalidade: string;
  tipoDocumento?: string;
  documento?: string;
  nomeResponsavel?: string;
  nomeMae?: string;
  endereco?: string;
  numero?: string;
  complemento?: string;
  bairro?: string;
  municipio?: string;
  uf?: string;
  cep?: string;
  telefone?: string;
  
  // Dados da internação
  procedimentoSolicitado: string;
  mudancaProc: boolean;
  procedimentoPrincipal: string;
  cidPrincipal: string;
  especialidade: string;
  modalidade: string;
  caracterAtendimento: string;
  
  // Procedimentos realizados
  procedimentosRealizados: AIHProcedureRealized[];
  
  // OPMs (Órteses, Próteses e Materiais)
  opms?: any[];
  
  // Metadados
  createdAt?: string;
  updatedAt?: string;
  processedAt?: string;
  status?: 'pending' | 'processing' | 'matched' | 'error' | 'approved' | 'rejected';
}

export interface AIHMatch {
  id?: string;
  aihId: string;
  procedureId: string;
  matchType: 'exact' | 'partial' | 'manual';
  confidenceScore: number;
  validationResults: {
    genderMatch: boolean;
    ageMatch: boolean;
    cidMatch: boolean;
    valueMatch: boolean;
  };
  observations?: string;
  status: 'pending' | 'approved' | 'rejected';
  reviewedBy?: string;
  reviewedAt?: string;
  createdAt?: string;
}

export interface AIHProcessingResult {
  success: boolean;
  totalProcessed: number;
  validAIHs: number;
  invalidAIHs: number;
  matches: AIHMatch[];
  errors: Array<{
    line: number;
    field: string;
    message: string;
    value?: any;
  }>;
  processingTime: number;
}

export interface AIHUploadStats {
  totalUploaded: number;
  pendingMatches: number;
  approvedMatches: number;
  rejectedMatches: number;
  totalValue: number;
  avgConfidenceScore: number;
}

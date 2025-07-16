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
  aihAnterior: string;
  aihPosterior: string;
  
  // Identificação do paciente
  prontuario: string;
  nomePaciente: string;
  cns: string;
  nascimento: string;
  sexo: string;
  nacionalidade: string;
  racaCor: string;
  tipoDocumento: string;
  documento: string;
  nomeResponsavel: string;
  nomeMae: string;
  endereco: string;
  numero: string;
  complemento: string;
  bairro: string;
  municipio: string;
  uf: string;
  cep: string;
  telefone: string;
  
  // Dados da internação
  procedimentoSolicitado: string;
  mudancaProc: boolean;
  procedimentoPrincipal: string;
  cidPrincipal: string;
  especialidade: string;
  modalidade: string;
  caracterAtendimento: string;
  
  // Dados específicos de faturamento SUS
  utiDias?: number;                    // Dias em UTI
  atosMedicos?: string;                // Atos médicos realizados
  permanenciaDias?: number;            // Dias de permanência total
  complexidadeEspecifica?: string;     // Complexidade específica do procedimento
  procedimentoSequencial?: boolean;    // Se é procedimento sequencial
  procedimentoEspecial?: boolean;      // Se é procedimento especial
  valorDiaria?: number;                // Valor da diária
  observacoesFaturamento?: string;     // Observações específicas para faturamento
  
  // Procedimentos realizados
  procedimentosRealizados: AIHProcedureRealized[];
  
  // OPMs (Órteses, Próteses e Materiais)
  opms?: any[];
  
  // Estimativa de valor original da AIH
  estimatedOriginalValue?: number; // em centavos
  
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
  hospitalId?: string;
  hospitalName?: string;
  extractedAIH?: AIH; // AIH extraída para persistência
  persistenceResult?: {
    success: boolean;
    aihId?: string;
    patientId?: string;
    message: string;
    errors?: string[];
  };
}

export interface AIHUploadStats {
  totalUploaded: number;
  pendingMatches: number;
  approvedMatches: number;
  rejectedMatches: number;
  totalValue: number;
  avgConfidenceScore: number;
}

// ================================================
// NOVOS TIPOS PARA ESTRUTURA REAL SUPABASE
// ================================================

// Matching avançado AIH x SIGTAP
export interface AIHMatchDB {
  id: string;
  aih_id: string;
  procedure_id: string;
  gender_valid: boolean;
  age_valid: boolean;
  cid_valid: boolean;
  habilitation_valid: boolean;
  cbo_valid: boolean;
  overall_score: number;
  calculated_value_amb: number; // em centavos
  calculated_value_hosp: number; // em centavos
  calculated_value_prof: number; // em centavos
  calculated_total: number; // em centavos
  validation_details: any; // jsonb
  match_confidence: number;
  match_method: string;
  reviewed_by?: string;
  reviewed_at?: string;
  status: string;
  approval_notes?: string;
  created_at: string;
}

// Registro de procedimentos realizados
export interface ProcedureRecordDB {
  id: string;
  hospital_id: string;
  patient_id: string;
  procedure_id: string;
  aih_id?: string;
  aih_match_id?: string;
  procedure_date: string;
  value_charged: number; // em centavos
  professional?: string;
  professional_cbo?: string;
  billing_status?: 'pending' | 'billed' | 'paid' | 'rejected';
  billing_date?: string;
  payment_date?: string;
  notes?: string;
  created_at: string;
  created_by?: string;
}

// Configurações do sistema
export interface SystemSettingDB {
  id: string;
  hospital_id?: string;
  setting_key: string;
  setting_value: any; // jsonb
  setting_type: 'string' | 'number' | 'boolean' | 'object' | 'array';
  description?: string;
  is_public: boolean;
  created_at: string;
  updated_at: string;
  updated_by?: string;
}

// Logs de auditoria
export interface AuditLogDB {
  id: string;
  table_name: string;
  record_id: string;
  action: 'INSERT' | 'UPDATE' | 'DELETE';
  old_values?: any; // jsonb
  new_values?: any; // jsonb
  changed_fields: string[];
  user_id?: string;
  hospital_id?: string;
  ip_address?: string;
  user_agent?: string;
  operation_type?: string;
  session_id?: string;
  created_at: string;
}

// Acesso de usuários aos hospitais
export interface UserHospitalAccessDB {
  id: string;
  user_id: string;
  hospital_id: string;
  role: 'admin' | 'manager' | 'operator' | 'viewer';
  created_at: string;
  created_by?: string;
}

// Estatísticas avançadas do dashboard
export interface DashboardStatsAdvanced extends DashboardStats {
  // Estatísticas financeiras
  totalRevenue: number;
  averageTicket: number;
  monthlyGrowth: number;
  
  // Estatísticas de matching
  totalMatches: number;
  successRate: number;
  pendingReview: number;
  
  // Estatísticas de performance
  avgProcessingTime: number;
  systemUptime: number;
}

// Relatório de análise AIH
export interface AIHAnalysisReport {
  aihId: string;
  matches: AIHMatchDB[];
  recommendations: {
    bestMatch?: AIHMatchDB;
    alternativeMatches: AIHMatchDB[];
    issues: string[];
    suggestedActions: string[];
  };
  financialImpact: {
    originalValue: number;
    suggestedValue: number;
    difference: number;
    percentageChange: number;
  };
  validationSummary: {
    totalChecks: number;
    passedChecks: number;
    failedChecks: string[];
    warningChecks: string[];
  };
}

// Procedimento individual da segunda página da AIH
export interface ProcedureAIH {
  sequencia: number;
  procedimento: string;
  documentoProfissional: string;
  cbo: string;
  participacao: string;
  cnes: string;
  aceitar: boolean;
  data: string;
  descricao?: string;
  procedure_description?: string; // ✅ Campo usado quando dados vem do banco de dados
  
  // Campos do matching
  matchStatus: 'pending' | 'matched' | 'manual' | 'rejected' | 'approved';
  matchConfidence?: number;
  sigtapProcedure?: SigtapProcedure;
  valorCalculado?: number;
  valorOriginal?: number;
  observacoes?: string;
  
  // 🆕 NOVO: Campo quantidade para multiplicação de valores
  quantity?: number; // Quantidade do procedimento (padrão: 1)
  valorUnitario?: number; // Valor unitário para referência
  
  // Lógica de porcentagem SUS
  porcentagemSUS?: number; // Porcentagem a ser aplicada no valor (padrão: 100% para principal, 70% para secundários)
  
  // Campos para regras especiais de cirurgias múltiplas e sequenciais
  isSpecialRule?: boolean;           // Se aplica regra especial
  regraEspecial?: string;            // Nome da regra aplicada
  valorCalculadoSH?: number;         // Valor SH calculado com percentual especial
  valorCalculadoSP?: number;         // Valor SP (sempre 100%)
  valorCalculadoSA?: number;         // Valor SA (sempre 100%)
  
  // ✅ NOVO: Campos para Instrumento 04 - AIH (Proc. Especial)
  isInstrument04?: boolean;          // Se é procedimento do Instrumento 04 - AIH (Proc. Especial)
  instrument04Rule?: string;         // Descrição da regra do Instrumento 04
  
  // ✅ NOVO: Marcação visual para anestesistas
  isAnesthesiaProcedure?: boolean;   // Se é procedimento de anestesia (marcação visual)
  
  // Auditoria
  revisadoPor?: string;
  dataRevisao?: string;
  aprovado?: boolean;
}

// AIH expandida com procedimentos
export interface AIHComplete extends AIH {
  procedimentos: ProcedureAIH[];
  valorTotalCalculado?: number;
  valorTotalOriginal?: number;
  statusGeral: 'processando' | 'aguardando_revisao' | 'aprovada' | 'rejeitada';
  totalProcedimentos: number;
  procedimentosAprovados: number;
  procedimentosRejeitados: number;
}

// Resultado do matching de procedimentos
export interface ProcedureMatchingResult {
  success: boolean;
  totalProcedimentos: number;
  procedimentosEncontrados: number;
  procedimentosNaoEncontrados: number;
  valorTotalCalculado: number;
  matchingDetails: Array<{
    codigo: string;
    encontrado: boolean;
    confidence: number;
    sigtapMatch?: SigtapProcedure;
    erro?: string;
  }>;
  tempoProcessamento: number;
}

// Resultado completo do processamento PDF com procedimentos
export interface AIHCompleteProcessingResult extends AIHProcessingResult {
  aihCompleta?: AIHComplete;
  procedureMatchingResult?: ProcedureMatchingResult;
}

// === INTERFACES MÉDICAS ===

export interface MedicalDoctor {
  id: string;
  cns: string;
  crm: string;
  name: string;
  speciality: string;
  hospitalId: string;
  hospitalName: string;
  hospitals?: string[]; // 🆕 Lista de todos os hospitais onde o médico atua
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface MedicalSpecialty {
  id: string;
  name: string;
  code: string;
  description?: string;
  doctorCount: number;
  averageRevenue: number;
  totalProcedures: number;
}

export interface DoctorStats {
  id: string;
  name: string;
  crm: string;
  cns: string;
  speciality: string;
  hospitalId: string;
  hospitalName: string;
  aihCount: number;
  procedureCount: number;
  revenue: number;
  avgConfidenceScore: number;
  avgProcessingTime: number;
  approvalRate: number;
  lastActivity: string;
  isActive: boolean;
}

export interface HospitalMedicalStats {
  hospitalId: string;
  hospitalName: string;
  totalDoctors: number;
  specialties: string[];
  totalRevenue: number;
  totalProcedures: number;
  avgApprovalRate: number;
  avgProcessingTime: number;
  doctorDistribution: {
    specialty: string;
    count: number;
    percentage: number;
  }[];
}

export interface MedicalKPIData {
  totalDoctors: number;
  totalSpecialties: number;
  totalHospitals: number;
  avgRevenuePerDoctor: number;
  totalRevenue: number;
  avgApprovalRate: number;
  monthlyGrowth: number;
  topSpecialty: string;
}

export interface DateRange {
  startDate: Date;
  endDate: Date;
}

export interface MedicalAnalytics {
  period: DateRange;
  totalDoctors: number;
  specialtyDistribution: {
    specialty: string;
    count: number;
    percentage: number;
    revenue: number;
  }[];
  hospitalDistribution: {
    hospitalId: string;
    hospitalName: string;
    doctorCount: number;
    revenue: number;
    procedures: number;
  }[];
  performanceMetrics: {
    topPerformers: DoctorStats[];
    avgRevenuePerDoctor: number;
    avgProceduresPerDoctor: number;
    avgApprovalRate: number;
  };
  trends: {
    monthlyRevenue: { month: string; revenue: number }[];
    monthlyProcedures: { month: string; procedures: number }[];
    specialtyGrowth: { specialty: string; growth: number }[];
  };
}

export interface MedicalFilters {
  hospitalIds?: string[];
  specialties?: string[];
  dateRange?: DateRange;
  isActive?: boolean;
  minApprovalRate?: number;
  minRevenue?: number;
  searchTerm?: string;
}

export interface DoctorPerformanceMetrics {
  doctorId: string;
  period: DateRange;
  totalProcedures: number;
  totalRevenue: number;
  avgProcedureValue: number;
  approvalRate: number;
  rejectionRate: number;
  avgProcessingTime: number;
  specialtyRanking: number;
  hospitalRanking: number;
  trendData: {
    month: string;
    procedures: number;
    revenue: number;
    approvalRate: number;
  }[];
}

export interface MedicalDashboardData {
  kpis: MedicalKPIData;
  analytics: MedicalAnalytics;
  recentActivities: {
    doctorId: string;
    doctorName: string;
    action: string;
    description: string;
    timestamp: string;
  }[];
  alerts: {
    id: string;
    type: 'warning' | 'error' | 'info';
    title: string;
    message: string;
    doctorId?: string;
    hospitalId?: string;
    timestamp: string;
  }[];
}

// === INTERFACES PARA VIEWS SUPABASE - PROFISSIONAIS ===

// View principal: doctor_hospital_info
export interface DoctorHospitalInfo {
  // Dados do Médico
  doctor_id: string;
  doctor_name: string;
  doctor_cns: string;
  doctor_crm: string;
  doctor_crm_state: string;
  doctor_specialty: string;
  doctor_secondary_specialties: string[];
  doctor_cbo_codes: string[];
  doctor_email?: string;
  doctor_phone?: string;
  doctor_mobile_phone?: string;
  doctor_is_active: boolean;
  doctor_is_sus_enabled: boolean;
  doctor_professional_status: string;
  
  // Dados do Hospital
  hospital_id: string;
  hospital_name: string;
  hospital_address?: string;
  hospital_city?: string;
  hospital_state?: string;
  hospital_zip_code?: string;
  hospital_phone?: string;
  hospital_email?: string;
  hospital_is_active: boolean;
  
  // Dados da Relação
  link_id: string;
  link_role?: string;
  link_department?: string;
  link_is_active: boolean;
  link_is_primary_hospital: boolean;
  link_start_date?: string;
  link_end_date?: string;
}

// View otimizada: frontend_doctor_hospital_speciality
export interface FrontendDoctorHospitalSpecialty {
  // Médico
  doctor_id: string;
  doctor_name: string;
  primary_specialty: string;
  secondary_specialties: string[];
  doctor_active: boolean;
  
  // Hospital
  hospital_id: string;
  hospital_name: string;
  hospital_address?: string;
  hospital_active: boolean;
  
  // Relação
  role?: string;
  department?: string;
  is_primary_hospital: boolean;
  link_active: boolean;
}

// View agregada: frontend_doctors_by_speciality
export interface FrontendDoctorsBySpecialty {
  specialty: string;
  doctor_count: number;
  doctor_names: string[];
}

// View agregada: frontend_hospitals_with_specialties
export interface FrontendHospitalsWithSpecialties {
  hospital_id: string;
  hospital_name: string;
  hospital_address?: string;
  specialties: string[];
  doctor_count: number;
}

// Interfaces para filtros da lista de profissionais
export interface ProfessionalsFilters {
  searchTerm?: string;
  hospitalId?: string;
  specialty?: string;
  status?: 'all' | 'active' | 'inactive' | 'sus_enabled';
  role?: string;
  department?: string;
  isPrimaryHospital?: boolean;
  sortBy?: 'name' | 'specialty' | 'hospital' | 'status';
  sortOrder?: 'asc' | 'desc';
}

// Interface para dados agregados da lista de profissionais
export interface ProfessionalsListData {
  doctors: DoctorHospitalInfo[];
  totalCount: number;
  filteredCount: number;
  specialties: string[];
  hospitals: { id: string; name: string }[];
  roles: string[];
  departments: string[];
}

// Interface para resultado da consulta de profissionais
export interface ProfessionalsQueryResult {
  success: boolean;
  data: ProfessionalsListData;
  error?: string;
}

// Interface para estatísticas de profissionais
export interface ProfessionalsStats {
  totalDoctors: number;
  activeDoctors: number;
  inactiveDoctors: number;
  susEnabledDoctors: number;
  totalHospitals: number;
  activeHospitals: number;
  totalSpecialties: number;
  doctorsBySpecialty: { specialty: string; count: number }[];
  doctorsByHospital: { hospitalId: string; hospitalName: string; count: number }[];
}

// Interface para detalhes expandidos de um profissional
export interface ProfessionalDetails extends DoctorHospitalInfo {
  // Estatísticas adicionais (se disponíveis)
  totalAIHs?: number;
  approvalRate?: number;
  revenue?: number;
  lastActivity?: string;
  performanceScore?: number;
  
  // Relacionamentos múltiplos
  allHospitals?: Array<{
    hospitalId: string;
    hospitalName: string;
    role?: string;
    department?: string;
    isPrimary: boolean;
    isActive: boolean;
    startDate?: string;
    endDate?: string;
  }>;
}

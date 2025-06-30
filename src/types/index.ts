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
  
  // Campos do matching
  matchStatus: 'pending' | 'matched' | 'manual' | 'rejected';
  matchConfidence?: number;
  sigtapProcedure?: SigtapProcedure;
  valorCalculado?: number;
  valorOriginal?: number;
  observacoes?: string;
  
  // Lógica de porcentagem SUS
  porcentagemSUS?: number; // Porcentagem a ser aplicada no valor (padrão: 100% para principal, 70% para secundários)
  
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

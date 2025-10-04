import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables')
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

export const centavosToReais = (centavos: number): number => centavos / 100
export const reaisToCentavos = (reais: number): number => Math.round(reais * 100)

export interface Hospital {
  id: string
  name: string
  cnpj: string
  address?: string
  city?: string
  state?: string
  zip_code?: string
  phone?: string
  email?: string
  habilitacoes: string[]
  is_active: boolean
  created_at: string
  updated_at: string
  created_by?: string
}

export interface SigtapVersion {
  id: string
  version_name: string
  import_date: string
  file_name?: string
  file_size?: number
  file_type?: string
  total_procedures: number
  total_pages?: number
  processing_time_ms?: number
  extraction_method?: string
  is_active: boolean
  import_status: string
  import_errors?: string
  created_at: string
  created_by?: string
}

export interface SigtapProcedureDB {
  id: string
  version_id: string
  code: string
  description: string
  origem?: string
  complexity?: string
  modality?: string
  registration_instrument?: string
  financing?: string
  value_amb: number
  value_amb_total: number
  value_hosp: number
  value_prof: number
  value_hosp_total: number
  complementary_attribute?: string
  service_classification?: string
  especialidade_leito?: string
  gender?: string
  min_age?: number
  min_age_unit?: string
  max_age?: number
  max_age_unit?: string
  max_quantity?: number
  average_stay?: number
  points?: number
  cbo: string[]
  cid: string[]
  habilitation?: string
  habilitation_group: string[]
  extraction_confidence: number
  validation_status: string
  validation_notes?: string
  created_at: string
}

export interface PatientDB {
  id: string
  hospital_id: string
  name: string
  cns: string
  cpf?: string
  birth_date: string
  gender: string
  address?: string
  city?: string
  state?: string
  zip_code?: string
  phone?: string
  email?: string
  blood_type?: string
  allergies?: string
  medical_notes?: string
  is_active: boolean
  
  // Campos expandidos da AIH
  medical_record?: string
  nationality?: string
  mother_name?: string
  neighborhood?: string
  responsible_name?: string
  document_type?: string
  document_number?: string
  
  created_at: string
  updated_at: string
  created_by?: string
}

export interface AIHDB {
  id: string
  hospital_id: string
  patient_id: string
  aih_number: string
  procedure_code: string
  admission_date: string
  discharge_date?: string
  estimated_discharge_date?: string
  main_cid: string
  secondary_cid: string[]
  professional_cbo?: string
  requesting_physician?: string
  original_value?: number
  processing_status: string
  match_found: boolean
  rejection_reason?: string
  requires_manual_review: boolean
  source_file?: string
  import_batch_id?: string
  
  // Campos expandidos da AIH real
  aih_situation?: string
  aih_type?: string
  authorization_date?: string
  cns_authorizer?: string
  cns_requester?: string
  cns_responsible?: string
  procedure_requested?: string
  procedure_changed?: boolean
  discharge_reason?: string
  specialty?: string
  care_modality?: string
  care_character?: string
  estimated_original_value?: number
  
  created_at: string
  updated_at?: string  // ✅ Data da última atualização
  processed_at?: string
  created_by?: string
}

export interface AIHMatch {
  id: string
  aih_id: string
  procedure_id: string
  gender_valid: boolean
  age_valid: boolean
  cid_valid: boolean
  habilitation_valid: boolean
  cbo_valid: boolean
  overall_score: number
  calculated_value_amb: number
  calculated_value_hosp: number
  calculated_value_prof: number
  calculated_total: number
  validation_details: any
  match_confidence: number
  match_method: string
  reviewed_by?: string
  reviewed_at?: string
  status: string
  approval_notes?: string
  created_at: string
}

export interface ProcedureRecordDB {
  id: string
  hospital_id: string
  patient_id: string
  procedure_id: string
  aih_id?: string
  aih_match_id?: string
  procedure_date: string
  value_charged: number
  professional?: string
  professional_cbo?: string
  billing_status?: string
  billing_date?: string
  payment_date?: string
  notes?: string
  created_at: string
  created_by?: string
}

export interface SystemSetting {
  id: string
  hospital_id?: string
  setting_key: string
  setting_value: any
  setting_type: string
  description?: string
  is_public: boolean
  created_at: string
  updated_at: string
  updated_by?: string
}

export interface UserHospitalAccess {
  id: string
  user_id: string
  hospital_id: string
  role: string
  created_at: string
  created_by?: string
}

export interface AuditLog {
  id: string
  table_name: string
  record_id: string
  action: string
  old_values?: any
  new_values?: any
  changed_fields: string[]
  user_id?: string
  hospital_id?: string
  ip_address?: string
  user_agent?: string
  operation_type?: string
  session_id?: string
  created_at: string
} 
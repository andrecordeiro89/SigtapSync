// Centralizador de exportações dos serviços Supabase
// Import direto para garantir compatibilidade
import { SigtapService as SigtapServiceClass, HospitalService, PatientService, AIHService } from './supabaseService';

// Re-exportar com nomes explícitos
export const SigtapService = SigtapServiceClass;
export { HospitalService, PatientService, AIHService };

// Re-exportar tipos importantes
export type { 
  Hospital, 
  SigtapVersion, 
  SigtapProcedureDB, 
  PatientDB, 
  AIHDB 
} from '../lib/supabase'; 
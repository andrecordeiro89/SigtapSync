import { supabase, Hospital, SigtapVersion, SigtapProcedureDB, PatientDB, AIHDB, AIHMatch, ProcedureRecordDB, SystemSetting, AuditLog, centavosToReais, reaisToCentavos } from '../lib/supabase';
import { SigtapProcedure } from '../types';

// SIGTAP SERVICE
export class SigtapService {
  static async createVersion(version: Omit<SigtapVersion, 'id' | 'created_at'>): Promise<SigtapVersion> {
    console.log('💾 Criando versão com dados:', JSON.stringify(version, null, 2));
    
    const { data, error } = await supabase
      .from('sigtap_versions')
      .insert(version)
      .select()
      .single();
    
    if (error) {
      console.error('❌ Erro ao criar versão:', error);
      console.error('❌ Dados enviados:', version);
      throw error;
    }
    
    console.log('✅ Versão criada com sucesso:', data.id);
    return data;
  }

  static async getActiveVersion(): Promise<SigtapVersion | null> {
    const { data, error } = await supabase
      .from('sigtap_versions')
      .select('*')
      .eq('is_active', true)
      .single();
    
    if (error) {
      if (error.code === 'PGRST116') return null;
      throw error;
    }
    return data;
  }

  static async setActiveVersion(versionId: string): Promise<void> {
    await supabase
      .from('sigtap_versions')
      .update({ is_active: false })
      .neq('id', '00000000-0000-0000-0000-000000000000');

    const { error } = await supabase
      .from('sigtap_versions')
      .update({ is_active: true })
      .eq('id', versionId);
    
    if (error) throw error;
  }

  static async saveProcedures(versionId: string, procedures: SigtapProcedure[]): Promise<void> {
    console.log(`💾 Preparando ${procedures.length} procedimentos para salvar...`);
    
    // Remover duplicatas por código antes de salvar
    const uniqueProcedures = procedures.reduce((acc, proc) => {
      if (!acc.some(p => p.code === proc.code)) {
        acc.push(proc);
      }
      return acc;
    }, [] as SigtapProcedure[]);
    
    console.log(`💾 ${uniqueProcedures.length} procedimentos únicos após deduplicação`);
    
    const dbProcedures = uniqueProcedures.map(proc => ({
      version_id: versionId,
      code: proc.code,
      description: proc.description,
      origem: proc.origem || null,
      complexity: proc.complexity || null,
      modality: proc.modality || null,
      registration_instrument: proc.registrationInstrument || null,
      financing: proc.financing || null,
      value_amb: reaisToCentavos(proc.valueAmb || 0),
      value_amb_total: reaisToCentavos(proc.valueAmbTotal || 0),
      value_hosp: reaisToCentavos(proc.valueHosp || 0),
      value_prof: reaisToCentavos(proc.valueProf || 0),
      value_hosp_total: reaisToCentavos(proc.valueHospTotal || 0),
      complementary_attribute: proc.complementaryAttribute || null,
      service_classification: proc.serviceClassification || null,
      especialidade_leito: proc.especialidadeLeito || null,
      gender: proc.gender && proc.gender.trim() !== '' ? proc.gender : null,
      min_age: proc.minAge && proc.minAge > 0 ? proc.minAge : null,
      min_age_unit: proc.minAgeUnit && proc.minAgeUnit.trim() !== '' ? proc.minAgeUnit : null,
      max_age: proc.maxAge && proc.maxAge > 0 ? proc.maxAge : null,
      max_age_unit: proc.maxAgeUnit && proc.maxAgeUnit.trim() !== '' ? proc.maxAgeUnit : null,
      max_quantity: proc.maxQuantity || null,
      average_stay: proc.averageStay || null,
      points: proc.points || null,
      cbo: proc.cbo || [],
      cid: proc.cid || [],
      habilitation: proc.habilitation || null,
      habilitation_group: proc.habilitationGroup || [],
      extraction_confidence: 100,
      validation_status: 'valid'
    }));

    const batchSize = 50; // Reduzir batch size para evitar timeouts
    console.log(`💾 Salvando em batches de ${batchSize}...`);
    
    for (let i = 0; i < dbProcedures.length; i += batchSize) {
      const batch = dbProcedures.slice(i, i + batchSize);
      console.log(`💾 Salvando batch ${Math.floor(i/batchSize) + 1}/${Math.ceil(dbProcedures.length/batchSize)} (${batch.length} procedimentos)`);
      
      const { error } = await supabase
        .from('sigtap_procedures')
        .insert(batch);
      
      if (error) {
        console.error(`❌ Erro no batch ${Math.floor(i/batchSize) + 1}:`, error);
        console.error('❌ Procedimentos do batch com erro:', batch.map(p => p.code).slice(0, 5));
        throw error;
      }
    }
    
    console.log('✅ Todos os procedimentos salvos com sucesso');
  }

  static async getActiveProcedures(): Promise<SigtapProcedure[]> {
    try {
      const { data, error } = await supabase
        .from('sigtap_procedures')
        .select(`
          *,
          sigtap_versions!inner (
            is_active
          )
        `)
        .eq('sigtap_versions.is_active', true)
        .order('code');
      
      if (error) throw error;
      
      return (data || []).map(proc => this.convertDbToFrontend(proc));
    } catch (error) {
      console.error('Erro ao buscar procedimentos ativos:', error);
      return [];
    }
  }

  private static convertDbToFrontend(proc: any): SigtapProcedure {
    return {
      id: proc.id,
      code: proc.code,
      description: proc.description,
      origem: proc.origem || '',
      complexity: proc.complexity || '',
      modality: proc.modality || '',
      registrationInstrument: proc.registration_instrument || '',
      financing: proc.financing || '',
      valueAmb: centavosToReais(proc.value_amb || 0),
      valueAmbTotal: centavosToReais(proc.value_amb_total || 0),
      valueHosp: centavosToReais(proc.value_hosp || 0),
      valueProf: centavosToReais(proc.value_prof || 0),
      valueHospTotal: centavosToReais(proc.value_hosp_total || 0),
      complementaryAttribute: proc.complementary_attribute || '',
      serviceClassification: proc.service_classification || '',
      especialidadeLeito: proc.especialidade_leito || '',
      gender: proc.gender || '',
      minAge: proc.min_age || 0,
      minAgeUnit: proc.min_age_unit || '',
      maxAge: proc.max_age || 0,
      maxAgeUnit: proc.max_age_unit || '',
      maxQuantity: proc.max_quantity || 0,
      averageStay: proc.average_stay || 0,
      points: proc.points || 0,
      cbo: proc.cbo || [],
      cid: proc.cid || [],
      habilitation: proc.habilitation || '',
      habilitationGroup: proc.habilitation_group || []
    };
  }
}

// HOSPITAL SERVICE
export class HospitalService {
  static async getHospitals(): Promise<Hospital[]> {
    const { data, error } = await supabase
      .from('hospitals')
      .select('*')
      .eq('is_active', true)
      .order('name');
    
    if (error) throw error;
    return data || [];
  }

  static async createHospital(hospital: Omit<Hospital, 'id' | 'created_at' | 'updated_at'>): Promise<Hospital> {
    const { data, error } = await supabase
      .from('hospitals')
      .insert(hospital)
      .select()
      .single();
    
    if (error) throw error;
    return data;
  }
}

// PATIENT SERVICE
export class PatientService {
  static async getPatients(hospitalId?: string): Promise<PatientDB[]> {
    let query = supabase
      .from('patients')
      .select('*')
      .order('created_at', { ascending: false });
    
    if (hospitalId) {
      query = query.eq('hospital_id', hospitalId);
    }
    
    const { data, error } = await query;
    
    if (error) throw error;
    return data || [];
  }

  static async createPatient(patient: Omit<PatientDB, 'id' | 'created_at' | 'updated_at'>): Promise<PatientDB> {
    const { data, error } = await supabase
      .from('patients')
      .insert(patient)
      .select()
      .single();
    
    if (error) throw error;
    return data;
  }

  static async updatePatient(id: string, patient: Partial<PatientDB>): Promise<PatientDB> {
    const { data, error } = await supabase
      .from('patients')
      .update({ ...patient, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single();
    
    if (error) throw error;
    return data;
  }
}

// AIH SERVICE
export class AIHService {
  static async getAIHs(hospitalId?: string): Promise<AIHDB[]> {
    let query = supabase
      .from('aihs')
      .select('*')
      .order('created_at', { ascending: false });
    
    if (hospitalId) {
      query = query.eq('hospital_id', hospitalId);
    }
    
    const { data, error } = await query;
    
    if (error) throw error;
    return data || [];
  }

  static async createAIH(aih: Omit<AIHDB, 'id' | 'created_at' | 'processed_at'>): Promise<AIHDB> {
    const { data, error } = await supabase
      .from('aihs')
      .insert(aih)
      .select()
      .single();
    
    if (error) throw error;
    return data;
  }

  static async updateAIHStatus(aihId: string, status: string, matchFound?: boolean): Promise<void> {
    const updates: any = { 
      processing_status: status, 
      processed_at: new Date().toISOString() 
    };
    
    if (matchFound !== undefined) {
      updates.match_found = matchFound;
    }

    const { error } = await supabase
      .from('aihs')
      .update(updates)
      .eq('id', aihId);
    
    if (error) throw error;
  }

  static async batchCreateAIHs(aihs: Omit<AIHDB, 'id' | 'created_at' | 'processed_at'>[]): Promise<AIHDB[]> {
    const { data, error } = await supabase
      .from('aihs')
      .insert(aihs)
      .select();
    
    if (error) throw error;
    return data || [];
  }
}

// AIH MATCH SERVICE
export class AIHMatchService {
  static async createMatch(match: Omit<AIHMatch, 'id' | 'created_at'>): Promise<AIHMatch> {
    const { data, error } = await supabase
      .from('aih_matches')
      .insert(match)
      .select()
      .single();
    
    if (error) throw error;
    return data;
  }

  static async getMatchesByAIH(aihId: string): Promise<AIHMatch[]> {
    const { data, error } = await supabase
      .from('aih_matches')
      .select('*')
      .eq('aih_id', aihId)
      .order('overall_score', { ascending: false });
    
    if (error) throw error;
    return data || [];
  }

  static async updateMatchStatus(matchId: string, status: string, reviewedBy?: string, notes?: string): Promise<AIHMatch> {
    const updates: any = { 
      status,
      reviewed_at: new Date().toISOString()
    };
    
    if (reviewedBy) updates.reviewed_by = reviewedBy;
    if (notes) updates.approval_notes = notes;

    const { data, error } = await supabase
      .from('aih_matches')
      .update(updates)
      .eq('id', matchId)
      .select()
      .single();
    
    if (error) throw error;
    return data;
  }

  static async getMatchesByScore(minScore: number = 70): Promise<AIHMatch[]> {
    const { data, error } = await supabase
      .from('aih_matches')
      .select('*')
      .gte('overall_score', minScore)
      .order('overall_score', { ascending: false });
    
    if (error) throw error;
    return data || [];
  }
}

// EXPORTS
export default {
  SigtapService,
  HospitalService,
  PatientService,
  AIHService,
  AIHMatchService
}; 
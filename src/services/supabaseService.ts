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
      // 🔧 CORREÇÃO PERMANENTE: SEMPRE usar tabela oficial para evitar dados corrompidos
      console.log('🔧 CORREÇÃO ATIVA: Usando EXCLUSIVAMENTE tabela oficial (dados íntegros)');
      
      const officialData = await this.getActiveProceduresFromOfficial();
      if (officialData.length > 0) {
        console.log(`✅ ${officialData.length} procedimentos carregados da tabela OFICIAL (valores corretos)`);
        return officialData;
      }
      
      console.warn('⚠️ Nenhum dado encontrado na tabela oficial');
      return [];
      
    } catch (error) {
      console.error('Erro ao buscar procedimentos ativos:', error);
      return [];
    }
  }

  static async getActiveProceduresFromOfficial(): Promise<SigtapProcedure[]> {
    try {
      console.log('🔄 Buscando TODOS os procedimentos das tabelas auxiliares oficiais...');
      
      // IMPLEMENTAÇÃO PAGINADA para carregar TODOS os 2866+ registros
      const pageSize = 1000;
      let start = 0;
      let allProcedimentos: any[] = [];
      let hasMore = true;
      
      while (hasMore) {
        console.log(`📄 Carregando página ${Math.floor(start/pageSize) + 1} (${start + 1}-${start + pageSize})...`);
        
        const { data: page, error } = await supabase
          .from('sigtap_procedimentos_oficial')
          .select(`
            codigo,
            nome,
            complexidade,
            sexo,
            quantidade_maxima,
            dias_permanencia,
            pontos,
            idade_minima,
            idade_maxima,
            valor_sh,
            valor_sa,
            valor_sp,
            codigo_financiamento,
            competencia
          `)
          .range(start, start + pageSize - 1)
          .order('codigo');
        
        if (error) {
          console.error('Erro ao buscar página:', error);
          break;
        }
        
        if (!page || page.length === 0) {
          hasMore = false;
          break;
        }
        
        allProcedimentos = allProcedimentos.concat(page);
        console.log(`✅ Página carregada: ${page.length} registros (Total: ${allProcedimentos.length})`);
        
        // Se retornou menos que pageSize, não há mais dados
        if (page.length < pageSize) {
          hasMore = false;
        } else {
          start += pageSize;
        }
        
        // Limite de segurança para evitar loops infinitos
        if (start > 10000) {
          console.warn('⚠️ Limite de segurança atingido (10k registros)');
          break;
        }
      }
      
      if (allProcedimentos.length === 0) {
        console.warn('⚠️ Nenhum procedimento encontrado nas tabelas auxiliares');
        return [];
      }
      
      console.log(`✅ TOTAL CARREGADO: ${allProcedimentos.length} procedimentos das tabelas AUXILIARES`);
      
      // Buscar dados complementares
      const { data: financiamentos } = await supabase
        .from('sigtap_financiamento')
        .select('codigo, nome');
      
      const financiamentoMap = new Map(
        (financiamentos || []).map(f => [f.codigo, f.nome])
      );
      
      // Converter dados auxiliares para formato do frontend
      const converted = allProcedimentos.map(proc => this.convertOfficialToFrontend(proc, financiamentoMap));
      
      console.log(`✅ CONVERSÃO CONCLUÍDA: ${converted.length} procedimentos prontos para uso`);
      return converted;
      
    } catch (error) {
      console.error('Erro ao buscar das tabelas auxiliares:', error);
      return [];
    }
  }

  private static convertDbToFrontend(proc: any): SigtapProcedure {
    return {
      id: proc.id,
      code: proc.code,
      description: this.cleanText(proc.description || ''),
      origem: this.cleanText(proc.origem || ''),
      complexity: this.cleanText(proc.complexity || ''),
      modality: this.cleanText(proc.modality || ''),
      registrationInstrument: this.cleanText(proc.registration_instrument || ''),
      financing: this.cleanText(proc.financing || ''),
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

  private static convertDbToFrontendWithValidation(proc: any): SigtapProcedure {
    // Converter valores usando centavosToReais
    const valueAmb = centavosToReais(proc.value_amb || 0);
    const valueHosp = centavosToReais(proc.value_hosp || 0);
    const valueProf = centavosToReais(proc.value_prof || 0);
    const valueHospTotal = centavosToReais(proc.value_hosp_total || 0);
    
    // Validar valores - detectar conversão dupla
    if (valueHosp > 50000 || valueProf > 50000 || valueAmb > 50000) {
      console.warn(`🚨 VALOR SUSPEITO no procedimento ${proc.code}:`, {
        valueHosp,
        valueProf,
        valueAmb,
        rawValues: {
          value_hosp: proc.value_hosp,
          value_prof: proc.value_prof,
          value_amb: proc.value_amb
        }
      });
    }
    
    return {
      id: proc.id,
      code: proc.code,
      description: this.cleanText(proc.description || ''),
      origem: this.cleanText(proc.origem || ''),
      complexity: this.cleanText(proc.complexity || ''),
      modality: this.cleanText(proc.modality || ''),
      registrationInstrument: this.cleanText(proc.registration_instrument || ''),
      financing: this.cleanText(proc.financing || ''),
      valueAmb,
      valueAmbTotal: centavosToReais(proc.value_amb_total || 0),
      valueHosp,
      valueProf,
      valueHospTotal: valueHosp + valueProf, // Recalcular para garantir consistência
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

  // Função auxiliar para limpar encoding
  private static cleanText(text: string): string {
    if (!text) return text;
    
    let cleaned = text;
    // Corrigir caracteres mal codificados comuns
    cleaned = cleaned.replace(/Ã¡/g, 'á');
    cleaned = cleaned.replace(/Ã£/g, 'ã');
    cleaned = cleaned.replace(/Ã§/g, 'ç');
    cleaned = cleaned.replace(/Ã©/g, 'é');
    cleaned = cleaned.replace(/Ãª/g, 'ê');
    cleaned = cleaned.replace(/Ã­/g, 'í');
    cleaned = cleaned.replace(/Ã³/g, 'ó');
    cleaned = cleaned.replace(/Ã´/g, 'ô');
    cleaned = cleaned.replace(/Ãµ/g, 'õ');
    cleaned = cleaned.replace(/Ãº/g, 'ú');
    cleaned = cleaned.replace(/Ã /g, 'à');
    cleaned = cleaned.replace(/Ã¢/g, 'â');
    cleaned = cleaned.replace(/Ã¨/g, 'è');
    cleaned = cleaned.replace(/Ã¬/g, 'ì');
    cleaned = cleaned.replace(/Ã²/g, 'ò');
    cleaned = cleaned.replace(/Ã¹/g, 'ù');
    
    // Remove caracteres de controle
    cleaned = cleaned.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '');
    // Normaliza espaços
    cleaned = cleaned.replace(/\s+/g, ' ').trim();
    
    return cleaned;
  }

  private static convertOfficialToFrontend(proc: any, financiamentoMap: Map<string, string>): SigtapProcedure {
    // Conversão segura de valores com validação
    const valueAmb = this.safeParseFloat(proc.valor_sa);
    const valueHosp = this.safeParseFloat(proc.valor_sh);
    const valueProf = this.safeParseFloat(proc.valor_sp);
    
    // VALIDAÇÃO CRÍTICA: Detectar valores corrompidos
    if (valueHosp > 50000 || valueProf > 50000 || valueAmb > 50000) {
      console.error(`🚨 VALOR CORROMPIDO DETECTADO no código ${proc.codigo}:`, {
        valor_sh: proc.valor_sh,
        valor_sp: proc.valor_sp,
        valor_sa: proc.valor_sa,
        converted: { valueHosp, valueProf, valueAmb }
      });
      
      // Se valor está corrompido, tentar divisão por 100 (conversão de centavos)
      const correctedHosp = valueHosp > 50000 ? valueHosp / 100 : valueHosp;
      const correctedProf = valueProf > 50000 ? valueProf / 100 : valueProf;
      const correctedAmb = valueAmb > 50000 ? valueAmb / 100 : valueAmb;
      
      console.log(`🔧 CORREÇÃO APLICADA para ${proc.codigo}:`, {
        original: { valueHosp, valueProf, valueAmb },
        corrected: { correctedHosp, correctedProf, correctedAmb }
      });
      
      return this.createProcedureObject(proc, financiamentoMap, correctedAmb, correctedHosp, correctedProf);
    }
    
    return this.createProcedureObject(proc, financiamentoMap, valueAmb, valueHosp, valueProf);
  }
  
  private static safeParseFloat(value: any): number {
    if (value === null || value === undefined || value === '') return 0;
    const parsed = parseFloat(value);
    return isNaN(parsed) ? 0 : parsed;
  }
  
  private static createProcedureObject(proc: any, financiamentoMap: Map<string, string>, valueAmb: number, valueHosp: number, valueProf: number): SigtapProcedure {
    return {
      id: proc.codigo, // Usar código como ID temporário
      code: proc.codigo,
      description: this.cleanText(proc.nome || ''),
      origem: 'Dados Oficiais DATASUS',
      complexity: this.convertComplexidade(proc.complexidade),
      modality: 'Não informado',
      registrationInstrument: 'Tabela Oficial',
      financing: this.cleanText(financiamentoMap.get(proc.codigo_financiamento) || 'Não informado'),
      valueAmb,
      valueAmbTotal: valueAmb, // Por enquanto igual ao SA
      valueHosp,
      valueProf,
      valueHospTotal: valueHosp + valueProf,
      complementaryAttribute: 'Dados Oficiais',
      serviceClassification: 'Não informado',
      especialidadeLeito: 'Não informado',
      gender: this.convertSexo(proc.sexo),
      minAge: proc.idade_minima || 0,
      minAgeUnit: proc.idade_minima ? 'ANOS' : '',
      maxAge: proc.idade_maxima || 0,
      maxAgeUnit: proc.idade_maxima ? 'ANOS' : '',
      maxQuantity: proc.quantidade_maxima || 0,
      averageStay: proc.dias_permanencia || 0,
      points: proc.pontos || 0,
      cbo: [],
      cid: [],
      habilitation: 'Não informado',
      habilitationGroup: []
    };
  }

  private static convertComplexidade(codigo: string): string {
    switch (codigo) {
      case '1': return 'ATENÇÃO BÁSICA';
      case '2': return 'MÉDIA COMPLEXIDADE';
      case '3': return 'ALTA COMPLEXIDADE';
      default: return 'NÃO INFORMADO';
    }
  }

  private static convertSexo(codigo: string): string {
    switch (codigo) {
      case 'A': return 'AMBOS';
      case 'M': return 'M';
      case 'F': return 'F';
      default: return 'AMBOS';
    }
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
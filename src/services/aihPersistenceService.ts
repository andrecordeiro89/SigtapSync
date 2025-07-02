import { supabase, AIHDB, PatientDB } from '../lib/supabase';
import { AIH } from '../types';
import { PatientService, AIHService } from './supabaseService';

export interface AIHPersistenceResult {
  success: boolean;
  aihId?: string;
  patientId?: string;
  message: string;
  errors?: string[];
}

export interface PatientData {
  name: string;
  cns: string;
  birth_date: string;
  gender: 'M' | 'F';
  medical_record?: string;
  mother_name?: string;
  address?: string;
  city?: string;
  state?: string;
  zip_code?: string;
  nationality?: string;
  race_color?: string;
  hospital_id: string;
}

export interface AIHData {
  aih_number: string;
  hospital_id: string;
  patient_id: string;
  procedure_code: string;
  admission_date: string;
  discharge_date?: string;
  estimated_discharge_date?: string;
  main_cid: string;
  secondary_cid?: string[];
  professional_cbo?: string;
  requesting_physician?: string;
  original_value?: number;
  aih_situation?: string;
  aih_type?: string;
  authorization_date?: string;
  cns_authorizer?: string;
  cns_requester?: string;
  cns_responsible?: string;
  procedure_requested?: string;
  procedure_changed?: boolean;
  discharge_reason?: string;
  specialty?: string;
  care_modality?: string;
  care_character?: string;
  estimated_original_value?: number;
  presentation?: string;
  uti_days?: number;
  medical_acts?: string;
  stay_days?: number;
  specific_complexity?: string;
  sequential_procedure?: boolean;
  special_procedure?: boolean;
  daily_value?: number;
  calculated_total_value?: number;
  billing_notes?: string;
  extraction_confidence?: number;
  source_file?: string;
  created_by: string;
}

export interface AIHMatchData {
  aih_id: string;
  procedure_id: string;
  gender_valid: boolean;
  age_valid: boolean;
  cid_valid: boolean;
  habilitation_valid: boolean;
  cbo_valid: boolean;
  overall_score: number;
  calculated_value_amb: number;
  calculated_value_hosp: number;
  calculated_value_prof: number;
  calculated_total: number;
  validation_details: Record<string, any>;
  match_confidence: number;
  match_method: string;
  status: 'pending' | 'approved' | 'rejected' | 'under_review';
}

export interface ProcessedAIHResult {
  patient: any;
  aih: any;
  matches: any[];
  summary: {
    total_procedures: number;
    approved_procedures: number;
    rejected_procedures: number;
    total_value: number;
  };
}

export class AIHPersistenceService {
  /**
   * Diagnóstico completo do sistema antes de persistir
   */
  static async diagnoseSystem(hospitalId: string): Promise<void> {
    console.log('🔧 === DIAGNÓSTICO DO SISTEMA ===');
    
    try {
      // 1. Verificar conexão com Supabase
      console.log('1️⃣ Testando conexão com Supabase...');
      const { data: connectionTest, error: connectionError } = await supabase
        .from('hospitals')
        .select('id, name')
        .limit(1);
      
      if (connectionError) {
        console.error('❌ Erro de conexão:', connectionError);
        return;
      } else {
        console.log('✅ Conexão OK');
      }

      // 2. Verificar se hospital existe
      console.log('2️⃣ Verificando hospital:', hospitalId);
      const { data: hospital, error: hospitalError } = await supabase
        .from('hospitals')
        .select('id, name')
        .eq('id', hospitalId)
        .single();
      
      if (hospitalError || !hospital) {
        console.warn('⚠️ Hospital não encontrado:', hospitalId);
        console.log('🆔 Criando hospital de desenvolvimento...');
        
        const { data: newHospital, error: createError } = await supabase
          .from('hospitals')
          .insert([{
            id: hospitalId,
            name: 'Hospital de Desenvolvimento',
            cnpj: '00000000000000',
            is_active: true,
            created_at: new Date().toISOString()
          }])
          .select()
          .single();
        
        if (createError) {
          console.error('❌ Erro ao criar hospital:', createError);
        } else {
          console.log('✅ Hospital criado:', newHospital.name);
        }
      } else {
        console.log('✅ Hospital encontrado:', hospital.name);
      }

      // 3. Verificar estrutura da tabela patients
      console.log('3️⃣ Verificando estrutura da tabela patients...');
      const { data: samplePatient, error: structureError } = await supabase
        .from('patients')
        .select('*')
        .eq('hospital_id', hospitalId)
        .limit(1)
        .single();
      
      if (structureError && structureError.code !== 'PGRST116') { // PGRST116 = no rows
        console.error('❌ Erro na estrutura da tabela patients:', structureError);
      } else {
        console.log('✅ Estrutura da tabela patients OK');
        if (samplePatient) {
          console.log('📋 Campos disponíveis:', Object.keys(samplePatient));
        }
      }

      // 4. Verificar permissões RLS
      console.log('4️⃣ Verificando permissões RLS...');
      const { data: permissionTest, error: permissionError } = await supabase
        .from('patients')
        .select('count', { count: 'exact', head: true })
        .eq('hospital_id', hospitalId);
      
      if (permissionError) {
        console.error('❌ Erro de permissão RLS:', permissionError);
      } else {
        console.log('✅ Permissões RLS OK');
      }

      console.log('🔧 === DIAGNÓSTICO CONCLUÍDO ===');
      
    } catch (error) {
      console.error('❌ Erro no diagnóstico:', error);
    }
  }

  /**
   * Persiste AIH extraída do PDF no banco de dados
   * Cria ou atualiza paciente e cria registro AIH
   */
  static async persistAIHFromPDF(
    extractedAIH: AIH,
    hospitalId: string,
    sourceFile: string
  ): Promise<AIHPersistenceResult> {
    try {
      console.log('💾 Iniciando persistência de AIH extraída do PDF...');
      console.log('📄 AIH a ser persistida:', {
        numeroAIH: extractedAIH.numeroAIH,
        nomePaciente: extractedAIH.nomePaciente,
        procedimento: extractedAIH.procedimentoPrincipal
      });

      // DIAGNÓSTICO ANTES DE PERSISTIR
      await this.diagnoseSystem(hospitalId);

      // ETAPA 1: Encontrar ou criar paciente
      const patientResult = await this.findOrCreatePatient(extractedAIH, hospitalId);
      if (!patientResult.success || !patientResult.patientId) {
        return {
          success: false,
          message: `Erro ao criar/encontrar paciente: ${patientResult.message}`,
          errors: patientResult.errors
        };
      }

      // ETAPA 2: Criar registro AIH
      const aihResult = await this.createAIHRecord(
        extractedAIH, 
        hospitalId, 
        patientResult.patientId, 
        sourceFile
      );
      
      if (!aihResult.success || !aihResult.aihId) {
        return {
          success: false,
          message: `Erro ao criar AIH: ${aihResult.message}`,
          errors: aihResult.errors
        };
      }

      console.log('✅ AIH persistida com sucesso!');
      console.log(`📄 AIH ID: ${aihResult.aihId}`);
      console.log(`👤 Paciente ID: ${patientResult.patientId}`);

      return {
        success: true,
        aihId: aihResult.aihId,
        patientId: patientResult.patientId,
        message: `AIH ${extractedAIH.numeroAIH} salva com sucesso para paciente ${extractedAIH.nomePaciente}`
      };

    } catch (error) {
      console.error('❌ Erro na persistência de AIH:', error);
      return {
        success: false,
        message: `Erro interno: ${error instanceof Error ? error.message : 'Erro desconhecido'}`,
        errors: [error instanceof Error ? error.message : 'Erro desconhecido']
      };
    }
  }

  /**
   * Encontra paciente existente ou cria novo
   */
  private static async findOrCreatePatient(
    aih: AIH, 
    hospitalId: string
  ): Promise<{success: boolean; patientId?: string; message: string; errors?: string[]}> {
    try {
      console.log('👤 Procurando paciente existente...');
      console.log('🔍 Hospital ID:', hospitalId);
      console.log('🔍 CNS:', aih.cns);
      console.log('🔍 Nome:', aih.nomePaciente);
      console.log('🔍 Nascimento:', aih.nascimento);
      
      // Procurar por CNS ou nome+data nascimento
      let existingPatient: PatientDB | null = null;
      
      if (aih.cns && aih.cns.length === 15) {
        console.log('🔍 Buscando por CNS...');
        const { data, error } = await supabase
          .from('patients')
          .select('*')
          .eq('hospital_id', hospitalId)
          .eq('cns', aih.cns)
          .single();
        
        console.log('📊 Resposta busca por CNS:', { data, error });
        
        if (!error && data) {
          existingPatient = data;
          console.log(`👤 Paciente encontrado por CNS: ${data.name}`);
        } else if (error) {
          console.log('⚠️ Erro na busca por CNS:', error.message);
        }
      }

      // Se não encontrou por CNS, procurar por nome + data nascimento
      if (!existingPatient && aih.nomePaciente && aih.nascimento) {
        console.log('🔍 Buscando por nome + nascimento...');
        const { data, error } = await supabase
          .from('patients')
          .select('*')
          .eq('hospital_id', hospitalId)
          .eq('name', aih.nomePaciente)
          .eq('birth_date', aih.nascimento)
          .single();
        
        if (!error && data) {
          existingPatient = data;
          console.log(`👤 Paciente encontrado por nome+nascimento: ${data.name}`);
        }
      }

      if (existingPatient) {
        // Atualizar dados do paciente com informações da AIH
        const updatedPatient = await this.updatePatientFromAIH(existingPatient, aih);
        return {
          success: true,
          patientId: updatedPatient.id,
          message: `Paciente existente atualizado: ${updatedPatient.name}`
        };
      } else {
        // Criar novo paciente
        const newPatient = await this.createPatientFromAIH(aih, hospitalId);
        return {
          success: true,
          patientId: newPatient.id,
          message: `Novo paciente criado: ${newPatient.name}`
        };
      }

    } catch (error) {
      console.error('❌ Erro ao encontrar/criar paciente:', error);
      return {
        success: false,
        message: `Erro ao processar paciente: ${error instanceof Error ? error.message : 'Erro desconhecido'}`,
        errors: [error instanceof Error ? error.message : 'Erro desconhecido']
      };
    }
  }

  /**
   * Cria novo paciente a partir dos dados da AIH
   */
  private static async createPatientFromAIH(aih: AIH, hospitalId: string): Promise<PatientDB> {
    console.log('👤 Criando novo paciente...', aih.nomePaciente);
    
    // Preparar dados do paciente
    const patientData = {
      id: crypto.randomUUID(),
      hospital_id: hospitalId,
      name: aih.nomePaciente || 'Nome não informado',
      cns: aih.cns || '',
      birth_date: aih.nascimento || null,
      gender: (aih.sexo === 'Masculino' ? 'M' : aih.sexo === 'Feminino' ? 'F' : aih.sexo) as 'M' | 'F',
      medical_record: aih.prontuario || null,
      mother_name: aih.nomeMae || null,
      address: aih.endereco || null,
      city: aih.municipio || null,
      state: aih.uf || null,
      zip_code: aih.cep || null,
      nationality: aih.nacionalidade || 'BRASIL',
      race_color: aih.racaCor || null,
      is_active: true,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    console.log('📋 Dados do paciente preparados:', {
      name: patientData.name,
      cns: patientData.cns,
      hospital_id: patientData.hospital_id,
      birth_date: patientData.birth_date,
      gender: patientData.gender
    });

    // Tentar criar com schema expandido primeiro
    console.log('👤 Tentando criar paciente com schema expandido...');
    const { data: expandedData, error: expandedError } = await supabase
      .from('patients')
      .insert([patientData])
      .select()
      .single();

    if (!expandedError && expandedData) {
      console.log('✅ Paciente criado com schema expandido:', expandedData.name);
      return expandedData;
    } else {
      console.log(' ⚠️ Erro com schema expandido para paciente, tentando schema básico...', expandedError);
      
      // Tentar com schema básico (campos obrigatórios apenas)
      console.log('👤 Tentando criar paciente com schema básico...');
      const basicData = {
        id: patientData.id,
        hospital_id: patientData.hospital_id,
        name: patientData.name,
        cns: patientData.cns,
        birth_date: patientData.birth_date,
        gender: patientData.gender,
        is_active: true,
        created_at: patientData.created_at,
        updated_at: patientData.updated_at
      };

      console.log('📋 Dados básicos do paciente:', basicData);

      const { data: basicPatientData, error: basicError } = await supabase
        .from('patients')
        .insert([basicData])
        .select()
        .single();

      if (basicError) {
        console.log(' ❌ Erro mesmo com schema básico para paciente:', basicError);
        throw new Error(`Erro ao criar paciente: ${basicError.message}`);
      }

      console.log('✅ Paciente criado com schema básico:', basicPatientData.name);
      return basicPatientData;
    }
  }

  /**
   * Atualiza paciente existente com dados da AIH
   */
  private static async updatePatientFromAIH(existingPatient: PatientDB, aih: AIH): Promise<PatientDB> {
    const updates: Partial<PatientDB> = {};
    
    // Atualizar campos que podem ter mudado
    if (aih.endereco && aih.endereco !== existingPatient.address) {
      updates.address = aih.endereco;
    }
    if (aih.telefone && aih.telefone !== existingPatient.phone) {
      updates.phone = aih.telefone;
    }
    if (aih.prontuario && aih.prontuario !== existingPatient.medical_record) {
      updates.medical_record = aih.prontuario;
    }
    if (aih.nomeMae && aih.nomeMae !== existingPatient.mother_name) {
      updates.mother_name = aih.nomeMae;
    }
    if (aih.nomeResponsavel && aih.nomeResponsavel !== existingPatient.responsible_name) {
      updates.responsible_name = aih.nomeResponsavel;
    }

    if (Object.keys(updates).length > 0) {
      console.log('👤 Atualizando dados do paciente...', Object.keys(updates));
      return await PatientService.updatePatient(existingPatient.id, updates);
    }

    return existingPatient;
  }

  /**
   * Cria registro AIH no banco
   */
  private static async createAIHRecord(
    aih: AIH,
    hospitalId: string,
    patientId: string,
    sourceFile: string
  ): Promise<{success: boolean; aihId?: string; message: string; errors?: string[]}> {
    try {
      console.log('📄 Criando registro AIH...');

      // Verificar se já existe AIH com mesmo número
      const { data: existingAIH } = await supabase
        .from('aihs')
        .select('id')
        .eq('hospital_id', hospitalId)
        .eq('aih_number', aih.numeroAIH)
        .single();

      if (existingAIH) {
        return {
          success: false,
          message: `AIH ${aih.numeroAIH} já existe no sistema`,
          errors: ['AIH duplicada']
        };
      }

      // Dados básicos (sempre funcionam)
      const basicAihData = {
        hospital_id: hospitalId,
        patient_id: patientId,
        aih_number: aih.numeroAIH,
        procedure_code: aih.procedimentoPrincipal,
        admission_date: aih.dataInicio,
        discharge_date: aih.dataFim || undefined,
        main_cid: aih.cidPrincipal || '',
        secondary_cid: [],
        processing_status: 'pending',
        match_found: false,
        requires_manual_review: false,
        source_file: sourceFile
      };
      
      // Campos expandidos (podem não existir no schema)
      const expandedAihData = {
        aih_situation: aih.situacao || '',
        aih_type: aih.tipo || '',
        authorization_date: aih.dataAutorizacao || undefined,
        cns_authorizer: aih.cnsAutorizador || '',
        cns_requester: aih.cnsSolicitante || '',
        cns_responsible: aih.cnsResponsavel || '',
        procedure_requested: aih.procedimentoSolicitado || '',
        procedure_changed: aih.mudancaProc || false,
        discharge_reason: aih.motivoEncerramento || '',
        specialty: aih.especialidade || '',
        care_modality: aih.modalidade || '',
        care_character: aih.caracterAtendimento || '',
        estimated_original_value: aih.estimatedOriginalValue || undefined
      };
      
      // Tentar com campos expandidos primeiro
      let aihData = { ...basicAihData, ...expandedAihData };
      let useExpandedSchema = true;
      let createdAIH;

      try {
        console.log('💾 Tentando criar AIH com schema expandido...');
        createdAIH = await AIHService.createAIH(aihData);
        console.log('✅ AIH criada com schema expandido!');
      } catch (expandedError) {
        console.warn('⚠️ Erro com schema expandido, tentando schema básico...', expandedError);
        
                 // Se falhou, tentar apenas com campos básicos
         try {
           console.log('💾 Tentando criar AIH com schema básico...');
           aihData = basicAihData as any; // Cast para evitar erro TypeScript
           useExpandedSchema = false;
           createdAIH = await AIHService.createAIH(aihData);
           console.log('✅ AIH criada com schema básico!');
           console.log('📋 DICA: Execute a migração do schema para salvar todos os campos extraídos');
         } catch (basicError) {
           console.error('❌ Erro mesmo com schema básico:', basicError);
           throw basicError;
         }
      }

      return {
        success: true,
        aihId: createdAIH.id,
        message: `AIH ${aih.numeroAIH} criada com sucesso ${useExpandedSchema ? '(schema expandido)' : '(schema básico - considere migração)'}`
      };

    } catch (error) {
      console.error('❌ Erro ao criar AIH:', error);
      return {
        success: false,
        message: `Erro ao criar AIH: ${error instanceof Error ? error.message : 'Erro desconhecido'}`,
        errors: [error instanceof Error ? error.message : 'Erro desconhecido']
      };
    }
  }

  /**
   * Busca AIHs por hospital
   */
  static async getAIHsByHospital(hospitalId: string): Promise<AIHDB[]> {
    return await AIHService.getAIHs(hospitalId);
  }

  /**
   * Atualiza status de uma AIH
   */
  static async updateAIHStatus(
    aihId: string, 
    status: string, 
    matchFound?: boolean
  ): Promise<void> {
    return await AIHService.updateAIHStatus(aihId, status, matchFound);
  }

  /**
   * Persiste ou atualiza dados de um paciente
   */
  async savePatient(patientData: PatientData): Promise<any> {
    try {
      // Primeiro, verificar se paciente já existe (por CNS ou nome+hospital)
      const { data: existingPatient } = await supabase
        .from('patients')
        .select('id')
        .eq('hospital_id', patientData.hospital_id)
        .or(`cns.eq.${patientData.cns},and(name.eq.${patientData.name},hospital_id.eq.${patientData.hospital_id})`)
        .single();

      if (existingPatient) {
        // Atualizar paciente existente
        const { data, error } = await supabase
          .from('patients')
          .update({
            ...patientData,
            updated_at: new Date().toISOString()
          })
          .eq('id', existingPatient.id)
          .select()
          .single();

        if (error) throw error;
        
        console.log('✅ Paciente atualizado:', data.name);
        return data;
      } else {
        // Criar novo paciente
        const { data, error } = await supabase
          .from('patients')
          .insert([{
            ...patientData,
            id: crypto.randomUUID(),
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          }])
          .select()
          .single();

        if (error) throw error;
        
        console.log('✅ Paciente criado:', data.name);
        return data;
      }
    } catch (error) {
      console.error('❌ Erro ao salvar paciente:', error);
      throw error;
    }
  }

  /**
   * Persiste dados de uma AIH
   */
  async saveAIH(aihData: AIHData): Promise<any> {
    try {
      // Verificar se AIH já existe
      const { data: existingAIH } = await supabase
        .from('aihs')
        .select('id')
        .eq('aih_number', aihData.aih_number)
        .eq('hospital_id', aihData.hospital_id)
        .single();

      if (existingAIH) {
        // Atualizar AIH existente
        const { data, error } = await supabase
          .from('aihs')
          .update({
            ...aihData,
            processing_status: 'processing',
            processed_at: new Date().toISOString()
          })
          .eq('id', existingAIH.id)
          .select()
          .single();

        if (error) throw error;
        
        console.log('✅ AIH atualizada:', data.aih_number);
        return data;
      } else {
        // Criar nova AIH
        const { data, error } = await supabase
          .from('aihs')
          .insert([{
            ...aihData,
            id: crypto.randomUUID(),
            processing_status: 'processing',
            match_found: false,
            requires_manual_review: false,
            created_at: new Date().toISOString(),
            processed_at: new Date().toISOString()
          }])
          .select()
          .single();

        if (error) throw error;
        
        console.log('✅ AIH criada:', data.aih_number);
        return data;
      }
    } catch (error) {
      console.error('❌ Erro ao salvar AIH:', error);
      throw error;
    }
  }

  /**
   * Persiste matches entre AIH e procedimentos SIGTAP
   */
  async saveAIHMatches(aihId: string, matches: AIHMatchData[]): Promise<any[]> {
    try {
      // Limpar matches existentes para esta AIH
      await supabase
        .from('aih_matches')
        .delete()
        .eq('aih_id', aihId);

      // Inserir novos matches
      const matchesWithIds = matches.map(match => ({
        ...match,
        id: crypto.randomUUID(),
        aih_id: aihId,
        created_at: new Date().toISOString()
      }));

      const { data, error } = await supabase
        .from('aih_matches')
        .insert(matchesWithIds)
        .select();

      if (error) throw error;

      console.log(`✅ ${data.length} matches salvos para AIH ${aihId}`);
      return data;
    } catch (error) {
      console.error('❌ Erro ao salvar matches:', error);
      throw error;
    }
  }

  /**
   * Processa e persiste uma AIH completa com paciente e matches
   */
  async processCompleteAIH(
    patientData: PatientData,
    aihData: Omit<AIHData, 'patient_id'>,
    matches: Omit<AIHMatchData, 'aih_id'>[]
  ): Promise<ProcessedAIHResult> {
    try {
      console.log('🚀 Iniciando processamento completo da AIH:', aihData.aih_number);

      // 1. Salvar/atualizar paciente
      const patient = await this.savePatient(patientData);

      // 2. Salvar AIH com patient_id
      const aih = await this.saveAIH({
        ...aihData,
        patient_id: patient.id
      });

      // 3. Salvar matches
      const savedMatches = await this.saveAIHMatches(
        aih.id,
        matches.map(match => ({
          ...match,
          aih_id: aih.id
        }))
      );

      // 4. Calcular estatísticas
      const approvedMatches = savedMatches.filter(m => m.overall_score >= 80);
      const rejectedMatches = savedMatches.filter(m => m.overall_score < 50);
      const totalValue = savedMatches.reduce((sum, match) => sum + (match.calculated_total || 0), 0);

      // 5. Atualizar AIH com estatísticas finais
      const { data: updatedAIH } = await supabase
        .from('aihs')
        .update({
          match_found: savedMatches.length > 0,
          processing_status: 'completed',
          total_procedures: savedMatches.length,
          approved_procedures: approvedMatches.length,
          rejected_procedures: rejectedMatches.length,
          calculated_total_value: totalValue,
          requires_manual_review: rejectedMatches.length > 0 || approvedMatches.length === 0
        })
        .eq('id', aih.id)
        .select()
        .single();

      // 6. Registrar auditoria
      await this.logAuditEvent({
        action: 'aih_processed',
        table_name: 'aihs',
        record_id: aih.id,
        details: {
          aih_number: aih.aih_number,
          patient_name: patient.name,
          matches_found: savedMatches.length,
          total_value: totalValue
        },
        user_id: aihData.created_by
      });

      const result = {
        patient,
        aih: updatedAIH || aih,
        matches: savedMatches,
        summary: {
          total_procedures: savedMatches.length,
          approved_procedures: approvedMatches.length,
          rejected_procedures: rejectedMatches.length,
          total_value: totalValue
        }
      };

      console.log('✅ AIH processada com sucesso:', {
        aih_number: result.aih.aih_number,
        patient_name: result.patient.name,
        matches: result.summary.total_procedures,
        value: result.summary.total_value
      });

      return result;

    } catch (error) {
      console.error('❌ Erro ao processar AIH completa:', error);
      
      // Log de erro para auditoria
      await this.logAuditEvent({
        action: 'aih_processing_error',
        table_name: 'aihs',
        record_id: null,
        details: {
          error: error.message,
          aih_number: aihData.aih_number
        },
        user_id: aihData.created_by
      });

      throw error;
    }
  }

  /**
   * Registra evento de auditoria
   */
  private async logAuditEvent(auditData: {
    action: string;
    table_name: string;
    record_id: string | null;
    details: Record<string, any>;
    user_id: string;
  }) {
    try {
      await supabase
        .from('audit_logs')
        .insert([{
          id: crypto.randomUUID(),
          action: auditData.action,
          table_name: auditData.table_name,
          record_id: auditData.record_id,
          details: auditData.details,
          user_id: auditData.user_id,
          timestamp: new Date().toISOString(),
          ip_address: 'system',
          user_agent: 'aih-persistence-service'
        }]);
    } catch (error) {
      console.warn('⚠️ Erro ao registrar auditoria:', error);
    }
  }

  /**
   * Busca AIHs de um hospital com filtros
   */
  async getAIHs(hospitalId: string, filters?: {
    status?: string;
    dateFrom?: string;
    dateTo?: string;
    patientName?: string;
    aihNumber?: string;
    limit?: number;
    offset?: number;
  }) {
    try {
      let query = supabase
        .from('aihs')
        .select(`
          *,
          patients (
            id,
            name,
            cns,
            birth_date,
            gender,
            medical_record
          ),
          aih_matches (
            id,
            overall_score,
            calculated_total,
            status,
            match_confidence,
            validation_details
          )
        `)
        .eq('hospital_id', hospitalId)
        .order('created_at', { ascending: false });

      // Aplicar filtros
      if (filters?.status) {
        query = query.eq('processing_status', filters.status);
      }
      
      if (filters?.dateFrom) {
        query = query.gte('admission_date', filters.dateFrom);
      }
      
      if (filters?.dateTo) {
        query = query.lte('admission_date', filters.dateTo);
      }
      
      if (filters?.aihNumber) {
        query = query.ilike('aih_number', `%${filters.aihNumber}%`);
      }

      // Aplicar paginação
      if (filters?.limit) {
        query = query.limit(filters.limit);
      }
      
      if (filters?.offset) {
        query = query.range(filters.offset, (filters.offset + (filters.limit || 50)) - 1);
      }

      const { data, error } = await query;

      if (error) throw error;

      return data || [];
    } catch (error) {
      console.error('❌ Erro ao buscar AIHs:', error);
      throw error;
    }
  }

  /**
   * Busca pacientes de um hospital
   */
  async getPatients(hospitalId: string, filters?: {
    name?: string;
    cns?: string;
    isActive?: boolean;
    limit?: number;
    offset?: number;
  }) {
    try {
      let query = supabase
        .from('patients')
        .select(`
          *,
          aihs (
            id,
            aih_number,
            admission_date,
            procedure_code,
            processing_status
          )
        `)
        .eq('hospital_id', hospitalId)
        .order('name', { ascending: true });

      // Aplicar filtros
      if (filters?.name) {
        query = query.ilike('name', `%${filters.name}%`);
      }
      
      if (filters?.cns) {
        query = query.ilike('cns', `%${filters.cns}%`);
      }
      
      if (filters?.isActive !== undefined) {
        query = query.eq('is_active', filters.isActive);
      }

      // Aplicar paginação
      if (filters?.limit) {
        query = query.limit(filters.limit);
      }
      
      if (filters?.offset) {
        query = query.range(filters.offset, (filters.offset + (filters.limit || 50)) - 1);
      }

      const { data, error } = await query;

      if (error) throw error;

      return data || [];
    } catch (error) {
      console.error('❌ Erro ao buscar pacientes:', error);
      throw error;
    }
  }

  /**
   * Busca estatísticas do hospital
   */
  async getHospitalStats(hospitalId: string) {
    try {
      // Buscar estatísticas de AIHs
      const { data: aihStats } = await supabase
        .from('aihs')
        .select('processing_status, calculated_total_value')
        .eq('hospital_id', hospitalId);

      // Buscar contagem de pacientes
      const { count: patientsCount } = await supabase
        .from('patients')
        .select('*', { count: 'exact', head: true })
        .eq('hospital_id', hospitalId)
        .eq('is_active', true);

      // Calcular estatísticas
      const stats = {
        total_aihs: aihStats?.length || 0,
        pending_aihs: aihStats?.filter(a => a.processing_status === 'pending').length || 0,
        completed_aihs: aihStats?.filter(a => a.processing_status === 'completed').length || 0,
        total_patients: patientsCount || 0,
        total_value: aihStats?.reduce((sum, aih) => sum + (aih.calculated_total_value || 0), 0) || 0,
        average_value: aihStats?.length ? 
          (aihStats.reduce((sum, aih) => sum + (aih.calculated_total_value || 0), 0) / aihStats.length) : 0
      };

      return stats;
    } catch (error) {
      console.error('❌ Erro ao buscar estatísticas:', error);
      throw error;
    }
  }

  /**
   * NOVO: Persiste AIH COMPLETA com todos os procedimentos
   */
  static async persistCompleteAIH(
    aihCompleta: any, // AIHComplete
    hospitalId: string,
    sourceFile: string
  ): Promise<AIHPersistenceResult> {
    try {
      console.log('💾 === PERSISTINDO AIH COMPLETA ===');
      console.log(`📄 AIH: ${aihCompleta.numeroAIH}`);
      console.log(`👤 Paciente: ${aihCompleta.nomePaciente}`);
      console.log(`📋 Procedimentos: ${aihCompleta.procedimentos?.length || 0}`);

      // ETAPA 1: Criar AIH básica (como antes)
      const basicResult = await this.persistAIHFromPDF(aihCompleta, hospitalId, sourceFile);
      
      if (!basicResult.success || !basicResult.aihId) {
        return basicResult;
      }

      const aihId = basicResult.aihId;
      const patientId = basicResult.patientId!;

      // ETAPA 2: Salvar TODOS os procedimentos individuais
      let proceduresSaved = 0;
      let matchesSaved = 0;

      if (aihCompleta.procedimentos && aihCompleta.procedimentos.length > 0) {
        console.log(`📋 Salvando ${aihCompleta.procedimentos.length} procedimentos individuais...`);
        
        for (const procedure of aihCompleta.procedimentos) {
          try {
            // Salvar procedimento na tabela procedure_records - MAPEAMENTO CORRIGIDO
            const procedureRecord = await this.saveProcedureRecordFixed({
              hospital_id: hospitalId,
              patient_id: patientId,
              aih_id: aihId,
              procedure_code: procedure.procedimento,
              procedure_description: procedure.descricao || '',
              sequence: procedure.sequencia,
              professional_document: procedure.documentoProfissional,
              professional_name: procedure.nomeProfissional || 'MÉDICO RESPONSÁVEL',
              cbo: procedure.cbo,
              participation: procedure.participacao,
              cnes: procedure.cnes,
              procedure_date: procedure.data,
              accepted: procedure.aceitar,
              calculated_value: procedure.valorCalculado || 0,
              original_value: procedure.valorOriginal || 0,
              sus_percentage: procedure.porcentagemSUS || 100,
              match_status: procedure.matchStatus || 'pending',
              match_confidence: procedure.matchConfidence || 0,
              approved: procedure.aprovado || false,
              notes: procedure.observacoes || '',
              aih_number: aihCompleta.numeroAIH,
              care_modality: aihCompleta.modalidade,
              care_character: aihCompleta.caracterAtendimento
            });

            proceduresSaved++;

            // Se tem match SIGTAP, salvar na tabela aih_matches
            if (procedure.sigtapProcedure) {
              const matchRecord = await this.saveAIHMatch({
                aih_id: aihId,
                procedure_code: procedure.procedimento,
                sigtap_procedure: procedure.sigtapProcedure,
                overall_score: (procedure.matchConfidence || 0) * 100,
                calculated_total: procedure.valorCalculado || 0,
                status: procedure.matchStatus === 'matched' ? 'approved' : 'pending',
                match_confidence: procedure.matchConfidence || 0
              });

              matchesSaved++;
            }

          } catch (error) {
            console.warn(`⚠️ Erro ao salvar procedimento ${procedure.sequencia}:`, error);
          }
        }

        console.log(`✅ Procedimentos salvos: ${proceduresSaved}/${aihCompleta.procedimentos.length}`);
        console.log(`✅ Matches salvos: ${matchesSaved}`);

        // ETAPA 3: Atualizar AIH com estatísticas completas
        await this.updateAIHStatistics(aihId, {
          total_procedures: aihCompleta.procedimentos.length,
          approved_procedures: aihCompleta.procedimentosAprovados || 0,
          rejected_procedures: aihCompleta.procedimentosRejeitados || 0,
          calculated_total_value: Math.round((aihCompleta.valorTotalCalculado || 0) * 100), // em centavos
          processing_status: 'completed',
          match_found: matchesSaved > 0,
          requires_manual_review: aihCompleta.statusGeral === 'aguardando_revisao'
        });
      }

      return {
        success: true,
        aihId,
        patientId,
        message: `AIH completa salva: ${proceduresSaved} procedimentos + ${matchesSaved} matches SIGTAP`
      };

    } catch (error) {
      console.error('❌ Erro ao persistir AIH completa:', error);
      return {
        success: false,
        message: `Erro na persistência completa: ${error instanceof Error ? error.message : 'Erro desconhecido'}`,
        errors: [error instanceof Error ? error.message : 'Erro desconhecido']
      };
    }
  }

  /**
   * NOVA FUNÇÃO CORRIGIDA: Salva procedimento na estrutura REAL da tabela procedure_records
   */
  private static async saveProcedureRecordFixed(data: any): Promise<any> {
    console.log(`🔧 SALVANDO PROCEDIMENTO COM MAPEAMENTO CORRETO: ${data.procedure_code}`);
    
    // Buscar procedure_id do SIGTAP se existe match
    let procedureId = null;
    if (data.procedure_code) {
      const { data: sigtapProc } = await supabase
        .from('sigtap_procedures')
        .select('id')
        .eq('code', data.procedure_code)
        .single();
      
      if (sigtapProc) {
        procedureId = sigtapProc.id;
        console.log(`✅ Procedimento SIGTAP encontrado: ${data.procedure_code} -> ${procedureId}`);
      }
    }

    // Se não encontrou no SIGTAP, usar o primeiro disponível como referência
    if (!procedureId) {
      console.warn(`⚠️ Procedimento ${data.procedure_code} não encontrado no SIGTAP, usando referência genérica`);
      const { data: firstProc } = await supabase
        .from('sigtap_procedures')
        .select('id')
        .limit(1)
        .single();
      
      if (firstProc) {
        procedureId = firstProc.id;
      } else {
        throw new Error('Nenhum procedimento SIGTAP disponível para referência');
      }
    }

    // 🎯 MAPEAMENTO PARA ESTRUTURA REAL DA TABELA procedure_records
    const record = {
      id: crypto.randomUUID(),
      hospital_id: data.hospital_id,
      patient_id: data.patient_id,
      procedure_id: procedureId,
      aih_id: data.aih_id,
      
      // ✅ CAMPOS OBRIGATÓRIOS DA ESTRUTURA REAL
      procedure_code: data.procedure_code,                                    // Código do procedimento
      procedure_name: data.procedure_description || `Procedimento ${data.procedure_code}`, // Nome do procedimento
      execution_date: data.procedure_date || new Date().toISOString(),       // Data de execução
      
      // Profissional responsável
      professional_name: data.professional_name || 'PROFISSIONAL NÃO INFORMADO',  // Nome do profissional
      professional_cbo: data.cbo || 'N/A',                                   // CBO do profissional
      professional_cns: data.professional_document || 'N/A',                 // CNS do profissional
      
      // Valores financeiros (em centavos conforme padrão Supabase)
      quantity: 1,                                                           // Quantidade (padrão 1)
      unit_value: Math.round((data.calculated_value || 0) * 100),           // Valor unitário em centavos
      total_value: Math.round((data.calculated_value || 0) * 100),          // Valor total em centavos
      
      // Autorização
      authorization_number: data.aih_number || 'N/A',                        // Número da AIH
      authorization_type: 'AIH',                                             // Tipo de autorização
      
      // Status de processamento
      status: data.approved ? 'approved' : 'pending',                       // Status do registro
      billing_status: 'pending',                                            // Status de faturamento
      
      // Modalidade e caráter
      care_modality: data.care_modality || 'hospitalar',                    // Modalidade de atendimento
      care_character: data.care_character || 'eletivo',                     // Caráter do atendimento
      
      // Observações
      notes: data.notes || `Sequência: ${data.sequence || 'N/A'}`,          // Observações + sequência
      
      // Auditoria
      created_at: new Date().toISOString(),
      created_by: data.created_by || null,
      
      // Validação
      validation_status: data.match_status || 'pending',                    // Status de validação
      
      // Sistema de origem
      source_system: 'sigtap-billing-wizard',                              // Sistema de origem
      external_id: `${data.aih_id}_seq_${data.sequence}`,                  // ID externo único
      
      // Classificação
      complexity: data.complexity || 'media',                              // Complexidade
      financing_type: 'SUS',                                               // Tipo de financiamento
      
      // Local
      execution_location: data.cnes || 'MESMO ESTABELECIMENTO',             // Local de execução
      instrument: 'SISTEMA_SIGTAP'                                         // Instrumento
    };

    console.log(`📋 Mapeamento completo para procedure_records:`, {
      procedure_code: record.procedure_code,
      procedure_name: record.procedure_name,
      sequence: data.sequence,
      unit_value_reais: (record.unit_value / 100).toFixed(2),
      professional: record.professional_name,
      cbo: record.professional_cbo
    });

    const { data: result, error } = await supabase
      .from('procedure_records')
      .insert([record])
      .select()
      .single();

    if (error) {
      console.error('❌ ERRO ao salvar na procedure_records:', error);
      console.error('📋 Dados que tentamos inserir:', record);
      throw error;
    }
    
    console.log(`✅ SUCESSO! Procedimento salvo: ${result.procedure_code} | ID: ${result.id}`);
    return result;
  }

  /**
   * Salva um match SIGTAP na tabela aih_matches
   */
  private static async saveAIHMatch(data: any): Promise<any> {
    console.log(`🔧 SALVANDO MATCH SIGTAP CORRIGIDO: ${data.sigtap_procedure.code}`);
    
    // Buscar o ID do procedimento SIGTAP
    const { data: sigtapProc } = await supabase
      .from('sigtap_procedures')
      .select('id')
      .eq('code', data.sigtap_procedure.code)
      .single();

    if (!sigtapProc) {
      console.warn(`⚠️ Procedimento SIGTAP não encontrado: ${data.sigtap_procedure.code}`);
      return null;
    }

    // 🎯 MAPEAMENTO CORRETO PARA TABELA aih_matches
    const match = {
      id: crypto.randomUUID(),
      aih_id: data.aih_id,
      procedure_id: sigtapProc.id,
      gender_valid: true,
      age_valid: true,
      cid_valid: true,        // ✅ CORRIGIDO: era cid_value
      habilitation_valid: true,
      cbo_valid: true,
      overall_score: Math.round(data.overall_score),
      calculated_value_amb: Math.round((data.sigtap_procedure.valueAmb || 0) * 100),
      calculated_value_hosp: Math.round((data.sigtap_procedure.valueHosp || 0) * 100),
      calculated_value_prof: Math.round((data.sigtap_procedure.valueProf || 0) * 100), // ✅ CORRIGIDO: era caculated_value_prof
      calculated_total: Math.round((data.calculated_total || 0) * 100),
      validation_details: {
        procedure_code_match: data.procedure_code === data.sigtap_procedure.code,
        confidence_score: data.match_confidence
      },
      match_confidence: Math.round((data.match_confidence || 0) * 100),
      match_method: 'automatic',     // ✅ CORRIGIDO: era match_metod
      status: data.status,
      created_at: new Date().toISOString()
    };

    console.log(`📋 Match mapeado:`, {
      aih_id: match.aih_id,
      procedure_code: data.sigtap_procedure.code,
      total_centavos: match.calculated_total,
      total_reais: (match.calculated_total / 100).toFixed(2),
      confidence: match.match_confidence
    });

    const { data: result, error } = await supabase
      .from('aih_matches')
      .insert([match])
      .select()
      .single();

    if (error) {
      console.error('❌ ERRO aih_matches:', error);
      console.error('📋 Dados match:', match);
      throw error;
    }
    
    console.log(`✅ MATCH salvo: ${data.sigtap_procedure.code}`);
    return result;
  }

  /**
   * Atualiza estatísticas da AIH
   */
  private static async updateAIHStatistics(aihId: string, stats: any): Promise<void> {
    const { error } = await supabase
      .from('aihs')
      .update(stats)
      .eq('id', aihId);

    if (error) throw error;
  }

  /**
   * Exclui um paciente e todas suas AIHs associadas
   */
  async deletePatient(patientId: string): Promise<void> {
    try {
      console.log('🗑️ Excluindo paciente:', patientId);

      // 1. Primeiro excluir matches das AIHs do paciente
      const { data: aihsToDelete } = await supabase
        .from('aihs')
        .select('id')
        .eq('patient_id', patientId);

      if (aihsToDelete && aihsToDelete.length > 0) {
        for (const aih of aihsToDelete) {
          await supabase
            .from('aih_matches')
            .delete()
            .eq('aih_id', aih.id);
        }
        console.log(`🗑️ Matches excluídos para ${aihsToDelete.length} AIHs`);
      }

      // 2. Excluir AIHs do paciente
      const { error: aihError } = await supabase
        .from('aihs')
        .delete()
        .eq('patient_id', patientId);

      if (aihError) throw aihError;
      console.log('🗑️ AIHs do paciente excluídas');

      // 3. Excluir paciente
      const { error: patientError } = await supabase
        .from('patients')
        .delete()
        .eq('id', patientId);

      if (patientError) throw patientError;
      console.log('✅ Paciente excluído com sucesso');

    } catch (error) {
      console.error('❌ Erro ao excluir paciente:', error);
      throw error;
    }
  }

  /**
   * Exclui uma AIH específica e seus matches
   */
  async deleteAIH(aihId: string): Promise<void> {
    try {
      console.log('🗑️ Excluindo AIH:', aihId);

      // 1. Excluir matches da AIH
      const { error: matchError } = await supabase
        .from('aih_matches')
        .delete()
        .eq('aih_id', aihId);

      if (matchError) throw matchError;
      console.log('🗑️ Matches da AIH excluídos');

      // 2. Excluir AIH
      const { error: aihError } = await supabase
        .from('aihs')
        .delete()
        .eq('id', aihId);

      if (aihError) throw aihError;
      console.log('✅ AIH excluída com sucesso');

    } catch (error) {
      console.error('❌ Erro ao excluir AIH:', error);
      throw error;
    }
  }

  /**
   * NOVO: Busca procedimentos individuais por hospital
   */
  async getProcedureRecords(hospitalId: string, filters?: {
    aihId?: string;
    patientId?: string;
    matchStatus?: string;
    procedureCode?: string;
    limit?: number;
    offset?: number;
  }) {
    try {
      let query = supabase
        .from('procedure_records')
        .select(`
          *,
          aihs!inner(
            aih_number,
            admission_date,
            procedure_code as aih_procedure_code
          ),
          patients!inner(
            name as patient_name,
            cns as patient_cns
          ),
          sigtap_procedures(
            code as sigtap_code,
            description as sigtap_description,
            value_hosp_total
          )
        `)
        .eq('hospital_id', hospitalId)
        .order('created_at', { ascending: false });

      // Aplicar filtros
      if (filters?.aihId) {
        query = query.eq('aih_id', filters.aihId);
      }
      if (filters?.patientId) {
        query = query.eq('patient_id', filters.patientId);
      }
      if (filters?.matchStatus) {
        query = query.eq('match_status', filters.matchStatus);
      }
      if (filters?.procedureCode) {
        query = query.ilike('procedure_code', `%${filters.procedureCode}%`);
      }
      if (filters?.limit) {
        query = query.limit(filters.limit);
      }
      if (filters?.offset) {
        query = query.range(filters.offset, (filters.offset || 0) + (filters.limit || 50) - 1);
      }

      const { data, error } = await query;

      if (error) {
        console.error('❌ Erro ao buscar procedimentos:', error);
        throw error;
      }

      console.log(`✅ ${data?.length || 0} procedimentos encontrados`);
      return data || [];
    } catch (error) {
      console.error('❌ Erro na busca de procedimentos:', error);
      throw error;
    }
  }
}

export const aihPersistenceService = new AIHPersistenceService(); 
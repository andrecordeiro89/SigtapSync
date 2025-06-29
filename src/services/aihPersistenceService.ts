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

export class AIHPersistenceService {
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
      
      // Procurar por CNS ou nome+data nascimento
      let existingPatient: PatientDB | null = null;
      
      if (aih.cns && aih.cns.length === 15) {
        const { data, error } = await supabase
          .from('patients')
          .select('*')
          .eq('hospital_id', hospitalId)
          .eq('cns', aih.cns)
          .single();
        
        if (!error && data) {
          existingPatient = data;
          console.log(`👤 Paciente encontrado por CNS: ${data.name}`);
        }
      }

      // Se não encontrou por CNS, procurar por nome + data nascimento
      if (!existingPatient && aih.nomePaciente && aih.nascimento) {
        const { data, error } = await supabase
          .from('patients')
          .select('*')
          .eq('hospital_id', hospitalId)
          .eq('name', aih.nomePaciente)
          .eq('birth_date', aih.nascimento)
          .maybeSingle();
        
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
    // Dados básicos do paciente (sempre funcionam)
    const basicPatientData = {
      hospital_id: hospitalId,
      name: aih.nomePaciente,
      cns: aih.cns || '',
      birth_date: aih.nascimento,
      gender: aih.sexo,
      address: aih.endereco || '',
      phone: aih.telefone || '',
      is_active: true,
      city: aih.municipio || '',
      state: aih.uf || '',
      zip_code: aih.cep || ''
    };
    
    // Campos expandidos (podem não existir no schema)
    const expandedPatientData = {
      medical_record: aih.prontuario || '',
      nationality: aih.nacionalidade || 'BRASIL',
      mother_name: aih.nomeMae || '',
      neighborhood: aih.bairro || '',
      responsible_name: aih.nomeResponsavel || ''
    };

    console.log('👤 Criando novo paciente...', basicPatientData.name);
    
    // Tentar com schema expandido primeiro
    let patientData = { ...basicPatientData, ...expandedPatientData };
    
    try {
      console.log('👤 Tentando criar paciente com schema expandido...');
      return await PatientService.createPatient(patientData);
    } catch (expandedError) {
      console.warn('⚠️ Erro com schema expandido para paciente, tentando schema básico...', expandedError);
      
      // Se falhou, tentar apenas com campos básicos
      try {
        console.log('👤 Tentando criar paciente com schema básico...');
        return await PatientService.createPatient(basicPatientData as any);
      } catch (basicError) {
        console.error('❌ Erro mesmo com schema básico para paciente:', basicError);
        throw basicError;
      }
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
} 
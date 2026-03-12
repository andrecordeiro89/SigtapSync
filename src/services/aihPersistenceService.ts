import { supabase, AIHDB, PatientDB } from '../lib/supabase';
import { sanitizePatientName, isLikelyProcedureString } from '../utils/patientName';
import { buildAIHIdempotencyKey } from '../utils/idempotency';
import { AIH } from '../types';
import { PatientService, AIHService } from './supabaseService';
import { formatSigtapCode } from '../utils/formatters';
import { validateCNS } from '../utils/validation';

// ================================================================
// UTILIDADES DE CONVERSÃO
// ================================================================

/**
 * 🔧 UTILITÁRIO: Converter data brasileira para ISO
 * Converte DD/MM/YYYY para YYYY-MM-DD
 */
const convertBrazilianDateToISO = (dateString: string): string => {
  if (!dateString) return new Date().toISOString().split('T')[0];
  
  // Se já está no formato ISO, retorna como está
  if (dateString.match(/^\d{4}-\d{2}-\d{2}/)) {
    return dateString.split('T')[0]; // Remove a parte de tempo se existir
  }
  
  // Se está no formato brasileiro DD/MM/YYYY
  if (dateString.match(/^\d{2}\/\d{2}\/\d{4}/)) {
    const [day, month, year] = dateString.split('/');
    return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
  }
  
  // Se está no formato americano MM/DD/YYYY
  if (dateString.match(/^\d{1,2}\/\d{1,2}\/\d{4}/)) {
    try {
      const date = new Date(dateString);
      return date.toISOString().split('T')[0];
    } catch {
      return new Date().toISOString().split('T')[0];
    }
  }
  
  // Fallback para data atual
  console.warn(`⚠️ Formato de data não reconhecido: ${dateString}. Usando data atual.`);
  return new Date().toISOString().split('T')[0];
};

// ================================================================
// Normalização de Caráter de Atendimento (apenas '1' Eletivo, '2' Urgência)
// Padrão: '1'; troca para '2' somente com sinais claros de urgência/emergência
// ================================================================
const normalizeCareCharacterStrict = (raw?: any): '1' | '2' => {
  try {
    const v = String(raw ?? '').trim().toLowerCase();
    if (v === '2' || v === '02') return '2';
    if (v === '1' || v === '01') return '1';
    // Palavras/indícios de urgência/emergência
    const isUrgency =
      v.includes('urg') ||
      v.includes('emerg') ||
      /\bpronto[-\s]?atendimento\b/.test(v) ||
      /\bpa[:\s]?\b/i.test(v);
    return isUrgency ? '2' : '1';
  } catch {
    return '1';
  }
};

const normalizeCNS = (v?: string): string => (v ?? '').replace(/\D/g, '');

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
   * Verifica se existe médico cadastrado para o CNS informado
   */
  private static async doctorExistsByCNS(cns?: string | null): Promise<boolean> {
    if (!cns || typeof cns !== 'string' || cns.trim() === '' || cns === 'N/A') return false;
    try {
      const { data, error } = await supabase
        .from('doctors')
        .select('id')
        .eq('cns', cns.trim())
        .single();
      if (error && (error as any).code !== 'PGRST116') {
        console.warn('⚠️ Erro ao consultar médico por CNS:', error.message);
      }
      return Boolean(data && data.id);
    } catch (e) {
      console.warn('⚠️ Falha em doctorExistsByCNS:', e);
      return false;
    }
  }
  /**
   * Garante que o médico exista e esteja vinculado ao hospital (doctor_hospital)
   * Retorna o doctor_id quando conseguir garantir o vínculo
   */
  private static async ensureDoctorAndHospitalLink(
    cns: string | null | undefined,
    hospitalId: string,
    roleLabel?: 'Responsável' | 'Solicitante' | 'Autorizador'
  ): Promise<string | null> {
    try {
      if (!cns || cns.trim() === '' || cns === 'N/A') return null;

      // 1) Buscar (ou criar) o médico por CNS
      let doctorId: string | null = null;
      const { data: existingDoctor, error: doctorQueryError } = await supabase
        .from('doctors')
        .select('id, cns, name, is_active')
        .eq('cns', cns)
        .single();

      if (!doctorQueryError && existingDoctor) {
        doctorId = existingDoctor.id;
      } else if (doctorQueryError && doctorQueryError.code !== 'PGRST116') {
        // Erro real
        console.warn('⚠️ Erro ao consultar doctors por CNS:', doctorQueryError.message);
      }

      if (!doctorId) {
        // Criar médico mínimo
        const { data: newDoctor, error: createDoctorError } = await supabase
          .from('doctors')
          .insert([
            {
              id: crypto.randomUUID(),
              cns,
              name: `Dr(a). CNS ${cns}`,
              specialty: 'Não informado',
              is_active: true,
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            },
          ])
          .select('id')
          .single();

        if (createDoctorError) {
          console.error('❌ Falha ao criar médico por CNS:', cns, createDoctorError.message);
          return null;
        }
        doctorId = newDoctor.id;
      }

      // 2) Garantir vínculo doctor_hospital
      const { data: existingLink, error: linkQueryError } = await supabase
        .from('doctor_hospital')
        .select('id, is_active')
        .eq('doctor_id', doctorId)
        .eq('hospital_id', hospitalId)
        .single();

      if (!linkQueryError && existingLink) {
        if (existingLink.is_active !== true) {
          // Reativar vínculo
          await supabase
            .from('doctor_hospital')
            .update({ is_active: true, updated_at: new Date().toISOString() })
            .eq('id', existingLink.id);
        }
        return doctorId;
      }

      if (linkQueryError && linkQueryError.code !== 'PGRST116') {
        console.warn('⚠️ Erro ao consultar doctor_hospital:', linkQueryError.message);
      }

      const { error: createLinkError } = await supabase
        .from('doctor_hospital')
        .insert([
          {
            id: crypto.randomUUID(),
            doctor_id: doctorId,
            doctor_cns: cns,
            hospital_id: hospitalId,
            role: roleLabel || null,
            is_active: true,
            is_primary_hospital: false,
            start_date: new Date().toISOString().slice(0, 10),
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          },
        ]);

      if (createLinkError) {
        console.error('❌ Falha ao criar vínculo doctor_hospital:', createLinkError.message);
        return null;
      }

      return doctorId;
    } catch (error) {
      console.error('❌ ensureDoctorAndHospitalLink error:', error);
      return null;
    }
  }
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

      // 🚫 BLOQUEIO: Médico responsável deve existir previamente
      const cnsResp = (extractedAIH.cnsResponsavel || '').trim();
      if (cnsResp) {
        const exists = await this.doctorExistsByCNS(cnsResp);
        if (!exists) {
          return {
            success: false,
            message: `Médico responsável (CNS ${cnsResp}) não encontrado. Cadastre o médico antes de salvar a AIH.`,
            errors: ['doctor_not_found']
          };
        }
      }

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

      // ETAPA 3 (Seguro): Persistir procedimentos (procedure_records) se fornecidos e ainda não existirem
      try {
        const hasProcedures = Array.isArray((extractedAIH as any).procedimentosRealizados) && (extractedAIH as any).procedimentosRealizados.length > 0;
        if (aihResult.aihId && hasProcedures) {
          const { data: existingForAIH } = await supabase
            .from('procedure_records')
            .select('id')
            .eq('aih_id', aihResult.aihId)
            .limit(1);

          if (!existingForAIH || existingForAIH.length === 0) {
            await this.createProcedureRecordsForAIH({
              aihId: aihResult.aihId,
              hospitalId,
              patientId: patientResult.patientId!,
              procedimentos: (extractedAIH as any).procedimentosRealizados as Array<any>
            });
          } else {
            console.log('ℹ️ Procedimentos já existem para esta AIH. Pulando inserção de procedure_records.');
          }
        }
      } catch (procErr) {
        console.warn('⚠️ Falha ao persistir procedimentos (procedure_records). AIH salva normalmente.', procErr);
      }

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
   * Cria registros em procedure_records para uma AIH, com inserção em lote e fallback seguro.
   * Não sobrescreve registros existentes; deduplica por (aih_id, sequencia) quando possível.
   */
  private static async createProcedureRecordsForAIH(args: {
    aihId: string;
    hospitalId: string;
    patientId: string;
    procedimentos: Array<{
      linha: number;
      codigo: string;
      descricao?: string;
      profissionais?: Array<{ documento?: string; cbo?: string; participacao?: string; cnes?: string }>;
      quantidade?: number;
      dataRealizacao?: string;
    }>;
  }): Promise<void> {
    const { aihId, hospitalId, patientId, procedimentos } = args;
    if (!procedimentos || procedimentos.length === 0) return;

    console.log(`🧾 Inserindo ${procedimentos.length} procedimentos para AIH ${aihId}...`);

    // Buscar sequências já existentes para evitar duplicidade
    const { data: existingRows } = await supabase
      .from('procedure_records')
      .select('sequencia')
      .eq('aih_id', aihId);

    const existingSeq = new Set<number>((existingRows || []).map(r => (r as any).sequencia).filter((v: any) => typeof v === 'number'));

    // Buscar nomes de médicos por CNS (documento) em lote
    let doctorNameByCns = new Map<string, string>();
    try {
      const cnsList = Array.from(new Set(
        procedimentos.map(p => {
          const prof = Array.isArray(p.profissionais) && p.profissionais.length > 0 ? p.profissionais[0] : undefined;
          const doc = prof?.documento ? String(prof.documento).trim() : '';
          return doc || null;
        }).filter(Boolean) as string[]
      ));
      if (cnsList.length > 0) {
        const { data: doctors } = await supabase
          .from('doctors')
          .select('cns, name')
          .in('cns', cnsList);
        doctorNameByCns = new Map<string, string>((doctors || []).map((d: any) => [String(d.cns).trim(), d.name]));
      }
    } catch (e) {
      console.warn('⚠️ Falha ao buscar nomes de médicos por CNS. Continuando sem nome.', e);
    }

    // Resolver IDs e descrições do SIGTAP em lote antes de montar os registros
    const codeToProcedureId: Record<string, string> = {};
    const codeToDescription: Record<string, string> = {};
    try {
      const uniqueCodes = Array.from(new Set(
        (procedimentos || [])
          .map(p => formatSigtapCode((p.codigo || '').toString().trim()))
          .filter(c => c.length > 0)
      ));
      if (uniqueCodes.length > 0) {
        // Preferir RPC de resolução em lote se disponível
        let rpcOk = false;
        try {
          const { data: rpcData, error: rpcError } = await supabase
            .rpc('resolve_procedure_ids_batch', { p_codes: uniqueCodes });
          if (!rpcError && Array.isArray(rpcData)) {
            rpcData.forEach((row: any) => {
              if (row && row.code) {
                codeToProcedureId[row.code] = row.procedure_id;
                if (row.description) codeToDescription[row.code] = row.description;
              }
            });
            rpcOk = true;
          }
        } catch {}

        if (!rpcOk) {
          const { data: sigtapRows } = await supabase
            .from('sigtap_procedures')
            .select(`code, id, description, sigtap_versions!inner(is_active)`) 
            .in('code', uniqueCodes)
            .eq('sigtap_versions.is_active', true);
          (sigtapRows || []).forEach((row: any) => {
            if (row && row.code) {
              codeToProcedureId[row.code] = row.id;
              if (row.description) codeToDescription[row.code] = row.description;
            }
          });
        }
      }
    } catch (e) {
      console.warn('⚠️ Falha ao resolver procedimentos SIGTAP em lote. Continuando sem FK/descrição.', e);
    }

    const rows = procedimentos
      .filter(p => typeof p.linha === 'number' && !existingSeq.has(p.linha))
      .map(p => {
        const prof = Array.isArray(p.profissionais) && p.profissionais.length > 0 ? p.profissionais[0] : undefined;
        const profCns = prof?.documento ? String(prof.documento).trim() : null;
        const procedureDateISO = (() => {
          if (!p.dataRealizacao) return new Date().toISOString();
          // aceitar ISO ou DD/MM/YYYY
          if (/^\d{4}-\d{2}-\d{2}/.test(p.dataRealizacao)) return p.dataRealizacao;
          if (/^\d{2}\/\d{2}\/\d{4}/.test(p.dataRealizacao)) {
            const [d, m, y] = p.dataRealizacao.split('/');
            return `${y}-${m}-${d}T00:00:00.000Z`;
          }
          return new Date(p.dataRealizacao).toISOString();
        })();

        const codeRaw = (p.codigo || '').toString().trim();
        const code = formatSigtapCode(codeRaw);
        const cleanedDesc = (() => {
          const incoming = (p.descricao || '').toString().trim();
          if (!incoming || incoming.startsWith('Procedimento') || incoming.startsWith('Procedimento:')) {
            return codeToDescription[code] || null;
          }
          return incoming;
        })();

        const baseRow: Record<string, any> = {
          hospital_id: hospitalId,
          patient_id: patientId,
          aih_id: aihId,
          procedure_code: code,
          procedure_description: cleanedDesc,
          procedure_date: procedureDateISO,
          professional_name: profCns ? (doctorNameByCns.get(profCns) || null) : null,
          professional_cns: profCns,
          professional_cbo: prof?.cbo || null,
          status: 'approved',
          billing_status: 'pending',
          match_status: 'matched',
          quantity: p.quantidade || 1,
          sequencia: p.linha,
          value_charged: 0,
          total_value: 0
        };

        const sigtapId = codeToProcedureId[code];
        if (sigtapId) {
          baseRow.procedure_id = sigtapId;
        }

        return baseRow as Record<string, any>;
      });

    if (rows.length === 0) {
      console.log('ℹ️ Nenhum novo procedimento para inserir (todos já existem por sequencia).');
      return;
    }

    // Inserção em chunks com fallback linha a linha
    const chunkSize = 300;
    for (let i = 0; i < rows.length; i += chunkSize) {
      const slice = rows.slice(i, i + chunkSize);
      try {
        const { error } = await supabase
          .from('procedure_records')
          .insert(slice);
        if (error) throw error;
      } catch (e) {
        console.warn('⚠️ Falha no lote. Tentando inserção segura linha a linha...', e);
        for (const row of slice) {
          try {
            const ok = await this.prototype.saveProcedureRecordFixed.call(this, row);
            if (!ok) console.warn('⚠️ Falha ao salvar procedimento individual:', row.sequencia, row.procedure_code);
          } catch (ie) {
            console.warn('⚠️ Erro ao salvar procedimento individual:', ie);
          }
        }
      }
    }

    // Atualizar contadores da AIH sem sobrescrever outros campos
    try {
      const { data: countsData } = await supabase
        .from('procedure_records')
        .select('id, match_status')
        .eq('aih_id', aihId);

      const total = (countsData || []).length;
      const approved = (countsData || []).filter(r => (r as any).match_status === 'approved' || (r as any).billing_status === 'paid').length;
      const rejected = (countsData || []).filter(r => (r as any).match_status === 'rejected').length;

      await supabase
        .from('aihs')
        .update({
          total_procedures: total,
          approved_procedures: approved,
          rejected_procedures: rejected,
          updated_at: new Date().toISOString()
        })
        .eq('id', aihId);
    } catch (ucErr) {
      console.warn('⚠️ Não foi possível atualizar contadores de AIH após inserir procedimentos:', ucErr);
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
      
      let existingPatient: PatientDB | null = null;
      
      const normalizedCNS = normalizeCNS(aih.cns);
      const hasValidCNS = normalizedCNS.length === 15 && validateCNS(normalizedCNS);
      if (hasValidCNS) {
        console.log('🔍 Buscando por CNS...');
        const { data, error } = await supabase
          .from('patients')
          .select('*')
          .eq('hospital_id', hospitalId)
          .eq('cns', normalizedCNS);
        
        console.log('📊 Resposta busca por CNS:', { data, error });
        
        if (!error && data && data.length > 0) {
          existingPatient = data[0];
          console.log(`👤 Paciente encontrado por CNS: ${data[0].name}`);
        } else if (error) {
          console.log('⚠️ Erro na busca por CNS:', error.message);
        }
      }

      if (!existingPatient && aih.nomePaciente && aih.nascimento) {
        console.log('🔍 Buscando por nome + nascimento...');
        const sanitizedName = sanitizePatientName(aih.nomePaciente);
        const { data, error } = await supabase
          .from('patients')
          .select('*')
          .eq('hospital_id', hospitalId)
          .eq('name', sanitizedName)
          .eq('birth_date', aih.nascimento);
        
        if (!error && data && data.length > 0) {
          existingPatient = data[0];
          console.log(`👤 Paciente encontrado por nome+nascimento: ${data[0].name}`);
        } else if (error) {
          console.log('⚠️ Erro na busca por nome+nascimento:', error.message);
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
    
    const normalizedCNS = normalizeCNS(aih.cns);
    const hasValidCNS = normalizedCNS.length === 15 && validateCNS(normalizedCNS);
    const patientData = {
      hospital_id: hospitalId,
      name: sanitizePatientName(aih.nomePaciente),
      cns: hasValidCNS ? normalizedCNS : '',
      birth_date: aih.nascimento || null,
      gender: (aih.sexo === 'Masculino' ? 'M' : aih.sexo === 'Feminino' ? 'F' : aih.sexo) as 'M' | 'F',
      medical_record: aih.prontuario || null,
      mother_name: aih.nomeMae || null,
      
      // 🆕 NOVOS CAMPOS ADICIONADOS NA MIGRAÇÃO
      address: aih.endereco || null,
      numero: aih.numero || null,               // Novo: número do endereço
      complemento: aih.complemento || null,      // Novo: complemento do endereço
      bairro: aih.bairro || null,               // Novo: bairro
      city: aih.municipio || null,
      state: aih.uf || null,
      zip_code: aih.cep || null,
      phone: aih.telefone || null,              // Novo: telefone
      nationality: aih.nacionalidade || 'BRASIL',
      race_color: aih.racaCor || null,
      
      // 🆕 NOVOS CAMPOS DE DOCUMENTO
      tipo_documento: aih.tipoDocumento || null,  // Novo: tipo de documento
      documento: aih.documento || null,           // Novo: número do documento
      nome_responsavel: aih.nomeResponsavel || null, // Novo: nome do responsável
      
      is_active: true,
      updated_at: new Date().toISOString()
    };

    console.log('📋 Dados COMPLETOS do paciente preparados:', {
      name: patientData.name,
      cns: patientData.cns,
      hospital_id: patientData.hospital_id,
      birth_date: patientData.birth_date,
      gender: patientData.gender,
      endereco_completo: `${patientData.address}, ${patientData.numero} ${patientData.complemento}`.trim(),
      bairro: patientData.bairro,
      telefone: patientData.phone,
      responsavel: patientData.nome_responsavel
    });

    console.log('👤 Tentando criar paciente com schema COMPLETAMENTE expandido...');
    const { data: expandedData, error: expandedError } = await supabase
      .from('patients')
      .upsert([patientData], { onConflict: 'hospital_id,cns' })
      .select()
      .single();

    if (!expandedError && expandedData) {
      console.log('✅ Paciente criado com schema COMPLETAMENTE expandido:', expandedData.name);
      console.log('📍 Endereço completo salvo:', `${expandedData.address}, ${expandedData.numero}`);
      return expandedData;
    } else {
      console.log('⚠️ Erro com schema expandido para paciente, tentando schema básico...', expandedError);
      
      console.log('👤 Tentando criar paciente com schema básico...');
      const basicData = {
        hospital_id: patientData.hospital_id,
        name: patientData.name,
        cns: patientData.cns,
        birth_date: patientData.birth_date,
        gender: patientData.gender,
        is_active: true,
        updated_at: patientData.updated_at
      };

      console.log('📋 Dados básicos do paciente:', basicData);

      const { data: basicPatientData, error: basicError } = await supabase
        .from('patients')
        .upsert([basicData], { onConflict: 'hospital_id,cns' })
        .select()
        .single();

      if (basicError) {
        console.log('❌ Erro mesmo com schema básico para paciente:', basicError);
        throw new Error(`Erro ao criar paciente: ${basicError.message}`);
      }

      console.log('✅ Paciente criado com schema básico:', basicPatientData.name);
      console.log('⚠️ AVISO: Alguns campos não foram salvos. Execute migração do banco para schema completo.');
      return basicPatientData;
    }
  }

  /**
   * Atualiza paciente existente com dados da AIH
   */
  private static async updatePatientFromAIH(existingPatient: PatientDB, aih: AIH): Promise<PatientDB> {
    const updates: Partial<PatientDB> = {};
    
    try {
      const extractedName = sanitizePatientName(aih.nomePaciente || '');
      const shouldFixName = (
        !!extractedName &&
        extractedName !== 'Nome não informado' &&
        (
          !existingPatient.name ||
          existingPatient.name.trim() === '' ||
          /^procedimento/i.test(existingPatient.name) ||
          existingPatient.name === 'Nome não informado' ||
          isLikelyProcedureString(existingPatient.name)
        )
      );
      if (shouldFixName && extractedName !== existingPatient.name) {
        updates.name = extractedName;
      }
    } catch {}

    const normalizedCNS = normalizeCNS(aih.cns);
    const hasValidCNS = normalizedCNS.length === 15 && validateCNS(normalizedCNS);
    if (hasValidCNS && (!existingPatient.cns || existingPatient.cns.trim() === '')) {
      updates.cns = normalizedCNS;
    }

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
      // Chave leve para rastreio/idempotência (apenas logging)
      const idemKey = buildAIHIdempotencyKey({
        hospitalId,
        aihNumber: aih.numeroAIH,
        admissionDate: aih.dataInicio,
        procedureCode: aih.procedimentoPrincipal,
        patientId,
        patientCns: aih.cns || undefined,
      });
      console.log('📄 Criando registro AIH...', { idemKey });

      // ✅ VERIFICAÇÃO INTELIGENTE DE DUPLICATAS
      if (aih.numeroAIH === "-") {
        // 🆕 LÓGICA ESPECIAL PARA AIHs SEM NÚMERO: Permitir múltiplas "-" mas alertar sobre possíveis duplicatas
        console.log('🔧 AIH sem número detectada - verificação inteligente opcional');
        
        // Buscar outras AIHs com "-" para o mesmo paciente
        const { data: dashAIHs, error: dashError } = await supabase
          .from('aihs')
          .select('id, aih_number, admission_date, procedure_code, created_at')
          .eq('hospital_id', hospitalId)
          .eq('patient_id', patientId)
          .eq('aih_number', '-')
          .limit(5);

        if (!dashError && dashAIHs && dashAIHs.length > 0) {
          console.log(`🔍 Encontradas ${dashAIHs.length} AIHs com "-" para este paciente`);
          dashAIHs.forEach((existing, index) => {
            console.log(`   ${index + 1}. Data: ${existing.admission_date}, Proc: ${existing.procedure_code}`);
          });
        }
        
        // Verificação adicional leve por data (mesmo dia) + procedimento
        try {
          const start = new Date(aih.dataInicio);
          start.setHours(0, 0, 0, 0);
          const end = new Date(aih.dataInicio);
          end.setHours(23, 59, 59, 999);

          const { data: possibleDup, error: dupErr } = await supabase
            .from('aihs')
            .select('id, admission_date, procedure_code')
            .eq('hospital_id', hospitalId)
            .eq('patient_id', patientId)
            .eq('procedure_code', aih.procedimentoPrincipal)
            .gte('admission_date', start.toISOString())
            .lte('admission_date', end.toISOString())
            .limit(1);

          if (!dupErr && possibleDup && possibleDup.length > 0) {
            console.log('⚠️ Possível duplicata de AIH sem número detectada no mesmo dia e procedimento. idemKey:', idemKey);
            return {
              success: false,
              message: 'Possível duplicata de AIH sem número para o mesmo paciente (mesmo dia e procedimento).',
              errors: ['possible_duplicate_without_number']
            };
          }
        } catch (dupCheckErr) {
          console.warn('⚠️ Falha na verificação leve de duplicata de AIH sem número:', dupCheckErr);
        }

        console.log('✅ Permitindo inserção de nova AIH com "-" (sem bloqueio)');
      } else {
        // 🔄 LÓGICA NORMAL PARA AIHs COM NÚMERO
        console.log('🔍 Verificando duplicata por número de AIH...');
        const { data: existingAIHs, error: checkError } = await supabase
          .from('aihs')
          .select('id')
          .eq('hospital_id', hospitalId)
          .eq('aih_number', aih.numeroAIH);

        if (checkError) {
          console.warn('⚠️ Erro na verificação de duplicatas:', checkError);
        }

        if (existingAIHs && existingAIHs.length > 0) {
          return {
            success: false,
            message: `AIH ${aih.numeroAIH} já existe no sistema`,
            errors: ['AIH duplicada']
          };
        }
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
        source_file: sourceFile,
        competencia: null as any
      };
      
      // Normalizar caráter de atendimento para persistência
      const normalizedCareCharacter = normalizeCareCharacterStrict(aih.caracterAtendimento);
      
      // 🎯 Regra de fallback para Especialidade:
      // Padrão "01 - Cirúrgico"; se Urgência/Emergência, usar "03 - Clínico",
      // exceto parto cesáreo (permanece "01 - Cirúrgico").
      const resolveSpecialtyFromRules = (): string => {
        try {
          const extracted = (aih.especialidade || '').toString().trim();
          if (extracted) return extracted;
          const care = normalizeCareCharacterStrict(aih.caracterAtendimento);
          const isUrgency = care === '2';
          let specialty = '01 - Cirúrgico';
          if (isUrgency) {
            const principal = (aih.procedimentoPrincipal || '').toString().toLowerCase();
            const isCesarean =
              /\bparto\b.*\bcesa/.test(principal) ||
              /\bces(ar|área|ariana|ariano)/.test(principal) ||
              principal.includes('cesarea') || principal.includes('cesárea');
            specialty = isCesarean ? '01 - Cirúrgico' : '03 - Clínico';
          }
          return specialty;
        } catch {
          return '01 - Cirúrgico';
        }
      };

      // 🆕 CAMPOS EXPANDIDOS COMPLETOS – preparos em PT e EN
      // Preferimos os nomes PT do seu schema; se falhar, tentamos EN como fallback.
      const expandedAihDataPT = {
        // Campos de situação e tipo (PT)
        situacao: aih.situacao || null,
        tipo: aih.tipo || null,

        // Datas importantes (PT)
        data_autorizacao: aih.dataAutorizacao || null,

        // CNS dos profissionais (PT)
        cns_autorizador: aih.cnsAutorizador || null,
        cns_solicitante: aih.cnsSolicitante || null,
        cns_responsavel: aih.cnsResponsavel || null,

        // AIHs relacionadas (PT)
        aih_anterior: aih.aihAnterior || null,
        aih_posterior: aih.aihPosterior || null,

        // Procedimento e mudanças (PT)
        procedimento_solicitado: aih.procedimentoSolicitado || null,
        mudanca_procedimento: aih.mudancaProc || false,

        // Encerramento (PT)
        motivo_encerramento: aih.motivoEncerramento || null,

        // Classificações de atendimento (PT)
        especialidade: (aih.especialidade && aih.especialidade.trim() !== '') ? aih.especialidade : resolveSpecialtyFromRules(),
        modalidade: aih.modalidade || null,
        caracter_atendimento: normalizedCareCharacter,

        // Estimativa financeira (PT – ajuste se sua coluna tiver outro nome)
        valor_original_estimado: (aih as any).estimatedOriginalValue ?? null
      } as Record<string, any>;

      // Versão EN (mantida para ambientes com colunas em inglês)
      const expandedAihDataEN = {
        situacao: aih.situacao || null,
        tipo: aih.tipo || null,
        data_autorizacao: aih.dataAutorizacao || null,
        cns_autorizador: aih.cnsAutorizador || null,
        cns_solicitante: aih.cnsSolicitante || null,
        cns_responsavel: aih.cnsResponsavel || null,
        aih_anterior: aih.aihAnterior || null,
        aih_posterior: aih.aihPosterior || null,
        procedure_requested: aih.procedimentoSolicitado || null,
        procedure_changed: aih.mudancaProc || false,
        discharge_reason: aih.motivoEncerramento || null,
        specialty: (aih.especialidade && aih.especialidade.trim() !== '') ? aih.especialidade : resolveSpecialtyFromRules(),
        care_modality: aih.modalidade || null,
        care_character: normalizedCareCharacter,
        estimated_original_value: (aih as any).estimatedOriginalValue ?? null
      } as Record<string, any>;
      
      // Tentar com campos expandidos primeiro (PT), depois EN, e por último básico
      let createdAIH: any;
      let usedVariant: 'PT' | 'EN' | 'BASIC' = 'PT';
      try {
      console.log('💾 Tentando criar AIH com schema expandido (PT)...', { idemKey });
        createdAIH = await AIHService.createAIH({ ...basicAihData, ...expandedAihDataPT } as any);
      console.log('✅ AIH criada com schema expandido (PT)!', { aihId: createdAIH.id, idemKey });
      } catch (ptError) {
        console.warn('⚠️ Falhou expandido (PT). Tentando expandido (EN)...', ptError);
        try {
          usedVariant = 'EN';
          createdAIH = await AIHService.createAIH({ ...basicAihData, ...expandedAihDataEN } as any);
          console.log('✅ AIH criada com schema expandido (EN)!', { aihId: createdAIH.id, idemKey });
        } catch (enError) {
          console.warn('⚠️ Falhou expandido (EN). Tentando schema básico...', enError);
          try {
            usedVariant = 'BASIC';
            createdAIH = await AIHService.createAIH(basicAihData as any);
            console.log('✅ AIH criada com schema básico!', { aihId: createdAIH.id, idemKey });
            console.log('📋 DICA: Ajuste o mapeamento PT/EN para salvar todos os campos.');
          } catch (basicError) {
            console.error('❌ Erro mesmo com schema básico:', basicError);
            throw basicError;
          }
        }
      }

      // Garantir preenchimento de campos pós-inserção (care_character/caracter_atendimento, cns_responsavel, competencia)
      try {
        // 1) Tentar setar care_character (EN). Se a coluna não existir, ignorar erro e tentar PT.
        try {
          await supabase
            .from('aihs')
            .update({ care_character: normalizedCareCharacter })
            .eq('id', createdAIH.id);
        } catch (e1) {
          try {
            await supabase
              .from('aihs')
              .update({ caracter_atendimento: normalizedCareCharacter })
              .eq('id', createdAIH.id);
          } catch (e2) {
            // Sem coluna correspondente neste schema; seguir adiante
          }
        }

        const updates: Record<string, any> = {};
        if (aih.cnsResponsavel && typeof aih.cnsResponsavel === 'string' && aih.cnsResponsavel.trim() !== '') {
          updates.cns_responsavel = aih.cnsResponsavel;
        }
        // Competência SUS: priorizar competência informada; fallback para mês de alta; fallback mês de admissão
        try {
          const compRaw = (aih as any).competencia as string | undefined;
          let competenciaDate: string | null = null;
          if (compRaw && /^(\d{4})-(\d{2})-\d{2}$/.test(compRaw)) {
            competenciaDate = compRaw; // já vem como YYYY-MM-01
          } else if (aih.dataFim) {
            const d = new Date(aih.dataFim);
            if (!isNaN(d.getTime())) {
              const y = d.getUTCFullYear();
              const m = String(d.getUTCMonth() + 1).padStart(2, '0');
              competenciaDate = `${y}-${m}-01`;
            }
          } else if (aih.dataInicio) {
            const d = new Date(aih.dataInicio);
            if (!isNaN(d.getTime())) {
              const y = d.getUTCFullYear();
              const m = String(d.getUTCMonth() + 1).padStart(2, '0');
              competenciaDate = `${y}-${m}-01`;
            }
          }
          if (competenciaDate) {
            updates.competencia = competenciaDate;
          }
        } catch {}
        if (Object.keys(updates).length > 0) {
          await supabase
            .from('aihs')
            .update(updates)
            .eq('id', createdAIH.id);
        }
      } catch (updateCnsErr) {
        console.warn('⚠️ Não foi possível atualizar campos pós-inserção (coluna pode não existir neste schema):', updateCnsErr);
      }

      // ️✅ GARANTIR RESTRIÇÃO: Médico responsável/solicitante/autorizador vinculados ao hospital
      try {
        await Promise.all([
          this.ensureDoctorAndHospitalLink(aih.cnsResponsavel || null, hospitalId, 'Responsável'),
          this.ensureDoctorAndHospitalLink(aih.cnsSolicitante || null, hospitalId, 'Solicitante'),
          this.ensureDoctorAndHospitalLink(aih.cnsAutorizador || null, hospitalId, 'Autorizador'),
        ]);
      } catch (guardError) {
        console.warn('⚠️ Aviso: não foi possível garantir todos os vínculos médico-hospital:', guardError);
      }

      return {
        success: true,
        aihId: createdAIH.id,
        message: `AIH ${aih.numeroAIH} criada com sucesso (${usedVariant === 'PT' ? 'schema expandido PT' : usedVariant === 'EN' ? 'schema expandido EN' : 'schema básico'})`,
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
   * ✅ NOVO: Verifica qualidade dos dados de AIHs (competencia, médico, etc.)
   * Usado para identificar discrepâncias entre telas
   */
  static async checkAIHDataQuality(hospitalId: string = 'ALL'): Promise<{
    total_aihs: number;
    missing_competencia: number;
    missing_doctor: number;
    missing_discharge_date: number;
    cross_month_admission_discharge: number;
    percentual_sem_competencia: number;
    percentual_sem_medico: number;
  }> {
    try {
      const { data, error } = await supabase.rpc('check_aih_quality', {
        p_hospital_id: hospitalId
      });

      if (error) {
        console.warn('⚠️ Função check_aih_quality não existe. Execute database/fix_missing_competencia.sql primeiro.');
        
        // Fallback: Query direta se a função não existir
        let query = supabase.from('aihs').select('*', { count: 'exact', head: false });
        
        if (hospitalId && hospitalId !== 'ALL') {
          query = query.eq('hospital_id', hospitalId);
        }
        
        const { data: aihs } = await query;
        
        const total = aihs?.length || 0;
        const missing_comp = aihs?.filter(a => !a.competencia).length || 0;
        const missing_doc = aihs?.filter(a => !a.cns_responsavel).length || 0;
        const missing_discharge = aihs?.filter(a => !a.discharge_date).length || 0;
        
        return {
          total_aihs: total,
          missing_competencia: missing_comp,
          missing_doctor: missing_doc,
          missing_discharge_date: missing_discharge,
          cross_month_admission_discharge: 0,
          percentual_sem_competencia: total > 0 ? Math.round((missing_comp / total) * 100 * 100) / 100 : 0,
          percentual_sem_medico: total > 0 ? Math.round((missing_doc / total) * 100 * 100) / 100 : 0
        };
      }

      return data as any;
    } catch (error) {
      console.error('❌ Erro ao verificar qualidade dos dados:', error);
      throw error;
    }
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
      const normalizedCNS = normalizeCNS(patientData.cns);
      const hasValidCNS = normalizedCNS.length === 15 && validateCNS(normalizedCNS);
      const payload = {
        ...patientData,
        cns: hasValidCNS ? normalizedCNS : ''
      };
      const { data, error } = await supabase
        .from('patients')
        .upsert([{
          ...payload,
          updated_at: new Date().toISOString()
        }], { onConflict: 'hospital_id,cns' })
        .select()
        .single();
      if (error) throw error;
      console.log('✅ Paciente salvo:', data.name);
      return data;
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
            care_character: normalizeCareCharacterStrict((aihData as any).care_character),
            // Persistir competência SUS como YYYY-MM-01
            competencia: (() => {
              const compRaw = (aihData as any).competencia as string | undefined;
              if (compRaw && /^(\d{4})-(\d{2})-\d{2}$/.test(compRaw)) return compRaw;
              const ref = aihData.discharge_date || aihData.admission_date;
              try {
                const d = ref ? new Date(ref) : null;
                if (d && !isNaN(d.getTime())) {
                  const y = d.getUTCFullYear();
                  const m = String(d.getUTCMonth() + 1).padStart(2, '0');
                  return `${y}-${m}-01`;
                }
              } catch {}
              return null;
            })(),
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
            care_character: normalizeCareCharacterStrict((aihData as any).care_character),
            competencia: (() => {
              const compRaw = (aihData as any).competencia as string | undefined;
              if (compRaw && /^(\d{4})-(\d{2})-\d{2}$/.test(compRaw)) return compRaw;
              const ref = aihData.discharge_date || aihData.admission_date;
              try {
                const d = ref ? new Date(ref) : null;
                if (d && !isNaN(d.getTime())) {
                  const y = d.getUTCFullYear();
                  const m = String(d.getUTCMonth() + 1).padStart(2, '0');
                  return `${y}-${m}-01`;
                }
              } catch {}
              return null;
            })(),
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
    dateFrom?: string;   // ✅ Filtra admission_date >= dateFrom (Data de Admissão)
    dateTo?: string;     // ✅ Filtra discharge_date <= dateTo (Data de Alta)
    patientName?: string;
    aihNumber?: string;
    search?: string;     // ✅ Busca livre: AIH, nome, CNS, prontuário
    processedBy?: string;
    limit?: number;
    offset?: number;
    careCharacter?: string; // ✅ Filtro de caráter de atendimento (1=Eletivo, 2=Urgência/Emergência)
    competencia?: string; // ✅ NOVO: Filtro de competência SUS (YYYY-MM-DD)
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
          ),
          hospitals (
            id,
            name
          )
        `);

      // ✅ MODO ADMINISTRADOR: Se hospitalId for "ALL", undefined ou inválido, não filtrar por hospital
      const isAdminMode = !hospitalId || hospitalId === 'ALL' || hospitalId === 'undefined';
      
      if (!isAdminMode) {
        query = query.eq('hospital_id', hospitalId);
      }
      
      query = query.order('discharge_date', { ascending: false });
      query = query.order('admission_date', { ascending: false });
      query = query.order('updated_at', { ascending: false });

      // Aplicar filtros
      if (filters?.status) {
        query = query.eq('processing_status', filters.status);
      }
      
      // ✅ CORREÇÃO: Filtros independentes de Admissão e Alta
      // dateFrom → sempre filtra admission_date (Data de Admissão)
      if (filters?.dateFrom) {
        query = query.gte('admission_date', filters.dateFrom);
      }
      
      // dateTo → sempre filtra discharge_date (Data de Alta)
      if (filters?.dateTo) {
        query = query.lte('discharge_date', filters.dateTo);
        // Se filtrar por alta, excluir AIHs sem discharge_date
        query = query.not('discharge_date', 'is', null);
      }
      
      if (filters?.aihNumber) {
        query = query.ilike('aih_number', `%${filters.aihNumber}%`);
      }

      // ✅ Busca livre (AIH, nome do paciente, CNS, prontuário)
      if (filters?.search) {
        const term = filters.search.trim();
        if (term.length > 0) {
          query = query.or(
            `aih_number.ilike.%${term}%,patients.name.ilike.%${term}%,patients.cns.ilike.%${term}%,patients.medical_record.ilike.%${term}%`
          );
        }
      }

      // ✅ OTIMIZADO: Filtro de caráter de atendimento
      if (filters?.careCharacter) {
        query = query.eq('care_character', filters.careCharacter);
      }

      // ✅ NOVO: Filtro de competência SUS (formato: YYYY-MM-DD)
      if (filters?.competencia && filters.competencia !== 'all') {
        // 🆕 OPÇÃO ESPECIAL: Mostrar apenas AIHs SEM competência
        if (filters.competencia === 'sem_competencia') {
          query = query.is('competencia', null);
        } else {
          // Filtro normal: mostrar apenas a competência selecionada
          query = query.eq('competencia', filters.competencia);
        }
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

      // Buscar informações do usuário atual (temporário até corrigir foreign keys)
      const currentUser = JSON.parse(sessionStorage.getItem('current_user') || '{}');
      const userName = currentUser.full_name || currentUser.email || 'Operador do Sistema';

      // Normalização segura do caráter de atendimento (fallback padrão '1')
      const normalizeCareCharacter = (aih: any): '1' | '2' => {
        const raw = (
          aih?.care_character ??
          aih?.caracter_atendimento ??
          aih?.source_data?.care_character ??
          aih?.source_data?.caracterAtendimento ??
          aih?.source_data?.caracter_atendimento
        );
        return normalizeCareCharacterStrict(raw);
      };

      // Processar dados para incluir informações do operador e normalizar care_character
      const processedData = (data || []).map(aih => {
        const normalizedCare = normalizeCareCharacter(aih);
        return {
          ...aih,
          care_character: normalizedCare || '1',
          processed_by_name: userName, // Nome real do usuário logado
          processed_at_formatted: aih.processed_at ? 
            new Date(aih.processed_at).toLocaleDateString('pt-BR', {
              day: '2-digit',
              month: '2-digit', 
              year: 'numeric',
              hour: '2-digit',
              minute: '2-digit'
            }) : 
            new Date(aih.created_at).toLocaleDateString('pt-BR', {
              day: '2-digit',
              month: '2-digit', 
              year: 'numeric',
              hour: '2-digit',
              minute: '2-digit'
            })
        };
      });

      // Filtrar por operador se fornecido (temporariamente desabilitado)
      // if (filters?.processedBy) {
      //   return processedData.filter(aih => 
      //     aih.processed_by_name?.toLowerCase().includes(filters.processedBy!.toLowerCase())
      //   );
      // }

      return processedData;
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
          ),
          hospitals (
            id,
            name
          )
        `);

      // ✅ MODO ADMINISTRADOR: Se hospitalId for "ALL", undefined ou inválido, não filtrar por hospital
      const isAdminMode = !hospitalId || hospitalId === 'ALL' || hospitalId === 'undefined';
      
      if (!isAdminMode) {
        query = query.eq('hospital_id', hospitalId);
      }
      
      query = query.order('name', { ascending: true });

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
   * Conta AIHs de um hospital (ou de todos, se admin) com filtros – usa count exato sem limite de 1000
   */
  async countAIHs(hospitalId: string, filters?: {
    status?: string;
    dateFrom?: string;
    dateTo?: string;
  }): Promise<number> {
    try {
      const isAdminMode = !hospitalId || hospitalId === 'ALL' || hospitalId === 'undefined';
      let query = supabase
        .from('aihs')
        .select('id', { count: 'exact', head: true });

      if (!isAdminMode) {
        query = query.eq('hospital_id', hospitalId);
      }

      if (filters?.status) {
        query = query.eq('processing_status', filters.status);
      }
      if (filters?.dateFrom) {
        query = query.gte('admission_date', filters.dateFrom);
      }
      if (filters?.dateTo) {
        query = query.lte('admission_date', filters.dateTo);
      }

      const { count, error } = await query;
      if (error) throw error;
      return count || 0;
    } catch (error) {
      console.error('❌ Erro ao contar AIHs:', error);
      throw error;
    }
  }

  /**
   * Busca estatísticas do hospital (ou de todos os hospitais se for admin)
   */
  async getHospitalStats(hospitalId: string) {
    try {
      // ✅ MODO ADMINISTRADOR: Se hospitalId for "ALL", undefined ou inválido, agregar todos os hospitais
      const isAdminMode = !hospitalId || hospitalId === 'ALL' || hospitalId === 'undefined';
      
      console.log(`📊 [getHospitalStats] Modo: ${isAdminMode ? 'ADMIN (todos hospitais)' : `USUÁRIO (hospital: ${hospitalId})`}`);
      
      // Base queries (aplicando filtro por hospital quando necessário)
      const baseAIHFilter = (q: any) => isAdminMode ? q : q.eq('hospital_id', hospitalId);

      // ✅ Contagens robustas sem limite de 1000 (usa count exato com head=true)
      // IMPORTANTE: Em modo admin, não aplicar filtro de hospital para contar TODAS as AIHs
      let totalCountQuery = supabase.from('aihs').select('id', { count: 'exact', head: true });
      if (!isAdminMode) {
        totalCountQuery = totalCountQuery.eq('hospital_id', hospitalId);
      }
      // ✅ Queries para status específicos (aplicar filtro apenas se não for admin)
      let pendingCountQuery = supabase.from('aihs').select('id', { count: 'exact', head: true }).eq('processing_status', 'pending');
      let completedCountQuery = supabase.from('aihs').select('id', { count: 'exact', head: true }).eq('processing_status', 'completed');
      let aihsCountQuery = supabase.from('aihs').select('id', { count: 'exact', head: true });
      
      if (!isAdminMode) {
        pendingCountQuery = pendingCountQuery.eq('hospital_id', hospitalId);
        completedCountQuery = completedCountQuery.eq('hospital_id', hospitalId);
        aihsCountQuery = aihsCountQuery.eq('hospital_id', hospitalId);
      }

      const [
        { count: totalAIHs, error: totalError },
        { count: pendingAIHs, error: pendingError },
        { count: completedAIHs, error: completedError },
        { count: aihsCount, error: aihsCountError }
      ] = await Promise.all([
        totalCountQuery,
        pendingCountQuery,
        completedCountQuery,
        aihsCountQuery
      ]);

      // ✅ DEBUG: Log dos resultados das queries
      console.log(`📊 [getHospitalStats] Resultados das queries:`, {
        totalAIHs: totalAIHs || 0,
        totalError: totalError?.message,
        pendingAIHs: pendingAIHs || 0,
        pendingError: pendingError?.message,
        completedAIHs: completedAIHs || 0,
        completedError: completedError?.message,
        aihsCount: aihsCount || 0,
        aihsCountError: aihsCountError?.message
      });

      // ✅ VALIDAÇÃO: Se houver erro na query principal, logar e usar 0 como fallback
      if (totalError) {
        console.error('❌ [getHospitalStats] Erro ao contar TOTAL DE AIHs:', totalError);
      }

      // Calcular número de hospitais com AIHs processadas (modo admin)
      let processedHospitalsCount: number | undefined = undefined;
      if (isAdminMode) {
        try {
          // ✅ OTIMIZAÇÃO: Usar diretamente o fallback (view pode não existir e gera 404 no console)
          // Contar DISTINCT hospital_id diretamente na tabela aihs
          const { data: distinctHospitals, error: distinctErr } = await supabase
            .from('aihs')
            .select('hospital_id', { head: false })
            .not('hospital_id', 'is', null);
          
          if (distinctErr) {
            console.warn('⚠️ [getHospitalStats] Erro ao contar hospitais distintos:', distinctErr);
            processedHospitalsCount = 0;
          } else {
            const unique = new Set((distinctHospitals || []).map((r: any) => r.hospital_id).filter(Boolean));
            processedHospitalsCount = unique.size;
            console.log(`✅ [getHospitalStats] Hospitais contados: ${processedHospitalsCount}`);
          }
        } catch (e) {
          console.warn('⚠️ [getHospitalStats] Erro ao contar hospitais distintos:', e);
          processedHospitalsCount = 0;
        }
      }

      // ✅ total_patients agora representa total de AIHs (não pacientes únicos)
      // Isso permite contar corretamente pacientes com múltiplas AIHs
      const finalTotalAIHs = totalAIHs ?? 0; // ✅ Garantir que nunca seja null/undefined
      
      const stats = {
        total_aihs: finalTotalAIHs, // ✅ Usar valor garantido (não null/undefined)
        pending_aihs: pendingAIHs || 0,
        completed_aihs: completedAIHs || 0,
        total_patients: aihsCount || 0, // Representa total de AIHs/internações
        total_value: 0,
        average_value: 0,
        hospitals_count: isAdminMode ? (processedHospitalsCount ?? 0) : 1,
        is_admin_mode: isAdminMode
      };

      console.log(`📊 [getHospitalStats] Estatísticas ${isAdminMode ? 'de TODOS os hospitais' : `do hospital ${hospitalId}`}:`, stats);
      console.log(`✅ [getHospitalStats] TOTAL DE AIHs retornado: ${stats.total_aihs}`);
      
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

      // 🚫 BLOQUEIO: Médico responsável deve existir previamente
      const cnsResp = (aihCompleta.cnsResponsavel || '').trim();
      if (cnsResp) {
        const exists = await this.doctorExistsByCNS(cnsResp);
        if (!exists) {
          return {
            success: false,
            message: `Médico responsável (CNS ${cnsResp}) não encontrado. Cadastre o médico antes de salvar a AIH.`,
            errors: ['doctor_not_found']
          };
        }
      }

      // ✅ VERIFICAÇÃO INTELIGENTE DE DUPLICATAS
      console.log('🔍 Verificando duplicatas com lógica inteligente...');
      
      if (aihCompleta.numeroAIH === "-") {
        // 🆕 LÓGICA ESPECIAL PARA AIHs SEM NÚMERO: Controle por paciente + data + procedimento
        console.log('🔧 AIH sem número detectada - aplicando controle por paciente + data + procedimento');
        
        const isDuplicate = await this.checkDashAIHDuplicate(
          aihCompleta,
          hospitalId
        );
        
        if (isDuplicate) {
          console.warn(`⚠️ Possível duplicata detectada para paciente ${aihCompleta.nomePaciente}`);
          return {
            success: false,
            message: `Possível duplicata: já existe AIH para paciente "${aihCompleta.nomePaciente}" na data ${aihCompleta.dataInicio} com procedimento similar. Verifique se não é a mesma internação.`,
            errors: ['Possível duplicata por controle inteligente - verifique manualmente']
          };
        }
        
        console.log('✅ Nenhuma duplicata detectada para AIH sem número - prosseguindo...');
      } else {
        // 🔄 LÓGICA NORMAL PARA AIHs COM NÚMERO
        console.log('🔍 Verificando duplicata por número de AIH...');
        const { data: existingAIHs, error: checkError } = await supabase
          .from('aihs')
          .select('id, aih_number, created_at')
          .eq('hospital_id', hospitalId)
          .eq('aih_number', aihCompleta.numeroAIH);

        if (checkError) {
          console.warn('⚠️ Erro na verificação de duplicatas:', checkError);
          // Continue mesmo com erro na verificação
        }

        if (existingAIHs && existingAIHs.length > 0) {
          const existingAIH = existingAIHs[0];
          console.warn(`⚠️ AIH ${aihCompleta.numeroAIH} já existe no sistema (ID: ${existingAIH.id})`);
          return {
            success: false,
            message: `AIH ${aihCompleta.numeroAIH} já existe no sistema (salva em ${new Date(existingAIH.created_at).toLocaleDateString()})`,
            errors: ['AIH duplicada - use a função de edição para atualizar']
          };
        }
      }

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
            console.log(`🔍 PROCEDIMENTO ${procedure.sequencia}: quantity=${procedure.quantity} (tipo: ${typeof procedure.quantity})`);
            // Resolver nome do profissional priorizando cadastro do médico
            let resolvedProfessionalName: string | undefined = procedure.nomeProfissional;
            try {
              // 1) Tentar via doctors por CNS do responsável da AIH
              if (!resolvedProfessionalName && aihCompleta?.cnsResponsavel) {
                const { data: docData } = await supabase
                  .from('doctors')
                  .select('name')
                  .eq('cns', aihCompleta.cnsResponsavel)
                  .single();
                if (docData?.name) resolvedProfessionalName = docData.name;
              }
              // 2) Tentar via médico solicitante na própria AIH
              if (!resolvedProfessionalName && aihCompleta?.medicoSolicitante) {
                resolvedProfessionalName = aihCompleta.medicoSolicitante;
              }
            } catch {}

            // Salvar procedimento na tabela procedure_records - MAPEAMENTO CORRIGIDO
            const procedureRecord = await this.saveProcedureRecordFixed({
              hospital_id: hospitalId,
              patient_id: patientId,
              aih_id: aihId,
              procedure_code: procedure.procedimento,
              procedure_description: procedure.descricao || '',
              sequencia: procedure.sequencia, // ✅ CAMPO CORRETO
              professional_document: procedure.documentoProfissional,
              professional_name: resolvedProfessionalName || 'MÉDICO RESPONSÁVEL',
              cbo: procedure.cbo,
              participation: procedure.participacao,
              cnes: procedure.cnes,
              procedure_date: convertBrazilianDateToISO(procedure.data),
              accepted: procedure.aceitar,
              calculated_value: procedure.valorCalculado || 0,
              original_value: procedure.valorOriginal || 0,
              sus_percentage: procedure.porcentagemSUS || 100,
              match_status: 'matched', // ✅ VALOR PERMITIDO NA CONSTRAINT
              match_confidence: procedure.matchConfidence || 0,
              approved: true, // ✅ SEMPRE TRUE POR PADRÃO (LÓGICA SUS)
              notes: procedure.observacoes || '',
              aih_number: aihCompleta.numeroAIH,
              care_modality: aihCompleta.modalidade,
              care_character: normalizeCareCharacterStrict(aihCompleta.caracterAtendimento),
              quantity: procedure.quantity || 1 // 🆕 NOVO: Campo quantidade
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
   * 🛡️ FUNÇÃO ROBUSTA: Salva procedimento com detecção automática de schema
   * Funciona tanto com schema original quanto expandido
   */
  private static async saveProcedureRecordFixed(data: any): Promise<any> {
    console.log(`🔧 SALVANDO PROCEDIMENTO (MODO ROBUSTO): ${data.procedure_code}`);
    console.log(`📊 QUANTIDADE RECEBIDA: ${data.quantity} (tipo: ${typeof data.quantity})`);
    
    // Buscar procedure_id do SIGTAP se existe match
    let procedureId = null;
    if (data.procedure_code) {
      try {
        const { data: sigtapProcs, error: searchError } = await supabase
          .from('sigtap_procedures')
          .select('id')
          .eq('code', data.procedure_code);
        
        if (!searchError && sigtapProcs && sigtapProcs.length > 0) {
          procedureId = sigtapProcs[0].id;
          console.log(`✅ Procedimento SIGTAP encontrado: ${data.procedure_code} -> ${procedureId}`);
        } else if (searchError) {
          console.warn(`⚠️ Erro na busca SIGTAP para ${data.procedure_code}:`, searchError.message);
        }
      } catch (error) {
        console.warn(`⚠️ SIGTAP não disponível para ${data.procedure_code}, continuando sem referência`);
      }
    }

    // Se não encontrou no SIGTAP, buscar qualquer um como referência (para FK)
    if (!procedureId) {
      try {
        const { data: firstProc } = await supabase
          .from('sigtap_procedures')
          .select('id')
          .limit(1)
          .single();
        
        if (firstProc) {
          procedureId = firstProc.id;
          console.log(`⚠️ Usando procedimento SIGTAP genérico como referência: ${procedureId}`);
        }
      } catch (error) {
        console.warn('⚠️ Nenhum procedimento SIGTAP disponível, continuando sem procedure_id');
        // Procedemos sem procedure_id se a tabela SIGTAP não existir
      }
    }

    // 🎯 Resolver médico: tentar vincular a doctors e usar nome real
    let resolvedProfessionalName: string | undefined = data.professional_name;
    let resolvedDoctorId: string | null = null;
    try {
      const cnsRaw = (data.professional_document || data.professional_cns || '').toString().trim();
      const crmRaw = (data.professional_cbo || '').toString().trim();
      if (cnsRaw) {
        const { data: docByCNS } = await supabase
          .from('doctors')
          .select('id, name')
          .eq('cns', cnsRaw)
          .single();
        if (docByCNS?.id) {
          resolvedDoctorId = docByCNS.id;
          resolvedProfessionalName = docByCNS.name || resolvedProfessionalName;
        }
      }
      if (!resolvedDoctorId && crmRaw) {
        const { data: docByCRM } = await supabase
          .from('doctors')
          .select('id, name')
          .eq('crm', crmRaw)
          .single();
        if (docByCRM?.id) {
          resolvedDoctorId = docByCRM.id;
          resolvedProfessionalName = docByCRM.name || resolvedProfessionalName;
        }
      }
    } catch (e) {
      console.warn('⚠️ Falha ao resolver médico por CNS/CRM, seguindo com fallback:', e);
    }

    // Fallback: usar requesting_physician da AIH se disponível via data.aih_requesting_physician
    if (!resolvedProfessionalName && data.aih_requesting_physician) {
      resolvedProfessionalName = data.aih_requesting_physician;
    }

    // 🎯 MAPEAMENTO ROBUSTO - Usando nomes EXATOS do schema do usuário
    const basicRecord: any = {
      id: crypto.randomUUID(),
      hospital_id: data.hospital_id,
      patient_id: data.patient_id,
      aih_id: data.aih_id,
      
      // ✅ CAMPOS USANDO NOMES CORRETOS DO SCHEMA
      procedure_code: data.procedure_code,
      procedure_description: data.procedure_description || data.procedure_code,
      procedure_date: data.procedure_date ? convertBrazilianDateToISO(data.procedure_date) : new Date().toISOString().split('T')[0],  // Nome correto!
      
      // Profissional responsável  
      professional_name: resolvedProfessionalName || 'PROFISSIONAL NÃO INFORMADO',
      professional_cbo: data.cbo || 'N/A',
      professional_cns: data.professional_document || 'N/A',
      
      // Valores financeiros (em centavos)
      quantity: data.quantity || 1, // 🆕 USAR QUANTIDADE DO PROCEDIMENTO
      unit_value: Math.round(((data.calculated_value || 0) / (data.quantity || 1)) * 100), // Valor unitário
      total_value: Math.round((data.calculated_value || 0) * 100),
      value_charged: Math.round((data.calculated_value || 0) * 100), // Campo obrigatório!
      
      // Autorização
      authorization_number: data.aih_number || 'N/A',
      authorization_type: 'AIH',
      
      // Status
      status: data.approved ? 'approved' : 'pending',
      billing_status: 'pending',
      
      // Modalidade e caráter
      care_modality: data.care_modality || 'hospitalar',
      care_character: data.care_character || 'eletivo',
      
      // Observações básicas
      notes: data.notes || `Sequência: ${data.sequence || 'N/A'}`,
      
      // Auditoria
      created_at: new Date().toISOString(),
      validation_status: data.match_status || 'pending',
      source_system: 'sigtap-billing-wizard',
      external_id: `${data.aih_id}_seq_${data.sequence}`,
      complexity: data.complexity || 'media',
      financing_type: 'SUS',
      execution_location: data.cnes || 'MESMO ESTABELECIMENTO',
      instrument: 'SISTEMA_SIGTAP',
      
      // ✅ CAMPO OBRIGATÓRIO execution_date (existe no schema!)
      execution_date: data.procedure_date || new Date().toISOString()
    };

    // Adicionar procedure_id apenas se encontrado
    if (procedureId) {
      basicRecord.procedure_id = procedureId;
    }
    // Adicionar doctor_id se resolvido
    if (resolvedDoctorId) {
      basicRecord.doctor_id = resolvedDoctorId;
    }

    // 🆕 CAMPOS EXPANDIDOS - Usando nomes EXATOS do schema
    const expandedFields = {
      sequencia: data.sequencia || null, // ✅ NOME CORRETO
      codigo_procedimento_original: data.procedure_code,  // Nome correto!
      documento_profissional: data.professional_document || null,
      participacao: data.participation || null,
      cnes: data.cnes || null,
      valor_original: Math.round((data.original_value || 0) * 100),
      porcentagem_sus: data.sus_percentage || 100,
      aprovado: data.approved || false,
      match_confidence: data.match_confidence || 0,
      observacoes: data.notes || null,
      match_status: data.match_status || 'matched' // ✅ VALOR PERMITIDO
    };

    console.log(`📋 Tentando salvar com mapeamento ROBUSTO:`, {
      procedure_code: basicRecord.procedure_code,
      sequence: data.sequence,
      unit_value_reais: (basicRecord.unit_value / 100).toFixed(2),
      professional: basicRecord.professional_name,
      status: basicRecord.status
    });

    // 🔄 TENTATIVA 1: Schema expandido (com novos campos)
    try {
      console.log('📊 Tentativa 1: Salvando com schema EXPANDIDO...');
      const expandedRecord = { ...basicRecord, ...expandedFields };
      
      const { data: result, error } = await supabase
        .from('procedure_records')
        .insert([expandedRecord])
        .select()
        .single();

      if (error) {
        throw error;
      }
      
      console.log('✅ SUCESSO: Procedimento salvo com schema EXPANDIDO!');
      return result;

    } catch (expandedError) {
      console.warn('⚠️ Schema expandido falhou, tentando schema BÁSICO...', expandedError.message);

      // 🔄 TENTATIVA 2: Schema básico (apenas campos originais)
      try {
        console.log('📊 Tentativa 2: Salvando com schema BÁSICO...');
        
        const { data: result, error } = await supabase
          .from('procedure_records')
          .insert([basicRecord])
          .select()
          .single();

        if (error) {
          throw error;
        }
        
        console.log('✅ SUCESSO: Procedimento salvo com schema BÁSICO!');
        console.log('💡 DICA: Execute a migração do banco para salvar todos os campos');
        return result;

      } catch (basicError) {
        console.error('❌ FALHA: Erro mesmo com schema básico:', basicError);
        
        // 🔄 TENTATIVA 3: Schema mínimo (campos essenciais apenas)
        try {
          console.log('📊 Tentativa 3: Salvando com schema MÍNIMO...');
          
          const minimalRecord: any = {
            id: basicRecord.id,
            hospital_id: basicRecord.hospital_id,
            patient_id: basicRecord.patient_id,
            aih_id: basicRecord.aih_id,
            procedure_code: basicRecord.procedure_code,
            procedure_description: basicRecord.procedure_description,
            procedure_date: basicRecord.procedure_date,  // Campo obrigatório!
            value_charged: basicRecord.value_charged,    // Campo obrigatório!
            total_value: basicRecord.total_value,
            status: basicRecord.status,
            created_at: basicRecord.created_at
          };

          // Adicionar procedure_id apenas se disponível
          if (procedureId) {
            minimalRecord.procedure_id = procedureId;
          }
          
          const { data: result, error } = await supabase
            .from('procedure_records')
            .insert([minimalRecord])
            .select()
            .single();

          if (error) {
            throw error;
          }
          
          console.log('✅ SUCESSO: Procedimento salvo com schema MÍNIMO!');
          console.log('⚠️ AVISO: Apenas campos essenciais foram salvos');
          return result;

        } catch (minimalError) {
          console.error('❌ ERRO CRÍTICO: Falha em todos os schemas:', minimalError);
          console.error('📋 Detalhes do erro mínimo:', minimalError);
          
          // 🔄 TENTATIVA 4: Ultra-mínimo (apenas 6 campos obrigatórios)
          try {
            console.log('📊 Tentativa 4: Schema ULTRA-MÍNIMO (apenas obrigatórios)...');
            
            const ultraMinimalRecord: any = {
              id: crypto.randomUUID(),
              hospital_id: data.hospital_id,
              patient_id: data.patient_id,
              procedure_date: new Date().toISOString(),
              value_charged: Math.round((data.calculated_value || 0) * 100)
            };

            // Adicionar procedure_id apenas se disponível
            if (procedureId) {
              ultraMinimalRecord.procedure_id = procedureId;
            }
            
            const { data: result, error } = await supabase
              .from('procedure_records')
              .insert([ultraMinimalRecord])
              .select()
              .single();

            if (error) {
              throw error;
            }
            
            console.log('✅ SUCESSO: Procedimento salvo com schema ULTRA-MÍNIMO!');
            console.log('⚠️ AVISO: Apenas 6 campos obrigatórios foram salvos');
            return result;

          } catch (ultraMinimalError) {
            console.error('❌ ERRO FINAL: Falha até com campos obrigatórios:', ultraMinimalError);
            throw new Error(`Falha crítica ao salvar procedimento: ${ultraMinimalError.message}`);
          }
        }
      }
    }
  }

  /**
   * Salva um match SIGTAP na tabela aih_matches
   */
  private static async saveAIHMatch(data: any): Promise<any> {
    console.log(`🔧 SALVANDO MATCH SIGTAP CORRIGIDO: ${data.sigtap_procedure.code}`);
    
    // Buscar o ID do procedimento SIGTAP
    const { data: sigtapProcs, error: sigtapError } = await supabase
      .from('sigtap_procedures')
      .select('id')
      .eq('code', data.sigtap_procedure.code);

    if (sigtapError || !sigtapProcs || sigtapProcs.length === 0) {
      console.warn(`⚠️ Procedimento SIGTAP não encontrado: ${data.sigtap_procedure.code}`);
      return null;
    }

    const sigtapProc = sigtapProcs[0];

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
   * 🛡️ ROBUSTO: Atualiza estatísticas da AIH com detecção automática de schema
   */
  private static async updateAIHStatistics(aihId: string, stats: any): Promise<void> {
    console.log('📊 Atualizando estatísticas da AIH (MODO ROBUSTO)...');
    
    // 🎯 Campos básicos que sempre existem
    const basicStats = {
      match_found: stats.match_found || false,
      processing_status: 'processing'  // ✅ VALOR VÁLIDO: apenas 'pending' ou 'processing'
    };

    // 🆕 Campos expandidos - tentativa se o schema suportar
    const expandedStats = {
      total_procedures: stats.total_procedures || 0,
      approved_procedures: stats.approved_procedures || 0,
      rejected_procedures: stats.rejected_procedures || 0,
      calculated_total_value: stats.calculated_total_value || 0,
      requires_manual_review: stats.requires_manual_review || false
    };

    // 🔄 TENTATIVA 1: Schema expandido
    try {
      console.log('📊 Tentativa 1: Atualizando com schema EXPANDIDO...');
      const fullStats = { ...basicStats, ...expandedStats };
      
      const { error } = await supabase
        .from('aihs')
        .update(fullStats)
        .eq('id', aihId);

      if (error) {
        throw error;
      }
      
      console.log('✅ SUCESSO: Estatísticas atualizadas com schema EXPANDIDO!');
      return;

    } catch (expandedError) {
      console.warn('⚠️ Schema expandido falhou, tentando schema BÁSICO...', expandedError.message);

      // 🔄 TENTATIVA 2: Schema básico
      try {
        console.log('📊 Tentativa 2: Atualizando com schema BÁSICO...');
        
        const { error } = await supabase
          .from('aihs')
          .update(basicStats)
          .eq('id', aihId);

        if (error) {
          throw error;
        }
        
        console.log('✅ SUCESSO: Estatísticas atualizadas com schema BÁSICO!');
        console.log('💡 DICA: Execute a migração do banco para salvar todas as estatísticas');
        return;

      } catch (basicError) {
        console.error('❌ FALHA: Erro mesmo com schema básico:', basicError);
        
        // 🔄 TENTATIVA 3: Sem atualização de estatísticas
        console.warn('⚠️ Pulando atualização de estatísticas da AIH devido a incompatibilidade de schema');
        return; // Não falha, apenas pula a atualização
      }
    }
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
   * NOVO: Exclusão COMPLETA de AIH + Paciente (se não tiver outras AIHs)
   * Esta função é uma versão mais inteligente que verifica se o paciente
   * tem outras AIHs antes de excluí-lo também
   */
  async deleteCompleteAIH(aihId: string, userId: string, options?: {
    forceDeletePatient?: boolean;
    keepAuditTrail?: boolean;
  }): Promise<{
    aihDeleted: boolean;
    patientDeleted: boolean;
    patientId?: string;
    patientName?: string;
    message: string;
  }> {
    try {
      console.log('🗑️ === EXCLUSÃO COMPLETA INICIADA ===');
      console.log('📋 AIH ID:', aihId);
      console.log('👤 Usuário:', userId);
      console.log('⚙️ Opções:', options);

      // 1. Buscar informações da AIH antes de deletar
      const { data: aihInfo, error: aihInfoError } = await supabase
        .from('aihs')
        .select(`
          id,
          patient_id,
          aih_number,
          procedure_code,
          admission_date,
          patients!inner (
            id,
            name,
            cns,
            hospital_id
          )
        `)
        .eq('id', aihId)
        .single();

      if (aihInfoError || !aihInfo) {
        throw new Error(`AIH não encontrada: ${aihId}`);
      }

      const patientId = aihInfo.patient_id;
      const patientName = (aihInfo.patients as any).name;
      const hospitalId = (aihInfo.patients as any).hospital_id;

      console.log('👤 Paciente encontrado:', patientName, `(${patientId})`);

      // 2. Log de auditoria ANTES da exclusão (se requerido)
      if (options?.keepAuditTrail) {
        await this.logAuditEvent({
          action: 'DELETE_COMPLETE_AIH',
          table_name: 'aihs',
          record_id: aihId,
          details: {
            aih_number: aihInfo.aih_number,
            patient_id: patientId,
            patient_name: patientName,
            procedure_code: aihInfo.procedure_code,
            deletion_reason: 'Complete deletion requested',
            force_delete_patient: options?.forceDeletePatient || false
          },
          user_id: userId
        });
      }

      // 3. Verificar se o paciente tem outras AIHs
      const { data: otherAIHs, error: otherAIHsError } = await supabase
        .from('aihs')
        .select('id, aih_number')
        .eq('patient_id', patientId)
        .neq('id', aihId);

      if (otherAIHsError) {
        console.warn('⚠️ Erro ao verificar outras AIHs:', otherAIHsError);
      }

      const hasOtherAIHs = otherAIHs && otherAIHs.length > 0;
      console.log(`🔍 Outras AIHs do paciente: ${hasOtherAIHs ? otherAIHs.length : 0}`);

      // 4. Exclusão dos dados relacionados à AIH
      console.log('🗑️ Deletando dados relacionados à AIH...');

      // 4a. Deletar registros de auditoria da AIH (se não manter trilha)
      if (!options?.keepAuditTrail) {
        const { error: auditError } = await supabase
          .from('audit_logs')
          .delete()
          .eq('record_id', aihId);

        if (auditError) {
          console.warn('⚠️ Erro ao deletar logs de auditoria:', auditError);
        }
      }

      // 4b. Deletar registros de procedimentos
      const { error: procedureError } = await supabase
        .from('procedure_records')
        .delete()
        .eq('aih_id', aihId);

      if (procedureError) {
        console.warn('⚠️ Erro ao deletar procedimentos:', procedureError);
      }

      // 4c. Deletar matches dos procedimentos
      const { error: matchError } = await supabase
        .from('aih_matches')
        .delete()
        .eq('aih_id', aihId);

      if (matchError) {
        console.warn('⚠️ Erro ao deletar matches:', matchError);
      }

      // 5. Deletar a AIH
      const { error: aihError } = await supabase
        .from('aihs')
        .delete()
        .eq('id', aihId);

      if (aihError) {
        throw new Error(`Erro ao deletar AIH: ${aihError.message}`);
      }

      console.log('✅ AIH deletada com sucesso');

      // 6. Decidir se deve deletar o paciente
      let patientDeleted = false;
      let shouldDeletePatient = false;

      if (options?.forceDeletePatient) {
        shouldDeletePatient = true;
        console.log('🔧 Forçando exclusão do paciente');
      } else if (!hasOtherAIHs) {
        shouldDeletePatient = true;
        console.log('👤 Paciente não tem outras AIHs, será excluído');
      } else {
        console.log('👤 Paciente mantido (possui outras AIHs)');
      }

      // 7. Executar exclusão do paciente se necessário
      if (shouldDeletePatient) {
        console.log('🗑️ Deletando paciente...');

        // 7a. Deletar logs de auditoria do paciente (se não manter trilha)
        if (!options?.keepAuditTrail) {
          const { error: patientAuditError } = await supabase
            .from('audit_logs')
            .delete()
            .eq('record_id', patientId);

          if (patientAuditError) {
            console.warn('⚠️ Erro ao deletar logs de auditoria do paciente:', patientAuditError);
          }
        }

        // 7b. Deletar todas as AIHs restantes do paciente (se forçado)
        if (options?.forceDeletePatient && hasOtherAIHs) {
          console.log('🔥 Forçando exclusão de todas as AIHs do paciente...');
          
          for (const otherAIH of otherAIHs) {
            await this.deleteAIH(otherAIH.id);
          }
        }

        // 7c. Deletar o paciente
        const { error: patientError } = await supabase
          .from('patients')
          .delete()
          .eq('id', patientId);

        if (patientError) {
          console.warn('⚠️ Erro ao deletar paciente:', patientError);
        } else {
          patientDeleted = true;
          console.log('✅ Paciente deletado com sucesso');
        }
      }

      // 8. Log final de auditoria (se requerido)
      if (options?.keepAuditTrail) {
        await this.logAuditEvent({
          action: 'COMPLETE_DELETION_FINISHED',
          table_name: 'system',
          record_id: null,
          details: {
            aih_id: aihId,
            patient_id: patientId,
            patient_deleted: patientDeleted,
            other_aihs_count: hasOtherAIHs ? otherAIHs.length : 0,
            final_status: 'SUCCESS'
          },
          user_id: userId
        });
      }

      // 9. Resultado final
      const result = {
        aihDeleted: true,
        patientDeleted,
        patientId,
        patientName,
        message: patientDeleted 
          ? `AIH e paciente ${patientName} excluídos completamente`
          : `AIH excluída. Paciente ${patientName} mantido (possui outras AIHs)`
      };

      console.log('🎯 === EXCLUSÃO COMPLETA FINALIZADA ===');
      console.log('📊 Resultado:', result);

      return result;

    } catch (error) {
      console.error('❌ Erro na exclusão completa:', error);

      // Log de erro (se requerido)
      if (options?.keepAuditTrail) {
        try {
          await this.logAuditEvent({
            action: 'COMPLETE_DELETION_ERROR',
            table_name: 'system',
            record_id: null,
            details: {
              aih_id: aihId,
              error_message: error instanceof Error ? error.message : 'Erro desconhecido',
              error_stack: error instanceof Error ? error.stack : undefined
            },
            user_id: userId
          });
        } catch (logError) {
          console.error('❌ Erro ao registrar log de erro:', logError);
        }
      }

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







  /**
   * NOVO: Recalcula estatísticas da AIH após mudanças nos procedimentos
   */
  private async recalculateAIHStatistics(aihId: string): Promise<void> {
    try {
      console.log(`🔄 Recalculando estatísticas da AIH ${aihId}...`);

      // 1. Buscar todos os procedimentos ativos da AIH
      const { data: procedures, error: procError } = await supabase
        .from('procedure_records')
        .select('*')
        .eq('aih_id', aihId)
        .neq('match_status', 'removed');

      if (procError) {
        console.warn('⚠️ Erro ao buscar procedimentos para recálculo:', procError);
        return;
      }

      const activeProcedures = procedures || [];

      // 2. Calcular estatísticas
      const stats = {
        total_procedures: activeProcedures.length,
        approved_procedures: activeProcedures.filter(p => p.match_status === 'approved').length,
        rejected_procedures: activeProcedures.filter(p => p.match_status === 'rejected').length,
        calculated_total_value: activeProcedures
          .filter(p => p.match_status === 'approved')
          .reduce((sum, p) => sum + (p.value_charged || 0), 0),
        requires_manual_review: activeProcedures.some(p => 
          p.match_status === 'pending' || 
          p.match_confidence < 0.8
        ),
        processing_status: this.determineProcessingStatus(activeProcedures),
        updated_at: new Date().toISOString()
      };

      // 3. Atualizar a AIH
      const { error: updateError } = await supabase
        .from('aihs')
        .update(stats)
        .eq('id', aihId);

      if (updateError) {
        console.error('❌ Erro ao atualizar estatísticas da AIH:', updateError);
      } else {
        console.log(`✅ Estatísticas da AIH ${aihId} recalculadas:`, stats);
      }
    } catch (error) {
      console.error('❌ Erro no recálculo de estatísticas:', error);
    }
  }

  /**
   * Determina o status de processamento baseado nos procedimentos
   */
  private determineProcessingStatus(procedures: any[]): string {
    if (procedures.length === 0) {
      return 'completed'; // Sem procedimentos = processada
    }

    const pendingCount = procedures.filter(p => p.match_status === 'pending').length;
    const approvedCount = procedures.filter(p => p.match_status === 'approved').length;
    const rejectedCount = procedures.filter(p => p.match_status === 'rejected').length;

    if (pendingCount > 0) {
      return 'pending'; // Ainda tem procedimentos pendentes
    } else if (approvedCount > 0 || rejectedCount > 0) {
      return 'completed'; // Todos foram revisados
    } else {
      return 'processing'; // Em processamento
    }
  }

  /**
   * OTIMIZADO: Busca procedimentos de uma AIH específica com performance melhorada
   */
  async getAIHProcedures(aihId: string): Promise<any[]> {
    try {
      console.log('Buscando procedimentos para AIH:', aihId);

      // Strategy 1: Optimized query with known schema fields INCLUDING DESCRIPTION AND SEQUENCIA
      try {
        console.log('🔍 getAIHProcedures - Buscando procedimentos para AIH:', aihId);
        
        const { data: procedures, error } = await supabase
        .from('procedure_records')
          .select(`
            id,
            aih_id,
            procedure_code,
            procedure_description,
            sequencia,
            quantity,
            professional_cbo,
            professional_name,
            match_status,
            value_charged,
            codigo_procedimento_original,
            documento_profissional,
            participacao,
            aprovado,
            created_at,
            updated_at,
            procedure_id,
            sigtap_procedures:procedure_id(description, code)
          `)
          .eq('aih_id', aihId)
          .order('sequencia', { ascending: true });

        if (error) throw error;

        if (procedures && procedures.length > 0) {
          console.log(`Strategy 1: Found ${procedures.length} procedures with sequencia and descriptions`);
          
          // 🔍 DEBUG: Mostrar dados brutos do banco
          procedures.forEach((proc, index) => {
            console.log(`📋 Procedimento ${index + 1}:`, {
              code: proc.procedure_code,
              description: proc.procedure_description,
              sequencia: proc.sequencia,
              id: proc.id
            });
          });
          
          // Normalizar dados com sequencia correto
          const normalizedProceduresBase = procedures.map((proc, index) => ({
            ...proc,
            procedure_sequence: proc.sequencia || (index + 1),
            match_status: (() => {
              const rel = (proc as any).sigtap_procedures;
              const relDesc = Array.isArray(rel) ? rel[0]?.description : rel?.description;
              const hasJoin = !!relDesc || !!proc.procedure_id;
              const value = (proc as any).match_status || 'matched';
              return hasJoin ? 'matched' : value;
            })(),
            // ✅ Não criar displayName fallback - deixar que o componente decida
            displayName: (() => {
              const rel = (proc as any).sigtap_procedures;
              const relDesc = Array.isArray(rel) ? rel[0]?.description : rel?.description;
              const desc = proc.procedure_description || relDesc;
              if (desc && !desc.startsWith('Procedimento') && !desc.startsWith('Procedimento:')) return desc;
              return undefined;
            })(),
            fullDescription: `${proc.codigo_procedimento_original || proc.procedure_code} - ${
              (() => {
                const rel = (proc as any).sigtap_procedures;
                const relDesc = Array.isArray(rel) ? rel[0]?.description : rel?.description;
                return proc.procedure_description || relDesc || 'Descrição não disponível';
              })()
            }`
          }));

          // Enriquecer por código se a descrição estiver faltando
          const needEnrich = normalizedProceduresBase.some(p => !p.procedure_description);
          if (needEnrich) {
            const enriched = await this.enrichProceduresWithSigtap(normalizedProceduresBase as any);
            return enriched;
          }
          
          return normalizedProceduresBase;
        }
      } catch (error) {
        console.warn('Strategy 1 failed, trying fallback:', error);
      }

      // Strategy 2: Basic fallback query with sequencia
      try {
        const { data: procedures, error } = await supabase
          .from('procedure_records')
          .select('*, sequencia')
          .eq('aih_id', aihId)
          .order('sequencia', { ascending: true });

        if (error) throw error;

        if (procedures && procedures.length > 0) {
          console.log(`Strategy 2: Found ${procedures.length} procedures (basic query with sequencia)`);
          
          // Enriquecer com descrições e normalizar
          const enrichedProcedures = await this.enrichProceduresWithSigtap(procedures);
          
          return enrichedProcedures.map((proc, index) => ({
            ...proc,
            procedure_sequence: proc.sequencia || (index + 1),
            match_status: proc.match_status || 'matched' // ✅ USAR VALOR PERMITIDO
          }));
        }
      } catch (error) {
        console.warn('Strategy 2 failed:', error);
      }

      // Strategy 3: Verification if AIH exists
      const { data: aihExists } = await supabase
        .from('aihs')
        .select('id')
        .eq('id', aihId)
        .single();

      if (!aihExists) {
        console.warn('AIH not found:', aihId);
        return [];
      }

      console.log('No procedures found for existing AIH:', aihId);
      return [];

    } catch (error) {
      console.error('Error getting AIH procedures:', error);
      return [];
    }
  }

  /**
   * Correção dirigida: garante nomes SIGTAP e status 'matched' para procedimentos de uma AIH
   */
  async repairAIHFromSisaih(aihNumber: string, hospitalId: string): Promise<{ updated: number } | null> {
    try {
      const { data: aihRow } = await supabase
        .from('aihs')
        .select('id')
        .eq('aih_number', aihNumber)
        .eq('hospital_id', hospitalId)
        .maybeSingle();

      if (!aihRow?.id) return null;

      const aihId = aihRow.id as string;

      const { data: procs } = await supabase
        .from('procedure_records')
        .select('id, procedure_code, match_status, procedure_description, procedure_id')
        .eq('aih_id', aihId);

      if (!procs || procs.length === 0) return { updated: 0 };

      const codes = Array.from(new Set(procs.map(p => formatSigtapCode(p.procedure_code))));
      const { data: resolved } = await supabase
        .rpc('resolve_procedure_ids_batch', { p_codes: codes });

      const idMap: Record<string, { id: string; description: string | null }> = {};
      (resolved || []).forEach((r: any) => { idMap[r.code] = { id: r.procedure_id, description: r.description || null }; });

      let updated = 0;
      for (const p of procs) {
        const code = formatSigtapCode(p.procedure_code);
        const hit = idMap[code];
        if (!hit) continue;
        const upd: any = { match_status: 'matched' };
        if (!p.procedure_id && hit.id) upd.procedure_id = hit.id;
        if ((!p.procedure_description || p.procedure_description.startsWith('Procedimento'))) {
          if (hit.description) upd.procedure_description = hit.description;
        }
        if (Object.keys(upd).length > 0) {
          const { error } = await supabase
            .from('procedure_records')
            .update(upd)
            .eq('id', p.id);
          if (!error) updated++;
        }
      }

      await this.recalculateAIHStatistics(aihId);
      return { updated };
    } catch {
      return null;
    }
  }

  /**
   * Remove (marca como rejeitado) um procedimento de uma AIH e persiste no banco
   */
  async removeProcedureFromAIH(aihId: string, procedureSequence: number, userId: string, procedureId?: string): Promise<void> {
    let query = supabase
      .from('procedure_records')
      .update({ match_status: 'rejected', updated_at: new Date().toISOString() });
    if (procedureId) {
      query = query.eq('id', procedureId);
    } else {
      query = query.eq('aih_id', aihId).eq('sequencia', procedureSequence);
    }
    const { error } = await query;
    if (error) throw error;

    await this.recalculateAIHStatistics(aihId);
  }

  /**
   * Exclui permanentemente um procedimento de uma AIH no banco
   */
  async deleteProcedureFromAIH(aihId: string, procedureSequence: number, userId: string, procedureId?: string): Promise<void> {
    let query = supabase
      .from('procedure_records')
      .delete();
    if (procedureId) {
      query = query.eq('id', procedureId);
    } else {
      query = query.eq('aih_id', aihId).eq('sequencia', procedureSequence);
    }
    const { error } = await query;
    if (error) throw error;

    await this.recalculateAIHStatistics(aihId);
  }

  /**
   * Restaura procedimento previamente rejeitado para 'matched'
   */
  async restoreProcedureInAIH(aihId: string, procedureSequence: number, userId: string, procedureId?: string): Promise<void> {
    let query = supabase
      .from('procedure_records')
      .update({ match_status: 'matched', updated_at: new Date().toISOString() });
    if (procedureId) {
      query = query.eq('id', procedureId);
    } else {
      query = query.eq('aih_id', aihId).eq('sequencia', procedureSequence);
    }
    const { error } = await query;
    if (error) throw error;

    await this.recalculateAIHStatistics(aihId);
  }
  /**
   * Enriquecer procedimentos com descrições SIGTAP
   */
  async enrichProceduresWithSigtap(procedures: any[]): Promise<any[]> {
    try {
      // Buscar códigos únicos que precisam de descrição
      const codesNeedingDescription = procedures
        .filter(p => p.procedure_code && !p.procedure_description)
        .map(p => formatSigtapCode(p.procedure_code));

      if (codesNeedingDescription.length > 0) {
        console.log(`Enriching ${codesNeedingDescription.length} procedures with SIGTAP descriptions`);
        
        // Buscar descrições no SIGTAP
        const { data: sigtapData } = await supabase
          .from('sigtap_procedures')
            .select(`
                code,
                description,
            sigtap_versions!inner(is_active)
          `)
          .in('code', codesNeedingDescription)
          .eq('sigtap_versions.is_active', true);

        if (sigtapData) {
          // Criar mapa código -> descrição
          const descriptionMap = sigtapData.reduce((map, item) => {
            map[item.code] = item.description;
            return map;
          }, {} as Record<string, string>);

          // Enriquecer procedimentos
          return procedures.map(procedure => {
            const codeFmt = formatSigtapCode(procedure.procedure_code);
            const desc = procedure.procedure_description || descriptionMap[codeFmt] || procedure.procedure_code;
            const rel = desc && desc !== procedure.procedure_code ? [{ description: desc, code: codeFmt }] : undefined;
            return {
              ...procedure,
              procedure_description: desc,
              displayName: desc,
              sigtap_procedures: rel,
              match_status: procedure.match_status || (descriptionMap[codeFmt] ? 'matched' : 'pending'),
              fullDescription: `${procedure.procedure_code} - ${desc || 'Descrição não disponível'}`
            };
          });
        }
      }

      // Se não precisar enriquecer ou falhar, retornar com campos compatíveis
      return procedures.map(procedure => ({
        ...procedure,
        procedure_description: procedure.procedure_description || procedure.procedure_code,
        displayName: procedure.procedure_description || procedure.procedure_code,
        fullDescription: `${procedure.procedure_code} - ${
          procedure.procedure_description || 'Descrição não disponível'
        }`
      }));

    } catch (error) {
      console.error('Error enriching procedures with SIGTAP:', error);
      
      // Fallback: retornar com descrições básicas
      return procedures.map(procedure => ({
        ...procedure,
        procedure_description: procedure.procedure_description || procedure.procedure_code,
        displayName: procedure.procedure_description || procedure.procedure_code,
        fullDescription: `${procedure.procedure_code} - ${
          procedure.procedure_description || 'Descrição não disponível'
        }`
      }));
    }
  }

  /**
   * NOVO: Normaliza dados de procedimentos para interface consistente
   */
  private normalizeProceduresData(procedures: any[]): any[] {
    return procedures.map((proc, index) => ({
      // Campos principais (interface)
      id: proc.id,
      aih_id: proc.aih_id,
      procedure_sequence: proc.sequencia || index + 1,
      procedure_code: proc.procedure_code || proc.codigo_procedimento_original,
      procedure_description: proc.procedure_description || proc.procedure_code,
      procedure_date: proc.procedure_date,
      
      // Valores financeiros
      value_charged: proc.value_charged || 0,
      total_value: proc.total_value || proc.value_charged || 0,
      original_value: proc.valor_original || 0,
      
      // Profissional
      professional_name: proc.professional_name || 'PROFISSIONAL RESPONSÁVEL',
      professional_cbo: proc.professional_cbo || proc.cbo,
      professional_document: proc.documento_profissional,
      
      // Status e matching
      match_status: proc.match_status || proc.status || 'matched',
      match_confidence: proc.match_confidence || 0,
      approved: proc.aprovado || false,
      
      // Dados específicos da AIH
      participacao: proc.participacao,
      cnes: proc.cnes,
      porcentagem_sus: proc.porcentagem_sus || 100,
      quantity: proc.quantity || 1,
      
      // Metadados
      notes: proc.notes || proc.observacoes,
      created_at: proc.created_at,
      
      // Dados enriquecidos (se disponíveis)
      sigtap_procedures: proc.sigtap_procedures,
      aih_matches: proc.aih_matches || []
    }));
  }

  /**
   * NOVO: Diagnóstico completo dos procedimentos no sistema
   */
  async diagnoseProceduresData(hospitalId: string): Promise<{
    aihs: {
      total: number;
      withProcedures: number;
      withoutProcedures: number;
      inconsistent: number;
    };
    procedures: {
      total: number;
      pending: number;
      approved: number;
      rejected: number;
      removed: number;
    };
    issues: string[];
    recommendations: string[];
  }> {
    try {
      console.log('🔍 === DIAGNÓSTICO DE PROCEDIMENTOS ===');
      
      const issues: string[] = [];
      const recommendations: string[] = [];

      // 1. Contar AIHs totais
      const { data: allAIHs, error: aihError } = await supabase
        .from('aihs')
        .select('id, aih_number, total_procedures, approved_procedures')
        .eq('hospital_id', hospitalId);

      if (aihError) {
        throw aihError;
      }

      const totalAIHs = allAIHs?.length || 0;
      console.log(`📊 AIHs encontradas: ${totalAIHs}`);

      // 2. Contar AIHs com procedimentos
      const { data: proceduresCount } = await supabase
        .from('procedure_records')
        .select('aih_id')
        .eq('hospital_id', hospitalId);

      const aihsWithProcedures = new Set(proceduresCount?.map(p => p.aih_id)).size;
      const aihsWithoutProcedures = totalAIHs - aihsWithProcedures;

      console.log(`✅ AIHs com procedimentos: ${aihsWithProcedures}`);
      console.log(`❌ AIHs sem procedimentos: ${aihsWithoutProcedures}`);

      // 3. Contar procedimentos por status
      const { data: allProcedures } = await supabase
        .from('procedure_records')
        .select('match_status')
        .eq('hospital_id', hospitalId);

      const proceduresStats = {
        total: allProcedures?.length || 0,
        pending: allProcedures?.filter(p => p.match_status === 'pending').length || 0,
        approved: allProcedures?.filter(p => p.match_status === 'approved').length || 0,
        rejected: allProcedures?.filter(p => p.match_status === 'rejected').length || 0,
        removed: allProcedures?.filter(p => p.match_status === 'removed').length || 0
      };

      console.log(`📋 Procedimentos: Total=${proceduresStats.total}, Aprovados=${proceduresStats.approved}`);

      // 4. Verificar inconsistências
      let inconsistentAIHs = 0;
      for (const aih of allAIHs || []) {
        const { data: aihProcedures } = await supabase
          .from('procedure_records')
          .select('id')
          .eq('aih_id', aih.id);

        const actualCount = aihProcedures?.length || 0;
        const reportedCount = aih.total_procedures || 0;

        if (actualCount !== reportedCount) {
          inconsistentAIHs++;
          if (actualCount === 0) {
            issues.push(`AIH ${aih.aih_number}: Sem procedimentos cadastrados`);
          } else if (actualCount !== reportedCount) {
            issues.push(`AIH ${aih.aih_number}: ${actualCount} procedimentos reais vs ${reportedCount} reportados`);
          }
        }
      }

      // 5. Gerar recomendações
      if (aihsWithoutProcedures > 0) {
        recommendations.push(`Executar migração para ${aihsWithoutProcedures} AIHs sem procedimentos`);
      }

      if (inconsistentAIHs > 0) {
        recommendations.push(`Recalcular estatísticas para ${inconsistentAIHs} AIHs inconsistentes`);
      }

      if (proceduresStats.pending > proceduresStats.approved) {
        recommendations.push('Priorizar revisão de procedimentos pendentes');
      }

      const result = {
        aihs: {
          total: totalAIHs,
          withProcedures: aihsWithProcedures,
          withoutProcedures: aihsWithoutProcedures,
          inconsistent: inconsistentAIHs
        },
        procedures: proceduresStats,
        issues,
        recommendations
      };

      console.log('✅ Diagnóstico concluído:', result);
      return result;

    } catch (error) {
      console.error('❌ Erro no diagnóstico:', error);
      throw error;
    }
  }

  /**
   * NOVO: Sincroniza procedimentos faltantes para AIHs antigas
   */
  async syncMissingProcedures(hospitalId: string, options?: {
    dryRun?: boolean;
    maxAIHs?: number;
  }): Promise<{
    processed: number;
    synchronized: number;
    errors: string[];
    details: Array<{
      aihId: string;
      aihNumber: string;
      proceduresAdded: number;
      status: 'success' | 'error';
      message: string;
    }>;
  }> {
    try {
      const dryRun = options?.dryRun ?? false;
      const maxAIHs = options?.maxAIHs ?? 50;
      
      console.log(`🔄 === SINCRONIZAÇÃO DE PROCEDIMENTOS ${dryRun ? '(DRY RUN)' : ''} ===`);

      // 1. Buscar AIHs sem procedimentos
      const { data: aihsWithoutProcedures } = await supabase
        .from('aihs')
        .select('id, aih_number, procedure_code')
        .eq('hospital_id', hospitalId)
        .limit(maxAIHs);

      if (!aihsWithoutProcedures?.length) {
                return {
          processed: 0,
          synchronized: 0,
          errors: [],
          details: []
        };
      }

      const result = {
        processed: 0,
        synchronized: 0,
        errors: [] as string[],
        details: [] as any[]
      };

      for (const aih of aihsWithoutProcedures) {
        try {
          result.processed++;

          // Verificar se já tem procedimentos
          const { data: existingProcedures } = await supabase
            .from('procedure_records')
            .select('id')
            .eq('aih_id', aih.id);

          if (existingProcedures?.length) {
            result.details.push({
              aihId: aih.id,
              aihNumber: aih.aih_number,
              proceduresAdded: 0,
              status: 'success',
              message: `AIH já possui ${existingProcedures.length} procedimentos`
            });
            continue;
          }

          if (!dryRun) {
            // Criar pelo menos o procedimento principal
            const { data: patient } = await supabase
              .from('patients')
              .select('id')
              .eq('hospital_id', hospitalId)
              .single();

            if (patient && aih.procedure_code) {
              const procedureData = {
                hospital_id: hospitalId,
                patient_id: patient.id,
                aih_id: aih.id,
                procedure_code: aih.procedure_code,
                procedure_description: `Procedimento principal: ${aih.procedure_code}`,
                sequence: 1,
                professional_name: 'PROFISSIONAL RESPONSÁVEL',
                cbo: '225125', // Médico genérico
                procedure_date: new Date().toISOString(),
                calculated_value: 0,
                match_status: 'pending'
              };

              await this.saveProcedureRecordFixed(procedureData);
              
              // Atualizar estatísticas da AIH
              await supabase
                .from('aihs')
                .update({
                  total_procedures: 1,
                  approved_procedures: 0,
                  rejected_procedures: 0,
                  updated_at: new Date().toISOString()
                })
                .eq('id', aih.id);

              result.synchronized++;
              result.details.push({
                aihId: aih.id,
                aihNumber: aih.aih_number,
                proceduresAdded: 1,
                status: 'success',
                message: 'Procedimento principal sincronizado'
              });

              console.log(`✅ AIH ${aih.aih_number}: Procedimento principal sincronizado`);
            }
          } else {
            result.details.push({
              aihId: aih.id,
              aihNumber: aih.aih_number,
              proceduresAdded: 1,
              status: 'success',
              message: '[DRY RUN] Procedimento principal seria criado'
            });
          }

        } catch (error) {
          const errorMsg = `Erro na AIH ${aih.aih_number}: ${error instanceof Error ? error.message : 'Erro desconhecido'}`;
          result.errors.push(errorMsg);
          result.details.push({
            aihId: aih.id,
            aihNumber: aih.aih_number,
            proceduresAdded: 0,
            status: 'error',
            message: errorMsg
          });
          console.error(`❌ ${errorMsg}`);
        }
      }

      console.log(`✅ Sincronização concluída: ${result.synchronized}/${result.processed} AIHs`);
      return result;

    } catch (error) {
      console.error('❌ Erro na sincronização:', error);
      throw error;
    }
  }

  /**
   * Salvar registro de procedimento com descrição automática
   */
  async saveProcedureRecordFixed(procedureData: any): Promise<boolean> {
    try {
      console.log('Saving procedure record with auto-description:', procedureData);

             // Buscar descrição SIGTAP se não fornecida
       if (!procedureData.procedure_description && procedureData.procedure_code) {
         try {
           const { data: sigtapData } = await supabase
             .from('sigtap_procedures')
             .select(`
               description,
               sigtap_versions!inner(is_active)
             `)
             .eq('code', procedureData.procedure_code)
             .eq('sigtap_versions.is_active', true)
             .limit(1)
             .single();

           if (sigtapData) {
             procedureData.procedure_description = sigtapData.description;
           }
         } catch (error) {
           console.warn('Could not fetch SIGTAP description:', error);
         }
       }

       // Se ainda não tem descrição, usar padrão
       if (!procedureData.procedure_description && procedureData.procedure_code) {
         procedureData.procedure_description = `Procedimento: ${procedureData.procedure_code}`;
       }

       // Estratégia 1: Tentar com campos conhecidos
       try {
         const { error } = await supabase
           .from('procedure_records')
           .insert({
             aih_id: procedureData.aih_id,
             procedure_code: procedureData.procedure_code,
             procedure_description: procedureData.procedure_description,
             quantity: procedureData.quantity || 1,
             professional_cbo: procedureData.professional_cbo || procedureData.professional_code,
             professional_name: procedureData.professional_name,
             value_charged: procedureData.amount || procedureData.value_charged || 0,
             billing_status: procedureData.status || 'pending',
             match_confidence: Math.round((procedureData.confidence || 0.8) * 100)
           });

         if (!error) {
           console.log('Procedure record saved successfully with description');
           return true;
         }
       } catch (error) {
         console.warn('Strategy 1 failed, trying fallback:', error);
       }

       // Estratégia 2: Fallback básico
       const { error } = await supabase
         .from('procedure_records')
         .insert(procedureData);

      if (error) {
        console.error('Failed to save procedure record:', error);
        return false;
      }

      return true;

    } catch (error) {
      console.error('Error in saveProcedureRecordFixed:', error);
      return false;
    }
  }

  /**
   * 🆕 NOVO: Verifica duplicatas inteligentes para AIHs com número "-"
   * Controle baseado em: paciente + data de internação + procedimento principal
   */
  private static async checkDashAIHDuplicate(
    aihCompleta: any,
    hospitalId: string
  ): Promise<boolean> {
    try {
      console.log('🔍 === VERIFICAÇÃO INTELIGENTE DE DUPLICATA PARA AIH "-" ===');
      console.log(`👤 Paciente: ${aihCompleta.nomePaciente}`);
      console.log(`📅 Data início: ${aihCompleta.dataInicio}`);
      console.log(`⚕️ Procedimento: ${aihCompleta.procedimentoPrincipal}`);
      console.log(`🏥 Hospital: ${hospitalId}`);

      // 1. Buscar paciente pelo nome e hospital
      const { data: patients, error: patientError } = await supabase
        .from('patients')
        .select('id, name, cns, birth_date')
        .eq('hospital_id', hospitalId)
        .ilike('name', aihCompleta.nomePaciente)
        .limit(5); // Máximo 5 pacientes com nome similar

      if (patientError) {
        console.warn('⚠️ Erro ao buscar pacientes:', patientError.message);
        return false; // Em caso de erro, permitir inserção
      }

      if (!patients || patients.length === 0) {
        console.log('✅ Nenhum paciente encontrado com esse nome - não há duplicata');
        return false;
      }

      console.log(`🔍 Encontrados ${patients.length} pacientes com nome similar`);

      // 2. Para cada paciente encontrado, verificar AIHs existentes
      for (const patient of patients) {
        console.log(`🔍 Verificando paciente: ${patient.name} (${patient.id})`);

        // Buscar AIHs deste paciente na mesma data (±3 dias para margem)
        const dataInicio = new Date(aihCompleta.dataInicio);
        const dataInicioMinus = new Date(dataInicio);
        dataInicioMinus.setDate(dataInicio.getDate() - 3);
        const dataInicioPlus = new Date(dataInicio);
        dataInicioPlus.setDate(dataInicio.getDate() + 3);

        const { data: existingAIHs, error: aihError } = await supabase
          .from('aihs')
          .select('id, aih_number, admission_date, procedure_code, created_at')
          .eq('patient_id', patient.id)
          .gte('admission_date', dataInicioMinus.toISOString().split('T')[0])
          .lte('admission_date', dataInicioPlus.toISOString().split('T')[0])
          .limit(10);

        if (aihError) {
          console.warn('⚠️ Erro ao buscar AIHs:', aihError.message);
          continue;
        }

        if (!existingAIHs || existingAIHs.length === 0) {
          console.log(`✅ Nenhuma AIH encontrada para ${patient.name} na data similar`);
          continue;
        }

        console.log(`📋 Encontradas ${existingAIHs.length} AIHs para ${patient.name} em datas próximas`);

        // 3. Verificar se alguma AIH tem procedimento similar
        for (const existingAIH of existingAIHs) {
          const existingProcedureCode = this.extractProcedureCode(existingAIH.procedure_code);
          const newProcedureCode = this.extractProcedureCode(aihCompleta.procedimentoPrincipal);

          console.log(`🔍 Comparando procedimentos:`);
          console.log(`   - Existente: ${existingProcedureCode} (AIH: ${existingAIH.aih_number})`);
          console.log(`   - Nova: ${newProcedureCode}`);

          // Se os códigos de procedimento são iguais, é uma possível duplicata
          if (existingProcedureCode === newProcedureCode) {
            console.warn(`🚨 POSSÍVEL DUPLICATA DETECTADA:`);
            console.warn(`   - Paciente: ${patient.name}`);
            console.warn(`   - Procedimento: ${existingProcedureCode}`);
            console.warn(`   - Data existente: ${existingAIH.admission_date}`);
            console.warn(`   - Data nova: ${aihCompleta.dataInicio}`);
            console.warn(`   - AIH existente: ${existingAIH.aih_number} (ID: ${existingAIH.id})`);
            
            return true; // Duplicata detectada
          }
        }
      }

      console.log('✅ Nenhuma duplicata detectada após verificação completa');
      return false;

    } catch (error) {
      console.error('❌ Erro na verificação de duplicata:', error);
      // Em caso de erro, permitir inserção para não bloquear o sistema
      return false;
    }
  }

  /**
   * 🔧 AUXILIAR: Extrai apenas o código do procedimento (sem descrição)
   */
  private static extractProcedureCode(procedure: string): string {
    if (!procedure) return '';
    
    // Extrair código no formato XX.XX.XX.XXX-X
    const match = procedure.match(/(\d{2}\.\d{2}\.\d{2}\.\d{3}-\d)/);
    return match ? match[1] : procedure.substring(0, 15).trim();
  }
}

export const aihPersistenceService = new AIHPersistenceService();

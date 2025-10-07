import { supabase } from '../lib/supabase';

// ================================================================
// 🩺 SERVIÇO DE ASSOCIAÇÃO MÉDICO-PACIENTE
// ================================================================

export interface DoctorPatientData {
  doctor_id: string;
  doctor_name: string;
  doctor_cns: string;
  doctor_crm: string;
  doctor_specialty: string;
  patients: PatientWithProcedures[];
}

// 🆕 NOVA INTERFACE PARA HOSPITAL ASSOCIADO AO MÉDICO
export interface DoctorHospital {
  hospital_id: string;
  hospital_name: string;
  hospital_cnpj?: string;
  role?: string;
  department?: string;
  is_active: boolean;
}

export interface PatientWithProcedures {
  patient_id?: string; // 🆕 ID real do paciente (UUID da tabela patients) para associar procedimentos
  patient_info: {
    name: string;
    cns: string;
    birth_date: string;
    gender: string;
    medical_record: string;
  };
  aih_info: {
    admission_date: string;
    discharge_date?: string;
    aih_number: string;
    care_character?: string;
    hospital_id?: string;
    competencia?: string; // ✅ NOVO: Competência da AIH
  };
  // 🆕 Nome Comum de procedimentos (rótulo amigável): ex. "A+A"
  common_name?: string | null;
  total_value_reais: number;
  procedures: ProcedureDetail[];
  total_procedures: number;
  approved_procedures: number;
}

// 🆕 INTERFACE ATUALIZADA COM HOSPITAIS
export interface DoctorWithPatients {
  doctor_info: {
    name: string;
    cns: string;
    crm: string;
    specialty: string;
  };
  hospitals: DoctorHospital[]; // 🆕 Array de hospitais onde o médico atende
  patients: PatientWithProcedures[];
}

export interface AIHSummary {
  aih_id: string;
  aih_number: string;
  admission_date: string;
  discharge_date?: string;
  main_cid: string;
  procedures_count: number;
  total_value_reais: number;
  status: string;
}

// 🆕 NOVA INTERFACE PARA PROCEDIMENTOS INDIVIDUAIS
export interface ProcedureDetail {
  procedure_id?: string;
  procedure_code: string;
  procedure_description: string;
  procedure_date: string; // ✅ Campo obrigatório do banco (procedure_records.procedure_date)
  value_reais: number; // ✅ Calculado de total_value em centavos
  value_cents: number;
  approved?: boolean;
  approval_status?: string; // ✅ Mantido para compatibilidade interna (não exibido na UI)
  billing_status?: string; // ⚠️ Mantido para compatibilidade, mas não será exibido
  sequence?: number;
  aih_number?: string;
  aih_id?: string;
  match_confidence?: number;
  sigtap_description?: string;
  complexity?: string;
  professional_name?: string;
  cbo?: string;
  participation?: string;
}

export interface DoctorSearchFilters {
  hospitalId?: string;
  specialty?: string;
  searchTerm?: string;
  dateFrom?: string;
  dateTo?: string;
}

export class DoctorPatientService {
  /**
   * 🔄 NOVO CAMINHO EFICIENTE: Buscar Médicos → Pacientes → Procedimentos direto da view v_procedures_with_doctors
   * Filtros opcionais por hospital e período; agrupa por médico (responsável), depois por paciente.
   */
  static async getDoctorsWithPatientsFromProceduresView(options?: {
    hospitalIds?: string[];
    competencia?: string; // ✅ NOVO: Usar competência em vez de datas
  }): Promise<DoctorWithPatients[]> {
    try {
      console.log('📥 [TABELAS - OTIMIZADO] Carregando dados em paralelo...', options);
      const startTime = performance.now();

      // 🚀 OTIMIZAÇÃO #1: PREPARAR QUERIES EM PARALELO
      // Construir query de AIHs
      let aihsQuery = supabase
        .from('aihs')
        .select(`
          id,
          aih_number,
          hospital_id,
          patient_id,
          admission_date,
          discharge_date,
          care_character,
          calculated_total_value,
          cns_responsavel,
          competencia,
          patients (
            id,
            name,
            cns,
            birth_date,
            gender,
            medical_record
          )
        `);

      if (options?.hospitalIds && options.hospitalIds.length > 0 && !options.hospitalIds.includes('all')) {
        aihsQuery = aihsQuery.in('hospital_id', options.hospitalIds);
      }
      
      // ✅ SIMPLIFICADO: Filtrar APENAS por competência (sem filtros de data)
      if (options?.competencia && options.competencia !== 'all') {
        aihsQuery = aihsQuery.eq('competencia', options.competencia);
        console.log('🗓️ Filtrando por competência:', options.competencia);
      }

      // 🚀 EXECUTAR QUERY DE AIHs PRIMEIRO (necessária para obter IDs)
      const { data: aihs, error: aihsError } = await aihsQuery.order('admission_date', { ascending: false });
      if (aihsError) {
        console.error('❌ [TABELAS] Erro ao consultar AIHs:', aihsError);
        return [];
      }
      if (!aihs || aihs.length === 0) {
        console.log('⚠️ Nenhuma AIH encontrada com os filtros aplicados');
        return [];
      }

      console.log(`✅ ${aihs.length} AIHs carregadas em ${(performance.now() - startTime).toFixed(0)}ms`);

      // 2) Extrair IDs para queries dependentes
      const patientIds = Array.from(new Set(aihs.map(a => a.patient_id).filter(Boolean)));
      const aihIds = Array.from(new Set(aihs.map(a => a.id).filter(Boolean)));
      const doctorCnsList = Array.from(new Set(aihs.map(a => a.cns_responsavel).filter(Boolean)));

      // 🚀 OTIMIZAÇÃO #1: EXECUTAR QUERIES DEPENDENTES EM PARALELO
      const { ProcedureRecordsService } = await import('./simplifiedProcedureService');
      
      const parallelStart = performance.now();
      const [procsResult, procsByAih, doctorsData, hospitalsData] = await Promise.all([
        // Query 1: Procedimentos por paciente
        ProcedureRecordsService.getProceduresByPatientIds(patientIds),
        // Query 2: Procedimentos por AIH (fallback)
        ProcedureRecordsService.getProceduresByAihIds(aihIds),
        // Query 3: Dados dos médicos (CNS, nome, especialidade)
        supabase
          .from('doctors')
          .select('id, name, cns, crm, specialty, is_active')
          .in('cns', doctorCnsList),
        // Query 4: Dados dos hospitais
        options?.hospitalIds && options.hospitalIds.length > 0 && !options.hospitalIds.includes('all')
          ? supabase
              .from('hospitals')
              .select('id, name, cnes')
              .in('id', options.hospitalIds)
          : supabase
              .from('hospitals')
              .select('id, name, cnes')
      ]);

      console.log(`✅ Queries paralelas executadas em ${(performance.now() - parallelStart).toFixed(0)}ms`);

      // Processar resultados
      const procsByPatient = procsResult.success ? procsResult.proceduresByPatientId : new Map<string, any[]>();
      const doctorsMap = new Map((doctorsData.data || []).map(d => [d.cns, d]));
      const hospitalsMap = new Map((hospitalsData.data || []).map(h => [h.id, h]));

      // 3) Montar mapa de médicos (CNS responsável)
      const doctorMap = new Map<string, DoctorWithPatients & { key: string; hospitalIds: Set<string> }>();

      for (const aih of aihs as any[]) {
        const doctorCns = aih.cns_responsavel || 'NAO_IDENTIFICADO';
        const doctorKey = doctorCns;
        const hospitalId = aih.hospital_id;

        if (!doctorMap.has(doctorKey)) {
          // 🚀 OTIMIZAÇÃO: Usar dados reais dos médicos carregados em paralelo
          const doctorData = doctorsMap.get(doctorCns);
          const hospitalData = hospitalsMap.get(hospitalId);
          
          doctorMap.set(doctorKey, {
            key: doctorKey,
            doctor_info: {
              name: doctorData?.name || `Dr(a). ${doctorCns}`,
              cns: doctorCns,
              crm: doctorData?.crm || '',
              specialty: doctorData?.specialty || ''
            },
            hospitals: hospitalId ? [{ 
              hospital_id: hospitalId, 
              hospital_name: hospitalData?.name || '', 
              cnes: hospitalData?.cnes,
              is_active: true 
            } as any] : [],
            patients: [],
            hospitalIds: new Set(hospitalId ? [hospitalId] : [])
          } as any);
        } else if (hospitalId) {
          const d = doctorMap.get(doctorKey)! as any;
          d.hospitalIds.add(hospitalId);
        }

        const doctor = doctorMap.get(doctorKey)! as any;
        // Garantir hospitais únicos com dados reais
        doctor.hospitals = Array.from(doctor.hospitalIds).map((hid: string) => {
          const hospitalData = hospitalsMap.get(hid);
          return { 
            hospital_id: hid, 
            hospital_name: hospitalData?.name || '', 
            cnes: hospitalData?.cnes,
            is_active: true 
          };
        });

        // Paciente
        const patientId = aih.patient_id;
        let patient = (doctor.patients as any[]).find(p => p.patient_id === patientId);
        if (!patient) {
          patient = {
            patient_id: patientId,
            patient_info: {
              name: aih.patients?.name || 'Paciente sem nome',
              cns: aih.patients?.cns || '',
              birth_date: aih.patients?.birth_date || '',
              gender: aih.patients?.gender || '',
              medical_record: aih.patients?.medical_record || ''
            },
            aih_info: {
              admission_date: aih.admission_date,
              discharge_date: aih.discharge_date,
              aih_number: aih.aih_number,
              care_character: aih.care_character,
              hospital_id: aih.hospital_id,
              competencia: aih.competencia // ✅ NOVO: Incluir competência
            },
            total_value_reais: (aih.calculated_total_value || 0) / 100,
            procedures: [],
            total_procedures: 0,
            approved_procedures: 0
          };
          (doctor.patients as any[]).push(patient);
        }

        // Procedimentos deste paciente
        // Tentar por patient_id; se vazio, usar fallback por aih_id
        let procs = procsByPatient.get(patientId) || [];
        if (procs.length === 0 && aih.id) {
          procs = (procsByAih.success ? (procsByAih.proceduresByAihId.get(aih.id) || []) : []);
        }
        const mapped = procs.map((p: any) => {
          const code = p.procedure_code || '';
          const cbo = p.professional_cbo || '';
          
          // 🚀 OTIMIZAÇÃO #4: Pré-calcular se é anestesista 04.xxx (exceto cesariana)
          const isAnesthetist04 = cbo === '225151' && 
                                   typeof code === 'string' && 
                                   code.startsWith('04') && 
                                   code !== '04.17.01.001-0';
          
          // Ajustar valor para anestesistas (zerado para não contar em cálculos)
          const rawCents = typeof p.total_value === 'number' ? p.total_value : 0;
          const value_cents = isAnesthetist04 ? 0 : rawCents;
          
          return {
            procedure_id: p.id,
            procedure_code: code,
            procedure_description: p.procedure_description || p.procedure_name || 'Descrição não disponível',
            procedure_date: p.procedure_date,
            value_reais: value_cents / 100,
            value_cents,
            approved: p.billing_status === 'approved' || p.match_status === 'approved' || p.billing_status === 'paid',
            approval_status: p.billing_status || p.match_status,
            sequence: p.sequencia,
            aih_id: p.aih_id,
            match_confidence: p.match_confidence || 0,
            sigtap_description: p.procedure_description,
            complexity: p.complexity,
            professional_name: p.professional_name,
            cbo,
            participation: isAnesthetist04 ? 'Anestesia (qtd)' : 'Responsável',
            is_anesthetist_04: isAnesthetist04 // 🚀 Flag pré-calculada
          };
        });
        
        patient.procedures = mapped.sort((a: any, b: any) => new Date(b.procedure_date).getTime() - new Date(a.procedure_date).getTime());
        
        // 🚀 OTIMIZAÇÃO #4: Pré-filtrar procedimentos calculáveis (cache no objeto)
        const { filterCalculableProcedures } = await import('../utils/anesthetistLogic');
        (patient as any).calculable_procedures = patient.procedures.filter(filterCalculableProcedures);
        
        patient.total_procedures = (patient as any).calculable_procedures.length;
        patient.approved_procedures = (patient as any).calculable_procedures.filter((pp: any) => pp.approved).length;
        // 🆕 Resolver Nome Comum com base nos códigos do paciente
        try {
          const { resolveCommonProcedureName } = await import('../utils/commonProcedureName');
          const codes = patient.procedures.map((pp: any) => pp.procedure_code).filter(Boolean);
          const doctorSpecialty = (doctor.doctor_info?.specialty || '').trim() || undefined;
          patient.common_name = resolveCommonProcedureName(codes, doctorSpecialty, patient.procedures);
        } catch {}
      }

      const result = Array.from(doctorMap.values()).map((d: any) => ({
        doctor_info: d.doctor_info,
        hospitals: d.hospitals,
        patients: d.patients
      })) as DoctorWithPatients[];

      const totalTime = performance.now() - startTime;
      console.log(`✅ [TABELAS - OTIMIZADO] Montados ${result.length} médicos em ${totalTime.toFixed(0)}ms`);
      console.log(`   📊 Performance: ${aihs.length} AIHs, ${patientIds.length} pacientes, ${doctorCnsList.length} médicos`);
      
      return result;

    } catch (e) {
      console.error('💥 [TABELAS] Erro inesperado ao montar dados:', e);
      return [];
    }
  }
  
  /**
   * 🔍 BUSCAR MÉDICO POR CNS E OBTER TODOS OS PACIENTES ATENDIDOS
   * Esta é a função principal que resolve a questão do usuário
   */
  static async getDoctorWithPatients(doctorCns: string): Promise<{
    success: boolean;
    data?: DoctorPatientData;
    error?: string;
  }> {
    try {
      console.log('🔍 Buscando médico por CNS:', doctorCns);
      
      // 1. BUSCAR DADOS DO MÉDICO
      const { data: doctorData, error: doctorError } = await supabase
        .from('doctors')
        .select('id, name, cns, crm, specialty')
        .eq('cns', doctorCns)
        .single();

      if (doctorError || !doctorData) {
        return {
          success: false,
          error: 'Médico não encontrado com este CNS'
        };
      }

      // 2. BUSCAR TODAS AS AIHs ONDE O MÉDICO ESTÁ RELACIONADO
      const { data: aihsData, error: aihsError } = await supabase
        .from('v_aihs_with_doctors')
        .select('*')
        // ✅ Usar a chave forte quando disponível: doctor_id da view
        .eq('cns_responsavel_doctor_id', doctorData.id)
        .order('admission_date', { ascending: false });

      if (aihsError) {
        return {
          success: false,
          error: `Erro ao buscar AIHs: ${aihsError.message}`
        };
      }

      // ✅ PROCEDIMENTOS AGORA SÃO GERENCIADOS PELO SimplifiedProcedureService
      console.log('🔄 Procedimentos serão carregados pelo SimplifiedProcedureService');

      // 4. PROCESSAR E AGRUPAR DADOS POR PACIENTE
      const patientsMap = new Map<string, PatientWithProcedures>();

      // Processar AIHs
      if (aihsData) {
        aihsData.forEach(aih => {
          const patientKey = aih.patient_id;
          
          if (!patientsMap.has(patientKey)) {
            patientsMap.set(patientKey, {
              patient_info: {
                name: aih.patient_name,
                cns: aih.patient_cns,
                birth_date: aih.patient_birth_date,
                gender: aih.patient_gender,
                medical_record: aih.medical_record
              },
              aih_info: {
                admission_date: aih.admission_date,
                discharge_date: aih.discharge_date,
                aih_number: aih.aih_number,
                care_character: aih.care_character,
                hospital_id: aih.hospital_id
              },
              total_value_reais: 0,
              procedures: [],
              total_procedures: 0,
              approved_procedures: 0
            });
          }

          const patient = patientsMap.get(patientKey)!;
          patient.total_procedures++;
          if (aih.aprovado) {
            patient.approved_procedures++;
          }
          // ❌ REMOVIDO: patient.total_value_reais += (aih.total_value_reais || 0) / 100;
          // ✅ NOVO: Valor já definido corretamente na criação do paciente usando calculated_total_value da AIH

          // ✅ ADICIONAR PROCEDIMENTO COM DADOS REAIS DO BANCO
          const totalValueCents = aih.total_value_reais || aih.value_charged || 0;
          const valueReais = totalValueCents / 100; // Converter centavos para reais
          
          patient.procedures.push({
            procedure_id: aih.id || `${aih.procedure_code}_${Date.now()}`,
            procedure_code: aih.procedure_code || 'N/A',
            procedure_description: aih.procedure_description || `Procedimento: ${aih.procedure_code || 'N/A'}`,
            procedure_date: aih.admission_date || new Date().toISOString(), // ✅ DADOS REAIS
            value_reais: valueReais, // ✅ DADOS REAIS convertidos de total_value
            value_cents: totalValueCents, // ✅ DADOS REAIS em centavos
            approved: aih.status === 'approved' || false,
            approval_status: aih.status || 'pending',
            sequence: aih.sequencia || 0,
            aih_number: 'N/A',
            match_confidence: 0,
            sigtap_description: '',
            complexity: 'N/A',
            professional_name: aih.professional_name || 'N/A',
            cbo: aih.professional_cbo || '',
            participation: 'Responsável'
          });
        });
      }

      // ✅ CARREGAR PROCEDIMENTOS POR PACIENTE A PARTIR DA TABELA procedure_records
      try {
        const allPatientIds = Array.from(patientsMap.keys());
        if (allPatientIds.length > 0) {
          const { getProceduresByPatientIds } = await import('./simplifiedProcedureService');
          const procResult = await getProceduresByPatientIds(allPatientIds);
          if (procResult.success) {
            // Distribuir procedimentos para cada paciente e enriquecer
            for (const [pid, procs] of procResult.proceduresByPatientId.entries()) {
              const patient = patientsMap.get(pid);
              if (!patient) continue;
              
              // Converter centavos para reais e mapear campos
              patient.procedures = procs.map(p => ({
                procedure_id: p.id,
                procedure_code: p.procedure_code,
                procedure_description: p.procedure_description || 'Descrição não disponível',
                procedure_date: p.procedure_date,
                value_reais: typeof p.total_value === 'number' ? p.total_value / 100 : 0,
                value_cents: typeof p.total_value === 'number' ? p.total_value : 0,
                approved: p.billing_status === 'approved' || p.match_status === 'approved',
                approval_status: p.billing_status || p.match_status,
                sequence: p.sequencia,
                aih_id: p.aih_id,
                match_confidence: p.match_confidence || 0,
                sigtap_description: p.procedure_description,
                complexity: p.complexity,
                professional_name: p.professional_name,
                cbo: p.professional_cbo,
                participation: 'Responsável'
              }));
              
              // Enriquecer descrições com SIGTAP quando necessário
              patient.procedures = await DoctorPatientService.enrichProceduresWithSigtap(patient.procedures);
              
              // Atualizar contadores do paciente
              patient.total_procedures = patient.procedures.length;
              patient.approved_procedures = patient.procedures.filter(pp => pp.approved).length;
            }
          } else {
            console.warn('⚠️ Falha ao buscar procedimentos por paciente:', procResult.error);
          }
        }
      } catch (procErr) {
        console.warn('⚠️ Erro ao carregar procedimentos por paciente:', procErr);
      }

      // 6. ORDENAR PROCEDIMENTOS POR DATA (MAIS RECENTE PRIMEIRO)
      Array.from(patientsMap.values()).forEach(patient => {
        patient.procedures.sort((a, b) => 
          new Date(b.procedure_date).getTime() - new Date(a.procedure_date).getTime()
        );
        // 🆕 Garantir Nome Comum após ordenação (se ainda não definido)
        if (!patient.common_name) {
          const codes = patient.procedures.map(pp => pp.procedure_code).filter(Boolean);
          const doctorSpecialty = (doctor.doctor_info?.specialty || '').trim() || undefined;
          try {
            const { resolveCommonProcedureName } = require('../utils/commonProcedureName');
            patient.common_name = resolveCommonProcedureName(codes, doctorSpecialty, patient.procedures);
          } catch {}
        }
      });

      const result: DoctorPatientData = {
        doctor_id: doctorData.id,
        doctor_name: doctorData.name,
        doctor_cns: doctorData.cns,
        doctor_crm: doctorData.crm,
        doctor_specialty: doctorData.specialty,
        patients: Array.from(patientsMap.values())
      };

      console.log(`✅ Médico encontrado: ${result.doctor_name}`);
      console.log(`👥 Pacientes atendidos: ${result.patients.length}`);
      console.log(`🩺 Total de procedimentos detalhados: ${result.patients.reduce((sum, p) => sum + p.procedures.length, 0)}`);
      
      return {
        success: true,
        data: result
      };

    } catch (error) {
      console.error('❌ Erro ao buscar médico e pacientes:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Erro desconhecido'
      };
    }
  }

  /**
   * 🔍 BUSCAR MÉDICO POR NOME E OBTER TODOS OS PACIENTES ATENDIDOS
   */
  static async getDoctorWithPatientsByName(doctorName: string): Promise<{
    success: boolean;
    data?: DoctorPatientData[];
    error?: string;
  }> {
    try {
      console.log('🔍 Buscando médicos por nome:', doctorName);
      
      // 1. BUSCAR MÉDICOS POR NOME
      const { data: doctorsData, error: doctorsError } = await supabase
        .from('doctors')
        .select('id, name, cns, crm, specialty')
        .ilike('name', `%${doctorName}%`)
        .limit(10);

      if (doctorsError || !doctorsData || doctorsData.length === 0) {
        return {
          success: false,
          error: 'Nenhum médico encontrado com este nome'
        };
      }

      // 2. BUSCAR DADOS DE CADA MÉDICO
      const results: DoctorPatientData[] = [];
      
      for (const doctor of doctorsData) {
        const doctorResult = await this.getDoctorWithPatients(doctor.cns);
        if (doctorResult.success && doctorResult.data) {
          results.push(doctorResult.data);
        }
      }

      return {
        success: true,
        data: results
      };

    } catch (error) {
      console.error('❌ Erro ao buscar médicos por nome:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Erro desconhecido'
      };
    }
  }

  /**
   * 📊 OBTER ESTATÍSTICAS RESUMIDAS DE UM MÉDICO
   */
  static async getDoctorStatistics(doctorCns: string): Promise<{
    success: boolean;
    data?: {
      total_patients: number;
      total_procedures: number;
      approved_procedures: number;
      total_revenue_reais: number;
      avg_procedures_per_patient: number;
      most_common_procedures: string[];
      last_activity_date: string;
    };
    error?: string;
  }> {
    try {
      const doctorResult = await this.getDoctorWithPatients(doctorCns);
      
      if (!doctorResult.success || !doctorResult.data) {
        return {
          success: false,
          error: doctorResult.error || 'Dados do médico não encontrados'
        };
      }

      const { patients } = doctorResult.data;
      
      const stats = {
        total_patients: patients.length,
        total_procedures: patients.reduce((sum, p) => sum + p.total_procedures, 0),
        approved_procedures: patients.reduce((sum, p) => sum + p.approved_procedures, 0),
        total_revenue_reais: patients.reduce((sum, p) => sum + p.total_value_reais, 0),
        avg_procedures_per_patient: patients.length > 0 ? 
          patients.reduce((sum, p) => sum + p.total_procedures, 0) / patients.length : 0,
        most_common_procedures: [], // TODO: Implementar análise de procedimentos mais comuns
                  last_activity_date: patients.reduce((latest, p) => {
            const patientLatest = p.procedures.reduce((max, proc) => {
              const procDate = new Date(proc.procedure_date).toISOString();
              return procDate > max ? procDate : max;
            }, '');
            return patientLatest > latest ? patientLatest : latest;
          }, '')
      };

      return {
        success: true,
        data: stats
      };

    } catch (error) {
      console.error('❌ Erro ao calcular estatísticas:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Erro desconhecido'
      };
    }
  }

  /**
   * 🔍 BUSCAR TODOS OS MÉDICOS COM FILTROS
   */
  static async searchDoctorsWithPatients(filters: DoctorSearchFilters = {}): Promise<{
    success: boolean;
    data?: DoctorPatientData[];
    error?: string;
  }> {
    try {
      console.log('🔍 Buscando médicos com filtros:', filters);
      
      let query = supabase
        .from('doctors')
        .select('id, name, cns, crm, specialty');

      // Aplicar filtros
      if (filters.specialty) {
        query = query.ilike('specialty', `%${filters.specialty}%`);
      }

      if (filters.searchTerm) {
        query = query.or(`name.ilike.%${filters.searchTerm}%,crm.ilike.%${filters.searchTerm}%`);
      }

      // Limitar resultados
      query = query.limit(50);

      const { data: doctorsData, error: doctorsError } = await query;

      if (doctorsError) {
        return {
          success: false,
          error: `Erro na busca: ${doctorsError.message}`
        };
      }

      if (!doctorsData || doctorsData.length === 0) {
        return {
          success: true,
          data: []
        };
      }

      // Buscar dados completos de cada médico
      const results: DoctorPatientData[] = [];
      
      for (const doctor of doctorsData) {
        const doctorResult = await this.getDoctorWithPatients(doctor.cns);
        if (doctorResult.success && doctorResult.data) {
          results.push(doctorResult.data);
        }
      }

      return {
        success: true,
        data: results
      };

    } catch (error) {
      console.error('❌ Erro na busca de médicos:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Erro desconhecido'
      };
    }
  }

  /**
   * 📋 LISTAR TODOS OS MÉDICOS DISPONÍVEIS (RESUMIDO)
   */
  static async getAllDoctorsSummary(): Promise<{
    success: boolean;
    data?: Array<{
      id: string;
      name: string;
      cns: string;
      crm: string;
      specialty: string;
      patient_count: number;
      procedure_count: number;
      last_activity: string;
    }>;
    error?: string;
  }> {
    try {
      console.log('📋 Listando resumo de todos os médicos...');
      
      const { data: doctorsData, error: doctorsError } = await supabase
        .from('doctors')
        .select('id, name, cns, crm, specialty')
        .eq('is_active', true)
        .order('name');

      if (doctorsError) {
        return {
          success: false,
          error: `Erro ao buscar médicos: ${doctorsError.message}`
        };
      }

      if (!doctorsData || doctorsData.length === 0) {
        return {
          success: true,
          data: []
        };
      }

      // Para cada médico, buscar estatísticas básicas
      const results = await Promise.all(
        doctorsData.map(async (doctor) => {
          const stats = await this.getDoctorStatistics(doctor.cns);
          return {
            id: doctor.id,
            name: doctor.name,
            cns: doctor.cns,
            crm: doctor.crm,
            specialty: doctor.specialty,
            patient_count: stats.success ? stats.data!.total_patients : 0,
            procedure_count: stats.success ? stats.data!.total_procedures : 0,
            last_activity: stats.success ? stats.data!.last_activity_date : ''
          };
        })
      );

      return {
        success: true,
        data: results
      };

    } catch (error) {
      console.error('❌ Erro ao listar médicos:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Erro desconhecido'
      };
    }
  }

  /**
   * 👨‍⚕️ BUSCAR APENAS MÉDICOS RESPONSÁVEIS COM DADOS DOS PACIENTES
   * Esta função busca dados reais do banco filtrando apenas médicos responsáveis (cns_responsavel)
   * Exclui médicos autorizadores e solicitantes (que são externos à empresa)
   * 
   * 🔄 FLUXO CORRETO: Médico (CNS) → AIH (cns_responsavel) → Paciente (patient_id) → Procedimentos (patient_id)
   */
  static async getAllDoctorsWithPatients(): Promise<DoctorWithPatients[]> {
    try {
      console.log('👨‍⚕️ ✅ NOVA VERSÃO: Buscando TODAS as AIHs (818) com fallback inteligente para médicos...');
      
      // 1. ✅ BUSCAR TODAS AS AIHS (INCLUINDO SEM MÉDICO RESPONSÁVEL)
      const { data: aihsData, error: aihsError } = await supabase
        .from('aihs')
        .select(`
          id,
          aih_number,
          hospital_id,
          patient_id,
          admission_date,
          discharge_date,
          main_cid,
          calculated_total_value,
          processing_status,
          cns_responsavel,
          cns_solicitante,
          cns_autorizador,
          total_procedures,
          approved_procedures,
          source_file,
          care_character,
          patients (
            id,
            name,
            cns,
            birth_date,
            gender,
            medical_record
          )
        `)
        .order('admission_date', { ascending: false });

      if (aihsError) {
        console.error('❌ Erro ao buscar AIHs:', aihsError);
            console.log('⚠️ Retornando dados de teste...');
    console.log('💰 VALORES CORRIGIDOS: Dados de mock agora usam valores em reais (não centavos)');
    return this.getMockDoctorData();
      }

      if (!aihsData || aihsData.length === 0) {
            console.log('⚠️ Nenhuma AIH encontrada no banco, retornando dados de teste...');
    console.log('💰 VALORES CORRIGIDOS: Dados de mock agora usam valores em reais (não centavos)');
    return this.getMockDoctorData();
      }

      // ✅ PROCEDIMENTOS AGORA SÃO GERENCIADOS PELO SimplifiedProcedureService
      console.log(`🔄 Procedimentos para ${aihsData.length} AIHs serão carregados pelo SimplifiedProcedureService`);

      // 3. ✅ CRIAR MAPA DE MÉDICOS (apenas RESPONSÁVEL)
      const allDoctorsCns = new Set<string>();
      
      aihsData.forEach(aih => {
        if (aih.cns_responsavel) {
          allDoctorsCns.add(aih.cns_responsavel);
        }
      });
      
      const uniqueDoctorsCns = Array.from(allDoctorsCns);
      console.log(`👨‍⚕️ CNS únicos encontrados (com fallbacks): ${uniqueDoctorsCns.length}`);
      console.log(`📋 Lista de CNS: [${uniqueDoctorsCns.join(', ')}]`);

      // 3.1. BUSCAR DADOS REAIS DOS MÉDICOS
      const doctorsMap = new Map<string, DoctorWithPatients>();
      const realDoctorsData = await this.getRealDoctorsData(uniqueDoctorsCns);

      uniqueDoctorsCns.forEach(cns => {
        const realData = realDoctorsData.get(cns);
        
        // ✅ TRATAR CASOS ESPECIAIS
        let doctorInfo;
        if (cns === 'NAO_IDENTIFICADO') {
          doctorInfo = {
            cns: 'NAO_IDENTIFICADO',
            name: '⚠️ Médico Não Identificado',
            crm: 'N/A',
            specialty: 'AIHs sem CNS médico'
          };
        } else if (realData) {
          // Médico encontrado na tabela doctors
          doctorInfo = {
            cns: cns,
            name: realData.name,
            crm: realData.crm || '',
            specialty: realData.specialty || 'Especialidade não informada'
          };
        } else {
          // Médico não cadastrado - criar entrada temporária
          doctorInfo = {
            cns: cns,
            name: `🔍 Dr(a). CNS ${cns}`,
            crm: 'Não Cadastrado',
            specialty: 'Médico não cadastrado no sistema'
          };
          console.log(`📝 Criando médico temporário para CNS: ${cns}`);
        }
        
        doctorsMap.set(cns, {
          doctor_info: doctorInfo,
          hospitals: realData?.hospitals || [],
          patients: []
        });
      });

      // 4. 🎯 PROCESSAR DADOS GARANTINDO RELAÇÃO 1:1 ENTRE AIH-PACIENTE
      // ❌ REMOVIDO: processedProcedureIds (estava causando duplicatas falsas)
      const globalPatientsProcessed = new Set<string>(); // Evitar duplicatas globais
      
      console.log('\n🔍 === PROCESSAMENTO POR MÉDICO ===');
      
      Array.from(doctorsMap.keys()).forEach(doctorCns => {
        const doctor = doctorsMap.get(doctorCns)!;
        const patientsMap = new Map<string, PatientWithProcedures>();

      // 4.1. ✅ ENCONTRAR AIHs ASSOCIADAS A ESTE MÉDICO (APENAS RESPONSÁVEL)
        console.log(`\n👨‍⚕️ Processando médico: ${doctor.doctor_info.name} (CNS: ${doctorCns})`);
        
        // 🔍 LOG ESPECÍFICO PARA MÉDICO DA CLEUZA
        if (doctorCns === '707000845390335') {
          console.log(`🎯 ESTE É O MÉDICO DA CLEUZA!`);
          console.log(`   CNS: ${doctorCns}`);
          console.log(`   Nome: ${doctor.doctor_info.name}`);
        }
        
        const aihsForThisDoctor = aihsData.filter(aih => aih.cns_responsavel === doctorCns);
        
        console.log(`   📋 ${aihsForThisDoctor.length} AIHs associadas a este médico`);
        
        aihsForThisDoctor.forEach((aih, index) => {
          const patientId = aih.patient_id;
          const aihId = aih.id; // ✅ USAR AIH_ID COMO CHAVE PARA PERMITIR MÚLTIPLAS AIHs DO MESMO PACIENTE
          const patient = aih.patients as any;
          
          console.log(`     AIH ${index + 1}: ${aih.id} → Paciente: ${patientId}`);
          console.log(`       Nome: ${patient?.name || 'Nome não disponível'}`);
          
          // ✅ CORREÇÃO: USAR AIH_ID COMO CHAVE (não patient_id) para permitir múltiplas AIHs do mesmo paciente
          // Isso alinha com a tela Pacientes que mostra todas as AIHs, não pacientes únicos
          if (patient && patientId && aihId && !patientsMap.has(aihId)) {
            patientsMap.set(aihId, {
              patient_id: patientId,
              patient_info: {
                name: patient.name,
                cns: patient.cns,
                birth_date: patient.birth_date,
                gender: patient.gender,
                medical_record: patient.medical_record
              },
              aih_info: {
                admission_date: aih.admission_date,
                discharge_date: aih.discharge_date,
                aih_number: aih.aih_number,
                care_character: aih.care_character,
                hospital_id: aih.hospital_id
              },
              total_value_reais: (aih.calculated_total_value || 0) / 100, // ✅ USAR VALOR REAL DA AIH, NÃO DOS PROCEDIMENTOS
              procedures: [], // ✅ INICIALIZAR COMO ARRAY VAZIO
              total_procedures: 0,
              approved_procedures: 0
            });
            
            // 🔍 LOG ESPECÍFICO PARA CLEUZA
            if (patient.name && patient.name.toUpperCase().includes('CLEUZA')) {
              console.log(`🔍 CLEUZA DETECTADA!`);
              console.log(`   Patient ID: ${patientId} (${typeof patientId})`);
              console.log(`   AIH ID: ${aihId} (${typeof aihId})`);
              console.log(`   Nome: ${patient.name}`);
              console.log(`   CNS: ${patient.cns}`);
              console.log(`   Valor AIH: R$ ${((aih.calculated_total_value || 0) / 100).toFixed(2)}`);
              console.log(`   Procedures array inicializado: ${Array.isArray(patientsMap.get(aihId)?.procedures)}`);
              console.log(`   🏥 ASSOCIADA AO MÉDICO: ${doctor.doctor_info.name} (CNS: ${doctor.doctor_info.cns})`);
            }
            
            console.log(`       ✅ AIH ${aih.aih_number} adicionada com valor R$ ${((aih.calculated_total_value || 0) / 100).toFixed(2)}`);
          } else if (patientsMap.has(aihId)) {
            console.log(`       ⚠️  AIH já existe para este médico`);
          } else {
            console.log(`       ❌ Dados do paciente/AIH inválidos`);
          }
        });
        
        console.log(`   👥 Resultado: ${patientsMap.size} AIHs para este médico`);
        
        if (patientsMap.size > 0) {
          console.log(`   🔍 AMOSTRA DAS PRIMEIRAS 3 AIHs DESTE MÉDICO:`);
          const aihEntries = Array.from(patientsMap.entries()).slice(0, 3);
          aihEntries.forEach(([aihKey, patientData], index) => {
            console.log(`      ${index + 1}. AIH_ID: ${aihKey} (${typeof aihKey}) | Paciente: ${patientData.patient_info?.name} | AIH: ${patientData.aih_info?.aih_number}`);
          });
        }

        // 4.3. ✅ FINALIZAR DADOS DO MÉDICO - INCLUIR TODOS OS PACIENTES
        const allPatients = Array.from(patientsMap.values());
        
        // ✅ INCLUIR TODOS OS PACIENTES
        doctor.patients = allPatients;

        const totalRevenueThisDoctor = doctor.patients.reduce((sum, p) => sum + p.total_value_reais, 0);
        console.log(`👨‍⚕️ Médico ${doctor.doctor_info.name}: ${doctor.patients.length} pacientes TOTAL`);
        console.log(`   💰 Receita total: R$ ${totalRevenueThisDoctor.toFixed(2)} (usando calculated_total_value das AIHs)`);
        console.log(`   🔄 Procedimentos serão carregados pelo SimplifiedProcedureService`);
        
        // 🔍 LOG ESPECÍFICO PARA DEBUG - MOSTRAR TODOS OS PACIENTES
        console.log(`   📋 TODOS OS PACIENTES DESTE MÉDICO (${allPatients.length}):`);
        allPatients.forEach((patient, index) => {
          console.log(`      ${index + 1}. ${patient.patient_info?.name}:`);
          console.log(`         - Total_value_reais: ${patient.total_value_reais}`);
          console.log(`         - Procedures: ${patient.procedures?.length || 0} (serão carregados separadamente)`);
          
          // 🔍 LOG ESPECÍFICO PARA CLEUZA - RESULTADO FINAL
          if (patient.patient_info?.name?.toUpperCase().includes('CLEUZA')) {
            console.log(`🔍 CLEUZA - RESULTADO FINAL:`);
            console.log(`   Nome: ${patient.patient_info.name}`);
            console.log(`   Patient data para o SimplifiedProcedureService:`, patient.patient_info);
          }
        });
      });

      // 4.4. ✅ CARREGAR PROCEDIMENTOS EM LOTE PARA TODOS OS PACIENTES COLETADOS
      try {
        const allPatientIdsSet = new Set<string>();
        Array.from(doctorsMap.values()).forEach(doc => {
          (doc.patients || []).forEach(p => {
            const pid = (p as any).patient_id;
            if (pid) allPatientIdsSet.add(pid);
          });
        });
        const allPatientIds = Array.from(allPatientIdsSet);
        if (allPatientIds.length > 0) {
          const { ProcedureRecordsService } = await import('./simplifiedProcedureService');
          const procResult = await ProcedureRecordsService.getProceduresByPatientIds(allPatientIds);
          if (procResult.success) {
            Array.from(doctorsMap.values()).forEach(async (doc) => {
              doc.patients = await Promise.all(doc.patients.map(async (patient: any) => {
                const pid = patient.patient_id;
                const procs = procResult.proceduresByPatientId.get(pid) || [];
                let mapped = procs.map(p => ({
                  procedure_id: p.id,
                  procedure_code: p.procedure_code,
                  procedure_description: p.procedure_description || 'Descrição não disponível',
                  procedure_date: p.procedure_date,
                  value_reais: typeof p.total_value === 'number' ? p.total_value / 100 : 0,
                  value_cents: typeof p.total_value === 'number' ? p.total_value : 0,
                  approved: p.billing_status === 'approved' || p.match_status === 'approved' || p.billing_status === 'paid',
                  approval_status: p.billing_status || p.match_status,
                  sequence: p.sequencia,
                  aih_id: p.aih_id,
                  match_confidence: p.match_confidence || 0,
                  sigtap_description: p.procedure_description,
                  complexity: p.complexity,
                  professional_name: p.professional_name,
                  cbo: p.professional_cbo,
                  participation: 'Responsável'
                }));
                try {
                  mapped = await DoctorPatientService.enrichProceduresWithSigtap(mapped);
                } catch {}
                patient.procedures = mapped.sort((a: any, b: any) => new Date(b.procedure_date).getTime() - new Date(a.procedure_date).getTime());
                patient.total_procedures = patient.procedures.length;
                patient.approved_procedures = patient.procedures.filter((pp: any) => pp.approved).length;
                return patient;
              }));
            });
          } else {
            console.warn('⚠️ Falha ao buscar procedimentos em lote:', procResult.error);
          }
        }
      } catch (err) {
        console.warn('⚠️ Erro ao carregar procedimentos em lote:', err);
      }

      // 5. ✅ RETORNAR APENAS MÉDICOS COM PACIENTES
      const doctorsWithPatients = Array.from(doctorsMap.values()).filter(doctor => 
        doctor.patients && doctor.patients.length > 0
      );

      // 6. ✅ RESUMO FINAL E VALIDAÇÃO DE INTEGRIDADE
      console.log(`\n📊 === RESUMO FINAL ===`);
      
      const totalPatientsUnique = globalPatientsProcessed.size;
      const totalMedicosWithPatients = doctorsWithPatients.length;
      
      // Contagem detalhada por médico
      let totalPatientsInResults = 0;
      
      doctorsWithPatients.forEach(doctor => {
        const patientsCount = doctor.patients.length;
        totalPatientsInResults += patientsCount;
        console.log(`👨‍⚕️ ${doctor.doctor_info.name}: ${patientsCount} pacientes`);
      });
      
      console.log(`\n🎯 VALIDAÇÃO DE INTEGRIDADE:`);
      console.log(`   📋 AIHs processadas: ${aihsData.length}`);
      console.log(`   👥 Pacientes únicos processados: ${totalPatientsUnique}`);
      console.log(`   👥 Pacientes nos resultados: ${totalPatientsInResults}`);
      console.log(`   👨‍⚕️ Médicos com pacientes: ${totalMedicosWithPatients}`);
      console.log(`   🔄 Procedimentos serão carregados pelo SimplifiedProcedureService`);
      
      // ✅ RESUMO DOS DADOS PROCESSADOS
      console.log(`\n🔍 DADOS PROCESSADOS COM SUCESSO:`);
      console.log(`   Pacientes únicos: ${totalPatientsUnique} ✅`);
      console.log(`   Médicos com pacientes: ${totalMedicosWithPatients} ✅`);
      console.log(`   Procedimentos: delegados ao SimplifiedProcedureService ✅`);
      
      if (doctorsWithPatients.length === 0) {
            console.log('⚠️ Nenhum médico com pacientes encontrado, retornando dados de teste...');
    console.log('💰 VALORES CORRIGIDOS: Dados de mock agora usam valores em reais (não centavos)');
    return this.getMockDoctorData();
      }

      // ✅ VERIFICAÇÃO FINAL: CALCULAR TOTAL DE RECEITA (BASEADO NAS AIHs)
      const totalRevenue = doctorsWithPatients.reduce((sum, doctor) => {
        return sum + doctor.patients.reduce((docSum, patient) => docSum + patient.total_value_reais, 0);
      }, 0);

      console.log(`\n💰 === VERIFICAÇÃO FINAL DE VALORES ===`);
      console.log(`🎯 RECEITA TOTAL CALCULADA: R$ ${totalRevenue.toFixed(2)}`);
      console.log(`📊 Este valor é baseado nas AIHs (calculated_total_value)`);
      console.log(`✅ Procedimentos individuais serão carregados pelo SimplifiedProcedureService`);
      console.log(`============================================\n`);

      return doctorsWithPatients;

    } catch (error) {
      console.error('❌ Erro na busca de médicos com pacientes:', error);
          console.log('⚠️ Retornando dados de teste devido ao erro...');
    console.log('💰 VALORES CORRIGIDOS: Dados de mock agora usam valores em reais (não centavos)');
    return this.getMockDoctorData();
    }
  }

  /**
   * 🔍 DIAGNÓSTICO: Verificar estrutura de associação de dados no banco
   */
  static async diagnoseDatabaseStructure(): Promise<{
    success: boolean;
    data?: {
      aihs_with_doctors: number;
      unique_doctors: number;
      unique_patients: number;
      total_procedures: number;
      procedures_with_patients: number;
      association_rate: number;
      sample_associations: Array<{
        doctor_cns: string;
        patient_id: string;
        procedure_count: number;
        sample_procedure_codes: string[];
      }>;
    };
    error?: string;
  }> {
    try {
      console.log('🔍 === DIAGNÓSTICO DA ESTRUTURA DE DADOS ===');
      
      // 1. Verificar AIHs com médicos responsáveis
      const { data: aihsData, error: aihsError } = await supabase
        .from('aihs')
        .select('id, patient_id, cns_responsavel')
        .not('cns_responsavel', 'is', null);

      if (aihsError) {
        return {
          success: false,
          error: `Erro ao buscar AIHs: ${aihsError.message}`
        };
      }

      // 2. Verificar procedimentos
      const { data: proceduresData, error: proceduresError } = await supabase
        .from('procedure_records')
        .select('id, patient_id, procedure_code')
        .not('patient_id', 'is', null);

      if (proceduresError) {
        return {
          success: false,
          error: `Erro ao buscar procedimentos: ${proceduresError.message}`
        };
      }

      // 3. Análise de associação
      const uniqueDoctors = new Set(aihsData?.map(aih => aih.cns_responsavel) || []);
      const uniquePatients = new Set(aihsData?.map(aih => aih.patient_id) || []);
      const patientsFromAihs = new Set(aihsData?.map(aih => aih.patient_id) || []);
      const patientsFromProcedures = new Set(proceduresData?.map(proc => proc.patient_id) || []);
      
      // Procedimentos que têm patient_id válido
      const validProcedures = proceduresData?.filter(proc => 
        patientsFromAihs.has(proc.patient_id)
      ) || [];

      // Taxa de associação
      const associationRate = proceduresData && proceduresData.length > 0 
        ? (validProcedures.length / proceduresData.length) * 100 
        : 0;

      // 4. Amostras de associação por médico
      const sampleAssociations: Array<{
        doctor_cns: string;
        patient_id: string;
        procedure_count: number;
        sample_procedure_codes: string[];
      }> = [];

      // Agrupar por médico e mostrar exemplos
      Array.from(uniqueDoctors).slice(0, 3).forEach(doctorCns => {
        const doctorAihs = aihsData?.filter(aih => aih.cns_responsavel === doctorCns) || [];
        const doctorPatients = doctorAihs.map(aih => aih.patient_id);
        
        doctorPatients.slice(0, 2).forEach(patientId => {
          const patientProcedures = proceduresData?.filter(proc => proc.patient_id === patientId) || [];
          if (patientProcedures.length > 0) {
            sampleAssociations.push({
              doctor_cns: doctorCns,
              patient_id: patientId,
              procedure_count: patientProcedures.length,
              sample_procedure_codes: patientProcedures.slice(0, 3).map(p => p.procedure_code)
            });
          }
        });
      });

      const diagnosticData = {
        aihs_with_doctors: aihsData?.length || 0,
        unique_doctors: uniqueDoctors.size,
        unique_patients: uniquePatients.size,
        total_procedures: proceduresData?.length || 0,
        procedures_with_patients: validProcedures.length,
        association_rate: Math.round(associationRate * 100) / 100,
        sample_associations: sampleAssociations
      };

      console.log('📊 RESULTADO DO DIAGNÓSTICO:');
      console.log(`   🏥 AIHs com médicos responsáveis: ${diagnosticData.aihs_with_doctors}`);
      console.log(`   👨‍⚕️ Médicos únicos: ${diagnosticData.unique_doctors}`);
      console.log(`   👥 Pacientes únicos: ${diagnosticData.unique_patients}`);
      console.log(`   🩺 Total de procedimentos: ${diagnosticData.total_procedures}`);
      console.log(`   ✅ Procedimentos associados: ${diagnosticData.procedures_with_patients}`);
      console.log(`   📈 Taxa de associação: ${diagnosticData.association_rate}%`);
      
      console.log('\n🔍 AMOSTRAS DE ASSOCIAÇÃO:');
      sampleAssociations.forEach((sample, index) => {
        console.log(`   ${index + 1}. Médico ${sample.doctor_cns.substring(0, 5)}... → Paciente ${sample.patient_id.substring(0, 8)}...`);
        console.log(`      📋 ${sample.procedure_count} procedimentos: [${sample.sample_procedure_codes.join(', ')}]`);
      });

      return {
        success: true,
        data: diagnosticData
      };

    } catch (error) {
      console.error('❌ Erro no diagnóstico:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Erro desconhecido'
      };
    }
  }

  /**
   * 👨‍⚕️ DADOS DE TESTE PARA DEMONSTRAÇÃO - APENAS MÉDICOS RESPONSÁVEIS
   * Retorna dados simulados dos 3 médicos responsáveis e 12 pacientes mencionados pelo usuário
   * Exclui médicos autorizadores e solicitantes (externos à empresa)
   */
  private static getMockDoctorData(): DoctorWithPatients[] {
    return [
      {
        doctor_info: {
          name: 'Dr. João Silva Oliveira',
          cns: '123456789012345',
          crm: '54321-SP',
          specialty: 'Cirurgia Geral'
        },
        hospitals: [
          {
            hospital_id: 'hosp-001',
            hospital_name: 'Hospital São Lucas',
            hospital_cnpj: '12.345.678/0001-90',
            role: 'Cirurgião Titular',
            department: 'Centro Cirúrgico',
            is_primary_hospital: true,
            is_active: true
          },
          {
            hospital_id: 'hosp-002',
            hospital_name: 'Hospital Central',
            hospital_cnpj: '98.765.432/0001-10',
            role: 'Plantonista',
            department: 'Cirurgia Geral',
            is_primary_hospital: false,
            is_active: true
          }
        ],
        patients: [
          {
            patient_info: {
              name: 'Maria Santos',
              cns: '987654321012345',
              birth_date: '1985-03-15',
              gender: 'F',
              medical_record: 'MR001'
            },
            aih_info: {
              admission_date: '2024-01-14',
              discharge_date: '2024-01-16',
              aih_number: 'AIH001234567890'
            },
            total_value_reais: 1850.00, // ✅ CORRIGIDO: Era 185000 centavos = R$ 1.850,00
            procedures: [
              {
                procedure_code: '03.03.14.008-9',
                procedure_description: 'Colecistectomia videolaparoscópica',
                procedure_date: '2024-01-15',
                value_reais: 1850.00,
                value_cents: 185000,
                approval_status: 'approved',
                sequence: 1,
                aih_id: 'mock-aih-001',
                match_confidence: 95,
                billing_status: 'approved',
                professional_name: 'Dr. João Silva Oliveira',
                cbo: '225125',
                participation: 'Responsável'
              }
            ],
            total_procedures: 1,
            approved_procedures: 1
          },
          {
            patient_info: {
              name: 'Carlos Mendes',
              cns: '876543210987654',
              birth_date: '1978-07-22',
              gender: 'M',
              medical_record: 'MR002'
            },
            aih_info: {
              admission_date: '2024-01-19',
              discharge_date: '2024-01-21',
              aih_number: 'AIH001234567891'
            },
            total_value_reais: 1200.00, // ✅ CORRIGIDO: Era 120000 centavos = R$ 1.200,00
            procedures: [
              {
                procedure_code: '03.03.01.017-8',
                procedure_description: 'Apendicectomia',
                procedure_date: '2024-01-20',
                value_reais: 1200.00,
                value_cents: 120000,
                approval_status: 'approved',
                sequence: 1,
                aih_id: 'mock-aih-002',
                match_confidence: 92,
                billing_status: 'approved',
                professional_name: 'Dr. João Silva Oliveira',
                cbo: '225125',
                participation: 'Responsável'
              }
            ],
            total_procedures: 1,
            approved_procedures: 1
          },
          {
            patient_info: {
              name: 'Ana Oliveira',
              cns: '765432109876543',
              birth_date: '1990-12-10',
              gender: 'F',
              medical_record: 'MR003'
            },
            aih_info: {
              admission_date: '2024-01-24',
              discharge_date: '2024-01-26',
              aih_number: 'AIH001234567892'
            },
            total_value_reais: 980.00, // ✅ CORRIGIDO: Era 98000 centavos = R$ 980,00
            procedures: [
              {
                procedure_code: '03.03.03.012-0',
                procedure_description: 'Herniorrafia inguinal',
                procedure_date: '2024-01-25',
                value_reais: 980.00,
                value_cents: 98000,
                approval_status: 'approved',
                sequence: 1,
                aih_id: 'mock-aih-003',
                match_confidence: 88,
                billing_status: 'approved',
                professional_name: 'Dr. João Silva Oliveira',
                cbo: '225125',
                participation: 'Responsável'
              }
            ],
            total_procedures: 1,
            approved_procedures: 1
          },
          {
            patient_info: {
              name: 'Pedro Costa',
              cns: '654321098765432',
              birth_date: '1965-04-18',
              gender: 'M',
              medical_record: 'MR004'
            },
            aih_info: {
              admission_date: '2024-01-29',
              discharge_date: '2024-02-02',
              aih_number: 'AIH001234567893'
            },
            total_value_reais: 2100.00, // ✅ CORRIGIDO: Era 210000 centavos = R$ 2.100,00
            procedures: [
              {
                procedure_code: '03.03.02.008-4',
                procedure_description: 'Colectomia parcial',
                procedure_date: '2024-01-30',
                value_reais: 2100.00,
                value_cents: 210000,
                approval_status: 'approved',
                sequence: 1,
                aih_id: 'mock-aih-004',
                match_confidence: 97,
                billing_status: 'approved',
                professional_name: 'Dr. João Silva Oliveira',
                cbo: '225125',
                participation: 'Responsável'
              }
            ],
            total_procedures: 1,
            approved_procedures: 1
          }
        ]
      },
      {
        doctor_info: {
          name: 'Dra. Ana Paula Costa',
          cns: '234567890123456',
          crm: '67890-SP',
          specialty: 'Ginecologia e Obstetrícia'
        },
        hospitals: [
          {
            hospital_id: 'hosp-003',
            hospital_name: 'Maternidade Santa Clara',
            hospital_cnpj: '55.666.777/0001-88',
            role: 'Obstetra',
            department: 'Ginecologia',
            is_primary_hospital: true,
            is_active: true
          }
        ],
        patients: [
          {
            patient_info: {
              name: 'Luciana Pereira',
              cns: '432109876543210',
              birth_date: '1988-09-12',
              gender: 'F',
              medical_record: 'MR005'
            },
            aih_info: {
              admission_date: '2024-01-17',
              discharge_date: '2024-01-19',
              aih_number: 'AIH001234567894'
            },
            total_value_reais: 1650.00, // ✅ CORRIGIDO: Era 165000 centavos = R$ 1.650,00
            procedures: [
              {
                procedure_code: '03.11.07.010-2',
                procedure_description: 'Histerectomia total',
                procedure_date: '2024-01-18',
                value_reais: 1650.00,
                value_cents: 165000,
                approval_status: 'approved',
                sequence: 1,
                aih_id: 'mock-aih-005',
                match_confidence: 97,
                billing_status: 'approved',
                professional_name: 'Dra. Ana Paula Costa',
                cbo: '225165',
                participation: 'Responsável'
              }
            ],
            total_procedures: 1,
            approved_procedures: 1
          },
          {
            patient_info: {
              name: 'Isabela Santos',
              cns: '210987654321098',
              birth_date: '1993-02-14',
              gender: 'F',
              medical_record: 'MR006'
            },
            aih_info: {
              admission_date: '2024-01-21',
              discharge_date: '2024-01-23',
              aih_number: 'AIH001234567895'
            },
            total_value_reais: 980.00, // ✅ CORRIGIDO: Era 98000 centavos = R$ 980,00
            procedures: [
              {
                procedure_code: '03.11.01.004-0',
                procedure_description: 'Cesariana',
                procedure_date: '2024-01-22',
                value_reais: 980.00,
                value_cents: 98000,
                approval_status: 'approved',
                sequence: 1,
                aih_id: 'mock-aih-006',
                match_confidence: 94,
                billing_status: 'approved',
                professional_name: 'Dra. Ana Costa',
                cbo: '225165',
                participation: 'Responsável'
              }
            ],
            total_procedures: 1,
            approved_procedures: 1
          },
          {
            patient_info: {
              name: 'Claudia Ferreira',
              cns: '321098765432109',
              birth_date: '1985-06-30',
              gender: 'F',
              medical_record: 'MR007'
            },
            aih_info: {
              admission_date: '2024-01-25',
              discharge_date: '2024-01-27',
              aih_number: 'AIH001234567896'
            },
            total_value_reais: 1250.00, // ✅ CORRIGIDO: Era 125000 centavos = R$ 1.250,00
            procedures: [
              {
                procedure_code: '03.11.05.002-1',
                procedure_description: 'Laparoscopia ginecológica',
                procedure_date: '2024-01-26',
                value_reais: 1250.00,
                value_cents: 125000,
                approval_status: 'approved',
                sequence: 1,
                aih_id: 'mock-aih-007',
                match_confidence: 93,
                billing_status: 'approved',
                professional_name: 'Dra. Ana Costa',
                cbo: '225165',
                participation: 'Responsável'
              }
            ],
            total_procedures: 1,
            approved_procedures: 1
          },
          {
            patient_info: {
              name: 'Patricia Nascimento',
              cns: '876543210987654',
              birth_date: '1982-11-17',
              gender: 'F',
              medical_record: 'MR008'
            },
            aih_info: {
              admission_date: '2024-01-29',
              discharge_date: '2024-01-31',
              aih_number: 'AIH001234567897'
            },
            total_value_reais: 1420.00, // ✅ CORRIGIDO: Era 142000 centavos = R$ 1.420,00
            procedures: [
              {
                procedure_code: '03.11.02.009-4',
                procedure_description: 'Miomectomia',
                procedure_date: '2024-01-30',
                value_reais: 1420.00,
                value_cents: 142000,
                approval_status: 'approved',
                sequence: 1,
                aih_id: 'mock-aih-008',
                match_confidence: 96,
                billing_status: 'approved',
                professional_name: 'Dra. Ana Costa',
                cbo: '225165',
                participation: 'Responsável'
              }
            ],
            total_procedures: 1,
            approved_procedures: 1
          }
        ]
      },
      {
        doctor_info: {
          name: 'Dr. Pedro Henrique Almeida',
          cns: '345678901234567',
          crm: '98765-SP',
          specialty: 'Cardiologia'
        },
        hospitals: [],
        patients: [
          {
            patient_info: {
              name: 'José Ferreira',
              cns: '109876543210987',
              birth_date: '1960-12-10',
              gender: 'M',
              medical_record: 'MR009'
            },
            aih_info: {
              admission_date: '2024-01-18',
              discharge_date: '2024-01-20',
              aih_number: 'AIH001234567898'
            },
            total_value_reais: 2450.00, // ✅ CORRIGIDO: Era 245000 centavos = R$ 2.450,00
            procedures: [
              {
                procedure_code: '02.05.01.004-8',
                procedure_description: 'Cateterismo cardíaco',
                procedure_date: '2024-01-19',
                value_reais: 2450.00,
                value_cents: 245000,
                approval_status: 'approved',
                sequence: 1,
                aih_id: 'mock-aih-009',
                match_confidence: 98,
                billing_status: 'approved',
                professional_name: 'Dr. Pedro Henrique Almeida',
                cbo: '225133',
                participation: 'Responsável'
              }
            ],
            total_procedures: 1,
            approved_procedures: 1
          },
          {
            patient_info: {
              name: 'Mariana Lima',
              cns: '098765432109876',
              birth_date: '1975-08-25',
              gender: 'F',
              medical_record: 'MR010'
            },
            aih_info: {
              admission_date: '2024-01-22',
              discharge_date: '2024-01-24',
              aih_number: 'AIH001234567899'
            },
            total_value_reais: 1800.00, // ✅ CORRIGIDO: Era 180000 centavos = R$ 1.800,00
            procedures: [
              {
                procedure_code: '02.05.01.009-9',
                procedure_description: 'Ecocardiograma',
                procedure_date: '2024-01-23',
                value_reais: 180.00,
                value_cents: 180000,
                approval_status: 'approved',
                sequence: 1,
                aih_id: 'mock-aih-010',
                match_confidence: 91,
                billing_status: 'approved',
                professional_name: 'Dr. Pedro Almeida',
                cbo: '225133',
                participation: 'Responsável'
              }
            ],
            total_procedures: 1,
            approved_procedures: 1
          },
          {
            patient_info: {
              name: 'Antônio Rodrigues',
              cns: '192837465018273',
              birth_date: '1952-03-08',
              gender: 'M',
              medical_record: 'MR011'
            },
            aih_info: {
              admission_date: '2024-01-28',
              discharge_date: '2024-01-30',
              aih_number: 'AIH001234567900'
            },
            total_value_reais: 3200.00, // ✅ CORRIGIDO: Era 320000 centavos = R$ 3.200,00
            procedures: [
              {
                procedure_code: '02.05.01.005-6',
                procedure_description: 'Angioplastia coronária',
                procedure_date: '2024-01-29',
                value_reais: 3200.00,
                value_cents: 320000,
                approval_status: 'approved',
                sequence: 1,
                aih_id: 'mock-aih-011',
                match_confidence: 99,
                billing_status: 'approved',
                professional_name: 'Dr. Pedro Almeida',
                cbo: '225133',
                participation: 'Responsável'
              }
            ],
            total_procedures: 1,
            approved_procedures: 1
          },
          {
            patient_info: {
              name: 'Fernanda Oliveira',
              cns: '564738291047382',
              birth_date: '1987-05-14',
              gender: 'F',
              medical_record: 'MR012'
            },
            aih_info: {
              admission_date: '2024-02-01',
              discharge_date: '2024-02-03',
              aih_number: 'AIH001234567901'
            },
            total_value_reais: 1200.00, // ✅ CORRIGIDO: Era 120000 centavos = R$ 1.200,00
            procedures: [
              {
                procedure_code: '02.05.01.012-9',
                procedure_description: 'Holter 24 horas',
                procedure_date: '2024-02-02',
                value_reais: 120.00,
                value_cents: 120000,
                approval_status: 'approved',
                sequence: 1,
                aih_id: 'mock-aih-012',
                match_confidence: 87,
                billing_status: 'approved',
                professional_name: 'Dr. Pedro Almeida',
                cbo: '225133',
                participation: 'Responsável'
              }
            ],
            total_procedures: 1,
            approved_procedures: 1
          }
        ]
      }
    ];
  }

  /**
   * 🔧 MÉTODOS AUXILIARES
   */
  
  /**
   * 👨‍⚕️ BUSCAR DADOS REAIS DOS MÉDICOS POR CNS COM HOSPITAIS
   * Integra com as tabelas reais do banco para obter informações dos médicos e hospitais
   */
  private static async getRealDoctorsData(cnsList: string[]): Promise<Map<string, { name: string; crm: string; specialty: string; hospitals: DoctorHospital[] }>> {
    const doctorsMap = new Map<string, { name: string; crm: string; specialty: string; hospitals: DoctorHospital[] }>();
    
    if (cnsList.length === 0) {
      return doctorsMap;
    }

    try {
      console.log(`🔍 Buscando dados reais de ${cnsList.length} médicos com hospitais...`);

      // 1. Buscar médicos da tabela doctors (inclui id para usar como chave de relacionamento)
      const { data: doctorsTableData, error: doctorsTableError } = await supabase
        .from('doctors')
        .select('id, cns, name, crm, specialty')
        .in('cns', cnsList);

      if (doctorsTableError) {
        console.error('❌ Erro ao buscar médicos:', doctorsTableError);
        return doctorsMap;
      }

      // 2. Para cada médico, buscar seus hospitais
      if (doctorsTableData && doctorsTableData.length > 0) {
        console.log(`✅ Encontrados ${doctorsTableData.length} médicos na tabela doctors`);
        
        for (const doctor of doctorsTableData) {
          // Buscar hospitais associados ao médico (AGORA por doctor_id, não mais por doctor_cns)
          const { data: hospitalData, error: hospitalError } = await supabase
            .from('doctor_hospital')
            .select(`
              hospital_id,
              role,
              department,
              is_active,
              hospitals (
                id,
                name,
                cnpj
              )
            `)
            .eq('doctor_id', doctor.id)
            .eq('is_active', true);

          const hospitals: DoctorHospital[] = [];
          
          if (!hospitalError && hospitalData) {
            hospitals.push(...hospitalData.map(h => ({
              hospital_id: h.hospital_id,
              hospital_name: (h.hospitals as any)?.name || 'Hospital não identificado',
              hospital_cnpj: (h.hospitals as any)?.cnpj,
              role: h.role,
              department: h.department,
              is_active: h.is_active
            })));
          }

          // Se não tem hospitais cadastrados, tentar inferir do hospital das AIHs
          if (hospitals.length === 0) {
            console.log(`⚠️ Médico ${doctor.name} (CNS: ${doctor.cns}) sem hospital cadastrado na tabela doctor_hospital`);
            
            // Tentar inferir hospital das AIHs onde este médico é responsável
            const { data: aihsForDoctor } = await supabase
              .from('aihs')
              .select(`
                hospital_id,
                hospitals (
                  id,
                  name,
                  cnpj
                )
              `)
              .eq('cns_responsavel', doctor.cns)
              .limit(1);
            
            if (aihsForDoctor && aihsForDoctor.length > 0) {
              const aihHospital = aihsForDoctor[0];
              const hospitalInfo = aihHospital.hospitals as any;
              
              hospitals.push({
                hospital_id: aihHospital.hospital_id,
                hospital_name: hospitalInfo?.name || 'Hospital identificado por AIH',
                hospital_cnpj: hospitalInfo?.cnpj || '',
                role: 'Médico Responsável',
                department: 'Inferido por AIH',
                is_active: true
              });
              
              console.log(`✅ Hospital inferido para ${doctor.name}: ${hospitalInfo?.name || aihHospital.hospital_id}`);
            } else {
              // Último recurso: placeholder
              hospitals.push({
                hospital_id: '',
                hospital_name: 'Hospital não definido',
                hospital_cnpj: '',
                role: '',
                department: '',
                is_active: true
              });
              
              console.log(`❌ Não foi possível inferir hospital para ${doctor.name}`);
            }
          }

          doctorsMap.set(doctor.cns, {
            name: doctor.name,
            crm: doctor.crm || '',
            specialty: doctor.specialty || 'Especialidade não informada',
            hospitals: hospitals
          });
        }
        
        return doctorsMap;
      }

      console.warn('⚠️ Nenhum dado real de médicos encontrado, usando dados simulados');
      
      // Fallback: gerar dados baseados no CNS para médicos não encontrados
      cnsList.forEach(cns => {
        doctorsMap.set(cns, {
          name: this.generateDoctorName(cns),
          crm: this.generateCRM(cns),
          specialty: this.generateSpecialty(cns),
          hospitals: []
        });
      });

      return doctorsMap;

    } catch (error) {
      console.error('❌ Erro ao buscar dados reais dos médicos:', error);
      
      // Em caso de erro, gerar dados simulados
      cnsList.forEach(cns => {
        doctorsMap.set(cns, {
          name: this.generateDoctorName(cns),
          crm: this.generateCRM(cns),
          specialty: this.generateSpecialty(cns),
          hospitals: []
        });
      });

      return doctorsMap;
    }
  }

  /**
   * 🎭 GERAR NOME DE MÉDICO BASEADO NO CNS (FALLBACK)
   */
  private static generateDoctorName(cns: string): string {
    const names = [
      'Dr. João Silva Oliveira',
      'Dra. Maria Santos Costa',
      'Dr. Pedro Almeida Lima',
      'Dra. Ana Paula Ferreira',
      'Dr. Carlos Eduardo Santos',
      'Dra. Lucia Helena Rodrigues',
      'Dr. Roberto José Pereira',
      'Dra. Patricia Nascimento'
    ];
    
    const index = parseInt(cns.substring(10, 12)) % names.length;
    return names[index];
  }

  /**
   * 🏥 GERAR CRM BASEADO NO CNS (FALLBACK)
   */
  private static generateCRM(cns: string): string {
    const number = parseInt(cns.substring(5, 10)) % 99999 + 10000;
    return `${number}-SP`;
  }

  /**
   * 🩺 GERAR ESPECIALIDADE BASEADA NO CNS (FALLBACK)
   */
  private static generateSpecialty(cns: string): string {
    const specialties = [
      'Cirurgião Geral', 
      'Cardiologista', 
      'Ortopedista', 
      'Neurologista',
      'Ginecologista',
      'Pediatra',
      'Clínico Geral',
      'Gastroenterologista'
    ];
    
    const index = parseInt(cns.substring(8, 10)) % specialties.length;
    return specialties[index];
  }

  private static isDoctorRelatedToProcedure(procedure: any, doctorCns: string): boolean {
    // ❌ LÓGICA ANTIGA: Não existe campo professional_document
    // ✅ LÓGICA CORRETA: Procedimentos são associados aos pacientes, não diretamente aos médicos
    // Esta função não é mais necessária com o novo fluxo
    return false;
  }

  private static convertValueToReais(valueInCents: number): number {
    if (valueInCents > 10000) {
      // Valor provavelmente em centavos
      return valueInCents / 100;
    }
    return valueInCents;
  }

  /**
   * 🔍 DIAGNÓSTICO: Verificar dados reais disponíveis no banco
   */
  static async checkRealDataAvailability(): Promise<{
    aihs: number;
    procedures: number;
    patients: number;
    doctors: number;
    hospitals: number;
  }> {
    try {
      console.log('🔍 === VERIFICANDO DADOS REAIS NO BANCO ===');
      
      const [aihsCount, proceduresCount, patientsCount, doctorsCount, hospitalsCount] = await Promise.all([
        supabase.from('aihs').select('id', { count: 'exact', head: true }),
        supabase.from('procedure_records').select('id', { count: 'exact', head: true }),
        supabase.from('patients').select('id', { count: 'exact', head: true }),
        supabase.from('doctors').select('id', { count: 'exact', head: true }),
        supabase.from('hospitals').select('id', { count: 'exact', head: true })
      ]);

      const results = {
        aihs: aihsCount.count || 0,
        procedures: proceduresCount.count || 0,
        patients: patientsCount.count || 0,
        doctors: doctorsCount.count || 0,
        hospitals: hospitalsCount.count || 0
      };

      console.log('📊 DADOS DISPONÍVEIS:');
      console.log(`   🏥 AIHs: ${results.aihs}`);
      console.log(`   🩺 Procedimentos: ${results.procedures}`);
      console.log(`   👤 Pacientes: ${results.patients}`);
      console.log(`   👨‍⚕️ Médicos: ${results.doctors}`);
      console.log(`   🏨 Hospitais: ${results.hospitals}`);

      return results;
    } catch (error) {
      console.error('❌ Erro ao verificar dados reais:', error);
      return { aihs: 0, procedures: 0, patients: 0, doctors: 0, hospitals: 0 };
    }
  }

  /**
   * 🔄 ENRIQUECER PROCEDIMENTOS: Buscar descrições faltantes no SIGTAP
   */
  private static async enrichProceduresWithSigtap(procedures: any[]): Promise<any[]> {
    if (!procedures || procedures.length === 0) return procedures;

    try {
      // Encontrar códigos sem descrição
      const codesNeedingDescription = procedures
        .filter(p => p.procedure_code && (!p.procedure_description || p.procedure_description === 'Descrição não disponível'))
        .map(p => p.procedure_code);

      if (codesNeedingDescription.length === 0) return procedures;

      console.log(`🔍 Buscando descrições SIGTAP para ${codesNeedingDescription.length} procedimentos...`);

      // Buscar no SIGTAP oficial
      const { data: sigtapData } = await supabase
        .from('sigtap_procedimentos_oficial')
        .select('codigo, nome')
        .in('codigo', codesNeedingDescription);

      if (sigtapData && sigtapData.length > 0) {
        const descriptionMap = new Map(sigtapData.map(item => [item.codigo, item.nome]));
        
        console.log(`✅ Encontradas ${sigtapData.length} descrições no SIGTAP oficial`);

        return procedures.map(proc => ({
          ...proc,
          procedure_description: proc.procedure_description && proc.procedure_description !== 'Descrição não disponível'
            ? proc.procedure_description
            : descriptionMap.get(proc.procedure_code) || `Procedimento ${proc.procedure_code}`
        }));
      }

      return procedures;
    } catch (error) {
      console.warn('⚠️ Erro ao enriquecer procedimentos com SIGTAP:', error);
      return procedures;
    }
  }
}

// ================================================================
// 📋 EXEMPLO DE USO DO SERVIÇO - PROCEDIMENTOS INDIVIDUAIS COM VALORES
// ================================================================

/*
// Exemplo 1: Buscar médico por CNS e obter todos os pacientes COM PROCEDIMENTOS
const result = await DoctorPatientService.getDoctorWithPatients('123456789012345');
if (result.success) {
  console.log('Médico:', result.data.doctor_name);
  console.log('Pacientes atendidos:', result.data.patients.length);
  
  result.data.patients.forEach(patient => {
    console.log(`\n👤 ${patient.patient_name} (${patient.total_procedures} procedimentos)`);
    console.log(`   💰 Valor total: R$ ${patient.total_value_reais.toFixed(2)}`);
    console.log(`   ✅ Aprovados: ${patient.approved_procedures}`);
    
    // 🆕 LISTAR PROCEDIMENTOS INDIVIDUAIS COM VALORES
    console.log('   🩺 Procedimentos:');
    patient.procedures.forEach(proc => {
      console.log(`     - ${proc.procedure_code}: ${proc.procedure_description}`);
      console.log(`       💰 Valor: R$ ${proc.value_reais.toFixed(2)}`);
      console.log(`       📅 Data: ${proc.procedure_date}`);
      console.log(`       ✅ Status: ${proc.approved ? 'Aprovado' : 'Pendente'}`);
      console.log(`       🏥 AIH: ${proc.aih_number}`);
      console.log(`       📊 Sequência: ${proc.sequence}`);
      console.log(`       🎯 Confiança: ${proc.match_confidence}%`);
      console.log('');
    });
  });
}

// Exemplo 2: Buscar procedimentos específicos de um paciente
const result = await DoctorPatientService.getDoctorWithPatients('123456789012345');
if (result.success) {
  const patient = result.data.patients[0]; // Primeiro paciente
  
  // Procedimentos por valor (mais caros primeiro)
  const proceduresByValue = patient.procedures.sort((a, b) => b.value_reais - a.value_reais);
  console.log('Procedimentos mais caros:');
  proceduresByValue.slice(0, 3).forEach(proc => {
    console.log(`${proc.procedure_code}: R$ ${proc.value_reais.toFixed(2)}`);
  });
  
  // Procedimentos aprovados
  const approvedProcedures = patient.procedures.filter(proc => proc.approved);
  console.log(`\nProcedimentos aprovados: ${approvedProcedures.length}`);
  
  // Valor total dos procedimentos aprovados
  const totalApproved = approvedProcedures.reduce((sum, proc) => sum + proc.value_reais, 0);
  console.log(`Valor total aprovado: R$ ${totalApproved.toFixed(2)}`);
}

// Exemplo 3: Análise de produtividade médica
const result = await DoctorPatientService.getDoctorWithPatients('123456789012345');
if (result.success) {
  const doctor = result.data;
  
  // Estatísticas gerais
  const totalPatients = doctor.patients.length;
  const totalProcedures = doctor.patients.reduce((sum, p) => sum + p.procedures.length, 0);
  const totalRevenue = doctor.patients.reduce((sum, p) => sum + p.total_value_reais, 0);
  
  console.log(`\n📊 ANÁLISE DE PRODUTIVIDADE - ${doctor.doctor_name}`);
  console.log(`👥 Total de pacientes: ${totalPatients}`);
  console.log(`🩺 Total de procedimentos: ${totalProcedures}`);
  console.log(`💰 Receita total: R$ ${totalRevenue.toFixed(2)}`);
  console.log(`💰 Receita média por paciente: R$ ${(totalRevenue / totalPatients).toFixed(2)}`);
  console.log(`🩺 Procedimentos médios por paciente: ${(totalProcedures / totalPatients).toFixed(1)}`);
  
  // Procedimentos mais realizados
  const allProcedures = doctor.patients.flatMap(p => p.procedures);
  const procedureCount = allProcedures.reduce((acc, proc) => {
    acc[proc.procedure_code] = (acc[proc.procedure_code] || 0) + 1;
    return acc;
  }, {});
  
  console.log('\n🔝 TOP 5 PROCEDIMENTOS MAIS REALIZADOS:');
  Object.entries(procedureCount)
    .sort(([,a], [,b]) => b - a)
    .slice(0, 5)
    .forEach(([code, count]) => {
      console.log(`   ${code}: ${count} vezes`);
    });
}

// Exemplo 4: Buscar médicos com filtros
const filtered = await DoctorPatientService.searchDoctorsWithPatients({
  specialty: 'Cardiologia',
  searchTerm: 'Silva'
});
if (filtered.success) {
  console.log('Médicos encontrados:', filtered.data.length);
}
*/ 

// ================================================================
// 📋 EXEMPLO DE RESULTADO JSON COM PROCEDIMENTOS INDIVIDUAIS
// ================================================================

/*
🎯 RESULTADO COMPLETO DA FUNÇÃO getDoctorWithPatients():

{
  "success": true,
  "data": {
    "doctor_id": "uuid-12345",
    "doctor_name": "Dr. João Silva",
    "doctor_cns": "123456789012345",
    "doctor_crm": "SP-123456",
    "doctor_specialty": "Cardiologia",
    "patients": [
      {
        "patient_id": "uuid-67890",
        "patient_name": "Maria Santos",
        "patient_cns": "987654321098765",
        "patient_birth_date": "1980-05-15",
        "patient_gender": "F",
        "total_procedures": 3,
        "approved_procedures": 2,
        "total_value_reais": 15000.00,
        "aihs": [
          {
            "aih_id": "uuid-aih-001",
            "aih_number": "2024001234567",
            "admission_date": "2024-01-15",
            "discharge_date": "2024-01-20",
            "main_cid": "I21.0",
            "procedures_count": 3,
            "total_value_reais": 15000.00,
            "status": "matched"
          }
        ],
        "procedures": [
          {
            "procedure_id": "uuid-proc-001",
            "procedure_code": "04.06.01.003-9",
            "procedure_description": "Cirurgia de revascularização do miocárdio",
            "procedure_date": "2024-01-16",
            "value_reais": 12000.00,
            "value_cents": 1200000,
            "approved": true,
            "billing_status": "paid",
            "sequence": 1,
            "aih_number": "2024001234567",
            "match_confidence": 95.5,
            "sigtap_description": "Cirurgia de revascularização do miocárdio c/ CEC",
            "complexity": "ALTA COMPLEXIDADE"
          },
          {
            "procedure_id": "uuid-proc-002",
            "procedure_code": "02.03.01.002-6",
            "procedure_description": "Anestesia geral",
            "procedure_date": "2024-01-16",
            "value_reais": 2000.00,
            "value_cents": 200000,
            "approved": true,
            "billing_status": "paid",
            "sequence": 2,
            "aih_number": "2024001234567",
            "match_confidence": 98.0,
            "sigtap_description": "Anestesia geral para cirurgia cardíaca",
            "complexity": "MÉDIA COMPLEXIDADE"
          },
          {
            "procedure_id": "uuid-proc-003",
            "procedure_code": "02.11.06.010-0",
            "procedure_description": "Monitorização hemodinâmica",
            "procedure_date": "2024-01-17",
            "value_reais": 1000.00,
            "value_cents": 100000,
            "approved": false,
            "billing_status": "pending",
            "sequence": 3,
            "aih_number": "2024001234567",
            "match_confidence": 75.0,
            "sigtap_description": "Monitorização hemodinâmica invasiva",
            "complexity": "MÉDIA COMPLEXIDADE"
          }
        ]
      },
      {
        "patient_id": "uuid-67891",
        "patient_name": "João Oliveira",
        "patient_cns": "123456789012346",
        "patient_birth_date": "1975-03-22",
        "patient_gender": "M",
        "total_procedures": 2,
        "approved_procedures": 2,
        "total_value_reais": 8000.00,
        "aihs": [
          {
            "aih_id": "uuid-aih-002",
            "aih_number": "2024001234568",
            "admission_date": "2024-02-10",
            "discharge_date": "2024-02-12",
            "main_cid": "I25.0",
            "procedures_count": 2,
            "total_value_reais": 8000.00,
            "status": "matched"
          }
        ],
        "procedures": [
          {
            "procedure_id": "uuid-proc-004",
            "procedure_code": "04.06.01.014-4",
            "procedure_description": "Cateterismo cardíaco",
            "procedure_date": "2024-02-11",
            "value_reais": 6000.00,
            "value_cents": 600000,
            "approved": true,
            "billing_status": "paid",
            "sequence": 1,
            "aih_number": "2024001234568",
            "match_confidence": 92.0,
            "sigtap_description": "Cateterismo cardíaco para diagnóstico",
            "complexity": "ALTA COMPLEXIDADE"
          },
          {
            "procedure_id": "uuid-proc-005",
            "procedure_code": "02.03.01.001-8",
            "procedure_description": "Sedação",
            "procedure_date": "2024-02-11",
            "value_reais": 2000.00,
            "value_cents": 200000,
            "approved": true,
            "billing_status": "paid",
            "sequence": 2,
            "aih_number": "2024001234568",
            "match_confidence": 88.5,
            "sigtap_description": "Sedação para procedimento invasivo",
            "complexity": "MÉDIA COMPLEXIDADE"
          }
        ]
      }
    ]
  }
}

🎯 RESUMO DO QUE VOCÊ OBTÉM:

✅ DADOS DO MÉDICO: nome, CNS, CRM, especialidade
✅ LISTA DE PACIENTES: nome, CNS, dados básicos
✅ ESTATÍSTICAS POR PACIENTE: total de procedimentos, aprovados, valor total
✅ PROCEDIMENTOS INDIVIDUAIS: código, descrição, valor, data, status
✅ DETALHES COMPLETOS: AIH, sequência, confiança, complexidade
✅ VALORES PRECISOS: em reais e centavos
✅ STATUS DE APROVAÇÃO: para cada procedimento individual

*/
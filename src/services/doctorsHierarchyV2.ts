import { supabase } from '../lib/supabase';
import { ProcedureRecordsService } from './simplifiedProcedureService';
import { resolveCommonProcedureName } from '../utils/commonProcedureName';
import type { DoctorWithPatients, ProcedureDetail } from './doctorPatientService';

export interface HierarchyFilters {
  hospitalIds?: string[];
  dateFromISO?: string;
  dateToISO?: string;
  careCharacter?: string; // '1' | '2' | '3' | '4' | 'all'
}

export class DoctorsHierarchyV2Service {
  static async getDoctorsHierarchyV2(filters: HierarchyFilters = {}): Promise<DoctorWithPatients[]> {
    console.log('🚀 [HIERARCHY V2] Iniciando carregamento com filtros:', {
      hospitalIds: filters.hospitalIds,
      dateFromISO: filters.dateFromISO,
      dateToISO: filters.dateToISO,
      careCharacter: filters.careCharacter
    });
    
    // 1) AIHs com paciente — paginação para evitar limite padrão (1000)
    const baseSelect = `
        id,
        aih_number,
        hospital_id,
        patient_id,
        admission_date,
        discharge_date,
        main_cid,
        specialty,
        care_modality,
        requesting_physician,
        professional_cbo,
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
      `;

    const applyFilters = (q: any) => {
      let query = q;
      
      // Filtro de Hospital
      if (filters.hospitalIds && filters.hospitalIds.length > 0 && !filters.hospitalIds.includes('all')) {
        query = query.in('hospital_id', filters.hospitalIds);
      }
      
      // ✅ OTIMIZADO: Filtros de data aplicados no SQL (igual PatientManagement)
      // dateFromISO → filtra admission_date (Data de Admissão)
      if (filters.dateFromISO) {
        query = query.gte('admission_date', filters.dateFromISO);
      }
      
      // dateToISO → filtra discharge_date (Data de Alta)
      if (filters.dateToISO) {
        query = query.lte('discharge_date', filters.dateToISO);
        // Se filtrar por alta, excluir AIHs sem discharge_date
        query = query.not('discharge_date', 'is', null);
      }
      
      // Filtro de Caráter de Atendimento
      if (filters.careCharacter && filters.careCharacter !== 'all') {
        query = query.eq('care_character', filters.careCharacter);
      }
      
      return query;
    };

    const pageSize = 1000;
    let page = 0;
    let hasMore = true;
    const aihsAll: any[] = [];
    while (hasMore) {
      let pageQuery = supabase
        .from('aihs')
        .select(baseSelect)
        .order('updated_at', { ascending: false }) // ✅ Ordenar por updated_at (processados mais recentes)
        .range(page * pageSize, (page + 1) * pageSize - 1);
      pageQuery = applyFilters(pageQuery);
      const { data, error } = await pageQuery;
      if (error) {
        console.error('[V2] Erro AIHs (paginado):', error);
        return [];
      }
      if (data && data.length > 0) {
        aihsAll.push(...data);
        hasMore = data.length === pageSize;
        page += 1;
      } else {
        hasMore = false;
      }
    }

    const aihs = aihsAll;
    console.log(`✅ [HIERARCHY V2] Carregadas ${aihs.length} AIHs do banco (após filtros SQL)`);
    
    if (!aihs || aihs.length === 0) {
      console.log('⚠️ [HIERARCHY V2] Nenhuma AIH encontrada com os filtros aplicados');
      return [];
    }

    // 2) Referenciais (médicos e hospitais)
    // Normalizar CNS (trim) para evitar chaves diferentes por espaços/formatos
    const uniqueDoctorCns = Array.from(new Set((aihs as any[]).map(a => (a.cns_responsavel || 'NAO_IDENTIFICADO').toString().trim())));
    const uniqueHospitalIds = Array.from(new Set((aihs as any[]).map(a => a.hospital_id).filter(Boolean)));

    const [{ data: doctors, error: doctorsErr }, { data: hospitals, error: hospErr }] = await Promise.all([
      supabase.from('doctors').select('id, cns, name, crm, specialty').in('cns', uniqueDoctorCns),
      supabase.from('hospitals').select('id, name').in('id', uniqueHospitalIds)
    ]);
    if (doctorsErr) console.warn('[V2] Erro doctors:', doctorsErr);
    if (hospErr) console.warn('[V2] Erro hospitals:', hospErr);

    const doctorByCns = new Map<string, any>((doctors || []).map(d => [d.cns, d]));
    const hospitalById = new Map<string, any>((hospitals || []).map(h => [h.id, h]));

    // 3) Pré-carregar procedimentos por paciente e fallback por AIH (SEM filtro: garantir TODOS os procedimentos)
    const patientIds = Array.from(new Set((aihs as any[]).map(a => a.patient_id).filter(Boolean)));
    const aihIds = Array.from(new Set((aihs as any[]).map(a => a.id).filter(Boolean)));
    // Auditoria: carregar procedimentos SEM filtros de anestesista
    const [procsByPatientRes, procsByAihRes] = await Promise.all([
      ProcedureRecordsService.getProceduresByPatientIds(patientIds),
      ProcedureRecordsService.getProceduresByAihIds(aihIds)
    ]);
    const procsByPatient = procsByPatientRes.success ? procsByPatientRes.proceduresByPatientId : new Map<string, any[]>();
    const procsByAih = procsByAihRes.success ? procsByAihRes.proceduresByAihId : new Map<string, any[]>();

    // 4) Agrupar por (doctor_cns, hospital_id)
    const cards: (DoctorWithPatients & { key: string })[] = [];
    const cardIndex = new Map<string, number>();

    for (const aih of aihs as any[]) {
      const doctorCns = (aih.cns_responsavel || 'NAO_IDENTIFICADO').toString().trim();
      const hospitalId = aih.hospital_id || '';
      const key = `${doctorCns}::${hospitalId}`;

      let idx = cardIndex.get(key);
      if (idx == null) {
        const doc = doctorByCns.get(doctorCns);
        const hosp = hospitalById.get(hospitalId);
        const card: DoctorWithPatients & { key: string } = {
          key,
          doctor_info: {
            name: doc?.name || (doctorCns === 'NAO_IDENTIFICADO' ? 'Médico não identificado' : `Dr(a). ${doctorCns}`),
            cns: doctorCns,
            crm: doc?.crm || '',
            specialty: doc?.specialty || ''
          },
          hospitals: hospitalId ? [{ hospital_id: hospitalId, hospital_name: hosp?.name || '', is_active: true } as any] : [],
          patients: []
        };
        cards.push(card);
        idx = cards.length - 1;
        cardIndex.set(key, idx);
      }

      const card = cards[idx!];
      
      // 🔧 CORREÇÃO CRÍTICA: UMA ENTRADA POR AIH (não por paciente)
      // Cada AIH é uma internação/atendimento único, mesmo paciente pode ter múltiplas AIHs
      // Usar aih.id como chave única em vez de patient_id
      const pid = aih.patient_id;
      const aihId = aih.id; // ✅ Chave única: ID da AIH
      
      // ✅ SEMPRE criar nova entrada (uma por AIH)
      // Não verificar se paciente já existe, pois podem haver múltiplas AIHs do mesmo paciente
      const patient = {
        patient_id: pid,
        aih_id: aihId, // ✅ Incluir aih_id para rastreamento
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
          main_cid: aih.main_cid,
          specialty: aih.specialty,
          care_modality: aih.care_modality,
          requesting_physician: aih.requesting_physician,
          professional_cbo: aih.professional_cbo,
          care_character: aih.care_character, // manter valor original para auditoria
          hospital_id: aih.hospital_id,
          competencia: aih.competencia
        },
        total_value_reais: (aih.calculated_total_value || 0) / 100,
        procedures: [],
        total_procedures: 0,
        approved_procedures: 0
      };
      (card.patients as any[]).push(patient);

      // 🔧 FIX CRÍTICO: Buscar APENAS por aih_id (não por patient_id)
      // Cada AIH tem procedimentos únicos - não misturar com outras AIHs do mesmo paciente
      let procs: any[] = [];
      if (aih.id) {
        procs = procsByAih.get(aih.id) || [];
      }
      // ✅ SEM FALLBACK para patient_id! Evita mistura de procedimentos de AIHs diferentes
      if (Array.isArray(procs) && procs.length > 0) {
        const mapped: ProcedureDetail[] = procs.map((p: any) => {
          const code = p.procedure_code || '';
          const cbo = p.professional_cbo || '';
          const is04Procedure = typeof code === 'string' && code.startsWith('04');
          const isAnesthetist04 = cbo === '225151' && typeof code === 'string' && code.startsWith('04') && code !== '04.17.01.001-0';
          const storedParticipation = String(p.participacao || p.participation || '').trim();
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
            participation: isAnesthetist04 ? 'Anestesia (qtd)' : (is04Procedure ? storedParticipation : 'Responsável'),
          } as ProcedureDetail & { is_anesthetist_04?: boolean; quantity?: number };
        });
        const { getCalculableProcedures } = await import('../utils/anesthetistLogic');
        const calculableRaw = getCalculableProcedures(mapped as any);
        const calculableIdSet = new Set(
          (calculableRaw as any[]).map(p => String((p as any).procedure_id ?? '')).filter(Boolean)
        );

        const mappedAdjusted = (mapped as any[]).map(pp => {
          const id = String(pp.procedure_id ?? '');
          if (id && calculableIdSet.has(id)) return pp;
          if (pp.is_anesthetist_04 === true) return pp;
          const code = String(pp.procedure_code || '').trim();
          if (!code.startsWith('04')) return pp;
          return { ...pp, cbo: '225151', value_cents: 0, value_reais: 0, participation: 'Anestesia (qtd)', is_anesthetist_04: true };
        });

        patient.procedures = mappedAdjusted.sort((a: any, b: any) => new Date(b.procedure_date).getTime() - new Date(a.procedure_date).getTime());
        (patient as any).calculable_procedures = getCalculableProcedures(patient.procedures as any);
        patient.total_procedures = (patient as any).calculable_procedures.length;
        patient.approved_procedures = (patient as any).calculable_procedures.filter((pp: any) => pp.approved).length;
        // 🆕 Resolver Nome Comum (ex.: "A+A") baseado nos códigos e na especialidade do médico
        try {
          const codes = patient.procedures.map(pp => pp.procedure_code).filter(Boolean);
          const doctorSpecialty = (card.doctor_info?.specialty || '').trim() || undefined;
          (patient as any).common_name = resolveCommonProcedureName(codes, doctorSpecialty, patient.procedures);
        } catch {}
      } else {
        // Garantir arrays vazios se não houver procedimentos (evitar estado sujo na troca de abas)
        patient.procedures = [];
        patient.total_procedures = 0;
        patient.approved_procedures = 0;
      }
    }

    // ✅ OTIMIZADO: Filtros de data já aplicados no SQL - não é necessário filtrar novamente
    // Backend já retorna apenas AIHs que atendem aos critérios de data
    // (admission_date >= dateFromISO AND discharge_date <= dateToISO)
    
    const finalResult = cards.map(({ key, ...rest }) => rest);
    console.log(`🎯 [HIERARCHY V2] Resultado final: ${finalResult.length} médicos com ${finalResult.reduce((sum, d) => sum + d.patients.length, 0)} pacientes`);
    
    return finalResult;
  }
}



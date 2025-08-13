import { supabase } from '../lib/supabase';
import { ProcedureRecordsService } from './simplifiedProcedureService';
import type { DoctorWithPatients, ProcedureDetail } from './doctorPatientService';

export interface HierarchyFilters {
  hospitalIds?: string[];
  dateFromISO?: string;
  dateToISO?: string;
}

export class DoctorsHierarchyV2Service {
  static async getDoctorsHierarchyV2(filters: HierarchyFilters = {}): Promise<DoctorWithPatients[]> {
    // 1) AIHs com paciente
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
        patients (
          id,
          name,
          cns,
          birth_date,
          gender,
          medical_record
        )
      `);

    if (filters.hospitalIds && filters.hospitalIds.length > 0 && !filters.hospitalIds.includes('all')) {
      aihsQuery = aihsQuery.in('hospital_id', filters.hospitalIds);
    }
    if (filters.dateFromISO) {
      aihsQuery = aihsQuery.gte('admission_date', filters.dateFromISO);
    }
    if (filters.dateToISO) {
      // Incluir o último dia completo
      const end = new Date(filters.dateToISO);
      end.setHours(23, 59, 59, 999);
      aihsQuery = aihsQuery.lte('admission_date', end.toISOString());
    }

    // Auditoria: incluir TODOS os caracteres de atendimento (sem filtro)

    const { data: aihs, error: aihsError } = await aihsQuery.order('admission_date', { ascending: false });
    if (aihsError) {
      console.error('[V2] Erro AIHs:', aihsError);
      return [];
    }
    if (!aihs || aihs.length === 0) return [];

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

    // 3) Pré-carregar procedimentos por paciente e fallback por AIH
    const patientIds = Array.from(new Set((aihs as any[]).map(a => a.patient_id).filter(Boolean)));
    const aihIds = Array.from(new Set((aihs as any[]).map(a => a.id).filter(Boolean)));
    // Auditoria: carregar procedimentos SEM filtros de anestesista
    const [procsByPatientRes, procsByAihRes] = await Promise.all([
      ProcedureRecordsService.getProceduresByPatientIds(patientIds, { auditMode: true }),
      ProcedureRecordsService.getProceduresByAihIds(aihIds, { auditMode: true })
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
      // Paciente por patient_id
      const pid = aih.patient_id;
      let patient = (card.patients as any[]).find(p => p.patient_id === pid);
      if (!patient) {
        patient = {
          patient_id: pid,
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
            care_character: aih.care_character, // manter valor original para auditoria
            hospital_id: aih.hospital_id
          },
          total_value_reais: (aih.calculated_total_value || 0) / 100,
          procedures: [],
          total_procedures: 0,
          approved_procedures: 0
        };
        (card.patients as any[]).push(patient);
      }

      // Procedimentos por paciente, se vazio usar por AIH
      let procs = (pid && procsByPatient.get(pid)) || [];
      if (procs.length === 0 && aih.id) {
        procs = procsByAih.get(aih.id) || [];
      }
      if (Array.isArray(procs) && procs.length > 0) {
        const mapped: ProcedureDetail[] = procs.map((p: any) => {
          const code = p.procedure_code || '';
          const cbo = p.professional_cbo || '';
          const isAnesthetist04 = cbo === '225151' && typeof code === 'string' && code.startsWith('04') && code !== '04.17.01.001-0';
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
          } as ProcedureDetail & { is_anesthetist_04?: boolean; quantity?: number };
        });
        patient.procedures = mapped.sort((a: any, b: any) => new Date(b.procedure_date).getTime() - new Date(a.procedure_date).getTime());
        patient.total_procedures = patient.procedures.length;
        patient.approved_procedures = patient.procedures.filter(pp => pp.approved).length;
      } else {
        // Garantir arrays vazios se não houver procedimentos (evitar estado sujo na troca de abas)
        patient.procedures = [];
        patient.total_procedures = 0;
        patient.approved_procedures = 0;
      }
    }

    return cards.map(({ key, ...rest }) => rest);
  }
}



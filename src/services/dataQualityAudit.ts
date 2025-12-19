import { supabase } from '../lib/supabase';

export type AssociationIssueSummary = {
  mismatchedPatientLinks: number;
  nullPatientWithAih: number;
  outOfWindowProcedures: number;
  crossHospitalMismatch: number;
};

export async function auditAssociations(hospitalIds?: string[]): Promise<AssociationIssueSummary> {
  const hospitalFilter = hospitalIds && hospitalIds.length > 0 && !hospitalIds.includes('all') ? hospitalIds : undefined;

  const baseAihJoin = () => {
    let q = supabase
      .from('procedure_records')
      .select('aih_id, patient_id, hospital_id, procedure_date, aihs!inner(id, patient_id, hospital_id, admission_date, discharge_date)', { count: 'exact' })
      .limit(1); // placeholder, we will adjust below per query
    return q;
  };

  const countQuery = async (predicate: (row: any) => boolean): Promise<number> => {
    let q = supabase
      .from('procedure_records')
      .select('aih_id, patient_id, hospital_id, procedure_date, aihs!inner(id, patient_id, hospital_id, admission_date, discharge_date)');
    if (hospitalFilter) q = q.in('hospital_id', hospitalFilter);
    const { data } = await q;
    const rows = Array.isArray(data) ? data : [];
    return rows.filter(predicate).length;
  };

  const mismatchedPatientLinks = await countQuery((row: any) => {
    const a = (row as any).aihs;
    return a && a.patient_id && row.patient_id && a.patient_id !== row.patient_id;
  });

  const nullPatientWithAih = await countQuery((row: any) => {
    const a = (row as any).aihs;
    return a && a.patient_id && !row.patient_id;
  });

  const outOfWindowProcedures = await countQuery((row: any) => {
    const a = (row as any).aihs;
    if (!a || !row.procedure_date) return false;
    const d = new Date(String(row.procedure_date));
    const adm = a.admission_date ? new Date(String(a.admission_date)) : null;
    const dis = a.discharge_date ? new Date(String(a.discharge_date)) : null;
    if (adm && dis) return d < adm || d > dis;
    if (adm && !dis) return d < adm; // antes da admissão
    return false;
  });

  const crossHospitalMismatch = await countQuery((row: any) => {
    const a = (row as any).aihs;
    return a && a.hospital_id && row.hospital_id && a.hospital_id !== row.hospital_id;
  });

  return { mismatchedPatientLinks, nullPatientWithAih, outOfWindowProcedures, crossHospitalMismatch };
}


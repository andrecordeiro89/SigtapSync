import { supabase } from '../lib/supabase';

export async function hasAihsData(params?: { hospitalIds?: string[]; startDateISO?: string; endDateISO?: string }): Promise<boolean> {
  try {
    let q = supabase.from('aihs').select('id').limit(1);
    if (params?.hospitalIds && params.hospitalIds.length > 0 && !params.hospitalIds.includes('all')) {
      q = q.in('hospital_id', params.hospitalIds);
    }
    if (params?.startDateISO) q = q.gte('admission_date', params.startDateISO);
    if (params?.endDateISO) q = q.lte('admission_date', params.endDateISO);
    const { data, error } = await q;
    if (error) return false;
    return Array.isArray(data) && data.length > 0;
  } catch {
    return false;
  }
}

export async function hasProcedureRecordsData(params?: { hospitalIds?: string[]; startDateISO?: string; endDateISO?: string }): Promise<boolean> {
  try {
    let q = supabase.from('procedure_records').select('id').limit(1);
    if (params?.hospitalIds && params.hospitalIds.length > 0 && !params.hospitalIds.includes('all')) {
      q = q.in('hospital_id', params.hospitalIds);
    }
    if (params?.startDateISO) q = q.gte('procedure_date', params.startDateISO);
    if (params?.endDateISO) q = q.lte('procedure_date', params.endDateISO);
    const { data, error } = await q;
    if (error) return false;
    return Array.isArray(data) && data.length > 0;
  } catch {
    return false;
  }
}

export async function hasPatientsData(hospitalIds?: string[]): Promise<boolean> {
  try {
    let q = supabase.from('patients').select('id').limit(1);
    if (hospitalIds && hospitalIds.length > 0 && !hospitalIds.includes('all')) {
      q = q.in('hospital_id', hospitalIds);
    }
    const { data, error } = await q;
    if (error) return false;
    return Array.isArray(data) && data.length > 0;
  } catch {
    return false;
  }
}

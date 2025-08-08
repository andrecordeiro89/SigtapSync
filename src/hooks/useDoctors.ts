import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';

export interface Doctor {
  id: string;
  name: string;
  cns: string;
  specialty: string;
  crm?: string;
  crm_state?: string;
  hospital_id: string;
}

interface DoctorCache {
  [key: string]: Doctor | null; // key = cns:hospital_id
}

interface UseDoctorsReturn {
  getDoctorByCNS: (cns: string, hospitalId?: string) => Promise<Doctor | null>;
  getDoctorsByCNSList: (cnsList: string[], hospitalId?: string) => Promise<Doctor[]>;
  loading: boolean;
  error: string | null;
  clearCache: () => void;
}

// Cache global para evitar consultas repetidas
const doctorsCache: DoctorCache = {};

export function useDoctors(): UseDoctorsReturn {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { getCurrentHospital } = useAuth();

  /**
   * Busca um médico específico por CNS
   */
  const getDoctorByCNS = useCallback(async (
    cns: string, 
    hospitalId?: string
  ): Promise<Doctor | null> => {
    if (!cns || cns === 'N/A' || cns.trim() === '') {
      return null;
    }

    const currentHospitalId = hospitalId || getCurrentHospital();
    if (!currentHospitalId) {
      console.warn('🏥 Hospital não encontrado para busca de médico');
      return null;
    }

    // Verificar cache primeiro
    const cacheKey = `${cns}:${currentHospitalId}`;
    if (doctorsCache[cacheKey] !== undefined) {
      console.log(`📋 Cache hit para médico CNS: ${cns}`);
      return doctorsCache[cacheKey];
    }

    setLoading(true);
    setError(null);

    try {
      console.log(`🔍 Buscando médico CNS: ${cns} no hospital: ${currentHospitalId}`);

      // Busca com JOIN entre doctors e doctor_hospital
      const { data, error: queryError } = await supabase
        .from('doctors')
        .select(`
          id,
          name,
          cns,
          specialty,
          crm,
          crm_state,
          doctor_hospital!inner (
            hospital_id
          )
        `)
        .eq('cns', cns)
        .eq('doctor_hospital.hospital_id', currentHospitalId)
        .eq('is_active', true)
        .single();

      if (queryError) {
        if (queryError.code === 'PGRST116') {
          // Não encontrado - não é erro
          console.log(`📋 Médico CNS ${cns} não encontrado no hospital`);
          doctorsCache[cacheKey] = null;
          return null;
        }
        throw queryError;
      }

      const doctor: Doctor = {
        id: data.id,
        name: data.name,
        cns: data.cns,
        specialty: data.specialty,
        crm: data.crm,
        crm_state: data.crm_state,
        hospital_id: currentHospitalId
      };

      // Salvar no cache
      doctorsCache[cacheKey] = doctor;
      console.log(`✅ Médico encontrado: ${doctor.name} (${doctor.cns})`);
      
      return doctor;

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Erro ao buscar médico';
      console.error('❌ Erro ao buscar médico por CNS:', err);
      setError(errorMessage);
      
      // Cache do erro para evitar consultas repetidas
      doctorsCache[cacheKey] = null;
      return null;
    } finally {
      setLoading(false);
    }
  }, [getCurrentHospital]);

  /**
   * Busca múltiplos médicos por lista de CNS
   */
  const getDoctorsByCNSList = useCallback(async (
    cnsList: string[], 
    hospitalId?: string
  ): Promise<Doctor[]> => {
    const validCNSList = cnsList.filter(cns => cns && cns !== 'N/A' && cns.trim() !== '');
    
    if (validCNSList.length === 0) {
      return [];
    }

    console.log(`🔍 Buscando ${validCNSList.length} médicos por CNS...`);

    // Buscar todos em paralelo
    const doctors = await Promise.all(
      validCNSList.map(cns => getDoctorByCNS(cns, hospitalId))
    );

    // Filtrar nulls
    return doctors.filter((doctor): doctor is Doctor => doctor !== null);
  }, [getDoctorByCNS]);

  /**
   * Limpa o cache (útil para desenvolvimento)
   */
  const clearCache = useCallback(() => {
    Object.keys(doctorsCache).forEach(key => delete doctorsCache[key]);
    console.log('🧹 Cache de médicos limpo');
  }, []);

  return {
    getDoctorByCNS,
    getDoctorsByCNSList,
    loading,
    error,
    clearCache
  };
}

/**
 * Hook específico para buscar um médico individual
 */
export function useDoctor(cns: string, hospitalId?: string) {
  const [doctor, setDoctor] = useState<Doctor | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { getDoctorByCNS } = useDoctors();

  useEffect(() => {
    if (!cns || cns === 'N/A' || cns.trim() === '') {
      setDoctor(null);
      return;
    }

    setLoading(true);
    getDoctorByCNS(cns, hospitalId)
      .then(setDoctor)
      .catch(err => {
        console.error('Erro no useDoctor:', err);
        setError(err.message);
        setDoctor(null);
      })
      .finally(() => setLoading(false));
  }, [cns, hospitalId, getDoctorByCNS]);

  return { doctor, loading, error };
} 
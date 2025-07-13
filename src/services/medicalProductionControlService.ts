/**
 * ================================================================
 * SERVIÇO DE CONTROLE DE PRODUÇÃO MÉDICA - VERSÃO 3.0
 * ================================================================
 * Agora usando a view vw_doctor_patient_procedures criada pelo usuário
 * que integra todas as informações necessárias em uma única consulta
 * ================================================================
 */

import { supabase } from '../lib/supabase';

// ================================================================
// INTERFACES ATUALIZADAS PARA A NOVA VIEW
// ================================================================

interface ViewDoctorPatientProcedures {
  doctor_name: string;
  doctor_cns: string;
  doctor_crm: string;
  doctor_crm_state: string;
  doctor_specialty: string;
  patient_name: string;
  patient_cns: string;
  patient_birth_date: string;
  patient_gender: string;
  procedure_code: string;
  procedure_name: string;
  procedure_date: string;
  value_charged: number;
  quantity: number;
  unit_value: number;
  total_value: number;
  hospital_name: string;
  hospital_cnpj: string;
}

interface SimplifiedProductionData {
  id: string;
  procedure_date: string;
  professional: string;
  value_charged: number;
  billing_status: string;
  patient_name: string;
  patient_cns: string;
  procedure_name: string;
  procedure_code: string;
  hospital_name: string;
}

interface ProductivitySummary {
  totalProcedures: number;
  totalValue: number;
  approvedProcedures: number;
  pendingProcedures: number;
  averageValue: number;
}

interface PatientData {
  patient_name: string;
  patient_cns: string;
  procedures: Array<{
    id: string;
    procedure_code: string;
    procedure_name: string;
    procedure_date: string;
    value_charged: number;
    billing_status: string;
    hospital_name: string;
  }>;
}

interface DoctorBasicInfo {
  name: string;
  cns: string;
  crm: string;
  specialty: string;
}

// ================================================================
// FUNÇÃO PRINCIPAL: BUSCAR PACIENTES E PROCEDIMENTOS DO MÉDICO
// ================================================================
export async function getDoctorPatientsAndProcedures(doctorIdentifier: string) {
  console.log('🔍 Buscando dados do médico na nova view:', doctorIdentifier);
  
  try {
    // 🆕 USAR A NOVA VIEW vw_doctor_patient_procedures
    const { data: viewData, error: viewError } = await supabase
      .from('vw_doctor_patient_procedures')
      .select('*')
      .ilike('doctor_name', `%${doctorIdentifier}%`);

    if (viewError) {
      console.error('❌ Erro ao consultar view:', viewError);
      return { success: false, data: [], error: viewError.message };
    }

    if (!viewData || viewData.length === 0) {
      console.log('⚠️ Nenhum dado encontrado na view para este médico');
      return { success: true, data: [], error: 'Nenhum procedimento encontrado' };
    }

    console.log('✅ Dados encontrados na view:', viewData.length, 'registros');

    // 📋 PROCESSAR e AGRUPAR dados por paciente
    const patientsMap = new Map<string, PatientData>();

    viewData.forEach((record: ViewDoctorPatientProcedures) => {
      const patientKey = record.patient_cns;
      
      if (!patientsMap.has(patientKey)) {
        patientsMap.set(patientKey, {
          patient_name: record.patient_name,
          patient_cns: record.patient_cns,
          procedures: []
        });
      }

      const patient = patientsMap.get(patientKey)!;
      patient.procedures.push({
        id: `${record.procedure_code}_${record.procedure_date}`,
        procedure_code: record.procedure_code,
        procedure_name: record.procedure_name,
        procedure_date: record.procedure_date,
        value_charged: record.value_charged,
        billing_status: 'approved', // Assumindo aprovado por estar na view
        hospital_name: record.hospital_name
      });
    });

    const patientsArray = Array.from(patientsMap.values());
    
    console.log('👥 Pacientes processados:', patientsArray.length);
    console.log('📊 Total de procedimentos:', viewData.length);

    return {
      success: true,
      data: patientsArray,
      totalProcedures: viewData.length,
      totalPatients: patientsArray.length
    };

  } catch (error) {
    console.error('❌ Erro na busca de dados:', error);
    return {
      success: false,
      data: [],
      error: error instanceof Error ? error.message : 'Erro desconhecido'
    };
  }
}

// ================================================================
// FUNÇÃO: BUSCAR RESUMO DE PRODUTIVIDADE DO MÉDICO
// ================================================================
export async function getDoctorProductivitySummary(
  doctorIdentifier: string, 
  period: 'week' | 'month' | 'quarter' = 'month'
): Promise<{ success: boolean; data?: ProductivitySummary; error?: string }> {
  console.log('📈 Calculando resumo de produtividade na view:', doctorIdentifier);
  
  try {
    // 📅 CALCULAR período baseado na opção
    const now = new Date();
    let startDate: Date;
    
    switch (period) {
      case 'week':
        startDate = new Date(now.setDate(now.getDate() - 7));
        break;
      case 'quarter':
        startDate = new Date(now.setMonth(now.getMonth() - 3));
        break;
      default: // month
        startDate = new Date(now.setMonth(now.getMonth() - 1));
    }

    const { data: viewData, error } = await supabase
      .from('vw_doctor_patient_procedures')
      .select('value_charged, total_value, procedure_date')
      .ilike('doctor_name', `%${doctorIdentifier}%`)
      .gte('procedure_date', startDate.toISOString().split('T')[0]);

    if (error) {
      console.error('❌ Erro ao calcular resumo:', error);
      return { success: false, error: error.message };
    }

    if (!viewData || viewData.length === 0) {
      return {
        success: true,
        data: {
          totalProcedures: 0,
          totalValue: 0,
          approvedProcedures: 0,
          pendingProcedures: 0,
          averageValue: 0
        }
      };
    }

    // 📊 CALCULAR métricas
    const totalProcedures = viewData.length;
    const totalValue = viewData.reduce((sum, item) => sum + (item.total_value || item.value_charged || 0), 0);
    const averageValue = totalValue / totalProcedures;

    const summary: ProductivitySummary = {
      totalProcedures,
      totalValue,
      approvedProcedures: totalProcedures, // Todos aprovados se estão na view
      pendingProcedures: 0,
      averageValue
    };

    console.log('✅ Resumo calculado:', summary);
    return { success: true, data: summary };

  } catch (error) {
    console.error('❌ Erro no cálculo do resumo:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Erro no cálculo'
    };
  }
}

// ================================================================
// FUNÇÃO: BUSCAR INFORMAÇÕES BÁSICAS DO MÉDICO
// ================================================================
export async function getDoctorBasicInfo(doctorIdentifier: string): Promise<{
  success: boolean;
  data?: DoctorBasicInfo;
  error?: string;
}> {
  console.log('👨‍⚕️ Buscando info básica do médico na view:', doctorIdentifier);
  
  try {
    const { data: viewData, error } = await supabase
      .from('vw_doctor_patient_procedures')
      .select('doctor_name, doctor_cns, doctor_crm, doctor_specialty')
      .ilike('doctor_name', `%${doctorIdentifier}%`)
      .limit(1);

    if (error) {
      console.error('❌ Erro ao buscar info básica:', error);
      return { success: false, error: error.message };
    }

    if (!viewData || viewData.length === 0) {
      console.log('⚠️ Médico não encontrado na view');
      return { success: false, error: 'Médico não encontrado' };
    }

    const doctorData = viewData[0];
    const basicInfo: DoctorBasicInfo = {
      name: doctorData.doctor_name,
      cns: doctorData.doctor_cns,
      crm: doctorData.doctor_crm,
      specialty: doctorData.doctor_specialty
    };

    console.log('✅ Info básica encontrada:', basicInfo);
    return { success: true, data: basicInfo };

  } catch (error) {
    console.error('❌ Erro na busca de info básica:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Erro desconhecido'
    };
  }
}

// ================================================================
// FUNÇÃO: BUSCAR TODOS OS MÉDICOS DISPONÍVEIS
// ================================================================
export async function getAllAvailableDoctors(): Promise<{
  success: boolean;
  data?: Array<{ name: string; cns: string; crm: string; specialty: string; }>;
  error?: string;
}> {
  console.log('👨‍⚕️ Buscando todos os médicos na view...');
  
  try {
    const { data: viewData, error } = await supabase
      .from('vw_doctor_patient_procedures')
      .select('doctor_name, doctor_cns, doctor_crm, doctor_specialty')
      .order('doctor_name');

    if (error) {
      console.error('❌ Erro ao buscar médicos:', error);
      return { success: false, error: error.message };
    }

    // 📋 REMOVER duplicatas baseado no CNS do médico
    const uniqueDoctors = new Map();
    viewData?.forEach(doc => {
      if (!uniqueDoctors.has(doc.doctor_cns)) {
        uniqueDoctors.set(doc.doctor_cns, {
          name: doc.doctor_name,
          cns: doc.doctor_cns,
          crm: doc.doctor_crm,
          specialty: doc.doctor_specialty
        });
      }
    });

    const doctorsArray = Array.from(uniqueDoctors.values());
    
    console.log('✅ Médicos únicos encontrados:', doctorsArray.length);
    return { success: true, data: doctorsArray };

  } catch (error) {
    console.error('❌ Erro na busca de médicos:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Erro desconhecido'
    };
  }
}

// ================================================================
// FUNÇÃO: ESTATÍSTICAS GERAIS DA VIEW (PARA DEBUG)
// ================================================================
export async function getViewStatistics(): Promise<{
  success: boolean;
  data?: {
    totalRecords: number;
    uniqueDoctors: number;
    uniquePatients: number;
    uniqueHospitals: number;
    dateRange: { earliest: string; latest: string };
    totalValue: number;
  };
  error?: string;
}> {
  console.log('📊 Calculando estatísticas da view...');
  
  try {
    const { data: viewData, error } = await supabase
      .from('vw_doctor_patient_procedures')
      .select('*');

    if (error) {
      console.error('❌ Erro ao buscar estatísticas:', error);
      return { success: false, error: error.message };
    }

    if (!viewData || viewData.length === 0) {
      return {
        success: true,
        data: {
          totalRecords: 0,
          uniqueDoctors: 0,
          uniquePatients: 0,
          uniqueHospitals: 0,
          dateRange: { earliest: '', latest: '' },
          totalValue: 0
        }
      };
    }

    // 📈 CALCULAR estatísticas
    const uniqueDoctors = new Set(viewData.map(r => r.doctor_cns)).size;
    const uniquePatients = new Set(viewData.map(r => r.patient_cns)).size;
    const uniqueHospitals = new Set(viewData.map(r => r.hospital_cnpj)).size;
    
    const dates = viewData.map(r => r.procedure_date).sort();
    const earliest = dates[0];
    const latest = dates[dates.length - 1];
    
    const totalValue = viewData.reduce((sum, r) => sum + (r.total_value || 0), 0);

    const stats = {
      totalRecords: viewData.length,
      uniqueDoctors,
      uniquePatients,
      uniqueHospitals,
      dateRange: { earliest, latest },
      totalValue
    };

    console.log('✅ Estatísticas calculadas:', stats);
    return { success: true, data: stats };

  } catch (error) {
    console.error('❌ Erro no cálculo de estatísticas:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Erro no cálculo'
    };
  }
} 
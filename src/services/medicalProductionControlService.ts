/**
 * ================================================================
 * SERVIÇO DE CONTROLE DE PRODUÇÃO MÉDICA
 * ================================================================
 * Utiliza a view doctor_production para obter dados consolidados
 * de produção médica por paciente e procedimento
 * ================================================================
 */

import { supabase } from '../lib/supabase';

// ================================================================
// TIPOS E INTERFACES
// ================================================================

export interface DoctorProductionRecord {
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
}

export interface DoctorPatientProcedure {
  // Médico
  doctor_name: string;
  doctor_cns: string;
  doctor_crm: string;
  doctor_crm_state: string;
  doctor_specialty: string;
  
  // Paciente
  patient_name: string;
  patient_cns: string;
  patient_birth_date: string;
  patient_gender: string;
  
  // Relacionamento
  total_procedures_together: number;
  unique_procedures_performed: number;
  total_quantity: number;
  
  // Período
  first_procedure_date: string;
  last_procedure_date: string;
  relationship_days: number;
  
  // Financeiro
  total_value_charged: number;
  total_value_total: number;
  avg_procedure_value: number;
  
  // Status
  relationship_status: 'ATIVO' | 'MODERADO' | 'INATIVO';
  last_activity_date: string;
  days_since_last_activity: number;
  
  // Lista de procedimentos
  procedures_list: string;
  procedure_codes: string[];
  
  // ✅ NOVO: Procedimentos detalhados para dropdown
  procedures_detailed: Array<{
    procedure_code: string;
    procedure_name: string;
    procedure_date: string;
    value_charged: number;
    value_total: number;
    quantity: number;
    unit_value: number;
  }>;
}

export interface DoctorProductivitySummary {
  doctor_name: string;
  doctor_cns: string;
  doctor_crm: string;
  doctor_crm_state: string;
  doctor_specialty: string;
  
  // Contadores do período
  unique_patients: number;
  total_procedures: number;
  total_quantity: number;
  total_revenue: number;
  
  // Métricas de produtividade
  avg_procedures_per_patient: number;
  avg_value_per_procedure: number;
  avg_quantity_per_procedure: number;
  
  // Top pacientes (mais atendidos)
  top_patients: Array<{
    patient_name: string;
    patient_cns: string;
    procedures_count: number;
    total_value: number;
  }>;
  
  // Top procedimentos (mais realizados)
  top_procedures: Array<{
    procedure_code: string;
    procedure_name: string;
    count: number;
    total_quantity: number;
    total_value: number;
  }>;
}

// ================================================================
// CLASSE DO SERVIÇO
// ================================================================

export class MedicalProductionControlService {
  
  /**
   * 📊 BUSCAR PACIENTES E PROCEDIMENTOS DE UM MÉDICO
   * Utiliza a view doctor_production com filtragem específica por CNS
   */
  static async getDoctorPatientsAndProcedures(
    doctorIdentifier: string, // Preferencialmente CNS, depois CRM ou nome
    options: {
      limit?: number;
      status?: 'ATIVO' | 'MODERADO' | 'INATIVO' | 'ALL';
      minProcedures?: number;
      dateFrom?: string;
      dateTo?: string;
    } = {}
  ): Promise<{
    success: boolean;
    data: DoctorPatientProcedure[];
    error?: string;
  }> {
    try {
      console.log('🔍 Buscando pacientes e procedimentos do médico:', doctorIdentifier);
      
      // Construir query na view doctor_production
      let query = supabase.from('doctor_production').select('*');
      
      // ✅ CORREÇÃO: Filtrar de forma mais específica priorizando CNS
      // Primeiro tenta por CNS (mais específico)
      if (doctorIdentifier && doctorIdentifier.length === 15 && /^\d+$/.test(doctorIdentifier)) {
        // Se tem 15 dígitos numéricos, provavelmente é CNS
        console.log('🔍 Filtrando por CNS:', doctorIdentifier);
        query = query.eq('doctor_cns', doctorIdentifier);
      } else if (doctorIdentifier && /^[A-Z]{2}-\d+$/.test(doctorIdentifier)) {
        // Se tem formato de CRM (ex: SP-123456)
        console.log('🔍 Filtrando por CRM:', doctorIdentifier);
        query = query.eq('doctor_crm', doctorIdentifier);
      } else if (doctorIdentifier && doctorIdentifier.includes('-') && doctorIdentifier.length < 15) {
        // Se tem hífen mas não é CNS, provavelmente é CRM sem estado
        console.log('🔍 Filtrando por CRM (formato alternativo):', doctorIdentifier);
        query = query.eq('doctor_crm', doctorIdentifier);
      } else {
        // Último caso: buscar por nome (mais restritivo)
        console.log('🔍 Filtrando por nome:', doctorIdentifier);
        query = query.eq('doctor_name', doctorIdentifier);
      }
      
      // Aplicar filtros de data
      if (options.dateFrom) {
        query = query.gte('procedure_date', options.dateFrom);
      }
      
      if (options.dateTo) {
        query = query.lte('procedure_date', options.dateTo);
      }
      
      // Ordenar por data
      query = query.order('procedure_date', { ascending: false });
      
      // Buscar dados
      const { data: productionData, error } = await query;
      
      if (error) {
        console.error('❌ Erro ao buscar dados da view:', error);
        return {
          success: false,
          data: [],
          error: `Erro ao buscar dados: ${error.message}`
        };
      }
      
      if (!productionData || productionData.length === 0) {
        console.log('⚠️ Nenhum dado encontrado para o médico');
        return {
          success: true,
          data: [],
          error: 'Nenhum dado encontrado para este médico'
        };
      }
      
      // ✅ VALIDAÇÃO: Garantir que todos os registros são do mesmo médico
      const firstRecord = productionData[0];
      const doctorCns = firstRecord.doctor_cns;
      const doctorCrm = firstRecord.doctor_crm;
      
      // Filtrar apenas registros do mesmo médico (segurança extra)
      const filteredData = productionData.filter(record => 
        record.doctor_cns === doctorCns && record.doctor_crm === doctorCrm
      );
      
      console.log(`✅ Dados validados: ${filteredData.length} registros para médico CNS: ${doctorCns}, CRM: ${doctorCrm}`);
      
      // ================================================================
      // 🔧 CORREÇÃO: AGRUPAR POR PACIENTE (CNS PRIORITÁRIO)
      // ================================================================
      // REGRA: 1 AIH = 1 Paciente (conforme especificação do usuário)
      // ================================================================
      
      const patientMap = new Map<string, {
        // Médico
        doctor_name: string;
        doctor_cns: string;
        doctor_crm: string;
        doctor_crm_state: string;
        doctor_specialty: string;
        
        // Paciente
        patient_name: string;
        patient_cns: string;
        patient_birth_date: string;
        patient_gender: string;
        
        // Contadores
        total_procedures_together: number;
        unique_procedures_performed: Set<string>;
        total_quantity: number;
        
        // Datas
        first_procedure_date: string;
        last_procedure_date: string;
        
        // Valores
        total_value_charged: number;
        total_value_total: number;
        
        // Procedimentos
        procedures_list: Set<string>;
        procedure_codes: Set<string>;
        
        // ✅ NOVO: Procedimentos detalhados
        procedures_detailed: Array<{
          procedure_code: string;
          procedure_name: string;
          procedure_date: string;
          value_charged: number;
          value_total: number;
          quantity: number;
          unit_value: number;
        }>;
      }>();
      
      // 🔍 ESTRATÉGIA DE AGRUPAMENTO MAIS RIGOROSA
      // Priorizar CNS do paciente, mas ser mais específico na chave
      filteredData.forEach(record => {
        let patientKey: string;
        
        // ✅ PRIORIDADE 1: CNS do paciente (mais confiável)
        if (record.patient_cns && record.patient_cns.trim() && record.patient_cns !== 'null') {
          patientKey = `CNS:${record.patient_cns.trim()}`;
        }
        // ✅ PRIORIDADE 2: Nome + Data de nascimento (menos provável de duplicar)
        else if (record.patient_name && record.patient_birth_date) {
          patientKey = `NAME_BIRTH:${record.patient_name.trim()}_${record.patient_birth_date}`;
        }
        // ✅ PRIORIDADE 3: Apenas nome (último recurso)
        else if (record.patient_name) {
          patientKey = `NAME:${record.patient_name.trim()}`;
        }
        // ❌ FALLBACK: Se não tem identificação adequada, pular registro
        else {
          console.warn('⚠️ Registro sem identificação adequada do paciente:', record);
          return;
        }
        
        if (!patientMap.has(patientKey)) {
          patientMap.set(patientKey, {
            // Médico
            doctor_name: record.doctor_name || 'Não informado',
            doctor_cns: record.doctor_cns || '',
            doctor_crm: record.doctor_crm || '',
            doctor_crm_state: record.doctor_crm_state || '',
            doctor_specialty: record.doctor_specialty || '',
            
            // Paciente
            patient_name: record.patient_name || 'Não informado',
            patient_cns: record.patient_cns || '',
            patient_birth_date: record.patient_birth_date || '',
            patient_gender: record.patient_gender || '',
            
            // Contadores
            total_procedures_together: 0,
            unique_procedures_performed: new Set(),
            total_quantity: 0,
            
            // Datas
            first_procedure_date: record.procedure_date || '',
            last_procedure_date: record.procedure_date || '',
            
            // Valores
            total_value_charged: 0,
            total_value_total: 0,
            
            // Procedimentos
            procedures_list: new Set(),
            procedure_codes: new Set(),
            
            // ✅ NOVO: Procedimentos detalhados
            procedures_detailed: []
          });
        }
        
        const patient = patientMap.get(patientKey)!;
        
        // Atualizar contadores
        patient.total_procedures_together++;
        patient.total_quantity += record.quantity || 0;
        
        if (record.procedure_code) {
          patient.unique_procedures_performed.add(record.procedure_code);
          patient.procedure_codes.add(record.procedure_code);
        }
        
        if (record.procedure_name) {
          patient.procedures_list.add(record.procedure_name);
        }
        
        // ✅ NOVO: Adicionar procedimento detalhado
        patient.procedures_detailed.push({
          procedure_code: record.procedure_code || '',
          procedure_name: record.procedure_name || '',
          procedure_date: record.procedure_date || '',
          value_charged: record.value_charged || 0,
          value_total: record.total_value || 0,
          quantity: record.quantity || 0,
          unit_value: record.unit_value || 0
        });
        
        // Valores
        patient.total_value_charged += record.value_charged || 0;
        patient.total_value_total += record.total_value || 0;
        
        // Datas
        if (record.procedure_date) {
          if (!patient.first_procedure_date || record.procedure_date < patient.first_procedure_date) {
            patient.first_procedure_date = record.procedure_date;
          }
          if (!patient.last_procedure_date || record.procedure_date > patient.last_procedure_date) {
            patient.last_procedure_date = record.procedure_date;
          }
        }
      });
      
      // ================================================================
      // 📊 VALIDAÇÃO E LOGS DE DEBUG
      // ================================================================
      
      console.log(`📋 RESUMO DO AGRUPAMENTO:`);
      console.log(`   • Total de registros processados: ${filteredData.length}`);
      console.log(`   • Total de pacientes únicos agrupados: ${patientMap.size}`);
      
      // Mostrar detalhes dos pacientes agrupados
      patientMap.forEach((patient, key) => {
        console.log(`   • ${key}: ${patient.patient_name} (${patient.total_procedures_together} procedimentos)`);
      });
      
      // ✅ VALIDAÇÃO ADICIONAL: Verificar se há possível duplicação por nome
      const patientNames = Array.from(patientMap.values()).map(p => p.patient_name);
      const uniqueNames = new Set(patientNames);
      
      if (patientNames.length !== uniqueNames.size) {
        console.warn('⚠️ POSSÍVEL DUPLICAÇÃO DETECTADA:');
        const nameCounts = new Map<string, number>();
        patientNames.forEach(name => {
          nameCounts.set(name, (nameCounts.get(name) || 0) + 1);
        });
        
        nameCounts.forEach((count, name) => {
          if (count > 1) {
            console.warn(`   • "${name}" aparece ${count} vezes (pode ser duplicação)`);
          }
        });
      } else {
        console.log(`✅ Validação OK: Todos os ${patientMap.size} pacientes são únicos`);
      }
      
      // Converter para array final
      const processedData: DoctorPatientProcedure[] = Array.from(patientMap.values()).map(patient => {
        const daysDiff = patient.first_procedure_date && patient.last_procedure_date
          ? Math.ceil((new Date(patient.last_procedure_date).getTime() - new Date(patient.first_procedure_date).getTime()) / (1000 * 60 * 60 * 24))
          : 0;
        
        const daysFromLastActivity = patient.last_procedure_date
          ? Math.ceil((new Date().getTime() - new Date(patient.last_procedure_date).getTime()) / (1000 * 60 * 60 * 24))
          : 999;
        
        // Determinar status do relacionamento
        let relationshipStatus: 'ATIVO' | 'MODERADO' | 'INATIVO' = 'INATIVO';
        if (daysFromLastActivity <= 30) {
          relationshipStatus = 'ATIVO';
        } else if (daysFromLastActivity <= 90) {
          relationshipStatus = 'MODERADO';
        }
        
        return {
          // Médico
          doctor_name: patient.doctor_name,
          doctor_cns: patient.doctor_cns,
          doctor_crm: patient.doctor_crm,
          doctor_crm_state: patient.doctor_crm_state,
          doctor_specialty: patient.doctor_specialty,
          
          // Paciente
          patient_name: patient.patient_name,
          patient_cns: patient.patient_cns,
          patient_birth_date: patient.patient_birth_date,
          patient_gender: patient.patient_gender,
          
          // Relacionamento
          total_procedures_together: patient.total_procedures_together,
          unique_procedures_performed: patient.unique_procedures_performed.size,
          total_quantity: patient.total_quantity,
          
          // Período
          first_procedure_date: patient.first_procedure_date,
          last_procedure_date: patient.last_procedure_date,
          relationship_days: daysDiff,
          
          // Financeiro
          total_value_charged: patient.total_value_charged,
          total_value_total: patient.total_value_total,
          avg_procedure_value: patient.total_procedures_together > 0 
            ? patient.total_value_total / patient.total_procedures_together 
            : 0,
          
          // Status
          relationship_status: relationshipStatus,
          last_activity_date: patient.last_procedure_date,
          days_since_last_activity: daysFromLastActivity,
          
          // Lista de procedimentos
          procedures_list: Array.from(patient.procedures_list).join(', '),
          procedure_codes: Array.from(patient.procedure_codes),
          
          // ✅ NOVO: Procedimentos detalhados
          procedures_detailed: patient.procedures_detailed
        };
      });
      
      // Aplicar filtros
      let filteredResult = processedData;
      
      if (options.status && options.status !== 'ALL') {
        filteredResult = filteredResult.filter(item => item.relationship_status === options.status);
      }
      
      if (options.minProcedures) {
        filteredResult = filteredResult.filter(item => item.total_procedures_together >= options.minProcedures);
      }
      
      // Ordenar por número de procedimentos
      filteredResult.sort((a, b) => b.total_procedures_together - a.total_procedures_together);
      
      // Aplicar limite
      if (options.limit) {
        filteredResult = filteredResult.slice(0, options.limit);
      }
      
      // ================================================================
      // ✅ RESUMO FINAL DE VALIDAÇÃO
      // ================================================================
      
      console.log(`📋 RESUMO FINAL MÉDICO CNS: ${doctorCns}`);
      console.log(`   • Nome: ${firstRecord.doctor_name}`);
      console.log(`   • Total de registros brutos da view: ${filteredData.length}`);
      console.log(`   • Total de pacientes únicos processados: ${processedData.length}`);
      console.log(`   • Total de pacientes após filtros: ${filteredResult.length}`);
      
      // Validação da regra 1 AIH = 1 Paciente
      const totalProcedures = processedData.reduce((sum, p) => sum + p.total_procedures_together, 0);
      console.log(`   • Total de procedimentos agrupados: ${totalProcedures}`);
      
      if (totalProcedures === filteredData.length) {
        console.log(`   ✅ Integridade OK: ${totalProcedures} = ${filteredData.length}`);
      } else {
        console.warn(`   ⚠️ Possível problema: ${totalProcedures} ≠ ${filteredData.length}`);
      }
      
      console.log(`✅ RESULTADO: ${filteredResult.length} pacientes únicos retornados`);
      
      return {
        success: true,
        data: filteredResult
      };
      
    } catch (error) {
      console.error('❌ Erro no serviço:', error);
      return {
        success: false,
        data: [],
        error: `Erro interno: ${error instanceof Error ? error.message : 'Erro desconhecido'}`
      };
    }
  }

  /**
   * 📋 BUSCAR REGISTROS DETALHADOS DE PRODUÇÃO
   * Utiliza a view doctor_production diretamente com filtragem específica por CNS
   */
  static async getDoctorProductionRecords(
    doctorIdentifier: string,
    options: {
      patientCns?: string;
      dateFrom?: string;
      dateTo?: string;
      procedureCode?: string;
      limit?: number;
    } = {}
  ): Promise<{
    success: boolean;
    data: DoctorProductionRecord[];
    error?: string;
  }> {
    try {
      console.log('🔍 Buscando registros de produção:', doctorIdentifier);
      
      // Construir query
      let query = supabase.from('doctor_production').select('*');
      
      // ✅ CORREÇÃO: Filtrar de forma mais específica priorizando CNS
      if (doctorIdentifier && doctorIdentifier.length === 15 && /^\d+$/.test(doctorIdentifier)) {
        // Se tem 15 dígitos numéricos, provavelmente é CNS
        console.log('🔍 Filtrando por CNS:', doctorIdentifier);
        query = query.eq('doctor_cns', doctorIdentifier);
      } else if (doctorIdentifier && /^[A-Z]{2}-\d+$/.test(doctorIdentifier)) {
        // Se tem formato de CRM (ex: SP-123456)
        console.log('🔍 Filtrando por CRM:', doctorIdentifier);
        query = query.eq('doctor_crm', doctorIdentifier);
      } else if (doctorIdentifier && doctorIdentifier.includes('-') && doctorIdentifier.length < 15) {
        // Se tem hífen mas não é CNS, provavelmente é CRM sem estado
        console.log('🔍 Filtrando por CRM (formato alternativo):', doctorIdentifier);
        query = query.eq('doctor_crm', doctorIdentifier);
      } else {
        // Último caso: buscar por nome (mais restritivo)
        console.log('🔍 Filtrando por nome:', doctorIdentifier);
        query = query.eq('doctor_name', doctorIdentifier);
      }
      
      // Aplicar filtros
      if (options.patientCns) {
        query = query.eq('patient_cns', options.patientCns);
      }
      
      if (options.dateFrom) {
        query = query.gte('procedure_date', options.dateFrom);
      }
      
      if (options.dateTo) {
        query = query.lte('procedure_date', options.dateTo);
      }
      
      if (options.procedureCode) {
        query = query.eq('procedure_code', options.procedureCode);
      }
      
      // Ordenação e limite
      query = query
        .order('procedure_date', { ascending: false })
        .limit(options.limit || 100);
      
      const { data, error } = await query;
      
      if (error) {
        console.error('❌ Erro ao buscar registros:', error);
        return {
          success: false,
          data: [],
          error: `Erro ao buscar registros: ${error.message}`
        };
      }
      
      console.log(`✅ Encontrados ${data?.length || 0} registros`);
      
      return {
        success: true,
        data: data || []
      };
      
    } catch (error) {
      console.error('❌ Erro no serviço:', error);
      return {
        success: false,
        data: [],
        error: `Erro interno: ${error instanceof Error ? error.message : 'Erro desconhecido'}`
      };
    }
  }

  /**
   * 📈 RESUMO DE PRODUTIVIDADE DO MÉDICO
   * Baseado na view doctor_production com filtragem específica por CNS
   */
  static async getDoctorProductivitySummary(
    doctorIdentifier: string,
    period: 'week' | 'month' | '3months' = 'month'
  ): Promise<{
    success: boolean;
    data: DoctorProductivitySummary | null;
    error?: string;
  }> {
    try {
      console.log('📈 Buscando resumo de produtividade:', doctorIdentifier, period);
      
      // Calcular datas
      const now = new Date();
      const daysBack = period === 'week' ? 7 : period === 'month' ? 30 : 90;
      const dateFrom = new Date(now.getTime() - (daysBack * 24 * 60 * 60 * 1000))
        .toISOString().split('T')[0];
      
      // Buscar dados da view
      let query = supabase.from('doctor_production').select('*');
      
      // ✅ CORREÇÃO: Filtrar de forma mais específica priorizando CNS
      if (doctorIdentifier && doctorIdentifier.length === 15 && /^\d+$/.test(doctorIdentifier)) {
        // Se tem 15 dígitos numéricos, provavelmente é CNS
        console.log('🔍 Filtrando por CNS:', doctorIdentifier);
        query = query.eq('doctor_cns', doctorIdentifier);
      } else if (doctorIdentifier && /^[A-Z]{2}-\d+$/.test(doctorIdentifier)) {
        // Se tem formato de CRM (ex: SP-123456)
        console.log('🔍 Filtrando por CRM:', doctorIdentifier);
        query = query.eq('doctor_crm', doctorIdentifier);
      } else if (doctorIdentifier && doctorIdentifier.includes('-') && doctorIdentifier.length < 15) {
        // Se tem hífen mas não é CNS, provavelmente é CRM sem estado
        console.log('🔍 Filtrando por CRM (formato alternativo):', doctorIdentifier);
        query = query.eq('doctor_crm', doctorIdentifier);
      } else {
        // Último caso: buscar por nome (mais restritivo)
        console.log('🔍 Filtrando por nome:', doctorIdentifier);
        query = query.eq('doctor_name', doctorIdentifier);
      }
      
      // Aplicar filtro de período
      query = query.gte('procedure_date', dateFrom);
      
      const { data: productionData, error } = await query;
      
      if (error) {
        console.error('❌ Erro ao buscar dados:', error);
        return {
          success: false,
          data: null,
          error: `Erro ao buscar dados: ${error.message}`
        };
      }
      
      if (!productionData || productionData.length === 0) {
        return {
          success: true,
          data: null,
          error: 'Nenhum dado encontrado para o período'
        };
      }
      
      // Pegar dados do primeiro registro (info do médico)
      const firstRecord = productionData[0];
      
      // Calcular métricas
      const uniquePatients = new Set(productionData.map(r => r.patient_cns)).size;
      const totalProcedures = productionData.length;
      const totalQuantity = productionData.reduce((sum, r) => sum + (r.quantity || 0), 0);
      const totalRevenue = productionData.reduce((sum, r) => sum + (r.total_value || 0), 0);
      
      // Top pacientes
      const topPatients = this.getTopPatients(productionData);
      
      // Top procedimentos
      const topProcedures = this.getTopProcedures(productionData);
      
      const summary: DoctorProductivitySummary = {
        doctor_name: firstRecord.doctor_name || 'Não informado',
        doctor_cns: firstRecord.doctor_cns || '',
        doctor_crm: firstRecord.doctor_crm || '',
        doctor_crm_state: firstRecord.doctor_crm_state || '',
        doctor_specialty: firstRecord.doctor_specialty || '',
        
        // Contadores
        unique_patients: uniquePatients,
        total_procedures: totalProcedures,
        total_quantity: totalQuantity,
        total_revenue: totalRevenue,
        
        // Métricas
        avg_procedures_per_patient: uniquePatients > 0 ? totalProcedures / uniquePatients : 0,
        avg_value_per_procedure: totalProcedures > 0 ? totalRevenue / totalProcedures : 0,
        avg_quantity_per_procedure: totalProcedures > 0 ? totalQuantity / totalProcedures : 0,
        
        // Tops
        top_patients: topPatients,
        top_procedures: topProcedures
      };
      
      console.log('✅ Resumo de produtividade calculado');
      
      return {
        success: true,
        data: summary
      };
      
    } catch (error) {
      console.error('❌ Erro no serviço:', error);
      return {
        success: false,
        data: null,
        error: `Erro interno: ${error instanceof Error ? error.message : 'Erro desconhecido'}`
      };
    }
  }

  // ================================================================
  // MÉTODOS AUXILIARES
  // ================================================================

  /**
   * 🔍 BUSCAR CNS DO MÉDICO POR CRM OU NOME
   * Helper para encontrar o CNS quando só temos CRM ou nome
   */
  static async getDoctorCnsByIdentifier(identifier: string): Promise<string | null> {
    try {
      console.log('🔍 Buscando CNS do médico:', identifier);
      
      // Se já é CNS, retorna ele mesmo
      if (identifier && identifier.length === 15 && /^\d+$/.test(identifier)) {
        return identifier;
      }
      
      // Buscar na view por CRM ou nome para encontrar o CNS
      let query = supabase.from('doctor_production').select('doctor_cns, doctor_crm, doctor_name').limit(1);
      
      if (identifier && /^[A-Z]{2}-\d+$/.test(identifier)) {
        // CRM formato padrão
        query = query.eq('doctor_crm', identifier);
      } else if (identifier && identifier.includes('-') && identifier.length < 15) {
        // CRM formato alternativo
        query = query.eq('doctor_crm', identifier);
      } else {
        // Nome
        query = query.eq('doctor_name', identifier);
      }
      
      const { data, error } = await query;
      
      if (error || !data || data.length === 0) {
        console.warn('⚠️ CNS não encontrado para:', identifier);
        return null;
      }
      
      const cns = data[0].doctor_cns;
      console.log(`✅ CNS encontrado: ${cns} para ${identifier}`);
      return cns;
      
    } catch (error) {
      console.error('❌ Erro ao buscar CNS:', error);
      return null;
    }
  }

  /**
   * 📊 VERSÃO APRIMORADA - Buscar pacientes garantindo uso de CNS
   */
  static async getDoctorPatientsAndProceduresWithCns(
    doctorIdentifier: string,
    options: {
      limit?: number;
      status?: 'ATIVO' | 'MODERADO' | 'INATIVO' | 'ALL';
      minProcedures?: number;
      dateFrom?: string;
      dateTo?: string;
    } = {}
  ): Promise<{
    success: boolean;
    data: DoctorPatientProcedure[];
    error?: string;
  }> {
    try {
      // Primeiro, garantir que temos o CNS
      const doctorCns = await this.getDoctorCnsByIdentifier(doctorIdentifier);
      
      if (!doctorCns) {
        return {
          success: false,
          data: [],
          error: 'CNS do médico não encontrado'
        };
      }
      
      // Usar o CNS específico para buscar os dados
      return await this.getDoctorPatientsAndProcedures(doctorCns, options);
      
    } catch (error) {
      console.error('❌ Erro no serviço aprimorado:', error);
      return {
        success: false,
        data: [],
        error: `Erro interno: ${error instanceof Error ? error.message : 'Erro desconhecido'}`
      };
    }
  }

  private static getTopPatients(data: DoctorProductionRecord[]) {
    const patientMap = new Map<string, {
      patient_name: string;
      patient_cns: string;
      procedures_count: number;
      total_value: number;
    }>();
    
    data.forEach(record => {
      const key = record.patient_cns || record.patient_name;
      if (!patientMap.has(key)) {
        patientMap.set(key, {
          patient_name: record.patient_name,
          patient_cns: record.patient_cns,
          procedures_count: 0,
          total_value: 0
        });
      }
      
      const patient = patientMap.get(key)!;
      patient.procedures_count++;
      patient.total_value += record.total_value || 0;
    });
    
    return Array.from(patientMap.values())
      .sort((a, b) => b.procedures_count - a.procedures_count)
      .slice(0, 5);
  }

  private static getTopProcedures(data: DoctorProductionRecord[]) {
    const procedureMap = new Map<string, {
      procedure_code: string;
      procedure_name: string;
      count: number;
      total_quantity: number;
      total_value: number;
    }>();
    
    data.forEach(record => {
      const key = record.procedure_code;
      if (!procedureMap.has(key)) {
        procedureMap.set(key, {
          procedure_code: record.procedure_code,
          procedure_name: record.procedure_name,
          count: 0,
          total_quantity: 0,
          total_value: 0
        });
      }
      
      const procedure = procedureMap.get(key)!;
      procedure.count++;
      procedure.total_quantity += record.quantity || 0;
      procedure.total_value += record.total_value || 0;
    });
    
    return Array.from(procedureMap.values())
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);
  }

  // ================================================================
  // UTILITÁRIOS
  // ================================================================

  static formatCurrency(value: number): string {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(value);
  }

  static formatDate(dateString: string): string {
    return new Date(dateString).toLocaleDateString('pt-BR');
  }

  static formatDateTime(dateString: string): string {
    return new Date(dateString).toLocaleString('pt-BR');
  }

  static calculateAge(birthDate: string): number {
    const today = new Date();
    const birth = new Date(birthDate);
    let age = today.getFullYear() - birth.getFullYear();
    const monthDiff = today.getMonth() - birth.getMonth();
    
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
      age--;
    }
    
    return age;
  }
} 
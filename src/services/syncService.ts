/**
 * 🔄 SYNC SERVICE - Reconciliação de dados Tabwin (GSUS) vs Sistema
 * 
 * Funcionalidade: Comparar relatórios XLSX do Tabwin com dados do sistema
 * Colunas Tabwin: SP_NAIH, SP_DTINTER, SP_DTSAIDA, SP_ATOPROF, SP_QTD_ATO, SP_VALATO, SP_PF_DOC
 * Referências: SP_NAIH (Nº AIH) e SP_ATOPROF (Código Procedimento)
 */

import * as XLSX from 'xlsx';
import { supabase } from '../lib/supabase';

// Interface para dados do Tabwin (GSUS)
export interface TabwinRecord {
  sp_naih: string;           // Número da AIH
  sp_dtinter: string;        // Data de Internação
  sp_dtsaida: string;        // Data de Saída
  sp_atoprof: string;        // Código do Procedimento
  sp_qtd_ato: number;        // Quantidade do Ato
  sp_valato: number;         // Valor do Ato
  sp_pf_doc?: string;        // Documento do Profissional
}

// Interface para dados do Sistema
// ✅ MESMA ESTRUTURA DO RELATÓRIO PACIENTES GERAL (Analytics)
export interface SystemRecord {
  aih_id: string;
  aih_number: string;
  admission_date: string;
  discharge_date: string;
  procedure_code: string;
  procedure_name: string;
  procedure_date: string;
  quantity: number;
  total_value: number;       // Em centavos
  professional_document?: string;
  patient_name: string;
  hospital_id: string;
  doctor_name?: string;      // ✅ NOVO: Nome do médico responsável
  hospital_name?: string;    // ✅ NOVO: Nome do hospital
}

// Interface para resultado da reconciliação
export interface ReconciliationMatch {
  aih_number: string;
  procedure_code: string;
  tabwin_data: TabwinRecord;
  system_data: SystemRecord;
  status: 'matched' | 'value_diff' | 'quantity_diff';
  value_difference?: number;
  quantity_difference?: number;
}

export interface ReconciliationLeftover {
  aih_number: string;
  procedure_code: string;
  source: 'tabwin' | 'system';
  data: TabwinRecord | SystemRecord;
  reason: 'not_in_system' | 'not_in_tabwin' | 'aih_mismatch' | 'procedure_mismatch';
}

export interface ReconciliationResult {
  success: boolean;
  total_tabwin_records: number;
  total_system_records: number;
  matches: ReconciliationMatch[];
  tabwin_leftovers: ReconciliationLeftover[];  // Sobras no arquivo Tabwin
  system_leftovers: ReconciliationLeftover[];  // Sobras no sistema
  summary: {
    perfect_matches: number;
    value_differences: number;
    quantity_differences: number;
    glosas_possiveis: number;      // Possíveis glosas (no Tabwin mas não no sistema)
    rejeicoes_possiveis: number;   // Possíveis rejeições (no sistema mas não no Tabwin)
  };
  processing_time: number;
  error?: string;
}

export class SyncService {
  
  /**
   * Processa arquivo XLSX do Tabwin
   */
  static async processTabwinFile(file: File): Promise<{ success: boolean; records: TabwinRecord[]; error?: string }> {
    try {
      const arrayBuffer = await file.arrayBuffer();
      const workbook = XLSX.read(arrayBuffer, { 
        type: 'array',
        cellDates: false,
        cellNF: false,
        cellText: false
      });

      // Pegar a primeira aba
      const sheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[sheetName];
      
      // Converter para JSON
      const rawData = XLSX.utils.sheet_to_json(worksheet, { header: 1, raw: false }) as any[][];
      
      // Encontrar linha de cabeçalho (buscar por SP_NAIH)
      let headerRowIndex = -1;
      for (let i = 0; i < Math.min(20, rawData.length); i++) {
        const row = rawData[i];
        if (row.some((cell: any) => String(cell).toUpperCase().includes('SP_NAIH'))) {
          headerRowIndex = i;
          break;
        }
      }

      if (headerRowIndex === -1) {
        return {
          success: false,
          records: [],
          error: 'Cabeçalho não encontrado. O arquivo deve conter as colunas: SP_NAIH, SP_ATOPROF, SP_VALATO'
        };
      }

      // Mapear colunas
      const headers = rawData[headerRowIndex].map((h: any) => String(h).toUpperCase().trim());
      const sp_naih_idx = headers.findIndex((h: string) => h.includes('SP_NAIH') || h.includes('NAIH'));
      const sp_dtinter_idx = headers.findIndex((h: string) => h.includes('SP_DTINTER') || h.includes('DTINTER'));
      const sp_dtsaida_idx = headers.findIndex((h: string) => h.includes('SP_DTSAIDA') || h.includes('DTSAIDA'));
      const sp_atoprof_idx = headers.findIndex((h: string) => h.includes('SP_ATOPROF') || h.includes('ATOPROF'));
      const sp_qtd_ato_idx = headers.findIndex((h: string) => h.includes('SP_QTD_ATO') || h.includes('QTD_ATO') || h.includes('QUANTIDADE'));
      const sp_valato_idx = headers.findIndex((h: string) => h.includes('SP_VALATO') || h.includes('VALATO') || h.includes('VALOR'));
      const sp_pf_doc_idx = headers.findIndex((h: string) => h.includes('SP_PF_DOC') || h.includes('PF_DOC') || h.includes('DOC_PROF'));

      if (sp_naih_idx === -1 || sp_atoprof_idx === -1) {
        return {
          success: false,
          records: [],
          error: 'Colunas obrigatórias não encontradas: SP_NAIH e SP_ATOPROF são necessárias'
        };
      }

      // Extrair registros
      const records: TabwinRecord[] = [];
      for (let i = headerRowIndex + 1; i < rawData.length; i++) {
        const row = rawData[i];
        if (!row || row.length === 0) continue;

        const aih = String(row[sp_naih_idx] || '').trim();
        const proc = String(row[sp_atoprof_idx] || '').trim();
        
        if (!aih || !proc) continue;

        // Normalizar código de procedimento (remover pontos e traços)
        const normalizedProc = proc.replace(/[.\-\s]/g, '');

        records.push({
          sp_naih: aih,
          sp_dtinter: sp_dtinter_idx >= 0 ? String(row[sp_dtinter_idx] || '') : '',
          sp_dtsaida: sp_dtsaida_idx >= 0 ? String(row[sp_dtsaida_idx] || '') : '',
          sp_atoprof: normalizedProc,
          sp_qtd_ato: sp_qtd_ato_idx >= 0 ? Number(row[sp_qtd_ato_idx]) || 1 : 1,
          sp_valato: sp_valato_idx >= 0 ? Number(row[sp_valato_idx]) || 0 : 0,
          sp_pf_doc: sp_pf_doc_idx >= 0 ? String(row[sp_pf_doc_idx] || '') : ''
        });
      }

      console.log(`✅ ${records.length} registros extraídos do Tabwin`);
      return { success: true, records };

    } catch (error) {
      console.error('❌ Erro ao processar arquivo Tabwin:', error);
      return {
        success: false,
        records: [],
        error: error instanceof Error ? error.message : 'Erro desconhecido ao processar arquivo'
      };
    }
  }

  /**
   * Busca dados do sistema para reconciliação
   * ✅ USA A MESMA FONTE DO "RELATÓRIO PACIENTES GERAL" (Analytics)
   */
  static async getSystemRecords(hospitalId: string, competencia: string): Promise<{ success: boolean; records: SystemRecord[]; error?: string }> {
    try {
      console.log(`🔍 Buscando dados do sistema - Hospital: ${hospitalId}, Competência: ${competencia}`);

      // ✅ USAR O MESMO SERVIÇO DO RELATÓRIO PACIENTES GERAL
      const { DoctorPatientService } = await import('./doctorPatientService');
      
      const doctorsWithPatients = await DoctorPatientService.getDoctorsWithPatientsFromProceduresView({
        hospitalIds: [hospitalId],
        competencia: competencia
      });

      if (!doctorsWithPatients || doctorsWithPatients.length === 0) {
        console.log('⚠️ Nenhum dado encontrado para o hospital e competência selecionados');
        return { success: true, records: [] };
      }

      console.log(`✅ ${doctorsWithPatients.length} médicos carregados`);

      // Montar registros do sistema seguindo a MESMA ESTRUTURA do Relatório Pacientes Geral
      const records: SystemRecord[] = [];
      
      for (const doctor of doctorsWithPatients) {
        const doctorName = doctor.doctor_info?.name || '';
        const hospitalName = doctor.hospitals?.[0]?.hospital_name || '';

        for (const patient of doctor.patients || []) {
          const patientName = patient.patient_info?.name || 'Paciente';
          const aihNumber = (patient.aih_info?.aih_number || '').toString().replace(/\D/g, '');
          const dischargeDate = patient.aih_info?.discharge_date || '';
          const admissionDate = patient.aih_info?.admission_date || '';

          // Iterar sobre todos os procedimentos do paciente (mesma lógica do relatório)
          const procedures = patient.procedures || [];
          
          if (procedures.length > 0) {
            for (const proc of procedures) {
              // Normalizar código de procedimento (remover pontos e traços)
              const procCodeRaw = proc.procedure_code || '';
              const normalizedCode = procCodeRaw.replace(/[.\-\s]/g, '');
              
              const procDesc = proc.procedure_description || proc.sigtap_description || '';
              const procDate = proc.procedure_date || '';
              const procValue = Number(proc.value_reais || 0);

              records.push({
                aih_id: proc.aih_id || '',
                aih_number: aihNumber,
                admission_date: admissionDate,
                discharge_date: dischargeDate,
                procedure_code: normalizedCode,
                procedure_name: procDesc,
                procedure_date: procDate,
                quantity: 1, // No sistema atual não temos quantidade por procedimento nesta view
                total_value: Math.round(procValue * 100), // Converter de reais para centavos
                professional_document: '',
                patient_name: patientName,
                hospital_id: hospitalId,
                doctor_name: doctorName,     // ✅ Nome do médico
                hospital_name: hospitalName  // ✅ Nome do hospital
              });
            }
          }
        }
      }

      console.log(`✅ ${records.length} registros (procedimentos) extraídos do sistema`);
      return { success: true, records };

    } catch (error) {
      console.error('❌ Erro ao buscar dados do sistema:', error);
      return {
        success: false,
        records: [],
        error: error instanceof Error ? error.message : 'Erro desconhecido'
      };
    }
  }

  /**
   * Realiza a reconciliação entre Tabwin e Sistema
   */
  static async reconcile(
    tabwinRecords: TabwinRecord[],
    systemRecords: SystemRecord[]
  ): Promise<ReconciliationResult> {
    const startTime = performance.now();

    try {
      const matches: ReconciliationMatch[] = [];
      const tabwinLeftovers: ReconciliationLeftover[] = [];
      const systemLeftovers: ReconciliationLeftover[] = [];

      // Criar mapa de registros do sistema para busca rápida
      const systemMap = new Map<string, SystemRecord[]>();
      for (const sysRec of systemRecords) {
        const key = `${sysRec.aih_number}_${sysRec.procedure_code}`;
        if (!systemMap.has(key)) {
          systemMap.set(key, []);
        }
        systemMap.get(key)!.push(sysRec);
      }

      // Processar registros do Tabwin
      const processedSystemKeys = new Set<string>();

      for (const tabwinRec of tabwinRecords) {
        const key = `${tabwinRec.sp_naih}_${tabwinRec.sp_atoprof}`;
        const systemMatches = systemMap.get(key);

        if (!systemMatches || systemMatches.length === 0) {
          // Não encontrado no sistema - possível glosa ou rejeição
          tabwinLeftovers.push({
            aih_number: tabwinRec.sp_naih,
            procedure_code: tabwinRec.sp_atoprof,
            source: 'tabwin',
            data: tabwinRec,
            reason: 'not_in_system'
          });
          continue;
        }

        // Match encontrado
        const systemRec = systemMatches[0];
        processedSystemKeys.add(key);

        // Converter valor do Tabwin para centavos (assumindo que vem em reais)
        const tabwinValueCents = Math.round(tabwinRec.sp_valato * 100);
        const systemValueCents = systemRec.total_value;

        const valueDiff = Math.abs(tabwinValueCents - systemValueCents);
        const quantityDiff = Math.abs(tabwinRec.sp_qtd_ato - systemRec.quantity);

        let status: 'matched' | 'value_diff' | 'quantity_diff' = 'matched';
        if (valueDiff > 50) { // Tolerância de R$ 0,50
          status = 'value_diff';
        } else if (quantityDiff > 0) {
          status = 'quantity_diff';
        }

        matches.push({
          aih_number: tabwinRec.sp_naih,
          procedure_code: tabwinRec.sp_atoprof,
          tabwin_data: tabwinRec,
          system_data: systemRec,
          status,
          value_difference: valueDiff > 0 ? valueDiff : undefined,
          quantity_difference: quantityDiff > 0 ? quantityDiff : undefined
        });
      }

      // Identificar sobras no sistema (não encontradas no Tabwin)
      for (const [key, systemRecs] of systemMap.entries()) {
        if (!processedSystemKeys.has(key)) {
          for (const systemRec of systemRecs) {
            systemLeftovers.push({
              aih_number: systemRec.aih_number,
              procedure_code: systemRec.procedure_code,
              source: 'system',
              data: systemRec,
              reason: 'not_in_tabwin'
            });
          }
        }
      }

      // Calcular estatísticas
      const summary = {
        perfect_matches: matches.filter(m => m.status === 'matched').length,
        value_differences: matches.filter(m => m.status === 'value_diff').length,
        quantity_differences: matches.filter(m => m.status === 'quantity_diff').length,
        glosas_possiveis: tabwinLeftovers.length,
        rejeicoes_possiveis: systemLeftovers.length
      };

      const processingTime = performance.now() - startTime;

      console.log('📊 Reconciliação concluída:', {
        matches: matches.length,
        tabwinLeftovers: tabwinLeftovers.length,
        systemLeftovers: systemLeftovers.length,
        summary
      });

      return {
        success: true,
        total_tabwin_records: tabwinRecords.length,
        total_system_records: systemRecords.length,
        matches,
        tabwin_leftovers: tabwinLeftovers,
        system_leftovers: systemLeftovers,
        summary,
        processing_time: processingTime
      };

    } catch (error) {
      console.error('❌ Erro na reconciliação:', error);
      return {
        success: false,
        total_tabwin_records: tabwinRecords.length,
        total_system_records: systemRecords.length,
        matches: [],
        tabwin_leftovers: [],
        system_leftovers: [],
        summary: {
          perfect_matches: 0,
          value_differences: 0,
          quantity_differences: 0,
          glosas_possiveis: 0,
          rejeicoes_possiveis: 0
        },
        processing_time: performance.now() - startTime,
        error: error instanceof Error ? error.message : 'Erro desconhecido'
      };
    }
  }

  /**
   * Executa o processo completo de reconciliação
   */
  static async performReconciliation(
    file: File,
    hospitalId: string,
    competencia: string
  ): Promise<ReconciliationResult> {
    console.log('🔄 Iniciando reconciliação completa...');

    // 1. Processar arquivo Tabwin
    const tabwinResult = await this.processTabwinFile(file);
    if (!tabwinResult.success) {
      return {
        success: false,
        total_tabwin_records: 0,
        total_system_records: 0,
        matches: [],
        tabwin_leftovers: [],
        system_leftovers: [],
        summary: {
          perfect_matches: 0,
          value_differences: 0,
          quantity_differences: 0,
          glosas_possiveis: 0,
          rejeicoes_possiveis: 0
        },
        processing_time: 0,
        error: tabwinResult.error
      };
    }

    // 2. Buscar dados do sistema
    const systemResult = await this.getSystemRecords(hospitalId, competencia);
    if (!systemResult.success) {
      return {
        success: false,
        total_tabwin_records: tabwinResult.records.length,
        total_system_records: 0,
        matches: [],
        tabwin_leftovers: [],
        system_leftovers: [],
        summary: {
          perfect_matches: 0,
          value_differences: 0,
          quantity_differences: 0,
          glosas_possiveis: 0,
          rejeicoes_possiveis: 0
        },
        processing_time: 0,
        error: systemResult.error
      };
    }

    // 3. Realizar reconciliação
    return await this.reconcile(tabwinResult.records, systemResult.records);
  }
}


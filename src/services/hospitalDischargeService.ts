import * as XLSX from 'xlsx';
import { supabase } from '../lib/supabase';

// ================================================================
// TIPOS E INTERFACES
// ================================================================

export interface HospitalDischarge {
  id?: string;
  hospital_id: string;
  leito: string | null;
  paciente: string;
  id_prontuario: string | null;  // Identificador principal do paciente
  data_entrada: string; // ISO format
  data_saida: string; // ISO format
  competencia?: string; // Competência (YYYY-MM-DD) - calculada automaticamente
  duracao: string | null;
  responsavel: string | null;
  usuario_finalizacao: string | null;
  status: string;
  justificativa_observacao: string | null;
  source_file?: string;
  import_batch_id?: string;
  created_at?: string;
  updated_at?: string;
}

export interface DischargeImportResult {
  success: boolean;
  totalRecords: number;
  importedRecords: number;
  errors: string[];
  discharges: HospitalDischarge[];
  batchId: string;
}

// ================================================================
// SERVIÇO DE ALTAS HOSPITALARES
// ================================================================

export class HospitalDischargeService {
  /**
   * 📄 PROCESSAR ARQUIVO EXCEL
   * Extrai dados de altas do arquivo Excel seguindo o formato padrão
   */
  static async processExcelFile(
    file: File,
    hospitalId: string,
    userId: string
  ): Promise<DischargeImportResult> {
    const batchId = crypto.randomUUID();
    const errors: string[] = [];
    const discharges: HospitalDischarge[] = [];

    try {
      console.log('📄 Processando arquivo Excel:', file.name);

      // 1. LER ARQUIVO EXCEL
      const buffer = await file.arrayBuffer();
      const workbook = XLSX.read(buffer, { type: 'array' });
      const sheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[sheetName];

      // 2. CONVERTER PARA JSON (COM CABEÇALHO)
      const rawData: any[] = XLSX.utils.sheet_to_json(worksheet, {
        header: 1, // Retorna arrays de arrays
        raw: false, // Manter strings originais
        defval: null // Células vazias = null
      });

      console.log(`📊 Total de linhas no arquivo: ${rawData.length}`);

      // 3. VALIDAR ESTRUTURA
      if (rawData.length < 4) {
        throw new Error('Arquivo inválido: deve ter pelo menos 4 linhas (cabeçalho na linha 4)');
      }

      // 4. EXTRAIR CABEÇALHO (LINHA 4 = ÍNDICE 3)
      const headerRow = rawData[3];
      console.log('📋 Cabeçalho encontrado:', headerRow);

      // Validar colunas esperadas (CNS/CPF será ignorada se existir)
      const expectedColumns = [
        'LEITO',
        'PACIENTE',
        'ID PRONTUÁRIO',
        'DATA ENTRADA',
        'DATA SAÍDA',
        'DURAÇÃO',
        'RESPONSÁVEL',
        'USUÁRIO FINALIZAÇÃO',
        'STATUS',
        'JUSTIFICATIVA/OBSERVAÇÃO'
      ];

      // 🔍 DEBUG: Verificar se CNS/CPF existe no Excel
      const cnsCpfIndex = headerRow.findIndex((h: string) =>
        h?.toString().toUpperCase().includes('CNS') || h?.toString().toUpperCase().includes('CPF')
      );
      if (cnsCpfIndex !== -1) {
        console.log(`ℹ️ Coluna CNS/CPF detectada na posição ${cnsCpfIndex + 1} - será ignorada automaticamente`);
      }

      // 5. MAPEAR ÍNDICES DE COLUNAS
      const columnIndexes: { [key: string]: number } = {};
      expectedColumns.forEach((col) => {
        const index = headerRow.findIndex((h: string) =>
          h?.toString().toUpperCase().includes(col.toUpperCase().split(' ')[0])
        );
        if (index !== -1) {
          columnIndexes[col] = index;
        }
      });

      console.log('🗂️ Índices de colunas:', columnIndexes);

      // 6. PROCESSAR LINHAS DE DADOS (A PARTIR DA LINHA 5 = ÍNDICE 4)
      for (let i = 4; i < rawData.length; i++) {
        const row = rawData[i];

        // Pular linhas vazias
        if (!row || row.length === 0 || !row[columnIndexes['PACIENTE']]) {
          continue;
        }

        try {
          const discharge: HospitalDischarge = {
            hospital_id: hospitalId,
            leito: this.cleanValue(row[columnIndexes['LEITO']]),
            paciente: this.cleanValue(row[columnIndexes['PACIENTE']]) || 'Nome não informado',
            id_prontuario: this.cleanValue(row[columnIndexes['ID PRONTUÁRIO']]),  // Identificador principal
            data_entrada: this.parseDateTime(row[columnIndexes['DATA ENTRADA']]),
            data_saida: this.parseDateTime(row[columnIndexes['DATA SAÍDA']]),
            duracao: this.cleanValue(row[columnIndexes['DURAÇÃO']]),
            responsavel: this.cleanValue(row[columnIndexes['RESPONSÁVEL']]),
            usuario_finalizacao: this.cleanValue(row[columnIndexes['USUÁRIO FINALIZAÇÃO']]),
            status: this.cleanValue(row[columnIndexes['STATUS']]) || 'Alta',
            justificativa_observacao: this.cleanValue(row[columnIndexes['JUSTIFICATIVA/OBSERVAÇÃO']]),
            source_file: file.name,
            import_batch_id: batchId
          };

          discharges.push(discharge);
        } catch (rowError) {
          const errorMsg = `Linha ${i + 1}: ${rowError instanceof Error ? rowError.message : 'Erro desconhecido'}`;
          errors.push(errorMsg);
          console.warn('⚠️', errorMsg);
        }
      }

      console.log(`✅ ${discharges.length} registros extraídos com sucesso`);

      // 🔍 MOSTRAR AMOSTRA DOS PRIMEIROS 3 REGISTROS PARA VALIDAÇÃO
      console.log('📋 === AMOSTRA DE DADOS EXTRAÍDOS (3 primeiros registros) ===');
      discharges.slice(0, 3).forEach((discharge, index) => {
        console.log(`\n🔹 Registro #${index + 1}:`);
        console.log(`   Leito: "${discharge.leito}"`);
        console.log(`   Paciente: "${discharge.paciente}"`);
        console.log(`   🆔 ID Prontuário: "${discharge.id_prontuario}" (length: ${discharge.id_prontuario?.length || 0})`);
        console.log(`   Data Entrada: "${discharge.data_entrada}"`);
        console.log(`   Data Saída: "${discharge.data_saida}"`);
        console.log(`   Duração: "${discharge.duracao}"`);
        console.log(`   Responsável: "${discharge.responsavel}"`);
        console.log(`   Usuário Finalização: "${discharge.usuario_finalizacao}"`);
        console.log(`   Status: "${discharge.status}"`);
        console.log(`   Justificativa: "${discharge.justificativa_observacao}"`);
      });

      // 🔍 VALIDAR TAMANHOS DE CAMPOS
      const problematicRecords = discharges.filter((d, idx) => {
        const issues = [];
        if (d.id_prontuario && d.id_prontuario.length > 100) issues.push(`ID Prontuário muito longo (${d.id_prontuario.length} chars)`);
        if (d.paciente && d.paciente.length > 255) issues.push(`Nome muito longo (${d.paciente.length} chars)`);
        if (d.responsavel && d.responsavel.length > 255) issues.push(`Responsável muito longo (${d.responsavel.length} chars)`);
        
        if (issues.length > 0) {
          console.warn(`⚠️ Linha ${idx + 5} tem problemas:`, issues);
          console.warn(`   ID Prontuário: "${d.id_prontuario}" (${d.id_prontuario?.length || 0} chars)`);
          console.warn(`   Paciente: "${d.paciente}" (${d.paciente?.length || 0} chars)`);
          return true;
        }
        return false;
      });

      if (problematicRecords.length > 0) {
        console.error(`❌ ${problematicRecords.length} registros com campos muito longos foram encontrados!`);
        console.error('Primeiros 5 registros problemáticos:', problematicRecords.slice(0, 5));
      }

      // 7. SALVAR NO BANCO DE DADOS
      if (discharges.length > 0) {
        const { data, error: insertError } = await supabase
          .from('hospital_discharges')
          .insert(
            discharges.map((d) => ({
              ...d,
              created_by: userId
            }))
          )
          .select();

        if (insertError) {
          throw new Error(`Erro ao salvar no banco: ${insertError.message}`);
        }

        console.log(`💾 ${data?.length || 0} registros salvos no banco`);

        return {
          success: true,
          totalRecords: discharges.length,
          importedRecords: data?.length || 0,
          errors,
          discharges: data || [],
          batchId
        };
      }

      return {
        success: false,
        totalRecords: 0,
        importedRecords: 0,
        errors: ['Nenhum registro válido encontrado no arquivo'],
        discharges: [],
        batchId
      };
    } catch (error) {
      console.error('❌ Erro ao processar arquivo:', error);
      return {
        success: false,
        totalRecords: 0,
        importedRecords: 0,
        errors: [error instanceof Error ? error.message : 'Erro desconhecido'],
        discharges: [],
        batchId
      };
    }
  }

  /**
   * 📅 PARSEAR DATA/HORA PARA ISO
   * Converte "15/10/2025 05:59" para "2025-10-15T05:59:00"
   */
  private static parseDateTime(value: any): string {
    if (!value) {
      return new Date().toISOString();
    }

    const str = String(value).trim();

    // Tentar formato DD/MM/YYYY HH:MM
    const match = str.match(/(\d{2})\/(\d{2})\/(\d{4})\s+(\d{2}):(\d{2})/);
    if (match) {
      const [, day, month, year, hour, minute] = match;
      return `${year}-${month}-${day}T${hour}:${minute}:00`;
    }

    // Tentar formato YYYY-MM-DD HH:MM
    const match2 = str.match(/(\d{4})-(\d{2})-(\d{2})\s+(\d{2}):(\d{2})/);
    if (match2) {
      const [, year, month, day, hour, minute] = match2;
      return `${year}-${month}-${day}T${hour}:${minute}:00`;
    }

    // Fallback: tentar Date.parse
    try {
      const date = new Date(str);
      if (!isNaN(date.getTime())) {
        return date.toISOString();
      }
    } catch {
      // Ignorar
    }

    // Última tentativa: data atual
    console.warn('⚠️ Data inválida, usando data atual:', str);
    return new Date().toISOString();
  }

  /**
   * 🧹 LIMPAR VALOR
   * Remove espaços extras e converte "-" em null
   */
  private static cleanValue(value: any): string | null {
    if (!value) return null;
    const str = String(value).trim();
    if (str === '' || str === '-') return null;
    return str;
  }

  /**
   * 📊 BUSCAR ALTAS POR HOSPITAL
   */
  static async getDischargesByHospital(
    hospitalId: string,
    options: {
      limit?: number;
      offset?: number;
      startDate?: string;
      endDate?: string;
    } = {}
  ): Promise<{ data: HospitalDischarge[]; count: number }> {
    try {
      let query = supabase
        .from('hospital_discharges')
        .select('*', { count: 'exact' })
        .eq('hospital_id', hospitalId)
        .order('data_saida', { ascending: false });

      // Filtro de data
      if (options.startDate) {
        query = query.gte('data_saida', options.startDate);
      }
      if (options.endDate) {
        query = query.lte('data_saida', options.endDate);
      }

      // Paginação
      if (options.limit) {
        query = query.limit(options.limit);
      }
      if (options.offset) {
        query = query.range(options.offset, options.offset + (options.limit || 50) - 1);
      }

      const { data, error, count } = await query;

      if (error) throw error;

      return {
        data: data || [],
        count: count || 0
      };
    } catch (error) {
      console.error('❌ Erro ao buscar altas:', error);
      return { data: [], count: 0 };
    }
  }

  /**
   * 🗑️ DELETAR ALTA
   */
  static async deleteDischarge(id: string): Promise<boolean> {
    try {
      const { error } = await supabase
        .from('hospital_discharges')
        .delete()
        .eq('id', id);

      if (error) throw error;
      return true;
    } catch (error) {
      console.error('❌ Erro ao deletar alta:', error);
      return false;
    }
  }

  /**
   * 📈 ESTATÍSTICAS
   */
  static async getStats(hospitalId: string): Promise<{
    totalDischarges: number;
    todayDischarges: number;
    averageStayDuration: string;
  }> {
    try {
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const { data, error } = await supabase
        .from('hospital_discharges')
        .select('data_entrada, data_saida')
        .eq('hospital_id', hospitalId);

      if (error) throw error;

      const todayISO = today.toISOString();
      const todayCount = data?.filter((d) => d.data_saida >= todayISO).length || 0;

      return {
        totalDischarges: data?.length || 0,
        todayDischarges: todayCount,
        averageStayDuration: 'N/A'
      };
    } catch (error) {
      console.error('❌ Erro ao calcular estatísticas:', error);
      return {
        totalDischarges: 0,
        todayDischarges: 0,
        averageStayDuration: 'N/A'
      };
    }
  }
}


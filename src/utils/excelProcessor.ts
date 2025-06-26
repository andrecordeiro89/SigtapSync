import * as XLSX from 'xlsx';
import { SigtapProcedure } from '../types';
import { logger } from '../config/env';

// Interface para resultado do processamento Excel
export interface ExcelProcessingResult {
  success: boolean;
  message: string;
  procedures: SigtapProcedure[];
  totalProcessed: number;
  sheetsProcessed: string[];
  processingStats: {
    totalSheets: number;
    validRows: number;
    invalidRows: number;
    processingTime: number;
  };
}

// Interface para mapeamento de colunas do Excel
interface ColumnMapping {
  code: string[];
  description: string[];
  complexity: string[];
  modality: string[];
  financing: string[];
  valueAmb: string[];
  valueHosp: string[];
  valueProf: string[];
  [key: string]: string[];
}

// Mapeamentos possíveis de colunas (flexível para diferentes formatos)
const COLUMN_MAPPINGS: ColumnMapping = {
  code: ['código', 'codigo', 'code', 'procedimento', 'cod_procedimento', 'cod procedimento'],
  description: ['descrição', 'descricao', 'description', 'nome', 'procedimento', 'desc_procedimento'],
  origem: ['origem', 'origin', 'fonte', 'proveniencia', 'procedencia'],
  complexity: ['complexidade', 'complexity', 'nivel', 'nível', 'tipo_complexidade'],
  modality: ['modalidade', 'modality', 'mod', 'tipo_modalidade'],
  financing: ['financiamento', 'financing', 'tipo_financiamento', 'fonte'],
  valueAmb: ['valor_ambulatorial', 'valor ambulatorial', 'valor_amb', 'value_amb', 'ambulatorial'],
  valueHosp: ['valor_hospitalar', 'valor hospitalar', 'valor_hosp', 'value_hosp', 'hospitalar'],
  valueProf: ['valor_profissional', 'valor profissional', 'valor_prof', 'value_prof', 'profissional'],
  especialidadeLeito: ['especialidade_leito', 'especialidade leito', 'especialidade do leito', 'specialty_bed', 'bed_specialty']
};

export class ExcelProcessor {
  private processingStats = {
    totalSheets: 0,
    validRows: 0,
    invalidRows: 0,
    processingTime: 0
  };

  /**
   * Processa arquivo Excel SIGTAP com múltiplas abas
   */
  async processSigtapExcel(
    file: File,
    onProgress?: (progress: number, currentSheet: string, totalSheets: number) => void
  ): Promise<ExcelProcessingResult> {
    const startTime = Date.now();
    
    try {
      logger.info('🚀 Iniciando processamento Excel SIGTAP:', file.name);
      
      // Validar arquivo
      if (!this.isValidExcelFile(file)) {
        return {
          success: false,
          message: 'Arquivo não é um Excel válido (.xlsx, .xls)',
          procedures: [],
          totalProcessed: 0,
          sheetsProcessed: [],
          processingStats: this.processingStats
        };
      }

      // Ler arquivo Excel
      const arrayBuffer = await file.arrayBuffer();
      const workbook = XLSX.read(arrayBuffer, { 
        type: 'array',
        cellDates: true,
        cellNF: false,
        cellText: false
      });

      const totalSheets = workbook.SheetNames.length;
      this.processingStats.totalSheets = totalSheets;
      
      logger.info(`📊 Excel carregado: ${totalSheets} abas encontradas`);

      const allProcedures: SigtapProcedure[] = [];
      const sheetsProcessed: string[] = [];
      let currentSheetIndex = 0;

      // Processar cada aba
      for (const sheetName of workbook.SheetNames) {
        try {
          logger.info(`📋 Processando aba: ${sheetName}`);
          
          // Atualizar progresso
          const progress = Math.round((currentSheetIndex / totalSheets) * 100);
          if (onProgress) {
            onProgress(progress, sheetName, totalSheets);
          }

          // Extrair dados da aba
          const sheetProcedures = this.processSheet(workbook.Sheets[sheetName], sheetName);
          
          if (sheetProcedures.length > 0) {
            allProcedures.push(...sheetProcedures);
            sheetsProcessed.push(sheetName);
            logger.success(`✅ Aba ${sheetName}: ${sheetProcedures.length} procedimentos extraídos`);
          } else {
            logger.warn(`⚠️ Aba ${sheetName}: nenhum procedimento válido encontrado`);
          }

          currentSheetIndex++;
          
          // Pequena pausa para permitir atualização da UI
          await new Promise(resolve => setTimeout(resolve, 10));

        } catch (sheetError) {
          logger.error(`❌ Erro ao processar aba ${sheetName}:`, sheetError);
          this.processingStats.invalidRows++;
        }
      }

      // Remover duplicatas por código
      const uniqueProcedures = this.removeDuplicates(allProcedures);
      
      // Finalizar estatísticas
      this.processingStats.processingTime = Date.now() - startTime;
      
      const result: ExcelProcessingResult = {
        success: true,
        message: `Excel processado com sucesso! ${uniqueProcedures.length} procedimentos únicos extraídos de ${sheetsProcessed.length} abas.`,
        procedures: uniqueProcedures,
        totalProcessed: uniqueProcedures.length,
        sheetsProcessed,
        processingStats: this.processingStats
      };

      logger.success('🎉 Processamento Excel concluído:', {
        procedimentos: uniqueProcedures.length,
        abas: sheetsProcessed.length,
        tempo: `${this.processingStats.processingTime}ms`
      });

      return result;

    } catch (error) {
      logger.error('❌ Erro no processamento Excel:', error);
      
      return {
        success: false,
        message: `Erro ao processar Excel: ${error instanceof Error ? error.message : 'Erro desconhecido'}`,
        procedures: [],
        totalProcessed: 0,
        sheetsProcessed: [],
        processingStats: this.processingStats
      };
    }
  }

  /**
   * Processa uma aba específica do Excel
   */
  private processSheet(worksheet: XLSX.WorkSheet, sheetName: string): SigtapProcedure[] {
    try {
      // Converter aba para array de objetos
      const rawData = XLSX.utils.sheet_to_json(worksheet, { 
        header: 1,
        raw: false,
        dateNF: 'yyyy-mm-dd'
      }) as any[][];

      if (rawData.length < 2) {
        logger.warn(`Aba ${sheetName}: dados insuficientes`);
        return [];
      }

      // Primeira linha como cabeçalhos
      const headers = rawData[0].map((header: any) => 
        this.normalizeHeader(String(header || '').trim())
      );

      // Detectar mapeamento de colunas
      const columnMapping = this.detectColumnMapping(headers);
      
      if (!columnMapping.code || !columnMapping.description) {
        logger.warn(`Aba ${sheetName}: colunas essenciais não encontradas (código/descrição)`);
        return [];
      }

      const procedures: SigtapProcedure[] = [];

      // Processar linhas de dados
      for (let i = 1; i < rawData.length; i++) {
        try {
          const row = rawData[i];
          const procedure = this.convertRowToProcedure(row, columnMapping, headers);
          
          if (procedure) {
            procedures.push(procedure);
            this.processingStats.validRows++;
          } else {
            this.processingStats.invalidRows++;
          }
        } catch (rowError) {
          logger.debug(`Erro na linha ${i + 1} da aba ${sheetName}:`, rowError);
          this.processingStats.invalidRows++;
        }
      }

      return procedures;

    } catch (error) {
      logger.error(`Erro ao processar aba ${sheetName}:`, error);
      return [];
    }
  }

  /**
   * Detecta automaticamente o mapeamento de colunas
   */
  private detectColumnMapping(headers: string[]): { [key: string]: number } {
    const mapping: { [key: string]: number } = {};

    for (const [field, possibleNames] of Object.entries(COLUMN_MAPPINGS)) {
      for (let i = 0; i < headers.length; i++) {
        const header = headers[i];
        
        if (possibleNames.some(name => header.includes(name))) {
          mapping[field] = i;
          break;
        }
      }
    }

    return mapping;
  }

  /**
   * Converte linha do Excel em SigtapProcedure
   */
  private convertRowToProcedure(
    row: any[], 
    columnMapping: { [key: string]: number }, 
    headers: string[]
  ): SigtapProcedure | null {
    try {
      // Extrair código (obrigatório)
      const code = this.extractValue(row, columnMapping.code, '').trim();
      if (!code || !this.isValidSigtapCode(code)) {
        return null;
      }

      // Extrair descrição (obrigatório)
      const description = this.extractValue(row, columnMapping.description, '').trim();
      if (!description) {
        return null;
      }

      // Extrair outros campos com valores padrão
      const origem = this.extractValue(row, columnMapping.origem, '');
      
      const complexity = this.normalizeComplexity(
        this.extractValue(row, columnMapping.complexity, 'MÉDIA COMPLEXIDADE')
      );

      const modality = this.extractValue(row, columnMapping.modality, '');
      const financing = this.extractValue(row, columnMapping.financing, '');
      
      const especialidadeLeito = this.extractValue(row, columnMapping.especialidadeLeito, '');

      // Extrair valores financeiros
      const valueAmb = this.parseNumericValue(
        this.extractValue(row, columnMapping.valueAmb, '0')
      );
      const valueHosp = this.parseNumericValue(
        this.extractValue(row, columnMapping.valueHosp, '0')
      );
      const valueProf = this.parseNumericValue(
        this.extractValue(row, columnMapping.valueProf, '0')
      );

      // Tentar extrair campos adicionais dinamicamente
      const additionalFields = this.extractAdditionalFields(row, headers);

      const procedure: SigtapProcedure = {
        code,
        description,
        origem,
        complexity,
        modality,
        registrationInstrument: additionalFields.registrationInstrument || '',
        financing,
        valueAmb,
        valueAmbTotal: additionalFields.valueAmbTotal || 0,
        valueHosp,
        valueProf,
        valueHospTotal: additionalFields.valueHospTotal || 0,
        complementaryAttribute: additionalFields.complementaryAttribute || '',
        gender: additionalFields.gender || '',
        minAge: additionalFields.minAge || 0,
        minAgeUnit: additionalFields.minAgeUnit || 'Ano(s)',
        maxAge: additionalFields.maxAge || 999,
        maxAgeUnit: additionalFields.maxAgeUnit || 'Ano(s)',
        maxQuantity: additionalFields.maxQuantity || 0,
        averageStay: additionalFields.averageStay || 0,
        points: additionalFields.points || 0,
        cbo: additionalFields.cbo || [],
        cid: additionalFields.cid || [],
        habilitation: additionalFields.habilitation || '',
        habilitationGroup: additionalFields.habilitationGroup || [],
        serviceClassification: additionalFields.serviceClassification || '',
        especialidadeLeito
      };

      return procedure;

    } catch (error) {
      logger.debug('Erro ao converter linha:', error);
      return null;
    }
  }

  /**
   * Extrai valor de uma célula específica
   */
  private extractValue(row: any[], columnIndex: number | undefined, defaultValue: string): string {
    if (columnIndex === undefined || columnIndex >= row.length) {
      return defaultValue;
    }
    
    const value = row[columnIndex];
    return value !== null && value !== undefined ? String(value).trim() : defaultValue;
  }

  /**
   * Extrai campos adicionais baseado nos cabeçalhos
   */
  private extractAdditionalFields(row: any[], headers: string[]): { [key: string]: any } {
    const fields: { [key: string]: any } = {};

    for (let i = 0; i < headers.length; i++) {
      const header = headers[i];
      const value = row[i];

      // Mapear campos conhecidos
      if (header.includes('instrumento')) {
        fields.registrationInstrument = String(value || '');
      } else if (header.includes('sexo') || header.includes('gênero')) {
        fields.gender = String(value || '');
      } else if (header.includes('idade_min') || header.includes('idade mínima')) {
        fields.minAge = this.parseNumericValue(value, 0);
      } else if (header.includes('idade_max') || header.includes('idade máxima')) {
        fields.maxAge = this.parseNumericValue(value, 999);
      } else if (header.includes('cbo')) {
        const cboValue = String(value || '').trim();
        fields.cbo = cboValue ? cboValue.split(/[,;|\/]/).map(s => s.trim()).filter(s => s) : [];
      } else if (header.includes('cid')) {
        const cidValue = String(value || '').trim();
        fields.cid = cidValue ? cidValue.split(/[,;|\/]/).map(s => s.trim()).filter(s => s) : [];
      } else if (header.includes('habilitação') || header.includes('habilitacao')) {
        fields.habilitation = String(value || '');
      } else if (header.includes('pontos') || header.includes('points')) {
        fields.points = this.parseNumericValue(value, 0);
      }
    }

    return fields;
  }

  /**
   * Normaliza cabeçalho para busca
   */
  private normalizeHeader(header: string): string {
    return header
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '') // Remove acentos
      .replace(/[^\w\s]/g, ' ') // Remove caracteres especiais
      .replace(/\s+/g, ' ')
      .trim();
  }

  /**
   * Normaliza complexidade para padrões SIGTAP
   */
  private normalizeComplexity(complexity: string): string {
    const normalized = complexity.toUpperCase();
    
    if (normalized.includes('ATENÇÃO BÁSICA') || normalized.includes('ATENCAO BASICA') || normalized.includes('BÁSICA')) {
      return 'ATENÇÃO BÁSICA';
    } else if (normalized.includes('BAIXA COMPLEXIDADE') || normalized.includes('BAIXA')) {
      return 'BAIXA COMPLEXIDADE';
    } else if (normalized.includes('ALTA COMPLEXIDADE') || normalized.includes('ALTA')) {
      return 'ALTA COMPLEXIDADE';
    } else if (normalized.includes('MÉDIA COMPLEXIDADE') || normalized.includes('MEDIA COMPLEXIDADE') || normalized.includes('MÉDIA') || normalized.includes('MEDIA')) {
      return 'MÉDIA COMPLEXIDADE';
    }
    
    return 'MÉDIA COMPLEXIDADE'; // Default
  }

  /**
   * Converte valor para numérico
   */
  private parseNumericValue(value: any, defaultValue = 0): number {
    if (typeof value === 'number') return value;
    if (typeof value === 'string') {
      // Remove formatação brasileira: "R$ 45,67" → 45.67
      const cleaned = value.replace(/[R$\s]/g, '').replace(',', '.');
      const parsed = parseFloat(cleaned);
      return isNaN(parsed) ? defaultValue : parsed;
    }
    return defaultValue;
  }

  /**
   * Valida se o código está no formato SIGTAP
   */
  private isValidSigtapCode(code: string): boolean {
    return /^\d{2}\.\d{2}\.\d{2}\.\d{3}-\d$/.test(code.trim());
  }

  /**
   * Valida se o arquivo é um Excel válido
   */
  private isValidExcelFile(file: File): boolean {
    const validExtensions = ['.xlsx', '.xls', '.xlsm'];
    const validMimeTypes = [
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/vnd.ms-excel',
      'application/vnd.ms-excel.sheet.macroEnabled.12'
    ];

    const fileName = file.name.toLowerCase();
    const hasValidExtension = validExtensions.some(ext => fileName.endsWith(ext));
    const hasValidMimeType = validMimeTypes.includes(file.type);

    return hasValidExtension || hasValidMimeType;
  }

  /**
   * Remove procedimentos duplicados por código
   */
  private removeDuplicates(procedures: SigtapProcedure[]): SigtapProcedure[] {
    const uniqueMap = new Map<string, SigtapProcedure>();
    
    for (const procedure of procedures) {
      const existing = uniqueMap.get(procedure.code);
      
      if (!existing) {
        uniqueMap.set(procedure.code, procedure);
      } else {
        // Manter o procedimento com mais campos preenchidos
        const existingFieldCount = this.countFilledFields(existing);
        const currentFieldCount = this.countFilledFields(procedure);
        
        if (currentFieldCount > existingFieldCount) {
          uniqueMap.set(procedure.code, procedure);
        }
      }
    }
    
    return Array.from(uniqueMap.values());
  }

  /**
   * Conta campos preenchidos em um procedimento
   */
  private countFilledFields(procedure: SigtapProcedure): number {
    let count = 0;
    
    for (const [key, value] of Object.entries(procedure)) {
      if (key === 'code' || key === 'description') continue; // Sempre preenchidos
      
      if (value && value !== '' && value !== 0 && 
          !(Array.isArray(value) && value.length === 0)) {
        count++;
      }
    }
    
    return count;
  }

  /**
   * Reset das estatísticas
   */
  resetStats(): void {
    this.processingStats = {
      totalSheets: 0,
      validRows: 0,
      invalidRows: 0,
      processingTime: 0
    };
  }

  /**
   * Retorna estatísticas do processamento
   */
  getStats() {
    return { ...this.processingStats };
  }
}
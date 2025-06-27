import { SigtapProcedure } from '../types';
import { GeminiExtractor } from './geminiExtractor';

/**
 * EXTRATOR RÁPIDO - Versão otimizada com lógica sequencial/posicional
 * 
 * CAMPOS SEQUENCIAIS (na ordem que aparecem):
 * - Procedimento, Complexidade, Tipo de Financiamento, Valores, Sexo, Idades, Quantidade, Permanência, Pontos
 * 
 * CAMPOS POSICIONAIS (baseado na posição no layout):
 * - Origem, Modalidade, Instrumento de Registro, CBO, CID
 */

interface FastConfig {
  useGemini: boolean;
  confidenceThreshold: number;
  maxGeminiPages: number;
}

interface FieldExtractionResult {
  found: boolean;
  value: string;
  confidence: number;
}

export class FastExtractor {
  private geminiExtractor: GeminiExtractor | null = null;
  private config: FastConfig;
  private geminiUsed = 0;

  constructor(geminiApiKey?: string) {
    this.config = {
      useGemini: Boolean(geminiApiKey && geminiApiKey !== 'your_gemini_api_key_here'),
      confidenceThreshold: 60,
      maxGeminiPages: 5
    };

    if (this.config.useGemini) {
      try {
        this.geminiExtractor = new GeminiExtractor(geminiApiKey!, {
          model: 'gemini-1.5-flash',
          temperature: 0.1,
          retryAttempts: 1
        });
        console.log('🚀 FastExtractor: Gemini ativado');
      } catch {
        this.config.useGemini = false;
        console.log('🚀 FastExtractor: Modo tradicional');
      }
    } else {
      console.log('🚀 FastExtractor: Modo tradicional');
    }
  }

  async extractFromText(textContent: any, pageNumber: number): Promise<SigtapProcedure[]> {
    // SEMPRE usar método tradicional primeiro
    const procedures = this.sequentialPositionalExtraction(textContent, pageNumber);
    
    // Se há poucos procedimentos E Gemini disponível E não excedeu limite
    if (procedures.length === 0 && 
        this.config.useGemini && 
        this.geminiUsed < this.config.maxGeminiPages && 
        this.geminiExtractor) {
      
      console.log(`🤖 Gemini backup - Página ${pageNumber}`);
      this.geminiUsed++;
      
      try {
        const text = this.extractTextFromContent(textContent);
        const geminiResult = await this.geminiExtractor.extractFromText(text, pageNumber);
        
        if (geminiResult.procedures.length > 0) {
          return geminiResult.procedures;
        }
      } catch (error) {
        console.warn(`Gemini falhou página ${pageNumber}:`, error);
      }
    }
    
    return procedures;
  }

  private sequentialPositionalExtraction(textContent: any, pageNumber: number): SigtapProcedure[] {
    const procedures: SigtapProcedure[] = [];
    
    try {
      // Construir mapa posicional e sequencial
      const textItems = textContent.items || [];
      const positionMap = this.buildPositionMap(textItems);
      const sequentialText = this.buildSequentialText(textItems);
      
      // Encontrar procedimentos
      const procedureMatches = sequentialText.match(/(\d{2}\.\d{2}\.\d{2}\.\d{3}-\d)\s+Procedimento:\s*([^\n\r]+)/gi);
      
      if (procedureMatches) {
        for (const match of procedureMatches) {
          const regex = /(\d{2}\.\d{2}\.\d{2}\.\d{3}-\d)\s+Procedimento:\s*([^\n\r]+)/i;
          const parts = match.match(regex);
          
          if (parts) {
            const code = parts[1];
            const description = parts[2].trim();
            
            // Extrair bloco do procedimento
            const procIndex = sequentialText.indexOf(match);
            const nextProcIndex = sequentialText.indexOf('Procedimento:', procIndex + match.length);
            const blockText = nextProcIndex > -1 
              ? sequentialText.substring(procIndex, nextProcIndex)
              : sequentialText.substring(procIndex, procIndex + 2000);
            
            // Extrair campos usando lógica sequencial/posicional
            const procedure = this.extractProcedureFields(code, description, blockText, positionMap);
            procedures.push(procedure);
          }
        }
      }
    } catch (error) {
      console.warn(`Erro extração página ${pageNumber}:`, error);
    }
    
    return procedures;
  }

  private buildPositionMap(textItems: any[]): Map<string, { x: number, y: number, text: string }> {
    const positionMap = new Map();
    
    textItems.forEach((item: any, index: number) => {
      const x = Math.round(item.transform[4]);
      const y = Math.round(item.transform[5]);
      const text = item.str || '';
      
      positionMap.set(`${index}`, { x, y, text });
    });
    
    return positionMap;
  }

  private buildSequentialText(textItems: any[]): string {
    const lineGroups: { [key: number]: string[] } = {};
    
    textItems.forEach((item: any) => {
      const y = Math.round(item.transform[5]);
      if (!lineGroups[y]) lineGroups[y] = [];
      lineGroups[y].push(item.str);
    });
    
    const lines: string[] = [];
    Object.keys(lineGroups)
      .sort((a, b) => parseInt(b) - parseInt(a))
      .forEach(y => {
        const line = lineGroups[parseInt(y)].join(' ').trim();
        if (line) lines.push(line);
      });
    
    return lines.join('\n');
  }

  private extractProcedureFields(
    code: string, 
    description: string, 
    blockText: string, 
    positionMap: Map<string, { x: number, y: number, text: string }>
  ): SigtapProcedure {
    
    // EXTRAÇÃO SEQUENCIAL - na ordem que aparecem
    const complexity = this.extractSequentialField(blockText, 'Complexidade');
    const financing = this.extractSequentialField(blockText, 'Tipo de Financiamento');
    const valueAmbSA = this.extractSequentialValue(blockText, 'Valor Ambulatorial S.A.');
    const valueAmbTotal = this.extractSequentialValue(blockText, 'Valor Ambulatorial Total');
    const valueHospSP = this.extractSequentialValue(blockText, 'Valor Hospitalar S.P');
    const valueHospSH = this.extractSequentialValue(blockText, 'Valor Hospitalar S.H');
    const valueHospTotal = this.extractSequentialValue(blockText, 'Valor Hospitalar Total');
    const gender = this.extractSequentialField(blockText, 'Sexo');
    const minAge = this.extractSequentialAge(blockText, 'Idade Mínima');
    const maxAge = this.extractSequentialAge(blockText, 'Idade Máxima');
    const maxQuantity = this.extractSequentialNumber(blockText, 'Quantidade Máxima');
    const averageStay = this.extractSequentialNumber(blockText, 'Média Permanência');
    const points = this.extractSequentialNumber(blockText, 'Pontos');
    
    // EXTRAÇÃO POSICIONAL - baseado na posição
    const origin = this.extractPositionalField(blockText, positionMap, 'Origem');
    const modality = this.extractPositionalField(blockText, positionMap, 'Modalidade');
    const registrationInstrument = this.extractPositionalField(blockText, positionMap, 'Instrumento de Registro');
    const cbo = this.extractPositionalField(blockText, positionMap, 'CBO');
    const cid = this.extractPositionalField(blockText, positionMap, 'CID');
    
    return {
      code,
      description,
      origem: origin,
      complexity: this.normalizeComplexity(complexity),
      modality: modality,
      registrationInstrument: registrationInstrument,
      financing: financing,
      valueAmb: valueAmbSA,
      valueAmbTotal: valueAmbTotal,
      valueHosp: valueHospSH,
      valueProf: valueHospSP,
      valueHospTotal: valueHospTotal,
      complementaryAttribute: origin,
      gender: this.normalizeGender(gender),
      minAge: minAge.value,
      minAgeUnit: minAge.unit,
      maxAge: maxAge.value,
      maxAgeUnit: maxAge.unit,
      maxQuantity: maxQuantity,
      averageStay: averageStay,
      points: points,
      cbo: cbo ? [cbo] : [],
      cid: cid ? [cid] : [],
      habilitation: '',
      habilitationGroup: [],
      serviceClassification: '',
      especialidadeLeito: ''
    };
  }

  // MÉTODOS DE EXTRAÇÃO SEQUENCIAL
  private extractSequentialField(text: string, fieldName: string): string {
    const patterns = [
      new RegExp(`${fieldName}:\\s*([^\\n\\r]*?)(?=\\s*[A-Z][a-z]+:|$)`, 'i'),
      new RegExp(`${fieldName}\\s*([^\\n\\r]*?)(?=\\s*[A-Z][a-z]+:|$)`, 'i')
    ];
    
    for (const pattern of patterns) {
      const match = text.match(pattern);
      if (match && match[1]) {
        return match[1].trim();
      }
    }
    
    return '';
  }

  private extractSequentialValue(text: string, fieldName: string): number {
    const patterns = [
      new RegExp(`${fieldName}:\\s*R\\$\\s*([\\d,]+\\.?\\d*)`, 'i'),
      new RegExp(`${fieldName}\\s*R\\$\\s*([\\d,]+\\.?\\d*)`, 'i'),
      new RegExp(`${fieldName}:\\s*([\\d,]+\\.?\\d*)`, 'i')
    ];
    
    for (const pattern of patterns) {
      const match = text.match(pattern);
      if (match && match[1]) {
        return parseFloat(match[1].replace(',', '.'));
      }
    }
    
    return 0;
  }

  private extractSequentialNumber(text: string, fieldName: string): number {
    const pattern = new RegExp(`${fieldName}:\\s*(\\d+)`, 'i');
    const match = text.match(pattern);
    return match ? parseInt(match[1]) : 0;
  }

  private extractSequentialAge(text: string, fieldName: string): { value: number, unit: string } {
    const pattern = new RegExp(`${fieldName}:\\s*(\\d+)\\s*(\\w+)`, 'i');
    const match = text.match(pattern);
    
    if (match) {
      return {
        value: parseInt(match[1]),
        unit: this.normalizeAgeUnit(match[2])
      };
    }
    
    return { value: 0, unit: 'Ano(s)' };
  }

  // MÉTODOS DE EXTRAÇÃO POSICIONAL
  private extractPositionalField(
    text: string, 
    positionMap: Map<string, { x: number, y: number, text: string }>, 
    fieldName: string
  ): string {
    // Buscar o campo no texto
    const fieldPattern = new RegExp(`${fieldName}:\\s*([^\\n\\r]*?)(?=\\s*[A-Z][a-z]+:|$)`, 'i');
    const match = text.match(fieldPattern);
    
    if (match && match[1]) {
      return match[1].trim();
    }
    
    // Fallback: buscar posicionalmente
    for (const [key, item] of positionMap.entries()) {
      if (item.text.toLowerCase().includes(fieldName.toLowerCase())) {
        // Procurar próximo item na mesma linha ou próxima
        const nextKey = (parseInt(key) + 1).toString();
        const nextItem = positionMap.get(nextKey);
        if (nextItem && Math.abs(nextItem.y - item.y) < 5) {
          return nextItem.text.trim();
        }
      }
    }
    
    return '';
  }

  // MÉTODOS DE NORMALIZAÇÃO
  private normalizeComplexity(complexity: string): string {
    const upper = complexity.toUpperCase();
    if (upper.includes('ATENÇÃO BÁSICA')) return 'ATENÇÃO BÁSICA';
    if (upper.includes('BAIXA COMPLEXIDADE')) return 'BAIXA COMPLEXIDADE';
    if (upper.includes('ALTA COMPLEXIDADE')) return 'ALTA COMPLEXIDADE';
    if (upper.includes('MÉDIA COMPLEXIDADE')) return 'MÉDIA COMPLEXIDADE';
    return 'MÉDIA COMPLEXIDADE';
  }

  private normalizeGender(gender: string): string {
    const upper = gender.toUpperCase();
    if (upper.includes('MASCULINO') || upper.includes('M')) return 'M';
    if (upper.includes('FEMININO') || upper.includes('F')) return 'F';
    if (upper.includes('AMBOS') || upper.includes('A')) return 'A';
    return 'A';
  }

  private normalizeAgeUnit(unit: string): string {
    const upper = unit.toUpperCase();
    if (upper.includes('ANO')) return 'Ano(s)';
    if (upper.includes('MES')) return 'Mês(es)';
    if (upper.includes('DIA')) return 'Dia(s)';
    return 'Ano(s)';
  }

  private extractTextFromContent(textContent: any): string {
    try {
      const textItems = textContent.items || [];
      return textItems.map((item: any) => item.str || '').join(' ');
    } catch {
      return '';
    }
  }

  getStats() {
    return {
      geminiUsed: this.geminiUsed,
      maxAllowed: this.config.maxGeminiPages,
      mode: this.config.useGemini ? 'híbrido' : 'tradicional',
      extractionType: 'sequencial/posicional'
    };
  }
}
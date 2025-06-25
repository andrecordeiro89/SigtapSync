import { SigtapProcedure } from '../types';
import { GeminiExtractor } from './geminiExtractor';

/**
 * EXTRATOR RÁPIDO - Versão otimizada para performance
 * Remove logs excessivos e processamento desnecessário
 */

interface FastConfig {
  useGemini: boolean;
  confidenceThreshold: number;
  maxGeminiPages: number;
}

export class FastExtractor {
  private geminiExtractor: GeminiExtractor | null = null;
  private config: FastConfig;
  private geminiUsed = 0;

  constructor(geminiApiKey?: string) {
    this.config = {
      useGemini: Boolean(geminiApiKey && geminiApiKey !== 'your_gemini_api_key_here'),
      confidenceThreshold: 60, // Mais baixo para usar menos IA
      maxGeminiPages: 5 // Máximo 5 páginas por PDF
    };

    if (this.config.useGemini) {
      try {
        this.geminiExtractor = new GeminiExtractor(geminiApiKey!, {
          model: 'gemini-1.5-flash',
          temperature: 0.1,
          retryAttempts: 1 // Apenas 1 tentativa
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
    const procedures = this.traditionalExtraction(textContent, pageNumber);
    
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

  private traditionalExtraction(textContent: any, pageNumber: number): SigtapProcedure[] {
    const procedures: SigtapProcedure[] = [];
    
    try {
      // Construir texto das linhas
      const textItems = textContent.items || [];
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
      
      const allText = lines.join('\n');
      
      // Regex otimizada
      const procedureMatches = allText.match(/(\d{2}\.\d{2}\.\d{2}\.\d{3}-\d)\s+Procedimento:\s*([^\n\r]+)/gi);
      
      if (procedureMatches) {
        for (const match of procedureMatches) {
          const regex = /(\d{2}\.\d{2}\.\d{2}\.\d{3}-\d)\s+Procedimento:\s*([^\n\r]+)/i;
          const parts = match.match(regex);
          
          if (parts) {
            const code = parts[1];
            const description = parts[2].trim();
            
            // Buscar bloco de dados
            const procIndex = allText.indexOf(match);
            const nextProcIndex = allText.indexOf('Procedimento:', procIndex + match.length);
            const blockText = nextProcIndex > -1 
              ? allText.substring(procIndex, nextProcIndex)
              : allText.substring(procIndex, procIndex + 1500);
            
            // Extrair complexidade - MÉTODO SIMPLES
            let complexity = 'MÉDIA COMPLEXIDADE';
            const complexityMatch = blockText.match(/Complexidade:\s*([^M]*?)(?=\s*Modalidade|$)/i);
            if (complexityMatch) {
              const raw = complexityMatch[1].trim().toUpperCase();
              if (raw.includes('ATENÇÃO BÁSICA')) complexity = 'ATENÇÃO BÁSICA';
              else if (raw.includes('BAIXA COMPLEXIDADE')) complexity = 'BAIXA COMPLEXIDADE';
              else if (raw.includes('ALTA COMPLEXIDADE')) complexity = 'ALTA COMPLEXIDADE';
              else if (raw.includes('MÉDIA COMPLEXIDADE')) complexity = 'MÉDIA COMPLEXIDADE';
            }
            
            // Extrair valores básicos
            let valueAmb = 0, valueHosp = 0, valueProf = 0;
            
            const ambMatch = blockText.match(/Valor Ambulatorial S\.A\.:\s*R\$\s*([\d,]+\.?\d*)/i);
            if (ambMatch) valueAmb = parseFloat(ambMatch[1].replace(',', '.'));
            
            const hospMatch = blockText.match(/Valor Hospitalar S\.H\.:\s*R\$\s*([\d,]+\.?\d*)/i);
            if (hospMatch) valueHosp = parseFloat(hospMatch[1].replace(',', '.'));
            
            const profMatch = blockText.match(/Valor Hospitalar S\.P\.:\s*R\$\s*([\d,]+\.?\d*)/i);
            if (profMatch) valueProf = parseFloat(profMatch[1].replace(',', '.'));
            
            // Extrair financiamento
            let financing = '';
            const financingMatch = blockText.match(/Tipo de Financiamento:\s*(\d+)\s*-\s*([^\n\r]+)/i);
            if (financingMatch) {
              financing = `${financingMatch[1]} - ${financingMatch[2].trim()}`;
            }
            
            procedures.push({
              code,
              description,
              complexity,
              modality: '',
              registrationInstrument: '',
              financing,
              valueAmb,
              valueAmbTotal: 0,
              valueHosp,
              valueProf,
              valueHospTotal: 0,
              complementaryAttribute: '',
              gender: '',
              minAge: 0,
              minAgeUnit: 'Ano(s)',
              maxAge: 999,
              maxAgeUnit: 'Ano(s)',
              maxQuantity: 0,
              averageStay: 0,
              points: 0,
              cbo: '',
              cid: '',
              habilitation: '',
              habilitationGroup: [],
              serviceClassification: ''
            });
          }
        }
      }
    } catch (error) {
      console.warn(`Erro tradicional página ${pageNumber}:`, error);
    }
    
    return procedures;
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
      mode: this.config.useGemini ? 'híbrido' : 'tradicional'
    };
  }
} 
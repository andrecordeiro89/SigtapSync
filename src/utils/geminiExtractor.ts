import { GoogleGenerativeAI } from '@google/generative-ai';
import { SigtapProcedure } from '../types';

// Interface para resultados de extração com confiança
export interface ExtractionResult {
  procedures: SigtapProcedure[];
  confidence: number;
  method: 'traditional' | 'gemini' | 'hybrid';
  processingTime: number;
  errors?: string[];
}

// Interface para configuração do Gemini
export interface GeminiConfig {
  model: 'gemini-1.5-flash' | 'gemini-1.5-pro';
  temperature: number;
  maxTokens?: number;
  retryAttempts: number;
}

export class GeminiExtractor {
  private genAI: GoogleGenerativeAI;
  private config: GeminiConfig;
  private extractionStats = {
    totalExtractions: 0,
    successfulExtractions: 0,
    totalTokensUsed: 0,
    averageConfidence: 0
  };

  constructor(apiKey: string, config?: Partial<GeminiConfig>) {
    if (!apiKey || apiKey === 'your_gemini_api_key_here') {
      throw new Error('❌ Chave de API do Gemini não configurada. Verifique o arquivo .env');
    }

    this.genAI = new GoogleGenerativeAI(apiKey);
    this.config = {
      model: 'gemini-1.5-flash', // Mais rápido e econômico
      temperature: 0.1, // Baixa criatividade para precisão
      retryAttempts: 3,
      ...config
    };

    console.log('🤖 GeminiExtractor inicializado:', {
      model: this.config.model,
      temperature: this.config.temperature
    });
  }

  /**
   * Extrai procedimentos SIGTAP usando Gemini AI
   */
  async extractFromText(
    pageText: string, 
    pageNumber: number,
    context?: { totalPages: number; previousProcedures?: string[] }
  ): Promise<ExtractionResult> {
    const startTime = Date.now();
    
    try {
      console.log(`🤖 Iniciando extração Gemini - Página ${pageNumber}`);
      
      // Preparar prompt especializado
      const prompt = this.buildExtractionPrompt(pageText, pageNumber, context);
      
      // Configurar modelo
      const model = this.genAI.getGenerativeModel({ 
        model: this.config.model,
        generationConfig: {
          temperature: this.config.temperature,
          maxOutputTokens: this.config.maxTokens || 8192,
        }
      });

      // Executar extração com retry
      const result = await this.executeWithRetry(model, prompt);
      
      // Processar e validar resultado
      const extractedData = this.parseAndValidateResult(result, pageNumber);
      
      // Calcular métricas
      const processingTime = Date.now() - startTime;
      const confidence = this.calculateConfidence(extractedData.procedures, pageText);
      
      // Atualizar estatísticas
      this.updateStats(extractedData.procedures.length, confidence, processingTime);
      
      const extractionResult: ExtractionResult = {
        procedures: extractedData.procedures,
        confidence,
        method: 'gemini',
        processingTime,
        errors: extractedData.errors
      };

      console.log(`✅ Gemini - Página ${pageNumber}: ${extractedData.procedures.length} procedimentos extraídos (${confidence.toFixed(1)}% confiança)`);
      
      return extractionResult;

    } catch (error) {
      console.error(`❌ Erro na extração Gemini - Página ${pageNumber}:`, error);
      
      return {
        procedures: [],
        confidence: 0,
        method: 'gemini',
        processingTime: Date.now() - startTime,
        errors: [error instanceof Error ? error.message : 'Erro desconhecido']
      };
    }
  }

  /**
   * Constrói prompt otimizado para extração SIGTAP
   */
  private buildExtractionPrompt(
    pageText: string, 
    pageNumber: number, 
    context?: { totalPages: number; previousProcedures?: string[] }
  ): string {
    return `
# ESPECIALISTA EM EXTRAÇÃO SIGTAP-DATASUS

Você é um especialista em processar dados da tabela SIGTAP (Sistema de Gerenciamento da Tabela de Procedimentos) do DATASUS.

## CONTEXTO
- Página: ${pageNumber}${context?.totalPages ? ` de ${context.totalPages}` : ''}
- Documento: PDF oficial SIGTAP do Ministério da Saúde
- Formato esperado: Procedimentos estruturados com códigos, descrições e valores

## INSTRUÇÕES CRÍTICAS
1. **EXTRAIA APENAS** procedimentos com códigos no formato: XX.XX.XX.XXX-X
2. **IDENTIFIQUE** o padrão: "CÓDIGO Procedimento: DESCRIÇÃO"
3. **CAPTURE** todos os campos disponíveis para cada procedimento
4. **NORMALIZE** valores monetários para formato numérico (ex: "R$ 45,67" → 45.67)
5. **PADRONIZE** complexidade para: "ATENÇÃO BÁSICA", "BAIXA COMPLEXIDADE", "MÉDIA COMPLEXIDADE", "ALTA COMPLEXIDADE"

## CAMPOS OBRIGATÓRIOS
- code: Código do procedimento (XX.XX.XX.XXX-X)
- description: Descrição completa do procedimento
- complexity: Nível de complexidade padronizado

## CAMPOS OPCIONAIS (extrair se disponível)
- modality: Modalidade (ex: "01 - Ambulatorial")
- registrationInstrument: Instrumento de registro
- financing: Tipo de financiamento
- valueAmb, valueProf, valueHosp: Valores financeiros
- gender, minAge, maxAge: Critérios demográficos
- cbo, cid: Classificações médicas

## FORMATO DE SAÍDA
Retorne APENAS um JSON válido sem texto adicional:

\`\`\`json
{
  "success": true,
  "procedures": [
    {
      "code": "01.01.01.001-2",
      "description": "CONSULTA MÉDICA EM ATENÇÃO BÁSICA",
      "complexity": "ATENÇÃO BÁSICA",
      "modality": "01 - Ambulatorial",
      "financing": "01 - Atenção Básica",
      "valueAmb": 15.00,
      "valueProf": 0.00,
      "valueHosp": 0.00,
      "gender": "Ambos",
      "minAge": 0,
      "maxAge": 999
    }
  ],
  "confidence": 95,
  "notes": ["Observações sobre a extração, se houver"]
}
\`\`\`

## TEXTO DA PÁGINA:
${pageText}

---
IMPORTANTE: Retorne apenas o JSON válido. Não adicione explicações ou texto extra.`;
  }

  /**
   * Executa a extração com retry automático
   */
  private async executeWithRetry(model: any, prompt: string, attempt = 1): Promise<any> {
    try {
      const result = await model.generateContent(prompt);
      return result.response.text();
    } catch (error) {
      if (attempt < this.config.retryAttempts) {
        console.log(`⚠️ Tentativa ${attempt} falhou, tentando novamente...`);
        await new Promise(resolve => setTimeout(resolve, 1000 * attempt)); // Backoff
        return this.executeWithRetry(model, prompt, attempt + 1);
      }
      throw error;
    }
  }

  /**
   * Processa e valida o resultado do Gemini
   */
  private parseAndValidateResult(result: string, pageNumber: number): { procedures: SigtapProcedure[]; errors: string[] } {
    const errors: string[] = [];
    const procedures: SigtapProcedure[] = [];

    try {
      // Limpar resultado (remover markdown se houver)
      const cleanResult = result.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
      
      const parsed = JSON.parse(cleanResult);
      
      if (!parsed.procedures || !Array.isArray(parsed.procedures)) {
        errors.push('Formato de resposta inválido: procedures não é um array');
        return { procedures, errors };
      }

      for (const proc of parsed.procedures) {
        try {
          // Validar campos obrigatórios
          if (!proc.code || !proc.description) {
            errors.push(`Procedimento sem código ou descrição: ${JSON.stringify(proc)}`);
            continue;
          }

          // Validar formato do código
          if (!/^\d{2}\.\d{2}\.\d{2}\.\d{3}-\d$/.test(proc.code)) {
            errors.push(`Código inválido: ${proc.code}`);
            continue;
          }

          // Normalizar e criar procedimento
          const normalizedProcedure: SigtapProcedure = {
            code: proc.code,
            description: proc.description.trim(),
            complexity: this.normalizeComplexity(proc.complexity),
            modality: proc.modality || '',
            registrationInstrument: proc.registrationInstrument || '',
            financing: proc.financing || '',
            valueAmb: this.parseNumericValue(proc.valueAmb),
            valueAmbTotal: this.parseNumericValue(proc.valueAmbTotal),
            valueHosp: this.parseNumericValue(proc.valueHosp),
            valueProf: this.parseNumericValue(proc.valueProf),
            valueHospTotal: this.parseNumericValue(proc.valueHospTotal),
            complementaryAttribute: proc.complementaryAttribute || '',
            gender: proc.gender || '',
            minAge: this.parseNumericValue(proc.minAge, 0),
            minAgeUnit: proc.minAgeUnit || 'Ano(s)',
            maxAge: this.parseNumericValue(proc.maxAge, 999),
            maxAgeUnit: proc.maxAgeUnit || 'Ano(s)',
            maxQuantity: this.parseNumericValue(proc.maxQuantity, 0),
            averageStay: this.parseNumericValue(proc.averageStay, 0),
            points: this.parseNumericValue(proc.points, 0),
            cbo: proc.cbo || '',
            cid: proc.cid || '',
            habilitation: proc.habilitation || '',
            habilitationGroup: Array.isArray(proc.habilitationGroup) ? proc.habilitationGroup : [],
            serviceClassification: proc.serviceClassification || ''
          };

          procedures.push(normalizedProcedure);

        } catch (procError) {
          errors.push(`Erro ao processar procedimento: ${procError}`);
        }
      }

      if (procedures.length === 0 && parsed.procedures.length > 0) {
        errors.push('Nenhum procedimento válido encontrado após validação');
      }

    } catch (parseError) {
      errors.push(`Erro ao fazer parse do JSON: ${parseError}`);
      console.error('❌ JSON inválido do Gemini:', result.substring(0, 500));
    }

    return { procedures, errors };
  }

  /**
   * Normaliza complexidade para padrões SIGTAP
   */
  private normalizeComplexity(complexity: string): string {
    if (!complexity) return 'MÉDIA COMPLEXIDADE';
    
    const normalized = complexity.toUpperCase();
    
    if (normalized.includes('ATENÇÃO BÁSICA') || normalized.includes('ATENCAO BASICA')) {
      return 'ATENÇÃO BÁSICA';
    } else if (normalized.includes('BAIXA COMPLEXIDADE')) {
      return 'BAIXA COMPLEXIDADE';
    } else if (normalized.includes('ALTA COMPLEXIDADE')) {
      return 'ALTA COMPLEXIDADE';
    } else if (normalized.includes('MÉDIA COMPLEXIDADE') || normalized.includes('MEDIA COMPLEXIDADE')) {
      return 'MÉDIA COMPLEXIDADE';
    }
    
    return 'MÉDIA COMPLEXIDADE'; // Default
  }

  /**
   * Converte valores para numérico
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
   * Calcula confiança da extração
   */
  private calculateConfidence(procedures: SigtapProcedure[], originalText: string): number {
    if (procedures.length === 0) return 0;
    
    let score = 0;
    const maxScore = procedures.length * 100;
    
    for (const proc of procedures) {
      // +20 pontos por código válido
      if (/^\d{2}\.\d{2}\.\d{2}\.\d{3}-\d$/.test(proc.code)) score += 20;
      
      // +15 pontos por descrição não vazia
      if (proc.description.length > 10) score += 15;
      
      // +10 pontos por complexidade válida
      if (['ATENÇÃO BÁSICA', 'BAIXA COMPLEXIDADE', 'MÉDIA COMPLEXIDADE', 'ALTA COMPLEXIDADE'].includes(proc.complexity)) {
        score += 10;
      }
      
      // +10 pontos por valores monetários
      if (proc.valueAmb > 0 || proc.valueHosp > 0 || proc.valueProf > 0) score += 10;
      
      // +10 pontos por modalidade/financiamento
      if (proc.modality || proc.financing) score += 10;
      
      // +5 pontos por campos adicionais
      if (proc.cbo || proc.cid || proc.habilitation) score += 5;
      
      // Verificar se o código aparece no texto original
      if (originalText.includes(proc.code)) score += 30;
    }
    
    return Math.min(100, (score / maxScore) * 100);
  }

  /**
   * Atualiza estatísticas internas
   */
  private updateStats(procedureCount: number, confidence: number, processingTime: number): void {
    this.extractionStats.totalExtractions++;
    if (procedureCount > 0) this.extractionStats.successfulExtractions++;
    
    // Média móvel de confiança
    this.extractionStats.averageConfidence = 
      (this.extractionStats.averageConfidence * (this.extractionStats.totalExtractions - 1) + confidence) / 
      this.extractionStats.totalExtractions;
  }

  /**
   * Retorna estatísticas de uso
   */
  getStats() {
    return {
      ...this.extractionStats,
      successRate: this.extractionStats.totalExtractions > 0 ? 
        (this.extractionStats.successfulExtractions / this.extractionStats.totalExtractions) * 100 : 0
    };
  }

  /**
   * Reset das estatísticas
   */
  resetStats(): void {
    this.extractionStats = {
      totalExtractions: 0,
      successfulExtractions: 0,
      totalTokensUsed: 0,
      averageConfidence: 0
    };
  }
} 
import { SigtapProcedure } from '../types';
import { GeminiExtractor, ExtractionResult } from './geminiExtractor';

// Interface para configuração do sistema híbrido
export interface HybridConfig {
  // Thresholds para decisão de uso do Gemini
  minProceduresThreshold: number; // Mínimo de procedimentos esperados por página
  confidenceThreshold: number; // Confiança mínima para aceitar resultado tradicional
  maxRetries: number; // Máximo de tentativas
  
  // Configuração de fallback
  enableGeminiFallback: boolean;
  enableTraditionalFallback: boolean;
  
  // Configuração de performance
  maxGeminiPagesPerBatch: number;
  geminiCooldownMs: number; // Cooldown entre chamadas Gemini
}

// Resultado híbrido com informações detalhadas
export interface HybridExtractionResult extends ExtractionResult {
  traditionalResult?: ExtractionResult;
  geminiResult?: ExtractionResult;
  mergeStrategy: 'traditional' | 'gemini' | 'merged' | 'validated';
  costEstimate?: {
    geminiTokensUsed: number;
    estimatedCostUSD: number;
  };
}

export class HybridExtractor {
  private geminiExtractor: GeminiExtractor | null = null;
  private config: HybridConfig;
  private extractionHistory: Map<string, HybridExtractionResult> = new Map();
  private geminiCalls = {
    total: 0,
    successful: 0,
    failed: 0,
    totalTokensUsed: 0,
    totalCostUSD: 0
  };

  constructor(geminiApiKey?: string, config?: Partial<HybridConfig>) {
    this.config = {
      minProceduresThreshold: 1, // Espera pelo menos 1 procedimento por página
      confidenceThreshold: 75, // 75% de confiança mínima
      maxRetries: 2,
      enableGeminiFallback: true,
      enableTraditionalFallback: true,
      maxGeminiPagesPerBatch: 10, // Máximo 10 páginas por lote no Gemini
      geminiCooldownMs: 500, // 500ms entre chamadas
      ...config
    };

    // Inicializar Gemini se a chave estiver disponível
    if (geminiApiKey && geminiApiKey !== 'your_gemini_api_key_here') {
      try {
        this.geminiExtractor = new GeminiExtractor(geminiApiKey, {
          model: 'gemini-1.5-flash',
          temperature: 0.1,
          retryAttempts: this.config.maxRetries
        });
        console.log('🤖 Sistema Híbrido inicializado com Gemini AI');
      } catch (error) {
        console.warn('⚠️ Falha ao inicializar Gemini, usando apenas extração tradicional:', error);
      }
    } else {
      console.log('📋 Sistema Híbrido inicializado apenas com extração tradicional');
    }
  }

  /**
   * Extração híbrida inteligente
   */
  async extractFromText(
    textContent: any,
    pageNumber: number,
    context?: { totalPages: number; fileName: string }
  ): Promise<HybridExtractionResult> {
    const startTime = Date.now();
    const pageKey = `${context?.fileName || 'unknown'}-page-${pageNumber}`;

    console.log(`🔄 Iniciando extração híbrida - Página ${pageNumber}`);

    try {
      // FASE 1: Extração tradicional (sempre executar primeiro)
      const traditionalResult = await this.executeTraditionalExtraction(textContent, pageNumber);
      
      console.log(`📊 Tradicional - Página ${pageNumber}: ${traditionalResult.procedures.length} procedimentos (${traditionalResult.confidence.toFixed(1)}% confiança)`);

      // FASE 2: Decidir se usar Gemini
      const shouldUseGemini = this.shouldUseGemini(traditionalResult, pageNumber);
      
      let geminiResult: ExtractionResult | undefined;
      let finalResult: HybridExtractionResult;

      if (shouldUseGemini && this.geminiExtractor) {
        // FASE 3: Extração com Gemini
        const allText = this.extractTextFromContent(textContent);
        geminiResult = await this.executeGeminiExtraction(allText, pageNumber, context);
        
        // FASE 4: Merge inteligente dos resultados
        finalResult = this.mergeResults(traditionalResult, geminiResult, pageNumber);
      } else {
        // Usar apenas resultado tradicional
        finalResult = {
          ...traditionalResult,
          traditionalResult,
          mergeStrategy: 'traditional'
        };
      }

      // FASE 5: Validação final e métricas
      finalResult.processingTime = Date.now() - startTime;
      this.updateExtractionHistory(pageKey, finalResult);
      
      console.log(`✅ Híbrido - Página ${pageNumber}: ${finalResult.procedures.length} procedimentos finais (${finalResult.confidence.toFixed(1)}% confiança, estratégia: ${finalResult.mergeStrategy})`);
      
      return finalResult;

    } catch (error) {
      console.error(`❌ Erro na extração híbrida - Página ${pageNumber}:`, error);
      
      return {
        procedures: [],
        confidence: 0,
        method: 'hybrid',
        processingTime: Date.now() - startTime,
        mergeStrategy: 'traditional',
        errors: [error instanceof Error ? error.message : 'Erro desconhecido na extração híbrida']
      };
    }
  }

  /**
   * Executa extração tradicional
   */
  private async executeTraditionalExtraction(textContent: any, pageNumber: number): Promise<ExtractionResult> {
    const startTime = Date.now();
    
    try {
      // Importar dinamicamente a função tradicional
      const { extractProceduresFromPageText } = await import('./pdfProcessor');
      const procedures = await extractProceduresFromPageText(textContent, pageNumber);
      
      const confidence = this.calculateTraditionalConfidence(procedures, textContent);
      
      return {
        procedures,
        confidence,
        method: 'traditional',
        processingTime: Date.now() - startTime
      };
    } catch (error) {
      return {
        procedures: [],
        confidence: 0,
        method: 'traditional',
        processingTime: Date.now() - startTime,
        errors: [error instanceof Error ? error.message : 'Erro na extração tradicional']
      };
    }
  }

  /**
   * Executa extração com Gemini com rate limiting
   */
  private async executeGeminiExtraction(
    pageText: string,
    pageNumber: number,
    context?: { totalPages: number; fileName: string }
  ): Promise<ExtractionResult> {
    if (!this.geminiExtractor) {
      throw new Error('Gemini não está configurado');
    }

    // Rate limiting
    if (this.config.geminiCooldownMs > 0) {
      await new Promise(resolve => setTimeout(resolve, this.config.geminiCooldownMs));
    }

    try {
      this.geminiCalls.total++;
      
      const result = await this.geminiExtractor.extractFromText(pageText, pageNumber, {
        totalPages: context?.totalPages || 0
      });
      
      if (result.procedures.length > 0) {
        this.geminiCalls.successful++;
      } else {
        this.geminiCalls.failed++;
      }
      
      // Estimar custo (aproximado para Gemini 1.5 Flash)
      const estimatedTokens = Math.ceil(pageText.length / 4); // ~4 chars por token
      const estimatedCost = (estimatedTokens * 0.075) / 1000000; // $0.075 per 1M tokens
      
      this.geminiCalls.totalTokensUsed += estimatedTokens;
      this.geminiCalls.totalCostUSD += estimatedCost;
      
      return result;
      
    } catch (error) {
      this.geminiCalls.failed++;
      throw error;
    }
  }

  /**
   * Decide se deve usar Gemini baseado na qualidade do resultado tradicional
   */
  private shouldUseGemini(traditionalResult: ExtractionResult, pageNumber: number): boolean {
    if (!this.config.enableGeminiFallback || !this.geminiExtractor) {
      return false;
    }

    // Verificar se atingiu limite de páginas Gemini
    if (this.geminiCalls.total >= this.config.maxGeminiPagesPerBatch) {
      console.log(`⚠️ Limite de páginas Gemini atingido (${this.config.maxGeminiPagesPerBatch})`);
      return false;
    }

    // Critérios para usar Gemini
    const hasLowConfidence = traditionalResult.confidence < this.config.confidenceThreshold;
    const hasFewerProcedures = traditionalResult.procedures.length < this.config.minProceduresThreshold;
    const hasErrors = traditionalResult.errors && traditionalResult.errors.length > 0;

    const shouldUse = hasLowConfidence || hasFewerProcedures || hasErrors;

    if (shouldUse) {
      console.log(`🤖 Usando Gemini para página ${pageNumber}: confiança=${traditionalResult.confidence.toFixed(1)}%, procedimentos=${traditionalResult.procedures.length}, erros=${traditionalResult.errors?.length || 0}`);
    }

    return shouldUse;
  }

  /**
   * Merge inteligente dos resultados tradicional e Gemini
   */
  private mergeResults(
    traditionalResult: ExtractionResult,
    geminiResult: ExtractionResult,
    pageNumber: number
  ): HybridExtractionResult {
    console.log(`🔀 Fazendo merge - Página ${pageNumber}: Tradicional(${traditionalResult.procedures.length}, ${traditionalResult.confidence.toFixed(1)}%) vs Gemini(${geminiResult.procedures.length}, ${geminiResult.confidence.toFixed(1)}%)`);

    let finalProcedures: SigtapProcedure[];
    let finalConfidence: number;
    let mergeStrategy: HybridExtractionResult['mergeStrategy'];

    // Estratégia 1: Se Gemini tem muito mais confiança, usar Gemini
    if (geminiResult.confidence > traditionalResult.confidence + 20) {
      finalProcedures = geminiResult.procedures;
      finalConfidence = geminiResult.confidence;
      mergeStrategy = 'gemini';
      console.log(`   → Usando resultado Gemini (confiança superior)`);
    }
    // Estratégia 2: Se tradicional tem boa confiança, usar tradicional
    else if (traditionalResult.confidence >= this.config.confidenceThreshold) {
      finalProcedures = traditionalResult.procedures;
      finalConfidence = traditionalResult.confidence;
      mergeStrategy = 'traditional';
      console.log(`   → Usando resultado tradicional (confiança suficiente)`);
    }
    // Estratégia 3: Merge inteligente
    else {
      const mergedData = this.intelligentMerge(traditionalResult.procedures, geminiResult.procedures);
      finalProcedures = mergedData.procedures;
      finalConfidence = Math.max(traditionalResult.confidence, geminiResult.confidence);
      mergeStrategy = 'merged';
      console.log(`   → Merge inteligente: ${mergedData.procedures.length} procedimentos únicos`);
    }

    // Estimar custo do Gemini
    const costEstimate = {
      geminiTokensUsed: Math.ceil((this.extractTextFromContent(null)?.length || 1000) / 4),
      estimatedCostUSD: this.geminiCalls.totalCostUSD
    };

    return {
      procedures: finalProcedures,
      confidence: finalConfidence,
      method: 'hybrid',
      processingTime: Math.max(traditionalResult.processingTime, geminiResult.processingTime),
      traditionalResult,
      geminiResult,
      mergeStrategy,
      costEstimate,
      errors: [...(traditionalResult.errors || []), ...(geminiResult.errors || [])]
    };
  }

  /**
   * Merge inteligente de procedimentos de ambas as fontes
   */
  private intelligentMerge(
    traditionalProcedures: SigtapProcedure[],
    geminiProcedures: SigtapProcedure[]
  ): { procedures: SigtapProcedure[]; duplicatesRemoved: number } {
    const procedureMap = new Map<string, SigtapProcedure>();
    let duplicatesRemoved = 0;

    // Adicionar procedimentos tradicionais
    for (const proc of traditionalProcedures) {
      procedureMap.set(proc.code, proc);
    }

    // Adicionar/substituir com procedimentos do Gemini (priorizando campos mais completos)
    for (const geminiProc of geminiProcedures) {
      const existing = procedureMap.get(geminiProc.code);
      
      if (existing) {
        // Merge campos: usar Gemini se o campo estiver vazio no tradicional
        const merged: SigtapProcedure = {
          ...existing,
          description: geminiProc.description || existing.description,
          complexity: geminiProc.complexity || existing.complexity,
          modality: geminiProc.modality || existing.modality,
          financing: geminiProc.financing || existing.financing,
          valueAmb: geminiProc.valueAmb > 0 ? geminiProc.valueAmb : existing.valueAmb,
          valueHosp: geminiProc.valueHosp > 0 ? geminiProc.valueHosp : existing.valueHosp,
          valueProf: geminiProc.valueProf > 0 ? geminiProc.valueProf : existing.valueProf,
          // Manter outros campos do Gemini se estiverem preenchidos
          cbo: geminiProc.cbo || existing.cbo,
          cid: geminiProc.cid || existing.cid,
          habilitation: geminiProc.habilitation || existing.habilitation
        };
        
        procedureMap.set(geminiProc.code, merged);
        duplicatesRemoved++;
      } else {
        procedureMap.set(geminiProc.code, geminiProc);
      }
    }

    return {
      procedures: Array.from(procedureMap.values()),
      duplicatesRemoved
    };
  }

  /**
   * Calcula confiança para extração tradicional
   */
  private calculateTraditionalConfidence(procedures: SigtapProcedure[], textContent: any): number {
    if (procedures.length === 0) return 0;
    
    let score = 0;
    const maxScore = procedures.length * 100;
    
    for (const proc of procedures) {
      // Verificações de qualidade
      if (/^\d{2}\.\d{2}\.\d{2}\.\d{3}-\d$/.test(proc.code)) score += 30;
      if (proc.description.length > 10) score += 20;
      if (proc.complexity && proc.complexity !== 'MÉDIA COMPLEXIDADE') score += 15;
      if (proc.valueAmb > 0 || proc.valueHosp > 0 || proc.valueProf > 0) score += 20;
      if (proc.financing || proc.modality) score += 15;
    }
    
    return Math.min(100, (score / maxScore) * 100);
  }

  /**
   * Extrai texto do conteúdo do PDF
   */
  private extractTextFromContent(textContent: any): string {
    if (!textContent) return '';
    
    try {
      const textItems = textContent.items || [];
      return textItems.map((item: any) => item.str || '').join(' ');
    } catch {
      return '';
    }
  }

  /**
   * Atualiza histórico de extrações
   */
  private updateExtractionHistory(pageKey: string, result: HybridExtractionResult): void {
    this.extractionHistory.set(pageKey, result);
    
    // Limitar histórico a 100 páginas
    if (this.extractionHistory.size > 100) {
      const firstKey = this.extractionHistory.keys().next().value;
      this.extractionHistory.delete(firstKey);
    }
  }

  /**
   * Retorna estatísticas detalhadas do sistema híbrido
   */
  getDetailedStats() {
    const historyArray = Array.from(this.extractionHistory.values());
    
    return {
      geminiCalls: { ...this.geminiCalls },
      extractionHistory: {
        totalPages: historyArray.length,
        averageConfidence: historyArray.length > 0 ? 
          historyArray.reduce((sum, r) => sum + r.confidence, 0) / historyArray.length : 0,
        averageProceduresPerPage: historyArray.length > 0 ?
          historyArray.reduce((sum, r) => sum + r.procedures.length, 0) / historyArray.length : 0,
        strategies: {
          traditional: historyArray.filter(r => r.mergeStrategy === 'traditional').length,
          gemini: historyArray.filter(r => r.mergeStrategy === 'gemini').length,
          merged: historyArray.filter(r => r.mergeStrategy === 'merged').length,
          validated: historyArray.filter(r => r.mergeStrategy === 'validated').length
        }
      },
      performance: {
        averageProcessingTime: historyArray.length > 0 ?
          historyArray.reduce((sum, r) => sum + r.processingTime, 0) / historyArray.length : 0,
        geminiSuccessRate: this.geminiCalls.total > 0 ?
          (this.geminiCalls.successful / this.geminiCalls.total) * 100 : 0
      },
      costs: {
        totalTokensUsed: this.geminiCalls.totalTokensUsed,
        estimatedTotalCostUSD: this.geminiCalls.totalCostUSD,
        averageCostPerPage: this.geminiCalls.successful > 0 ?
          this.geminiCalls.totalCostUSD / this.geminiCalls.successful : 0
      }
    };
  }

  /**
   * Reset das estatísticas
   */
  resetStats(): void {
    this.geminiCalls = {
      total: 0,
      successful: 0,
      failed: 0,
      totalTokensUsed: 0,
      totalCostUSD: 0
    };
    this.extractionHistory.clear();
    
    if (this.geminiExtractor) {
      this.geminiExtractor.resetStats();
    }
  }

  /**
   * Configura novos parâmetros
   */
  updateConfig(newConfig: Partial<HybridConfig>): void {
    this.config = { ...this.config, ...newConfig };
    console.log('🔧 Configuração híbrida atualizada:', this.config);
  }

  /**
   * Verifica se Gemini está disponível
   */
  isGeminiAvailable(): boolean {
    return this.geminiExtractor !== null;
  }
} 
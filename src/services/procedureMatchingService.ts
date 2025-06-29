import { ProcedureAIH, SigtapProcedure, ProcedureMatchingResult } from '../types';
import { useSigtapData } from '../hooks/useSigtapData';

export class ProcedureMatchingService {
  private sigtapProcedures: SigtapProcedure[] = [];
  private matchThreshold = 0.8; // 80% de similaridade mínima

  constructor(sigtapProcedures: SigtapProcedure[] = []) {
    this.sigtapProcedures = sigtapProcedures;
  }

  /**
   * Realiza matching de uma lista de procedimentos com a tabela SIGTAP
   */
  async performMatching(procedimentos: ProcedureAIH[]): Promise<ProcedureMatchingResult> {
    const startTime = Date.now();
    
    try {
      console.log(`🔍 Iniciando matching de ${procedimentos.length} procedimentos...`);
      
      const matchingDetails: ProcedureMatchingResult['matchingDetails'] = [];
      const updatedProcedimentos: ProcedureAIH[] = [];
      
      let encontrados = 0;
      let naoEncontrados = 0;
      let valorTotalCalculado = 0;

      for (const procedimento of procedimentos) {
        const matchResult = await this.matchSingleProcedure(procedimento);
        
        // Atualizar procedimento com resultado do matching
        const updatedProcedimento: ProcedureAIH = {
          ...procedimento,
          matchStatus: matchResult.encontrado ? 'matched' : 'pending',
          matchConfidence: matchResult.confidence,
          sigtapProcedure: matchResult.sigtapMatch,
          valorCalculado: matchResult.sigtapMatch?.valueHospTotal || 0,
          valorOriginal: matchResult.sigtapMatch?.valueHospTotal || 0
        };

        updatedProcedimentos.push(updatedProcedimento);
        matchingDetails.push(matchResult);

        if (matchResult.encontrado) {
          encontrados++;
          valorTotalCalculado += matchResult.sigtapMatch?.valueHospTotal || 0;
        } else {
          naoEncontrados++;
        }

        console.log(`${matchResult.encontrado ? '✅' : '❌'} ${procedimento.procedimento}: ${matchResult.confidence.toFixed(2)}`);
      }

      const processingTime = Date.now() - startTime;
      
      console.log(`📊 Matching concluído em ${processingTime}ms:`);
      console.log(`   - Encontrados: ${encontrados}`);
      console.log(`   - Não encontrados: ${naoEncontrados}`);
      console.log(`   - Valor total: R$ ${valorTotalCalculado.toFixed(2)}`);

      return {
        success: true,
        totalProcedimentos: procedimentos.length,
        procedimentosEncontrados: encontrados,
        procedimentosNaoEncontrados: naoEncontrados,
        valorTotalCalculado,
        matchingDetails,
        tempoProcessamento: processingTime
      };

    } catch (error) {
      console.error('❌ Erro no matching de procedimentos:', error);
      
      return {
        success: false,
        totalProcedimentos: procedimentos.length,
        procedimentosEncontrados: 0,
        procedimentosNaoEncontrados: procedimentos.length,
        valorTotalCalculado: 0,
        matchingDetails: procedimentos.map(proc => ({
          codigo: proc.procedimento,
          encontrado: false,
          confidence: 0,
          erro: error instanceof Error ? error.message : 'Erro no matching'
        })),
        tempoProcessamento: Date.now() - startTime
      };
    }
  }

  /**
   * Realiza matching de um único procedimento
   */
  private async matchSingleProcedure(procedimento: ProcedureAIH): Promise<{
    codigo: string;
    encontrado: boolean;
    confidence: number;
    sigtapMatch?: SigtapProcedure;
    erro?: string;
  }> {
    try {
      // 1. Busca exata por código
      const exactMatch = this.findExactMatch(procedimento.procedimento);
      if (exactMatch) {
        return {
          codigo: procedimento.procedimento,
          encontrado: true,
          confidence: 1.0,
          sigtapMatch: exactMatch
        };
      }

      // 2. Busca por código similar (remover pontos e hífens)
      const similarMatch = this.findSimilarCodeMatch(procedimento.procedimento);
      if (similarMatch) {
        return {
          codigo: procedimento.procedimento,
          encontrado: true,
          confidence: 0.9,
          sigtapMatch: similarMatch
        };
      }

      // 3. Busca por descrição (se disponível)
      if (procedimento.descricao) {
        const descriptionMatch = this.findDescriptionMatch(procedimento.descricao);
        if (descriptionMatch && descriptionMatch.confidence >= this.matchThreshold) {
          return {
            codigo: procedimento.procedimento,
            encontrado: true,
            confidence: descriptionMatch.confidence,
            sigtapMatch: descriptionMatch.procedure
          };
        }
      }

      // Procedimento não encontrado
      return {
        codigo: procedimento.procedimento,
        encontrado: false,
        confidence: 0
      };

    } catch (error) {
      return {
        codigo: procedimento.procedimento,
        encontrado: false,
        confidence: 0,
        erro: error instanceof Error ? error.message : 'Erro no matching individual'
      };
    }
  }

  /**
   * Busca exata por código do procedimento
   */
  private findExactMatch(codigo: string): SigtapProcedure | null {
    return this.sigtapProcedures.find(proc => 
      proc.code === codigo
    ) || null;
  }

  /**
   * Busca por código similar (removendo formatação)
   */
  private findSimilarCodeMatch(codigo: string): SigtapProcedure | null {
    const cleanCode = codigo.replace(/[.\-\s]/g, '');
    
    return this.sigtapProcedures.find(proc => 
      proc.code.replace(/[.\-\s]/g, '') === cleanCode
    ) || null;
  }

  /**
   * Busca por similaridade na descrição
   */
  private findDescriptionMatch(descricao: string): { procedure: SigtapProcedure; confidence: number } | null {
    if (!descricao || descricao.length < 5) return null;

    let bestMatch: { procedure: SigtapProcedure; confidence: number } | null = null;
    
    for (const procedure of this.sigtapProcedures) {
      const confidence = this.calculateTextSimilarity(
        descricao.toLowerCase(), 
        procedure.description.toLowerCase()
      );
      
      if (confidence >= this.matchThreshold && 
          (!bestMatch || confidence > bestMatch.confidence)) {
        bestMatch = { procedure, confidence };
      }
    }
    
    return bestMatch;
  }

  /**
   * Calcula similaridade entre dois textos usando algoritmo simples
   */
  private calculateTextSimilarity(text1: string, text2: string): number {
    // Algoritmo simples baseado em palavras em comum
    const words1 = new Set(text1.split(/\s+/).filter(w => w.length > 2));
    const words2 = new Set(text2.split(/\s+/).filter(w => w.length > 2));
    
    const intersection = new Set([...words1].filter(x => words2.has(x)));
    const union = new Set([...words1, ...words2]);
    
    return union.size > 0 ? intersection.size / union.size : 0;
  }

  /**
   * Atualiza a lista de procedimentos SIGTAP
   */
  updateSigtapProcedures(procedures: SigtapProcedure[]): void {
    this.sigtapProcedures = procedures;
    console.log(`🔄 Lista SIGTAP atualizada: ${procedures.length} procedimentos`);
  }

  /**
   * Define o threshold mínimo para matching
   */
  setMatchThreshold(threshold: number): void {
    this.matchThreshold = Math.max(0, Math.min(1, threshold));
    console.log(`🎯 Threshold de matching definido para: ${(this.matchThreshold * 100).toFixed(0)}%`);
  }

  /**
   * Busca manual por termo específico
   */
  searchProcedures(searchTerm: string, limit = 10): SigtapProcedure[] {
    const term = searchTerm.toLowerCase();
    
    return this.sigtapProcedures
      .filter(proc => 
        proc.code.toLowerCase().includes(term) ||
        proc.description.toLowerCase().includes(term)
      )
      .slice(0, limit);
  }

  /**
   * Recalcula valores com base na tabela SIGTAP atualizada
   */
  async recalculateValues(procedimentos: ProcedureAIH[]): Promise<ProcedureAIH[]> {
    console.log('🧮 Recalculando valores dos procedimentos...');
    
    return procedimentos.map(proc => {
      if (proc.sigtapProcedure) {
        return {
          ...proc,
          valorCalculado: proc.sigtapProcedure.valueHospTotal,
          valorOriginal: proc.sigtapProcedure.valueHospTotal
        };
      }
      return proc;
    });
  }
} 
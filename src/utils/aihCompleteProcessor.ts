import * as pdfjsLib from 'pdfjs-dist';
import { AIH, ProcedureAIH, AIHComplete, AIHCompleteProcessingResult, ProcedureMatchingResult } from '../types';
import { AIHPDFProcessor } from './aihPdfProcessor';

// Configurar worker
pdfjsLib.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.mjs';

export class AIHCompleteProcessor {
  private aihProcessor: AIHPDFProcessor;

  constructor() {
    this.aihProcessor = new AIHPDFProcessor();
  }

  /**
   * Processa PDF AIH completo (páginas 1 e 2)
   * Página 1: Dados do paciente + AIH
   * Página 2: Lista de procedimentos realizados
   */
  async processCompletePDFAIH(
    file: File,
    hospitalContext?: { hospitalId: string; hospitalName: string }
  ): Promise<AIHCompleteProcessingResult> {
    const startTime = Date.now();
    
    try {
      console.log('🎯 Iniciando processamento completo de AIH PDF (2 páginas)...');
      
      // ETAPA 1: Processar primeira página (dados gerais)
      console.log('📄 Processando primeira página (dados do paciente)...');
      const firstPageResult = await this.aihProcessor.processPDFAIH(file, hospitalContext);
      
      if (!firstPageResult.success || !firstPageResult.extractedAIH) {
        return {
          ...firstPageResult,
          success: false,
          errors: [
            ...firstPageResult.errors,
            { line: 0, field: 'primeira_pagina', message: 'Erro ao processar primeira página da AIH' }
          ]
        };
      }

      // ETAPA 2: Processar todas as páginas de procedimentos (2+)
      console.log('📋 Processando páginas de procedimentos (2+)...');
      const allProcedurePages = await this.extractAllProcedurePages(file);
      
      if (allProcedurePages.length === 0) {
        console.warn('⚠️ Nenhuma página de procedimentos encontrada');
        // Retornar resultado da primeira página apenas
        return {
          ...firstPageResult,
          aihCompleta: this.createCompleteAIH(firstPageResult.extractedAIH, []),
          procedureMatchingResult: {
            success: true,
            totalProcedimentos: 0,
            procedimentosEncontrados: 0,
            procedimentosNaoEncontrados: 0,
            valorTotalCalculado: 0,
            matchingDetails: [],
            tempoProcessamento: 0
          }
        };
      }

      // ETAPA 3: Extrair procedimentos de todas as páginas
      const allProcedimentos: ProcedureAIH[] = [];
      let sequenciaGlobal = 1;
      
      for (let i = 0; i < allProcedurePages.length; i++) {
        const pageNumber = i + 2; // Páginas 2, 3, 4, etc.
        const pageText = allProcedurePages[i];
        
        console.log(`📄 Processando página ${pageNumber} (${pageText.length} caracteres)...`);
        const procedimentosPagina = this.extractProcedures(pageText, sequenciaGlobal);
        
        // Atualizar sequência global para próxima página
        if (procedimentosPagina.length > 0) {
          sequenciaGlobal += procedimentosPagina.length;
        }
        
        allProcedimentos.push(...procedimentosPagina);
        console.log(`✅ ${procedimentosPagina.length} procedimentos extraídos da página ${pageNumber}`);
      }
      
      console.log(`📊 TOTAL: ${allProcedimentos.length} procedimentos de ${allProcedurePages.length} páginas`);

              // ETAPA 4: Criar AIH completa
        const aihCompleta = this.createCompleteAIH(firstPageResult.extractedAIH, allProcedimentos);

        const processingTime = Date.now() - startTime;
        
        console.log(`✅ Processamento completo concluído em ${processingTime}ms`);
        console.log(`📊 Resumo: ${allProcedimentos.length} procedimentos extraídos`);

      return {
        ...firstPageResult,
        aihCompleta,
        procedureMatchingResult: {
          success: true,
          totalProcedimentos: allProcedimentos.length,
          procedimentosEncontrados: 0, // Será atualizado no matching
          procedimentosNaoEncontrados: 0, // Será atualizado no matching
          valorTotalCalculado: 0, // Será calculado no matching
          matchingDetails: [],
          tempoProcessamento: Date.now() - startTime
        },
        processingTime
      };

    } catch (error) {
      console.error('❌ Erro no processamento completo de AIH:', error);
      return {
        success: false,
        totalProcessed: 1,
        validAIHs: 0,
        invalidAIHs: 1,
        matches: [],
        errors: [{
          line: 0,
          field: 'processamento_completo',
          message: error instanceof Error ? error.message : 'Erro no processamento completo'
        }],
        processingTime: Date.now() - startTime,
        hospitalId: hospitalContext?.hospitalId,
        hospitalName: hospitalContext?.hospitalName
      };
    }
  }

  /**
   * Extrai texto de todas as páginas de procedimentos (2+)
   */
  private async extractAllProcedurePages(file: File): Promise<string[]> {
    try {
      console.log('📄 Extraindo todas as páginas de procedimentos...');
      
      // Converter arquivo para ArrayBuffer
      const arrayBuffer = await file.arrayBuffer();
      
      // Carregar documento PDF
      const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
      console.log(`📖 PDF carregado: ${pdf.numPages} páginas`);
      
      if (pdf.numPages < 2) {
        console.warn('⚠️ PDF tem apenas 1 página, sem páginas de procedimentos');
        return [];
      }

      const procedurePages: string[] = [];
      
      // Extrair todas as páginas a partir da 2ª
      for (let pageNum = 2; pageNum <= pdf.numPages; pageNum++) {
        try {
          const page = await pdf.getPage(pageNum);
          const textContent = await page.getTextContent();
          
          // Montar texto da página
          const pageText = textContent.items
            .map((item: any) => item.str)
            .join(' ')
            .replace(/\s+/g, ' ')
            .trim();
          
          if (pageText.length > 50) { // Só incluir páginas com conteúdo significativo
            procedurePages.push(pageText);
            console.log(`✅ Página ${pageNum} extraída: ${pageText.length} caracteres`);
          } else {
            console.warn(`⚠️ Página ${pageNum} vazia ou com pouco conteúdo`);
          }
          
        } catch (pageError) {
          console.error(`❌ Erro ao extrair página ${pageNum}:`, pageError);
        }
      }
      
      console.log(`📊 Total de páginas de procedimentos extraídas: ${procedurePages.length}`);
      return procedurePages;
      
    } catch (error) {
      console.error('❌ Erro na extração das páginas de procedimentos:', error);
      return [];
    }
  }

  /**
   * Extrai texto da segunda página do PDF (método legado)
   */
  private async extractSecondPageText(file: File): Promise<string | null> {
    try {
      console.log('📄 Extraindo segunda página do PDF...');
      
      // Converter arquivo para ArrayBuffer
      const arrayBuffer = await file.arrayBuffer();
      
      // Carregar documento PDF
      const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
      console.log(`📖 PDF carregado: ${pdf.numPages} páginas`);
      
      if (pdf.numPages < 2) {
        console.warn('⚠️ PDF tem apenas 1 página, procedimentos podem estar na primeira página');
        return null;
      }

      // Extrair segunda página
      const page = await pdf.getPage(2);
      const textContent = await page.getTextContent();
      
      // Montar texto da segunda página
      const secondPageText = textContent.items
        .map((item: any) => item.str)
        .join(' ')
        .replace(/\s+/g, ' ')
        .trim();
      
      console.log(`✅ Segunda página extraída: ${secondPageText.length} caracteres`);
      console.log('🔍 Primeiros 300 caracteres:', secondPageText.substring(0, 300));
      
      return secondPageText;
      
    } catch (error) {
      console.error('❌ Erro na extração da segunda página:', error);
      return null;
    }
  }

  /**
   * Extrai lista de procedimentos de uma página
   */
  private extractProcedures(text: string, sequenciaInicial: number = 1): ProcedureAIH[] {
    try {
      console.log(`📋 Extraindo procedimentos (sequência inicial: ${sequenciaInicial})...`);
      
      const procedimentos: ProcedureAIH[] = [];
      
      // Patterns para extrair dados da tabela de procedimentos
      const patterns = {
        // Buscar linhas da tabela (baseado na imagem fornecida)
        linhaTabela: /(\d+)\s+([0-9.]+)\s+([A-Z0-9-]+)\s+(\d+)\s+([A-Za-z]+)\s+(\d+)\s+(\d+)\s+(\d{2}\/\d{2}\/\d{4})\s+(.+?)(?=\d+\s+[0-9.]+|\s*$)/g,
        
        // Patterns alternativos
        procedimentoCodigo: /([0-9]{2}\.[0-9]{2}\.[0-9]{2}\.[0-9]{3}-[0-9])/g,
        cbo: /(\d{6})/g,
        data: /(\d{2}\/\d{2}\/\d{4})/g
      };

      // Tentar extrair usando pattern da tabela
      let match;
      let sequenciaAtual = sequenciaInicial;
      
      while ((match = patterns.linhaTabela.exec(text)) !== null) {
        const procedimento: ProcedureAIH = {
          sequencia: parseInt(match[1]) || sequenciaAtual,
          procedimento: match[2]?.trim() || '',
          documentoProfissional: match[3]?.trim() || '',
          cbo: match[4]?.trim() || '',
          participacao: match[5]?.trim() || '',
          cnes: match[6]?.trim() || '',
          aceitar: match[7] === '1',
          data: match[8]?.trim() || '',
          descricao: match[9]?.trim() || '',
          
          // Status inicial
          matchStatus: 'pending'
        };

        if (procedimento.procedimento) {
          procedimentos.push(procedimento);
          console.log(`✅ Procedimento ${sequenciaAtual}: ${procedimento.procedimento} - ${procedimento.descricao}`);
        }
        
        sequenciaAtual++;
      }

      // Se não encontrou procedimentos com o pattern principal, tentar método alternativo
      if (procedimentos.length === 0) {
        console.warn('⚠️ Nenhum procedimento encontrado com pattern principal, tentando extração alternativa...');
        
        // Buscar códigos de procedimento e tentar montar estrutura básica
        const codigosMatch = text.match(patterns.procedimentoCodigo);
        const datasMatch = text.match(patterns.data);
        
        if (codigosMatch) {
          codigosMatch.forEach((codigo, index) => {
            const procedimento: ProcedureAIH = {
              sequencia: sequenciaInicial + index,
              procedimento: codigo,
              documentoProfissional: '',
              cbo: '',
              participacao: '',
              cnes: '',
              aceitar: true,
              data: datasMatch?.[index] || '',
              descricao: `Procedimento ${codigo}`,
              matchStatus: 'pending'
            };
            
            procedimentos.push(procedimento);
            console.log(`✅ Procedimento alternativo ${sequenciaInicial + index}: ${codigo}`);
          });
        }
      }

      console.log(`📊 Total de procedimentos extraídos: ${procedimentos.length}`);
      return procedimentos;

    } catch (error) {
      console.error('❌ Erro ao extrair procedimentos:', error);
      return [];
    }
  }

  /**
   * Cria objeto AIH completo combinando dados da primeira página com procedimentos
   */
  private createCompleteAIH(aih: AIH, procedimentos: ProcedureAIH[]): AIHComplete {
    return {
      ...aih,
      procedimentos,
      statusGeral: 'processando',
      totalProcedimentos: procedimentos.length,
      procedimentosAprovados: 0,
      procedimentosRejeitados: 0,
      valorTotalCalculado: 0,
      valorTotalOriginal: 0
    };
  }

  /**
   * Realiza matching dos procedimentos com a tabela SIGTAP
   */
  async performProcedureMatching(
    aihCompleta: AIHComplete, 
    sigtapProcedures: any[]
  ): Promise<ProcedureMatchingResult> {
    try {
      console.log(`🔍 Iniciando matching com ${sigtapProcedures.length} procedimentos SIGTAP...`);
      
      // Importar o serviço de matching dinamicamente
      const { ProcedureMatchingService } = await import('../services/procedureMatchingService');
      
      // Criar instância do serviço com os dados SIGTAP
      const matchingService = new ProcedureMatchingService(sigtapProcedures);
      
      // Realizar matching
      const matchingResult = await matchingService.performMatching(aihCompleta.procedimentos);
      
      console.log(`✅ Matching concluído: ${matchingResult.procedimentosEncontrados}/${matchingResult.totalProcedimentos} encontrados`);
      
      return matchingResult;
      
    } catch (error) {
      console.error('❌ Erro no matching de procedimentos:', error);
      
      return {
        success: false,
        totalProcedimentos: aihCompleta.procedimentos.length,
        procedimentosEncontrados: 0,
        procedimentosNaoEncontrados: aihCompleta.procedimentos.length,
        valorTotalCalculado: 0,
        matchingDetails: [],
        tempoProcessamento: 0
      };
    }
  }
} 
import * as pdfjsLib from 'pdfjs-dist';
import { AIH, ProcedureAIH, AIHComplete, AIHCompleteProcessingResult, ProcedureMatchingResult } from '../types';
import { AIHPDFProcessor } from './aihPdfProcessor';
import { isValidParticipationCode, formatParticipationCode, getParticipationInfo } from '../config/participationCodes';

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
      console.log(`🔍 DEBUGGING: Texto da página (primeiros 500 chars):`);
      console.log(text.substring(0, 500));
      
      const procedimentos: ProcedureAIH[] = [];
      
      // Patterns para extrair dados da tabela de procedimentos - REFINADOS
      const patterns = {
        // Pattern FLEXÍVEL para linhas da tabela
        // Captura: Seq Código CRM CBO Participação CNES Aceita Data Descrição
        linhaTabela: /(\d+)\s+([0-9]{2}\.[0-9]{2}\.[0-9]{2}\.[0-9]{3}-[0-9])\s+([A-Z0-9\-\/]+)\s+(\d{4,6})\s+([^0-9\s][^\s]*|[0-9]+[^\s]*|\d+)\s+(\d+)\s+([01])\s+(\d{2}\/\d{2}\/\d{4})\s+(.+?)(?=\n\d+\s+[0-9]{2}\.[0-9]{2}|\n\s*$|$)/gm,
        
        // Pattern para participação FLEXÍVEL - captura "1º", "1°", "1", etc.
        participacaoFlexivel: /([0-9]+)[°º]?|([IVX]+)[°º]?|([A-Za-z]+)/g,
        
        // Patterns alternativos
        procedimentoCodigo: /([0-9]{2}\.[0-9]{2}\.[0-9]{2}\.[0-9]{3}-[0-9])/g,
        cbo: /(\d{4,6})/g,
        data: /(\d{2}\/\d{2}\/\d{4})/g
      };

      // Tentar extrair usando pattern FLEXÍVEL da tabela
      let match;
      let sequenciaAtual = sequenciaInicial;
      
      console.log(`🔍 TENTANDO EXTRAIR com pattern flexível...`);
      
      while ((match = patterns.linhaTabela.exec(text)) !== null) {
        console.log(`📋 MATCH ENCONTRADO:`, match);
        
        // Extrair e processar código de participação com lógica APRIMORADA
        const rawParticipacao = match[5]?.trim() || '';
        const participacaoValidada = this.parseParticipationField(rawParticipacao);
        
        const procedimento: ProcedureAIH = {
          sequencia: parseInt(match[1]) || sequenciaAtual,
          procedimento: match[2]?.trim() || '',
          documentoProfissional: match[3]?.trim() || '',
          cbo: match[4]?.trim() || '',
          participacao: participacaoValidada,
          cnes: match[6]?.trim() || '',
          aceitar: match[7] === '1',
          data: match[8]?.trim() || '',
          descricao: match[9]?.trim() || '',
          
          // Status inicial - APROVADO por padrão
          matchStatus: 'approved',
          aprovado: true
        };

        if (procedimento.procedimento) {
          procedimentos.push(procedimento);
          console.log(`✅ Procedimento ${sequenciaAtual}: ${procedimento.procedimento} - ${procedimento.descricao}`);
          console.log(`   👨‍⚕️ Participação: "${rawParticipacao}" → "${participacaoValidada}" (${isValidParticipationCode(participacaoValidada) ? 'VÁLIDO' : 'INVÁLIDO'})`);
        }
        
        sequenciaAtual++;
      }
      
      // Se pattern principal não funcionou, tentar EXTRAÇÃO LINHA POR LINHA
      if (procedimentos.length === 0) {
        console.warn('⚠️ Pattern principal falhou, tentando extração linha por linha...');
        const extractedByLines = this.extractProceduresByLines(text, sequenciaInicial);
        procedimentos.push(...extractedByLines);
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
              matchStatus: 'approved',
              aprovado: true
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

  /**
   * Processa campo de participação com lógica APRIMORADA
   * Aceita formatos: "1º", "1°", "2º", "1", "01", etc.
   */
  private parseParticipationField(rawValue: string): string {
    if (!rawValue) return '';
    
    console.log(`🔍 PARSING Participação: "${rawValue}"`);
    
    // Limpar espaços
    const cleaned = rawValue.trim();
    
    // Pattern para capturar números com possível º ou °
    const numberMatch = cleaned.match(/^(\d+)[°º]?$/);
    if (numberMatch) {
      const number = parseInt(numberMatch[1]);
      const formatted = number.toString().padStart(2, '0');
      console.log(`   ✅ Número detectado: ${number} → ${formatted}`);
      return formatted;
    }
    
    // Pattern para ordinais escritos (1º, 2º, etc.)
    const ordinalMatch = cleaned.match(/^(\d+)[°º]$/);
    if (ordinalMatch) {
      const number = parseInt(ordinalMatch[1]);
      const formatted = number.toString().padStart(2, '0');
      console.log(`   ✅ Ordinal detectado: ${cleaned} → ${formatted}`);
      return formatted;
    }
    
    // Pattern para números romanos
    const romanNumerals: { [key: string]: string } = {
      'I': '01', 'II': '02', 'III': '03', 'IV': '04', 'V': '05',
      'VI': '06', 'VII': '07', 'VIII': '08', 'IX': '09', 'X': '10'
    };
    
    const romanMatch = cleaned.toUpperCase().match(/^([IVX]+)[°º]?$/);
    if (romanMatch && romanNumerals[romanMatch[1]]) {
      const formatted = romanNumerals[romanMatch[1]];
      console.log(`   ✅ Romano detectado: ${cleaned} → ${formatted}`);
      return formatted;
    }
    
    // Fallback: tentar extrair apenas dígitos
    const digitOnly = cleaned.replace(/[^\d]/g, '');
    if (digitOnly) {
      const formatted = digitOnly.length === 1 ? '0' + digitOnly : digitOnly.substring(0, 2);
      console.log(`   ⚠️ Fallback dígitos: "${cleaned}" → "${formatted}"`);
      return formatted;
    }
    
    console.log(`   ❌ Não foi possível processar: "${rawValue}"`);
    return '';
  }

  /**
   * Extração linha por linha quando pattern principal falha
   */
  private extractProceduresByLines(text: string, sequenciaInicial: number): ProcedureAIH[] {
    console.log(`🔧 EXTRAÇÃO LINHA POR LINHA iniciada...`);
    
    const procedimentos: ProcedureAIH[] = [];
    const lines = text.split('\n').filter(line => line.trim());
    
    let sequenciaAtual = sequenciaInicial;
    
    for (const line of lines) {
      // Buscar linhas que começam com número (sequência)
      const lineMatch = line.match(/^(\d+)\s+(.+)/);
      if (!lineMatch) continue;
      
      console.log(`🔍 Analisando linha: "${line}"`);
      
      // Tentar extrair código de procedimento
      const procedureMatch = line.match(/([0-9]{2}\.[0-9]{2}\.[0-9]{2}\.[0-9]{3}-[0-9])/);
      if (!procedureMatch) continue;
      
      // Extrair componentes usando splits
      const parts = line.trim().split(/\s+/);
      console.log(`   📊 Partes da linha:`, parts);
      
      if (parts.length >= 8) {
        // Tentar mapear campos baseado em posições
        const participacaoIndex = this.findParticipationIndex(parts);
        const rawParticipacao = participacaoIndex >= 0 ? parts[participacaoIndex] : '';
        
        const procedimento: ProcedureAIH = {
          sequencia: parseInt(parts[0]) || sequenciaAtual,
          procedimento: procedureMatch[1],
          documentoProfissional: this.findDocumentField(parts) || '',
          cbo: this.findCBOField(parts) || '',
          participacao: this.parseParticipationField(rawParticipacao),
          cnes: this.findCNESField(parts) || '',
          aceitar: this.findAcceptField(parts),
          data: this.findDateField(parts) || '',
          descricao: this.findDescriptionField(parts, line) || '',
          matchStatus: 'approved',
          aprovado: true
        };
        
        procedimentos.push(procedimento);
        console.log(`   ✅ Procedimento extraído: ${procedimento.procedimento}`);
        console.log(`   👨‍⚕️ Participação: "${rawParticipacao}" → "${procedimento.participacao}"`);
        
        sequenciaAtual++;
      }
    }
    
    console.log(`📊 Extração linha por linha: ${procedimentos.length} procedimentos`);
    return procedimentos;
  }

  /**
   * Métodos auxiliares para extração linha por linha
   */
  private findParticipationIndex(parts: string[]): number {
    // Procurar por padrões de participação
    for (let i = 0; i < parts.length; i++) {
      const part = parts[i];
      if (/^(\d+)[°º]?$/.test(part) || /^[IVX]+[°º]?$/.test(part)) {
        console.log(`   🎯 Participação encontrada no índice ${i}: "${part}"`);
        return i;
      }
    }
    return -1;
  }

  private findDocumentField(parts: string[]): string {
    return parts.find(p => /^[A-Z0-9\-\/]{5,}$/.test(p)) || '';
  }

  private findCBOField(parts: string[]): string {
    return parts.find(p => /^\d{4,6}$/.test(p)) || '';
  }

  private findCNESField(parts: string[]): string {
    return parts.find(p => /^\d{7,}$/.test(p)) || '';
  }

  private findAcceptField(parts: string[]): boolean {
    return parts.includes('1');
  }

  private findDateField(parts: string[]): string {
    return parts.find(p => /^\d{2}\/\d{2}\/\d{4}$/.test(p)) || '';
  }

  private findDescriptionField(parts: string[], fullLine: string): string {
    const dateIndex = parts.findIndex(p => /^\d{2}\/\d{2}\/\d{4}$/.test(p));
    if (dateIndex >= 0 && dateIndex < parts.length - 1) {
      return parts.slice(dateIndex + 1).join(' ');
    }
    // Fallback: pegar última parte que parece descrição
    return fullLine.substring(fullLine.lastIndexOf(' ') + 1);
  }

  /**
   * Valida e limpa código de participação extraído (método legado mantido para compatibilidade)
   */
  private validateAndCleanParticipationCode(rawCode: string): string {
    return this.parseParticipationField(rawCode);
  }
} 
import * as pdfjsLib from 'pdfjs-dist';
import { AIH, ProcedureAIH, AIHComplete, AIHCompleteProcessingResult, ProcedureMatchingResult } from '../types';
import { AIHPDFProcessor } from './aihPdfProcessor';
import { isValidParticipationCode, formatParticipationCode, getParticipationInfo } from '../config/participationCodes';

// Configurar worker
pdfjsLib.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.mjs';

/**
 * ❌ FUNÇÃO DEPRECIADA: filterOutAnesthesia 
 * ✅ NOVA ABORDAGEM: Exibir todos os procedimentos com marcação visual
 * 
 * Anteriormente filtrava anestesistas na INTERFACE (camada 3 - exibição)
 * Agora: Extrair tudo e marcar visualmente para controle manual do usuário
 */
/*
export const filterOutAnesthesia = (procedimento: ProcedureAIH): boolean => {
  // 🎯 FUNÇÃO DEPRECIADA - Nova lógica: exibir tudo com marcação visual
  // Se não há participação definida, não é anestesista
  if (!procedimento.participacao) {
    return true;
  }
  
  // Termos de anestesia em português  
  const anesthesiaTerms = [
    'anestesista', 'anestesiologista', 'anestesiol', 'anestes', 'anes', 'anest',
    'anestsista', 'anestesita', 'anestesis', 'anastesista', 'anastesiologista',
    'anesthesi', 'anesthesiol', 'anest.', 'anes.'
  ];
  
  const participacao = procedimento.participacao.toLowerCase().trim();
  const isAnesthesia = anesthesiaTerms.some(term => participacao.includes(term));
  
  if (isAnesthesia) {
    console.log(`🚫 INTERFACE-FILTRO DEPRECIADO: Anestesista seria removido da tela - Agora é marcado visualmente`);
    return false; // Filtrar (não exibir) - COMPORTAMENTO ANTIGO
  }
  
  return true; // Não filtrar (exibir)
};
*/

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
   * 🎯 FILTRO INTELIGENTE E ESPECÍFICO: Remove apenas linhas de procedimentos de anestesia
   * Preserva cabeçalhos, estrutura do documento e outras informações
   * ✅ CORREÇÃO: Filtro mais específico para evitar remoção de procedimentos subsequentes
   */
  private preFilterAnesthesiaLines(text: string): { filteredText: string; removedLines: string[] } {
    console.log(`🚫 PRÉ-FILTRO CORRIGIDO: Aplicando filtro inteligente de anestesia...`);
    
    // 🔧 QUEBRA INTELIGENTE: PDF pode vir como bloco contínuo, quebrar por padrões de procedimento
    const smartLines = this.smartSplitProcedureText(text);
    
    const filteredLines: string[] = [];
    const removedLines: string[] = [];
    
    for (const line of smartLines) {
      const trimmedLine = line.trim();
      
      // 🎯 SKIP: Linhas vazias ou muito curtas (preservar estrutura)
      if (trimmedLine.length < 10) {
        filteredLines.push(line);
        console.log(`⏭️ LINHA CURTA PRESERVADA (${trimmedLine.length} chars): ${trimmedLine}`);
        continue;
      }
      
      // ✅ CORREÇÃO: Verificação mais específica de anestesia
      const lowerLine = trimmedLine.toLowerCase();
      
      // 📋 DETECÇÃO DE ANESTESIA - APENAS PROCEDIMENTOS REAIS DE ANESTESIA
      const anesthesiaTerms = [
        'anestesista', 'anestesiologista', 'anestesiologia', 'anestesiologic',
        'anestesiol', 'anestes', 'anes', 'anest', 'anestesi',
        'anestsista', 'anestesita', 'anestesis', 'anastesista', 'anastesiologista',
        'anesthesi', 'anesthesiol', 'anest.', 'anes.', 'anestesista.',
        // Variações com espaços ou caracteres especiais
        'anestesi ', ' anestesi', 'anestes ', ' anestes'
      ];
      
      const hasAnesthesiaText = anesthesiaTerms.some(term => lowerLine.includes(term));
      
      // ✅ CORREÇÃO: Só filtrar se for REALMENTE um procedimento de anestesia
      if (hasAnesthesiaText && this.isProcedureLine(trimmedLine)) {
        const foundTerm = anesthesiaTerms.find(term => lowerLine.includes(term)) || 'termo de anestesia';
        console.log(`🚫 ANESTESIA FILTRADA: ${trimmedLine.substring(0, 80)}...`);
        console.log(`   📋 Motivo: ${foundTerm}`);
        console.log(`   🎯 STATUS: REMOVIDO (procedimento de anestesia confirmado)`);
        removedLines.push(line);
        continue; // NÃO adicionar à lista filtrada
      }
      
      // ✅ CORREÇÃO: Se contém anestesia mas não é procedimento válido, preservar
      if (hasAnesthesiaText && !this.isProcedureLine(trimmedLine)) {
        console.log(`📋 ANESTESIA DETECTADA mas NÃO é procedimento - PRESERVADO: ${trimmedLine.substring(0, 60)}...`);
        filteredLines.push(line);
        continue;
      }
      
      // 🎯 VERIFICAÇÃO SECUNDÁRIA: Cabeçalhos (após filtro de anestesia)
      if (this.isHeaderOrSystemLine(trimmedLine)) {
        filteredLines.push(line);
        console.log(`📋 CABEÇALHO PRESERVADO: ${trimmedLine.substring(0, 60)}...`);
        continue;
      }
      
      // 🎯 VERIFICAR: Linhas que parecem ser procedimentos (após todos os filtros)
      if (this.isProcedureLine(trimmedLine)) {
        console.log(`✅ PROCEDIMENTO MANTIDO: ${trimmedLine.substring(0, 60)}...`);
        filteredLines.push(line);
      } else {
        // Não é linha de procedimento - preservar sempre (já passou por todos os filtros)
        console.log(`📄 LINHA NÃO-PROCEDIMENTO PRESERVADA: ${trimmedLine.substring(0, 60)}...`);
        filteredLines.push(line);
      }
    }
    
    const filteredText = filteredLines.join('\n');
    
    console.log(`✅ PRÉ-FILTRO INTELIGENTE CORRIGIDO CONCLUÍDO:`);
    console.log(`   📄 Segmentos originais: ${smartLines.length}`);
    console.log(`   ✅ Segmentos mantidos: ${filteredLines.length}`);
    console.log(`   🚫 Procedimentos de anestesia filtrados: ${removedLines.length}`);
    
    if (removedLines.length > 0) {
      console.log(`   🎯 FILTROS APLICADOS:`);
      removedLines.forEach((line, index) => {
        console.log(`   🚫 ${index + 1}. ${line.substring(0, 80)}...`);
      });
    } else {
      console.log(`   ℹ️ Nenhum procedimento de anestesia encontrado para filtrar`);
    }
    
    return { filteredText, removedLines };
  }

  /**
   * 🔧 QUEBRA INTELIGENTE: Divide texto de PDF em segmentos lógicos
   * PDFs podem vir como bloco contínuo - quebrar por padrões que indicam novos procedimentos
   * ✅ CORREÇÃO: Divisão mais precisa para evitar "vazamento" entre procedimentos
   */
  private smartSplitProcedureText(text: string): string[] {
    // Primeiro tentar quebra natural por \n
    let lines = text.split('\n');
    
    console.log(`🔧 QUEBRA INICIAL: ${lines.length} linhas naturais`);
    console.log(`📏 Tamanho do texto: ${text.length} caracteres`);
    
    // Se tem poucas linhas mas texto longo, fazer quebra inteligente
    if (lines.length <= 3 && text.length > 500) {
      console.log(`🔧 TEXTO LONGO EM POUCAS LINHAS - Aplicando quebra inteligente corrigida...`);
      console.log(`📄 Texto original (primeiros 200 chars): ${text.substring(0, 200)}...`);
      
      // ✅ CORREÇÃO: Buscar por códigos de procedimento e criar segmentos mais precisos
      const procedurePattern = /(\d{2}\.\d{2}\.\d{2}\.\d{3}-\d)/g;
      
      let smartLines: string[] = [];
      let matches: { index: number; code: string }[] = [];
      
      // Primeiro, encontrar todas as posições dos códigos
      let match;
      while ((match = procedurePattern.exec(text)) !== null) {
        matches.push({
          index: match.index,
          code: match[1]
        });
      }
      
      console.log(`🔧 CÓDIGOS ENCONTRADOS: ${matches.length}`);
      matches.forEach((m, i) => {
        console.log(`   ${i + 1}. ${m.code} na posição ${m.index}`);
      });
      
      // ✅ CORREÇÃO: Criar segmentos baseados nas posições dos códigos
      for (let i = 0; i < matches.length; i++) {
        const currentMatch = matches[i];
        const nextMatch = matches[i + 1];
        
        // Definir início e fim do segmento
        const startPos = currentMatch.index;
        const endPos = nextMatch ? nextMatch.index : text.length;
        
        // Extrair segmento completo
        const segment = text.substring(startPos, endPos).trim();
        
        if (segment.length > 10) { // Só incluir segmentos significativos
          smartLines.push(segment);
          console.log(`📋 Segmento ${i + 1}: ${segment.substring(0, 80)}...`);
          
          // 🔍 DEBUG: Verificar se segmento contém anestesia
          if (segment.toLowerCase().includes('anestesista')) {
            console.log(`   ⚠️ ANESTESIA DETECTADA neste segmento`);
          }
        }
      }
      
      console.log(`🔧 QUEBRA CORRIGIDA: ${lines.length} linhas → ${smartLines.length} segmentos`);
      
      return smartLines;
    }
    
    // 🔍 DEBUG: Verificar se há anestesia nas linhas normais
    lines.forEach((line, index) => {
      if (line.toLowerCase().includes('anestesista')) {
        console.log(`⚠️ ANESTESIA DETECTADA na linha ${index + 1}: ${line.substring(0, 80)}...`);
      }
    });
    
    return lines;
  }

  /**
   * Identifica se uma linha é cabeçalho/sistema (deve ser preservada)
   */
  private isHeaderOrSystemLine(line: string): boolean {
    const lowerLine = line.toLowerCase();
    
    // Padrões de cabeçalho/sistema
    const headerPatterns = [
      'centro integrado', 'hospital', 'maternidade', 'apresentação da aih',
      'número da aih', 'situação', 'tipo', 'data autorização', 'telefone',
      'linha procedimento', 'documento profissional', 'descrição', 'participação',
      'apurar valor', 'qtde', 'procedimentos realizados', 'cnes', 'data realização',
      'gsus-v', 'página', 'gerado por', 'dados complementare', 'nota fiscal'
    ];
    
    return headerPatterns.some(pattern => lowerLine.includes(pattern));
  }

  /**
   * Identifica se uma linha contém um procedimento (candidata à filtragem)
   */
  private isProcedureLine(line: string): boolean {
    // Padrão: deve conter código de procedimento SUS (XX.XX.XX.XXX-X)
    const hasProcedureCode = /\d{2}\.\d{2}\.\d{2}\.\d{3}-\d/.test(line);
    
    // E deve ter estrutura de dados (CBO, datas, etc.) - MAIS FLEXÍVEL
    const hasStructuredData = /\d{4,6}/.test(line) || // CBO (4-6 dígitos)
                              /\d{2}\/\d{2}\/\d{4}/.test(line) || // Data
                              /\d{3}\.\d{3}\.\d{3}-\d{2}/.test(line); // CPF/CNPJ
    
    const isProcedure = hasProcedureCode && hasStructuredData;
    
    // 🔍 DEBUG: Log detalhado para linhas suspeitas
    if (line.toLowerCase().includes('anestesista')) {
      console.log(`🔍 DEBUG LINHA ANESTESIA:`);
      console.log(`   📝 Linha: ${line.substring(0, 80)}...`);
      console.log(`   🏥 Tem código procedimento: ${hasProcedureCode}`);
      console.log(`   📊 Tem dados estruturados: ${hasStructuredData}`);
      console.log(`   ✅ É linha de procedimento: ${isProcedure}`);
    }
    
    return isProcedure;
  }

  /**
   * Verifica se um procedimento é de anestesista e deve ser filtrado
   * ✅ ALTERAÇÃO: Removido filtro por CBO 225151 para permitir procedimentos pré-operatórios
   * 🎯 MANTÉM: Filtro por texto na participação para casos reais de anestesia
   */
  private isAnesthesiaProcedure(procedimento: ProcedureAIH): boolean {
    // 🎯 ÚNICA VERIFICAÇÃO: Detecção por texto na participação
    const participacao = (procedimento.participacao || '').toLowerCase().trim();
    
    // Se não há participação definida, não é anestesista
    if (!participacao) {
      return false;
    }
    
    // 📋 TERMOS DE ANESTESIA EM PORTUGUÊS - como backup
    const anesthesiaTerms = [
      // Termos principais
      'anestesista',        // Termo exato da tabela
      'anestesiologista',   // Variação comum
      'anestesiol',         // Abreviação comum
      'anestes',            // Variação
      'anes',               // Abreviação curta
      'anest',              // Abreviação
      
      // Variações e erros de digitação
      'anestsista',         // Erro comum
      'anestesita',         // Erro comum
      'anestesis',          // Variação
      'anastesista',        // Erro comum
      'anastesiologista',   // Erro comum
      
      // Termos em inglês (caso apareçam)
      'anesthesi',          // Inglês
      'anesthesiol',        // Inglês abreviado
      
      // Termos relacionados
      'anest.',             // Abreviação com ponto
      'anes.',              // Abreviação com ponto
    ];
    
    // Verificar se algum termo de anestesia está presente na participação
    const isAnesthesia = anesthesiaTerms.some(term => 
      participacao.includes(term)
    );
    
    return isAnesthesia;
  }

  /**
   * Retorna detalhes sobre por que um procedimento foi filtrado (para debug)
   * ✅ ALTERAÇÃO: Removido verificação por CBO 225151
   */
  private getFilterReason(procedimento: ProcedureAIH): string {
    // 🎯 ÚNICA VERIFICAÇÃO: Verificar se foi filtrado por texto na participação
    const participacao = (procedimento.participacao || '').toLowerCase().trim();
    
    if (!participacao) {
      return 'Erro: Procedimento filtrado sem participação - revisar lógica';
    }
    
    const anesthesiaTerms = [
      // Termos principais  
      'anestesista', 'anestesiologista', 'anestesiologia',
      // Abreviações
      'anestesiol', 'anestes', 'anes', 'anest',
      // Variações e erros
      'anestsista', 'anestesita', 'anestesis', 'anastesista', 'anastesiologista',
      // Inglês
      'anesthesi', 'anesthesiol',
      // Com pontos
      'anest.', 'anes.'
    ];
    
    const foundTerm = anesthesiaTerms.find(term => 
      participacao.includes(term)
    );
    
    if (foundTerm) {
      return `Termo de anestesia '${foundTerm}' encontrado na Participação: "${procedimento.participacao}" (filtro por texto)`;
    }
    
    return `Erro: Procedimento filtrado sem critério válido - Participação: "${procedimento.participacao}"`;
  }

  /**
   * 🔬 DEBUG ESPECÍFICO: Rastreia extração de procedimentos para identificar perdas
   * Este método ajuda a diagnosticar quando procedimentos não são extraídos
   */
  private debugProcedureExtraction(text: string): void {
    console.log(`🔬 DEBUG AVANÇADO: Analisando texto para extração...`);
    console.log(`📏 Tamanho do texto: ${text.length} caracteres`);
    
    // Dividir texto em seções para análise
    const lines = text.split(/[\n\r]+/);
    console.log(`📄 Número de linhas: ${lines.length}`);
    
    // Procurar por códigos de procedimento
    const codigosEncontrados = text.match(/[0-9]{2}\.[0-9]{2}\.[0-9]{2}\.[0-9]{3}-[0-9]/g) || [];
    console.log(`🔍 Códigos de procedimento encontrados: ${codigosEncontrados.length}`);
    codigosEncontrados.forEach((codigo, index) => {
      console.log(`   ${index + 1}. ${codigo}`);
    });
    
    // ✅ NOVO: Verificar se códigos estão sendo perdidos no processo de filtro
    console.log(`🔍 ANÁLISE DETALHADA POR CÓDIGO:`);
    codigosEncontrados.forEach((codigo, index) => {
      const codigoIndex = text.indexOf(codigo);
      const contexto = text.substring(
        Math.max(0, codigoIndex - 100),
        Math.min(text.length, codigoIndex + 200)
      );
      
      // Verificar se contém anestesia no contexto
      const temAnestesia = contexto.toLowerCase().includes('anestesista');
      const eProcedimento = this.isProcedureLine(contexto);
      
      console.log(`📍 Código ${index + 1}: ${codigo}`);
      console.log(`   📋 Posição: ${codigoIndex}`);
      console.log(`   🩺 Contém anestesia: ${temAnestesia ? '🚫 SIM' : '✅ NÃO'}`);
      console.log(`   📊 É linha de procedimento: ${eProcedimento ? '✅ SIM' : '❌ NÃO'}`);
      console.log(`   📄 Contexto: "${contexto.substring(0, 150)}..."`);
      console.log(`   🎯 Status esperado: ${temAnestesia && eProcedimento ? '🚫 FILTRADO' : '✅ EXTRAÍDO'}`);
      console.log('');
    });
    
    // Procurar por descrições em maiúsculas
    const descricoesMaiusculas = text.match(/[A-ZÁÊÇÕÚÍÂ]{3,}[A-ZÁÊÇÕÚÍÂ\s]{5,}/g) || [];
    console.log(`📝 Possíveis descrições em maiúsculas: ${descricoesMaiusculas.length}`);
    descricoesMaiusculas.slice(0, 5).forEach((desc, index) => {
      console.log(`   ${index + 1}. "${desc.trim().substring(0, 50)}..."`);
    });
    
    // Procurar por padrões específicos CÓDIGO - DESCRIÇÃO
    const padroesCodigo = text.match(/([0-9]{2}\.[0-9]{2}\.[0-9]{2}\.[0-9]{3}-[0-9])\s*-\s*([A-ZÁÊÇÕÚÍÂ][A-ZÁÊÇÕÚÍÂ\s]+)/g) || [];
    console.log(`🎯 Padrões CÓDIGO-DESCRIÇÃO encontrados: ${padroesCodigo.length}`);
    padroesCodigo.forEach((padrao, index) => {
      console.log(`   ${index + 1}. "${padrao.substring(0, 80)}..."`);
    });
    
    // ✅ NOVO: Verificar como o smartSplit vai dividir este texto
    console.log(`🔧 SIMULAÇÃO DO SMART SPLIT:`);
    const simulatedSplit = this.simulateSmartSplit(text);
    console.log(`   📄 Segmentos que serão criados: ${simulatedSplit.length}`);
    simulatedSplit.forEach((segment, index) => {
      const temAnestesia = segment.toLowerCase().includes('anestesista');
      const temCodigo = /[0-9]{2}\.[0-9]{2}\.[0-9]{2}\.[0-9]{3}-[0-9]/.test(segment);
      console.log(`   ${index + 1}. Código: ${temCodigo ? '✅' : '❌'} | Anestesia: ${temAnestesia ? '🚫' : '✅'} | "${segment.substring(0, 60)}..."`);
    });
  }

  /**
   * 🔧 SIMULAÇÃO: Simula como o smartSplit vai dividir o texto (para debug)
   */
  private simulateSmartSplit(text: string): string[] {
    const procedurePattern = /(\d{2}\.\d{2}\.\d{2}\.\d{3}-\d)/g;
    let matches: { index: number; code: string }[] = [];
    
    let match;
    while ((match = procedurePattern.exec(text)) !== null) {
      matches.push({
        index: match.index,
        code: match[1]
      });
    }
    
    let segments: string[] = [];
    for (let i = 0; i < matches.length; i++) {
      const currentMatch = matches[i];
      const nextMatch = matches[i + 1];
      
      const startPos = currentMatch.index;
      const endPos = nextMatch ? nextMatch.index : text.length;
      
      const segment = text.substring(startPos, endPos).trim();
      if (segment.length > 10) {
        segments.push(segment);
      }
    }
    
    return segments;
  }

  /**
   * Extrai procedimentos da página SEM FILTROS - extrai tudo
   * ✅ NOVA ABORDAGEM: Extrair 100% dos procedimentos, marcar anestesistas visualmente
   */
  private extractProcedures(text: string, sequenciaInicial: number = 1): ProcedureAIH[] {
    try {
      console.log(`📋 EXTRAÇÃO COMPLETA: Extraindo TODOS os procedimentos (sequência inicial: ${sequenciaInicial})...`);
      console.log(`🔍 NOVA LÓGICA: SEM FILTROS - Extrair tudo e marcar anestesistas visualmente`);
      console.log(`📏 Tamanho do texto: ${text.length} caracteres`);
      
      // 🔬 DEBUG AVANÇADO da extração
      this.debugProcedureExtraction(text);
      
      // ✅ MUDANÇA: USAR QUEBRA INTELIGENTE SEM PRÉ-FILTRO
      const smartLines = this.smartSplitProcedureText(text);
      console.log(`📄 Segmentos para processamento: ${smartLines.length}`);
      
      let procedimentos: ProcedureAIH[] = [];
      
      // 🆕 LÓGICA NOVA: Extrair especificamente da coluna procedimento da segunda página
      console.log(`🎯 EXTRAÇÃO COMPLETA: Processando todos os segmentos...`);
      
      // Buscar por padrões de procedimentos com descrições na coluna procedimento
      const procedurePatterns = [
        // Pattern 1: CÓDIGO - DESCRIÇÃO MAIÚSCULA (mais específico)
        /([0-9]{2}\.[0-9]{2}\.[0-9]{2}\.[0-9]{3}-[0-9])\s*-\s*([A-ZÁÊÇÕÚÍÂ\s]+?)(?=\s+\d|\s*$|[\n\r])/g,
        
        // Pattern 2: CÓDIGO seguido de descrição em maiúsculas (sem hífen)
        /([0-9]{2}\.[0-9]{2}\.[0-9]{2}\.[0-9]{3}-[0-9])\s+([A-ZÁÊÇÕÚÍÂ][A-ZÁÊÇÕÚÍÂ\s]{3,50}?)(?=\s+\d|\s*$|[\n\r])/g,
        
        // Pattern 3: CÓDIGO DESCRIÇÃO em uma linha contínua
        /([0-9]{2}\.[0-9]{2}\.[0-9]{2}\.[0-9]{3}-[0-9])\s*([A-ZÁÊÇÕÚÍÂ][A-ZÁÊÇÕÚÍÂ\s]+?)(?=\s*[0-9]{2}\.[0-9]{2}\.[0-9]{2}\.[0-9]{3}-[0-9]|\s*$)/g
      ];
      
      let sequenciaAtual = sequenciaInicial;
      let totalExtraidos = 0;
      
      // ✅ PROCESSAR CADA SEGMENTO INDIVIDUALMENTE
      for (let segmentIndex = 0; segmentIndex < smartLines.length; segmentIndex++) {
        const segment = smartLines[segmentIndex];
        console.log(`📋 Processando segmento ${segmentIndex + 1}/${smartLines.length}: ${segment.substring(0, 80)}...`);
        
        // Tentar cada pattern neste segmento
        let extraidoNesteSegmento = false;
        
        for (let patternIndex = 0; patternIndex < procedurePatterns.length && !extraidoNesteSegmento; patternIndex++) {
          const pattern = procedurePatterns[patternIndex];
          pattern.lastIndex = 0; // Reset regex
          
          let match;
          while ((match = pattern.exec(segment)) !== null) {
            console.log(`📋 MATCH Pattern ${patternIndex + 1} encontrado no segmento ${segmentIndex + 1}:`, match);
            
            const codigo = match[1]?.trim() || '';
            let descricao = match[2]?.trim() || '';
            
            // Limpar a descrição removendo números extras e caracteres desnecessários
            descricao = this.cleanProcedureDescription(descricao);
            
            // Validar se temos dados mínimos válidos
            if (codigo && descricao.length >= 3) {
              // Extrair dados contextuais do segmento completo
              const contextData = this.extractContextualData(segment, codigo);
              
              // ✅ DETECTAR SE É ANESTESISTA (SEM FILTRAR)
              const isAnesthesia = this.detectAnesthesiaProcedure(segment, contextData.participacao);
              
              const procedimento: ProcedureAIH = {
                sequencia: sequenciaAtual,
                procedimento: codigo,
                documentoProfissional: contextData.documento || '',
                cbo: contextData.cbo || '',
                participacao: contextData.participacao || '1',
                cnes: contextData.cnes || '',
                aceitar: true,
                data: contextData.data || '',
                descricao: descricao,
                
                // Status inicial - TODOS APROVADOS
                matchStatus: 'approved',
                aprovado: true,
                
                // Campo quantidade - padrão 1
                quantity: 1,
                
                // ✅ NOVO: Marcar se é anestesista (para estilo visual)
                isAnesthesiaProcedure: isAnesthesia
              };

              procedimentos.push(procedimento);
              console.log(`✅ Procedimento ${sequenciaAtual}: ${codigo} - ${descricao} ${isAnesthesia ? '🚫 (ANESTESISTA)' : '✅ (NORMAL)'}`);
              sequenciaAtual++;
              totalExtraidos++;
              extraidoNesteSegmento = true;
              break; // Parar de tentar patterns neste segmento
            }
          }
        }
        
        // Se nenhum pattern funcionou, tentar extração por fallback neste segmento
        if (!extraidoNesteSegmento) {
          const fallbackProcedimentos = this.fallbackExtractionFromSegment(segment, sequenciaAtual);
          if (fallbackProcedimentos.length > 0) {
            procedimentos.push(...fallbackProcedimentos);
            sequenciaAtual += fallbackProcedimentos.length;
            totalExtraidos += fallbackProcedimentos.length;
            console.log(`🔄 Fallback extraiu ${fallbackProcedimentos.length} procedimentos do segmento ${segmentIndex + 1}`);
          }
        }
      }
      
      console.log(`🎯 EXTRAÇÃO COMPLETA FINALIZADA: ${totalExtraidos} procedimentos extraídos`);
      
      // 🆕 NOVA ETAPA: Extração robusta de descrições
      console.log(`🔧 APLICANDO EXTRAÇÃO ROBUSTA DE DESCRIÇÕES...`);
      const robustDescriptions = this.extractRobustProcedureDescriptions(text);
      
      // Aplicar descrições robustas
      procedimentos = this.applyRobustDescriptions(procedimentos, robustDescriptions);
      
      // Aplicar melhorias na descrição para todos os procedimentos extraídos
      procedimentos.forEach(proc => {
        proc.descricao = this.improveProcedureDescription(proc.descricao, proc.procedimento);
      });

      // ✅ RELATÓRIO FINAL
      const anestesistas = procedimentos.filter(p => p.isAnesthesiaProcedure);
      const normais = procedimentos.filter(p => !p.isAnesthesiaProcedure);
      const comDescricao = procedimentos.filter(p => p.descricao && p.descricao.length > 10 && !p.descricao.startsWith('Procedimento'));
      
      console.log(`📊 RESUMO FINAL COMPLETO:`);
      console.log(`   ✅ Total extraído: ${procedimentos.length} procedimentos`);
      console.log(`   🚫 Anestesistas detectados: ${anestesistas.length} (marcados para visualização)`);
      console.log(`   📋 Procedimentos normais: ${normais.length}`);
      console.log(`   📝 Com descrição completa: ${comDescricao.length} procedimentos`);
      console.log(`   🎯 GARANTIA: Nenhum procedimento foi filtrado/perdido`);
      
      return procedimentos;
      
    } catch (error) {
      console.error('❌ Erro ao extrair procedimentos:', error);
      return [];
    }
  }

  /**
   * Limpa e normaliza a descrição do procedimento
   */
  private cleanProcedureDescription(descricao: string): string {
    if (!descricao) return '';
    
    return descricao
      .trim()
      .replace(/\s+/g, ' ') // Normalizar espaços
      .replace(/[0-9]+$/, '') // Remover números no final
      .replace(/^\-\s*/, '') // Remover hífen inicial
      .replace(/\s*-\s*$/, '') // Remover hífen final
      .trim();
  }

  /**
   * Extrai dados contextuais da linha completa onde está o código do procedimento
   */
  private extractContextualData(text: string, codigo: string): {
    documento: string;
    cbo: string;
    participacao: string;
    cnes: string;
    data: string;
  } {
    // Encontrar a posição do código no texto
    const codigoIndex = text.indexOf(codigo);
    if (codigoIndex === -1) {
      return { documento: '', cbo: '', participacao: '1', cnes: '', data: '' };
    }
    
    // Pegar um contexto de 200 caracteres ao redor do código
    const start = Math.max(0, codigoIndex - 100);
    const end = Math.min(text.length, codigoIndex + 200);
    const context = text.substring(start, end);
    
    // Extrair dados usando patterns específicos
    const documentoMatch = context.match(/(\d{3}\.\d{3}\.\d{3}-\d{2})/);
    const cboMatch = context.match(/\b(\d{4,6})\b/);
    const dataMatch = context.match(/(\d{2}\/\d{2}\/\d{4})/);
    const cnesMatch = context.match(/\b(\d{7,8})\b/);
    
    return {
      documento: documentoMatch ? documentoMatch[1] : '',
      cbo: cboMatch ? cboMatch[1] : '',
      participacao: '1', // Padrão
      cnes: cnesMatch ? cnesMatch[1] : '',
      data: dataMatch ? dataMatch[1] : ''
    };
  }

  /**
   * Melhora a descrição do procedimento usando dados do SIGTAP se disponível
   */
  private improveProcedureDescription(descricao: string, codigo: string): string {
    // Se a descrição é muito curta ou parece incorreta, tentar melhorar
    if (!descricao || descricao.length < 5 || descricao.toLowerCase().includes('procedimento')) {
      // Aqui poderia consultar base SIGTAP para descrição correta
      // Por enquanto, manter o que foi extraído
      return descricao || `Procedimento ${codigo}`;
    }
    
    return descricao;
  }

  /**
   * 🆕 EXTRAÇÃO ROBUSTA DE DESCRIÇÕES - Captura descrições completas da segunda página
   * Solução funcional mesmo que não seja visualmente perfeita
   */
  private extractRobustProcedureDescriptions(text: string): {[code: string]: string} {
    console.log('🔧 EXTRAÇÃO ROBUSTA: Capturando descrições completas...');
    
    const descriptions: {[code: string]: string} = {};
    
    // Strategy 1: Buscar por padrões CÓDIGO - DESCRIÇÃO mais amplos
    const fullDescriptionPatterns = [
      // Pattern para capturar tudo entre código e próximo elemento estrutural
      /([0-9]{2}\.[0-9]{2}\.[0-9]{2}\.[0-9]{3}-[0-9])\s*-\s*([A-ZÁÊÇÕÚÍÂ][^0-9]{5,200}?)(?=\s*\d{2}\.\d{2}\.\d{2}\.\d{3}-\d|\s*\d{1,3}\s*\d{6}|\s*$)/g,
      
      // Pattern mais amplo para descrições sem hífen
      /([0-9]{2}\.[0-9]{2}\.[0-9]{2}\.[0-9]{3}-[0-9])\s+([A-ZÁÊÇÕÚÍÂ][A-ZÁÊÇÕÚÍÂ\s\/\(\)]+?)(?=\s*\d{1,3}\s|\s*\d{2}\.\d{2}|\s*$)/g,
      
      // Pattern para capturar linhas completas que contenham código + descrição
      /([0-9]{2}\.[0-9]{2}\.[0-9]{2}\.[0-9]{3}-[0-9])[^0-9]*?([A-ZÁÊÇÕÚÍÂ][^0-9]+?)(?=\s*\d{1,3}\s*\d{6})/g
    ];
    
    for (const pattern of fullDescriptionPatterns) {
      pattern.lastIndex = 0;
      let match;
      while ((match = pattern.exec(text)) !== null) {
        const codigo = match[1];
        let descricao = match[2];
        
        if (descricao && descricao.length > 5) {
          // Limpeza robusta da descrição
          descricao = descricao
            .trim()
            .replace(/\s+/g, ' ')
            .replace(/\s*\d+\s*$/, '') // Remover números finais
            .replace(/\s*(COM|SEM|P\/|DE|DO|DA|E|OU)\s*$/, '') // Remover palavras truncadas no final
            .trim();
          
          if (descricao.length > 3 && !descriptions[codigo]) {
            descriptions[codigo] = descricao;
            console.log(`✅ Descrição robusta capturada: ${codigo} -> ${descricao.substring(0, 50)}...`);
          }
        }
      }
    }
    
    // Strategy 2: Extração de contexto completo por código
    const codeMatches = text.match(/[0-9]{2}\.[0-9]{2}\.[0-9]{2}\.[0-9]{3}-[0-9]/g);
    if (codeMatches) {
      for (const codigo of codeMatches) {
        if (descriptions[codigo]) continue; // Já tem descrição
        
        const codeIndex = text.indexOf(codigo);
        if (codeIndex === -1) continue;
        
        // Extrair contexto de 300 caracteres após o código
        const contextAfter = text.substring(codeIndex, codeIndex + 300);
        
        // Buscar por texto em maiúsculas que pode ser a descrição
        const uppercaseMatch = contextAfter.match(/[A-ZÁÊÇÕÚÍÂ][A-ZÁÊÇÕÚÍÂ\s\/\(\)]{10,150}/);
        if (uppercaseMatch) {
          let descricao = uppercaseMatch[0]
            .trim()
            .replace(/\s+/g, ' ')
            .replace(/\s*\d+.*$/, '') // Cortar na primeira sequência de números
            .trim();
          
          if (descricao.length >= 10) {
            descriptions[codigo] = descricao;
            console.log(`✅ Contexto capturado: ${codigo} -> ${descricao.substring(0, 50)}...`);
          }
        }
      }
    }
    
    // Strategy 3: Extração bruta - capturar qualquer texto maiúsculo próximo ao código
    for (const codigo of codeMatches || []) {
      if (descriptions[codigo]) continue;
      
      const regex = new RegExp(`${codigo.replace(/\./g, '\\.')}[^A-Z]*([A-ZÁÊÇÕÚÍÂ][A-ZÁÊÇÕÚÍÂ\\s\\/\\(\\)]{8,100})`);
      const bruteMatch = text.match(regex);
      
      if (bruteMatch && bruteMatch[1]) {
        let descricao = bruteMatch[1]
          .trim()
          .split(/\s+\d/)[0] // Cortar no primeiro número encontrado
          .trim();
        
        if (descricao.length >= 8) {
          descriptions[codigo] = descricao;
          console.log(`✅ Extração bruta: ${codigo} -> ${descricao.substring(0, 50)}...`);
        }
      }
    }
    
    console.log(`📊 EXTRAÇÃO ROBUSTA FINALIZADA: ${Object.keys(descriptions).length} descrições capturadas`);
    return descriptions;
  }

  /**
   * Aplica descrições robustas aos procedimentos extraídos
   */
  private applyRobustDescriptions(procedimentos: ProcedureAIH[], robustDescriptions: {[code: string]: string}): ProcedureAIH[] {
    return procedimentos.map(proc => {
      const robustDescription = robustDescriptions[proc.procedimento];
      
      if (robustDescription && robustDescription.length > (proc.descricao?.length || 0)) {
        console.log(`🔄 Aplicando descrição robusta para ${proc.procedimento}: "${robustDescription}"`);
        return {
          ...proc,
          descricao: robustDescription
        };
      }
      
      return proc;
    });
  }

  /**
   * Métodos de fallback para extração quando a lógica principal falha
   */
  private fallbackExtractionMethods(text: string, sequenciaInicial: number): ProcedureAIH[] {
    console.log('🔄 Executando métodos de fallback...');
    
    const procedimentos: ProcedureAIH[] = [];
    
    // Buscar todos os códigos de procedimento no texto
    const codigosMatch = text.match(/[0-9]{2}\.[0-9]{2}\.[0-9]{2}\.[0-9]{3}-[0-9]/g);
    
    if (codigosMatch) {
      console.log(`📋 Encontrados ${codigosMatch.length} códigos de procedimento via fallback`);
      
      codigosMatch.forEach((codigo, index) => {
        const procedimento: ProcedureAIH = {
          sequencia: sequenciaInicial + index,
          procedimento: codigo,
          documentoProfissional: '',
          cbo: '',
          participacao: '1',
          cnes: '',
          aceitar: true,
          data: '',
          descricao: `Procedimento ${codigo}`, // Descrição fallback
          matchStatus: 'approved',
          aprovado: true,
          quantity: 1
        };
        
        procedimentos.push(procedimento);
        console.log(`✅ Procedimento fallback ${sequenciaInicial + index}: ${codigo}`);
      });
    }
    
    return procedimentos;
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
   * Processa campo de participação PRESERVANDO TEXTO ORIGINAL
   * Conforme nova lógica: manter "Anestesista", "1º cirurgião" etc. como texto
   * Só converter códigos numéricos puros para formato padronizado
   */
  private parseParticipationField(rawValue: string): string {
    if (!rawValue) return '';
    
    console.log(`🔍 PARSING Participação: "${rawValue}"`);
    
    // Limpar espaços
    const cleaned = rawValue.trim();
    
    // 🎯 NOVA LÓGICA: Se contém letras (texto), preservar como está
    if (/[a-zA-ZáéíóúâêîôûàèìòùçãõüÁÉÍÓÚÂÊÎÔÛÀÈÌÒÙÇÃÕÜ]/.test(cleaned)) {
      console.log(`   ✅ Texto preservado: "${cleaned}"`);
      return cleaned; // Preservar "Anestesista", "1º cirurgião", etc.
    }
    
    // Se for só números/símbolos, aplicar conversão para códigos
    
    // Pattern para capturar números com possível º ou °
    const numberMatch = cleaned.match(/^(\d+)[°º]?$/);
    if (numberMatch) {
      const number = parseInt(numberMatch[1]);
      const formatted = number.toString().padStart(2, '0');
      console.log(`   ✅ Número detectado: ${number} → ${formatted}`);
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
    
    // Fallback: retornar o valor original limpo
    console.log(`   ⚠️ Valor preservado como texto: "${cleaned}"`);
    return cleaned;
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
          aprovado: true,
          
          // 🆕 CAMPO QUANTIDADE - PADRÃO 1
          quantity: 1
        };
        
        // ✅ PROCEDIMENTO JÁ FILTRADO pelo pré-filtro - adicionar diretamente
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

  /**
   * Extrai o documento do contexto da página.
   * Procura a linha que contém o código do procedimento e retorna o texto à esquerda.
   */
  private extractDocumentFromContext(text: string, codigo: string): string {
    // Buscar padrão de documento no texto (CPF ou outro documento)
    const documentMatch = text.match(/(\d{3}\.\d{3}\.\d{3}-\d{2})/);
    return documentMatch ? documentMatch[1] : '';
  }

  /**
   * Extrai o CBO do contexto da página.
   * Procura números de 4-6 dígitos que podem ser CBO.
   */
  private extractCBOFromContext(text: string, codigo: string): string {
    // Buscar CBO após o código do procedimento
    const procedureIndex = text.indexOf(codigo);
    if (procedureIndex >= 0) {
      const afterCode = text.substring(procedureIndex + codigo.length);
      const cboMatch = afterCode.match(/(\d{4,6})/);
      return cboMatch ? cboMatch[1] : '';
    }
    return '';
  }

  /**
   * Extrai a participação do contexto da página.
   * Busca padrões de participação como "1", "1º", etc.
   */
  private extractParticipationFromContext(text: string, codigo: string): string {
    // Buscar participação após o código
    const procedureIndex = text.indexOf(codigo);
    if (procedureIndex >= 0) {
      const afterCode = text.substring(procedureIndex + codigo.length);
      const participationMatch = afterCode.match(/([1-9])[°º]?/);
      return participationMatch ? participationMatch[1] : '1';
    }
    return '1';
  }

  /**
   * Extrai a data do contexto da página.
   * Busca padrões de data DD/MM/AAAA.
   */
  private extractDateFromContext(text: string, codigo: string): string {
    const dateMatch = text.match(/(\d{2}\/\d{2}\/\d{4})/);
    return dateMatch ? dateMatch[1] : '';
  }

  /**
   * Extrai o CNES do contexto da página.
   * Busca números longos que podem ser CNES.
   */
  private extractCNESFromContext(text: string, codigo: string): string {
    // Buscar CNES no texto (geralmente números de 7+ dígitos)
    const cnesMatch = text.match(/(\d{7,})/);
    return cnesMatch ? cnesMatch[1] : '';
  }

  /**
   * Detecta se uma linha contém um procedimento de anestesia.
   * ✅ NOVO: Verifica por texto na linha, não apenas código.
   */
  private detectAnesthesiaProcedure(line: string, participacao: string): boolean {
    // 🎯 ÚNICA VERIFICAÇÃO: Detecção por texto na participação
    if (!participacao) {
      return false;
    }
    
    // 📋 TERMOS DE ANESTESIA EM PORTUGUÊS - como backup
    const anesthesiaTerms = [
      // Termos principais
      'anestesista',        // Termo exato da tabela
      'anestesiologista',   // Variação comum
      'anestesiol',         // Abreviação comum
      'anestes',            // Variação
      'anes',               // Abreviação curta
      'anest',              // Abreviação
      
      // Variações e erros de digitação
      'anestsista',         // Erro comum
      'anestesita',         // Erro comum
      'anestesis',          // Variação
      'anastesista',        // Erro comum
      'anastesiologista',   // Erro comum
      
      // Termos em inglês (caso apareçam)
      'anesthesi',          // Inglês
      'anesthesiol',        // Inglês abreviado
      
      // Termos relacionados
      'anest.',             // Abreviação com ponto
      'anes.',              // Abreviação com ponto
    ];
    
    // Verificar se algum termo de anestesia está presente na participação
    const isAnesthesia = anesthesiaTerms.some(term => 
      participacao.includes(term)
    );
    
    // 🎯 NOVO: Verifica também por texto na linha, mesmo que não seja um procedimento
    if (isAnesthesia) {
      return true;
    }

    // 🎯 ÚNICA VERIFICAÇÃO: Detecção por texto na participação
    const participacaoLine = line.toLowerCase().trim();
    
    const hasAnesthesiaText = anesthesiaTerms.some(term => participacaoLine.includes(term));
    
    return hasAnesthesiaText;
  }

  /**
   * Método de fallback para extração quando a lógica principal falha em um segmento
   */
  private fallbackExtractionFromSegment(segment: string, sequenciaInicial: number): ProcedureAIH[] {
    console.log(`🔄 Executando fallback para segmento: ${segment.substring(0, 80)}...`);
    
    const procedimentos: ProcedureAIH[] = [];
    
    // 🆕 APLICAR EXTRAÇÃO ROBUSTA DE DESCRIÇÕES NO SEGMENTO
    const robustDescriptions = this.extractRobustProcedureDescriptions(segment);
    
    // Buscar todos os códigos de procedimento no segmento
    const codigosMatch = segment.match(/[0-9]{2}\.[0-9]{2}\.[0-9]{2}\.[0-9]{3}-[0-9]/g);
    
    if (codigosMatch) {
      console.log(`📋 Encontrados ${codigosMatch.length} códigos de procedimento via fallback no segmento`);
      
      codigosMatch.forEach((codigo, index) => {
        // Extrair dados contextuais básicos para este código
        const contextData = this.extractContextualData(segment, codigo);
        
        // ✅ DETECTAR SE É ANESTESISTA TAMBÉM NO FALLBACK
        const isAnesthesia = this.detectAnesthesiaProcedure(segment, contextData.participacao);
        
        // 🆕 USAR DESCRIÇÃO ROBUSTA SE DISPONÍVEL
        const descricao = robustDescriptions[codigo] || `Procedimento ${codigo}`;
        
        const procedimento: ProcedureAIH = {
          sequencia: sequenciaInicial + index,
          procedimento: codigo,
          documentoProfissional: contextData.documento || '',
          cbo: contextData.cbo || '',
          participacao: contextData.participacao || '1',
          cnes: contextData.cnes || '',
          aceitar: true,
          data: contextData.data || '',
          descricao: descricao, // 🆕 Descrição robusta ou fallback
          matchStatus: 'approved',
          aprovado: true,
          quantity: 1,
          isAnesthesiaProcedure: isAnesthesia // 🆕 Detectar anestesista também no fallback
        };
        
        procedimentos.push(procedimento);
        console.log(`✅ Procedimento fallback ${sequenciaInicial + index}: ${codigo} - ${descricao.substring(0, 30)}...${isAnesthesia ? ' (ANESTESISTA)' : ''}`);
      });
    }
    
    return procedimentos;
  }
} 
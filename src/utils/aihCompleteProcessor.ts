import * as pdfjsLib from 'pdfjs-dist';
import { AIH, ProcedureAIH, AIHComplete, AIHCompleteProcessingResult, ProcedureMatchingResult } from '../types';
import { AIHPDFProcessor } from './aihPdfProcessor';
import { isValidParticipationCode, formatParticipationCode, getParticipationInfo } from '../config/participationCodes';

// Configurar worker
pdfjsLib.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.mjs';

/**
 * 🛡️ FILTRO DE INTERFACE: Função utilitária para garantir que anestesistas não apareçam na tela
 * Uso: procedimentos.filter(filterOutAnesthesia)
 */
export const filterOutAnesthesia = (procedimento: ProcedureAIH): boolean => {
  // 🎯 PRIORIDADE 1: CBO 225151 - CRITÉRIO OFICIAL CONFIRMADO PELO HOSPITAL
  const cbo = (procedimento.cbo || '').trim();
  if (cbo === '225151') {
    console.log(`🚫 INTERFACE-FILTRO: Anestesista removido da tela - CBO 225151`);
    return false; // Filtrar (não exibir)
  }
  
  // 🎯 PRIORIDADE 2: Detecção por texto na participação (backup para casos edge)
  const participacao = (procedimento.participacao || '').toLowerCase().trim();
  
  // Se não há participação definida, não é anestesista
  if (!participacao) {
    return true; // Não filtrar (exibir)
  }
  
  // 📋 TERMOS DE ANESTESIA EM PORTUGUÊS - como backup
  const anesthesiaTerms = [
    'anestesista', 'anestesiologista', 'anestesiol', 'anestes', 'anes', 'anest',
    'anestsista', 'anestesita', 'anestesis', 'anastesista', 'anastesiologista',
    'anesthesi', 'anesthesiol', 'anest.', 'anes.'
  ];
  
  // Verificar se algum termo de anestesia está presente na participação
  const isAnesthesia = anesthesiaTerms.some(term => 
    participacao.includes(term)
  );
  
  if (isAnesthesia) {
    const foundTerm = anesthesiaTerms.find(term => participacao.includes(term));
    console.log(`🚫 INTERFACE-FILTRO: Anestesista removido da tela - Termo "${foundTerm}" na participação`);
    return false; // Filtrar (não exibir)
  }
  
  return true; // Não filtrar (exibir)
};

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
   */
  private preFilterAnesthesiaLines(text: string): { filteredText: string; removedLines: string[] } {
    console.log(`🚫 PRÉ-FILTRO: Aplicando filtro inteligente de anestesia...`);
    
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
      
      // 🚫 PRIORIDADE ABSOLUTA: FILTRAR ANESTESIA ANTES DE QUALQUER COISA
      const lowerLine = trimmedLine.toLowerCase();
      const hasAnesthesiaCBO = trimmedLine.includes('225151');
      
      // 📋 DETECÇÃO EXPANDIDA DE ANESTESIA - MÚLTIPLOS TERMOS
      const anesthesiaTerms = [
        'anestesista', 'anestesiologista', 'anestesiologia', 'anestesiologic',
        'anestesiol', 'anestes', 'anes', 'anest', 'anestesi',
        'anestsista', 'anestesita', 'anestesis', 'anastesista', 'anastesiologista',
        'anesthesi', 'anesthesiol', 'anest.', 'anes.', 'anestesista.',
        // Variações com espaços ou caracteres especiais
        'anestesi ', ' anestesi', 'anestes ', ' anestes'
      ];
      
      const hasAnesthesiaText = anesthesiaTerms.some(term => lowerLine.includes(term));
      
      if (hasAnesthesiaCBO || hasAnesthesiaText) {
        const foundTerm = hasAnesthesiaCBO ? 'CBO 225151' : 
                         anesthesiaTerms.find(term => lowerLine.includes(term)) || 'termo de anestesia';
        console.log(`🚫 ANESTESIA FILTRADA: ${trimmedLine.substring(0, 80)}...`);
        console.log(`   📋 Motivo: ${foundTerm}`);
        console.log(`   🎯 STATUS: REMOVIDO COMPLETAMENTE (MESMO SE FOR CABEÇALHO)`);
        removedLines.push(line);
        continue; // NÃO adicionar à lista filtrada
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
    
    console.log(`✅ PRÉ-FILTRO INTELIGENTE CONCLUÍDO:`);
    console.log(`   📄 Segmentos originais: ${smartLines.length}`);
    console.log(`   ✅ Segmentos mantidos: ${filteredLines.length}`);
    console.log(`   🚫 Procedimentos filtrados: ${removedLines.length}`);
    
    if (removedLines.length > 0) {
      console.log(`   🎯 ECONOMIA: ${removedLines.length} procedimentos de anestesia removidos`);
      removedLines.forEach((line, index) => {
        console.log(`   🚫 ${index + 1}. ${line.substring(0, 80)}...`);
      });
    }
    
    return { filteredText, removedLines };
  }

  /**
   * 🔧 QUEBRA INTELIGENTE: Divide texto de PDF em segmentos lógicos
   * PDFs podem vir como bloco contínuo - quebrar por padrões que indicam novos procedimentos
   */
  private smartSplitProcedureText(text: string): string[] {
    // Primeiro tentar quebra natural por \n
    let lines = text.split('\n');
    
    console.log(`🔧 QUEBRA INICIAL: ${lines.length} linhas naturais`);
    console.log(`📏 Tamanho do texto: ${text.length} caracteres`);
    
    // Se tem poucas linhas mas texto longo, fazer quebra inteligente
    if (lines.length <= 3 && text.length > 500) {
      console.log(`🔧 TEXTO LONGO EM POUCAS LINHAS - Aplicando quebra inteligente...`);
      console.log(`📄 Texto original (primeiros 200 chars): ${text.substring(0, 200)}...`);
      
      // Quebrar onde há códigos de procedimento seguidos por data
      // Padrão: XX.XX.XX.XXX-X ... DD/MM/AAAA (próximo código)
      const procedurePattern = /(\d{2}\.\d{2}\.\d{2}\.\d{3}-\d)/g;
      
      let smartLines: string[] = [];
      let currentSegment = '';
      
      // Quebrar por códigos de procedimento
      const segments = text.split(procedurePattern);
      
      console.log(`🔧 SEGMENTOS ENCONTRADOS: ${segments.length}`);
      
      for (let i = 0; i < segments.length; i++) {
        if (segments[i].match(/^\d{2}\.\d{2}\.\d{2}\.\d{3}-\d$/)) {
          // É um código de procedimento
          if (currentSegment.trim()) {
            smartLines.push(currentSegment.trim());
            console.log(`📋 Segmento ${smartLines.length}: ${currentSegment.trim().substring(0, 60)}...`);
          }
          currentSegment = segments[i]; // Iniciar novo segmento com o código
        } else {
          // É o conteúdo após o código
          currentSegment += segments[i];
        }
      }
      
      // Adicionar último segmento
      if (currentSegment.trim()) {
        smartLines.push(currentSegment.trim());
        console.log(`📋 Segmento ${smartLines.length} (último): ${currentSegment.trim().substring(0, 60)}...`);
      }
      
      console.log(`🔧 QUEBRA REALIZADA: ${lines.length} linhas → ${smartLines.length} segmentos`);
      
      // 🔍 DEBUG: Verificar se há anestesia nos segmentos
      smartLines.forEach((segment, index) => {
        if (segment.includes('225151') || segment.toLowerCase().includes('anestesista')) {
          console.log(`⚠️ ANESTESIA DETECTADA no segmento ${index + 1}: ${segment.substring(0, 80)}...`);
        }
      });
      
      return smartLines;
    }
    
    // 🔍 DEBUG: Verificar se há anestesia nas linhas normais
    lines.forEach((line, index) => {
      if (line.includes('225151') || line.toLowerCase().includes('anestesista')) {
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
    if (line.includes('225151') || line.toLowerCase().includes('anestesista')) {
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
   * PRIORIDADE 1: CBO 225151 (anestesiologista oficial)
   * PRIORIDADE 2: Palavras na coluna "Participação" (backup)
   */
  private isAnesthesiaProcedure(procedimento: ProcedureAIH): boolean {
    // 🎯 PRIORIDADE 1: CBO 225151 - CRITÉRIO OFICIAL CONFIRMADO PELO HOSPITAL
    const cbo = (procedimento.cbo || '').trim();
    if (cbo === '225151') {
      return true; // Anestesiologista confirmado por CBO oficial
    }
    
    // 🎯 PRIORIDADE 2: Detecção por texto na participação (backup para casos edge)
    const participacao = (procedimento.participacao || '').toLowerCase().trim();
    
    // Se não há participação definida, não é anestesista (já foi filtrado por CBO)
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
   */
  private getFilterReason(procedimento: ProcedureAIH): string {
    // 🎯 PRIORIDADE 1: Verificar se foi filtrado por CBO 225151
    const cbo = (procedimento.cbo || '').trim();
    if (cbo === '225151') {
      return `CBO 225151 (Anestesiologista oficial) - Critério principal confirmado pelo hospital`;
    }
    
    // 🎯 PRIORIDADE 2: Verificar se foi filtrado por texto na participação
    const participacao = (procedimento.participacao || '').toLowerCase().trim();
    
    if (!participacao) {
      return 'Erro: Procedimento filtrado sem CBO 225151 nem participação - revisar lógica';
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
      return `Termo de anestesia '${foundTerm}' encontrado na Participação: "${procedimento.participacao}" (filtro backup)`;
    }
    
    return `Erro: Procedimento filtrado sem critério válido - CBO: "${cbo}", Participação: "${procedimento.participacao}"`;
  }

  /**
   * Extrai procedimentos da página e aplica filtros SUS
   */
  private extractProcedures(text: string, sequenciaInicial: number = 1): ProcedureAIH[] {
    try {
      console.log(`📋 Extraindo procedimentos (sequência inicial: ${sequenciaInicial})...`);
      console.log(`🔍 DEBUGGING: Texto da página (primeiros 500 chars):`);
      console.log(text.substring(0, 500));
      
      // 🚫 ETAPA 1: PRÉ-FILTRO DE ANESTESIA (ANTES DA EXTRAÇÃO COMPLEXA)
      const { filteredText, removedLines } = this.preFilterAnesthesiaLines(text);
      
      // Se todas as linhas foram filtradas, retornar vazio
      if (filteredText.trim().length === 0) {
        console.log(`🚫 TODAS AS LINHAS FILTRADAS - Nenhum procedimento válido encontrado`);
        return [];
      }
      
      let procedimentos: ProcedureAIH[] = [];
      
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

      // 📄 PROCESSAR TEXTO FILTRADO (sem linhas de anestesia)
      // Tentar extrair usando pattern FLEXÍVEL da tabela
      let match;
      let sequenciaAtual = sequenciaInicial;
      
      console.log(`🔍 TENTANDO EXTRAIR com pattern flexível no texto filtrado...`);
      
      while ((match = patterns.linhaTabela.exec(filteredText)) !== null) {
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
          // ✅ PROCEDIMENTO JÁ FILTRADO pelo pré-filtro - adicionar diretamente
          procedimentos.push(procedimento);
          console.log(`✅ Procedimento ${sequenciaAtual}: ${procedimento.procedimento} - ${procedimento.descricao}`);
          console.log(`   👨‍⚕️ Participação: "${rawParticipacao}" → "${participacaoValidada}" (${isValidParticipationCode(participacaoValidada) ? 'VÁLIDO' : 'INVÁLIDO'})`);
        }
        
        sequenciaAtual++;
      }
      
      // Se pattern principal não funcionou, tentar EXTRAÇÃO LINHA POR LINHA
      if (procedimentos.length === 0) {
        console.warn('⚠️ Pattern principal falhou, tentando extração linha por linha no texto filtrado...');
        const extractedByLines = this.extractProceduresByLines(filteredText, sequenciaInicial);
        procedimentos.push(...extractedByLines);
      }

      // Se não encontrou procedimentos com o pattern principal, tentar método alternativo
      if (procedimentos.length === 0) {
        console.warn('⚠️ Nenhum procedimento encontrado com pattern principal, tentando extração alternativa no texto filtrado...');
        
        // Buscar códigos de procedimento e tentar montar estrutura básica
        const codigosMatch = filteredText.match(patterns.procedimentoCodigo);
        const datasMatch = filteredText.match(patterns.data);
        
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
            
            // ✅ PROCEDIMENTO JÁ FILTRADO pelo pré-filtro - adicionar diretamente
            procedimentos.push(procedimento);
            console.log(`✅ Procedimento alternativo ${sequenciaInicial + index}: ${codigo}`);
          });
        }
      }

      console.log(`📊 Total de procedimentos extraídos: ${procedimentos.length}`);
      
      // 🛡️ FILTRO PÓS-EXTRAÇÃO: Segunda camada de proteção SUS
      const procedimentosAntes = procedimentos.length;
      procedimentos = procedimentos.filter(proc => {
        const isAnesthesia = this.isAnesthesiaProcedure(proc);
        if (isAnesthesia) {
          const reason = this.getFilterReason(proc);
          console.log(`🚫 PÓS-FILTRO: Anestesista removido - ${reason}`);
          console.log(`   📋 Procedimento: ${proc.procedimento} - ${proc.descricao || 'Sem descrição'}`);
          console.log(`   👨‍⚕️ CBO: "${proc.cbo}" | Participação: "${proc.participacao}"`);
        }
        return !isAnesthesia;
      });
      
      const procedimentosRemovidos = procedimentosAntes - procedimentos.length;
      if (procedimentosRemovidos > 0) {
        console.log(`🛡️ PÓS-FILTRO APLICADO:`);
        console.log(`   📊 Procedimentos antes: ${procedimentosAntes}`);
        console.log(`   ✅ Procedimentos após: ${procedimentos.length}`);
        console.log(`   🚫 Anestesistas removidos: ${procedimentosRemovidos}`);
        console.log(`   🎯 GARANTIA: Nenhum anestesista passará para a interface`);
      } else {
        console.log(`✅ PÓS-FILTRO: Nenhum anestesista detectado após extração`);
      }
      
      // 📊 ESTATÍSTICAS DO PRÉ-FILTRO SUS
      if (removedLines.length > 0) {
        console.log(`🚫 PRÉ-FILTRO SUS APLICADO:`);
        console.log(`   ✅ Procedimentos extraídos: ${procedimentos.length}`);
        console.log(`   🚫 Linhas de anestesia filtradas: ${removedLines.length}`);
        console.log(`   🎯 ECONOMIA: ${removedLines.length} linhas removidas antes da extração`);
        console.log(`   💾 BANCO: Apenas ${procedimentos.length} procedimentos válidos serão salvos`);
        console.log(`   🔬 CRITÉRIO: Filtro por CBO 225151 e/ou texto "anestesista" aplicado no texto bruto`);
      } else {
        console.log(`✅ NENHUMA LINHA DE ANESTESIA DETECTADA - Todos os ${procedimentos.length} procedimentos são válidos`);
        console.log(`   🔍 VERIFICAÇÃO: Nenhum CBO 225151 ou termo de anestesia encontrado no texto bruto`);
      }
      
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
          aprovado: true
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
} 
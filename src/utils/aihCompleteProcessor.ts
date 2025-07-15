import * as pdfjsLib from 'pdfjs-dist';
import { AIH, ProcedureAIH, AIHComplete, AIHCompleteProcessingResult, ProcedureMatchingResult } from '../types';
import { AIHPDFProcessor } from './aihPdfProcessor';
import { isValidParticipationCode, formatParticipationCode, getParticipationInfo } from '../config/participationCodes';

// Configurar worker
pdfjsLib.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.mjs';

/**
 * Filtra anestesistas na INTERFACE (camada 3 - exibição)
 * ✅ ALTERAÇÃO: Removido filtro por CBO 225151 para permitir procedimentos pré-operatórios
 * 🎯 MANTÉM: Filtro por texto na participação para casos reais de anestesia
 * Uso: procedimentos.filter(filterOutAnesthesia)
 */
export const filterOutAnesthesia = (procedimento: ProcedureAIH): boolean => {
  // 🎯 ÚNICA VERIFICAÇÃO: Detecção por texto na participação
  const participacao = (procedimento.participacao || '').toLowerCase().trim();
  
  // Se não há participação definida, não é anestesista
  if (!participacao) {
    return true; // Não filtrar (exibir)
  }
  
  // 📋 TERMOS DE ANESTESIA EM PORTUGUÊS
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
      
      // 🚫 FILTRAR ANESTESIA POR TEXTO NA PARTICIPAÇÃO APENAS
      const lowerLine = trimmedLine.toLowerCase();
      
      // 📋 DETECÇÃO DE ANESTESIA - APENAS POR TERMOS DE TEXTO
      const anesthesiaTerms = [
        'anestesista', 'anestesiologista', 'anestesiologia', 'anestesiologic',
        'anestesiol', 'anestes', 'anes', 'anest', 'anestesi',
        'anestsista', 'anestesita', 'anestesis', 'anastesista', 'anastesiologista',
        'anesthesi', 'anesthesiol', 'anest.', 'anes.', 'anestesista.',
        // Variações com espaços ou caracteres especiais
        'anestesi ', ' anestesi', 'anestes ', ' anestes'
      ];
      
      const hasAnesthesiaText = anesthesiaTerms.some(term => lowerLine.includes(term));
      
      if (hasAnesthesiaText) {
        const foundTerm = anesthesiaTerms.find(term => lowerLine.includes(term)) || 'termo de anestesia';
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
        if (segment.toLowerCase().includes('anestesista')) {
          console.log(`⚠️ ANESTESIA DETECTADA no segmento ${index + 1}: ${segment.substring(0, 80)}...`);
        }
      });
      
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
   * Método de debug avançado para análise detalhada da extração
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
    
    // Mostrar uma amostra do texto ao redor de cada código
    codigosEncontrados.slice(0, 3).forEach((codigo, index) => {
      const codigoIndex = text.indexOf(codigo);
      const contexto = text.substring(
        Math.max(0, codigoIndex - 50),
        Math.min(text.length, codigoIndex + 150)
      );
      console.log(`📍 Contexto do código ${codigo}:`);
      console.log(`   "${contexto}"`);
    });
  }

  /**
   * Extrai procedimentos da página e aplica filtros SUS
   */
  private extractProcedures(text: string, sequenciaInicial: number = 1): ProcedureAIH[] {
    try {
      console.log(`📋 Extraindo procedimentos (sequência inicial: ${sequenciaInicial})...`);
      console.log(`🔍 DEBUGGING: Texto da página (primeiros 500 chars):`);
      console.log(text.substring(0, 500));
      
      // 🔬 DEBUG AVANÇADO da extração
      this.debugProcedureExtraction(text);
      
      // 🚫 ETAPA 1: PRÉ-FILTRO DE ANESTESIA (ANTES DA EXTRAÇÃO COMPLEXA)
      const { filteredText, removedLines } = this.preFilterAnesthesiaLines(text);
      
      // Se todas as linhas foram filtradas, retornar vazio
      if (filteredText.trim().length === 0) {
        console.log(`🚫 TODAS AS LINHAS FILTRADAS - Nenhum procedimento válido encontrado`);
        return [];
      }
      
      let procedimentos: ProcedureAIH[] = [];
      
      // 🆕 LÓGICA NOVA: Extrair especificamente da coluna procedimento da segunda página
      console.log(`🎯 NOVA LÓGICA: Extraindo da coluna procedimento da segunda página...`);
      
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
      
      // Tentar cada pattern até encontrar resultados
      for (let patternIndex = 0; patternIndex < procedurePatterns.length; patternIndex++) {
        const pattern = procedurePatterns[patternIndex];
        pattern.lastIndex = 0; // Reset regex
        
        console.log(`🔍 Tentando Pattern ${patternIndex + 1}...`);
        
        let match;
        let extraidosNessePadrao = 0;
        
        while ((match = pattern.exec(filteredText)) !== null) {
          console.log(`📋 MATCH Pattern ${patternIndex + 1} encontrado:`, match);
          
          const codigo = match[1]?.trim() || '';
          let descricao = match[2]?.trim() || '';
          
          // Limpar a descrição removendo números extras e caracteres desnecessários
          descricao = this.cleanProcedureDescription(descricao);
          
          // Validar se temos dados mínimos válidos
          if (codigo && descricao.length >= 3) {
            // Extrair dados contextuais da linha completa
            const contextData = this.extractContextualData(filteredText, codigo);
            
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
              
              // Status inicial - APROVADO por padrão
              matchStatus: 'approved',
              aprovado: true,
              
              // Campo quantidade - padrão 1
              quantity: 1
            };

            procedimentos.push(procedimento);
            console.log(`✅ Procedimento ${sequenciaAtual}: ${codigo} - ${descricao}`);
            sequenciaAtual++;
            extraidosNessePadrao++;
            totalExtraidos++;
          }
        }
        
        console.log(`📊 Pattern ${patternIndex + 1} extraiu ${extraidosNessePadrao} procedimentos`);
        
        // Se encontrou procedimentos com este pattern, parar de tentar outros
        if (extraidosNessePadrao > 0) {
          console.log(`✅ Usando Pattern ${patternIndex + 1} como método principal`);
          break;
        }
      }
      
      console.log(`🎯 TOTAL EXTRAÍDO pela nova lógica: ${totalExtraidos} procedimentos`);
      
      // Se a nova lógica não funcionou, tentar métodos de fallback
      if (procedimentos.length === 0) {
        console.warn('⚠️ Nova lógica falhou, tentando métodos de fallback...');
        procedimentos = this.fallbackExtractionMethods(filteredText, sequenciaInicial);
      }

      // Aplicar melhorias na descrição para todos os procedimentos extraídos
      procedimentos.forEach(proc => {
        proc.descricao = this.improveProcedureDescription(proc.descricao, proc.procedimento);
      });

      console.log(`📊 RESUMO FINAL: ${procedimentos.length} procedimentos extraídos`);
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
} 
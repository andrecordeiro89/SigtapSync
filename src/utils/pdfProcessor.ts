import * as pdfjsLib from 'pdfjs-dist';
import { SigtapProcedure } from '../types';
import { FastExtractor } from './fastExtractor';

// Configure PDF.js worker to use local version instead of external CDN
pdfjsLib.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.mjs';

export interface PDFProcessingResult {
  success: boolean;
  message: string;
  procedures: SigtapProcedure[];
  totalProcessed: number;
  totalPages?: number;
}

// Add complexity stats tracking after the existing imports
interface ComplexityStats {
  'ATENÇÃO BÁSICA': number;
  'BAIXA COMPLEXIDADE': number;
  'MÉDIA COMPLEXIDADE': number;
  'ALTA COMPLEXIDADE': number;
  'OUTRAS': number;
  'FALHAS': number;
}

export const processSigtapPDF = async (
  file: File,
  onProgress?: (progress: number, currentPage: number, totalPages: number) => void
): Promise<PDFProcessingResult> => {
  try {
    console.log('🚀 Iniciando processamento híbrido do PDF SIGTAP:', file.name);
    
    // Inicializar extrator rápido com Gemini (se disponível)
    const { ENV_CONFIG } = await import('../config/env');
    const fastExtractor = new FastExtractor(ENV_CONFIG.GEMINI_API_KEY);
    
          console.log('🚀 FastExtractor configurado:', {
        arquivo: file.name,
        tamanho: `${(file.size / 1024 / 1024).toFixed(2)} MB`
      });
    
    // Convert file to ArrayBuffer
    const arrayBuffer = await file.arrayBuffer();
    
    // Load PDF document
    const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer });
    const pdf = await loadingTask.promise;
    
    const totalPages = pdf.numPages;
    console.log(`PDF carregado com ${totalPages} páginas`);
    
    const procedures: SigtapProcedure[] = [];
    let processedPages = 0;
    
    // Process pages in batches to avoid memory issues
    // Otimizado para PDFs grandes (4998+ páginas)
    const batchSize = totalPages > 1000 ? 20 : 10;
    for (let i = 1; i <= totalPages; i += batchSize) {
      const endPage = Math.min(i + batchSize - 1, totalPages);
      
      // Process batch of pages
      for (let pageNum = i; pageNum <= endPage; pageNum++) {
        try {
          const page = await pdf.getPage(pageNum);
          const textContent = await page.getTextContent();
          
          // Extract procedures using fast system
          const pageProcedures = await fastExtractor.extractFromText(textContent, pageNum);
          procedures.push(...pageProcedures);
          
          // Log progresso otimizado para PDFs grandes
          if (pageNum <= 3 || pageNum % 100 === 0 || pageNum === totalPages) {
            console.log(`⚡ Página ${pageNum}/${totalPages}: ${pageProcedures.length} procedimentos (${procedures.length} total)`);
          }
          
          processedPages++;
          
          // Update progress
          const progress = Math.round((processedPages / totalPages) * 100);
          if (onProgress) {
            onProgress(progress, processedPages, totalPages);
          }
          
          // Allow UI to update
          await new Promise(resolve => setTimeout(resolve, 10));
          
        } catch (pageError) {
          console.warn(`Erro ao processar página ${pageNum}:`, pageError);
        }
      }
      
      // Small delay between batches to prevent blocking
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    
    console.log(`🎉 Processamento híbrido concluído: ${procedures.length} procedimentos extraídos`);
    
    // Obter estatísticas do sistema rápido
    const fastStats = fastExtractor.getStats();
    console.log('⚡ Estatísticas FastExtractor:', fastStats);
    
    // Calcular estatísticas de complexidade
    const complexityStats: ComplexityStats = {
      'ATENÇÃO BÁSICA': 0,
      'BAIXA COMPLEXIDADE': 0,
      'MÉDIA COMPLEXIDADE': 0,
      'ALTA COMPLEXIDADE': 0,
      'OUTRAS': 0,
      'FALHAS': 0
    };
    
    procedures.forEach(proc => {
      if (proc.complexity === 'ATENÇÃO BÁSICA') {
        complexityStats['ATENÇÃO BÁSICA']++;
      } else if (proc.complexity === 'BAIXA COMPLEXIDADE') {
        complexityStats['BAIXA COMPLEXIDADE']++;
      } else if (proc.complexity === 'MÉDIA COMPLEXIDADE') {
        complexityStats['MÉDIA COMPLEXIDADE']++;
      } else if (proc.complexity === 'ALTA COMPLEXIDADE') {
        complexityStats['ALTA COMPLEXIDADE']++;
      } else {
        complexityStats['OUTRAS']++;
      }
    });
    
    // Exibir estatísticas finais
    console.log('\n📊 ESTATÍSTICAS DE COMPLEXIDADE:');
    console.log(`🔴 ATENÇÃO BÁSICA: ${complexityStats['ATENÇÃO BÁSICA']} procedimentos`);
    console.log(`🟡 BAIXA COMPLEXIDADE: ${complexityStats['BAIXA COMPLEXIDADE']} procedimentos`);
    console.log(`🟠 MÉDIA COMPLEXIDADE: ${complexityStats['MÉDIA COMPLEXIDADE']} procedimentos`);
    console.log(`🔴 ALTA COMPLEXIDADE: ${complexityStats['ALTA COMPLEXIDADE']} procedimentos`);
    console.log(`⚪ OUTRAS: ${complexityStats['OUTRAS']} procedimentos`);
    console.log(`❌ FALHAS: ${complexityStats['FALHAS']} procedimentos`);
    console.log(`📈 TOTAL: ${procedures.length} procedimentos\n`);
    
    return {
      success: true,
      message: `PDF processado com sucesso! ${procedures.length} procedimentos extraídos de ${totalPages} páginas.`,
      procedures: procedures,
      totalProcessed: procedures.length,
      totalPages: totalPages
    };
    
  } catch (error) {
    console.error('Erro no processamento do PDF:', error);
    return {
      success: false,
      message: `Erro ao processar PDF: ${error instanceof Error ? error.message : 'Erro desconhecido'}`,
      procedures: [],
      totalProcessed: 0
    };
  }
};

// Helper function to normalize text from PDF
const normalizeText = (text: string): string => {
  return text
    // Normalizar caracteres especiais
    .replace(/[''`]/g, "'")
    .replace(/[""]/g, '"')
    .replace(/–/g, '-')
    .replace(/—/g, '-')
    // Normalizar espaços
    .replace(/\s+/g, ' ')
    // Remover caracteres de controle
    .replace(/[\x00-\x1F\x7F]/g, ' ')
    .trim();
};

export const extractProceduresFromPageText = (textContent: any, pageNumber: number): SigtapProcedure[] => {
  const procedures: SigtapProcedure[] = [];
  
  try {
    // Extract text items from PDF page with positioning
    const textItems = textContent.items;
    
    // Build text with proper line breaks by grouping by Y position
    const lineGroups: { [key: number]: string[] } = {};
    
    textItems.forEach((item: any) => {
      const y = Math.round(item.transform[5]); // Y position
      if (!lineGroups[y]) {
        lineGroups[y] = [];
      }
      lineGroups[y].push(item.str);
    });
    
    // Convert groups to lines and sort by Y position (top to bottom)
    const lines: string[] = [];
    Object.keys(lineGroups)
      .sort((a, b) => parseInt(b) - parseInt(a))
      .forEach(y => {
        const line = lineGroups[parseInt(y)].join(' ').trim();
        if (line) {
          lines.push(line);
        }
      });
    
    const allText = lines.join('\n');
    
    console.log(`📄 Página ${pageNumber}: Primeiros 300 chars:\n${allText.substring(0, 300)}`);
    
    // Teste simples - procurar qualquer linha que tenha código + "Procedimento:"
    const hasCodeProcedimento = allText.includes('Procedimento:');
    console.log(`🔍 Página ${pageNumber}: Contém 'Procedimento:'? ${hasCodeProcedimento}`);
    
    if (hasCodeProcedimento) {
      // Teste com regex mais simples
      const simpleMatch = allText.match(/(\d{2}\.\d{2}\.\d{2}\.\d{3}-\d).*?Procedimento:\s*([^\n\r]+)/gi);
      console.log(`🔍 Página ${pageNumber}: Regex simples encontrou ${simpleMatch ? simpleMatch.length : 0} matches`);
      if (simpleMatch) {
        console.log(`🔍 Primeiro match: ${simpleMatch[0]}`);
      }
    }
    
    // Look for procedure patterns - CÓDIGO vem ANTES de "Procedimento:"
    // Formato real: "07.02.03.041-4 Procedimento: FIXADOR EXTERNO P/ PUNHO"
    const procedureMatches = allText.match(/(\d{2}\.\d{2}\.\d{2}\.\d{3}-\d)\s+Procedimento:\s*([^\n\r]+)/gi);
    
    if (procedureMatches && procedureMatches.length > 0) {
      console.log(`📋 Página ${pageNumber}: Encontrados ${procedureMatches.length} procedimentos`);
      
      for (const procedureMatch of procedureMatches) {
        try {
          // Extract code and description from the matched pattern
          const regex = /(\d{2}\.\d{2}\.\d{2}\.\d{3}-\d)\s+Procedimento:\s*([^\n\r]+)/i;
          const match = procedureMatch.match(regex);
          
          if (!match) continue;
          
          const code = match[1];
          let description = match[2].trim();
          
          // Clean description - remove extra whitespace and normalize
          description = normalizeText(description);
          
          // Find the full block of text for this procedure
          const procIndex = allText.indexOf(procedureMatch);
          const nextProcIndex = allText.indexOf('Procedimento:', procIndex + procedureMatch.length);
          const blockText = nextProcIndex > -1 
            ? allText.substring(procIndex, nextProcIndex)
            : allText.substring(procIndex, procIndex + 2000); // Aumentar o tamanho do bloco
          
          console.log(`🔍 Processando ${code}: ${description.substring(0, 50)}...`);
          
          // DEBUG: Mostrar apenas informações críticas
          if (pageNumber <= 2) { // Debug só nas primeiras 2 páginas
            console.log(`📄 BLOCO (${code}) - Primeiros 300 chars:`, blockText.substring(0, 300));
          }
          
          // Extract complexity - SISTEMA ROBUSTO EM DUAS ETAPAS
          let complexity = 'MÉDIA COMPLEXIDADE'; // default
          
          // ETAPA 1: Capturar tudo após "Complexidade:" até encontrar palavra-chave de parada (versão otimizada)
          const complexityRawMatch = blockText.match(/Complexidade:\s*([^\n\r]*?)(?=\s*(?:Modalidade|Instrumento|Tipo|Valor|Sexo|Idade|CBO|CID|Habilitação|Grupo|Serviço|$))/i);
          
          if (complexityRawMatch) {
            let complexityRaw = complexityRawMatch[1].trim();
            
            // ETAPA 2: Processar o resultado e extrair apenas a complexidade
            if (pageNumber <= 3) { // Log apenas para as primeiras 3 páginas para debug
              console.log(`🎯 COMPLEXIDADE RAW CAPTURADA (${code}): "${complexityRaw}"`);
            }
            
            // Remover texto extra e normalizar
            complexityRaw = normalizeText(complexityRaw)
              .replace(/\s+/g, ' ')
              .trim()
              .toUpperCase();
            
            // Mapear para os valores oficiais SIGTAP (Sistema Robusto)
            if (complexityRaw.includes('ATENÇÃO BÁSICA') || complexityRaw.includes('ATENCAO BASICA')) {
              complexity = 'ATENÇÃO BÁSICA';
            } else if (complexityRaw.includes('BAIXA COMPLEXIDADE')) {
              complexity = 'BAIXA COMPLEXIDADE';  
            } else if (complexityRaw.includes('MÉDIA COMPLEXIDADE') || complexityRaw.includes('MEDIA COMPLEXIDADE')) {
              complexity = 'MÉDIA COMPLEXIDADE';
            } else if (complexityRaw.includes('ALTA COMPLEXIDADE')) {
              complexity = 'ALTA COMPLEXIDADE';
            } else if (complexityRaw.length > 0 && complexityRaw.length < 80) {
              // Se é algo válido mas não reconhecemos, usar como está
              complexity = complexityRaw;
              if (pageNumber <= 3) {
                console.log(`⚠️ COMPLEXIDADE NÃO PADRONIZADA (${code}): "${complexity}"`);
              }
            }
            
            // Registrar estatística
            if (pageNumber === 1) { // Só contar uma vez por procedimento
              if (complexity === 'ATENÇÃO BÁSICA' || complexity === 'BAIXA COMPLEXIDADE' || 
                  complexity === 'MÉDIA COMPLEXIDADE' || complexity === 'ALTA COMPLEXIDADE') {
                // Será contado no final da função principal
              } else {
                console.log(`📊 COMPLEXIDADE ATÍPICA ENCONTRADA: "${complexity}"`);
              }
            }
            
            if (pageNumber <= 3) {
              console.log(`✅ COMPLEXIDADE FINAL (${code}): "${complexity}"`);
            }
          } else {
            // FALLBACK: Tentar regex mais simples
            const fallbackMatch = blockText.match(/Complexidade:\s*([^\n\r]+)/i);
            if (fallbackMatch) {
              const fallbackRaw = fallbackMatch[1].trim();
              
              // Verificar se não contém modalidade e processar
              if (!fallbackRaw.toUpperCase().includes('MODALIDADE')) {
                const cleanFallback = normalizeText(fallbackRaw).toUpperCase();
                
                if (cleanFallback.includes('ATENÇÃO BÁSICA') || cleanFallback.includes('ATENCAO BASICA')) {
                  complexity = 'ATENÇÃO BÁSICA';
                } else if (cleanFallback.includes('BAIXA COMPLEXIDADE')) {
                  complexity = 'BAIXA COMPLEXIDADE';
                } else if (cleanFallback.includes('MÉDIA COMPLEXIDADE') || cleanFallback.includes('MEDIA COMPLEXIDADE')) {
                  complexity = 'MÉDIA COMPLEXIDADE';
                } else if (cleanFallback.includes('ALTA COMPLEXIDADE')) {
                  complexity = 'ALTA COMPLEXIDADE';
                } else if (cleanFallback.length > 0 && cleanFallback.length < 50) {
                  complexity = cleanFallback;
                }
                
                console.log(`⚠️ FALLBACK USADO (${code}): "${complexity}"`);
              } else {
                console.log(`❌ FALLBACK REJEITADO - CONTÉM MODALIDADE (${code}): "${fallbackRaw}"`);
              }
            } else {
              console.log(`❌ COMPLEXIDADE NÃO ENCONTRADA (${code})`);
            }
          }
          
          // Extract modality
          let modality = '';
          const modalityMatch = blockText.match(/Modalidade:\s*(\d+)\s*-\s*([^\n\r]+)/i);
          if (modalityMatch) {
            modality = `${modalityMatch[1]} - ${modalityMatch[2].trim()}`;
          }
          
          // Extract registration instrument
          let registrationInstrument = '';
          const registrationMatch = blockText.match(/Instrumento de Registro:\s*(\d+)\s*-\s*([^\n\r]+)/i);
          if (registrationMatch) {
            registrationInstrument = `${registrationMatch[1]} - ${registrationMatch[2].trim()}`;
          }
          
          // Extract financing type
          let financing = 'MÉDIA E ALTA COMPLEXIDADE';
          const financingMatch = blockText.match(/Tipo de Financiamento:\s*(\d+)\s*-\s*([^\n\r]+)/i);
          if (financingMatch) {
            financing = `${financingMatch[1]} - ${financingMatch[2].trim()}`;
            const financingText = financingMatch[2].trim().toUpperCase();
            if (pageNumber <= 2) {
              console.log(`💰 FINANCIAMENTO EXTRAÍDO (${code}): "${financing}"`);
            }
            
            // REMOVIDO: Não mais sobrescrever complexidade baseada no financiamento
            // A complexidade deve vir diretamente do campo "Complexidade:" do PDF
          }
          
          // Extract financial values - Ambulatorial
          let valueAmb = 0, valueAmbTotal = 0;
          const ambMatch = blockText.match(/Valor Ambulatorial S\.A\.:\s*R\$\s*([\d,]+\.?\d*)/i);
          if (ambMatch) {
            valueAmb = parseFloat(ambMatch[1].replace(',', '.'));
          }
          
          const ambTotalMatch = blockText.match(/Valor Ambulatorial Total:\s*R\$\s*([\d,]+\.?\d*)/i);
          if (ambTotalMatch) {
            valueAmbTotal = parseFloat(ambTotalMatch[1].replace(',', '.'));
          }
          
          // Extract financial values - Hospitalar
          let valueHosp = 0, valueProf = 0, valueHospTotal = 0;
          const profMatch = blockText.match(/Valor Hospitalar S\.P\.:\s*R\$\s*([\d,]+\.?\d*)/i);
          if (profMatch) {
            valueProf = parseFloat(profMatch[1].replace(',', '.'));
          }
          
          const hospMatch = blockText.match(/Valor Hospitalar S\.H\.:\s*R\$\s*([\d,]+\.?\d*)/i);
          if (hospMatch) {
            valueHosp = parseFloat(hospMatch[1].replace(',', '.'));
          }
          
          const hospTotalMatch = blockText.match(/Valor Hospitalar Total:\s*R\$\s*([\d,]+\.?\d*)/i);
          if (hospTotalMatch) {
            valueHospTotal = parseFloat(hospTotalMatch[1].replace(',', '.'));
          }
          
          // Extract complementary attributes
          let complementaryAttribute = '';
          const attrMatch = blockText.match(/Atributo Complementar:\s*([^\n\r]+)/i);
          if (attrMatch) {
            complementaryAttribute = attrMatch[1].trim();
          }
          
          // Extract demographic and clinical criteria
          let gender = '';
          const genderMatch = blockText.match(/Sexo:\s*([^\n\r]+)/i);
          if (genderMatch) {
            gender = genderMatch[1].trim();
          }
          
          // Extract age limits with units
          let minAge = 0, maxAge = 0, minAgeUnit = 'Ano(s)', maxAgeUnit = 'Ano(s)';
          
          const minAgeMatch = blockText.match(/Idade Mínima:\s*(\d+)\s*(Mes\(es\)|Ano\(s\))/i);
          if (minAgeMatch) {
            minAge = parseInt(minAgeMatch[1]);
            minAgeUnit = minAgeMatch[2];
          }
          
          const maxAgeMatch = blockText.match(/Idade Máxima:\s*(\d+)\s*(Mes\(es\)|Ano\(s\))/i);
          if (maxAgeMatch) {
            maxAge = parseInt(maxAgeMatch[1]);
            maxAgeUnit = maxAgeMatch[2];
          }
          
          // Extract operational limits
          let maxQuantity = 0;
          const maxQuantityMatch = blockText.match(/Quantidade Máxima:\s*(\d+)/i);
          if (maxQuantityMatch) {
            maxQuantity = parseInt(maxQuantityMatch[1]);
          }
          
          let averageStay = 0;
          const averageStayMatch = blockText.match(/Média Permanência:\s*(\d+)/i);
          if (averageStayMatch) {
            averageStay = parseInt(averageStayMatch[1]);
          }
          
          let points = 0;
          const pointsMatch = blockText.match(/Pontos:\s*(\d+)/i);
          if (pointsMatch) {
            points = parseInt(pointsMatch[1]);
          }
          
          // Extract CBO (Professional Classification)
          let cbo = '';
          const cboMatch = blockText.match(/CBO:\s*([^\n\r]+)/i);
          if (cboMatch) {
            const cboText = cboMatch[1].trim();
            if (cboText.length > 200) {
              cbo = 'Múltiplos CBOs - Ver detalhes';
            } else {
              cbo = cboText;
            }
          }
          
          // Extract CID (Medical Classification)
          let cid = '';
          const cidMatch = blockText.match(/CID:\s*([^\n\r]+)/i);
          if (cidMatch) {
            const cidText = cidMatch[1].trim();
            if (cidText.length > 200) {
              cid = 'Múltiplos CIDs - Ver detalhes';
            } else {
              cid = cidText;
            }
          }
          
          // Extract habilitation
          let habilitation = '';
          const habilitationMatch = blockText.match(/Habilitação:\s*([^\n\r]+)/i);
          if (habilitationMatch) {
            habilitation = habilitationMatch[1].trim();
          }
          
          // Extract habilitation groups (can be multiple)
          let habilitationGroup: string[] = [];
          const groupMatches = blockText.match(/\d{4}\s*-\s*[^\n\r]+/g);
          if (groupMatches) {
            habilitationGroup = groupMatches
              .filter(match => /^\d{4}\s*-/.test(match.trim()))
              .map(match => match.trim())
              .slice(0, 10); // Limitar a 10 grupos
          }
          
          // Extract service classification
          let serviceClassification = '';
          const serviceMatch = blockText.match(/(\d{3})\s*-\s*Serviço de[^\n\r]+-\s*(\d{3})\s*-\s*([^\n\r]+)/i);
          if (serviceMatch) {
            serviceClassification = `${serviceMatch[1]} - ${serviceMatch[3]}`;
          }
          
          if (code && description.length > 3) {
            procedures.push({
              // Identificação
              code,
              description: description.substring(0, 200),
              origem: 'PDF',
              
              // Classificação
              complexity,
              modality,
              registrationInstrument,
              financing,
              
              // Atributos
              complementaryAttribute,
              
              // Valores Ambulatoriais
              valueAmb: isNaN(valueAmb) ? 0 : valueAmb,
              valueAmbTotal: isNaN(valueAmbTotal) ? 0 : valueAmbTotal,
              
              // Valores Hospitalares
              valueHosp: isNaN(valueHosp) ? 0 : valueHosp,
              valueProf: isNaN(valueProf) ? 0 : valueProf,
              valueHospTotal: isNaN(valueHospTotal) ? 0 : valueHospTotal,
              
              // Critérios Demográficos
              gender,
              minAge: isNaN(minAge) ? 0 : minAge,
              maxAge: isNaN(maxAge) ? 0 : maxAge,
              minAgeUnit,
              maxAgeUnit,
              
              // Limites Operacionais
              maxQuantity: isNaN(maxQuantity) ? 0 : maxQuantity,
              averageStay: isNaN(averageStay) ? 0 : averageStay,
              points: isNaN(points) ? 0 : points,
              
              // Classificação Profissional
              cbo: cbo ? [cbo] : [],
              cid: cid ? [cid] : [],
              habilitation,
              habilitationGroup,
              serviceClassification,
              especialidadeLeito: ''
            });
            
            console.log(`✅ Extraído: ${code} - ${description.substring(0, 30)}... [${complexity}] [${financing}]`);
          }
          
        } catch (procError) {
          console.warn(`Erro ao processar procedimento:`, procError);
        }
      }
    } else {
      // Fallback - buscar só códigos e tentar extrair dados básicos
      console.log(`❌ Página ${pageNumber}: Nenhum padrão 'CÓDIGO Procedimento:' encontrado`);
      const codeMatches = allText.match(/(\d{2}\.\d{2}\.\d{2}\.\d{3}-\d)/g);
      if (codeMatches) {
        console.log(`🔍 Página ${pageNumber}: Encontrados ${codeMatches.length} códigos isolados: ${codeMatches.slice(0, 3).join(', ')}...`);
        
        // Tentar extrair pelo menos o primeiro código com contexto melhorado
        const firstCode = codeMatches[0];
        const codeIndex = allText.indexOf(firstCode);
        
        // Procurar por "Procedimento:" após o código
        const contextAfterCode = allText.substring(codeIndex, codeIndex + 500);
        const procMatch = contextAfterCode.match(/\d{2}\.\d{2}\.\d{2}\.\d{3}-\d\s+Procedimento:\s*([^\n\r]+)/i);
        
        if (procMatch) {
          let description = procMatch[1].trim().toUpperCase();
          
          // Extrair financiamento do bloco para determinar complexidade
          let complexity = 'MÉDIA COMPLEXIDADE';
          let financing = 'MÉDIA E ALTA COMPLEXIDADE';
          
          const financingMatch = contextAfterCode.match(/Tipo de Financiamento:\s*\d+\s*-\s*([^\n\r]+)/i);
          if (financingMatch) {
            const financingText = financingMatch[1].trim().toUpperCase();
            if (financingText.includes('ATENÇÃO BÁSICA') || financingText.includes('PAB')) {
              financing = 'ATENÇÃO BÁSICA';
              complexity = 'ATENÇÃO BÁSICA';
            } else if (financingText.includes('ALTA COMPLEXIDADE') || financingText.includes('FAEC')) {
              financing = 'ALTA COMPLEXIDADE';
          complexity = 'ALTA COMPLEXIDADE';
            } else if (financingText.includes('MÉDIA') && financingText.includes('ALTA') || financingText.includes('MAC')) {
              financing = 'MÉDIA E ALTA COMPLEXIDADE';
              complexity = 'MÉDIA COMPLEXIDADE';
            }
        }
        
          procedures.push({
            // Identificação
            code: firstCode,
            description: description.substring(0, 200),
            origem: 'PDF',
            
            // Classificação
            complexity,
            modality: '',
            registrationInstrument: '',
            financing,
            
            // Atributos
            complementaryAttribute: '',
            
            // Valores Ambulatoriais
            valueAmb: 0,
            valueAmbTotal: 0,
            
            // Valores Hospitalares
            valueHosp: 0,
            valueProf: 0,
            valueHospTotal: 0,
            
            // Critérios Demográficos
            gender: '',
            minAge: 0,
            maxAge: 0,
            minAgeUnit: '',
            maxAgeUnit: '',
            
            // Limites Operacionais
            maxQuantity: 0,
            averageStay: 0,
            points: 0,
            
            // Classificação Profissional
            cbo: [],
            cid: [],
            habilitation: '',
            habilitationGroup: [],
            serviceClassification: '',
            especialidadeLeito: ''
          });
          console.log(`✅ Extraído código isolado: ${firstCode} - ${description.substring(0, 30)}... [${complexity}]`);
        }
      } else {
        console.log(`❌ Página ${pageNumber}: Nenhum código encontrado`);
      }
    }
    
  } catch (error) {
    console.warn(`Erro ao extrair dados da página ${pageNumber}:`, error);
  }
  
  return procedures;
};

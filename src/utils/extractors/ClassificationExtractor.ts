import { CategoryExtractor, ClassificationResult } from './index';

/**
 * EXTRACTOR DE CLASSIFICAÇÃO
 * Responsável por extrair origem, complexidade, modalidade, instrumento e financiamento
 * Método: Híbrido (sequencial + posicional)
 */
export class ClassificationExtractor implements CategoryExtractor {
  private stats = { successful: 0, failed: 0, confidence: 0 };

  extract(
    blockText: string, 
    positionMap?: Map<string, { x: number, y: number, text: string }>
  ): ClassificationResult {
    try {
      // EXTRAÇÃO SEQUENCIAL (campos que aparecem na ordem)
      const complexity = this.extractSequentialField(blockText, 'Complexidade');
      const financing = this.extractSequentialField(blockText, 'Tipo de Financiamento');

      // EXTRAÇÃO POSICIONAL (campos baseados na posição no layout)
      const origem = this.extractPositionalField(blockText, 'Origem', positionMap);
      const modality = this.extractPositionalField(blockText, 'Modalidade', positionMap);
      const registrationInstrument = this.extractPositionalField(blockText, 'Instrumento de Registro', positionMap);
      
      // ESPECIALIDADE LEITO também é posicional (movido do AdditionalClassificationsExtractor)
      const especialidadeLeito = this.extractPositionalField(blockText, 'Especialidade do Leito', positionMap) ||
                                this.extractPositionalField(blockText, 'Especialidade Leito', positionMap);

      // Calcular confiança baseada nos campos extraídos
      const extractedFields = [complexity, financing, origem, modality, registrationInstrument, especialidadeLeito];
      const successfulFields = extractedFields.filter(field => field && field !== '').length;
      this.stats.confidence = Math.round((successfulFields / extractedFields.length) * 100);

      if (successfulFields > 0) {
        this.stats.successful++;
      } else {
        this.stats.failed++;
      }

      return {
        origem,
        complexity: this.normalizeComplexity(complexity),
        modality,
        registrationInstrument,
        financing,
        especialidadeLeito
      };

    } catch (error) {
      this.stats.failed++;
      this.stats.confidence = 0;

      return {
        origem: '',
        complexity: '',
        modality: '',
        registrationInstrument: '',
        financing: '',
        especialidadeLeito: ''
      };
    }
  }

  private extractSequentialField(text: string, fieldName: string): string {
    try {
      // DEBUG ESPECÍFICO PARA COMPLEXIDADE
      if (fieldName === 'Complexidade') {
        console.log(`🔍 [DEBUG COMPLEXIDADE] Texto recebido (primeiros 500 chars):`);
        console.log(text.substring(0, 500));
        console.log(`🔍 [DEBUG COMPLEXIDADE] Procurando por: "${fieldName}"`);
        
        // Contar espaços após "Complexidade:"
        const complexidadeMatch = text.match(/Complexidade:(\s+)/);
        if (complexidadeMatch) {
          const espacos = complexidadeMatch[1].length;
          console.log(`📏 [DEBUG COMPLEXIDADE] Espaços encontrados após "Complexidade:": ${espacos}`);
          if (espacos >= 15) {
            console.log(`✅ [DEBUG COMPLEXIDADE] DETECTADO: Layout com múltiplos espaços (${espacos} espaços) - padrão SIGTAP!`);
          }
        }
        
        // DEBUG ESPECÍFICO: Mostrar 200 chars após "Complexidade:"
        const complexidadeIndex = text.indexOf('Complexidade:');
        if (complexidadeIndex !== -1) {
          const after = text.substring(complexidadeIndex, complexidadeIndex + 200);
          console.log(`🔍 [DEBUG COMPLEXIDADE] 200 chars após "Complexidade:":`);
          console.log(`"${after}"`);
        }
        
        // Verificar se há quebra de linha após Complexidade:
        const lineBreakMatch = text.match(/Complexidade:\s*\n\s*(.+)/);
        if (lineBreakMatch) {
          console.log(`🚨 [DEBUG COMPLEXIDADE] DETECTADO: Valor em linha separada! "${lineBreakMatch[1]}"`);
        }
      }

      // Padrões mais específicos para cada campo
      const patterns: { [key: string]: RegExp[] } = {
        'Complexidade': [
          // Padrão 0: EMERGENCIAL - Buscar apenas "Média Complexidade" em qualquer lugar (ignora estrutura)
          /(Média\s+Complexidade|Atenção\s+Básica|Baixa\s+Complexidade|Alta\s+Complexidade)/i,
          // Padrão 0.5: EMERGENCIAL - Versão sem acentos
          /(Media\s+Complexidade|Atencao\s+Basica|Baixa\s+Complexidade|Alta\s+Complexidade)/i,
          // Padrão 1: NOVO - Valor em linha separada (principal descoberta!)
          /Complexidade:\s*\n\s*(.+?)(?=\s*(?:Modalidade|Instrumento|Tipo|Valor|Sexo|Idade|CBO|CID|Habilitação|Grupo|Serviço|$))/i,
          // Padrão 2: NOVO - Buscar diretamente por complexidades conhecidas após quebra
          /Complexidade:\s*\n\s*(?:Atenção\s+Básica|Baixa\s+Complexidade|Média\s+Complexidade|Alta\s+Complexidade)/i,
          // Padrão 3: NOVO - Buscar "Média Complexidade" em qualquer lugar após "Complexidade:"
          /(?:Complexidade:[\s\S]*?)(Média\s+Complexidade|Atenção\s+Básica|Baixa\s+Complexidade|Alta\s+Complexidade)(?=[\s\S]*?(?:Modalidade|Instrumento|Tipo|Valor|Sexo|Idade|CBO|CID|Habilitação|Grupo|Serviço|$))/i,
          // Padrão 4: Original - ESPECÍFICO para múltiplos espaços (15-50 espaços como no SIGTAP real)
          /Complexidade:\s{15,50}(.+?)(?=\s*(?:Modalidade|Instrumento|Tipo|Valor|Sexo|Idade|CBO|CID|Habilitação|Grupo|Serviço|$))/i,
          // Padrão 5: Original - Flexível para qualquer quantidade de espaços  
          /Complexidade:\s+(.+?)(?=\s*(?:Modalidade|Instrumento|Tipo|Valor|Sexo|Idade|CBO|CID|Habilitação|Grupo|Serviço|$))/i,
          // Padrão 6: Original - Formato original (mantido para compatibilidade)
          new RegExp(`${fieldName}[:\\s]*([^\\n\\r]+)`, 'i'),
          // Padrão 7: Original - Busca direta por valores conhecidos (case insensitive)
          /(?:Complexidade[:\s]*)?(?:Atenção\s+Básica|Baixa\s+Complexidade|Média\s+Complexidade|Alta\s+Complexidade)/i,
          // Padrão 8: Original - Busca apenas pelas palavras-chave (mais flexível)
          /(?:ATENÇÃO|BAIXA|MÉDIA|ALTA)(?:\s+(?:BÁSICA|COMPLEXIDADE))?/i,
          // Padrão 9: Original - Linha que contenha as complexidades específicas
          /(?:ATENÇÃO BÁSICA|BAIXA COMPLEXIDADE|MÉDIA COMPLEXIDADE|ALTA COMPLEXIDADE)/i,
          // Padrão 10: Original - Versão sem acentos
          /(?:Atencao\s+Basica|Media\s+Complexidade)/i
        ],
        'Tipo de Financiamento': [
          // Padrão principal: "Tipo de Financiamento: 06 - Média e Alta Complexidade (MAC)"
          new RegExp(`${fieldName}[:\\s]*([^\\n\\r]+)`, 'i'),
          // Buscar diretamente por códigos e descrições de financiamento
          /(\d{2}\s*-\s*[^(]*\s*\([^)]*\))/i, // 06 - Média e Alta Complexidade (MAC)
          /(\d{2}\s*-\s*[^\\n\\r]+)/i, // 01 - Atenção Básica
          // Códigos específicos conhecidos
          /(?:PAB|MAC|FAEC|FAECP|GMAQ)/i,
          // Padrão mais amplo
          /Financiamento[:\s]*([^\\n\\r]+)/i
        ]
      };

      const fieldPatterns = patterns[fieldName] || [new RegExp(`${fieldName}[:\\s]*([^\\n\\r]+)`, 'i')];

      // DEBUG ESPECÍFICO PARA COMPLEXIDADE
      if (fieldName === 'Complexidade') {
        console.log(`🔍 [DEBUG COMPLEXIDADE] Testando ${fieldPatterns.length} padrões:`);
        fieldPatterns.forEach((pattern, index) => {
          console.log(`🔍 [DEBUG COMPLEXIDADE] Padrão ${index + 1}: ${pattern}`);
        });
      }

      for (const pattern of fieldPatterns) {
        const match = text.match(pattern);
        
        // DEBUG ESPECÍFICO PARA COMPLEXIDADE
        if (fieldName === 'Complexidade') {
          const patternIndex = fieldPatterns.indexOf(pattern) + 1;
          console.log(`🔍 [DEBUG COMPLEXIDADE] Testando Padrão ${patternIndex}: ${pattern}`);
          console.log(`🔍 [DEBUG COMPLEXIDADE] Resultado do Padrão ${patternIndex}:`, match);
          
          if (match) {
            console.log(`🔍 [DEBUG COMPLEXIDADE] Match[0]: "${match[0]}"`);
            console.log(`🔍 [DEBUG COMPLEXIDADE] Match[1]: "${match[1] || 'undefined'}"`);
            
            // Log específico para cada padrão
            if (patternIndex === 1) {
              console.log(`🎯 [DEBUG COMPLEXIDADE] PADRÃO 1 FUNCIONOU! (busca simples com acentos - ignora estrutura)`);
            } else if (patternIndex === 2) {
              console.log(`🎯 [DEBUG COMPLEXIDADE] PADRÃO 2 FUNCIONOU! (busca simples sem acentos - ignora estrutura)`);
            } else if (patternIndex === 3) {
              console.log(`🎯 [DEBUG COMPLEXIDADE] PADRÃO 3 FUNCIONOU! (valor em linha separada)`);
            } else if (patternIndex === 4) {
              console.log(`🎯 [DEBUG COMPLEXIDADE] PADRÃO 4 FUNCIONOU! (complexidades conhecidas após quebra)`);
            } else if (patternIndex === 5) {
              console.log(`🎯 [DEBUG COMPLEXIDADE] PADRÃO 5 FUNCIONOU! (busca em qualquer lugar)`);
            } else if (patternIndex === 6) {
              console.log(`🎯 [DEBUG COMPLEXIDADE] PADRÃO 6 FUNCIONOU! (múltiplos espaços 15-50)`);
            } else if (patternIndex === 7) {
              console.log(`🎯 [DEBUG COMPLEXIDADE] PADRÃO 7 FUNCIONOU! (qualquer quantidade de espaços)`);
            } else {
              console.log(`🎯 [DEBUG COMPLEXIDADE] PADRÃO ${patternIndex} FUNCIONOU! (padrão de fallback)`);
            }
          }
        }
        
        if (match) {
          let value = '';
          
          // Calcular qual padrão foi usado
          const currentPatternIndex = fieldPatterns.indexOf(pattern) + 1;
          
          // Para os padrões emergenciais (1 e 2), usar match[0] completo
          if (fieldName === 'Complexidade' && (currentPatternIndex === 1 || currentPatternIndex === 2)) {
            value = match[0].trim();
          } else {
            // Para outros padrões, usar match[1] se existir, senão match[0]
            value = match[1] ? match[1].trim() : match[0].trim();
          }
          
          if (value && value.length > 0) {
            // DEBUG ESPECÍFICO PARA COMPLEXIDADE
            if (fieldName === 'Complexidade') {
              console.log(`🎯 [DEBUG COMPLEXIDADE] VALOR CAPTURADO: "${value}"`);
            }
            return value;
          }
        }
      }

      // DEBUG ESPECÍFICO PARA COMPLEXIDADE
      if (fieldName === 'Complexidade') {
        console.log(`❌ [DEBUG COMPLEXIDADE] NENHUM PADRÃO FUNCIONOU!`);
      }

      return '';
    } catch (error) {
      // DEBUG ESPECÍFICO PARA COMPLEXIDADE
      if (fieldName === 'Complexidade') {
        console.log(`💥 [DEBUG COMPLEXIDADE] ERRO:`, error);
      }
      return '';
    }
  }

  private extractPositionalField(
    text: string,
    fieldName: string,
    positionMap?: Map<string, { x: number, y: number, text: string }>
  ): string {
    try {
      // Se não há mapa posicional, usar método sequencial como fallback
      if (!positionMap) {
        return this.extractSequentialField(text, fieldName);
      }

      // Buscar campo no mapa posicional
      let fieldValue = '';
      
      // Primeiro, encontrar o label do campo
      for (const [key, position] of positionMap) {
        const labelText = position.text.toLowerCase();
        const searchField = fieldName.toLowerCase();
        
        // Verificar se encontrou o label (com variações)
        let isLabelFound = false;
        if (searchField.includes('origem')) {
          isLabelFound = labelText.includes('origem');
        } else if (searchField.includes('modalidade')) {
          isLabelFound = labelText.includes('modalidade');
        } else if (searchField.includes('instrumento')) {
          isLabelFound = labelText.includes('instrumento') && labelText.includes('registro');
        } else {
          isLabelFound = labelText.includes(searchField);
        }
        
        if (isLabelFound) {
          const labelY = position.y;
          const labelX = position.x;
          
          // Para campos posicionais, buscar ABAIXO primeiro (padrão SIGTAP)
          const valuesToCheck: string[] = [];
          
          // 1. Buscar na linha ABAIXO (padrão principal para SIGTAP)
          for (const [valueKey, valuePos] of positionMap) {
            const verticalDistance = labelY - valuePos.y; // labelY > valuePos.y = abaixo
            const horizontalDistance = Math.abs(valuePos.x - labelX);
            
            // Valor deve estar abaixo (10-40px) e alinhado horizontalmente (<100px)
            if (verticalDistance > 10 && verticalDistance < 40 && horizontalDistance < 100) {
              const candidateValue = valuePos.text.trim();
              if (candidateValue && this.isValidFieldValue(candidateValue, fieldName)) {
                valuesToCheck.push(candidateValue);
              }
            }
          }
          
          // 2. Se não encontrou abaixo, buscar à direita (fallback)
          if (valuesToCheck.length === 0) {
            for (const [valueKey, valuePos] of positionMap) {
              if (valuePos.y === labelY && valuePos.x > labelX) {
                const distance = valuePos.x - labelX;
                if (distance > 10 && distance < 200) {
                  const candidateValue = valuePos.text.trim();
                  if (candidateValue && this.isValidFieldValue(candidateValue, fieldName)) {
                    valuesToCheck.push(candidateValue);
                  }
                }
              }
            }
          }
          
          // Retornar o primeiro valor válido encontrado
          if (valuesToCheck.length > 0) {
            // Para múltiplos valores, concatenar (ex: modalidades múltiplas)
            fieldValue = valuesToCheck.join(' / ');
            break;
          }
        }
      }

      return fieldValue || this.extractSequentialField(text, fieldName);
    } catch {
      return this.extractSequentialField(text, fieldName);
    }
  }

  private isValidFieldValue(value: string, fieldName: string): boolean {
    if (!value || value.length === 0) return false;
    
    // Filtrar valores que claramente não são do campo
    const lowerValue = value.toLowerCase();
    const lowerField = fieldName.toLowerCase();
    
    // Não deve ser o próprio nome do campo
    if (lowerValue.includes(lowerField)) return false;
    
    // Padrões específicos por campo
    if (lowerField.includes('origem')) {
      // Origem deve ter padrão como H.32013035, A.01023012
      return /^[A-Z]\.\d{8}$/.test(value) || /^[A-Z]\d{8}$/.test(value);
    } else if (lowerField.includes('modalidade')) {
      // Modalidade deve ter padrão como "02 - Hospitalar"
      return /^\d{2}\s*-\s*.+/.test(value);
    } else if (lowerField.includes('instrumento')) {
      // Instrumento deve ter padrão como "03 - AIH (Proc. Principal)"
      return /^\d{2}\s*-\s*.+/.test(value);
    }
    
    // Para outros campos, aceitar se não for vazio e não contiver o nome do campo
    return value.length > 0;
  }

  private normalizeComplexity(complexity: string): string {
    if (!complexity) return '';
    
    // DEBUG ESPECÍFICO PARA COMPLEXIDADE
    console.log(`🔧 [NORMALIZE COMPLEXIDADE] Input: "${complexity}"`);
    
    const normalized = complexity
      .toUpperCase()
      .trim()
      // Normalizar acentos
      .replace(/[ÀÁÂÃÄÅ]/g, 'A')
      .replace(/[ÈÉÊË]/g, 'E')
      .replace(/[ÌÍÎÏ]/g, 'I')
      .replace(/[ÒÓÔÕÖ]/g, 'O')
      .replace(/[ÙÚÛÜ]/g, 'U')
      .replace(/Ç/g, 'C')
      // Remover múltiplos espaços
      .replace(/\s+/g, ' ');
    
    console.log(`🔧 [NORMALIZE COMPLEXIDADE] Normalized: "${normalized}"`);
    
    // Mapeamento de complexidades (mais abrangente)
    const complexityMap: { [key: string]: string } = {
      // Variações de Atenção Básica
      'ATENCAO': 'ATENÇÃO BÁSICA',
      'ATENÇÃO': 'ATENÇÃO BÁSICA',
      'BASICA': 'ATENÇÃO BÁSICA',
      'BÁSICA': 'ATENÇÃO BÁSICA',
      'ATENCAO BASICA': 'ATENÇÃO BÁSICA',
      'ATENÇÃO BASICA': 'ATENÇÃO BÁSICA',
      'ATENÇÃO BÁSICA': 'ATENÇÃO BÁSICA',
      // Variações de Baixa
      'BAIXA': 'BAIXA COMPLEXIDADE',
      'BAIXA COMPLEXIDADE': 'BAIXA COMPLEXIDADE',
      // Variações de Média
      'MEDIA': 'MÉDIA COMPLEXIDADE',
      'MÉDIA': 'MÉDIA COMPLEXIDADE',
      'MEDIA COMPLEXIDADE': 'MÉDIA COMPLEXIDADE',
      'MÉDIA COMPLEXIDADE': 'MÉDIA COMPLEXIDADE',
      // Variações de Alta
      'ALTA': 'ALTA COMPLEXIDADE',
      'ALTA COMPLEXIDADE': 'ALTA COMPLEXIDADE'
    };

    // Verificar mapeamentos diretos
    for (const [key, value] of Object.entries(complexityMap)) {
      if (normalized.includes(key)) {
        console.log(`🎯 [NORMALIZE COMPLEXIDADE] Mapeamento encontrado: "${key}" -> "${value}"`);
        return value;
      }
    }

    // Se já está no formato padrão, retornar
    const standardComplexities = ['ATENÇÃO BÁSICA', 'BAIXA COMPLEXIDADE', 'MÉDIA COMPLEXIDADE', 'ALTA COMPLEXIDADE'];
    if (standardComplexities.includes(normalized)) {
      console.log(`🎯 [NORMALIZE COMPLEXIDADE] Formato padrão detectado: "${normalized}"`);
      return normalized;
    }

    console.log(`⚠️ [NORMALIZE COMPLEXIDADE] Não mapeado, retornando original: "${normalized}"`);
    return normalized;
  }

  getExtractionMethod(): 'sequential' | 'positional' | 'hybrid' {
    return 'hybrid';
  }

  getFieldNames(): string[] {
    return ['origem', 'complexity', 'modality', 'registrationInstrument', 'financing', 'especialidadeLeito'];
  }

  getExtractionStats() {
    return { ...this.stats };
  }

  resetStats(): void {
    this.stats = { successful: 0, failed: 0, confidence: 0 };
  }
} 
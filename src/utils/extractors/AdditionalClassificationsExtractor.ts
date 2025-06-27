import { CategoryExtractor, AdditionalClassificationsResult } from './index';

/**
 * EXTRACTOR DE CLASSIFICAÇÕES ADICIONAIS
 * Responsável por extrair CBO, CID, habilitações e outras classificações
 * Método: Híbrido (sequencial + posicional) com patterns específicos para códigos
 */
export class AdditionalClassificationsExtractor implements CategoryExtractor {
  private stats = { successful: 0, failed: 0, confidence: 0 };

  extract(
    blockText: string, 
    positionMap?: Map<string, { x: number, y: number, text: string }>
  ): AdditionalClassificationsResult {
    try {
      // EXTRAÇÃO DE CÓDIGOS E ARRAYS
      const cbo = this.extractCodeArray(blockText, 'CBO', positionMap);
      const cid = this.extractCodeArray(blockText, 'CID', positionMap);

      // EXTRAÇÃO DE CAMPOS TEXTUAIS
      const habilitation = this.extractSequentialField(blockText, 'Habilitação');
      const habilitationGroup = this.extractArrayField(blockText, 'Grupo de Habilitação');
      const serviceClassification = this.extractSequentialField(blockText, 'Serviço/Classificação');
      const especialidadeLeito = this.extractSequentialField(blockText, 'Especialidade Leito');
      
      // Campo complementar (usado como fallback para origem em alguns casos)
      const complementaryAttribute = this.extractSequentialField(blockText, 'Atributo Complementar') || 
                                   this.extractSequentialField(blockText, 'Origem') ||
                                   '';

      // Calcular confiança baseada nos campos extraídos
      let extractedCount = 0;
      if (cbo.length > 0) extractedCount++;
      if (cid.length > 0) extractedCount++;
      if (habilitation && habilitation !== '') extractedCount++;
      if (habilitationGroup.length > 0) extractedCount++;
      if (serviceClassification && serviceClassification !== '') extractedCount++;
      if (especialidadeLeito && especialidadeLeito !== '') extractedCount++;
      if (complementaryAttribute && complementaryAttribute !== '') extractedCount++;

      this.stats.confidence = Math.round((extractedCount / 7) * 100);

      // Validação de consistência para códigos
      if (cbo.length > 0) {
        const validCBOs = cbo.filter(code => this.isValidCBOCode(code));
        if (validCBOs.length !== cbo.length) {
          this.stats.confidence = Math.max(this.stats.confidence - 10, 0);
        }
      }

      if (cid.length > 0) {
        const validCIDs = cid.filter(code => this.isValidCIDCode(code));
        if (validCIDs.length !== cid.length) {
          this.stats.confidence = Math.max(this.stats.confidence - 10, 0);
        }
      }

      if (extractedCount > 0) {
        this.stats.successful++;
      } else {
        this.stats.failed++;
      }

      return {
        cbo,
        cid,
        habilitation,
        habilitationGroup,
        serviceClassification,
        especialidadeLeito,
        complementaryAttribute
      };

    } catch (error) {
      this.stats.failed++;
      this.stats.confidence = 0;

      return {
        cbo: [],
        cid: [],
        habilitation: '',
        habilitationGroup: [],
        serviceClassification: '',
        especialidadeLeito: '',
        complementaryAttribute: ''
      };
    }
  }

  private extractCodeArray(
    text: string, 
    fieldName: string, 
    positionMap?: Map<string, { x: number, y: number, text: string }>
  ): string[] {
    try {
      const codes: string[] = [];

      // MÉTODO SEQUENCIAL: Buscar padrões de código após o campo
      const sequentialCodes = this.extractSequentialCodes(text, fieldName);
      codes.push(...sequentialCodes);

      // MÉTODO POSICIONAL: Buscar códigos na posição específica
      if (positionMap) {
        const positionalCodes = this.extractPositionalCodes(text, fieldName, positionMap);
        codes.push(...positionalCodes);
      }

      // Remover duplicatas e códigos inválidos
      const uniqueCodes = [...new Set(codes)];
      const validCodes = uniqueCodes.filter(code => {
        if (fieldName === 'CBO') {
          return this.isValidCBOCode(code);
        } else if (fieldName === 'CID') {
          return this.isValidCIDCode(code);
        }
        return code && code.trim().length > 0;
      });

      return validCodes;
    } catch {
      return [];
    }
  }

  private extractSequentialCodes(text: string, fieldName: string): string[] {
    try {
      const codes: string[] = [];

      // Padrões específicos para cada tipo de código
      const patterns: RegExp[] = [];
      
      if (fieldName === 'CBO') {
        patterns.push(
          /CBO[:\s]*([0-9]{4}-\d{2})/gi,
          /CBO[:\s]*([0-9]{6})/gi,
          /([0-9]{4}-\d{2})/g,
          /CBO[:\s]*([0-9]{4})/gi
        );
      } else if (fieldName === 'CID') {
        patterns.push(
          /CID[:\s]*([A-Z]\d{2,3}(?:\.\d)?)/gi,
          /CID[:\s]*([A-Z]\d{2,3})/gi,
          /([A-Z]\d{2,3}(?:\.\d)?)/g
        );
      }

      // Buscar o campo no texto
      const fieldIndex = text.toLowerCase().indexOf(fieldName.toLowerCase());
      if (fieldIndex >= 0) {
        // Extrair texto próximo ao campo (200 caracteres depois)
        const nearbyText = text.substring(fieldIndex, fieldIndex + 200);
        
        for (const pattern of patterns) {
          let match;
          while ((match = pattern.exec(nearbyText)) !== null) {
            const code = match[1] || match[0];
            if (code && code.trim()) {
              codes.push(code.trim().toUpperCase());
            }
          }
        }
      }

      return codes;
    } catch {
      return [];
    }
  }

  private extractPositionalCodes(
    text: string,
    fieldName: string,
    positionMap: Map<string, { x: number, y: number, text: string }>
  ): string[] {
    try {
      const codes: string[] = [];

      // Buscar o campo no mapa posicional
      for (const [key, position] of positionMap) {
        if (position.text.toLowerCase().includes(fieldName.toLowerCase())) {
          const labelY = position.y;
          const labelX = position.x;
          
          // Buscar códigos nas posições adjacentes
          for (const [valueKey, valuePos] of positionMap) {
            const distance = Math.abs(valuePos.x - labelX) + Math.abs(valuePos.y - labelY);
            
            if (distance > 0 && distance < 100) { // Proximidade razoável
              const text = valuePos.text.trim();
              
              if (fieldName === 'CBO' && this.isValidCBOCode(text)) {
                codes.push(text.toUpperCase());
              } else if (fieldName === 'CID' && this.isValidCIDCode(text)) {
                codes.push(text.toUpperCase());
              }
            }
          }
          
          break;
        }
      }

      return codes;
    } catch {
      return [];
    }
  }

  private extractSequentialField(text: string, fieldName: string): string {
    try {
      // Padrões específicos para diferentes campos
      const patterns: RegExp[] = [
        new RegExp(`${fieldName}[:\\s]*([^\\n\\r]+)`, 'i'),
        new RegExp(`${fieldName.replace(/\s+/g, '\\s*')}[:\\s]*([^\\n\\r]+)`, 'i')
      ];

      for (const pattern of patterns) {
        const match = text.match(pattern);
        if (match && match[1]) {
          const value = match[1].trim();
          if (value && value.length > 0 && !this.isNumericCode(value)) {
            return value;
          }
        }
      }

      return '';
    } catch {
      return '';
    }
  }

  private extractArrayField(text: string, fieldName: string): string[] {
    try {
      const value = this.extractSequentialField(text, fieldName);
      if (!value) return [];

      // Dividir por separadores comuns
      const items = value
        .split(/[;,\|\/]/)
        .map(item => item.trim())
        .filter(item => item.length > 0);

      return items;
    } catch {
      return [];
    }
  }

  private isValidCBOCode(code: string): boolean {
    if (!code) return false;
    
    // Padrões válidos para CBO:
    // XXXX-XX (formato com hífen)
    // XXXXXX (6 dígitos)
    // XXXX (4 dígitos)
    const patterns = [
      /^\d{4}-\d{2}$/, // 1234-56
      /^\d{6}$/, // 123456
      /^\d{4}$/ // 1234
    ];

    return patterns.some(pattern => pattern.test(code.trim()));
  }

  private isValidCIDCode(code: string): boolean {
    if (!code) return false;
    
    // Padrões válidos para CID:
    // AXX ou AXXX (letra + 2 ou 3 dígitos)
    // AXX.X (com subcategoria)
    const patterns = [
      /^[A-Z]\d{2,3}(\.\d)?$/, // A12 ou A123 ou A12.3
      /^[A-Z]\d{2,3}$/ // A12 ou A123
    ];

    return patterns.some(pattern => pattern.test(code.trim().toUpperCase()));
  }

  private isNumericCode(value: string): boolean {
    // Verificar se o valor parece ser um código numérico
    return /^\d+(-\d+)?$/.test(value.trim());
  }

  getExtractionMethod(): 'sequential' | 'positional' | 'hybrid' {
    return 'hybrid';
  }

  getFieldNames(): string[] {
    return ['cbo', 'cid', 'habilitation', 'habilitationGroup', 'serviceClassification', 'especialidadeLeito', 'complementaryAttribute'];
  }

  getExtractionStats() {
    return { ...this.stats };
  }

  resetStats(): void {
    this.stats = { successful: 0, failed: 0, confidence: 0 };
  }
} 
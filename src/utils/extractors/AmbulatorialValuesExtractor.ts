import { CategoryExtractor, AmbulatorialValuesResult } from './index';

/**
 * EXTRACTOR DE VALORES AMBULATORIAIS
 * Responsável por extrair valores ambulatoriais (SA e Total)
 * Método: Sequencial com patterns específicos para valores monetários
 */
export class AmbulatorialValuesExtractor implements CategoryExtractor {
  private stats = { successful: 0, failed: 0, confidence: 0 };

  extract(blockText: string): AmbulatorialValuesResult {
    try {
      const valueAmb = this.extractSequentialValue(blockText, 'Valor Ambulatorial S.A.');
      const valueAmbTotal = this.extractSequentialValue(blockText, 'Valor Ambulatorial Total');

      // Calcular confiança baseada nos valores extraídos
      let extractedCount = 0;
      if (valueAmb > 0) extractedCount++;
      if (valueAmbTotal > 0) extractedCount++;

      this.stats.confidence = Math.round((extractedCount / 2) * 100);

      if (extractedCount > 0) {
        this.stats.successful++;
      } else {
        this.stats.failed++;
      }

      return {
        valueAmb,
        valueAmbTotal
      };

    } catch (error) {
      this.stats.failed++;
      this.stats.confidence = 0;

      return {
        valueAmb: 0,
        valueAmbTotal: 0
      };
    }
  }

  private extractSequentialValue(text: string, fieldName: string): number {
    try {
      // Padrões específicos para cada tipo de valor ambulatorial
      const patterns: RegExp[] = [
        // Padrão principal: "Campo: R$ 00,00"
        new RegExp(`${fieldName}[:\\s]*R?\\$?\\s*([\\d.,]+)`, 'i'),
        
        // Padrão alternativo: "Campo 00,00"
        new RegExp(`${fieldName}[\\s]*([\\d.,]+)`, 'i'),
        
        // Padrão simplificado para SA e Total
        fieldName.includes('S.A.') 
          ? /Ambulatorial\s*S\.?A\.?[:\s]*R?\$?\s*([\d.,]+)/i
          : /Ambulatorial\s*Total[:\s]*R?\$?\s*([\d.,]+)/i,
          
        // Padrão numérico direto após o campo
        new RegExp(`${fieldName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}[^\\d]*(\\d+[.,]\\d+)`, 'i')
      ];

      for (const pattern of patterns) {
        const match = text.match(pattern);
        if (match && match[1]) {
          const valueStr = match[1];
          const numericValue = this.parseMonetaryValue(valueStr);
          
          if (numericValue > 0) {
            return numericValue;
          }
        }
      }

      // Fallback: buscar por padrões de valor próximos ao campo
      const fieldIndex = text.toLowerCase().indexOf(fieldName.toLowerCase());
      if (fieldIndex >= 0) {
        const nearbyText = text.substring(fieldIndex, fieldIndex + 100);
        const valueMatch = nearbyText.match(/(\d+[.,]\d+)/);
        if (valueMatch) {
          return this.parseMonetaryValue(valueMatch[1]);
        }
      }

      return 0;
    } catch {
      return 0;
    }
  }

  private parseMonetaryValue(valueStr: string): number {
    try {
      if (!valueStr) return 0;

      // Limpar e normalizar o valor
      const cleaned = valueStr
        .replace(/[^\d.,]/g, '') // Remover tudo exceto dígitos, vírgula e ponto
        .trim();

      if (!cleaned) return 0;

      // Tratar diferentes formatos de números
      let normalized = cleaned;

      // Se há tanto vírgula quanto ponto, assumir formato brasileiro (1.234,56)
      if (normalized.includes('.') && normalized.includes(',')) {
        // Formato: 1.234,56 -> 1234.56
        normalized = normalized.replace(/\./g, '').replace(',', '.');
      } 
      // Se há apenas vírgula, assumir decimal brasileiro (123,56)
      else if (normalized.includes(',') && !normalized.includes('.')) {
        // Verificar se é decimal (máximo 2 dígitos após vírgula) ou milhares
        const parts = normalized.split(',');
        if (parts.length === 2 && parts[1].length <= 2) {
          // É decimal: 123,56 -> 123.56
          normalized = normalized.replace(',', '.');
        } else {
          // É separador de milhares: 1,234 -> 1234
          normalized = normalized.replace(/,/g, '');
        }
      }

      const parsed = parseFloat(normalized);
      return isNaN(parsed) ? 0 : Math.round(parsed * 100) / 100; // Arredondar para 2 casas decimais

    } catch {
      return 0;
    }
  }

  getExtractionMethod(): 'sequential' | 'positional' | 'hybrid' {
    return 'sequential';
  }

  getFieldNames(): string[] {
    return ['valueAmb', 'valueAmbTotal'];
  }

  getExtractionStats() {
    return { ...this.stats };
  }

  resetStats(): void {
    this.stats = { successful: 0, failed: 0, confidence: 0 };
  }
} 
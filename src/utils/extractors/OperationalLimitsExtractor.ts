import { CategoryExtractor, OperationalLimitsResult } from './index';

/**
 * EXTRACTOR DE LIMITES OPERACIONAIS
 * Responsável por extrair quantidade máxima, média de permanência e pontos
 * Método: Sequencial com patterns específicos para números
 */
export class OperationalLimitsExtractor implements CategoryExtractor {
  private stats = { successful: 0, failed: 0, confidence: 0 };

  extract(blockText: string): OperationalLimitsResult {
    try {
      const maxQuantity = this.extractSequentialNumber(blockText, 'Quantidade Máxima');
      const averageStay = this.extractSequentialNumber(blockText, 'Média Permanência', true); // true para aceitar decimais
      const points = this.extractSequentialNumber(blockText, 'Pontos');

      // Calcular confiança baseada nos valores extraídos
      let extractedCount = 0;
      if (maxQuantity > 0) extractedCount++;
      if (averageStay > 0) extractedCount++;
      if (points > 0) extractedCount++;

      this.stats.confidence = Math.round((extractedCount / 3) * 100);

      // Validação de consistência para limites operacionais
      if (maxQuantity > 0 && maxQuantity > 999) {
        // Quantidade máxima muito alta é suspeita
        this.stats.confidence = Math.max(this.stats.confidence - 10, 0);
      }

      if (averageStay > 0 && averageStay > 365) {
        // Permanência média muito alta é suspeita (mais de 1 ano)
        this.stats.confidence = Math.max(this.stats.confidence - 10, 0);
      }

      if (extractedCount > 0) {
        this.stats.successful++;
      } else {
        this.stats.failed++;
      }

      return {
        maxQuantity,
        averageStay,
        points
      };

    } catch (error) {
      this.stats.failed++;
      this.stats.confidence = 0;

      return {
        maxQuantity: 0,
        averageStay: 0,
        points: 0
      };
    }
  }

  private extractSequentialNumber(text: string, fieldName: string, allowDecimals = false): number {
    try {
      // Padrões específicos para cada tipo de campo numérico
      const patterns: RegExp[] = [
        // Padrão principal: "Campo: 123" ou "Campo: 123,45"
        allowDecimals
          ? new RegExp(`${fieldName}[:\\s]*([\\d.,]+)`, 'i')
          : new RegExp(`${fieldName}[:\\s]*(\\d+)`, 'i'),
        
        // Padrões específicos para cada campo
        this.getSpecificPattern(fieldName, allowDecimals),
        
        // Padrão numérico direto após o campo
        allowDecimals
          ? new RegExp(`${fieldName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}[^\\d]*(\\d+[.,]?\\d*)`, 'i')
          : new RegExp(`${fieldName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}[^\\d]*(\\d+)`, 'i')
      ];

      for (const pattern of patterns) {
        if (!pattern) continue;
        
        const match = text.match(pattern);
        if (match && match[1]) {
          const valueStr = match[1];
          const numericValue = allowDecimals 
            ? this.parseDecimalValue(valueStr)
            : this.parseIntegerValue(valueStr);
          
          if (numericValue > 0) {
            return numericValue;
          }
        }
      }

      // Fallback: buscar por números próximos ao campo
      const fieldIndex = text.toLowerCase().indexOf(fieldName.toLowerCase());
      if (fieldIndex >= 0) {
        const nearbyText = text.substring(fieldIndex, fieldIndex + 100);
        const numberPattern = allowDecimals ? /(\d+[.,]?\d*)/ : /(\d+)/;
        const numberMatch = nearbyText.match(numberPattern);
        if (numberMatch) {
          return allowDecimals 
            ? this.parseDecimalValue(numberMatch[1])
            : this.parseIntegerValue(numberMatch[1]);
        }
      }

      return 0;
    } catch {
      return 0;
    }
  }

  private getSpecificPattern(fieldName: string, allowDecimals: boolean): RegExp | null {
    try {
      if (fieldName.includes('Quantidade')) {
        return /Quantidade\s*Máxima[:\s]*(\d+)/i;
      } else if (fieldName.includes('Permanência')) {
        return allowDecimals 
          ? /(?:Média\s*)?Permanência[:\s]*([\d.,]+)/i
          : /(?:Média\s*)?Permanência[:\s]*(\d+)/i;
      } else if (fieldName.includes('Pontos')) {
        return /Pontos[:\s]*(\d+)/i;
      }
      return null;
    } catch {
      return null;
    }
  }

  private parseIntegerValue(valueStr: string): number {
    try {
      if (!valueStr) return 0;

      // Limpar string e extrair apenas dígitos
      const cleaned = valueStr.replace(/[^\d]/g, '');
      
      if (!cleaned) return 0;

      const parsed = parseInt(cleaned);
      return isNaN(parsed) ? 0 : parsed;

    } catch {
      return 0;
    }
  }

  private parseDecimalValue(valueStr: string): number {
    try {
      if (!valueStr) return 0;

      // Limpar e normalizar o valor
      const cleaned = valueStr
        .replace(/[^\d.,]/g, '') // Remover tudo exceto dígitos, vírgula e ponto
        .trim();

      if (!cleaned) return 0;

      // Tratar diferentes formatos de números
      let normalized = cleaned;

      // Se há vírgula, assumir formato brasileiro (123,45)
      if (normalized.includes(',')) {
        // Verificar se é decimal (máximo 2 dígitos após vírgula)
        const parts = normalized.split(',');
        if (parts.length === 2 && parts[1].length <= 2) {
          // É decimal: 123,45 -> 123.45
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
    return ['maxQuantity', 'averageStay', 'points'];
  }

  getExtractionStats() {
    return { ...this.stats };
  }

  resetStats(): void {
    this.stats = { successful: 0, failed: 0, confidence: 0 };
  }
} 
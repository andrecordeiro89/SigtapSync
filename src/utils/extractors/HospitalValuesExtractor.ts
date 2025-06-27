import { CategoryExtractor, HospitalValuesResult } from './index';

/**
 * EXTRACTOR DE VALORES HOSPITALARES
 * Responsável por extrair valores hospitalares (SH, SP e Total)
 * Método: Sequencial com patterns específicos para valores monetários hospitalares
 */
export class HospitalValuesExtractor implements CategoryExtractor {
  private stats = { successful: 0, failed: 0, confidence: 0 };

  extract(blockText: string): HospitalValuesResult {
    try {
      const valueHosp = this.extractSequentialValue(blockText, 'Valor Hospitalar S.H');
      const valueProf = this.extractSequentialValue(blockText, 'Valor Hospitalar S.P');
      const valueHospTotal = this.extractSequentialValue(blockText, 'Valor Hospitalar Total');

      // Calcular confiança baseada nos valores extraídos
      let extractedCount = 0;
      if (valueHosp > 0) extractedCount++;
      if (valueProf > 0) extractedCount++;
      if (valueHospTotal > 0) extractedCount++;

      this.stats.confidence = Math.round((extractedCount / 3) * 100);

      // Validação de consistência: Total deve ser aproximadamente SH + SP
      if (valueHosp > 0 && valueProf > 0 && valueHospTotal > 0) {
        const calculatedTotal = valueHosp + valueProf;
        const difference = Math.abs(valueHospTotal - calculatedTotal);
        const tolerance = Math.max(calculatedTotal * 0.05, 0.01); // 5% de tolerância

        if (difference <= tolerance) {
          this.stats.confidence = Math.min(this.stats.confidence + 10, 100); // Bonus de consistência
        }
      }

      if (extractedCount > 0) {
        this.stats.successful++;
      } else {
        this.stats.failed++;
      }

      return {
        valueHosp,
        valueProf,
        valueHospTotal
      };

    } catch (error) {
      this.stats.failed++;
      this.stats.confidence = 0;

      return {
        valueHosp: 0,
        valueProf: 0,
        valueHospTotal: 0
      };
    }
  }

  private extractSequentialValue(text: string, fieldName: string): number {
    try {
      // Padrões específicos para cada tipo de valor hospitalar
      const patterns: RegExp[] = [
        // Padrão principal: "Campo: R$ 00,00"
        new RegExp(`${fieldName}[:\\s]*R?\\$?\\s*([\\d.,]+)`, 'i'),
        
        // Padrão alternativo: "Campo 00,00"
        new RegExp(`${fieldName}[\\s]*([\\d.,]+)`, 'i'),
        
        // Padrões específicos para cada tipo
        this.getSpecificPattern(fieldName),
        
        // Padrão numérico direto após o campo
        new RegExp(`${fieldName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}[^\\d]*(\\d+[.,]\\d+)`, 'i')
      ];

      for (const pattern of patterns) {
        if (!pattern) continue;
        
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

  private getSpecificPattern(fieldName: string): RegExp | null {
    try {
      if (fieldName.includes('S.H')) {
        return /Hospitalar\s*S\.?H\.?[:\s]*R?\$?\s*([\d.,]+)/i;
      } else if (fieldName.includes('S.P')) {
        return /Hospitalar\s*S\.?P\.?[:\s]*R?\$?\s*([\d.,]+)/i;
      } else if (fieldName.includes('Total')) {
        return /Hospitalar\s*Total[:\s]*R?\$?\s*([\d.,]+)/i;
      }
      return null;
    } catch {
      return null;
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
    return ['valueHosp', 'valueProf', 'valueHospTotal'];
  }

  getExtractionStats() {
    return { ...this.stats };
  }

  resetStats(): void {
    this.stats = { successful: 0, failed: 0, confidence: 0 };
  }
} 
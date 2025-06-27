import { CategoryExtractor, EligibilityResult } from './index';

/**
 * EXTRACTOR DE CRITÉRIOS DE ELEGIBILIDADE
 * Responsável por extrair sexo, idades mínima e máxima com unidades
 * Método: Sequencial com patterns específicos para critérios
 */
export class EligibilityExtractor implements CategoryExtractor {
  private stats = { successful: 0, failed: 0, confidence: 0 };

  extract(blockText: string): EligibilityResult {
    try {
      const gender = this.extractSequentialField(blockText, 'Sexo');
      const minAgeResult = this.extractSequentialAge(blockText, 'Idade Mínima');
      const maxAgeResult = this.extractSequentialAge(blockText, 'Idade Máxima');

      // Calcular confiança baseada nos campos extraídos
      let extractedCount = 0;
      if (gender && gender !== '') extractedCount++;
      if (minAgeResult.value > 0) extractedCount++;
      if (maxAgeResult.value > 0) extractedCount++;

      this.stats.confidence = Math.round((extractedCount / 3) * 100);

      // Validação de consistência: idade mínima deve ser menor que máxima
      if (minAgeResult.value > 0 && maxAgeResult.value > 0) {
        if (minAgeResult.value <= maxAgeResult.value && minAgeResult.unit === maxAgeResult.unit) {
          this.stats.confidence = Math.min(this.stats.confidence + 10, 100); // Bonus de consistência
        }
      }

      if (extractedCount > 0) {
        this.stats.successful++;
      } else {
        this.stats.failed++;
      }

      return {
        gender: this.normalizeGender(gender),
        minAge: minAgeResult.value,
        minAgeUnit: minAgeResult.unit,
        maxAge: maxAgeResult.value,
        maxAgeUnit: maxAgeResult.unit
      };

    } catch (error) {
      this.stats.failed++;
      this.stats.confidence = 0;

      return {
        gender: '',
        minAge: 0,
        minAgeUnit: '',
        maxAge: 0,
        maxAgeUnit: ''
      };
    }
  }

  private extractSequentialField(text: string, fieldName: string): string {
    try {
      // Padrões específicos para sexo
      if (fieldName === 'Sexo') {
        const patterns = [
          /Sexo[:\s]*([MF]|Masculino|Feminino|Ambos|AMBOS)/i,
          /(?:Sexo[:\s]*)?([MF])\b/i,
          /(?:MASCULINO|FEMININO|AMBOS)/i
        ];

        for (const pattern of patterns) {
          const match = text.match(pattern);
          if (match) {
            return match[1] || match[0];
          }
        }
      }

      // Padrão genérico
      const genericPattern = new RegExp(`${fieldName}[:\\s]*([^\\n\\r]+)`, 'i');
      const match = text.match(genericPattern);
      return match ? match[1].trim() : '';

    } catch {
      return '';
    }
  }

  private extractSequentialAge(text: string, fieldName: string): { value: number, unit: string } {
    try {
      // Padrões específicos para idades
      const patterns = [
        // Padrão principal: "Idade Mínima: 18 Anos"
        new RegExp(`${fieldName}[:\\s]*(\\d+)\\s*(Anos?|Meses?|Dias?)`, 'i'),
        
        // Padrão alternativo: "Idade Mínima 18 A"
        new RegExp(`${fieldName}[:\\s]*(\\d+)\\s*([AMD])`, 'i'),
        
        // Padrão numérico simples: "Idade Mínima: 18"
        new RegExp(`${fieldName}[:\\s]*(\\d+)`, 'i'),
        
        // Padrão invertido: "18 Anos Idade Mínima"
        new RegExp(`(\\d+)\\s*(Anos?|Meses?|Dias?)\\s*${fieldName}`, 'i')
      ];

      for (const pattern of patterns) {
        const match = text.match(pattern);
        if (match && match[1]) {
          const value = parseInt(match[1]);
          let unit = match[2] ? match[2].trim() : '';
          
          if (value > 0) {
            unit = this.normalizeAgeUnit(unit);
            
            // Se não há unidade específica, inferir baseado no valor
            if (!unit) {
              unit = this.inferAgeUnit(value);
            }
            
            return { value, unit };
          }
        }
      }

      // Fallback: buscar idade próxima ao campo
      const fieldIndex = text.toLowerCase().indexOf(fieldName.toLowerCase());
      if (fieldIndex >= 0) {
        const nearbyText = text.substring(fieldIndex, fieldIndex + 50);
        const ageMatch = nearbyText.match(/(\d+)/);
        if (ageMatch) {
          const value = parseInt(ageMatch[1]);
          return { 
            value, 
            unit: this.inferAgeUnit(value)
          };
        }
      }

      return { value: 0, unit: '' };
    } catch {
      return { value: 0, unit: '' };
    }
  }

  private normalizeGender(gender: string): string {
    if (!gender) return '';
    
    const normalized = gender.toUpperCase().trim();
    
    // Mapeamento de gêneros
    const genderMap: { [key: string]: string } = {
      'MASCULINO': 'M',
      'FEMININO': 'F',
      'MALE': 'M',
      'FEMALE': 'F',
      'HOMEM': 'M',
      'MULHER': 'F',
      'AMBOS': 'AMBOS',
      'BOTH': 'AMBOS'
    };

    // Verificar mapeamentos diretos
    for (const [key, value] of Object.entries(genderMap)) {
      if (normalized.includes(key)) {
        return value;
      }
    }

    // Se já está no formato padrão (M, F, AMBOS)
    if (['M', 'F', 'AMBOS'].includes(normalized)) {
      return normalized;
    }

    return normalized;
  }

  private normalizeAgeUnit(unit: string): string {
    if (!unit) return '';
    
    const normalized = unit.toUpperCase().trim();
    
    // Mapeamento de unidades
    const unitMap: { [key: string]: string } = {
      'A': 'ANOS',
      'ANO': 'ANOS',
      'ANOS': 'ANOS',
      'YEAR': 'ANOS',
      'YEARS': 'ANOS',
      'M': 'MESES',
      'MES': 'MESES',
      'MESES': 'MESES',
      'MONTH': 'MESES',
      'MONTHS': 'MESES',
      'D': 'DIAS',
      'DIA': 'DIAS',
      'DIAS': 'DIAS',
      'DAY': 'DIAS',
      'DAYS': 'DIAS'
    };

    for (const [key, value] of Object.entries(unitMap)) {
      if (normalized.includes(key)) {
        return value;
      }
    }

    return normalized;
  }

  private inferAgeUnit(value: number): string {
    // Inferir unidade baseada no valor
    if (value <= 31) {
      return 'DIAS'; // Até 31 provavelmente são dias
    } else if (value <= 12) {
      return 'MESES'; // Até 12 provavelmente são meses
    } else if (value <= 120) {
      return 'ANOS'; // Até 120 provavelmente são anos
    } else {
      return 'DIAS'; // Valores altos provavelmente são dias
    }
  }

  getExtractionMethod(): 'sequential' | 'positional' | 'hybrid' {
    return 'sequential';
  }

  getFieldNames(): string[] {
    return ['gender', 'minAge', 'minAgeUnit', 'maxAge', 'maxAgeUnit'];
  }

  getExtractionStats() {
    return { ...this.stats };
  }

  resetStats(): void {
    this.stats = { successful: 0, failed: 0, confidence: 0 };
  }
} 
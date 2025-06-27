import { CategoryExtractor, IdentificationResult } from './index';

/**
 * EXTRACTOR DE IDENTIFICAÇÃO
 * Responsável por extrair código e descrição do procedimento
 * Método: Regex direta (mais confiável)
 */
export class IdentificationExtractor implements CategoryExtractor {
  private stats = { successful: 0, failed: 0, confidence: 0 };

  extract(blockText: string): IdentificationResult {
    try {
      // Regex para código e descrição do procedimento
      const procedureRegex = /(\d{2}\.\d{2}\.\d{2}\.\d{3}-\d)\s+Procedimento:\s*([^\n\r]+)/i;
      const match = blockText.match(procedureRegex);

      if (match) {
        const code = match[1].trim();
        const description = this.cleanDescription(match[2].trim());

        // Validar código SIGTAP
        if (this.isValidSigtapCode(code)) {
          this.stats.successful++;
          this.stats.confidence = 95; // Alta confiança para regex direta
          
          return {
            code,
            description
          };
        }
      }

      // Fallback: tentar encontrar código sem "Procedimento:"
      const fallbackMatch = blockText.match(/(\d{2}\.\d{2}\.\d{2}\.\d{3}-\d)/);
      if (fallbackMatch) {
        const code = fallbackMatch[1];
        // Tentar extrair descrição na linha seguinte
        const lines = blockText.split('\n');
        const codeLineIndex = lines.findIndex(line => line.includes(code));
        const description = codeLineIndex >= 0 && lines[codeLineIndex + 1] 
          ? this.cleanDescription(lines[codeLineIndex + 1])
          : 'Descrição não encontrada';

        this.stats.successful++;
        this.stats.confidence = 70; // Confiança média para fallback

        return {
          code,
          description
        };
      }

      this.stats.failed++;
      this.stats.confidence = 0;

      return {
        code: 'CÓDIGO_NÃO_ENCONTRADO',
        description: 'Descrição não encontrada'
      };

    } catch (error) {
      this.stats.failed++;
      this.stats.confidence = 0;
      
      return {
        code: 'ERRO_EXTRAÇÃO',
        description: 'Erro na extração: ' + (error instanceof Error ? error.message : 'Erro desconhecido')
      };
    }
  }

  private cleanDescription(description: string): string {
    return description
      .replace(/\s+/g, ' ') // Normalizar espaços
      .replace(/[^\w\s\-\(\)\,\.]/g, '') // Remover caracteres especiais
      .trim()
      .toUpperCase();
  }

  private isValidSigtapCode(code: string): boolean {
    // Padrão: XX.XX.XX.XXX-X
    const pattern = /^\d{2}\.\d{2}\.\d{2}\.\d{3}-\d$/;
    return pattern.test(code);
  }

  getExtractionMethod(): 'sequential' | 'positional' | 'hybrid' {
    return 'sequential';
  }

  getFieldNames(): string[] {
    return ['code', 'description'];
  }

  getExtractionStats() {
    return { ...this.stats };
  }

  resetStats(): void {
    this.stats = { successful: 0, failed: 0, confidence: 0 };
  }
} 
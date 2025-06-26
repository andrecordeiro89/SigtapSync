import { AIH, AIHMatch, SigtapProcedure } from '../types';

interface MatchingCriteria {
  exactCodeMatch: boolean;
  genderCompatible: boolean;
  ageCompatible: boolean;
  cidCompatible: boolean;
  valueWithinRange: boolean;
}

interface MatchingScore {
  overall: number;
  codeMatch: number;
  genderMatch: number;
  ageMatch: number;
  cidMatch: number;
  valueMatch: number;
}

export class AIHMatcher {
  private sigtapProcedures: SigtapProcedure[];

  constructor(sigtapProcedures: SigtapProcedure[] = []) {
    this.sigtapProcedures = sigtapProcedures;
  }

  /**
   * Atualiza a lista de procedimentos SIGTAP
   */
  updateSigtapProcedures(procedures: SigtapProcedure[]): void {
    this.sigtapProcedures = procedures;
    console.log(`📋 Carregados ${procedures.length} procedimentos SIGTAP para matching`);
  }

  /**
   * Realiza matching de uma AIH com procedimentos SIGTAP
   */
  async matchAIH(aih: AIH): Promise<AIHMatch[]> {
    const matches: AIHMatch[] = [];

    if (!aih.procedimentoPrincipal) {
      return matches;
    }

    try {
      // 1. Busca exata por código
      const exactMatches = this.findExactMatches(aih);
      
      // 2. Busca parcial por código similar
      const partialMatches = this.findPartialMatches(aih);
      
      // 3. Combinar e calcular scores
      const allCandidates = [...exactMatches, ...partialMatches];
      
      for (const procedure of allCandidates) {
        const matchScore = this.calculateMatchScore(aih, procedure);
        
        if (matchScore.overall >= 50) { // Threshold mínimo de 50%
          const match: AIHMatch = {
            aihId: aih.id || '',
            procedureId: procedure.id || '',
            matchType: matchScore.codeMatch === 100 ? 'exact' : 'partial',
            confidenceScore: matchScore.overall,
            validationResults: {
              genderMatch: matchScore.genderMatch === 100,
              ageMatch: matchScore.ageMatch === 100,
              cidMatch: matchScore.cidMatch >= 75,
              valueMatch: matchScore.valueMatch >= 75
            },
            status: matchScore.overall >= 85 ? 'approved' : 'pending',
            createdAt: new Date().toISOString()
          };

          // Adicionar observações se necessário
          if (matchScore.overall < 85) {
            match.observations = this.generateMatchObservations(matchScore, aih, procedure);
          }

          matches.push(match);
        }
      }

      // Ordenar por score de confiança
      matches.sort((a, b) => b.confidenceScore - a.confidenceScore);

      console.log(`🎯 Encontrados ${matches.length} matches para AIH ${aih.numeroAIH}`);
      
      return matches.slice(0, 5); // Retornar até 5 melhores matches

    } catch (error) {
      console.error('❌ Erro no matching da AIH:', error);
      return [];
    }
  }

  /**
   * Processa múltiplas AIHs em lote
   */
  async batchMatchAIHs(aihs: AIH[], progressCallback?: (progress: number) => void): Promise<AIHMatch[]> {
    const allMatches: AIHMatch[] = [];

    for (let i = 0; i < aihs.length; i++) {
      const aih = aihs[i];
      const matches = await this.matchAIH(aih);
      allMatches.push(...matches);

      // Callback de progresso
      if (progressCallback) {
        progressCallback(((i + 1) / aihs.length) * 100);
      }

      // Pequena pausa para não bloquear a UI
      if (i % 10 === 0) {
        await new Promise(resolve => setTimeout(resolve, 10));
      }
    }

    console.log(`📊 Processamento em lote concluído: ${allMatches.length} matches de ${aihs.length} AIHs`);
    
    return allMatches;
  }

  /**
   * Busca matches exatos por código
   */
  private findExactMatches(aih: AIH): SigtapProcedure[] {
    const procedureCode = aih.procedimentoPrincipal;
    
    return this.sigtapProcedures.filter(procedure => 
      procedure.code === procedureCode
    );
  }

  /**
   * Busca matches parciais por código similar
   */
  private findPartialMatches(aih: AIH): SigtapProcedure[] {
    const procedureCode = aih.procedimentoPrincipal;
    const codeBase = procedureCode.substring(0, 8); // Primeiros 8 caracteres (ex: 04.15.02)
    
    return this.sigtapProcedures.filter(procedure => 
      procedure.code !== procedureCode && // Excluir matches exatos já encontrados
      procedure.code.startsWith(codeBase)
    );
  }

  /**
   * Calcula score de matching entre AIH e procedimento SIGTAP
   */
  private calculateMatchScore(aih: AIH, procedure: SigtapProcedure): MatchingScore {
    const score: MatchingScore = {
      overall: 0,
      codeMatch: 0,
      genderMatch: 0,
      ageMatch: 0,
      cidMatch: 0,
      valueMatch: 0
    };

    // 1. Score do código (40% do peso total)
    score.codeMatch = this.calculateCodeMatchScore(aih.procedimentoPrincipal, procedure.code);

    // 2. Score do gênero (15% do peso total)
    score.genderMatch = this.calculateGenderMatchScore(aih.sexo, procedure.gender);

    // 3. Score da idade (15% do peso total)
    score.ageMatch = this.calculateAgeMatchScore(aih.nascimento, procedure);

    // 4. Score do CID (20% do peso total)
    score.cidMatch = this.calculateCidMatchScore(aih.cidPrincipal, procedure.cid);

    // 5. Score do valor (10% do peso total)
    score.valueMatch = this.calculateValueMatchScore(aih, procedure);

    // Calcular score geral
    score.overall = Math.round(
      (score.codeMatch * 0.4) +
      (score.genderMatch * 0.15) +
      (score.ageMatch * 0.15) +
      (score.cidMatch * 0.2) +
      (score.valueMatch * 0.1)
    );

    return score;
  }

  /**
   * Calcula score de match do código
   */
  private calculateCodeMatchScore(aihCode: string, sigtapCode: string): number {
    if (aihCode === sigtapCode) return 100;
    
    // Verificar similaridade parcial
    const aihParts = aihCode.split('.');
    const sigtapParts = sigtapCode.split('.');
    
    let matchingParts = 0;
    const maxParts = Math.min(aihParts.length, sigtapParts.length);
    
    for (let i = 0; i < maxParts; i++) {
      if (aihParts[i] === sigtapParts[i]) {
        matchingParts++;
      } else {
        break; // Para na primeira diferença
      }
    }
    
    return Math.round((matchingParts / 4) * 80); // Máximo 80% para match parcial
  }

  /**
   * Calcula score de match do gênero
   */
  private calculateGenderMatchScore(aihGender: 'M' | 'F', procedureGender: string): number {
    if (!procedureGender || procedureGender === 'Ambos' || procedureGender === '') {
      return 100; // Sem restrição de gênero
    }
    
    const normalizedProcedureGender = procedureGender.toLowerCase();
    
    if (
      (aihGender === 'M' && normalizedProcedureGender.includes('masculino')) ||
      (aihGender === 'F' && normalizedProcedureGender.includes('feminino'))
    ) {
      return 100;
    }
    
    return 0; // Incompatível
  }

  /**
   * Calcula score de match da idade
   */
  private calculateAgeMatchScore(birthDate: string, procedure: SigtapProcedure): number {
    if (!birthDate || !procedure.minAge || !procedure.maxAge) {
      return 100; // Sem restrição de idade
    }

    try {
      const birth = new Date(birthDate.split('/').reverse().join('-'));
      const today = new Date();
      const ageInYears = today.getFullYear() - birth.getFullYear();
      
      // Converter idades do procedimento para anos
      const minAgeYears = this.convertAgeToYears(procedure.minAge, procedure.minAgeUnit);
      const maxAgeYears = this.convertAgeToYears(procedure.maxAge, procedure.maxAgeUnit);
      
      if (ageInYears >= minAgeYears && ageInYears <= maxAgeYears) {
        return 100;
      }
      
      // Calcular score parcial se próximo da faixa
      const distance = Math.min(
        Math.abs(ageInYears - minAgeYears),
        Math.abs(ageInYears - maxAgeYears)
      );
      
      return Math.max(0, 100 - (distance * 10)); // Reduz 10 pontos por ano de diferença
      
    } catch (error) {
      console.warn('⚠️ Erro ao calcular idade:', error);
      return 50; // Score neutro em caso de erro
    }
  }

  /**
   * Converte idade para anos
   */
  private convertAgeToYears(age: number, unit: string): number {
    const unitLower = unit.toLowerCase();
    
    if (unitLower.includes('ano')) return age;
    if (unitLower.includes('mes')) return age / 12;
    if (unitLower.includes('dia')) return age / 365;
    
    return age; // Assume anos como padrão
  }

  /**
   * Calcula score de match do CID
   */
  private calculateCidMatchScore(aihCid: string, procedureCids: string[]): number {
    if (!aihCid || !procedureCids || procedureCids.length === 0) {
      return 75; // Score neutro se não há restrições de CID
    }

    // Verificar match exato
    if (procedureCids.includes(aihCid)) {
      return 100;
    }

    // Verificar match parcial (mesmo grupo de CID)
    const aihGroup = aihCid.charAt(0); // Primeira letra (ex: M de M751)
    const hasGroupMatch = procedureCids.some(cid => cid.charAt(0) === aihGroup);
    
    if (hasGroupMatch) {
      return 75;
    }

    return 25; // CID não relacionado
  }

  /**
   * Calcula score de match do valor
   */
  private calculateValueMatchScore(aih: AIH, procedure: SigtapProcedure): number {
    // Por enquanto, retorna score neutro
    // TODO: Implementar comparação de valores quando disponível na AIH
    return 75;
  }

  /**
   * Gera observações para o match
   */
  private generateMatchObservations(score: MatchingScore, aih: AIH, procedure: SigtapProcedure): string {
    const observations: string[] = [];

    if (score.codeMatch < 100) {
      observations.push(`Código parcialmente compatível (${score.codeMatch}%)`);
    }

    if (score.genderMatch < 100) {
      observations.push(`Restrição de gênero: procedimento para ${procedure.gender}, paciente ${aih.sexo}`);
    }

    if (score.ageMatch < 100) {
      observations.push(`Faixa etária: ${procedure.minAge}${procedure.minAgeUnit} a ${procedure.maxAge}${procedure.maxAgeUnit}`);
    }

    if (score.cidMatch < 75) {
      observations.push(`CID ${aih.cidPrincipal} pode não ser compatível com o procedimento`);
    }

    return observations.join('; ');
  }

  /**
   * Estatísticas de matching
   */
  getMatchingStats(matches: AIHMatch[]): {
    totalMatches: number;
    exactMatches: number;
    partialMatches: number;
    averageConfidence: number;
    approvedMatches: number;
    pendingMatches: number;
  } {
    if (matches.length === 0) {
      return {
        totalMatches: 0,
        exactMatches: 0,
        partialMatches: 0,
        averageConfidence: 0,
        approvedMatches: 0,
        pendingMatches: 0
      };
    }

    const exactMatches = matches.filter(m => m.matchType === 'exact').length;
    const partialMatches = matches.filter(m => m.matchType === 'partial').length;
    const approvedMatches = matches.filter(m => m.status === 'approved').length;
    const pendingMatches = matches.filter(m => m.status === 'pending').length;
    
    const averageConfidence = Math.round(
      matches.reduce((sum, m) => sum + m.confidenceScore, 0) / matches.length
    );

    return {
      totalMatches: matches.length,
      exactMatches,
      partialMatches,
      averageConfidence,
      approvedMatches,
      pendingMatches
    };
  }
}

export default AIHMatcher;
import { AIH, SigtapProcedure, AIHMatchDB, AIHAnalysisReport } from '../types';
import { AIHMatchService, SigtapService } from '../services/supabaseService';
import { reaisToCentavos } from '../lib/supabase';

interface MatchingConfig {
  minScoreThreshold: number;
  genderWeight: number;
  ageWeight: number;
  cidWeight: number;
  habilitationWeight: number;
  cboWeight: number;
  exactCodeBonus: number;
}

export class AIHMatcher {
  private procedures: SigtapProcedure[] = [];
  private config: MatchingConfig;

  constructor(config?: Partial<MatchingConfig>) {
    this.config = {
      minScoreThreshold: 70,
      genderWeight: 10,
      ageWeight: 15,
      cidWeight: 20,
      habilitationWeight: 25,
      cboWeight: 15,
      exactCodeBonus: 15,
      ...config
    };
  }

  /**
   * Inicializa o matcher carregando procedimentos SIGTAP ativos
   */
  async initialize(): Promise<void> {
    console.log('🔄 Inicializando AIH Matcher...');
    this.procedures = await SigtapService.getActiveProcedures();
    console.log(`✅ ${this.procedures.length} procedimentos SIGTAP carregados`);
  }

  /**
   * Processa uma AIH individual e encontra matches
   */
  async processAIH(aih: AIH): Promise<AIHAnalysisReport> {
    console.log(`🔍 Processando AIH: ${aih.numeroAIH}`);
    
    // Buscar procedimento principal
    const mainProcedureMatches = await this.findProcedureMatches(
      aih.procedimentoPrincipal,
      aih
    );

    // Processar procedimentos realizados
    const allMatches: AIHMatchDB[] = [];
    for (const procRealizado of aih.procedimentosRealizados) {
      const matches = await this.findProcedureMatches(procRealizado.codigo, aih);
      allMatches.push(...matches);
    }

    // Combinar matches do procedimento principal
    allMatches.push(...mainProcedureMatches);

    // Remover duplicatas e ordenar por score
    const uniqueMatches = this.removeDuplicateMatches(allMatches);
    const sortedMatches = uniqueMatches.sort((a, b) => b.overall_score - a.overall_score);

    // Gerar relatório de análise
    const report = this.generateAnalysisReport(aih, sortedMatches);
    
    console.log(`✅ Processamento concluído: ${sortedMatches.length} matches encontrados`);
    return report;
  }

  /**
   * Encontra matches para um código de procedimento específico
   */
  private async findProcedureMatches(
    procedureCode: string, 
    aih: AIH
  ): Promise<AIHMatchDB[]> {
    
    const matches: AIHMatchDB[] = [];
    
    // Busca exata por código
    const exactMatch = this.procedures.find(p => p.code === procedureCode);
    if (exactMatch) {
      const match = await this.createMatch(aih, exactMatch, 'exact');
      if (match.overall_score >= this.config.minScoreThreshold) {
        matches.push(match);
      }
    }

    // Busca por códigos similares (primeiros dígitos iguais)
    const codePrefix = procedureCode.substring(0, 6); // Primeiros 6 dígitos
    const similarProcedures = this.procedures.filter(p => 
      p.code.startsWith(codePrefix) && p.code !== procedureCode
    );

    for (const procedure of similarProcedures.slice(0, 5)) { // Limitar a 5 similares
      const match = await this.createMatch(aih, procedure, 'similar');
      if (match.overall_score >= this.config.minScoreThreshold) {
        matches.push(match);
      }
    }

    return matches;
  }

  /**
   * Cria um match entre AIH e procedimento SIGTAP
   */
  private async createMatch(
    aih: AIH, 
    procedure: SigtapProcedure, 
    matchType: 'exact' | 'similar'
  ): Promise<AIHMatchDB> {
    
    // Validações individuais
    const genderValid = this.validateGender(aih, procedure);
    const ageValid = this.validateAge(aih, procedure);
    const cidValid = this.validateCID(aih, procedure);
    const habilitationValid = this.validateHabilitation(aih, procedure);
    const cboValid = this.validateCBO(aih, procedure);

    // Cálculo do score
    let score = 0;
    
    if (genderValid) score += this.config.genderWeight;
    if (ageValid) score += this.config.ageWeight;
    if (cidValid) score += this.config.cidWeight;
    if (habilitationValid) score += this.config.habilitationWeight;
    if (cboValid) score += this.config.cboWeight;
    
    // Bônus para match exato de código
    if (matchType === 'exact') {
      score += this.config.exactCodeBonus;
    }

    // Cálculo dos valores
    const calculatedValueAmb = reaisToCentavos(procedure.valueAmb);
    const calculatedValueHosp = reaisToCentavos(procedure.valueHosp);
    const calculatedValueProf = reaisToCentavos(procedure.valueProf);
    const calculatedTotal = calculatedValueAmb + calculatedValueHosp + calculatedValueProf;

    // Detalhes da validação
    const validationDetails = {
      matchType,
      validations: {
        gender: { valid: genderValid, details: this.getGenderValidationDetails(aih, procedure) },
        age: { valid: ageValid, details: this.getAgeValidationDetails(aih, procedure) },
        cid: { valid: cidValid, details: this.getCIDValidationDetails(aih, procedure) },
        habilitation: { valid: habilitationValid, details: this.getHabilitationValidationDetails(aih, procedure) },
        cbo: { valid: cboValid, details: this.getCBOValidationDetails(aih, procedure) }
      },
      scoreBreakdown: {
        gender: genderValid ? this.config.genderWeight : 0,
        age: ageValid ? this.config.ageWeight : 0,
        cid: cidValid ? this.config.cidWeight : 0,
        habilitation: habilitationValid ? this.config.habilitationWeight : 0,
        cbo: cboValid ? this.config.cboWeight : 0,
        exactMatch: matchType === 'exact' ? this.config.exactCodeBonus : 0
      }
    };

    const match: AIHMatchDB = {
      id: `${aih.id || 'temp'}_${procedure.id || procedure.code}_${Date.now()}`,
      aih_id: aih.id || '',
      procedure_id: procedure.id || '',
      gender_valid: genderValid,
      age_valid: ageValid,
      cid_valid: cidValid,
      habilitation_valid: habilitationValid,
      cbo_valid: cboValid,
      overall_score: Math.min(score, 100), // Máximo 100%
      calculated_value_amb: calculatedValueAmb,
      calculated_value_hosp: calculatedValueHosp,
      calculated_value_prof: calculatedValueProf,
      calculated_total: calculatedTotal,
      validation_details: validationDetails,
      match_confidence: this.calculateConfidence(score, matchType),
      match_method: 'automatic',
      status: score >= 90 ? 'approved' : score >= this.config.minScoreThreshold ? 'pending' : 'rejected',
      created_at: new Date().toISOString()
    };

    return match;
  }

  /**
   * Validações específicas
   */
  private validateGender(aih: AIH, procedure: SigtapProcedure): boolean {
    if (!procedure.gender || procedure.gender === 'AMBOS') return true;
    return procedure.gender === aih.sexo;
  }

  private validateAge(aih: AIH, procedure: SigtapProcedure): boolean {
    if (!procedure.minAge && !procedure.maxAge) return true;
    
    const birthDate = new Date(aih.nascimento);
    const currentDate = new Date();
    const ageInYears = currentDate.getFullYear() - birthDate.getFullYear();
    
    if (procedure.minAge && ageInYears < procedure.minAge) return false;
    if (procedure.maxAge && ageInYears > procedure.maxAge) return false;
    
    return true;
  }

  private validateCID(aih: AIH, procedure: SigtapProcedure): boolean {
    if (!procedure.cid || procedure.cid.length === 0) return true;
    
    const aihCIDs = [aih.cidPrincipal, ...(aih.procedimentosRealizados.map(p => p.codigo) || [])];
    return procedure.cid.some(cid => aihCIDs.includes(cid));
  }

  private validateHabilitation(aih: AIH, procedure: SigtapProcedure): boolean {
    // TODO: Implementar validação de habilitação baseada no hospital
    // Por enquanto, sempre válido
    return true;
  }

  private validateCBO(aih: AIH, procedure: SigtapProcedure): boolean {
    if (!procedure.cbo || procedure.cbo.length === 0) return true;
    if (!aih.cnsSolicitante) return true; // Se não tem CBO na AIH, considera válido
    
    // TODO: Implementar validação de CBO baseada nos profissionais
    return true;
  }

  /**
   * Métodos para detalhes de validação
   */
  private getGenderValidationDetails(aih: AIH, procedure: SigtapProcedure): any {
    return {
      aihGender: aih.sexo,
      procedureGender: procedure.gender,
      restriction: procedure.gender && procedure.gender !== 'AMBOS'
    };
  }

  private getAgeValidationDetails(aih: AIH, procedure: SigtapProcedure): any {
    const birthDate = new Date(aih.nascimento);
    const currentDate = new Date();
    const ageInYears = currentDate.getFullYear() - birthDate.getFullYear();
    
    return {
      patientAge: ageInYears,
      minAge: procedure.minAge,
      maxAge: procedure.maxAge,
      withinRange: this.validateAge(aih, procedure)
    };
  }

  private getCIDValidationDetails(aih: AIH, procedure: SigtapProcedure): any {
    return {
      aihCID: aih.cidPrincipal,
      procedureCIDs: procedure.cid,
      hasRestriction: procedure.cid && procedure.cid.length > 0
    };
  }

  private getHabilitationValidationDetails(aih: AIH, procedure: SigtapProcedure): any {
    return {
      procedureHabilitation: procedure.habilitation,
      habilitationGroup: procedure.habilitationGroup
    };
  }

  private getCBOValidationDetails(aih: AIH, procedure: SigtapProcedure): any {
    return {
      procedureCBOs: procedure.cbo,
      hasRestriction: procedure.cbo && procedure.cbo.length > 0
    };
  }

  /**
   * Calcula confiança do match
   */
  private calculateConfidence(score: number, matchType: 'exact' | 'similar'): number {
    let confidence = score;
    
    // Penalidade para matches similares
    if (matchType === 'similar') {
      confidence = confidence * 0.9;
    }
    
    return Math.min(Math.round(confidence), 100);
  }

  /**
   * Remove matches duplicados
   */
  private removeDuplicateMatches(matches: AIHMatchDB[]): AIHMatchDB[] {
    const seen = new Set<string>();
    return matches.filter(match => {
      const key = `${match.aih_id}_${match.procedure_id}`;
      if (seen.has(key)) {
        return false;
      }
      seen.add(key);
      return true;
    });
  }

  /**
   * Gera relatório de análise
   */
  private generateAnalysisReport(aih: AIH, matches: AIHMatchDB[]): AIHAnalysisReport {
    const bestMatch = matches[0];
    const alternativeMatches = matches.slice(1, 4); // Top 3 alternativas
    
    // Identificar problemas
    const issues: string[] = [];
    if (matches.length === 0) {
      issues.push('Nenhum procedimento SIGTAP compatível encontrado');
    } else if (bestMatch.overall_score < 90) {
      issues.push(`Score do melhor match é ${bestMatch.overall_score}% (recomendado > 90%)`);
    }
    
    if (!bestMatch?.gender_valid) issues.push('Incompatibilidade de gênero');
    if (!bestMatch?.age_valid) issues.push('Faixa etária incompatível');
    if (!bestMatch?.cid_valid) issues.push('CID não compatível');

    // Sugerir ações
    const suggestedActions: string[] = [];
    if (issues.length > 0) {
      suggestedActions.push('Revisão manual recomendada');
    }
    if (bestMatch && bestMatch.overall_score >= this.config.minScoreThreshold) {
      suggestedActions.push('Proceder com o faturamento');
    } else {
      suggestedActions.push('Verificar código do procedimento');
      suggestedActions.push('Consultar tabela SIGTAP atualizada');
    }

    // Impacto financeiro
    const originalValue = aih.procedimentosRealizados.reduce((sum, proc) => sum + (proc.quantidade || 1), 0) * 100; // Mock
    const suggestedValue = bestMatch ? bestMatch.calculated_total : 0;
    const difference = suggestedValue - originalValue;
    const percentageChange = originalValue > 0 ? (difference / originalValue) * 100 : 0;

    // Resumo de validação
    const totalChecks = 5; // gender, age, cid, habilitation, cbo
    let passedChecks = 0;
    const failedChecks: string[] = [];
    const warningChecks: string[] = [];

    if (bestMatch) {
      if (bestMatch.gender_valid) passedChecks++; else failedChecks.push('Gênero');
      if (bestMatch.age_valid) passedChecks++; else failedChecks.push('Idade');
      if (bestMatch.cid_valid) passedChecks++; else warningChecks.push('CID');
      if (bestMatch.habilitation_valid) passedChecks++; else warningChecks.push('Habilitação');
      if (bestMatch.cbo_valid) passedChecks++; else warningChecks.push('CBO');
    }

    return {
      aihId: aih.id || aih.numeroAIH,
      matches,
      recommendations: {
        bestMatch,
        alternativeMatches,
        issues,
        suggestedActions
      },
      financialImpact: {
        originalValue,
        suggestedValue,
        difference,
        percentageChange
      },
      validationSummary: {
        totalChecks,
        passedChecks,
        failedChecks,
        warningChecks
      }
    };
  }

  /**
   * Processa múltiplas AIHs em lote
   */
  async batchProcessAIHs(
    aihs: AIH[], 
    onProgress?: (processed: number, total: number) => void
  ): Promise<AIHAnalysisReport[]> {
    console.log(`🚀 Processando ${aihs.length} AIHs em lote...`);
    
    const reports: AIHAnalysisReport[] = [];
    
    for (let i = 0; i < aihs.length; i++) {
      const report = await this.processAIH(aihs[i]);
      reports.push(report);
      
      if (onProgress) {
        onProgress(i + 1, aihs.length);
      }
      
      // Pequeno delay para não sobrecarregar o sistema
      await new Promise(resolve => setTimeout(resolve, 10));
    }
    
    console.log(`✅ Processamento em lote concluído: ${reports.length} relatórios gerados`);
    return reports;
  }

  /**
   * Salva matches no banco de dados
   */
  async saveMatches(matches: AIHMatchDB[]): Promise<void> {
    console.log(`💾 Salvando ${matches.length} matches no banco...`);
    
    for (const match of matches) {
      try {
        await AIHMatchService.createMatch(match);
      } catch (error) {
        console.error(`Erro ao salvar match ${match.id}:`, error);
      }
    }
    
    console.log('✅ Matches salvos com sucesso!');
  }
}
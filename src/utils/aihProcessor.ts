import { AIH, AIHProcedureRealized, AIHProfessional, AIHProcessingResult } from '../types';

interface AIHExtractionPattern {
  numeroAIH: RegExp;
  cnsPattern: RegExp;
  datePattern: RegExp;
  procedurePattern: RegExp;
  cidPattern: RegExp;
  phonePattern: RegExp;
  cepPattern: RegExp;
}

export class AIHProcessor {
  private patterns: AIHExtractionPattern;

  constructor() {
    this.patterns = {
      numeroAIH: /(\d{12}-\d)/g,
      cnsPattern: /(\d{3}\.\d{4}\.\d{4}\.\d{4}|\d{15})/g,
      datePattern: /(\d{2}\/\d{2}\/\d{4})/g,
      procedurePattern: /(\d{2}\.\d{2}\.\d{2}\.\d{3}-\d)/g,
      cidPattern: /([A-Z]\d{2,3})/g,
      phonePattern: /\((\d{2})\)(\d{4,5})-?(\d{4})/g,
      cepPattern: /(\d{2}\.?\d{3}-?\d{3})/g
    };
  }

  /**
   * Processa arquivo de AIH (Excel, CSV ou PDF extraído)
   */
  async processAIHFile(
    file: File, 
    hospitalContext?: { hospitalId: string; hospitalName: string }
  ): Promise<AIHProcessingResult> {
    const startTime = Date.now();
    
    try {
      console.log('🚀 Iniciando processamento de AIH:', file.name);
      if (hospitalContext) {
        console.log('🏥 Hospital contexto:', hospitalContext.hospitalName);
      }
      
      let content: string;
      
      if (file.name.endsWith('.txt') || file.name.endsWith('.csv')) {
        content = await this.readTextFile(file);
      } else if (file.name.endsWith('.xlsx') || file.name.endsWith('.xls')) {
        content = await this.processExcelToText(file);
      } else {
        throw new Error('Formato de arquivo não suportado');
      }

      const aihs = this.extractAIHsFromText(content, hospitalContext);
      const validationResults = await this.validateAIHs(aihs);
      
      const processingTime = Date.now() - startTime;
      
      return {
        success: true,
        totalProcessed: aihs.length,
        validAIHs: validationResults.valid.length,
        invalidAIHs: validationResults.invalid.length,
        matches: [], // Será preenchido na etapa de matching
        errors: validationResults.errors,
        processingTime,
        hospitalId: hospitalContext?.hospitalId,
        hospitalName: hospitalContext?.hospitalName
      };

    } catch (error) {
      console.error('❌ Erro no processamento:', error);
      return {
        success: false,
        totalProcessed: 0,
        validAIHs: 0,
        invalidAIHs: 0,
        matches: [],
        errors: [{
          line: 0,
          field: 'file',
          message: error instanceof Error ? error.message : 'Erro desconhecido'
        }],
        processingTime: Date.now() - startTime,
        hospitalId: hospitalContext?.hospitalId,
        hospitalName: hospitalContext?.hospitalName
      };
    }
  }

  /**
   * Extrai AIHs de texto estruturado
   */
  extractAIHsFromText(
    content: string, 
    hospitalContext?: { hospitalId: string; hospitalName: string }
  ): AIH[] {
    const aihs: AIH[] = [];
    
    // Dividir o conteúdo em seções de AIH individuais
    const aihSections = this.splitIntoAIHSections(content);
    
    for (let i = 0; i < aihSections.length; i++) {
      try {
        const aih = this.parseAIHSection(aihSections[i], i + 1);
        if (aih) {
          // Adicionar ID do hospital se fornecido
          if (hospitalContext) {
            aih.hospitalId = hospitalContext.hospitalId;
          }
          aihs.push(aih);
        }
      } catch (error) {
        console.warn(`⚠️ Erro ao processar AIH ${i + 1}:`, error);
      }
    }
    
    return aihs;
  }

  /**
   * Divide texto em seções individuais de AIH
   */
  private splitIntoAIHSections(content: string): string[] {
    // Buscar por padrões que indicam início de nova AIH
    const aihStarters = [
      'Apresentação da AIH:',
      'Número da AIH:',
      'AIH:',
      /\d{12}-\d/
    ];
    
    const sections: string[] = [];
    const lines = content.split('\n');
    let currentSection: string[] = [];
    
    for (const line of lines) {
      const isNewAIH = aihStarters.some(starter => {
        if (typeof starter === 'string') {
          return line.includes(starter);
        } else {
          return starter.test(line);
        }
      });
      
      if (isNewAIH && currentSection.length > 0) {
        sections.push(currentSection.join('\n'));
        currentSection = [line];
      } else {
        currentSection.push(line);
      }
    }
    
    if (currentSection.length > 0) {
      sections.push(currentSection.join('\n'));
    }
    
    return sections;
  }

  /**
   * Faz parse de uma seção individual de AIH
   */
  private parseAIHSection(section: string, lineNumber: number): AIH | null {
    try {
      const lines = section.split('\n').map(line => line.trim()).filter(line => line.length > 0);
      
      // Criar objeto AIH base
      const aih: Partial<AIH> = {
        status: 'pending',
        createdAt: new Date().toISOString()
      };

      // Extrair dados usando padrões específicos
      this.extractBasicInfo(lines, aih);
      this.extractPatientInfo(lines, aih);
      this.extractInternationInfo(lines, aih);
      this.extractProcedures(lines, aih);

      // Validar campos obrigatórios
      if (!aih.numeroAIH || !aih.nomePaciente || !aih.procedimentoPrincipal) {
        console.warn(`⚠️ AIH incompleta na linha ${lineNumber}:`, {
          numeroAIH: aih.numeroAIH,
          nomePaciente: aih.nomePaciente,
          procedimentoPrincipal: aih.procedimentoPrincipal
        });
        return null;
      }

      return aih as AIH;

    } catch (error) {
      console.error(`❌ Erro ao fazer parse da AIH linha ${lineNumber}:`, error);
      return null;
    }
  }

  /**
   * Extrai informações básicas da AIH
   */
  private extractBasicInfo(lines: string[], aih: Partial<AIH>): void {
    for (const line of lines) {
      // Número da AIH: 412511245891-8
      if (line.includes('Número da AIH:')) {
        const match = line.match(this.patterns.numeroAIH);
        if (match) aih.numeroAIH = match[0];
      }
      
      // Situação: Reapresentado
      if (line.includes('Situação:')) {
        aih.situacao = line.split(':')[1]?.trim() || '';
      }
      
      // Tipo: 1. Inicial
      if (line.includes('Tipo:')) {
        aih.tipo = line.split(':')[1]?.trim() || '';
      }
      
      // Data autorização: 01/06/2025
      if (line.includes('Data autorização:')) {
        const match = line.match(this.patterns.datePattern);
        if (match) aih.dataAutorizacao = match[0];
      }
      
      // Data início: 01/06/2025
      if (line.includes('Data início:')) {
        const match = line.match(this.patterns.datePattern);
        if (match) aih.dataInicio = match[0];
      }
      
      // Data fim: 02/06/2025
      if (line.includes('Data fim:')) {
        const match = line.match(this.patterns.datePattern);
        if (match) aih.dataFim = match[0];
      }
      
      // Motivo encerramento: 12 - ALTA MELHORADO
      if (line.includes('Motivo encerramento:')) {
        aih.motivoEncerramento = line.split(':')[1]?.trim() || '';
      }
      
      // CNS patterns
      if (line.includes('CNS autorizador:')) {
        const match = line.match(this.patterns.cnsPattern);
        if (match) aih.cnsAutorizador = match[0];
      }
      
      if (line.includes('CNS solicitante:')) {
        const match = line.match(this.patterns.cnsPattern);
        if (match) aih.cnsSolicitante = match[0];
      }
      
      if (line.includes('CNS responsável:')) {
        const match = line.match(this.patterns.cnsPattern);
        if (match) aih.cnsResponsavel = match[0];
      }
    }
  }

  /**
   * Extrai informações do paciente
   */
  private extractPatientInfo(lines: string[], aih: Partial<AIH>): void {
    for (const line of lines) {
      // Prontuário: 5500602 - JOANIR VENANCIO
      if (line.includes('Prontuário:')) {
        const parts = line.split(':')[1]?.trim().split(' - ');
        if (parts && parts.length >= 2) {
          aih.prontuario = parts[0].trim();
          aih.nomePaciente = parts[1].trim();
        }
      }
      
      // Nascimento: 18/04/1961
      if (line.includes('Nascimento:')) {
        const match = line.match(this.patterns.datePattern);
        if (match) aih.nascimento = match[0];
      }
      
      // Sexo: Masculino
      if (line.includes('Sexo:')) {
        const sexo = line.split(':')[1]?.trim().toLowerCase();
        aih.sexo = sexo === 'masculino' ? 'M' : 'F';
      }
      
      // Nacionalidade: BRASIL
      if (line.includes('Nacionalidade:')) {
        aih.nacionalidade = line.split(':')[1]?.trim() || '';
      }
      
      // Nome mãe: ANIR LIMA
      if (line.includes('Nome mãe:')) {
        aih.nomeMae = line.split(':')[1]?.trim() || '';
      }
      
      // Endereço: RUA - Rua Atos dos Apóstolos
      if (line.includes('Endereço:')) {
        aih.endereco = line.split(':')[1]?.trim() || '';
      }
      
      // Nº: 98
      if (line.startsWith('Nº:')) {
        aih.numero = line.split(':')[1]?.trim() || '';
      }
      
      // Bairro: Cristo Rei
      if (line.includes('Bairro:')) {
        aih.bairro = line.split(':')[1]?.trim() || '';
      }
      
      // Município: CAMPO LARGO
      if (line.includes('Município:')) {
        aih.municipio = line.split(':')[1]?.trim() || '';
      }
      
      // UF: PR
      if (line.startsWith('UF:')) {
        aih.uf = line.split(':')[1]?.trim() || '';
      }
      
      // CEP: 83.604-680
      if (line.includes('CEP:')) {
        const match = line.match(this.patterns.cepPattern);
        if (match) aih.cep = match[0];
      }
      
      // Telefone: (41)99651-0564
      if (line.includes('Telefone:')) {
        const match = line.match(this.patterns.phonePattern);
        if (match) {
          aih.telefone = `(${match[1]})${match[2]}-${match[3]}`;
        }
      }
    }
  }

  /**
   * Extrai informações da internação
   */
  private extractInternationInfo(lines: string[], aih: Partial<AIH>): void {
    for (const line of lines) {
      // Procedimento principal: 04.15.02.006-9 - PROCEDIMENTOS SEQUENCIAIS EM ORTOPEDIA
      if (line.includes('Procedimento principal:')) {
        const match = line.match(this.patterns.procedurePattern);
        if (match) {
          aih.procedimentoPrincipal = match[0];
        }
      }
      
      // Procedimento solicitado: 04.15.02.006-9 - PROCEDIMENTOS SEQUENCIAIS EM ORTOPEDIA
      if (line.includes('Procedimento solicitado:')) {
        const match = line.match(this.patterns.procedurePattern);
        if (match) {
          aih.procedimentoSolicitado = match[0];
        }
      }
      
      // CID principal: M751 - Síndrome do manguito rotador
      if (line.includes('CID principal:')) {
        const match = line.match(this.patterns.cidPattern);
        if (match) {
          aih.cidPrincipal = match[0];
        }
      }
      
      // Especialidade: 01 - Cirúrgico
      if (line.includes('Especialidade:')) {
        aih.especialidade = line.split(':')[1]?.trim() || '';
      }
      
      // Modalidade: Hospitalar
      if (line.includes('Modalidade:')) {
        aih.modalidade = line.split(':')[1]?.trim() || '';
      }
      
      // Caráter atendimento: 1 - Eletivo
      if (line.includes('Caráter atendimento:')) {
        aih.caracterAtendimento = line.split(':')[1]?.trim() || '';
      }
      
      // Mudança de proc.? Sim
      if (line.includes('Mudança de proc.?')) {
        aih.mudancaProc = line.toLowerCase().includes('sim');
      }
    }
  }

  /**
   * Extrai procedimentos realizados
   */
  private extractProcedures(lines: string[], aih: Partial<AIH>): void {
    const procedures: AIHProcedureRealized[] = [];
    
    // Encontrar início da tabela de procedimentos
    let inProcedureTable = false;
    let currentProcedure: Partial<AIHProcedureRealized> | null = null;
    
    for (const line of lines) {
      if (line.includes('Procedimentos realizados:')) {
        inProcedureTable = true;
        continue;
      }
      
      if (!inProcedureTable) continue;
      
      // Se encontrar uma nova seção, parar
      if (line.includes('Dados complementares') || line.includes('Informações adicionais')) {
        break;
      }
      
      // Detectar linha de procedimento (começa com número)
      const procedureMatch = line.match(/^(\d+)\s+(.+)/);
      if (procedureMatch) {
        // Salvar procedimento anterior se existir
        if (currentProcedure && currentProcedure.codigo) {
          procedures.push(currentProcedure as AIHProcedureRealized);
        }
        
        // Iniciar novo procedimento
        const lineNumber = parseInt(procedureMatch[1]);
        const restOfLine = procedureMatch[2];
        
        currentProcedure = {
          linha: lineNumber,
          profissionais: [],
          quantidade: 1,
          dataRealizacao: aih.dataInicio || ''
        };
        
        // Extrair código e descrição
        const codeMatch = restOfLine.match(this.patterns.procedurePattern);
        if (codeMatch) {
          currentProcedure.codigo = codeMatch[0];
          currentProcedure.descricao = restOfLine.substring(restOfLine.indexOf(' - ') + 3);
        }
      }
      
      // Se já temos um procedimento atual, verificar informações de profissionais
      if (currentProcedure && line.includes('000.000.') || line.includes('70')) {
        const professional = this.extractProfessionalFromLine(line);
        if (professional) {
          currentProcedure.profissionais = currentProcedure.profissionais || [];
          currentProcedure.profissionais.push(professional);
        }
      }
    }
    
    // Adicionar último procedimento
    if (currentProcedure && currentProcedure.codigo) {
      procedures.push(currentProcedure as AIHProcedureRealized);
    }
    
    aih.procedimentosRealizados = procedures;
  }

  /**
   * Extrai dados do profissional de uma linha
   */
  private extractProfessionalFromLine(line: string): AIHProfessional | null {
    try {
      // Exemplo: 000.000.175-74 225270 1º cirurgião 0017574
      const parts = line.trim().split(/\s+/);
      
      if (parts.length >= 3) {
        return {
          documento: parts[0] || '',
          cbo: parts[1] || '',
          participacao: parts[2] || '',
          cnes: parts[3] || ''
        };
      }
      
      return null;
    } catch (error) {
      console.warn('⚠️ Erro ao extrair profissional:', error);
      return null;
    }
  }

  /**
   * Lê arquivo de texto
   */
  private async readTextFile(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => resolve(e.target?.result as string);
      reader.onerror = (e) => reject(new Error('Erro ao ler arquivo'));
      reader.readAsText(file, 'utf-8');
    });
  }

  /**
   * Processa Excel para texto (implementação simplificada)
   */
  private async processExcelToText(file: File): Promise<string> {
    // TODO: Implementar processamento Excel real usando bibliotecas como xlsx
    throw new Error('Processamento Excel não implementado ainda. Use arquivo CSV ou TXT.');
  }

  /**
   * Valida AIHs extraídas
   */
  private async validateAIHs(aihs: AIH[]): Promise<{
    valid: AIH[];
    invalid: AIH[];
    errors: Array<{ line: number; field: string; message: string; value?: any }>;
  }> {
    const valid: AIH[] = [];
    const invalid: AIH[] = [];
    const errors: Array<{ line: number; field: string; message: string; value?: any }> = [];

    for (let i = 0; i < aihs.length; i++) {
      const aih = aihs[i];
      const lineNumber = i + 1;
      let isValid = true;

      // Validar número da AIH
      if (!aih.numeroAIH || !this.patterns.numeroAIH.test(aih.numeroAIH)) {
        errors.push({
          line: lineNumber,
          field: 'numeroAIH',
          message: 'Número da AIH inválido ou ausente',
          value: aih.numeroAIH
        });
        isValid = false;
      }

      // Validar CNS do paciente
      if (!aih.nomePaciente) {
        errors.push({
          line: lineNumber,
          field: 'nomePaciente',
          message: 'Nome do paciente é obrigatório',
          value: aih.nomePaciente
        });
        isValid = false;
      }

      // Validar procedimento principal
      if (!aih.procedimentoPrincipal || !this.patterns.procedurePattern.test(aih.procedimentoPrincipal)) {
        errors.push({
          line: lineNumber,
          field: 'procedimentoPrincipal',
          message: 'Código de procedimento principal inválido ou ausente',
          value: aih.procedimentoPrincipal
        });
        isValid = false;
      }

      // Validar datas
      if (aih.dataInicio && aih.dataFim) {
        const dataInicio = new Date(aih.dataInicio.split('/').reverse().join('-'));
        const dataFim = new Date(aih.dataFim.split('/').reverse().join('-'));
        
        if (dataInicio > dataFim) {
          errors.push({
            line: lineNumber,
            field: 'datas',
            message: 'Data de início posterior à data de fim',
            value: `${aih.dataInicio} > ${aih.dataFim}`
          });
          isValid = false;
        }
      }

      if (isValid) {
        valid.push(aih);
      } else {
        invalid.push(aih);
      }
    }

    return { valid, invalid, errors };
  }
}

export default AIHProcessor; 
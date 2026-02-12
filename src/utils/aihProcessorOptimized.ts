import { AIH, AIHProcedureRealized, AIHProfessional, AIHProcessingResult } from '../types';

interface AIHStructuredData {
  // Apresentação da AIH
  numeroAIH: string;
  situacao: string;
  tipo: string;
  dataAutorizacao: string;

  // Dados da AIH
  dataInicio: string;
  dataFim: string;
  motivoEncerramento: string;
  cnsAutorizador: string;
  cnsSolicitante: string;
  cnsResponsavel: string;

  // Identificação do paciente
  prontuario: string;
  nomePaciente: string;
  cns: string;
  nascimento: string;
  sexo: string;
  nacionalidade: string;
  nomeResponsavel: string;
  nomeMae: string;
  endereco: string;
  numero: string;
  complemento: string;
  bairro: string;
  municipio: string;
  uf: string;
  cep: string;
  telefone: string;

  // Dados da internação
  procedimentoSolicitado: string;
  mudancaProc: string;
  procedimentoPrincipal: string;
  cidPrincipal: string;
  especialidade: string;
  modalidade: string;
  caracterAtendimento: string;
}

export class AIHProcessorOptimized {
  /**
   * Processador otimizado para AIH com formato estruturado sequencial
   * Baseado no documento fornecido pelo usuário
   */
  async processStructuredAIH(
    content: string,
    hospitalContext?: { hospitalId: string; hospitalName: string }
  ): Promise<AIHProcessingResult> {
    const startTime = Date.now();
    
    try {
      console.log('🚀 Processando AIH estruturada...');
      
      // Extrair dados usando parsing sequencial otimizado
      const aihData = this.extractStructuredData(content);
      
      if (!aihData) {
        throw new Error('Não foi possível extrair dados da AIH');
      }

      // Converter para formato AIH padrão
      const aih = this.convertToStandardAIH(aihData, hospitalContext);
      
      // Validar AIH
      const validation = this.validateAIH(aih);
      
      const processingTime = Date.now() - startTime;
      
      return {
        success: validation.isValid,
        totalProcessed: 1,
        validAIHs: validation.isValid ? 1 : 0,
        invalidAIHs: validation.isValid ? 0 : 1,
        matches: [],
        errors: validation.errors,
        processingTime,
        hospitalId: hospitalContext?.hospitalId,
        hospitalName: hospitalContext?.hospitalName
      };

    } catch (error) {
      console.error('❌ Erro no processamento estruturado:', error);
      return {
        success: false,
        totalProcessed: 1,
        validAIHs: 0,
        invalidAIHs: 1,
        matches: [],
        errors: [{
          line: 0,
          field: 'parsing',
          message: error instanceof Error ? error.message : 'Erro no parsing'
        }],
        processingTime: Date.now() - startTime,
        hospitalId: hospitalContext?.hospitalId,
        hospitalName: hospitalContext?.hospitalName
      };
    }
  }

  /**
   * Extrai dados do formato estruturado sequencial
   */
  private extractStructuredData(content: string): AIHStructuredData | null {
    try {
      const lines = content.split('\n').map(line => line.trim());
      const data: Partial<AIHStructuredData> = {};

      // Patterns para extração sequencial otimizada
      const extractors = {
        // APRESENTAÇÃO DA AIH
        numeroAIH: /Número de AIH:\s*([0-9-]+)/,
        situacao: /Situação:\s*([^T]+?)(?=\s+Tipo:)/,
        tipo: /Tipo:\s*([^D]+?)(?=\s+Data)/,
        dataAutorizacao: /Data autorização:\s*(\d{2}\/\d{2}\/\d{4})/,

        // DADOS DA AIH
        dataInicio: /Data início:\s*(\d{2}\/\d{2}\/\d{4})/,
        dataFim: /Data fim:\s*(\d{2}\/\d{2}\/\d{4})/,
        motivoEncerramento: /Motivo encerramento:\s*([^C]+?)(?=\s+CNS)/,
        cnsAutorizador: /CNS\s+autorizador:\s*([\d.]+)/,
        cnsSolicitante: /CNS\s+solicitante:\s*([\d.]+)/,
        cnsResponsavel: /CNS\s+responsável:\s*([\d.]+)/,

        // IDENTIFICAÇÃO DO PACIENTE
        prontuario: /Prontuário:\s*(\d+)\s*-\s*([^C]+?)(?=\s+CNS:)/,
        nomePaciente: /Prontuário:\s*\d+\s*-\s*([^C]+?)(?=\s+CNS:)/,
        cns: /CNS:\s*([\d.]+)/,
        nascimento: /Nascimento:\s*(\d{2}\/\d{2}\/\d{4})/,
        sexo: /Sexo:\s*(\w+)/,
        nacionalidade: /Nacionalidade:\s*([^N]+?)(?=\s+Nome responsável:)/,
        nomeResponsavel: /Nome responsável:\s*([^N]+?)(?=\s+Nome mãe:)/,
        nomeMae: /Nome mãe:\s*([^E]+?)(?=\s+Endereço:)/,
        endereco: /Endereço:\s*([^N]+?)(?=\s+N°:)/,
        numero: /N°:\s*(\d+)/,
        bairro: /Bairro:\s*([^M]+?)(?=\s+Município:)/,
        municipio: /Município:\s*([^U]+?)(?=\s+UF:)/,
        uf: /UF:\s*([A-Z]{2})/,
        cep: /CEP:\s*([\d.-]+)/,
        telefone: /Telefone:\s*([\d()-]+)/,

        // DADOS DA INTERNAÇÃO
        procedimentoSolicitado: /Procedimento\s+solicitado:\s*([\d.-]+\s*-[^M]+?)(?=\s+Mudança)/,
        mudancaProc: /Mudança de proc\.:\s*(\w+)/,
        procedimentoPrincipal: /Procedimento\s+principal:\s*([\d.-]+\s*-[^C]+?)(?=\s+CID)/,
        cidPrincipal: /CID principal:\s*([A-Z]\d+[^E]*?)(?=\s+Especialidade:)/,
        especialidade: /Especialidade:\s*([^M]+?)(?=\s+Modalidade:)/,
        modalidade: /Modalidade:\s*([^C]+?)(?=\s+Caráter)/,
        caracterAtendimento: /Caráter\s+atendimento:\s*(.+)/
      };

      // Executar extração para cada campo
      const fullText = content.replace(/\n/g, ' ').replace(/\s+/g, ' ');
      
      for (const [field, pattern] of Object.entries(extractors)) {
        const match = fullText.match(pattern);
        if (match) {
          let value = match[1]?.trim();
          
          // Tratamento especial para nome do paciente
          if (field === 'nomePaciente' && match[2]) {
            value = match[2].trim();
          }
          
          if (value) {
            (data as any)[field] = value;
            console.log(`✅ ${field}: "${value}"`);
          }
        } else {
          console.warn(`⚠️ Não encontrado: ${field}`);
        }
      }

      // Validar campos obrigatórios
      const requiredFields = ['numeroAIH', 'nomePaciente', 'procedimentoPrincipal'];
      const missingFields = requiredFields.filter(field => !(data as any)[field]);
      
      if (missingFields.length > 0) {
        console.error('❌ Campos obrigatórios faltando:', missingFields);
        return null;
      }

      return data as AIHStructuredData;

    } catch (error) {
      console.error('❌ Erro na extração estruturada:', error);
      return null;
    }
  }

  /**
   * Converte dados estruturados para formato AIH padrão
   */
  private convertToStandardAIH(
    data: AIHStructuredData, 
    hospitalContext?: { hospitalId: string; hospitalName: string }
  ): AIH {
    // Converter sexo para formato padrão
    const gender = data.sexo?.toLowerCase().includes('masculino') ? 'M' : 'F';
    
    // Extrair código do procedimento principal
    const procedureCode = data.procedimentoPrincipal?.match(/^([\d.-]+)/)?.[1] || '';
    
    // Extrair código do CID principal
    const cidCode = data.cidPrincipal?.match(/^([A-Z]\d+)/)?.[1] || '';

    // 🔒 Normalização segura do Caráter e Fallback de Especialidade (mesma regra do serviço)
    const normalizeCareCharacterUI = (raw?: any): '1' | '2' => {
      try {
        const v = String(raw ?? '').trim().toLowerCase();
        if (v === '2' || v === '02' || v === 'urgencia' || v === 'urgência' || v.includes('urg') || v.includes('emerg')) return '2';
        if (v === '1' || v === '01' || v === 'eletivo') return '1';
        return '1';
      } catch { return '1'; }
    };
    const deriveSpecialtyFallback = (careCode: '1'|'2', principal: string | undefined): string => {
      try {
        if (careCode !== '2') return '01 - Cirúrgico';
        const p = (principal || '').toString().toLowerCase();
        const isCesarean = /\bparto\b.*\bcesa/.test(p) || /\bces(ar|área|ariana|ariano)/.test(p) || p.includes('cesarea') || p.includes('cesárea');
        return isCesarean ? '01 - Cirúrgico' : '03 - Clínico';
      } catch { return '01 - Cirúrgico'; }
    };

    const careCode = normalizeCareCharacterUI(data.caracterAtendimento);
    const specialtySafe = (data.especialidade && data.especialidade.trim() !== '')
      ? data.especialidade
      : deriveSpecialtyFallback(careCode, procedureCode);

    const aih: AIH = {
      id: crypto.randomUUID(),
      hospitalId: hospitalContext?.hospitalId,
      
      // Apresentação da AIH
      numeroAIH: data.numeroAIH,
      situacao: data.situacao || '',
      tipo: data.tipo || '',
      dataAutorizacao: this.convertDate(data.dataAutorizacao),
      
      // Dados da AIH
      dataInicio: this.convertDate(data.dataInicio),
      dataFim: this.convertDate(data.dataFim),
      motivoEncerramento: data.motivoEncerramento || '',
      cnsAutorizador: this.cleanCNS(data.cnsAutorizador),
      cnsSolicitante: this.cleanCNS(data.cnsSolicitante),
      cnsResponsavel: this.cleanCNS(data.cnsResponsavel),
      aihAnterior: '',
      aihPosterior: '',
      
      // Identificação do paciente
      prontuario: data.prontuario || '',
      nomePaciente: data.nomePaciente,
      cns: this.cleanCNS(data.cns),
      nascimento: this.convertDate(data.nascimento),
      sexo: gender,
      nacionalidade: data.nacionalidade || 'BRASIL',
      racaCor: '',
      tipoDocumento: '',
      documento: '',
      nomeResponsavel: data.nomeResponsavel,
      nomeMae: data.nomeMae,
      endereco: this.buildFullAddress(data),
      numero: data.numero || '',
      complemento: data.complemento || '',
      bairro: data.bairro || '',
      municipio: data.municipio || '',
      uf: data.uf || '',
      cep: data.cep || '',
      telefone: this.cleanPhone(data.telefone),
      
      // Dados da internação
      procedimentoSolicitado: data.procedimentoSolicitado || '',
      mudancaProc: data.mudancaProc?.toLowerCase() === 'sim',
      procedimentoPrincipal: procedureCode,
      cidPrincipal: cidCode,
      especialidade: specialtySafe,
      modalidade: data.modalidade || '',
      caracterAtendimento: careCode,
      
      // Arrays vazios para procedimentos realizados (serão preenchidos depois)
      procedimentosRealizados: [],
      
      // Metadados
      createdAt: new Date().toISOString(),
      status: 'pending'
    };

    return aih;
  }

  /**
   * Métodos auxiliares de conversão
   */
  private convertDate(dateStr: string): string {
    if (!dateStr) return '';
    
    // Converter DD/MM/YYYY para formato ISO
    const match = dateStr.match(/(\d{2})\/(\d{2})\/(\d{4})/);
    if (match) {
      const [, day, month, year] = match;
      return `${year}-${month}-${day}`;
    }
    
    return dateStr;
  }

  private cleanCNS(cns: string): string {
    if (!cns) return '';
    return cns.replace(/\D/g, ''); // Remove pontos e hífen
  }

  private cleanPhone(phone: string): string {
    if (!phone) return '';
    return phone.replace(/\D/g, ''); // Remove caracteres não numéricos
  }

  private buildFullAddress(data: AIHStructuredData): string {
    const parts = [
      data.endereco,
      data.numero ? `nº ${data.numero}` : '',
      data.complemento,
      data.bairro,
      data.municipio,
      data.uf,
      data.cep ? `CEP: ${data.cep}` : ''
    ].filter(Boolean);
    
    return parts.join(', ');
  }

  /**
   * Validação da AIH extraída
   */
  private validateAIH(aih: AIH): { isValid: boolean; errors: Array<{ line: number; field: string; message: string }> } {
    const errors: Array<{ line: number; field: string; message: string }> = [];

    // Validações obrigatórias
    if (!aih.numeroAIH) {
      errors.push({ line: 1, field: 'numeroAIH', message: 'Número da AIH é obrigatório' });
    }

    if (!aih.nomePaciente) {
      errors.push({ line: 1, field: 'nomePaciente', message: 'Nome do paciente é obrigatório' });
    }

    if (!aih.procedimentoPrincipal) {
      errors.push({ line: 1, field: 'procedimentoPrincipal', message: 'Procedimento principal é obrigatório' });
    }

    // Validação de formato CNS (deve ter 15 dígitos)
    const cnsFields = ['cnsAutorizador', 'cnsSolicitante', 'cnsResponsavel'];
    cnsFields.forEach(field => {
      const cns = (aih as any)[field];
      if (cns && cns.length !== 15) {
        errors.push({ line: 1, field, message: `CNS ${field} deve ter 15 dígitos` });
      }
    });

    // Validação de sexo
    if (aih.sexo && !['M', 'F'].includes(aih.sexo)) {
      errors.push({ line: 1, field: 'sexo', message: 'Sexo deve ser M ou F' });
    }

    // Validação de datas
    if (aih.dataInicio && aih.dataFim) {
      const inicio = new Date(aih.dataInicio);
      const fim = new Date(aih.dataFim);
      if (inicio > fim) {
        errors.push({ line: 1, field: 'dataFim', message: 'Data fim deve ser posterior à data início' });
      }
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }
} 

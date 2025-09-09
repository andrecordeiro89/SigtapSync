import * as pdfjsLib from 'pdfjs-dist';
import { AIH, AIHProcessingResult } from '../types';

// Configurar worker
pdfjsLib.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.mjs';

interface AIHPDFData {
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
  aihAnterior: string;
  aihPosterior: string;

  // Identificação do paciente
  prontuario: string;
  nomePaciente: string;
  cns: string;
  nascimento: string;
  sexo: string;
  nacionalidade: string;
  racaCor: string;
  tipoDocumento: string;
  documento: string;
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
  
  // Dados específicos de faturamento SUS
  utiDias: string;
  atosMedicos: string;
  permanenciaDias: string;
  complexidadeEspecifica: string;
  procedimentoSequencial: string;
  procedimentoEspecial: string;
  valorDiaria: string;
  observacoesFaturamento: string;
}

export class AIHPDFProcessor {
  /**
   * Processa PDF de AIH extraindo dados apenas da primeira página
   */
  async processPDFAIH(
    file: File,
    hospitalContext?: { hospitalId: string; hospitalName: string }
  ): Promise<AIHProcessingResult> {
    const startTime = Date.now();
    
    try {
      console.log('🎯 Processando PDF AIH - Primeira página...');
      
      // Extrair texto da primeira página do PDF
      const firstPageText = await this.extractFirstPageText(file);
      
      if (!firstPageText) {
        throw new Error('Não foi possível extrair texto da primeira página do PDF');
      }

      // Verificar se é realmente uma AIH válida
      if (!this.isValidAIHPDF(firstPageText)) {
        throw new Error('PDF não contém estrutura válida de AIH');
      }

      // Extrair dados estruturados
      const aihData = this.extractAIHData(firstPageText);
      
      if (!aihData) {
        throw new Error('Não foi possível extrair dados da AIH do PDF');
      }

      // Converter para formato AIH padrão
      const aih = this.convertToStandardAIH(aihData, hospitalContext);

      // ✅ Fallback extra: re-extrair nome do paciente se vier vazio ou parecer cabeçalho
      try {
        if (!aih.nomePaciente || /procedimento\s+solicitado/i.test(aih.nomePaciente)) {
          const fallback = text.match(/Prontuário[:\s]*\d+\s*-\s*([^C\n\r]+?)(?=\s+CNS)/i);
          if (fallback && fallback[1]) {
            const rawName = fallback[1].trim();
            const { sanitizePatientName } = await import('./patientName');
            aih.nomePaciente = sanitizePatientName(rawName);
          }
        }
      } catch {}
      
      // Validar AIH
      const validation = this.validateAIH(aih);
      
      const processingTime = Date.now() - startTime;
      
      console.log(`✅ PDF AIH processado em ${processingTime}ms`);
      console.log(`📊 Dados extraídos: ${Object.keys(aihData).length} campos`);
      
      return {
        success: validation.isValid,
        totalProcessed: 1,
        validAIHs: validation.isValid ? 1 : 0,
        invalidAIHs: validation.isValid ? 0 : 1,
        matches: [],
        errors: validation.errors,
        processingTime,
        hospitalId: hospitalContext?.hospitalId,
        hospitalName: hospitalContext?.hospitalName,
        extractedAIH: aih // Retornar a AIH extraída para persistência
      };

    } catch (error) {
      console.error('❌ Erro no processamento PDF AIH:', error);
      return {
        success: false,
        totalProcessed: 1,
        validAIHs: 0,
        invalidAIHs: 1,
        matches: [],
        errors: [{
          line: 0,
          field: 'pdf_processing',
          message: error instanceof Error ? error.message : 'Erro no processamento PDF'
        }],
        processingTime: Date.now() - startTime,
        hospitalId: hospitalContext?.hospitalId,
        hospitalName: hospitalContext?.hospitalName
      };
    }
  }

  /**
   * Extrai texto apenas da primeira página do PDF
   */
  private async extractFirstPageText(file: File): Promise<string> {
    try {
      console.log('📄 Extraindo primeira página do PDF...');
      
      // Converter arquivo para ArrayBuffer
      const arrayBuffer = await file.arrayBuffer();
      
      // Carregar documento PDF
      const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
      console.log(`📖 PDF carregado: ${pdf.numPages} páginas`);
      
      // Extrair apenas a primeira página
      const page = await pdf.getPage(1);
      const textContent = await page.getTextContent();
      
      // Montar texto da primeira página
      const firstPageText = textContent.items
        .map((item: any) => item.str)
        .join(' ')
        .replace(/\s+/g, ' ')
        .trim();
      
      console.log(`✅ Primeira página extraída: ${firstPageText.length} caracteres`);
      console.log('🔍 Primeiros 200 caracteres:', firstPageText.substring(0, 200));
      
      return firstPageText;
      
    } catch (error) {
      console.error('❌ Erro na extração do PDF:', error);
      throw new Error(`Erro ao processar PDF: ${error instanceof Error ? error.message : 'Erro desconhecido'}`);
    }
  }

  /**
   * Verifica se o PDF contém estrutura válida de AIH
   */
  private isValidAIHPDF(text: string): boolean {
    const aihIndicators = [
      'APRESENTAÇÃO DA AIH',
      'Número de AIH',
      'Dados da AIH',
      'Identificação do paciente',
      'Dados da internação',
      'Procedimento principal',
      'CID principal'
    ];

    const foundIndicators = aihIndicators.filter(indicator => 
      text.toUpperCase().includes(indicator.toUpperCase())
    );

    console.log(`🔍 Indicadores AIH encontrados: ${foundIndicators.length}/${aihIndicators.length}`);
    console.log('📝 Indicadores:', foundIndicators);

    // Precisamos de pelo menos 4 indicadores para considerar válido
    return foundIndicators.length >= 4;
  }

  /**
   * Extrai dados estruturados da AIH (primeira página)
   */
  private extractAIHData(text: string): AIHPDFData | null {
    try {
      console.log('🎯 Extraindo dados estruturados da AIH...');
      console.log('📄 Texto completo para debug:', text);
      
      const data: Partial<AIHPDFData> = {};

      // Patterns otimizados para PDF AIH - versão mais flexível
      const extractors = {
        // APRESENTAÇÃO DA AIH - Patterns mais flexíveis
        numeroAIH: [
          /Número de AIH[:\s]*([0-9-]+)/i,
          /AIH[:\s]*([0-9-]+)/i,
          /Numero.*AIH[:\s]*([0-9-]+)/i,
          /AIH.*[nN]úmero[:\s]*([0-9-]+)/i,
          /AIH.*[Nn]umero[:\s]*([0-9-]+)/i,
          /([0-9]{11,13}-[0-9])/i // Pattern direto para formato XXX-X
        ],
        situacao: [
          /Situação[:\s]*([A-Za-z]+)(?=\s+Tipo)/i,
          /Situacao[:\s]*([A-Za-z]+)(?=\s+Tipo)/i,
          /(Apresentação|Reapresentação|Apresentacao|Reapresentacao|Apresentado|Reapresentado)/i
        ],
        tipo: [
          /Tipo[:\s]*([0-9]+\.\s*[A-Za-z]+)(?=\s+Data)/i,
          /Tipo AIH[:\s]*([0-9]+\.\s*[A-Za-z]+)(?=\s+Data)/i,
          /([0-9]+\.\s*inicial|[0-9]+\.\s*continuação|[0-9]+\.\s*longa|[0-9]+\.\s*Inicial)/i
        ],
        dataAutorizacao: [
          /Data autorização[:\s]*(\d{2}\/\d{2}\/\d{4})/i,
          /Data autorizacao[:\s]*(\d{2}\/\d{2}\/\d{4})/i,
          /autorização[:\s]*(\d{2}\/\d{2}\/\d{4})/i,
          /autorizacao[:\s]*(\d{2}\/\d{2}\/\d{4})/i,
          /Apresentação[:\s]*\d+[-\d]*\s*[A-Za-z]*\s*[0-9.]*\s*[A-Za-z]*\s*(\d{2}\/\d{2}\/\d{4})/i
        ],

        // DADOS DA AIH
        dataInicio: [
          /Data início[:\s]*(\d{2}\/\d{2}\/\d{4})/i,
          /Data inicio[:\s]*(\d{2}\/\d{2}\/\d{4})/i,
          /início[:\s]*(\d{2}\/\d{2}\/\d{4})/i,
          /inicio[:\s]*(\d{2}\/\d{2}\/\d{4})/i
        ],
        dataFim: [
          /Data fim[:\s]*(\d{2}\/\d{2}\/\d{4})/i,
          /Data final[:\s]*(\d{2}\/\d{2}\/\d{4})/i,
          /fim[:\s]*(\d{2}\/\d{2}\/\d{4})/i
        ],
        motivoEncerramento: [
          /Motivo encerramento[:\s]*([0-9]+\s*-\s*[A-Z\s]+)(?=\s+Prontuário)/i,
          /encerramento[:\s]*([0-9]+\s*-\s*[A-Z\s]+)(?=\s+Prontuário)/i,
          /([0-9]+\s*-\s*ALTA[A-Z\s]*)/i,
          /([0-9]+\s*-\s*[A-Z\s]+MELHORADO)/i
        ],
        cnsAutorizador: [
          /CNS\s+autorizador[:\s]*([\d.]+)/i,
          /CNS autorizador[:\s]*([\d.]+)/i,
          /autorizador[:\s]*([\d.]+)/i
        ],
        cnsSolicitante: [
          /CNS\s+solicitante[:\s]*([\d.]+)/i,
          /CNS solicitante[:\s]*([\d.]+)/i,
          /solicitante[:\s]*([\d.]+)/i
        ],
        cnsResponsavel: [
          /CNS\s+responsável[:\s]*([\d.]+)/i,
          /CNS responsavel[:\s]*([\d.]+)/i,
          /CNS\s+responsavel[:\s]*([\d.]+)/i,
          /responsável[:\s]*([\d.]+)/i,
          /responsavel[:\s]*([\d.]+)/i
        ],
        aihAnterior: [
          /AIH anterior[:\s]*([0-9-]+)/i,
          /AIH\s+anterior[:\s]*([0-9-]+)/i,
          /anterior[:\s]*([0-9-]+)/i
        ],
        aihPosterior: [
          /AIH posterior[:\s]*([0-9-]+)/i,
          /AIH\s+posterior[:\s]*([0-9-]+)/i,
          /posterior[:\s]*([0-9-]+)/i
        ],

        // IDENTIFICAÇÃO DO PACIENTE
        prontuario: [
          /Prontuário[:\s]*(\d+)/i,
          /Prontuario[:\s]*(\d+)/i,
          /prontuario[:\s]*(\d+)/i
        ],
        nomePaciente: [
          /Prontuário[:\s]*\d+\s*-\s*([^C]+?)(?=\s+CNS)/i,
          /Prontuario[:\s]*\d+\s*-\s*([^C]+?)(?=\s+CNS)/i,
          /-\s*([A-ZÁÉÍÓÚÂÊÎÔÛÃÕÄËÏÖÜÇ\s]+)\s+CNS/i,
          /paciente[:\s]*([A-ZÁÉÍÓÚÂÊÎÔÛÃÕÄËÏÖÜÇ\s]+)/i
        ],
        cns: [
          /CNS[:\s]*([\d.]+)/i,
          /Cartao.*Nacional.*Saude[:\s]*([\d.]+)/i,
          /([\d]{3}\.[\d]{4}\.[\d]{4}\.[\d]{4})/i // Pattern direto CNS
        ],
        nascimento: [
          /Nascimento[:\s]*(\d{2}\/\d{2}\/\d{4})/i,
          /Data nascimento[:\s]*(\d{2}\/\d{2}\/\d{4})/i,
          /nascimento[:\s]*(\d{2}\/\d{2}\/\d{4})/i
        ],
        sexo: [
          /Sexo[:\s]*(\w+)/i,
          /Genero[:\s]*(\w+)/i,
          /(Masculino|Feminino|M|F)/i
        ],
        nacionalidade: [
          /Nacionalidade[:\s]*([^N]+?)(?=\s+Nome)/i,
          /Nacionalidade[:\s]*([^R]+?)(?=\s+Raça)/i,
          /Nacionalidade[:\s]*([A-Z]+)/i,
          /(BRASIL|BRASILEIRA?)/i
        ],
        racaCor: [
          /Raça\/Cor[:\s]*([^T]+?)(?=\s+Tipo)/i,
          /Raca\/Cor[:\s]*([^T]+?)(?=\s+Tipo)/i,
          /Raça[:\s]*([^T]+?)(?=\s+Tipo)/i,
          /Raca[:\s]*([^T]+?)(?=\s+Tipo)/i,
          /(Parda|Branca|Preta|Amarela|Indígena|Ignorado)/i
        ],
        tipoDocumento: [
          /Tipo documento[:\s]*([^D]+?)(?=\s+Documento)/i,
          /Tipo\s+documento[:\s]*([^D]+?)(?=\s+Documento)/i,
          /(RG|CPF|Ignorado)/i
        ],
        documento: [
          /Documento[:\s]*([0-9.-]+?)(?=\s+Nome)/i,
          /Tipo documento[:\s]*[^D]*Documento[:\s]*([0-9.-]+)/i,
          /(?:RG|CPF)[:\s]*([0-9.-]+)/i
        ],
        nomeResponsavel: [
          /Nome responsável[:\s]*([A-Z\s]+?)(?=\s+Nome mãe)/i,
          /Nome responsavel[:\s]*([A-Z\s]+?)(?=\s+Nome mae)/i,
          /responsável[:\s]*([A-Z\s]+?)(?=\s+Nome)/i,
          /responsavel[:\s]*([A-Z\s]+?)(?=\s+Nome)/i
        ],
        nomeMae: [
          /Nome mãe[:\s]*([A-Z\s]+?)(?=\s+Bairro)/i,
          /Nome mae[:\s]*([A-Z\s]+?)(?=\s+Bairro)/i,
          /mãe[:\s]*([A-Z\s]+?)(?=\s+Bairro)/i,
          /mae[:\s]*([A-Z\s]+?)(?=\s+Bairro)/i
        ],
        endereco: [
          /Endereço[:\s]*RUA\s*-\s*([^N]+?)(?=\s+Nº)/i,
          /Endereco[:\s]*RUA\s*-\s*([^N]+?)(?=\s+N)/i,
          /RUA\s*-\s*([A-Za-z\s]+?)(?=\s+Nº)/i,
          /RUA\s*-\s*([A-Za-z\s]+?)(?=\s+N)/i
        ],
        numero: [
          /N°[:\s]*(\d+)/i,
          /Numero[:\s]*(\d+)/i,
          /nº[:\s]*(\d+)/i,
          /,\s*(\d+)\s*-/i // Pattern para pegar número da rua
        ],
        bairro: [
          /Bairro[:\s]*([^M]+?)(?=\s+Município)/i,
          /Bairro[:\s]*([^M]+?)(?=\s+Municipio)/i,
          /bairro[:\s]*([A-Z\s]+)/i
        ],
        municipio: [
          /Município[:\s]*([^U]+?)(?=\s+UF)/i,
          /Municipio[:\s]*([^U]+?)(?=\s+UF)/i,
          /municipio[:\s]*([A-Z\s]+)/i
        ],
        uf: [
          /UF[:\s]*([A-Z]{2})/i,
          /Estado[:\s]*([A-Z]{2})/i,
          /\/([A-Z]{2})\s/i, // Pattern para pegar UF após barra
          /([A-Z]{2})$/i
        ],
        cep: [
          /CEP[:\s]*([\d.-]+)/i,
          /Cep[:\s]*([\d.-]+)/i,
          /([\d]{2}\.[\d]{3}-[\d]{3})/i,
          /([\d]{5}-[\d]{3})/i
        ],
        telefone: [
          /Telefone[:\s]*([\d()-\s]+)/i,
          /Fone[:\s]*([\d()-\s]+)/i,
          /(\(\d{2}\)\d{4,5}-\d{4})/i, // Pattern para (XX)XXXX-XXXX
          /(\(\d{2}\)\d{8,9})/i
        ],

        // DADOS DA INTERNAÇÃO - Patterns expandidos para código + nome
        procedimentoSolicitado: [
          /Procedimento\s+solicitado[:\s]*([\d]{2}\.[\d]{2}\.[\d]{2}\.[\d]{3}-[\d]\s*-\s*[^M]+?)(?=\s+Mudança)/i,
          /Proc.*solicitado[:\s]*([\d]{2}\.[\d]{2}\.[\d]{2}\.[\d]{3}-[\d]\s*-\s*[^M]+?)(?=\s+Mudanca)/i,
          /solicitado[:\s]*([\d]{2}\.[\d]{2}\.[\d]{2}\.[\d]{3}-[\d]\s*-\s*[^M]+?)(?=\s+Mudança)/i,
          /solicitado[:\s]*([\d]{2}\.[\d]{2}\.[\d]{2}\.[\d]{3}-[\d][^M]*?)(?=\s+Mudança)/i,
          /solicitado[:\s]*([\d]{2}\.[\d]{2}\.[\d]{2}\.[\d]{3}-[\d])/i // Fallback só código
        ],
        mudancaProc: [
          /Mudança de proc\.?\s*(Sim|Não|S|N)/i,
          /Mudanca.*proc.*\?\s*(Sim|Não|S|N)/i,
          /proc\.?\s*(Sim|Não|S|N)\s*CID/i,
          /proc\.\?\s*(Sim|Não)/i
        ],
        procedimentoPrincipal: [
          /Procedimento\s+principal[:\s]*([\d]{2}\.[\d]{2}\.[\d]{2}\.[\d]{3}-[\d]\s*-\s*[^C]+?)(?=\s+CID)/i,
          /Proc.*principal[:\s]*([\d]{2}\.[\d]{2}\.[\d]{2}\.[\d]{3}-[\d]\s*-\s*[^C]+?)(?=\s+CID)/i,
          /principal[:\s]*([\d]{2}\.[\d]{2}\.[\d]{2}\.[\d]{3}-[\d]\s*-\s*[^C]+?)(?=\s+CID)/i,
          /principal[:\s]*([\d]{2}\.[\d]{2}\.[\d]{2}\.[\d]{3}-[\d][^C]*?)(?=\s+CID)/i,
          /([\d]{2}\.[\d]{2}\.[\d]{2}\.[\d]{3}-[\d]\s*-\s*[A-Z\s]+)/i, // Pattern direto completo
          /principal[:\s]*([\d]{2}\.[\d]{2}\.[\d]{2}\.[\d]{3}-[\d])/i // Fallback só código
        ],
        cidPrincipal: [
          /CID principal[:\s]*([A-Z]\d+\s*-\s*[^E]+?)(?=\s+Especialidade)/i,
          /CID.*principal[:\s]*([A-Z]\d+\s*-\s*[^E]+?)(?=\s+Especialidade)/i,
          /CID principal[:\s]*([A-Z]\d+)/i,
          /([A-Z]\d+\s*-\s*[A-Za-z\s]+rotador)/i,
          /([A-Z]\d+\s*-\s*Síndrome[^E]+)/i
        ],
        especialidade: [
          /Especialidade[:\s]*([^M]+?)(?=\s+Modalidade)/i,
          /Especialidade[:\s]*([^M]+?)(?=\s+Modal)/i,
          /especialidade[:\s]*([^M]+)/i,
          /(\d+\s*-\s*[A-Z\s]+)(?=\s+Modalidade)/i
        ],
        modalidade: [
          /Modalidade[:\s]*([^C]+?)(?=\s+Caráter)/i,
          /Modalidade[:\s]*([^C]+?)(?=\s+Carater)/i,
          /modalidade[:\s]*([A-Z\s]+)/i,
          /(Hospitalar|Ambulatorial)/i
        ],
        caracterAtendimento: [
          /Caráter\s+atendimento[:\s]*(.+?)(?=\s|$)/i,
          /Carater.*atendimento[:\s]*(.+?)(?=\s|$)/i,
          /atendimento[:\s]*(.+?)(?=\s|$)/i,
          /(\d+\s*-\s*[A-Z\s]+)$/i // Pattern final da linha
        ],

        // DADOS ESPECÍFICOS DE FATURAMENTO SUS
        utiDias: [
          /UTI[:\s]*(\d+)\s*dias?/i,
          /Unidade.*Terapia.*Intensiva[:\s]*(\d+)/i,
          /Dias.*UTI[:\s]*(\d+)/i,
          /Permanência.*UTI[:\s]*(\d+)/i,
          /(\d+)\s*dias?.*UTI/i
        ],
        atosMedicos: [
          /Atos\s+médicos[:\s]*([^P]+?)(?=\s+Permanência|$)/i,
          /Atos.*medicos[:\s]*([^P]+?)(?=\s+Permanencia|$)/i,
          /medicos[:\s]*([^P]+)/i,
          /Atos[:\s]*(\d+)/i
        ],
        permanenciaDias: [
          /Permanência[:\s]*(\d+)\s*dias?/i,
          /Permanencia[:\s]*(\d+)\s*dias?/i,
          /Dias.*permanência[:\s]*(\d+)/i,
          /Dias.*permanencia[:\s]*(\d+)/i,
          /(\d+)\s*dias?.*permanência/i,
          /(\d+)\s*dias?.*permanencia/i
        ],
        complexidadeEspecifica: [
          /Complexidade\s+específica[:\s]*([^V]+?)(?=\s+Valor|$)/i,
          /Complexidade.*especifica[:\s]*([^V]+?)(?=\s+Valor|$)/i,
          /específica[:\s]*([A-Z\s]+)/i,
          /especifica[:\s]*([A-Z\s]+)/i
        ],
        procedimentoSequencial: [
          /Procedimento\s+sequencial[:\s]*(Sim|Não|S|N)/i,
          /sequencial[:\s]*(Sim|Não|S|N)/i,
          /(PROCEDIMENTOS?\s+SEQUENCIAIS?)/i,
          /SEQUENCIAL/i
        ],
        procedimentoEspecial: [
          /Procedimento\s+especial[:\s]*(Sim|Não|S|N)/i,
          /especial[:\s]*(Sim|Não|S|N)/i,
          /(PROCEDIMENTOS?\s+ESPECIAIS?)/i,
          /ESPECIAL/i
        ],
        valorDiaria: [
          /Valor\s+diária[:\s]*R\$\s*([\d,]+\.?\d*)/i,
          /Valor.*diaria[:\s]*R\$\s*([\d,]+\.?\d*)/i,
          /diária[:\s]*R\$\s*([\d,]+\.?\d*)/i,
          /diaria[:\s]*R\$\s*([\d,]+\.?\d*)/i
        ],
        observacoesFaturamento: [
          /Observações\s+faturamento[:\s]*([^$]+)/i,
          /Observacoes.*faturamento[:\s]*([^$]+)/i,
          /faturamento[:\s]*([^$]+)/i,
          /Obs\.?\s*faturamento[:\s]*([^$]+)/i
        ]
      };

      // Executar extração para cada campo com múltiplos patterns
      let extractedCount = 0;
      
      for (const [field, patterns] of Object.entries(extractors)) {
        let extracted = false;
        
        for (const pattern of patterns) {
          const match = text.match(pattern);
          if (match && match[1]) {
            let value = match[1].trim();
            
            // Limpeza de valor
            if (value && value.length > 0) {
              (data as any)[field] = value;
              extractedCount++;
              extracted = true;
              console.log(`✅ ${field}: "${value}"`);
              break;
            }
          }
        }
        
        if (!extracted) {
          console.warn(`⚠️ Não encontrado: ${field}`);
        }
      }

      console.log(`📊 Total de campos extraídos: ${extractedCount}/33`);

      // Validar campos obrigatórios com fallback
      const requiredFields = ['numeroAIH', 'nomePaciente', 'procedimentoPrincipal'];
      const missingRequired = requiredFields.filter(field => !(data as any)[field]);
      
      // Tentativa de fallback para campos críticos não encontrados
      if (missingRequired.includes('numeroAIH')) {
        // Tentar extrair número AIH de forma mais agressiva
        const aihMatch = text.match(/(\d{11,13}-\d)/i);
        if (aihMatch) {
          data.numeroAIH = aihMatch[1];
          console.log(`�� Fallback numeroAIH encontrado: "${aihMatch[1]}"`);
          missingRequired.splice(missingRequired.indexOf('numeroAIH'), 1);
          extractedCount++;
        } else {
          // ✅ NOVA LÓGICA: Se não encontrar número da AIH, usar "-" para controle por nome
          data.numeroAIH = "-";
          console.log(`🔧 Fallback numeroAIH: "-" (controle por nome de paciente)`);
          missingRequired.splice(missingRequired.indexOf('numeroAIH'), 1);
          extractedCount++;
        }
      }

      if (missingRequired.includes('procedimentoPrincipal')) {
        // Tentar extrair procedimento de forma mais agressiva
        const procMatch = text.match(/(\d{2}\.\d{2}\.\d{2}\.\d{3}-\d)/i);
        if (procMatch) {
          data.procedimentoPrincipal = procMatch[1];
          console.log(`🔧 Fallback procedimentoPrincipal: "${procMatch[1]}"`);
          missingRequired.splice(missingRequired.indexOf('procedimentoPrincipal'), 1);
          extractedCount++;
        }
      }

      console.log(`🔧 Após fallbacks: ${extractedCount}/33 campos, faltando: ${missingRequired.join(', ')}`);
      
      if (missingRequired.length > 0) {
        console.error('❌ Campos obrigatórios faltando:', missingRequired);
        // Não falhar por campos obrigatórios se temos pelo menos 18 campos
        if (extractedCount < 18) {
          throw new Error(`Campos obrigatórios não encontrados: ${missingRequired.join(', ')}`);
        }
      }

      // Retornar dados se temos pelo menos 18 campos ou nenhum obrigatório faltando
      if (extractedCount >= 18 || missingRequired.length === 0) {
        console.log('✅ Extração bem-sucedida');
        return data as AIHPDFData;
      } else {
        console.error('❌ Poucos campos extraídos para validação');
        return null;
      }

    } catch (error) {
      console.error('❌ Erro na extração de dados:', error);
      return null;
    }
  }

  /**
   * Converte dados extraídos para formato AIH padrão
   */
  private convertToStandardAIH(
    data: AIHPDFData, 
    hospitalContext?: { hospitalId: string; hospitalName: string }
  ): AIH {
    // Converter sexo para formato padrão
    const gender = data.sexo?.toLowerCase().includes('masculino') ? 'M' : 
                   data.sexo?.toLowerCase().includes('feminino') ? 'F' : 
                   data.sexo?.toUpperCase().includes('M') ? 'M' : 'F';
    
    // Manter procedimentos completos (código + descrição) - NÃO extrair apenas código
    const procedimentoPrincipalCompleto = data.procedimentoPrincipal || '';
    const procedimentoSolicitadoCompleto = data.procedimentoSolicitado || '';
    
    // Extrair apenas código do CID principal
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
      : deriveSpecialtyFallback(careCode, procedimentoPrincipalCompleto);

    const aih: AIH = {
      id: crypto.randomUUID(),
      hospitalId: hospitalContext?.hospitalId,
      
      // Apresentação da AIH - ✅ NOVA LÓGICA: usar "-" se não tiver número
      numeroAIH: data.numeroAIH || "-",
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
      aihAnterior: data.aihAnterior || '',
      aihPosterior: data.aihPosterior || '',
      
      // Identificação do paciente
      prontuario: data.prontuario || '',
      nomePaciente: data.nomePaciente,
      cns: this.cleanCNS(data.cns),
      nascimento: this.convertDate(data.nascimento),
      sexo: gender,
      nacionalidade: data.nacionalidade || 'BRASIL',
      racaCor: data.racaCor || '',
      tipoDocumento: data.tipoDocumento || '',
      documento: data.documento || '',
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
      
      // Dados da internação - USAR PROCEDIMENTOS COMPLETOS
      procedimentoSolicitado: procedimentoSolicitadoCompleto,
      mudancaProc: data.mudancaProc?.toLowerCase() === 'sim',
      procedimentoPrincipal: procedimentoPrincipalCompleto,
      cidPrincipal: cidCode,
      especialidade: specialtySafe,
      modalidade: data.modalidade || '',
      caracterAtendimento: careCode,
      
      // Dados específicos de faturamento SUS
      utiDias: data.utiDias ? parseInt(data.utiDias) : undefined,
      atosMedicos: data.atosMedicos || undefined,
      permanenciaDias: data.permanenciaDias ? parseInt(data.permanenciaDias) : undefined,
      complexidadeEspecifica: data.complexidadeEspecifica || undefined,
      procedimentoSequencial: data.procedimentoSequencial?.toLowerCase().includes('sim') || 
                              data.procedimentoSequencial?.includes('SEQUENCIAL') || false,
      procedimentoEspecial: data.procedimentoEspecial?.toLowerCase().includes('sim') || 
                           data.procedimentoEspecial?.includes('ESPECIAL') || false,
      valorDiaria: data.valorDiaria ? parseFloat(data.valorDiaria.replace(',', '.')) : undefined,
      observacoesFaturamento: data.observacoesFaturamento || undefined,
      
      // Arrays vazios para procedimentos realizados
      procedimentosRealizados: [],
      
      // Metadados
      createdAt: new Date().toISOString(),
      status: 'pending'
    };

    // 🔎 Marcação de anestesista: primeiro pelo CBO 225151, depois pela Participação contendo "Anestesista" (ou equivalências)
    try {
      const hasAnesthetistByCBO = (data.procedimentos || []).some(p => (p as any)?.profissionais?.some((pr: any) => String(pr?.cbo || '').trim() === '225151'));
      if (!hasAnesthetistByCBO) {
        const participationTextIncludesAnest = (txt: string) => {
          const v = (txt || '').toLowerCase();
          return v.includes('anestesista') || v.includes('anestesia') || v.includes('anest');
        };
        const hasAnesthetistByParticipation = (data.procedimentos || []).some(p => (p as any)?.profissionais?.some((pr: any) => participationTextIncludesAnest(String(pr?.participacao || pr?.participation || ''))));
        (aih as any).hasAnesthetist = hasAnesthetistByParticipation;
      } else {
        (aih as any).hasAnesthetist = true;
      }
    } catch {}

    console.log('🔄 AIH convertida:', {
      numeroAIH: aih.numeroAIH,
      paciente: aih.nomePaciente,
      procedimentoPrincipal: aih.procedimentoPrincipal, // Mostrar completo no log
      cid: aih.cidPrincipal
    });

    return aih;
  }

  /**
   * Métodos auxiliares de conversão
   */
  private convertDate(dateStr: string): string {
    if (!dateStr) return '';
    
    const match = dateStr.match(/(\d{2})\/(\d{2})\/(\d{4})/);
    if (match) {
      const [, day, month, year] = match;
      return `${year}-${month}-${day}`;
    }
    
    return dateStr;
  }

  private cleanCNS(cns: string): string {
    if (!cns) return '';
    return cns.replace(/\D/g, '');
  }

  private cleanPhone(phone: string): string {
    if (!phone) return '';
    return phone.replace(/\D/g, '');
  }

  private buildFullAddress(data: AIHPDFData): string {
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
    if (!aih.numeroAIH || (aih.numeroAIH !== "-" && aih.numeroAIH.trim() === "")) {
      errors.push({ line: 1, field: 'numeroAIH', message: 'Número da AIH é obrigatório' });
    }

    if (!aih.nomePaciente) {
      errors.push({ line: 1, field: 'nomePaciente', message: 'Nome do paciente é obrigatório' });
    }

    if (!aih.procedimentoPrincipal) {
      errors.push({ line: 1, field: 'procedimentoPrincipal', message: 'Procedimento principal é obrigatório' });
    }

    // Validação de formato CNS (deve ter 15 dígitos se preenchido)
    const cnsFields = ['cnsAutorizador', 'cnsSolicitante', 'cnsResponsavel', 'cns'];
    cnsFields.forEach(field => {
      const cns = (aih as any)[field];
      if (cns && cns.length > 0 && cns.length !== 15) {
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

    console.log(`✅ Validação AIH concluída: ${errors.length} erros encontrados`);

    return {
      isValid: errors.length === 0,
      errors
    };
  }
}
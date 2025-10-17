/**
 * Parser para arquivos SISAIH01 - Layout Posicional DATASUS
 * Cada campo tem posição inicial e final fixa na linha
 */

// Mapeamento do layout oficial (posição inicial é base 1, mas JavaScript usa base 0)
export const LAYOUT_SISAIH01 = {
  // Identificação
  NU_AIH: { start: 43, end: 56 },           // posições 44-56 do layout
  IDENT_AIH: { start: 56, end: 58 },        // posições 57-58
  CNES_HOSP: { start: 30, end: 37 },        // posições 31-37
  MUN_HOSP: { start: 37, end: 43 },         // posições 38-43
  APRES_LOTE: { start: 11, end: 17 },       // posições 12-17
  
  // Datas
  DT_EMISSAO: { start: 136, end: 144 },     // posições 137-144
  DT_INTERN: { start: 144, end: 152 },      // posições 145-152
  DT_SAIDA: { start: 152, end: 160 },       // posições 153-160
  
  // Procedimentos
  PROC_SOLICITADO: { start: 160, end: 170 }, // posições 161-170
  PROC_REALIZADO: { start: 171, end: 181 },  // posições 172-181
  CAR_INTERN: { start: 181, end: 183 },      // posições 182-183
  MOT_SAIDA: { start: 183, end: 185 },       // posições 184-185
  
  // Diagnósticos
  DIAG_PRIN: { start: 249, end: 253 },      // posições 250-253
  DIAG_SEC: { start: 253, end: 257 },       // posições 254-257
  DIAG_COMPL: { start: 257, end: 261 },     // posições 258-261
  DIAG_OBITO: { start: 261, end: 265 },     // posições 262-265
  
  // Paciente
  NM_PACIENTE: { start: 268, end: 338 },    // posições 269-338
  DT_NASC_PAC: { start: 338, end: 346 },    // posições 339-346
  SEXO_PAC: { start: 346, end: 347 },       // posições 347-347
  RACA_COR: { start: 347, end: 349 },       // posições 348-349
  NM_MAE_PAC: { start: 349, end: 419 },     // posições 350-419
  NM_RESP_PAC: { start: 419, end: 489 },    // posições 420-489
  NU_DOC_PAC: { start: 490, end: 501 },     // posições 491-501
  NU_CNS: { start: 501, end: 516 },         // posições 502-516
  
  // Endereço
  LOGR_PAC: { start: 522, end: 572 },       // posições 523-572
  NU_END_PAC: { start: 572, end: 579 },     // posições 573-579
  COMPL_END_PAC: { start: 579, end: 594 },  // posições 580-594
  BAIRRO_PAC: { start: 594, end: 624 },     // posições 595-624
  COD_MUN_END_PAC: { start: 624, end: 630 }, // posições 625-630
  UF_PAC: { start: 630, end: 632 },         // posições 631-632
  CEP_PAC: { start: 632, end: 640 },        // posições 633-640
  
  // Hospital
  NU_PRONTUARIO: { start: 640, end: 655 },  // posições 641-655
  NU_ENFERMARIA: { start: 655, end: 659 },  // posições 656-659
  NU_LEITO: { start: 659, end: 663 },       // posições 660-663
  
  // Médicos
  DOC_MED_SOL: { start: 186, end: 201 },    // posições 187-201
  DOC_MED_RESP: { start: 202, end: 217 },   // posições 203-217
};

export interface RegistroSISAIH01 {
  // Identificação
  numero_aih: string;
  tipo_aih: string;
  tipo_aih_descricao: string;
  cnes_hospital: string;
  municipio_hospital: string;
  competencia: string;
  
  // Datas (formato ISO para o banco)
  data_emissao: string | null;
  data_internacao: string | null;
  data_saida: string | null;
  
  // Datas formatadas para exibição
  data_emissao_formatted: string;
  data_internacao_formatted: string;
  data_saida_formatted: string;
  
  // Procedimentos
  procedimento_solicitado: string;
  procedimento_realizado: string;
  carater_internacao: string;
  motivo_saida: string;
  
  // Diagnósticos
  diagnostico_principal: string;
  diagnostico_secundario: string;
  diagnostico_complementar: string;
  diagnostico_obito: string;
  
  // Paciente
  nome_paciente: string;
  data_nascimento: string | null;
  data_nascimento_formatted: string;
  sexo: string;
  sexo_descricao: string;
  raca_cor: string;
  cns: string;
  cpf: string;
  nome_mae: string;
  nome_responsavel: string;
  
  // Endereço
  logradouro: string;
  numero_endereco: string;
  complemento: string;
  bairro: string;
  codigo_municipio: string;
  uf: string;
  cep: string;
  
  // Hospital
  prontuario: string;
  enfermaria: string;
  leito: string;
  
  // Médicos
  medico_solicitante: string;
  medico_responsavel: string;
}

export interface EstatisticasSISAIH01 {
  total_registros: number;
  pacientes_unicos: number;
  total_masculino: number;
  total_feminino: number;
  por_tipo: {
    principal: number;
    continuacao: number;
    longa_permanencia: number;
  };
}

/**
 * Extrai um campo do layout posicional
 */
function extrairCampo(linha: string, nomeCampo: keyof typeof LAYOUT_SISAIH01): string {
  const campo = LAYOUT_SISAIH01[nomeCampo];
  if (!campo) return '';
  
  // Extrair, fazer trim e garantir que não ultrapassa o tamanho máximo
  let valor = linha.substring(campo.start, campo.end).trim();
  
  // Garantir tamanho máximo para campos específicos
  const maxLengths: Record<string, number> = {
    'NU_AIH': 13,
    'TIPO_AIH': 2,
    'CNES_HOSP': 7,
    'MUN_HOSP': 6,
    'APRES_LOTE': 6,
    'PROC_SOLICITADO': 10,
    'PROC_REALIZADO': 10,
    'CAR_INTERN': 2,
    'MOT_SAIDA': 2,
    'DIAG_PRIN': 4,
    'DIAG_SEC': 4,
    'DIAG_COMPL': 4,
    'DIAG_OBITO': 4,
    'SEXO_PAC': 1,
    'RACA_COR': 2,
    'NU_CNS': 15,
    'NU_DOC_PAC': 11,
    'UF_PAC': 2,
    'CEP_PAC': 8,
    'COD_MUN_END_PAC': 6,
    'NU_ENFERMARIA': 4,
    'NU_LEITO': 4,
    'DOC_MED_SOL': 15,
    'DOC_MED_RESP': 15
  };
  
  const maxLength = maxLengths[nomeCampo];
  if (maxLength && valor.length > maxLength) {
    valor = valor.substring(0, maxLength);
  }
  
  return valor;
}

/**
 * Formata data de AAAAMMDD para Date ou string DD/MM/AAAA
 */
function formatarData(dataStr: string, retornarDate = false): Date | string | null {
  if (!dataStr || dataStr === '00000000' || dataStr.length !== 8) {
    return retornarDate ? null : '';
  }
  
  const ano = dataStr.substring(0, 4);
  const mes = dataStr.substring(4, 6);
  const dia = dataStr.substring(6, 8);
  
  if (retornarDate) {
    return new Date(`${ano}-${mes}-${dia}`);
  }
  
  return `${dia}/${mes}/${ano}`;
}

/**
 * Converte data DD/MM/AAAA para formato ISO (YYYY-MM-DD) para o banco
 */
function dataParaISO(dataStr: string): string | null {
  if (!dataStr || dataStr === '00000000' || dataStr.length !== 8) {
    return null;
  }
  
  const ano = dataStr.substring(0, 4);
  const mes = dataStr.substring(4, 6);
  const dia = dataStr.substring(6, 8);
  
  return `${ano}-${mes}-${dia}`;
}

/**
 * Mapeia o tipo de AIH
 */
function obterTipoAIH(codigo: string): string {
  const tipos: Record<string, string> = {
    '01': 'Principal',
    '03': 'Continuação',
    '05': 'Longa Permanência'
  };
  return tipos[codigo] || codigo;
}

/**
 * Parse completo de uma linha do arquivo SISAIH01
 */
export function parseLinhaSISAIH01(linha: string): RegistroSISAIH01 | null {
  if (!linha || linha.length < 100) return null;
  
  const identAIH = extrairCampo(linha, 'IDENT_AIH');
  
  // Processar apenas AIH Principal, Continuação e Longa Permanência
  if (!['01', '03', '05'].includes(identAIH)) {
    return null;
  }
  
  return {
    // Identificação
    numero_aih: extrairCampo(linha, 'NU_AIH'),
    tipo_aih: identAIH,
    tipo_aih_descricao: obterTipoAIH(identAIH),
    cnes_hospital: extrairCampo(linha, 'CNES_HOSP'),
    municipio_hospital: extrairCampo(linha, 'MUN_HOSP'),
    competencia: extrairCampo(linha, 'APRES_LOTE'),
    
    // Datas (formato ISO para o banco)
    data_emissao: dataParaISO(extrairCampo(linha, 'DT_EMISSAO')),
    data_internacao: dataParaISO(extrairCampo(linha, 'DT_INTERN')),
    data_saida: dataParaISO(extrairCampo(linha, 'DT_SAIDA')),
    
    // Datas formatadas para exibição
    data_emissao_formatted: formatarData(extrairCampo(linha, 'DT_EMISSAO')) as string,
    data_internacao_formatted: formatarData(extrairCampo(linha, 'DT_INTERN')) as string,
    data_saida_formatted: formatarData(extrairCampo(linha, 'DT_SAIDA')) as string,
    
    // Procedimentos
    procedimento_solicitado: extrairCampo(linha, 'PROC_SOLICITADO'),
    procedimento_realizado: extrairCampo(linha, 'PROC_REALIZADO'),
    carater_internacao: extrairCampo(linha, 'CAR_INTERN'),
    motivo_saida: extrairCampo(linha, 'MOT_SAIDA'),
    
    // Diagnósticos
    diagnostico_principal: extrairCampo(linha, 'DIAG_PRIN'),
    diagnostico_secundario: extrairCampo(linha, 'DIAG_SEC'),
    diagnostico_complementar: extrairCampo(linha, 'DIAG_COMPL'),
    diagnostico_obito: extrairCampo(linha, 'DIAG_OBITO'),
    
    // Paciente
    nome_paciente: extrairCampo(linha, 'NM_PACIENTE'),
    data_nascimento: dataParaISO(extrairCampo(linha, 'DT_NASC_PAC')),
    data_nascimento_formatted: formatarData(extrairCampo(linha, 'DT_NASC_PAC')) as string,
    sexo: extrairCampo(linha, 'SEXO_PAC'),
    sexo_descricao: extrairCampo(linha, 'SEXO_PAC') === 'M' ? 'Masculino' : 'Feminino',
    raca_cor: extrairCampo(linha, 'RACA_COR'),
    cns: extrairCampo(linha, 'NU_CNS'),
    cpf: extrairCampo(linha, 'NU_DOC_PAC'),
    nome_mae: extrairCampo(linha, 'NM_MAE_PAC'),
    nome_responsavel: extrairCampo(linha, 'NM_RESP_PAC'),
    
    // Endereço
    logradouro: extrairCampo(linha, 'LOGR_PAC'),
    numero_endereco: extrairCampo(linha, 'NU_END_PAC'),
    complemento: extrairCampo(linha, 'COMPL_END_PAC'),
    bairro: extrairCampo(linha, 'BAIRRO_PAC'),
    codigo_municipio: extrairCampo(linha, 'COD_MUN_END_PAC'),
    uf: extrairCampo(linha, 'UF_PAC'),
    cep: extrairCampo(linha, 'CEP_PAC'),
    
    // Hospital
    prontuario: extrairCampo(linha, 'NU_PRONTUARIO'),
    enfermaria: extrairCampo(linha, 'NU_ENFERMARIA'),
    leito: extrairCampo(linha, 'NU_LEITO'),
    
    // Médicos
    medico_solicitante: extrairCampo(linha, 'DOC_MED_SOL'),
    medico_responsavel: extrairCampo(linha, 'DOC_MED_RESP'),
  };
}

/**
 * Processa arquivo completo SISAIH01
 */
export function processarArquivoSISAIH01(conteudo: string): RegistroSISAIH01[] {
  const linhas = conteudo.split('\n').filter(l => l.trim().length > 100);
  const registros: RegistroSISAIH01[] = [];
  
  linhas.forEach(linha => {
    const registro = parseLinhaSISAIH01(linha);
    if (registro) {
      registros.push(registro);
    }
  });
  
  return registros;
}

/**
 * Gera estatísticas dos registros processados
 */
export function gerarEstatisticas(registros: RegistroSISAIH01[]): EstatisticasSISAIH01 {
  const cnsUnicos = new Set(
    registros
      .map(r => r.cns)
      .filter(cns => cns && cns !== '')
  );
  
  return {
    total_registros: registros.length,
    pacientes_unicos: cnsUnicos.size,
    total_masculino: registros.filter(r => r.sexo === 'M').length,
    total_feminino: registros.filter(r => r.sexo === 'F').length,
    por_tipo: {
      principal: registros.filter(r => r.tipo_aih === '01').length,
      continuacao: registros.filter(r => r.tipo_aih === '03').length,
      longa_permanencia: registros.filter(r => r.tipo_aih === '05').length,
    }
  };
}

/**
 * Exporta registros para CSV
 */
export function exportarParaCSV(registros: RegistroSISAIH01[]): string {
  if (!registros || registros.length === 0) return '';
  
  const colunas = [
    'numero_aih',
    'tipo_aih_descricao',
    'cnes_hospital',
    'data_internacao_formatted',
    'data_saida_formatted',
    'nome_paciente',
    'data_nascimento_formatted',
    'sexo_descricao',
    'cns',
    'cpf',
    'nome_mae',
    'logradouro',
    'numero_endereco',
    'bairro',
    'uf',
    'cep',
    'diagnostico_principal',
    'procedimento_realizado',
    'prontuario'
  ];
  
  const cabecalho = colunas.join(';');
  
  const linhas = registros.map(registro => {
    return colunas.map(coluna => {
      const valor = (registro as any)[coluna] || '';
      // Escapar aspas duplas e envolver em aspas
      return `"${String(valor).replace(/"/g, '""')}"`;
    }).join(';');
  });
  
  return '\ufeff' + cabecalho + '\n' + linhas.join('\n');
}

/**
 * Baixa o CSV gerado
 */
export function baixarCSV(registros: RegistroSISAIH01[], nomeArquivo = 'sisaih01_export.csv'): void {
  const csvContent = exportarParaCSV(registros);
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  const url = URL.createObjectURL(blob);
  
  link.setAttribute('href', url);
  link.setAttribute('download', nomeArquivo);
  link.style.visibility = 'hidden';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}


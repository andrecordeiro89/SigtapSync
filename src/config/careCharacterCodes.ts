// ============================================================================
// MAPEAMENTO DE CÓDIGOS DE CARÁTER DE ATENDIMENTO - SIGTAP BILLING WIZARD
// Sistema: SIGTAP Billing Wizard v3.0
// Arquivo: src/config/careCharacterCodes.ts
// ============================================================================

export interface CareCharacterCode {
  code: string;
  description: string;
  shortDescription: string;
  category: 'eletivo' | 'urgencia' | 'ambulatorial' | 'outros';
  color: string;
  bgColor: string;
  borderColor: string;
}

// Definição completa dos códigos de caráter de atendimento
export const CARE_CHARACTER_CODES: Record<string, CareCharacterCode> = {
  '1': {
    code: '1',
    description: 'Eletivo',
    shortDescription: 'Eletivo',
    category: 'eletivo',
    color: 'text-blue-800',
    bgColor: 'bg-blue-100',
    borderColor: 'border-blue-200'
  },
  '2': {
    code: '2',
    description: 'Urgência/Emergência',
    shortDescription: 'Urgência',
    category: 'urgencia',
    color: 'text-red-800',
    bgColor: 'bg-red-100',
    borderColor: 'border-red-200'
  },
  
};

// Array de códigos para facilitar iteração
export const CARE_CHARACTER_LIST = Object.values(CARE_CHARACTER_CODES);

// Mapeamento por categoria
export const CARE_CHARACTER_BY_CATEGORY = {
  eletivo: CARE_CHARACTER_LIST.filter(code => code.category === 'eletivo'),
  urgencia: CARE_CHARACTER_LIST.filter(code => code.category === 'urgencia'),
  ambulatorial: CARE_CHARACTER_LIST.filter(code => code.category === 'ambulatorial'),
  outros: CARE_CHARACTER_LIST.filter(code => code.category === 'outros')
};

// Funções utilitárias para trabalhar com códigos de caráter de atendimento
export const CareCharacterUtils = {
  /**
   * Encontra código por valor
   */
  getByCode: (code: string): CareCharacterCode | undefined => {
    return CARE_CHARACTER_CODES[code];
  },

  /**
   * Obtém descrição do código
   */
  getDescription: (code: string): string => {
    return CARE_CHARACTER_CODES[code]?.description || `Código ${code}`;
  },

  /**
   * Obtém descrição curta do código
   */
  getShortDescription: (code: string): string => {
    return CARE_CHARACTER_CODES[code]?.shortDescription || `Código ${code}`;
  },

  /**
   * Obtém categoria do código
   */
  getCategory: (code: string): string => {
    return CARE_CHARACTER_CODES[code]?.category || 'outros';
  },

  /**
   * Obtém classes CSS para estilização
   */
  getStyleClasses: (code: string): string => {
    const codeData = CARE_CHARACTER_CODES[code];
    if (!codeData) {
      return 'text-gray-800 bg-gray-100 border-gray-200';
    }
    return `${codeData.color} ${codeData.bgColor} ${codeData.borderColor}`;
  },

  /**
   * Verifica se é um código válido
   */
  isValidCode: (code: string): boolean => {
    return code in CARE_CHARACTER_CODES;
  },

  /**
   * Obtém todos os códigos de uma categoria
   */
  getByCategory: (category: 'eletivo' | 'urgencia' | 'ambulatorial' | 'outros'): CareCharacterCode[] => {
    return CARE_CHARACTER_BY_CATEGORY[category] || [];
  },

  /**
   * Formata código para exibição
   */
  formatForDisplay: (code: string, showCode: boolean = true): string => {
    const codeData = CARE_CHARACTER_CODES[code];
    if (!codeData) {
      return `Código ${code}`;
    }
    return showCode ? `${code} - ${codeData.description}` : codeData.description;
  }
};

// Exportar constantes para facilitar uso
export const CARE_CHARACTER_CATEGORIES = {
  ELETIVO: 'eletivo',
  URGENCIA: 'urgencia',
  AMBULATORIAL: 'ambulatorial',
  OUTROS: 'outros'
} as const;

export default {
  CARE_CHARACTER_CODES,
  CARE_CHARACTER_LIST,
  CARE_CHARACTER_BY_CATEGORY,
  CareCharacterUtils,
  CARE_CHARACTER_CATEGORIES
};
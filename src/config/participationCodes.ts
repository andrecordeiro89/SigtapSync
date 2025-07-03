/**
 * CÓDIGOS DE PARTICIPAÇÃO SUS - PROCEDIMENTOS CIRÚRGICOS
 * 
 * Define os códigos oficiais de participação de profissionais em procedimentos
 * conforme normas do SUS para faturamento hospitalar.
 */

export interface ParticipationCode {
  code: string;
  description: string;
  category: 'cirurgiao' | 'anestesista' | 'auxiliar' | 'instrumentador' | 'outros';
  priority: number; // Para ordenação por importância
  requiresPayment: boolean; // Se deve ser pago separadamente
  notes?: string;
}

// CÓDIGOS OFICIAIS DE PARTICIPAÇÃO SUS
export const PARTICIPATION_CODES: ParticipationCode[] = [
  {
    code: '01',
    description: '1º Cirurgião',
    category: 'cirurgiao',
    priority: 1,
    requiresPayment: true,
    notes: 'Cirurgião principal responsável pelo procedimento'
  },
  {
    code: '02',
    description: '2º Cirurgião',
    category: 'cirurgiao',
    priority: 2,
    requiresPayment: true,
    notes: 'Cirurgião auxiliar quando necessário'
  },
  {
    code: '03',
    description: '3º Cirurgião',
    category: 'cirurgiao',
    priority: 3,
    requiresPayment: true,
    notes: 'Terceiro cirurgião em casos complexos'
  },
  {
    code: '04',
    description: 'Anestesista',
    category: 'anestesista',
    priority: 1,
    requiresPayment: true,
    notes: 'Médico anestesiologista'
  },
  {
    code: '05',
    description: '1º Auxiliar',
    category: 'auxiliar',
    priority: 1,
    requiresPayment: true,
    notes: 'Primeiro auxiliar de cirurgia'
  },
  {
    code: '06',
    description: '2º Auxiliar',
    category: 'auxiliar',
    priority: 2,
    requiresPayment: true,
    notes: 'Segundo auxiliar de cirurgia'
  },
  {
    code: '07',
    description: '3º Auxiliar',
    category: 'auxiliar',
    priority: 3,
    requiresPayment: false,
    notes: 'Terceiro auxiliar (nem sempre remunerado)'
  },
  {
    code: '08',
    description: 'Instrumentador',
    category: 'instrumentador',
    priority: 1,
    requiresPayment: true,
    notes: 'Profissional responsável pela instrumentação'
  },
  {
    code: '09',
    description: 'Perfusionista',
    category: 'outros',
    priority: 1,
    requiresPayment: true,
    notes: 'Especialista em circulação extracorpórea'
  },
  {
    code: '10',
    description: 'Outros Profissionais',
    category: 'outros',
    priority: 10,
    requiresPayment: false,
    notes: 'Outros profissionais envolvidos'
  }
];

/**
 * Busca informações de um código de participação
 */
export function getParticipationInfo(code: string): ParticipationCode | null {
  // Normalizar código (remover zeros à esquerda, etc.)
  const normalizedCode = code.trim().padStart(2, '0');
  return PARTICIPATION_CODES.find(p => p.code === normalizedCode) || null;
}

/**
 * Valida se um código de participação é válido
 */
export function isValidParticipationCode(code: string): boolean {
  return getParticipationInfo(code) !== null;
}

/**
 * Formata código de participação para exibição
 */
export function formatParticipationCode(code: string): string {
  const info = getParticipationInfo(code);
  if (!info) {
    return `${code} - Código Inválido`;
  }
  return `${info.code} - ${info.description}`;
}

/**
 * Obtém badge de categoria para UI
 */
export function getParticipationBadge(code: string): { color: string; icon: string; text: string } {
  const info = getParticipationInfo(code);
  if (!info) {
    return { color: 'gray', icon: '❓', text: 'Inválido' };
  }

  const badges = {
    cirurgiao: { color: 'blue', icon: '👨‍⚕️', text: 'Cirurgião' },
    anestesista: { color: 'green', icon: '💉', text: 'Anestesista' },
    auxiliar: { color: 'purple', icon: '👩‍⚕️', text: 'Auxiliar' },
    instrumentador: { color: 'orange', icon: '🔧', text: 'Instrumentador' },
    outros: { color: 'gray', icon: '👤', text: 'Outros' }
  };

  return badges[info.category];
}

/**
 * Verifica se o profissional deve ser pago
 */
export function requiresPayment(code: string): boolean {
  const info = getParticipationInfo(code);
  return info?.requiresPayment || false;
}

/**
 * Obtém lista de códigos por categoria
 */
export function getCodesByCategory(category: ParticipationCode['category']): ParticipationCode[] {
  return PARTICIPATION_CODES
    .filter(p => p.category === category)
    .sort((a, b) => a.priority - b.priority);
}

/**
 * Debug: Lista todos os códigos disponíveis
 */
export function logParticipationCodes(): void {
  console.log('📋 CÓDIGOS DE PARTICIPAÇÃO SUS:');
  PARTICIPATION_CODES.forEach(code => {
    console.log(`${code.code} - ${code.description} (${code.category}) - Pago: ${code.requiresPayment ? 'Sim' : 'Não'}`);
  });
} 
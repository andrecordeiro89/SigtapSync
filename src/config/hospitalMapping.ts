// ============================================================================
// MAPEAMENTO DE HOSPITAIS - SIGTAP BILLING WIZARD
// Sistema: SIGTAP Billing Wizard v3.0
// Arquivo: src/config/hospitalMapping.ts
// ============================================================================

export interface Hospital {
  id: string;
  name: string;
  code: string;
  displayName: string;
  users: string[];
}

export interface UserRole {
  role: string;
  hasFullAccess: boolean;
  description: string;
}

// Definição completa dos hospitais
export const HOSPITALS: Record<string, Hospital> = {
  CAR: {
    id: '792a0316-92b4-4504-8238-491d284099a3',
    name: 'Hospital CAR',
    code: 'CAR',
    displayName: 'CAR - Centro de Atendimento Regional',
    users: [
      'faturamento.car@sigtap.com',
      'faturamento.car01@sigtap.com',
      'faturamento.car02@sigtap.com'
    ]
  },
  CAS: {
    id: '1d8ca73a-1927-462e-91c0-fa7004d0b377',
    name: 'Hospital CAS',
    code: 'CAS',
    displayName: 'CAS - Centro de Atendimento Especializado',
    users: [
      'faturamento.cas@sigtap.com',
      'faturamento.cas01@sigtap.com',
      'faturamento.cas02@sigtap.com'
    ]
  },
  FAX: {
    id: '019c7380-459d-4aa5-bbd8-2dba4f361e7e',
    name: 'Hospital FAX',
    code: 'FAX',
    displayName: 'FAX - Centro Médico Especializado',
    users: [
      'faturamento.fax@sigtap.com',
      'faturamento.fax01@sigtap.com',
      'faturamento.fax02@sigtap.com'
    ]
  },
  FOZ: {
    id: '47eddf6e-ac64-4433-acc1-7b644a2b43d0',
    name: 'Hospital FOZ',
    code: 'FOZ',
    displayName: 'FOZ - Hospital Regional',
    users: [
      'faturamento.foz@sigtap.com',
      'faturamento.foz01@sigtap.com',
      'faturamento.foz02@sigtap.com'
    ]
  },
  FRG: {
    id: 'a8978eaa-b90e-4dc8-8fd5-0af984374d34',
    name: 'Hospital FRG',
    code: 'FRG',
    displayName: 'FRG - Centro Hospitalar Integrado',
    users: [
      'faturamento.frg@sigtap.com',
      'faturamento.frg01@sigtap.com',
      'faturamento.frg02@sigtap.com',
      'faturamento.frg.03@sigtap.com',
      'faturamento.frg.04@sigtap.com',
      'faturamento.frg.05@sigtap.com'
    ]
  },
  SM: {
    id: '68bf9b1a-9d0b-423b-9bb3-3c02017b1d7b',
    name: 'Hospital SM',
    code: 'SM',
    displayName: 'SM - Santa Maria Hospital',
    users: [
      'faturamento.sm@sigtap.com',
      'faturamento.sm01@sigtap.com',
      'faturamento.sm02@sigtap.com'
    ]
  },
  GUA: {
    id: '1218dd7b-efcb-442e-ad2b-b72d04128cb9',
    name: 'Hospital GUA',
    code: 'GUA',
    displayName: 'GUA - Centro de Medicina Avançada',
    users: [
      'faturamento.gua@sigtap.com',
      'faturamento.gua01@sigtap.com',
      'faturamento.gua02@sigtap.com'
    ]
  },
  ARA: {
    id: '01221e51-4bcd-4c45-b3d3-18d1df25c8f2',
    name: 'Hospital ARA',
    code: 'ARA',
    displayName: 'ARA - Centro de Atendimento Araras',
    users: [
      'faturamento.ara@sigtap.com',
      'faturamento.ara01@sigtap.com',
      'faturamento.ara02@sigtap.com'
    ]
  }
};

// Definição dos roles e suas permissões
export const USER_ROLES: Record<string, UserRole> = {
  // Roles com acesso total
  admin: {
    role: 'admin',
    hasFullAccess: true,
    description: 'Administrador do Sistema'
  },
  developer: {
    role: 'developer',
    hasFullAccess: true,
    description: 'Desenvolvedor'
  },
  ti: {
    role: 'ti',
    hasFullAccess: true,
    description: 'Tecnologia da Informação'
  },
  auditoria: {
    role: 'auditoria',
    hasFullAccess: true,
    description: 'Auditoria'
  },
  auditor: {
    role: 'auditor',
    hasFullAccess: true,
    description: 'Auditor'
  },
  coordenacao: {
    role: 'coordenacao',
    hasFullAccess: true,
    description: 'Coordenação'
  },
  coordinator: {
    role: 'coordinator',
    hasFullAccess: true,
    description: 'Coordenador'
  },
  diretoria: {
    role: 'diretoria',
    hasFullAccess: true,
    description: 'Diretoria'
  },
  director: {
    role: 'director',
    hasFullAccess: true,
    description: 'Diretor'
  },
  medicos: {
    role: 'medicos',
    hasFullAccess: true,
    description: 'Corpo Médico'
  },
  
  // Role com acesso restrito
  user: {
    role: 'user',
    hasFullAccess: false,
    description: 'Usuário Operacional'
  }
};

// Array de hospitais para facilitar iteração
export const HOSPITAL_LIST = Object.values(HOSPITALS);

// Array de IDs de hospitais
export const HOSPITAL_IDS = HOSPITAL_LIST.map(h => h.id);

// Mapeamento reverso: ID -> Hospital
export const HOSPITAL_BY_ID = HOSPITAL_LIST.reduce((acc, hospital) => {
  acc[hospital.id] = hospital;
  return acc;
}, {} as Record<string, Hospital>);

// Mapeamento reverso: Código -> Hospital
export const HOSPITAL_BY_CODE = HOSPITAL_LIST.reduce((acc, hospital) => {
  acc[hospital.code] = hospital;
  return acc;
}, {} as Record<string, Hospital>);

// Funções utilitárias para trabalhar com hospitais
export const HospitalUtils = {
  /**
   * Encontra hospital por ID
   */
  getById: (id: string): Hospital | undefined => {
    return HOSPITAL_BY_ID[id];
  },

  /**
   * Encontra hospital por código
   */
  getByCode: (code: string): Hospital | undefined => {
    return HOSPITAL_BY_CODE[code];
  },

  /**
   * Encontra hospital por email do usuário
   */
  getByUserEmail: (email: string): Hospital | undefined => {
    return HOSPITAL_LIST.find(hospital => 
      hospital.users.includes(email)
    );
  },

  /**
   * Verifica se um email pertence a algum hospital
   */
  isHospitalUser: (email: string): boolean => {
    return HOSPITAL_LIST.some(hospital => 
      hospital.users.includes(email)
    );
  },

  /**
   * Obtém o código do hospital baseado no email
   */
  getHospitalCodeByEmail: (email: string): string | undefined => {
    const hospital = HospitalUtils.getByUserEmail(email);
    return hospital?.code;
  },

  /**
   * Lista todos os hospitais acessíveis para um usuário
   */
  getAccessibleHospitals: (userRole: string, hospitalAccess: string[]): Hospital[] => {
    // Roles especiais têm acesso a todos os hospitais
    if (USER_ROLES[userRole]?.hasFullAccess) {
      return HOSPITAL_LIST;
    }

    // Usuários básicos só veem seus hospitais
    if (userRole === 'user') {
      return HOSPITAL_LIST.filter(hospital => 
        hospitalAccess.includes(hospital.id) || hospitalAccess.includes('ALL')
      );
    }

    return [];
  },

  /**
   * Verifica se usuário tem acesso a um hospital específico
   */
  hasHospitalAccess: (userRole: string, hospitalAccess: string[], hospitalId: string): boolean => {
    // Roles especiais têm acesso total
    if (USER_ROLES[userRole]?.hasFullAccess) {
      return true;
    }

    // Usuários básicos verificam lista de acesso
    if (userRole === 'user') {
      return hospitalAccess.includes(hospitalId) || hospitalAccess.includes('ALL');
    }

    return false;
  }
};

// Exportar constantes para facilitar uso
export const ROLE_TYPES = {
  ADMIN_ROLES: ['admin', 'developer', 'ti'],
  MANAGEMENT_ROLES: ['diretoria', 'director', 'coordenacao', 'coordinator'],
  AUDIT_ROLES: ['auditoria', 'auditor'],
  MEDICAL_ROLES: ['medicos'],
  BASIC_ROLES: ['user']
} as const;

export default {
  HOSPITALS,
  USER_ROLES,
  HOSPITAL_LIST,
  HospitalUtils,
  ROLE_TYPES
}; 
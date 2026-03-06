/**
 * ================================================================
 * TIPOS E INTERFACES - REGRAS DE PAGAMENTO MÉDICO
 * ================================================================
 * Arquivo centralizado com todas as interfaces do sistema
 * ================================================================
 */

export interface DoctorPaymentRule {
  doctorName: string;
  doctorCns?: string;
  
  // 🆕 REGRA DE PERCENTUAL SOBRE TOTAL
  percentageRule?: {
    percentage: number;
    description: string;
  };
  
  // 🆕 REGRA DE VALOR FIXO (independente de procedimentos)
  fixedPaymentRule?: {
    amount: number;
    description: string;
  };
  
  // 🆕 REGRA DE APENAS PROCEDIMENTO PRINCIPAL (múltiplos procedimentos)
  onlyMainProcedureRule?: {
    enabled: boolean;
    description: string;
    logic?: string;
  };
  
  // Regras individuais por procedimento
  rules: {
    procedureCode: string;
    standardValue: number;
    specialValue?: number;
    condition?: 'multiple' | 'single';
    description?: string;
    // 🆕 Valor diferente para procedimento secundário (2º)
    secondaryValue?: number;
    // 🆕 Valor diferente para procedimento terciário (3º)
    tertiaryValue?: number;
    // 🆕 Valor diferente para procedimento quaternário (4º)
    quaternaryValue?: number;
  }[];
  
  // Regra múltipla antiga (compatibilidade)
  multipleRule?: {
    codes: string[];
    totalValue: number;
    description: string;
  };
  
  // Regras múltiplas (array de combinações)
  multipleRules?: {
    codes: string[];
    totalValue: number;
    description: string;
  }[];
}

export interface ProcedurePaymentInfo {
  procedure_code: string;
  procedure_description?: string;
  value_reais: number;
  cbo?: string;
  sequence?: number;
  sp_ptsp?: number;
  calculatedPayment?: number;
  paymentRule?: string;
  isSpecialRule?: boolean;
}

export interface ProcedureWithSigtap {
  procedureCode: string;
  sequenceOrder: number;
  valueHosp: number;
  valueProf: number;
  valueAmb: number;
  registrationInstrument?: string;
}

export interface CalculatedPaymentResult {
  procedures: (ProcedurePaymentInfo & { 
    calculatedPayment: number; 
    paymentRule: string; 
    isSpecialRule: boolean 
  })[];
  totalPayment: number;
  appliedRule: string;
}

export interface FixedPaymentResult {
  calculatedPayment: number;
  appliedRule: string;
  hasFixedRule: boolean;
}

export interface PercentagePaymentResult {
  calculatedPayment: number;
  appliedRule: string;
  hasPercentageRule: boolean;
}

export interface UnruledProceduresResult {
  hasUnruledProcedures: boolean;
  unruledProcedures: string[];
  totalUnruled: number;
}

// Tipo para organização de regras por hospital
export type HospitalRules = Record<string, DoctorPaymentRule>;

// Mapeamento de IDs de hospital para chaves
export interface HospitalMapping {
  id: string;
  key: string;
  name: string;
}


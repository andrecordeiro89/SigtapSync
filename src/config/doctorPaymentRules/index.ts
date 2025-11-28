/**
 * ================================================================
 * ÍNDICE CENTRAL - REGRAS DE PAGAMENTO MÉDICO
 * ================================================================
 * Exporta todas as interfaces, funções e regras
 * Ponto de entrada único para o sistema de pagamentos
 * ================================================================
 */

// ================================================================
// TIPOS E INTERFACES
// ================================================================
export type {
  DoctorPaymentRule,
  ProcedurePaymentInfo,
  CalculatedPaymentResult,
  FixedPaymentResult,
  PercentagePaymentResult,
  UnruledProceduresResult,
  HospitalRules,
  HospitalMapping
} from './types';

// ================================================================
// FUNÇÕES UTILITÁRIAS
// ================================================================
export {
  detectHospitalFromContext,
  initializeRulesCache,
  calculateFixedPayment,
  calculatePercentagePayment,
  hasIndividualPaymentRules,
  isFixedMonthlyPayment,
  getDoctorRuleProcedureCodes,
  checkUnruledProcedures,
  formatCurrency,
  HOSPITAL_MAPPINGS
} from './utils';

// ================================================================
// FUNÇÃO PRINCIPAL DE CÁLCULO
// ================================================================
export {
  calculateDoctorPayment,
  ALL_HOSPITAL_RULES
} from './calculateDoctorPayment';

// ================================================================
// REGRAS DE HOSPITAIS INDIVIDUAIS (para uso direto se necessário)
// ================================================================
export { TORAO_TOKUDA_RULES } from './hospitals/toraoTokuda';
export { HOSPITAL_18_DEZEMBRO_RULES } from './hospitals/hospital18Dezembro';
export { HOSPITAL_SAO_JOSE_RULES } from './hospitals/hospitalSaoJose';
export { HOSPITAL_JUAREZ_BARRETO_RULES } from './hospitals/hospitalJuarezBarreto';
export { HOSPITAL_NOSSA_SENHORA_APARECIDA_RULES } from './hospitals/hospitalNossaSenhoraAparecida';
export { HOSPITAL_SANTA_ALICE_RULES } from './hospitals/hospitalSantaAlice';
export { HOSPITAL_MATERNIDADE_FRG_RULES } from './hospitals/hospitalMaternidadeFrg';

// Outros hospitais serão exportados aqui conforme refatoração
// etc...


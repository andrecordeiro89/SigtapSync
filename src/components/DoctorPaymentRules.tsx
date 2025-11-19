/**
 * ================================================================
 * COMPONENTE DE REGRAS DE PAGAMENTO MÉDICO
 * ================================================================
 * Criado em: 2024-12-19
 * Propósito: Implementar regras específicas de pagamento por médico
 * Funcionalidade: Calcular valores adequados baseado em regras customizadas
 * ================================================================
 */

import React from 'react';
import { Badge } from './ui/badge';
import { Card, CardContent } from './ui/card';
import { DollarSign, Calculator, AlertTriangle, CheckCircle } from 'lucide-react';
import { shouldCalculateAnesthetistProcedure } from '../utils/anesthetistLogic';
import { applySpecialCalculation, type ProcedureWithSigtap } from '../config/susCalculationRules';

// ================================================================
// TIPOS E INTERFACES
// ================================================================

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
  rules: {
    procedureCode: string;
    standardValue: number;
    specialValue?: number;
    condition?: 'multiple' | 'single';
    description?: string;
  }[];
  multipleRule?: {
    codes: string[];
    totalValue: number;
    description: string;
  };
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
  calculatedPayment?: number;
  paymentRule?: string;
  isSpecialRule?: boolean;
}

interface DoctorPaymentRulesProps {
  doctorName: string;
  procedures: ProcedurePaymentInfo[];
  hospitalId?: string;
  className?: string;
}

// ================================================================
// REGRAS DE PAGAMENTO POR MÉDICO
// ================================================================
// Organizado por Hospital - Programa Opera Paraná
// Hospital: Torao Tokuda - Apucarana
// ================================================================

// ================================================================
// 🏥 REGRAS DE PAGAMENTO POR HOSPITAL - ESTRUTURA HIERÁRQUICA
// ================================================================

// 🚀 OTIMIZAÇÃO #3: CACHE DE REGRAS PARA BUSCA O(1)
// Maps indexados por médico para acesso instantâneo
let FIXED_RULES_CACHE: Map<string, { amount: number; description: string; hospitalId?: string }> | null = null;
let PERCENTAGE_RULES_CACHE: Map<string, { percentage: number; description: string; hospitalId?: string }> | null = null;
let INDIVIDUAL_RULES_CACHE: Map<string, DoctorPaymentRule> | null = null;

const DOCTOR_PAYMENT_RULES_BY_HOSPITAL: Record<string, Record<string, DoctorPaymentRule>> = {
  // ================================================================
  // HOSPITAL TORAO TOKUDA - APUCARANA (APU)
  // Hospital ID: (anterior - manter compatibilidade)
  // ================================================================
  'TORAO_TOKUDA_APUCARANA': {
    'HUMBERTO MOREIRA DA SILVA': {
    doctorName: 'HUMBERTO MOREIRA DA SILVA',
    rules: [
      {
        procedureCode: '04.04.01.048-2',
        standardValue: 650.00,
        description: 'Valor padrão R$ 650,00'
      },
      {
        procedureCode: '04.04.01.041-5',
        standardValue: 650.00,
        description: 'Valor padrão R$ 650,00'
      },
      {
        procedureCode: '04.04.01.002-4',
        standardValue: 650.00,
        description: 'Valor padrão R$ 650,00'
      },
      {
        procedureCode: '04.04.01.001-6',
        standardValue: 650.00,
        description: 'Valor padrão R$ 650,00'
      },
      {
        procedureCode: '04.04.01.003-2',
        standardValue: 650.00,
        description: 'Valor padrão R$ 650,00'
      }
    ],
    multipleRule: {
      codes: ['04.04.01.048-2', '04.04.01.041-5', '04.04.01.002-4', '04.04.01.001-6', '04.04.01.003-2'],
      totalValue: 800.00,
      description: 'Dois ou mais procedimentos: R$ 800,00 TOTAL'
    }
  },
  
  'JOSE GABRIEL GUERREIRO': {
    doctorName: 'JOSE GABRIEL GUERREIRO',
    rules: [
      // ================================================================
      // 🩺 PROCEDIMENTOS VASCULARES - CIRURGIA DE VARIZES
      // Especialidade: Cirurgia Vascular
      // Última atualização: Hoje
      // ================================================================
      {
        procedureCode: '04.06.02.057-4',
        standardValue: 900.00,
        description: 'TRATAMENTO CIRÚRGICO DE VARIZES (UNILATERAL) - R$ 900,00'
      },
      {
        procedureCode: '04.06.02.056-6',
        standardValue: 900.00,
        description: 'TRATAMENTO CIRURGICO DE VARIZES (BILATERAL) - R$ 900,00'
      },
      // ================================================================
      // 💉 PROCEDIMENTOS ESCLEROSANTES NÃO ESTÉTICOS
      // ================================================================
      {
        procedureCode: '03.09.07.001-5',
        standardValue: 100.00,
        description: 'TRATAMENTO ESCLEROSANTE NÃO ESTÉTICO DE VARIZES - R$ 100,00'
      },
      {
        procedureCode: '03.09.07.002-3',
        standardValue: 150.00,
        description: 'TRATAMENTO ESCLEROSANTE NÃO ESTÉTICO DE VARIZES - R$ 150,00'
      }
    ]
  },
  
  'HELIO SHINDY KISSINA': {
    doctorName: 'HELIO SHINDY KISSINA',
    rules: [
      // ================================================================
      // 🔬 PROCEDIMENTOS INDIVIDUAIS - DR. HELIO SHINDY KISSINA
      // Especialidade: Urologia
      // Última atualização: 27/10/2025
      // ================================================================
      {
        procedureCode: '04.09.01.023-5',
        standardValue: 1000.00,
        description: 'NEFROLITOTOMIA PERCUTÂNEA - R$ 1.000,00'
      },
      {
        procedureCode: '04.09.01.059-6',
        standardValue: 900.00,
        description: 'URETEROLITOTRIPSIA TRANSURETEROSCÓPICA (SEMIRRÍGIDA) - R$ 900,00'
      },
      {
        procedureCode: '04.09.01.018-9',
        standardValue: 1000.00,
        description: 'LITOTRIPSIA (FLEXÍVEL) - R$ 1.000,00'
      },
      {
        procedureCode: '04.09.01.017-0',
        standardValue: 250.00,
        description: 'INSTALAÇÃO ENDOSCÓPICA DE CATETER DUPLO J - R$ 250,00'
      },
      {
        procedureCode: '04.09.03.004-0',
        standardValue: 1000.00,
        description: 'RESSECÇÃO ENDOSCÓPICA DE PRÓSTATA - R$ 1.000,00'
      },
      {
        procedureCode: '04.09.03.002-3',
        standardValue: 1000.00,
        description: 'PROSTATECTOMIA SUPRAPÚBICA - R$ 1.000,00'
      },
      {
        procedureCode: '04.09.04.021-5',
        standardValue: 300.00,
        description: 'TRATAMENTO CIRÚRGICO DE HIDROCELE - R$ 300,00'
      },
      {
        procedureCode: '04.09.05.008-3',
        standardValue: 250.00,
        description: 'POSTECTOMIA - R$ 250,00'
      },
      {
        procedureCode: '04.09.04.024-0',
        standardValue: 450.00,
        description: 'VASECTOMIA - R$ 450,00'
      },
      {
        procedureCode: '04.09.04.023-1',
        standardValue: 250.00,
        description: 'TRATAMENTO CIRÚRGICO DE VARICOCELE - R$ 250,00'
      },
      {
        procedureCode: '04.09.04.013-4',
        standardValue: 400.00,
        description: 'ORQUIDOPEXIA UNILATERAL - R$ 400,00'
      },
      {
        procedureCode: '04.09.04.012-6',
        standardValue: 450.00,
        description: 'ORQUIDOPEXIA BILATERAL - R$ 450,00'
      },
      {
        procedureCode: '04.09.01.006-5',
        standardValue: 600.00,
        description: 'CISTOLITOTOMIA E/OU RETIRADA DE CORPO ESTRANHO DA BEXIGA (RETIRADA DE CÁLCULO VESICAL ENDOSCÓPICA OU CONVENCIONAL) - R$ 600,00'
      },
      {
        procedureCode: '04.09.05.007-5',
        standardValue: 500.00,
        description: 'PLÁSTICA TOTAL DO PÊNIS (INCLUI PEYRONIE) - R$ 500,00'
      },
      {
        procedureCode: 'RESSECÇÃO_CISTOS',
        standardValue: 250.00,
        description: 'RESSECÇÃO DE CISTOS/CAUTERIZAÇÕES - R$ 250,00'
      },
      {
        procedureCode: '04.09.04.016-9',
        standardValue: 500.00,
        description: 'ORQUIECTOMIA UNILATERAL - R$ 500,00'
      },
      {
        procedureCode: '04.09.01.032-4',
        standardValue: 700.00,
        description: 'PIELOPLASTIA - R$ 700,00'
      },
      {
        procedureCode: '04.09.01.021-9',
        standardValue: 1200.00,
        description: 'NEFRECTOMIA TOTAL - R$ 1.200,00'
      },
      {
        procedureCode: '04.09.01.020-0',
        standardValue: 1000.00,
        description: 'NEFRECTOMIA PARCIAL - R$ 1.000,00'
      },
      {
        procedureCode: '04.09.01.022-7',
        standardValue: 900.00,
        description: 'NEFROLITOTOMIA (ANATRÓFICA) - R$ 900,00'
      },
      {
        procedureCode: '04.09.01.029-4',
        standardValue: 400.00,
        description: 'NEFROSTOMIA PERCUTÂNEA - R$ 400,00'
      },
      {
        procedureCode: '04.09.02.017-6',
        standardValue: 250.00,
        description: 'URETROTOMIA INTERNA - R$ 250,00'
      }
    ],
    // ================================================================
    // 🔗 REGRAS DE MÚLTIPLOS PROCEDIMENTOS - DR. HELIO SHINDY KISSINA
    // Sistema: Valores fixos para combinações específicas
    // Total: 16 combinações cadastradas
    // ================================================================
    multipleRules: [
      // Grupo 1: NEFROLITOTOMIA PERCUTÂNEA + Combinações
      {
        codes: ['04.09.01.023-5', '04.09.01.017-0'],
        totalValue: 1100.00,
        description: 'NEFROLITOTOMIA PERCUTÂNEA + INSTALAÇÃO ENDOSCÓPICA DE CATETER DUPLO J - R$ 1.100,00'
      },
      {
        codes: ['04.09.01.023-5', '04.09.01.014-6'],
        totalValue: 1300.00,
        description: 'NEFROLITOTOMIA PERCUTÂNEA + EXTRAÇÃO ENDOSCÓPICA DE CÁLCULO EM PELVE RENAL - R$ 1.300,00'
      },
      {
        codes: ['04.09.01.023-5', '04.09.01.017-0', '04.09.01.014-6'],
        totalValue: 1400.00,
        description: 'NEFROLITOTOMIA PERCUTÂNEA + INSTALAÇÃO ENDOSCÓPICA DE CATETER DUPLO J + EXTRAÇÃO ENDOSCÓPICA DE CÁLCULO EM PELVE RENAL - R$ 1.400,00'
      },
      {
        codes: ['04.09.01.023-5', '04.09.01.014-6', '04.09.01.059-6'],
        totalValue: 1500.00,
        description: 'NEFROLITOTOMIA PERCUTÂNEA + EXTRAÇÃO ENDOSCÓPICA DE CÁLCULO EM PELVE RENAL + URETEROLITOTRIPSIA TRANSURETEROSCÓPICA (FLEXÍVEL OU SEMIRRÍGIDA) - R$ 1.500,00'
      },
      {
        codes: ['04.09.01.023-5', '04.09.01.017-0', '04.09.01.014-6', '04.09.01.059-6'],
        totalValue: 1600.00,
        description: 'NEFROLITOTOMIA PERCUTÂNEA + INSTALAÇÃO ENDOSCÓPICA DE CATETER DUPLO J + EXTRAÇÃO ENDOSCÓPICA DE CÁLCULO EM PELVE RENAL + URETEROLITOTRIPSIA TRANSURETEROSCÓPICA (FLEXÍVEL OU SEMIRRÍGIDA) - R$ 1.600,00'
      },
      
      // Grupo 2: URETEROLITOTRIPSIA + Combinações
      {
        codes: ['04.09.01.059-6', '04.09.01.017-0'],
        totalValue: 1000.00,
        description: 'URETEROLITOTRIPSIA TRANSURETEROSCÓPICA + INSTALAÇÃO ENDOSCÓPICA DE CATETER DUPLO J (SEMIRRÍGIDA) - R$ 1.000,00'
      },
      
      // Grupo 3: LITOTRIPSIA (FLEXÍVEL) + Combinações
      {
        codes: ['04.09.01.018-9', '04.09.01.017-0'],
        totalValue: 1100.00,
        description: 'LITOTRIPSIA (FLEXÍVEL) + INSTALAÇÃO ENDOSCÓPICA DE CATETER DUPLO J - R$ 1.100,00'
      },
      {
        codes: ['04.09.01.018-9', '04.09.01.014-6', '04.09.01.017-0'],
        totalValue: 1200.00,
        description: 'LITOTRIPSIA (FLEXÍVEL) + EXTRAÇÃO ENDOSCÓPICA DE CÁLCULO EM PELVE RENAL + INSTALAÇÃO ENDOSCÓPICA DE CATETER DUPLO J - R$ 1.200,00'
      },
      {
        codes: ['04.09.01.018-9', '04.09.01.059-6', '04.09.01.014-6', '04.09.01.017-0'],
        totalValue: 1300.00,
        description: 'LITOTRIPSIA (FLEXÍVEL) + URETEROLITOTRIPSIA TRANSURETEROSCÓPICA (SEMIRRÍGIDA) + EXTRAÇÃO ENDOSCÓPICA DE CÁLCULO EM PELVE RENAL + INSTALAÇÃO ENDOSCÓPICA DE CATETER DUPLO J - R$ 1.300,00'
      },
      
      // Grupo 4: PRÓSTATA + Combinações
      {
        codes: ['04.09.03.004-0', '04.09.01.038-3'],
        totalValue: 1200.00,
        description: 'RESSECÇÃO ENDOSCÓPICA DE PRÓSTATA + RESSECÇÃO ENDOSCÓPICA DE LESÃO VESICAL - R$ 1.200,00'
      },
      
      // Grupo 5: HIDROCELE + Combinações
      {
        codes: ['04.09.04.021-5', '04.09.04.019-3'],
        totalValue: 400.00,
        description: 'TRATAMENTO CIRÚRGICO DE HIDROCELE + RESSECÇÃO PARCIAL DA BOLSA ESCROTAL - R$ 400,00'
      },
      {
        codes: ['04.09.04.021-5', '04.09.04.019-3', '04.09.04.017-7'],
        totalValue: 500.00,
        description: 'TRATAMENTO CIRÚRGICO DE HIDROCELE + RESSECÇÃO PARCIAL DA BOLSA ESCROTAL + PLÁSTICA DA BOLSA ESCROTAL - R$ 500,00'
      },
      
      // Grupo 6: ORQUIDOPEXIA + PLÁSTICA BOLSA ESCROTAL
      {
        codes: ['04.09.04.013-4', '04.09.04.017-7'],
        totalValue: 550.00,
        description: 'ORQUIDOPEXIA UNILATERAL + PLÁSTICA DA BOLSA ESCROTAL - R$ 550,00'
      },
      {
        codes: ['04.09.04.012-6', '04.09.04.017-7'],
        totalValue: 550.00,
        description: 'ORQUIDOPEXIA BILATERAL + PLÁSTICA DA BOLSA ESCROTAL - R$ 550,00'
      },
      
      // Grupo 7: PIELOPLASTIA + Combinações
      {
        codes: ['04.09.01.032-4', '04.09.01.057-0'],
        totalValue: 1000.00,
        description: 'PIELOPLASTIA + URETEROPLASTIA - R$ 1.000,00'
      },
      {
        codes: ['04.09.01.032-4', '04.09.01.057-0', '04.09.01.017-0'],
        totalValue: 1100.00,
        description: 'PIELOPLASTIA + URETEROPLASTIA + INSTALAÇÃO ENDOSCÓPICA DE CATETER DUPLO J - R$ 1.100,00'
      }
    ]
  },
  
  'GUILHERME AUGUSTO STORER': {
    doctorName: 'GUILHERME AUGUSTO STORER',
    rules: [
      // ================================================================
      // 🔬 PROCEDIMENTOS INDIVIDUAIS - DR. GUILHERME AUGUSTO STORER
      // Especialidade: Urologia
      // Última atualização: 27/10/2025
      // Mesmas regras do Dr. HELIO SHINDY KISSINA
      // ================================================================
      {
        procedureCode: '04.09.01.023-5',
        standardValue: 1000.00,
        description: 'NEFROLITOTOMIA PERCUTÂNEA - R$ 1.000,00'
      },
      {
        procedureCode: '04.09.01.059-6',
        standardValue: 900.00,
        description: 'URETEROLITOTRIPSIA TRANSURETEROSCÓPICA (SEMIRRÍGIDA) - R$ 900,00'
      },
      {
        procedureCode: '04.09.01.018-9',
        standardValue: 1000.00,
        description: 'LITOTRIPSIA (FLEXÍVEL) - R$ 1.000,00'
      },
      {
        procedureCode: '04.09.01.017-0',
        standardValue: 250.00,
        description: 'INSTALAÇÃO ENDOSCÓPICA DE CATETER DUPLO J - R$ 250,00'
      },
      {
        procedureCode: '04.09.03.004-0',
        standardValue: 1000.00,
        description: 'RESSECÇÃO ENDOSCÓPICA DE PRÓSTATA - R$ 1.000,00'
      },
      {
        procedureCode: '04.09.03.002-3',
        standardValue: 1000.00,
        description: 'PROSTATECTOMIA SUPRAPÚBICA - R$ 1.000,00'
      },
      {
        procedureCode: '04.09.04.021-5',
        standardValue: 300.00,
        description: 'TRATAMENTO CIRÚRGICO DE HIDROCELE - R$ 300,00'
      },
      {
        procedureCode: '04.09.05.008-3',
        standardValue: 250.00,
        description: 'POSTECTOMIA - R$ 250,00'
      },
      {
        procedureCode: '04.09.04.024-0',
        standardValue: 450.00,
        description: 'VASECTOMIA - R$ 450,00'
      },
      {
        procedureCode: '04.09.04.023-1',
        standardValue: 250.00,
        description: 'TRATAMENTO CIRÚRGICO DE VARICOCELE - R$ 250,00'
      },
      {
        procedureCode: '04.09.04.013-4',
        standardValue: 400.00,
        description: 'ORQUIDOPEXIA UNILATERAL - R$ 400,00'
      },
      {
        procedureCode: '04.09.04.012-6',
        standardValue: 450.00,
        description: 'ORQUIDOPEXIA BILATERAL - R$ 450,00'
      },
      {
        procedureCode: '04.09.01.006-5',
        standardValue: 600.00,
        description: 'CISTOLITOTOMIA E/OU RETIRADA DE CORPO ESTRANHO DA BEXIGA (RETIRADA DE CÁLCULO VESICAL ENDOSCÓPICA OU CONVENCIONAL) - R$ 600,00'
      },
      {
        procedureCode: '04.09.05.007-5',
        standardValue: 500.00,
        description: 'PLÁSTICA TOTAL DO PÊNIS (INCLUI PEYRONIE) - R$ 500,00'
      },
      {
        procedureCode: 'RESSECÇÃO_CISTOS',
        standardValue: 250.00,
        description: 'RESSECÇÃO DE CISTOS/CAUTERIZAÇÕES - R$ 250,00'
      },
      {
        procedureCode: '04.09.04.016-9',
        standardValue: 500.00,
        description: 'ORQUIECTOMIA UNILATERAL - R$ 500,00'
      },
      {
        procedureCode: '04.09.01.032-4',
        standardValue: 700.00,
        description: 'PIELOPLASTIA - R$ 700,00'
      },
      {
        procedureCode: '04.09.01.021-9',
        standardValue: 1200.00,
        description: 'NEFRECTOMIA TOTAL - R$ 1.200,00'
      },
      {
        procedureCode: '04.09.01.020-0',
        standardValue: 1000.00,
        description: 'NEFRECTOMIA PARCIAL - R$ 1.000,00'
      },
      {
        procedureCode: '04.09.01.022-7',
        standardValue: 900.00,
        description: 'NEFROLITOTOMIA (ANATRÓFICA) - R$ 900,00'
      },
      {
        procedureCode: '04.09.01.029-4',
        standardValue: 400.00,
        description: 'NEFROSTOMIA PERCUTÂNEA - R$ 400,00'
      },
      {
        procedureCode: '04.09.02.017-6',
        standardValue: 250.00,
        description: 'URETROTOMIA INTERNA - R$ 250,00'
      }
    ],
    // ================================================================
    // 🔗 REGRAS DE MÚLTIPLOS PROCEDIMENTOS - DR. GUILHERME AUGUSTO STORER
    // Sistema: Valores fixos para combinações específicas
    // Total: 16 combinações cadastradas
    // Mesmas regras do Dr. HELIO SHINDY KISSINA
    // ================================================================
    multipleRules: [
      // Grupo 1: NEFROLITOTOMIA PERCUTÂNEA + Combinações
      {
        codes: ['04.09.01.023-5', '04.09.01.017-0'],
        totalValue: 1100.00,
        description: 'NEFROLITOTOMIA PERCUTÂNEA + INSTALAÇÃO ENDOSCÓPICA DE CATETER DUPLO J - R$ 1.100,00'
      },
      {
        codes: ['04.09.01.023-5', '04.09.01.014-6'],
        totalValue: 1300.00,
        description: 'NEFROLITOTOMIA PERCUTÂNEA + EXTRAÇÃO ENDOSCÓPICA DE CÁLCULO EM PELVE RENAL - R$ 1.300,00'
      },
      {
        codes: ['04.09.01.023-5', '04.09.01.017-0', '04.09.01.014-6'],
        totalValue: 1400.00,
        description: 'NEFROLITOTOMIA PERCUTÂNEA + INSTALAÇÃO ENDOSCÓPICA DE CATETER DUPLO J + EXTRAÇÃO ENDOSCÓPICA DE CÁLCULO EM PELVE RENAL - R$ 1.400,00'
      },
      {
        codes: ['04.09.01.023-5', '04.09.01.014-6', '04.09.01.059-6'],
        totalValue: 1500.00,
        description: 'NEFROLITOTOMIA PERCUTÂNEA + EXTRAÇÃO ENDOSCÓPICA DE CÁLCULO EM PELVE RENAL + URETEROLITOTRIPSIA TRANSURETEROSCÓPICA (FLEXÍVEL OU SEMIRRÍGIDA) - R$ 1.500,00'
      },
      {
        codes: ['04.09.01.023-5', '04.09.01.017-0', '04.09.01.014-6', '04.09.01.059-6'],
        totalValue: 1600.00,
        description: 'NEFROLITOTOMIA PERCUTÂNEA + INSTALAÇÃO ENDOSCÓPICA DE CATETER DUPLO J + EXTRAÇÃO ENDOSCÓPICA DE CÁLCULO EM PELVE RENAL + URETEROLITOTRIPSIA TRANSURETEROSCÓPICA (FLEXÍVEL OU SEMIRRÍGIDA) - R$ 1.600,00'
      },
      
      // Grupo 2: URETEROLITOTRIPSIA + Combinações
      {
        codes: ['04.09.01.059-6', '04.09.01.017-0'],
        totalValue: 1000.00,
        description: 'URETEROLITOTRIPSIA TRANSURETEROSCÓPICA + INSTALAÇÃO ENDOSCÓPICA DE CATETER DUPLO J (SEMIRRÍGIDA) - R$ 1.000,00'
      },
      
      // Grupo 3: LITOTRIPSIA (FLEXÍVEL) + Combinações
      {
        codes: ['04.09.01.018-9', '04.09.01.017-0'],
        totalValue: 1100.00,
        description: 'LITOTRIPSIA (FLEXÍVEL) + INSTALAÇÃO ENDOSCÓPICA DE CATETER DUPLO J - R$ 1.100,00'
      },
      {
        codes: ['04.09.01.018-9', '04.09.01.014-6', '04.09.01.017-0'],
        totalValue: 1200.00,
        description: 'LITOTRIPSIA (FLEXÍVEL) + EXTRAÇÃO ENDOSCÓPICA DE CÁLCULO EM PELVE RENAL + INSTALAÇÃO ENDOSCÓPICA DE CATETER DUPLO J - R$ 1.200,00'
      },
      {
        codes: ['04.09.01.018-9', '04.09.01.059-6', '04.09.01.014-6', '04.09.01.017-0'],
        totalValue: 1300.00,
        description: 'LITOTRIPSIA (FLEXÍVEL) + URETEROLITOTRIPSIA TRANSURETEROSCÓPICA (SEMIRRÍGIDA) + EXTRAÇÃO ENDOSCÓPICA DE CÁLCULO EM PELVE RENAL + INSTALAÇÃO ENDOSCÓPICA DE CATETER DUPLO J - R$ 1.300,00'
      },
      
      // Grupo 4: PRÓSTATA + Combinações
      {
        codes: ['04.09.03.004-0', '04.09.01.038-3'],
        totalValue: 1200.00,
        description: 'RESSECÇÃO ENDOSCÓPICA DE PRÓSTATA + RESSECÇÃO ENDOSCÓPICA DE LESÃO VESICAL - R$ 1.200,00'
      },
      
      // Grupo 5: HIDROCELE + Combinações
      {
        codes: ['04.09.04.021-5', '04.09.04.019-3'],
        totalValue: 400.00,
        description: 'TRATAMENTO CIRÚRGICO DE HIDROCELE + RESSECÇÃO PARCIAL DA BOLSA ESCROTAL - R$ 400,00'
      },
      {
        codes: ['04.09.04.021-5', '04.09.04.019-3', '04.09.04.017-7'],
        totalValue: 500.00,
        description: 'TRATAMENTO CIRÚRGICO DE HIDROCELE + RESSECÇÃO PARCIAL DA BOLSA ESCROTAL + PLÁSTICA DA BOLSA ESCROTAL - R$ 500,00'
      },
      
      // Grupo 6: ORQUIDOPEXIA + PLÁSTICA BOLSA ESCROTAL
      {
        codes: ['04.09.04.013-4', '04.09.04.017-7'],
        totalValue: 550.00,
        description: 'ORQUIDOPEXIA UNILATERAL + PLÁSTICA DA BOLSA ESCROTAL - R$ 550,00'
      },
      {
        codes: ['04.09.04.012-6', '04.09.04.017-7'],
        totalValue: 550.00,
        description: 'ORQUIDOPEXIA BILATERAL + PLÁSTICA DA BOLSA ESCROTAL - R$ 550,00'
      },
      
      // Grupo 7: PIELOPLASTIA + Combinações
      {
        codes: ['04.09.01.032-4', '04.09.01.057-0'],
        totalValue: 1000.00,
        description: 'PIELOPLASTIA + URETEROPLASTIA - R$ 1.000,00'
      },
      {
        codes: ['04.09.01.032-4', '04.09.01.057-0', '04.09.01.017-0'],
        totalValue: 1100.00,
        description: 'PIELOPLASTIA + URETEROPLASTIA + INSTALAÇÃO ENDOSCÓPICA DE CATETER DUPLO J - R$ 1.100,00'
      }
    ]
  },
  
  'ROGERIO YOSHIKAZU NABESHIMA': {
    doctorName: 'ROGERIO YOSHIKAZU NABESHIMA',
    rules: [
      // ================================================================
      // 🩺 PROCEDIMENTOS VASCULARES - CIRURGIA DE VARIZES
      // Especialidade: Cirurgia Vascular
      // Última atualização: Hoje
      // ================================================================
      {
        procedureCode: '04.06.02.057-4',
        standardValue: 900.00,
        description: 'TRATAMENTO CIRÚRGICO DE VARIZES (UNILATERAL) - R$ 900,00'
      },
      {
        procedureCode: '04.06.02.056-6',
        standardValue: 900.00,
        description: 'TRATAMENTO CIRURGICO DE VARIZES (BILATERAL) - R$ 900,00'
      },
      // ================================================================
      // 💉 PROCEDIMENTOS ESCLEROSANTES NÃO ESTÉTICOS
      // ================================================================
      {
        procedureCode: '03.09.07.001-5',
        standardValue: 100.00,
        description: 'TRATAMENTO ESCLEROSANTE NÃO ESTÉTICO DE VARIZES - R$ 100,00'
      },
      {
        procedureCode: '03.09.07.002-3',
        standardValue: 150.00,
        description: 'TRATAMENTO ESCLEROSANTE NÃO ESTÉTICO DE VARIZES - R$ 150,00'
      }
    ]
  },

  'FABIANE GREGORIO BATISTELA': {
    doctorName: 'FABIANE GREGORIO BATISTELA',
    rules: [
      // ================================================================
      // 🏥 PROCEDIMENTO PRINCIPAL - COLECISTECTOMIA BASE
      // ================================================================
      {
        procedureCode: '04.07.03.002-6',
        standardValue: 900.00,
        description: 'COLECISTECTOMIA (PRINCIPAL) - R$ 900,00'
      },
      
      // ================================================================
      // 🔧 PROCEDIMENTOS SEQUENCIAIS - SOMAM À COLECISTECTOMIA
      // Limite: até 4 procedimentos sequenciais
      // ================================================================
      {
        procedureCode: '04.07.04.018-8',
        standardValue: 300.00,
        description: 'LIBERAÇÃO DE ADERÊNCIAS INTESTINAIS - R$ 300,00'
      },
      {
        procedureCode: '04.07.04.002-1',
        standardValue: 300.00,
        description: 'DRENAGEM DE ABSCESSO SUBFRÊNICO - R$ 300,00'
      },
      {
        procedureCode: '04.07.03.014-0',
        standardValue: 300.00,
        description: 'HEPATORRAFIA - R$ 300,00'
      },
      {
        procedureCode: '04.07.03.006-9',
        standardValue: 250.00,
        description: 'COLEDOCOTOMIA - R$ 250,00'
      },
      {
        procedureCode: '04.07.03.005-0',
        standardValue: 200.00,
        description: 'COLEDOCOPLASTIA - R$ 200,00'
      },
      
      // ================================================================
      // 🏥 HÉRNIAS COMO PROCEDIMENTO PRINCIPAL - NOVOS VALORES
      // ================================================================
      {
        procedureCode: '04.07.04.010-2',
        standardValue: 700.00,
        description: 'HERNIOPLASTIA INGUINAL UNILATERAL (PRINCIPAL) - R$ 700,00'
      },
      {
        procedureCode: '04.07.04.009-9',
        standardValue: 700.00,
        description: 'HERNIOPLASTIA INGUINAL BILATERAL (PRINCIPAL) - R$ 700,00'
      },
      {
        procedureCode: '04.07.04.006-4',
        standardValue: 800.00,
        description: 'HERNIOPLASTIA EPIGÁSTRICA (PRINCIPAL) - R$ 800,00'
      },
      {
        procedureCode: '04.07.04.012-9',
        standardValue: 450.00,
        description: 'HERNIOPLASTIA UMBILICAL (PRINCIPAL) - R$ 450,00'
      },
      {
        procedureCode: '04.07.04.008-0',
        standardValue: 600.00,
        description: 'HERNIOPLASTIA INCISIONAL/VENTRAL (PRINCIPAL) - R$ 600,00'
      },
      
      // ================================================================
      // 🆕 PROCEDIMENTOS ORIFICIAIS - FÍSTULAS, FISSURAS E HEMORRÓIDAS
      // Data: 27/10/2025
      // Valor padrão: R$ 450,00 por procedimento
      // ================================================================
      {
        procedureCode: '04.07.02.027-6',
        standardValue: 450.00,
        description: 'FISTULECTOMIA/FISTULOTOMIA ANAL - R$ 450,00'
      },
      {
        procedureCode: '04.07.02.028-4',
        standardValue: 450.00,
        description: 'HEMORROIDECTOMIA - R$ 450,00'
      },
      {
        procedureCode: '04.07.02.031-4',
        standardValue: 450.00,
        description: 'TRATAMENTO CIRÚRGICO DE FISSURA ANAL - R$ 450,00'
      },
      
      // ================================================================
      // 🆕 CISTOS E LIPOMAS
      // Data: 27/10/2025
      // Valor padrão: R$ 250,00 por procedimento
      // ================================================================
      {
        procedureCode: '04.01.02.007-0',
        standardValue: 250.00,
        description: 'EXÉRESE DE CISTO DERMOIDE - R$ 250,00'
      },
      {
        procedureCode: '04.01.02.010-0',
        standardValue: 250.00,
        description: 'EXTIRPAÇÃO E SUPRESSÃO DE LESÃO DE PELE E DE TECIDO SUBCUTÂNEO - R$ 250,00'
      },
      {
        procedureCode: '04.01.02.008-8',
        standardValue: 250.00,
        description: 'EXÉRESE DE LIPOMA - R$ 250,00'
      },
      {
        procedureCode: '04.01.02.009-6',
        standardValue: 250.00,
        description: 'EXÉRESE DE CISTO PILONIDAL - R$ 250,00'
      }
    ],
    
    // ================================================================
    // 🔗 REGRAS MÚLTIPLAS - COLECISTECTOMIA + SEQUENCIAIS
    // Sistema: Colecistectomia R$ 900 + soma dos procedimentos sequenciais
    // ================================================================
    multipleRules: [
      // Colecistectomia + 1 Sequencial
      {
        codes: ['04.07.03.002-6', '04.07.04.018-8'],
        totalValue: 1200.00,
        description: 'COLECISTECTOMIA + LIBERAÇÃO DE ADERÊNCIAS - R$ 1.200,00'
      },
      {
        codes: ['04.07.03.002-6', '04.07.04.002-1'],
        totalValue: 1200.00,
        description: 'COLECISTECTOMIA + DRENAGEM ABSCESSO SUBFRÊNICO - R$ 1.200,00'
      },
      {
        codes: ['04.07.03.002-6', '04.07.03.014-0'],
        totalValue: 1200.00,
        description: 'COLECISTECTOMIA + HEPATORRAFIA - R$ 1.200,00'
      },
      {
        codes: ['04.07.03.002-6', '04.07.03.006-9'],
        totalValue: 1150.00,
        description: 'COLECISTECTOMIA + COLEDOCOTOMIA - R$ 1.150,00'
      },
      {
        codes: ['04.07.03.002-6', '04.07.03.005-0'],
        totalValue: 1100.00,
        description: 'COLECISTECTOMIA + COLEDOCOPLASTIA - R$ 1.100,00'
      },
      
      // Colecistectomia + Hérnias (soma valores originais)
      {
        codes: ['04.07.03.002-6', '04.07.04.010-2'],
        totalValue: 1600.00,
        description: 'COLECISTECTOMIA + HERNIOPLASTIA INGUINAL UNILATERAL - R$ 1.600,00'
      },
      {
        codes: ['04.07.03.002-6', '04.07.04.009-9'],
        totalValue: 1600.00,
        description: 'COLECISTECTOMIA + HERNIOPLASTIA INGUINAL BILATERAL - R$ 1.600,00'
      },
      {
        codes: ['04.07.03.002-6', '04.07.04.006-4'],
        totalValue: 1700.00,
        description: 'COLECISTECTOMIA + HERNIOPLASTIA EPIGÁSTRICA - R$ 1.700,00'
      },
      {
        codes: ['04.07.03.002-6', '04.07.04.012-9'],
        totalValue: 1350.00,
        description: 'COLECISTECTOMIA + HERNIOPLASTIA UMBILICAL - R$ 1.350,00'
      },
      {
        codes: ['04.07.03.002-6', '04.07.04.008-0'],
        totalValue: 1500.00,
        description: 'COLECISTECTOMIA + HERNIOPLASTIA INCISIONAL/VENTRAL - R$ 1.500,00'
      },
      
      // Colecistectomia + 2 Sequenciais (exemplos principais)
      {
        codes: ['04.07.03.002-6', '04.07.04.018-8', '04.07.03.014-0'],
        totalValue: 1500.00,
        description: 'COLECISTECTOMIA + LIBERAÇÃO ADERÊNCIAS + HEPATORRAFIA - R$ 1.500,00'
      },
      {
        codes: ['04.07.03.002-6', '04.07.03.006-9', '04.07.03.005-0'],
        totalValue: 1350.00,
        description: 'COLECISTECTOMIA + COLEDOCOTOMIA + COLEDOCOPLASTIA - R$ 1.350,00'
      },
      
      // Colecistectomia + 3 Sequenciais
      {
        codes: ['04.07.03.002-6', '04.07.04.018-8', '04.07.03.014-0', '04.07.04.002-1'],
        totalValue: 1800.00,
        description: 'COLECISTECTOMIA + LIBERAÇÃO + HEPATORRAFIA + DRENAGEM - R$ 1.800,00'
      },
      
      // Colecistectomia + 4 Sequenciais (máximo)
      {
        codes: ['04.07.03.002-6', '04.07.04.018-8', '04.07.03.014-0', '04.07.04.002-1', '04.07.03.006-9'],
        totalValue: 2050.00,
        description: 'COLECISTECTOMIA + 4 SEQUENCIAIS (MÁXIMO) - R$ 2.050,00'
      },
      
      // ================================================================
      // 🆕 REGRAS DE MÚLTIPLAS HÉRNIAS
      // Nova lógica: 1ª hérnia = valor original, 2ª+ hérnias = R$ 300,00
      // Data: 27/10/2025
      // ================================================================
      
      // Combinações com HERNIOPLASTIA INGUINAL UNILATERAL como 1ª (R$ 700)
      {
        codes: ['04.07.04.010-2', '04.07.04.009-9'],
        totalValue: 1000.00,
        description: 'INGUINAL UNILATERAL (1ª) + INGUINAL BILATERAL (2ª) - R$ 1.000,00'
      },
      {
        codes: ['04.07.04.010-2', '04.07.04.006-4'],
        totalValue: 1000.00,
        description: 'INGUINAL UNILATERAL (1ª) + EPIGÁSTRICA (2ª) - R$ 1.000,00'
      },
      {
        codes: ['04.07.04.010-2', '04.07.04.012-9'],
        totalValue: 1000.00,
        description: 'INGUINAL UNILATERAL (1ª) + UMBILICAL (2ª) - R$ 1.000,00'
      },
      {
        codes: ['04.07.04.010-2', '04.07.04.008-0'],
        totalValue: 1000.00,
        description: 'INGUINAL UNILATERAL (1ª) + INCISIONAL/VENTRAL (2ª) - R$ 1.000,00'
      },
      
      // Combinações com HERNIOPLASTIA INGUINAL BILATERAL como 1ª (R$ 700)
      {
        codes: ['04.07.04.009-9', '04.07.04.010-2'],
        totalValue: 1000.00,
        description: 'INGUINAL BILATERAL (1ª) + INGUINAL UNILATERAL (2ª) - R$ 1.000,00'
      },
      {
        codes: ['04.07.04.009-9', '04.07.04.006-4'],
        totalValue: 1000.00,
        description: 'INGUINAL BILATERAL (1ª) + EPIGÁSTRICA (2ª) - R$ 1.000,00'
      },
      {
        codes: ['04.07.04.009-9', '04.07.04.012-9'],
        totalValue: 1000.00,
        description: 'INGUINAL BILATERAL (1ª) + UMBILICAL (2ª) - R$ 1.000,00'
      },
      {
        codes: ['04.07.04.009-9', '04.07.04.008-0'],
        totalValue: 1000.00,
        description: 'INGUINAL BILATERAL (1ª) + INCISIONAL/VENTRAL (2ª) - R$ 1.000,00'
      },
      
      // Combinações com HERNIOPLASTIA EPIGÁSTRICA como 1ª (R$ 800)
      {
        codes: ['04.07.04.006-4', '04.07.04.010-2'],
        totalValue: 1100.00,
        description: 'EPIGÁSTRICA (1ª) + INGUINAL UNILATERAL (2ª) - R$ 1.100,00'
      },
      {
        codes: ['04.07.04.006-4', '04.07.04.009-9'],
        totalValue: 1100.00,
        description: 'EPIGÁSTRICA (1ª) + INGUINAL BILATERAL (2ª) - R$ 1.100,00'
      },
      {
        codes: ['04.07.04.006-4', '04.07.04.012-9'],
        totalValue: 1100.00,
        description: 'EPIGÁSTRICA (1ª) + UMBILICAL (2ª) - R$ 1.100,00'
      },
      {
        codes: ['04.07.04.006-4', '04.07.04.008-0'],
        totalValue: 1100.00,
        description: 'EPIGÁSTRICA (1ª) + INCISIONAL/VENTRAL (2ª) - R$ 1.100,00'
      },
      
      // Combinações com HERNIOPLASTIA UMBILICAL como 1ª (R$ 450)
      {
        codes: ['04.07.04.012-9', '04.07.04.010-2'],
        totalValue: 750.00,
        description: 'UMBILICAL (1ª) + INGUINAL UNILATERAL (2ª) - R$ 750,00'
      },
      {
        codes: ['04.07.04.012-9', '04.07.04.009-9'],
        totalValue: 750.00,
        description: 'UMBILICAL (1ª) + INGUINAL BILATERAL (2ª) - R$ 750,00'
      },
      {
        codes: ['04.07.04.012-9', '04.07.04.006-4'],
        totalValue: 750.00,
        description: 'UMBILICAL (1ª) + EPIGÁSTRICA (2ª) - R$ 750,00'
      },
      {
        codes: ['04.07.04.012-9', '04.07.04.008-0'],
        totalValue: 750.00,
        description: 'UMBILICAL (1ª) + INCISIONAL/VENTRAL (2ª) - R$ 750,00'
      },
      
      // Combinações com HERNIOPLASTIA INCISIONAL/VENTRAL como 1ª (R$ 600)
      {
        codes: ['04.07.04.008-0', '04.07.04.010-2'],
        totalValue: 900.00,
        description: 'INCISIONAL/VENTRAL (1ª) + INGUINAL UNILATERAL (2ª) - R$ 900,00'
      },
      {
        codes: ['04.07.04.008-0', '04.07.04.009-9'],
        totalValue: 900.00,
        description: 'INCISIONAL/VENTRAL (1ª) + INGUINAL BILATERAL (2ª) - R$ 900,00'
      },
      {
        codes: ['04.07.04.008-0', '04.07.04.006-4'],
        totalValue: 900.00,
        description: 'INCISIONAL/VENTRAL (1ª) + EPIGÁSTRICA (2ª) - R$ 900,00'
      },
      {
        codes: ['04.07.04.008-0', '04.07.04.012-9'],
        totalValue: 900.00,
        description: 'INCISIONAL/VENTRAL (1ª) + UMBILICAL (2ª) - R$ 900,00'
      },
      
      // Combinações de 3 hérnias (exemplos principais)
      {
        codes: ['04.07.04.006-4', '04.07.04.010-2', '04.07.04.012-9'],
        totalValue: 1400.00,
        description: 'EPIGÁSTRICA (1ª) + INGUINAL UNILATERAL (2ª) + UMBILICAL (3ª) - R$ 1.400,00'
      },
      {
        codes: ['04.07.04.006-4', '04.07.04.009-9', '04.07.04.012-9'],
        totalValue: 1400.00,
        description: 'EPIGÁSTRICA (1ª) + INGUINAL BILATERAL (2ª) + UMBILICAL (3ª) - R$ 1.400,00'
      },
      {
        codes: ['04.07.04.010-2', '04.07.04.012-9', '04.07.04.008-0'],
        totalValue: 1300.00,
        description: 'INGUINAL UNILATERAL (1ª) + UMBILICAL (2ª) + INCISIONAL (3ª) - R$ 1.300,00'
      },
      
      // Combinações de 4 hérnias
      {
        codes: ['04.07.04.006-4', '04.07.04.010-2', '04.07.04.012-9', '04.07.04.008-0'],
        totalValue: 1700.00,
        description: 'EPIGÁSTRICA (1ª) + INGUINAL UNI (2ª) + UMBILICAL (3ª) + INCISIONAL (4ª) - R$ 1.700,00'
      }
    ]
  },

  'JOAO VICTOR RODRIGUES': {
    doctorName: 'JOAO VICTOR RODRIGUES',
    rules: [
      // ================================================================
      // 🏥 PROCEDIMENTO PRINCIPAL - COLECISTECTOMIA BASE
      // Mesmas regras da FABIANE GREGORIO BATISTELA
      // Última atualização: 27/10/2025
      // ================================================================
      {
        procedureCode: '04.07.03.002-6',
        standardValue: 900.00,
        description: 'COLECISTECTOMIA (PRINCIPAL) - R$ 900,00'
      },
      
      // ================================================================
      // 🔧 PROCEDIMENTOS SEQUENCIAIS - SOMAM À COLECISTECTOMIA
      // Limite: até 4 procedimentos sequenciais
      // ================================================================
      {
        procedureCode: '04.07.04.018-8',
        standardValue: 300.00,
        description: 'LIBERAÇÃO DE ADERÊNCIAS INTESTINAIS - R$ 300,00'
      },
      {
        procedureCode: '04.07.04.002-1',
        standardValue: 300.00,
        description: 'DRENAGEM DE ABSCESSO SUBFRÊNICO - R$ 300,00'
      },
      {
        procedureCode: '04.07.03.014-0',
        standardValue: 300.00,
        description: 'HEPATORRAFIA - R$ 300,00'
      },
      {
        procedureCode: '04.07.03.006-9',
        standardValue: 250.00,
        description: 'COLEDOCOTOMIA - R$ 250,00'
      },
      {
        procedureCode: '04.07.03.005-0',
        standardValue: 200.00,
        description: 'COLEDOCOPLASTIA - R$ 200,00'
      },
      
      // ================================================================
      // 🏥 HÉRNIAS COMO PROCEDIMENTO PRINCIPAL - NOVOS VALORES
      // ================================================================
      {
        procedureCode: '04.07.04.010-2',
        standardValue: 700.00,
        description: 'HERNIOPLASTIA INGUINAL UNILATERAL (PRINCIPAL) - R$ 700,00'
      },
      {
        procedureCode: '04.07.04.009-9',
        standardValue: 700.00,
        description: 'HERNIOPLASTIA INGUINAL BILATERAL (PRINCIPAL) - R$ 700,00'
      },
      {
        procedureCode: '04.07.04.006-4',
        standardValue: 800.00,
        description: 'HERNIOPLASTIA EPIGÁSTRICA (PRINCIPAL) - R$ 800,00'
      },
      {
        procedureCode: '04.07.04.012-9',
        standardValue: 450.00,
        description: 'HERNIOPLASTIA UMBILICAL (PRINCIPAL) - R$ 450,00'
      },
      {
        procedureCode: '04.07.04.008-0',
        standardValue: 600.00,
        description: 'HERNIOPLASTIA INCISIONAL/VENTRAL (PRINCIPAL) - R$ 600,00'
      },
      
      // ================================================================
      // 🆕 PROCEDIMENTOS ORIFICIAIS - FÍSTULAS, FISSURAS E HEMORRÓIDAS
      // Data: 27/10/2025
      // Valor padrão: R$ 450,00 por procedimento
      // ================================================================
      {
        procedureCode: '04.07.02.027-6',
        standardValue: 450.00,
        description: 'FISTULECTOMIA/FISTULOTOMIA ANAL - R$ 450,00'
      },
      {
        procedureCode: '04.07.02.028-4',
        standardValue: 450.00,
        description: 'HEMORROIDECTOMIA - R$ 450,00'
      },
      {
        procedureCode: '04.07.02.031-4',
        standardValue: 450.00,
        description: 'TRATAMENTO CIRÚRGICO DE FISSURA ANAL - R$ 450,00'
      },
      
      // ================================================================
      // 🆕 CISTOS E LIPOMAS
      // Data: 27/10/2025
      // Valor padrão: R$ 250,00 por procedimento
      // ================================================================
      {
        procedureCode: '04.01.02.007-0',
        standardValue: 250.00,
        description: 'EXÉRESE DE CISTO DERMOIDE - R$ 250,00'
      },
      {
        procedureCode: '04.01.02.010-0',
        standardValue: 250.00,
        description: 'EXTIRPAÇÃO E SUPRESSÃO DE LESÃO DE PELE E DE TECIDO SUBCUTÂNEO - R$ 250,00'
      },
      {
        procedureCode: '04.01.02.008-8',
        standardValue: 250.00,
        description: 'EXÉRESE DE LIPOMA - R$ 250,00'
      },
      {
        procedureCode: '04.01.02.009-6',
        standardValue: 250.00,
        description: 'EXÉRESE DE CISTO PILONIDAL - R$ 250,00'
      }
    ],
    
    // ================================================================
    // 🔗 REGRAS MÚLTIPLAS - COLECISTECTOMIA + SEQUENCIAIS
    // Sistema: Colecistectomia R$ 900 + soma dos procedimentos sequenciais
    // ================================================================
    multipleRules: [
      // Colecistectomia + 1 Sequencial
      {
        codes: ['04.07.03.002-6', '04.07.04.018-8'],
        totalValue: 1200.00,
        description: 'COLECISTECTOMIA + LIBERAÇÃO DE ADERÊNCIAS - R$ 1.200,00'
      },
      {
        codes: ['04.07.03.002-6', '04.07.04.002-1'],
        totalValue: 1200.00,
        description: 'COLECISTECTOMIA + DRENAGEM ABSCESSO SUBFRÊNICO - R$ 1.200,00'
      },
      {
        codes: ['04.07.03.002-6', '04.07.03.014-0'],
        totalValue: 1200.00,
        description: 'COLECISTECTOMIA + HEPATORRAFIA - R$ 1.200,00'
      },
      {
        codes: ['04.07.03.002-6', '04.07.03.006-9'],
        totalValue: 1150.00,
        description: 'COLECISTECTOMIA + COLEDOCOTOMIA - R$ 1.150,00'
      },
      {
        codes: ['04.07.03.002-6', '04.07.03.005-0'],
        totalValue: 1100.00,
        description: 'COLECISTECTOMIA + COLEDOCOPLASTIA - R$ 1.100,00'
      },
      
      // Colecistectomia + Hérnias (soma valores originais)
      {
        codes: ['04.07.03.002-6', '04.07.04.010-2'],
        totalValue: 1600.00,
        description: 'COLECISTECTOMIA + HERNIOPLASTIA INGUINAL UNILATERAL - R$ 1.600,00'
      },
      {
        codes: ['04.07.03.002-6', '04.07.04.009-9'],
        totalValue: 1600.00,
        description: 'COLECISTECTOMIA + HERNIOPLASTIA INGUINAL BILATERAL - R$ 1.600,00'
      },
      {
        codes: ['04.07.03.002-6', '04.07.04.006-4'],
        totalValue: 1700.00,
        description: 'COLECISTECTOMIA + HERNIOPLASTIA EPIGÁSTRICA - R$ 1.700,00'
      },
      {
        codes: ['04.07.03.002-6', '04.07.04.012-9'],
        totalValue: 1350.00,
        description: 'COLECISTECTOMIA + HERNIOPLASTIA UMBILICAL - R$ 1.350,00'
      },
      {
        codes: ['04.07.03.002-6', '04.07.04.008-0'],
        totalValue: 1500.00,
        description: 'COLECISTECTOMIA + HERNIOPLASTIA INCISIONAL/VENTRAL - R$ 1.500,00'
      },
      
      // Colecistectomia + 2 Sequenciais (exemplos principais)
      {
        codes: ['04.07.03.002-6', '04.07.04.018-8', '04.07.03.014-0'],
        totalValue: 1500.00,
        description: 'COLECISTECTOMIA + LIBERAÇÃO ADERÊNCIAS + HEPATORRAFIA - R$ 1.500,00'
      },
      {
        codes: ['04.07.03.002-6', '04.07.03.006-9', '04.07.03.005-0'],
        totalValue: 1350.00,
        description: 'COLECISTECTOMIA + COLEDOCOTOMIA + COLEDOCOPLASTIA - R$ 1.350,00'
      },
      
      // Colecistectomia + 3 Sequenciais
      {
        codes: ['04.07.03.002-6', '04.07.04.018-8', '04.07.03.014-0', '04.07.04.002-1'],
        totalValue: 1800.00,
        description: 'COLECISTECTOMIA + LIBERAÇÃO + HEPATORRAFIA + DRENAGEM - R$ 1.800,00'
      },
      
      // Colecistectomia + 4 Sequenciais (máximo)
      {
        codes: ['04.07.03.002-6', '04.07.04.018-8', '04.07.03.014-0', '04.07.04.002-1', '04.07.03.006-9'],
        totalValue: 2050.00,
        description: 'COLECISTECTOMIA + 4 SEQUENCIAIS (MÁXIMO) - R$ 2.050,00'
      },
      
      // ================================================================
      // 🆕 REGRAS DE MÚLTIPLAS HÉRNIAS
      // Nova lógica: 1ª hérnia = valor original, 2ª+ hérnias = R$ 300,00
      // Data: 27/10/2025
      // ================================================================
      
      // Combinações com HERNIOPLASTIA INGUINAL UNILATERAL como 1ª (R$ 700)
      {
        codes: ['04.07.04.010-2', '04.07.04.009-9'],
        totalValue: 1000.00,
        description: 'INGUINAL UNILATERAL (1ª) + INGUINAL BILATERAL (2ª) - R$ 1.000,00'
      },
      {
        codes: ['04.07.04.010-2', '04.07.04.006-4'],
        totalValue: 1000.00,
        description: 'INGUINAL UNILATERAL (1ª) + EPIGÁSTRICA (2ª) - R$ 1.000,00'
      },
      {
        codes: ['04.07.04.010-2', '04.07.04.012-9'],
        totalValue: 1000.00,
        description: 'INGUINAL UNILATERAL (1ª) + UMBILICAL (2ª) - R$ 1.000,00'
      },
      {
        codes: ['04.07.04.010-2', '04.07.04.008-0'],
        totalValue: 1000.00,
        description: 'INGUINAL UNILATERAL (1ª) + INCISIONAL/VENTRAL (2ª) - R$ 1.000,00'
      },
      
      // Combinações com HERNIOPLASTIA INGUINAL BILATERAL como 1ª (R$ 700)
      {
        codes: ['04.07.04.009-9', '04.07.04.010-2'],
        totalValue: 1000.00,
        description: 'INGUINAL BILATERAL (1ª) + INGUINAL UNILATERAL (2ª) - R$ 1.000,00'
      },
      {
        codes: ['04.07.04.009-9', '04.07.04.006-4'],
        totalValue: 1000.00,
        description: 'INGUINAL BILATERAL (1ª) + EPIGÁSTRICA (2ª) - R$ 1.000,00'
      },
      {
        codes: ['04.07.04.009-9', '04.07.04.012-9'],
        totalValue: 1000.00,
        description: 'INGUINAL BILATERAL (1ª) + UMBILICAL (2ª) - R$ 1.000,00'
      },
      {
        codes: ['04.07.04.009-9', '04.07.04.008-0'],
        totalValue: 1000.00,
        description: 'INGUINAL BILATERAL (1ª) + INCISIONAL/VENTRAL (2ª) - R$ 1.000,00'
      },
      
      // Combinações com HERNIOPLASTIA EPIGÁSTRICA como 1ª (R$ 800)
      {
        codes: ['04.07.04.006-4', '04.07.04.010-2'],
        totalValue: 1100.00,
        description: 'EPIGÁSTRICA (1ª) + INGUINAL UNILATERAL (2ª) - R$ 1.100,00'
      },
      {
        codes: ['04.07.04.006-4', '04.07.04.009-9'],
        totalValue: 1100.00,
        description: 'EPIGÁSTRICA (1ª) + INGUINAL BILATERAL (2ª) - R$ 1.100,00'
      },
      {
        codes: ['04.07.04.006-4', '04.07.04.012-9'],
        totalValue: 1100.00,
        description: 'EPIGÁSTRICA (1ª) + UMBILICAL (2ª) - R$ 1.100,00'
      },
      {
        codes: ['04.07.04.006-4', '04.07.04.008-0'],
        totalValue: 1100.00,
        description: 'EPIGÁSTRICA (1ª) + INCISIONAL/VENTRAL (2ª) - R$ 1.100,00'
      },
      
      // Combinações com HERNIOPLASTIA UMBILICAL como 1ª (R$ 450)
      {
        codes: ['04.07.04.012-9', '04.07.04.010-2'],
        totalValue: 750.00,
        description: 'UMBILICAL (1ª) + INGUINAL UNILATERAL (2ª) - R$ 750,00'
      },
      {
        codes: ['04.07.04.012-9', '04.07.04.009-9'],
        totalValue: 750.00,
        description: 'UMBILICAL (1ª) + INGUINAL BILATERAL (2ª) - R$ 750,00'
      },
      {
        codes: ['04.07.04.012-9', '04.07.04.006-4'],
        totalValue: 750.00,
        description: 'UMBILICAL (1ª) + EPIGÁSTRICA (2ª) - R$ 750,00'
      },
      {
        codes: ['04.07.04.012-9', '04.07.04.008-0'],
        totalValue: 750.00,
        description: 'UMBILICAL (1ª) + INCISIONAL/VENTRAL (2ª) - R$ 750,00'
      },
      
      // Combinações com HERNIOPLASTIA INCISIONAL/VENTRAL como 1ª (R$ 600)
      {
        codes: ['04.07.04.008-0', '04.07.04.010-2'],
        totalValue: 900.00,
        description: 'INCISIONAL/VENTRAL (1ª) + INGUINAL UNILATERAL (2ª) - R$ 900,00'
      },
      {
        codes: ['04.07.04.008-0', '04.07.04.009-9'],
        totalValue: 900.00,
        description: 'INCISIONAL/VENTRAL (1ª) + INGUINAL BILATERAL (2ª) - R$ 900,00'
      },
      {
        codes: ['04.07.04.008-0', '04.07.04.006-4'],
        totalValue: 900.00,
        description: 'INCISIONAL/VENTRAL (1ª) + EPIGÁSTRICA (2ª) - R$ 900,00'
      },
      {
        codes: ['04.07.04.008-0', '04.07.04.012-9'],
        totalValue: 900.00,
        description: 'INCISIONAL/VENTRAL (1ª) + UMBILICAL (2ª) - R$ 900,00'
      },
      
      // Combinações de 3 hérnias (exemplos principais)
      {
        codes: ['04.07.04.006-4', '04.07.04.010-2', '04.07.04.012-9'],
        totalValue: 1400.00,
        description: 'EPIGÁSTRICA (1ª) + INGUINAL UNILATERAL (2ª) + UMBILICAL (3ª) - R$ 1.400,00'
      },
      {
        codes: ['04.07.04.006-4', '04.07.04.009-9', '04.07.04.012-9'],
        totalValue: 1400.00,
        description: 'EPIGÁSTRICA (1ª) + INGUINAL BILATERAL (2ª) + UMBILICAL (3ª) - R$ 1.400,00'
      },
      {
        codes: ['04.07.04.010-2', '04.07.04.012-9', '04.07.04.008-0'],
        totalValue: 1300.00,
        description: 'INGUINAL UNILATERAL (1ª) + UMBILICAL (2ª) + INCISIONAL (3ª) - R$ 1.300,00'
      },
      
      // Combinações de 4 hérnias
      {
        codes: ['04.07.04.006-4', '04.07.04.010-2', '04.07.04.012-9', '04.07.04.008-0'],
        totalValue: 1700.00,
        description: 'EPIGÁSTRICA (1ª) + INGUINAL UNI (2ª) + UMBILICAL (3ª) + INCISIONAL (4ª) - R$ 1.700,00'
      }
    ]
  },

  'MAIRA RECHI CASSAPULA': {
    doctorName: 'MAIRA RECHI CASSAPULA',
    rules: [
      // ================================================================
      // 🏥 PROCEDIMENTOS PRINCIPAIS - GINECOLOGIA E OBSTETRÍCIA
      // Última atualização: 27/10/2025
      // ================================================================
      {
        procedureCode: '04.09.06.013-5',
        standardValue: 1000.00,
        description: 'HISTERECTOMIA TOTAL - R$ 1.000,00'
      },
      {
        procedureCode: '04.09.06.012-7',
        standardValue: 750.00,
        description: 'HISTERECTOMIA SUBTOTAL - R$ 750,00'
      },
      {
        procedureCode: '04.09.06.011-9',
        standardValue: 1200.00,
        description: 'HISTERECTOMIA C/ ANEXECTOMIA (UNI / BILATERAL) - R$ 1.200,00'
      },
      {
        procedureCode: '04.09.06.021-6',
        standardValue: 700.00,
        description: 'OOFORECTOMIA / OOFOROPLASTIA - R$ 700,00'
      },
      {
        procedureCode: '04.09.06.018-6',
        standardValue: 600.00,
        description: 'LAQUEADURA TUBARIA - R$ 600,00'
      },
      {
        procedureCode: '04.09.07.027-0',
        standardValue: 450.00,
        description: 'TRATAMENTO CIRURGICO DE INCONTINÊNCIA URINÁRIA POR VIA VAGINAL - R$ 450,00'
      },
      {
        procedureCode: '04.09.07.006-8',
        standardValue: 450.00,
        description: 'COLPOPERINEOPLASTIA POSTERIOR - R$ 450,00'
      },
      {
        procedureCode: '04.09.07.005-0',
        standardValue: 600.00,
        description: 'COLPOPERINEOPLASTIA ANTERIOR E POSTERIOR - R$ 600,00'
      },
      {
        procedureCode: '04.09.06.004-6',
        standardValue: 250.00,
        description: 'CURETAGEM SEMIOTICA C/ OU S/ DILATACAO DO COLO DO UTERO - R$ 250,00'
      },
      {
        procedureCode: '04.09.07.026-2',
        standardValue: 250.00,
        description: 'TRATAMENTO CIRURGICO DE HIPERTROFIA DOS PEQUENOS LABIOS (NINFOPLASTIA) - R$ 250,00'
      },
      {
        procedureCode: '04.08.06.031-0',
        standardValue: 250.00,
        description: 'RESSECÇÃO SIMPLES DE TUMOR ÓSSEO / DE PARTES MOLES - R$ 250,00'
      },
      {
        procedureCode: '04.09.07.015-7',
        standardValue: 250.00,
        description: 'EXERESE DE GLÂNDULA DE BARTHOLIN / SKENE - R$ 250,00'
      },
      {
        procedureCode: '04.09.07.019-0',
        standardValue: 150.00,
        description: 'MARSUPIALIZAÇÃO DE GLÂNDULA DE BARTOLIN - R$ 150,00'
      },
      {
        procedureCode: '04.09.07.003-3',
        standardValue: 300.00,
        description: 'COLPOCLEISE (CIRURGIA DE LE FORT) - R$ 300,00'
      },
      {
        procedureCode: '04.09.06.019-4',
        standardValue: 550.00,
        description: 'MIOMECTOMIA - R$ 550,00'
      },
      {
        procedureCode: '04.09.07.014-9',
        standardValue: 300.00,
        description: 'EXERESE DE CISTO VAGINAL - R$ 300,00'
      },
      
      // ================================================================
      // 🔧 PROCEDIMENTOS ADICIONAIS - SOMAM AO PROCEDIMENTO PRINCIPAL
      // Última atualização: 27/10/2025
      // ================================================================
      {
        procedureCode: '04.09.06.022-4',
        standardValue: 100.00,
        description: 'RESSECCAO DE VARIZES PELVICAS (ADICIONAL AO PROCEDIMENTO PRINCIPAL) - R$ 100,00'
      },
      {
        procedureCode: '04.07.04.018-8',
        standardValue: 300.00,
        description: 'LIBERAÇÃO DE ADERÊNCIAS INTESTINAIS (ADICIONAL AO PROCEDIMENTO PRINCIPAL) - R$ 300,00'
      },
      {
        procedureCode: '04.09.07.009-2',
        standardValue: 100.00,
        description: 'COLPORRAFIA NAO OBSTETRICA (ADICIONAL AO PROCEDIMENTO PRINCIPAL) - R$ 100,00'
      },
      {
        procedureCode: '04.08.06.020-4',
        standardValue: 100.00,
        description: 'REINSERÇÃO MUSCULAR (CORREÇÃO DE DIÁSTESE DE RETO ABDOMINAL - ADICIONAL DO PROCEDIMENTO PRINCIPAL) - R$ 100,00'
      }
    ],
    // Regras para múltiplos procedimentos específicos
    multipleRules: [
      {
        codes: ['04.09.06.021-6', '04.09.06.023-2'],
        totalValue: 900.00,
        description: 'OOFORECTOMIA/OOFOROPLASTIA + SALPINGECTOMIA - R$ 900,00'
      },
      {
        codes: ['04.09.07.006-8', '04.09.07.027-0'],
        totalValue: 800.00,
        description: 'COLPOPERINEOPLASTIA POSTERIOR + TRATAMENTO INCONTINÊNCIA URINÁRIA - R$ 800,00'
      },
      {
        codes: ['04.09.07.005-0', '04.09.07.027-0'],
        totalValue: 900.00,
        description: 'COLPOPERINEOPLASTIA ANTERIOR E POSTERIOR + TRATAMENTO INCONTINÊNCIA URINÁRIA - R$ 900,00'
      }
    ]
  },

  'DJAVANI BLUM': {
    doctorName: 'DJAVANI BLUM',
    rules: [
      // ================================================================
      // 🏥 PROCEDIMENTOS PRINCIPAIS - GINECOLOGIA E OBSTETRÍCIA
      // Última atualização: 27/10/2025
      // Mesmas regras da MAIRA RECHI CASSAPULA
      // ================================================================
      {
        procedureCode: '04.09.06.013-5',
        standardValue: 1000.00,
        description: 'HISTERECTOMIA TOTAL - R$ 1.000,00'
      },
      {
        procedureCode: '04.09.06.012-7',
        standardValue: 750.00,
        description: 'HISTERECTOMIA SUBTOTAL - R$ 750,00'
      },
      {
        procedureCode: '04.09.06.011-9',
        standardValue: 1200.00,
        description: 'HISTERECTOMIA C/ ANEXECTOMIA (UNI / BILATERAL) - R$ 1.200,00'
      },
      {
        procedureCode: '04.09.06.021-6',
        standardValue: 700.00,
        description: 'OOFORECTOMIA / OOFOROPLASTIA - R$ 700,00'
      },
      {
        procedureCode: '04.09.06.018-6',
        standardValue: 600.00,
        description: 'LAQUEADURA TUBARIA - R$ 600,00'
      },
      {
        procedureCode: '04.09.07.027-0',
        standardValue: 450.00,
        description: 'TRATAMENTO CIRURGICO DE INCONTINÊNCIA URINÁRIA POR VIA VAGINAL - R$ 450,00'
      },
      {
        procedureCode: '04.09.07.006-8',
        standardValue: 450.00,
        description: 'COLPOPERINEOPLASTIA POSTERIOR - R$ 450,00'
      },
      {
        procedureCode: '04.09.07.005-0',
        standardValue: 600.00,
        description: 'COLPOPERINEOPLASTIA ANTERIOR E POSTERIOR - R$ 600,00'
      },
      {
        procedureCode: '04.09.06.004-6',
        standardValue: 250.00,
        description: 'CURETAGEM SEMIOTICA C/ OU S/ DILATACAO DO COLO DO UTERO - R$ 250,00'
      },
      {
        procedureCode: '04.09.07.026-2',
        standardValue: 250.00,
        description: 'TRATAMENTO CIRURGICO DE HIPERTROFIA DOS PEQUENOS LABIOS (NINFOPLASTIA) - R$ 250,00'
      },
      {
        procedureCode: '04.08.06.031-0',
        standardValue: 250.00,
        description: 'RESSECÇÃO SIMPLES DE TUMOR ÓSSEO / DE PARTES MOLES - R$ 250,00'
      },
      {
        procedureCode: '04.09.07.015-7',
        standardValue: 250.00,
        description: 'EXERESE DE GLÂNDULA DE BARTHOLIN / SKENE - R$ 250,00'
      },
      {
        procedureCode: '04.09.07.019-0',
        standardValue: 150.00,
        description: 'MARSUPIALIZAÇÃO DE GLÂNDULA DE BARTOLIN - R$ 150,00'
      },
      {
        procedureCode: '04.09.07.003-3',
        standardValue: 300.00,
        description: 'COLPOCLEISE (CIRURGIA DE LE FORT) - R$ 300,00'
      },
      {
        procedureCode: '04.09.06.019-4',
        standardValue: 550.00,
        description: 'MIOMECTOMIA - R$ 550,00'
      },
      {
        procedureCode: '04.09.07.014-9',
        standardValue: 300.00,
        description: 'EXERESE DE CISTO VAGINAL - R$ 300,00'
      },
      
      // ================================================================
      // 🔧 PROCEDIMENTOS ADICIONAIS - SOMAM AO PROCEDIMENTO PRINCIPAL
      // Última atualização: 27/10/2025
      // ================================================================
      {
        procedureCode: '04.09.06.022-4',
        standardValue: 100.00,
        description: 'RESSECCAO DE VARIZES PELVICAS (ADICIONAL AO PROCEDIMENTO PRINCIPAL) - R$ 100,00'
      },
      {
        procedureCode: '04.07.04.018-8',
        standardValue: 300.00,
        description: 'LIBERAÇÃO DE ADERÊNCIAS INTESTINAIS (ADICIONAL AO PROCEDIMENTO PRINCIPAL) - R$ 300,00'
      },
      {
        procedureCode: '04.09.07.009-2',
        standardValue: 100.00,
        description: 'COLPORRAFIA NAO OBSTETRICA (ADICIONAL AO PROCEDIMENTO PRINCIPAL) - R$ 100,00'
      },
      {
        procedureCode: '04.08.06.020-4',
        standardValue: 100.00,
        description: 'REINSERÇÃO MUSCULAR (CORREÇÃO DE DIÁSTESE DE RETO ABDOMINAL - ADICIONAL DO PROCEDIMENTO PRINCIPAL) - R$ 100,00'
      }
    ],
    // Regras para múltiplos procedimentos específicos
    multipleRules: [
      {
        codes: ['04.09.06.021-6', '04.09.06.023-2'],
        totalValue: 900.00,
        description: 'OOFORECTOMIA/OOFOROPLASTIA + SALPINGECTOMIA - R$ 900,00'
      },
      {
        codes: ['04.09.07.006-8', '04.09.07.027-0'],
        totalValue: 800.00,
        description: 'COLPOPERINEOPLASTIA POSTERIOR + TRATAMENTO INCONTINÊNCIA URINÁRIA - R$ 800,00'
      },
      {
        codes: ['04.09.07.005-0', '04.09.07.027-0'],
        totalValue: 900.00,
        description: 'COLPOPERINEOPLASTIA ANTERIOR E POSTERIOR + TRATAMENTO INCONTINÊNCIA URINÁRIA - R$ 900,00'
      }
    ]
  },

  'JOAO ROBERTO SEIDEL DE ARAUJO': {
    doctorName: 'JOAO ROBERTO SEIDEL DE ARAUJO',
    // 🆕 REGRA DE VALOR FIXO PARA PROCEDIMENTOS NÃO LISTADOS
    // Qualquer procedimento que NÃO esteja nos 3 códigos abaixo = R$ 450,00
    fixedPaymentRule: {
      amount: 450.00,
      description: 'Valor padrão para procedimentos não listados: R$ 450,00'
    },
    rules: [
      // ================================================================
      // 🦶 PROCEDIMENTOS ORTOPÉDICOS ESPECÍFICOS - HALUX VALGUS/RIGIDUS
      // Especialidade: Ortopedia (Pé e Tornozelo)
      // Última atualização: Hoje
      // ================================================================
      {
        procedureCode: '04.08.05.065-9',
        standardValue: 400.00,
        description: 'TRATAMENTO CIRÚRGICO DE HALUX VALGUS COM OSTEOTOMIA - R$ 400,00'
      },
      {
        procedureCode: '04.08.05.091-8',
        standardValue: 400.00,
        description: 'TRATAMENTO CIRÚRGICO DO HALUX VALGUS S/ OSTEOTOMIA - R$ 400,00'
      },
      {
        procedureCode: '04.08.05.090-0',
        standardValue: 400.00,
        description: 'TRATAMENTO CIRÚRGICO DO HALUX RIGIDUS - R$ 400,00'
      }
    ]
  },

  'RENAN RODRIGUES DE LIMA GONCALVES': {
    doctorName: 'RENAN RODRIGUES DE LIMA GONCALVES',
    // ================================================================
    // ✋ REGRA ESPECIAL: APENAS PROCEDIMENTO PRINCIPAL
    // Quando realizar múltiplos procedimentos na mesma cirurgia,
    // paga-se APENAS o valor do procedimento PRINCIPAL (maior valor).
    // NÃO soma os valores dos demais procedimentos.
    // Última atualização: 06/11/2025
    // ================================================================
    onlyMainProcedureRule: {
      enabled: true,
      description: 'Múltiplos procedimentos: paga apenas o procedimento principal (maior valor)',
      logic: 'Quando 2+ procedimentos forem realizados juntos, aplica-se apenas o valor do procedimento de maior valor, ignorando os demais.'
    },
    rules: [
      // ================================================================
      // ✋ PROCEDIMENTOS DE CIRURGIA DA MÃO E PUNHO
      // Especialidade: Ortopedia (Mão e Punho)
      // ================================================================
      {
        procedureCode: '04.03.02.012-3',
        standardValue: 400.00,
        description: 'TRATAMENTO CIRURGICO DE SINDROME COMPRESSIVA EM TUNEL OSTEO-FIBROSO AO NIVEL DO CARPO - R$ 400,00'
      },
      {
        procedureCode: '04.08.06.044-1',
        standardValue: 400.00,
        description: 'TENÓLISE - R$ 400,00'
      },
      {
        procedureCode: '04.08.02.032-6',
        standardValue: 450.00,
        description: 'TRATAMENTO CIRÚRGICO DE DEDO EM GATILHO - R$ 450,00'
      },
      {
        procedureCode: '04.08.06.047-6',
        standardValue: 400.00,
        description: 'TENOPLASTIA OU ENXERTO DE TENDÃO UNICO - R$ 400,00'
      }
    ]
  },

    'RENE SERPA ROUEDE': {
      doctorName: 'RENE SERPA ROUEDE',
      // 🦴 ORTOPEDIA - Procedimentos Artroscópicos
      // Última atualização: 06/11/2025
      rules: [
        {
          procedureCode: '04.08.01.021-5',
          standardValue: 0, // Valor definido na regra de múltiplos
          description: 'TRATAMENTO CIRÚRGICO DE LUXAÇÃO RECIDIVANTE / HABITUAL DE ARTICULAÇÃO ESCAPULO-UMERAL'
        },
        {
          procedureCode: '04.08.01.014-2',
          standardValue: 0, // Valor definido na regra de múltiplos
          description: 'REPARO DE ROTURA DO MANGUITO ROTADOR (INCLUI PROCEDIMENTOS DESCOMPRESSIVOS)'
        },
        {
          procedureCode: '04.08.06.071-9',
          standardValue: 0, // Valor definido na regra de múltiplos
          description: 'VIDEOARTROSCOPIA'
        }
      ],
      // ================================================================
      // 🔧 REGRAS DE MÚLTIPLOS PROCEDIMENTOS ARTROSCÓPICOS
      // ================================================================
      multipleRules: [
        {
          codes: ['04.08.01.021-5', '04.08.06.071-9'],
          totalValue: 500.00,
          description: 'TRATAMENTO CIRÚRGICO DE LUXAÇÃO RECIDIVANTE + VIDEOARTROSCOPIA - R$ 500,00'
        },
        {
          codes: ['04.08.01.014-2', '04.08.06.071-9'],
          totalValue: 900.00,
          description: 'REPARO DE ROTURA DO MANGUITO ROTADOR + VIDEOARTROSCOPIA - R$ 900,00'
        }
      ]
    },

    'GEOVANA GONZALES STORTI': {
      doctorName: 'GEOVANA GONZALES STORTI',
      // 🔬 REGRAS VASCULARES - Procedimento específico
      rules: [
        {
          procedureCode: '04.06.02.057-4',
          standardValue: 900.00,
          description: 'TRATAMENTO CIRÚRGICO DE VARIZES (UNILATERAL) - R$ 900,00'
        }
      ]
    },

    'JOAO GABRIEL NOGUEIRA SCORPIONE': {
      doctorName: 'JOAO GABRIEL NOGUEIRA SCORPIONE',
      // ================================================================
      // 🔬 PROCEDIMENTOS INDIVIDUAIS - UROLOGIA
      // Baseado em: Dr. GUILHERME AUGUSTO STORER
      // Última atualização: 19/11/2025
      // Total: 22 procedimentos
      // ================================================================
      rules: [
        { procedureCode: '04.09.01.023-5', standardValue: 1000.00, description: 'NEFROLITOTOMIA PERCUTÂNEA - R$ 1.000,00' },
        { procedureCode: '04.09.01.059-6', standardValue: 900.00, description: 'URETEROLITOTRIPSIA TRANSURETEROSCÓPICA (SEMIRRÍGIDA) - R$ 900,00' },
        { procedureCode: '04.09.01.018-9', standardValue: 1000.00, description: 'LITOTRIPSIA (FLEXÍVEL) - R$ 1.000,00' },
        { procedureCode: '04.09.01.017-0', standardValue: 250.00, description: 'INSTALAÇÃO ENDOSCÓPICA DE CATETER DUPLO J - R$ 250,00' },
        { procedureCode: '04.09.03.004-0', standardValue: 1000.00, description: 'RESSECÇÃO ENDOSCÓPICA DE PRÓSTATA - R$ 1.000,00' },
        { procedureCode: '04.09.03.002-3', standardValue: 1000.00, description: 'PROSTATECTOMIA SUPRAPÚBICA - R$ 1.000,00' },
        { procedureCode: '04.09.04.021-5', standardValue: 300.00, description: 'TRATAMENTO CIRÚRGICO DE HIDROCELE - R$ 300,00' },
        { procedureCode: '04.09.05.008-3', standardValue: 250.00, description: 'POSTECTOMIA - R$ 250,00' },
        { procedureCode: '04.09.04.024-0', standardValue: 450.00, description: 'VASECTOMIA - R$ 450,00' },
        { procedureCode: '04.09.04.023-1', standardValue: 250.00, description: 'TRATAMENTO CIRÚRGICO DE VARICOCELE - R$ 250,00' },
        { procedureCode: '04.09.04.013-4', standardValue: 400.00, description: 'ORQUIDOPEXIA UNILATERAL - R$ 400,00' },
        { procedureCode: '04.09.04.012-6', standardValue: 450.00, description: 'ORQUIDOPEXIA BILATERAL - R$ 450,00' },
        { procedureCode: '04.09.01.006-5', standardValue: 600.00, description: 'CISTOLITOTOMIA E/OU RETIRADA DE CORPO ESTRANHO DA BEXIGA - R$ 600,00' },
        { procedureCode: '04.09.05.007-5', standardValue: 500.00, description: 'PLÁSTICA TOTAL DO PÊNIS (INCLUI PEYRONIE) - R$ 500,00' },
        { procedureCode: 'RESSECÇÃO_CISTOS', standardValue: 250.00, description: 'RESSECÇÃO DE CISTOS/CAUTERIZAÇÕES - R$ 250,00' },
        { procedureCode: '04.09.04.016-9', standardValue: 500.00, description: 'ORQUIECTOMIA UNILATERAL - R$ 500,00' },
        { procedureCode: '04.09.01.032-4', standardValue: 700.00, description: 'PIELOPLASTIA - R$ 700,00' },
        { procedureCode: '04.09.01.021-9', standardValue: 1200.00, description: 'NEFRECTOMIA TOTAL - R$ 1.200,00' },
        { procedureCode: '04.09.01.020-0', standardValue: 1000.00, description: 'NEFRECTOMIA PARCIAL - R$ 1.000,00' },
        { procedureCode: '04.09.01.022-7', standardValue: 900.00, description: 'NEFROLITOTOMIA (ANATRÓFICA) - R$ 900,00' },
        { procedureCode: '04.09.01.029-4', standardValue: 400.00, description: 'NEFROSTOMIA PERCUTÂNEA - R$ 400,00' },
        { procedureCode: '04.09.02.017-6', standardValue: 250.00, description: 'URETROTOMIA INTERNA - R$ 250,00' }
      ],
      // ================================================================
      // 🔗 REGRAS DE MÚLTIPLOS PROCEDIMENTOS
      // Total: 16 combinações cadastradas
      // ================================================================
      multipleRules: [
        { codes: ['04.09.01.023-5', '04.09.01.017-0'], totalValue: 1100.00, description: 'NEFROLITOTOMIA PERCUTÂNEA + INSTALAÇÃO ENDOSCÓPICA DE CATETER DUPLO J - R$ 1.100,00' },
        { codes: ['04.09.01.023-5', '04.09.01.014-6'], totalValue: 1300.00, description: 'NEFROLITOTOMIA PERCUTÂNEA + EXTRAÇÃO ENDOSCÓPICA DE CÁLCULO EM PELVE RENAL - R$ 1.300,00' },
        { codes: ['04.09.01.023-5', '04.09.01.017-0', '04.09.01.014-6'], totalValue: 1400.00, description: 'NEFROLITOTOMIA PERCUTÂNEA + INSTALAÇÃO ENDOSCÓPICA DE CATETER DUPLO J + EXTRAÇÃO ENDOSCÓPICA DE CÁLCULO EM PELVE RENAL - R$ 1.400,00' },
        { codes: ['04.09.01.023-5', '04.09.01.014-6', '04.09.01.059-6'], totalValue: 1500.00, description: 'NEFROLITOTOMIA PERCUTÂNEA + EXTRAÇÃO ENDOSCÓPICA DE CÁLCULO EM PELVE RENAL + URETEROLITOTRIPSIA TRANSURETEROSCÓPICA (FLEXÍVEL OU SEMIRRÍGIDA) - R$ 1.500,00' },
        { codes: ['04.09.01.023-5', '04.09.01.017-0', '04.09.01.014-6', '04.09.01.059-6'], totalValue: 1600.00, description: 'NEFROLITOTOMIA PERCUTÂNEA + INSTALAÇÃO ENDOSCÓPICA DE CATETER DUPLO J + EXTRAÇÃO ENDOSCÓPICA DE CÁLCULO EM PELVE RENAL + URETEROLITOTRIPSIA TRANSURETEROSCÓPICA (FLEXÍVEL OU SEMIRRÍGIDA) - R$ 1.600,00' },
        { codes: ['04.09.01.059-6', '04.09.01.017-0'], totalValue: 1000.00, description: 'URETEROLITOTRIPSIA TRANSURETEROSCÓPICA + INSTALAÇÃO ENDOSCÓPICA DE CATETER DUPLO J (SEMIRRÍGIDA) - R$ 1.000,00' },
        { codes: ['04.09.01.018-9', '04.09.01.017-0'], totalValue: 1100.00, description: 'LITOTRIPSIA (FLEXÍVEL) + INSTALAÇÃO ENDOSCÓPICA DE CATETER DUPLO J - R$ 1.100,00' },
        { codes: ['04.09.01.018-9', '04.09.01.014-6', '04.09.01.017-0'], totalValue: 1200.00, description: 'LITOTRIPSIA (FLEXÍVEL) + EXTRAÇÃO ENDOSCÓPICA DE CÁLCULO EM PELVE RENAL + INSTALAÇÃO ENDOSCÓPICA DE CATETER DUPLO J - R$ 1.200,00' },
        { codes: ['04.09.01.018-9', '04.09.01.059-6', '04.09.01.014-6', '04.09.01.017-0'], totalValue: 1300.00, description: 'LITOTRIPSIA (FLEXÍVEL) + URETEROLITOTRIPSIA TRANSURETEROSCÓPICA (SEMIRRÍGIDA) + EXTRAÇÃO ENDOSCÓPICA DE CÁLCULO EM PELVE RENAL + INSTALAÇÃO ENDOSCÓPICA DE CATETER DUPLO J - R$ 1.300,00' },
        { codes: ['04.09.03.004-0', '04.09.01.038-3'], totalValue: 1200.00, description: 'RESSECÇÃO ENDOSCÓPICA DE PRÓSTATA + RESSECÇÃO ENDOSCÓPICA DE LESÃO VESICAL - R$ 1.200,00' },
        { codes: ['04.09.04.021-5', '04.09.04.019-3'], totalValue: 400.00, description: 'TRATAMENTO CIRÚRGICO DE HIDROCELE + RESSECÇÃO PARCIAL DA BOLSA ESCROTAL - R$ 400,00' },
        { codes: ['04.09.04.021-5', '04.09.04.019-3', '04.09.04.017-7'], totalValue: 500.00, description: 'TRATAMENTO CIRÚRGICO DE HIDROCELE + RESSECÇÃO PARCIAL DA BOLSA ESCROTAL + PLÁSTICA DA BOLSA ESCROTAL - R$ 500,00' },
        { codes: ['04.09.04.013-4', '04.09.04.017-7'], totalValue: 550.00, description: 'ORQUIDOPEXIA UNILATERAL + PLÁSTICA DA BOLSA ESCROTAL - R$ 550,00' },
        { codes: ['04.09.04.012-6', '04.09.04.017-7'], totalValue: 550.00, description: 'ORQUIDOPEXIA BILATERAL + PLÁSTICA DA BOLSA ESCROTAL - R$ 550,00' },
        { codes: ['04.09.01.032-4', '04.09.01.057-0'], totalValue: 1000.00, description: 'PIELOPLASTIA + URETEROPLASTIA - R$ 1.000,00' },
        { codes: ['04.09.01.032-4', '04.09.01.057-0', '04.09.01.017-0'], totalValue: 1100.00, description: 'PIELOPLASTIA + URETEROPLASTIA + INSTALAÇÃO ENDOSCÓPICA DE CATETER DUPLO J - R$ 1.100,00' }
      ]
    },

    'FELIPE BECKER MANTOVANI': {
      doctorName: 'FELIPE BECKER MANTOVANI',
      // ================================================================
      // 🦴 PROCEDIMENTO ORTOPÉDICO - ARTROPLASTIA DE QUADRIL
      // Especialidade: Ortopedia
      // Data: 19/11/2025
      // ================================================================
      rules: [
        {
          procedureCode: '04.08.04.009-2',
          standardValue: 2500.00,
          description: 'ARTROPLASTIA TOTAL PRIMARIA DO QUADRIL NÃO CIMENTADA / HÍBRIDA - R$ 2.500,00'
        }
      ]
    },

    'LAERCIO MARCOS SIOLARI TURCATO': {
      doctorName: 'LAERCIO MARCOS SIOLARI TURCATO',
      // ================================================================
      // 🦴 PROCEDIMENTO ORTOPÉDICO - ARTROPLASTIA DE QUADRIL
      // Especialidade: Ortopedia
      // Data: 19/11/2025
      // ================================================================
      rules: [
        {
          procedureCode: '04.08.04.009-2',
          standardValue: 2500.00,
          description: 'ARTROPLASTIA TOTAL PRIMARIA DO QUADRIL NÃO CIMENTADA / HÍBRIDA - R$ 2.500,00'
        }
      ]
    },

    'MATEUS HRESCAK': {
      doctorName: 'MATEUS HRESCAK',
      // ================================================================
      // 🦴 PROCEDIMENTOS ORTOPÉDICOS - CIRURGIA DE JOELHO
      // Especialidade: Ortopedia
      // Data: 19/11/2025
      // Total: 5 procedimentos
      // ================================================================
      rules: [
        {
          procedureCode: '04.08.05.089-6',
          standardValue: 750.00,
          description: 'TRATAMENTO CIRÚRGICO DE ROTURA DO MENISCO COM MENISCECTOMIA PARCIAL / TOTAL - R$ 750,00'
        },
        {
          procedureCode: '04.08.05.088-8',
          standardValue: 750.00,
          description: 'TRATAMENTO CIRÚRGICO DE ROTURA DE MENISCO COM SUTURA MENISCAL UNI / BICOMPATIMENTAL - R$ 750,00'
        },
        {
          procedureCode: '04.08.05.016-0',
          standardValue: 900.00,
          description: 'RECONSTRUÇÃO LIGAMENTAR INTRA-ARTICULAR DO JOELHO (CRUZADO ANTERIOR) - R$ 900,00'
        },
        {
          procedureCode: '04.08.05.015-2',
          standardValue: 500.00,
          description: 'RECONSTRUÇÃO LIGAMENTAR EXTRA-ARTICULAR DO JOELHO - R$ 500,00'
        },
        {
          procedureCode: '04.08.05.006-3',
          standardValue: 2000.00,
          description: 'ARTROPLASTIA TOTAL PRIMÁRIA DO JOELHO - R$ 2.000,00'
        }
      ]
    },

    'BRUNO BOSIO DA SILVA': {
      doctorName: 'BRUNO BOSIO DA SILVA',
      // ================================================================
      // 🦴 PROCEDIMENTO ORTOPÉDICO - MANGUITO ROTADOR + VIDEOARTROSCOPIA
      // Especialidade: Ortopedia
      // Data: 19/11/2025
      // ================================================================
      rules: [
        {
          procedureCode: '04.08.01.014-2',
          standardValue: 0, // Valor definido na regra múltipla
          description: 'REPARO DE ROTURA DO MANGUITO ROTADOR (INCLUI PROCEDIMENTOS DESCOMPRESSIVOS)'
        },
        {
          procedureCode: '04.08.06.071-9',
          standardValue: 0, // Valor definido na regra múltipla
          description: 'VIDEOARTROSCOPIA'
        }
      ],
      // 🔗 REGRA MÚLTIPLA: Combinação específica
      multipleRule: {
        codes: ['04.08.01.014-2', '04.08.06.071-9'],
        totalValue: 900.00,
        description: 'REPARO MANGUITO ROTADOR + VIDEOARTROSCOPIA - R$ 900,00 TOTAL (não soma)'
      }
    }
  },

  // ================================================================
  // HOSPITAL 18 DE DEZEMBRO - ARAPOTI (ARA)
  // Hospital ID: 01221e51-4bcd-4c45-b3d3-18d1df25c8f2
  // ================================================================
  'HOSPITAL_18_DEZEMBRO_ARAPOTI': {
    'THADEU TIESSI SUZUKI': {
      doctorName: 'THADEU TIESSI SUZUKI',
      // 🆕 REGRA DE VALOR FIXO: R$ 47.000,00 independente de procedimentos
      fixedPaymentRule: {
        amount: 47000.00,
        description: 'Valor fixo mensal: R$ 47.000,00 independente da quantidade de procedimentos'
      },
      rules: [] // Sem regras individuais, usa valor fixo
    },

    'PEDRO HENRIQUE RODRIGUES': {
      doctorName: 'PEDRO HENRIQUE RODRIGUES',
      rules: [
        {
          procedureCode: '04.06.02.057-4',
          standardValue: 1100.00,
          description: 'TRATAMENTO CIRÚRGICO DE VARIZES (UNILATERAL) - R$ 1.100,00'
        }
      ]
    },

    'JOAO VICTOR RODRIGUES': {
      doctorName: 'JOAO VICTOR RODRIGUES',
      rules: [
        // ================================================================
        // 🏥 PROCEDIMENTO PRINCIPAL - COLECISTECTOMIA BASE
        // Mesmas regras da FABIANE GREGORIO BATISTELA
        // Última atualização: 27/10/2025
        // ================================================================
        {
          procedureCode: '04.07.03.002-6',
          standardValue: 900.00,
          description: 'COLECISTECTOMIA (PRINCIPAL) - R$ 900,00'
        },
        
        // ================================================================
        // 🔧 PROCEDIMENTOS SEQUENCIAIS - SOMAM À COLECISTECTOMIA
        // Limite: até 4 procedimentos sequenciais
        // ================================================================
        {
          procedureCode: '04.07.04.018-8',
          standardValue: 300.00,
          description: 'LIBERAÇÃO DE ADERÊNCIAS INTESTINAIS - R$ 300,00'
        },
        {
          procedureCode: '04.07.04.002-1',
          standardValue: 300.00,
          description: 'DRENAGEM DE ABSCESSO SUBFRÊNICO - R$ 300,00'
        },
        {
          procedureCode: '04.07.03.014-0',
          standardValue: 300.00,
          description: 'HEPATORRAFIA - R$ 300,00'
        },
        {
          procedureCode: '04.07.03.006-9',
          standardValue: 250.00,
          description: 'COLEDOCOTOMIA - R$ 250,00'
        },
        {
          procedureCode: '04.07.03.005-0',
          standardValue: 200.00,
          description: 'COLEDOCOPLASTIA - R$ 200,00'
        },
        
        // ================================================================
        // 🏥 HÉRNIAS COMO PROCEDIMENTO PRINCIPAL - NOVOS VALORES
        // ================================================================
        {
          procedureCode: '04.07.04.010-2',
          standardValue: 700.00,
          description: 'HERNIOPLASTIA INGUINAL UNILATERAL (PRINCIPAL) - R$ 700,00'
        },
        {
          procedureCode: '04.07.04.009-9',
          standardValue: 700.00,
          description: 'HERNIOPLASTIA INGUINAL BILATERAL (PRINCIPAL) - R$ 700,00'
        },
        {
          procedureCode: '04.07.04.006-4',
          standardValue: 800.00,
          description: 'HERNIOPLASTIA EPIGÁSTRICA (PRINCIPAL) - R$ 800,00'
        },
        {
          procedureCode: '04.07.04.012-9',
          standardValue: 450.00,
          description: 'HERNIOPLASTIA UMBILICAL (PRINCIPAL) - R$ 450,00'
        },
        {
          procedureCode: '04.07.04.008-0',
          standardValue: 600.00,
          description: 'HERNIOPLASTIA INCISIONAL/VENTRAL (PRINCIPAL) - R$ 600,00'
        },
        
        // ================================================================
        // 🆕 PROCEDIMENTOS ORIFICIAIS - FÍSTULAS, FISSURAS E HEMORRÓIDAS
        // Data: 27/10/2025
        // Valor padrão: R$ 450,00 por procedimento
        // ================================================================
        {
          procedureCode: '04.07.02.027-6',
          standardValue: 450.00,
          description: 'FISTULECTOMIA/FISTULOTOMIA ANAL - R$ 450,00'
        },
        {
          procedureCode: '04.07.02.028-4',
          standardValue: 450.00,
          description: 'HEMORROIDECTOMIA - R$ 450,00'
        },
        {
          procedureCode: '04.07.02.031-4',
          standardValue: 450.00,
          description: 'TRATAMENTO CIRÚRGICO DE FISSURA ANAL - R$ 450,00'
        },
        
        // ================================================================
        // 🆕 CISTOS E LIPOMAS
        // Data: 27/10/2025
        // Valor padrão: R$ 250,00 por procedimento
        // ================================================================
        {
          procedureCode: '04.01.02.007-0',
          standardValue: 250.00,
          description: 'EXÉRESE DE CISTO DERMOIDE - R$ 250,00'
        },
        {
          procedureCode: '04.01.02.010-0',
          standardValue: 250.00,
          description: 'EXTIRPAÇÃO E SUPRESSÃO DE LESÃO DE PELE E DE TECIDO SUBCUTÂNEO - R$ 250,00'
        },
        {
          procedureCode: '04.01.02.008-8',
          standardValue: 250.00,
          description: 'EXÉRESE DE LIPOMA - R$ 250,00'
        },
        {
          procedureCode: '04.01.02.009-6',
          standardValue: 250.00,
          description: 'EXÉRESE DE CISTO PILONIDAL - R$ 250,00'
        }
      ],
      
      // ================================================================
      // 🔗 REGRAS MÚLTIPLAS - COLECISTECTOMIA + SEQUENCIAIS
      // Sistema: Colecistectomia R$ 900 + soma dos procedimentos sequenciais
      // ================================================================
      multipleRules: [
        // Colecistectomia + 1 Sequencial
        {
          codes: ['04.07.03.002-6', '04.07.04.018-8'],
          totalValue: 1200.00,
          description: 'COLECISTECTOMIA + LIBERAÇÃO DE ADERÊNCIAS - R$ 1.200,00'
        },
        {
          codes: ['04.07.03.002-6', '04.07.04.002-1'],
          totalValue: 1200.00,
          description: 'COLECISTECTOMIA + DRENAGEM ABSCESSO SUBFRÊNICO - R$ 1.200,00'
        },
        {
          codes: ['04.07.03.002-6', '04.07.03.014-0'],
          totalValue: 1200.00,
          description: 'COLECISTECTOMIA + HEPATORRAFIA - R$ 1.200,00'
        },
        {
          codes: ['04.07.03.002-6', '04.07.03.006-9'],
          totalValue: 1150.00,
          description: 'COLECISTECTOMIA + COLEDOCOTOMIA - R$ 1.150,00'
        },
        {
          codes: ['04.07.03.002-6', '04.07.03.005-0'],
          totalValue: 1100.00,
          description: 'COLECISTECTOMIA + COLEDOCOPLASTIA - R$ 1.100,00'
        },
        
        // Colecistectomia + Hérnias (soma valores originais)
        {
          codes: ['04.07.03.002-6', '04.07.04.010-2'],
          totalValue: 1600.00,
          description: 'COLECISTECTOMIA + HERNIOPLASTIA INGUINAL UNILATERAL - R$ 1.600,00'
        },
        {
          codes: ['04.07.03.002-6', '04.07.04.009-9'],
          totalValue: 1600.00,
          description: 'COLECISTECTOMIA + HERNIOPLASTIA INGUINAL BILATERAL - R$ 1.600,00'
        },
        {
          codes: ['04.07.03.002-6', '04.07.04.006-4'],
          totalValue: 1700.00,
          description: 'COLECISTECTOMIA + HERNIOPLASTIA EPIGÁSTRICA - R$ 1.700,00'
        },
        {
          codes: ['04.07.03.002-6', '04.07.04.012-9'],
          totalValue: 1350.00,
          description: 'COLECISTECTOMIA + HERNIOPLASTIA UMBILICAL - R$ 1.350,00'
        },
        {
          codes: ['04.07.03.002-6', '04.07.04.008-0'],
          totalValue: 1500.00,
          description: 'COLECISTECTOMIA + HERNIOPLASTIA INCISIONAL/VENTRAL - R$ 1.500,00'
        },
        
        // Colecistectomia + 2 Sequenciais (exemplos principais)
        {
          codes: ['04.07.03.002-6', '04.07.04.018-8', '04.07.03.014-0'],
          totalValue: 1500.00,
          description: 'COLECISTECTOMIA + LIBERAÇÃO ADERÊNCIAS + HEPATORRAFIA - R$ 1.500,00'
        },
        {
          codes: ['04.07.03.002-6', '04.07.03.006-9', '04.07.03.005-0'],
          totalValue: 1350.00,
          description: 'COLECISTECTOMIA + COLEDOCOTOMIA + COLEDOCOPLASTIA - R$ 1.350,00'
        },
        
        // Colecistectomia + 3 Sequenciais
        {
          codes: ['04.07.03.002-6', '04.07.04.018-8', '04.07.03.014-0', '04.07.04.002-1'],
          totalValue: 1800.00,
          description: 'COLECISTECTOMIA + LIBERAÇÃO + HEPATORRAFIA + DRENAGEM - R$ 1.800,00'
        },
        
        // Colecistectomia + 4 Sequenciais (máximo)
        {
          codes: ['04.07.03.002-6', '04.07.04.018-8', '04.07.03.014-0', '04.07.04.002-1', '04.07.03.006-9'],
          totalValue: 2050.00,
          description: 'COLECISTECTOMIA + 4 SEQUENCIAIS (MÁXIMO) - R$ 2.050,00'
        },
        
        // ================================================================
        // 🆕 REGRAS DE MÚLTIPLAS HÉRNIAS
        // Nova lógica: 1ª hérnia = valor original, 2ª+ hérnias = R$ 300,00
        // Data: 27/10/2025
        // ================================================================
        
        // Combinações com HERNIOPLASTIA INGUINAL UNILATERAL como 1ª (R$ 700)
        {
          codes: ['04.07.04.010-2', '04.07.04.009-9'],
          totalValue: 1000.00,
          description: 'INGUINAL UNILATERAL (1ª) + INGUINAL BILATERAL (2ª) - R$ 1.000,00'
        },
        {
          codes: ['04.07.04.010-2', '04.07.04.006-4'],
          totalValue: 1000.00,
          description: 'INGUINAL UNILATERAL (1ª) + EPIGÁSTRICA (2ª) - R$ 1.000,00'
        },
        {
          codes: ['04.07.04.010-2', '04.07.04.012-9'],
          totalValue: 1000.00,
          description: 'INGUINAL UNILATERAL (1ª) + UMBILICAL (2ª) - R$ 1.000,00'
        },
        {
          codes: ['04.07.04.010-2', '04.07.04.008-0'],
          totalValue: 1000.00,
          description: 'INGUINAL UNILATERAL (1ª) + INCISIONAL/VENTRAL (2ª) - R$ 1.000,00'
        },
        
        // Combinações com HERNIOPLASTIA INGUINAL BILATERAL como 1ª (R$ 700)
        {
          codes: ['04.07.04.009-9', '04.07.04.010-2'],
          totalValue: 1000.00,
          description: 'INGUINAL BILATERAL (1ª) + INGUINAL UNILATERAL (2ª) - R$ 1.000,00'
        },
        {
          codes: ['04.07.04.009-9', '04.07.04.006-4'],
          totalValue: 1000.00,
          description: 'INGUINAL BILATERAL (1ª) + EPIGÁSTRICA (2ª) - R$ 1.000,00'
        },
        {
          codes: ['04.07.04.009-9', '04.07.04.012-9'],
          totalValue: 1000.00,
          description: 'INGUINAL BILATERAL (1ª) + UMBILICAL (2ª) - R$ 1.000,00'
        },
        {
          codes: ['04.07.04.009-9', '04.07.04.008-0'],
          totalValue: 1000.00,
          description: 'INGUINAL BILATERAL (1ª) + INCISIONAL/VENTRAL (2ª) - R$ 1.000,00'
        },
        
        // Combinações com HERNIOPLASTIA EPIGÁSTRICA como 1ª (R$ 800)
        {
          codes: ['04.07.04.006-4', '04.07.04.010-2'],
          totalValue: 1100.00,
          description: 'EPIGÁSTRICA (1ª) + INGUINAL UNILATERAL (2ª) - R$ 1.100,00'
        },
        {
          codes: ['04.07.04.006-4', '04.07.04.009-9'],
          totalValue: 1100.00,
          description: 'EPIGÁSTRICA (1ª) + INGUINAL BILATERAL (2ª) - R$ 1.100,00'
        },
        {
          codes: ['04.07.04.006-4', '04.07.04.012-9'],
          totalValue: 1100.00,
          description: 'EPIGÁSTRICA (1ª) + UMBILICAL (2ª) - R$ 1.100,00'
        },
        {
          codes: ['04.07.04.006-4', '04.07.04.008-0'],
          totalValue: 1100.00,
          description: 'EPIGÁSTRICA (1ª) + INCISIONAL/VENTRAL (2ª) - R$ 1.100,00'
        },
        
        // Combinações com HERNIOPLASTIA UMBILICAL como 1ª (R$ 450)
        {
          codes: ['04.07.04.012-9', '04.07.04.010-2'],
          totalValue: 750.00,
          description: 'UMBILICAL (1ª) + INGUINAL UNILATERAL (2ª) - R$ 750,00'
        },
        {
          codes: ['04.07.04.012-9', '04.07.04.009-9'],
          totalValue: 750.00,
          description: 'UMBILICAL (1ª) + INGUINAL BILATERAL (2ª) - R$ 750,00'
        },
        {
          codes: ['04.07.04.012-9', '04.07.04.006-4'],
          totalValue: 750.00,
          description: 'UMBILICAL (1ª) + EPIGÁSTRICA (2ª) - R$ 750,00'
        },
        {
          codes: ['04.07.04.012-9', '04.07.04.008-0'],
          totalValue: 750.00,
          description: 'UMBILICAL (1ª) + INCISIONAL/VENTRAL (2ª) - R$ 750,00'
        },
        
        // Combinações com HERNIOPLASTIA INCISIONAL/VENTRAL como 1ª (R$ 600)
        {
          codes: ['04.07.04.008-0', '04.07.04.010-2'],
          totalValue: 900.00,
          description: 'INCISIONAL/VENTRAL (1ª) + INGUINAL UNILATERAL (2ª) - R$ 900,00'
        },
        {
          codes: ['04.07.04.008-0', '04.07.04.009-9'],
          totalValue: 900.00,
          description: 'INCISIONAL/VENTRAL (1ª) + INGUINAL BILATERAL (2ª) - R$ 900,00'
        },
        {
          codes: ['04.07.04.008-0', '04.07.04.006-4'],
          totalValue: 900.00,
          description: 'INCISIONAL/VENTRAL (1ª) + EPIGÁSTRICA (2ª) - R$ 900,00'
        },
        {
          codes: ['04.07.04.008-0', '04.07.04.012-9'],
          totalValue: 900.00,
          description: 'INCISIONAL/VENTRAL (1ª) + UMBILICAL (2ª) - R$ 900,00'
        },
        
        // Combinações de 3 hérnias (exemplos principais)
        {
          codes: ['04.07.04.006-4', '04.07.04.010-2', '04.07.04.012-9'],
          totalValue: 1400.00,
          description: 'EPIGÁSTRICA (1ª) + INGUINAL UNILATERAL (2ª) + UMBILICAL (3ª) - R$ 1.400,00'
        },
        {
          codes: ['04.07.04.006-4', '04.07.04.009-9', '04.07.04.012-9'],
          totalValue: 1400.00,
          description: 'EPIGÁSTRICA (1ª) + INGUINAL BILATERAL (2ª) + UMBILICAL (3ª) - R$ 1.400,00'
        },
        {
          codes: ['04.07.04.010-2', '04.07.04.012-9', '04.07.04.008-0'],
          totalValue: 1300.00,
          description: 'INGUINAL UNILATERAL (1ª) + UMBILICAL (2ª) + INCISIONAL (3ª) - R$ 1.300,00'
        },
        
        // Combinações de 4 hérnias
        {
          codes: ['04.07.04.006-4', '04.07.04.010-2', '04.07.04.012-9', '04.07.04.008-0'],
          totalValue: 1700.00,
          description: 'EPIGÁSTRICA (1ª) + INGUINAL UNI (2ª) + UMBILICAL (3ª) + INCISIONAL (4ª) - R$ 1.700,00'
        }
      ]
    },

    'ISAAC TAVARES DA SILVA': {
      doctorName: 'ISAAC TAVARES DA SILVA',
      // 🆕 REGRA DE VALOR FIXO: R$ 35.000,00 independente de procedimentos
      fixedPaymentRule: {
        amount: 35000.00,
        description: 'Valor fixo mensal: R$ 35.000,00 independente da quantidade de procedimentos'
      },
      rules: [] // Sem regras individuais, usa valor fixo
    },

    'ELTON CARVALHO': {
      doctorName: 'ELTON CARVALHO',
      // 🆕 REGRA DE VALOR FIXO: R$ 35.000,00 independente de procedimentos
      fixedPaymentRule: {
        amount: 35000.00,
        description: 'Valor fixo mensal: R$ 35.000,00 independente da quantidade de procedimentos'
      },
      rules: [] // Sem regras individuais, usa valor fixo
    },

    'LUIZ GUSTAVO SILVA GODOI': {
      doctorName: 'LUIZ GUSTAVO SILVA GODOI',
      // 🆕 REGRA DE VALOR FIXO: R$ 35.000,00 independente de procedimentos
      fixedPaymentRule: {
        amount: 35000.00,
        description: 'Valor fixo mensal: R$ 35.000,00 independente da quantidade de procedimentos'
      },
      rules: [] // Sem regras individuais, usa valor fixo
    },

    'BRUNO COLANZI DE MEDEIROS': {
      doctorName: 'BRUNO COLANZI DE MEDEIROS',
      // 🔬 REGRAS GINECOLÓGICAS - Procedimentos especializados
      rules: [
        // ================================================================
        // HISTERECTOMIAS - Diferentes tipos
        // ================================================================
        {
          procedureCode: '04.09.06.013-5',
          standardValue: 850.00,
          description: 'HISTERECTOMIA TOTAL - R$ 850,00'
        },
        {
          procedureCode: '04.09.06.012-7',
          standardValue: 600.00,
          description: 'HISTERECTOMIA SUBTOTAL - R$ 600,00'
        },
        {
          procedureCode: '04.09.06.011-9',
          standardValue: 1000.00,
          description: 'HISTERECTOMIA C/ ANEXECTOMIA (UNI / BILATERAL) - R$ 1.000,00'
        },
        
        // ================================================================
        // CIRURGIAS OVARIANAS E TUBÁRIAS
        // ================================================================
        {
          procedureCode: '04.09.06.021-6',
          standardValue: 500.00,
          description: 'OOFORECTOMIA / OOFOROPLASTIA - R$ 500,00'
        },
        {
          procedureCode: '04.09.06.023-2',
          standardValue: 250.00,
          description: 'SALPINGECTOMIA UNI / BILATERAL - R$ 250,00'
        },
        {
          procedureCode: '04.09.06.018-6',
          standardValue: 500.00,
          description: 'LAQUEADURA TUBARIA - R$ 500,00'
        },
        
        // ================================================================
        // CIRURGIAS VAGINAIS E INCONTINÊNCIA
        // ================================================================
        {
          procedureCode: '04.09.07.027-0',
          standardValue: 350.00,
          description: 'TRATAMENTO CIRÚRGICO DE INCONTINÊNCIA URINÁRIA POR VIA VAGINAL - R$ 350,00'
        },
        {
          procedureCode: '04.09.07.006-8',
          standardValue: 350.00,
          description: 'COLPOPERINEOPLASTIA POSTERIOR - R$ 350,00'
        },
        {
          procedureCode: '04.09.07.005-0',
          standardValue: 500.00,
          description: 'COLPOPERINEOPLASTIA ANTERIOR E POSTERIOR - R$ 500,00'
        },
        
        // ================================================================
        // PROCEDIMENTOS MENORES E DIAGNÓSTICOS
        // ================================================================
        {
          procedureCode: '04.09.06.004-6',
          standardValue: 200.00,
          description: 'CURETAGEM SEMIÓTICA C/ OU S/ DILATAÇÃO DO COLO DO ÚTERO - R$ 200,00'
        },
        {
          procedureCode: '04.09.07.026-2',
          standardValue: 200.00,
          description: 'TRATAMENTO CIRÚRGICO DE HIPERTROFIA DOS PEQUENOS LÁBIOS (NINFOPLASTIA) - R$ 200,00'
        },
        {
          procedureCode: '04.08.06.031-0',
          standardValue: 200.00,
          description: 'RESSECÇÃO SIMPLES DE TUMOR ÓSSEO / DE PARTES MOLES (Lesões cutâneas/verrugas genitais) - R$ 200,00'
        },
        {
          procedureCode: '04.09.07.015-7',
          standardValue: 200.00,
          description: 'EXÉRESE DE GLÂNDULA DE BARTHOLIN / SKENE - R$ 200,00'
        },
        {
          procedureCode: '04.09.07.003-3',
          standardValue: 250.00,
          description: 'COLPOCLEISE (CIRURGIA DE LE FORT) - R$ 250,00'
        },
        {
          procedureCode: '04.09.06.019-4',
          standardValue: 450.00,
          description: 'MIOMECTOMIA - R$ 450,00'
        },
        {
          procedureCode: '04.09.07.014-9',
          standardValue: 250.00,
          description: 'EXÉRESE DE CISTO VAGINAL - R$ 250,00'
        },
        
        // ================================================================
        // PROCEDIMENTOS ADICIONAIS
        // ================================================================
        {
          procedureCode: '04.09.06.022-4',
          standardValue: 100.00,
          description: 'RESSECÇÃO DE VARIZES PÉLVICAS (ADICIONAL AO PROCEDIMENTO PRINCIPAL) - R$ 100,00'
        },
        {
          procedureCode: '04.07.04.018-8',
          standardValue: 250.00,
          description: 'LIBERAÇÃO DE ADERÊNCIAS INTESTINAIS (ADICIONAL AO PROCEDIMENTO PRINCIPAL) - R$ 250,00'
        },
        {
          procedureCode: '04.09.07.009-2',
          standardValue: 100.00,
          description: 'COLPORRAFIA NÃO OBSTÉTRICA (ADICIONAL AO PROCEDIMENTO PRINCIPAL) - R$ 100,00'
        },
        {
          procedureCode: '04.08.06.020-4',
          standardValue: 100.00,
          description: 'REINSERÇÃO MUSCULAR (CORREÇÃO DE DIÁSTESE DE RETO ABDOMINAL - ADICIONAL) - R$ 100,00'
        }
      ],
      
      // ================================================================
      // 🔗 REGRAS MÚLTIPLAS - Combinações específicas de procedimentos
      // ================================================================
      multipleRules: [
        {
          codes: ['04.09.06.021-6', '04.09.06.023-2'],
          totalValue: 500.00,
          description: 'OOFORECTOMIA/OOFOROPLASTIA + SALPINGECTOMIA UNI/BILATERAL - R$ 500,00'
        },
        {
          codes: ['04.09.06.018-6', '04.09.07.027-0'],
          totalValue: 850.00,
          description: 'LAQUEADURA TUBARIA + TRATAMENTO CIRÚRGICO DE INCONTINÊNCIA URINÁRIA - R$ 850,00'
        },
        {
          codes: ['04.09.07.006-8', '04.09.07.027-0'],
          totalValue: 600.00,
          description: 'COLPOPERINEOPLASTIA POSTERIOR + TRATAMENTO CIRÚRGICO DE INCONTINÊNCIA URINÁRIA - R$ 600,00'
        },
        {
          codes: ['04.09.07.005-0', '04.09.07.027-0'],
          totalValue: 700.00,
          description: 'COLPOPERINEOPLASTIA ANTERIOR E POSTERIOR + TRATAMENTO CIRÚRGICO DE INCONTINÊNCIA URINÁRIA - R$ 700,00'
        }
      ]
    },

    // ================================================================
    // DR. JAIR DEMETRIO DE SOUZA - OTORRINOLARINGOLOGIA
    // Hospital: Municipal 18 de Dezembro (Arapoti)
    // Especialidade: Otorrinolaringologia
    // Baseado em: Dr. HUMBERTO MOREIRA DA SILVA (Torao Tokuda)
    // Data: 18/11/2025
    // ================================================================
    'JAIR DEMETRIO DE SOUZA': {
      doctorName: 'JAIR DEMETRIO DE SOUZA',
      // 🩺 PROCEDIMENTOS DE OTORRINOLARINGOLOGIA
      rules: [
        {
          procedureCode: '04.04.01.048-2',
          standardValue: 650.00,
          description: 'SEPTOPLASTIA - R$ 650,00'
        },
        {
          procedureCode: '04.04.01.041-5',
          standardValue: 650.00,
          description: 'TURBINECTOMIA - R$ 650,00'
        },
        {
          procedureCode: '04.04.01.002-4',
          standardValue: 650.00,
          description: 'AMIGDALECTOMIA - R$ 650,00'
        },
        {
          procedureCode: '04.04.01.001-6',
          standardValue: 650.00,
          description: 'ADENOIDECTOMIA - R$ 650,00'
        },
        {
          procedureCode: '04.04.01.003-2',
          standardValue: 650.00,
          description: 'ADENOAMIGDALECTOMIA - R$ 650,00'
        }
      ],
      // 🔗 REGRA MÚLTIPLA: Quando 2 ou mais procedimentos, valor total fixo
      multipleRule: {
        codes: ['04.04.01.048-2', '04.04.01.041-5', '04.04.01.002-4', '04.04.01.001-6', '04.04.01.003-2'],
        totalValue: 800.00,
        description: 'DOIS OU MAIS PROCEDIMENTOS ORL - R$ 800,00 TOTAL (não soma)'
      }
    },

    // ================================================================
    // DR. GUILHERME VINICIUS SAWCZYN - UROLOGIA
    // Hospital: Municipal 18 de Dezembro (Arapoti)
    // Especialidade: Urologia
    // Baseado em: Dr. GUILHERME AUGUSTO STORER (Torao Tokuda)
    // Data: 18/11/2025
    // ================================================================
    'GUILHERME VINICIUS SAWCZYN': {
      doctorName: 'GUILHERME VINICIUS SAWCZYN',
      // ================================================================
      // 🔬 PROCEDIMENTOS INDIVIDUAIS - UROLOGIA
      // Total: 21 procedimentos
      // ================================================================
      rules: [
        {
          procedureCode: '04.09.01.023-5',
          standardValue: 1000.00,
          description: 'NEFROLITOTOMIA PERCUTÂNEA - R$ 1.000,00'
        },
        {
          procedureCode: '04.09.01.059-6',
          standardValue: 900.00,
          description: 'URETEROLITOTRIPSIA TRANSURETEROSCÓPICA (SEMIRRÍGIDA) - R$ 900,00'
        },
        {
          procedureCode: '04.09.01.018-9',
          standardValue: 1000.00,
          description: 'LITOTRIPSIA (FLEXÍVEL) - R$ 1.000,00'
        },
        {
          procedureCode: '04.09.01.017-0',
          standardValue: 250.00,
          description: 'INSTALAÇÃO ENDOSCÓPICA DE CATETER DUPLO J - R$ 250,00'
        },
        {
          procedureCode: '04.09.03.004-0',
          standardValue: 1000.00,
          description: 'RESSECÇÃO ENDOSCÓPICA DE PRÓSTATA - R$ 1.000,00'
        },
        {
          procedureCode: '04.09.03.002-3',
          standardValue: 1000.00,
          description: 'PROSTATECTOMIA SUPRAPÚBICA - R$ 1.000,00'
        },
        {
          procedureCode: '04.09.04.021-5',
          standardValue: 300.00,
          description: 'TRATAMENTO CIRÚRGICO DE HIDROCELE - R$ 300,00'
        },
        {
          procedureCode: '04.09.05.008-3',
          standardValue: 250.00,
          description: 'POSTECTOMIA - R$ 250,00'
        },
        {
          procedureCode: '04.09.04.024-0',
          standardValue: 450.00,
          description: 'VASECTOMIA - R$ 450,00'
        },
        {
          procedureCode: '04.09.04.023-1',
          standardValue: 250.00,
          description: 'TRATAMENTO CIRÚRGICO DE VARICOCELE - R$ 250,00'
        },
        {
          procedureCode: '04.09.04.013-4',
          standardValue: 400.00,
          description: 'ORQUIDOPEXIA UNILATERAL - R$ 400,00'
        },
        {
          procedureCode: '04.09.04.012-6',
          standardValue: 450.00,
          description: 'ORQUIDOPEXIA BILATERAL - R$ 450,00'
        },
        {
          procedureCode: '04.09.01.006-5',
          standardValue: 600.00,
          description: 'CISTOLITOTOMIA E/OU RETIRADA DE CORPO ESTRANHO DA BEXIGA - R$ 600,00'
        },
        {
          procedureCode: '04.09.05.007-5',
          standardValue: 500.00,
          description: 'PLÁSTICA TOTAL DO PÊNIS (INCLUI PEYRONIE) - R$ 500,00'
        },
        {
          procedureCode: 'RESSECÇÃO_CISTOS',
          standardValue: 250.00,
          description: 'RESSECÇÃO DE CISTOS/CAUTERIZAÇÕES - R$ 250,00'
        },
        {
          procedureCode: '04.09.04.016-9',
          standardValue: 500.00,
          description: 'ORQUIECTOMIA UNILATERAL - R$ 500,00'
        },
        {
          procedureCode: '04.09.01.032-4',
          standardValue: 700.00,
          description: 'PIELOPLASTIA - R$ 700,00'
        },
        {
          procedureCode: '04.09.01.021-9',
          standardValue: 1200.00,
          description: 'NEFRECTOMIA TOTAL - R$ 1.200,00'
        },
        {
          procedureCode: '04.09.01.020-0',
          standardValue: 1000.00,
          description: 'NEFRECTOMIA PARCIAL - R$ 1.000,00'
        },
        {
          procedureCode: '04.09.01.022-7',
          standardValue: 900.00,
          description: 'NEFROLITOTOMIA (ANATRÓFICA) - R$ 900,00'
        },
        {
          procedureCode: '04.09.01.029-4',
          standardValue: 400.00,
          description: 'NEFROSTOMIA PERCUTÂNEA - R$ 400,00'
        },
        {
          procedureCode: '04.09.02.017-6',
          standardValue: 250.00,
          description: 'URETROTOMIA INTERNA - R$ 250,00'
        }
      ],
      // ================================================================
      // 🔗 REGRAS DE MÚLTIPLOS PROCEDIMENTOS
      // Total: 16 combinações
      // ================================================================
      multipleRules: [
        // Grupo 1: NEFROLITOTOMIA PERCUTÂNEA + Combinações
        {
          codes: ['04.09.01.023-5', '04.09.01.017-0'],
          totalValue: 1100.00,
          description: 'NEFROLITOTOMIA PERCUTÂNEA + INSTALAÇÃO CATETER DUPLO J - R$ 1.100,00'
        },
        {
          codes: ['04.09.01.023-5', '04.09.01.014-6'],
          totalValue: 1300.00,
          description: 'NEFROLITOTOMIA PERCUTÂNEA + EXTRAÇÃO CÁLCULO PELVE RENAL - R$ 1.300,00'
        },
        {
          codes: ['04.09.01.023-5', '04.09.01.017-0', '04.09.01.014-6'],
          totalValue: 1400.00,
          description: 'NEFROLITOTOMIA PERCUTÂNEA + CATETER DUPLO J + EXTRAÇÃO CÁLCULO - R$ 1.400,00'
        },
        {
          codes: ['04.09.01.023-5', '04.09.01.014-6', '04.09.01.059-6'],
          totalValue: 1500.00,
          description: 'NEFROLITOTOMIA PERCUTÂNEA + EXTRAÇÃO CÁLCULO + URETEROLITOTRIPSIA - R$ 1.500,00'
        },
        {
          codes: ['04.09.01.023-5', '04.09.01.017-0', '04.09.01.014-6', '04.09.01.059-6'],
          totalValue: 1600.00,
          description: 'NEFROLITOTOMIA PERCUTÂNEA + CATETER + EXTRAÇÃO + URETEROLITOTRIPSIA - R$ 1.600,00'
        },
        
        // Grupo 2: URETEROLITOTRIPSIA + Combinações
        {
          codes: ['04.09.01.059-6', '04.09.01.017-0'],
          totalValue: 1000.00,
          description: 'URETEROLITOTRIPSIA + INSTALAÇÃO CATETER DUPLO J - R$ 1.000,00'
        },
        
        // Grupo 3: LITOTRIPSIA (FLEXÍVEL) + Combinações
        {
          codes: ['04.09.01.018-9', '04.09.01.017-0'],
          totalValue: 1100.00,
          description: 'LITOTRIPSIA (FLEXÍVEL) + INSTALAÇÃO CATETER DUPLO J - R$ 1.100,00'
        },
        {
          codes: ['04.09.01.018-9', '04.09.01.014-6', '04.09.01.017-0'],
          totalValue: 1200.00,
          description: 'LITOTRIPSIA (FLEXÍVEL) + EXTRAÇÃO CÁLCULO + CATETER DUPLO J - R$ 1.200,00'
        },
        {
          codes: ['04.09.01.018-9', '04.09.01.059-6', '04.09.01.014-6', '04.09.01.017-0'],
          totalValue: 1300.00,
          description: 'LITOTRIPSIA + URETEROLITOTRIPSIA + EXTRAÇÃO + CATETER - R$ 1.300,00'
        },
        
        // Grupo 4: PRÓSTATA + Combinações
        {
          codes: ['04.09.03.004-0', '04.09.01.038-3'],
          totalValue: 1200.00,
          description: 'RESSECÇÃO PRÓSTATA + RESSECÇÃO LESÃO VESICAL - R$ 1.200,00'
        },
        
        // Grupo 5: HIDROCELE + Combinações
        {
          codes: ['04.09.04.021-5', '04.09.04.019-3'],
          totalValue: 400.00,
          description: 'HIDROCELE + RESSECÇÃO PARCIAL BOLSA ESCROTAL - R$ 400,00'
        },
        {
          codes: ['04.09.04.021-5', '04.09.04.019-3', '04.09.04.017-7'],
          totalValue: 500.00,
          description: 'HIDROCELE + RESSECÇÃO BOLSA + PLÁSTICA BOLSA ESCROTAL - R$ 500,00'
        },
        
        // Grupo 6: ORQUIDOPEXIA + PLÁSTICA BOLSA ESCROTAL
        {
          codes: ['04.09.04.013-4', '04.09.04.017-7'],
          totalValue: 550.00,
          description: 'ORQUIDOPEXIA UNILATERAL + PLÁSTICA BOLSA ESCROTAL - R$ 550,00'
        },
        {
          codes: ['04.09.04.012-6', '04.09.04.017-7'],
          totalValue: 550.00,
          description: 'ORQUIDOPEXIA BILATERAL + PLÁSTICA BOLSA ESCROTAL - R$ 550,00'
        },
        
        // Grupo 7: PIELOPLASTIA + Combinações
        {
          codes: ['04.09.01.032-4', '04.09.01.057-0'],
          totalValue: 1000.00,
          description: 'PIELOPLASTIA + URETEROPLASTIA - R$ 1.000,00'
        },
        {
          codes: ['04.09.01.032-4', '04.09.01.057-0', '04.09.01.017-0'],
          totalValue: 1100.00,
          description: 'PIELOPLASTIA + URETEROPLASTIA + INSTALAÇÃO CATETER DUPLO J - R$ 1.100,00'
        }
      ]
    },

    // ================================================================
    // DR. BRUNO BOSIO DA SILVA - ORTOPEDIA
    // Hospital: Municipal 18 de Dezembro (Arapoti)
    // Especialidade: Ortopedia (Ombro/Manguito Rotador)
    // Data: 18/11/2025
    // Observação: No Hospital São José, este médico tem valor fixo de R$ 40.000,00
    //             No Hospital 18 de Dezembro, ele trabalha com regras por procedimento
    // ================================================================
    'BRUNO BOSIO DA SILVA': {
      doctorName: 'BRUNO BOSIO DA SILVA',
      // 🔬 PROCEDIMENTOS INDIVIDUAIS - ORTOPEDIA
      rules: [
        {
          procedureCode: '04.08.01.014-2',
          standardValue: 900.00,
          description: 'REPARO DE ROTURA DO MANGUITO ROTADOR (INCLUI PROCEDIMENTOS DESCOMPRESSIVOS) - R$ 900,00'
        },
        {
          procedureCode: '04.08.06.071-9',
          standardValue: 900.00,
          description: 'VIDEOARTROSCOPIA - R$ 900,00'
        }
      ],
      // 🔗 REGRA MÚLTIPLA: Combinação específica
      multipleRule: {
        codes: ['04.08.01.014-2', '04.08.06.071-9'],
        totalValue: 900.00,
        description: 'REPARO MANGUITO ROTADOR + VIDEOARTROSCOPIA - R$ 900,00 TOTAL (não soma)'
      }
    }
  },

  // ================================================================
  // HOSPITAL MUNICIPAL SANTA ALICE (CAS)
  // Hospital ID: 1d8ca73a-1927-462e-91c0-fa7004d0b377
  // ================================================================
  'HOSPITAL_MUNICIPAL_SANTA_ALICE': {
    'JULIO DE CASTRO NETO': {
      doctorName: 'JULIO DE CASTRO NETO',
      // ================================================================
      // 🦴 PROCEDIMENTOS ORTOPÉDICOS - CIRURGIA DE JOELHO
      // Especialidade: Ortopedia
      // Data: 19/11/2025
      // Total: 5 procedimentos
      // ================================================================
      rules: [
        {
          procedureCode: '04.08.05.089-6',
          standardValue: 750.00,
          description: 'TRATAMENTO CIRÚRGICO DE ROTURA DO MENISCO COM MENISCECTOMIA PARCIAL / TOTAL - R$ 750,00'
        },
        {
          procedureCode: '04.08.05.088-8',
          standardValue: 750.00,
          description: 'TRATAMENTO CIRÚRGICO DE ROTURA DE MENISCO COM SUTURA MENISCAL UNI / BICOMPATIMENTAL - R$ 750,00'
        },
        {
          procedureCode: '04.08.05.016-0',
          standardValue: 900.00,
          description: 'RECONSTRUÇÃO LIGAMENTAR INTRA-ARTICULAR DO JOELHO (CRUZADO ANTERIOR) - R$ 900,00'
        },
        {
          procedureCode: '04.08.05.015-2',
          standardValue: 500.00,
          description: 'RECONSTRUÇÃO LIGAMENTAR EXTRA-ARTICULAR DO JOELHO - R$ 500,00'
        },
        {
          procedureCode: '04.08.05.006-3',
          standardValue: 2000.00,
          description: 'ARTROPLASTIA TOTAL PRIMÁRIA DO JOELHO - R$ 2.000,00'
        }
      ]
    }
  },

  // ================================================================
  // HOSPITAL MUNICIPAL SÃO JOSÉ
  // Hospital ID: 792a0316-92b4-4504-8238-491d284099a3
  // ================================================================
  'HOSPITAL_MUNICIPAL_SAO_JOSE': {
    'THIAGO TIESSI SUZUKI': {
      doctorName: 'THIAGO TIESSI SUZUKI',
      // ================================================================
      // 🔬 REGRAS UROLÓGICAS - DR. THIAGO TIESSI SUZUKI
      // Especialidade: Urologia
      // Baseado em: Dr. GUILHERME AUGUSTO STORER (Torao Tokuda)
      // Última atualização: 18/11/2025
      // ================================================================
      rules: [
        // ================================================================
        // PROCEDIMENTOS INDIVIDUAIS BÁSICOS
        // ================================================================
        {
          procedureCode: '04.09.01.023-5',
          standardValue: 1000.00,
          description: 'NEFROLITOTOMIA PERCUTÂNEA - R$ 1.000,00'
        },
        {
          procedureCode: '04.09.01.059-6',
          standardValue: 900.00,
          description: 'URETEROLITOTRIPSIA TRANSURETEROSCÓPICA (SEMIRRÍGIDA) - R$ 900,00'
        },
        {
          procedureCode: '04.09.01.018-9',
          standardValue: 1000.00,
          description: 'LITOTRIPSIA (FLEXÍVEL) - R$ 1.000,00'
        },
        {
          procedureCode: '04.09.01.017-0',
          standardValue: 250.00,
          description: 'INSTALAÇÃO ENDOSCÓPICA DE CATETER DUPLO J - R$ 250,00'
        },
        {
          procedureCode: '04.09.03.004-0',
          standardValue: 1000.00,
          description: 'RESSECÇÃO ENDOSCÓPICA DE PRÓSTATA - R$ 1.000,00'
        },
        {
          procedureCode: '04.09.03.002-3',
          standardValue: 1000.00,
          description: 'PROSTATECTOMIA SUPRAPÚBICA - R$ 1.000,00'
        },
        {
          procedureCode: '04.09.04.021-5',
          standardValue: 300.00,
          description: 'TRATAMENTO CIRÚRGICO DE HIDROCELE - R$ 300,00'
        },
        {
          procedureCode: '04.09.05.008-3',
          standardValue: 250.00,
          description: 'POSTECTOMIA - R$ 250,00'
        },
        {
          procedureCode: '04.09.04.024-0',
          standardValue: 450.00,
          description: 'VASECTOMIA - R$ 450,00'
        },
        {
          procedureCode: '04.09.04.013-4',
          standardValue: 400.00,
          description: 'ORQUIDOPEXIA UNILATERAL - R$ 400,00'
        },
        {
          procedureCode: '04.09.04.012-6',
          standardValue: 450.00,
          description: 'ORQUIDOPEXIA BILATERAL - R$ 450,00'
        },
        {
          procedureCode: '04.09.01.006-5',
          standardValue: 600.00,
          description: 'CISTOLITOTOMIA E/OU RETIRADA DE CORPO ESTRANHO DA BEXIGA - R$ 600,00'
        },
        {
          procedureCode: '04.09.05.007-5',
          standardValue: 500.00,
          description: 'PLÁSTICA TOTAL DO PÊNIS (INCLUI PEYRONIE) - R$ 500,00'
        },
        {
          procedureCode: 'RESSECCAO_CISTOS_CAUTERIZACOES',
          standardValue: 250.00,
          description: 'RESSECÇÃO DE CISTOS/CAUTERIZAÇÕES - R$ 250,00'
        },
        {
          procedureCode: '04.09.04.016-9',
          standardValue: 500.00,
          description: 'ORQUIECTOMIA UNILATERAL - R$ 500,00'
        },
        {
          procedureCode: '04.09.01.032-4',
          standardValue: 700.00,
          description: 'PIELOPLASTIA - R$ 700,00'
        },
        {
          procedureCode: '04.09.01.021-9',
          standardValue: 1200.00,
          description: 'NEFRECTOMIA TOTAL - R$ 1.200,00'
        },
        {
          procedureCode: '04.09.01.020-0',
          standardValue: 1000.00,
          description: 'NEFRECTOMIA PARCIAL - R$ 1.000,00'
        },
        {
          procedureCode: '04.09.01.022-7',
          standardValue: 900.00,
          description: 'NEFROLITOTOMIA (ANATRÓFICA) - R$ 900,00'
        },
        {
          procedureCode: '04.09.01.029-4',
          standardValue: 400.00,
          description: 'NEFROSTOMIA PERCUTÂNEA - R$ 400,00'
        },
        {
          procedureCode: '04.09.02.017-6',
          standardValue: 250.00,
          description: 'URETROTOMIA INTERNA - R$ 250,00'
        },
        {
          procedureCode: '04.09.04.023-1',
          standardValue: 250.00,
          description: 'TRATAMENTO CIRÚRGICO DE VARICOCELE - R$ 250,00'
        }
      ],
      
      // ================================================================
      // 🔗 REGRAS MÚLTIPLAS - Combinações específicas de procedimentos
      // ================================================================
      multipleRules: [
        // NEFROLITOTOMIA PERCUTÂNEA + Combinações
        {
          codes: ['04.09.01.023-5', '04.09.01.017-0'],
          totalValue: 1100.00,
          description: 'NEFROLITOTOMIA PERCUTÂNEA + INSTALAÇÃO ENDOSCÓPICA DE CATETER DUPLO J - R$ 1.100,00'
        },
        {
          codes: ['04.09.01.023-5', '04.09.01.014-6'],
          totalValue: 1300.00,
          description: 'NEFROLITOTOMIA PERCUTÂNEA + EXTRAÇÃO ENDOSCÓPICA DE CÁLCULO EM PELVE RENAL - R$ 1.300,00'
        },
        {
          codes: ['04.09.01.023-5', '04.09.01.017-0', '04.09.01.014-6'],
          totalValue: 1400.00,
          description: 'NEFROLITOTOMIA PERCUTÂNEA + INSTALAÇÃO CATETER DUPLO J + EXTRAÇÃO CÁLCULO PELVE RENAL - R$ 1.400,00'
        },
        {
          codes: ['04.09.01.023-5', '04.09.01.014-6', '04.09.01.059-6'],
          totalValue: 1500.00,
          description: 'NEFROLITOTOMIA PERCUTÂNEA + EXTRAÇÃO CÁLCULO PELVE RENAL + URETEROLITOTRIPSIA - R$ 1.500,00'
        },
        {
          codes: ['04.09.01.023-5', '04.09.01.017-0', '04.09.01.014-6', '04.09.01.059-6'],
          totalValue: 1600.00,
          description: 'NEFROLITOTOMIA PERCUTÂNEA + INSTALAÇÃO CATETER + EXTRAÇÃO CÁLCULO + URETEROLITOTRIPSIA - R$ 1.600,00'
        },
        
        // URETEROLITOTRIPSIA + Combinações
        {
          codes: ['04.09.01.059-6', '04.09.01.017-0'],
          totalValue: 1000.00,
          description: 'URETEROLITOTRIPSIA TRANSURETEROSCÓPICA + INSTALAÇÃO CATETER DUPLO J (SEMIRRÍGIDA) - R$ 1.000,00'
        },
        
        // LITOTRIPSIA (FLEXÍVEL) + Combinações
        {
          codes: ['04.09.01.018-9', '04.09.01.017-0'],
          totalValue: 1100.00,
          description: 'LITOTRIPSIA (FLEXÍVEL) + INSTALAÇÃO ENDOSCÓPICA DE CATETER DUPLO J - R$ 1.100,00'
        },
        {
          codes: ['04.09.01.018-9', '04.09.01.014-6', '04.09.01.017-0'],
          totalValue: 1200.00,
          description: 'LITOTRIPSIA (FLEXÍVEL) + EXTRAÇÃO CÁLCULO PELVE RENAL + INSTALAÇÃO CATETER - R$ 1.200,00'
        },
        {
          codes: ['04.09.01.018-9', '04.09.01.059-6', '04.09.01.014-6', '04.09.01.017-0'],
          totalValue: 1300.00,
          description: 'LITOTRIPSIA (FLEXÍVEL) + URETEROLITOTRIPSIA + EXTRAÇÃO CÁLCULO + INSTALAÇÃO CATETER - R$ 1.300,00'
        },
        
        // RESSECÇÃO ENDOSCÓPICA DE PRÓSTATA + Combinações
        {
          codes: ['04.09.03.004-0', '04.09.01.038-3'],
          totalValue: 1200.00,
          description: 'RESSECÇÃO ENDOSCÓPICA DE PRÓSTATA + RESSECCAO ENDOSCOPICA DE LESÃO VESICAL - R$ 1.200,00'
        },
        
        // HIDROCELE + Combinações
        {
          codes: ['04.09.04.021-5', '04.09.04.019-3'],
          totalValue: 400.00,
          description: 'TRATAMENTO CIRÚRGICO DE HIDROCELE + RESSECÇÃO PARCIAL DA BOLSA ESCROTAL - R$ 400,00'
        },
        {
          codes: ['04.09.04.021-5', '04.09.04.019-3', '04.09.04.017-7'],
          totalValue: 500.00,
          description: 'HIDROCELE + RESSECÇÃO PARCIAL BOLSA ESCROTAL + PLÁSTICA DA BOLSA ESCROTAL - R$ 500,00'
        },
        
        // ORQUIDOPEXIA + PLÁSTICA
        {
          codes: ['04.09.04.013-4', '04.09.04.017-7'],
          totalValue: 550.00,
          description: 'ORQUIDOPEXIA UNILATERAL + PLÁSTICA DA BOLSA ESCROTAL - R$ 550,00'
        },
        {
          codes: ['04.09.04.012-6', '04.09.04.017-7'],
          totalValue: 550.00,
          description: 'ORQUIDOPEXIA BILATERAL + PLÁSTICA DA BOLSA ESCROTAL - R$ 550,00'
        },
        
        // PIELOPLASTIA + Combinações
        {
          codes: ['04.09.01.032-4', '04.09.01.057-0'],
          totalValue: 1000.00,
          description: 'PIELOPLASTIA + URETEROPLASTIA - R$ 1.000,00'
        },
        {
          codes: ['04.09.01.032-4', '04.09.01.057-0', '04.09.01.017-0'],
          totalValue: 1100.00,
          description: 'PIELOPLASTIA + URETEROPLASTIA + INSTALAÇÃO CATETER DUPLO J - R$ 1.100,00'
        }
      ]
    },

    // ================================================================
    // DRA. SUELLEN FERNANDA BAGATIM - OTORRINOLARINGOLOGIA
    // Hospital: Municipal São José (Carlópolis)
    // Especialidade: Otorrinolaringologia (ORL)
    // Data: 18/11/2025
    // ================================================================
    'SUELLEN FERNANDA BAGATIM': {
      doctorName: 'SUELLEN FERNANDA BAGATIM',
      // 👃 PROCEDIMENTOS ORL - Otorrinolaringologia
      rules: [
        // ================================================================
        // PROCEDIMENTOS INDIVIDUAIS - TODOS R$ 700,00
        // ================================================================
        {
          procedureCode: '04.04.01.048-2',
          standardValue: 700.00,
          description: 'SEPTOPLASTIA - R$ 700,00'
        },
        {
          procedureCode: '04.04.01.041-5',
          standardValue: 700.00,
          description: 'TURBINECTOMIA - R$ 700,00'
        },
        {
          procedureCode: '04.04.01.002-4',
          standardValue: 700.00,
          description: 'AMIGDALECTOMIA - R$ 700,00'
        },
        {
          procedureCode: '04.04.01.001-6',
          standardValue: 700.00,
          description: 'ADENOIDECTOMIA - R$ 700,00'
        },
        {
          procedureCode: '04.04.01.003-2',
          standardValue: 700.00,
          description: 'ADENOAMIGDALECTOMIA - R$ 700,00'
        }
      ],
      
      // ================================================================
      // 🔗 REGRA DE MÚLTIPLOS PROCEDIMENTOS
      // Septoplastia + Turbinectomia = R$ 700,00 TOTAL
      // Similar ao Dr. Humberto Moreira da Silva (oftalmologia)
      // ================================================================
      multipleRule: {
        codes: ['04.04.01.048-2', '04.04.01.041-5'],
        totalValue: 700.00,
        description: 'SEPTOPLASTIA + TURBINECTOMIA - R$ 700,00 TOTAL (não soma valores individuais)'
      }
    },

    // ================================================================
    // DR. VITOR BRANDANI GARBELINI - UROLOGIA
    // Hospital: Municipal São José (Carlópolis)
    // Especialidade: Urologia
    // Baseado em: Dr. GUILHERME AUGUSTO STORER (Torao Tokuda)
    // Data: 18/11/2025
    // ================================================================
    'VITOR BRANDANI GARBELINI': {
      doctorName: 'VITOR BRANDANI GARBELINI',
      // ================================================================
      // 🔬 PROCEDIMENTOS INDIVIDUAIS - DR. VITOR BRANDANI GARBELINI
      // Especialidade: Urologia
      // Baseado em: Dr. GUILHERME AUGUSTO STORER / Dr. HELIO SHINDY KISSINA
      // Última atualização: 18/11/2025
      // ================================================================
      rules: [
        {
          procedureCode: '04.09.01.023-5',
          standardValue: 1000.00,
          description: 'NEFROLITOTOMIA PERCUTÂNEA - R$ 1.000,00'
        },
        {
          procedureCode: '04.09.01.059-6',
          standardValue: 900.00,
          description: 'URETEROLITOTRIPSIA TRANSURETEROSCÓPICA (SEMIRRÍGIDA) - R$ 900,00'
        },
        {
          procedureCode: '04.09.01.018-9',
          standardValue: 1000.00,
          description: 'LITOTRIPSIA (FLEXÍVEL) - R$ 1.000,00'
        },
        {
          procedureCode: '04.09.01.017-0',
          standardValue: 250.00,
          description: 'INSTALAÇÃO ENDOSCÓPICA DE CATETER DUPLO J - R$ 250,00'
        },
        {
          procedureCode: '04.09.03.004-0',
          standardValue: 1000.00,
          description: 'RESSECÇÃO ENDOSCÓPICA DE PRÓSTATA - R$ 1.000,00'
        },
        {
          procedureCode: '04.09.03.002-3',
          standardValue: 1000.00,
          description: 'PROSTATECTOMIA SUPRAPÚBICA - R$ 1.000,00'
        },
        {
          procedureCode: '04.09.04.021-5',
          standardValue: 300.00,
          description: 'TRATAMENTO CIRÚRGICO DE HIDROCELE - R$ 300,00'
        },
        {
          procedureCode: '04.09.05.008-3',
          standardValue: 250.00,
          description: 'POSTECTOMIA - R$ 250,00'
        },
        {
          procedureCode: '04.09.04.024-0',
          standardValue: 450.00,
          description: 'VASECTOMIA - R$ 450,00'
        },
        {
          procedureCode: '04.09.04.023-1',
          standardValue: 250.00,
          description: 'TRATAMENTO CIRÚRGICO DE VARICOCELE - R$ 250,00'
        },
        {
          procedureCode: '04.09.04.013-4',
          standardValue: 400.00,
          description: 'ORQUIDOPEXIA UNILATERAL - R$ 400,00'
        },
        {
          procedureCode: '04.09.04.012-6',
          standardValue: 450.00,
          description: 'ORQUIDOPEXIA BILATERAL - R$ 450,00'
        },
        {
          procedureCode: '04.09.01.006-5',
          standardValue: 600.00,
          description: 'CISTOLITOTOMIA E/OU RETIRADA DE CORPO ESTRANHO DA BEXIGA (RETIRADA DE CÁLCULO VESICAL ENDOSCÓPICA OU CONVENCIONAL) - R$ 600,00'
        },
        {
          procedureCode: '04.09.05.007-5',
          standardValue: 500.00,
          description: 'PLÁSTICA TOTAL DO PÊNIS (INCLUI PEYRONIE) - R$ 500,00'
        },
        {
          procedureCode: 'RESSECÇÃO_CISTOS',
          standardValue: 250.00,
          description: 'RESSECÇÃO DE CISTOS/CAUTERIZAÇÕES - R$ 250,00'
        },
        {
          procedureCode: '04.09.04.016-9',
          standardValue: 500.00,
          description: 'ORQUIECTOMIA UNILATERAL - R$ 500,00'
        },
        {
          procedureCode: '04.09.01.032-4',
          standardValue: 700.00,
          description: 'PIELOPLASTIA - R$ 700,00'
        },
        {
          procedureCode: '04.09.01.021-9',
          standardValue: 1200.00,
          description: 'NEFRECTOMIA TOTAL - R$ 1.200,00'
        },
        {
          procedureCode: '04.09.01.020-0',
          standardValue: 1000.00,
          description: 'NEFRECTOMIA PARCIAL - R$ 1.000,00'
        },
        {
          procedureCode: '04.09.01.022-7',
          standardValue: 900.00,
          description: 'NEFROLITOTOMIA (ANATRÓFICA) - R$ 900,00'
        },
        {
          procedureCode: '04.09.01.029-4',
          standardValue: 400.00,
          description: 'NEFROSTOMIA PERCUTÂNEA - R$ 400,00'
        },
        {
          procedureCode: '04.09.02.017-6',
          standardValue: 250.00,
          description: 'URETROTOMIA INTERNA - R$ 250,00'
        }
      ],
      
      // ================================================================
      // 🔗 REGRAS DE MÚLTIPLOS PROCEDIMENTOS - DR. VITOR BRANDANI GARBELINI
      // Sistema: Valores fixos para combinações específicas
      // Total: 16 combinações cadastradas
      // Baseado em: Dr. GUILHERME AUGUSTO STORER / Dr. HELIO SHINDY KISSINA
      // ================================================================
      multipleRules: [
        // Grupo 1: NEFROLITOTOMIA PERCUTÂNEA + Combinações
        {
          codes: ['04.09.01.023-5', '04.09.01.017-0'],
          totalValue: 1100.00,
          description: 'NEFROLITOTOMIA PERCUTÂNEA + INSTALAÇÃO ENDOSCÓPICA DE CATETER DUPLO J - R$ 1.100,00'
        },
        {
          codes: ['04.09.01.023-5', '04.09.01.014-6'],
          totalValue: 1300.00,
          description: 'NEFROLITOTOMIA PERCUTÂNEA + EXTRAÇÃO ENDOSCÓPICA DE CÁLCULO EM PELVE RENAL - R$ 1.300,00'
        },
        {
          codes: ['04.09.01.023-5', '04.09.01.017-0', '04.09.01.014-6'],
          totalValue: 1400.00,
          description: 'NEFROLITOTOMIA PERCUTÂNEA + INSTALAÇÃO ENDOSCÓPICA DE CATETER DUPLO J + EXTRAÇÃO ENDOSCÓPICA DE CÁLCULO EM PELVE RENAL - R$ 1.400,00'
        },
        {
          codes: ['04.09.01.023-5', '04.09.01.014-6', '04.09.01.059-6'],
          totalValue: 1500.00,
          description: 'NEFROLITOTOMIA PERCUTÂNEA + EXTRAÇÃO ENDOSCÓPICA DE CÁLCULO EM PELVE RENAL + URETEROLITOTRIPSIA TRANSURETEROSCÓPICA (FLEXÍVEL OU SEMIRRÍGIDA) - R$ 1.500,00'
        },
        {
          codes: ['04.09.01.023-5', '04.09.01.017-0', '04.09.01.014-6', '04.09.01.059-6'],
          totalValue: 1600.00,
          description: 'NEFROLITOTOMIA PERCUTÂNEA + INSTALAÇÃO ENDOSCÓPICA DE CATETER DUPLO J + EXTRAÇÃO ENDOSCÓPICA DE CÁLCULO EM PELVE RENAL + URETEROLITOTRIPSIA TRANSURETEROSCÓPICA (FLEXÍVEL OU SEMIRRÍGIDA) - R$ 1.600,00'
        },
        
        // Grupo 2: URETEROLITOTRIPSIA + Combinações
        {
          codes: ['04.09.01.059-6', '04.09.01.017-0'],
          totalValue: 1000.00,
          description: 'URETEROLITOTRIPSIA TRANSURETEROSCÓPICA + INSTALAÇÃO ENDOSCÓPICA DE CATETER DUPLO J (SEMIRRÍGIDA) - R$ 1.000,00'
        },
        
        // Grupo 3: LITOTRIPSIA (FLEXÍVEL) + Combinações
        {
          codes: ['04.09.01.018-9', '04.09.01.017-0'],
          totalValue: 1100.00,
          description: 'LITOTRIPSIA (FLEXÍVEL) + INSTALAÇÃO ENDOSCÓPICA DE CATETER DUPLO J - R$ 1.100,00'
        },
        {
          codes: ['04.09.01.018-9', '04.09.01.014-6', '04.09.01.017-0'],
          totalValue: 1200.00,
          description: 'LITOTRIPSIA (FLEXÍVEL) + EXTRAÇÃO ENDOSCÓPICA DE CÁLCULO EM PELVE RENAL + INSTALAÇÃO ENDOSCÓPICA DE CATETER DUPLO J - R$ 1.200,00'
        },
        {
          codes: ['04.09.01.018-9', '04.09.01.059-6', '04.09.01.014-6', '04.09.01.017-0'],
          totalValue: 1300.00,
          description: 'LITOTRIPSIA (FLEXÍVEL) + URETEROLITOTRIPSIA TRANSURETEROSCÓPICA (SEMIRRÍGIDA) + EXTRAÇÃO ENDOSCÓPICA DE CÁLCULO EM PELVE RENAL + INSTALAÇÃO ENDOSCÓPICA DE CATETER DUPLO J - R$ 1.300,00'
        },
        
        // Grupo 4: PRÓSTATA + Combinações
        {
          codes: ['04.09.03.004-0', '04.09.01.038-3'],
          totalValue: 1200.00,
          description: 'RESSECÇÃO ENDOSCÓPICA DE PRÓSTATA + RESSECÇÃO ENDOSCÓPICA DE LESÃO VESICAL - R$ 1.200,00'
        },
        
        // Grupo 5: HIDROCELE + Combinações
        {
          codes: ['04.09.04.021-5', '04.09.04.019-3'],
          totalValue: 400.00,
          description: 'TRATAMENTO CIRÚRGICO DE HIDROCELE + RESSECÇÃO PARCIAL DA BOLSA ESCROTAL - R$ 400,00'
        },
        {
          codes: ['04.09.04.021-5', '04.09.04.019-3', '04.09.04.017-7'],
          totalValue: 500.00,
          description: 'TRATAMENTO CIRÚRGICO DE HIDROCELE + RESSECÇÃO PARCIAL DA BOLSA ESCROTAL + PLÁSTICA DA BOLSA ESCROTAL - R$ 500,00'
        },
        
        // Grupo 6: ORQUIDOPEXIA + PLÁSTICA BOLSA ESCROTAL
        {
          codes: ['04.09.04.013-4', '04.09.04.017-7'],
          totalValue: 550.00,
          description: 'ORQUIDOPEXIA UNILATERAL + PLÁSTICA DA BOLSA ESCROTAL - R$ 550,00'
        },
        {
          codes: ['04.09.04.012-6', '04.09.04.017-7'],
          totalValue: 550.00,
          description: 'ORQUIDOPEXIA BILATERAL + PLÁSTICA DA BOLSA ESCROTAL - R$ 550,00'
        },
        
        // Grupo 7: PIELOPLASTIA + Combinações
        {
          codes: ['04.09.01.032-4', '04.09.01.057-0'],
          totalValue: 1000.00,
          description: 'PIELOPLASTIA + URETEROPLASTIA - R$ 1.000,00'
        },
        {
          codes: ['04.09.01.032-4', '04.09.01.057-0', '04.09.01.017-0'],
          totalValue: 1100.00,
          description: 'PIELOPLASTIA + URETEROPLASTIA + INSTALAÇÃO ENDOSCÓPICA DE CATETER DUPLO J - R$ 1.100,00'
        }
      ]
    },

    // ================================================================
    // DR. PEDRO HENRIQUE RODRIGUES - CIRURGIA VASCULAR
    // Hospital: Municipal São José (Carlópolis)
    // Especialidade: Cirurgia Vascular
    // Baseado em: Dr. PEDRO HENRIQUE RODRIGUES (Hospital 18 de Dezembro - Arapoti)
    // Data: 18/11/2025
    // ================================================================
    'PEDRO HENRIQUE RODRIGUES': {
      doctorName: 'PEDRO HENRIQUE RODRIGUES',
      // 🩺 PROCEDIMENTO DE CIRURGIA VASCULAR
      rules: [
        {
          procedureCode: '04.06.02.057-4',
          standardValue: 1100.00,
          description: 'TRATAMENTO CIRÚRGICO DE VARIZES (UNILATERAL) - R$ 1.100,00'
        }
      ]
    },

    // ================================================================
    // 💰 MÉDICOS COM PAGAMENTO FIXO MENSAL
    // Hospital: Municipal São José (Carlópolis)
    // Tipo: Valores fixos independentes de procedimentos
    // Data: 18/11/2025
    // ================================================================

    // ================================================================
    // DR. BRUNO BOSIO DA SILVA - PAGAMENTO FIXO MENSAL
    // ================================================================
    'BRUNO BOSIO DA SILVA': {
      doctorName: 'BRUNO BOSIO DA SILVA',
      fixedPaymentRule: {
        amount: 40000.00,
        description: 'PAGAMENTO FIXO MENSAL - R$ 40.000,00 (independente de procedimentos)'
      },
      rules: []
    },

    // ================================================================
    // DR. ORLANDO PAPI FERNANDES - PAGAMENTO FIXO MENSAL
    // ================================================================
    'ORLANDO PAPI FERNANDES': {
      doctorName: 'ORLANDO PAPI FERNANDES',
      fixedPaymentRule: {
        amount: 60000.00,
        description: 'PAGAMENTO FIXO MENSAL - R$ 60.000,00 (independente de procedimentos)'
      },
      rules: []
    },

    // ================================================================
    // DR. FERNANDO MERHI MANSUR - PAGAMENTO FIXO MENSAL
    // ================================================================
    'FERNANDO MERHI MANSUR': {
      doctorName: 'FERNANDO MERHI MANSUR',
      fixedPaymentRule: {
        amount: 29400.00,
        description: 'PAGAMENTO FIXO MENSAL - R$ 29.400,00 (independente de procedimentos)'
      },
      rules: []
    },

    // ================================================================
    // DR. BRUNO COLANZI DE MEDEIROS - PAGAMENTO FIXO MENSAL
    // ================================================================
    'BRUNO COLANZI DE MEDEIROS': {
      doctorName: 'BRUNO COLANZI DE MEDEIROS',
      fixedPaymentRule: {
        amount: 75000.00,
        description: 'PAGAMENTO FIXO MENSAL - R$ 75.000,00 (independente de procedimentos)'
      },
      rules: []
    },

    // ================================================================
    // DRA. MARIA EDUARDA CAETANO CLARO - PAGAMENTO FIXO MENSAL
    // ================================================================
    'MARIA EDUARDA CAETANO CLARO': {
      doctorName: 'MARIA EDUARDA CAETANO CLARO',
      fixedPaymentRule: {
        amount: 15000.00,
        description: 'PAGAMENTO FIXO MENSAL - R$ 15.000,00 (independente de procedimentos)'
      },
      rules: []
    }
  },

  // ================================================================
  // HOSPITAL NOSSA SENHORA APARECIDA - FOZ DO IGUAÇU
  // Hospital ID: 47eddf6e-ac64-4433-acc1-7b644a2b43d0
  // ================================================================
  'HOSPITAL_NOSSA_SENHORA_APARECIDA_FOZ': {
    // ================================================================
    // 🏥 CIRURGIÕES GERAIS - FOZ DO IGUAÇU
    // Baseado nas regras do Dr. JOAO VICTOR RODRIGUES (Torao Tokuda)
    // Data: Novembro 2025
    // Total: 5 médicos com mesmas regras
    // ================================================================
    
    'ALEXANDRE PORTELLA PLIACEKOS': {
      doctorName: 'ALEXANDRE PORTELLA PLIACEKOS',
      rules: [
        {
          procedureCode: '04.07.03.002-6',
          standardValue: 900.00,
          description: 'COLECISTECTOMIA (PRINCIPAL) - R$ 900,00'
        },
        {
          procedureCode: '04.07.04.018-8',
          standardValue: 300.00,
          description: 'LIBERAÇÃO DE ADERÊNCIAS INTESTINAIS - R$ 300,00'
        },
        {
          procedureCode: '04.07.04.002-1',
          standardValue: 300.00,
          description: 'DRENAGEM DE ABSCESSO SUBFRÊNICO - R$ 300,00'
        },
        {
          procedureCode: '04.07.03.014-0',
          standardValue: 300.00,
          description: 'HEPATORRAFIA - R$ 300,00'
        },
        {
          procedureCode: '04.07.03.006-9',
          standardValue: 250.00,
          description: 'COLEDOCOTOMIA - R$ 250,00'
        },
        {
          procedureCode: '04.07.03.005-0',
          standardValue: 200.00,
          description: 'COLEDOCOPLASTIA - R$ 200,00'
        },
        {
          procedureCode: '04.07.04.010-2',
          standardValue: 700.00,
          description: 'HERNIOPLASTIA INGUINAL UNILATERAL (PRINCIPAL) - R$ 700,00'
        },
        {
          procedureCode: '04.07.04.009-9',
          standardValue: 700.00,
          description: 'HERNIOPLASTIA INGUINAL BILATERAL (PRINCIPAL) - R$ 700,00'
        },
        {
          procedureCode: '04.07.04.006-4',
          standardValue: 800.00,
          description: 'HERNIOPLASTIA EPIGÁSTRICA (PRINCIPAL) - R$ 800,00'
        },
        {
          procedureCode: '04.07.04.012-9',
          standardValue: 450.00,
          description: 'HERNIOPLASTIA UMBILICAL (PRINCIPAL) - R$ 450,00'
        },
        {
          procedureCode: '04.07.04.008-0',
          standardValue: 600.00,
          description: 'HERNIOPLASTIA INCISIONAL/VENTRAL (PRINCIPAL) - R$ 600,00'
        },
        {
          procedureCode: '04.07.02.027-6',
          standardValue: 450.00,
          description: 'FISTULECTOMIA/FISTULOTOMIA ANAL - R$ 450,00'
        },
        {
          procedureCode: '04.07.02.028-4',
          standardValue: 450.00,
          description: 'HEMORROIDECTOMIA - R$ 450,00'
        },
        {
          procedureCode: '04.07.02.031-4',
          standardValue: 450.00,
          description: 'TRATAMENTO CIRÚRGICO DE FISSURA ANAL - R$ 450,00'
        },
        {
          procedureCode: '04.01.02.007-0',
          standardValue: 250.00,
          description: 'EXÉRESE DE CISTO DERMOIDE - R$ 250,00'
        },
        {
          procedureCode: '04.01.02.010-0',
          standardValue: 250.00,
          description: 'EXTIRPAÇÃO E SUPRESSÃO DE LESÃO DE PELE E DE TECIDO SUBCUTÂNEO - R$ 250,00'
        },
        {
          procedureCode: '04.01.02.008-8',
          standardValue: 250.00,
          description: 'EXÉRESE DE LIPOMA - R$ 250,00'
        },
        {
          procedureCode: '04.01.02.009-6',
          standardValue: 250.00,
          description: 'EXÉRESE DE CISTO PILONIDAL - R$ 250,00'
        }
      ],
      multipleRules: [
        { codes: ['04.07.03.002-6', '04.07.04.018-8'], totalValue: 1200.00, description: 'COLECISTECTOMIA + LIBERAÇÃO DE ADERÊNCIAS - R$ 1.200,00' },
        { codes: ['04.07.03.002-6', '04.07.04.002-1'], totalValue: 1200.00, description: 'COLECISTECTOMIA + DRENAGEM ABSCESSO SUBFRÊNICO - R$ 1.200,00' },
        { codes: ['04.07.03.002-6', '04.07.03.014-0'], totalValue: 1200.00, description: 'COLECISTECTOMIA + HEPATORRAFIA - R$ 1.200,00' },
        { codes: ['04.07.03.002-6', '04.07.03.006-9'], totalValue: 1150.00, description: 'COLECISTECTOMIA + COLEDOCOTOMIA - R$ 1.150,00' },
        { codes: ['04.07.03.002-6', '04.07.03.005-0'], totalValue: 1100.00, description: 'COLECISTECTOMIA + COLEDOCOPLASTIA - R$ 1.100,00' },
        { codes: ['04.07.03.002-6', '04.07.04.010-2'], totalValue: 1600.00, description: 'COLECISTECTOMIA + HERNIOPLASTIA INGUINAL UNILATERAL - R$ 1.600,00' },
        { codes: ['04.07.03.002-6', '04.07.04.009-9'], totalValue: 1600.00, description: 'COLECISTECTOMIA + HERNIOPLASTIA INGUINAL BILATERAL - R$ 1.600,00' },
        { codes: ['04.07.03.002-6', '04.07.04.006-4'], totalValue: 1700.00, description: 'COLECISTECTOMIA + HERNIOPLASTIA EPIGÁSTRICA - R$ 1.700,00' },
        { codes: ['04.07.03.002-6', '04.07.04.012-9'], totalValue: 1350.00, description: 'COLECISTECTOMIA + HERNIOPLASTIA UMBILICAL - R$ 1.350,00' },
        { codes: ['04.07.03.002-6', '04.07.04.008-0'], totalValue: 1500.00, description: 'COLECISTECTOMIA + HERNIOPLASTIA INCISIONAL/VENTRAL - R$ 1.500,00' },
        { codes: ['04.07.03.002-6', '04.07.04.018-8', '04.07.03.014-0'], totalValue: 1500.00, description: 'COLECISTECTOMIA + LIBERAÇÃO ADERÊNCIAS + HEPATORRAFIA - R$ 1.500,00' },
        { codes: ['04.07.03.002-6', '04.07.03.006-9', '04.07.03.005-0'], totalValue: 1350.00, description: 'COLECISTECTOMIA + COLEDOCOTOMIA + COLEDOCOPLASTIA - R$ 1.350,00' },
        { codes: ['04.07.03.002-6', '04.07.04.018-8', '04.07.03.014-0', '04.07.04.002-1'], totalValue: 1800.00, description: 'COLECISTECTOMIA + LIBERAÇÃO + HEPATORRAFIA + DRENAGEM - R$ 1.800,00' },
        { codes: ['04.07.03.002-6', '04.07.04.018-8', '04.07.03.014-0', '04.07.04.002-1', '04.07.03.006-9'], totalValue: 2050.00, description: 'COLECISTECTOMIA + 4 SEQUENCIAIS (MÁXIMO) - R$ 2.050,00' },
        { codes: ['04.07.04.010-2', '04.07.04.009-9'], totalValue: 1000.00, description: 'INGUINAL UNILATERAL (1ª) + INGUINAL BILATERAL (2ª) - R$ 1.000,00' },
        { codes: ['04.07.04.010-2', '04.07.04.006-4'], totalValue: 1000.00, description: 'INGUINAL UNILATERAL (1ª) + EPIGÁSTRICA (2ª) - R$ 1.000,00' },
        { codes: ['04.07.04.010-2', '04.07.04.012-9'], totalValue: 1000.00, description: 'INGUINAL UNILATERAL (1ª) + UMBILICAL (2ª) - R$ 1.000,00' },
        { codes: ['04.07.04.010-2', '04.07.04.008-0'], totalValue: 1000.00, description: 'INGUINAL UNILATERAL (1ª) + INCISIONAL/VENTRAL (2ª) - R$ 1.000,00' },
        { codes: ['04.07.04.009-9', '04.07.04.010-2'], totalValue: 1000.00, description: 'INGUINAL BILATERAL (1ª) + INGUINAL UNILATERAL (2ª) - R$ 1.000,00' },
        { codes: ['04.07.04.009-9', '04.07.04.006-4'], totalValue: 1000.00, description: 'INGUINAL BILATERAL (1ª) + EPIGÁSTRICA (2ª) - R$ 1.000,00' },
        { codes: ['04.07.04.009-9', '04.07.04.012-9'], totalValue: 1000.00, description: 'INGUINAL BILATERAL (1ª) + UMBILICAL (2ª) - R$ 1.000,00' },
        { codes: ['04.07.04.009-9', '04.07.04.008-0'], totalValue: 1000.00, description: 'INGUINAL BILATERAL (1ª) + INCISIONAL/VENTRAL (2ª) - R$ 1.000,00' },
        { codes: ['04.07.04.006-4', '04.07.04.010-2'], totalValue: 1100.00, description: 'EPIGÁSTRICA (1ª) + INGUINAL UNILATERAL (2ª) - R$ 1.100,00' },
        { codes: ['04.07.04.006-4', '04.07.04.009-9'], totalValue: 1100.00, description: 'EPIGÁSTRICA (1ª) + INGUINAL BILATERAL (2ª) - R$ 1.100,00' },
        { codes: ['04.07.04.006-4', '04.07.04.012-9'], totalValue: 1100.00, description: 'EPIGÁSTRICA (1ª) + UMBILICAL (2ª) - R$ 1.100,00' },
        { codes: ['04.07.04.006-4', '04.07.04.008-0'], totalValue: 1100.00, description: 'EPIGÁSTRICA (1ª) + INCISIONAL/VENTRAL (2ª) - R$ 1.100,00' },
        { codes: ['04.07.04.012-9', '04.07.04.010-2'], totalValue: 750.00, description: 'UMBILICAL (1ª) + INGUINAL UNILATERAL (2ª) - R$ 750,00' },
        { codes: ['04.07.04.012-9', '04.07.04.009-9'], totalValue: 750.00, description: 'UMBILICAL (1ª) + INGUINAL BILATERAL (2ª) - R$ 750,00' },
        { codes: ['04.07.04.012-9', '04.07.04.006-4'], totalValue: 750.00, description: 'UMBILICAL (1ª) + EPIGÁSTRICA (2ª) - R$ 750,00' },
        { codes: ['04.07.04.012-9', '04.07.04.008-0'], totalValue: 750.00, description: 'UMBILICAL (1ª) + INCISIONAL/VENTRAL (2ª) - R$ 750,00' },
        { codes: ['04.07.04.008-0', '04.07.04.010-2'], totalValue: 900.00, description: 'INCISIONAL/VENTRAL (1ª) + INGUINAL UNILATERAL (2ª) - R$ 900,00' },
        { codes: ['04.07.04.008-0', '04.07.04.009-9'], totalValue: 900.00, description: 'INCISIONAL/VENTRAL (1ª) + INGUINAL BILATERAL (2ª) - R$ 900,00' },
        { codes: ['04.07.04.008-0', '04.07.04.006-4'], totalValue: 900.00, description: 'INCISIONAL/VENTRAL (1ª) + EPIGÁSTRICA (2ª) - R$ 900,00' },
        { codes: ['04.07.04.008-0', '04.07.04.012-9'], totalValue: 900.00, description: 'INCISIONAL/VENTRAL (1ª) + UMBILICAL (2ª) - R$ 900,00' },
        { codes: ['04.07.04.006-4', '04.07.04.010-2', '04.07.04.012-9'], totalValue: 1400.00, description: 'EPIGÁSTRICA (1ª) + INGUINAL UNILATERAL (2ª) + UMBILICAL (3ª) - R$ 1.400,00' },
        { codes: ['04.07.04.006-4', '04.07.04.009-9', '04.07.04.012-9'], totalValue: 1400.00, description: 'EPIGÁSTRICA (1ª) + INGUINAL BILATERAL (2ª) + UMBILICAL (3ª) - R$ 1.400,00' },
        { codes: ['04.07.04.010-2', '04.07.04.012-9', '04.07.04.008-0'], totalValue: 1300.00, description: 'INGUINAL UNILATERAL (1ª) + UMBILICAL (2ª) + INCISIONAL (3ª) - R$ 1.300,00' },
        { codes: ['04.07.04.006-4', '04.07.04.010-2', '04.07.04.012-9', '04.07.04.008-0'], totalValue: 1700.00, description: 'EPIGÁSTRICA (1ª) + INGUINAL UNI (2ª) + UMBILICAL (3ª) + INCISIONAL (4ª) - R$ 1.700,00' }
      ]
    },

    'ISIDORO ANTONIO VILLAMAYOR ALVAREZ': {
      doctorName: 'ISIDORO ANTONIO VILLAMAYOR ALVAREZ',
      rules: [
        { procedureCode: '04.07.03.002-6', standardValue: 900.00, description: 'COLECISTECTOMIA (PRINCIPAL) - R$ 900,00' },
        { procedureCode: '04.07.04.018-8', standardValue: 300.00, description: 'LIBERAÇÃO DE ADERÊNCIAS INTESTINAIS - R$ 300,00' },
        { procedureCode: '04.07.04.002-1', standardValue: 300.00, description: 'DRENAGEM DE ABSCESSO SUBFRÊNICO - R$ 300,00' },
        { procedureCode: '04.07.03.014-0', standardValue: 300.00, description: 'HEPATORRAFIA - R$ 300,00' },
        { procedureCode: '04.07.03.006-9', standardValue: 250.00, description: 'COLEDOCOTOMIA - R$ 250,00' },
        { procedureCode: '04.07.03.005-0', standardValue: 200.00, description: 'COLEDOCOPLASTIA - R$ 200,00' },
        { procedureCode: '04.07.04.010-2', standardValue: 700.00, description: 'HERNIOPLASTIA INGUINAL UNILATERAL (PRINCIPAL) - R$ 700,00' },
        { procedureCode: '04.07.04.009-9', standardValue: 700.00, description: 'HERNIOPLASTIA INGUINAL BILATERAL (PRINCIPAL) - R$ 700,00' },
        { procedureCode: '04.07.04.006-4', standardValue: 800.00, description: 'HERNIOPLASTIA EPIGÁSTRICA (PRINCIPAL) - R$ 800,00' },
        { procedureCode: '04.07.04.012-9', standardValue: 450.00, description: 'HERNIOPLASTIA UMBILICAL (PRINCIPAL) - R$ 450,00' },
        { procedureCode: '04.07.04.008-0', standardValue: 600.00, description: 'HERNIOPLASTIA INCISIONAL/VENTRAL (PRINCIPAL) - R$ 600,00' },
        { procedureCode: '04.07.02.027-6', standardValue: 450.00, description: 'FISTULECTOMIA/FISTULOTOMIA ANAL - R$ 450,00' },
        { procedureCode: '04.07.02.028-4', standardValue: 450.00, description: 'HEMORROIDECTOMIA - R$ 450,00' },
        { procedureCode: '04.07.02.031-4', standardValue: 450.00, description: 'TRATAMENTO CIRÚRGICO DE FISSURA ANAL - R$ 450,00' },
        { procedureCode: '04.01.02.007-0', standardValue: 250.00, description: 'EXÉRESE DE CISTO DERMOIDE - R$ 250,00' },
        { procedureCode: '04.01.02.010-0', standardValue: 250.00, description: 'EXTIRPAÇÃO E SUPRESSÃO DE LESÃO DE PELE E DE TECIDO SUBCUTÂNEO - R$ 250,00' },
        { procedureCode: '04.01.02.008-8', standardValue: 250.00, description: 'EXÉRESE DE LIPOMA - R$ 250,00' },
        { procedureCode: '04.01.02.009-6', standardValue: 250.00, description: 'EXÉRESE DE CISTO PILONIDAL - R$ 250,00' }
      ],
      multipleRules: [
        { codes: ['04.07.03.002-6', '04.07.04.018-8'], totalValue: 1200.00, description: 'COLECISTECTOMIA + LIBERAÇÃO DE ADERÊNCIAS - R$ 1.200,00' },
        { codes: ['04.07.03.002-6', '04.07.04.002-1'], totalValue: 1200.00, description: 'COLECISTECTOMIA + DRENAGEM ABSCESSO SUBFRÊNICO - R$ 1.200,00' },
        { codes: ['04.07.03.002-6', '04.07.03.014-0'], totalValue: 1200.00, description: 'COLECISTECTOMIA + HEPATORRAFIA - R$ 1.200,00' },
        { codes: ['04.07.03.002-6', '04.07.03.006-9'], totalValue: 1150.00, description: 'COLECISTECTOMIA + COLEDOCOTOMIA - R$ 1.150,00' },
        { codes: ['04.07.03.002-6', '04.07.03.005-0'], totalValue: 1100.00, description: 'COLECISTECTOMIA + COLEDOCOPLASTIA - R$ 1.100,00' },
        { codes: ['04.07.03.002-6', '04.07.04.010-2'], totalValue: 1600.00, description: 'COLECISTECTOMIA + HERNIOPLASTIA INGUINAL UNILATERAL - R$ 1.600,00' },
        { codes: ['04.07.03.002-6', '04.07.04.009-9'], totalValue: 1600.00, description: 'COLECISTECTOMIA + HERNIOPLASTIA INGUINAL BILATERAL - R$ 1.600,00' },
        { codes: ['04.07.03.002-6', '04.07.04.006-4'], totalValue: 1700.00, description: 'COLECISTECTOMIA + HERNIOPLASTIA EPIGÁSTRICA - R$ 1.700,00' },
        { codes: ['04.07.03.002-6', '04.07.04.012-9'], totalValue: 1350.00, description: 'COLECISTECTOMIA + HERNIOPLASTIA UMBILICAL - R$ 1.350,00' },
        { codes: ['04.07.03.002-6', '04.07.04.008-0'], totalValue: 1500.00, description: 'COLECISTECTOMIA + HERNIOPLASTIA INCISIONAL/VENTRAL - R$ 1.500,00' },
        { codes: ['04.07.03.002-6', '04.07.04.018-8', '04.07.03.014-0'], totalValue: 1500.00, description: 'COLECISTECTOMIA + LIBERAÇÃO ADERÊNCIAS + HEPATORRAFIA - R$ 1.500,00' },
        { codes: ['04.07.03.002-6', '04.07.03.006-9', '04.07.03.005-0'], totalValue: 1350.00, description: 'COLECISTECTOMIA + COLEDOCOTOMIA + COLEDOCOPLASTIA - R$ 1.350,00' },
        { codes: ['04.07.03.002-6', '04.07.04.018-8', '04.07.03.014-0', '04.07.04.002-1'], totalValue: 1800.00, description: 'COLECISTECTOMIA + LIBERAÇÃO + HEPATORRAFIA + DRENAGEM - R$ 1.800,00' },
        { codes: ['04.07.03.002-6', '04.07.04.018-8', '04.07.03.014-0', '04.07.04.002-1', '04.07.03.006-9'], totalValue: 2050.00, description: 'COLECISTECTOMIA + 4 SEQUENCIAIS (MÁXIMO) - R$ 2.050,00' },
        { codes: ['04.07.04.010-2', '04.07.04.009-9'], totalValue: 1000.00, description: 'INGUINAL UNILATERAL (1ª) + INGUINAL BILATERAL (2ª) - R$ 1.000,00' },
        { codes: ['04.07.04.010-2', '04.07.04.006-4'], totalValue: 1000.00, description: 'INGUINAL UNILATERAL (1ª) + EPIGÁSTRICA (2ª) - R$ 1.000,00' },
        { codes: ['04.07.04.010-2', '04.07.04.012-9'], totalValue: 1000.00, description: 'INGUINAL UNILATERAL (1ª) + UMBILICAL (2ª) - R$ 1.000,00' },
        { codes: ['04.07.04.010-2', '04.07.04.008-0'], totalValue: 1000.00, description: 'INGUINAL UNILATERAL (1ª) + INCISIONAL/VENTRAL (2ª) - R$ 1.000,00' },
        { codes: ['04.07.04.009-9', '04.07.04.010-2'], totalValue: 1000.00, description: 'INGUINAL BILATERAL (1ª) + INGUINAL UNILATERAL (2ª) - R$ 1.000,00' },
        { codes: ['04.07.04.009-9', '04.07.04.006-4'], totalValue: 1000.00, description: 'INGUINAL BILATERAL (1ª) + EPIGÁSTRICA (2ª) - R$ 1.000,00' },
        { codes: ['04.07.04.009-9', '04.07.04.012-9'], totalValue: 1000.00, description: 'INGUINAL BILATERAL (1ª) + UMBILICAL (2ª) - R$ 1.000,00' },
        { codes: ['04.07.04.009-9', '04.07.04.008-0'], totalValue: 1000.00, description: 'INGUINAL BILATERAL (1ª) + INCISIONAL/VENTRAL (2ª) - R$ 1.000,00' },
        { codes: ['04.07.04.006-4', '04.07.04.010-2'], totalValue: 1100.00, description: 'EPIGÁSTRICA (1ª) + INGUINAL UNILATERAL (2ª) - R$ 1.100,00' },
        { codes: ['04.07.04.006-4', '04.07.04.009-9'], totalValue: 1100.00, description: 'EPIGÁSTRICA (1ª) + INGUINAL BILATERAL (2ª) - R$ 1.100,00' },
        { codes: ['04.07.04.006-4', '04.07.04.012-9'], totalValue: 1100.00, description: 'EPIGÁSTRICA (1ª) + UMBILICAL (2ª) - R$ 1.100,00' },
        { codes: ['04.07.04.006-4', '04.07.04.008-0'], totalValue: 1100.00, description: 'EPIGÁSTRICA (1ª) + INCISIONAL/VENTRAL (2ª) - R$ 1.100,00' },
        { codes: ['04.07.04.012-9', '04.07.04.010-2'], totalValue: 750.00, description: 'UMBILICAL (1ª) + INGUINAL UNILATERAL (2ª) - R$ 750,00' },
        { codes: ['04.07.04.012-9', '04.07.04.009-9'], totalValue: 750.00, description: 'UMBILICAL (1ª) + INGUINAL BILATERAL (2ª) - R$ 750,00' },
        { codes: ['04.07.04.012-9', '04.07.04.006-4'], totalValue: 750.00, description: 'UMBILICAL (1ª) + EPIGÁSTRICA (2ª) - R$ 750,00' },
        { codes: ['04.07.04.012-9', '04.07.04.008-0'], totalValue: 750.00, description: 'UMBILICAL (1ª) + INCISIONAL/VENTRAL (2ª) - R$ 750,00' },
        { codes: ['04.07.04.008-0', '04.07.04.010-2'], totalValue: 900.00, description: 'INCISIONAL/VENTRAL (1ª) + INGUINAL UNILATERAL (2ª) - R$ 900,00' },
        { codes: ['04.07.04.008-0', '04.07.04.009-9'], totalValue: 900.00, description: 'INCISIONAL/VENTRAL (1ª) + INGUINAL BILATERAL (2ª) - R$ 900,00' },
        { codes: ['04.07.04.008-0', '04.07.04.006-4'], totalValue: 900.00, description: 'INCISIONAL/VENTRAL (1ª) + EPIGÁSTRICA (2ª) - R$ 900,00' },
        { codes: ['04.07.04.008-0', '04.07.04.012-9'], totalValue: 900.00, description: 'INCISIONAL/VENTRAL (1ª) + UMBILICAL (2ª) - R$ 900,00' },
        { codes: ['04.07.04.006-4', '04.07.04.010-2', '04.07.04.012-9'], totalValue: 1400.00, description: 'EPIGÁSTRICA (1ª) + INGUINAL UNILATERAL (2ª) + UMBILICAL (3ª) - R$ 1.400,00' },
        { codes: ['04.07.04.006-4', '04.07.04.009-9', '04.07.04.012-9'], totalValue: 1400.00, description: 'EPIGÁSTRICA (1ª) + INGUINAL BILATERAL (2ª) + UMBILICAL (3ª) - R$ 1.400,00' },
        { codes: ['04.07.04.010-2', '04.07.04.012-9', '04.07.04.008-0'], totalValue: 1300.00, description: 'INGUINAL UNILATERAL (1ª) + UMBILICAL (2ª) + INCISIONAL (3ª) - R$ 1.300,00' },
        { codes: ['04.07.04.006-4', '04.07.04.010-2', '04.07.04.012-9', '04.07.04.008-0'], totalValue: 1700.00, description: 'EPIGÁSTRICA (1ª) + INGUINAL UNI (2ª) + UMBILICAL (3ª) + INCISIONAL (4ª) - R$ 1.700,00' }
      ]
    },

    'JOSE LUIZ BERTOLI NETO': {
      doctorName: 'JOSE LUIZ BERTOLI NETO',
      rules: [
        { procedureCode: '04.07.03.002-6', standardValue: 900.00, description: 'COLECISTECTOMIA (PRINCIPAL) - R$ 900,00' },
        { procedureCode: '04.07.04.018-8', standardValue: 300.00, description: 'LIBERAÇÃO DE ADERÊNCIAS INTESTINAIS - R$ 300,00' },
        { procedureCode: '04.07.04.002-1', standardValue: 300.00, description: 'DRENAGEM DE ABSCESSO SUBFRÊNICO - R$ 300,00' },
        { procedureCode: '04.07.03.014-0', standardValue: 300.00, description: 'HEPATORRAFIA - R$ 300,00' },
        { procedureCode: '04.07.03.006-9', standardValue: 250.00, description: 'COLEDOCOTOMIA - R$ 250,00' },
        { procedureCode: '04.07.03.005-0', standardValue: 200.00, description: 'COLEDOCOPLASTIA - R$ 200,00' },
        { procedureCode: '04.07.04.010-2', standardValue: 700.00, description: 'HERNIOPLASTIA INGUINAL UNILATERAL (PRINCIPAL) - R$ 700,00' },
        { procedureCode: '04.07.04.009-9', standardValue: 700.00, description: 'HERNIOPLASTIA INGUINAL BILATERAL (PRINCIPAL) - R$ 700,00' },
        { procedureCode: '04.07.04.006-4', standardValue: 800.00, description: 'HERNIOPLASTIA EPIGÁSTRICA (PRINCIPAL) - R$ 800,00' },
        { procedureCode: '04.07.04.012-9', standardValue: 450.00, description: 'HERNIOPLASTIA UMBILICAL (PRINCIPAL) - R$ 450,00' },
        { procedureCode: '04.07.04.008-0', standardValue: 600.00, description: 'HERNIOPLASTIA INCISIONAL/VENTRAL (PRINCIPAL) - R$ 600,00' },
        { procedureCode: '04.07.02.027-6', standardValue: 450.00, description: 'FISTULECTOMIA/FISTULOTOMIA ANAL - R$ 450,00' },
        { procedureCode: '04.07.02.028-4', standardValue: 450.00, description: 'HEMORROIDECTOMIA - R$ 450,00' },
        { procedureCode: '04.07.02.031-4', standardValue: 450.00, description: 'TRATAMENTO CIRÚRGICO DE FISSURA ANAL - R$ 450,00' },
        { procedureCode: '04.01.02.007-0', standardValue: 250.00, description: 'EXÉRESE DE CISTO DERMOIDE - R$ 250,00' },
        { procedureCode: '04.01.02.010-0', standardValue: 250.00, description: 'EXTIRPAÇÃO E SUPRESSÃO DE LESÃO DE PELE E DE TECIDO SUBCUTÂNEO - R$ 250,00' },
        { procedureCode: '04.01.02.008-8', standardValue: 250.00, description: 'EXÉRESE DE LIPOMA - R$ 250,00' },
        { procedureCode: '04.01.02.009-6', standardValue: 250.00, description: 'EXÉRESE DE CISTO PILONIDAL - R$ 250,00' }
      ],
      multipleRules: [
        { codes: ['04.07.03.002-6', '04.07.04.018-8'], totalValue: 1200.00, description: 'COLECISTECTOMIA + LIBERAÇÃO DE ADERÊNCIAS - R$ 1.200,00' },
        { codes: ['04.07.03.002-6', '04.07.04.002-1'], totalValue: 1200.00, description: 'COLECISTECTOMIA + DRENAGEM ABSCESSO SUBFRÊNICO - R$ 1.200,00' },
        { codes: ['04.07.03.002-6', '04.07.03.014-0'], totalValue: 1200.00, description: 'COLECISTECTOMIA + HEPATORRAFIA - R$ 1.200,00' },
        { codes: ['04.07.03.002-6', '04.07.03.006-9'], totalValue: 1150.00, description: 'COLECISTECTOMIA + COLEDOCOTOMIA - R$ 1.150,00' },
        { codes: ['04.07.03.002-6', '04.07.03.005-0'], totalValue: 1100.00, description: 'COLECISTECTOMIA + COLEDOCOPLASTIA - R$ 1.100,00' },
        { codes: ['04.07.03.002-6', '04.07.04.010-2'], totalValue: 1600.00, description: 'COLECISTECTOMIA + HERNIOPLASTIA INGUINAL UNILATERAL - R$ 1.600,00' },
        { codes: ['04.07.03.002-6', '04.07.04.009-9'], totalValue: 1600.00, description: 'COLECISTECTOMIA + HERNIOPLASTIA INGUINAL BILATERAL - R$ 1.600,00' },
        { codes: ['04.07.03.002-6', '04.07.04.006-4'], totalValue: 1700.00, description: 'COLECISTECTOMIA + HERNIOPLASTIA EPIGÁSTRICA - R$ 1.700,00' },
        { codes: ['04.07.03.002-6', '04.07.04.012-9'], totalValue: 1350.00, description: 'COLECISTECTOMIA + HERNIOPLASTIA UMBILICAL - R$ 1.350,00' },
        { codes: ['04.07.03.002-6', '04.07.04.008-0'], totalValue: 1500.00, description: 'COLECISTECTOMIA + HERNIOPLASTIA INCISIONAL/VENTRAL - R$ 1.500,00' },
        { codes: ['04.07.03.002-6', '04.07.04.018-8', '04.07.03.014-0'], totalValue: 1500.00, description: 'COLECISTECTOMIA + LIBERAÇÃO ADERÊNCIAS + HEPATORRAFIA - R$ 1.500,00' },
        { codes: ['04.07.03.002-6', '04.07.03.006-9', '04.07.03.005-0'], totalValue: 1350.00, description: 'COLECISTECTOMIA + COLEDOCOTOMIA + COLEDOCOPLASTIA - R$ 1.350,00' },
        { codes: ['04.07.03.002-6', '04.07.04.018-8', '04.07.03.014-0', '04.07.04.002-1'], totalValue: 1800.00, description: 'COLECISTECTOMIA + LIBERAÇÃO + HEPATORRAFIA + DRENAGEM - R$ 1.800,00' },
        { codes: ['04.07.03.002-6', '04.07.04.018-8', '04.07.03.014-0', '04.07.04.002-1', '04.07.03.006-9'], totalValue: 2050.00, description: 'COLECISTECTOMIA + 4 SEQUENCIAIS (MÁXIMO) - R$ 2.050,00' },
        { codes: ['04.07.04.010-2', '04.07.04.009-9'], totalValue: 1000.00, description: 'INGUINAL UNILATERAL (1ª) + INGUINAL BILATERAL (2ª) - R$ 1.000,00' },
        { codes: ['04.07.04.010-2', '04.07.04.006-4'], totalValue: 1000.00, description: 'INGUINAL UNILATERAL (1ª) + EPIGÁSTRICA (2ª) - R$ 1.000,00' },
        { codes: ['04.07.04.010-2', '04.07.04.012-9'], totalValue: 1000.00, description: 'INGUINAL UNILATERAL (1ª) + UMBILICAL (2ª) - R$ 1.000,00' },
        { codes: ['04.07.04.010-2', '04.07.04.008-0'], totalValue: 1000.00, description: 'INGUINAL UNILATERAL (1ª) + INCISIONAL/VENTRAL (2ª) - R$ 1.000,00' },
        { codes: ['04.07.04.009-9', '04.07.04.010-2'], totalValue: 1000.00, description: 'INGUINAL BILATERAL (1ª) + INGUINAL UNILATERAL (2ª) - R$ 1.000,00' },
        { codes: ['04.07.04.009-9', '04.07.04.006-4'], totalValue: 1000.00, description: 'INGUINAL BILATERAL (1ª) + EPIGÁSTRICA (2ª) - R$ 1.000,00' },
        { codes: ['04.07.04.009-9', '04.07.04.012-9'], totalValue: 1000.00, description: 'INGUINAL BILATERAL (1ª) + UMBILICAL (2ª) - R$ 1.000,00' },
        { codes: ['04.07.04.009-9', '04.07.04.008-0'], totalValue: 1000.00, description: 'INGUINAL BILATERAL (1ª) + INCISIONAL/VENTRAL (2ª) - R$ 1.000,00' },
        { codes: ['04.07.04.006-4', '04.07.04.010-2'], totalValue: 1100.00, description: 'EPIGÁSTRICA (1ª) + INGUINAL UNILATERAL (2ª) - R$ 1.100,00' },
        { codes: ['04.07.04.006-4', '04.07.04.009-9'], totalValue: 1100.00, description: 'EPIGÁSTRICA (1ª) + INGUINAL BILATERAL (2ª) - R$ 1.100,00' },
        { codes: ['04.07.04.006-4', '04.07.04.012-9'], totalValue: 1100.00, description: 'EPIGÁSTRICA (1ª) + UMBILICAL (2ª) - R$ 1.100,00' },
        { codes: ['04.07.04.006-4', '04.07.04.008-0'], totalValue: 1100.00, description: 'EPIGÁSTRICA (1ª) + INCISIONAL/VENTRAL (2ª) - R$ 1.100,00' },
        { codes: ['04.07.04.012-9', '04.07.04.010-2'], totalValue: 750.00, description: 'UMBILICAL (1ª) + INGUINAL UNILATERAL (2ª) - R$ 750,00' },
        { codes: ['04.07.04.012-9', '04.07.04.009-9'], totalValue: 750.00, description: 'UMBILICAL (1ª) + INGUINAL BILATERAL (2ª) - R$ 750,00' },
        { codes: ['04.07.04.012-9', '04.07.04.006-4'], totalValue: 750.00, description: 'UMBILICAL (1ª) + EPIGÁSTRICA (2ª) - R$ 750,00' },
        { codes: ['04.07.04.012-9', '04.07.04.008-0'], totalValue: 750.00, description: 'UMBILICAL (1ª) + INCISIONAL/VENTRAL (2ª) - R$ 750,00' },
        { codes: ['04.07.04.008-0', '04.07.04.010-2'], totalValue: 900.00, description: 'INCISIONAL/VENTRAL (1ª) + INGUINAL UNILATERAL (2ª) - R$ 900,00' },
        { codes: ['04.07.04.008-0', '04.07.04.009-9'], totalValue: 900.00, description: 'INCISIONAL/VENTRAL (1ª) + INGUINAL BILATERAL (2ª) - R$ 900,00' },
        { codes: ['04.07.04.008-0', '04.07.04.006-4'], totalValue: 900.00, description: 'INCISIONAL/VENTRAL (1ª) + EPIGÁSTRICA (2ª) - R$ 900,00' },
        { codes: ['04.07.04.008-0', '04.07.04.012-9'], totalValue: 900.00, description: 'INCISIONAL/VENTRAL (1ª) + UMBILICAL (2ª) - R$ 900,00' },
        { codes: ['04.07.04.006-4', '04.07.04.010-2', '04.07.04.012-9'], totalValue: 1400.00, description: 'EPIGÁSTRICA (1ª) + INGUINAL UNILATERAL (2ª) + UMBILICAL (3ª) - R$ 1.400,00' },
        { codes: ['04.07.04.006-4', '04.07.04.009-9', '04.07.04.012-9'], totalValue: 1400.00, description: 'EPIGÁSTRICA (1ª) + INGUINAL BILATERAL (2ª) + UMBILICAL (3ª) - R$ 1.400,00' },
        { codes: ['04.07.04.010-2', '04.07.04.012-9', '04.07.04.008-0'], totalValue: 1300.00, description: 'INGUINAL UNILATERAL (1ª) + UMBILICAL (2ª) + INCISIONAL (3ª) - R$ 1.300,00' },
        { codes: ['04.07.04.006-4', '04.07.04.010-2', '04.07.04.012-9', '04.07.04.008-0'], totalValue: 1700.00, description: 'EPIGÁSTRICA (1ª) + INGUINAL UNI (2ª) + UMBILICAL (3ª) + INCISIONAL (4ª) - R$ 1.700,00' }
      ]
    },

    'PAULO RODOLPHO CAMARGO': {
      doctorName: 'PAULO RODOLPHO CAMARGO',
      rules: [
        { procedureCode: '04.07.03.002-6', standardValue: 900.00, description: 'COLECISTECTOMIA (PRINCIPAL) - R$ 900,00' },
        { procedureCode: '04.07.04.018-8', standardValue: 300.00, description: 'LIBERAÇÃO DE ADERÊNCIAS INTESTINAIS - R$ 300,00' },
        { procedureCode: '04.07.04.002-1', standardValue: 300.00, description: 'DRENAGEM DE ABSCESSO SUBFRÊNICO - R$ 300,00' },
        { procedureCode: '04.07.03.014-0', standardValue: 300.00, description: 'HEPATORRAFIA - R$ 300,00' },
        { procedureCode: '04.07.03.006-9', standardValue: 250.00, description: 'COLEDOCOTOMIA - R$ 250,00' },
        { procedureCode: '04.07.03.005-0', standardValue: 200.00, description: 'COLEDOCOPLASTIA - R$ 200,00' },
        { procedureCode: '04.07.04.010-2', standardValue: 700.00, description: 'HERNIOPLASTIA INGUINAL UNILATERAL (PRINCIPAL) - R$ 700,00' },
        { procedureCode: '04.07.04.009-9', standardValue: 700.00, description: 'HERNIOPLASTIA INGUINAL BILATERAL (PRINCIPAL) - R$ 700,00' },
        { procedureCode: '04.07.04.006-4', standardValue: 800.00, description: 'HERNIOPLASTIA EPIGÁSTRICA (PRINCIPAL) - R$ 800,00' },
        { procedureCode: '04.07.04.012-9', standardValue: 450.00, description: 'HERNIOPLASTIA UMBILICAL (PRINCIPAL) - R$ 450,00' },
        { procedureCode: '04.07.04.008-0', standardValue: 600.00, description: 'HERNIOPLASTIA INCISIONAL/VENTRAL (PRINCIPAL) - R$ 600,00' },
        { procedureCode: '04.07.02.027-6', standardValue: 450.00, description: 'FISTULECTOMIA/FISTULOTOMIA ANAL - R$ 450,00' },
        { procedureCode: '04.07.02.028-4', standardValue: 450.00, description: 'HEMORROIDECTOMIA - R$ 450,00' },
        { procedureCode: '04.07.02.031-4', standardValue: 450.00, description: 'TRATAMENTO CIRÚRGICO DE FISSURA ANAL - R$ 450,00' },
        { procedureCode: '04.01.02.007-0', standardValue: 250.00, description: 'EXÉRESE DE CISTO DERMOIDE - R$ 250,00' },
        { procedureCode: '04.01.02.010-0', standardValue: 250.00, description: 'EXTIRPAÇÃO E SUPRESSÃO DE LESÃO DE PELE E DE TECIDO SUBCUTÂNEO - R$ 250,00' },
        { procedureCode: '04.01.02.008-8', standardValue: 250.00, description: 'EXÉRESE DE LIPOMA - R$ 250,00' },
        { procedureCode: '04.01.02.009-6', standardValue: 250.00, description: 'EXÉRESE DE CISTO PILONIDAL - R$ 250,00' }
      ],
      multipleRules: [
        { codes: ['04.07.03.002-6', '04.07.04.018-8'], totalValue: 1200.00, description: 'COLECISTECTOMIA + LIBERAÇÃO DE ADERÊNCIAS - R$ 1.200,00' },
        { codes: ['04.07.03.002-6', '04.07.04.002-1'], totalValue: 1200.00, description: 'COLECISTECTOMIA + DRENAGEM ABSCESSO SUBFRÊNICO - R$ 1.200,00' },
        { codes: ['04.07.03.002-6', '04.07.03.014-0'], totalValue: 1200.00, description: 'COLECISTECTOMIA + HEPATORRAFIA - R$ 1.200,00' },
        { codes: ['04.07.03.002-6', '04.07.03.006-9'], totalValue: 1150.00, description: 'COLECISTECTOMIA + COLEDOCOTOMIA - R$ 1.150,00' },
        { codes: ['04.07.03.002-6', '04.07.03.005-0'], totalValue: 1100.00, description: 'COLECISTECTOMIA + COLEDOCOPLASTIA - R$ 1.100,00' },
        { codes: ['04.07.03.002-6', '04.07.04.010-2'], totalValue: 1600.00, description: 'COLECISTECTOMIA + HERNIOPLASTIA INGUINAL UNILATERAL - R$ 1.600,00' },
        { codes: ['04.07.03.002-6', '04.07.04.009-9'], totalValue: 1600.00, description: 'COLECISTECTOMIA + HERNIOPLASTIA INGUINAL BILATERAL - R$ 1.600,00' },
        { codes: ['04.07.03.002-6', '04.07.04.006-4'], totalValue: 1700.00, description: 'COLECISTECTOMIA + HERNIOPLASTIA EPIGÁSTRICA - R$ 1.700,00' },
        { codes: ['04.07.03.002-6', '04.07.04.012-9'], totalValue: 1350.00, description: 'COLECISTECTOMIA + HERNIOPLASTIA UMBILICAL - R$ 1.350,00' },
        { codes: ['04.07.03.002-6', '04.07.04.008-0'], totalValue: 1500.00, description: 'COLECISTECTOMIA + HERNIOPLASTIA INCISIONAL/VENTRAL - R$ 1.500,00' },
        { codes: ['04.07.03.002-6', '04.07.04.018-8', '04.07.03.014-0'], totalValue: 1500.00, description: 'COLECISTECTOMIA + LIBERAÇÃO ADERÊNCIAS + HEPATORRAFIA - R$ 1.500,00' },
        { codes: ['04.07.03.002-6', '04.07.03.006-9', '04.07.03.005-0'], totalValue: 1350.00, description: 'COLECISTECTOMIA + COLEDOCOTOMIA + COLEDOCOPLASTIA - R$ 1.350,00' },
        { codes: ['04.07.03.002-6', '04.07.04.018-8', '04.07.03.014-0', '04.07.04.002-1'], totalValue: 1800.00, description: 'COLECISTECTOMIA + LIBERAÇÃO + HEPATORRAFIA + DRENAGEM - R$ 1.800,00' },
        { codes: ['04.07.03.002-6', '04.07.04.018-8', '04.07.03.014-0', '04.07.04.002-1', '04.07.03.006-9'], totalValue: 2050.00, description: 'COLECISTECTOMIA + 4 SEQUENCIAIS (MÁXIMO) - R$ 2.050,00' },
        { codes: ['04.07.04.010-2', '04.07.04.009-9'], totalValue: 1000.00, description: 'INGUINAL UNILATERAL (1ª) + INGUINAL BILATERAL (2ª) - R$ 1.000,00' },
        { codes: ['04.07.04.010-2', '04.07.04.006-4'], totalValue: 1000.00, description: 'INGUINAL UNILATERAL (1ª) + EPIGÁSTRICA (2ª) - R$ 1.000,00' },
        { codes: ['04.07.04.010-2', '04.07.04.012-9'], totalValue: 1000.00, description: 'INGUINAL UNILATERAL (1ª) + UMBILICAL (2ª) - R$ 1.000,00' },
        { codes: ['04.07.04.010-2', '04.07.04.008-0'], totalValue: 1000.00, description: 'INGUINAL UNILATERAL (1ª) + INCISIONAL/VENTRAL (2ª) - R$ 1.000,00' },
        { codes: ['04.07.04.009-9', '04.07.04.010-2'], totalValue: 1000.00, description: 'INGUINAL BILATERAL (1ª) + INGUINAL UNILATERAL (2ª) - R$ 1.000,00' },
        { codes: ['04.07.04.009-9', '04.07.04.006-4'], totalValue: 1000.00, description: 'INGUINAL BILATERAL (1ª) + EPIGÁSTRICA (2ª) - R$ 1.000,00' },
        { codes: ['04.07.04.009-9', '04.07.04.012-9'], totalValue: 1000.00, description: 'INGUINAL BILATERAL (1ª) + UMBILICAL (2ª) - R$ 1.000,00' },
        { codes: ['04.07.04.009-9', '04.07.04.008-0'], totalValue: 1000.00, description: 'INGUINAL BILATERAL (1ª) + INCISIONAL/VENTRAL (2ª) - R$ 1.000,00' },
        { codes: ['04.07.04.006-4', '04.07.04.010-2'], totalValue: 1100.00, description: 'EPIGÁSTRICA (1ª) + INGUINAL UNILATERAL (2ª) - R$ 1.100,00' },
        { codes: ['04.07.04.006-4', '04.07.04.009-9'], totalValue: 1100.00, description: 'EPIGÁSTRICA (1ª) + INGUINAL BILATERAL (2ª) - R$ 1.100,00' },
        { codes: ['04.07.04.006-4', '04.07.04.012-9'], totalValue: 1100.00, description: 'EPIGÁSTRICA (1ª) + UMBILICAL (2ª) - R$ 1.100,00' },
        { codes: ['04.07.04.006-4', '04.07.04.008-0'], totalValue: 1100.00, description: 'EPIGÁSTRICA (1ª) + INCISIONAL/VENTRAL (2ª) - R$ 1.100,00' },
        { codes: ['04.07.04.012-9', '04.07.04.010-2'], totalValue: 750.00, description: 'UMBILICAL (1ª) + INGUINAL UNILATERAL (2ª) - R$ 750,00' },
        { codes: ['04.07.04.012-9', '04.07.04.009-9'], totalValue: 750.00, description: 'UMBILICAL (1ª) + INGUINAL BILATERAL (2ª) - R$ 750,00' },
        { codes: ['04.07.04.012-9', '04.07.04.006-4'], totalValue: 750.00, description: 'UMBILICAL (1ª) + EPIGÁSTRICA (2ª) - R$ 750,00' },
        { codes: ['04.07.04.012-9', '04.07.04.008-0'], totalValue: 750.00, description: 'UMBILICAL (1ª) + INCISIONAL/VENTRAL (2ª) - R$ 750,00' },
        { codes: ['04.07.04.008-0', '04.07.04.010-2'], totalValue: 900.00, description: 'INCISIONAL/VENTRAL (1ª) + INGUINAL UNILATERAL (2ª) - R$ 900,00' },
        { codes: ['04.07.04.008-0', '04.07.04.009-9'], totalValue: 900.00, description: 'INCISIONAL/VENTRAL (1ª) + INGUINAL BILATERAL (2ª) - R$ 900,00' },
        { codes: ['04.07.04.008-0', '04.07.04.006-4'], totalValue: 900.00, description: 'INCISIONAL/VENTRAL (1ª) + EPIGÁSTRICA (2ª) - R$ 900,00' },
        { codes: ['04.07.04.008-0', '04.07.04.012-9'], totalValue: 900.00, description: 'INCISIONAL/VENTRAL (1ª) + UMBILICAL (2ª) - R$ 900,00' },
        { codes: ['04.07.04.006-4', '04.07.04.010-2', '04.07.04.012-9'], totalValue: 1400.00, description: 'EPIGÁSTRICA (1ª) + INGUINAL UNILATERAL (2ª) + UMBILICAL (3ª) - R$ 1.400,00' },
        { codes: ['04.07.04.006-4', '04.07.04.009-9', '04.07.04.012-9'], totalValue: 1400.00, description: 'EPIGÁSTRICA (1ª) + INGUINAL BILATERAL (2ª) + UMBILICAL (3ª) - R$ 1.400,00' },
        { codes: ['04.07.04.010-2', '04.07.04.012-9', '04.07.04.008-0'], totalValue: 1300.00, description: 'INGUINAL UNILATERAL (1ª) + UMBILICAL (2ª) + INCISIONAL (3ª) - R$ 1.300,00' },
        { codes: ['04.07.04.006-4', '04.07.04.010-2', '04.07.04.012-9', '04.07.04.008-0'], totalValue: 1700.00, description: 'EPIGÁSTRICA (1ª) + INGUINAL UNI (2ª) + UMBILICAL (3ª) + INCISIONAL (4ª) - R$ 1.700,00' }
      ]
    },

    'RAPHAEL BEZERRA DE MENEZES COSTA': {
      doctorName: 'RAPHAEL BEZERRA DE MENEZES COSTA',
      rules: [
        { procedureCode: '04.07.03.002-6', standardValue: 900.00, description: 'COLECISTECTOMIA (PRINCIPAL) - R$ 900,00' },
        { procedureCode: '04.07.04.018-8', standardValue: 300.00, description: 'LIBERAÇÃO DE ADERÊNCIAS INTESTINAIS - R$ 300,00' },
        { procedureCode: '04.07.04.002-1', standardValue: 300.00, description: 'DRENAGEM DE ABSCESSO SUBFRÊNICO - R$ 300,00' },
        { procedureCode: '04.07.03.014-0', standardValue: 300.00, description: 'HEPATORRAFIA - R$ 300,00' },
        { procedureCode: '04.07.03.006-9', standardValue: 250.00, description: 'COLEDOCOTOMIA - R$ 250,00' },
        { procedureCode: '04.07.03.005-0', standardValue: 200.00, description: 'COLEDOCOPLASTIA - R$ 200,00' },
        { procedureCode: '04.07.04.010-2', standardValue: 700.00, description: 'HERNIOPLASTIA INGUINAL UNILATERAL (PRINCIPAL) - R$ 700,00' },
        { procedureCode: '04.07.04.009-9', standardValue: 700.00, description: 'HERNIOPLASTIA INGUINAL BILATERAL (PRINCIPAL) - R$ 700,00' },
        { procedureCode: '04.07.04.006-4', standardValue: 800.00, description: 'HERNIOPLASTIA EPIGÁSTRICA (PRINCIPAL) - R$ 800,00' },
        { procedureCode: '04.07.04.012-9', standardValue: 450.00, description: 'HERNIOPLASTIA UMBILICAL (PRINCIPAL) - R$ 450,00' },
        { procedureCode: '04.07.04.008-0', standardValue: 600.00, description: 'HERNIOPLASTIA INCISIONAL/VENTRAL (PRINCIPAL) - R$ 600,00' },
        { procedureCode: '04.07.02.027-6', standardValue: 450.00, description: 'FISTULECTOMIA/FISTULOTOMIA ANAL - R$ 450,00' },
        { procedureCode: '04.07.02.028-4', standardValue: 450.00, description: 'HEMORROIDECTOMIA - R$ 450,00' },
        { procedureCode: '04.07.02.031-4', standardValue: 450.00, description: 'TRATAMENTO CIRÚRGICO DE FISSURA ANAL - R$ 450,00' },
        { procedureCode: '04.01.02.007-0', standardValue: 250.00, description: 'EXÉRESE DE CISTO DERMOIDE - R$ 250,00' },
        { procedureCode: '04.01.02.010-0', standardValue: 250.00, description: 'EXTIRPAÇÃO E SUPRESSÃO DE LESÃO DE PELE E DE TECIDO SUBCUTÂNEO - R$ 250,00' },
        { procedureCode: '04.01.02.008-8', standardValue: 250.00, description: 'EXÉRESE DE LIPOMA - R$ 250,00' },
        { procedureCode: '04.01.02.009-6', standardValue: 250.00, description: 'EXÉRESE DE CISTO PILONIDAL - R$ 250,00' }
      ],
      multipleRules: [
        { codes: ['04.07.03.002-6', '04.07.04.018-8'], totalValue: 1200.00, description: 'COLECISTECTOMIA + LIBERAÇÃO DE ADERÊNCIAS - R$ 1.200,00' },
        { codes: ['04.07.03.002-6', '04.07.04.002-1'], totalValue: 1200.00, description: 'COLECISTECTOMIA + DRENAGEM ABSCESSO SUBFRÊNICO - R$ 1.200,00' },
        { codes: ['04.07.03.002-6', '04.07.03.014-0'], totalValue: 1200.00, description: 'COLECISTECTOMIA + HEPATORRAFIA - R$ 1.200,00' },
        { codes: ['04.07.03.002-6', '04.07.03.006-9'], totalValue: 1150.00, description: 'COLECISTECTOMIA + COLEDOCOTOMIA - R$ 1.150,00' },
        { codes: ['04.07.03.002-6', '04.07.03.005-0'], totalValue: 1100.00, description: 'COLECISTECTOMIA + COLEDOCOPLASTIA - R$ 1.100,00' },
        { codes: ['04.07.03.002-6', '04.07.04.010-2'], totalValue: 1600.00, description: 'COLECISTECTOMIA + HERNIOPLASTIA INGUINAL UNILATERAL - R$ 1.600,00' },
        { codes: ['04.07.03.002-6', '04.07.04.009-9'], totalValue: 1600.00, description: 'COLECISTECTOMIA + HERNIOPLASTIA INGUINAL BILATERAL - R$ 1.600,00' },
        { codes: ['04.07.03.002-6', '04.07.04.006-4'], totalValue: 1700.00, description: 'COLECISTECTOMIA + HERNIOPLASTIA EPIGÁSTRICA - R$ 1.700,00' },
        { codes: ['04.07.03.002-6', '04.07.04.012-9'], totalValue: 1350.00, description: 'COLECISTECTOMIA + HERNIOPLASTIA UMBILICAL - R$ 1.350,00' },
        { codes: ['04.07.03.002-6', '04.07.04.008-0'], totalValue: 1500.00, description: 'COLECISTECTOMIA + HERNIOPLASTIA INCISIONAL/VENTRAL - R$ 1.500,00' },
        { codes: ['04.07.03.002-6', '04.07.04.018-8', '04.07.03.014-0'], totalValue: 1500.00, description: 'COLECISTECTOMIA + LIBERAÇÃO ADERÊNCIAS + HEPATORRAFIA - R$ 1.500,00' },
        { codes: ['04.07.03.002-6', '04.07.03.006-9', '04.07.03.005-0'], totalValue: 1350.00, description: 'COLECISTECTOMIA + COLEDOCOTOMIA + COLEDOCOPLASTIA - R$ 1.350,00' },
        { codes: ['04.07.03.002-6', '04.07.04.018-8', '04.07.03.014-0', '04.07.04.002-1'], totalValue: 1800.00, description: 'COLECISTECTOMIA + LIBERAÇÃO + HEPATORRAFIA + DRENAGEM - R$ 1.800,00' },
        { codes: ['04.07.03.002-6', '04.07.04.018-8', '04.07.03.014-0', '04.07.04.002-1', '04.07.03.006-9'], totalValue: 2050.00, description: 'COLECISTECTOMIA + 4 SEQUENCIAIS (MÁXIMO) - R$ 2.050,00' },
        { codes: ['04.07.04.010-2', '04.07.04.009-9'], totalValue: 1000.00, description: 'INGUINAL UNILATERAL (1ª) + INGUINAL BILATERAL (2ª) - R$ 1.000,00' },
        { codes: ['04.07.04.010-2', '04.07.04.006-4'], totalValue: 1000.00, description: 'INGUINAL UNILATERAL (1ª) + EPIGÁSTRICA (2ª) - R$ 1.000,00' },
        { codes: ['04.07.04.010-2', '04.07.04.012-9'], totalValue: 1000.00, description: 'INGUINAL UNILATERAL (1ª) + UMBILICAL (2ª) - R$ 1.000,00' },
        { codes: ['04.07.04.010-2', '04.07.04.008-0'], totalValue: 1000.00, description: 'INGUINAL UNILATERAL (1ª) + INCISIONAL/VENTRAL (2ª) - R$ 1.000,00' },
        { codes: ['04.07.04.009-9', '04.07.04.010-2'], totalValue: 1000.00, description: 'INGUINAL BILATERAL (1ª) + INGUINAL UNILATERAL (2ª) - R$ 1.000,00' },
        { codes: ['04.07.04.009-9', '04.07.04.006-4'], totalValue: 1000.00, description: 'INGUINAL BILATERAL (1ª) + EPIGÁSTRICA (2ª) - R$ 1.000,00' },
        { codes: ['04.07.04.009-9', '04.07.04.012-9'], totalValue: 1000.00, description: 'INGUINAL BILATERAL (1ª) + UMBILICAL (2ª) - R$ 1.000,00' },
        { codes: ['04.07.04.009-9', '04.07.04.008-0'], totalValue: 1000.00, description: 'INGUINAL BILATERAL (1ª) + INCISIONAL/VENTRAL (2ª) - R$ 1.000,00' },
        { codes: ['04.07.04.006-4', '04.07.04.010-2'], totalValue: 1100.00, description: 'EPIGÁSTRICA (1ª) + INGUINAL UNILATERAL (2ª) - R$ 1.100,00' },
        { codes: ['04.07.04.006-4', '04.07.04.009-9'], totalValue: 1100.00, description: 'EPIGÁSTRICA (1ª) + INGUINAL BILATERAL (2ª) - R$ 1.100,00' },
        { codes: ['04.07.04.006-4', '04.07.04.012-9'], totalValue: 1100.00, description: 'EPIGÁSTRICA (1ª) + UMBILICAL (2ª) - R$ 1.100,00' },
        { codes: ['04.07.04.006-4', '04.07.04.008-0'], totalValue: 1100.00, description: 'EPIGÁSTRICA (1ª) + INCISIONAL/VENTRAL (2ª) - R$ 1.100,00' },
        { codes: ['04.07.04.012-9', '04.07.04.010-2'], totalValue: 750.00, description: 'UMBILICAL (1ª) + INGUINAL UNILATERAL (2ª) - R$ 750,00' },
        { codes: ['04.07.04.012-9', '04.07.04.009-9'], totalValue: 750.00, description: 'UMBILICAL (1ª) + INGUINAL BILATERAL (2ª) - R$ 750,00' },
        { codes: ['04.07.04.012-9', '04.07.04.006-4'], totalValue: 750.00, description: 'UMBILICAL (1ª) + EPIGÁSTRICA (2ª) - R$ 750,00' },
        { codes: ['04.07.04.012-9', '04.07.04.008-0'], totalValue: 750.00, description: 'UMBILICAL (1ª) + INCISIONAL/VENTRAL (2ª) - R$ 750,00' },
        { codes: ['04.07.04.008-0', '04.07.04.010-2'], totalValue: 900.00, description: 'INCISIONAL/VENTRAL (1ª) + INGUINAL UNILATERAL (2ª) - R$ 900,00' },
        { codes: ['04.07.04.008-0', '04.07.04.009-9'], totalValue: 900.00, description: 'INCISIONAL/VENTRAL (1ª) + INGUINAL BILATERAL (2ª) - R$ 900,00' },
        { codes: ['04.07.04.008-0', '04.07.04.006-4'], totalValue: 900.00, description: 'INCISIONAL/VENTRAL (1ª) + EPIGÁSTRICA (2ª) - R$ 900,00' },
        { codes: ['04.07.04.008-0', '04.07.04.012-9'], totalValue: 900.00, description: 'INCISIONAL/VENTRAL (1ª) + UMBILICAL (2ª) - R$ 900,00' },
        { codes: ['04.07.04.006-4', '04.07.04.010-2', '04.07.04.012-9'], totalValue: 1400.00, description: 'EPIGÁSTRICA (1ª) + INGUINAL UNILATERAL (2ª) + UMBILICAL (3ª) - R$ 1.400,00' },
        { codes: ['04.07.04.006-4', '04.07.04.009-9', '04.07.04.012-9'], totalValue: 1400.00, description: 'EPIGÁSTRICA (1ª) + INGUINAL BILATERAL (2ª) + UMBILICAL (3ª) - R$ 1.400,00' },
        { codes: ['04.07.04.010-2', '04.07.04.012-9', '04.07.04.008-0'], totalValue: 1300.00, description: 'INGUINAL UNILATERAL (1ª) + UMBILICAL (2ª) + INCISIONAL (3ª) - R$ 1.300,00' },
        { codes: ['04.07.04.006-4', '04.07.04.010-2', '04.07.04.012-9', '04.07.04.008-0'], totalValue: 1700.00, description: 'EPIGÁSTRICA (1ª) + INGUINAL UNI (2ª) + UMBILICAL (3ª) + INCISIONAL (4ª) - R$ 1.700,00' }
      ]
    },

    // ================================================================
    // 🏥 UROLOGISTAS - FOZ DO IGUAÇU
    // Baseado nas regras do Dr. GUILHERME AUGUSTO STORER (Torao Tokuda)
    // Data: Novembro 2025
    // Total: 5 médicos com mesmas regras
    // ================================================================

    'LUIZ HENRIQUE WERLANG': {
      doctorName: 'LUIZ HENRIQUE WERLANG',
      rules: [
        { procedureCode: '04.09.01.023-5', standardValue: 1000.00, description: 'NEFROLITOTOMIA PERCUTÂNEA - R$ 1.000,00' },
        { procedureCode: '04.09.01.059-6', standardValue: 900.00, description: 'URETEROLITOTRIPSIA TRANSURETEROSCÓPICA (SEMIRRÍGIDA) - R$ 900,00' },
        { procedureCode: '04.09.01.018-9', standardValue: 1000.00, description: 'LITOTRIPSIA (FLEXÍVEL) - R$ 1.000,00' },
        { procedureCode: '04.09.01.017-0', standardValue: 250.00, description: 'INSTALAÇÃO ENDOSCÓPICA DE CATETER DUPLO J - R$ 250,00' },
        { procedureCode: '04.09.03.004-0', standardValue: 1000.00, description: 'RESSECÇÃO ENDOSCÓPICA DE PRÓSTATA - R$ 1.000,00' },
        { procedureCode: '04.09.03.002-3', standardValue: 1000.00, description: 'PROSTATECTOMIA SUPRAPÚBICA - R$ 1.000,00' },
        { procedureCode: '04.09.04.021-5', standardValue: 300.00, description: 'TRATAMENTO CIRÚRGICO DE HIDROCELE - R$ 300,00' },
        { procedureCode: '04.09.05.008-3', standardValue: 250.00, description: 'POSTECTOMIA - R$ 250,00' },
        { procedureCode: '04.09.04.024-0', standardValue: 450.00, description: 'VASECTOMIA - R$ 450,00' },
        { procedureCode: '04.09.04.023-1', standardValue: 250.00, description: 'TRATAMENTO CIRÚRGICO DE VARICOCELE - R$ 250,00' },
        { procedureCode: '04.09.04.013-4', standardValue: 400.00, description: 'ORQUIDOPEXIA UNILATERAL - R$ 400,00' },
        { procedureCode: '04.09.04.012-6', standardValue: 450.00, description: 'ORQUIDOPEXIA BILATERAL - R$ 450,00' },
        { procedureCode: '04.09.01.006-5', standardValue: 600.00, description: 'CISTOLITOTOMIA E/OU RETIRADA DE CORPO ESTRANHO DA BEXIGA - R$ 600,00' },
        { procedureCode: '04.09.05.007-5', standardValue: 500.00, description: 'PLÁSTICA TOTAL DO PÊNIS (INCLUI PEYRONIE) - R$ 500,00' },
        { procedureCode: 'RESSECÇÃO_CISTOS', standardValue: 250.00, description: 'RESSECÇÃO DE CISTOS/CAUTERIZAÇÕES - R$ 250,00' },
        { procedureCode: '04.09.04.016-9', standardValue: 500.00, description: 'ORQUIECTOMIA UNILATERAL - R$ 500,00' },
        { procedureCode: '04.09.01.032-4', standardValue: 700.00, description: 'PIELOPLASTIA - R$ 700,00' },
        { procedureCode: '04.09.01.021-9', standardValue: 1200.00, description: 'NEFRECTOMIA TOTAL - R$ 1.200,00' },
        { procedureCode: '04.09.01.020-0', standardValue: 1000.00, description: 'NEFRECTOMIA PARCIAL - R$ 1.000,00' },
        { procedureCode: '04.09.01.022-7', standardValue: 900.00, description: 'NEFROLITOTOMIA (ANATRÓFICA) - R$ 900,00' },
        { procedureCode: '04.09.01.029-4', standardValue: 400.00, description: 'NEFROSTOMIA PERCUTÂNEA - R$ 400,00' },
        { procedureCode: '04.09.02.017-6', standardValue: 250.00, description: 'URETROTOMIA INTERNA - R$ 250,00' }
      ],
      multipleRules: [
        { codes: ['04.09.01.023-5', '04.09.01.017-0'], totalValue: 1100.00, description: 'NEFROLITOTOMIA PERCUTÂNEA + INSTALAÇÃO CATETER DUPLO J - R$ 1.100,00' },
        { codes: ['04.09.01.023-5', '04.09.01.014-6'], totalValue: 1300.00, description: 'NEFROLITOTOMIA PERCUTÂNEA + EXTRAÇÃO CÁLCULO PELVE RENAL - R$ 1.300,00' },
        { codes: ['04.09.01.023-5', '04.09.01.017-0', '04.09.01.014-6'], totalValue: 1400.00, description: 'NEFROLITOTOMIA + CATETER DUPLO J + EXTRAÇÃO CÁLCULO - R$ 1.400,00' },
        { codes: ['04.09.01.023-5', '04.09.01.014-6', '04.09.01.059-6'], totalValue: 1500.00, description: 'NEFROLITOTOMIA + EXTRAÇÃO CÁLCULO + URETEROLITOTRIPSIA - R$ 1.500,00' },
        { codes: ['04.09.01.023-5', '04.09.01.017-0', '04.09.01.014-6', '04.09.01.059-6'], totalValue: 1600.00, description: 'NEFROLITOTOMIA + CATETER + EXTRAÇÃO + URETEROLITOTRIPSIA - R$ 1.600,00' },
        { codes: ['04.09.01.059-6', '04.09.01.017-0'], totalValue: 1000.00, description: 'URETEROLITOTRIPSIA + CATETER DUPLO J - R$ 1.000,00' },
        { codes: ['04.09.01.018-9', '04.09.01.017-0'], totalValue: 1100.00, description: 'LITOTRIPSIA FLEXÍVEL + CATETER DUPLO J - R$ 1.100,00' },
        { codes: ['04.09.01.018-9', '04.09.01.014-6', '04.09.01.017-0'], totalValue: 1200.00, description: 'LITOTRIPSIA + EXTRAÇÃO CÁLCULO + CATETER - R$ 1.200,00' },
        { codes: ['04.09.01.018-9', '04.09.01.059-6', '04.09.01.014-6', '04.09.01.017-0'], totalValue: 1300.00, description: 'LITOTRIPSIA + URETEROLITOTRIPSIA + EXTRAÇÃO + CATETER - R$ 1.300,00' },
        { codes: ['04.09.03.004-0', '04.09.01.038-3'], totalValue: 1200.00, description: 'RESSECÇÃO PRÓSTATA + RESSECÇÃO LESÃO VESICAL - R$ 1.200,00' },
        { codes: ['04.09.04.021-5', '04.09.04.019-3'], totalValue: 400.00, description: 'HIDROCELE + RESSECÇÃO BOLSA ESCROTAL - R$ 400,00' },
        { codes: ['04.09.04.021-5', '04.09.04.019-3', '04.09.04.017-7'], totalValue: 500.00, description: 'HIDROCELE + RESSECÇÃO + PLÁSTICA BOLSA - R$ 500,00' },
        { codes: ['04.09.04.013-4', '04.09.04.017-7'], totalValue: 550.00, description: 'ORQUIDOPEXIA UNILATERAL + PLÁSTICA BOLSA - R$ 550,00' },
        { codes: ['04.09.04.012-6', '04.09.04.017-7'], totalValue: 550.00, description: 'ORQUIDOPEXIA BILATERAL + PLÁSTICA BOLSA - R$ 550,00' },
        { codes: ['04.09.01.032-4', '04.09.01.057-0'], totalValue: 1000.00, description: 'PIELOPLASTIA + URETEROPLASTIA - R$ 1.000,00' },
        { codes: ['04.09.01.032-4', '04.09.01.057-0', '04.09.01.017-0'], totalValue: 1100.00, description: 'PIELOPLASTIA + URETEROPLASTIA + CATETER DUPLO J - R$ 1.100,00' }
      ]
    },

    'RODRIGO FELIPE GONGORA E SILVA': {
      doctorName: 'RODRIGO FELIPE GONGORA E SILVA',
      rules: [
        { procedureCode: '04.09.01.023-5', standardValue: 1000.00, description: 'NEFROLITOTOMIA PERCUTÂNEA - R$ 1.000,00' },
        { procedureCode: '04.09.01.059-6', standardValue: 900.00, description: 'URETEROLITOTRIPSIA TRANSURETEROSCÓPICA (SEMIRRÍGIDA) - R$ 900,00' },
        { procedureCode: '04.09.01.018-9', standardValue: 1000.00, description: 'LITOTRIPSIA (FLEXÍVEL) - R$ 1.000,00' },
        { procedureCode: '04.09.01.017-0', standardValue: 250.00, description: 'INSTALAÇÃO ENDOSCÓPICA DE CATETER DUPLO J - R$ 250,00' },
        { procedureCode: '04.09.03.004-0', standardValue: 1000.00, description: 'RESSECÇÃO ENDOSCÓPICA DE PRÓSTATA - R$ 1.000,00' },
        { procedureCode: '04.09.03.002-3', standardValue: 1000.00, description: 'PROSTATECTOMIA SUPRAPÚBICA - R$ 1.000,00' },
        { procedureCode: '04.09.04.021-5', standardValue: 300.00, description: 'TRATAMENTO CIRÚRGICO DE HIDROCELE - R$ 300,00' },
        { procedureCode: '04.09.05.008-3', standardValue: 250.00, description: 'POSTECTOMIA - R$ 250,00' },
        { procedureCode: '04.09.04.024-0', standardValue: 450.00, description: 'VASECTOMIA - R$ 450,00' },
        { procedureCode: '04.09.04.023-1', standardValue: 250.00, description: 'TRATAMENTO CIRÚRGICO DE VARICOCELE - R$ 250,00' },
        { procedureCode: '04.09.04.013-4', standardValue: 400.00, description: 'ORQUIDOPEXIA UNILATERAL - R$ 400,00' },
        { procedureCode: '04.09.04.012-6', standardValue: 450.00, description: 'ORQUIDOPEXIA BILATERAL - R$ 450,00' },
        { procedureCode: '04.09.01.006-5', standardValue: 600.00, description: 'CISTOLITOTOMIA E/OU RETIRADA DE CORPO ESTRANHO DA BEXIGA - R$ 600,00' },
        { procedureCode: '04.09.05.007-5', standardValue: 500.00, description: 'PLÁSTICA TOTAL DO PÊNIS (INCLUI PEYRONIE) - R$ 500,00' },
        { procedureCode: 'RESSECÇÃO_CISTOS', standardValue: 250.00, description: 'RESSECÇÃO DE CISTOS/CAUTERIZAÇÕES - R$ 250,00' },
        { procedureCode: '04.09.04.016-9', standardValue: 500.00, description: 'ORQUIECTOMIA UNILATERAL - R$ 500,00' },
        { procedureCode: '04.09.01.032-4', standardValue: 700.00, description: 'PIELOPLASTIA - R$ 700,00' },
        { procedureCode: '04.09.01.021-9', standardValue: 1200.00, description: 'NEFRECTOMIA TOTAL - R$ 1.200,00' },
        { procedureCode: '04.09.01.020-0', standardValue: 1000.00, description: 'NEFRECTOMIA PARCIAL - R$ 1.000,00' },
        { procedureCode: '04.09.01.022-7', standardValue: 900.00, description: 'NEFROLITOTOMIA (ANATRÓFICA) - R$ 900,00' },
        { procedureCode: '04.09.01.029-4', standardValue: 400.00, description: 'NEFROSTOMIA PERCUTÂNEA - R$ 400,00' },
        { procedureCode: '04.09.02.017-6', standardValue: 250.00, description: 'URETROTOMIA INTERNA - R$ 250,00' }
      ],
      multipleRules: [
        { codes: ['04.09.01.023-5', '04.09.01.017-0'], totalValue: 1100.00, description: 'NEFROLITOTOMIA PERCUTÂNEA + INSTALAÇÃO CATETER DUPLO J - R$ 1.100,00' },
        { codes: ['04.09.01.023-5', '04.09.01.014-6'], totalValue: 1300.00, description: 'NEFROLITOTOMIA PERCUTÂNEA + EXTRAÇÃO CÁLCULO PELVE RENAL - R$ 1.300,00' },
        { codes: ['04.09.01.023-5', '04.09.01.017-0', '04.09.01.014-6'], totalValue: 1400.00, description: 'NEFROLITOTOMIA + CATETER DUPLO J + EXTRAÇÃO CÁLCULO - R$ 1.400,00' },
        { codes: ['04.09.01.023-5', '04.09.01.014-6', '04.09.01.059-6'], totalValue: 1500.00, description: 'NEFROLITOTOMIA + EXTRAÇÃO CÁLCULO + URETEROLITOTRIPSIA - R$ 1.500,00' },
        { codes: ['04.09.01.023-5', '04.09.01.017-0', '04.09.01.014-6', '04.09.01.059-6'], totalValue: 1600.00, description: 'NEFROLITOTOMIA + CATETER + EXTRAÇÃO + URETEROLITOTRIPSIA - R$ 1.600,00' },
        { codes: ['04.09.01.059-6', '04.09.01.017-0'], totalValue: 1000.00, description: 'URETEROLITOTRIPSIA + CATETER DUPLO J - R$ 1.000,00' },
        { codes: ['04.09.01.018-9', '04.09.01.017-0'], totalValue: 1100.00, description: 'LITOTRIPSIA FLEXÍVEL + CATETER DUPLO J - R$ 1.100,00' },
        { codes: ['04.09.01.018-9', '04.09.01.014-6', '04.09.01.017-0'], totalValue: 1200.00, description: 'LITOTRIPSIA + EXTRAÇÃO CÁLCULO + CATETER - R$ 1.200,00' },
        { codes: ['04.09.01.018-9', '04.09.01.059-6', '04.09.01.014-6', '04.09.01.017-0'], totalValue: 1300.00, description: 'LITOTRIPSIA + URETEROLITOTRIPSIA + EXTRAÇÃO + CATETER - R$ 1.300,00' },
        { codes: ['04.09.03.004-0', '04.09.01.038-3'], totalValue: 1200.00, description: 'RESSECÇÃO PRÓSTATA + RESSECÇÃO LESÃO VESICAL - R$ 1.200,00' },
        { codes: ['04.09.04.021-5', '04.09.04.019-3'], totalValue: 400.00, description: 'HIDROCELE + RESSECÇÃO BOLSA ESCROTAL - R$ 400,00' },
        { codes: ['04.09.04.021-5', '04.09.04.019-3', '04.09.04.017-7'], totalValue: 500.00, description: 'HIDROCELE + RESSECÇÃO + PLÁSTICA BOLSA - R$ 500,00' },
        { codes: ['04.09.04.013-4', '04.09.04.017-7'], totalValue: 550.00, description: 'ORQUIDOPEXIA UNILATERAL + PLÁSTICA BOLSA - R$ 550,00' },
        { codes: ['04.09.04.012-6', '04.09.04.017-7'], totalValue: 550.00, description: 'ORQUIDOPEXIA BILATERAL + PLÁSTICA BOLSA - R$ 550,00' },
        { codes: ['04.09.01.032-4', '04.09.01.057-0'], totalValue: 1000.00, description: 'PIELOPLASTIA + URETEROPLASTIA - R$ 1.000,00' },
        { codes: ['04.09.01.032-4', '04.09.01.057-0', '04.09.01.017-0'], totalValue: 1100.00, description: 'PIELOPLASTIA + URETEROPLASTIA + CATETER DUPLO J - R$ 1.100,00' }
      ]
    },

    'FABIO LUIZ DE SOUZA': {
      doctorName: 'FABIO LUIZ DE SOUZA',
      rules: [
        { procedureCode: '04.09.01.023-5', standardValue: 1000.00, description: 'NEFROLITOTOMIA PERCUTÂNEA - R$ 1.000,00' },
        { procedureCode: '04.09.01.059-6', standardValue: 900.00, description: 'URETEROLITOTRIPSIA TRANSURETEROSCÓPICA (SEMIRRÍGIDA) - R$ 900,00' },
        { procedureCode: '04.09.01.018-9', standardValue: 1000.00, description: 'LITOTRIPSIA (FLEXÍVEL) - R$ 1.000,00' },
        { procedureCode: '04.09.01.017-0', standardValue: 250.00, description: 'INSTALAÇÃO ENDOSCÓPICA DE CATETER DUPLO J - R$ 250,00' },
        { procedureCode: '04.09.03.004-0', standardValue: 1000.00, description: 'RESSECÇÃO ENDOSCÓPICA DE PRÓSTATA - R$ 1.000,00' },
        { procedureCode: '04.09.03.002-3', standardValue: 1000.00, description: 'PROSTATECTOMIA SUPRAPÚBICA - R$ 1.000,00' },
        { procedureCode: '04.09.04.021-5', standardValue: 300.00, description: 'TRATAMENTO CIRÚRGICO DE HIDROCELE - R$ 300,00' },
        { procedureCode: '04.09.05.008-3', standardValue: 250.00, description: 'POSTECTOMIA - R$ 250,00' },
        { procedureCode: '04.09.04.024-0', standardValue: 450.00, description: 'VASECTOMIA - R$ 450,00' },
        { procedureCode: '04.09.04.023-1', standardValue: 250.00, description: 'TRATAMENTO CIRÚRGICO DE VARICOCELE - R$ 250,00' },
        { procedureCode: '04.09.04.013-4', standardValue: 400.00, description: 'ORQUIDOPEXIA UNILATERAL - R$ 400,00' },
        { procedureCode: '04.09.04.012-6', standardValue: 450.00, description: 'ORQUIDOPEXIA BILATERAL - R$ 450,00' },
        { procedureCode: '04.09.01.006-5', standardValue: 600.00, description: 'CISTOLITOTOMIA E/OU RETIRADA DE CORPO ESTRANHO DA BEXIGA - R$ 600,00' },
        { procedureCode: '04.09.05.007-5', standardValue: 500.00, description: 'PLÁSTICA TOTAL DO PÊNIS (INCLUI PEYRONIE) - R$ 500,00' },
        { procedureCode: 'RESSECÇÃO_CISTOS', standardValue: 250.00, description: 'RESSECÇÃO DE CISTOS/CAUTERIZAÇÕES - R$ 250,00' },
        { procedureCode: '04.09.04.016-9', standardValue: 500.00, description: 'ORQUIECTOMIA UNILATERAL - R$ 500,00' },
        { procedureCode: '04.09.01.032-4', standardValue: 700.00, description: 'PIELOPLASTIA - R$ 700,00' },
        { procedureCode: '04.09.01.021-9', standardValue: 1200.00, description: 'NEFRECTOMIA TOTAL - R$ 1.200,00' },
        { procedureCode: '04.09.01.020-0', standardValue: 1000.00, description: 'NEFRECTOMIA PARCIAL - R$ 1.000,00' },
        { procedureCode: '04.09.01.022-7', standardValue: 900.00, description: 'NEFROLITOTOMIA (ANATRÓFICA) - R$ 900,00' },
        { procedureCode: '04.09.01.029-4', standardValue: 400.00, description: 'NEFROSTOMIA PERCUTÂNEA - R$ 400,00' },
        { procedureCode: '04.09.02.017-6', standardValue: 250.00, description: 'URETROTOMIA INTERNA - R$ 250,00' }
      ],
      multipleRules: [
        { codes: ['04.09.01.023-5', '04.09.01.017-0'], totalValue: 1100.00, description: 'NEFROLITOTOMIA PERCUTÂNEA + INSTALAÇÃO CATETER DUPLO J - R$ 1.100,00' },
        { codes: ['04.09.01.023-5', '04.09.01.014-6'], totalValue: 1300.00, description: 'NEFROLITOTOMIA PERCUTÂNEA + EXTRAÇÃO CÁLCULO PELVE RENAL - R$ 1.300,00' },
        { codes: ['04.09.01.023-5', '04.09.01.017-0', '04.09.01.014-6'], totalValue: 1400.00, description: 'NEFROLITOTOMIA + CATETER DUPLO J + EXTRAÇÃO CÁLCULO - R$ 1.400,00' },
        { codes: ['04.09.01.023-5', '04.09.01.014-6', '04.09.01.059-6'], totalValue: 1500.00, description: 'NEFROLITOTOMIA + EXTRAÇÃO CÁLCULO + URETEROLITOTRIPSIA - R$ 1.500,00' },
        { codes: ['04.09.01.023-5', '04.09.01.017-0', '04.09.01.014-6', '04.09.01.059-6'], totalValue: 1600.00, description: 'NEFROLITOTOMIA + CATETER + EXTRAÇÃO + URETEROLITOTRIPSIA - R$ 1.600,00' },
        { codes: ['04.09.01.059-6', '04.09.01.017-0'], totalValue: 1000.00, description: 'URETEROLITOTRIPSIA + CATETER DUPLO J - R$ 1.000,00' },
        { codes: ['04.09.01.018-9', '04.09.01.017-0'], totalValue: 1100.00, description: 'LITOTRIPSIA FLEXÍVEL + CATETER DUPLO J - R$ 1.100,00' },
        { codes: ['04.09.01.018-9', '04.09.01.014-6', '04.09.01.017-0'], totalValue: 1200.00, description: 'LITOTRIPSIA + EXTRAÇÃO CÁLCULO + CATETER - R$ 1.200,00' },
        { codes: ['04.09.01.018-9', '04.09.01.059-6', '04.09.01.014-6', '04.09.01.017-0'], totalValue: 1300.00, description: 'LITOTRIPSIA + URETEROLITOTRIPSIA + EXTRAÇÃO + CATETER - R$ 1.300,00' },
        { codes: ['04.09.03.004-0', '04.09.01.038-3'], totalValue: 1200.00, description: 'RESSECÇÃO PRÓSTATA + RESSECÇÃO LESÃO VESICAL - R$ 1.200,00' },
        { codes: ['04.09.04.021-5', '04.09.04.019-3'], totalValue: 400.00, description: 'HIDROCELE + RESSECÇÃO BOLSA ESCROTAL - R$ 400,00' },
        { codes: ['04.09.04.021-5', '04.09.04.019-3', '04.09.04.017-7'], totalValue: 500.00, description: 'HIDROCELE + RESSECÇÃO + PLÁSTICA BOLSA - R$ 500,00' },
        { codes: ['04.09.04.013-4', '04.09.04.017-7'], totalValue: 550.00, description: 'ORQUIDOPEXIA UNILATERAL + PLÁSTICA BOLSA - R$ 550,00' },
        { codes: ['04.09.04.012-6', '04.09.04.017-7'], totalValue: 550.00, description: 'ORQUIDOPEXIA BILATERAL + PLÁSTICA BOLSA - R$ 550,00' },
        { codes: ['04.09.01.032-4', '04.09.01.057-0'], totalValue: 1000.00, description: 'PIELOPLASTIA + URETEROPLASTIA - R$ 1.000,00' },
        { codes: ['04.09.01.032-4', '04.09.01.057-0', '04.09.01.017-0'], totalValue: 1100.00, description: 'PIELOPLASTIA + URETEROPLASTIA + CATETER DUPLO J - R$ 1.100,00' }
      ]
    },

    'MICHEL COTAIT NETO': {
      doctorName: 'MICHEL COTAIT NETO',
      rules: [
        { procedureCode: '04.09.01.023-5', standardValue: 1000.00, description: 'NEFROLITOTOMIA PERCUTÂNEA - R$ 1.000,00' },
        { procedureCode: '04.09.01.059-6', standardValue: 900.00, description: 'URETEROLITOTRIPSIA TRANSURETEROSCÓPICA (SEMIRRÍGIDA) - R$ 900,00' },
        { procedureCode: '04.09.01.018-9', standardValue: 1000.00, description: 'LITOTRIPSIA (FLEXÍVEL) - R$ 1.000,00' },
        { procedureCode: '04.09.01.017-0', standardValue: 250.00, description: 'INSTALAÇÃO ENDOSCÓPICA DE CATETER DUPLO J - R$ 250,00' },
        { procedureCode: '04.09.03.004-0', standardValue: 1000.00, description: 'RESSECÇÃO ENDOSCÓPICA DE PRÓSTATA - R$ 1.000,00' },
        { procedureCode: '04.09.03.002-3', standardValue: 1000.00, description: 'PROSTATECTOMIA SUPRAPÚBICA - R$ 1.000,00' },
        { procedureCode: '04.09.04.021-5', standardValue: 300.00, description: 'TRATAMENTO CIRÚRGICO DE HIDROCELE - R$ 300,00' },
        { procedureCode: '04.09.05.008-3', standardValue: 250.00, description: 'POSTECTOMIA - R$ 250,00' },
        { procedureCode: '04.09.04.024-0', standardValue: 450.00, description: 'VASECTOMIA - R$ 450,00' },
        { procedureCode: '04.09.04.023-1', standardValue: 250.00, description: 'TRATAMENTO CIRÚRGICO DE VARICOCELE - R$ 250,00' },
        { procedureCode: '04.09.04.013-4', standardValue: 400.00, description: 'ORQUIDOPEXIA UNILATERAL - R$ 400,00' },
        { procedureCode: '04.09.04.012-6', standardValue: 450.00, description: 'ORQUIDOPEXIA BILATERAL - R$ 450,00' },
        { procedureCode: '04.09.01.006-5', standardValue: 600.00, description: 'CISTOLITOTOMIA E/OU RETIRADA DE CORPO ESTRANHO DA BEXIGA - R$ 600,00' },
        { procedureCode: '04.09.05.007-5', standardValue: 500.00, description: 'PLÁSTICA TOTAL DO PÊNIS (INCLUI PEYRONIE) - R$ 500,00' },
        { procedureCode: 'RESSECÇÃO_CISTOS', standardValue: 250.00, description: 'RESSECÇÃO DE CISTOS/CAUTERIZAÇÕES - R$ 250,00' },
        { procedureCode: '04.09.04.016-9', standardValue: 500.00, description: 'ORQUIECTOMIA UNILATERAL - R$ 500,00' },
        { procedureCode: '04.09.01.032-4', standardValue: 700.00, description: 'PIELOPLASTIA - R$ 700,00' },
        { procedureCode: '04.09.01.021-9', standardValue: 1200.00, description: 'NEFRECTOMIA TOTAL - R$ 1.200,00' },
        { procedureCode: '04.09.01.020-0', standardValue: 1000.00, description: 'NEFRECTOMIA PARCIAL - R$ 1.000,00' },
        { procedureCode: '04.09.01.022-7', standardValue: 900.00, description: 'NEFROLITOTOMIA (ANATRÓFICA) - R$ 900,00' },
        { procedureCode: '04.09.01.029-4', standardValue: 400.00, description: 'NEFROSTOMIA PERCUTÂNEA - R$ 400,00' },
        { procedureCode: '04.09.02.017-6', standardValue: 250.00, description: 'URETROTOMIA INTERNA - R$ 250,00' }
      ],
      multipleRules: [
        { codes: ['04.09.01.023-5', '04.09.01.017-0'], totalValue: 1100.00, description: 'NEFROLITOTOMIA PERCUTÂNEA + INSTALAÇÃO CATETER DUPLO J - R$ 1.100,00' },
        { codes: ['04.09.01.023-5', '04.09.01.014-6'], totalValue: 1300.00, description: 'NEFROLITOTOMIA PERCUTÂNEA + EXTRAÇÃO CÁLCULO PELVE RENAL - R$ 1.300,00' },
        { codes: ['04.09.01.023-5', '04.09.01.017-0', '04.09.01.014-6'], totalValue: 1400.00, description: 'NEFROLITOTOMIA + CATETER DUPLO J + EXTRAÇÃO CÁLCULO - R$ 1.400,00' },
        { codes: ['04.09.01.023-5', '04.09.01.014-6', '04.09.01.059-6'], totalValue: 1500.00, description: 'NEFROLITOTOMIA + EXTRAÇÃO CÁLCULO + URETEROLITOTRIPSIA - R$ 1.500,00' },
        { codes: ['04.09.01.023-5', '04.09.01.017-0', '04.09.01.014-6', '04.09.01.059-6'], totalValue: 1600.00, description: 'NEFROLITOTOMIA + CATETER + EXTRAÇÃO + URETEROLITOTRIPSIA - R$ 1.600,00' },
        { codes: ['04.09.01.059-6', '04.09.01.017-0'], totalValue: 1000.00, description: 'URETEROLITOTRIPSIA + CATETER DUPLO J - R$ 1.000,00' },
        { codes: ['04.09.01.018-9', '04.09.01.017-0'], totalValue: 1100.00, description: 'LITOTRIPSIA FLEXÍVEL + CATETER DUPLO J - R$ 1.100,00' },
        { codes: ['04.09.01.018-9', '04.09.01.014-6', '04.09.01.017-0'], totalValue: 1200.00, description: 'LITOTRIPSIA + EXTRAÇÃO CÁLCULO + CATETER - R$ 1.200,00' },
        { codes: ['04.09.01.018-9', '04.09.01.059-6', '04.09.01.014-6', '04.09.01.017-0'], totalValue: 1300.00, description: 'LITOTRIPSIA + URETEROLITOTRIPSIA + EXTRAÇÃO + CATETER - R$ 1.300,00' },
        { codes: ['04.09.03.004-0', '04.09.01.038-3'], totalValue: 1200.00, description: 'RESSECÇÃO PRÓSTATA + RESSECÇÃO LESÃO VESICAL - R$ 1.200,00' },
        { codes: ['04.09.04.021-5', '04.09.04.019-3'], totalValue: 400.00, description: 'HIDROCELE + RESSECÇÃO BOLSA ESCROTAL - R$ 400,00' },
        { codes: ['04.09.04.021-5', '04.09.04.019-3', '04.09.04.017-7'], totalValue: 500.00, description: 'HIDROCELE + RESSECÇÃO + PLÁSTICA BOLSA - R$ 500,00' },
        { codes: ['04.09.04.013-4', '04.09.04.017-7'], totalValue: 550.00, description: 'ORQUIDOPEXIA UNILATERAL + PLÁSTICA BOLSA - R$ 550,00' },
        { codes: ['04.09.04.012-6', '04.09.04.017-7'], totalValue: 550.00, description: 'ORQUIDOPEXIA BILATERAL + PLÁSTICA BOLSA - R$ 550,00' },
        { codes: ['04.09.01.032-4', '04.09.01.057-0'], totalValue: 1000.00, description: 'PIELOPLASTIA + URETEROPLASTIA - R$ 1.000,00' },
        { codes: ['04.09.01.032-4', '04.09.01.057-0', '04.09.01.017-0'], totalValue: 1100.00, description: 'PIELOPLASTIA + URETEROPLASTIA + CATETER DUPLO J - R$ 1.100,00' }
      ]
    },

    'WALTER COLONELLO FILHO': {
      doctorName: 'WALTER COLONELLO FILHO',
      rules: [
        { procedureCode: '04.09.01.023-5', standardValue: 1000.00, description: 'NEFROLITOTOMIA PERCUTÂNEA - R$ 1.000,00' },
        { procedureCode: '04.09.01.059-6', standardValue: 900.00, description: 'URETEROLITOTRIPSIA TRANSURETEROSCÓPICA (SEMIRRÍGIDA) - R$ 900,00' },
        { procedureCode: '04.09.01.018-9', standardValue: 1000.00, description: 'LITOTRIPSIA (FLEXÍVEL) - R$ 1.000,00' },
        { procedureCode: '04.09.01.017-0', standardValue: 250.00, description: 'INSTALAÇÃO ENDOSCÓPICA DE CATETER DUPLO J - R$ 250,00' },
        { procedureCode: '04.09.03.004-0', standardValue: 1000.00, description: 'RESSECÇÃO ENDOSCÓPICA DE PRÓSTATA - R$ 1.000,00' },
        { procedureCode: '04.09.03.002-3', standardValue: 1000.00, description: 'PROSTATECTOMIA SUPRAPÚBICA - R$ 1.000,00' },
        { procedureCode: '04.09.04.021-5', standardValue: 300.00, description: 'TRATAMENTO CIRÚRGICO DE HIDROCELE - R$ 300,00' },
        { procedureCode: '04.09.05.008-3', standardValue: 250.00, description: 'POSTECTOMIA - R$ 250,00' },
        { procedureCode: '04.09.04.024-0', standardValue: 450.00, description: 'VASECTOMIA - R$ 450,00' },
        { procedureCode: '04.09.04.023-1', standardValue: 250.00, description: 'TRATAMENTO CIRÚRGICO DE VARICOCELE - R$ 250,00' },
        { procedureCode: '04.09.04.013-4', standardValue: 400.00, description: 'ORQUIDOPEXIA UNILATERAL - R$ 400,00' },
        { procedureCode: '04.09.04.012-6', standardValue: 450.00, description: 'ORQUIDOPEXIA BILATERAL - R$ 450,00' },
        { procedureCode: '04.09.01.006-5', standardValue: 600.00, description: 'CISTOLITOTOMIA E/OU RETIRADA DE CORPO ESTRANHO DA BEXIGA - R$ 600,00' },
        { procedureCode: '04.09.05.007-5', standardValue: 500.00, description: 'PLÁSTICA TOTAL DO PÊNIS (INCLUI PEYRONIE) - R$ 500,00' },
        { procedureCode: 'RESSECÇÃO_CISTOS', standardValue: 250.00, description: 'RESSECÇÃO DE CISTOS/CAUTERIZAÇÕES - R$ 250,00' },
        { procedureCode: '04.09.04.016-9', standardValue: 500.00, description: 'ORQUIECTOMIA UNILATERAL - R$ 500,00' },
        { procedureCode: '04.09.01.032-4', standardValue: 700.00, description: 'PIELOPLASTIA - R$ 700,00' },
        { procedureCode: '04.09.01.021-9', standardValue: 1200.00, description: 'NEFRECTOMIA TOTAL - R$ 1.200,00' },
        { procedureCode: '04.09.01.020-0', standardValue: 1000.00, description: 'NEFRECTOMIA PARCIAL - R$ 1.000,00' },
        { procedureCode: '04.09.01.022-7', standardValue: 900.00, description: 'NEFROLITOTOMIA (ANATRÓFICA) - R$ 900,00' },
        { procedureCode: '04.09.01.029-4', standardValue: 400.00, description: 'NEFROSTOMIA PERCUTÂNEA - R$ 400,00' },
        { procedureCode: '04.09.02.017-6', standardValue: 250.00, description: 'URETROTOMIA INTERNA - R$ 250,00' }
      ],
      multipleRules: [
        { codes: ['04.09.01.023-5', '04.09.01.017-0'], totalValue: 1100.00, description: 'NEFROLITOTOMIA PERCUTÂNEA + INSTALAÇÃO CATETER DUPLO J - R$ 1.100,00' },
        { codes: ['04.09.01.023-5', '04.09.01.014-6'], totalValue: 1300.00, description: 'NEFROLITOTOMIA PERCUTÂNEA + EXTRAÇÃO CÁLCULO PELVE RENAL - R$ 1.300,00' },
        { codes: ['04.09.01.023-5', '04.09.01.017-0', '04.09.01.014-6'], totalValue: 1400.00, description: 'NEFROLITOTOMIA + CATETER DUPLO J + EXTRAÇÃO CÁLCULO - R$ 1.400,00' },
        { codes: ['04.09.01.023-5', '04.09.01.014-6', '04.09.01.059-6'], totalValue: 1500.00, description: 'NEFROLITOTOMIA + EXTRAÇÃO CÁLCULO + URETEROLITOTRIPSIA - R$ 1.500,00' },
        { codes: ['04.09.01.023-5', '04.09.01.017-0', '04.09.01.014-6', '04.09.01.059-6'], totalValue: 1600.00, description: 'NEFROLITOTOMIA + CATETER + EXTRAÇÃO + URETEROLITOTRIPSIA - R$ 1.600,00' },
        { codes: ['04.09.01.059-6', '04.09.01.017-0'], totalValue: 1000.00, description: 'URETEROLITOTRIPSIA + CATETER DUPLO J - R$ 1.000,00' },
        { codes: ['04.09.01.018-9', '04.09.01.017-0'], totalValue: 1100.00, description: 'LITOTRIPSIA FLEXÍVEL + CATETER DUPLO J - R$ 1.100,00' },
        { codes: ['04.09.01.018-9', '04.09.01.014-6', '04.09.01.017-0'], totalValue: 1200.00, description: 'LITOTRIPSIA + EXTRAÇÃO CÁLCULO + CATETER - R$ 1.200,00' },
        { codes: ['04.09.01.018-9', '04.09.01.059-6', '04.09.01.014-6', '04.09.01.017-0'], totalValue: 1300.00, description: 'LITOTRIPSIA + URETEROLITOTRIPSIA + EXTRAÇÃO + CATETER - R$ 1.300,00' },
        { codes: ['04.09.03.004-0', '04.09.01.038-3'], totalValue: 1200.00, description: 'RESSECÇÃO PRÓSTATA + RESSECÇÃO LESÃO VESICAL - R$ 1.200,00' },
        { codes: ['04.09.04.021-5', '04.09.04.019-3'], totalValue: 400.00, description: 'HIDROCELE + RESSECÇÃO BOLSA ESCROTAL - R$ 400,00' },
        { codes: ['04.09.04.021-5', '04.09.04.019-3', '04.09.04.017-7'], totalValue: 500.00, description: 'HIDROCELE + RESSECÇÃO + PLÁSTICA BOLSA - R$ 500,00' },
        { codes: ['04.09.04.013-4', '04.09.04.017-7'], totalValue: 550.00, description: 'ORQUIDOPEXIA UNILATERAL + PLÁSTICA BOLSA - R$ 550,00' },
        { codes: ['04.09.04.012-6', '04.09.04.017-7'], totalValue: 550.00, description: 'ORQUIDOPEXIA BILATERAL + PLÁSTICA BOLSA - R$ 550,00' },
        { codes: ['04.09.01.032-4', '04.09.01.057-0'], totalValue: 1000.00, description: 'PIELOPLASTIA + URETEROPLASTIA - R$ 1.000,00' },
        { codes: ['04.09.01.032-4', '04.09.01.057-0', '04.09.01.017-0'], totalValue: 1100.00, description: 'PIELOPLASTIA + URETEROPLASTIA + CATETER DUPLO J - R$ 1.100,00' }
      ]
    },

    // ================================================================
    // 🏥 CIRURGIÃO DE MÃO - FOZ DO IGUAÇU
    // Especialidade: Cirurgia de Mão
    // Data: Novembro 2025
    // ================================================================

    'DIOGO ALBERTO LOPES BADER': {
      doctorName: 'DIOGO ALBERTO LOPES BADER',
      rules: [
        // 🦴 ARTROPLASTIA DE QUADRIL (adicionado em 19/11/2025)
        {
          procedureCode: '04.08.04.009-2',
          standardValue: 2500.00,
          description: 'ARTROPLASTIA TOTAL PRIMARIA DO QUADRIL NÃO CIMENTADA / HÍBRIDA - R$ 2.500,00'
        },
        // 🖐️ CIRURGIA DE MÃO
        {
          procedureCode: '04.03.02.012-3',
          standardValue: 850.00,
          description: 'TRATAMENTO CIRURGICO DE SINDROME COMPRESSIVA EM TUNEL OSTEO FIBROSO AO NIVEL DO CARPO - R$ 850,00'
        },
        {
          procedureCode: '04.08.02.032-6',
          standardValue: 850.00,
          description: 'TRATAMENTO CIRÚRGICO DE DEDO EM GATILHO - R$ 850,00'
        },
        {
          procedureCode: '04.08.06.044-1',
          standardValue: 850.00,
          description: 'TENÓLISE - R$ 850,00'
        },
        {
          procedureCode: '04.03.02.005-0',
          standardValue: 850.00,
          description: 'MICRONEUROLISE DE NERVO PERIFERICO - R$ 850,00'
        },
        {
          procedureCode: '04.08.02.055-5',
          standardValue: 850.00,
          description: 'TRATAMENTO CIRÚRGICO DE PSEUDARTROSE / RETARDO DE CONSOLIDAÇÃO / PERDA ÓSSEA DA MÃO - R$ 850,00'
        },
        {
          procedureCode: '04.03.02.013-1',
          standardValue: 850.00,
          description: 'TRATAMENTO MICROCIRÚRGICO DE TUMOR DE NERVO PERIFÉRICO / NEUROMA - R$ 850,00'
        },
        {
          procedureCode: '04.08.06.031-0',
          standardValue: 850.00,
          description: 'RESSECÇÃO SIMPLES DE TUMOR ÓSSEO / DE PARTES MOLES - R$ 850,00'
        },
        {
          procedureCode: '04.08.02.061-0',
          standardValue: 850.00,
          description: 'TRATAMENTO CIRÚRGICO DE ROTURA / DESINSERÇÃO / ARRANCAMENTO CAPSULOTENO-LIGAMENTAR NA MÃO - R$ 850,00'
        },
        {
          procedureCode: '04.08.02.034-2',
          standardValue: 850.00,
          description: 'TRATAMENTO CIRÚRGICO DE FRATURA / LESÃO FISARIA DAS FALANGES DA MÃO (COM FIXAÇÃO) - R$ 850,00'
        },
        {
          procedureCode: '04.08.06.018-2',
          standardValue: 850.00,
          description: 'OSTEOTOMIA DE OSSOS DA MÃO E/OU DO PÉ - R$ 850,00'
        },
        {
          procedureCode: '04.08.05.090-0',
          standardValue: 850.00,
          description: 'TRATAMENTO CIRÚRGICO DO HALUX RIGIDUS - R$ 850,00'
        },
        {
          procedureCode: '04.08.05.008-0',
          standardValue: 850.00,
          description: 'FASCIOTOMIA DE MEMBROS INFERIORES - R$ 850,00'
        },
        {
          procedureCode: '04.08.06.021-2',
          standardValue: 850.00,
          description: 'RESSECÇÃO DE CISTO SINOVIAL - R$ 850,00'
        },
        {
          procedureCode: '04.08.04.009-2',
          standardValue: 2500.00,
          description: 'ARTROPLASTIA TOTAL PRIMARIA DO QUADRIL NÃO CIMENTADA / HÍBRIDA - R$ 2.500,00'
        },
        {
          procedureCode: '04.08.05.089-6',
          standardValue: 900.00,
          description: 'TRATAMENTO CIRÚRGICO DE ROTURA DO MENISCO COM MENISCECTOMIA PARCIAL / TOTAL - R$ 900,00'
        },
        {
          procedureCode: '04.08.05.088-8',
          standardValue: 1000.00,
          description: 'TRATAMENTO CIRÚRGICO DE ROTURA DE MENISCO COM SUTURA MENISCAL UNI / BICOMPARTIMENTAL - R$ 1.000,00'
        },
        {
          procedureCode: '04.08.05.016-0',
          standardValue: 2000.00,
          description: 'RECONSTRUÇÃO LIGAMENTAR INTRA-ARTICULAR DO JOELHO (CRUZADO ANTERIOR) - R$ 2.000,00'
        },
        {
          procedureCode: '04.08.05.015-2',
          standardValue: 750.00,
          description: 'RECONSTRUÇÃO LIGAMENTAR EXTRA-ARTICULAR DO JOELHO - R$ 750,00'
        },
        {
          procedureCode: '04.08.05.006-3',
          standardValue: 2000.00,
          description: 'ARTROPLASTIA TOTAL PRIMÁRIA DO JOELHO - R$ 2.000,00'
        }
      ],
      multipleRules: [
        {
          codes: ['04.08.01.014-2', '04.08.06.071-9'],
          totalValue: 1200.00,
          description: 'REPARO DE ROTURA DO MANGUITO ROTADOR + VIDEOARTROSCOPIA - R$ 1.200,00'
        }
      ]
    },

    // ================================================================
    // 🏥 ORTOPEDISTAS - ARTROPLASTIA DE JOELHO - FOZ DO IGUAÇU
    // Especialidade: Ortopedia e Traumatologia
    // Data: Novembro 2025
    // Total: 2 médicos com mesmas regras (ANDRE FELIPE removido pois está duplicado na seção de Quadril)
    // ================================================================

    'VILSON DALMINA': {
      doctorName: 'VILSON DALMINA',
      rules: [
        {
          procedureCode: '04.08.05.006-3',
          standardValue: 2000.00,
          description: 'ARTROPLASTIA TOTAL PRIMÁRIA DO JOELHO - R$ 2.000,00'
        },
        {
          procedureCode: '04.08.04.009-2',
          standardValue: 2500.00,
          description: 'ARTROPLASTIA TOTAL PRIMARIA DO QUADRIL NÃO CIMENTADA / HÍBRIDA - R$ 2.500,00'
        }
      ]
    },

    'JULIO MIZUTA JUNIOR': {
      doctorName: 'JULIO MIZUTA JUNIOR',
      rules: [
        {
          procedureCode: '04.08.05.006-3',
          standardValue: 2000.00,
          description: 'ARTROPLASTIA TOTAL PRIMÁRIA DO JOELHO - R$ 2.000,00'
        },
        {
          procedureCode: '04.08.04.009-2',
          standardValue: 2500.00,
          description: 'ARTROPLASTIA TOTAL PRIMARIA DO QUADRIL NÃO CIMENTADA / HÍBRIDA - R$ 2.500,00'
        }
      ]
    },

    'DAMIANNE REIS BERTONSELLO': {
      doctorName: 'DAMIANNE REIS BERTONSELLO',
      rules: [
        {
          procedureCode: '04.08.05.006-3',
          standardValue: 2000.00,
          description: 'ARTROPLASTIA TOTAL PRIMÁRIA DO JOELHO - R$ 2.000,00'
        },
        {
          procedureCode: '04.08.04.009-2',
          standardValue: 2500.00,
          description: 'ARTROPLASTIA TOTAL PRIMARIA DO QUADRIL NÃO CIMENTADA / HÍBRIDA - R$ 2.500,00'
        }
      ]
    },

    'ANDRE FELIPE AGUIAR RABELO': {
      doctorName: 'ANDRE FELIPE AGUIAR RABELO',
      rules: [
        {
          procedureCode: '04.08.04.009-2',
          standardValue: 2500.00,
          description: 'ARTROPLASTIA TOTAL PRIMARIA DO QUADRIL NÃO CIMENTADA / HÍBRIDA - R$ 2.500,00'
        }
      ]
    }
  },

  // ================================================================
  // HOSPITAL MATERNIDADE NOSSA SENHORA APARECIDA - FAZENDA RIO GRANDE (FRG)
  // Hospital ID: a8978eaa-b90e-4dc8-8fd5-0af984374d34
  // ================================================================
  'HOSPITAL_MATERNIDADE_NOSSA_SENHORA_APARECIDA_FRG': {
    // ================================================================
    // 🏥 CIRURGIÕES GERAIS - FAZENDA RIO GRANDE
    // Baseado nas regras do Dr. JOAO VICTOR RODRIGUES (Torao Tokuda)
    // Data: 19/11/2025
    // Total: 2 médicos com mesmas regras
    // ================================================================
    
    'PEDRO ROGERIO DE SÁ NEVES': {
      doctorName: 'PEDRO ROGERIO DE SÁ NEVES',
      rules: [
        // ================================================================
        // 🏥 PROCEDIMENTO PRINCIPAL - COLECISTECTOMIA BASE
        // Mesmas regras do Dr. JOAO VICTOR RODRIGUES
        // Última atualização: 19/11/2025
        // ================================================================
        {
          procedureCode: '04.07.03.002-6',
          standardValue: 900.00,
          description: 'COLECISTECTOMIA (PRINCIPAL) - R$ 900,00'
        },
        
        // ================================================================
        // 🔧 PROCEDIMENTOS SEQUENCIAIS - SOMAM À COLECISTECTOMIA
        // Limite: até 4 procedimentos sequenciais
        // ================================================================
        {
          procedureCode: '04.07.04.018-8',
          standardValue: 300.00,
          description: 'LIBERAÇÃO DE ADERÊNCIAS INTESTINAIS - R$ 300,00'
        },
        {
          procedureCode: '04.07.04.002-1',
          standardValue: 300.00,
          description: 'DRENAGEM DE ABSCESSO SUBFRÊNICO - R$ 300,00'
        },
        {
          procedureCode: '04.07.03.014-0',
          standardValue: 300.00,
          description: 'HEPATORRAFIA - R$ 300,00'
        },
        {
          procedureCode: '04.07.03.006-9',
          standardValue: 250.00,
          description: 'COLEDOCOTOMIA - R$ 250,00'
        },
        {
          procedureCode: '04.07.03.005-0',
          standardValue: 200.00,
          description: 'COLEDOCOPLASTIA - R$ 200,00'
        },
        
        // ================================================================
        // 🏥 HÉRNIAS COMO PROCEDIMENTO PRINCIPAL
        // ================================================================
        {
          procedureCode: '04.07.04.010-2',
          standardValue: 700.00,
          description: 'HERNIOPLASTIA INGUINAL UNILATERAL (PRINCIPAL) - R$ 700,00'
        },
        {
          procedureCode: '04.07.04.009-9',
          standardValue: 700.00,
          description: 'HERNIOPLASTIA INGUINAL BILATERAL (PRINCIPAL) - R$ 700,00'
        },
        {
          procedureCode: '04.07.04.006-4',
          standardValue: 800.00,
          description: 'HERNIOPLASTIA EPIGÁSTRICA (PRINCIPAL) - R$ 800,00'
        },
        {
          procedureCode: '04.07.04.012-9',
          standardValue: 450.00,
          description: 'HERNIOPLASTIA UMBILICAL (PRINCIPAL) - R$ 450,00'
        },
        {
          procedureCode: '04.07.04.008-0',
          standardValue: 600.00,
          description: 'HERNIOPLASTIA INCISIONAL/VENTRAL (PRINCIPAL) - R$ 600,00'
        },
        
        // ================================================================
        // 🆕 PROCEDIMENTOS ORIFICIAIS - FÍSTULAS, FISSURAS E HEMORRÓIDAS
        // Valor padrão: R$ 450,00 por procedimento
        // ================================================================
        {
          procedureCode: '04.07.02.027-6',
          standardValue: 450.00,
          description: 'FISTULECTOMIA/FISTULOTOMIA ANAL - R$ 450,00'
        },
        {
          procedureCode: '04.07.02.028-4',
          standardValue: 450.00,
          description: 'HEMORROIDECTOMIA - R$ 450,00'
        },
        {
          procedureCode: '04.07.02.031-4',
          standardValue: 450.00,
          description: 'TRATAMENTO CIRÚRGICO DE FISSURA ANAL - R$ 450,00'
        },
        
        // ================================================================
        // 🆕 CISTOS E LIPOMAS
        // Valor padrão: R$ 250,00 por procedimento
        // ================================================================
        {
          procedureCode: '04.01.02.007-0',
          standardValue: 250.00,
          description: 'EXÉRESE DE CISTO DERMOIDE - R$ 250,00'
        },
        {
          procedureCode: '04.01.02.010-0',
          standardValue: 250.00,
          description: 'EXTIRPAÇÃO E SUPRESSÃO DE LESÃO DE PELE E DE TECIDO SUBCUTÂNEO - R$ 250,00'
        },
        {
          procedureCode: '04.01.02.008-8',
          standardValue: 250.00,
          description: 'EXÉRESE DE LIPOMA - R$ 250,00'
        },
        {
          procedureCode: '04.01.02.009-6',
          standardValue: 250.00,
          description: 'EXÉRESE DE CISTO PILONIDAL - R$ 250,00'
        }
      ],
      
      // ================================================================
      // 🔗 REGRAS MÚLTIPLAS - COLECISTECTOMIA + SEQUENCIAIS
      // Sistema: Colecistectomia R$ 900 + soma dos procedimentos sequenciais
      // ================================================================
      multipleRules: [
        // Colecistectomia + 1 Sequencial
        {
          codes: ['04.07.03.002-6', '04.07.04.018-8'],
          totalValue: 1200.00,
          description: 'COLECISTECTOMIA + LIBERAÇÃO DE ADERÊNCIAS - R$ 1.200,00'
        },
        {
          codes: ['04.07.03.002-6', '04.07.04.002-1'],
          totalValue: 1200.00,
          description: 'COLECISTECTOMIA + DRENAGEM ABSCESSO SUBFRÊNICO - R$ 1.200,00'
        },
        {
          codes: ['04.07.03.002-6', '04.07.03.014-0'],
          totalValue: 1200.00,
          description: 'COLECISTECTOMIA + HEPATORRAFIA - R$ 1.200,00'
        },
        {
          codes: ['04.07.03.002-6', '04.07.03.006-9'],
          totalValue: 1150.00,
          description: 'COLECISTECTOMIA + COLEDOCOTOMIA - R$ 1.150,00'
        },
        {
          codes: ['04.07.03.002-6', '04.07.03.005-0'],
          totalValue: 1100.00,
          description: 'COLECISTECTOMIA + COLEDOCOPLASTIA - R$ 1.100,00'
        },
        
        // Colecistectomia + Hérnias
        {
          codes: ['04.07.03.002-6', '04.07.04.010-2'],
          totalValue: 1600.00,
          description: 'COLECISTECTOMIA + HERNIOPLASTIA INGUINAL UNILATERAL - R$ 1.600,00'
        },
        {
          codes: ['04.07.03.002-6', '04.07.04.009-9'],
          totalValue: 1600.00,
          description: 'COLECISTECTOMIA + HERNIOPLASTIA INGUINAL BILATERAL - R$ 1.600,00'
        },
        {
          codes: ['04.07.03.002-6', '04.07.04.006-4'],
          totalValue: 1700.00,
          description: 'COLECISTECTOMIA + HERNIOPLASTIA EPIGÁSTRICA - R$ 1.700,00'
        },
        {
          codes: ['04.07.03.002-6', '04.07.04.012-9'],
          totalValue: 1350.00,
          description: 'COLECISTECTOMIA + HERNIOPLASTIA UMBILICAL - R$ 1.350,00'
        },
        {
          codes: ['04.07.03.002-6', '04.07.04.008-0'],
          totalValue: 1500.00,
          description: 'COLECISTECTOMIA + HERNIOPLASTIA INCISIONAL/VENTRAL - R$ 1.500,00'
        },
        
        // Colecistectomia + 2 Sequenciais
        {
          codes: ['04.07.03.002-6', '04.07.04.018-8', '04.07.03.014-0'],
          totalValue: 1500.00,
          description: 'COLECISTECTOMIA + LIBERAÇÃO ADERÊNCIAS + HEPATORRAFIA - R$ 1.500,00'
        },
        {
          codes: ['04.07.03.002-6', '04.07.03.006-9', '04.07.03.005-0'],
          totalValue: 1350.00,
          description: 'COLECISTECTOMIA + COLEDOCOTOMIA + COLEDOCOPLASTIA - R$ 1.350,00'
        },
        
        // Colecistectomia + 3 Sequenciais
        {
          codes: ['04.07.03.002-6', '04.07.04.018-8', '04.07.03.014-0', '04.07.04.002-1'],
          totalValue: 1800.00,
          description: 'COLECISTECTOMIA + LIBERAÇÃO + HEPATORRAFIA + DRENAGEM - R$ 1.800,00'
        },
        
        // Colecistectomia + 4 Sequenciais (máximo)
        {
          codes: ['04.07.03.002-6', '04.07.04.018-8', '04.07.03.014-0', '04.07.04.002-1', '04.07.03.006-9'],
          totalValue: 2050.00,
          description: 'COLECISTECTOMIA + 4 SEQUENCIAIS (MÁXIMO) - R$ 2.050,00'
        },
        
        // ================================================================
        // 🆕 REGRAS DE MÚLTIPLAS HÉRNIAS
        // Nova lógica: 1ª hérnia = valor original, 2ª+ hérnias = R$ 300,00
        // ================================================================
        
        // Combinações com HERNIOPLASTIA INGUINAL UNILATERAL como 1ª
        {
          codes: ['04.07.04.010-2', '04.07.04.009-9'],
          totalValue: 1000.00,
          description: 'INGUINAL UNILATERAL (1ª) + INGUINAL BILATERAL (2ª) - R$ 1.000,00'
        },
        {
          codes: ['04.07.04.010-2', '04.07.04.006-4'],
          totalValue: 1000.00,
          description: 'INGUINAL UNILATERAL (1ª) + EPIGÁSTRICA (2ª) - R$ 1.000,00'
        },
        {
          codes: ['04.07.04.010-2', '04.07.04.012-9'],
          totalValue: 1000.00,
          description: 'INGUINAL UNILATERAL (1ª) + UMBILICAL (2ª) - R$ 1.000,00'
        },
        {
          codes: ['04.07.04.010-2', '04.07.04.008-0'],
          totalValue: 1000.00,
          description: 'INGUINAL UNILATERAL (1ª) + INCISIONAL/VENTRAL (2ª) - R$ 1.000,00'
        },
        
        // Combinações com HERNIOPLASTIA INGUINAL BILATERAL como 1ª
        {
          codes: ['04.07.04.009-9', '04.07.04.010-2'],
          totalValue: 1000.00,
          description: 'INGUINAL BILATERAL (1ª) + INGUINAL UNILATERAL (2ª) - R$ 1.000,00'
        },
        {
          codes: ['04.07.04.009-9', '04.07.04.006-4'],
          totalValue: 1000.00,
          description: 'INGUINAL BILATERAL (1ª) + EPIGÁSTRICA (2ª) - R$ 1.000,00'
        },
        {
          codes: ['04.07.04.009-9', '04.07.04.012-9'],
          totalValue: 1000.00,
          description: 'INGUINAL BILATERAL (1ª) + UMBILICAL (2ª) - R$ 1.000,00'
        },
        {
          codes: ['04.07.04.009-9', '04.07.04.008-0'],
          totalValue: 1000.00,
          description: 'INGUINAL BILATERAL (1ª) + INCISIONAL/VENTRAL (2ª) - R$ 1.000,00'
        },
        
        // Combinações com HERNIOPLASTIA EPIGÁSTRICA como 1ª
        {
          codes: ['04.07.04.006-4', '04.07.04.010-2'],
          totalValue: 1100.00,
          description: 'EPIGÁSTRICA (1ª) + INGUINAL UNILATERAL (2ª) - R$ 1.100,00'
        },
        {
          codes: ['04.07.04.006-4', '04.07.04.009-9'],
          totalValue: 1100.00,
          description: 'EPIGÁSTRICA (1ª) + INGUINAL BILATERAL (2ª) - R$ 1.100,00'
        },
        {
          codes: ['04.07.04.006-4', '04.07.04.012-9'],
          totalValue: 1100.00,
          description: 'EPIGÁSTRICA (1ª) + UMBILICAL (2ª) - R$ 1.100,00'
        },
        {
          codes: ['04.07.04.006-4', '04.07.04.008-0'],
          totalValue: 1100.00,
          description: 'EPIGÁSTRICA (1ª) + INCISIONAL/VENTRAL (2ª) - R$ 1.100,00'
        },
        
        // Combinações com HERNIOPLASTIA UMBILICAL como 1ª
        {
          codes: ['04.07.04.012-9', '04.07.04.010-2'],
          totalValue: 750.00,
          description: 'UMBILICAL (1ª) + INGUINAL UNILATERAL (2ª) - R$ 750,00'
        },
        {
          codes: ['04.07.04.012-9', '04.07.04.009-9'],
          totalValue: 750.00,
          description: 'UMBILICAL (1ª) + INGUINAL BILATERAL (2ª) - R$ 750,00'
        },
        {
          codes: ['04.07.04.012-9', '04.07.04.006-4'],
          totalValue: 750.00,
          description: 'UMBILICAL (1ª) + EPIGÁSTRICA (2ª) - R$ 750,00'
        },
        {
          codes: ['04.07.04.012-9', '04.07.04.008-0'],
          totalValue: 750.00,
          description: 'UMBILICAL (1ª) + INCISIONAL/VENTRAL (2ª) - R$ 750,00'
        },
        
        // Combinações com HERNIOPLASTIA INCISIONAL/VENTRAL como 1ª
        {
          codes: ['04.07.04.008-0', '04.07.04.010-2'],
          totalValue: 900.00,
          description: 'INCISIONAL/VENTRAL (1ª) + INGUINAL UNILATERAL (2ª) - R$ 900,00'
        },
        {
          codes: ['04.07.04.008-0', '04.07.04.009-9'],
          totalValue: 900.00,
          description: 'INCISIONAL/VENTRAL (1ª) + INGUINAL BILATERAL (2ª) - R$ 900,00'
        },
        {
          codes: ['04.07.04.008-0', '04.07.04.006-4'],
          totalValue: 900.00,
          description: 'INCISIONAL/VENTRAL (1ª) + EPIGÁSTRICA (2ª) - R$ 900,00'
        },
        {
          codes: ['04.07.04.008-0', '04.07.04.012-9'],
          totalValue: 900.00,
          description: 'INCISIONAL/VENTRAL (1ª) + UMBILICAL (2ª) - R$ 900,00'
        },
        
        // Combinações de 3 hérnias
        {
          codes: ['04.07.04.006-4', '04.07.04.010-2', '04.07.04.012-9'],
          totalValue: 1400.00,
          description: 'EPIGÁSTRICA (1ª) + INGUINAL UNILATERAL (2ª) + UMBILICAL (3ª) - R$ 1.400,00'
        },
        {
          codes: ['04.07.04.006-4', '04.07.04.009-9', '04.07.04.012-9'],
          totalValue: 1400.00,
          description: 'EPIGÁSTRICA (1ª) + INGUINAL BILATERAL (2ª) + UMBILICAL (3ª) - R$ 1.400,00'
        },
        {
          codes: ['04.07.04.010-2', '04.07.04.012-9', '04.07.04.008-0'],
          totalValue: 1300.00,
          description: 'INGUINAL UNILATERAL (1ª) + UMBILICAL (2ª) + INCISIONAL (3ª) - R$ 1.300,00'
        },
        
        // Combinações de 4 hérnias
        {
          codes: ['04.07.04.006-4', '04.07.04.010-2', '04.07.04.012-9', '04.07.04.008-0'],
          totalValue: 1700.00,
          description: 'EPIGÁSTRICA (1ª) + INGUINAL UNI (2ª) + UMBILICAL (3ª) + INCISIONAL (4ª) - R$ 1.700,00'
        }
      ]
    },

    'LEONARDO FLORES': {
      doctorName: 'LEONARDO FLORES',
      rules: [
        // ================================================================
        // 🏥 PROCEDIMENTO PRINCIPAL - COLECISTECTOMIA BASE
        // Mesmas regras do Dr. JOAO VICTOR RODRIGUES
        // Última atualização: 19/11/2025
        // ================================================================
        {
          procedureCode: '04.07.03.002-6',
          standardValue: 900.00,
          description: 'COLECISTECTOMIA (PRINCIPAL) - R$ 900,00'
        },
        
        // ================================================================
        // 🔧 PROCEDIMENTOS SEQUENCIAIS - SOMAM À COLECISTECTOMIA
        // Limite: até 4 procedimentos sequenciais
        // ================================================================
        {
          procedureCode: '04.07.04.018-8',
          standardValue: 300.00,
          description: 'LIBERAÇÃO DE ADERÊNCIAS INTESTINAIS - R$ 300,00'
        },
        {
          procedureCode: '04.07.04.002-1',
          standardValue: 300.00,
          description: 'DRENAGEM DE ABSCESSO SUBFRÊNICO - R$ 300,00'
        },
        {
          procedureCode: '04.07.03.014-0',
          standardValue: 300.00,
          description: 'HEPATORRAFIA - R$ 300,00'
        },
        {
          procedureCode: '04.07.03.006-9',
          standardValue: 250.00,
          description: 'COLEDOCOTOMIA - R$ 250,00'
        },
        {
          procedureCode: '04.07.03.005-0',
          standardValue: 200.00,
          description: 'COLEDOCOPLASTIA - R$ 200,00'
        },
        
        // ================================================================
        // 🏥 HÉRNIAS COMO PROCEDIMENTO PRINCIPAL
        // ================================================================
        {
          procedureCode: '04.07.04.010-2',
          standardValue: 700.00,
          description: 'HERNIOPLASTIA INGUINAL UNILATERAL (PRINCIPAL) - R$ 700,00'
        },
        {
          procedureCode: '04.07.04.009-9',
          standardValue: 700.00,
          description: 'HERNIOPLASTIA INGUINAL BILATERAL (PRINCIPAL) - R$ 700,00'
        },
        {
          procedureCode: '04.07.04.006-4',
          standardValue: 800.00,
          description: 'HERNIOPLASTIA EPIGÁSTRICA (PRINCIPAL) - R$ 800,00'
        },
        {
          procedureCode: '04.07.04.012-9',
          standardValue: 450.00,
          description: 'HERNIOPLASTIA UMBILICAL (PRINCIPAL) - R$ 450,00'
        },
        {
          procedureCode: '04.07.04.008-0',
          standardValue: 600.00,
          description: 'HERNIOPLASTIA INCISIONAL/VENTRAL (PRINCIPAL) - R$ 600,00'
        },
        
        // ================================================================
        // 🆕 PROCEDIMENTOS ORIFICIAIS - FÍSTULAS, FISSURAS E HEMORRÓIDAS
        // Valor padrão: R$ 450,00 por procedimento
        // ================================================================
        {
          procedureCode: '04.07.02.027-6',
          standardValue: 450.00,
          description: 'FISTULECTOMIA/FISTULOTOMIA ANAL - R$ 450,00'
        },
        {
          procedureCode: '04.07.02.028-4',
          standardValue: 450.00,
          description: 'HEMORROIDECTOMIA - R$ 450,00'
        },
        {
          procedureCode: '04.07.02.031-4',
          standardValue: 450.00,
          description: 'TRATAMENTO CIRÚRGICO DE FISSURA ANAL - R$ 450,00'
        },
        
        // ================================================================
        // 🆕 CISTOS E LIPOMAS
        // Valor padrão: R$ 250,00 por procedimento
        // ================================================================
        {
          procedureCode: '04.01.02.007-0',
          standardValue: 250.00,
          description: 'EXÉRESE DE CISTO DERMOIDE - R$ 250,00'
        },
        {
          procedureCode: '04.01.02.010-0',
          standardValue: 250.00,
          description: 'EXTIRPAÇÃO E SUPRESSÃO DE LESÃO DE PELE E DE TECIDO SUBCUTÂNEO - R$ 250,00'
        },
        {
          procedureCode: '04.01.02.008-8',
          standardValue: 250.00,
          description: 'EXÉRESE DE LIPOMA - R$ 250,00'
        },
        {
          procedureCode: '04.01.02.009-6',
          standardValue: 250.00,
          description: 'EXÉRESE DE CISTO PILONIDAL - R$ 250,00'
        }
      ],
      
      // ================================================================
      // 🔗 REGRAS MÚLTIPLAS - COLECISTECTOMIA + SEQUENCIAIS
      // Sistema: Colecistectomia R$ 900 + soma dos procedimentos sequenciais
      // ================================================================
      multipleRules: [
        // Colecistectomia + 1 Sequencial
        {
          codes: ['04.07.03.002-6', '04.07.04.018-8'],
          totalValue: 1200.00,
          description: 'COLECISTECTOMIA + LIBERAÇÃO DE ADERÊNCIAS - R$ 1.200,00'
        },
        {
          codes: ['04.07.03.002-6', '04.07.04.002-1'],
          totalValue: 1200.00,
          description: 'COLECISTECTOMIA + DRENAGEM ABSCESSO SUBFRÊNICO - R$ 1.200,00'
        },
        {
          codes: ['04.07.03.002-6', '04.07.03.014-0'],
          totalValue: 1200.00,
          description: 'COLECISTECTOMIA + HEPATORRAFIA - R$ 1.200,00'
        },
        {
          codes: ['04.07.03.002-6', '04.07.03.006-9'],
          totalValue: 1150.00,
          description: 'COLECISTECTOMIA + COLEDOCOTOMIA - R$ 1.150,00'
        },
        {
          codes: ['04.07.03.002-6', '04.07.03.005-0'],
          totalValue: 1100.00,
          description: 'COLECISTECTOMIA + COLEDOCOPLASTIA - R$ 1.100,00'
        },
        
        // Colecistectomia + Hérnias
        {
          codes: ['04.07.03.002-6', '04.07.04.010-2'],
          totalValue: 1600.00,
          description: 'COLECISTECTOMIA + HERNIOPLASTIA INGUINAL UNILATERAL - R$ 1.600,00'
        },
        {
          codes: ['04.07.03.002-6', '04.07.04.009-9'],
          totalValue: 1600.00,
          description: 'COLECISTECTOMIA + HERNIOPLASTIA INGUINAL BILATERAL - R$ 1.600,00'
        },
        {
          codes: ['04.07.03.002-6', '04.07.04.006-4'],
          totalValue: 1700.00,
          description: 'COLECISTECTOMIA + HERNIOPLASTIA EPIGÁSTRICA - R$ 1.700,00'
        },
        {
          codes: ['04.07.03.002-6', '04.07.04.012-9'],
          totalValue: 1350.00,
          description: 'COLECISTECTOMIA + HERNIOPLASTIA UMBILICAL - R$ 1.350,00'
        },
        {
          codes: ['04.07.03.002-6', '04.07.04.008-0'],
          totalValue: 1500.00,
          description: 'COLECISTECTOMIA + HERNIOPLASTIA INCISIONAL/VENTRAL - R$ 1.500,00'
        },
        
        // Colecistectomia + 2 Sequenciais
        {
          codes: ['04.07.03.002-6', '04.07.04.018-8', '04.07.03.014-0'],
          totalValue: 1500.00,
          description: 'COLECISTECTOMIA + LIBERAÇÃO ADERÊNCIAS + HEPATORRAFIA - R$ 1.500,00'
        },
        {
          codes: ['04.07.03.002-6', '04.07.03.006-9', '04.07.03.005-0'],
          totalValue: 1350.00,
          description: 'COLECISTECTOMIA + COLEDOCOTOMIA + COLEDOCOPLASTIA - R$ 1.350,00'
        },
        
        // Colecistectomia + 3 Sequenciais
        {
          codes: ['04.07.03.002-6', '04.07.04.018-8', '04.07.03.014-0', '04.07.04.002-1'],
          totalValue: 1800.00,
          description: 'COLECISTECTOMIA + LIBERAÇÃO + HEPATORRAFIA + DRENAGEM - R$ 1.800,00'
        },
        
        // Colecistectomia + 4 Sequenciais (máximo)
        {
          codes: ['04.07.03.002-6', '04.07.04.018-8', '04.07.03.014-0', '04.07.04.002-1', '04.07.03.006-9'],
          totalValue: 2050.00,
          description: 'COLECISTECTOMIA + 4 SEQUENCIAIS (MÁXIMO) - R$ 2.050,00'
        },
        
        // ================================================================
        // 🆕 REGRAS DE MÚLTIPLAS HÉRNIAS
        // Nova lógica: 1ª hérnia = valor original, 2ª+ hérnias = R$ 300,00
        // ================================================================
        
        // Combinações com HERNIOPLASTIA INGUINAL UNILATERAL como 1ª
        {
          codes: ['04.07.04.010-2', '04.07.04.009-9'],
          totalValue: 1000.00,
          description: 'INGUINAL UNILATERAL (1ª) + INGUINAL BILATERAL (2ª) - R$ 1.000,00'
        },
        {
          codes: ['04.07.04.010-2', '04.07.04.006-4'],
          totalValue: 1000.00,
          description: 'INGUINAL UNILATERAL (1ª) + EPIGÁSTRICA (2ª) - R$ 1.000,00'
        },
        {
          codes: ['04.07.04.010-2', '04.07.04.012-9'],
          totalValue: 1000.00,
          description: 'INGUINAL UNILATERAL (1ª) + UMBILICAL (2ª) - R$ 1.000,00'
        },
        {
          codes: ['04.07.04.010-2', '04.07.04.008-0'],
          totalValue: 1000.00,
          description: 'INGUINAL UNILATERAL (1ª) + INCISIONAL/VENTRAL (2ª) - R$ 1.000,00'
        },
        
        // Combinações com HERNIOPLASTIA INGUINAL BILATERAL como 1ª
        {
          codes: ['04.07.04.009-9', '04.07.04.010-2'],
          totalValue: 1000.00,
          description: 'INGUINAL BILATERAL (1ª) + INGUINAL UNILATERAL (2ª) - R$ 1.000,00'
        },
        {
          codes: ['04.07.04.009-9', '04.07.04.006-4'],
          totalValue: 1000.00,
          description: 'INGUINAL BILATERAL (1ª) + EPIGÁSTRICA (2ª) - R$ 1.000,00'
        },
        {
          codes: ['04.07.04.009-9', '04.07.04.012-9'],
          totalValue: 1000.00,
          description: 'INGUINAL BILATERAL (1ª) + UMBILICAL (2ª) - R$ 1.000,00'
        },
        {
          codes: ['04.07.04.009-9', '04.07.04.008-0'],
          totalValue: 1000.00,
          description: 'INGUINAL BILATERAL (1ª) + INCISIONAL/VENTRAL (2ª) - R$ 1.000,00'
        },
        
        // Combinações com HERNIOPLASTIA EPIGÁSTRICA como 1ª
        {
          codes: ['04.07.04.006-4', '04.07.04.010-2'],
          totalValue: 1100.00,
          description: 'EPIGÁSTRICA (1ª) + INGUINAL UNILATERAL (2ª) - R$ 1.100,00'
        },
        {
          codes: ['04.07.04.006-4', '04.07.04.009-9'],
          totalValue: 1100.00,
          description: 'EPIGÁSTRICA (1ª) + INGUINAL BILATERAL (2ª) - R$ 1.100,00'
        },
        {
          codes: ['04.07.04.006-4', '04.07.04.012-9'],
          totalValue: 1100.00,
          description: 'EPIGÁSTRICA (1ª) + UMBILICAL (2ª) - R$ 1.100,00'
        },
        {
          codes: ['04.07.04.006-4', '04.07.04.008-0'],
          totalValue: 1100.00,
          description: 'EPIGÁSTRICA (1ª) + INCISIONAL/VENTRAL (2ª) - R$ 1.100,00'
        },
        
        // Combinações com HERNIOPLASTIA UMBILICAL como 1ª
        {
          codes: ['04.07.04.012-9', '04.07.04.010-2'],
          totalValue: 750.00,
          description: 'UMBILICAL (1ª) + INGUINAL UNILATERAL (2ª) - R$ 750,00'
        },
        {
          codes: ['04.07.04.012-9', '04.07.04.009-9'],
          totalValue: 750.00,
          description: 'UMBILICAL (1ª) + INGUINAL BILATERAL (2ª) - R$ 750,00'
        },
        {
          codes: ['04.07.04.012-9', '04.07.04.006-4'],
          totalValue: 750.00,
          description: 'UMBILICAL (1ª) + EPIGÁSTRICA (2ª) - R$ 750,00'
        },
        {
          codes: ['04.07.04.012-9', '04.07.04.008-0'],
          totalValue: 750.00,
          description: 'UMBILICAL (1ª) + INCISIONAL/VENTRAL (2ª) - R$ 750,00'
        },
        
        // Combinações com HERNIOPLASTIA INCISIONAL/VENTRAL como 1ª
        {
          codes: ['04.07.04.008-0', '04.07.04.010-2'],
          totalValue: 900.00,
          description: 'INCISIONAL/VENTRAL (1ª) + INGUINAL UNILATERAL (2ª) - R$ 900,00'
        },
        {
          codes: ['04.07.04.008-0', '04.07.04.009-9'],
          totalValue: 900.00,
          description: 'INCISIONAL/VENTRAL (1ª) + INGUINAL BILATERAL (2ª) - R$ 900,00'
        },
        {
          codes: ['04.07.04.008-0', '04.07.04.006-4'],
          totalValue: 900.00,
          description: 'INCISIONAL/VENTRAL (1ª) + EPIGÁSTRICA (2ª) - R$ 900,00'
        },
        {
          codes: ['04.07.04.008-0', '04.07.04.012-9'],
          totalValue: 900.00,
          description: 'INCISIONAL/VENTRAL (1ª) + UMBILICAL (2ª) - R$ 900,00'
        },
        
        // Combinações de 3 hérnias
        {
          codes: ['04.07.04.006-4', '04.07.04.010-2', '04.07.04.012-9'],
          totalValue: 1400.00,
          description: 'EPIGÁSTRICA (1ª) + INGUINAL UNILATERAL (2ª) + UMBILICAL (3ª) - R$ 1.400,00'
        },
        {
          codes: ['04.07.04.006-4', '04.07.04.009-9', '04.07.04.012-9'],
          totalValue: 1400.00,
          description: 'EPIGÁSTRICA (1ª) + INGUINAL BILATERAL (2ª) + UMBILICAL (3ª) - R$ 1.400,00'
        },
        {
          codes: ['04.07.04.010-2', '04.07.04.012-9', '04.07.04.008-0'],
          totalValue: 1300.00,
          description: 'INGUINAL UNILATERAL (1ª) + UMBILICAL (2ª) + INCISIONAL (3ª) - R$ 1.300,00'
        },
        
        // Combinações de 4 hérnias
        {
          codes: ['04.07.04.006-4', '04.07.04.010-2', '04.07.04.012-9', '04.07.04.008-0'],
          totalValue: 1700.00,
          description: 'EPIGÁSTRICA (1ª) + INGUINAL UNI (2ª) + UMBILICAL (3ª) + INCISIONAL (4ª) - R$ 1.700,00'
        }
      ]
    },

    // ================================================================
    // 🏥 GINECOLOGISTAS - FAZENDA RIO GRANDE
    // Baseado nas regras da Dra. DJAVANI BLUM (Torao Tokuda)
    // Data: 19/11/2025
    // Total: 3 médicas com mesmas regras
    // ================================================================

    'INGRID BARRETO PINHEIRO': {
      doctorName: 'INGRID BARRETO PINHEIRO',
      rules: [
        // ================================================================
        // 🏥 PROCEDIMENTOS PRINCIPAIS - GINECOLOGIA E OBSTETRÍCIA
        // Mesmas regras da Dra. DJAVANI BLUM
        // Última atualização: 19/11/2025
        // ================================================================
        {
          procedureCode: '04.09.06.013-5',
          standardValue: 1000.00,
          description: 'HISTERECTOMIA TOTAL - R$ 1.000,00'
        },
        {
          procedureCode: '04.09.06.012-7',
          standardValue: 750.00,
          description: 'HISTERECTOMIA SUBTOTAL - R$ 750,00'
        },
        {
          procedureCode: '04.09.06.011-9',
          standardValue: 1200.00,
          description: 'HISTERECTOMIA C/ ANEXECTOMIA (UNI / BILATERAL) - R$ 1.200,00'
        },
        {
          procedureCode: '04.09.06.021-6',
          standardValue: 700.00,
          description: 'OOFORECTOMIA / OOFOROPLASTIA - R$ 700,00'
        },
        {
          procedureCode: '04.09.06.018-6',
          standardValue: 600.00,
          description: 'LAQUEADURA TUBARIA - R$ 600,00'
        },
        {
          procedureCode: '04.09.07.027-0',
          standardValue: 450.00,
          description: 'TRATAMENTO CIRURGICO DE INCONTINÊNCIA URINÁRIA POR VIA VAGINAL - R$ 450,00'
        },
        {
          procedureCode: '04.09.07.006-8',
          standardValue: 450.00,
          description: 'COLPOPERINEOPLASTIA POSTERIOR - R$ 450,00'
        },
        {
          procedureCode: '04.09.07.005-0',
          standardValue: 600.00,
          description: 'COLPOPERINEOPLASTIA ANTERIOR E POSTERIOR - R$ 600,00'
        },
        {
          procedureCode: '04.09.06.004-6',
          standardValue: 250.00,
          description: 'CURETAGEM SEMIOTICA C/ OU S/ DILATACAO DO COLO DO UTERO - R$ 250,00'
        },
        {
          procedureCode: '04.09.07.026-2',
          standardValue: 250.00,
          description: 'TRATAMENTO CIRURGICO DE HIPERTROFIA DOS PEQUENOS LABIOS (NINFOPLASTIA) - R$ 250,00'
        },
        {
          procedureCode: '04.08.06.031-0',
          standardValue: 250.00,
          description: 'RESSECÇÃO SIMPLES DE TUMOR ÓSSEO / DE PARTES MOLES - R$ 250,00'
        },
        {
          procedureCode: '04.09.07.015-7',
          standardValue: 250.00,
          description: 'EXERESE DE GLÂNDULA DE BARTHOLIN / SKENE - R$ 250,00'
        },
        {
          procedureCode: '04.09.07.019-0',
          standardValue: 150.00,
          description: 'MARSUPIALIZAÇÃO DE GLÂNDULA DE BARTOLIN - R$ 150,00'
        },
        {
          procedureCode: '04.09.07.003-3',
          standardValue: 300.00,
          description: 'COLPOCLEISE (CIRURGIA DE LE FORT) - R$ 300,00'
        },
        {
          procedureCode: '04.09.06.019-4',
          standardValue: 550.00,
          description: 'MIOMECTOMIA - R$ 550,00'
        },
        {
          procedureCode: '04.09.07.014-9',
          standardValue: 300.00,
          description: 'EXERESE DE CISTO VAGINAL - R$ 300,00'
        },
        
        // ================================================================
        // 🔧 PROCEDIMENTOS ADICIONAIS - SOMAM AO PROCEDIMENTO PRINCIPAL
        // ================================================================
        {
          procedureCode: '04.09.06.022-4',
          standardValue: 100.00,
          description: 'RESSECCAO DE VARIZES PELVICAS (ADICIONAL AO PROCEDIMENTO PRINCIPAL) - R$ 100,00'
        },
        {
          procedureCode: '04.07.04.018-8',
          standardValue: 300.00,
          description: 'LIBERAÇÃO DE ADERÊNCIAS INTESTINAIS (ADICIONAL AO PROCEDIMENTO PRINCIPAL) - R$ 300,00'
        },
        {
          procedureCode: '04.09.07.009-2',
          standardValue: 100.00,
          description: 'COLPORRAFIA NAO OBSTETRICA (ADICIONAL AO PROCEDIMENTO PRINCIPAL) - R$ 100,00'
        },
        {
          procedureCode: '04.08.06.020-4',
          standardValue: 100.00,
          description: 'REINSERÇÃO MUSCULAR (CORREÇÃO DE DIÁSTESE DE RETO ABDOMINAL - ADICIONAL DO PROCEDIMENTO PRINCIPAL) - R$ 100,00'
        }
      ],
      multipleRules: [
        {
          codes: ['04.09.06.021-6', '04.09.06.023-2'],
          totalValue: 900.00,
          description: 'OOFORECTOMIA/OOFOROPLASTIA + SALPINGECTOMIA - R$ 900,00'
        },
        {
          codes: ['04.09.07.006-8', '04.09.07.027-0'],
          totalValue: 800.00,
          description: 'COLPOPERINEOPLASTIA POSTERIOR + TRATAMENTO INCONTINÊNCIA URINÁRIA - R$ 800,00'
        },
        {
          codes: ['04.09.07.005-0', '04.09.07.027-0'],
          totalValue: 900.00,
          description: 'COLPOPERINEOPLASTIA ANTERIOR E POSTERIOR + TRATAMENTO INCONTINÊNCIA URINÁRIA - R$ 900,00'
        }
      ]
    },

    'MARCELA REGINA DOMBROWSKI SEKIKAWA': {
      doctorName: 'MARCELA REGINA DOMBROWSKI SEKIKAWA',
      rules: [
        // ================================================================
        // 🏥 PROCEDIMENTOS PRINCIPAIS - GINECOLOGIA E OBSTETRÍCIA
        // Mesmas regras da Dra. DJAVANI BLUM
        // Última atualização: 19/11/2025
        // ================================================================
        {
          procedureCode: '04.09.06.013-5',
          standardValue: 1000.00,
          description: 'HISTERECTOMIA TOTAL - R$ 1.000,00'
        },
        {
          procedureCode: '04.09.06.012-7',
          standardValue: 750.00,
          description: 'HISTERECTOMIA SUBTOTAL - R$ 750,00'
        },
        {
          procedureCode: '04.09.06.011-9',
          standardValue: 1200.00,
          description: 'HISTERECTOMIA C/ ANEXECTOMIA (UNI / BILATERAL) - R$ 1.200,00'
        },
        {
          procedureCode: '04.09.06.021-6',
          standardValue: 700.00,
          description: 'OOFORECTOMIA / OOFOROPLASTIA - R$ 700,00'
        },
        {
          procedureCode: '04.09.06.018-6',
          standardValue: 600.00,
          description: 'LAQUEADURA TUBARIA - R$ 600,00'
        },
        {
          procedureCode: '04.09.07.027-0',
          standardValue: 450.00,
          description: 'TRATAMENTO CIRURGICO DE INCONTINÊNCIA URINÁRIA POR VIA VAGINAL - R$ 450,00'
        },
        {
          procedureCode: '04.09.07.006-8',
          standardValue: 450.00,
          description: 'COLPOPERINEOPLASTIA POSTERIOR - R$ 450,00'
        },
        {
          procedureCode: '04.09.07.005-0',
          standardValue: 600.00,
          description: 'COLPOPERINEOPLASTIA ANTERIOR E POSTERIOR - R$ 600,00'
        },
        {
          procedureCode: '04.09.06.004-6',
          standardValue: 250.00,
          description: 'CURETAGEM SEMIOTICA C/ OU S/ DILATACAO DO COLO DO UTERO - R$ 250,00'
        },
        {
          procedureCode: '04.09.07.026-2',
          standardValue: 250.00,
          description: 'TRATAMENTO CIRURGICO DE HIPERTROFIA DOS PEQUENOS LABIOS (NINFOPLASTIA) - R$ 250,00'
        },
        {
          procedureCode: '04.08.06.031-0',
          standardValue: 250.00,
          description: 'RESSECÇÃO SIMPLES DE TUMOR ÓSSEO / DE PARTES MOLES - R$ 250,00'
        },
        {
          procedureCode: '04.09.07.015-7',
          standardValue: 250.00,
          description: 'EXERESE DE GLÂNDULA DE BARTHOLIN / SKENE - R$ 250,00'
        },
        {
          procedureCode: '04.09.07.019-0',
          standardValue: 150.00,
          description: 'MARSUPIALIZAÇÃO DE GLÂNDULA DE BARTOLIN - R$ 150,00'
        },
        {
          procedureCode: '04.09.07.003-3',
          standardValue: 300.00,
          description: 'COLPOCLEISE (CIRURGIA DE LE FORT) - R$ 300,00'
        },
        {
          procedureCode: '04.09.06.019-4',
          standardValue: 550.00,
          description: 'MIOMECTOMIA - R$ 550,00'
        },
        {
          procedureCode: '04.09.07.014-9',
          standardValue: 300.00,
          description: 'EXERESE DE CISTO VAGINAL - R$ 300,00'
        },
        
        // ================================================================
        // 🔧 PROCEDIMENTOS ADICIONAIS - SOMAM AO PROCEDIMENTO PRINCIPAL
        // ================================================================
        {
          procedureCode: '04.09.06.022-4',
          standardValue: 100.00,
          description: 'RESSECCAO DE VARIZES PELVICAS (ADICIONAL AO PROCEDIMENTO PRINCIPAL) - R$ 100,00'
        },
        {
          procedureCode: '04.07.04.018-8',
          standardValue: 300.00,
          description: 'LIBERAÇÃO DE ADERÊNCIAS INTESTINAIS (ADICIONAL AO PROCEDIMENTO PRINCIPAL) - R$ 300,00'
        },
        {
          procedureCode: '04.09.07.009-2',
          standardValue: 100.00,
          description: 'COLPORRAFIA NAO OBSTETRICA (ADICIONAL AO PROCEDIMENTO PRINCIPAL) - R$ 100,00'
        },
        {
          procedureCode: '04.08.06.020-4',
          standardValue: 100.00,
          description: 'REINSERÇÃO MUSCULAR (CORREÇÃO DE DIÁSTESE DE RETO ABDOMINAL - ADICIONAL DO PROCEDIMENTO PRINCIPAL) - R$ 100,00'
        }
      ],
      multipleRules: [
        {
          codes: ['04.09.06.021-6', '04.09.06.023-2'],
          totalValue: 900.00,
          description: 'OOFORECTOMIA/OOFOROPLASTIA + SALPINGECTOMIA - R$ 900,00'
        },
        {
          codes: ['04.09.07.006-8', '04.09.07.027-0'],
          totalValue: 800.00,
          description: 'COLPOPERINEOPLASTIA POSTERIOR + TRATAMENTO INCONTINÊNCIA URINÁRIA - R$ 800,00'
        },
        {
          codes: ['04.09.07.005-0', '04.09.07.027-0'],
          totalValue: 900.00,
          description: 'COLPOPERINEOPLASTIA ANTERIOR E POSTERIOR + TRATAMENTO INCONTINÊNCIA URINÁRIA - R$ 900,00'
        }
      ]
    },

    'MARIANA CAVALCANTI PEDROSA': {
      doctorName: 'MARIANA CAVALCANTI PEDROSA',
      rules: [
        // ================================================================
        // 🏥 PROCEDIMENTOS PRINCIPAIS - GINECOLOGIA E OBSTETRÍCIA
        // Mesmas regras da Dra. DJAVANI BLUM
        // Última atualização: 19/11/2025
        // ================================================================
        {
          procedureCode: '04.09.06.013-5',
          standardValue: 1000.00,
          description: 'HISTERECTOMIA TOTAL - R$ 1.000,00'
        },
        {
          procedureCode: '04.09.06.012-7',
          standardValue: 750.00,
          description: 'HISTERECTOMIA SUBTOTAL - R$ 750,00'
        },
        {
          procedureCode: '04.09.06.011-9',
          standardValue: 1200.00,
          description: 'HISTERECTOMIA C/ ANEXECTOMIA (UNI / BILATERAL) - R$ 1.200,00'
        },
        {
          procedureCode: '04.09.06.021-6',
          standardValue: 700.00,
          description: 'OOFORECTOMIA / OOFOROPLASTIA - R$ 700,00'
        },
        {
          procedureCode: '04.09.06.018-6',
          standardValue: 600.00,
          description: 'LAQUEADURA TUBARIA - R$ 600,00'
        },
        {
          procedureCode: '04.09.07.027-0',
          standardValue: 450.00,
          description: 'TRATAMENTO CIRURGICO DE INCONTINÊNCIA URINÁRIA POR VIA VAGINAL - R$ 450,00'
        },
        {
          procedureCode: '04.09.07.006-8',
          standardValue: 450.00,
          description: 'COLPOPERINEOPLASTIA POSTERIOR - R$ 450,00'
        },
        {
          procedureCode: '04.09.07.005-0',
          standardValue: 600.00,
          description: 'COLPOPERINEOPLASTIA ANTERIOR E POSTERIOR - R$ 600,00'
        },
        {
          procedureCode: '04.09.06.004-6',
          standardValue: 250.00,
          description: 'CURETAGEM SEMIOTICA C/ OU S/ DILATACAO DO COLO DO UTERO - R$ 250,00'
        },
        {
          procedureCode: '04.09.07.026-2',
          standardValue: 250.00,
          description: 'TRATAMENTO CIRURGICO DE HIPERTROFIA DOS PEQUENOS LABIOS (NINFOPLASTIA) - R$ 250,00'
        },
        {
          procedureCode: '04.08.06.031-0',
          standardValue: 250.00,
          description: 'RESSECÇÃO SIMPLES DE TUMOR ÓSSEO / DE PARTES MOLES - R$ 250,00'
        },
        {
          procedureCode: '04.09.07.015-7',
          standardValue: 250.00,
          description: 'EXERESE DE GLÂNDULA DE BARTHOLIN / SKENE - R$ 250,00'
        },
        {
          procedureCode: '04.09.07.019-0',
          standardValue: 150.00,
          description: 'MARSUPIALIZAÇÃO DE GLÂNDULA DE BARTOLIN - R$ 150,00'
        },
        {
          procedureCode: '04.09.07.003-3',
          standardValue: 300.00,
          description: 'COLPOCLEISE (CIRURGIA DE LE FORT) - R$ 300,00'
        },
        {
          procedureCode: '04.09.06.019-4',
          standardValue: 550.00,
          description: 'MIOMECTOMIA - R$ 550,00'
        },
        {
          procedureCode: '04.09.07.014-9',
          standardValue: 300.00,
          description: 'EXERESE DE CISTO VAGINAL - R$ 300,00'
        },
        
        // ================================================================
        // 🔧 PROCEDIMENTOS ADICIONAIS - SOMAM AO PROCEDIMENTO PRINCIPAL
        // ================================================================
        {
          procedureCode: '04.09.06.022-4',
          standardValue: 100.00,
          description: 'RESSECCAO DE VARIZES PELVICAS (ADICIONAL AO PROCEDIMENTO PRINCIPAL) - R$ 100,00'
        },
        {
          procedureCode: '04.07.04.018-8',
          standardValue: 300.00,
          description: 'LIBERAÇÃO DE ADERÊNCIAS INTESTINAIS (ADICIONAL AO PROCEDIMENTO PRINCIPAL) - R$ 300,00'
        },
        {
          procedureCode: '04.09.07.009-2',
          standardValue: 100.00,
          description: 'COLPORRAFIA NAO OBSTETRICA (ADICIONAL AO PROCEDIMENTO PRINCIPAL) - R$ 100,00'
        },
        {
          procedureCode: '04.08.06.020-4',
          standardValue: 100.00,
          description: 'REINSERÇÃO MUSCULAR (CORREÇÃO DE DIÁSTESE DE RETO ABDOMINAL - ADICIONAL DO PROCEDIMENTO PRINCIPAL) - R$ 100,00'
        }
      ],
      multipleRules: [
        {
          codes: ['04.09.06.021-6', '04.09.06.023-2'],
          totalValue: 900.00,
          description: 'OOFORECTOMIA/OOFOROPLASTIA + SALPINGECTOMIA - R$ 900,00'
        },
        {
          codes: ['04.09.07.006-8', '04.09.07.027-0'],
          totalValue: 800.00,
          description: 'COLPOPERINEOPLASTIA POSTERIOR + TRATAMENTO INCONTINÊNCIA URINÁRIA - R$ 800,00'
        },
        {
          codes: ['04.09.07.005-0', '04.09.07.027-0'],
          totalValue: 900.00,
          description: 'COLPOPERINEOPLASTIA ANTERIOR E POSTERIOR + TRATAMENTO INCONTINÊNCIA URINÁRIA - R$ 900,00'
        }
      ]
    },

    // ================================================================
    // 🏥 UROLOGISTAS - FAZENDA RIO GRANDE
    // Baseado nas regras do Dr. GUILHERME AUGUSTO STORER (Torao Tokuda)
    // Data: 19/11/2025
    // Total: 4 médicos com mesmas regras
    // ================================================================

    'CYRO CEZAR DE OLIVEIRA': {
      doctorName: 'CYRO CEZAR DE OLIVEIRA',
      rules: [
        { procedureCode: '04.09.01.023-5', standardValue: 1000.00, description: 'NEFROLITOTOMIA PERCUTÂNEA - R$ 1.000,00' },
        { procedureCode: '04.09.01.059-6', standardValue: 900.00, description: 'URETEROLITOTRIPSIA TRANSURETEROSCÓPICA (SEMIRRÍGIDA) - R$ 900,00' },
        { procedureCode: '04.09.01.018-9', standardValue: 1000.00, description: 'LITOTRIPSIA (FLEXÍVEL) - R$ 1.000,00' },
        { procedureCode: '04.09.01.017-0', standardValue: 250.00, description: 'INSTALAÇÃO ENDOSCÓPICA DE CATETER DUPLO J - R$ 250,00' },
        { procedureCode: '04.09.03.004-0', standardValue: 1000.00, description: 'RESSECÇÃO ENDOSCÓPICA DE PRÓSTATA - R$ 1.000,00' },
        { procedureCode: '04.09.03.002-3', standardValue: 1000.00, description: 'PROSTATECTOMIA SUPRAPÚBICA - R$ 1.000,00' },
        { procedureCode: '04.09.04.021-5', standardValue: 300.00, description: 'TRATAMENTO CIRÚRGICO DE HIDROCELE - R$ 300,00' },
        { procedureCode: '04.09.05.008-3', standardValue: 250.00, description: 'POSTECTOMIA - R$ 250,00' },
        { procedureCode: '04.09.04.024-0', standardValue: 450.00, description: 'VASECTOMIA - R$ 450,00' },
        { procedureCode: '04.09.04.023-1', standardValue: 250.00, description: 'TRATAMENTO CIRÚRGICO DE VARICOCELE - R$ 250,00' },
        { procedureCode: '04.09.04.013-4', standardValue: 400.00, description: 'ORQUIDOPEXIA UNILATERAL - R$ 400,00' },
        { procedureCode: '04.09.04.012-6', standardValue: 450.00, description: 'ORQUIDOPEXIA BILATERAL - R$ 450,00' },
        { procedureCode: '04.09.01.006-5', standardValue: 600.00, description: 'CISTOLITOTOMIA E/OU RETIRADA DE CORPO ESTRANHO DA BEXIGA - R$ 600,00' },
        { procedureCode: '04.09.05.007-5', standardValue: 500.00, description: 'PLÁSTICA TOTAL DO PÊNIS (INCLUI PEYRONIE) - R$ 500,00' },
        { procedureCode: 'RESSECÇÃO_CISTOS', standardValue: 250.00, description: 'RESSECÇÃO DE CISTOS/CAUTERIZAÇÕES - R$ 250,00' },
        { procedureCode: '04.09.04.016-9', standardValue: 500.00, description: 'ORQUIECTOMIA UNILATERAL - R$ 500,00' },
        { procedureCode: '04.09.01.032-4', standardValue: 700.00, description: 'PIELOPLASTIA - R$ 700,00' },
        { procedureCode: '04.09.01.021-9', standardValue: 1200.00, description: 'NEFRECTOMIA TOTAL - R$ 1.200,00' },
        { procedureCode: '04.09.01.020-0', standardValue: 1000.00, description: 'NEFRECTOMIA PARCIAL - R$ 1.000,00' },
        { procedureCode: '04.09.01.022-7', standardValue: 900.00, description: 'NEFROLITOTOMIA (ANATRÓFICA) - R$ 900,00' },
        { procedureCode: '04.09.01.029-4', standardValue: 400.00, description: 'NEFROSTOMIA PERCUTÂNEA - R$ 400,00' },
        { procedureCode: '04.09.02.017-6', standardValue: 250.00, description: 'URETROTOMIA INTERNA - R$ 250,00' }
      ],
      multipleRules: [
        { codes: ['04.09.01.023-5', '04.09.01.017-0'], totalValue: 1100.00, description: 'NEFROLITOTOMIA PERCUTÂNEA + INSTALAÇÃO ENDOSCÓPICA DE CATETER DUPLO J - R$ 1.100,00' },
        { codes: ['04.09.01.023-5', '04.09.01.014-6'], totalValue: 1300.00, description: 'NEFROLITOTOMIA PERCUTÂNEA + EXTRAÇÃO ENDOSCÓPICA DE CÁLCULO EM PELVE RENAL - R$ 1.300,00' },
        { codes: ['04.09.01.023-5', '04.09.01.017-0', '04.09.01.014-6'], totalValue: 1400.00, description: 'NEFROLITOTOMIA PERCUTÂNEA + INSTALAÇÃO ENDOSCÓPICA DE CATETER DUPLO J + EXTRAÇÃO ENDOSCÓPICA DE CÁLCULO EM PELVE RENAL - R$ 1.400,00' },
        { codes: ['04.09.01.023-5', '04.09.01.014-6', '04.09.01.059-6'], totalValue: 1500.00, description: 'NEFROLITOTOMIA PERCUTÂNEA + EXTRAÇÃO ENDOSCÓPICA DE CÁLCULO EM PELVE RENAL + URETEROLITOTRIPSIA TRANSURETEROSCÓPICA - R$ 1.500,00' },
        { codes: ['04.09.01.023-5', '04.09.01.017-0', '04.09.01.014-6', '04.09.01.059-6'], totalValue: 1600.00, description: 'NEFROLITOTOMIA PERCUTÂNEA + INSTALAÇÃO ENDOSCÓPICA DE CATETER DUPLO J + EXTRAÇÃO ENDOSCÓPICA DE CÁLCULO EM PELVE RENAL + URETEROLITOTRIPSIA TRANSURETEROSCÓPICA - R$ 1.600,00' },
        { codes: ['04.09.01.059-6', '04.09.01.017-0'], totalValue: 1000.00, description: 'URETEROLITOTRIPSIA TRANSURETEROSCÓPICA + INSTALAÇÃO ENDOSCÓPICA DE CATETER DUPLO J (SEMIRRÍGIDA) - R$ 1.000,00' },
        { codes: ['04.09.01.018-9', '04.09.01.017-0'], totalValue: 1100.00, description: 'LITOTRIPSIA (FLEXÍVEL) + INSTALAÇÃO ENDOSCÓPICA DE CATETER DUPLO J - R$ 1.100,00' },
        { codes: ['04.09.01.018-9', '04.09.01.014-6', '04.09.01.017-0'], totalValue: 1200.00, description: 'LITOTRIPSIA (FLEXÍVEL) + EXTRAÇÃO ENDOSCÓPICA DE CÁLCULO EM PELVE RENAL + INSTALAÇÃO ENDOSCÓPICA DE CATETER DUPLO J - R$ 1.200,00' },
        { codes: ['04.09.01.018-9', '04.09.01.059-6', '04.09.01.014-6', '04.09.01.017-0'], totalValue: 1300.00, description: 'LITOTRIPSIA (FLEXÍVEL) + URETEROLITOTRIPSIA TRANSURETEROSCÓPICA (SEMIRRÍGIDA) + EXTRAÇÃO ENDOSCÓPICA DE CÁLCULO EM PELVE RENAL + INSTALAÇÃO ENDOSCÓPICA DE CATETER DUPLO J - R$ 1.300,00' },
        { codes: ['04.09.03.004-0', '04.09.01.038-3'], totalValue: 1200.00, description: 'RESSECÇÃO ENDOSCÓPICA DE PRÓSTATA + RESSECÇÃO ENDOSCÓPICA DE LESÃO VESICAL - R$ 1.200,00' },
        { codes: ['04.09.04.021-5', '04.09.04.019-3'], totalValue: 400.00, description: 'TRATAMENTO CIRÚRGICO DE HIDROCELE + RESSECÇÃO PARCIAL DA BOLSA ESCROTAL - R$ 400,00' },
        { codes: ['04.09.04.021-5', '04.09.04.019-3', '04.09.04.017-7'], totalValue: 500.00, description: 'TRATAMENTO CIRÚRGICO DE HIDROCELE + RESSECÇÃO PARCIAL DA BOLSA ESCROTAL + PLÁSTICA DA BOLSA ESCROTAL - R$ 500,00' },
        { codes: ['04.09.04.013-4', '04.09.04.017-7'], totalValue: 550.00, description: 'ORQUIDOPEXIA UNILATERAL + PLÁSTICA DA BOLSA ESCROTAL - R$ 550,00' },
        { codes: ['04.09.04.012-6', '04.09.04.017-7'], totalValue: 550.00, description: 'ORQUIDOPEXIA BILATERAL + PLÁSTICA DA BOLSA ESCROTAL - R$ 550,00' },
        { codes: ['04.09.01.032-4', '04.09.01.057-0'], totalValue: 1000.00, description: 'PIELOPLASTIA + URETEROPLASTIA - R$ 1.000,00' },
        { codes: ['04.09.01.032-4', '04.09.01.057-0', '04.09.01.017-0'], totalValue: 1100.00, description: 'PIELOPLASTIA + URETEROPLASTIA + INSTALAÇÃO ENDOSCÓPICA DE CATETER DUPLO J - R$ 1.100,00' }
      ]
    },

    'FERNANDO FOGLIATTO': {
      doctorName: 'FERNANDO FOGLIATTO',
      rules: [
        { procedureCode: '04.09.01.023-5', standardValue: 1000.00, description: 'NEFROLITOTOMIA PERCUTÂNEA - R$ 1.000,00' },
        { procedureCode: '04.09.01.059-6', standardValue: 900.00, description: 'URETEROLITOTRIPSIA TRANSURETEROSCÓPICA (SEMIRRÍGIDA) - R$ 900,00' },
        { procedureCode: '04.09.01.018-9', standardValue: 1000.00, description: 'LITOTRIPSIA (FLEXÍVEL) - R$ 1.000,00' },
        { procedureCode: '04.09.01.017-0', standardValue: 250.00, description: 'INSTALAÇÃO ENDOSCÓPICA DE CATETER DUPLO J - R$ 250,00' },
        { procedureCode: '04.09.03.004-0', standardValue: 1000.00, description: 'RESSECÇÃO ENDOSCÓPICA DE PRÓSTATA - R$ 1.000,00' },
        { procedureCode: '04.09.03.002-3', standardValue: 1000.00, description: 'PROSTATECTOMIA SUPRAPÚBICA - R$ 1.000,00' },
        { procedureCode: '04.09.04.021-5', standardValue: 300.00, description: 'TRATAMENTO CIRÚRGICO DE HIDROCELE - R$ 300,00' },
        { procedureCode: '04.09.05.008-3', standardValue: 250.00, description: 'POSTECTOMIA - R$ 250,00' },
        { procedureCode: '04.09.04.024-0', standardValue: 450.00, description: 'VASECTOMIA - R$ 450,00' },
        { procedureCode: '04.09.04.023-1', standardValue: 250.00, description: 'TRATAMENTO CIRÚRGICO DE VARICOCELE - R$ 250,00' },
        { procedureCode: '04.09.04.013-4', standardValue: 400.00, description: 'ORQUIDOPEXIA UNILATERAL - R$ 400,00' },
        { procedureCode: '04.09.04.012-6', standardValue: 450.00, description: 'ORQUIDOPEXIA BILATERAL - R$ 450,00' },
        { procedureCode: '04.09.01.006-5', standardValue: 600.00, description: 'CISTOLITOTOMIA E/OU RETIRADA DE CORPO ESTRANHO DA BEXIGA - R$ 600,00' },
        { procedureCode: '04.09.05.007-5', standardValue: 500.00, description: 'PLÁSTICA TOTAL DO PÊNIS (INCLUI PEYRONIE) - R$ 500,00' },
        { procedureCode: 'RESSECÇÃO_CISTOS', standardValue: 250.00, description: 'RESSECÇÃO DE CISTOS/CAUTERIZAÇÕES - R$ 250,00' },
        { procedureCode: '04.09.04.016-9', standardValue: 500.00, description: 'ORQUIECTOMIA UNILATERAL - R$ 500,00' },
        { procedureCode: '04.09.01.032-4', standardValue: 700.00, description: 'PIELOPLASTIA - R$ 700,00' },
        { procedureCode: '04.09.01.021-9', standardValue: 1200.00, description: 'NEFRECTOMIA TOTAL - R$ 1.200,00' },
        { procedureCode: '04.09.01.020-0', standardValue: 1000.00, description: 'NEFRECTOMIA PARCIAL - R$ 1.000,00' },
        { procedureCode: '04.09.01.022-7', standardValue: 900.00, description: 'NEFROLITOTOMIA (ANATRÓFICA) - R$ 900,00' },
        { procedureCode: '04.09.01.029-4', standardValue: 400.00, description: 'NEFROSTOMIA PERCUTÂNEA - R$ 400,00' },
        { procedureCode: '04.09.02.017-6', standardValue: 250.00, description: 'URETROTOMIA INTERNA - R$ 250,00' }
      ],
      multipleRules: [
        { codes: ['04.09.01.023-5', '04.09.01.017-0'], totalValue: 1100.00, description: 'NEFROLITOTOMIA PERCUTÂNEA + INSTALAÇÃO ENDOSCÓPICA DE CATETER DUPLO J - R$ 1.100,00' },
        { codes: ['04.09.01.023-5', '04.09.01.014-6'], totalValue: 1300.00, description: 'NEFROLITOTOMIA PERCUTÂNEA + EXTRAÇÃO ENDOSCÓPICA DE CÁLCULO EM PELVE RENAL - R$ 1.300,00' },
        { codes: ['04.09.01.023-5', '04.09.01.017-0', '04.09.01.014-6'], totalValue: 1400.00, description: 'NEFROLITOTOMIA PERCUTÂNEA + INSTALAÇÃO ENDOSCÓPICA DE CATETER DUPLO J + EXTRAÇÃO ENDOSCÓPICA DE CÁLCULO EM PELVE RENAL - R$ 1.400,00' },
        { codes: ['04.09.01.023-5', '04.09.01.014-6', '04.09.01.059-6'], totalValue: 1500.00, description: 'NEFROLITOTOMIA PERCUTÂNEA + EXTRAÇÃO ENDOSCÓPICA DE CÁLCULO EM PELVE RENAL + URETEROLITOTRIPSIA TRANSURETEROSCÓPICA - R$ 1.500,00' },
        { codes: ['04.09.01.023-5', '04.09.01.017-0', '04.09.01.014-6', '04.09.01.059-6'], totalValue: 1600.00, description: 'NEFROLITOTOMIA PERCUTÂNEA + INSTALAÇÃO ENDOSCÓPICA DE CATETER DUPLO J + EXTRAÇÃO ENDOSCÓPICA DE CÁLCULO EM PELVE RENAL + URETEROLITOTRIPSIA TRANSURETEROSCÓPICA - R$ 1.600,00' },
        { codes: ['04.09.01.059-6', '04.09.01.017-0'], totalValue: 1000.00, description: 'URETEROLITOTRIPSIA TRANSURETEROSCÓPICA + INSTALAÇÃO ENDOSCÓPICA DE CATETER DUPLO J (SEMIRRÍGIDA) - R$ 1.000,00' },
        { codes: ['04.09.01.018-9', '04.09.01.017-0'], totalValue: 1100.00, description: 'LITOTRIPSIA (FLEXÍVEL) + INSTALAÇÃO ENDOSCÓPICA DE CATETER DUPLO J - R$ 1.100,00' },
        { codes: ['04.09.01.018-9', '04.09.01.014-6', '04.09.01.017-0'], totalValue: 1200.00, description: 'LITOTRIPSIA (FLEXÍVEL) + EXTRAÇÃO ENDOSCÓPICA DE CÁLCULO EM PELVE RENAL + INSTALAÇÃO ENDOSCÓPICA DE CATETER DUPLO J - R$ 1.200,00' },
        { codes: ['04.09.01.018-9', '04.09.01.059-6', '04.09.01.014-6', '04.09.01.017-0'], totalValue: 1300.00, description: 'LITOTRIPSIA (FLEXÍVEL) + URETEROLITOTRIPSIA TRANSURETEROSCÓPICA (SEMIRRÍGIDA) + EXTRAÇÃO ENDOSCÓPICA DE CÁLCULO EM PELVE RENAL + INSTALAÇÃO ENDOSCÓPICA DE CATETER DUPLO J - R$ 1.300,00' },
        { codes: ['04.09.03.004-0', '04.09.01.038-3'], totalValue: 1200.00, description: 'RESSECÇÃO ENDOSCÓPICA DE PRÓSTATA + RESSECÇÃO ENDOSCÓPICA DE LESÃO VESICAL - R$ 1.200,00' },
        { codes: ['04.09.04.021-5', '04.09.04.019-3'], totalValue: 400.00, description: 'TRATAMENTO CIRÚRGICO DE HIDROCELE + RESSECÇÃO PARCIAL DA BOLSA ESCROTAL - R$ 400,00' },
        { codes: ['04.09.04.021-5', '04.09.04.019-3', '04.09.04.017-7'], totalValue: 500.00, description: 'TRATAMENTO CIRÚRGICO DE HIDROCELE + RESSECÇÃO PARCIAL DA BOLSA ESCROTAL + PLÁSTICA DA BOLSA ESCROTAL - R$ 500,00' },
        { codes: ['04.09.04.013-4', '04.09.04.017-7'], totalValue: 550.00, description: 'ORQUIDOPEXIA UNILATERAL + PLÁSTICA DA BOLSA ESCROTAL - R$ 550,00' },
        { codes: ['04.09.04.012-6', '04.09.04.017-7'], totalValue: 550.00, description: 'ORQUIDOPEXIA BILATERAL + PLÁSTICA DA BOLSA ESCROTAL - R$ 550,00' },
        { codes: ['04.09.01.032-4', '04.09.01.057-0'], totalValue: 1000.00, description: 'PIELOPLASTIA + URETEROPLASTIA - R$ 1.000,00' },
        { codes: ['04.09.01.032-4', '04.09.01.057-0', '04.09.01.017-0'], totalValue: 1100.00, description: 'PIELOPLASTIA + URETEROPLASTIA + INSTALAÇÃO ENDOSCÓPICA DE CATETER DUPLO J - R$ 1.100,00' }
      ]
    },

    'GUSTAVO BONO YOSHIKAWA': {
      doctorName: 'GUSTAVO BONO YOSHIKAWA',
      rules: [
        { procedureCode: '04.09.01.023-5', standardValue: 1000.00, description: 'NEFROLITOTOMIA PERCUTÂNEA - R$ 1.000,00' },
        { procedureCode: '04.09.01.059-6', standardValue: 900.00, description: 'URETEROLITOTRIPSIA TRANSURETEROSCÓPICA (SEMIRRÍGIDA) - R$ 900,00' },
        { procedureCode: '04.09.01.018-9', standardValue: 1000.00, description: 'LITOTRIPSIA (FLEXÍVEL) - R$ 1.000,00' },
        { procedureCode: '04.09.01.017-0', standardValue: 250.00, description: 'INSTALAÇÃO ENDOSCÓPICA DE CATETER DUPLO J - R$ 250,00' },
        { procedureCode: '04.09.03.004-0', standardValue: 1000.00, description: 'RESSECÇÃO ENDOSCÓPICA DE PRÓSTATA - R$ 1.000,00' },
        { procedureCode: '04.09.03.002-3', standardValue: 1000.00, description: 'PROSTATECTOMIA SUPRAPÚBICA - R$ 1.000,00' },
        { procedureCode: '04.09.04.021-5', standardValue: 300.00, description: 'TRATAMENTO CIRÚRGICO DE HIDROCELE - R$ 300,00' },
        { procedureCode: '04.09.05.008-3', standardValue: 250.00, description: 'POSTECTOMIA - R$ 250,00' },
        { procedureCode: '04.09.04.024-0', standardValue: 450.00, description: 'VASECTOMIA - R$ 450,00' },
        { procedureCode: '04.09.04.023-1', standardValue: 250.00, description: 'TRATAMENTO CIRÚRGICO DE VARICOCELE - R$ 250,00' },
        { procedureCode: '04.09.04.013-4', standardValue: 400.00, description: 'ORQUIDOPEXIA UNILATERAL - R$ 400,00' },
        { procedureCode: '04.09.04.012-6', standardValue: 450.00, description: 'ORQUIDOPEXIA BILATERAL - R$ 450,00' },
        { procedureCode: '04.09.01.006-5', standardValue: 600.00, description: 'CISTOLITOTOMIA E/OU RETIRADA DE CORPO ESTRANHO DA BEXIGA - R$ 600,00' },
        { procedureCode: '04.09.05.007-5', standardValue: 500.00, description: 'PLÁSTICA TOTAL DO PÊNIS (INCLUI PEYRONIE) - R$ 500,00' },
        { procedureCode: 'RESSECÇÃO_CISTOS', standardValue: 250.00, description: 'RESSECÇÃO DE CISTOS/CAUTERIZAÇÕES - R$ 250,00' },
        { procedureCode: '04.09.04.016-9', standardValue: 500.00, description: 'ORQUIECTOMIA UNILATERAL - R$ 500,00' },
        { procedureCode: '04.09.01.032-4', standardValue: 700.00, description: 'PIELOPLASTIA - R$ 700,00' },
        { procedureCode: '04.09.01.021-9', standardValue: 1200.00, description: 'NEFRECTOMIA TOTAL - R$ 1.200,00' },
        { procedureCode: '04.09.01.020-0', standardValue: 1000.00, description: 'NEFRECTOMIA PARCIAL - R$ 1.000,00' },
        { procedureCode: '04.09.01.022-7', standardValue: 900.00, description: 'NEFROLITOTOMIA (ANATRÓFICA) - R$ 900,00' },
        { procedureCode: '04.09.01.029-4', standardValue: 400.00, description: 'NEFROSTOMIA PERCUTÂNEA - R$ 400,00' },
        { procedureCode: '04.09.02.017-6', standardValue: 250.00, description: 'URETROTOMIA INTERNA - R$ 250,00' },
        // ================================================================
        // 🔧 PROCEDIMENTOS DE URETROPLASTIAS - ADICIONADOS EM 19/11/2025
        // ================================================================
        { procedureCode: '04.09.02.013-3', standardValue: 1000.00, description: 'URETROPLASTIA AUTÓGENA - R$ 1.000,00' },
        { procedureCode: '04.09.02.015-0', standardValue: 0, description: 'URETRORRAFIA (valor definido em regras de múltiplos)' },
        { procedureCode: '04.09.02.007-9', standardValue: 0, description: 'MEATOTOMIA SIMPLES (valor definido em regras de múltiplos)' }
      ],
      multipleRules: [
        { codes: ['04.09.01.023-5', '04.09.01.017-0'], totalValue: 1100.00, description: 'NEFROLITOTOMIA PERCUTÂNEA + INSTALAÇÃO ENDOSCÓPICA DE CATETER DUPLO J - R$ 1.100,00' },
        { codes: ['04.09.01.023-5', '04.09.01.014-6'], totalValue: 1300.00, description: 'NEFROLITOTOMIA PERCUTÂNEA + EXTRAÇÃO ENDOSCÓPICA DE CÁLCULO EM PELVE RENAL - R$ 1.300,00' },
        { codes: ['04.09.01.023-5', '04.09.01.017-0', '04.09.01.014-6'], totalValue: 1400.00, description: 'NEFROLITOTOMIA PERCUTÂNEA + INSTALAÇÃO ENDOSCÓPICA DE CATETER DUPLO J + EXTRAÇÃO ENDOSCÓPICA DE CÁLCULO EM PELVE RENAL - R$ 1.400,00' },
        { codes: ['04.09.01.023-5', '04.09.01.014-6', '04.09.01.059-6'], totalValue: 1500.00, description: 'NEFROLITOTOMIA PERCUTÂNEA + EXTRAÇÃO ENDOSCÓPICA DE CÁLCULO EM PELVE RENAL + URETEROLITOTRIPSIA TRANSURETEROSCÓPICA - R$ 1.500,00' },
        { codes: ['04.09.01.023-5', '04.09.01.017-0', '04.09.01.014-6', '04.09.01.059-6'], totalValue: 1600.00, description: 'NEFROLITOTOMIA PERCUTÂNEA + INSTALAÇÃO ENDOSCÓPICA DE CATETER DUPLO J + EXTRAÇÃO ENDOSCÓPICA DE CÁLCULO EM PELVE RENAL + URETEROLITOTRIPSIA TRANSURETEROSCÓPICA - R$ 1.600,00' },
        { codes: ['04.09.01.059-6', '04.09.01.017-0'], totalValue: 1000.00, description: 'URETEROLITOTRIPSIA TRANSURETEROSCÓPICA + INSTALAÇÃO ENDOSCÓPICA DE CATETER DUPLO J (SEMIRRÍGIDA) - R$ 1.000,00' },
        { codes: ['04.09.01.018-9', '04.09.01.017-0'], totalValue: 1100.00, description: 'LITOTRIPSIA (FLEXÍVEL) + INSTALAÇÃO ENDOSCÓPICA DE CATETER DUPLO J - R$ 1.100,00' },
        { codes: ['04.09.01.018-9', '04.09.01.014-6', '04.09.01.017-0'], totalValue: 1200.00, description: 'LITOTRIPSIA (FLEXÍVEL) + EXTRAÇÃO ENDOSCÓPICA DE CÁLCULO EM PELVE RENAL + INSTALAÇÃO ENDOSCÓPICA DE CATETER DUPLO J - R$ 1.200,00' },
        { codes: ['04.09.01.018-9', '04.09.01.059-6', '04.09.01.014-6', '04.09.01.017-0'], totalValue: 1300.00, description: 'LITOTRIPSIA (FLEXÍVEL) + URETEROLITOTRIPSIA TRANSURETEROSCÓPICA (SEMIRRÍGIDA) + EXTRAÇÃO ENDOSCÓPICA DE CÁLCULO EM PELVE RENAL + INSTALAÇÃO ENDOSCÓPICA DE CATETER DUPLO J - R$ 1.300,00' },
        { codes: ['04.09.03.004-0', '04.09.01.038-3'], totalValue: 1200.00, description: 'RESSECÇÃO ENDOSCÓPICA DE PRÓSTATA + RESSECÇÃO ENDOSCÓPICA DE LESÃO VESICAL - R$ 1.200,00' },
        { codes: ['04.09.04.021-5', '04.09.04.019-3'], totalValue: 400.00, description: 'TRATAMENTO CIRÚRGICO DE HIDROCELE + RESSECÇÃO PARCIAL DA BOLSA ESCROTAL - R$ 400,00' },
        { codes: ['04.09.04.021-5', '04.09.04.019-3', '04.09.04.017-7'], totalValue: 500.00, description: 'TRATAMENTO CIRÚRGICO DE HIDROCELE + RESSECÇÃO PARCIAL DA BOLSA ESCROTAL + PLÁSTICA DA BOLSA ESCROTAL - R$ 500,00' },
        { codes: ['04.09.04.013-4', '04.09.04.017-7'], totalValue: 550.00, description: 'ORQUIDOPEXIA UNILATERAL + PLÁSTICA DA BOLSA ESCROTAL - R$ 550,00' },
        { codes: ['04.09.04.012-6', '04.09.04.017-7'], totalValue: 550.00, description: 'ORQUIDOPEXIA BILATERAL + PLÁSTICA DA BOLSA ESCROTAL - R$ 550,00' },
        { codes: ['04.09.01.032-4', '04.09.01.057-0'], totalValue: 1000.00, description: 'PIELOPLASTIA + URETEROPLASTIA - R$ 1.000,00' },
        { codes: ['04.09.01.032-4', '04.09.01.057-0', '04.09.01.017-0'], totalValue: 1100.00, description: 'PIELOPLASTIA + URETEROPLASTIA + INSTALAÇÃO ENDOSCÓPICA DE CATETER DUPLO J - R$ 1.100,00' },
        // ================================================================
        // 🔧 REGRAS DE URETROPLASTIAS - ADICIONADAS EM 19/11/2025
        // Total: 3 combinações específicas
        // ================================================================
        { codes: ['04.09.02.013-3', '04.09.02.015-0'], totalValue: 1300.00, description: 'URETROPLASTIA AUTÓGENA + URETRORRAFIA - R$ 1.300,00' },
        { codes: ['04.09.02.013-3', '04.09.02.015-0', '04.09.02.017-6'], totalValue: 1650.00, description: 'URETROPLASTIA AUTÓGENA + URETRORRAFIA + URETROTOMIA INTERNA - R$ 1.650,00' },
        { codes: ['04.09.02.013-3', '04.09.02.015-0', '04.09.02.017-6', '04.09.02.007-9'], totalValue: 2000.00, description: 'URETROPLASTIA AUTÓGENA + URETRORRAFIA + URETROTOMIA INTERNA + MEATOTOMIA SIMPLES - R$ 2.000,00' }
      ]
    },

    'MATHIAS BURIN GROHE': {
      doctorName: 'MATHIAS BURIN GROHE',
      rules: [
        { procedureCode: '04.09.01.023-5', standardValue: 1000.00, description: 'NEFROLITOTOMIA PERCUTÂNEA - R$ 1.000,00' },
        { procedureCode: '04.09.01.059-6', standardValue: 900.00, description: 'URETEROLITOTRIPSIA TRANSURETEROSCÓPICA (SEMIRRÍGIDA) - R$ 900,00' },
        { procedureCode: '04.09.01.018-9', standardValue: 1000.00, description: 'LITOTRIPSIA (FLEXÍVEL) - R$ 1.000,00' },
        { procedureCode: '04.09.01.017-0', standardValue: 250.00, description: 'INSTALAÇÃO ENDOSCÓPICA DE CATETER DUPLO J - R$ 250,00' },
        { procedureCode: '04.09.03.004-0', standardValue: 1000.00, description: 'RESSECÇÃO ENDOSCÓPICA DE PRÓSTATA - R$ 1.000,00' },
        { procedureCode: '04.09.03.002-3', standardValue: 1000.00, description: 'PROSTATECTOMIA SUPRAPÚBICA - R$ 1.000,00' },
        { procedureCode: '04.09.04.021-5', standardValue: 300.00, description: 'TRATAMENTO CIRÚRGICO DE HIDROCELE - R$ 300,00' },
        { procedureCode: '04.09.05.008-3', standardValue: 250.00, description: 'POSTECTOMIA - R$ 250,00' },
        { procedureCode: '04.09.04.024-0', standardValue: 450.00, description: 'VASECTOMIA - R$ 450,00' },
        { procedureCode: '04.09.04.023-1', standardValue: 250.00, description: 'TRATAMENTO CIRÚRGICO DE VARICOCELE - R$ 250,00' },
        { procedureCode: '04.09.04.013-4', standardValue: 400.00, description: 'ORQUIDOPEXIA UNILATERAL - R$ 400,00' },
        { procedureCode: '04.09.04.012-6', standardValue: 450.00, description: 'ORQUIDOPEXIA BILATERAL - R$ 450,00' },
        { procedureCode: '04.09.01.006-5', standardValue: 600.00, description: 'CISTOLITOTOMIA E/OU RETIRADA DE CORPO ESTRANHO DA BEXIGA - R$ 600,00' },
        { procedureCode: '04.09.05.007-5', standardValue: 500.00, description: 'PLÁSTICA TOTAL DO PÊNIS (INCLUI PEYRONIE) - R$ 500,00' },
        { procedureCode: 'RESSECÇÃO_CISTOS', standardValue: 250.00, description: 'RESSECÇÃO DE CISTOS/CAUTERIZAÇÕES - R$ 250,00' },
        { procedureCode: '04.09.04.016-9', standardValue: 500.00, description: 'ORQUIECTOMIA UNILATERAL - R$ 500,00' },
        { procedureCode: '04.09.01.032-4', standardValue: 700.00, description: 'PIELOPLASTIA - R$ 700,00' },
        { procedureCode: '04.09.01.021-9', standardValue: 1200.00, description: 'NEFRECTOMIA TOTAL - R$ 1.200,00' },
        { procedureCode: '04.09.01.020-0', standardValue: 1000.00, description: 'NEFRECTOMIA PARCIAL - R$ 1.000,00' },
        { procedureCode: '04.09.01.022-7', standardValue: 900.00, description: 'NEFROLITOTOMIA (ANATRÓFICA) - R$ 900,00' },
        { procedureCode: '04.09.01.029-4', standardValue: 400.00, description: 'NEFROSTOMIA PERCUTÂNEA - R$ 400,00' },
        { procedureCode: '04.09.02.017-6', standardValue: 250.00, description: 'URETROTOMIA INTERNA - R$ 250,00' }
      ],
      multipleRules: [
        { codes: ['04.09.01.023-5', '04.09.01.017-0'], totalValue: 1100.00, description: 'NEFROLITOTOMIA PERCUTÂNEA + INSTALAÇÃO ENDOSCÓPICA DE CATETER DUPLO J - R$ 1.100,00' },
        { codes: ['04.09.01.023-5', '04.09.01.014-6'], totalValue: 1300.00, description: 'NEFROLITOTOMIA PERCUTÂNEA + EXTRAÇÃO ENDOSCÓPICA DE CÁLCULO EM PELVE RENAL - R$ 1.300,00' },
        { codes: ['04.09.01.023-5', '04.09.01.017-0', '04.09.01.014-6'], totalValue: 1400.00, description: 'NEFROLITOTOMIA PERCUTÂNEA + INSTALAÇÃO ENDOSCÓPICA DE CATETER DUPLO J + EXTRAÇÃO ENDOSCÓPICA DE CÁLCULO EM PELVE RENAL - R$ 1.400,00' },
        { codes: ['04.09.01.023-5', '04.09.01.014-6', '04.09.01.059-6'], totalValue: 1500.00, description: 'NEFROLITOTOMIA PERCUTÂNEA + EXTRAÇÃO ENDOSCÓPICA DE CÁLCULO EM PELVE RENAL + URETEROLITOTRIPSIA TRANSURETEROSCÓPICA - R$ 1.500,00' },
        { codes: ['04.09.01.023-5', '04.09.01.017-0', '04.09.01.014-6', '04.09.01.059-6'], totalValue: 1600.00, description: 'NEFROLITOTOMIA PERCUTÂNEA + INSTALAÇÃO ENDOSCÓPICA DE CATETER DUPLO J + EXTRAÇÃO ENDOSCÓPICA DE CÁLCULO EM PELVE RENAL + URETEROLITOTRIPSIA TRANSURETEROSCÓPICA - R$ 1.600,00' },
        { codes: ['04.09.01.059-6', '04.09.01.017-0'], totalValue: 1000.00, description: 'URETEROLITOTRIPSIA TRANSURETEROSCÓPICA + INSTALAÇÃO ENDOSCÓPICA DE CATETER DUPLO J (SEMIRRÍGIDA) - R$ 1.000,00' },
        { codes: ['04.09.01.018-9', '04.09.01.017-0'], totalValue: 1100.00, description: 'LITOTRIPSIA (FLEXÍVEL) + INSTALAÇÃO ENDOSCÓPICA DE CATETER DUPLO J - R$ 1.100,00' },
        { codes: ['04.09.01.018-9', '04.09.01.014-6', '04.09.01.017-0'], totalValue: 1200.00, description: 'LITOTRIPSIA (FLEXÍVEL) + EXTRAÇÃO ENDOSCÓPICA DE CÁLCULO EM PELVE RENAL + INSTALAÇÃO ENDOSCÓPICA DE CATETER DUPLO J - R$ 1.200,00' },
        { codes: ['04.09.01.018-9', '04.09.01.059-6', '04.09.01.014-6', '04.09.01.017-0'], totalValue: 1300.00, description: 'LITOTRIPSIA (FLEXÍVEL) + URETEROLITOTRIPSIA TRANSURETEROSCÓPICA (SEMIRRÍGIDA) + EXTRAÇÃO ENDOSCÓPICA DE CÁLCULO EM PELVE RENAL + INSTALAÇÃO ENDOSCÓPICA DE CATETER DUPLO J - R$ 1.300,00' },
        { codes: ['04.09.03.004-0', '04.09.01.038-3'], totalValue: 1200.00, description: 'RESSECÇÃO ENDOSCÓPICA DE PRÓSTATA + RESSECÇÃO ENDOSCÓPICA DE LESÃO VESICAL - R$ 1.200,00' },
        { codes: ['04.09.04.021-5', '04.09.04.019-3'], totalValue: 400.00, description: 'TRATAMENTO CIRÚRGICO DE HIDROCELE + RESSECÇÃO PARCIAL DA BOLSA ESCROTAL - R$ 400,00' },
        { codes: ['04.09.04.021-5', '04.09.04.019-3', '04.09.04.017-7'], totalValue: 500.00, description: 'TRATAMENTO CIRÚRGICO DE HIDROCELE + RESSECÇÃO PARCIAL DA BOLSA ESCROTAL + PLÁSTICA DA BOLSA ESCROTAL - R$ 500,00' },
        { codes: ['04.09.04.013-4', '04.09.04.017-7'], totalValue: 550.00, description: 'ORQUIDOPEXIA UNILATERAL + PLÁSTICA DA BOLSA ESCROTAL - R$ 550,00' },
        { codes: ['04.09.04.012-6', '04.09.04.017-7'], totalValue: 550.00, description: 'ORQUIDOPEXIA BILATERAL + PLÁSTICA DA BOLSA ESCROTAL - R$ 550,00' },
        { codes: ['04.09.01.032-4', '04.09.01.057-0'], totalValue: 1000.00, description: 'PIELOPLASTIA + URETEROPLASTIA - R$ 1.000,00' },
        { codes: ['04.09.01.032-4', '04.09.01.057-0', '04.09.01.017-0'], totalValue: 1100.00, description: 'PIELOPLASTIA + URETEROPLASTIA + INSTALAÇÃO ENDOSCÓPICA DE CATETER DUPLO J - R$ 1.100,00' }
      ]
    },

    // ================================================================
    // 🏥 CIRURGIÕES VASCULARES - FAZENDA RIO GRANDE
    // Baseado nas regras do Dr. ROGERIO YOSHIKAZU NABESHIMA (Torao Tokuda)
    // Data: 19/11/2025
    // Total: 2 médicos com mesmas regras
    // ================================================================

    'RODRIGO GARCIA BRANCO': {
      doctorName: 'RODRIGO GARCIA BRANCO',
      rules: [
        // ================================================================
        // 🩺 PROCEDIMENTOS VASCULARES - CIRURGIA DE VARIZES
        // Especialidade: Cirurgia Vascular
        // ================================================================
        {
          procedureCode: '04.06.02.057-4',
          standardValue: 900.00,
          description: 'TRATAMENTO CIRÚRGICO DE VARIZES (UNILATERAL) - R$ 900,00'
        },
        {
          procedureCode: '04.06.02.056-6',
          standardValue: 900.00,
          description: 'TRATAMENTO CIRURGICO DE VARIZES (BILATERAL) - R$ 900,00'
        },
        // ================================================================
        // 💉 PROCEDIMENTOS ESCLEROSANTES NÃO ESTÉTICOS
        // ================================================================
        {
          procedureCode: '03.09.07.001-5',
          standardValue: 100.00,
          description: 'TRATAMENTO ESCLEROSANTE NÃO ESTÉTICO DE VARIZES - R$ 100,00'
        },
        {
          procedureCode: '03.09.07.002-3',
          standardValue: 150.00,
          description: 'TRATAMENTO ESCLEROSANTE NÃO ESTÉTICO DE VARIZES - R$ 150,00'
        }
      ]
    },

    'NATHALIA LESLIE ALBANEZ DE SOUZA SIQUEIRA': {
      doctorName: 'NATHALIA LESLIE ALBANEZ DE SOUZA SIQUEIRA',
      rules: [
        // ================================================================
        // 🩺 PROCEDIMENTOS VASCULARES - CIRURGIA DE VARIZES
        // Especialidade: Cirurgia Vascular
        // ================================================================
        {
          procedureCode: '04.06.02.057-4',
          standardValue: 900.00,
          description: 'TRATAMENTO CIRÚRGICO DE VARIZES (UNILATERAL) - R$ 900,00'
        },
        {
          procedureCode: '04.06.02.056-6',
          standardValue: 900.00,
          description: 'TRATAMENTO CIRURGICO DE VARIZES (BILATERAL) - R$ 900,00'
        },
        // ================================================================
        // 💉 PROCEDIMENTOS ESCLEROSANTES NÃO ESTÉTICOS
        // ================================================================
        {
          procedureCode: '03.09.07.001-5',
          standardValue: 100.00,
          description: 'TRATAMENTO ESCLEROSANTE NÃO ESTÉTICO DE VARIZES - R$ 100,00'
        },
        {
          procedureCode: '03.09.07.002-3',
          standardValue: 150.00,
          description: 'TRATAMENTO ESCLEROSANTE NÃO ESTÉTICO DE VARIZES - R$ 150,00'
        }
      ]
    },

    // ================================================================
    // 🏥 ORTOPEDISTAS - ARTROPLASTIA DE QUADRIL - FAZENDA RIO GRANDE
    // Data: 19/11/2025
    // Total: 3 médicos com mesma regra
    // ================================================================

    'BARBARA SAVARIS QUIOCA': {
      doctorName: 'BARBARA SAVARIS QUIOCA',
      rules: [
        // ================================================================
        // 🦴 PROCEDIMENTO ORTOPÉDICO - ARTROPLASTIA DE QUADRIL
        // Especialidade: Ortopedia
        // ================================================================
        {
          procedureCode: '04.08.04.009-2',
          standardValue: 2500.00,
          description: 'ARTROPLASTIA TOTAL PRIMARIA DO QUADRIL NÃO CIMENTADA / HÍBRIDA - R$ 2.500,00'
        }
      ]
    },

    'RICARDO LERMEN FAGUNDES': {
      doctorName: 'RICARDO LERMEN FAGUNDES',
      rules: [
        // ================================================================
        // 🦴 PROCEDIMENTO ORTOPÉDICO - ARTROPLASTIA DE QUADRIL
        // Especialidade: Ortopedia
        // ================================================================
        {
          procedureCode: '04.08.04.009-2',
          standardValue: 2500.00,
          description: 'ARTROPLASTIA TOTAL PRIMARIA DO QUADRIL NÃO CIMENTADA / HÍBRIDA - R$ 2.500,00'
        }
      ]
    },

    'VICTOR HUGO LUZ SENDODA': {
      doctorName: 'VICTOR HUGO LUZ SENDODA',
      rules: [
        // ================================================================
        // 🦴 PROCEDIMENTO ORTOPÉDICO - ARTROPLASTIA DE QUADRIL
        // Especialidade: Ortopedia
        // ================================================================
        {
          procedureCode: '04.08.04.009-2',
          standardValue: 2500.00,
          description: 'ARTROPLASTIA TOTAL PRIMARIA DO QUADRIL NÃO CIMENTADA / HÍBRIDA - R$ 2.500,00'
        }
      ]
    },

    // ================================================================
    // 🏥 ORTOPEDISTA - CIRURGIA DE JOELHO - FAZENDA RIO GRANDE
    // Data: 19/11/2025
    // ================================================================

    'THADEU TIESSI SUZUKI': {
      doctorName: 'THADEU TIESSI SUZUKI',
      rules: [
        // ================================================================
        // 🦴 PROCEDIMENTOS ORTOPÉDICOS - CIRURGIA DE JOELHO
        // Especialidade: Ortopedia (Joelho)
        // ================================================================
        {
          procedureCode: '04.08.05.089-6',
          standardValue: 750.00,
          description: 'TRATAMENTO CIRÚRGICO DE ROTURA DO MENISCO COM MENISCECTOMIA PARCIAL / TOTAL - R$ 750,00'
        },
        {
          procedureCode: '04.08.05.088-8',
          standardValue: 750.00,
          description: 'TRATAMENTO CIRÚRGICO DE ROTURA DE MENISCO COM SUTURA MENISCAL UNI / BICOMPATIMENTAL - R$ 750,00'
        },
        {
          procedureCode: '04.08.05.016-0',
          standardValue: 900.00,
          description: 'RECONSTRUÇÃO LIGAMENTAR INTRA-ARTICULAR DO JOELHO (CRUZADO ANTERIOR) - R$ 900,00'
        },
        {
          procedureCode: '04.08.05.015-2',
          standardValue: 500.00,
          description: 'RECONSTRUÇÃO LIGAMENTAR EXTRA-ARTICULAR DO JOELHO - R$ 500,00'
        },
        {
          procedureCode: '04.08.05.006-3',
          standardValue: 2000.00,
          description: 'ARTROPLASTIA TOTAL PRIMÁRIA DO JOELHO - R$ 2.000,00'
        }
      ]
    },

    // ================================================================
    // 🏥 REGRA ESPECIAL - VALOR FIXO POR PACIENTE - FAZENDA RIO GRANDE
    // Data: 19/11/2025
    // ================================================================

    'RAFAEL LUCENA BASTOS': {
      doctorName: 'RAFAEL LUCENA BASTOS',
      // ================================================================
      // 💰 REGRA ESPECIAL: VALOR FIXO POR PACIENTE/PROCEDIMENTO
      // Independente do tipo de procedimento realizado, o médico
      // recebe R$ 450,00 por cada paciente atendido (procedimento realizado).
      // NÃO há regras específicas por tipo de procedimento.
      // Data: 19/11/2025
      // ================================================================
      fixedPaymentRule: {
        amount: 450.00,
        description: 'Valor fixo por paciente atendido/procedimento realizado: R$ 450,00 (independente do tipo de procedimento)'
      },
      rules: [] // Sem regras individuais, usa valor fixo por procedimento
    },

    // ================================================================
    // 🏥 ORTOPEDISTAS - CIRURGIA DE OMBRO (ARTROSCOPIA) - FAZENDA RIO GRANDE
    // Data: 19/11/2025
    // Total: 2 médicos com mesmas regras
    // ================================================================

    'ANDRÉ AKIO MINAMIHARA': {
      doctorName: 'ANDRÉ AKIO MINAMIHARA',
      rules: [
        // ================================================================
        // 🦴 PROCEDIMENTOS ORTOPÉDICOS - CIRURGIA DE OMBRO
        // Especialidade: Ortopedia (Ombro - Artroscopia)
        // ================================================================
        {
          procedureCode: '04.08.01.014-2',
          standardValue: 0,
          description: 'REPARO DE ROTURA DO MANGUITO ROTADOR (INCLUI PROCEDIMENTOS DESCOMPRESSIVOS) - valor definido em regra de múltiplos'
        },
        {
          procedureCode: '04.08.06.071-9',
          standardValue: 0,
          description: 'VIDEOARTROSCOPIA - valor definido em regra de múltiplos'
        }
      ],
      multipleRules: [
        {
          codes: ['04.08.01.014-2', '04.08.06.071-9'],
          totalValue: 900.00,
          description: 'REPARO DE ROTURA DO MANGUITO ROTADOR + VIDEOARTROSCOPIA - R$ 900,00'
        }
      ]
    },

    'EDUARDO DE CARVALHO MARTINS': {
      doctorName: 'EDUARDO DE CARVALHO MARTINS',
      rules: [
        // ================================================================
        // 🦴 PROCEDIMENTOS ORTOPÉDICOS - CIRURGIA DE OMBRO
        // Especialidade: Ortopedia (Ombro - Artroscopia)
        // ================================================================
        {
          procedureCode: '04.08.01.014-2',
          standardValue: 0,
          description: 'REPARO DE ROTURA DO MANGUITO ROTADOR (INCLUI PROCEDIMENTOS DESCOMPRESSIVOS) - valor definido em regra de múltiplos'
        },
        {
          procedureCode: '04.08.06.071-9',
          standardValue: 0,
          description: 'VIDEOARTROSCOPIA - valor definido em regra de múltiplos'
        }
      ],
      multipleRules: [
        {
          codes: ['04.08.01.014-2', '04.08.06.071-9'],
          totalValue: 900.00,
          description: 'REPARO DE ROTURA DO MANGUITO ROTADOR + VIDEOARTROSCOPIA - R$ 900,00'
        }
      ]
    }
  },

  // ================================================================
  // HOSPITAL MUNICIPAL JUAREZ BARRETO DE MACEDO (FAX)
  // Hospital ID: 019c7380-459d-4aa5-bbd8-2dba4f361e7e
  // ================================================================
  'HOSPITAL_MUNICIPAL_JUAREZ_BARRETO_MACEDO': {
    // ================================================================
    // DR. HUMBERTO MOREIRA DA SILVA - OTORRINOLARINGOLOGIA
    // Hospital: Municipal Juarez Barreto de Macedo
    // Especialidade: Otorrinolaringologia
    // Baseado em: Dr. HUMBERTO MOREIRA DA SILVA (Torao Tokuda)
    // Data: 18/11/2025
    // ================================================================
    'HUMBERTO MOREIRA DA SILVA': {
      doctorName: 'HUMBERTO MOREIRA DA SILVA',
      // 🩺 PROCEDIMENTOS DE OTORRINOLARINGOLOGIA
      rules: [
        {
          procedureCode: '04.04.01.048-2',
          standardValue: 650.00,
          description: 'SEPTOPLASTIA - R$ 650,00'
        },
        {
          procedureCode: '04.04.01.041-5',
          standardValue: 650.00,
          description: 'TURBINECTOMIA - R$ 650,00'
        },
        {
          procedureCode: '04.04.01.002-4',
          standardValue: 650.00,
          description: 'AMIGDALECTOMIA - R$ 650,00'
        },
        {
          procedureCode: '04.04.01.001-6',
          standardValue: 650.00,
          description: 'ADENOIDECTOMIA - R$ 650,00'
        },
        {
          procedureCode: '04.04.01.003-2',
          standardValue: 650.00,
          description: 'ADENOAMIGDALECTOMIA - R$ 650,00'
        }
      ],
      // 🔗 REGRA MÚLTIPLA: Quando 2 ou mais procedimentos, valor total fixo
      multipleRule: {
        codes: ['04.04.01.048-2', '04.04.01.041-5', '04.04.01.002-4', '04.04.01.001-6', '04.04.01.003-2'],
        totalValue: 800.00,
        description: 'DOIS OU MAIS PROCEDIMENTOS ORL - R$ 800,00 TOTAL (não soma)'
      }
    },

    // ================================================================
    // DR. JULIO DE CASTRO NETO - ORTOPEDIA
    // Hospital: Municipal Juarez Barreto de Macedo
    // Especialidade: Ortopedia - Cirurgia de Joelho
    // Data: 19/11/2025
    // ================================================================
    'JULIO DE CASTRO NETO': {
      doctorName: 'JULIO DE CASTRO NETO',
      // 🦴 PROCEDIMENTOS ORTOPÉDICOS - CIRURGIA DE JOELHO
      rules: [
        {
          procedureCode: '04.08.05.089-6',
          standardValue: 750.00,
          description: 'TRATAMENTO CIRÚRGICO DE ROTURA DO MENISCO COM MENISCECTOMIA PARCIAL / TOTAL - R$ 750,00'
        },
        {
          procedureCode: '04.08.05.088-8',
          standardValue: 750.00,
          description: 'TRATAMENTO CIRÚRGICO DE ROTURA DE MENISCO COM SUTURA MENISCAL UNI / BICOMPATIMENTAL - R$ 750,00'
        },
        {
          procedureCode: '04.08.05.016-0',
          standardValue: 900.00,
          description: 'RECONSTRUÇÃO LIGAMENTAR INTRA-ARTICULAR DO JOELHO (CRUZADO ANTERIOR) - R$ 900,00'
        },
        {
          procedureCode: '04.08.05.015-2',
          standardValue: 500.00,
          description: 'RECONSTRUÇÃO LIGAMENTAR EXTRA-ARTICULAR DO JOELHO - R$ 500,00'
        },
        {
          procedureCode: '04.08.05.006-3',
          standardValue: 2000.00,
          description: 'ARTROPLASTIA TOTAL PRIMÁRIA DO JOELHO - R$ 2.000,00'
        }
      ]
    }
  },

  // ================================================================
  // OUTROS HOSPITAIS (adicionar conforme necessário)
  // ================================================================
};

// ================================================================
// 🔄 COMPATIBILIDADE REGRESSIVA
// ================================================================
// Manter referência para o sistema atual (Torao Tokuda)
const DOCTOR_PAYMENT_RULES = DOCTOR_PAYMENT_RULES_BY_HOSPITAL['TORAO_TOKUDA_APUCARANA'];

// ================================================================
// FUNÇÕES UTILITÁRIAS
// ================================================================

/**
 * 🏥 DETECTAR HOSPITAL DO MÉDICO
 * Função para identificar qual hospital baseado no contexto ou dados disponíveis
 */
function detectHospitalFromContext(doctorName: string, hospitalId?: string): string {
  // Prioridade 1: ID do hospital fornecido (SEMPRE usar se disponível)
  if (hospitalId === '01221e51-4bcd-4c45-b3d3-18d1df25c8f2') {
    return 'HOSPITAL_18_DEZEMBRO_ARAPOTI';
  }
  if (hospitalId === '792a0316-92b4-4504-8238-491d284099a3') {
    return 'HOSPITAL_MUNICIPAL_SAO_JOSE';
  }
  if (hospitalId === '47eddf6e-ac64-4433-acc1-7b644a2b43d0') {
    return 'HOSPITAL_NOSSA_SENHORA_APARECIDA_FOZ';
  }
  if (hospitalId === 'a8978eaa-b90e-4dc8-8fd5-0af984374d34') {
    return 'HOSPITAL_MATERNIDADE_NOSSA_SENHORA_APARECIDA_FRG';
  }
  if (hospitalId === '1d8ca73a-1927-462e-91c0-fa7004d0b377') {
    return 'HOSPITAL_MUNICIPAL_SANTA_ALICE';
  }
  if (hospitalId === '019c7380-459d-4aa5-bbd8-2dba4f361e7e') {
    return 'HOSPITAL_MUNICIPAL_JUAREZ_BARRETO_MACEDO';
  }
  
  // Se hospitalId foi fornecido mas não reconhecido, retornar padrão
  if (hospitalId) {
    console.warn(`⚠️ Hospital ID não reconhecido: ${hospitalId}`);
    return 'TORAO_TOKUDA_APUCARANA';
  }
  
  // Prioridade 2: Verificar se médico existe no Hospital Nossa Senhora Aparecida (Foz)
  if (DOCTOR_PAYMENT_RULES_BY_HOSPITAL['HOSPITAL_NOSSA_SENHORA_APARECIDA_FOZ']?.[doctorName.toUpperCase()]) {
    return 'HOSPITAL_NOSSA_SENHORA_APARECIDA_FOZ';
  }
  
  // Prioridade 3: Verificar se médico existe no Hospital Municipal São José
  if (DOCTOR_PAYMENT_RULES_BY_HOSPITAL['HOSPITAL_MUNICIPAL_SAO_JOSE']?.[doctorName.toUpperCase()]) {
    return 'HOSPITAL_MUNICIPAL_SAO_JOSE';
  }
  
  // Prioridade 4: Verificar se médico existe no Hospital 18 de Dezembro
  if (DOCTOR_PAYMENT_RULES_BY_HOSPITAL['HOSPITAL_18_DEZEMBRO_ARAPOTI']?.[doctorName.toUpperCase()]) {
    return 'HOSPITAL_18_DEZEMBRO_ARAPOTI';
  }
  
  // Prioridade 5: Verificar se médico existe no Hospital Maternidade (FRG)
  if (DOCTOR_PAYMENT_RULES_BY_HOSPITAL['HOSPITAL_MATERNIDADE_NOSSA_SENHORA_APARECIDA_FRG']?.[doctorName.toUpperCase()]) {
    return 'HOSPITAL_MATERNIDADE_NOSSA_SENHORA_APARECIDA_FRG';
  }
  
  // Prioridade 6: Verificar se médico existe no Hospital Juarez Barreto de Macedo
  if (DOCTOR_PAYMENT_RULES_BY_HOSPITAL['HOSPITAL_MUNICIPAL_JUAREZ_BARRETO_MACEDO']?.[doctorName.toUpperCase()]) {
    return 'HOSPITAL_MUNICIPAL_JUAREZ_BARRETO_MACEDO';
  }
  
  // Prioridade 7: Verificar se médico existe no Hospital Municipal Santa Alice
  if (DOCTOR_PAYMENT_RULES_BY_HOSPITAL['HOSPITAL_MUNICIPAL_SANTA_ALICE']?.[doctorName.toUpperCase()]) {
    return 'HOSPITAL_MUNICIPAL_SANTA_ALICE';
  }
  
  // Prioridade 8: Verificar se médico existe no Torao Tokuda (padrão)
  if (DOCTOR_PAYMENT_RULES_BY_HOSPITAL['TORAO_TOKUDA_APUCARANA']?.[doctorName.toUpperCase()]) {
    return 'TORAO_TOKUDA_APUCARANA';
  }
  
  // Fallback: Torao Tokuda (compatibilidade)
  return 'TORAO_TOKUDA_APUCARANA';
}

/**
 * 💰 CALCULAR PAGAMENTO BASEADO NAS REGRAS DO MÉDICO
 * 🆕 AGORA SUPORTA MÚLTIPLOS HOSPITAIS E REGRAS FIXAS
 */
export function calculateDoctorPayment(
  doctorName: string,
  procedures: ProcedurePaymentInfo[],
  hospitalId?: string
): {
  procedures: (ProcedurePaymentInfo & { calculatedPayment: number; paymentRule: string; isSpecialRule: boolean })[];
  totalPayment: number;
  appliedRule: string;
} {
  // Detectar hospital correto
  const hospitalKey = detectHospitalFromContext(doctorName, hospitalId);
  const hospitalRules = DOCTOR_PAYMENT_RULES_BY_HOSPITAL[hospitalKey];
  const rule = hospitalRules?.[doctorName.toUpperCase()];
  
  if (!rule) {
    // Sem regra específica, retornar array vazio
    return {
      procedures: [],
      totalPayment: 0,
      appliedRule: 'Nenhuma regra específica'
    };
  }

  // 🎯 FILTRAR PROCEDIMENTOS QUE ESTÃO NAS REGRAS ESPECÍFICAS
  const allRuleCodes = [
    ...rule.rules.map(r => r.procedureCode),
    ...(rule.multipleRule?.codes || []),
    ...(rule.multipleRules?.flatMap(mr => mr.codes) || [])
  ];
  
  const filteredProcedures = procedures.filter(proc => 
    allRuleCodes.includes(proc.procedure_code)
  );

  // 🆕 SE NÃO HÁ PROCEDIMENTOS COM REGRAS ESPECÍFICAS, USAR fixedPaymentRule COMO FALLBACK
  if (filteredProcedures.length === 0) {
    // Verificar se tem regra de valor fixo (fallback)
    if (rule.fixedPaymentRule) {
      // Aplicar valor fixo ao primeiro procedimento
      const calculatedProcedures = procedures.map((proc, index) => ({
        ...proc,
        calculatedPayment: index === 0 ? rule.fixedPaymentRule!.amount : 0,
        paymentRule: rule.fixedPaymentRule!.description,
        isSpecialRule: true
      }));

      return {
        procedures: calculatedProcedures,
        totalPayment: rule.fixedPaymentRule.amount,
        appliedRule: rule.fixedPaymentRule.description
      };
    }
    
    // Sem regras específicas nem fixedPaymentRule
    return {
      procedures: [],
      totalPayment: 0,
      appliedRule: 'Nenhum procedimento com regra específica encontrado'
    };
  }

  const procedureCodes = filteredProcedures.map(p => p.procedure_code);
  
  // 🆕 REGRA ESPECIAL: APENAS PROCEDIMENTO PRINCIPAL (onlyMainProcedureRule)
  // Se habilitada, quando há múltiplos procedimentos, paga apenas o de maior valor
  if (rule.onlyMainProcedureRule?.enabled && filteredProcedures.length > 1) {
    // Encontrar o procedimento de maior valor
    const proceduresWithValues = filteredProcedures.map(proc => {
      const standardRule = rule.rules.find(r => r.procedureCode === proc.procedure_code);
      return {
        procedure: proc,
        value: standardRule?.standardValue || 0,
        rule: standardRule
      };
    });
    
    // Ordenar por valor (maior para menor)
    proceduresWithValues.sort((a, b) => b.value - a.value);
    
    // Pegar apenas o procedimento principal (maior valor)
    const mainProcedure = proceduresWithValues[0];
    
    // Criar array com todos os procedimentos, mas apenas o principal tem valor
    const calculatedProcedures = proceduresWithValues.map((item, index) => {
      const isMain = index === 0;
      return {
        ...item.procedure,
        calculatedPayment: isMain ? item.value : 0,
        paymentRule: isMain 
          ? `${rule.onlyMainProcedureRule!.description} - R$ ${item.value.toFixed(2)}` 
          : `Procedimento secundário (não pago - regra especial)`,
        isSpecialRule: true
      };
    });
    
    return {
      procedures: calculatedProcedures,
      totalPayment: mainProcedure.value,
      appliedRule: `${rule.onlyMainProcedureRule.description} - ${filteredProcedures.length} procedimentos, pagando apenas o principal (R$ ${mainProcedure.value.toFixed(2)})`
    };
  }
  
  // Verificar se há regras para múltiplas combinações específicas (multipleRules)
  if (rule.multipleRules && procedureCodes.length > 1) {
    // Procurar por combinação exata de códigos
    for (const multiRule of rule.multipleRules) {
      const procedureCodesSet = new Set(procedureCodes);
      
      // Verificar se todos os códigos da regra estão presentes nos procedimentos
      const hasAllCodes = multiRule.codes.every(code => procedureCodesSet.has(code));
      
      if (hasAllCodes && multiRule.codes.length === procedureCodes.length) {
        // Combinação exata encontrada
        
        // 🆕 LÓGICA ESPECIAL PARA HÉRNIAS DA DRA. FABIANE
        // Códigos de hérnias
        const herniaCodes = ['04.07.04.010-2', '04.07.04.009-9', '04.07.04.006-4', '04.07.04.012-9', '04.07.04.008-0'];
        const isHerniaRule = multiRule.codes.every(code => herniaCodes.includes(code));
        
        if (isHerniaRule && doctorName.toUpperCase().includes('FABIANE')) {
          // Mapear valores originais das hérnias
          const herniaValues: Record<string, number> = {
            '04.07.04.010-2': 700.00,  // Inguinal Unilateral
            '04.07.04.009-9': 700.00,  // Inguinal Bilateral
            '04.07.04.006-4': 800.00,  // Epigástrica
            '04.07.04.012-9': 450.00,  // Umbilical
            '04.07.04.008-0': 600.00   // Incisional/Ventral
          };
          
          // Mapear nomes das hérnias
          const herniaNames: Record<string, string> = {
            '04.07.04.010-2': 'INGUINAL UNILATERAL',
            '04.07.04.009-9': 'INGUINAL BILATERAL',
            '04.07.04.006-4': 'EPIGÁSTRICA',
            '04.07.04.012-9': 'UMBILICAL',
            '04.07.04.008-0': 'INCISIONAL/VENTRAL'
          };
          
          // Calcular valores individuais: 1ª hérnia mantém valor, demais R$ 300
          const calculatedProcedures = filteredProcedures.map((proc, index) => {
            const isFirstHernia = index === 0;
            const individualValue = isFirstHernia 
              ? (herniaValues[proc.procedure_code] || 0) 
              : 300.00;
            
            const herniaName = herniaNames[proc.procedure_code] || 'HÉRNIA';
            const position = index === 0 ? '1ª' : index === 1 ? '2ª' : index === 2 ? '3ª' : '4ª';
            
            return {
              ...proc,
              calculatedPayment: individualValue,
              paymentRule: `${herniaName} (${position}) - R$ ${individualValue.toFixed(2)}`,
              isSpecialRule: true
            };
          });
          
          // ✅ SOMA CORRETA: Somar os valores calculados individuais
          const totalPayment = calculatedProcedures.reduce((sum, proc) => sum + proc.calculatedPayment, 0);
          
          return {
            procedures: calculatedProcedures,
            totalPayment: totalPayment,
            appliedRule: multiRule.description
          };
        }
        
        // Lógica padrão para outras regras de múltiplos
        const calculatedProcedures = filteredProcedures.map(proc => ({
          ...proc,
          calculatedPayment: 0, // Valor individual zerado
          paymentRule: multiRule.description,
          isSpecialRule: true
        }));
        
        // Aplicar valor total apenas no primeiro procedimento
        if (calculatedProcedures.length > 0) {
          calculatedProcedures[0].calculatedPayment = multiRule.totalValue;
        }
        
        return {
          procedures: calculatedProcedures,
          totalPayment: multiRule.totalValue,
          appliedRule: multiRule.description
        };
      }
    }
  }

  // Verificar se há múltiplos procedimentos da regra especial (multipleRule - regra antiga)
  const specialProcedures = filteredProcedures.filter(proc => 
    rule.multipleRule?.codes.includes(proc.procedure_code)
  );

  let calculatedProcedures: (ProcedurePaymentInfo & { calculatedPayment: number; paymentRule: string; isSpecialRule: boolean })[];
  let appliedRule: string;

  if (specialProcedures.length >= 2 && rule.multipleRule) {
    // Aplicar regra de múltiplos procedimentos
    const totalSpecialValue = rule.multipleRule.totalValue;
    const valuePerProcedure = totalSpecialValue / specialProcedures.length;

    calculatedProcedures = filteredProcedures.map(proc => {
      if (rule.multipleRule?.codes.includes(proc.procedure_code)) {
        return {
          ...proc,
          calculatedPayment: valuePerProcedure,
          paymentRule: `${rule.multipleRule.description} (R$ ${valuePerProcedure.toFixed(2)} cada)`,
          isSpecialRule: true
        };
      } else {
        // Procedimentos com regra individual
        const standardRule = rule.rules.find(r => r.procedureCode === proc.procedure_code);
        if (!standardRule) {
          // Código aparece apenas em regras múltiplas, sem combinação ativa
          return {
            ...proc,
            calculatedPayment: 0,
            paymentRule: 'Sem regra individual aplicável',
            isSpecialRule: true
          };
        }
        return {
          ...proc,
          calculatedPayment: standardRule.standardValue,
          paymentRule: standardRule.description || `R$ ${standardRule.standardValue.toFixed(2)}`,
          isSpecialRule: true
        };
      }
    });

    appliedRule = `Regra múltiplos procedimentos: ${specialProcedures.length} procedimentos = R$ ${totalSpecialValue.toFixed(2)} total`;
  } else {
    // Aplicar regras individuais
    calculatedProcedures = filteredProcedures
      .map(proc => {
        const standardRule = rule.rules.find(r => r.procedureCode === proc.procedure_code);
        if (!standardRule) {
          // Ignorar procedimentos que só possuem regra em combinação múltipla
          return null as unknown as (ProcedurePaymentInfo & { calculatedPayment: number; paymentRule: string; isSpecialRule: boolean });
        }
        return {
          ...proc,
          calculatedPayment: standardRule.standardValue,
          paymentRule: standardRule.description || `R$ ${standardRule.standardValue.toFixed(2)}`,
          isSpecialRule: true
        };
      })
      .filter(Boolean);

    appliedRule = `Regras individuais aplicadas para ${calculatedProcedures.length} procedimento(s)`;
  }

  const totalPayment = calculatedProcedures.reduce((sum, proc) => sum + proc.calculatedPayment, 0);

  return {
    procedures: calculatedProcedures,
    totalPayment,
    appliedRule
  };
}

/**
 * 🚀 OTIMIZAÇÃO #3: INICIALIZAR CACHE DE REGRAS
 * Cria Maps indexados para busca O(1) ao invés de O(n)
 */
function initializeRulesCache() {
  if (FIXED_RULES_CACHE && PERCENTAGE_RULES_CACHE && INDIVIDUAL_RULES_CACHE) {
    return; // Já inicializado
  }

  console.log('🚀 [OTIMIZAÇÃO] Inicializando cache de regras de pagamento...');
  const startTime = performance.now();

  FIXED_RULES_CACHE = new Map();
  PERCENTAGE_RULES_CACHE = new Map();
  INDIVIDUAL_RULES_CACHE = new Map();

  // Percorrer todos os hospitais e médicos
  Object.entries(DOCTOR_PAYMENT_RULES_BY_HOSPITAL).forEach(([hospitalKey, hospitalRules]) => {
    Object.entries(hospitalRules).forEach(([doctorName, rule]) => {
      const cacheKey = `${doctorName}::${hospitalKey}`;
      
      // Indexar regras fixas
      if (rule.fixedPaymentRule) {
        FIXED_RULES_CACHE!.set(cacheKey, {
          amount: rule.fixedPaymentRule.amount,
          description: rule.fixedPaymentRule.description,
          hospitalId: hospitalKey
        });
        // Também indexar sem hospital para fallback
        FIXED_RULES_CACHE!.set(doctorName, {
          amount: rule.fixedPaymentRule.amount,
          description: rule.fixedPaymentRule.description,
          hospitalId: hospitalKey
        });
      }

      // Indexar regras de percentual
      if (rule.percentageRule) {
        PERCENTAGE_RULES_CACHE!.set(cacheKey, {
          percentage: rule.percentageRule.percentage,
          description: rule.percentageRule.description,
          hospitalId: hospitalKey
        });
        // Também indexar sem hospital para fallback
        PERCENTAGE_RULES_CACHE!.set(doctorName, {
          percentage: rule.percentageRule.percentage,
          description: rule.percentageRule.description,
          hospitalId: hospitalKey
        });
      }

      // Indexar regras individuais
      INDIVIDUAL_RULES_CACHE!.set(cacheKey, rule);
      INDIVIDUAL_RULES_CACHE!.set(doctorName, rule);
    });
  });

  const totalTime = performance.now() - startTime;
  console.log(`✅ [OTIMIZAÇÃO] Cache inicializado em ${totalTime.toFixed(2)}ms`);
  console.log(`   📊 ${FIXED_RULES_CACHE.size} regras fixas, ${PERCENTAGE_RULES_CACHE.size} regras de percentual, ${INDIVIDUAL_RULES_CACHE.size} regras individuais`);
}

/**
 * 💰 CALCULAR VALOR BASEADO EM VALOR FIXO
 * Para médicos que têm regra de valor fixo independente de procedimentos
 * 🚀 OTIMIZADO: Usa cache Map para busca O(1)
 */
export function calculateFixedPayment(
  doctorName: string,
  hospitalId?: string
): {
  calculatedPayment: number;
  appliedRule: string;
  hasFixedRule: boolean;
} {
  // 🚀 Inicializar cache se necessário
  initializeRulesCache();

  // 🚀 BUSCA O(1) no cache
  const hospitalKey = detectHospitalFromContext(doctorName, hospitalId);
  const cacheKey = `${doctorName.toUpperCase()}::${hospitalKey}`;
  
  // ✅ CORREÇÃO: Buscar APENAS com hospital específico se hospitalId foi fornecido
  let rule = FIXED_RULES_CACHE!.get(cacheKey);
  
  // Fallback: buscar sem hospital APENAS se hospitalId NÃO foi fornecido
  if (!rule && !hospitalId) {
    rule = FIXED_RULES_CACHE!.get(doctorName.toUpperCase());
  }
  
  if (!rule) {
    return {
      calculatedPayment: 0,
      appliedRule: 'Nenhuma regra de valor fixo definida',
      hasFixedRule: false
    };
  }

  return {
    calculatedPayment: rule.amount,
    appliedRule: rule.description,
    hasFixedRule: true
  };
}

/**
 * 🔍 VERIFICAR SE MÉDICO TEM REGRAS INDIVIDUAIS (rules)
 * Útil para distinguir entre valor fixo mensal e fixedPaymentRule como fallback
 */
export function hasIndividualPaymentRules(doctorName: string, hospitalId?: string): boolean {
  const hospitalKey = detectHospitalFromContext(doctorName, hospitalId);
  const hospitalRules = DOCTOR_PAYMENT_RULES_BY_HOSPITAL[hospitalKey];
  const rule = hospitalRules?.[doctorName.toUpperCase()];
  return !!(rule?.rules && rule.rules.length > 0);
}

/**
 * 🔍 OBTER TODOS OS CÓDIGOS DE PROCEDIMENTOS COM REGRAS DEFINIDAS
 * Retorna lista de procedimentos que TÊM regras de pagamento para o médico
 */
export function getDoctorRuleProcedureCodes(doctorName: string, hospitalId?: string): string[] {
  const hospitalKey = detectHospitalFromContext(doctorName, hospitalId);
  const hospitalRules = DOCTOR_PAYMENT_RULES_BY_HOSPITAL[hospitalKey];
  const rule = hospitalRules?.[doctorName.toUpperCase()];
  
  if (!rule) return [];
  
  // Coletar todos os códigos de procedimentos com regras
  const codes = new Set<string>();
  
  // 1. Regras individuais
  rule.rules?.forEach(r => codes.add(r.procedureCode));
  
  // 2. Regra múltipla (antiga)
  rule.multipleRule?.codes?.forEach(c => codes.add(c));
  
  // 3. Regras múltiplas (array)
  rule.multipleRules?.forEach(mr => mr.codes.forEach(c => codes.add(c)));
  
  return Array.from(codes);
}

/**
 * 🚨 VERIFICAR PROCEDIMENTOS SEM REGRAS
 * Identifica procedimentos "órfãos" - realizados pelo médico mas sem regra de pagamento
 * Retorna { hasUnruledProcedures: boolean, unruledProcedures: string[] }
 */
export function checkUnruledProcedures(
  doctorName: string,
  performedProcedureCodes: string[],
  hospitalId?: string
): {
  hasUnruledProcedures: boolean;
  unruledProcedures: string[];
  totalUnruled: number;
} {
  // Se médico tem pagamento fixo, não precisa verificar procedimentos órfãos
  const fixedCalc = calculateFixedPayment(doctorName, hospitalId);
  if (fixedCalc.hasFixedRule) {
    return {
      hasUnruledProcedures: false,
      unruledProcedures: [],
      totalUnruled: 0
    };
  }
  
  // Obter códigos com regras definidas
  const ruledCodes = new Set(getDoctorRuleProcedureCodes(doctorName, hospitalId));
  
  // Filtrar apenas procedimentos médicos (04.xxx) que NÃO têm regras
  const unruledProcedures = performedProcedureCodes
    .filter(code => {
      // Limpar código (extrair apenas o padrão XX.XX.XX.XXX-X)
      const cleanCode = code.match(/^([\d]{2}\.[\d]{2}\.[\d]{2}\.[\d]{3}-[\d])/)?.[1] || code;
      
      // Verificar se é procedimento médico (04.xxx)
      const isMedical = cleanCode.startsWith('04');
      
      // Verificar se NÃO tem regra
      const hasNoRule = !ruledCodes.has(cleanCode);
      
      return isMedical && hasNoRule;
    });
  
  return {
    hasUnruledProcedures: unruledProcedures.length > 0,
    unruledProcedures: Array.from(new Set(unruledProcedures)), // Remove duplicatas
    totalUnruled: unruledProcedures.length
  };
}

// ================================================================
// 🚨 FUNÇÕES ANTIGAS REMOVIDAS - SUBSTITUÍDAS POR LÓGICA DIRETA
// A verificação de pacientes sem repasse agora é feita diretamente
// no serviço DoctorsRevenueService.countPatientsWithoutPayment()
// ================================================================

/**
 * 🆕 CALCULAR VALOR BASEADO EM PERCENTUAL DO TOTAL
 * Para médicos que têm regra de percentual sobre o valor total
 * 🚀 OTIMIZADO: Usa cache Map para busca O(1)
 */
export function calculatePercentagePayment(
  doctorName: string,
  totalValue: number,
  hospitalId?: string
): {
  calculatedPayment: number;
  appliedRule: string;
  hasPercentageRule: boolean;
} {
  // 🚀 Inicializar cache se necessário
  initializeRulesCache();

  // 🚀 BUSCA O(1) no cache
  const hospitalKey = detectHospitalFromContext(doctorName, hospitalId);
  const cacheKey = `${doctorName.toUpperCase()}::${hospitalKey}`;
  
  // ✅ CORREÇÃO: Buscar APENAS com hospital específico se hospitalId foi fornecido
  let rule = PERCENTAGE_RULES_CACHE!.get(cacheKey);
  
  // Fallback: buscar sem hospital APENAS se hospitalId NÃO foi fornecido
  if (!rule && !hospitalId) {
    rule = PERCENTAGE_RULES_CACHE!.get(doctorName.toUpperCase());
  }
  
  if (!rule) {
    return {
      calculatedPayment: 0,
      appliedRule: 'Nenhuma regra de percentual definida',
      hasPercentageRule: false
    };
  }

  const calculatedPayment = (totalValue * rule.percentage) / 100;
  
  return {
    calculatedPayment,
    appliedRule: `${rule.description} (${rule.percentage}% de R$ ${totalValue.toFixed(2)} = R$ ${calculatedPayment.toFixed(2)})`,
    hasPercentageRule: true
  };
}

/**
 * 💰 FORMATAR VALOR MONETÁRIO
 */
const formatCurrency = (value: number) => {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL'
  }).format(value);
};

// ================================================================
// COMPONENTE PRINCIPAL
// ================================================================

const DoctorPaymentRules: React.FC<DoctorPaymentRulesProps> = ({
  doctorName,
  procedures,
  hospitalId,
  className = ''
}) => {
  // Aplicação informativa das regras SUS de múltiplas cirurgias (não altera valores deste componente)
  try {
    const mapped: ProcedureWithSigtap[] = procedures.map((p, idx) => ({
      procedureCode: p.procedure_code,
      sequenceOrder: idx + 1,
      valueHosp: 0,
      valueProf: p.value_reais || 0,
      valueAmb: 0
    }));
    const calcPreview = applySpecialCalculation(mapped);
    console.log('🧮 [SUS Preview] Regras múltiplas/sequenciais aplicadas (informativo):', calcPreview);
  } catch {}
  const paymentCalculation = calculateDoctorPayment(doctorName, procedures, hospitalId);
  
  // Detectar hospital e verificar regras
  const hospitalKey = detectHospitalFromContext(doctorName, hospitalId);
  const hospitalRules = DOCTOR_PAYMENT_RULES_BY_HOSPITAL[hospitalKey];
  const hasSpecialRules = hospitalRules?.[doctorName.toUpperCase()];
  
  // 🆕 VERIFICAR SE HÁ REGRA DE VALOR FIXO
  const fixedCalculation = calculateFixedPayment(doctorName, hospitalId);
  
  // 🆕 VERIFICAR SE HÁ REGRA DE PERCENTUAL
  const totalValueProcedures = procedures.reduce((sum, proc) => sum + proc.value_reais, 0);
  const percentageCalculation = calculatePercentagePayment(doctorName, totalValueProcedures, hospitalId);

  // Se não há regras específicas nem regras de percentual nem regras fixas, não mostrar
  if (!hasSpecialRules || (paymentCalculation.procedures.length === 0 && !percentageCalculation.hasPercentageRule && !fixedCalculation.hasFixedRule)) {
    return null;
  }

  // Calcular total original apenas dos procedimentos com regras
  const originalTotal = paymentCalculation.procedures.reduce((sum, proc) => sum + proc.value_reais, 0);
  const difference = paymentCalculation.totalPayment - originalTotal;

  return (
    <Card className={`bg-gradient-to-br from-yellow-50 to-orange-50 border-orange-200 ${className}`}>
      <CardContent className="p-4">
        <div className="space-y-3">
          {/* Cabeçalho */}
          <div className="flex items-center gap-2 mb-3">
            <Calculator className="h-5 w-5 text-orange-600" />
            <h4 className="font-semibold text-orange-800">Regras de Pagamento Específicas</h4>
            <Badge variant="outline" className="bg-orange-100 text-orange-700 border-orange-300">
              {doctorName}
            </Badge>
          </div>

          {/* 🆕 SEÇÃO DA REGRA DE VALOR FIXO */}
          {fixedCalculation.hasFixedRule && (
            <div className="bg-gradient-to-r from-purple-50 to-violet-50 rounded-lg p-3 border border-purple-200">
              <div className="flex items-start gap-2">
                <DollarSign className="h-4 w-4 text-purple-600 mt-0.5" />
                <div className="flex-1">
                  <div className="text-sm font-bold text-purple-800">
                    💎 Regra de Valor Fixo Aplicada
                  </div>
                  <div className="text-xs text-purple-700 mt-1">
                    {fixedCalculation.appliedRule}
                  </div>
                  <div className="text-lg font-bold text-purple-800 mt-2">
                    {formatCurrency(fixedCalculation.calculatedPayment)}
                  </div>
                  <div className="text-xs text-purple-600 mt-1 font-medium">
                    ✅ Valor independe da quantidade ou tipo de procedimentos
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* 🆕 SEÇÃO DA REGRA DE PERCENTUAL */}
          {!fixedCalculation.hasFixedRule && percentageCalculation.hasPercentageRule && (
            <div className="bg-gradient-to-r from-green-50 to-emerald-50 rounded-lg p-3 border border-green-200">
              <div className="flex items-start gap-2">
                <DollarSign className="h-4 w-4 text-green-600 mt-0.5" />
                <div className="flex-1">
                  <div className="text-sm font-bold text-green-800">
                    💰 Regra de Percentual Aplicada
                  </div>
                  <div className="text-xs text-green-700 mt-1">
                    {percentageCalculation.appliedRule}
                  </div>
                  <div className="text-xs text-green-600 mt-1 font-medium">
                    ✅ Esta regra substitui cálculos individuais por procedimento
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Resumo da Regra Aplicada */}
          {!fixedCalculation.hasFixedRule && !percentageCalculation.hasPercentageRule && (
            <div className="bg-white rounded-lg p-3 border border-orange-200">
              <div className="flex items-start gap-2">
                <CheckCircle className="h-4 w-4 text-green-600 mt-0.5" />
                <div className="flex-1">
                  <div className="text-sm font-medium text-gray-800">
                    {paymentCalculation.appliedRule}
                  </div>
                  <div className="text-xs text-gray-600 mt-1">
                    {paymentCalculation.procedures.length} procedimento(s) calculado(s) - apenas códigos com regras definidas
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Comparação de Valores */}
          <div className="grid grid-cols-3 gap-3">
            <div className="bg-white rounded-lg p-3 text-center border border-gray-200">
              <div className="text-xs text-gray-600 mb-1">Valor Original</div>
              <div className="font-semibold text-gray-800">{formatCurrency(originalTotal)}</div>
            </div>
            <div className="bg-white rounded-lg p-3 text-center border border-green-200">
              <div className="text-xs text-green-600 mb-1">Valor Calculado</div>
              <div className="font-semibold text-green-700">{formatCurrency(paymentCalculation.totalPayment)}</div>
            </div>
            <div className={`bg-white rounded-lg p-3 text-center border ${
              difference >= 0 ? 'border-green-200' : 'border-red-200'
            }`}>
              <div className={`text-xs mb-1 ${
                difference >= 0 ? 'text-green-600' : 'text-red-600'
              }`}>Diferença</div>
              <div className={`font-semibold ${
                difference >= 0 ? 'text-green-700' : 'text-red-700'
              }`}>
                {difference >= 0 ? '+' : ''}{formatCurrency(difference)}
              </div>
            </div>
          </div>

          {/* Detalhes por Procedimento */}
          <div className="space-y-2">
            <div className="text-sm font-medium text-gray-700">Detalhamento por Procedimento:</div>
            {paymentCalculation.procedures.map((proc, index) => (
              <div key={index} className={`bg-white rounded-lg p-2 border ${
                proc.isSpecialRule ? 'border-orange-200 bg-orange-50/30' : 'border-gray-200'
              }`}>
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs bg-gray-100 px-2 py-1 rounded">
                        {proc.procedure_code}
                      </span>
                      {proc.isSpecialRule && (
                        <Badge variant="outline" className="bg-orange-100 text-orange-700 border-orange-300 text-xs">
                          Regra Específica
                        </Badge>
                      )}
                    </div>
                    <div className="text-xs text-gray-600 mt-1">
                      {proc.paymentRule}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className={`font-semibold ${
                      proc.isSpecialRule ? 'text-orange-700' : 'text-gray-700'
                    }`}>
                      {formatCurrency(proc.calculatedPayment)}
                    </div>
                    {proc.calculatedPayment !== proc.value_reais && (
                      <div className="text-xs text-gray-500 line-through">
                        {formatCurrency(proc.value_reais)}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Aviso sobre Regras */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
            <div className="flex items-start gap-2">
              <AlertTriangle className="h-4 w-4 text-blue-600 mt-0.5" />
              <div className="text-xs text-blue-800">
                <strong>Importante:</strong> Apenas procedimentos com regras específicas definidas são exibidos e calculados. 
                Conforme regulamentação, o médico recebe pagamento somente pelos procedimentos que executa e que possuem regras estabelecidas.
              </div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default DoctorPaymentRules;
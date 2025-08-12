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
  className?: string;
}

// ================================================================
// REGRAS DE PAGAMENTO POR MÉDICO
// ================================================================
// Organizado por Hospital - Programa Opera Paraná
// Hospital: Torao Tokuda - Apucarana
// ================================================================

const DOCTOR_PAYMENT_RULES: Record<string, DoctorPaymentRule> = {
  // ================================================================
  // HOSPITAL TORAO TOKUDA - APUCARANA
  // ================================================================
  
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
      {
        procedureCode: '04.06.02.056-6',
        standardValue: 1050.00,
        description: 'TRATAMENTO CIRURGICO DE VARIZES (BILATERAL) - R$ 1.050,00'
      },
      {
        procedureCode: '04.06.02.057-4',
        standardValue: 1000.00,
        description: 'TRATAMENTO CIRÚRGICO DE VARIZES (UNILATERAL) - R$ 1.000,00'
      }
    ]
  },
  
  'HELIO SHINDY KISSINA': {
    doctorName: 'HELIO SHINDY KISSINA',
    rules: [
      // Procedimentos individuais
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
        description: 'PLASTICA TOTAL DO PENIS (INCLUI PEYRONIE) - R$ 500,00'
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
        procedureCode: 'RESSECÇÃO_CISTOS',
        standardValue: 250.00,
        description: 'RESSECÇÃO DE CISTOS/CAUTERIZAÇÕES - R$ 250,00'
      }
    ],
    // Regras para múltiplos procedimentos específicos
    multipleRules: [
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
        description: 'NEFROLITOTOMIA + CATETER + EXTRAÇÃO CÁLCULO - R$ 1.400,00'
      },
      {
        codes: ['04.09.01.023-5', '04.09.01.014-6', '04.09.01.059-6'],
        totalValue: 1500.00,
        description: 'NEFROLITOTOMIA + EXTRAÇÃO + URETEROLITOTRIPSIA - R$ 1.500,00'
      },
      {
        codes: ['04.09.01.023-5', '04.09.01.017-0', '04.09.01.014-6', '04.09.01.059-6'],
        totalValue: 1600.00,
        description: 'NEFROLITOTOMIA + CATETER + EXTRAÇÃO + URETEROLITOTRIPSIA - R$ 1.600,00'
      },
      {
        codes: ['04.09.01.059-6', '04.09.01.017-0'],
        totalValue: 1000.00,
        description: 'URETEROLITOTRIPSIA + CATETER DUPLO J - R$ 1.000,00'
      },
      {
        codes: ['04.09.01.018-9', '04.09.01.017-0'],
        totalValue: 1100.00,
        description: 'LITOTRIPSIA + CATETER DUPLO J - R$ 1.100,00'
      },
      {
        codes: ['04.09.01.018-9', '04.09.01.014-6', '04.09.01.017-0'],
        totalValue: 1200.00,
        description: 'LITOTRIPSIA + EXTRAÇÃO + CATETER - R$ 1.200,00'
      },
      {
        codes: ['04.09.01.018-9', '04.09.01.059-6', '04.09.01.014-6', '04.09.01.017-0'],
        totalValue: 1300.00,
        description: 'LITOTRIPSIA + URETEROLITOTRIPSIA + EXTRAÇÃO + CATETER - R$ 1.300,00'
      },
      {
        codes: ['04.09.03.004-0', '04.09.01.038-3'],
        totalValue: 1200.00,
        description: 'RESSECÇÃO PRÓSTATA + RESSECÇÃO LESÃO VESICAL - R$ 1.200,00'
      },
      {
        codes: ['04.09.04.021-5', '04.09.04.019-3'],
        totalValue: 400.00,
        description: 'HIDROCELE + RESSECÇÃO BOLSA ESCROTAL - R$ 400,00'
      },
      {
        codes: ['04.09.04.021-5', '04.09.04.019-3', '04.09.04.017-7'],
        totalValue: 500.00,
        description: 'HIDROCELE + RESSECÇÃO + PLÁSTICA BOLSA - R$ 500,00'
      },
      {
        codes: ['04.09.04.013-4', '04.09.04.017-7'],
        totalValue: 550.00,
        description: 'ORQUIDOPEXIA + PLÁSTICA BOLSA ESCROTAL - R$ 550,00'
      },
      {
        codes: ['04.09.04.012-6', '04.09.04.017-7'],
        totalValue: 550.00,
        description: 'ORQUIDOPEXIA BILATERAL + PLÁSTICA BOLSA - R$ 550,00'
      },
      {
        codes: ['04.09.01.032-4', '04.09.01.057-0'],
        totalValue: 1000.00,
        description: 'PIELOPLASTIA + URETEROPLASTIA - R$ 1.000,00'
      },
      {
        codes: ['04.09.01.032-4', '04.09.01.057-0', '04.09.01.017-0'],
        totalValue: 1100.00,
        description: 'PIELOPLASTIA + URETEROPLASTIA + CATETER - R$ 1.100,00'
      }
    ]
  },
  
  'ROGERIO YOSHIKAZU NABESHIMA': {
    doctorName: 'ROGERIO YOSHIKAZU NABESHIMA',
    rules: [
      {
        procedureCode: '04.06.02.056-6',
        standardValue: 1050.00,
        description: 'TRATAMENTO CIRÚRGICO DE VARIZES (BILATERAL) - R$ 1.050,00'
      },
      {
        procedureCode: '04.06.02.057-4',
        standardValue: 1000.00,
        description: 'TRATAMENTO CIRÚRGICO DE VARIZES (UNILATERAL) - R$ 1.000,00'
      }
    ]
  },

  'FABIANE GREGORIO BATISTELA': {
    doctorName: 'FABIANE GREGORIO BATISTELA',
    rules: [
      // Cirurgias Vasculares
      {
        procedureCode: '04.06.02.056-6',
        standardValue: 1050.00,
        description: 'TRATAMENTO CIRÚRGICO DE VARIZES (BILATERAL) - R$ 1.050,00'
      },
      {
        procedureCode: '04.06.02.057-4',
        standardValue: 1000.00,
        description: 'TRATAMENTO CIRÚRGICO DE VARIZES (UNILATERAL) - R$ 1.000,00'
      },
      // Cirurgias Gastrointestinais
      {
        procedureCode: '04.07.02.010-1',
        standardValue: 1250.00,
        description: 'SITO INTESTINAL (REVERSÃO DE COLOSTOMIA) - R$ 1.250,00'
      },
      {
        procedureCode: '04.07.03.002-6',
        standardValue: 900.00,
        description: 'COLECISTECTOMIA - R$ 900,00'
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
      // Hérnias
      {
        procedureCode: '04.07.04.012-9',
        standardValue: 300.00,
        description: 'HERNIA UMBILICAL - R$ 300,00'
      },
      {
        procedureCode: '04.07.04.010-2',
        standardValue: 300.00,
        description: 'HERNIA INGUINAL - R$ 300,00'
      },
      {
        procedureCode: '04.07.04.008-0',
        standardValue: 300.00,
        description: 'HERNIA VENTRAL - R$ 300,00'
      }
    ]
  },

  'JOÃO VICTOR RODRIGUES': {
    doctorName: 'JOÃO VICTOR RODRIGUES',
    rules: [
      // Cirurgias Vasculares
      {
        procedureCode: '04.06.02.056-6',
        standardValue: 1050.00,
        description: 'TRATAMENTO CIRÚRGICO DE VARIZES (BILATERAL) - R$ 1.050,00'
      },
      {
        procedureCode: '04.06.02.057-4',
        standardValue: 1000.00,
        description: 'TRATAMENTO CIRÚRGICO DE VARIZES (UNILATERAL) - R$ 1.000,00'
      },
      // Cirurgias Gastrointestinais
      {
        procedureCode: '04.07.02.010-1',
        standardValue: 1250.00,
        description: 'SITO INTESTINAL (REVERSÃO DE COLOSTOMIA) - R$ 1.250,00'
      },
      {
        procedureCode: '04.07.03.002-6',
        standardValue: 900.00,
        description: 'COLECISTECTOMIA - R$ 900,00'
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
      // Hérnias
      {
        procedureCode: '04.07.04.012-9',
        standardValue: 300.00,
        description: 'HERNIA UMBILICAL - R$ 300,00'
      },
      {
        procedureCode: '04.07.04.010-2',
        standardValue: 300.00,
        description: 'HERNIA INGUINAL - R$ 300,00'
      },
      {
        procedureCode: '04.07.04.008-0',
        standardValue: 300.00,
        description: 'HERNIA VENTRAL - R$ 300,00'
      }
    ]
  },

  'GUILHERME AUGUSTO STORER': {
    doctorName: 'GUILHERME AUGUSTO STORER',
    rules: [
      // Procedimentos individuais
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
        description: 'PLASTICA TOTAL DO PENIS (INCLUI PEYRONIE) - R$ 500,00'
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
        procedureCode: 'RESSECÇÃO_CISTOS',
        standardValue: 250.00,
        description: 'RESSECÇÃO DE CISTOS/CAUTERIZAÇÕES - R$ 250,00'
      }
    ],
    // Regras para múltiplos procedimentos específicos
    multipleRules: [
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
        description: 'NEFROLITOTOMIA + CATETER + EXTRAÇÃO CÁLCULO - R$ 1.400,00'
      },
      {
        codes: ['04.09.01.023-5', '04.09.01.014-6', '04.09.01.059-6'],
        totalValue: 1500.00,
        description: 'NEFROLITOTOMIA + EXTRAÇÃO + URETEROLITOTRIPSIA - R$ 1.500,00'
      },
      {
        codes: ['04.09.01.023-5', '04.09.01.017-0', '04.09.01.014-6', '04.09.01.059-6'],
        totalValue: 1600.00,
        description: 'NEFROLITOTOMIA + CATETER + EXTRAÇÃO + URETEROLITOTRIPSIA - R$ 1.600,00'
      },
      {
        codes: ['04.09.01.059-6', '04.09.01.017-0'],
        totalValue: 1000.00,
        description: 'URETEROLITOTRIPSIA + CATETER DUPLO J - R$ 1.000,00'
      },
      {
        codes: ['04.09.01.018-9', '04.09.01.017-0'],
        totalValue: 1100.00,
        description: 'LITOTRIPSIA + CATETER DUPLO J - R$ 1.100,00'
      },
      {
        codes: ['04.09.01.018-9', '04.09.01.014-6', '04.09.01.017-0'],
        totalValue: 1200.00,
        description: 'LITOTRIPSIA + EXTRAÇÃO + CATETER - R$ 1.200,00'
      },
      {
        codes: ['04.09.01.018-9', '04.09.01.059-6', '04.09.01.014-6', '04.09.01.017-0'],
        totalValue: 1300.00,
        description: 'LITOTRIPSIA + URETEROLITOTRIPSIA + EXTRAÇÃO + CATETER - R$ 1.300,00'
      },
      {
        codes: ['04.09.03.004-0', '04.09.01.038-3'],
        totalValue: 1200.00,
        description: 'RESSECÇÃO PRÓSTATA + RESSECÇÃO LESÃO VESICAL - R$ 1.200,00'
      },
      {
        codes: ['04.09.04.021-5', '04.09.04.019-3'],
        totalValue: 400.00,
        description: 'HIDROCELE + RESSECÇÃO BOLSA ESCROTAL - R$ 400,00'
      },
      {
        codes: ['04.09.04.021-5', '04.09.04.019-3', '04.09.04.017-7'],
        totalValue: 500.00,
        description: 'HIDROCELE + RESSECÇÃO + PLÁSTICA BOLSA - R$ 500,00'
      },
      {
        codes: ['04.09.04.013-4', '04.09.04.017-7'],
        totalValue: 550.00,
        description: 'ORQUIDOPEXIA + PLÁSTICA BOLSA ESCROTAL - R$ 550,00'
      },
      {
        codes: ['04.09.04.012-6', '04.09.04.017-7'],
        totalValue: 550.00,
        description: 'ORQUIDOPEXIA BILATERAL + PLÁSTICA BOLSA - R$ 550,00'
      },
      {
        codes: ['04.09.01.032-4', '04.09.01.057-0'],
        totalValue: 1000.00,
        description: 'PIELOPLASTIA + URETEROPLASTIA - R$ 1.000,00'
      },
      {
        codes: ['04.09.01.032-4', '04.09.01.057-0', '04.09.01.017-0'],
        totalValue: 1100.00,
        description: 'PIELOPLASTIA + URETEROPLASTIA + CATETER - R$ 1.100,00'
      }
    ]
  },

  'MAIRA RECHI CASSAPULA': {
    doctorName: 'MAIRA RECHI CASSAPULA',
    rules: [
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
        procedureCode: '04.09.06.023-2',
        standardValue: 900.00,
        description: 'SALPINGECTOMIA UNI / BILATERAL - R$ 900,00'
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
      },
      {
        procedureCode: '04.09.07.014-9',
        standardValue: 300.00,
        description: 'EXERESE DE CISTO VAGINAL - R$ 300,00'
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
        procedureCode: '04.09.06.023-2',
        standardValue: 900.00,
        description: 'SALPINGECTOMIA UNI / BILATERAL - R$ 900,00'
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
      },
      {
        procedureCode: '04.09.07.014-9',
        standardValue: 300.00,
        description: 'EXERESE DE CISTO VAGINAL - R$ 300,00'
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

  'RENE SERPA ROUEDE': {
    doctorName: 'RENE SERPA ROUEDE',
    // 🆕 REGRA DE PERCENTUAL: 65% sobre o valor total
    percentageRule: {
      percentage: 65,
      description: 'Produção Médica: 65% sobre valor total do médico'
    },
    rules: [] // Sem regras individuais, usa apenas percentual
  }
  
  // ================================================================
  // OUTROS HOSPITAIS (adicionar conforme necessário)
  // ================================================================
};

// ================================================================
// FUNÇÕES UTILITÁRIAS
// ================================================================

/**
 * 💰 CALCULAR PAGAMENTO BASEADO NAS REGRAS DO MÉDICO
 * Agora filtra apenas procedimentos com regras definidas
 */
export function calculateDoctorPayment(
  doctorName: string,
  procedures: ProcedurePaymentInfo[]
): {
  procedures: (ProcedurePaymentInfo & { calculatedPayment: number; paymentRule: string; isSpecialRule: boolean })[];
  totalPayment: number;
  appliedRule: string;
} {
  const rule = DOCTOR_PAYMENT_RULES[doctorName.toUpperCase()];
  
  if (!rule) {
    // Sem regra específica, retornar array vazio
    return {
      procedures: [],
      totalPayment: 0,
      appliedRule: 'Nenhuma regra específica'
    };
  }

  // Filtrar apenas procedimentos que estão nas regras definidas
  const allRuleCodes = [
    ...rule.rules.map(r => r.procedureCode),
    ...(rule.multipleRule?.codes || []),
    ...(rule.multipleRules?.flatMap(mr => mr.codes) || [])
  ];
  
  const filteredProcedures = procedures.filter(proc => 
    allRuleCodes.includes(proc.procedure_code)
  );

  // Se não há procedimentos com regras, retornar vazio
  if (filteredProcedures.length === 0) {
    return {
      procedures: [],
      totalPayment: 0,
      appliedRule: 'Nenhum procedimento com regra específica encontrado'
    };
  }

  const procedureCodes = filteredProcedures.map(p => p.procedure_code);
  
  // Verificar se há regras para múltiplas combinações específicas (multipleRules)
  if (rule.multipleRules && procedureCodes.length > 1) {
    // Procurar por combinação exata de códigos
    for (const multiRule of rule.multipleRules) {
      const procedureCodesSet = new Set(procedureCodes);
      
      // Verificar se todos os códigos da regra estão presentes nos procedimentos
      const hasAllCodes = multiRule.codes.every(code => procedureCodesSet.has(code));
      
      if (hasAllCodes && multiRule.codes.length === procedureCodes.length) {
        // Combinação exata encontrada
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
        return {
          ...proc,
          calculatedPayment: standardRule!.standardValue,
          paymentRule: standardRule!.description || `R$ ${standardRule!.standardValue.toFixed(2)}`,
          isSpecialRule: true
        };
      }
    });

    appliedRule = `Regra múltiplos procedimentos: ${specialProcedures.length} procedimentos = R$ ${totalSpecialValue.toFixed(2)} total`;
  } else {
    // Aplicar regras individuais
    calculatedProcedures = filteredProcedures.map(proc => {
      const standardRule = rule.rules.find(r => r.procedureCode === proc.procedure_code);
      
      return {
        ...proc,
        calculatedPayment: standardRule!.standardValue,
        paymentRule: standardRule!.description || `R$ ${standardRule!.standardValue.toFixed(2)}`,
        isSpecialRule: true
      };
    });

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
 * 🆕 CALCULAR VALOR BASEADO EM PERCENTUAL DO TOTAL
 * Para médicos que têm regra de percentual sobre o valor total
 */
export function calculatePercentagePayment(
  doctorName: string,
  totalValue: number
): {
  calculatedPayment: number;
  appliedRule: string;
  hasPercentageRule: boolean;
} {
  const rule = DOCTOR_PAYMENT_RULES[doctorName.toUpperCase()];
  
  if (!rule || !rule.percentageRule) {
    return {
      calculatedPayment: 0,
      appliedRule: 'Nenhuma regra de percentual definida',
      hasPercentageRule: false
    };
  }

  const calculatedPayment = (totalValue * rule.percentageRule.percentage) / 100;
  
  return {
    calculatedPayment,
    appliedRule: `${rule.percentageRule.description} (${rule.percentageRule.percentage}% de R$ ${totalValue.toFixed(2)} = R$ ${calculatedPayment.toFixed(2)})`,
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
  const paymentCalculation = calculateDoctorPayment(doctorName, procedures);
  const hasSpecialRules = DOCTOR_PAYMENT_RULES[doctorName.toUpperCase()];
  
  // 🆕 VERIFICAR SE HÁ REGRA DE PERCENTUAL
  const totalValueProcedures = procedures.reduce((sum, proc) => sum + proc.value_reais, 0);
  const percentageCalculation = calculatePercentagePayment(doctorName, totalValueProcedures);

  // Se não há regras específicas nem regras de percentual, não mostrar
  if (!hasSpecialRules || (paymentCalculation.procedures.length === 0 && !percentageCalculation.hasPercentageRule)) {
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

          {/* 🆕 SEÇÃO DA REGRA DE PERCENTUAL */}
          {percentageCalculation.hasPercentageRule && (
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
          {!percentageCalculation.hasPercentageRule && (
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
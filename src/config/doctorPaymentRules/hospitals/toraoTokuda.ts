/**
 * ================================================================
 * HOSPITAL TORAO TOKUDA - APUCARANA (APU)
 * ================================================================
 * Hospital: Torao Tokuda
 * Localização: Apucarana, PR
 * Médicos cadastrados: 16
 * Última atualização: 28/11/2025
 * ================================================================
 */

import type { HospitalRules } from '../types';

export const TORAO_TOKUDA_RULES: HospitalRules = {
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
        secondaryValue: 200.00,
        description: 'URETROTOMIA INTERNA - Principal: R$ 250,00 | Sequencial: R$ 200,00'
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
      // Última atualização: 27/11/2025
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
        secondaryValue: 187.50,
        tertiaryValue: 150.00,
        description: 'POSTECTOMIA - Principal: R$ 250,00 | 2º: R$ 187,50 | 3º+: R$ 150,00' 
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
        secondaryValue: 200.00,
        description: 'URETROTOMIA INTERNA - Principal: R$ 250,00 | Sequencial: R$ 200,00'
      }
    ],
    // ================================================================
    // 🔗 REGRAS DE MÚLTIPLOS PROCEDIMENTOS - DR. GUILHERME AUGUSTO STORER
    // Sistema: Valores fixos para combinações específicas
    // Total: 17 combinações cadastradas
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
        codes: ['04.09.01.018-9', '04.09.01.059-6', '04.09.01.017-0'],
        totalValue: 1200.00,
        description: 'LITOTRIPSIA (FLEXÍVEL) + URETEROLITOTRIPSIA TRANSURETEROSCÓPICA (SEMIRRÍGIDA) + INSTALAÇÃO ENDOSCÓPICA DE CATETER DUPLO J - R$ 1.200,00'
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
      // 🏥 HÉRNIAS - VALORES PRINCIPAL E SEQUENCIAL
      // Atualizado: 26/11/2025
      // ================================================================
      {
        procedureCode: '04.07.04.010-2',
        standardValue: 700.00,
        secondaryValue: 300.00,
        description: 'HERNIOPLASTIA INGUINAL / CRURAL UNILATERAL - Principal: R$ 700 | Sequencial: R$ 300'
      },
      {
        procedureCode: '04.07.04.009-9',
        standardValue: 700.00,
        secondaryValue: 300.00,
        description: 'HERNIOPLASTIA INGUINAL BILATERAL - Principal: R$ 700 | Sequencial: R$ 300'
      },
      {
        procedureCode: '04.07.04.006-4',
        standardValue: 800.00,
        secondaryValue: 300.00,
        description: 'HERNIOPLASTIA EPIGÁSTRICA - Principal: R$ 800 | Sequencial: R$ 300'
      },
      {
        procedureCode: '04.07.04.012-9',
        standardValue: 450.00,
        secondaryValue: 300.00,
        description: 'HERNIOPLASTIA UMBILICAL - Principal: R$ 450 | Sequencial: R$ 300'
      },
      {
        procedureCode: '04.07.04.008-0',
        standardValue: 600.00,
        secondaryValue: 300.00,
        description: 'HERNIOPLASTIA INCISIONAL/VENTRAL - Principal: R$ 600 | Sequencial: R$ 300'
      },
      {
        procedureCode: '04.07.04.011-0',
        standardValue: 600.00,
        description: 'HERNIOPLASTIA RECIDIVANTE - R$ 600,00'
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
      },
      
      // ================================================================
      // 🆕 PROCEDIMENTOS ADICIONAIS - CIRURGIA GERAL
      // Data: 25/11/2025
      // ================================================================
      {
        procedureCode: '04.07.02.022-5',
        standardValue: 450.00,
        description: 'EXCISÃO DE LESÃO / TUMOR ANU-RETAL - R$ 450,00'
      },
      {
        procedureCode: '04.08.06.031-0',
        standardValue: 250.00,
        description: 'RESSECÇÃO SIMPLES DE TUMOR ÓSSEO / DE PARTES MOLES - R$ 250,00'
      },
      {
        procedureCode: '04.01.02.005-3',
        standardValue: 150.00,
        description: 'EXCISÃO E SUTURA DE LESÃO NA PELE C/ PLÁSTICA EM Z OU ROTAÇÃO DE RETALHO - R$ 150,00'
      },
      {
        procedureCode: '04.07.02.021-7',
        standardValue: 450.00,
        secondaryValue: 100.00,
        description: 'ESFINCTEROTOMIA INTERNA E TRATAMENTO DE FISSURA ANAL - Principal: R$ 450 | Sequencial: R$ 100'
      },
      {
        procedureCode: '04.07.04.022-6',
        standardValue: 300.00,
        description: 'REPARACAO DE OUTRAS HERNIAS - R$ 300,00'
      },
      {
        procedureCode: '04.09.06.013-5',
        standardValue: 1000.00,
        description: 'HISTERECTOMIA TOTAL - R$ 1.000,00'
      }
    ],
    
    // ================================================================
    // 🔗 REGRAS MÚLTIPLAS - COLECISTECTOMIA + SEQUENCIAIS E HÉRNIAS
    // Sistema: Valores fixos para combinações específicas
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
    // Regras inativadas para teste com CSV HON (Cirurgia Geral)
    rules: [],
    multipleRules: []
  },

  'MAIRA RECHI CASSAPULA': {
    doctorName: 'MAIRA RECHI CASSAPULA',
    rules: [
      // GINECOLOGIA E OBSTETRÍCIA
      { procedureCode: '04.09.06.013-5', standardValue: 1000.00, description: 'HISTERECTOMIA TOTAL - R$ 1.000,00' },
      { procedureCode: '04.09.06.012-7', standardValue: 750.00, description: 'HISTERECTOMIA SUBTOTAL - R$ 750,00' },
      { procedureCode: '04.09.06.011-9', standardValue: 1200.00, description: 'HISTERECTOMIA C/ ANEXECTOMIA (UNI / BILATERAL) - R$ 1.200,00' },
      { procedureCode: '04.09.06.021-6', standardValue: 700.00, secondaryValue: 525.00, tertiaryValue: 420.00, description: 'OOFORECTOMIA / OOFOROPLASTIA - Principal: R$ 700,00 | 2º: R$ 525,00 | 3º+: R$ 420,00' },
      { procedureCode: '04.09.06.018-6', standardValue: 600.00, description: 'LAQUEADURA TUBARIA - R$ 600,00' },
      { procedureCode: '04.09.07.027-0', standardValue: 450.00, secondaryValue: 250.00, tertiaryValue: 200.00, description: 'TRATAMENTO CIRURGICO DE INCONTINÊNCIA URINÁRIA POR VIA VAGINAL - Principal: R$ 450,00 | 2º: R$ 250,00 | 3º: R$ 200,00' },
      { procedureCode: '04.09.07.006-8', standardValue: 450.00, description: 'COLPOPERINEOPLASTIA POSTERIOR - R$ 450,00' },
      { procedureCode: '04.09.07.005-0', standardValue: 600.00, secondaryValue: 450.00, description: 'COLPOPERINEOPLASTIA ANTERIOR E POSTERIOR - Principal: R$ 600,00 | 2º: R$ 450,00' },
      { procedureCode: '04.09.06.004-6', standardValue: 250.00, description: 'CURETAGEM SEMIOTICA C/ OU S/ DILATACAO DO COLO DO UTERO - R$ 250,00' },
      { procedureCode: '04.09.07.026-2', standardValue: 250.00, description: 'TRATAMENTO CIRURGICO DE HIPERTROFIA DOS PEQUENOS LABIOS (NINFOPLASTIA) - R$ 250,00' },
      { procedureCode: '04.08.06.031-0', standardValue: 250.00, description: 'RESSECÇÃO SIMPLES DE TUMOR ÓSSEO / DE PARTES MOLES - R$ 250,00' },
      { procedureCode: '04.09.07.015-7', standardValue: 250.00, description: 'EXERESE DE GLÂNDULA DE BARTHOLIN / SKENE - R$ 250,00' },
      { procedureCode: '04.09.07.019-0', standardValue: 150.00, description: 'MARSUPIALIZAÇÃO DE GLÂNDULA DE BARTOLIN - R$ 150,00' },
      { procedureCode: '04.09.07.003-3', standardValue: 300.00, secondaryValue: 225.00, description: 'COLPOCLEISE (CIRURGIA DE LE FORT) - Principal: R$ 300,00 | Sequencial: R$ 225,00' },
      { procedureCode: '04.09.06.019-4', standardValue: 550.00, description: 'MIOMECTOMIA - R$ 550,00' },
      { procedureCode: '04.09.07.014-9', standardValue: 300.00, description: 'EXERESE DE CISTO VAGINAL - R$ 300,00' },
      { procedureCode: '04.09.06.022-4', standardValue: 100.00, description: 'RESSECCAO DE VARIZES PELVICAS (ADICIONAL AO PROCEDIMENTO PRINCIPAL) - R$ 100,00' },
      { procedureCode: '04.07.04.018-8', standardValue: 300.00, description: 'LIBERAÇÃO DE ADERÊNCIAS INTESTINAIS (ADICIONAL AO PROCEDIMENTO PRINCIPAL) - R$ 300,00' },
      { procedureCode: '04.09.07.009-2', standardValue: 100.00, description: 'COLPORRAFIA NAO OBSTETRICA (ADICIONAL AO PROCEDIMENTO PRINCIPAL) - R$ 100,00' },
      { procedureCode: '04.08.06.020-4', standardValue: 100.00, description: 'REINSERÇÃO MUSCULAR (CORREÇÃO DE DIÁSTESE DE RETO ABDOMINAL - ADICIONAL DO PROCEDIMENTO PRINCIPAL) - R$ 100,00' },
      { procedureCode: '04.09.06.023-2', standardValue: 250.00, secondaryValue: 187.50, tertiaryValue: 150.00, quaternaryValue: 125.00, description: 'SALPINGECTOMIA UNI / BILATERAL - Principal: R$ 250,00 | 2º: R$ 187,50 | 3º: R$ 150,00 | 4º: R$ 125,00' },
      { procedureCode: '04.01.02.010-0', standardValue: 150.00, description: 'EXTIRPAÇÃO E SUPRESSÃO DE LESÃO DE PELE E DE TECIDO CELULAR SUBCUTÂNEO - R$ 150,00' }
    ],
    multipleRules: [
      { codes: ['04.09.06.021-6', '04.09.06.023-2'], totalValue: 900.00, description: 'OOFORECTOMIA/OOFOROPLASTIA + SALPINGECTOMIA - R$ 900,00' },
      { codes: ['04.09.07.006-8', '04.09.07.027-0'], totalValue: 800.00, description: 'COLPOPERINEOPLASTIA POSTERIOR + TRATAMENTO INCONTINÊNCIA URINÁRIA - R$ 800,00' },
      { codes: ['04.09.07.005-0', '04.09.07.027-0'], totalValue: 900.00, description: 'COLPOPERINEOPLASTIA ANTERIOR E POSTERIOR + TRATAMENTO INCONTINÊNCIA URINÁRIA - R$ 900,00' }
    ]
  },

  'DJAVANI BLUM': {
    doctorName: 'DJAVANI BLUM',
    // Mesmas regras da MAIRA RECHI CASSAPULA
    rules: [
      { procedureCode: '04.09.06.013-5', standardValue: 1000.00, description: 'HISTERECTOMIA TOTAL - R$ 1.000,00' },
      { procedureCode: '04.09.06.012-7', standardValue: 750.00, description: 'HISTERECTOMIA SUBTOTAL - R$ 750,00' },
      { procedureCode: '04.09.06.011-9', standardValue: 1200.00, description: 'HISTERECTOMIA C/ ANEXECTOMIA (UNI / BILATERAL) - R$ 1.200,00' },
      { procedureCode: '04.09.06.021-6', standardValue: 700.00, secondaryValue: 525.00, tertiaryValue: 420.00, description: 'OOFORECTOMIA / OOFOROPLASTIA - Principal: R$ 700,00 | 2º: R$ 525,00 | 3º+: R$ 420,00' },
      { procedureCode: '04.09.06.018-6', standardValue: 600.00, description: 'LAQUEADURA TUBARIA - R$ 600,00' },
      { procedureCode: '04.09.07.027-0', standardValue: 450.00, secondaryValue: 250.00, tertiaryValue: 200.00, description: 'TRATAMENTO CIRURGICO DE INCONTINÊNCIA URINÁRIA POR VIA VAGINAL - Principal: R$ 450,00 | 2º: R$ 250,00 | 3º: R$ 200,00' },
      { procedureCode: '04.09.07.006-8', standardValue: 450.00, description: 'COLPOPERINEOPLASTIA POSTERIOR - R$ 450,00' },
      { procedureCode: '04.09.07.005-0', standardValue: 600.00, secondaryValue: 450.00, description: 'COLPOPERINEOPLASTIA ANTERIOR E POSTERIOR - Principal: R$ 600,00 | 2º: R$ 450,00' },
      { procedureCode: '04.09.06.004-6', standardValue: 250.00, description: 'CURETAGEM SEMIOTICA C/ OU S/ DILATACAO DO COLO DO UTERO - R$ 250,00' },
      { procedureCode: '04.09.07.026-2', standardValue: 250.00, description: 'TRATAMENTO CIRURGICO DE HIPERTROFIA DOS PEQUENOS LABIOS (NINFOPLASTIA) - R$ 250,00' },
      { procedureCode: '04.08.06.031-0', standardValue: 250.00, description: 'RESSECÇÃO SIMPLES DE TUMOR ÓSSEO / DE PARTES MOLES - R$ 250,00' },
      { procedureCode: '04.09.07.015-7', standardValue: 250.00, description: 'EXERESE DE GLÂNDULA DE BARTHOLIN / SKENE - R$ 250,00' },
      { procedureCode: '04.09.07.019-0', standardValue: 150.00, description: 'MARSUPIALIZAÇÃO DE GLÂNDULA DE BARTOLIN - R$ 150,00' },
      { procedureCode: '04.09.07.003-3', standardValue: 300.00, secondaryValue: 225.00, description: 'COLPOCLEISE (CIRURGIA DE LE FORT) - Principal: R$ 300,00 | Sequencial: R$ 225,00' },
      { procedureCode: '04.09.06.019-4', standardValue: 550.00, description: 'MIOMECTOMIA - R$ 550,00' },
      { procedureCode: '04.09.07.014-9', standardValue: 300.00, description: 'EXERESE DE CISTO VAGINAL - R$ 300,00' },
      { procedureCode: '04.09.06.022-4', standardValue: 100.00, description: 'RESSECCAO DE VARIZES PELVICAS (ADICIONAL AO PROCEDIMENTO PRINCIPAL) - R$ 100,00' },
      { procedureCode: '04.07.04.018-8', standardValue: 300.00, description: 'LIBERAÇÃO DE ADERÊNCIAS INTESTINAIS (ADICIONAL AO PROCEDIMENTO PRINCIPAL) - R$ 300,00' },
      { procedureCode: '04.09.07.009-2', standardValue: 100.00, description: 'COLPORRAFIA NAO OBSTETRICA (ADICIONAL AO PROCEDIMENTO PRINCIPAL) - R$ 100,00' },
      { procedureCode: '04.08.06.020-4', standardValue: 100.00, description: 'REINSERÇÃO MUSCULAR (CORREÇÃO DE DIÁSTESE DE RETO ABDOMINAL - ADICIONAL DO PROCEDIMENTO PRINCIPAL) - R$ 100,00' },
      { procedureCode: '04.09.06.023-2', standardValue: 250.00, secondaryValue: 187.50, tertiaryValue: 150.00, quaternaryValue: 125.00, description: 'SALPINGECTOMIA UNI / BILATERAL - Principal: R$ 250,00 | 2º: R$ 187,50 | 3º: R$ 150,00 | 4º: R$ 125,00' },
      { procedureCode: '04.01.02.010-0', standardValue: 150.00, description: 'EXTIRPAÇÃO E SUPRESSÃO DE LESÃO DE PELE E DE TECIDO CELULAR SUBCUTÂNEO - R$ 150,00' }
    ],
    multipleRules: [
      { codes: ['04.09.06.021-6', '04.09.06.023-2'], totalValue: 900.00, description: 'OOFORECTOMIA/OOFOROPLASTIA + SALPINGECTOMIA - R$ 900,00' },
      { codes: ['04.09.07.006-8', '04.09.07.027-0'], totalValue: 800.00, description: 'COLPOPERINEOPLASTIA POSTERIOR + TRATAMENTO INCONTINÊNCIA URINÁRIA - R$ 800,00' },
      { codes: ['04.09.07.005-0', '04.09.07.027-0'], totalValue: 900.00, description: 'COLPOPERINEOPLASTIA ANTERIOR E POSTERIOR + TRATAMENTO INCONTINÊNCIA URINÁRIA - R$ 900,00' }
    ]
  },

  'JOAO ROBERTO SEIDEL DE ARAUJO': {
    doctorName: 'JOAO ROBERTO SEIDEL DE ARAUJO',
    fixedPaymentRule: {
      amount: 450.00,
      description: 'Valor padrão para procedimentos não listados: R$ 450,00'
    },
    rules: [
      { procedureCode: '04.08.05.065-9', standardValue: 400.00, description: 'TRATAMENTO CIRÚRGICO DE HALUX VALGUS COM OSTEOTOMIA - R$ 400,00' },
      { procedureCode: '04.08.05.091-8', standardValue: 400.00, description: 'TRATAMENTO CIRÚRGICO DO HALUX VALGUS S/ OSTEOTOMIA - R$ 400,00' },
      { procedureCode: '04.08.05.090-0', standardValue: 400.00, description: 'TRATAMENTO CIRÚRGICO DO HALUX RIGIDUS - R$ 400,00' }
    ]
  },

  'RENAN RODRIGUES DE LIMA GONCALVES': {
    doctorName: 'RENAN RODRIGUES DE LIMA GONCALVES',
    onlyMainProcedureRule: {
      enabled: true,
      description: 'Múltiplos procedimentos: paga apenas o procedimento principal (maior valor)',
      logic: 'Quando 2+ procedimentos forem realizados juntos, aplica-se apenas o valor do procedimento de maior valor, ignorando os demais.'
    },
    rules: [
      { procedureCode: '04.03.02.012-3', standardValue: 400.00, description: 'TRATAMENTO CIRURGICO DE SINDROME COMPRESSIVA EM TUNEL OSTEO-FIBROSO AO NIVEL DO CARPO - R$ 400,00' },
      { procedureCode: '04.08.06.044-1', standardValue: 400.00, description: 'TENÓLISE - R$ 400,00' },
      { procedureCode: '04.08.02.032-6', standardValue: 450.00, description: 'TRATAMENTO CIRÚRGICO DE DEDO EM GATILHO - R$ 450,00' },
      { procedureCode: '04.08.06.047-6', standardValue: 400.00, description: 'TENOPLASTIA OU ENXERTO DE TENDÃO UNICO - R$ 400,00' },
      { procedureCode: '04.08.06.031-0', standardValue: 250.00, description: 'RESSECÇÃO SIMPLES DE TUMOR ÓSSEO / DE PARTES MOLES - R$ 250,00' }
    ]
  },

  'RENE SERPA ROUEDE': {
    doctorName: 'RENE SERPA ROUEDE',
    rules: [
      { procedureCode: '04.08.01.021-5', standardValue: 0, description: 'TRATAMENTO CIRÚRGICO DE LUXAÇÃO RECIDIVANTE / HABITUAL DE ARTICULAÇÃO ESCAPULO-UMERAL' },
      { procedureCode: '04.08.01.014-2', standardValue: 0, description: 'REPARO DE ROTURA DO MANGUITO ROTADOR (INCLUI PROCEDIMENTOS DESCOMPRESSIVOS)' },
      { procedureCode: '04.08.06.071-9', standardValue: 0, description: 'VIDEOARTROSCOPIA' },
      { procedureCode: '04.08.06.053-0', standardValue: 0, description: 'TRANSPOSIÇÃO / TRANSFERÊNCIA MIOTENDINOSA' },
      { procedureCode: '04.08.06.046-8', standardValue: 0, description: 'TENOMIOTOMIA / DESINSERÇÃO' }
    ],
    multipleRules: [
      { codes: ['04.08.01.021-5', '04.08.06.071-9'], totalValue: 500.00, description: 'TRATAMENTO CIRÚRGICO DE LUXAÇÃO RECIDIVANTE + VIDEOARTROSCOPIA - R$ 500,00' },
      { codes: ['04.08.01.014-2', '04.08.06.071-9'], totalValue: 900.00, description: 'REPARO DE ROTURA DO MANGUITO ROTADOR + VIDEOARTROSCOPIA - R$ 900,00' },
      { codes: ['04.08.01.021-5', '04.08.06.053-0', '04.08.06.046-8'], totalValue: 500.00, description: 'TRATAMENTO LUXAÇÃO RECIDIVANTE + TRANSPOSIÇÃO MIOTENDINOSA + TENOMIOTOMIA - R$ 500,00 TOTAL' }
    ]
  },

  'GEOVANA GONZALES STORTI': {
    doctorName: 'GEOVANA GONZALES STORTI',
    rules: [
      { procedureCode: '04.06.02.057-4', standardValue: 900.00, description: 'TRATAMENTO CIRÚRGICO DE VARIZES (UNILATERAL) - R$ 900,00' },
      { procedureCode: '04.06.02.056-6', standardValue: 900.00, description: 'TRATAMENTO CIRURGICO DE VARIZES (BILATERAL) - R$ 900,00' }
    ]
  },

  'JOAO GABRIEL NOGUEIRA SCORPIONE': {
    doctorName: 'JOAO GABRIEL NOGUEIRA SCORPIONE',
    // Mesmas regras do GUILHERME AUGUSTO STORER - UROLOGIA
    rules: [
      { procedureCode: '04.09.01.023-5', standardValue: 1000.00, description: 'NEFROLITOTOMIA PERCUTÂNEA - R$ 1.000,00' },
      { procedureCode: '04.09.01.059-6', standardValue: 900.00, description: 'URETEROLITOTRIPSIA TRANSURETEROSCÓPICA (SEMIRRÍGIDA) - R$ 900,00' },
      { procedureCode: '04.09.01.018-9', standardValue: 1000.00, description: 'LITOTRIPSIA (FLEXÍVEL) - R$ 1.000,00' },
      { procedureCode: '04.09.01.017-0', standardValue: 250.00, description: 'INSTALAÇÃO ENDOSCÓPICA DE CATETER DUPLO J - R$ 250,00' },
      { procedureCode: '04.09.03.004-0', standardValue: 1000.00, description: 'RESSECÇÃO ENDOSCÓPICA DE PRÓSTATA - R$ 1.000,00' },
      { procedureCode: '04.09.03.002-3', standardValue: 1000.00, description: 'PROSTATECTOMIA SUPRAPÚBICA - R$ 1.000,00' },
      { procedureCode: '04.09.04.021-5', standardValue: 300.00, description: 'TRATAMENTO CIRÚRGICO DE HIDROCELE - R$ 300,00' },
      { procedureCode: '04.09.05.008-3', standardValue: 250.00, secondaryValue: 187.50, tertiaryValue: 150.00, description: 'POSTECTOMIA - Principal: R$ 250,00 | 2º: R$ 187,50 | 3º+: R$ 150,00' },
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
      { procedureCode: '04.09.02.017-6', standardValue: 250.00, secondaryValue: 200.00, description: 'URETROTOMIA INTERNA - Principal: R$ 250,00 | Sequencial: R$ 200,00' }
    ],
    multipleRules: [
      { codes: ['04.09.01.023-5', '04.09.01.017-0'], totalValue: 1100.00, description: 'NEFROLITOTOMIA PERCUTÂNEA + INSTALAÇÃO ENDOSCÓPICA DE CATETER DUPLO J - R$ 1.100,00' },
      { codes: ['04.09.01.059-6', '04.09.01.017-0'], totalValue: 1000.00, description: 'URETEROLITOTRIPSIA TRANSURETEROSCÓPICA + INSTALAÇÃO ENDOSCÓPICA DE CATETER DUPLO J (SEMIRRÍGIDA) - R$ 1.000,00' },
      { codes: ['04.09.01.018-9', '04.09.01.017-0'], totalValue: 1100.00, description: 'LITOTRIPSIA (FLEXÍVEL) + INSTALAÇÃO ENDOSCÓPICA DE CATETER DUPLO J - R$ 1.100,00' },
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
    rules: [
      { procedureCode: '04.08.04.009-2', standardValue: 2500.00, description: 'ARTROPLASTIA TOTAL PRIMARIA DO QUADRIL NÃO CIMENTADA / HÍBRIDA - R$ 2.500,00' }
    ]
  },

  'LAERCIO MARCOS SIOLARI TURCATO': {
    doctorName: 'LAERCIO MARCOS SIOLARI TURCATO',
    rules: [
      { procedureCode: '04.08.04.009-2', standardValue: 2500.00, description: 'ARTROPLASTIA TOTAL PRIMARIA DO QUADRIL NÃO CIMENTADA / HÍBRIDA - R$ 2.500,00' }
    ]
  },

  'MATEUS HRESCAK': {
    doctorName: 'MATEUS HRESCAK',
    rules: [
      { procedureCode: '04.08.05.089-6', standardValue: 750.00, secondaryValue: 300.00, description: 'TRATAMENTO CIRÚRGICO DE ROTURA DO MENISCO COM MENISCECTOMIA PARCIAL / TOTAL - Principal: R$ 750,00 | Sequencial: R$ 300,00' },
      { procedureCode: '04.08.05.088-8', standardValue: 750.00, description: 'TRATAMENTO CIRÚRGICO DE ROTURA DE MENISCO COM SUTURA MENISCAL UNI / BICOMPATIMENTAL - R$ 750,00' },
      { procedureCode: '04.08.05.016-0', standardValue: 900.00, description: 'RECONSTRUÇÃO LIGAMENTAR INTRA-ARTICULAR DO JOELHO (CRUZADO ANTERIOR) - R$ 900,00' },
      { procedureCode: '04.08.05.015-2', standardValue: 500.00, description: 'RECONSTRUÇÃO LIGAMENTAR EXTRA-ARTICULAR DO JOELHO - R$ 500,00' },
      { procedureCode: '04.08.05.006-3', standardValue: 2000.00, description: 'ARTROPLASTIA TOTAL PRIMÁRIA DO JOELHO - R$ 2.000,00' }
    ]
  },

  'BRUNO BOSIO DA SILVA': {
    doctorName: 'BRUNO BOSIO DA SILVA',
    rules: [
      { procedureCode: '04.08.01.014-2', standardValue: 0, description: 'REPARO DE ROTURA DO MANGUITO ROTADOR (INCLUI PROCEDIMENTOS DESCOMPRESSIVOS)' },
      { procedureCode: '04.08.06.071-9', standardValue: 0, description: 'VIDEOARTROSCOPIA' },
      { procedureCode: '04.08.01.021-5', standardValue: 0, description: 'TRATAMENTO CIRÚRGICO DE LUXAÇÃO RECIDIVANTE / HABITUAL DE ARTICULAÇÃO ESCAPULO-UMERAL' },
      { procedureCode: '04.08.06.053-0', standardValue: 0, description: 'TRANSPOSIÇÃO / TRANSFERÊNCIA MIOTENDINOSA' },
      { procedureCode: '04.08.06.046-8', standardValue: 0, description: 'TENOMIOTOMIA / DESINSERÇÃO' }
    ],
    multipleRules: [
      { codes: ['04.08.01.014-2', '04.08.06.071-9'], totalValue: 900.00, description: 'REPARO MANGUITO ROTADOR + VIDEOARTROSCOPIA - R$ 900,00 TOTAL' },
      { codes: ['04.08.01.021-5', '04.08.06.053-0', '04.08.06.046-8'], totalValue: 500.00, description: 'TRATAMENTO LUXAÇÃO RECIDIVANTE + TRANSPOSIÇÃO MIOTENDINOSA + TENOMIOTOMIA - R$ 500,00 TOTAL' }
    ]
  }
};


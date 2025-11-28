/**
 * ================================================================
 * HOSPITAL MUNICIPAL SÃO JOSÉ - CARLÓPOLIS
 * ================================================================
 * Hospital ID: 792a0316-92b4-4504-8238-491d284099a3
 * Programa: Opera Paraná
 * Total de Médicos: 9
 * Última Atualização: 28/11/2025
 * ================================================================
 */

import type { HospitalRules } from '../types';

export const HOSPITAL_SAO_JOSE_RULES: HospitalRules = {
  // ================================================================
  // 1. THIAGO TIESSI SUZUKI - UROLOGIA
  // Baseado em: Dr. GUILHERME AUGUSTO STORER (Torao Tokuda)
  // Última atualização: 27/11/2025
  // ================================================================
  'THIAGO TIESSI SUZUKI': {
    doctorName: 'THIAGO TIESSI SUZUKI',
    rules: [
      {
        procedureCode: '04.09.01.023-5',
        standardValue: 1000.00,
        description: 'NEFROLITOTOMIA PERCUTÂNEA - R$ 1.000,00'
      },
      {
        procedureCode: '04.09.01.059-6',
        standardValue: 900.00,
        secondaryValue: 200.00,
        description: 'URETEROLITOTRIPSIA TRANSURETEROSC. - Principal: R$ 900 | Seq: R$ 200'
      },
      {
        procedureCode: '04.09.01.018-9',
        standardValue: 1000.00,
        secondaryValue: 200.00,
        description: 'LITOTRIPSIA (FLEXÍVEL) - Principal: R$ 1.000 | Secundário: R$ 200'
      },
      {
        procedureCode: '04.09.01.017-0',
        standardValue: 250.00,
        secondaryValue: 100.00,
        description: 'INSTALAÇÃO ENDOSCÓPICA CATETER DUPLO J - Principal: R$ 250 | Seq: R$ 100'
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
        secondaryValue: 225.00,
        description: 'TRATAMENTO CIRÚRGICO DE HIDROCELE - Principal: R$ 300 | Seq: R$ 225'
      },
      {
        procedureCode: '04.09.05.008-3',
        standardValue: 250.00,
        secondaryValue: 187.50,
        tertiaryValue: 150.00,
        description: 'POSTECTOMIA - Principal: R$ 250 | 2º: R$ 187,50 | 3º+: R$ 150'
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
        secondaryValue: 375.00,
        description: 'CISTOLITOTOMIA/RETIRADA CORPO ESTRANHO BEXIGA - Principal: R$ 600 | Seq: R$ 375'
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
        secondaryValue: 200.00,
        description: 'PIELOPLASTIA - Principal: R$ 700 | Secundário: R$ 200'
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
        description: 'URETROTOMIA INTERNA - Principal: R$ 250 | Sequencial: R$ 200'
      },
      {
        procedureCode: '04.09.04.023-1',
        standardValue: 250.00,
        description: 'TRATAMENTO CIRÚRGICO DE VARICOCELE - R$ 250,00'
      },
      {
        procedureCode: '04.09.07.025-4',
        standardValue: 800.00,
        secondaryValue: 400.00,
        description: 'TRATAMENTO CIRÚRGICO FÍSTULA VESICO-VAGINAL - Principal: R$ 800 | Seq: R$ 400'
      },
      {
        procedureCode: '04.09.02.007-9',
        standardValue: 250.00,
        secondaryValue: 200.00,
        description: 'MEATOTOMIA SIMPLES - Principal: R$ 250 | Sequencial: R$ 200'
      },
      {
        procedureCode: '04.09.01.038-3',
        standardValue: 200.00,
        description: 'RESSECÇÃO ENDOSCÓPICA DE LESÃO VESICAL - R$ 200,00'
      },
      {
        procedureCode: '04.01.02.005-3',
        standardValue: 150.00,
        description: 'EXCISÃO E SUTURA LESÃO PELE C/ PLÁSTICA Z/ROTAÇÃO - R$ 150,00'
      },
      {
        procedureCode: '04.09.01.009-0',
        standardValue: 250.00,
        description: 'CISTOSTOMIA - R$ 250,00'
      }
    ],
    multipleRules: [
      {
        codes: ['04.09.01.023-5', '04.09.01.017-0'],
        totalValue: 1100.00,
        description: 'NEFROLITOTOMIA PERCUTÂNEA + CATETER DUPLO J - R$ 1.100,00'
      },
      {
        codes: ['04.09.01.023-5', '04.09.01.014-6'],
        totalValue: 1300.00,
        description: 'NEFROLITOTOMIA PERCUTÂNEA + EXTRAÇÃO CÁLCULO PELVE RENAL - R$ 1.300,00'
      },
      {
        codes: ['04.09.01.023-5', '04.09.01.017-0', '04.09.01.014-6'],
        totalValue: 1400.00,
        description: 'NEFROLITOTOMIA + CATETER J + EXTRAÇÃO CÁLCULO - R$ 1.400,00'
      },
      {
        codes: ['04.09.01.023-5', '04.09.01.014-6', '04.09.01.059-6'],
        totalValue: 1500.00,
        description: 'NEFROLITOTOMIA + EXTRAÇÃO CÁLCULO + URETEROLITOTRIPSIA - R$ 1.500,00'
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
        description: 'LITOTRIPSIA (FLEXÍVEL) + CATETER DUPLO J - R$ 1.100,00'
      },
      {
        codes: ['04.09.01.018-9', '04.09.01.059-6', '04.09.01.017-0'],
        totalValue: 1200.00,
        description: 'LITOTRIPSIA + URETEROLITOTRIPSIA + CATETER DUPLO J - R$ 1.200,00'
      },
      {
        codes: ['04.09.01.018-9', '04.09.01.014-6', '04.09.01.017-0'],
        totalValue: 1200.00,
        description: 'LITOTRIPSIA + EXTRAÇÃO CÁLCULO + CATETER - R$ 1.200,00'
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
        description: 'HIDROCELE + RESSECÇÃO PARCIAL BOLSA ESCROTAL - R$ 400,00'
      },
      {
        codes: ['04.09.04.021-5', '04.09.04.019-3', '04.09.04.017-7'],
        totalValue: 500.00,
        description: 'HIDROCELE + RESSECÇÃO BOLSA + PLÁSTICA BOLSA ESCROTAL - R$ 500,00'
      },
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
      {
        codes: ['04.09.01.032-4', '04.09.01.057-0'],
        totalValue: 1000.00,
        description: 'PIELOPLASTIA + URETEROPLASTIA - R$ 1.000,00'
      },
      {
        codes: ['04.09.01.032-4', '04.09.01.057-0', '04.09.01.017-0'],
        totalValue: 1100.00,
        description: 'PIELOPLASTIA + URETEROPLASTIA + CATETER DUPLO J - R$ 1.100,00'
      }
    ]
  },

  // ================================================================
  // 2. SUELLEN FERNANDA BAGATIM - OTORRINOLARINGOLOGIA
  // Data: 18/11/2025
  // ================================================================
  'SUELLEN FERNANDA BAGATIM': {
    doctorName: 'SUELLEN FERNANDA BAGATIM',
    rules: [
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
    multipleRule: {
      codes: ['04.04.01.048-2', '04.04.01.041-5'],
      totalValue: 700.00,
      description: 'SEPTOPLASTIA + TURBINECTOMIA - R$ 700,00 TOTAL (não soma)'
    }
  },

  // ================================================================
  // 3. VITOR BRANDANI GARBELINI - UROLOGIA
  // Baseado em: Dr. GUILHERME AUGUSTO STORER / HELIO SHINDY KISSINA
  // Última atualização: 27/11/2025
  // ================================================================
  'VITOR BRANDANI GARBELINI': {
    doctorName: 'VITOR BRANDANI GARBELINI',
    rules: [
      {
        procedureCode: '04.09.01.023-5',
        standardValue: 1000.00,
        description: 'NEFROLITOTOMIA PERCUTÂNEA - R$ 1.000,00'
      },
      {
        procedureCode: '04.09.01.059-6',
        standardValue: 900.00,
        secondaryValue: 200.00,
        description: 'URETEROLITOTRIPSIA TRANSURETEROSC. - Principal: R$ 900 | Seq: R$ 200'
      },
      {
        procedureCode: '04.09.01.018-9',
        standardValue: 1000.00,
        secondaryValue: 200.00,
        description: 'LITOTRIPSIA (FLEXÍVEL) - Principal: R$ 1.000 | Secundário: R$ 200'
      },
      {
        procedureCode: '04.09.01.017-0',
        standardValue: 250.00,
        secondaryValue: 100.00,
        description: 'INSTALAÇÃO ENDOSCÓPICA CATETER DUPLO J - Principal: R$ 250 | Seq: R$ 100'
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
        secondaryValue: 225.00,
        description: 'TRATAMENTO CIRÚRGICO DE HIDROCELE - Principal: R$ 300 | Seq: R$ 225'
      },
      {
        procedureCode: '04.09.05.008-3',
        standardValue: 250.00,
        secondaryValue: 187.50,
        tertiaryValue: 150.00,
        description: 'POSTECTOMIA - Principal: R$ 250 | 2º: R$ 187,50 | 3º+: R$ 150'
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
        secondaryValue: 375.00,
        description: 'CISTOLITOTOMIA/RETIRADA CORPO ESTRANHO BEXIGA - Principal: R$ 600 | Seq: R$ 375'
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
        secondaryValue: 200.00,
        description: 'PIELOPLASTIA - Principal: R$ 700 | Secundário: R$ 200'
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
        description: 'URETROTOMIA INTERNA - Principal: R$ 250 | Sequencial: R$ 200'
      },
      {
        procedureCode: '04.09.07.025-4',
        standardValue: 800.00,
        secondaryValue: 400.00,
        description: 'TRATAMENTO CIRÚRGICO FÍSTULA VESICO-VAGINAL - Principal: R$ 800 | Seq: R$ 400'
      },
      {
        procedureCode: '04.09.02.007-9',
        standardValue: 250.00,
        secondaryValue: 200.00,
        description: 'MEATOTOMIA SIMPLES - Principal: R$ 250 | Sequencial: R$ 200'
      },
      {
        procedureCode: '04.09.01.038-3',
        standardValue: 200.00,
        description: 'RESSECÇÃO ENDOSCÓPICA DE LESÃO VESICAL - R$ 200,00'
      },
      {
        procedureCode: '04.01.02.005-3',
        standardValue: 150.00,
        description: 'EXCISÃO E SUTURA LESÃO PELE C/ PLÁSTICA Z/ROTAÇÃO - R$ 150,00'
      },
      {
        procedureCode: '04.09.01.009-0',
        standardValue: 250.00,
        description: 'CISTOSTOMIA - R$ 250,00'
      }
    ],
    multipleRules: [
      {
        codes: ['04.09.01.023-5', '04.09.01.017-0'],
        totalValue: 1100.00,
        description: 'NEFROLITOTOMIA PERCUTÂNEA + CATETER DUPLO J - R$ 1.100,00'
      },
      {
        codes: ['04.09.01.023-5', '04.09.01.014-6'],
        totalValue: 1300.00,
        description: 'NEFROLITOTOMIA PERCUTÂNEA + EXTRAÇÃO CÁLCULO - R$ 1.300,00'
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
        description: 'LITOTRIPSIA (FLEXÍVEL) + CATETER DUPLO J - R$ 1.100,00'
      },
      {
        codes: ['04.09.01.018-9', '04.09.01.059-6', '04.09.01.017-0'],
        totalValue: 1200.00,
        description: 'LITOTRIPSIA + URETEROLITOTRIPSIA + CATETER - R$ 1.200,00'
      },
      {
        codes: ['04.09.01.018-9', '04.09.01.014-6', '04.09.01.017-0'],
        totalValue: 1200.00,
        description: 'LITOTRIPSIA + EXTRAÇÃO CÁLCULO + CATETER - R$ 1.200,00'
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
        description: 'HIDROCELE + RESSECÇÃO PARCIAL BOLSA ESCROTAL - R$ 400,00'
      },
      {
        codes: ['04.09.04.021-5', '04.09.04.019-3', '04.09.04.017-7'],
        totalValue: 500.00,
        description: 'HIDROCELE + RESSECÇÃO BOLSA + PLÁSTICA BOLSA ESCROTAL - R$ 500,00'
      },
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
      {
        codes: ['04.09.01.032-4', '04.09.01.057-0'],
        totalValue: 1000.00,
        description: 'PIELOPLASTIA + URETEROPLASTIA - R$ 1.000,00'
      },
      {
        codes: ['04.09.01.032-4', '04.09.01.057-0', '04.09.01.017-0'],
        totalValue: 1100.00,
        description: 'PIELOPLASTIA + URETEROPLASTIA + CATETER DUPLO J - R$ 1.100,00'
      }
    ]
  },

  // ================================================================
  // 4. PEDRO HENRIQUE RODRIGUES - CIRURGIA VASCULAR
  // Baseado em: Hospital 18 de Dezembro
  // Data: 18/11/2025
  // ================================================================
  'PEDRO HENRIQUE RODRIGUES': {
    doctorName: 'PEDRO HENRIQUE RODRIGUES',
    rules: [
      {
        procedureCode: '04.06.02.057-4',
        standardValue: 900.00,
        description: 'TRATAMENTO CIRÚRGICO DE VARIZES (UNILATERAL) - R$ 900,00'
      },
      {
        procedureCode: '04.06.02.056-6',
        standardValue: 900.00,
        description: 'TRATAMENTO CIRÚRGICO DE VARIZES (BILATERAL) - R$ 900,00'
      },
      {
        procedureCode: '04.06.02.059-0',
        standardValue: 0,
        description: 'TROMBECTOMIA DO SISTEMA VENOSO (valor em regra múltipla)'
      }
    ],
    multipleRules: [
      {
        codes: ['04.06.02.057-4', '04.06.02.059-0'],
        totalValue: 1100.00,
        description: 'VARIZES UNILATERAL + TROMBECTOMIA - R$ 1.100,00'
      },
      {
        codes: ['04.06.02.056-6', '04.06.02.059-0'],
        totalValue: 1100.00,
        description: 'VARIZES BILATERAL + TROMBECTOMIA - R$ 1.100,00'
      }
    ]
  },

  // ================================================================
  // 5. BRUNO BOSIO DA SILVA
  // Valor Fixo Mensal: R$ 40.000,00
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
  // 6. ORLANDO PAPI FERNANDES
  // Valor Fixo Mensal: R$ 60.000,00
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
  // 7. FERNANDO MERHI MANSUR
  // Valor Fixo Mensal: R$ 29.400,00
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
  // 8. BRUNO COLANZI DE MEDEIROS
  // Valor Fixo Mensal: R$ 75.000,00
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
  // 9. MARIA EDUARDA CAETANO CLARO
  // Valor Fixo Mensal: R$ 15.000,00
  // ================================================================
  'MARIA EDUARDA CAETANO CLARO': {
    doctorName: 'MARIA EDUARDA CAETANO CLARO',
    fixedPaymentRule: {
      amount: 15000.00,
      description: 'PAGAMENTO FIXO MENSAL - R$ 15.000,00 (independente de procedimentos)'
    },
    rules: []
  }
};


/**
 * ================================================================
 * HOSPITAL MUNICIPAL SANTA ALICE (CASCAVEL - CAS)
 * ================================================================
 * Hospital ID: 1d8ca73a-1927-462e-91c0-fa7004d0b377
 * Programa: Opera Paraná
 * Total de Médicos: 3
 * Última Atualização: 28/11/2025
 * ================================================================
 */

import type { HospitalRules } from '../types';

export const HOSPITAL_SANTA_ALICE_RULES: HospitalRules = {
  // ================================================================
  // 1. JULIO DE CASTRO NETO - ORTOPEDIA
  // Especialidade: Cirurgia de Joelho
  // Última atualização: 25/11/2025
  // ================================================================
  'JULIO DE CASTRO NETO': {
    doctorName: 'JULIO DE CASTRO NETO',
    rules: [
      {
        procedureCode: '04.08.05.089-6',
        standardValue: 750.00,
        secondaryValue: 300.00,
        description: 'TRATAMENTO CIRÚRGICO ROTURA MENISCO C/ MENISCECTOMIA - Principal: R$ 750 | Seq: R$ 300'
      },
      {
        procedureCode: '04.08.05.088-8',
        standardValue: 750.00,
        description: 'TRATAMENTO CIRÚRGICO ROTURA MENISCO C/ SUTURA MENISCAL UNI/BICOMPATIMENTAL - R$ 750,00'
      },
      {
        procedureCode: '04.08.05.016-0',
        standardValue: 900.00,
        description: 'RECONSTRUÇÃO LIGAMENTAR INTRA-ARTICULAR JOELHO (CRUZADO ANTERIOR) - R$ 900,00'
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
  // 2. PEDRO HENRIQUE RODRIGUES - CIRURGIA VASCULAR
  // Especialidade: Varizes e Trombectomia
  // Última atualização: 27/11/2025
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
        standardValue: 0, // Valor definido na regra múltipla
        description: 'TROMBECTOMIA DO SISTEMA VENOSO'
      }
    ],
    multipleRules: [
      {
        codes: ['04.06.02.057-4', '04.06.02.059-0'],
        totalValue: 1100.00,
        description: 'VARIZES (UNILATERAL) + TROMBECTOMIA - R$ 1.100,00'
      },
      {
        codes: ['04.06.02.056-6', '04.06.02.059-0'],
        totalValue: 1100.00,
        description: 'VARIZES (BILATERAL) + TROMBECTOMIA - R$ 1.100,00'
      }
    ]
  },

  // ================================================================
  // 3. LUIZ FRANCISCONI NETO - OTORRINOLARINGOLOGIA
  // Baseado em: Dr. HUMBERTO MOREIRA DA SILVA (Torao Tokuda)
  // Data: 27/11/2025
  // ================================================================
  'LUIZ FRANCISCONI NETO': {
    doctorName: 'LUIZ FRANCISCONI NETO',
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
    multipleRule: {
      codes: ['04.04.01.048-2', '04.04.01.041-5', '04.04.01.002-4', '04.04.01.001-6', '04.04.01.003-2'],
      totalValue: 800.00,
      description: 'DOIS OU MAIS PROCEDIMENTOS ORL - R$ 800,00 TOTAL (não soma)'
    }
  }
};


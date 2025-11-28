/**
 * ================================================================
 * HOSPITAL MUNICIPAL JUAREZ BARRETO DE MACEDO
 * ================================================================
 * Hospital ID: 019c7380-459d-4aa5-bbd8-2dba4f361e7e
 * Programa: Opera Paraná
 * Total de Médicos: 2
 * Última Atualização: 28/11/2025
 * ================================================================
 */

import type { HospitalRules } from '../types';

export const HOSPITAL_JUAREZ_BARRETO_RULES: HospitalRules = {
  // ================================================================
  // 1. HUMBERTO MOREIRA DA SILVA - OTORRINOLARINGOLOGIA
  // Baseado em: Dr. HUMBERTO MOREIRA DA SILVA (Torao Tokuda)
  // Data: 18/11/2025
  // ================================================================
  'HUMBERTO MOREIRA DA SILVA': {
    doctorName: 'HUMBERTO MOREIRA DA SILVA',
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
  },

  // ================================================================
  // 2. JULIO DE CASTRO NETO - ORTOPEDIA
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
  }
};


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


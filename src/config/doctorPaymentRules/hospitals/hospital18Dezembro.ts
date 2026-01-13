/**
 * ================================================================
 * HOSPITAL MUNICIPAL 18 DE DEZEMBRO - ARAPOTI (ARA)
 * ================================================================
 * Hospital ID: (compatibilidade)
 * Programa: Opera Paraná
 * Total de Médicos: 9
 * Última Atualização: 28/11/2025
 * ================================================================
 */

import type { HospitalRules } from '../types';

export const HOSPITAL_18_DEZEMBRO_RULES: HospitalRules = {
  // ================================================================
  // 1. THADEU TIESSI SUZUKI
  // Valor Fixo Mensal: R$ 47.000,00
  // ================================================================
  'THADEU TIESSI SUZUKI': {
    doctorName: 'THADEU TIESSI SUZUKI',
    fixedPaymentRule: {
      amount: 47000.00,
      description: 'Valor fixo mensal: R$ 47.000,00 independente da quantidade de procedimentos'
    },
    rules: []
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
        standardValue: 0,
        description: 'TROMBECTOMIA DO SISTEMA VENOSO (Valor em regra múltipla)'
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
  // 3. JOAO VICTOR RODRIGUES - CIRURGIA GERAL
  // Especialidade: Colecistectomia, Hérnias, Procedimentos Orificiais
  // Última atualização: 26/11/2025
  // ================================================================
  'JOAO VICTOR RODRIGUES': {
    doctorName: 'JOAO VICTOR RODRIGUES',
    rules: [
      // COLECISTECTOMIA BASE
      {
        procedureCode: '04.07.03.002-6',
        standardValue: 900.00,
        description: 'COLECISTECTOMIA (PRINCIPAL) - R$ 900,00'
      },
      
      // PROCEDIMENTOS SEQUENCIAIS (somam à colecistectomia)
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
      
      // HÉRNIAS (valores principal e sequencial)
      {
        procedureCode: '04.07.04.010-2',
        standardValue: 700.00,
        secondaryValue: 300.00,
        description: 'HERNIOPLASTIA INGUINAL/CRURAL UNILATERAL - Principal: R$ 700 | Seq: R$ 300'
      },
      {
        procedureCode: '04.07.04.009-9',
        standardValue: 700.00,
        secondaryValue: 300.00,
        description: 'HERNIOPLASTIA INGUINAL BILATERAL - Principal: R$ 700 | Seq: R$ 300'
      },
      {
        procedureCode: '04.07.04.006-4',
        standardValue: 800.00,
        secondaryValue: 300.00,
        description: 'HERNIOPLASTIA EPIGÁSTRICA - Principal: R$ 800 | Seq: R$ 300'
      },
      {
        procedureCode: '04.07.04.012-9',
        standardValue: 450.00,
        secondaryValue: 300.00,
        description: 'HERNIOPLASTIA UMBILICAL - Principal: R$ 450 | Seq: R$ 300'
      },
      {
        procedureCode: '04.07.04.008-0',
        standardValue: 600.00,
        secondaryValue: 300.00,
        description: 'HERNIOPLASTIA INCISIONAL/VENTRAL - Principal: R$ 600 | Seq: R$ 300'
      },
      {
        procedureCode: '04.07.04.011-0',
        standardValue: 600.00,
        description: 'HERNIOPLASTIA RECIDIVANTE - R$ 600,00'
      },
      
      // PROCEDIMENTOS ORIFICIAIS
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
      
      // CISTOS E LIPOMAS
      {
        procedureCode: '04.01.02.007-0',
        standardValue: 250.00,
        description: 'EXÉRESE DE CISTO DERMOIDE - R$ 250,00'
      },
      {
        procedureCode: '04.01.02.010-0',
        standardValue: 250.00,
        description: 'EXTIRPAÇÃO E SUPRESSÃO DE LESÃO DE PELE E TECIDO SUBCUTÂNEO - R$ 250,00'
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
      
      // PROCEDIMENTOS ADICIONAIS
      {
        procedureCode: '04.07.02.022-5',
        standardValue: 450.00,
        description: 'EXCISÃO DE LESÃO/TUMOR ANU-RETAL - R$ 450,00'
      },
      {
        procedureCode: '04.08.06.031-0',
        standardValue: 250.00,
        description: 'RESSECÇÃO SIMPLES DE TUMOR ÓSSEO/PARTES MOLES - R$ 250,00'
      },
      {
        procedureCode: '04.01.02.005-3',
        standardValue: 150.00,
        description: 'EXCISÃO E SUTURA DE LESÃO NA PELE C/ PLÁSTICA EM Z OU ROTAÇÃO - R$ 150,00'
      },
      {
        procedureCode: '04.07.02.021-7',
        standardValue: 450.00,
        secondaryValue: 100.00,
        description: 'ESFINCTEROTOMIA INTERNA E TRAT. FISSURA ANAL - Principal: R$ 450 | Seq: R$ 100'
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
    
    multipleRules: [
      // COLECISTECTOMIA + 1 SEQUENCIAL
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
      
      // COLECISTECTOMIA + HÉRNIAS
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
      
      // COLECISTECTOMIA + 2 SEQUENCIAIS
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
      
      // COLECISTECTOMIA + 3 SEQUENCIAIS
      {
        codes: ['04.07.03.002-6', '04.07.04.018-8', '04.07.03.014-0', '04.07.04.002-1'],
        totalValue: 1800.00,
        description: 'COLECISTECTOMIA + LIBERAÇÃO + HEPATORRAFIA + DRENAGEM - R$ 1.800,00'
      },
      
      // COLECISTECTOMIA + 4 SEQUENCIAIS (MÁXIMO)
      {
        codes: ['04.07.03.002-6', '04.07.04.018-8', '04.07.03.014-0', '04.07.04.002-1', '04.07.03.006-9'],
        totalValue: 2050.00,
        description: 'COLECISTECTOMIA + 4 SEQUENCIAIS (MÁXIMO) - R$ 2.050,00'
      },
      
      // MÚLTIPLAS HÉRNIAS (1ª = valor original, 2ª+ = R$ 300)
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
      
      // COMBINAÇÕES DE 3 HÉRNIAS
      {
        codes: ['04.07.04.006-4', '04.07.04.010-2', '04.07.04.012-9'],
        totalValue: 1400.00,
        description: 'EPIGÁSTRICA (1ª) + INGUINAL UNI (2ª) + UMBILICAL (3ª) - R$ 1.400,00'
      },
      {
        codes: ['04.07.04.006-4', '04.07.04.009-9', '04.07.04.012-9'],
        totalValue: 1400.00,
        description: 'EPIGÁSTRICA (1ª) + INGUINAL BI (2ª) + UMBILICAL (3ª) - R$ 1.400,00'
      },
      {
        codes: ['04.07.04.010-2', '04.07.04.012-9', '04.07.04.008-0'],
        totalValue: 1300.00,
        description: 'INGUINAL UNI (1ª) + UMBILICAL (2ª) + INCISIONAL (3ª) - R$ 1.300,00'
      },
      
      // COMBINAÇÕES DE 4 HÉRNIAS
      {
        codes: ['04.07.04.006-4', '04.07.04.010-2', '04.07.04.012-9', '04.07.04.008-0'],
        totalValue: 1700.00,
        description: 'EPIGÁSTRICA + INGUINAL UNI + UMBILICAL + INCISIONAL - R$ 1.700,00'
      }
    ]
  },

  // ================================================================
  // 4. ISAAC TAVARES DA SILVA
  // Valor Fixo Mensal: R$ 35.000,00
  // ================================================================
  'ISAAC TAVARES DA SILVA': {
    doctorName: 'ISAAC TAVARES DA SILVA',
    fixedPaymentRule: {
      amount: 35000.00,
      description: 'Valor fixo mensal: R$ 35.000,00 independente da quantidade de procedimentos'
    },
    rules: []
  },

  // ================================================================
  // 5. ELTON CARVALHO
  // Valor Fixo Mensal: R$ 35.000,00
  // ================================================================
  'ELTON CARVALHO': {
    doctorName: 'ELTON CARVALHO',
    fixedPaymentRule: {
      amount: 35000.00,
      description: 'Valor fixo mensal: R$ 35.000,00 independente da quantidade de procedimentos'
    },
    rules: []
  },

  // ================================================================
  // 6. LUIZ GUSTAVO SILVA GODOI
  // Valor Fixo Mensal: R$ 35.000,00
  // ================================================================
  'LUIZ GUSTAVO SILVA GODOI': {
    doctorName: 'LUIZ GUSTAVO SILVA GODOI',
    fixedPaymentRule: {
      amount: 35000.00,
      description: 'Valor fixo mensal: R$ 35.000,00 independente da quantidade de procedimentos'
    },
    rules: []
  },

  // ================================================================
  // 7. BRUNO COLANZI DE MEDEIROS - GINECOLOGIA
  // Última atualização: 25/11/2025
  // ================================================================
  'BRUNO COLANZI DE MEDEIROS': {
    doctorName: 'BRUNO COLANZI DE MEDEIROS',
    rules: [
      // HISTERECTOMIAS
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
        description: 'HISTERECTOMIA C/ ANEXECTOMIA (UNI/BILATERAL) - R$ 1.000,00'
      },
      
      // CIRURGIAS OVARIANAS E TUBÁRIAS
      {
        procedureCode: '04.09.06.021-6',
        standardValue: 700.00,
        secondaryValue: 525.00,
        description: 'OOFORECTOMIA/OOFOROPLASTIA - Principal: R$ 700 | Seq: R$ 525'
      },
      {
        procedureCode: '04.09.06.023-2',
        standardValue: 250.00,
        secondaryValue: 187.50,
        description: 'SALPINGECTOMIA UNI/BILATERAL - Principal: R$ 250 | Seq: R$ 187,50'
      },
      {
        procedureCode: '04.09.06.018-6',
        standardValue: 500.00,
        description: 'LAQUEADURA TUBARIA - R$ 500,00'
      },
      
      // CIRURGIAS VAGINAIS E INCONTINÊNCIA
      {
        procedureCode: '04.09.07.027-0',
        standardValue: 350.00,
        description: 'TRATAMENTO CIRÚRGICO DE INCONTINÊNCIA URINÁRIA VIA VAGINAL - R$ 350,00'
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
      
      // PROCEDIMENTOS MENORES E DIAGNÓSTICOS
      {
        procedureCode: '04.09.06.004-6',
        standardValue: 200.00,
        description: 'CURETAGEM SEMIÓTICA C/ OU S/ DILATAÇÃO DO COLO ÚTERO - R$ 200,00'
      },
      {
        procedureCode: '04.09.07.026-2',
        standardValue: 200.00,
        description: 'TRATAMENTO CIRÚRGICO DE HIPERTROFIA PEQUENOS LÁBIOS - R$ 200,00'
      },
      {
        procedureCode: '04.08.06.031-0',
        standardValue: 200.00,
        description: 'RESSECÇÃO SIMPLES TUMOR ÓSSEO/PARTES MOLES - R$ 200,00'
      },
      {
        procedureCode: '04.09.07.015-7',
        standardValue: 200.00,
        description: 'EXÉRESE DE GLÂNDULA DE BARTHOLIN/SKENE - R$ 200,00'
      },
      {
        procedureCode: '04.09.07.003-3',
        standardValue: 300.00,
        secondaryValue: 225.00,
        description: 'COLPOCLEISE (CIRURGIA DE LE FORT) - Principal: R$ 300 | Seq: R$ 225'
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
      {
        procedureCode: '04.01.02.010-0',
        standardValue: 150.00,
        description: 'EXTIRPAÇÃO E SUPRESSÃO DE LESÃO DE PELE E TECIDO SUBCUTÂNEO - R$ 150,00'
      },
      
      // PROCEDIMENTOS ADICIONAIS
      {
        procedureCode: '04.09.06.022-4',
        standardValue: 100.00,
        description: 'RESSECÇÃO DE VARIZES PÉLVICAS (ADICIONAL) - R$ 100,00'
      },
      {
        procedureCode: '04.07.04.018-8',
        standardValue: 250.00,
        description: 'LIBERAÇÃO DE ADERÊNCIAS INTESTINAIS (ADICIONAL) - R$ 250,00'
      },
      {
        procedureCode: '04.09.07.009-2',
        standardValue: 100.00,
        description: 'COLPORRAFIA NÃO OBSTÉTRICA (ADICIONAL) - R$ 100,00'
      },
      {
        procedureCode: '04.08.06.020-4',
        standardValue: 100.00,
        description: 'REINSERÇÃO MUSCULAR (CORREÇÃO DIÁSTESE RETO ABDOMINAL) - R$ 100,00'
      }
    ],
    
    multipleRules: [
      {
        codes: ['04.09.06.021-6', '04.09.06.023-2'],
        totalValue: 500.00,
        description: 'OOFORECTOMIA/OOFOROPLASTIA + SALPINGECTOMIA - R$ 500,00'
      },
      {
        codes: ['04.09.06.018-6', '04.09.07.027-0'],
        totalValue: 850.00,
        description: 'LAQUEADURA + TRATAMENTO INCONTINÊNCIA URINÁRIA - R$ 850,00'
      },
      {
        codes: ['04.09.07.006-8', '04.09.07.027-0'],
        totalValue: 600.00,
        description: 'COLPOPERINEOPLASTIA POSTERIOR + TRAT. INCONTINÊNCIA - R$ 600,00'
      },
      {
        codes: ['04.09.07.005-0', '04.09.07.027-0'],
        totalValue: 700.00,
        description: 'COLPOPERINEOPLASTIA ANTERIOR/POSTERIOR + INCONTINÊNCIA - R$ 700,00'
      }
    ]
  },

  // ================================================================
  // 8. JAIR DEMETRIO DE SOUZA - OTORRINOLARINGOLOGIA
  // Baseado em: Dr. HUMBERTO MOREIRA DA SILVA (Torao Tokuda)
  // Data: 18/11/2025
  // ================================================================
  'JAIR DEMETRIO DE SOUZA': {
    doctorName: 'JAIR DEMETRIO DE SOUZA',
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
  // 9. GUILHERME VINICIUS SAWCZYN - UROLOGIA
  // Baseado em: Dr. GUILHERME AUGUSTO STORER (Torao Tokuda)
  // Última atualização: 21/11/2025
  // Total: 22 procedimentos
  // ================================================================
  'GUILHERME VINICIUS SAWCZYN': {
    doctorName: 'GUILHERME VINICIUS SAWCZYN',
    rules: [
      {
        procedureCode: '04.09.01.023-5',
        standardValue: 1000.00,
        description: 'NEFROLITOTOMIA PERCUTÂNEA - R$ 1.000,00'
      },
      {
        procedureCode: '04.09.01.059-6',
        standardValue: 900.00,
        description: 'URETEROLITOTRIPSIA TRANSURETEROSC. (SEMIRRÍGIDA) - R$ 900,00'
      },
      {
        procedureCode: '04.09.01.018-9',
        standardValue: 1000.00,
        secondaryValue: 200.00,
        description: 'LITOTRIPSIA (FLEXÍVEL) - R$ 1.000 (Principal) / R$ 200 (Secundário)'
      },
      {
        procedureCode: '04.09.01.017-0',
        standardValue: 250.00,
        secondaryValue: 100.00,
        description: 'INSTALAÇÃO ENDOSCÓPICA CATETER DUPLO J - R$ 250 (Principal) / R$ 100 (Sec)'
      },
      {
        procedureCode: '04.09.02.007-9',
        standardValue: 250.00,
        secondaryValue: 150.00,
        tertiaryValue: 175.00,
        description: 'MEATOTOMIA SIMPLES - R$ 250 (Principal) / R$ 150 (Secundário) / R$ 175 (Terciário)'
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
        description: 'CISTOLITOTOMIA E/OU RETIRADA CORPO ESTRANHO BEXIGA - R$ 600,00'
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
        description: 'PIELOPLASTIA - R$ 700 (Principal) / R$ 200 (Secundário)'
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
        description: 'URETROTOMIA INTERNA - Principal: R$ 250 | Seq: R$ 200'
      }
    ],
    
    multipleRules: [
      // GRUPO 1: NEFROLITOTOMIA PERCUTÂNEA
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
        description: 'NEFROLITOTOMIA + CATETER DUPLO J + EXTRAÇÃO CÁLCULO - R$ 1.400,00'
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
      
      // GRUPO 2: URETEROLITOTRIPSIA
      {
        codes: ['04.09.01.059-6', '04.09.01.017-0'],
        totalValue: 1000.00,
        description: 'URETEROLITOTRIPSIA + CATETER DUPLO J - R$ 1.000,00'
      },
      
      // GRUPO 3: LITOTRIPSIA (FLEXÍVEL)
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
        description: 'LITOTRIPSIA + EXTRAÇÃO CÁLCULO + CATETER DUPLO J - R$ 1.200,00'
      },
      {
        codes: ['04.09.01.018-9', '04.09.01.059-6', '04.09.01.014-6', '04.09.01.017-0'],
        totalValue: 1300.00,
        description: 'LITOTRIPSIA + URETEROLITOTRIPSIA + EXTRAÇÃO + CATETER - R$ 1.300,00'
      },
      
      // GRUPO 4: PRÓSTATA
      {
        codes: ['04.09.03.004-0', '04.09.01.038-3'],
        totalValue: 1200.00,
        description: 'RESSECÇÃO PRÓSTATA + RESSECÇÃO LESÃO VESICAL - R$ 1.200,00'
      },
      
      // GRUPO 5: HIDROCELE
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
      
      // GRUPO 6: ORQUIDOPEXIA
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
      
      // GRUPO 7: PIELOPLASTIA
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
  // 10. BRUNO BOSIO DA SILVA - ORTOPEDIA
  // Especialidade: Ombro/Manguito Rotador
  // Última atualização: 21/11/2025
  // Obs: No Hospital São José tem valor fixo R$ 40.000,00
  //      No Hospital 18 de Dezembro trabalha com regras por procedimento
  // ================================================================
  'BRUNO BOSIO DA SILVA': {
    doctorName: 'BRUNO BOSIO DA SILVA',
    rules: [
      {
        procedureCode: '04.08.01.014-2',
        standardValue: 900.00,
        description: 'REPARO ROTURA MANGUITO ROTADOR (INCLUI PROC. DESCOMPRESSIVOS) - R$ 900,00'
      },
      {
        procedureCode: '04.08.06.071-9',
        standardValue: 900.00,
        description: 'VIDEOARTROSCOPIA - R$ 900,00'
      },
      {
        procedureCode: '04.08.01.021-5',
        standardValue: 0,
        description: 'TRATAMENTO CIRÚRGICO LUXAÇÃO RECIDIVANTE/HABITUAL (valor em regra múltipla)'
      },
      {
        procedureCode: '04.08.06.053-0',
        standardValue: 0,
        description: 'TRANSPOSIÇÃO/TRANSFERÊNCIA MIOTENDINOSA (valor em regra múltipla)'
      },
      {
        procedureCode: '04.08.06.046-8',
        standardValue: 0,
        description: 'TENOMIOTOMIA/DESINSERÇÃO (valor em regra múltipla)'
      }
    ],
    multipleRules: [
      {
        codes: ['04.08.01.014-2', '04.08.06.071-9'],
        totalValue: 900.00,
        description: 'REPARO MANGUITO ROTADOR + VIDEOARTROSCOPIA - R$ 900,00 TOTAL'
      },
      {
        codes: ['04.08.01.021-5', '04.08.06.053-0', '04.08.06.046-8'],
        totalValue: 500.00,
        description: 'TRAT. LUXAÇÃO RECIDIVANTE + TRANSPOSIÇÃO + TENOMIOTOMIA - R$ 500,00 TOTAL'
      }
    ]
  }
};


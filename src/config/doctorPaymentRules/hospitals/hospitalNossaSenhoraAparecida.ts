/**
 * ================================================================
 * HOSPITAL NOSSA SENHORA APARECIDA - FOZ DO IGUAÇU
 * ================================================================
 * Hospital ID: 47eddf6e-ac64-4433-acc1-7b644a2b43d0
 * Programa: Opera Paraná
 * Total de Médicos: 5 cirurgiões gerais
 * Última Atualização: 28/11/2025
 * 
 * OBSERVAÇÃO: Todos os 5 médicos têm as MESMAS regras
 * Baseado nas regras do Dr. JOAO VICTOR RODRIGUES (Torao Tokuda)
 * ================================================================
 */

import type { HospitalRules, DoctorPaymentRule } from '../types';

// ================================================================
// REGRAS COMPARTILHADAS - CIRURGIA GERAL FOZ DO IGUAÇU
// Todos os 5 cirurgiões usam as mesmas regras
// ================================================================
const CIRURGIA_GERAL_FOZ_RULES: Omit<DoctorPaymentRule, 'doctorName'> = {
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
      description: 'REPARAÇÃO DE OUTRAS HÉRNIAS - R$ 300,00'
    },
    {
      procedureCode: '04.09.06.013-5',
      standardValue: 1000.00,
      description: 'HISTERECTOMIA TOTAL - R$ 1.000,00'
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
    { codes: ['04.07.04.006-4', '04.07.04.010-2', '04.07.04.012-9'], totalValue: 1400.00, description: 'EPIGÁSTRICA (1ª) + INGUINAL UNI (2ª) + UMBILICAL (3ª) - R$ 1.400,00' },
    { codes: ['04.07.04.006-4', '04.07.04.009-9', '04.07.04.012-9'], totalValue: 1400.00, description: 'EPIGÁSTRICA (1ª) + INGUINAL BILATERAL (2ª) + UMBILICAL (3ª) - R$ 1.400,00' },
    { codes: ['04.07.04.010-2', '04.07.04.012-9', '04.07.04.008-0'], totalValue: 1300.00, description: 'INGUINAL UNI (1ª) + UMBILICAL (2ª) + INCISIONAL (3ª) - R$ 1.300,00' },
    { codes: ['04.07.04.006-4', '04.07.04.010-2', '04.07.04.012-9', '04.07.04.008-0'], totalValue: 1700.00, description: 'EPIGÁSTRICA (1ª) + INGUINAL UNI (2ª) + UMBILICAL (3ª) + INCISIONAL (4ª) - R$ 1.700,00' }
  ]
};

// ================================================================
// EXPORTAR REGRAS PARA TODOS OS 5 MÉDICOS
// ================================================================
export const HOSPITAL_NOSSA_SENHORA_APARECIDA_RULES: HospitalRules = {
  // 1. ALEXANDRE PORTELLA PLIACEKOS
  'ALEXANDRE PORTELLA PLIACEKOS': {
    doctorName: 'ALEXANDRE PORTELLA PLIACEKOS',
    ...CIRURGIA_GERAL_FOZ_RULES
  },

  // 2. ISIDORO ANTONIO VILLAMAYOR ALVAREZ
  'ISIDORO ANTONIO VILLAMAYOR ALVAREZ': {
    doctorName: 'ISIDORO ANTONIO VILLAMAYOR ALVAREZ',
    ...CIRURGIA_GERAL_FOZ_RULES
  },

  // 3. JOSE LUIZ BERTOLI NETO
  'JOSE LUIZ BERTOLI NETO': {
    doctorName: 'JOSE LUIZ BERTOLI NETO',
    ...CIRURGIA_GERAL_FOZ_RULES
  },

  // 4. PAULO RODOLPHO CAMARGO
  'PAULO RODOLPHO CAMARGO': {
    doctorName: 'PAULO RODOLPHO CAMARGO',
    ...CIRURGIA_GERAL_FOZ_RULES
  },

  // 5. RAPHAEL BEZERRA DE MENEZES COSTA
  'RAPHAEL BEZERRA DE MENEZES COSTA': {
    doctorName: 'RAPHAEL BEZERRA DE MENEZES COSTA',
    ...CIRURGIA_GERAL_FOZ_RULES
  }
};


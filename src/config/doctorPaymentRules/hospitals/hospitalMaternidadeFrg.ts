/**
 * ================================================================
 * HOSPITAL MATERNIDADE NOSSA SENHORA APARECIDA
 * FAZENDA RIO GRANDE (FRG) - FRANCISCO BELTRÃO
 * ================================================================
 * Hospital ID: a8978eaa-b90e-4dc8-8fd5-0af984374d34
 * Programa: Opera Paraná
 * Total de Médicos: 32 (todas especialidades)
 * Última Atualização: 28/11/2025
 * 
 * MÉDICOS POR ESPECIALIDADE:
 * - Cirurgiões Gerais: 4 (PEDRO, LEONARDO, MARCELO, MATHEUS)
 * - Ginecologistas: 3 (INGRID, MARCELA, MARIANA)
 * - Urologistas: 14
 * - Cirurgiões Vasculares: 2
 * - Ortopedistas Quadril: 3
 * - Ortopedista Joelho: 1
 * - Ortopedista Mão/Punho: 1
 * - Ortopedistas Joelho/Ombro: 4
 * ================================================================
 */

import type { HospitalRules, DoctorPaymentRule } from '../types';

// ================================================================
// REGRAS COMPARTILHADAS - CIRURGIA GERAL FRG
// Baseado nas regras do Dr. JOAO VICTOR RODRIGUES (Torao Tokuda)
// Utilizado por 4 cirurgiões gerais
// ================================================================
const CIRURGIA_GERAL_FRG_RULES: Omit<DoctorPaymentRule, 'doctorName'> = {
  rules: [
    { procedureCode: '04.07.03.002-6', standardValue: 900.00, description: 'COLECISTECTOMIA (PRINCIPAL) - R$ 900,00' },
    { procedureCode: '04.07.04.018-8', standardValue: 300.00, description: 'LIBERAÇÃO DE ADERÊNCIAS INTESTINAIS - R$ 300,00' },
    { procedureCode: '04.07.04.002-1', standardValue: 300.00, description: 'DRENAGEM DE ABSCESSO SUBFRÊNICO - R$ 300,00' },
    { procedureCode: '04.07.03.014-0', standardValue: 300.00, description: 'HEPATORRAFIA - R$ 300,00' },
    { procedureCode: '04.07.03.006-9', standardValue: 250.00, description: 'COLEDOCOTOMIA - R$ 250,00' },
    { procedureCode: '04.07.03.005-0', standardValue: 200.00, description: 'COLEDOCOPLASTIA - R$ 200,00' },
    { procedureCode: '04.07.04.010-2', standardValue: 700.00, secondaryValue: 300.00, description: 'HERNIOPLASTIA INGUINAL/CRURAL UNILATERAL - Principal: R$ 700 | Seq: R$ 300' },
    { procedureCode: '04.07.04.009-9', standardValue: 700.00, secondaryValue: 300.00, description: 'HERNIOPLASTIA INGUINAL BILATERAL - Principal: R$ 700 | Seq: R$ 300' },
    { procedureCode: '04.07.04.006-4', standardValue: 800.00, secondaryValue: 300.00, description: 'HERNIOPLASTIA EPIGÁSTRICA - Principal: R$ 800 | Seq: R$ 300' },
    { procedureCode: '04.07.04.012-9', standardValue: 450.00, secondaryValue: 300.00, description: 'HERNIOPLASTIA UMBILICAL - Principal: R$ 450 | Seq: R$ 300' },
    { procedureCode: '04.07.04.008-0', standardValue: 600.00, secondaryValue: 300.00, description: 'HERNIOPLASTIA INCISIONAL/VENTRAL - Principal: R$ 600 | Seq: R$ 300' },
    { procedureCode: '04.07.04.011-0', standardValue: 600.00, description: 'HERNIOPLASTIA RECIDIVANTE - R$ 600,00' },
    { procedureCode: '04.07.02.027-6', standardValue: 450.00, description: 'FISTULECTOMIA/FISTULOTOMIA ANAL - R$ 450,00' },
    { procedureCode: '04.07.02.028-4', standardValue: 450.00, description: 'HEMORROIDECTOMIA - R$ 450,00' },
    { procedureCode: '04.07.02.031-4', standardValue: 450.00, description: 'TRATAMENTO CIRÚRGICO DE FISSURA ANAL - R$ 450,00' },
    { procedureCode: '04.01.02.007-0', standardValue: 250.00, description: 'EXÉRESE DE CISTO DERMOIDE - R$ 250,00' },
    { procedureCode: '04.01.02.010-0', standardValue: 250.00, description: 'EXTIRPAÇÃO E SUPRESSÃO DE LESÃO DE PELE E TECIDO SUBCUTÂNEO - R$ 250,00' },
    { procedureCode: '04.01.02.008-8', standardValue: 250.00, description: 'EXÉRESE DE LIPOMA - R$ 250,00' },
    { procedureCode: '04.01.02.009-6', standardValue: 250.00, description: 'EXÉRESE DE CISTO PILONIDAL - R$ 250,00' },
    { procedureCode: '04.07.02.022-5', standardValue: 450.00, description: 'EXCISÃO DE LESÃO/TUMOR ANU-RETAL - R$ 450,00' },
    { procedureCode: '04.08.06.031-0', standardValue: 250.00, description: 'RESSECÇÃO SIMPLES DE TUMOR ÓSSEO/PARTES MOLES - R$ 250,00' },
    { procedureCode: '04.01.02.005-3', standardValue: 150.00, description: 'EXCISÃO E SUTURA DE LESÃO NA PELE C/ PLÁSTICA EM Z OU ROTAÇÃO - R$ 150,00' },
    { procedureCode: '04.07.02.021-7', standardValue: 450.00, secondaryValue: 100.00, description: 'ESFINCTEROTOMIA INTERNA E TRAT. FISSURA ANAL - Principal: R$ 450 | Seq: R$ 100' },
    { procedureCode: '04.07.04.022-6', standardValue: 300.00, description: 'REPARAÇÃO DE OUTRAS HÉRNIAS - R$ 300,00' },
    { procedureCode: '04.09.06.013-5', standardValue: 1000.00, description: 'HISTERECTOMIA TOTAL - R$ 1.000,00' }
  ],
  multipleRules: [
    { codes: ['04.07.03.002-6', '04.07.04.018-8'], totalValue: 1200.00, description: 'COLECISTECTOMIA + LIBERAÇÃO ADERÊNCIAS - R$ 1.200,00' },
    { codes: ['04.07.03.002-6', '04.07.04.002-1'], totalValue: 1200.00, description: 'COLECISTECTOMIA + DRENAGEM ABSCESSO - R$ 1.200,00' },
    { codes: ['04.07.03.002-6', '04.07.03.014-0'], totalValue: 1200.00, description: 'COLECISTECTOMIA + HEPATORRAFIA - R$ 1.200,00' },
    { codes: ['04.07.03.002-6', '04.07.03.006-9'], totalValue: 1150.00, description: 'COLECISTECTOMIA + COLEDOCOTOMIA - R$ 1.150,00' },
    { codes: ['04.07.03.002-6', '04.07.03.005-0'], totalValue: 1100.00, description: 'COLECISTECTOMIA + COLEDOCOPLASTIA - R$ 1.100,00' },
    { codes: ['04.07.03.002-6', '04.07.04.010-2'], totalValue: 1600.00, description: 'COLECISTECTOMIA + HERNIOPLASTIA INGUINAL UNI - R$ 1.600,00' },
    { codes: ['04.07.03.002-6', '04.07.04.009-9'], totalValue: 1600.00, description: 'COLECISTECTOMIA + HERNIOPLASTIA INGUINAL BILATERAL - R$ 1.600,00' },
    { codes: ['04.07.03.002-6', '04.07.04.006-4'], totalValue: 1700.00, description: 'COLECISTECTOMIA + HERNIOPLASTIA EPIGÁSTRICA - R$ 1.700,00' },
    { codes: ['04.07.03.002-6', '04.07.04.012-9'], totalValue: 1350.00, description: 'COLECISTECTOMIA + HERNIOPLASTIA UMBILICAL - R$ 1.350,00' },
    { codes: ['04.07.03.002-6', '04.07.04.008-0'], totalValue: 1500.00, description: 'COLECISTECTOMIA + HERNIOPLASTIA INCISIONAL - R$ 1.500,00' },
    { codes: ['04.07.03.002-6', '04.07.04.018-8', '04.07.03.014-0'], totalValue: 1500.00, description: 'COLECISTECTOMIA + LIBER. ADER. + HEPATORRAFIA - R$ 1.500,00' },
    { codes: ['04.07.03.002-6', '04.07.03.006-9', '04.07.03.005-0'], totalValue: 1350.00, description: 'COLECISTECTOMIA + COLEDOC. + COLEDOCOPLASTIA - R$ 1.350,00' },
    { codes: ['04.07.03.002-6', '04.07.04.018-8', '04.07.03.014-0', '04.07.04.002-1'], totalValue: 1800.00, description: 'COLECISTECTOMIA + 3 SEQUENCIAIS - R$ 1.800,00' },
    { codes: ['04.07.03.002-6', '04.07.04.018-8', '04.07.03.014-0', '04.07.04.002-1', '04.07.03.006-9'], totalValue: 2050.00, description: 'COLECISTECTOMIA + 4 SEQUENCIAIS (MÁXIMO) - R$ 2.050,00' },
    { codes: ['04.07.04.010-2', '04.07.04.009-9'], totalValue: 1000.00, description: 'INGUINAL UNI (1ª) + INGUINAL BILATERAL (2ª) - R$ 1.000,00' },
    { codes: ['04.07.04.010-2', '04.07.04.006-4'], totalValue: 1000.00, description: 'INGUINAL UNI (1ª) + EPIGÁSTRICA (2ª) - R$ 1.000,00' },
    { codes: ['04.07.04.010-2', '04.07.04.012-9'], totalValue: 1000.00, description: 'INGUINAL UNI (1ª) + UMBILICAL (2ª) - R$ 1.000,00' },
    { codes: ['04.07.04.010-2', '04.07.04.008-0'], totalValue: 1000.00, description: 'INGUINAL UNI (1ª) + INCISIONAL (2ª) - R$ 1.000,00' },
    { codes: ['04.07.04.009-9', '04.07.04.010-2'], totalValue: 1000.00, description: 'INGUINAL BILATERAL (1ª) + INGUINAL UNI (2ª) - R$ 1.000,00' },
    { codes: ['04.07.04.009-9', '04.07.04.006-4'], totalValue: 1000.00, description: 'INGUINAL BILATERAL (1ª) + EPIGÁSTRICA (2ª) - R$ 1.000,00' },
    { codes: ['04.07.04.009-9', '04.07.04.012-9'], totalValue: 1000.00, description: 'INGUINAL BILATERAL (1ª) + UMBILICAL (2ª) - R$ 1.000,00' },
    { codes: ['04.07.04.009-9', '04.07.04.008-0'], totalValue: 1000.00, description: 'INGUINAL BILATERAL (1ª) + INCISIONAL (2ª) - R$ 1.000,00' },
    { codes: ['04.07.04.006-4', '04.07.04.010-2'], totalValue: 1100.00, description: 'EPIGÁSTRICA (1ª) + INGUINAL UNI (2ª) - R$ 1.100,00' },
    { codes: ['04.07.04.006-4', '04.07.04.009-9'], totalValue: 1100.00, description: 'EPIGÁSTRICA (1ª) + INGUINAL BILATERAL (2ª) - R$ 1.100,00' },
    { codes: ['04.07.04.006-4', '04.07.04.012-9'], totalValue: 1100.00, description: 'EPIGÁSTRICA (1ª) + UMBILICAL (2ª) - R$ 1.100,00' },
    { codes: ['04.07.04.006-4', '04.07.04.008-0'], totalValue: 1100.00, description: 'EPIGÁSTRICA (1ª) + INCISIONAL (2ª) - R$ 1.100,00' },
    { codes: ['04.07.04.012-9', '04.07.04.010-2'], totalValue: 750.00, description: 'UMBILICAL (1ª) + INGUINAL UNI (2ª) - R$ 750,00' },
    { codes: ['04.07.04.012-9', '04.07.04.009-9'], totalValue: 750.00, description: 'UMBILICAL (1ª) + INGUINAL BILATERAL (2ª) - R$ 750,00' },
    { codes: ['04.07.04.012-9', '04.07.04.006-4'], totalValue: 750.00, description: 'UMBILICAL (1ª) + EPIGÁSTRICA (2ª) - R$ 750,00' },
    { codes: ['04.07.04.012-9', '04.07.04.008-0'], totalValue: 750.00, description: 'UMBILICAL (1ª) + INCISIONAL (2ª) - R$ 750,00' },
    { codes: ['04.07.04.008-0', '04.07.04.010-2'], totalValue: 900.00, description: 'INCISIONAL (1ª) + INGUINAL UNI (2ª) - R$ 900,00' },
    { codes: ['04.07.04.008-0', '04.07.04.009-9'], totalValue: 900.00, description: 'INCISIONAL (1ª) + INGUINAL BILATERAL (2ª) - R$ 900,00' },
    { codes: ['04.07.04.008-0', '04.07.04.006-4'], totalValue: 900.00, description: 'INCISIONAL (1ª) + EPIGÁSTRICA (2ª) - R$ 900,00' },
    { codes: ['04.07.04.008-0', '04.07.04.012-9'], totalValue: 900.00, description: 'INCISIONAL (1ª) + UMBILICAL (2ª) - R$ 900,00' },
    { codes: ['04.07.04.006-4', '04.07.04.010-2', '04.07.04.012-9'], totalValue: 1400.00, description: 'EPIGÁSTRICA + INGUINAL UNI + UMBILICAL - R$ 1.400,00' },
    { codes: ['04.07.04.006-4', '04.07.04.009-9', '04.07.04.012-9'], totalValue: 1400.00, description: 'EPIGÁSTRICA + INGUINAL BILATERAL + UMBILICAL - R$ 1.400,00' },
    { codes: ['04.07.04.010-2', '04.07.04.012-9', '04.07.04.008-0'], totalValue: 1300.00, description: 'INGUINAL UNI + UMBILICAL + INCISIONAL - R$ 1.300,00' },
    { codes: ['04.07.04.006-4', '04.07.04.010-2', '04.07.04.012-9', '04.07.04.008-0'], totalValue: 1700.00, description: 'EPIGÁSTRICA + INGUINAL + UMBILICAL + INCISIONAL - R$ 1.700,00' }
  ]
};

// ================================================================
// REGRAS COMPARTILHADAS - GINECOLOGIA FRG
// Baseado nas regras da Dra. DJAVANI BLUM (Torao Tokuda)
// Utilizado por 3 ginecologistas
// ================================================================
const GINECOLOGIA_FRG_RULES: Omit<DoctorPaymentRule, 'doctorName'> = {
  rules: [
    { procedureCode: '04.09.06.013-5', standardValue: 1000.00, description: 'HISTERECTOMIA TOTAL - R$ 1.000,00' },
    { procedureCode: '04.09.06.012-7', standardValue: 750.00, description: 'HISTERECTOMIA SUBTOTAL - R$ 750,00' },
    { procedureCode: '04.09.06.011-9', standardValue: 1200.00, description: 'HISTERECTOMIA C/ ANEXECTOMIA (UNI/BILATERAL) - R$ 1.200,00' },
    { procedureCode: '04.09.06.021-6', standardValue: 700.00, secondaryValue: 525.00, tertiaryValue: 420.00, description: 'OOFORECTOMIA/OOFOROPLASTIA - Princ: R$ 700 | 2º: R$ 525 | 3º+: R$ 420' },
    { procedureCode: '04.09.06.018-6', standardValue: 600.00, description: 'LAQUEADURA TUBÁRIA - R$ 600,00' },
    { procedureCode: '04.09.07.027-0', standardValue: 450.00, secondaryValue: 250.00, tertiaryValue: 200.00, description: 'TRAT. CIRÚRGICO INCONTINÊNCIA URINÁRIA - Princ: R$ 450 | 2º: R$ 250 | 3º: R$ 200' },
    { procedureCode: '04.09.07.006-8', standardValue: 450.00, description: 'COLPOPERINEOPLASTIA POSTERIOR - R$ 450,00' },
    { procedureCode: '04.09.07.005-0', standardValue: 600.00, secondaryValue: 450.00, description: 'COLPOPERINEOPLASTIA ANTERIOR E POSTERIOR - Princ: R$ 600 | 2º: R$ 450' },
    { procedureCode: '04.09.06.004-6', standardValue: 250.00, description: 'CURETAGEM SEMIÓTICA C/ OU S/ DILATAÇÃO - R$ 250,00' },
    { procedureCode: '04.09.07.026-2', standardValue: 250.00, description: 'TRAT. CIRÚRGICO HIPERTROFIA PEQUENOS LÁBIOS (NINFOPLASTIA) - R$ 250,00' },
    { procedureCode: '04.08.06.031-0', standardValue: 250.00, description: 'RESSECÇÃO SIMPLES DE TUMOR ÓSSEO/PARTES MOLES - R$ 250,00' },
    { procedureCode: '04.09.07.015-7', standardValue: 250.00, description: 'EXÉRESE DE GLÂNDULA DE BARTHOLIN/SKENE - R$ 250,00' },
    { procedureCode: '04.09.07.019-0', standardValue: 150.00, description: 'MARSUPIALIZAÇÃO DE GLÂNDULA DE BARTOLIN - R$ 150,00' },
    { procedureCode: '04.09.07.003-3', standardValue: 300.00, secondaryValue: 225.00, description: 'COLPOCLEISE (CIRURGIA DE LE FORT) - Princ: R$ 300 | Seq: R$ 225' },
    { procedureCode: '04.09.06.019-4', standardValue: 550.00, description: 'MIOMECTOMIA - R$ 550,00' },
    { procedureCode: '04.09.07.014-9', standardValue: 300.00, description: 'EXÉRESE DE CISTO VAGINAL - R$ 300,00' },
    { procedureCode: '04.09.06.022-4', standardValue: 100.00, description: 'RESSECÇÃO VARIZES PÉLVICAS (ADICIONAL) - R$ 100,00' },
    { procedureCode: '04.07.04.018-8', standardValue: 300.00, description: 'LIBERAÇÃO ADERÊNCIAS INTESTINAIS (ADICIONAL) - R$ 300,00' },
    { procedureCode: '04.09.07.009-2', standardValue: 100.00, description: 'COLPORRAFIA NÃO OBSTÉTRICA (ADICIONAL) - R$ 100,00' },
    { procedureCode: '04.08.06.020-4', standardValue: 100.00, description: 'REINSERÇÃO MUSCULAR (CORREÇÃO DIÁSTESE RETO - ADICIONAL) - R$ 100,00' },
    { procedureCode: '04.09.06.023-2', standardValue: 250.00, secondaryValue: 187.50, tertiaryValue: 150.00, quaternaryValue: 125.00, description: 'SALPINGECTOMIA UNI/BILATERAL - Princ: R$ 250 | 2º: R$ 187,50 | 3º: R$ 150 | 4º: R$ 125' },
    { procedureCode: '04.01.02.010-0', standardValue: 150.00, description: 'EXTIRPAÇÃO E SUPRESSÃO LESÃO PELE/TECIDO SUBCUTÂNEO - R$ 150,00' },
    { procedureCode: '04.09.06.010-0', standardValue: 600.00, description: 'HISTERECTOMIA (POR VIA VAGINAL) - R$ 600,00' }
  ],
  multipleRules: [
    { codes: ['04.09.06.021-6', '04.09.06.023-2'], totalValue: 900.00, description: 'OOFORECTOMIA/OOFOROPLASTIA + SALPINGECTOMIA - R$ 900,00' },
    { codes: ['04.09.07.006-8', '04.09.07.027-0'], totalValue: 800.00, description: 'COLPOPERINEOPLASTIA POST. + TRAT. INCONTINÊNCIA - R$ 800,00' },
    { codes: ['04.09.07.005-0', '04.09.07.027-0'], totalValue: 900.00, description: 'COLPOPERINEOPLASTIA ANT/POST + TRAT. INCONTINÊNCIA - R$ 900,00' }
  ]
};

// ================================================================
// REGRAS COMPARTILHADAS - UROLOGIA FRG
// Baseado nas regras do Dr. GUILHERME AUGUSTO STORER
// Utilizado por 14 urologistas
// ================================================================
const UROLOGIA_FRG_RULES: Omit<DoctorPaymentRule, 'doctorName'> = {
  rules: [
    { procedureCode: '04.09.01.023-5', standardValue: 1000.00, description: 'NEFROLITOTOMIA PERCUTÂNEA - R$ 1.000,00' },
    { procedureCode: '04.09.01.059-6', standardValue: 900.00, secondaryValue: 200.00, description: 'URETEROLITOTRIPSIA - Principal: R$ 900 | Seq: R$ 200' },
    { procedureCode: '04.09.01.018-9', standardValue: 1000.00, secondaryValue: 200.00, description: 'LITOTRIPSIA - Principal: R$ 1.000 | Seq: R$ 200' },
    { procedureCode: '04.09.01.017-0', standardValue: 250.00, secondaryValue: 100.00, description: 'CATETER DUPLO J - Principal: R$ 250 | Seq: R$ 100' },
    { procedureCode: '04.09.01.038-3', standardValue: 200.00, description: 'RESSECÇÃO ENDOSCÓPICA DE LESÃO VESICAL - R$ 200,00' },
    { procedureCode: '04.09.03.004-0', standardValue: 1000.00, description: 'RESSECÇÃO ENDOSCÓPICA DE PRÓSTATA - R$ 1.000,00' },
    { procedureCode: '04.09.03.002-3', standardValue: 1000.00, description: 'PROSTATECTOMIA SUPRAPÚBICA - R$ 1.000,00' },
    { procedureCode: '04.09.04.021-5', standardValue: 300.00, secondaryValue: 225.00, description: 'HIDROCELE - Principal: R$ 300 | Seq: R$ 225' },
    { procedureCode: '04.09.05.008-3', standardValue: 250.00, secondaryValue: 187.50, tertiaryValue: 150.00, description: 'POSTECTOMIA - Princ: R$ 250 | 2º: R$ 187,50 | 3º+: R$ 150' },
    { procedureCode: '04.09.04.024-0', standardValue: 450.00, description: 'VASECTOMIA - R$ 450,00' },
    { procedureCode: '04.09.04.023-1', standardValue: 250.00, description: 'TRATAMENTO CIRÚRGICO DE VARICOCELE - R$ 250,00' },
    { procedureCode: '04.09.04.013-4', standardValue: 400.00, description: 'ORQUIDOPEXIA UNILATERAL - R$ 400,00' },
    { procedureCode: '04.09.04.012-6', standardValue: 450.00, description: 'ORQUIDOPEXIA BILATERAL - R$ 450,00' },
    { procedureCode: '04.09.01.006-5', standardValue: 600.00, secondaryValue: 375.00, description: 'CISTOLITOTOMIA - Principal: R$ 600 | Seq: R$ 375' },
    { procedureCode: '04.09.05.007-5', standardValue: 500.00, description: 'PLÁSTICA TOTAL DO PÊNIS (INCLUI PEYRONIE) - R$ 500,00' },
    { procedureCode: 'RESSECÇÃO_CISTOS', standardValue: 250.00, description: 'RESSECÇÃO DE CISTOS/CAUTERIZAÇÕES - R$ 250,00' },
    { procedureCode: '04.09.04.016-9', standardValue: 500.00, description: 'ORQUIECTOMIA UNILATERAL - R$ 500,00' },
    { procedureCode: '04.09.01.032-4', standardValue: 700.00, secondaryValue: 200.00, description: 'PIELOPLASTIA - Principal: R$ 700 | Seq: R$ 200' },
    { procedureCode: '04.09.01.021-9', standardValue: 1200.00, description: 'NEFRECTOMIA TOTAL - R$ 1.200,00' },
    { procedureCode: '04.09.01.020-0', standardValue: 1000.00, description: 'NEFRECTOMIA PARCIAL - R$ 1.000,00' },
    { procedureCode: '04.09.01.022-7', standardValue: 900.00, description: 'NEFROLITOTOMIA (ANATRÓFICA) - R$ 900,00' },
    { procedureCode: '04.09.01.029-4', standardValue: 400.00, description: 'NEFROSTOMIA PERCUTÂNEA - R$ 400,00' },
    { procedureCode: '04.09.02.017-6', standardValue: 250.00, secondaryValue: 200.00, description: 'URETROTOMIA INTERNA - Principal: R$ 250 | Seq: R$ 200' },
    { procedureCode: '04.01.02.005-3', standardValue: 150.00, description: 'EXCISÃO E SUTURA LESÃO NA PELE C/ PLÁSTICA - R$ 150,00' },
    { procedureCode: '04.09.07.025-4', standardValue: 800.00, secondaryValue: 400.00, description: 'FÍSTULA VESICO-VAGINAL - Principal: R$ 800 | Seq: R$ 400' },
    { procedureCode: '04.09.02.007-9', standardValue: 250.00, secondaryValue: 200.00, description: 'MEATOTOMIA SIMPLES - Principal: R$ 250 | Seq: R$ 200' },
    { procedureCode: '04.09.01.009-0', standardValue: 250.00, description: 'CISTOSTOMIA - R$ 250,00' }
  ],
  multipleRules: [
    { codes: ['04.09.01.023-5', '04.09.01.017-0'], totalValue: 1100.00, description: 'NEFROLITOTOMIA PERCUTÂNEA + CATETER DUPLO J - R$ 1.100,00' },
    { codes: ['04.09.01.023-5', '04.09.01.014-6'], totalValue: 1300.00, description: 'NEFROLITOTOMIA PERCUTÂNEA + EXTRAÇÃO CÁLCULO PELVE - R$ 1.300,00' },
    { codes: ['04.09.01.023-5', '04.09.01.017-0', '04.09.01.014-6'], totalValue: 1400.00, description: 'NEFROLITOTOMIA + CATETER J + EXTRAÇÃO CÁLCULO - R$ 1.400,00' },
    { codes: ['04.09.01.023-5', '04.09.01.014-6', '04.09.01.059-6'], totalValue: 1500.00, description: 'NEFROLITOTOMIA + EXTRAÇÃO CÁLCULO + URETEROLITOTRIPSIA - R$ 1.500,00' },
    { codes: ['04.09.01.023-5', '04.09.01.017-0', '04.09.01.014-6', '04.09.01.059-6'], totalValue: 1600.00, description: 'NEFROLITOTOMIA + CATETER J + EXTRAÇÃO + URETEROLITOTRIPSIA - R$ 1.600,00' },
    { codes: ['04.09.01.059-6', '04.09.01.017-0'], totalValue: 1000.00, description: 'URETEROLITOTRIPSIA + CATETER DUPLO J (SEMIRRÍGIDA) - R$ 1.000,00' },
    { codes: ['04.09.01.018-9', '04.09.01.017-0'], totalValue: 1100.00, description: 'LITOTRIPSIA (FLEXÍVEL) + CATETER DUPLO J - R$ 1.100,00' },
    { codes: ['04.09.01.018-9', '04.09.01.059-6', '04.09.01.017-0'], totalValue: 1200.00, description: 'LITOTRIPSIA + URETEROLITOTRIPSIA + CATETER J - R$ 1.200,00' },
    { codes: ['04.09.01.018-9', '04.09.01.014-6', '04.09.01.017-0'], totalValue: 1200.00, description: 'LITOTRIPSIA + EXTRAÇÃO CÁLCULO + CATETER J - R$ 1.200,00' },
    { codes: ['04.09.01.018-9', '04.09.01.059-6', '04.09.01.014-6', '04.09.01.017-0'], totalValue: 1300.00, description: 'LITOTRIPSIA + URETEROLITOTRIPSIA + EXTRAÇÃO + CATETER J - R$ 1.300,00' },
    { codes: ['04.09.03.004-0', '04.09.01.038-3'], totalValue: 1200.00, description: 'RESSECÇÃO PRÓSTATA + RESSECÇÃO LESÃO VESICAL - R$ 1.200,00' },
    { codes: ['04.09.04.021-5', '04.09.04.019-3'], totalValue: 400.00, description: 'HIDROCELE + RESSECÇÃO PARCIAL BOLSA ESCROTAL - R$ 400,00' },
    { codes: ['04.09.04.021-5', '04.09.04.019-3', '04.09.04.017-7'], totalValue: 500.00, description: 'HIDROCELE + RESSECÇÃO BOLSA + PLÁSTICA BOLSA - R$ 500,00' },
    { codes: ['04.09.04.013-4', '04.09.04.017-7'], totalValue: 550.00, description: 'ORQUIDOPEXIA UNILATERAL + PLÁSTICA BOLSA - R$ 550,00' },
    { codes: ['04.09.04.012-6', '04.09.04.017-7'], totalValue: 550.00, description: 'ORQUIDOPEXIA BILATERAL + PLÁSTICA BOLSA - R$ 550,00' },
    { codes: ['04.09.01.032-4', '04.09.01.057-0'], totalValue: 1000.00, description: 'PIELOPLASTIA + URETEROPLASTIA - R$ 1.000,00' },
    { codes: ['04.09.01.032-4', '04.09.01.057-0', '04.09.01.017-0'], totalValue: 1100.00, description: 'PIELOPLASTIA + URETEROPLASTIA + CATETER DUPLO J - R$ 1.100,00' }
  ]
};

// ================================================================
// REGRAS COMPARTILHADAS - CIRURGIA VASCULAR FRG
// Utilizado por 2 cirurgiões vasculares
// ================================================================
const CIRURGIA_VASCULAR_FRG_RULES: Omit<DoctorPaymentRule, 'doctorName'> = {
  rules: [
    { procedureCode: '04.06.02.057-4', standardValue: 900.00, description: 'TRATAMENTO CIRÚRGICO DE VARIZES (UNILATERAL) - R$ 900,00' },
    { procedureCode: '04.06.02.056-6', standardValue: 900.00, description: 'TRATAMENTO CIRÚRGICO DE VARIZES (BILATERAL) - R$ 900,00' },
    { procedureCode: '03.09.07.001-5', standardValue: 100.00, description: 'TRATAMENTO ESCLEROSANTE NÃO ESTÉTICO DE VARIZES - R$ 100,00' },
    { procedureCode: '03.09.07.002-3', standardValue: 150.00, description: 'TRATAMENTO ESCLEROSANTE NÃO ESTÉTICO DE VARIZES - R$ 150,00' }
  ]
};

// ================================================================
// REGRAS COMPARTILHADAS - ORTOPEDIA QUADRIL FRG
// Utilizado por 3 ortopedistas
// ================================================================
const ORTOPEDIA_QUADRIL_FRG_RULES: Omit<DoctorPaymentRule, 'doctorName'> = {
  rules: [
    { procedureCode: '04.08.04.009-2', standardValue: 2500.00, description: 'ARTROPLASTIA TOTAL PRIMÁRIA DO QUADRIL NÃO CIMENTADA/HÍBRIDA - R$ 2.500,00' },
    { procedureCode: '04.08.04.007-6', standardValue: 2500.00, description: 'ARTROPLASTIA DE REVISÃO/RECONSTRUÇÃO DO QUADRIL - R$ 2.500,00' }
  ]
};

// ================================================================
// REGRAS COMPARTILHADAS - ORTOPEDIA JOELHO FRG
// Utilizado por 1 ortopedista
// ================================================================
const ORTOPEDIA_JOELHO_FRG_RULES: Omit<DoctorPaymentRule, 'doctorName'> = {
  rules: [
    { procedureCode: '04.08.05.089-6', standardValue: 750.00, secondaryValue: 300.00, description: 'TRATAMENTO CIRÚRGICO ROTURA MENISCO - Princ: R$ 750 | Seq: R$ 300' },
    { procedureCode: '04.08.05.088-8', standardValue: 750.00, description: 'TRATAMENTO CIRÚRGICO ROTURA MENISCO COM SUTURA - R$ 750,00' },
    { procedureCode: '04.08.05.016-0', standardValue: 900.00, description: 'RECONSTRUÇÃO LIGAMENTAR INTRA-ARTICULAR JOELHO (CRUZADO ANT.) - R$ 900,00' },
    { procedureCode: '04.08.05.015-2', standardValue: 500.00, description: 'RECONSTRUÇÃO LIGAMENTAR EXTRA-ARTICULAR JOELHO - R$ 500,00' },
    { procedureCode: '04.08.05.006-3', standardValue: 2000.00, description: 'ARTROPLASTIA TOTAL PRIMÁRIA DO JOELHO - R$ 2.000,00' }
  ]
};

// ================================================================
// REGRAS COMPARTILHADAS - ORTOPEDIA MÃO/PUNHO FRG
// Utilizado por 1 ortopedista
// ================================================================
const ORTOPEDIA_MAO_FRG_RULES: Omit<DoctorPaymentRule, 'doctorName'> = {
  rules: [
    { procedureCode: '04.03.02.012-3', standardValue: 450.00, description: 'TRATAMENTO CIRÚRGICO SÍNDROME COMPRESSIVA TÚNEL CARPO - R$ 450,00' },
    { procedureCode: '04.08.02.032-6', standardValue: 450.00, description: 'TRATAMENTO CIRÚRGICO DEDO EM GATILHO - R$ 450,00' },
    { procedureCode: '04.08.06.044-1', standardValue: 450.00, description: 'TENÓLISE - R$ 450,00' },
    { procedureCode: '04.03.02.005-0', standardValue: 450.00, description: 'MICRONEURÓLISE DE NERVO PERIFÉRICO - R$ 450,00' },
    { procedureCode: '04.08.02.055-5', standardValue: 450.00, description: 'TRATAMENTO CIRÚRGICO PSEUDARTROSE/RETARDO CONSOLIDAÇÃO/PERDA ÓSSEA MÃO - R$ 450,00' },
    { procedureCode: '04.03.02.013-1', standardValue: 450.00, description: 'TRATAMENTO MICROCIRÚRGICO TUMOR NERVO PERIFÉRICO/NEUROMA - R$ 450,00' },
    { procedureCode: '04.08.06.031-0', standardValue: 450.00, description: 'RESSECÇÃO SIMPLES DE TUMOR ÓSSEO/PARTES MOLES - R$ 450,00' },
    { procedureCode: '04.08.02.061-0', standardValue: 450.00, description: 'TRATAMENTO CIRÚRGICO ROTURA/DESINSERÇÃO/ARRANCAMENTO CAPSULOTENO-LIGAMENTAR MÃO - R$ 450,00' },
    { procedureCode: '04.08.02.034-2', standardValue: 450.00, description: 'TRATAMENTO CIRÚRGICO FRATURA/LESÃO FISÁRIA FALANGES MÃO (COM FIXAÇÃO) - R$ 450,00' },
    { procedureCode: '04.08.06.048-4', standardValue: 450.00, description: 'TENORRAFIA ÚNICA EM TÚNEL OSTEO-FIBROSO - R$ 450,00' },
    { procedureCode: '04.08.02.014-8', standardValue: 450.00, description: 'RECONSTRUÇÃO POLIA TENDINOSA DOS DEDOS MÃO - R$ 450,00' },
    { procedureCode: '04.08.06.033-6', standardValue: 450.00, description: 'RETIRADA DE CORPO ESTRANHO INTRA-ÓSSEO - R$ 450,00' },
    { procedureCode: '04.08.02.030-0', standardValue: 450.00, description: 'TENOSINOVECTOMIA EM MEMBRO SUPERIOR - R$ 450,00' },
    { procedureCode: '04.08.05.008-0', standardValue: 450.00, description: 'FASCIOTOMIA DE MEMBROS INFERIORES - R$ 450,00' },
    { procedureCode: '04.08.06.007-7', standardValue: 450.00, description: 'ARTROPLASTIA DE RESSECÇÃO PEQUENAS ARTICULAÇÕES - R$ 450,00' },
    { procedureCode: '04.08.06.035-2', standardValue: 450.00, description: 'RETIRADA DE FIO OU PINO INTRA-ÓSSEO - R$ 450,00' },
    { procedureCode: '04.08.06.005-0', standardValue: 450.00, description: 'ARTRODESE DE PEQUENAS ARTICULAÇÕES - R$ 450,00' },
    { procedureCode: '04.08.06.042-5', standardValue: 450.00, description: 'REVISÃO CIRÚRGICA COTO AMPUTAÇÃO DOS DEDOS - R$ 450,00' },
    { procedureCode: '04.08.06.021-2', standardValue: 450.00, description: 'RESSECÇÃO DE CISTO SINOVIAL - R$ 450,00' }
  ]
};

// ================================================================
// REGRAS COMPARTILHADAS - ORTOPEDIA JOELHO/OMBRO FRG
// Utilizado por 4 ortopedistas (valor fixo + procedimentos)
// ================================================================
const ORTOPEDIA_JOELHO_OMBRO_FRG_RULES: Omit<DoctorPaymentRule, 'doctorName'> = {
  fixedPaymentRule: {
    amount: 450.00,
    description: 'Valor fixo por paciente: R$ 450,00 (independente do tipo de procedimento)'
  },
  rules: [
    { procedureCode: '04.08.05.089-6', standardValue: 750.00, secondaryValue: 300.00, description: 'TRATAMENTO CIRÚRGICO ROTURA MENISCO - Princ: R$ 750 | Seq: R$ 300' },
    { procedureCode: '04.08.05.088-8', standardValue: 750.00, description: 'TRATAMENTO CIRÚRGICO ROTURA MENISCO COM SUTURA - R$ 750,00' },
    { procedureCode: '04.08.05.016-0', standardValue: 900.00, description: 'RECONSTRUÇÃO LIGAMENTAR INTRA-ARTICULAR JOELHO - R$ 900,00' },
    { procedureCode: '04.08.05.015-2', standardValue: 500.00, description: 'RECONSTRUÇÃO LIGAMENTAR EXTRA-ARTICULAR JOELHO - R$ 500,00' },
    { procedureCode: '04.08.05.006-3', standardValue: 2000.00, description: 'ARTROPLASTIA TOTAL PRIMÁRIA DO JOELHO - R$ 2.000,00' },
    { procedureCode: '04.08.01.014-2', standardValue: 0, description: 'REPARO ROTURA MANGUITO ROTADOR - valor definido em regra múltipla' },
    { procedureCode: '04.08.06.071-9', standardValue: 0, description: 'VIDEOARTROSCOPIA - valor definido em regra múltipla' },
    { procedureCode: '04.08.01.021-5', standardValue: 0, description: 'TRATAMENTO CIRÚRGICO LUXAÇÃO RECIDIVANTE OMBRO - valor definido em regra múltipla' },
    { procedureCode: '04.08.06.053-0', standardValue: 0, description: 'TRANSPOSIÇÃO/TRANSFERÊNCIA MIOTENDINOSA - valor definido em regra múltipla' },
    { procedureCode: '04.08.06.046-8', standardValue: 0, description: 'TENOMIOTOMIA/DESINSERÇÃO - valor definido em regra múltipla' }
  ],
  multipleRules: [
    { codes: ['04.08.01.014-2', '04.08.06.071-9'], totalValue: 900.00, description: 'MANGUITO ROTADOR + VIDEOARTROSCOPIA - R$ 900,00' },
    { codes: ['04.08.01.021-5', '04.08.06.053-0', '04.08.06.046-8'], totalValue: 500.00, description: 'LUXAÇÃO RECIDIVANTE + TRANSPOSIÇÃO + TENOMIOTOMIA - R$ 500,00' }
  ]
};

// ================================================================
// EXPORTAR REGRAS PARA TODOS OS 32 MÉDICOS
// ================================================================
export const HOSPITAL_MATERNIDADE_FRG_RULES: HospitalRules = {
  // ================================================================
  // CIRURGIÕES GERAIS (4)
  // ================================================================
  'PEDRO ROGERIO DE SA NEVES': {
    doctorName: 'PEDRO ROGERIO DE SA NEVES',
    ...CIRURGIA_GERAL_FRG_RULES
  },
  'LEONARDO FLORES': {
    doctorName: 'LEONARDO FLORES',
    ...CIRURGIA_GERAL_FRG_RULES
  },
  'MARCELO GRACIA GUTIERREZ': {
    doctorName: 'MARCELO GRACIA GUTIERREZ',
    ...CIRURGIA_GERAL_FRG_RULES
  },
  'MATHEUS SOUZA DE AGUIAR': {
    doctorName: 'MATHEUS SOUZA DE AGUIAR',
    ...CIRURGIA_GERAL_FRG_RULES
  },

  // ================================================================
  // GINECOLOGISTAS (3)
  // ================================================================
  'INGRID BARRETO PINHEIRO': {
    doctorName: 'INGRID BARRETO PINHEIRO',
    ...GINECOLOGIA_FRG_RULES
  },
  'MARCELA REGINA DOMBROWSKI SEKIKAWA': {
    doctorName: 'MARCELA REGINA DOMBROWSKI SEKIKAWA',
    ...GINECOLOGIA_FRG_RULES
  },
  'MARIANA CAVALCANTI PEDROSA': {
    doctorName: 'MARIANA CAVALCANTI PEDROSA',
    ...GINECOLOGIA_FRG_RULES
  },

  // ================================================================
  // UROLOGISTAS (14)
  // ================================================================
  'CYRO CEZAR DE OLIVEIRA': {
    doctorName: 'CYRO CEZAR DE OLIVEIRA',
    ...UROLOGIA_FRG_RULES
  },
  'FERNANDO FOGLIATTO': {
    doctorName: 'FERNANDO FOGLIATTO',
    ...UROLOGIA_FRG_RULES
  },
  'CESAR AUGUSTO BROSKA JUNIOR': {
    doctorName: 'CESAR AUGUSTO BROSKA JUNIOR',
    ...UROLOGIA_FRG_RULES
  },
  'EDUARDO LOPES MARTINS FILHO': {
    doctorName: 'EDUARDO LOPES MARTINS FILHO',
    ...UROLOGIA_FRG_RULES
  },
  'GABRIEL AUGUSTO DE LIMA MORTEAN': {
    doctorName: 'GABRIEL AUGUSTO DE LIMA MORTEAN',
    ...UROLOGIA_FRG_RULES
  },
  'JOAO MARCUS KALIL THEZOLIN': {
    doctorName: 'JOAO MARCUS KALIL THEZOLIN',
    ...UROLOGIA_FRG_RULES
  },
  'JORIDES ZORATTO NETO': {
    doctorName: 'JORIDES ZORATTO NETO',
    ...UROLOGIA_FRG_RULES
  },
  'JUAN EDUARDO RIOS RODRIGUEZ': {
    doctorName: 'JUAN EDUARDO RIOS RODRIGUEZ',
    ...UROLOGIA_FRG_RULES
  },
  'KATHIUCIA DANIELLE YAMASHITA': {
    doctorName: 'KATHIUCIA DANIELLE YAMASHITA',
    ...UROLOGIA_FRG_RULES
  },
  'LUCAS VICENTE ANDRADE': {
    doctorName: 'LUCAS VICENTE ANDRADE',
    ...UROLOGIA_FRG_RULES
  },
  'RAFAEL GUSTAVO PUCHETA BOCCIA': {
    doctorName: 'RAFAEL GUSTAVO PUCHETA BOCCIA',
    ...UROLOGIA_FRG_RULES
  },
  'VINICIUS DALLEDONE BITTAR': {
    doctorName: 'VINICIUS DALLEDONE BITTAR',
    ...UROLOGIA_FRG_RULES
  },
  'GUSTAVO BONO YOSHIKAWA': {
    doctorName: 'GUSTAVO BONO YOSHIKAWA',
    ...UROLOGIA_FRG_RULES
  },
  'MATHIAS BURIN GROHE': {
    doctorName: 'MATHIAS BURIN GROHE',
    ...UROLOGIA_FRG_RULES
  },

  // ================================================================
  // CIRURGIÕES VASCULARES (2)
  // ================================================================
  'RODRIGO GARCIA BRANCO': {
    doctorName: 'RODRIGO GARCIA BRANCO',
    ...CIRURGIA_VASCULAR_FRG_RULES
  },
  'NATHALIA LESLIE ALBANEZ DE SOUZA SIQUEIRA': {
    doctorName: 'NATHALIA LESLIE ALBANEZ DE SOUZA SIQUEIRA',
    ...CIRURGIA_VASCULAR_FRG_RULES
  },

  // ================================================================
  // ORTOPEDISTAS - QUADRIL (3)
  // ================================================================
  'BARBARA SAVARIS QUIOCA': {
    doctorName: 'BARBARA SAVARIS QUIOCA',
    ...ORTOPEDIA_QUADRIL_FRG_RULES
  },
  'RICARDO LERMEN FAGUNDES': {
    doctorName: 'RICARDO LERMEN FAGUNDES',
    ...ORTOPEDIA_QUADRIL_FRG_RULES
  },
  'VICTOR HUGO LUZ SENDODA': {
    doctorName: 'VICTOR HUGO LUZ SENDODA',
    ...ORTOPEDIA_QUADRIL_FRG_RULES
  },

  // ================================================================
  // ORTOPEDISTA - JOELHO (1)
  // ================================================================
  'THADEU TIESSI SUZUKI': {
    doctorName: 'THADEU TIESSI SUZUKI',
    ...ORTOPEDIA_JOELHO_FRG_RULES
  },

  // ================================================================
  // ORTOPEDISTA - MÃO/PUNHO (1)
  // ================================================================
  'RAFAEL LUCENA BASTOS': {
    doctorName: 'RAFAEL LUCENA BASTOS',
    ...ORTOPEDIA_MAO_FRG_RULES
  },

  // ================================================================
  // ORTOPEDISTAS - JOELHO/OMBRO (4)
  // Com valor fixo + procedimentos específicos
  // ================================================================
  'BRUNO ROBERTO KAJIMOTO DELLAROSA': {
    doctorName: 'BRUNO ROBERTO KAJIMOTO DELLAROSA',
    ...ORTOPEDIA_JOELHO_OMBRO_FRG_RULES
  },
  'EDUARDO PELLEGRINO DA ROCHA ROSSI': {
    doctorName: 'EDUARDO PELLEGRINO DA ROCHA ROSSI',
    ...ORTOPEDIA_JOELHO_OMBRO_FRG_RULES
  },
  'EIJI RAFAEL NAKAHASHI': {
    doctorName: 'EIJI RAFAEL NAKAHASHI',
    ...ORTOPEDIA_JOELHO_OMBRO_FRG_RULES
  },
  'IGOR HENRIQUE MORAIS': {
    doctorName: 'IGOR HENRIQUE MORAIS',
    ...ORTOPEDIA_JOELHO_OMBRO_FRG_RULES
  }
};

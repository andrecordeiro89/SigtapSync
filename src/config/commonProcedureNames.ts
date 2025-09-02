// Regras de "Nomes Comuns" para procedimentos SUS
// Estrutura flexível para suportar correspondência por qualquer código (anyOf)
// e por combinações exatas (allOf), na ordem de prioridade declarada

export type CommonNameRule = {
	label: string; // Rótulo exibido no card do paciente (ex.: "A+A")
	anyOf?: string[]; // Se qualquer um dos códigos aparecer, aplica o Nome Comum
	allOf?: string[]; // Se todos os códigos aparecerem (conjunto), aplica o Nome Comum
	// Opcional: restringe a aplicação da regra a uma ou mais especialidades médicas
	// A comparação é case-insensitive por igualdade simples
	specialties?: string[];
	// Opcional: exige que o procedimento principal/primeiro pertença a um conjunto
	// "Principal" = sequence === 1; se indisponível, usa o mais antigo por data
	primaryAnyOf?: string[];
	// Opcional: exige exclusividade entre os procedimentos médicos "04".
	// Se definido, todos os códigos iniciados por '04' do paciente devem pertencer a este conjunto.
	allowedOnlyWithinMedical04Codes?: string[];
};

// Regras iniciais (exemplo do usuário):
//  - A+A quando houver Amigdalectomia c/ Adenoidectomia OU Turbinectomia
//    04.04.01.003-2 (AMIGDALECTOMIA COM ADENOIDECTOMIA)
//    04.04.01.041-5 (TURBINECTOMIA)
export const COMMON_PROCEDURE_NAME_RULES: CommonNameRule[] = [
	{
		label: "A+A",
		anyOf: [
			"04.04.01.003-2",
			"04.04.01.041-5"
		],
		// Restringir a Otorrinolaringologia (e alias comum)
		specialties: ["Otorrinolaringologia", "Otorrino"]
	},
	// 🆕 APENDICECTOMIA — Cirurgia Geral
	{
		label: "APENDICECTOMIA",
		primaryAnyOf: [
			"04.07.02.003-9", // APENDICECTOMIA
			"04.07.04.018-8"  // LIBERAÇÃO DE ADERÊNCIAS INTESTINAIS
		],
		anyOf: [
			"04.07.02.003-9",
			"04.07.02.009-8",
			"04.07.02.020-9",
			"04.07.04.001-3",
			"04.07.04.018-8"
		],
		// Exclusividade: entre procedimentos médicos (04.*) só podem existir estes códigos
		allowedOnlyWithinMedical04Codes: [
			"04.07.02.003-9",
			"04.07.02.009-8",
			"04.07.02.020-9",
			"04.07.04.001-3",
			"04.07.04.018-8"
		],
		specialties: ["Cirurgia Geral", "Cirurgião Geral"]
	},
	// 🆕 CISTO SINOVIAL DE MÃO — Ortopedia/Cirurgia da Mão (sem restringir especialidade por enquanto)
	{
		label: "CISTO SINOVIAL DE MÃO",
		primaryAnyOf: [
			"04.08.06.021-2" // RESSECÇÃO DE CISTO SINOVIAL
		],
		anyOf: [
			"04.08.02.030-0", // TENOSINOVECTOMIA EM MEMBRO SUPERIOR
			"04.08.06.021-2", // RESSECÇÃO DE CISTO SINOVIAL
			"04.08.06.044-1"  // TENÓLISE
		],
		allowedOnlyWithinMedical04Codes: [
			"04.08.02.030-0",
			"04.08.06.021-2",
			"04.08.06.044-1"
		],
		specialties: [
			"Ortopedia",
			"Traumatologia",
			"Ortopedia e Traumatologia",
			"Ortopedista"
		]
	},
	// 🆕 CISTOLITOTOMIA CONVENCIONAL — Urologia
	{
		label: "CISTOLITOTOMIA CONVENCIONAL",
		primaryAnyOf: [
			"04.09.01.006-5" // CISTOLITOTOMIA E/OU RETIRADA DE CORPO ESTRANHO DA BEXIGA
		],
		anyOf: [
			"04.09.01.006-5",
			"04.09.02.007-9"  // MEATOTOMIA SIMPLES
		],
		allowedOnlyWithinMedical04Codes: [
			"04.09.01.006-5",
			"04.09.02.007-9"
		],
		specialties: ["Urologia", "Urologista"]
	},
	// 🆕 CISTOLITOTOMIA ENDOSCÓPICA — Urologia
	{
		label: "CISTOLITOTOMIA ENDOSCÓPICA",
		primaryAnyOf: [
			"04.09.01.018-9" // LITOTRIPSIA
		],
		anyOf: [
			"04.09.01.018-9", // LITOTRIPSIA
			"04.09.02.017-6"  // URETROTOMIA INTERNA
		],
		allowedOnlyWithinMedical04Codes: [
			"04.09.01.018-9",
			"04.09.02.017-6"
		],
		specialties: ["Urologia", "Urologista"]
	},
	// 🆕 CISTOSTOMIA — Urologia
	{
		label: "CISTOSTOMIA",
		primaryAnyOf: [
			"04.09.01.009-0" // CISTOSTOMIA
		],
		anyOf: [
			"04.09.01.009-0"
		],
		allowedOnlyWithinMedical04Codes: [
			"04.09.01.009-0"
		],
		specialties: ["Urologia", "Urologista"]
	},
	// 🆕 CURETAGEM UTERINA — Ginecologia
	{
		label: "CURETAGEM UTERINA",
		primaryAnyOf: [
			"04.09.06.004-6", // CURETAGEM SEMIÓTICA c/ ou s/ dilatação
			"04.11.02.001-3"  // CURETAGEM PÓS-ABORTAMENTO / PUERPERAL
		],
		anyOf: [
			"04.09.06.004-6",
			"04.11.02.001-3"
		],
		allowedOnlyWithinMedical04Codes: [
			"04.09.06.004-6",
			"04.11.02.001-3"
		],
		specialties: [
			"Ginecologia e Obstetrícia",
			"Ginecologia",
			"Obstetrícia",
			"Ginecologista"
		]
	},
	// 🆕 DEDO EM GATILHO — Ortopedia e Traumatologia
	{
		label: "DEDO EM GATILHO",
		primaryAnyOf: [
			"04.08.02.032-6" // TRATAMENTO CIRÚRGICO DE DEDO EM GATILHO
		],
		anyOf: [
			"04.08.02.032-6",
			"04.08.06.044-1"  // TENÓLISE
		],
		allowedOnlyWithinMedical04Codes: [
			"04.08.02.032-6",
			"04.08.06.044-1"
		],
		specialties: [
			"Ortopedia",
			"Traumatologia",
			"Ortopedia e Traumatologia",
			"Ortopedista"
		]
	},
	// 🆕 COLECISTECTOMIA ABERTA — Cirurgia Geral
	{
		label: "COLECISTECTOMIA ABERTA",
		primaryAnyOf: [
			"04.07.03.002-6" // COLECISTECTOMIA
		],
		anyOf: [
			"04.07.03.002-6", // COLECISTECTOMIA
			"04.07.03.014-0", // HEPATORRAFIA
			"04.07.04.002-1", // DRENAGEM DE ABSCESSO SUBFRÊNICO
			"04.07.04.018-8", // LIBERAÇÃO DE ADERÊNCIAS INTESTINAIS
			"04.07.04.023-4"  // RESSECÇÃO DO EPIPLOM
		],
		allowedOnlyWithinMedical04Codes: [
			"04.07.03.002-6",
			"04.07.03.014-0",
			"04.07.04.002-1",
			"04.07.04.018-8",
			"04.07.04.023-4"
		],
		specialties: ["Cirurgia Geral", "Cirurgião Geral"]
	},
	// 🆕 DUPLO J (COLOCAÇÃO) — Urologia
	{
		label: "DUPLO J (COLOCAÇÃO)",
		primaryAnyOf: [
			"04.09.01.017-0" // INSTALAÇÃO ENDOSCÓPICA DE CATETER DUPLO J
		],
		anyOf: [
			"04.09.01.013-8", // DRENAGEM DE ABSCESSO RENAL / PERI-RENAL
			"04.09.01.017-0"  // INSTALAÇÃO ENDOSCÓPICA DE CATETER DUPLO J
		],
		allowedOnlyWithinMedical04Codes: [
			"04.09.01.013-8",
			"04.09.01.017-0"
		],
		specialties: ["Urologia", "Urologista"]
	},
	// 🆕 FRATURA DE COTOVELO — Ortopedia e Traumatologia
	{
		label: "FRATURA DE COTOVELO",
		primaryAnyOf: [
			"04.08.02.036-9" // TRATAMENTO CIRÚRGICO DE FRATURA DO CÔNDILO/TRÓCLEA/etc.
		],
		anyOf: [
			"04.08.02.036-9"
		],
		allowedOnlyWithinMedical04Codes: [
			"04.08.02.036-9"
		],
		specialties: [
			"Ortopedia",
			"Traumatologia",
			"Ortopedia e Traumatologia",
			"Ortopedista"
		]
	},
	// 🆕 FRATURA DE MEMBROS INFERIORES — Ortopedia e Traumatologia
	{
		label: "FRATURA DE MEMBROS INFERIORES",
		primaryAnyOf: [
			"04.08.05.022-5" // REDUCAO INCRUENTA DE FRATURA DIAFISARIA/LESÃO FISÁRIA DISTAL DA TÍBIA c/ ou s/ fratura da fíbula
		],
		anyOf: [
			"04.08.05.022-5"
		],
		allowedOnlyWithinMedical04Codes: [
			"04.08.05.022-5"
		],
		specialties: [
			"Ortopedia",
			"Traumatologia",
			"Ortopedia e Traumatologia",
			"Ortopedista"
		]
	},
	// 🆕 FRATURA DE OSSOS DA MÃO — Ortopedia e Traumatologia
	{
		label: "FRATURA DE OSSOS DA MÃO",
		primaryAnyOf: [
			"04.08.02.021-0", // REDUÇÃO INCRUENTA DE FRATURA DOS METACARPIANOS
			"04.08.02.034-2", // TRATAMENTO CIRÚRGICO DE FRATURA DAS FALANGES DA MÃO (com fixação)
			"04.08.02.037-7"  // TRATAMENTO CIRÚRGICO DE FRATURA DOS METACARPIANOS
		],
		anyOf: [
			"04.08.02.021-0",
			"04.08.02.034-2",
			"04.08.02.037-7"
		],
		allowedOnlyWithinMedical04Codes: [
			"04.08.02.021-0",
			"04.08.02.034-2",
			"04.08.02.037-7"
		],
		specialties: [
			"Ortopedia",
			"Traumatologia",
			"Ortopedia e Traumatologia",
			"Ortopedista"
		]
	},
	// 🆕 FRATURA DE OSSOS DO ANTEBRAÇO — Ortopedia e Traumatologia
	{
		label: "FRATURA DE OSSOS DO ANTEBRAÇO",
		primaryAnyOf: [
			"04.08.02.017-2", // REDUÇÃO INCRUENTA DE FRATURA / LESÃO FISÁRIA NO PUNHO
			"04.08.02.020-2", // REDUÇÃO INCRUENTA DE FRATURA DIAFISÁRIA DOS OSSOS DO ANTEBRAÇO
			"04.08.02.040-7"  // TRATAMENTO CIRÚRGICO DE FRATURA DISTAL DOS OSSOS DO ANTEBRAÇO
		],
		anyOf: [
			"04.08.02.017-2",
			"04.08.02.020-2",
			"04.08.02.040-7"
		],
		allowedOnlyWithinMedical04Codes: [
			"04.08.02.017-2",
			"04.08.02.020-2",
			"04.08.02.040-7"
		],
		specialties: [
			"Ortopedia",
			"Traumatologia",
			"Ortopedia e Traumatologia",
			"Ortopedista"
		]
	},
	// 🆕 FRATURA DE TORNOZELO — Ortopedia e Traumatologia
	{
		label: "FRATURA DE TORNOZELO",
		primaryAnyOf: [
			"04.08.05.049-7", // TRATAMENTO CIRÚRGICO DE FRATURA BIMALEOLAR/TRIMALEOLAR/FRATURALUXAÇÃO DO TORNOZELO
			"04.08.05.057-8"  // TRATAMENTO CIRÚRGICO DE FRATURA DO TORNOZELO UNIMALEOLAR
		],
		anyOf: [
			"04.08.05.049-7",
			"04.08.05.057-8"
		],
		allowedOnlyWithinMedical04Codes: [
			"04.08.05.049-7",
			"04.08.05.057-8"
		],
		specialties: [
			"Ortopedia",
			"Traumatologia",
			"Ortopedia e Traumatologia",
			"Ortopedista"
		]
	},
	// 🆕 GERAL OUTRAS — Cirurgia Geral
	{
		label: "GERAL OUTRAS",
		primaryAnyOf: [
			"04.01.02.007-0", // EXÉRESE DE CISTO DERMOIDE
			"04.01.02.010-0", // EXTIRPAÇÃO/SUPRESSÃO DE LESÃO DE PELE E TCS
			"04.07.02.017-9", // ENTERECTOMIA
			"04.07.02.018-7", // ENTEROANASTOMOSE (QUALQUER SEGMENTO)
			"04.07.04.006-4", // HERNIOPLASTIA EPIGÁSTRICA
			"04.07.04.018-8", // LIBERAÇÃO DE ADERÊNCIAS INTESTINAIS
			"04.07.04.023-4", // RESSECÇÃO DO EPIPLON
			"04.08.06.031-0", // RESSECÇÃO SIMPLES DE TUMOR ÓSSEO/PARTES MOLES
			"04.09.06.021-6"  // OOFORECTOMIA/OOFOROPLASTIA
		],
		anyOf: [
			"04.01.02.007-0",
			"04.01.02.010-0",
			"04.07.02.017-9",
			"04.07.02.018-7",
			"04.07.04.006-4",
			"04.07.04.018-8",
			"04.07.04.023-4",
			"04.08.06.031-0",
			"04.09.06.021-6"
		],
		allowedOnlyWithinMedical04Codes: [
			"04.01.02.007-0",
			"04.01.02.010-0",
			"04.07.02.017-9",
			"04.07.02.018-7",
			"04.07.04.006-4",
			"04.07.04.018-8",
			"04.07.04.023-4",
			"04.08.06.031-0",
			"04.09.06.021-6"
		],
		specialties: ["Cirurgia Geral", "Cirurgião Geral"]
	},
	// 🆕 GINECOLOGIA OUTRAS — Ginecologia
	{
		label: "GINECOLOGIA OUTRAS",
		primaryAnyOf: [
			"04.07.04.003-0", // DRENAGEM DE HEMATOMA/ABSCESSO PRÉ-PERITONEAL
			"04.07.04.018-8", // LIBERAÇÃO DE ADERÊNCIAS INTESTINAIS
			"04.09.06.021-6", // OOFORECTOMIA/OOFOROPLASTIA
			"04.09.06.023-2", // SALPINGECTOMIA UNI/BILATERAL
			"04.09.07.005-0", // COLPOPERINEOPLASTIA ANTERIOR E POSTERIOR
			"04.09.07.009-2", // COLPORRAFIA NÃO OBSTÉTRICA
			"04.09.07.015-7", // EXÉRESE DE GLÂNDULA DE BARTHOLIN/SKENE
			"04.09.07.026-2", // TRATAMENTO CIRÚRGICO DE HIPERTROFIA DOS PEQUENOS LÁBIOS
			"04.10.01.001-4", // DRENAGEM DE ABSCESSO DE MAMA
			"04.11.01.007-7", // SUTURA DE LACERAÇÕES DE TRAJETO PÉLVICO
			"04.11.02.004-8"  // TRATAMENTO CIRÚRGICO DE GRAVIDEZ ECTÓPICA
		],
		anyOf: [
			"04.07.04.003-0",
			"04.07.04.018-8",
			"04.09.06.021-6",
			"04.09.06.023-2",
			"04.09.07.005-0",
			"04.09.07.009-2",
			"04.09.07.015-7",
			"04.09.07.026-2",
			"04.10.01.001-4",
			"04.11.01.007-7",
			"04.11.02.004-8"
		],
		allowedOnlyWithinMedical04Codes: [
			"04.07.04.003-0",
			"04.07.04.018-8",
			"04.09.06.021-6",
			"04.09.06.023-2",
			"04.09.07.005-0",
			"04.09.07.009-2",
			"04.09.07.015-7",
			"04.09.07.026-2",
			"04.10.01.001-4",
			"04.11.01.007-7",
			"04.11.02.004-8"
		],
		specialties: [
			"Ginecologia e Obstetrícia",
			"Ginecologia",
			"Obstetrícia",
			"Ginecologista"
		]
	},
	// 🆕 HEMORROIDECTOMIA — Cirurgia Geral
	{
		label: "HEMORROIDECTOMIA",
		primaryAnyOf: [
			"04.07.02.028-4" // HEMORROIDECTOMIA
		],
		anyOf: [
			"04.07.02.022-5", // EXCISÃO DE LESÃO/TUMOR ANU-RETAL
			"04.07.02.027-6", // FISTULECTOMIA/FISTULOTOMIA ANAL
			"04.07.02.028-4"  // HEMORROIDECTOMIA
		],
		allowedOnlyWithinMedical04Codes: [
			"04.07.02.022-5",
			"04.07.02.027-6",
			"04.07.02.028-4"
		],
		specialties: ["Cirurgia Geral", "Cirurgião Geral"]
	},
	// 🆕 HERNIOPLASTIA INGUINAL UNI — Cirurgia Geral
	{
		label: "HERNIOPLASTIA INGUINAL UNI",
		primaryAnyOf: [
			"04.07.04.010-2" // HERNIOPLASTIA INGUINAL/CRURAL (UNILATERAL)
		],
		anyOf: [
			"04.07.02.017-9", // ENTERECTOMIA
			"04.07.02.018-7", // ENTEROANASTOMOSE (QUALQUER SEGMENTO)
			"04.07.04.010-2", // HERNIOPLASTIA INGUINAL/CRURAL (UNILATERAL)
			"04.07.04.018-8", // LIBERAÇÃO DE ADERÊNCIAS INTESTINAIS
			"04.07.04.023-4", // RESSECÇÃO DO EPIPLOM
			"04.09.04.008-8"  // EXÉRESE DE LESÃO DO CORDÃO ESPERMÁTICO
		],
		allowedOnlyWithinMedical04Codes: [
			"04.07.02.017-9",
			"04.07.02.018-7",
			"04.07.04.010-2",
			"04.07.04.018-8",
			"04.07.04.023-4",
			"04.09.04.008-8"
		],
		specialties: ["Cirurgia Geral", "Cirurgião Geral"]
	},
	// 🆕 FISTULECTOMIA PERIANAL — Cirurgia Geral
	{
		label: "FISTULECTOMIA PERIANAL",
		primaryAnyOf: [
			"04.07.02.027-6" // FISTULECTOMIA/FISTULOTOMIA ANAL
		],
		anyOf: [
			"04.07.02.027-6"
		],
		allowedOnlyWithinMedical04Codes: [
			"04.07.02.027-6"
		],
		specialties: ["Cirurgia Geral", "Cirurgião Geral"]
	},
	// 🆕 HERNIOPLASTIA INICISIONAL — Cirurgia Geral
	{
		label: "HERNIOPLASTIA INICISIONAL",
		primaryAnyOf: [
			"04.07.04.008-0" // HERNIOPLASTIA INCISIONAL
		],
		anyOf: [
			"04.07.02.020-9", // ENTEROTOMIA/ENTERORRAFIA c/ sutura/ressecção
			"04.07.04.008-0", // HERNIOPLASTIA INCISIONAL
			"04.07.04.018-8", // LIBERAÇÃO DE ADERÊNCIAS INTESTINAIS
			"04.07.04.023-4"  // RESSECÇÃO DO EPIPLOM
		],
		allowedOnlyWithinMedical04Codes: [
			"04.07.02.020-9",
			"04.07.04.008-0",
			"04.07.04.018-8",
			"04.07.04.023-4"
		],
		specialties: ["Cirurgia Geral", "Cirurgião Geral"]
	},
	// 🆕 HERNIOPLASTIA UMBILICAL — Cirurgia Geral
	{
		label: "HERNIOPLASTIA UMBILICAL",
		primaryAnyOf: [
			"04.07.04.012-9" // HERNIOPLASTIA UMBILICAL
		],
		anyOf: [
			"04.07.04.012-9",
			"04.07.04.018-8",
			"04.07.04.023-4"
		],
		allowedOnlyWithinMedical04Codes: [
			"04.07.04.012-9",
			"04.07.04.018-8",
			"04.07.04.023-4"
		],
		specialties: ["Cirurgia Geral", "Cirurgião Geral"]
	},
	// 🆕 HIDROCELE — Urologia
	{
		label: "HIDROCELE",
		primaryAnyOf: [
			"04.09.04.021-5" // TRATAMENTO CIRÚRGICO DE HIDROCELE
		],
		anyOf: [
			"04.09.04.009-6", // EXPLORAÇÃO CIRÚRGICA DA BOLSA ESCROTAL
			"04.09.04.012-6", // ORQUIDOPEXIA BILATERAL
			"04.09.04.013-4", // ORQUIDOPEXIA UNILATERAL
			"04.09.04.017-7", // PLÁSTICA DA BOLSA ESCROTAL
			"04.09.04.019-3", // RESSECÇÃO PARCIAL DA BOLSA ESCROTAL
			"04.09.04.021-5"  // TRATAMENTO CIRÚRGICO DE HIDROCELE
		],
		allowedOnlyWithinMedical04Codes: [
			"04.09.04.009-6",
			"04.09.04.012-6",
			"04.09.04.013-4",
			"04.09.04.017-7",
			"04.09.04.019-3",
			"04.09.04.021-5"
		],
		specialties: ["Urologia", "Urologista"]
	},
	// 🆕 HISTERECTOMIA — Ginecologia
	{
		label: "HISTERECTOMIA",
		primaryAnyOf: [
			"04.09.06.010-0", // HISTERECTOMIA (POR VIA VAGINAL)
			"04.09.06.012-7", // HISTERECTOMIA SUBTOTAL
			"04.09.06.013-5"  // HISTERECTOMIA TOTAL
		],
		anyOf: [
			"04.07.04.018-8", // LIBERAÇÃO DE ADERÊNCIAS INTESTINAIS
			"04.09.06.010-0", // HISTERECTOMIA (POR VIA VAGINAL)
			"04.09.06.012-7", // HISTERECTOMIA SUBTOTAL
			"04.09.06.013-5", // HISTERECTOMIA TOTAL
			"04.09.06.021-6", // OOFORECTOMIA/OOFOROPLASTIA
			"04.09.06.023-2", // SALPINGECTOMIA UNI/BILATERAL
			"04.09.07.005-0", // COLPOPERINEOPLASTIA ANTERIOR E POSTERIOR
			"04.09.07.027-0"  // TRATAMENTO CIRÚRGICO DE INCONTINÊNCIA URINÁRIA POR VIA VAGINAL
		],
		allowedOnlyWithinMedical04Codes: [
			"04.07.04.018-8",
			"04.09.06.010-0",
			"04.09.06.012-7",
			"04.09.06.013-5",
			"04.09.06.021-6",
			"04.09.06.023-2",
			"04.09.07.005-0",
			"04.09.07.027-0"
		],
		specialties: [
			"Ginecologia e Obstetrícia",
			"Ginecologia",
			"Obstetrícia",
			"Ginecologista"
		]
	}
	// Adicione novas regras aqui, respeitando a ordem de prioridade
];



// Regras personalizadas de "Nomes Comuns" para procedimentos SUS
// Adicione novas regras ao array abaixo. Elas terão prioridade sobre as regras padrão.

import type { CommonNameRule } from "./commonProcedureNames";

export const CUSTOM_COMMON_PROCEDURE_NAME_RULES: CommonNameRule[] = [
  {
    label: "TENOPLASTIA",
    anyOf: ["04.08.06.047-6"]
  },
  {
    label: "TÚNEL DO CARPO",
    anyOf: ["04.03.02.012-3"]
  },
  {
    label: "ADENOIDECTOMIA",
    anyOf: ["04.04.01.001-6"],
    specialties: ["Otorrinolaringologia", "Otorrino"]
  },
  {
    label: "VARIZES UNILATERAL",
    anyOf: ["04.06.02.057-4"]
  },
  {
    label: "ARTRODESE DE PEQUENAS ARTICULAÇÕES",
    anyOf: ["04.08.06.005-0"],
    specialties: [
      "Ortopedia",
      "Traumatologia",
      "Ortopedia e Traumatologia",
      "Ortopedista"
    ]
  },
  {
    label: "HISTERECTOMIA",
    anyOf: ["04.09.06.011-9"],
    specialties: [
      "Ginecologia e Obstetrícia",
      "Ginecologia",
      "Obstetrícia",
      "Ginecologista"
    ]
  }
];



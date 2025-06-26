// Dados reais dos hospitais CIS - Centro Integrado em Saúde LTDA

export interface RealHospital {
  name: string;
  cnpj: string;
  type: 'matriz' | 'filial' | 'sede_administrativa';
  address: string;
  city: string;
  state: string;
  zip_code: string;
  phone?: string;
  email?: string;
  habilitacoes: string[];
  specialty?: string;
  is_active: boolean;
}

export const CIS_HOSPITALS: RealHospital[] = [
  // MATRIZ
  {
    name: 'CIS - Centro Integrado em Saúde LTDA',
    cnpj: '14736446000193',
    type: 'matriz',
    address: 'Rua Manoel da Silva Machado, 554 - Centro',
    city: 'Santa Mariana',
    state: 'PR',
    zip_code: '86350000',
    phone: '43999000001',
    email: 'matriz@cis.com.br',
    habilitacoes: ['MAC', 'GESTAO', 'ADMINISTRACAO'],
    specialty: 'Gestão e Administração',
    is_active: true
  },

  // FILIAL - HOSPITAL MUNICIPAL SANTA ALICE
  {
    name: 'Hospital Municipal Santa Alice',
    cnpj: '14736446000165', // Corrigido: 001-65 → 0001-65
    type: 'filial',
    address: 'Rua Joaquim Tavora, 2089 - Parque São Paulo',
    city: 'Cascavel',
    state: 'PR',
    zip_code: '85803750',
    phone: '45999000002',
    email: 'santaalice@cis.com.br',
    habilitacoes: ['MAC', 'URGENCIA', 'INTERNACAO', 'CIRURGIA'],
    specialty: 'Hospital Geral Municipal',
    is_active: true
  },

  // FILIAL - SEDE ADMINISTRATIVA LONDRINA
  {
    name: 'CIS - Sede Administrativa Londrina',
    cnpj: '14736446000517',
    type: 'sede_administrativa',
    address: 'Av Ayrton Senna da Silva, 830, sala 301 - Gleba Fazenda Palhano',
    city: 'Londrina',
    state: 'PR',
    zip_code: '86050460',
    phone: '43999000003',
    email: 'londrina@cis.com.br',
    habilitacoes: ['GESTAO', 'ADMINISTRACAO'],
    specialty: 'Sede Administrativa Regional',
    is_active: true
  },

  // FILIAL - HOSPITAL MUNICIPAL JUAREZ BARRETO DE MACEDO
  {
    name: 'Hospital Municipal Juarez Barreto de Macedo',
    cnpj: '14736446000606',
    type: 'filial',
    address: 'Rua Ismael Pinto Siqueira, 1760 - Centro',
    city: 'Faxinal',
    state: 'PR',
    zip_code: '86840000',
    phone: '43999000004',
    email: 'faxinal@cis.com.br',
    habilitacoes: ['MAC', 'ATENCAO_BASICA', 'URGENCIA'],
    specialty: 'Hospital Municipal',
    is_active: true
  },

  // FILIAL - HOSPITAL MUNICIPAL SÃO JOSÉ
  {
    name: 'Hospital Municipal São José',
    cnpj: '14736446000789',
    type: 'filial',
    address: 'Rua Capitão Estácio, 460 - Centro',
    city: 'Carlópolis',
    state: 'PR',
    zip_code: '86420000',
    phone: '43999000005',
    email: 'carlopolis@cis.com.br',
    habilitacoes: ['MAC', 'ATENCAO_BASICA', 'URGENCIA'],
    specialty: 'Hospital Municipal',
    is_active: true
  },

  // FILIAL - HOSPITAL MUNICIPAL 18 DE DEZEMBRO
  {
    name: 'Hospital Municipal 18 de Dezembro',
    cnpj: '14736446000860',
    type: 'filial',
    address: 'Rua Saladino de Castro, 1575 - Centro',
    city: 'Arapoti',
    state: 'PR',
    zip_code: '84990000',
    phone: '42999000006',
    email: 'arapoti@cis.com.br',
    habilitacoes: ['MAC', 'ATENCAO_BASICA', 'URGENCIA'],
    specialty: 'Hospital Municipal',
    is_active: true
  },

  // FILIAL - HOSPITAL NOSSA SENHORA APARECIDA (FOZ DO IGUAÇU)
  {
    name: 'Hospital Nossa Senhora Aparecida',
    cnpj: '14736446000940',
    type: 'filial',
    address: 'Av. Morenitas, 2195 - Porto Meira',
    city: 'Foz do Iguaçu',
    state: 'PR',
    zip_code: '85855190',
    phone: '45999000007',
    email: 'foziguacu@cis.com.br',
    habilitacoes: ['MAC', 'URGENCIA', 'INTERNACAO', 'MATERNIDADE'],
    specialty: 'Hospital Geral com Maternidade',
    is_active: true
  },

  // FILIAL - HOSPITAL MATERNIDADE NOSSA SENHORA APARECIDA
  {
    name: 'Hospital Maternidade Nossa Senhora Aparecida',
    cnpj: '14736446001084',
    type: 'filial',
    address: 'Rua Francisco Claudino dos Santos, 490 - Iguaçu',
    city: 'Fazenda Rio Grande',
    state: 'PR',
    zip_code: '83833072',
    phone: '41999000008',
    email: 'fazendriogrande@cis.com.br',
    habilitacoes: ['MAC', 'MATERNIDADE', 'GINECOLOGIA', 'OBSTETRICIA', 'PEDIATRIA'],
    specialty: 'Hospital Maternidade Especializado',
    is_active: true
  }
];

// Estatísticas da rede CIS
export const CIS_STATS = {
  totalHospitals: CIS_HOSPITALS.length,
  totalCities: [...new Set(CIS_HOSPITALS.map(h => h.city))].length,
  totalSpecialties: [...new Set(CIS_HOSPITALS.map(h => h.specialty))].length,
  coverage: 'Paraná - Região Norte, Oeste e Metropolitana'
};

// Helper para buscar hospitais por tipo
export const getHospitalsByType = (type: 'matriz' | 'filial' | 'sede_administrativa') => {
  return CIS_HOSPITALS.filter(h => h.type === type);
};

// Helper para buscar hospital por cidade
export const getHospitalByCity = (city: string) => {
  return CIS_HOSPITALS.find(h => h.city.toLowerCase() === city.toLowerCase());
};

// Helper para buscar hospitais por habilitação
export const getHospitalsByHabilitacao = (habilitacao: string) => {
  return CIS_HOSPITALS.filter(h => h.habilitacoes.includes(habilitacao));
}; 
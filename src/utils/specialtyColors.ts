/**
 * 🎨 SISTEMA DE CORES PARA BADGES
 * Mapeamento de cores para especialidades médicas e tipos de hospital
 */

// Cores para especialidades médicas
export const SPECIALTY_COLORS: Record<string, string> = {
  // Especialidades Clínicas - Tons de Azul
  'Cardiologia': 'bg-red-100 text-red-800 border-red-200',
  'Neurologia': 'bg-blue-100 text-blue-800 border-blue-200',
  'Endocrinologia': 'bg-purple-100 text-purple-800 border-purple-200',
  'Gastroenterologia': 'bg-green-100 text-green-800 border-green-200',
  'Pneumologia': 'bg-cyan-100 text-cyan-800 border-cyan-200',
  'Nefrologia': 'bg-indigo-100 text-indigo-800 border-indigo-200',
  'Reumatologia': 'bg-pink-100 text-pink-800 border-pink-200',
  'Hematologia': 'bg-rose-100 text-rose-800 border-rose-200',
  'Oncologia': 'bg-gray-100 text-gray-800 border-gray-200',
  'Infectologia': 'bg-yellow-100 text-yellow-800 border-yellow-200',
  
  // Especialidades Cirúrgicas - Tons de Verde
  'Cirurgia Geral': 'bg-emerald-100 text-emerald-800 border-emerald-200',
  'Cirurgia Cardíaca': 'bg-red-200 text-red-900 border-red-300',
  'Cirurgia Vascular': 'bg-orange-100 text-orange-800 border-orange-200',
  'Neurocirurgia': 'bg-blue-200 text-blue-900 border-blue-300',
  'Ortopedia': 'bg-green-200 text-green-900 border-green-300',
  'Urologia': 'bg-teal-100 text-teal-800 border-teal-200',
  'Cirurgia Plástica': 'bg-pink-200 text-pink-900 border-pink-300',
  'Oftalmologia': 'bg-violet-100 text-violet-800 border-violet-200',
  'Otorrinolaringologia': 'bg-amber-100 text-amber-800 border-amber-200',
  
  // Especialidades de Diagnóstico - Tons de Roxo
  'Radiologia': 'bg-indigo-200 text-indigo-900 border-indigo-300',
  'Patologia': 'bg-purple-200 text-purple-900 border-purple-300',
  'Medicina Nuclear': 'bg-violet-200 text-violet-900 border-violet-300',
  
  // Especialidades de Emergência - Tons de Vermelho
  'Medicina de Emergência': 'bg-red-200 text-red-900 border-red-300',
  'Medicina Intensiva': 'bg-red-300 text-red-950 border-red-400',
  'Anestesiologia': 'bg-orange-200 text-orange-900 border-orange-300',
  
  // Especialidades Pediátricas - Tons de Rosa
  'Pediatria': 'bg-pink-100 text-pink-800 border-pink-200',
  'Neonatologia': 'bg-rose-200 text-rose-900 border-rose-300',
  
  // Especialidades de Saúde da Mulher - Tons de Rosa/Roxo
  'Ginecologia': 'bg-fuchsia-100 text-fuchsia-800 border-fuchsia-200',
  'Obstetrícia': 'bg-pink-200 text-pink-900 border-pink-300',
  
  // Outras Especialidades
  'Psiquiatria': 'bg-slate-100 text-slate-800 border-slate-200',
  'Dermatologia': 'bg-orange-100 text-orange-800 border-orange-200',
  'Medicina do Trabalho': 'bg-lime-100 text-lime-800 border-lime-200',
  'Medicina Legal': 'bg-stone-100 text-stone-800 border-stone-200',
  'Genética Médica': 'bg-teal-200 text-teal-900 border-teal-300',
  
  // Cor padrão para especialidades não mapeadas
  'default': 'bg-gray-100 text-gray-700 border-gray-200'
};

// Cores para status de hospital
export const HOSPITAL_COLORS: Record<string, string> = {
  'principal': 'bg-green-100 text-green-800 border-green-200',
  'secundario': 'bg-blue-100 text-blue-800 border-blue-200',
  'ativo': 'bg-emerald-100 text-emerald-800 border-emerald-200',
  'inativo': 'bg-red-100 text-red-800 border-red-200',
  'sus': 'bg-blue-200 text-blue-900 border-blue-300',
  'privado': 'bg-purple-100 text-purple-800 border-purple-200',
  'default': 'bg-gray-100 text-gray-700 border-gray-200'
};

/**
 * 🎨 Obter cor para badge de especialidade
 */
export function getSpecialtyColor(specialty: string): string {
  // Normalizar o nome da especialidade
  const normalizedSpecialty = specialty.trim();
  
  // Buscar cor exata
  if (SPECIALTY_COLORS[normalizedSpecialty]) {
    return SPECIALTY_COLORS[normalizedSpecialty];
  }
  
  // Buscar por palavra-chave se não encontrar exato
  const keywords = normalizedSpecialty.toLowerCase();
  
  if (keywords.includes('cardiologia') || keywords.includes('cardio')) {
    return SPECIALTY_COLORS['Cardiologia'];
  }
  if (keywords.includes('neurologia') || keywords.includes('neuro')) {
    return SPECIALTY_COLORS['Neurologia'];
  }
  if (keywords.includes('cirurgia') || keywords.includes('cirúrgica')) {
    return SPECIALTY_COLORS['Cirurgia Geral'];
  }
  if (keywords.includes('pediatria') || keywords.includes('pediátrica')) {
    return SPECIALTY_COLORS['Pediatria'];
  }
  if (keywords.includes('ginecologia') || keywords.includes('obstetrícia')) {
    return SPECIALTY_COLORS['Ginecologia'];
  }
  if (keywords.includes('ortopedia') || keywords.includes('traumato')) {
    return SPECIALTY_COLORS['Ortopedia'];
  }
  if (keywords.includes('oftalmologia') || keywords.includes('oftalmo')) {
    return SPECIALTY_COLORS['Oftalmologia'];
  }
  if (keywords.includes('otorrinolaringologia') || keywords.includes('otorrino')) {
    return SPECIALTY_COLORS['Otorrinolaringologia'];
  }
  if (keywords.includes('radiologia') || keywords.includes('imagem')) {
    return SPECIALTY_COLORS['Radiologia'];
  }
  if (keywords.includes('anestesiologia') || keywords.includes('anestesia')) {
    return SPECIALTY_COLORS['Anestesiologia'];
  }
  
  // Retornar cor padrão se não encontrar
  return SPECIALTY_COLORS['default'];
}

/**
 * 🏥 Obter cor para badge de hospital
 */
export function getHospitalColor(type: 'principal' | 'secundario' | 'ativo' | 'inativo' | 'sus' | 'privado' | string): string {
  return HOSPITAL_COLORS[type] || HOSPITAL_COLORS['default'];
}

/**
 * 🎯 Obter ícone para especialidade
 */
export function getSpecialtyIcon(specialty: string): string {
  const keywords = specialty.toLowerCase();
  
  if (keywords.includes('cardiologia') || keywords.includes('cardio')) return '❤️';
  if (keywords.includes('neurologia') || keywords.includes('neuro')) return '🧠';
  if (keywords.includes('cirurgia')) return '🔪';
  if (keywords.includes('pediatria')) return '👶';
  if (keywords.includes('ginecologia') || keywords.includes('obstetrícia')) return '👩';
  if (keywords.includes('ortopedia')) return '🦴';
  if (keywords.includes('oftalmologia')) return '👁️';
  if (keywords.includes('otorrinolaringologia')) return '👂';
  if (keywords.includes('radiologia')) return '📸';
  if (keywords.includes('anestesiologia')) return '💉';
  if (keywords.includes('psiquiatria')) return '🧘';
  if (keywords.includes('dermatologia')) return '🫧';
  if (keywords.includes('oncologia')) return '🎗️';
  if (keywords.includes('emergência') || keywords.includes('urgência')) return '🚨';
  
  return '🩺'; // Ícone padrão médico
}

/**
 * 🏥 Obter ícone para hospital
 */
export function getHospitalIcon(type: string): string {
  if (type === 'principal') return '🏥';
  if (type === 'secundario') return '🏢';
  if (type === 'sus') return '🇧🇷';
  if (type === 'privado') return '🏛️';
  return '🏥'; // Ícone padrão
}

/**
 * 📋 Lista de todas as especialidades disponíveis
 */
export const AVAILABLE_SPECIALTIES = Object.keys(SPECIALTY_COLORS).filter(key => key !== 'default'); 
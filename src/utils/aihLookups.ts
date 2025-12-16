export const getModalityName = (code: string | number | null | undefined): string => {
  try {
    if (code == null) return '—';
    const raw = String(code).trim();
    if (raw.includes('/')) {
      const parts = raw.split('/').map(p => p.trim());
      return parts.map(getModalityName).join(' / ');
    }
    const digits = raw.replace(/\D/g, '');
    const norm = digits.padStart(2, '0');
    const map: Record<string, string> = {
      '01': 'Ambulatorial',
      '02': 'Hospitalar',
      '03': 'Hospital Dia',
      '06': 'Atenção Domiciliar'
    };
    return map[norm] || raw;
  } catch {
    return String(code ?? '—');
  }
};

export const getSpecialtyName = (code: string | number | null | undefined): string => {
  try {
    if (code == null) return '—';
    const digits = String(code).trim().replace(/\D/g, '').padStart(2, '0');
    const map: Record<string, string> = {
      '01': 'Cirúrgico',
      '02': 'Clínico',
      '03': 'Obstétrico',
      '04': 'Pediátrico',
      '05': 'Psiquiátrico',
      '06': 'Pneumologia Sanitária',
      '07': 'Reabilitação',
      '08': 'Hospital-Dia',
      '09': 'Outras Especialidades',
      '10': 'Atenção Básica / APS'
    };
    return map[digits] || String(code);
  } catch {
    return String(code ?? '—');
  }
};


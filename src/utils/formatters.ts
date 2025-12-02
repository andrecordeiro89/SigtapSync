// ✅ FUNÇÃO PARA FORMATAR VALORES MONETÁRIOS
export const formatCurrency = (value: number | null | undefined): string => {
  if (value == null || isNaN(value)) return 'R$ 0,00';
  return value.toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
};

export const formatNumber = (value: number | null | undefined): string => {
  if (value == null || isNaN(value)) return '0';
  return Math.round(value).toLocaleString('pt-BR');
};

export const formatSigtapCode = (code: string | number | null | undefined): string => {
  try {
    if (code == null) return '';
    const raw = String(code).trim();
    if (/^\d{2}\.\d{2}\.\d{2}\.\d{3}-\d$/.test(raw)) return raw;
    const digits = raw.replace(/\D/g, '');
    if (digits.length === 10) {
      return `${digits.slice(0, 2)}.${digits.slice(2, 4)}.${digits.slice(4, 6)}.${digits.slice(6, 9)}-${digits.slice(9)}`;
    }
    return raw;
  } catch {
    return String(code ?? '');
  }
};

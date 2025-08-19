
export const validateCNS = (cns: string): boolean => {
  // Remove espaços e caracteres especiais
  const cleanCNS = cns.replace(/\D/g, '');
  
  // CNS deve ter 15 dígitos
  if (cleanCNS.length !== 15) return false;
  
  // Validação básica do algoritmo CNS
  const weights = [15, 14, 13, 12, 11, 10, 9, 8, 7, 6, 5, 4, 3, 2, 1];
  let sum = 0;
  
  for (let i = 0; i < 15; i++) {
    sum += parseInt(cleanCNS[i]) * weights[i];
  }
  
  return sum % 11 === 0;
};

export const formatCNS = (cns: string): string => {
  const cleanCNS = cns.replace(/\D/g, '');
  return cleanCNS.replace(/(\d{3})(\d{4})(\d{4})(\d{4})/, '$1 $2 $3 $4');
};

export const formatCurrency = (value: number): string => {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL'
  }).format(value);
};

export const formatDate = (date: string): string => {
  if (!date) return 'N/A';
  // dd/MM/yyyy already
  if (/^\d{2}\/\d{2}\/\d{4}$/.test(date)) return date;
  // yyyy-MM-dd (date-only) → dd/MM/yyyy
  const ymd = date.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (ymd) {
    const [, y, m, d] = ymd;
    return `${d}/${m}/${y}`;
  }
  // Fallback to Date parsing (may include timezone); avoid off-by-one by formatting UTC parts if available
  try {
    const d = new Date(date);
    if (!isNaN(d.getTime())) {
      const dd = String(d.getUTCDate()).padStart(2, '0');
      const mm = String(d.getUTCMonth() + 1).padStart(2, '0');
      const yyyy = String(d.getUTCFullYear());
      return `${dd}/${mm}/${yyyy}`;
    }
  } catch {}
  return date;
};

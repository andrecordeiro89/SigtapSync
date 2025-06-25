
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
  return new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric'
  }).format(new Date(date));
};

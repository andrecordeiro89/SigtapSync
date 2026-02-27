
/**
 * Utilitário para verificar compatibilidade entre CBOs do médico e do procedimento
 */

/**
 * Garante que a entrada seja tratada como um array de strings
 */
function ensureArray(input: any): string[] {
  if (!input) return [];
  if (Array.isArray(input)) return input.map(String);
  // Se for string com vírgulas (formato CSV simples)
  if (typeof input === 'string') {
    return input.includes(',') 
      ? input.split(',').map(s => s.trim())
      : [input.trim()];
  }
  return [String(input)];
}

/**
 * Verifica se algum dos CBOs do médico está na lista de CBOs permitidos para o procedimento.
 * 
 * @param doctorCbos Lista de CBOs do médico (ex: ['2252-25', '2251-05'])
 * @param procedureAllowedCbos Lista de CBOs permitidos para o procedimento (ex: ['2252-25', '2252-50'])
 * @returns true se compatível (ou se não houver dados suficientes para validar), false se divergente
 */
export function checkCboCompatibility(doctorCbos: string[] | undefined | null | any, procedureAllowedCbos: string[] | undefined | null | any): boolean {
  const docArray = ensureArray(doctorCbos);
  const procArray = ensureArray(procedureAllowedCbos);

  // Se não há lista de permitidos, assume que qualquer um pode (ou que não há restrição cadastrada)
  if (procArray.length === 0) {
    return true;
  }

  // Se o médico não tem CBO cadastrado, não podemos afirmar que é divergente (pode ser falha de cadastro)
  // O usuário pediu para identificar divergências baseadas no cadastro do banco.
  // Se no banco não tem especialidade, não tem como dizer que é divergente da especialidade.
  if (docArray.length === 0) {
    return true;
  }

  // Normalizar CBOs (remover pontuação se houver, garantir string)
  const normalizedDoctorCbos = docArray.map(c => c.replace(/\D/g, ''));
  const normalizedProcedureCbos = procArray.map(c => c.replace(/\D/g, ''));

  // Verificar interseção
  const hasIntersection = normalizedDoctorCbos.some(docCbo => normalizedProcedureCbos.includes(docCbo));

  return hasIntersection;
}

/**
 * Verifica se o procedimento é do grupo 04 (Procedimentos Cirúrgicos)
 */
export function isSurgicalProcedure(procedureCode: string): boolean {
  if (!procedureCode) return false;
  const cleanCode = String(procedureCode).replace(/\D/g, '');
  return cleanCode.startsWith('04');
}

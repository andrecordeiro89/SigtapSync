/**
 * ================================================================
 * LÓGICA REFINADA PARA ANESTESISTAS - SISTEMA SIGTAP
 * ================================================================
 * Data: 2024-12-30
 * Propósito: Implementar lógica específica para valores de anestesistas baseada no código do procedimento
 * 
 * REGRAS:
 * - CBO 225151 + Procedimento 03.xxx = ✅ CALCULADO (anestesista recebe)
 * - CBO 225151 + Procedimento 04.xxx = 🚫 NÃO CALCULADO (anestesista não recebe)
 * ================================================================
 */

/**
 * Verifica se um procedimento é de anestesista baseado no CBO
 */
export const isAnesthetist = (cbo?: string): boolean => {
  return cbo === '225151';
};

/**
 * Verifica se um procedimento deve ser calculado para anestesista
 * @param cbo - Código CBO do profissional
 * @param procedureCode - Código do procedimento (ex: "03.01.01.001-2" ou "04.02.01.001-1")
 * @returns true se deve ser calculado, false se deve ser excluído
 */
export const shouldCalculateAnesthetistProcedure = (cbo?: string, procedureCode?: string): boolean => {
  // Se não é anestesista, sempre calcular
  if (!isAnesthetist(cbo)) {
    return true;
  }
  
  // Se é anestesista, verificar o código do procedimento
  if (!procedureCode) {
    return false; // Sem código de procedimento, não calcular
  }
  
  const code = procedureCode.toString().trim();
  
  // ✅ Procedimentos 03.xxx - ANESTESISTA RECEBE
  if (code.startsWith('03')) {
    return true;
  }
  
  // 🚫 Procedimentos 04.xxx - ANESTESISTA NÃO RECEBE  
  if (code.startsWith('04')) {
    return false;
  }
  
  // Para outros códigos de anestesista, não calcular por segurança
  return false;
};

/**
 * Verifica se um procedimento de anestesista deve ser excluído dos cálculos
 * @param cbo - Código CBO do profissional
 * @param procedureCode - Código do procedimento
 * @returns true se deve ser excluído, false se deve ser incluído
 */
export const shouldExcludeAnesthetistProcedure = (cbo?: string, procedureCode?: string): boolean => {
  return !shouldCalculateAnesthetistProcedure(cbo, procedureCode);
};

/**
 * Obtém o tipo de procedimento de anestesista para exibição
 * @param cbo - Código CBO do profissional
 * @param procedureCode - Código do procedimento
 * @returns objeto com informações do tipo
 */
export const getAnesthetistProcedureType = (cbo?: string, procedureCode?: string) => {
  if (!isAnesthetist(cbo)) {
    return {
      isAnesthetist: false,
      shouldCalculate: true,
      badge: null,
      message: null
    };
  }
  
  const code = procedureCode?.toString().trim() || '';
  
  if (code.startsWith('03')) {
    return {
      isAnesthetist: true,
      shouldCalculate: true,
      badge: '💉 Anestesia 03',
      message: 'Procedimento calculado',
      badgeVariant: 'default' as const,
      badgeClass: 'bg-blue-100 text-blue-700 border-blue-300'
    };
  }
  
  if (code.startsWith('04')) {
    return {
      isAnesthetist: true,
      shouldCalculate: false,
      badge: '🚫 Anestesia 04',
      message: 'Sem valor monetário - Controle por quantidade',
      badgeVariant: 'destructive' as const,
      badgeClass: 'bg-red-100 text-red-700 border-red-300'
    };
  }
  
  // Anestesista com código desconhecido
  return {
    isAnesthetist: true,
    shouldCalculate: false,
    badge: '❓ Anestesia',
    message: 'Código não reconhecido - Sem valor',
    badgeVariant: 'secondary' as const,
    badgeClass: 'bg-gray-100 text-gray-700 border-gray-300'
  };
};

/**
 * Filtro para usar em arrays - exclui procedimentos de anestesistas que não devem ser calculados
 * @param procedure - Objeto com propriedades cbo e procedure_code
 * @returns true se deve ser incluído no cálculo
 */
export const filterCalculableProcedures = (procedure: { cbo?: string; procedure_code?: string }) => {
  return shouldCalculateAnesthetistProcedure(procedure.cbo, procedure.procedure_code);
};

/**
 * Constrói condição SQL para excluir anestesistas não calculáveis
 * @param cboColumn - Nome da coluna CBO na query SQL
 * @param procedureCodeColumn - Nome da coluna do código do procedimento na query SQL
 * @returns string com condição SQL
 */
export const buildAnesthetistSQLCondition = (cboColumn: string = 'professional_cbo', procedureCodeColumn: string = 'procedure_code'): string => {
  return `(
    ${cboColumn} != '225151' OR 
    ${cboColumn} IS NULL OR
    (${cboColumn} = '225151' AND ${procedureCodeColumn} LIKE '03%')
  )`;
};

/**
 * Debug: Log informações sobre decisão de cálculo de anestesista
 */
export const debugAnesthetistDecision = (cbo?: string, procedureCode?: string, context: string = '') => {
  if (!isAnesthetist(cbo)) return;
  
  const result = shouldCalculateAnesthetistProcedure(cbo, procedureCode);
  const type = getAnesthetistProcedureType(cbo, procedureCode);
  
  console.log(`🩺 [ANESTESISTA DEBUG] ${context}`);
  console.log(`   CBO: ${cbo}`);
  console.log(`   Procedimento: ${procedureCode}`);
  console.log(`   Deve calcular: ${result ? '✅ SIM' : '🚫 NÃO'}`);
  console.log(`   Badge: ${type.badge}`);
  console.log(`   Mensagem: ${type.message}`);
};
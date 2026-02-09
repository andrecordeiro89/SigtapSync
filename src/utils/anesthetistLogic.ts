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

const normalizeCbo = (cbo?: string): string => (cbo ?? '').toString().trim();

const is04ProcedureCode = (procedureCode?: string): boolean => {
  const code = (procedureCode ?? '').toString().trim();
  return code.startsWith('04');
};

const normalizeProcedureCodeKey = (procedureCode?: string): string => {
  return (procedureCode ?? '').toString().replace(/\D/g, '');
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
  
  // ✅ EXCEÇÃO: Anestesia de Cesariana - ANESTESISTA RECEBE (mesmo sendo 04.xxx)
  if (code === '04.17.01.001-0') {
    return true;
  }
  // ✅ EXCEÇÃO: Código 04.17.01.005-2 também deve ser cobrado
  if (code === '04.17.01.005-2') {
    return true;
  }
  // ✅ EXCEÇÃO: Código 04.17.01.006-0 também deve ser cobrado
  if (code === '04.17.01.006-0') {
    return true;
  }
  
  // 🚫 Outros procedimentos 04.xxx - ANESTESISTA NÃO RECEBE  
  if (code.startsWith('04')) {
    return false;
  }
  
  // Para outros códigos de anestesista, não calcular por segurança
  return false;
};

export const shouldExcludeImplicitAnesthetistDuplicate04 = (
  current: { cbo?: string; procedure_code?: string } | null | undefined,
  firstOfSameCode: { cbo?: string; procedure_code?: string } | null | undefined
): boolean => {
  if (!current || !firstOfSameCode) return false;
  const code = (current.procedure_code ?? '').toString().trim();
  if (!is04ProcedureCode(code)) return false;
  const key = normalizeProcedureCodeKey(code);
  if (!key) return false;
  const firstKey = normalizeProcedureCodeKey(firstOfSameCode.procedure_code);
  if (!firstKey || firstKey !== key) return false;
  return true;
};

export const getCalculableProcedures = <T extends {
  procedure_code?: string;
  cbo?: string;
  professional_cbo?: string;  
  aih_id?: string;
  sequence?: number;
}>(procedures: T[]): T[] => {
  const list = Array.isArray(procedures) ? procedures : [];
  if (list.length === 0) return [];

  const groups = new Map<string, Array<{ idx: number; p: T }>>();
  list.forEach((p, idx) => {
    const k = (p.aih_id ?? '__single__').toString();
    if (!groups.has(k)) groups.set(k, []);
    groups.get(k)!.push({ idx, p });
  });

  const excluded = new Set<number>();

  for (const [, rows] of groups) {
    const ordered = [...rows].sort((a, b) => {
      const sa = typeof a.p.sequence === 'number' && Number.isFinite(a.p.sequence) ? a.p.sequence : Number.POSITIVE_INFINITY;
      const sb = typeof b.p.sequence === 'number' && Number.isFinite(b.p.sequence) ? b.p.sequence : Number.POSITIVE_INFINITY;
      if (sa !== sb) return sa - sb;
      return a.idx - b.idx;
    });

    const by04Code = new Map<string, Array<{ idx: number; cbo: string; code: string }>>();
    for (const row of ordered) {
      const proc = row.p;
      const cbo = normalizeCbo(proc.cbo ?? proc.professional_cbo);
      const code = (proc.procedure_code ?? '').toString().trim();
      if (!is04ProcedureCode(code)) continue;
      const key = normalizeProcedureCodeKey(code);
      if (!key) continue;
      if (!by04Code.has(key)) by04Code.set(key, []);
      by04Code.get(key)!.push({ idx: row.idx, cbo, code });
    }

    for (const [, list04] of by04Code) {
      if (list04.length <= 1) continue;
      const keep = list04.find((x) => x.cbo && x.cbo !== '225151') ?? list04[0];
      for (const x of list04) {
        if (x.idx !== keep.idx) excluded.add(x.idx);
      }
    }

    for (const row of ordered) {
      if (excluded.has(row.idx)) continue;
      const proc = row.p;
      const cbo = normalizeCbo(proc.cbo ?? proc.professional_cbo);
      const code = (proc.procedure_code ?? '').toString().trim();

      const anesthetistAllowed = shouldCalculateAnesthetistProcedure(cbo, code);
      if (!anesthetistAllowed) {
        excluded.add(row.idx);
      }
    }
  }

  return list.filter((_, idx) => !excluded.has(idx));
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
  
  // ✅ EXCEÇÃO: Anestesia de Cesariana
  if (code === '04.17.01.001-0') {
    return {
      isAnesthetist: true,
      shouldCalculate: true,
      badge: '🤱 Cesariana',
      message: 'Anestesia de cesariana - Calculado pelo SUS',
      badgeVariant: 'default' as const,
      badgeClass: 'bg-green-100 text-green-700 border-green-300'
    };
  }
  
  // ✅ EXCEÇÃO: 04.17.01.005-2 também calculado
  if (code === '04.17.01.005-2') {
    return {
      isAnesthetist: true,
      shouldCalculate: true,
      badge: '💉 Exceção 04',
      message: 'Procedimento de anestesia (04.17.01.005-2) calculado',
      badgeVariant: 'default' as const,
      badgeClass: 'bg-green-100 text-green-700 border-green-300'
    };
  }
  // ✅ EXCEÇÃO: 04.17.01.006-0 também calculado
  if (code === '04.17.01.006-0') {
    return {
      isAnesthetist: true,
      shouldCalculate: true,
      badge: '💉 Exceção 04',
      message: 'Procedimento de anestesia (04.17.01.006-0) calculado',
      badgeVariant: 'default' as const,
      badgeClass: 'bg-green-100 text-green-700 border-green-300'
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
    (${cboColumn} = '225151' AND ${procedureCodeColumn} LIKE '03%') OR
    (${cboColumn} = '225151' AND ${procedureCodeColumn} = '04.17.01.001-0') OR
    (${cboColumn} = '225151' AND ${procedureCodeColumn} = '04.17.01.005-2') OR
    (${cboColumn} = '225151' AND ${procedureCodeColumn} = '04.17.01.006-0')
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

// Utilitários de valores para AIH e procedimentos (sempre em REAIS)

export function computeProcedureBaseReais(procedure: any): number {
  try {
    if (!procedure) return 0;
    // Preferir value_reais quando disponível
    if (typeof procedure.value_reais === 'number' && procedure.value_reais > 0) return procedure.value_reais;
    // value_cents / total_value / value_charged vêm em centavos
    const centsCandidates = [
      procedure.value_cents,
      procedure.total_value,
      procedure.value_charged,
      procedure.total_value_cents
    ].map((v: any) => Number(v) || 0);
    const cents = centsCandidates.find((v: number) => v > 0);
    if (typeof cents === 'number' && cents > 0) return cents / 100;
    // SIGTAP dentro do objeto
    const sigtapCents = Number(procedure?.sigtap_procedures?.value_hosp_total || 0);
    if (sigtapCents > 0) return sigtapCents / 100;
    // Nada encontrado
    return 0;
  } catch {
    return 0;
  }
}

export function sumProceduresBaseReais(procedures: any[] | undefined | null): number {
  try {
    const list = Array.isArray(procedures) ? procedures : [];
    return list.reduce((sum: number, p: any) => sum + computeProcedureBaseReais(p), 0);
  } catch {
    return 0;
  }
}



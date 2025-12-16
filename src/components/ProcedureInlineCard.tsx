import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { 
  AlertTriangle, 
  Trash2, 
  RotateCcw, 
  CheckCircle, 
  XCircle, 
  Clock, 
  User,
  Info,
  Zap
} from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';
import { getAnesthetistProcedureType } from '@/utils/anesthetistLogic';
import { getProcedureIncrementMeta } from '@/config/operaParana';
import { resolveCommonProcedureName } from '@/utils/commonProcedureName';
import { formatSigtapCode } from '@/utils/formatters';
import { getSigtapLocalMap, resolveSigtapDescriptionFromCsv } from '@/utils/sigtapLocal';
import { isSihSourceActive } from '@/utils/sihSource';

interface ProcedureData {
  id: string;
  procedure_sequence: number;
  procedure_code: string;
  procedure_description?: string;
  displayName?: string;
  fullDescription?: string;
  match_status: 'pending' | 'matched' | 'manual' | 'rejected';
  match_confidence?: number;
  value_charged?: number;
  total_value?: number; // Valor total do procedimento (quando disponível)
  quantity?: number; // Quantidade selecionada para o procedimento
  professional?: string;
  professional_name?: string;
  professional_cbo?: string;
  procedure_date: string;
  sigtap_procedures?: {
    code: string;
    description: string;
    value_hosp_total: number;
    complexity: string;
  };
}

interface ProcedureInlineCardProps {
  procedure: ProcedureData;
  isReadOnly?: boolean;
  onDelete?: (procedure: ProcedureData) => Promise<void>;
  onShowDetails?: (procedure: ProcedureData) => void;
  aihCareCharacter?: string | number; // caráter da AIH (1=Eletivo, 2=Urgência/Emergência)
  aihHasExcluded?: boolean; // indica se a AIH contém qualquer procedimento excluído do Opera PR
  showOperaParanaBadges?: boolean; // exibir badge de incremento (somente em Analytics)
}

const ProcedureInlineCard = ({
  procedure,
  isReadOnly = false,
  onDelete,
  onShowDetails,
  aihCareCharacter,
  aihHasExcluded,
  showOperaParanaBadges = false
}: ProcedureInlineCardProps) => {
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [sigtapMap, setSigtapMap] = useState<Map<string, string> | null>(null);
  const [csvDesc, setCsvDesc] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    if (isSihSourceActive()) {
      getSigtapLocalMap()
        .then((map) => { if (mounted) setSigtapMap(map); })
        .catch(() => setSigtapMap(new Map()));
    }
    return () => { mounted = false; };
  }, []);

  useEffect(() => {
    const tryLoad = () => {
      if (!sigtapMap && isSihSourceActive()) {
        getSigtapLocalMap()
          .then((map) => setSigtapMap(map))
          .catch(() => setSigtapMap(new Map()))
      }
    }
    tryLoad()
    const onCustom = () => tryLoad()
    window.addEventListener('sihsourcechange', onCustom as any)
    return () => window.removeEventListener('sihsourcechange', onCustom as any)
  }, [sigtapMap, procedure.procedure_code])

  useEffect(() => {
    const run = async () => {
      if (!isSihSourceActive()) { setCsvDesc(null); return }
      const formatted = formatSigtapCode(procedure.procedure_code)
      if (sigtapMap) {
        const digits = formatted.replace(/\D/g, '')
        const direct = sigtapMap.get(formatted) || sigtapMap.get(digits)
        if (direct) { setCsvDesc(direct); return }
      }
      try {
        const direct = await resolveSigtapDescriptionFromCsv(formatted)
        setCsvDesc(direct || null)
      } catch { setCsvDesc(null) }
    }
    run()
  }, [procedure.procedure_code, sigtapMap])

  const handleAction = async (action: () => Promise<void>, actionName: string) => {
    if (isLoading) return;
    
    setIsLoading(true);
    try {
      await action();
    } catch (error) {
      console.error(`❌ Erro ao ${actionName.toLowerCase()}:`, error);
      toast({
        title: `Erro ao ${actionName}`,
        description: `Falha ao ${actionName.toLowerCase()} o procedimento`,
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  const getStatusConfig = () => {
    const configs = {
      pending: { 
        icon: Clock, 
        text: 'Pendente', 
        bgColor: 'bg-yellow-50 border-yellow-200',
        textColor: 'text-yellow-800',
        badgeColor: 'bg-yellow-100 text-yellow-800 border-yellow-300'
      },
      matched: { 
        icon: CheckCircle, 
        text: 'Aprovado', 
        bgColor: 'bg-green-50 border-green-200',
        textColor: 'text-green-800',
        badgeColor: 'bg-green-100 text-green-800 border-green-300'
      },
      manual: { 
        icon: CheckCircle, 
        text: 'Manual', 
        bgColor: 'bg-blue-50 border-blue-200',
        textColor: 'text-blue-800',
        badgeColor: 'bg-blue-100 text-blue-800 border-blue-300'
      },
      rejected: { 
        icon: XCircle, 
        text: 'Rejeitado', 
        bgColor: 'bg-slate-50 border-slate-300',
        textColor: 'text-slate-600',
        badgeColor: 'bg-slate-100 text-slate-600 border-slate-300'
      }
    };
    
    return configs[procedure.match_status] || configs.pending;
  };

  const formatCurrency = (value?: number) => {
    if (!value) return 'R$ 0,00';
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(value / 100);
  };

  const config = getStatusConfig();
  const StatusIcon = config.icon;
  const anesthInfo = getAnesthetistProcedureType(procedure.professional_cbo, procedure.procedure_code);
  const incMeta = showOperaParanaBadges 
    ? getProcedureIncrementMeta(procedure.procedure_code, aihCareCharacter, undefined, undefined, !!aihHasExcluded)
    : null;
  const commonName = (() => {
    try {
      const code = (procedure.procedure_code || '').trim();
      if (!code) return null;
      return resolveCommonProcedureName([code], undefined, [{ procedure_code: code, sequence: procedure.procedure_sequence }]);
    } catch { return null; }
  })();

  const isMedical04 = (() => {
    try { return (procedure.procedure_code || '').trim().startsWith('04'); } catch { return false; }
  })();

  // Relacionamento do Supabase pode vir como objeto ou array; tratar ambos
  const relProc: any = procedure.sigtap_procedures as any;
  const relUnitCents: number | undefined = Array.isArray(relProc) ? relProc[0]?.value_hosp_total : relProc?.value_hosp_total;
  const relComplexity: string | undefined = Array.isArray(relProc) ? relProc[0]?.complexity : relProc?.complexity;

  // 🎯 CORREÇÃO DIRETA: Priorizar descrição SIGTAP e filtrar textos genéricos
  const procedureDescription = (() => {
    console.log('🔍 ProcedureInlineCard - Dados recebidos:', {
      procedure_description: procedure.procedure_description,
      displayName: procedure.displayName,
      sigtap_description: procedure.sigtap_procedures?.description,
      procedure_code: procedure.procedure_code
    });

    const isUnavailable = (s?: string) => {
      const v = (s || '').trim().toLowerCase();
      return v === 'descrição não disponível' || v === 'descricao nao disponivel';
    };
    const formattedCode = formatSigtapCode(procedure.procedure_code);

    if (isSihSourceActive() && csvDesc && !isUnavailable(csvDesc)) {
      return csvDesc
    }

    // 2. Descrição armazenada no banco (desde que não seja "Descrição não disponível" ou fallback)
    if (procedure.procedure_description && 
        procedure.procedure_description.trim() !== '' &&
        !isUnavailable(procedure.procedure_description) &&
        !procedure.procedure_description.startsWith('Procedimento:') &&
        !procedure.procedure_description.startsWith('Procedimento ')) {
      console.log('✅ Usando procedure_description:', procedure.procedure_description);
      return procedure.procedure_description;
    }

    {
      const rel: any = procedure.sigtap_procedures;
      const relDesc = Array.isArray(rel) ? rel[0]?.description : rel?.description;
      if (relDesc && !isUnavailable(relDesc)) {
        console.log('✅ Usando descrição SIGTAP via join:', relDesc);
        return relDesc;
      }
    }

    // 3. displayName como terceira opção (se não for fallback)
    if (procedure.displayName && 
        !isUnavailable(procedure.displayName) &&
        !procedure.displayName.startsWith('Procedimento:') &&
        !procedure.displayName.startsWith('Procedimento ')) {
      console.log('✅ Usando displayName:', procedure.displayName);
      return procedure.displayName;
    }

    // 4. Fallback final
    const fallback = formattedCode;
    console.log('⚠️ Usando fallback:', fallback);
    return fallback;
  })();

  return (
    <Card className={`transition-all duration-300 hover:shadow-md ${config.bgColor}`}>
      <CardContent className="p-4">
        <div className="flex items-center justify-between">
          {/* Informações Principais */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center space-x-3 mb-3">
              {/* Sequência */}
              <Badge variant="outline" className="font-mono text-xs">
                #{procedure.procedure_sequence}
              </Badge>
              
              {/* Status Badge */}
              <Badge className={`flex items-center space-x-1 ${config.badgeColor}`}>
                <StatusIcon className="w-3 h-3" />
                <span className="text-xs">{config.text}</span>
              </Badge>
              
              {/* Confiança */}
              {procedure.match_confidence && procedure.match_confidence > 0 && (
                <Badge variant="outline" className="flex items-center space-x-1 bg-blue-50 text-blue-700 border-blue-200">
                  <Zap className="w-3 h-3" />
                  <span className="text-xs">{(procedure.match_confidence * 100).toFixed(0)}%</span>
                </Badge>
              )}

              {/* Quantidade selecionada */}
              <Badge variant="outline" className="bg-purple-50 text-purple-700 border-purple-200">
                Qtd: {procedure.quantity ?? 1}
              </Badge>
              {procedure.professional_cbo && (
                <Badge variant="outline" className="bg-indigo-50 text-indigo-700 border-indigo-200">
                  CBO: {procedure.professional_cbo}
                </Badge>
              )}

              {/* Badge de anestesista: exibir apenas quando NÃO calculável (mantém visual normal quando calculável) */}
              {anesthInfo.isAnesthetist && !anesthInfo.shouldCalculate && anesthInfo.badge && (
                <Badge className={`flex items-center space-x-1 ${anesthInfo.badgeClass || ''}`} variant={anesthInfo.badgeVariant || 'secondary'}>
                  <span className="text-xs">{anesthInfo.badge}</span>
                </Badge>
              )}

              {/* Incremento (Opera PR 150% | Urgência 20%) */}
              {incMeta && (
                <Badge className="flex items-center space-x-1 bg-emerald-100 text-emerald-800 border-emerald-200" variant="outline">
                  <span className="text-xs font-bold">{incMeta.label}</span>
                </Badge>
              )}
            </div>

            {/* 🎯 CÓDIGO E DESCRIÇÃO - FORMATO MELHORADO */}
            <div className="mb-3">
              <div className="flex items-start">
                <div className="flex-1 min-w-0 pr-3">
                  <div className="flex items-start space-x-3">
                    <span className="font-mono text-sm font-bold text-blue-700 bg-blue-50 px-3 py-1 rounded-md border border-blue-200 shrink-0">
                      {formatSigtapCode(procedure.procedure_code)}
                    </span>
                    <p className="text-sm font-medium text-gray-900 leading-relaxed flex-1 min-w-0">
                      {procedureDescription}
                    </p>
                  </div>
                  {commonName && (
                    <div className="mt-1 ml-12">
                      <Badge variant="outline" className="text-[11px] bg-emerald-50 text-emerald-700 border-emerald-200">
                        {commonName}
                      </Badge>
                    </div>
                  )}
                </div>
                {/* Valor destacado à direita */}
                <div className="shrink-0 pl-3 border-l border-gray-100 flex items-center h-9 -mt-0.5">
                  {(() => {
                    const qty = procedure.quantity ?? 1;
                    const canShowMonetary = (!anesthInfo.isAnesthetist || anesthInfo.shouldCalculate);
                    let baseCents: number | null = null;
                    if (canShowMonetary && procedure.value_charged && procedure.value_charged > 0) {
                      baseCents = procedure.value_charged;
                    } else if (canShowMonetary && relUnitCents != null) {
                      const unitCents = relUnitCents || 0;
                      baseCents = unitCents * (qty || 1);
                    }
                    if (baseCents != null) {
                      if (incMeta) {
                        const incrementedCents = Math.round(baseCents * incMeta.factor);
                        return (
                          <div className="text-right">
                            <div className="text-[11px] text-gray-400 line-through leading-none">{formatCurrency(baseCents)}</div>
                            <div className="text-lg font-extrabold text-emerald-700 leading-none">{formatCurrency(incrementedCents)}</div>
                          </div>
                        );
                      }
                      return (
                        <div className="text-right">
                          <div className="text-lg font-bold text-green-700 leading-none">{formatCurrency(baseCents)}</div>
                          {qty > 1 && (
                            <div className="text-[10px] text-gray-500">({formatCurrency(Math.round(baseCents / Math.max(1, qty)))} × {qty})</div>
                          )}
                        </div>
                      );
                    }
                    // Anestesista sem valor no cálculo total: exibir valor, mas sinalizar que NÃO entra no total
                    if (anesthInfo.isAnesthetist && !anesthInfo.shouldCalculate) {
                      const qty = procedure.quantity ?? 1;
                      let baseCents = 0;
                      if (procedure.value_charged && procedure.value_charged > 0) {
                        baseCents = procedure.value_charged;
                      } else if (relUnitCents != null) {
                        const unitCents = relUnitCents || 0;
                        baseCents = unitCents * (qty || 1);
                      }
                      return (
                        <div className="text-right">
                          <div className="text-lg font-semibold text-red-700 leading-none">{formatCurrency(baseCents)}</div>
                        </div>
                      );
                    }
                    return null;
                  })()}
                </div>
              </div>
            </div>
              
            {/* Profissional */}
            {(procedure.professional_name || procedure.professional) && (
              <div className="flex items-center space-x-1 mb-2">
                <User className="w-3 h-3 text-gray-400" />
                <span className="text-xs text-gray-600">
                  {procedure.professional_name || procedure.professional} {procedure.professional_cbo && `(CBO: ${procedure.professional_cbo})`}
                </span>
              </div>
            )}

            {/* (Removido) Valor abaixo do código: agora exibimos apenas o valor à direita */}
          </div>

          {/* Ações */}
          {!isReadOnly && (
            <div className="flex items-center space-x-1 ml-4 h-9">
              <Button
                size="sm"
                variant="outline"
                onClick={() => onDelete && handleAction(() => onDelete(procedure), 'Excluir')}
                disabled={isLoading}
                className="h-9 px-2 text-red-600 hover:text-red-700 hover:bg-red-50 border-red-200"
                title="Excluir permanentemente"
              >
                <Trash2 className={`w-3 h-3 ${isLoading ? 'animate-pulse' : ''}`} />
              </Button>
            </div>
          )}
        </div>

        {/* Complexidade SIGTAP (se disponível) */}
        {relComplexity && (
          <div className="mt-3 pt-2 border-t border-gray-100">
            <span className="text-xs text-gray-500">
              Complexidade: <span className="font-medium">{relComplexity}</span>
            </span>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default ProcedureInlineCard;

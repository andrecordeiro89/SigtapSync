import React, { useState } from 'react';
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
  DollarSign,
  User,
  Info,
  Zap
} from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';
import { getAnesthetistProcedureType } from '@/utils/anesthetistLogic';

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
}

const ProcedureInlineCard = ({
  procedure,
  isReadOnly = false,
  onDelete,
  onShowDetails
}: ProcedureInlineCardProps) => {
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);

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

  const isMedical04 = (() => {
    try { return (procedure.procedure_code || '').trim().startsWith('04'); } catch { return false; }
  })();

  // 🎯 CORREÇÃO DIRETA: Priorizar procedure_description do banco de dados
  const procedureDescription = (() => {
    console.log('🔍 ProcedureInlineCard - Dados recebidos:', {
      procedure_description: procedure.procedure_description,
      displayName: procedure.displayName,
      sigtap_description: procedure.sigtap_procedures?.description,
      procedure_code: procedure.procedure_code
    });

    // 1. PRIORIDADE MÁXIMA: procedure_description do banco (desde que não seja fallback)
    if (procedure.procedure_description && 
        procedure.procedure_description.trim() !== '' &&
        !procedure.procedure_description.startsWith('Procedimento:') &&
        !procedure.procedure_description.startsWith('Procedimento ')) {
      console.log('✅ Usando procedure_description:', procedure.procedure_description);
      return procedure.procedure_description;
    }
    
    // 2. SIGTAP como segunda opção
    if (procedure.sigtap_procedures?.description) {
      console.log('✅ Usando SIGTAP description:', procedure.sigtap_procedures.description);
      return procedure.sigtap_procedures.description;
    }
    
    // 3. displayName como terceira opção (se não for fallback)
    if (procedure.displayName && 
        !procedure.displayName.startsWith('Procedimento:') &&
        !procedure.displayName.startsWith('Procedimento ')) {
      console.log('✅ Usando displayName:', procedure.displayName);
      return procedure.displayName;
    }
    
    // 4. Fallback final
    const fallback = `Procedimento ${procedure.procedure_code}`;
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

              {/* Badge de anestesista: exibir apenas quando NÃO calculável (mantém visual normal quando calculável) */}
              {anesthInfo.isAnesthetist && !anesthInfo.shouldCalculate && anesthInfo.badge && (
                <Badge className={`flex items-center space-x-1 ${anesthInfo.badgeClass || ''}`} variant={anesthInfo.badgeVariant || 'secondary'}>
                  <span className="text-xs">{anesthInfo.badge}</span>
                </Badge>
              )}

              {/* Opera Paraná: removido desta tela conforme solicitação */}
            </div>

            {/* 🎯 CÓDIGO E DESCRIÇÃO - FORMATO MELHORADO */}
            <div className="mb-3">
              <div className="flex items-start space-x-3">
                <span className="font-mono text-sm font-bold text-blue-700 bg-blue-50 px-3 py-1 rounded-md border border-blue-200 shrink-0">
                  {procedure.procedure_code}
                </span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 leading-relaxed">
                    {procedureDescription}
                  </p>
                </div>
              </div>
            </div>
              
            {/* Profissional */}
            {procedure.professional && (
              <div className="flex items-center space-x-1 mb-2">
                <User className="w-3 h-3 text-gray-400" />
                <span className="text-xs text-gray-600">
                  {procedure.professional} {procedure.professional_cbo && `(${procedure.professional_cbo})`}
                </span>
              </div>
            )}

            {/* Valor */}
            {(() => {
              const qty = procedure.quantity ?? 1;
              const canShowMonetary = (!anesthInfo.isAnesthetist || anesthInfo.shouldCalculate);

              // Caso 1: Temos valor cobrado (total)
              if (canShowMonetary && procedure.value_charged && procedure.value_charged > 0) {
                const totalCents = procedure.value_charged || 0;
                const unitCents = qty > 0 ? Math.round(totalCents / qty) : totalCents;
                return (
                  <div className="flex items-center space-x-2">
                    <DollarSign className="w-4 h-4 text-green-600" />
                    <div className="text-sm font-semibold text-green-700">
                      {formatCurrency(totalCents)}
                    </div>
                    {qty > 1 && (
                      <div className="text-xs text-gray-500">({formatCurrency(unitCents)} × {qty})</div>
                    )}
                  </div>
                );
              }

              // Caso 2: Sem value_charged, mas temos valor do SIGTAP (unitário) → estimar total
              if (canShowMonetary && procedure.sigtap_procedures?.value_hosp_total) {
                const unitCents = procedure.sigtap_procedures.value_hosp_total || 0;
                const totalCents = unitCents * (qty || 1);
                return (
                  <div className="flex items-center space-x-2">
                    <DollarSign className="w-4 h-4 text-green-600" />
                    <div className="text-sm font-semibold text-green-700">
                      {formatCurrency(totalCents)}
                    </div>
                    {qty > 1 && (
                      <div className="text-xs text-gray-500">({formatCurrency(unitCents)} × {qty})</div>
                    )}
                  </div>
                );
              }

              // Sinalizar sem valor monetário para anestesista não calculável
              if (anesthInfo.isAnesthetist && !anesthInfo.shouldCalculate) {
                return (
                  <div className="text-xs font-medium text-red-700 bg-red-50 border border-red-200 inline-block px-2 py-1 rounded">
                    Sem valor monetário
                  </div>
                );
              }
              return null;
            })()}
          </div>

          {/* Ações */}
          {!isReadOnly && (
            <div className="flex items-center space-x-1 ml-4">
              <Button
                size="sm"
                variant="outline"
                onClick={() => onDelete && handleAction(() => onDelete(procedure), 'Excluir')}
                disabled={isLoading}
                className="h-8 px-2 text-red-600 hover:text-red-700 hover:bg-red-50 border-red-200"
                title="Excluir permanentemente"
              >
                <Trash2 className={`w-3 h-3 ${isLoading ? 'animate-pulse' : ''}`} />
              </Button>
            </div>
          )}
        </div>

        {/* Complexidade SIGTAP (se disponível) */}
        {procedure.sigtap_procedures?.complexity && (
          <div className="mt-3 pt-2 border-t border-gray-100">
            <span className="text-xs text-gray-500">
              Complexidade: <span className="font-medium">{procedure.sigtap_procedures.complexity}</span>
            </span>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default ProcedureInlineCard;
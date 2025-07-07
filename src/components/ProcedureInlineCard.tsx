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

interface ProcedureData {
  id: string;
  procedure_sequence: number;
  procedure_code: string;
  procedure_description?: string;
  match_status: 'pending' | 'approved' | 'rejected' | 'removed';
  match_confidence?: number;
  value_charged?: number;
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
  onRemove?: (procedure: ProcedureData) => Promise<void>;
  onDelete?: (procedure: ProcedureData) => Promise<void>;
  onRestore?: (procedure: ProcedureData) => Promise<void>;
  onShowDetails?: (procedure: ProcedureData) => void;
}

const ProcedureInlineCard = ({
  procedure,
  isReadOnly = false,
  onRemove,
  onDelete,
  onRestore,
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
      approved: { 
        icon: CheckCircle, 
        text: 'Aprovado', 
        bgColor: 'bg-green-50 border-green-200',
        textColor: 'text-green-800',
        badgeColor: 'bg-green-100 text-green-800 border-green-300'
      },
      rejected: { 
        icon: XCircle, 
        text: 'Rejeitado', 
        bgColor: 'bg-red-50 border-red-200',
        textColor: 'text-red-800',
        badgeColor: 'bg-red-100 text-red-800 border-red-300'
      },
      removed: { 
        icon: AlertTriangle, 
        text: 'Removido', 
        bgColor: 'bg-gray-50 border-gray-200',
        textColor: 'text-gray-600',
        badgeColor: 'bg-gray-100 text-gray-600 border-gray-300'
      }
    };
    
    return configs[procedure.match_status] || configs.pending;
  };

  const formatCurrency = (value?: number) => {
    if (!value) return 'R$ 0,00';
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(value / 100); // Assumindo valor em centavos
  };

  const config = getStatusConfig();
  const StatusIcon = config.icon;
  const isRemoved = procedure.match_status === 'removed';

  return (
    <Card className={`transition-all duration-300 hover:shadow-md ${config.bgColor} ${isRemoved ? 'opacity-75' : ''}`}>
      <CardContent className="p-4">
        <div className="flex items-center justify-between">
          {/* Informações Principais */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center space-x-3 mb-2">
              {/* Código e Sequência */}
              <div className="flex items-center space-x-2">
                <Badge variant="outline" className="font-mono text-xs">
                  #{procedure.procedure_sequence}
                </Badge>
                <span className="font-mono text-sm font-semibold text-gray-900">
                  {procedure.procedure_code}
                </span>
              </div>
              
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
            </div>

            {/* Descrição */}
            <div className="mb-2">
              <p className="text-sm font-medium text-gray-900 truncate">
                {procedure.procedure_description || 
                 procedure.sigtap_procedures?.description || 
                 `Procedimento ${procedure.procedure_code}`}
              </p>
              
              {/* Profissional */}
              {procedure.professional && (
                <div className="flex items-center space-x-1 mt-1">
                  <User className="w-3 h-3 text-gray-400" />
                  <span className="text-xs text-gray-600">
                    {procedure.professional} ({procedure.professional_cbo})
                  </span>
                </div>
              )}
            </div>

            {/* Valor */}
            {procedure.value_charged && (
              <div className="flex items-center space-x-1">
                <DollarSign className="w-4 h-4 text-green-600" />
                <span className="text-sm font-semibold text-green-700">
                  {formatCurrency(procedure.value_charged)}
                </span>
              </div>
            )}
          </div>

          {/* Ações */}
          {!isReadOnly && (
            <div className="flex items-center space-x-1 ml-4">
              {isRemoved ? (
                // Ações para procedimento removido
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => onRestore && handleAction(() => onRestore(procedure), 'Restaurar')}
                  disabled={isLoading}
                  className="h-8 px-2 text-blue-600 hover:text-blue-700 hover:bg-blue-50 border-blue-200"
                  title="Restaurar procedimento"
                >
                  <RotateCcw className={`w-3 h-3 ${isLoading ? 'animate-spin' : ''}`} />
                </Button>
              ) : (
                // Ações para procedimento ativo
                <>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => onRemove && handleAction(() => onRemove(procedure), 'Remover')}
                    disabled={isLoading}
                    className="h-8 px-2 text-yellow-600 hover:text-yellow-700 hover:bg-yellow-50 border-yellow-200"
                    title="Remover temporariamente"
                  >
                    <AlertTriangle className={`w-3 h-3 ${isLoading ? 'animate-pulse' : ''}`} />
                  </Button>
                </>
              )}
              
              {/* Exclusão permanente - sempre disponível */}
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
              
              {/* Detalhes */}
              <Button
                size="sm"
                variant="outline"
                onClick={() => onShowDetails?.(procedure)}
                className="h-8 px-2 text-gray-600 hover:text-gray-700 hover:bg-gray-50 border-gray-200"
                title="Ver detalhes"
              >
                <Info className="w-3 h-3" />
              </Button>
            </div>
          )}
        </div>

        {/* Complexidade SIGTAP (se disponível) */}
        {procedure.sigtap_procedures?.complexity && (
          <div className="mt-2 pt-2 border-t border-gray-100">
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
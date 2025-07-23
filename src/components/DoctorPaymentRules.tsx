/**
 * ================================================================
 * COMPONENTE DE REGRAS DE PAGAMENTO MÉDICO
 * ================================================================
 * Criado em: 2024-12-19
 * Propósito: Implementar regras específicas de pagamento por médico
 * Funcionalidade: Calcular valores adequados baseado em regras customizadas
 * ================================================================
 */

import React from 'react';
import { Badge } from './ui/badge';
import { Card, CardContent } from './ui/card';
import { DollarSign, Calculator, AlertTriangle, CheckCircle } from 'lucide-react';

// ================================================================
// TIPOS E INTERFACES
// ================================================================

export interface DoctorPaymentRule {
  doctorName: string;
  doctorCns?: string;
  rules: {
    procedureCode: string;
    standardValue: number;
    specialValue?: number;
    condition?: 'multiple' | 'single';
    description?: string;
  }[];
  multipleRule?: {
    codes: string[];
    totalValue: number;
    description: string;
  };
}

export interface ProcedurePaymentInfo {
  procedure_code: string;
  procedure_description?: string;
  value_reais: number;
  calculatedPayment?: number;
  paymentRule?: string;
  isSpecialRule?: boolean;
}

interface DoctorPaymentRulesProps {
  doctorName: string;
  procedures: ProcedurePaymentInfo[];
  className?: string;
}

// ================================================================
// REGRAS DE PAGAMENTO POR MÉDICO
// ================================================================

const DOCTOR_PAYMENT_RULES: Record<string, DoctorPaymentRule> = {
  'HUMBERTO MOREIRA DA SILVA': {
    doctorName: 'HUMBERTO MOREIRA DA SILVA',
    rules: [
      {
        procedureCode: '04.04.01.048-2',
        standardValue: 650.00,
        description: 'Valor padrão R$ 650,00'
      },
      {
        procedureCode: '04.04.01.041-5',
        standardValue: 650.00,
        description: 'Valor padrão R$ 650,00'
      },
      {
        procedureCode: '04.04.01.002-4',
        standardValue: 650.00,
        description: 'Valor padrão R$ 650,00'
      },
      {
        procedureCode: '04.04.01.001-6',
        standardValue: 650.00,
        description: 'Valor padrão R$ 650,00'
      },
      {
        procedureCode: '04.04.01.003-2',
        standardValue: 650.00,
        description: 'Valor padrão R$ 650,00'
      }
    ],
    multipleRule: {
      codes: ['04.04.01.048-2', '04.04.01.041-5', '04.04.01.002-4', '04.04.01.001-6', '04.04.01.003-2'],
      totalValue: 800.00,
      description: 'Dois ou mais procedimentos: R$ 800,00 TOTAL'
    }
  }
};

// ================================================================
// FUNÇÕES UTILITÁRIAS
// ================================================================

/**
 * 💰 CALCULAR PAGAMENTO BASEADO NAS REGRAS DO MÉDICO
 * Agora filtra apenas procedimentos com regras definidas
 */
export function calculateDoctorPayment(
  doctorName: string,
  procedures: ProcedurePaymentInfo[]
): {
  procedures: (ProcedurePaymentInfo & { calculatedPayment: number; paymentRule: string; isSpecialRule: boolean })[];
  totalPayment: number;
  appliedRule: string;
} {
  const rule = DOCTOR_PAYMENT_RULES[doctorName.toUpperCase()];
  
  if (!rule) {
    // Sem regra específica, retornar array vazio
    return {
      procedures: [],
      totalPayment: 0,
      appliedRule: 'Nenhuma regra específica'
    };
  }

  // Filtrar apenas procedimentos que estão nas regras definidas
  const allRuleCodes = [
    ...rule.rules.map(r => r.procedureCode),
    ...(rule.multipleRule?.codes || [])
  ];
  
  const filteredProcedures = procedures.filter(proc => 
    allRuleCodes.includes(proc.procedure_code)
  );

  // Se não há procedimentos com regras, retornar vazio
  if (filteredProcedures.length === 0) {
    return {
      procedures: [],
      totalPayment: 0,
      appliedRule: 'Nenhum procedimento com regra específica encontrado'
    };
  }

  // Verificar se há múltiplos procedimentos da regra especial
  const specialProcedures = filteredProcedures.filter(proc => 
    rule.multipleRule?.codes.includes(proc.procedure_code)
  );

  let calculatedProcedures: (ProcedurePaymentInfo & { calculatedPayment: number; paymentRule: string; isSpecialRule: boolean })[];
  let appliedRule: string;

  if (specialProcedures.length >= 2 && rule.multipleRule) {
    // Aplicar regra de múltiplos procedimentos
    const totalSpecialValue = rule.multipleRule.totalValue;
    const valuePerProcedure = totalSpecialValue / specialProcedures.length;

    calculatedProcedures = filteredProcedures.map(proc => {
      if (rule.multipleRule?.codes.includes(proc.procedure_code)) {
        return {
          ...proc,
          calculatedPayment: valuePerProcedure,
          paymentRule: `${rule.multipleRule.description} (R$ ${valuePerProcedure.toFixed(2)} cada)`,
          isSpecialRule: true
        };
      } else {
        // Procedimentos com regra individual
        const standardRule = rule.rules.find(r => r.procedureCode === proc.procedure_code);
        return {
          ...proc,
          calculatedPayment: standardRule!.standardValue,
          paymentRule: standardRule!.description || `R$ ${standardRule!.standardValue.toFixed(2)}`,
          isSpecialRule: true
        };
      }
    });

    appliedRule = `Regra múltiplos procedimentos: ${specialProcedures.length} procedimentos = R$ ${totalSpecialValue.toFixed(2)} total`;
  } else {
    // Aplicar regras individuais
    calculatedProcedures = filteredProcedures.map(proc => {
      const standardRule = rule.rules.find(r => r.procedureCode === proc.procedure_code);
      
      return {
        ...proc,
        calculatedPayment: standardRule!.standardValue,
        paymentRule: standardRule!.description || `R$ ${standardRule!.standardValue.toFixed(2)}`,
        isSpecialRule: true
      };
    });

    appliedRule = `Regras individuais aplicadas para ${calculatedProcedures.length} procedimento(s)`;
  }

  const totalPayment = calculatedProcedures.reduce((sum, proc) => sum + proc.calculatedPayment, 0);

  return {
    procedures: calculatedProcedures,
    totalPayment,
    appliedRule
  };
}

/**
 * 💰 FORMATAR VALOR MONETÁRIO
 */
const formatCurrency = (value: number) => {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL'
  }).format(value);
};

// ================================================================
// COMPONENTE PRINCIPAL
// ================================================================

const DoctorPaymentRules: React.FC<DoctorPaymentRulesProps> = ({
  doctorName,
  procedures,
  className = ''
}) => {
  const paymentCalculation = calculateDoctorPayment(doctorName, procedures);
  const hasSpecialRules = DOCTOR_PAYMENT_RULES[doctorName.toUpperCase()];

  if (!hasSpecialRules || paymentCalculation.procedures.length === 0) {
    return null; // Não mostrar componente se não há regras específicas ou procedimentos aplicáveis
  }

  // Calcular total original apenas dos procedimentos com regras
  const originalTotal = paymentCalculation.procedures.reduce((sum, proc) => sum + proc.value_reais, 0);
  const difference = paymentCalculation.totalPayment - originalTotal;

  return (
    <Card className={`bg-gradient-to-br from-yellow-50 to-orange-50 border-orange-200 ${className}`}>
      <CardContent className="p-4">
        <div className="space-y-3">
          {/* Cabeçalho */}
          <div className="flex items-center gap-2 mb-3">
            <Calculator className="h-5 w-5 text-orange-600" />
            <h4 className="font-semibold text-orange-800">Regras de Pagamento Específicas</h4>
            <Badge variant="outline" className="bg-orange-100 text-orange-700 border-orange-300">
              {doctorName}
            </Badge>
          </div>

          {/* Resumo da Regra Aplicada */}
          <div className="bg-white rounded-lg p-3 border border-orange-200">
            <div className="flex items-start gap-2">
              <CheckCircle className="h-4 w-4 text-green-600 mt-0.5" />
              <div className="flex-1">
                <div className="text-sm font-medium text-gray-800">
                  {paymentCalculation.appliedRule}
                </div>
                <div className="text-xs text-gray-600 mt-1">
                  {paymentCalculation.procedures.length} procedimento(s) calculado(s) - apenas códigos com regras definidas
                </div>
              </div>
            </div>
          </div>

          {/* Comparação de Valores */}
          <div className="grid grid-cols-3 gap-3">
            <div className="bg-white rounded-lg p-3 text-center border border-gray-200">
              <div className="text-xs text-gray-600 mb-1">Valor Original</div>
              <div className="font-semibold text-gray-800">{formatCurrency(originalTotal)}</div>
            </div>
            <div className="bg-white rounded-lg p-3 text-center border border-green-200">
              <div className="text-xs text-green-600 mb-1">Valor Calculado</div>
              <div className="font-semibold text-green-700">{formatCurrency(paymentCalculation.totalPayment)}</div>
            </div>
            <div className={`bg-white rounded-lg p-3 text-center border ${
              difference >= 0 ? 'border-green-200' : 'border-red-200'
            }`}>
              <div className={`text-xs mb-1 ${
                difference >= 0 ? 'text-green-600' : 'text-red-600'
              }`}>Diferença</div>
              <div className={`font-semibold ${
                difference >= 0 ? 'text-green-700' : 'text-red-700'
              }`}>
                {difference >= 0 ? '+' : ''}{formatCurrency(difference)}
              </div>
            </div>
          </div>

          {/* Detalhes por Procedimento */}
          <div className="space-y-2">
            <div className="text-sm font-medium text-gray-700">Detalhamento por Procedimento:</div>
            {paymentCalculation.procedures.map((proc, index) => (
              <div key={index} className={`bg-white rounded-lg p-2 border ${
                proc.isSpecialRule ? 'border-orange-200 bg-orange-50/30' : 'border-gray-200'
              }`}>
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs bg-gray-100 px-2 py-1 rounded">
                        {proc.procedure_code}
                      </span>
                      {proc.isSpecialRule && (
                        <Badge variant="outline" className="bg-orange-100 text-orange-700 border-orange-300 text-xs">
                          Regra Específica
                        </Badge>
                      )}
                    </div>
                    <div className="text-xs text-gray-600 mt-1">
                      {proc.paymentRule}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className={`font-semibold ${
                      proc.isSpecialRule ? 'text-orange-700' : 'text-gray-700'
                    }`}>
                      {formatCurrency(proc.calculatedPayment)}
                    </div>
                    {proc.calculatedPayment !== proc.value_reais && (
                      <div className="text-xs text-gray-500 line-through">
                        {formatCurrency(proc.value_reais)}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Aviso sobre Regras */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
            <div className="flex items-start gap-2">
              <AlertTriangle className="h-4 w-4 text-blue-600 mt-0.5" />
              <div className="text-xs text-blue-800">
                <strong>Importante:</strong> Apenas procedimentos com regras específicas definidas são exibidos e calculados. 
                Conforme regulamentação, o médico recebe pagamento somente pelos procedimentos que executa e que possuem regras estabelecidas.
              </div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default DoctorPaymentRules;
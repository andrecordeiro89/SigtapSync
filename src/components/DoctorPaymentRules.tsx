/**
 * ================================================================
 * COMPONENTE DE REGRAS DE PAGAMENTO MÉDICO - REFATORADO
 * ================================================================
 * Criado em: 2024-12-19
 * Refatorado em: 2025-11-28
 * Propósito: Exibir e calcular pagamentos médicos baseado em regras customizadas
 * Sistema Modular: Importa regras de arquivos separados por hospital
 * ================================================================
 */

import React from 'react';
import { Badge } from './ui/badge';
import { Card, CardContent } from './ui/card';
import { DollarSign, Calculator, AlertTriangle, CheckCircle, FileText } from 'lucide-react';

// ================================================================
// IMPORTS DA NOVA ESTRUTURA MODULAR
// ================================================================
import {
  calculateDoctorPayment,
  calculateFixedPayment,
  calculatePercentagePayment,
  checkUnruledProcedures,
  formatCurrency,
  type ProcedurePaymentInfo
} from '../config/doctorPaymentRules';
import { calculateHonPayments } from '../config/doctorPaymentRules/importers/honCsv'

// ================================================================
// INTERFACE DO COMPONENTE
// ================================================================

interface DoctorPaymentRulesProps {
  doctorName: string;
  procedures: ProcedurePaymentInfo[];
  hospitalId?: string;
  className?: string;
  useCsvHon?: boolean;
}

// ================================================================
// COMPONENTE PRINCIPAL
// ================================================================

export const DoctorPaymentRules: React.FC<DoctorPaymentRulesProps> = ({
  doctorName,
  procedures,
  hospitalId,
  className = '',
  useCsvHon = false
}) => {
  // Verificar se há procedimentos
  if (!procedures || procedures.length === 0) {
    return (
      <Card className={`bg-gray-50 border-gray-200 ${className}`}>
        <CardContent className="p-4">
          <div className="flex items-center gap-2 text-gray-500">
            <FileText className="h-4 w-4" />
            <span className="text-sm">Nenhum procedimento para calcular</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  // ================================================================
  // CÁLCULO PRINCIPAL
  // ================================================================
  const normalizedForRepasse = (() => {
    const list = Array.isArray(procedures) ? procedures : [];
    if (list.length === 0) return [] as Array<ProcedurePaymentInfo & { __dup04?: boolean }>;

    const seen04 = new Set<string>();
    return list.map((p) => {
      const rawCode = (p.procedure_code || '').toString();
      const codeOnly = rawCode.match(/^(\d{2}\.\d{2}\.\d{2}\.\d{3}-\d)/)?.[1] || rawCode;
      const digits = codeOnly.replace(/\D/g, '');
      const is04 = digits.startsWith('04');
      if (!is04 || digits.length === 0) return { ...p, __dup04: false };
      if (seen04.has(digits)) {
        return { ...p, cbo: '225151', __dup04: true };
      }
      seen04.add(digits);
      return { ...p, __dup04: false };
    });
  })();

  const resultRaw = useCsvHon ? calculateHonPayments(normalizedForRepasse as any) : calculateDoctorPayment(doctorName, normalizedForRepasse as any, hospitalId);
  const result = {
    ...resultRaw,
    procedures: (resultRaw.procedures || []).map((p: any) => {
      if (p?.__dup04) {
        return {
          ...p,
          calculatedPayment: 0,
          paymentRule: 'Duplicado 04.* (excluído)',
          isSpecialRule: true
        };
      }
      return p;
    })
  };
  
  // Cálculos auxiliares
  const fixedResult = calculateFixedPayment(doctorName, hospitalId);
  const totalOriginal = normalizedForRepasse.reduce((sum: number, p: any) => sum + (p.value_reais || 0), 0);
  const percentageResult = calculatePercentagePayment(doctorName, totalOriginal, hospitalId);
  const unruledCheck = checkUnruledProcedures(
    doctorName,
    normalizedForRepasse.map((p: any) => p.procedure_code),
    hospitalId
  );

  const difference = result.totalPayment - totalOriginal;
  const hasSpecialRules = result.procedures.some(p => p.isSpecialRule);

  // ================================================================
  // RENDERIZAÇÃO
  // ================================================================

  return (
    <div className={`space-y-4 ${className}`}>
      {/* ================================================================
          CARD PRINCIPAL - RESUMO
          ================================================================ */}
      <Card className="bg-gradient-to-br from-blue-50 to-indigo-50 border-blue-200">
        <CardContent className="p-6">
          <div className="flex items-start justify-between mb-4">
            <div>
              <div className="flex items-center gap-2 mb-2">
                <Calculator className="h-5 w-5 text-blue-600" />
                <h3 className="font-semibold text-lg text-gray-900">
                  Cálculo de Repasse - {doctorName}
                </h3>
              </div>
              {hospitalId && (
                <Badge variant="outline" className="text-xs">
                  Hospital ID: {hospitalId}
                </Badge>
              )}
            </div>
            
            {hasSpecialRules && (
              <Badge className="bg-purple-500">
                <CheckCircle className="h-3 w-3 mr-1" />
                Regras Especiais
              </Badge>
            )}
          </div>

          {/* Regra aplicada */}
          <div className="bg-white/50 rounded-lg p-3 mb-4">
            <p className="text-sm text-gray-600 mb-1">📋 Regra Aplicada:</p>
            <p className="text-sm font-medium text-gray-900">{result.appliedRule}</p>
          </div>

          {/* Valores */}
          <div className="grid grid-cols-3 gap-4">
            <div className="bg-white rounded-lg p-4">
              <p className="text-xs text-gray-500 mb-1">Valor Original (SUS)</p>
              <p className="text-lg font-bold text-gray-700">
                {formatCurrency(totalOriginal)}
              </p>
            </div>

            <div className="bg-white rounded-lg p-4">
              <p className="text-xs text-gray-500 mb-1">Valor Calculado</p>
              <p className="text-lg font-bold text-blue-600">
                {formatCurrency(result.totalPayment)}
              </p>
            </div>

            <div className={`bg-white rounded-lg p-4 ${
              difference > 0 ? 'border-l-4 border-green-500' : 
              difference < 0 ? 'border-l-4 border-red-500' : ''
            }`}>
              <p className="text-xs text-gray-500 mb-1">Diferença</p>
              <p className={`text-lg font-bold ${
                difference > 0 ? 'text-green-600' : 
                difference < 0 ? 'text-red-600' : 
                'text-gray-600'
              }`}>
                {difference >= 0 ? '+' : ''}{formatCurrency(difference)}
                {difference !== 0 && (
                  <span className="text-xs ml-1">
                    ({((difference / totalOriginal) * 100).toFixed(1)}%)
                  </span>
                )}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ================================================================
          DETALHAMENTO POR PROCEDIMENTO
          ================================================================ */}
      {result.procedures.length > 0 && (
        <Card>
          <CardContent className="p-6">
            <h4 className="font-semibold text-sm text-gray-700 mb-4 flex items-center gap-2">
              <FileText className="h-4 w-4" />
              Detalhamento por Procedimento ({result.procedures.length})
            </h4>
            
            <div className="space-y-3">
              {result.procedures.map((proc, index) => (
                <div 
                  key={index}
                  className={`p-4 rounded-lg border ${
                    proc.isSpecialRule 
                      ? 'bg-purple-50 border-purple-200' 
                      : 'bg-gray-50 border-gray-200'
                  }`}
                >
                  <div className="flex justify-between items-start mb-2">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <Badge variant="outline" className="text-xs font-mono">
                          {proc.procedure_code}
                        </Badge>
                        {proc.isSpecialRule && (
                          <Badge className="bg-purple-500 text-xs">
                            Regra Especial
                          </Badge>
                        )}
                      </div>
                      <p className="text-sm text-gray-700">
                        {proc.procedure_description || 'Procedimento'}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm text-gray-500">
                        Original: {formatCurrency(proc.value_reais)}
                      </p>
                      <p className="text-lg font-bold text-blue-600">
                        {formatCurrency(proc.calculatedPayment || 0)}
                      </p>
                    </div>
                  </div>
                  
                  <div className="bg-white rounded p-2 mt-2">
                    <p className="text-xs text-gray-600">
                      💡 {proc.paymentRule || 'Sem regra aplicada'}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* ================================================================
          REGRAS ADICIONAIS (Fixed e Percentage)
          ================================================================ */}
      {(fixedResult.hasFixedRule || percentageResult.hasPercentageRule) && (
        <Card className="bg-amber-50 border-amber-200">
          <CardContent className="p-6">
            <h4 className="font-semibold text-sm text-gray-700 mb-4 flex items-center gap-2">
              <DollarSign className="h-4 w-4 text-amber-600" />
              Regras Adicionais Disponíveis
            </h4>
            
            <div className="space-y-2">
              {fixedResult.hasFixedRule && (
                <div className="bg-white rounded-lg p-3">
                  <Badge className="bg-green-500 mb-2">Valor Fixo</Badge>
                  <p className="text-sm text-gray-700">{fixedResult.appliedRule}</p>
                  <p className="text-lg font-bold text-green-600 mt-1">
                    {formatCurrency(fixedResult.calculatedPayment)}
                  </p>
                </div>
              )}

              {percentageResult.hasPercentageRule && (
                <div className="bg-white rounded-lg p-3">
                  <Badge className="bg-blue-500 mb-2">Percentual</Badge>
                  <p className="text-sm text-gray-700">{percentageResult.appliedRule}</p>
                  <p className="text-lg font-bold text-blue-600 mt-1">
                    {formatCurrency(percentageResult.calculatedPayment)}
                  </p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* ================================================================
          ALERTA DE PROCEDIMENTOS SEM REGRAS
          ================================================================ */}
      {false && (
        <Card className="bg-red-50 border-red-200">
          <CardContent className="p-4">
            <div className="flex items-start gap-3">
              <AlertTriangle className="h-5 w-5 text-red-600 mt-0.5" />
              <div className="flex-1">
                <h4 className="font-semibold text-sm text-red-900 mb-2">
                  ⚠️ Procedimentos Sem Regras Definidas ({unruledCheck.totalUnruled})
                </h4>
                <p className="text-sm text-red-700 mb-2">
                  Os seguintes procedimentos médicos não possuem regras de pagamento configuradas:
                </p>
                <div className="flex flex-wrap gap-2">
                  {unruledCheck.unruledProcedures.map((code, idx) => (
                    <Badge key={idx} variant="outline" className="bg-white border-red-300 text-red-700">
                      {code}
                    </Badge>
                  ))}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default DoctorPaymentRules;

// ================================================================
// RE-EXPORTAR TIPOS PARA COMPATIBILIDADE
// ================================================================
export type { ProcedurePaymentInfo };

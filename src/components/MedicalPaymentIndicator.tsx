import React from 'react';
import { isMedicalProcedure, calculateMedicalPayment } from '../config/susCalculationRules';

// Interface para props do componente
interface MedicalPaymentIndicatorProps {
  procedureCode: string;
  showLabel?: boolean;
  size?: 'small' | 'medium' | 'large';
  className?: string;
}

// Interface para o resumo de pagamento
interface PaymentSummaryProps {
  procedures: Array<{
    procedureCode: string;
    valueHosp: number;
    valueProf: number;
    valueAmb: number;
    calculatedTotal?: number;
  }>;
  showBreakdown?: boolean;
  className?: string;
}

/**
 * 🏥 INDICADOR DE PAGAMENTO MÉDICO
 * 
 * Componente que sinaliza visualmente se um procedimento gera pagamento para médicos
 * - Verde: Procedimentos "04" (pagamento médico)
 * - Azul: Outros procedimentos (receita do hospital)
 */
export const MedicalPaymentIndicator: React.FC<MedicalPaymentIndicatorProps> = ({
  procedureCode,
  showLabel = true,
  size = 'medium',
  className = ''
}) => {
  const isMedical = isMedicalProcedure(procedureCode);
  
  const sizeClasses = {
    small: 'px-2 py-1 text-xs',
    medium: 'px-3 py-1 text-sm',
    large: 'px-4 py-2 text-base'
  };
  
  const baseClasses = `inline-flex items-center rounded-full font-medium ${sizeClasses[size]} ${className}`;
  
  if (isMedical) {
    return (
      <span className={`${baseClasses} bg-green-100 text-green-800 border border-green-200`}>
        <span className="mr-1">💰</span>
        {showLabel && 'Pagamento Médico'}
      </span>
    );
  }
  
  return (
    <span className={`${baseClasses} bg-blue-100 text-blue-800 border border-blue-200`}>
      <span className="mr-1">🏥</span>
      {showLabel && 'Receita Hospital'}
    </span>
  );
};

/**
 * 📊 RESUMO DE PAGAMENTO MÉDICO
 * 
 * Componente que exibe o resumo dos valores de pagamento médico vs hospital
 */
export const MedicalPaymentSummary: React.FC<PaymentSummaryProps> = ({
  procedures,
  showBreakdown = false,
  className = ''
}) => {
  const paymentData = calculateMedicalPayment(procedures);
  
  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(value / 100); // Convertendo de centavos para reais
  };
  
  return (
    <div className={`bg-gray-50 rounded-lg p-4 ${className}`}>
      <h3 className="text-lg font-semibold mb-3 text-gray-800">
        💰 Divisão de Pagamentos
      </h3>
      
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
        {/* Pagamento Médico */}
        <div className="bg-green-50 border border-green-200 rounded-lg p-3">
          <div className="flex items-center mb-2">
            <span className="text-green-600 mr-2">💰</span>
            <span className="font-medium text-green-800">Pagamento Médico</span>
          </div>
          <div className="text-2xl font-bold text-green-700">
            {formatCurrency(paymentData.medicalPayment)}
          </div>
          <div className="text-sm text-green-600">
            {paymentData.medicalProcedures.length} procedimento(s) "04"
          </div>
        </div>
        
        {/* Receita Hospital */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
          <div className="flex items-center mb-2">
            <span className="text-blue-600 mr-2">🏥</span>
            <span className="font-medium text-blue-800">Receita Hospital</span>
          </div>
          <div className="text-2xl font-bold text-blue-700">
            {formatCurrency(paymentData.hospitalRevenue)}
          </div>
          <div className="text-sm text-blue-600">
            {paymentData.hospitalProcedures.length} outros procedimento(s)
          </div>
        </div>
        
        {/* Total */}
        <div className="bg-gray-100 border border-gray-300 rounded-lg p-3">
          <div className="flex items-center mb-2">
            <span className="text-gray-600 mr-2">📊</span>
            <span className="font-medium text-gray-800">Total AIH</span>
          </div>
          <div className="text-2xl font-bold text-gray-700">
            {formatCurrency(paymentData.totalValue)}
          </div>
          <div className="text-sm text-gray-600">
            {procedures.length} procedimento(s) total
          </div>
        </div>
      </div>
      
      {/* Breakdown detalhado */}
      {showBreakdown && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Procedimentos Médicos */}
          {paymentData.breakdown.medical.length > 0 && (
            <div>
              <h4 className="font-medium text-green-800 mb-2">
                💰 Procedimentos Médicos (Código "04")
              </h4>
              <div className="space-y-1">
                {paymentData.breakdown.medical.map((item, index) => (
                  <div key={index} className="flex justify-between text-sm bg-green-50 p-2 rounded">
                    <span className="font-mono">{item.code}</span>
                    <span className="font-medium text-green-700">
                      {formatCurrency(item.value)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
          
          {/* Procedimentos do Hospital */}
          {paymentData.breakdown.hospital.length > 0 && (
            <div>
              <h4 className="font-medium text-blue-800 mb-2">
                🏥 Procedimentos do Hospital
              </h4>
              <div className="space-y-1">
                {paymentData.breakdown.hospital.map((item, index) => (
                  <div key={index} className="flex justify-between text-sm bg-blue-50 p-2 rounded">
                    <span className="font-mono">{item.code}</span>
                    <span className="font-medium text-blue-700">
                      {formatCurrency(item.value)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
      
      {/* Nota explicativa */}
      <div className="mt-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
        <div className="flex items-start">
          <span className="text-yellow-600 mr-2 mt-0.5">ℹ️</span>
          <div className="text-sm text-yellow-800">
            <strong>Regra de Pagamento:</strong> Procedimentos com código iniciando em "04" 
            geram pagamento para médicos. Outros procedimentos ficam como receita do hospital.
          </div>
        </div>
      </div>
    </div>
  );
};

export default MedicalPaymentIndicator;
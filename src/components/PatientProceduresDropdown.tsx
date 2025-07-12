/**
 * ================================================================
 * DROPDOWN DE PROCEDIMENTOS POR PACIENTE
 * ================================================================
 * Componente para mostrar procedimentos individuais de cada paciente
 * com nome, valor e detalhes em formato dropdown
 * ================================================================
 */

import React, { useState } from 'react';
import { Button } from './ui/button';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Badge } from './ui/badge';
import { 
  ChevronDown, 
  ChevronUp, 
  FileText, 
  Calendar, 
  DollarSign,
  Hash,
  Calculator,
  TrendingUp,
  Activity
} from 'lucide-react';

// ================================================================
// TIPOS E INTERFACES
// ================================================================

interface ProcedureDetail {
  procedure_code: string;
  procedure_name: string;
  procedure_date: string;
  value_charged: number;
  value_total: number;
  quantity: number;
  unit_value: number;
}

interface PatientProceduresDropdownProps {
  patientName: string;
  patientCns: string;
  procedures: ProcedureDetail[];
  isExpanded: boolean;
  onToggle: () => void;
}

// ================================================================
// COMPONENTE PRINCIPAL
// ================================================================

const PatientProceduresDropdown: React.FC<PatientProceduresDropdownProps> = ({
  patientName,
  patientCns,
  procedures,
  isExpanded,
  onToggle
}) => {
  
  // ================================================================
  // UTILITÁRIOS
  // ================================================================
  
  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(value / 100); // Valor em centavos
  };
  
  const formatDate = (dateString: string) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleDateString('pt-BR');
  };
  
  const getTotalValue = () => {
    return procedures.reduce((sum, proc) => sum + proc.value_total, 0);
  };
  
  const getTotalQuantity = () => {
    return procedures.reduce((sum, proc) => sum + proc.quantity, 0);
  };
  
  // ================================================================
  // RENDER
  // ================================================================
  
  return (
    <Card className="border-l-4 border-l-blue-500 bg-white">
      <CardHeader className="pb-3">
        {/* Header do Paciente */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-100 rounded-full">
              <FileText className="h-5 w-5 text-blue-600" />
            </div>
            <div>
              <CardTitle className="text-lg font-semibold text-gray-900">
                {patientName}
              </CardTitle>
              <div className="text-sm text-gray-600">
                CNS: {patientCns || 'Não informado'}
              </div>
            </div>
          </div>
          
          {/* Resumo do Paciente */}
          <div className="flex items-center gap-4">
            <div className="text-center">
              <div className="text-xl font-bold text-blue-600">
                {procedures.length}
              </div>
              <div className="text-xs text-gray-600">Procedimentos</div>
            </div>
            
            <div className="text-center">
              <div className="text-xl font-bold text-green-600">
                {formatCurrency(getTotalValue())}
              </div>
              <div className="text-xs text-gray-600">Valor Total</div>
            </div>
            
            <Button
              variant="outline"
              size="sm"
              onClick={onToggle}
              className="flex items-center gap-2"
            >
              {isExpanded ? (
                <>
                  <ChevronUp className="h-4 w-4" />
                  Ocultar
                </>
              ) : (
                <>
                  <ChevronDown className="h-4 w-4" />
                  Ver Detalhes
                </>
              )}
            </Button>
          </div>
        </div>
      </CardHeader>
      
      {/* Conteúdo Expandido */}
      {isExpanded && (
        <CardContent className="pt-0">
          <div className="space-y-4">
            
            {/* Resumo Geral */}
            <div className="grid grid-cols-3 gap-4 p-4 bg-gray-50 rounded-lg">
              <div className="text-center">
                <div className="flex items-center justify-center gap-2 mb-1">
                  <Calculator className="h-4 w-4 text-purple-600" />
                  <span className="text-sm font-medium">Quantidade Total</span>
                </div>
                <div className="text-lg font-bold text-purple-600">
                  {getTotalQuantity()}
                </div>
              </div>
              
              <div className="text-center">
                <div className="flex items-center justify-center gap-2 mb-1">
                  <TrendingUp className="h-4 w-4 text-orange-600" />
                  <span className="text-sm font-medium">Valor Médio</span>
                </div>
                <div className="text-lg font-bold text-orange-600">
                  {formatCurrency(getTotalValue() / procedures.length)}
                </div>
              </div>
              
              <div className="text-center">
                <div className="flex items-center justify-center gap-2 mb-1">
                  <Activity className="h-4 w-4 text-green-600" />
                  <span className="text-sm font-medium">Procedimentos</span>
                </div>
                <div className="text-lg font-bold text-green-600">
                  {procedures.length}
                </div>
              </div>
            </div>
            
            {/* Lista de Procedimentos */}
            <div className="space-y-3">
              <h4 className="font-semibold text-gray-900 flex items-center gap-2">
                <FileText className="h-4 w-4" />
                Procedimentos Realizados
              </h4>
              
              {procedures.length > 0 ? (
                procedures.map((procedure, index) => (
                  <div 
                    key={index} 
                    className="border rounded-lg p-4 bg-white hover:bg-gray-50 transition-colors"
                  >
                    <div className="flex items-start justify-between">
                      {/* Informações do Procedimento */}
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <Badge variant="outline" className="text-xs">
                            {procedure.procedure_code}
                          </Badge>
                          <span className="text-sm text-gray-600">
                            {formatDate(procedure.procedure_date)}
                          </span>
                        </div>
                        
                        <h5 className="font-medium text-gray-900 mb-2 leading-tight">
                          {procedure.procedure_name || 'Procedimento sem nome'}
                        </h5>
                        
                        {/* Detalhes Financeiros */}
                        <div className="grid grid-cols-3 gap-4 text-sm">
                          <div>
                            <span className="text-gray-600">Quantidade:</span>
                            <div className="font-semibold">{procedure.quantity}</div>
                          </div>
                          
                          <div>
                            <span className="text-gray-600">Valor Unitário:</span>
                            <div className="font-semibold">
                              {formatCurrency(procedure.unit_value)}
                            </div>
                          </div>
                          
                          <div>
                            <span className="text-gray-600">Valor Total:</span>
                            <div className="font-semibold text-green-600">
                              {formatCurrency(procedure.value_total)}
                            </div>
                          </div>
                        </div>
                      </div>
                      
                      {/* Valor Destacado */}
                      <div className="ml-4 text-right">
                        <div className="text-2xl font-bold text-green-600">
                          {formatCurrency(procedure.value_total)}
                        </div>
                        <div className="text-sm text-gray-600">
                          {procedure.quantity}x {formatCurrency(procedure.unit_value)}
                        </div>
                      </div>
                    </div>
                  </div>
                ))
              ) : (
                <div className="text-center py-8 text-gray-500">
                  <FileText className="h-12 w-12 mx-auto mb-4 text-gray-300" />
                  <p>Nenhum procedimento detalhado encontrado</p>
                </div>
              )}
            </div>
          </div>
        </CardContent>
      )}
    </Card>
  );
};

export default PatientProceduresDropdown; 
/**
 * ================================================================
 * DASHBOARD DE FATURAMENTO POR ESPECIALIDADES
 * ================================================================
 * Criado em: 2024-12-19
 * Propósito: Análise executiva de faturamento por especialidade médica
 * View utilizada: v_specialty_revenue_stats
 * ================================================================
 */

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Badge } from './ui/badge';
import { Button } from './ui/button';
import { Skeleton } from './ui/skeleton';
import { 
  RefreshCw,
  Download
} from 'lucide-react';
import { DoctorsRevenueService, type SpecialtyStats } from '../services/doctorsRevenueService';
import { toast } from './ui/use-toast';

// ================================================================
// COMPONENTE PRINCIPAL
// ================================================================

const SpecialtyRevenueDashboard: React.FC = () => {
  const [specialtyStats, setSpecialtyStats] = useState<SpecialtyStats[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  /**
   * 📊 CARREGAR ESTATÍSTICAS DAS ESPECIALIDADES
   */
  const loadSpecialtyStats = async () => {
    try {
      setIsLoading(true);
      setError(null);
      
      const stats = await DoctorsRevenueService.getSpecialtyStats();
      setSpecialtyStats(stats);
      
      console.log(`✅ Carregadas estatísticas de ${stats.length} especialidades`);
      
    } catch (error) {
      console.error('❌ Erro ao carregar estatísticas das especialidades:', error);
      const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido';
      setError(errorMessage);
      toast({
        variant: "destructive",
        title: "Erro",
        description: `Erro ao carregar dados: ${errorMessage}`
      });
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * 💰 FORMATAR MOEDA
   */
  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(value);
  };

  /**
   * 🔢 FORMATAR NÚMERO
   */
  const formatNumber = (value: number) => {
    return new Intl.NumberFormat('pt-BR').format(Math.round(value));
  };

  // Carregar dados na inicialização
  useEffect(() => {
    loadSpecialtyStats();
  }, []);

  // ================================================================
  // RENDERIZAÇÃO
  // ================================================================

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Card>
          <CardHeader>
            <Skeleton className="h-6 w-64" />
          </CardHeader>
          <CardContent>
            <Skeleton className="h-64 w-full" />
          </CardContent>
        </Card>
      </div>
    );
  }

  if (error) {
    return (
      <Card>
        <CardContent className="pt-6">
          <div className="text-center text-red-600">
            <p>❌ {error}</p>
            <Button 
              onClick={loadSpecialtyStats} 
              variant="outline" 
              className="mt-4"
            >
              <RefreshCw className="w-4 h-4 mr-2" />
              Tentar Novamente
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Cabeçalho */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">
            Dashboard de Especialidades
          </h2>
          <p className="text-gray-600">
            Análise de faturamento por especialidade médica com dados reais
          </p>
        </div>
        <div className="flex space-x-2">
          <Button onClick={loadSpecialtyStats} variant="outline" size="sm">
            <RefreshCw className="w-4 h-4 mr-2" />
            Atualizar
          </Button>
          <Button variant="outline" size="sm">
            <Download className="w-4 h-4 mr-2" />
            Exportar
          </Button>
        </div>
      </div>

      {/* Tabela de Especialidades */}
      <Card>
        <CardHeader>
          <CardTitle>Ranking de Especialidades por Faturamento</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    #
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Especialidade
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Médicos
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Faturamento Total
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Média por Médico
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Procedimentos
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {specialtyStats.map((specialty, index) => (
                  <tr key={specialty.doctor_specialty} className="hover:bg-gray-50">
                    <td className="px-4 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                      {index + 1}
                    </td>
                    <td className="px-4 py-4 whitespace-nowrap">
                      <div className="font-medium text-gray-900">
                        {specialty.doctor_specialty}
                      </div>
                    </td>
                    <td className="px-4 py-4 whitespace-nowrap text-right text-sm text-gray-600">
                      <Badge variant="secondary">
                        {specialty.doctors_count}
                      </Badge>
                    </td>
                    <td className="px-4 py-4 whitespace-nowrap text-right text-sm font-medium text-green-600">
                      {formatCurrency(specialty.total_specialty_revenue_reais)}
                    </td>
                    <td className="px-4 py-4 whitespace-nowrap text-right text-sm text-blue-600">
                      {formatCurrency(specialty.avg_doctor_revenue_reais)}
                    </td>
                    <td className="px-4 py-4 whitespace-nowrap text-right text-sm text-gray-600">
                      {formatNumber(specialty.total_procedures)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          
          {/* Rodapé com informações */}
          {specialtyStats.length === 0 && (
            <div className="text-center py-8 text-gray-500">
              <p>📊 Nenhuma especialidade encontrada</p>
              <p className="text-sm mt-2">
                Verifique se há médicos cadastrados no sistema com especialidades definidas.
              </p>
            </div>
          )}
          
          {specialtyStats.length > 0 && (
            <div className="mt-4 text-sm text-gray-500 text-center">
              📊 Dados baseados em faturamento dos últimos 12 meses • {specialtyStats.length} especialidades encontradas
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default SpecialtyRevenueDashboard; 
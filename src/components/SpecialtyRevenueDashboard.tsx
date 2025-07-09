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
  BarChart3, 
  TrendingUp, 
  Users, 
  DollarSign, 
  Activity,
  Award,
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

  /**
   * 📈 OBTER COR DA PERFORMANCE
   */
  const getPerformanceColor = (rate: number) => {
    if (rate >= 80) return 'text-green-600 bg-green-50';
    if (rate >= 60) return 'text-yellow-600 bg-yellow-50';
    return 'text-red-600 bg-red-50';
  };

  /**
   * 📊 CALCULAR MÉTRICAS EXECUTIVAS
   */
  const executiveMetrics = React.useMemo(() => {
    if (specialtyStats.length === 0) return null;

    const totalRevenue = specialtyStats.reduce((sum, s) => sum + s.total_specialty_revenue_reais, 0);
    const totalDoctors = specialtyStats.reduce((sum, s) => sum + s.doctors_count, 0);
    const totalProcedures = specialtyStats.reduce((sum, s) => sum + s.total_procedures, 0);
    const avgPaymentRate = specialtyStats.reduce((sum, s) => sum + s.avg_payment_rate, 0) / specialtyStats.length;

    const topSpecialty = specialtyStats[0]; // Já vem ordenado por faturamento

    return {
      totalSpecialties: specialtyStats.length,
      totalRevenue,
      totalDoctors,
      totalProcedures,
      avgRevenuePerSpecialty: totalRevenue / specialtyStats.length,
      avgPaymentRate,
      topSpecialty
    };
  }, [specialtyStats]);

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
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <Card key={i}>
              <CardHeader className="pb-2">
                <Skeleton className="h-4 w-24" />
              </CardHeader>
              <CardContent>
                <Skeleton className="h-8 w-32 mb-2" />
                <Skeleton className="h-3 w-20" />
              </CardContent>
            </Card>
          ))}
        </div>
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

  if (error || !executiveMetrics) {
    return (
      <Card>
        <CardContent className="pt-6">
          <div className="text-center text-red-600">
            <p>❌ {error || 'Erro ao carregar dados'}</p>
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
            Análise de faturamento por especialidade médica
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

      {/* Métricas Executivas */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600 flex items-center">
              <BarChart3 className="w-4 h-4 mr-2" />
              Total de Especialidades
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-gray-900">
              {executiveMetrics.totalSpecialties}
            </div>
            <p className="text-xs text-gray-500">especialidades ativas</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600 flex items-center">
              <DollarSign className="w-4 h-4 mr-2" />
              Faturamento Total
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              {formatCurrency(executiveMetrics.totalRevenue)}
            </div>
            <p className="text-xs text-gray-500">todas as especialidades</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600 flex items-center">
              <Users className="w-4 h-4 mr-2" />
              Médicos Ativos
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">
              {formatNumber(executiveMetrics.totalDoctors)}
            </div>
            <p className="text-xs text-gray-500">em todas as especialidades</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600 flex items-center">
              <Activity className="w-4 h-4 mr-2" />
              Taxa de Pagamento
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-purple-600">
              {executiveMetrics.avgPaymentRate.toFixed(1)}%
            </div>
            <p className="text-xs text-gray-500">média geral</p>
          </CardContent>
        </Card>
      </div>

      {/* Especialidade Destaque */}
      {executiveMetrics.topSpecialty && (
        <Card className="border-l-4 border-l-green-500">
          <CardHeader>
            <CardTitle className="flex items-center text-green-700">
              <Award className="w-5 h-5 mr-2" />
              Especialidade com Maior Faturamento
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div>
                <h4 className="font-semibold text-lg text-gray-900">
                  {executiveMetrics.topSpecialty.doctor_specialty}
                </h4>
                <p className="text-sm text-gray-600">
                  {executiveMetrics.topSpecialty.doctors_count} médicos
                </p>
              </div>
              <div>
                <p className="text-sm text-gray-600">Faturamento Total</p>
                <p className="font-bold text-green-600">
                  {formatCurrency(executiveMetrics.topSpecialty.total_specialty_revenue_reais)}
                </p>
              </div>
              <div>
                <p className="text-sm text-gray-600">Média por Médico</p>
                <p className="font-bold text-blue-600">
                  {formatCurrency(executiveMetrics.topSpecialty.avg_doctor_revenue_reais)}
                </p>
              </div>
              <div>
                <p className="text-sm text-gray-600">Taxa de Pagamento</p>
                <Badge className={getPerformanceColor(executiveMetrics.topSpecialty.avg_payment_rate)}>
                  {executiveMetrics.topSpecialty.avg_payment_rate.toFixed(1)}%
                </Badge>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

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
                  <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Taxa Pagamento
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
                    <td className="px-4 py-4 whitespace-nowrap text-center">
                      <Badge className={getPerformanceColor(specialty.avg_payment_rate)}>
                        {specialty.avg_payment_rate.toFixed(1)}%
                      </Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default SpecialtyRevenueDashboard; 
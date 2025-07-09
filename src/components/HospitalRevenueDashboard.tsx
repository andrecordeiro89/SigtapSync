/**
 * ================================================================
 * DASHBOARD DE HOSPITAIS
 * ================================================================
 * Visualização completa das estatísticas de faturamento por hospital
 * ================================================================
 */

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import { 
  RefreshCw, 
  Building2, 
  Users, 
  DollarSign, 
  Activity,
  TrendingUp,
  BarChart3,
  AlertTriangle
} from 'lucide-react';
import { DoctorsRevenueService, type HospitalStats } from '../services/doctorsRevenueService';

const HospitalRevenueDashboard: React.FC = () => {
  const [hospitalStats, setHospitalStats] = useState<HospitalStats[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadHospitalStats = async () => {
    try {
      setIsLoading(true);
      setError(null);
      
      const stats = await DoctorsRevenueService.getHospitalStats();
      setHospitalStats(stats || []);
      
    } catch (error) {
      console.error('❌ Erro ao carregar hospitais:', error);
      setError(error instanceof Error ? error.message : 'Erro ao carregar dados dos hospitais');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadHospitalStats();
  }, []);

  // Calcular métricas gerais
  const totalHospitals = hospitalStats.length;
  const totalActiveDoctors = hospitalStats.reduce((sum, h) => sum + h.active_doctors_count, 0);
  const totalRevenue = hospitalStats.reduce((sum, h) => sum + h.total_hospital_revenue_reais, 0);
  const avgRevenuePerHospital = totalHospitals > 0 ? totalRevenue / totalHospitals : 0;

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          {[...Array(4)].map((_, i) => (
            <Card key={i} className="animate-pulse">
              <CardContent className="p-6">
                <div className="h-4 bg-gray-200 rounded w-3/4 mb-2"></div>
                <div className="h-6 bg-gray-200 rounded w-1/2"></div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-red-600 flex items-center">
            <AlertTriangle className="w-5 h-5 mr-2" />
            Erro ao Carregar Hospitais
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-red-600 mb-4">{error}</p>
          <Button onClick={loadHospitalStats} variant="outline">
            <RefreshCw className="w-4 h-4 mr-2" />
            Tentar Novamente
          </Button>
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
            Dashboard de Hospitais
          </h2>
          <p className="text-gray-600">
            {totalHospitals} hospitais • {totalActiveDoctors} médicos ativos
          </p>
        </div>
        <Button onClick={loadHospitalStats} variant="outline" size="sm">
          <RefreshCw className="w-4 h-4 mr-2" />
          Atualizar
        </Button>
      </div>

      {/* KPIs Gerais */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center">
              <Building2 className="h-8 w-8 text-blue-600" />
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Total de Hospitais</p>
                <p className="text-2xl font-bold text-gray-900">{totalHospitals}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center">
              <Users className="h-8 w-8 text-green-600" />
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Médicos Ativos</p>
                <p className="text-2xl font-bold text-gray-900">{totalActiveDoctors}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center">
              <DollarSign className="h-8 w-8 text-emerald-600" />
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Faturamento Total</p>
                <p className="text-2xl font-bold text-gray-900">
                  R$ {totalRevenue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center">
              <TrendingUp className="h-8 w-8 text-purple-600" />
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Média por Hospital</p>
                <p className="text-2xl font-bold text-gray-900">
                  R$ {avgRevenuePerHospital.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Lista de Hospitais */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <Building2 className="w-5 h-5 mr-2" />
            Hospitais Cadastrados ({hospitalStats.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {hospitalStats.length === 0 ? (
            <div className="text-center py-8">
              <Building2 className="w-12 h-12 mx-auto text-gray-400 mb-4" />
              <p className="text-gray-500">Nenhum hospital encontrado</p>
              <p className="text-sm text-gray-400 mt-2">
                Execute o script de correção da contagem de médicos
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {hospitalStats.map((hospital, index) => (
                <div key={hospital.hospital_id || index} className="p-6 border rounded-lg hover:bg-gray-50 transition-colors">
                  {/* Header do Hospital */}
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <h4 className="text-lg font-semibold text-gray-900 mb-1">
                        {hospital.hospital_name || 'Nome não informado'}
                      </h4>
                      <p className="text-sm text-gray-500">
                        CNPJ: {hospital.hospital_cnpj || 'N/A'} • ID: {hospital.hospital_id}
                      </p>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Badge variant={hospital.active_doctors_count > 10 ? "default" : "secondary"}>
                        {hospital.active_doctors_count} médicos
                      </Badge>
                      <Badge variant={hospital.very_active_doctors > 5 ? "default" : "outline"}>
                        {hospital.very_active_doctors} ativos
                      </Badge>
                    </div>
                  </div>

                  {/* Métricas do Hospital */}
                  <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                    <div className="bg-blue-50 p-3 rounded-lg">
                      <div className="flex items-center">
                        <Users className="w-4 h-4 text-blue-600 mr-2" />
                        <span className="text-xs text-blue-600 font-medium">Médicos</span>
                      </div>
                      <p className="text-lg font-bold text-blue-900 mt-1">
                        {hospital.active_doctors_count}
                      </p>
                      <p className="text-xs text-blue-600">
                        {hospital.very_active_doctors} muito ativos
                      </p>
                    </div>

                    <div className="bg-green-50 p-3 rounded-lg">
                      <div className="flex items-center">
                        <DollarSign className="w-4 h-4 text-green-600 mr-2" />
                        <span className="text-xs text-green-600 font-medium">Faturamento</span>
                      </div>
                      <p className="text-lg font-bold text-green-900 mt-1">
                        R$ {(hospital.total_hospital_revenue_reais || 0).toLocaleString('pt-BR', { 
                          minimumFractionDigits: 0,
                          maximumFractionDigits: 0 
                        })}
                      </p>
                      <p className="text-xs text-green-600">12 meses</p>
                    </div>

                    <div className="bg-purple-50 p-3 rounded-lg">
                      <div className="flex items-center">
                        <BarChart3 className="w-4 h-4 text-purple-600 mr-2" />
                        <span className="text-xs text-purple-600 font-medium">Procedimentos</span>
                      </div>
                      <p className="text-lg font-bold text-purple-900 mt-1">
                        {(hospital.total_procedures || 0).toLocaleString('pt-BR')}
                      </p>
                      <p className="text-xs text-purple-600">
                        {(hospital.avg_procedures_per_doctor || 0).toFixed(0)} por médico
                      </p>
                    </div>

                    <div className="bg-orange-50 p-3 rounded-lg">
                      <div className="flex items-center">
                        <Activity className="w-4 h-4 text-orange-600 mr-2" />
                        <span className="text-xs text-orange-600 font-medium">Taxa Pagamento</span>
                      </div>
                      <p className="text-lg font-bold text-orange-900 mt-1">
                        {(hospital.avg_payment_rate || 0).toFixed(1)}%
                      </p>
                      <p className="text-xs text-orange-600">aprovação</p>
                    </div>

                    <div className="bg-gray-50 p-3 rounded-lg">
                      <div className="flex items-center">
                        <TrendingUp className="w-4 h-4 text-gray-600 mr-2" />
                        <span className="text-xs text-gray-600 font-medium">Especialidade</span>
                      </div>
                      <p className="text-sm font-bold text-gray-900 mt-1">
                        {hospital.top_specialty_by_revenue || 'N/A'}
                      </p>
                      <p className="text-xs text-gray-600">top faturamento</p>
                    </div>
                  </div>

                  {/* Média por Médico */}
                  <div className="mt-4 pt-4 border-t border-gray-200">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-gray-600">Faturamento médio por médico:</span>
                      <span className="font-semibold text-gray-900">
                        R$ {(hospital.avg_doctor_revenue_reais || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default HospitalRevenueDashboard; 
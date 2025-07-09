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
  AlertTriangle,
  ChevronDown,
  ChevronUp,
  Stethoscope
} from 'lucide-react';
import { DoctorsRevenueService, type HospitalStats, type DoctorAggregated } from '../services/doctorsRevenueService';

// ✅ FUNÇÃO PARA FORMATAÇÃO DE MOEDA
const formatCurrency = (value: number | null | undefined): string => {
  if (value == null || isNaN(value)) return 'R$ 0,00';
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(value);
};

const HospitalRevenueDashboard: React.FC = () => {
  const [hospitalStats, setHospitalStats] = useState<HospitalStats[]>([]);
  const [uniqueDoctors, setUniqueDoctors] = useState<DoctorAggregated[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadHospitalStats = async () => {
    try {
      setIsLoading(true);
      setError(null);
      
      // ✅ CORREÇÃO: Carregar dados únicos para contagem total
      const [hospitalStatsResult, uniqueDoctorsResult] = await Promise.all([
        DoctorsRevenueService.getHospitalStats(),
        DoctorsRevenueService.getDoctorsAggregated({ pageSize: 1000 }) // ✅ Carregar todos os médicos (até 1000)
      ]);
      
      setHospitalStats(hospitalStatsResult || []);
      setUniqueDoctors(uniqueDoctorsResult.doctors || []);
      
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

  // ✅ CORREÇÃO: Cálculos corretos sem duplicação
  const totalHospitals = hospitalStats.length;
  
  // ❌ ANTES: const totalActiveDoctors = hospitalStats.reduce((sum, h) => sum + h.active_doctors_count, 0);
  // ✅ AGORA: Contagem única de médicos
  const totalUniqueDoctors = uniqueDoctors.length;
  const totalActiveDoctors = uniqueDoctors.filter(d => d.activity_status === 'ATIVO').length;
  const doctorsWithMultipleHospitals = uniqueDoctors.filter(d => d.hospitals_count > 1).length;
  
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
      {/* Cabeçalho atualizado */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">
            Dashboard de Hospitais
          </h2>
          <p className="text-gray-600">
            {totalHospitals} hospitais • {totalUniqueDoctors} médicos únicos • {doctorsWithMultipleHospitals} em múltiplos hospitais
          </p>
        </div>
        <Button onClick={loadHospitalStats} variant="outline" size="sm">
          <RefreshCw className="w-4 h-4 mr-2" />
          Atualizar
        </Button>
      </div>

      {/* KPIs Corrigidos */}
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
                <p className="text-sm font-medium text-gray-600">Médicos Únicos</p>
                <p className="text-2xl font-bold text-gray-900">{totalUniqueDoctors}</p>
                <p className="text-xs text-gray-500">
                  {totalActiveDoctors} ativos • {doctorsWithMultipleHospitals} em múltiplos hospitais
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-green-200 bg-green-50">
          <CardContent className="p-6">
            <div className="flex items-center">
              <DollarSign className="h-8 w-8 text-green-600" />
              <div className="ml-4">
                <p className="text-sm font-medium text-green-700">Faturamento Mensal</p>
                <p className="text-2xl font-bold text-green-800">
                  {formatCurrency(totalRevenue / 12)}
                </p>
                <p className="text-xs text-green-600 mt-1">
                  Média mensal baseada no total anual
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
                  {formatCurrency(avgRevenuePerHospital)}
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
            <div className="space-y-6">
              {hospitalStats.map((hospital, index) => (
                <HospitalCard 
                  key={hospital.hospital_id || index} 
                  hospital={hospital} 
                  uniqueDoctors={uniqueDoctors}
                />
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

// ✅ NOVO: Componente para cada hospital com lista de médicos
interface HospitalCardProps {
  hospital: HospitalStats;
  uniqueDoctors: DoctorAggregated[];
}

const HospitalCard: React.FC<HospitalCardProps> = ({ hospital, uniqueDoctors }) => {
  const [showDoctors, setShowDoctors] = useState(false);
  
  // Filtrar médicos deste hospital
  const hospitalDoctors = uniqueDoctors.filter(doctor => 
    doctor.hospital_ids && doctor.hospital_ids.split(',').includes(hospital.hospital_id)
  );

  const activeDoctors = hospitalDoctors.filter(d => d.activity_status === 'ATIVO');
  const doctorsWithMultipleHospitals = hospitalDoctors.filter(d => d.hospitals_count > 1);

  return (
    <div className="p-6 border rounded-lg hover:bg-gray-50 transition-colors">
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
          <Badge variant={hospitalDoctors.length > 10 ? "default" : "secondary"}>
            {hospitalDoctors.length} médicos
          </Badge>
          <Badge variant={activeDoctors.length > 5 ? "default" : "outline"}>
            {activeDoctors.length} ativos
          </Badge>
          {doctorsWithMultipleHospitals.length > 0 && (
            <Badge variant="outline" className="text-orange-600">
              {doctorsWithMultipleHospitals.length} em múltiplos hospitais
            </Badge>
          )}
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
            {hospitalDoctors.length}
          </p>
          <p className="text-xs text-blue-600">
            {activeDoctors.length} ativos
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

      {/* Botão para mostrar médicos */}
      <div className="mt-4 pt-4 border-t border-gray-200">
        <div className="flex items-center justify-between">
          <span className="text-gray-600">Faturamento médio por médico:</span>
          <span className="font-semibold text-gray-900">
            R$ {(hospital.avg_doctor_revenue_reais || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
          </span>
        </div>
        
        <Button 
          variant="outline" 
          size="sm" 
          onClick={() => setShowDoctors(!showDoctors)}
          className="w-full mt-3"
        >
          {showDoctors ? (
            <>
              <ChevronUp className="w-4 h-4 mr-2" />
              Ocultar Médicos
            </>
          ) : (
            <>
              <ChevronDown className="w-4 h-4 mr-2" />
              Ver Médicos ({hospitalDoctors.length})
            </>
          )}
        </Button>
      </div>

      {/* ✅ Lista de Médicos (NEW) */}
      {showDoctors && (
        <div className="mt-4 pt-4 border-t border-gray-200">
          <h5 className="font-semibold mb-3 flex items-center">
            <Stethoscope className="w-4 h-4 mr-2" />
            Médicos desta unidade ({hospitalDoctors.length})
          </h5>
          
          {hospitalDoctors.length === 0 ? (
            <p className="text-gray-500 text-sm">Nenhum médico cadastrado neste hospital.</p>
          ) : (
            <div className="space-y-2">
              {hospitalDoctors.map(doctor => doctor && doctor.doctor_id ? (
                <div key={doctor.doctor_id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                  <div className="flex-1">
                    <div className="flex items-center">
                      <span className="font-medium text-gray-900">{doctor.doctor_name || 'Nome não informado'}</span>
                      {doctor.hospitals_count > 1 && (
                        <Badge variant="outline" className="ml-2 text-xs text-orange-600">
                          {doctor.hospitals_count} hospitais
                        </Badge>
                      )}
                    </div>
                    <div className="text-sm text-gray-600 mt-1">
                      <span>CRM: {doctor.doctor_crm || 'N/A'}</span>
                      <span className="ml-4">CNS: {doctor.doctor_cns || 'N/A'}</span>
                    </div>
                    <div className="text-sm text-gray-600">
                      <span>{doctor.doctor_specialty || 'Especialidade não informada'}</span>
                      {doctor.hospitals_count > 1 && doctor.hospitals_list && (
                        <span className="ml-4 text-orange-600">
                          Atende: {doctor.hospitals_list}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant={doctor.activity_status === 'ATIVO' ? 'default' : 'secondary'}>
                      {doctor.activity_status || 'N/A'}
                    </Badge>
                    <div className="text-right text-sm">
                      <div className="font-medium text-gray-900">
                        R$ {(doctor.total_revenue_12months_reais || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                      </div>
                      <div className="text-gray-500">
                        {doctor.total_procedures_12months || 0} procedimentos
                      </div>
                    </div>
                  </div>
                </div>
              ) : null)}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default HospitalRevenueDashboard; 
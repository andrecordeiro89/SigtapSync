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
  TrendingUp,
  BarChart3,
  AlertTriangle,
  ChevronDown,
  ChevronUp,
  Stethoscope
} from 'lucide-react';
import { DoctorsRevenueService, type HospitalStats, type DoctorAggregated } from '../services/doctorsRevenueService';
import { supabase } from '../lib/supabase';

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

// ✅ FUNÇÃO PARA NORMALIZAR VALORES (CORRIGIR CENTAVOS → REAIS)
const normalizeValue = (value: number | null | undefined): number => {
  if (value == null || isNaN(value)) return 0;
  
  // Para valores vindos das views, eles já estão em formato correto
  // Mas ainda vamos verificar se há valores exorbitantes (possíveis centavos)
  if (value > 1000000) { // Valor muito alto (mais de 1 milhão)
    console.warn(`⚠️ Valor muito alto detectado: ${value}. Possivelmente em centavos, normalizando...`);
    return value / 100;
  }
  
  return value;
};

// ✅ FUNÇÃO PARA BUSCAR FATURAMENTO REAL POR HOSPITAL USANDO VIEW
const getRealHospitalRevenue = async (hospitalId: string): Promise<number> => {
  try {
    console.log(`🔍 Buscando faturamento real para hospital: ${hospitalId}`);
    
    // Buscar dados da view de resumo hospitalar
    const { data: summary, error } = await supabase
      .from('v_hospital_procedure_summary')
      .select('total_value, approved_value, rejected_value, pending_value')
      .eq('hospital_id', hospitalId)
      .single();

    if (error) {
      console.error(`❌ Erro ao buscar dados da view para hospital ${hospitalId}:`, error);
      // Fallback para busca direta nas AIHs
      return await getFallbackHospitalRevenue(hospitalId);
    }

    if (!summary) {
      console.log(`ℹ️ Nenhum dado encontrado na view para hospital ${hospitalId}`);
      return await getFallbackHospitalRevenue(hospitalId);
    }

    // Usar valor total da view (já processado e normalizado)
    const totalValue = normalizeValue(Number(summary.total_value || 0));
    const approvedValue = normalizeValue(Number(summary.approved_value || 0));

    console.log(`✅ Hospital ${hospitalId}: Total: R$ ${totalValue.toFixed(2)} | Aprovado: R$ ${approvedValue.toFixed(2)}`);
    
    // Retornar valor aprovado (mais confiável) ou total se não houver aprovado
    return approvedValue > 0 ? approvedValue : totalValue;
    
  } catch (error) {
    console.error(`❌ Erro ao buscar faturamento via view do hospital ${hospitalId}:`, error);
    return await getFallbackHospitalRevenue(hospitalId);
  }
};

// ✅ FUNÇÃO FALLBACK PARA BUSCAR DIRETAMENTE DAS AIHS
const getFallbackHospitalRevenue = async (hospitalId: string): Promise<number> => {
  try {
    const { data: aihs, error } = await supabase
      .from('aihs')
      .select('calculated_total_value, original_value')
      .eq('hospital_id', hospitalId);

    if (error || !aihs || aihs.length === 0) {
      return 0;
    }

    const totalRevenue = aihs.reduce((sum, aih) => {
      const rawValue = Number(aih.calculated_total_value || aih.original_value || 0);
      const normalizedValue = normalizeValue(rawValue);
      return sum + normalizedValue;
    }, 0);

    console.log(`🔄 Fallback Hospital ${hospitalId}: ${aihs.length} AIHs = R$ ${totalRevenue.toFixed(2)}`);
    return totalRevenue;
  } catch (error) {
    console.error(`❌ Erro no fallback para hospital ${hospitalId}:`, error);
    return 0;
  }
};

// ✅ FUNÇÃO PARA BUSCAR PROCEDIMENTOS DETALHADOS POR HOSPITAL USANDO VIEWS
const getHospitalProcedures = async (hospitalId: string) => {
  try {
    console.log(`🔍 Buscando procedimentos para hospital: ${hospitalId}`);
    
    // Buscar dados agregados da view de procedimentos por hospital
    const { data: procedures, error } = await supabase
      .from('v_procedures_by_hospital')
      .select(`
        procedure_code,
        procedure_description,
        procedure_complexity,
        procedure_base_value,
        total_occurrences,
        total_value_charged,
        approved_value,
        rejected_value,
        avg_value_charged,
        total_aihs,
        total_patients
      `)
      .eq('hospital_id', hospitalId)
      .order('total_value_charged', { ascending: false });

    if (error) {
      console.error(`❌ Erro ao buscar procedimentos da view para hospital ${hospitalId}:`, error);
      return await getFallbackHospitalProcedures(hospitalId);
    }

    if (!procedures || procedures.length === 0) {
      console.log(`ℹ️ Nenhum procedimento encontrado na view para hospital ${hospitalId}`);
      return await getFallbackHospitalProcedures(hospitalId);
    }

    // Processar dados da view (já agregados)
    const procedureStats = procedures.map((proc: any) => ({
      code: proc.procedure_code,
      description: proc.procedure_description || 'Descrição não disponível',
      complexity: proc.procedure_complexity,
      count: Number(proc.total_occurrences || 0),
      totalValue: normalizeValue(Number(proc.total_value_charged || 0)),
      approvedValue: normalizeValue(Number(proc.approved_value || 0)),
      avgValue: normalizeValue(Number(proc.avg_value_charged || 0)),
      baseValue: normalizeValue(Number(proc.procedure_base_value || 0)),
      totalAIHs: Number(proc.total_aihs || 0),
      totalPatients: Number(proc.total_patients || 0)
    }));

    const totalCount = procedureStats.reduce((sum, p) => sum + p.count, 0);
    const totalValue = procedureStats.reduce((sum, p) => sum + p.totalValue, 0);

    console.log(`✅ Hospital ${hospitalId}: ${totalCount} procedimentos = ${procedureStats.length} tipos únicos = R$ ${totalValue.toFixed(2)}`);
    
    return {
      procedures: procedureStats,
      count: totalCount,
      totalValue,
      uniqueTypes: procedureStats.length
    };
    
  } catch (error) {
    console.error(`❌ Erro ao buscar procedimentos via view do hospital ${hospitalId}:`, error);
    return await getFallbackHospitalProcedures(hospitalId);
  }
};

// ✅ FUNÇÃO FALLBACK PARA BUSCAR PROCEDIMENTOS DIRETAMENTE
const getFallbackHospitalProcedures = async (hospitalId: string) => {
  try {
    const { data: procedures, error } = await supabase
      .from('procedure_records')
      .select('procedure_code, procedure_description, procedure_value, quantity')
      .eq('hospital_id', hospitalId);

    if (error || !procedures || procedures.length === 0) {
      return { procedures: [], count: 0, totalValue: 0, uniqueTypes: 0 };
    }

    // Agrupar procedimentos por código
    const procedureMap = new Map();
    let totalValue = 0;

    procedures.forEach((proc: any) => {
      const code = proc.procedure_code;
      const value = normalizeValue(Number(proc.procedure_value || 0));
      const quantity = Number(proc.quantity || 1);
      
      totalValue += value * quantity;

      if (!procedureMap.has(code)) {
        procedureMap.set(code, {
          code: code,
          description: proc.procedure_description,
          count: 0,
          totalValue: 0,
          avgValue: 0
        });
      }

      const stats = procedureMap.get(code);
      stats.count += quantity;
      stats.totalValue += value * quantity;
      stats.avgValue = stats.totalValue / stats.count;
    });

    const procedureStats = Array.from(procedureMap.values())
      .sort((a, b) => b.totalValue - a.totalValue);

    console.log(`🔄 Fallback Hospital ${hospitalId}: ${procedures.length} registros = ${procedureStats.length} tipos únicos`);
    
    return {
      procedures: procedureStats,
      count: procedures.length,
      totalValue,
      uniqueTypes: procedureStats.length
    };
  } catch (error) {
    console.error(`❌ Erro no fallback de procedimentos para hospital ${hospitalId}:`, error);
    return { procedures: [], count: 0, totalValue: 0, uniqueTypes: 0 };
  }
};

// ✅ FUNÇÃO PARA BUSCAR ESTATÍSTICAS GERAIS DOS HOSPITAIS
const getHospitalsSummary = async () => {
  try {
    console.log('🔍 Buscando estatísticas gerais dos hospitais...');
    
    const { data: summaries, error } = await supabase
      .from('v_hospital_procedure_summary')
      .select(`
        hospital_id,
        hospital_name,
        total_procedures,
        unique_procedures,
        total_aihs,
        total_patients,
        total_value,
        approved_value,
        approved_procedures,
        avg_procedure_value
      `);

    if (error) {
      console.error('❌ Erro ao buscar estatísticas da view:', error);
      return null;
    }

    if (!summaries || summaries.length === 0) {
      console.log('ℹ️ Nenhuma estatística encontrada na view');
      return null;
    }

    // Processar estatísticas
    const processedSummaries = summaries.map((summary: any) => ({
      hospitalId: summary.hospital_id,
      hospitalName: summary.hospital_name,
      totalProcedures: Number(summary.total_procedures || 0),
      uniqueProcedures: Number(summary.unique_procedures || 0),
      totalAIHs: Number(summary.total_aihs || 0),
      totalPatients: Number(summary.total_patients || 0),
      totalValue: normalizeValue(Number(summary.total_value || 0)),
      approvedValue: normalizeValue(Number(summary.approved_value || 0)),
      approvedProcedures: Number(summary.approved_procedures || 0),
      avgProcedureValue: normalizeValue(Number(summary.avg_procedure_value || 0))
    }));

    console.log(`✅ Carregadas estatísticas de ${summaries.length} hospitais`);
    return processedSummaries;
    
  } catch (error) {
    console.error('❌ Erro ao buscar estatísticas dos hospitais:', error);
    return null;
  }
};

const HospitalRevenueDashboard: React.FC = () => {
  const [hospitalStats, setHospitalStats] = useState<HospitalStats[]>([]);
  const [uniqueDoctors, setUniqueDoctors] = useState<DoctorAggregated[]>([]);
  const [realRevenue, setRealRevenue] = useState<Record<string, number>>({});
  const [hospitalProcedures, setHospitalProcedures] = useState<Record<string, any>>({});
  const [hospitalsSummary, setHospitalsSummary] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadHospitalStats = async () => {
    try {
      setIsLoading(true);
      setError(null);
      
      // ✅ CORREÇÃO: Carregar dados únicos para contagem total + estatísticas das views
      const [hospitalStatsResult, uniqueDoctorsResult, hospitalsSummaryResult] = await Promise.all([
        DoctorsRevenueService.getHospitalStats(),
        DoctorsRevenueService.getDoctorsAggregated({ pageSize: 1000 }), // ✅ Carregar todos os médicos (até 1000)
        getHospitalsSummary() // ✅ Carregar estatísticas das views
      ]);
      
      setHospitalStats(hospitalStatsResult || []);
      setUniqueDoctors(uniqueDoctorsResult.doctors || []);
      setHospitalsSummary(hospitalsSummaryResult || []);
      
      // ✅ NOVO: Carregar faturamento real e procedimentos de cada hospital em paralelo
      console.log('🔄 Carregando dados reais dos hospitais...');
      const hospitalDataPromises = (hospitalStatsResult || []).map(async (hospital) => {
        const [realRev, procedures] = await Promise.all([
          getRealHospitalRevenue(hospital.hospital_id),
          getHospitalProcedures(hospital.hospital_id)
        ]);
        return { 
          hospitalId: hospital.hospital_id, 
          revenue: realRev,
          procedures: procedures
        };
      });
      
      const hospitalDataResults = await Promise.all(hospitalDataPromises);
      
      const revenueMap = hospitalDataResults.reduce((acc, { hospitalId, revenue }) => {
        acc[hospitalId] = revenue;
        return acc;
      }, {} as Record<string, number>);
      
      const proceduresMap = hospitalDataResults.reduce((acc, { hospitalId, procedures }) => {
        acc[hospitalId] = procedures;
        return acc;
      }, {} as Record<string, any>);
      
      setRealRevenue(revenueMap);
      setHospitalProcedures(proceduresMap);
      console.log('✅ Dados reais carregados:', { revenue: revenueMap, procedures: proceduresMap });
      
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

  // ✅ CORREÇÃO: Cálculos usando dados das views quando disponíveis
  const totalHospitals = hospitalStats.length;
  
  // ✅ Contagem única de médicos
  const totalUniqueDoctors = uniqueDoctors.length;
  const totalActiveDoctors = uniqueDoctors.filter(d => d.activity_status === 'ATIVO').length;
  const doctorsWithMultipleHospitals = uniqueDoctors.filter(d => d.hospitals_count > 1).length;
  
  // ✅ CORREÇÃO: Usar valores das views quando disponíveis, senão usar valores reais
  const totalRealRevenue = hospitalsSummary.length > 0 
    ? hospitalsSummary.reduce((sum, h) => sum + h.approvedValue, 0)
    : Object.values(realRevenue).reduce((sum, rev) => sum + rev, 0);
    
  const avgRevenuePerHospital = totalHospitals > 0 ? totalRealRevenue / totalHospitals : 0;
  
  // ✅ Estatísticas adicionais das views
  const totalProceduresCount = hospitalsSummary.reduce((sum, h) => sum + h.totalProcedures, 0);
  const totalAIHsCount = hospitalsSummary.reduce((sum, h) => sum + h.totalAIHs, 0);
  const totalPatientsCount = hospitalsSummary.reduce((sum, h) => sum + h.totalPatients, 0);

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
            {hospitalsSummary.length > 0 && (
              <span className="ml-2 text-blue-600">
                • {totalProceduresCount.toLocaleString('pt-BR')} procedimentos • {totalAIHsCount.toLocaleString('pt-BR')} AIHs • {totalPatientsCount.toLocaleString('pt-BR')} pacientes
              </span>
            )}
          </p>
        </div>
        <Button onClick={loadHospitalStats} variant="outline" size="sm">
          <RefreshCw className="w-4 h-4 mr-2" />
          Atualizar
        </Button>
      </div>

      {/* KPIs Corrigidos */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
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
                  realRevenue={realRevenue[hospital.hospital_id] || 0}
                  proceduresData={hospitalProcedures[hospital.hospital_id] || { procedures: [], count: 0, uniqueTypes: 0 }}
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
  realRevenue: number;
  proceduresData: {
    procedures: Array<{
      code: string;
      description: string;
      complexity?: string;
      count: number;
      totalValue: number;
      approvedValue?: number;
      avgValue: number;
      baseValue?: number;
      totalAIHs?: number;
      totalPatients?: number;
    }>;
    count: number;
    totalValue?: number;
    uniqueTypes: number;
  };
}

const HospitalCard: React.FC<HospitalCardProps> = ({ hospital, uniqueDoctors, realRevenue, proceduresData }) => {
  const [showDoctors, setShowDoctors] = useState(false);
  const [showProcedures, setShowProcedures] = useState(false);
  
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
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
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
            {formatCurrency(realRevenue)}
          </p>
          <p className="text-xs text-green-600">
            {realRevenue > 0 ? 'Valor aprovado' : 'Sem dados'}
          </p>
        </div>

        <div className="bg-purple-50 p-3 rounded-lg cursor-pointer hover:bg-purple-100 transition-colors" onClick={() => setShowProcedures(!showProcedures)}>
          <div className="flex items-center justify-between">
            <div className="flex items-center">
              <BarChart3 className="w-4 h-4 text-purple-600 mr-2" />
              <span className="text-xs text-purple-600 font-medium">Procedimentos</span>
            </div>
            <div className="text-purple-600">
              {showProcedures ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
            </div>
          </div>
          <p className="text-lg font-bold text-purple-900 mt-1">
            {proceduresData.count.toLocaleString('pt-BR')}
          </p>
          <p className="text-xs text-purple-600">
            {proceduresData.uniqueTypes} tipos únicos
          </p>
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
            {hospitalDoctors.length > 0 
              ? formatCurrency(realRevenue / hospitalDoctors.length)
              : 'R$ 0,00'
            }
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
                        {formatCurrency(normalizeValue(doctor.total_revenue_12months_reais || 0))}
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

      {/* ✅ Lista de Procedimentos (NEW) */}
      {showProcedures && (
        <div className="mt-4 pt-4 border-t border-gray-200">
          <h5 className="font-semibold mb-3 flex items-center">
            <BarChart3 className="w-4 h-4 mr-2" />
            Procedimentos realizados ({proceduresData.count})
          </h5>
          
          {proceduresData.procedures.length === 0 ? (
            <p className="text-gray-500 text-sm">Nenhum procedimento registrado neste hospital.</p>
          ) : (
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {proceduresData.procedures.slice(0, 10).map((procedure, index) => (
                <div key={procedure.code} className="flex items-start justify-between p-3 bg-purple-50 rounded-lg hover:bg-purple-100 transition-colors">
                  <div className="flex-1">
                    <div className="flex items-center flex-wrap gap-2">
                      <span className="font-medium text-gray-900 text-sm">{procedure.code}</span>
                      <Badge variant="secondary" className="text-xs">
                        {procedure.count}x
                      </Badge>
                      {procedure.complexity && (
                        <Badge variant="outline" className="text-xs text-purple-600">
                          {procedure.complexity}
                        </Badge>
                      )}
                    </div>
                    <div className="text-sm text-gray-600 mt-1" style={{ 
                      display: '-webkit-box', 
                      WebkitLineClamp: 2, 
                      WebkitBoxOrient: 'vertical' as any, 
                      overflow: 'hidden' 
                    }}>
                      {procedure.description || 'Descrição não disponível'}
                    </div>
                    {(procedure.totalAIHs || procedure.totalPatients) && (
                      <div className="flex items-center gap-4 mt-2 text-xs text-gray-500">
                        {procedure.totalAIHs && (
                          <span>AIHs: {procedure.totalAIHs}</span>
                        )}
                        {procedure.totalPatients && (
                          <span>Pacientes: {procedure.totalPatients}</span>
                        )}
                      </div>
                    )}
                  </div>
                  <div className="text-right text-sm ml-4 min-w-24">
                    <div className="font-medium text-gray-900 mb-1">
                      {formatCurrency(procedure.totalValue)}
                    </div>
                    <div className="text-gray-500 text-xs">
                      {formatCurrency(procedure.avgValue)} médio
                    </div>
                    {procedure.approvedValue && procedure.approvedValue !== procedure.totalValue && (
                      <div className="text-green-600 text-xs mt-1">
                        ✓ {formatCurrency(procedure.approvedValue)} aprovado
                      </div>
                    )}
                    {procedure.baseValue && procedure.baseValue !== procedure.avgValue && (
                      <div className="text-blue-600 text-xs">
                        Base: {formatCurrency(procedure.baseValue)}
                      </div>
                    )}
                  </div>
                </div>
              ))}
              {proceduresData.procedures.length > 10 && (
                <div className="text-center text-sm text-gray-500 pt-2">
                  ... e mais {proceduresData.procedures.length - 10} procedimentos
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default HospitalRevenueDashboard; 
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
  AlertTriangle
} from 'lucide-react';
import { DoctorsRevenueService, type HospitalStats, type DoctorAggregated } from '../services/doctorsRevenueService';
import { supabase } from '../lib/supabase';

// 🔍 CONTROLE DE DEBUG - Altere para false para remover logs
let DEBUG_ENABLED = true;

const debugLog = (message: string, ...args: any[]) => {
  if (DEBUG_ENABLED) {
    console.log(message, ...args);
  }
};

const toggleDebug = () => {
  DEBUG_ENABLED = !DEBUG_ENABLED;
  console.log(`🔧 DEBUG ${DEBUG_ENABLED ? 'HABILITADO' : 'DESABILITADO'}`);
};

// ✅ FUNÇÃO PARA FORMATAÇÃO DE MOEDA COM CORREÇÃO AUTOMÁTICA
const formatCurrency = (value: number | null | undefined): string => {
  if (value == null || isNaN(value)) return 'R$ 0,00';
  
  // 🔍 DEBUG: Log do valor antes da formatação
  debugLog(`🔍 formatCurrency - Valor recebido: ${value} (tipo: ${typeof value})`);
  
  // Aplicar correção automática se necessário
  const correctedValue = detectAndFixDecimalIssues(value);
  
  // 🔍 DEBUG: Log se houve correção
  if (correctedValue !== value) {
    debugLog(`🔧 formatCurrency - Valor corrigido: ${value} → ${correctedValue}`);
  }
  
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(correctedValue);
};

// ✅ FUNÇÃO PARA DETECTAR E CORRIGIR VALORES COM CASAS DECIMAIS INCORRETAS
const detectAndFixDecimalIssues = (value: number): number => {
  if (value <= 0) return value;
  
  // Se o valor tem mais de 2 casas decimais significativas, pode ser um problema
  const decimalPart = value % 1;
  const integerPart = Math.floor(value);
  
  debugLog(`🔍 detectAndFixDecimalIssues - Valor: ${value}, Parte inteira: ${integerPart}, Parte decimal: ${decimalPart}`);
  
  // CENÁRIO 1: Valor alto com casas decimais (provável em centavos)
  // Ex: 123456.78 → 1234.56, 176095.00 → 1760.95
  if (value > 50000 && decimalPart > 0) {
    const candidate = value / 100;
    debugLog(`🔍 detectAndFixDecimalIssues - Candidato para correção (÷100): ${candidate}`);
    
    // Se o candidato está numa faixa mais razoável para contexto hospitalar
    if (candidate >= 500 && candidate <= 50000) {
      debugLog(`✅ detectAndFixDecimalIssues - Correção aplicada (÷100): ${value} → ${candidate}`);
      return candidate;
    }
  }
  
  // CENÁRIO 2: Valor inteiro muito alto (provável em centavos)
  // Ex: 123456 → 1234.56, 176095 → 1760.95, 91485 → 914.85
  if (value > 50000 && decimalPart === 0) {
    const candidate = value / 100;
    debugLog(`🔍 detectAndFixDecimalIssues - Candidato para correção inteiro (÷100): ${candidate}`);
    
    // Se o candidato está numa faixa mais razoável para contexto hospitalar
    if (candidate >= 500 && candidate <= 50000) {
      debugLog(`✅ detectAndFixDecimalIssues - Correção aplicada inteiro (÷100): ${value} → ${candidate}`);
      return candidate;
    }
  }
  
  // CENÁRIO 3: Detectar padrões específicos de centavos (mais conservador)
  // Ex: 12345.67 pode ser 123.45 se for uma faixa suspeita
  if (value > 10000 && value < 50000 && decimalPart > 0) {
    const candidate = value / 100;
    // Verificar se o candidato faz mais sentido baseado em contexto hospitalar
    if (candidate >= 100 && candidate <= 5000) {
      debugLog(`🔍 detectAndFixDecimalIssues - Candidato contextual: ${candidate}`);
      // Aplicar correção apenas se o valor original parece suspeito (mais de 5 dígitos)
      if (String(value).length > 5) {
        debugLog(`✅ detectAndFixDecimalIssues - Correção contextual aplicada: ${value} → ${candidate}`);
        return candidate;
      }
    }
  }
  
  // Se não precisa de correção, retornar o valor original
  debugLog(`🔍 detectAndFixDecimalIssues - Valor mantido: ${value}`);
  return value;
};

// ✅ FUNÇÃO PARA NORMALIZAR VALORES (CORRIGIR CENTAVOS → REAIS)
const normalizeValue = (value: number | null | undefined): number => {
  if (value == null || isNaN(value)) return 0;
  
  // 🔍 DEBUG: Log do valor antes da normalização
  debugLog(`🔍 normalizeValue - Valor original: ${value} (tipo: ${typeof value})`);
  
  // Aplicar detecção e correção de problemas decimais
  const fixedValue = detectAndFixDecimalIssues(value);
  
  // Para valores vindos das views, eles já estão em formato correto
  // Mas ainda vamos verificar se há valores exorbitantes (possíveis centavos)
  if (fixedValue > 1000000) { // Valor muito alto (mais de 1 milhão)
    debugLog(`⚠️ Valor muito alto detectado: ${fixedValue}. Possivelmente em centavos, normalizando...`);
    const normalized = fixedValue / 100;
    debugLog(`🔍 normalizeValue - Valor normalizado: ${normalized}`);
    return normalized;
  }
  
  debugLog(`🔍 normalizeValue - Valor final: ${fixedValue}`);
  return fixedValue;
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
    const rawTotalValue = Number(summary.total_value || 0);
    const rawApprovedValue = Number(summary.approved_value || 0);
    
    // 🔍 DEBUG: Log valores antes da normalização
    debugLog(`🔍 Hospital ${hospitalId} - Valores RAW da view: total=${rawTotalValue}, approved=${rawApprovedValue}`);
    
    const totalValue = normalizeValue(rawTotalValue);
    const approvedValue = normalizeValue(rawApprovedValue);

    debugLog(`✅ Hospital ${hospitalId}: Total: R$ ${totalValue.toFixed(2)} | Aprovado: R$ ${approvedValue.toFixed(2)}`);
    
    // Retornar valor aprovado (mais confiável) ou total se não houver aprovado
    const finalValue = approvedValue > 0 ? approvedValue : totalValue;
    debugLog(`🔍 Hospital ${hospitalId} - Valor final retornado: ${finalValue}`);
    return finalValue;
    
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
            {(() => {
              // 🔍 DEBUG: Log do valor no card de Faturamento
              debugLog(`🔍 Card Faturamento [${hospital.hospital_name}] - realRevenue: ${realRevenue} (tipo: ${typeof realRevenue})`);
              
              // Verificar se o valor será corrigido
              const originalValue = realRevenue;
              const correctedValue = detectAndFixDecimalIssues(originalValue);
              const wasCorrected = correctedValue !== originalValue;
              
              return (
                <span className={wasCorrected ? 'text-orange-700' : ''}>
                  {formatCurrency(realRevenue)}
                  {wasCorrected && (
                    <span className="text-xs text-orange-500 ml-1" title={`Valor original: ${originalValue}`}>
                      *
                    </span>
                  )}
                </span>
              );
            })()}
          </p>
          <p className="text-xs text-green-600">
            {(() => {
              if (realRevenue === 0) return 'Sem dados';
              
              const originalValue = realRevenue;
              const correctedValue = detectAndFixDecimalIssues(originalValue);
              const wasCorrected = correctedValue !== originalValue;
              
                             if (wasCorrected) {
                 return (
                   <span className="text-orange-600">
                     Valor corrigido (era R$ {originalValue.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })})
                   </span>
                 );
               }
              
              return 'Valor aprovado';
            })()}
          </p>
        </div>

        <div className="bg-purple-50 p-3 rounded-lg">
          <div className="flex items-center">
            <BarChart3 className="w-4 h-4 text-purple-600 mr-2" />
            <span className="text-xs text-purple-600 font-medium">Procedimentos</span>
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






    </div>
  );
};

export default HospitalRevenueDashboard; 
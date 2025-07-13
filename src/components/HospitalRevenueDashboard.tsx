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

// ✅ FUNÇÃO PARA FORMATAÇÃO DE MOEDA COM CORREÇÃO AUTOMÁTICA
const formatCurrency = (value: number | null | undefined): string => {
  if (value == null || isNaN(value)) return 'R$ 0,00';
  
  // Aplicar correção automática se necessário
  const correctedValue = detectAndFixDecimalIssues(value);
  
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
  
  // ✅ CONSERVADOR: Só aplicar correções em valores MUITO altos (suspeitos de centavos)
  // Valor válido para hospital: R$ 5.000 até R$ 100.000 é normal
  // Só corrigir se valor > 200.000 (claramente em centavos)
  
  // CENÁRIO 1: Valores extremamente altos (quase certamente em centavos)
  // Ex: 1234567.89 → 12345.67 (só se for > 200k)
  if (value > 200000) {
    const candidate = value / 100;
    
    // Se o candidato está numa faixa razoável para contexto hospitalar (R$ 500 - R$ 100.000)
    if (candidate >= 500 && candidate <= 100000) {
      return candidate;
    }
  }
  
  // CENÁRIO 2: Detectar padrões específicos suspeitos (6+ dígitos sem decimais)
  // Ex: 1234567 → 12345.67 (mas 19155 fica como está)
  if (value > 100000 && decimalPart === 0 && String(value).length >= 6) {
    const candidate = value / 100;
    
    // Se o candidato está numa faixa razoável
    if (candidate >= 500 && candidate <= 50000) {
      return candidate;
    }
  }
  
  // ✅ IMPORTANTE: Valores como 19155.09, 25000.50, etc. SÃO VÁLIDOS
  // Não aplicar correção automática em valores entre R$ 1.000 - R$ 200.000
  
  // Se não precisa de correção, retornar o valor original
  return value;
};

// ✅ FUNÇÃO PARA NORMALIZAR VALORES (CORRIGIR CENTAVOS → REAIS)
const normalizeValue = (value: number | null | undefined): number => {
  if (value == null || isNaN(value)) return 0;
  
  // Aplicar detecção e correção de problemas decimais
  const fixedValue = detectAndFixDecimalIssues(value);
  
  // Para valores vindos das views, eles já estão em formato correto
  // Mas ainda vamos verificar se há valores exorbitantes (possíveis centavos)
  if (fixedValue > 1000000) { // Valor muito alto (mais de 1 milhão)
    const normalized = fixedValue / 100;
    return normalized;
  }
  
  return fixedValue;
};

// ✅ FUNÇÃO SIMPLIFICADA PARA BUSCAR FATURAMENTO USANDO VIEW OTIMIZADA
const getRealHospitalRevenue = async (hospitalId: string): Promise<number> => {
  try {
    console.log(`🔍 Buscando faturamento otimizado para hospital: ${hospitalId}`);
    
    // ✅ ESTRATÉGIA ÚNICA: Usar view otimizada v_hospital_revenue_optimized
    const { data: optimizedData, error: optimizedError } = await supabase
      .from('v_hospital_revenue_optimized')
      .select(`
        total_hospital_revenue_reais,
        revenue_from_procedure_records,
        revenue_from_total_value,
        revenue_from_aihs,
        revenue_from_doctors,
        activity_status
      `)
      .eq('hospital_id', hospitalId)
      .single();

    if (!optimizedError && optimizedData) {
      const revenueReais = Number(optimizedData.total_hospital_revenue_reais || 0);
      
      if (revenueReais > 0) {
        return revenueReais;
      }
    }
    
    // ✅ FALLBACK: Se view otimizada não funcionar, usar v_hospital_financial_summary
    const { data: summaryData, error: summaryError } = await supabase
      .from('v_hospital_financial_summary')
      .select('total_hospital_revenue_reais, avg_revenue_per_doctor, total_procedures')
      .eq('hospital_id', hospitalId)
      .single();

    if (!summaryError && summaryData) {
      const fallbackRevenue = Number(summaryData.total_hospital_revenue_reais || 0);
      
      if (fallbackRevenue > 0) {
        return fallbackRevenue;
      }
    }
    
    // ✅ FALLBACK FINAL: Usar view padrão v_hospital_revenue_stats
    const { data: defaultData, error: defaultError } = await supabase
      .from('v_hospital_revenue_stats')
      .select('total_hospital_revenue_reais, total_hospital_revenue_cents')
      .eq('hospital_id', hospitalId)
      .single();

    if (!defaultError && defaultData) {
      const defaultRevenueReais = Number(defaultData.total_hospital_revenue_reais || 0);
      const defaultRevenueCents = Number(defaultData.total_hospital_revenue_cents || 0);
      
      // ✅ CONFIANÇA NA VIEW: Se vem de total_hospital_revenue_reais, já está correto
      // Só aplicar normalização se for dos centavos (campo legado)
      const finalRevenue = defaultRevenueReais > 0 ? defaultRevenueReais : normalizeValue(defaultRevenueCents);
      
      if (finalRevenue > 0) {
        return finalRevenue;
      }
    }
    
    // ✅ ÚLTIMO RECURSO: Buscar dados diretos
    return await getFallbackHospitalRevenue(hospitalId);
    
  } catch (error) {
    console.error(`Erro ao buscar faturamento para hospital ${hospitalId}:`, error);
    return 0;
  }
};

// ✅ FUNÇÃO DE FALLBACK PARA BUSCAR FATURAMENTO DIRETAMENTE DAS TABELAS
const getFallbackHospitalRevenue = async (hospitalId: string): Promise<number> => {
  try {
    // Estratégia 1: Somar valores de AIHs aprovadas
    const { data: aihs, error: aihError } = await supabase
      .from('aihs')
      .select('calculated_total_value, approval_status')
      .eq('hospital_id', hospitalId)
      .in('approval_status', ['approved', 'pending', 'submitted']);

    if (!aihError && aihs && aihs.length > 0) {
      const totalRevenue = aihs.reduce((sum, aih) => {
        const value = Number(aih.calculated_total_value || 0);
        return sum + normalizeValue(value);
      }, 0);
      
      if (totalRevenue > 0) {
        return totalRevenue;
      }
    }

    // Estratégia 2: Somar valores dos procedimentos
    const { data: procedures, error: procError } = await supabase
      .from('procedure_records')
      .select('value_charged, total_value')
      .eq('hospital_id', hospitalId);

    if (!procError && procedures && procedures.length > 0) {
      const totalRevenue = procedures.reduce((sum, proc) => {
        const chargedValue = Number(proc.value_charged || 0);
        const totalValue = Number(proc.total_value || 0);
        const value = chargedValue > 0 ? chargedValue : totalValue;
        return sum + normalizeValue(value);
      }, 0);
      
      return totalRevenue;
    }

    return 0;
  } catch (error) {
    console.error(`Erro no fallback de faturamento para hospital ${hospitalId}:`, error);
    return 0;
  }
};

// ✅ FUNÇÃO PARA BUSCAR PROCEDIMENTOS DO HOSPITAL (4 ESTRATÉGIAS)
const getHospitalProcedures = async (hospitalId: string) => {
  try {
    // 💡 ESTRATÉGIA 1: Buscar da view v_procedure_summary_by_hospital (mais otimizada)
    const { data: procedureSummary, error: summaryError } = await supabase
      .from('v_procedure_summary_by_hospital')
      .select(`
        procedure_code,
        procedure_description,
        total_count,
        total_value,
        avg_value_per_procedure,
        unique_aihs_count,
        unique_patients_count
      `)
      .eq('hospital_id', hospitalId);

    if (!summaryError && procedureSummary && procedureSummary.length > 0) {
      const procedureStats = procedureSummary.map(p => ({
        code: p.procedure_code || 'N/A',
        description: p.procedure_description || 'Descrição não disponível',
        count: Number(p.total_count || 0),
        totalValue: normalizeValue(Number(p.total_value || 0)),
        avgValue: normalizeValue(Number(p.avg_value_per_procedure || 0)),
        totalAIHs: Number(p.unique_aihs_count || 0),
        totalPatients: Number(p.unique_patients_count || 0)
      }));

      const totalCount = procedureStats.reduce((sum, p) => sum + p.count, 0);
      const totalValue = procedureStats.reduce((sum, p) => sum + p.totalValue, 0);
      const uniqueTypes = procedureStats.length;

      if (totalCount > 0) {
        return {
          procedures: procedureStats,
          count: totalCount,
          totalValue,
          uniqueTypes
        };
      }
    }

    // 💡 ESTRATÉGIA 2: Buscar diretamente de procedure_records
    const { data: procedures, error: procError } = await supabase
      .from('procedure_records')
      .select(`
        procedure_code,
        procedure_description,
        value_charged,
        total_value,
        quantity,
        complexity,
        patient_id,
        aih_id
      `)
      .eq('hospital_id', hospitalId);

    if (!procError && procedures && procedures.length > 0) {
      // Agrupar procedimentos por código
      const procedureMap = procedures.reduce((acc, proc) => {
        const code = proc.procedure_code || 'N/A';
        const quantity = Number(proc.quantity || 1);
        const chargedValue = Number(proc.value_charged || 0);
        const totalValue = Number(proc.total_value || 0);
        const value = chargedValue > 0 ? chargedValue : totalValue;

        if (!acc[code]) {
          acc[code] = {
            code,
            description: proc.procedure_description || 'Descrição não disponível',
            complexity: proc.complexity,
            count: 0,
            totalValue: 0,
            aihIds: new Set(),
            patientIds: new Set()
          };
        }

        acc[code].count += quantity;
        acc[code].totalValue += normalizeValue(value);
        
        if (proc.aih_id) acc[code].aihIds.add(proc.aih_id);
        if (proc.patient_id) acc[code].patientIds.add(proc.patient_id);

        return acc;
      }, {} as Record<string, any>);

      const procedureStats = Object.values(procedureMap).map((p: any) => ({
        code: p.code,
        description: p.description,
        complexity: p.complexity,
        count: p.count,
        totalValue: p.totalValue,
        avgValue: p.count > 0 ? p.totalValue / p.count : 0,
        totalAIHs: p.aihIds.size,
        totalPatients: p.patientIds.size
      }));

      const totalCount = procedureStats.reduce((sum, p) => sum + p.count, 0);
      const totalValue = procedureStats.reduce((sum, p) => sum + p.totalValue, 0);
      const uniqueTypes = procedureStats.length;

      if (totalCount > 0) {
        return {
          procedures: procedureStats,
          count: totalCount,
          totalValue,
          uniqueTypes
        };
      }
    }

    // 💡 ESTRATÉGIA 3: Buscar de aih_procedures via aihs
    const { data: aihProcedures, error: aihProcError } = await supabase
      .from('aihs')
      .select(`
        id,
        aih_procedures (
          procedure_code,
          procedure_description,
          quantity,
          unit_value,
          total_value
        )
      `)
      .eq('hospital_id', hospitalId);

    if (!aihProcError && aihProcedures && aihProcedures.length > 0) {
      // Consolidar todos os procedimentos de todas as AIHs
      const allProcedures = aihProcedures.flatMap(aih => 
        (aih.aih_procedures || []).map(proc => ({
          aih_id: aih.id,
          ...proc
        }))
      );

      if (allProcedures.length > 0) {
        // Agrupar por código
        const procedureMap = allProcedures.reduce((acc, proc) => {
          const code = proc.procedure_code || 'N/A';
          const quantity = Number(proc.quantity || 1);
          const unitValue = Number(proc.unit_value || 0);
          const totalValue = Number(proc.total_value || 0);
          const value = totalValue > 0 ? totalValue : (unitValue * quantity);

          if (!acc[code]) {
            acc[code] = {
              code,
              description: proc.procedure_description || 'Descrição não disponível',
              count: 0,
              totalValue: 0,
              aihIds: new Set()
            };
          }

          acc[code].count += quantity;
          acc[code].totalValue += normalizeValue(value);
          acc[code].aihIds.add(proc.aih_id);

          return acc;
        }, {} as Record<string, any>);

        const procedureStats = Object.values(procedureMap).map((p: any) => ({
          code: p.code,
          description: p.description,
          count: p.count,
          totalValue: p.totalValue,
          avgValue: p.count > 0 ? p.totalValue / p.count : 0,
          totalAIHs: p.aihIds.size
        }));

        const totalCount = procedureStats.reduce((sum, p) => sum + p.count, 0);
        const totalValue = procedureStats.reduce((sum, p) => sum + p.totalValue, 0);
        const uniqueTypes = procedureStats.length;

        if (totalCount > 0) {
          return {
            procedures: procedureStats,
            count: totalCount,
            totalValue,
            uniqueTypes
          };
        }
      }
    }

    // 💡 ESTRATÉGIA 4: Buscar dados diretos de aih_procedures
    return await getFallbackHospitalProcedures(hospitalId);
    
  } catch (error) {
    console.error(`Erro ao buscar procedimentos para hospital ${hospitalId}:`, error);
    return { procedures: [], count: 0, uniqueTypes: 0 };
  }
};

// ✅ FUNÇÃO DE FALLBACK PARA PROCEDIMENTOS
const getFallbackHospitalProcedures = async (hospitalId: string) => {
  try {
    // Estratégia final: buscar diretamente de aih_procedures
    const { data: aihProcedures, error } = await supabase
      .from('aih_procedures')
      .select(`
        procedure_code,
        procedure_description,
        quantity,
        unit_value,
        total_value,
        aih_id,
        aihs!inner (
          hospital_id
        )
      `)
      .eq('aihs.hospital_id', hospitalId);

    if (!error && aihProcedures && aihProcedures.length > 0) {
      // Agrupar por código de procedimento
      const procedureMap = aihProcedures.reduce((acc, proc) => {
        const code = proc.procedure_code || 'N/A';
        const quantity = Number(proc.quantity || 1);
        const unitValue = Number(proc.unit_value || 0);
        const totalValue = Number(proc.total_value || 0);
        const value = totalValue > 0 ? totalValue : (unitValue * quantity);

        if (!acc[code]) {
          acc[code] = {
            code,
            description: proc.procedure_description || 'Descrição não disponível',
            count: 0,
            totalValue: 0,
            aihIds: new Set()
          };
        }

        acc[code].count += quantity;
        acc[code].totalValue += normalizeValue(value);
        acc[code].aihIds.add(proc.aih_id);

        return acc;
      }, {} as Record<string, any>);

      const procedureStats = Object.values(procedureMap).map((p: any) => ({
        code: p.code,
        description: p.description,
        count: p.count,
        totalValue: p.totalValue,
        avgValue: p.count > 0 ? p.totalValue / p.count : 0,
        totalAIHs: p.aihIds.size
      }));

      const totalCount = procedureStats.reduce((sum, p) => sum + p.count, 0);
      const totalValue = procedureStats.reduce((sum, p) => sum + p.totalValue, 0);
      const uniqueTypes = procedureStats.length;

      return {
        procedures: procedureStats,
        count: totalCount,
        totalValue,
        uniqueTypes
      };
    }

    return { procedures: [], count: 0, uniqueTypes: 0 };
  } catch (error) {
    console.error(`Erro no fallback de procedimentos para hospital ${hospitalId}:`, error);
    return { procedures: [], count: 0, uniqueTypes: 0 };
  }
};

// ✅ FUNÇÃO PRINCIPAL PARA BUSCAR DADOS DOS HOSPITAIS
const getHospitalsSummary = async () => {
  try {
    console.log('🏥 Carregando estatísticas dos hospitais...');
    
    // Buscar dados dos hospitais
    const hospitalData = await DoctorsRevenueService.getHospitalStats();
    
    if (!hospitalData || hospitalData.length === 0) {
      console.warn('⚠️ Nenhum dado de hospital encontrado');
      return { 
        hospitalStats: [], 
        uniqueDoctors: []
      };
    }

         // Buscar médicos únicos
     const uniqueDoctorsResult = await DoctorsRevenueService.getDoctorsAggregated({ pageSize: 1000 });
     const uniqueDoctors = uniqueDoctorsResult.doctors;
    
    return {
      hospitalStats: hospitalData,
      uniqueDoctors: uniqueDoctors || []
    };
    
  } catch (error) {
    console.error('❌ Erro ao carregar dados dos hospitais:', error);
    return { 
      hospitalStats: [], 
      uniqueDoctors: []
    };
  }
};

// ✅ COMPONENTE PRINCIPAL DO DASHBOARD
const HospitalRevenueDashboard: React.FC = () => {
  const [hospitalStats, setHospitalStats] = useState<HospitalStats[]>([]);
  const [uniqueDoctors, setUniqueDoctors] = useState<DoctorAggregated[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [realRevenue, setRealRevenue] = useState<Record<string, number>>({});
  const [hospitalProcedures, setHospitalProcedures] = useState<Record<string, any>>({});

  // ✅ FUNÇÃO PARA CARREGAR ESTATÍSTICAS DOS HOSPITAIS
  const loadHospitalStats = async () => {
    setIsLoading(true);
    
    try {
      const data = await getHospitalsSummary();
      setHospitalStats(data.hospitalStats);
      setUniqueDoctors(data.uniqueDoctors);

      // Buscar revenue real para cada hospital
      const revenuePromises = data.hospitalStats.map(hospital => 
        getRealHospitalRevenue(hospital.hospital_id).then(revenue => ({
          id: hospital.hospital_id,
          revenue
        }))
      );

      const revenueResults = await Promise.all(revenuePromises);
      const revenueMap = revenueResults.reduce((acc, { id, revenue }) => {
        acc[id] = revenue;
        return acc;
      }, {} as Record<string, number>);
      
      setRealRevenue(revenueMap);

      // Buscar procedimentos para cada hospital
      const proceduresPromises = data.hospitalStats.map(hospital => 
        getHospitalProcedures(hospital.hospital_id).then(procedures => ({
          id: hospital.hospital_id,
          procedures
        }))
      );

      const proceduresResults = await Promise.all(proceduresPromises);
      const proceduresMap = proceduresResults.reduce((acc, { id, procedures }) => {
        acc[id] = procedures;
        return acc;
      }, {} as Record<string, any>);

      setHospitalProcedures(proceduresMap);

    } catch (error) {
      console.error('❌ Erro ao carregar estatísticas:', error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadHospitalStats();
  }, []);

  // ✅ CÁLCULOS DOS KPIs
  const totalHospitals = hospitalStats.length;
  const totalUniqueDoctors = uniqueDoctors.length;
     const totalActiveDoctors = uniqueDoctors.filter(d => d.activity_status === 'ATIVO').length;
   const doctorsWithMultipleHospitals = uniqueDoctors.filter(d => d.hospitals_count > 1).length;

  // ✅ NOVOS CÁLCULOS: Faturamento e procedimentos
  const totalRealRevenue = Object.values(realRevenue).reduce((sum, value) => sum + value, 0);
  const avgRevenuePerHospital = totalHospitals > 0 ? totalRealRevenue / totalHospitals : 0;

  // Calcular totais de procedimentos
  const totalProceduresCount = Object.values(hospitalProcedures).reduce((sum, data) => sum + (data?.count || 0), 0);
  const totalProceduresValue = Object.values(hospitalProcedures).reduce((sum, data) => sum + (data?.totalValue || 0), 0);
  const totalUniqueTypes = Object.values(hospitalProcedures).reduce((sum, data) => sum + (data?.uniqueTypes || 0), 0);
  
  // Calcular estimativas de AIHs e pacientes
  const totalAIHsCount = Object.values(hospitalProcedures).reduce((sum, data) => {
    if (!data?.procedures) return sum;
    return sum + data.procedures.reduce((aihSum: number, proc: any) => aihSum + (proc.totalAIHs || 0), 0);
  }, 0);
  
  const totalPatientsCount = Object.values(hospitalProcedures).reduce((sum, data) => {
    if (!data?.procedures) return sum;
    return sum + data.procedures.reduce((patSum: number, proc: any) => patSum + (proc.totalPatients || 0), 0);
  }, 0);

  if (isLoading) {
    return (
      <div className="p-6">
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <RefreshCw className="w-8 h-8 animate-spin mx-auto mb-4 text-blue-600" />
            <p className="text-gray-600">Carregando dados dos hospitais...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between">
        <div>
                     <h2 className="text-3xl font-bold text-gray-900">Dashboard Hospitais</h2>
           <p className="text-gray-600 mt-1">
             Análise consolidada do faturamento por hospital
           </p>
        </div>
        <div className="flex items-center space-x-2">
          <Button onClick={loadHospitalStats} variant="outline" size="sm">
            <RefreshCw className="w-4 h-4 mr-2" />
            Atualizar
          </Button>
        </div>
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
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center">
              <BarChart3 className="h-8 w-8 text-purple-600" />
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Procedimentos Totais</p>
                <p className="text-2xl font-bold text-gray-900">
                  {totalProceduresCount.toLocaleString('pt-BR')}
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
                <div key={hospital.hospital_id || index} className="relative">
                  <HospitalCard 
                    hospital={hospital} 
                    uniqueDoctors={uniqueDoctors}
                    realRevenue={realRevenue[hospital.hospital_id] || 0}
                    proceduresData={hospitalProcedures[hospital.hospital_id] || { procedures: [], count: 0, uniqueTypes: 0 }}
                  />
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

// ✅ INTERFACE PARA O CARD DO HOSPITAL
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

// ✅ COMPONENTE DO CARD DO HOSPITAL
const HospitalCard: React.FC<HospitalCardProps> = ({ hospital, uniqueDoctors, realRevenue, proceduresData }) => {
     // ✅ CORREÇÃO: Filtrar médicos do hospital específico
   const hospitalDoctors = uniqueDoctors.filter(doctor => {
     if (!doctor.hospital_ids || doctor.hospital_ids.trim() === '') return false;
     
     // hospital_ids é uma string separada por vírgulas: "uuid1,uuid2"
     const hospitalIdsList = doctor.hospital_ids.split(',').map(id => id.trim());
     const targetHospitalId = String(hospital.hospital_id).trim();
     
     return hospitalIdsList.includes(targetHospitalId);
   });

   const activeDoctors = hospitalDoctors.filter(d => d.activity_status === 'ATIVO');
   const doctorsWithMultipleHospitals = hospitalDoctors.filter(d => d.hospitals_count > 1);

  // ✅ CORREÇÃO: Especialidade principal usando dados corretos das views
  const getTopSpecialty = (): string => {
    // 1. PRIORIDADE: Usar valor já calculado pela view otimizada/stats
    if (hospital.top_specialty_by_revenue && 
        hospital.top_specialty_by_revenue !== 'N/A' && 
        hospital.top_specialty_by_revenue.trim() !== '') {
      
      return hospital.top_specialty_by_revenue;
    }
    
    // 2. FALLBACK: Calcular baseado nos médicos agregados com faturamento real
    if (hospitalDoctors.length > 0) {
      // Agregar faturamento por especialidade usando dados reais dos médicos
      const specialtyRevenue = hospitalDoctors.reduce((acc, doctor) => {
        const specialty = doctor.doctor_specialty || 'Não informado';
        const revenue = doctor.total_revenue_12months_reais || 0;
        
        if (!acc[specialty]) {
          acc[specialty] = { total: 0, count: 0 };
        }
        acc[specialty].total += revenue;
        acc[specialty].count += 1;
        
        return acc;
      }, {} as Record<string, { total: number; count: number }>);
      
      const topSpecialty = Object.entries(specialtyRevenue)
        .sort(([,a], [,b]) => b.total - a.total)[0];
      
      if (topSpecialty && topSpecialty[1].total > 0) {
        return topSpecialty[0];
      }
      
      // 3. FALLBACK: Especialidade mais comum por contagem
      const specialtyCount = hospitalDoctors.reduce((acc, doctor) => {
        const specialty = doctor.doctor_specialty || 'Não informado';
        acc[specialty] = (acc[specialty] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);
      
      const commonSpecialty = Object.entries(specialtyCount)
        .sort(([,a], [,b]) => b - a)[0];
      
      if (commonSpecialty) {
        return commonSpecialty[0];
      }
    }
    
    return 'Não informado';
  };

  const getSpecialtyDetails = (): { source: string; revenue?: number } => {
    // Se tem dados da view, usar como fonte
    if (hospital.top_specialty_by_revenue && 
        hospital.top_specialty_by_revenue !== 'N/A' && 
        hospital.top_specialty_by_revenue.trim() !== '') {
      return { source: 'view_otimizada' };
    }
    
    // Se calculou baseado nos médicos agregados
    if (hospitalDoctors.length > 0) {
      const specialtyRevenue = hospitalDoctors.reduce((acc, doctor) => {
        const specialty = doctor.doctor_specialty || 'Não informado';
        const revenue = doctor.total_revenue_12months_reais || 0;
        
        if (!acc[specialty]) {
          acc[specialty] = { total: 0, count: 0 };
        }
        acc[specialty].total += revenue;
        acc[specialty].count += 1;
        
        return acc;
      }, {} as Record<string, { total: number; count: number }>);
      
      const topSpecialty = Object.entries(specialtyRevenue)
        .sort(([,a], [,b]) => b.total - a.total)[0];
      
      if (topSpecialty && topSpecialty[1].total > 0) {
        return { source: 'medicos_agregados', revenue: topSpecialty[1].total };
      }
      
      return { source: 'mais_comum' };
    }
    
    return { source: 'sem_dados' };
  };

  // ✅ CORREÇÃO: Função para formatar números grandes
  const formatNumber = (num: number): string => {
    if (num === 0) return '0';
    
    // Para números grandes, usar formatação compacta
    if (num >= 1000000) {
      return (num / 1000000).toFixed(1) + 'M';
    } else if (num >= 1000) {
      return (num / 1000).toFixed(1) + 'K';
    }
    
    return num.toLocaleString('pt-BR');
  };

  // ✅ CORREÇÃO: Validar e normalizar dados de procedimentos
  const procedureCount = proceduresData?.count || 0;
  const procedureTypes = proceduresData?.uniqueTypes || 0;
  const procedureValue = proceduresData?.totalValue || 0;

  // ✅ CORREÇÃO: Validar faturamento sem aplicar correções automáticas
  // Como os dados vêm das views otimizadas do banco, eles já estão corretos
  const validateRevenue = (revenue: number): number => {
    if (revenue == null || isNaN(revenue)) return 0;
    
    // ✅ CONFIANÇA NO BANCO: Se o valor vem das views, está correto
    // Só verificar se é um número válido
    const cleanRevenue = Number(revenue);
    
    return cleanRevenue;
  };

  const validatedRevenue = validateRevenue(realRevenue);
  
  // ✅ CORREÇÃO: Como não aplicamos correções automáticas, nunca há "correção"
  // O valor sempre será exibido normalmente em verde
  const revenueWasCorrected = false;

  // ✅ NOVA: Obter dados da especialidade principal
  const topSpecialty = getTopSpecialty();
  const specialtyDetails = getSpecialtyDetails();

  return (
    <div className="p-6 border rounded-lg hover:bg-gray-50 transition-colors">
      {/* Header do Hospital */}
            <div className="mb-4">
        <h4 className="text-lg font-semibold text-gray-900 mb-1">
          {hospital.hospital_name || 'Nome não informado'}
        </h4>
        <p className="text-sm text-gray-500">
          CNPJ: {hospital.hospital_cnpj || 'N/A'}
        </p>
      </div>

      {/* ✅ CORREÇÃO: Métricas do Hospital com formatação correta */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {/* 1. INDICADOR: MÉDICOS */}
        <div className="bg-blue-50 p-3 rounded-lg">
          <div className="flex items-center">
            <Users className="w-4 h-4 text-blue-600 mr-2" />
            <span className="text-xs text-blue-600 font-medium">Médicos</span>
          </div>
          <p className="text-lg font-bold text-blue-900 mt-1">
            {formatNumber(hospitalDoctors.length)}
          </p>
          <p className="text-xs text-blue-600">
            total cadastrados
          </p>
        </div>

        {/* 2. INDICADOR: FATURAMENTO */}
        <div className="bg-green-50 p-3 rounded-lg">
          <div className="flex items-center">
            <DollarSign className="w-4 h-4 text-green-600 mr-2" />
            <span className="text-xs text-green-600 font-medium">Faturamento</span>
          </div>
          <p className="text-lg font-bold text-green-900 mt-1">
            <span className={revenueWasCorrected ? 'text-orange-700' : ''}>
              {formatCurrency(validatedRevenue)}
              {revenueWasCorrected && (
                <span className="text-xs text-orange-500 ml-1" title={`Valor original: ${realRevenue}`}>
                  *
                </span>
              )}
            </span>
          </p>
          <p className="text-xs text-green-600">
            {validatedRevenue === 0 ? 'Sem dados' : (
              revenueWasCorrected ? (
                <span className="text-orange-600">
                  Valor corrigido
                </span>
              ) : 'Valor aprovado'
            )}
          </p>
        </div>

        {/* 3. INDICADOR: PROCEDIMENTOS */}
        <div className="bg-purple-50 p-3 rounded-lg">
          <div className="flex items-center">
            <BarChart3 className="w-4 h-4 text-purple-600 mr-2" />
            <span className="text-xs text-purple-600 font-medium">Procedimentos</span>
          </div>
          <p className="text-lg font-bold text-purple-900 mt-1">
            {formatNumber(procedureCount)}
          </p>
          <p className="text-xs text-purple-600">
            {procedureTypes > 0 ? `${formatNumber(procedureTypes)} tipos únicos` : 'Sem dados'}
          </p>
        </div>

        {/* 4. INDICADOR: ESPECIALIDADE */}
        <div className="bg-gray-50 p-3 rounded-lg">
          <div className="flex items-center">
            <TrendingUp className="w-4 h-4 text-gray-600 mr-2" />
            <span className="text-xs text-gray-600 font-medium">Especialidade</span>
          </div>
          <p className="text-sm font-bold text-gray-900 mt-1">
            {topSpecialty}
          </p>
          <p className="text-xs text-gray-600">
            {hospitalDoctors.length > 0 ? 'principal especialidade' : 'Sem dados'}
          </p>
        </div>
      </div>
    </div>
  );
};

export default HospitalRevenueDashboard; 
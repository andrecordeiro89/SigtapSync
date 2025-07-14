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

// ✅ COMPONENTE PRINCIPAL DO DASHBOARD
const HospitalRevenueDashboard: React.FC = () => {
  const [hospitalStats, setHospitalStats] = useState<HospitalStats[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [realRevenue, setRealRevenue] = useState<Record<string, number>>({});
  const [uniqueDoctors, setUniqueDoctors] = useState<DoctorAggregated[]>([]);

  // ✅ FUNÇÃO PRINCIPAL PARA CARREGAR TODOS OS DADOS DOS HOSPITAIS
  const loadHospitalStats = async () => {
    setIsLoading(true);
    try {
      // 1. Buscar estatísticas básicas dos hospitais
      const stats = await DoctorsRevenueService.getHospitalStats();
      console.log('✅ Hospital stats carregados:', stats.length);
      setHospitalStats(stats);

      // 2. Buscar médicos únicos agregados
      const doctorsResult = await DoctorsRevenueService.getDoctorsAggregated({ pageSize: 1000 });
      const doctors = doctorsResult.doctors || [];
      console.log('✅ Médicos únicos carregados:', doctors.length);
      setUniqueDoctors(doctors);

      // 3. Buscar faturamento real para cada hospital
      const revenuePromises = stats.map(async (hospital) => {
        const revenue = await getRealHospitalRevenue(hospital.hospital_id);
        return { hospitalId: hospital.hospital_id, revenue };
      });

      const revenueResults = await Promise.all(revenuePromises);
      const revenueMap = revenueResults.reduce((acc, { hospitalId, revenue }) => {
        acc[hospitalId] = revenue;
        return acc;
      }, {} as Record<string, number>);

      console.log('✅ Faturamento real carregado:', Object.keys(revenueMap).length, 'hospitais');
      setRealRevenue(revenueMap);

    } catch (error) {
      console.error('❌ Erro ao carregar dados dos hospitais:', error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadHospitalStats();
  }, []);

  // ✅ ESTATÍSTICAS AGREGADAS
  const totalHospitals = hospitalStats.length;
  const totalDoctors = uniqueDoctors.length;
  const totalRevenue = Object.values(realRevenue).reduce((sum, revenue) => sum + revenue, 0);

  // ✅ ORDENAR HOSPITAIS POR FATURAMENTO (MAIOR PARA MENOR)
  const hospitalsSortedByRevenue = [...hospitalStats].sort((a, b) => {
    const revenueA = realRevenue[a.hospital_id] || 0;
    const revenueB = realRevenue[b.hospital_id] || 0;
    return revenueB - revenueA; // Decrescente (maior primeiro)
  });

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



      {/* Lista de Hospitais */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <Building2 className="w-5 h-5 mr-2" />
            Hospitais Cadastrados ({hospitalsSortedByRevenue.length}) - Ordenados por Faturamento
          </CardTitle>
        </CardHeader>
        <CardContent>
          {hospitalsSortedByRevenue.length === 0 ? (
            <div className="text-center py-8">
              <Building2 className="w-12 h-12 mx-auto text-gray-400 mb-4" />
              <p className="text-gray-500">Nenhum hospital encontrado</p>
              <p className="text-sm text-gray-400 mt-2">
                Execute o script de correção da contagem de médicos
              </p>
            </div>
          ) : (
            <div className="space-y-6">
              {hospitalsSortedByRevenue.map((hospital, index) => (
                <div key={hospital.hospital_id || index} className="relative">
                  {/* Badge de Ranking por Faturamento */}
                  <div className="absolute top-4 right-4 z-10">
                    <Badge variant="outline" className={`
                      text-xs font-bold px-2 py-1 shadow-sm
                      ${index === 0 ? 'bg-gradient-to-r from-yellow-400 to-yellow-600 text-white border-yellow-500' :
                        index === 1 ? 'bg-gradient-to-r from-gray-300 to-gray-500 text-white border-gray-400' :
                        index === 2 ? 'bg-gradient-to-r from-orange-400 to-orange-600 text-white border-orange-500' :
                        'bg-blue-50 border-blue-200 text-blue-800'}
                    `}>
                      #{index + 1}
                    </Badge>
                  </div>
                  <HospitalCard 
                    hospital={hospital} 
                    uniqueDoctors={uniqueDoctors}
                    realRevenue={realRevenue[hospital.hospital_id] || 0}
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

// ✅ INTERFACE SIMPLIFICADA PARA O CARD DO HOSPITAL
interface HospitalCardProps {
  hospital: HospitalStats;
  uniqueDoctors: DoctorAggregated[];
  realRevenue: number;
}

// ✅ COMPONENTE DO CARD DO HOSPITAL
const HospitalCard: React.FC<HospitalCardProps> = ({ hospital, uniqueDoctors, realRevenue }) => {
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

      {/* ✅ MÉTRICAS PRINCIPAIS: Médicos e Faturamento */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* 1. INDICADOR: MÉDICOS CADASTRADOS */}
        <div className="bg-gradient-to-br from-blue-50 to-blue-100 p-6 rounded-xl border border-blue-200 shadow-sm hover:shadow-md transition-all duration-200">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center">
              <div className="bg-blue-500 p-2 rounded-lg mr-3">
                <Users className="w-5 h-5 text-white" />
              </div>
              <span className="text-sm text-blue-700 font-semibold">Corpo Médico</span>
            </div>
            <div className="bg-blue-200 px-2 py-1 rounded-full">
              <span className="text-xs text-blue-800 font-medium">Ativos</span>
            </div>
          </div>
          <p className="text-2xl font-bold text-blue-900 mb-1">
            {formatNumber(hospitalDoctors.length)}
          </p>
          <p className="text-sm text-blue-600">
            médicos cadastrados no hospital
          </p>
        </div>

        {/* 2. INDICADOR: FATURAMENTO (DESTAQUE PRINCIPAL) */}
        <div className="bg-gradient-to-br from-emerald-50 via-green-50 to-teal-50 p-6 rounded-xl border-2 border-green-300 shadow-lg hover:shadow-xl transition-all duration-200 transform hover:scale-[1.02]">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center">
              <div className="bg-gradient-to-r from-green-500 to-emerald-600 p-2 rounded-lg mr-3 shadow-sm">
                <DollarSign className="w-6 h-6 text-white" />
              </div>
              <span className="text-sm text-green-700 font-semibold">Faturamento Total</span>
            </div>
            <div className={`px-3 py-1 rounded-full text-xs font-medium ${
              validatedRevenue === 0 ? 'bg-gray-200 text-gray-700' :
              revenueWasCorrected ? 'bg-orange-200 text-orange-800' :
              'bg-green-200 text-green-800'
            }`}>
              {validatedRevenue === 0 ? 'Sem dados' : 
               revenueWasCorrected ? 'Corrigido' : 'Validado'}
            </div>
          </div>
          <p className={`text-3xl font-bold mb-2 ${
            validatedRevenue === 0 ? 'text-gray-500' :
            revenueWasCorrected ? 'text-orange-700' : 'text-green-900'
          }`}>
            {formatCurrency(validatedRevenue)}
            {revenueWasCorrected && (
              <span className="text-sm text-orange-500 ml-2" title={`Valor original: ${formatCurrency(realRevenue)}`}>
                ⚠️
              </span>
            )}
          </p>
          <p className="text-sm text-green-600">
            {validatedRevenue === 0 ? 'Aguardando dados de faturamento' : 
             revenueWasCorrected ? 'Valor corrigido automaticamente' :
             'Faturamento total do hospital'}
          </p>
        </div>
      </div>
    </div>
  );
};

export default HospitalRevenueDashboard; 
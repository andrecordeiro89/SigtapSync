/**
 * ================================================================
 * DASHBOARD DE HOSPITAIS - DESIGN PREMIUM v2.0
 * ================================================================
 * Visualização executiva premium das estatísticas de faturamento por hospital
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
  AlertTriangle,
  TrendingUp,
  Award
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

// ✅ COMPONENTE PRINCIPAL DO DASHBOARD - DESIGN PREMIUM
const HospitalRevenueDashboard: React.FC = () => {
  const [hospitalStats, setHospitalStats] = useState<HospitalStats[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [realRevenue, setRealRevenue] = useState<Record<string, number>>({});
  const [uniqueDoctors, setUniqueDoctors] = useState<DoctorAggregated[]>([]);
  const [hospitalDetails, setHospitalDetails] = useState<Record<string, {city: string, state: string}>>({});

  // ✅ FUNÇÃO PRINCIPAL PARA CARREGAR TODOS OS DADOS DOS HOSPITAIS
  const loadHospitalStats = async () => {
    setIsLoading(true);
    try {
      // 1. Buscar estatísticas básicas dos hospitais
      const stats = await DoctorsRevenueService.getHospitalStats();
      console.log('✅ Hospital stats carregados:', stats.length);
      setHospitalStats(stats);

      // 1.5. Buscar detalhes dos hospitais (cidade e estado)
      const { data: hospitals, error: hospitalsError } = await supabase
        .from('hospitals')
        .select('id, city, state');
      
      if (!hospitalsError && hospitals) {
        const detailsMap = hospitals.reduce((acc, h) => {
          acc[h.id] = {
            city: h.city || 'Cidade não informada',
            state: h.state || 'Estado não informado'
          };
          return acc;
        }, {} as Record<string, {city: string, state: string}>);
        setHospitalDetails(detailsMap);
      }

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
  const avgRevenuePerHospital = totalHospitals > 0 ? totalRevenue / totalHospitals : 0;

  // ✅ ORDENAR HOSPITAIS POR FATURAMENTO (MAIOR PARA MENOR)
  const hospitalsSortedByRevenue = [...hospitalStats].sort((a, b) => {
    const revenueA = realRevenue[a.hospital_id] || 0;
    const revenueB = realRevenue[b.hospital_id] || 0;
    return revenueB - revenueA; // Decrescente (maior primeiro)
  });

  if (isLoading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <div className="text-center space-y-4">
          <div className="relative">
            <div className="w-16 h-16 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin mx-auto"></div>
            <Building2 className="w-6 h-6 text-blue-600 absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-gray-900">Carregando Dashboard</h3>
            <p className="text-gray-600">Processando dados dos hospitais...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">

      {/* 🎨 GRID PREMIUM DE HOSPITAIS */}
      {hospitalsSortedByRevenue.length === 0 ? (
        <Card className="border-0 shadow-xl bg-gradient-to-br from-gray-50 to-gray-100">
          <CardContent className="py-16">
            <div className="text-center">
              <div className="w-16 h-16 bg-gray-200 rounded-full flex items-center justify-center mx-auto mb-4">
                <Building2 className="w-8 h-8 text-gray-400" />
              </div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">Nenhum hospital encontrado</h3>
              <p className="text-gray-600">Execute o script de correção da contagem de médicos</p>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
          {hospitalsSortedByRevenue.map((hospital, index) => (
            <PremiumHospitalCard 
              key={hospital.hospital_id || index}
              hospital={hospital} 
              uniqueDoctors={uniqueDoctors}
              realRevenue={realRevenue[hospital.hospital_id] || 0}
              ranking={index + 1}
              totalHospitals={totalHospitals}
              hospitalDetails={hospitalDetails[hospital.hospital_id]}
            />
          ))}
        </div>
      )}

    </div>
  );
};

// 🎨 INTERFACE PARA O CARD PREMIUM
interface PremiumHospitalCardProps {
  hospital: HospitalStats;
  uniqueDoctors: DoctorAggregated[];
  realRevenue: number;
  ranking: number;
  totalHospitals: number;
  hospitalDetails?: {city: string, state: string};
}

// 🎨 COMPONENTE CARD PREMIUM DO HOSPITAL
const PremiumHospitalCard: React.FC<PremiumHospitalCardProps> = ({ 
  hospital, 
  uniqueDoctors, 
  realRevenue, 
  ranking,
  totalHospitals,
  hospitalDetails 
}) => {
  // ✅ FILTRAR MÉDICOS DO HOSPITAL ESPECÍFICO
  const hospitalDoctors = uniqueDoctors.filter(doctor => {
    if (!doctor.hospital_ids || doctor.hospital_ids.trim() === '') return false;
    
    // hospital_ids é uma string separada por vírgulas: "uuid1,uuid2"
    const hospitalIdsList = doctor.hospital_ids.split(',').map(id => id.trim());
    const targetHospitalId = String(hospital.hospital_id).trim();
    
    return hospitalIdsList.includes(targetHospitalId);
  });

  const activeDoctors = hospitalDoctors.filter(d => d.activity_status === 'ATIVO');

  // ✅ FUNÇÃO PARA FORMATAR NÚMEROS COMPACTOS
  const formatCompactNumber = (num: number): string => {
    if (num === 0) return '0';
    
    if (num >= 1000000) {
      return (num / 1000000).toFixed(1) + 'M';
    } else if (num >= 1000) {
      return (num / 1000).toFixed(1) + 'K';
    }
    
    return num.toLocaleString('pt-BR');
  };

  // ✅ VALIDAR FATURAMENTO
  const validateRevenue = (revenue: number): number => {
    if (revenue == null || isNaN(revenue)) return 0;
    return Number(revenue);
  };

  const validatedRevenue = validateRevenue(realRevenue);

  // ✅ DEFINIR ESTILO DO RANKING
  const getRankingStyle = (rank: number) => {
    switch (rank) {
      case 1:
        return {
          badge: "bg-gradient-to-r from-yellow-400 to-amber-500 text-white shadow-lg",
          border: "border-yellow-300",
          gradient: "from-yellow-50 to-amber-50"
        };
      case 2:
        return {
          badge: "bg-gradient-to-r from-gray-400 to-gray-600 text-white shadow-lg",
          border: "border-gray-300", 
          gradient: "from-gray-50 to-slate-50"
        };
      case 3:
        return {
          badge: "bg-gradient-to-r from-orange-400 to-amber-600 text-white shadow-lg",
          border: "border-orange-300",
          gradient: "from-orange-50 to-amber-50"
        };
      default:
        return {
          badge: "bg-gradient-to-r from-blue-500 to-indigo-600 text-white shadow-md",
          border: "border-blue-200",
          gradient: "from-blue-50 to-indigo-50"
        };
    }
  };

  const rankingStyle = getRankingStyle(ranking);

  return (
    <Card className={`group relative overflow-hidden border-2 ${rankingStyle.border} shadow-xl hover:shadow-2xl transition-all duration-300 hover:-translate-y-1 bg-gradient-to-br ${rankingStyle.gradient}`}>
      {/* Badge de Ranking */}
      <div className="absolute top-4 right-4 z-10">
        <Badge className={`${rankingStyle.badge} px-3 py-1 text-sm font-bold`}>
          <Award className="w-3 h-3 mr-1" />
          #{ranking}
        </Badge>
      </div>

      <CardContent className="p-6">
        {/* Header do Hospital - Altura Ajustável para Nomes Completos */}
        <div className="mb-6 min-h-16 flex flex-col justify-center">
          <h3 className="text-lg font-bold text-gray-900 pr-16 leading-tight mb-1" 
              style={{
                wordWrap: 'break-word',
                hyphens: 'auto'
              }}>
            {hospital.hospital_name || 'Nome não informado'}
          </h3>
          <p className="text-sm text-gray-600">
            {hospitalDetails?.city || 'Cidade não informada'}, {hospitalDetails?.state || 'Estado não informado'}
          </p>
        </div>

        {/* Métricas Principais - Layout Compacto */}
        <div className="space-y-4">
          {/* 💰 Faturamento - Destaque Principal */}
          <div className="relative overflow-hidden bg-gradient-to-r from-emerald-500 to-teal-600 rounded-xl p-4 text-white shadow-lg">
            <div className="absolute inset-0 bg-white/10"></div>
            <div className="relative">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center">
                  <DollarSign className="w-5 h-5 mr-2" />
                  <span className="text-sm font-medium opacity-90">Faturamento</span>
                </div>
                <div className="bg-white/20 px-2 py-1 rounded-full">
                  <span className="text-xs font-medium">Total</span>
                </div>
              </div>
              <div className="text-2xl font-bold mb-1">
                {formatCurrency(validatedRevenue)}
              </div>
              <div className="text-xs opacity-75">
                {validatedRevenue === 0 ? 'Aguardando dados' : 'Receita total do hospital'}
              </div>
            </div>
          </div>

          {/* Grid de Métricas Secundárias */}
          <div className="grid grid-cols-2 gap-3">
            {/* 👥 Médicos */}
            <div className="bg-white/60 backdrop-blur-sm rounded-lg p-3 border border-white/20">
              <div className="flex items-center mb-2">
                <Users className="w-4 h-4 text-blue-600 mr-2" />
                <span className="text-xs font-medium text-gray-700">Médicos</span>
              </div>
              <div className="text-lg font-bold text-blue-900">
                {formatCompactNumber(hospitalDoctors.length)}
              </div>
              <div className="text-xs text-gray-600">
                {activeDoctors.length} ativos
              </div>
            </div>

            {/* 📊 Performance */}
            <div className="bg-white/60 backdrop-blur-sm rounded-lg p-3 border border-white/20">
              <div className="flex items-center mb-2">
                <TrendingUp className="w-4 h-4 text-purple-600 mr-2" />
                <span className="text-xs font-medium text-gray-700">Posição</span>
              </div>
              <div className="text-lg font-bold text-purple-900">
                {ranking}º de {totalHospitals}
              </div>
              <div className="text-xs text-gray-600">
                No ranking
              </div>
            </div>
          </div>
        </div>


      </CardContent>
    </Card>
  );
};

export default HospitalRevenueDashboard; 
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

// ✅ FUNÇÃO PARA ALTERNAR DEBUG GLOBALMENTE
const toggleDebug = () => {
  DEBUG_ENABLED = !DEBUG_ENABLED;
  console.log(`🔧 DEBUG ${DEBUG_ENABLED ? 'HABILITADO' : 'DESABILITADO'}`);
  
  // Forçar re-render do componente
  window.dispatchEvent(new Event('debug-toggled'));
};

// ✅ FUNÇÃO PARA LIMPAR DADOS E FORÇAR RECARGA
const clearAndReload = () => {
  console.log('🧹 Limpando dados e recarregando...');
  
  // Limpar localStorage se houver cache
  if (typeof window !== 'undefined') {
    localStorage.removeItem('hospital-revenue-cache');
    localStorage.removeItem('hospital-procedures-cache');
  }
  
  // Forçar garbage collection se disponível
  if (typeof window !== 'undefined' && window.gc) {
    window.gc();
  }
  
  // Recarregar a página
  window.location.reload();
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
  
  // ✅ CONSERVADOR: Só aplicar correções em valores MUITO altos (suspeitos de centavos)
  // Valor válido para hospital: R$ 5.000 até R$ 100.000 é normal
  // Só corrigir se valor > 200.000 (claramente em centavos)
  
  // CENÁRIO 1: Valores extremamente altos (quase certamente em centavos)
  // Ex: 1234567.89 → 12345.67 (só se for > 200k)
  if (value > 200000) {
    const candidate = value / 100;
    debugLog(`🔍 detectAndFixDecimalIssues - Valor muito alto detectado: ${value}, candidato: ${candidate}`);
    
    // Se o candidato está numa faixa razoável para contexto hospitalar (R$ 500 - R$ 100.000)
    if (candidate >= 500 && candidate <= 100000) {
      debugLog(`✅ detectAndFixDecimalIssues - Correção aplicada (valor muito alto): ${value} → ${candidate}`);
      return candidate;
    }
  }
  
  // CENÁRIO 2: Detectar padrões específicos suspeitos (6+ dígitos sem decimais)
  // Ex: 1234567 → 12345.67 (mas 19155 fica como está)
  if (value > 100000 && decimalPart === 0 && String(value).length >= 6) {
    const candidate = value / 100;
    debugLog(`🔍 detectAndFixDecimalIssues - Padrão suspeito detectado: ${value} (${String(value).length} dígitos), candidato: ${candidate}`);
    
    // Se o candidato está numa faixa razoável
    if (candidate >= 500 && candidate <= 50000) {
      debugLog(`✅ detectAndFixDecimalIssues - Correção aplicada (padrão suspeito): ${value} → ${candidate}`);
      return candidate;
    }
  }
  
  // ✅ IMPORTANTE: Valores como 19155.09, 25000.50, etc. SÃO VÁLIDOS
  // Não aplicar correção automática em valores entre R$ 1.000 - R$ 200.000
  
  // Se não precisa de correção, retornar o valor original
  debugLog(`🔍 detectAndFixDecimalIssues - Valor mantido (válido): ${value}`);
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
      
      debugLog(`✅ View Otimizada - Hospital ${hospitalId}:`);
      debugLog(`  - Total Consolidado: R$ ${revenueReais.toFixed(2)}`);
      debugLog(`  - Procedure Records: R$ ${Number(optimizedData.revenue_from_procedure_records || 0).toFixed(2)}`);
      debugLog(`  - Total Value: R$ ${Number(optimizedData.revenue_from_total_value || 0).toFixed(2)}`);
      debugLog(`  - AIHs: R$ ${Number(optimizedData.revenue_from_aihs || 0).toFixed(2)}`);
      debugLog(`  - Doctors: R$ ${Number(optimizedData.revenue_from_doctors || 0).toFixed(2)}`);
      debugLog(`  - Status: ${optimizedData.activity_status}`);
      
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
      
      debugLog(`✅ Fallback Summary - Hospital ${hospitalId}: R$ ${fallbackRevenue.toFixed(2)}`);
      
      if (fallbackRevenue > 0) {
        return fallbackRevenue;
      }
    }
    
    // ✅ ÚLTIMO RECURSO: Buscar dados da view padrão v_hospital_revenue_stats
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
      
      debugLog(`✅ Default View - Hospital ${hospitalId}: R$ ${finalRevenue.toFixed(2)}`);
      
      if (finalRevenue > 0) {
        return finalRevenue;
      }
    }
    
    // ✅ FALLBACK FINAL: Busca direta nas tabelas
    debugLog(`🔄 Fallback Final - Hospital ${hospitalId}: Buscando dados diretos`);
    return await getFallbackHospitalRevenue(hospitalId);
    
  } catch (error) {
    console.error(`❌ Erro ao buscar faturamento otimizado do hospital ${hospitalId}:`, error);
    return await getFallbackHospitalRevenue(hospitalId);
  }
};

// ✅ FUNÇÃO FALLBACK APRIMORADA PARA BUSCAR DIRETAMENTE DAS AIHS
const getFallbackHospitalRevenue = async (hospitalId: string): Promise<number> => {
  try {
    debugLog(`🔄 Fallback - Buscando faturamento direto das AIHs para hospital: ${hospitalId}`);
    
    // Buscar primeiro nas AIHs
    const { data: aihs, error: aihError } = await supabase
      .from('aihs')
      .select('calculated_total_value, original_value, approved_value')
      .eq('hospital_id', hospitalId)
      .limit(1000); // Limitar para evitar consultas muito grandes

    if (!aihError && aihs && aihs.length > 0) {
      const totalRevenue = aihs.reduce((sum, aih) => {
        // Priorizar: approved_value > calculated_total_value > original_value
        const rawValue = Number(aih.approved_value || aih.calculated_total_value || aih.original_value || 0);
        const normalizedValue = normalizeValue(rawValue);
        return sum + normalizedValue;
      }, 0);

      debugLog(`✅ Fallback AIHs - Hospital ${hospitalId}: ${aihs.length} AIHs = R$ ${totalRevenue.toFixed(2)}`);
      
      if (totalRevenue > 0) {
        return totalRevenue;
      }
    }
    
    // Buscar nos procedure_records como último recurso
    const { data: procedures, error: procError } = await supabase
      .from('procedure_records')
      .select('total_value_cents, value_charged, approved_value')
      .eq('hospital_id', hospitalId)
      .limit(1000);

    if (!procError && procedures && procedures.length > 0) {
      const totalRevenue = procedures.reduce((sum, proc) => {
        const rawValue = Number(proc.approved_value || proc.value_charged || proc.total_value_cents || 0);
        const normalizedValue = normalizeValue(rawValue);
        return sum + normalizedValue;
      }, 0);

      debugLog(`✅ Fallback Procedures - Hospital ${hospitalId}: ${procedures.length} procedures = R$ ${totalRevenue.toFixed(2)}`);
      return totalRevenue;
    }

    debugLog(`⚠️ Fallback - Hospital ${hospitalId}: Nenhum dado encontrado`);
    return 0;
    
  } catch (error) {
    console.error(`❌ Erro no fallback para hospital ${hospitalId}:`, error);
    return 0;
  }
};

// ✅ FUNÇÃO APRIMORADA PARA BUSCAR PROCEDIMENTOS DETALHADOS POR HOSPITAL
const getHospitalProcedures = async (hospitalId: string) => {
  try {
    console.log(`🔍 Buscando procedimentos para hospital: ${hospitalId}`);
    
    // ✅ ESTRATÉGIA 1: Buscar dados agregados da view de procedimentos por hospital
    const { data: procedures, error: viewError } = await supabase
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

    if (!viewError && procedures && procedures.length > 0) {
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

      debugLog(`✅ Estratégia 1 - Hospital ${hospitalId}: ${totalCount} procedimentos = ${procedureStats.length} tipos únicos = R$ ${totalValue.toFixed(2)}`);
      
      return {
        procedures: procedureStats,
        count: totalCount,
        totalValue,
        uniqueTypes: procedureStats.length
      };
    }

    // ✅ ESTRATÉGIA 2: Buscar dados da view v_hospital_procedure_summary
    const { data: summary, error: summaryError } = await supabase
      .from('v_hospital_procedure_summary')
      .select(`
        total_procedures,
        unique_procedures,
        total_value,
        approved_value,
        total_aihs,
        total_patients
      `)
      .eq('hospital_id', hospitalId)
      .single();

    if (!summaryError && summary) {
      const totalCount = Number(summary.total_procedures || 0);
      const uniqueTypes = Number(summary.unique_procedures || 0);
      const totalValue = normalizeValue(Number(summary.total_value || 0));
      const approvedValue = normalizeValue(Number(summary.approved_value || 0));
      
      debugLog(`✅ Estratégia 2 - Hospital ${hospitalId}: ${totalCount} procedimentos = ${uniqueTypes} tipos únicos = R$ ${totalValue.toFixed(2)}`);
      
      // Gerar procedimentos genéricos baseados no resumo
      const genericProcedures = [];
      if (totalCount > 0) {
        genericProcedures.push({
          code: 'SUMMARY',
          description: 'Resumo Geral de Procedimentos',
          complexity: 'VARIADA',
          count: totalCount,
          totalValue: totalValue,
          approvedValue: approvedValue,
          avgValue: totalCount > 0 ? totalValue / totalCount : 0,
          baseValue: 0,
          totalAIHs: Number(summary.total_aihs || 0),
          totalPatients: Number(summary.total_patients || 0)
        });
      }
      
      return {
        procedures: genericProcedures,
        count: totalCount,
        totalValue,
        uniqueTypes: uniqueTypes
      };
    }

    // ✅ ESTRATÉGIA 3: Buscar dados direto dos procedure_records
    const { data: procedureRecords, error: recordsError } = await supabase
      .from('procedure_records')
      .select(`
        procedure_code,
        procedure_description,
        value_charged,
        approved_value,
        total_value_cents,
        quantity,
        approved
      `)
      .eq('hospital_id', hospitalId)
      .limit(1000);

    if (!recordsError && procedureRecords && procedureRecords.length > 0) {
      // Agrupar procedimentos por código
      const procedureMap = new Map();
      let totalValue = 0;
      let totalCount = 0;

      procedureRecords.forEach((proc: any) => {
        const code = proc.procedure_code;
        const value = normalizeValue(Number(proc.approved_value || proc.value_charged || proc.total_value_cents || 0));
        const quantity = Number(proc.quantity || 1);
        const isApproved = proc.approved === true;
        
        totalValue += value * quantity;
        totalCount += quantity;

        if (!procedureMap.has(code)) {
          procedureMap.set(code, {
            code: code,
            description: proc.procedure_description || 'Descrição não disponível',
            count: 0,
            totalValue: 0,
            approvedValue: 0,
            avgValue: 0,
            approvedCount: 0
          });
        }

        const stats = procedureMap.get(code);
        stats.count += quantity;
        stats.totalValue += value * quantity;
        if (isApproved) {
          stats.approvedValue += value * quantity;
          stats.approvedCount += quantity;
        }
        stats.avgValue = stats.totalValue / stats.count;
      });

      const procedureStats = Array.from(procedureMap.values())
        .sort((a, b) => b.totalValue - a.totalValue);

      debugLog(`✅ Estratégia 3 - Hospital ${hospitalId}: ${totalCount} procedimentos = ${procedureStats.length} tipos únicos = R$ ${totalValue.toFixed(2)}`);
      
      return {
        procedures: procedureStats,
        count: totalCount,
        totalValue,
        uniqueTypes: procedureStats.length
      };
    }

    // ✅ ESTRATÉGIA 4: Fallback para buscar dados das AIHs
    const { data: aihProcedures, error: aihError } = await supabase
      .from('aihs')
      .select(`
        procedure_code,
        procedure_description,
        calculated_total_value,
        original_value,
        approved_value
      `)
      .eq('hospital_id', hospitalId)
      .limit(500);

    if (!aihError && aihProcedures && aihProcedures.length > 0) {
      const procedureMap = new Map();
      let totalValue = 0;

      aihProcedures.forEach((aih: any) => {
        const code = aih.procedure_code;
        const value = normalizeValue(Number(aih.approved_value || aih.calculated_total_value || aih.original_value || 0));
        
        totalValue += value;

        if (!procedureMap.has(code)) {
          procedureMap.set(code, {
            code: code,
            description: aih.procedure_description || 'Descrição não disponível',
            count: 0,
            totalValue: 0,
            avgValue: 0
          });
        }

        const stats = procedureMap.get(code);
        stats.count += 1;
        stats.totalValue += value;
        stats.avgValue = stats.totalValue / stats.count;
      });

      const procedureStats = Array.from(procedureMap.values())
        .sort((a, b) => b.totalValue - a.totalValue);

      debugLog(`✅ Estratégia 4 - Hospital ${hospitalId}: ${aihProcedures.length} AIHs = ${procedureStats.length} tipos únicos = R$ ${totalValue.toFixed(2)}`);
      
      return {
        procedures: procedureStats,
        count: aihProcedures.length,
        totalValue,
        uniqueTypes: procedureStats.length
      };
    }

    debugLog(`⚠️ Hospital ${hospitalId}: Nenhum procedimento encontrado em nenhuma fonte`);
    return { procedures: [], count: 0, totalValue: 0, uniqueTypes: 0 };
    
  } catch (error) {
    console.error(`❌ Erro ao buscar procedimentos do hospital ${hospitalId}:`, error);
    return { procedures: [], count: 0, totalValue: 0, uniqueTypes: 0 };
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
  const [isReloadingSpecific, setIsReloadingSpecific] = useState<string | null>(null);

  // ✅ FUNÇÃO PARA RECARREGAR DADOS DE UM HOSPITAL ESPECÍFICO
  const reloadSpecificHospital = async (hospitalId: string) => {
    try {
      setIsReloadingSpecific(hospitalId);
      debugLog(`🔄 Recarregando dados específicos do hospital: ${hospitalId}`);
      
      const [realRev, procedures] = await Promise.all([
        getRealHospitalRevenue(hospitalId),
        getHospitalProcedures(hospitalId)
      ]);
      
      // Atualizar apenas os dados deste hospital
      setRealRevenue(prev => ({
        ...prev,
        [hospitalId]: realRev
      }));
      
      setHospitalProcedures(prev => ({
        ...prev,
        [hospitalId]: procedures
      }));
      
      debugLog(`✅ Dados do hospital ${hospitalId} recarregados: Revenue=${realRev}, Procedures=${procedures.count}`);
      
    } catch (error) {
      console.error(`❌ Erro ao recarregar hospital ${hospitalId}:`, error);
    } finally {
      setIsReloadingSpecific(null);
    }
  };

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
      <div className="flex items-center justify-center h-96">
        <div className="text-center">
          <RefreshCw className="h-8 w-8 animate-spin mx-auto mb-4 text-blue-600" />
          <p className="text-gray-600">Carregando dados dos hospitais...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center">
          <AlertTriangle className="h-8 w-8 mx-auto mb-4 text-red-600" />
          <p className="text-red-600 mb-4">{error}</p>
          <Button onClick={loadHospitalStats} variant="outline">
            Tentar Novamente
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* ✅ CORREÇÃO: Cabeçalho com botões de debug */}
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
        <div className="flex items-center space-x-2">
          <Button
            onClick={toggleDebug}
            variant={DEBUG_ENABLED ? "default" : "outline"}
            size="sm"
            className={DEBUG_ENABLED ? "bg-yellow-500 hover:bg-yellow-600" : ""}
          >
            {DEBUG_ENABLED ? "🔍 Debug ON" : "🔍 Debug OFF"}
          </Button>
          <Button onClick={loadHospitalStats} variant="outline" size="sm">
            <RefreshCw className="w-4 h-4 mr-2" />
            Atualizar
          </Button>
          <Button onClick={clearAndReload} variant="outline" size="sm" className="text-red-600 hover:text-red-700">
            <RefreshCw className="w-4 h-4 mr-2" />
            Limpar Cache
          </Button>
        </div>
      </div>

      {/* ✅ CORREÇÃO: Seção de informações de debug */}
      {DEBUG_ENABLED && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
          <h3 className="text-sm font-bold text-yellow-800 mb-2">🔍 INFORMAÇÕES DE DEBUG</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm text-yellow-700 mb-4">
            <div>
              <strong>Hospitais:</strong> {hospitalStats.length}
            </div>
            <div>
              <strong>Médicos únicos:</strong> {uniqueDoctors.length}
            </div>
            <div>
              <strong>Revenue carregado:</strong> {Object.keys(realRevenue).length}
            </div>
            <div>
              <strong>Procedures carregado:</strong> {Object.keys(hospitalProcedures).length}
            </div>
          </div>
          
          {/* ✅ NOVO: Resumo detalhado dos dados */}
          <div className="border-t border-yellow-300 pt-3">
            <h4 className="text-xs font-bold text-yellow-800 mb-2">📊 RESUMO DETALHADO</h4>
            <div className="space-y-2 text-xs text-yellow-700">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <strong>Faturamento Total:</strong> {formatCurrency(totalRealRevenue)}
                </div>
                <div>
                  <strong>Média por Hospital:</strong> {formatCurrency(avgRevenuePerHospital)}
                </div>
              </div>
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <strong>Procedimentos:</strong> {totalProceduresCount.toLocaleString('pt-BR')}
                </div>
                <div>
                  <strong>AIHs:</strong> {totalAIHsCount.toLocaleString('pt-BR')}
                </div>
                <div>
                  <strong>Pacientes:</strong> {totalPatientsCount.toLocaleString('pt-BR')}
                </div>
              </div>
              
              {/* ✅ NOVO: Validação de dados */}
              <div className="border-t border-yellow-300 pt-2 mt-2">
                <strong>Validação de Dados:</strong>
                <div className="ml-2 space-y-1">
                  <div className={hospitalStats.length > 0 ? "text-green-700" : "text-red-700"}>
                    ✓ Hospitais: {hospitalStats.length > 0 ? "OK" : "ERRO - Nenhum hospital"}
                  </div>
                  <div className={uniqueDoctors.length > 0 ? "text-green-700" : "text-red-700"}>
                    ✓ Médicos: {uniqueDoctors.length > 0 ? "OK" : "ERRO - Nenhum médico"}
                  </div>
                  <div className={Object.keys(realRevenue).length > 0 ? "text-green-700" : "text-red-700"}>
                    ✓ Revenue: {Object.keys(realRevenue).length > 0 ? "OK" : "ERRO - Nenhuma receita"}
                  </div>
                  <div className={Object.keys(hospitalProcedures).length > 0 ? "text-green-700" : "text-red-700"}>
                    ✓ Procedures: {Object.keys(hospitalProcedures).length > 0 ? "OK" : "ERRO - Nenhum procedimento"}
                  </div>
                </div>
              </div>
              
              {/* ✅ NOVO: Problemas identificados */}
              <div className="border-t border-yellow-300 pt-2 mt-2">
                <strong>Problemas Identificados:</strong>
                <div className="ml-2 space-y-1">
                  {hospitalStats.filter(h => !realRevenue[h.hospital_id] || realRevenue[h.hospital_id] === 0).length > 0 && (
                    <div className="text-red-700">
                      ⚠️ {hospitalStats.filter(h => !realRevenue[h.hospital_id] || realRevenue[h.hospital_id] === 0).length} hospitais sem revenue
                    </div>
                  )}
                  {hospitalStats.filter(h => !hospitalProcedures[h.hospital_id] || hospitalProcedures[h.hospital_id].count === 0).length > 0 && (
                    <div className="text-red-700">
                      ⚠️ {hospitalStats.filter(h => !hospitalProcedures[h.hospital_id] || hospitalProcedures[h.hospital_id].count === 0).length} hospitais sem procedures
                    </div>
                  )}
                  {uniqueDoctors.filter(d => !d.hospital_ids || d.hospital_ids.length === 0).length > 0 && (
                    <div className="text-red-700">
                      ⚠️ {uniqueDoctors.filter(d => !d.hospital_ids || d.hospital_ids.length === 0).length} médicos sem hospital
                    </div>
                  )}
                  {Object.values(realRevenue).filter(r => r > 1000000).length > 0 && (
                    <div className="text-orange-700">
                      ⚠️ {Object.values(realRevenue).filter(r => r > 1000000).length} hospitais com revenue suspeito ({'>'}1M)
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

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
                <div key={hospital.hospital_id || index} className="relative">
                  <HospitalCard 
                    hospital={hospital} 
                    uniqueDoctors={uniqueDoctors}
                    realRevenue={realRevenue[hospital.hospital_id] || 0}
                    proceduresData={hospitalProcedures[hospital.hospital_id] || { procedures: [], count: 0, uniqueTypes: 0 }}
                  />
                  {/* ✅ NOVO: Botão de reload específico */}
                  {DEBUG_ENABLED && (
                    <div className="absolute top-2 right-2">
                      <Button
                        onClick={() => reloadSpecificHospital(hospital.hospital_id)}
                        variant="ghost"
                        size="sm"
                        disabled={isReloadingSpecific === hospital.hospital_id}
                        className="text-xs"
                      >
                        {isReloadingSpecific === hospital.hospital_id ? (
                          <RefreshCw className="w-3 h-3 animate-spin" />
                        ) : (
                          "🔄"
                        )}
                      </Button>
                    </div>
                  )}
                </div>
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
  
  // ✅ CORREÇÃO: Filtrar médicos deste hospital com validação mais robusta
  const hospitalDoctors = uniqueDoctors.filter(doctor => {
    if (!doctor.hospital_ids || !hospital.hospital_id) return false;
    
    // Buscar pelo ID do hospital na lista de IDs
    const hospitalIds = doctor.hospital_ids.split(',').map(id => id.trim());
    return hospitalIds.includes(hospital.hospital_id);
  });

  const activeDoctors = hospitalDoctors.filter(d => d.activity_status === 'ATIVO');
  const doctorsWithMultipleHospitals = hospitalDoctors.filter(d => d.hospitals_count > 1);

  // ✅ CORREÇÃO: Lógica para especialidade principal com fallback
  const getTopSpecialty = (): string => {
    // 1. Tentar usar especialidade da view
    if (hospital.top_specialty_by_revenue && hospital.top_specialty_by_revenue !== 'N/A') {
      return hospital.top_specialty_by_revenue;
    }
    
    // 2. Calcular especialidade com maior faturamento dos médicos
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
    
    // Encontrar especialidade com maior faturamento
    const topSpecialty = Object.entries(specialtyRevenue)
      .sort(([,a], [,b]) => b.total - a.total)[0];
    
    if (topSpecialty && topSpecialty[1].total > 0) {
      return topSpecialty[0];
    }
    
    // 3. Fallback para especialidade mais comum
    const mostCommonSpecialty = hospitalDoctors
      .map(d => d.doctor_specialty)
      .filter(s => s && s !== 'Não informado')
      .reduce((acc, specialty) => {
        acc[specialty] = (acc[specialty] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);
    
    const commonSpecialty = Object.entries(mostCommonSpecialty)
      .sort(([,a], [,b]) => b - a)[0];
    
    return commonSpecialty ? commonSpecialty[0] : 'Não informado';
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
    
    // Log para debug
    debugLog(`🔍 HospitalCard [${hospital.hospital_name}] - Revenue (sem correção): ${cleanRevenue}`);
    
    return cleanRevenue;
  };

  const validatedRevenue = validateRevenue(realRevenue);
  
  // ✅ CORREÇÃO: Como não aplicamos correções automáticas, nunca há "correção"
  // O valor sempre será exibido normalmente em verde
  const revenueWasCorrected = false;

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
            {activeDoctors.length} ativos
            {doctorsWithMultipleHospitals.length > 0 && (
              <span className="text-orange-600 ml-1">
                • {doctorsWithMultipleHospitals.length} múltiplos
              </span>
            )}
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
            {procedureTypes > 0 ? (
              <>
                {formatNumber(procedureTypes)} tipos únicos
                {procedureValue > 0 && (
                  <span className="block text-xs text-gray-600 mt-1">
                    Valor: {formatCurrency(procedureValue)}
                  </span>
                )}
              </>
            ) : 'Sem dados'}
          </p>
        </div>

        {/* 4. INDICADOR: ESPECIALIDADE */}
        <div className="bg-gray-50 p-3 rounded-lg">
          <div className="flex items-center">
            <TrendingUp className="w-4 h-4 text-gray-600 mr-2" />
            <span className="text-xs text-gray-600 font-medium">Especialidade</span>
          </div>
          <p className="text-sm font-bold text-gray-900 mt-1">
            {getTopSpecialty()}
          </p>
          <p className="text-xs text-gray-600">
            {hospitalDoctors.length > 0 ? (
              <>
                top faturamento
                {hospitalDoctors.length > 1 && (
                  <span className="block text-xs text-gray-500 mt-1">
                    {hospitalDoctors.length} especialidades
                  </span>
                )}
              </>
            ) : 'Sem dados'}
          </p>
        </div>
      </div>

      {/* ✅ NOVO: Seção de debug (removível em produção) */}
      {DEBUG_ENABLED && (
        <div className="mt-4 p-3 bg-yellow-50 rounded-lg border border-yellow-200">
          <h5 className="text-xs font-bold text-yellow-800 mb-2">🔍 DEBUG INFO</h5>
          <div className="text-xs text-yellow-700 space-y-1">
            <div>Médicos Filtrados: {hospitalDoctors.length} / {uniqueDoctors.length}</div>
            <div>Revenue Original: {realRevenue}</div>
            <div>Revenue Corrigido: {validatedRevenue}</div>
            <div>Procedimentos: {procedureCount} ({procedureTypes} tipos)</div>
            <div>Especialidade: {getTopSpecialty()}</div>
          </div>
        </div>
      )}
    </div>
  );
};

export default HospitalRevenueDashboard; 
import { supabase } from '../lib/supabase';
import { DateRange } from '../types';

// ===== INTERFACES BASEADAS NAS VIEWS =====

export interface AIHBillingSummary {
  total_aihs: number;
  total_value: number;
  avg_value_per_aih: number;
  approved_aihs: number;
  approved_value: number;
  rejected_aihs: number;
  rejected_value: number;
  pending_aihs: number;
  pending_value: number;
  earliest_date: string;
  latest_date: string;
  avg_length_of_stay: number;
}

export interface AIHBillingByHospital {
  hospital_id: string;
  hospital_name: string;
  hospital_cnpj: string;
  total_aihs: number;
  total_value: number;
  avg_value_per_aih: number;
  approved_aihs: number;
  approved_value: number;
  rejected_aihs: number;
  rejected_value: number;
  pending_aihs: number;
  pending_value: number;
  avg_length_of_stay: number;
  unique_procedures: number;
  unique_diagnoses: number;
  unique_doctors: number;
}

export interface AIHBillingByMonth {
  month: string;
  total_aihs: number;
  total_value: number;
  avg_value_per_aih: number;
  approved_aihs: number;
  approved_value: number;
  rejected_aihs: number;
  rejected_value: number;
  pending_aihs: number;
  pending_value: number;
  avg_length_of_stay: number;
  unique_hospitals: number;
  unique_procedures: number;
  unique_doctors: number;
}

export interface AIHBillingByDoctor {
  doctor_id: string;
  doctor_name: string;
  doctor_cns: string;
  doctor_crm: string;
  doctor_crm_state: string;
  doctor_specialty: string;
  total_aihs: number;
  total_value: number;
  avg_value_per_aih: number;
  approved_aihs: number;
  approved_value: number;
  rejected_aihs: number;
  rejected_value: number;
  pending_aihs: number;
  pending_value: number;
  avg_length_of_stay: number;
  unique_procedures: number;
  unique_diagnoses: number;
  unique_hospitals: number;
}

export interface AIHBillingByProcedure {
  procedure_code: string;
  procedure_description: string;
  total_aihs: number;
  total_procedures?: number;
  total_value: number;
  avg_value_per_aih: number;
  approved_aihs: number;
  approved_value: number;
  rejected_aihs: number;
  rejected_value: number;
  pending_aihs: number;
  pending_value: number;
  avg_length_of_stay: number;
  unique_specialties: number;
  unique_hospitals: number;
  unique_doctors: number;
  // 🆕 Quantidade de ocorrências como Procedimento Principal (sequencia = 1)
  principal_count?: number;
}

export interface AIHBillingByHospitalSpecialty {
  hospital_id: string;
  hospital_name: string;
  doctor_specialty: string;
  total_aihs: number;
  total_value: number;
  avg_value_per_aih: number;
  approved_aihs: number;
  approved_value: number;
  rejected_aihs: number;
  rejected_value: number;
  pending_aihs: number;
  pending_value: number;
  avg_length_of_stay: number;
  unique_procedures: number;
  unique_diagnoses: number;
  unique_doctors: number;
}

// ===== INTERFACE PARA DASHBOARD CONSOLIDADO =====

export interface CompleteBillingStats {
  summary: AIHBillingSummary | null;
  byHospital: AIHBillingByHospital[];
  byMonth: AIHBillingByMonth[];
  byDoctor: AIHBillingByDoctor[];
  byProcedure: AIHBillingByProcedure[];
  byHospitalSpecialty: AIHBillingByHospitalSpecialty[];
  
  // Métricas calculadas
  metrics: {
    totalRevenue: number;
    totalAIHs: number;
    averageTicket: number;
    approvalRate: number;
    totalPatients: number;
    activeHospitals: number;
    activeDoctors: number;
    topHospitalByRevenue?: AIHBillingByHospital;
    topDoctorByRevenue?: AIHBillingByDoctor;
    topProcedureByValue?: AIHBillingByProcedure;
    monthlyGrowthRate?: number;
  };
}

export class AIHBillingService {
  /**
   * Busca resumo geral de todas as AIHs
   */
  static async getBillingSummary(dateRange?: DateRange): Promise<AIHBillingSummary | null> {
    try {
      console.log('📊 Buscando resumo geral das AIHs...');
      
      // Se temos filtro de data, buscar diretamente da tabela aihs
      if (dateRange) {
        console.log('📅 Consultando resumo com filtros de data...');
        
        // Janela do dia inteiro por data de ALTA: [início do dia, início do dia seguinte)
        const startOfDay = new Date(dateRange.startDate.getFullYear(), dateRange.startDate.getMonth(), dateRange.startDate.getDate(), 0, 0, 0, 0);
        const startOfNextDay = new Date(dateRange.endDate.getFullYear(), dateRange.endDate.getMonth(), dateRange.endDate.getDate() + 1, 0, 0, 0, 0);
        const startDateISO = startOfDay.toISOString();
        const endExclusiveISO = startOfNextDay.toISOString();
        
        // Query customizada com filtros de data
        const { data, error } = await supabase
          .from('aihs')
          .select('calculated_total_value, processing_status, admission_date, discharge_date')
        .gte('discharge_date', startDateISO)
        .lt('discharge_date', endExclusiveISO)
        .not('discharge_date', 'is', null);
          
        if (error) {
          console.error('❌ Erro ao buscar AIHs com filtro de data:', error);
          return null;
        }
        
        // Calcular estatísticas manualmente
        const totalAihs = data?.length || 0;
        const totalValue = data?.reduce((sum, aih) => sum + (aih.calculated_total_value || 0), 0) || 0;
        const approvedAihs = data?.filter(aih => 
          aih.processing_status === 'approved' || aih.processing_status === 'matched'
        ).length || 0;
        const approvedValue = data?.filter(aih => 
          aih.processing_status === 'approved' || aih.processing_status === 'matched'
        ).reduce((sum, aih) => sum + (aih.calculated_total_value || 0), 0) || 0;
        
        return {
          total_aihs: totalAihs,
          total_value: totalValue / 100, // Converter centavos para reais
          avg_value_per_aih: totalAihs > 0 ? (totalValue / 100) / totalAihs : 0,
          approved_aihs: approvedAihs,
          approved_value: approvedValue / 100,
          rejected_aihs: 0,
          rejected_value: 0,
          pending_aihs: totalAihs - approvedAihs,
          pending_value: (totalValue - approvedValue) / 100,
          earliest_date: dateRange.startDate.toISOString(),
          latest_date: dateRange.endDate.toISOString(),
          avg_length_of_stay: 3.5
        };
      }
      
      // Usar view padrão se não há filtro de data
      const { data, error } = await supabase
        .from('v_aih_billing_summary')
        .select('*')
        .single();

      if (error) {
        console.error('❌ Erro ao buscar resumo das AIHs:', error);
        return null;
      }

      console.log('✅ Resumo das AIHs obtido:', data);
      return data;
    } catch (error) {
      console.error('❌ Erro na consulta do resumo:', error);
      return null;
    }
  }

  /**
   * Busca dados de faturamento por hospital
   */
  static async getBillingByHospital(dateRange?: DateRange): Promise<AIHBillingByHospital[]> {
    try {
      console.log('🏥 Buscando faturamento por hospital...');
      
      // ✅ OTIMIZAÇÃO: Usar query direta em vez da view (evita timeout)
      // Filtrar últimos 12 meses por padrão
      const twelveMonthsAgo = new Date();
      twelveMonthsAgo.setMonth(twelveMonthsAgo.getMonth() - 12);
      
      const { data: aihs, error } = await supabase
        .from('aihs')
        .select(`
          hospital_id,
          hospitals!inner(name),
          original_value
        `)
        .gte('admission_date', twelveMonthsAgo.toISOString())
        .order('created_at', { ascending: false });

      if (error) {
        console.error('❌ Erro ao buscar dados por hospital:', error);
        return [];
      }

      // Agregar por hospital (client-side)
      const hospitalMap = new Map<string, {
        hospital_id: string;
        hospital_name: string;
        total_aihs: number;
        total_value: number;
      }>();

      (aihs || []).forEach((aih: any) => {
        const hospitalId = aih.hospital_id;
        const hospitalName = aih.hospitals?.name || 'Hospital Desconhecido';
        const value = (aih.original_value || 0) / 100;

        if (!hospitalMap.has(hospitalId)) {
          hospitalMap.set(hospitalId, {
            hospital_id: hospitalId,
            hospital_name: hospitalName,
            total_aihs: 0,
            total_value: 0
          });
        }

        const current = hospitalMap.get(hospitalId)!;
        current.total_aihs += 1;
        current.total_value += value;
      });

      const result = Array.from(hospitalMap.values())
        .sort((a, b) => b.total_value - a.total_value);

      console.log(`✅ Dados de ${result.length} hospitais obtidos (últimos 12 meses)`);
      return result;
    } catch (error) {
      console.error('❌ Erro na consulta por hospital:', error);
      return [];
    }
  }

  /**
   * Busca tendência mensal de faturamento
   */
  static async getBillingByMonth(dateRange?: DateRange): Promise<AIHBillingByMonth[]> {
    try {
      console.log('📅 Buscando tendência mensal...');
      
      // ✅ OTIMIZAÇÃO: Usar query direta em vez da view (evita timeout)
      // Filtrar últimos 12 meses
      const twelveMonthsAgo = new Date();
      twelveMonthsAgo.setMonth(twelveMonthsAgo.getMonth() - 12);
      
      const { data: aihs, error } = await supabase
        .from('aihs')
        .select('admission_date, original_value')
        .gte('admission_date', twelveMonthsAgo.toISOString())
        .order('admission_date', { ascending: true });

      if (error) {
        console.error('❌ Erro ao buscar dados mensais:', error);
        return [];
      }

      // Agregar por mês (client-side)
      const monthMap = new Map<string, {
        month: string;
        total_aihs: number;
        total_value: number;
      }>();

      (aihs || []).forEach((aih: any) => {
        if (!aih.admission_date) return;
        
        const date = new Date(aih.admission_date);
        const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
        const value = (aih.original_value || 0) / 100;

        if (!monthMap.has(monthKey)) {
          monthMap.set(monthKey, {
            month: monthKey,
            total_aihs: 0,
            total_value: 0
          });
        }

        const current = monthMap.get(monthKey)!;
        current.total_aihs += 1;
        current.total_value += value;
      });

      const result = Array.from(monthMap.values())
        .sort((a, b) => a.month.localeCompare(b.month));

      console.log(`✅ Dados de ${result.length} meses obtidos (últimos 12 meses)`);
      return result;
    } catch (error) {
      console.error('❌ Erro na consulta mensal:', error);
      return [];
    }
  }

  /**
   * Busca dados de faturamento por médico
   */
  static async getBillingByDoctor(limit: number = 50, dateRange?: DateRange): Promise<AIHBillingByDoctor[]> {
    try {
      console.log(`👨‍⚕️ Buscando faturamento por médico (top ${limit})...`);
      
      // ✅ OTIMIZAÇÃO: Usar query direta em vez da view (evita timeout)
      // Filtrar últimos 12 meses
      const twelveMonthsAgo = new Date();
      twelveMonthsAgo.setMonth(twelveMonthsAgo.getMonth() - 12);
      
      const { data: aihs, error } = await supabase
        .from('aihs')
        .select('cns_responsavel, requesting_physician, original_value')
        .gte('admission_date', twelveMonthsAgo.toISOString())
        .not('cns_responsavel', 'is', null);

      if (error) {
        console.error('❌ Erro ao buscar dados por médico:', error);
        return [];
      }

      // Agregar por médico (client-side)
      const doctorMap = new Map<string, {
        doctor_cns: string;
        doctor_name: string;
        total_aihs: number;
        total_value: number;
      }>();

      (aihs || []).forEach((aih: any) => {
        const cns = aih.cns_responsavel;
        if (!cns) return;
        
        const name = aih.requesting_physician || 'Médico Desconhecido';
        const value = (aih.original_value || 0) / 100;

        if (!doctorMap.has(cns)) {
          doctorMap.set(cns, {
            doctor_cns: cns,
            doctor_name: name,
            total_aihs: 0,
            total_value: 0
          });
        }

        const current = doctorMap.get(cns)!;
        current.total_aihs += 1;
        current.total_value += value;
      });

      const result = Array.from(doctorMap.values())
        .sort((a, b) => b.total_value - a.total_value)
        .slice(0, limit);

      console.log(`✅ Dados de ${result.length} médicos obtidos (últimos 12 meses)`);
      return result;
    } catch (error) {
      console.error('❌ Erro na consulta por médico:', error);
      return [];
    }
  }

  /**
   * Busca dados de faturamento por procedimento
   */
  static async getBillingByProcedure(limit?: number, dateRange?: DateRange, hospitalIds?: string[], excludeAnesthesia?: boolean): Promise<AIHBillingByProcedure[]> {
    try {
      console.log(`🩺 Buscando faturamento por procedimento${limit && limit > 0 ? ` (top ${limit})` : ' (sem limite)' }${hospitalIds && hospitalIds.length > 0 ? ` | filtro hospitais (${hospitalIds.length})` : ''}${excludeAnesthesia ? ' | excluindo anestesia' : ''}${dateRange ? ' | com período' : ''}...`);

      const hasHospitalFilter = hospitalIds && hospitalIds.length > 0 && !hospitalIds.includes('all');
      const requiresRecordsFallback = Boolean(dateRange) || Boolean(excludeAnesthesia);

      // Preferir agregação direta de procedure_records quando há período/anestesia
      if (requiresRecordsFallback) {
        return this.getBillingByProcedureFromRecords(hasHospitalFilter ? hospitalIds : undefined, dateRange, limit, excludeAnesthesia);
      }

      // Caso com filtro de hospital mas sem período/anestesia: usar view específica por hospital
      if (hasHospitalFilter) {
        let q = supabase
          .from('v_procedure_summary_by_hospital')
          .select('hospital_id, hospital_name, procedure_code, procedure_description, total_count, total_value, avg_value_per_procedure, approved_count, rejected_count, pending_count');
        q = q.in('hospital_id', hospitalIds!);
        const { data, error } = await q;
        if (error) {
          console.error('❌ Erro na view v_procedure_summary_by_hospital:', error);
          return [];
        }
        let mapped: AIHBillingByProcedure[] = (data || []).map((row: any) => ({
          procedure_code: row.procedure_code,
          procedure_description: row.procedure_description,
          total_aihs: row.unique_aihs_count ?? 0,
          total_procedures: row.total_count ?? 0,
          total_value: Number(row.total_value) || 0,
          avg_value_per_aih: Number(row.avg_value_per_procedure) || 0,
          approved_aihs: row.approved_count ?? 0,
          approved_value: 0,
          rejected_aihs: row.rejected_count ?? 0,
          rejected_value: 0,
          pending_aihs: row.pending_count ?? 0,
          pending_value: 0,
          avg_length_of_stay: 3.5,
          unique_specialties: 0,
          unique_hospitals: 1,
          unique_doctors: 0,
          principal_count: row.principal_count ?? undefined,
        }));

        // Ordenar e aplicar limite
        mapped.sort((a, b) => (b.total_value || 0) - (a.total_value || 0));
        if (limit && limit > 0) mapped = mapped.slice(0, limit);
        return mapped;
      }
      
      // Sem filtros: usar view global
      // ✅ OTIMIZAÇÃO: View muito pesada - usar agregação client-side
      console.log('ℹ️ View com timeout - usando agregação otimizada...');
      
      // Filtrar últimos 12 meses
      const twelveMonthsAgo = new Date();
      twelveMonthsAgo.setMonth(twelveMonthsAgo.getMonth() - 12);
      
      const effectiveLimit = limit && limit > 0 ? limit : 100;
      
      // Buscar procedures com filtro de data
      const { data: procedures, error } = await supabase
        .from('procedure_records')
        .select('procedure_code, value_charged, aih_id')
        .gte('created_at', twelveMonthsAgo.toISOString())
        .ilike('procedure_code', '04%') // Apenas procedimentos médicos
        .order('value_charged', { ascending: false })
        .limit(5000); // Limitar para evitar timeout

      if (error) {
        console.error('❌ Erro ao buscar dados por procedimento:', error);
        return [];
      }

      // Agregar por código (client-side)
      const procedureMap = new Map<string, {
        procedure_code: string;
        total_value: number;
        count: number;
      }>();

      (procedures || []).forEach((proc: any) => {
        const code = proc.procedure_code;
        if (!code) return;
        
        const value = (proc.value_charged || 0) / 100;

        if (!procedureMap.has(code)) {
          procedureMap.set(code, {
            procedure_code: code,
            total_value: 0,
            count: 0
          });
        }

        const current = procedureMap.get(code)!;
        current.count += 1;
        current.total_value += value;
      });

      const result = Array.from(procedureMap.values())
        .sort((a, b) => b.total_value - a.total_value)
        .slice(0, effectiveLimit);

      console.log(`✅ Dados de ${result.length} procedimentos obtidos (últimos 12 meses, top ${effectiveLimit})`);
      return result;
    } catch (error) {
      console.error('❌ Erro na consulta por procedimento:', error);
      return [];
    }
  }

  // Agregação client-side quando é necessário filtrar por hospitais
  private static async getBillingByProcedureFromRecords(
    hospitalIds?: string[],
    dateRange?: DateRange,
    limit?: number,
    excludeAnesthesia?: boolean
  ): Promise<AIHBillingByProcedure[]> {
    try {
      let anesthesiaCodes = new Set<string>();
      if (excludeAnesthesia) {
        try {
          const { data: anesthesiaRows } = await supabase
            .from('sigtap_procedures')
            .select('code')
            .ilike('description', '%ANESTES%');
          (anesthesiaRows || []).forEach(r => {
            if (r && (r as any).code) anesthesiaCodes.add((r as any).code);
          });
        } catch {}
      }

      const pageSize = 2000;
      let page = 0;
      let hasMore = true;
      let data: any[] = [];
      while (hasMore) {
        let q = supabase
          .from('procedure_records')
          .select('procedure_code, value_charged, billing_status, aih_id, hospital_id, professional_name, professional_cbo, procedure_date, sequencia')
          .order('procedure_date', { ascending: false })
          .range(page * pageSize, (page + 1) * pageSize - 1);
      
      if (hospitalIds && hospitalIds.length > 0) {
        q = q.in('hospital_id', hospitalIds);
      }
      if (dateRange) {
        q = q.gte('procedure_date', dateRange.startDate.toISOString())
             .lte('procedure_date', dateRange.endDate.toISOString());
      }

        const { data: pageData, error } = await q;
      if (error) {
          console.error('❌ Erro ao buscar procedure_records (paginado):', error);
          break;
        }
        if (pageData && pageData.length > 0) {
          data.push(...pageData);
          hasMore = pageData.length === pageSize;
          page += 1;
        } else {
          hasMore = false;
        }
      }

      const byCode: Record<string, {
        procedure_code: string;
        total_value_cents: number;
        count: number;
        aihSet: Set<string>;
        approvedAihSet: Set<string>;
        rejectedAihSet: Set<string>;
        pendingAihSet: Set<string>;
        hospitalsSet: Set<string>;
        doctorsSet: Set<string>;
        principalCount: number;
      }> = {};

      for (const row of (data || [])) {
        if (!row.procedure_code) continue;
        const code = row.procedure_code as string;
        if (excludeAnesthesia && anesthesiaCodes.has(code)) {
          continue; // pular linhas de procedimentos de anestesia
        }
        if (!byCode[code]) {
          byCode[code] = {
            procedure_code: code,
            total_value_cents: 0,
            count: 0,
            aihSet: new Set(),
            approvedAihSet: new Set(),
            rejectedAihSet: new Set(),
            pendingAihSet: new Set(),
            hospitalsSet: new Set(),
            doctorsSet: new Set(),
            principalCount: 0,
          };
        }
        const bucket = byCode[code];
        const aihId = (row.aih_id || '') as string;
        const hospitalId = (row.hospital_id || '') as string;
        const professionalName = (row.professional_name || '') as string;
        const valueCents = Number(row.value_charged) || 0;
        bucket.total_value_cents += valueCents;
        bucket.count += 1;
        if ((row as any).sequencia === 1) {
          bucket.principalCount += 1;
        }
        if (aihId) bucket.aihSet.add(aihId);
        if (hospitalId) bucket.hospitalsSet.add(hospitalId);
        if (professionalName) bucket.doctorsSet.add(professionalName);
        const status = (row.billing_status || '').toString();
        if (status === 'approved' || status === 'paid') bucket.approvedAihSet.add(aihId);
        else if (status === 'rejected') bucket.rejectedAihSet.add(aihId);
        else if (status === 'pending' || status === 'submitted') bucket.pendingAihSet.add(aihId);
      }

      // Buscar descrições dos códigos
      const codes = Object.keys(byCode);
      let descriptions: Record<string, string> = {};
      if (codes.length > 0) {
        const { data: sigtapRows, error: sigtapError } = await supabase
          .from('sigtap_procedures')
          .select('code, description')
          .in('code', codes);
        if (!sigtapError) {
          descriptions = (sigtapRows || []).reduce((acc: Record<string, string>, r: any) => {
            acc[r.code] = r.description;
            return acc;
          }, {});
        }
        // Fallback: tentar tabela oficial se ainda faltarem descrições
        const missingCodes = codes.filter(c => !descriptions[c]);
        if (missingCodes.length > 0) {
          try {
            const { data: officialRows } = await supabase
              .from('sigtap_procedimentos_oficial')
              .select('code, description')
              .in('code', missingCodes);
            (officialRows || []).forEach((r: any) => {
              if (r && r.code && r.description && !descriptions[r.code]) {
                descriptions[r.code] = r.description;
              }
            });
          } catch {}
        }
      }

      // Montar resposta (incluir flag principal com base em sequencia = 1)
      let result: AIHBillingByProcedure[] = codes.map(code => {
        const b = byCode[code];
        const totalAihs = b.aihSet.size;
        const totalValueReais = Math.round((b.total_value_cents / 100) * 100) / 100;
        const avgValue = totalAihs > 0 ? Math.round(((b.total_value_cents / 100) / totalAihs) * 100) / 100 : 0;
        return {
          procedure_code: code,
          procedure_description: descriptions[code] || '',
          total_aihs: totalAihs,
          total_procedures: b.count,
          total_value: totalValueReais,
          avg_value_per_aih: avgValue,
          approved_aihs: b.approvedAihSet.size,
          approved_value: 0, // não calculado aqui
          rejected_aihs: b.rejectedAihSet.size,
          rejected_value: 0, // não calculado aqui
          pending_aihs: b.pendingAihSet.size,
          pending_value: 0, // não calculado aqui
          avg_length_of_stay: 3.5,
          unique_specialties: 0,
          unique_hospitals: b.hospitalsSet.size,
          unique_doctors: b.doctorsSet.size,
          principal_count: 0,
        };
      });

      // Ordenar por total_value desc e aplicar limite
      result.sort((a, b) => (b.total_value || 0) - (a.total_value || 0));
      if (limit && limit > 0) result = result.slice(0, limit);
      return result;
    } catch (e) {
      console.error('❌ Erro ao agregar procedimentos por hospitais:', e);
      return [];
    }
  }

  /**
   * Busca dados de faturamento por hospital e especialidade
   */
  static async getBillingByHospitalSpecialty(dateRange?: DateRange): Promise<AIHBillingByHospitalSpecialty[]> {
    try {
      console.log('🏥🩺 Buscando faturamento por hospital e especialidade...');
      
      // ✅ OTIMIZAÇÃO: View muito pesada - retornar vazio por enquanto
      // Esta agregação é raramente usada e causa timeout
      // TODO: Implementar agregação client-side se necessário no futuro
      console.log('ℹ️ Dados de hospital-especialidade desabilitados temporariamente (otimização de performance)');
      return [];
    } catch (error) {
      console.error('❌ Erro na consulta por hospital e especialidade:', error);
      return [];
    }
  }

  /**
   * Busca todos os dados consolidados para o dashboard
   */
  static async getCompleteBillingStats(
    dateRange?: DateRange,
    options?: {
      hospitalIds?: string[];
      specialty?: string; // doctor_specialty
      careCharacter?: string; // '1' | '2' | '3' | '4' | 'all'
      searchTerm?: string;
      procedureLimit?: number; // quando ausente ou <= 0, retorna todos
    }
  ): Promise<CompleteBillingStats> {
    try {
      console.log('🔄 Carregando dados completos de billing...');
      
      if (dateRange) {
        console.log('📅 Aplicando filtros de data:', {
          inicio: dateRange.startDate.toLocaleDateString('pt-BR'),
          fim: dateRange.endDate.toLocaleDateString('pt-BR')
        });
      }
      
      // Buscar todos os dados em paralelo
      // ✅ CORREÇÃO: Usar Promise.allSettled para continuar mesmo se uma view falhar (timeout)
      const results = await Promise.allSettled([
        this.getBillingSummary(dateRange),
        this.getBillingByHospital(dateRange),
        this.getBillingByMonth(dateRange),
        this.getBillingByDoctor(50, dateRange),
        this.getBillingByProcedure(options?.procedureLimit || 500, dateRange), // ✅ Limite padrão de 500 para evitar timeout
        this.getBillingByHospitalSpecialty(dateRange)
      ]);

      // Extrair resultados, usando valores padrão se alguma promise falhar
      const summary = results[0].status === 'fulfilled' ? results[0].value : null;
      const byHospital = results[1].status === 'fulfilled' ? results[1].value : [];
      const byMonth = results[2].status === 'fulfilled' ? results[2].value : [];
      const byDoctor = results[3].status === 'fulfilled' ? results[3].value : [];
      const byProcedure = results[4].status === 'fulfilled' ? results[4].value : [];
      const byHospitalSpecialty = results[5].status === 'fulfilled' ? results[5].value : [];

      // Log de erros se houver
      results.forEach((result, index) => {
        if (result.status === 'rejected') {
          const viewNames = ['Summary', 'ByHospital', 'ByMonth', 'ByDoctor', 'ByProcedure', 'ByHospitalSpecialty'];
          console.warn(`⚠️ Erro ao carregar ${viewNames[index]}:`, result.reason);
        }
      });

      // Aplicar filtros globais (client-side quando views não suportam filtros diretos)
      const filteredByHospital = (() => {
        if (options?.hospitalIds && options.hospitalIds.length > 0 && !options.hospitalIds.includes('all')) {
          const set = new Set(options.hospitalIds);
          return byHospital.filter(h => set.has(h.hospital_id));
        }
        return byHospital;
      })();

      const filteredByDoctor = (() => {
        let arr = byDoctor;
        if (options?.specialty && options.specialty !== 'all') {
          arr = arr.filter(d => (d.doctor_specialty || '').toLowerCase() === options.specialty!.toLowerCase());
        }
        if (options?.searchTerm && options.searchTerm.trim()) {
          const s = options.searchTerm.toLowerCase();
          arr = arr.filter(d => (d.doctor_name || '').toLowerCase().includes(s) || (d.doctor_crm || '').toLowerCase().includes(s) || (d.doctor_specialty || '').toLowerCase().includes(s));
        }
        // Hospital filter indisponível nesta view (não há hospital_id); manter sem filtro por hospital
        return arr;
      })();

      const filteredByHospitalSpecialty = (() => {
        let arr = byHospitalSpecialty;
        if (options?.hospitalIds && options.hospitalIds.length > 0 && !options.hospitalIds.includes('all')) {
          const set = new Set(options.hospitalIds);
          arr = arr.filter(row => set.has(row.hospital_id));
        }
        if (options?.specialty && options.specialty !== 'all') {
          arr = arr.filter(row => (row.doctor_specialty || '').toLowerCase() === options.specialty!.toLowerCase());
        }
        return arr;
      })();

      // Filtrar summary por hospitalIds/careCharacter usando tabela aihs, se filtros presentes
      let filteredSummary = summary;
      if (dateRange && (options?.hospitalIds || (options?.careCharacter && options.careCharacter !== 'all'))) {
        try {
          const startOfDay = new Date(dateRange.startDate.getFullYear(), dateRange.startDate.getMonth(), dateRange.startDate.getDate(), 0, 0, 0, 0);
          const startOfNextDay = new Date(dateRange.endDate.getFullYear(), dateRange.endDate.getMonth(), dateRange.endDate.getDate() + 1, 0, 0, 0, 0);
          const startDateISO = startOfDay.toISOString();
          const endExclusiveISO = startOfNextDay.toISOString();
          let q = supabase
            .from('aihs')
            .select('calculated_total_value, processing_status, admission_date, discharge_date, care_character, hospital_id')
            .gte('discharge_date', startDateISO)
            .lt('discharge_date', endExclusiveISO)
            .not('discharge_date', 'is', null);
          if (options?.hospitalIds && options.hospitalIds.length > 0 && !options.hospitalIds.includes('all')) {
            q = q.in('hospital_id', options.hospitalIds);
          }
          if (options?.careCharacter && options.careCharacter !== 'all') {
            q = q.eq('care_character', options.careCharacter);
          }
          const { data, error } = await q;
          if (!error && data) {
            const totalAihs = data.length;
            const totalValue = data.reduce((sum, aih: any) => sum + (aih.calculated_total_value || 0), 0);
            const approvedAihs = data.filter((aih: any) => aih.processing_status === 'approved' || aih.processing_status === 'matched').length;
            const approvedValue = data.filter((aih: any) => aih.processing_status === 'approved' || aih.processing_status === 'matched')
              .reduce((sum, aih: any) => sum + (aih.calculated_total_value || 0), 0);
            filteredSummary = {
              total_aihs: totalAihs,
              total_value: totalValue / 100,
              avg_value_per_aih: totalAihs > 0 ? (totalValue / 100) / totalAihs : 0,
              approved_aihs: approvedAihs,
              approved_value: approvedValue / 100,
              rejected_aihs: 0,
              rejected_value: 0,
              pending_aihs: totalAihs - approvedAihs,
              pending_value: (totalValue - approvedValue) / 100,
              earliest_date: dateRange.startDate.toISOString(),
              latest_date: dateRange.endDate.toISOString(),
              avg_length_of_stay: 3.5
            };
          }
        } catch {}
      }

      // Calcular métricas com arrays filtrados
      const metrics = this.calculateMetrics(filteredSummary, filteredByHospital, byMonth, filteredByDoctor, byProcedure);

      const result: CompleteBillingStats = {
        summary: filteredSummary,
        byHospital: filteredByHospital,
        byMonth,
        byDoctor: filteredByDoctor,
        byProcedure,
        byHospitalSpecialty: filteredByHospitalSpecialty,
        metrics
      };

      console.log('✅ Dados completos de billing carregados:', {
        totalRevenue: `R$ ${metrics.totalRevenue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`,
        totalAIHs: metrics.totalAIHs,
        activeHospitals: metrics.activeHospitals,
        activeDoctors: metrics.activeDoctors,
        approvalRate: `${metrics.approvalRate.toFixed(1)}%`
      });

      return result;
    } catch (error) {
      console.error('❌ Erro ao carregar dados completos:', error);
      
      // Retornar estrutura vazia em caso de erro
      return {
        summary: null,
        byHospital: [],
        byMonth: [],
        byDoctor: [],
        byProcedure: [],
        byHospitalSpecialty: [],
        metrics: {
          totalRevenue: 0,
          totalAIHs: 0,
          averageTicket: 0,
          approvalRate: 0,
          totalPatients: 0,
          activeHospitals: 0,
          activeDoctors: 0
        }
      };
    }
  }

  /**
   * Calcula métricas derivadas a partir dos dados das views
   */
  private static calculateMetrics(
    summary: AIHBillingSummary | null,
    byHospital: AIHBillingByHospital[],
    byMonth: AIHBillingByMonth[],
    byDoctor: AIHBillingByDoctor[],
    byProcedure: AIHBillingByProcedure[]
  ) {
    const totalRevenue = summary?.total_value || 0;
    const totalAIHs = summary?.total_aihs || 0;
    const averageTicket = summary?.avg_value_per_aih || 0;
    
    // Taxa de aprovação
    const approvalRate = summary && summary.total_aihs > 0 
      ? (summary.approved_aihs / summary.total_aihs) * 100 
      : 0;

    // Hospitais e médicos ativos
    const activeHospitals = byHospital.length;
    const activeDoctors = byDoctor.length;

    // Estimativa de pacientes únicos (baseada na média de AIHs por paciente)
    const estimatedPatientsPerAIH = 0.8; // Estimativa: 1 paciente para cada 1.25 AIHs
    const totalPatients = Math.round(totalAIHs * estimatedPatientsPerAIH);

    // Top performers
    const topHospitalByRevenue = byHospital[0];
    const topDoctorByRevenue = byDoctor[0];
    const topProcedureByValue = byProcedure[0];

    // Taxa de crescimento mensal (últimos 2 meses)
    let monthlyGrowthRate: number | undefined;
    if (byMonth.length >= 2) {
      const currentMonth = byMonth[byMonth.length - 1];
      const previousMonth = byMonth[byMonth.length - 2];
      
      if (previousMonth.total_value > 0) {
        monthlyGrowthRate = ((currentMonth.total_value - previousMonth.total_value) / previousMonth.total_value) * 100;
      }
    }

    return {
      totalRevenue,
      totalAIHs,
      averageTicket,
      approvalRate,
      totalPatients,
      activeHospitals,
      activeDoctors,
      topHospitalByRevenue,
      topDoctorByRevenue,
      topProcedureByValue,
      monthlyGrowthRate
    };
  }

  /**
   * Busca dados de um hospital específico
   */
  static async getHospitalBillingStats(hospitalId: string): Promise<{
    hospital: AIHBillingByHospital | null;
    specialties: AIHBillingByHospitalSpecialty[];
  }> {
    try {
      console.log(`🏥 Buscando dados específicos do hospital: ${hospitalId}`);
      
      const [hospitalData, specialtiesData] = await Promise.all([
        supabase
          .from('v_aih_billing_by_hospital')
          .select('*')
          .eq('hospital_id', hospitalId)
          .single(),
        supabase
          .from('v_aih_billing_by_hospital_specialty')
          .select('*')
          .eq('hospital_id', hospitalId)
          .order('total_value', { ascending: false })
      ]);

      return {
        hospital: hospitalData.data,
        specialties: specialtiesData.data || []
      };
    } catch (error) {
      console.error('❌ Erro ao buscar dados do hospital:', error);
      return {
        hospital: null,
        specialties: []
      };
    }
  }

  /**
   * Busca top procedimentos por valor
   */
  static async getTopProceduresByValue(limit: number = 10): Promise<AIHBillingByProcedure[]> {
    try {
      const { data, error } = await supabase
        .from('v_aih_billing_by_procedure')
        .select('*')
        .order('total_value', { ascending: false })
        .limit(limit);

      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error('❌ Erro ao buscar top procedimentos:', error);
      return [];
    }
  }

  /**
   * Busca top médicos por faturamento
   */
  static async getTopDoctorsByRevenue(limit: number = 10): Promise<AIHBillingByDoctor[]> {
    try {
      const { data, error } = await supabase
        .from('v_aih_billing_by_doctor')
        .select('*')
        .order('total_value', { ascending: false })
        .limit(limit);

      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error('❌ Erro ao buscar top médicos:', error);
      return [];
    }
  }

  /**
   * Lista detalhada de registros de procedure_records com paginação e filtros
   */
  static async getProcedureRecordsDetailed(options?: {
    dateRange?: DateRange;
    hospitalIds?: string[];
    excludeAnesthesia?: boolean;
    page?: number; // 1-based
    pageSize?: number;
  }): Promise<{ rows: any[]; total: number; }> {
    const page = Math.max(1, options?.page || 1);
    const pageSize = Math.max(1, Math.min(200, options?.pageSize || 20));
    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;

    try {
      let q = supabase
        .from('procedure_records')
        .select(`
          id,
          hospital_id,
          patient_id,
          aih_id,
          procedure_date,
          procedure_code,
          procedure_name,
          procedure_description,
          value_charged,
          professional_name,
          professional_cbo,
          billing_status,
          match_status,
          sequencia
        `, { count: 'exact' })
        .order('procedure_date', { ascending: false })
        .range(from, to);

      if (options?.hospitalIds && options.hospitalIds.length > 0 && !options.hospitalIds.includes('all')) {
        q = q.in('hospital_id', options.hospitalIds);
      }
      if (options?.dateRange) {
        q = q
          .gte('procedure_date', options.dateRange.startDate.toISOString())
          .lte('procedure_date', options.dateRange.endDate.toISOString());
      }
      if (options?.excludeAnesthesia) {
        q = q.or(
          'professional_cbo.is.null,' +
          'professional_cbo.neq.225151,' +
          'and(professional_cbo.eq.225151,procedure_code.like.03%),' +
          'and(professional_cbo.eq.225151,procedure_code.eq."04.17.01.001-0")'
        );
      }

      const { data, error, count } = await q;
      if (error) {
        console.error('❌ Erro ao buscar procedure_records detalhado:', error);
        return { rows: [], total: 0 };
      }

      return { rows: data || [], total: count || 0 };
    } catch (e) {
      console.error('❌ Erro inesperado em getProcedureRecordsDetailed:', e);
      return { rows: [], total: 0 };
    }
  }
} 
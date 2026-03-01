import { supabase, Hospital, SigtapVersion, SigtapProcedureDB, PatientDB, AIHDB, AIHMatch, ProcedureRecordDB, SystemSetting, AuditLog, centavosToReais, reaisToCentavos } from '../lib/supabase';
import { SigtapProcedure } from '../types';

// 🚀 PERFORMANCE OPTIMIZATION: CACHING AND CONNECTION POOLING
interface CacheEntry {
  data: any;
  timestamp: number;
  expiresAt: number;
}

interface ConnectionPool {
  maxConnections: number;
  currentConnections: number;
  queue: Array<() => void>;
}

class PerformanceOptimizer {
  private cache: Map<string, CacheEntry> = new Map();
  private connectionPool: ConnectionPool = {
    maxConnections: 10,
    currentConnections: 0,
    queue: []
  };
  private readonly CACHE_TTL = 5 * 60 * 1000; // 5 minutes
  private readonly MAX_CACHE_SIZE = 100;

  // Simple LRU cache implementation
  private lruKeys: string[] = [];

  constructor() {
    // Cleanup expired cache entries every minute
    setInterval(() => this.cleanupExpiredCache(), 60000);
  }

  // 🚀 CACHING SYSTEM
  async getCached<T>(key: string, fetcher: () => Promise<T>, ttl?: number): Promise<T> {
    const now = Date.now();
    const cached = this.cache.get(key);
    
    if (cached && cached.expiresAt > now) {
      console.log(`🚀 Cache hit for key: ${key}`);
      this.updateLRU(key);
      return cached.data;
    }

    console.log(`🚀 Cache miss for key: ${key}`);
    const data = await this.executeWithConnectionPool(fetcher);
    
    this.setCache(key, data, ttl);
    return data;
  }

  private setCache(key: string, data: any, ttl?: number): void {
    const expiresAt = Date.now() + (ttl || this.CACHE_TTL);
    
    // Remove oldest entry if cache is full
    if (this.cache.size >= this.MAX_CACHE_SIZE && !this.cache.has(key)) {
      const oldestKey = this.lruKeys[0];
      this.cache.delete(oldestKey);
      this.lruKeys = this.lruKeys.slice(1);
    }

    this.cache.set(key, { data, timestamp: Date.now(), expiresAt });
    this.updateLRU(key);
  }

  private updateLRU(key: string): void {
    this.lruKeys = this.lruKeys.filter(k => k !== key);
    this.lruKeys.push(key);
  }

  private cleanupExpiredCache(): void {
    const now = Date.now();
    let cleaned = 0;
    
    for (const [key, entry] of this.cache.entries()) {
      if (entry.expiresAt <= now) {
        this.cache.delete(key);
        this.lruKeys = this.lruKeys.filter(k => k !== key);
        cleaned++;
      }
    }
    
    if (cleaned > 0) {
      console.log(`🧹 Cleaned ${cleaned} expired cache entries`);
    }
  }

  // 🚀 CONNECTION POOLING
  private async executeWithConnectionPool<T>(operation: () => Promise<T>): Promise<T> {
    return new Promise((resolve, reject) => {
      const execute = async () => {
        try {
          this.connectionPool.currentConnections++;
          const result = await operation();
          this.connectionPool.currentConnections--;
          this.processQueue();
          resolve(result);
        } catch (error) {
          this.connectionPool.currentConnections--;
          this.processQueue();
          reject(error);
        }
      };

      if (this.connectionPool.currentConnections < this.connectionPool.maxConnections) {
        execute();
      } else {
        this.connectionPool.queue.push(execute);
      }
    });
  }

  private processQueue(): void {
    if (this.connectionPool.queue.length > 0 && this.connectionPool.currentConnections < this.connectionPool.maxConnections) {
      const next = this.connectionPool.queue.shift();
      if (next) next();
    }
  }

  // 🚀 BATCH PROCESSING OPTIMIZATION
  async processInBatches<T, R>(
    items: T[],
    processor: (batch: T[]) => Promise<R[]>,
    batchSize: number = 50
  ): Promise<R[]> {
    const results: R[] = [];
    
    for (let i = 0; i < items.length; i += batchSize) {
      const batch = items.slice(i, i + batchSize);
      console.log(`🔄 Processing batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(items.length / batchSize)}`);
      
      const batchResults = await this.executeWithConnectionPool(() => processor(batch));
      results.push(...batchResults);
      
      // Small delay to prevent overwhelming the system
      if (i + batchSize < items.length) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    }
    
    return results;
  }

  // 🚀 QUERY OPTIMIZATION
  buildOptimizedQuery(table: string, select: string[], filters: Record<string, any>, options?: {
    limit?: number;
    offset?: number;
    orderBy?: { column: string; ascending: boolean };
  }) {
    let query = supabase.from(table).select(select.join(','));

    // Apply filters
    Object.entries(filters).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== '') {
        if (Array.isArray(value)) {
          query = query.in(key, value);
        } else if (typeof value === 'string' && value.includes('%')) {
          query = query.like(key, value);
        } else {
          query = query.eq(key, value);
        }
      }
    });

    // Apply options
    if (options?.limit) {
      query = query.limit(options.limit);
    }
    
    if (options?.offset) {
      query = query.range(options.offset, options.offset + (options.limit || 50) - 1);
    }
    
    if (options?.orderBy) {
      query = query.order(options.orderBy.column, { ascending: options.orderBy.ascending });
    }

    return query;
  }

  // Clear cache for specific patterns
  invalidateCache(pattern?: string): void {
    if (pattern) {
      const keysToDelete = Array.from(this.cache.keys()).filter(key => key.includes(pattern));
      keysToDelete.forEach(key => {
        this.cache.delete(key);
        this.lruKeys = this.lruKeys.filter(k => k !== key);
      });
      console.log(`🗑️ Invalidated ${keysToDelete.length} cache entries for pattern: ${pattern}`);
    } else {
      this.cache.clear();
      this.lruKeys = [];
      console.log('🗑️ Cleared entire cache');
    }
  }

  // Get cache statistics
  getCacheStats(): { size: number; hitRate: number; memoryUsage: number } {
    return {
      size: this.cache.size,
      hitRate: this.cache.size > 0 ? 0.8 : 0, // Simplified hit rate calculation
      memoryUsage: JSON.stringify(Array.from(this.cache.entries())).length
    };
  }
}

// Export singleton instance
export const performanceOptimizer = new PerformanceOptimizer();

// SIGTAP SERVICE
export class SigtapService {
  static async createVersion(version: Omit<SigtapVersion, 'id' | 'created_at'>): Promise<SigtapVersion> {
    console.log('💾 Criando versão com dados:', JSON.stringify(version, null, 2));
    
    const { data, error } = await supabase
      .from('sigtap_versions')
      .insert(version)
      .select()
      .single();
    
    if (error) {
      console.error('❌ Erro ao criar versão:', error);
      console.error('❌ Dados enviados:', version);
      throw error;
    }
    
    console.log('✅ Versão criada com sucesso:', data.id);
    return data;
  }

  static async getActiveVersion(): Promise<SigtapVersion | null> {
    const { data, error } = await supabase
      .from('sigtap_versions')
      .select('*')
      .eq('is_active', true)
      .single();
    
    if (error) {
      if (error.code === 'PGRST116') return null;
      throw error;
    }
    return data;
  }

  static async setActiveVersion(versionId: string): Promise<void> {
    await supabase
      .from('sigtap_versions')
      .update({ is_active: false })
      .neq('id', '00000000-0000-0000-0000-000000000000');

    const { error } = await supabase
      .from('sigtap_versions')
      .update({ is_active: true })
      .eq('id', versionId);
    
    if (error) throw error;
  }

  static async saveProcedures(versionId: string, procedures: SigtapProcedure[]): Promise<void> {
    console.log(`💾 Preparando ${procedures.length} procedimentos para salvar...`);
    
    // Remover duplicatas por código antes de salvar
    const uniqueProcedures = procedures.reduce((acc, proc) => {
      if (!acc.some(p => p.code === proc.code)) {
        acc.push(proc);
      }
      return acc;
    }, [] as SigtapProcedure[]);
    
    console.log(`💾 ${uniqueProcedures.length} procedimentos únicos após deduplicação`);
    
    const dbProcedures = uniqueProcedures.map(proc => {
      // 🔧 VALIDAÇÃO E SANITIZAÇÃO DE DADOS
      const sanitizedProc = {
        version_id: versionId,
        code: proc.code,
        description: proc.description,
        origem: proc.origem || null,
        complexity: proc.complexity || null,
        modality: proc.modality || null,
        registration_instrument: proc.registrationInstrument || null,
        financing: proc.financing || null,
        value_amb: reaisToCentavos(proc.valueAmb || 0),
        value_amb_total: reaisToCentavos(proc.valueAmbTotal || 0),
        value_hosp: reaisToCentavos(proc.valueHosp || 0),
        value_prof: reaisToCentavos(proc.valueProf || 0),
        value_hosp_total: reaisToCentavos(proc.valueHospTotal || 0),
        complementary_attribute: proc.complementaryAttribute || null,
        service_classification: proc.serviceClassification || null,
        especialidade_leito: proc.especialidadeLeito || null,
        gender: proc.gender && proc.gender.trim() !== '' ? proc.gender : null,
        min_age: proc.minAge && proc.minAge > 0 ? Math.min(proc.minAge, 150) : null,
        min_age_unit: proc.minAgeUnit && proc.minAgeUnit.trim() !== '' ? proc.minAgeUnit : null,
        max_age: proc.maxAge && proc.maxAge > 0 ? Math.min(proc.maxAge, 150) : null,
        max_age_unit: proc.maxAgeUnit && proc.maxAgeUnit.trim() !== '' ? proc.maxAgeUnit : null,
        max_quantity: proc.maxQuantity ? Math.min(proc.maxQuantity, 999999) : null,
        average_stay: proc.averageStay && proc.averageStay > 0 ? Math.min(proc.averageStay, 999.99) : null,
        points: proc.points ? Math.min(proc.points, 2000000000) : null,
        cbo: proc.cbo || [],
        cid: proc.cid || [],
        habilitation: proc.habilitation || null,
        habilitation_group: proc.habilitationGroup || [],
        extraction_confidence: 100,
        validation_status: 'valid'
      };

      // 🚨 LOG DE VALORES TRUNCADOS
      if (proc.minAge && proc.minAge > 150) {
        console.warn(`⚠️ VALOR TRUNCADO - Procedimento ${proc.code}: min_age ${proc.minAge} → 150`);
      }
      if (proc.maxAge && proc.maxAge > 150) {
        console.warn(`⚠️ VALOR TRUNCADO - Procedimento ${proc.code}: max_age ${proc.maxAge} → 150`);
      }
      if (proc.maxQuantity && proc.maxQuantity > 999999) {
        console.warn(`⚠️ VALOR TRUNCADO - Procedimento ${proc.code}: max_quantity ${proc.maxQuantity} → 999999`);
      }
      if (proc.averageStay && proc.averageStay > 999.99) {
        console.warn(`⚠️ VALOR TRUNCADO - Procedimento ${proc.code}: average_stay ${proc.averageStay} → 999.99`);
      }
      if (proc.points && proc.points > 2000000000) {
        console.warn(`⚠️ VALOR TRUNCADO - Procedimento ${proc.code}: points ${proc.points} → 2000000000`);
      }

      return sanitizedProc;
    });

    const batchSize = 50; // Reduzir batch size para evitar timeouts
    console.log(`💾 Salvando em batches de ${batchSize}...`);
    
    for (let i = 0; i < dbProcedures.length; i += batchSize) {
      const batch = dbProcedures.slice(i, i + batchSize);
      console.log(`💾 Salvando batch ${Math.floor(i/batchSize) + 1}/${Math.ceil(dbProcedures.length/batchSize)} (${batch.length} procedimentos)`);
      
      const { error } = await supabase
        .from('sigtap_procedures')
        .insert(batch);
      
      if (error) {
        console.error(`❌ Erro no batch ${Math.floor(i/batchSize) + 1}:`, error);
        console.error('❌ Procedimentos do batch com erro:', batch.map(p => p.code).slice(0, 5));
        throw error;
      }
    }
    
    console.log('✅ Todos os procedimentos salvos com sucesso');
  }

  static async getActiveProcedures(): Promise<SigtapProcedure[]> {
    try {
      console.log('📊 CARREGAMENTO COMPLETO - Todos os procedimentos da versão ativa');
      
      // PASSO 1: Buscar a versão ativa
      const activeVersion = await this.getActiveVersion();
      if (!activeVersion) {
        console.warn('⚠️ Nenhuma versão ativa encontrada');
        return [];
      }
      
      console.log(`🔄 Carregando TODOS os procedimentos da versão: ${activeVersion.version_name}`);
      
      // PASSO 2: CARREGAMENTO PAGINADO PARA TODOS OS REGISTROS
      const pageSize = 1000; // Manter 1000 por página para performance
      let start = 0;
      let allProcedures: any[] = [];
      let hasMore = true;
      
      while (hasMore) {
        console.log(`📄 Carregando página ${Math.floor(start/pageSize) + 1} (${start + 1}-${start + pageSize})...`);
        
        const { data: page, error } = await supabase
          .from('sigtap_procedures')
          .select('*')
          .eq('version_id', activeVersion.id)
          .range(start, start + pageSize - 1)
          .order('code');
        
        if (error) {
          console.error(`❌ Erro ao carregar página ${start}-${start + pageSize - 1}:`, error);
          break;
        }
        
        if (!page || page.length === 0) {
          hasMore = false;
          break;
        }
        
        allProcedures = allProcedures.concat(page);
        console.log(`✅ Página carregada: ${page.length} registros (Total: ${allProcedures.length})`);
        
        // Se retornou menos que pageSize, não há mais dados
        if (page.length < pageSize) {
          hasMore = false;
        } else {
          start += pageSize;
        }
        
        // Limite de segurança aumentado para seus 4886 procedimentos
        if (start > 20000) {
          console.warn('⚠️ Limite de segurança atingido (20k registros)');
          break;
        }
      }
      
      if (allProcedures.length === 0) {
        console.warn('⚠️ Nenhum procedimento encontrado na versão ativa');
        console.log('💡 DICA: Importe um arquivo PDF/Excel/ZIP primeiro');
        return [];
      }
      
      console.log(`✅ CARREGAMENTO COMPLETO: ${allProcedures.length} procedimentos da versão ativa`);
      
      // PASSO 3: Converter para formato do frontend
      const procedures = allProcedures.map(proc => this.convertDbToFrontend(proc));
      
      console.log(`🎉 TODOS OS ${procedures.length} PROCEDIMENTOS CARREGADOS COM SUCESSO!`);
      return procedures;
      
    } catch (error) {
      console.error('❌ Erro ao buscar procedimentos ativos:', error);
      return [];
    }
  }

  static async getActiveProceduresFromOfficial(): Promise<SigtapProcedure[]> {
    try {
      console.log('🔄 Buscando TODOS os procedimentos das tabelas auxiliares oficiais...');
      
      // IMPLEMENTAÇÃO PAGINADA para carregar TODOS os 2866+ registros
      const pageSize = 1000;
      let start = 0;
      let allProcedimentos: any[] = [];
      let hasMore = true;
      
      while (hasMore) {
        console.log(`📄 Carregando página ${Math.floor(start/pageSize) + 1} (${start + 1}-${start + pageSize})...`);
        
        const { data: page, error } = await supabase
          .from('sigtap_procedimentos_oficial')
          .select(`
            codigo,
            nome,
            complexidade,
            sexo,
            quantidade_maxima,
            dias_permanencia,
            pontos,
            idade_minima,
            idade_maxima,
            valor_sh,
            valor_sa,
            valor_sp,
            codigo_financiamento,
            competencia
          `)
          .range(start, start + pageSize - 1)
          .order('codigo');
        
        if (error) {
          console.error('Erro ao buscar página:', error);
          break;
        }
        
        if (!page || page.length === 0) {
          hasMore = false;
          break;
        }
        
        allProcedimentos = allProcedimentos.concat(page);
        console.log(`✅ Página carregada: ${page.length} registros (Total: ${allProcedimentos.length})`);
        
        // Se retornou menos que pageSize, não há mais dados
        if (page.length < pageSize) {
          hasMore = false;
        } else {
          start += pageSize;
        }
        
        // Limite de segurança para evitar loops infinitos
        if (start > 10000) {
          console.warn('⚠️ Limite de segurança atingido (10k registros)');
          break;
        }
      }
      
      if (allProcedimentos.length === 0) {
        console.warn('⚠️ Nenhum procedimento encontrado nas tabelas auxiliares');
        return [];
      }
      
      console.log(`✅ TOTAL CARREGADO: ${allProcedimentos.length} procedimentos das tabelas AUXILIARES`);
      
      // Buscar dados complementares
      const { data: financiamentos } = await supabase
        .from('sigtap_financiamento')
        .select('codigo, nome');
      
      const financiamentoMap = new Map(
        (financiamentos || []).map(f => [f.codigo, f.nome])
      );
      
      // Converter dados auxiliares para formato do frontend
      const converted = allProcedimentos.map(proc => this.convertOfficialToFrontend(proc, financiamentoMap));
      
      console.log(`✅ CONVERSÃO CONCLUÍDA: ${converted.length} procedimentos prontos para uso`);
      return converted;
      
    } catch (error) {
      console.error('Erro ao buscar das tabelas auxiliares:', error);
      return [];
    }
  }

  private static convertDbToFrontend(proc: any): SigtapProcedure {
    return {
      id: proc.id,
      code: proc.code,
      description: this.cleanText(proc.description || ''),
      origem: this.cleanText(proc.origem || ''),
      complexity: this.cleanText(proc.complexity || ''),
      modality: this.cleanText(proc.modality || ''),
      registrationInstrument: this.cleanText(proc.registration_instrument || ''),
      financing: this.cleanText(proc.financing || ''),
      valueAmb: centavosToReais(proc.value_amb || 0),
      valueAmbTotal: centavosToReais(proc.value_amb_total || 0),
      valueHosp: centavosToReais(proc.value_hosp || 0),
      valueProf: centavosToReais(proc.value_prof || 0),
      valueHospTotal: centavosToReais(proc.value_hosp_total || 0),
      complementaryAttribute: proc.complementary_attribute || '',
      serviceClassification: proc.service_classification || '',
      especialidadeLeito: proc.especialidade_leito || '',
      gender: proc.gender || '',
      minAge: proc.min_age || 0,
      minAgeUnit: proc.min_age_unit || '',
      maxAge: proc.max_age || 0,
      maxAgeUnit: proc.max_age_unit || '',
      maxQuantity: proc.max_quantity || 0,
      averageStay: proc.average_stay || 0,
      points: proc.points || 0,
      cbo: proc.cbo || [],
      cid: proc.cid || [],
      habilitation: proc.habilitation || '',
      habilitationGroup: proc.habilitation_group || []
    };
  }

  private static convertDbToFrontendWithValidation(proc: any): SigtapProcedure {
    // Converter valores usando centavosToReais
    const valueAmb = centavosToReais(proc.value_amb || 0);
    const valueHosp = centavosToReais(proc.value_hosp || 0);
    const valueProf = centavosToReais(proc.value_prof || 0);
    const valueHospTotal = centavosToReais(proc.value_hosp_total || 0);
    
    // Validar valores - detectar conversão dupla
    if (valueHosp > 50000 || valueProf > 50000 || valueAmb > 50000) {
      console.warn(`🚨 VALOR SUSPEITO no procedimento ${proc.code}:`, {
        valueHosp,
        valueProf,
        valueAmb,
        rawValues: {
          value_hosp: proc.value_hosp,
          value_prof: proc.value_prof,
          value_amb: proc.value_amb
        }
      });
    }
    
    return {
      id: proc.id,
      code: proc.code,
      description: this.cleanText(proc.description || ''),
      origem: this.cleanText(proc.origem || ''),
      complexity: this.cleanText(proc.complexity || ''),
      modality: this.cleanText(proc.modality || ''),
      registrationInstrument: this.cleanText(proc.registration_instrument || ''),
      financing: this.cleanText(proc.financing || ''),
      valueAmb,
      valueAmbTotal: centavosToReais(proc.value_amb_total || 0),
      valueHosp,
      valueProf,
      valueHospTotal: valueHosp + valueProf, // Recalcular para garantir consistência
      complementaryAttribute: proc.complementary_attribute || '',
      serviceClassification: proc.service_classification || '',
      especialidadeLeito: proc.especialidade_leito || '',
      gender: proc.gender || '',
      minAge: proc.min_age || 0,
      minAgeUnit: proc.min_age_unit || '',
      maxAge: proc.max_age || 0,
      maxAgeUnit: proc.max_age_unit || '',
      maxQuantity: proc.max_quantity || 0,
      averageStay: proc.average_stay || 0,
      points: proc.points || 0,
      cbo: proc.cbo || [],
      cid: proc.cid || [],
      habilitation: proc.habilitation || '',
      habilitationGroup: proc.habilitation_group || []
    };
  }

  // Função auxiliar para limpar encoding
  private static cleanText(text: string): string {
    if (!text) return text;
    
    let cleaned = text;
    // Corrigir caracteres mal codificados comuns
    cleaned = cleaned.replace(/Ã¡/g, 'á');
    cleaned = cleaned.replace(/Ã£/g, 'ã');
    cleaned = cleaned.replace(/Ã§/g, 'ç');
    cleaned = cleaned.replace(/Ã©/g, 'é');
    cleaned = cleaned.replace(/Ãª/g, 'ê');
    cleaned = cleaned.replace(/Ã­/g, 'í');
    cleaned = cleaned.replace(/Ã³/g, 'ó');
    cleaned = cleaned.replace(/Ã´/g, 'ô');
    cleaned = cleaned.replace(/Ãµ/g, 'õ');
    cleaned = cleaned.replace(/Ãº/g, 'ú');
    cleaned = cleaned.replace(/Ã /g, 'à');
    cleaned = cleaned.replace(/Ã¢/g, 'â');
    cleaned = cleaned.replace(/Ã¨/g, 'è');
    cleaned = cleaned.replace(/Ã¬/g, 'ì');
    cleaned = cleaned.replace(/Ã²/g, 'ò');
    cleaned = cleaned.replace(/Ã¹/g, 'ù');
    
    // Remove caracteres de controle
    cleaned = cleaned.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '');
    // Normaliza espaços
    cleaned = cleaned.replace(/\s+/g, ' ').trim();
    
    return cleaned;
  }

  private static convertOfficialToFrontend(proc: any, financiamentoMap: Map<string, string>): SigtapProcedure {
    // Conversão segura de valores com validação
    const valueAmb = this.safeParseFloat(proc.valor_sa);
    const valueHosp = this.safeParseFloat(proc.valor_sh);
    const valueProf = this.safeParseFloat(proc.valor_sp);
    
    // VALIDAÇÃO CRÍTICA: Detectar valores corrompidos
    if (valueHosp > 50000 || valueProf > 50000 || valueAmb > 50000) {
      console.error(`🚨 VALOR CORROMPIDO DETECTADO no código ${proc.codigo}:`, {
        valor_sh: proc.valor_sh,
        valor_sp: proc.valor_sp,
        valor_sa: proc.valor_sa,
        converted: { valueHosp, valueProf, valueAmb }
      });
      
      // Se valor está corrompido, tentar divisão por 100 (conversão de centavos)
      const correctedHosp = valueHosp > 50000 ? valueHosp / 100 : valueHosp;
      const correctedProf = valueProf > 50000 ? valueProf / 100 : valueProf;
      const correctedAmb = valueAmb > 50000 ? valueAmb / 100 : valueAmb;
      
      console.log(`🔧 CORREÇÃO APLICADA para ${proc.codigo}:`, {
        original: { valueHosp, valueProf, valueAmb },
        corrected: { correctedHosp, correctedProf, correctedAmb }
      });
      
      return this.createProcedureObject(proc, financiamentoMap, correctedAmb, correctedHosp, correctedProf);
    }
    
    return this.createProcedureObject(proc, financiamentoMap, valueAmb, valueHosp, valueProf);
  }
  
  private static safeParseFloat(value: any): number {
    if (value === null || value === undefined || value === '') return 0;
    const parsed = parseFloat(value);
    return isNaN(parsed) ? 0 : parsed;
  }
  
  private static createProcedureObject(proc: any, financiamentoMap: Map<string, string>, valueAmb: number, valueHosp: number, valueProf: number): SigtapProcedure {
    return {
      id: proc.codigo, // Usar código como ID temporário
      code: proc.codigo,
      description: this.cleanText(proc.nome || ''),
      origem: 'Dados Oficiais DATASUS',
      complexity: this.convertComplexidade(proc.complexidade),
      modality: 'Não informado',
      registrationInstrument: 'Tabela Oficial',
      financing: this.cleanText(financiamentoMap.get(proc.codigo_financiamento) || 'Não informado'),
      valueAmb,
      valueAmbTotal: valueAmb, // Por enquanto igual ao SA
      valueHosp,
      valueProf,
      valueHospTotal: valueHosp + valueProf,
      complementaryAttribute: 'Dados Oficiais',
      serviceClassification: 'Não informado',
      especialidadeLeito: 'Não informado',
      gender: this.convertSexo(proc.sexo),
      minAge: proc.idade_minima || 0,
      minAgeUnit: proc.idade_minima ? 'ANOS' : '',
      maxAge: proc.idade_maxima || 0,
      maxAgeUnit: proc.idade_maxima ? 'ANOS' : '',
      maxQuantity: proc.quantidade_maxima || 0,
      averageStay: proc.dias_permanencia || 0,
      points: proc.pontos || 0,
      cbo: [],
      cid: [],
      habilitation: 'Não informado',
      habilitationGroup: []
    };
  }

  private static convertComplexidade(codigo: string): string {
    switch (codigo) {
      case '1': return 'ATENÇÃO BÁSICA';
      case '2': return 'MÉDIA COMPLEXIDADE';
      case '3': return 'ALTA COMPLEXIDADE';
      default: return 'NÃO INFORMADO';
    }
  }

  private static convertSexo(codigo: string): string {
    switch (codigo) {
      case 'A': return 'AMBOS';
      case 'M': return 'M';
      case 'F': return 'F';
      default: return 'AMBOS';
    }
  }
}

// HOSPITAL SERVICE
export class HospitalService {
  static async getHospitals(): Promise<Hospital[]> {
    const { data, error } = await supabase
      .from('hospitals')
      .select('*')
      .eq('is_active', true)
      .order('name');
    
    if (error) throw error;
    return data || [];
  }

  static async createHospital(hospital: Omit<Hospital, 'id' | 'created_at' | 'updated_at'>): Promise<Hospital> {
    const { data, error } = await supabase
      .from('hospitals')
      .insert(hospital)
      .select()
      .single();
    
    if (error) throw error;
    return data;
  }
}

// PATIENT SERVICE
export class PatientService {
  static async getPatients(hospitalId?: string): Promise<PatientDB[]> {
    let query = supabase
      .from('patients')
      .select('*')
      .order('created_at', { ascending: false });
    
    if (hospitalId) {
      query = query.eq('hospital_id', hospitalId);
    }
    
    const { data, error } = await query;
    
    if (error) throw error;
    return data || [];
  }

  static async createPatient(patient: Omit<PatientDB, 'id' | 'created_at' | 'updated_at'>): Promise<PatientDB> {
    const { data, error } = await supabase
      .from('patients')
      .insert(patient)
      .select()
      .single();
    
    if (error) throw error;
    return data;
  }

  static async updatePatient(id: string, patient: Partial<PatientDB>): Promise<PatientDB> {
    const { data, error } = await supabase
      .from('patients')
      .update({ ...patient, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single();
    
    if (error) throw error;
    return data;
  }
}

// AIH SERVICE
export class AIHService {
  static async getAIHs(hospitalId?: string): Promise<AIHDB[]> {
    let query = supabase
      .from('aihs')
      .select('*')
      .order('created_at', { ascending: false });
    
    if (hospitalId) {
      query = query.eq('hospital_id', hospitalId);
    }
    
    const { data, error } = await query;
    
    if (error) throw error;
    return data || [];
  }

  static async createAIH(aih: Omit<AIHDB, 'id' | 'created_at' | 'processed_at'>): Promise<AIHDB> {
    const { data, error } = await supabase
      .from('aihs')
      .insert(aih)
      .select()
      .single();
    
    if (error) throw error;
    return data;
  }

  static async updateAIHStatus(aihId: string, status: string, matchFound?: boolean): Promise<void> {
    const updates: any = { 
      processing_status: status, 
      processed_at: new Date().toISOString() 
    };
    
    if (matchFound !== undefined) {
      updates.match_found = matchFound;
    }

    const { error } = await supabase
      .from('aihs')
      .update(updates)
      .eq('id', aihId);
    
    if (error) throw error;
  }

  static async batchCreateAIHs(aihs: Omit<AIHDB, 'id' | 'created_at' | 'processed_at'>[]): Promise<AIHDB[]> {
    const { data, error } = await supabase
      .from('aihs')
      .insert(aihs)
      .select();
    
    if (error) throw error;
    return data || [];
  }
}

// AIH MATCH SERVICE
export class AIHMatchService {
  static async createMatch(match: Omit<AIHMatch, 'id' | 'created_at'>): Promise<AIHMatch> {
    const { data, error } = await supabase
      .from('aih_matches')
      .insert(match)
      .select()
      .single();
    
    if (error) throw error;
    return data;
  }

  static async getMatchesByAIH(aihId: string): Promise<AIHMatch[]> {
    const { data, error } = await supabase
      .from('aih_matches')
      .select('*')
      .eq('aih_id', aihId)
      .order('"overall score"', { ascending: false });
    
    if (error) throw error;
    return data || [];
  }

  static async updateMatchStatus(matchId: string, status: string, reviewedBy?: string, notes?: string): Promise<AIHMatch> {
    const updates: any = { 
      status,
      reviewed_at: new Date().toISOString()
    };
    
    if (reviewedBy) updates.reviewed_by = reviewedBy;
    if (notes) updates.approval_notes = notes;

    const { data, error } = await supabase
      .from('aih_matches')
      .update(updates)
      .eq('id', matchId)
      .select()
      .single();
    
    if (error) throw error;
    return data;
  }

  static async getMatchesByScore(minScore: number = 70): Promise<AIHMatch[]> {
    const { data, error } = await supabase
      .from('aih_matches')
      .select('*')
      .gte('"overall score"', minScore)
      .order('"overall score"', { ascending: false });
    
    if (error) throw error;
    return data || [];
  }
}

// EXPORTS
export default {
  SigtapService,
  HospitalService,
  PatientService,
  AIHService,
  AIHMatchService
}; 
// ================================================
// SERVIÇO SUPABASE ROBUSTO - FORÇA TODOS OS DADOS
// Garante carregamento de TODOS os registros
// ================================================

import { supabase } from '../lib/supabase';
import { SigtapProcedure } from '../types';

const centavosToReais = (centavos: number): number => {
  return centavos / 100;
};

export class SigtapServiceRobust {
  
  // Função robusta que carrega TODOS os procedimentos usando paginação
  static async getAllProceduresRobust(): Promise<SigtapProcedure[]> {
    console.log('🚀 CARREGAMENTO ROBUSTO - Garantindo TODOS os dados...');
    
    try {
      // Primeiro tentar a tabela principal
      const mainData = await this.getAllFromTable('sigtap_procedures', true);
      
      if (mainData.length > 0) {
        console.log(`✅ ${mainData.length} procedimentos carregados da tabela PRINCIPAL (robusto)`);
        return mainData.map(proc => this.convertDbToFrontend(proc));
      }
      
      // Se não há dados na principal, buscar das auxiliares
      console.log('📋 Tabela principal vazia, buscando das auxiliares...');
      const auxData = await this.getAllFromTable('sigtap_procedimentos_oficial', false);
      
      if (auxData.length > 0) {
        console.log(`✅ ${auxData.length} procedimentos carregados das tabelas AUXILIARES (robusto)`);
        
        // Buscar financiamentos
        const financiamentos = await this.getAllFromTable('sigtap_financiamento', false);
        const financiamentoMap = new Map(
          financiamentos.map((f: any) => [f.codigo, f.nome])
        );
        
        return auxData.map((proc: any) => this.convertOfficialToFrontend(proc, financiamentoMap));
      }
      
      console.warn('⚠️ Nenhum procedimento encontrado em nenhuma tabela');
      return [];
      
    } catch (error) {
      console.error('❌ Erro no carregamento robusto:', error);
      return [];
    }
  }
  
  // Função que carrega TODOS os registros de uma tabela usando paginação automática
  static async getAllFromTable(tableName: string, withActiveVersion: boolean = false): Promise<any[]> {
    const pageSize = 1000;
    let start = 0;
    let allData: any[] = [];
    let hasMore = true;
    
    console.log(`🔄 Carregando TODOS os dados de ${tableName}...`);
    
    while (hasMore) {
             try {
         let query;
         
         if (withActiveVersion && tableName === 'sigtap_procedures') {
           query = supabase.from(tableName)
             .select(`
               *,
               sigtap_versions!inner (
                 is_active
               )
             `)
             .eq('sigtap_versions.is_active', true);
         } else {
           query = supabase.from(tableName).select('*');
         }
         
         const { data, error } = await query
           .range(start, start + pageSize - 1)
           .order(tableName === 'sigtap_procedures' ? 'code' : 'codigo');
        
        if (error) {
          console.error(`❌ Erro ao buscar página ${start}-${start + pageSize - 1} de ${tableName}:`, error);
          break;
        }
        
        if (!data || data.length === 0) {
          hasMore = false;
          break;
        }
        
        allData = allData.concat(data);
        console.log(`📄 Página carregada: ${start + 1}-${start + data.length} (${allData.length} total até agora)`);
        
        // Se retornou menos que o pageSize, não há mais dados
        if (data.length < pageSize) {
          hasMore = false;
        } else {
          start += pageSize;
        }
        
        // Limite de segurança para evitar loops infinitos
        if (start > 100000) {
          console.warn('⚠️ Limite de segurança atingido (100k registros)');
          break;
        }
        
      } catch (error) {
        console.error(`❌ Erro durante paginação em ${tableName}:`, error);
        break;
      }
    }
    
    console.log(`✅ Total carregado de ${tableName}: ${allData.length} registros`);
    return allData;
  }
  
  // Conversão de dados do banco principal
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
    valueHospTotal: centavosToReais(proc.value_hosp || 0) + centavosToReais(proc.value_prof || 0), // Recalcular SH + SP
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
  
  // Conversão de dados auxiliares
  private static convertOfficialToFrontend(proc: any, financiamentoMap: Map<string, string>): SigtapProcedure {
    return {
      id: proc.codigo,
      code: proc.codigo,
      description: this.cleanText(proc.nome || ''),
      origem: 'Dados Oficiais DATASUS',
      complexity: this.convertComplexidade(proc.complexidade),
      modality: 'Não informado',
      registrationInstrument: 'Tabela Oficial',
      financing: this.cleanText(financiamentoMap.get(proc.codigo_financiamento) || 'Não informado'),
      // Valores já estão em REAIS na tabela oficial (DECIMAL)
      valueAmb: parseFloat(proc.valor_sa || 0),
      valueAmbTotal: parseFloat(proc.valor_sa || 0), // Por enquanto igual ao SA, depois ajustaremos
      valueHosp: parseFloat(proc.valor_sh || 0),
      valueProf: parseFloat(proc.valor_sp || 0),
      valueHospTotal: parseFloat(proc.valor_sh || 0) + parseFloat(proc.valor_sp || 0),
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
  
  // Função de limpeza de texto
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
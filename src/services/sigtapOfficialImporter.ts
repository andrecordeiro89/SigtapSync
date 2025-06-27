/**
 * SIGTAP Official Importer
 * Importa dados estruturados oficiais do ZIP DATASUS
 */

import { supabase } from '../lib/supabase';
import JSZip from 'jszip';

interface FinanciamentoData {
  codigo: string;
  nome: string;
  competencia: string;
}

interface ModalidadeData {
  codigo: string;
  nome: string;
  competencia: string;
}

interface ProcedimentoOficial {
  codigo: string;
  nome: string;
  complexidade: string;
  sexo?: string;
  quantidade_maxima?: number;
  dias_permanencia?: number;
  pontos?: number;
  idade_minima?: number;
  idade_maxima?: number;
  valor_sh?: number;
  valor_sa?: number;
  valor_sp?: number;
  codigo_financiamento?: string;
  competencia: string;
}

export class SigtapOfficialImporter {
  private stats = {
    financiamentos: 0,
    modalidades: 0,
    procedimentos: 0,
    relacionamentos: 0,
    errors: 0,
    totalLines: 0
  };

  private async checkRequiredTables(): Promise<{exists: boolean, missingTables: string[]}> {
    const requiredTables = [
      'sigtap_financiamento',
      'sigtap_modalidade', 
      'sigtap_procedimentos_oficial'
    ];
    
    const missingTables: string[] = [];
    
    for (const table of requiredTables) {
      try {
        const { error } = await supabase
          .from(table)
          .select('*')
          .limit(1);
          
        if (error && error.code === '42P01') { // Tabela não existe
          missingTables.push(table);
        }
      } catch (err) {
        missingTables.push(table);
      }
    }
    
    return {
      exists: missingTables.length === 0,
      missingTables
    };
  }

  async importFromZip(
    zipFile: File, 
    versionId: string,
    progressCallback?: (progress: number, message: string) => void
  ): Promise<{ success: boolean; stats: typeof this.stats; errors: string[] }> {
    
    const errors: string[] = [];
    
    try {
      progressCallback?.(0, 'Verificando estrutura do banco...');
      
      // Verificar se as tabelas auxiliares existem
      const tableCheck = await this.checkRequiredTables();
      if (!tableCheck.exists) {
        throw new Error(
          `Tabelas auxiliares não encontradas: ${tableCheck.missingTables.join(', ')}. ` +
          'Execute primeiro: database/sigtap_official_schema.sql no seu Supabase'
        );
      }
      
      progressCallback?.(5, 'Carregando arquivo ZIP...');
      
      // Carregar ZIP
      const zip = await JSZip.loadAsync(zipFile);
      
      progressCallback?.(15, 'Extraindo financiamentos...');
      const financiamentos = await this.extractFinanciamentos(zip);
      
      progressCallback?.(25, 'Extraindo modalidades...');
      const modalidades = await this.extractModalidades(zip);
      
      progressCallback?.(35, 'Extraindo procedimentos...');
      const procedimentos = await this.extractProcedimentos(zip);
      
      progressCallback?.(55, 'Importando para o banco...');
      
      // Importar dados
      if (financiamentos.length > 0) {
        await supabase.from('sigtap_financiamento').upsert(financiamentos);
      }
      
      if (modalidades.length > 0) {
        await supabase.from('sigtap_modalidade').upsert(modalidades);
      }
      
      progressCallback?.(75, 'Importando procedimentos...');
      
      if (procedimentos.length > 0) {
        // Importar em lotes
        const batchSize = 500;
        for (let i = 0; i < procedimentos.length; i += batchSize) {
          const batch = procedimentos.slice(i, i + batchSize);
          await supabase.from('sigtap_procedimentos_oficial').upsert(batch);
          
          const progress = 75 + (i / procedimentos.length) * 15;
          progressCallback?.(progress, `Importando procedimentos ${i + 1}-${Math.min(i + batchSize, procedimentos.length)} de ${procedimentos.length}...`);
        }
      }
      
      progressCallback?.(95, 'Sincronizando com tabela principal...');
      await this.syncWithMainTable(versionId);
      
      progressCallback?.(100, 'Importação concluída!');
      
      return {
        success: true,
        stats: this.stats,
        errors
      };
      
    } catch (error) {
      console.error('Erro na importação:', error);
      errors.push(`Erro geral: ${error.message}`);
      
      return {
        success: false,
        stats: this.stats,
        errors
      };
    }
  }

  private async extractFinanciamentos(zip: JSZip): Promise<FinanciamentoData[]> {
    const file = zip.file('tb_financiamento.txt');
    if (!file) return [];
    
    const content = await file.async('text');
    const lines = content.split('\n').filter(line => line.trim());
    
    return lines.map(line => {
      const codigo = line.substring(0, 2).trim();
      const nome = line.substring(2, 102).trim();
      const competencia = line.substring(102, 108).trim();
      
      this.stats.financiamentos++;
      
      return { codigo, nome, competencia };
    });
  }

  private async extractModalidades(zip: JSZip): Promise<ModalidadeData[]> {
    const file = zip.file('tb_modalidade.txt');
    if (!file) return [];
    
    const content = await file.async('text');
    const lines = content.split('\n').filter(line => line.trim());
    
    return lines.map(line => {
      const codigo = line.substring(0, 2).trim();
      const nome = line.substring(2, 102).trim();
      const competencia = line.substring(102, 108).trim();
      
      this.stats.modalidades++;
      
      return { codigo, nome, competencia };
    });
  }

  private async extractProcedimentos(zip: JSZip): Promise<ProcedimentoOficial[]> {
    const file = zip.file('tb_procedimento.txt');
    if (!file) return [];
    
    const content = await file.async('text');
    const lines = content.split('\n').filter(line => line.trim());
    
    this.stats.totalLines = lines.length;
    
    return lines.map((line, index) => {
      try {
        // Layout oficial
        const codigo = line.substring(0, 10).trim();
        const nome = line.substring(10, 260).trim();
        const complexidade = line.substring(260, 261).trim();
        const sexo = line.substring(261, 262).trim();
        const quantidade_maxima = parseInt(line.substring(262, 266).trim()) || undefined;
        const dias_permanencia = parseInt(line.substring(266, 270).trim()) || undefined;
        const pontos = parseInt(line.substring(270, 274).trim()) || undefined;
        const idade_minima = parseInt(line.substring(274, 278).trim()) || undefined;
        const idade_maxima = parseInt(line.substring(278, 282).trim()) || undefined;
        const valor_sh = parseFloat(line.substring(282, 292).trim()) / 100 || undefined;
        const valor_sa = parseFloat(line.substring(292, 302).trim()) / 100 || undefined;
        const valor_sp = parseFloat(line.substring(302, 312).trim()) / 100 || undefined;
        const codigo_financiamento = line.substring(312, 314).trim() || undefined;
        const competencia = '202504'; // Competência atual
        
        this.stats.procedimentos++;
        
        return {
          codigo,
          nome,
          complexidade,
          sexo: sexo || undefined,
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
        };
      } catch (error) {
        this.stats.errors++;
        console.error(`Erro linha ${index + 1}:`, error);
        return null;
      }
    }).filter(Boolean) as ProcedimentoOficial[];
  }

  private async syncWithMainTable(versionId: string): Promise<void> {
    try {
      // Verificar se a função existe
      const { error: checkError } = await supabase
        .rpc('get_import_statistics');
      
      if (checkError && checkError.code === '42883') {
        throw new Error(
          'Função de sincronização não encontrada. Execute primeiro: database/sync_functions.sql no seu Supabase'
        );
      }
      
      // Usar a função SQL para sincronizar
      const { data, error } = await supabase
        .rpc('sync_official_to_main_table', {
          p_version_id: versionId
        });
      
      if (error) {
        console.error('Erro na sincronização:', error);
        throw new Error(`Erro na sincronização: ${error.message}`);
      }
      
      if (data && data.length > 0) {
        const result = data[0];
        console.log(`Sincronização concluída: ${result.total_imported} procedimentos importados com ${result.success_rate}% de sucesso`);
        
        if (result.total_imported === 0) {
          throw new Error('Sincronização não importou nenhum procedimento. Verifique se os dados foram salvos nas tabelas auxiliares.');
        }
      }
    } catch (error) {
      console.error('Erro na sincronização:', error);
      throw error;
    }
  }

  getStats() {
    return this.stats;
  }
} 
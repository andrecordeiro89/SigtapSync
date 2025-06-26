import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Progress } from './ui/progress';
import { Alert, AlertDescription } from './ui/alert';
import { Textarea } from './ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import { 
  Upload, 
  FileSpreadsheet, 
  Code, 
  Download, 
  Eye, 
  CheckCircle, 
  AlertTriangle,
  Copy,
  Play
} from 'lucide-react';
import { useToast } from '../hooks/use-toast';

interface ExcelAnalysisResult {
  success: boolean;
  fileName: string;
  sheets: Array<{
    name: string;
    totalRows: number;
    totalColumns: number;
    mergedCells: Array<{ range: string; value: string }>;
    headers: Array<{ column: string; value: string; position: number }>;
    sampleData: Array<Array<string>>;
    detectedPatterns: {
      procedureCodes: Array<{ value: string; position: string }>;
      values: Array<{ value: number; column: string; format: string }>;
      descriptions: Array<{ value: string; column: string }>;
    };
  }>;
  recommendations: {
    bestSheet: string;
    columnMapping: { [key: string]: string };
    processingStrategy: string;
    pythonCode: string;
  };
}

const ExcelAnalyzer = () => {
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisProgress, setAnalysisProgress] = useState(0);
  const [analysisResult, setAnalysisResult] = useState<ExcelAnalysisResult | null>(null);
  const [generatedCode, setGeneratedCode] = useState('');
  const [currentFile, setCurrentFile] = useState<File | null>(null);
  const { toast } = useToast();

  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Validar tipo de arquivo
    const fileName = file.name.toLowerCase();
    const isExcel = fileName.endsWith('.xlsx') || fileName.endsWith('.xls') || fileName.endsWith('.xlsm');
    
    if (!isExcel) {
      toast({
        title: "Arquivo inválido",
        description: "Por favor, selecione um arquivo Excel (.xlsx/.xls/.xlsm) para análise.",
        variant: "destructive"
      });
      return;
    }

    // Validar tamanho (limite de 50MB para análise)
    const maxSize = 50 * 1024 * 1024;
    if (file.size > maxSize) {
      toast({
        title: "Arquivo muito grande",
        description: "Para análise, o arquivo deve ter no máximo 50MB.",
        variant: "destructive"
      });
      return;
    }

    setCurrentFile(file);
    await analyzeExcelStructure(file);
  };

  const analyzeExcelStructure = async (file: File) => {
    setIsAnalyzing(true);
    setAnalysisProgress(0);
    
    try {
      console.log('🔍 Iniciando análise de estrutura Excel:', file.name);
      
      // Simular análise com progresso
      setAnalysisProgress(10);
      
      // Ler arquivo Excel
      const arrayBuffer = await file.arrayBuffer();
      setAnalysisProgress(30);
      
      // Analisar cada aba
      const analysisResult = await performExcelAnalysis(file, arrayBuffer);
      setAnalysisProgress(70);
      
      // Gerar código Python customizado
      const pythonCode = generateCustomPythonCode(analysisResult);
      setGeneratedCode(pythonCode);
      setAnalysisProgress(90);
      
      // Finalizar
      setAnalysisResult({
        ...analysisResult,
        recommendations: {
          ...analysisResult.recommendations,
          pythonCode
        }
      });
      
      setAnalysisProgress(100);
      
      toast({
        title: "🎉 Análise concluída!",
        description: `Estrutura analisada e código Python customizado gerado para ${file.name}.`
      });

    } catch (error) {
      console.error('❌ Erro na análise:', error);
      toast({
        title: "Erro na análise",
        description: "Não foi possível analisar a estrutura do Excel. Verifique o arquivo.",
        variant: "destructive"
      });
    } finally {
      setIsAnalyzing(false);
    }
  };

  const performExcelAnalysis = async (file: File, arrayBuffer: ArrayBuffer): Promise<ExcelAnalysisResult> => {
    // Importar XLSX dinamicamente
    const XLSX = await import('xlsx');
    
    const workbook = XLSX.read(arrayBuffer, { 
      type: 'array',
      cellStyles: true,
      cellNF: true,
      cellDates: true
    });

    const sheets = [];
    
    for (const sheetName of workbook.SheetNames) {
      console.log(`📋 Analisando aba: ${sheetName}`);
      
      const worksheet = workbook.Sheets[sheetName];
      const range = XLSX.utils.decode_range(worksheet['!ref'] || 'A1:A1');
      
      // Extrair dados da aba
      const sheetData = XLSX.utils.sheet_to_json(worksheet, { 
        header: 1,
        raw: false,
        defval: ''
      }) as string[][];
      
      // Analisar células mescladas
      const mergedCells = worksheet['!merges']?.map(merge => {
        const mergeRange = XLSX.utils.encode_range(merge);
        const cellRef = XLSX.utils.encode_cell({ r: merge.s.r, c: merge.s.c });
        const cellValue = worksheet[cellRef]?.v || '';
        return {
          range: mergeRange,
          value: String(cellValue)
        };
      }) || [];
      
      // Detectar padrões
      const detectedPatterns = detectDataPatterns(sheetData);
      
      // Extrair headers
      const headers = extractPotentialHeaders(sheetData);
      
      sheets.push({
        name: sheetName,
        totalRows: range.e.r + 1,
        totalColumns: range.e.c + 1,
        mergedCells,
        headers,
        sampleData: sheetData.slice(0, 10), // Primeiras 10 linhas como amostra
        detectedPatterns
      });
    }
    
    // Analisar e recomendar melhor estratégia
    const recommendations = generateRecommendations(sheets);
    
    return {
      success: true,
      fileName: file.name,
      sheets,
      recommendations
    };
  };

  const detectDataPatterns = (data: string[][]) => {
    const procedureCodes: Array<{ value: string; position: string }> = [];
    const values: Array<{ value: number; column: string; format: string }> = [];
    const descriptions: Array<{ value: string; column: string }> = [];
    
    // Padrão para códigos SIGTAP: XX.XX.XX.XXX-X
    const codePattern = /\d{2}\.\d{2}\.\d{2}\.\d{3}-\d/;
    
    // Padrão para valores monetários
    const valuePattern = /^\d+[,.]?\d*$/;
    
    data.forEach((row, rowIndex) => {
      row.forEach((cell, colIndex) => {
        const cellValue = String(cell || '').trim();
        
        // Detectar códigos de procedimento
        if (codePattern.test(cellValue)) {
          procedureCodes.push({
            value: cellValue,
            position: `${String.fromCharCode(65 + colIndex)}${rowIndex + 1}`
          });
        }
        
        // Detectar valores numéricos
        if (valuePattern.test(cellValue) && parseFloat(cellValue.replace(',', '.')) > 0) {
          values.push({
            value: parseFloat(cellValue.replace(',', '.')),
            column: String.fromCharCode(65 + colIndex),
            format: cellValue.includes(',') ? 'BR' : 'US'
          });
        }
        
        // Detectar descrições (textos longos)
        if (cellValue.length > 10 && !codePattern.test(cellValue) && !valuePattern.test(cellValue)) {
          descriptions.push({
            value: cellValue,
            column: String.fromCharCode(65 + colIndex)
          });
        }
      });
    });
    
    return { procedureCodes, values, descriptions };
  };

  const extractPotentialHeaders = (data: string[][]) => {
    const headers: Array<{ column: string; value: string; position: number }> = [];
    
    // Analisar primeiras 5 linhas para encontrar headers
    for (let rowIndex = 0; rowIndex < Math.min(5, data.length); rowIndex++) {
      const row = data[rowIndex];
      row.forEach((cell, colIndex) => {
        const cellValue = String(cell || '').trim().toLowerCase();
        
        // Palavras-chave que indicam headers importantes
        const keywords = [
          'codigo', 'código', 'procedimento', 'proc',
          'descricao', 'descrição', 'nome', 'desc',
          'valor', 'value', 'ambulatorial', 'hospitalar', 'profissional',
          'complexidade', 'modalidade', 'financiamento',
          'cid', 'cbo', 'habilitacao', 'habilitação'
        ];
        
        if (keywords.some(keyword => cellValue.includes(keyword))) {
          headers.push({
            column: String.fromCharCode(65 + colIndex),
            value: String(cell || '').trim(),
            position: rowIndex
          });
        }
      });
    }
    
    return headers;
  };

  const generateRecommendations = (sheets: any[]) => {
    // Encontrar melhor aba (mais códigos de procedimento)
    const bestSheet = sheets.reduce((best, current) => 
      current.detectedPatterns.procedureCodes.length > best.detectedPatterns.procedureCodes.length 
        ? current 
        : best
    );
    
    // Mapear colunas baseado nos padrões detectados
    const columnMapping: { [key: string]: string } = {};
    
    // Estratégia de processamento
    const processingStrategy = bestSheet.mergedCells.length > 10 
      ? 'Estrutura complexa com células mescladas - requer processamento especializado'
      : 'Estrutura simples - processamento padrão adequado';
    
    return {
      bestSheet: bestSheet.name,
      columnMapping,
      processingStrategy,
      pythonCode: '' // Será preenchido depois
    };
  };

     const generateCustomPythonCode = (analysis: ExcelAnalysisResult): string => {
     const bestSheet = analysis.sheets.find(s => s.name === analysis.recommendations.bestSheet);
     if (!bestSheet) return '';

     return `#!/usr/bin/env python3
 """
 🎯 CÓDIGO PYTHON CUSTOMIZADO PARA: ${analysis.fileName}
 Gerado automaticamente baseado na análise de estrutura
 
 ⚡ OTIMIZADO PARA ARQUIVOS GRANDES:
 - Processamento por chunks (lotes)
 - Baixo uso de memória
 - Progress tracking
 - Validação automática
 """
 
 import pandas as pd
 import numpy as np
 import json
 import re
 from pathlib import Path
 import time
 from datetime import datetime
 
 class CustomSigtapProcessor:
     def __init__(self, excel_path: str, chunk_size: int = 1000):
         self.excel_path = Path(excel_path)
         self.chunk_size = chunk_size
         self.procedures = []
         self.processed_count = 0
         self.start_time = None
     
     def process(self):
         """Processa o arquivo Excel com estrutura customizada detectada"""
         self.start_time = time.time()
         print(f"🚀 Processando: {self.excel_path}")
         print(f"⚡ Chunk size: {self.chunk_size} linhas por lote")
         
         # ESTRATÉGIA OTIMIZADA PARA ARQUIVOS GRANDES
         total_rows = self._get_total_rows()
         print(f"📊 Total estimado: {total_rows:,} linhas")
         
         # Processar por chunks para economizar memória
         self._process_in_chunks()
         
         elapsed = time.time() - self.start_time
         print(f"⏱️ Processamento concluído em {elapsed:.1f}s")
         print(f"✅ {len(self.procedures):,} procedimentos extraídos")
         
         return self.procedures
     
     def _get_total_rows(self):
         """Estima total de linhas sem carregar arquivo completo"""
         try:
             # Leitura rápida apenas para contar
             df_sample = pd.read_excel(
                 self.excel_path, 
                 sheet_name='${bestSheet.name}',
                 nrows=0  # Apenas headers
             )
             
             # Usar xlrd para contar linhas rapidamente
             import xlrd
             workbook = xlrd.open_workbook(str(self.excel_path))
             sheet = workbook.sheet_by_name('${bestSheet.name}')
             return sheet.nrows
         except:
             return "desconhecido"
     
     def _process_in_chunks(self):
         """Processa arquivo em lotes para otimizar memória"""
         chunk_num = 0
         
         try:
             # Carregar em chunks
             for chunk_df in pd.read_excel(
                 self.excel_path, 
                 sheet_name='${bestSheet.name}',
                 header=None,
                 dtype=str,
                 chunksize=self.chunk_size
             ):
                 chunk_num += 1
                 print(f"📦 Processando chunk {chunk_num} ({len(chunk_df)} linhas)...")
                 
                 # Processar chunk atual
                 chunk_procedures = self._process_chunk(chunk_df, chunk_num)
                 self.procedures.extend(chunk_procedures)
                 
                 self.processed_count += len(chunk_df)
                 
                 # Progress update
                 elapsed = time.time() - self.start_time
                 rate = self.processed_count / elapsed if elapsed > 0 else 0
                 print(f"⚡ Progresso: {self.processed_count:,} linhas | {rate:.0f} linhas/s | {len(self.procedures)} procedimentos")
                 
         except Exception as e:
             print(f"⚠️ Fallback: Carregando arquivo completo...")
             # Fallback para arquivo completo se chunking falhar
             df = pd.read_excel(
                 self.excel_path, 
                 sheet_name='${bestSheet.name}',
                 header=None,
                 dtype=str
             )
             chunk_procedures = self._process_chunk(df, 1)
             self.procedures.extend(chunk_procedures)
     
     def _process_chunk(self, df, chunk_num):
         """Processa um chunk específico"""
         chunk_procedures = []
         
         print(f"📊 Chunk {chunk_num}: {len(df)} linhas x {len(df.columns)} colunas")
         
         # PROCESSAMENTO CUSTOMIZADO BASEADO NA ANÁLISE:
         ${generateCustomProcessingCode(bestSheet)}
         
         return chunk_procedures
    
    ${generateHelperMethods(bestSheet)}

 # EXECUTAR PROCESSAMENTO
 if __name__ == "__main__":
     print("🚀 SIGTAP PROCESSOR - OTIMIZADO PARA ARQUIVOS GRANDES")
     print("=" * 60)
     
     # Configurações otimizadas baseadas no tamanho do arquivo
     file_path = "${analysis.fileName}"
     
     # Ajustar chunk_size baseado no tamanho estimado
     try:
         file_size_mb = Path(file_path).stat().st_size / (1024 * 1024)
         if file_size_mb > 100:  # Arquivo > 100MB
             chunk_size = 500   # Chunks menores
         elif file_size_mb > 50:  # Arquivo > 50MB
             chunk_size = 1000  # Chunks médios
         else:
             chunk_size = 2000  # Chunks maiores
         
         print(f"📁 Arquivo: {file_size_mb:.1f}MB")
         print(f"⚡ Chunk size otimizado: {chunk_size}")
     except:
         chunk_size = 1000  # Default
     
     # Processar com configuração otimizada
     processor = CustomSigtapProcessor(file_path, chunk_size=chunk_size)
     procedures = processor.process()
     
     # Validações finais
     valid_procedures = [p for p in procedures if p.get('code') and p.get('description')]
     
     print("=" * 60)
     print(f"📊 RESULTADOS FINAIS:")
     print(f"  • Total extraído: {len(procedures):,}")
     print(f"  • Válidos: {len(valid_procedures):,}")
     print(f"  • Taxa de sucesso: {(len(valid_procedures)/len(procedures)*100):.1f}%" if procedures else "0%")
     
     # Salvar resultado otimizado
     output_data = {
         'metadata': {
             'source': '${analysis.fileName}',
             'sheet': '${bestSheet.name}',
             'total_procedures': len(valid_procedures),
             'processing_method': 'custom_analysis_optimized',
             'processing_time': time.time() - processor.start_time if processor.start_time else 0,
             'chunk_size': chunk_size,
             'generated_at': datetime.now().isoformat()
         },
         'procedures': valid_procedures
     }
     
     with open('sigtap_customizado.json', 'w', encoding='utf-8') as f:
         json.dump(output_data, f, ensure_ascii=False, indent=2)
     
     print(f"✅ {len(valid_procedures):,} procedimentos válidos salvos em 'sigtap_customizado.json'")
     print(f"📁 Arquivo pronto para importação no sistema SIGTAP!")
     print("=" * 60)`;
  };

  const generateCustomProcessingCode = (sheet: any): string => {
    return `
        # ESTRATÉGIA DETECTADA: ${sheet.mergedCells.length > 0 ? 'Células mescladas encontradas' : 'Estrutura tabular padrão'}
        
        # Células mescladas detectadas: ${sheet.mergedCells.length}
        ${sheet.mergedCells.length > 0 ? `
        # Células mescladas encontradas: ${sheet.mergedCells.slice(0, 3).map((m: any) => `${m.range}: "${m.value}"`).join(', ')}
        
        # Estratégia: Processar considerando estrutura hierárquica
        self._process_merged_structure(df)
        ` : `
        # Estrutura tabular padrão detectada
        self._process_standard_table(df)
        `}
        
        # Códigos de procedimento detectados: ${sheet.detectedPatterns.procedureCodes.length}
        # Posições: ${sheet.detectedPatterns.procedureCodes.slice(0, 3).map((p: any) => p.position).join(', ')}
        
        # Headers potenciais detectados:
        ${sheet.headers.map((h: any) => `        # Coluna ${h.column} (linha ${h.position}): "${h.value}"`).join('\n')}`;
  };

     const generateHelperMethods = (sheet: any): string => {
     return `
     def _process_merged_structure(self, df):
         """Processa estrutura com células mescladas (OTIMIZADO)"""
         current_section = None
         chunk_procedures = []
         
         # Processar em lotes menores para economizar memória
         batch_size = 100
         for start_idx in range(0, len(df), batch_size):
             end_idx = min(start_idx + batch_size, len(df))
             batch = df.iloc[start_idx:end_idx]
             
             for index, row in batch.iterrows():
                 # Detectar seções baseadas em células mescladas
                 if self._is_section_header(row):
                     current_section = self._extract_section_name(row)
                     continue
                 
                 # Processar linha de dados
                 procedure = self._extract_procedure_from_row(row, current_section)
                 if procedure:
                     chunk_procedures.append(procedure)
             
             # Progress para lotes grandes
             if len(df) > 1000:
                 progress = (end_idx / len(df)) * 100
                 print(f"  📈 Progresso chunk: {progress:.1f}% ({end_idx}/{len(df)} linhas)")
         
         return chunk_procedures
     
     def _process_standard_table(self, df):
         """Processa estrutura tabular padrão (OTIMIZADO)"""
         chunk_procedures = []
         
         # Detectar linha de cabeçalho
         header_row = self._find_header_row(df)
         print(f"  🎯 Header detectado na linha: {header_row}")
         
         # Processar dados em lotes
         data_rows = df.iloc[header_row + 1:]
         batch_size = 100
         
         for start_idx in range(0, len(data_rows), batch_size):
             end_idx = min(start_idx + batch_size, len(data_rows))
             batch = data_rows.iloc[start_idx:end_idx]
             
             for index, row in batch.iterrows():
                 procedure = self._extract_procedure_from_row(row)
                 if procedure:
                     chunk_procedures.append(procedure)
             
             # Progress para arquivos grandes
             if len(data_rows) > 1000:
                 progress = (end_idx / len(data_rows)) * 100
                 print(f"  📈 Progresso chunk: {progress:.1f}% ({end_idx}/{len(data_rows)} linhas de dados)")
         
         return chunk_procedures
    
    def _extract_procedure_from_row(self, row, section=None):
        """Extrai procedimento de uma linha"""
        # Buscar código do procedimento
        code = None
        description = None
        values = {}
        
        for col_idx, cell in enumerate(row):
            cell_str = str(cell).strip()
            
            # Código SIGTAP: XX.XX.XX.XXX-X
            if re.match(r'\\d{2}\\.\\d{2}\\.\\d{2}\\.\\d{3}-\\d', cell_str):
                code = cell_str
            
            # Descrição (texto longo sem números)
            elif len(cell_str) > 10 and not re.search(r'[0-9.,]', cell_str):
                description = cell_str
            
            # Valores (números com vírgula ou ponto)
            elif re.match(r'^\\d+[,.]?\\d*$', cell_str):
                values[f'value_{col_idx}'] = float(cell_str.replace(',', '.'))
        
        if code and description:
            return {
                'code': code,
                'description': description,
                'section': section,
                **values
            }
        
        return None
    
    def _is_section_header(self, row):
        """Detecta se a linha é cabeçalho de seção"""
        # Verifica se há texto em poucas colunas (indicativo de merge)
        filled_cells = sum(1 for cell in row if str(cell).strip())
        return filled_cells <= 2 and any(len(str(cell).strip()) > 5 for cell in row)
    
    def _find_header_row(self, df):
        """Encontra linha de cabeçalho"""
        keywords = ['codigo', 'procedimento', 'descricao', 'valor']
        
        for idx, row in df.iterrows():
            row_text = ' '.join(str(cell).lower() for cell in row)
            if any(keyword in row_text for keyword in keywords):
                return idx
        
        return 0  # Fallback para primeira linha`;
  };

  const copyCodeToClipboard = () => {
    navigator.clipboard.writeText(generatedCode);
    toast({
      title: "Código copiado!",
      description: "O código Python foi copiado para a área de transferência."
    });
  };

  const downloadCode = () => {
    const blob = new Blob([generatedCode], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `sigtap_processor_${currentFile?.name?.replace(/\.[^/.]+$/, '')}.py`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-900">🔍 Analisador de Excel SIGTAP</h2>
        <p className="text-gray-600 mt-1">
          Analise a estrutura do seu Excel desestruturado e gere código Python customizado para processamento
        </p>
      </div>

      {/* Upload */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Upload className="w-5 h-5 text-blue-600" />
            <span>Upload para Análise</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center hover:border-blue-400 transition-colors">
            <div className="flex justify-center space-x-3 mb-4">
              <FileSpreadsheet className="w-12 h-12 text-green-500" />
              <Eye className="w-12 h-12 text-blue-500" />
              <Code className="w-12 h-12 text-purple-500" />
            </div>
            
            <div className="space-y-2">
              <p className="text-lg font-medium text-gray-700">
                Selecione seu Excel SIGTAP desestruturado
              </p>
              <p className="text-sm text-gray-500">
                Sistema vai analisar células mescladas, colunas e gerar código Python customizado
              </p>
              <p className="text-xs text-gray-400">
                Máximo: 50MB • Formatos: .xlsx, .xls, .xlsm
              </p>
            </div>

            <input
              type="file"
              id="excel-analyzer"
              accept=".xlsx,.xls,.xlsm"
              onChange={handleFileSelect}
              disabled={isAnalyzing}
              className="hidden"
            />
            
            <label
              htmlFor="excel-analyzer"
              className={`inline-flex items-center px-4 py-2 mt-4 text-sm font-medium rounded-lg cursor-pointer transition-colors ${
                isAnalyzing
                  ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                  : 'bg-blue-600 text-white hover:bg-blue-700'
              }`}
            >
              <Upload className="w-4 h-4 mr-2" />
              {isAnalyzing ? 'Analisando...' : 'Selecionar Excel'}
            </label>
          </div>

          {isAnalyzing && (
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span>Analisando estrutura...</span>
                <span>{analysisProgress}%</span>
              </div>
              <Progress value={analysisProgress} className="w-full" />
            </div>
          )}
        </CardContent>
      </Card>

      {/* Resultados */}
      {analysisResult && (
        <Tabs defaultValue="analysis" className="space-y-4">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="analysis">📊 Análise</TabsTrigger>
            <TabsTrigger value="code">🐍 Código Python</TabsTrigger>
            <TabsTrigger value="instructions">📋 Instruções</TabsTrigger>
          </TabsList>

          <TabsContent value="analysis" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>📋 Estrutura Detectada</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <Alert>
                  <CheckCircle className="h-4 w-4" />
                  <AlertDescription>
                    <strong>Arquivo:</strong> {analysisResult.fileName}<br/>
                    <strong>Melhor aba:</strong> {analysisResult.recommendations.bestSheet}<br/>
                    <strong>Estratégia:</strong> {analysisResult.recommendations.processingStrategy}
                  </AlertDescription>
                </Alert>

                {analysisResult.sheets.map((sheet, index) => (
                  <Card key={index} className="bg-gray-50">
                    <CardContent className="p-4">
                      <h4 className="font-medium mb-2">📋 Aba: {sheet.name}</h4>
                      <div className="grid grid-cols-2 gap-4 text-sm">
                        <div>
                          <p><strong>Dimensões:</strong> {sheet.totalRows} x {sheet.totalColumns}</p>
                          <p><strong>Células mescladas:</strong> {sheet.mergedCells.length}</p>
                          <p><strong>Códigos SIGTAP:</strong> {sheet.detectedPatterns.procedureCodes.length}</p>
                        </div>
                        <div>
                          <p><strong>Valores detectados:</strong> {sheet.detectedPatterns.values.length}</p>
                          <p><strong>Descrições:</strong> {sheet.detectedPatterns.descriptions.length}</p>
                          <p><strong>Headers:</strong> {sheet.headers.length}</p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="code" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <Code className="w-5 h-5 text-purple-600" />
                    <span>Código Python Customizado</span>
                  </div>
                  <div className="flex space-x-2">
                    <Button size="sm" variant="outline" onClick={copyCodeToClipboard}>
                      <Copy className="w-4 h-4 mr-1" />
                      Copiar
                    </Button>
                    <Button size="sm" variant="outline" onClick={downloadCode}>
                      <Download className="w-4 h-4 mr-1" />
                      Download
                    </Button>
                  </div>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <Textarea
                  value={generatedCode}
                  readOnly
                  className="font-mono text-xs h-96 bg-gray-50"
                  placeholder="Código Python será gerado após análise..."
                />
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="instructions" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>📋 Como Usar o Código Gerado</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Opções de Execução */}
                <Alert>
                  <CheckCircle className="h-4 w-4" />
                  <AlertDescription>
                    <strong>3 Formas de Executar:</strong> Escolha a que preferir!
                  </AlertDescription>
                </Alert>
                
                <Tabs defaultValue="local" className="space-y-4">
                  <TabsList className="grid w-full grid-cols-3">
                    <TabsTrigger value="local">💻 Local</TabsTrigger>
                    <TabsTrigger value="colab">🌐 Google Colab</TabsTrigger>
                    <TabsTrigger value="vscode">🔧 VS Code</TabsTrigger>
                  </TabsList>
                  
                  <TabsContent value="local" className="space-y-3">
                    <h4 className="font-medium">💻 Execução Local (Requer Python)</h4>
                    <div className="space-y-3 text-sm">
                      <div className="flex items-start space-x-3">
                        <div className="w-6 h-6 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center text-xs font-medium">1</div>
                        <div>
                          <p className="font-medium">Instalar Python</p>
                          <p className="text-gray-600">Download: <code className="bg-gray-100 px-1 rounded">python.org</code> (Python 3.8+)</p>
                          <p className="text-xs text-amber-600">⚠️ Marque "Add to PATH" na instalação</p>
                        </div>
                      </div>
                      
                      <div className="flex items-start space-x-3">
                        <div className="w-6 h-6 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center text-xs font-medium">2</div>
                        <div>
                          <p className="font-medium">Instalar dependências</p>
                          <code className="bg-gray-100 px-2 py-1 rounded text-xs">pip install pandas openpyxl xlrd</code>
                        </div>
                      </div>
                      
                      <div className="flex items-start space-x-3">
                        <div className="w-6 h-6 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center text-xs font-medium">3</div>
                        <div>
                          <p className="font-medium">Executar código</p>
                          <code className="bg-gray-100 px-2 py-1 rounded text-xs">python processor_customizado.py</code>
                        </div>
                      </div>
                    </div>
                  </TabsContent>
                  
                  <TabsContent value="colab" className="space-y-3">
                    <h4 className="font-medium">🌐 Google Colab (100% Online - SEM INSTALAÇÃO)</h4>
                    <div className="space-y-3 text-sm">
                      <div className="flex items-start space-x-3">
                        <div className="w-6 h-6 bg-green-100 text-green-600 rounded-full flex items-center justify-center text-xs font-medium">1</div>
                        <div>
                          <p className="font-medium">Acessar Google Colab</p>
                          <p className="text-gray-600">Vá para: <code className="bg-gray-100 px-1 rounded">colab.research.google.com</code></p>
                        </div>
                      </div>
                      
                      <div className="flex items-start space-x-3">
                        <div className="w-6 h-6 bg-green-100 text-green-600 rounded-full flex items-center justify-center text-xs font-medium">2</div>
                        <div>
                          <p className="font-medium">Criar novo notebook</p>
                          <p className="text-gray-600">Arquivo → Novo notebook</p>
                        </div>
                      </div>
                      
                      <div className="flex items-start space-x-3">
                        <div className="w-6 h-6 bg-green-100 text-green-600 rounded-full flex items-center justify-center text-xs font-medium">3</div>
                        <div>
                          <p className="font-medium">Upload do Excel</p>
                          <p className="text-gray-600">Clique no 📁 na lateral → Upload</p>
                        </div>
                      </div>
                      
                      <div className="flex items-start space-x-3">
                        <div className="w-6 h-6 bg-green-100 text-green-600 rounded-full flex items-center justify-center text-xs font-medium">4</div>
                        <div>
                          <p className="font-medium">Colar código Python</p>
                          <p className="text-gray-600">Cole o código gerado na célula</p>
                        </div>
                      </div>
                      
                      <div className="flex items-start space-x-3">
                        <div className="w-6 h-6 bg-green-100 text-green-600 rounded-full flex items-center justify-center text-xs font-medium">5</div>
                        <div>
                          <p className="font-medium">Executar</p>
                          <p className="text-gray-600">Shift + Enter → Download do JSON</p>
                        </div>
                      </div>
                      
                      <Alert className="bg-green-50">
                        <CheckCircle className="h-4 w-4" />
                        <AlertDescription>
                          <strong>✅ VANTAGEM:</strong> Não precisa instalar nada! Roda direto no navegador.
                        </AlertDescription>
                      </Alert>
                    </div>
                  </TabsContent>
                  
                  <TabsContent value="vscode" className="space-y-3">
                    <h4 className="font-medium">🔧 VS Code (Editor Profissional)</h4>
                    <div className="space-y-3 text-sm">
                      <div className="flex items-start space-x-3">
                        <div className="w-6 h-6 bg-purple-100 text-purple-600 rounded-full flex items-center justify-center text-xs font-medium">1</div>
                        <div>
                          <p className="font-medium">Instalar VS Code</p>
                          <p className="text-gray-600">Download: <code className="bg-gray-100 px-1 rounded">code.visualstudio.com</code></p>
                        </div>
                      </div>
                      
                      <div className="flex items-start space-x-3">
                        <div className="w-6 h-6 bg-purple-100 text-purple-600 rounded-full flex items-center justify-center text-xs font-medium">2</div>
                        <div>
                          <p className="font-medium">Extensão Python</p>
                          <p className="text-gray-600">Ctrl+Shift+X → Buscar "Python" → Instalar</p>
                        </div>
                      </div>
                      
                      <div className="flex items-start space-x-3">
                        <div className="w-6 h-6 bg-purple-100 text-purple-600 rounded-full flex items-center justify-center text-xs font-medium">3</div>
                        <div>
                          <p className="font-medium">Terminal integrado</p>
                          <p className="text-gray-600">Ctrl+` → <code className="bg-gray-100 px-1 rounded">pip install pandas openpyxl</code></p>
                        </div>
                      </div>
                      
                      <div className="flex items-start space-x-3">
                        <div className="w-6 h-6 bg-purple-100 text-purple-600 rounded-full flex items-center justify-center text-xs font-medium">4</div>
                        <div>
                          <p className="font-medium">Executar código</p>
                          <p className="text-gray-600">F5 ou clique ▶️ no VS Code</p>
                        </div>
                      </div>
                    </div>
                  </TabsContent>
                </Tabs>

                <Alert>
                  <AlertTriangle className="h-4 w-4" />
                  <AlertDescription>
                    <strong>Importante:</strong> O código é executado FORA do sistema web. 
                    Depois você volta aqui para importar o JSON resultante na aba "SIGTAP".
                  </AlertDescription>
                </Alert>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      )}
    </div>
  );
};

export default ExcelAnalyzer;

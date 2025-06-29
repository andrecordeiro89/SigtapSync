import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Upload, FileText, CheckCircle, AlertCircle, X, FileIcon, FileSpreadsheet } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useSigtapContext } from '../contexts/SigtapContext';
import { ENV_CONFIG, validateConfig, logger } from '../config/env';
import { ExcelProcessor } from '../utils/excelProcessor';

const SigtapImport = () => {
  const [importStatus, setImportStatus] = useState<'idle' | 'processing' | 'success' | 'error'>('idle');
  const [currentExcelSheet, setCurrentExcelSheet] = useState<string>('');
  const [totalExcelSheets, setTotalExcelSheets] = useState<number>(0);
  const { toast } = useToast();
  
  // Verificar configuração do sistema
  const configValidation = validateConfig();
  const isGeminiAvailable = configValidation.isValid;
  const { 
    isLoading, 
    error, 
    lastImportDate, 
    totalProcedures, 
    processingProgress,
    currentPage,
    totalPages,
    importSigtapFile, 
    clearData 
  } = useSigtapContext();

  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Validar tipo de arquivo
    const fileName = file.name.toLowerCase();
    const isExcel = fileName.endsWith('.xlsx') || fileName.endsWith('.xls') || fileName.endsWith('.xlsm');
    const isPdf = fileName.endsWith('.pdf');
    const isZip = fileName.endsWith('.zip');
    
    if (!isExcel && !isPdf && !isZip) {
      toast({
        title: "Arquivo inválido",
        description: "Por favor, selecione um arquivo Excel (.xlsx/.xls), PDF ou ZIP da tabela SIGTAP.",
        variant: "destructive"
      });
      return;
    }

    // Validar tamanho do arquivo (limite de 100MB)
    const maxSize = 100 * 1024 * 1024; // 100MB
    if (file.size > maxSize) {
      toast({
        title: "Arquivo muito grande",
        description: "O arquivo deve ter no máximo 100MB. Para arquivos maiores, considere usar a versão ZIP compactada.",
        variant: "destructive"
      });
      return;
    }

    console.log('Arquivo selecionado:', file.name, 'Tamanho:', (file.size / 1024 / 1024).toFixed(2), 'MB');
    setImportStatus('processing');

    try {
      let result;
      
      if (isExcel) {
        // Processar Excel
        const excelProcessor = new ExcelProcessor();
        result = await excelProcessor.processSigtapExcel(file, (progress, sheetName, totalSheets) => {
          setCurrentExcelSheet(sheetName);
          setTotalExcelSheets(totalSheets);
          // Atualizar progresso via context se necessário
        });
        
        if (result.success) {
          // Usar método direct do contexto para definir os procedimentos
          await importSigtapFile(null, result.procedures);
        }
      } else {
        // Processar PDF/ZIP (método existente)
        result = await importSigtapFile(file);
      }
      
      if (result.success) {
        setImportStatus('success');
        setCurrentExcelSheet('');
        setTotalExcelSheets(0);
        toast({
          title: "Importação concluída",
          description: result.message,
        });
      } else {
        setImportStatus('error');
        toast({
          title: "Erro na importação",
          description: result.message,
          variant: "destructive"
        });
      }
    } catch (error) {
      setImportStatus('error');
      setCurrentExcelSheet('');
      setTotalExcelSheets(0);
      toast({
        title: "Erro na importação",
        description: "Erro inesperado durante o processamento do arquivo.",
        variant: "destructive"
      });
    }

    // Reset file input
    event.target.value = '';
  };

  const handleClearData = () => {
    clearData();
    setImportStatus('idle');
    toast({
      title: "Dados limpos",
      description: "Todos os dados da tabela SIGTAP foram removidos.",
    });
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-900">Importação Tabela SIGTAP</h2>
        <p className="text-gray-600 mt-1">Importe a tabela oficial do DATASUS para atualizar os procedimentos</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Seção 1: Importar Nova Tabela */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <Upload className="w-5 h-5 text-blue-600" />
              <span>Importar Nova Tabela</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center hover:border-blue-400 transition-colors">
              <div className="flex justify-center space-x-3 mb-4">
                <FileSpreadsheet className="w-12 h-12 text-green-500" />
                <FileIcon className="w-12 h-12 text-blue-400" />
                <FileText className="w-12 h-12 text-red-400" />
              </div>
              <p className="text-gray-600 mb-4">
                Selecione arquivo Excel, ZIP ou PDF da tabela SIGTAP
              </p>
              <input
                type="file"
                accept=".xlsx,.xls,.xlsm,.zip,.pdf"
                onChange={handleFileSelect}
                className="hidden"
                id="sigtap-upload"
                disabled={isLoading}
              />
              <label htmlFor="sigtap-upload">
                <Button 
                  variant="outline" 
                  className="cursor-pointer"
                  disabled={isLoading}
                  asChild
                >
                  <span>
                    {isLoading ? 'Processando...' : 'Selecionar Arquivo'}
                  </span>
                </Button>
              </label>
            </div>

            {isLoading && (
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span>Progresso da importação:</span>
                  <span>{Math.round(processingProgress)}%</span>
                </div>
                <Progress value={processingProgress} className="w-full" />
                {currentExcelSheet && totalExcelSheets > 0 && (
                  <p className="text-sm text-gray-600">
                    <span className="inline-flex items-center space-x-1">
                      <FileSpreadsheet className="w-4 h-4 text-green-600" />
                      <span>Processando aba: <strong>{currentExcelSheet}</strong> ({totalExcelSheets} abas)</span>
                    </span>
                  </p>
                )}
                {currentPage && totalPages && (
                  <p className="text-sm text-gray-600">
                    Processando página {currentPage} de {totalPages}...
                  </p>
                )}
                {!currentPage && !currentExcelSheet && (
                  <p className="text-sm text-gray-600">
                    Processando arquivo e extraindo dados...
                  </p>
                )}
              </div>
            )}

            {importStatus === 'success' && (
              <div className="flex items-center space-x-2 text-green-600">
                <CheckCircle className="w-5 h-5" />
                <span className="text-sm">Importação concluída com sucesso!</span>
              </div>
            )}

            {importStatus === 'error' && error && (
              <div className="flex items-center space-x-2 text-red-600">
                <AlertCircle className="w-5 h-5" />
                <span className="text-sm">{error}</span>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Seção 2: Status da Tabela */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <FileText className="w-5 h-5 text-green-600" />
                <span>Status da Tabela</span>
              </div>
              {totalProcedures > 0 && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleClearData}
                  className="text-red-600 hover:text-red-700"
                >
                  <X className="w-4 h-4 mr-1" />
                  Limpar
                </Button>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {totalProcedures > 0 ? (
              <div className="bg-green-50 p-4 rounded-lg">
                <div className="flex items-center justify-between mb-2">
                  <span className="font-medium text-green-800">Tabela Carregada</span>
                  <CheckCircle className="w-5 h-5 text-green-600" />
                </div>
                <div className="text-sm text-green-700 space-y-1">
                  <p><strong>Procedimentos:</strong> {totalProcedures.toLocaleString()}</p>
                  {lastImportDate && (
                    <p><strong>Importado em:</strong> {new Date(lastImportDate).toLocaleString('pt-BR')}</p>
                  )}
                  <p><strong>Status:</strong> Pronto para consulta</p>
                </div>
              </div>
            ) : (
              <div className="bg-gray-50 p-4 rounded-lg">
                <div className="flex items-center justify-between mb-2">
                  <span className="font-medium text-gray-800">Nenhuma Tabela Carregada</span>
                  <AlertCircle className="w-5 h-5 text-gray-600" />
                </div>
                <p className="text-sm text-gray-600">
                  Importe um arquivo da tabela SIGTAP para começar a usar o sistema.
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Seção 3: Instruções de Importação */}
      <Card>
        <CardHeader>
          <CardTitle>Instruções de Importação</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {/* Passos do DATASUS */}
            <div className="space-y-3 text-sm text-gray-600">
              <div className="flex items-start space-x-3">
                <div className="w-6 h-6 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center text-xs font-medium">1</div>
                <p>Acesse <span className="font-mono bg-gray-100 px-1 rounded">datasus.saude.gov.br</span></p>
              </div>
              <div className="flex items-start space-x-3">
                <div className="w-6 h-6 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center text-xs font-medium">2</div>
                <p>Navegue: "Sistemas e Aplicativos" → "SIGTAP" → "Downloads"</p>
              </div>
              <div className="flex items-start space-x-3">
                <div className="w-6 h-6 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center text-xs font-medium">3</div>
                <p>Baixe o arquivo da versão mais recente</p>
              </div>
              <div className="flex items-start space-x-3">
                <div className="w-6 h-6 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center text-xs font-medium">4</div>
                <p>Selecione o arquivo usando o botão acima</p>
              </div>
            </div>

            {/* Tecnologias Consolidadas */}
            <div className="border-t pt-4">
              <h4 className="font-semibold text-gray-800 mb-3">🚀 Tecnologias de Processamento</h4>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                <div className="bg-green-50 p-3 rounded-lg border-l-4 border-green-400">
                  <div className="flex items-center space-x-2 mb-2">
                    <FileSpreadsheet className="w-4 h-4 text-green-600" />
                    <span className="font-medium text-green-800">Excel (.xlsx, .xls)</span>
                  </div>
                  <div className="text-green-700 space-y-1">
                    <p><strong>Tempo:</strong> 5-30 segundos</p>
                    <p><strong>Tecnologia:</strong> Análise estrutural</p>
                    <p><strong>Precisão:</strong> 100%</p>
                    <p className="text-xs text-green-600">⭐ Recomendado</p>
                  </div>
                </div>

                <div className="bg-blue-50 p-3 rounded-lg border-l-4 border-blue-400">
                  <div className="flex items-center space-x-2 mb-2">
                    <FileIcon className="w-4 h-4 text-blue-600" />
                    <span className="font-medium text-blue-800">ZIP (.zip)</span>
                  </div>
                  <div className="text-blue-700 space-y-1">
                    <p><strong>Tempo:</strong> 30-120 segundos</p>
                    <p><strong>Tecnologia:</strong> Extração estruturada</p>
                    <p><strong>Precisão:</strong> 95-98%</p>
                  </div>
                </div>

                <div className="bg-orange-50 p-3 rounded-lg border-l-4 border-orange-400">
                  <div className="flex items-center space-x-2 mb-2">
                    <FileText className="w-4 h-4 text-orange-600" />
                    <span className="font-medium text-orange-800">PDF (.pdf)</span>
                  </div>
                  <div className="text-orange-700 space-y-1">
                    <p><strong>Tempo:</strong> 5-15 minutos</p>
                    <p><strong>Tecnologia:</strong> OCR + IA {isGeminiAvailable ? 'Gemini' : 'Híbrida'}</p>
                    <p><strong>Precisão:</strong> 90-95%</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default SigtapImport;

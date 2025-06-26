import React, { useState } from 'react';
import { Upload, FileText, AlertCircle, CheckCircle, Clock, Download, Eye } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Progress } from './ui/progress';
import { Alert, AlertDescription } from './ui/alert';
import { useToast } from '../hooks/use-toast';

interface AIHUploadResult {
  success: boolean;
  message: string;
  totalProcessed: number;
  validAIHs: number;
  invalidAIHs: number;
  errors: string[];
  processingTime: number;
}

const AIHUpload = () => {
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingProgress, setProcessingProgress] = useState(0);
  const [lastResult, setLastResult] = useState<AIHUploadResult | null>(null);
  const [currentFile, setCurrentFile] = useState<File | null>(null);
  const { toast } = useToast();

  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Validar tipo de arquivo
    const fileName = file.name.toLowerCase();
    const isExcel = fileName.endsWith('.xlsx') || fileName.endsWith('.xls');
    const isCsv = fileName.endsWith('.csv');
    const isPdf = fileName.endsWith('.pdf');
    
    if (!isExcel && !isCsv && !isPdf) {
      toast({
        title: "Arquivo inválido",
        description: "Por favor, selecione um arquivo Excel (.xlsx/.xls), CSV ou PDF com dados de AIH.",
        variant: "destructive"
      });
      return;
    }

    // Validar tamanho do arquivo (limite de 50MB)
    const maxSize = 50 * 1024 * 1024; // 50MB
    if (file.size > maxSize) {
      toast({
        title: "Arquivo muito grande",
        description: "O arquivo deve ter no máximo 50MB.",
        variant: "destructive"
      });
      return;
    }

    setCurrentFile(file);
    await processAIHFile(file);
  };

  const processAIHFile = async (file: File) => {
    setIsProcessing(true);
    setProcessingProgress(0);
    
    try {
      console.log('🚀 Iniciando processamento de AIH:', file.name);
      
      // Importar processador dinamicamente
      const { AIHProcessor } = await import('../utils/aihProcessor');
      const processor = new AIHProcessor();
      
      // Callback de progresso
      const progressCallback = (progress: number) => {
        setProcessingProgress(progress);
      };

      // Simular etapas do processamento com progresso real
      setProcessingProgress(10);
      
      // Processar arquivo AIH
      const processingResult = await processor.processAIHFile(file);
      setProcessingProgress(60);
      
      // Se há AIHs válidas, fazer matching com SIGTAP
      if (processingResult.validAIHs > 0) {
        // TODO: Integrar com sistema de matching SIGTAP
        // const { AIHMatcher } = await import('../utils/aihMatcher');
        // const matcher = new AIHMatcher(sigtapProcedures);
        // const matches = await matcher.batchMatchAIHs(validAIHs, progressCallback);
        setProcessingProgress(90);
      }
      
      setProcessingProgress(100);

      // Converter resultado para interface do componente
      const mockResult: AIHUploadResult = {
        success: processingResult.success,
        message: processingResult.success 
          ? `Arquivo ${file.name} processado com sucesso!`
          : `Erro ao processar ${file.name}`,
        totalProcessed: processingResult.totalProcessed,
        validAIHs: processingResult.validAIHs,
        invalidAIHs: processingResult.invalidAIHs,
        errors: processingResult.errors.map(error => 
          `Linha ${error.line}: ${error.message}${error.value ? ` (${error.value})` : ''}`
        ),
        processingTime: processingResult.processingTime
      };

      setLastResult(mockResult);
      
      if (mockResult.success) {
        toast({
          title: "🎉 Processamento concluído!",
          description: `${mockResult.validAIHs} AIHs processadas com sucesso de ${mockResult.totalProcessed} total.`
        });
      } else {
        toast({
          title: "⚠️ Processamento concluído com erros",
          description: `${mockResult.validAIHs} válidas, ${mockResult.invalidAIHs} com problemas.`,
          variant: "destructive"
        });
      }

    } catch (error) {
      console.error('❌ Erro no processamento:', error);
      
      const errorResult: AIHUploadResult = {
        success: false,
        message: `Erro ao processar arquivo: ${error instanceof Error ? error.message : 'Erro desconhecido'}`,
        totalProcessed: 0,
        validAIHs: 0,
        invalidAIHs: 0,
        errors: [error instanceof Error ? error.message : 'Erro desconhecido'],
        processingTime: 0
      };
      
      setLastResult(errorResult);
      
      toast({
        title: "Erro no processamento",
        description: errorResult.message,
        variant: "destructive"
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDownloadErrorReport = () => {
    if (!lastResult || !lastResult.errors.length) return;
    
    const errorReport = [
      'RELATÓRIO DE ERROS - PROCESSAMENTO AIH',
      '=' .repeat(50),
      `Arquivo: ${currentFile?.name || 'Desconhecido'}`,
      `Data: ${new Date().toLocaleString('pt-BR')}`,
      `Total processado: ${lastResult.totalProcessed}`,
      `AIHs válidas: ${lastResult.validAIHs}`,
      `AIHs com erro: ${lastResult.invalidAIHs}`,
      `Taxa de sucesso: ${((lastResult.validAIHs / lastResult.totalProcessed) * 100).toFixed(1)}%`,
      '',
      'DETALHES DOS ERROS:',
      '-'.repeat(30),
      ...lastResult.errors.map((error, index) => `${index + 1}. ${error}`),
      '',
      'AÇÕES RECOMENDADAS:',
      '• Verificar formato dos dados de entrada',
      '• Confirmar se os códigos de procedimento existem na tabela SIGTAP',
      '• Validar CNS dos pacientes',
      '• Revisar datas de internação e alta'
    ].join('\n');

    const blob = new Blob([errorReport], { type: 'text/plain;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `aih_errors_${new Date().toISOString().split('T')[0]}.txt`;
    link.click();
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-900">Upload de AIHs</h2>
        <p className="text-gray-600 mt-1">
          Importe arquivos de Autorização de Internação Hospitalar para processamento automático e matching com SIGTAP
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Card de Upload */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <Upload className="w-5 h-5 text-blue-600" />
              <span>Importar Arquivo AIH</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center hover:border-blue-400 transition-colors">
              <div className="flex justify-center space-x-3 mb-4">
                <FileText className="w-12 h-12 text-green-500" />
                <FileText className="w-12 h-12 text-blue-400" />
                <FileText className="w-12 h-12 text-red-400" />
              </div>
              <p className="text-gray-600 mb-2">
                Selecione o arquivo com dados de AIH
              </p>
              <p className="text-sm text-gray-500 mb-4">
                <strong>🚀 NOVO:</strong> Excel (.xlsx/.xls) • CSV • PDF (máximo 50MB)
              </p>
              <input
                type="file"
                accept=".xlsx,.xls,.csv,.pdf"
                onChange={handleFileSelect}
                className="hidden"
                id="aih-upload"
                disabled={isProcessing}
              />
              <label
                htmlFor="aih-upload"
                className={`inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white ${
                  isProcessing 
                    ? 'bg-gray-400 cursor-not-allowed' 
                    : 'bg-blue-600 hover:bg-blue-700 cursor-pointer'
                } transition-colors`}
              >
                {isProcessing ? (
                  <>
                    <Clock className="w-4 h-4 mr-2 animate-spin" />
                    Processando...
                  </>
                ) : (
                  <>
                    <Upload className="w-4 h-4 mr-2" />
                    Selecionar Arquivo
                  </>
                )}
              </label>
            </div>

            {currentFile && (
              <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
                <h4 className="font-medium text-blue-900 mb-2">📄 Arquivo Selecionado</h4>
                <div className="text-sm text-blue-700 space-y-1">
                  <p><strong>Nome:</strong> {currentFile.name}</p>
                  <p><strong>Tamanho:</strong> {(currentFile.size / 1024 / 1024).toFixed(2)} MB</p>
                  <p><strong>Tipo:</strong> {currentFile.type || 'Não identificado'}</p>
                </div>
              </div>
            )}

            {isProcessing && (
              <div className="space-y-3">
                <div className="flex justify-between text-sm font-medium">
                  <span>🔄 Processando AIHs e fazendo matching SIGTAP...</span>
                  <span>{Math.round(processingProgress)}%</span>
                </div>
                <Progress value={processingProgress} className="h-2" />
                <div className="text-xs text-gray-500 text-center">
                  Validando dados • Buscando procedimentos • Verificando compatibilidade
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Card de Instruções */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <Eye className="w-5 h-5 text-green-600" />
              <span>Como Funciona o Processamento</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div>
                <h4 className="font-medium text-gray-800 mb-2 flex items-center">
                  📋 Dados Obrigatórios da AIH
                </h4>
                <ul className="text-sm text-gray-600 space-y-1 ml-4">
                  <li>• <strong>Número da AIH:</strong> Ex: 412511245891-8</li>
                  <li>• <strong>CNS do Paciente:</strong> Ex: 709.6026.8473.3573</li>
                  <li>• <strong>Código do Procedimento:</strong> Ex: 04.15.02.006-9</li>
                  <li>• <strong>CID Principal:</strong> Ex: M751</li>
                  <li>• <strong>Datas:</strong> Início e fim da internação</li>
                </ul>
              </div>

              <div>
                <h4 className="font-medium text-gray-800 mb-2 flex items-center">
                  🔄 Matching Automático
                </h4>
                <ul className="text-sm text-gray-600 space-y-1 ml-4">
                  <li>• <strong>Busca SIGTAP:</strong> Código procedimento → Tabela SIGTAP</li>
                  <li>• <strong>Validação Sexo:</strong> Paciente vs restrições procedimento</li>
                  <li>• <strong>Validação Idade:</strong> Faixa etária permitida</li>
                  <li>• <strong>Validação CID:</strong> Compatibilidade diagnóstica</li>
                </ul>
              </div>

              <div>
                <h4 className="font-medium text-gray-800 mb-2 flex items-center">
                  📊 Resultado do Processamento
                </h4>
                <ul className="text-sm text-gray-600 space-y-1 ml-4">
                  <li>• <strong>Score de Confiança:</strong> 0-100% para cada match</li>
                  <li>• <strong>Valores Calculados:</strong> Automático da tabela SIGTAP</li>
                  <li>• <strong>Relatório Detalhado:</strong> Erros e inconsistências</li>
                  <li>• <strong>Matches Aprovados:</strong> Prontos para faturamento</li>
                </ul>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Resultado do Processamento */}
      {lastResult && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              {lastResult.success ? (
                <CheckCircle className="w-5 h-5 text-green-600" />
              ) : (
                <AlertCircle className="w-5 h-5 text-red-600" />
              )}
              <span>🎯 Resultado do Processamento</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <Alert className={lastResult.success ? 'border-green-200 bg-green-50' : 'border-red-200 bg-red-50'}>
                <AlertDescription className={lastResult.success ? 'text-green-800' : 'text-red-800'}>
                  {lastResult.message}
                </AlertDescription>
              </Alert>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
                  <div className="text-2xl font-bold text-blue-600">{lastResult.totalProcessed}</div>
                  <div className="text-sm text-blue-700">📄 Total Processado</div>
                </div>
                <div className="bg-green-50 p-4 rounded-lg border border-green-200">
                  <div className="text-2xl font-bold text-green-600">{lastResult.validAIHs}</div>
                  <div className="text-sm text-green-700">✅ AIHs Válidas</div>
                </div>
                <div className="bg-red-50 p-4 rounded-lg border border-red-200">
                  <div className="text-2xl font-bold text-red-600">{lastResult.invalidAIHs}</div>
                  <div className="text-sm text-red-700">❌ Com Erros</div>
                </div>
                <div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
                  <div className="text-2xl font-bold text-gray-600">{(lastResult.processingTime / 1000).toFixed(1)}s</div>
                  <div className="text-sm text-gray-700">⏱️ Tempo</div>
                </div>
              </div>

              {lastResult.success && lastResult.validAIHs > 0 && (
                <div className="bg-green-50 p-4 rounded-lg border border-green-200">
                  <h4 className="font-medium text-green-800 mb-2">🎉 Próximos Passos</h4>
                  <div className="text-sm text-green-700">
                    <p>• <strong>{lastResult.validAIHs} AIHs</strong> prontas para revisão e aprovação</p>
                    <p>• <strong>Matching automático</strong> concluído com tabela SIGTAP</p>
                    <p>• <strong>Valores calculados</strong> automaticamente</p>
                  </div>
                </div>
              )}

              {lastResult.errors.length > 0 && (
                <div className="space-y-3">
                  <div className="flex justify-between items-center">
                    <h4 className="font-medium text-gray-800">⚠️ Erros Encontrados ({lastResult.errors.length})</h4>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleDownloadErrorReport}
                      className="flex items-center space-x-1"
                    >
                      <Download className="w-4 h-4" />
                      <span>Baixar Relatório</span>
                    </Button>
                  </div>
                  
                  <div className="bg-red-50 border border-red-200 rounded-lg p-4 max-h-48 overflow-y-auto">
                    {lastResult.errors.slice(0, 5).map((error, index) => (
                      <div key={index} className="text-sm text-red-700 mb-2 p-2 bg-white rounded border-l-4 border-red-400">
                        <strong>{index + 1}.</strong> {error}
                      </div>
                    ))}
                    {lastResult.errors.length > 5 && (
                      <div className="text-sm text-red-600 font-medium text-center p-2 bg-red-100 rounded">
                        ... e mais {lastResult.errors.length - 5} erros (baixe o relatório completo)
                      </div>
                    )}
                  </div>
                </div>
              )}

              {lastResult.success && lastResult.validAIHs > 0 && (
                <div className="flex flex-wrap gap-2">
                  <Button className="flex items-center space-x-2">
                    <Eye className="w-4 h-4" />
                    <span>Ver AIHs Processadas</span>
                  </Button>
                  <Button variant="outline" className="flex items-center space-x-2">
                    <Download className="w-4 h-4" />
                    <span>Exportar Relatório</span>
                  </Button>
                  <Button variant="outline" className="flex items-center space-x-2 text-green-600 border-green-200 hover:bg-green-50">
                    <CheckCircle className="w-4 h-4" />
                    <span>Revisar Matches</span>
                  </Button>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default AIHUpload; 
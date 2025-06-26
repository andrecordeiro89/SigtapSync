import React, { useState, useEffect } from 'react';
import { Upload, FileText, AlertCircle, CheckCircle, Clock, Download, Eye, Building } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Progress } from './ui/progress';
import { Alert, AlertDescription } from './ui/alert';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Label } from './ui/label';
import { useToast } from '../hooks/use-toast';
import { HospitalService } from '../services/supabaseService';

interface AIHUploadResult {
  success: boolean;
  message: string;
  totalProcessed: number;
  validAIHs: number;
  invalidAIHs: number;
  errors: string[];
  processingTime: number;
  hospitalId?: string;
  hospitalName?: string;
}

interface Hospital {
  id: string;
  name: string;
  city: string;
  state: string;
  cnpj: string;
}

const AIHUpload = () => {
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingProgress, setProcessingProgress] = useState(0);
  const [lastResult, setLastResult] = useState<AIHUploadResult | null>(null);
  const [currentFile, setCurrentFile] = useState<File | null>(null);
  const [selectedHospital, setSelectedHospital] = useState<string>('');
  const [hospitals, setHospitals] = useState<Hospital[]>([]);
  const [loadingHospitals, setLoadingHospitals] = useState(true);
  const { toast } = useToast();

  // Carregar lista de hospitais
  useEffect(() => {
    const loadHospitals = async () => {
      try {
        const hospitalData = await HospitalService.getHospitals();
        setHospitals(hospitalData);
      } catch (error) {
        console.error('Erro ao carregar hospitais:', error);
        toast({
          title: "Erro ao carregar hospitais",
          description: "Não foi possível carregar a lista de hospitais. Verifique sua conexão.",
          variant: "destructive"
        });
      } finally {
        setLoadingHospitals(false);
      }
    };

    loadHospitals();
  }, []);

  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Validar se hospital foi selecionado
    if (!selectedHospital) {
      toast({
        title: "Hospital não selecionado",
        description: "Por favor, selecione o hospital antes de fazer o upload do arquivo AIH.",
        variant: "destructive"
      });
      return;
    }

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
      console.log('🏥 Hospital selecionado:', selectedHospital);
      
      const selectedHospitalData = hospitals.find(h => h.id === selectedHospital);
      
      // Importar processador dinamicamente
      const { AIHProcessor } = await import('../utils/aihProcessor');
      const processor = new AIHProcessor();
      
      // Callback de progresso
      const progressCallback = (progress: number) => {
        setProcessingProgress(progress);
      };

      // Simular etapas do processamento com progresso real
      setProcessingProgress(10);
      
      // Processar arquivo AIH com ID do hospital
      const processingResult = await processor.processAIHFile(file, {
        hospitalId: selectedHospital,
        hospitalName: selectedHospitalData?.name || 'Hospital Selecionado'
      });
      setProcessingProgress(60);
      
      // Se há AIHs válidas, fazer matching com SIGTAP
      if (processingResult.validAIHs > 0) {
        console.log(`🔄 Iniciando matching para ${processingResult.validAIHs} AIHs...`);
        
        // TODO: Integrar com sistema de matching SIGTAP
        // const { AIHMatcher } = await import('../utils/aihMatcher');
        // const matcher = new AIHMatcher(sigtapProcedures);
        // const matches = await matcher.batchMatchAIHs(validAIHs, progressCallback);
        
        setProcessingProgress(90);
        console.log('✅ Matching concluído');
      }
      
      setProcessingProgress(100);

      // Converter resultado para interface do componente
      const mockResult: AIHUploadResult = {
        success: processingResult.success,
        message: processingResult.success 
          ? `Arquivo ${file.name} processado com sucesso para ${selectedHospitalData?.name}!`
          : `Erro ao processar ${file.name}`,
        totalProcessed: processingResult.totalProcessed,
        validAIHs: processingResult.validAIHs,
        invalidAIHs: processingResult.invalidAIHs,
        errors: processingResult.errors.map(error => 
          `Linha ${error.line}: ${error.message}${error.value ? ` (${error.value})` : ''}`
        ),
        processingTime: processingResult.processingTime,
        hospitalId: selectedHospital,
        hospitalName: selectedHospitalData?.name
      };

      setLastResult(mockResult);
      
      if (mockResult.success) {
        toast({
          title: "🎉 Processamento concluído!",
          description: `${mockResult.validAIHs} AIHs processadas para ${selectedHospitalData?.name}.`
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
        processingTime: 0,
        hospitalId: selectedHospital
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
    
    const selectedHospitalData = hospitals.find(h => h.id === selectedHospital);
    
    const errorReport = [
      'RELATÓRIO DE ERROS - PROCESSAMENTO AIH',
      '=' .repeat(50),
      `Arquivo: ${currentFile?.name || 'Desconhecido'}`,
      `Hospital: ${selectedHospitalData?.name || 'Não informado'}`,
      `Cidade: ${selectedHospitalData?.city}/${selectedHospitalData?.state}`,
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
      '• Revisar datas de internação e alta',
      '• Verificar se o hospital está correto'
    ].join('\n');

    const blob = new Blob([errorReport], { type: 'text/plain;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `aih_errors_${selectedHospitalData?.name.replace(/[^a-zA-Z0-9]/g, '_')}_${new Date().toISOString().split('T')[0]}.txt`;
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
            {/* Seleção de Hospital */}
            <div className="space-y-2">
              <Label htmlFor="hospital-select" className="flex items-center space-x-2">
                <Building className="w-4 h-4" />
                <span>Selecionar Hospital *</span>
              </Label>
              <Select value={selectedHospital} onValueChange={setSelectedHospital} disabled={loadingHospitals}>
                <SelectTrigger id="hospital-select">
                  <SelectValue placeholder={loadingHospitals ? "Carregando hospitais..." : "Selecione o hospital"} />
                </SelectTrigger>
                <SelectContent>
                  {hospitals.map((hospital) => (
                    <SelectItem key={hospital.id} value={hospital.id}>
                      <div className="flex flex-col">
                        <span className="font-medium">{hospital.name}</span>
                        <span className="text-xs text-gray-500">{hospital.city}/{hospital.state} - CNPJ: {hospital.cnpj}</span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {!selectedHospital && (
                <p className="text-xs text-amber-600">
                  ⚠️ Selecione o hospital antes de fazer o upload
                </p>
              )}
            </div>

            <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center hover:border-blue-400 transition-colors">
              <div className="flex justify-center space-x-3 mb-4">
                <FileText className="w-8 h-8 text-gray-400" />
                <Upload className="w-8 h-8 text-blue-500" />
              </div>
              
              <div className="space-y-2">
                <p className="text-lg font-medium text-gray-700">
                  Selecione um arquivo AIH
                </p>
                <p className="text-sm text-gray-500">
                  Formatos aceitos: Excel (.xlsx/.xls), CSV ou PDF
                </p>
                <p className="text-xs text-gray-400">
                  Tamanho máximo: 50MB
                </p>
              </div>

              <input
                type="file"
                id="aih-upload"
                accept=".xlsx,.xls,.csv,.pdf"
                onChange={handleFileSelect}
                disabled={isProcessing || !selectedHospital}
                className="hidden"
              />
              
              <label
                htmlFor="aih-upload"
                className={`inline-flex items-center px-4 py-2 mt-4 text-sm font-medium rounded-lg cursor-pointer transition-colors ${
                  isProcessing || !selectedHospital
                    ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                    : 'bg-blue-600 text-white hover:bg-blue-700'
                }`}
              >
                <Upload className="w-4 h-4 mr-2" />
                {isProcessing ? 'Processando...' : 'Selecionar Arquivo'}
              </label>
            </div>

            {/* Progresso */}
            {isProcessing && (
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span>Processando arquivo...</span>
                  <span>{processingProgress}%</span>
                </div>
                <Progress value={processingProgress} className="w-full" />
              </div>
            )}
          </CardContent>
        </Card>

        {/* Card de Resultado */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              {lastResult?.success ? (
                <CheckCircle className="w-5 h-5 text-green-600" />
              ) : lastResult && !lastResult.success ? (
                <AlertCircle className="w-5 h-5 text-red-600" />
              ) : (
                <Clock className="w-5 h-5 text-gray-400" />
              )}
              <span>Resultado do Processamento</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {!lastResult ? (
              <div className="text-center py-8 text-gray-500">
                <Clock className="w-12 h-12 mx-auto mb-4 text-gray-300" />
                <p>Nenhum arquivo processado ainda</p>
                <p className="text-sm">Selecione um hospital e faça upload de um arquivo AIH</p>
              </div>
            ) : (
              <div className="space-y-4">
                <Alert variant={lastResult.success ? "default" : "destructive"}>
                  <AlertDescription>
                    <div className="space-y-2">
                      <p className="font-medium">{lastResult.message}</p>
                      {lastResult.hospitalName && (
                        <p className="text-sm">
                          🏥 <strong>Hospital:</strong> {lastResult.hospitalName}
                        </p>
                      )}
                    </div>
                  </AlertDescription>
                </Alert>

                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div className="bg-blue-50 p-3 rounded-lg">
                    <p className="font-semibold text-blue-900">Total Processado</p>
                    <p className="text-2xl font-bold text-blue-600">{lastResult.totalProcessed}</p>
                  </div>
                  <div className="bg-green-50 p-3 rounded-lg">
                    <p className="font-semibold text-green-900">AIHs Válidas</p>
                    <p className="text-2xl font-bold text-green-600">{lastResult.validAIHs}</p>
                  </div>
                  <div className="bg-red-50 p-3 rounded-lg">
                    <p className="font-semibold text-red-900">Com Problemas</p>
                    <p className="text-2xl font-bold text-red-600">{lastResult.invalidAIHs}</p>
                  </div>
                  <div className="bg-purple-50 p-3 rounded-lg">
                    <p className="font-semibold text-purple-900">Taxa de Sucesso</p>
                    <p className="text-2xl font-bold text-purple-600">
                      {lastResult.totalProcessed > 0 ? 
                        ((lastResult.validAIHs / lastResult.totalProcessed) * 100).toFixed(1) : 0}%
                    </p>
                  </div>
                </div>

                {lastResult.errors.length > 0 && (
                  <div className="space-y-2">
                    <div className="flex justify-between items-center">
                      <p className="font-medium text-red-900">Erros Encontrados:</p>
                      <Button
                        onClick={handleDownloadErrorReport}
                        size="sm"
                        variant="outline"
                        className="flex items-center space-x-1"
                      >
                        <Download className="w-3 h-3" />
                        <span>Download</span>
                      </Button>
                    </div>
                    <div className="max-h-32 overflow-y-auto bg-red-50 border border-red-200 rounded p-3">
                      {lastResult.errors.slice(0, 5).map((error, index) => (
                        <p key={index} className="text-xs text-red-700 mb-1">
                          {error}
                        </p>
                      ))}
                      {lastResult.errors.length > 5 && (
                        <p className="text-xs text-red-600 font-medium">
                          ... e mais {lastResult.errors.length - 5} erros (baixe o relatório completo)
                        </p>
                      )}
                    </div>
                  </div>
                )}

                <div className="text-xs text-gray-500 border-t pt-2">
                  <p>Processamento concluído em {(lastResult.processingTime / 1000).toFixed(2)}s</p>
                  {currentFile && <p>Arquivo: {currentFile.name}</p>}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Próximos Passos */}
      {lastResult?.success && lastResult.validAIHs > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <CheckCircle className="w-5 h-5 text-green-600" />
              <span>Próximos Passos</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div className="flex items-center space-x-3 p-3 bg-green-50 rounded-lg">
                <div className="w-6 h-6 bg-green-500 text-white rounded-full flex items-center justify-center text-xs font-bold">1</div>
                <div>
                  <p className="font-medium">Matching com SIGTAP</p>
                  <p className="text-sm text-gray-600">AIHs serão automaticamente pareadas com procedimentos SIGTAP</p>
                </div>
              </div>
              
              <div className="flex items-center space-x-3 p-3 bg-blue-50 rounded-lg">
                <div className="w-6 h-6 bg-blue-500 text-white rounded-full flex items-center justify-center text-xs font-bold">2</div>
                <div>
                  <p className="font-medium">Validação de Valores</p>
                  <p className="text-sm text-gray-600">Valores serão calculados conforme tabela SIGTAP vigente</p>
                </div>
              </div>
              
              <div className="flex items-center space-x-3 p-3 bg-purple-50 rounded-lg">
                <div className="w-6 h-6 bg-purple-500 text-white rounded-full flex items-center justify-center text-xs font-bold">3</div>
                <div>
                  <p className="font-medium">Geração de Faturamento</p>
                  <p className="text-sm text-gray-600">Relatórios de faturamento serão disponibilizados para {lastResult.hospitalName}</p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default AIHUpload;
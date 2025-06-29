import React, { useState } from 'react';
import { Upload, FileText, CheckCircle, AlertCircle, Eye, Download, Database } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Alert, AlertDescription } from './ui/alert';
import { useToast } from '../hooks/use-toast';
import { AIH } from '../types';
import { SchemaMigrationService } from '../services/schemaMigrationService';

interface TestResult {
  success: boolean;
  extractedFields: Record<string, any>;
  validationErrors: string[];
  processingTime: number;
  extractedAIH?: AIH;
}

const AIHPDFTester = () => {
  const [isProcessing, setIsProcessing] = useState(false);
  const [testResult, setTestResult] = useState<TestResult | null>(null);
  const [currentFile, setCurrentFile] = useState<File | null>(null);
  const [isMigratingSchema, setIsMigratingSchema] = useState(false);
  const [schemaStatus, setSchemaStatus] = useState<{aihsExpanded: boolean; patientsExpanded: boolean; message: string} | null>(null);
  const { toast } = useToast();

  const checkSchemaStatus = async () => {
    try {
      const status = await SchemaMigrationService.checkSchemaExpansion();
      setSchemaStatus(status);
      return status;
    } catch (error) {
      console.error('❌ Erro ao verificar schema:', error);
      toast({
        title: "Erro ao verificar schema",
        description: error instanceof Error ? error.message : 'Erro desconhecido',
        variant: "destructive"
      });
      return null;
    }
  };

  const applySchemaExpansion = async () => {
    setIsMigratingSchema(true);
    
    try {
      console.log('🔄 Aplicando expansão do schema...');
      
      const result = await SchemaMigrationService.applyAIHSchemaExpansion();
      
      if (result.success) {
        toast({
          title: "✅ Schema expandido com sucesso!",
          description: result.message
        });
        
        // Atualizar status do schema
        await checkSchemaStatus();
      } else {
        toast({
          title: "⚠️ Problemas na migração",
          description: result.message,
          variant: "destructive"
        });
      }
      
    } catch (error) {
      console.error('❌ Erro na migração:', error);
      toast({
        title: "Erro na migração",
        description: error instanceof Error ? error.message : 'Erro desconhecido',
        variant: "destructive"
      });
    } finally {
      setIsMigratingSchema(false);
    }
  };

  // Verificar status do schema ao carregar componente
  React.useEffect(() => {
    checkSchemaStatus();
  }, []);

  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Validar se é PDF
    if (!file.name.toLowerCase().endsWith('.pdf')) {
      toast({
        title: "Arquivo inválido",
        description: "Por favor, selecione um arquivo PDF de AIH.",
        variant: "destructive"
      });
      return;
    }

    setCurrentFile(file);
    await testPDFProcessing(file);
  };

  const testPDFProcessing = async (file: File) => {
    setIsProcessing(true);
    
    try {
      console.log('🧪 Iniciando teste de PDF AIH:', file.name);
      
      const startTime = Date.now();
      
      // Importar e usar processador PDF AIH
      const { AIHPDFProcessor } = await import('../utils/aihPdfProcessor');
      const processor = new AIHPDFProcessor();
      
      // Processar PDF
      const result = await processor.processPDFAIH(file, {
        hospitalId: 'test-hospital',
        hospitalName: 'Hospital Teste'
      });
      
      const processingTime = Date.now() - startTime;
      
      // Montar resultado do teste
      const testResult: TestResult = {
        success: result.success,
        extractedFields: result.success ? {
          'Total Processado': result.totalProcessed,
          'AIHs Válidas': result.validAIHs,
          'AIHs Inválidas': result.invalidAIHs,
          'Tempo de Processamento': `${processingTime}ms`
        } : {},
        validationErrors: result.errors.map(error => error.message),
        processingTime,
        extractedAIH: result.extractedAIH // Incluir AIH extraída do resultado
      };

      setTestResult(testResult);
      
      if (result.success) {
        toast({
          title: "✅ Teste bem-sucedido!",
          description: `PDF AIH processado em ${processingTime}ms`
        });
      } else {
        toast({
          title: "⚠️ Teste com problemas",
          description: `${result.errors.length} erros encontrados`,
          variant: "destructive"
        });
      }

    } catch (error) {
      console.error('❌ Erro no teste:', error);
      
      setTestResult({
        success: false,
        extractedFields: {},
        validationErrors: [error instanceof Error ? error.message : 'Erro desconhecido'],
        processingTime: Date.now() - Date.now()
      });
      
      toast({
        title: "Erro no teste",
        description: error instanceof Error ? error.message : 'Erro desconhecido',
        variant: "destructive"
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const downloadTestReport = () => {
    if (!testResult || !currentFile) return;

    const report = [
      '='.repeat(60),
      'RELATÓRIO DE TESTE - PROCESSADOR PDF AIH',
      '='.repeat(60),
      '',
      `Arquivo: ${currentFile.name}`,
      `Tamanho: ${(currentFile.size / 1024 / 1024).toFixed(2)} MB`,
      `Data do teste: ${new Date().toLocaleString('pt-BR')}`,
      '',
      'RESULTADO:',
      `-`.repeat(30),
      `Status: ${testResult.success ? '✅ SUCESSO' : '❌ FALHOU'}`,
      `Tempo de processamento: ${testResult.processingTime}ms`,
      '',
      'CAMPOS EXTRAÍDOS:',
      `-`.repeat(30),
      ...Object.entries(testResult.extractedFields).map(([key, value]) => `${key}: ${value}`),
      '',
      testResult.validationErrors.length > 0 ? 'ERROS ENCONTRADOS:' : 'NENHUM ERRO ENCONTRADO',
      testResult.validationErrors.length > 0 ? `-`.repeat(30) : '',
      ...testResult.validationErrors.map((error, index) => `${index + 1}. ${error}`),
      '',
      'CONFIGURAÇÃO DO TESTE:',
      `-`.repeat(30),
      '• Processador: AIHPDFProcessor',
      '• Página processada: Primeira página apenas',
      '• Padrões de extração: 25+ campos estruturados',
      '• Validação: CNS, datas, campos obrigatórios',
      '',
      '='.repeat(60)
    ].join('\n');

    const blob = new Blob([report], { type: 'text/plain;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `teste_aih_pdf_${new Date().toISOString().split('T')[0]}.txt`;
    link.click();
  };

  const testFullPersistence = async (file: File) => {
    if (!testResult?.extractedAIH) {
      toast({
        title: "Nenhuma AIH extraída",
        description: "Execute a extração primeiro para ter dados para persistir",
        variant: "destructive"
      });
      return;
    }

    setIsProcessing(true);
    
    try {
      console.log('🧪 Testando persistência completa do PDF AIH:', file.name);
      
      // Importar serviços necessários
      const { AIHPersistenceService } = await import('../services/aihPersistenceService');
      const { HospitalService } = await import('../services/supabaseService');
      
      // Verificar hospitais existentes
      console.log('🏥 Verificando hospitais disponíveis...');
      const hospitals = await HospitalService.getHospitals();
      console.log('🏥 Hospitais encontrados:', hospitals.length);
      
      let testHospitalId = '';
      
      if (hospitals.length === 0) {
        console.log('🏥 Nenhum hospital encontrado, criando hospital de teste...');
        
        // Criar hospital de teste
        const newHospital = await HospitalService.createHospital({
          name: 'Hospital Teste AIH',
          cnpj: '00.000.000/0001-00',
          address: 'Rua Teste, 123',
          city: 'Cidade Teste',
          state: 'SP',
          zip_code: '00000-000',
          phone: '(11)9999-9999',
          email: 'teste@hospital.com',
          habilitacoes: [],
          is_active: true
        });
        
        testHospitalId = newHospital.id;
        console.log('✅ Hospital de teste criado:', testHospitalId);
      } else {
        // Usar primeiro hospital disponível
        testHospitalId = hospitals[0].id;
        console.log('🏥 Usando hospital existente:', hospitals[0].name, '- ID:', testHospitalId);
      }
      
      // Tentar persistir AIH extraída
      console.log('💾 Iniciando persistência com hospital ID:', testHospitalId);
      const persistenceResult = await AIHPersistenceService.persistAIHFromPDF(
        testResult.extractedAIH,
        testHospitalId,
        file.name
      );
      
      if (persistenceResult.success) {
        toast({
          title: "✅ Persistência bem-sucedida!",
          description: `AIH salva no banco - ID: ${persistenceResult.aihId}`,
        });
        console.log('✅ Teste de persistência bem-sucedido:', persistenceResult);
      } else {
        toast({
          title: "❌ Erro na persistência",
          description: persistenceResult.message,
          variant: "destructive"
        });
        console.error('❌ Erro na persistência:', persistenceResult);
      }
      
    } catch (error) {
      console.error('❌ Erro crítico no teste de persistência:', error);
      toast({
        title: "Erro crítico",
        description: error instanceof Error ? error.message : 'Erro desconhecido',
        variant: "destructive"
      });
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-900">🧪 Testador PDF AIH</h2>
        <p className="text-gray-600 mt-1">
          Teste o processamento de PDF AIH (primeira página) para validar extração de dados estruturados
        </p>
      </div>

      {/* Card de Schema Database */}
      <Card className="bg-gradient-to-r from-purple-50 to-indigo-50 border-purple-200">
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Database className="w-5 h-5 text-purple-600" />
            <span>📊 Status do Schema Banco de Dados</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {schemaStatus ? (
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-white p-3 rounded-lg border">
                <div className="flex items-center space-x-2">
                  {schemaStatus.aihsExpanded ? (
                    <CheckCircle className="w-5 h-5 text-green-600" />
                  ) : (
                    <AlertCircle className="w-5 h-5 text-orange-500" />
                  )}
                  <span className="font-medium">Tabela AIHs</span>
                </div>
                <p className="text-sm text-gray-600 mt-1">
                  {schemaStatus.aihsExpanded ? 'Expandida ✅' : 'Não expandida ⚠️'}
                </p>
              </div>
              
              <div className="bg-white p-3 rounded-lg border">
                <div className="flex items-center space-x-2">
                  {schemaStatus.patientsExpanded ? (
                    <CheckCircle className="w-5 h-5 text-green-600" />
                  ) : (
                    <AlertCircle className="w-5 h-5 text-orange-500" />
                  )}
                  <span className="font-medium">Tabela Patients</span>
                </div>
                <p className="text-sm text-gray-600 mt-1">
                  {schemaStatus.patientsExpanded ? 'Expandida ✅' : 'Não expandida ⚠️'}
                </p>
              </div>
            </div>
          ) : (
            <div className="text-center py-4">
              <p className="text-gray-500">Verificando status do schema...</p>
            </div>
          )}
          
          <div className="flex space-x-3">
            <Button
              onClick={checkSchemaStatus}
              variant="outline"
              size="sm"
              disabled={isMigratingSchema}
            >
              🔄 Verificar Status
            </Button>
            
            <Button
              onClick={applySchemaExpansion}
              variant="default"
              size="sm"
              disabled={isMigratingSchema || (schemaStatus?.aihsExpanded && schemaStatus?.patientsExpanded)}
              className="bg-purple-600 hover:bg-purple-700"
            >
              {isMigratingSchema ? (
                <>
                  <Database className="w-4 h-4 mr-2 animate-spin" />
                  Aplicando...
                </>
              ) : (
                <>
                  <Database className="w-4 h-4 mr-2" />
                  Expandir Schema
                </>
              )}
            </Button>
          </div>
          
          {schemaStatus && (
            <Alert className={schemaStatus.aihsExpanded && schemaStatus.patientsExpanded ? "border-green-200 bg-green-50" : "border-orange-200 bg-orange-50"}>
              <AlertDescription className="text-sm">
                {schemaStatus.message}
                {!(schemaStatus.aihsExpanded && schemaStatus.patientsExpanded) && (
                  <span className="block mt-1 text-xs text-gray-600">
                    💡 Para salvar AIH extraída do PDF no banco, é necessário expandir o schema primeiro.
                  </span>
                )}
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Card de Upload */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <Upload className="w-5 h-5 text-blue-600" />
              <span>Upload PDF AIH</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center">
              <input
                type="file"
                accept=".pdf"
                onChange={handleFileSelect}
                className="hidden"
                id="pdf-upload"
                disabled={isProcessing}
              />
              <label
                htmlFor="pdf-upload"
                className={`cursor-pointer ${isProcessing ? 'cursor-not-allowed opacity-50' : ''}`}
              >
                <FileText className="w-12 h-12 text-gray-400 mx-auto mb-2" />
                <p className="text-sm text-gray-600">
                  {isProcessing ? 'Processando...' : 'Clique para selecionar PDF AIH'}
                </p>
                <p className="text-xs text-gray-500 mt-1">
                  Apenas arquivos PDF são aceitos
                </p>
              </label>
            </div>

            {currentFile && (
              <div className="bg-blue-50 p-3 rounded-lg">
                <p className="text-sm text-blue-800">
                  <strong>Arquivo selecionado:</strong> {currentFile.name}
                </p>
                <p className="text-xs text-blue-600">
                  Tamanho: {(currentFile.size / 1024 / 1024).toFixed(2)} MB
                </p>
                
                {/* Botão de teste de persistência */}
                <div className="mt-3 flex space-x-2">
                  <Button
                    onClick={() => testPDFProcessing(currentFile)}
                    disabled={isProcessing}
                    size="sm"
                    className="bg-blue-600 hover:bg-blue-700"
                  >
                    {isProcessing ? 'Processando...' : '🧪 Testar Extração'}
                  </Button>
                  
                  <Button
                    onClick={() => testFullPersistence(currentFile)}
                    disabled={isProcessing || !testResult?.success}
                    size="sm"
                    variant="outline"
                  >
                    💾 Testar Persistência
                  </Button>
                </div>
              </div>
            )}

            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                Este testador processa apenas a <strong>primeira página</strong> do PDF AIH, 
                extraindo dados estruturados conforme padrão padrão SUS.
              </AlertDescription>
            </Alert>
          </CardContent>
        </Card>

        {/* Card de Resultados */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <Eye className="w-5 h-5 text-green-600" />
              <span>Resultado do Teste</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {!testResult ? (
              <div className="text-center py-8 text-gray-500">
                <FileText className="w-12 h-12 mx-auto mb-2 opacity-50" />
                <p>Nenhum teste executado ainda</p>
                <p className="text-xs">Selecione um PDF AIH para começar</p>
              </div>
            ) : (
              <div className="space-y-4">
                {/* Status */}
                <div className={`p-3 rounded-lg flex items-center space-x-2 ${
                  testResult.success 
                    ? 'bg-green-50 text-green-800' 
                    : 'bg-red-50 text-red-800'
                }`}>
                  {testResult.success ? (
                    <CheckCircle className="w-5 h-5" />
                  ) : (
                    <AlertCircle className="w-5 h-5" />
                  )}
                  <span className="font-medium">
                    {testResult.success ? 'Teste bem-sucedido!' : 'Teste com problemas'}
                  </span>
                </div>

                {/* Campos extraídos */}
                {Object.keys(testResult.extractedFields).length > 0 && (
                  <div>
                    <h4 className="font-medium text-gray-900 mb-2">Dados Extraídos:</h4>
                    <div className="bg-gray-50 p-3 rounded-lg space-y-1">
                      {Object.entries(testResult.extractedFields).map(([key, value]) => (
                        <div key={key} className="flex justify-between text-sm">
                          <span className="text-gray-600">{key}:</span>
                          <span className="font-medium">{value}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Erros */}
                {testResult.validationErrors.length > 0 && (
                  <div>
                    <h4 className="font-medium text-red-800 mb-2">Erros Encontrados:</h4>
                    <div className="bg-red-50 p-3 rounded-lg space-y-1">
                      {testResult.validationErrors.map((error, index) => (
                        <p key={index} className="text-sm text-red-700">
                          {index + 1}. {error}
                        </p>
                      ))}
                    </div>
                  </div>
                )}

                {/* Ações */}
                <div className="flex space-x-2">
                  <Button
                    onClick={downloadTestReport}
                    variant="outline"
                    size="sm"
                    className="flex items-center space-x-1"
                  >
                    <Download className="w-4 h-4" />
                    <span>Baixar Relatório</span>
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default AIHPDFTester; 
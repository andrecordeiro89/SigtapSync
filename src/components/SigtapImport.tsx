import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Upload, FileText, CheckCircle, AlertCircle, X } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useSigtapContext } from '../contexts/SigtapContext';

const SigtapImport = () => {
  const [progress, setProgress] = useState(0);
  const [importStatus, setImportStatus] = useState<'idle' | 'processing' | 'success' | 'error'>('idle');
  const { toast } = useToast();
  const { 
    isLoading, 
    error, 
    lastImportDate, 
    totalProcedures, 
    importSigtapFile, 
    clearData 
  } = useSigtapContext();

  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Validar tipo de arquivo
    if (!file.name.toLowerCase().endsWith('.zip')) {
      toast({
        title: "Arquivo inválido",
        description: "Por favor, selecione um arquivo ZIP da tabela SIGTAP.",
        variant: "destructive"
      });
      return;
    }

    console.log('Arquivo selecionado:', file.name, 'Tamanho:', file.size);
    setImportStatus('processing');
    setProgress(0);

    // Simular progresso
    const progressInterval = setInterval(() => {
      setProgress(prev => {
        if (prev >= 90) {
          clearInterval(progressInterval);
          return 90;
        }
        return prev + 10;
      });
    }, 300);

    try {
      const result = await importSigtapFile(file);
      
      clearInterval(progressInterval);
      setProgress(100);
      
      if (result.success) {
        setImportStatus('success');
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
      clearInterval(progressInterval);
      setImportStatus('error');
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
    setProgress(0);
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
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <Upload className="w-5 h-5 text-blue-600" />
              <span>Importar Nova Tabela</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center hover:border-blue-400 transition-colors">
              <Upload className="w-12 h-12 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-600 mb-4">
                Selecione o arquivo ZIP da tabela SIGTAP
              </p>
              <input
                type="file"
                accept=".zip"
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
                    {isLoading ? 'Processando...' : 'Selecionar Arquivo ZIP'}
                  </span>
                </Button>
              </label>
            </div>

            {isLoading && (
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span>Progresso da importação:</span>
                  <span>{progress}%</span>
                </div>
                <Progress value={progress} className="w-full" />
                <p className="text-sm text-gray-600">
                  Processando arquivo ZIP e extraindo dados...
                </p>
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
          <CardContent className="space-y-4">
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
                  Importe um arquivo ZIP da tabela SIGTAP para começar a usar o sistema.
                </p>
              </div>
            )}

            <div className="border-l-4 border-blue-400 bg-blue-50 p-4">
              <div className="flex items-center space-x-2 mb-2">
                <FileText className="w-5 h-5 text-blue-600" />
                <span className="font-medium text-blue-800">Informação</span>
              </div>
              <p className="text-sm text-blue-700">
                Este sistema processa arquivos ZIP reais da tabela SIGTAP. 
                Após a importação, você poderá visualizar e consultar todos os procedimentos 
                na seção "Consulta SIGTAP".
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Instruções de Importação</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3 text-sm text-gray-600">
            <div className="flex items-start space-x-3">
              <div className="w-6 h-6 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center text-xs font-medium">1</div>
              <p>Acesse o site do DATASUS em <span className="font-mono bg-gray-100 px-1 rounded">datasus.saude.gov.br</span></p>
            </div>
            <div className="flex items-start space-x-3">
              <div className="w-6 h-6 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center text-xs font-medium">2</div>
              <p>Navegue até "Sistemas e Aplicativos" → "SIGTAP" → "Downloads"</p>
            </div>
            <div className="flex items-start space-x-3">
              <div className="w-6 h-6 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center text-xs font-medium">3</div>
              <p>Baixe o arquivo ZIP da versão mais recente da tabela</p>
            </div>
            <div className="flex items-start space-x-3">
              <div className="w-6 h-6 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center text-xs font-medium">4</div>
              <p>Selecione o arquivo baixado usando o botão "Selecionar Arquivo ZIP" acima</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default SigtapImport;


import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Upload, FileText, CheckCircle, AlertCircle, X, FileIcon } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useSigtapContext } from '../contexts/SigtapContext';

const SigtapImport = () => {
  const [importStatus, setImportStatus] = useState<'idle' | 'processing' | 'success' | 'error'>('idle');
  const { toast } = useToast();
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
    if (!fileName.endsWith('.zip') && !fileName.endsWith('.pdf')) {
      toast({
        title: "Arquivo inválido",
        description: "Por favor, selecione um arquivo PDF ou ZIP da tabela SIGTAP.",
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
      const result = await importSigtapFile(file);
      
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
    toast({
      title: "Dados limpos",
      description: "Todos os dados da tabela SIGTAP foram removidos.",
    });
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-900">Importação Tabela SIGTAP</h2>
        <p className="text-gray-600 mt-1">Importe a tabela oficial do DATASUS (ZIP ou PDF) para atualizar os procedimentos</p>
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
              <div className="flex justify-center space-x-4 mb-4">
                <FileIcon className="w-12 h-12 text-blue-400" />
                <FileText className="w-12 h-12 text-red-400" />
              </div>
              <p className="text-gray-600 mb-2">
                Selecione o arquivo da tabela SIGTAP
              </p>
              <p className="text-sm text-gray-500 mb-4">
                Suporte a arquivos ZIP e PDF (máximo 100MB)
              </p>
              <input
                type="file"
                accept=".zip,.pdf"
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
                    {isLoading ? 'Processando...' : 'Selecionar Arquivo (ZIP/PDF)'}
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
                {currentPage && totalPages && (
                  <p className="text-sm text-gray-600">
                    Processando página {currentPage} de {totalPages}...
                  </p>
                )}
                {!currentPage && (
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
                  Importe um arquivo ZIP ou PDF da tabela SIGTAP para começar a usar o sistema.
                </p>
              </div>
            )}

            <div className="border-l-4 border-blue-400 bg-blue-50 p-4">
              <div className="flex items-center space-x-2 mb-2">
                <FileText className="w-5 h-5 text-blue-600" />
                <span className="font-medium text-blue-800">Suporte a PDF</span>
              </div>
              <p className="text-sm text-blue-700">
                Agora você pode importar arquivos PDF da tabela SIGTAP! 
                O sistema processa automaticamente PDFs com milhares de páginas, 
                extraindo todos os procedimentos e seus valores.
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
              <p>Baixe o arquivo <strong>ZIP</strong> (recomendado) ou <strong>PDF</strong> da versão mais recente</p>
            </div>
            <div className="flex items-start space-x-3">
              <div className="w-6 h-6 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center text-xs font-medium">4</div>
              <p>Selecione o arquivo baixado usando o botão acima</p>
            </div>
            <div className="bg-yellow-50 p-3 rounded-lg mt-4">
              <p className="text-sm text-yellow-800">
                <strong>Dica:</strong> Arquivos ZIP são processados mais rapidamente que PDFs. 
                Para PDFs grandes (4000+ páginas), o processamento pode levar alguns minutos.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default SigtapImport;

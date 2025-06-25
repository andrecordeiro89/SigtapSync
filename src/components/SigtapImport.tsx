
import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Upload, FileText, CheckCircle, AlertCircle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

const SigtapImport = () => {
  const [isUploading, setIsUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [importStatus, setImportStatus] = useState<'idle' | 'processing' | 'success' | 'error'>('idle');
  const { toast } = useToast();

  const simulateImport = async () => {
    setIsUploading(true);
    setImportStatus('processing');
    setProgress(0);

    // Simular progresso de importação
    const steps = [
      { step: 20, message: 'Extraindo arquivo ZIP...' },
      { step: 40, message: 'Convertendo arquivos DBC...' },
      { step: 60, message: 'Processando dados SIGTAP...' },
      { step: 80, message: 'Validando procedimentos...' },
      { step: 100, message: 'Finalizando importação...' }
    ];

    for (const { step, message } of steps) {
      await new Promise(resolve => setTimeout(resolve, 800));
      setProgress(step);
      
      toast({
        title: "Importação em andamento",
        description: message,
      });
    }

    setImportStatus('success');
    setIsUploading(false);
    
    toast({
      title: "Importação concluída",
      description: "Tabela SIGTAP importada com sucesso! 4.256 procedimentos atualizados.",
    });
  };

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      console.log('Arquivo selecionado:', file.name);
      simulateImport();
    }
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
                disabled={isUploading}
              />
              <label htmlFor="sigtap-upload">
                <Button 
                  variant="outline" 
                  className="cursor-pointer"
                  disabled={isUploading}
                  asChild
                >
                  <span>
                    {isUploading ? 'Processando...' : 'Selecionar Arquivo'}
                  </span>
                </Button>
              </label>
            </div>

            {isUploading && (
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span>Progresso da importação:</span>
                  <span>{progress}%</span>
                </div>
                <Progress value={progress} className="w-full" />
              </div>
            )}

            {importStatus === 'success' && (
              <div className="flex items-center space-x-2 text-green-600">
                <CheckCircle className="w-5 h-5" />
                <span className="text-sm">Importação concluída com sucesso!</span>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <FileText className="w-5 h-5 text-green-600" />
              <span>Status da Tabela Atual</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="bg-green-50 p-4 rounded-lg">
              <div className="flex items-center justify-between mb-2">
                <span className="font-medium text-green-800">Tabela Ativa</span>
                <CheckCircle className="w-5 h-5 text-green-600" />
              </div>
              <div className="text-sm text-green-700 space-y-1">
                <p><strong>Versão:</strong> 2024.06.001</p>
                <p><strong>Data de Import.:</strong> 15/06/2024</p>
                <p><strong>Procedimentos:</strong> 4.256</p>
                <p><strong>Última Atualização:</strong> Há 10 dias</p>
              </div>
            </div>

            <div className="border-l-4 border-orange-400 bg-orange-50 p-4">
              <div className="flex items-center space-x-2 mb-2">
                <AlertCircle className="w-5 h-5 text-orange-600" />
                <span className="font-medium text-orange-800">Atenção</span>
              </div>
              <p className="text-sm text-orange-700">
                Uma nova versão da tabela SIGTAP está disponível no site do DATASUS. 
                Recomendamos a atualização mensal.
              </p>
            </div>

            <div className="space-y-2">
              <h4 className="font-medium text-gray-900">Histórico de Importações</h4>
              <div className="text-sm space-y-1">
                <div className="flex justify-between">
                  <span>2024.06.001</span>
                  <span className="text-gray-500">15/06/2024</span>
                </div>
                <div className="flex justify-between">
                  <span>2024.05.001</span>
                  <span className="text-gray-500">15/05/2024</span>
                </div>
                <div className="flex justify-between">
                  <span>2024.04.001</span>
                  <span className="text-gray-500">12/04/2024</span>
                </div>
              </div>
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
              <p>Selecione o arquivo baixado usando o botão "Selecionar Arquivo" acima</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default SigtapImport;

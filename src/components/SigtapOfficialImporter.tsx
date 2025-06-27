/**
 * SIGTAP Official Importer Component
 * Interface para importar dados oficiais do ZIP DATASUS
 */

import React, { useState, useRef } from 'react';
import { Upload, FileText, AlertCircle, CheckCircle, Loader2, Database, Download } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Alert, AlertDescription } from './ui/alert';
import { Progress } from './ui/progress';
import { Badge } from './ui/badge';
import { Separator } from './ui/separator';
import { SigtapOfficialImporter as ImporterService } from '../services/sigtapOfficialImporter';
import { supabase } from '../lib/supabase';

interface ImportStats {
  financiamentos: number;
  modalidades: number;
  procedimentos: number;
  relacionamentos: number;
  errors: number;
  totalLines: number;
}

interface ImportStatus {
  isImporting: boolean;
  progress: number;
  message: string;
  completed: boolean;
  success: boolean;
  stats?: ImportStats;
  errors: string[];
}

export const SigtapOfficialImporter: React.FC = () => {
  const [importStatus, setImportStatus] = useState<ImportStatus>({
    isImporting: false,
    progress: 0,
    message: '',
    completed: false,
    success: false,
    errors: []
  });
  
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const importer = new ImporterService();

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      if (file.name.toLowerCase().endsWith('.zip')) {
        setSelectedFile(file);
        setImportStatus(prev => ({ ...prev, completed: false, errors: [] }));
      } else {
        alert('Por favor, selecione um arquivo ZIP oficial do SIGTAP');
      }
    }
  };

  const handleImport = async () => {
    if (!selectedFile) return;

    setImportStatus({
      isImporting: true,
      progress: 0,
      message: 'Iniciando importação...',
      completed: false,
      success: false,
      errors: []
    });

    try {
      // Criar nova versão com nome único
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const uniqueVersionName = `Oficial_DATASUS_${timestamp}`;
      
      const { data: versionData, error: versionError } = await supabase
        .from('sigtap_versions')
        .insert({
          version_name: uniqueVersionName,
          file_name: selectedFile.name,
          file_size: selectedFile.size,
          file_type: 'zip',
          extraction_method: 'official',
          import_status: 'processing'
        })
        .select()
        .single();

      if (versionError) throw versionError;

      // Importar dados
      const result = await importer.importFromZip(
        selectedFile,
        versionData.id,
        (progress, message) => {
          setImportStatus(prev => ({
            ...prev,
            progress,
            message
          }));
        }
      );

      // Atualizar status da versão
      await supabase
        .from('sigtap_versions')
        .update({
          import_status: result.success ? 'completed' : 'failed',
          import_errors: result.errors.join('; '),
          total_procedures: result.stats.procedimentos,
          processing_time_ms: Date.now() - Date.now(), // Aproximado
          is_active: result.success
        })
        .eq('id', versionData.id);

      setImportStatus({
        isImporting: false,
        progress: 100,
        message: result.success ? 'Importação concluída com sucesso!' : 'Importação falhou',
        completed: true,
        success: result.success,
        stats: result.stats,
        errors: result.errors
      });

    } catch (error) {
      console.error('Erro na importação:', error);
      setImportStatus({
        isImporting: false,
        progress: 0,
        message: 'Erro na importação',
        completed: true,
        success: false,
        errors: [`Erro: ${error.message}`]
      });
    }
  };

  const resetImport = () => {
    setSelectedFile(null);
    setImportStatus({
      isImporting: false,
      progress: 0,
      message: '',
      completed: false,
      success: false,
      errors: []
    });
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Database className="h-8 w-8 text-blue-600" />
        <div>
          <h1 className="text-2xl font-bold">Importador Oficial SIGTAP</h1>
          <p className="text-gray-600">
            Importe dados estruturados oficiais do DATASUS (ZIP)
          </p>
        </div>
      </div>

      {/* Setup Alert */}
      {(!importStatus.completed || importStatus.errors.length > 0) && (
        <Alert className="border-blue-200 bg-blue-50">
          <FileText className="h-4 w-4 text-blue-600" />
          <AlertDescription className="text-blue-800">
            <strong>Primeira vez usando?</strong> Execute no seu Supabase:
            <br />
            1. <code className="bg-blue-100 px-1 rounded">database/sigtap_official_schema.sql</code>
            <br />
            2. <code className="bg-blue-100 px-1 rounded">database/sync_functions.sql</code>
            <br />
            3. <code className="bg-blue-100 px-1 rounded">database/update_extraction_method_constraint.sql</code>
            <br />
            4. <code className="bg-blue-100 px-1 rounded">database/check_official_setup.sql</code> (para verificar)
          </AlertDescription>
        </Alert>
      )}

      {/* Vantagens */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Download className="h-5 w-5" />
            Vantagens dos Dados Oficiais
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
                ✓ 100% Precisão
              </Badge>
              <p className="text-sm text-gray-600">
                Dados estruturados oficiais do DATASUS
              </p>
            </div>
            <div className="space-y-2">
              <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">
                ✓ Sem IA
              </Badge>
              <p className="text-sm text-gray-600">
                Não requer processamento de IA ou Gemini
              </p>
            </div>
            <div className="space-y-2">
              <Badge variant="outline" className="bg-purple-50 text-purple-700 border-purple-200">
                ✓ Relacionamentos Completos
              </Badge>
              <p className="text-sm text-gray-600">
                CIDs, CBOs, modalidades e classificações
              </p>
            </div>
            <div className="space-y-2">
              <Badge variant="outline" className="bg-orange-50 text-orange-700 border-orange-200">
                ✓ Atualizações Automáticas
              </Badge>
              <p className="text-sm text-gray-600">
                Sempre atualizado com a competência mais recente
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Upload */}
      <Card>
        <CardHeader>
          <CardTitle>Selecionar Arquivo ZIP</CardTitle>
          <CardDescription>
            Faça upload do arquivo ZIP oficial do SIGTAP (ex: TabelaUnificada_202504_v2504031832.zip)
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div 
            className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center cursor-pointer hover:border-blue-400 transition-colors"
            onClick={() => fileInputRef.current?.click()}
          >
            <Upload className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            {selectedFile ? (
              <div className="space-y-2">
                <p className="font-medium text-gray-900">{selectedFile.name}</p>
                <p className="text-sm text-gray-500">
                  {(selectedFile.size / 1024 / 1024).toFixed(2)} MB
                </p>
                <Badge variant="outline" className="bg-green-50 text-green-700">
                  Arquivo Selecionado
                </Badge>
              </div>
            ) : (
              <div className="space-y-2">
                <p className="text-lg font-medium text-gray-700">
                  Clique para selecionar o arquivo ZIP
                </p>
                <p className="text-sm text-gray-500">
                  Ou arraste e solte o arquivo aqui
                </p>
              </div>
            )}
          </div>
          
          <input
            ref={fileInputRef}
            type="file"
            accept=".zip"
            onChange={handleFileSelect}
            className="hidden"
          />
          
          <div className="flex gap-2">
            <Button 
              onClick={handleImport}
              disabled={!selectedFile || importStatus.isImporting}
              className="flex-1"
            >
              {importStatus.isImporting ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Importando...
                </>
              ) : (
                <>
                  <Database className="h-4 w-4 mr-2" />
                  Iniciar Importação
                </>
              )}
            </Button>
            
            <Button variant="outline" onClick={resetImport}>
              Limpar
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Progress */}
      {importStatus.isImporting && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Loader2 className="h-5 w-5 animate-spin" />
              Importação em Andamento
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span>{importStatus.message}</span>
                <span>{importStatus.progress}%</span>
              </div>
              <Progress value={importStatus.progress} className="w-full" />
            </div>
          </CardContent>
        </Card>
      )}

      {/* Results */}
      {importStatus.completed && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              {importStatus.success ? (
                <CheckCircle className="h-5 w-5 text-green-600" />
              ) : (
                <AlertCircle className="h-5 w-5 text-red-600" />
              )}
              Resultado da Importação
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {importStatus.success ? (
              <Alert className="border-green-200 bg-green-50">
                <CheckCircle className="h-4 w-4 text-green-600" />
                <AlertDescription className="text-green-800">
                  Importação concluída com sucesso! Os dados oficiais foram importados para o banco de dados.
                </AlertDescription>
              </Alert>
            ) : (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  A importação falhou. Verifique os erros abaixo.
                </AlertDescription>
              </Alert>
            )}

            {/* Estatísticas */}
            {importStatus.stats && (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="text-center p-3 bg-blue-50 rounded-lg">
                  <div className="text-2xl font-bold text-blue-600">
                    {importStatus.stats.procedimentos.toLocaleString()}
                  </div>
                  <div className="text-sm text-blue-800">Procedimentos</div>
                </div>
                <div className="text-center p-3 bg-green-50 rounded-lg">
                  <div className="text-2xl font-bold text-green-600">
                    {importStatus.stats.financiamentos}
                  </div>
                  <div className="text-sm text-green-800">Financiamentos</div>
                </div>
                <div className="text-center p-3 bg-purple-50 rounded-lg">
                  <div className="text-2xl font-bold text-purple-600">
                    {importStatus.stats.modalidades}
                  </div>
                  <div className="text-sm text-purple-800">Modalidades</div>
                </div>
                <div className="text-center p-3 bg-orange-50 rounded-lg">
                  <div className="text-2xl font-bold text-orange-600">
                    {importStatus.stats.errors}
                  </div>
                  <div className="text-sm text-orange-800">Erros</div>
                </div>
              </div>
            )}

            {/* Erros */}
            {importStatus.errors.length > 0 && (
              <div className="space-y-2">
                <h4 className="font-medium text-red-800">Erros Encontrados:</h4>
                <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                  {importStatus.errors.map((error, index) => (
                    <div key={index} className="text-sm text-red-700">
                      • {error}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Instruções */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Como Obter o Arquivo ZIP Oficial
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-3">
            <div className="flex items-start gap-3">
              <div className="bg-blue-100 text-blue-800 rounded-full w-6 h-6 flex items-center justify-center text-sm font-medium">
                1
              </div>
              <div>
                <p className="font-medium">Acesse o FTP DATASUS</p>
                <p className="text-sm text-gray-600">
                  ftp://ftp.datasus.gov.br/dissemin/publicos/SIGTAP/
                </p>
              </div>
            </div>
            
            <div className="flex items-start gap-3">
              <div className="bg-blue-100 text-blue-800 rounded-full w-6 h-6 flex items-center justify-center text-sm font-medium">
                2
              </div>
              <div>
                <p className="font-medium">Navegue até a pasta da competência</p>
                <p className="text-sm text-gray-600">
                  Exemplo: 202504 (Abril de 2025)
                </p>
              </div>
            </div>
            
            <div className="flex items-start gap-3">
              <div className="bg-blue-100 text-blue-800 rounded-full w-6 h-6 flex items-center justify-center text-sm font-medium">
                3
              </div>
              <div>
                <p className="font-medium">Baixe o arquivo TabelaUnificada</p>
                <p className="text-sm text-gray-600">
                  Formato: TabelaUnificada_YYYYMM_vYYMMDDHHMM.zip
                </p>
              </div>
            </div>
          </div>
          
          <Separator />
          
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
            <div className="flex items-center gap-2 mb-2">
              <AlertCircle className="h-4 w-4 text-amber-600" />
              <span className="font-medium text-amber-800">Dica Importante</span>
            </div>
            <p className="text-sm text-amber-700">
              O arquivo ZIP contém dados estruturados com layouts oficiais. 
              Esta importação substituirá os dados atuais do SIGTAP por dados 100% precisos.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}; 
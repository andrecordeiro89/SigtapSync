import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Badge } from './ui/badge';
import { Alert, AlertDescription } from './ui/alert';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from './ui/table';
import { 
  Upload, 
  FileSpreadsheet, 
  CheckCircle, 
  AlertCircle, 
  Trash2, 
  Download,
  Calendar,
  Clock,
  Users,
  Activity,
  RefreshCw,
  Building2,
  Info
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { HospitalDischargeService, HospitalDischarge } from '../services/hospitalDischargeService';
import { supabase } from '../lib/supabase';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

const HospitalDischargesManager = () => {
  const { user } = useAuth();
  const [file, setFile] = useState<File | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [discharges, setDischarges] = useState<HospitalDischarge[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [stats, setStats] = useState({ totalDischarges: 0, todayDischarges: 0, averageStayDuration: 'N/A' });
  const [isLoading, setIsLoading] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [hospitalName, setHospitalName] = useState<string>('Carregando...');
  const itemsPerPage = 20;

  const hospitalId = user?.hospital_id;

  // Carregar nome do hospital
  useEffect(() => {
    const loadHospitalName = async () => {
      if (!hospitalId || hospitalId === 'ALL') {
        setHospitalName('Todos os Hospitais');
        return;
      }

      try {
        const { data, error } = await supabase
          .from('hospitals')
          .select('name')
          .eq('id', hospitalId)
          .single();

        if (error) {
          console.error('Erro ao buscar nome do hospital:', error);
          setHospitalName(hospitalId);
        } else {
          setHospitalName(data.name || hospitalId);
        }
      } catch (error) {
        console.error('Erro ao carregar hospital:', error);
        setHospitalName(hospitalId);
      }
    };

    loadHospitalName();
  }, [hospitalId]);

  // Carregar dados ao montar componente
  useEffect(() => {
    if (hospitalId && hospitalId !== 'ALL') {
      loadDischarges();
      loadStats();
    }
  }, [hospitalId, currentPage]);

  // Carregar altas do banco
  const loadDischarges = async () => {
    if (!hospitalId || hospitalId === 'ALL') return;

    setIsLoading(true);
    try {
      const { data, count } = await HospitalDischargeService.getDischargesByHospital(hospitalId, {
        limit: itemsPerPage,
        offset: (currentPage - 1) * itemsPerPage
      });

      setDischarges(data);
      setTotalCount(count);
    } catch (error) {
      console.error('Erro ao carregar altas:', error);
      toast.error('Erro ao carregar dados');
    } finally {
      setIsLoading(false);
    }
  };

  // Carregar estatísticas
  const loadStats = async () => {
    if (!hospitalId || hospitalId === 'ALL') return;

    try {
      const statsData = await HospitalDischargeService.getStats(hospitalId);
      setStats(statsData);
    } catch (error) {
      console.error('Erro ao carregar estatísticas:', error);
    }
  };

  // Handler para seleção de arquivo
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      // Validar tipo de arquivo
      if (
        !selectedFile.name.endsWith('.xlsx') &&
        !selectedFile.name.endsWith('.xls')
      ) {
        toast.error('Por favor, selecione um arquivo Excel (.xlsx ou .xls)');
        return;
      }
      setFile(selectedFile);
    }
  };

  // Processar arquivo
  const handleUpload = async () => {
    if (!file) {
      toast.error('Selecione um arquivo primeiro');
      return;
    }

    if (!hospitalId || hospitalId === 'ALL') {
      toast.error('Hospital não identificado');
      return;
    }

    if (!user?.id) {
      toast.error('Usuário não autenticado');
      return;
    }

    setIsProcessing(true);
    const loadingToast = toast.loading('Processando arquivo Excel...');

    try {
      const result = await HospitalDischargeService.processExcelFile(
        file,
        hospitalId,
        user.id
      );

      toast.dismiss(loadingToast);

      if (result.success) {
        toast.success(
          `✅ ${result.importedRecords} altas importadas com sucesso!`,
          {
            description: result.errors.length > 0
              ? `${result.errors.length} avisos encontrados`
              : 'Todos os registros foram processados'
          }
        );

        // Limpar arquivo e recarregar dados
        setFile(null);
        await loadDischarges();
        await loadStats();
      } else {
        toast.error('Erro ao processar arquivo', {
          description: result.errors[0] || 'Verifique o formato do arquivo'
        });
      }
    } catch (error) {
      toast.dismiss(loadingToast);
      toast.error('Erro ao processar arquivo', {
        description: error instanceof Error ? error.message : 'Erro desconhecido'
      });
    } finally {
      setIsProcessing(false);
    }
  };

  // Deletar registro
  const handleDelete = async (id: string) => {
    if (!confirm('Deseja realmente excluir este registro?')) return;

    const success = await HospitalDischargeService.deleteDischarge(id);
    if (success) {
      toast.success('Registro excluído com sucesso');
      await loadDischarges();
      await loadStats();
    } else {
      toast.error('Erro ao excluir registro');
    }
  };

  // Formatar data
  const formatDate = (dateStr: string) => {
    try {
      return format(new Date(dateStr), "dd/MM/yyyy HH:mm", { locale: ptBR });
    } catch {
      return dateStr;
    }
  };

  // Verificar acesso
  if (!hospitalId || hospitalId === 'ALL') {
    return (
      <Card>
        <CardContent className="p-8 text-center">
          <AlertCircle className="h-12 w-12 text-orange-500 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">Hospital Não Selecionado</h3>
          <p className="text-gray-500">
            Por favor, selecione um hospital específico para gerenciar altas.
          </p>
        </CardContent>
      </Card>
    );
  }

  const totalPages = Math.ceil(totalCount / itemsPerPage);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-gradient-to-r from-blue-600 to-indigo-600 rounded-lg p-6 text-white">
        <div className="flex items-center gap-3">
          <FileSpreadsheet className="h-8 w-8" />
          <div>
            <h1 className="text-2xl font-bold">Gestão de Altas Hospitalares</h1>
            <p className="text-blue-100">Importação e visualização de altas do sistema hospitalar</p>
          </div>
        </div>
      </div>

      {/* Contexto */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Building2 className="h-5 w-5" />
            Contexto Atual
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <p className="text-sm text-gray-500">Hospital</p>
              <p className="font-medium">{hospitalName}</p>
            </div>
            <div>
              <p className="text-sm text-gray-500">Usuário</p>
              <p className="font-medium">{user?.full_name || user?.email}</p>
            </div>
            <div>
              <p className="text-sm text-gray-500">Status</p>
              <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
                <CheckCircle className="h-3 w-3 mr-1" />
                Ativo
              </Badge>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Estatísticas */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Users className="h-4 w-4 text-blue-600" />
              Total de Altas
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-blue-600">{stats.totalDischarges}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Activity className="h-4 w-4 text-green-600" />
              Altas Hoje
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-green-600">{stats.todayDischarges}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Clock className="h-4 w-4 text-purple-600" />
              Permanência Média
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-purple-600">{stats.averageStayDuration}</p>
          </CardContent>
        </Card>
      </div>

      {/* Upload de Arquivo */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Upload className="h-5 w-5" />
            Importar Arquivo Excel
          </CardTitle>
          <CardDescription>
            Selecione o arquivo Excel exportado do sistema hospitalar
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Instruções */}
          <Alert>
            <Info className="h-4 w-4" />
            <AlertDescription className="text-sm">
              <strong>Formato esperado:</strong> O arquivo pode conter as colunas na linha 4:
              <br />
              LEITO, PACIENTE, <span className="text-gray-400 line-through">CNS/CPF (ignorada)</span>, ID PRONTUÁRIO, DATA ENTRADA, DATA SAÍDA, DURAÇÃO, RESPONSÁVEL, USUÁRIO FINALIZAÇÃO, STATUS, JUSTIFICATIVA/OBSERVAÇÃO
              <br />
              <span className="text-xs text-gray-500 mt-1 block">💡 A coluna CNS/CPF será ignorada automaticamente se existir no arquivo.</span>
            </AlertDescription>
          </Alert>

          {/* Input de arquivo */}
          <div className="flex items-center gap-3">
            <Input
              type="file"
              accept=".xlsx,.xls"
              onChange={handleFileChange}
              disabled={isProcessing}
              className="flex-1"
            />
            <Button
              onClick={handleUpload}
              disabled={!file || isProcessing}
              className="min-w-[120px]"
            >
              {isProcessing ? (
                <>
                  <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                  Processando...
                </>
              ) : (
                <>
                  <Upload className="h-4 w-4 mr-2" />
                  Importar
                </>
              )}
            </Button>
          </div>

          {file && (
            <div className="flex items-center gap-2 text-sm text-gray-600">
              <FileSpreadsheet className="h-4 w-4" />
              <span>{file.name}</span>
              <Badge variant="outline">{(file.size / 1024).toFixed(1)} KB</Badge>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Tabela de Dados */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Calendar className="h-5 w-5" />
              Altas Registradas
            </CardTitle>
            <Button
              variant="outline"
              size="sm"
              onClick={loadDischarges}
              disabled={isLoading}
            >
              <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
              Atualizar
            </Button>
          </div>
          <CardDescription>
            Total de {totalCount} registros
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center py-8">
              <RefreshCw className="h-8 w-8 animate-spin mx-auto text-gray-400 mb-2" />
              <p className="text-gray-500">Carregando dados...</p>
            </div>
          ) : discharges.length === 0 ? (
            <div className="text-center py-8">
              <FileSpreadsheet className="h-12 w-12 text-gray-300 mx-auto mb-3" />
              <p className="text-gray-500">Nenhuma alta registrada ainda</p>
              <p className="text-sm text-gray-400 mt-1">Importe um arquivo Excel para começar</p>
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Leito</TableHead>
                      <TableHead>Paciente</TableHead>
                      <TableHead>ID Prontuário</TableHead>
                      <TableHead>Entrada</TableHead>
                      <TableHead>Saída</TableHead>
                      <TableHead>Duração</TableHead>
                      <TableHead>Responsável</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {discharges.map((discharge) => (
                      <TableRow key={discharge.id}>
                        <TableCell className="font-medium">{discharge.leito || '-'}</TableCell>
                        <TableCell className="max-w-[200px] truncate">{discharge.paciente}</TableCell>
                        <TableCell className="text-sm font-mono">{discharge.id_prontuario || '-'}</TableCell>
                        <TableCell className="text-sm">{formatDate(discharge.data_entrada)}</TableCell>
                        <TableCell className="text-sm">{formatDate(discharge.data_saida)}</TableCell>
                        <TableCell className="text-sm">{discharge.duracao || '-'}</TableCell>
                        <TableCell className="text-sm">{discharge.responsavel || '-'}</TableCell>
                        <TableCell>
                          <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
                            {discharge.status}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => discharge.id && handleDelete(discharge.id)}
                            className="text-red-600 hover:text-red-700 hover:bg-red-50"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              {/* Paginação */}
              {totalPages > 1 && (
                <div className="flex items-center justify-between mt-4 pt-4 border-t">
                  <p className="text-sm text-gray-500">
                    Página {currentPage} de {totalPages}
                  </p>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                      disabled={currentPage === 1}
                    >
                      Anterior
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                      disabled={currentPage === totalPages}
                    >
                      Próxima
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default HospitalDischargesManager;


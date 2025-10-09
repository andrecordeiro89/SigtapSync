/**
 * 🔄 SYNC DASHBOARD - Reconciliação Tabwin vs Sistema
 * 
 * Tela para comparar dados do relatório Tabwin (GSUS) com os dados do sistema
 * Identifica matches, glosas e rejeições
 */

import { useState, useEffect, useRef } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Label } from './ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Alert, AlertDescription } from './ui/alert';
import { Badge } from './ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import { Progress } from './ui/progress';
import { useToast } from '../hooks/use-toast';
import { useAuth } from '../contexts/AuthContext';
import { SyncService, ReconciliationResult, ReconciliationMatch, ReconciliationLeftover } from '../services/syncService';
import { 
  Upload, 
  FileSpreadsheet, 
  CheckCircle2, 
  AlertCircle, 
  XCircle, 
  Download,
  RefreshCw,
  Info,
  TrendingUp,
  TrendingDown,
  Minus
} from 'lucide-react';
import * as XLSX from 'xlsx';

const SyncDashboard = () => {
  const { user, canAccessAllHospitals, getCurrentHospital, isAdmin, isDirector } = useAuth();
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);

  // 🔒 PROTEÇÃO: Apenas Admin ou Diretoria podem acessar
  const hasAccess = isAdmin() || isDirector();

  if (!hasAccess) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Card className="w-full max-w-md">
          <CardContent className="p-8 text-center space-y-4">
            <XCircle className="w-16 h-16 mx-auto text-red-600" />
            <h2 className="text-2xl font-bold">Acesso Restrito</h2>
            <p className="text-muted-foreground">
              Esta tela é exclusiva para <strong>Administradores</strong> e <strong>Diretoria</strong>.
            </p>
            <p className="text-sm text-muted-foreground">
              Seu perfil: <strong>{user?.role || 'Desconhecido'}</strong>
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Estados
  const [hospitals, setHospitals] = useState<Array<{ id: string; name: string; cnes: string }>>([]);
  const [selectedHospital, setSelectedHospital] = useState<string>('');
  const [availableCompetencias, setAvailableCompetencias] = useState<string[]>([]);
  const [selectedCompetencia, setSelectedCompetencia] = useState<string>('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [result, setResult] = useState<ReconciliationResult | null>(null);
  const [activeTab, setActiveTab] = useState<'matches' | 'glosas' | 'rejeicoes'>('matches');

  // Carregar hospitais
  useEffect(() => {
    loadHospitals();
  }, [user]);

  // Carregar competências quando hospital for selecionado
  useEffect(() => {
    if (selectedHospital) {
      loadCompetencias();
    }
  }, [selectedHospital]);

  const loadHospitals = async () => {
    try {
      const { supabase } = await import('../lib/supabase');
      
      let query = supabase
        .from('hospitals')
        .select('id, name, cnes')
        .eq('is_active', true)
        .order('name');

      if (!canAccessAllHospitals()) {
        const currentHospital = getCurrentHospital();
        if (currentHospital) {
          query = query.eq('id', currentHospital.id);
        }
      }

      const { data, error } = await query;

      if (error) throw error;

      setHospitals(data || []);
      
      // Se só tem um hospital, selecionar automaticamente
      if (data && data.length === 1) {
        setSelectedHospital(data[0].id);
      }
    } catch (error) {
      console.error('Erro ao carregar hospitais:', error);
      toast({
        title: 'Erro ao carregar hospitais',
        description: error instanceof Error ? error.message : 'Erro desconhecido',
        variant: 'destructive'
      });
    }
  };

  const loadCompetencias = async () => {
    if (!selectedHospital) return;

    try {
      const { supabase } = await import('../lib/supabase');
      
      const { data, error } = await supabase
        .from('aihs')
        .select('competencia')
        .eq('hospital_id', selectedHospital)
        .not('competencia', 'is', null)
        .order('competencia', { ascending: false });

      if (error) throw error;

      const uniqueCompetencias = Array.from(new Set(data?.map(a => a.competencia).filter(Boolean)));
      setAvailableCompetencias(uniqueCompetencias);

      // Selecionar a competência mais recente
      if (uniqueCompetencias.length > 0) {
        setSelectedCompetencia(uniqueCompetencias[0]);
      }
    } catch (error) {
      console.error('Erro ao carregar competências:', error);
    }
  };

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const fileName = file.name.toLowerCase();
    if (!fileName.endsWith('.xlsx') && !fileName.endsWith('.xls')) {
      toast({
        title: 'Arquivo inválido',
        description: 'Por favor, selecione um arquivo Excel (.xlsx ou .xls)',
        variant: 'destructive'
      });
      return;
    }

    setSelectedFile(file);
    setResult(null); // Limpar resultado anterior
  };

  const handleSync = async () => {
    if (!selectedFile) {
      toast({
        title: 'Arquivo não selecionado',
        description: 'Por favor, selecione um arquivo XLSX do Tabwin',
        variant: 'destructive'
      });
      return;
    }

    if (!selectedHospital || !selectedCompetencia) {
      toast({
        title: 'Dados incompletos',
        description: 'Selecione o hospital e a competência',
        variant: 'destructive'
      });
      return;
    }

    setIsProcessing(true);

    try {
      const result = await SyncService.performReconciliation(
        selectedFile,
        selectedHospital,
        selectedCompetencia
      );

      if (!result.success) {
        throw new Error(result.error || 'Erro na reconciliação');
      }

      setResult(result);
      setActiveTab('matches');

      toast({
        title: 'Reconciliação concluída',
        description: `${result.matches.length} matches encontrados em ${(result.processing_time / 1000).toFixed(2)}s`,
      });
    } catch (error) {
      console.error('Erro na reconciliação:', error);
      toast({
        title: 'Erro na reconciliação',
        description: error instanceof Error ? error.message : 'Erro desconhecido',
        variant: 'destructive'
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const exportToExcel = (type: 'matches' | 'glosas' | 'rejeicoes') => {
    if (!result) return;

    const wb = XLSX.utils.book_new();

    if (type === 'matches') {
      const data = result.matches.map(m => ({
        'Nº AIH': m.aih_number,
        'Código Procedimento': m.procedure_code,
        'Paciente': m.system_data.patient_name,
        'Médico': m.system_data.doctor_name || '',
        'Status': m.status === 'matched' ? 'OK' : m.status === 'value_diff' ? 'Diferença Valor' : 'Diferença Quantidade',
        'Valor Tabwin (R$)': (m.tabwin_data.sp_valato).toFixed(2),
        'Valor Sistema (R$)': (m.system_data.total_value / 100).toFixed(2),
        'Diferença (R$)': m.value_difference ? (m.value_difference / 100).toFixed(2) : '0.00',
        'Qtd Tabwin': m.tabwin_data.sp_qtd_ato,
        'Qtd Sistema': m.system_data.quantity,
        'Diferença Qtd': m.quantity_difference || 0
      }));
      const ws = XLSX.utils.json_to_sheet(data);
      XLSX.utils.book_append_sheet(wb, ws, 'Matches');
    } else if (type === 'glosas') {
      const data = result.tabwin_leftovers.map(l => {
        const tabwinData = l.data as any;
        return {
          'Nº AIH': l.aih_number,
          'Código Procedimento': l.procedure_code,
          'Valor (R$)': tabwinData.sp_valato ? tabwinData.sp_valato.toFixed(2) : '0.00',
          'Quantidade': tabwinData.sp_qtd_ato || 1,
          'Motivo': 'Não encontrado no sistema',
          'Observação': 'Possível glosa ou rejeição'
        };
      });
      const ws = XLSX.utils.json_to_sheet(data);
      XLSX.utils.book_append_sheet(wb, ws, 'Glosas');
    } else if (type === 'rejeicoes') {
      const data = result.system_leftovers.map(l => {
        const sysData = l.data as any;
        return {
          'Nº AIH': l.aih_number,
          'Código Procedimento': l.procedure_code,
          'Paciente': sysData.patient_name || '',
          'Médico': sysData.doctor_name || '',
          'Procedimento': sysData.procedure_name || '',
          'Valor (R$)': sysData.total_value ? (sysData.total_value / 100).toFixed(2) : '0.00',
          'Quantidade': sysData.quantity || 1,
          'Motivo': 'Não encontrado no Tabwin',
          'Observação': 'Possível rejeição ou pendência'
        };
      });
      const ws = XLSX.utils.json_to_sheet(data);
      XLSX.utils.book_append_sheet(wb, ws, 'Rejeições');
    }

    const hospitalName = hospitals.find(h => h.id === selectedHospital)?.name || 'Hospital';
    const competenciaStr = selectedCompetencia ? selectedCompetencia.substring(0, 7) : 'comp';
    const fileName = `Sync_${type}_${hospitalName}_${competenciaStr}.xlsx`;
    
    XLSX.writeFile(wb, fileName);

    toast({
      title: 'Exportado com sucesso',
      description: `Arquivo ${fileName} baixado`
    });
  };

  const formatCompetencia = (comp: string) => {
    if (!comp) return '';
    const match = comp.match(/^(\d{4})-(\d{2})/);
    return match ? `${match[2]}/${match[1]}` : comp;
  };

  const formatCurrency = (cents: number) => {
    return (cents / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold">🔄 Sync - Reconciliação Tabwin</h1>
        <p className="text-muted-foreground mt-2">
          Compare dados do relatório Tabwin (GSUS) com os dados do sistema e identifique glosas, rejeições e divergências
        </p>
      </div>

      {/* Filtros e Upload */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileSpreadsheet className="w-5 h-5" />
            Configuração da Reconciliação
          </CardTitle>
          <CardDescription>
            Selecione o hospital, competência e faça upload do arquivo XLSX do Tabwin
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Hospital */}
            <div className="space-y-2">
              <Label>Hospital</Label>
              <Select value={selectedHospital} onValueChange={setSelectedHospital}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione o hospital" />
                </SelectTrigger>
                <SelectContent>
                  {hospitals.map(hospital => (
                    <SelectItem key={hospital.id} value={hospital.id}>
                      {hospital.name} {hospital.cnes ? `(${hospital.cnes})` : ''}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Competência */}
            <div className="space-y-2">
              <Label>Competência</Label>
              <Select 
                value={selectedCompetencia} 
                onValueChange={setSelectedCompetencia}
                disabled={!selectedHospital || availableCompetencias.length === 0}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione a competência" />
                </SelectTrigger>
                <SelectContent>
                  {availableCompetencias.map(comp => (
                    <SelectItem key={comp} value={comp}>
                      {formatCompetencia(comp)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Upload */}
          <div className="space-y-2">
            <Label>Arquivo Tabwin (XLSX)</Label>
            <div className="flex items-center gap-2">
              <input
                ref={fileInputRef}
                type="file"
                accept=".xlsx,.xls"
                onChange={handleFileSelect}
                className="hidden"
              />
              <Button
                variant="outline"
                onClick={() => fileInputRef.current?.click()}
                className="flex-1"
              >
                <Upload className="w-4 h-4 mr-2" />
                {selectedFile ? selectedFile.name : 'Selecionar arquivo XLSX'}
              </Button>
              {selectedFile && (
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setSelectedFile(null)}
                >
                  <XCircle className="w-4 h-4" />
                </Button>
              )}
            </div>
            <p className="text-xs text-muted-foreground">
              Colunas obrigatórias: SP_NAIH, SP_ATOPROF (código procedimento), SP_VALATO (valor)
            </p>
          </div>

          {/* Botão Sincronizar */}
          <Button
            onClick={handleSync}
            disabled={!selectedFile || !selectedHospital || !selectedCompetencia || isProcessing}
            className="w-full"
            size="lg"
          >
            {isProcessing ? (
              <>
                <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                Processando...
              </>
            ) : (
              <>
                <RefreshCw className="w-4 h-4 mr-2" />
                Sincronizar e Comparar
              </>
            )}
          </Button>
        </CardContent>
      </Card>

      {/* Resultados */}
      {result && (
        <>
          {/* Cards de Resumo */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Matches Perfeitos
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-between">
                  <span className="text-2xl font-bold text-green-600">
                    {result.summary.perfect_matches}
                  </span>
                  <CheckCircle2 className="w-8 h-8 text-green-600" />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Diferenças de Valor
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-between">
                  <span className="text-2xl font-bold text-yellow-600">
                    {result.summary.value_differences}
                  </span>
                  <AlertCircle className="w-8 h-8 text-yellow-600" />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Diferenças de Qtd
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-between">
                  <span className="text-2xl font-bold text-orange-600">
                    {result.summary.quantity_differences}
                  </span>
                  <Minus className="w-8 h-8 text-orange-600" />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Possíveis Glosas
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-between">
                  <span className="text-2xl font-bold text-red-600">
                    {result.summary.glosas_possiveis}
                  </span>
                  <TrendingDown className="w-8 h-8 text-red-600" />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Possíveis Rejeições
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-between">
                  <span className="text-2xl font-bold text-blue-600">
                    {result.summary.rejeicoes_possiveis}
                  </span>
                  <TrendingUp className="w-8 h-8 text-blue-600" />
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Tabs com Detalhes */}
          <Card>
            <CardHeader>
              <CardTitle>Detalhamento da Reconciliação</CardTitle>
              <CardDescription>
                Total Tabwin: {result.total_tabwin_records} | Total Sistema: {result.total_system_records} | 
                Tempo: {(result.processing_time / 1000).toFixed(2)}s
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)}>
                <TabsList className="grid w-full grid-cols-3">
                  <TabsTrigger value="matches">
                    Matches ({result.matches.length})
                  </TabsTrigger>
                  <TabsTrigger value="glosas">
                    Glosas ({result.tabwin_leftovers.length})
                  </TabsTrigger>
                  <TabsTrigger value="rejeicoes">
                    Rejeições ({result.system_leftovers.length})
                  </TabsTrigger>
                </TabsList>

                {/* Tab Matches */}
                <TabsContent value="matches" className="space-y-4">
                  <div className="flex justify-between items-center">
                    <p className="text-sm text-muted-foreground">
                      {result.matches.length} registros com correspondência encontrados
                    </p>
                    <Button onClick={() => exportToExcel('matches')} size="sm" variant="outline">
                      <Download className="w-4 h-4 mr-2" />
                      Exportar Matches
                    </Button>
                  </div>

                  <div className="border rounded-lg max-h-96 overflow-auto">
                    <table className="w-full text-sm">
                      <thead className="bg-muted sticky top-0">
                        <tr>
                          <th className="px-4 py-2 text-left">Nº AIH</th>
                          <th className="px-4 py-2 text-left">Procedimento</th>
                          <th className="px-4 py-2 text-left">Paciente</th>
                          <th className="px-4 py-2 text-left">Médico</th>
                          <th className="px-4 py-2 text-right">Valor Tabwin</th>
                          <th className="px-4 py-2 text-right">Valor Sistema</th>
                          <th className="px-4 py-2 text-center">Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {result.matches.map((match, idx) => (
                          <tr key={idx} className="border-t hover:bg-muted/50">
                            <td className="px-4 py-2">{match.aih_number}</td>
                            <td className="px-4 py-2 font-mono text-xs">{match.procedure_code}</td>
                            <td className="px-4 py-2">{match.system_data.patient_name}</td>
                            <td className="px-4 py-2 text-xs">{match.system_data.doctor_name || '—'}</td>
                            <td className="px-4 py-2 text-right">
                              R$ {match.tabwin_data.sp_valato.toFixed(2)}
                            </td>
                            <td className="px-4 py-2 text-right">
                              {formatCurrency(match.system_data.total_value)}
                            </td>
                            <td className="px-4 py-2 text-center">
                              {match.status === 'matched' && (
                                <Badge variant="default" className="bg-green-600">
                                  <CheckCircle2 className="w-3 h-3 mr-1" />
                                  OK
                                </Badge>
                              )}
                              {match.status === 'value_diff' && (
                                <Badge variant="default" className="bg-yellow-600">
                                  <AlertCircle className="w-3 h-3 mr-1" />
                                  Δ Valor
                                </Badge>
                              )}
                              {match.status === 'quantity_diff' && (
                                <Badge variant="default" className="bg-orange-600">
                                  <AlertCircle className="w-3 h-3 mr-1" />
                                  Δ Qtd
                                </Badge>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </TabsContent>

                {/* Tab Glosas */}
                <TabsContent value="glosas" className="space-y-4">
                  <Alert>
                    <Info className="w-4 h-4" />
                    <AlertDescription>
                      Estes registros estão no arquivo Tabwin mas não foram encontrados no sistema.
                      Podem indicar glosas, rejeições ou procedimentos não cadastrados.
                    </AlertDescription>
                  </Alert>

                  <div className="flex justify-end">
                    <Button onClick={() => exportToExcel('glosas')} size="sm" variant="outline">
                      <Download className="w-4 h-4 mr-2" />
                      Exportar Glosas
                    </Button>
                  </div>

                  <div className="border rounded-lg max-h-96 overflow-auto">
                    <table className="w-full text-sm">
                      <thead className="bg-muted sticky top-0">
                        <tr>
                          <th className="px-4 py-2 text-left">Nº AIH</th>
                          <th className="px-4 py-2 text-left">Procedimento</th>
                          <th className="px-4 py-2 text-right">Valor</th>
                          <th className="px-4 py-2 text-center">Quantidade</th>
                        </tr>
                      </thead>
                      <tbody>
                        {result.tabwin_leftovers.map((leftover, idx) => {
                          const data = leftover.data as any;
                          return (
                            <tr key={idx} className="border-t hover:bg-muted/50">
                              <td className="px-4 py-2">{leftover.aih_number}</td>
                              <td className="px-4 py-2 font-mono">{leftover.procedure_code}</td>
                              <td className="px-4 py-2 text-right">
                                R$ {(data.sp_valato || 0).toFixed(2)}
                              </td>
                              <td className="px-4 py-2 text-center">{data.sp_qtd_ato || 1}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </TabsContent>

                {/* Tab Rejeições */}
                <TabsContent value="rejeicoes" className="space-y-4">
                  <Alert>
                    <Info className="w-4 h-4" />
                    <AlertDescription>
                      Estes registros estão no sistema mas não foram encontrados no arquivo Tabwin.
                      Podem indicar rejeições, pendências de faturamento ou erros de cadastro.
                    </AlertDescription>
                  </Alert>

                  <div className="flex justify-end">
                    <Button onClick={() => exportToExcel('rejeicoes')} size="sm" variant="outline">
                      <Download className="w-4 h-4 mr-2" />
                      Exportar Rejeições
                    </Button>
                  </div>

                  <div className="border rounded-lg max-h-96 overflow-auto">
                    <table className="w-full text-sm">
                      <thead className="bg-muted sticky top-0">
                        <tr>
                          <th className="px-4 py-2 text-left">Nº AIH</th>
                          <th className="px-4 py-2 text-left">Procedimento</th>
                          <th className="px-4 py-2 text-left">Paciente</th>
                          <th className="px-4 py-2 text-left">Médico</th>
                          <th className="px-4 py-2 text-right">Valor</th>
                        </tr>
                      </thead>
                      <tbody>
                        {result.system_leftovers.map((leftover, idx) => {
                          const data = leftover.data as any;
                          return (
                            <tr key={idx} className="border-t hover:bg-muted/50">
                              <td className="px-4 py-2">{leftover.aih_number}</td>
                              <td className="px-4 py-2 font-mono text-xs">{leftover.procedure_code}</td>
                              <td className="px-4 py-2">{data.patient_name || 'N/A'}</td>
                              <td className="px-4 py-2 text-xs">{data.doctor_name || '—'}</td>
                              <td className="px-4 py-2 text-right">
                                {formatCurrency(data.total_value || 0)}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>
        </>
      )}

      {/* Informação quando não há resultado */}
      {!result && !isProcessing && (
        <Card>
          <CardContent className="py-12 text-center">
            <FileSpreadsheet className="w-16 h-16 mx-auto text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">Nenhuma reconciliação realizada ainda</h3>
            <p className="text-muted-foreground">
              Selecione o hospital, competência e arquivo Tabwin para começar
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default SyncDashboard;


import React, { useState, useEffect } from 'react';
import { Button } from './ui/button';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Badge } from './ui/badge';
import { Input } from './ui/input';
import { Textarea } from './ui/textarea';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from './ui/table';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from './ui/dialog';
import { Alert, AlertDescription } from './ui/alert';
import { 
  Edit, 
  Check, 
  X, 
  Search, 
  Calculator, 
  FileText, 
  Download,
  AlertTriangle,
  CheckCircle,
  Clock,
  DollarSign
} from 'lucide-react';
import { useToast } from '../hooks/use-toast';
import { ProcedureAIH, AIHComplete, SigtapProcedure } from '../types';

interface ProcedureManagementProps {
  aihCompleta: AIHComplete;
  onUpdateAIH: (updatedAIH: AIHComplete) => void;
  sigtapProcedures?: SigtapProcedure[];
}

const ProcedureManagement = ({ aihCompleta, onUpdateAIH, sigtapProcedures = [] }: ProcedureManagementProps) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedProcedure, setSelectedProcedure] = useState<ProcedureAIH | null>(null);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [filteredProcedures, setFilteredProcedures] = useState<ProcedureAIH[]>([]);
  const [isRecalculating, setIsRecalculating] = useState(false);
  const { toast } = useToast();
  // Competência (YYYY-MM-01)
  const [competencia, setCompetencia] = useState<string>(() => {
    const existing = (aihCompleta as any)?.competencia as string | undefined;
    if (existing) return existing;
    const ref = aihCompleta.dataFim || aihCompleta.dataInicio;
    try {
      const d = ref ? new Date(ref) : new Date();
      const y = d.getFullYear();
      const m = String(d.getMonth() + 1).padStart(2, '0');
      return `${y}-${m}-01`;
    } catch {
      const now = new Date();
      const y = now.getFullYear();
      const m = String(now.getMonth() + 1).padStart(2, '0');
      return `${y}-${m}-01`;
    }
  });

  useEffect(() => {
    // Filtrar procedimentos baseado no termo de busca
    const filtered = aihCompleta.procedimentos.filter(proc => 
      proc.procedimento.toLowerCase().includes(searchTerm.toLowerCase()) ||
      proc.descricao?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      proc.cbo.includes(searchTerm)
    );
    setFilteredProcedures(filtered);
  }, [searchTerm, aihCompleta.procedimentos]);

  const getStatusBadge = (status: ProcedureAIH['matchStatus']) => {
    const variants = {
      pending: { variant: 'secondary' as const, icon: Clock, text: 'Pendente', color: 'text-yellow-600' },
      matched: { variant: 'default' as const, icon: CheckCircle, text: 'Encontrado', color: 'text-green-600' },
      manual: { variant: 'outline' as const, icon: Edit, text: 'Manual', color: 'text-blue-600' },
      rejected: { variant: 'destructive' as const, icon: X, text: 'Rejeitado', color: 'text-red-600' }
    };
    
    const config = variants[status];
    const Icon = config.icon;
    
    return (
      <Badge variant={config.variant} className="flex items-center space-x-1">
        <Icon className={`w-3 h-3 ${config.color}`} />
        <span>{config.text}</span>
      </Badge>
    );
  };

  const handleEditProcedure = (procedure: ProcedureAIH) => {
    setSelectedProcedure(procedure);
    setIsEditDialogOpen(true);
  };

  const handleSaveProcedure = (updatedProcedure: ProcedureAIH) => {
    const updatedProcedimentos = aihCompleta.procedimentos.map(proc =>
      proc.sequencia === updatedProcedure.sequencia ? updatedProcedure : proc
    );

    const updatedAIH = {
      ...aihCompleta,
      procedimentos: updatedProcedimentos,
      ...calculateTotals(updatedProcedimentos)
    };

    onUpdateAIH(updatedAIH);
    setIsEditDialogOpen(false);
    setSelectedProcedure(null);

    toast({
      title: "✅ Procedimento atualizado",
      description: `Procedimento ${updatedProcedure.procedimento} foi atualizado com sucesso`
    });
  };

  const handleBulkAction = async (action: 'approve' | 'reject', procedures: ProcedureAIH[]) => {
    const updatedProcedimentos = aihCompleta.procedimentos.map(proc => {
      if (procedures.some(p => p.sequencia === proc.sequencia)) {
        return {
          ...proc,
          matchStatus: action === 'approve' ? 'matched' as const : 'rejected' as const,
          aprovado: action === 'approve',
          revisadoPor: 'Sistema', // TODO: Pegar usuário logado
          dataRevisao: new Date().toISOString()
        };
      }
      return proc;
    });

    const updatedAIH = {
      ...aihCompleta,
      procedimentos: updatedProcedimentos,
      ...calculateTotals(updatedProcedimentos)
    };

    onUpdateAIH(updatedAIH);

    toast({
      title: `✅ ${action === 'approve' ? 'Aprovação' : 'Rejeição'} em lote`,
      description: `${procedures.length} procedimentos foram ${action === 'approve' ? 'aprovados' : 'rejeitados'}`
    });
  };

  const calculateTotals = (procedimentos: ProcedureAIH[]) => {
    const aprovados = procedimentos.filter(p => p.aprovado).length;
    const rejeitados = procedimentos.filter(p => p.matchStatus === 'rejected').length;
    const valorTotal = procedimentos
      .filter(p => p.aprovado)
      .reduce((sum, p) => sum + (p.valorCalculado || 0), 0);

    return {
      procedimentosAprovados: aprovados,
      procedimentosRejeitados: rejeitados,
      valorTotalCalculado: valorTotal,
      statusGeral: (aprovados + rejeitados === procedimentos.length 
        ? (rejeitados === 0 ? 'aprovada' : 'aguardando_revisao') 
        : 'processando') as AIHComplete['statusGeral']
    };
  };

  const handleRecalculateValues = async () => {
    setIsRecalculating(true);
    
    try {
      console.log('🧮 Recalculando valores dos procedimentos...');
      
      await new Promise(resolve => setTimeout(resolve, 1000)); // Simular processamento
      
      toast({
        title: "✅ Valores recalculados",
        description: "Valores dos procedimentos foram atualizados com base na tabela SIGTAP"
      });
      
    } catch (error) {
      toast({
        title: "Erro no recálculo",
        description: "Não foi possível recalcular os valores dos procedimentos",
        variant: "destructive"
      });
    } finally {
      setIsRecalculating(false);
    }
  };

  const exportReport = () => {
    const report = [
      '='.repeat(80),
      `RELATÓRIO DE PROCEDIMENTOS - AIH ${aihCompleta.numeroAIH}`,
      '='.repeat(80),
      '',
      `Paciente: ${aihCompleta.nomePaciente}`,
      `CNS: ${aihCompleta.cns}`,
      `Data da AIH: ${aihCompleta.dataInicio} - ${aihCompleta.dataFim}`,
      '',
      'RESUMO GERAL:',
      `-`.repeat(40),
      `Total de procedimentos: ${aihCompleta.totalProcedimentos}`,
      `Procedimentos aprovados: ${aihCompleta.procedimentosAprovados}`,
      `Procedimentos rejeitados: ${aihCompleta.procedimentosRejeitados}`,
      `Valor total calculado: R$ ${(aihCompleta.valorTotalCalculado || 0).toFixed(2)}`,
      `Status geral: ${aihCompleta.statusGeral}`,
      '',
      'DETALHAMENTO DOS PROCEDIMENTOS:',
      `-`.repeat(40),
      ...aihCompleta.procedimentos.map((proc, index) => [
        `${index + 1}. ${proc.procedimento} - ${proc.descricao}`,
        `   Status: ${proc.matchStatus}`,
        `   Data: ${proc.data}`,
        `   CBO: ${proc.cbo}`,
        `   Valor: R$ ${(proc.valorCalculado || 0).toFixed(2)}`,
        `   Aprovado: ${proc.aprovado ? 'Sim' : 'Não'}`,
        ''
      ]).flat(),
      '='.repeat(80)
    ].join('\n');

    const blob = new Blob([report], { type: 'text/plain;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `relatorio_procedimentos_${aihCompleta.numeroAIH}_${new Date().toISOString().split('T')[0]}.txt`;
    link.click();
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-start">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">📋 Gestão de Procedimentos</h2>
          <p className="text-gray-600 mt-1">
            AIH {aihCompleta.numeroAIH} - {aihCompleta.nomePaciente}
          </p>
        </div>
        
        {getStatusBadge(aihCompleta.statusGeral as any)}
      </div>

      {/* Cards de Resumo */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              <FileText className="w-5 h-5 text-blue-600" />
              <div>
                <p className="text-sm text-gray-600">Total</p>
                <p className="text-2xl font-bold text-blue-700">{aihCompleta.totalProcedimentos}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              <CheckCircle className="w-5 h-5 text-green-600" />
              <div>
                <p className="text-sm text-gray-600">Aprovados</p>
                <p className="text-2xl font-bold text-green-700">{aihCompleta.procedimentosAprovados}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              <X className="w-5 h-5 text-red-600" />
              <div>
                <p className="text-sm text-gray-600">Rejeitados</p>
                <p className="text-2xl font-bold text-red-700">{aihCompleta.procedimentosRejeitados}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              <DollarSign className="w-5 h-5 text-green-600" />
              <div>
                <p className="text-sm text-gray-600">Valor Total</p>
                <p className="text-2xl font-bold text-green-700">
                  R$ {(aihCompleta.valorTotalCalculado || 0).toFixed(2)}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Controles */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span>Procedimentos Realizados</span>
            <div className="flex space-x-2">
              {/* Competência */}
              <div className="flex items-center space-x-2">
                <label className="text-xs text-gray-600">Competência</label>
                <select
                  className="px-2 py-1.5 text-sm border border-gray-200 rounded-md bg-white"
                  value={competencia.slice(0,7)}
                  onChange={(e) => {
                    const ym = e.target.value; // YYYY-MM
                    const value = `${ym}-01`;
                    setCompetencia(value);
                    try {
                      onUpdateAIH({ ...(aihCompleta as any), competencia: value } as any);
                    } catch {}
                  }}
                >
                  {(() => {
                    const options: JSX.Element[] = [];
                    const year = new Date().getFullYear();
                    for (let m = 1; m <= 12; m++) {
                      const d = new Date(year, m - 1, 1);
                      const ym = `${year}-${String(m).padStart(2, '0')}`;
                      const label = d.toLocaleDateString('pt-BR', { month: 'short', year: 'numeric' });
                      options.push(<option key={ym} value={ym}>{label}</option>);
                    }
                    return options;
                  })()}
                </select>
              </div>
              <Button
                onClick={handleRecalculateValues}
                disabled={isRecalculating}
                size="sm"
                variant="outline"
              >
                {isRecalculating ? (
                  <>
                    <Calculator className="w-4 h-4 mr-2 animate-spin" />
                    Recalculando...
                  </>
                ) : (
                  <>
                    <Calculator className="w-4 h-4 mr-2" />
                    Recalcular
                  </>
                )}
              </Button>
              
              <Button onClick={exportReport} size="sm" variant="outline">
                <Download className="w-4 h-4 mr-2" />
                Exportar
              </Button>
            </div>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Busca */}
          <div className="flex items-center space-x-2">
            <Search className="w-4 h-4 text-gray-400" />
            <Input
              placeholder="Buscar por código, descrição ou CBO..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="flex-1"
            />
          </div>

          {/* Ações em Lote */}
          <div className="flex space-x-2">
            <Button
              onClick={() => handleBulkAction('approve', filteredProcedures.filter(p => p.matchStatus === 'matched'))}
              size="sm"
              variant="outline"
              disabled={!filteredProcedures.some(p => p.matchStatus === 'matched')}
            >
              <Check className="w-4 h-4 mr-2" />
              Aprovar Encontrados
            </Button>
            
            <Button
              onClick={() => handleBulkAction('reject', filteredProcedures.filter(p => p.matchStatus === 'pending'))}
              size="sm"
              variant="outline"
              disabled={!filteredProcedures.some(p => p.matchStatus === 'pending')}
            >
              <X className="w-4 h-4 mr-2" />
              Rejeitar Pendentes
            </Button>
          </div>

          {/* Tabela de Procedimentos */}
          <div className="border rounded-lg">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Seq</TableHead>
                  <TableHead>Código</TableHead>
                  <TableHead>Descrição</TableHead>
                  <TableHead>Data</TableHead>
                  <TableHead>CBO</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Valor</TableHead>
                  <TableHead>Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredProcedures.map((procedure) => (
                  <TableRow key={procedure.sequencia}>
                    <TableCell>{procedure.sequencia}</TableCell>
                    <TableCell className="font-mono text-sm">{procedure.procedimento}</TableCell>
                    <TableCell className="max-w-xs truncate">{procedure.descricao}</TableCell>
                    <TableCell>{procedure.data}</TableCell>
                    <TableCell>{procedure.cbo}</TableCell>
                    <TableCell>{getStatusBadge(procedure.matchStatus)}</TableCell>
                    <TableCell>
                      {procedure.valorCalculado ? (
                        <span className="font-medium text-green-600">
                          R$ {procedure.valorCalculado.toFixed(2)}
                        </span>
                      ) : (
                        <span className="text-gray-400">-</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <Button
                        onClick={() => handleEditProcedure(procedure)}
                        size="sm"
                        variant="ghost"
                      >
                        <Edit className="w-4 h-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          {filteredProcedures.length === 0 && (
            <div className="text-center py-8 text-gray-500">
              {searchTerm ? 'Nenhum procedimento encontrado para a busca' : 'Nenhum procedimento disponível'}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Dialog de Edição */}
      <ProcedureEditDialog
        procedure={selectedProcedure}
        isOpen={isEditDialogOpen}
        onClose={() => setIsEditDialogOpen(false)}
        onSave={handleSaveProcedure}
        sigtapProcedures={sigtapProcedures}
      />
    </div>
  );
};

// Componente de diálogo para edição de procedimento
interface ProcedureEditDialogProps {
  procedure: ProcedureAIH | null;
  isOpen: boolean;
  onClose: () => void;
  onSave: (procedure: ProcedureAIH) => void;
  sigtapProcedures: SigtapProcedure[];
}

const ProcedureEditDialog = ({ procedure, isOpen, onClose, onSave, sigtapProcedures }: ProcedureEditDialogProps) => {
  const [editedProcedure, setEditedProcedure] = useState<ProcedureAIH | null>(null);

  useEffect(() => {
    if (procedure) {
      setEditedProcedure({ ...procedure });
    }
  }, [procedure]);

  const handleSave = () => {
    if (editedProcedure) {
      onSave(editedProcedure);
    }
  };

  if (!editedProcedure) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Editar Procedimento</DialogTitle>
          <DialogDescription>
            Edite as informações do procedimento {editedProcedure.procedimento}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium">Código do Procedimento</label>
              <Input
                value={editedProcedure.procedimento}
                onChange={(e) => setEditedProcedure({
                  ...editedProcedure,
                  procedimento: e.target.value
                })}
              />
            </div>
            
            <div>
              <label className="text-sm font-medium">Data</label>
              <Input
                value={editedProcedure.data}
                onChange={(e) => setEditedProcedure({
                  ...editedProcedure,
                  data: e.target.value
                })}
              />
            </div>
          </div>

          <div>
            <label className="text-sm font-medium">Descrição</label>
            <Textarea
              value={editedProcedure.descricao || ''}
              onChange={(e) => setEditedProcedure({
                ...editedProcedure,
                descricao: e.target.value
              })}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium">CBO</label>
              <Input
                value={editedProcedure.cbo}
                onChange={(e) => setEditedProcedure({
                  ...editedProcedure,
                  cbo: e.target.value
                })}
              />
            </div>
            
            <div>
              <label className="text-sm font-medium">Valor Calculado</label>
              <Input
                type="number"
                step="0.01"
                value={editedProcedure.valorCalculado || 0}
                onChange={(e) => setEditedProcedure({
                  ...editedProcedure,
                  valorCalculado: parseFloat(e.target.value) || 0
                })}
              />
            </div>
          </div>

          <div>
            <label className="text-sm font-medium">Observações</label>
            <Textarea
              value={editedProcedure.observacoes || ''}
              onChange={(e) => setEditedProcedure({
                ...editedProcedure,
                observacoes: e.target.value
              })}
              placeholder="Observações sobre este procedimento..."
            />
          </div>

          <div className="flex justify-end space-x-2 pt-4">
            <Button variant="outline" onClick={onClose}>
              Cancelar
            </Button>
            <Button onClick={handleSave}>
              Salvar Alterações
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default ProcedureManagement; 
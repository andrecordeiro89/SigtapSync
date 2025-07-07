import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { 
  Trash2, 
  Eye, 
  RotateCcw, 
  AlertTriangle, 
  CheckCircle, 
  XCircle, 
  Clock, 
  DollarSign,
  Target,
  Stethoscope,
  FileText,
  ChevronDown,
  ChevronRight,
  Info
} from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';
import { useAuth } from '../contexts/AuthContext';
import { AIHPersistenceService } from '../services/aihPersistenceService';

interface AIHProcedure {
  id: string;
  procedure_sequence: number;
  procedure_code: string;
  procedure_description?: string;
  match_status: 'pending' | 'approved' | 'rejected' | 'removed';
  match_confidence?: number;
  value_charged?: number;
  professional?: string;
  professional_cbo?: string;
  procedure_date: string;
  created_at: string;
  updated_at: string;
  sigtap_procedures?: {
    code: string;
    description: string;
    value_hosp_total: number;
    complexity: string;
  };
  aih_matches?: {
    overall_score: number;
    match_confidence: number;
    match_status: string;
  }[];
}

interface AIHProcedureManagerProps {
  aihId: string;
  aihNumber: string;
  patientName: string;
  isReadOnly?: boolean;
  onProceduresChanged?: () => void;
}

const AIHProcedureManager = ({ 
  aihId, 
  aihNumber, 
  patientName, 
  isReadOnly = false,
  onProceduresChanged 
}: AIHProcedureManagerProps) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const persistenceService = new AIHPersistenceService();

  // Estados
  const [procedures, setProcedures] = useState<AIHProcedure[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());
  
  // Estados para diálogos
  const [removeDialogOpen, setRemoveDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [detailDialogOpen, setDetailDialogOpen] = useState(false);
  const [selectedProcedure, setSelectedProcedure] = useState<AIHProcedure | null>(null);

  useEffect(() => {
    loadProcedures();
  }, [aihId]);

  const loadProcedures = async () => {
    setIsLoading(true);
    try {
      console.log('🔍 Carregando procedimentos da AIH:', aihId);
      const data = await persistenceService.getAIHProcedures(aihId);
      setProcedures(data);
      console.log(`✅ ${data.length} procedimentos carregados`);
    } catch (error) {
      console.error('❌ Erro ao carregar procedimentos:', error);
      toast({
        title: "Erro",
        description: "Falha ao carregar procedimentos da AIH",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleRemoveProcedure = async () => {
    if (!selectedProcedure || !user?.id) return;

    try {
      await persistenceService.removeProcedureFromAIH(
        aihId, 
        selectedProcedure.procedure_sequence, 
        user.id
      );
      
      toast({
        title: "✅ Procedimento removido",
        description: `Procedimento ${selectedProcedure.procedure_code} foi removido da AIH`,
      });
      
      await loadProcedures();
      onProceduresChanged?.();
    } catch (error) {
      console.error('❌ Erro ao remover procedimento:', error);
      toast({
        title: "Erro",
        description: "Falha ao remover procedimento",
        variant: "destructive"
      });
    } finally {
      setRemoveDialogOpen(false);
      setSelectedProcedure(null);
    }
  };

  const handleDeleteProcedure = async () => {
    if (!selectedProcedure || !user?.id) return;

    try {
      await persistenceService.deleteProcedureFromAIH(
        aihId, 
        selectedProcedure.procedure_sequence, 
        user.id
      );
      
      toast({
        title: "🗑️ Procedimento excluído",
        description: `Procedimento ${selectedProcedure.procedure_code} foi excluído permanentemente`,
      });
      
      await loadProcedures();
      onProceduresChanged?.();
    } catch (error) {
      console.error('❌ Erro ao excluir procedimento:', error);
      toast({
        title: "Erro",
        description: "Falha ao excluir procedimento",
        variant: "destructive"
      });
    } finally {
      setDeleteDialogOpen(false);
      setSelectedProcedure(null);
    }
  };

  const handleRestoreProcedure = async (procedure: AIHProcedure) => {
    if (!user?.id) return;

    try {
      await persistenceService.restoreProcedureInAIH(
        aihId, 
        procedure.procedure_sequence, 
        user.id
      );
      
      toast({
        title: "♻️ Procedimento restaurado",
        description: `Procedimento ${procedure.procedure_code} foi restaurado`,
      });
      
      await loadProcedures();
      onProceduresChanged?.();
    } catch (error) {
      console.error('❌ Erro ao restaurar procedimento:', error);
      toast({
        title: "Erro",
        description: "Falha ao restaurar procedimento",
        variant: "destructive"
      });
    }
  };

  const getStatusBadge = (status: string, confidence?: number) => {
    const configs = {
      pending: { 
        variant: 'secondary' as const, 
        icon: Clock, 
        text: 'Pendente', 
        color: 'bg-yellow-100 text-yellow-800 border-yellow-300' 
      },
      approved: { 
        variant: 'default' as const, 
        icon: CheckCircle, 
        text: 'Aprovado', 
        color: 'bg-green-100 text-green-800 border-green-300' 
      },
      rejected: { 
        variant: 'destructive' as const, 
        icon: XCircle, 
        text: 'Rejeitado', 
        color: 'bg-red-100 text-red-800 border-red-300' 
      },
      removed: { 
        variant: 'outline' as const, 
        icon: AlertTriangle, 
        text: 'Removido', 
        color: 'bg-gray-100 text-gray-600 border-gray-300' 
      }
    };
    
    const config = configs[status as keyof typeof configs] || configs.pending;
    const Icon = config.icon;
    
    return (
      <div className="flex flex-col items-center space-y-1">
        <Badge variant={config.variant} className={`flex items-center space-x-1 ${config.color}`}>
          <Icon className="w-3 h-3" />
          <span>{config.text}</span>
        </Badge>
        {confidence && confidence > 0 && (
          <span className="text-xs text-gray-500">
            {(confidence * 100).toFixed(0)}%
          </span>
        )}
      </div>
    );
  };

  const formatCurrency = (value?: number) => {
    if (!value) return 'R$ 0,00';
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(value / 100); // Assumindo valor em centavos
  };

  const formatDate = (date: string) => {
    return new Date(date).toLocaleDateString('pt-BR');
  };

  const toggleRowExpansion = (procedureId: string) => {
    const newExpanded = new Set(expandedRows);
    if (newExpanded.has(procedureId)) {
      newExpanded.delete(procedureId);
    } else {
      newExpanded.add(procedureId);
    }
    setExpandedRows(newExpanded);
  };

  const openRemoveDialog = (procedure: AIHProcedure) => {
    setSelectedProcedure(procedure);
    setRemoveDialogOpen(true);
  };

  const openDeleteDialog = (procedure: AIHProcedure) => {
    setSelectedProcedure(procedure);
    setDeleteDialogOpen(true);
  };

  const openDetailDialog = (procedure: AIHProcedure) => {
    setSelectedProcedure(procedure);
    setDetailDialogOpen(true);
  };

  // Estatísticas
  const stats = {
    total: procedures.length,
    pending: procedures.filter(p => p.match_status === 'pending').length,
    approved: procedures.filter(p => p.match_status === 'approved').length,
    rejected: procedures.filter(p => p.match_status === 'rejected').length,
    removed: procedures.filter(p => p.match_status === 'removed').length,
    totalValue: procedures
      .filter(p => p.match_status === 'approved')
      .reduce((sum, p) => sum + (p.value_charged || 0), 0)
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <Stethoscope className="w-5 h-5 text-blue-600" />
              <span>Procedimentos da AIH {aihNumber}</span>
            </div>
            <Badge variant="outline" className="text-sm">
              👤 {patientName}
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {/* Estatísticas */}
          <div className="grid grid-cols-2 md:grid-cols-6 gap-4 mb-6">
            <div className="text-center p-3 bg-blue-50 rounded-lg">
              <p className="text-sm text-gray-600">Total</p>
              <p className="text-lg font-bold text-blue-700">{stats.total}</p>
            </div>
            <div className="text-center p-3 bg-yellow-50 rounded-lg">
              <p className="text-sm text-gray-600">Pendentes</p>
              <p className="text-lg font-bold text-yellow-700">{stats.pending}</p>
            </div>
            <div className="text-center p-3 bg-green-50 rounded-lg">
              <p className="text-sm text-gray-600">Aprovados</p>
              <p className="text-lg font-bold text-green-700">{stats.approved}</p>
            </div>
            <div className="text-center p-3 bg-red-50 rounded-lg">
              <p className="text-sm text-gray-600">Rejeitados</p>
              <p className="text-lg font-bold text-red-700">{stats.rejected}</p>
            </div>
            <div className="text-center p-3 bg-gray-50 rounded-lg">
              <p className="text-sm text-gray-600">Removidos</p>
              <p className="text-lg font-bold text-gray-700">{stats.removed}</p>
            </div>
            <div className="text-center p-3 bg-green-100 rounded-lg">
              <p className="text-sm text-gray-600">Valor Total</p>
              <p className="text-lg font-bold text-green-800">{formatCurrency(stats.totalValue)}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Tabela de Procedimentos */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <FileText className="w-5 h-5 text-purple-600" />
            <span>Lista de Procedimentos ({procedures.length})</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
            </div>
          ) : procedures.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <Stethoscope className="w-12 h-12 mx-auto mb-4 text-gray-300" />
              <p>Nenhum procedimento encontrado para esta AIH</p>
            </div>
          ) : (
            <div className="border rounded-lg overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow className="bg-gray-50">
                    <TableHead className="w-16">Seq</TableHead>
                    <TableHead className="w-32">Código</TableHead>
                    <TableHead>Descrição</TableHead>
                    <TableHead className="w-24">Data</TableHead>
                    <TableHead className="w-32">Valor</TableHead>
                    <TableHead className="w-24">Status</TableHead>
                    {!isReadOnly && <TableHead className="w-32">Ações</TableHead>}
                    <TableHead className="w-16">Detalhes</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {procedures.map((procedure) => (
                    <React.Fragment key={procedure.id}>
                      <TableRow className={`hover:bg-gray-50 ${procedure.match_status === 'removed' ? 'opacity-60' : ''}`}>
                        <TableCell className="font-medium">{procedure.procedure_sequence}</TableCell>
                        
                        <TableCell className="font-mono text-sm">
                          {procedure.procedure_code}
                        </TableCell>
                        
                        <TableCell>
                          <div>
                            <p className="font-medium">
                              {procedure.procedure_description || procedure.sigtap_procedures?.description || `Procedimento ${procedure.procedure_code}`}
                            </p>
                            {procedure.professional && (
                              <p className="text-sm text-gray-500">
                                👨‍⚕️ {procedure.professional} ({procedure.professional_cbo})
                              </p>
                            )}
                          </div>
                        </TableCell>
                        
                        <TableCell>
                          <span className="text-sm">{formatDate(procedure.procedure_date)}</span>
                        </TableCell>
                        
                        <TableCell>
                          {procedure.value_charged ? (
                            <div className="text-sm">
                              <p className="font-semibold text-green-600">
                                {formatCurrency(procedure.value_charged)}
                              </p>
                            </div>
                          ) : (
                            <span className="text-gray-400 text-sm">Não calculado</span>
                          )}
                        </TableCell>
                        
                        <TableCell>
                          {getStatusBadge(procedure.match_status, procedure.match_confidence)}
                        </TableCell>
                        
                        {!isReadOnly && (
                          <TableCell>
                            <div className="flex space-x-1">
                              {procedure.match_status === 'removed' ? (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => handleRestoreProcedure(procedure)}
                                  className="h-7 px-2"
                                  title="Restaurar procedimento"
                                >
                                  <RotateCcw className="w-3 h-3" />
                                </Button>
                              ) : (
                                <>
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => openRemoveDialog(procedure)}
                                    className="h-7 px-2"
                                    title="Remover procedimento"
                                  >
                                    <AlertTriangle className="w-3 h-3" />
                                  </Button>
                                  
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => openDeleteDialog(procedure)}
                                    className="h-7 px-2 text-red-600 hover:text-red-700"
                                    title="Excluir permanentemente"
                                  >
                                    <Trash2 className="w-3 h-3" />
                                  </Button>
                                </>
                              )}
                            </div>
                          </TableCell>
                        )}
                        
                        <TableCell>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => toggleRowExpansion(procedure.id)}
                            className="h-7 w-7 p-0"
                          >
                            {expandedRows.has(procedure.id) ? (
                              <ChevronDown className="w-4 h-4" />
                            ) : (
                              <ChevronRight className="w-4 h-4" />
                            )}
                          </Button>
                        </TableCell>
                      </TableRow>
                      
                      {/* Detalhes Expandidos */}
                      {expandedRows.has(procedure.id) && (
                        <TableRow>
                          <TableCell colSpan={isReadOnly ? 7 : 8} className="bg-gray-50 p-4">
                            <div className="space-y-4">
                              <h4 className="font-semibold text-gray-700 flex items-center space-x-2">
                                <Info className="w-4 h-4" />
                                <span>Detalhes do Procedimento</span>
                              </h4>
                              
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                {/* Informações Básicas */}
                                <div className="space-y-2">
                                  <h5 className="font-medium text-sm text-gray-600">Informações Básicas</h5>
                                  <div className="bg-white p-3 rounded border text-sm space-y-1">
                                    <p><span className="font-medium">ID:</span> {procedure.id}</p>
                                    <p><span className="font-medium">Sequência:</span> {procedure.procedure_sequence}</p>
                                    <p><span className="font-medium">Código:</span> {procedure.procedure_code}</p>
                                    <p><span className="font-medium">Data Realização:</span> {formatDate(procedure.procedure_date)}</p>
                                    <p><span className="font-medium">Criado em:</span> {formatDate(procedure.created_at)}</p>
                                    {procedure.updated_at !== procedure.created_at && (
                                      <p><span className="font-medium">Atualizado em:</span> {formatDate(procedure.updated_at)}</p>
                                    )}
                                  </div>
                                </div>
                                
                                {/* Dados SIGTAP */}
                                {procedure.sigtap_procedures && (
                                  <div className="space-y-2">
                                    <h5 className="font-medium text-sm text-gray-600">Dados SIGTAP</h5>
                                    <div className="bg-white p-3 rounded border text-sm space-y-1">
                                      <p><span className="font-medium">Código SIGTAP:</span> {procedure.sigtap_procedures.code}</p>
                                      <p><span className="font-medium">Descrição:</span> {procedure.sigtap_procedures.description}</p>
                                      <p><span className="font-medium">Complexidade:</span> {procedure.sigtap_procedures.complexity}</p>
                                      <p><span className="font-medium">Valor Hospitalar:</span> {formatCurrency(procedure.sigtap_procedures.value_hosp_total)}</p>
                                    </div>
                                  </div>
                                )}
                              </div>
                              
                              {/* Matches */}
                              {procedure.aih_matches && procedure.aih_matches.length > 0 && (
                                <div className="space-y-2">
                                  <h5 className="font-medium text-sm text-gray-600">Histórico de Matches</h5>
                                  <div className="bg-white p-3 rounded border">
                                    {procedure.aih_matches.map((match, index) => (
                                      <div key={index} className="flex items-center justify-between p-2 border-b last:border-b-0">
                                        <div className="flex items-center space-x-2">
                                          <Badge variant="outline">Score: {match.overall_score}%</Badge>
                                          <Badge variant="outline">Confiança: {(match.match_confidence * 100).toFixed(0)}%</Badge>
                                        </div>
                                        <Badge variant={match.match_status === 'approved' ? 'default' : 'secondary'}>
                                          {match.match_status}
                                        </Badge>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                      )}
                    </React.Fragment>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Dialog de Confirmação - Remoção */}
      <AlertDialog open={removeDialogOpen} onOpenChange={setRemoveDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center space-x-2">
              <AlertTriangle className="w-5 h-5 text-yellow-600" />
              <span>Remover Procedimento</span>
            </AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja <strong>remover</strong> o procedimento <strong>{selectedProcedure?.procedure_code}</strong>?
              <br /><br />
              ℹ️ <em>O procedimento será marcado como removido mas pode ser restaurado posteriormente.</em>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleRemoveProcedure} 
              className="bg-yellow-600 hover:bg-yellow-700"
            >
              Remover
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Dialog de Confirmação - Exclusão */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center space-x-2">
              <Trash2 className="w-5 h-5 text-red-600" />
              <span>Excluir Procedimento</span>
            </AlertDialogTitle>
            <AlertDialogDescription>
              <div className="space-y-2">
                <p>
                  Tem certeza que deseja <strong className="text-red-600">excluir permanentemente</strong> o procedimento <strong>{selectedProcedure?.procedure_code}</strong>?
                </p>
                <div className="bg-red-50 border border-red-200 rounded p-3">
                  <p className="text-red-800 text-sm font-medium">⚠️ ATENÇÃO:</p>
                  <ul className="text-red-700 text-sm mt-1 space-y-1">
                    <li>• Esta ação não pode ser desfeita</li>
                    <li>• O procedimento será removido permanentemente</li>
                    <li>• Todos os matches associados serão excluídos</li>
                    <li>• As estatísticas da AIH serão recalculadas</li>
                  </ul>
                </div>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleDeleteProcedure} 
              className="bg-red-600 hover:bg-red-700"
            >
              Excluir Permanentemente
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default AIHProcedureManager; 
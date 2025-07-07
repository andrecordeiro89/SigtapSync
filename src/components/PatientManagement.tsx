import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { User, FileText, Clock, CheckCircle, DollarSign, Calendar, RefreshCw, Search, Trash2, Eye, Edit, ChevronDown, ChevronUp, Filter, Download, Stethoscope, Settings, AlertTriangle, RotateCcw, Info } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { AIHPersistenceService } from '../services/aihPersistenceService';
import AIHProcedureManager from './AIHProcedureManager';
import AIHExecutiveSummary from './AIHExecutiveSummary';
import ProcedureInlineCard from './ProcedureInlineCard';
import { formatCurrency as baseCurrency } from '../utils/validation';

// 🔧 CORREÇÃO: Função para formatar valores que vêm em centavos
const formatCurrency = (value: number | undefined | null): string => {
  if (!value) return 'R$ 0,00';
  // Dividir por 100 se valor parece estar em centavos (>= 1000)
  const realValue = value >= 1000 ? value / 100 : value;
  return baseCurrency(realValue);
};
import { useToast } from '@/components/ui/use-toast';

// Tipos de dados
interface Patient {
  id: string;
  name: string;
  cns: string;
  birth_date: string;
  gender: 'M' | 'F';
  medical_record?: string;
  mother_name?: string;
  address?: string;
  phone?: string;
  city?: string;
  state?: string;
  nationality?: string;
  race_color?: string;
  created_at: string;
  updated_at: string;
  aihs?: AIH[];
}

interface AIH {
  id: string;
  aih_number: string;
  procedure_code: string;
  admission_date: string;
  discharge_date?: string;
  main_cid: string;
  secondary_cid?: string[];
  processing_status: string;
  calculated_total_value?: number;
  match_found: boolean;
  requires_manual_review: boolean;
  source_file?: string;
  total_procedures?: number;
  approved_procedures?: number;
  rejected_procedures?: number;
  aih_situation?: string;
  care_character?: string;
  specialty?: string;
  processed_at?: string;
  processed_by_name?: string;
  created_at?: string;
  updated_at?: string;
  patients?: {
    name: string;
    cns: string;
  };
  aih_matches?: Array<{
    id: string;
    overall_score: number;
    calculated_total: number;
    status: string;
    match_confidence: number;
    validation_details: any;
  }>;
}

interface HospitalStats {
  total_aihs: number;
  pending_aihs: number;
  completed_aihs: number;
  total_patients: number;
  total_value: number;
  average_value: number;
}

// Interface para dados unificados
interface UnifiedAIHData extends AIH {
  patient: Patient | null;
  matches: AIH['aih_matches'];
  processed_at_formatted?: string;
  created_by_profile?: {
    full_name?: string;
    email?: string;
  };
}

const PatientManagement = () => {
  const { user, hasFullAccess } = useAuth();
  const currentHospitalId = user?.hospital_id;
  const { toast } = useToast();
  const persistenceService = new AIHPersistenceService();
  const isDirector = hasFullAccess();

  // Estados principais
  const [patients, setPatients] = useState<Patient[]>([]);
  const [aihs, setAIHs] = useState<AIH[]>([]);
  const [stats, setStats] = useState<HospitalStats | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  
  // Estados de expansão unificados
  const [expandedItems, setExpandedItems] = useState<Set<string>>(new Set());
  
  // Filtros unificados
  const [globalSearch, setGlobalSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [dateFilter, setDateFilter] = useState('');
  const [matchFilter, setMatchFilter] = useState('all');
  const [processedByFilter, setProcessedByFilter] = useState('');

  // Paginação
  const [currentPage, setCurrentPage] = useState(0);
  const [itemsPerPage] = useState(10);

  // Estados para deleção
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [itemToDelete, setItemToDelete] = useState<{type: 'patient' | 'aih', id: string, name: string} | null>(null);

  // Estados para gerenciamento de procedimentos
  const [procedureManagerOpen, setProcedureManagerOpen] = useState(false);
  const [selectedAIHForProcedures, setSelectedAIHForProcedures] = useState<UnifiedAIHData | null>(null);

  // Estados para gerenciamento inline de procedimentos
  const [proceduresData, setProceduresData] = useState<{[aihId: string]: any[]}>({});
  const [loadingProcedures, setLoadingProcedures] = useState<{[aihId: string]: boolean}>({});

  // Estados para exclusão completa
  const [completeDeleteDialogOpen, setCompleteDeleteDialogOpen] = useState(false);
  const [aihToCompleteDelete, setAihToCompleteDelete] = useState<{id: string, name: string, patientName: string} | null>(null);

  useEffect(() => {
    if (currentHospitalId) {
      loadAllData();
    }
  }, [currentHospitalId]);

  const loadAllData = async () => {
    setIsLoading(true);
    try {
      await Promise.all([
        loadPatients(),
        loadAIHs(),
        loadStats()
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  const loadPatients = async () => {
    try {
      console.log('🔍 Carregando pacientes para hospital:', currentHospitalId);
      const data = await persistenceService.getPatients(currentHospitalId, {
        name: globalSearch || undefined,
        limit: 100
      });
      setPatients(data);
      console.log('👥 Pacientes carregados:', data.length);
    } catch (error) {
      console.error('❌ Erro ao carregar pacientes:', error);
      toast({
        title: "Erro", 
        description: "Falha ao carregar lista de pacientes",
        variant: "destructive"
      });
    }
  };

  const loadAIHs = async () => {
    try {
      console.log('🔍 Carregando AIHs para hospital:', currentHospitalId);
      const data = await persistenceService.getAIHs(currentHospitalId, {
        status: statusFilter !== 'all' ? statusFilter : undefined,
        aihNumber: globalSearch || undefined,
        dateFrom: dateFilter || undefined,
        processedBy: processedByFilter || undefined,
        limit: 100
      });
      setAIHs(data);
      console.log('📊 AIHs carregadas:', data.length);
    } catch (error) {
      console.error('❌ Erro ao carregar AIHs:', error);
      toast({
        title: "Erro", 
        description: "Falha ao carregar lista de AIHs",
        variant: "destructive"
      });
    }
  };

  const loadStats = async () => {
    try {
      const data = await persistenceService.getHospitalStats(currentHospitalId);
      setStats(data);
    } catch (error) {
      console.error('❌ Erro ao carregar estatísticas:', error);
    }
  };

  // Função de expansão unificada
  const toggleItemExpansion = (itemId: string) => {
    const newExpanded = new Set(expandedItems);
    if (newExpanded.has(itemId)) {
      newExpanded.delete(itemId);
    } else {
      newExpanded.add(itemId);
    }
    setExpandedItems(newExpanded);
  };

  const handleDeleteRequest = (type: 'patient' | 'aih', id: string, name: string) => {
    setItemToDelete({ type, id, name });
    setDeleteDialogOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (!itemToDelete) return;
    
    try {
      if (itemToDelete.type === 'patient') {
        await persistenceService.deletePatient(itemToDelete.id);
        setPatients(patients.filter(p => p.id !== itemToDelete.id));
      } else {
        await persistenceService.deleteAIH(itemToDelete.id);
        setAIHs(aihs.filter(a => a.id !== itemToDelete.id));
      }
      
      toast({
        title: "Sucesso",
        description: `${itemToDelete.type === 'patient' ? 'Paciente' : 'AIH'} removido com sucesso`,
      });
      
      await loadStats();
    } catch (error) {
      console.error('❌ Erro ao deletar:', error);
      toast({
        title: "Erro",
        description: "Falha ao remover item",
        variant: "destructive"
      });
    } finally {
      setDeleteDialogOpen(false);
      setItemToDelete(null);
    }
  };

  const handleOpenProcedureManager = (aih: UnifiedAIHData) => {
    setSelectedAIHForProcedures(aih);
    setProcedureManagerOpen(true);
  };

  const handleProceduresChanged = () => {
    // Recarregar dados quando procedimentos são alterados
    loadAllData();
  };

  // Carregar procedimentos inline para uma AIH específica
  const loadAIHProcedures = async (aihId: string) => {
    setLoadingProcedures(prev => ({ ...prev, [aihId]: true }));
    try {
      const procedures = await persistenceService.getAIHProcedures(aihId);
      setProceduresData(prev => ({ ...prev, [aihId]: procedures }));
    } catch (error) {
      console.error('❌ Erro ao carregar procedimentos:', error);
      toast({
        title: "Erro",
        description: "Falha ao carregar procedimentos",
        variant: "destructive"
      });
    } finally {
      setLoadingProcedures(prev => ({ ...prev, [aihId]: false }));
    }
  };

  // Ações inline para procedimentos
  const handleRemoveProcedure = async (aihId: string, procedure: any) => {
    try {
      await persistenceService.removeProcedureFromAIH(aihId, procedure.procedure_sequence, user?.id || 'system');
      await loadAIHProcedures(aihId); // Recarregar procedimentos
      toast({
        title: "Sucesso",
        description: "Procedimento removido temporariamente",
      });
    } catch (error) {
      console.error('❌ Erro ao remover procedimento:', error);
      toast({
        title: "Erro",
        description: "Falha ao remover procedimento",
        variant: "destructive"
      });
    }
  };

  const handleDeleteProcedure = async (aihId: string, procedure: any) => {
    try {
      await persistenceService.deleteProcedureFromAIH(aihId, procedure.procedure_sequence, user?.id || 'system');
      await loadAIHProcedures(aihId); // Recarregar procedimentos
      toast({
        title: "Sucesso",
        description: "Procedimento excluído permanentemente",
      });
    } catch (error) {
      console.error('❌ Erro ao excluir procedimento:', error);
      toast({
        title: "Erro",
        description: "Falha ao excluir procedimento",
        variant: "destructive"
      });
    }
  };

  const handleRestoreProcedure = async (aihId: string, procedure: any) => {
    try {
      await persistenceService.restoreProcedureInAIH(aihId, procedure.procedure_sequence, user?.id || 'system');
      await loadAIHProcedures(aihId); // Recarregar procedimentos
      toast({
        title: "Sucesso",
        description: "Procedimento restaurado",
      });
    } catch (error) {
      console.error('❌ Erro ao restaurar procedimento:', error);
      toast({
        title: "Erro",
        description: "Falha ao restaurar procedimento",
        variant: "destructive"
      });
    }
  };

  // Exclusão completa de AIH + Paciente
  const handleCompleteDeleteRequest = (aihId: string, aihNumber: string, patientName: string) => {
    setAihToCompleteDelete({ id: aihId, name: aihNumber, patientName });
    setCompleteDeleteDialogOpen(true);
  };

  const handleCompleteDeleteConfirm = async () => {
    if (!aihToCompleteDelete) return;

    try {
      const result = await persistenceService.deleteCompleteAIH(
        aihToCompleteDelete.id,
        user?.id || 'system',
        {
          keepAuditTrail: true // Manter log de auditoria
        }
      );

      toast({
        title: "Exclusão Completa Realizada",
        description: result.message,
      });

      // Recarregar dados
      await loadAllData();
      
    } catch (error) {
      console.error('❌ Erro na exclusão completa:', error);
      toast({
        title: "Erro",
        description: "Falha na exclusão completa",
        variant: "destructive"
      });
    } finally {
      setCompleteDeleteDialogOpen(false);
      setAihToCompleteDelete(null);
    }
  };

  // Função para carregar procedimentos quando expandir AIH
  const handleExpandAIH = async (aihId: string) => {
    toggleItemExpansion(aihId);
    
    // Se está expandindo (não contraindo) e não tem procedimentos carregados
    if (!expandedItems.has(aihId) && !proceduresData[aihId]) {
      await loadAIHProcedures(aihId);
    }
  };

  // Dados unificados: AIHs com informações dos pacientes
  const unifiedData: UnifiedAIHData[] = aihs.map(aih => {
    const patient = patients.find(p => p.cns === aih.patients?.cns);
    return {
      ...aih,
      patient: patient || null,
      matches: aih.aih_matches || []
    };
  });

  // Filtros aplicados
  const filteredData = unifiedData.filter(item => {
    const matchesSearch = 
      item.aih_number.toLowerCase().includes(globalSearch.toLowerCase()) ||
      (item.patients?.name && item.patients.name.toLowerCase().includes(globalSearch.toLowerCase())) ||
      (item.patient?.cns && item.patient.cns.includes(globalSearch));
    
    const matchesStatus = statusFilter === 'all' || item.processing_status === statusFilter;
    const matchesDate = !dateFilter || item.admission_date >= dateFilter;
    const matchesMatches = matchFilter === 'all' || 
      (matchFilter === 'with_matches' && item.matches.length > 0) ||
      (matchFilter === 'without_matches' && item.matches.length === 0);
    
    return matchesSearch && matchesStatus && matchesDate && matchesMatches;
  });

  // Paginação unificada
  const paginatedData = filteredData.slice(
    currentPage * itemsPerPage,
    (currentPage + 1) * itemsPerPage
  );

  const getStatusBadge = (status: string) => {
    const variants = {
      'pending': { variant: 'secondary' as const, icon: '⏳', text: 'Pendente' },
      'processing': { variant: 'default' as const, icon: '⚙️', text: 'Processando' },
      'completed': { variant: 'default' as const, icon: '✅', text: 'Concluída' },
      'error': { variant: 'destructive' as const, icon: '❌', text: 'Erro' }
    };
    
    const config = variants[status as keyof typeof variants] || variants.pending;
    
    return (
      <Badge variant={config.variant} className="text-xs">
        {config.icon} {config.text}
      </Badge>
    );
  };

  const getScoreBadge = (score: number) => {
    if (score >= 80) return <Badge variant="default" className="bg-green-500 text-xs">✅ {score}%</Badge>;
    if (score >= 60) return <Badge variant="secondary" className="bg-yellow-500 text-xs">⚠️ {score}%</Badge>;
    return <Badge variant="destructive" className="text-xs">❌ {score}%</Badge>;
  };

  const formatDate = (date: string) => {
    return new Date(date).toLocaleDateString('pt-BR');
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Gestão de AIHs e Pacientes</h1>
          <p className="text-gray-600">Visualize e gerencie AIHs processadas e dados dos pacientes</p>
        </div>
        <div className="flex items-center space-x-4">
          {/* Informações do Usuário */}
          <div className="flex items-center space-x-2 bg-gray-50 px-3 py-2 rounded-lg">
            <User className="w-4 h-4 text-gray-500" />
            <div className="text-right">
              <p className="text-sm font-medium text-gray-900">
                {user?.full_name || user?.email || 'Usuário'}
              </p>
              <p className="text-xs text-gray-500">
                {user?.role === 'director' ? 'Diretor' : 
                 user?.role === 'admin' ? 'Administrador' :
                 user?.role === 'coordinator' ? 'Coordenador' :
                 user?.role === 'auditor' ? 'Auditor' :
                 user?.role === 'developer' ? 'Desenvolvedor' :
                 'Operador'}
              </p>
            </div>
          </div>

          {/* Botões de Ação */}
          <div className="flex space-x-2">
            <Button 
              onClick={loadAllData} 
              disabled={isLoading}
              variant="outline"
              size="sm"
            >
              <RefreshCw className={`w-4 h-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
              Atualizar
            </Button>
          </div>
        </div>
      </div>

      {/* Estatísticas */}
      {stats && (
        <div className={`grid grid-cols-1 md:grid-cols-2 ${isDirector ? 'lg:grid-cols-6' : 'lg:grid-cols-4'} gap-4`}>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center space-x-2">
                <User className="w-4 h-4 text-blue-500" />
                <div>
                  <p className="text-xs text-gray-600">Pacientes</p>
                  <p className="text-lg font-semibold">{stats.total_patients}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center space-x-2">
                <FileText className="w-4 h-4 text-green-500" />
                <div>
                  <p className="text-xs text-gray-600">AIHs Total</p>
                  <p className="text-lg font-semibold">{stats.total_aihs}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center space-x-2">
                <Clock className="w-4 h-4 text-yellow-500" />
                <div>
                  <p className="text-xs text-gray-600">Pendentes</p>
                  <p className="text-lg font-semibold">{stats.pending_aihs}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center space-x-2">
                <CheckCircle className="w-4 h-4 text-green-500" />
                <div>
                  <p className="text-xs text-gray-600">Concluídas</p>
                  <p className="text-lg font-semibold">{stats.completed_aihs}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Cards financeiros - Apenas para diretores */}
          {isDirector && (
            <>
              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center space-x-2">
                    <DollarSign className="w-4 h-4 text-green-600" />
                    <div>
                      <p className="text-xs text-gray-600">Valor Total</p>
                      <p className="text-lg font-semibold">{formatCurrency(stats.total_value)}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center space-x-2">
                    <Calendar className="w-4 h-4 text-purple-500" />
                    <div>
                      <p className="text-xs text-gray-600">Valor Médio</p>
                      <p className="text-lg font-semibold">{formatCurrency(stats.average_value)}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </>
          )}
        </div>
      )}

            {/* Filtros Unificados */}
          <Card>
            <CardContent className="p-4">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div>
                <Input
                placeholder="Buscar AIH, paciente ou CNS..."
                value={globalSearch}
                onChange={(e) => setGlobalSearch(e.target.value)}
                className="w-full"
              />
            </div>
            <div>
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger>
                    <SelectValue placeholder="Status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos os Status</SelectItem>
                    <SelectItem value="pending">Pendente</SelectItem>
                    <SelectItem value="processing">Processando</SelectItem>
                    <SelectItem value="completed">Concluída</SelectItem>
                    <SelectItem value="error">Erro</SelectItem>
                  </SelectContent>
                </Select>
            </div>
            <div>
              <Select value={matchFilter} onValueChange={setMatchFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="Matches" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  <SelectItem value="with_matches">Com Matches</SelectItem>
                  <SelectItem value="without_matches">Sem Matches</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
                <Input
                  type="date"
                  value={dateFilter}
                  onChange={(e) => setDateFilter(e.target.value)}
                />
            </div>
              </div>
            </CardContent>
          </Card>

      {/* Lista Unificada de AIHs */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <FileText className="w-5 h-5" />
            <span>AIHs Processadas ({filteredData.length})</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
            </div>
          ) : paginatedData.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <FileText className="w-12 h-12 mx-auto mb-4 text-gray-300" />
              <p>Nenhuma AIH encontrada</p>
            </div>
          ) : (
            <div className="space-y-4">
              {paginatedData.map((item) => (
                <div key={item.id} className="border rounded-lg p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-4">
                      <div className="flex items-center space-x-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleExpandAIH(item.id)}
                        >
                          {expandedItems.has(item.id) ? 
                            <ChevronUp className="w-4 h-4" /> : 
                            <ChevronDown className="w-4 h-4" />
                          }
                        </Button>
                        <div>
                          <h3 className="font-semibold">📄 {item.aih_number}</h3>
                          <p className="text-sm text-gray-600">
                            👤 {item.patients?.name || 'Paciente não identificado'}
                          </p>
                        </div>
                      </div>
                      
                      <div className="flex items-center space-x-2">
                        <Badge variant="default" className="bg-green-500 text-xs">
                          ✅ Processada
                        </Badge>
                      </div>
                    </div>

                    <div className="flex flex-col items-end space-y-2">
                      {/* Badge do Operador */}
                      <Badge variant="outline" className="bg-blue-50 border-blue-200 text-blue-800 hover:bg-blue-100">
                        <User className="w-3 h-3 mr-1" />
                        {item.processed_by_name || 'Sistema'}
                      </Badge>
                      
                      {/* Badge da Data/Hora */}
                      <Badge variant="outline" className="bg-purple-50 border-purple-200 text-purple-800 hover:bg-purple-100">
                        <Calendar className="w-3 h-3 mr-1" />
                        {item.processed_at_formatted}
                      </Badge>
                      
                      {/* Badge do Valor */}
                      {item.calculated_total_value && (
                        <Badge variant="outline" className="bg-green-50 border-green-200 text-green-800 hover:bg-green-100 font-semibold">
                          <DollarSign className="w-3 h-3 mr-1" />
                          {formatCurrency(item.calculated_total_value)}
                        </Badge>
                      )}
                      
                      {/* NOVO: Botão de Exclusão para Operadores */}
                      {(() => {
                        const userRole = user?.role as string;
                        const hasPermission = (['operator', 'coordinator', 'director', 'admin'] as const).includes(userRole as any);
                        
                        return hasPermission && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleDeleteRequest('aih', item.id, item.aih_number)}
                            className="flex items-center space-x-1 text-red-600 hover:text-red-700 border-red-200 hover:border-red-300 bg-red-50 hover:bg-red-100 transition-colors text-xs px-2 py-1"
                          >
                            <Trash2 className="w-3 h-3" />
                            <span>Excluir</span>
                          </Button>
                        );
                      })()}
                    </div>
                  </div>

                  {expandedItems.has(item.id) && (
                    <div className="mt-4 pt-4 border-t space-y-4">
                      {/* NOVO: Resumo Executivo */}
                      <AIHExecutiveSummary 
                        aih={{
                          id: item.id,
                          patient_name: item.patients?.name || 'Paciente não identificado',
                          patient_cpf: item.patient?.cns || '', // Usando CNS como CPF
                          admission_date: item.admission_date,
                          discharge_date: item.discharge_date,
                          total_procedures: item.total_procedures,
                          total_value: item.calculated_total_value,
                          status: item.processing_status || 'pending',
                          aih_procedures: proceduresData[item.id] || []
                        }}
                        onRefresh={() => loadAIHProcedures(item.id)}
                      />

                      {/* Informações do Paciente */}
                      {item.patient && (
                        <div className="bg-blue-50 p-3 rounded-lg">
                          <h4 className="font-semibold text-blue-900 mb-2">👤 Informações do Paciente</h4>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm">
                            <p><span className="font-medium">Nome:</span> {item.patient.name}</p>
                            <p><span className="font-medium">CNS:</span> {item.patient.cns}</p>
                            <p><span className="font-medium">Data Nascimento:</span> {formatDate(item.patient.birth_date)}</p>
                            <p><span className="font-medium">Gênero:</span> {item.patient.gender === 'M' ? 'Masculino' : 'Feminino'}</p>
                            {item.patient.medical_record && (
                              <p><span className="font-medium">Prontuário:</span> {item.patient.medical_record}</p>
                            )}
                          </div>
                        </div>
                      )}

                      {/* Informações da AIH */}
                      <div className="bg-gray-50 p-3 rounded-lg">
                        <h4 className="font-semibold text-gray-900 mb-2">📋 Detalhes da AIH</h4>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm">
                          <p><span className="font-medium">Código Proc:</span> {item.procedure_code}</p>
                          <p><span className="font-medium">CID Principal:</span> {item.main_cid}</p>
                          <p><span className="font-medium">Admissão:</span> {formatDate(item.admission_date)}</p>
                          {item.discharge_date && (
                            <p><span className="font-medium">Alta:</span> {formatDate(item.discharge_date)}</p>
                          )}
                          <p><span className="font-medium">Situação:</span> {item.aih_situation || 'N/A'}</p>
                          <p><span className="font-medium">Caráter:</span> {item.care_character || 'N/A'}</p>
                          {item.specialty && (
                            <p><span className="font-medium">Especialidade:</span> {item.specialty}</p>
                          )}
                        </div>
                      </div>

                      {/* Matches Encontrados */}
                      {item.matches.length > 0 && (
                        <div className="bg-green-50 p-3 rounded-lg">
                          <h4 className="font-semibold text-green-900 mb-2">🎯 Matches Encontrados ({item.matches.length})</h4>
                          <div className="space-y-2">
                            {item.matches.map((match, index) => (
                              <div key={match.id} className="flex items-center justify-between p-2 bg-white rounded border">
                                <div className="flex items-center space-x-2">
                                  {getScoreBadge(match.overall_score)}
                                  <span className="text-sm">Match #{index + 1}</span>
                                </div>
                                <div className="flex items-center space-x-2 text-sm">
                                  <span>Confiança: {match.match_confidence}%</span>
                                  {isDirector && (
                                    <span>💰 {formatCurrency(match.calculated_total)}</span>
                                  )}
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* NOVO: Gerenciamento Inline de Procedimentos */}
                      {proceduresData[item.id] && proceduresData[item.id].length > 0 && (
                        <div className="bg-slate-50 p-4 rounded-lg">
                          <div className="flex items-center justify-between mb-3">
                            <h4 className="font-semibold text-slate-900 flex items-center space-x-2">
                              <Stethoscope className="w-4 h-4" />
                              <span>Procedimentos ({proceduresData[item.id].length})</span>
                            </h4>
                            {loadingProcedures[item.id] && (
                              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-500"></div>
                            )}
                          </div>
                          
                          <div className="space-y-3">
                            {proceduresData[item.id].map((procedure) => (
                              <ProcedureInlineCard
                                key={`${procedure.aih_id}_${procedure.procedure_sequence}`}
                                procedure={procedure}
                                isReadOnly={!hasFullAccess()}
                                onRemove={(proc) => handleRemoveProcedure(item.id, proc)}
                                onDelete={(proc) => handleDeleteProcedure(item.id, proc)}
                                onRestore={(proc) => handleRestoreProcedure(item.id, proc)}
                                onShowDetails={(proc) => {
                                  // Abrir modal de detalhes se necessário
                                  console.log('Detalhes do procedimento:', proc);
                                }}
                              />
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Ações Avançadas */}
                      <div className="bg-blue-50 p-3 rounded-lg">
                        <h4 className="font-semibold text-blue-900 mb-3">⚙️ Ações Avançadas</h4>
                        <div className="flex flex-wrap gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleOpenProcedureManager(item)}
                            className="flex items-center space-x-2"
                          >
                            <Stethoscope className="w-4 h-4" />
                            <span>Gerenciar Procedimentos</span>
                          </Button>
                          
                          {/* Botão de Edição (para admins/diretores) */}
                          {(user?.role === 'admin' || user?.role === 'director') && (
                            <Button
                              size="sm"
                              variant="outline"
                              className="flex items-center space-x-2"
                            >
                              <Edit className="w-4 h-4" />
                              <span>Editar AIH</span>
                            </Button>
                          )}
                          
                          {/* Botão de Exclusão (para coordenadores, diretores e admins) */}
                          {(user?.role === 'admin' || user?.role === 'director' || user?.role === 'coordinator') && (
                            <>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleDeleteRequest('aih', item.id, item.aih_number)}
                                className="flex items-center space-x-2 text-red-600 hover:text-red-700"
                              >
                                <Trash2 className="w-4 h-4" />
                                <span>Excluir AIH</span>
                              </Button>
                              
                              {/* NOVO: Exclusão Completa */}
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleCompleteDeleteRequest(
                                  item.id, 
                                  item.aih_number, 
                                  item.patients?.name || 'Paciente não identificado'
                                )}
                                className="flex items-center space-x-2 text-red-800 hover:text-red-900 border-red-300 hover:border-red-400 bg-red-50 hover:bg-red-100"
                              >
                                <AlertTriangle className="w-4 h-4" />
                                <span>Exclusão Completa</span>
                              </Button>
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Paginação */}
          {filteredData.length > itemsPerPage && (
            <div className="flex justify-between items-center mt-4">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage(Math.max(0, currentPage - 1))}
                disabled={currentPage === 0}
              >
                Anterior
              </Button>
              <span className="text-sm text-gray-600">
                Página {currentPage + 1} de {Math.ceil(filteredData.length / itemsPerPage)}
              </span>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage(Math.min(Math.ceil(filteredData.length / itemsPerPage) - 1, currentPage + 1))}
                disabled={currentPage >= Math.ceil(filteredData.length / itemsPerPage) - 1}
              >
                Próximo
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Modal de Gerenciamento de Procedimentos */}
      <Dialog open={procedureManagerOpen} onOpenChange={setProcedureManagerOpen}>
        <DialogContent className="max-w-7xl max-h-[90vh] overflow-hidden">
          <DialogHeader>
            <DialogTitle className="flex items-center space-x-2">
              <Stethoscope className="w-5 h-5 text-blue-600" />
              <span>Gerenciamento de Procedimentos</span>
            </DialogTitle>
          </DialogHeader>
          <div className="overflow-y-auto max-h-[calc(90vh-120px)]">
            {selectedAIHForProcedures && (
              <AIHProcedureManager
                aihId={selectedAIHForProcedures.id}
                aihNumber={selectedAIHForProcedures.aih_number}
                patientName={selectedAIHForProcedures.patients?.name || 'Paciente não identificado'}
                isReadOnly={!hasFullAccess()}
                onProceduresChanged={handleProceduresChanged}
              />
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Dialog de Confirmação de Deleção */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar Deleção</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja deletar {itemToDelete?.type === 'patient' ? 'o paciente' : 'a AIH'} "{itemToDelete?.name}"?
              Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteConfirm} className="bg-red-600 hover:bg-red-700">
              Deletar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* NOVO: Dialog de Confirmação de Exclusão Completa */}
      <AlertDialog open={completeDeleteDialogOpen} onOpenChange={setCompleteDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center space-x-2 text-red-800">
              <AlertTriangle className="w-5 h-5" />
              <span>Exclusão Completa - ATENÇÃO</span>
            </AlertDialogTitle>
            <AlertDialogDescription className="space-y-3">
              <p className="text-red-700 font-medium">
                🚨 Esta ação irá excluir COMPLETAMENTE:
              </p>
              <div className="bg-red-50 p-3 rounded-md border border-red-200">
                <ul className="text-sm space-y-1">
                  <li>• <strong>AIH:</strong> {aihToCompleteDelete?.name}</li>
                  <li>• <strong>Paciente:</strong> {aihToCompleteDelete?.patientName}</li>
                  <li>• <strong>Todos os procedimentos</strong> relacionados</li>
                  <li>• <strong>Todos os matches</strong> encontrados</li>
                  <li>• <strong>Histórico de auditoria</strong> (mantido para compliance)</li>
                </ul>
              </div>
              <p className="text-gray-600 text-sm">
                <strong>Nota:</strong> Se o paciente possuir outras AIHs, apenas a AIH atual será excluída.
                O paciente será mantido. Esta ação é <strong>irreversível</strong>.
              </p>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleCompleteDeleteConfirm} 
              className="bg-red-800 hover:bg-red-900 text-white"
            >
              <AlertTriangle className="w-4 h-4 mr-2" />
              Confirmar Exclusão Completa
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default PatientManagement;

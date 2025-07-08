import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { User, FileText, Clock, CheckCircle, DollarSign, Calendar, RefreshCw, Search, Trash2, Eye, Edit, ChevronDown, ChevronUp, Filter, Download, Settings, AlertTriangle, RotateCcw, Info, Activity, CreditCard, Stethoscope } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { AIHPersistenceService } from '../services/aihPersistenceService';

import AIHExecutiveSummary from './AIHExecutiveSummary';
import ProcedureInlineCard from './ProcedureInlineCard';
import { formatCurrency as baseCurrency } from '../utils/validation';
import { useToast } from '@/hooks/use-toast';

// 🔧 CORREÇÃO: Função para formatar valores que vêm em centavos
const formatCurrency = (value: number | undefined | null): string => {
  if (!value) return 'R$ 0,00';
  // Dividir por 100 se valor parece estar em centavos (>= 1000)
  const realValue = value >= 1000 ? value / 100 : value;
  return baseCurrency(realValue);
};

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
  const { user, hasFullAccess, canManageProcedures } = useAuth();
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
  
  // Filtros simplificados
  const [globalSearch, setGlobalSearch] = useState('');

  // Paginação
  const [currentPage, setCurrentPage] = useState(0);
  const [itemsPerPage] = useState(10);

  // Estados para deleção
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [itemToDelete, setItemToDelete] = useState<{type: 'patient' | 'aih', id: string, name: string} | null>(null);

  // Estados para gerenciamento inline de procedimentos
  const [proceduresData, setProceduresData] = useState<{[aihId: string]: any[]}>({});
  const [loadingProcedures, setLoadingProcedures] = useState<{[aihId: string]: boolean}>({});
  
  // 🎯 NOVO: Estado para valores totais recalculados dinamicamente
  const [aihTotalValues, setAihTotalValues] = useState<{[aihId: string]: number}>({});

  // Estados para exclusão completa
  const [completeDeleteDialogOpen, setCompleteDeleteDialogOpen] = useState(false);
  const [aihToCompleteDelete, setAihToCompleteDelete] = useState<{id: string, name: string, patientName: string} | null>(null);

  // NOVOS ESTADOS: Diagnóstico e Sincronização
  const [diagnosticModalOpen, setDiagnosticModalOpen] = useState(false);
  const [diagnosticData, setDiagnosticData] = useState<any>(null);
  const [isDiagnosing, setIsDiagnosing] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncResults, setSyncResults] = useState<any>(null);

  // NOVOS ESTADOS: Filtros por data
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  // 🎯 NOVA FUNÇÃO: Recalcular valor total da AIH baseado nos procedimentos ativos
  const recalculateAIHTotal = (aihId: string, procedures: any[]) => {
    // 🎯 CALCULAR APENAS PROCEDIMENTOS ATIVOS/APROVADOS
    const activeProcedures = procedures.filter(proc => 
      proc.match_status === 'matched' || proc.match_status === 'manual' // ✅ VALORES CORRETOS DA CONSTRAINT
    );
    
    const totalValue = activeProcedures.reduce((sum, proc) => {
      return sum + (proc.value_charged || 0);
    }, 0);
    
    // Atualizar estado do valor total recalculado
    setAihTotalValues(prev => ({
      ...prev,
      [aihId]: totalValue
    }));
    
    console.log(`💰 AIH ${aihId}: ${activeProcedures.length} procedimentos ativos = R$ ${(totalValue/100).toFixed(2)}`);
    
    return totalValue;
  };

  useEffect(() => {
    if (currentHospitalId) {
      loadAllData();
    }
  }, [currentHospitalId]);

  // Resetar página quando filtros mudarem
  useEffect(() => {
    setCurrentPage(0);
  }, [globalSearch, startDate, endDate]);

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
      
      // 🎯 RECALCULAR VALOR TOTAL INICIAL
      recalculateAIHTotal(aihId, procedures);
      
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
      // 🎯 NOVA LÓGICA: Marcar como REJEITADO (valor permitido na constraint)
      const updatedProcedures = proceduresData[aihId].map(proc => 
        proc.procedure_sequence === procedure.procedure_sequence
          ? { ...proc, match_status: 'rejected' } // ✅ VALOR PERMITIDO
          : proc
      );
      
      // Atualizar estado local
      setProceduresData(prev => ({ ...prev, [aihId]: updatedProcedures }));
      
      // 🎯 RECALCULAR VALOR TOTAL DA AIH
      const newTotal = recalculateAIHTotal(aihId, updatedProcedures);
      
      toast({
        title: "✅ Procedimento Inativado",
        description: `Procedimento inativado. Novo valor da AIH: R$ ${(newTotal/100).toFixed(2)}`,
      });
    } catch (error) {
      console.error('❌ Erro ao inativar procedimento:', error);
      toast({
        title: "Erro",
        description: "Falha ao inativar procedimento",
        variant: "destructive"
      });
    }
  };

  const handleDeleteProcedure = async (aihId: string, procedure: any) => {
    try {
      // 🎯 NOVA LÓGICA: Remover COMPLETAMENTE da tela
      const updatedProcedures = proceduresData[aihId].filter(proc => 
        proc.procedure_sequence !== procedure.procedure_sequence
      );
      
      // Atualizar estado local (remove da visualização)
      setProceduresData(prev => ({ ...prev, [aihId]: updatedProcedures }));
      
      // 🎯 RECALCULAR VALOR TOTAL DA AIH
      const newTotal = recalculateAIHTotal(aihId, updatedProcedures);
      
      toast({
        title: "🗑️ Procedimento Excluído",
        description: `Procedimento removido. Novo valor da AIH: R$ ${(newTotal/100).toFixed(2)}`,
        variant: "destructive"
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
      // 🎯 NOVA LÓGICA: Reativar procedimento
      const updatedProcedures = proceduresData[aihId].map(proc => 
        proc.procedure_sequence === procedure.procedure_sequence
          ? { ...proc, match_status: 'matched' } // ✅ VALOR PERMITIDO PARA ATIVO
          : proc
      );
      
      // Atualizar estado local
      setProceduresData(prev => ({ ...prev, [aihId]: updatedProcedures }));
      
      // 🎯 RECALCULAR VALOR TOTAL DA AIH  
      const newTotal = recalculateAIHTotal(aihId, updatedProcedures);
      
      toast({
        title: "♻️ Procedimento Reativado",
        description: `Procedimento reativado. Novo valor da AIH: R$ ${(newTotal/100).toFixed(2)}`,
      });
    } catch (error) {
      console.error('❌ Erro ao reativar procedimento:', error);
      toast({
        title: "Erro",
        description: "Falha ao reativar procedimento",
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
    // Filtro de busca por texto
    const matchesSearch = 
      item.aih_number.toLowerCase().includes(globalSearch.toLowerCase()) ||
      (item.patients?.name && item.patients.name.toLowerCase().includes(globalSearch.toLowerCase())) ||
      (item.patient?.cns && item.patient.cns.includes(globalSearch));
    
    // Filtro por intervalo de datas
    let matchesDateRange = true;
    if (startDate || endDate) {
      const admissionDate = new Date(item.admission_date);
      
      if (startDate) {
        const start = new Date(startDate);
        matchesDateRange = matchesDateRange && admissionDate >= start;
      }
      
      if (endDate) {
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999); // Include the entire end date
        matchesDateRange = matchesDateRange && admissionDate <= end;
      }
    }
    
    return matchesSearch && matchesDateRange;
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

  // NOVA FUNÇÃO: Executar diagnóstico
  const handleRunDiagnostic = async () => {
    if (!currentHospitalId) return;
    
    setIsDiagnosing(true);
    try {
      console.log('🔍 Executando diagnóstico de procedimentos...');
      const diagnostic = await persistenceService.diagnoseProceduresData(currentHospitalId);
      setDiagnosticData(diagnostic);
      
      toast({
        title: "Diagnóstico Concluído",
        description: `${diagnostic.aihs.total} AIHs analisadas, ${diagnostic.procedures.total} procedimentos encontrados`,
      });
    } catch (error) {
      console.error('❌ Erro no diagnóstico:', error);
      toast({
        title: "Erro no Diagnóstico",
        description: "Falha ao executar diagnóstico do sistema",
        variant: "destructive"
      });
    } finally {
      setIsDiagnosing(false);
    }
  };

  // NOVA FUNÇÃO: Executar sincronização
  const handleRunSync = async (dryRun: boolean = false) => {
    if (!currentHospitalId) return;
    
    setIsSyncing(true);
    try {
      console.log(`🔄 Executando sincronização ${dryRun ? '(simulação)' : ''}...`);
      const syncResult = await persistenceService.syncMissingProcedures(currentHospitalId, {
        dryRun,
        maxAIHs: 50
      });
      
      setSyncResults(syncResult);
      
      if (!dryRun) {
        // Recarregar dados após sincronização real
        await loadAllData();
      }
      
      toast({
        title: dryRun ? "Simulação Concluída" : "Sincronização Concluída",
        description: `${syncResult.synchronized}/${syncResult.processed} AIHs ${dryRun ? 'seriam sincronizadas' : 'sincronizadas'}`,
      });
    } catch (error) {
      console.error('❌ Erro na sincronização:', error);
      toast({
        title: "Erro na Sincronização",
        description: "Falha ao executar sincronização de procedimentos",
        variant: "destructive"
      });
    } finally {
      setIsSyncing(false);
    }
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
            
            {/* NOVO: Botão de Diagnóstico */}
            {(user?.role === 'admin' || user?.role === 'developer') && (
              <Button 
                onClick={() => setDiagnosticModalOpen(true)}
                variant="outline"
                size="sm"
                className="bg-blue-50 border-blue-200 text-blue-700 hover:bg-blue-100"
              >
                <Activity className="w-4 h-4 mr-2" />
                Diagnóstico
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* Estatísticas Simplificadas */}
      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Card className="hover:shadow-md transition-shadow">
            <CardContent className="p-6">
              <div className="flex items-center space-x-4">
                <div className="p-3 bg-blue-100 rounded-lg">
                  <User className="w-6 h-6 text-blue-600" />
                </div>
                <div>
                  <p className="text-sm text-gray-600 font-medium">Total de Pacientes</p>
                  <p className="text-2xl font-bold text-gray-900">{stats.total_patients}</p>
                  <p className="text-xs text-blue-600 mt-1">Cadastrados no sistema</p>
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card className="hover:shadow-md transition-shadow">
            <CardContent className="p-6">
              <div className="flex items-center space-x-4">
                <div className="p-3 bg-green-100 rounded-lg">
                  <FileText className="w-6 h-6 text-green-600" />
                </div>
                <div>
                  <p className="text-sm text-gray-600 font-medium">AIHs Processadas</p>
                  <p className="text-2xl font-bold text-gray-900">{stats.total_aihs}</p>
                  <p className="text-xs text-green-600 mt-1">Total no sistema</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}



      {/* Filtros Modernos */}
      <Card className="border-l-4 border-l-blue-500 shadow-sm">
        <CardContent className="p-6">
          <div className="flex items-center space-x-2 mb-4">
            <Filter className="w-5 h-5 text-blue-600" />
            <h3 className="text-lg font-semibold text-gray-900">Filtros de Pesquisa</h3>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Campo de Busca */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700 flex items-center space-x-1">
                <Search className="w-4 h-4" />
                <span>Buscar</span>
              </label>
              <Input
                placeholder="AIH, paciente ou CNS..."
                value={globalSearch}
                onChange={(e) => setGlobalSearch(e.target.value)}
                className="w-full border-gray-300 focus:border-blue-500 focus:ring-blue-500"
              />
            </div>

            {/* Data Início */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700 flex items-center space-x-1">
                <Calendar className="w-4 h-4" />
                <span>Data Início</span>
              </label>
              <Input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full border-gray-300 focus:border-blue-500 focus:ring-blue-500"
              />
            </div>

            {/* Data Fim */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700 flex items-center space-x-1">
                <Calendar className="w-4 h-4" />
                <span>Data Fim</span>
              </label>
              <Input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="w-full border-gray-300 focus:border-blue-500 focus:ring-blue-500"
              />
            </div>
          </div>

          {/* Botões de Ação dos Filtros */}
          <div className="flex items-center justify-between mt-6 pt-4 border-t border-gray-200">
            <div className="flex items-center space-x-2 text-sm text-gray-600">
              <Info className="w-4 h-4" />
              <span>Use os filtros para refinar sua pesquisa por período</span>
            </div>
            
            <div className="flex items-center space-x-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setGlobalSearch('');
                  setStartDate('');
                  setEndDate('');
                }}
                className="text-gray-600 hover:text-gray-800"
              >
                <RotateCcw className="w-4 h-4 mr-1" />
                Limpar
              </Button>
              
              <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-300">
                {filteredData.length} AIH{filteredData.length !== 1 ? 's' : ''} encontrada{filteredData.length !== 1 ? 's' : ''}
              </Badge>
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
                <div key={item.id} className="border border-gray-200 rounded-lg p-6 hover:shadow-md transition-shadow bg-white">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-4 flex-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleExpandAIH(item.id)}
                        className="text-gray-500 hover:text-gray-700"
                      >
                        {expandedItems.has(item.id) ? 
                          <ChevronUp className="w-5 h-5" /> : 
                          <ChevronDown className="w-5 h-5" />
                        }
                      </Button>

                      <div className="flex-1">
                        {/* Nome do Paciente - Destaque Principal */}
                        <div className="mb-2">
                          <h2 className="text-xl font-bold text-gray-900 flex items-center space-x-2">
                            <User className="w-5 h-5 text-blue-600" />
                            <span>{item.patients?.name || 'Paciente não identificado'}</span>
                          </h2>
                        </div>

                        {/* Informações da AIH */}
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-3">
                          <div className="flex items-center space-x-2">
                            <FileText className="w-4 h-4 text-gray-500" />
                            <div>
                              <p className="text-xs text-gray-500 uppercase tracking-wide">AIH</p>
                              <p className="font-semibold text-gray-900">{item.aih_number}</p>
                            </div>
                          </div>

                          <div className="flex items-center space-x-2">
                            <Calendar className="w-4 h-4 text-gray-500" />
                            <div>
                              <p className="text-xs text-gray-500 uppercase tracking-wide">Admissão</p>
                              <p className="font-medium text-gray-700">{formatDate(item.admission_date)}</p>
                            </div>
                          </div>

                          <div className="flex items-center space-x-2">
                            <Activity className="w-4 h-4 text-gray-500" />
                            <div>
                              <p className="text-xs text-gray-500 uppercase tracking-wide">CID Principal</p>
                              <p className="font-medium text-gray-700">{item.main_cid}</p>
                            </div>
                          </div>
                        </div>

                        {/* CNS e Informações Adicionais */}
                        <div className="mt-3 flex items-center space-x-4 text-sm text-gray-600">
                          <span className="flex items-center space-x-1">
                            <CreditCard className="w-4 h-4" />
                            <span>CNS: {item.patients?.cns || 'Não informado'}</span>
                          </span>
                          {item.specialty && (
                            <span className="flex items-center space-x-1">
                              <Stethoscope className="w-4 h-4" />
                              <span>{item.specialty}</span>
                            </span>
                          )}
                          <Badge variant="outline" className="bg-green-50 border-green-200 text-green-700">
                            <CheckCircle className="w-3 h-3 mr-1" />
                            Processada
                          </Badge>
                        </div>
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
                      {(aihTotalValues[item.id] !== undefined || item.calculated_total_value) && (
                        <Badge variant="outline" className="bg-green-50 border-green-200 text-green-800 hover:bg-green-100 font-semibold">
                          <DollarSign className="w-3 h-3 mr-1" />
                          {formatCurrency(aihTotalValues[item.id] !== undefined ? aihTotalValues[item.id] : item.calculated_total_value)}
                          {aihTotalValues[item.id] !== undefined && (
                            <span className="ml-1 text-xs text-green-600">●</span>
                          )}
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
                          total_procedures: proceduresData[item.id]?.length || item.total_procedures,
                          total_value: aihTotalValues[item.id] !== undefined ? aihTotalValues[item.id] : item.calculated_total_value,
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
                              <FileText className="w-4 h-4" />
                              <span>Procedimentos ({proceduresData[item.id].length})</span>
                            </h4>
                            {loadingProcedures[item.id] && (
                              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-500"></div>
                            )}
                          </div>
                          
                          {/* 🎯 NOVO: Resumo de Valores por Status */}
                          {aihTotalValues[item.id] !== undefined && (
                            <div className="mb-4 p-3 bg-white rounded-lg border border-slate-200">
                              <h5 className="font-medium text-slate-800 mb-2 flex items-center">
                                <DollarSign className="w-4 h-4 mr-1" />
                                Resumo Financeiro da AIH
                              </h5>
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                                {(() => {
                                  const approved = proceduresData[item.id].filter(p => p.match_status === 'matched' || p.match_status === 'manual');
                                  
                                  const approvedValue = approved.reduce((sum, p) => sum + (p.value_charged || p.sigtap_procedures?.value_hosp_total || 0), 0);
                                  
                                  return (
                                    <>
                                      <div className="text-center p-2 bg-green-50 rounded border border-green-200">
                                        <p className="font-medium text-green-800">{approved.length}</p>
                                        <p className="text-xs text-green-600">Aprovados</p>
                                        <p className="text-xs font-semibold text-green-700">{formatCurrency(approvedValue)}</p>
                                      </div>
                                      <div className="text-center p-2 bg-blue-50 rounded border border-blue-200">
                                        <p className="font-semibold text-blue-800">{formatCurrency(aihTotalValues[item.id])}</p>
                                        <p className="text-xs text-blue-600">TOTAL FATURÁVEL</p>
                                        <p className="text-xs text-blue-500">({approved.length} proc.)</p>
                                      </div>
                                    </>
                                  );
                                })()}
                              </div>
                            </div>
                          )}
                          
                          <div className="space-y-3">
                            {proceduresData[item.id].map((procedure) => (
                              <ProcedureInlineCard
                                key={`${procedure.aih_id}_${procedure.procedure_sequence}`}
                                procedure={procedure}
                                isReadOnly={!canManageProcedures()}
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

                      {/* Ações Rápidas da AIH */}
                      {(user?.role === 'admin' || user?.role === 'director' || user?.role === 'coordinator') && (
                        <div className="bg-red-50 p-3 rounded-lg border border-red-200">
                          <h4 className="font-semibold text-red-900 mb-3">🗑️ Ações de Exclusão</h4>
                          <div className="flex flex-wrap gap-2">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleDeleteRequest('aih', item.id, item.aih_number)}
                              className="flex items-center space-x-2 text-red-600 hover:text-red-700 border-red-300 hover:border-red-400"
                            >
                              <Trash2 className="w-4 h-4" />
                              <span>Excluir AIH</span>
                            </Button>
                            
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleCompleteDeleteRequest(
                                item.id, 
                                item.aih_number, 
                                item.patients?.name || 'Paciente não identificado'
                              )}
                              className="flex items-center space-x-2 text-red-800 hover:text-red-900 border-red-400 hover:border-red-500 bg-red-100 hover:bg-red-200"
                            >
                              <AlertTriangle className="w-4 h-4" />
                              <span>Exclusão Completa</span>
                            </Button>
                          </div>
                          <p className="text-xs text-red-600 mt-2">
                            💡 <strong>Dica:</strong> Para excluir procedimentos individuais, use os botões nos cards dos procedimentos acima.
                          </p>
                        </div>
                      )}
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

      {/* NOVO: Modal de Diagnóstico e Sincronização */}
      <Dialog open={diagnosticModalOpen} onOpenChange={setDiagnosticModalOpen}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-hidden">
          <DialogHeader>
            <DialogTitle className="flex items-center space-x-2">
              <Activity className="w-5 h-5 text-blue-600" />
              <span>Diagnóstico e Sincronização de Procedimentos</span>
            </DialogTitle>
          </DialogHeader>
          
          <div className="overflow-y-auto max-h-[calc(80vh-120px)] space-y-6">
            {/* Seção de Diagnóstico */}
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-semibold text-gray-900">Diagnóstico do Sistema</h3>
                  <Button 
                    onClick={handleRunDiagnostic}
                    disabled={isDiagnosing}
                    size="sm"
                  >
                    {isDiagnosing ? (
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-500 mr-2"></div>
                    ) : (
                      <Search className="w-4 h-4 mr-2" />
                    )}
                    {isDiagnosing ? 'Analisando...' : 'Executar Diagnóstico'}
                  </Button>
                </div>

                {diagnosticData && (
                  <div className="space-y-4">
                    {/* Estatísticas de AIHs */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                      <div className="bg-blue-50 p-3 rounded-lg">
                        <p className="text-xs text-blue-600">Total AIHs</p>
                        <p className="text-lg font-bold text-blue-800">{diagnosticData.aihs.total}</p>
                      </div>
                      <div className="bg-green-50 p-3 rounded-lg">
                        <p className="text-xs text-green-600">Com Procedimentos</p>
                        <p className="text-lg font-bold text-green-800">{diagnosticData.aihs.withProcedures}</p>
                      </div>
                      <div className="bg-red-50 p-3 rounded-lg">
                        <p className="text-xs text-red-600">Sem Procedimentos</p>
                        <p className="text-lg font-bold text-red-800">{diagnosticData.aihs.withoutProcedures}</p>
                      </div>
                      <div className="bg-yellow-50 p-3 rounded-lg">
                        <p className="text-xs text-yellow-600">Inconsistentes</p>
                        <p className="text-lg font-bold text-yellow-800">{diagnosticData.aihs.inconsistent}</p>
                      </div>
                    </div>

                    {/* Estatísticas de Procedimentos */}
                    <div className="bg-gray-50 p-3 rounded-lg">
                      <h4 className="font-medium text-gray-900 mb-2">Procedimentos</h4>
                      <div className="grid grid-cols-2 md:grid-cols-5 gap-2 text-sm">
                        <span>Total: <strong>{diagnosticData.procedures.total}</strong></span>
                        <span>Pendentes: <strong>{diagnosticData.procedures.pending}</strong></span>
                        <span>Aprovados: <strong>{diagnosticData.procedures.approved}</strong></span>
                        <span>Rejeitados: <strong>{diagnosticData.procedures.rejected}</strong></span>
                        <span>Removidos: <strong>{diagnosticData.procedures.removed}</strong></span>
                      </div>
                    </div>

                    {/* Problemas e Recomendações */}
                    {(diagnosticData.issues.length > 0 || diagnosticData.recommendations.length > 0) && (
                      <div className="space-y-3">
                        {diagnosticData.issues.length > 0 && (
                          <div className="bg-red-50 border border-red-200 p-3 rounded-lg">
                            <h4 className="font-medium text-red-900 mb-2 flex items-center">
                              <AlertTriangle className="w-4 h-4 mr-2" />
                              Problemas Identificados ({diagnosticData.issues.length})
                            </h4>
                            <ul className="text-sm text-red-700 space-y-1">
                              {diagnosticData.issues.slice(0, 5).map((issue: string, index: number) => (
                                <li key={index}>• {issue}</li>
                              ))}
                              {diagnosticData.issues.length > 5 && (
                                <li className="italic">... e mais {diagnosticData.issues.length - 5} problemas</li>
                              )}
                            </ul>
                          </div>
                        )}

                        {diagnosticData.recommendations.length > 0 && (
                          <div className="bg-blue-50 border border-blue-200 p-3 rounded-lg">
                            <h4 className="font-medium text-blue-900 mb-2 flex items-center">
                              <CheckCircle className="w-4 h-4 mr-2" />
                              Recomendações ({diagnosticData.recommendations.length})
                            </h4>
                            <ul className="text-sm text-blue-700 space-y-1">
                              {diagnosticData.recommendations.map((rec: string, index: number) => (
                                <li key={index}>• {rec}</li>
                              ))}
                            </ul>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Seção de Sincronização */}
            {diagnosticData && diagnosticData.aihs.withoutProcedures > 0 && (
              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="font-semibold text-gray-900">Sincronização de Procedimentos</h3>
                    <div className="flex space-x-2">
                      <Button 
                        onClick={() => handleRunSync(true)}
                        disabled={isSyncing}
                        variant="outline"
                        size="sm"
                      >
                        {isSyncing ? (
                          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-500 mr-2"></div>
                        ) : (
                          <Eye className="w-4 h-4 mr-2" />
                        )}
                        Simular
                      </Button>
                      <Button 
                        onClick={() => handleRunSync(false)}
                        disabled={isSyncing}
                        size="sm"
                        className="bg-green-600 hover:bg-green-700"
                      >
                        {isSyncing ? (
                          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                        ) : (
                          <Download className="w-4 h-4 mr-2" />
                        )}
                        Executar Sincronização
                      </Button>
                    </div>
                  </div>

                  <p className="text-sm text-gray-600 mb-4">
                    Esta operação criará procedimentos principais para AIHs que não possuem procedimentos cadastrados.
                  </p>

                  {syncResults && (
                    <div className="space-y-3">
                      <div className="grid grid-cols-3 gap-3">
                        <div className="bg-blue-50 p-3 rounded-lg text-center">
                          <p className="text-xs text-blue-600">Processadas</p>
                          <p className="text-lg font-bold text-blue-800">{syncResults.processed}</p>
                        </div>
                        <div className="bg-green-50 p-3 rounded-lg text-center">
                          <p className="text-xs text-green-600">Sincronizadas</p>
                          <p className="text-lg font-bold text-green-800">{syncResults.synchronized}</p>
                        </div>
                        <div className="bg-red-50 p-3 rounded-lg text-center">
                          <p className="text-xs text-red-600">Erros</p>
                          <p className="text-lg font-bold text-red-800">{syncResults.errors.length}</p>
                        </div>
                      </div>

                      {syncResults.details.length > 0 && (
                        <div className="bg-gray-50 p-3 rounded-lg max-h-48 overflow-y-auto">
                          <h4 className="font-medium text-gray-900 mb-2">Detalhes da Sincronização</h4>
                          <div className="space-y-1 text-sm">
                            {syncResults.details.slice(0, 10).map((detail: any, index: number) => (
                              <div key={index} className={`flex justify-between ${
                                detail.status === 'success' ? 'text-green-700' : 'text-red-700'
                              }`}>
                                <span>AIH {detail.aihNumber}</span>
                                <span>{detail.message}</span>
                              </div>
                            ))}
                            {syncResults.details.length > 10 && (
                              <p className="italic text-gray-500">... e mais {syncResults.details.length - 10} registros</p>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default PatientManagement;

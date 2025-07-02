import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Search, Filter, FileText, User, Calendar, DollarSign, AlertCircle, CheckCircle, Clock, Eye, RefreshCw, Trash2, ChevronDown, ChevronRight, Download, Edit } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { AIHPersistenceService } from '../services/aihPersistenceService';
import { formatCurrency } from '../utils/validation';
import { useToast } from '@/components/ui/use-toast';

// Criar instância do serviço
const persistenceService = new AIHPersistenceService();

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

const PatientManagement = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  
  // MODO DESENVOLVIMENTO: hospital_id com fallback
  const currentHospitalId = user?.hospital_id || '68bf9b1a-9d0b-423b-9bb3-3c02017b1d7b';
  
  const [patients, setPatients] = useState<Patient[]>([]);
  const [aihs, setAIHs] = useState<AIH[]>([]);
  const [stats, setStats] = useState<HospitalStats | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('patients');
  
  // Estados de expansão
  const [expandedPatients, setExpandedPatients] = useState<Set<string>>(new Set());
  const [expandedAIHs, setExpandedAIHs] = useState<Set<string>>(new Set());
  
  // Filtros
  const [patientSearch, setPatientSearch] = useState('');
  const [aihSearch, setAihSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [dateFilter, setDateFilter] = useState('');

  // Paginação
  const [patientsPage, setPatientsPage] = useState(0);
  const [aihsPage, setAihsPage] = useState(0);
  const itemsPerPage = 20;

  // Estados para exclusão
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [itemToDelete, setItemToDelete] = useState<{type: 'patient' | 'aih'; id: string; name: string} | null>(null);

  // Carregar dados iniciais
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
      console.log('✅ Dados de pacientes carregados com sucesso');
    } catch (error) {
      console.error('❌ Erro ao carregar dados:', error);
      toast({
        title: "Erro",
        description: "Falha ao carregar dados do sistema",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  const loadPatients = async () => {
    try {
      console.log('🔍 Carregando pacientes para hospital:', currentHospitalId);
      const data = await persistenceService.getPatients(currentHospitalId, {
        name: patientSearch || undefined,
        limit: 100
      });
      
      // Buscar AIHs e associar aos pacientes por nome
      const allAIHs = await persistenceService.getAIHs(currentHospitalId, { limit: 200 });
      
      const patientsWithAIHs = data.map((patient: Patient) => {
        const patientAIHs = allAIHs.filter((aih: any) => 
          aih.patients?.name === patient.name || aih.patients?.cns === patient.cns
        );
        return { ...patient, aihs: patientAIHs };
      });
      
      setPatients(patientsWithAIHs);
      console.log('📊 Pacientes carregados:', patientsWithAIHs.length);
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
        aihNumber: aihSearch || undefined,
        dateFrom: dateFilter || undefined,
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

  // Funções de expansão
  const togglePatientExpansion = (patientId: string) => {
    const newExpanded = new Set(expandedPatients);
    if (newExpanded.has(patientId)) {
      newExpanded.delete(patientId);
    } else {
      newExpanded.add(patientId);
    }
    setExpandedPatients(newExpanded);
  };

  const toggleAIHExpansion = (aihId: string) => {
    const newExpanded = new Set(expandedAIHs);
    if (newExpanded.has(aihId)) {
      newExpanded.delete(aihId);
    } else {
      newExpanded.add(aihId);
    }
    setExpandedAIHs(newExpanded);
  };

  // Funções de exclusão
  const handleDeleteRequest = (type: 'patient' | 'aih', id: string, name: string) => {
    setItemToDelete({ type, id, name });
    setDeleteDialogOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (!itemToDelete) return;
    
    try {
      setIsLoading(true);
      
      if (itemToDelete.type === 'patient') {
        // Excluir paciente (e suas AIHs em cascata)
        await persistenceService.deletePatient(itemToDelete.id);
        toast({
          title: "✅ Paciente excluído",
          description: `${itemToDelete.name} foi removido do sistema`,
        });
      } else {
        // Excluir AIH específica
        await persistenceService.deleteAIH(itemToDelete.id);
        toast({
          title: "✅ AIH excluída", 
          description: `AIH ${itemToDelete.name} foi removida do sistema`,
        });
      }
      
      // Recarregar dados
      await loadAllData();
      
    } catch (error) {
      console.error('❌ Erro ao excluir:', error);
      toast({
        title: "Erro",
        description: `Falha ao excluir ${itemToDelete.type === 'patient' ? 'paciente' : 'AIH'}`,
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
      setDeleteDialogOpen(false);
      setItemToDelete(null);
    }
  };

  // Filtros aplicados
  const filteredPatients = patients.filter(patient => 
    patient.name.toLowerCase().includes(patientSearch.toLowerCase()) ||
    patient.cns.includes(patientSearch)
  );

  const filteredAIHs = aihs.filter(aih => {
    const matchesSearch = aih.aih_number.includes(aihSearch) || 
                         aih.patients?.name.toLowerCase().includes(aihSearch.toLowerCase());
    const matchesStatus = statusFilter === 'all' || aih.processing_status === statusFilter;
    const matchesDate = !dateFilter || aih.admission_date >= dateFilter;
    
    return matchesSearch && matchesStatus && matchesDate;
  });

  // Paginação
  const paginatedPatients = filteredPatients.slice(
    patientsPage * itemsPerPage,
    (patientsPage + 1) * itemsPerPage
  );

  const paginatedAIHs = filteredAIHs.slice(
    aihsPage * itemsPerPage,
    (aihsPage + 1) * itemsPerPage
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
          <h1 className="text-2xl font-bold text-gray-900">Gestão de Pacientes</h1>
          <p className="text-gray-600">Visualize e gerencie pacientes e AIHs processadas</p>
        </div>
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

      {/* Estatísticas */}
      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-4">
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
        </div>
      )}

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="patients">👥 Pacientes ({filteredPatients.length})</TabsTrigger>
          <TabsTrigger value="aihs">📄 AIHs ({filteredAIHs.length})</TabsTrigger>
        </TabsList>

        {/* TAB PACIENTES */}
        <TabsContent value="patients" className="space-y-4">
          {/* Filtros Pacientes */}
          <Card>
            <CardContent className="p-4">
              <div className="flex space-x-4">
                <div className="flex-1">
                  <Input
                    placeholder="Buscar por nome ou CNS..."
                    value={patientSearch}
                    onChange={(e) => setPatientSearch(e.target.value)}
                  />
                </div>
                <Button onClick={loadPatients} disabled={isLoading} variant="outline">
                  <Search className="w-4 h-4" />
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Lista Pacientes */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <User className="w-5 h-5" />
                <span>Pacientes Cadastrados</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="flex items-center justify-center py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
                  <span className="ml-2">Carregando pacientes...</span>
                </div>
              ) : paginatedPatients.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  <User className="w-12 h-12 mx-auto mb-4 opacity-50" />
                  <p>Nenhum paciente encontrado</p>
                  <p className="text-sm">Processe algumas AIHs para ver pacientes aqui</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {paginatedPatients.map((patient) => (
                    <div key={patient.id} className="border rounded-lg">
                      {/* Linha Principal do Paciente */}
                      <div className="p-4 flex items-center justify-between hover:bg-gray-50">
                        <div className="flex items-center space-x-4">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => togglePatientExpansion(patient.id)}
                            className="p-1"
                          >
                            {expandedPatients.has(patient.id) ? 
                              <ChevronDown className="w-4 h-4" /> : 
                              <ChevronRight className="w-4 h-4" />
                            }
                          </Button>
                          
                          <div className="flex-1">
                            <div className="flex items-center space-x-3">
                              <h3 className="font-medium text-gray-900">{patient.name}</h3>
                              <Badge variant="outline" className="text-xs">
                                {patient.gender === 'M' ? '👨' : '👩'} CNS: {patient.cns}
                              </Badge>
                              {patient.medical_record && (
                                <Badge variant="secondary" className="text-xs">
                                  📋 {patient.medical_record}
                                </Badge>
                              )}
                            </div>
                            <p className="text-sm text-gray-600">
                              🎂 Nascimento: {formatDate(patient.birth_date)} • 
                              📄 AIHs: {patient.aihs?.length || 0} • 
                              📅 Cadastrado: {formatDate(patient.created_at)}
                            </p>
                          </div>
                        </div>
                        
                        <div className="flex items-center space-x-2">
                          <Badge variant="outline" className="text-xs">
                            {patient.aihs?.length || 0} AIH{(patient.aihs?.length || 0) !== 1 ? 's' : ''}
                          </Badge>
                          <Button
                            variant="destructive"
                            size="sm"
                            onClick={() => handleDeleteRequest('patient', patient.id, patient.name)}
                            className="h-8 w-8 p-0"
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>

                      {/* Detalhes Expandidos do Paciente */}
                      {expandedPatients.has(patient.id) && (
                        <div className="border-t bg-gray-50 p-4">
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                            {/* Informações Pessoais */}
                            <div>
                              <h4 className="font-medium text-sm text-gray-700 mb-2">👤 Informações Pessoais</h4>
                              <div className="bg-white p-3 rounded border space-y-1 text-sm">
                                <p><span className="font-medium">Nome:</span> {patient.name}</p>
                                <p><span className="font-medium">CNS:</span> {patient.cns}</p>
                                <p><span className="font-medium">Nascimento:</span> {formatDate(patient.birth_date)}</p>
                                <p><span className="font-medium">Gênero:</span> {patient.gender === 'M' ? 'Masculino' : 'Feminino'}</p>
                                {patient.mother_name && <p><span className="font-medium">Mãe:</span> {patient.mother_name}</p>}
                                {patient.nationality && <p><span className="font-medium">Nacionalidade:</span> {patient.nationality}</p>}
                                {patient.race_color && <p><span className="font-medium">Cor/Raça:</span> {patient.race_color}</p>}
                              </div>
                            </div>

                            {/* Informações de Contato */}
                            <div>
                              <h4 className="font-medium text-sm text-gray-700 mb-2">📧 Contato e Endereço</h4>
                              <div className="bg-white p-3 rounded border space-y-1 text-sm">
                                {patient.phone && <p><span className="font-medium">Telefone:</span> {patient.phone}</p>}
                                {patient.address && <p><span className="font-medium">Endereço:</span> {patient.address}</p>}
                                {patient.city && <p><span className="font-medium">Cidade:</span> {patient.city}</p>}
                                {patient.state && <p><span className="font-medium">Estado:</span> {patient.state}</p>}
                                {patient.medical_record && <p><span className="font-medium">Prontuário:</span> {patient.medical_record}</p>}
                                <p><span className="font-medium">Cadastrado:</span> {formatDate(patient.created_at)}</p>
                                <p><span className="font-medium">Atualizado:</span> {formatDate(patient.updated_at)}</p>
                              </div>
                            </div>
                          </div>

                          {/* AIHs do Paciente */}
                          {patient.aihs && patient.aihs.length > 0 && (
                            <div>
                              <h4 className="font-medium text-sm text-gray-700 mb-2">📄 AIHs do Paciente ({patient.aihs.length})</h4>
                              <div className="space-y-2">
                                {patient.aihs.map((aih) => (
                                  <div key={aih.id} className="bg-white border rounded p-3">
                                    <div className="flex items-center justify-between">
                                      <div className="flex-1">
                                        <div className="flex items-center space-x-3 mb-1">
                                          <span className="font-medium text-blue-600">🏥 AIH {aih.aih_number}</span>
                                          {getStatusBadge(aih.processing_status)}
                                          {aih.requires_manual_review && (
                                            <Badge variant="destructive" className="text-xs">⚠️ Revisão</Badge>
                                          )}
                                        </div>
                                        <p className="text-sm text-gray-600">
                                          🩺 Procedimento: {aih.procedure_code} • 
                                          📅 Internação: {formatDate(aih.admission_date)} • 
                                          🔬 CID: {aih.main_cid}
                                        </p>
                                        {aih.calculated_total_value && (
                                          <p className="text-sm font-medium text-green-600">
                                            💰 Valor: {formatCurrency(aih.calculated_total_value)}
                                          </p>
                                        )}
                                      </div>
                                      <Button
                                        variant="destructive"
                                        size="sm"
                                        onClick={() => handleDeleteRequest('aih', aih.id, aih.aih_number)}
                                        className="h-8 w-8 p-0"
                                      >
                                        <Trash2 className="w-4 h-4" />
                                      </Button>
                                    </div>

                                    {/* Matches da AIH */}
                                    {aih.aih_matches && aih.aih_matches.length > 0 && (
                                      <div className="mt-2 pt-2 border-t">
                                        <p className="text-xs text-gray-600 mb-1">🎯 Matches SIGTAP ({aih.aih_matches.length}):</p>
                                        <div className="flex flex-wrap gap-2">
                                          {aih.aih_matches.map((match, idx) => (
                                            <div key={idx} className="flex items-center space-x-2">
                                              {getScoreBadge(match.overall_score)}
                                              <span className="text-xs text-gray-600">
                                                {formatCurrency(match.calculated_total)}
                                              </span>
                                            </div>
                                          ))}
                                        </div>
                                      </div>
                                    )}
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* TAB AIHS */}
        <TabsContent value="aihs" className="space-y-4">
          {/* Filtros AIHs */}
          <Card>
            <CardContent className="p-4">
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <Input
                  placeholder="Buscar AIH ou paciente..."
                  value={aihSearch}
                  onChange={(e) => setAihSearch(e.target.value)}
                />
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
                <Input
                  type="date"
                  placeholder="Data de internação"
                  value={dateFilter}
                  onChange={(e) => setDateFilter(e.target.value)}
                />
                <Button onClick={loadAIHs} disabled={isLoading} variant="outline">
                  <Search className="w-4 h-4" />
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Lista AIHs */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <FileText className="w-5 h-5" />
                <span>AIHs Processadas</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="flex items-center justify-center py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
                  <span className="ml-2">Carregando AIHs...</span>
                </div>
              ) : paginatedAIHs.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  <FileText className="w-12 h-12 mx-auto mb-4 opacity-50" />
                  <p>Nenhuma AIH encontrada</p>
                  <p className="text-sm">Processe alguns PDFs para ver AIHs aqui</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {paginatedAIHs.map((aih) => (
                    <div key={aih.id} className="border rounded-lg">
                      {/* Linha Principal da AIH */}
                      <div className="p-4 flex items-center justify-between hover:bg-gray-50">
                        <div className="flex items-center space-x-4">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => toggleAIHExpansion(aih.id)}
                            className="p-1"
                          >
                            {expandedAIHs.has(aih.id) ? 
                              <ChevronDown className="w-4 h-4" /> : 
                              <ChevronRight className="w-4 h-4" />
                            }
                          </Button>
                          
                          <div className="flex-1">
                            <div className="flex items-center space-x-3">
                              <h3 className="font-medium text-blue-600">🏥 AIH {aih.aih_number}</h3>
                              {getStatusBadge(aih.processing_status)}
                              {aih.match_found && <Badge variant="default" className="text-xs bg-green-500">✅ Match</Badge>}
                              {aih.requires_manual_review && <Badge variant="destructive" className="text-xs">⚠️ Revisão</Badge>}
                            </div>
                            <p className="text-sm text-gray-600">
                              👤 Paciente: {aih.patients?.name} • 
                              📅 Internação: {formatDate(aih.admission_date)} • 
                              🩺 Procedimento: {aih.procedure_code}
                            </p>
                            {aih.calculated_total_value && (
                              <p className="text-sm font-medium text-green-600">
                                💰 Valor Calculado: {formatCurrency(aih.calculated_total_value)}
                              </p>
                            )}
                          </div>
                        </div>
                        
                        <div className="flex items-center space-x-2">
                          {aih.aih_matches && (
                            <Badge variant="outline" className="text-xs">
                              🎯 {aih.aih_matches.length} Match{aih.aih_matches.length !== 1 ? 'es' : ''}
                            </Badge>
                          )}
                          <Button
                            variant="destructive"
                            size="sm"
                            onClick={() => handleDeleteRequest('aih', aih.id, aih.aih_number)}
                            className="h-8 w-8 p-0"
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>

                      {/* Detalhes Expandidos da AIH */}
                      {expandedAIHs.has(aih.id) && (
                        <div className="border-t bg-gray-50 p-4">
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {/* Informações da AIH */}
                            <div>
                              <h4 className="font-medium text-sm text-gray-700 mb-2">📋 Dados da AIH</h4>
                              <div className="bg-white p-3 rounded border space-y-1 text-sm">
                                <p><span className="font-medium">Número:</span> {aih.aih_number}</p>
                                <p><span className="font-medium">Paciente:</span> {aih.patients?.name}</p>
                                <p><span className="font-medium">CNS:</span> {aih.patients?.cns}</p>
                                <p><span className="font-medium">Procedimento:</span> {aih.procedure_code}</p>
                                <p><span className="font-medium">CID Principal:</span> {aih.main_cid}</p>
                                <p><span className="font-medium">Internação:</span> {formatDate(aih.admission_date)}</p>
                                {aih.discharge_date && <p><span className="font-medium">Alta:</span> {formatDate(aih.discharge_date)}</p>}
                                {aih.source_file && <p><span className="font-medium">Arquivo:</span> {aih.source_file}</p>}
                              </div>
                            </div>

                            {/* Resumo de Procedimentos */}
                            <div>
                              <h4 className="font-medium text-sm text-gray-700 mb-2">📊 Resumo de Procedimentos</h4>
                              <div className="bg-white p-3 rounded border space-y-1 text-sm">
                                {aih.total_procedures && <p><span className="font-medium">Total:</span> {aih.total_procedures}</p>}
                                {aih.approved_procedures !== undefined && <p><span className="font-medium">Aprovados:</span> {aih.approved_procedures}</p>}
                                {aih.rejected_procedures !== undefined && <p><span className="font-medium">Rejeitados:</span> {aih.rejected_procedures}</p>}
                                {aih.calculated_total_value && (
                                  <p className="text-green-600 font-medium">
                                    <span className="font-medium">Valor Total:</span> {formatCurrency(aih.calculated_total_value)}
                                  </p>
                                )}
                                <p><span className="font-medium">Match Encontrado:</span> {aih.match_found ? '✅ Sim' : '❌ Não'}</p>
                                <p><span className="font-medium">Revisão Manual:</span> {aih.requires_manual_review ? '⚠️ Necessária' : '✅ Não necessária'}</p>
                              </div>
                            </div>
                          </div>

                          {/* Matches Detalhados */}
                          {aih.aih_matches && aih.aih_matches.length > 0 && (
                            <div className="mt-4">
                              <h4 className="font-medium text-sm text-gray-700 mb-2">🎯 Matches SIGTAP Detalhados ({aih.aih_matches.length})</h4>
                              <div className="space-y-2">
                                {aih.aih_matches.map((match, idx) => (
                                  <div key={idx} className="bg-white border rounded p-3">
                                    <div className="flex items-center justify-between mb-2">
                                      <div className="flex items-center space-x-3">
                                        {getScoreBadge(match.overall_score)}
                                        <Badge variant="outline" className="text-xs">
                                          🎯 Confiança: {(match.match_confidence * 100).toFixed(1)}%
                                        </Badge>
                                        <Badge variant={match.status === 'approved' ? 'default' : 'secondary'} className="text-xs">
                                          {match.status === 'approved' ? '✅ Aprovado' : 
                                           match.status === 'rejected' ? '❌ Rejeitado' : 
                                           match.status === 'under_review' ? '🔍 Em revisão' : '⏳ Pendente'}
                                        </Badge>
                                      </div>
                                      <span className="font-medium text-green-600">
                                        💰 {formatCurrency(match.calculated_total)}
                                      </span>
                                    </div>
                                    
                                    {match.validation_details && (
                                      <div className="text-xs text-gray-600">
                                        <p><span className="font-medium">🔍 Validações:</span></p>
                                        <div className="grid grid-cols-2 gap-2 mt-1">
                                          {Object.entries(match.validation_details).map(([key, value]) => (
                                            <span key={key} className="flex items-center space-x-1">
                                              <span>{value ? '✅' : '❌'}</span>
                                              <span>{key}</span>
                                            </span>
                                          ))}
                                        </div>
                                      </div>
                                    )}
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Dialog de Confirmação de Exclusão */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center space-x-2">
              <AlertCircle className="w-5 h-5 text-red-500" />
              <span>Confirmar Exclusão</span>
            </DialogTitle>
            <DialogDescription>
              {itemToDelete?.type === 'patient' ? (
                <>
                  Tem certeza que deseja excluir o paciente <strong>{itemToDelete.name}</strong>?
                  <br />
                  <span className="text-red-600 font-medium">
                    ⚠️ Todas as AIHs deste paciente também serão excluídas.
                  </span>
                </>
              ) : (
                <>
                  Tem certeza que deseja excluir a AIH <strong>{itemToDelete?.name}</strong>?
                  <br />
                  <span className="text-gray-600">
                    O paciente será mantido no sistema.
                  </span>
                </>
              )}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteDialogOpen(false)}>
              Cancelar
            </Button>
            <Button variant="destructive" onClick={handleDeleteConfirm} disabled={isLoading}>
              {isLoading ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                  Excluindo...
                </>
              ) : (
                <>
                  <Trash2 className="w-4 h-4 mr-2" />
                  Excluir {itemToDelete?.type === 'patient' ? 'Paciente' : 'AIH'}
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default PatientManagement;

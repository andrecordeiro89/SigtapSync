import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { Input } from './ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from './ui/table';
import { Textarea } from './ui/textarea';
import { Label } from './ui/label';
import { 
  Stethoscope, 
  Users, 
  Building2, 
  Search,
  DollarSign,
  UserCheck,
  FileText,
  RefreshCw,
  Download,
  Edit3,
  UserPlus,
  Database,
  Eye,
  Save,
  X,
  AlertCircle,
  Check,
  Calendar,
  TrendingUp,
  Activity,
  Filter,
  Loader2,
  Award,
  MapPin,
  Phone,
  Mail,
  Banknote,
  BarChart3,
  User,
  ChevronDown,
  ChevronUp,
  Target,
  ClipboardList,
  MessageSquare,
  Hash,
  BarChart2,
  RotateCcw,
  Plus,
  Info
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { DoctorsCrudService } from '../services/doctorsCrudService';
import { 
  MedicalDoctor,
  MedicalSpecialty,
  HospitalMedicalStats
} from '../types';
import { toast } from './ui/use-toast';

// ================================================================
// TIPOS PARA CONTRATOS
// ================================================================

interface DoctorContract {
  id: string;
  doctorId: string;
  contractType: 'meta' | 'producao';
  targetProcedures?: number; // Para contratos por meta
  productionRate?: number; // Para contratos por produção (%)
  description: string;
  startDate: string;
  endDate?: string;
  isActive: boolean;
  notes: string;
  createdAt: string;
  updatedAt: string;
}

interface DoctorNote {
  id: string;
  doctorId: string;
  note: string;
  createdAt: string;
  updatedAt: string;
  createdBy: string;
}

// ✅ Tipo MedicalDoctor agora já inclui campo hospitals opcional

interface MedicalStaffDashboardProps {
  className?: string;
}

// ================================================================
// COMPONENTE PRINCIPAL
// ================================================================

const MedicalStaffDashboard: React.FC<MedicalStaffDashboardProps> = ({ className }) => {
  const { user, isDirector, isAdmin, isCoordinator, isTI, hasPermission } = useAuth();
  
  // Estados
  const [isLoading, setIsLoading] = useState(false);
  const [doctors, setDoctors] = useState<MedicalDoctor[]>([]);
  const [specialties, setSpecialties] = useState<MedicalSpecialty[]>([]);
  const [hospitalStats, setHospitalStats] = useState<HospitalMedicalStats[]>([]);
  const [contracts, setContracts] = useState<DoctorContract[]>([]);
  const [doctorNotes, setDoctorNotes] = useState<DoctorNote[]>([]);
  
  // Filtros
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedHospital, setSelectedHospital] = useState<string>('all');
  const [selectedSpecialty, setSelectedSpecialty] = useState<string>('all');
  const [selectedContractType, setSelectedContractType] = useState<string>('all');
  
  // Controle de expansão
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());
  const [editingNotes, setEditingNotes] = useState<Set<string>>(new Set());
  const [tempNotes, setTempNotes] = useState<{[key: string]: string}>({});
  
  // Controle de criação de contrato inline
  const [creatingContract, setCreatingContract] = useState<Set<string>>(new Set());
  const [contractForms, setContractForms] = useState<{[key: string]: {
    contractType: 'meta' | 'producao';
    targetProcedures: number;
    productionRate: number;
    description: string;
    startDate: string;
    endDate: string;
    notes: string;
  }}>({});

  // Verificar acesso
  const hasAccess = isDirector() || isAdmin() || isCoordinator() || isTI() || hasPermission('medical_management');

  // Carregar dados reais
  const loadRealData = async () => {
    setIsLoading(true);
    try {
      console.log('🩺 Carregando dados médicos...');
      
      const filters = {
        hospitalIds: selectedHospital === 'all' ? undefined : [selectedHospital],
        specialties: selectedSpecialty === 'all' ? undefined : [selectedSpecialty],
        searchTerm: searchTerm || undefined,
        isActive: true
      };

      const [doctorsResult, specialtiesResult, hospitalStatsResult] = await Promise.all([
        DoctorsCrudService.getAllDoctors(filters),
        DoctorsCrudService.getMedicalSpecialties(),
        DoctorsCrudService.getHospitalMedicalStats()
      ]);

      if (doctorsResult.success) {
        setDoctors(doctorsResult.data || []);
        console.log('✅ Médicos carregados:', doctorsResult.data?.length);
      }

      if (specialtiesResult.success) {
        setSpecialties(specialtiesResult.data || []);
        console.log('✅ Especialidades carregadas:', specialtiesResult.data?.length);
      }

      if (hospitalStatsResult.success) {
        setHospitalStats(hospitalStatsResult.data || []);
        console.log('✅ Hospitais carregados:', hospitalStatsResult.data?.length);
      }

      // Carregar contratos e anotações
      await loadContracts();
      await loadDoctorNotes();

    } catch (error) {
      console.error('❌ Erro ao carregar dados:', error);
      toast({
        variant: "destructive",
        title: "Erro",
        description: "Erro ao carregar dados médicos"
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Carregar contratos (mock por enquanto)
  const loadContracts = async () => {
    // Mock data para exemplo
    const mockContracts: DoctorContract[] = [
      {
        id: '1',
        doctorId: '1',
        contractType: 'meta',
        targetProcedures: 50,
        description: 'Meta de 50 procedimentos mensais',
        startDate: '2024-01-01',
        isActive: true,
        notes: 'Contrato renovado em janeiro',
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-01T00:00:00Z'
      }
    ];
    setContracts(mockContracts);
  };

  // Carregar anotações dos médicos
  const loadDoctorNotes = async () => {
    // Mock data para exemplo
    const mockNotes: DoctorNote[] = [];
    setDoctorNotes(mockNotes);
  };

  // Agrupar médicos e filtrar com proteção contra erros
  const filteredDoctors = React.useMemo(() => {
    try {
      if (!doctors || !Array.isArray(doctors)) {
        return [];
      }

      // 📋 AGRUPAR MÉDICOS POR CNS (evitar duplicação por hospital)
      const doctorsGrouped = new Map<string, MedicalDoctor>();

      doctors.forEach(doctor => {
        if (!doctor?.cns) return; // Pular médicos sem CNS

        const existingDoctor = doctorsGrouped.get(doctor.cns);
        
        if (existingDoctor) {
          // Médico já existe, adicionar hospital se não estiver na lista
          if (doctor.hospitalName && existingDoctor.hospitals && !existingDoctor.hospitals.includes(doctor.hospitalName)) {
            existingDoctor.hospitals.push(doctor.hospitalName);
          }
        } else {
          // Primeiro registro do médico
          doctorsGrouped.set(doctor.cns, {
            ...doctor,
            hospitals: doctor.hospitalName ? [doctor.hospitalName] : []
          });
        }
      });

      // 🔍 FILTRAR MÉDICOS AGRUPADOS
      const groupedArray = Array.from(doctorsGrouped.values());
      console.log(`📋 Médicos agrupados: ${doctors.length} registros → ${groupedArray.length} médicos únicos`);
      
      return groupedArray.filter(doctor => {
        try {
          // Proteção contra campos undefined/null
          const doctorName = doctor?.name || '';
          const doctorCrm = doctor?.crm || '';
          const doctorSpecialty = doctor?.speciality || '';

          const matchesSearch = !searchTerm || 
            doctorName.toLowerCase().includes(searchTerm.toLowerCase()) ||
            doctorCrm.toLowerCase().includes(searchTerm.toLowerCase()) ||
            doctorSpecialty.toLowerCase().includes(searchTerm.toLowerCase());
          
          const matchesHospital = selectedHospital === 'all' || 
            (doctor.hospitals && doctor.hospitals.some(hospital => hospital.toLowerCase().includes(selectedHospital.toLowerCase())));
          
          const matchesSpecialty = selectedSpecialty === 'all' || 
            doctorSpecialty === selectedSpecialty;
          
          const matchesContractType = selectedContractType === 'all' || 
            getDoctorContract(doctor?.id)?.contractType === selectedContractType;
          
          return matchesSearch && matchesHospital && matchesSpecialty && matchesContractType;
        } catch (filterError) {
          console.warn('⚠️ Erro ao filtrar médico:', doctor, filterError);
          return false; // Excluir médicos que causem erro
        }
      });
    } catch (error) {
      console.error('❌ Erro crítico na filtragem:', error);
      return []; // Retornar array vazio em caso de erro
    }
  }, [doctors, searchTerm, selectedHospital, selectedSpecialty, selectedContractType, contracts]);

  // Obter contrato do médico
  const getDoctorContract = (doctorId: string) => {
    return contracts.find(contract => contract.doctorId === doctorId && contract.isActive);
  };

  // Obter anotações do médico
  const getDoctorNote = (doctorId: string) => {
    return doctorNotes.find(note => note.doctorId === doctorId);
  };

  // Handlers
  const handleRefresh = () => {
    loadData();
  };

  const loadData = async () => {
    await loadRealData();
  };

  const handleResetContract = async (doctor: MedicalDoctor) => {
    try {
      // Desativar todos os contratos do médico
      setContracts(prev => 
        prev.map(contract => 
          contract.doctorId === doctor.id 
            ? { ...contract, isActive: false, updatedAt: new Date().toISOString() }
            : contract
        )
      );

      // Limpar anotações se necessário
      setDoctorNotes(prev => prev.filter(note => note.doctorId !== doctor.id));

      // Fechar expansão se estiver aberta
      setExpandedRows(prev => {
        const newSet = new Set(prev);
        newSet.delete(doctor.id);
        return newSet;
      });

      // Limpar estados de criação
      setCreatingContract(prev => {
        const newSet = new Set(prev);
        newSet.delete(doctor.id);
        return newSet;
      });

      toast({
        title: "Sucesso",
        description: `Contrato do Dr. ${doctor.name} foi resetado com sucesso`
      });

    } catch (error) {
      console.error('Erro ao resetar contrato:', error);
      toast({
        variant: "destructive",
        title: "Erro",
        description: "Erro ao resetar contrato do médico"
      });
    }
  };

  const handleStartCreateContract = (doctorId: string) => {
    setCreatingContract(prev => new Set([...prev, doctorId]));
    setContractForms(prev => ({
      ...prev,
      [doctorId]: {
        contractType: 'meta',
        targetProcedures: 0,
        productionRate: 0,
        description: '',
        startDate: '',
        endDate: '',
        notes: ''
      }
    }));
  };

  const handleCancelCreateContract = (doctorId: string) => {
    setCreatingContract(prev => {
      const newSet = new Set(prev);
      newSet.delete(doctorId);
      return newSet;
    });
    setContractForms(prev => {
      const newForms = { ...prev };
      delete newForms[doctorId];
      return newForms;
    });
  };

  const handleSaveContract = async (doctorId: string) => {
    const form = contractForms[doctorId];
    if (!form) return;

    try {
      const newContract: DoctorContract = {
        id: Date.now().toString(),
        doctorId,
        contractType: form.contractType,
        targetProcedures: form.contractType === 'meta' ? form.targetProcedures : undefined,
        productionRate: form.contractType === 'producao' ? form.productionRate : undefined,
        description: form.description,
        startDate: form.startDate,
        endDate: form.endDate || undefined,
        isActive: true,
        notes: form.notes,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      setContracts(prev => [...prev, newContract]);
      
      // Limpar estados de criação
      setCreatingContract(prev => {
        const newSet = new Set(prev);
        newSet.delete(doctorId);
        return newSet;
      });
      setContractForms(prev => {
        const newForms = { ...prev };
        delete newForms[doctorId];
        return newForms;
      });

      toast({
        title: "Sucesso",
        description: "Contrato salvo com sucesso"
      });

    } catch (error) {
      console.error('Erro ao salvar contrato:', error);
      toast({
        variant: "destructive",
        title: "Erro",
        description: "Erro ao salvar contrato"
      });
    }
  };

  const handleUpdateContractForm = (doctorId: string, field: string, value: any) => {
    setContractForms(prev => ({
      ...prev,
      [doctorId]: {
        ...prev[doctorId],
        [field]: value
      }
    }));
  };

  const handleExport = () => {
    toast({
      title: "Exportação",
      description: "Exportando dados dos profissionais..."
    });
  };

  const getContractTypeBadge = (type: string) => {
    const types = {
      meta: { label: 'Meta', color: 'bg-blue-100 text-blue-800', icon: Target },
      producao: { label: 'Produção', color: 'bg-green-100 text-green-800', icon: BarChart2 }
    };
    
    const typeInfo = types[type as keyof typeof types] || types.meta;
    const IconComponent = typeInfo.icon;
    
    return (
      <Badge className={`${typeInfo.color} flex items-center gap-1`}>
        <IconComponent className="h-3 w-3" />
        {typeInfo.label}
      </Badge>
    );
  };

  // Controle de expansão
  const toggleRowExpansion = (doctorId: string) => {
    const newExpanded = new Set(expandedRows);
    if (newExpanded.has(doctorId)) {
      newExpanded.delete(doctorId);
      // Cancelar criação de contrato se estiver aberta
      setCreatingContract(prev => {
        const newSet = new Set(prev);
        newSet.delete(doctorId);
        return newSet;
      });
    } else {
      newExpanded.add(doctorId);
    }
    setExpandedRows(newExpanded);
  };

  const startEditingNote = (doctorId: string) => {
    const currentNote = getDoctorNote(doctorId);
    setTempNotes(prev => ({
      ...prev,
      [doctorId]: currentNote?.note || ''
    }));
    setEditingNotes(prev => new Set([...prev, doctorId]));
  };

  const cancelEditingNote = (doctorId: string) => {
    setEditingNotes(prev => {
      const newSet = new Set(prev);
      newSet.delete(doctorId);
      return newSet;
    });
    setTempNotes(prev => {
      const newNotes = { ...prev };
      delete newNotes[doctorId];
      return newNotes;
    });
  };

  const saveNote = async (doctorId: string) => {
    const noteText = tempNotes[doctorId] || '';
    
    try {
      const existingNote = getDoctorNote(doctorId);
      
      if (existingNote) {
        // Atualizar nota existente
        const updatedNote = {
          ...existingNote,
          note: noteText,
          updatedAt: new Date().toISOString()
        };
        setDoctorNotes(prev => 
          prev.map(note => note.id === existingNote.id ? updatedNote : note)
        );
      } else {
        // Criar nova nota
        const newNote: DoctorNote = {
          id: Date.now().toString(),
          doctorId,
          note: noteText,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          createdBy: user?.id || 'unknown'
        };
        setDoctorNotes(prev => [...prev, newNote]);
      }

      setEditingNotes(prev => {
        const newSet = new Set(prev);
        newSet.delete(doctorId);
        return newSet;
      });

      toast({
        title: "Sucesso",
        description: "Anotação salva com sucesso"
      });

    } catch (error) {
      console.error('Erro ao salvar anotação:', error);
      toast({
        variant: "destructive",
        title: "Erro",
        description: "Erro ao salvar anotação"
      });
    }
  };

  // Carrega dados no mount
  useEffect(() => {
    if (hasAccess) {
      loadData();
    }
  }, [hasAccess]);

  // Renderizar se não tem acesso
  if (!hasAccess) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <Stethoscope className="mx-auto h-16 w-16 text-gray-400 mb-4" />
          <h3 className="text-lg font-semibold text-gray-900 mb-2">Acesso Restrito</h3>
          <p className="text-gray-600 max-w-md">
            Esta seção é exclusiva para diretoria, administração, coordenação e TI.
            Somente usuários com permissões médicas podem acessar os dados do corpo clínico.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className={`space-y-6 ${className}`}>
      {/* HEADER */}
      <div className="bg-gradient-to-r from-blue-600 to-purple-600 text-white p-6 rounded-lg shadow-lg">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold mb-2 flex items-center space-x-2">
              <Stethoscope className="h-8 w-8" />
              <span>Corpo Médico</span>
            </h1>
            <p className="text-blue-100">
              Dados reais agrupados por médico - Múltiplos hospitais unificados na visualização
            </p>
          </div>
          <div className="text-right">
            <div className="text-3xl font-bold flex items-center gap-2">
              {isLoading ? '...' : filteredDoctors.length}
              <Users className="h-6 w-6 text-blue-300" />
            </div>
            <div className="text-blue-100">Profissionais</div>
            <div className="text-sm text-blue-200 mt-1">
              {contracts.filter(c => c.isActive).length} contratos ativos
            </div>
          </div>
        </div>
      </div>



      {/* CONTROLES E FILTROS */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Filter className="h-5 w-5" />
            <span>Filtros e Controles</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Botões de ação */}
          <div className="flex flex-wrap gap-3">
            <Button
              onClick={handleRefresh}
              disabled={isLoading}
              variant="outline"
              className="flex items-center gap-2"
            >
              <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
              Atualizar
            </Button>

            <Button
              onClick={handleExport}
              variant="outline"
              className="flex items-center gap-2"
            >
              <Download className="h-4 w-4" />
              Exportar
            </Button>

            <Badge variant="default" className="flex items-center gap-1">
              <Database className="h-3 w-3" />
              Dados Reais
            </Badge>

            <div className="mt-2 p-3 bg-blue-50 border border-blue-200 rounded-lg">
              <div className="flex items-start space-x-2">
                <Info className="h-4 w-4 text-blue-600 mt-0.5" />
                <div className="text-sm text-blue-800">
                  <strong>Agrupamento Inteligente:</strong> Médicos que atendem em múltiplos hospitais são exibidos em uma única linha com badges indicando todos os hospitais onde atuam.
                </div>
              </div>
            </div>
          </div>

          {/* Filtros */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="space-y-2">
              <Label className="text-sm font-medium flex items-center gap-2">
                <Search className="h-4 w-4" />
                Buscar
              </Label>
              <div className="relative">
                <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                <Input
                  placeholder="Nome ou especialidade..."
                  value={searchTerm}
                  onChange={(e) => {
                    try {
                      setSearchTerm(e.target.value);
                    } catch (error) {
                      console.error('❌ Erro ao atualizar termo de busca:', error);
                    }
                  }}
                  className="pl-10"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label className="text-sm font-medium flex items-center gap-2">
                <Building2 className="h-4 w-4" />
                Hospital
              </Label>
              <Select value={selectedHospital} onValueChange={setSelectedHospital}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione hospital" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos os Hospitais</SelectItem>
                  {hospitalStats.map((hospital) => (
                    <SelectItem key={hospital.hospitalId} value={hospital.hospitalId}>
                      {hospital.hospitalName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label className="text-sm font-medium flex items-center gap-2">
                <Stethoscope className="h-4 w-4" />
                Especialidade
              </Label>
              <Select value={selectedSpecialty} onValueChange={setSelectedSpecialty}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione especialidade" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas as Especialidades</SelectItem>
                  {specialties.map((specialty) => (
                    <SelectItem key={specialty.id} value={specialty.name}>
                      {specialty.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label className="text-sm font-medium flex items-center gap-2">
                <FileText className="h-4 w-4" />
                Tipo de Contrato
              </Label>
              <Select value={selectedContractType} onValueChange={setSelectedContractType}>
                <SelectTrigger>
                  <SelectValue placeholder="Tipo de contrato" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos os Tipos</SelectItem>
                  <SelectItem value="meta">Meta</SelectItem>
                  <SelectItem value="producao">Produção</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* TABELA DE PROFISSIONAIS */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Users className="h-5 w-5" />
            <span>Lista de Profissionais</span>
            <Badge variant="secondary">
              {filteredDoctors.length} profissionais
            </Badge>
            <Badge variant="default" className="bg-green-600 text-white">
              <Database className="h-3 w-3 mr-1" />
              Dados Reais
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-2">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="flex items-center space-x-4">
                  <div className="h-12 w-12 bg-gray-200 rounded-full animate-pulse" />
                  <div className="flex-1">
                    <div className="h-4 bg-gray-200 rounded w-3/4 animate-pulse" />
                    <div className="h-3 bg-gray-200 rounded w-1/2 mt-1 animate-pulse" />
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Profissional</TableHead>
                    <TableHead>Especialidade</TableHead>
                    <TableHead>Hospital</TableHead>
                    <TableHead>Contrato</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredDoctors.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center py-8">
                        <div className="flex flex-col items-center justify-center text-gray-500">
                          <Users className="h-12 w-12 mb-4 text-gray-300" />
                          <p className="text-lg font-medium mb-2">Nenhum médico encontrado</p>
                          <p className="text-sm">
                            {searchTerm ? 'Tente ajustar os filtros de busca' : 'Ainda não há médicos cadastrados no sistema'}
                          </p>
                        </div>
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredDoctors.map((doctor) => {
                      try {
                        const contract = getDoctorContract(doctor?.id);
                        const isExpanded = expandedRows.has(doctor?.id);
                        const isCreating = creatingContract.has(doctor?.id);
                        
                        // Proteção adicional contra dados inválidos
                        if (!doctor || !doctor.id) {
                          console.warn('⚠️ Médico com dados inválidos:', doctor);
                          return null;
                        }
                    
                    return (
                      <React.Fragment key={doctor.id}>
                        <TableRow className={isExpanded ? 'bg-blue-50' : ''}>
                          <TableCell>
                            <div className="flex items-center space-x-3">
                              <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
                                <User className="h-5 w-5 text-blue-600" />
                              </div>
                              <div>
                                <div className="font-medium">{doctor.name}</div>
                                <div className="text-sm text-gray-500">CRM: {doctor.crm}</div>
                              </div>
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="text-sm">
                              {doctor.speciality || 'Não informado'}
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="space-y-1">
                              {doctor.hospitals && doctor.hospitals.length > 0 ? (
                                <div className="flex flex-wrap gap-1">
                                  {doctor.hospitals.map((hospital: string, index: number) => (
                                    <Badge
                                      key={index}
                                      variant="outline"
                                      className={`
                                        text-xs px-2 py-1 
                                        ${doctor.hospitals!.length > 1 
                                          ? 'bg-blue-50 border-blue-200 text-blue-700' 
                                          : 'bg-gray-50 border-gray-200 text-gray-700'
                                        }
                                      `}
                                    >
                                      <Building2 className="h-3 w-3 mr-1" />
                                      {hospital}
                                    </Badge>
                                  ))}
                                  {doctor.hospitals.length > 1 && (
                                    <Badge variant="secondary" className="text-xs">
                                      +{doctor.hospitals.length} hospitais
                                    </Badge>
                                  )}
                                </div>
                              ) : (
                                <div className="text-sm text-gray-500">Não informado</div>
                              )}
                            </div>
                          </TableCell>
                          <TableCell>
                            {contract ? (
                              <div className="space-y-1">
                                {getContractTypeBadge(contract.contractType)}
                                <div className="text-xs text-gray-500">
                                  {contract.contractType === 'meta' && contract.targetProcedures 
                                    ? `${contract.targetProcedures} proc/mês`
                                    : contract.contractType === 'producao' && contract.productionRate
                                    ? `${contract.productionRate}% produção`
                                    : 'Definir parâmetros'
                                  }
                                </div>
                              </div>
                            ) : (
                              <Badge variant="outline" className="text-gray-500">
                                Sem contrato
                              </Badge>
                            )}
                          </TableCell>
                          <TableCell>
                            {contract ? (
                              <Badge variant="default" className="bg-green-100 text-green-800">
                                <Check className="h-3 w-3 mr-1" />
                                Ativo
                              </Badge>
                            ) : (
                              <Badge variant="secondary" className="bg-yellow-100 text-yellow-800">
                                <AlertCircle className="h-3 w-3 mr-1" />
                                Pendente
                              </Badge>
                            )}
                          </TableCell>
                          <TableCell>
                            <div className="flex space-x-2">
                              <Button
                                onClick={() => toggleRowExpansion(doctor.id)}
                                size="sm"
                                variant="outline"
                                title={isExpanded ? "Recolher" : "Expandir"}
                              >
                                {isExpanded ? 
                                  <ChevronUp className="h-4 w-4" /> : 
                                  <ChevronDown className="h-4 w-4" />
                                }
                              </Button>
                              {contract && (
                                <Button
                                  onClick={() => handleResetContract(doctor)}
                                  size="sm"
                                  variant="outline"
                                  title="Resetar contrato"
                                  className="text-red-600 hover:text-red-700 hover:bg-red-50"
                                >
                                  <RotateCcw className="h-4 w-4" />
                                </Button>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                        
                        {/* LINHA EXPANDIDA */}
                        {isExpanded && (
                          <TableRow className="bg-blue-50">
                            <TableCell colSpan={6} className="border-t">
                              <div className="p-4 space-y-4">
                                {/* SEM CONTRATO - FORMULÁRIO DE CRIAÇÃO */}
                                {!contract && (
                                  <div className="space-y-4">
                                    <div className="flex items-center justify-between">
                                      <h4 className="font-medium text-gray-900 flex items-center gap-2">
                                        <Plus className="h-4 w-4" />
                                        {isCreating ? 'Criando Contrato' : 'Criar Contrato'}
                                      </h4>
                                      {!isCreating && (
                                        <Button
                                          onClick={() => handleStartCreateContract(doctor.id)}
                                          size="sm"
                                          className="bg-green-600 hover:bg-green-700"
                                        >
                                          <Plus className="h-4 w-4 mr-2" />
                                          Novo Contrato
                                        </Button>
                                      )}
                                    </div>

                                    {isCreating && contractForms[doctor.id] && (
                                      <div className="bg-white p-4 rounded-lg border space-y-4">
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                          <div className="space-y-2">
                                            <Label>Tipo de Contrato</Label>
                                            <Select 
                                              value={contractForms[doctor.id].contractType}
                                              onValueChange={(value) => handleUpdateContractForm(doctor.id, 'contractType', value)}
                                            >
                                              <SelectTrigger>
                                                <SelectValue />
                                              </SelectTrigger>
                                              <SelectContent>
                                                <SelectItem value="meta">
                                                  <div className="flex items-center gap-2">
                                                    <Target className="h-4 w-4" />
                                                    Meta de Procedimentos
                                                  </div>
                                                </SelectItem>
                                                <SelectItem value="producao">
                                                  <div className="flex items-center gap-2">
                                                    <BarChart2 className="h-4 w-4" />
                                                    Produção (% do faturamento)
                                                  </div>
                                                </SelectItem>
                                              </SelectContent>
                                            </Select>
                                          </div>

                                          <div className="space-y-2">
                                            <Label>Descrição do Contrato</Label>
                                            <Input
                                              value={contractForms[doctor.id].description}
                                              onChange={(e) => handleUpdateContractForm(doctor.id, 'description', e.target.value)}
                                              placeholder="Ex: Contrato de cardiologia com meta mensal"
                                            />
                                          </div>
                                        </div>

                                        {contractForms[doctor.id].contractType === 'meta' && (
                                          <div className="space-y-2">
                                            <Label>Meta de Procedimentos (por mês)</Label>
                                            <Input
                                              type="number"
                                              value={contractForms[doctor.id].targetProcedures}
                                              onChange={(e) => handleUpdateContractForm(doctor.id, 'targetProcedures', Number(e.target.value))}
                                              placeholder="Ex: 50"
                                            />
                                          </div>
                                        )}

                                        {contractForms[doctor.id].contractType === 'producao' && (
                                          <div className="space-y-2">
                                            <Label>Percentual da Produção (%)</Label>
                                            <Input
                                              type="number"
                                              value={contractForms[doctor.id].productionRate}
                                              onChange={(e) => handleUpdateContractForm(doctor.id, 'productionRate', Number(e.target.value))}
                                              placeholder="Ex: 30"
                                              min="0"
                                              max="100"
                                            />
                                          </div>
                                        )}

                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                          <div className="space-y-2">
                                            <Label>Data de Início</Label>
                                            <Input
                                              type="date"
                                              value={contractForms[doctor.id].startDate}
                                              onChange={(e) => handleUpdateContractForm(doctor.id, 'startDate', e.target.value)}
                                            />
                                          </div>
                                          <div className="space-y-2">
                                            <Label>Data de Fim (Opcional)</Label>
                                            <Input
                                              type="date"
                                              value={contractForms[doctor.id].endDate}
                                              onChange={(e) => handleUpdateContractForm(doctor.id, 'endDate', e.target.value)}
                                            />
                                          </div>
                                        </div>

                                        <div className="space-y-2">
                                          <Label>Observações</Label>
                                          <Textarea
                                            value={contractForms[doctor.id].notes}
                                            onChange={(e) => handleUpdateContractForm(doctor.id, 'notes', e.target.value)}
                                            placeholder="Informações adicionais sobre o contrato..."
                                          />
                                        </div>

                                        <div className="flex gap-2">
                                          <Button
                                            onClick={() => handleSaveContract(doctor.id)}
                                            className="bg-green-600 hover:bg-green-700"
                                          >
                                            <Save className="h-4 w-4 mr-2" />
                                            Salvar Contrato
                                          </Button>
                                          <Button
                                            onClick={() => handleCancelCreateContract(doctor.id)}
                                            variant="outline"
                                          >
                                            <X className="h-4 w-4 mr-2" />
                                            Cancelar
                                          </Button>
                                        </div>
                                      </div>
                                    )}
                                  </div>
                                )}

                                {/* COM CONTRATO - DETALHES E ANOTAÇÕES */}
                                {contract && (
                                  <div className="space-y-4">
                                    <div className="flex items-center justify-between">
                                      <h4 className="font-medium text-gray-900 flex items-center gap-2">
                                        <ClipboardList className="h-4 w-4" />
                                        Detalhes do Contrato e Anotações
                                      </h4>
                                    </div>
                                    
                                    {/* Informações do contrato */}
                                    <div className="bg-white p-3 rounded-lg border">
                                      <div className="flex items-center justify-between mb-2">
                                        <div className="flex items-center gap-2">
                                          <ClipboardList className="h-4 w-4 text-blue-600" />
                                          <span className="font-medium">Detalhes do Contrato</span>
                                        </div>
                                        {getContractTypeBadge(contract.contractType)}
                                      </div>
                                      <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm">
                                        <div>
                                          <span className="text-gray-600">Descrição:</span>
                                          <div className="font-medium">{contract.description || 'Não informado'}</div>
                                        </div>
                                        <div>
                                          <span className="text-gray-600">Parâmetro:</span>
                                          <div className="font-medium">
                                            {contract.contractType === 'meta' && contract.targetProcedures 
                                              ? `${contract.targetProcedures} procedimentos/mês`
                                              : contract.contractType === 'producao' && contract.productionRate
                                              ? `${contract.productionRate}% da produção`
                                              : 'Não definido'
                                            }
                                          </div>
                                        </div>
                                        <div>
                                          <span className="text-gray-600">Início:</span>
                                          <div className="font-medium">
                                            {new Date(contract.startDate).toLocaleDateString('pt-BR')}
                                          </div>
                                        </div>
                                        <div>
                                          <span className="text-gray-600">Fim:</span>
                                          <div className="font-medium">
                                            {contract.endDate ? 
                                              new Date(contract.endDate).toLocaleDateString('pt-BR') : 
                                              'Indeterminado'
                                            }
                                          </div>
                                        </div>
                                      </div>
                                    </div>
                                    
                                    {/* Área de anotações */}
                                    <div className="bg-white p-3 rounded-lg border">
                                      <div className="flex items-center justify-between mb-2">
                                        <div className="flex items-center gap-2">
                                          <MessageSquare className="h-4 w-4 text-green-600" />
                                          <span className="font-medium">Anotações</span>
                                        </div>
                                        {!editingNotes.has(doctor.id) && (
                                          <Button
                                            onClick={() => startEditingNote(doctor.id)}
                                            size="sm"
                                            variant="outline"
                                          >
                                            <Edit3 className="h-4 w-4 mr-2" />
                                            Editar
                                          </Button>
                                        )}
                                      </div>
                                      
                                      {editingNotes.has(doctor.id) ? (
                                        <div className="space-y-3">
                                          <Textarea
                                            value={tempNotes[doctor.id] || ''}
                                            onChange={(e) => setTempNotes(prev => ({
                                              ...prev,
                                              [doctor.id]: e.target.value
                                            }))}
                                            placeholder="Adicione suas anotações sobre o contrato, metas, observações especiais..."
                                            className="min-h-[100px]"
                                          />
                                          <div className="flex gap-2">
                                            <Button
                                              onClick={() => saveNote(doctor.id)}
                                              size="sm"
                                              className="bg-green-600 hover:bg-green-700"
                                            >
                                              <Save className="h-4 w-4 mr-2" />
                                              Salvar
                                            </Button>
                                            <Button
                                              onClick={() => cancelEditingNote(doctor.id)}
                                              size="sm"
                                              variant="outline"
                                            >
                                              <X className="h-4 w-4 mr-2" />
                                              Cancelar
                                            </Button>
                                          </div>
                                        </div>
                                      ) : (
                                        <div className="text-sm text-gray-600">
                                          {getDoctorNote(doctor.id)?.note || 'Nenhuma anotação registrada. Clique em "Editar" para adicionar.'}
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                )}
                              </div>
                            </TableCell>
                          </TableRow>
                        )}
                      </React.Fragment>
                    );
                      } catch (renderError) {
                        console.error('❌ Erro ao renderizar médico:', doctor, renderError);
                        return null;
                      }
                    })
                  )}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default MedicalStaffDashboard; 
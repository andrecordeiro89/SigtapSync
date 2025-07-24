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
  ClipboardList,
  MessageSquare,
  Hash,
  RotateCcw,
  Plus,
  Info,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight
} from 'lucide-react';
import { getSpecialtyColor, getSpecialtyIcon } from '../utils/specialtyColors';
import { useAuth } from '../contexts/AuthContext';
import { DoctorsCrudService } from '../services/doctorsCrudService';
import { 
  MedicalDoctor,
  MedicalSpecialty,
  HospitalMedicalStats
} from '../types';
import { toast } from './ui/use-toast';

// ================================================================
// TIPOS E INTERFACES
// ================================================================

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
  // Estados para observações e expansão
  const [doctorObservations, setDoctorObservations] = useState<{[key: string]: string}>({});
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());
  
  // Filtros
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedHospital, setSelectedHospital] = useState<string>('all');
  const [selectedSpecialty, setSelectedSpecialty] = useState<string>('all');
  
  // Paginação
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 30;

  
  // Estados de controle removidos - não mais necessários

  // Verificar acesso
  const hasAccess = isDirector() || isAdmin() || isCoordinator() || isTI() || hasPermission('medical_management');

  // 🆕 Estados derivados para listas de filtros
  const [availableHospitals, setAvailableHospitals] = useState<{id: string, name: string}[]>([]);
  const [availableSpecialties, setAvailableSpecialties] = useState<string[]>([]);
  
  // 🆕 Estado para debounce da busca
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState('');

  // 🔄 DEBOUNCE DA BUSCA - Aguarda 500ms após última digitação
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearchTerm(searchTerm);
    }, 500);

    return () => clearTimeout(timer);
  }, [searchTerm]);

  // 🔄 CARREGAMENTO INICIAL
  useEffect(() => {
    if (hasAccess) {
      loadRealData();
    }
  }, []);

  // 🔄 RECARREGAR DADOS APENAS QUANDO BUSCA TEXTUAL MUDAR (filtros dropdown são frontend)
  useEffect(() => {
    if (hasAccess && doctors.length > 0) {
      loadRealData();
    }
  }, [debouncedSearchTerm]);

  // Carregar dados reais
  const loadRealData = async () => {
    setIsLoading(true);
    try {
      console.log('🩺 Carregando dados médicos com filtros aplicados...');
      
      // 🔍 APLICAR APENAS BUSCA TEXTUAL NO BACKEND (dropdowns filtram no frontend)
      const filters = {
        searchTerm: debouncedSearchTerm.trim() || undefined,
        isActive: true
      };

      console.log('🔍 Filtros aplicados:', filters);

      const [doctorsResult, specialtiesResult, hospitalStatsResult] = await Promise.all([
        DoctorsCrudService.getAllDoctors(filters),
        DoctorsCrudService.getMedicalSpecialties(),
        DoctorsCrudService.getHospitalMedicalStats()
      ]);

      if (doctorsResult.success) {
        setDoctors(doctorsResult.data || []);
        console.log('✅ Médicos carregados:', doctorsResult.data?.length);
        
        // 🔧 EXTRAIR HOSPITAIS E ESPECIALIDADES DOS DADOS REAIS
        const uniqueHospitals = new Set<string>();
        const uniqueSpecialties = new Set<string>();
        
        doctorsResult.data?.forEach(doctor => {
          // Coletar hospitais únicos
          if (doctor.hospitals && doctor.hospitals.length > 0) {
            doctor.hospitals.forEach(hospital => uniqueHospitals.add(hospital));
          } else if (doctor.hospitalName) {
            uniqueHospitals.add(doctor.hospitalName);
          }
          
          // Coletar especialidades únicas
          if (doctor.speciality) {
            uniqueSpecialties.add(doctor.speciality);
          }
        });
        
        // Atualizar listas de filtros
        const hospitalsList = Array.from(uniqueHospitals).map(name => ({ id: name, name })).sort((a, b) => a.name.localeCompare(b.name));
        const specialtiesList = Array.from(uniqueSpecialties).sort();
        
        setAvailableHospitals(hospitalsList);
        setAvailableSpecialties(specialtiesList);
        
        console.log(`📋 Filtros disponíveis: ${uniqueHospitals.size} hospitais, ${uniqueSpecialties.size} especialidades`);
      }

      if (specialtiesResult.success) {
        setSpecialties(specialtiesResult.data || []);
        console.log('✅ Especialidades do serviço carregadas:', specialtiesResult.data?.length);
      }

      if (hospitalStatsResult.success) {
        setHospitalStats(hospitalStatsResult.data || []);
        console.log('✅ Estatísticas de hospitais carregadas:', hospitalStatsResult.data?.length);
      }

      // Carregamento de contratos e anotações removido

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

  // Funções de carregamento removidas - não mais necessárias

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
      
      const filteredArray = groupedArray.filter(doctor => {
        try {
          // Proteção contra campos undefined/null
          const doctorName = doctor?.name || '';
          const doctorCrm = doctor?.crm || '';
          const doctorSpecialty = doctor?.speciality || '';

          const matchesSearch = !searchTerm || 
            doctorName.toLowerCase().includes(searchTerm.toLowerCase()) ||
            doctorCrm.toLowerCase().includes(searchTerm.toLowerCase()) ||
            doctorSpecialty.toLowerCase().includes(searchTerm.toLowerCase());
          
          // 🏥 FILTRO DE HOSPITAL - Verifica se médico atende no hospital selecionado
          const matchesHospital = selectedHospital === 'all' || 
            (doctor.hospitals && doctor.hospitals.includes(selectedHospital)) ||
            (doctor.hospitalName === selectedHospital);
          
          // 🩺 FILTRO DE ESPECIALIDADE
          const matchesSpecialty = selectedSpecialty === 'all' || 
            doctorSpecialty === selectedSpecialty;
          
          const passes = matchesSearch && matchesHospital && matchesSpecialty;
          
          // Médico passou na filtragem
          
          return passes;
        } catch (filterError) {
          console.warn('⚠️ Erro ao filtrar médico:', doctor, filterError);
          return false;
        }
      });
      
      // Log apenas quando há filtros ativos
      if (searchTerm || selectedHospital !== 'all' || selectedSpecialty !== 'all') {
        console.log(`🔍 Filtragem: ${groupedArray.length} → ${filteredArray.length} médicos`);
      }
      
      return filteredArray;
    } catch (error) {
      console.error('❌ Erro crítico na filtragem:', error);
      return []; // Retornar array vazio em caso de erro
    }
  }, [doctors, searchTerm, selectedHospital, selectedSpecialty]);

  // Função removida - não mais necessária

  // Handlers
  const handleRefresh = () => {
    loadData();
  };

  const loadData = async () => {
    await loadRealData();
  };

  // 🆕 LIMPAR TODOS OS FILTROS
  const handleClearFilters = () => {
    setSearchTerm('');
    setSelectedHospital('all');
    setSelectedSpecialty('all');
    setCurrentPage(1); // Reset para primeira página
    
    toast({
      title: "Filtros limpos",
      description: "Todos os filtros foram removidos"
    });
  };

  // 📄 LÓGICA DE PAGINAÇÃO
  const totalPages = Math.ceil(filteredDoctors.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const currentDoctors = filteredDoctors.slice(startIndex, endIndex);

  // Reset página quando filtros mudarem
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, selectedHospital, selectedSpecialty]);

  const handlePageChange = (page: number) => {
    setCurrentPage(page);
    // Scroll para o topo da tabela
    document.querySelector('.medical-staff-table')?.scrollIntoView({ behavior: 'smooth' });
  };

  const handlePreviousPage = () => {
    if (currentPage > 1) {
      handlePageChange(currentPage - 1);
    }
  };

  const handleNextPage = () => {
    if (currentPage < totalPages) {
      handlePageChange(currentPage + 1);
    }
  };

  const handleUpdateDoctorNote = (doctorId: string, note: string) => {
    setDoctorObservations(prev => ({
      ...prev,
      [doctorId]: note
    }));
  };

  // Função para controlar expansão das linhas
  const toggleRowExpansion = (doctorId: string) => {
    setExpandedRows(prev => {
      const newSet = new Set(prev);
      if (newSet.has(doctorId)) {
        newSet.delete(doctorId);
      } else {
        newSet.add(doctorId);
      }
      return newSet;
    });
  };

  const handleExport = () => {
    toast({
      title: "Exportação",
      description: "Exportando dados dos profissionais..."
    });
  };

  // Função removida - não mais necessária

  const getHospitalBadgeColor = (hospitalName: string) => {
    // Lista de cores vibrantes e bem contrastadas para hospitais
    const colors = [
      'bg-blue-100 border-blue-300 text-blue-800',
      'bg-green-100 border-green-300 text-green-800', 
      'bg-purple-100 border-purple-300 text-purple-800',
      'bg-orange-100 border-orange-300 text-orange-800',
      'bg-pink-100 border-pink-300 text-pink-800',
      'bg-indigo-100 border-indigo-300 text-indigo-800',
      'bg-red-100 border-red-300 text-red-800',
      'bg-teal-100 border-teal-300 text-teal-800',
      'bg-yellow-100 border-yellow-300 text-yellow-800',
      'bg-cyan-100 border-cyan-300 text-cyan-800',
      'bg-lime-100 border-lime-300 text-lime-800',
      'bg-rose-100 border-rose-300 text-rose-800'
    ];
    
    // Gera um índice baseado no hash do nome do hospital
    let hash = 0;
    for (let i = 0; i < hospitalName.length; i++) {
      const char = hospitalName.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Converte para 32bit integer
    }
    
    return colors[Math.abs(hash) % colors.length];
  };

  // Função duplicada removida - já existe declaração anterior

  // Funções de anotações removidas - não mais necessárias

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
      <div className="flex justify-between items-start">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Stethoscope className="h-6 w-6 text-blue-600" />
            Corpo Médico
          </h2>
          <p className="text-gray-600 mt-1">
            Gestão completa dos profissionais médicos
          </p>
        </div>
        
        <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">
          <Database className="h-3 w-3 mr-1" />
          Dados Reais
        </Badge>
      </div>

      {/* CARDS DE RESUMO */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Total de Médicos</p>
                <p className="text-2xl font-bold text-gray-900">{filteredDoctors.length}</p>
              </div>
              <div className="h-8 w-8 bg-blue-100 rounded-lg flex items-center justify-center">
                <Users className="h-4 w-4 text-blue-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Especialidades</p>
                <p className="text-2xl font-bold text-gray-900">{availableSpecialties.length}</p>
              </div>
              <div className="h-8 w-8 bg-green-100 rounded-lg flex items-center justify-center">
                <Stethoscope className="h-4 w-4 text-green-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Hospitais</p>
                <p className="text-2xl font-bold text-gray-900">{availableHospitals.length}</p>
              </div>
              <div className="h-8 w-8 bg-purple-100 rounded-lg flex items-center justify-center">
                <Building2 className="h-4 w-4 text-purple-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Filtros Ativos</p>
                <p className="text-2xl font-bold text-gray-900">
                  {(searchTerm || selectedHospital !== 'all' || selectedSpecialty !== 'all') ? '✓' : '0'}
                </p>
              </div>
              <div className="h-8 w-8 bg-orange-100 rounded-lg flex items-center justify-center">
                <Filter className="h-4 w-4 text-orange-600" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* CONTROLES E FILTROS */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              Profissionais Médicos
            </span>
            <div className="flex items-center gap-2">
              <Button
                onClick={loadRealData}
                disabled={isLoading}
                size="sm"
                variant="outline"
              >
                {isLoading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <RefreshCw className="h-4 w-4" />
                )}
                {isLoading ? 'Carregando...' : 'Atualizar'}
              </Button>
              <Button
                onClick={handleExport}
                size="sm"
                variant="outline"
              >
                <Download className="h-4 w-4 mr-2" />
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
              placeholder="Buscar por nome, CNS ou especialidade..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              disabled={isLoading}
              className="flex-1"
            />
          </div>

          {/* Filtros */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-1">
              <Label className="text-sm font-medium flex items-center gap-2">
                <Building2 className="h-4 w-4" />
                Hospital
              </Label>
              <Select 
                value={selectedHospital} 
                onValueChange={setSelectedHospital} 
                disabled={isLoading}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione hospital" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">
                    <div className="flex items-center gap-2">
                      <Building2 className="h-4 w-4" />
                      Todos os Hospitais
                    </div>
                  </SelectItem>
                  {availableHospitals.map((hospital) => (
                    <SelectItem key={hospital.id} value={hospital.name}>
                      <div className="flex items-center gap-2">
                        <Building2 className="h-3 w-3" />
                        {hospital.name}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1">
              <Label className="text-sm font-medium flex items-center gap-2">
                <Stethoscope className="h-4 w-4" />
                Especialidade
              </Label>
              <Select 
                value={selectedSpecialty} 
                onValueChange={setSelectedSpecialty} 
                disabled={isLoading}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione especialidade" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">
                    <div className="flex items-center gap-2">
                      <Stethoscope className="h-4 w-4" />
                      Todas as Especialidades
                    </div>
                  </SelectItem>
                  {availableSpecialties.map((specialty) => (
                    <SelectItem key={specialty} value={specialty}>
                      <div className="flex items-center gap-2">
                        <Stethoscope className="h-3 w-3" />
                        {specialty}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1">
              <Label className="text-sm font-medium">Ações</Label>
              <Button
                onClick={handleClearFilters}
                disabled={isLoading}
                variant="outline"
                size="sm"
                className="w-full"
              >
                <X className="h-4 w-4 mr-2" />
                Limpar Filtros
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* TABELA DE PROFISSIONAIS */}
      <div className="border rounded-lg medical-staff-table">
        <div className="p-4 border-b bg-gray-50">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Users className="h-5 w-5 text-gray-600" />
              <span className="font-medium text-gray-900">Lista de Profissionais</span>
              <Badge variant="secondary">
                {isLoading ? '...' : `${filteredDoctors.length} profissionais`}
              </Badge>
              {totalPages > 1 && (
                <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">
                  Página {currentPage} de {totalPages}
                </Badge>
              )}
              {/* Mostrar filtros ativos */}
              {(searchTerm || selectedHospital !== 'all' || selectedSpecialty !== 'all') && (
                <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">
                  <Filter className="h-3 w-3 mr-1" />
                  Filtrado
                </Badge>
              )}
            </div>
            
            {/* CONTROLES DE PAGINAÇÃO NO CABEÇALHO */}
            {totalPages > 1 && (
              <div className="flex items-center gap-1">
                {/* Primeira página */}
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handlePageChange(1)}
                  disabled={currentPage === 1}
                  className="h-7 w-7 p-0"
                >
                  <ChevronsLeft className="h-3 w-3" />
                </Button>
                
                {/* Página anterior */}
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handlePreviousPage}
                  disabled={currentPage === 1}
                  className="h-7 w-7 p-0"
                >
                  <ChevronLeft className="h-3 w-3" />
                </Button>
                
                {/* Números das páginas (versão compacta) */}
                <div className="flex items-center gap-1">
                  {Array.from({ length: Math.min(3, totalPages) }, (_, i) => {
                    let pageNumber;
                    if (totalPages <= 3) {
                      pageNumber = i + 1;
                    } else if (currentPage <= 2) {
                      pageNumber = i + 1;
                    } else if (currentPage >= totalPages - 1) {
                      pageNumber = totalPages - 2 + i;
                    } else {
                      pageNumber = currentPage - 1 + i;
                    }
                    
                    return (
                      <Button
                        key={pageNumber}
                        variant={currentPage === pageNumber ? "default" : "outline"}
                        size="sm"
                        onClick={() => handlePageChange(pageNumber)}
                        className="h-7 w-7 p-0 text-xs"
                      >
                        {pageNumber}
                      </Button>
                    );
                  })}
                </div>
                
                {/* Próxima página */}
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleNextPage}
                  disabled={currentPage === totalPages}
                  className="h-7 w-7 p-0"
                >
                  <ChevronRight className="h-3 w-3" />
                </Button>
                
                {/* Última página */}
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handlePageChange(totalPages)}
                  disabled={currentPage === totalPages}
                  className="h-7 w-7 p-0"
                >
                  <ChevronsRight className="h-3 w-3" />
                </Button>
              </div>
            )}
          </div>
        </div>
        
        {isLoading ? (
          <div className="p-4 space-y-2">
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
                    <TableHead className="w-12"></TableHead>
                    <TableHead>Profissional</TableHead>
                    <TableHead>Especialidade</TableHead>
                    <TableHead>Hospital</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {currentDoctors.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={4} className="text-center py-12">
                        <div className="flex flex-col items-center justify-center text-gray-500">
                          <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mb-4">
                            <Users className="h-8 w-8 text-slate-400" />
                          </div>
                          <p className="text-lg font-medium mb-2 text-gray-700">Nenhum médico encontrado</p>
                          <p className="text-sm mb-6 text-gray-500 max-w-md">
                            {filteredDoctors.length === 0 
                              ? (searchTerm || selectedHospital !== 'all' || selectedSpecialty !== 'all') 
                                ? 'Nenhum médico corresponde aos filtros aplicados. Tente ajustar os critérios de busca.' 
                                : 'Ainda não há médicos cadastrados no sistema.'
                              : `Mostrando ${currentDoctors.length} de ${filteredDoctors.length} médicos encontrados.`}
                          </p>
                          {(searchTerm || selectedHospital !== 'all' || selectedSpecialty !== 'all') && (
                            <Button 
                              variant="outline" 
                              size="sm" 
                              onClick={handleClearFilters}
                              className="flex items-center gap-2 border-slate-300 text-slate-600 hover:bg-slate-50"
                            >
                              <X className="h-4 w-4" />
                              Limpar Filtros
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ) : (
                    currentDoctors.map((doctor) => {
                      try {
                        // Proteção adicional contra dados inválidos
                        if (!doctor || !doctor.id) {
                          console.warn('⚠️ Médico com dados inválidos:', doctor);
                          return null;
                        }
                    
                    const isExpanded = expandedRows.has(doctor.id);
                    
                    return (
                      <React.Fragment key={doctor.id}>
                        <TableRow className={isExpanded ? 'bg-slate-50' : 'hover:bg-gray-50'}>
                          <TableCell className="w-12">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => toggleRowExpansion(doctor.id)}
                              className="h-8 w-8 p-0 hover:bg-gray-100"
                            >
                              {isExpanded ? (
                                <ChevronUp className="h-4 w-4 text-gray-600" />
                              ) : (
                                <ChevronDown className="h-4 w-4 text-gray-600" />
                              )}
                            </Button>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center space-x-3">
                              <div className="w-10 h-10 bg-slate-100 rounded-lg flex items-center justify-center">
                                <User className="h-5 w-5 text-slate-600" />
                              </div>
                              <div>
                                <div className="font-medium text-gray-900">{doctor.name}</div>
                                <div className="text-sm text-gray-500">CNS: {doctor.cns}</div>
                              </div>
                            </div>
                          </TableCell>
                          <TableCell>
                            {doctor.speciality ? (
                              <Badge
                                variant="secondary"
                                className="text-xs px-3 py-1 bg-slate-100 text-slate-700 border-slate-200 font-medium"
                              >
                                <span className="mr-1">{getSpecialtyIcon(doctor.speciality)}</span>
                                {doctor.speciality}
                              </Badge>
                            ) : (
                              <span className="text-sm text-gray-400">Não informado</span>
                            )}
                          </TableCell>
                          <TableCell>
                            <div className="text-sm">
                              {doctor.hospitals && doctor.hospitals.length > 0 ? (
                                <div className="space-y-1">
                                  {doctor.hospitals.slice(0, 2).map((hospital: string, index: number) => (
                                    <div key={index} className="text-gray-700 font-medium">
                                      {hospital}
                                    </div>
                                  ))}
                                  {doctor.hospitals.length > 2 && (
                                    <div className="text-xs text-gray-500">
                                      +{doctor.hospitals.length - 2} outros hospitais
                                    </div>
                                  )}
                                  {doctor.hospitals.length > 1 && (
                                    <Badge variant="outline" className="text-xs bg-blue-50 text-blue-700 border-blue-200">
                                      {doctor.hospitals.length} hospitais
                                    </Badge>
                                  )}
                                </div>
                              ) : (
                                <span className="text-gray-400">Não informado</span>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                        {isExpanded && (
                          <TableRow>
                            <TableCell colSpan={4} className="bg-slate-50 border-t">
                              <div className="py-4 space-y-3">
                                <div className="flex items-center gap-2 text-sm font-medium text-gray-700">
                                  <MessageSquare className="h-4 w-4 text-slate-600" />
                                  Observações sobre o profissional
                                </div>
                                
                                <div className="bg-white rounded-lg p-4 border border-slate-200 shadow-sm">
                                  <Textarea
                                    placeholder="Adicione observações sobre este profissional..."
                                    value={doctorObservations[doctor.id] || ''}
                                    onChange={(e) => {
                                      setDoctorObservations(prev => ({
                                        ...prev,
                                        [doctor.id]: e.target.value
                                      }));
                                    }}
                                    className="min-h-[80px] resize-none border-slate-200 focus:border-slate-400 focus:ring-slate-400"
                                  />
                                  
                                  <div className="flex justify-end gap-2 mt-3">
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      onClick={() => {
                                        setDoctorObservations(prev => {
                                          const newObs = { ...prev };
                                          delete newObs[doctor.id];
                                          return newObs;
                                        });
                                      }}
                                      className="border-slate-300 text-slate-600 hover:bg-slate-50"
                                    >
                                      <X className="h-4 w-4 mr-1" />
                                      Limpar
                                    </Button>
                                    <Button
                                      size="sm"
                                      onClick={() => handleUpdateDoctorNote(doctor.id, doctorObservations[doctor.id] || '')}
                                      className="bg-slate-700 hover:bg-slate-800 text-white"
                                    >
                                      <Save className="h-4 w-4 mr-1" />
                                      Salvar
                                    </Button>
                                  </div>
                                </div>
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
          
          {/* CONTROLES DE PAGINAÇÃO */}
          {totalPages > 1 && (
            <div className="p-4 border-t bg-gray-50">
              <div className="flex items-center justify-between">
                <div className="text-sm text-gray-600">
                  Mostrando {startIndex + 1} a {Math.min(endIndex, filteredDoctors.length)} de {filteredDoctors.length} profissionais
                </div>
                
                <div className="flex items-center gap-2">
                  {/* Primeira página */}
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handlePageChange(1)}
                    disabled={currentPage === 1}
                    className="h-8 w-8 p-0"
                  >
                    <ChevronsLeft className="h-4 w-4" />
                  </Button>
                  
                  {/* Página anterior */}
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handlePreviousPage}
                    disabled={currentPage === 1}
                    className="h-8 w-8 p-0"
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  
                  {/* Números das páginas */}
                  <div className="flex items-center gap-1">
                    {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                      let pageNumber;
                      if (totalPages <= 5) {
                        pageNumber = i + 1;
                      } else if (currentPage <= 3) {
                        pageNumber = i + 1;
                      } else if (currentPage >= totalPages - 2) {
                        pageNumber = totalPages - 4 + i;
                      } else {
                        pageNumber = currentPage - 2 + i;
                      }
                      
                      return (
                        <Button
                          key={pageNumber}
                          variant={currentPage === pageNumber ? "default" : "outline"}
                          size="sm"
                          onClick={() => handlePageChange(pageNumber)}
                          className="h-8 w-8 p-0"
                        >
                          {pageNumber}
                        </Button>
                      );
                    })}
                  </div>
                  
                  {/* Próxima página */}
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleNextPage}
                    disabled={currentPage === totalPages}
                    className="h-8 w-8 p-0"
                  >
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                  
                  {/* Última página */}
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handlePageChange(totalPages)}
                    disabled={currentPage === totalPages}
                    className="h-8 w-8 p-0"
                  >
                    <ChevronsRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </div>
          )}
      </div>
    </div>
  );
};

export default MedicalStaffDashboard;
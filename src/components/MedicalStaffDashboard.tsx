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
  Info
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
    
    toast({
      title: "Filtros limpos",
      description: "Todos os filtros foram removidos"
    });
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

      {/* CONTROLES E FILTROS */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <Filter className="h-5 w-5" />
              <span>Filtros e Controles</span>
            </div>
            {/* Indicador de filtros ativos */}
            {(searchTerm || selectedHospital !== 'all' || selectedSpecialty !== 'all') && (
              <Badge variant="secondary" className="flex items-center gap-1">
                <Filter className="h-3 w-3" />
                Filtros Ativos
              </Badge>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {/* Botões de ação */}
          <div className="flex flex-wrap gap-2">
            <Button
              onClick={handleRefresh}
              disabled={isLoading}
              variant="outline"
              size="sm"
              className="flex items-center gap-2"
            >
              <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
              Atualizar
            </Button>

            <Button
              onClick={handleClearFilters}
              disabled={isLoading}
              variant="outline"
              size="sm"
              className="flex items-center gap-2"
            >
              <X className="h-4 w-4" />
              Limpar Filtros
            </Button>

            <Button
              onClick={handleExport}
              variant="outline"
              size="sm"
              className="flex items-center gap-2"
            >
              <Download className="h-4 w-4" />
              Exportar
            </Button>
          </div>

          {/* Filtros */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div className="space-y-1">
              <Label className="text-sm font-medium flex items-center gap-2">
                <Search className="h-4 w-4" />
                Buscar
              </Label>
              <div className="relative">
                <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                <Input
                  placeholder="Nome, CRM, CNS ou especialidade..."
                  value={searchTerm}
                  onChange={(e) => {
                    try {
                      setSearchTerm(e.target.value);
                    } catch (error) {
                      console.error('❌ Erro ao atualizar termo de busca:', error);
                    }
                  }}
                  className="pl-10 pr-10"
                  disabled={isLoading}
                />
                {/* Indicador de busca ativa */}
                {searchTerm && (
                  <button
                    onClick={() => setSearchTerm('')}
                    className="absolute right-3 top-3 h-4 w-4 text-gray-400 hover:text-gray-600"
                    type="button"
                  >
                    <X className="h-4 w-4" />
                  </button>
                )}
                {/* Indicador de debounce */}
                {searchTerm !== debouncedSearchTerm && (
                  <div className="absolute right-8 top-3">
                    <Loader2 className="h-4 w-4 animate-spin text-blue-500" />
                  </div>
                )}
              </div>
            </div>

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
              {isLoading ? '...' : `${filteredDoctors.length} profissionais`}
            </Badge>
            {/* Mostrar filtros ativos */}
            {(searchTerm || selectedHospital !== 'all' || selectedSpecialty !== 'all') && (
              <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">
                <Filter className="h-3 w-3 mr-1" />
                Filtrado
              </Badge>
            )}
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
                    <TableHead className="w-12"></TableHead>
                    <TableHead>Profissional</TableHead>
                    <TableHead>Especialidade</TableHead>
                    <TableHead>Hospital</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredDoctors.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={4} className="text-center py-8">
                        <div className="flex flex-col items-center justify-center text-gray-500">
                          <Users className="h-12 w-12 mb-4 text-gray-300" />
                          <p className="text-lg font-medium mb-2">Nenhum médico encontrado</p>
                          <p className="text-sm mb-4">
                            {(searchTerm || selectedHospital !== 'all' || selectedSpecialty !== 'all') 
                              ? 'Nenhum médico corresponde aos filtros aplicados' 
                              : 'Ainda não há médicos cadastrados no sistema'}
                          </p>
                          {(searchTerm || selectedHospital !== 'all' || selectedSpecialty !== 'all') && (
                            <Button 
                              variant="outline" 
                              size="sm" 
                              onClick={handleClearFilters}
                              className="flex items-center gap-2"
                            >
                              <X className="h-4 w-4" />
                              Limpar Filtros
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredDoctors.map((doctor) => {
                      try {
                        // Proteção adicional contra dados inválidos
                        if (!doctor || !doctor.id) {
                          console.warn('⚠️ Médico com dados inválidos:', doctor);
                          return null;
                        }
                    
                    const isExpanded = expandedRows.has(doctor.id);
                    
                    return (
                      <React.Fragment key={doctor.id}>
                        <TableRow className={isExpanded ? 'bg-blue-50' : ''}>
                          <TableCell>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => toggleRowExpansion(doctor.id)}
                              className="h-8 w-8 p-0"
                            >
                              {isExpanded ? (
                                <ChevronUp className="h-4 w-4" />
                              ) : (
                                <ChevronDown className="h-4 w-4" />
                              )}
                            </Button>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center space-x-3">
                              <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
                                <User className="h-5 w-5 text-blue-600" />
                              </div>
                              <div>
                                <div className="font-medium">{doctor.name}</div>
                                <div className="text-sm text-gray-500">CNS: {doctor.cns}</div>
                              </div>
                            </div>
                          </TableCell>
                          <TableCell>
                            {doctor.speciality ? (
                              <Badge
                                variant="outline"
                                className={`
                                  text-xs px-2 py-1 flex items-center gap-1 w-fit
                                  ${getSpecialtyColor(doctor.speciality)}
                                `}
                              >
                                <span>{getSpecialtyIcon(doctor.speciality)}</span>
                                {doctor.speciality}
                              </Badge>
                            ) : (
                              <div className="text-sm text-gray-500">Não informado</div>
                            )}
                          </TableCell>
                          <TableCell>
                            <div className="text-sm">
                              {doctor.hospitals && doctor.hospitals.length > 0 ? (
                                <div className="flex flex-wrap gap-1">
                                  {doctor.hospitals.map((hospital: string, index: number) => (
                                    <span key={index} className="text-gray-700">
                                      {hospital}
                                      {index < doctor.hospitals.length - 1 && ', '}
                                    </span>
                                  ))}
                                  {doctor.hospitals.length > 1 && (
                                    <span className="text-xs text-gray-500 ml-1">
                                      ({doctor.hospitals.length} hospitais)
                                    </span>
                                  )}
                                </div>
                              ) : (
                                <span className="text-gray-500">Não informado</span>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                        {isExpanded && (
                          <TableRow>
                            <TableCell colSpan={4} className="bg-blue-50 border-t-0">
                              <div className="p-4 space-y-4">
                                <div className="flex items-center gap-2 mb-3">
                                  <MessageSquare className="h-4 w-4 text-blue-600" />
                                  <h4 className="font-medium text-gray-900">Observações</h4>
                                </div>
                                <div className="space-y-2">
                                  <textarea
                                    placeholder="Adicione observações sobre este profissional..."
                                    value={doctorObservations[doctor.id] || ''}
                                    onChange={(e) => handleUpdateDoctorNote(doctor.id, e.target.value)}
                                    className="w-full p-3 border border-gray-300 rounded-md resize-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                    rows={3}
                                  />
                                  <div className="text-xs text-gray-500">
                                    As observações são salvas automaticamente conforme você digita.
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
        </CardContent>
      </Card>
    </div>
  );
};

export default MedicalStaffDashboard;
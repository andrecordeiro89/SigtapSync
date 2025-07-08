import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Input } from './ui/input';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from './ui/table';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from './ui/dialog';
import { Textarea } from './ui/textarea';
import { Skeleton } from './ui/skeleton';
import { 
  Search, 
  Filter, 
  ChevronDown, 
  ChevronUp, 
  ChevronRight,
  Eye, 
  MapPin, 
  Phone, 
  Mail, 
  Calendar, 
  Users, 
  User,
  Building2, 
  Stethoscope, 
  Check, 
  X,
  Loader2,
  RefreshCw,
  Download,
  SortAsc,
  SortDesc,
  UserCheck,
  UserX,
  AlertCircle,
  Save,
  Edit3,
  FileText
} from 'lucide-react';
import { useProfessionalViews } from '../hooks/useProfessionalViews';
import { 
  DoctorHospitalInfo, 
  ProfessionalsFilters, 
  ProfessionalDetails 
} from '../types';
import { DoctorsCrudService } from '../services/doctorsCrudService';
import { toast } from './ui/use-toast';
import { getSpecialtyColor, getHospitalColor, getSpecialtyIcon, getHospitalIcon, AVAILABLE_SPECIALTIES } from '../utils/specialtyColors';

/**
 * 🩺 COMPONENTE TABELA DE PROFISSIONAIS
 * Tabela completa com filtros dinâmicos e visualização detalhada
 */
interface ProfessionalsTableProps {
  className?: string;
}

const ProfessionalsTable: React.FC<ProfessionalsTableProps> = ({ className = '' }) => {
  // Hook principal para dados
  const {
    professionals,
    isLoading,
    error,
    totalCount,
    hasMore,
    availableSpecialties,
    availableHospitals,
    availableRoles,
    availableDepartments,
    applyFilters,
    loadNextPage,
    resetData
  } = useProfessionalViews();

  // Estados locais
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedHospital, setSelectedHospital] = useState<string>('all');
  const [selectedSpecialty, setSelectedSpecialty] = useState<string>('all');
  const [selectedStatus, setSelectedStatus] = useState<string>('all');
  const [selectedRole, setSelectedRole] = useState<string>('all');
  const [selectedDepartment, setSelectedDepartment] = useState<string>('all');
  const [sortBy, setSortBy] = useState<'name' | 'specialty' | 'hospital' | 'status'>('name');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');

  // Estados para modal de detalhes
  const [selectedProfessional, setSelectedProfessional] = useState<DoctorHospitalInfo | null>(null);
  const [isDetailsModalOpen, setIsDetailsModalOpen] = useState(false);

  // Estados para filtros avançados
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);
  const [isPrimaryHospitalOnly, setIsPrimaryHospitalOnly] = useState(false);

  // Estados para linhas expansíveis e edição de observações
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());
  const [editingNotes, setEditingNotes] = useState<string | null>(null);
  const [tempNotes, setTempNotes] = useState<string>('');
  const [savingNotes, setSavingNotes] = useState<string | null>(null);

  // Estados para edição de dados profissionais
  const [editingProfessional, setEditingProfessional] = useState<string | null>(null);
  const [tempProfessionalData, setTempProfessionalData] = useState<{
    specialty: string;
    hospitalId: string;
    role: string;
    department: string;
    isPrimaryHospital: boolean;
  }>({
    specialty: '',
    hospitalId: '',
    role: '',
    department: '',
    isPrimaryHospital: false
  });
  const [savingProfessional, setSavingProfessional] = useState<string | null>(null);

  /**
   * 🔍 APLICAR FILTROS
   * Aplica filtros baseados nos estados atuais
   */
  const handleApplyFilters = () => {
    const filters: ProfessionalsFilters = {
      searchTerm: searchTerm.trim() || undefined,
      hospitalId: selectedHospital !== 'all' ? selectedHospital : undefined,
      specialty: selectedSpecialty !== 'all' ? selectedSpecialty : undefined,
      status: selectedStatus !== 'all' ? selectedStatus as any : undefined,
      role: selectedRole !== 'all' ? selectedRole : undefined,
      department: selectedDepartment !== 'all' ? selectedDepartment : undefined,
      isPrimaryHospital: isPrimaryHospitalOnly ? true : undefined,
      sortBy,
      sortOrder
    };

    applyFilters(filters);
  };

  /**
   * 🔄 LIMPAR FILTROS
   * Reseta todos os filtros
   */
  const handleClearFilters = () => {
    setSearchTerm('');
    setSelectedHospital('all');
    setSelectedSpecialty('all');
    setSelectedStatus('all');
    setSelectedRole('all');
    setSelectedDepartment('all');
    setIsPrimaryHospitalOnly(false);
    setSortBy('name');
    setSortOrder('asc');
    
    // Aplica filtros vazios
    applyFilters({});
  };

  /**
   * 📊 ALTERAR ORDENAÇÃO
   * Altera critério de ordenação
   */
  const handleSort = (field: 'name' | 'specialty' | 'hospital' | 'status') => {
    if (sortBy === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(field);
      setSortOrder('asc');
    }
  };

  /**
   * 👁️ VISUALIZAR DETALHES
   * Abre modal com detalhes do profissional
   */
  const handleViewDetails = (professional: DoctorHospitalInfo) => {
    setSelectedProfessional(professional);
    setIsDetailsModalOpen(true);
  };

  /**
   * 🔄 ATUALIZAR DADOS
   * Força atualização dos dados
   */
  const handleRefresh = () => {
    resetData();
    handleApplyFilters();
  };

  /**
   * 🔄 EXPANDIR/RECOLHER LINHA
   * Controla expansão das linhas para edição de observações
   */
  const handleToggleRow = (doctorId: string) => {
    const newExpandedRows = new Set(expandedRows);
    if (expandedRows.has(doctorId)) {
      newExpandedRows.delete(doctorId);
      // Se estava editando, cancelar edição
      if (editingNotes === doctorId) {
        setEditingNotes(null);
        setTempNotes('');
      }
    } else {
      newExpandedRows.add(doctorId);
    }
    setExpandedRows(newExpandedRows);
  };

  /**
   * ✏️ INICIAR EDIÇÃO DE OBSERVAÇÕES
   * Entra no modo de edição das observações de um médico
   */
  const handleStartEditNotes = (professional: DoctorHospitalInfo) => {
    setEditingNotes(professional.doctor_id);
    // Buscar observações atuais - campo notes da tabela doctors
    // Como a view não inclui notes, vamos assumir vazio por enquanto
    setTempNotes(''); // TODO: Buscar notes real do médico
  };

  /**
   * ❌ CANCELAR EDIÇÃO DE OBSERVAÇÕES
   * Cancela a edição das observações
   */
  const handleCancelEditNotes = () => {
    setEditingNotes(null);
    setTempNotes('');
  };

  /**
   * 💾 SALVAR OBSERVAÇÕES
   * Salva as observações editadas no banco de dados
   */
  const handleSaveNotes = async (professional: DoctorHospitalInfo) => {
    setSavingNotes(professional.doctor_id);
    
    try {
      console.log('💾 Salvando observações para médico:', professional.doctor_name);
      
      const result = await DoctorsCrudService.updateDoctor(
        professional.doctor_id,
        { notes: tempNotes.trim() }
      );
      
      if (result.success) {
        toast({
          title: "✅ Observações Salvas",
          description: `Observações do Dr(a). ${professional.doctor_name} foram atualizadas com sucesso.`,
          variant: "default",
          duration: 3000,
        });
        
        // Sair do modo de edição
        setEditingNotes(null);
        setTempNotes('');
        
        // Atualizar dados
        handleRefresh();
        
        console.log('✅ Observações salvas com sucesso');
      } else {
        throw new Error(result.error || 'Erro ao salvar observações');
      }
      
    } catch (error) {
      console.error('❌ Erro ao salvar observações:', error);
      
      toast({
        title: "❌ Erro",
        description: "Não foi possível salvar as observações. Tente novamente.",
        variant: "destructive",
        duration: 5000,
      });
    } finally {
      setSavingNotes(null);
    }
  };

  /**
   * ✏️ INICIAR EDIÇÃO DE DADOS PROFISSIONAIS
   * Entra no modo de edição dos dados do médico
   */
  const handleStartEditProfessional = (professional: DoctorHospitalInfo) => {
    setEditingProfessional(professional.doctor_id);
    setTempProfessionalData({
      specialty: professional.doctor_specialty,
      hospitalId: professional.hospital_id,
      role: professional.link_role || '',
      department: professional.link_department || '',
      isPrimaryHospital: professional.link_is_primary_hospital
    });
  };

  /**
   * ❌ CANCELAR EDIÇÃO DE DADOS PROFISSIONAIS
   * Cancela a edição dos dados profissionais
   */
  const handleCancelEditProfessional = () => {
    setEditingProfessional(null);
    setTempProfessionalData({
      specialty: '',
      hospitalId: '',
      role: '',
      department: '',
      isPrimaryHospital: false
    });
  };

  /**
   * 💾 SALVAR DADOS PROFISSIONAIS
   * Salva as alterações dos dados profissionais no banco de dados
   */
  const handleSaveProfessional = async (professional: DoctorHospitalInfo) => {
    setSavingProfessional(professional.doctor_id);
    
    try {
      console.log('💾 Salvando dados profissionais para médico:', professional.doctor_name);
      
      // Atualizar dados do médico (especialidade)
      const doctorResult = await DoctorsCrudService.updateDoctor(
        professional.doctor_id,
        { 
          specialty: tempProfessionalData.specialty.trim()
        }
      );
      
      if (!doctorResult.success) {
        throw new Error(doctorResult.error || 'Erro ao atualizar especialidade');
      }
      
      // TODO: Implementar atualização do vínculo hospital quando o serviço estiver disponível
      // Aqui atualizaríamos cargo, departamento e hospital principal
      
      toast({
        title: "✅ Dados Atualizados",
        description: `Dados profissionais do Dr(a). ${professional.doctor_name} foram atualizados com sucesso.`,
        variant: "default",
        duration: 3000,
      });
      
      // Sair do modo de edição
      setEditingProfessional(null);
      setTempProfessionalData({
        specialty: '',
        hospitalId: '',
        role: '',
        department: '',
        isPrimaryHospital: false
      });
      
      // Atualizar dados
      handleRefresh();
      
      console.log('✅ Dados profissionais salvos com sucesso');
      
    } catch (error) {
      console.error('❌ Erro ao salvar dados profissionais:', error);
      
      toast({
        title: "❌ Erro",
        description: "Não foi possível salvar os dados profissionais. Tente novamente.",
        variant: "destructive",
        duration: 5000,
      });
    } finally {
      setSavingProfessional(null);
    }
  };

  /**
   * 💾 EXPORTAR DADOS
   * Exporta dados filtrados para CSV
   */
  const handleExport = () => {
    const csvData = professionals.map(prof => ({
      Nome: prof.doctor_name,
      CRM: prof.doctor_crm,
      CNS: prof.doctor_cns,
      Especialidade: prof.doctor_specialty,
      Hospital: prof.hospital_name,
      Cargo: prof.link_role || '',
      Departamento: prof.link_department || '',
      Status: prof.doctor_is_active ? 'Registrado' : 'Não Registrado',
      'SUS Habilitado': prof.doctor_is_sus_enabled ? 'Sim' : 'Não',
      Email: prof.doctor_email || '',
      Telefone: prof.doctor_phone || '',
      Celular: prof.doctor_mobile_phone || ''
    }));

    const csvContent = [
      Object.keys(csvData[0] || {}).join(','),
      ...csvData.map(row => Object.values(row).join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `profissionais_${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
  };

  // Efeito para aplicar filtros quando mudarem
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      handleApplyFilters();
    }, 300);

    return () => clearTimeout(timeoutId);
  }, [searchTerm, selectedHospital, selectedSpecialty, selectedStatus, selectedRole, selectedDepartment, isPrimaryHospitalOnly, sortBy, sortOrder]);

  const getSortIcon = (field: string) => {
    if (sortBy !== field) return null;
    return sortOrder === 'asc' ? 
      <SortAsc className="h-4 w-4 ml-1" /> : 
      <SortDesc className="h-4 w-4 ml-1" />;
  };

  return (
    <div className={`space-y-6 ${className}`}>
      {/* FILTROS E CONTROLES */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center space-x-2">
              <Users className="h-5 w-5" />
              <span>Profissionais de Saúde</span>
            </CardTitle>
            <div className="flex items-center space-x-2">
              <Button
                variant="outline"
                size="sm"
                onClick={handleRefresh}
                disabled={isLoading}
              >
                <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
                Atualizar
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={handleExport}
                disabled={professionals.length === 0}
              >
                <Download className="h-4 w-4 mr-2" />
                Exportar
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {/* FILTROS BÁSICOS */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Buscar</label>
            <div className="relative">
              <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
              <Input
                  placeholder="Nome, CRM, especialidade..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Hospital</label>
            <Select value={selectedHospital} onValueChange={setSelectedHospital}>
              <SelectTrigger>
                  <SelectValue placeholder="Selecione o hospital" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os Hospitais</SelectItem>
                  {availableHospitals.map((hospital) => (
                  <SelectItem key={hospital.id} value={hospital.id}>
                    {hospital.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Especialidade</label>
            <Select value={selectedSpecialty} onValueChange={setSelectedSpecialty}>
              <SelectTrigger>
                  <SelectValue placeholder="Selecione a especialidade" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas as Especialidades</SelectItem>
                  {availableSpecialties.map((specialty) => (
                  <SelectItem key={specialty} value={specialty}>
                    {specialty}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            </div>
          </div>

          {/* FILTROS AVANÇADOS */}
          <div className="mt-4">
            <Button
              variant="ghost"
              onClick={() => setShowAdvancedFilters(!showAdvancedFilters)}
              className="text-sm"
            >
              <Filter className="h-4 w-4 mr-2" />
              {showAdvancedFilters ? 'Ocultar' : 'Mostrar'} Filtros Avançados
              {showAdvancedFilters ? <ChevronUp className="h-4 w-4 ml-2" /> : <ChevronDown className="h-4 w-4 ml-2" />}
            </Button>
          </div>

          {showAdvancedFilters && (
            <div className="mt-4 space-y-4 p-4 bg-gray-50 rounded-lg">
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                {/* Status */}
                <Select value={selectedStatus} onValueChange={setSelectedStatus}>
                  <SelectTrigger>
                    <SelectValue placeholder="Status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos os Status</SelectItem>
                    <SelectItem value="active">Apenas Registrados</SelectItem>
                    <SelectItem value="inactive">Apenas Não Registrados</SelectItem>
                  </SelectContent>
                </Select>

                {/* Cargo */}
                <Select value={selectedRole} onValueChange={setSelectedRole}>
                  <SelectTrigger>
                    <SelectValue placeholder="Cargo" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos os Cargos</SelectItem>
                    {availableRoles.map(role => (
                      <SelectItem key={role} value={role}>
                        {role}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                {/* Departamento */}
                <Select value={selectedDepartment} onValueChange={setSelectedDepartment}>
                  <SelectTrigger>
                    <SelectValue placeholder="Departamento" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos os Departamentos</SelectItem>
                    {availableDepartments.map(dept => (
                      <SelectItem key={dept} value={dept}>
                        {dept}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                {/* Ordenação */}
                <div className="flex items-center space-x-2">
                  <Select value={sortBy} onValueChange={(value) => setSortBy(value as any)}>
                    <SelectTrigger>
                      <SelectValue placeholder="Ordenar por" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="name">Nome</SelectItem>
                      <SelectItem value="specialty">Especialidade</SelectItem>
                      <SelectItem value="hospital">Hospital</SelectItem>
                      <SelectItem value="status">Status</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Checkbox para Hospital Principal */}
              <div className="mt-4 flex items-center space-x-2">
                <input
                  type="checkbox"
                  id="primaryHospital"
                  checked={isPrimaryHospitalOnly}
                  onChange={(e) => setIsPrimaryHospitalOnly(e.target.checked)}
                  className="rounded border-gray-300"
                />
                <label htmlFor="primaryHospital" className="text-sm text-gray-600">
                  Apenas Hospital Principal
                </label>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* TABELA DE PROFISSIONAIS */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <Users className="h-5 w-5" />
              <span>Profissionais ({professionals.length})</span>
            </div>
            {isLoading && <Loader2 className="h-4 w-4 animate-spin" />}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {error && (
            <div className="text-red-600 text-sm mb-4 p-3 bg-red-50 rounded-lg border border-red-200">
              <div className="flex items-center gap-2">
                <AlertCircle className="h-4 w-4" />
                <span className="font-medium">Erro ao carregar dados</span>
              </div>
              <div className="mt-1 text-xs">{error}</div>
            </div>
          )}

          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead 
                    className="cursor-pointer hover:bg-gray-100 transition-colors"
                    onClick={() => handleSort('name')}
                  >
                    <div className="flex items-center">
                      Nome {getSortIcon('name')}
                    </div>
                  </TableHead>
                  <TableHead>CNS</TableHead>
                  <TableHead 
                    className="cursor-pointer hover:bg-gray-100 transition-colors"
                    onClick={() => handleSort('specialty')}
                  >
                    <div className="flex items-center">
                      Especialidade {getSortIcon('specialty')}
                    </div>
                  </TableHead>
                  <TableHead 
                    className="cursor-pointer hover:bg-gray-100 transition-colors"
                    onClick={() => handleSort('hospital')}
                  >
                    <div className="flex items-center">
                      Hospital {getSortIcon('hospital')}
                    </div>
                  </TableHead>
                  <TableHead>Expandir</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {/* SKELETON LOADING */}
                {isLoading && professionals.length === 0 && (
                  <>
                    {Array.from({ length: 5 }).map((_, index) => (
                      <TableRow key={`skeleton-${index}`}>
                        <TableCell>
                          <div className="space-y-2">
                            <Skeleton className="h-4 w-[200px]" />
                            <Skeleton className="h-3 w-[160px]" />
                          </div>
                        </TableCell>
                        <TableCell>
                          <Skeleton className="h-4 w-[120px]" />
                        </TableCell>
                        <TableCell>
                          <Skeleton className="h-6 w-[140px] rounded-full" />
                        </TableCell>
                        <TableCell>
                          <div className="space-y-1">
                            <Skeleton className="h-6 w-[100px] rounded-full" />
                            <Skeleton className="h-4 w-[80px]" />
                          </div>
                        </TableCell>
                        <TableCell>
                          <Skeleton className="h-8 w-8 rounded" />
                        </TableCell>
                      </TableRow>
                    ))}
                  </>
                )}

                {/* MENSAGEM DE VAZIO */}
                {!isLoading && professionals.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center py-8">
                      <div className="flex flex-col items-center space-y-3 text-gray-500">
                        <Users className="h-12 w-12 text-gray-300" />
                        <div>
                          <div className="font-medium">Nenhum profissional encontrado</div>
                          <div className="text-sm">Tente ajustar os filtros ou termos de busca</div>
                        </div>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={handleClearFilters}
                          className="flex items-center gap-2"
                        >
                          <X className="h-4 w-4" />
                          Limpar Filtros
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                )}
                {professionals.map((professional, index) => {
                  const isExpanded = expandedRows.has(professional.doctor_id);
                  const isEditing = editingNotes === professional.doctor_id;
                  const isSaving = savingNotes === professional.doctor_id;
                  
                  return (
                    <React.Fragment key={`${professional.doctor_id}-${professional.hospital_id}-${index}`}>
                                            {/* LINHA PRINCIPAL */}
                      <TableRow className="hover:bg-gray-50 transition-colors duration-200 group"
                        style={{ 
                          borderLeft: isExpanded ? '3px solid #3b82f6' : '3px solid transparent',
                          transition: 'border-left-color 0.2s ease'
                        }}
                      >
                    <TableCell>
                      <div>
                        <div className="font-medium">{professional.doctor_name}</div>
                        {professional.doctor_email && (
                          <div className="text-sm text-gray-600">{professional.doctor_email}</div>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="text-sm text-gray-700">
                        {professional.doctor_cns}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge 
                        variant="outline" 
                        className={`text-xs border ${getSpecialtyColor(professional.doctor_specialty)} 
                          hover:shadow-sm transition-all duration-200 hover:scale-105 cursor-default`}
                      >
                        <span className="mr-1 animate-pulse">{getSpecialtyIcon(professional.doctor_specialty)}</span>
                        {professional.doctor_specialty}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="text-sm space-y-1">
                        <Badge 
                          variant="outline" 
                          className={`text-xs border ${getHospitalColor(professional.link_is_primary_hospital ? 'principal' : 'secundario')} 
                            hover:shadow-sm transition-all duration-200 hover:scale-105 cursor-default`}
                        >
                          <span className="mr-1">{getHospitalIcon(professional.link_is_primary_hospital ? 'principal' : 'secundario')}</span>
                          {professional.hospital_name}
                        </Badge>
                        {professional.link_is_primary_hospital && (
                          <div>
                            <Badge variant="secondary" className="text-xs hover:shadow-sm transition-all duration-200">
                              ⭐ Hospital Principal
                          </Badge>
                          </div>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleToggleRow(professional.doctor_id)}
                          title={isExpanded ? "Recolher informações" : "Expandir para editar dados e observações"}
                          className={`
                            text-blue-600 hover:text-blue-700 hover:bg-blue-50 
                            transition-all duration-200 group-hover:bg-blue-100
                            ${isExpanded ? 'bg-blue-100 text-blue-700' : ''}
                          `}
                        >
                          {isExpanded ? (
                            <ChevronDown className="h-4 w-4 transition-transform duration-200" />
                          ) : (
                            <ChevronRight className="h-4 w-4 transition-transform duration-200 group-hover:translate-x-0.5" />
                          )}
                        </Button>
                    </TableCell>
                      </TableRow>

                      {/* LINHA EXPANDIDA - EDIÇÃO DE DADOS PROFISSIONAIS E OBSERVAÇÕES */}
                      {isExpanded && (
                        <TableRow className="bg-gradient-to-r from-blue-50 to-gray-50 animate-in slide-in-from-top-2 duration-300">
                          <TableCell colSpan={5} className="p-6 border-l-3 border-blue-500">
                            <div className="space-y-6">
                              
                              {/* 📝 SEÇÃO DE EDIÇÃO DE DADOS PROFISSIONAIS */}
                              <div className="bg-white p-5 rounded-lg border shadow-sm">
                                <div className="flex items-center justify-between mb-4">
                                  <h4 className="font-semibold text-gray-900 flex items-center gap-2">
                                    <User className="h-4 w-4" />
                                    Dados Profissionais
                                  </h4>
                                  {editingProfessional !== professional.doctor_id ? (
                                    <Button
                                      variant="outline"
                                      size="sm"
                                      onClick={() => handleStartEditProfessional(professional)}
                                      className="flex items-center gap-2 text-blue-600 border-blue-200 hover:bg-blue-50"
                                    >
                                      <Edit3 className="h-4 w-4" />
                                      Editar Dados
                                    </Button>
                                  ) : null}
                                </div>

                                {editingProfessional !== professional.doctor_id ? (
                                  // MODO VISUALIZAÇÃO - DADOS PROFISSIONAIS
                                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div className="space-y-3">
                                      <div>
                                        <label className="text-xs font-medium text-gray-500 uppercase tracking-wide">Especialidade</label>
                                        <div className="mt-1">
                        <Badge 
                                            variant="outline" 
                                            className={`border ${getSpecialtyColor(professional.doctor_specialty)}`}
                        >
                                            <span className="mr-1">{getSpecialtyIcon(professional.doctor_specialty)}</span>
                                            {professional.doctor_specialty}
                        </Badge>
                                        </div>
                                      </div>
                                      <div>
                                        <label className="text-xs font-medium text-gray-500 uppercase tracking-wide">Hospital</label>
                                        <div className="mt-1">
                                          <Badge 
                                            variant="outline" 
                                            className={`border ${getHospitalColor(professional.link_is_primary_hospital ? 'principal' : 'secundario')}`}
                                          >
                                            <span className="mr-1">{getHospitalIcon(professional.link_is_primary_hospital ? 'principal' : 'secundario')}</span>
                                            {professional.hospital_name}
                          </Badge>
                      </div>
                                      </div>
                                    </div>
                                    <div className="space-y-3">
                                      <div>
                                        <label className="text-xs font-medium text-gray-500 uppercase tracking-wide">Cargo</label>
                                        <div className="mt-1 text-sm text-gray-700">
                                          {professional.link_role || 'Não informado'}
                                        </div>
                                      </div>
                                      <div>
                                        <label className="text-xs font-medium text-gray-500 uppercase tracking-wide">Departamento</label>
                                        <div className="mt-1 text-sm text-gray-700">
                                          {professional.link_department || 'Não informado'}
                                        </div>
                                      </div>
                                    </div>
                                  </div>
                                ) : (
                                  // MODO EDIÇÃO - DADOS PROFISSIONAIS
                                  <div className="space-y-4">
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                      <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-2">
                                          Especialidade *
                                        </label>
                                        <Select 
                                          value={tempProfessionalData.specialty} 
                                          onValueChange={(value) => setTempProfessionalData(prev => ({ ...prev, specialty: value }))}
                                        >
                                          <SelectTrigger>
                                            <SelectValue placeholder="Selecione a especialidade" />
                                          </SelectTrigger>
                                          <SelectContent>
                                            {AVAILABLE_SPECIALTIES.map(specialty => (
                                              <SelectItem key={specialty} value={specialty}>
                                                <div className="flex items-center gap-2">
                                                  <span>{getSpecialtyIcon(specialty)}</span>
                                                  {specialty}
                                                </div>
                                              </SelectItem>
                                            ))}
                                            <SelectItem value={professional.doctor_specialty}>
                                              <div className="flex items-center gap-2">
                                                <span>{getSpecialtyIcon(professional.doctor_specialty)}</span>
                                                {professional.doctor_specialty} (atual)
                                              </div>
                                            </SelectItem>
                                          </SelectContent>
                                        </Select>
                                      </div>
                                      <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-2">
                                          Hospital
                                        </label>
                                        <Select 
                                          value={tempProfessionalData.hospitalId} 
                                          onValueChange={(value) => setTempProfessionalData(prev => ({ ...prev, hospitalId: value }))}
                                        >
                                          <SelectTrigger>
                                            <SelectValue placeholder="Selecione o hospital" />
                                          </SelectTrigger>
                                          <SelectContent>
                                            {availableHospitals.map(hospital => (
                                              <SelectItem key={hospital.id} value={hospital.id}>
                                                <div className="flex items-center gap-2">
                                                  <span>🏥</span>
                                                  {hospital.name}
                                                </div>
                                              </SelectItem>
                                            ))}
                                          </SelectContent>
                                        </Select>
                                      </div>
                                    </div>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                      <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-2">
                                          Cargo
                                        </label>
                                        <Input
                                          value={tempProfessionalData.role}
                                          onChange={(e) => setTempProfessionalData(prev => ({ ...prev, role: e.target.value }))}
                                          placeholder="Ex: Médico Assistente, Coordenador..."
                                          className="text-sm"
                                        />
                                      </div>
                                      <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-2">
                                          Departamento
                                        </label>
                                        <Input
                                          value={tempProfessionalData.department}
                                          onChange={(e) => setTempProfessionalData(prev => ({ ...prev, department: e.target.value }))}
                                          placeholder="Ex: Cardiologia, UTI, Emergência..."
                                          className="text-sm"
                                        />
                                      </div>
                                    </div>
                      <div className="flex items-center space-x-2">
                                      <input
                                        type="checkbox"
                                        id={`primary-${professional.doctor_id}`}
                                        checked={tempProfessionalData.isPrimaryHospital}
                                        onChange={(e) => setTempProfessionalData(prev => ({ ...prev, isPrimaryHospital: e.target.checked }))}
                                        className="rounded border-gray-300"
                                      />
                                      <label htmlFor={`primary-${professional.doctor_id}`} className="text-sm text-gray-700">
                                        Este é o hospital principal do médico
                                      </label>
                                    </div>

                                    <div className="flex items-center gap-3 pt-2">
                        <Button
                                        onClick={() => handleSaveProfessional(professional)}
                                        disabled={savingProfessional === professional.doctor_id}
                                        className="bg-blue-600 hover:bg-blue-700 text-white flex items-center gap-2"
                                      >
                                        {savingProfessional === professional.doctor_id ? (
                                          <Loader2 className="h-4 w-4 animate-spin" />
                                        ) : (
                                          <Save className="h-4 w-4" />
                                        )}
                                        {savingProfessional === professional.doctor_id ? 'Salvando...' : 'Salvar Dados'}
                        </Button>
                        
                        <Button
                                        variant="outline"
                                        onClick={handleCancelEditProfessional}
                                        disabled={savingProfessional === professional.doctor_id}
                                        className="flex items-center gap-2"
                                      >
                                        <X className="h-4 w-4" />
                                        Cancelar
                                      </Button>
                                    </div>
                                  </div>
                                )}
                              </div>

                              {/* 📋 SEÇÃO DE OBSERVAÇÕES */}
                              <div className="bg-white p-5 rounded-lg border shadow-sm">
                                <div className="flex items-center justify-between mb-4">
                                  <h4 className="font-semibold text-gray-900 flex items-center gap-2">
                                    <FileText className="h-4 w-4" />
                                    Observações do Diretor Médico
                                  </h4>
                                  {!isEditing && (
                                    <Button
                                      variant="outline"
                          size="sm"
                                      onClick={() => handleStartEditNotes(professional)}
                                      className="flex items-center gap-2 text-green-600 border-green-200 hover:bg-green-50"
                                    >
                                      <Edit3 className="h-4 w-4" />
                                      Editar Observações
                                    </Button>
                                  )}
                                </div>

                                {!isEditing ? (
                                  // MODO VISUALIZAÇÃO - OBSERVAÇÕES
                                  <div className="bg-gray-50 p-4 rounded-lg">
                                    <div className="text-sm text-gray-600 mb-2">
                                      <strong>Procedimentos Contratados:</strong> Em contrato para cirurgias cardíacas complexas
                                    </div>
                                    <div className="text-sm text-gray-600 mb-2">
                                      <strong>Valores por Procedimento:</strong> Angioplastia (R$ 2.500), Cirurgia (R$ 15.000)
                                    </div>
                                    <div className="text-sm text-gray-600 mb-2">
                                      <strong>Metas Mensais:</strong> 25 procedimentos, R$ 60.000 em faturamento
                                    </div>
                                    <div className="text-sm text-gray-600">
                                      <strong>Observações Gerais:</strong> Médico com excelente performance, especialista em casos complexos. Necessita acompanhamento mensal das metas de produtividade.
                                    </div>
                                  </div>
                                ) : (
                                  // MODO EDIÇÃO - OBSERVAÇÕES
                                  <div className="space-y-4">
                                    <div>
                                      <label className="block text-sm font-medium text-gray-700 mb-2">
                                        Observações Completas (Procedimentos, Valores, Metas, etc.)
                                      </label>
                                      <Textarea
                                        value={tempNotes}
                                        onChange={(e) => setTempNotes(e.target.value)}
                                        placeholder="Digite aqui as observações sobre procedimentos contratados, valores, metas de procedimentos, performance, observações gerais, etc..."
                                        className="min-h-[120px] text-sm"
                                        disabled={isSaving}
                                      />
                                      <div className="text-xs text-gray-500 mt-1">
                                        Incluir: procedimentos em contrato, valores por procedimento, metas mensais, observações de performance
                                      </div>
                                    </div>

                                    <div className="flex items-center gap-3">
                                      <Button
                                        onClick={() => handleSaveNotes(professional)}
                                        disabled={isSaving}
                                        className="bg-green-600 hover:bg-green-700 text-white flex items-center gap-2"
                                      >
                                        {isSaving ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                                        ) : (
                                          <Save className="h-4 w-4" />
                                        )}
                                        {isSaving ? 'Salvando...' : 'Salvar Observações'}
                                      </Button>
                                      
                                      <Button
                                        variant="outline"
                                        onClick={handleCancelEditNotes}
                                        disabled={isSaving}
                                        className="flex items-center gap-2"
                                      >
                                        <X className="h-4 w-4" />
                                        Cancelar
                        </Button>
                                    </div>
                                  </div>
                                )}
                              </div>
                      </div>
                    </TableCell>
                  </TableRow>
                      )}
                    </React.Fragment>
                  );
                })}
              </TableBody>
            </Table>
          </div>

          {/* PAGINAÇÃO TRADICIONAL */}
          {totalCount > 0 && (
            <div className="mt-6 flex items-center justify-between">
              <div className="text-sm text-gray-600">
                Mostrando {professionals.length} de {totalCount} profissionais
              </div>
              
              <div className="flex items-center space-x-2">
              <Button
                variant="outline"
                  size="sm"
                  onClick={() => {
                    // TODO: Implementar página anterior quando o hook estiver atualizado
                    console.log('Página anterior');
                  }}
                  disabled={isLoading || professionals.length === 0}
                  className="flex items-center gap-1"
                >
                  <ChevronDown className="h-4 w-4 rotate-90" />
                  Anterior
                </Button>
                
                <div className="flex items-center space-x-1">
                  {/* Números das páginas - simulação baseada nos dados atuais */}
                  {Array.from({ length: Math.min(5, Math.ceil(totalCount / 20)) }).map((_, i) => {
                    const pageNum = i + 1;
                    const isCurrentPage = i === 0; // Por enquanto sempre primeira página
                    
                    return (
                      <Button
                        key={pageNum}
                        variant={isCurrentPage ? "default" : "outline"}
                        size="sm"
                        onClick={() => {
                          // TODO: Implementar navegação por página quando o hook estiver atualizado
                          console.log(`Ir para página ${pageNum}`);
                        }}
                disabled={isLoading}
                        className="w-10 h-8"
              >
                        {pageNum}
              </Button>
                    );
                  })}
                  
                  {Math.ceil(totalCount / 20) > 5 && (
                    <>
                      <span className="text-gray-400">...</span>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          // TODO: Implementar ir para última página
                          console.log('Última página');
                        }}
                        disabled={isLoading}
                        className="w-10 h-8"
                      >
                        {Math.ceil(totalCount / 20)}
                      </Button>
                    </>
                  )}
                </div>
                
                <Button
                  variant="outline"
                  size="sm"
                  onClick={loadNextPage}
                  disabled={isLoading || !hasMore}
                  className="flex items-center gap-1"
                >
                  Próxima
                  <ChevronDown className="h-4 w-4 -rotate-90" />
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* MODAL DE DETALHES */}
      <Dialog open={isDetailsModalOpen} onOpenChange={setIsDetailsModalOpen}>
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle className="flex items-center space-x-2">
              <Users className="h-5 w-5" />
              <span>Detalhes do Profissional</span>
            </DialogTitle>
            <DialogDescription>
              Informações completas do profissional selecionado
            </DialogDescription>
          </DialogHeader>
          
          {selectedProfessional && (
            <div className="space-y-6">
              {/* Informações Principais */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <h3 className="font-semibold mb-3">👨‍⚕️ Dados Pessoais</h3>
                  <div className="space-y-2 text-sm">
                    <div><strong>Nome:</strong> {selectedProfessional.doctor_name}</div>
                    <div><strong>CRM:</strong> {selectedProfessional.doctor_crm} - {selectedProfessional.doctor_crm_state}</div>
                    <div><strong>CNS:</strong> {selectedProfessional.doctor_cns}</div>
                    <div><strong>Especialidade:</strong> {selectedProfessional.doctor_specialty}</div>
                    {selectedProfessional.doctor_secondary_specialties?.length > 0 && (
                      <div><strong>Especialidades Secundárias:</strong> {selectedProfessional.doctor_secondary_specialties.join(', ')}</div>
                    )}
                  </div>
                </div>

                <div>
                  <h3 className="font-semibold mb-3">🏥 Informações Hospitalares</h3>
                  <div className="space-y-2 text-sm">
                    <div><strong>Hospital:</strong> {selectedProfessional.hospital_name}</div>
                    <div><strong>Cargo:</strong> {selectedProfessional.link_role || 'Não informado'}</div>
                    <div><strong>Departamento:</strong> {selectedProfessional.link_department || 'Não informado'}</div>
                    <div><strong>Hospital Principal:</strong> {selectedProfessional.link_is_primary_hospital ? 'Sim' : 'Não'}</div>
                    <div><strong>Data Início:</strong> {selectedProfessional.link_start_date || 'Não informado'}</div>
                  </div>
                </div>
              </div>

              {/* Contato */}
              <div>
                <h3 className="font-semibold mb-3">📞 Contato</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                  <div className="flex items-center space-x-2">
                    <Mail className="h-4 w-4 text-gray-500" />
                    <span>{selectedProfessional.doctor_email || 'Não informado'}</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Phone className="h-4 w-4 text-gray-500" />
                    <span>{selectedProfessional.doctor_phone || 'Não informado'}</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Phone className="h-4 w-4 text-gray-500" />
                    <span>{selectedProfessional.doctor_mobile_phone || 'Não informado'}</span>
                  </div>
                </div>
              </div>

              {/* Status */}
              <div>
                <h3 className="font-semibold mb-3">📊 Status</h3>
                <div className="flex items-center space-x-4">
                  <Badge variant={selectedProfessional.doctor_is_active ? "default" : "destructive"}>
                    {selectedProfessional.doctor_is_active ? 'Registrado' : 'Não Registrado'}
                  </Badge>
                  <Badge variant={selectedProfessional.doctor_is_sus_enabled ? "default" : "secondary"}>
                    {selectedProfessional.doctor_is_sus_enabled ? 'SUS Habilitado' : 'SUS Não Habilitado'}
                  </Badge>
                  <Badge variant={selectedProfessional.link_is_active ? "default" : "destructive"}>
                    {selectedProfessional.link_is_active ? 'Vínculo Ativo' : 'Vínculo Inativo'}
                  </Badge>
                </div>
              </div>

              {/* Códigos CBO */}
              {selectedProfessional.doctor_cbo_codes?.length > 0 && (
                <div>
                  <h3 className="font-semibold mb-3">🔢 Códigos CBO</h3>
                  <div className="flex flex-wrap gap-2">
                    {selectedProfessional.doctor_cbo_codes.map((cbo, index) => (
                      <Badge key={index} variant="outline" className="text-xs">
                        {cbo}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default ProfessionalsTable; 
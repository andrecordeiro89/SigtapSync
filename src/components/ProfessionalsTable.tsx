import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Input } from './ui/input';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from './ui/table';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from './ui/dialog';
import { 
  Search, 
  Filter, 
  ChevronDown, 
  ChevronUp, 
  Eye, 
  MapPin, 
  Phone, 
  Mail, 
  Calendar, 
  Users, 
  Building2, 
  Stethoscope, 
  Check, 
  X,
  Loader2,
  RefreshCw,
  Download,
  SortAsc,
  SortDesc
} from 'lucide-react';
import { useProfessionalViews } from '../hooks/useProfessionalViews';
import { 
  DoctorHospitalInfo, 
  ProfessionalsFilters, 
  ProfessionalDetails 
} from '../types';

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
      Status: prof.doctor_is_active ? 'Ativo' : 'Inativo',
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
    <div className={`space-y-4 ${className}`}>
      {/* HEADER COM ESTATÍSTICAS */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              <Users className="h-5 w-5 text-blue-600" />
              <div>
                <div className="text-2xl font-bold text-blue-600">{totalCount}</div>
                <div className="text-sm text-gray-600">Total Profissionais</div>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              <Building2 className="h-5 w-5 text-green-600" />
              <div>
                <div className="text-2xl font-bold text-green-600">{availableHospitals.length}</div>
                <div className="text-sm text-gray-600">Hospitais</div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              <Stethoscope className="h-5 w-5 text-purple-600" />
              <div>
                <div className="text-2xl font-bold text-purple-600">{availableSpecialties.length}</div>
                <div className="text-sm text-gray-600">Especialidades</div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              <Check className="h-5 w-5 text-orange-600" />
              <div>
                <div className="text-2xl font-bold text-orange-600">
                  {professionals.filter(p => p.doctor_is_active).length}
                </div>
                <div className="text-sm text-gray-600">Ativos</div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* FILTROS PRINCIPAIS */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <Filter className="h-5 w-5" />
              <span>Filtros</span>
            </div>
            <div className="flex items-center space-x-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowAdvancedFilters(!showAdvancedFilters)}
              >
                {showAdvancedFilters ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                Avançado
              </Button>
              <Button variant="outline" size="sm" onClick={handleClearFilters}>
                Limpar
              </Button>
              <Button variant="outline" size="sm" onClick={handleRefresh}>
                <RefreshCw className="h-4 w-4" />
              </Button>
              <Button variant="outline" size="sm" onClick={handleExport}>
                <Download className="h-4 w-4" />
              </Button>
            </div>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Busca */}
            <div className="relative">
              <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
              <Input
                placeholder="Buscar por nome, CRM, CNS..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>

            {/* Hospital */}
            <Select value={selectedHospital} onValueChange={setSelectedHospital}>
              <SelectTrigger>
                <SelectValue placeholder="Filtrar por Hospital" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os Hospitais</SelectItem>
                {availableHospitals.map(hospital => (
                  <SelectItem key={hospital.id} value={hospital.id}>
                    {hospital.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* Especialidade */}
            <Select value={selectedSpecialty} onValueChange={setSelectedSpecialty}>
              <SelectTrigger>
                <SelectValue placeholder="Filtrar por Especialidade" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas as Especialidades</SelectItem>
                {availableSpecialties.map(specialty => (
                  <SelectItem key={specialty} value={specialty}>
                    {specialty}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* FILTROS AVANÇADOS */}
          {showAdvancedFilters && (
            <div className="mt-4 pt-4 border-t">
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                {/* Status */}
                <Select value={selectedStatus} onValueChange={setSelectedStatus}>
                  <SelectTrigger>
                    <SelectValue placeholder="Status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos os Status</SelectItem>
                    <SelectItem value="active">Apenas Ativos</SelectItem>
                    <SelectItem value="inactive">Apenas Inativos</SelectItem>
                    <SelectItem value="sus_enabled">SUS Habilitado</SelectItem>
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
            <div className="text-red-600 text-sm mb-4 p-3 bg-red-50 rounded-lg">
              ❌ {error}
            </div>
          )}

          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead 
                    className="cursor-pointer hover:bg-gray-100"
                    onClick={() => handleSort('name')}
                  >
                    <div className="flex items-center">
                      Nome {getSortIcon('name')}
                    </div>
                  </TableHead>
                  <TableHead>CRM/CNS</TableHead>
                  <TableHead 
                    className="cursor-pointer hover:bg-gray-100"
                    onClick={() => handleSort('specialty')}
                  >
                    <div className="flex items-center">
                      Especialidade {getSortIcon('specialty')}
                    </div>
                  </TableHead>
                  <TableHead 
                    className="cursor-pointer hover:bg-gray-100"
                    onClick={() => handleSort('hospital')}
                  >
                    <div className="flex items-center">
                      Hospital {getSortIcon('hospital')}
                    </div>
                  </TableHead>
                  <TableHead>Cargo/Depto</TableHead>
                  <TableHead 
                    className="cursor-pointer hover:bg-gray-100"
                    onClick={() => handleSort('status')}
                  >
                    <div className="flex items-center">
                      Status {getSortIcon('status')}
                    </div>
                  </TableHead>
                  <TableHead>Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {professionals.map((professional) => (
                  <TableRow key={professional.doctor_id} className="hover:bg-gray-50">
                    <TableCell>
                      <div>
                        <div className="font-medium">{professional.doctor_name}</div>
                        {professional.doctor_email && (
                          <div className="text-sm text-gray-600">{professional.doctor_email}</div>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="text-sm">
                        <div>CRM: {professional.doctor_crm}</div>
                        <div className="text-gray-600">CNS: {professional.doctor_cns}</div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="text-xs">
                        {professional.doctor_specialty}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="text-sm">
                        <div className="font-medium">{professional.hospital_name}</div>
                        {professional.link_is_primary_hospital && (
                          <Badge variant="secondary" className="text-xs mt-1">
                            Principal
                          </Badge>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="text-sm">
                        {professional.link_role && (
                          <div>{professional.link_role}</div>
                        )}
                        {professional.link_department && (
                          <div className="text-gray-600">{professional.link_department}</div>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center space-x-2">
                        <Badge 
                          variant={professional.doctor_is_active ? "default" : "destructive"}
                          className="text-xs"
                        >
                          {professional.doctor_is_active ? 'Ativo' : 'Inativo'}
                        </Badge>
                        {professional.doctor_is_sus_enabled && (
                          <Badge variant="secondary" className="text-xs">
                            SUS
                          </Badge>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleViewDetails(professional)}
                      >
                        <Eye className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          {/* PAGINAÇÃO */}
          {hasMore && (
            <div className="mt-4 text-center">
              <Button
                variant="outline"
                onClick={loadNextPage}
                disabled={isLoading}
              >
                {isLoading ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                ) : null}
                Carregar Mais
              </Button>
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
                    {selectedProfessional.doctor_is_active ? 'Ativo' : 'Inativo'}
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
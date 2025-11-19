/**
 * ================================================================
 * TABELA DE PROFISSIONAIS COM FATURAMENTO - NOVA VERSÃO
 * ================================================================
 * Criado em: 2024-12-19
 * Propósito: Exibir médicos agregados sem duplicação + faturamento real
 * Funcionalidade: 1 linha por médico + múltiplos hospitais + edição de especialidade
 * ================================================================
 */

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
import { Label } from './ui/label';
import { 
  Search, 
  Filter, 
  ChevronDown, 
  ChevronUp, 
  ChevronRight,
  ChevronLeft,
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
  FileText,
  DollarSign,
  TrendingUp,
  Activity,
  CheckCircle,
  CircleDot,
  ClockIcon,
  Award,
  Banknote,
  BarChart3
} from 'lucide-react';
import { useDoctorsRevenue } from '../hooks/useDoctorsRevenue';
import { useAuth } from '../contexts/AuthContext';
import { toast } from './ui/use-toast';
import { getSpecialtyColor, getSpecialtyIcon, AVAILABLE_SPECIALTIES } from '../utils/specialtyColors';
import { DoctorsRevenueService } from '../services/doctorsRevenueService';

// ================================================================
// TIPOS E INTERFACES
// ================================================================

interface ProfessionalsTableNewProps {
  className?: string;
}

// ================================================================
// COMPONENTE PRINCIPAL
// ================================================================

const ProfessionalsTableNew: React.FC<ProfessionalsTableNewProps> = ({ className = '' }) => {
  const { user } = useAuth();
  
  // Hook principal para dados agregados
  const {
    doctors,
    isLoading,
    error,
    currentPage,
    totalPages,
    totalCount,
    pageSize,
    hasMore,
    hasPrevious,
    appliedFilters,
    availableSpecialties,
    executiveSummary,
    tempFilters,
    setTempFilter,
    applyTempFilters,
    refreshCurrentPage,
    goToPage,
    loadNextPage,
    loadPreviousPage,
    updateDoctorSpecialty,
    resetData,
    clearTempFilters,
    topDoctor,
    activityBreakdown,
    hasData,
    isEmpty,
    isFiltered
  } = useDoctorsRevenue();

  // Estados locais para interface
  const [selectedDoctor, setSelectedDoctor] = useState<any>(null);
  const [isDetailsModalOpen, setIsDetailsModalOpen] = useState(false);
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());
  const [editingSpecialty, setEditingSpecialty] = useState<string | null>(null);
  const [tempSpecialty, setTempSpecialty] = useState('');
  
  // 🚨 Estado para pacientes sem repasse médico (pagamento = 0)
  const [patientsWithoutPaymentMap, setPatientsWithoutPaymentMap] = useState<Map<string, {
    patientsWithoutPayment: number;
    totalPatients: number;
    isLoading: boolean;
    patientsList: Array<{
      patientId: string;
      patientName: string;
      aihNumber: string;
      calculatedPayment: number;
      procedureCodes: string[];
    }>;
  }>>(new Map());

  // Estados para filtros da interface
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);
  const [localSearchTerm, setLocalSearchTerm] = useState(tempFilters.searchTerm || '');

  /**
   * 🔍 APLICAR FILTROS
   */
  const handleApplyFilters = () => {
    applyTempFilters();
  };

  /**
   * 🔄 LIMPAR FILTROS
   */
  const handleClearFilters = () => {
    clearTempFilters();
    setLocalSearchTerm('');
  };

  /**
   * 📊 ALTERNAR ORDENAÇÃO
   */
  const handleSort = (field: string) => {
    const currentSortBy = tempFilters.sortBy || 'total_revenue_12months_reais';
    const currentSortOrder = tempFilters.sortOrder || 'desc';
    
    if (currentSortBy === field) {
      setTempFilter('sortOrder', currentSortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setTempFilter('sortBy', field);
      setTempFilter('sortOrder', 'asc');
    }
  };

  /**
   * ✏️ INICIAR EDIÇÃO DE ESPECIALIDADE
   */
  const handleStartEditSpecialty = (doctor: any) => {
    // Verificar permissões
    if (!user || !['admin', 'diretor'].includes(user.role)) {
      toast({
        variant: "destructive",
        title: "Acesso Negado",
        description: "Apenas administradores podem editar especialidades médicas"
      });
      return;
    }

    setEditingSpecialty(doctor.doctor_id);
    setTempSpecialty(doctor.doctor_specialty || '');
  };

  /**
   * ❌ CANCELAR EDIÇÃO DE ESPECIALIDADE
   */
  const handleCancelEditSpecialty = () => {
    setEditingSpecialty(null);
    setTempSpecialty('');
  };

  /**
   * 💾 SALVAR ESPECIALIDADE
   */
  const handleSaveSpecialty = async (doctorId: string) => {
    try {
      if (!tempSpecialty.trim()) {
        toast({
          variant: "destructive",
          title: "Erro",
          description: "Especialidade não pode estar vazia"
        });
        return;
      }

      await updateDoctorSpecialty(doctorId, tempSpecialty.trim());
      
      setEditingSpecialty(null);
      setTempSpecialty('');

      toast({
        title: "Sucesso",
        description: "Especialidade atualizada com sucesso"
      });

    } catch (error) {
      toast({
        variant: "destructive",
        title: "Erro",
        description: error instanceof Error ? error.message : "Erro ao atualizar especialidade"
      });
    }
  };

  /**
   * 👁️ VISUALIZAR DETALHES DO MÉDICO
   */
  const handleViewDetails = (doctor: any) => {
    setSelectedDoctor(doctor);
    setIsDetailsModalOpen(true);
  };

  /**
   * 🔄 EXPANDIR/RECOLHER LINHA
   */
  const handleToggleRow = async (doctorId: string, doctorCns: string, doctorName: string, hospitalIds?: string) => {
    const newExpandedRows = new Set(expandedRows);
    const isExpanding = !newExpandedRows.has(doctorId);
    
    if (newExpandedRows.has(doctorId)) {
      newExpandedRows.delete(doctorId);
    } else {
      newExpandedRows.add(doctorId);
    }
    setExpandedRows(newExpandedRows);

    // 🚨 Se está expandindo E ainda não carregou contagem de pacientes sem repasse, carregar agora
    if (isExpanding && !patientsWithoutPaymentMap.has(doctorId)) {
      try {
        // Marcar como carregando
        setPatientsWithoutPaymentMap(prev => new Map(prev).set(doctorId, {
          patientsWithoutPayment: 0,
          totalPatients: 0,
          patientsList: [],
          isLoading: true
        }));

        // Extrair primeiro hospital ID da lista
        const firstHospitalId = hospitalIds?.split(',')[0];
        
        // Contar pacientes com pagamento médico = 0
        const paymentCheck = await DoctorsRevenueService.countPatientsWithoutPayment(
          doctorCns,
          doctorName,
          firstHospitalId
        );
        
        // Atualizar estado
        setPatientsWithoutPaymentMap(prev => new Map(prev).set(doctorId, {
          patientsWithoutPayment: paymentCheck.patientsWithoutPayment,
          totalPatients: paymentCheck.totalPatients,
          patientsList: paymentCheck.patientsWithoutPaymentList,
          isLoading: false
        }));

        if (paymentCheck.patientsWithoutPayment > 0) {
          console.log(`⚠️ ${doctorName}: ${paymentCheck.patientsWithoutPayment} pacientes SEM repasse (de ${paymentCheck.totalPatients} pacientes)`);
        } else {
          console.log(`✅ ${doctorName}: Todos os ${paymentCheck.totalPatients} pacientes têm repasse médico definido`);
        }

      } catch (error) {
        console.error('❌ Erro ao verificar pacientes sem repasse:', error);
        setPatientsWithoutPaymentMap(prev => new Map(prev).set(doctorId, {
          patientsWithoutPayment: 0,
          totalPatients: 0,
          patientsList: [],
          isLoading: false
        }));
      }
    }
  };

  /**
   * 📊 ÍCONE DE ORDENAÇÃO
   */
  const getSortIcon = (field: string) => {
    if (tempFilters.sortBy !== field) return null;
    return tempFilters.sortOrder === 'asc' ? <SortAsc className="h-4 w-4" /> : <SortDesc className="h-4 w-4" />;
  };

  /**
   * 💰 FORMATAR VALOR MONETÁRIO
   */
  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(value);
  };

  /**
   * 📅 FORMATAR DATA
   */
  const formatDate = (dateString: string) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleDateString('pt-BR');
  };

  /**
   * 🎨 OBTER BADGE DE STATUS DE ATIVIDADE
   */
  const getActivityBadge = (status: string) => {
    switch (status) {
      case 'ATIVO':
        return <Badge variant="default" className="bg-green-500"><CheckCircle className="h-3 w-3 mr-1" />Ativo</Badge>;
      case 'POUCO_ATIVO':
        return <Badge variant="secondary"><CircleDot className="h-3 w-3 mr-1" />Pouco Ativo</Badge>;
      case 'INATIVO':
        return <Badge variant="destructive"><AlertCircle className="h-3 w-3 mr-1" />Inativo</Badge>;
      default:
        return <Badge variant="outline">Desconhecido</Badge>;
    }
  };

  /**
   * 🏥 RENDERIZAR LISTA DE HOSPITAIS
   */
  const renderHospitalsList = (hospitalsList: string, hospitalsCount: number) => {
    if (!hospitalsList) return <span className="text-gray-400">Nenhum hospital</span>;

    const hospitals = hospitalsList.split(' | ');
    
    if (hospitals.length === 1) {
      return <span className="font-medium">{hospitals[0]}</span>;
    }

    return (
      <div className="space-y-1">
        <div className="flex items-center gap-2">
          <Building2 className="h-4 w-4 text-blue-500" />
          <span className="text-sm font-medium">{hospitalsCount} hospitais</span>
        </div>
        <div className="text-xs text-gray-600">
          {hospitals.map((hospital, index) => (
            <div key={index} className="truncate">{hospital}</div>
          ))}
        </div>
      </div>
    );
  };

  // Atualizar filtro de busca local
  useEffect(() => {
    const timer = setTimeout(() => {
      setTempFilter('searchTerm', localSearchTerm);
    }, 300);

    return () => clearTimeout(timer);
  }, [localSearchTerm, setTempFilter]);

  // Aplicar filtros automaticamente quando mudarem
  useEffect(() => {
    handleApplyFilters();
  }, [tempFilters.periodType, tempFilters.hospitalId, tempFilters.specialty, tempFilters.activityStatus]);

  return (
    <div className={`space-y-6 ${className}`}>
      {/* ================================================================ */}
      {/* CABEÇALHO COM ESTATÍSTICAS */}
      {/* ================================================================ */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Total de Médicos</p>
                <p className="text-2xl font-bold">{totalCount}</p>
              </div>
              <Users className="h-8 w-8 text-blue-500" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Médicos Ativos</p>
                <p className="text-2xl font-bold text-green-600">{activityBreakdown.active}</p>
              </div>
              <UserCheck className="h-8 w-8 text-green-500" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Faturamento Total</p>
                <p className="text-2xl font-bold text-green-600">
                  {executiveSummary ? formatCurrency(executiveSummary.totalRevenue) : 'R$ 0,00'}
                </p>
              </div>
              <DollarSign className="h-8 w-8 text-green-500" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Média por Médico</p>
                <p className="text-2xl font-bold text-blue-600">
                  {executiveSummary ? formatCurrency(executiveSummary.avgRevenuePerDoctor) : 'R$ 0,00'}
                </p>
              </div>
              <TrendingUp className="h-8 w-8 text-blue-500" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* ================================================================ */}
      {/* FILTROS */}
      {/* ================================================================ */}
      <Card>
        <CardHeader className="pb-4">
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Filter className="h-5 w-5" />
              Filtros Avançados
            </CardTitle>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowAdvancedFilters(!showAdvancedFilters)}
            >
              {showAdvancedFilters ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            </Button>
          </div>
        </CardHeader>

        <CardContent className="space-y-4">
          {/* Linha 1: Busca e Período */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label>Buscar médico</Label>
              <div className="relative">
                <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                <Input
                  placeholder="Nome, CRM, CNS ou especialidade..."
                  value={localSearchTerm}
                  onChange={(e) => setLocalSearchTerm(e.target.value)}
                  className="pl-9"
                />
              </div>
            </div>

            <div>
              <Label>Período de Faturamento</Label>
              <Select 
                value={tempFilters.periodType || 'last_12_months'} 
                onValueChange={(value) => setTempFilter('periodType', value as any)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="last_30_days">Últimos 30 dias</SelectItem>
                  <SelectItem value="last_3_months">Últimos 3 meses</SelectItem>
                  <SelectItem value="last_6_months">Últimos 6 meses</SelectItem>
                  <SelectItem value="last_12_months">Últimos 12 meses</SelectItem>
                  <SelectItem value="year">Por ano</SelectItem>
                  <SelectItem value="month">Por mês</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Filtros Avançados */}
          {showAdvancedFilters && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-4 border-t">
              <div>
                <Label>Especialidade</Label>
                <Select 
                  value={tempFilters.specialty || 'all'} 
                  onValueChange={(value) => setTempFilter('specialty', value)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Todas as especialidades" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todas as especialidades</SelectItem>
                    {availableSpecialties.map((specialty) => (
                      <SelectItem key={specialty} value={specialty}>
                        {specialty}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label>Status de Atividade</Label>
                <Select 
                  value={tempFilters.activityStatus || 'all'} 
                  onValueChange={(value) => setTempFilter('activityStatus', value as any)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Todos os status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos os status</SelectItem>
                    <SelectItem value="ATIVO">Ativos</SelectItem>
                    <SelectItem value="POUCO_ATIVO">Pouco Ativos</SelectItem>
                    <SelectItem value="INATIVO">Inativos</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="flex items-end gap-2">
                <Button onClick={handleApplyFilters} className="flex-1">
                  <Search className="h-4 w-4 mr-2" />
                  Aplicar Filtros
                </Button>
                <Button variant="outline" onClick={handleClearFilters}>
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ================================================================ */}
      {/* TABELA DE MÉDICOS */}
      {/* ================================================================ */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Stethoscope className="h-5 w-5" />
              Lista de Profissionais ({totalCount} médicos)
            </CardTitle>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={refreshCurrentPage}>
                <RefreshCw className="h-4 w-4 mr-2" />
                Atualizar
              </Button>
            </div>
          </div>
        </CardHeader>

        <CardContent>
          {/* Indicador de Loading */}
          {isLoading && (
            <div className="space-y-4">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="flex items-center space-x-4">
                  <Skeleton className="h-12 w-12 rounded-full" />
                  <div className="space-y-2 flex-1">
                    <Skeleton className="h-4 w-1/3" />
                    <Skeleton className="h-4 w-1/2" />
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Indicador de Erro */}
          {error && (
            <div className="text-center py-8">
              <AlertCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
              <h3 className="text-lg font-semibold mb-2">Erro ao carregar dados</h3>
              <p className="text-gray-600 mb-4">{error}</p>
              <Button onClick={refreshCurrentPage}>
                <RefreshCw className="h-4 w-4 mr-2" />
                Tentar Novamente
              </Button>
            </div>
          )}

          {/* Estado Vazio */}
          {isEmpty && !isLoading && (
            <div className="text-center py-12">
              <Users className="h-16 w-16 text-gray-300 mx-auto mb-4" />
              <h3 className="text-lg font-semibold mb-2">
                {isFiltered ? 'Nenhum médico encontrado' : 'Nenhum médico cadastrado'}
              </h3>
              <p className="text-gray-600 mb-4">
                {isFiltered 
                  ? 'Tente ajustar os filtros para encontrar médicos'
                  : 'Ainda não há médicos cadastrados no sistema'
                }
              </p>
              {isFiltered && (
                <Button variant="outline" onClick={handleClearFilters}>
                  <X className="h-4 w-4 mr-2" />
                  Limpar Filtros
                </Button>
              )}
            </div>
          )}

          {/* Tabela com Dados */}
          {hasData && !isLoading && (
            <div className="space-y-4">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-8"></TableHead>
                    <TableHead 
                      className="cursor-pointer hover:bg-gray-50"
                      onClick={() => handleSort('doctor_name')}
                    >
                      <div className="flex items-center gap-2">
                        Médico
                        {getSortIcon('doctor_name')}
                      </div>
                    </TableHead>
                    <TableHead>CNS</TableHead>
                    <TableHead 
                      className="cursor-pointer hover:bg-gray-50"
                      onClick={() => handleSort('doctor_specialty')}
                    >
                      <div className="flex items-center gap-2">
                        Especialidade
                        {getSortIcon('doctor_specialty')}
                      </div>
                    </TableHead>
                    <TableHead>Hospitais</TableHead>
                    <TableHead 
                      className="cursor-pointer hover:bg-gray-50"
                      onClick={() => handleSort('total_revenue_12months_reais')}
                    >
                      <div className="flex items-center gap-2">
                        Faturamento (12 meses)
                        {getSortIcon('total_revenue_12months_reais')}
                      </div>
                    </TableHead>
                    <TableHead>Procedimentos</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="w-24">Ações</TableHead>
                  </TableRow>
                </TableHeader>

                <TableBody>
                  {doctors.map((doctor) => (
                    <React.Fragment key={doctor.doctor_id}>
                      <TableRow className="hover:bg-gray-50">
                        {/* Botão Expandir */}
                        <TableCell>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleToggleRow(
                              doctor.doctor_id, 
                              doctor.doctor_cns, 
                              doctor.doctor_name,
                              doctor.hospital_ids
                            )}
                          >
                            {expandedRows.has(doctor.doctor_id) 
                              ? <ChevronUp className="h-4 w-4" />
                              : <ChevronDown className="h-4 w-4" />
                            }
                          </Button>
                        </TableCell>

                        {/* Nome do Médico */}
                        <TableCell>
                          <div className="space-y-1">
                            <div className="flex items-center gap-2">
                              <div className="font-medium">{doctor.doctor_name}</div>
                              {/* 🚨 Badge de Alerta para Pacientes Sem Repasse Médico */}
                              {patientsWithoutPaymentMap.get(doctor.doctor_id)?.patientsWithoutPayment > 0 && (
                                <Badge variant="destructive" className="text-xs">
                                  <AlertCircle className="h-3 w-3 mr-1" />
                                  {patientsWithoutPaymentMap.get(doctor.doctor_id)?.patientsWithoutPayment} sem repasse
                                </Badge>
                              )}
                              {/* ✅ Badge de Sucesso quando todos têm repasse */}
                              {patientsWithoutPaymentMap.get(doctor.doctor_id)?.patientsWithoutPayment === 0 && 
                               patientsWithoutPaymentMap.get(doctor.doctor_id)?.totalPatients > 0 && (
                                <Badge variant="default" className="text-xs bg-green-100 text-green-800">
                                  <CheckCircle className="h-3 w-3 mr-1" />
                                  0 sem repasse
                                </Badge>
                              )}
                            </div>
                            <div className="text-sm text-gray-600">
                              CRM: {doctor.doctor_crm}
                            </div>
                          </div>
                        </TableCell>

                        {/* CNS */}
                        <TableCell>
                          <span className="font-mono text-sm">{doctor.doctor_cns}</span>
                        </TableCell>

                        {/* Especialidade (Editável) */}
                        <TableCell>
                          {editingSpecialty === doctor.doctor_id ? (
                            <div className="flex items-center gap-2">
                              <Select value={tempSpecialty} onValueChange={setTempSpecialty}>
                                <SelectTrigger className="h-8 text-xs">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  {AVAILABLE_SPECIALTIES.map((specialty) => (
                                    <SelectItem key={specialty} value={specialty}>
                                      <div className="flex items-center gap-2">
                                        {getSpecialtyIcon(specialty)}
                                        {specialty}
                                      </div>
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                              <Button 
                                size="sm" 
                                onClick={() => handleSaveSpecialty(doctor.doctor_id)}
                                disabled={isLoading}
                              >
                                <Save className="h-3 w-3" />
                              </Button>
                              <Button 
                                size="sm" 
                                variant="outline"
                                onClick={handleCancelEditSpecialty}
                              >
                                <X className="h-3 w-3" />
                              </Button>
                            </div>
                          ) : (
                            <div className="flex items-center gap-2">
                              <div 
                                className={`flex items-center gap-2 px-2 py-1 rounded text-sm ${getSpecialtyColor(doctor.doctor_specialty)}`}
                              >
                                {getSpecialtyIcon(doctor.doctor_specialty)}
                                {doctor.doctor_specialty}
                              </div>
                              {user && ['admin', 'diretor'].includes(user.role) && (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => handleStartEditSpecialty(doctor)}
                                >
                                  <Edit3 className="h-3 w-3" />
                                </Button>
                              )}
                            </div>
                          )}
                        </TableCell>

                        {/* Hospitais */}
                        <TableCell>
                          {renderHospitalsList(doctor.hospitals_list, doctor.hospitals_count)}
                        </TableCell>

                        {/* Faturamento */}
                        <TableCell>
                          <div className="space-y-1">
                            <div className="font-bold text-green-600">
                              {formatCurrency(doctor.total_revenue_12months_reais)}
                            </div>
                            <div className="text-xs text-gray-500">
                              Taxa pgto: {doctor.avg_payment_rate_12months.toFixed(1)}%
                            </div>
                          </div>
                        </TableCell>

                        {/* Procedimentos */}
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <BarChart3 className="h-4 w-4 text-blue-500" />
                            <span className="font-medium">{doctor.total_procedures_12months}</span>
                          </div>
                        </TableCell>

                        {/* Status */}
                        <TableCell>
                          {getActivityBadge(doctor.activity_status)}
                        </TableCell>

                        {/* Ações */}
                        <TableCell>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleViewDetails(doctor)}
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>

                      {/* Linha Expandida com Detalhes */}
                      {expandedRows.has(doctor.doctor_id) && (
                        <TableRow>
                          <TableCell colSpan={9} className="bg-gray-50">
                            <div className="p-4 space-y-3">
                              <h4 className="font-semibold text-sm">Informações Detalhadas</h4>
                              
                              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                                <div>
                                  <strong>Contato:</strong>
                                  <div className="space-y-1 mt-1">
                                    {doctor.doctor_email && (
                                      <div className="flex items-center gap-2">
                                        <Mail className="h-3 w-3" />
                                        {doctor.doctor_email}
                                      </div>
                                    )}
                                    {doctor.doctor_phone && (
                                      <div className="flex items-center gap-2">
                                        <Phone className="h-3 w-3" />
                                        {doctor.doctor_phone}
                                      </div>
                                    )}
                                  </div>
                                </div>

                                <div>
                                  <strong>Atividade:</strong>
                                  <div className="space-y-1 mt-1">
                                    <div>Última atividade: {formatDate(doctor.last_activity_date)}</div>
                                    <div>Departamentos: {doctor.departments_list || 'N/A'}</div>
                                  </div>
                                </div>

                                <div>
                                  <strong>Observações:</strong>
                                  <div className="mt-1 text-gray-600">
                                    {doctor.doctor_notes || 'Nenhuma observação'}
                                  </div>
                                </div>
                              </div>

                              {/* 🚨 SEÇÃO DE PACIENTES SEM REPASSE MÉDICO */}
                              {(() => {
                                const paymentData = patientsWithoutPaymentMap.get(doctor.doctor_id);
                                
                                if (paymentData?.isLoading) {
                                  return (
                                    <div className="mt-4 p-3 bg-gray-100 rounded-lg flex items-center gap-2">
                                      <Loader2 className="h-4 w-4 animate-spin" />
                                      <span className="text-sm text-gray-600">Verificando pacientes sem repasse médico...</span>
                                    </div>
                                  );
                                }
                                
                                if (paymentData?.patientsWithoutPayment > 0) {
                                  return (
                                    <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-lg">
                                      <div className="flex items-start gap-2 mb-2">
                                        <AlertCircle className="h-5 w-5 text-red-600 mt-0.5" />
                                        <div className="flex-1">
                                          <h5 className="font-semibold text-red-800 mb-1">
                                            🚨 Pacientes Sem Repasse Médico (Pagamento = R$ 0,00)
                                          </h5>
                                          <p className="text-sm text-red-700 mb-3">
                                            <strong>{paymentData.patientsWithoutPayment}</strong> de <strong>{paymentData.totalPatients}</strong> pacientes 
                                            têm pagamento médico calculado igual a zero. Defina regras para garantir o repasse!
                                          </p>
                                          
                                          <div className="bg-white rounded p-3 max-h-60 overflow-y-auto">
                                            <div className="space-y-3">
                                              {paymentData.patientsList.slice(0, 10).map((patient, idx) => (
                                                <div key={idx} className="border-b pb-2 last:border-0">
                                                  <div className="flex items-center justify-between mb-1">
                                                    <div className="font-medium text-sm">
                                                      {patient.patientName}
                                                    </div>
                                                    <span className="text-xs font-mono text-gray-600">
                                                      AIH: {patient.aihNumber}
                                                    </span>
                                                  </div>
                                                  <div className="text-xs text-gray-600 mb-1">
                                                    Procedimentos realizados:
                                                  </div>
                                                  <div className="flex flex-wrap gap-1">
                                                    {patient.procedureCodes.map((code, cIdx) => (
                                                      <code key={cIdx} className="text-xs bg-red-100 px-1.5 py-0.5 rounded font-mono">
                                                        {code}
                                                      </code>
                                                    ))}
                                                  </div>
                                                </div>
                                              ))}
                                              {paymentData.patientsList.length > 10 && (
                                                <div className="text-xs text-gray-600 text-center pt-2">
                                                  + {paymentData.patientsList.length - 10} pacientes adicionais
                                                </div>
                                              )}
                                            </div>
                                          </div>
                                          
                                          <p className="text-xs text-red-600 mt-2">
                                            💡 Acesse <code>DoctorPaymentRules.tsx</code> e defina regras para esses procedimentos
                                          </p>
                                        </div>
                                      </div>
                                    </div>
                                  );
                                }
                                
                                if (paymentData && paymentData.patientsWithoutPayment === 0 && paymentData.totalPatients > 0) {
                                  return (
                                    <div className="mt-4 p-3 bg-green-50 border border-green-200 rounded-lg flex items-center gap-2">
                                      <CheckCircle className="h-5 w-5 text-green-600" />
                                      <span className="text-sm text-green-700">
                                        ✅ Todos os {paymentData.totalPatients} pacientes possuem repasse médico calculado (≠ R$ 0,00)
                                      </span>
                                    </div>
                                  );
                                }
                                
                                return null;
                              })()}
                            </div>
                          </TableCell>
                        </TableRow>
                      )}
                    </React.Fragment>
                  ))}
                </TableBody>
              </Table>

              {/* ================================================================ */}
              {/* PAGINAÇÃO */}
              {/* ================================================================ */}
              <div className="flex items-center justify-between">
                <div className="text-sm text-gray-600">
                  Mostrando {((currentPage - 1) * pageSize) + 1} a {Math.min(currentPage * pageSize, totalCount)} de {totalCount} médicos
                </div>

                <div className="flex items-center space-x-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={loadPreviousPage}
                    disabled={!hasPrevious || isLoading}
                  >
                    <ChevronLeft className="h-4 w-4" />
                    Anterior
                  </Button>

                  <div className="flex items-center gap-1">
                    {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                      const page = Math.max(1, Math.min(totalPages - 4, currentPage - 2)) + i;
                      return (
                        <Button
                          key={page}
                          variant={page === currentPage ? "default" : "outline"}
                          size="sm"
                          onClick={() => goToPage(page)}
                          disabled={isLoading}
                        >
                          {page}
                        </Button>
                      );
                    })}
                  </div>

                  <Button
                    variant="outline"
                    size="sm"
                    onClick={loadNextPage}
                    disabled={!hasMore || isLoading}
                  >
                    Próxima
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ================================================================ */}
      {/* MODAL DE DETALHES */}
      {/* ================================================================ */}
      <Dialog open={isDetailsModalOpen} onOpenChange={setIsDetailsModalOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <User className="h-5 w-5" />
              Detalhes do Profissional
            </DialogTitle>
            <DialogDescription>
              Informações completas e histórico de faturamento
            </DialogDescription>
          </DialogHeader>

          {selectedDoctor && (
            <div className="space-y-6">
              {/* Informações Básicas */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">Dados Pessoais</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div><strong>Nome:</strong> {selectedDoctor.doctor_name}</div>
                    <div><strong>CNS:</strong> {selectedDoctor.doctor_cns}</div>
                    <div><strong>CRM:</strong> {selectedDoctor.doctor_crm}</div>
                    <div><strong>Especialidade:</strong> {selectedDoctor.doctor_specialty}</div>
                    {selectedDoctor.doctor_email && (
                      <div><strong>Email:</strong> {selectedDoctor.doctor_email}</div>
                    )}
                    {selectedDoctor.doctor_phone && (
                      <div><strong>Telefone:</strong> {selectedDoctor.doctor_phone}</div>
                    )}
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">Faturamento (12 meses)</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div>
                      <strong>Total:</strong> 
                      <span className="text-xl font-bold text-green-600 ml-2">
                        {formatCurrency(selectedDoctor.total_revenue_12months_reais)}
                      </span>
                    </div>
                    <div><strong>Procedimentos:</strong> {selectedDoctor.total_procedures_12months}</div>
                    <div><strong>Taxa de Pagamento:</strong> {selectedDoctor.avg_payment_rate_12months.toFixed(1)}%</div>
                    <div><strong>Status:</strong> {getActivityBadge(selectedDoctor.activity_status)}</div>
                  </CardContent>
                </Card>
              </div>

              {/* Hospitais */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Hospitais Vinculados</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {selectedDoctor.hospitals_list.split(' | ').map((hospital: string, index: number) => (
                      <div key={index} className="flex items-center gap-2">
                        <Building2 className="h-4 w-4 text-blue-500" />
                        <span>{hospital}</span>
                        {index === 0 && selectedDoctor.primary_hospital_name === hospital && (
                          <Badge variant="secondary">Principal</Badge>
                        )}
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              {/* Observações */}
              {selectedDoctor.doctor_notes && (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">Observações</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-gray-700">{selectedDoctor.doctor_notes}</p>
                  </CardContent>
                </Card>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default ProfessionalsTableNew; 
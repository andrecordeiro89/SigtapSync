import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { User, FileText, Clock, CheckCircle, DollarSign, Calendar, RefreshCw, Search, Trash2, Eye, Edit, ChevronDown, ChevronUp, Filter, Download, Settings, AlertTriangle, AlertCircle, RotateCcw, Info, Activity, CreditCard, Stethoscope, FileSpreadsheet, X } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { AIHPersistenceService } from '../services/aihPersistenceService';
import { supabase } from '../lib/supabase';

import AIHExecutiveSummary from './AIHExecutiveSummary';
import ProcedureInlineCard from './ProcedureInlineCard';
import { hasAnyExcludedCodeInProcedures } from '@/config/operaParana';
import { formatCurrency as baseCurrency } from '../utils/validation';
import { useToast } from '@/hooks/use-toast';
import { CareCharacterUtils } from '../config/careCharacterCodes';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { filterCalculableProcedures } from '../utils/anesthetistLogic';
import { sumProceduresBaseReais } from '@/utils/valueHelpers';
import { isLikelyProcedureString, sanitizePatientName } from '@/utils/patientName';
import { PatientService } from '@/services/supabaseService';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';
import PatientAihInfoBadges from './PatientAihInfoBadges';
import AihDatesBadges from './AihDatesBadges';

// Ícone customizado: cruz médica vermelha
const MedicalCrossIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg viewBox="0 0 24 24" className={className} fill="currentColor" aria-hidden="true">
    <rect x="10" y="4" width="4" height="16" rx="1" />
    <rect x="4" y="10" width="16" height="4" rx="1" />
  </svg>
);

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
  care_modality?: string;
  requesting_physician?: string;
  professional_cbo?: string;
  cns_responsavel?: string; // ✅ CNS do médico responsável
  competencia?: string; // ✅ Competência SUS (YYYY-MM-DD)
  hospitals?: { name: string };
  processed_at?: string;
  processed_by_name?: string;
  created_at?: string;
  updated_at?: string;
  patients?: {
    name: string;
    cns: string;
    birth_date?: string;
    gender?: 'M' | 'F' | string;
    medical_record?: string;
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
  const { user, hasFullAccess, canManageProcedures, canAccessAllHospitals } = useAuth();
  const currentHospitalId = user?.hospital_id;
  const { toast } = useToast();
  const persistenceService = new AIHPersistenceService();
  const isDirector = hasFullAccess();

  // Estados principais
  const [patients, setPatients] = useState<Patient[]>([]);
  const [aihs, setAIHs] = useState<AIH[]>([]);
  const [totalAIHsCount, setTotalAIHsCount] = useState<number>(0);
  const [stats, setStats] = useState<HospitalStats | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  
  // Estados de expansão unificados
  const [expandedItems, setExpandedItems] = useState<Set<string>>(new Set());
  
  // ✅ NOVO: Mapa de médicos (CNS -> Nome)
  const [doctorsCache, setDoctorsCache] = useState<Map<string, string>>(new Map());
  
  // Filtros simplificados - APENAS COMPETÊNCIA
  const [globalSearch, setGlobalSearch] = useState('');
  const [selectedCompetencia, setSelectedCompetencia] = useState<string>('all');
  const [availableCompetencias, setAvailableCompetencias] = useState<string[]>([]);
  
  // ✅ NOVO: Filtro de hospital (apenas para administradores)
  const [selectedHospitalFilter, setSelectedHospitalFilter] = useState<string>('all');
  const [availableHospitals, setAvailableHospitals] = useState<Array<{id: string, name: string}>>([]);
  
  // ✅ NOVO: Filtro de médicos (apenas para administradores)
  const [selectedDoctorFilter, setSelectedDoctorFilter] = useState<string>('all');
  const [availableDoctors, setAvailableDoctors] = useState<Array<{cns: string, name: string}>>([]);
  const [doctorSearchTerm, setDoctorSearchTerm] = useState<string>('');

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
  // Estado para edição rápida de nome do paciente
  const [inlineNameEdit, setInlineNameEdit] = useState<{ [patientId: string]: string }>({});
  const [savingName, setSavingName] = useState<{ [patientId: string]: boolean }>({});

  // Estados para edição de competência
  const [editingCompetencia, setEditingCompetencia] = useState<{ [aihId: string]: boolean }>({});
  const [competenciaValue, setCompetenciaValue] = useState<{ [aihId: string]: string }>({});
  const [savingCompetencia, setSavingCompetencia] = useState<{ [aihId: string]: boolean }>({});

  const handleStartEditName = (patientId: string, currentName: string) => {
    setInlineNameEdit(prev => (prev[patientId] === undefined ? ({ ...prev, [patientId]: currentName || '' }) : prev));
  };

  const handleChangeEditName = (patientId: string, value: string) => {
    setInlineNameEdit(prev => ({ ...prev, [patientId]: value }));
  };

  const handleSaveEditName = async (patientId: string, hospitalId: string) => {
    try {
      const raw = inlineNameEdit[patientId] || '';
      const cleaned = sanitizePatientName(raw);
      if (!cleaned || cleaned === 'Nome não informado') {
        toast({
          title: 'Nome inválido',
          description: 'Informe um nome válido do paciente.',
          variant: 'destructive'
        });
        return;
      }
      setSavingName(prev => ({ ...prev, [patientId]: true }));
      // Guardar CNS para sincronização otimista no array de AIHs
      const currentPatient = patients.find(p => (p as any).id === patientId) as any;
      const currentCns = currentPatient?.cns;
      await PatientService.updatePatient(patientId, {
        name: cleaned,
        updated_at: new Date().toISOString()
      } as any);

      // ✅ OTIMIZADO: Sincronizar apenas na lista de AIHs (patients vêm do JOIN)
      setAIHs(prev => prev.map(a => {
        const nested: any = (a as any).patients;
        if (!nested) return a;
        const matchById = nested.id && nested.id === patientId;
        const matchByCns = currentCns && nested.cns && nested.cns === currentCns;
        if (matchById || matchByCns) {
          return { ...a, patients: { ...nested, name: cleaned } } as any;
        }
        return a;
      }));

      setInlineNameEdit(prev => { const copy = { ...prev }; delete copy[patientId]; return copy; });
      toast({ title: 'Nome atualizado', description: 'Paciente atualizado com sucesso.' });
    } catch (e:any) {
      toast({ title: 'Erro ao salvar', description: e?.message || 'Falha ao atualizar o nome', variant: 'destructive' });
    } finally {
      setSavingName(prev => ({ ...prev, [patientId]: false }));
    }
  };

  // Funções para edição de competência
  const handleStartEditCompetencia = (aihId: string, currentCompetencia: string | undefined) => {
    // 🔧 DEBUG: Verificar valor recebido
    console.log('📝 INICIANDO EDIÇÃO DE COMPETÊNCIA:', {
      aihId,
      competenciaRecebida: currentCompetencia,
      tipo: typeof currentCompetencia
    });

    setEditingCompetencia(prev => ({ ...prev, [aihId]: true }));
    
    // Converter YYYY-MM-DD para YYYY-MM (formato do input type="month")
    if (currentCompetencia && currentCompetencia.trim() !== '') {
      // Limpar e normalizar o valor
      const cleanValue = currentCompetencia.trim();
      const match = cleanValue.match(/^(\d{4})-(\d{2})/);
      
      if (match) {
        const yearMonth = `${match[1]}-${match[2]}`;
        console.log('✅ Competência convertida:', yearMonth);
        setCompetenciaValue(prev => ({ ...prev, [aihId]: yearMonth }));
      } else {
        console.warn('⚠️ Formato de competência não reconhecido:', cleanValue);
        // Tentar usar valor atual mesmo assim
        setCompetenciaValue(prev => ({ ...prev, [aihId]: cleanValue }));
      }
    } else {
      // Se não houver competência, usar mês atual
      const now = new Date();
      const yearMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
      console.log('ℹ️ Sem competência existente. Usando mês atual:', yearMonth);
      setCompetenciaValue(prev => ({ ...prev, [aihId]: yearMonth }));
    }
  };

  const handleCancelEditCompetencia = (aihId: string) => {
    setEditingCompetencia(prev => ({ ...prev, [aihId]: false }));
    setCompetenciaValue(prev => { const copy = { ...prev }; delete copy[aihId]; return copy; });
  };

  const handleSaveCompetencia = async (aihId: string) => {
    // Guardar valor original para rollback se necessário
    const originalCompetencia = aihs.find(a => a.id === aihId)?.competencia;
    const newCompetencia = competenciaValue[aihId];
    
    try {
      if (!newCompetencia) {
        toast({
          title: 'Competência inválida',
          description: 'Selecione uma competência válida.',
          variant: 'destructive'
        });
        return;
      }

      // Validar formato YYYY-MM
      const match = newCompetencia.match(/^(\d{4})-(\d{2})$/);
      if (!match) {
        toast({
          title: 'Formato inválido',
          description: 'Use o formato MM/AAAA.',
          variant: 'destructive'
        });
        return;
      }

      setSavingCompetencia(prev => ({ ...prev, [aihId]: true }));

      // Converter YYYY-MM para YYYY-MM-01 (primeiro dia do mês)
      const competenciaDate = `${newCompetencia}-01`;

      // 🔧 DEBUG: Verificar valores antes de salvar
      console.log('💾 SALVANDO COMPETÊNCIA:', {
        aihId,
        competenciaInput: newCompetencia,
        competenciaFinal: competenciaDate,
        formatoEsperado: 'YYYY-MM-DD'
      });

      // ⚡ OPTIMISTIC UPDATE: Atualizar UI IMEDIATAMENTE (antes do banco confirmar)
      setAIHs(prev => prev.map(aih => 
        aih.id === aihId 
          ? { 
              ...aih, 
              competencia: competenciaDate, 
              updated_at: new Date().toISOString() 
            }
          : aih
      ));

      // Fechar modal imediatamente para parecer instantâneo
      setEditingCompetencia(prev => ({ ...prev, [aihId]: false }));
      setCompetenciaValue(prev => { const copy = { ...prev }; delete copy[aihId]; return copy; });

      // Atualizar no banco usando Supabase direto (em background)
      const { data: updatedData, error } = await supabase
        .from('aihs')
        .update({ 
          competencia: competenciaDate,
          updated_at: new Date().toISOString()
        })
        .eq('id', aihId)
        .select('id, competencia, updated_at'); // 🆕 Retornar dados atualizados para confirmar

      if (error) {
        console.error('❌ Erro do Supabase:', error);
        
        // ⚠️ ROLLBACK: Reverter mudança otimista se deu erro
        await loadAIHs(); // Recarregar do banco para ter certeza dos dados corretos
        
        throw error;
      }

      // 🔧 DEBUG: Verificar o que foi salvo no banco
      console.log('✅ BANCO ATUALIZADO:', updatedData);

      // ✅ Atualizar lista de competências disponíveis se necessário
      if (!availableCompetencias.includes(competenciaDate)) {
        setAvailableCompetencias(prev => {
          const newList = [...prev, competenciaDate];
          return newList.sort((a, b) => b.localeCompare(a)); // Mais recente primeiro
        });
      }

      // ✅ Toast de confirmação
      toast({ 
        title: '✅ Salvo!', 
        description: `Competência: ${formatCompetencia(competenciaDate)}`,
        duration: 2000
      });
    } catch (e: any) {
      console.error('❌ ERRO AO ATUALIZAR COMPETÊNCIA:', e);
      
      // Reabrir modal de edição para tentar novamente
      setEditingCompetencia(prev => ({ ...prev, [aihId]: true }));
      setCompetenciaValue(prev => ({ ...prev, [aihId]: newCompetencia }));
      
      toast({ 
        title: 'Erro ao salvar', 
        description: e?.message || 'Falha na conexão. Tente novamente.', 
        variant: 'destructive',
        duration: 5000
      });
    } finally {
      setSavingCompetencia(prev => ({ ...prev, [aihId]: false }));
    }
  };
  const [diagnosticModalOpen, setDiagnosticModalOpen] = useState(false);
  const [diagnosticData, setDiagnosticData] = useState<any>(null);
  const [isDiagnosing, setIsDiagnosing] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncResults, setSyncResults] = useState<any>(null);

  // ✅ REMOVIDO: Filtros de data de admissão e alta (agora usa apenas competência)

  // Removido: Range mensal e lista de competências não são mais necessários

  // 🎯 NOVA FUNÇÃO: Recalcular valor total da AIH baseado nos procedimentos ativos
  const recalculateAIHTotal = (aihId: string, procedures: any[]) => {
    // 🎯 CALCULAR APENAS PROCEDIMENTOS ATIVOS/APROVADOS E EXCLUINDO ANESTESISTAS SEM VALOR
    const activeProcedures = procedures.filter(proc => 
      (proc.match_status === 'matched' || proc.match_status === 'manual') &&
      filterCalculableProcedures({ cbo: proc.professional_cbo, procedure_code: proc.procedure_code })
    );
    
    // Somar em CENTAVOS a partir de uma base robusta em REAIS
    const totalReais = sumProceduresBaseReais(activeProcedures);
    const totalValue = Math.round(totalReais * 100);
    
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

  // ✅ CARREGAR HOSPITAIS E MÉDICOS (apenas para administradores)
  useEffect(() => {
    const loadHospitalsAndDoctors = async () => {
      if (isDirector) {
        try {
          // Carregar hospitais
          const { data: hospitals } = await supabase
            .from('hospitals')
            .select('id, name')
            .eq('is_active', true)
            .order('name');
          
          if (hospitals) {
            setAvailableHospitals(hospitals);
            console.log('🏥 Hospitais carregados:', hospitals.length);
          }
          
          // Carregar médicos
          const { data: doctors } = await supabase
            .from('doctors')
            .select('cns, name')
            .eq('is_active', true)
            .order('name');
          
          if (doctors) {
            setAvailableDoctors(doctors);
            console.log('👨‍⚕️ Médicos carregados:', doctors.length);
          }
        } catch (error) {
          console.error('❌ Erro ao carregar hospitais/médicos:', error);
        }
      }
    };
    
    loadHospitalsAndDoctors();
  }, [isDirector]);

  // ✅ SIMPLIFICADO: Recarregar dados quando hospital ou competência mudarem
  useEffect(() => {
    if (currentHospitalId || isDirector) {
      loadAIHs(); // Recarregar AIHs
    }
  }, [currentHospitalId, selectedHospitalFilter, selectedCompetencia]);

  // Resetar página quando filtros mudarem + atualizar contagem
  useEffect(() => {
    setCurrentPage(0);
    loadAIHsCount();
  }, [globalSearch, selectedCompetencia, selectedHospitalFilter, selectedDoctorFilter]);

  // Carregar competências disponíveis quando AIHs mudarem
  useEffect(() => {
    if (aihs.length > 0) {
      const competencias = new Set<string>();
      aihs.forEach(aih => {
        if (aih.competencia) {
          competencias.add(aih.competencia);
        }
      });
      const sorted = Array.from(competencias).sort((a, b) => b.localeCompare(a)); // Mais recente primeiro
      setAvailableCompetencias(sorted);
    }
  }, [aihs]);

  const loadAllData = async () => {
    setIsLoading(true);
    try {
      // ✅ OTIMIZADO: Removida loadPatients() - dados já vêm no JOIN de AIHs
      await Promise.all([
        // loadPatients(), // ⚠️ DESABILITADO: Dados de pacientes já vêm em loadAIHs()
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
      // ✅ ADMINISTRADOR: Usar filtro de hospital selecionado
      const hospitalIdToLoad = isDirector && selectedHospitalFilter !== 'all' 
        ? selectedHospitalFilter 
        : (currentHospitalId || 'ALL');
      
      console.log('🔍 Carregando AIHs (com paginação, filtros e médicos) para hospital:', hospitalIdToLoad);
      console.log('🗓️ Filtro de competência:', selectedCompetencia !== 'all' ? selectedCompetencia : 'Todas');
      console.log('👨‍⚕️ Filtro de médico:', selectedDoctorFilter !== 'all' ? selectedDoctorFilter : 'Todos');
      const pageSize = 1000; // Supabase limita a 1000 por request
      let offset = 0;
      const all: any[] = [];

      // ✅ NOVO: Filtro de competência aplicado no SQL (backend)
      const competenciaFilter = (selectedCompetencia && selectedCompetencia !== 'all') 
        ? selectedCompetencia 
        : undefined;

      while (true) {
        // ✅ BUSCAR AIHs usando persistenceService COM FILTRO DE COMPETÊNCIA
        const batch = await persistenceService.getAIHs(hospitalIdToLoad, {
          limit: pageSize,
          offset,
          competencia: competenciaFilter // ✅ NOVO: Filtrar no SQL
        });

        const error = null;
        
        if (error) {
          console.error('❌ Erro ao carregar batch de AIHs:', error);
          break;
        }

        const batchLen = batch?.length || 0;
        if (batchLen === 0) break;
        all.push(...batch);
        if (batchLen < pageSize) break;
        offset += pageSize;
        // Evitar UI freeze em listas enormes
        await new Promise(r => setTimeout(r, 0));
      }

      setAIHs(all);
      
      // ✅ CARREGAR MÉDICOS EM BATCH
      const uniqueCNS = [...new Set(all.map(aih => aih.cns_responsavel).filter(Boolean))];
      if (uniqueCNS.length > 0) {
        try {
          const { data: doctors } = await supabase
            .from('doctors')
            .select('cns, name')
            .in('cns', uniqueCNS);
          
          if (doctors) {
            const newDoctorsMap = new Map(doctorsCache);
            doctors.forEach(doc => {
              newDoctorsMap.set(doc.cns, doc.name);
            });
            setDoctorsCache(newDoctorsMap);
            console.log('👨‍⚕️ Médicos carregados:', doctors.length);
          }
        } catch (err) {
          console.warn('⚠️ Erro ao carregar médicos:', err);
        }
      }
      
      console.log('📊 AIHs carregadas:', all.length, '| Filtro de competência aplicado no BACKEND (SQL)');
    } catch (error) {
      console.error('❌ Erro ao carregar AIHs:', error);
      toast({
        title: "Erro", 
        description: "Falha ao carregar lista de AIHs",
        variant: "destructive"
      });
    }
  };

  // Contagem exata de AIHs (sem limite de 1000)
  const loadAIHsCount = async () => {
    try {
      // ✅ ADMINISTRADOR: Usar filtro de hospital selecionado
      const hospitalIdToCount = isDirector && selectedHospitalFilter !== 'all' 
        ? selectedHospitalFilter 
        : (currentHospitalId || 'ALL');
      
      const count = await persistenceService.countAIHs(hospitalIdToCount, {});
      setTotalAIHsCount(count);
      console.log('🧮 Contagem exata de AIHs (back-end):', count);
    } catch (error) {
      console.error('❌ Erro ao contar AIHs:', error);
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
        
        toast({
          title: "Sucesso",
          description: "Paciente removido com sucesso",
        });
      } else {
        // ✅ CORREÇÃO: Usar deleteCompleteAIH para deletar das 3 tabelas: aihs, patients, procedure_records
        const result = await persistenceService.deleteCompleteAIH(
          itemToDelete.id,
          user?.id || 'system',
          {
            keepAuditTrail: true // Manter log de auditoria para compliance
          }
        );
        
        setAIHs(aihs.filter(a => a.id !== itemToDelete.id));
        
        // 🎯 TOAST DETALHADO com informações do que foi excluído
        toast({
          title: "✅ Exclusão Completa Realizada",
          description: result.message,
        });
        
        console.log('🗑️ Resultado da exclusão completa:', result);
      }
      
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

  // ✅ OTIMIZADO: Prefetch de procedimentos em lote (resolver N+1)
  const prefetchProceduresForVisibleAIHs = async (aihIds: string[]) => {
    // Filtrar apenas AIHs que ainda não têm procedimentos carregados
    const idsToLoad = aihIds.filter(id => !proceduresData[id] && !loadingProcedures[id]);
    if (idsToLoad.length === 0) return;

    console.log(`🚀 Prefetching procedimentos para ${idsToLoad.length} AIHs...`);
    
    // Marcar como "carregando" para evitar duplicação
    setLoadingProcedures(prev => {
      const newState = { ...prev };
      idsToLoad.forEach(id => newState[id] = true);
      return newState;
    });

    try {
      // Carregar todos em paralelo (máximo 5 por vez para não sobrecarregar)
      const batchSize = 5;
      for (let i = 0; i < idsToLoad.length; i += batchSize) {
        const batch = idsToLoad.slice(i, i + batchSize);
        const results = await Promise.all(
          batch.map(id => persistenceService.getAIHProcedures(id).catch(() => []))
        );
        
        // Atualizar estado com resultados
        setProceduresData(prev => {
          const newData = { ...prev };
          batch.forEach((id, index) => {
            newData[id] = results[index] || [];
          });
          return newData;
        });

        // Recalcular totais
        batch.forEach((id, index) => {
          recalculateAIHTotal(id, results[index] || []);
        });
      }
      
      console.log(`✅ Prefetch completo para ${idsToLoad.length} AIHs`);
    } catch (error) {
      console.error('❌ Erro no prefetch de procedimentos:', error);
    } finally {
      // Desmarcar "carregando"
      setLoadingProcedures(prev => {
        const newState = { ...prev };
        idsToLoad.forEach(id => delete newState[id]);
        return newState;
      });
    }
  };

  // Ações inline para procedimentos
  // Botão de inativar removido

  const handleDeleteProcedure = async (aihId: string, procedure: any) => {
    try {
      // Persistir no banco: excluir permanentemente
      if (user?.id) {
        await persistenceService.deleteProcedureFromAIH(aihId, procedure.procedure_sequence, user.id);
      }

      // Atualizar estado local e recarregar do banco
      const updatedProcedures = (proceduresData[aihId] || []).filter(proc => 
        proc.procedure_sequence !== procedure.procedure_sequence
      );
      setProceduresData(prev => ({ ...prev, [aihId]: updatedProcedures }));

      const newTotal = recalculateAIHTotal(aihId, updatedProcedures);
      await loadAIHProcedures(aihId);

      toast({
        title: "🗑️ Procedimento excluído",
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

  // Botão de reativar removido

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

  // ✅ OTIMIZADO: Dados unificados usando diretamente o JOIN de patients
  // Não é necessário buscar no array separado pois os dados já vêm em aih.patients
  const unifiedData: UnifiedAIHData[] = aihs.map(aih => {
    return {
      ...aih,
      patient: aih.patients || null, // ✅ Usar diretamente do JOIN
      matches: aih.aih_matches || []
    };
  });

  // ✅ OTIMIZADO: Filtros aplicados (backend já filtrou competência, data e caráter)
  const filteredData = unifiedData.filter(item => {
    // ✅ COMPETÊNCIA JÁ FILTRADA NO BACKEND (SQL) - não precisa filtrar aqui
    
    // ✅ NOVO: Filtro de médico (frontend - apenas para administradores)
    if (isDirector && selectedDoctorFilter !== 'all') {
      if (!item.cns_responsavel || item.cns_responsavel !== selectedDoctorFilter) {
        return false;
      }
    }
    
    // Apenas filtro de busca textual (frontend) - os demais já foram aplicados no SQL
    if (!globalSearch) return true;
    
    const searchLower = globalSearch.toLowerCase();
    return (
      item.aih_number.toLowerCase().includes(searchLower) ||
      (item.patient?.name && item.patient.name.toLowerCase().includes(searchLower)) ||
      (item.patient?.cns && item.patient.cns.includes(globalSearch))
    );
  }).sort((a, b) => {
    // ✅ Ordenação por updated_at (processados mais recentemente primeiro)
    const updatedA = a.updated_at ? new Date(a.updated_at).getTime() : 0;
    const updatedB = b.updated_at ? new Date(b.updated_at).getTime() : 0;
    
    // Se ambos têm updated_at, ordenar do mais recente para o mais antigo
    if (updatedA && updatedB) {
      return updatedB - updatedA;
    }
    
    // Se apenas um tem updated_at, priorizar o que tem
    if (updatedA && !updatedB) return -1;
    if (!updatedA && updatedB) return 1;
    
    // Fallback: ordenar por created_at se não houver updated_at
    const createdA = a.created_at ? new Date(a.created_at).getTime() : 0;
    const createdB = b.created_at ? new Date(b.created_at).getTime() : 0;
    return createdB - createdA;
  });

  // Paginação unificada
  const paginatedData = filteredData.slice(
    currentPage * itemsPerPage,
    (currentPage + 1) * itemsPerPage
  );

  // ✅ NOVO: Calcular número de PACIENTES ÚNICOS (não AIHs) e detectar múltiplas AIHs
  const { uniquePatients, aihsWithPatients, patientsWithMultipleAIHs } = React.useMemo(() => {
    const patientIds = new Set<string>();
    const patientAIHCount = new Map<string, number>(); // Contador de AIHs por paciente
    let validAIHs = 0;
    
    filteredData.forEach(item => {
      if (item.patient_id) {
        patientIds.add(item.patient_id);
        validAIHs++;
        
        // Contar AIHs por paciente
        const currentCount = patientAIHCount.get(item.patient_id) || 0;
        patientAIHCount.set(item.patient_id, currentCount + 1);
      }
    });
    
    // Identificar pacientes com múltiplas AIHs
    const multipleAIHs = new Map<string, number>();
    patientAIHCount.forEach((count, patientId) => {
      if (count > 1) {
        multipleAIHs.set(patientId, count);
      }
    });
    
    return {
      uniquePatients: patientIds.size,
      aihsWithPatients: validAIHs,
      patientsWithMultipleAIHs: multipleAIHs
    };
  }, [filteredData]);

  // ✅ OTIMIZADO: Prefetch automático de procedimentos ao trocar página
  useEffect(() => {
    const visibleAIHIds = paginatedData.slice(0, 5).map(item => item.id); // Prefetch dos 5 primeiros
    if (visibleAIHIds.length > 0) {
      prefetchProceduresForVisibleAIHs(visibleAIHIds);
    }
  }, [currentPage, paginatedData.length]); // Executar quando mudar página ou dados

  // Funções de relatório por competência removidas - não são mais necessárias

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
    if (!date) return '—';
    const s = date.trim();
    const m = s.match(/^(\d{4})-(\d{2})-(\d{2})$/); // YYYY-MM-DD
    if (m) return `${m[3]}/${m[2]}/${m[1]}`;
    // Para ISO com horário, formatar em UTC para evitar deslocamento de dia
    try {
      return new Date(s).toLocaleDateString('pt-BR', { timeZone: 'UTC' });
    } catch {
      return s;
    }
  };

  // Função para formatar competência (YYYY-MM-DD → MM/YYYY)
  const formatCompetencia = (competencia: string | undefined) => {
    if (!competencia) return '—';
    const s = competencia.trim();
    const m = s.match(/^(\d{4})-(\d{2})-\d{2}$/); // YYYY-MM-DD
    if (m) return `${m[2]}/${m[1]}`; // MM/YYYY
    // Tentar parsear ISO
    try {
      const date = new Date(s);
      const month = String(date.getUTCMonth() + 1).padStart(2, '0');
      const year = date.getUTCFullYear();
      return `${month}/${year}`;
    } catch {
      return s;
    }
  };

  // NOVA FUNÇÃO: Gerar Relatório de Pacientes em Excel
  const handleGeneratePatientsExcelReport = async () => {
    try {
      // Usar filteredData para garantir que apenas os dados filtrados sejam incluídos
      let dataToExport = [...filteredData];
      
      if (dataToExport.length === 0) {
        toast({
          title: "Nenhum dado para exportar",
          description: "Não há pacientes para incluir no relatório.",
          variant: "destructive"
        });
        return;
      }

      // ✅ Ordenar dados por updated_at (processados mais recentemente primeiro)
      dataToExport.sort((a, b) => {
        const updatedA = a.updated_at ? new Date(a.updated_at) : null;
        const updatedB = b.updated_at ? new Date(b.updated_at) : null;
        
        // Priorizar itens com updated_at
        if (updatedA && !updatedB) return -1;
        if (!updatedA && updatedB) return 1;
        if (!updatedA && !updatedB) {
          // Se ambos não têm updated_at, ordenar por created_at
          const createdA = a.created_at ? new Date(a.created_at) : new Date(0);
          const createdB = b.created_at ? new Date(b.created_at) : new Date(0);
          return createdB.getTime() - createdA.getTime();
        }
        
        // Ambos têm updated_at, ordenar do mais recente para o mais antigo
        return updatedB!.getTime() - updatedA!.getTime();
      });

      // Cabeçalho do Excel
      const header = [
        'Nome Paciente',
        'Nº AIH', 
        'Médico Responsável',
        'Caráter de Atendimento',
        'Hospital',
        'Admissão',
        'Alta'
      ];

      // ✅ BUSCAR MÉDICOS POR CNS (batch para performance)
      const uniqueCNS = [...new Set(dataToExport.map(item => item.cns_responsavel).filter(Boolean))];
      const doctorsMap = new Map<string, string>();
      
      if (uniqueCNS.length > 0) {
        try {
          const { data: doctors } = await supabase
            .from('doctors')
            .select('cns, name')
            .in('cns', uniqueCNS);
          
          if (doctors) {
            doctors.forEach(doc => {
              doctorsMap.set(doc.cns, doc.name);
            });
          }
        } catch (err) {
          console.warn('⚠️ Erro ao buscar médicos:', err);
        }
      }

      // Preparar dados para o Excel
      const rows: Array<Array<string | number>> = [];
      
      for (const item of dataToExport) {
        const patientName = (item.patient || item.patients)?.name || 'N/A';
        const aihNumber = item.aih_number ? item.aih_number.toString().replace(/[.\-]/g, '') : 'N/A';
        // ✅ BUSCAR MÉDICO: 1º do Map (via CNS), 2º de requesting_physician
        const doctorName = doctorsMap.get(item.cns_responsavel || '') || item.requesting_physician || 'N/A';
        const careCharacter = CareCharacterUtils.getDescription(item.care_character) || item.care_character || 'N/A';
        const hospitalName = item.hospitals?.name || 'N/A';
        const admissionDate = item.admission_date ? formatDate(item.admission_date) : 'N/A';
        const dischargeDate = item.discharge_date ? formatDate(item.discharge_date) : 'N/A';

        rows.push([
          patientName,
          aihNumber,
          doctorName,
          careCharacter,
          hospitalName,
          admissionDate,
          dischargeDate
        ]);
      }

      // Criar workbook e worksheet
      const wb = XLSX.utils.book_new();
      const ws = XLSX.utils.aoa_to_sheet([header, ...rows]);

      // Configurar largura das colunas
      (ws as any)['!cols'] = [
        { wch: 30 }, // Nome Paciente
        { wch: 15 }, // Nº AIH
        { wch: 30 }, // Médico Responsável
        { wch: 20 }, // Caráter de Atendimento
        { wch: 25 }, // Hospital
        { wch: 12 }, // Admissão
        { wch: 12 }  // Alta
      ];

      XLSX.utils.book_append_sheet(wb, ws, 'Relatório Pacientes');

      // Gerar nome do arquivo com timestamp
      const timestamp = format(new Date(), 'yyyyMMdd_HHmm');
      const fileName = `Relatorio_Pacientes_${timestamp}.xlsx`;
      
      // Salvar arquivo
      XLSX.writeFile(wb, fileName);

      toast({
        title: "Relatório Excel gerado",
        description: `${dataToExport.length} pacientes exportados para Excel.`,
      });

    } catch (error) {
      console.error('❌ Erro ao gerar relatório Excel:', error);
      toast({
        title: "Erro ao gerar Excel",
        description: "Ocorreu um erro ao gerar o relatório. Tente novamente.",
        variant: "destructive"
      });
    }
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





      {/* Filtros Refinados */}
      <Card className="bg-gradient-to-r from-slate-50 via-white to-slate-50/50 border-slate-200/60 shadow-md hover:shadow-lg transition-all duration-300">
        <CardContent className="p-6">
          <div className="flex items-center space-x-3 mb-6">
            <div className="p-2 bg-gradient-to-br from-blue-100 to-blue-200 rounded-lg shadow-sm">
              <Filter className="w-5 h-5 text-blue-700" />
            </div>
            <h3 className="text-lg font-semibold text-gray-900">Filtros de Pesquisa</h3>
          </div>
          
          <div className="flex flex-col md:flex-row md:items-end gap-3">
            {/* Campo de Busca */}
            <div className="space-y-3 flex-1 min-w-[240px]">
              <label className="text-sm font-medium text-gray-700 flex items-center space-x-2">
                <div className="p-1 bg-blue-100 rounded">
                  <Search className="w-3 h-3 text-blue-600" />
                </div>
                <span>Buscar</span>
              </label>
              <Input
                placeholder="AIH, paciente ou CNS..."
                value={globalSearch}
                onChange={(e) => setGlobalSearch(e.target.value)}
                className="w-full border-gray-300 focus:border-blue-500 focus:ring-blue-500 bg-white/80 hover:bg-white transition-colors"
              />
              {/* espaço vazio para manter espaçamento vertical uniforme no mobile */}
            </div>

            {/* ✅ SIMPLIFICADO: Apenas filtro de Competência */}
            <div className="space-y-3 w-full md:w-[180px]">
              <label className="text-sm font-medium text-gray-700 flex items-center space-x-2">
                <div className="p-1 bg-indigo-100 rounded">
                  <Calendar className="w-3 h-3 text-indigo-600" />
                </div>
                <span>Competência</span>
              </label>
              <Select value={selectedCompetencia} onValueChange={setSelectedCompetencia}>
                <SelectTrigger className="w-full border-gray-300 focus:border-indigo-500 focus:ring-indigo-500 bg-white/80 hover:bg-white transition-colors">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">
                    <div className="flex items-center gap-2">
                      Todas
                    </div>
                  </SelectItem>
                  {/* 🆕 OPÇÃO ESPECIAL: Sem Competência */}
                  <SelectItem value="sem_competencia">
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full bg-orange-500"></div>
                      <span className="text-orange-700 font-medium">⚠️ Sem Competência</span>
                    </div>
                  </SelectItem>
                  {availableCompetencias.map(comp => (
                    <SelectItem key={comp} value={comp}>
                      <div className="flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full bg-indigo-500"></div>
                        {formatCompetencia(comp)}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* ✅ NOVO: Filtro de Hospital (apenas para administradores) */}
            {isDirector && (
              <div className="space-y-3 w-full md:w-[220px]">
                <label className="text-sm font-medium text-gray-700 flex items-center space-x-2">
                  <div className="p-1 bg-blue-100 rounded">
                    <Activity className="w-3 h-3 text-blue-600" />
                  </div>
                  <span>Hospital</span>
                </label>
                <Select value={selectedHospitalFilter} onValueChange={setSelectedHospitalFilter}>
                  <SelectTrigger className="w-full border-gray-300 focus:border-blue-500 focus:ring-blue-500 bg-white/80 hover:bg-white transition-colors">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">
                      <div className="flex items-center gap-2">
                        Todos os Hospitais
                      </div>
                    </SelectItem>
                    {availableHospitals.map(hospital => (
                      <SelectItem key={hospital.id} value={hospital.id}>
                        <div className="flex items-center gap-2">
                          <div className="w-2 h-2 rounded-full bg-blue-500"></div>
                          {hospital.name}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {/* ✅ NOVO: Filtro de Médicos com Busca (apenas para administradores) */}
            {isDirector && (
              <div className="space-y-3 w-full md:w-[250px]">
                <label className="text-sm font-medium text-gray-700 flex items-center space-x-2">
                  <div className="p-1 bg-green-100 rounded">
                    <Stethoscope className="w-3 h-3 text-green-600" />
                  </div>
                  <span>Médico</span>
                </label>
                <div className="relative">
                  <Input
                    type="text"
                    placeholder="Digite para buscar médico..."
                    value={doctorSearchTerm}
                    onChange={(e) => setDoctorSearchTerm(e.target.value)}
                    className="w-full border-gray-300 focus:border-green-500 focus:ring-green-500 bg-white/80 hover:bg-white transition-colors pr-8"
                  />
                  {doctorSearchTerm && (
                    <button
                      onClick={() => {
                        setDoctorSearchTerm('');
                        setSelectedDoctorFilter('all');
                      }}
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  )}
                </div>
                {doctorSearchTerm && (
                  <div className="absolute z-50 w-full md:w-[250px] max-h-[200px] overflow-y-auto bg-white border border-gray-200 rounded-lg shadow-lg mt-1">
                    <div className="p-1">
                      <button
                        onClick={() => {
                          setSelectedDoctorFilter('all');
                          setDoctorSearchTerm('');
                        }}
                        className="w-full text-left px-3 py-2 text-sm hover:bg-gray-100 rounded transition-colors"
                      >
                        <div className="flex items-center gap-2">
                          <div className="w-2 h-2 rounded-full bg-gray-400"></div>
                          Todos os Médicos
                        </div>
                      </button>
                      {availableDoctors
                        .filter(doc => 
                          doc.name.toLowerCase().includes(doctorSearchTerm.toLowerCase()) ||
                          doc.cns.includes(doctorSearchTerm)
                        )
                        .slice(0, 20)
                        .map(doctor => (
                          <button
                            key={doctor.cns}
                            onClick={() => {
                              setSelectedDoctorFilter(doctor.cns);
                              setDoctorSearchTerm(doctor.name);
                            }}
                            className="w-full text-left px-3 py-2 text-sm hover:bg-green-50 rounded transition-colors"
                          >
                            <div className="flex items-center gap-2">
                              <div className="w-2 h-2 rounded-full bg-green-500"></div>
                              <span className="truncate">{doctor.name}</span>
                            </div>
                            <div className="text-xs text-gray-500 ml-4">CNS: {doctor.cns}</div>
                          </button>
                        ))
                      }
                      {availableDoctors.filter(doc => 
                        doc.name.toLowerCase().includes(doctorSearchTerm.toLowerCase()) ||
                        doc.cns.includes(doctorSearchTerm)
                      ).length === 0 && (
                        <div className="px-3 py-2 text-sm text-gray-500">
                          Nenhum médico encontrado
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Botão Limpar */}
            <div className="w-full md:w-[150px] flex items-end">
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setGlobalSearch('');
                  setSelectedCompetencia('all');
                  setSelectedHospitalFilter('all');
                  setSelectedDoctorFilter('all');
                  setDoctorSearchTerm('');
                }}
                className="h-9 text-gray-600 hover:text-gray-800 hover:bg-gray-50 border-gray-300 transition-colors w-full md:w-auto"
                title="Limpar filtros"
              >
                <RotateCcw className="w-4 h-4 mr-2" />
                Limpar
              </Button>
            </div>
          </div>

          {/* Seção de competências removida */}

          {/* Rodapé dos filtros removido conforme solicitação */}
        </CardContent>
      </Card>

      {/* Lista Unificada de AIHs */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between text-xl">
            <div className="flex flex-col gap-1">
              <div className="flex items-center space-x-2">
                <FileText className="w-5 h-5" />
                <span>
                  AIHs Processadas ({uniquePatients} pacientes)
                  {selectedCompetencia !== 'all' && (
                    <span className="ml-2 text-sm font-normal text-indigo-600">
                      • Competência: {selectedCompetencia === 'sem_competencia' ? '⚠️ Sem Competência' : formatCompetencia(selectedCompetencia)}
                    </span>
                  )}
                  {isDirector && selectedHospitalFilter !== 'all' && (
                    <span className="ml-2 text-sm font-normal text-blue-600">
                      • {availableHospitals.find(h => h.id === selectedHospitalFilter)?.name || 'Hospital'}
                    </span>
                  )}
                  {isDirector && selectedDoctorFilter !== 'all' && (
                    <span className="ml-2 text-sm font-normal text-green-600">
                      • Dr(a). {availableDoctors.find(d => d.cns === selectedDoctorFilter)?.name || 'Médico'}
                    </span>
                  )}
                </span>
              </div>
              <div className="flex items-center gap-4 flex-wrap">
                {(filteredData.length - aihsWithPatients) > 0 && (
                  <div className="flex items-center gap-2 text-xs text-orange-600 font-normal">
                    <AlertCircle className="w-3 h-3" />
                    <span>
                      ⚠️ {filteredData.length - aihsWithPatients} AIH(s) órfã(s) sem paciente associado
                    </span>
                  </div>
                )}
                {patientsWithMultipleAIHs.size > 0 && (
                  <div className="flex items-center gap-2 text-xs text-blue-600 font-normal">
                    <Info className="w-3 h-3" />
                    <span>
                      ℹ️ {patientsWithMultipleAIHs.size} paciente(s) com múltiplas AIHs (total: {Array.from(patientsWithMultipleAIHs.values()).reduce((sum, count) => sum + count, 0)} AIHs)
                    </span>
                  </div>
                )}
              </div>
            </div>
            <Button
              onClick={handleGeneratePatientsExcelReport}
              variant="outline"
              size="sm"
              className="flex items-center gap-2 bg-green-600 text-white border-green-600 hover:bg-green-700 hover:border-green-700"
            >
              <FileSpreadsheet className="w-4 h-4" />
              Relatório Pacientes
            </Button>
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
                <div key={item.id} className="border border-gray-200 rounded-lg bg-white hover:shadow-md transition-all duration-200 overflow-hidden">
                  {/* Header com Nome e Ações */}
                  <div className="bg-gradient-to-r from-blue-50 to-indigo-50 px-4 py-3 border-b border-gray-200">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3 flex-1 min-w-0">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleExpandAIH(item.id)}
                          className="text-gray-600 hover:text-blue-600 hover:bg-blue-100 rounded-md transition-colors p-1.5 flex-shrink-0"
                        >
                          {expandedItems.has(item.id) ? 
                            <ChevronUp className="w-4 h-4" /> : 
                            <ChevronDown className="w-4 h-4" />
                          }
                        </Button>
                        
                        <div className="w-8 h-8 bg-blue-500 rounded-md flex items-center justify-center flex-shrink-0">
                          <User className="w-4 h-4 text-white" />
                        </div>
                        
                        <div className="flex items-center gap-2 flex-wrap flex-1 min-w-0">
                          <h3 className="font-semibold text-gray-900 text-base truncate">
                            {item.patient?.name || item.patients?.name || 'Paciente não identificado'}
                          </h3>
                          
                          {/* Badges */}
                          {(() => {
                            const patientId = item.patient_id;
                            const aihCount = patientId ? patientsWithMultipleAIHs.get(patientId) : null;
                            if (!aihCount || aihCount <= 1) return null;
                            return (
                              <Badge 
                                variant="outline" 
                                className="bg-blue-100 border-blue-300 text-blue-700 text-[10px] h-5 px-1.5 font-semibold flex-shrink-0"
                                title={`Este paciente possui ${aihCount} AIHs (internações múltiplas)`}
                              >
                                🔄 {aihCount}× AIHs
                              </Badge>
                            );
                          })()}
                          
                          {item.care_character && (
                            <Badge
                              variant="outline"
                              className={`text-[10px] h-5 flex-shrink-0 ${CareCharacterUtils.getStyleClasses(item.care_character)}`}
                            >
                              {CareCharacterUtils.formatForDisplay(item.care_character, false)}
                            </Badge>
                          )}
                          
                          {(() => {
                            const birth = (item.patient || item.patients)?.birth_date as any;
                            if (!birth) return null;
                            const d = new Date(String(birth));
                            if (isNaN(d.getTime())) return null;
                            const today = new Date();
                            let age = today.getFullYear() - d.getFullYear();
                            const m = today.getMonth() - d.getMonth();
                            if (m < 0 || (m === 0 && today.getDate() < d.getDate())) age--;
                            if (age < 0 || age > 130) return null;
                            return (
                              <Badge variant="outline" className="bg-purple-50 border-purple-200 text-purple-700 text-[10px] h-5 flex-shrink-0">
                                {age} anos
                              </Badge>
                            );
                          })()}
                        </div>
                      </div>
                      
                      {/* Botões de Ação */}
                      <div className="flex items-center gap-2 ml-4 flex-shrink-0">
                        {(() => {
                          const userRole = user?.role as string;
                          const hasPermission = (['user', 'operator', 'coordinator', 'director', 'admin'] as const).includes(userRole as any);
                          
                          return hasPermission && (
                            <>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleStartEditCompetencia(item.id, item.competencia)}
                                disabled={savingCompetencia[item.id]}
                                className="text-blue-600 hover:text-blue-700 border-blue-200 hover:border-blue-300 hover:bg-blue-50 transition-colors h-8 px-3 flex items-center gap-1.5"
                                title="Editar competência"
                              >
                                {savingCompetencia[item.id] ? (
                                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-500"></div>
                                ) : (
                                  <Calendar className="w-4 h-4" />
                                )}
                                <span className="hidden md:inline text-xs">Editar</span>
                              </Button>
                              
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleDeleteRequest('aih', item.id, item.aih_number)}
                                className="text-red-600 hover:text-red-700 border-red-200 hover:border-red-300 hover:bg-red-50 transition-colors h-8 px-3 flex items-center gap-1.5"
                              >
                                <Trash2 className="w-4 h-4" />
                                <span className="hidden md:inline text-xs">Excluir</span>
                              </Button>
                            </>
                          );
                        })()}
                      </div>
                    </div>
                    
                    {/* Edição inline de nome se necessário */}
                    {(() => {
                      const patientId = (item.patient as any)?.id || (item.patients as any)?.id;
                      const shownName = (item.patient as any)?.name || (item.patients as any)?.name || '';
                      const looksWrong = !shownName || isLikelyProcedureString(shownName) || /^nome não informado$/i.test(shownName);
                      if (!patientId || !looksWrong) return null;
                      const value = inlineNameEdit[patientId] ?? '';
                      const saving = !!savingName[patientId];
                      return (
                        <div className="mt-3 flex items-center gap-2">
                          <input
                            className="border rounded px-2 py-1.5 text-sm flex-1"
                            placeholder="Digite o nome correto do paciente"
                            value={value}
                            onChange={(e) => handleChangeEditName(patientId, e.target.value)}
                            onFocus={() => handleStartEditName(patientId, '')}
                            disabled={saving}
                          />
                          <Button
                            size="sm"
                            onClick={() => handleSaveEditName(patientId, (item as any).hospital_id || currentHospitalId || '')}
                            disabled={saving || !(inlineNameEdit[patientId] ?? '').trim()}
                          >
                            {saving ? 'Salvando...' : 'Salvar nome'}
                          </Button>
                        </div>
                      );
                    })()}
                  </div>
                  
                  {/* Tabela de Informações */}
                  <div className="bg-white">
                    <table className="w-full text-sm">
                      <tbody className="divide-y divide-gray-100">
                        {/* Linha 1: Dados do Paciente */}
                        <tr className="hover:bg-gray-50">
                          <td className="px-4 py-2.5 w-1/2">
                            <span className="text-gray-500 font-medium">Prontuário: </span>
                            <span className="text-gray-900 ml-1">{(item.patient || item.patients)?.medical_record || '-'}</span>
                          </td>
                          <td className="px-4 py-2.5 w-1/2">
                            <span className="text-gray-500 font-medium">CNS: </span>
                            <span className="text-gray-900 ml-1">{(item.patient || item.patients)?.cns || '-'}</span>
                          </td>
                        </tr>
                        
                        {/* Linha 2: Datas */}
                        <tr className="hover:bg-gray-50">
                          <td className="px-4 py-2.5">
                            <span className="text-gray-500 font-medium">Admissão: </span>
                            <span className="text-gray-900 ml-1">{formatDate(item.admission_date)}</span>
                          </td>
                          <td className="px-4 py-2.5">
                            <span className="text-gray-500 font-medium">Alta: </span>
                            <span className="text-gray-900 ml-1">{item.discharge_date ? formatDate(item.discharge_date) : '-'}</span>
                          </td>
                        </tr>
                        
                        {/* Linha 3: AIH e CID */}
                        <tr className="hover:bg-gray-50">
                          <td className="px-4 py-2.5">
                            <span className="text-gray-500 font-medium">Nº AIH: </span>
                            <span className="text-gray-900 font-mono text-xs ml-1">{item.aih_number || '-'}</span>
                          </td>
                          <td className="px-4 py-2.5">
                            <span className="text-gray-500 font-medium">CID Principal: </span>
                            <span className="text-gray-900 ml-1">{item.main_cid || '-'}</span>
                          </td>
                        </tr>
                        
                        {/* Linha 4: Competência e Hospital */}
                        <tr className="hover:bg-gray-50">
                          <td className="px-4 py-2.5">
                            <span className="text-gray-500 font-medium">Competência: </span>
                            <span className="font-semibold text-blue-600 ml-1">{formatCompetencia(item.competencia)}</span>
                          </td>
                          <td className="px-4 py-2.5">
                            <span className="text-gray-500 font-medium">Hospital: </span>
                            <span className="text-gray-900 font-medium ml-1">{item.hospitals?.name || '-'}</span>
                          </td>
                        </tr>
                        
                        {/* Linha 5: Especialidade e Modalidade */}
                        <tr className="hover:bg-gray-50">
                          <td className="px-4 py-2.5">
                            <span className="text-gray-500 font-medium">Especialidade: </span>
                            <span className="text-gray-900 ml-1">{item.specialty || 'Cirúrgico'}</span>
                          </td>
                          <td className="px-4 py-2.5">
                            <span className="text-gray-500 font-medium">Modalidade: </span>
                            <span className="text-gray-900 ml-1">{item.care_modality || 'Hospitalar'}</span>
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  </div>

                  {/* Modal de Edição de Competência */}
                  {editingCompetencia[item.id] && (
                    <div className="bg-blue-50 border-t border-blue-200 p-4">
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center space-x-2">
                          <Calendar className="w-5 h-5 text-blue-600" />
                          <h4 className="text-sm font-semibold text-blue-900">Editar Competência</h4>
                        </div>
                      </div>
                      
                      <div className="flex items-end space-x-3">
                        <div className="flex-1">
                          <label className="block text-xs font-medium text-blue-700 mb-1">
                            Selecione o mês/ano da competência
                          </label>
                          <input
                            type="month"
                            value={competenciaValue[item.id] || ''}
                            onChange={(e) => setCompetenciaValue(prev => ({ ...prev, [item.id]: e.target.value }))}
                            className="w-full px-3 py-2 border border-blue-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                            disabled={savingCompetencia[item.id]}
                          />
                          <p className="mt-1 text-xs text-blue-600">
                            Competência atual: <strong>{formatCompetencia(item.competencia)}</strong>
                          </p>
                        </div>
                        
                        <Button
                          size="sm"
                          onClick={() => handleSaveCompetencia(item.id)}
                          disabled={savingCompetencia[item.id]}
                          className="bg-blue-600 hover:bg-blue-700 text-white h-10"
                        >
                          {savingCompetencia[item.id] ? (
                            <>
                              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                              Salvando...
                            </>
                          ) : (
                            'Salvar'
                          )}
                        </Button>
                        
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleCancelEditCompetencia(item.id)}
                          disabled={savingCompetencia[item.id]}
                          className="h-10"
                        >
                          Cancelar
                        </Button>
                      </div>
                    </div>
                  )}

                  {expandedItems.has(item.id) && (
                    <div className="bg-gray-50/50 p-4 space-y-3">
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

                      {/* Seção Premium Unificada: Paciente + AIH */}
                      <div className="bg-gradient-to-r from-indigo-50 via-white to-emerald-50 rounded-xl border p-4 border-indigo-200">
                        <div className="flex items-center justify-between mb-3">
                          <div className="flex items-center gap-2">
                            <div className="w-7 h-7 rounded-lg bg-indigo-100 flex items-center justify-center">
                              <User className="w-4 h-4 text-indigo-600" />
                            </div>
                            <h4 className="text-sm font-semibold text-indigo-900">Dados do Paciente e AIH</h4>
                          </div>
                        </div>
                        <div className="grid grid-cols-12 gap-4 text-[13px]">
                          {/* Linha 1: Nome + Caráter */}
                          <div className="col-span-12 md:col-span-8 xl:col-span-9">
                            <span className="text-[11px] text-gray-500">Nome</span>
                            <p className="font-medium text-gray-900 truncate">{(item.patient || item.patients)?.name || 'N/A'}</p>
                          </div>
                          <div className="col-span-12 md:col-span-4 xl:col-span-3 flex md:justify-end items-end">
                            <div>
                              <span className="text-[11px] text-gray-500 block">Caráter</span>
                              <div className={`text-[11px] leading-none font-medium px-2 py-1 rounded-md border inline-block mt-1 ${item.care_character ? CareCharacterUtils.getStyleClasses(item.care_character) : 'text-gray-600 bg-gray-100 border-gray-200'}`}>
                                {item.care_character ? CareCharacterUtils.formatForDisplay(item.care_character) : 'N/A'}
                              </div>
                            </div>
                          </div>

                          {/* Linha 2: CNS, Prontuário, Nascimento, Gênero */}
                          <div className="col-span-6 md:col-span-3">
                            <span className="text-[11px] text-gray-500">CNS</span>
                            <p className="font-medium text-gray-900">{(item.patient || item.patients)?.cns || 'N/A'}</p>
                          </div>
                          {(item.patient || item.patients)?.medical_record && (
                            <div className="col-span-6 md:col-span-3">
                              <span className="text-[11px] text-gray-500">Prontuário</span>
                              <p className="font-medium text-gray-900">{(item.patient || item.patients)?.medical_record}</p>
                            </div>
                          )}
                          <div className="col-span-6 md:col-span-3">
                            <span className="text-[11px] text-gray-500">Nascimento</span>
                            <p className="font-medium text-gray-900">{(item.patient || item.patients)?.birth_date ? formatDate((item.patient || item.patients).birth_date) : 'N/A'}</p>
                          </div>
                          <div className="col-span-6 md:col-span-3">
                            <span className="text-[11px] text-gray-500">Gênero</span>
                            <p className="font-medium text-gray-900">{(item.patient || item.patients)?.gender === 'M' ? 'Masculino' : (item.patient || item.patients)?.gender === 'F' ? 'Feminino' : 'N/A'}</p>
                          </div>

                          {/* Linha 3: Código Proc, CID */}
                          <div className="col-span-12 md:col-span-6">
                            <span className="text-[11px] text-gray-500">Código Proc</span>
                            <p className="font-medium text-gray-900">{item.procedure_code || 'N/A'}</p>
                          </div>
                          <div className="col-span-12 md:col-span-6">
                            <span className="text-[11px] text-gray-500">CID Principal</span>
                            <p className="font-medium text-gray-900">{item.main_cid || 'N/A'}</p>
                          </div>

                          {/* Linha 4: Admissão, Alta, Competência, Especialidade, Modalidade */}
                          <div className="col-span-6 md:col-span-3">
                            <span className="text-[11px] text-gray-500">Admissão</span>
                            <p className="font-medium text-gray-900">{formatDate(item.admission_date)}</p>
                          </div>
                          {item.discharge_date && (
                            <div className="col-span-6 md:col-span-3">
                              <span className="text-[11px] text-gray-500">Alta</span>
                              <p className="font-medium text-gray-900">{formatDate(item.discharge_date)}</p>
                            </div>
                          )}
                          <div className="col-span-6 md:col-span-3">
                            <span className="text-[11px] text-gray-500">Competência</span>
                            <p className="font-semibold text-blue-700">{formatCompetencia(item.competencia)}</p>
                          </div>
                          {item.specialty && (
                            <div className="col-span-6 md:col-span-3">
                              <span className="text-[11px] text-gray-500">Especialidade</span>
                              <p className="font-medium text-gray-900">{item.specialty}</p>
                            </div>
                          )}
                          {item.care_modality && (
                            <div className="col-span-6 md:col-span-3">
                              <span className="text-[11px] text-gray-500">Modalidade</span>
                              <p className="font-medium text-gray-900">{item.care_modality}</p>
                            </div>
                          )}

                          {/* Linha 5: Hospital, Médico, CBO */}
                          {item.hospitals?.name && (
                            <div className="col-span-12 xl:col-span-12">
                              <span className="text-[11px] text-gray-500">Hospital</span>
                              <p className="font-medium text-gray-900">{item.hospitals?.name}</p>
                            </div>
                          )}
                          {(doctorsCache.get(item.cns_responsavel || '') || item.requesting_physician || proceduresData[item.id]?.[0]?.professional_name) && (
                            <div className="col-span-12 md:col-span-8">
                              <span className="text-[11px] text-gray-500">Médico</span>
                              <p className="font-medium text-gray-900">{doctorsCache.get(item.cns_responsavel || '') || item.requesting_physician || proceduresData[item.id]?.[0]?.professional_name}</p>
                            </div>
                          )}
                          {item.professional_cbo && (
                            <div className="col-span-6 md:col-span-4">
                              <span className="text-[11px] text-gray-500">CBO</span>
                              <p className="font-medium text-gray-900">{item.professional_cbo}</p>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Matches SIGTAP removido do card do paciente */}

                      {/* NOVO: Gerenciamento Inline de Procedimentos - Compacto */}
                      {proceduresData[item.id] && proceduresData[item.id].length > 0 && (
                        <div className="bg-white rounded-lg border border-slate-200 p-3">
                          <div className="flex items-center justify-between mb-3">
                            <div className="flex items-center space-x-2">
                              <div className="w-6 h-6 bg-slate-100 rounded-lg flex items-center justify-center">
                                <FileText className="w-3 h-3 text-slate-600" />
                              </div>
                              <h4 className="font-semibold text-slate-900 text-sm">
                                Procedimentos ({proceduresData[item.id].length})
                              </h4>
                            </div>
                            {loadingProcedures[item.id] && (
                              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-500"></div>
                            )}
                          </div>
                          
                          {/* 🎯 Resumo Financeiro Compacto */}
                          {aihTotalValues[item.id] !== undefined && (
                            <div className="mb-3 p-2 bg-slate-50 rounded-lg border border-slate-100">
                              <div className="flex items-center space-x-1 mb-1">
                                <DollarSign className="w-3 h-3 text-slate-600" />
                                <span className="text-xs font-medium text-slate-800">Resumo Financeiro</span>
                              </div>
                              <div className="flex items-center justify-between text-xs">
                                {(() => {
                                  const approved = (proceduresData[item.id] || []).filter(
                                    p => (p.match_status === 'matched' || p.match_status === 'manual') &&
                                         filterCalculableProcedures({ cbo: p.professional_cbo, procedure_code: p.procedure_code })
                                  );
                                  const approvedValue = approved.reduce((sum, p) => {
                                    const qty = p.quantity ?? 1;
                                    if (p.value_charged && p.value_charged > 0) {
                                      return sum + p.value_charged;
                                    }
                                    const unit = p.sigtap_procedures?.value_hosp_total || 0;
                                    return sum + unit * qty;
                                  }, 0);
                                  
                                  return (
                                    <>
                                      <div className="flex items-center space-x-2">
                                        <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                                        <span className="text-gray-600">{approved.length} aprovados</span>
                                        <span className="font-semibold text-green-700">{formatCurrency(approvedValue)}</span>
                                      </div>
                                      <div className="flex items-center space-x-2">
                                        <span className="text-gray-500">Total:</span>
                                        {(() => {
                                          // Valor COM anestesistas: inclui todos os procedimentos aprovados/manual/matched
                                          const allActive = (proceduresData[item.id] || []).filter(
                                            p => (p.match_status === 'matched' || p.match_status === 'manual')
                                          );
                                          const totalWithAnest = allActive.reduce((sum: number, p: any) => {
                                            const charged = p.value_charged && p.value_charged > 0 ? p.value_charged : null; // centavos
                                            if (charged !== null) return sum + charged;
                                            const unitReais = p.sigtap_procedures?.value_hosp_total || 0; // reais
                                            const qty = p.quantity ?? 1;
                                            return sum + Math.round(unitReais * qty * 100); // centavos
                                          }, 0);

                                          // Valor SEM anestesistas (base aprovado acima), calculado em centavos
                                          const approvedCent = (approved || []).reduce((sum: number, p: any) => {
                                            const charged = p.value_charged && p.value_charged > 0 ? p.value_charged : null; // centavos
                                            if (charged !== null) return sum + charged;
                                            const unitReais = p.sigtap_procedures?.value_hosp_total || 0; // reais
                                            const qty = p.quantity ?? 1;
                                            return sum + Math.round(unitReais * qty * 100);
                                          }, 0);

                                          const delta = Math.max(0, totalWithAnest - approvedCent);

                                          return (
                                            <>
                                              <span className="font-bold text-blue-800">{formatCurrency(totalWithAnest)}</span>
                                              {delta > 0 && (
                                                <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 border border-emerald-200">
                                                  Inclui anestesistas: +{formatCurrency(delta)}
                                                </span>
                                              )}
                                            </>
                                          );
                                        })()}
                                      </div>
                                    </>
                                  );
                                })()}
                              </div>
                            </div>
                          )}
                          
                          <div className="space-y-2">
                            {(() => {
                              const aihHasExcluded = hasAnyExcludedCodeInProcedures(proceduresData[item.id]);
                              const careCharacter = (item as any)?.care_character;
                              return proceduresData[item.id].map((procedure) => (
                                <ProcedureInlineCard
                                  key={`${procedure.aih_id}_${procedure.procedure_sequence}`}
                                  procedure={procedure}
                                  isReadOnly={!canManageProcedures()}
                                  onDelete={(proc) => handleDeleteProcedure(item.id, proc)}
                                  aihCareCharacter={careCharacter}
                                  aihHasExcluded={aihHasExcluded}
                                  showOperaParanaBadges={false}
                                />
                              ));
                            })()}
                          </div>
                        </div>
                      )}

                      {/* Ações Administrativas - Compactas */}
                      {(user?.role === 'admin' || user?.role === 'director' || user?.role === 'coordinator') && (
                        <div className="bg-white rounded-lg border border-red-200 p-3">
                          <div className="flex items-center space-x-2 mb-2">
                            <div className="w-6 h-6 bg-red-100 rounded-lg flex items-center justify-center">
                              <Trash2 className="w-3 h-3 text-red-600" />
                            </div>
                            <h4 className="font-semibold text-red-900 text-sm">Ações de Exclusão</h4>
                          </div>
                          <div className="flex flex-wrap gap-2">
                            {(() => {
                              const userRole = user?.role as string;
                              const hasPermission = (['user', 'operator', 'coordinator', 'director', 'admin'] as const).includes(userRole as any);
                              
                              return hasPermission && (
                                <>
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => handleDeleteRequest('aih', item.id, item.aih_number)}
                                    className="flex items-center space-x-1 text-red-600 hover:text-red-700 border-red-200 hover:border-red-300 hover:bg-red-50 text-xs px-3 py-1"
                                  >
                                    <Trash2 className="w-3 h-3" />
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
                                    className="flex items-center space-x-1 text-red-800 hover:text-red-900 border-red-300 hover:border-red-400 bg-red-100 hover:bg-red-200 text-xs px-3 py-1"
                                  >
                                    <AlertTriangle className="w-3 h-3" />
                                    <span>Exclusão Completa</span>
                                  </Button>
                                </>
                              );
                            })()}
                          </div>
                          <p className="text-xs text-red-600 mt-2">
                            💡 <strong>Dica:</strong> Para excluir procedimentos individuais, use os botões nos cards dos procedimentos acima.
                          </p>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Rodapé: dados de processamento no canto inferior direito */}
                  <div className="px-5 py-2 border-t border-gray-100">
                    <div className="flex justify-end">
                      <div className="text-xs text-slate-600 text-right">
                        <div className="flex items-center gap-1 justify-end">
                          <User className="w-3 h-3" />
                          <span>{item.processed_by_name || 'Sistema'}</span>
                        </div>
                        <div className="flex items-center gap-1 justify-end">
                          <Calendar className="w-3 h-3" />
                          <span>{item.processed_at_formatted}</span>
                        </div>
                      </div>
                    </div>
                  </div>
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



      {/* Dialog de Confirmação de Deleção - ATUALIZADO */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center space-x-2">
              <Trash2 className="w-5 h-5 text-red-600" />
              <span>Confirmar Exclusão</span>
            </AlertDialogTitle>
            <AlertDialogDescription className="space-y-3">
              {itemToDelete?.type === 'patient' ? (
                <div>
                  <p>Tem certeza que deseja deletar o paciente <strong>"{itemToDelete?.name}"</strong>?</p>
                  <div className="mt-2 p-3 bg-red-50 border border-red-200 rounded">
                    <p className="text-red-800 text-sm font-medium">⚠️ Esta ação irá excluir:</p>
                    <ul className="text-red-700 text-sm mt-1 space-y-1">
                      <li>• O paciente e seus dados pessoais</li>
                      <li>• Todas as AIHs do paciente</li>
                      <li>• Todos os procedimentos relacionados</li>
                      <li>• Todos os matches encontrados</li>
                    </ul>
                  </div>
                </div>
              ) : (
                <div>
                  <p>Tem certeza que deseja deletar a AIH <strong>"{itemToDelete?.name}"</strong>?</p>
                  <div className="mt-2 p-3 bg-red-50 border border-red-200 rounded">
                    <p className="text-red-800 text-sm font-medium">🗑️ Esta ação irá excluir COMPLETAMENTE:</p>
                    <ul className="text-red-700 text-sm mt-1 space-y-1">
                      <li>• A AIH e seus dados</li>
                      <li>• <strong>Todos os procedimentos</strong> da AIH (procedure_records)</li>
                      <li>• Todos os matches encontrados (aih_matches)</li>
                      <li>• O paciente (se não tiver outras AIHs)</li>
                    </ul>
                  </div>
                </div>
              )}
              <p className="text-gray-600 text-sm font-medium">
                Esta ação não pode ser desfeita.
              </p>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteConfirm} className="bg-red-600 hover:bg-red-700">
              <Trash2 className="w-4 h-4 mr-2" />
              Excluir Completamente
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

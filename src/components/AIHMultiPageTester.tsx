import React, { useState, useEffect, useRef } from 'react';
import { Button } from './ui/button';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Badge } from './ui/badge';
import { Alert, AlertDescription } from './ui/alert';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from './ui/table';
import DoctorDisplay from './ui/doctor-display';
import { 
  Upload, 
  FileText, 
  CheckCircle, 
  AlertTriangle, 
  Clock,
  Download,
  Zap,
  Target,
  Layers,
  User,
  Calendar,
  CreditCard,
  MapPin,
  ChevronDown,
  ChevronRight,
  Edit,
  Check,
  X,
  Info,
  DollarSign,
  Stethoscope,
  Database,
  Settings,
  Save,
  Trash2
} from 'lucide-react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx'
import { supabase } from '../lib/supabase'
import { useToast } from '../hooks/use-toast';
import { AIHCompleteProcessor } from '../utils/aihCompleteProcessor';
import { ProcedureMatchingService } from '../services/procedureMatchingService';
import { useSigtapContext } from '../contexts/SigtapContext';
import { useAuth } from '../contexts/AuthContext';
import { AIHPersistenceService } from '../services/aihPersistenceService';
import { AIHCompleteProcessingResult, AIHComplete, ProcedureAIH, AIH } from '../types';
import { 
  hasSpecialRule, 
  getSpecialRule, 
  applySpecialCalculation, 
  hasSpecialProceduresInList,
  logSpecialRules,
  debugSpecialRuleDetection,
  isInstrument04Procedure,     // ✅ NOVA função para Instrumento 04
  debugInstrument04Detection,  // ✅ NOVA função de debug
  classifyProcedures,          // ✅ NOVA função de classificação
  calculateMedicalPayment,      // ✅ NOVA função para calcular pagamento médico
  isAlwaysFullPercentProcedure  // ✅ Procedimentos 100% sempre
} from '../config/susCalculationRules';

import { 
  shouldCalculateAnesthetistProcedure, 
  getAnesthetistProcedureType,
  getCalculableProcedures
} from '../utils/anesthetistLogic';

import { CareCharacterUtils } from '../config/careCharacterCodes';
import { 
  formatParticipationCode, 
  getParticipationBadge, 
  requiresPayment, 
  isValidParticipationCode 
} from '../config/participationCodes';
// ✅ REMOVIDO: import { filterOutAnesthesia } from '../utils/aihCompleteProcessor';

// Declaração de tipo para jsPDF com autoTable
declare module 'jspdf' {
  interface jsPDF {
    lastAutoTable: {
      finalY: number;
    };
  }
}

// ✅ FUNÇÕES UTILITÁRIAS PARA MANIPULAÇÃO DE DATAS SEM TIMEZONE
/**
 * Formata data ISO (YYYY-MM-DD) para formato brasileiro (DD/MM/YYYY)
 * Sem usar new Date() para evitar problemas de timezone
 */
const formatDateBR = (isoDate: string | undefined | null): string => {
  if (!isoDate) return 'N/A';
  
  const match = String(isoDate).match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (match) {
    const [, year, month, day] = match;
    return `${day}/${month}/${year}`;
  }
  
  return String(isoDate);
};

/**
 * Extrai ano e mês (YYYY-MM) de data ISO sem timezone
 * Usado para cálculo de competência SUS
 */
const extractYearMonth = (isoDate: string | undefined | null): string => {
  if (!isoDate) return '';
  
  const match = String(isoDate).match(/^(\d{4})-(\d{2})-\d{2}/);
  if (match) {
    const [, year, month] = match;
    return `${year}-${month}`;
  }
  
  return '';
};

// Componente para exibir participação profissional
const ParticipationDisplay = ({ code }: { code: string }) => {
  if (!code) {
    return <span className="text-gray-400 text-sm">Não informado</span>;
  }

  const isValid = isValidParticipationCode(code);
  const badge = getParticipationBadge(code);
  const formatted = formatParticipationCode(code);
  const needsPayment = requiresPayment(code);

  if (!isValid) {
    return (
      <div className="flex items-center gap-2">
        <Badge variant="outline" className="bg-red-50 border-red-200 text-red-700">
          ❓ {code}
        </Badge>
        <span className="text-xs text-red-600">Código inválido</span>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <Badge 
        variant="outline" 
        className={`
          ${badge.color === 'blue' ? 'bg-blue-50 border-blue-200 text-blue-700' : ''}
          ${badge.color === 'green' ? 'bg-green-50 border-green-200 text-green-700' : ''}
          ${badge.color === 'purple' ? 'bg-purple-50 border-purple-200 text-purple-700' : ''}
          ${badge.color === 'orange' ? 'bg-orange-50 border-orange-200 text-orange-700' : ''}
          ${badge.color === 'gray' ? 'bg-gray-50 border-gray-200 text-gray-700' : ''}
        `}
      >
        {badge.icon} {code}
      </Badge>
      <div className="flex flex-col">
        <span className="text-sm font-medium">{formatted.split(' - ')[1]}</span>
        <span className={`text-xs ${needsPayment ? 'text-green-600' : 'text-gray-500'}`}>
          {needsPayment ? '💰 Requer pagamento' : '📋 Sem pagamento'}
        </span>
      </div>
    </div>
  );
};

// Componente organizado para visualizar AIH completa
const AIHOrganizedView = ({ aihCompleta, onUpdateAIH }: { aihCompleta: AIHComplete; onUpdateAIH: (aih: AIHComplete) => void }) => {
  const [expandedProcedures, setExpandedProcedures] = useState<Set<number>>(new Set());
  const [editingValues, setEditingValues] = useState<Set<number>>(new Set());
  const [tempValues, setTempValues] = useState<{[key: number]: {
    valorAmb: number;
    valorHosp: number;
    valorProf: number;
    porcentagem: number;
  }}>({});
  const [expandedSections, setExpandedSections] = useState<{endereco: boolean}>({endereco: false}); // NOVO ESTADO
  const { toast } = useToast();
  const { user } = useAuth();
  // 🆕 Controle explícito do modo de competência (alta SUS x manual)
  const [competenciaMode, setCompetenciaMode] = useState<'alta' | 'manual'>(() => {
    try {
      const ref = (aihCompleta as any)?.dataFim || (aihCompleta as any)?.dataInicio;
      // ✅ CORREÇÃO: Usar extractYearMonth sem timezone
      const altaYM = extractYearMonth(ref);
      const comp = (aihCompleta as any)?.competencia as string | undefined;
      const compYM = comp ? comp.slice(0, 7) : '';
      return (!!altaYM && (!compYM || compYM === altaYM)) ? 'alta' : 'manual';
    } catch { return 'alta'; }
  });
  // Sincronizar quando datas/competência mudarem externamente
  useEffect(() => {
    try {
      const ref = (aihCompleta as any)?.dataFim || (aihCompleta as any)?.dataInicio;
      // ✅ CORREÇÃO: Usar extractYearMonth sem timezone
      const altaYM = extractYearMonth(ref);
      const comp = (aihCompleta as any)?.competencia as string | undefined;
      const compYM = comp ? comp.slice(0, 7) : '';
      const shouldAlta = (!!altaYM && (!compYM || compYM === altaYM));
      setCompetenciaMode(shouldAlta ? 'alta' : 'manual');
      // 🆕 Se o modo efetivo for 'alta' e ainda não temos competência definida, definir automaticamente
      if (shouldAlta && altaYM && (!comp || compYM !== altaYM)) {
        onUpdateAIH({ ...(aihCompleta as any), competencia: `${altaYM}-01` } as any);
      }
    } catch {}
  }, [(aihCompleta as any)?.dataFim, (aihCompleta as any)?.dataInicio, (aihCompleta as any)?.competencia]);

  // ✅ Normalização segura do Caráter de Atendimento (UI) e fallback de Especialidade
  const normalizeCareCharacterUI = (raw?: any): '1' | '2' => {
    try {
      const v = String(raw ?? '').trim().toLowerCase();
      if (v === '2' || v === '02' || v === 'urgencia' || v === 'urgência' || v.includes('urg') || v.includes('emerg')) return '2';
      if (v === '1' || v === '01' || v === 'eletivo') return '1';
      return '1';
    } catch {
      return '1';
    }
  };

  const deriveSpecialtyFallback = (careCode: '1'|'2', principal: string | undefined): string => {
    try {
      if (careCode !== '2') return '01 - Cirúrgico';
      const p = (principal || '').toString().toLowerCase();
      const isCesarean = /\bparto\b.*\bcesa/.test(p) || /\bces(ar|área|ariana|ariano)/.test(p) || p.includes('cesarea') || p.includes('cesárea');
      return isCesarean ? '01 - Cirúrgico' : '03 - Clínico';
    } catch {
      return '01 - Cirúrgico';
    }
  };

  // Aplicar defaults organizados para caracterAtendimento e especialidade (antes de salvar)
  useEffect(() => {
    try {
      const currentCare = normalizeCareCharacterUI((aihCompleta as any)?.caracterAtendimento);
      const needsCareFix = !(aihCompleta as any)?.caracterAtendimento || !CareCharacterUtils.isValidCode((aihCompleta as any)?.caracterAtendimento);
      const currentSpec = (aihCompleta as any)?.especialidade as string | undefined;
      const needsSpecFix = !currentSpec || currentSpec.trim() === '';
      if (!needsCareFix && !needsSpecFix) return;

      const fixedCare = needsCareFix ? currentCare : ((aihCompleta as any)?.caracterAtendimento as '1'|'2');
      const fixedSpec = needsSpecFix ? deriveSpecialtyFallback(fixedCare, (aihCompleta as any)?.procedimentoPrincipal) : currentSpec!;

      onUpdateAIH({
        ...(aihCompleta as any),
        caracterAtendimento: fixedCare,
        especialidade: fixedSpec
      } as any);
    } catch {}
  // Dependências que podem afetar os defaults
  }, [
    (aihCompleta as any)?.caracterAtendimento,
    (aihCompleta as any)?.especialidade,
    (aihCompleta as any)?.procedimentoPrincipal
  ]);
  
  // Definir hospital atual para busca de médicos
  const currentHospital = { id: user?.hospital_id || '68bf9b1a-9d0b-423b-9bb3-3c02017b1d7b', name: 'Hospital de Desenvolvimento' };

  // Aplicar lógica de porcentagem SUS quando AIH é carregada
  useEffect(() => {
    if (aihCompleta && aihCompleta.procedimentos.length > 0) {
      // Verificar se já foi aplicada a lógica de porcentagem
      const needsPercentageSetup = aihCompleta.procedimentos.some(proc => 
        proc.sigtapProcedure && !proc.porcentagemSUS
      );
      
      if (needsPercentageSetup) {
        console.log('🔧 Aplicando lógica de porcentagem SUS automaticamente...');
        const updatedAIH = calculateTotalsWithPercentage(aihCompleta.procedimentos);
        onUpdateAIH(updatedAIH);
      }
    }
  }, [aihCompleta?.procedimentos.length]); // Só executa quando o número de procedimentos muda

  const toggleProcedureExpansion = (sequencia: number) => {
    const newExpanded = new Set(expandedProcedures);
    if (newExpanded.has(sequencia)) {
      newExpanded.delete(sequencia);
    } else {
      newExpanded.add(sequencia);
    }
    setExpandedProcedures(newExpanded);
  };

  const handleProcedureAction = (procedure: ProcedureAIH, action: 'approve' | 'reject') => {
    const updatedProcedimentos = aihCompleta.procedimentos.map(proc =>
      proc.sequencia === procedure.sequencia 
        ? { 
            ...proc, 
            matchStatus: action === 'approve' ? 'matched' as const : 'rejected' as const,
            aprovado: action === 'approve',
            dataRevisao: new Date().toISOString() 
          }
        : proc
    );

    const updatedAIH = calculateTotalsWithPercentage(updatedProcedimentos);
    onUpdateAIH(updatedAIH);

    toast({
      title: action === 'approve' ? "✅ Procedimento aprovado" : "❌ Procedimento rejeitado",
      description: `${procedure.procedimento} foi ${action === 'approve' ? 'aprovado' : 'rejeitado'}`
    });
  };

  // Função para remover procedimento (temporariamente)
  const handleRemoveProcedure = (sequencia: number) => {
    const updatedProcedimentos = aihCompleta.procedimentos.map(proc =>
      proc.sequencia === sequencia 
        ? { ...proc, matchStatus: 'rejected' as const, aprovado: false }
        : proc
    );

    const updatedAIH = calculateTotalsWithPercentage(updatedProcedimentos);
    onUpdateAIH(updatedAIH);

    toast({
      title: "⚠️ Procedimento removido",
      description: `Procedimento ${sequencia} foi marcado como rejeitado`,
      variant: "destructive"
    });
  };
  
  // Função para excluir procedimento (permanentemente) - SEM CONFIRMAÇÃO
  const handleDeleteProcedure = (sequencia: number) => {
    const procedureToDelete = aihCompleta.procedimentos.find(p => p.sequencia === sequencia);
    
    if (!procedureToDelete) return;
    
    // ✅ MUDANÇA: Exclusão imediata sem pop-up de confirmação
    // Especialmente útil para anestesistas que devem ser removidos rapidamente
    
    const updatedProcedimentos = aihCompleta.procedimentos.filter(proc => proc.sequencia !== sequencia);
    
    // Resequenciar procedimentos
    const resequencedProcedimentos = updatedProcedimentos.map((proc, index) => ({
      ...proc,
      sequencia: index + 1
    }));

    const updatedAIH = calculateTotalsWithPercentage(resequencedProcedimentos);
    onUpdateAIH(updatedAIH);

    // 🎯 TOAST INFORMATIVO diferenciado para anestesistas vs procedimentos normais
    const isAnesthesia = procedureToDelete.isAnesthesiaProcedure;

    toast({
      title: isAnesthesia ? "🚫 Anestesista removido" : "🗑️ Procedimento excluído",
      description: isAnesthesia 
        ? `Anestesista ${procedureToDelete.procedimento} removido da tela`
        : `Procedimento ${procedureToDelete.procedimento} foi excluído permanentemente`,
      variant: "destructive"
    });
  };

  // 🆕 FUNÇÃO CORRIGIDA: Gerenciar alteração de quantidade
  const handleQuantityChange = (sequencia: number, newQuantity: number) => {
    if (newQuantity < 1 || newQuantity > 99 || isNaN(newQuantity)) return;
    
    console.log(`🔄 ALTERANDO QUANTIDADE - Sequência: ${sequencia}, Nova Quantidade: ${newQuantity}`);
    
    const updatedAIH = {
      ...aihCompleta,
      procedimentos: aihCompleta.procedimentos.map(proc => {
        if (proc.sequencia === sequencia) {
          // ✅ USAR SEMPRE O VALOR UNITÁRIO JÁ ARMAZENADO (SH + SP de 1 unidade)
          const valorUnitario = proc.valorUnitario || 0;
          const valorUnitarioSH = proc.valorCalculadoSH ? proc.valorCalculadoSH / (proc.quantity || 1) : 0;
          const valorUnitarioSP = proc.valorCalculadoSP ? proc.valorCalculadoSP / (proc.quantity || 1) : 0;
          
          const updatedProc = {
            ...proc,
            quantity: newQuantity,
            valorUnitario: valorUnitario,
            valorCalculado: valorUnitario * newQuantity,
            // ✅ RECALCULAR SH E SP SEPARADAMENTE
            valorCalculadoSH: valorUnitarioSH * newQuantity,
            valorCalculadoSP: valorUnitarioSP * newQuantity
          };
          console.log(`✅ PROCEDIMENTO ATUALIZADO - Seq: ${sequencia}, Quantity: ${updatedProc.quantity}`);
          return updatedProc;
        }
        return proc;
      })
    };
    
    // Recalcular valores totais da AIH
    const recalculatedAIH = calculateTotalsWithQuantity(updatedAIH);
    onUpdateAIH(recalculatedAIH);
    
    toast({
      title: "📊 Quantidade alterada",
      description: `Procedimento ${sequencia}: ${newQuantity}x = ${(updatedAIH.procedimentos.find(p => p.sequencia === sequencia)?.valorCalculado || 0).toLocaleString('pt-BR', {style: 'currency', currency: 'BRL'})}`,
    });
  };

  // 🆕 FUNÇÃO SIMPLIFICADA: Calcular totais considerando quantidade (valores já corretos)
  const calculateTotalsWithQuantity = (aih: AIHComplete): AIHComplete => {
    const ativos = aih.procedimentos.filter(p => p.aceitar !== false);
    const calculaveis = getCalculableProcedures(
      ativos.map((p: any, idx: number) => ({
        ...p,
        __idx: idx,
        procedure_code: p.procedimento,
        cbo: p.cbo,
        professional_cbo: p.cbo,
        aih_id: '__single__',
        sequence: p.sequencia
      }))
    ) as any[];

    const allowedIdx = new Set<number>(calculaveis.map(p => Number(p.__idx)).filter(n => Number.isFinite(n)));

    const valorTotal = ativos.reduce((sum, proc: any, idx: number) => {
      if (!allowedIdx.has(idx)) return sum;
      return sum + (proc.valorCalculado || 0);
    }, 0);
    
    return {
      ...aih,
      valorTotalCalculado: valorTotal,
      procedimentosAprovados: aih.procedimentos.filter(p => p.aceitar !== false).length,
      procedimentosRejeitados: aih.procedimentos.filter(p => p.aceitar === false).length
    };
  };

  // ✅ FUNÇÃO ATUALIZADA: Calcular totais aplicando lógica SUS (incluindo Instrumento 04)
  const calculateTotalsWithPercentage = (procedimentos: ProcedureAIH[]): AIHComplete => {
    // 🎯 DETECTAR PROCEDIMENTO PRINCIPAL E SUA REGRA (se houver)
    const procedimentoPrincipal = aihCompleta.procedimentoPrincipal || '';
    const regraEspecialPrincipal = getSpecialRule(procedimentoPrincipal);
    const temRegraEspecialGeral = Boolean(regraEspecialPrincipal);
    
    console.log('🔄 ANÁLISE DA AIH (FATURAMENTO HOSPITALAR - APENAS SH + SP):');
    console.log('📋 Procedimento Principal:', procedimentoPrincipal);
    console.log('🏥 Regra Especial Detectada:', regraEspecialPrincipal ? regraEspecialPrincipal.procedureName : 'Nenhuma');
    console.log('⚠️  IMPORTANTE: SA (Serviços Ambulatoriais) NÃO É FATURADO EM AIH');
    
    const calculaveis = getCalculableProcedures(
      procedimentos.map((p: any, idx: number) => ({
        ...p,
        __idx: idx,
        procedure_code: p.procedimento,
        cbo: p.cbo,
        professional_cbo: p.cbo,
        aih_id: '__single__',
        sequence: p.sequencia
      }))
    ) as any[];
    const allowedIdx = new Set<number>(calculaveis.map(p => Number(p.__idx)).filter(n => Number.isFinite(n)));

    // 🚫 PRIMEIRO: SEPARAR ANESTESISTAS (NÃO RECEBEM NENHUMA REGRA)
    const anestesistas: ProcedureAIH[] = [];
    const procedimentosParaRegras: ProcedureAIH[] = [];
    
    procedimentos.forEach((proc: any, idx: number) => {
      if (!allowedIdx.has(idx)) {
        anestesistas.push({
          ...proc,
          isAnesthesiaProcedure: true,
          porcentagemSUS: 0,
          valorCalculado: 0,
          valorOriginal: 0,
          valorCalculadoSH: 0,
          valorCalculadoSP: 0,
          regraEspecial: '🚫 Duplicidade 04 - Excluído do cálculo'
        });
        return;
      }
      if (proc.isAnesthesiaProcedure) {
        // ✅ ANESTESISTAS: EXTRAIR COM VALORES NORMAIS PARA CONTROLE MANUAL
        const valorTotalSigtap = proc.sigtapProcedure?.valueHosp || 0;
        const valorSP = proc.sigtapProcedure?.valueProf || 0;
        const valorSH = valorTotalSigtap - valorSP;
        const valorTotal = valorSH + valorSP;
        
        anestesistas.push({
          ...proc,
          porcentagemSUS: 100, // Valor normal para visualização
          valorCalculado: valorTotal * (proc.quantity || 1), // Valor real calculado
          valorOriginal: valorTotal,  // Valor original do SIGTAP
          valorCalculadoSH: valorSH * (proc.quantity || 1),
          valorCalculadoSP: valorSP * (proc.quantity || 1),
          isAnesthesiaProcedure: true, // Manter marcação visual
          regraEspecial: '🚫 Anestesia - Controle manual (pode ser removido)'
        });
      } else {
        // ✅ PROCEDIMENTOS NORMAIS: APLICAR REGRAS
        procedimentosParaRegras.push(proc);
      }
    });
    
    console.log(`🚫 ANESTESISTAS EXCLUÍDOS: ${anestesistas.length} procedimentos`);
    console.log(`✅ PROCEDIMENTOS PARA REGRAS: ${procedimentosParaRegras.length} procedimentos`);
    
    // ✅ SEPARAR PROCEDIMENTOS NORMAIS POR TIPO (SEM ANESTESISTAS)
    const procedimentosInstrumento04: ProcedureAIH[] = [];
    const procedimentosNormais: ProcedureAIH[] = [];
    const procedimentosComRegrasEspeciais: ProcedureAIH[] = [];

    procedimentosParaRegras.forEach(proc => {
      if (proc.sigtapProcedure) {
        // 🎯 VERIFICAR INSTRUMENTO 04 - PRIORIDADE MÁXIMA
        if (isInstrument04Procedure(proc.sigtapProcedure.registrationInstrument)) {
          procedimentosInstrumento04.push(proc);
        }
        // 🏥 VERIFICAR SE APLICA REGRA ESPECIAL (baseado no procedimento principal)
        else if (temRegraEspecialGeral) {
          procedimentosComRegrasEspeciais.push(proc);
        }
        // 📊 PROCEDIMENTOS NORMAIS
        else {
          procedimentosNormais.push(proc);
        }
      } else {
        // Sem SIGTAP match, tratado como normal (ou regra especial se aplicável)
        if (temRegraEspecialGeral) {
          procedimentosComRegrasEspeciais.push(proc);
        } else {
          procedimentosNormais.push(proc);
        }
      }
    });

    console.log('🔄 CLASSIFICAÇÃO DOS PROCEDIMENTOS (SEM ANESTESISTAS):');
    console.log('🎯 Instrumento 04:', procedimentosInstrumento04.map(p => `${p.sequencia}º - ${p.procedimento}`));
    console.log('🏥 Regras Especiais:', procedimentosComRegrasEspeciais.map(p => `${p.sequencia}º - ${p.procedimento}`));
    console.log('📊 Procedimentos Normais:', procedimentosNormais.map(p => `${p.sequencia}º - ${p.procedimento}`));

    // ✅ PROCESSAR CADA TIPO DE PROCEDIMENTO (EXCETO ANESTESISTAS)
    const procedimentosComPercentagem = procedimentosParaRegras.map((proc, index) => {
      if (!proc.sigtapProcedure) return proc;

      // 🎯 INSTRUMENTO 04 - SEMPRE 100%
      if (isInstrument04Procedure(proc.sigtapProcedure.registrationInstrument)) {
        debugInstrument04Detection(proc.sigtapProcedure.registrationInstrument);
        
        const valorTotalSigtap = proc.sigtapProcedure.valueHosp; // Total extraído
        const valorSP = proc.sigtapProcedure.valueProf;          // SP
        const valorSH = valorTotalSigtap - valorSP;              // SH = Total - SP
        const valorSA = proc.sigtapProcedure.valueAmb;           // SA (informativo apenas)
        
        console.log(`🎯 INSTRUMENTO 04 - ${proc.procedimento} (${proc.sequencia}º): SEMPRE 100%`);
        console.log(`   💰 FATURAMENTO: SH=${valorSH.toFixed(2)} + SP=${valorSP.toFixed(2)} = ${(valorSH + valorSP).toFixed(2)}`);
        console.log(`   ℹ️  SA (não faturado): ${valorSA.toFixed(2)}`);
        
        return {
          ...proc,
          porcentagemSUS: 100, // Sempre 100% para Instrumento 04
          valorCalculado: (valorSH + valorSP) * (proc.quantity || 1), // ✅ CORREÇÃO: SH + SP × quantidade
          valorOriginal: valorSH + valorSP,  // ✅ CORREÇÃO: SH + SP apenas (sem SA)
          valorUnitario: valorSH + valorSP,  // 🆕 VALOR UNITÁRIO (SH + SP de 1 unidade)
          // Campos específicos para Instrumento 04
          isInstrument04: true,
          instrument04Rule: 'Instrumento 04 - AIH (Proc. Especial) - Sempre 100%',
          valorCalculadoSH: valorSH * (proc.quantity || 1),
          valorCalculadoSP: valorSP * (proc.quantity || 1),
          valorCalculadoSA: valorSA, // Mantido para exibição informativa
          isSpecialRule: true, // Marcar como regra especial para interface
          regraEspecial: 'Instrumento 04 - AIH (Proc. Especial)'
        };
      }

      // 🏥 REGRAS ESPECIAIS BASEADAS NO PROCEDIMENTO PRINCIPAL
      if (temRegraEspecialGeral && regraEspecialPrincipal) {
        const valorTotalSigtap = proc.sigtapProcedure.valueHosp; // Total extraído
        const valorSP = proc.sigtapProcedure.valueProf;          // SP
        const valorSH = valorTotalSigtap - valorSP;              // SH = Total - SP
        const valorSA = proc.sigtapProcedure.valueAmb;           // SA (informativo apenas)
        
        // ✅ CALCULAR POSIÇÃO SEQUENCIAL ENTRE TODOS OS PROCEDIMENTOS COM REGRA ESPECIAL
        const procedimentosOrdenados = procedimentosComRegrasEspeciais
          .sort((a, b) => a.sequencia - b.sequencia);
        
        const posicaoNaRegra = procedimentosOrdenados.findIndex(p => p.sequencia === proc.sequencia) + 1;
        
        // ✅ APLICAR A REGRA DO PROCEDIMENTO PRINCIPAL
        const hospPercentageIndex = posicaoNaRegra - 1; // Array é 0-based
        const hospPercentage = regraEspecialPrincipal.rule.hospitalPercentages[hospPercentageIndex] || 
                              regraEspecialPrincipal.rule.hospitalPercentages[regraEspecialPrincipal.rule.hospitalPercentages.length - 1];

        const valorSHCalculado = (valorSH * hospPercentage) / 100;
        const valorSPCalculado = valorSP; // SP sempre 100%
        const valorSACalculado = valorSA; // SA informativo (não faturado)
        const valorTotalCalculado = valorSHCalculado + valorSPCalculado; // ✅ CORREÇÃO: SH + SP apenas
        
        console.log(`🏥 REGRA ESPECIAL - ${proc.procedimento} (${proc.sequencia}º na AIH, ${posicaoNaRegra}º na regra ${regraEspecialPrincipal.procedureName}): SH=${hospPercentage}%, SP=100%`);
        console.log(`   💰 FATURAMENTO: SH=${valorSHCalculado.toFixed(2)} + SP=${valorSPCalculado.toFixed(2)} = ${valorTotalCalculado.toFixed(2)}`);
        console.log(`   ℹ️  SA (não faturado): ${valorSACalculado.toFixed(2)}`);
        
        return {
          ...proc,
          porcentagemSUS: hospPercentage, // Para compatibilidade com interface
          valorCalculado: valorTotalCalculado * (proc.quantity || 1), // ✅ CORREÇÃO: SH + SP × quantidade
          valorOriginal: valorSH + valorSP,           // ✅ CORREÇÃO: SH + SP apenas
          valorUnitario: valorTotalCalculado,         // 🆕 VALOR UNITÁRIO (SH + SP de 1 unidade)
          // Campos adicionais para cirurgias especiais
          valorCalculadoSH: valorSHCalculado * (proc.quantity || 1),
          valorCalculadoSP: valorSPCalculado * (proc.quantity || 1),
          valorCalculadoSA: valorSACalculado, // Mantido para exibição informativa
          regraEspecial: `${regraEspecialPrincipal.rule.type} - ${regraEspecialPrincipal.procedureName}`,
          isSpecialRule: true,
          isInstrument04: false // Não é Instrumento 04
        };
      }

      // 📊 PROCEDIMENTOS NORMAIS - REGRA PADRÃO DO SISTEMA
      // ✅ CALCULAR POSIÇÃO SEQUENCIAL APENAS ENTRE PROCEDIMENTOS NORMAIS
      const procedimentosNormaisOrdenados = procedimentosNormais
        .sort((a, b) => a.sequencia - b.sequencia);
      
      const posicaoEntreNormais = procedimentosNormaisOrdenados.findIndex(p => p.sequencia === proc.sequencia) + 1;
      const isPrincipalEntreNormais = posicaoEntreNormais === 1;
      
      // Regra padrão: 100% para primeiro procedimento normal, 70% para os demais
      // EXCEÇÃO: códigos marcados como 100% sempre (ex.: 02.05.02.015-1)
      const isAlways100 = isAlwaysFullPercentProcedure(proc.procedimento);
      const porcentagem = isAlways100 ? 100 : (isPrincipalEntreNormais ? 100 : 70);
      
      // ✅ CALCULAR SP E SH SEPARADAMENTE PARA PROCEDIMENTOS NORMAIS
      const valorTotalSigtap = proc.sigtapProcedure.valueHosp; // Total extraído
      const valorSP = proc.sigtapProcedure.valueProf;          // SP
      const valorSH = valorTotalSigtap - valorSP;              // SH = Total - SP
      const valorSA = proc.sigtapProcedure.valueAmb;           // SA (informativo apenas)
      
      // ✅ CORREÇÃO: SP sempre 100% em procedimentos normais (conforme regras SUS)
      const valorSHCalculado = (valorSH * porcentagem) / 100;
      const valorSPCalculado = valorSP; // ✅ CORREÇÃO: SP sempre 100%
      const valorSACalculado = valorSA; // SA informativo (não faturado)
      const valorTotalCalculado = valorSHCalculado + valorSPCalculado; // ✅ CORREÇÃO: SH + SP apenas

      console.log(`📊 PROCEDIMENTO NORMAL - ${proc.procedimento} (${proc.sequencia}º na AIH, ${posicaoEntreNormais}º entre normais): SH=${porcentagem}%, SP=100%`);
      console.log(`   💰 FATURAMENTO: SH=${valorSHCalculado.toFixed(2)} + SP=${valorSPCalculado.toFixed(2)} = ${valorTotalCalculado.toFixed(2)}`);
      console.log(`   ℹ️  SA (não faturado): ${valorSACalculado.toFixed(2)}`);

      return {
        ...proc,
        porcentagemSUS: porcentagem,
        valorCalculado: valorTotalCalculado * (proc.quantity || 1), // ✅ CORREÇÃO: SH + SP × quantidade
        valorOriginal: valorSH + valorSP,           // ✅ CORREÇÃO: SH + SP apenas
        valorUnitario: valorTotalCalculado,         // 🆕 VALOR UNITÁRIO (SH + SP de 1 unidade)
        // ✅ ADICIONAR CAMPOS SP E SH PARA PROCEDIMENTOS NORMAIS
        valorCalculadoSH: valorSHCalculado * (proc.quantity || 1),
        valorCalculadoSP: valorSPCalculado * (proc.quantity || 1),
        valorCalculadoSA: valorSACalculado, // Mantido para exibição informativa
        isSpecialRule: false,
        isInstrument04: false,
        regraEspecial: isAlways100
          ? `Regra 100% permanente SUS (código específico)`
          : `Regra padrão: SH=${porcentagem}%, SP=100% (${posicaoEntreNormais}º procedimento normal)`
      };
    });

    // 🔄 COMBINAR PROCEDIMENTOS PROCESSADOS COM ANESTESISTAS (SEM REGRAS)
    const todosProcedimentos = [...procedimentosComPercentagem, ...anestesistas];
    todosProcedimentos.sort((a, b) => a.sequencia - b.sequencia); // Reordenar por sequência

    // ✅ CALCULAR TOTAIS INCLUINDO ANESTESISTAS (PARA CONTROLE MANUAL)
    const valorTotalProcedimentosNormais = procedimentosComPercentagem
      .filter(p => p.aprovado)
      .reduce((sum, p) => sum + (p.valorCalculado || 0), 0);
    
    const valorTotalAnestesistas = anestesistas
      .filter(p => p.aprovado !== false) // Incluir anestesistas não rejeitados
      .reduce((sum, p) => sum + (p.valorCalculado || 0), 0);
    
    // 🚫 ANESTESISTAS NÃO ENTRAM NO VALOR TOTAL (apenas controle de quantidade)
    const valorTotalCalculado = valorTotalProcedimentosNormais; // EXCLUIR anestesistas do total

    console.log(`💰 VALOR TOTAL PROCEDIMENTOS NORMAIS: R$ ${valorTotalProcedimentosNormais.toFixed(2)}`);
    console.log(`🚫 ANESTESISTAS (CONTROLE MANUAL - SEM VALOR): R$ ${valorTotalAnestesistas.toFixed(2)} (excluído do total)`);
    console.log(`💰 VALOR TOTAL FINAL (SEM ANESTESISTAS): R$ ${valorTotalCalculado.toFixed(2)}`);

    return {
      ...aihCompleta,
      procedimentos: todosProcedimentos,
      procedimentosAprovados: procedimentosComPercentagem.filter(p => p.aprovado).length, // 🚫 EXCLUIR anestesistas da contagem
      procedimentosRejeitados: procedimentosComPercentagem.filter(p => p.matchStatus === 'rejected').length,
      valorTotalCalculado
    };
  };

  // Iniciar edição de valores - INTEGRADO COM REGRAS ESPECIAIS CORRIGIDAS
  const startEditingValues = (sequencia: number, procedure: ProcedureAIH) => {
    // 🚫 BLOQUEAR EDIÇÃO APENAS DE ANESTESIA NÃO CALCULÁVEL
    if (procedure.isAnesthesiaProcedure && !shouldCalculateAnesthetistProcedure(procedure.cbo, procedure.procedimento)) {
      toast({
        title: "Edição bloqueada",
        description: "Anestesistas não podem ser editados. Use o botão lixeira para remover.",
        variant: "destructive"
      });
      return;
    }
    
    setEditingValues(prev => new Set([...prev, sequencia]));
    
    if (procedure.sigtapProcedure) {
      // 🔧 CORREÇÃO: O valueHosp extraído é na verdade o VALOR TOTAL SIGTAP
      // Vamos reinterpretar os dados corretamente para edição
      const valorTotalSigtap = procedure.sigtapProcedure.valueHosp; // O que foi extraído como "SH" é o total
      const valorSP = procedure.sigtapProcedure.valueProf;          // SP está correto
      const valorSH = valorTotalSigtap - valorSP;                   // SH = Total - SP
      
      // 🎯 DETECTAR INSTRUMENTO 04
      const isInstrument04 = isInstrument04Procedure(procedure.sigtapProcedure.registrationInstrument);
      
      // 🏥 DETECTAR REGRA ESPECIAL BASEADA NO PROCEDIMENTO PRINCIPAL
      const procedimentoPrincipal = aihCompleta.procedimentoPrincipal || '';
      const regraEspecialPrincipal = getSpecialRule(procedimentoPrincipal);
      const temRegraEspecialGeral = Boolean(regraEspecialPrincipal);
      
      let porcentagemParaAplicar = procedure.porcentagemSUS || 100;
      if (isAlwaysFullPercentProcedure(procedure.procedimento)) {
        porcentagemParaAplicar = 100;
      }
      
      if (isInstrument04) {
        // Instrumento 04 sempre 100%
        porcentagemParaAplicar = 100;
      } else if (temRegraEspecialGeral && regraEspecialPrincipal) {
        // ✅ CALCULAR POSIÇÃO ENTRE TODOS OS PROCEDIMENTOS (exceto Instrumento 04 e anestesistas)
        const procedimentosParaRegra = aihCompleta.procedimentos
          .filter(p => p.sigtapProcedure && 
                      !isInstrument04Procedure(p.sigtapProcedure.registrationInstrument) &&
                      !(p.isAnesthesiaProcedure && !shouldCalculateAnesthetistProcedure(p.cbo, p.procedimento))) // 🚫 EXCLUIR APENAS ANESTESIA NÃO CALCULÁVEL
          .sort((a, b) => a.sequencia - b.sequencia);
        
        const posicaoNaRegra = procedimentosParaRegra.findIndex(p => p.sequencia === sequencia);
        porcentagemParaAplicar = regraEspecialPrincipal.rule.hospitalPercentages[posicaoNaRegra] || 
                                regraEspecialPrincipal.rule.hospitalPercentages[regraEspecialPrincipal.rule.hospitalPercentages.length - 1];
      } else {
        // ✅ PROCEDIMENTO NORMAL - CALCULAR POSIÇÃO ENTRE PROCEDIMENTOS NORMAIS (excluindo anestesistas)
        const procedimentosNormais = aihCompleta.procedimentos
          .filter(p => p.sigtapProcedure && 
                      !isInstrument04Procedure(p.sigtapProcedure.registrationInstrument) &&
                      !hasSpecialRule(p.procedimento) &&
                      !(p.isAnesthesiaProcedure && !shouldCalculateAnesthetistProcedure(p.cbo, p.procedimento))) // 🚫 EXCLUIR APENAS ANESTESIA NÃO CALCULÁVEL
          .sort((a, b) => a.sequencia - b.sequencia);
        
        const posicaoEntreNormais = procedimentosNormais.findIndex(p => p.sequencia === sequencia) + 1;
        porcentagemParaAplicar = isAlwaysFullPercentProcedure(procedure.procedimento)
          ? 100
          : (posicaoEntreNormais === 1 ? 100 : 70);
      }
      
      setTempValues(prev => ({
        ...prev,
        [sequencia]: {
          valorAmb: procedure.sigtapProcedure?.valueAmb || 0,
          valorHosp: valorSH, // 🔧 Usar o SH calculado correto
          valorProf: valorSP, // 🔧 Usar o SP correto (sempre 100% nas regras especiais)
          porcentagem: porcentagemParaAplicar,
          isSpecialRule: temRegraEspecialGeral || isInstrument04,
          specialRuleType: isInstrument04 ? 'instrument04' : regraEspecialPrincipal?.rule.type || null
        }
      }));
    }
  };

  // Salvar edição de valores - INTEGRADO COM REGRAS ESPECIAIS
  const saveEditedValues = (sequencia: number) => {
    const editedValues = tempValues[sequencia];
    if (!editedValues) return;

    // 🎯 DETECTAR INSTRUMENTO 04 OU REGRA ESPECIAL
    const procedureToEdit = aihCompleta.procedimentos.find(p => p.sequencia === sequencia);
    
    // 🚫 BLOQUEAR EDIÇÃO APENAS DE ANESTESIA NÃO CALCULÁVEL (dupla proteção)
    if (procedureToEdit?.isAnesthesiaProcedure && !shouldCalculateAnesthetistProcedure(procedureToEdit.cbo, procedureToEdit.procedimento)) {
      toast({
        title: "Edição bloqueada",
        description: "Anestesistas não podem ser editados.",
        variant: "destructive"
      });
      return;
    }
    
    const isInstrument04 = procedureToEdit && isInstrument04Procedure(procedureToEdit.sigtapProcedure?.registrationInstrument);
    const procedimentoPrincipal = aihCompleta.procedimentoPrincipal || '';
    const regraEspecialPrincipal = getSpecialRule(procedimentoPrincipal);
    const temRegraEspecialGeral = Boolean(regraEspecialPrincipal);

    const updatedProcedimentos = aihCompleta.procedimentos.map(proc => {
      if (proc.sequencia === sequencia && proc.sigtapProcedure) {
        
        if (isInstrument04) {
          // 🎯 APLICAR REGRA INSTRUMENTO 04 - SEMPRE 100%
          const valorSA = editedValues.valorAmb;
          const valorSH = editedValues.valorHosp;
          const valorSP = editedValues.valorProf;
          
          // Aplicar 100% para todos os componentes
          const valorSHCalculado = valorSH; // 100%
          const valorSPCalculado = valorSP; // 100%
          const valorSACalculado = valorSA; // 100%
          
          const valorFinal = valorSHCalculado + valorSPCalculado; // ✅ CORREÇÃO: SH + SP apenas
          
          const updatedSigtapProcedure = {
            ...proc.sigtapProcedure,
            valueAmb: valorSA,
            valueHosp: valorSH + valorSP, // Total original para referência
            valueProf: valorSP,
            valueHospTotal: valorSH + valorSP
          };

          return {
            ...proc,
            sigtapProcedure: updatedSigtapProcedure,
            porcentagemSUS: 100, // Sempre 100%
            valorCalculado: valorFinal,
            valorOriginal: valorSH + valorSP, // ✅ CORREÇÃO: SH + SP apenas
            // Campos específicos para Instrumento 04
            isInstrument04: true,
            instrument04Rule: 'Instrumento 04 - AIH (Proc. Especial) - Sempre 100%',
            isSpecialRule: true, // Para compatibilidade com interface
            regraEspecial: 'Instrumento 04 - AIH (Proc. Especial)',
            valorCalculadoSH: valorSHCalculado,
            valorCalculadoSP: valorSPCalculado,
            valorCalculadoSA: valorSACalculado
          };
        } else if (temRegraEspecialGeral && regraEspecialPrincipal) {
          // 🏥 APLICAR REGRA ESPECIAL - PORCENTAGEM APENAS NO SH
          const valorSA = editedValues.valorAmb;
          const valorSH = editedValues.valorHosp;
          const valorSP = editedValues.valorProf; // SP sempre mantém valor original nas regras especiais
          
          // Calcular porcentagem baseada na posição sequencial (EXCLUINDO ANESTESISTAS)
          const procedimentosParaRegra = aihCompleta.procedimentos
            .filter(p => p.sigtapProcedure && 
                        !isInstrument04Procedure(p.sigtapProcedure.registrationInstrument) &&
                        !(p.isAnesthesiaProcedure && !shouldCalculateAnesthetistProcedure(p.cbo, p.procedimento))) // 🚫 EXCLUIR APENAS ANESTESIA NÃO CALCULÁVEL
            .sort((a, b) => a.sequencia - b.sequencia);
          
          const posicaoNaRegra = procedimentosParaRegra.findIndex(p => p.sequencia === sequencia);
          const porcentagemSH = regraEspecialPrincipal.rule.hospitalPercentages[posicaoNaRegra] || 
                               regraEspecialPrincipal.rule.hospitalPercentages[regraEspecialPrincipal.rule.hospitalPercentages.length - 1];
          
          // Aplicar porcentagem APENAS ao SH
          const valorSHCalculado = (valorSH * porcentagemSH) / 100;
          const valorSPCalculado = valorSP; // SP sempre 100%
          const valorSACalculado = valorSA; // SA sempre 100%
          
          const valorFinal = valorSHCalculado + valorSPCalculado; // ✅ CORREÇÃO: SH + SP apenas
          
          const updatedSigtapProcedure = {
            ...proc.sigtapProcedure,
            valueAmb: valorSA,
            valueHosp: valorSH + valorSP, // Total original para referência
            valueProf: valorSP,
            valueHospTotal: valorSH + valorSP
          };

          return {
            ...proc,
            sigtapProcedure: updatedSigtapProcedure,
            porcentagemSUS: porcentagemSH,
            valorCalculado: valorFinal,
            valorOriginal: valorSH + valorSP,
            // Campos específicos para regras especiais
            isSpecialRule: true,
            specialRuleType: regraEspecialPrincipal.rule.type,
            regraEspecial: regraEspecialPrincipal.procedureName,
            valorCalculadoSH: valorSHCalculado,
            valorCalculadoSP: valorSPCalculado,
            valorCalculadoSA: valorSACalculado
          };
        } else {
          // 📊 APLICAR LÓGICA PADRÃO DO SISTEMA
        const valorTotal = editedValues.valorHosp + editedValues.valorProf; // SH + SP = Total
        
        const updatedSigtapProcedure = {
          ...proc.sigtapProcedure,
          valueAmb: editedValues.valorAmb,        // SA correto
          valueHosp: valorTotal,                  // 🔧 Total (será interpretado como total na exibição)
          valueProf: editedValues.valorProf,      // SP correto
          valueHospTotal: valorTotal              // Total hospitalar = SH + SP
        };

          // Calcular valor com porcentagem aplicada ao total
        const valorCalculado = (updatedSigtapProcedure.valueHospTotal * editedValues.porcentagem) / 100;

        return {
          ...proc,
          sigtapProcedure: updatedSigtapProcedure,
          porcentagemSUS: editedValues.porcentagem,
          valorCalculado,
            valorOriginal: updatedSigtapProcedure.valueHospTotal,
            // Limpar campos de regras especiais
            isSpecialRule: false,
            specialRuleType: undefined,
            regraEspecial: undefined,
            valorCalculadoSH: undefined,
            valorCalculadoSP: undefined,
            valorCalculadoSA: undefined
          };
        }
      }
      return proc;
    });

    const updatedAIH = calculateTotalsWithPercentage(updatedProcedimentos);
    onUpdateAIH(updatedAIH);

    // Finalizar edição
    setEditingValues(prev => {
      const newSet = new Set(prev);
      newSet.delete(sequencia);
      return newSet;
    });

    setTempValues(prev => {
      const newValues = { ...prev };
      delete newValues[sequencia];
      return newValues;
    });

    // Toast específico para regra especial ou padrão
    if (temRegraEspecialGeral && regraEspecialPrincipal) {
      toast({
        title: "⚡ Regra Especial Aplicada",
        description: `${regraEspecialPrincipal.procedureName} - SH: ${editedValues.porcentagem}%, SP: 100%`
      });
    } else {
    toast({
      title: "✅ Valores atualizados",
      description: `Procedimento ${sequencia} atualizado com ${editedValues.porcentagem}% de cobrança`
    });
    }
  };

  // Cancelar edição
  const cancelEditingValues = (sequencia: number) => {
    setEditingValues(prev => {
      const newSet = new Set(prev);
      newSet.delete(sequencia);
      return newSet;
    });

    setTempValues(prev => {
      const newValues = { ...prev };
      delete newValues[sequencia];
      return newValues;
    });
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(value);
  };

  const getStatusBadge = (status: ProcedureAIH['matchStatus'], confidence?: number) => {
    const configs = {
      pending: { variant: 'secondary' as const, icon: Target, text: 'Pendente' },
      matched: { variant: 'default' as const, icon: CheckCircle, text: 'Encontrado' },
      manual: { variant: 'outline' as const, icon: Edit, text: 'Manual' },
      rejected: { variant: 'destructive' as const, icon: X, text: 'Rejeitado' }
    };
    
    const config = configs[status];
    const Icon = config.icon;
    
    return (
      <div className="flex flex-col items-center space-y-1">
        <Badge variant={config.variant} className="flex items-center space-x-1">
          <Icon className="w-3 h-3" />
          <span>{config.text}</span>
        </Badge>
        {confidence && confidence > 0 && (
          <span className="text-xs text-gray-500">{(confidence * 100).toFixed(0)}%</span>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-6">
      {/* CARDS REORGANIZADOS: DADOS COMPLETOS DA AIH */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        
        {/* Card Unificado: Dados da AIH + Identificação do Paciente */}
        <Card className="xl:col-span-2 border-2 border-blue-200 bg-gradient-to-r from-blue-50 to-cyan-50">
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <FileText className="w-5 h-5 text-blue-600" />
              <span>📋 Dados da AIH & Paciente</span>
              <Badge variant="outline" className="bg-blue-100 text-blue-700">Completo</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            
            {/* SEÇÃO 1: DADOS DA AIH */}
            <div className="bg-white p-4 rounded-lg border border-blue-100">
              <div className="flex items-center space-x-2 mb-3">
                <div className="w-4 h-4 bg-blue-500 rounded"></div>
                <h4 className="text-sm font-semibold text-gray-700">🆔 Dados da AIH</h4>
              </div>
              
              {/* Linha 1: Dados Básicos da AIH */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-3">
                <div>
                  <label className="text-xs font-medium text-gray-600">Número AIH</label>
                  <div className="text-gray-900 font-mono text-sm font-semibold bg-blue-50 px-2 py-1 rounded">
                    {aihCompleta.numeroAIH === "-" ? (
                      <div className="flex items-center space-x-2">
                        <span className="text-orange-600">-</span>
                        <span className="text-xs text-orange-600 italic">(controle por nome)</span>
                      </div>
                    ) : (
                      aihCompleta.numeroAIH
                    )}
                  </div>
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-600">Situação</label>
                  <p className="text-gray-900 text-sm">{aihCompleta.situacao}</p>
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-600">Tipo</label>
                  <p className="text-gray-900 text-sm">{aihCompleta.tipo}</p>
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-600">Data Autorização</label>
                  <p className="text-gray-900 text-sm font-mono">{formatDateBR(aihCompleta.dataAutorizacao)}</p>
                </div>
              </div>
              
              {/* Linha 2: Datas de Internação */}
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mb-3">
                <div>
                  <label className="text-xs font-medium text-gray-600">Data Início (Admissão)</label>
                  <p className="text-gray-900 text-sm font-mono">{formatDateBR(aihCompleta.dataInicio)}</p>
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-600">Data Fim (Alta)</label>
                  <p className="text-gray-900 text-sm font-mono">{formatDateBR(aihCompleta.dataFim)}</p>
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-600">Motivo Encerramento</label>
                  <p className="text-gray-900 text-sm">{aihCompleta.motivoEncerramento || 'N/A'}</p>
                </div>
              </div>
              
              {/* Linha 3: CNS dos Médicos - Seção Destacada com Nomes */}
              <div className="bg-gray-50 p-3 rounded border mt-3">
                <div className="flex items-center space-x-2 mb-2">
                  <div className="w-3 h-3 bg-green-500 rounded-full"></div>
                  <h5 className="text-xs font-semibold text-gray-700">👨‍⚕️ Médicos Responsáveis</h5>
                  <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200 text-xs">
                    ✨ Com nomes dos médicos
                  </Badge>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <DoctorDisplay 
                    cns={aihCompleta.cnsAutorizador || ''} 
                    type="autorizador" 
                    hospitalId={currentHospital?.id}
                  />
                  <DoctorDisplay 
                    cns={aihCompleta.cnsSolicitante || ''} 
                    type="solicitante" 
                    hospitalId={currentHospital?.id}
                    showFullInfo={true}
                  />
                  <DoctorDisplay 
                    cns={aihCompleta.cnsResponsavel || ''} 
                    type="responsavel" 
                    hospitalId={currentHospital?.id}
                    showFullInfo={true}
                  />
                </div>
              </div>
            </div>

            {/* SEÇÃO 2: IDENTIFICAÇÃO DO PACIENTE */}
            <div className="bg-white p-4 rounded-lg border border-blue-100">
              <div className="flex items-center space-x-2 mb-3">
                <div className="w-4 h-4 bg-green-500 rounded"></div>
                <h4 className="text-sm font-semibold text-gray-700">👤 Identificação do Paciente</h4>
              </div>
              
              {/* Dados Principais do Paciente */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="text-xs font-medium text-gray-600">Nome do Paciente</label>
                  <p className="text-gray-900 text-sm font-semibold bg-green-50 px-2 py-1 rounded">
                    {(() => {
                      try {
                        // Lazy import para evitar bundling circular
                        const { sanitizePatientName } = require('../utils/patientName');
                        return sanitizePatientName(aihCompleta.nomePaciente || '');
                      } catch {
                        return aihCompleta.nomePaciente || 'Nome não informado';
                      }
                    })()}
                  </p>
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-600">CNS</label>
                  <p className="text-gray-900 text-sm font-mono">{aihCompleta.cns}</p>
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-600">Prontuário</label>
                  <p className="text-gray-900 text-sm font-mono">{aihCompleta.prontuario || 'N/A'}</p>
                </div>
              </div>
              
              {/* Dados Demográficos Compactos */}
              <div className="grid grid-cols-2 md:grid-cols-6 gap-2 mt-3">
                <div>
                  <label className="text-xs font-medium text-gray-600">Nascimento</label>
                  <p className="text-gray-900 text-sm">{formatDateBR(aihCompleta.nascimento)}</p>
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-600">Sexo</label>
                  <Badge variant="outline" className={aihCompleta.sexo === 'M' ? 'bg-blue-50 text-blue-700' : 'bg-pink-50 text-pink-700'}>
                    {aihCompleta.sexo === 'M' ? 'Masculino' : 'Feminino'}
                  </Badge>
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-600">Nacionalidade</label>
                  <p className="text-gray-900 text-sm">{aihCompleta.nacionalidade || 'BRASIL'}</p>
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-600">Raça/Cor</label>
                  <p className="text-gray-900 text-sm">{aihCompleta.racaCor || 'N/A'}</p>
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-600">Tipo Doc.</label>
                  <p className="text-gray-900 text-sm">{aihCompleta.tipoDocumento || 'N/A'}</p>
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-600">Documento</label>
                  <p className="text-gray-900 text-sm font-mono">{aihCompleta.documento || 'N/A'}</p>
                </div>
              </div>

              {/* Endereço Compacto (sempre visível) */}
              <div className="mt-3 p-2 bg-gray-50 rounded border">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                  <div className="col-span-2">
                    <label className="text-xs font-medium text-gray-600">📍 Endereço</label>
                    <p className="text-gray-900 text-sm">{aihCompleta.endereco || 'N/A'}</p>
                  </div>
                  <div>
                    <label className="text-xs font-medium text-gray-600">Município</label>
                    <p className="text-gray-900 text-sm">{aihCompleta.municipio || 'N/A'}</p>
                  </div>
                  <div>
                    <label className="text-xs font-medium text-gray-600">UF</label>
                    <p className="text-gray-900 text-sm font-mono">{aihCompleta.uf || 'N/A'}</p>
                  </div>
                </div>
              </div>
            </div>

          </CardContent>
        </Card>

        {/* Card 3: Dados da Internação - Layout Premium Expandido */}
        <Card className="xl:col-span-2 border-2 border-purple-200 bg-gradient-to-r from-purple-50 to-violet-50">
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <Stethoscope className="w-5 h-5 text-purple-600" />
              <span>🏥 Dados da Internação & Faturamento</span>
              <Badge variant="outline" className="bg-purple-100 text-purple-700">SUS</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            
            {/* SEÇÃO 1: PROCEDIMENTOS */}
            <div className="bg-white p-4 rounded-lg border border-purple-100">
              <div className="flex items-center space-x-2 mb-3">
                <div className="w-4 h-4 bg-blue-500 rounded"></div>
                <h4 className="text-sm font-semibold text-gray-700">🔬 Procedimentos</h4>
              </div>
              {/* Cards de valores (com e sem anestesistas) */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-4">
                <div className="p-3 rounded border bg-gradient-to-r from-blue-50 to-blue-100">
                  <div className="text-xs font-medium text-blue-700">💰 Valor com Anestesistas</div>
                  <div className="text-xl font-bold text-blue-900">
                    {(() => {
                      try {
                        const totalComAnest = aihCompleta.procedimentos
                          .filter(p => p.aprovado !== false)
                          .reduce((sum, p) => sum + (p.valorCalculado || 0), 0);
                        return totalComAnest.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
                      } catch { return 'R$ 0,00'; }
                    })()}
                  </div>
                </div>
                <div className="p-3 rounded border bg-gradient-to-r from-green-50 to-green-100">
                  <div className="text-xs font-medium text-green-700">💰 Valor sem Anestesistas</div>
                  <div className="text-xl font-bold text-green-900">
                    {(() => {
                      try {
                        const totalSemAnest = aihCompleta.procedimentos
                          .filter(p => p.aprovado && !p.isAnesthesiaProcedure)
                          .reduce((sum, p) => sum + (p.valorCalculado || 0), 0);
                        return totalSemAnest.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
                      } catch { return 'R$ 0,00'; }
                    })()}
                  </div>
                </div>
              </div>
              <div className="grid grid-cols-1 gap-4">
                <div>
                  <label className="text-sm font-medium text-gray-600">Procedimento Principal</label>
                  <div className="flex items-center space-x-2 mt-1">
                    <Stethoscope className="w-4 h-4 text-blue-500" />
                    <p className="text-gray-900 font-mono text-sm font-semibold bg-blue-50 px-2 py-1 rounded">
                      {aihCompleta.procedimentoPrincipal || 'N/A'}
                    </p>
                    {aihCompleta.procedimentoSequencial && (
                      <Badge variant="secondary" className="bg-orange-100 text-orange-700">Sequencial</Badge>
                    )}
                    {aihCompleta.procedimentoEspecial && (
                      <Badge variant="secondary" className="bg-red-100 text-red-700">Especial</Badge>
                    )}
                    
                    {/* IDENTIFICAÇÃO DE REGRAS ESPECIAIS CIRURGIAS MÚLTIPLAS */}
                    {hasSpecialRule(aihCompleta.procedimentoPrincipal || '') && (
                      <Badge variant="outline" className="bg-gradient-to-r from-purple-100 to-pink-100 text-purple-800 border-purple-300 shadow-sm">
                        ⚡ Regra Especial SUS
                      </Badge>
                    )}
                  </div>
                  
                  {/* EXPLICAÇÃO DETALHADA DAS REGRAS ESPECIAIS */}
                  {hasSpecialRule(aihCompleta.procedimentoPrincipal || '') && (
                    <div className="mt-3 p-3 bg-gradient-to-r from-purple-50 to-pink-50 border border-purple-200 rounded-lg">
                      <div className="flex items-center space-x-2 mb-2">
                        <div className="w-2 h-2 bg-purple-500 rounded-full animate-pulse"></div>
                        <h5 className="text-sm font-semibold text-purple-800">🎯 Regra de Cirurgia Múltipla Ativa</h5>
                      </div>
                      
                      {(() => {
                        const rule = getSpecialRule(aihCompleta.procedimentoPrincipal || '');
                        return rule ? (
                          <div className="space-y-2">
                            <p className="text-xs text-purple-700 font-medium">
                              📋 <strong>{rule.procedureName}</strong>
                            </p>
                            <p className="text-xs text-gray-600">
                              {rule.description}
                            </p>
                            
                            <div className="grid grid-cols-2 gap-3 mt-2">
                              <div className="bg-white p-2 rounded border">
                                <p className="text-xs font-medium text-gray-600 mb-1">🏥 Serviços Hospitalares (SH):</p>
                                <div className="flex flex-wrap gap-1">
                                  {rule.rule.hospitalPercentages.map((percentage, index) => (
                                    <span 
                                      key={index}
                                      className={`text-xs px-1.5 py-0.5 rounded ${
                                        index === 0 
                                          ? 'bg-green-100 text-green-700 font-semibold' 
                                          : 'bg-blue-100 text-blue-700'
                                      }`}
                                    >
                                      {index + 1}º: {percentage}%
                                    </span>
                                  ))}
                                </div>
                              </div>
                              
                              <div className="bg-white p-2 rounded border">
                                <p className="text-xs font-medium text-gray-600 mb-1">👨‍⚕️ Serviços Profissionais (SP):</p>
                                <span className="text-xs px-2 py-1 bg-green-100 text-green-700 rounded font-semibold">
                                  🟢 Sempre 100%
                                </span>
                              </div>
                            </div>
                            
                            <div className="mt-2 p-2 bg-yellow-50 border border-yellow-200 rounded">
                              <p className="text-xs text-yellow-800">
                                <strong>⚠️ Atenção:</strong> Esta regra será aplicada automaticamente a todos os procedimentos desta AIH.
                              </p>
                            </div>
                          </div>
                        ) : null;
                      })()}
                    </div>
                  )}
                </div>
                
                <div>
                  <label className="text-sm font-medium text-gray-600">Procedimento Solicitado</label>
                  <div className="flex items-center space-x-2 mt-1">
                    <div className="flex items-center space-x-3">
                      <p className="text-gray-900 font-mono text-sm bg-gray-50 px-2 py-1 rounded">
                        {aihCompleta.procedimentoSolicitado || 'N/A'}
                      </p>
                      <div className="flex items-center space-x-2">
                        <label className="text-sm font-medium text-gray-600">Mudança?</label>
                        <Badge variant={aihCompleta.mudancaProc ? "destructive" : "outline"}>
                          {aihCompleta.mudancaProc ? "Sim" : "Não"}
                        </Badge>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* SEÇÃO 2: CLASSIFICAÇÃO CLÍNICA */}
            <div className="bg-white p-4 rounded-lg border border-purple-100">
              <div className="flex items-center space-x-2 mb-3">
                <div className="w-4 h-4 bg-teal-500 rounded"></div>
                <h4 className="text-sm font-semibold text-gray-700">📋 Classificação Clínica</h4>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium text-gray-600">CID Principal</label>
                  <p className="text-gray-900 font-mono text-sm bg-teal-50 px-2 py-1 rounded mt-1">
                    {aihCompleta.cidPrincipal || 'N/A'}
                  </p>
                </div>
                
                <div>
                  <label className="text-sm font-medium text-gray-600">Especialidade</label>
                  <p className="text-gray-900 text-sm bg-gray-50 px-2 py-1 rounded mt-1">
                    {aihCompleta.especialidade || 'N/A'}
                  </p>
                </div>
                
                <div>
                  <label className="text-sm font-medium text-gray-600">Modalidade</label>
                  <p className="text-gray-900 text-sm bg-gray-50 px-2 py-1 rounded mt-1">
                    {aihCompleta.modalidade || 'N/A'}
                  </p>
                </div>
                
                <div>
                  <label className="text-sm font-medium text-gray-600">Caráter Atendimento</label>
                  <p className="text-gray-900 text-sm bg-gray-50 px-2 py-1 rounded mt-1">
                    {(() => {
                      const raw = (aihCompleta as any)?.caracterAtendimento;
                      if (!raw) return 'N/A';
                      const code = normalizeCareCharacterUI(raw);
                      return CareCharacterUtils.formatForDisplay(code, true);
                    })()}
                  </p>
                </div>
              </div>
            </div>

          </CardContent>
        </Card>
      </div>

      {/* RESUMO FINANCEIRO PREMIUM */}
      <Card className="border-2 border-green-200 bg-gradient-to-r from-green-50 to-emerald-50">
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <DollarSign className="w-5 h-5 text-green-600" />
              <span>Resumo Financeiro</span>
              <Badge variant="outline" className="bg-green-100 text-green-700">Premium</Badge>
            </div>
            
            {/* ❌ CAMPO DE PORCENTAGEM REMOVIDO - Agora usa apenas regras automáticas do SUS */}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
            <div className="text-center p-4 bg-gradient-to-r from-sky-50 to-sky-100 rounded-lg border-l-4 border-sky-400">
              <p className="text-sm text-gray-600">Total Extraído</p>
              <p className="text-2xl font-bold text-sky-700">{aihCompleta.totalProcedimentos}</p>
              <p className="text-xs text-gray-500">Todos os procedimentos</p>
            </div>
            <div className="text-center p-4 bg-gradient-to-r from-emerald-50 to-emerald-100 rounded-lg border-l-4 border-emerald-400">
              <p className="text-sm text-gray-600">Aprovados</p>
              <p className="text-2xl font-bold text-emerald-700">{aihCompleta.procedimentosAprovados}</p>
              <p className="text-xs text-gray-500">Incluindo anestesistas</p>
            </div>
            {/* ✅ NOVO: Card específico para anestesistas */}
            <div className="text-center p-4 bg-gradient-to-r from-rose-50 to-rose-100 rounded-lg border-l-4 border-rose-400">
              <p className="text-sm text-gray-600">Anestesistas</p>
              <p className="text-2xl font-bold text-rose-700">
                {aihCompleta.procedimentos.filter(p => p.isAnesthesiaProcedure).length}
              </p>
              <p className="text-xs text-gray-500">Marcados para remoção</p>
            </div>
            <div className="text-center p-4 bg-gradient-to-r from-violet-50 to-violet-100 rounded-lg border-l-4 border-violet-400 relative">
              <p className="text-sm text-gray-600">Valor Total</p>
              <p className="text-2xl font-bold text-violet-800">
                {formatCurrency(aihCompleta.valorTotalCalculado || 0)}
              </p>
              <div className="absolute top-1 right-1">
                <Badge variant="default" className="text-xs bg-violet-500">Total</Badge>
              </div>
            </div>
            {/* ✅ NOVO: Valor Total com Anestesistas */}
            <div className="text-center p-4 bg-gradient-to-r from-amber-50 to-amber-100 rounded-lg border-l-4 border-amber-400 relative">
              <p className="text-sm text-gray-600">Valor Total (c/ Anest.)</p>
              <p className="text-2xl font-bold text-amber-800">
                {formatCurrency((() => {
                  try {
                    return (aihCompleta.procedimentos || [])
                      .filter(p => p.aprovado !== false)
                      .reduce((sum, p) => sum + (p.valorCalculado || 0), 0);
                  } catch {
                    return 0;
                  }
                })())}
              </p>
              <div className="absolute top-1 right-1">
                <Badge variant="default" className="text-xs bg-amber-500">Total+</Badge>
              </div>
            </div>
          </div>
          

          
          {/* ✅ NOVO: Informativo sobre anestesistas */}
          {aihCompleta.procedimentos.filter(p => p.isAnesthesiaProcedure).length > 0 && (
            <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg">
              <div className="flex items-center space-x-2 mb-2">
                <div className="w-3 h-3 bg-red-500 rounded-full animate-pulse"></div>
                <h4 className="text-sm font-medium text-red-800">Procedimentos de Anestesia Detectados</h4>
              </div>
              <p className="text-sm text-red-700">
                ✅ <strong>Todos os procedimentos foram extraídos</strong> - incluindo {aihCompleta.procedimentos.filter(p => p.isAnesthesiaProcedure).length} procedimento(s) de anestesia.
              </p>
              <p className="text-xs text-red-600 mt-1">
                💡 Procedimentos de anestesia <strong>não cobrados</strong> ficam marcados com margem vermelha. Use o botão 🗑️ para removê-los conforme necessário.
              </p>
            </div>
          )}
          
          {/* RESUMO DE PORCENTAGENS */}
          <div className="mt-4 p-3 bg-white rounded-lg border">
            <h4 className="text-sm font-medium text-gray-600 mb-2">Lógica de Cobrança SUS:</h4>
            
            {/* VERIFICAÇÃO DE REGRAS ESPECIAIS ATIVAS */}
            {hasSpecialRule(aihCompleta.procedimentoPrincipal || '') ? (
              <div className="space-y-3">
                <div className="flex items-center space-x-2 p-2 bg-purple-50 border border-purple-200 rounded">
                  <div className="w-3 h-3 bg-purple-500 rounded-full animate-pulse"></div>
                  <span className="text-sm font-semibold text-purple-800">⚡ Regra Especial de Cirurgia Múltipla Ativa</span>
                </div>
                
                {(() => {
                  const rule = getSpecialRule(aihCompleta.procedimentoPrincipal || '');
                  return rule ? (
                    <div className="grid grid-cols-1 gap-2 text-sm">
                      <div className="flex items-center space-x-2">
                        <div className="w-3 h-3 bg-blue-500 rounded-full"></div>
                        <span>🏥 <strong>SH:</strong> {rule.rule.hospitalPercentages.join('%, ')}%</span>
                      </div>
                      <div className="flex items-center space-x-2">
                        <div className="w-3 h-3 bg-green-500 rounded-full"></div>
                        <span>👨‍⚕️ <strong>SP:</strong> Sempre 100%</span>
                      </div>
                    </div>
                  ) : null;
                })()}
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-4 text-sm">
              <div className="flex items-center space-x-2">
                <div className="w-3 h-3 bg-green-500 rounded-full"></div>
                <span>Procedimento Principal: <strong>100%</strong></span>
              </div>
              <div className="flex items-center space-x-2">
                <div className="w-3 h-3 bg-blue-500 rounded-full"></div>
                  <span>Procedimentos Secundários: <strong>Editar Manualmente</strong></span>
              </div>
            </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* TABELA DE PROCEDIMENTOS */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>📋 Procedimentos Realizados ({aihCompleta.procedimentos.length})</CardTitle>
            <div className="flex items-center gap-3">
              {/* Modo de competência: Alta (padrão SUS) ou Manual */}
              {(() => {
                const altaYM = (() => {
                  const ref = (aihCompleta as any)?.dataFim || (aihCompleta as any)?.dataInicio;
                  // ✅ CORREÇÃO: Usar extractYearMonth sem timezone
                  return extractYearMonth(ref);
                })();
                const compYM = (() => {
                  const comp = (aihCompleta as any)?.competencia as string | undefined;
                  return comp ? comp.slice(0,7) : '';
                })();
                const isAltaMode = competenciaMode === 'alta';
                return (
                  <div className="flex items-center gap-2">
                    <div className="flex items-center gap-1">
                      <input
                        type="radio"
                        name="competencia-mode"
                        id="competencia-mode-alta"
                        className="h-4 w-4"
                        checked={competenciaMode === 'alta'}
                        onChange={() => {
                          setCompetenciaMode('alta');
                          if (altaYM) {
                            const value = `${altaYM}-01`;
                            onUpdateAIH({ ...(aihCompleta as any), competencia: value } as any);
                          }
                        }}
                      />
                      <label htmlFor="competencia-mode-alta" className="text-xs text-gray-700 whitespace-nowrap">Usar alta (SUS)</label>
                    </div>
                    <div className="flex items-center gap-1">
                      <input
                        type="radio"
                        name="competencia-mode"
                        id="competencia-mode-manual"
                        className="h-4 w-4"
                        checked={competenciaMode === 'manual'}
                        onChange={() => {
                          setCompetenciaMode('manual');
                          // Entrar em modo manual não altera o valor atual; usuário define no dropdown
                        }}
                      />
                      <label htmlFor="competencia-mode-manual" className="text-xs text-gray-700 whitespace-nowrap">Selecionar manualmente</label>
                    </div>
                    <div className="h-4 w-px bg-gray-300 mx-1" />
                    <label className="text-xs text-gray-600">Competência</label>
                    <select
                      className={`px-2 py-1.5 text-sm rounded-md bg-white border border-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-200`}
                      value={isAltaMode ? (altaYM || '') : compYM}
                      disabled={isAltaMode}
                      onChange={(e) => {
                        const ym = e.target.value; // YYYY-MM
                        const value = `${ym}-01`;
                        onUpdateAIH({ ...(aihCompleta as any), competencia: value } as any);
                      }}
                    >
                      {/* Opção nula explícita para obrigar seleção */}
                      <option value="" disabled>Selecione a competência</option>
                      {(() => {
                        const options: JSX.Element[] = [];
                        const year = new Date().getFullYear();
                        for (let m = 1; m <= 12; m++) {
                          const d = new Date(year, m - 1, 1);
                          const ym = `${year}-${String(m).padStart(2, '0')}`;
                          const label = d.toLocaleDateString('pt-BR', { month: 'short', year: 'numeric' });
                          options.push(<option key={ym} value={ym}>{label}</option>);
                        }
                        return options;
                      })()}
                    </select>
                  </div>
                );
              })()}
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="border rounded-lg overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="bg-gray-50">
                  <TableHead className="w-12 text-center">Seq</TableHead>
                  <TableHead className="w-28">Código</TableHead>
                  <TableHead>Procedimento</TableHead>
                  <TableHead className="w-20 text-center">
                    <div className="flex items-center justify-center space-x-1">
                      <span className="text-sm font-semibold">Qtd</span>
                      <div className="w-3 h-3 bg-blue-100 rounded-full flex items-center justify-center">
                        <span className="text-[8px] text-blue-600 font-bold">#</span>
                      </div>
                    </div>
                  </TableHead>
                  <TableHead className="w-80 text-center">Valores</TableHead>
                  <TableHead className="w-12 text-center">+</TableHead>
                  <TableHead className="w-8 text-center"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(() => {
                  const normalize04Key = (raw: unknown): string => {
                    const s = String(raw ?? '').trim()
                    const code = s.match(/^(\d{2}\.\d{2}\.\d{2}\.\d{3}-\d)/)?.[1] || s
                    return code.replace(/\D/g, '')
                  }
                  const normalizeParticipationCode = (raw: unknown): string => {
                    const digits = String(raw ?? '').replace(/\D/g, '')
                    if (!digits) return ''
                    const n = digits.length >= 2 ? digits.slice(-2) : digits.padStart(2, '0')
                    return n
                  }
                  const normalizeCboDigits = (raw: unknown): string => {
                    return String(raw ?? '').trim().replace(/\D/g, '')
                  }
                  const isMissingCbo = (digits: string): boolean => {
                    return !digits || digits.length !== 6 || digits === '000000' || digits === '0'
                  }
                  const issueBySeq = new Map<number, 'missing' | 'wrong'>()
                  const groups = new Map<string, Array<{ seq: number; cbo: string; partCode: string }>>()
                  for (const p of (aihCompleta.procedimentos || []) as any[]) {
                    const code = String(p?.procedimento || '').trim()
                    if (!code.startsWith('04')) continue
                    const key = normalize04Key(code)
                    if (!key || !key.startsWith('04')) continue
                    const seq = Number(p?.sequencia ?? 0)
                    if (!Number.isFinite(seq) || seq <= 0) continue
                    const cbo = normalizeCboDigits(p?.cbo)
                    const partCode = normalizeParticipationCode(p?.participacao)
                    if (!groups.has(key)) groups.set(key, [])
                    groups.get(key)!.push({ seq, cbo, partCode })
                  }
                  for (const [, list] of groups) {
                    if (list.length <= 1) continue
                    const keep = list.find((x) => x.seq === 1) ?? list.reduce((best, cur) => (cur.seq < best.seq ? cur : best), list[0])
                    for (const item of list) {
                      if (item.seq === keep.seq) continue
                      if (isMissingCbo(item.cbo)) {
                        issueBySeq.set(item.seq, 'missing')
                      } else if (item.cbo !== '225151') {
                        issueBySeq.set(item.seq, 'wrong')
                      }
                    }
                  }
                  for (const p of (aihCompleta.procedimentos || []) as any[]) {
                    const seq = Number(p?.sequencia ?? 0)
                    if (!Number.isFinite(seq) || seq <= 0) continue
                    const partCode = normalizeParticipationCode(p?.participacao)
                    const code = String(p?.procedimento || '').trim()
                    if (!code.startsWith('04')) continue
                    if (partCode !== '04') continue
                    const cbo = normalizeCboDigits(p?.cbo)
                    const existing = issueBySeq.get(seq)
                    if (isMissingCbo(cbo)) {
                      issueBySeq.set(seq, 'missing')
                    } else if (cbo !== '225151' && existing !== 'missing') {
                      issueBySeq.set(seq, 'wrong')
                    }
                  }

                  return aihCompleta.procedimentos
                    .map((procedure) => {
                      const dupIssue = issueBySeq.get(procedure.sequencia as any)
                      const partCode = normalizeParticipationCode((procedure as any).participacao)
                      const procCode = String((procedure as any).procedimento || '').trim()
                      const is04Procedure = procCode.startsWith('04')
                      const isAnesthetist = is04Procedure && partCode === '04'
                      const isFirstSurgeon = is04Procedure && partCode === '01'
                      const effectiveCbo = (isAnesthetist || dupIssue === 'missing' || dupIssue === 'wrong')
                        ? '225151'
                        : ((procedure as any).cbo || (procedure as any).professional_cbo)
                      const rowClass = (() => {
                        if (dupIssue === 'missing' || dupIssue === 'wrong') return 'border-l-4 border-red-500 bg-red-50'
                        if (isAnesthetist) return 'border-l-4 border-emerald-500 bg-emerald-50'
                        if (isFirstSurgeon) return 'border-l-4 border-blue-500 bg-blue-50'
                        if (procedure.isAnesthesiaProcedure && !shouldCalculateAnesthetistProcedure(effectiveCbo, procedure.procedimento)) {
                          return 'border-l-4 border-red-500 bg-red-50'
                        }
                        return ''
                      })()
                      return { procedure, dupIssue, partCode, isAnesthetist, isFirstSurgeon, effectiveCbo, rowClass }
                    })
                    // ✅ REMOVIDO: .filter(filterOutAnesthesia) - Agora mostra TODOS os procedimentos
                    .map(({ procedure, dupIssue, partCode, isAnesthetist, isFirstSurgeon, effectiveCbo, rowClass }) => (
                  <React.Fragment key={procedure.sequencia}>
                    <TableRow 
                      className={`hover:bg-gray-50 ${rowClass}`}
                    >
                      <TableCell className="font-medium text-center">{procedure.sequencia}</TableCell>
                      <TableCell className="font-mono text-sm">{procedure.procedimento}</TableCell>
                      <TableCell>
                        <div className="space-y-1">
                          <div className="flex items-center space-x-2">
                            <p className="font-medium text-sm leading-tight">
                              {(procedure as any).procedure_description || procedure.descricao || procedure.sigtapProcedure?.description || `Procedimento ${procedure.procedimento}`}
                            </p>
                            {procedure.sequencia === 1 && (
                              <Badge variant="default" className="text-xs bg-green-600 text-white px-2 py-0.5">
                                Principal
                              </Badge>
                            )}
                            {isFirstSurgeon && (
                              <Badge variant="default" className="text-xs bg-blue-600 text-white px-2 py-0.5">
                                1º Cirurgião
                              </Badge>
                            )}
                            {isAnesthetist && !(dupIssue === 'missing' || dupIssue === 'wrong') && (
                              <Badge variant="default" className="text-xs bg-emerald-600 text-white px-2 py-0.5">
                                Anestesista
                              </Badge>
                            )}
                            {dupIssue === 'missing' && (
                              <Badge variant="default" className="text-xs bg-red-600 text-white px-2 py-0.5">
                                CBO Anestesista Ausente
                              </Badge>
                            )}
                            {dupIssue === 'wrong' && (
                              <Badge variant="default" className="text-xs bg-red-600 text-white px-2 py-0.5">
                                CBO Anestesista Incorreto
                              </Badge>
                            )}
                          </div>
                          {procedure.sigtapProcedure && (
                            <p className="text-xs text-gray-500 leading-tight">
                              SIGTAP: {procedure.sigtapProcedure.description}
                            </p>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-center">
                        <div className="flex items-center justify-center w-full min-w-[60px]">
                          <div className="relative inline-flex items-center">
                            {/* Container do input com controles */}
                            <div className="relative flex items-center bg-white rounded-lg border-2 border-gray-200 
                                          hover:border-blue-300 shadow-sm hover:shadow-md transition-all duration-200
                                          focus-within:ring-2 focus-within:ring-blue-500 focus-within:border-blue-500 focus-within:shadow-lg">
                              
                              {/* Botão decrementar */}
                              <button
                                type="button"
                                onClick={() => {
                                  const currentQty = procedure.quantity || 1;
                                  if (currentQty > 1) {
                                    handleQuantityChange(procedure.sequencia, currentQty - 1);
                                  }
                                }}
                                className="w-6 h-6 flex items-center justify-center text-gray-500 hover:text-blue-600 
                                         hover:bg-blue-50 rounded-l-md transition-colors duration-150
                                         disabled:opacity-50 disabled:cursor-not-allowed"
                                disabled={(procedure.quantity || 1) <= 1}
                                title="Diminuir quantidade"
                              >
                                <span className="text-sm font-bold">−</span>
                              </button>

                              {/* Input central */}
                              <input
                                type="number"
                                min="1"
                                max="99"
                                value={procedure.quantity || 1}
                                onChange={(e) => handleQuantityChange(procedure.sequencia, Number(e.target.value))}
                                className="w-10 h-6 px-1 text-sm font-semibold text-center border-0 bg-transparent
                                         focus:outline-none focus:ring-0 appearance-none"
                                title={`Quantidade do procedimento (atual: ${procedure.quantity || 1})`}
                                onBlur={(e) => {
                                  const value = Number(e.target.value);
                                  if (value < 1) {
                                    e.target.value = "1";
                                    handleQuantityChange(procedure.sequencia, 1);
                                  }
                                  if (value > 99) {
                                    e.target.value = "99";
                                    handleQuantityChange(procedure.sequencia, 99);
                                  }
                                }}
                              />

                              {/* Botão incrementar */}
                              <button
                                type="button"
                                onClick={() => {
                                  const currentQty = procedure.quantity || 1;
                                  if (currentQty < 99) {
                                    handleQuantityChange(procedure.sequencia, currentQty + 1);
                                  }
                                }}
                                className="w-6 h-6 flex items-center justify-center text-gray-500 hover:text-blue-600 
                                         hover:bg-blue-50 rounded-r-md transition-colors duration-150
                                         disabled:opacity-50 disabled:cursor-not-allowed"
                                disabled={(procedure.quantity || 1) >= 99}
                                title="Aumentar quantidade"
                              >
                                <span className="text-sm font-bold">+</span>
                              </button>

                              {/* Indicador visual para quantidade > 1 */}
                              {procedure.quantity && procedure.quantity > 1 && (
                                <div className="absolute -top-2 -right-2 w-4 h-4 bg-gradient-to-r from-blue-500 to-blue-600 
                                               rounded-full flex items-center justify-center shadow-lg">
                                  <span className="text-[10px] font-bold text-white">×</span>
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        {/* COLUNA VALORES - LÓGICA REFINADA PARA ANESTESISTAS */}
                        {(() => {
                          const anesthetistInfo = getAnesthetistProcedureType(effectiveCbo, procedure.procedimento);
                          
                          if (String((procedure as any).procedimento || '').trim().startsWith('04') && partCode === '04') {
                            const isIssue = dupIssue === 'missing' || dupIssue === 'wrong'
                            const badgeText = isIssue
                              ? (dupIssue === 'missing' ? 'CBO Anestesista Ausente' : 'CBO Anestesista Incorreto')
                              : 'Anestesista'
                            const badgeClass = isIssue
                              ? 'bg-red-100 text-red-700 border-red-300'
                              : 'bg-emerald-100 text-emerald-700 border-emerald-300'
                            const textClass = isIssue ? 'text-red-600' : 'text-emerald-700'
                            const subTextClass = isIssue ? 'text-red-500' : 'text-emerald-600'
                            return (
                              <div className="text-center py-4">
                                <div className="flex flex-col items-center gap-2">
                                  <Badge variant="outline" className={`${badgeClass} text-xs px-3 py-1`}>
                                    {badgeText}
                                  </Badge>
                                  <div className={`text-sm font-medium ${textClass}`}>
                                    Qtd: {procedure.quantity || 1}
                                  </div>
                                  {anesthetistInfo.message ? (
                                    <div className={`text-xs ${subTextClass}`}>
                                      {anesthetistInfo.message}
                                    </div>
                                  ) : null}
                                </div>
                              </div>
                            );
                          }

                          if (anesthetistInfo.isAnesthetist && !anesthetistInfo.shouldCalculate) {
                            return (
                              <div className="text-center py-4">
                                <div className="flex flex-col items-center gap-2">
                                  <Badge 
                                    variant={anesthetistInfo.badgeVariant} 
                                    className={`${anesthetistInfo.badgeClass} text-xs px-3 py-1 animate-pulse`}
                                  >
                                    {anesthetistInfo.badge}
                                  </Badge>
                                  <div className="text-sm text-red-600 font-medium">
                                    Qtd: {procedure.quantity || 1}
                                  </div>
                                  <div className="text-xs text-red-500">
                                    {anesthetistInfo.message}
                                  </div>
                                </div>
                              </div>
                            );
                          } else if (procedure.sigtapProcedure && (procedure.valorCalculadoSH !== undefined || procedure.valorCalculadoSP !== undefined)) {
                            // ✅ PROCEDIMENTO NORMAL OU ANESTESISTA 03.xxx: Exibir valores SP + SH
                            return (
                              <div className="text-center py-2">
                                <div className="font-bold text-lg text-green-600 mb-1">
                                  {formatCurrency((procedure.valorCalculadoSH || 0) + (procedure.valorCalculadoSP || 0))}
                                </div>
                                <div className="flex flex-col items-center gap-1">
                                  {anesthetistInfo.isAnesthetist && (
                                    <Badge 
                                      variant={anesthetistInfo.badgeVariant}
                                      className={`${anesthetistInfo.badgeClass} text-xs px-2 py-0.5`}
                                    >
                                      {anesthetistInfo.badge}
                                    </Badge>
                                  )}
                                  <div className="text-xs text-gray-500">
                                    SP + SH {procedure.quantity && procedure.quantity > 1 && (
                                      <span className="text-blue-600 font-medium">
                                        ({formatCurrency(((procedure.valorCalculadoSH || 0) + (procedure.valorCalculadoSP || 0)) / procedure.quantity)} × {procedure.quantity})
                                      </span>
                                    )}
                                  </div>
                                  <div className="flex justify-center">
                                    {procedure.isInstrument04 ? (
                                      <Badge variant="outline" className="text-xs px-2 bg-blue-100 text-blue-800 border-blue-300">
                                        🎯 Instrumento 04
                                      </Badge>
                                    ) : procedure.isSpecialRule ? (
                                      <Badge variant="outline" className="text-xs px-2 bg-orange-100 text-orange-800 border-orange-300">
                                        ⚡ Regra Especial
                                      </Badge>
                                    ) : (
                                      <Badge variant="outline" className="text-xs px-2">
                                        {procedure.porcentagemSUS || (procedure.sequencia === 1 ? '100' : 'Manual')}% SUS
                                      </Badge>
                                    )}
                                  </div>
                                </div>
                              </div>
                            );
                          } else if (procedure.valorCalculado && procedure.sigtapProcedure) {
                            // ✅ PROCEDIMENTO NORMAL: Exibir valor total
                            return (
                              <div className="text-center py-2">
                                <div className="font-bold text-lg text-green-600 mb-1">
                                  {formatCurrency(procedure.valorCalculado)}
                                </div>
                                <div className="flex flex-col items-center gap-1">
                                  {anesthetistInfo.isAnesthetist && (
                                    <Badge 
                                      variant={anesthetistInfo.badgeVariant}
                                      className={`${anesthetistInfo.badgeClass} text-xs px-2 py-0.5`}
                                    >
                                      {anesthetistInfo.badge}
                                    </Badge>
                                  )}
                                  <div className="text-xs text-gray-500">
                                    Valor Total {procedure.quantity && procedure.quantity > 1 && (
                                      <span className="text-blue-600 font-medium">
                                        ({formatCurrency(procedure.valorCalculado / procedure.quantity)} × {procedure.quantity})
                                      </span>
                                    )}
                                  </div>
                                  <div className="flex justify-center">
                                    {procedure.isInstrument04 ? (
                                      <Badge variant="outline" className="text-xs px-2 bg-blue-100 text-blue-800 border-blue-300">
                                        🎯 Instrumento 04
                                      </Badge>
                                    ) : procedure.isSpecialRule ? (
                                      <Badge variant="outline" className="text-xs px-2 bg-orange-100 text-orange-800 border-orange-300">
                                        ⚡ Regra Especial
                                      </Badge>
                                    ) : (
                                      <Badge variant="outline" className="text-xs px-2">
                                        {procedure.porcentagemSUS || (procedure.sequencia === 1 ? '100' : 'Manual')}% SUS
                                      </Badge>
                                    )}
                                  </div>
                                </div>
                              </div>
                            );
                          } else {
                            return (
                              <div className="text-center py-4">
                                <span className="text-gray-400 text-sm">Não calculado</span>
                              </div>
                            );
                          }
                        })()}
                      </TableCell>
                      <TableCell className="text-center">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => toggleProcedureExpansion(procedure.sequencia)}
                          className="h-8 w-8 p-0 hover:bg-gray-100"
                        >
                          {expandedProcedures.has(procedure.sequencia) ? 
                            <ChevronDown className="w-4 h-4" /> : 
                            <ChevronRight className="w-4 h-4" />
                          }
                        </Button>
                      </TableCell>
                      <TableCell className="text-center">
                        <div className="flex items-center justify-center">
                          {/* Botão Excluir (vermelho) - ÚNICO BOTÃO MANTIDO */}
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleDeleteProcedure(procedure.sequencia)}
                            className="h-7 px-2 text-red-600 hover:text-red-700 hover:bg-red-50 border-red-200"
                            title="Excluir permanentemente"
                          >
                            <Trash2 className="w-3 h-3" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                    
                    {/* DETALHES EXPANDIDOS - NOVA VERSÃO COM EDIÇÃO DE VALORES */}
                    {expandedProcedures.has(procedure.sequencia) && (
                      <TableRow>
                        <TableCell colSpan={6} className="bg-gray-50 p-4">
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            
                            {/* COLUNA 1: INFORMAÇÕES TÉCNICAS */}
                            <div>
                              <h5 className="font-medium text-sm text-gray-600 mb-2">📋 Informações Técnicas</h5>
                              <div className="bg-white p-3 rounded border text-sm space-y-1">
                                <p><span className="font-medium">CBO:</span> {procedure.cbo}</p>
                                <p><span className="font-medium">Data:</span> {procedure.data}</p>
                                <p><span className="font-medium">Quantidade:</span> 
                                  <span className="ml-1 px-2 py-1 bg-blue-100 text-blue-800 rounded text-xs font-medium">
                                    {procedure.quantity || 1}x
                                  </span>
                                  {procedure.quantity && procedure.quantity > 1 && procedure.valorUnitario && (
                                    <span className="ml-2 text-xs text-gray-500">
                                      (Unit: {formatCurrency(procedure.valorUnitario)})
                                    </span>
                                  )}
                                </p>
                                <div className="flex items-start gap-2">
                          <span className="font-medium min-w-[80px]">Participação:</span>
                          <ParticipationDisplay code={procedure.participacao} />
                        </div>
                                <p><span className="font-medium">CNES:</span> {procedure.cnes}</p>
                                {procedure.matchConfidence && (
                                  <p><span className="font-medium">Confiança:</span> {(procedure.matchConfidence * 100).toFixed(1)}%</p>
                                )}
                              </div>

                              {/* SIGTAP INFO */}
                              {procedure.sigtapProcedure && (
                                <div className="mt-4">
                                  <h5 className="font-medium text-sm text-gray-600 mb-2">🎯 Match SIGTAP</h5>
                                  <div className="bg-white p-3 rounded border text-sm space-y-1">
                                    <p><span className="font-medium">Código:</span> {procedure.sigtapProcedure.code}</p>
                                    <p><span className="font-medium">Descrição:</span> {procedure.sigtapProcedure.description}</p>
                                    <p><span className="font-medium">Complexidade:</span> {procedure.sigtapProcedure.complexity}</p>
                                  </div>
                                </div>
                              )}
                            </div>

                            {/* COLUNA 2: EDIÇÃO DE VALORES */}
                            {procedure.sigtapProcedure && (
                              <div>
                                <div className="flex items-center justify-between mb-3">
                                  <h5 className="font-medium text-sm text-gray-600">💰 Editar Valores SUS</h5>
                                  {/* INDICADOR DE REGRA ESPECIAL OU INSTRUMENTO 04 */}
                                  {(() => {
                                    // Verificar Instrumento 04 primeiro
                                    if (procedure.isInstrument04) {
                                      return (
                                        <Badge variant="outline" className="text-xs bg-blue-100 text-blue-800 border-blue-300">
                                          🎯 Instrumento 04 - Sempre 100%
                                        </Badge>
                                      );
                                    }
                                    
                                    // Verificar regras especiais de cirurgias múltiplas
                                    const procedimentoPrincipal = aihCompleta.procedimentoPrincipal || '';
                                    const temRegraEspecial = hasSpecialRule(procedimentoPrincipal);
                                    const regra = getSpecialRule(procedimentoPrincipal);
                                    
                                    return temRegraEspecial && regra ? (
                                      <Badge variant="outline" className="text-xs bg-orange-100 text-orange-800 border-orange-300">
                                        ⚡ {regra.procedureName}
                                      </Badge>
                                    ) : (
                                      <Badge variant="outline" className="text-xs">
                                        📊 Padrão SUS
                                      </Badge>
                                    );
                                  })()}
                                </div>

                        {editingValues.has(procedure.sequencia) ? (
                                  // MODO EDIÇÃO
                                  <div className="bg-yellow-50 rounded border-2 border-yellow-200 p-4">
                                    <div className="text-sm font-medium text-gray-700 mb-2">✏️ Editando Valores:</div>
                                    <div className="text-xs text-orange-600 bg-orange-50 p-2 rounded mb-3 border-l-4 border-orange-300">
                                      ⚠️ <strong>AIH fatura apenas SH + SP.</strong> SA é informativo (não faturado em AIH).
                                    </div>
                                    
                                    {/* GRID DE VALORES */}
                                    <div className="grid grid-cols-3 gap-3 mb-4">
                              <div className="text-center">
                                        <label className="text-xs font-medium text-gray-500 block mb-1">
                                          SA (Ambulatorial) 
                                          <span className="block text-xs text-gray-400 italic">ℹ️ Informativo</span>
                                        </label>
                                <input
                                  type="number"
                                  step="0.01"
                                  value={tempValues[procedure.sequencia]?.valorAmb || 0}
                                  onChange={(e) => setTempValues(prev => ({
                                    ...prev,
                                    [procedure.sequencia]: {
                                      ...prev[procedure.sequencia],
                                      valorAmb: Number(e.target.value)
                                    }
                                  }))}
                                          className="w-full px-2 py-2 text-sm border rounded text-center bg-gray-50 text-gray-600"
                                          disabled
                                          title="SA é apenas informativo - não faturado em AIH"
                                />
                              </div>
                              <div className="text-center">
                                        <label className="text-xs font-medium text-gray-600 block mb-1">SH (Hospitalar)</label>
                                <input
                                  type="number"
                                  step="0.01"
                                  value={tempValues[procedure.sequencia]?.valorHosp || 0}
                                  onChange={(e) => setTempValues(prev => ({
                                    ...prev,
                                    [procedure.sequencia]: {
                                      ...prev[procedure.sequencia],
                                      valorHosp: Number(e.target.value)
                                    }
                                  }))}
                                          className="w-full px-2 py-2 text-sm border rounded text-center"
                                />
                              </div>
                              <div className="text-center">
                                        <label className="text-xs font-medium text-gray-600 block mb-1">SP (Profissional)</label>
                                <input
                                  type="number"
                                  step="0.01"
                                  value={tempValues[procedure.sequencia]?.valorProf || 0}
                                  onChange={(e) => setTempValues(prev => ({
                                    ...prev,
                                    [procedure.sequencia]: {
                                      ...prev[procedure.sequencia],
                                      valorProf: Number(e.target.value)
                                    }
                                  }))}
                                          className="w-full px-2 py-2 text-sm border rounded text-center"
                                          disabled={(() => {
                                            // SP sempre 100% nas regras especiais
                                            const procedimentoPrincipal = aihCompleta.procedimentoPrincipal || '';
                                            return hasSpecialRule(procedimentoPrincipal);
                                          })()}
                                />
                              </div>
                            </div>

                                    {/* CONTROLE DE PORCENTAGEM - APENAS PARA SH */}
                                    <div className="bg-white rounded p-3 border mb-4">
                                      <div className="flex items-center justify-between mb-2">
                                        <span className="text-sm font-medium text-gray-700">Porcentagem aplicada ao SH:</span>
                                        {(() => {
                                          const procedimentoPrincipal = aihCompleta.procedimentoPrincipal || '';
                                          const temRegraEspecial = hasSpecialRule(procedimentoPrincipal);
                                          const regra = getSpecialRule(procedimentoPrincipal);
                                          
                                          if (temRegraEspecial && regra) {
                                            // Calcular porcentagem da regra especial baseada na sequência
                                            const posicao = procedure.sequencia - 1;
                                            const porcentagemRegra = regra.rule.hospitalPercentages[posicao] || 
                                                                   regra.rule.hospitalPercentages[regra.rule.hospitalPercentages.length - 1];
                                            return (
                                              <Badge variant="outline" className="text-xs bg-orange-100 text-orange-800">
                                                🔒 {porcentagemRegra}% (Automático)
                                              </Badge>
                                            );
                                          }
                                          return null;
                                        })()}
                                      </div>
                                      
                                      <div className="flex items-center space-x-3">
                              <input
                                type="number"
                                min="0"
                                max="100"
                                          value={(() => {
                                            const procedimentoPrincipal = aihCompleta.procedimentoPrincipal || '';
                                            const temRegraEspecial = hasSpecialRule(procedimentoPrincipal);
                                            const regra = getSpecialRule(procedimentoPrincipal);
                                            
                                            if (temRegraEspecial && regra) {
                                              // Usar porcentagem da regra especial
                                              const posicao = procedure.sequencia - 1;
                                              return regra.rule.hospitalPercentages[posicao] || 
                                                     regra.rule.hospitalPercentages[regra.rule.hospitalPercentages.length - 1];
                                            }
                                            
                                            // Usar porcentagem editável
                                            return tempValues[procedure.sequencia]?.porcentagem || 100;
                                          })()}
                                          onChange={(e) => {
                                            // Só permitir edição se não for regra especial
                                            const procedimentoPrincipal = aihCompleta.procedimentoPrincipal || '';
                                            if (!hasSpecialRule(procedimentoPrincipal)) {
                                              setTempValues(prev => ({
                                  ...prev,
                                  [procedure.sequencia]: {
                                    ...prev[procedure.sequencia],
                                    porcentagem: Number(e.target.value)
                                  }
                                              }));
                                            }
                                          }}
                                          className="w-20 px-2 py-1 text-sm border rounded text-center"
                                          disabled={(() => {
                                            const procedimentoPrincipal = aihCompleta.procedimentoPrincipal || '';
                                            return hasSpecialRule(procedimentoPrincipal);
                                          })()}
                                        />
                                        <span className="text-sm text-gray-500">% (aplicado apenas ao SH)</span>
                            </div>
                            </div>

                                    {/* REGRAS ESPECIAIS INFO */}
                                    {(() => {
                                      const procedimentoPrincipal = aihCompleta.procedimentoPrincipal || '';
                                      const temRegraEspecial = hasSpecialRule(procedimentoPrincipal);
                                      const regra = getSpecialRule(procedimentoPrincipal);
                                      
                                      return temRegraEspecial && regra ? (
                                        <div className="bg-orange-50 border border-orange-200 rounded p-3 mb-4">
                                          <div className="text-xs font-medium text-orange-800 mb-2">
                                            ⚡ Regra Especial Ativa: {regra.procedureName}
                                  </div>
                                          <div className="grid grid-cols-2 gap-3 text-xs">
                                            <div>
                                              <span className="font-medium">SH (Hospitalar):</span>
                                              <span className="ml-1">Porcentagem variável por posição</span>
                                </div>
                                            <div>
                                              <span className="font-medium">SP (Profissional):</span>
                                              <span className="ml-1 text-green-700">🔒 Sempre 100%</span>
                                  </div>
                                </div>
                                  </div>
                                      ) : null;
                                    })()}

                                    {/* BOTÕES */}
                                    <div className="flex justify-center space-x-2">
                                      <Button size="sm" onClick={() => saveEditedValues(procedure.sequencia)} className="h-8 px-4 text-sm">
                                        <Check className="w-4 h-4 mr-1" />
                                        Salvar Alterações
                            </Button>
                                      <Button size="sm" variant="outline" onClick={() => cancelEditingValues(procedure.sequencia)} className="h-8 px-4 text-sm">
                                        <X className="w-4 h-4 mr-1" />
                                        Cancelar
                              </Button>
                          </div>
                              </div>
                                ) : (
                                  // MODO VISUALIZAÇÃO
                                  <div className="bg-white rounded border p-4">
                                    <div className="mb-3">
                                      <div className="flex items-center justify-between mb-2">
                                        <span className="font-medium text-gray-700">Valores Atuais:</span>
                                        <Button
                                          size="sm"
                                          variant="outline"
                                          onClick={() => startEditingValues(procedure.sequencia, procedure)}
                                          className="h-7 px-3 text-xs bg-blue-50 hover:bg-blue-100"
                                        >
                                          <Edit className="w-3 h-3 mr-1" />
                                          Editar
                                        </Button>
                                      </div>
                                      
                                      {/* GRID DE VALORES ATUAIS */}
                                      <div className="grid grid-cols-4 gap-3 text-center">
                                        <div className="bg-blue-50 p-2 rounded">
                                          <div className="text-xs text-gray-600 mb-1">SA</div>
                                          <div className="font-semibold text-blue-600 text-sm">
                                            {formatCurrency(procedure.sigtapProcedure.valueAmb)}
                                          </div>
                                        </div>
                                        <div className="bg-green-50 p-2 rounded">
                                          <div className="text-xs text-gray-600 mb-1">SH</div>
                                          <div className="font-semibold text-green-600 text-sm">
                                          {(() => {
                                            const valorTotalSigtap = procedure.sigtapProcedure.valueHosp;
                                            const valorSP = procedure.sigtapProcedure.valueProf;
                                            const valorSH = valorTotalSigtap - valorSP;
                                              return formatCurrency(valorSH);
                                          })()}
                                        </div>
                                          </div>
                                        <div className="bg-purple-50 p-2 rounded">
                                          <div className="text-xs text-gray-600 mb-1">SP</div>
                                          <div className="font-semibold text-purple-600 text-sm">
                                            {formatCurrency(procedure.sigtapProcedure.valueProf)}
                                          </div>
                                        </div>
                                        <div className="bg-emerald-50 p-2 rounded border-l-2 border-emerald-400">
                                          <div className="text-xs text-gray-600 mb-1">Total Final</div>
                                          <div className="font-bold text-emerald-600">
                                              {formatCurrency(procedure.valorCalculado || 0)}
                                          </div>
                                        </div>
                                      </div>
                                    </div>

                                    {/* LÓGICA APLICADA */}
                                    <div className={`p-3 rounded ${
                                      procedure.isInstrument04 ? 'bg-blue-50 border border-blue-200' : 
                                      procedure.isSpecialRule ? 'bg-orange-50 border border-orange-200' : 
                                      'bg-gray-50'
                                    }`}>
                                      <div className="flex items-center justify-between mb-2">
                                        <span className={`font-medium text-sm ${
                                          procedure.isInstrument04 ? 'text-blue-700' : 
                                          procedure.isSpecialRule ? 'text-orange-700' : 
                                          'text-gray-700'
                                        }`}>
                                          {procedure.isInstrument04 ? '🎯 Instrumento 04 - AIH (Proc. Especial):' : 
                                           procedure.isSpecialRule ? '⚡ Regra Especial Aplicada:' : 
                                           '📊 Lógica SUS Padrão:'}
                                        </span>
                                      </div>
                                      
                                      {procedure.isInstrument04 ? (
                                        <div className="text-xs space-y-1">
                                          <div className="text-blue-700 font-medium mb-1">
                                            ✅ Instrumento 04 - Sempre 100% (faturamento: SH + SP)
                                          </div>
                                          <div className="flex justify-between bg-green-50 px-2 py-1 rounded">
                                            <span className="text-green-700">💰 SH (100%):</span>
                                            <span className="font-semibold text-green-700">{formatCurrency(procedure.valorCalculadoSH || 0)}</span>
                                          </div>
                                          <div className="flex justify-between bg-green-50 px-2 py-1 rounded">
                                            <span className="text-green-700">💰 SP (100%):</span>
                                            <span className="font-semibold text-green-700">{formatCurrency(procedure.valorCalculadoSP || 0)}</span>
                                          </div>
                                          <div className="flex justify-between bg-gray-50 px-2 py-1 rounded">
                                            <span className="text-gray-500">ℹ️ SA (informativo):</span>
                                            <span className="font-semibold text-gray-500">{formatCurrency(procedure.valorCalculadoSA || 0)}</span>
                                          </div>
                                          <div className="flex justify-between border-t pt-1 mt-1">
                                            <span className="font-bold text-blue-700">💰 TOTAL FATURADO:</span>
                                            <span className="font-bold text-blue-700">{formatCurrency((procedure.valorCalculadoSH || 0) + (procedure.valorCalculadoSP || 0))}</span>
                                          </div>
                                        </div>
                                      ) : procedure.isSpecialRule ? (
                                        <div className="text-xs space-y-1">
                                          <div className="text-orange-700 font-medium mb-1">
                                            ⚡ Regra Especial - Faturamento: SH + SP
                                          </div>
                                          <div className="flex justify-between bg-green-50 px-2 py-1 rounded">
                                            <span className="text-green-700">💰 SH ({procedure.porcentagemSUS}%):</span>
                                            <span className="font-semibold text-green-700">{formatCurrency(procedure.valorCalculadoSH || 0)}</span>
                                          </div>
                                          <div className="flex justify-between bg-green-50 px-2 py-1 rounded">
                                            <span className="text-green-700">💰 SP (100%):</span>
                                            <span className="font-semibold text-green-700">{formatCurrency(procedure.valorCalculadoSP || 0)}</span>
                                          </div>
                                          <div className="flex justify-between bg-gray-50 px-2 py-1 rounded">
                                            <span className="text-gray-500">ℹ️ SA (informativo):</span>
                                            <span className="font-semibold text-gray-500">{formatCurrency(procedure.valorCalculadoSA || 0)}</span>
                                          </div>
                                          <div className="flex justify-between border-t pt-1 mt-1">
                                            <span className="font-bold text-orange-700">💰 TOTAL FATURADO:</span>
                                            <span className="font-bold text-orange-700">{formatCurrency((procedure.valorCalculadoSH || 0) + (procedure.valorCalculadoSP || 0))}</span>
                                          </div>
                                        </div>
                                      ) : (
                                        <div className="text-sm">
                                          <span>Aplicada porcentagem de </span>
                                          <strong>{procedure.porcentagemSUS || (procedure.sequencia === 1 ? 100 : 'Manual')}%</strong>
                                          <span> sobre o valor total SIGTAP</span>
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                )}
                                </div>
                              )}
                          </div>
                        </TableCell>
                      </TableRow>
                    )}
                  </React.Fragment>
                ))
                })()}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

const AIHMultiPageTester = () => {
  const [isProcessing, setIsProcessing] = useState(false);
  const [isMatching, setIsMatching] = useState(false);
  const [result, setResult] = useState<AIHCompleteProcessingResult | null>(null);
  const [aihCompleta, setAihCompleta] = useState<AIHComplete | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [aihSaved, setAihSaved] = useState(false);
  const [isDragOver, setIsDragOver] = useState(false);
  // Excel/CSV import state
  const [hospitalIdExcel, setHospitalIdExcel] = useState('');
  const [excelPatientsRows, setExcelPatientsRows] = useState<Record<string, any>[]>([]);
  const [excelAihsRows, setExcelAihsRows] = useState<Record<string, any>[]>([]);
  const [excelProcRows, setExcelProcRows] = useState<Record<string, any>[]>([]);
  const [excelLoading, setExcelLoading] = useState(false);
  const [excelResult, setExcelResult] = useState<any>(null);
  const [safeMode, setSafeMode] = useState(true)
  const [dryRun, setDryRun] = useState(false)
  const [importBatchId, setImportBatchId] = useState('')
  const [hospitalsList, setHospitalsList] = useState<Array<{id: string; name: string; cnes?: string}>>([])
  const [hospitalsLoading, setHospitalsLoading] = useState(false)
  const { toast } = useToast();
  const { procedures: sigtapProcedures, isLoading: sigtapLoading, totalProcedures } = useSigtapContext();
  const { user } = useAuth();
  
  // MODO DESENVOLVIMENTO: valores padrão se não autenticado
  const safeUser = user || { id: 'dev-user', email: 'developer@test.com' };
  const safeHospital = { id: user?.hospital_id || '68bf9b1a-9d0b-423b-9bb3-3c02017b1d7b', name: 'Hospital de Desenvolvimento' };

  const processor = new AIHCompleteProcessor();
  const matchingService = new ProcedureMatchingService(sigtapProcedures);
  const aihPersistenceService = new AIHPersistenceService();

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      processSelectedFile(file);
    }
  };

  const processSelectedFile = (file: File) => {
    // Validar tipo de arquivo
    if (!file.type.includes('pdf')) {
      toast({
        title: "❌ Arquivo inválido",
        description: "Por favor, selecione apenas arquivos PDF.",
        variant: "destructive"
      });
      return;
    }

    // Validar tamanho (máximo 50MB)
    const maxSize = 50 * 1024 * 1024; // 50MB
    if (file.size > maxSize) {
      toast({
        title: "❌ Arquivo muito grande",
        description: "O arquivo deve ter no máximo 50MB.",
        variant: "destructive"
      });
      return;
    }

    setSelectedFile(file);
    setResult(null);
    setAihCompleta(null);
    // ✅ RESETAR STATUS DE SALVAMENTO QUANDO NOVO ARQUIVO É SELECIONADO
    setAihSaved(false);
    console.log('📄 Arquivo selecionado:', file.name, `(${file.size} bytes)`);
    
    toast({
      title: "✅ Arquivo carregado",
      description: `${file.name} está pronto para processamento.`,
    });
  };

  const handleDragOver = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.stopPropagation();
    setIsDragOver(true);
  };

  const handleDragLeave = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.stopPropagation();
    setIsDragOver(false);
  };

  const handleDrop = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.stopPropagation();
    setIsDragOver(false);

    const files = event.dataTransfer.files;
    if (files.length > 0) {
      const file = files[0];
      processSelectedFile(file);
    }
  };

  useEffect(() => {
    (async () => {
      try {
        setHospitalsLoading(true)
        const { data } = await supabase.from('hospitals').select('id,name,cnes').order('name')
        setHospitalsList(data || [])
      } finally {
        setHospitalsLoading(false)
      }
    })()
  }, [])

  // Excel/CSV helpers
  const parseExcelFile = async (file: File, setRows: (rows: Record<string, any>[]) => void) => {
    const data = await file.arrayBuffer()
    const wb = XLSX.read(data, { type: 'array' })
    const ws = wb.Sheets[wb.SheetNames[0]]
    const rows = XLSX.utils.sheet_to_json<Record<string, any>>(ws, { defval: null })
    setRows(rows)
  }

  const insertExcelBatch = async (table: string, rows: Record<string, any>[]) => {
    const size = 500
    for (let i = 0; i < rows.length; i += size) {
      const chunk = rows.slice(i, i + size).map(r => ({ ...r, hospital_id: hospitalIdExcel, import_batch_id: importBatchId || null }))
      const { error } = await supabase.from(table).insert(chunk)
      if (error) throw error
    }
  }

  const handleExcelImport = async () => {
    if (!hospitalIdExcel) {
      toast({ title: 'hospital_id obrigatório', description: 'Informe o hospital_id para vincular os dados', variant: 'destructive' })
      return
    }
    setExcelLoading(true)
    setExcelResult(null)
    try {
      if (dryRun) {
        const { data, error } = await supabase.rpc('merge_staging_to_core_safe', { p_hospital_id: hospitalIdExcel, p_force_update: !safeMode, p_dry_run: true })
        if (error) throw error
        setExcelResult(data)
        toast({ title: 'Validação concluída', description: 'Dry-run executado. Reveja os totais.', })
        return
      }
      if (excelPatientsRows.length) await insertExcelBatch('staging_patients', excelPatientsRows)
      if (excelAihsRows.length) await insertExcelBatch('staging_aihs', excelAihsRows)
      if (excelProcRows.length) await insertExcelBatch('staging_procedure_records', excelProcRows)
      const { data, error } = await supabase.rpc('merge_staging_to_core_safe', { p_hospital_id: hospitalIdExcel, p_force_update: !safeMode, p_dry_run: false })
      if (error) throw error
      setExcelResult(data)
      toast({ title: 'Importação concluída', description: 'Merge realizado com sucesso', })
    } catch (e: any) {
      setExcelResult({ error: e.message })
      toast({ title: 'Erro na importação', description: String(e.message || e), variant: 'destructive' })
    } finally {
      setExcelLoading(false)
    }
  }

  const handleProcessPDF = async () => {
    if (!selectedFile) {
      toast({
        title: "Erro",
        description: "Selecione um arquivo PDF primeiro",
        variant: "destructive"
      });
      return;
    }

    setIsProcessing(true);
    // ✅ RESETAR STATUS DE SALVAMENTO PARA NOVA AIH
    setAihSaved(false);
    const startTime = Date.now();

    try {
      console.log('🚀 Iniciando processamento multi-página...');
      
      // Processar PDF completo (múltiplas páginas)
      const processingResult = await processor.processCompletePDFAIH(selectedFile, {
        hospitalId: 'teste',
        hospitalName: 'Hospital Teste'
      });

      const totalTime = Date.now() - startTime;

      console.log('✅ Processamento concluído:', processingResult);
      setResult(processingResult);
      
      if (processingResult.aihCompleta) {
        setAihCompleta(processingResult.aihCompleta);
        
        // Executar matching automático se há dados SIGTAP
        if (sigtapProcedures.length > 0) {
          await performAutomaticMatching(processingResult.aihCompleta);
        } else {
          console.warn('⚠️ Nenhum dado SIGTAP carregado para matching');
          toast({
            title: "⚠️ Atenção",
            description: "Carregue a tabela SIGTAP primeiro para calcular valores",
            variant: "destructive"
          });
        }
      }

      toast({
        title: "✅ Processamento concluído",
        description: `AIH processada em ${totalTime}ms. Use o botão "🚀 Salvar AIH Completa" para salvar no banco.`
      });

      // ✅ NOVA LÓGICA: Dados só são salvos quando usuário clicar em "Salvar AIH Completa"
      console.log('📋 AIH processada e pronta para edição.');
      console.log('💡 Para salvar 100% dos dados no banco: use o botão "🚀 Salvar AIH Completa"');

    } catch (error) {
      console.error('❌ Erro no processamento:', error);
      toast({
        title: "Erro no processamento",
        description: error instanceof Error ? error.message : 'Erro desconhecido',
        variant: "destructive"
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const performAutomaticMatching = async (aihData: AIHComplete) => {
    setIsMatching(true);
    
    try {
      console.log('🔍 Iniciando matching automático...');
      toast({
        title: "🔍 Executando matching",
        description: "Buscando procedimentos na tabela SIGTAP..."
      });

      // Atualizar service com dados SIGTAP mais recentes
      matchingService.updateSigtapProcedures(sigtapProcedures);
      
      // Executar matching
      const matchingResult = await matchingService.performMatching(aihData.procedimentos);
      
      if (matchingResult.success) {
        // Atualizar procedimentos com resultados do matching
        // TODOS os procedimentos são APROVADOS por padrão (conforme solicitação do operador)
        const detectAnesthetist = (p: any): boolean => {
          try {
            // 1) Nível do procedimento
            const cboProc = String((p as any)?.cbo || (p as any)?.professional_cbo || '').trim();
            if (cboProc === '225151') return true;
            const partProcRaw = String((p as any)?.participacao || (p as any)?.participation || '');
            const partProcDigits = partProcRaw.replace(/\D/g, '');
            const partProcCode = partProcDigits ? partProcDigits.padStart(2, '0') : '';
            if (partProcCode === '04') return true;
            const partProc = partProcRaw.toLowerCase();
            if (partProc.includes('anestesista') || partProc.includes('anestesia') || partProc.includes('anest')) return true;

            // 2) Nível do profissional (lista profissionais extraída do PDF)
            const list = Array.isArray((p as any)?.profissionais) ? (p as any).profissionais : [];
            for (const pr of list) {
              const cbo = String((pr as any)?.cbo || '').trim();
              if (cbo === '225151') return true;
              const partRaw = String((pr as any)?.participacao || (pr as any)?.participation || '');
              const partDigits = partRaw.replace(/\D/g, '');
              const partCode = partDigits ? partDigits.padStart(2, '0') : '';
              if (partCode === '04') return true;
              const part = partRaw.toLowerCase();
              if (part.includes('anestesista') || part.includes('anestesia') || part.includes('anest')) return true;
              // Varredura robusta: checar quaisquer campos string do profissional
              for (const key of Object.keys(pr || {})) {
                const value = (pr as any)[key];
                if (typeof value === 'string' && value.toLowerCase().includes('anest')) return true;
              }
            }
            return false;
          } catch { return false; }
        };

        const updatedProcedimentos = aihData.procedimentos.map((proc, index) => {
          const matchDetail = matchingResult.matchingDetails[index];
          return {
            ...proc,
            matchStatus: matchDetail.encontrado ? 'matched' as const : 'approved' as const,
            matchConfidence: matchDetail.confidence,
            sigtapProcedure: matchDetail.sigtapMatch,
            valorCalculado: matchDetail.sigtapMatch?.valueHospTotal || 0,
            valorOriginal: matchDetail.sigtapMatch?.valueHospTotal || 0,
            aprovado: true, // SEMPRE aprovado
            isAnesthesiaProcedure: detectAnesthetist(proc)
          };
        });

        // Atualizar AIH completa
        const updatedAIH: AIHComplete = {
          ...aihData,
          procedimentos: updatedProcedimentos,
          procedimentosAprovados: updatedProcedimentos.length, // TODOS aprovados
          procedimentosRejeitados: 0, // ZERO rejeitados por padrão
          valorTotalCalculado: matchingResult.valorTotalCalculado,
          statusGeral: 'aguardando_revisao'
        };

        setAihCompleta(updatedAIH);

        toast({
          title: "✅ Matching concluído!",
          description: `${matchingResult.procedimentosEncontrados}/${matchingResult.totalProcedimentos} procedimentos encontrados - R$ ${matchingResult.valorTotalCalculado.toFixed(2)}`
        });

        console.log('📊 Resultado do matching:', {
          encontrados: matchingResult.procedimentosEncontrados,
          total: matchingResult.totalProcedimentos,
          valor: matchingResult.valorTotalCalculado
        });

        // AIH já foi salva anteriormente no processamento inicial

      } else {
        throw new Error('Falha no matching dos procedimentos');
      }

    } catch (error) {
      console.error('❌ Erro no matching:', error);
      toast({
        title: "Erro no matching",
        description: "Não foi possível fazer matching com SIGTAP",
        variant: "destructive"
      });
    } finally {
      setIsMatching(false);
    }
  };

  const performManualMatching = async () => {
    if (!aihCompleta) return;
    await performAutomaticMatching(aihCompleta);
  };

  const exportDetailedReport = () => {
    if (!aihCompleta || !result) return;

    const report = [
      '='.repeat(80),
      'RELATÓRIO DETALHADO - PROCESSAMENTO MULTI-PÁGINA AIH',
      '='.repeat(80),
      '',
      'INFORMAÇÕES GERAIS:',
      '-'.repeat(40),
      `Arquivo: ${selectedFile?.name}`,
      `Tamanho: ${selectedFile?.size} bytes`,
      `Tempo de processamento: ${result.processingTime}ms`,
      '',
      'DADOS DO PACIENTE:',
      '-'.repeat(40),
      `AIH: ${aihCompleta.numeroAIH}`,
      `Paciente: ${aihCompleta.nomePaciente}`,
      `CNS: ${aihCompleta.cns || 'N/A'}`,
      `Nascimento: ${aihCompleta.nascimento}`,
      `Sexo: ${aihCompleta.sexo}`,
      `Data início: ${aihCompleta.dataInicio}`,
      `Data fim: ${aihCompleta.dataFim || 'N/A'}`,
      `Procedimento principal: ${aihCompleta.procedimentoPrincipal}`,
      '',
      'ANÁLISE DE PÁGINAS:',
      '-'.repeat(40),
      `Total de procedimentos: ${aihCompleta.totalProcedimentos}`,
      `Procedimentos aprovados: ${aihCompleta.procedimentosAprovados}`,
      `Procedimentos rejeitados: ${aihCompleta.procedimentosRejeitados}`,
      `Status geral: ${aihCompleta.statusGeral}`,
      '',
      'DETALHAMENTO DOS PROCEDIMENTOS:',
      '-'.repeat(40),
      ...aihCompleta.procedimentos.map((proc, index) => [
        `${index + 1}. Sequência ${proc.sequencia}:`,
        `   Código: ${proc.procedimento}`,
        `   Descrição: ${proc.descricao || 'N/A'}`,
        `   Data: ${proc.data}`,
        `   CBO: ${proc.cbo}`,
        `   Status: ${proc.matchStatus}`,
        `   Confiança: ${proc.matchConfidence ? (proc.matchConfidence * 100).toFixed(1) + '%' : 'N/A'}`,
        `   Valor: R$ ${(proc.valorCalculado || 0).toFixed(2)}`,
        ''
      ]).flat(),
      'ESTATÍSTICAS DE PROCESSAMENTO:',
      '-'.repeat(40),
      `Total processado: ${result.totalProcessed}`,
      `AIHs válidas: ${result.validAIHs}`,
      `AIHs inválidas: ${result.invalidAIHs}`,
      `Sucesso: ${result.success ? 'Sim' : 'Não'}`,
      '',
      '='.repeat(80)
    ].join('\n');

    const blob = new Blob([report], { type: 'text/plain;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `relatorio_multipage_${aihCompleta.numeroAIH}_${new Date().toISOString().split('T')[0]}.txt`;
    link.click();
  };

  const handleGenerateExecutiveReport = () => {
    if (!aihCompleta || !result) {
      toast({
        title: "Não é possível gerar relatório",
        description: "Primeiro processe uma AIH com sucesso.",
        variant: "destructive"
      });
      return;
    }

    // ✅ MUDANÇA: Usar dados reais da AIH processada (EXCLUINDO anestesistas dos cálculos)
    const procedimentosAprovados = aihCompleta.procedimentos
      .filter(p => p.aprovado && shouldCalculateAnesthetistProcedure(p.cbo, p.procedimento)); // 🚫 EXCLUIR ANESTESISTAS 04.xxx
    const procedimentosAnestesia = aihCompleta.procedimentos.filter(p => p.isAnesthesiaProcedure);
    const procedimentosNormais = procedimentosAprovados.filter(p => !p.isInstrument04);
    const procedimentosInstrumento04 = procedimentosAprovados.filter(p => p.isInstrument04);
    
    const totalOriginal = procedimentosAprovados.reduce((sum, p) => sum + (p.valorOriginal || 0), 0);
    const totalCalculado = procedimentosAprovados.reduce((sum, p) => sum + (p.valorCalculado || 0), 0);
    const economiaGerada = totalOriginal - totalCalculado;
    
    // 📊 CALCULAR MÉDIA DE CONFIDENCE EXCLUINDO ANESTESISTAS
    const avgConfidence = procedimentosAprovados.length > 0 ? 
      procedimentosAprovados.reduce((sum, p) => sum + (p.matchConfidence || 0), 0) / procedimentosAprovados.length : 0;

    const reportData = {
      aihNumber: aihCompleta.numeroAIH || 'N/A',
      patientName: aihCompleta.nomePaciente || 'N/A',
      admissionDate: aihCompleta.dataInicio || '',
      dischargeDate: aihCompleta.dataFim || '',
      mainProcedure: aihCompleta.procedimentoPrincipal || 'N/A',
      
      // ✅ ESTATÍSTICAS CORRIGIDAS (SEM ANESTESISTAS)
      totalProcedures: aihCompleta.totalProcedimentos || 0,
      approvedProcedures: procedimentosAprovados.length,
      anesthesiaProcedures: procedimentosAnestesia.length, // 🚫 ANESTESISTAS SEPARADOS
      rejectedProcedures: 0,
      
      // ✅ VALORES FINANCEIROS (SEM ANESTESISTAS) 
      originalValue: totalOriginal,
      calculatedValue: totalCalculado,
      savings: economiaGerada,
      avgMatchConfidence: avgConfidence,
      
      // Breakdown detalhado
      instrument04Procedures: procedimentosInstrumento04.length,
      normalProcedures: procedimentosNormais.length,
      
      // Dados da extração
      extractionMethod: 'manual',
      extractionConfidence: 0,
      processingTime: result.processingTime || 0,
      
      // Dados do hospital (usar contexto atual)
      hospitalName: 'Hospital não identificado',
      hospitalCode: 'N/A',
      
      // Usuário responsável
      processedBy: user?.email || 'Usuário não identificado',
      processedAt: new Date().toISOString()
    };

    console.log('📊 Gerando relatório executivo com dados:', reportData);

    toast({
      title: "📊 Relatório gerado",
      description: "Dados do relatório executivo foram processados e estão no console.",
    });
  };

  const getStatusBadge = (status: ProcedureAIH['matchStatus']) => {
    const variants = {
      pending: { variant: 'secondary' as const, icon: Clock, text: 'Pendente', color: 'text-yellow-600' },
      matched: { variant: 'default' as const, icon: CheckCircle, text: 'Encontrado', color: 'text-green-600' },
      manual: { variant: 'outline' as const, icon: Target, text: 'Manual', color: 'text-blue-600' },
      rejected: { variant: 'destructive' as const, icon: AlertTriangle, text: 'Rejeitado', color: 'text-red-600' }
    };
    
    const config = variants[status];
    const Icon = config.icon;
    
    return (
      <Badge variant={config.variant} className="flex items-center space-x-1">
        <Icon className={`w-3 h-3 ${config.color}`} />
        <span>{config.text}</span>
      </Badge>
    );
  };

  // Função de diagnóstico do sistema
  const runSystemDiagnostic = async () => {
    try {
      console.log('🔧 === INICIANDO DIAGNÓSTICO DO SISTEMA ===');
      
      // Usar hospital ID correto
      const hospitalId = user?.hospital_id || '68bf9b1a-9d0b-423b-9bb3-3c02017b1d7b';
      console.log('🏥 Hospital ID para diagnóstico:', hospitalId);
      
      // Teste da função de diagnóstico
      await AIHPersistenceService.diagnoseSystem(hospitalId);
      
      toast({
        title: "🔧 Diagnóstico Executado",
        description: "Verifique o console para os resultados detalhados",
        variant: "default",
      });
      
    } catch (error) {
      console.error('❌ Erro no diagnóstico:', error);
      toast({
        title: "❌ Erro no Diagnóstico",
        description: `Erro: ${error instanceof Error ? error.message : 'Desconhecido'}`,
        variant: "destructive",
      });
    }
  };

  const handleSaveToDatabase = async () => {
    if (!aihCompleta) {
      toast({
        title: "Erro",
        description: "Nenhuma AIH processada para salvar",
        variant: "destructive",
      });
      return;
    }

    try {
      setIsProcessing(true);
      console.log('💾 Salvando AIH no banco de dados...');

      // Converter AIHComplete para formato AIH do serviço
      const aihForService: AIH = {
        numeroAIH: aihCompleta.numeroAIH,
        nomePaciente: aihCompleta.nomePaciente,
        cns: aihCompleta.cns,
        nascimento: aihCompleta.nascimento,
        sexo: aihCompleta.sexo,
        prontuario: aihCompleta.prontuario,
        endereco: aihCompleta.endereco,
        municipio: aihCompleta.municipio,
        uf: aihCompleta.uf,
        cep: aihCompleta.cep,
        telefone: aihCompleta.telefone,
        nomeMae: aihCompleta.nomeMae,
        nacionalidade: aihCompleta.nacionalidade,
        racaCor: aihCompleta.racaCor,
        tipoDocumento: aihCompleta.tipoDocumento,
        documento: aihCompleta.documento,
        nomeResponsavel: aihCompleta.nomeResponsavel,
        bairro: aihCompleta.bairro,
        numero: aihCompleta.numero,
        complemento: aihCompleta.complemento,
        dataInicio: aihCompleta.dataInicio,
        dataFim: aihCompleta.dataFim,
        dataAutorizacao: aihCompleta.dataAutorizacao,
        situacao: aihCompleta.situacao,
        tipo: aihCompleta.tipo,
        apresentacao: aihCompleta.apresentacao,
        cnsAutorizador: aihCompleta.cnsAutorizador,
        cnsSolicitante: aihCompleta.cnsSolicitante,
        cnsResponsavel: aihCompleta.cnsResponsavel,
        procedimentoPrincipal: aihCompleta.procedimentoPrincipal,
        procedimentoSolicitado: aihCompleta.procedimentoSolicitado,
        mudancaProc: aihCompleta.mudancaProc,
        cidPrincipal: aihCompleta.cidPrincipal,
        especialidade: aihCompleta.especialidade,
        modalidade: aihCompleta.modalidade,
        caracterAtendimento: aihCompleta.caracterAtendimento,
        motivoEncerramento: aihCompleta.motivoEncerramento,
        procedimentoSequencial: aihCompleta.procedimentoSequencial,
        procedimentoEspecial: aihCompleta.procedimentoEspecial,
        utiDias: aihCompleta.utiDias,
        atosMedicos: aihCompleta.atosMedicos,
        permanenciaDias: aihCompleta.permanenciaDias,
        complexidadeEspecifica: aihCompleta.complexidadeEspecifica,
        valorDiaria: aihCompleta.valorDiaria,
        observacoesFaturamento: aihCompleta.observacoesFaturamento,
        // Procedimentos realizados (obrigatório)
        procedimentosRealizados: aihCompleta.procedimentos?.map(proc => ({
          linha: proc.sequencia,
          codigo: proc.procedimento,
          descricao: proc.descricao || '',
          profissionais: [{
            documento: proc.documentoProfissional,
            cbo: proc.cbo,
            participacao: proc.participacao,
            cnes: proc.cnes
          }],
          quantidade: 1,
          dataRealizacao: proc.data
        })) || [],
        // Adicionar campos que podem estar faltando
        aihAnterior: '',
        aihPosterior: ''
      };

      // Usar hospital ID do usuário autenticado ou fallback para UUID válido
      const hospitalId = user?.hospital_id || '68bf9b1a-9d0b-423b-9bb3-3c02017b1d7b';
      const sourceFile = selectedFile?.name || 'teste.pdf';

      console.log('🔧 Dados preparados para persistência:', {
        numeroAIH: aihForService.numeroAIH,
        nomePaciente: aihForService.nomePaciente,
        hospitalId: hospitalId,
        usuario: user?.email
      });

      // Competência SUS: somente persistir se o usuário selecionou (não gerar automaticamente aqui)
      try {
        const compRaw = (aihCompleta as any)?.competencia as string | undefined;
        if (compRaw && /^\d{4}-\d{2}-\d{2}$/.test(compRaw)) {
          (aihForService as any).competencia = compRaw;
        }
      } catch {}

      // Permitir salvar quando modo for 'alta' e houver data de alta/admissão
      if (!((aihCompleta as any)?.competencia)) {
        const ref = (aihCompleta as any)?.dataFim || (aihCompleta as any)?.dataInicio;
        // ✅ CORREÇÃO: Usar extractYearMonth sem timezone
        const canDerive = !!extractYearMonth(ref);
        if (!canDerive) {
          toast({
            title: 'Selecione a competência',
            description: 'Para salvar a AIH é necessário escolher a competência (mês/ano).',
            variant: 'destructive'
          });
          setIsProcessing(false);
          return;
        }
        // Derivar competência de alta/admissão e anexar ao payload
        try {
          // ✅ CORREÇÃO: Usar extractYearMonth sem timezone
          const altaYM = extractYearMonth(ref);
          if (altaYM) {
            (aihForService as any).competencia = `${altaYM}-01`;
          }
        } catch {}
      }

      const result = await AIHPersistenceService.persistAIHFromPDF(
        aihForService,
        hospitalId,
        sourceFile
      );

      if (result.success) {
        toast({
          title: "✅ Sucesso!",
          description: result.message,
          variant: "default",
        });
        console.log('✅ AIH salva com sucesso:', result);
      } else {
        toast({
          title: "❌ Erro na persistência",
          description: result.message,
          variant: "destructive",
        });
        console.error('❌ Erro na persistência:', result);
      }

    } catch (error) {
      console.error('❌ Erro ao salvar AIH:', error);
      toast({
        title: "❌ Erro",
        description: `Erro ao salvar: ${error instanceof Error ? error.message : 'Erro desconhecido'}`,
        variant: "destructive",
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleSaveCompleteAIH = async () => {
    if (!aihCompleta) {
      toast({
        title: "❌ Erro",
        description: "Nenhuma AIH processada para salvar.",
        variant: "destructive"
      });
      return;
    }

    setIsProcessing(true);
    try {
      const hospitalId = user?.hospital_id || '68bf9b1a-9d0b-423b-9bb3-3c02017b1d7b';
      
      console.log('🚀 Iniciando persistência COMPLETA da AIH...');
      console.log(`📋 AIH: ${aihCompleta.numeroAIH}`);
      console.log(`🏥 Hospital: ${hospitalId}`);
      console.log(`📊 Procedimentos: ${aihCompleta.procedimentos?.length || 0}`);
      
      // 🔍 DEBUG: Verificar quantidades antes de salvar
      console.log('🔍 VERIFICANDO QUANTIDADES ANTES DE SALVAR:');
      aihCompleta.procedimentos.forEach(proc => {
        console.log(`   Seq ${proc.sequencia}: quantity=${proc.quantity} (${typeof proc.quantity})`);
      });
      
      // ✅ VERIFICAÇÃO DE DUPLICATAS ANTES DE SALVAR
      console.log('🔍 Verificando se AIH já existe no banco...');
      toast({
        title: "🔍 Verificando duplicatas",
        description: "Conferindo se esta AIH já foi salva anteriormente..."
      });

      // Se competência não estiver setada, derivar pela alta/admissão no ato do salvar completo
      if (!((aihCompleta as any)?.competencia)) {
        const ref = (aihCompleta as any)?.dataFim || (aihCompleta as any)?.dataInicio;
        // ✅ CORREÇÃO: Usar extractYearMonth sem timezone
        const canDerive = !!extractYearMonth(ref);
        if (!canDerive) {
          toast({
            title: 'Selecione a competência',
            description: 'Para salvar a AIH completa é necessário escolher a competência (mês/ano).',
            variant: 'destructive'
          });
          setIsProcessing(false);
          return;
        }
      }

      const result = await AIHPersistenceService.persistCompleteAIH(
        aihCompleta,
        hospitalId,
        selectedFile?.name || 'upload_manual.pdf'
      );

      if (result.success) {
        toast({
          title: "🎉 AIH COMPLETA SALVA COM SUCESSO!",
          description: `✅ ${result.message}\n📊 Todos os dados foram preservados no banco.`,
          duration: 5000
        });
        
        console.log('✅ Persistência completa finalizada!');
        console.log(`📄 AIH ID: ${result.aihId}`);
        console.log(`👤 Paciente ID: ${result.patientId}`);
        
        // ✅ MARCAR COMO SALVA PARA EVITAR MÚLTIPLOS SALVAMENTOS
        setAihSaved(true);
        
        // ✅ FEEDBACK VISUAL DE SUCESSO
        toast({
          title: "💾 Sistema atualizado",
          description: "Dados disponíveis para consulta e relatórios!",
          duration: 3000
        });

        // ✅ Rolagem automática para o topo (área de upload) e reset do formulário para novo documento
        try {
          window.scrollTo({ top: 0, behavior: 'smooth' });
        } catch {}

        // 🔄 RESET: limpar arquivo selecionado, estados de processamento e AIH carregada
        try {
          setSelectedFile(null as any);
          setAihCompleta(null as any);
          setResult(null as any);
          setAihSaved(false);
          // Opcional: limpar input file se existir no DOM
          const fileInput = document.getElementById('pdf-upload') as HTMLInputElement | null;
          if (fileInput) fileInput.value = '';
        } catch {}
        
      } else {
        throw new Error(result.message);
      }
    } catch (error) {
      console.error('❌ Erro ao salvar AIH completa:', error);
      
      // ✅ TRATAMENTO ESPECÍFICO PARA DUPLICATAS
      const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido';
      
      if (errorMessage.includes('já existe') || errorMessage.includes('duplicada')) {
        toast({
          title: "⚠️ AIH já existe no sistema",
          description: "Esta AIH já foi salva anteriormente. Para atualizar, use a função de edição.",
          variant: "destructive",
          duration: 5000
        });
      } else {
        toast({
          title: "❌ Erro na persistência completa",
          description: `Falha ao salvar: ${errorMessage}`,
          variant: "destructive"
        });
      }
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header Branco & Preto */}
      <div className="bg-white rounded-xl p-6 border border-gray-200">
        <div className="text-center">
          <h2 className="text-3xl font-bold text-black flex items-center justify-center gap-3 mb-2">
            <div className="p-2 bg-gray-100 rounded-lg">
              <Layers className="w-8 h-8 text-black" />
            </div>
            <span>AIH Avançado</span>
          </h2>
          <p className="text-neutral-700 max-w-2xl mx-auto leading-relaxed">
            Processamento inteligente de PDFs AIH com múltiplas páginas de procedimentos
          </p>
        </div>
      </div>

      {/* Upload Section Refinada */}
      <Card className="border-gray-200">
        <CardHeader className="p-4 border-b border-gray-200">
          <CardTitle className="flex items-center gap-3">
            <div className="p-2 bg-gray-100 rounded-lg">
              <Upload className="w-5 h-5 text-black" />
            </div>
            <span className="text-black">Upload PDF AIH</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6 p-4">
          <div 
            className={`relative border-2 border-dashed rounded-xl p-8 text-center transition-all duration-200 group cursor-pointer ${
              isDragOver 
                ? 'border-black bg-neutral-100' 
                : selectedFile
                  ? 'border-black bg-white'
                  : 'border-gray-300 bg-white'
            }`}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
          >
            <input
              type="file"
              accept=".pdf"
              onChange={handleFileSelect}
              className="hidden"
              id="pdf-upload"
            />
            <label htmlFor="pdf-upload" className="cursor-pointer block">
              <div className="p-3 rounded-xl w-fit mx-auto mb-4 group-hover:scale-105 transition-transform duration-200 bg-gray-100">
                {isDragOver ? (
                  <Upload className="w-12 h-12 text-black" />
                ) : selectedFile ? (
                  <CheckCircle className="w-12 h-12 text-black" />
                ) : (
                  <FileText className="w-12 h-12 text-black" />
                )}
              </div>
              <p className={`font-medium text-lg mb-2 text-black`}>
                {isDragOver 
                  ? 'Solte o arquivo PDF aqui!' 
                  : selectedFile 
                    ? selectedFile.name 
                    : 'Clique ou arraste o PDF AIH aqui'
                }
              </p>
              <p className="text-sm text-neutral-600">
                {isDragOver 
                  ? 'Processamento automático após soltar o arquivo'
                  : selectedFile
                    ? `Arquivo carregado • ${(selectedFile.size / 1024 / 1024).toFixed(2)} MB`
                    : 'Suporte para PDFs com múltiplas páginas • Máximo 50MB'
                }
              </p>
              {selectedFile && (
                <div className="mt-3">
                  <Badge variant="outline" className="bg-white text-black border-gray-300">
                    Pronto para processamento
                  </Badge>
                </div>
              )}
            </label>
          </div>

          {/* Status SIGTAP Neutro */}
          <Alert className="shadow-sm border border-gray-300 bg-white">
            <CheckCircle className="h-4 w-4 text-black" />
            <AlertDescription className="text-black font-medium">
              {sigtapLoading
                ? `Carregando SIGTAP do banco de dados...`
                : sigtapProcedures.length > 0 
                  ? `SIGTAP carregado: ${sigtapProcedures.length.toLocaleString()} procedimentos disponíveis para matching`
                  : `Tabela SIGTAP não carregada. Vá para "SIGTAP" → Upload da tabela primeiro.`
              }
            </AlertDescription>
          </Alert>

          <div className="flex flex-col sm:flex-row gap-3">
            <Button
              onClick={handleProcessPDF}
              disabled={!selectedFile || isProcessing}
              className="flex-1 bg-black hover:bg-neutral-800 text-white shadow-sm transition-colors py-3"
            >
              {isProcessing ? (
                <>
                  <Zap className="w-5 h-5 mr-2 animate-spin" />
                  Processando AIH...
                </>
              ) : (
                <>
                  <Layers className="w-5 h-5 mr-2" />
                  Processar AIH Completa
                </>
              )}
            </Button>

            {aihCompleta && (
              <>
                <Button 
                  onClick={performManualMatching} 
                  variant="outline"
                  disabled={isMatching || sigtapProcedures.length === 0}
                  className="border-black text-black hover:bg-neutral-100 transition-colors py-3"
                >
                  {isMatching ? (
                    <>
                      <Target className="w-5 h-5 mr-2 animate-spin" />
                      Fazendo Matching...
                    </>
                  ) : (
                    <>
                      <Target className="w-5 h-5 mr-2" />
                      Refazer Matching
                    </>
                  )}
                </Button>
              </>
            )}
          </div>
        </CardContent>
      </Card>

      {/* (Removido) Upload Excel/CSV - processado externamente por ETL */}

      {/* Results */}
      {result && (
        <div className="space-y-4">
          {/* Status Alert */}
          <Alert className={result.success ? "border-green-500 bg-green-50" : "border-red-500 bg-red-50"}>
            <CheckCircle className={`h-4 w-4 ${result.success ? 'text-green-600' : 'text-red-600'}`} />
            <AlertDescription className={result.success ? 'text-green-800' : 'text-red-800'}>
              {result.success 
                ? `✅ Processamento concluído em ${result.processingTime}ms`
                : `❌ Erro no processamento: ${result.errors[0]?.message || 'Erro desconhecido'}`
              }
            </AlertDescription>
          </Alert>

          {/* Summary Cards */}
          {aihCompleta && (
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center space-x-2">
                    <FileText className="w-5 h-5 text-blue-600" />
                    <div>
                      <p className="text-sm text-gray-600">Total Procedimentos</p>
                      <p className="text-2xl font-bold text-blue-700">{aihCompleta.totalProcedimentos}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center space-x-2">
                    <CheckCircle className="w-5 h-5 text-green-600" />
                    <div>
                      <p className="text-sm text-gray-600">Aprovados</p>
                      <p className="text-2xl font-bold text-green-700">{aihCompleta.procedimentosAprovados}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center space-x-2">
                    <AlertTriangle className="w-5 h-5 text-yellow-600" />
                    <div>
                      <p className="text-sm text-gray-600">Pendentes</p>
                      <p className="text-2xl font-bold text-yellow-700">
                        {aihCompleta.totalProcedimentos - aihCompleta.procedimentosAprovados - aihCompleta.procedimentosRejeitados}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center space-x-2">
                    <Zap className="w-5 h-5 text-purple-600" />
                    <div>
                      <p className="text-sm text-gray-600">Valor Total</p>
                      <p className="text-2xl font-bold text-purple-700">
                        R$ {(aihCompleta.valorTotalCalculado || 0).toFixed(2)}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}

          {/* INTERFACE ORGANIZADA DA AIH */}
          {aihCompleta && (
            <AIHOrganizedView 
              aihCompleta={aihCompleta} 
              onUpdateAIH={setAihCompleta}
            />
          )}
        </div>
      )}

      {/* SEÇÃO DE SALVAMENTO FINAL */}
      {aihCompleta && (
        <Card className="border-2 border-green-200 bg-gradient-to-r from-green-50 to-emerald-50">
          <CardHeader className="text-center">
            <CardTitle className="flex items-center justify-center space-x-2">
              <Save className="w-6 h-6 text-green-600" />
              <span>💾 Finalizar Processamento</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="text-center space-y-4">
            <p className="text-gray-600">
              ✅ Conferência concluída? Salve a AIH no banco de dados para disponibilizar nos relatórios.
            </p>
            
            <Button 
              onClick={handleSaveCompleteAIH} 
              disabled={isProcessing || aihSaved} 
              className={`
                px-8 py-3 text-lg font-medium
                ${aihSaved 
                  ? "bg-gray-100 border-gray-300 cursor-not-allowed" 
                  : "bg-green-600 hover:bg-green-700 text-white"
                }
              `}
              size="lg"
            >
              {isProcessing ? (
                <>
                  <Save className="w-5 h-5 mr-2 animate-spin" />
                  Salvando AIH...
                </>
              ) : aihSaved ? (
                <>
                  <CheckCircle className="w-5 h-5 mr-2 text-green-600" />
                  ✅ AIH Salva
                </>
              ) : (
                <>
                  <Save className="w-5 h-5 mr-2" />
                  💾 Salvar AIH
                </>
              )}
            </Button>
            
            {aihSaved && (
              <div className="mt-4 p-3 bg-green-100 rounded-lg">
                <p className="text-green-800 text-sm">
                  ✅ <strong>AIH salva com sucesso!</strong> Dados disponíveis para consulta em "Pacientes".
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default AIHMultiPageTester;

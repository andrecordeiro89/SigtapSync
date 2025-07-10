import React, { useState, useEffect } from 'react';
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
  classifyProcedures          // ✅ NOVA função de classificação
} from '../config/susCalculationRules';
import { 
  formatParticipationCode, 
  getParticipationBadge, 
  requiresPayment, 
  isValidParticipationCode 
} from '../config/participationCodes';
import { filterOutAnesthesia } from '../utils/aihCompleteProcessor';

// Declaração de tipo para jsPDF com autoTable
declare module 'jspdf' {
  interface jsPDF {
    lastAutoTable: {
      finalY: number;
    };
  }
}

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
  
  // Função para excluir procedimento (permanentemente)
  const handleDeleteProcedure = (sequencia: number) => {
    const procedureToDelete = aihCompleta.procedimentos.find(p => p.sequencia === sequencia);
    
    if (!procedureToDelete) return;
    
    // Confirmar exclusão
    if (!confirm(`Tem certeza que deseja EXCLUIR PERMANENTEMENTE o procedimento ${procedureToDelete.procedimento}?\n\nEsta ação não pode ser desfeita!`)) {
      return;
    }
    
    const updatedProcedimentos = aihCompleta.procedimentos.filter(proc => proc.sequencia !== sequencia);
    
    // Resequenciar procedimentos
    const resequencedProcedimentos = updatedProcedimentos.map((proc, index) => ({
      ...proc,
      sequencia: index + 1
    }));

    const updatedAIH = calculateTotalsWithPercentage(resequencedProcedimentos);
    onUpdateAIH(updatedAIH);

    toast({
      title: "🗑️ Procedimento excluído",
      description: `Procedimento ${procedureToDelete.procedimento} foi excluído permanentemente`,
      variant: "destructive"
    });
  };
  


  // ✅ FUNÇÃO ATUALIZADA: Calcular totais aplicando lógica SUS (incluindo Instrumento 04)
  const calculateTotalsWithPercentage = (procedimentos: ProcedureAIH[]): AIHComplete => {
    // 🎯 DETECTAR PROCEDIMENTO PRINCIPAL E SUA REGRA (se houver)
    const procedimentoPrincipal = aihCompleta.procedimentoPrincipal || '';
    const regraEspecialPrincipal = getSpecialRule(procedimentoPrincipal);
    const temRegraEspecialGeral = Boolean(regraEspecialPrincipal);
    
    console.log('🔄 ANÁLISE DA AIH:');
    console.log('📋 Procedimento Principal:', procedimentoPrincipal);
    console.log('🏥 Regra Especial Detectada:', regraEspecialPrincipal ? regraEspecialPrincipal.procedureName : 'Nenhuma');
    
    // ✅ SEPARAR PROCEDIMENTOS POR TIPO
    const procedimentosInstrumento04: ProcedureAIH[] = [];
    const procedimentosNormais: ProcedureAIH[] = [];
    const procedimentosComRegrasEspeciais: ProcedureAIH[] = [];

    procedimentos.forEach(proc => {
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

    console.log('🔄 CLASSIFICAÇÃO DOS PROCEDIMENTOS:');
    console.log('🎯 Instrumento 04:', procedimentosInstrumento04.map(p => `${p.sequencia}º - ${p.procedimento}`));
    console.log('🏥 Regras Especiais:', procedimentosComRegrasEspeciais.map(p => `${p.sequencia}º - ${p.procedimento}`));
    console.log('📊 Procedimentos Normais:', procedimentosNormais.map(p => `${p.sequencia}º - ${p.procedimento}`));

    // ✅ PROCESSAR CADA TIPO DE PROCEDIMENTO
    const procedimentosComPercentagem = procedimentos.map((proc, index) => {
      if (!proc.sigtapProcedure) return proc;

      // 🎯 INSTRUMENTO 04 - SEMPRE 100%
      if (isInstrument04Procedure(proc.sigtapProcedure.registrationInstrument)) {
        debugInstrument04Detection(proc.sigtapProcedure.registrationInstrument);
        
        const valorTotalSigtap = proc.sigtapProcedure.valueHosp; // Total extraído
        const valorSP = proc.sigtapProcedure.valueProf;          // SP
        const valorSH = valorTotalSigtap - valorSP;              // SH = Total - SP
        const valorSA = proc.sigtapProcedure.valueAmb;           // SA
        
        console.log(`🎯 INSTRUMENTO 04 - ${proc.procedimento} (${proc.sequencia}º): SEMPRE 100%`);
        
        return {
          ...proc,
          porcentagemSUS: 100, // Sempre 100% para Instrumento 04
          valorCalculado: valorSH + valorSP + valorSA, // Valor total sem desconto
          valorOriginal: valorSH + valorSP + valorSA,
          // Campos específicos para Instrumento 04
          isInstrument04: true,
          instrument04Rule: 'Instrumento 04 - AIH (Proc. Especial) - Sempre 100%',
          valorCalculadoSH: valorSH,
          valorCalculadoSP: valorSP,
          valorCalculadoSA: valorSA,
          isSpecialRule: true, // Marcar como regra especial para interface
          regraEspecial: 'Instrumento 04 - AIH (Proc. Especial)'
        };
      }

      // 🏥 REGRAS ESPECIAIS BASEADAS NO PROCEDIMENTO PRINCIPAL
      if (temRegraEspecialGeral && regraEspecialPrincipal) {
        const valorTotalSigtap = proc.sigtapProcedure.valueHosp; // Total extraído
        const valorSP = proc.sigtapProcedure.valueProf;          // SP
        const valorSH = valorTotalSigtap - valorSP;              // SH = Total - SP
        const valorSA = proc.sigtapProcedure.valueAmb;           // SA
        
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
        const valorSACalculado = valorSA; // SA sempre 100%
        const valorTotalCalculado = valorSHCalculado + valorSPCalculado + valorSACalculado;
        
        console.log(`🏥 REGRA ESPECIAL - ${proc.procedimento} (${proc.sequencia}º na AIH, ${posicaoNaRegra}º na regra ${regraEspecialPrincipal.procedureName}): SH=${hospPercentage}%, SP=100%`);
        
        return {
          ...proc,
          porcentagemSUS: hospPercentage, // Para compatibilidade com interface
          valorCalculado: valorTotalCalculado,
          valorOriginal: valorSH + valorSP + valorSA,
          // Campos adicionais para cirurgias especiais
          valorCalculadoSH: valorSHCalculado,
          valorCalculadoSP: valorSPCalculado,
          valorCalculadoSA: valorSACalculado,
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
      const porcentagem = isPrincipalEntreNormais ? 100 : 70;
      
      // ✅ CALCULAR SP E SH SEPARADAMENTE PARA PROCEDIMENTOS NORMAIS
      const valorTotalSigtap = proc.sigtapProcedure.valueHosp; // Total extraído
      const valorSP = proc.sigtapProcedure.valueProf;          // SP
      const valorSH = valorTotalSigtap - valorSP;              // SH = Total - SP
      const valorSA = proc.sigtapProcedure.valueAmb;           // SA
      
      // Aplicar porcentagem aos valores SH e SP
      const valorSHCalculado = (valorSH * porcentagem) / 100;
      const valorSPCalculado = (valorSP * porcentagem) / 100;
      const valorSACalculado = valorSA; // SA sempre 100%
      const valorTotalCalculado = valorSHCalculado + valorSPCalculado + valorSACalculado;

      console.log(`📊 PROCEDIMENTO NORMAL - ${proc.procedimento} (${proc.sequencia}º na AIH, ${posicaoEntreNormais}º entre normais): ${porcentagem}%`);

      return {
        ...proc,
        porcentagemSUS: porcentagem,
        valorCalculado: valorTotalCalculado,
        valorOriginal: valorSH + valorSP + valorSA,
        // ✅ ADICIONAR CAMPOS SP E SH PARA PROCEDIMENTOS NORMAIS
        valorCalculadoSH: valorSHCalculado,
        valorCalculadoSP: valorSPCalculado,
        valorCalculadoSA: valorSACalculado,
        isSpecialRule: false,
        isInstrument04: false,
        regraEspecial: `Regra padrão: ${porcentagem}% (${posicaoEntreNormais}º procedimento normal)`
      };
    });

    const valorTotalCalculado = procedimentosComPercentagem
      .filter(p => p.aprovado)
      .reduce((sum, p) => sum + (p.valorCalculado || 0), 0);

    return {
      ...aihCompleta,
      procedimentos: procedimentosComPercentagem,
      procedimentosAprovados: procedimentosComPercentagem.filter(p => p.aprovado).length,
      procedimentosRejeitados: procedimentosComPercentagem.filter(p => p.matchStatus === 'rejected').length,
      valorTotalCalculado
    };
  };

  // Iniciar edição de valores - INTEGRADO COM REGRAS ESPECIAIS CORRIGIDAS
  const startEditingValues = (sequencia: number, procedure: ProcedureAIH) => {
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
      
      if (isInstrument04) {
        // Instrumento 04 sempre 100%
        porcentagemParaAplicar = 100;
      } else if (temRegraEspecialGeral && regraEspecialPrincipal) {
        // ✅ CALCULAR POSIÇÃO ENTRE TODOS OS PROCEDIMENTOS (exceto Instrumento 04)
        const procedimentosParaRegra = aihCompleta.procedimentos
          .filter(p => p.sigtapProcedure && 
                      !isInstrument04Procedure(p.sigtapProcedure.registrationInstrument))
          .sort((a, b) => a.sequencia - b.sequencia);
        
        const posicaoNaRegra = procedimentosParaRegra.findIndex(p => p.sequencia === sequencia);
        porcentagemParaAplicar = regraEspecialPrincipal.rule.hospitalPercentages[posicaoNaRegra] || 
                                regraEspecialPrincipal.rule.hospitalPercentages[regraEspecialPrincipal.rule.hospitalPercentages.length - 1];
      } else {
        // ✅ PROCEDIMENTO NORMAL - CALCULAR POSIÇÃO ENTRE PROCEDIMENTOS NORMAIS
        const procedimentosNormais = aihCompleta.procedimentos
          .filter(p => p.sigtapProcedure && 
                      !isInstrument04Procedure(p.sigtapProcedure.registrationInstrument) &&
                      !hasSpecialRule(p.procedimento))
          .sort((a, b) => a.sequencia - b.sequencia);
        
        const posicaoEntreNormais = procedimentosNormais.findIndex(p => p.sequencia === sequencia) + 1;
        porcentagemParaAplicar = posicaoEntreNormais === 1 ? 100 : 70;
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
          
          const valorFinal = valorSHCalculado + valorSPCalculado + valorSACalculado;
          
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
            valorOriginal: valorSH + valorSP + valorSA,
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
          
          // Calcular porcentagem baseada na posição sequencial
          const procedimentosParaRegra = aihCompleta.procedimentos
            .filter(p => p.sigtapProcedure && 
                        !isInstrument04Procedure(p.sigtapProcedure.registrationInstrument))
            .sort((a, b) => a.sequencia - b.sequencia);
          
          const posicaoNaRegra = procedimentosParaRegra.findIndex(p => p.sequencia === sequencia);
          const porcentagemSH = regraEspecialPrincipal.rule.hospitalPercentages[posicaoNaRegra] || 
                               regraEspecialPrincipal.rule.hospitalPercentages[regraEspecialPrincipal.rule.hospitalPercentages.length - 1];
          
          // Aplicar porcentagem APENAS ao SH
          const valorSHCalculado = (valorSH * porcentagemSH) / 100;
          const valorSPCalculado = valorSP; // SP sempre 100%
          const valorSACalculado = valorSA; // SA sempre 100%
          
          const valorFinal = valorSHCalculado + valorSPCalculado + valorSACalculado;
          
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
                  <p className="text-gray-900 text-sm font-mono">{aihCompleta.dataAutorizacao}</p>
                </div>
              </div>
              
              {/* Linha 2: Datas de Internação */}
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mb-3">
                <div>
                  <label className="text-xs font-medium text-gray-600">Data Início</label>
                  <p className="text-gray-900 text-sm font-mono">{aihCompleta.dataInicio}</p>
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-600">Data Fim</label>
                  <p className="text-gray-900 text-sm font-mono">{aihCompleta.dataFim}</p>
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
                    {aihCompleta.nomePaciente}
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
                  <p className="text-gray-900 text-sm">{aihCompleta.nascimento}</p>
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
                    {aihCompleta.caracterAtendimento || 'N/A'}
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
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="text-center p-4 bg-blue-50 rounded-lg border-l-4 border-blue-500">
              <p className="text-sm text-gray-600">Total Procedimentos</p>
              <p className="text-2xl font-bold text-blue-700">{aihCompleta.totalProcedimentos}</p>
            </div>
            <div className="text-center p-4 bg-green-50 rounded-lg border-l-4 border-green-500">
              <p className="text-sm text-gray-600">Aprovados</p>
              <p className="text-2xl font-bold text-green-700">{aihCompleta.procedimentosAprovados}</p>
            </div>
            <div className="text-center p-4 bg-green-100 rounded-lg border-l-4 border-green-600 relative">
              <p className="text-sm text-gray-600">Valor Final</p>
              <p className="text-2xl font-bold text-green-800">
                {formatCurrency(aihCompleta.valorTotalCalculado || 0)}
              </p>
              <div className="absolute top-1 right-1">
                <Badge variant="default" className="text-xs bg-green-600">Final</Badge>
              </div>
            </div>
          </div>
          
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
          <CardTitle>📋 Procedimentos Realizados ({aihCompleta.procedimentos.length})</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="border rounded-lg overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="bg-gray-50">
                  <TableHead className="w-12 text-center">Seq</TableHead>
                  <TableHead className="w-28">Código</TableHead>
                  <TableHead>Procedimento</TableHead>
                  <TableHead className="w-80 text-center">Valores</TableHead>
                  <TableHead className="w-12 text-center">+</TableHead>
                  <TableHead className="w-8 text-center"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {aihCompleta.procedimentos
                  .filter(filterOutAnesthesia) // 🛡️ FILTRO SUS: Remove anestesistas da tela
                  .map((procedure) => (
                  <React.Fragment key={procedure.sequencia}>
                    <TableRow className="hover:bg-gray-50">
                      <TableCell className="font-medium text-center">{procedure.sequencia}</TableCell>
                      <TableCell className="font-mono text-sm">{procedure.procedimento}</TableCell>
                      <TableCell>
                        <div className="space-y-1">
                          <div className="flex items-center space-x-2">
                            <p className="font-medium text-sm leading-tight">{procedure.descricao || `Procedimento ${procedure.procedimento}`}</p>
                            {procedure.sequencia === 1 && (
                              <Badge variant="default" className="text-xs bg-green-600 text-white px-2 py-0.5">
                                Principal
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
                      <TableCell>
                        {/* COLUNA VALORES - EXIBINDO AUTOMATICAMENTE SP + SH */}
                        {procedure.sigtapProcedure && (procedure.valorCalculadoSH !== undefined || procedure.valorCalculadoSP !== undefined) ? (
                          <div className="text-center py-2">
                            <div className="font-bold text-lg text-green-600 mb-1">
                              {formatCurrency((procedure.valorCalculadoSH || 0) + (procedure.valorCalculadoSP || 0))}
                            </div>
                            <div className="flex flex-col items-center gap-1">
                              <div className="text-xs text-gray-500">
                                SP + SH
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
                        ) : procedure.valorCalculado && procedure.sigtapProcedure ? (
                          <div className="text-center py-2">
                            <div className="font-bold text-lg text-green-600 mb-1">
                              {formatCurrency(procedure.valorCalculado)}
                            </div>
                            <div className="flex flex-col items-center gap-1">
                              <div className="text-xs text-gray-500">
                                Valor Total
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
                        ) : (
                          <div className="text-center py-4">
                            <span className="text-gray-400 text-sm">Não calculado</span>
                          </div>
                        )}
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
                                    <div className="text-sm font-medium text-gray-700 mb-3">✏️ Editando Valores:</div>
                                    
                                    {/* GRID DE VALORES */}
                                    <div className="grid grid-cols-3 gap-3 mb-4">
                              <div className="text-center">
                                        <label className="text-xs font-medium text-gray-600 block mb-1">SA (Ambulatorial)</label>
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
                                          className="w-full px-2 py-2 text-sm border rounded text-center"
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
                                            ✅ Procedimento sempre cobrado a 100% (SH, SP e SA)
                                          </div>
                                          <div className="flex justify-between">
                                            <span>SH (100%):</span>
                                            <span className="font-semibold">{formatCurrency(procedure.valorCalculadoSH || 0)}</span>
                                          </div>
                                          <div className="flex justify-between">
                                            <span>SP (100%):</span>
                                            <span className="font-semibold">{formatCurrency(procedure.valorCalculadoSP || 0)}</span>
                                          </div>
                                          <div className="flex justify-between">
                                            <span>SA (100%):</span>
                                            <span className="font-semibold">{formatCurrency(procedure.valorCalculadoSA || 0)}</span>
                                          </div>
                                        </div>
                                      ) : procedure.isSpecialRule ? (
                                        <div className="text-xs space-y-1">
                                          <div className="flex justify-between">
                                            <span>SH ({procedure.porcentagemSUS}%):</span>
                                            <span className="font-semibold">{formatCurrency(procedure.valorCalculadoSH || 0)}</span>
                                          </div>
                                          <div className="flex justify-between">
                                            <span>SP (100%):</span>
                                            <span className="font-semibold">{formatCurrency(procedure.valorCalculadoSP || 0)}</span>
                                          </div>
                                          <div className="flex justify-between">
                                            <span>SA (100%):</span>
                                            <span className="font-semibold">{formatCurrency(procedure.valorCalculadoSA || 0)}</span>
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
                ))}
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
      setSelectedFile(file);
      setResult(null);
      setAihCompleta(null);
      // ✅ RESETAR STATUS DE SALVAMENTO QUANDO NOVO ARQUIVO É SELECIONADO
      setAihSaved(false);
      console.log('📄 Arquivo selecionado:', file.name, `(${file.size} bytes)`);
    }
  };

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
        const updatedProcedimentos = aihData.procedimentos.map((proc, index) => {
          const matchDetail = matchingResult.matchingDetails[index];
          return {
            ...proc,
            matchStatus: matchDetail.encontrado ? 'matched' as const : 'approved' as const,
            matchConfidence: matchDetail.confidence,
            sigtapProcedure: matchDetail.sigtapMatch,
            valorCalculado: matchDetail.sigtapMatch?.valueHospTotal || 0,
            valorOriginal: matchDetail.sigtapMatch?.valueHospTotal || 0,
            aprovado: true // SEMPRE aprovado
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

    // Usar dados reais da AIH processada (com filtro de anestesistas)
    const procedimentosAprovados = aihCompleta.procedimentos
      .filter(filterOutAnesthesia) // 🛡️ FILTRO SUS: Remove anestesistas
      .filter(p => p.aprovado);
    const totalOriginal = procedimentosAprovados.reduce((sum, p) => sum + (p.valorOriginal || 0), 0);
    const totalSigtap = procedimentosAprovados.reduce((sum, p) => sum + (p.valorCalculado || 0), 0);
    const totalDiferenca = totalOriginal - totalSigtap;
    const dataAtual = new Date().toLocaleDateString('pt-BR');
    const horaAtual = new Date().toLocaleTimeString('pt-BR');

    // Criar PDF
    const pdf = new jsPDF();
    
    // Configurar fonte
    pdf.setFont('helvetica');
    
    // CABEÇALHO
    pdf.setFillColor(41, 128, 185); // Azul
    pdf.rect(0, 0, 210, 40, 'F');
    
    pdf.setTextColor(255, 255, 255);
    pdf.setFontSize(20);
    pdf.text('RELATÓRIO EXECUTIVO - PROCESSAMENTO AIH', 15, 20);
    
    pdf.setFontSize(12);
    pdf.text(`Sistema SIGTAP Sync | ${dataAtual} ${horaAtual}`, 15, 30);
    
    // Reset cor do texto
    pdf.setTextColor(0, 0, 0);
    
    let yPos = 50;

    // INFORMAÇÕES DO PROCESSAMENTO
    pdf.setFontSize(14);
    pdf.setFont('helvetica', 'bold');
    pdf.text('INFORMAÇÕES DO PROCESSAMENTO', 15, yPos);
    
    yPos += 10;
    pdf.setFontSize(10);
    pdf.setFont('helvetica', 'normal');
    
    pdf.text(`AIH: ${aihCompleta.numeroAIH}`, 15, yPos);
    yPos += 6;
    pdf.text(`Paciente: ${aihCompleta.nomePaciente}`, 15, yPos);
    yPos += 6;
    pdf.text(`Arquivo Processado: ${selectedFile?.name || 'arquivo.pdf'}`, 15, yPos);
    yPos += 6;
    pdf.text(`Tempo de Processamento: ${result.processingTime} ms`, 15, yPos);
    
    yPos += 15;

    // RESUMO EXECUTIVO
    pdf.setFontSize(14);
    pdf.setFont('helvetica', 'bold');
    pdf.text('RESUMO EXECUTIVO', 15, yPos);
    
    yPos += 15;
    
    // Criar tabela de resumo
    const resumoData = [
      ['Total Procedimentos', aihCompleta.totalProcedimentos.toString()],
      ['Procedimentos Aprovados', aihCompleta.procedimentosAprovados.toString()],
      ['Valor Total Original', `R$ ${totalOriginal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`],
      ['Valor Total SIGTAP', `R$ ${totalSigtap.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`],
      ['Diferença', `R$ ${totalDiferenca.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} (${totalOriginal > 0 ? ((totalDiferenca/totalOriginal)*100).toFixed(2) : '0.00'}%)`]
    ];

    autoTable(pdf, {
      startY: yPos,
      head: [['Métrica', 'Valor']],
      body: resumoData,
      theme: 'grid',
      headStyles: { fillColor: [52, 152, 219], textColor: 255, fontSize: 10 },
      bodyStyles: { fontSize: 9 },
      columnStyles: {
        0: { cellWidth: 80, fontStyle: 'bold' },
        1: { cellWidth: 80, halign: 'right' }
      },
      margin: { left: 15, right: 15 }
    });

    yPos = pdf.lastAutoTable.finalY + 20;

    // DETALHAMENTO POR PROCEDIMENTO
    pdf.setFontSize(14);
    pdf.setFont('helvetica', 'bold');
    pdf.text('DETALHAMENTO POR PROCEDIMENTO', 15, yPos);
    
    yPos += 10;
    
    // Preparar dados da tabela (já filtrados para remover anestesistas)
    const tableData = procedimentosAprovados.map(proc => [
      proc.sequencia.toString(),
      proc.procedimento,
      proc.descricao ? (proc.descricao.length > 30 ? proc.descricao.substring(0, 27) + '...' : proc.descricao) : 'N/A',
      proc.data,
      `R$ ${(proc.valorOriginal || 0).toFixed(2)}`,
      `R$ ${(proc.valorCalculado || 0).toFixed(2)}`,
      `R$ ${((proc.valorOriginal || 0) - (proc.valorCalculado || 0)).toFixed(2)}`,
      `${proc.porcentagemSUS || 100}%`,
      proc.matchStatus
    ]);

    // Adicionar linha de totais
    tableData.push([
      '', '', '', 'TOTAL GERAL:',
      `R$ ${totalOriginal.toFixed(2)}`,
      `R$ ${totalSigtap.toFixed(2)}`,
      `R$ ${totalDiferenca.toFixed(2)}`,
      '', ''
    ]);

    autoTable(pdf, {
      startY: yPos,
      head: [['Seq', 'Código', 'Descrição', 'Data', 'Original', 'SIGTAP', 'Diferença', '%SUS', 'Status']],
      body: tableData,
      theme: 'striped',
      headStyles: { 
        fillColor: [46, 204, 113], 
        textColor: 255, 
        fontSize: 8,
        halign: 'center'
      },
      bodyStyles: { fontSize: 7 },
      columnStyles: {
        0: { cellWidth: 15 }, // Seq
        1: { cellWidth: 25 }, // Código
        2: { cellWidth: 35 }, // Descrição
        3: { cellWidth: 20 }, // Data
        4: { cellWidth: 20, halign: 'right' }, // Original
        5: { cellWidth: 20, halign: 'right' }, // SIGTAP
        6: { cellWidth: 20, halign: 'right' }, // Diferença
        7: { cellWidth: 15, halign: 'center' }, // %SUS
        8: { cellWidth: 20 }  // Status
      },
      margin: { left: 10, right: 10 },
      // Destacar linha de totais
      didParseCell: function (data: any) {
        if (data.row.index === tableData.length - 1) {
          data.cell.styles.fillColor = [231, 76, 60];
          data.cell.styles.textColor = 255;
          data.cell.styles.fontStyle = 'bold';
        }
      }
    });

    // RODAPÉ
    const pageHeight = pdf.internal.pageSize.height;
    
    pdf.setFillColor(52, 73, 94);
    pdf.rect(0, pageHeight - 25, 210, 25, 'F');
    
    pdf.setTextColor(255, 255, 255);
    pdf.setFontSize(8);
    pdf.text('• Valores calculados conforme Tabela SIGTAP vigente com percentuais SUS', 15, pageHeight - 15);
    pdf.text('• Relatório gerado automaticamente pelo Sistema SIGTAP Sync', 15, pageHeight - 10);
    pdf.text('• Para dúvidas, entre em contato com o departamento de faturamento', 15, pageHeight - 5);

    // Salvar PDF
    const fileName = `relatorio-executivo-aih-${aihCompleta.numeroAIH}-${dataAtual.replace(/\//g, '-')}.pdf`;
    pdf.save(fileName);

    toast({
      title: "📊 Relatório PDF Gerado!",
      description: `Relatório executivo premium gerado para AIH ${aihCompleta.numeroAIH} com ${procedimentosAprovados.length} procedimentos aprovados.`,
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
      
      // ✅ VERIFICAÇÃO DE DUPLICATAS ANTES DE SALVAR
      console.log('🔍 Verificando se AIH já existe no banco...');
      toast({
        title: "🔍 Verificando duplicatas",
        description: "Conferindo se esta AIH já foi salva anteriormente..."
      });

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
      {/* Header */}
      <div className="text-center">
        <h2 className="text-3xl font-bold text-gray-900 flex items-center justify-center space-x-2">
          <Layers className="w-8 h-8 text-blue-600" />
          <span>AIH Avançado</span>
        </h2>
        <p className="text-gray-600 mt-2">
          Processamento completo de PDFs AIH com múltiplas páginas de procedimentos
        </p>
      </div>

      {/* Upload Section */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Upload className="w-5 h-5 text-blue-600" />
            <span>Upload PDF AIH</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center">
            <input
              type="file"
              accept=".pdf"
              onChange={handleFileSelect}
              className="hidden"
              id="pdf-upload"
            />
            <label htmlFor="pdf-upload" className="cursor-pointer">
              <FileText className="w-12 h-12 text-gray-400 mx-auto mb-2" />
              <p className="text-gray-600">
                {selectedFile ? selectedFile.name : 'Clique para selecionar PDF AIH'}
              </p>
              <p className="text-sm text-gray-400 mt-1">
                Suporte para PDFs com 2+ páginas (dados + procedimentos)
              </p>
            </label>
          </div>

          {/* Status SIGTAP */}
          <Alert className={
            sigtapLoading ? "border-blue-500 bg-blue-50" :
            sigtapProcedures.length > 0 ? "border-green-500 bg-green-50" : "border-yellow-500 bg-yellow-50"
          }>
            <CheckCircle className={`h-4 w-4 ${
              sigtapLoading ? 'text-blue-600 animate-spin' :
              sigtapProcedures.length > 0 ? 'text-green-600' : 'text-yellow-600'
            }`} />
            <AlertDescription className={
              sigtapLoading ? 'text-blue-800' :
              sigtapProcedures.length > 0 ? 'text-green-800' : 'text-yellow-800'
            }>
              {sigtapLoading
                ? `⏳ Carregando SIGTAP do banco de dados...`
                : sigtapProcedures.length > 0 
                  ? `✅ SIGTAP carregado: ${sigtapProcedures.length.toLocaleString()} procedimentos disponíveis para matching`
                  : `⚠️ Tabela SIGTAP não carregada. Vá para "SIGTAP" → Upload da tabela primeiro.`
              }
            </AlertDescription>
          </Alert>

          <div className="flex space-x-2">
            <Button
              onClick={handleProcessPDF}
              disabled={!selectedFile || isProcessing}
              className="flex-1"
            >
              {isProcessing ? (
                <>
                  <Zap className="w-4 h-4 mr-2 animate-spin" />
                  Processando AIH...
                </>
              ) : (
                <>
                  <Layers className="w-4 h-4 mr-2" />
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
                >
                  {isMatching ? (
                    <>
                      <Target className="w-4 h-4 mr-2 animate-spin" />
                      Fazendo Matching...
                    </>
                  ) : (
                    <>
                      <Target className="w-4 h-4 mr-2" />
                      Refazer Matching
                    </>
                  )}
                </Button>
              </>
            )}
          </div>
        </CardContent>
      </Card>

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
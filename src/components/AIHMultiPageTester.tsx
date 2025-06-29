import React, { useState, useEffect } from 'react';
import { Button } from './ui/button';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Badge } from './ui/badge';
import { Alert, AlertDescription } from './ui/alert';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from './ui/table';
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
  Stethoscope
} from 'lucide-react';
import { useToast } from '../hooks/use-toast';
import { AIHCompleteProcessor } from '../utils/aihCompleteProcessor';
import { ProcedureMatchingService } from '../services/procedureMatchingService';
import { useSigtapContext } from '../contexts/SigtapContext';
import { AIHCompleteProcessingResult, AIHComplete, ProcedureAIH } from '../types';

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
  const [defaultPercentage, setDefaultPercentage] = useState<number>(70); // Porcentagem padrão para procedimentos secundários
  const { toast } = useToast();

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

  // Função para calcular totais aplicando lógica de porcentagem SUS
  const calculateTotalsWithPercentage = (procedimentos: ProcedureAIH[]): AIHComplete => {
    const procedimentosComPercentagem = procedimentos.map((proc, index) => {
      if (!proc.sigtapProcedure) return proc;

      // Procedimento principal (primeiro) = 100%, demais = porcentagem definida
      const isPrincipal = index === 0;
      const porcentagem = isPrincipal ? 100 : (proc.porcentagemSUS || defaultPercentage);
      
      const valorBase = proc.sigtapProcedure.valueHospTotal;
      const valorCalculado = (valorBase * porcentagem) / 100;

      return {
        ...proc,
        porcentagemSUS: porcentagem,
        valorCalculado,
        valorOriginal: valorBase
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

  // Iniciar edição de valores
  const startEditingValues = (sequencia: number, procedure: ProcedureAIH) => {
    setEditingValues(prev => new Set([...prev, sequencia]));
    
    if (procedure.sigtapProcedure) {
      setTempValues(prev => ({
        ...prev,
        [sequencia]: {
          valorAmb: procedure.sigtapProcedure?.valueAmb || 0,
          valorHosp: procedure.sigtapProcedure?.valueHosp || 0,
          valorProf: procedure.sigtapProcedure?.valueProf || 0,
          porcentagem: procedure.porcentagemSUS || (sequencia === 1 ? 100 : defaultPercentage)
        }
      }));
    }
  };

  // Salvar edição de valores
  const saveEditedValues = (sequencia: number) => {
    const editedValues = tempValues[sequencia];
    if (!editedValues) return;

    const updatedProcedimentos = aihCompleta.procedimentos.map(proc => {
      if (proc.sequencia === sequencia && proc.sigtapProcedure) {
        // Atualizar valores SIGTAP
        const updatedSigtapProcedure = {
          ...proc.sigtapProcedure,
          valueAmb: editedValues.valorAmb,
          valueHosp: editedValues.valorHosp,
          valueProf: editedValues.valorProf,
          valueHospTotal: editedValues.valorAmb + editedValues.valorHosp + editedValues.valorProf
        };

        // Calcular valor com porcentagem
        const valorCalculado = (updatedSigtapProcedure.valueHospTotal * editedValues.porcentagem) / 100;

        return {
          ...proc,
          sigtapProcedure: updatedSigtapProcedure,
          porcentagemSUS: editedValues.porcentagem,
          valorCalculado,
          valorOriginal: updatedSigtapProcedure.valueHospTotal
        };
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

    toast({
      title: "✅ Valores atualizados",
      description: `Procedimento ${sequencia} atualizado com ${editedValues.porcentagem}% de cobrança`
    });
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

  // Atualizar porcentagem padrão para todos os procedimentos secundários
  const updateDefaultPercentage = (newPercentage: number) => {
    setDefaultPercentage(newPercentage);
    
    const updatedProcedimentos = aihCompleta.procedimentos.map((proc, index) => {
      if (index > 0 && proc.sigtapProcedure) { // Não alterar o procedimento principal
        const valorBase = proc.sigtapProcedure.valueHospTotal;
        const valorCalculado = (valorBase * newPercentage) / 100;
        
        return {
          ...proc,
          porcentagemSUS: newPercentage,
          valorCalculado
        };
      }
      return proc;
    });

    const updatedAIH = calculateTotalsWithPercentage(updatedProcedimentos);
    onUpdateAIH(updatedAIH);

    toast({
      title: "📊 Porcentagem atualizada",
      description: `Todos os procedimentos secundários agora usam ${newPercentage}%`
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
      {/* CARDS: DADOS DO PACIENTE E AIH */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Card: Dados do Paciente */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <User className="w-5 h-5 text-blue-600" />
              <span>Dados do Paciente</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div>
              <label className="text-sm font-medium text-gray-600">Nome Completo</label>
              <p className="text-lg font-semibold text-gray-900">{aihCompleta.nomePaciente}</p>
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium text-gray-600">CNS</label>
                <p className="text-gray-900 font-mono text-sm">{aihCompleta.cns || 'N/A'}</p>
              </div>
              
              <div>
                <label className="text-sm font-medium text-gray-600">Sexo</label>
                <p className="text-gray-900">{aihCompleta.sexo === 'M' ? 'Masculino' : 'Feminino'}</p>
              </div>
            </div>
            
            <div>
              <label className="text-sm font-medium text-gray-600">Data de Nascimento</label>
              <div className="flex items-center space-x-2">
                <Calendar className="w-4 h-4 text-gray-400" />
                <p className="text-gray-900">{aihCompleta.nascimento}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Card: Dados da AIH */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <FileText className="w-5 h-5 text-green-600" />
              <span>Dados da AIH</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div>
              <label className="text-sm font-medium text-gray-600">Número da AIH</label>
              <div className="flex items-center space-x-2">
                <CreditCard className="w-4 h-4 text-gray-400" />
                <p className="text-lg font-bold text-green-700 font-mono">{aihCompleta.numeroAIH}</p>
              </div>
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium text-gray-600">Data Início</label>
                <p className="text-gray-900">{aihCompleta.dataInicio}</p>
              </div>
              
              <div>
                <label className="text-sm font-medium text-gray-600">Data Fim</label>
                <p className="text-gray-900">{aihCompleta.dataFim || 'Em andamento'}</p>
              </div>
            </div>
            
            <div>
              <label className="text-sm font-medium text-gray-600">Procedimento Principal</label>
              <div className="flex items-center space-x-2">
                <Stethoscope className="w-4 h-4 text-gray-400" />
                <p className="text-gray-900 font-mono text-sm">{aihCompleta.procedimentoPrincipal}</p>
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
            
            {/* CONTROLE DE PORCENTAGEM GLOBAL */}
            <div className="flex items-center space-x-2">
              <label className="text-sm font-medium text-gray-600">% Secundários:</label>
              <div className="flex items-center space-x-1">
                <input
                  type="number"
                  min="0"
                  max="100"
                  value={defaultPercentage}
                  onChange={(e) => updateDefaultPercentage(Number(e.target.value))}
                  className="w-16 px-2 py-1 text-sm border rounded focus:ring-2 focus:ring-green-500 focus:border-green-500"
                />
                <span className="text-sm text-gray-500">%</span>
              </div>
            </div>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            <div className="text-center p-4 bg-blue-50 rounded-lg border-l-4 border-blue-500">
              <p className="text-sm text-gray-600">Total Procedimentos</p>
              <p className="text-2xl font-bold text-blue-700">{aihCompleta.totalProcedimentos}</p>
            </div>
            <div className="text-center p-4 bg-green-50 rounded-lg border-l-4 border-green-500">
              <p className="text-sm text-gray-600">Aprovados</p>
              <p className="text-2xl font-bold text-green-700">{aihCompleta.procedimentosAprovados}</p>
            </div>
            <div className="text-center p-4 bg-red-50 rounded-lg border-l-4 border-red-500">
              <p className="text-sm text-gray-600">Rejeitados</p>
              <p className="text-2xl font-bold text-red-700">{aihCompleta.procedimentosRejeitados}</p>
            </div>
            <div className="text-center p-4 bg-amber-50 rounded-lg border-l-4 border-amber-500">
              <p className="text-sm text-gray-600">Valor Original</p>
              <p className="text-xl font-bold text-amber-700">
                {formatCurrency(aihCompleta.procedimentos
                  .filter(p => p.aprovado)
                  .reduce((sum, p) => sum + (p.valorOriginal || 0), 0)
                )}
              </p>
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
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div className="flex items-center space-x-2">
                <div className="w-3 h-3 bg-green-500 rounded-full"></div>
                <span>Procedimento Principal: <strong>100%</strong></span>
              </div>
              <div className="flex items-center space-x-2">
                <div className="w-3 h-3 bg-blue-500 rounded-full"></div>
                <span>Procedimentos Secundários: <strong>{defaultPercentage}%</strong></span>
              </div>
            </div>
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
                  <TableHead className="w-16">Seq</TableHead>
                  <TableHead className="w-32">Código</TableHead>
                  <TableHead>Procedimento</TableHead>
                  <TableHead className="w-32">Valores</TableHead>
                  <TableHead className="w-24">Status</TableHead>
                  <TableHead className="w-24">Ações</TableHead>
                  <TableHead className="w-16">+</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {aihCompleta.procedimentos.map((procedure) => (
                  <React.Fragment key={procedure.sequencia}>
                    <TableRow className="hover:bg-gray-50">
                      <TableCell className="font-medium">{procedure.sequencia}</TableCell>
                      <TableCell className="font-mono text-sm">{procedure.procedimento}</TableCell>
                      <TableCell>
                        <div>
                          <div className="flex items-center space-x-2">
                            <p className="font-medium">{procedure.descricao || `Procedimento ${procedure.procedimento}`}</p>
                            {procedure.sequencia === 1 && (
                              <Badge variant="default" className="text-xs bg-green-600 text-white">
                                Principal
                              </Badge>
                            )}
                          </div>
                          {procedure.sigtapProcedure && (
                            <p className="text-sm text-gray-500 truncate max-w-xs">
                              SIGTAP: {procedure.sigtapProcedure.description}
                            </p>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        {editingValues.has(procedure.sequencia) ? (
                          // MODO EDIÇÃO PREMIUM
                          <div className="space-y-2 p-2 bg-yellow-50 rounded border-2 border-yellow-200">
                            <div className="text-xs font-medium text-gray-600 mb-1">Editando Valores:</div>
                            <div className="space-y-1">
                              <div className="flex items-center space-x-1">
                                <span className="text-xs w-8">SA:</span>
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
                                  className="w-20 px-1 py-0.5 text-xs border rounded"
                                />
                              </div>
                              <div className="flex items-center space-x-1">
                                <span className="text-xs w-8">SH:</span>
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
                                  className="w-20 px-1 py-0.5 text-xs border rounded"
                                />
                              </div>
                              <div className="flex items-center space-x-1">
                                <span className="text-xs w-8">SP:</span>
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
                                  className="w-20 px-1 py-0.5 text-xs border rounded"
                                />
                              </div>
                              <div className="flex items-center space-x-1 pt-1 border-t">
                                <span className="text-xs w-8 font-medium">%:</span>
                                <input
                                  type="number"
                                  min="0"
                                  max="100"
                                  value={tempValues[procedure.sequencia]?.porcentagem || 100}
                                  onChange={(e) => setTempValues(prev => ({
                                    ...prev,
                                    [procedure.sequencia]: {
                                      ...prev[procedure.sequencia],
                                      porcentagem: Number(e.target.value)
                                    }
                                  }))}
                                  className="w-16 px-1 py-0.5 text-xs border rounded"
                                />
                                <span className="text-xs">%</span>
                              </div>
                            </div>
                            <div className="flex space-x-1 mt-2">
                              <Button size="sm" onClick={() => saveEditedValues(procedure.sequencia)} className="h-6 px-2 text-xs">
                                <Check className="w-3 h-3" />
                              </Button>
                              <Button size="sm" variant="outline" onClick={() => cancelEditingValues(procedure.sequencia)} className="h-6 px-2 text-xs">
                                <X className="w-3 h-3" />
                              </Button>
                            </div>
                          </div>
                        ) : procedure.valorCalculado && procedure.sigtapProcedure ? (
                          // MODO VISUALIZAÇÃO
                          <div className="text-sm relative group">
                            <div className="flex items-center space-x-1">
                              <div>
                                <p className="font-semibold text-green-600">
                                  {formatCurrency(procedure.valorCalculado)}
                                </p>
                                <div className="text-xs text-gray-500 space-y-0.5">
                                  <p>SA: {formatCurrency(procedure.sigtapProcedure.valueAmb)}</p>
                                  <p>SH: {formatCurrency(procedure.sigtapProcedure.valueHosp)}</p>
                                  <p>SP: {formatCurrency(procedure.sigtapProcedure.valueProf)}</p>
                                </div>
                              </div>
                              <div className="ml-2">
                                <Badge variant="outline" className="text-xs">
                                  {procedure.porcentagemSUS || (procedure.sequencia === 1 ? 100 : defaultPercentage)}%
                                </Badge>
                              </div>
                            </div>
                            
                            {/* Botão de edição (aparece no hover) */}
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => startEditingValues(procedure.sequencia, procedure)}
                              className="absolute -top-1 -right-1 h-6 w-6 p-0 opacity-0 group-hover:opacity-100 transition-opacity bg-yellow-100 hover:bg-yellow-200"
                            >
                              <Edit className="w-3 h-3" />
                            </Button>
                          </div>
                        ) : (
                          <div className="text-gray-400 text-sm">
                            <span>Não calculado</span>
                            {procedure.sigtapProcedure && (
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => startEditingValues(procedure.sequencia, procedure)}
                                className="ml-2 h-6 w-6 p-0 bg-blue-100 hover:bg-blue-200"
                              >
                                <Edit className="w-3 h-3" />
                              </Button>
                            )}
                          </div>
                        )}
                      </TableCell>
                      <TableCell>{getStatusBadge(procedure.matchStatus, procedure.matchConfidence)}</TableCell>
                      <TableCell>
                        <div className="flex space-x-1">
                          {procedure.matchStatus === 'matched' && !procedure.aprovado && (
                            <Button size="sm" variant="outline" onClick={() => handleProcedureAction(procedure, 'approve')} className="h-7 px-2">
                              <Check className="w-3 h-3" />
                            </Button>
                          )}
                          {procedure.matchStatus !== 'rejected' && (
                            <Button size="sm" variant="outline" onClick={() => handleProcedureAction(procedure, 'reject')} className="h-7 px-2">
                              <X className="w-3 h-3" />
                            </Button>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => toggleProcedureExpansion(procedure.sequencia)}
                          className="h-7 w-7 p-0"
                        >
                          {expandedProcedures.has(procedure.sequencia) ? 
                            <ChevronDown className="w-4 h-4" /> : 
                            <ChevronRight className="w-4 h-4" />
                          }
                        </Button>
                      </TableCell>
                    </TableRow>
                    
                    {/* DETALHES EXPANDIDOS */}
                    {expandedProcedures.has(procedure.sequencia) && (
                      <TableRow>
                        <TableCell colSpan={7} className="bg-gray-50 p-4">
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                              <h5 className="font-medium text-sm text-gray-600 mb-2">Informações Técnicas</h5>
                              <div className="bg-white p-3 rounded border text-sm space-y-1">
                                <p><span className="font-medium">CBO:</span> {procedure.cbo}</p>
                                <p><span className="font-medium">Data:</span> {procedure.data}</p>
                                <p><span className="font-medium">Participação:</span> {procedure.participacao}</p>
                                <p><span className="font-medium">CNES:</span> {procedure.cnes}</p>
                                {procedure.matchConfidence && (
                                  <p><span className="font-medium">Confiança:</span> {(procedure.matchConfidence * 100).toFixed(1)}%</p>
                                )}
                              </div>
                            </div>
                            
                                                          {procedure.sigtapProcedure && (
                                <div>
                                  <h5 className="font-medium text-sm text-gray-600 mb-2">Match SIGTAP</h5>
                                  <div className="bg-white p-3 rounded border text-sm space-y-1">
                                    <p><span className="font-medium">Código:</span> {procedure.sigtapProcedure.code}</p>
                                    <p><span className="font-medium">Descrição:</span> {procedure.sigtapProcedure.description}</p>
                                    <p><span className="font-medium">Complexidade:</span> {procedure.sigtapProcedure.complexity}</p>
                                    
                                    <div className="pt-2 border-t">
                                      <div className="flex items-center justify-between mb-2">
                                        <p className="font-medium text-green-700">Valores SIGTAP:</p>
                                        <Button
                                          size="sm"
                                          variant="outline"
                                          onClick={() => startEditingValues(procedure.sequencia, procedure)}
                                          className="h-6 px-2 text-xs bg-yellow-100 hover:bg-yellow-200"
                                        >
                                          <Edit className="w-3 h-3 mr-1" />
                                          Editar
                                        </Button>
                                      </div>
                                      <div className="grid grid-cols-2 gap-2">
                                        <div>
                                          <p>• Ambulatorial: {formatCurrency(procedure.sigtapProcedure.valueAmb)}</p>
                                          <p>• Hospitalar: {formatCurrency(procedure.sigtapProcedure.valueHosp)}</p>
                                          <p>• Profissional: {formatCurrency(procedure.sigtapProcedure.valueProf)}</p>
                                          <p className="font-semibold border-t pt-1">• Total SIGTAP: {formatCurrency(procedure.sigtapProcedure.valueHospTotal)}</p>
                                        </div>
                                        <div className="bg-green-50 p-2 rounded">
                                          <p className="font-medium text-green-700 mb-1">Lógica SUS:</p>
                                          <div className="flex items-center space-x-2">
                                            <span className={`w-3 h-3 rounded-full ${procedure.sequencia === 1 ? 'bg-green-500' : 'bg-blue-500'}`}></span>
                                            <span className="text-sm">
                                              {procedure.sequencia === 1 ? 'Principal' : 'Secundário'}: 
                                              <strong className="ml-1">
                                                {procedure.porcentagemSUS || (procedure.sequencia === 1 ? 100 : defaultPercentage)}%
                                              </strong>
                                            </span>
                                          </div>
                                          <p className="text-sm mt-1">
                                            <span className="font-medium">Valor Final:</span>
                                            <span className="ml-1 font-semibold text-green-600">
                                              {formatCurrency(procedure.valorCalculado || 0)}
                                            </span>
                                          </p>
                                        </div>
                                      </div>
                                    </div>
                                  </div>
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
  const { toast } = useToast();
  const { procedures: sigtapProcedures, isLoading: sigtapLoading, totalProcedures } = useSigtapContext();

  const processor = new AIHCompleteProcessor();
  const matchingService = new ProcedureMatchingService(sigtapProcedures);

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setSelectedFile(file);
      setResult(null);
      setAihCompleta(null);
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
        description: `AIH processada em ${totalTime}ms`
      });

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
        const updatedProcedimentos = aihData.procedimentos.map((proc, index) => {
          const matchDetail = matchingResult.matchingDetails[index];
          return {
            ...proc,
            matchStatus: matchDetail.encontrado ? 'matched' as const : 'pending' as const,
            matchConfidence: matchDetail.confidence,
            sigtapProcedure: matchDetail.sigtapMatch,
            valorCalculado: matchDetail.sigtapMatch?.valueHospTotal || 0,
            valorOriginal: matchDetail.sigtapMatch?.valueHospTotal || 0,
            aprovado: matchDetail.encontrado
          };
        });

        // Atualizar AIH completa
        const updatedAIH: AIHComplete = {
          ...aihData,
          procedimentos: updatedProcedimentos,
          procedimentosAprovados: updatedProcedimentos.filter(p => p.aprovado).length,
          procedimentosRejeitados: updatedProcedimentos.filter(p => !p.aprovado && p.matchStatus === 'pending').length,
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

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="text-center">
        <h2 className="text-3xl font-bold text-gray-900 flex items-center justify-center space-x-2">
          <Layers className="w-8 h-8 text-blue-600" />
          <span>Teste AIH Multi-Página</span>
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
            <span>Upload PDF AIH Multi-Página</span>
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
                  Processando Multi-Página...
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
                
                <Button onClick={exportDetailedReport} variant="outline">
                  <Download className="w-4 h-4 mr-2" />
                  Exportar Relatório
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
    </div>
  );
};

export default AIHMultiPageTester; 
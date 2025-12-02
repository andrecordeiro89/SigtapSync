import React, { useState } from 'react';
import { Button } from './ui/button';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Badge } from './ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from './ui/table';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from './ui/dialog';
import { 
  User, 
  Calendar, 
  CreditCard, 
  MapPin, 
  Phone,
  ChevronDown,
  ChevronRight,
  Edit,
  Check,
  X,
  Info,
  DollarSign,
  Target,
  FileText,
  Stethoscope
} from 'lucide-react';
import { useToast } from '../hooks/use-toast';
import { AIHComplete, ProcedureAIH } from '../types';
import { formatSigtapCode } from '../utils/formatters';
import { getSigtapLocalMap, resolveSigtapDescriptionFromCsv } from '../utils/sigtapLocal';
import { isSihSourceActive } from '../utils/sihSource';

interface AIHCompleteViewProps {
  aihCompleta: AIHComplete;
  onUpdateAIH: (updatedAIH: AIHComplete) => void;
  onEditProcedure?: (procedure: ProcedureAIH) => void;
}

const AIHCompleteView = ({ aihCompleta, onUpdateAIH, onEditProcedure }: AIHCompleteViewProps) => {
  const [expandedProcedures, setExpandedProcedures] = useState<Set<number>>(new Set());
  const [sigtapMap, setSigtapMap] = useState<Map<string, string> | null>(null);
  const [csvDescMap, setCsvDescMap] = useState<Map<string, string>>(new Map());
  const { toast } = useToast();

  React.useEffect(() => {
    let mounted = true;
    try {
      if (isSihSourceActive()) {
        getSigtapLocalMap()
          .then((map) => { if (mounted) setSigtapMap(map); })
          .catch(() => setSigtapMap(new Map()));
      }
    } catch {}
    return () => { mounted = false; };
  }, []);

  React.useEffect(() => {
    const tryLoad = () => {
      if (!sigtapMap && isSihSourceActive()) {
        getSigtapLocalMap()
          .then((map) => setSigtapMap(map))
          .catch(() => setSigtapMap(new Map()))
      }
    }
    tryLoad()
    const onCustom = () => tryLoad()
    window.addEventListener('sihsourcechange', onCustom as any)
    return () => window.removeEventListener('sihsourcechange', onCustom as any)
  }, [sigtapMap])

  React.useEffect(() => {
    const run = async () => {
      if (!isSihSourceActive()) { setCsvDescMap(new Map()); return }
      const missing: string[] = []
      for (const p of aihCompleta.procedimentos) {
        const code = formatSigtapCode(p.procedimento)
        const digits = code.replace(/\D/g, '')
        const exists = (sigtapMap?.get(code) || sigtapMap?.get(digits) || csvDescMap.get(code) || csvDescMap.get(digits))
        if (!exists) missing.push(code)
      }
      if (missing.length === 0) return
      for (const code of missing) {
        try {
          const desc = await resolveSigtapDescriptionFromCsv(code)
          if (desc) {
            setCsvDescMap(prev => {
              const m = new Map(prev)
              m.set(code, desc)
              m.set(code.replace(/\D/g, ''), desc)
              return m
            })
          }
        } catch {}
      }
    }
    run()
  }, [aihCompleta.procedimentos, sigtapMap])

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

    const updatedAIH = {
      ...aihCompleta,
      procedimentos: updatedProcedimentos,
      procedimentosAprovados: updatedProcedimentos.filter(p => p.aprovado).length,
      procedimentosRejeitados: updatedProcedimentos.filter(p => p.matchStatus === 'rejected').length,
      valorTotalCalculado: updatedProcedimentos
        .filter(p => p.aprovado)
        .reduce((sum, p) => sum + (p.valorCalculado || 0), 0)
    };

    onUpdateAIH(updatedAIH);

    toast({
      title: action === 'approve' ? "✅ Procedimento aprovado" : "❌ Procedimento rejeitado",
      description: `${procedure.procedimento} foi ${action === 'approve' ? 'aprovado' : 'rejeitado'}`
    });
  };

  const getStatusBadge = (status: ProcedureAIH['matchStatus'], confidence?: number) => {
    const configs = {
      pending: { 
        variant: 'secondary' as const, 
        icon: Target, 
        text: 'Pendente', 
        color: 'text-yellow-600' 
      },
      matched: { 
        variant: 'default' as const, 
        icon: Check, 
        text: 'Encontrado', 
        color: 'text-green-600' 
      },
      manual: { 
        variant: 'outline' as const, 
        icon: Edit, 
        text: 'Manual', 
        color: 'text-blue-600' 
      },
      rejected: { 
        variant: 'destructive' as const, 
        icon: X, 
        text: 'Rejeitado', 
        color: 'text-red-600' 
      }
    };
    
    const config = configs[status];
    const Icon = config.icon;
    
    return (
      <div className="flex flex-col items-center space-y-1">
        <Badge variant={config.variant} className="flex items-center space-x-1">
          <Icon className={`w-3 h-3`} />
          <span>{config.text}</span>
        </Badge>
        {confidence && confidence > 0 && (
          <span className="text-xs text-gray-500">
            {(confidence * 100).toFixed(0)}%
          </span>
        )}
      </div>
    );
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(value);
  };

  return (
    <div className="space-y-6">
      {/* CARD 1: DADOS DO PACIENTE E AIH */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Dados do Paciente */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <User className="w-5 h-5 text-blue-600" />
              <span>Dados do Paciente</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium text-gray-600">Nome Completo</label>
                <p className="text-lg font-semibold text-gray-900">{aihCompleta.nomePaciente}</p>
              </div>
              
              <div>
                <label className="text-sm font-medium text-gray-600">CNS</label>
                <p className="text-gray-900 font-mono">{aihCompleta.cns || 'N/A'}</p>
              </div>
              
              <div>
                <label className="text-sm font-medium text-gray-600">Data de Nascimento</label>
                <div className="flex items-center space-x-2">
                  <Calendar className="w-4 h-4 text-gray-400" />
                  <p className="text-gray-900">{aihCompleta.nascimento}</p>
                </div>
              </div>
              
              <div>
                <label className="text-sm font-medium text-gray-600">Sexo</label>
                <p className="text-gray-900">{aihCompleta.sexo === 'M' ? 'Masculino' : 'Feminino'}</p>
              </div>
              
              {aihCompleta.endereco && (
                <div className="col-span-2">
                  <label className="text-sm font-medium text-gray-600">Endereço</label>
                  <div className="flex items-center space-x-2">
                    <MapPin className="w-4 h-4 text-gray-400" />
                    <p className="text-gray-900">{aihCompleta.endereco}</p>
                  </div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Dados da AIH */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <FileText className="w-5 h-5 text-green-600" />
              <span>Dados da AIH</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium text-gray-600">Número da AIH</label>
                <div className="flex items-center space-x-2">
                  <CreditCard className="w-4 h-4 text-gray-400" />
                  <p className="text-lg font-bold text-green-700 font-mono">{aihCompleta.numeroAIH}</p>
                </div>
              </div>
              
              <div>
                <label className="text-sm font-medium text-gray-600">Status Geral</label>
                <Badge variant={
                  aihCompleta.statusGeral === 'aprovada' ? 'default' :
                  aihCompleta.statusGeral === 'aguardando_revisao' ? 'secondary' :
                  aihCompleta.statusGeral === 'rejeitada' ? 'destructive' : 'outline'
                }>
                  {aihCompleta.statusGeral.replace('_', ' ').toUpperCase()}
                </Badge>
              </div>
              
              <div>
                <label className="text-sm font-medium text-gray-600">Data de Início</label>
                <p className="text-gray-900">{aihCompleta.dataInicio}</p>
              </div>
              
              <div>
                <label className="text-sm font-medium text-gray-600">Data de Fim</label>
                <p className="text-gray-900">{aihCompleta.dataFim || 'Em andamento'}</p>
              </div>
              
              <div className="col-span-2">
                <label className="text-sm font-medium text-gray-600">Procedimento Principal</label>
                <div className="flex items-center space-x-2">
                  <Stethoscope className="w-4 h-4 text-gray-400" />
                  <p className="text-gray-900 font-mono">{aihCompleta.procedimentoPrincipal}</p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* RESUMO FINANCEIRO */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <DollarSign className="w-5 h-5 text-green-600" />
            <span>Resumo Financeiro</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="text-center p-4 bg-blue-50 rounded-lg">
              <p className="text-sm text-gray-600">Total Procedimentos</p>
              <p className="text-2xl font-bold text-blue-700">{aihCompleta.totalProcedimentos}</p>
            </div>
            
            <div className="text-center p-4 bg-green-50 rounded-lg">
              <p className="text-sm text-gray-600">Aprovados</p>
              <p className="text-2xl font-bold text-green-700">{aihCompleta.procedimentosAprovados}</p>
            </div>
            
            <div className="text-center p-4 bg-red-50 rounded-lg">
              <p className="text-sm text-gray-600">Rejeitados</p>
              <p className="text-2xl font-bold text-red-700">{aihCompleta.procedimentosRejeitados}</p>
            </div>
            
            <div className="text-center p-4 bg-green-100 rounded-lg">
              <p className="text-sm text-gray-600">Valor Total</p>
              <p className="text-2xl font-bold text-green-800">
                {formatCurrency(aihCompleta.valorTotalCalculado || 0)}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* TABELA DE PROCEDIMENTOS */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <FileText className="w-5 h-5 text-purple-600" />
            <span>Procedimentos Realizados ({aihCompleta.procedimentos.length})</span>
          </CardTitle>
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
                  <TableHead className="w-16">Detalhes</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {aihCompleta.procedimentos.map((procedure) => (
                  <React.Fragment key={procedure.sequencia}>
                    <TableRow className="hover:bg-gray-50">
                      <TableCell className="font-medium">{procedure.sequencia}</TableCell>
                      
                      <TableCell className="font-mono text-sm">
                        {formatSigtapCode(procedure.procedimento)}
                      </TableCell>
                      
                      <TableCell>
                        <div>
                          <p className="font-medium">
                            {(() => {
                              const isUnavailable = (s?: string) => {
                                const v = (s || '').trim().toLowerCase();
                                return v === 'descrição não disponível' || v === 'descricao nao disponivel';
                              };
                              const formatted = formatSigtapCode(procedure.procedimento);
                              const sigtapDesc = procedure.sigtapProcedure?.description || (procedure as any)?.sigtap_procedures?.description;
                              const csvDesc = (() => {
                                if (!isSihSourceActive()) return undefined;
                                const key = formatted;
                                const digits = formatted.replace(/\D/g, '');
                                return (sigtapMap?.get(key) || sigtapMap?.get(digits) || csvDescMap.get(key) || csvDescMap.get(digits));
                              })();
                              if (sigtapDesc && !isUnavailable(sigtapDesc)) return sigtapDesc;
                              if (csvDesc && !isUnavailable(csvDesc)) return csvDesc as string;
                              if (procedure.descricao && !isUnavailable(procedure.descricao)) return procedure.descricao;
                              return `Procedimento ${formatted}`;
                            })()}
                          </p>
                          {(procedure.sigtapProcedure || (procedure as any)?.sigtap_procedures) && (
                            <p className="text-sm text-gray-500 truncate max-w-xs">
                              {procedure.sigtapProcedure?.description || (procedure as any)?.sigtap_procedures?.description}
                            </p>
                          )}
                        </div>
                      </TableCell>
                      
                      <TableCell>
                        {procedure.valorCalculado ? (
                          <div className="text-sm">
                            <p className="font-semibold text-green-600">
                              {formatCurrency(procedure.valorCalculado)}
                            </p>
                          </div>
                        ) : (
                          <span className="text-gray-400">Não calculado</span>
                        )}
                      </TableCell>
                      
                      <TableCell>
                        {getStatusBadge(procedure.matchStatus, procedure.matchConfidence)}
                      </TableCell>
                      
                      <TableCell>
                        <div className="flex space-x-1">
                          {procedure.matchStatus === 'matched' && !procedure.aprovado && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleProcedureAction(procedure, 'approve')}
                              className="h-7 px-2"
                            >
                              <Check className="w-3 h-3" />
                            </Button>
                          )}
                          
                          {procedure.matchStatus !== 'rejected' && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleProcedureAction(procedure, 'reject')}
                              className="h-7 px-2"
                            >
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
                          {expandedProcedures.has(procedure.sequencia) ? (
                            <ChevronDown className="w-4 h-4" />
                          ) : (
                            <ChevronRight className="w-4 h-4" />
                          )}
                        </Button>
                      </TableCell>
                    </TableRow>
                    
                    {/* DETALHES EXPANDIDOS */}
                    {expandedProcedures.has(procedure.sequencia) && (
                      <TableRow>
                        <TableCell colSpan={7} className="bg-gray-50 p-4">
                          <div className="space-y-4">
                            <h4 className="font-semibold text-gray-700 flex items-center space-x-2">
                              <Info className="w-4 h-4" />
                              <span>Detalhes do Matching</span>
                            </h4>
                            
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                              {/* Informações Técnicas */}
                              <div className="space-y-2">
                                <h5 className="font-medium text-sm text-gray-600">Informações Técnicas</h5>
                                <div className="bg-white p-3 rounded border text-sm space-y-1">
                                  <p><span className="font-medium">CBO:</span> {procedure.cbo}</p>
                                  <p><span className="font-medium">Data:</span> {procedure.data}</p>
                                  <p><span className="font-medium">Participação:</span> {procedure.participacao}</p>
                                  <p><span className="font-medium">CNES:</span> {procedure.cnes}</p>
                                  {procedure.matchConfidence && (
                                    <p><span className="font-medium">Confiança do Match:</span> {(procedure.matchConfidence * 100).toFixed(1)}%</p>
                                  )}
                                </div>
                              </div>
                              
                              {/* Detalhes SIGTAP */}
                              {(() => {
                                const sigtap: any = procedure.sigtapProcedure || (procedure as any)?.sigtap_procedures;
                                if (!sigtap) return null;
                                const totalCents = (procedure as any)?.sigtap_procedures?.value_hosp_total;
                                return (
                                  <div className="space-y-2">
                                    <h5 className="font-medium text-sm text-gray-600">Dados SIGTAP</h5>
                                    <div className="bg-white p-3 rounded border text-sm space-y-1">
                                      <p><span className="font-medium">Código:</span> {sigtap?.code}</p>
                                      <p><span className="font-medium">Descrição:</span> {sigtap?.description}</p>
                                      {sigtap?.complexity ? (
                                        <p><span className="font-medium">Complexidade:</span> {sigtap.complexity}</p>
                                      ) : null}
                                      {sigtap?.modality ? (
                                        <p><span className="font-medium">Modalidade:</span> {sigtap.modality}</p>
                                      ) : null}
                                      <div className="pt-2 border-t">
                                        <p className="font-medium text-green-700">Valores Detalhados:</p>
                                        {typeof sigtap?.valueAmb === 'number' ? (
                                          <p>• Ambulatorial: {formatCurrency(sigtap.valueAmb)}</p>
                                        ) : null}
                                        {typeof sigtap?.valueHosp === 'number' ? (
                                          <p>• Hospitalar: {formatCurrency(sigtap.valueHosp)}</p>
                                        ) : null}
                                        {typeof sigtap?.valueProf === 'number' ? (
                                          <p>• Profissional: {formatCurrency(sigtap.valueProf)}</p>
                                        ) : null}
                                        {typeof totalCents === 'number' ? (
                                          <p className="font-semibold">• Total: {formatCurrency((totalCents || 0) / 100)}</p>
                                        ) : null}
                                      </div>
                                    </div>
                                  </div>
                                );
                              })()}
                            </div>
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

export default AIHCompleteView; 
  

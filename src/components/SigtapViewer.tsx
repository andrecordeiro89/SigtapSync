import React, { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Search, Filter, Download, Eye, FileText, AlertCircle, ChevronDown, ChevronUp } from 'lucide-react';
import { formatCurrency } from '../utils/validation';
import { SigtapProcedure } from '../types';
import { useSigtapContext } from '../contexts/SigtapContext';

const SigtapViewer = () => {
  const { procedures, totalProcedures, lastImportDate, error, clearData } = useSigtapContext();
  const [searchTerm, setSearchTerm] = useState('');
  const [complexityFilter, setComplexityFilter] = useState('all');
  const [financingFilter, setFinancingFilter] = useState('all');
  const [origemFilter, setOrigemFilter] = useState('all');
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 20;

  const filteredProcedures = useMemo(() => {
    if (!procedures.length) return [];
    
    return procedures.filter(procedure => {
      const matchesSearch = procedure.code.toLowerCase().includes(searchTerm.toLowerCase()) ||
                           procedure.description.toLowerCase().includes(searchTerm.toLowerCase());
      
      const matchesComplexity = complexityFilter === 'all' || procedure.complexity === complexityFilter;
      const matchesFinancing = financingFilter === 'all' || procedure.financing === financingFilter;
      const matchesOrigem = origemFilter === 'all' || procedure.origem === origemFilter;
      
      return matchesSearch && matchesComplexity && matchesFinancing && matchesOrigem;
    });
  }, [procedures, searchTerm, complexityFilter, financingFilter, origemFilter]);

  const paginatedProcedures = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    return filteredProcedures.slice(startIndex, startIndex + itemsPerPage);
  }, [filteredProcedures, currentPage]);

  const totalPages = Math.ceil(filteredProcedures.length / itemsPerPage);

  const complexities = useMemo(() => {
    return [...new Set(procedures.map(p => p.complexity).filter(Boolean))];
  }, [procedures]);

  const financingTypes = useMemo(() => {
    return [...new Set(procedures.map(p => p.financing).filter(Boolean))];
  }, [procedures]);

  const origemTypes = useMemo(() => {
    return [...new Set(procedures.map(p => p.origem).filter(Boolean))];
  }, [procedures]);

  const toggleRowExpansion = (procedureCode: string) => {
    const newExpandedRows = new Set(expandedRows);
    if (newExpandedRows.has(procedureCode)) {
      newExpandedRows.delete(procedureCode);
    } else {
      newExpandedRows.add(procedureCode);
    }
    setExpandedRows(newExpandedRows);
  };

  const handleExportCSV = () => {
    if (!filteredProcedures.length) return;
    
    const headers = [
      'Código', 'Procedimento', 'Origem', 'Complexidade', 'Modalidade', 'Instrumento de Registro', 
      'Tipo de Financiamento', 'Valor Ambulatorial SA', 'Valor Ambulatorial Total', 
      'Valor Hospitalar SH', 'Valor Hospitalar SP', 'Valor Hospitalar Total',
      'Atributo Complementar', 'Sexo', 'Idade Mínima', 'Unidade Idade Min', 
      'Idade Máxima', 'Unidade Idade Max', 'Quantidade Máxima', 
      'Média Permanência', 'Pontos', 'CBO', 'CID', 'Habilitação',
      'Grupos de Habilitação', 'Serviço/Classificação', 'Especialidade Leito'
    ];
    const csvContent = [
      headers.join(','),
      ...filteredProcedures.map(p => [
        p.code,
        `"${p.description}"`,
        `"${p.origem || ''}"`,
          `"${p.complexity}"`,
          `"${p.modality || ''}"`,
          `"${p.registrationInstrument || ''}"`,
          `"${p.financing || ''}"`,
        p.valueAmb,
          p.valueAmbTotal,
        p.valueHosp,
        p.valueProf,
          p.valueHospTotal,
          `"${p.complementaryAttribute || ''}"`,
          `"${p.gender || ''}"`,
          p.minAge,
          `"${p.minAgeUnit || ''}"`,
          p.maxAge,
          `"${p.maxAgeUnit || ''}"`,
          p.maxQuantity,
          p.averageStay,
          p.points,
          `"${Array.isArray(p.cbo) ? p.cbo.join('; ') : p.cbo || ''}"`,
          `"${Array.isArray(p.cid) ? p.cid.join('; ') : p.cid || ''}"`,
          `"${p.habilitation || ''}"`,
          `"${p.habilitationGroup?.join('; ') || ''}"`,
          `"${p.serviceClassification || ''}"`,
          `"${p.especialidadeLeito || ''}"`
      ].join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `sigtap_procedures_${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
  };

  // Se não há dados carregados
  if (!procedures.length) {
    return (
      <div className="space-y-6">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Consulta Tabela SIGTAP</h2>
          <p className="text-gray-600 mt-1">Visualize e consulte todos os procedimentos da tabela SIGTAP</p>
        </div>

        <Card>
          <CardContent className="py-12">
            <div className="text-center space-y-4">
              <AlertCircle className="w-16 h-16 text-gray-400 mx-auto" />
              <div>
                <h3 className="text-lg font-semibold text-gray-900">Nenhuma tabela SIGTAP carregada</h3>
                <p className="text-gray-600 mt-2">
                  Para consultar os procedimentos, você precisa primeiro importar um arquivo ZIP da tabela SIGTAP.
                </p>
              </div>
              <div className="flex justify-center">
                <Button onClick={() => window.location.hash = '#sigtap'} variant="outline">
                  Ir para Importação
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold mb-2">Visualizar SIGTAP</h1>
        <p className="text-gray-600">
          Explore os procedimentos SIGTAP importados com extração <strong>sequencial/posicional</strong>
        </p>
        
        {/* Informações do Sistema de Extração */}
        <div className="mt-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
          <h3 className="font-semibold text-blue-800 mb-2">🔍 Sistema de Extração Híbrida</h3>
          <div className="text-sm text-blue-700 space-y-1">
            <div><strong>Sequencial:</strong> Procedimento, Complexidade, Financiamento, Valores, Sexo, Idades, Quantidade, Permanência, Pontos</div>
            <div><strong>Posicional:</strong> Origem, Modalidade, Instrumento de Registro, CBO, CID</div>
            <div><strong>Fallback:</strong> Google Gemini AI para casos complexos</div>
          </div>
        </div>
      </div>

      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">Consulta Tabela SIGTAP</h2>
            <p className="text-gray-600 mt-1">
              Visualize e consulte todos os procedimentos da tabela SIGTAP
              {lastImportDate && (
                <span className="text-sm text-gray-500 block">
                  Importado em: {new Date(lastImportDate).toLocaleString('pt-BR')}
                </span>
              )}
            </p>
          </div>
          <div className="flex space-x-2">
            <Button 
              onClick={handleExportCSV} 
              variant="outline" 
              className="flex items-center space-x-2"
              disabled={!filteredProcedures.length}
            >
              <Download className="w-4 h-4" />
              <span>Exportar CSV</span>
            </Button>
            <Button 
              onClick={() => {
                if (confirm('Tem certeza que deseja limpar todos os dados? Você precisará importar o PDF novamente.')) {
                  clearData();
                }
              }}
              variant="outline" 
              className="flex items-center space-x-2 text-red-600 hover:text-red-700"
            >
              <AlertCircle className="w-4 h-4" />
              <span>Limpar Dados</span>
            </Button>
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span>Filtros de Pesquisa</span>
              <Badge variant="secondary">
                {filteredProcedures.length} de {totalProcedures} procedimentos
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Buscar por código ou descrição</label>
                <div className="relative">
                  <Search className="w-4 h-4 absolute left-3 top-3 text-gray-400" />
                  <Input
                    placeholder="Digite o código ou descrição..."
                    value={searchTerm}
                    onChange={(e) => {
                      setSearchTerm(e.target.value);
                      setCurrentPage(1);
                    }}
                    className="pl-10"
                  />
                </div>
              </div>
              
              <div className="space-y-2">
                <label className="text-sm font-medium">Filtrar por complexidade</label>
                <Select value={complexityFilter} onValueChange={(value) => {
                  setComplexityFilter(value);
                  setCurrentPage(1);
                }}>
                  <SelectTrigger>
                    <SelectValue placeholder="Todas as complexidades" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todas as complexidades</SelectItem>
                    {complexities.filter(c => c && c.trim()).map((complexity) => (
                      <SelectItem key={complexity} value={complexity}>
                        {complexity}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Filtrar por financiamento</label>
                <Select value={financingFilter} onValueChange={(value) => {
                  setFinancingFilter(value);
                  setCurrentPage(1);
                }}>
                  <SelectTrigger>
                    <SelectValue placeholder="Todos os tipos" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos os tipos</SelectItem>
                    {financingTypes.filter(f => f && f.trim()).map((financing) => (
                      <SelectItem key={financing} value={financing}>
                        {financing}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Filtrar por origem</label>
                <Select value={origemFilter} onValueChange={(value) => {
                  setOrigemFilter(value);
                  setCurrentPage(1);
                }}>
                  <SelectTrigger>
                    <SelectValue placeholder="Todas as origens" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todas as origens</SelectItem>
                    {origemTypes.filter(o => o && o.trim()).map((origem) => (
                      <SelectItem key={origem} value={origem}>
                        {origem}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Procedimentos SIGTAP - Tabela Completa para Faturamento</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="rounded-md border overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-28">Código</TableHead>
                    <TableHead className="min-w-64">Procedimento</TableHead>
                    <TableHead className="w-36">Complexidade</TableHead>
                    <TableHead className="w-36">Financiamento</TableHead>
                    <TableHead className="w-28 text-right">Valor SA</TableHead>
                    <TableHead className="w-28 text-right">Valor SP</TableHead>
                    <TableHead className="w-28 text-right">Valor SH</TableHead>
                    <TableHead className="w-20 text-center">
                      <span className="inline-flex items-center gap-1 text-xs font-medium">
                        <FileText className="w-4 h-4" />
                        Detalhes
                      </span>
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paginatedProcedures.map((procedure) => (
                    <React.Fragment key={procedure.code}>
                      <TableRow className={expandedRows.has(procedure.code) ? 'bg-blue-50' : 'hover:bg-gray-50'}>
                        <TableCell className="font-mono text-sm font-medium">{procedure.code}</TableCell>
                        <TableCell className="text-sm" title={procedure.description}>
                          <div className="max-w-md">
                            <div className="line-clamp-2 overflow-hidden text-ellipsis">
                          {procedure.description}
                            </div>
                          </div>
                      </TableCell>
                        <TableCell>
                            <Badge variant="outline" className="text-xs whitespace-nowrap">
                              {procedure.complexity.length > 15 ? 
                                procedure.complexity.substring(0, 15) + '...' : 
                                procedure.complexity
                              }
                          </Badge>
                        </TableCell>
                          <TableCell className="text-xs">
                            <div className="max-w-32 truncate" title={procedure.financing}>
                              {procedure.financing ? 
                                (procedure.financing.length > 20 ? 
                                  procedure.financing.substring(0, 20) + '...' : 
                                  procedure.financing
                                ) : '-'
                              }
                            </div>
                          </TableCell>
                          <TableCell className="text-right text-sm font-medium text-green-600">
                            {formatCurrency(procedure.valueAmb)}
                          </TableCell>
                          <TableCell className="text-right text-sm font-medium text-blue-600">
                            {formatCurrency(procedure.valueProf)}
                          </TableCell>
                          <TableCell className="text-right text-sm font-medium text-blue-700">
                            {formatCurrency(procedure.valueHosp)}
                          </TableCell>
                          <TableCell className="text-center">
                          <Button
                            size="sm"
                            variant="ghost"
                              className={`p-2 rounded-full transition-all duration-200 ${
                                expandedRows.has(procedure.code) 
                                  ? 'bg-blue-100 hover:bg-blue-200 text-blue-700' 
                                  : 'hover:bg-gray-100 text-gray-600 hover:text-gray-800'
                              }`}
                              onClick={() => toggleRowExpansion(procedure.code)}
                              title={expandedRows.has(procedure.code) ? "Fechar detalhes" : "Ver todos os detalhes"}
                            >
                              {expandedRows.has(procedure.code) ? (
                                <ChevronUp className="w-4 h-4" />
                              ) : (
                                <ChevronDown className="w-4 h-4" />
                              )}
                          </Button>
                        </TableCell>
                      </TableRow>
                        
                        {expandedRows.has(procedure.code) && (
                          <TableRow>
                            <TableCell colSpan={8} className="p-0">
                              <div className="bg-gradient-to-r from-blue-50 to-gray-50 p-6 border-t">
                                <h4 className="text-lg font-semibold text-gray-800 mb-4 flex items-center">
                                  <FileText className="w-5 h-5 text-blue-600 mr-2" />
                                  Detalhes Completos do Procedimento
                                </h4>
                                
                                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                                  {/* Coluna 1: Identificação e Classificação */}
                                  <div className="space-y-4">
                                    <div className="bg-white p-4 rounded-lg border">
                                      <h5 className="font-medium text-gray-700 mb-3 border-b pb-2">Identificação</h5>
                                      <div className="space-y-2 text-sm">
                                        <div className="flex justify-between">
                                          <span className="text-gray-600">Código:</span>
                                          <span className="font-mono font-medium">{procedure.code}</span>
                                        </div>
                                        <div className="pt-1">
                                          <span className="text-gray-600 block mb-1">Procedimento:</span>
                                          <span className="text-gray-900 text-sm leading-relaxed">{procedure.description}</span>
                                        </div>
                                      </div>
                                    </div>
                                    
                                    <div className="bg-white p-4 rounded-lg border">
                                      <h5 className="font-medium text-gray-700 mb-3 border-b pb-2">Classificação</h5>
                                      <div className="space-y-2 text-sm">
                                        <div className="flex justify-between">
                                          <span className="text-gray-600">Origem:</span>
                                          <span className="text-xs">{procedure.origem || 'Não informado'}</span>
                                        </div>
                                        <div className="flex justify-between">
                                          <span className="text-gray-600">Complexidade:</span>
                                          <Badge variant="outline">{procedure.complexity}</Badge>
                                        </div>
                                        <div className="flex justify-between">
                                          <span className="text-gray-600">Modalidade:</span>
                                          <span className="text-xs">{procedure.modality || 'Não informado'}</span>
                                        </div>
                                        <div className="pt-1">
                                          <span className="text-gray-600 block mb-1">Instrumento:</span>
                                          <span className="text-xs">{procedure.registrationInstrument || 'Não informado'}</span>
                                        </div>
                                        <div className="pt-1">
                                          <span className="text-gray-600 block mb-1">Financiamento:</span>
                                          <span className="text-xs">{procedure.financing || 'Não informado'}</span>
                                        </div>
                                        <div className="pt-1">
                                          <span className="text-gray-600 block mb-1">Especialidade Leito:</span>
                                          <span className="text-xs">{procedure.especialidadeLeito || 'Não informado'}</span>
                                        </div>
                                      </div>
                                    </div>
                                  </div>
                                  
                                  {/* Coluna 2: Valores Financeiros */}
                                  <div className="space-y-4">
                                    <div className="bg-white p-4 rounded-lg border">
                                      <h5 className="font-medium text-gray-700 mb-3 border-b pb-2">Valores Ambulatoriais</h5>
                                      <div className="space-y-2 text-sm">
                                        <div className="flex justify-between">
                                          <span className="text-gray-600">Serviço Amb. (SA):</span>
                                          <span className="font-semibold text-green-600">{formatCurrency(procedure.valueAmb)}</span>
                                        </div>
                                        <div className="flex justify-between">
                                          <span className="text-gray-600">Total Ambulatorial:</span>
                                          <span className="font-semibold text-green-600">{formatCurrency(procedure.valueAmbTotal)}</span>
                                        </div>
                                      </div>
                                    </div>
                                    
                                    <div className="bg-white p-4 rounded-lg border">
                                      <h5 className="font-medium text-gray-700 mb-3 border-b pb-2">Valores Hospitalares</h5>
                                      <div className="space-y-2 text-sm">
                                        <div className="flex justify-between">
                                          <span className="text-gray-600">Serviço Hosp. (SH):</span>
                                          <span className="font-semibold text-blue-600">{formatCurrency(procedure.valueHosp)}</span>
                                        </div>
                                        <div className="flex justify-between">
                                          <span className="text-gray-600">Serviço Prof. (SP):</span>
                                          <span className="font-semibold text-blue-600">{formatCurrency(procedure.valueProf)}</span>
                                        </div>
                                        <div className="flex justify-between">
                                          <span className="text-gray-600">Total Hospitalar:</span>
                                          <span className="font-semibold text-blue-600">{formatCurrency(procedure.valueHospTotal)}</span>
                                        </div>
                                        <hr className="my-2" />
                                        <div className="flex justify-between text-base font-bold">
                                          <span>VALOR TOTAL:</span>
                                          <span className="text-purple-600">
                                            {formatCurrency(
                                              procedure.valueAmb + 
                                              procedure.valueAmbTotal + 
                                              procedure.valueHosp + 
                                              procedure.valueProf + 
                                              procedure.valueHospTotal
                                            )}
                                          </span>
                                        </div>
                                      </div>
                                    </div>
                                  </div>
                                  
                                  {/* Coluna 3: Critérios e Limites */}
                                  <div className="space-y-4">
                                    <div className="bg-white p-4 rounded-lg border">
                                      <h5 className="font-medium text-gray-700 mb-3 border-b pb-2">Critérios de Elegibilidade</h5>
                                      <div className="space-y-2 text-sm">
                                        <div className="flex justify-between">
                                          <span className="text-gray-600">Sexo:</span>
                                          <span className="font-medium">{procedure.gender || 'Ambos'}</span>
                                        </div>
                                        <div className="flex justify-between">
                                          <span className="text-gray-600">Idade Mínima:</span>
                                          <span className="font-medium">
                                            {procedure.minAge || 0} {procedure.minAgeUnit || 'Ano(s)'}
                                          </span>
                                        </div>
                                        <div className="flex justify-between">
                                          <span className="text-gray-600">Idade Máxima:</span>
                                          <span className="font-medium">
                                            {procedure.maxAge || 'Sem limite'} {procedure.maxAgeUnit || 'Ano(s)'}
                                          </span>
                                        </div>
                                      </div>
                                    </div>
                                    
                                    <div className="bg-white p-4 rounded-lg border">
                                      <h5 className="font-medium text-gray-700 mb-3 border-b pb-2">Limites Operacionais</h5>
                                      <div className="space-y-2 text-sm">
                                        <div className="flex justify-between">
                                          <span className="text-gray-600">Quantidade Máxima:</span>
                                          <span className="font-medium">{procedure.maxQuantity || 'Sem limite'}</span>
                                        </div>
                                        <div className="flex justify-between">
                                          <span className="text-gray-600">Média Permanência:</span>
                                          <span className="font-medium">{procedure.averageStay || '-'} dias</span>
                                        </div>
                                        <div className="flex justify-between">
                                          <span className="text-gray-600">Pontos:</span>
                                          <span className="font-medium">{procedure.points || '-'}</span>
                                        </div>
                                      </div>
                                    </div>
                                    
                                    {/* Nova seção: Classificações Médicas e Profissionais */}
                                    <div className="bg-white p-4 rounded-lg border">
                                      <h5 className="font-medium text-gray-700 mb-3 border-b pb-2">Classificações</h5>
                                      <div className="space-y-2 text-sm">
                                        <div className="pt-1">
                                          <span className="text-gray-600 block mb-1">CBO:</span>
                                          <span className="text-xs break-words">
                                            {Array.isArray(procedure.cbo) && procedure.cbo.length > 0 
                                              ? procedure.cbo.join(', ') 
                                              : 'Não especificado'}
                                          </span>
                                        </div>
                                        {((Array.isArray(procedure.cid) && procedure.cid.length > 0) || procedure.cid) && (
                                          <div className="pt-1">
                                            <span className="text-gray-600 block mb-1">CID:</span>
                                            <span className="text-xs break-words">
                                              {Array.isArray(procedure.cid) 
                                                ? procedure.cid.join(', ') 
                                                : procedure.cid}
                                            </span>
                                          </div>
                                        )}
                                        {procedure.complementaryAttribute && (
                                          <div className="pt-1">
                                            <span className="text-gray-600 block mb-1">Atributo Complementar:</span>
                                            <span className="text-xs break-words">{procedure.complementaryAttribute}</span>
                                          </div>
                                        )}
                                      </div>
                                    </div>
                                    
                                    {/* Nova seção: Habilitações */}
                                    {(procedure.habilitation || procedure.habilitationGroup?.length > 0) && (
                                      <div className="bg-white p-4 rounded-lg border">
                                        <h5 className="font-medium text-gray-700 mb-3 border-b pb-2">Habilitações</h5>
                                        <div className="space-y-2 text-sm">
                                          {procedure.habilitation && (
                                            <div className="pt-1">
                                              <span className="text-gray-600 block mb-1">Habilitação:</span>
                                              <span className="text-xs">{procedure.habilitation}</span>
                                            </div>
                                          )}
                                          {procedure.habilitationGroup?.length > 0 && (
                                            <div className="pt-1">
                                              <span className="text-gray-600 block mb-1">Grupos de Habilitação:</span>
                                              <div className="space-y-1">
                                                {procedure.habilitationGroup.slice(0, 5).map((group, index) => (
                                                  <div key={index} className="text-xs bg-gray-50 p-1 rounded">
                                                    {group}
                                                  </div>
                                                ))}
                                                {procedure.habilitationGroup.length > 5 && (
                                                  <div className="text-xs text-gray-500">
                                                    ... e mais {procedure.habilitationGroup.length - 5} grupos
                                                  </div>
                                                )}
                                              </div>
                                            </div>
                                          )}
                                          {procedure.serviceClassification && (
                                            <div className="pt-1">
                                              <span className="text-gray-600 block mb-1">Serviço/Classificação:</span>
                                              <span className="text-xs">{procedure.serviceClassification}</span>
                                            </div>
                                          )}
                                        </div>
                                      </div>
                                    )}
                                  </div>
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

            {totalPages > 1 && (
              <div className="flex items-center justify-between mt-4">
                <div className="text-sm text-gray-600">
                  Mostrando {((currentPage - 1) * itemsPerPage) + 1} a {Math.min(currentPage * itemsPerPage, filteredProcedures.length)} de {filteredProcedures.length} resultados
                </div>
                <div className="flex space-x-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                    disabled={currentPage === 1}
                  >
                    Anterior
                  </Button>
                  <span className="flex items-center text-sm">
                    Página {currentPage} de {totalPages}
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                    disabled={currentPage === totalPages}
                  >
                    Próxima
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default SigtapViewer;

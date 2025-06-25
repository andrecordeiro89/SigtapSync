import React, { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Search, Filter, Download, Eye, FileText, AlertCircle } from 'lucide-react';
import { formatCurrency } from '../utils/validation';
import { SigtapProcedure } from '../types';
import { useSigtapContext } from '../contexts/SigtapContext';

const SigtapViewer = () => {
  const { procedures, totalProcedures, lastImportDate, error } = useSigtapContext();
  const [searchTerm, setSearchTerm] = useState('');
  const [complexityFilter, setComplexityFilter] = useState('all');
  const [financingFilter, setFinancingFilter] = useState('all');
  const [selectedProcedure, setSelectedProcedure] = useState<SigtapProcedure | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 20;

  const filteredProcedures = useMemo(() => {
    if (!procedures.length) return [];
    
    return procedures.filter(procedure => {
      const matchesSearch = procedure.code.toLowerCase().includes(searchTerm.toLowerCase()) ||
                           procedure.description.toLowerCase().includes(searchTerm.toLowerCase());
      
      const matchesComplexity = complexityFilter === 'all' || procedure.complexity === complexityFilter;
      const matchesFinancing = financingFilter === 'all' || procedure.financing === financingFilter;
      
      return matchesSearch && matchesComplexity && matchesFinancing;
    });
  }, [procedures, searchTerm, complexityFilter, financingFilter]);

  const paginatedProcedures = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    return filteredProcedures.slice(startIndex, startIndex + itemsPerPage);
  }, [filteredProcedures, currentPage]);

  const totalPages = Math.ceil(filteredProcedures.length / itemsPerPage);

  const complexities = useMemo(() => {
    return [...new Set(procedures.map(p => p.complexity))];
  }, [procedures]);

  const financingTypes = useMemo(() => {
    return [...new Set(procedures.map(p => p.financing))];
  }, [procedures]);

  const handleExportCSV = () => {
    if (!filteredProcedures.length) return;
    
    const headers = ['Código', 'Descrição', 'Valor Ambulatorial', 'Valor Hospitalar', 'Valor Profissional', 'Complexidade', 'Financiamento'];
    const csvContent = [
      headers.join(','),
      ...filteredProcedures.map(p => [
        p.code,
        `"${p.description}"`,
        p.valueAmb,
        p.valueHosp,
        p.valueProf,
        p.complexity,
        p.financing
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
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
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
                  {complexities.map((complexity) => (
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
                  {financingTypes.map((financing) => (
                    <SelectItem key={financing} value={financing}>
                      {financing}
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
          <CardTitle>Procedimentos SIGTAP</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Código</TableHead>
                  <TableHead>Descrição</TableHead>
                  <TableHead>Valor Amb.</TableHead>
                  <TableHead>Valor Hosp.</TableHead>
                  <TableHead>Valor Prof.</TableHead>
                  <TableHead>Complexidade</TableHead>
                  <TableHead>Financiamento</TableHead>
                  <TableHead>Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paginatedProcedures.map((procedure) => (
                  <TableRow key={procedure.code}>
                    <TableCell className="font-mono text-sm">{procedure.code}</TableCell>
                    <TableCell className="max-w-xs truncate" title={procedure.description}>
                      {procedure.description}
                    </TableCell>
                    <TableCell className="text-right">{formatCurrency(procedure.valueAmb)}</TableCell>
                    <TableCell className="text-right">{formatCurrency(procedure.valueHosp)}</TableCell>
                    <TableCell className="text-right">{formatCurrency(procedure.valueProf)}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className="text-xs">
                        {procedure.complexity}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary" className="text-xs">
                        {procedure.financing}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => setSelectedProcedure(procedure)}
                      >
                        <Eye className="w-4 h-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
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

      {selectedProcedure && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <FileText className="w-5 h-5 text-blue-600" />
              <span>Detalhes do Procedimento</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-4">
                <div>
                  <label className="text-sm font-medium text-gray-600">Código do Procedimento</label>
                  <p className="font-mono text-lg">{selectedProcedure.code}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-600">Descrição Completa</label>
                  <p className="text-gray-900">{selectedProcedure.description}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-600">Complexidade</label>
                  <Badge variant="outline" className="ml-2">{selectedProcedure.complexity}</Badge>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-600">Tipo de Financiamento</label>
                  <Badge variant="secondary" className="ml-2">{selectedProcedure.financing}</Badge>
                </div>
              </div>
              
              <div className="space-y-4">
                <div>
                  <label className="text-sm font-medium text-gray-600">Valores de Faturamento</label>
                  <div className="bg-gray-50 p-4 rounded-lg space-y-2">
                    <div className="flex justify-between">
                      <span>Valor Ambulatorial (SA):</span>
                      <span className="font-semibold">{formatCurrency(selectedProcedure.valueAmb)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Valor Hospitalar (SH):</span>
                      <span className="font-semibold">{formatCurrency(selectedProcedure.valueHosp)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Valor Profissional (SP):</span>
                      <span className="font-semibold">{formatCurrency(selectedProcedure.valueProf)}</span>
                    </div>
                    <hr className="my-2" />
                    <div className="flex justify-between text-lg font-bold">
                      <span>Valor Total:</span>
                      <span className="text-blue-600">
                        {formatCurrency(selectedProcedure.valueAmb + selectedProcedure.valueHosp + selectedProcedure.valueProf)}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
            
            <div className="mt-6 flex justify-end">
              <Button variant="outline" onClick={() => setSelectedProcedure(null)}>
                Fechar Detalhes
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default SigtapViewer;

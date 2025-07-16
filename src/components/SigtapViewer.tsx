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
import { useAuth } from '../contexts/AuthContext';

// Função para corrigir problemas de encoding
const fixEncoding = (text: string): string => {
  if (!text) return text;
  
  try {
    // Se o texto já está em UTF-8 correto, retorna como está
    if (text.includes('á') || text.includes('ã') || text.includes('ç')) {
      return text;
    }
    
    // Corrigir caracteres mal codificados mais comuns
    let fixedText = text;
    
    // Substituições seguras usando replace
    fixedText = fixedText.replace(/Ã¡/g, 'á');
    fixedText = fixedText.replace(/Ã£/g, 'ã');
    fixedText = fixedText.replace(/Ã§/g, 'ç');
    fixedText = fixedText.replace(/Ã©/g, 'é');
    fixedText = fixedText.replace(/Ãª/g, 'ê');
    fixedText = fixedText.replace(/Ã­/g, 'í');
    fixedText = fixedText.replace(/Ã³/g, 'ó');
    fixedText = fixedText.replace(/Ã´/g, 'ô');
    fixedText = fixedText.replace(/Ãµ/g, 'õ');
    fixedText = fixedText.replace(/Ãº/g, 'ú');
    fixedText = fixedText.replace(/Ã /g, 'à');
    fixedText = fixedText.replace(/Ã¢/g, 'â');
    fixedText = fixedText.replace(/Ã¨/g, 'è');
    fixedText = fixedText.replace(/Ã¬/g, 'ì');
    fixedText = fixedText.replace(/Ã²/g, 'ò');
    fixedText = fixedText.replace(/Ã¹/g, 'ù');
    
    return fixedText;
  } catch (error) {
    console.warn('Erro ao corrigir encoding:', error);
    return text;
  }
};

// Função para garantir texto UTF-8 limpo
const cleanText = (text: string): string => {
  if (!text) return text;
  
  // Primeiro corrige encoding
  let cleaned = fixEncoding(text);
  
  // Remove caracteres de controle não imprimíveis
  // eslint-disable-next-line no-control-regex
  cleaned = cleaned.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '');
  
  // Normaliza espaços
  cleaned = cleaned.replace(/\s+/g, ' ').trim();
  
  return cleaned;
};

const SigtapViewer = () => {
  const { 
    procedures, 
    totalProcedures, 
    lastImportDate, 
    error, 
    clearData, 
    forceReload, 
    isLoading, 
    importSigtapFile,
    // ✅ NOVOS CAMPOS PARA CACHE INTELIGENTE
    isInitialLoading,
    lastCacheUpdate,
    cacheStatus
  } = useSigtapContext();
  
  const { hasFullAccess } = useAuth(); // Hook para verificar permissões
  const [searchTerm, setSearchTerm] = useState('');
  const [complexityFilter, setComplexityFilter] = useState('all');
  const [financingFilter, setFinancingFilter] = useState('all');
  const [modalityFilter, setModalityFilter] = useState('all');
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 20;

  // Verificar se usuário tem acesso administrativo (diretoria)
  const isAdminUser = hasFullAccess();

  // ✅ ESTADOS COMBINADOS PARA LOADING
  const isCurrentlyLoading = isLoading || isInitialLoading;
  const hasData = procedures.length > 0;
  const showLoadingState = isCurrentlyLoading || cacheStatus === 'loading';

  // ✅ INFORMAÇÕES DE CACHE PARA DEBUG
  const getCacheInfo = () => {
    if (!lastCacheUpdate) return 'Sem cache';
    
    const now = new Date().getTime();
    const cacheTime = new Date(lastCacheUpdate).getTime();
    const cacheAge = now - cacheTime;
    const minutes = Math.round(cacheAge / 60000);
    
    return `Cache: ${minutes}min atrás`;
  };

  const filteredProcedures = useMemo(() => {
    if (!procedures.length) return [];
    
    return procedures.filter(procedure => {
      const matchesSearch = procedure.code.toLowerCase().includes(searchTerm.toLowerCase()) ||
                           procedure.description.toLowerCase().includes(searchTerm.toLowerCase());
      
      const matchesComplexity = complexityFilter === 'all' || procedure.complexity === complexityFilter;
      const matchesFinancing = financingFilter === 'all' || procedure.financing === financingFilter;
      const matchesModality = modalityFilter === 'all' || procedure.modality === modalityFilter;
      
      return matchesSearch && matchesComplexity && matchesFinancing && matchesModality;
    });
      }, [procedures, searchTerm, complexityFilter, financingFilter, modalityFilter]);

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

  const modalityTypes = useMemo(() => {
    return [...new Set(procedures.map(p => p.modality).filter(Boolean))];
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
      'Tipo de Financiamento', 'Valor SA (Ambulatorial)', 'Valor SH (Hospitalar)', 
      'Valor SP (Profissional)', 'VALOR TOTAL SIGTAP',
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
        p.valueHosp,
        p.valueProf,
          (p.valueAmb + p.valueHosp + p.valueProf).toFixed(2),
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

  const handleClearCache = async () => {
    clearData();
    localStorage.clear();
    sessionStorage.clear();
    await new Promise(resolve => setTimeout(resolve, 500));
    await forceReload();
  };

  const handleForceReload = async () => {
    try {
      clearData();
      localStorage.clear();
      sessionStorage.clear();
      await new Promise(resolve => setTimeout(resolve, 200));
      await forceReload();
    } catch (error) {
      console.error('Erro no reload:', error);
    }
  };

  // ✅ NOVA TELA DE LOADING DURANTE CARREGAMENTO INICIAL
  if (showLoadingState && !hasData) {
    return (
      <div className="space-y-6">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Consulta SIGTAP</h2>
          <p className="text-gray-600 mt-1">Carregando procedimentos automaticamente...</p>
        </div>

        <Card>
          <CardContent className="p-8 text-center space-y-6">
            <div className="flex items-center justify-center space-x-4">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
              <div className="text-left">
                <div className="text-xl font-semibold text-gray-900">
                  Carregando dados SIGTAP
                </div>
                <div className="text-gray-600">
                  {cacheStatus === 'loading' ? 'Buscando procedimentos do banco...' : 'Preparando dados...'}
                </div>
              </div>
            </div>

            {/* Barra de progresso visual */}
            <div className="w-full bg-gray-200 rounded-full h-2.5">
              <div className="bg-blue-600 h-2.5 rounded-full animate-pulse" style={{ width: '60%' }}></div>
            </div>

            {/* Status do cache */}
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 text-left">
              <div className="flex items-center">
                <div className="animate-pulse h-2 w-2 bg-blue-500 rounded-full mr-3"></div>
                <div>
                  <h4 className="text-blue-800 font-medium">Sistema de Cache Inteligente</h4>
                  <p className="text-blue-700 text-sm mt-1">
                    {cacheStatus === 'loading' && 'Carregando dados do Supabase...'}
                    {cacheStatus === 'cached' && 'Dados em cache - carregando...'}
                    {cacheStatus === 'empty' && 'Inicializando sistema...'}
                  </p>
                </div>
              </div>
            </div>

            {/* Informações técnicas */}
            <div className="text-xs text-gray-500 space-y-1">
              <div>Status: {cacheStatus}</div>
              <div>Procedimentos esperados: {totalProcedures || '4886'}</div>
              <div>{getCacheInfo()}</div>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // ✅ TELA DE ERRO SE NÃO HÁ DADOS E NÃO ESTÁ CARREGANDO
  if (!hasData && !showLoadingState) {
    return (
      <div className="space-y-6">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Consulta SIGTAP</h2>
          <p className="text-gray-600 mt-1">Visualize e consulte os procedimentos da tabela SIGTAP</p>
        </div>

        <Card>
          <CardContent className="p-8 text-center space-y-6">
            <AlertCircle className="h-16 w-16 text-yellow-500 mx-auto" />
            
            <div>
              <h3 className="text-xl font-semibold text-gray-900 mb-2">
                Nenhum procedimento SIGTAP encontrado
              </h3>
              <p className="text-gray-600 mb-4">
                Os dados não estão carregados. O sistema tentou carregar automaticamente mas não encontrou dados.
              </p>
            </div>

            {/* Erro */}
            {error && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-left">
                <div className="flex">
                  <AlertCircle className="h-5 w-5 text-red-400 mt-0.5 mr-2" />
                  <div>
                    <h4 className="text-red-800 font-medium">Erro detectado:</h4>
                    <p className="text-red-700 text-sm mt-1">{error}</p>
                  </div>
                </div>
              </div>
            )}

            {/* Status do cache */}
            <div className="bg-orange-50 border border-orange-200 rounded-lg p-4 text-left">
              <div className="flex">
                <AlertCircle className="h-5 w-5 text-orange-400 mt-0.5 mr-2" />
                <div>
                  <h4 className="text-orange-800 font-medium">Status do Sistema:</h4>
                  <div className="text-orange-700 text-sm mt-1 space-y-1">
                    <div>Cache: {cacheStatus}</div>
                    <div>{getCacheInfo()}</div>
                    <div>Último carregamento: {lastImportDate ? new Date(lastImportDate).toLocaleString('pt-BR') : 'Nunca'}</div>
                  </div>
                </div>
              </div>
            </div>

            {/* Botões de Ação */}
            <div className="space-y-3">
              <div className="flex flex-col sm:flex-row gap-3 justify-center">
                <Button 
                  onClick={handleForceReload}
                  disabled={isCurrentlyLoading}
                  className="bg-blue-600 hover:bg-blue-700"
                >
                  <Search className="h-4 w-4 mr-2" />
                  {isCurrentlyLoading ? 'Carregando...' : 'Recarregar Dados'}
                </Button>
                
                <Button 
                  onClick={handleClearCache}
                  variant="outline"
                  disabled={isCurrentlyLoading}
                >
                  <AlertCircle className="h-4 w-4 mr-2" />
                  Limpar Cache
                </Button>
              </div>

              {/* Instruções */}
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 text-left">
                <div className="flex">
                  <FileText className="h-5 w-5 text-blue-400 mt-0.5 mr-2" />
                  <div>
                    <h4 className="text-blue-800 font-medium">Como resolver:</h4>
                    <ul className="text-blue-700 text-sm mt-1 space-y-1">
                      <li>1. Clique em "Recarregar Dados" para forçar nova busca</li>
                      <li>2. Se não funcionar, clique em "Limpar Cache"</li>
                      <li>3. Em último caso, vá para a aba "SIGTAP" e faça novo upload</li>
                    </ul>
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // ✅ TELA PRINCIPAL COM DADOS CARREGADOS
  return (
    <div className="space-y-6">
      {/* Header Refinado */}
      <div className="bg-gradient-to-r from-purple-50 via-white to-blue-50 rounded-xl p-6 border border-purple-100/50 shadow-sm">
        <div className="flex justify-between items-center">
          <div>
            <div className="flex items-center space-x-3 mb-3">
              <div className="p-2 bg-gradient-to-br from-purple-100 to-blue-200 rounded-xl shadow-sm">
                <FileText className="w-8 h-8 text-purple-700" />
              </div>
              <h2 className="text-3xl font-bold text-gray-900">Consulta SIGTAP</h2>
            </div>
            <div className="text-gray-600 space-y-2">
              <p className="leading-relaxed max-w-2xl">
                Base inteligente de procedimentos SIGTAP com tecnologia híbrida de extração
              </p>
              {lastImportDate && (
                <span className="text-sm text-gray-500 block">
                  📅 Importado em: {new Date(lastImportDate).toLocaleString('pt-BR')}
                </span>
              )}
              <div className="flex flex-wrap items-center gap-3">
                <div className="flex items-center gap-2">
                  <div className="p-1 bg-blue-100 rounded">
                    <div className="w-2 h-2 bg-blue-600 rounded-full"></div>
                  </div>
                  <span className="text-sm font-medium text-blue-700">
                    {procedures.length.toLocaleString()} procedimentos
                  </span>
                </div>
                
                <Badge variant={procedures.length >= 10000 ? 'destructive' : procedures.length < 2000 ? 'secondary' : 'default'} 
                       className="px-3 py-1">
                  {procedures.length >= 10000 ? '⚠️ Limite' : procedures.length < 2000 ? '❌ Incompleto' : '✅ Completo'}
                </Badge>
                
                {/* ✅ INDICADOR DE CACHE */}
                <Badge variant="outline" className="bg-gradient-to-r from-gray-50 to-gray-100 border-gray-300 text-gray-700">
                  {cacheStatus === 'cached' && '💾 Cache'}
                  {cacheStatus === 'loading' && '⏳ Carregando'}
                  {cacheStatus === 'error' && '❌ Erro'}
                  {cacheStatus === 'empty' && '🔄 Vazio'}
                </Badge>
              </div>
            </div>
          </div>
        
        {/* Botões Administrativos - Apenas para Diretoria */}
        {isAdminUser && (
          <div className="flex space-x-2">
            <Button 
              onClick={handleExportCSV} 
              variant="outline" 
              className="flex items-center space-x-2"
              disabled={!filteredProcedures.length}
              title="Exportar dados para CSV - Apenas Diretoria"
            >
              <Download className="w-4 h-4" />
              <span>Exportar</span>
            </Button>
            <Button 
              onClick={() => {
                if (confirm('Limpar todos os dados? Você precisará importar novamente.')) {
                  clearData();
                }
              }}
              variant="outline" 
              className="flex items-center space-x-2 text-red-600 hover:text-red-700"
              title="Limpar dados - Apenas Diretoria"
            >
              <AlertCircle className="w-4 h-4" />
              <span>Limpar</span>
            </Button>
            <Button 
              onClick={handleClearCache}
              variant="outline" 
              className="flex items-center space-x-2 bg-orange-50 border-orange-300 text-orange-700 hover:bg-orange-100"
              disabled={isCurrentlyLoading}
              title="Limpar cache e recarregar dados - Apenas Diretoria"
            >
              {isCurrentlyLoading ? '⏳' : '🧹'} Cache
            </Button>
            <Button 
              onClick={handleForceReload}
              variant="outline" 
              className="flex items-center space-x-2 bg-green-50 border-green-300 text-green-700 hover:bg-green-100"
              disabled={isCurrentlyLoading}
              title="Recarregar dados do banco - Apenas Diretoria"
            >
              {isCurrentlyLoading ? '⏳' : '🔧'} Reload
            </Button>
          </div>
        )}
        </div>
      </div>

      {/* ✅ INDICADOR DE LOADING SE CARREGANDO NO BACKGROUND */}
      {showLoadingState && hasData && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
          <div className="flex items-center space-x-2">
            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
            <span className="text-blue-700 text-sm">Atualizando dados em background...</span>
          </div>
        </div>
      )}

      {/* Filtros Refinados */}
      <Card className="bg-gradient-to-r from-slate-50 via-white to-slate-50/50 border-slate-200/60 shadow-md hover:shadow-lg transition-all duration-300">
        <CardHeader className="bg-gradient-to-r from-purple-50 to-blue-50 border-b border-purple-100">
          <CardTitle className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="p-2 bg-gradient-to-br from-purple-100 to-purple-200 rounded-lg shadow-sm">
                <Filter className="w-5 h-5 text-purple-700" />
              </div>
              <span className="text-gray-900">Filtros de Pesquisa</span>
            </div>
            <div className="flex items-center space-x-3">
              <Badge variant="secondary" className="bg-gradient-to-r from-purple-50 to-purple-100 text-purple-700 border-purple-300 px-3 py-1.5 font-medium">
                {filteredProcedures.length} de {totalProcedures} resultados
              </Badge>
              {/* ✅ INFO DE CACHE */}
              <span className="text-xs text-gray-500 bg-gray-100 px-2 py-1 rounded">
                {getCacheInfo()}
              </span>
            </div>
          </CardTitle>
        </CardHeader>
        <CardContent className="p-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <div className="space-y-3">
              <label className="text-sm font-medium text-gray-700 flex items-center space-x-2">
                <div className="p-1 bg-blue-100 rounded">
                  <Search className="w-3 h-3 text-blue-600" />
                </div>
                <span>Busca</span>
              </label>
              <div className="relative">
                <Search className="w-4 h-4 absolute left-3 top-3 text-gray-400" />
                <Input
                  placeholder="Código ou descrição..."
                  value={searchTerm}
                  onChange={(e) => {
                    setSearchTerm(e.target.value);
                    setCurrentPage(1);
                  }}
                  className="pl-10 border-gray-300 focus:border-blue-500 focus:ring-blue-500 bg-white/80 hover:bg-white transition-colors"
                />
              </div>
            </div>
            
            <div className="space-y-3">
              <label className="text-sm font-medium text-gray-700 flex items-center space-x-2">
                <div className="p-1 bg-green-100 rounded">
                  <Filter className="w-3 h-3 text-green-600" />
                </div>
                <span>Complexidade</span>
              </label>
              <Select value={complexityFilter} onValueChange={(value) => {
                setComplexityFilter(value);
                setCurrentPage(1);
              }}>
                <SelectTrigger className="border-gray-300 focus:border-green-500 focus:ring-green-500 bg-white/80 hover:bg-white transition-colors">
                  <SelectValue placeholder="Todas" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas</SelectItem>
                  {complexities.filter(c => c && c.trim()).map((complexity) => (
                    <SelectItem key={complexity} value={complexity}>
                      {complexity}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-3">
              <label className="text-sm font-medium text-gray-700 flex items-center space-x-2">
                <div className="p-1 bg-purple-100 rounded">
                  <Filter className="w-3 h-3 text-purple-600" />
                </div>
                <span>Financiamento</span>
              </label>
              <Select value={financingFilter} onValueChange={(value) => {
                setFinancingFilter(value);
                setCurrentPage(1);
              }}>
                <SelectTrigger className="border-gray-300 focus:border-purple-500 focus:ring-purple-500 bg-white/80 hover:bg-white transition-colors">
                  <SelectValue placeholder="Todos" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  {financingTypes.filter(f => f && f.trim()).map((financing) => (
                    <SelectItem key={financing} value={financing}>
                      {financing}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-3">
              <label className="text-sm font-medium text-gray-700 flex items-center space-x-2">
                <div className="p-1 bg-orange-100 rounded">
                  <Filter className="w-3 h-3 text-orange-600" />
                </div>
                <span>Modalidade</span>
              </label>
              <Select value={modalityFilter} onValueChange={(value) => {
                setModalityFilter(value);
                setCurrentPage(1);
              }}>
                <SelectTrigger className="border-gray-300 focus:border-orange-500 focus:ring-orange-500 bg-white/80 hover:bg-white transition-colors">
                  <SelectValue placeholder="Todas" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas</SelectItem>
                  {modalityTypes.filter(m => m && m.trim()).map((modality) => (
                    <SelectItem key={modality} value={modality}>
                      {modality}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="min-w-[100px]">Código</TableHead>
                  <TableHead className="min-w-[300px]">Procedimento</TableHead>
                  <TableHead className="text-right min-w-[100px]">Valor SA</TableHead>
                  <TableHead className="text-right min-w-[100px]">Valor SP</TableHead>
                  <TableHead className="text-right min-w-[100px]">Valor SH</TableHead>
                  <TableHead className="text-right min-w-[120px]">TOTAL</TableHead>
                  <TableHead className="text-center min-w-[80px]">Detalhes</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paginatedProcedures.map((procedure) => (
                  <React.Fragment key={procedure.code}>
                    <TableRow className="hover:bg-gray-50">
                      <TableCell className="font-mono text-sm font-medium">
                        {procedure.code}
                      </TableCell>
                      <TableCell className="text-sm max-w-[300px]">
                        <div className="truncate" title={cleanText(procedure.description)}>
                          {cleanText(procedure.description)}
                        </div>
                      </TableCell>
                      <TableCell className="text-right text-sm font-medium text-green-600">
                        {formatCurrency(procedure.valueAmb)}
                      </TableCell>
                      <TableCell className="text-right text-sm font-medium text-blue-600">
                        {formatCurrency(procedure.valueProf)}
                      </TableCell>
                      <TableCell className="text-right text-sm font-medium text-blue-700">
                        {(() => {
                          // 🔧 CORREÇÃO: Calcular SH correto = Total - SP
                          const valorTotalSigtap = procedure.valueHosp;
                          const valorSP = procedure.valueProf;
                          const valorSH = valorTotalSigtap - valorSP;
                          return formatCurrency(valorSH);
                        })()}
                      </TableCell>
                      <TableCell className="text-right text-sm font-bold text-purple-600">
                        {(() => {
                          // 🔧 CORREÇÃO: O procedure.valueHosp já é o VALOR TOTAL SIGTAP
                          return formatCurrency(procedure.valueHosp);
                        })()}
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
                          title={expandedRows.has(procedure.code) ? "Fechar detalhes" : "Ver detalhes"}
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
                        <TableCell colSpan={7} className="p-0">
                          <div className="bg-gradient-to-r from-blue-50 to-gray-50 p-6 border-t">
                            <h4 className="text-lg font-semibold text-gray-800 mb-4 flex items-center">
                              <FileText className="w-5 h-5 text-blue-600 mr-2" />
                              Detalhes Completos
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
                                      <span className="text-gray-900 text-sm leading-relaxed">{cleanText(procedure.description)}</span>
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
                                  <h5 className="font-medium text-gray-700 mb-3 border-b pb-2">💊 Valores Ambulatoriais</h5>
                                  <div className="space-y-2 text-sm">
                                    <div className="flex justify-between">
                                      <span className="text-gray-600">Serviço Amb. (SA):</span>
                                      <span className="font-semibold text-green-600">{formatCurrency(procedure.valueAmb)}</span>
                                    </div>
                                    <div className="text-xs text-gray-500 mt-1">
                                      * Valor para procedimentos ambulatoriais
                                    </div>
                                  </div>
                                </div>
                                
                                <div className="bg-white p-4 rounded-lg border">
                                  <h5 className="font-medium text-gray-700 mb-3 border-b pb-2">🏥 Valores Hospitalares</h5>
                                  <div className="space-y-2 text-sm">
                                    {(() => {
                                      // 🔧 CORREÇÃO: O valueHosp extraído é na verdade o VALOR TOTAL SIGTAP
                                      // Vamos reinterpretar os dados corretamente
                                      const valorTotalSigtap = procedure.valueHosp; // O que foi extraído como "SH" é o total
                                      const valorSP = procedure.valueProf;          // SP está correto
                                      const valorSH = valorTotalSigtap - valorSP;   // SH = Total - SP
                                      
                                      return (
                                        <>
                                          <div className="flex justify-between">
                                            <span className="text-gray-600">Serviço Hosp. (SH):</span>
                                            <span className="font-semibold text-blue-600">
                                              {formatCurrency(valorSH)}
                                            </span>
                                          </div>
                                          <div className="flex justify-between">
                                            <span className="text-gray-600">Serviço Prof. (SP):</span>
                                            <span className="font-semibold text-blue-600">
                                              {formatCurrency(valorSP)}
                                            </span>
                                          </div>
                                          <div className="flex justify-between border-t pt-2 mt-2">
                                            <span className="text-gray-600">Subtotal Hospitalar:</span>
                                            <span className="font-semibold text-blue-700">
                                              {formatCurrency(valorSH + valorSP)}
                                            </span>
                                          </div>
                                          <hr className="my-3" />
                                          <div className="flex justify-between text-base font-bold bg-purple-50 p-2 rounded">
                                            <span>💰 VALOR TOTAL SIGTAP:</span>
                                            <span className="text-purple-600">
                                              {formatCurrency(valorTotalSigtap)}
                                            </span>
                                          </div>
                                          <div className="text-xs text-gray-500 mt-2 bg-gray-50 p-2 rounded">
                                            <div className="font-medium mb-1">Composição:</div>
                                            <div>• SA: {formatCurrency(procedure.valueAmb)}</div>
                                            <div>• SH: {formatCurrency(valorSH)}</div>
                                            <div>• SP: {formatCurrency(valorSP)}</div>
                                          </div>
                                        </>
                                      );
                                    })()}
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
                                          <span className="text-gray-600 block mb-1">Grupos:</span>
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
          <div className="flex items-center justify-between mt-4 p-4">
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
  );
};

export default SigtapViewer;

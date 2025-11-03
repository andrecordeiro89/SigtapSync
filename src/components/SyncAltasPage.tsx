import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Alert, AlertDescription } from './ui/alert';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from './ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Badge } from './ui/badge';
import { GitCompare, Database, RefreshCw, Info, CheckCircle, XCircle, AlertTriangle, FileText } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { toast } from 'sonner';

const SyncAltasPage = () => {
  const { getCurrentHospital, canAccessAllHospitals } = useAuth();
  const userHospitalId = getCurrentHospital();

  // Estados para filtros AIH (Etapa 1)
  const [hospitaisAIH, setHospitaisAIH] = useState<Array<{id: string, name: string}>>([]);
  const [competenciasAIH, setCompetenciasAIH] = useState<string[]>([]);
  const [hospitalAIHSelecionado, setHospitalAIHSelecionado] = useState<string>('');
  const [competenciaAIHSelecionada, setCompetenciaAIHSelecionada] = useState<string>('');
  const [aihsEncontradas, setAihsEncontradas] = useState<any[]>([]);
  const [etapa1Concluida, setEtapa1Concluida] = useState(false);
  
  // Estados para filtros Altas Hospitalares (Etapa 2)
  const [hospitaisAltas, setHospitaisAltas] = useState<Array<{id: string, name: string}>>([]);
  const [competenciasAltas, setCompetenciasAltas] = useState<string[]>([]);
  const [hospitalAltasSelecionado, setHospitalAltasSelecionado] = useState<string>('');
  const [competenciaAltasSelecionada, setCompetenciaAltasSelecionada] = useState<string>('');
  const [altasEncontradas, setAltasEncontradas] = useState<any[]>([]);
  const [etapa2Concluida, setEtapa2Concluida] = useState(false);
  
  // Estados para sincronização (Etapa 3)
  const [resultadoSync, setResultadoSync] = useState<{
    sincronizados: number;
    pendentes: number;
    naoProcessados: number;
    detalhes: Array<{
      prontuario: string;
      status: 'sincronizado' | 'pendente' | 'nao_processado';
      aih?: any;
      alta?: any;
    }>;
  } | null>(null);
  
  const [isLoading, setIsLoading] = useState(false);

  // Carregar opções ao montar
  useEffect(() => {
    carregarOpcoes();
  }, []);

  // Função para carregar hospitais e competências
  const carregarOpcoes = async () => {
    try {
      console.log('📋 Carregando hospitais e opções...');

      // 1. Buscar hospitais
      const { data: hospitais, error: errorHospitais } = await supabase
        .from('hospitals')
        .select('id, name')
        .order('name');

      if (!errorHospitais && hospitais) {
        setHospitaisAIH(hospitais);
        setHospitaisAltas(hospitais);
        console.log(`✅ ${hospitais.length} hospitais carregados`);

        // ✅ SEMPRE travar no hospital do usuário (operadores)
        if (userHospitalId && userHospitalId !== 'ALL') {
          setHospitalAIHSelecionado(userHospitalId);
          setHospitalAltasSelecionado(userHospitalId);
          console.log(`🏥 Hospital travado: ${userHospitalId} (operador)`);
        }
      }

      // 2. Buscar competências disponíveis (AIH) - MESMA LÓGICA DA TELA PACIENTES
      // Carregar TODAS as AIHs em batches, igual a tela Pacientes faz
      console.log('🔍 Carregando AIHs para extrair competências (método tela Pacientes)...');
      
      const hospitalIdToLoad = userHospitalId && userHospitalId !== 'ALL' ? userHospitalId : 'ALL';
      const pageSize = 1000; // Supabase limita a 1000 por request
      let offset = 0;
      const allAIHs: any[] = [];

      while (true) {
        let queryBatch = supabase
          .from('aihs')
          .select('competencia')
          .not('competencia', 'is', null)
          .limit(pageSize)
          .range(offset, offset + pageSize - 1);

        // ✅ Filtrar por hospital se usuário não for admin
        if (hospitalIdToLoad !== 'ALL') {
          queryBatch = queryBatch.eq('hospital_id', hospitalIdToLoad);
        }

        const { data: batch, error } = await queryBatch;

        if (error) {
          console.error('❌ Erro ao carregar batch de AIHs:', error);
          break;
        }

        const batchLen = batch?.length || 0;
        if (batchLen === 0) break;
        allAIHs.push(...batch);
        if (batchLen < pageSize) break;
        offset += pageSize;
        // Evitar UI freeze em listas enormes
        await new Promise(r => setTimeout(r, 0));
      }

      console.log(`📊 Total de AIHs carregadas: ${allAIHs.length}`);

      // ✅ MESMA LÓGICA DA TELA PACIENTES: Extrair competências quando AIHs são carregadas
      if (allAIHs.length > 0) {
        const competencias = new Set<string>();
        allAIHs.forEach(aih => {
          if (aih.competencia) {
            competencias.add(aih.competencia);
          }
        });
        const sorted = Array.from(competencias).sort((a, b) => b.localeCompare(a)); // Mais recente primeiro
        
        console.log(`✅ ${sorted.length} competências únicas encontradas (AIH):`, sorted);
        
        // ✅ Adicionar opção "TODAS" no início
        setCompetenciasAIH(['TODAS', ...sorted]);
        if (sorted.length > 0) {
          setCompetenciaAIHSelecionada('TODAS');
        }
      }

      // 3. Buscar competências disponíveis (Altas) - MESMA LÓGICA DA TELA PACIENTES
      // Carregar TODAS as Altas em batches, igual a tela Pacientes faz
      console.log('🔍 Carregando Altas para extrair competências (método tela Pacientes)...');
      
      const allAltas: any[] = [];
      let offsetAltas = 0;

      while (true) {
        let queryAltasBatch = supabase
          .from('hospital_discharges')
          .select('competencia')
          .not('competencia', 'is', null)
          .limit(pageSize)
          .range(offsetAltas, offsetAltas + pageSize - 1);

        // ✅ Filtrar por hospital se usuário não for admin
        if (hospitalIdToLoad !== 'ALL') {
          queryAltasBatch = queryAltasBatch.eq('hospital_id', hospitalIdToLoad);
        }

        const { data: batch, error } = await queryAltasBatch;

        if (error) {
          console.error('❌ Erro ao carregar batch de Altas:', error);
          break;
        }

        const batchLen = batch?.length || 0;
        if (batchLen === 0) break;
        allAltas.push(...batch);
        if (batchLen < pageSize) break;
        offsetAltas += pageSize;
        // Evitar UI freeze em listas enormes
        await new Promise(r => setTimeout(r, 0));
      }

      console.log(`📊 Total de Altas carregadas: ${allAltas.length}`);

      // ✅ MESMA LÓGICA DA TELA PACIENTES: Extrair competências quando Altas são carregadas
      if (allAltas.length > 0) {
        const competencias = new Set<string>();
        allAltas.forEach(alta => {
          if (alta.competencia) {
            competencias.add(alta.competencia);
          }
        });
        const sorted = Array.from(competencias).sort((a, b) => b.localeCompare(a)); // Mais recente primeiro
        
        console.log(`✅ ${sorted.length} competências únicas encontradas (Altas):`, sorted);
        
        // ✅ Adicionar opção "TODAS" no início
        setCompetenciasAltas(['TODAS', ...sorted]);
        if (sorted.length > 0) {
          setCompetenciaAltasSelecionada('TODAS');
        }
      }

    } catch (error) {
      console.error('❌ Erro ao carregar opções:', error);
      toast.error('Erro ao carregar opções');
    }
  };

  // ETAPA 1: Buscar AIHs
  const buscarAIHs = async () => {
    if (!hospitalAIHSelecionado || !competenciaAIHSelecionada) {
      toast.error('Selecione hospital e competência');
      return;
    }

    setIsLoading(true);
    try {
      console.log('🔍 ETAPA 1 - Buscando AIHs...');
      console.log(`🏥 Hospital: ${hospitalAIHSelecionado}`);
      console.log(`📅 Competência: ${competenciaAIHSelecionada}`);

      // Construir query base
      let query = supabase
        .from('aihs')
        .select(`
          id,
          aih_number,
          patient_id,
          admission_date,
          discharge_date,
          competencia,
          patients (
            id,
            name,
            medical_record
          )
        `)
        .eq('hospital_id', hospitalAIHSelecionado);

      // ✅ Aplicar filtro de competência apenas se não for "TODAS"
      if (competenciaAIHSelecionada !== 'TODAS') {
        query = query.eq('competencia', competenciaAIHSelecionada);
      }

      const { data, error } = await query;

      if (error) {
        console.error('❌ Erro ao buscar AIHs:', error);
        toast.error('Erro ao buscar AIHs');
        return;
      }

      console.log(`✅ ${data?.length || 0} AIHs encontradas`);
      setAihsEncontradas(data || []);
      setEtapa1Concluida(true);
      
      toast.success(`✅ Etapa 1 concluída: ${data?.length || 0} AIHs encontradas!`);
    } catch (error) {
      console.error('❌ Erro:', error);
      toast.error('Erro ao buscar AIHs');
    } finally {
      setIsLoading(false);
    }
  };

  // ETAPA 2: Buscar Altas Hospitalares
  const buscarAltas = async () => {
    if (!hospitalAltasSelecionado || !competenciaAltasSelecionada) {
      toast.error('Selecione hospital e competência');
      return;
    }

    setIsLoading(true);
    try {
      console.log('🔍 ETAPA 2 - Buscando Altas Hospitalares...');
      console.log(`🏥 Hospital: ${hospitalAltasSelecionado}`);
      console.log(`📅 Competência: ${competenciaAltasSelecionada}`);

      // Construir query base
      let query = supabase
        .from('hospital_discharges')
        .select('*')
        .eq('hospital_id', hospitalAltasSelecionado);

      // ✅ Aplicar filtro de competência apenas se não for "TODAS"
      if (competenciaAltasSelecionada !== 'TODAS') {
        query = query.eq('competencia', competenciaAltasSelecionada);
      }

      const { data, error } = await query;

      if (error) {
        console.error('❌ Erro ao buscar altas:', error);
        toast.error('Erro ao buscar altas hospitalares');
        return;
      }

      console.log(`✅ ${data?.length || 0} altas hospitalares encontradas`);
      setAltasEncontradas(data || []);
      setEtapa2Concluida(true);
      
      toast.success(`✅ Etapa 2 concluída: ${data?.length || 0} altas encontradas!`);
    } catch (error) {
      console.error('❌ Erro:', error);
      toast.error('Erro ao buscar altas hospitalares');
    } finally {
      setIsLoading(false);
    }
  };

  // ETAPA 3: Sincronizar e Reconciliar
  const sincronizar = async () => {
    if (!etapa1Concluida || !etapa2Concluida) {
      toast.error('Complete as etapas 1 e 2 primeiro');
      return;
    }

    setIsLoading(true);
    try {
      console.log('🔄 ETAPA 3 - Iniciando sincronização...');
      console.log(`📊 AIHs: ${aihsEncontradas.length} registros`);
      console.log(`📊 Altas: ${altasEncontradas.length} registros`);

      // Criar mapa de altas por prontuário
      const mapAltas = new Map<string, any>();
      altasEncontradas.forEach(alta => {
        if (alta.id_prontuario) {
          mapAltas.set(alta.id_prontuario.trim().toUpperCase(), alta);
        }
      });

      console.log(`📋 Mapa de Altas: ${mapAltas.size} prontuários únicos`);

      // Criar mapa de AIHs por prontuário
      const mapAIHs = new Map<string, any>();
      aihsEncontradas.forEach(aih => {
        const prontuario = aih.patients?.medical_record;
        if (prontuario) {
          const key = prontuario.trim().toUpperCase();
          if (!mapAIHs.has(key)) {
            mapAIHs.set(key, []);
          }
          mapAIHs.get(key).push(aih);
        }
      });

      console.log(`📋 Mapa de AIHs: ${mapAIHs.size} prontuários únicos`);

      // Reconciliar
      const detalhes: any[] = [];
      let sincronizados = 0;
      let pendentes = 0;
      let naoProcessados = 0;

      // Percorrer todas as AIHs
      const prontuariosProcessados = new Set<string>();
      
      aihsEncontradas.forEach(aih => {
        const prontuario = aih.patients?.medical_record?.trim().toUpperCase();
        if (!prontuario || prontuariosProcessados.has(prontuario)) return;
        
        prontuariosProcessados.add(prontuario);
        const alta = mapAltas.get(prontuario);
        
        if (alta) {
          // Sincronizado: existe nas duas bases
          sincronizados++;
          detalhes.push({
            prontuario,
            status: 'sincronizado',
            aih,
            alta
          });
        } else {
          // Pendente: tem AIH mas não tem alta
          pendentes++;
          detalhes.push({
            prontuario,
            status: 'pendente',
            aih,
            alta: null
          });
        }
      });

      // Verificar altas sem AIH
      altasEncontradas.forEach(alta => {
        const prontuario = alta.id_prontuario?.trim().toUpperCase();
        if (!prontuario) return;
        
        const aihsComProntuario = mapAIHs.get(prontuario);
        if (!aihsComProntuario || aihsComProntuario.length === 0) {
          // Não processado: tem alta mas não tem AIH
          naoProcessados++;
          detalhes.push({
            prontuario,
            status: 'nao_processado',
            aih: null,
            alta
          });
        }
      });

      const resultado = {
        sincronizados,
        pendentes,
        naoProcessados,
        detalhes
      };

      setResultadoSync(resultado);

      console.log('✅ Sincronização concluída:');
      console.log(`   ✓ Sincronizados: ${sincronizados}`);
      console.log(`   ⏳ Pendentes: ${pendentes}`);
      console.log(`   ❌ Não Processados: ${naoProcessados}`);

      toast.success(`✅ Sincronização concluída!`, {
        description: `${sincronizados} sincronizados, ${pendentes} pendentes, ${naoProcessados} não processados`
      });

    } catch (error) {
      console.error('❌ Erro na sincronização:', error);
      toast.error('Erro ao sincronizar dados');
    } finally {
      setIsLoading(false);
    }
  };

  // Limpar e reiniciar
  const limpar = () => {
    setAihsEncontradas([]);
    setAltasEncontradas([]);
    setResultadoSync(null);
    setEtapa1Concluida(false);
    setEtapa2Concluida(false);
    toast.info('Dados limpos. Pronto para nova sincronização.');
  };

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="bg-gradient-to-r from-purple-600 to-pink-600 rounded-lg p-6 text-white">
        <div className="flex items-center gap-3">
          <GitCompare className="h-8 w-8" />
          <div>
            <h1 className="text-2xl font-bold">Reconciliação AIH × Altas Hospitalares</h1>
            <p className="text-purple-100">Verificação de consistência entre AIHs e Altas usando ID Prontuário</p>
          </div>
        </div>
      </div>

      {/* Instruções */}
      <Alert>
        <Info className="h-4 w-4" />
        <AlertDescription>
          <strong>Como funciona:</strong><br />
          <strong> Etapa 1:</strong> Selecione hospital e competência das AIHs →{' '}
          <strong> Etapa 2:</strong> Selecione hospital e período das Altas →{' '}
          <strong> Etapa 3:</strong> Execute a sincronização
          <br />
          <span className="text-xs text-gray-600 mt-2 block">
            💡 O sistema relaciona AIH com Altas Hospitalares usando o <strong>ID Prontuário</strong> como identificador único
          </span>
        </AlertDescription>
      </Alert>

      {/* ETAPA 1: AIHs */}
      {!resultadoSync && (
        <Card>
          <CardHeader className="bg-blue-50">
            <CardTitle className="flex items-center gap-2">
              <Database className="h-5 w-5 text-blue-600" />
              Etapa 1: AIHs (Sistema Interno)
              {etapa1Concluida && <span className="text-sm font-normal text-green-600">✓ {aihsEncontradas.length} Registros</span>}
            </CardTitle>
            <CardDescription>
              Selecione o hospital e a competência das AIHs
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 pt-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Hospital (Travado) */}
              <div>
                <label className="text-sm font-medium mb-2 block">Hospital</label>
                <Select
                  value={hospitalAIHSelecionado}
                  onValueChange={setHospitalAIHSelecionado}
                  disabled={true}
                >
                  <SelectTrigger className="bg-gray-100">
                    <SelectValue placeholder="Selecione o hospital" />
                  </SelectTrigger>
                  <SelectContent>
                    {hospitaisAIH.map(h => (
                      <SelectItem key={h.id} value={h.id}>{h.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-gray-500 mt-1">🔒 Travado no seu hospital</p>
              </div>

              {/* Competência */}
              <div>
                <label className="text-sm font-medium mb-2 block">Competência</label>
                <Select
                  value={competenciaAIHSelecionada}
                  onValueChange={setCompetenciaAIHSelecionada}
                  disabled={etapa1Concluida}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione a competência" />
                  </SelectTrigger>
                  <SelectContent>
                    {competenciasAIH.map(comp => (
                      <SelectItem key={comp} value={comp}>
                        {comp === 'TODAS' ? '📋 TODAS AS COMPETÊNCIAS' : comp}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Botão */}
              <div className="flex items-end">
                <Button
                  onClick={buscarAIHs}
                  disabled={!hospitalAIHSelecionado || !competenciaAIHSelecionada || isLoading || etapa1Concluida}
                  className="w-full"
                >
                  {isLoading ? (
                    <>
                      <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                      Buscando...
                    </>
                  ) : etapa1Concluida ? (
                    <>
                      <CheckCircle className="h-4 w-4 mr-2" />
                      Concluído
                    </>
                  ) : (
                    <>
                      <Database className="h-4 w-4 mr-2" />
                      Buscar AIHs
                    </>
                  )}
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* ETAPA 2: Altas Hospitalares */}
      {etapa1Concluida && !resultadoSync && (
        <Card>
          <CardHeader className="bg-teal-50">
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5 text-teal-600" />
              Etapa 2: Altas Hospitalares
              {etapa2Concluida && <span className="text-sm font-normal text-green-600">✓ {altasEncontradas.length} Registros</span>}
            </CardTitle>
            <CardDescription>
              Selecione a competência das altas hospitalares
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 pt-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Hospital (Travado) */}
              <div>
                <label className="text-sm font-medium mb-2 block">Hospital</label>
                <Select
                  value={hospitalAltasSelecionado}
                  onValueChange={setHospitalAltasSelecionado}
                  disabled={true}
                >
                  <SelectTrigger className="bg-gray-100">
                    <SelectValue placeholder="Selecione o hospital" />
                  </SelectTrigger>
                  <SelectContent>
                    {hospitaisAltas.map(h => (
                      <SelectItem key={h.id} value={h.id}>{h.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-gray-500 mt-1">🔒 Travado no seu hospital</p>
              </div>

              {/* Competência */}
              <div>
                <label className="text-sm font-medium mb-2 block">Competência</label>
                <Select
                  value={competenciaAltasSelecionada}
                  onValueChange={setCompetenciaAltasSelecionada}
                  disabled={etapa2Concluida}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione a competência" />
                  </SelectTrigger>
                  <SelectContent>
                    {competenciasAltas.map(comp => (
                      <SelectItem key={comp} value={comp}>
                        {comp === 'TODAS' ? '📋 TODAS AS COMPETÊNCIAS' : comp}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Botão */}
              <div className="flex items-end">
                <Button
                  onClick={buscarAltas}
                  disabled={!hospitalAltasSelecionado || !competenciaAltasSelecionada || isLoading || etapa2Concluida}
                  className="w-full"
                >
                  {isLoading ? (
                    <>
                      <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                      Buscando...
                    </>
                  ) : etapa2Concluida ? (
                    <>
                      <CheckCircle className="h-4 w-4 mr-2" />
                      Concluído
                    </>
                  ) : (
                    <>
                      <FileText className="h-4 w-4 mr-2" />
                      Buscar Altas
                    </>
                  )}
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* ETAPA 3: Sincronizar */}
      {etapa1Concluida && etapa2Concluida && !resultadoSync && (
        <Card>
          <CardHeader className="bg-purple-50">
            <CardTitle className="flex items-center gap-2">
              <GitCompare className="h-5 w-5 text-purple-600" />
              Etapa 3: Sincronização e Reconciliação
            </CardTitle>
            <CardDescription>
              Pronto para sincronizar: <strong>{aihsEncontradas.length} AIHs</strong> serão comparadas com <strong>{altasEncontradas.length} altas</strong>
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 pt-6">
            <div className="flex gap-3">
              <Button
                onClick={sincronizar}
                disabled={isLoading}
                className="flex-1"
                size="lg"
              >
                {isLoading ? (
                  <>
                    <RefreshCw className="h-5 w-5 mr-2 animate-spin" />
                    Sincronizando...
                  </>
                ) : (
                  <>
                    <GitCompare className="h-5 w-5 mr-2" />
                    Executar Sincronização
                  </>
                )}
              </Button>
              <Button
                onClick={limpar}
                variant="outline"
                disabled={isLoading}
              >
                <XCircle className="h-4 w-4 mr-2" />
                Limpar
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* RESULTADOS */}
      {resultadoSync && (
        <div className="space-y-6">
          {/* Cards de Estatísticas */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <CheckCircle className="h-4 w-4 text-green-600" />
                  Sincronizados
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-3xl font-bold text-green-600">{resultadoSync.sincronizados}</p>
                <p className="text-xs text-gray-500 mt-1">Presentes em ambas as bases</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 text-yellow-600" />
                  Pendentes
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-3xl font-bold text-yellow-600">{resultadoSync.pendentes}</p>
                <p className="text-xs text-gray-500 mt-1">Com AIH mas sem alta registrada</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <XCircle className="h-4 w-4 text-red-600" />
                  Não Processados
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-3xl font-bold text-red-600">{resultadoSync.naoProcessados}</p>
                <p className="text-xs text-gray-500 mt-1">Com alta mas sem AIH no sistema</p>
              </CardContent>
            </Card>
          </div>

          {/* Tabela de Detalhes */}
          <Card>
            <CardHeader>
              <CardTitle>Detalhamento da Reconciliação</CardTitle>
              <CardDescription>
                {resultadoSync.detalhes.length} registros encontrados
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Status</TableHead>
                      <TableHead>ID Prontuário</TableHead>
                      <TableHead>Paciente (AIH)</TableHead>
                      <TableHead>Paciente (Alta)</TableHead>
                      <TableHead>Nº AIH</TableHead>
                      <TableHead>Data Saída Alta</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {resultadoSync.detalhes.slice(0, 50).map((detalhe, idx) => (
                      <TableRow key={idx}>
                        <TableCell>
                          {detalhe.status === 'sincronizado' && (
                            <Badge className="bg-green-100 text-green-800 border-green-200">
                              <CheckCircle className="h-3 w-3 mr-1" />
                              Sincronizado
                            </Badge>
                          )}
                          {detalhe.status === 'pendente' && (
                            <Badge className="bg-yellow-100 text-yellow-800 border-yellow-200">
                              <AlertTriangle className="h-3 w-3 mr-1" />
                              Pendente
                            </Badge>
                          )}
                          {detalhe.status === 'nao_processado' && (
                            <Badge className="bg-red-100 text-red-800 border-red-200">
                              <XCircle className="h-3 w-3 mr-1" />
                              Não Processado
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell className="font-mono text-sm">{detalhe.prontuario}</TableCell>
                        <TableCell>{detalhe.aih?.patients?.name || '-'}</TableCell>
                        <TableCell>{detalhe.alta?.paciente || '-'}</TableCell>
                        <TableCell className="font-mono text-sm">{detalhe.aih?.aih_number || '-'}</TableCell>
                        <TableCell className="text-sm">
                          {detalhe.alta?.data_saida ? new Date(detalhe.alta.data_saida).toLocaleDateString('pt-BR') : '-'}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
              {resultadoSync.detalhes.length > 50 && (
                <p className="text-sm text-gray-500 mt-4 text-center">
                  Mostrando 50 de {resultadoSync.detalhes.length} registros
                </p>
              )}
            </CardContent>
          </Card>

          {/* Botão Limpar */}
          <div className="flex justify-end">
            <Button onClick={limpar} variant="outline">
              <RefreshCw className="h-4 w-4 mr-2" />
              Nova Sincronização
            </Button>
          </div>
        </div>
      )}
    </div>
  );
};

export default SyncAltasPage;


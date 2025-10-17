import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Alert, AlertDescription } from './ui/alert';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from './ui/table';
import { GitCompare, Database, RefreshCw, Info } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { toast } from 'sonner';

const SyncPage = () => {
  const { getCurrentHospital, canAccessAllHospitals } = useAuth();
  const userHospitalId = getCurrentHospital();

  // Estados para filtros AIH Avançado (Etapa 1)
  const [hospitaisAIHAvancado, setHospitaisAIHAvancado] = useState<Array<{id: string, name: string}>>([]);
  const [competenciasAIHAvancado, setCompetenciasAIHAvancado] = useState<string[]>([]);
  const [hospitalAIHSelecionado, setHospitalAIHSelecionado] = useState<string>('');
  const [competenciaAIHSelecionada, setCompetenciaAIHSelecionada] = useState<string>('');
  const [aihsEncontradas, setAihsEncontradas] = useState<any[]>([]);
  const [etapa1Concluida, setEtapa1Concluida] = useState(false);
  
  // Estados para filtros SISAIH01 (Etapa 2)
  const [hospitaisSISAIH01, setHospitaisSISAIH01] = useState<Array<{id: string, name: string}>>([]);
  const [competenciasSISAIH01, setCompetenciasSISAIH01] = useState<string[]>([]);
  const [hospitalSISAIH01Selecionado, setHospitalSISAIH01Selecionado] = useState<string>('');
  const [competenciaSISAIH01Selecionada, setCompetenciaSISAIH01Selecionada] = useState<string>('');
  const [sisaih01Encontrados, setSisaih01Encontrados] = useState<any[]>([]);
  const [etapa2Concluida, setEtapa2Concluida] = useState(false);
  
  // Estados para sincronização (Etapa 3)
  const [resultadoSync, setResultadoSync] = useState<{
    sincronizados: number;
    pendentes: number;
    naoProcessados: number;
    detalhes: Array<{
      numero_aih: string;
      status: 'sincronizado' | 'pendente' | 'nao_processado';
      aih_avancado?: any;
      sisaih01?: any;
    }>;
  } | null>(null);
  
  const [isLoading, setIsLoading] = useState(false);

  // 🆕 Carregar opções ao montar o componente
  useEffect(() => {
    carregarOpcoes();
  }, []);

  // Função para carregar hospitais e competências da tabela aihs
  const carregarOpcoes = async () => {
    try {
      console.log('📋 Carregando hospitais e competências da tabela aihs...');

      // 1. Buscar hospitais
      const { data: hospitais, error: errorHospitais } = await supabase
        .from('hospitals')
        .select('id, name')
        .order('name');

      if (!errorHospitais && hospitais) {
        setHospitaisAIHAvancado(hospitais);
        console.log(`✅ ${hospitais.length} hospitais carregados`);

        // Se não for admin, pré-selecionar o hospital do usuário
        if (!canAccessAllHospitals() && userHospitalId && userHospitalId !== 'ALL') {
          setHospitalAIHSelecionado(userHospitalId);
          setHospitalSISAIH01Selecionado(userHospitalId);
          console.log(`🏥 Hospital pré-selecionado (modo operador): ${userHospitalId}`);
        } else if (canAccessAllHospitals()) {
          console.log(`🔓 Modo administrador: selecione manualmente o hospital`);
        }
        
        // Configurar também para SISAIH01
        setHospitaisSISAIH01(hospitais);
      }

      // 2. Buscar todas as competências da tabela aihs
      const { data: aihsData, error: errorAihs } = await supabase
        .from('aihs')
        .select('competencia');

      if (!errorAihs && aihsData) {
        console.log(`📊 Total de registros na tabela aihs: ${aihsData.length}`);

        // Normalizar competências (converter YYYY-MM-DD para AAAAMM)
        const competenciasNormalizadas = aihsData
          .map(r => {
            if (!r.competencia) return null;
            
            let comp = r.competencia;
            
            // Se for formato de data (YYYY-MM-DD), converter para AAAAMM
            if (comp.includes('-') && comp.length === 10) {
              return comp.substring(0, 7).replace('-', ''); // "2025-10-01" -> "202510"
            }
            
            return comp;
          })
          .filter(comp => comp && comp.length === 6);

        const competenciasUnicas = [...new Set(competenciasNormalizadas)].sort((a, b) => b.localeCompare(a));
        
        setCompetenciasAIHAvancado(competenciasUnicas);
        console.log(`✅ ${competenciasUnicas.length} competências únicas encontradas (AIH Avançado):`, competenciasUnicas);

        // Pré-selecionar a primeira competência
        if (competenciasUnicas.length > 0) {
          setCompetenciaAIHSelecionada(competenciasUnicas[0]);
          console.log(`📅 Competência pré-selecionada (AIH Avançado): ${competenciasUnicas[0]}`);
        }
      }
      
      // 3. Buscar competências da tabela aih_registros
      const { data: sisaih01Data, error: errorSISAIH01 } = await supabase
        .from('aih_registros')
        .select('competencia');

      if (!errorSISAIH01 && sisaih01Data) {
        console.log(`📊 Total de registros na tabela aih_registros: ${sisaih01Data.length}`);

        // Normalizar competências
        const competenciasNormalizadas = sisaih01Data
          .map(r => {
            if (!r.competencia) return null;
            
            let comp = r.competencia;
            
            // Se for formato de data (YYYY-MM-DD), converter para AAAAMM
            if (comp.includes('-') && comp.length === 10) {
              return comp.substring(0, 7).replace('-', '');
            }
            
            // Se for formato MM/YYYY, converter para AAAAMM
            if (comp.includes('/') && comp.length === 7) {
              const [mes, ano] = comp.split('/');
              return `${ano}${mes}`;
            }
            
            return comp;
          })
          .filter(comp => comp && comp.length === 6);

        const competenciasUnicas = [...new Set(competenciasNormalizadas)].sort((a, b) => b.localeCompare(a));
        
        setCompetenciasSISAIH01(competenciasUnicas);
        console.log(`✅ ${competenciasUnicas.length} competências únicas encontradas (SISAIH01):`, competenciasUnicas);

        // Pré-selecionar a primeira competência
        if (competenciasUnicas.length > 0) {
          setCompetenciaSISAIH01Selecionada(competenciasUnicas[0]);
          console.log(`📅 Competência pré-selecionada (SISAIH01): ${competenciasUnicas[0]}`);
        }
      }

      console.log('✅ Opções carregadas com sucesso!');
    } catch (error) {
      console.error('❌ Erro ao carregar opções:', error);
      toast.error('Erro ao carregar dados');
    }
  };

  // Função para formatar competência (202510 -> 10/2025)
  const formatarCompetencia = (comp: string) => {
    if (!comp || comp.length !== 6) return comp;
    return `${comp.substring(4, 6)}/${comp.substring(0, 4)}`;
  };

  // Função para normalizar número AIH (remover todos os não-dígitos)
  const normalizarNumeroAIH = (numero: string): string => {
    if (!numero) return '';
    return numero.replace(/\D/g, '');
  };

  // ETAPA 1: Buscar AIHs do AIH Avançado
  const buscarAIHs = async () => {
    if (!hospitalAIHSelecionado || !competenciaAIHSelecionada) {
      toast.error('Selecione hospital e competência');
      return;
    }

    setIsLoading(true);
    
    try {
      console.log('🔍 ETAPA 1 - Buscando AIHs do AIH Avançado...');
      console.log(`🏥 Hospital: ${hospitalAIHSelecionado}`);
      console.log(`📅 Competência: ${competenciaAIHSelecionada}`);

      // Buscar AIHs da tabela
      const { data: aihsData, error } = await supabase
        .from('aihs')
        .select('aih_number, patient_id, admission_date, competencia, created_at')
        .eq('hospital_id', hospitalAIHSelecionado);

      if (error) {
        console.error('❌ Erro ao buscar AIHs:', error);
        toast.error('Erro ao buscar AIHs');
        return;
      }

      console.log(`📊 Total de AIHs do hospital: ${aihsData?.length || 0}`);

      // Filtrar por competência no cliente (suporta ambos os formatos)
      const aihsFiltradas = (aihsData || []).filter(aih => {
        if (!aih.competencia) return false;
        
        let compAih = aih.competencia;
        
        // Converter data para AAAAMM se necessário
        if (compAih.includes('-') && compAih.length === 10) {
          compAih = compAih.substring(0, 7).replace('-', '');
        }
        
        return compAih === competenciaAIHSelecionada;
      });

      console.log(`✅ ${aihsFiltradas.length} AIHs encontradas com competência ${competenciaAIHSelecionada}`);
      
      // Log de exemplos
      if (aihsFiltradas.length > 0) {
        const exemplos = aihsFiltradas.slice(0, 5).map(a => a.aih_number);
        console.log('📋 Exemplos de AIH numbers:', exemplos);
      }

      setAihsEncontradas(aihsFiltradas);
      setEtapa1Concluida(true);

      toast.success(`✅ Etapa 1 concluída: ${aihsFiltradas.length} AIHs encontradas!`, {
        description: `Agora selecione os dados do SISAIH01 na Etapa 2`
      });

    } catch (error) {
      console.error('❌ Erro:', error);
      toast.error('Erro ao processar busca');
    } finally {
      setIsLoading(false);
    }
  };

  // ETAPA 2: Buscar registros do SISAIH01
  const buscarSISAIH01 = async () => {
    if (!hospitalSISAIH01Selecionado || !competenciaSISAIH01Selecionada) {
      toast.error('Selecione hospital e competência do SISAIH01');
      return;
    }

    setIsLoading(true);
    
    try {
      console.log('🔍 ETAPA 2 - Buscando registros do SISAIH01...');
      console.log(`🏥 Hospital: ${hospitalSISAIH01Selecionado}`);
      console.log(`📅 Competência: ${competenciaSISAIH01Selecionada}`);

      // Buscar registros da tabela aih_registros
      const { data: sisaih01Data, error } = await supabase
        .from('aih_registros')
        .select('numero_aih, nome_paciente, data_internacao, competencia, hospital_id, created_at')
        .eq('hospital_id', hospitalSISAIH01Selecionado);

      if (error) {
        console.error('❌ Erro ao buscar SISAIH01:', error);
        toast.error('Erro ao buscar SISAIH01');
        return;
      }

      console.log(`📊 Total de registros SISAIH01 do hospital: ${sisaih01Data?.length || 0}`);

      // Filtrar por competência no cliente
      const sisaih01Filtrados = (sisaih01Data || []).filter(aih => {
        if (!aih.competencia) return false;
        
        let compAih = aih.competencia;
        
        // Converter data para AAAAMM se necessário
        if (compAih.includes('-') && compAih.length === 10) {
          compAih = compAih.substring(0, 7).replace('-', '');
        }
        
        // Converter MM/YYYY para AAAAMM
        if (compAih.includes('/') && compAih.length === 7) {
          const [mes, ano] = compAih.split('/');
          compAih = `${ano}${mes}`;
        }
        
        return compAih === competenciaSISAIH01Selecionada;
      });

      console.log(`✅ ${sisaih01Filtrados.length} registros SISAIH01 encontrados com competência ${competenciaSISAIH01Selecionada}`);
      
      // Log de exemplos
      if (sisaih01Filtrados.length > 0) {
        const exemplos = sisaih01Filtrados.slice(0, 5).map(a => a.numero_aih);
        console.log('📋 Exemplos de numero_aih:', exemplos);
      }

      setSisaih01Encontrados(sisaih01Filtrados);
      setEtapa2Concluida(true);

      toast.success(`✅ Etapa 2 concluída: ${sisaih01Filtrados.length} registros SISAIH01 encontrados!`, {
        description: `Pronto para fazer o match entre as bases`
      });

    } catch (error) {
      console.error('❌ Erro:', error);
      toast.error('Erro ao processar busca');
    } finally {
      setIsLoading(false);
    }
  };

  // ETAPA 3: Executar Sincronização (Match)
  const executarSincronizacao = async () => {
    setIsLoading(true);
    
    try {
      console.log('🔄 ETAPA 3 - Executando sincronização...');
      console.log(`📊 AIH Avançado: ${aihsEncontradas.length} registros`);
      console.log(`📊 SISAIH01: ${sisaih01Encontrados.length} registros`);

      // Criar mapas normalizados para match
      const mapAIHAvancado = new Map<string, any>();
      let aihsInvalidas = 0;

      aihsEncontradas.forEach(aih => {
        if (aih.aih_number) {
          const numeroNormalizado = normalizarNumeroAIH(aih.aih_number);
          
          // Só adicionar se tiver pelo menos 10 dígitos
          if (numeroNormalizado.length >= 10) {
            mapAIHAvancado.set(numeroNormalizado, aih);
          } else {
            aihsInvalidas++;
          }
        }
      });

      if (aihsInvalidas > 0) {
        console.warn(`⚠️ ${aihsInvalidas} AIHs inválidas ignoradas (menos de 10 dígitos)`);
      }

      console.log(`📋 Mapa AIH Avançado: ${mapAIHAvancado.size} registros válidos`);
      
      // Exemplos de normalização
      if (mapAIHAvancado.size > 0) {
        const exemplos = Array.from(mapAIHAvancado.keys()).slice(0, 3);
        console.log('   Exemplos normalizados:', exemplos);
      }

      const mapSISAIH01 = new Map<string, any>();
      let sisaih01Invalidos = 0;

      sisaih01Encontrados.forEach(aih => {
        if (aih.numero_aih) {
          const numeroNormalizado = normalizarNumeroAIH(aih.numero_aih);
          
          // Só adicionar se tiver pelo menos 10 dígitos
          if (numeroNormalizado.length >= 10) {
            mapSISAIH01.set(numeroNormalizado, aih);
          } else {
            sisaih01Invalidos++;
          }
        }
      });

      if (sisaih01Invalidos > 0) {
        console.warn(`⚠️ ${sisaih01Invalidos} registros SISAIH01 inválidos ignorados (menos de 10 dígitos)`);
      }

      console.log(`📋 Mapa SISAIH01: ${mapSISAIH01.size} registros válidos`);
      
      // Exemplos de normalização
      if (mapSISAIH01.size > 0) {
        const exemplos = Array.from(mapSISAIH01.keys()).slice(0, 3);
        console.log('   Exemplos normalizados:', exemplos);
      }

      // Obter todos os números únicos
      const numerosUnicos = new Set([
        ...Array.from(mapAIHAvancado.keys()),
        ...Array.from(mapSISAIH01.keys())
      ]);

      console.log(`🔍 Total de números AIH únicos para comparar: ${numerosUnicos.size}`);

      // Realizar comparação
      let sincronizados = 0;
      let pendentes = 0;
      let naoProcessados = 0;
      const detalhes: Array<any> = [];

      numerosUnicos.forEach(numeroNormalizado => {
        const aihAvancado = mapAIHAvancado.get(numeroNormalizado);
        const sisaih01 = mapSISAIH01.get(numeroNormalizado);

        let status: 'sincronizado' | 'pendente' | 'nao_processado';

        if (aihAvancado && sisaih01) {
          // Existe em ambas as bases
          status = 'sincronizado';
          sincronizados++;
        } else if (aihAvancado && !sisaih01) {
          // Existe apenas no AIH Avançado (aguardando confirmação SUS)
          status = 'pendente';
          pendentes++;
        } else {
          // Existe apenas no SISAIH01 (não foi processado no sistema)
          status = 'nao_processado';
          naoProcessados++;
        }

        detalhes.push({
          numero_aih: numeroNormalizado,
          status,
          aih_avancado: aihAvancado,
          sisaih01: sisaih01
        });
      });

      console.log('\n📊 RESULTADO DA SINCRONIZAÇÃO:');
      console.log(`   ✅ Sincronizados: ${sincronizados}`);
      console.log(`   ⏳ Pendentes Confirmação: ${pendentes}`);
      console.log(`   ❌ Não Processados: ${naoProcessados}`);
      console.log(`   📈 Taxa de Sincronização: ${mapSISAIH01.size > 0 ? ((sincronizados / mapSISAIH01.size) * 100).toFixed(2) : 0}%`);

      setResultadoSync({
        sincronizados,
        pendentes,
        naoProcessados,
        detalhes
      });

      toast.success('✅ Sincronização concluída!', {
        description: `${sincronizados} sincronizados | ${pendentes} pendentes | ${naoProcessados} não processados`
      });

    } catch (error) {
      console.error('❌ Erro ao executar sincronização:', error);
      toast.error('Erro ao executar sincronização');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="container mx-auto py-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <GitCompare className="h-8 w-8 text-purple-600" />
            Sync - Sincronização de AIHs
          </h1>
          <p className="text-muted-foreground mt-1">
            Reconciliação entre AIH Avançado e SISAIH01 (Confirmados SUS)
          </p>
        </div>
        <Button onClick={carregarOpcoes} variant="outline" size="sm">
          <RefreshCw className="h-4 w-4 mr-2" />
          Atualizar
        </Button>
      </div>

      {/* Informação sobre o fluxo */}
      <Alert>
        <Info className="h-4 w-4" />
        <AlertDescription>
          <strong>Etapa 1:</strong> Selecione hospital e competência do AIH Avançado → 
          <strong> Etapa 2:</strong> Selecione hospital e competência do SISAIH01 → 
          <strong> Etapa 3:</strong> Executar sincronização
        </AlertDescription>
      </Alert>

      {/* ETAPA 1: AIH Avançado */}
      <Card className={`border-2 ${etapa1Concluida ? 'border-green-300 bg-green-50/30' : 'border-blue-200'}`}>
        <CardHeader className={`${etapa1Concluida ? 'bg-gradient-to-r from-green-50 to-emerald-50' : 'bg-gradient-to-r from-blue-50 to-indigo-50'}`}>
          <CardTitle className={`flex items-center gap-2 ${etapa1Concluida ? 'text-green-900' : 'text-blue-900'}`}>
            <Database className="h-5 w-5" />
            Etapa 1: AIH Avançado (Processamento Interno)
            {etapa1Concluida && <span className="text-sm font-normal text-green-600">✓ {aihsEncontradas.length} AIHs</span>}
          </CardTitle>
          <CardDescription>
            Selecione o hospital e a competência para buscar as AIHs processadas
          </CardDescription>
        </CardHeader>
        <CardContent className="pt-6 space-y-4">
          {/* Hospital */}
          <div className="space-y-2">
            <label className="text-sm font-semibold text-gray-700">
              Hospital:
            </label>
            <select
              value={hospitalAIHSelecionado}
              onChange={(e) => setHospitalAIHSelecionado(e.target.value)}
              disabled={!canAccessAllHospitals() || etapa1Concluida}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-100 disabled:cursor-not-allowed"
            >
              <option value="">
                {canAccessAllHospitals() ? 'Selecione o hospital...' : 'Carregando...'}
              </option>
              {hospitaisAIHAvancado.map(h => (
                <option key={h.id} value={h.id}>
                  {h.name}
                </option>
              ))}
            </select>
            {!canAccessAllHospitals() ? (
              <p className="text-xs text-blue-600">
                🔒 Hospital fixo: seu hospital vinculado
              </p>
            ) : (
              <p className="text-xs text-green-600">
                🔓 Modo Administrador: você pode selecionar qualquer hospital
              </p>
            )}
          </div>

          {/* Competência */}
          <div className="space-y-2">
            <label className="text-sm font-semibold text-gray-700">
              Competência:
            </label>
            <select
              value={competenciaAIHSelecionada}
              onChange={(e) => setCompetenciaAIHSelecionada(e.target.value)}
              disabled={etapa1Concluida}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-100 disabled:cursor-not-allowed"
            >
              <option value="">Selecione a competência...</option>
              {competenciasAIHAvancado.map(comp => (
                <option key={comp} value={comp}>
                  {formatarCompetencia(comp)}
                </option>
              ))}
            </select>
          </div>

          {/* Botão de Busca */}
          <div className="pt-4 flex gap-3">
            <Button
              onClick={buscarAIHs}
              disabled={!hospitalAIHSelecionado || !competenciaAIHSelecionada || isLoading || etapa1Concluida}
              className={`flex-1 ${etapa1Concluida ? 'bg-green-600 hover:bg-green-700' : 'bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700'}`}
              size="lg"
            >
              {etapa1Concluida ? (
                <>✓ Etapa 1 Concluída</>
              ) : isLoading ? (
                <>
                  <RefreshCw className="h-5 w-5 mr-2 animate-spin" />
                  Buscando...
                </>
              ) : (
                <>
                  <Database className="h-5 w-5 mr-2" />
                  Buscar AIHs
                </>
              )}
            </Button>
            {etapa1Concluida && (
              <Button
                onClick={() => {
                  setEtapa1Concluida(false);
                  setAihsEncontradas([]);
                  setEtapa2Concluida(false);
                  setSisaih01Encontrados([]);
                }}
                variant="outline"
                size="lg"
              >
                Refazer
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* ETAPA 2: SISAIH01 */}
      <Card className={`border-2 ${!etapa1Concluida ? 'opacity-50 cursor-not-allowed' : etapa2Concluida ? 'border-green-300 bg-green-50/30' : 'border-purple-200'}`}>
        <CardHeader className={`${etapa2Concluida ? 'bg-gradient-to-r from-green-50 to-emerald-50' : 'bg-gradient-to-r from-purple-50 to-pink-50'}`}>
          <CardTitle className={`flex items-center gap-2 ${etapa2Concluida ? 'text-green-900' : 'text-purple-900'}`}>
            <Database className="h-5 w-5" />
            Etapa 2: SISAIH01 (Confirmados SUS)
            {etapa2Concluida && <span className="text-sm font-normal text-green-600">✓ {sisaih01Encontrados.length} Registros</span>}
          </CardTitle>
          <CardDescription>
            {!etapa1Concluida ? (
              'Complete a Etapa 1 primeiro para habilitar esta seção'
            ) : (
              'Selecione o hospital e a competência dos registros confirmados pelo SUS'
            )}
          </CardDescription>
        </CardHeader>
        <CardContent className="pt-6 space-y-4">
          {/* Hospital */}
          <div className="space-y-2">
            <label className="text-sm font-semibold text-gray-700">
              Hospital:
            </label>
            <select
              value={hospitalSISAIH01Selecionado}
              onChange={(e) => setHospitalSISAIH01Selecionado(e.target.value)}
              disabled={!etapa1Concluida || (!canAccessAllHospitals()) || etapa2Concluida}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500 disabled:bg-gray-100 disabled:cursor-not-allowed"
            >
              <option value="">
                {canAccessAllHospitals() ? 'Selecione o hospital...' : 'Carregando...'}
              </option>
              {hospitaisSISAIH01.map(h => (
                <option key={h.id} value={h.id}>
                  {h.name}
                </option>
              ))}
            </select>
            {!canAccessAllHospitals() ? (
              <p className="text-xs text-purple-600">
                🔒 Hospital fixo: seu hospital vinculado
              </p>
            ) : (
              <p className="text-xs text-green-600">
                🔓 Modo Administrador: você pode selecionar qualquer hospital
              </p>
            )}
          </div>

          {/* Competência */}
          <div className="space-y-2">
            <label className="text-sm font-semibold text-gray-700">
              Competência:
            </label>
            <select
              value={competenciaSISAIH01Selecionada}
              onChange={(e) => setCompetenciaSISAIH01Selecionada(e.target.value)}
              disabled={!etapa1Concluida || etapa2Concluida}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500 disabled:bg-gray-100 disabled:cursor-not-allowed"
            >
              <option value="">Selecione a competência...</option>
              {competenciasSISAIH01.map(comp => (
                <option key={comp} value={comp}>
                  {formatarCompetencia(comp)}
                </option>
              ))}
            </select>
          </div>

          {/* Botão de Busca */}
          <div className="pt-4 flex gap-3">
            <Button
              onClick={buscarSISAIH01}
              disabled={!etapa1Concluida || !hospitalSISAIH01Selecionado || !competenciaSISAIH01Selecionada || isLoading || etapa2Concluida}
              className={`flex-1 ${etapa2Concluida ? 'bg-green-600 hover:bg-green-700' : 'bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700'}`}
              size="lg"
            >
              {etapa2Concluida ? (
                <>✓ Etapa 2 Concluída</>
              ) : isLoading ? (
                <>
                  <RefreshCw className="h-5 w-5 mr-2 animate-spin" />
                  Buscando...
                </>
              ) : (
                <>
                  <Database className="h-5 w-5 mr-2" />
                  Buscar SISAIH01
                </>
              )}
            </Button>
            {etapa2Concluida && (
              <Button
                onClick={() => {
                  setEtapa2Concluida(false);
                  setSisaih01Encontrados([]);
                }}
                variant="outline"
                size="lg"
              >
                Refazer
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* ETAPA 3: Executar Sincronização */}
      {etapa2Concluida && !resultadoSync && (
        <Card className="border-2 border-gradient-to-r from-purple-300 to-pink-300 bg-gradient-to-r from-purple-50 to-pink-50">
          <CardContent className="pt-6">
            <div className="text-center space-y-4">
              <div>
                <h3 className="text-2xl font-bold text-purple-900 mb-2">
                  🎯 Pronto para Sincronizar!
                </h3>
                <p className="text-gray-600">
                  <strong>{aihsEncontradas.length} AIHs</strong> do AIH Avançado serão comparadas com <strong>{sisaih01Encontrados.length} registros</strong> do SISAIH01
                </p>
              </div>
              
              <Button
                onClick={executarSincronizacao}
                disabled={isLoading}
                size="lg"
                className="bg-gradient-to-r from-purple-600 via-pink-600 to-indigo-600 hover:from-purple-700 hover:via-pink-700 hover:to-indigo-700 text-white font-bold py-6 px-12 text-lg shadow-xl hover:shadow-2xl transition-all"
              >
                {isLoading ? (
                  <>
                    <RefreshCw className="h-6 w-6 mr-3 animate-spin" />
                    Processando Sincronização...
                  </>
                ) : (
                  <>
                    <GitCompare className="h-6 w-6 mr-3" />
                    Executar Sincronização
                  </>
                )}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Resultado da Sincronização */}
      {resultadoSync && (
        <div className="space-y-6">
          {/* KPIs */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {/* Total AIH Avançado */}
            <Card className="border-2 border-blue-200">
              <CardContent className="pt-6">
                <div className="text-center">
                  <Database className="h-8 w-8 mx-auto mb-2 text-blue-600" />
                  <p className="text-sm text-gray-600 mb-1">AIH Avançado</p>
                  <p className="text-3xl font-bold text-blue-900">{aihsEncontradas.length}</p>
                </div>
              </CardContent>
            </Card>

            {/* Sincronizados */}
            <Card className="border-2 border-green-200 bg-green-50">
              <CardContent className="pt-6">
                <div className="text-center">
                  <div className="text-4xl mb-2">✅</div>
                  <p className="text-sm text-gray-600 mb-1">Sincronizados</p>
                  <p className="text-3xl font-bold text-green-900">{resultadoSync.sincronizados}</p>
                  <p className="text-xs text-gray-500 mt-1">
                    {sisaih01Encontrados.length > 0 
                      ? `${((resultadoSync.sincronizados / sisaih01Encontrados.length) * 100).toFixed(1)}%`
                      : '0%'}
                  </p>
                </div>
              </CardContent>
            </Card>

            {/* Pendentes */}
            <Card className="border-2 border-orange-200 bg-orange-50">
              <CardContent className="pt-6">
                <div className="text-center">
                  <div className="text-4xl mb-2">⏳</div>
                  <p className="text-sm text-gray-600 mb-1">Pendentes SUS</p>
                  <p className="text-3xl font-bold text-orange-900">{resultadoSync.pendentes}</p>
                  <p className="text-xs text-gray-500 mt-1">Aguardando confirmação</p>
                </div>
              </CardContent>
            </Card>

            {/* Não Processados */}
            <Card className="border-2 border-red-200 bg-red-50">
              <CardContent className="pt-6">
                <div className="text-center">
                  <div className="text-4xl mb-2">❌</div>
                  <p className="text-sm text-gray-600 mb-1">Não Processados</p>
                  <p className="text-3xl font-bold text-red-900">{resultadoSync.naoProcessados}</p>
                  <p className="text-xs text-gray-500 mt-1">Faltam no sistema</p>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Resumo */}
          <Alert className="bg-gradient-to-r from-green-50 to-emerald-50 border-green-300">
            <Info className="h-4 w-4 text-green-600" />
            <AlertDescription className="text-green-900">
              <strong>✓ Sincronização Concluída!</strong>
              <br />
              <span className="text-sm">
                De <strong>{sisaih01Encontrados.length} registros confirmados pelo SUS</strong>, 
                <strong> {resultadoSync.sincronizados} foram encontrados</strong> no AIH Avançado ({sisaih01Encontrados.length > 0 ? ((resultadoSync.sincronizados / sisaih01Encontrados.length) * 100).toFixed(1) : 0}% de sincronização).
                {resultadoSync.pendentes > 0 && (
                  <> Existem <strong>{resultadoSync.pendentes} AIHs pendentes</strong> de confirmação pelo SUS.</>
                )}
              </span>
            </AlertDescription>
          </Alert>

          {/* Tabela de AIHs Sincronizadas */}
          {resultadoSync.sincronizados > 0 && (
            <Card className="border-2 border-green-200">
              <CardHeader className="bg-gradient-to-r from-green-50 to-emerald-50">
                <CardTitle className="flex items-center gap-2 text-green-900">
                  ✅ AIHs Sincronizadas
                  <span className="text-sm font-normal text-green-600">
                    ({resultadoSync.sincronizados} registros)
                  </span>
                </CardTitle>
                <CardDescription>
                  Números das AIHs que foram encontradas em ambas as bases (AIH Avançado e SISAIH01)
                </CardDescription>
              </CardHeader>
              <CardContent className="pt-6">
                <div className="rounded-lg border border-green-200 overflow-hidden">
                  <div className="max-h-[500px] overflow-y-auto">
                    <Table>
                      <TableHeader className="bg-green-50 sticky top-0">
                        <TableRow>
                          <TableHead className="font-semibold text-green-900 w-20">#</TableHead>
                          <TableHead className="font-semibold text-green-900">Número AIH</TableHead>
                          <TableHead className="font-semibold text-green-900">Paciente (SISAIH01)</TableHead>
                          <TableHead className="font-semibold text-green-900">Data Internação</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {resultadoSync.detalhes
                          .filter(d => d.status === 'sincronizado')
                          .map((detalhe, index) => (
                            <TableRow key={detalhe.numero_aih} className="hover:bg-green-50/50">
                              <TableCell className="text-gray-600 font-medium">
                                {index + 1}
                              </TableCell>
                              <TableCell>
                                <span className="font-mono text-blue-600 font-medium">
                                  {detalhe.numero_aih}
                                </span>
                              </TableCell>
                              <TableCell className="text-gray-700">
                                {detalhe.sisaih01?.nome_paciente || '-'}
                              </TableCell>
                              <TableCell className="text-gray-600">
                                {detalhe.sisaih01?.data_internacao 
                                  ? new Date(detalhe.sisaih01.data_internacao).toLocaleDateString('pt-BR')
                                  : '-'}
                              </TableCell>
                            </TableRow>
                          ))}
                      </TableBody>
                    </Table>
                  </div>
                </div>
                
                {resultadoSync.sincronizados > 10 && (
                  <p className="text-sm text-gray-500 mt-3 text-center">
                    Mostrando {resultadoSync.sincronizados} registros sincronizados
                  </p>
                )}
              </CardContent>
            </Card>
          )}

          {/* Mensagem se não houver sincronizados */}
          {resultadoSync.sincronizados === 0 && (
            <Alert className="bg-yellow-50 border-yellow-300">
              <Info className="h-4 w-4 text-yellow-600" />
              <AlertDescription className="text-yellow-900">
                <strong>⚠️ Nenhuma AIH sincronizada encontrada</strong>
                <br />
                <span className="text-sm">
                  Não foram encontradas AIHs que existam em ambas as bases. 
                  {resultadoSync.pendentes > 0 && (
                    <> Todas as {resultadoSync.pendentes} AIHs do AIH Avançado estão pendentes de confirmação pelo SUS.</>
                  )}
                </span>
              </AlertDescription>
            </Alert>
          )}

          {/* Botão para refazer */}
          <div className="flex justify-center">
            <Button
              onClick={() => {
                setResultadoSync(null);
                setEtapa1Concluida(false);
                setEtapa2Concluida(false);
                setAihsEncontradas([]);
                setSisaih01Encontrados([]);
                carregarOpcoes();
              }}
              variant="outline"
              size="lg"
            >
              <RefreshCw className="h-5 w-5 mr-2" />
              Nova Sincronização
            </Button>
          </div>
        </div>
      )}
    </div>
  );
};

export default SyncPage;

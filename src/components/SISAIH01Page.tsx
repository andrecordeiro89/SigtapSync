import React, { useState, useRef } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Textarea } from './ui/textarea';
import { Badge } from './ui/badge';
import { Alert, AlertDescription } from './ui/alert';
import {
  FileText,
  Upload,
  Users,
  User,
  FileSpreadsheet,
  Download,
  Save,
  Search,
  RefreshCw,
  CheckCircle,
  AlertCircle,
  Info,
  MapPin,
  Calendar,
  Hospital,
  Stethoscope
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { toast } from 'sonner';
import {
  processarArquivoSISAIH01,
  gerarEstatisticas,
  baixarCSV,
  type RegistroSISAIH01,
  type EstatisticasSISAIH01
} from '../utils/sisaih01Parser';

const SISAIH01Page = () => {
  const [registros, setRegistros] = useState<RegistroSISAIH01[]>([]);
  const [registrosFiltrados, setRegistrosFiltrados] = useState<RegistroSISAIH01[]>([]);
  const [estatisticas, setEstatisticas] = useState<EstatisticasSISAIH01 | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [showSaveConfirmation, setShowSaveConfirmation] = useState(false);
  const [savedCount, setSavedCount] = useState(0);
  const [buscaTexto, setBuscaTexto] = useState('');
  const [paginaAtual, setPaginaAtual] = useState(1);
  const [conteudoManual, setConteudoManual] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const registrosPorPagina = 20;

  // Processar arquivo ou conteúdo
  const processarConteudo = async (conteudo: string) => {
    setIsProcessing(true);
    try {
      // Processar com o parser
      const registrosProcessados = processarArquivoSISAIH01(conteudo);
      
      if (registrosProcessados.length === 0) {
        toast.error('Nenhum registro válido encontrado no arquivo');
        return;
      }

      setRegistros(registrosProcessados);
      setRegistrosFiltrados(registrosProcessados);
      
      // Gerar estatísticas
      const stats = gerarEstatisticas(registrosProcessados);
      setEstatisticas(stats);
      
      setPaginaAtual(1);
      
      toast.success(`✅ ${registrosProcessados.length} registros processados com sucesso!`, {
        description: `${stats.pacientes_unicos} pacientes únicos identificados`
      });
    } catch (error) {
      console.error('Erro ao processar arquivo:', error);
      toast.error('Erro ao processar arquivo', {
        description: error instanceof Error ? error.message : 'Erro desconhecido'
      });
    } finally {
      setIsProcessing(false);
    }
  };

  // Handler para upload de arquivo
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validar extensão
    if (!file.name.toLowerCase().endsWith('.txt')) {
      toast.error('Por favor, selecione um arquivo .txt');
      return;
    }

    try {
      // Ler arquivo com encoding ISO-8859-1
      const arrayBuffer = await file.arrayBuffer();
      const decoder = new TextDecoder('iso-8859-1');
      const conteudo = decoder.decode(arrayBuffer);
      
      await processarConteudo(conteudo);
    } catch (error) {
      console.error('Erro ao ler arquivo:', error);
      toast.error('Erro ao ler arquivo');
    }
  };

  // Handler para processar conteúdo colado
  const handleProcessarConteudoManual = () => {
    if (!conteudoManual.trim()) {
      toast.error('Cole o conteúdo do arquivo antes de processar');
      return;
    }
    processarConteudo(conteudoManual);
  };

  // Buscar/filtrar registros
  const handleBusca = (texto: string) => {
    setBuscaTexto(texto);
    
    if (!texto.trim()) {
      setRegistrosFiltrados(registros);
      setPaginaAtual(1);
      return;
    }

    const textoLower = texto.toLowerCase();
    const filtrados = registros.filter(r =>
      r.nome_paciente.toLowerCase().includes(textoLower) ||
      r.numero_aih.includes(textoLower) ||
      r.cns.includes(textoLower) ||
      r.nome_mae.toLowerCase().includes(textoLower) ||
      r.cpf.includes(textoLower)
    );

    setRegistrosFiltrados(filtrados);
    setPaginaAtual(1);
  };

  // Preparar confirmação de salvamento
  const handlePrepararSalvamento = () => {
    if (registros.length === 0) {
      toast.error('Nenhum registro para salvar');
      return;
    }
    setShowSaveConfirmation(true);
  };

  // Salvar no banco de dados (simplificado - sem autenticação)
  const handleSalvarNoBanco = async () => {
    setShowSaveConfirmation(false);
    setIsSaving(true);
    setSavedCount(0);

    const BATCH_SIZE = 100;
    const totalBatches = Math.ceil(registros.length / BATCH_SIZE);
    let sucessos = 0;
    let erros = 0;

    const loadingToast = toast.loading(
      `Salvando ${registros.length} registros...`
    );

    try {
      console.log(`📦 Iniciando salvamento de ${registros.length} registros em ${totalBatches} lotes`);

      for (let i = 0; i < totalBatches; i++) {
        const inicio = i * BATCH_SIZE;
        const fim = Math.min(inicio + BATCH_SIZE, registros.length);
        const lote = registros.slice(inicio, fim);

        // Função auxiliar para truncar strings
        const truncate = (str: string | null, maxLength: number): string | null => {
          if (!str) return null;
          return str.length > maxLength ? str.substring(0, maxLength) : str;
        };

        // Preparar dados para inserção (com validação de tamanho)
        const dadosParaInserir = lote.map(r => ({
          numero_aih: truncate(r.numero_aih, 13)!,
          tipo_aih: truncate(r.tipo_aih, 2)!,
          tipo_aih_descricao: truncate(r.tipo_aih_descricao, 50),
          cnes_hospital: truncate(r.cnes_hospital, 7),
          municipio_hospital: truncate(r.municipio_hospital, 6),
          competencia: truncate(r.competencia, 6),
          data_emissao: r.data_emissao || null,
          data_internacao: r.data_internacao,
          data_saida: r.data_saida || null,
          procedimento_solicitado: truncate(r.procedimento_solicitado, 10),
          procedimento_realizado: truncate(r.procedimento_realizado, 10),
          carater_internacao: truncate(r.carater_internacao, 2),
          motivo_saida: truncate(r.motivo_saida, 2),
          diagnostico_principal: truncate(r.diagnostico_principal, 4),
          diagnostico_secundario: truncate(r.diagnostico_secundario, 4),
          diagnostico_complementar: truncate(r.diagnostico_complementar, 4),
          diagnostico_obito: truncate(r.diagnostico_obito, 4),
          nome_paciente: truncate(r.nome_paciente, 70)!,
          data_nascimento: r.data_nascimento,
          sexo: truncate(r.sexo, 1)!,
          raca_cor: truncate(r.raca_cor, 2),
          cns: truncate(r.cns, 15),
          cpf: truncate(r.cpf, 11),
          nome_mae: truncate(r.nome_mae, 70),
          nome_responsavel: truncate(r.nome_responsavel, 70),
          logradouro: truncate(r.logradouro, 50),
          numero_endereco: truncate(r.numero_endereco, 7),
          complemento: truncate(r.complemento, 15),
          bairro: truncate(r.bairro, 30),
          codigo_municipio: truncate(r.codigo_municipio, 6),
          uf: truncate(r.uf, 2),
          cep: truncate(r.cep, 8),
          prontuario: truncate(r.prontuario, 15),
          enfermaria: truncate(r.enfermaria, 4),
          leito: truncate(r.leito, 4),
          medico_solicitante: truncate(r.medico_solicitante, 15),
          medico_responsavel: truncate(r.medico_responsavel, 15),
        }));

        // Salvar lote
        const { error } = await supabase
          .from('aih_registros')
          .upsert(dadosParaInserir, { 
            onConflict: 'numero_aih'
          });

        if (error) {
          console.error(`❌ Erro no lote ${i + 1}/${totalBatches}:`);
          console.error('Erro completo:', JSON.stringify(error, null, 2));
          console.error('Message:', error.message);
          console.error('Details:', error.details);
          console.error('Hint:', error.hint);
          console.error('Code:', error.code);
          
          // Log TODOS os registros do lote problemático
          console.error('📋 Todos os registros do lote com erro:');
          console.table(dadosParaInserir.map(r => ({
            numero_aih: r.numero_aih,
            tipo_aih: r.tipo_aih,
            nome_paciente: r.nome_paciente,
            data_internacao: r.data_internacao,
            data_nascimento: r.data_nascimento,
            sexo: r.sexo
          })));
          
          // Tentar salvar um por um para identificar qual registro está com problema
          console.warn('🔍 Tentando salvar registros individualmente para identificar o problema...');
          for (const registro of dadosParaInserir) {
            const { error: errIndividual } = await supabase
              .from('aih_registros')
              .upsert([registro], { 
                onConflict: 'numero_aih'
              });
            
            if (errIndividual) {
              console.error(`❌ Registro problemático: ${registro.numero_aih}`);
              console.error('Dados completos:', registro);
              console.error('Erro:', errIndividual.message);
              erros++;
            } else {
              sucessos++;
            }
          }
        } else {
          sucessos += lote.length;
          console.log(`✅ Lote ${i + 1}/${totalBatches} salvo (${sucessos}/${registros.length})`);
        }

        // Atualizar progresso
        setSavedCount(fim);
        toast.loading(
          `Salvando lote ${i + 1}/${totalBatches} (${fim}/${registros.length})`,
          { id: loadingToast }
        );

        // Pequena pausa entre lotes
        if (i < totalBatches - 1) {
          await new Promise(resolve => setTimeout(resolve, 100));
        }
      }

      toast.dismiss(loadingToast);

      console.log(`📊 Resumo: ${sucessos} salvos, ${erros} erros de ${registros.length} total`);

      if (erros === 0) {
        toast.success(`✅ ${sucessos} registros salvos com sucesso!`, {
          description: 'Dados gravados na tabela aih_registros',
          duration: 5000
        });
      } else if (sucessos > 0) {
        toast.warning(`⚠️ ${sucessos} salvos, ${erros} com erro`, {
          description: 'Verifique o console para detalhes dos erros',
          duration: 7000
        });
      } else {
        toast.error(`❌ Nenhum registro salvo. ${erros} erros`, {
          description: 'Verifique o console para detalhes dos erros',
          duration: 7000
        });
      }
    } catch (error) {
      toast.dismiss(loadingToast);
      console.error('❌ Erro ao salvar:', error);
      toast.error('Erro ao salvar registros', {
        description: error instanceof Error ? error.message : 'Erro desconhecido',
        duration: 5000
      });
    } finally {
      setIsSaving(false);
    }
  };

  // Exportar para CSV
  const handleExportarCSV = () => {
    if (registros.length === 0) {
      toast.error('Nenhum registro para exportar');
      return;
    }

    try {
      const timestamp = new Date().toISOString().split('T')[0];
      baixarCSV(registros, `sisaih01_${timestamp}.csv`);
      toast.success('CSV exportado com sucesso!');
    } catch (error) {
      console.error('Erro ao exportar CSV:', error);
      toast.error('Erro ao exportar CSV');
    }
  };

  // Paginação
  const totalPaginas = Math.ceil(registrosFiltrados.length / registrosPorPagina);
  const indiceInicio = (paginaAtual - 1) * registrosPorPagina;
  const indiceFim = indiceInicio + registrosPorPagina;
  const registrosPagina = registrosFiltrados.slice(indiceInicio, indiceFim);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-gradient-to-r from-blue-600 to-indigo-600 rounded-lg p-6 text-white">
        <div className="flex items-center gap-3">
          <FileText className="h-10 w-10" />
          <div>
            <h1 className="text-3xl font-bold">SISAIH01 - Processador de AIH</h1>
            <p className="text-blue-100 mt-1">
              Sistema de Informações Hospitalares do SUS - Autorização de Internação Hospitalar
            </p>
          </div>
        </div>
      </div>

      {/* Upload de Arquivo */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Upload className="h-5 w-5" />
            Upload de Arquivo SISAIH01
          </CardTitle>
          <CardDescription>
            Selecione o arquivo .txt do DATASUS ou cole o conteúdo manualmente
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Instruções */}
          <Alert>
            <Info className="h-4 w-4" />
            <AlertDescription className="text-sm">
              <strong>Formato esperado:</strong> Arquivo de texto (.txt) com layout posicional de tamanho fixo (1600 caracteres por linha).
              Encoding: ISO-8859-1. Tipos de registro processados: 01 (Principal), 03 (Continuação), 05 (Longa Permanência).
            </AlertDescription>
          </Alert>

          {/* Upload de arquivo */}
          <div className="space-y-2">
            <label className="text-sm font-medium">Selecionar Arquivo</label>
            <div className="flex gap-2">
              <Input
                ref={fileInputRef}
                type="file"
                accept=".txt"
                onChange={handleFileUpload}
                disabled={isProcessing}
                className="flex-1"
              />
              <Button
                variant="outline"
                onClick={() => fileInputRef.current?.click()}
                disabled={isProcessing}
              >
                Escolher Arquivo
              </Button>
            </div>
          </div>

          {/* Ou colar conteúdo */}
          <div className="space-y-2">
            <label className="text-sm font-medium">Ou Cole o Conteúdo do Arquivo</label>
            <Textarea
              value={conteudoManual}
              onChange={(e) => setConteudoManual(e.target.value)}
              placeholder="Cole aqui o conteúdo do arquivo SISAIH01..."
              rows={6}
              disabled={isProcessing}
              className="font-mono text-xs"
            />
            <Button
              onClick={handleProcessarConteudoManual}
              disabled={isProcessing || !conteudoManual.trim()}
              className="w-full"
            >
              {isProcessing ? (
                <>
                  <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                  Processando...
                </>
              ) : (
                <>
                  <Upload className="h-4 w-4 mr-2" />
                  Processar Conteúdo
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Estatísticas */}
      {estatisticas && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card className="border-blue-200 bg-blue-50">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <FileText className="h-4 w-4 text-blue-600" />
                Total de AIHs
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold text-blue-600">{estatisticas.total_registros}</p>
              <div className="mt-2 space-y-1">
                <p className="text-xs text-blue-700">Principal: {estatisticas.por_tipo.principal}</p>
                <p className="text-xs text-blue-700">Continuação: {estatisticas.por_tipo.continuacao}</p>
                <p className="text-xs text-blue-700">Longa Perm.: {estatisticas.por_tipo.longa_permanencia}</p>
              </div>
            </CardContent>
          </Card>

          <Card className="border-green-200 bg-green-50">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <Users className="h-4 w-4 text-green-600" />
                Pacientes Únicos
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold text-green-600">{estatisticas.pacientes_unicos}</p>
              <p className="text-xs text-green-700 mt-2">Identificados por CNS único</p>
            </CardContent>
          </Card>

          <Card className="border-purple-200 bg-purple-50">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <User className="h-4 w-4 text-purple-600" />
                Total Masculino
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold text-purple-600">{estatisticas.total_masculino}</p>
              <p className="text-xs text-purple-700 mt-2">
                {((estatisticas.total_masculino / estatisticas.total_registros) * 100).toFixed(1)}% do total
              </p>
            </CardContent>
          </Card>

          <Card className="border-pink-200 bg-pink-50">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <User className="h-4 w-4 text-pink-600" />
                Total Feminino
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold text-pink-600">{estatisticas.total_feminino}</p>
              <p className="text-xs text-pink-700 mt-2">
                {((estatisticas.total_feminino / estatisticas.total_registros) * 100).toFixed(1)}% do total
              </p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Barra de Ações */}
      {registros.length > 0 && (
        <Card>
          <CardContent className="pt-6">
            <div className="flex flex-col md:flex-row gap-3">
              {/* Busca */}
              <div className="flex-1">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <Input
                    value={buscaTexto}
                    onChange={(e) => handleBusca(e.target.value)}
                    placeholder="Buscar por nome, AIH, CNS, nome da mãe ou CPF..."
                    className="pl-10"
                  />
                </div>
              </div>

              {/* Botões */}
              <Button
                variant="outline"
                onClick={handleExportarCSV}
                disabled={registros.length === 0}
              >
                <Download className="h-4 w-4 mr-2" />
                Exportar CSV
              </Button>

              <Button
                onClick={handlePrepararSalvamento}
                disabled={isSaving || registros.length === 0}
                className="bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 shadow-lg hover:shadow-xl transition-all"
                size="lg"
              >
                {isSaving ? (
                  <>
                    <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                    Salvando {savedCount}/{registros.length}...
                  </>
                ) : (
                  <>
                    <Save className="h-4 w-4 mr-2" />
                    💾 Salvar no Banco de Dados
                  </>
                )}
              </Button>
            </div>

            {/* Info de resultados */}
            {buscaTexto && (
              <div className="mt-3 text-sm text-gray-600">
                {registrosFiltrados.length === registros.length ? (
                  <span>Mostrando todos os {registros.length} registros</span>
                ) : (
                  <span>
                    Encontrados {registrosFiltrados.length} de {registros.length} registros
                  </span>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Lista de Registros */}
      {registrosPagina.length > 0 && (
        <div className="space-y-4">
          {registrosPagina.map((registro, index) => (
            <Card key={`${registro.numero_aih}-${index}`} className="hover:shadow-lg transition-shadow">
              <CardContent className="pt-6">
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                  {/* Coluna 1 - Dados do Paciente */}
                  <div className="space-y-3">
                    <div className="flex items-center gap-2 mb-3">
                      <Users className="h-5 w-5 text-blue-600" />
                      <h3 className="font-semibold text-lg">Dados do Paciente</h3>
                    </div>
                    
                    <div>
                      <p className="text-sm text-gray-500">Nome</p>
                      <p className="font-medium">{registro.nome_paciente}</p>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <p className="text-sm text-gray-500">Data Nascimento</p>
                        <p className="font-medium text-sm">{registro.data_nascimento_formatted}</p>
                      </div>
                      <div>
                        <p className="text-sm text-gray-500">Sexo</p>
                        <Badge variant="outline" className={registro.sexo === 'M' ? 'bg-blue-50' : 'bg-pink-50'}>
                          {registro.sexo_descricao}
                        </Badge>
                      </div>
                    </div>

                    <div>
                      <p className="text-sm text-gray-500">CNS</p>
                      <p className="font-mono text-sm">{registro.cns || '—'}</p>
                    </div>

                    {registro.cpf && (
                      <div>
                        <p className="text-sm text-gray-500">CPF</p>
                        <p className="font-mono text-sm">{registro.cpf}</p>
                      </div>
                    )}

                    <div>
                      <p className="text-sm text-gray-500">Nome da Mãe</p>
                      <p className="font-medium text-sm">{registro.nome_mae || '—'}</p>
                    </div>
                  </div>

                  {/* Coluna 2 - Internação */}
                  <div className="space-y-3">
                    <div className="flex items-center gap-2 mb-3">
                      <Hospital className="h-5 w-5 text-green-600" />
                      <h3 className="font-semibold text-lg">Internação</h3>
                    </div>

                    <div>
                      <p className="text-sm text-gray-500">Número AIH</p>
                      <p className="font-mono font-bold text-green-600">{registro.numero_aih}</p>
                    </div>

                    <div>
                      <p className="text-sm text-gray-500">Tipo</p>
                      <Badge variant="outline" className="bg-indigo-50 text-indigo-700">
                        {registro.tipo_aih_descricao}
                      </Badge>
                    </div>

                    <div>
                      <p className="text-sm text-gray-500">CNES Hospital</p>
                      <p className="font-mono text-sm">{registro.cnes_hospital || '—'}</p>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <p className="text-sm text-gray-500">Data Internação</p>
                        <p className="text-sm flex items-center gap-1">
                          <Calendar className="h-3 w-3" />
                          {registro.data_internacao_formatted}
                        </p>
                      </div>
                      <div>
                        <p className="text-sm text-gray-500">Data Saída</p>
                        <p className="text-sm flex items-center gap-1">
                          <Calendar className="h-3 w-3" />
                          {registro.data_saida_formatted || '—'}
                        </p>
                      </div>
                    </div>

                    {registro.prontuario && (
                      <div>
                        <p className="text-sm text-gray-500">Prontuário</p>
                        <p className="font-mono text-sm">{registro.prontuario}</p>
                      </div>
                    )}

                    {(registro.enfermaria || registro.leito) && (
                      <div className="grid grid-cols-2 gap-3">
                        {registro.enfermaria && (
                          <div>
                            <p className="text-sm text-gray-500">Enfermaria</p>
                            <p className="text-sm">{registro.enfermaria}</p>
                          </div>
                        )}
                        {registro.leito && (
                          <div>
                            <p className="text-sm text-gray-500">Leito</p>
                            <p className="text-sm">{registro.leito}</p>
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Coluna 3 - Endereço e Diagnóstico */}
                  <div className="space-y-3">
                    <div className="flex items-center gap-2 mb-3">
                      <MapPin className="h-5 w-5 text-purple-600" />
                      <h3 className="font-semibold text-lg">Endereço</h3>
                    </div>

                    {registro.logradouro && (
                      <div>
                        <p className="text-sm text-gray-500">Logradouro</p>
                        <p className="text-sm">
                          {registro.logradouro}
                          {registro.numero_endereco && `, ${registro.numero_endereco}`}
                          {registro.complemento && ` - ${registro.complemento}`}
                        </p>
                      </div>
                    )}

                    {registro.bairro && (
                      <div>
                        <p className="text-sm text-gray-500">Bairro</p>
                        <p className="text-sm">{registro.bairro}</p>
                      </div>
                    )}

                    {(registro.uf || registro.cep) && (
                      <div className="grid grid-cols-2 gap-3">
                        {registro.uf && (
                          <div>
                            <p className="text-sm text-gray-500">UF</p>
                            <p className="text-sm font-medium">{registro.uf}</p>
                          </div>
                        )}
                        {registro.cep && (
                          <div>
                            <p className="text-sm text-gray-500">CEP</p>
                            <p className="text-sm font-mono">{registro.cep}</p>
                          </div>
                        )}
                      </div>
                    )}

                    <div className="pt-3 border-t">
                      <div className="flex items-center gap-2 mb-2">
                        <Stethoscope className="h-4 w-4 text-red-600" />
                        <p className="text-sm font-semibold">Diagnóstico</p>
                      </div>
                      {registro.diagnostico_principal && (
                        <div>
                          <p className="text-xs text-gray-500">CID Principal</p>
                          <p className="text-sm font-mono font-bold text-red-600">
                            {registro.diagnostico_principal}
                          </p>
                        </div>
                      )}
                      {registro.diagnostico_secundario && (
                        <div className="mt-2">
                          <p className="text-xs text-gray-500">CID Secundário</p>
                          <p className="text-sm font-mono">{registro.diagnostico_secundario}</p>
                        </div>
                      )}
                    </div>

                    {registro.procedimento_realizado && (
                      <div className="pt-3 border-t">
                        <p className="text-sm text-gray-500">Procedimento Realizado</p>
                        <p className="text-sm font-mono">{registro.procedimento_realizado}</p>
                      </div>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}

          {/* Paginação */}
          {totalPaginas > 1 && (
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <p className="text-sm text-gray-600">
                    Página {paginaAtual} de {totalPaginas} ({registrosFiltrados.length} registros)
                  </p>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setPaginaAtual(p => Math.max(1, p - 1))}
                      disabled={paginaAtual === 1}
                    >
                      Anterior
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setPaginaAtual(p => Math.min(totalPaginas, p + 1))}
                      disabled={paginaAtual === totalPaginas}
                    >
                      Próxima
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* Estado vazio */}
      {registros.length === 0 && !isProcessing && (
        <Card>
          <CardContent className="py-12 text-center">
            <FileText className="h-16 w-16 text-gray-300 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">
              Nenhum arquivo processado
            </h3>
            <p className="text-gray-500">
              Faça upload de um arquivo SISAIH01 ou cole o conteúdo para começar
            </p>
          </CardContent>
        </Card>
      )}

      {/* Modal de Confirmação de Salvamento */}
      {showSaveConfirmation && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <Card className="w-full max-w-lg shadow-2xl animate-in fade-in zoom-in duration-200">
            <CardHeader className="bg-gradient-to-r from-green-600 to-emerald-600 text-white">
              <CardTitle className="flex items-center gap-2">
                <Save className="h-6 w-6" />
                Confirmar Salvamento
              </CardTitle>
              <CardDescription className="text-green-50">
                Você está prestes a salvar os registros no banco de dados
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-6">
              <div className="space-y-4">
                {/* Resumo dos dados */}
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <h4 className="font-semibold text-blue-900 mb-3 flex items-center gap-2">
                    <Info className="h-5 w-5" />
                    Resumo do Salvamento
                  </h4>
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div>
                      <p className="text-blue-700 font-medium">Total de Registros</p>
                      <p className="text-2xl font-bold text-blue-900">{registros.length}</p>
                    </div>
                    <div>
                      <p className="text-blue-700 font-medium">Pacientes Únicos</p>
                      <p className="text-2xl font-bold text-blue-900">{estatisticas?.pacientes_unicos || 0}</p>
                    </div>
                    <div>
                      <p className="text-blue-700 font-medium">Tipo Principal</p>
                      <p className="text-lg font-bold text-blue-900">{estatisticas?.por_tipo.principal || 0}</p>
                    </div>
                    <div>
                      <p className="text-blue-700 font-medium">Tipo Continuação</p>
                      <p className="text-lg font-bold text-blue-900">{estatisticas?.por_tipo.continuacao || 0}</p>
                    </div>
                  </div>
                </div>

                {/* Informações importantes */}
                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                  <h4 className="font-semibold text-yellow-900 mb-2 flex items-center gap-2">
                    <AlertCircle className="h-5 w-5" />
                    Informações Importantes
                  </h4>
                  <ul className="text-sm text-yellow-800 space-y-1">
                    <li>• Os dados serão salvos na tabela <code className="bg-yellow-100 px-1 rounded">aih_registros</code></li>
                    <li>• Registros duplicados (mesmo número de AIH) serão atualizados</li>
                    <li>• O processo pode levar alguns segundos para grandes volumes</li>
                    <li>• Você poderá acompanhar o progresso em tempo real</li>
                  </ul>
                </div>

                {/* Botões */}
                <div className="flex gap-3 pt-4">
                  <Button
                    variant="outline"
                    onClick={() => setShowSaveConfirmation(false)}
                    className="flex-1"
                    disabled={isSaving}
                  >
                    <span className="mr-2">❌</span>
                    Cancelar
                  </Button>
                  <Button
                    onClick={handleSalvarNoBanco}
                    className="flex-1 bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700"
                    disabled={isSaving}
                  >
                    {isSaving ? (
                      <>
                        <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                        Salvando...
                      </>
                    ) : (
                      <>
                        <CheckCircle className="h-4 w-4 mr-2" />
                        Confirmar e Salvar
                      </>
                    )}
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
};

export default SISAIH01Page;


import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Alert, AlertDescription } from './ui/alert';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from './ui/table';
import { GitCompare, Database, RefreshCw, Info } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { toast } from 'sonner';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

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
      procedure_description?: string | null;
    }>;
  } | null>(null);
  
  const [isLoading, setIsLoading] = useState(false);

  // Estados para seleção e reapresentação em lote
  const [aihsSelecionadas, setAihsSelecionadas] = useState<Set<string>>(new Set());
  const [processandoReapresentacao, setProcessandoReapresentacao] = useState(false);

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

  // Função para calcular próxima competência (AAAAMM + 1 mês)
  const calcularProximaCompetencia = (competenciaAtual: string): string => {
    if (!competenciaAtual || competenciaAtual.length !== 6) return '';
    
    const ano = parseInt(competenciaAtual.substring(0, 4));
    const mes = parseInt(competenciaAtual.substring(4, 6));
    
    let novoAno = ano;
    let novoMes = mes + 1;
    
    if (novoMes > 12) {
      novoMes = 1;
      novoAno++;
    }
    
    return `${novoAno}${novoMes.toString().padStart(2, '0')}`;
  };

  // Função para toggle seleção individual
  const toggleSelecaoAIH = (numeroAIH: string) => {
    setAihsSelecionadas(prev => {
      const novoSet = new Set(prev);
      if (novoSet.has(numeroAIH)) {
        novoSet.delete(numeroAIH);
      } else {
        novoSet.add(numeroAIH);
      }
      return novoSet;
    });
  };

  // Função para selecionar/desselecionar todas AIHs pendentes
  const toggleSelecionarTodas = () => {
    if (!resultadoSync) return;
    
    const aihsPendentes = resultadoSync.detalhes
      .filter(d => d.status === 'pendente')
      .map(d => d.numero_aih);
    
    if (aihsSelecionadas.size === aihsPendentes.length) {
      // Desselecionar todas
      setAihsSelecionadas(new Set());
    } else {
      // Selecionar todas
      setAihsSelecionadas(new Set(aihsPendentes));
    }
  };

  // Função para gerar relatório PDF de AIHs Sincronizadas
  const gerarRelatorioPDFSincronizadas = async () => {
    if (!resultadoSync) {
      toast.error('Nenhum resultado de sincronização disponível');
      return;
    }

    try {
      console.log('📄 Gerando relatório PDF de AIHs Sincronizadas...');

      // 🖼️ Carregar logo do CIS
      let logoBase64 = null;
      try {
        const response = await fetch('/CIS Sem fundo.jpg');
        const blob = await response.blob();
        logoBase64 = await new Promise<string>((resolve) => {
          const reader = new FileReader();
          reader.onloadend = () => resolve(reader.result as string);
          reader.readAsDataURL(blob);
        });
      } catch (error) {
        console.error('⚠️ Erro ao carregar logo:', error);
      }

      const doc = new jsPDF();
      const pageWidth = doc.internal.pageSize.width;
      const pageHeight = doc.internal.pageSize.height;
      let yPosition = 20;

      // ========== CABEÇALHO PROFISSIONAL COM LOGO ==========
      // Inserir Logo CIS (se carregado)
      if (logoBase64) {
        const logoWidth = 35;
        const logoHeight = 17.5;
        const logoX = 15;
        const logoY = 8;
        doc.addImage(logoBase64, 'JPEG', logoX, logoY, logoWidth, logoHeight);
      }

      // Título do Documento (centralizado)
      doc.setFontSize(16);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(0, 102, 204); // Azul suave institucional
      doc.text('RELATÓRIO DE AIHs SINCRONIZADAS', pageWidth / 2, 18, { align: 'center' });

      // Subtítulo
      doc.setFontSize(10);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(80, 80, 80);
      doc.text('CIS - Centro Integrado em Saúde', pageWidth / 2, 25, { align: 'center' });

      // Linha divisória profissional
      doc.setDrawColor(0, 102, 204);
      doc.setLineWidth(0.5);
      doc.line(15, 30, pageWidth - 15, 30);

      yPosition = 38;

      // ========== INFORMAÇÕES DA SINCRONIZAÇÃO (CENTRALIZADO) ==========
      const dataHora = new Date().toLocaleString('pt-BR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });

      // Buscar nome do hospital
      const hospitalSelecionado = hospitaisAIHAvancado.find(h => h.id === hospitalAIHSelecionado);
      const nomeHospital = hospitalSelecionado?.name || 'Hospital não identificado';

      const totalAIHsEtapa1 = aihsEncontradas.length;
      const totalSISAIH01 = sisaih01Encontrados.length;
      const taxaSincronizacao = totalSISAIH01 > 0 
        ? ((resultadoSync.sincronizados / totalSISAIH01) * 100).toFixed(1) 
        : '0.0';

      doc.setFillColor(240, 248, 255);
      doc.rect(10, yPosition, pageWidth - 20, 42, 'F');
      doc.setDrawColor(0, 102, 204);
      doc.setLineWidth(0.3);
      doc.rect(10, yPosition, pageWidth - 20, 42);

      doc.setFontSize(10);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(0, 102, 204);
      doc.text('Informações da Sincronização', pageWidth / 2, yPosition + 8, { align: 'center' });

      doc.setFontSize(8);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(60, 60, 60);

      // Organizar informações em duas colunas
      const col1X = 25;
      const col2X = pageWidth / 2 + 10;
      let infoY = yPosition + 16;

      doc.text(`Data/Hora: ${dataHora}`, col1X, infoY);
      doc.text(`Competência: ${formatarCompetencia(competenciaAIHSelecionada)}`, col2X, infoY);
      
      infoY += 5;
      doc.text(`Hospital: ${nomeHospital}`, col1X, infoY);
      
      infoY += 6;
      doc.text(`Total Etapa 1 (AIH Avançado): ${totalAIHsEtapa1} registros`, col1X, infoY);
      doc.text(`Total Etapa 2 (SISAIH01): ${totalSISAIH01} registros`, col2X, infoY);
      
      infoY += 6;
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(0, 102, 204);
      doc.text(`AIHs Sincronizadas: ${resultadoSync.sincronizados} (${taxaSincronizacao}%)`, pageWidth / 2, infoY, { align: 'center' });

      yPosition += 48;
      doc.setTextColor(0, 0, 0);

      // ========== TABELA DE AIHs SINCRONIZADAS ==========
      // Calcular valor total primeiro
      const valorTotal = resultadoSync.detalhes
        .filter(d => d.status === 'sincronizado')
        .reduce((acc, d) => acc + (d.aih_avancado?.calculated_total_value || 0), 0);

      const valorTotalFormatado = new Intl.NumberFormat('pt-BR', {
        style: 'currency',
        currency: 'BRL'
      }).format(valorTotal / 100);

      doc.setFontSize(10);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(0, 102, 204);
      doc.text('Detalhamento das AIHs Sincronizadas', 15, yPosition);
      
      // Valor total no cabeçalho
      doc.setTextColor(0, 100, 0);
      doc.text(`Valor Total: ${valorTotalFormatado}`, pageWidth - 15, yPosition, { align: 'right' });
      
      yPosition += 5;
      doc.setTextColor(0, 0, 0);

      // Filtrar AIHs sincronizadas
      const aihsSincronizadas = resultadoSync.detalhes
        .filter(d => d.status === 'sincronizado')
        .map((d, index) => {
          const nomePaciente = d.aih_avancado?.patient_name || d.sisaih01?.nome_paciente || '-';
          
          const dataInternacao = d.sisaih01?.data_internacao
            ? new Date(d.sisaih01.data_internacao).toLocaleDateString('pt-BR')
            : (d.aih_avancado?.admission_date 
                ? new Date(d.aih_avancado.admission_date).toLocaleDateString('pt-BR')
                : '-');

          const procedimento = d.aih_avancado?.procedure_requested || '-';
          const qtdProc = d.aih_avancado?.total_procedures || 0;
          
          const valor = d.aih_avancado?.calculated_total_value
            ? new Intl.NumberFormat('pt-BR', {
                style: 'currency',
                currency: 'BRL'
              }).format(d.aih_avancado.calculated_total_value / 100)
            : 'R$ 0,00';

          return [
            (index + 1).toString(),
            d.numero_aih,
            nomePaciente,
            dataInternacao,
            qtdProc.toString(),
            procedimento,
            valor
          ];
        });

      autoTable(doc, {
        startY: yPosition,
        head: [['#', 'Número AIH', 'Paciente', 'Data Int.', 'Qtd', 'Procedimento', 'Valor']],
        body: aihsSincronizadas,
        theme: 'striped',
        headStyles: {
          fillColor: [0, 102, 204], // Azul suave
          textColor: 255,
          fontSize: 9,
          fontStyle: 'bold',
          halign: 'center'
        },
        bodyStyles: {
          fontSize: 8,
          textColor: 60,
          lineColor: [200, 200, 200],
          lineWidth: 0.1
        },
        alternateRowStyles: {
          fillColor: [248, 250, 252] // Cinza muito suave
        },
        columnStyles: {
          0: { cellWidth: 10, halign: 'center' },
          1: { cellWidth: 28, halign: 'center' },
          2: { cellWidth: 35 },
          3: { cellWidth: 20, halign: 'center' },
          4: { cellWidth: 12, halign: 'center' },
          5: { cellWidth: 45 },
          6: { cellWidth: 25, halign: 'right' }
        },
        margin: { left: 10, right: 10 }
      });

      // ========== BOX DE VALIDAÇÃO (SUAVE) ==========
      const finalY = (doc as any).lastAutoTable.finalY || yPosition + 50;
      let footerY = finalY + 12;

      if (footerY > pageHeight - 60) {
        doc.addPage();
        footerY = 20;
      }

      doc.setFillColor(240, 250, 255); // Azul muito suave
      doc.rect(10, footerY, pageWidth - 20, 22, 'F');
      doc.setDrawColor(0, 102, 204);
      doc.setLineWidth(0.3);
      doc.rect(10, footerY, pageWidth - 20, 22);

      doc.setFontSize(9);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(0, 102, 204);
      doc.text('✓ Sincronização Confirmada', 15, footerY + 6);

      doc.setFont('helvetica', 'normal');
      doc.setTextColor(80, 80, 80);
      doc.setFontSize(8);
      const obsText = [
        'As AIHs listadas foram confirmadas pelo SUS (SISAIH01) e estão registradas no sistema interno.',
        'Este relatório serve como comprovante e deve ser arquivado para auditoria.'
      ];
      
      obsText.forEach((line, index) => {
        doc.text(line, 15, footerY + 13 + (index * 4));
      });

      footerY += 30;

      // Espaço para validação
      if (footerY > pageHeight - 50) {
        doc.addPage();
        footerY = 20;
      }

      doc.setDrawColor(200, 200, 200);
      doc.line(15, footerY + 20, 90, footerY + 20);
      doc.line(110, footerY + 20, 185, footerY + 20);

      doc.setFontSize(8);
      doc.setTextColor(100, 100, 100);
      doc.text('Responsável pela Auditoria', 52.5, footerY + 25, { align: 'center' });
      doc.text('Data: ___/___/______', 52.5, footerY + 30, { align: 'center' });

      doc.text('Diretor Técnico/Gestor', 147.5, footerY + 25, { align: 'center' });
      doc.text('Data: ___/___/______', 147.5, footerY + 30, { align: 'center' });

      // ========== RODAPÉ SUAVE ==========
      doc.setDrawColor(0, 102, 204);
      doc.setLineWidth(0.3);
      doc.line(15, pageHeight - 20, pageWidth - 15, pageHeight - 20);

      doc.setTextColor(100, 100, 100);
      doc.setFontSize(7);
      doc.setFont('helvetica', 'normal');
      doc.text(
        'CIS - Centro Integrado em Saúde | Relatório de Sincronização',
        pageWidth / 2,
        pageHeight - 12,
        { align: 'center' }
      );
      doc.text(
        `Gerado em: ${dataHora}`,
        pageWidth / 2,
        pageHeight - 8,
        { align: 'center' }
      );

      // ========== SALVAR PDF ==========
      const nomeArquivo = `AIHs_Sincronizadas_${competenciaAIHSelecionada}_${Date.now()}.pdf`;
      doc.save(nomeArquivo);

      console.log(`✅ Relatório PDF gerado: ${nomeArquivo}`);
      toast.success(`Relatório gerado com sucesso! ${resultadoSync.sincronizados} AIHs sincronizadas`, { duration: 3000 });

      return true;
    } catch (error) {
      console.error('❌ Erro ao gerar PDF:', error);
      toast.error('Erro ao gerar relatório PDF');
      return false;
    }
  };

  // Função para gerar relatório PDF de reapresentação
  const gerarRelatorioPDFReapresentacao = async (
    aihsSelecionadasArray: string[],
    detalhesAIHs: any[],
    competenciaAtual: string,
    proximaCompetencia: string,
    nomeHospital: string
  ) => {
    try {
      console.log('📄 Gerando relatório PDF de reapresentação...');

      // 🖼️ Carregar logo do CIS
      let logoBase64 = null;
      try {
        const response = await fetch('/CIS Sem fundo.jpg');
        const blob = await response.blob();
        logoBase64 = await new Promise<string>((resolve) => {
          const reader = new FileReader();
          reader.onloadend = () => resolve(reader.result as string);
          reader.readAsDataURL(blob);
        });
      } catch (error) {
        console.error('⚠️ Erro ao carregar logo:', error);
      }

      const doc = new jsPDF();
      const pageWidth = doc.internal.pageSize.width;
      const pageHeight = doc.internal.pageSize.height;
      let yPosition = 20;

      // ========== CABEÇALHO PROFISSIONAL COM LOGO ==========
      // Inserir Logo CIS (se carregado)
      if (logoBase64) {
        const logoWidth = 35;
        const logoHeight = 17.5;
        const logoX = 15;
        const logoY = 8;
        doc.addImage(logoBase64, 'JPEG', logoX, logoY, logoWidth, logoHeight);
      }

      // Título do Documento (centralizado)
      doc.setFontSize(16);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(200, 120, 0); // Laranja suave
      doc.text('RELATÓRIO DE REAPRESENTAÇÃO DE AIHs', pageWidth / 2, 18, { align: 'center' });

      // Subtítulo
      doc.setFontSize(10);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(80, 80, 80);
      doc.text('CIS - Centro Integrado em Saúde', pageWidth / 2, 25, { align: 'center' });

      // Linha divisória profissional
      doc.setDrawColor(200, 120, 0);
      doc.setLineWidth(0.5);
      doc.line(15, 30, pageWidth - 15, 30);

      yPosition = 38;

      // ========== INFORMAÇÕES DA OPERAÇÃO ==========
      doc.setTextColor(0, 0, 0);
      doc.setFillColor(240, 240, 240);
      doc.rect(10, yPosition, pageWidth - 20, 35, 'F');

      doc.setFontSize(11);
      doc.setFont('helvetica', 'bold');
      doc.text('Informações da Operação', 15, yPosition + 8);

      doc.setFontSize(9);
      doc.setFont('helvetica', 'normal');
      
      const dataHora = new Date().toLocaleString('pt-BR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });

      const infoLines = [
        `Data/Hora: ${dataHora}`,
        `Hospital: ${nomeHospital}`,
        `Competência Atual: ${formatarCompetencia(competenciaAtual)}`,
        `Nova Competência: ${formatarCompetencia(proximaCompetencia)}`,
        `Quantidade de AIHs: ${aihsSelecionadasArray.length}`
      ];

      infoLines.forEach((line, index) => {
        doc.text(line, 15, yPosition + 15 + (index * 5));
      });

      yPosition += 45;

      // ========== TABELA DE AIHs ==========
      doc.setFontSize(11);
      doc.setFont('helvetica', 'bold');
      doc.text('AIHs Selecionadas para Reapresentação', 15, yPosition);
      yPosition += 5;

      // Filtrar e preparar dados da tabela
      const aihsParaTabela = detalhesAIHs
        .filter(d => aihsSelecionadasArray.includes(d.numero_aih))
        .map((d, index) => {
          const nomePaciente = d.aih_avancado?.patient_name || 
            (d.aih_avancado?.patient_id ? `ID: ${d.aih_avancado.patient_id.substring(0, 10)}...` : '-');
          
          const dataInternacao = d.aih_avancado?.admission_date
            ? new Date(d.aih_avancado.admission_date).toLocaleDateString('pt-BR')
            : '-';

          const procedimento = d.aih_avancado?.procedure_requested || '-';
          
          const valor = d.aih_avancado?.calculated_total_value
            ? new Intl.NumberFormat('pt-BR', {
                style: 'currency',
                currency: 'BRL'
              }).format(d.aih_avancado.calculated_total_value / 100)
            : 'R$ 0,00';

          return [
            (index + 1).toString(),
            d.numero_aih,
            nomePaciente,
            dataInternacao,
            procedimento,
            valor
          ];
        });

      // Calcular valor total
      const valorTotal = detalhesAIHs
        .filter(d => aihsSelecionadasArray.includes(d.numero_aih))
        .reduce((acc, d) => acc + (d.aih_avancado?.calculated_total_value || 0), 0);

      const valorTotalFormatado = new Intl.NumberFormat('pt-BR', {
        style: 'currency',
        currency: 'BRL'
      }).format(valorTotal / 100);

      autoTable(doc, {
        startY: yPosition,
        head: [['#', 'Número AIH', 'Paciente', 'Data Intern.', 'Procedimento', 'Valor']],
        body: aihsParaTabela,
        foot: [['', '', '', '', 'TOTAL:', valorTotalFormatado]],
        theme: 'striped',
        headStyles: {
          fillColor: [200, 120, 0], // Laranja suave
          textColor: 255,
          fontSize: 9,
          fontStyle: 'bold',
          halign: 'center'
        },
        footStyles: {
          fillColor: [255, 248, 230], // Laranja muito suave
          textColor: [100, 60, 0], // Marrom
          fontSize: 10,
          fontStyle: 'bold',
          halign: 'right'
        },
        bodyStyles: {
          fontSize: 8,
          textColor: 60,
          lineColor: [200, 200, 200],
          lineWidth: 0.1
        },
        alternateRowStyles: {
          fillColor: [252, 250, 248] // Cinza muito suave com tom quente
        },
        columnStyles: {
          0: { cellWidth: 10, halign: 'center' },
          1: { cellWidth: 30, halign: 'center' },
          2: { cellWidth: 40 },
          3: { cellWidth: 22, halign: 'center' },
          4: { cellWidth: 50 },
          5: { cellWidth: 25, halign: 'right' }
        },
        margin: { left: 10, right: 10 }
      });

      // ========== OBSERVAÇÕES (SUAVE) ==========
      const finalY = (doc as any).lastAutoTable.finalY || yPosition + 50;
      let footerY = finalY + 12;

      // Garantir que há espaço para observações
      if (footerY > pageHeight - 60) {
        doc.addPage();
        footerY = 20;
      }

      doc.setFillColor(255, 248, 230); // Laranja muito suave
      doc.rect(10, footerY, pageWidth - 20, 22, 'F');
      doc.setDrawColor(200, 120, 0);
      doc.setLineWidth(0.3);
      doc.rect(10, footerY, pageWidth - 20, 22);

      doc.setFontSize(9);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(200, 120, 0);
      doc.text('⚠ Reapresentação Registrada', 15, footerY + 6);

      doc.setFont('helvetica', 'normal');
      doc.setTextColor(80, 80, 80);
      doc.setFontSize(8);
      const obsText = [
        `AIHs reapresentadas para ${formatarCompetencia(proximaCompetencia)} conforme procedimento padrão do SUS.`,
        'Mantenha este relatório arquivado para auditoria e controle interno.'
      ];
      
      obsText.forEach((line, index) => {
        doc.text(line, 15, footerY + 13 + (index * 4));
      });

      footerY += 30;

      // Espaço para assinaturas
      if (footerY > pageHeight - 50) {
        doc.addPage();
        footerY = 20;
      }

      doc.setDrawColor(200, 200, 200);
      doc.line(15, footerY + 20, 90, footerY + 20);
      doc.line(110, footerY + 20, 185, footerY + 20);

      doc.setFontSize(8);
      doc.setTextColor(100, 100, 100);
      doc.text('Responsável pela Operação', 52.5, footerY + 25, { align: 'center' });
      doc.text('Data: ___/___/______', 52.5, footerY + 30, { align: 'center' });

      doc.text('Supervisor/Auditor', 147.5, footerY + 25, { align: 'center' });
      doc.text('Data: ___/___/______', 147.5, footerY + 30, { align: 'center' });

      // ========== RODAPÉ SUAVE ==========
      doc.setDrawColor(200, 120, 0);
      doc.setLineWidth(0.3);
      doc.line(15, pageHeight - 20, pageWidth - 15, pageHeight - 20);

      doc.setTextColor(100, 100, 100);
      doc.setFontSize(7);
      doc.setFont('helvetica', 'normal');
      doc.text(
        'CIS - Centro Integrado em Saúde | Relatório de Reapresentação',
        pageWidth / 2,
        pageHeight - 12,
        { align: 'center' }
      );
      doc.text(
        `Gerado em: ${dataHora}`,
        pageWidth / 2,
        pageHeight - 8,
        { align: 'center' }
      );

      // ========== SALVAR PDF ==========
      const nomeArquivo = `Reapresentacao_AIHs_${competenciaAtual}_para_${proximaCompetencia}_${Date.now()}.pdf`;
      doc.save(nomeArquivo);

      console.log(`✅ Relatório PDF gerado: ${nomeArquivo}`);
      toast.success('Relatório PDF gerado com sucesso!', { duration: 3000 });

      return true;
    } catch (error) {
      console.error('❌ Erro ao gerar PDF:', error);
      toast.error('Erro ao gerar relatório PDF');
      return false;
    }
  };

  // Função para reapresentar AIHs selecionadas na próxima competência
  const reapresentarAIHsNaProximaCompetencia = async () => {
    if (aihsSelecionadas.size === 0) {
      toast.error('Nenhuma AIH selecionada');
      return;
    }

    const proximaCompetencia = calcularProximaCompetencia(competenciaAIHSelecionada);
    
    if (!proximaCompetencia) {
      toast.error('Erro ao calcular próxima competência');
      return;
    }

    const confirmar = window.confirm(
      `Deseja reapresentar ${aihsSelecionadas.size} AIH(s) na competência ${formatarCompetencia(proximaCompetencia)}?\n\n` +
      `Competência atual: ${formatarCompetencia(competenciaAIHSelecionada)}\n` +
      `Próxima competência: ${formatarCompetencia(proximaCompetencia)}\n\n` +
      `Esta ação irá atualizar a competência dessas AIHs no sistema.`
    );

    if (!confirmar) return;

    setProcessandoReapresentacao(true);

    try {
      console.log(`🔄 Reapresentando ${aihsSelecionadas.size} AIHs...`);
      console.log(`   Competência atual: ${competenciaAIHSelecionada}`);
      console.log(`   Próxima competência: ${proximaCompetencia}`);
      
      const aihsArray = Array.from(aihsSelecionadas);

      // 📄 GERAR RELATÓRIO PDF ANTES DE ATUALIZAR
      if (resultadoSync) {
        // Buscar nome do hospital
        const hospitalSelecionado = hospitaisAIHAvancado.find(h => h.id === hospitalAIHSelecionado);
        const nomeHospital = hospitalSelecionado?.name || 'Hospital não identificado';

        const pdfGerado = gerarRelatorioPDFReapresentacao(
          aihsArray,
          resultadoSync.detalhes,
          competenciaAIHSelecionada,
          proximaCompetencia,
          nomeHospital
        );

        if (!pdfGerado) {
          console.warn('⚠️ PDF não foi gerado, mas continuando com a reapresentação...');
        }
      }
      
      // Atualizar em lote na tabela aihs
      const { data, error } = await supabase
        .from('aihs')
        .update({ competencia: proximaCompetencia })
        .in('aih_number', aihsArray)
        .eq('hospital_id', hospitalAIHSelecionado)
        .select();

      if (error) {
        console.error('❌ Erro ao atualizar competências:', error);
        toast.error('Erro ao reapresentar AIHs: ' + error.message);
        return;
      }

      console.log(`✅ ${data?.length || 0} AIHs atualizadas com sucesso`);
      
      toast.success(
        `${aihsSelecionadas.size} AIH(s) reapresentada(s) com sucesso para ${formatarCompetencia(proximaCompetencia)}!`,
        {
          duration: 5000,
        }
      );

      // Limpar seleções
      setAihsSelecionadas(new Set());

      // Recarregar dados da Etapa 1 para refletir as mudanças
      await buscarAIHs();

    } catch (error: any) {
      console.error('❌ Erro inesperado:', error);
      toast.error('Erro inesperado ao reapresentar AIHs');
    } finally {
      setProcessandoReapresentacao(false);
    }
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
        .select('aih_number, patient_id, admission_date, competencia, created_at, total_procedures, procedure_requested, calculated_total_value')
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
        const exemplos = aihsFiltradas.slice(0, 3).map(a => ({
          aih_number: a.aih_number,
          total_procedures: a.total_procedures,
          procedure_requested: a.procedure_requested,
          calculated_total_value: a.calculated_total_value
        }));
        console.log('📋 Exemplos de AIHs com dados:', exemplos);
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
      
      // Exemplos de normalização e dados
      if (mapAIHAvancado.size > 0) {
        const primeiraAih = Array.from(mapAIHAvancado.entries())[0];
        console.log('   Exemplo de AIH no mapa:', {
          numero_normalizado: primeiraAih[0],
          dados: {
            aih_number: primeiraAih[1]?.aih_number,
            total_procedures: primeiraAih[1]?.total_procedures,
            procedure_requested: primeiraAih[1]?.procedure_requested,
            calculated_total_value: primeiraAih[1]?.calculated_total_value
          }
        });
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
        
        // Log do primeiro sincronizado para debug
        if (status === 'sincronizado' && sincronizados === 1) {
          console.log('🔍 Primeiro registro sincronizado (debug):', {
            numero_aih: numeroNormalizado,
            aih_avancado_dados: {
              total_procedures: aihAvancado?.total_procedures,
              procedure_requested: aihAvancado?.procedure_requested,
              calculated_total_value_centavos: aihAvancado?.calculated_total_value,
              calculated_total_value_reais: aihAvancado?.calculated_total_value / 100
            },
            sisaih01_dados: {
              nome_paciente: sisaih01?.nome_paciente,
              data_internacao: sisaih01?.data_internacao
            }
          });
        }
      });

      console.log('\n📊 RESULTADO DA SINCRONIZAÇÃO:');
      console.log(`   ✅ Sincronizados: ${sincronizados}`);
      console.log(`   ⏳ Pendentes Confirmação: ${pendentes}`);
      console.log(`   ❌ Não Processados: ${naoProcessados}`);
      console.log(`   📈 Taxa de Sincronização: ${mapSISAIH01.size > 0 ? ((sincronizados / mapSISAIH01.size) * 100).toFixed(2) : 0}%`);

      // 🔍 BUSCAR DESCRIÇÕES DOS PROCEDIMENTOS (TODOS OS STATUS)
      console.log('🔍 Buscando descrições dos procedimentos de TODAS as AIHs...');
      
      // Pegar códigos de TODOS os registros (sincronizados, pendentes e não processados)
      const codigosProcedimentos = [...new Set(
        detalhes
          .filter(d => d.aih_avancado?.procedure_requested)
          .map(d => d.aih_avancado.procedure_requested)
      )];

      if (codigosProcedimentos.length > 0) {
        console.log(`📋 Buscando ${codigosProcedimentos.length} procedimentos únicos...`);
        console.log('📋 Exemplos de códigos (formato original):', codigosProcedimentos.slice(0, 5));
        
        // Criar lista de códigos normalizados (sem formatação)
        const codigosNormalizados = [...new Set(
          codigosProcedimentos.map(c => c.replace(/[.\-\s]/g, '')) // Remove pontos, traços e espaços
        )];
        
        console.log('📋 Exemplos de códigos normalizados:', codigosNormalizados.slice(0, 5));
        
        // Buscar procedimentos usando códigos normalizados
        const { data: procedimentos, error: errorProc } = await supabase
          .from('sigtap_procedures')
          .select('code, description')
          .or(`code.in.(${codigosProcedimentos.map(c => `"${c}"`).join(',')}),code.in.(${codigosNormalizados.map(c => `"${c}"`).join(',')})`);

        if (errorProc) {
          console.warn('⚠️ Erro ao buscar procedimentos do SIGTAP:', errorProc);
          
          // Tentar busca alternativa usando LIKE
          console.log('💡 Tentando busca alternativa...');
          const { data: procAlt } = await supabase
            .from('sigtap_procedures')
            .select('code, description')
            .limit(1000);
          
          if (procAlt && procAlt.length > 0) {
            console.log(`📋 Buscou ${procAlt.length} procedimentos para match manual`);
            
            // Criar mapa normalizado
            const mapProcedimentos = new Map<string, string>();
            procAlt.forEach(proc => {
              if (proc.code && proc.description) {
                const codigoNorm = proc.code.replace(/[.\-\s]/g, '');
                mapProcedimentos.set(codigoNorm, proc.description);
                mapProcedimentos.set(proc.code, proc.description); // Também guardar original
              }
            });
            
            // Enriquecer detalhes
            let encontrados = 0;
            detalhes.forEach(detalhe => {
              if (detalhe.aih_avancado?.procedure_requested) {
                const codigoOriginal = detalhe.aih_avancado.procedure_requested;
                const codigoNorm = codigoOriginal.replace(/[.\-\s]/g, '');
                
                const descricao = mapProcedimentos.get(codigoOriginal) || mapProcedimentos.get(codigoNorm);
                if (descricao) {
                  detalhe.procedure_description = descricao;
                  encontrados++;
                }
              }
            });
            
            console.log(`✅ ${encontrados} de ${codigosProcedimentos.length} procedimentos encontrados (busca alternativa)`);
          }
          
        } else if (procedimentos && procedimentos.length > 0) {
          console.log(`✅ ${procedimentos.length} procedimentos encontrados no SIGTAP`);
          console.log('📋 Exemplos encontrados:', procedimentos.slice(0, 3).map(p => ({ code: p.code, desc: p.description?.substring(0, 50) + '...' })));
          
          // Criar mapa COMPLETO de código → descrição (múltiplos formatos)
          const mapProcedimentos = new Map<string, string>();
          procedimentos.forEach(proc => {
            if (proc.code && proc.description) {
              // Formato 1: Original (ex: 03.01.06.007-9)
              mapProcedimentos.set(proc.code, proc.description);
              mapProcedimentos.set(proc.code.toUpperCase(), proc.description);
              mapProcedimentos.set(proc.code.toLowerCase(), proc.description);
              
              // Formato 2: Sem pontos (ex: 03010600079)
              const semPontos = proc.code.replace(/\./g, '');
              mapProcedimentos.set(semPontos, proc.description);
              
              // Formato 3: Sem pontos e sem traço (ex: 030106000079)
              const normalizado = proc.code.replace(/[.\-\s]/g, '');
              mapProcedimentos.set(normalizado, proc.description);
              
              // Formato 4: Apenas números
              const apenasNumeros = proc.code.replace(/\D/g, '');
              mapProcedimentos.set(apenasNumeros, proc.description);
            }
          });

          console.log(`📊 Mapa de procedimentos criado com ${mapProcedimentos.size} variações de código`);

          // Enriquecer TODOS os detalhes com descrição do procedimento
          let encontrados = 0;
          let naoEncontrados = 0;
          
          detalhes.forEach(detalhe => {
            if (detalhe.aih_avancado?.procedure_requested) {
              const codigoOriginal = detalhe.aih_avancado.procedure_requested;
              
              // Tentar encontrar em TODAS as variações
              let descricao = 
                mapProcedimentos.get(codigoOriginal) || // Original
                mapProcedimentos.get(codigoOriginal.toUpperCase()) || // Upper
                mapProcedimentos.get(codigoOriginal.toLowerCase()) || // Lower
                mapProcedimentos.get(codigoOriginal.replace(/\./g, '')) || // Sem pontos
                mapProcedimentos.get(codigoOriginal.replace(/[.\-\s]/g, '')) || // Normalizado
                mapProcedimentos.get(codigoOriginal.replace(/\D/g, '')); // Apenas números
              
              if (descricao) {
                detalhe.procedure_description = descricao;
                encontrados++;
                if (encontrados <= 3) {
                  console.log(`   ✅ ${codigoOriginal} → ${descricao.substring(0, 50)}...`);
                }
              } else {
                naoEncontrados++;
                if (naoEncontrados <= 3) {
                  console.warn(`   ⚠️ Não encontrado: ${codigoOriginal} (testadas ${mapProcedimentos.size / procedimentos.length} variações)`);
                }
              }
            }
          });

          const totalComProcedimento = detalhes.filter(d => d.aih_avancado?.procedure_requested).length;
          console.log(`✅ ${encontrados} de ${totalComProcedimento} procedimentos encontrados`);
          if (naoEncontrados > 0) {
            console.warn(`⚠️ ${naoEncontrados} procedimentos não encontrados no SIGTAP`);
          }
        } else {
          console.warn('⚠️ Nenhum procedimento encontrado na tabela sigtap_procedures');
          console.log('💡 Verificando formato dos códigos no banco de dados...');
          
          const { data: amostra } = await supabase
            .from('sigtap_procedures')
            .select('code, description')
            .limit(10);
          
          if (amostra && amostra.length > 0) {
            console.log('📋 Exemplos na tabela sigtap_procedures:');
            amostra.forEach(p => console.log(`   - ${p.code}: ${p.description?.substring(0, 60)}...`));
          }
        }
      }

      // 🆕 BUSCAR NOMES DOS PACIENTES
      console.log('🔍 Buscando nomes dos pacientes...');
      
      // 1. Para AIHs Pendentes (Etapa 1): buscar na tabela patients
      const patientIds = [...new Set(
        detalhes
          .filter(d => (d.status === 'pendente' || d.status === 'sincronizado') && d.aih_avancado?.patient_id)
          .map(d => d.aih_avancado.patient_id)
      )];

      if (patientIds.length > 0) {
        console.log(`📋 Buscando ${patientIds.length} pacientes únicos na tabela patients...`);
        console.log('📋 Exemplos de IDs:', patientIds.slice(0, 3));
        
        // Validar e limpar IDs
        const validPatientIds = patientIds.filter(id => {
          if (!id) {
            console.warn('⚠️ ID vazio ou null encontrado');
            return false;
          }
          if (typeof id !== 'string') {
            console.warn('⚠️ ID não é string:', typeof id, id);
            return false;
          }
          if (id.length < 10) {
            console.warn('⚠️ ID muito curto (< 10 chars):', id);
            return false;
          }
          return true;
        });

        console.log(`✅ ${validPatientIds.length} IDs válidos de ${patientIds.length} totais`);
        
        if (validPatientIds.length === 0) {
          console.warn('⚠️ Nenhum ID válido para buscar');
        } else {
          // Limitar a 100 IDs por vez para evitar query muito grande
          const batchSize = 100;
          const allPacientes: any[] = [];
          
          for (let i = 0; i < validPatientIds.length; i += batchSize) {
            const batch = validPatientIds.slice(i, i + batchSize);
            console.log(`📋 Buscando batch ${Math.floor(i/batchSize) + 1} com ${batch.length} IDs...`);
            
            const { data: pacientes, error: errorPacientes } = await supabase
              .from('patients')
              .select('id, name')
              .in('id', batch);

            if (errorPacientes) {
              console.error('❌ Erro ao buscar pacientes (batch):', errorPacientes);
              console.error('   Batch com erro:', batch.slice(0, 3));
              console.error('   Detalhes:', JSON.stringify(errorPacientes, null, 2));
            } else if (pacientes && pacientes.length > 0) {
              allPacientes.push(...pacientes);
            }
          }

          const pacientes = allPacientes;

          if (pacientes && pacientes.length > 0) {
          console.log(`✅ ${pacientes.length} pacientes encontrados na tabela patients`);
          console.log('📋 Exemplos encontrados:', pacientes.slice(0, 3).map(p => ({ id: p.id?.substring(0, 8), name: p.name })));
          
          // Criar mapa de patient_id → nome
          const mapPacientes = new Map<string, string>();
          pacientes.forEach(pac => {
            if (pac.id && pac.name) {
              mapPacientes.set(pac.id, pac.name);
              console.log(`   Adicionado ao mapa: ${pac.id.substring(0, 8)}... → ${pac.name}`);
            }
          });

          console.log(`📊 Mapa de pacientes criado com ${mapPacientes.size} entradas`);

          // Enriquecer detalhes com nome do paciente
          let enriquecidos = 0;
          let naoEncontrados = 0;
          detalhes.forEach(detalhe => {
            if (detalhe.aih_avancado?.patient_id) {
              const nome = mapPacientes.get(detalhe.aih_avancado.patient_id);
              if (nome) {
                detalhe.aih_avancado.patient_name = nome;
                enriquecidos++;
                if (enriquecidos <= 3) {
                  console.log(`   ✅ Enriquecido: ${detalhe.aih_avancado.patient_id.substring(0, 8)}... → ${nome}`);
                }
              } else {
                naoEncontrados++;
                if (naoEncontrados <= 3) {
                  console.warn(`   ⚠️ Não encontrado: ${detalhe.aih_avancado.patient_id.substring(0, 8)}...`);
                }
              }
            }
          });

          console.log(`✅ ${enriquecidos} registros enriquecidos com nome de paciente`);
          if (naoEncontrados > 0) {
            console.warn(`⚠️ ${naoEncontrados} patient_ids não encontrados na tabela patients`);
          }
          } else {
            console.warn('⚠️ Nenhum paciente encontrado na tabela patients');
            console.warn('   IDs válidos buscados:', validPatientIds.length);
            console.warn('   Resultado da query:', pacientes);
          }
        }
      } else {
        console.log('ℹ️ Nenhum patient_id para buscar');
      }

      // 2. Para AIHs Não Processadas (Etapa 2): já vem com nome_paciente do SISAIH01
      const comNomeSISAIH01 = detalhes.filter(d => d.sisaih01?.nome_paciente).length;
      console.log(`✅ ${comNomeSISAIH01} registros SISAIH01 já possuem nome do paciente`);

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
    <div className="w-full px-6 py-6 space-y-6">
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

      {/* Informação sobre o fluxo - Esconder se houver resultado */}
      {!resultadoSync && (
        <Alert>
          <Info className="h-4 w-4" />
          <AlertDescription>
            <strong>Etapa 1:</strong> Selecione hospital e competência do AIH Avançado → 
            <strong> Etapa 2:</strong> Selecione hospital e competência do SISAIH01 → 
            <strong> Etapa 3:</strong> Executar sincronização
          </AlertDescription>
        </Alert>
      )}

      {/* ETAPA 1: AIH Avançado - Esconder se houver resultado */}
      {!resultadoSync && (
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
      )}

      {/* ETAPA 2: SISAIH01 - Esconder se houver resultado */}
      {!resultadoSync && (
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
      )}

      {/* ETAPA 3: Executar Sincronização - Esconder se houver resultado */}
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
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="flex items-center gap-2 text-green-900">
                      ✅ AIHs Sincronizadas
                      <span className="text-sm font-normal text-green-600">
                        ({resultadoSync.sincronizados} registros)
                      </span>
                      <span className="text-sm font-semibold text-green-700 ml-auto">
                        Valor Total: {new Intl.NumberFormat('pt-BR', {
                          style: 'currency',
                          currency: 'BRL'
                        }).format(
                          resultadoSync.detalhes
                            .filter(d => d.status === 'sincronizado')
                            .reduce((acc, d) => acc + (d.aih_avancado?.calculated_total_value || 0), 0) / 100
                        )}
                      </span>
                    </CardTitle>
                    <CardDescription className="mt-2">
                      Números das AIHs que foram encontradas em ambas as bases (AIH Avançado e SISAIH01)
                    </CardDescription>
                  </div>
                  <Button
                    onClick={gerarRelatorioPDFSincronizadas}
                    className="bg-green-600 hover:bg-green-700 text-white"
                    size="sm"
                  >
                    <Database className="h-4 w-4 mr-2" />
                    Gerar Relatório PDF
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="pt-6">
                <div className="rounded-lg border border-green-200 overflow-hidden">
                  <div className="max-h-[600px] overflow-y-auto">
                    <Table>
                      <TableHeader className="bg-green-50 sticky top-0">
                        <TableRow>
                          <TableHead className="font-semibold text-green-900 w-12">#</TableHead>
                          <TableHead className="font-semibold text-green-900 w-32">Número AIH</TableHead>
                          <TableHead className="font-semibold text-green-900">Paciente</TableHead>
                          <TableHead className="font-semibold text-green-900 w-28">Data Intern.</TableHead>
                          <TableHead className="font-semibold text-green-900 text-center w-20">Qtd.</TableHead>
                          <TableHead className="font-semibold text-green-900 w-64">Procedimento Principal</TableHead>
                          <TableHead className="font-semibold text-green-900 text-right w-32">Valor Total</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {resultadoSync.detalhes
                          .filter(d => d.status === 'sincronizado')
                          .map((detalhe, index) => (
                            <TableRow key={detalhe.numero_aih} className="hover:bg-green-50/50">
                              <TableCell className="text-gray-600 font-medium text-sm">
                                {index + 1}
                              </TableCell>
                              <TableCell className="w-32">
                                <span className="font-mono text-blue-600 font-medium text-xs">
                                  {detalhe.numero_aih}
                                </span>
                              </TableCell>
                              <TableCell className="text-gray-700 text-sm">
                                {detalhe.aih_avancado?.patient_name || detalhe.sisaih01?.nome_paciente || '-'}
                              </TableCell>
                              <TableCell className="text-gray-600 text-xs w-28">
                                {detalhe.sisaih01?.data_internacao 
                                  ? new Date(detalhe.sisaih01.data_internacao).toLocaleDateString('pt-BR')
                                  : '-'}
                              </TableCell>
                              <TableCell className="text-center w-20">
                                <span className="inline-flex items-center justify-center px-2 py-0.5 rounded-full bg-blue-100 text-blue-800 text-xs font-semibold">
                                  {detalhe.aih_avancado?.total_procedures || 0}
                                </span>
                              </TableCell>
                              <TableCell className="text-gray-700 w-64">
                                {detalhe.procedure_description ? (
                                  <div className="space-y-0.5">
                                    <span className="font-mono text-xs text-blue-600 block">
                                      {detalhe.aih_avancado?.procedure_requested || '-'}
                                    </span>
                                    <span className="text-xs text-gray-600 line-clamp-2">
                                      {detalhe.procedure_description}
                                    </span>
                                  </div>
                                ) : (
                                  <span className="font-mono text-xs">
                                    {detalhe.aih_avancado?.procedure_requested || '-'}
                                  </span>
                                )}
                              </TableCell>
                              <TableCell className="text-right w-32">
                                <span className="font-semibold text-green-700 text-sm">
                                  {detalhe.aih_avancado?.calculated_total_value 
                                    ? new Intl.NumberFormat('pt-BR', {
                                        style: 'currency',
                                        currency: 'BRL'
                                      }).format(detalhe.aih_avancado.calculated_total_value / 100)
                                    : '-'}
                                </span>
                              </TableCell>
                            </TableRow>
                          ))}
                      </TableBody>
                    </Table>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Tabela de AIHs Pendentes (Etapa 1 - AIH Avançado) */}
          {resultadoSync.pendentes > 0 && (
            <Card className="border-2 border-orange-200">
              <CardHeader className="bg-gradient-to-r from-orange-50 to-amber-50">
                <CardTitle className="flex items-center gap-2 text-orange-900">
                  ⏳ AIHs Pendentes de Confirmação SUS
                  <span className="text-sm font-normal text-orange-600">
                    ({resultadoSync.pendentes} registros)
                  </span>
                  <span className="text-sm font-semibold text-orange-700 ml-auto">
                    Valor Total: {new Intl.NumberFormat('pt-BR', {
                      style: 'currency',
                      currency: 'BRL'
                    }).format(
                      resultadoSync.detalhes
                        .filter(d => d.status === 'pendente')
                        .reduce((acc, d) => acc + (d.aih_avancado?.calculated_total_value || 0), 0) / 100
                    )}
                  </span>
                </CardTitle>
                <CardDescription>
                  AIHs que estão apenas no AIH Avançado (Etapa 1), aguardando confirmação pelo SUS no SISAIH01
                </CardDescription>
              </CardHeader>
              <CardContent className="pt-6">
                {/* Barra de ações para reapresentação */}
                <div className="mb-4 flex items-center justify-between p-4 bg-orange-50 rounded-lg border border-orange-200">
                  <div className="flex items-center gap-4">
                    <div className="text-sm text-orange-900">
                      <strong>{aihsSelecionadas.size}</strong> AIH(s) selecionada(s)
                    </div>
                    {aihsSelecionadas.size > 0 && (
                      <div className="text-xs text-orange-700">
                        → Próxima competência: <strong>{formatarCompetencia(calcularProximaCompetencia(competenciaAIHSelecionada))}</strong>
                      </div>
                    )}
                  </div>
                  <Button
                    onClick={reapresentarAIHsNaProximaCompetencia}
                    disabled={aihsSelecionadas.size === 0 || processandoReapresentacao}
                    className="bg-orange-600 hover:bg-orange-700 text-white"
                  >
                    {processandoReapresentacao ? (
                      <>
                        <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                        Processando...
                      </>
                    ) : (
                      <>
                        <RefreshCw className="h-4 w-4 mr-2" />
                        Reapresentar na Próxima Competência
                      </>
                    )}
                  </Button>
                </div>

                <div className="rounded-lg border border-orange-200 overflow-hidden">
                  <div className="max-h-[600px] overflow-y-auto">
                    <Table>
                      <TableHeader className="bg-orange-50 sticky top-0">
                        <TableRow>
                          <TableHead className="font-semibold text-orange-900 w-16 text-center">
                            <input
                              type="checkbox"
                              checked={resultadoSync.detalhes.filter(d => d.status === 'pendente').length > 0 && aihsSelecionadas.size === resultadoSync.detalhes.filter(d => d.status === 'pendente').length}
                              onChange={toggleSelecionarTodas}
                              className="cursor-pointer w-4 h-4"
                              title="Selecionar todas"
                            />
                          </TableHead>
                          <TableHead className="font-semibold text-orange-900 w-12">#</TableHead>
                          <TableHead className="font-semibold text-orange-900 w-32">Número AIH</TableHead>
                          <TableHead className="font-semibold text-orange-900">Paciente</TableHead>
                          <TableHead className="font-semibold text-orange-900 w-28">Data Intern.</TableHead>
                          <TableHead className="font-semibold text-orange-900 text-center w-20">Qtd.</TableHead>
                          <TableHead className="font-semibold text-orange-900 w-64">Procedimento Principal</TableHead>
                          <TableHead className="font-semibold text-orange-900 text-right w-32">Valor Total</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {resultadoSync.detalhes
                          .filter(d => d.status === 'pendente')
                          .map((detalhe, index) => (
                            <TableRow key={detalhe.numero_aih} className="hover:bg-orange-50/50">
                              <TableCell className="text-center w-16">
                                <input
                                  type="checkbox"
                                  checked={aihsSelecionadas.has(detalhe.numero_aih)}
                                  onChange={() => toggleSelecaoAIH(detalhe.numero_aih)}
                                  className="cursor-pointer w-4 h-4"
                                />
                              </TableCell>
                              <TableCell className="text-gray-600 font-medium text-sm">
                                {index + 1}
                              </TableCell>
                              <TableCell className="w-32">
                                <div className="space-y-1">
                                  <span className="font-mono text-blue-600 font-medium text-xs block">
                                    {detalhe.numero_aih}
                                  </span>
                                  <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-blue-100 text-blue-800">
                                    Etapa 1
                                  </span>
                                </div>
                              </TableCell>
                              <TableCell className="text-gray-700 text-sm">
                                {detalhe.aih_avancado?.patient_name || (
                                  detalhe.aih_avancado?.patient_id ? (
                                    <span className="text-gray-500 italic text-xs">
                                      ID: {detalhe.aih_avancado.patient_id.substring(0, 8)}...
                                    </span>
                                  ) : '-'
                                )}
                              </TableCell>
                              <TableCell className="text-gray-600 text-xs w-28">
                                {detalhe.aih_avancado?.admission_date 
                                  ? new Date(detalhe.aih_avancado.admission_date).toLocaleDateString('pt-BR')
                                  : '-'}
                              </TableCell>
                              <TableCell className="text-center w-20">
                                <span className="inline-flex items-center justify-center px-2 py-0.5 rounded-full bg-blue-100 text-blue-800 text-xs font-semibold">
                                  {detalhe.aih_avancado?.total_procedures || 0}
                                </span>
                              </TableCell>
                              <TableCell className="text-gray-700 w-64">
                                {detalhe.procedure_description ? (
                                  <div className="space-y-0.5">
                                    <span className="font-mono text-xs text-blue-600 block">
                                      {detalhe.aih_avancado?.procedure_requested || '-'}
                                    </span>
                                    <span className="text-xs text-gray-600 line-clamp-2">
                                      {detalhe.procedure_description}
                                    </span>
                                  </div>
                                ) : (
                                  <span className="font-mono text-xs">
                                    {detalhe.aih_avancado?.procedure_requested || '-'}
                                  </span>
                                )}
                              </TableCell>
                              <TableCell className="text-right w-32">
                                <span className="font-semibold text-orange-700 text-sm">
                                  {detalhe.aih_avancado?.calculated_total_value 
                                    ? new Intl.NumberFormat('pt-BR', {
                                        style: 'currency',
                                        currency: 'BRL'
                                      }).format(detalhe.aih_avancado.calculated_total_value / 100)
                                    : '-'}
                                </span>
                              </TableCell>
                            </TableRow>
                          ))}
                      </TableBody>
                    </Table>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Tabela de AIHs Não Processadas (Etapa 2 - SISAIH01) */}
          {resultadoSync.naoProcessados > 0 && (
            <Card className="border-2 border-red-200">
              <CardHeader className="bg-gradient-to-r from-red-50 to-rose-50">
                <CardTitle className="flex items-center gap-2 text-red-900">
                  ❌ AIHs Não Processadas no Sistema
                  <span className="text-sm font-normal text-red-600">
                    ({resultadoSync.naoProcessados} registros)
                  </span>
                </CardTitle>
                <CardDescription>
                  AIHs que estão apenas no SISAIH01 (Etapa 2), confirmadas pelo SUS mas faltam no sistema interno
                </CardDescription>
              </CardHeader>
              <CardContent className="pt-6">
                <div className="rounded-lg border border-red-200 overflow-hidden">
                  <div className="max-h-[600px] overflow-y-auto">
                    <Table>
                      <TableHeader className="bg-red-50 sticky top-0">
                        <TableRow>
                          <TableHead className="font-semibold text-red-900 w-12">#</TableHead>
                          <TableHead className="font-semibold text-red-900 w-32">Número AIH</TableHead>
                          <TableHead className="font-semibold text-red-900">Paciente</TableHead>
                          <TableHead className="font-semibold text-red-900 w-28">Data Intern.</TableHead>
                          <TableHead className="font-semibold text-red-900 text-center w-20">Qtd.</TableHead>
                          <TableHead className="font-semibold text-red-900 w-64">Procedimento Principal</TableHead>
                          <TableHead className="font-semibold text-red-900 text-right w-32">Valor Total</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {resultadoSync.detalhes
                          .filter(d => d.status === 'nao_processado')
                          .map((detalhe, index) => (
                            <TableRow key={detalhe.numero_aih} className="hover:bg-red-50/50">
                              <TableCell className="text-gray-600 font-medium text-sm">
                                {index + 1}
                              </TableCell>
                              <TableCell className="w-32">
                                <div className="space-y-1">
                                  <span className="font-mono text-blue-600 font-medium text-xs block">
                                    {detalhe.numero_aih}
                                  </span>
                                  <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-purple-100 text-purple-800">
                                    Etapa 2
                                  </span>
                                </div>
                              </TableCell>
                              <TableCell className="text-gray-700 text-sm">
                                {detalhe.sisaih01?.nome_paciente || '-'}
                              </TableCell>
                              <TableCell className="text-gray-600 text-xs w-28">
                                {detalhe.sisaih01?.data_internacao 
                                  ? new Date(detalhe.sisaih01.data_internacao).toLocaleDateString('pt-BR')
                                  : '-'}
                              </TableCell>
                              <TableCell className="text-center w-20">
                                <span className="inline-flex items-center justify-center px-2 py-0.5 rounded-full bg-gray-100 text-gray-800 text-xs font-semibold">
                                  -
                                </span>
                              </TableCell>
                              <TableCell className="text-gray-700 w-64">
                                <span className="text-xs text-gray-500 italic">
                                  Dados de procedimento não disponíveis no SISAIH01
                                </span>
                              </TableCell>
                              <TableCell className="text-right w-32">
                                <span className="font-semibold text-gray-500 text-sm">
                                  -
                                </span>
                              </TableCell>
                            </TableRow>
                          ))}
                      </TableBody>
                    </Table>
                  </div>
                </div>
                
                <div className="mt-4 pt-4 border-t border-gray-200">
                  <div className="text-center md:text-left">
                    <p className="text-sm text-gray-600">
                      Total de Registros: <strong className="text-red-700">{resultadoSync.naoProcessados}</strong>
                    </p>
                    <p className="text-xs text-gray-500 mt-1">
                      ⚠️ Estas AIHs precisam ser cadastradas no sistema interno para sincronização completa
                    </p>
                  </div>
                </div>
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

          {/* Botão para refazer - Abaixo da tabela */}
          <div className="flex justify-center pt-6 pb-4">
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
              className="shadow-lg hover:shadow-xl transition-all"
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

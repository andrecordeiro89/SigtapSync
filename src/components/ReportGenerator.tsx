import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Calendar, Download, FileText, Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { format } from 'date-fns';
import { DoctorPatientService, type DoctorWithPatients } from '@/services/doctorPatientService';
import { calculateDoctorPayment } from './DoctorPaymentRules';
import { ptBR } from 'date-fns/locale';

interface ReportGeneratorProps {
  onClose?: () => void;
}

interface FinancialData {
  hospital_name: string;
  total_revenue: number;
  total_aihs: number;
  average_ticket: number;
  approval_rate: number;
  period: string;
}

interface DoctorData {
  doctor_name: string;
  specialty: string;
  total_procedures: number;
  total_revenue: number;
  average_value: number;
  hospital_name: string;
}

const ReportGenerator: React.FC<ReportGeneratorProps> = ({ onClose }) => {
  const [reportType, setReportType] = useState<string>('');
  const [period, setPeriod] = useState<string>('30');
  const [isGenerating, setIsGenerating] = useState(false);
  const { toast } = useToast();
  const { user } = useAuth();

  const formatCurrency = (value: number | null | undefined): string => {
    const safeValue = value || 0;
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(safeValue);
  };

  const formatNumber = (value: number | null | undefined): string => {
    const safeValue = value || 0;
    return new Intl.NumberFormat('pt-BR').format(safeValue);
  };

  const formatPercentage = (value: number | null | undefined): string => {
    const safeValue = value || 0;
    return `${safeValue.toFixed(1)}%`;
  };

  const generateFinancialReport = async (): Promise<void> => {
    try {
      setIsGenerating(true);

      // Buscar dados financeiros
      const { data: hospitalStats, error: hospitalError } = await supabase
        .from('v_hospital_revenue_stats')
        .select('*');

      if (hospitalError) {
        console.error('Erro ao buscar dados hospitalares:', hospitalError);
        throw new Error('Erro ao buscar dados hospitalares');
      }

      // Buscar dados de AIHs para cálculos adicionais
      const { data: aihsData, error: aihsError } = await supabase
        .from('aihs')
        .select(`
          id,
          calculated_total_value,
          original_value,
          processing_status,
          created_at,
          hospital_id,
          hospitals!inner(name)
        `)
        .gte('created_at', new Date(Date.now() - parseInt(period) * 24 * 60 * 60 * 1000).toISOString());

      if (aihsError) {
        console.error('Erro ao buscar AIHs:', aihsError);
        throw new Error('Erro ao buscar dados de AIHs');
      }

      // Processar dados para o relatório
      const financialData: FinancialData[] = [];
      
      if (hospitalStats && hospitalStats.length > 0) {
        hospitalStats.forEach(hospital => {
          const hospitalAihs = aihsData?.filter(aih => 
            aih.hospitals && aih.hospitals[0]?.name === hospital.hospital_name
          ) || [];
          
          const totalRevenue = hospitalAihs.reduce((sum, aih) => {
            const value = aih.calculated_total_value || aih.original_value || 0;
            return sum + (value > 1000000 ? value / 100 : value); // Converter de centavos se necessário
          }, 0);
          const approvedAihs = hospitalAihs.filter(aih => aih.processing_status === 'matched').length;
          const approvalRate = hospitalAihs.length > 0 ? (approvedAihs / hospitalAihs.length) * 100 : 0;
          
          financialData.push({
            hospital_name: hospital.hospital_name || 'Hospital não identificado',
            total_revenue: totalRevenue,
            total_aihs: hospitalAihs.length,
            average_ticket: hospitalAihs.length > 0 ? totalRevenue / hospitalAihs.length : 0,
            approval_rate: approvalRate,
            period: `${period} dias`
          });
        });
      }

      // Gerar PDF
      const doc = new jsPDF();
      
      // Configurar fonte
      doc.setFont('helvetica');
      
      // Cabeçalho
      doc.setFontSize(20);
      doc.setTextColor(40, 40, 40);
      doc.text('RELATÓRIO FINANCEIRO', 20, 25);
      
      doc.setFontSize(12);
      doc.setTextColor(100, 100, 100);
      doc.text(`Período: Últimos ${period} dias`, 20, 35);
      doc.text(`Gerado em: ${format(new Date(), 'dd/MM/yyyy HH:mm', { locale: ptBR })}`, 20, 42);
      doc.text(`Usuário: ${user?.email || 'N/A'}`, 20, 49);
      
      // Linha separadora
      doc.setDrawColor(200, 200, 200);
      doc.line(20, 55, 190, 55);
      
      // Resumo executivo
      const totalRevenue = financialData.reduce((sum, item) => sum + (item?.total_revenue || 0), 0);
      const totalAihs = financialData.reduce((sum, item) => sum + (item?.total_aihs || 0), 0);
      const avgTicket = totalAihs > 0 ? totalRevenue / totalAihs : 0;
      const avgApprovalRate = financialData.length > 0 
        ? financialData.reduce((sum, item) => sum + (item?.approval_rate || 0), 0) / financialData.length 
        : 0;
      
      doc.setFontSize(14);
      doc.setTextColor(40, 40, 40);
      doc.text('RESUMO EXECUTIVO', 20, 70);
      
      doc.setFontSize(10);
      doc.setTextColor(60, 60, 60);
      doc.text(`Receita Total: ${formatCurrency(totalRevenue)}`, 20, 82);
      doc.text(`Total de AIHs: ${formatNumber(totalAihs)}`, 20, 90);
      doc.text(`Ticket Médio: ${formatCurrency(avgTicket)}`, 20, 98);
      doc.text(`Taxa de Aprovação Média: ${formatPercentage(avgApprovalRate)}`, 20, 106);
      
      // Tabela detalhada
      const tableData = financialData.map(item => [
        item?.hospital_name || 'Hospital não informado',
        formatCurrency(item?.total_revenue),
        formatNumber(item?.total_aihs),
        formatCurrency(item?.average_ticket),
        formatPercentage(item?.approval_rate)
      ]);
      
      autoTable(doc, {
        startY: 120,
        head: [[
          'Hospital',
          'Receita Total',
          'Total AIHs',
          'Ticket Médio',
          'Taxa Aprovação'
        ]],
        body: tableData,
        theme: 'grid',
        styles: {
          fontSize: 9,
          cellPadding: 3
        },
        headStyles: {
          fillColor: [41, 128, 185],
          textColor: 255,
          fontStyle: 'bold'
        },
        alternateRowStyles: {
          fillColor: [245, 245, 245]
        }
      });
      
      // Rodapé
      const pageCount = doc.getNumberOfPages();
      for (let i = 1; i <= pageCount; i++) {
        doc.setPage(i);
        doc.setFontSize(8);
        doc.setTextColor(150, 150, 150);
        doc.text(
          `SIGTAP Billing Wizard v3.0 - Página ${i} de ${pageCount}`,
          20,
          doc.internal.pageSize.height - 10
        );
      }
      
      // Salvar PDF
      const fileName = `relatorio-financeiro-${format(new Date(), 'yyyy-MM-dd-HHmm')}.pdf`;
      doc.save(fileName);
      
      toast({
        title: "Relatório gerado com sucesso!",
        description: `O arquivo ${fileName} foi baixado.`,
      });
      
    } catch (error) {
      console.error('Erro ao gerar relatório:', error);
      toast({
        title: "Erro ao gerar relatório",
        description: "Ocorreu um erro ao gerar o relatório. Tente novamente.",
        variant: "destructive",
      });
    } finally {
      setIsGenerating(false);
    }
  };

  const generateDoctorsReport = async (): Promise<void> => {
    try {
      setIsGenerating(true);

      // Buscar dados dos médicos
    const { data: doctorsData, error: doctorsError } = await supabase
      .from('v_doctors_aggregated')
      .select('*');

      if (doctorsError) {
        console.error('Erro ao buscar dados dos médicos:', doctorsError);
        throw new Error('Erro ao buscar dados dos médicos');
      }

      // Processar dados para o relatório
      const doctorReportData: any[] = [];
      
      if (doctorsData && doctorsData.length > 0) {
        doctorsData.forEach(doctor => {
          if (doctor) {
            const totalProcedures = doctor.total_procedures_12months || 0;
            const totalRevenue = doctor.total_revenue_12months_reais || 0;
            doctorReportData.push({
              doctor_name: doctor.doctor_name || 'Nome não informado',
              specialty: doctor.doctor_specialty || 'Especialidade não informada',
              total_procedures: totalProcedures,
              total_revenue: totalRevenue,
              average_value: totalProcedures > 0 ? totalRevenue / totalProcedures : 0,
              hospital_name: doctor.primary_hospital_name || doctor.hospitals_list || 'Hospital não informado'
            });
          }
        });
      }

      // Gerar PDF
      const doc = new jsPDF();
      
      // Cabeçalho
      doc.setFont('helvetica');
      doc.setFontSize(20);
      doc.setTextColor(40, 40, 40);
      doc.text('RELATÓRIO DE MÉDICOS', 20, 25);
      
      doc.setFontSize(12);
      doc.setTextColor(100, 100, 100);
      doc.text(`Período: Últimos ${period} dias`, 20, 35);
      doc.text(`Gerado em: ${format(new Date(), 'dd/MM/yyyy HH:mm', { locale: ptBR })}`, 20, 42);
      doc.text(`Usuário: ${user?.email || 'N/A'}`, 20, 49);
      
      // Linha separadora
      doc.setDrawColor(200, 200, 200);
      doc.line(20, 55, 190, 55);
      
      // Resumo
      const totalDoctors = doctorReportData.length;
      const totalRevenue = doctorReportData.reduce((sum, item) => sum + (item?.total_revenue || 0), 0);
      const totalProcedures = doctorReportData.reduce((sum, item) => sum + (item?.total_procedures || 0), 0);
      const averageRevenue = totalDoctors > 0 ? totalRevenue / totalDoctors : 0;
      
      doc.setFontSize(14);
      doc.setTextColor(40, 40, 40);
      doc.text('RESUMO EXECUTIVO', 20, 70);
      
      doc.setFontSize(10);
      doc.setTextColor(60, 60, 60);
      doc.text(`Total de Médicos: ${formatNumber(totalDoctors)}`, 20, 82);
      doc.text(`Receita Total: ${formatCurrency(totalRevenue)}`, 20, 90);
      doc.text(`Total de Procedimentos: ${formatNumber(totalProcedures)}`, 20, 98);
      
      // Tabela
      const tableData = doctorReportData.map(item => [
        item?.doctor_name || 'Nome não informado',
        item?.specialty || 'Especialidade não informada',
        item?.hospital_name || 'Hospital não informado',
        formatNumber(item?.total_procedures),
        formatCurrency(item?.total_revenue),
        formatCurrency(item?.average_value)
      ]);
      
      autoTable(doc, {
        startY: 110,
        head: [[
          'Médico',
          'Especialidade',
          'Hospital',
          'Procedimentos',
          'Receita Total',
          'Valor Médio'
        ]],
        body: tableData,
        theme: 'grid',
        styles: {
          fontSize: 8,
          cellPadding: 2
        },
        headStyles: {
          fillColor: [52, 152, 219],
          textColor: 255,
          fontStyle: 'bold'
        },
        alternateRowStyles: {
          fillColor: [245, 245, 245]
        }
      });
      
      // Rodapé
      const pageCount = doc.getNumberOfPages();
      for (let i = 1; i <= pageCount; i++) {
        doc.setPage(i);
        doc.setFontSize(8);
        doc.setTextColor(150, 150, 150);
        doc.text(
          `SIGTAP Billing Wizard v3.0 - Página ${i} de ${pageCount}`,
          20,
          doc.internal.pageSize.height - 10
        );
      }
      
      // Salvar PDF
      const fileName = `relatorio-medicos-${format(new Date(), 'yyyy-MM-dd-HHmm')}.pdf`;
      doc.save(fileName);
      
      toast({
        title: "Relatório gerado com sucesso!",
        description: `O arquivo ${fileName} foi baixado.`,
      });
      
    } catch (error) {
      console.error('Erro ao gerar relatório:', error);
      toast({
        title: "Erro ao gerar relatório",
        description: "Ocorreu um erro ao gerar o relatório. Tente novamente.",
        variant: "destructive",
      });
    } finally {
      setIsGenerating(false);
    }
  };

  const generateHospitalReport = async (): Promise<void> => {
    try {
      setIsGenerating(true);

      // Buscar dados dos hospitais
      const { data: hospitalsData, error: hospitalsError } = await supabase
        .from('hospitals')
        .select('*');

      if (hospitalsError) {
        console.error('Erro ao buscar dados dos hospitais:', hospitalsError);
        throw new Error('Erro ao buscar dados dos hospitais');
      }

      // Buscar estatísticas dos hospitais
      const { data: statsData, error: statsError } = await supabase
        .from('v_aih_stats_by_hospital')
        .select('*');

      if (statsError) {
        console.error('Erro ao buscar estatísticas:', statsError);
      }

      // Gerar PDF
      const doc = new jsPDF();
      
      // Cabeçalho
      doc.setFont('helvetica');
      doc.setFontSize(20);
      doc.setTextColor(40, 40, 40);
      doc.text('RELATÓRIO HOSPITALAR', 20, 25);
      
      doc.setFontSize(12);
      doc.setTextColor(100, 100, 100);
      doc.text(`Gerado em: ${format(new Date(), 'dd/MM/yyyy HH:mm', { locale: ptBR })}`, 20, 35);
      doc.text(`Usuário: ${user?.email || 'N/A'}`, 20, 42);
      
      // Linha separadora
      doc.setDrawColor(200, 200, 200);
      doc.line(20, 55, 190, 55);
      
      // Tabela de hospitais
      const tableData = hospitalsData?.map(hospital => {
        const stats = statsData?.find(s => s && s.hospital_id === hospital?.id);
        return [
          hospital?.name || 'Nome não informado',
          hospital?.cnpj || 'CNPJ não informado',
          hospital?.city || 'Cidade não informada',
          hospital?.state || 'Estado não informado',
          formatNumber(stats?.total_aihs),
          formatPercentage(stats?.match_rate)
        ];
      }) || [];
      
      autoTable(doc, {
        startY: 70,
        head: [[
          'Hospital',
          'CNPJ',
          'Cidade',
          'Estado',
          'Total AIHs',
          'Taxa de Match'
        ]],
        body: tableData,
        theme: 'grid',
        styles: {
          fontSize: 9,
          cellPadding: 3
        },
        headStyles: {
          fillColor: [155, 89, 182],
          textColor: 255,
          fontStyle: 'bold'
        },
        alternateRowStyles: {
          fillColor: [245, 245, 245]
        }
      });
      
      // Rodapé
      const pageCount = doc.getNumberOfPages();
      for (let i = 1; i <= pageCount; i++) {
        doc.setPage(i);
        doc.setFontSize(8);
        doc.setTextColor(150, 150, 150);
        doc.text(
          `SIGTAP Billing Wizard v3.0 - Página ${i} de ${pageCount}`,
          20,
          doc.internal.pageSize.height - 10
        );
      }
      
      // Salvar PDF
      const fileName = `relatorio-hospitalar-${format(new Date(), 'yyyy-MM-dd-HHmm')}.pdf`;
      doc.save(fileName);
      
      toast({
        title: "Relatório gerado com sucesso!",
        description: `O arquivo ${fileName} foi baixado.`,
      });
      
    } catch (error) {
      console.error('Erro ao gerar relatório:', error);
      toast({
        title: "Erro ao gerar relatório",
        description: "Ocorreu um erro ao gerar o relatório. Tente novamente.",
        variant: "destructive",
      });
    } finally {
      setIsGenerating(false);
    }
  };

  // Função para calcular estatísticas do médico (mesma lógica da tela de Médicos)
  const calculateDoctorStats = (doctorData: DoctorWithPatients) => {
    const totalProcedures = doctorData.patients.reduce((sum, patient) => sum + patient.procedures.length, 0);
    const totalValue = doctorData.patients.reduce((sum, patient) => sum + patient.total_value_reais, 0);
    const totalAIHs = doctorData.patients.length;
    const avgTicket = totalAIHs > 0 ? totalValue / totalAIHs : 0;
    
    // Calcular procedimentos médicos (código '04')
    const medicalProcedures = doctorData.patients.flatMap(patient => 
      patient.procedures.filter(proc => proc.procedure_code && proc.procedure_code.startsWith('04'))
    );
    
    const medicalProceduresCount = medicalProcedures.length;
    const medicalProceduresValue = medicalProcedures.reduce((sum, proc) => sum + (proc.value_reais || 0), 0);
    
    // Calcular valor de produção usando as regras de pagamento
    const patientMedicalProcedures = medicalProcedures.map(proc => ({
      procedure_code: proc.procedure_code,
      value_reais: proc.value_reais || 0,
      quantity: 1
    }));
    
    const paymentCalculation = calculateDoctorPayment(doctorData.doctor_info.name, patientMedicalProcedures);
    const calculatedPaymentValue = paymentCalculation.totalPayment;
    
    // Taxa de aprovação (assumindo 100% se não houver dados específicos)
    const approvalRate = 100;
    
    return {
      totalProcedures,
      totalValue,
      totalAIHs,
      avgTicket,
      approvalRate,
      medicalProceduresCount,
      medicalProceduresValue,
      calculatedPaymentValue
    };
  };

  // Função para gerar relatório de produção médica
  const generateMedicalProductionReport = async (): Promise<void> => {
    try {
      setIsGenerating(true);
      toast({
        title: "Gerando relatório de produção médica",
        description: "Coletando dados dos médicos...",
      });

      // Buscar dados dos médicos
      const doctorsData = await DoctorPatientService.getAllDoctorsWithPatients();
      
      if (!doctorsData || doctorsData.length === 0) {
        toast({
          title: "Nenhum dado encontrado",
          description: "Não foram encontrados dados de médicos para o relatório.",
          variant: "destructive",
        });
        return;
      }

      // Filtrar dados por período se necessário
      const periodDays = parseInt(period);
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - periodDays);

      const filteredDoctors = doctorsData.map(doctor => ({
        ...doctor,
        patients: doctor.patients.filter(patient => {
          const admissionDate = new Date(patient.aih_info.admission_date);
          return admissionDate >= cutoffDate;
        })
      })).filter(doctor => doctor.patients.length > 0);

      // Calcular estatísticas para cada médico usando a mesma lógica da tela de Médicos
      const doctorStats = filteredDoctors.map(doctor => {
        const stats = calculateDoctorStats(doctor);
        
        // Valor de produção: usar calculatedPaymentValue se disponível, senão usar medicalProceduresValue
        const productionValue = stats.calculatedPaymentValue > 0 
          ? stats.calculatedPaymentValue 
          : stats.medicalProceduresValue;

        return {
          name: doctor.doctor_info.name || 'Nome não informado',
          specialty: doctor.doctor_info.specialty || 'Não informado',
          totalPatients: stats.totalAIHs,
          totalProcedures: stats.totalProcedures,
          totalRevenue: stats.totalValue,
          productionValue
        };
      });

      // Ordenar por receita total (decrescente)
      doctorStats.sort((a, b) => b.totalRevenue - a.totalRevenue);

      // Gerar PDF
      const doc = new jsPDF();
      
      // Cabeçalho
      doc.setFontSize(18);
      doc.text('Relatório de Produção Médica', 20, 20);
      
      doc.setFontSize(12);
      doc.text(`Período: Últimos ${period} dias`, 20, 35);
      doc.text(`Data de geração: ${format(new Date(), 'dd/MM/yyyy HH:mm', { locale: ptBR })}`, 20, 45);
      doc.text(`Usuário: ${user?.email || 'Não identificado'}`, 20, 55);
      
      // Estatísticas gerais
      const totalDoctors = doctorStats.length;
      const totalPatients = doctorStats.reduce((sum, doc) => sum + doc.totalPatients, 0);
      const totalProcedures = doctorStats.reduce((sum, doc) => sum + doc.totalProcedures, 0);
      const totalRevenue = doctorStats.reduce((sum, doc) => sum + doc.totalRevenue, 0);
      const totalProduction = doctorStats.reduce((sum, doc) => sum + doc.productionValue, 0);
      
      doc.setFontSize(14);
      doc.text('Resumo Geral:', 20, 70);
      doc.setFontSize(10);
      doc.text(`Total de Médicos: ${totalDoctors}`, 20, 80);
      doc.text(`Total de Pacientes: ${totalPatients}`, 20, 90);
      doc.text(`Total de Procedimentos: ${totalProcedures}`, 20, 100);
      doc.text(`Valor Total: ${formatCurrency(totalRevenue)}`, 20, 110);
      doc.text(`Valor de Produção: ${formatCurrency(totalProduction)}`, 20, 120);

      // Tabela de dados
      const tableData = doctorStats.map(doctor => [
        doctor.name,
        doctor.specialty,
        doctor.totalPatients.toString(),
        doctor.totalProcedures.toString(),
        formatCurrency(doctor.totalRevenue),
        formatCurrency(doctor.productionValue)
      ]);

      autoTable(doc, {
        head: [[
          'Médico',
          'Especialidades',
          'Pacientes',
          'Procedimentos',
          'Valor Total',
          'Valor de Produção'
        ]],
        body: tableData,
        startY: 135,
        styles: {
          fontSize: 8,
          cellPadding: 2,
        },
        headStyles: {
          fillColor: [255, 165, 0], // Cor laranja
          textColor: [255, 255, 255],
          fontStyle: 'bold',
        },
        columnStyles: {
          4: { halign: 'right' }, // Valor Total
          5: { halign: 'right' }, // Valor de Produção
        },
      });

      // Salvar PDF
      const fileName = `relatorio-producao-medica-${format(new Date(), 'yyyy-MM-dd-HHmm')}.pdf`;
      doc.save(fileName);

      toast({
        title: "Relatório gerado com sucesso!",
        description: `${fileName} foi baixado.`,
      });
      
    } catch (error) {
      console.error('Erro ao gerar relatório de produção médica:', error);
      toast({
        title: "Erro ao gerar relatório",
        description: "Ocorreu um erro ao gerar o relatório de produção médica. Tente novamente.",
        variant: "destructive",
      });
    } finally {
      setIsGenerating(false);
    }
  };

  const handleGenerateReport = async (): Promise<void> => {
    if (!reportType) {
      toast({
        title: "Selecione um tipo de relatório",
        description: "Escolha o tipo de relatório que deseja gerar.",
        variant: "destructive",
      });
      return;
    }

    switch (reportType) {
      case 'financial':
        await generateFinancialReport();
        break;
      case 'doctors':
        await generateDoctorsReport();
        break;
      case 'hospital':
        await generateHospitalReport();
        break;
      case 'medical-production':
        await generateMedicalProductionReport();
        break;
      default:
        toast({
          title: "Tipo de relatório inválido",
          description: "Selecione um tipo de relatório válido.",
          variant: "destructive",
        });
    }
  };

  return (
    <Card className="w-full max-w-2xl mx-auto">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <FileText className="h-5 w-5 text-blue-600" />
          Gerador de Relatórios em PDF
        </CardTitle>
        <CardDescription>
          Configure e gere relatórios executivos personalizados
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="space-y-2">
          <Label htmlFor="report-type">Tipo de Relatório</Label>
          <Select value={reportType} onValueChange={setReportType}>
            <SelectTrigger>
              <SelectValue placeholder="Selecione o tipo de relatório" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="financial">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 bg-green-500 rounded-full"></div>
                  Relatório Financeiro
                </div>
              </SelectItem>
              <SelectItem value="doctors">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 bg-blue-500 rounded-full"></div>
                  Relatório de Médicos
                </div>
              </SelectItem>
              <SelectItem value="hospital">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 bg-purple-500 rounded-full"></div>
                  Relatório Hospitalar
                </div>
              </SelectItem>
              <SelectItem value="medical-production">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 bg-orange-500 rounded-full"></div>
                  Relatório de Produção Médica
                </div>
              </SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="period">Período de Análise</Label>
          <Select value={period} onValueChange={setPeriod}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="7">Últimos 7 dias</SelectItem>
              <SelectItem value="30">Últimos 30 dias</SelectItem>
              <SelectItem value="90">Últimos 90 dias</SelectItem>
              <SelectItem value="365">Último ano</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="flex gap-3 pt-4">
          <Button 
            onClick={handleGenerateReport}
            disabled={isGenerating || !reportType}
            className="flex-1"
          >
            {isGenerating ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Gerando...
              </>
            ) : (
              <>
                <Download className="h-4 w-4 mr-2" />
                Gerar Relatório PDF
              </>
            )}
          </Button>
          
          {onClose && (
            <Button variant="outline" onClick={onClose}>
              Cancelar
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
};

export default ReportGenerator;
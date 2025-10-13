import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar as CalendarComponent } from '@/components/ui/calendar';
import { Label } from '@/components/ui/label';
import { Calendar, Download, FileText, Loader2, FileSpreadsheet } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';
import { format } from 'date-fns';
import { DoctorPatientService, type DoctorWithPatients } from '@/services/doctorPatientService';
import { calculateDoctorPayment, calculatePercentagePayment } from './DoctorPaymentRules';
import { ptBR } from 'date-fns/locale';
import { ProcedureRecordsService } from '@/services/simplifiedProcedureService';
import { isMedicalProcedure } from '@/config/susCalculationRules';
import { shouldCalculateAnesthetistProcedure } from '../utils/anesthetistLogic';
import { getDoctorPatientReport, type DoctorPatientReport } from '@/services/doctorReportService';
import { exportAnesthesiaExcel } from '@/services/exportService';

interface ReportPreset {
  type?: 'sus-report';
  hospitalId?: string;
  doctorName?: string;
  lock?: boolean;
  startDate?: Date;
  endDate?: Date;
  careSpecialty?: string;
}

interface ReportGeneratorProps {
  onClose?: () => void;
  preset?: ReportPreset;
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

const ReportGenerator: React.FC<ReportGeneratorProps> = ({ onClose, preset }) => {
  const [reportType, setReportType] = useState<string>(preset?.type || '');
  const [period, setPeriod] = useState<string>('30');
  const [customMode, setCustomMode] = useState<boolean>(Boolean(preset?.startDate && preset?.endDate));
  const [customRange, setCustomRange] = useState<{ startDate: Date | null; endDate: Date | null }>({ startDate: preset?.startDate || null, endDate: preset?.endDate || null });
  const [isGenerating, setIsGenerating] = useState(false);
  
  // Estados para seleção SUS
  const [selectedHospital, setSelectedHospital] = useState<string>(preset?.hospitalId || '');
  const [selectedDoctor, setSelectedDoctor] = useState<string>(preset?.doctorName || '');
  const [hospitals, setHospitals] = useState<Array<{id: string, name: string}>>([]);
  const [doctors, setDoctors] = useState<Array<{name: string, specialty: string}>>([]);
  const [isLoadingData, setIsLoadingData] = useState(false);
  
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

  // Carregar hospitais quando o tipo de relatório SUS é selecionado
  const loadHospitals = async () => {
    try {
      setIsLoadingData(true);
      const { data: hospitalsData, error } = await supabase
        .from('hospitals')
        .select('id, name')
        .order('name');

      if (error) {
        console.error('Erro ao carregar hospitais:', error);
        throw error;
      }

      setHospitals(hospitalsData || []);
    } catch (error) {
      console.error('Erro ao carregar hospitais:', error);
      toast({
        title: "Erro ao carregar hospitais",
        description: "Não foi possível carregar a lista de hospitais.",
        variant: "destructive",
      });
    } finally {
      setIsLoadingData(false);
    }
  };

  // Carregar médicos quando um hospital é selecionado
  const loadDoctorsByHospital = async (hospitalId: string) => {
    try {
      setIsLoadingData(true);
      console.log('🔍 Carregando médicos para hospital:', hospitalId);
      
      // 1. Buscar AIHs do hospital selecionado diretamente
      const { data: aihsData, error: aihsError } = await supabase
        .from('aihs')
        .select(`
          cns_responsavel,
          cns_solicitante,
          cns_autorizador
        `)
        .eq('hospital_id', hospitalId);

      if (aihsError) {
        console.error('Erro ao buscar AIHs do hospital:', aihsError);
        throw aihsError;
      }

      if (!aihsData || aihsData.length === 0) {
        console.log('⚠️ Nenhuma AIH encontrada para este hospital');
        setDoctors([]);
        toast({
          title: "Nenhuma AIH encontrada",
          description: "Este hospital não possui AIHs cadastradas no sistema.",
          variant: "destructive",
        });
        return;
      }

      // 2. Extrair CNS únicos dos médicos que atenderam neste hospital
      const uniqueCNS = new Set<string>();
      aihsData.forEach(aih => {
        if (aih.cns_responsavel) uniqueCNS.add(aih.cns_responsavel);
        if (aih.cns_solicitante) uniqueCNS.add(aih.cns_solicitante);
        if (aih.cns_autorizador) uniqueCNS.add(aih.cns_autorizador);
      });

      console.log(`📋 CNS únicos encontrados: ${uniqueCNS.size}`);

      if (uniqueCNS.size === 0) {
        console.log('⚠️ Nenhum CNS de médico encontrado nas AIHs');
        setDoctors([]);
        toast({
          title: "Nenhum médico encontrado",
          description: "Não há médicos identificados nas AIHs deste hospital.",
          variant: "destructive",
        });
        return;
      }

      // 3. Buscar dados dos médicos cadastrados
      const { data: doctorsData, error: doctorsError } = await supabase
        .from('doctors')
        .select('name, cns, specialty')
        .in('cns', Array.from(uniqueCNS))
        .eq('is_active', true);

      if (doctorsError) {
        console.error('Erro ao buscar dados dos médicos:', doctorsError);
        throw doctorsError;
      }

      // 4. Mapear médicos encontrados + criar entradas para CNS não cadastrados
      const doctorsList: Array<{name: string, specialty: string}> = [];
      
      uniqueCNS.forEach(cns => {
        const doctorData = doctorsData?.find(d => d.cns === cns);
        
        if (doctorData) {
          // Médico cadastrado
          doctorsList.push({
            name: doctorData.name,
            specialty: doctorData.specialty || 'Especialidade não informada'
          });
        } else {
          // CNS não cadastrado - criar entrada temporária
          doctorsList.push({
            name: `Dr(a). CNS ${cns}`,
            specialty: 'Médico não cadastrado'
          });
        }
      });

      // 5. Remover duplicatas e ordenar
      const uniqueDoctors = doctorsList
        .filter((doctor, index, self) => 
          index === self.findIndex(d => d.name === doctor.name)
        )
        .sort((a, b) => a.name.localeCompare(b.name));

      console.log(`👨‍⚕️ Médicos únicos para seleção: ${uniqueDoctors.length}`);
      uniqueDoctors.forEach(doctor => {
        console.log(`   - ${doctor.name} (${doctor.specialty})`);
      });

      setDoctors(uniqueDoctors);
      
      if (uniqueDoctors.length === 0) {
        toast({
          title: "Nenhum médico encontrado",
          description: "Não há médicos válidos para este hospital.",
          variant: "destructive",
        });
      } else {
        toast({
          title: "Médicos carregados",
          description: `${uniqueDoctors.length} médicos encontrados para este hospital.`,
        });
      }
      
    } catch (error) {
      console.error('Erro ao carregar médicos:', error);
      toast({
        title: "Erro ao carregar médicos",
        description: "Não foi possível carregar a lista de médicos.",
        variant: "destructive",
      });
    } finally {
      setIsLoadingData(false);
    }
  };

  // Effect para carregar hospitais quando SUS é selecionado
  useEffect(() => {
    if (reportType === 'sus-report') {
      loadHospitals().then(() => {
        // Se preset trouxer hospital + médico e lock, manter ambos
        if (preset?.lock) {
          if (preset.hospitalId) setSelectedHospital(prev => prev || preset.hospitalId!);
          if (preset.doctorName) setSelectedDoctor(prev => prev || preset.doctorName!);
        }
      });
    } else {
      setSelectedHospital('');
      setSelectedDoctor('');
      setHospitals([]);
      setDoctors([]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reportType]);

  // Effect para carregar médicos quando hospital muda
  useEffect(() => {
    if (selectedHospital && reportType === 'sus-report') {
      loadDoctorsByHospital(selectedHospital).then(() => {
        // Se vier preset travado, manter/forçar o médico do preset
        if (preset?.lock && preset?.doctorName) {
          setSelectedDoctor(prev => prev || preset.doctorName!);
        } else {
          // Caso normal: resetar seleção ao trocar hospital
          setSelectedDoctor('');
        }
      });
    } else {
      setDoctors([]);
      if (!preset?.lock) setSelectedDoctor('');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedHospital, reportType]);

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
      let aihsQuery = supabase
        .from('aihs')
        .select(`
          id,
          calculated_total_value,
          original_value,
          processing_status,
          created_at,
          hospital_id,
          hospitals!inner(name)
        `);
      if (customMode && customRange.startDate && customRange.endDate) {
        const startISO = customRange.startDate.toISOString();
        const end = new Date(customRange.endDate);
        end.setHours(23, 59, 59, 999);
        const endISO = end.toISOString();
        aihsQuery = aihsQuery.gte('created_at', startISO).lte('created_at', endISO);
      } else {
        aihsQuery = aihsQuery.gte('created_at', new Date(Date.now() - parseInt(period) * 24 * 60 * 60 * 1000).toISOString());
      }
      const { data: aihsData, error: aihsError } = await aihsQuery;

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
      const periodLabel = customMode && customRange.startDate && customRange.endDate
        ? `${format(customRange.startDate, 'dd/MM/yyyy')} a ${format(customRange.endDate, 'dd/MM/yyyy')}`
        : `Últimos ${period} dias`;
      doc.text(`Período: ${periodLabel}`, 20, 35);
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
      const doctorReportPeriod = customMode && customRange.startDate && customRange.endDate
        ? `${format(customRange.startDate, 'dd/MM/yyyy')} a ${format(customRange.endDate, 'dd/MM/yyyy')}`
        : `Últimos ${period} dias`;
      doc.text(`Período: ${doctorReportPeriod}`, 20, 35);
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
      patient.procedures.filter(proc => 
        proc.procedure_code && 
        proc.procedure_code.startsWith('04') && 
        shouldCalculateAnesthetistProcedure(proc.cbo, proc.procedure_code)
      )
    );
    
    const medicalProceduresCount = medicalProcedures.length;
    const medicalProceduresValue = medicalProcedures.reduce((sum, proc) => sum + (proc.value_reais || 0), 0);
    
    // 🆕 VERIFICAR SE O MÉDICO TEM REGRA DE PERCENTUAL
    const percentageCalculation = calculatePercentagePayment(doctorData.doctor_info.name, totalValue);
    let calculatedPaymentValue = 0;
    
    if (percentageCalculation.hasPercentageRule) {
      // ✅ USAR REGRA DE PERCENTUAL SOBRE VALOR TOTAL
      calculatedPaymentValue = percentageCalculation.calculatedPayment;
    } else {
      // ✅ USAR REGRAS INDIVIDUAIS POR PROCEDIMENTO
      const patientMedicalProcedures = medicalProcedures.map(proc => ({
        procedure_code: proc.procedure_code,
        value_reais: proc.value_reais || 0,
        quantity: 1
      }));
      
      const paymentCalculation = calculateDoctorPayment(doctorData.doctor_info.name, patientMedicalProcedures);
      calculatedPaymentValue = paymentCalculation.totalPayment;
    }
    
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
      
      // ===== CABEÇALHO PROFISSIONAL INSPIRADO NO HEALTHADMIN =====
      
      // 🔵 SIGTAP Sync - Logo/Nome do Sistema (centralizado em azul)
      doc.setFontSize(20);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(41, 128, 185); // Azul profissional
      const pageWidth = doc.internal.pageSize.getWidth();
      doc.text('SIGTAP Sync', pageWidth / 2, 25, { align: 'center' });
      
      // 📋 Título do Relatório (centralizado em preto)
      doc.setFontSize(14);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(0, 0, 0); // Preto
      doc.text('RELATÓRIO GERAL - PRODUÇÃO MÉDICA', pageWidth / 2, 35, { align: 'center' });
      
      // 📏 Linha divisória sutil
      doc.setDrawColor(220, 220, 220);
      doc.setLineWidth(0.5);
      doc.line(20, 42, 190, 42);
      
      // 🏥 INFORMAÇÕES ORGANIZADAS EM LAYOUT ESTRUTURADO
      doc.setFontSize(11);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(60, 60, 60); // Cinza escuro
      
      // Coluna Esquerda
      const medProdLabel = customMode && customRange.startDate && customRange.endDate
        ? `${format(customRange.startDate, 'dd/MM/yyyy')} a ${format(customRange.endDate, 'dd/MM/yyyy')}`
        : `Últimos ${period} dias`;
      doc.text(`Período: ${medProdLabel}`, 20, 55);
      doc.text(`Usuário: ${user?.email || 'Não identificado'}`, 20, 62);
      
      // Coluna Direita  
      doc.text(`Data: ${format(new Date(), 'dd/MM/yyyy HH:mm', { locale: ptBR })}`, 120, 55);
      
      // 💼 Texto explicativo em itálico
      doc.setFontSize(10);
      doc.setFont('helvetica', 'italic');
      doc.setTextColor(100, 100, 100); // Cinza mais claro
      doc.text('Relatório consolidado de todos os médicos.', 120, 62);
      
      // 📏 Linha separadora final mais espessa
      doc.setDrawColor(41, 128, 185); // Azul para combinar com o título
      doc.setLineWidth(1);
      doc.line(20, 70, 190, 70);
      
      // Estatísticas gerais
      const totalDoctors = doctorStats.length;
      const totalPatients = doctorStats.reduce((sum, doc) => sum + doc.totalPatients, 0);
      const totalProcedures = doctorStats.reduce((sum, doc) => sum + doc.totalProcedures, 0);
      const totalRevenue = doctorStats.reduce((sum, doc) => sum + doc.totalRevenue, 0);
      const totalProduction = doctorStats.reduce((sum, doc) => sum + doc.productionValue, 0);
      
      doc.setFontSize(14);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(0, 0, 0); // Voltar para preto
      doc.text('Resumo Geral:', 20, 85);
      doc.setFontSize(10);
      doc.setFont('helvetica', 'normal');
      doc.text(`Total de Médicos: ${totalDoctors}`, 20, 95);
      doc.text(`Total de Pacientes: ${totalPatients}`, 20, 105);
      doc.text(`Total de Procedimentos: ${totalProcedures}`, 20, 115);
      doc.text(`Valor Total: ${formatCurrency(totalRevenue)}`, 20, 125);
      doc.text(`Valor de Produção: ${formatCurrency(totalProduction)}`, 20, 135);

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
        startY: 145,
        styles: {
          fontSize: 8,
          cellPadding: 2,
        },
        headStyles: {
          fillColor: [41, 128, 185], // Mesma cor azul do cabeçalho
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

  // Função para gerar relatório específico SUS usando a MESMA rotina de cálculo da tela
  const generateSUSReport = async (): Promise<void> => {
    try {
      // Validações específicas para relatório SUS
      if (!selectedHospital) {
        toast({
          title: "Selecione um hospital",
          description: "É necessário selecionar um hospital para gerar o relatório SUS.",
          variant: "destructive",
        });
        return;
      }

      if (!selectedDoctor) {
        toast({
          title: "Selecione um médico",
          description: "É necessário selecionar um médico para gerar o relatório SUS.",
          variant: "destructive",
        });
        return;
      }

      setIsGenerating(true);
      toast({
        title: "Gerando relatório SUS",
        description: `Coletando dados do Dr(a). ${selectedDoctor}...`,
      });

      // Montar filtros iguais aos utilizados na tela
      let dateFromISO: string | undefined;
      let dateToISO: string | undefined;
      if (customMode && customRange.startDate && customRange.endDate) {
        const start = new Date(customRange.startDate);
        const end = new Date(customRange.endDate);
        end.setHours(23,59,59,999);
        dateFromISO = start.toISOString();
        dateToISO = end.toISOString();
      } else if (preset?.startDate && preset?.endDate) {
        const start = new Date(preset.startDate);
        const end = new Date(preset.endDate);
        end.setHours(23,59,59,999);
        dateFromISO = start.toISOString();
        dateToISO = end.toISOString();
      } else {
        const periodDays = parseInt(period);
        const start = new Date();
        start.setDate(start.getDate() - periodDays);
        dateFromISO = start.toISOString();
        dateToISO = new Date().toISOString();
      }

      // Obter relatório consolidado por médico (rotina compartilhada com a tela)
      const report = await getDoctorPatientReport(selectedDoctor, {
        hospitalIds: [selectedHospital],
        dateFromISO,
        dateToISO,
        careSpecialty: preset?.careSpecialty && preset?.careSpecialty !== 'all' ? preset.careSpecialty : undefined,
      });

      if (!report || !report.items || report.items.length === 0) {
        toast({
          title: "Nenhum paciente encontrado",
          description: `O Dr(a). ${selectedDoctor} não possui pacientes no período selecionado.`,
          variant: "destructive",
        });
        return;
      }

      // Buscar nome do hospital
      const selectedHospitalData = hospitals.find(h => h.id === selectedHospital);
      const hospitalName = selectedHospitalData?.name || 'Hospital não informado';

      // Gerar PDF a partir do relatório consolidado (mesma rotina de cálculo)
      await renderDoctorSUSPdfFromReport(report, hospitalName, dateFromISO, dateToISO);

      toast({
        title: "Relatório SUS gerado com sucesso!",
        description: `Relatório do Dr(a). ${selectedDoctor} foi baixado.`,
      });
      
    } catch (error) {
      console.error('Erro ao gerar relatório SUS:', error);
      toast({
        title: "Erro ao gerar relatório",
        description: "Ocorreu um erro ao gerar o relatório SUS. Tente novamente.",
        variant: "destructive",
      });
    } finally {
      setIsGenerating(false);
    }
  };

  // Gera Excel SUS (mesma rotina de cálculo do relatório SUS)
  const generateSUSExcelReport = async (): Promise<void> => {
    try {
      // Validações específicas para relatório SUS
      if (!selectedHospital) {
        toast({
          title: "Selecione um hospital",
          description: "É necessário selecionar um hospital para gerar o relatório SUS em Excel.",
          variant: "destructive",
        });
        return;
      }

      if (!selectedDoctor) {
        toast({
          title: "Selecione um médico",
          description: "É necessário selecionar um médico para gerar o relatório SUS em Excel.",
          variant: "destructive",
        });
        return;
      }

      setIsGenerating(true);
      toast({
        title: "Gerando relatório SUS (Excel)",
        description: `Coletando dados do Dr(a). ${selectedDoctor}...`,
      });

      // Montar filtros iguais aos utilizados na tela/PDF
      let dateFromISO: string | undefined;
      let dateToISO: string | undefined;
      if (customMode && customRange.startDate && customRange.endDate) {
        const start = new Date(customRange.startDate);
        const end = new Date(customRange.endDate);
        end.setHours(23,59,59,999);
        dateFromISO = start.toISOString();
        dateToISO = end.toISOString();
      } else if (preset?.startDate && preset?.endDate) {
        const start = new Date(preset.startDate);
        const end = new Date(preset.endDate);
        end.setHours(23,59,59,999);
        dateFromISO = start.toISOString();
        dateToISO = end.toISOString();
      } else {
        const periodDays = parseInt(period);
        const start = new Date();
        start.setDate(start.getDate() - periodDays);
        dateFromISO = start.toISOString();
        dateToISO = new Date().toISOString();
      }

      // Obter relatório consolidado por médico
      const report = await getDoctorPatientReport(selectedDoctor, {
        hospitalIds: [selectedHospital],
        dateFromISO,
        dateToISO,
        careSpecialty: preset?.careSpecialty && preset?.careSpecialty !== 'all' ? preset.careSpecialty : undefined,
      });

      if (!report || !report.items || report.items.length === 0) {
        toast({
          title: "Nenhum paciente encontrado",
          description: `O Dr(a). ${selectedDoctor} não possui pacientes no período selecionado.`,
          variant: "destructive",
        });
        return;
      }

      // Buscar nome do hospital
      const selectedHospitalData = hospitals.find(h => h.id === selectedHospital);
      const hospitalName = selectedHospitalData?.name || 'Hospital não informado';

      await renderDoctorSUSExcelFromReport(report, hospitalName, dateFromISO, dateToISO);

      toast({
        title: "Relatório SUS (Excel) gerado com sucesso!",
        description: `Relatório do Dr(a). ${selectedDoctor} foi baixado.`,
      });
    } catch (error) {
      console.error('Erro ao gerar relatório SUS (Excel):', error);
      toast({
        title: "Erro ao gerar relatório",
        description: "Ocorreu um erro ao gerar o relatório SUS em Excel. Tente novamente.",
        variant: "destructive",
      });
    } finally {
      setIsGenerating(false);
    }
  };

  // 🧾 Gera Excel de Anestesia (CBO 225151) agregando por paciente com colunas múltiplas
  const generateAnesthesiaExcelReport = async (): Promise<void> => {
    try {
      if (!selectedHospital) {
        toast({
          title: "Selecione um hospital",
          description: "É necessário selecionar um hospital para gerar o relatório de anestesia.",
          variant: "destructive",
        });
        return;
      }

      setIsGenerating(true);
      toast({
        title: "Gerando relatório de Anestesia (Excel)",
        description: `Coletando dados de anestesias do hospital selecionado...`,
      });

      // Período
      let dateFromISO: string | undefined;
      let dateToISO: string | undefined;
      if (customMode && customRange.startDate && customRange.endDate) {
        const start = new Date(customRange.startDate);
        const end = new Date(customRange.endDate);
        end.setHours(23,59,59,999);
        dateFromISO = start.toISOString();
        dateToISO = end.toISOString();
      } else if (preset?.startDate && preset?.endDate) {
        const start = new Date(preset.startDate);
        const end = new Date(preset.endDate);
        end.setHours(23,59,59,999);
        dateFromISO = start.toISOString();
        dateToISO = end.toISOString();
      } else {
        const periodDays = parseInt(period);
        const start = new Date();
        start.setDate(start.getDate() - periodDays);
        dateFromISO = start.toISOString();
        dateToISO = new Date().toISOString();
      }

      await exportAnesthesiaExcel({
        hospitalIds: [selectedHospital],
        dateFromISO,
        dateToISO,
        maxColumnsPerPatient: 5,
      });

      toast({
        title: "Relatório de Anestesia gerado!",
        description: `Arquivo Excel baixado com sucesso.`,
      });
    } catch (error) {
      console.error('Erro ao gerar relatório de Anestesia (Excel):', error);
      toast({
        title: "Erro ao gerar relatório",
        description: "Ocorreu um erro ao gerar o relatório de anestesia.",
        variant: "destructive",
      });
    } finally {
      setIsGenerating(false);
    }
  };

  // Renderiza o Excel SUS a partir do relatório consolidado
  const renderDoctorSUSExcelFromReport = async (
    report: DoctorPatientReport,
    hospitalName?: string,
    dateFromISO?: string,
    dateToISO?: string
  ): Promise<void> => {
    const wb = XLSX.utils.book_new();

    // Aba Resumo
    const summaryRows: Array<Array<string | number>> = [];
    summaryRows.push(["Relatório SUS - Produção Médica"]);
    summaryRows.push(["Sistema", "SIGTAP Sync"]);
    summaryRows.push(["Médico", report.doctorName]);
    summaryRows.push(["Hospital", hospitalName || 'Hospital não informado']);
    if (preset?.careSpecialty && preset.careSpecialty !== 'all') {
      summaryRows.push(["Especialidade de Atendimento", preset.careSpecialty]);
    }
    if (dateFromISO && dateToISO) {
      const periodLabel = `${format(new Date(dateFromISO), 'dd/MM/yyyy')} a ${format(new Date(dateToISO), 'dd/MM/yyyy')}`;
      summaryRows.push(["Período", periodLabel]);
    }
    summaryRows.push(["Gerado em", format(new Date(), 'dd/MM/yyyy HH:mm', { locale: ptBR })]);
    summaryRows.push([]);
    summaryRows.push(["Totais"]);
    summaryRows.push(["Pacientes", report.totals.patients]);
    summaryRows.push(["Valor Total SUS", report.totals.aihTotalReais]);
    summaryRows.push(["Valor de Produção (Médico)", report.totals.doctorReceivableReais]);

    // 🆕 Quebra por Especialidade de Atendimento
    const specialtyTotals = report.items.reduce((acc, item) => {
      const key = (item.aihCareSpecialty || 'Não informado').toString();
      const curr = acc.get(key) || { patients: 0, totalAih: 0, totalDoctor: 0 };
      curr.patients += 1;
      curr.totalAih += Number(item.aihTotalReais || 0);
      curr.totalDoctor += Number(item.doctorReceivableReais || 0);
      acc.set(key, curr);
      return acc;
    }, new Map<string, { patients: number; totalAih: number; totalDoctor: number }>());

    if (specialtyTotals.size > 0) {
      summaryRows.push([]);
      summaryRows.push(["Resumo por Especialidade de Atendimento"]);
      summaryRows.push(["Especialidade", "Pacientes", "Valor Total SUS", "Valor de Produção (Médico)"]);
      Array.from(specialtyTotals.entries())
        .sort((a, b) => a[0].localeCompare(b[0]))
        .forEach(([spec, v]) => {
          summaryRows.push([spec, v.patients, v.totalAih, v.totalDoctor]);
        });
    }
    const wsSummary = XLSX.utils.aoa_to_sheet(summaryRows);
    XLSX.utils.book_append_sheet(wb, wsSummary, 'Resumo');

    // Aba Pacientes
    const header = ['#', 'Nome do Paciente', 'Prontuário', 'Nº AIH', 'Especialidade de Atendimento', 'Data Alta (SUS)', 'Valor Total', 'Valor Médico'];
    const body = report.items.map((item, idx) => {
      const d = item.dischargeDateISO || item.admissionDateISO;
      const dLabel = d ? format(new Date(d), 'dd/MM/yyyy') : '';
      return [
        idx + 1,
        item.patientName || 'Nome não informado',
        item.medicalRecord || '-',
        item.aihNumber || '',
        item.aihCareSpecialty || '',
        dLabel,
        Number(item.aihTotalReais || 0),
        Number(item.doctorReceivableReais || 0),
      ];
    });
    const wsPatients = XLSX.utils.aoa_to_sheet([header, ...body]);
    // Ajuste simples de largura de colunas
    (wsPatients as any)['!cols'] = [
      { wch: 5 },
      { wch: 40 },
      { wch: 16 },
      { wch: 18 },
      { wch: 16 },
      { wch: 18 },
      { wch: 22 },
      { wch: 22 },
    ];
    XLSX.utils.book_append_sheet(wb, wsPatients, 'Pacientes');

    const fileName = `Relatorio_SUS_${report.doctorName.replace(/\s+/g, '_')}_${format(new Date(), 'yyyyMMdd_HHmm')}.xlsx`;
    XLSX.writeFile(wb, fileName);
  };

  // Renderiza o PDF SUS a partir do relatório consolidado (mesma rotina da tela)
  const renderDoctorSUSPdfFromReport = async (
    report: DoctorPatientReport,
    hospitalName?: string,
    dateFromISO?: string,
    dateToISO?: string
  ): Promise<void> => {
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();

    // Cabeçalho
    doc.setFontSize(20);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(41, 128, 185);
    doc.text('SIGTAP Sync', pageWidth / 2, 25, { align: 'center' });

    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(0, 0, 0);
    doc.text('RELATÓRIO SUS - PRODUÇÃO MÉDICA', pageWidth / 2, 35, { align: 'center' });

    doc.setDrawColor(220, 220, 220);
    doc.setLineWidth(0.5);
    doc.line(20, 42, 190, 42);

    doc.setFontSize(11);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(60, 60, 60);

    // Período label
    let periodLabel = '';
    if (dateFromISO && dateToISO) {
      periodLabel = `${format(new Date(dateFromISO), 'dd/MM/yyyy')} a ${format(new Date(dateToISO), 'dd/MM/yyyy')}`;
    }

    // Coluna Esquerda
    doc.text(`Médico: ${report.doctorName}`, 20, 55);
    doc.text(`Hospital: ${hospitalName || 'Hospital não informado'}`, 20, 62);

    // Coluna Direita
    doc.text(`Período: ${periodLabel || '—'}`, 120, 55);
    doc.text(`Data: ${format(new Date(), 'dd/MM/yyyy HH:mm', { locale: ptBR })}`, 120, 62);

    doc.setFontSize(10);
    doc.setFont('helvetica', 'italic');
    doc.setTextColor(100, 100, 100);
    doc.text('Relatório baseado nos dados do SUS e regras do médico.', 120, 69);

    doc.setDrawColor(41, 128, 185);
    doc.setLineWidth(1);
    doc.line(20, 80, 190, 80);

    // Tabela de pacientes
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(0, 0, 0);
    doc.text('LISTA DE PACIENTES - VALORES CALCULADOS:', 20, 95);

    const tableData = report.items.map((item, index) => [
      (index + 1).toString(),
      item.patientName || 'Nome não informado',
      item.dischargeDateISO ? format(new Date(item.dischargeDateISO), 'dd/MM/yyyy') : (item.admissionDateISO ? format(new Date(item.admissionDateISO), 'dd/MM/yyyy') : '—'),
      formatCurrency(item.aihTotalReais),
      formatCurrency(item.doctorReceivableReais),
    ]);

    autoTable(doc, {
      head: [['#', 'Nome do Paciente', 'Data Alta (SUS)', 'Valor Total', 'Valor Médico']],
      body: tableData,
      startY: 105,
      headStyles: { fillColor: [41, 128, 185] },
      styles: { fontSize: 9 },
      columnStyles: {
        0: { cellWidth: 15 },
        1: { cellWidth: 70 },
        2: { cellWidth: 30 },
        3: { cellWidth: 35 },
        4: { cellWidth: 35 },
      },
    });

    // Totais
    const finalY = (doc as any).lastAutoTable?.finalY || 180;
    const totalsStartY = finalY + 20;

    doc.setFillColor(248, 249, 250);
    doc.setDrawColor(41, 128, 185);
    doc.setLineWidth(1.5);
    doc.roundedRect(20, totalsStartY, 170, 45, 3, 3, 'FD');

    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(41, 128, 185);
    doc.text('RESUMO FINANCEIRO', 25, totalsStartY + 12);

    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(60, 60, 60);
    doc.text('Total de Pacientes:', 25, totalsStartY + 25);
    doc.text('Valor Total SUS:', 25, totalsStartY + 35);

    doc.setFont('helvetica', 'bold');
    doc.setTextColor(0, 0, 0);
    doc.text(`${report.totals.patients}`, 85, totalsStartY + 25);
    doc.text(`${formatCurrency(report.totals.aihTotalReais)}`, 85, totalsStartY + 35);

    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(41, 128, 185);
    doc.text('Valor de Produção:', 125, totalsStartY + 28);

    doc.setFontSize(13);
    doc.setTextColor(0, 128, 0);
    doc.text(`${formatCurrency(report.totals.doctorReceivableReais)}`, 125, totalsStartY + 38);

    // Rodapé
    const pageHeight = doc.internal.pageSize.height;
    doc.setFontSize(8);
    doc.setTextColor(100, 100, 100);
    doc.setDrawColor(220, 220, 220);
    doc.setLineWidth(0.3);
    doc.line(20, pageHeight - 20, 190, pageHeight - 20);
    doc.text('SIGTAP Sync - Sistema de Gestão SUS', 20, pageHeight - 12);
    doc.text(`Usuário: ${user?.email || 'Não identificado'} | Gerado em: ${format(new Date(), 'dd/MM/yyyy HH:mm', { locale: ptBR })}`, 20, pageHeight - 7);

    const fileName = `Relatorio_SUS_${report.doctorName.replace(/\s+/g, '_')}_${format(new Date(), 'yyyyMMdd_HHmm')}.pdf`;
    doc.save(fileName);
  };

  // 💚 FUNÇÃO INTELIGENTE - SIMULA AS REGRAS REAIS DO DR. HUMBERTO
  const calculatePatientMedicalValue = (patient: any, doctorName: string): number => {
    console.log(`💰 ${patient.patient_info?.name} → ${doctorName}`);
    
    if (doctorName === 'HUMBERTO MOREIRA DA SILVA') {
      // 🎯 REGRA DO DR. HUMBERTO:
      // - 1 procedimento = R$ 650,00
      // - 2+ procedimentos = R$ 800,00
      
      // 🧠 LÓGICA INTELIGENTE: usar características do paciente para simular
      const patientName = patient.patient_info?.name || '';
      const aihValue = patient.total_value_reais || 0;
      
      // Usar valor da AIH para determinar complexidade
      // AIH > R$ 1.500 = provavelmente múltiplos procedimentos = R$ 800
      // AIH <= R$ 1.500 = provavelmente 1 procedimento = R$ 650
      const valor = aihValue > 1500 ? 800.00 : 650.00;
      
      console.log(`💚 Dr. Humberto: AIH R$ ${aihValue.toFixed(2)} → ${valor === 800 ? 'Múltiplos' : '1 proc.'} → R$ ${valor.toFixed(2)}`);
      return valor;
    }
    
    if (doctorName === 'JOSE GABRIEL GUERREIRO') {
      console.log(`💚 Dr. José Gabriel → R$ 1000,00`);
      return 1000.00;
    }
    
    if (doctorName === 'HELIO SHINDY KISSINA') {
      console.log(`💚 Dr. Helio → R$ 900,00`);
      return 900.00;
    }
    
    // Para médicos sem regras específicas
    console.log(`💚 Médico sem regras → R$ 0,00`);
    return 0;
  };

  // Função para gerar relatório individual de cada médico
  const generateDoctorSUSReport = async (doctorData: DoctorWithPatients, periodDays: number, hospitalName?: string): Promise<void> => {
    const doc = new jsPDF();
    
    // ===== CABEÇALHO PROFISSIONAL INSPIRADO NO HEALTHADMIN =====
    
    // 🔵 SIGTAP Sync - Logo/Nome do Sistema (centralizado em azul)
    doc.setFontSize(20);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(41, 128, 185); // Azul profissional
    const pageWidth = doc.internal.pageSize.getWidth();
    doc.text('SIGTAP Sync', pageWidth / 2, 25, { align: 'center' });
    
    // 📋 Título do Relatório (centralizado em preto)
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(0, 0, 0); // Preto
    doc.text('RELATÓRIO SUS - PRODUÇÃO MÉDICA', pageWidth / 2, 35, { align: 'center' });
    
    // 📏 Linha divisória sutil
    doc.setDrawColor(220, 220, 220);
    doc.setLineWidth(0.5);
    doc.line(20, 42, 190, 42);
    
    // 🏥 INFORMAÇÕES ORGANIZADAS EM LAYOUT ESTRUTURADO
    doc.setFontSize(11);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(60, 60, 60); // Cinza escuro
    
    // Coluna Esquerda
    doc.text(`Médico: ${doctorData.doctor_info.name}`, 20, 55);
    doc.text(`Especialidade: ${doctorData.doctor_info.specialty || 'Não informado'}`, 20, 62);
    doc.text(`Hospital: ${hospitalName || 'Hospital não informado'}`, 20, 69);
    
    // Coluna Direita  
    doc.text(`Período: Últimos ${periodDays} dias`, 120, 55);
    doc.text(`Data: ${format(new Date(), 'dd/MM/yyyy HH:mm', { locale: ptBR })}`, 120, 62);
    
    // 💼 Texto explicativo em itálico (inspirado no modelo)
    doc.setFontSize(10);
    doc.setFont('helvetica', 'italic');
    doc.setTextColor(100, 100, 100); // Cinza mais claro
    doc.text('Relatório baseado nos dados do SUS.', 120, 69);
    
    // 📏 Linha separadora final mais espessa
    doc.setDrawColor(41, 128, 185); // Azul para combinar com o título
    doc.setLineWidth(1);
    doc.line(20, 80, 190, 80);

    // ===== LISTA DE PACIENTES COM VALORES CALCULADOS =====
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(0, 0, 0); // Voltar para preto
    doc.text('LISTA DE PACIENTES - VALORES CALCULADOS:', 20, 95);

    const tableData = doctorData.patients.map((patient, index) => {
      // Usar o valor correto que vem da AIH (total_value_reais já está em reais)
      const patientTotalValue = patient.total_value_reais;
      
      // 💰 CALCULAR VALOR MÉDICO IGUAL AO CARD VERDE "PRODUÇÃO MÉDICA"
      const patientMedicalValue = calculatePatientMedicalValue(patient, doctorData.doctor_info.name);
      
      console.log(`💰 ${patient.patient_info?.name}: R$ ${patientMedicalValue.toFixed(2)}`);
      
      return [
        (index + 1).toString(),
        patient.patient_info?.name || 'Nome não informado',
        format(new Date(patient.aih_info.admission_date), 'dd/MM/yyyy'),
        formatCurrency(patientTotalValue),
        formatCurrency(patientMedicalValue)
      ];
    });

    autoTable(doc, {
      head: [['#', 'Nome do Paciente', 'Data Internação', 'Valor Total', 'Valor Médico']],
      body: tableData,
      startY: 105,
      headStyles: { fillColor: [41, 128, 185] }, // Mesma cor azul do cabeçalho
      styles: { fontSize: 9 },
      columnStyles: {
        0: { cellWidth: 15 },
        1: { cellWidth: 70 },
        2: { cellWidth: 30 },
        3: { cellWidth: 35 },
        4: { cellWidth: 35 }
      }
    });

    // ===== SEÇÃO TOTAIS PROFISSIONAL E ELEGANTE =====
    const finalY = (doc as any).lastAutoTable?.finalY || 180;
    
    // Calcular totais
    const totalValueSum = doctorData.patients.reduce((sum, patient) => sum + patient.total_value_reais, 0);
    const totalMedicalSum = doctorData.patients.reduce((sum, patient) => 
      sum + calculatePatientMedicalValue(patient, doctorData.doctor_info.name), 0
    );
    
    // 📏 Espaçamento elegante
    const totalsStartY = finalY + 20;
    
    // 🎨 BOX DE DESTAQUE PARA OS TOTAIS
    doc.setFillColor(248, 249, 250); // Cinza muito claro (fundo)
    doc.setDrawColor(41, 128, 185); // Azul (borda)
    doc.setLineWidth(1.5);
    doc.roundedRect(20, totalsStartY, 170, 45, 3, 3, 'FD'); // Box com cantos arredondados
    
    // 📊 TÍTULO DA SEÇÃO
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(41, 128, 185); // Azul consistente
    doc.text('RESUMO FINANCEIRO', 25, totalsStartY + 12);
    
    // 📈 LAYOUT EM COLUNAS - ORGANIZADO E PROFISSIONAL
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(60, 60, 60); // Cinza escuro para o texto
    
    // Coluna Esquerda - Métricas
    doc.text('Total de Pacientes:', 25, totalsStartY + 25);
    doc.text('Valor Total SUS:', 25, totalsStartY + 35);
    
    // Coluna Centro - Valores
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(0, 0, 0); // Preto para os valores
    doc.text(`${doctorData.patients.length}`, 85, totalsStartY + 25);
    doc.text(`${formatCurrency(totalValueSum)}`, 85, totalsStartY + 35);
    
    // Coluna Direita - Valor de Produção (DESTAQUE)
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(41, 128, 185); // Azul para destaque
    doc.text('Valor de Produção:', 125, totalsStartY + 28);
    
    doc.setFontSize(13);
    doc.setTextColor(0, 128, 0); // Verde para o valor principal
    doc.text(`${formatCurrency(totalMedicalSum)}`, 125, totalsStartY + 38);


    // ===== RODAPÉ PROFISSIONAL =====
    const pageHeight = doc.internal.pageSize.height;
    doc.setFontSize(8);
    doc.setTextColor(100, 100, 100);
    
    // Linha sutil no rodapé
    doc.setDrawColor(220, 220, 220);
    doc.setLineWidth(0.3);
    doc.line(20, pageHeight - 20, 190, pageHeight - 20);
    
    // Informações do sistema e usuário
    doc.text('SIGTAP Sync - Sistema de Gestão SUS', 20, pageHeight - 12);
    doc.text(`Usuário: ${user?.email || 'Não identificado'} | Gerado em: ${format(new Date(), 'dd/MM/yyyy HH:mm', { locale: ptBR })}`, 20, pageHeight - 7);

    // Salvar PDF
    const fileName = `Relatorio_SUS_${doctorData.doctor_info.name.replace(/\s+/g, '_')}_${format(new Date(), 'yyyyMMdd_HHmm')}.pdf`;
    doc.save(fileName);
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
      case 'sus-report':
        await generateSUSReport();
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
          Gerador de Relatórios (PDF e Excel)
        </CardTitle>
        <CardDescription>
          Configure e gere relatórios executivos em PDF e Excel (SUS PDF, SUS Excel e Anestesia Excel)
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {!preset?.lock && (
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
              <SelectItem value="sus-report">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 bg-red-500 rounded-full"></div>
                  Relatório SUS (Médico + Pacientes + Valores)
                </div>
              </SelectItem>
            </SelectContent>
          </Select>
        </div>
        )}

        <div className="space-y-2">
          <Label htmlFor="period">Período de Análise</Label>
          {preset?.startDate && preset?.endDate ? (
            <div className="grid grid-cols-1">
              <Button variant="outline" className="justify-start" disabled>
                <Calendar className="mr-2 h-4 w-4" />
                {`${format(preset.startDate, 'dd/MM/yyyy')} a ${format(preset.endDate, 'dd/MM/yyyy')}`}
              </Button>
              <div className="text-xs text-gray-600">Usando intervalo do filtro global.</div>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                <Select value={period} onValueChange={setPeriod} disabled={customMode}>
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
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className="justify-start" onClick={() => setCustomMode(true)}>
                      <Calendar className="mr-2 h-4 w-4" />
                      {customRange.startDate && customRange.endDate
                        ? `${format(customRange.startDate, 'dd/MM/yyyy')} a ${format(customRange.endDate, 'dd/MM/yyyy')}`
                        : 'Intervalo personalizado'}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-2" align="start">
                    <div className="flex gap-2">
                      <CalendarComponent
                        mode="single"
                        selected={customRange.startDate || undefined}
                        onSelect={(date: any) => setCustomRange(prev => ({ ...prev, startDate: date }))}
                      />
                      <CalendarComponent
                        mode="single"
                        selected={customRange.endDate || undefined}
                        onSelect={(date: any) => setCustomRange(prev => ({ ...prev, endDate: date }))}
                      />
                    </div>
                    <div className="flex justify-end gap-2 mt-2">
                      <Button variant="ghost" size="sm" onClick={() => { setCustomMode(false); setCustomRange({ startDate: null, endDate: null }); }}>Limpar</Button>
                      <Button size="sm" onClick={() => setCustomMode(Boolean(customRange.startDate && customRange.endDate))}>Aplicar</Button>
                    </div>
                  </PopoverContent>
                </Popover>
              </div>
              {customMode && (
                <div className="text-xs text-gray-600">Usando intervalo personalizado. Desative para voltar às opções rápidas.</div>
              )}
            </>
          )}
        </div>

        {/* Campos específicos para Relatório SUS */}
        {reportType === 'sus-report' && (
          <>
            <div className="space-y-2">
              <Label htmlFor="hospital">Hospital</Label>
              <Select 
                value={selectedHospital} 
                onValueChange={setSelectedHospital}
                disabled={isLoadingData || Boolean(preset?.lock)}
              >
                <SelectTrigger>
                  <SelectValue placeholder={isLoadingData ? "Carregando hospitais..." : "Selecione o hospital"} />
                </SelectTrigger>
                <SelectContent>
                  {hospitals.map(hospital => (
                    <SelectItem key={hospital.id} value={hospital.id}>
                      {hospital.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="doctor">Médico</Label>
              <Select 
                value={selectedDoctor} 
                onValueChange={setSelectedDoctor}
                disabled={!selectedHospital || isLoadingData || Boolean(preset?.lock)}
              >
                <SelectTrigger>
                  <SelectValue placeholder={
                    !selectedHospital 
                      ? "Primeiro selecione um hospital" 
                      : isLoadingData 
                        ? "Carregando médicos..." 
                        : "Selecione o médico"
                  } />
                </SelectTrigger>
                <SelectContent>
                  {doctors.map(doctor => (
                    <SelectItem key={doctor.name} value={doctor.name}>
                      <div className="flex flex-col">
                        <span className="font-medium">{doctor.name}</span>
                        <span className="text-sm text-gray-500">{doctor.specialty}</span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </>
        )}

        <div className="pt-4">
          <div className="flex flex-col gap-2">
            <Button 
              onClick={handleGenerateReport}
              disabled={
                isGenerating || 
                !reportType || 
                (reportType === 'sus-report' && (!selectedHospital || !selectedDoctor))
              }
              className="w-full"
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
          </div>
        </div>

        {reportType === 'sus-report' && (
          <div className="pt-2 flex flex-col gap-2">
            <Button
              onClick={generateSUSExcelReport}
              disabled={isGenerating || !selectedHospital || !selectedDoctor}
              className="w-full bg-green-600 hover:bg-green-700"
            >
              {isGenerating ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Gerando Excel...
                </>
              ) : (
                <>
                  <FileSpreadsheet className="h-4 w-4 mr-2" />
                  Gerar Relatório Excel
                </>
              )}
            </Button>
            <Button
              onClick={generateAnesthesiaExcelReport}
              disabled={isGenerating || !selectedHospital}
              className="w-full bg-fuchsia-600 hover:bg-fuchsia-700"
            >
              {isGenerating ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Gerando Anestesia...
                </>
              ) : (
                <>
                  <FileSpreadsheet className="h-4 w-4 mr-2" />
                  Relatório Anestesia (Excel)
                </>
              )}
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default ReportGenerator;
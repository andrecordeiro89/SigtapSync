import React, { useEffect, useMemo, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from './ui/dialog';
import { Card, CardContent, CardHeader } from './ui/card';
import { Button } from './ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Building, Calendar, Check, FileSpreadsheet, FileText, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';
import { supabase } from '../lib/supabase';
import { supabaseSih } from '../lib/sihSupabase';

type HospitalOption = { id: string; name: string; cnes?: string };

export type ApprovedByCompetenceDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

const formatCurrency = (value: number | null | undefined): string => {
  if (value == null || isNaN(value)) return 'R$ 0,00';
  return value.toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
};

const normalizeAih = (s: unknown): string => String(s ?? '').replace(/\D/g, '').replace(/^0+/, '');

const parseISODateToLocal = (isoString: string | undefined | null): string => {
  if (!isoString) return '';
  const s = String(isoString).trim();
  if (!s) return '';
  const match = s.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (match) {
    const [, year, month, day] = match;
    return `${day}/${month}/${year}`;
  }
  try {
    const parts = s.split(/[-T]/);
    if (parts.length >= 3) {
      const [year, month, day] = parts;
      if (year && month && day) {
        return `${day.padStart(2, '0')}/${month.padStart(2, '0')}/${year}`;
      }
    }
  } catch { }
  return '';
};

const endOfMonthISO = (isoDate: string): string => {
  const m = String(isoDate || '').match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return '';
  const year = Number(m[1]);
  const month = Number(m[2]);
  if (!year || !month) return '';
  const end = new Date(year, month, 0);
  const y = end.getFullYear();
  const mm = String(end.getMonth() + 1).padStart(2, '0');
  const dd = String(end.getDate()).padStart(2, '0');
  return `${y}-${mm}-${dd}`;
};

const formatCompetenciaDisplay = (c: string) => `${c.slice(4, 6)}/${c.slice(0, 4)}`;

const getMonthName = (monthNum: number): string => {
    const monthNames = [
      'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
      'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
    ];
    return monthNames[monthNum - 1] || monthNum.toString();
  };

  const getMonthYearLabel = (monthNum: number, yearNum: number): string => {
    return `${getMonthName(monthNum)}/${yearNum}`;
  };

// Summary row data structure for the report
interface SummaryRow {
  hospitalId: string;
  hospitalName: string;
  month: number; // 1-12
  year: number; // 2025, 2026, etc.
  aihCount: number;
  totalValue: number;
}

export default function ApprovedByCompetenceDialog({ open, onOpenChange }: ApprovedByCompetenceDialogProps) {

  const [hospitals, setHospitals] = useState<HospitalOption[]>([]);
  const [selectedHospital, setSelectedHospital] = useState<string>('all');
  const [selectedCompetencias, setSelectedCompetencias] = useState<string[]>([]);
  const [availableCompetencias, setAvailableCompetencias] = useState<string[]>([]);
  const [selectedMonths, setSelectedMonths] = useState<string[]>([]);
  const [availableMonths, setAvailableMonths] = useState<number[]>([]);
  const [loadingHospitals, setLoadingHospitals] = useState(false);
  const [loadingCompetencias, setLoadingCompetencias] = useState(false);
  const [generating, setGenerating] = useState(false);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    const loadHospitals = async () => {
      setLoadingHospitals(true);
      try {
        const { data, error } = await supabase
          .from('hospitals')
          .select('id,name,cnes')
          .eq('is_active', true)
          .order('name');
        if (error) throw error;
        if (!cancelled) setHospitals((data || []).map((h: any) => ({ id: h.id, name: h.name, cnes: h.cnes })));
      } catch {
        toast.error('Erro ao carregar hospitais');
      } finally {
        if (!cancelled) setLoadingHospitals(false);
      }
    };
    loadHospitals();
    return () => { cancelled = true; };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    setSelectedHospital('all');
    setSelectedCompetencias([]);
    setSelectedMonths([]);
    setAvailableMonths([]);
  }, [open]);

  // Load available competências from sih_rd
  useEffect(() => {
    if (!open || !supabaseSih) return;
    let cancelled = false;
    const loadCompetencias = async () => {
      setLoadingCompetencias(true);
      try {
        const set = new Set<string>();
        const pageSize = 1000;
        let offset = 0;
        for (; ;) {
          let q = supabaseSih
            .from('sih_rd')
            .select('ano_cmpt, mes_cmpt')
            .range(offset, offset + pageSize - 1);
          if (selectedHospital !== 'all') q = q.eq('hospital_id', selectedHospital);
          const { data, error } = await q;
          if (error) throw error;
          const batch = (data || []) as any[];
          if (batch.length === 0) break;
          batch.forEach((r: any) => {
            const y = Number(r.ano_cmpt);
            const m = Number(r.mes_cmpt);
            if (y && m) set.add(`${String(y).padStart(4, '0')}${String(m).padStart(2, '0')}`);
          });
          if (batch.length < pageSize) break;
          offset += pageSize;
        }
        const sorted = Array.from(set).sort((a, b) => b.localeCompare(a));
        if (!cancelled) {
          setAvailableCompetencias(sorted);
          setSelectedCompetencias(prev => prev.filter(c => sorted.includes(c)));
        }
      } catch {
        if (!cancelled) setAvailableCompetencias([]);
      } finally {
        if (!cancelled) setLoadingCompetencias(false);
      }
    };
    loadCompetencias();
    return () => { cancelled = true; };
  }, [open, selectedHospital]);

  // Load available months based on selected competências
  useEffect(() => {
    if (!open || !supabaseSih || selectedCompetencias.length === 0) {
      setAvailableMonths([]);
      setSelectedMonths([]);
      return;
    }
    let cancelled = false;
    const loadMonths = async () => {
      try {
        const set = new Set<number>();
        const pageSize = 1000;
        let offset = 0;
        for (; ;) {
          let q = supabaseSih
            .from('sih_rd')
            .select('dt_saida')
            .range(offset, offset + pageSize - 1);

          // Filter by selected competências
          const compPairs = selectedCompetencias.map(c => ({
            year: Number(c.slice(0, 4)),
            month: Number(c.slice(4, 6))
          }));
          const compYears = Array.from(new Set(compPairs.map(p => p.year)));
          const compMonths = Array.from(new Set(compPairs.map(p => p.month)));

          if (compYears.length === 1 && compMonths.length === 1) {
            q = q.eq('ano_cmpt', compYears[0]).eq('mes_cmpt', compMonths[0]);
          } else if (compYears.length === 1) {
            q = q.eq('ano_cmpt', compYears[0]).in('mes_cmpt', compMonths);
          } else {
            q = q.in('ano_cmpt', compYears).in('mes_cmpt', compMonths);
          }

          if (selectedHospital !== 'all') q = q.eq('hospital_id', selectedHospital);

          const { data, error } = await q;
          if (error) throw error;
          const batch = (data || []) as any[];
          if (batch.length === 0) break;
          batch.forEach((r: any) => {
            const dt = r?.dt_saida;
            if (!dt) return;
            // Extract month from ISO date (YYYY-MM-DD) or timestamp
            const s = String(dt);
            const match = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
            if (match) {
              const month = parseInt(match[2], 10);
              if (month >= 1 && month <= 12) set.add(month);
            } else {
              // Try to parse as Date object
              try {
                const date = new Date(dt);
                if (!isNaN(date.getTime())) {
                  const month = date.getMonth() + 1;
                  if (month >= 1 && month <= 12) set.add(month);
                }
              } catch { }
            }
          });
          if (batch.length < pageSize) break;
          offset += pageSize;
        }
        const sorted = Array.from(set).sort((a, b) => a - b);
        if (!cancelled) {
          setAvailableMonths(sorted);
          // Auto-select all months when they become available
          setSelectedMonths(sorted.map(String));
        }
      } catch (e) {
        console.error('Error loading months:', e);
        if (!cancelled) setAvailableMonths([]);
      }
    };
    loadMonths();
    return () => { cancelled = true; };
  }, [open, selectedHospital, selectedCompetencias]);


  const hospitalLabel = useMemo(() => {
    if (selectedHospital === 'all') return 'Todos os hospitais';
    return hospitals.find(h => h.id === selectedHospital)?.name || 'Hospital';
  }, [hospitals, selectedHospital]);

  const competenciasLabel = useMemo(() => {
    if (selectedCompetencias.length === 0) return 'Todas';
    return selectedCompetencias
      .map(c => `${c.slice(4, 6)}/${c.slice(0, 4)}`)
      .join(', ');
  }, [selectedCompetencias]);

  const monthLabel = useMemo(() => {
    if (selectedMonths.length === 0) return 'Todos os meses';
    if (selectedMonths.length === availableMonths.length) return 'Todos os meses';
    return `${selectedMonths.length} mês(es) selecionado(s)`;
  }, [selectedMonths, availableMonths]); 



  // Direct save functions for summary-only report
  const savePdfReportDirect = (summaryData: { hospitalId: string; hospitalName: string; month: number; year: number; aihCount: number; totalValue: number }[], info: { hospitalLabel: string; competenciasLabel: string; monthLabel: string; totalRows: number; totalValue: number }) => {
    const doc = new jsPDF('landscape');
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();

    // Color palette
    const colors = {
      primary: [10, 92, 54] as [number, number, number], // #0a5c36 (dark green)
      secondary: [0, 51, 102] as [number, number, number], // #003366 (dark blue)
      accent: [255, 50, 50] as [number, number, number], // #ffc107 (yellow for totals)
      text: [45, 55, 72] as [number, number, number], // #2d3748 (dark gray)
      lightBg: [245, 247, 250] as [number, number, number], // #f5f7fa (very light gray)
      border: [226, 232, 240] as [number, number, number], // #e2e8f0 (light gray)
    };

    // ========== PAGE 1: Cover ==========
    // Gradient header background
    doc.setFillColor(...colors.primary);
    doc.rect(0, 0, pageWidth, 60, 'F');

    // Title
    doc.setFontSize(24);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(255, 255, 255);
    doc.text('RELATÓRIO APROVADOS', pageWidth / 2, 30, { align: 'center' });
    doc.setFontSize(20);
    doc.text('POR COMPETÊNCIA', pageWidth / 2, 45, { align: 'center' });

    // Decorative line
    doc.setDrawColor(...colors.accent);
    doc.setLineWidth(2);
    doc.line(pageWidth / 2 - 30, 55, pageWidth / 2 + 30, 55);

    // Metadata box
    const boxX = 20;
    const boxY = 80;
    const boxWidth = pageWidth - 40;
    const boxHeight = 70;

    doc.setFillColor(255, 255, 255);
    doc.setDrawColor(...colors.border);
    doc.setLineWidth(1);
    doc.rect(boxX, boxY, boxWidth, boxHeight, 'FD');

    // Metadata content
    doc.setFontSize(11);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...colors.text);

    const now = new Date();
    const metadata = [
      { label: 'Unidade Hospitalar:', value: info.hospitalLabel },
      { label: 'Competência:', value: info.competenciasLabel },
      { label: 'Mês(es) da Alta:', value: info.monthLabel },
      { label: 'Gerado em:', value: now.toLocaleString('pt-BR') },
      { label: 'Total de AIHs:', value: info.totalRows.toString() },
      { label: 'Valor Total:', value: formatCurrency(info.totalValue) }
    ];

    let metaY = boxY + 15;
    metadata.forEach((item, idx) => {
      doc.setFont('helvetica', 'bold');
      doc.text(item.label, boxX + 10, metaY);
      doc.setFont('helvetica', 'normal');
      const valueX = boxX + 60;
      if (idx === 5) { // Valor Total in bold and accent color
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(...colors.accent);
      } else {
        doc.setTextColor(...colors.text);
      }
      doc.text(item.value, valueX, metaY);
      doc.setTextColor(...colors.text); // reset
      metaY += 10;
    });

    // ========== PAGE 2+: Hospital Sections ==========
    // Group summary data by hospital
    const hospitalGroups = new Map<string, { hospitalId: string; hospitalName: string; month: number; year: number; aihCount: number; totalValue: number }[]>();
    summaryData.forEach(row => {
      const key = row.hospitalId;
      if (!hospitalGroups.has(key)) {
        hospitalGroups.set(key, []);
      }
      hospitalGroups.get(key)!.push(row);
    });

    // Sort hospitals alphabetically by name
    const sortedHospitals = Array.from(hospitalGroups.entries()).sort(([, rowsA], [, rowsB]) => {
      return rowsA[0].hospitalName.localeCompare(rowsB[0].hospitalName);
    });

    // Add a new page for hospital sections
    doc.addPage();
    let startY = 30;

    // For each hospital, create a section with its table
    sortedHospitals.forEach(([hospitalId, hospitalRows], hospitalIndex) => {
      const hospitalName = hospitalRows[0].hospitalName;

      // Check if we need a new page (leave at least 50mm for table)
      if (startY > pageHeight - 70) {
        doc.addPage();
        startY = 30;
      }

      // Hospital section header with background
      const headerHeight = 18;
      doc.setFillColor(...colors.lightBg);
      doc.rect(20, startY, pageWidth - 40, headerHeight, 'F');
      doc.setDrawColor(...colors.border);
      doc.rect(20, startY, pageWidth - 40, headerHeight, 'S');

      // Hospital name
      doc.setFontSize(14);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(...colors.secondary);
      doc.text(hospitalName, 25, startY + 12);

      startY += headerHeight + 5;

      // Prepare table data (already sorted by year DESC, month DESC)
      const tableBody = hospitalRows.map(row => [
        getMonthYearLabel(row.month, row.year),
        row.aihCount.toString(),
        formatCurrency(row.totalValue)
      ]);

      // Add total row
      const totalAihs = hospitalRows.reduce((sum, r) => sum + r.aihCount, 0);
      const totalVal = hospitalRows.reduce((sum, r) => sum + r.totalValue, 0);
      tableBody.push(['Total', totalAihs.toString(), formatCurrency(totalVal)]);

      // Draw table
      autoTable(doc, {
        head: [['Mês', 'Qtd AIHs', 'Valor Total']],
        body: tableBody,
        startY,
        theme: 'grid',
        headStyles: { 
          fillColor: colors.primary, 
          textColor: [255, 255, 255], 
          fontStyle: 'bold', 
          fontSize: 9, 
          halign: 'center', 
          cellPadding: { top: 4, bottom: 4, left: 4, right: 4 }
        },
        bodyStyles: { 
          fontSize: 8, 
          textColor: colors.text, 
          cellPadding: { top: 3, bottom: 3, left: 4, right: 4 }
        },
        columnStyles: {
          0: { cellWidth: 'auto', halign: 'center' },
          1: { cellWidth: 'auto', halign: 'center' },
          2: { cellWidth: 'auto', halign: 'right', fontStyle: 'bold', textColor: colors.accent }
        },
        styles: { 
          overflow: 'linebreak', 
          cellPadding: 2, 
          fontSize: 8,
          lineColor: colors.border,
          lineWidth: 0.5
        },
        margin: { left: 20, right: 20 },
        alternateRowStyles: { fillColor: colors.lightBg },
      });

      startY = doc.lastAutoTable.finalY + 15;

      // Add spacing between hospitals (except after last one)
      if (hospitalIndex < sortedHospitals.length - 1) {
        startY += 8;
      }
    });

    doc.save(`Aprovados_Competencia_${new Date().toISOString().slice(0, 10)}.pdf`);
  };

  const saveExcelReportDirect = (summaryData: { hospitalId: string; hospitalName: string; month: number; year: number; aihCount: number; totalValue: number }[], info: { hospitalLabel: string; competenciasLabel: string; monthLabel: string; totalRows: number; totalValue: number }) => {
    const nowLabel = new Date().toLocaleString('pt-BR');
    const wb = XLSX.utils.book_new();

    // Group summary data by hospital
    const hospitalGroups = new Map<string, { hospitalId: string; hospitalName: string; month: number; year: number; aihCount: number; totalValue: number }[]>();
    summaryData.forEach(row => {
      const key = row.hospitalId;
      if (!hospitalGroups.has(key)) {
        hospitalGroups.set(key, []);
      }
      hospitalGroups.get(key)!.push({
        hospitalId: row.hospitalId,
        hospitalName: row.hospitalName,
        month: row.month,
        year: row.year,
        aihCount: row.aihCount,
        totalValue: row.totalValue,
      });
    });

    // Sort hospitals alphabetically by name
    const sortedHospitals = Array.from(hospitalGroups.entries()).sort(([, rowsA], [, rowsB]) => {
      return rowsA[0].hospitalName.localeCompare(rowsB[0].hospitalName);
    });

    // Track sheet name usage to ensure uniqueness
    const usedSheetNames = new Set<string>();

    // Create a sheet for each hospital
    sortedHospitals.forEach(([hospitalId, hospitalRows]) => {
      const hospitalName = hospitalRows[0].hospitalName;

      // Create a valid Excel sheet name (max 31 chars, no special chars that Excel doesn't like)
      let sheetName = hospitalName.replace(/[\\/?*\[\]:]/g, '').trim();
      if (sheetName.length > 31) {
        sheetName = sheetName.substring(0, 28) + '...';
      }

      // Ensure uniqueness by adding numeric suffix if needed
      const baseSheetName = sheetName;
      let suffix = 1;
      while (usedSheetNames.has(sheetName)) {
        const truncated = baseSheetName.substring(0, 31 - String(suffix).length - 1);
        sheetName = `${truncated}${suffix}`;
        suffix++;
      }
      usedSheetNames.add(sheetName);

      // Prepare table data (sorted by year DESC, month DESC)
      const tableBody: [string, string | number, string][] = hospitalRows
        .sort((a, b) => {
          if (a.year !== b.year) return b.year - a.year;
          return b.month - a.month;
        })
        .map(row => [
          getMonthYearLabel(row.month, row.year),
          row.aihCount,
          formatCurrency(row.totalValue)
        ]) as [string, string | number, string][];

      // Add total row
      const totalAihs = hospitalRows.reduce((sum, r) => sum + r.aihCount, 0);
      const totalVal = hospitalRows.reduce((sum, r) => sum + r.totalValue, 0);
      tableBody.push(['Total', totalAihs, formatCurrency(totalVal)]);

      const ws = XLSX.utils.aoa_to_sheet([['Mês', 'Qtd AIHs', 'Valor Total'], ...tableBody]);
      (ws as any)['!cols'] = [
        { wch: 12 },
        { wch: 12 },
        { wch: 18 }
      ];
      XLSX.utils.book_append_sheet(wb, ws, sheetName);
    });

    // Add metadata sheet
    const wsMeta = XLSX.utils.aoa_to_sheet([
      ['Hospital', info.hospitalLabel],
      ['Competência', info.competenciasLabel],
      ['Mês Alta', info.monthLabel],
      ['Gerado em', nowLabel],
      ['Total de AIHs', info.totalRows],
      ['Valor Total', formatCurrency(info.totalValue)],
    ]);
    XLSX.utils.book_append_sheet(wb, wsMeta, 'Metadados');

    const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 16);
    XLSX.writeFile(wb, `Aprovados_Competencia_${stamp}.xlsx`);
  };


  const handleGenerateReport = async (format: 'pdf' | 'excel' = 'pdf') => {
    try {
      if (selectedCompetencias.length === 0) {
        toast.error('Selecione pelo menos uma competência.');
        return;
      }

      setGenerating(true);
      if (!supabaseSih) {
        toast.error('Fonte SIH remota não configurada');
        return;
      }

      // Build competence filter
      const compPairs = selectedCompetencias.map(c => ({
        year: Number(c.slice(0, 4)),
        month: Number(c.slice(4, 6))
      }));
      const compYears = Array.from(new Set(compPairs.map(p => p.year)));
      const compMonths = Array.from(new Set(compPairs.map(p => p.month)));

      const applyCompFilter = (q: any) => {
        if (compPairs.length === 0) return q;
        if (compYears.length === 1 && compMonths.length === 1) {
          q = q.eq('ano_cmpt', compYears[0]).eq('mes_cmpt', compMonths[0]);
        } else if (compYears.length === 1) {
          q = q.eq('ano_cmpt', compYears[0]).in('mes_cmpt', compMonths);
        } else {
          q = q.in('ano_cmpt', compYears).in('mes_cmpt', compMonths);
        }
        return q;
      };

      // Fetch remote RD records (AIHs)
      const rdRows: Array<{ n_aih: string; dt_saida?: string; hospital_id?: string; competencia?: string }> = [];
      const pageSize = 1000;
      let offset = 0;

      for (; ;) {
        let q = supabaseSih
          .from('sih_rd')
          .select('n_aih, dt_saida, hospital_id, ano_cmpt, mes_cmpt')
          .not('dt_saida', 'is', null);

        q = applyCompFilter(q);
        if (selectedHospital !== 'all') q = q.eq('hospital_id', selectedHospital);

        q = q.order('dt_saida', { ascending: true }).range(offset, offset + pageSize - 1);

        const { data, error } = await q;
        if (error) throw error;
        const batch = (data || []) as any[];
        if (batch.length === 0) break;
        batch.forEach((r: any) => {
          rdRows.push({
            n_aih: String(r?.n_aih || ''),
            dt_saida: r?.dt_saida ? String(r.dt_saida) : undefined,
            hospital_id: r?.hospital_id ? String(r.hospital_id) : undefined,
            competencia: (r?.ano_cmpt && r?.mes_cmpt) ? `${String(r.ano_cmpt).padStart(4, '0')}${String(r.mes_cmpt).padStart(2, '0')}` : undefined,
          });
        });
        if (batch.length < pageSize) break;
        offset += pageSize;
      }

      if (rdRows.length === 0) {
        toast.warning('Nenhum registro encontrado para os filtros selecionados');
        return;
      }

      // Get unique AIH numbers
      const aihKeys = Array.from(new Set(rdRows.map(r => normalizeAih(r.n_aih)).filter(Boolean)));

      // Fetch SP (procedures) for these AIHs
      const spRows: any[] = [];
      if (aihKeys.length > 0) {
        const chunkSize = 80;
        for (let i = 0; i < aihKeys.length; i += chunkSize) {
          const chunk = aihKeys.slice(i, i + chunkSize);
          const { data, error } = await supabaseSih
            .from('sih_sp')
            .select('sp_naih, sp_valato')
            .in('sp_naih', chunk);
          if (error) throw error;
          if (data && data.length > 0) spRows.push(...data);
        }
      }

      // Group SP by AIH
      const spByAih = new Map<string, number>();
      spRows.forEach((r) => {
        const key = normalizeAih(r?.sp_naih);
        if (!key) return;
        const val = Number(r?.sp_valato || 0);
        const existing = spByAih.get(key) || 0;
        spByAih.set(key, existing + val);
      });

      // Fetch hospital names
      const hospitalNameById = new Map<string, string>();
      if (selectedHospital === 'all') {
        const { data: allHospitals } = await supabase.from('hospitals').select('id,name');
        (allHospitals || []).forEach((h: any) => hospitalNameById.set(String(h.id), String(h.name || '')));
      } else {
        const h = hospitals.find(h => h.id === selectedHospital);
        if (h) hospitalNameById.set(selectedHospital, h.name);
      }

      // Build summary data: group by hospital and month (from dt_saida)
      const summaryMap = new Map<string, SummaryRow>();

      // Initialize summaryMap from rdRows
      rdRows.forEach((rd) => {
        const hospitalId = rd.hospital_id || selectedHospital || 'unknown';
        const hospitalName = hospitalNameById.get(String(hospitalId)) || 'N/A';
        
        // Extract month and year from dt_saida
        const dt = rd.dt_saida;
        if (!dt) return;
        let monthNum: number | null = null;
        let yearNum: number | null = null;
        const s = String(dt);
        const match = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
        if (match) {
          yearNum = parseInt(match[1], 10);
          monthNum = parseInt(match[2], 10);
        } else {
          try {
            const date = new Date(dt);
            if (!isNaN(date.getTime())) {
              yearNum = date.getFullYear();
              monthNum = date.getMonth() + 1;
            }
          } catch { }
        }
        if (!monthNum || !yearNum) return;

        const key = `${hospitalId}::${yearNum}::${monthNum}`;
        const existing = summaryMap.get(key);
        if (existing) {
          existing.aihCount += 1;
        } else {
          summaryMap.set(key, {
            hospitalId,
            hospitalName,
            month: monthNum,
            year: yearNum,
            aihCount: 1,
            totalValue: 0 // will be updated later with procedure values
          });
        }
      });

      // Add procedure values to summary
      rdRows.forEach((rd) => {
        const aihKey = normalizeAih(rd.n_aih);
        if (!aihKey) return;
        const approvedValue = spByAih.get(aihKey) || 0;
        
        const hospitalId = rd.hospital_id || selectedHospital;
        const dt = rd.dt_saida;
        if (!dt) return;
        let monthNum: number | null = null;
        let yearNum: number | null = null;
        const s = String(dt);
        const match = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
        if (match) {
          yearNum = parseInt(match[1], 10);
          monthNum = parseInt(match[2], 10);
        } else {
          try {
            const date = new Date(dt);
            if (!isNaN(date.getTime())) {
              yearNum = date.getFullYear();
              monthNum = date.getMonth() + 1;
            }
          } catch { }
        }
        if (!monthNum || !yearNum) return;

        const key = `${hospitalId}::${yearNum}::${monthNum}`;
        const summaryEntry = summaryMap.get(key);
        if (summaryEntry) {
          summaryEntry.totalValue += approvedValue;
        }
      });

      // Convert summary map to sorted array
      let summaryData: { hospitalId: string; hospitalName: string; month: number; year: number; aihCount: number; totalValue: number }[] = Array.from(summaryMap.values()).sort((a, b) => {
        if (a.hospitalName !== b.hospitalName) return a.hospitalName.localeCompare(b.hospitalName);
        // Sort by year DESC, then month DESC (most recent first)
        if (a.year !== b.year) return b.year - a.year;
        return b.month - a.month;
      });

      // Apply month filter if selected
      if (selectedMonths.length > 0 && selectedMonths.length < availableMonths.length) {
        const monthNums = selectedMonths.map(m => parseInt(m, 10));
        summaryData = summaryData.filter(s => monthNums.includes(s.month));
      }

      if (summaryData.length === 0) {
        toast.warning('Nenhum registro encontrado após aplicar o filtro de mês');
        return;
      }

      const totalRows = summaryData.reduce((sum, s) => sum + s.aihCount, 0);
      const totalValue = summaryData.reduce((sum, s) => sum + s.totalValue, 0);
      const monthLabelText = selectedMonths.length === 0 || selectedMonths.length === availableMonths.length
        ? 'Todos os meses'
        : `${selectedMonths.length} mês(es) selecionado(s)`;

      const info = {
        hospitalLabel,
        competenciasLabel,
        monthLabel: monthLabelText,
        totalRows,
        totalValue
      };

      // Generate report directly
      if (format === 'pdf') {
        savePdfReportDirect(summaryData, info);
      } else {
        saveExcelReportDirect(summaryData, info);
      }

      toast.success('Relatório gerado com sucesso!');
      onOpenChange(false);
    } catch (e: any) {
      console.error('Erro ao gerar relatório Aprovados/Competência:', e);
      const msg = String(e?.message || e || '').trim();
      toast.error(msg ? `Erro ao gerar relatório: ${msg}` : 'Erro ao gerar relatório');
    } finally {
      setGenerating(false);
    }
  };



  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl">
        <DialogHeader>
          <DialogTitle>Aprovados por Competência</DialogTitle>
        </DialogHeader>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Card>
            <CardHeader className="pb-2">
              <div className="flex items-center justify-center gap-2 text-lg font-semibold text-black">
                <Building className="h-5 w-5" />
                Unidade Hospitalar
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              <Select value={selectedHospital} onValueChange={setSelectedHospital} disabled={loadingHospitals || generating}>
                <SelectTrigger>
                  <SelectValue placeholder={loadingHospitals ? 'Carregando...' : 'Selecione'} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos os Hospitais</SelectItem>
                  {(hospitals || []).map(h => (
                    <SelectItem key={h.id} value={h.id}>{h.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {loadingHospitals && (
                <div className="flex items-center gap-2 text-xs text-gray-600">
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  Carregando hospitais...
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="md:col-span-2">
            <CardHeader className="pb-2">
              <div className="flex items-center justify-center gap-2 text-lg font-semibold text-black">
                <Calendar className="h-5 w-5" />
                Competência SIH
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              {loadingCompetencias ? (
                <div className="flex items-center gap-2 text-xs text-gray-600">
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  Carregando competências...
                </div>
              ) : availableCompetencias.length === 0 ? (
                <div className="text-xs text-gray-500">Nenhuma competência disponível{selectedHospital !== 'all' ? ' para este hospital' : ''}.</div>
              ) : (
                <>
                  <div className="flex items-center gap-2 mb-2">
                    <Button
                      variant="outline"
                      size="sm"
                      className="text-xs h-7"
                      onClick={() => setSelectedCompetencias(selectedCompetencias.length === availableCompetencias.length ? [] : [...availableCompetencias])}
                      disabled={generating}
                    >
                      {selectedCompetencias.length === availableCompetencias.length ? 'Limpar' : 'Selecionar Todas'}
                    </Button>
                    {selectedCompetencias.length > 0 && (
                      <span className="text-xs text-gray-600">{selectedCompetencias.length} selecionada(s)</span>
                    )}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {availableCompetencias.map(c => {
                      const isSelected = selectedCompetencias.includes(c);
                      return (
                        <button
                          key={c}
                          type="button"
                          onClick={() => {
                            setSelectedCompetencias(prev =>
                              isSelected ? prev.filter(x => x !== c) : [...prev, c]
                            );
                          }}
                          disabled={generating}
                          className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium border transition-colors ${isSelected
                            ? 'bg-black text-white border-black'
                            : 'bg-white text-gray-700 border-gray-300 hover:border-gray-400'
                            }`}
                        >
                          {isSelected && <Check className="h-3.5 w-3.5" />}
                          {formatCompetenciaDisplay(c)}
                        </button>
                      );
                    })}
                  </div>
                </>
              )}
            </CardContent>
          </Card>

          <Card className="md:col-span-2">
            <CardHeader className="pb-2">
              <div className="flex items-center justify-center gap-2 text-lg font-semibold text-black">
                <Calendar className="h-5 w-5" />
                Mês Alta
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              {availableMonths.length === 0 ? (
                <div className="text-xs text-gray-500">
                  Selecione pelo menos uma competência para ver os meses disponíveis.
                </div>
              ) : (
                <>
                  <div className="flex items-center gap-2 mb-2">
                    <Button
                      variant="outline"
                      size="sm"
                      className="text-xs h-7"
                      onClick={() => setSelectedMonths(selectedMonths.length === availableMonths.length ? [] : availableMonths.map(String))}
                      disabled={generating}
                    >
                      {selectedMonths.length === availableMonths.length ? 'Limpar' : 'Selecionar Todos'}
                    </Button>
                    {selectedMonths.length > 0 && selectedMonths.length < availableMonths.length && (
                      <span className="text-xs text-gray-600">{selectedMonths.length} selecionado(s)</span>
                    )}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {availableMonths.map(m => {
                      const monthNames = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
                      const isSelected = selectedMonths.includes(String(m));
                      return (
                        <button
                          key={m}
                          type="button"
                          onClick={() => {
                            setSelectedMonths(prev =>
                              isSelected ? prev.filter(x => x !== String(m)) : [...prev, String(m)]
                            );
                          }}
                          disabled={generating}
                          className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium border transition-colors ${isSelected
                            ? 'bg-black text-white border-black'
                            : 'bg-white text-gray-700 border-gray-300 hover:border-gray-400'
                            }`}
                        >
                          {isSelected && <Check className="h-3.5 w-3.5" />}
                          {monthNames[m - 1]}
                        </button>
                      );
                    })}
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="flex items-center justify-end gap-2 pt-2">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={generating}>
            Fechar
          </Button>
          <Button
            variant="default"
            onClick={() => handleGenerateReport('pdf')}
            disabled={generating}
            className="bg-green-800 hover:bg-green-900 text-white inline-flex items-center gap-2"
          >
            {generating ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileText className="h-4 w-4" />}
            Gerar PDF
          </Button>
          <Button
            variant="default"
            onClick={() => handleGenerateReport('excel')}
            disabled={generating}
            className="bg-green-800 hover:bg-green-900 text-white inline-flex items-center gap-2"
          >
            {generating ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileSpreadsheet className="h-4 w-4" />}
            Gerar Excel
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

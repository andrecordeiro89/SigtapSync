import React, { useEffect, useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Input } from './ui/input';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { Switch } from './ui/switch';
import { DateRange } from '../types';
import type { DoctorWithPatients } from '../services/doctorPatientService';
import { DoctorsHierarchyV2Service } from '../services/doctorsHierarchyV2';

interface DoctorsSpecialtyComparisonProps {
  dateRange?: DateRange;
  selectedHospitals?: string[];
  selectedCareCharacter?: string;
  selectedSpecialty?: string;
  searchTerm?: string;
  // Dados já carregados no dashboard (filtrados pelo hospital ativo)
  doctorsFromDashboard: DoctorWithPatients[];
}

type AggregatedDoctor = {
  doctorName: string;
  doctorCns: string;
  specialty: string;
  hospitalName: string;
  aihCount: number;
  totalAihValue: number;
  avgAihValue: number;
};

const formatBRL = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

const DoctorsSpecialtyComparison: React.FC<DoctorsSpecialtyComparisonProps> = ({
  dateRange,
  selectedHospitals = ['all'],
  selectedCareCharacter = 'all',
  selectedSpecialty = 'all',
  searchTerm = '',
  doctorsFromDashboard,
}) => {
  const [useAllHospitals, setUseAllHospitals] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(false);
  const [allHospDoctors, setAllHospDoctors] = useState<DoctorWithPatients[] | null>(null);
  const [doctorFilter, setDoctorFilter] = useState<string>('');
  const [compareA, setCompareA] = useState<string>('');
  const [compareB, setCompareB] = useState<string>('');
  const [localSpecialty, setLocalSpecialty] = useState<string>(() => (selectedSpecialty && selectedSpecialty !== 'all') ? selectedSpecialty : 'all');
  const [sortBy, setSortBy] = useState<'doctor' | 'specialty'>('doctor');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
  const [granularity, setGranularity] = useState<'day' | 'week'>('week');

  // Carregar dados abrangendo TODOS os hospitais quando o toggle estiver ativado
  useEffect(() => {
    const loadAllHospitals = async () => {
      if (!useAllHospitals) return;
      try {
        setLoading(true);
        const dateFromISO = dateRange ? dateRange.startDate.toISOString() : undefined;
        const dateToISO = dateRange ? dateRange.endDate.toISOString() : undefined;
        const data = await DoctorsHierarchyV2Service.getDoctorsHierarchyV2({
          dateFromISO,
          dateToISO,
          careCharacter: selectedCareCharacter,
          // hospitalIds omitido → todos os hospitais
        });
        setAllHospDoctors(data);
      } catch (e) {
        console.warn('Falha ao carregar dados de todos os hospitais para comparativo:', e);
        setAllHospDoctors(null);
      } finally {
        setLoading(false);
      }
    };
    loadAllHospitals();
  }, [useAllHospitals, dateRange?.startDate?.toISOString(), dateRange?.endDate?.toISOString(), selectedCareCharacter]);

  // Fonte efetiva de dados: ou todos os hospitais, ou os dados do dashboard (hospital ativo)
  const effectiveDoctors: DoctorWithPatients[] = useMemo(() => {
    if (useAllHospitals && Array.isArray(allHospDoctors)) return allHospDoctors;
    return doctorsFromDashboard || [];
  }, [useAllHospitals, allHospDoctors, doctorsFromDashboard]);

  // Agregar por médico (CNS) somando múltiplos hospitais
  const aggregatedDoctors: AggregatedDoctor[] = useMemo(() => {
    const byCns = new Map<string, AggregatedDoctor>();
    (effectiveDoctors || []).forEach(d => {
      const cns = (d.doctor_info.cns || d.doctor_info.name || '').toString();
      const name = d.doctor_info.name || cns || 'Médico';
      const specialty = (d.doctor_info.specialty || 'Não informado').trim();
      const hospSet = new Set<string>((d.hospitals || []).map((h: any) => (h?.hospital_name || '').trim()).filter(Boolean));
      const aihs = d.patients || [];
      const totalAihs = aihs.length;
      const totalValue = aihs.reduce((s, p) => s + (p.total_value_reais || 0), 0);
      const prev = byCns.get(cns) || { doctorName: name, doctorCns: cns, specialty, hospitalName: '', aihCount: 0, totalAihValue: 0, avgAihValue: 0 };
      prev.aihCount += totalAihs;
      prev.totalAihValue += totalValue;
      prev.specialty = prev.specialty || specialty;
      // Acumular nomes de hospitais (usa primeiro ou 'Múltiplos')
      const existing = prev.hospitalName ? new Set(prev.hospitalName.split(' | ').map(s => s.trim()).filter(Boolean)) : new Set<string>();
      hospSet.forEach(h => existing.add(h));
      prev.hospitalName = existing.size <= 1 ? (Array.from(existing)[0] || '') : 'Múltiplos';
      byCns.set(cns, prev);
    });
    const arr = Array.from(byCns.values()).map(r => ({
      ...r,
      avgAihValue: r.aihCount > 0 ? r.totalAihValue / r.aihCount : 0,
    }));
    return arr;
  }, [effectiveDoctors]);

  // Especialidades disponíveis a partir dos dados efetivos ou do estado global
  const availableSpecialties = useMemo(() => {
    const set = new Set<string>();
    aggregatedDoctors.forEach(d => set.add(d.specialty || 'Não informado'));
    return Array.from(set).sort((a, b) => a.localeCompare(b, 'pt-BR'));
  }, [aggregatedDoctors]);

  // Especialidade ativa efetiva
  const effectiveSpecialty = useMemo(() => {
    if (localSpecialty && localSpecialty !== 'all') return localSpecialty;
    if (selectedSpecialty && selectedSpecialty !== 'all') return selectedSpecialty;
    return 'all';
  }, [localSpecialty, selectedSpecialty]);

  // Filtrar por especialidade e termo de busca de médico
  const filteredRows = useMemo(() => {
    let rows = aggregatedDoctors;
    if (effectiveSpecialty !== 'all') {
      rows = rows.filter(r => (r.specialty || '').toLowerCase() === effectiveSpecialty.toLowerCase());
    }
    const term = (doctorFilter || searchTerm || '').trim().toLowerCase();
    if (term) {
      rows = rows.filter(r => r.doctorName.toLowerCase().includes(term) || r.doctorCns.toLowerCase().includes(term));
    }
    return rows;
  }, [aggregatedDoctors, effectiveSpecialty, doctorFilter, searchTerm]);

  // Estatísticas da especialidade: média por AIH (ponderada)
  const specialtyStats = useMemo(() => {
    const totalAihs = filteredRows.reduce((s, r) => s + r.aihCount, 0);
    const totalValue = filteredRows.reduce((s, r) => s + r.totalAihValue, 0);
    const avg = totalAihs > 0 ? totalValue / totalAihs : 0;
    return { totalAihs, totalValue, specialtyAvg: avg };
  }, [filteredRows]);

  // Linhas com desvio em relação à média da especialidade
  const tableRows = useMemo(() => {
    let rows = [...filteredRows];
    if (sortBy === 'doctor') {
      rows = rows.sort((a, b) => a.doctorName.localeCompare(b.doctorName, 'pt-BR'));
      if (sortDir === 'desc') rows.reverse();
    } else if (sortBy === 'specialty') {
      rows = rows.sort((a, b) => (a.specialty || '').localeCompare(b.specialty || '', 'pt-BR'));
      if (sortDir === 'desc') rows.reverse();
    }
    return rows;
  }, [filteredRows, sortBy, sortDir]);

  const toggleSort = (key: 'doctor' | 'specialty') => {
    setSortBy(prev => {
      if (prev === key) {
        setSortDir(d => (d === 'asc' ? 'desc' : 'asc'));
        return prev;
      }
      setSortDir('asc');
      return key;
    });
  };

  // Opções para comparativo direto de 2 médicos
  const compareOptions = useMemo(() => {
    const rows = effectiveSpecialty === 'all' ? aggregatedDoctors : aggregatedDoctors.filter(r => (r.specialty || '').toLowerCase() === effectiveSpecialty.toLowerCase());
    return rows.sort((a, b) => a.doctorName.localeCompare(b.doctorName, 'pt-BR'));
  }, [aggregatedDoctors, effectiveSpecialty]);

  // Séries por médico (linha: evolução mensal das médias das AIHs)
  const doctorPatientsMap = useMemo(() => {
    const map = new Map<string, any[]>();
    (effectiveDoctors || []).forEach(d => {
      const cns = (d.doctor_info.cns || d.doctor_info.name || '').toString();
      map.set(cns, d.patients || []);
    });
    return map;
  }, [effectiveDoctors]);

  const formatDayKey = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  const parseISODate = (s: any) => {
    try { return new Date(s); } catch { return null; }
  };
  const generateDaysBetween = (start: Date, end: Date) => {
    const arr: string[] = [];
    const cur = new Date(start.getFullYear(), start.getMonth(), start.getDate(), 12, 0, 0, 0);
    const last = new Date(end.getFullYear(), end.getMonth(), end.getDate(), 12, 0, 0, 0);
    while (cur <= last) {
      arr.push(formatDayKey(cur));
      cur.setDate(cur.getDate() + 1);
    }
    return arr;
  };

  const startOfISOWeek = (d: Date): Date => {
    const date = new Date(d);
    const day = (date.getDay() + 6) % 7; // Mon=0..Sun=6
    date.setDate(date.getDate() - day);
    date.setHours(12, 0, 0, 0);
    return date;
  };
  const formatWeekKey = (d: Date) => {
    const s = startOfISOWeek(d);
    return formatDayKey(s); // use dd/mm label from week start
  };
  const generateWeeksBetween = (start: Date, end: Date) => {
    const arr: string[] = [];
    let cur = startOfISOWeek(start);
    const last = startOfISOWeek(end);
    while (cur <= last) {
      arr.push(formatDayKey(cur));
      cur.setDate(cur.getDate() + 7);
    }
    return arr;
  };

  const topDoctors = useMemo(() => {
    const rows = [...filteredRows].sort((a, b) => b.avgAihValue - a.avgAihValue);
    return rows.slice(0, 6);
  }, [filteredRows]);

  const allDays = useMemo(() => {
    if (dateRange) {
      return generateDaysBetween(dateRange.startDate, dateRange.endDate);
    }
    // Fallback: inferir range pelos dados
    let minD: Date | null = null;
    let maxD: Date | null = null;
    topDoctors.forEach(r => {
      const pts = doctorPatientsMap.get(r.doctorCns) || [];
      pts.forEach((p: any) => {
        const iso = (p.aih_info as any)?.discharge_date;
        if (!iso) return;
        const d = parseISODate(iso);
        if (!d) return;
        if (!minD || d < minD) minD = d;
        if (!maxD || d > maxD) maxD = d;
      });
    });
    if (!minD || !maxD) return [];
    return generateDaysBetween(minD, maxD);
  }, [topDoctors, doctorPatientsMap, dateRange?.startDate, dateRange?.endDate]);

  const allWeeks = useMemo(() => {
    if (dateRange) return generateWeeksBetween(dateRange.startDate, dateRange.endDate);
    if (allDays.length === 0) return [];
    const first = parseISODate(allDays[0])!;
    const last = parseISODate(allDays[allDays.length - 1])!;
    return generateWeeksBetween(first, last);
  }, [dateRange?.startDate, dateRange?.endDate, allDays]);

  const series = useMemo(() => {
    const seriesArr: Array<{ name: string; cns: string; color: string; values: Array<number | null>; avg: number } > = [];
    const palette = ['#2563EB', '#16A34A', '#DC2626', '#7C3AED', '#EA580C', '#0891B2', '#CA8A04', '#9333EA'];
    topDoctors.forEach((r, idx) => {
      const pts = doctorPatientsMap.get(r.doctorCns) || [];
      const byDay = new Map<string, { sum: number; count: number }>();
      pts.forEach((p: any) => {
        const iso = (p.aih_info as any)?.discharge_date;
        const v = Number(p.total_value_reais || 0);
        if (!iso || !isFinite(v) || v <= 0) return;
        const d = parseISODate(iso);
        if (!d) return;
        const key = formatDayKey(d);
        const cur = byDay.get(key) || { sum: 0, count: 0 };
        cur.sum += v; cur.count += 1; byDay.set(key, cur);
      });

      let values: Array<number | null> = [];
      if (granularity === 'day') {
        values = allDays.map(day => {
          const bucket = byDay.get(day);
          return bucket && bucket.count > 0 ? bucket.sum / bucket.count : null;
        });
      } else {
        // Semanal: agregação por semana (média das médias diárias)
        const byWeek = new Map<string, { sum: number; count: number }>();
        for (const [day, bucket] of byDay.entries()) {
          const d = parseISODate(day)!;
          const wk = formatWeekKey(d);
          const avg = bucket.count > 0 ? bucket.sum / bucket.count : 0;
          const cur = byWeek.get(wk) || { sum: 0, count: 0 };
          cur.sum += avg; cur.count += 1; byWeek.set(wk, cur);
        }
        values = allWeeks.map(wk => {
          const b = byWeek.get(wk);
          return b && b.count > 0 ? b.sum / b.count : null;
        });
      }
      seriesArr.push({ name: r.doctorName, cns: r.doctorCns, color: palette[idx % palette.length], values, avg: r.avgAihValue });
    });
    return seriesArr;
  }, [topDoctors, doctorPatientsMap, allDays, allWeeks, granularity]);

  const maxY = useMemo(() => {
    let mx = 0;
    series.forEach(s => s.values.forEach(v => { if (v != null && v > mx) mx = v; }));
    return mx;
  }, [series]);

  const abbreviateName = (name: string): string => {
    try {
      const parts = (name || '').trim().split(/\s+/);
      if (parts.length <= 1) return name;
      return `${parts[0]} ${parts[parts.length - 1].charAt(0)}.`;
    } catch { return name; }
  };

  const doctorA = compareOptions.find(d => d.doctorCns === compareA || d.doctorName === compareA);
  const doctorB = compareOptions.find(d => d.doctorCns === compareB || d.doctorName === compareB);

  const exportTableCsv = () => {
    try {
      const lines: string[] = [];
      const quote = (t: any) => `"${String(t ?? '').replace(/"/g, '""')}"`;
      const toDec = (n: any) => String(Number(n || 0).toFixed(2)).replace('.', ',');
      lines.push(['Médico', 'Especialidade', 'Hospital', 'AIHs', 'Média AIH (BRL)'].join(';'));
      tableRows.forEach(r => {
        lines.push([
          quote(r.doctorName),
          quote(r.specialty || ''),
          quote(r.hospitalName || ''),
          String(r.aihCount || 0),
          toDec(r.avgAihValue || 0)
        ].join(';'));
      });
      const csv = '\uFEFF' + lines.join('\r\n');
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `comparativos_${new Date().toISOString().slice(0,10)}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      console.error('Erro ao exportar CSV Comparativos:', e);
    }
  };

  const toDataUrl = async (src: string): Promise<string | null> => {
    try {
      const res = await fetch(encodeURI(src));
      if (!res.ok) return null;
      const blob = await res.blob();
      return await new Promise<string>((resolve) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(String(reader.result || ''));
        reader.readAsDataURL(blob);
      });
    } catch {
      return null;
    }
  };

  const exportTablePdf = async () => {
    try {
      const { default: jsPDF } = await import('jspdf');
      const autoTable = (await import('jspdf-autotable')).default;
      const doc = new jsPDF({ orientation: 'landscape', unit: 'pt', format: 'a4' });

      // Logo (se disponível)
      const logoData = await toDataUrl('/CIS Sem fundo.jpg');
      let headerBottomY = 40; // será ajustado
      if (logoData) {
        try {
          // Manter proporção original 624x339 (~1.842)
          const logoW = 120; // pts
          const logoH = Math.round((logoW / 624 * 339)); // ~65
          const logoY = 20;
          doc.addImage(logoData, 'JPEG', 40, logoY, logoW, logoH);
          headerBottomY = Math.max(headerBottomY, logoY + logoH);
        } catch {}
      }

      const title = 'Relatório — Comparativos por Especialidade';
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(14);
      const titleY = 40;
      doc.text(title, 190, titleY);
      headerBottomY = Math.max(headerBottomY, titleY);

      doc.setFontSize(10);
      const period = dateRange ? `${dateRange.startDate.toLocaleDateString('pt-BR')} a ${dateRange.endDate.toLocaleDateString('pt-BR')}` : '—';
      const subtitle = `Especialidade: ${effectiveSpecialty !== 'all' ? effectiveSpecialty : 'Todas'}  •  Período: ${period}`;
      const subY = titleY + 18;
      doc.text(subtitle, 190, subY);
      headerBottomY = Math.max(headerBottomY, subY);
      const startY = headerBottomY + 18; // folga para evitar sobreposição

      const head = [['Médico', 'Especialidade', 'Hospital', 'AIHs', 'Média AIH (BRL)']];
      const body = tableRows.map(r => [
        r.doctorName,
        r.specialty || '',
        r.hospitalName || '',
        String(r.aihCount || 0),
        (r.avgAihValue || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
      ]);

      autoTable(doc, {
        head,
        body,
        startY,
        styles: { fontSize: 8, cellPadding: 6, overflow: 'linebreak' },
        headStyles: { fillColor: [30, 64, 175] },
        alternateRowStyles: { fillColor: [245, 247, 255] },
        columnStyles: {
          0: { cellWidth: 220 }, // Médico
          1: { cellWidth: 140 }, // Especialidade
          2: { cellWidth: 180 }, // Hospital
          3: { cellWidth: 60, halign: 'right' },
          4: { cellWidth: 100, halign: 'right' }
        },
        margin: { left: 40, right: 40 }
      });

      doc.save(`comparativos_${new Date().toISOString().slice(0,10)}.pdf`);
    } catch (e) {
      console.error('Erro ao gerar PDF Comparativos:', e);
    }
  };

  return (
    <div className="space-y-4">
      <Card className="border-slate-200">
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center justify-between">
            <span>Comparativos: Médicos x Especialidade</span>
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2">
                <span className="text-xs text-slate-600">Todos os hospitais</span>
                <Switch checked={useAllHospitals} onCheckedChange={setUseAllHospitals} />
              </div>
              <Badge variant="outline" className="bg-slate-50 text-slate-700 border-slate-200">
                {effectiveSpecialty !== 'all' ? effectiveSpecialty : 'Todas as especialidades'}
              </Badge>
            </div>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
            <div className="w-full">
              <label className="text-xs font-medium text-gray-600 uppercase tracking-wide mb-1.5 block">Especialidade (local)</label>
              <div className="flex items-center gap-2">
                <select
                  value={effectiveSpecialty}
                  onChange={(e) => setLocalSpecialty(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg bg-white text-sm h-9"
                >
                  <option value="all">Todas</option>
                  {availableSpecialties.map(spec => (
                    <option key={spec} value={spec}>{spec}</option>
                  ))}
                </select>
                {effectiveSpecialty !== 'all' && (
                  <button
                    onClick={() => setLocalSpecialty('all')}
                    className="px-2 py-1 text-xs text-blue-600 hover:text-blue-800 hover:bg-blue-50 rounded transition-colors"
                    title="Limpar filtro de especialidade"
                  >
                    ✕
                  </button>
                )}
              </div>
            </div>
            <div className="flex-1">
              <label className="text-xs font-medium text-gray-600 uppercase tracking-wide mb-1.5 block">Filtrar Médico</label>
              <div className="relative">
                <Input
                  placeholder="Nome ou CNS do médico"
                  value={doctorFilter}
                  onChange={(e) => setDoctorFilter(e.target.value)}
                  className="h-9"
                />
                {doctorFilter && (
                  <button
                    onClick={() => setDoctorFilter('')}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                    title="Limpar"
                  >
                    ✕
                  </button>
                )}
              </div>
            </div>
            <div>
              <label className="text-xs font-medium text-gray-600 uppercase tracking-wide mb-1.5 block">Comparar A</label>
              <select
                value={compareA}
                onChange={(e) => setCompareA(e.target.value)}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg bg-white text-sm h-9"
              >
                <option value="">Selecione um médico</option>
                {compareOptions.map(opt => (
                  <option key={opt.doctorCns || opt.doctorName} value={opt.doctorCns || opt.doctorName}>
                    {opt.doctorName}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs font-medium text-gray-600 uppercase tracking-wide mb-1.5 block">Comparar B</label>
              <select
                value={compareB}
                onChange={(e) => setCompareB(e.target.value)}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg bg-white text-sm h-9"
              >
                <option value="">Selecione um médico</option>
                {compareOptions.map(opt => (
                  <option key={opt.doctorCns || opt.doctorName} value={opt.doctorCns || opt.doctorName}>
                    {opt.doctorName}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Bloco de comparativo direto */}
          {(doctorA || doctorB) && (
            <div className="rounded-lg border border-slate-200 p-3 bg-white">
              <div className="text-xs text-slate-500 mb-1">Comparativo direto</div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-sm">
                <div className="rounded-md border border-slate-200 p-2">
                  <div className="text-slate-500">Especialidade (média por AIH)</div>
                  <div className="font-semibold">{formatBRL(specialtyStats.specialtyAvg)}</div>
                </div>
                <div className="rounded-md border border-slate-200 p-2">
                  <div className="text-slate-500">{doctorA ? doctorA.doctorName : '—'}</div>
                  <div className="font-semibold">{doctorA ? formatBRL(doctorA.avgAihValue) : '—'}</div>
                </div>
                <div className="rounded-md border border-slate-200 p-2">
                  <div className="text-slate-500">{doctorB ? doctorB.doctorName : '—'}</div>
                  <div className="font-semibold">{doctorB ? formatBRL(doctorB.avgAihValue) : '—'}</div>
                </div>
              </div>
              {doctorA && doctorB && (
                <div className="mt-2 text-xs text-slate-600">
                  Diferença: <span className="font-semibold">{formatBRL(Math.abs(doctorA.avgAihValue - doctorB.avgAihValue))}</span>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="border-slate-200">
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center justify-between">
            <span>Médicos na especialidade {effectiveSpecialty !== 'all' ? `“${effectiveSpecialty}”` : '(todas)'} — tabela</span>
            <div className="flex items-center gap-2">
              <div className="hidden md:flex items-center gap-2 text-xs text-slate-600">
                <span>AIHs:</span>
                <Badge variant="outline" className="bg-slate-50 text-slate-700 border-slate-200">{specialtyStats.totalAihs}</Badge>
              </div>
              <Button
                className="bg-green-600 hover:bg-green-700 text-white"
                size="sm"
                onClick={exportTableCsv}
                title="Exportar CSV do resultado filtrado"
              >
                Exportar CSV
              </Button>
              <Button
                className="bg-blue-600 hover:bg-blue-700 text-white"
                size="sm"
                onClick={exportTablePdf}
                title="Exportar PDF do resultado filtrado"
              >
                Exportar PDF
              </Button>
            </div>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-slate-500 text-sm">Carregando dados de todos os hospitais…</div>
          ) : tableRows.length === 0 ? (
            <div className="text-slate-400 text-sm">Nenhum médico encontrado para o recorte atual.</div>
          ) : (
            <div className="space-y-4">
              {/* Gráficos movidos para a aba Gráficos */}

              <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
                <table className="w-full text-sm">
                  <thead className="bg-slate-50/80 text-slate-600">
                    <tr>
                      <th className="text-left px-3 py-2 font-medium">
                        <button
                          className="inline-flex items-center gap-1 hover:text-slate-900"
                          onClick={() => toggleSort('doctor')}
                          title="Ordenar por Médico"
                        >
                          Médico
                          {sortBy === 'doctor' && (
                            <span className="text-[10px]">{sortDir === 'asc' ? '▲' : '▼'}</span>
                          )}
                        </button>
                      </th>
                      <th className="text-left px-3 py-2 font-medium">
                        <button
                          className="inline-flex items-center gap-1 hover:text-slate-900"
                          onClick={() => toggleSort('specialty')}
                          title="Ordenar por Especialidade"
                        >
                          Especialidade
                          {sortBy === 'specialty' && (
                            <span className="text-[10px]">{sortDir === 'asc' ? '▲' : '▼'}</span>
                          )}
                        </button>
                      </th>
                      <th className="text-left px-3 py-2 font-medium">Hospital</th>
                      <th className="text-right px-3 py-2 font-medium">AIHs</th>
                      <th className="text-right px-3 py-2 font-medium">Média AIH (médico)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {tableRows.map((r, i) => (
                      <tr key={r.doctorCns || r.doctorName || i} className="hover:bg-slate-50">
                        <td className="px-3 py-2 text-slate-800">{r.doctorName}</td>
                        <td className="px-3 py-2 text-slate-700">{r.specialty || 'Não informado'}</td>
                        <td className="px-3 py-2 text-slate-700">{r.hospitalName || '—'}</td>
                        <td className="px-3 py-2 text-right text-slate-700">{r.aihCount}</td>
                        <td className="px-3 py-2 text-right font-medium text-slate-900">{formatBRL(r.avgAihValue)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default DoctorsSpecialtyComparison;



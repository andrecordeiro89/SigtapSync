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
  const [sortBy, setSortBy] = useState<'deviation' | 'doctor' | 'specialty'>('deviation');
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
      const aihs = d.patients || [];
      const totalAihs = aihs.length;
      const totalValue = aihs.reduce((s, p) => s + (p.total_value_reais || 0), 0);
      const prev = byCns.get(cns) || { doctorName: name, doctorCns: cns, specialty, aihCount: 0, totalAihValue: 0, avgAihValue: 0 };
      prev.aihCount += totalAihs;
      prev.totalAihValue += totalValue;
      prev.specialty = prev.specialty || specialty;
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
    const specAvg = specialtyStats.specialtyAvg || 0;
    const base = filteredRows.map(r => {
      const diff = r.avgAihValue - specAvg;
      const pct = specAvg > 0 ? (diff / specAvg) * 100 : 0;
      return { ...r, diffValue: diff, diffPercent: pct };
    });
    let rows = base;
    if (sortBy === 'doctor') {
      rows = rows.sort((a, b) => a.doctorName.localeCompare(b.doctorName, 'pt-BR'));
      if (sortDir === 'desc') rows.reverse();
    } else if (sortBy === 'specialty') {
      rows = rows.sort((a, b) => (a.specialty || '').localeCompare(b.specialty || '', 'pt-BR'));
      if (sortDir === 'desc') rows.reverse();
    } else {
      // deviation: ordenar por |desvio%| desc padrão
      rows = rows.sort((a, b) => Math.abs(b.diffPercent) - Math.abs(a.diffPercent));
      if (sortDir === 'asc') rows.reverse();
    }
    return rows;
  }, [filteredRows, specialtyStats.specialtyAvg, sortBy, sortDir]);

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
            <span>Médicos na especialidade {effectiveSpecialty !== 'all' ? `“${effectiveSpecialty}”` : '(todas)'} — média vs. desvio</span>
            <div className="flex items-center gap-2 text-xs text-slate-600">
              <span>AIHs:</span>
              <Badge variant="outline" className="bg-slate-50 text-slate-700 border-slate-200">{specialtyStats.totalAihs}</Badge>
              <span>Média da especialidade:</span>
              <Badge variant="outline" className="bg-slate-50 text-slate-700 border-slate-200">{formatBRL(specialtyStats.specialtyAvg)}</Badge>
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
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Gráfico de linha: evolução da média por médico (top 6) */}
                <Card className="border-slate-200">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm">Evolução {granularity === 'day' ? 'diária' : 'semanal'} do ticket médio (AIH) — Top médicos</CardTitle>
                  </CardHeader>
                  <CardContent>
                    {series.length === 0 || (granularity === 'day' ? allDays.length === 0 : allWeeks.length === 0) ? (
                      <div className="text-xs text-slate-400">Sem dados</div>
                    ) : (
                      <svg viewBox="0 0 520 200" className="w-full h-52">
                        {/* Eixos */}
                        <line x1="40" y1="170" x2="500" y2="170" stroke="#CBD5E1" />
                        <line x1="40" y1="20" x2="40" y2="170" stroke="#CBD5E1" />
                        {/* Labels do eixo X */}
                        {(granularity === 'day' ? allDays : allWeeks).map((m, i) => {
                          const bins = granularity === 'day' ? allDays : allWeeks;
                          const step = Math.max(1, Math.ceil(bins.length / 10));
                          const x = 40 + i * (460 / Math.max(1, bins.length - 1));
                          return (
                            <g key={m}>
                              {(i % step === 0) && (
                                <text x={x} y={185} fontSize="9" textAnchor="middle" fill="#475569">{(() => {
                                  const [yy, mm, dd] = m.split('-');
                                  return granularity === 'day' ? `${dd}/${mm}` : `${dd}/${mm}`; // week shows start day
                                })()}</text>
                              )}
                              <line x1={x} y1="170" x2={x} y2="172" stroke="#CBD5E1" />
                            </g>
                          );
                        })}
                        {/* Séries */}
                        {series.map((s, idx) => {
                          const bins = granularity === 'day' ? allDays : allWeeks;
                          const points: Array<{ x: number; y: number; v: number | null }> = s.values.map((v, i) => {
                            const x = 40 + i * (460 / Math.max(1, bins.length - 1));
                            const y = v == null || maxY <= 0 ? 170 : 170 - (v / maxY) * 140;
                            return { x, y, v };
                          });
                          // Construir path quebrando em pontos nulos
                          let d = '';
                          let started = false;
                          points.forEach((p) => {
                            if (p.v == null) { started = false; return; }
                            d += `${started ? 'L' : 'M'} ${p.x} ${p.y} `;
                            started = true;
                          });
                          return (
                            <g key={s.cns || s.name}>
                              <path d={d} fill="none" stroke={s.color} strokeWidth="2" />
                              {points.map((p, i) => p.v != null ? <circle key={i} cx={p.x} cy={p.y} r="2.5" fill={s.color} /> : null)}
                            </g>
                          );
                        })}
                        {/* Legenda */}
                        {series.map((s, i) => (
                          <g key={`lg-${s.cns || s.name}`}>
                            <rect x={50 + (i % 3) * 150} y={10 + Math.floor(i / 3) * 14} width="10" height="3" fill={s.color} />
                            <text x={64 + (i % 3) * 150} y={14 + Math.floor(i / 3) * 14} fontSize="10" fill="#334155">{abbreviateName(s.name)}</text>
                          </g>
                        ))}
                      </svg>
                    )}
                  </CardContent>
                </Card>
                {/* Gráfico de barras: quem tem maior ticket médio */}
                <Card className="border-slate-200">
                  <CardHeader className="pb-2"><CardTitle className="text-sm">Ticket médio por médico (AIH) — Ranking</CardTitle></CardHeader>
                  <CardContent>
                    {topDoctors.length === 0 ? (
                      <div className="text-xs text-slate-400">Sem dados</div>
                    ) : (
                      <svg viewBox="0 0 520 200" className="w-full h-52">
                        <line x1="40" y1="170" x2="500" y2="170" stroke="#CBD5E1" />
                        <line x1="40" y1="20" x2="40" y2="170" stroke="#CBD5E1" />
                        {(() => {
                          const maxBar = Math.max(...topDoctors.map(d => d.avgAihValue));
                          const barW = 460 / Math.max(1, topDoctors.length) * 0.8;
                          return topDoctors.map((d, i) => {
                            const x = 40 + i * (460 / Math.max(1, topDoctors.length)) + ((460 / Math.max(1, topDoctors.length)) - barW) / 2;
                            const h = maxBar > 0 ? (d.avgAihValue / maxBar) * 140 : 0;
                            const y = 170 - h;
                            const color = i === 0 ? '#16A34A' : '#60A5FA';
                            return (
                              <g key={d.doctorCns || d.doctorName}>
                                <rect x={x} y={y} width={barW} height={h} fill={color} />
                                <text x={x + barW / 2} y={185} fontSize="9" textAnchor="middle" fill="#475569">{abbreviateName(d.doctorName)}</text>
                              </g>
                            );
                          });
                        })()}
                      </svg>
                    )}
                  </CardContent>
                </Card>
              </div>

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
                      <th className="text-right px-3 py-2 font-medium">AIHs</th>
                      <th className="text-right px-3 py-2 font-medium">Média AIH (médico)</th>
                      <th className="text-right px-3 py-2 font-medium">Média AIH (esp.)</th>
                      <th className="text-right px-3 py-2 font-medium">Desvio %</th>
                      <th className="text-right px-3 py-2 font-medium">Diferença</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {tableRows.map((r, i) => (
                      <tr key={r.doctorCns || r.doctorName || i} className="hover:bg-slate-50">
                        <td className="px-3 py-2 text-slate-800">{r.doctorName}</td>
                        <td className="px-3 py-2 text-slate-700">{r.specialty || 'Não informado'}</td>
                        <td className="px-3 py-2 text-right text-slate-700">{r.aihCount}</td>
                        <td className="px-3 py-2 text-right font-medium text-slate-900">{formatBRL(r.avgAihValue)}</td>
                        <td className="px-3 py-2 text-right text-slate-700">{formatBRL(specialtyStats.specialtyAvg)}</td>
                        <td className={`px-3 py-2 text-right ${r.diffPercent >= 0 ? 'text-rose-600' : 'text-emerald-700'}`}>{(r.diffPercent).toFixed(1)}%</td>
                        <td className={`px-3 py-2 text-right ${r.diffValue >= 0 ? 'text-rose-600' : 'text-emerald-700'}`}>{formatBRL(Math.abs(r.diffValue))}</td>
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



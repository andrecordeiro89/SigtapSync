import React, { useEffect, useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import ReactECharts from 'echarts-for-react';
import { Badge } from './ui/badge';
import { DateRange } from '../types';
import type { DoctorWithPatients } from '../services/doctorPatientService';
import { AnalyticsService, type AnalyticsRow } from '../services/analyticsService';

interface AnalyticsChartsProps {
  dateRange?: DateRange;
  doctors: DoctorWithPatients[];
  specialty?: string;
  selectedHospitals?: string[];
}

const formatBRL = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

const AnalyticsCharts: React.FC<AnalyticsChartsProps> = ({ dateRange, doctors, specialty, selectedHospitals }) => {
  const [granularity, setGranularity] = useState<'week' | 'day'>('week');
  const [loading, setLoading] = useState<boolean>(false);
  const [rankingApi, setRankingApi] = useState<Array<{ doctor: string; avg: number }> | null>(null);
  const [shareApi, setShareApi] = useState<Array<{ doctor: string; value: number; pct: number }> | null>(null);
  const [hospRevenue, setHospRevenue] = useState<Array<{ hospital: string; total: number }>>([]);
  const [weeklyRevenue, setWeeklyRevenue] = useState<Array<{ week: string; total: number }>>([]);
  const [procTop, setProcTop] = useState<Array<{ code: string; desc: string; total: number }>>([]);
  const [specialtyLocal, setSpecialtyLocal] = useState<string>('all');

  // Preparos leves (top 6 por ticket médio)
  // Catálogos locais
  const specialtyOptions = useMemo(() => {
    const set = new Set<string>();
    (doctors || []).forEach(d => {
      const s = (d.doctor_info.specialty || '').trim();
      if (s) set.add(s);
    });
    return Array.from(set).sort((a, b) => a.localeCompare(b, 'pt-BR'));
  }, [doctors]);

  const hospitalActiveName = useMemo(() => {
    try {
      const selectedId = (selectedHospitals && selectedHospitals.length > 0 && !selectedHospitals.includes('all')) ? selectedHospitals[0] : null;
      if (!selectedId) return 'Hospital (selecionado nos filtros)';
      // Mapear nome por doctors.hospitals
      const map = new Map<string, string>();
      (doctors || []).forEach(d => (d.hospitals || []).forEach((h: any) => { if (h?.hospital_id) map.set(h.hospital_id, h.hospital_name || h.hospital_id); }));
      return map.get(selectedId) || selectedId;
    } catch { return 'Hospital'; }
  }, [doctors, selectedHospitals?.[0]]);

  const wrapLabel = (text: string, max: number = 36): string => {
    try {
      const clean = String(text || '').replace(/\s+/g, ' ').trim();
      if (clean.length <= max) return clean;
      const parts: string[] = [];
      let cur = '';
      clean.split(' ').forEach((w) => {
        if ((cur + (cur ? ' ' : '') + w).length > max) {
          if (cur) parts.push(cur);
          cur = w;
        } else {
          cur = cur ? cur + ' ' + w : w;
        }
      });
      if (cur) parts.push(cur);
      return parts.join('\n');
    } catch { return text; }
  };

  const procDescByCode = useMemo(() => {
    const m: Record<string, string> = {};
    (procTop || []).forEach(p => { if (p.code) m[p.code] = p.desc || ''; });
    return m;
  }, [procTop]);

  // Escopo efetivo conforme filtros locais
  const scopedDoctors: DoctorWithPatients[] = useMemo(() => {
    const spec = (specialtyLocal && specialtyLocal !== 'all') ? specialtyLocal.toLowerCase() : undefined;
    return (doctors || []).map(d => {
      const matchSpec = !spec || (String(d.doctor_info.specialty || '').toLowerCase() === spec);
      const pts = d.patients || [];
      return matchSpec ? { ...d, patients: pts } : { ...d, patients: [] };
    }).filter(d => (d.patients || []).length > 0);
  }, [doctors, specialtyLocal]);

  // Fallback local ranking (avg AIH by doctor)
  const localRanking = useMemo(() => {
    const byDoctor = new Map<string, { name: string; sum: number; count: number }>();
    (scopedDoctors || []).forEach(d => {
      const key = d.doctor_info.cns || d.doctor_info.name || '';
      const aihs = d.patients || [];
      const sum = aihs.reduce((s, p) => s + (p.total_value_reais || 0), 0);
      const prev = byDoctor.get(key) || { name: d.doctor_info.name || key, sum: 0, count: 0 };
      prev.sum += sum; prev.count += aihs.length; byDoctor.set(key, prev);
    });
    const rows = Array.from(byDoctor.entries()).map(([k, v]) => ({ id: k, name: v.name, avg: v.count > 0 ? v.sum / v.count : 0 }));
    rows.sort((a, b) => b.avg - a.avg);
    return rows.slice(0, 8);
  }, [scopedDoctors]);

  const weeklyTotal = useMemo(() => weeklyRevenue.reduce((s, r) => s + (r.total || 0), 0), [weeklyRevenue]);

  // Fallback local share (total value by doctor)
  const localShare = useMemo(() => {
    const byDoctor = new Map<string, { name: string; total: number }>();
    (scopedDoctors || []).forEach(d => {
      const key = d.doctor_info.cns || d.doctor_info.name || '';
      const total = (d.patients || []).reduce((s, p) => s + (p.total_value_reais || 0), 0);
      const prev = byDoctor.get(key) || { name: d.doctor_info.name || key, total: 0 };
      prev.total += total; byDoctor.set(key, prev);
    });
    const rows = Array.from(byDoctor.entries()).map(([k, v]) => ({ id: k, name: v.name, total: v.total }));
    rows.sort((a, b) => b.total - a.total);
    const top = rows.slice(0, 6);
    const totalAll = rows.reduce((s, r) => s + r.total, 0) || 1;
    return top.map(r => ({ doctor: r.name, value: r.total, pct: (r.total / totalAll) * 100 }));
  }, [scopedDoctors]);

  // Build payload rows and fetch from Python
  useEffect(() => {
    try {
      const rows: AnalyticsRow[] = [];
      (scopedDoctors || []).forEach(d => {
        (d.patients || []).forEach(p => {
          const iso = (p.aih_info as any)?.discharge_date;
          const v = Number(p.total_value_reais || 0);
          const hid = (p.aih_info as any)?.hospital_id;
          if (!iso || !isFinite(v) || v <= 0) return;
          rows.push({
            doctor_id: d.doctor_info.cns,
            doctor_name: d.doctor_info.name || (d.doctor_info.cns || 'Médico'),
            doctor_cns: d.doctor_info.cns,
            discharge_date: iso,
            aih_value: v,
          });
        });
      });
      const filters = {
        dateStart: dateRange ? dateRange.startDate.toISOString() : undefined,
        dateEnd: dateRange ? dateRange.endDate.toISOString() : undefined,
        specialty: specialty && specialty !== 'all' ? specialty : undefined,
        topN: 8,
      };
      if (rows.length === 0) { setRankingApi([]); setShareApi([]); return; }
      setLoading(true);
      Promise.all([
        AnalyticsService.ranking(filters, rows).catch(() => ({ ranking: null } as any)),
        AnalyticsService.share(filters, rows).catch(() => ({ share: null } as any)),
      ]).then(([r1, r2]) => {
        setRankingApi(r1.ranking);
        setShareApi(r2.share);
      }).finally(() => setLoading(false));
    } catch {
      setRankingApi(null);
      setShareApi(null);
    }
  }, [scopedDoctors, dateRange?.startDate, dateRange?.endDate, specialty]);

  // Agregações por hospital / semana / procedimento (client-side simples)
  useEffect(() => {
    try {
      const byHospital = new Map<string, number>();
      const byWeek = new Map<string, number>();
      const byProc = new Map<string, { code: string; desc: string; total: number }>();
      (scopedDoctors || []).forEach(d => {
        (d.patients || []).forEach(p => {
          const iso = (p.aih_info as any)?.discharge_date;
          const hid = (p.aih_info as any)?.hospital_id;
          const hospName = (d.hospitals || []).find((h: any) => h.hospital_id === hid)?.hospital_name || hid || 'Hospital';
          const v = Number(p.total_value_reais || 0);
          if (isFinite(v) && v > 0) {
            if (hospName) byHospital.set(hospName, (byHospital.get(hospName) || 0) + v);
            if (iso) {
              const dt = new Date(iso);
              const weekKey = new Date(dt.getFullYear(), dt.getMonth(), dt.getDate() - ((dt.getDay() + 6) % 7));
              const wk = `${weekKey.getFullYear()}-${String(weekKey.getMonth() + 1).padStart(2, '0')}-${String(weekKey.getDate()).padStart(2, '0')}`;
              byWeek.set(wk, (byWeek.get(wk) || 0) + v);
            }
          }
          // procedimentos
          (p.procedures || []).forEach((pr: any) => {
            const code = pr.procedure_code || '';
            const desc = pr.procedure_description || pr.procedure_name || '';
            const val = Number(pr.value_reais || pr.value_cents / 100 || 0);
            if (!code || !isFinite(val) || val <= 0) return;
            const cur = byProc.get(code) || { code, desc, total: 0 };
            cur.total += val; byProc.set(code, cur);
          });
        });
      });
      const hospArr = Array.from(byHospital.entries()).map(([hospital, total]) => ({ hospital, total })).sort((a, b) => b.total - a.total).slice(0, 10);
      const weekArr = Array.from(byWeek.entries()).map(([week, total]) => ({ week, total })).sort((a, b) => (a.week < b.week ? -1 : 1));
      const procArr = Array.from(byProc.values()).sort((a, b) => b.total - a.total).slice(0, 10);
      setHospRevenue(hospArr); setWeeklyRevenue(weekArr); setProcTop(procArr);
    } catch {}
  }, [scopedDoctors]);

  const abbreviate = (name: string) => {
    try { const p = (name||'').split(/\s+/); return p.length>1 ? `${p[0]} ${p[p.length-1][0]}.` : name; } catch { return name; }
  };

  const ranking = (rankingApi && rankingApi.length > 0)
    ? rankingApi.map((r, i) => ({ id: String(i), name: r.doctor, avg: r.avg }))
    : localRanking;

  const share = (shareApi && shareApi.length > 0)
    ? shareApi
    : localShare;

  return (
    <div className="space-y-4">
      <div className="pb-1">
        <div className="text-base font-semibold text-slate-800">Análise individual por hospital</div>
        <div className="text-xs text-slate-500 flex items-center gap-2">
          <span>Contexto:</span>
          <span className="inline-flex items-center px-2 py-1 rounded-full bg-blue-50 text-blue-800 border border-blue-200 text-xs">{hospitalActiveName}</span>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div>
          <label className="text-xs font-medium text-gray-600 uppercase tracking-wide mb-1.5 block">Especialidade</label>
          <div className="flex items-center gap-2">
            <select
              value={specialtyLocal}
              onChange={(e) => setSpecialtyLocal(e.target.value)}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg bg-white text-sm h-9"
            >
              <option value="all">Todas</option>
              {specialtyOptions.map(s => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
            {specialtyLocal !== 'all' && (
              <button
                onClick={() => setSpecialtyLocal('all')}
                className="px-2 py-1 text-xs text-blue-600 hover:text-blue-800 hover:bg-blue-50 rounded transition-colors"
                title="Limpar"
              >
                ✕
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Ranking por ticket médio (barras) */}
      <Card className="border-slate-200">
        <CardHeader className="pb-2"><CardTitle className="text-sm">Ranking de ticket médio (AIH) — Top</CardTitle></CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-xs text-slate-400">Carregando…</div>
          ) : ranking.length === 0 ? (
            <div className="text-xs text-slate-400">Sem dados</div>
          ) : (
            <ReactECharts
              style={{ height: 520 }}
              option={{
                grid: { left: 50, right: 20, top: 10, bottom: 260 },
                tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' }, valueFormatter: (v: any) => formatBRL(Number(v || 0)) },
                xAxis: { type: 'category', data: ranking.map(r => r.name), axisLabel: { rotate: 90, fontSize: 11, interval: 0, align: 'right', margin: 10 } },
                yAxis: { type: 'value', axisLabel: { fontSize: 12 } },
                series: [{ type: 'bar', data: ranking.map(r => r.avg), itemStyle: { color: '#3B82F6' } }]
              }}
            />
          )}
        </CardContent>
      </Card>

      {/* Donut share por médico (com limite de fatias) */}
      <Card className="border-slate-200">
        <CardHeader className="pb-2"><CardTitle className="text-sm">Participação do valor de AIHs por médico (período)</CardTitle></CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-xs text-slate-400">Carregando…</div>
          ) : share.length === 0 ? (
            <div className="text-xs text-slate-400">Sem dados</div>
          ) : (
            <ReactECharts
              style={{ height: 220 }}
              option={{
                tooltip: { trigger: 'item', valueFormatter: (v: any) => formatBRL(Number(v || 0)) },
                legend: { orient: 'vertical', right: 10, top: 20, textStyle: { fontSize: 12 } },
                series: [{
                  type: 'pie', radius: ['40%', '70%'],
                  data: share.slice(0, 6).map(s => ({ name: abbreviate(s.doctor), value: s.value })),
                  emphasis: { itemStyle: { shadowBlur: 10, shadowOffsetX: 0, shadowColor: 'rgba(0,0,0,0.2)' } }
                }]
              }}
            />
          )}
        </CardContent>
      </Card>


      {/* Faturamento semanal */}
      <Card className="border-slate-200">
        <CardHeader className="pb-2"><CardTitle className="text-sm">Faturamento semanal</CardTitle></CardHeader>
        <CardContent>
          {weeklyRevenue.length === 0 ? (
            <div className="text-xs text-slate-400">Sem dados</div>
          ) : (
            <ReactECharts
              style={{ height: 240 }}
              option={{
                grid: { left: 60, right: 20, top: 10, bottom: 50, containLabel: true },
                tooltip: { trigger: 'axis', valueFormatter: (v: any) => formatBRL(Number(v || 0)) },
                xAxis: { type: 'category', data: weeklyRevenue.map(w => w.week), axisLabel: { rotate: 30, fontSize: 12, interval: 0 } },
                yAxis: { type: 'value', axisLabel: { fontSize: 12, margin: 8 } },
                series: [{ type: 'line', data: weeklyRevenue.map(w => w.total), smooth: true, areaStyle: {} }],
                graphic: [
                  {
                    type: 'text',
                    right: 12,
                    top: 12,
                    style: {
                      text: `Total: ${formatBRL(weeklyTotal)}`,
                      fontSize: 12,
                      fill: '#334155',
                      fontWeight: 600,
                      backgroundColor: '#F1F5F9',
                      borderColor: '#CBD5E1',
                      borderWidth: 1,
                      borderRadius: 6,
                      padding: [4, 8]
                    }
                  }
                ]
              }}
            />
          )}
        </CardContent>
      </Card>

      {/* Procedimentos mais utilizados (por valor) */}
      <Card className="border-slate-200">
        <CardHeader className="pb-2"><CardTitle className="text-sm">Procedimentos mais utilizados (por valor)</CardTitle></CardHeader>
        <CardContent>
          {procTop.length === 0 ? (
            <div className="text-xs text-slate-400">Sem dados</div>
          ) : (
            <ReactECharts
              style={{ height: 240 }}
              option={{
                grid: { left: 220, right: 20, top: 10, bottom: 20 },
                tooltip: { 
                  trigger: 'item',
                  formatter: (p: any) => {
                    const code = String(p?.name ?? '');
                    const desc = procDescByCode[code] || '';
                    const val = Number(p?.value || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
                    return `<div><div><b>${code}</b></div><div>${desc}</div><div>${val}</div></div>`;
                  }
                },
                xAxis: { type: 'value', axisLabel: { fontSize: 12 } },
                yAxis: { type: 'category', data: procTop.map(p => p.code), axisLabel: { interval: 0, fontSize: 12 } },
                series: [{ type: 'bar', data: procTop.map(p => p.total), itemStyle: { color: '#3B82F6' } }]
              }}
            />
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default AnalyticsCharts;



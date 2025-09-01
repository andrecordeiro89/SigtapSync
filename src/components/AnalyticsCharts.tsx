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
}

const formatBRL = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

const AnalyticsCharts: React.FC<AnalyticsChartsProps> = ({ dateRange, doctors, specialty }) => {
  const [granularity, setGranularity] = useState<'week' | 'day'>('week');
  const [loading, setLoading] = useState<boolean>(false);
  const [rankingApi, setRankingApi] = useState<Array<{ doctor: string; avg: number }> | null>(null);
  const [shareApi, setShareApi] = useState<Array<{ doctor: string; value: number; pct: number }> | null>(null);

  // Preparos leves (top 6 por ticket médio)
  // Fallback local ranking (avg AIH by doctor)
  const localRanking = useMemo(() => {
    const byDoctor = new Map<string, { name: string; sum: number; count: number }>();
    (doctors || []).forEach(d => {
      const key = d.doctor_info.cns || d.doctor_info.name || '';
      const aihs = d.patients || [];
      const sum = aihs.reduce((s, p) => s + (p.total_value_reais || 0), 0);
      const prev = byDoctor.get(key) || { name: d.doctor_info.name || key, sum: 0, count: 0 };
      prev.sum += sum; prev.count += aihs.length; byDoctor.set(key, prev);
    });
    const rows = Array.from(byDoctor.entries()).map(([k, v]) => ({ id: k, name: v.name, avg: v.count > 0 ? v.sum / v.count : 0 }));
    rows.sort((a, b) => b.avg - a.avg);
    return rows.slice(0, 8);
  }, [doctors]);

  // Fallback local share (total value by doctor)
  const localShare = useMemo(() => {
    const byDoctor = new Map<string, { name: string; total: number }>();
    (doctors || []).forEach(d => {
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
  }, [doctors]);

  // Build payload rows and fetch from Python
  useEffect(() => {
    try {
      const rows: AnalyticsRow[] = [];
      (doctors || []).forEach(d => {
        (d.patients || []).forEach(p => {
          const iso = (p.aih_info as any)?.discharge_date;
          const v = Number(p.total_value_reais || 0);
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
  }, [doctors, dateRange?.startDate, dateRange?.endDate, specialty]);

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
      <div className="flex items-center justify-between">
        <div className="text-sm text-slate-600">Especialidade:</div>
        <Badge variant="outline" className="bg-slate-50 text-slate-700 border-slate-200">{specialty && specialty !== 'all' ? specialty : 'Todas'}</Badge>
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
              style={{ height: 220 }}
              option={{
                grid: { left: 40, right: 20, top: 10, bottom: 40 },
                tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' }, valueFormatter: (v: any) => formatBRL(Number(v || 0)) },
                xAxis: { type: 'category', data: ranking.map(r => abbreviate(r.name)), axisLabel: { rotate: 35 } },
                yAxis: { type: 'value' },
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
                legend: { orient: 'vertical', right: 10, top: 20 },
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
    </div>
  );
};

export default AnalyticsCharts;



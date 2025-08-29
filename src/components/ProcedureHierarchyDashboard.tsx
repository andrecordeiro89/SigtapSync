import React, { useEffect, useMemo, useRef, useState } from 'react';
import { DoctorsHierarchyV2Service } from '../services/doctorsHierarchyV2';
import type { DoctorWithPatients } from '../services/doctorPatientService';
import { useAuth } from '../contexts/AuthContext';
import { DateRange } from '../types';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Badge } from './ui/badge';
import { Input } from './ui/input';
import { Button } from './ui/button';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from './ui/collapsible';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import { Alert, AlertDescription } from './ui/alert';
import { Users, FileText, Search, ChevronRight, ChevronDown, Calendar, Activity, LineChart, Filter, FileSpreadsheet } from 'lucide-react';

interface ProcedureHierarchyDashboardProps {
  dateRange?: DateRange;
  selectedHospitals?: string[];
  selectedCareCharacter?: string;
  selectedSpecialty?: string;
  searchTerm?: string; // termo global (nome/CNS/CRM)
}

const ProcedureHierarchyDashboard: React.FC<ProcedureHierarchyDashboardProps> = ({ dateRange, selectedHospitals = ['all'], selectedCareCharacter = 'all', selectedSpecialty = 'all', searchTerm = '' }) => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [doctors, setDoctors] = useState<DoctorWithPatients[]>([]);

  // Estado de visualização
  const [activeView, setActiveView] = useState<'analytics' | 'specialties' | 'hospitals'>('analytics');

  // Carregar hierarquia
  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);
        const dateFromISO = dateRange ? dateRange.startDate.toISOString() : undefined;
        const dateToISO = dateRange ? dateRange.endDate.toISOString() : undefined;
        // Aplicar filtros globais iguais à aba Médicos
        const hospitalIds = (selectedHospitals.length > 0 && !selectedHospitals.includes('all')) ? selectedHospitals : undefined;
        const data = await DoctorsHierarchyV2Service.getDoctorsHierarchyV2({
          dateFromISO,
          dateToISO,
          hospitalIds,
          careCharacter: selectedCareCharacter,
        });
        setDoctors(data);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [dateRange?.startDate?.toISOString(), dateRange?.endDate?.toISOString(), JSON.stringify(selectedHospitals), selectedCareCharacter]);

  // Busca global (nome/CNS/CRM e também procedimento por código/descrição)
  const globalTermRaw = (searchTerm || '').toLowerCase().trim();
  const globalTermNorm = globalTermRaw.replace(/[\.\s]/g, '');

  // Helper: identificar procedimentos de anestesista (ocultar)
  const isAnesthetistProcedure = (proc: any): boolean => {
    try {
      const cbo = String(proc?.cbo || proc?.professional_cbo || '');
      const code = String(proc?.procedure_code || '');
      return cbo === '225151' && code.startsWith('04') && code !== '04.17.01.001-0';
    } catch {
      return false;
    }
  };

  // Filtragem de médicos por nome/CRM/CNS e/ou por procedimentos (código/descrição) via busca global
  const filteredDoctors = useMemo(() => {
    return (doctors || []).filter(d => {
      const dn = (d.doctor_info.name || '').toLowerCase();
      const dcns = (d.doctor_info.cns || '').toLowerCase();
      const dcrm = (d.doctor_info.crm || '').toLowerCase();
      if (!globalTermRaw) {
        // sem termo: aplica só specialty quando houver
        if (selectedSpecialty && selectedSpecialty !== 'all') {
          if ((d.doctor_info.specialty || '').toLowerCase() !== selectedSpecialty.toLowerCase()) return false;
        }
        return true;
      }
      const matchesDoctor = dn.includes(globalTermRaw) || dcns.includes(globalTermRaw) || dcrm.includes(globalTermRaw);
      // verificar procedimentos 
      const matchesProc = (d.patients || []).some(p => (p.procedures || []).some(proc => {
        if (isAnesthetistProcedure(proc)) return false;
        const codeNorm = (proc.procedure_code || '').toLowerCase().replace(/[\.\s]/g, '');
        const desc = (proc.procedure_description || '').toLowerCase();
        return codeNorm.includes(globalTermNorm) || desc.includes(globalTermRaw);
      }));
      const matches = matchesDoctor || matchesProc;
      if (!matches) return false;
      if (selectedSpecialty && selectedSpecialty !== 'all') {
        if ((d.doctor_info.specialty || '').toLowerCase() !== selectedSpecialty.toLowerCase()) return false;
      }
      return true;
    });
  }, [doctors, searchTerm, globalTermRaw, globalTermNorm, selectedSpecialty]);

  // Agrupar por hospital (id -> nome) e criar cortes por hospital

  // Métricas e análises por médico
  const doctorAnalytics = useMemo(() => {
    return filteredDoctors.map(d => {
      const allAIHs = d.patients || [];
      const totalAihs = allAIHs.length;
      const totalAihValue = allAIHs.reduce((sum, p) => sum + (p.total_value_reais || 0), 0);
      const avgAihValue = totalAihs > 0 ? totalAihValue / totalAihs : 0;

      const procMap = new Map<string, { code: string; desc: string; count: number; total: number }>();
      allAIHs.forEach(p => {
        (p.procedures || []).forEach(proc => {
          if (isAnesthetistProcedure(proc)) return;
          const key = proc.procedure_code || proc.procedure_description || String(Math.random());
          const prev = procMap.get(key) || { code: proc.procedure_code || '', desc: proc.procedure_description || '', count: 0, total: 0 };
          prev.count += 1;
          prev.total += proc.value_reais || 0;
          procMap.set(key, prev);
        });
      });

      const procedures = Array.from(procMap.values())
        .sort((a, b) => b.count - a.count);

      const topProcedures = procedures.slice(0, 5);
      const totalProcedures = procedures.reduce((s, p) => s + p.count, 0);
      const totalProceduresValue = procedures.reduce((s, p) => s + p.total, 0);

      // Padrão (heurística simples): se os 3 mais frequentes somam > 60% do total, considera padrão alto
      const top3Count = procedures.slice(0, 3).reduce((s, p) => s + p.count, 0);
      const patternRate = totalProcedures > 0 ? Math.round((top3Count / totalProcedures) * 100) : 0;
      const hasStrongPattern = patternRate >= 60;

      return {
        doctor: d,
        metrics: {
          totalAihs,
          totalAihValue,
          avgAihValue,
          totalProcedures,
          totalProceduresValue,
          patternRate,
          hasStrongPattern,
        },
        topProcedures,
        procedures,
      };
    });
  }, [filteredDoctors]);

  // Agrupar por hospital (id -> nome) e criar cortes por hospital
  const hospitalsList = useMemo(() => {
    const map = new Map<string, string>();
    (doctors || []).forEach(d => {
      // nomes vindos de doctor.hospitals
      (d.hospitals || []).forEach(h => {
        if (h.hospital_id) map.set(h.hospital_id, h.hospital_name || h.hospital_id);
      });
      // fallback por pacientes
      (d.patients || []).forEach(p => {
        const hid = (p.aih_info as any)?.hospital_id;
        if (hid && !map.has(hid)) map.set(hid, hid);
      });
    });
    return Array.from(map.entries()).map(([id, name]) => ({ id, name })).sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'));
  }, [doctors]);

  const getDoctorsForHospital = (hospitalId: string): DoctorWithPatients[] => {
    return (filteredDoctors || []).map(d => ({
      ...d,
      patients: (d.patients || []).filter(p => (p.aih_info as any)?.hospital_id === hospitalId)
    })).filter(d => (d.patients || []).length > 0);
  };

  const getAnalyticsForHospital = (hospitalId: string) => {
    const docs = getDoctorsForHospital(hospitalId);
    return docs.map(d => {
      const allAIHs = d.patients || [];
      const totalAihs = allAIHs.length;
      const totalAihValue = allAIHs.reduce((sum, p) => sum + (p.total_value_reais || 0), 0);
      const avgAihValue = totalAihs > 0 ? totalAihValue / totalAihs : 0;

      const procMap = new Map<string, { code: string; desc: string; count: number; total: number }>();
      allAIHs.forEach(p => {
        (p.procedures || []).forEach(proc => {
          if (isAnesthetistProcedure(proc)) return;
          const key = proc.procedure_code || proc.procedure_description || String(Math.random());
          const prev = procMap.get(key) || { code: proc.procedure_code || '', desc: proc.procedure_description || '', count: 0, total: 0 };
          prev.count += 1;
          prev.total += proc.value_reais || 0;
          procMap.set(key, prev);
        });
      });

      const procedures = Array.from(procMap.values()).sort((a, b) => b.count - a.count);
      const topProcedures = procedures.slice(0, 5);
      const totalProcedures = procedures.reduce((s, p) => s + p.count, 0);
      const totalProceduresValue = procedures.reduce((s, p) => s + p.total, 0);
      const top3Count = procedures.slice(0, 3).reduce((s, p) => s + p.count, 0);
      const patternRate = totalProcedures > 0 ? Math.round((top3Count / totalProcedures) * 100) : 0;
      const hasStrongPattern = patternRate >= 60;

      return {
        doctor: d,
        metrics: { totalAihs, totalAihValue, avgAihValue, totalProcedures, totalProceduresValue, patternRate, hasStrongPattern },
        topProcedures,
        procedures,
      };
    });
  };

  // Analytics por hospital
  const getHospitalAnalytics = (docs: DoctorWithPatients[]) => {
    let totalAihs = 0;
    let totalAihValue = 0;
    const specialties = new Map<string, { procCount: number; total: number }>();
    const procedures = new Map<string, { code: string; desc: string; count: number; total: number }>();
    const doctors: Array<{ name: string; cns: string; totalAihs: number; totalAihValue: number; totalProcedures: number; avgAihValue: number } > = [];

    docs.forEach(d => {
      const aihs = d.patients || [];
      const dAihs = aihs.length;
      const dAihValue = aihs.reduce((s, p) => s + (p.total_value_reais || 0), 0);
      const dProcedures = aihs.reduce((s, p) => s + (p.procedures || []).filter(pr => !isAnesthetistProcedure(pr)).length, 0);

      totalAihs += dAihs;
      totalAihValue += dAihValue;

      doctors.push({
        name: d.doctor_info.name,
        cns: d.doctor_info.cns,
        totalAihs: dAihs,
        totalAihValue: dAihValue,
        totalProcedures: dProcedures,
        avgAihValue: dAihs > 0 ? dAihValue / dAihs : 0,
      });

      const spec = (d.doctor_info.specialty || 'Não informado').trim();
      if (!specialties.has(spec)) specialties.set(spec, { procCount: 0, total: 0 });
      const specBucket = specialties.get(spec)!;

      aihs.forEach(p => {
        (p.procedures || []).forEach(proc => {
          if (isAnesthetistProcedure(proc)) return;
          specBucket.procCount += 1;
          specBucket.total += proc.value_reais || 0;

          const key = proc.procedure_code || proc.procedure_description || String(Math.random());
          const prev = procedures.get(key) || { code: proc.procedure_code || '', desc: proc.procedure_description || '', count: 0, total: 0 };
          prev.count += 1;
          prev.total += proc.value_reais || 0;
          procedures.set(key, prev);
        });
      });
    });

    const totalProcedures = Array.from(procedures.values()).reduce((s, p) => s + p.count, 0);
    const totalProceduresValue = Array.from(procedures.values()).reduce((s, p) => s + p.total, 0);

    const topSpecialties = Array.from(specialties.entries())
      .map(([name, v]) => ({ name, procCount: v.procCount, total: v.total }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 10);

    const topProcedures = Array.from(procedures.values())
      .sort((a, b) => b.total - a.total)
      .slice(0, 10);

    const topDoctors = doctors
      .sort((a, b) => b.totalAihValue - a.totalAihValue)
      .slice(0, 10);

    return {
      metrics: {
        totalAihs,
        avgAihValue: totalAihs > 0 ? totalAihValue / totalAihs : 0,
        totalProcedures,
        totalProceduresValue,
      },
      topSpecialties,
      topProcedures,
      topDoctors,
    };
  };

  // Export helper: CSV por médico (card) preservando estrutura visual
  const exportDoctorCardCsv = (hospitalName: string, row: any) => {
    try {
      const doctor = row.doctor?.doctor_info || {};
      const metrics = row.metrics || {};
      const top = Array.isArray(row.topProcedures) ? row.topProcedures : [];

      // Helpers para Excel pt-BR (CSV ; e vírgula decimal)
      const quote = (t: any) => `"${String(t ?? '').replace(/"/g, '""')}"`;
      const toDec = (n: any, digits: number = 2) => {
        const num = Number(n || 0);
        return String(num.toFixed(digits)).replace('.', ',');
      };
      const toInt = (n: any) => String(Math.round(Number(n || 0)));
      const push = (arr: (string | number)[]) => lines.push(arr.join(';'));
      const lines: string[] = [];

      // Cabeçalho contextual
      push([quote('Hospital'), quote(hospitalName)]);
      push([quote('Médico'), quote(doctor.name || '')]);
      push([quote('CNS'), quote(doctor.cns || '')]);
      push([quote('Especialidade'), quote(doctor.specialty || '')]);
      lines.push('');

      // Métricas (como exibidas)
      push([quote('AIHs'), toInt(metrics.totalAihs)]);
      push([quote('Valor médio AIH (BRL)'), toDec(metrics.avgAihValue)]);
      push([quote('Procedimentos'), toInt(metrics.totalProcedures)]);
      push([quote('Total Procedimentos (BRL)'), toDec(metrics.totalProceduresValue)]);
      lines.push('');

      // Tabela Top procedimentos
      push([quote('Procedimento (código)'), quote('Descrição'), quote('Qtde'), quote('Valor total (BRL)')]);
      top.forEach((p: any) => {
        push([
          quote(p.code || '—'),
          quote(p.desc || 'Sem descrição'),
          toInt(p.count),
          toDec(p.total)
        ]);
      });

      // Prefixo BOM para Excel reconhecer UTF-8
      const csv = '\uFEFF' + lines.join('\r\n');
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      const fileNameSafe = `${(doctor.name || 'medico').replace(/[^\w\-]+/g, '_')}_${new Date().toISOString().slice(0,10)}.csv`;
      a.href = url;
      a.download = fileNameSafe;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      console.error('Erro ao exportar CSV do médico:', e);
    }
  };

  // Export helper: CSV por especialidade (card)
  const exportSpecialtyCardCsv = (hospitalName: string, row: any) => {
    try {
      const specialtyName = row.specialty || 'Especialidade';
      const metrics = row.metrics || {};
      const top = Array.isArray(row.topProcedures) ? row.topProcedures : [];

      const quote = (t: any) => `"${String(t ?? '').replace(/"/g, '""')}"`;
      const toDec = (n: any, digits: number = 2) => {
        const num = Number(n || 0);
        return String(num.toFixed(digits)).replace('.', ',');
      };
      const toInt = (n: any) => String(Math.round(Number(n || 0)));
      const push = (arr: (string | number)[]) => lines.push(arr.join(';'));
      const lines: string[] = [];

      // Cabeçalho contextual
      push([quote('Hospital'), quote(hospitalName)]);
      push([quote('Especialidade'), quote(specialtyName)]);
      push([quote('Médicos'), toInt(row.doctorsCount)]);
      lines.push('');

      // Métricas
      push([quote('AIHs'), toInt(metrics.totalAihs)]);
      push([quote('Valor médio AIH (BRL)'), toDec(metrics.avgAihValue)]);
      push([quote('Procedimentos'), toInt(metrics.totalProcedures)]);
      push([quote('Total Procedimentos (BRL)'), toDec(metrics.totalProceduresValue)]);
      lines.push('');

      // Tabela Top procedimentos
      push([quote('Procedimento (código)'), quote('Descrição'), quote('Qtde'), quote('Valor total (BRL)')]);
      top.forEach((p: any) => {
        push([
          quote(p.code || '—'),
          quote(p.desc || 'Sem descrição'),
          toInt(p.count),
          toDec(p.total)
        ]);
      });

      const csv = '\uFEFF' + lines.join('\r\n');
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      const fileNameSafe = `${('especialidade_' + specialtyName).replace(/[^\w\-]+/g, '_')}_${new Date().toISOString().slice(0,10)}.csv`;
      a.href = url;
      a.download = fileNameSafe;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      console.error('Erro ao exportar CSV da especialidade:', e);
    }
  };

  // Export helper: CSV por hospital (seção)
  const exportHospitalSectionCsv = (hospitalName: string, ha: any) => {
    try {
      const quote = (t: any) => `"${String(t ?? '').replace(/"/g, '""')}"`;
      const toDec = (n: any, digits: number = 2) => String(Number(n || 0).toFixed(digits)).replace('.', ',');
      const toInt = (n: any) => String(Math.round(Number(n || 0)));
      const lines: string[] = [];
      const push = (arr: (string | number)[]) => lines.push(arr.join(';'));

      // Cabeçalho
      push([quote('Hospital'), quote(hospitalName)]);
      lines.push('');

      // Métricas
      push([quote('AIHs'), toInt(ha.metrics?.totalAihs)]);
      push([quote('Valor médio AIH (BRL)'), toDec(ha.metrics?.avgAihValue)]);
      push([quote('Procedimentos'), toInt(ha.metrics?.totalProcedures)]);
      push([quote('Total Procedimentos (BRL)'), toDec(ha.metrics?.totalProceduresValue)]);
      lines.push('');

      // Top especialidades
      push([quote('Top especialidades por faturamento')]);
      push([quote('Especialidade'), quote('Qtde proc.'), quote('Valor total (BRL)')]);
      (ha.topSpecialties || []).forEach((s: any) => {
        push([quote(s.name || ''), toInt(s.procCount), toDec(s.total)]);
      });
      lines.push('');

      // Top procedimentos
      push([quote('Top procedimentos por faturamento')]);
      push([quote('Procedimento (código)'), quote('Descrição'), quote('Qtde'), quote('Valor total (BRL)')]);
      (ha.topProcedures || []).forEach((p: any) => {
        push([quote(p.code || '—'), quote(p.desc || 'Sem descrição'), toInt(p.count), toDec(p.total)]);
      });
      lines.push('');

      // Médicos mais performáticos
      push([quote('Médicos mais performáticos')]);
      push([quote('Médico'), quote('AIHs'), quote('Procedimentos'), quote('Valor AIH (BRL)'), quote('Ticket médio (BRL)')]);
      (ha.topDoctors || []).forEach((d: any) => {
        push([quote(d.name || ''), toInt(d.totalAihs), toInt(d.totalProcedures), toDec(d.totalAihValue), toDec(d.avgAihValue)]);
      });

      const csv = '\uFEFF' + lines.join('\r\n');
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      const fileNameSafe = `${('hospital_' + hospitalName).replace(/[^\w\-]+/g, '_')}_${new Date().toISOString().slice(0,10)}.csv`;
      a.href = url;
      a.download = fileNameSafe;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      console.error('Erro ao exportar CSV do hospital:', e);
    }
  };

  // Especialidades: agregação por especialidade → procedimentos e valores (exclui anestesista)
  const getSpecialtyAnalytics = (doctorsSubset: DoctorWithPatients[]) => {
    const specialtyMap = new Map<string, any>();
    doctorsSubset.forEach(d => {
      const spec = (d.doctor_info.specialty || 'Não informado').trim();
      if (!specialtyMap.has(spec)) {
        specialtyMap.set(spec, {
          specialty: spec,
          doctors: new Set<string>(),
          totalAihs: 0,
          totalAihValue: 0,
          procedureMap: new Map<string, { code: string; desc: string; count: number; total: number }>(),
        });
      }
      const bucket = specialtyMap.get(spec);
      bucket.doctors.add(d.doctor_info.cns || d.doctor_info.name);
      const allAIHs = d.patients || [];
      bucket.totalAihs += allAIHs.length;
      bucket.totalAihValue += allAIHs.reduce((s, p) => s + (p.total_value_reais || 0), 0);
      allAIHs.forEach(p => {
        (p.procedures || []).forEach(proc => {
          if (isAnesthetistProcedure(proc)) return;
          const key = proc.procedure_code || proc.procedure_description || String(Math.random());
          const prev = bucket.procedureMap.get(key) || { code: proc.procedure_code || '', desc: proc.procedure_description || '', count: 0, total: 0 };
          prev.count += 1;
          prev.total += proc.value_reais || 0;
          bucket.procedureMap.set(key, prev);
        });
      });
    });

    const rows = Array.from(specialtyMap.values()).map((b: any) => {
      const procedures = Array.from(b.procedureMap.values()).sort((a: any, c: any) => c.count - a.count);
      const totalProcedures = procedures.reduce((s: number, p: any) => s + p.count, 0);
      const totalProceduresValue = procedures.reduce((s: number, p: any) => s + p.total, 0);
      const topProcedures = procedures.slice(0, 10);
      const top3Count = procedures.slice(0, 3).reduce((s: number, p: any) => s + p.count, 0);
      const patternRate = totalProcedures > 0 ? Math.round((top3Count / totalProcedures) * 100) : 0;
      return {
        specialty: b.specialty,
        doctorsCount: b.doctors.size,
        metrics: {
          totalAihs: b.totalAihs,
          avgAihValue: b.totalAihs > 0 ? b.totalAihValue / b.totalAihs : 0,
          totalProcedures,
          totalProceduresValue,
          patternRate,
        },
        topProcedures,
      };
    });

    // Ordena por valor total de procedimentos desc
    return rows.sort((a: any, b: any) => b.metrics.totalProceduresValue - a.metrics.totalProceduresValue);
  };

  if (loading) {
    return (
      <div className="min-h-[40vh] flex items-center justify-center">
        <div className="text-slate-500">Carregando procedimentos...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Seção de filtros local removida: cobertura via filtros globais do Analytics */}

      {/* Abas: Análises e Especialidades */}
      <Tabs value={activeView} onValueChange={(v) => setActiveView(v as any)}>
        <TabsList className="bg-slate-100">
          <TabsTrigger value="analytics">Médicos</TabsTrigger>
          <TabsTrigger value="specialties">Especialidades</TabsTrigger>
          <TabsTrigger value="hospitals">Hospitais</TabsTrigger>
        </TabsList>

        <TabsContent value="analytics" className="space-y-4">
          {(() => {
            const sections = (hospitalsList.length > 0 ? hospitalsList : [{ id: 'ALL', name: 'Todos os Hospitais' }]);
            return sections.map((h) => {
              const data = h.id === 'ALL' ? doctorAnalytics : getAnalyticsForHospital(h.id);
              return (
                <div key={`analytics-${h.id}`} className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="text-sm font-semibold text-slate-700">{h.name}</div>
                    <Badge variant="secondary" className="bg-slate-100 text-slate-700">Análises</Badge>
                  </div>
                  {data.length === 0 ? (
                    <Alert>
                      <AlertDescription>Nenhum médico encontrado com os filtros atuais.</AlertDescription>
                    </Alert>
                  ) : (
                    <div className="grid grid-cols-1 gap-4">
                      {data.map(({ doctor, metrics, topProcedures }: any, idx: number) => (
                        <Card key={`${h.id}-${doctor.doctor_info.cns}-${idx}`} className="border-slate-200">
                          <CardHeader className="pb-2">
                            <CardTitle className="text-base flex items-center justify-between">
                              <div className="truncate">{doctor.doctor_info.name}</div>
                              <Button
                                className="bg-green-600 hover:bg-green-700 text-white"
                                size="sm"
                                onClick={() => exportDoctorCardCsv(h.name, { doctor, metrics, topProcedures })}
                              >
                                <FileSpreadsheet className="h-4 w-4 mr-1" /> Excel
                              </Button>
                            </CardTitle>
                          </CardHeader>
                          <CardContent className="space-y-3">
                            <div className="text-xs text-slate-600">Especialidade: <span className="font-medium text-slate-800">{doctor.doctor_info.specialty || 'Não informado'}</span></div>
                            <div className="grid grid-cols-2 gap-3 text-sm">
                              <div>
                                <div className="text-slate-500">AIHs</div>
                                <div className="font-semibold">{metrics.totalAihs}</div>
                              </div>
                              <div>
                                <div className="text-slate-500">Valor médio AIH</div>
                                <div className="font-semibold">{metrics.avgAihValue.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</div>
                              </div>
                              <div>
                                <div className="text-slate-500">Procedimentos</div>
                                <div className="font-semibold">{metrics.totalProcedures}</div>
                              </div>
                              <div>
                                <div className="text-slate-500">Total Procedimentos</div>
                                <div className="font-semibold">{metrics.totalProceduresValue.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</div>
                              </div>
                            </div>
                            <div>
                              <div className="text-xs text-slate-500 mb-1">Top procedimentos</div>
                              {topProcedures.length === 0 ? (
                                <span className="text-xs text-slate-400">Sem dados</span>
                              ) : (
                                <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
                                  <table className="w-full text-sm">
                                    <thead className="bg-slate-50/80 text-slate-600">
                                      <tr>
                                        <th className="text-left px-3 py-2 font-medium">Procedimento</th>
                                        <th className="text-right px-3 py-2 font-medium">Qtde</th>
                                        <th className="text-right px-3 py-2 font-medium">Valor total</th>
                                      </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-200">
                                      {topProcedures.map((p: any, i: number) => (
                                        <tr key={i} className="hover:bg-slate-50">
                                          <td className="px-3 py-2 text-slate-700">
                                            <span className="font-mono text-xs text-slate-700 mr-1">{p.code || '—'}</span>
                                            <span className="text-slate-800">{p.desc || 'Sem descrição'}</span>
                                          </td>
                                          <td className="px-3 py-2 text-right text-slate-700">{p.count}</td>
                                          <td className="px-3 py-2 text-right font-medium text-slate-900">{(p.total || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</td>
                                        </tr>
                                      ))}
                                    </tbody>
                                  </table>
                                </div>
                              )}
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  )}
                </div>
              );
            });
          })()}
        </TabsContent>

        <TabsContent value="specialties" className="space-y-4">
          {(() => {
            const sections = (hospitalsList.length > 0 ? hospitalsList : [{ id: 'ALL', name: 'Todos os Hospitais' }]);
            return sections.map((h) => {
              const docs = h.id === 'ALL' ? filteredDoctors : getDoctorsForHospital(h.id);
              const specRows = getSpecialtyAnalytics(docs);
              return (
                <div key={`spec-${h.id}`} className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="text-sm font-semibold text-slate-700">{h.name}</div>
                    <Badge variant="secondary" className="bg-slate-100 text-slate-700">Especialidades</Badge>
                  </div>
                  {specRows.length === 0 ? (
                    <Alert>
                      <AlertDescription>Nenhuma especialidade com dados para o recorte atual.</AlertDescription>
                    </Alert>
                  ) : (
                    <div className="space-y-3">
                      {specRows.map((row: any, i: number) => (
                        <Card key={`${h.id}-${row.specialty}-${i}`} className="border-slate-200">
                          <CardHeader className="pb-2">
                            <CardTitle className="text-base flex items-center justify-between">
                              <div className="truncate">{row.specialty}</div>
                              <div className="flex items-center gap-2">
                                <Badge variant="outline" className="bg-slate-50 text-slate-700 border-slate-200">{row.doctorsCount} médico(s)</Badge>
                                <Button
                                  className="bg-green-600 hover:bg-green-700 text-white"
                                  size="sm"
                                  onClick={() => exportSpecialtyCardCsv(h.name, row)}
                                >
                                  <FileSpreadsheet className="h-4 w-4 mr-1" /> Excel
                                </Button>
                              </div>
                            </CardTitle>
                          </CardHeader>
                          <CardContent className="space-y-3">
                            <div className="grid grid-cols-2 gap-3 text-sm">
                              <div>
                                <div className="text-slate-500">AIHs</div>
                                <div className="font-semibold">{row.metrics.totalAihs}</div>
                              </div>
                              <div>
                                <div className="text-slate-500">Valor médio AIH</div>
                                <div className="font-semibold">{row.metrics.avgAihValue.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</div>
                              </div>
                              <div>
                                <div className="text-slate-500">Procedimentos</div>
                                <div className="font-semibold">{row.metrics.totalProcedures}</div>
                              </div>
                              <div>
                                <div className="text-slate-500">Total Procedimentos</div>
                                <div className="font-semibold">{row.metrics.totalProceduresValue.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</div>
                              </div>
                            </div>
                            <div>
                              <div className="text-xs text-slate-500 mb-1">Top procedimentos da especialidade</div>
                              {row.topProcedures.length === 0 ? (
                                <span className="text-xs text-slate-400">Sem dados</span>
                              ) : (
                                <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
                                  <table className="w-full text-sm">
                                    <thead className="bg-slate-50/80 text-slate-600">
                                      <tr>
                                        <th className="text-left px-3 py-2 font-medium">Procedimento</th>
                                        <th className="text-right px-3 py-2 font-medium">Qtde</th>
                                        <th className="text-right px-3 py-2 font-medium">Valor total</th>
                                      </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-200">
                                      {row.topProcedures.map((p: any, j: number) => (
                                        <tr key={`${i}-${j}`} className="hover:bg-slate-50">
                                          <td className="px-3 py-2 text-slate-700">
                                            <span className="font-mono text-xs text-slate-700 mr-1">{p.code || '—'}</span>
                                            <span className="text-slate-800">{p.desc || 'Sem descrição'}</span>
                                          </td>
                                          <td className="px-3 py-2 text-right text-slate-700">{p.count}</td>
                                          <td className="px-3 py-2 text-right font-medium text-slate-900">{(p.total || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</td>
                                        </tr>
                                      ))}
                                    </tbody>
                                  </table>
                                </div>
                              )}
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  )}
                </div>
              );
            });
          })()}
        </TabsContent>

        <TabsContent value="hospitals" className="space-y-4">
          {(() => {
            const sections = (hospitalsList.length > 0 ? hospitalsList : [{ id: 'ALL', name: 'Todos os Hospitais' }]);
            return sections.map((h) => {
              const docs = h.id === 'ALL' ? filteredDoctors : getDoctorsForHospital(h.id);
              const ha = getHospitalAnalytics(docs);
              return (
                <div key={`hosp-${h.id}`} className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="text-sm font-semibold text-slate-700">{h.name}</div>
                    <div className="flex items-center gap-2">
                      <Badge variant="secondary" className="bg-slate-100 text-slate-700">Hospitais</Badge>
                      <Button
                        className="bg-green-600 hover:bg-green-700 text-white"
                        size="sm"
                        onClick={() => exportHospitalSectionCsv(h.name, ha)}
                      >
                        <FileSpreadsheet className="h-4 w-4 mr-1" /> Excel
                      </Button>
                    </div>
                  </div>
                  {docs.length === 0 ? (
                    <Alert>
                      <AlertDescription>Nenhum dado para o hospital no recorte atual.</AlertDescription>
                    </Alert>
                  ) : (
                    <div className="space-y-4">
                      <Card className="border-slate-200">
                        <CardContent className="pt-4">
                          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                            <div>
                              <div className="text-slate-500">AIHs</div>
                              <div className="font-semibold">{ha.metrics.totalAihs}</div>
                            </div>
                            <div>
                              <div className="text-slate-500">Valor médio AIH</div>
                              <div className="font-semibold">{ha.metrics.avgAihValue.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</div>
                            </div>
                            <div>
                              <div className="text-slate-500">Procedimentos</div>
                              <div className="font-semibold">{ha.metrics.totalProcedures}</div>
                            </div>
                            <div>
                              <div className="text-slate-500">Total Procedimentos</div>
                              <div className="font-semibold">{ha.metrics.totalProceduresValue.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</div>
                            </div>
                          </div>
                        </CardContent>
                      </Card>

                      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                        <Card className="border-slate-200">
                          <CardHeader className="pb-2"><CardTitle className="text-base">Top especialidades por faturamento</CardTitle></CardHeader>
                          <CardContent>
                            {ha.topSpecialties.length === 0 ? (
                              <div className="text-xs text-slate-400">Sem dados</div>
                            ) : (
                              <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
                                <table className="w-full text-sm">
                                  <thead className="bg-slate-50/80 text-slate-600">
                                    <tr>
                                      <th className="text-left px-3 py-2 font-medium">Especialidade</th>
                                      <th className="text-right px-3 py-2 font-medium">Qtde proc.</th>
                                      <th className="text-right px-3 py-2 font-medium">Valor total</th>
                                    </tr>
                                  </thead>
                                  <tbody className="divide-y divide-slate-200">
                                    {ha.topSpecialties.map((s: any, i: number) => (
                                      <tr key={i} className="hover:bg-slate-50">
                                        <td className="px-3 py-2 text-slate-800">{s.name}</td>
                                        <td className="px-3 py-2 text-right text-slate-700">{s.procCount}</td>
                                        <td className="px-3 py-2 text-right font-medium text-slate-900">{(s.total || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              </div>
                            )}
                          </CardContent>
                        </Card>

                        <Card className="border-slate-200">
                          <CardHeader className="pb-2"><CardTitle className="text-base">Top procedimentos por faturamento</CardTitle></CardHeader>
                          <CardContent>
                            {ha.topProcedures.length === 0 ? (
                              <div className="text-xs text-slate-400">Sem dados</div>
                            ) : (
                              <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
                                <table className="w-full text-sm">
                                  <thead className="bg-slate-50/80 text-slate-600">
                                    <tr>
                                      <th className="text-left px-3 py-2 font-medium">Procedimento</th>
                                      <th className="text-right px-3 py-2 font-medium">Qtde</th>
                                      <th className="text-right px-3 py-2 font-medium">Valor total</th>
                                    </tr>
                                  </thead>
                                  <tbody className="divide-y divide-slate-200">
                                    {ha.topProcedures.map((p: any, i: number) => (
                                      <tr key={i} className="hover:bg-slate-50">
                                        <td className="px-3 py-2 text-slate-700">
                                          <span className="font-mono text-xs text-slate-700 mr-1">{p.code || '—'}</span>
                                          <span className="text-slate-800">{p.desc || 'Sem descrição'}</span>
                                        </td>
                                        <td className="px-3 py-2 text-right text-slate-700">{p.count}</td>
                                        <td className="px-3 py-2 text-right font-medium text-slate-900">{(p.total || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              </div>
                            )}
                          </CardContent>
                        </Card>
                      </div>

                      <Card className="border-slate-200">
                        <CardHeader className="pb-2"><CardTitle className="text-base">Médicos mais performáticos</CardTitle></CardHeader>
                        <CardContent>
                          {ha.topDoctors.length === 0 ? (
                            <div className="text-xs text-slate-400">Sem dados</div>
                          ) : (
                            <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
                              <table className="w-full text-sm">
                                <thead className="bg-slate-50/80 text-slate-600">
                                  <tr>
                                    <th className="text-left px-3 py-2 font-medium">Médico</th>
                                    <th className="text-right px-3 py-2 font-medium">AIHs</th>
                                    <th className="text-right px-3 py-2 font-medium">Procedimentos</th>
                                    <th className="text-right px-3 py-2 font-medium">Valor AIH</th>
                                    <th className="text-right px-3 py-2 font-medium">Ticket médio</th>
                                  </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-200">
                                  {ha.topDoctors.map((d: any, i: number) => (
                                    <tr key={i} className="hover:bg-slate-50">
                                      <td className="px-3 py-2 text-slate-800">{d.name}</td>
                                      <td className="px-3 py-2 text-right text-slate-700">{d.totalAihs}</td>
                                      <td className="px-3 py-2 text-right text-slate-700">{d.totalProcedures}</td>
                                      <td className="px-3 py-2 text-right font-medium text-slate-900">{(d.totalAihValue || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</td>
                                      <td className="px-3 py-2 text-right text-slate-700">{(d.avgAihValue || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          )}
                        </CardContent>
                      </Card>
                    </div>
                  )}
                </div>
              );
            });
          })()}
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default ProcedureHierarchyDashboard;



import React, { useEffect, useMemo, useRef, useState } from 'react';
import { DoctorsHierarchyV2Service } from '../services/doctorsHierarchyV2';
import type { DoctorWithPatients } from '../services/doctorPatientService';
import { useAuth } from '../contexts/AuthContext';
import { DateRange } from '../types';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Switch } from './ui/switch';
import { Badge } from './ui/badge';
import { Input } from './ui/input';
import { Button } from './ui/button';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from './ui/collapsible';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import { Alert, AlertDescription } from './ui/alert';
import { Users, FileText, Search, ChevronRight, ChevronDown, Calendar, Activity, LineChart, Filter, FileSpreadsheet } from 'lucide-react';
import { resolveCommonProcedureName } from '../utils/commonProcedureName';
import { COMMON_PROCEDURE_NAME_RULES } from '../config/commonProcedureNames';
import { CUSTOM_COMMON_PROCEDURE_NAME_RULES } from '../config/commonProcedureNames.custom';
import DoctorsSpecialtyComparison from './DoctorsSpecialtyComparison';
import AnalyticsCharts from './AnalyticsCharts';

interface ProcedureHierarchyDashboardProps {
  dateRange?: DateRange;
  selectedHospitals?: string[];
  selectedCareCharacter?: 'all' | '1' | '2';
  selectedSpecialty?: string;
  searchTerm?: string; // termo global (nome/CNS/CRM)
}

const ProcedureHierarchyDashboard: React.FC<ProcedureHierarchyDashboardProps> = ({ dateRange, selectedHospitals = ['all'], selectedCareCharacter = 'all', selectedSpecialty = 'all', searchTerm = '' }) => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [doctors, setDoctors] = useState<DoctorWithPatients[]>([]);

  // Estado de visualização
  const [activeView, setActiveView] = useState<'analytics' | 'specialties' | 'hospitals' | 'comparisons' | 'charts' | 'common'>('analytics');
  // Controle de expansão por médico (exibir todos os procedimentos além dos 5 primeiros)
  const [expandedDoctors, setExpandedDoctors] = useState<Record<string, boolean>>({});
  // Controle de expansão por especialidade
  const [expandedSpecialties, setExpandedSpecialties] = useState<Record<string, boolean>>({});
  // Nome comum selecionado
  const [selectedCommonName, setSelectedCommonName] = useState<string>('all');
  // Nomes comuns: incluir todos os hospitais (ignorar filtro de hospital)
  const [includeAllHospitalsCommon, setIncludeAllHospitalsCommon] = useState<boolean>(false);
  const [allDoctorsForCommon, setAllDoctorsForCommon] = useState<DoctorWithPatients[]>([]);
  const [commonLoading, setCommonLoading] = useState<boolean>(false);

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

  // Carregar médicos de TODOS os hospitais para a aba de Nomes Comuns, quando habilitado
  useEffect(() => {
    if (!includeAllHospitalsCommon) return;
    const loadAll = async () => {
      try {
        setCommonLoading(true);
        const dateFromISO = dateRange ? dateRange.startDate.toISOString() : undefined;
        const dateToISO = dateRange ? dateRange.endDate.toISOString() : undefined;
        const data = await DoctorsHierarchyV2Service.getDoctorsHierarchyV2({
          dateFromISO,
          dateToISO,
          hospitalIds: undefined, // forçar todos os hospitais
          careCharacter: selectedCareCharacter,
        });
        setAllDoctorsForCommon(data || []);
      } finally {
        setCommonLoading(false);
      }
    };
    loadAll();
  }, [includeAllHospitalsCommon, dateRange?.startDate?.toISOString(), dateRange?.endDate?.toISOString(), selectedCareCharacter]);

  // Catálogo de nomes comuns (labels) a partir das regras
  const availableCommonNames = useMemo(() => {
    try {
      const labels = new Set<string>();
      (CUSTOM_COMMON_PROCEDURE_NAME_RULES || []).forEach(r => r && r.label && labels.add(r.label));
      (COMMON_PROCEDURE_NAME_RULES || []).forEach((r: any) => r && r.label && labels.add(r.label));
      return Array.from(labels).sort((a, b) => a.localeCompare(b, 'pt-BR'));
    } catch { return []; }
  }, []);

  // Agregação: Nome Comum x Médico x Média do valor da AIH
  const commonNameDoctorRows = useMemo(() => {
    if (!selectedCommonName || selectedCommonName === 'all') return [] as Array<{ doctor: string; cns: string; aihCount: number; totalValue: number; avgValue: number; hospitalLabel: string }>;
    const map = new Map<string, { doctor: string; cns: string; aihCount: number; totalValue: number; hospitals: Set<string> }>();
    const source = includeAllHospitalsCommon ? (allDoctorsForCommon && allDoctorsForCommon.length > 0 ? allDoctorsForCommon : filteredDoctors) : filteredDoctors;
    (source || []).forEach(d => {
      const doctorName = d.doctor_info?.name || '';
      const cns = d.doctor_info?.cns || doctorName;
      const specialty = d.doctor_info?.specialty || '';
      (d.patients || []).forEach(p => {
        try {
          const procs = (p.procedures || []).map((pr: any) => ({
            procedure_code: pr?.procedure_code || '',
            procedure_date: pr?.procedure_date || pr?.data || pr?.execution_date || '',
            sequence: typeof pr?.sequence === 'number' ? pr.sequence : (typeof pr?.sequencia === 'number' ? pr.sequencia : undefined)
          }));
          const codes = procs.map(x => x.procedure_code).filter(Boolean);
          if (codes.length === 0) return;
          const resolved = resolveCommonProcedureName(codes, specialty, procs as any);
          if (resolved && resolved.trim().toLowerCase() === selectedCommonName.trim().toLowerCase()) {
            const key = cns || doctorName;
            const totalVal = Number(p.total_value_reais || 0);
            const prev = map.get(key) || { doctor: doctorName, cns, aihCount: 0, totalValue: 0, hospitals: new Set<string>() };
            prev.aihCount += 1;
            prev.totalValue += isFinite(totalVal) ? totalVal : 0;
            // adicionar hospital desta AIH
            try {
              const hid = (p as any)?.aih_info?.hospital_id;
              const hospName = (d.hospitals || []).find((h: any) => h.hospital_id === hid)?.hospital_name || hid;
              if (hospName) prev.hospitals.add(hospName);
            } catch {}
            map.set(key, prev);
          }
        } catch {}
      });
    });
    const rows = Array.from(map.values()).map(r => ({ 
      doctor: r.doctor, 
      cns: r.cns, 
      aihCount: r.aihCount, 
      totalValue: r.totalValue, 
      avgValue: r.aihCount > 0 ? r.totalValue / r.aihCount : 0,
      hospitalLabel: (() => {
        const count = r.hospitals.size;
        if (count === 0) return '—';
        if (count === 1) return Array.from(r.hospitals)[0];
        return 'Múltiplos';
      })()
    }));
    // Ordenar por média desc
    rows.sort((a, b) => b.avgValue - a.avgValue);
    return rows;
  }, [filteredDoctors, allDoctorsForCommon, includeAllHospitalsCommon, selectedCommonName]);

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
        .sort((a, b) => {
          const aIs04 = String(a.code || '').startsWith('04') ? 1 : 0;
          const bIs04 = String(b.code || '').startsWith('04') ? 1 : 0;
          if (aIs04 !== bIs04) return bIs04 - aIs04; // Prioriza códigos que começam com '04'
          return b.count - a.count;
        });

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

      const procedures = Array.from(procMap.values()).sort((a, b) => {
        const aIs04 = String(a.code || '').startsWith('04') ? 1 : 0;
        const bIs04 = String(b.code || '').startsWith('04') ? 1 : 0;
        if (aIs04 !== bIs04) return bIs04 - aIs04;
        return b.count - a.count;
      });
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
        // 🔧 PADRONIZAÇÃO: Remover "." e "-" do código de procedimento
        const procedureCode = (p.code || '—').replace(/[.\-]/g, '');
        push([
          quote(procedureCode),
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
        // 🔧 PADRONIZAÇÃO: Remover "." e "-" do código de procedimento
        const procedureCode = (p.code || '—').replace(/[.\-]/g, '');
        push([
          quote(procedureCode),
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
        // 🔧 PADRONIZAÇÃO: Remover "." e "-" do código de procedimento
        const procedureCode = (p.code || '—').replace(/[.\-]/g, '');
        push([quote(procedureCode), quote(p.desc || 'Sem descrição'), toInt(p.count), toDec(p.total)]);
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

  // Helper para converter arquivo em dataURL
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

  // Export helper: PDF por hospital (seção)
  const exportHospitalSectionPdf = async (hospitalName: string, ha: any) => {
    try {
      const { default: jsPDF } = await import('jspdf');
      const autoTable = (await import('jspdf-autotable')).default;
      const doc = new jsPDF({ orientation: 'landscape', unit: 'pt', format: 'a4' });

      // Logo (proporção 624x339)
      const logoData = await toDataUrl('/CIS Sem fundo.jpg');
      let headerBottomY = 40;
      if (logoData) {
        try {
          const logoW = 120;
          const logoH = Math.round((logoW / 624) * 339);
          const logoY = 20;
          doc.addImage(logoData, 'JPEG', 40, logoY, logoW, logoH);
          headerBottomY = Math.max(headerBottomY, logoY + logoH);
        } catch {}
      }

      // Título e subtítulo
      const title = 'Relatório — Hospital';
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(14);
      const titleY = 40;
      doc.text(title, 190, titleY);
      headerBottomY = Math.max(headerBottomY, titleY);

      doc.setFontSize(10);
      const periodStr = dateRange ? `${dateRange.startDate.toLocaleDateString('pt-BR')} a ${dateRange.endDate.toLocaleDateString('pt-BR')}` : '—';
      const subtitle = `Hospital: ${hospitalName}  •  Período: ${periodStr}`;
      const subY = titleY + 18;
      doc.text(subtitle, 190, subY);
      headerBottomY = Math.max(headerBottomY, subY);

      // Helpers para seções de página inteira
      const pageW = doc.internal.pageSize.getWidth();
      const pageH = doc.internal.pageSize.getHeight();
      const marginX = 40;
      const contentW = pageW - marginX * 2;
      const ensureSpace = (y: number) => {
        if (y > pageH - 80) { doc.addPage(); return 40; }
        return y;
      };
      const drawSectionHeader = (y: number, text: string) => {
        y = ensureSpace(y);
        doc.setFillColor(30, 64, 175);
        doc.rect(marginX, y, contentW, 24, 'F');
        doc.setTextColor(255, 255, 255);
        doc.setFontSize(11);
        doc.text(text, marginX + 12, y + 16);
        doc.setTextColor(0, 0, 0);
        return y + 32;
      };

      let startY = headerBottomY + 18;

      // Indicadores
      startY = drawSectionHeader(startY, 'Indicadores');
      autoTable(doc, {
        head: [["AIHs", "Valor médio AIH (BRL)", "Procedimentos", "Total Procedimentos (BRL)"]],
        body: [[
          String(ha.metrics?.totalAihs || 0),
          (ha.metrics?.avgAihValue || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }),
          String(ha.metrics?.totalProcedures || 0),
          (ha.metrics?.totalProceduresValue || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
        ]],
        startY,
        styles: { fontSize: 9, cellPadding: 6 },
        headStyles: { fillColor: [237, 242, 255], textColor: [51, 65, 85] },
        margin: { left: marginX, right: marginX }
      });
      // @ts-ignore
      startY = (doc as any).lastAutoTable.finalY + 16;

      // Seção contínua (sem nova página)
      // Top especialidades — largura total
      startY = drawSectionHeader(startY, 'Top especialidades por faturamento');
      autoTable(doc, {
        head: [["Especialidade", "Qtde proc.", "Valor total (BRL)"]],
        body: (ha.topSpecialties || []).map((s: any) => [
          s.name || '',
          String(s.procCount || 0),
          (s.total || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
        ]),
        startY,
        styles: { fontSize: 9, cellPadding: 6 },
        headStyles: { fillColor: [237, 242, 255], textColor: [51, 65, 85] },
        alternateRowStyles: { fillColor: [245, 247, 255] },
        margin: { left: marginX, right: marginX }
      });
      // @ts-ignore
      startY = (doc as any).lastAutoTable.finalY + 16;

      // Seção contínua (sem nova página)
      // Top procedimentos — largura total
      startY = drawSectionHeader(startY, 'Top procedimentos por valor');
      autoTable(doc, {
        head: [["Procedimento", "Qtde", "Valor total (BRL)"]],
        body: (ha.topProcedures || []).map((p: any) => [
          `${p.code || '—'} — ${p.desc || ''}`,
          String(p.count || 0),
          (p.total || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
        ]),
        startY,
        styles: { fontSize: 9, cellPadding: 6 },
        headStyles: { fillColor: [237, 242, 255], textColor: [51, 65, 85] },
        alternateRowStyles: { fillColor: [245, 247, 255] },
        margin: { left: marginX, right: marginX }
      });
      // @ts-ignore
      startY = (doc as any).lastAutoTable.finalY + 16;

      // Seção contínua (sem nova página)
      // Top médicos — largura total
      startY = drawSectionHeader(startY, 'Médicos mais performáticos');
      autoTable(doc, {
        head: [["Médico", "AIHs", "Procedimentos", "Valor AIH (BRL)", "Ticket médio (BRL)"]],
        body: (ha.topDoctors || []).map((d: any) => [
          d.name || '',
          String(d.totalAihs || 0),
          String(d.totalProcedures || 0),
          (d.totalAihValue || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }),
          (d.avgAihValue || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
        ]),
        startY,
        styles: { fontSize: 9, cellPadding: 6 },
        headStyles: { fillColor: [237, 242, 255], textColor: [51, 65, 85] },
        alternateRowStyles: { fillColor: [245, 247, 255] },
        margin: { left: marginX, right: marginX }
      });

      // Rodapé com numeração de páginas
      const pageCount = doc.getNumberOfPages();
      for (let i = 1; i <= pageCount; i++) {
        doc.setPage(i);
        const pageW2 = doc.internal.pageSize.getWidth();
        const pageH2 = doc.internal.pageSize.getHeight();
        doc.setFontSize(9);
        doc.setTextColor(100);
        const ts = new Date().toLocaleString('pt-BR');
        doc.text(`Página ${i} de ${pageCount}`, pageW2 - 40, pageH2 - 14, { align: 'right' });
        doc.text(`Gerado em ${ts}`, 40, pageH2 - 14);
      }

      doc.save(`hospital_${hospitalName.replace(/[^\w\-]+/g, '_')}_${new Date().toISOString().slice(0,10)}.pdf`);
    } catch (e) {
      console.error('Erro ao exportar PDF do hospital:', e);
    }
  };

  // Especialidades: agregação por especialidade → procedimentos e valores (exclui anestesista)
  type ProcAgg = { code: string; desc: string; count: number; total: number };
  type SpecialtyBucket = {
    specialty: string;
    doctors: Set<string>;
    totalAihs: number;
    totalAihValue: number;
    procedureMap: Map<string, ProcAgg>;
  };

  const getSpecialtyAnalytics = (doctorsSubset: DoctorWithPatients[]) => {
    const specialtyMap = new Map<string, SpecialtyBucket>();
    doctorsSubset.forEach(d => {
      const spec = (d.doctor_info.specialty || 'Não informado').trim();
      if (!specialtyMap.has(spec)) {
        specialtyMap.set(spec, {
          specialty: spec,
          doctors: new Set<string>(),
          totalAihs: 0,
          totalAihValue: 0,
          procedureMap: new Map<string, ProcAgg>(),
        });
      }
      const bucket = specialtyMap.get(spec)!;
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

    const rows = Array.from(specialtyMap.values()).map((b: SpecialtyBucket) => {
      const procedures = Array.from(b.procedureMap.values()).sort((a, c) => c.count - a.count);
      const totalProcedures = procedures.reduce((s, p) => s + p.count, 0);
      const totalProceduresValue = procedures.reduce((s, p) => s + p.total, 0);
      const topProcedures = procedures.slice(0, 10);
      const top3Count = procedures.slice(0, 3).reduce((s, p) => s + p.count, 0);
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

      {/* Abas: Análises, Especialidades, Hospitais e Comparativos */}
      <Tabs value={activeView} onValueChange={(v) => setActiveView(v as any)}>
        <TabsList className="bg-slate-100">
          <TabsTrigger value="analytics">Médicos</TabsTrigger>
          <TabsTrigger value="specialties">Especialidades</TabsTrigger>
          <TabsTrigger value="hospitals">Hospitais</TabsTrigger>
          <TabsTrigger value="comparisons">Comparativos</TabsTrigger>
          <TabsTrigger value="common">Nomes Comuns</TabsTrigger>
          <TabsTrigger value="charts">Gráficos</TabsTrigger>
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
                      {data.map(({ doctor, metrics, topProcedures, procedures }: any, idx: number) => (
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
                              <div className="text-xs text-slate-500 mb-1">Procedimentos</div>
                              {(!procedures || procedures.length === 0) ? (
                                <span className="text-xs text-slate-400">Sem dados</span>
                              ) : (
                                <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
                                  <table className="w-full text-sm">
                                    <thead className="bg-slate-50/80 text-slate-600">
                                      <tr>
                                        <th className="text-left px-3 py-2 font-medium">Procedimento</th>
                                        <th className="text-right px-3 py-2 font-medium">Qtde</th>
                                        <th className="text-right px-3 py-2 font-medium">Valor</th>
                                        <th className="text-right px-3 py-2 font-medium">Valor total</th>
                                      </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-200">
                                      {(() => {
                                        const rowKey = doctor.doctor_info.cns || `${doctor.doctor_info.name}-${idx}`;
                                        const isExpanded = !!expandedDoctors[rowKey];
                                        const visible = isExpanded ? procedures : procedures.slice(0, 5);
                                        return visible.map((p: any, i: number) => (
                                          <tr key={i} className="hover:bg-slate-50">
                                            <td className="px-3 py-2 text-slate-700">
                                              <span className="font-mono text-xs text-slate-700 mr-1">{p.code || '—'}</span>
                                              <span className="text-slate-800">{p.desc || 'Sem descrição'}</span>
                                            </td>
                                            <td className="px-3 py-2 text-right text-slate-700">{p.count}</td>
                                            <td className="px-3 py-2 text-right text-slate-700">{((p.total || 0) / Math.max(1, p.count || 0)).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</td>
                                            <td className="px-3 py-2 text-right font-medium text-slate-900">{(p.total || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</td>
                                          </tr>
                                        ));
                                      })()}
                                    </tbody>
                                  </table>
                                </div>
                              )}
                              {!!procedures && procedures.length > 5 && (
                                <div className="mt-2 flex justify-end">
                                  {(() => {
                                    const rowKey = doctor.doctor_info.cns || `${doctor.doctor_info.name}-${idx}`;
                                    const isExpanded = !!expandedDoctors[rowKey];
                                    return (
                                      <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={() => setExpandedDoctors(prev => ({ ...prev, [rowKey]: !prev[rowKey] }))}
                                      >
                                        {isExpanded ? 'Ver menos' : 'Ver mais'}
                                      </Button>
                                    );
                                  })()}
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
                                      {(() => {
                                        const rowKey = `${h.id}-${row.specialty}`;
                                        const isExpanded = !!expandedSpecialties[rowKey];
                                        const visible = isExpanded ? row.topProcedures : row.topProcedures.slice(0, 5);
                                        return visible.map((p: any, j: number) => (
                                          <tr key={`${i}-${j}`} className="hover:bg-slate-50">
                                            <td className="px-3 py-2 text-slate-700">
                                              <span className="font-mono text-xs text-slate-700 mr-1">{p.code || '—'}</span>
                                              <span className="text-slate-800">{p.desc || 'Sem descrição'}</span>
                                            </td>
                                            <td className="px-3 py-2 text-right text-slate-700">{p.count}</td>
                                            <td className="px-3 py-2 text-right text-slate-700">{((p.total || 0) / Math.max(1, p.count || 0)).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</td>
                                            <td className="px-3 py-2 text-right font-medium text-slate-900">{(p.total || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</td>
                                          </tr>
                                        ));
                                      })()}
                                    </tbody>
                                  </table>
                                </div>
                              )}
                              {row.topProcedures.length > 5 && (
                                <div className="mt-2 flex justify-end">
                                  {(() => {
                                    const rowKey = `${h.id}-${row.specialty}`;
                                    const isExpanded = !!expandedSpecialties[rowKey];
                                    return (
                                      <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={() => setExpandedSpecialties(prev => ({ ...prev, [rowKey]: !prev[rowKey] }))}
                                      >
                                        {isExpanded ? 'Ver menos' : 'Ver mais'}
                                      </Button>
                                    );
                                  })()}
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
                      <Button
                        className="bg-blue-600 hover:bg-blue-700 text-white"
                        size="sm"
                        onClick={() => exportHospitalSectionPdf(h.name, ha)}
                      >
                        PDF
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

                      <div className="grid grid-cols-1 gap-4">
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
                                      <th className="text-right px-3 py-2 font-medium">Valor</th>
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
                                        <td className="px-3 py-2 text-right text-slate-700">{((p.total || 0) / Math.max(1, p.count || 0)).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</td>
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

        <TabsContent value="comparisons" className="space-y-4">
          <DoctorsSpecialtyComparison
            dateRange={dateRange}
            selectedHospitals={selectedHospitals}
            selectedCareCharacter={selectedCareCharacter}
            selectedSpecialty={selectedSpecialty}
            searchTerm={searchTerm}
            doctorsFromDashboard={filteredDoctors}
          />
        </TabsContent>

        <TabsContent value="charts" className="space-y-4">
          <AnalyticsCharts
            dateRange={dateRange}
            doctors={filteredDoctors}
            specialty={selectedSpecialty}
            selectedHospitals={selectedHospitals}
            careCharacter={selectedCareCharacter}
          />
        </TabsContent>

        {/* NOME COMUM x MÉDICO x MÉDIA AIH */}
        <TabsContent value="common" className="space-y-4">
          <Card className="border-slate-200">
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Nome Comum × Médico × Média da AIH</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3 items-end">
                <div className="w-full">
                  <label className="text-xs font-medium text-gray-600 uppercase tracking-wide mb-1.5 block">Nome Comum</label>
                  <div className="flex items-center gap-2">
                    <select
                      value={selectedCommonName}
                      onChange={(e) => setSelectedCommonName(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-200 rounded-lg bg-white text-sm h-9"
                    >
                      <option value="all">Selecione...</option>
                      {availableCommonNames.map((label) => (
                        <option key={label} value={label}>{label}</option>
                      ))}
                    </select>
                    {selectedCommonName !== 'all' && (
                      <button
                        onClick={() => setSelectedCommonName('all')}
                        className="px-2 py-1 text-xs text-blue-600 hover:text-blue-800 hover:bg-blue-50 rounded transition-colors"
                        title="Limpar"
                      >
                        ✕
                      </button>
                    )}
                  </div>
                </div>
                <div className="w-full">
                  <label className="text-xs font-medium text-gray-600 uppercase tracking-wide mb-1.5 block">Todos os Hospitais</label>
                  <div className="flex items-center gap-2 h-9">
                    <Switch checked={includeAllHospitalsCommon} onCheckedChange={setIncludeAllHospitalsCommon} />
                    <span className="text-sm text-slate-700">{includeAllHospitalsCommon ? 'Ativado' : 'Desativado'}</span>
                  </div>
                </div>
              </div>

              {selectedCommonName === 'all' ? (
                <div className="text-xs text-slate-500">Escolha um Nome Comum para ver os médicos e a média do valor das AIHs associadas.</div>
              ) : (
                <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
                  <table className="w-full text-sm">
                    <thead className="bg-slate-50/80 text-slate-600">
                      <tr>
                        <th className="text-left px-3 py-2 font-medium">Médico</th>
                        <th className="text-left px-3 py-2 font-medium">CNS</th>
                        <th className="text-left px-3 py-2 font-medium">Hospital</th>
                        <th className="text-right px-3 py-2 font-medium">AIHs</th>
                        <th className="text-right px-3 py-2 font-medium">Média AIH</th>
                        <th className="text-right px-3 py-2 font-medium">Total AIH</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200">
                      {commonNameDoctorRows.length === 0 ? (
                        <tr>
                          <td className="px-3 py-3 text-xs text-slate-400" colSpan={5}>Sem dados para o nome comum selecionado.</td>
                        </tr>
                      ) : (
                        commonNameDoctorRows.map((row, i) => (
                          <tr key={row.cns || i} className="hover:bg-slate-50">
                            <td className="px-3 py-2 text-slate-800">{row.doctor}</td>
                            <td className="px-3 py-2 text-slate-700">{row.cns || '—'}</td>
                            <td className="px-3 py-2 text-slate-700">{row.hospitalLabel}</td>
                            <td className="px-3 py-2 text-right text-slate-700">{row.aihCount}</td>
                            <td className="px-3 py-2 text-right font-medium text-slate-900">{row.avgValue.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</td>
                            <td className="px-3 py-2 text-right text-slate-700">{row.totalValue.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default ProcedureHierarchyDashboard;



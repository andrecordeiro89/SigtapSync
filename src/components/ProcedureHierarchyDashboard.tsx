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
// Tabs removidos: Hierarquia não será mais exibida
import { Alert, AlertDescription } from './ui/alert';
import { Users, FileText, Search, ChevronRight, ChevronDown, Calendar, Activity, LineChart, Filter } from 'lucide-react';

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

  // Filtros locais
  const [doctorSearch, setDoctorSearch] = useState('');
  const [procedureSearch, setProcedureSearch] = useState('');
  // Removido: estado de abas (apenas Análises permanece)

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

  // Normalização de busca de procedimento
  const procTermRaw = procedureSearch.toLowerCase().trim();
  const procTermNorm = procTermRaw.replace(/[\.\s]/g, '');

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

  // Filtragem de médicos por nome/CRM/CNS (usa termo global + local)
  const filteredDoctors = useMemo(() => {
    const docTerm = (doctorSearch || searchTerm).toLowerCase().trim();
    return (doctors || []).filter(d => {
      const dn = (d.doctor_info.name || '').toLowerCase();
      const dcns = (d.doctor_info.cns || '').toLowerCase();
      const dcrm = (d.doctor_info.crm || '').toLowerCase();
      const matchesDoctor = !docTerm || dn.includes(docTerm) || dcns.includes(docTerm) || dcrm.includes(docTerm);
      if (!matchesDoctor) return false;
      if (selectedSpecialty && selectedSpecialty !== 'all') {
        if ((d.doctor_info.specialty || '').toLowerCase() !== selectedSpecialty.toLowerCase()) return false;
      }
      if (!procTermRaw) return true;
      // Só mantém o médico se houver algum procedimento que case
      return d.patients.some(p => (p.procedures || []).some(proc => {
        if (isAnesthetistProcedure(proc)) return false;
        const codeNorm = (proc.procedure_code || '').toLowerCase().replace(/[\.\s]/g, '');
        const desc = (proc.procedure_description || '').toLowerCase();
        return codeNorm.includes(procTermNorm) || desc.includes(procTermRaw);
      }));
    });
  }, [doctors, doctorSearch, searchTerm, procTermRaw, procTermNorm, selectedSpecialty]);

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

  if (loading) {
    return (
      <div className="min-h-[40vh] flex items-center justify-center">
        <div className="text-slate-500">Carregando procedimentos...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header / Filtros Superiores */}
      <Card className="bg-gradient-to-br from-white to-slate-50 border-slate-200/80">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <LineChart className="h-6 w-6 text-slate-700" />
              <span>Procedimentos por Médico</span>
            </div>
            <Badge variant="secondary" className="bg-slate-100 text-slate-700">{doctorAnalytics.length} médico(s)</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          <div className="flex flex-col md:flex-row gap-3 items-stretch md:items-end">
            <div className="flex-1 min-w-[220px] relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <Input
                placeholder="Buscar médico (nome, CNS, CRM)..."
                value={doctorSearch}
                onChange={(e) => setDoctorSearch(e.target.value)}
                className="pl-10"
              />
            </div>
            <div className="flex-1 min-w-[280px] relative">
              <FileText className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <Input
                placeholder="Buscar procedimento (código ou descrição)..."
                value={procedureSearch}
                onChange={(e) => setProcedureSearch(e.target.value)}
                className="pl-10"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Somente Análises (Hierarquia removida) */}
      <div className="space-y-4">
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
                            <CardTitle className="text-base">
                              <div className="truncate">{doctor.doctor_info.name}</div>
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
      </div>
    </div>
  );
};

export default ProcedureHierarchyDashboard;



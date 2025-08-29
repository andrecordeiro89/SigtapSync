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
import { Users, FileText, Search, ChevronRight, ChevronDown, Calendar, Activity, LineChart, Filter } from 'lucide-react';

interface ProcedureHierarchyDashboardProps {
  dateRange?: DateRange;
  selectedHospitals?: string[];
}

const ProcedureHierarchyDashboard: React.FC<ProcedureHierarchyDashboardProps> = ({ dateRange, selectedHospitals = ['all'] }) => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [doctors, setDoctors] = useState<DoctorWithPatients[]>([]);

  // Filtros locais
  const [doctorSearch, setDoctorSearch] = useState('');
  const [procedureSearch, setProcedureSearch] = useState('');
  const [activeTab, setActiveTab] = useState<'hierarchy' | 'analytics'>('hierarchy');

  // Carregar hierarquia
  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);
        const dateFromISO = dateRange ? dateRange.startDate.toISOString() : undefined;
        const dateToISO = dateRange ? dateRange.endDate.toISOString() : undefined;
        // Forçar TODOS os hospitais: agruparemos visualmente por hospital
        const hospitalIds = undefined;
        const data = await DoctorsHierarchyV2Service.getDoctorsHierarchyV2({
          dateFromISO,
          dateToISO,
          hospitalIds,
        });
        setDoctors(data);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [dateRange?.startDate?.toISOString(), dateRange?.endDate?.toISOString()]);

  // Normalização de busca de procedimento
  const procTermRaw = procedureSearch.toLowerCase().trim();
  const procTermNorm = procTermRaw.replace(/[\.\s]/g, '');

  // Filtragem de médicos por nome/CRM/CNS
  const filteredDoctors = useMemo(() => {
    const docTerm = doctorSearch.toLowerCase().trim();
    return (doctors || []).filter(d => {
      const dn = (d.doctor_info.name || '').toLowerCase();
      const dcns = (d.doctor_info.cns || '').toLowerCase();
      const dcrm = (d.doctor_info.crm || '').toLowerCase();
      const matchesDoctor = !docTerm || dn.includes(docTerm) || dcns.includes(docTerm) || dcrm.includes(docTerm);
      if (!matchesDoctor) return false;
      if (!procTermRaw) return true;
      // Só mantém o médico se houver algum procedimento que case
      return d.patients.some(p => (p.procedures || []).some(proc => {
        const codeNorm = (proc.procedure_code || '').toLowerCase().replace(/[\.\s]/g, '');
        const desc = (proc.procedure_description || '').toLowerCase();
        return codeNorm.includes(procTermNorm) || desc.includes(procTermRaw);
      }));
    });
  }, [doctors, doctorSearch, procTermRaw, procTermNorm]);

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

      {/* Abas: Hierarquia e Analytics */}
      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)}>
        <TabsList className="bg-slate-100">
          <TabsTrigger value="hierarchy">Hierarquia</TabsTrigger>
          <TabsTrigger value="analytics">Análises</TabsTrigger>
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
                    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                      {data.map(({ doctor, metrics, topProcedures }: any, idx: number) => (
                        <Card key={`${h.id}-${doctor.doctor_info.cns}-${idx}`} className="border-slate-200">
                          <CardHeader className="pb-2">
                            <CardTitle className="text-base flex items-center justify-between">
                              <div className="truncate">{doctor.doctor_info.name}</div>
                              <Badge variant="outline" className={metrics.hasStrongPattern ? 'bg-purple-50 text-purple-700 border-purple-200' : 'bg-slate-50 text-slate-700 border-slate-200'}>
                                Padrão {metrics.patternRate}%
                              </Badge>
                            </CardTitle>
                          </CardHeader>
                          <CardContent className="space-y-3">
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
                              <div className="flex flex-wrap gap-1">
                                {topProcedures.length === 0 ? (
                                  <span className="text-xs text-slate-400">Sem dados</span>
                                ) : topProcedures.map((p: any, i: number) => (
                                  <Badge key={i} variant="outline" className="text-xs">
                                    {p.code || 'Sem código'} · {p.count}
                                  </Badge>
                                ))}
                              </div>
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

        <TabsContent value="hierarchy" className="space-y-4">
          {(() => {
            const sections = (hospitalsList.length > 0 ? hospitalsList : [{ id: 'ALL', name: 'Todos os Hospitais' }]);
            return sections.map((h) => {
              const docs = h.id === 'ALL' ? filteredDoctors : getDoctorsForHospital(h.id);
              if (docs.length === 0) {
                return (
                  <div key={`hier-${h.id}`} className="space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="text-sm font-semibold text-slate-700">{h.name}</div>
                      <Badge variant="secondary" className="bg-slate-100 text-slate-700">Hierarquia</Badge>
                    </div>
                    <Alert>
                      <AlertDescription>Nenhum resultado com os filtros.</AlertDescription>
                    </Alert>
                  </div>
                );
              }
              return (
                <div key={`hier-${h.id}`} className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="text-sm font-semibold text-slate-700">{h.name}</div>
                    <Badge variant="secondary" className="bg-slate-100 text-slate-700">Hierarquia</Badge>
                  </div>
                  {docs.map((doctor, dIdx) => (
              <Card key={`${h.id}-${doctor.doctor_info.cns}-${dIdx}`} className="border-slate-200">
                <CardHeader className="pb-2">
                  <CardTitle className="text-base flex items-center justify-between">
                    <div className="truncate">{doctor.doctor_info.name}</div>
                    <Badge variant="secondary" className="bg-slate-100 text-slate-700">{doctor.patients.length} paciente(s)</Badge>
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {(doctor.patients || []).map((patient, pIdx) => {
                    const anyProcMatch = !!procTermRaw && (patient.procedures || []).some(proc => {
                      const codeNorm = (proc.procedure_code || '').toLowerCase().replace(/[\.\s]/g, '');
                      const desc = (proc.procedure_description || '').toLowerCase();
                      return codeNorm.includes(procTermNorm) || desc.includes(procTermRaw);
                    });
                    return (
                      <Collapsible key={(patient.patient_id || '') + pIdx}>
                        <CollapsibleTrigger asChild>
                          <div className="w-full cursor-pointer p-3 rounded-lg hover:bg-slate-50 border border-slate-200 flex items-center justify-between">
                            <div className="flex items-center gap-3">
                              <div className="w-9 h-9 rounded-lg bg-slate-100 flex items-center justify-center">
                                <Users className="h-4 w-4 text-slate-600" />
                              </div>
                              <div>
                                <div className="font-medium text-slate-800">
                                  {patient.patient_info.name || 'Paciente'}
                                  {anyProcMatch && (
                                    <Badge variant="outline" className="ml-2 bg-purple-50 text-purple-700 border-purple-200 text-[10px]">Procedimento</Badge>
                                  )}
                                </div>
                                <div className="text-xs text-slate-600">CNS: {patient.patient_info.cns || '—'}</div>
                              </div>
                            </div>
                            <div className="text-right">
                              <div className="text-sm text-slate-600">Valor AIH</div>
                              <div className="font-semibold text-slate-900">{(patient.total_value_reais || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</div>
                            </div>
                          </div>
                        </CollapsibleTrigger>
                        <CollapsibleContent>
                          <div className="mt-3 space-y-2">
                            {(patient.procedures || []).length === 0 ? (
                              <div className="text-slate-500 text-sm flex items-center gap-2 py-4 justify-center">
                                <Activity className="h-4 w-4" />
                                Nenhum procedimento
                              </div>
                            ) : (
                              (patient.procedures || [])
                                .sort((a, b) => new Date(b.procedure_date).getTime() - new Date(a.procedure_date).getTime())
                                .filter(proc => {
                                  if (!procTermRaw) return true;
                                  const codeNorm = (proc.procedure_code || '').toLowerCase().replace(/[\.\s]/g, '');
                                  const desc = (proc.procedure_description || '').toLowerCase();
                                  return codeNorm.includes(procTermNorm) || desc.includes(procTermRaw);
                                })
                                .map((procedure, idx) => (
                                  <div key={procedure.procedure_id || idx} className="p-3 rounded-lg bg-white border border-slate-200">
                                    <div className="flex items-center justify-between">
                                      <div className="flex items-center gap-2">
                                        <Badge variant="outline" className="text-xs bg-slate-50">{procedure.procedure_code || '—'}</Badge>
                                        <div className="text-sm text-slate-800">{procedure.procedure_description || 'Descrição não disponível'}</div>
                                      </div>
                                      <div className="text-sm font-semibold text-slate-900">
                                        {(procedure.value_reais || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                                      </div>
                                    </div>
                                    <div className="mt-2 grid grid-cols-2 md:grid-cols-3 gap-2 text-xs text-slate-600">
                                      <div className="flex items-center gap-1.5">
                                        <Calendar className="h-3.5 w-3.5" />
                                        {procedure.procedure_date ? new Date(procedure.procedure_date).toLocaleDateString('pt-BR') : '—'}
                                      </div>
                                    </div>
                                  </div>
                                ))
                            )}
                          </div>
                        </CollapsibleContent>
                      </Collapsible>
                    );
                  })}
                </CardContent>
              </Card>
                  ))}
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



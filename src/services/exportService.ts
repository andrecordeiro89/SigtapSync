import { DoctorsHierarchyV2Service, type HierarchyFilters } from './doctorsHierarchyV2';
import * as XLSX from 'xlsx';
import { format } from 'date-fns';

export interface AllPatientsExportFilters extends HierarchyFilters {
  // Filtros visuais adicionais da tela de Profissionais
  doctorSpecialty?: string;        // Especialidade do médico (selectedSpecialty)
  careSpecialty?: string;          // Especialidade de atendimento da AIH (selectedCareSpecialty)
  searchTerm?: string;             // Busca rápida (médico/procedimento)
}

export async function exportAllPatientsExcel(filters: AllPatientsExportFilters = {}): Promise<void> {
  // Normalizar janela de datas para respeitar regra de alta: [start, nextDayStart)
  const normalized: AllPatientsExportFilters = { ...filters };
  if (filters.dateFromISO) {
    const s = new Date(filters.dateFromISO);
    normalized.dateFromISO = new Date(Date.UTC(s.getUTCFullYear(), s.getUTCMonth(), s.getUTCDate(), 0, 0, 0, 0)).toISOString();
  }
  if (filters.dateToISO) {
    const e = new Date(filters.dateToISO);
    // Não avançar um dia aqui; o serviço DoctorsHierarchyV2 calculará endExclusive internamente
    normalized.dateToISO = new Date(Date.UTC(e.getUTCFullYear(), e.getUTCMonth(), e.getUTCDate(), 0, 0, 0, 0)).toISOString();
  }
  let hierarchy = await DoctorsHierarchyV2Service.getDoctorsHierarchyV2(normalized);

  // =============================================================
  // Aplicar os mesmos filtros visuais da tela
  // =============================================================
  // 1) Especialidade do médico
  if (filters.doctorSpecialty && filters.doctorSpecialty.trim().toLowerCase() !== 'all') {
    const sel = filters.doctorSpecialty.trim().toLowerCase();
    hierarchy = hierarchy.filter(card => (card.doctor_info?.specialty || '').toLowerCase() === sel);
  }

  // 2) Especialidade de atendimento (AIH) — filtra pacientes dentro do card
  if (filters.careSpecialty && filters.careSpecialty.trim().toLowerCase() !== 'all') {
    const selCare = filters.careSpecialty.trim().toLowerCase();
    hierarchy = hierarchy
      .map(card => {
        const patients = (card.patients || []).filter(p => {
          const spec = (((p as any).aih_info?.specialty) || ((p as any).aih_info?.especialidade) || '').toString().toLowerCase();
          return spec === selCare;
        });
        return { ...card, patients };
      })
      .filter(card => (card.patients || []).length > 0);
  }

  // 3) Busca rápida (médico e procedimentos)
  if (filters.searchTerm && filters.searchTerm.trim()) {
    const raw = filters.searchTerm.trim().toLowerCase();
    const norm = raw.replace(/[\.\s]/g, '');
    hierarchy = hierarchy.filter(card => {
      const name = (card.doctor_info?.name || '').toLowerCase();
      const cns = (card.doctor_info?.cns || '').toLowerCase();
      const crm = (card.doctor_info?.crm || '').toLowerCase();
      const matchesDoctor = name.includes(raw) || cns.includes(raw) || crm.includes(raw);
      const matchesProc = (card.patients || []).some(p => (p.procedures || []).some((pr: any) => {
        const c = (pr?.procedure_code || '').toLowerCase().replace(/[\.\s]/g, '');
        const d = (pr?.procedure_description || pr?.sigtap_description || '').toLowerCase();
        return c.includes(norm) || d.includes(raw);
      }));
      return matchesDoctor || matchesProc;
    });
  }

  // =============================================================
  // Cabeçalho (Resumo dos Filtros)
  // =============================================================
  const fmt = (d?: string) => d ? format(new Date(d), 'dd/MM/yyyy') : '';
  const startISO = normalized.dateFromISO;
  const endExclusiveISO = normalized.dateToISO;
  let periodLabel = 'Sem filtro de período';
  let modeLabel = 'Período de Alta';
  if (startISO && endExclusiveISO) {
    const start = new Date(startISO);
    const endExclusive = new Date(endExclusiveISO);
    const endInclusive = new Date(endExclusive.getTime() - 1);
    const isOneDay = (endExclusive.getTime() - start.getTime()) === 24 * 60 * 60 * 1000;
    periodLabel = isOneDay
      ? `Data de Alta: ${fmt(startISO)}`
      : `Período de Alta: ${fmt(startISO)} a ${fmt(endInclusive.toISOString())}`;
    modeLabel = isOneDay ? 'Modo: Apenas Data de Alta' : 'Modo: Intervalo de Alta';
  }

  // Hospitais (derivado do próprio resultado — nomes legíveis)
  const hospitalNames = new Set<string>();
  for (const card of hierarchy as any[]) {
    const name = (card.hospitals && card.hospitals[0]?.hospital_name) || '';
    if (name) hospitalNames.add(name);
  }
  let hospitalsLabel = 'Hospitais: Todos';
  if (filters.hospitalIds && filters.hospitalIds.length > 0 && !filters.hospitalIds.includes('all')) {
    const list = Array.from(hospitalNames);
    if (list.length === 0) hospitalsLabel = 'Hospitais: Selecionados';
    else if (list.length <= 6) hospitalsLabel = `Hospitais: ${list.join(' | ')}`;
    else hospitalsLabel = `Hospitais: ${list.length} selecionados (ex.: ${list.slice(0, 6).join(' | ')} …)`;
  }

  // Caráter
  const mapCare = (c?: string) => c === '1' ? 'Eletivo' : (c === '2' ? 'Urgência/Emergência' : (c || 'Todos'));
  const careLabel = `Caráter: ${mapCare(filters.careCharacter as any)}`;

  const generatedAt = `Gerado em: ${format(new Date(), 'dd/MM/yyyy HH:mm')}`;

  // Montar linhas únicas por paciente (por cartão). Não deduplica entre médicos/hospitais.
  const rows: Array<Array<string | number>> = [];

  // Cabeçalhos
  const summaryHeader: string[] = ['Relatório — Pacientes do Período'];
  const emptyRow: string[] = [''];
  const filtersBlock: string[][] = [
    [periodLabel],
    [modeLabel],
    [hospitalsLabel],
    [careLabel],
    [generatedAt],
  ];
  const header = ['#', 'Nome do Paciente', 'Prontuário', 'Nº AIH', 'Data Alta (SUS)', 'Valor Total', 'Médico', 'Hospital'];

  let index = 1;
  for (const card of hierarchy) {
    const doctorName = card.doctor_info?.name || '';
    const hospitalName = (card.hospitals && card.hospitals[0]?.hospital_name) || '';
    for (const p of (card.patients || [])) {
      const patientName = p.patient_info?.name || 'Paciente';
      const medicalRecord = p.patient_info?.medical_record || '-';
      const aihNumberRaw = (p as any)?.aih_info?.aih_number || '';
      const aihNumberClean = aihNumberRaw.toString().replace(/\D/g, '');
      const dischargeISO = (p as any)?.aih_info?.discharge_date;
      const dischargeLabel = (() => {
        if (!dischargeISO) return '';
        const s = String(dischargeISO);
        const m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
        if (m) return `${m[3]}/${m[2]}/${m[1]}`;
        // Fallback seguro em UTC
        const d = new Date(s);
        const dd = String(d.getUTCDate()).padStart(2, '0');
        const mm = String(d.getUTCMonth() + 1).padStart(2, '0');
        const yyyy = d.getUTCFullYear();
        return `${dd}/${mm}/${yyyy}`;
      })();
      const totalReais = Number(p.total_value_reais || 0);

      rows.push([
        index++,
        patientName,
        medicalRecord,
        aihNumberClean,
        dischargeLabel,
        totalReais,
        doctorName,
        hospitalName,
      ]);
    }
  }

  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.aoa_to_sheet([
    summaryHeader,
    ...filtersBlock,
    emptyRow,
    header,
    ...rows
  ]);
  (ws as any)['!cols'] = [
    { wch: 5 },
    { wch: 40 },
    { wch: 16 },
    { wch: 18 },
    { wch: 16 },
    { wch: 18 },
    { wch: 28 },
    { wch: 30 },
  ];
  XLSX.utils.book_append_sheet(wb, ws, 'Pacientes');

  const fileName = `Relatorio_Pacientes_Todos_${format(new Date(), 'yyyyMMdd_HHmm')}.xlsx`;
  XLSX.writeFile(wb, fileName);
}

// ================================================================
// 🧾 Relatório de Anestesia (CBO 225151) — Excel
// - Uma linha por paciente/AIH contendo as anestesias em colunas sequenciais
// - Se houver mais de MAX_COLUMNS anestesias, a última coluna indica "+X"
// - Filtros: hospitalIds, dateFromISO, dateToISO (compatível com DoctorsHierarchyV2Service)
// ================================================================

export interface AnesthesiaExportFilters extends HierarchyFilters {
  maxColumnsPerPatient?: number; // padrão 5
  doctorNameContains?: string;
}

export async function exportAnesthesiaExcel(filters: AnesthesiaExportFilters = {}): Promise<void> {
  const {
    maxColumnsPerPatient = 5,
    ...hierarchyFilters
  } = filters;

  const hierarchy = await DoctorsHierarchyV2Service.getDoctorsHierarchyV2(hierarchyFilters);

  // Cabeçalho base
  const dynamicHeaders: string[] = [];
  for (let i = 1; i <= maxColumnsPerPatient; i++) {
    dynamicHeaders.push(`Anestesia ${i}`);
  }

  const header = [
    '#',
    'Nome do Paciente',
    'Prontuário',
    'CNS Paciente',
    'Profissional',
    'CNS Profissional',
    'Nº AIH',
    'Data Alta (SUS)',
    'Hospital',
    'Total Anestesias',
    ...dynamicHeaders,
    'Obs.'
  ];

  const rows: Array<Array<string | number>> = [];
  const summaryMap: Map<string, { name: string; cns: string; hospital: string; acts: number; aihs: number }> = new Map();
  let index = 1;

  const cards = (hierarchy as any[]).filter(card => {
    if (filters.doctorNameContains) {
      const name = (card?.doctor_info?.name || '').toString().toLowerCase();
      return name.includes(filters.doctorNameContains.toLowerCase());
    }
    return true;
  });

  for (const card of cards) {
    const hospitalNameFromCard = (card.hospitals && card.hospitals[0]?.hospital_name) || '';
    for (const p of (card.patients || [])) {
      // Filtrar procedimentos de anestesia por CBO 225151
      const anesth = (p.procedures || []).filter((proc: any) => String(proc?.cbo || '').trim() === '225151');
      if (anesth.length === 0) continue; // somente pacientes com anestesia

      // Identificadores e labels
      const patientName = p.patient_info?.name || 'Paciente';
      const medicalRecord = p.patient_info?.medical_record || '-';
      const cns = p.patient_info?.cns || '';
      const aihNumberRaw = (p as any)?.aih_info?.aih_number || '';
      const aihNumberClean = aihNumberRaw.toString().replace(/\D/g, '');
      const dischargeISO = (p as any)?.aih_info?.discharge_date || (p as any)?.aih_info?.admission_date;
      const dischargeLabel = dischargeISO ? format(new Date(dischargeISO), 'dd/MM/yyyy') : '';

      // Montar colunas dinâmicas
      const cols: string[] = [];
      const sorted = anesth.sort((a: any, b: any) => new Date(a.procedure_date).getTime() - new Date(b.procedure_date).getTime());
      const limit = Math.min(sorted.length, maxColumnsPerPatient);
      for (let i = 0; i < limit; i++) {
        const ap = sorted[i];
        const dateLabel = ap?.procedure_date ? format(new Date(ap.procedure_date), 'dd/MM/yyyy') : '';
        const desc = ap?.procedure_description || ap?.sigtap_description || '';
        const code = ap?.procedure_code || '';
        cols.push(`${code}${dateLabel ? ' | ' + dateLabel : ''}${desc ? ' | ' + (desc as string).slice(0, 60) : ''}`);
      }
      // Preencher vazio até o limite
      while (cols.length < maxColumnsPerPatient) cols.push('');

      const extra = sorted.length > maxColumnsPerPatient ? `+${sorted.length - maxColumnsPerPatient}` : '';

      // Profissional anestesista principal (primeiro ato) ou múltiplos
      const first = sorted[0] || {};
      const anestName = first?.professional_name || 'Múltiplos profissionais';
      const anestCns = first?.professional_cns || '';

      // Resumo por cada ato (CNS/hospital)
      for (const ap of sorted) {
        const name = String(ap?.professional_name || anestName || '');
        const cnsProf = String(ap?.professional_cns || anestCns || '');
        const key = `${cnsProf}::${hospitalNameFromCard}`;
        const curr = summaryMap.get(key) || { name, cns: cnsProf, hospital: hospitalNameFromCard, acts: 0, aihs: 0 };
        curr.acts += 1;
        summaryMap.set(key, curr);
      }
      // Contabilizar AIH para o (primeiro) profissional
      if (anestCns) {
        const keyAIH = `${anestCns}::${hospitalNameFromCard}`;
        const curr = summaryMap.get(keyAIH) || { name: anestName, cns: anestCns, hospital: hospitalNameFromCard, acts: 0, aihs: 0 };
        curr.aihs += 1;
        summaryMap.set(keyAIH, curr);
      }

      rows.push([
        index++,
        patientName,
        medicalRecord,
        cns,
        anestName,
        anestCns,
        aihNumberClean,
        dischargeLabel,
        hospitalNameFromCard,
        sorted.length,
        ...cols,
        extra
      ]);
    }
  }

  if (rows.length === 0) {
    // Criar planilha vazia com cabeçalho para indicar ausência de dados
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet([header]);
    XLSX.utils.book_append_sheet(wb, ws, 'Anestesia');
    const fileNameEmpty = `Relatorio_Anestesia_CBO_225151_${format(new Date(), 'yyyyMMdd_HHmm')}.xlsx`;
    XLSX.writeFile(wb, fileNameEmpty);
    return;
  }

  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.aoa_to_sheet([header, ...rows]);
  (ws as any)['!cols'] = [
    { wch: 5 },   // #
    { wch: 40 },  // Paciente
    { wch: 16 },  // Prontuário
    { wch: 18 },  // CNS Paciente
    { wch: 28 },  // Profissional
    { wch: 18 },  // CNS Profissional
    { wch: 18 },  // AIH
    { wch: 16 },  // Data Alta
    { wch: 30 },  // Hospital
    { wch: 18 },  // Total Anestesias
    ...Array.from({ length: maxColumnsPerPatient }, () => ({ wch: 50 })), // colunas de anestesia
    { wch: 8 }    // Obs
  ];
  XLSX.utils.book_append_sheet(wb, ws, 'Anestesia');

  // Resumo por Profissional e Hospital
  const summaryHeader = ['Profissional', 'CNS', 'Hospital', 'Atos Anestésicos', 'AIHs com anestesia'];
  const summaryRows = [summaryHeader, ...Array.from(summaryMap.values()).map((v) => [v.name, v.cns, v.hospital, v.acts, v.aihs])];
  const wsSum = XLSX.utils.aoa_to_sheet(summaryRows);
  (wsSum as any)['!cols'] = [{ wch: 30 }, { wch: 18 }, { wch: 30 }, { wch: 16 }, { wch: 16 }];
  XLSX.utils.book_append_sheet(wb, wsSum, 'Resumo Profissionais');

  const fileName = `Relatorio_Anestesia_CBO_225151_${format(new Date(), 'yyyyMMdd_HHmm')}.xlsx`;
  XLSX.writeFile(wb, fileName);
}

 
